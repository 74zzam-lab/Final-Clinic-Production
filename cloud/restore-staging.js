/**
 * Restore Staging — backup restore via temp staging + comparison + merge (no direct overwrite).
 */
(function (global) {
  'use strict';

  const STAGING_KEY = '__tdw_restore_staging__';

  const SYNCED_MAP = {
    cases: 'cases',
    clientsRegistry: 'clientsRegistry',
    bookings: 'bookings',
    users: 'users',
    doctors: 'doctors',
    settings: 'settings',
    expenses: 'expenses',
    packages: 'packages',
    services: 'services',
    attendance: 'attendance',
    inventoryItems: 'inventoryItems',
    inventorySuppliers: 'inventorySuppliers',
    inventoryMovements: 'inventoryMovements',
    attachments_meta: 'attachments_meta'
  };

  const MIGRATION_DENY_TOP_KEYS = new Set([
    'license',
    '__tdw_wizard__',
    '__tdw_boot_done__',
    '__tdw_setup_state__',
    'deviceConfig',
    'oauth',
    'wizard',
  ]);

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function normalizeSettingsRow(settings) {
    if (Array.isArray(settings)) return settings[0] && typeof settings[0] === 'object' ? { ...settings[0] } : {};
    return settings && typeof settings === 'object' ? { ...settings } : {};
  }

  /** Strip identity / OAuth / setup keys from JSON migration imports. */
  function sanitizeMigrationImport(data, meta) {
    if (!data || typeof data !== 'object') return data;
    if (!meta || meta.migrationOnly !== true) return data;
    const clean = cloneJson(data);
    MIGRATION_DENY_TOP_KEYS.forEach((key) => { delete clean[key]; });

    const settings = normalizeSettingsRow(clean.settings);
    if (settings && typeof settings === 'object') {
      delete settings.centerId;
      delete settings.licenseId;
      delete settings.deviceId;
      delete settings.wizard;
      delete settings.bootComplete;
      delete settings.__tdw_wizard__;
      if (settings.backup && typeof settings.backup === 'object') {
        const backup = { ...settings.backup };
        if (backup.providers && typeof backup.providers === 'object') {
          const providers = { ...backup.providers };
          delete providers.google;
          delete providers.oauth;
          backup.providers = providers;
        }
        settings.backup = backup;
      }
      if (Array.isArray(clean.settings)) clean.settings = [settings];
      else clean.settings = settings;
    }

    if (Array.isArray(clean.users)) {
      clean.users = clean.users.map((u) => {
        if (!u || typeof u !== 'object') return u;
        const row = { ...u };
        delete row.password;
        delete row.passwordPlain;
        return row;
      });
    }

    return clean;
  }

  function stageBackup(data, meta) {
    meta = meta || {};
    const payload = sanitizeMigrationImport(data, meta);
    const staged = {
      stagedAt: new Date().toISOString(),
      source: meta.source || 'backup',
      fileName: meta.fileName || '',
      data: payload || {},
      tables: {}
    };
    Object.keys(SYNCED_MAP).forEach(key => {
      if (payload[key] != null) {
        const rows = Array.isArray(payload[key]) ? payload[key] : (key === 'settings' ? [payload[key]] : []);
        staged.tables[key] = rows;
      }
    });
    global.DB?.set?.(STAGING_KEY, staged);
    return staged;
  }

  function loadStaging() {
    return global.DB?.get?.(STAGING_KEY, null);
  }

  function clearStaging() {
    global.DB?.set?.(STAGING_KEY, null);
  }

  function compareWithLocal(staged, branchId) {
    branchId = branchId || global.BranchScope?.getActiveBranchId?.() || 'BR-MAIN';
    const perTable = {};
    let hasConflict = false;
    let canSafeMerge = true;

    Object.keys(staged.tables || {}).forEach(table => {
      const remote = staged.tables[table];
      const local = global.DataStateAnalyzer?.getLocalRecords?.(table, branchId)
        || global.Repository?.get?.(table) || [];
      const localRows = Array.isArray(local) ? local : (table === 'settings' ? [local] : []);
      const merge = global.RecordMerger?.mergeRecords?.(localRows, remote, {
        table,
        branchId,
        enqueueConflicts: false,
        preserveOtherBranches: true
      }) || { hasConflict: false, safeAutoMerge: true, stats: {} };

      perTable[table] = {
        localCount: localRows.length,
        stagedCount: remote.length,
        hasConflict: merge.hasConflict,
        safeAutoMerge: merge.safeAutoMerge,
        stats: merge.stats,
        mergePreview: merge.merged
      };
      if (merge.hasConflict) { hasConflict = true; canSafeMerge = false; }
    });

    return { ok: true, perTable, hasConflict, canSafeMerge, branchId };
  }

  async function applyStagedMerge(options) {
    options = options || {};
    const staged = loadStaging();
    if (!staged) return { ok: false, error: 'no_staging' };

    if (options.manual && global.RestoreSurfaceAuthority) {
      const gate = global.RestoreSurfaceAuthority.assertMigrationMergeAllowed(
        { source: staged.source, migrationOnly: options.migrationOnly },
        options
      );
      if (!gate.ok) return gate;
    }

    const branchId = options.branchId || global.BranchScope?.getActiveBranchId?.() || 'BR-MAIN';
    const comparison = compareWithLocal(staged, branchId);

    if (comparison.hasConflict && !options.force && !global.RolePolicy?.isManager?.()) {
      return { ok: false, error: 'conflict_manager_required', comparison };
    }

    const bridge = global.SqliteBridge;
    const useBundle = bridge?.isPrimary?.() && bridge?.beginBundle && !bridge?.isBundleActive?.();
    if (useBundle) bridge.beginBundle();

    const results = [];
    Object.keys(staged.tables || {}).forEach(table => {
      const t = comparison.perTable[table];
      if (!t) return;
      if (t.hasConflict && !options.force) {
        results.push({ table, ok: false, skipped: true, reason: 'conflict' });
        return;
      }
      const applied = global.RecordMerger?.applyMergeToRepository?.(table, { merged: t.mergePreview }, {
        source: options.manual ? 'manual' : 'safe_auto',
        branchId
      });
      results.push({ table, ok: !!applied?.ok });
    });

    if (useBundle) {
      const bundleRes = await bridge.commitBundle();
      if (!bundleRes?.ok && !bundleRes?.skipped) {
        return {
          ok: false,
          error: bundleRes?.error || 'restore_bundle_failed',
          results,
          comparison,
          atomic: true,
        };
      }
    }

    global.AuditLogger?.logSyncEvent?.('MANUAL_RESTORE', {
      summary: `استعادة من نسخة احتياطية — ${results.filter(r => r.ok).length} جدول`,
      source: staged.source,
      fileName: staged.fileName
    });

    if (!options.keepStaging) clearStaging();
    return { ok: true, results, comparison, atomic: !!useBundle };
  }

  async function stageAndPrompt(backupData, meta) {
    const staged = stageBackup(backupData, meta);
    const comparison = compareWithLocal(staged);

    global.AuditLogger?.logSyncEvent?.('MANUAL_RESTORE', {
      summary: 'تم تحميل نسخة احتياطية للمراجعة قبل الاستعادة',
      source: meta?.source || 'backup'
    });

    if (comparison.hasConflict) {
      if (global.RolePolicy?.isManager?.()) {
        global.notify?.('⚠️ النسخة الاحتياطية تحتوي على بيانات متعارضة — راجع قبل الاستعادة', 'warning');
        global.DataStateUI?.open?.({
          ok: true,
          state: 'conflict',
          blocked: true,
          requiresUserDecision: true,
          branchId: comparison.branchId
        });
      } else {
        global.notify?.('⛔ لا يمكن الاستعادة — تواصل مع المدير', 'danger');
        return { ok: false, error: 'manager_required', comparison };
      }
    }

    return { ok: true, staged, comparison, needsReview: comparison.hasConflict || !comparison.canSafeMerge };
  }

  global.RestoreStaging = {
    STAGING_KEY,
    SYNCED_MAP,
    MIGRATION_DENY_TOP_KEYS,
    sanitizeMigrationImport,
    stageBackup,
    loadStaging,
    clearStaging,
    compareWithLocal,
    applyStagedMerge,
    stageAndPrompt
  };
})(typeof window !== 'undefined' ? window : globalThis);
