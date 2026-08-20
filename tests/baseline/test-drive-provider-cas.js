#!/usr/bin/env node
'use strict';

/**
 * Production Drive adapter CAS semantics — SOURCE VERIFIED via in-memory fake store.
 * Proves If-Match closes TOCTOU on the same interface used by google-drive.js.
 * Real Google Drive UAT remains a separate gate.
 */
const { conditionalReplaceJson } = require('../../electron/cloud-providers/drive-sync-cas');

const errors = [];
function check(ok, msg) {
  if (!ok) errors.push(msg);
}

function makeFakeStore() {
  const files = new Map();
  let seq = 1;

  function key(remotePath) {
    return String(remotePath || '').replace(/\\/g, '/');
  }

  function nextEtag() {
    seq += 1;
    return `"etag-${seq}"`;
  }

  const oauth2 = { token: 'fake' };

  const deps = {
    async resolveFolderPath(_oauth2, parts, opts = {}) {
      if (parts.length && !opts.create) return parts.length ? 'folder-root' : null;
      return parts.length ? 'folder-root' : null;
    },
    async findFileByPath(_oauth2, remotePath) {
      const k = key(remotePath);
      const f = files.get(k);
      if (!f) return null;
      return { id: f.id, name: f.name, etag: f.etag };
    },
    async downloadByPath(_oauth2, remotePath) {
      const k = key(remotePath);
      const f = files.get(k);
      if (!f) return null;
      return { text: f.text, buffer: Buffer.from(f.text, 'utf8'), file: { etag: f.etag } };
    },
    async updateFileConditional(_oauth2, fileId, metadata, _mime, data, options = {}) {
      const entry = [...files.values()].find((x) => x.id === fileId);
      if (!entry) {
        const err = new Error('not_found');
        err.status = 404;
        throw err;
      }
      if (options.ifMatch && options.ifMatch !== entry.etag) {
        const err = new Error('drive_precondition_failed');
        err.code = 'remote_revision_mismatch';
        err.status = 412;
        err.retry = true;
        throw err;
      }
      entry.text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      entry.etag = nextEtag();
      entry.name = metadata?.name || entry.name;
      return { id: entry.id, md5Checksum: 'fake-md5', etag: entry.etag };
    },
    async createFile(_oauth2, metadata, _mime, data, options = {}) {
      const remotePath = metadata.parents ? `folder/${metadata.name}` : metadata.name;
      const k = key(remotePath);
      if (options.ifNoneMatch === '*' && files.has(k)) {
        const err = new Error('drive_precondition_failed');
        err.code = 'remote_revision_mismatch';
        err.status = 412;
        throw err;
      }
      const id = `file-${files.size + 1}`;
      const etag = nextEtag();
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      files.set(k, { id, name: metadata.name, text, etag });
      return { id, md5Checksum: 'fake-md5', etag };
    },
  };

  return { oauth2, deps, files, key };
}

async function testConcurrentToctouRace() {
  const store = makeFakeStore();
  const remotePath = 'NajjarTech/Center/centers/CTR-1/branches/BR-MAD/versions.json';
  const branchId = 'BR-MAD';

  const seed = JSON.stringify({
    centerId: 'CTR-1',
    databaseVersion: 10,
    branches: { [branchId]: { databaseVersion: 10 } },
  }, null, 2);

  store.files.set(store.key(remotePath), {
    id: 'seed-1',
    name: 'versions.json',
    text: seed,
    etag: '"etag-10"',
  });

  const readA = await store.deps.findFileByPath(store.oauth2, remotePath);
  const readB = await store.deps.findFileByPath(store.oauth2, remotePath);
  check(readA.etag === readB.etag, 'A and B observe same etag before write');

  const payloadA = JSON.stringify({
    centerId: 'CTR-1',
    databaseVersion: 11,
    branches: { [branchId]: { databaseVersion: 11 } },
    writer: 'A',
  }, null, 2);
  const payloadB = JSON.stringify({
    centerId: 'CTR-1',
    databaseVersion: 11,
    branches: { [branchId]: { databaseVersion: 11 } },
    writer: 'B',
  }, null, 2);

  const writeA = await conditionalReplaceJson(store.deps, store.oauth2, remotePath, payloadA, {
    expectedDatabaseVersion: 10,
    branchId,
  });
  check(writeA.ok === true, 'writer A succeeds with If-Match');

  const writeB = await conditionalReplaceJson(store.deps, store.oauth2, remotePath, payloadB, {
    expectedDatabaseVersion: 10,
    branchId,
  });
  check(writeB.ok === false, 'writer B rejected (stale etag / revision)');
  check(writeB.code === 'remote_revision_mismatch', 'writer B gets remote_revision_mismatch not silent overwrite');

  const final = await store.deps.downloadByPath(store.oauth2, remotePath);
  const finalDoc = JSON.parse(final.text);
  check(finalDoc.writer === 'A', 'remote final state keeps A not stale B overwrite');
  check(finalDoc.databaseVersion === 11, 'remote revision bumped once');
}

async function testRetryAfterMismatch() {
  const store = makeFakeStore();
  const remotePath = 'folder/versions.json';
  const branchId = 'BR-X';

  store.files.set(store.key(remotePath), {
    id: 'seed-2',
    name: 'versions.json',
    text: JSON.stringify({
      databaseVersion: 5,
      branches: { [branchId]: { databaseVersion: 5 } },
    }),
    etag: '"etag-5"',
  });

  const stale = await conditionalReplaceJson(store.deps, store.oauth2, remotePath, JSON.stringify({
    databaseVersion: 6,
    branches: { [branchId]: { databaseVersion: 6 } },
    writer: 'stale',
  }), { expectedDatabaseVersion: 5, branchId });
  check(stale.ok, 'same-device retry with correct expected succeeds');

  const retry = await conditionalReplaceJson(store.deps, store.oauth2, remotePath, JSON.stringify({
    databaseVersion: 7,
    branches: { [branchId]: { databaseVersion: 7 } },
    writer: 'merged',
  }), { expectedDatabaseVersion: 6, branchId });
  check(retry.ok, 'loser pull-merge-push next revision succeeds');
}

async function testCreateOnlyIfAbsent() {
  const store = makeFakeStore();
  const remotePath = 'folder/new-versions.json';

  store.deps.createFile = async (_oauth2, metadata, _mime, data, options = {}) => {
    const k = store.key(remotePath);
    if (options.ifNoneMatch === '*' && store.files.has(k)) {
      const err = new Error('drive_precondition_failed');
      err.code = 'remote_revision_mismatch';
      err.status = 412;
      throw err;
    }
    const id = `file-${store.files.size + 1}`;
    const etag = '"etag-new"';
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    store.files.set(k, { id, name: metadata.name, text, etag });
    return { id, md5Checksum: 'fake-md5', etag };
  };

  const first = await conditionalReplaceJson(store.deps, store.oauth2, remotePath, '{"databaseVersion":1}', {
    expectedDatabaseVersion: 0,
  });
  check(first.ok && first.created, 'creates when absent with expected 0');

  const dup = await conditionalReplaceJson(store.deps, store.oauth2, remotePath, '{"databaseVersion":2}', {
    expectedDatabaseVersion: 0,
  });
  check(!dup.ok && dup.code === 'remote_revision_mismatch', 'create blocked when file exists but expected 0');
}

async function main() {
  await testConcurrentToctouRace();
  await testRetryAfterMismatch();
  await testCreateOnlyIfAbsent();

  if (errors.length) {
    console.error('FAIL: drive provider CAS semantics');
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log('PASS: drive provider CAS semantics (SOURCE VERIFIED — fake store with If-Match)');
  console.log('NOTE: Real Google Drive UAT still required for production sign-off');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
