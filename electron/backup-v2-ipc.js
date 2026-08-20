'use strict';

/**
 * Backup V2 IPC wiring (Hybrid). Main-process only — no CSP impact.
 * Feature flag: HYBRID_BACKUP_V2 (default enabled).
 */
const path = require('path');
const fs = require('fs');
const { dialog } = require('electron');
const backupV2 = require('./backup-v2-core');
const restoreAuthority = require('./restore-authority');
const backupV2Cloud = require('./backup-v2-cloud');
const backupV2ScopeTruth = require('./backup-v2-scope-truth');
const { BackupV2Scheduler } = require('./backup-v2-scheduler');
const { copyWithResume, uploadWithResume } = require('./backup-v2-transfer');
const backupMain = require('./backup');

function isBackupV2Enabled() {
  const raw = process.env.HYBRID_BACKUP_V2;
  if (raw == null || raw === '') return true;
  return raw !== '0' && raw !== 'false';
}

function asIdentity(opts = {}) {
  const centerId = String(opts.centerId || opts.organizationId || '').slice(0, 128);
  const organizationId = String(opts.organizationId || opts.centerId || '').slice(0, 128);
  const branchId = String(opts.branchId || '').slice(0, 128);
  const authorizedBranchIds = Array.isArray(opts.authorizedBranchIds)
    ? opts.authorizedBranchIds.map((v) => String(v).slice(0, 128)).filter(Boolean)
    : (branchId ? [branchId] : []);
  return {
    centerId,
    organizationId,
    branchId,
    authorizedBranchIds,
    deviceId: String(opts.deviceId || '').slice(0, 128),
    centerName: String(opts.centerName || '').slice(0, 200),
    deviceName: String(opts.deviceName || '').slice(0, 200),
    allowMissingSourceMetadata: opts.allowMissingSourceMetadata === true,
  };
}

function createFileCredentialVault(userDataDir) {
  const storePath = path.join(userDataDir, 'settings', 'backup-v2-credentials.json');
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch {
      return {};
    }
  }
  function writeAll(data) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, `${JSON.stringify(data)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  return {
    has(key) {
      const all = readAll();
      return Boolean(all[key]);
    },
    get(key) {
      const all = readAll();
      return all[key] || null;
    },
    set(key, value) {
      const all = readAll();
      all[key] = String(value || '');
      writeAll(all);
    },
    remove(key) {
      const all = readAll();
      delete all[key];
      writeAll(all);
    },
  };
}

function registerBackupV2Ipc({
  handle,
  V,
  getUserDataPath,
  appVersion,
  app,
  closeDatabase,
  reopenDatabase,
  applySecurityMaterial,
  rollbackSecurityMaterial,
  getCurrentSecurityMaterial,
  getLiveIdentity,
}) {
  if (!isBackupV2Enabled()) return { enabled: false, scheduler: null };

  let scheduler = null;
  try {
    const recovered = backupV2.recoverInterruptedRestore?.(getUserDataPath(), {
      restoreRoots: backupV2.RESTORE_ROOTS,
    });
    if (recovered?.action === 'rolled_back') {
      console.warn('[backup-v2] recovered interrupted restore via rollback', recovered);
    }
  } catch (e) {
    console.warn('[backup-v2] recoverInterruptedRestore failed', e?.message || e);
  }

  function resolveIdentity(opts = {}) {
    const fromLive = typeof getLiveIdentity === 'function' ? (getLiveIdentity() || {}) : {};
    return asIdentity({ ...fromLive, ...opts });
  }

  function databasePath() {
    return path.join(getUserDataPath(), 'database', 'tadawi.db');
  }

  function buildScopeContext(opts = {}, identity = {}) {
    return {
      centerId: identity.centerId,
      organizationId: identity.organizationId,
      branchId: identity.branchId,
      deviceId: identity.deviceId,
      sourceDeviceId: opts.sourceDeviceId || identity.deviceId,
      appVersion: appVersion || '2.0.0',
      licensedBranchIds: Array.isArray(opts.licensedBranchIds) ? opts.licensedBranchIds : [],
      localBranchIds: Array.isArray(opts.localBranchIds) ? opts.localBranchIds : [],
      branchNames: opts.branchNames && typeof opts.branchNames === 'object' ? opts.branchNames : {},
      branchIds: identity.authorizedBranchIds,
    };
  }

  function resolveScopeForCreate(opts = {}, identity = {}) {
    const userDataDir = getUserDataPath();
    const dbPath = databasePath();
    const scopeCtx = buildScopeContext(opts, identity);
    const signals = backupV2ScopeTruth.collectDatabaseSignals(dbPath, userDataDir, scopeCtx);
    const requestedScope = String(opts.scopeType || SCOPE_BRANCH_DEFAULT).toLowerCase();
    try {
      const scopeTruth = backupV2ScopeTruth.resolveBackupScope(requestedScope, signals, scopeCtx);
      return { scopeTruth, signals, requestedScope: scopeTruth.scopeType };
    } catch (error) {
      const friendly = backupV2.friendlyBackupError(error);
      const err = new Error(friendly.message);
      err.code = friendly.code;
      err.details = error.details || null;
      throw err;
    }
  }

  const SCOPE_BRANCH_DEFAULT = 'branch';

  function defaultBackupDir() {
    return path.join(getUserDataPath(), 'Backups', 'V2');
  }

  function cloudRetentionCount(opts = {}) {
    const n = Number(opts.cloudRetentionCount ?? opts.retentionCount);
    return Number.isFinite(n) && n > 0
      ? Math.min(100, Math.max(1, n))
      : backupV2Cloud.DEFAULT_CLOUD_RETENTION;
  }

  async function pruneCloudAfterUpload(uploadResult, opts = {}) {
    const keepPath = uploadResult?.remotePath || uploadResult?.path || null;
    return backupV2Cloud.pruneCloudV2Backups(
      (provider, prefix) => backupMain.listCloudBackups(provider, prefix),
      (remotePath, provider) => backupMain.deleteCloudBackup(remotePath, provider),
      cloudRetentionCount(opts),
      keepPath
    );
  }

  async function stageCloudBackupsForRestore(maxCandidates = 5) {
    const listed = await backupV2Cloud.listCloudV2Backups(
      (provider, prefix) => backupMain.listCloudBackups(provider, prefix)
    );
    if (!listed.ok || !listed.items.length) return [];
    const stageDir = path.join(getUserDataPath(), 'Backups', 'V2', 'cloud-staging');
    fs.mkdirSync(stageDir, { recursive: true });
    const staged = [];
    for (const item of listed.items.slice(0, Math.max(1, maxCandidates))) {
      const remotePath = item.path || item.remotePath;
      if (!remotePath) continue;
      const dl = await backupMain.downloadCloudBackup(remotePath, 'google');
      if (!dl?.ok) continue;
      const buf = dl.buffer || Buffer.from(String(dl.text || ''), 'utf8');
      if (!buf?.length) continue;
      const safeName = path.basename(remotePath).replace(/[^\w.\-]+/g, '_');
      const destPath = path.join(stageDir, safeName);
      fs.writeFileSync(destPath, buf);
      staged.push({
        ...item,
        filePath: destPath,
        createdAt: item.modifiedAt || item.createdAt,
        source: 'cloud',
      });
    }
    return staged;
  }

  async function collectRestoreCandidates(opts = {}) {
    const localDir = opts.dir
      ? V.asString(opts.dir, { name: 'dir', required: true, allowEmpty: false })
      : defaultBackupDir();
    const local = backupV2.listLocalBackupFiles(localDir).map((f) => ({ ...f, source: 'local' }));
    const explicit = Array.isArray(opts.cloudCandidates) ? opts.cloudCandidates : [];
    if (explicit.length) return [...local, ...explicit];
    if (opts.includeCloud === false) return local;
    const staged = await stageCloudBackupsForRestore(Number(opts.cloudCandidateLimit) || 5);
    return [...local, ...staged];
  }

  function optionalBackupPassword(opts) {
    if (opts.password == null || opts.password === '') return null;
    const password = V.asString(opts.password, { name: 'password', required: false, allowEmpty: true, max: 256 });
    if (password && password.length < 8) {
      const err = new Error('password_too_short');
      err.code = 'password_too_short';
      throw err;
    }
    return password || null;
  }

  async function runRestore(filePath, opts = {}) {
    const identity = resolveIdentity(opts);
    const progress = [];
    const buf = fs.readFileSync(filePath);
    if (backupV2.isEncryptedBackupBuffer(buf)) {
      const friendly = backupV2.friendlyBackupError({ code: 'backup_legacy_encrypted_direct_restore_blocked' });
      const err = new Error(friendly.message);
      err.code = friendly.code;
      throw err;
    }
    const licensedBranchIds = Array.isArray(opts.licensedBranchIds)
      ? opts.licensedBranchIds.map((v) => String(v).slice(0, 128)).filter(Boolean)
      : [];
    try {
      const result = await backupV2.restoreBackupFile({
        filePath,
        userDataDir: opts.targetUserDataDir || getUserDataPath(),
        expectedIdentity: identity,
        licensedBranchIds,
        skipScopeTruth: opts.skipScopeTruth === true,
        requireScopeTruth: opts.requireScopeTruth === true,
        allowLegacyBranchless: opts.allowLegacyBranchless !== false,
        closeDatabase: closeDatabase || undefined,
        reopenDatabase: reopenDatabase || undefined,
        applySecurityMaterial: applySecurityMaterial || undefined,
        rollbackSecurityMaterial: rollbackSecurityMaterial || undefined,
        currentSecurityMaterial: typeof getCurrentSecurityMaterial === 'function'
          ? getCurrentSecurityMaterial()
          : undefined,
        onProgress: (evt) => progress.push(evt),
        unrestorableReport: Array.isArray(opts.unrestorableReport) ? opts.unrestorableReport : [],
      });
      result.progress = progress;
      if (result.ok && result.needRestart && opts.relaunch !== false && app) {
        setTimeout(() => {
          try {
            app.relaunch();
            app.exit(0);
          } catch { /* ignore */ }
        }, 250);
      }
      return result;
    } catch (error) {
      const friendly = backupV2.friendlyBackupError(error);
      const err = new Error(friendly.message);
      err.code = friendly.code;
      err.progress = progress;
      throw err;
    }
  }

  handle('backup:v2:health', async () => {
    const databasePath = path.join(getUserDataPath(), 'database', 'tadawi.db');
    return {
      ...backupV2.databaseHealth(databasePath),
      gate: backupV2.readRestoreGate(getUserDataPath()),
      rowCounts: backupV2.countDatabaseRows(databasePath),
    };
  });

  handle('backup:v2:readiness', async (_e, options) => {
    const opts = V.asObject(options || {}, { name: 'options' });
    const identity = resolveIdentity(opts);
    const userDataDir = getUserDataPath();
    const dbPath = databasePath();
    const scopeCtx = buildScopeContext(opts, identity);
    return backupV2ScopeTruth.assessBackupReadiness(userDataDir, dbPath, scopeCtx);
  });

  handle('backup:v2:create', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options' });
    const identity = resolveIdentity(opts);
    const { scopeTruth, requestedScope } = resolveScopeForCreate(opts, identity);
    const userDataDir = getUserDataPath();
    const outDir = opts.outputDir
      ? V.asString(opts.outputDir, { name: 'outputDir', required: true, allowEmpty: false })
      : defaultBackupDir();
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(outDir, `Tadawi-Backup-V2-${stamp}.tdw`);
    const createOpts = {
      userDataDir,
      outputPath: filePath,
      appVersion: appVersion || '2.0.0',
      backupType: opts.backupType || 'manual',
      centerId: identity.centerId,
      organizationId: identity.organizationId,
      branchId: identity.branchId,
      branchIds: scopeTruth.includedBranchIds,
      includedBranchIds: scopeTruth.includedBranchIds,
      deviceId: identity.deviceId,
      centerName: identity.centerName,
      deviceName: identity.deviceName,
      scopeType: requestedScope,
      scopeTruth,
      retentionCount: Number(opts.retentionCount) || 20,
      cloudRetentionCount: cloudRetentionCount(opts),
    };

    const uploadRequested = opts.cloud === true || opts.upload === true;
    if (!uploadRequested) {
      const created = await backupV2.createBackupFile(createOpts);
      const pruned = backupV2.pruneLocalBackups(outDir, createOpts.retentionCount, { keepPath: created.path });
      return { ...created, localOk: true, cloudOk: false, cloudSkipped: true, pruned: pruned.pruned };
    }

    return backupV2.createBackupWithUpload({
      ...createOpts,
      upload: async ({ path: localPath, buffer, filename, hash, manifest }) => {
        const stageDir = path.join(outDir, 'upload-staging');
        fs.mkdirSync(stageDir, { recursive: true });
        const staged = path.join(stageDir, filename);
        uploadWithResume(localPath, staged, { resume: true });
        const remotePath = `${backupV2Cloud.CLOUD_V2_PREFIX}/${filename}`;
        const uploaded = await backupMain.uploadCloud(buffer, filename, 'google', {
          remotePath,
          overwrite: false,
          sha256: hash,
          manifest,
        });
        if (!uploaded?.ok) {
          const err = new Error(uploaded?.message || 'cloud_upload_failed');
          err.code = uploaded?.needsReauth ? 'needs_reauth' : 'cloud_upload_failed';
          if (/quota|storageExceeded/i.test(String(uploaded?.message || ''))) err.code = 'quota_exceeded';
          throw err;
        }
        try { fs.unlinkSync(staged); } catch { /* ignore */ }
        try { fs.unlinkSync(`${staged}.partial`); } catch { /* ignore */ }
        return {
          ok: true,
          remotePath: uploaded.path || remotePath,
          id: uploaded.id || null,
          expectedHash: hash,
          remoteHash: uploaded.md5 || uploaded.sha256 || hash,
          filename,
        };
      },
      pruneAfterUpload: async (upload) => {
        const localPruned = backupV2.pruneLocalBackups(outDir, createOpts.retentionCount, { keepPath: filePath }).pruned;
        const cloudPruned = await pruneCloudAfterUpload(upload, createOpts);
        return Number(localPruned || 0) + Number(cloudPruned?.pruned || 0);
      },
    });
  });

  handle('backup:v2:prune', async (_e, options) => {
    const opts = V.asObject(options || {}, { name: 'options' });
    const dir = opts.dir
      ? V.asString(opts.dir, { name: 'dir', required: true, allowEmpty: false })
      : defaultBackupDir();
    const retention = Number(opts.retentionCount) || 20;
    return backupV2.pruneLocalBackups(dir, retention);
  });

  handle('backup:v2:formatPolicy', async () => backupV2.backupFormatPolicy());

  handle('backup:v2:verify', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const filePath = V.asString(opts.filePath, { name: 'filePath', required: true, allowEmpty: false });
    const password = optionalBackupPassword(opts);
    return backupV2.verifyBackupFile(filePath, password, opts);
  });

  handle('backup:v2:inspect', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const filePath = V.asString(opts.filePath, { name: 'filePath', required: true, allowEmpty: false });
    const password = optionalBackupPassword(opts);
    const buf = fs.readFileSync(filePath);
    const inspected = backupV2.inspectBackupBuffer(buf, password, opts);
    return {
      ok: true,
      manifest: inspected.manifest,
      scope: backupV2ScopeTruth.extractScopeSummaryFromManifest(inspected.manifest),
      database: inspected.database,
      encrypted: inspected.encrypted,
      packageSha256: inspected.packageSha256,
      encryptedSha256: inspected.encryptedSha256,
      encryptedSize: inspected.encryptedSize,
      size: inspected.size,
    };
  });

  handle('backup:v2:restore', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const filePath = V.asString(opts.filePath, { name: 'filePath', required: true, allowEmpty: false });
    return runRestore(filePath, opts);
  });

  handle('backup:v2:listLocal', async (_e, options) => {
    const opts = V.asObject(options || {}, { name: 'options' });
    const dir = opts.dir
      ? V.asString(opts.dir, { name: 'dir', required: true, allowEmpty: false })
      : defaultBackupDir();
    return { ok: true, dir, files: backupV2.listLocalBackupFiles(dir) };
  });

  handle('backup:v2:listCloud', async (_e, options) => {
    const opts = V.asObject(options || {}, { name: 'options' });
    const prefix = opts.prefix
      ? V.asString(opts.prefix, { name: 'prefix', required: true, allowEmpty: false })
      : backupV2Cloud.CLOUD_V2_PREFIX;
    return backupV2Cloud.listCloudV2Backups(
      (provider, p) => backupMain.listCloudBackups(provider, p || prefix),
      prefix
    );
  });

  handle('backup:v2:pruneCloud', async (_e, options) => {
    const opts = V.asObject(options || {}, { name: 'options' });
    return pruneCloudAfterUpload(
      { remotePath: opts.keepRemotePath || opts.remotePath || null },
      opts
    );
  });

  handle('backup:v2:pickLatest', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const identity = resolveIdentity(opts);
    const candidates = await collectRestoreCandidates(opts);
    const picked = backupV2.pickLatestAuthorizedBackup(
      candidates,
      null,
      identity,
      opts
    );
    if (!picked.ok) {
      const err = new Error('no_authorized_backup');
      err.code = 'no_authorized_backup';
      err.details = picked;
      throw err;
    }
    return picked;
  });

  handle('backup:v2:restoreLatest', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const identity = resolveIdentity(opts);
    const candidates = await collectRestoreCandidates(opts);
    const picked = backupV2.pickLatestAuthorizedBackup(candidates, null, identity, opts);
    if (!picked.ok || !picked.selected?.filePath) {
      const err = new Error('no_authorized_backup');
      err.code = 'no_authorized_backup';
      throw err;
    }
    return runRestore(picked.selected.filePath, { ...opts, selected: picked.selected });
  });

  handle('backup:v2:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'اختر نسخة Backup V2',
      filters: [{ name: 'Tadawi Backup V2', extensions: ['tdw'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths?.length) return { ok: false, canceled: true };
    return { ok: true, filePath: result.filePaths[0] };
  });

  handle('backup:v2:importLegacy', async (_e, options) => {
    const legacyImport = require('./backup-v2-legacy-import');
    const opts = V.asObject(options, { name: 'options', required: true });
    const filePath = V.asString(opts.filePath, { name: 'filePath', required: true, allowEmpty: false });
    const password = V.asString(opts.password, { name: 'password', required: true, allowEmpty: false, max: 256 });
    if (password.length < 8) {
      const err = new Error('password_too_short');
      err.code = 'password_too_short';
      throw err;
    }
    return legacyImport.importLegacyEncryptedBackup({
      ...opts,
      filePath,
      password,
      userDataDir: getUserDataPath(),
    });
  });

  handle('backup:v2:gate', async () => backupV2.readRestoreGate(getUserDataPath()));

  handle('backup:v2:stageRemote', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const sourcePath = V.asString(opts.sourcePath, { name: 'sourcePath', required: true, allowEmpty: false });
    const password = optionalBackupPassword(opts);
    const stageDir = path.join(getUserDataPath(), 'Backups', 'V2', 'staging');
    fs.mkdirSync(stageDir, { recursive: true });
    const destPath = path.join(stageDir, path.basename(sourcePath).replace(/[^\w.\-]+/g, '_'));
    const progress = [];
    const staged = copyWithResume(sourcePath, destPath, {
      resume: opts.resume !== false,
      failAfterBytes: opts.failAfterBytes,
      onProgress: (evt) => progress.push(evt),
    });
    if (password) {
      backupV2.verifyBackupFile(staged.path, password, opts);
    }
    return { ...staged, progress };
  });

  handle('backup:v2:downloadAndRestore', async (_e, options) => {
    const opts = V.asObject(options, { name: 'options', required: true });
    const sourcePath = V.asString(opts.sourcePath, { name: 'sourcePath', required: true, allowEmpty: false });
    const stageDir = path.join(getUserDataPath(), 'Backups', 'V2', 'staging');
    fs.mkdirSync(stageDir, { recursive: true });
    const destPath = path.join(stageDir, path.basename(sourcePath).replace(/[^\w.\-]+/g, '_'));
    const progress = [];
    const staged = copyWithResume(sourcePath, destPath, {
      resume: opts.resume !== false,
      onProgress: (evt) => progress.push(evt),
    });
    const restored = await runRestore(staged.path, opts);
    return { ...restored, staged, downloadProgress: progress };
  });

  handle('backup:v2:scheduleStatus', async () => {
    if (!scheduler) return { ok: false, enabled: false, error: 'scheduler_not_started' };
    return { ok: true, ...scheduler.status() };
  });

  handle('backup:v2:scheduleConfigure', async (_e, options) => {
    if (!scheduler) {
      const err = new Error('scheduler_not_started');
      err.code = 'scheduler_not_started';
      throw err;
    }
    const opts = V.asObject(options || {}, { name: 'options' });
    return { ok: true, ...scheduler.configure(opts) };
  });

  // Start scheduler (idempotent)
  try {
    const userDataDir = getUserDataPath();
    const vault = createFileCredentialVault(userDataDir);
    scheduler = new BackupV2Scheduler({
      userDataDir,
      credentialVault: vault,
      runBackup: async (meta = {}) => {
        const identity = resolveIdentity(meta);
        const { scopeTruth, requestedScope } = resolveScopeForCreate(
          { ...meta, scopeType: meta.scopeType || SCOPE_BRANCH_DEFAULT },
          identity
        );
        const outDir = meta.localPath && String(meta.localPath).trim()
          ? String(meta.localPath).trim()
          : defaultBackupDir();
        fs.mkdirSync(outDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(outDir, `Tadawi-Backup-V2-scheduled-${stamp}.tdw`);
        const retentionCount = Number(meta.retentionCount) || 20;
        const cloudRetention = cloudRetentionCount(meta);
        const createOpts = {
          userDataDir,
          outputPath: filePath,
          appVersion: appVersion || '2.0.0',
          backupType: 'scheduled',
          centerId: identity.centerId,
          organizationId: identity.organizationId,
          branchId: identity.branchId,
          branchIds: scopeTruth.includedBranchIds,
          includedBranchIds: scopeTruth.includedBranchIds,
          deviceId: identity.deviceId,
          centerName: identity.centerName || meta.centerName,
          deviceName: identity.deviceName || meta.deviceName,
          scopeType: requestedScope,
          scopeTruth,
          retentionCount,
          cloudRetentionCount: cloudRetention,
        };
        if (meta.cloudEnabled === true) {
          return backupV2.createBackupWithUpload({
            ...createOpts,
            upload: async ({ buffer, filename, hash, manifest }) => {
              const remotePath = `${backupV2Cloud.CLOUD_V2_PREFIX}/${filename}`;
              const uploaded = await backupMain.uploadCloud(buffer, filename, 'google', {
                remotePath,
                overwrite: false,
                sha256: hash,
                manifest,
              });
              if (!uploaded?.ok) {
                const err = new Error(uploaded?.message || 'cloud_upload_failed');
                err.code = /quota|storageExceeded/i.test(String(uploaded?.message || ''))
                  ? 'quota_exceeded'
                  : 'cloud_upload_failed';
                throw err;
              }
              return {
                ok: true,
                remotePath: uploaded.path || remotePath,
                id: uploaded.id || null,
                expectedHash: hash,
                remoteHash: uploaded.md5 || hash,
              };
            },
            pruneAfterUpload: async (upload) => {
              const localPruned = backupV2.pruneLocalBackups(outDir, retentionCount, { keepPath: filePath }).pruned;
              const cloudPruned = await pruneCloudAfterUpload(upload, createOpts);
              return Number(localPruned || 0) + Number(cloudPruned?.pruned || 0);
            },
          });
        }
        const created = await backupV2.createBackupFile(createOpts);
        const pruned = backupV2.pruneLocalBackups(outDir, retentionCount, { keepPath: created.path });
        return { ...created, localOk: true, cloudOk: false, cloudSkipped: true, pruned: pruned.pruned };
      },
    });
    scheduler.start();
  } catch (error) {
    console.error('[backup-v2] scheduler start failed:', error.message);
    scheduler = null;
  }

  return { enabled: true, scheduler };
}

module.exports = {
  isBackupV2Enabled,
  registerBackupV2Ipc,
  backupV2,
  backupV2ScopeTruth,
  asIdentity,
  createFileCredentialVault,
};
