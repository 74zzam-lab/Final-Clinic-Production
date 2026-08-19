/**
 * Operational readiness — unified save/sync gate from DB health + migration state.
 */
(function (global) {
  'use strict';

  const BLOCKER_MESSAGES_AR = {
    database_unhealthy: 'قاعدة البيانات غير صالحة',
    integrity_check_failed: 'فشل فحص سلامة قاعدة البيانات',
    foreign_key_violation: 'انتهاك قيود الارتباط',
    schema_version_mismatch: 'إصدار مخطط غير متوقع',
    legacy_branch_migration_required: 'يلزم إكمال ترحيل الفروع',
    sqlite_primary_required: 'SQLite غير جاهز كمصدر معتمد',
    operational_not_ready: 'التشغيل غير جاهز',
  };

  let cached = null;
  let cachedAt = 0;
  const CACHE_MS = 10000;

  function buildBlockerMessageAr(blockers) {
    const labels = (blockers || []).map((b) => BLOCKER_MESSAGES_AR[b] || b);
    return labels.length ? `التشغيل غير جاهز — ${labels.join('؛ ')}` : 'التشغيل غير جاهز';
  }

  function assessFromParts(parts) {
    parts = parts || {};
    const blockers = [];
    const health = parts.health || parts.operationalHealth;
    if (health && health.ok === false) {
      for (const reason of health.reasons || []) blockers.push(reason);
      if (!health.reasons?.length) blockers.push('database_unhealthy');
    }
    if (parts.legacyBranchMigrationBlocked) {
      blockers.push('legacy_branch_migration_required');
    }
    if (parts.sqlitePrimaryRequired && !parts.sqlitePrimary) {
      blockers.push('sqlite_primary_required');
    }
    const uniqueBlockers = [...new Set(blockers)];
    const ok = uniqueBlockers.length === 0;
    return {
      ok,
      operational: ok,
      canWrite: ok,
      blockers: uniqueBlockers,
      messageAr: ok
        ? 'التشغيل جاهز — قاعدة البيانات والمتطلبات الأساسية سليمة'
        : (health?.messageAr && !ok ? health.messageAr : buildBlockerMessageAr(uniqueBlockers)),
      health: health || null,
      sqlitePrimary: parts.sqlitePrimary,
      legacyBranchMigrationBlocked: !!parts.legacyBranchMigrationBlocked,
      assessedAt: new Date().toISOString(),
    };
  }

  async function refresh(options) {
    options = options || {};
    await global.OperationalDbHealth?.ensureFresh?.({ force: options.force });
    const healthAllow = global.OperationalDbHealth?.isOperationalAllowed?.();
    const status = await global.SqliteBridge?.status?.() || {};
    const legacyBlocked = !!(global.LegacyBranchMigration?.isPushBlocked?.()
      || (global.LegacyBranchMigration?.needsMigration?.() && !global.LegacyBranchMigration?.isMigrationComplete?.()));
    const readiness = assessFromParts({
      health: status.operationalHealth || healthAllow?.health,
      legacyBranchMigrationBlocked: legacyBlocked,
      sqlitePrimary: status.sqlitePrimary,
      sqlitePrimaryRequired: !!global.SqliteBridge?.isPrimary,
    });
    cached = readiness;
    cachedAt = Date.now();
    return readiness;
  }

  function getCached(options) {
    options = options || {};
    if (!options.force && cached && Date.now() - cachedAt < CACHE_MS) return cached;
    return cached;
  }

  async function ensureFresh(options) {
    return refresh(options);
  }

  function canWrite(options) {
    options = options || {};
    const readiness = options.force ? null : getCached();
    if (!readiness) return { ok: true, unknown: true };
    if (readiness.ok) return { ok: true, readiness };
    return {
      ok: false,
      error: readiness.blockers[0] || 'operational_not_ready',
      blocked: true,
      readiness,
      messageAr: readiness.messageAr,
    };
  }

  function canSync() {
    const write = canWrite();
    if (!write.ok) return write;
    const syncReady = global.SyncEngine?.getReadiness?.();
    if (syncReady && !syncReady.ready) {
      return {
        ok: false,
        error: (syncReady.missing && syncReady.missing[0]) || 'sync_not_ready',
        blocked: true,
        syncReadiness: syncReady,
        messageAr: syncReady.messageAr,
      };
    }
    return { ok: true, readiness: write.readiness, syncReadiness: syncReady };
  }

  global.OperationalReadiness = {
    assessFromParts,
    refresh,
    getCached,
    ensureFresh,
    canWrite,
    canSync,
  };
})(typeof window !== 'undefined' ? window : globalThis);
