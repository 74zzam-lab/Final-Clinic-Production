/**
 * RC Hotfix Round 2 — post-restore verification before wizard marks restore complete.
 */
(function (global) {
  'use strict';

  async function verifyDatabaseIntegrity() {
    try {
      const api = global.cuppingElectron?.database || global.tadawiElectron?.database || global.tadawi?.database;
      if (api?.status) {
        const st = await api.status();
        const ic = st?.integrity || st?.operationalHealth?.integrity;
        if (ic && ic !== 'ok' && ic.ok === false) {
          return { ok: false, error: 'integrity_check_failed', detail: ic };
        }
        return { ok: true, status: st };
      }
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    return { ok: true, skipped: true };
  }

  function countRecords(key) {
    try {
      const v = global.DB?.get?.(key, []);
      return Array.isArray(v) ? v.length : 0;
    } catch {
      return 0;
    }
  }

  async function rehydrateOperationalCaches() {
    if (global.SqliteBridge?.rehydrateBranchView) {
      await global.SqliteBridge.rehydrateBranchView();
    }
    if (global.AuthCredentialTruth?.syncUsersFromAuthoritativeStore) {
      global.AuthCredentialTruth.syncUsersFromAuthoritativeStore();
    }
    try {
      if (typeof global.reloadClientStoreFromDb === 'function') global.reloadClientStoreFromDb();
      if (typeof global.syncAppGlobals === 'function') global.syncAppGlobals();
    } catch { /* empty */ }
  }

  /**
   * Verify restore actually landed before wizard advances.
   */
  async function verifyPostRestore(options = {}) {
    options = options || {};
    try { await global.reconcileAuthUsersAfterHydrate?.(); } catch { /* empty */ }
    await rehydrateOperationalCaches();

    const integrity = await verifyDatabaseIntegrity();
    if (!integrity.ok) {
      return { ok: false, verified: false, error: integrity.error, integrity };
    }

    const users = global.AuthCredentialTruth?.readAuthoritativeUsers?.()
      || global.DB?.get?.('users', []) || [];
    const owner = users.find((u) => u && String(u.role || '').toLowerCase() === 'owner' && u.active !== false);
    const centerId = global.DeviceConfig?.load?.()?.centerId
      || global.LicenseCloud?.loadLocal?.()?.centerId
      || global.settings?.centerId
      || null;
    const licenseDoc = typeof global.licLoad === 'function' ? global.licLoad() : null;

    const counts = {
      clients: countRecords('clientsRegistry'),
      visits: countRecords('cases'),
      bookings: countRecords('bookings'),
      branches: (global.LicenseCloud?.loadLocal?.()?.branches || []).length,
    };

    const kind = options.kind || options.restoreKind || null;
    const isCloudHydrate = kind === 'cloud_hydrate' || options.source === 'bootflow_cloud_restore';

    const summary = {
      centerId,
      branchId: global.DeviceConfig?.load?.()?.lockedBranchId || null,
      ownerUsername: owner?.username || null,
      ownerPresent: !!owner,
      counts,
      restoreKind: kind,
      backupPoint: options.point?.path || options.point?.name || null,
      cloudHydrate: isCloudHydrate,
    };

    const requireOwner = options.requireOwner !== false && !isCloudHydrate;
    const requireData = options.requireData === true;
    if (requireOwner && !owner) {
      return { ok: false, verified: false, error: 'restore_owner_missing', summary };
    }
    if (isCloudHydrate && !owner) {
      const hasIdentity = !!(centerId || licenseDoc?.centerId || licenseDoc?.licenseId);
      const hasAnyData = counts.clients > 0 || counts.visits > 0 || counts.bookings > 0;
      if (!hasIdentity && !hasAnyData) {
        return { ok: false, verified: false, error: 'restore_cloud_identity_missing', summary };
      }
      summary.ownerPresent = false;
      summary.ownerDeferred = true;
    }
    if (requireData && counts.clients === 0 && counts.visits === 0 && counts.bookings === 0) {
      return { ok: false, verified: false, error: 'restore_data_empty', summary };
    }

    try {
      global.OwnerLifecycleAuthority?.reconcileAfterRestore?.({
        gateId: options.gateId || null,
        source: options.source || 'bootflow_restore_verify',
      });
    } catch { /* empty */ }

    return { ok: true, verified: true, summary, integrity };
  }

  function formatSummaryHtml(summary) {
    if (!summary) return '';
    const c = summary.counts || {};
    const ownerLine = summary.ownerDeferred
      ? 'Owner: سيُؤكَّد بعد المزامنة الكاملة'
      : `Owner: ${summary.ownerUsername || '—'}`;
    return `<div class="bf-restore-verify" dir="rtl">
      <strong>تمت الاستعادة والتحقق من البيانات ✓</strong><br>
      Center: <code dir="ltr">${summary.centerId || '—'}</code><br>
      ${ownerLine}<br>
      العملاء: ${c.clients ?? '—'} · الجلسات: ${c.visits ?? '—'} · الحجوزات: ${c.bookings ?? '—'} · الفروع: ${c.branches ?? '—'}
    </div>`;
  }

  global.RestoreVerification = {
    verifyPostRestore,
    formatSummaryHtml,
    rehydrateOperationalCaches,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.RestoreVerification;
  }
})(typeof window !== 'undefined' ? window : globalThis);
