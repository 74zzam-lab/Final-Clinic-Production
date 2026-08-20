/**
 * Google Drive sync CAS orchestration — revision check + If-Match on same mutation.
 * Tested directly with in-memory fake store (SOURCE VERIFIED); real Drive = UAT.
 */
const crypto = require('crypto');

function normalizePayloadBuffer(payload) {
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

function parseDatabaseVersion(text, branchId) {
  try {
    const doc = JSON.parse(String(text || '{}'));
    if (branchId && doc?.branches?.[branchId]?.databaseVersion != null) {
      return Number(doc.branches[branchId].databaseVersion);
    }
    return Number(doc?.databaseVersion || 0);
  } catch {
    return null;
  }
}

function revisionMismatch(expected, actual, message) {
  return {
    ok: false,
    code: 'remote_revision_mismatch',
    message: message || 'remote_revision_mismatch',
    retry: true,
    expectedRevision: expected,
    actualRevision: actual,
  };
}

function mapDriveError(err) {
  if (err?.code === 'remote_revision_mismatch' || err?.status === 412) {
    return {
      ok: false,
      code: 'remote_revision_mismatch',
      message: err.message || 'remote_revision_mismatch',
      retry: true,
    };
  }
  return {
    ok: false,
    message: err?.message || String(err),
    needsReauth: !!err?.needsReauth,
  };
}

/**
 * @param {object} deps — injectable Drive API surface (real or fake store)
 * @param {object} oauth2
 * @param {string} remotePath
 * @param {Buffer|string|object} payload
 * @param {object} meta — expectedDatabaseVersion, branchId, atomicReplace
 */
async function conditionalReplaceJson(deps, oauth2, remotePath, payload, meta = {}) {
  const data = normalizePayloadBuffer(payload);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const expectedRev = meta.expectedDatabaseVersion != null ? Number(meta.expectedDatabaseVersion) : null;
  const branchId = meta.branchId || null;
  const mimeType = 'application/json';

  try {
    const existing = await deps.findFileByPath(oauth2, remotePath, { includeEtag: true });

    if (existing?.id) {
      const dl = await deps.downloadByPath(oauth2, remotePath);
      if (!dl?.buffer && !dl?.text) {
        return { ok: false, message: 'remote_read_failed' };
      }
      const remoteText = dl.text || String(dl.buffer || '');
      const actualRev = parseDatabaseVersion(remoteText, branchId);
      const etag = existing.etag || dl.file?.etag;

      if (expectedRev != null && !Number.isFinite(expectedRev)) {
        return { ok: false, code: 'baseline_revision_unknown', message: 'baseline_revision_unknown' };
      }
      if (expectedRev != null && actualRev != null && actualRev !== expectedRev) {
        return revisionMismatch(expectedRev, actualRev);
      }
      if (expectedRev != null && actualRev == null) {
        return { ok: false, code: 'remote_revision_unconfirmed', message: 'remote_revision_unconfirmed' };
      }
      if (!etag) {
        return { ok: false, code: 'remote_etag_unconfirmed', message: 'remote_etag_unconfirmed' };
      }

      const updated = await deps.updateFileConditional(
        oauth2,
        existing.id,
        { name: existing.name },
        mimeType,
        data,
        { ifMatch: etag }
      );

      return {
        ok: true,
        id: updated.id,
        path: remotePath,
        sha256: hash,
        md5: updated.md5Checksum,
        etag: updated.etag,
        atomic: true,
        cas: true,
        provider: meta.provider || 'google',
      };
    }

    if (expectedRev != null && expectedRev !== 0) {
      return revisionMismatch(expectedRev, 0, 'remote_revision_mismatch');
    }

    const parts = String(remotePath || '').split('/').filter(Boolean);
    const fileName = parts.pop();
    const parentId = await deps.resolveFolderPath(oauth2, parts, { create: true });
    const created = await deps.createFile(
      oauth2,
      { name: fileName, parents: parentId ? [parentId] : undefined },
      mimeType,
      data,
      { ifNoneMatch: '*' }
    );

    return {
      ok: true,
      id: created.id,
      path: remotePath,
      sha256: hash,
      md5: created.md5Checksum,
      etag: created.etag,
      atomic: true,
      cas: true,
      created: true,
      provider: meta.provider || 'google',
    };
  } catch (err) {
    return mapDriveError(err);
  }
}

module.exports = {
  conditionalReplaceJson,
  normalizePayloadBuffer,
  parseDatabaseVersion,
  revisionMismatch,
  mapDriveError,
};
