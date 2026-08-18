'use strict';

/**
 * Migration-only: import legacy encrypted Backup V2 (.tdw with CDB2/CDBK envelope).
 * Not used on the direct restore customer path.
 */
const backupV2 = require('./backup-v2-core');

async function importLegacyEncryptedBackup(options) {
  if (!options?.filePath) return { ok: false, error: 'file_path_required' };
  const password = String(options.password || '');
  if (password.length < 8) return { ok: false, error: 'password_too_short' };
  const fs = require('fs');
  const buf = fs.readFileSync(options.filePath);
  if (!backupV2.isEncryptedBackupBuffer(buf)) {
    return { ok: false, error: 'not_legacy_encrypted_backup' };
  }
  try {
    const inspected = backupV2.inspectBackupBuffer(buf, password, options);
    return {
      ok: true,
      legacy: true,
      manifest: inspected.manifest,
      database: inspected.database,
      packageSha256: inspected.packageSha256,
    };
  } catch (error) {
    return { ok: false, error: error.code || error.message || 'legacy_import_failed' };
  }
}

module.exports = { importLegacyEncryptedBackup };
