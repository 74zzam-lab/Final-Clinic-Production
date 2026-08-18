/**
 * Renderer SQLite bridge — authoritative operational SoT (Phase 1).
 *
 * Read path (Electron):
 *   DB.get operational key → memory lastCommitted / SQLite hydrate — NOT localStorage
 * Write path:
 *   UI → SQLite transaction (+ outbox) → success → LS cache mirror + memory
 */
(function (global) {
  'use strict';

  const CORE_TABLES = ['clientsRegistry', 'cases', 'bookings', 'doctors', 'attendance', 'expenses'];
  const KV_MIRROR = [
    'users', 'settings', 'packages', 'services', 'otRecords', 'budget', 'invoiceCounter',
    'clientFileCounter', 'nextSessions', 'employeeLeaveRequests', 'employeeLedgerAccruals',
    'employeeLedgerPayments', 'employeeLedgerEntries', 'importHistory',
    'inventoryItems', 'inventorySuppliers', 'inventoryMovements',
    '__tdw_conflict_queue__',
    '__tdw_conflict_archive__',
    '__tdw_attachment_manifest__',
    'activityLog',
    'messageLog',
    'backupLog',
  ];
  const OPERATIONAL_KEYS = new Set(CORE_TABLES.concat(KV_MIRROR));
  const UI_ONLY_KEYS = new Set([
    '__tdw_ui_theme__', '__tdw_ui_lang__', '__tdw_last_tab__', '__tdw_wizard_ui__',
    'tdw_sidebar_collapsed',
  ]);

  const state = {
    ready: false,
    bootPromise: null,
    sqlitePrimary: false,
    lastError: null,
    status: null,
    lastCommitted: {},
    pendingKeys: new Set(),
    bundleActive: false,
    bundleOps: [],
  };

  function api() {
    return global.cuppingElectron?.database || global.tadawi?.database || null;
  }

  function isOperationalKey(key) {
    return OPERATIONAL_KEYS.has(key) || CORE_TABLES.includes(key);
  }

  function defaultForKey(key) {
    if (key.endsWith('Counter')) return 0;
    if (key === 'settings') return {};
    return [];
  }

  function readFromLocalStorageOnly(k, def) {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch {
      return def;
    }
  }

  /**
   * Authoritative read for operational keys.
   * Returns undefined → caller may fall back to localStorage (browser-only / pre-bridge).
   */
  function readOperational(key, def) {
    if (UI_ONLY_KEYS.has(key)) return undefined;
    if (!isOperationalKey(key)) return undefined;

    if (Object.prototype.hasOwnProperty.call(state.lastCommitted, key)) {
      return state.lastCommitted[key];
    }

    const db = api();
    if (db) {
      if (state.ready) return def !== undefined ? def : defaultForKey(key);
      return def !== undefined ? def : defaultForKey(key);
    }

    return undefined;
  }

  function rawSet(k, v) {
    if (typeof DB !== 'undefined' && DB.__rawSet) return DB.__rawSet(k, v);
    if (typeof DB !== 'undefined' && DB.set && !DB.__sqliteWriteThrough) return DB.set(k, v);
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* empty */ }
  }

  function syncMemory(tableKey, value) {
    if (tableKey === 'clientsRegistry') global.clientsRegistry = value;
    else if (tableKey === 'cases') global.cases = value;
    else if (tableKey === 'bookings') global.bookings = value;
    else if (tableKey === 'doctors') global.doctors = value;
    else if (tableKey === 'attendance') global.attendance = value;
    else if (tableKey === 'expenses') global.expenses = value;
    else if (tableKey === 'users') global.users = value;
    else if (tableKey === 'services') global.services = value;
    else if (tableKey === 'packages') global.packages = value;
    else if (tableKey === 'settings' && value && !Array.isArray(value)) global.settings = value;
    else if (tableKey === 'inventoryItems') global.inventoryItems = value;
    else if (tableKey === 'inventorySuppliers') global.inventorySuppliers = value;
    else if (tableKey === 'inventoryMovements') global.inventoryMovements = value;
    else if (tableKey === 'activityLog') global.activityLog = value;
    else if (tableKey === 'messageLog') global.messageLog = value;
    else if (tableKey === 'backupLog') global.backupLog = value;
    else if (tableKey === 'cashDrawerSession') global.cashDrawerSession = value;
  }

  function isBundledOperationalKey(key) {
    return CORE_TABLES.includes(key) || OPERATIONAL_KEYS.has(key) || KV_MIRROR.includes(key);
  }

  function beginBundle() {
    state.bundleActive = true;
    state.bundleOps = [];
    return { ok: true };
  }

  function queueBundleOp(key, value) {
    const kind = CORE_TABLES.includes(key) ? 'table' : 'kv';
    const op = {
      key,
      kind,
      records: kind === 'table' ? (Array.isArray(value) ? value : []) : undefined,
      value: kind === 'kv' ? value : undefined,
    };
    const idx = state.bundleOps.findIndex((o) => o.key === key);
    if (idx >= 0) state.bundleOps[idx] = op;
    else state.bundleOps.push(op);
  }

  function buildOutboxEntryForKv(key, value) {
    const centerId =
      global.ConfigLayer?.getCenterId?.() ||
      global.CenterId?.getStoredCenterId?.() ||
      global.LicenseCloud?.loadLocal?.()?.centerId ||
      '';
    if (!centerId) return null;
    const branchId =
      global.BranchContexts?.getOperationalWriteBranch?.() ||
      global.BranchScope?.getActiveBranchId?.() ||
      'BR-MAIN';
    const deviceId =
      global.DeviceConfig?.getDeviceId?.() ||
      global.DeviceConfig?.load?.()?.deviceUuid ||
      'unknown-device';
    return {
      center_id: centerId,
      branch_id: branchId,
      table_name: key,
      operation: 'TABLE_BUMP',
      base_revision: 0,
      new_revision: Date.now(),
      device_id: deviceId,
      payload_json: JSON.stringify(value ?? null),
    };
  }

  function buildBundlePayloadFromOps(ops) {
    const steps = ops.map((op) => {
      if (op.kind === 'table') {
        return { type: 'table', tableKey: op.key, records: op.records || [] };
      }
      return { type: 'kv', key: op.key, value: op.value };
    });
    const entries = [];
    for (const op of ops) {
      if (op.kind === 'table') {
        const entry = buildOutboxEntry(op.key, op.records);
        if (entry) entries.push(entry);
      } else if (KV_MIRROR.includes(op.key) || OPERATIONAL_KEYS.has(op.key)) {
        const entry = buildOutboxEntryForKv(op.key, op.value);
        if (entry) entries.push(entry);
      }
    }
    return { steps, entries };
  }

  async function commitBundle() {
    const ops = state.bundleOps.slice();
    state.bundleActive = false;
    state.bundleOps = [];
    if (!ops.length) return { ok: true, skipped: true, reason: 'bundle_empty' };

    const db = api();
    if (!db) {
      for (const op of ops) restoreLastCommit(op.key);
      return { ok: false, error: 'database_api_unavailable' };
    }
    if (!state.sqlitePrimary) {
      const en = await ensureSqlitePrimaryEnabled();
      if (!en.ok) {
        for (const op of ops) restoreLastCommit(op.key);
        return { ok: false, error: en.error || 'sqlite_primary_required' };
      }
    }
    if (global.LegacyBranchMigration?.isPushBlocked?.()) {
      for (const op of ops) restoreLastCommit(op.key);
      return { ok: false, error: 'legacy_branch_migration_required' };
    }

    const { steps, entries } = buildBundlePayloadFromOps(ops);
    const keys = ops.map((o) => o.key);
    keys.forEach((k) => state.pendingKeys.add(k));

    try {
      let res;
      if (entries.length && db.syncOp) {
        res = await db.syncOp({ op: 'enqueueAtomicBundle', steps, entries });
      } else if (db.syncOp) {
        res = await db.syncOp({ op: 'persistBundle', steps });
      } else {
        res = { ok: false, error: 'sync_op_unavailable' };
      }
      if (!res?.ok) {
        state.lastError = res?.error || 'bundle_commit_failed';
        for (const k of keys) restoreLastCommit(k);
        return { ok: false, error: state.lastError, res };
      }
      for (const op of ops) {
        const val = op.kind === 'table' ? op.records : op.value;
        rememberCommit(op.key, val);
        rawSet(op.key, val);
        syncMemory(op.key, val);
      }
      state.lastError = null;
      return { ok: true, count: ops.length, bundle: true, outbox: entries.length };
    } catch (e) {
      state.lastError = String(e?.message || e);
      for (const k of keys) restoreLastCommit(k);
      return { ok: false, error: state.lastError };
    } finally {
      keys.forEach((k) => state.pendingKeys.delete(k));
    }
  }

  function isBundleActive() {
    return !!state.bundleActive;
  }

  function rememberCommit(key, value) {
    try {
      state.lastCommitted[key] = typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
    } catch {
      state.lastCommitted[key] = value;
    }
  }

  function restoreLastCommit(key) {
    if (!Object.prototype.hasOwnProperty.call(state.lastCommitted, key)) return false;
    const prev = state.lastCommitted[key];
    rawSet(key, prev);
    syncMemory(key, prev);
    return true;
  }

  /** Migration-only: LS snapshot when SQLite not yet primary. */
  function collectSnapshotFromLocal() {
    const snap = {};
    const read = (k, def) => {
      if (api() && state.ready && Object.prototype.hasOwnProperty.call(state.lastCommitted, k)) {
        return state.lastCommitted[k];
      }
      return readFromLocalStorageOnly(k, def);
    };
    snap.clientsRegistry = read('clientsRegistry', []);
    snap.cases = read('cases', []);
    snap.bookings = read('bookings', []);
    snap.doctors = read('doctors', []);
    snap.attendance = read('attendance', []);
    snap.expenses = read('expenses', []);
    for (const k of KV_MIRROR) {
      snap[k] = read(k, k.endsWith('Counter') ? 0 : (k === 'settings' ? {} : []));
    }
    if (typeof buildFullBackupObject === 'function') {
      try {
        const full = buildFullBackupObject();
        return { ...snap, ...full };
      } catch { /* use snap */ }
    }
    return snap;
  }

  async function migrateAndEnable(options) {
    const db = api();
    if (!db) return { ok: false, error: 'database_api_unavailable' };
    const snapshot = options?.snapshot || collectSnapshotFromLocal();
    const report = await db.migrateFromBackup(snapshot, {
      sourceLabel: options?.sourceLabel || 'localStorage',
      dryRun: !!options?.dryRun,
    });
    if (!report?.ok) return report;
    if (options?.dryRun) return report;
    try { await db.enableSqlitePrimary?.(); } catch { /* empty */ }
    return hydrateIntoMemory();
  }

  async function ensureSqlitePrimaryEnabled() {
    const db = api();
    if (!db) return { ok: false, error: 'database_api_unavailable' };
    if (state.sqlitePrimary) return { ok: true, already: true };
    try {
      const st = await db.enableSqlitePrimary?.();
      state.status = st || (await db.status?.());
      state.sqlitePrimary = !!(state.status && state.status.sqlitePrimary);
      if (state.sqlitePrimary) installWriteThrough();
      return { ok: !!state.sqlitePrimary, status: state.status };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async function hydrateIntoMemory() {
    const db = api();
    if (!db) return { ok: false, error: 'database_api_unavailable' };
    const res = await db.hydrate();
    if (!res?.ok) return res;
    const data = res.data || {};
    state.status = res.status;
    state.sqlitePrimary = !!(res.status && res.status.sqlitePrimary);
    if (!state.sqlitePrimary) {
      try {
        await db.enableSqlitePrimary?.();
        const st = await db.status?.();
        state.status = st;
        state.sqlitePrimary = !!(st && st.sqlitePrimary);
      } catch { /* empty */ }
    }

    const apply = (k, v) => {
      rememberCommit(k, v);
      rawSet(k, v);
      syncMemory(k, v);
    };
    apply('clientsRegistry', data.clientsRegistry || []);
    apply('cases', data.cases || []);
    apply('bookings', data.bookings || []);
    apply('doctors', data.doctors || []);
    apply('attendance', data.attendance || []);
    apply('expenses', data.expenses || []);
    for (const k of KV_MIRROR) {
      if (data[k] !== undefined) apply(k, data[k]);
    }

    state.ready = true;
    installWriteThrough();
    installReadThrough();
    return { ok: true, status: state.status, report: res, sqlitePrimary: state.sqlitePrimary };
  }

  function buildOutboxEntry(tableKey, records) {
    const centerId =
      global.ConfigLayer?.getCenterId?.() ||
      global.CenterId?.getStoredCenterId?.() ||
      global.LicenseCloud?.loadLocal?.()?.centerId ||
      '';
    const branchId =
      global.BranchContexts?.getOperationalWriteBranch?.() ||
      global.BranchScope?.getActiveBranchId?.() ||
      'BR-MAIN';
    const deviceId =
      global.DeviceConfig?.getDeviceId?.() ||
      global.DeviceConfig?.load?.()?.deviceUuid ||
      'unknown-device';
    if (!centerId) return null;
    return {
      center_id: centerId,
      branch_id: branchId,
      table_name: tableKey,
      operation: 'TABLE_BUMP',
      base_revision: 0,
      new_revision: Date.now(),
      device_id: deviceId,
      payload_json: JSON.stringify(records ?? null),
    };
  }

  async function commitOperational(tableKey, records, options) {
    options = options || {};
    const db = api();
    if (!db) return { ok: false, error: 'database_api_unavailable' };
    if (!state.sqlitePrimary) {
      const en = await ensureSqlitePrimaryEnabled();
      if (!en.ok) return { ok: false, error: en.error || 'sqlite_primary_required' };
    }
    if (global.LegacyBranchMigration?.isPushBlocked?.()) {
      return { ok: false, error: 'legacy_branch_migration_required' };
    }
    const list = Array.isArray(records) ? records : [];
    state.pendingKeys.add(tableKey);
    try {
      const entry = buildOutboxEntry(tableKey, list);
      let res;
      if (entry && db.syncOp) {
        res = await db.syncOp({
          op: 'enqueueAtomicPersistTable',
          tableKey,
          records: list,
          entry,
        });
      } else {
        res = await db.persistTable(tableKey, list);
      }
      if (res && res.ok === false) {
        state.lastError = res.error || 'commit_failed';
        restoreLastCommit(tableKey);
        return { ok: false, error: state.lastError, res };
      }
      rememberCommit(tableKey, list);
      rawSet(tableKey, list);
      syncMemory(tableKey, list);
      state.lastError = null;
      return { ok: true, tableKey, count: list.length, authoritative: true };
    } catch (e) {
      state.lastError = String(e?.message || e);
      restoreLastCommit(tableKey);
      return { ok: false, error: state.lastError };
    } finally {
      state.pendingKeys.delete(tableKey);
    }
  }

  async function commitKv(key, value) {
    const db = api();
    if (!db) return { ok: false, error: 'database_api_unavailable' };
    if (!state.sqlitePrimary) {
      const en = await ensureSqlitePrimaryEnabled();
      if (!en.ok) return { ok: false, error: en.error || 'sqlite_primary_required' };
    }
    state.pendingKeys.add(key);
    try {
      const res = await db.persistKv(key, value);
      if (res && res.ok === false) {
        state.lastError = res.error || 'kv_persist_failed';
        restoreLastCommit(key);
        return { ok: false, error: state.lastError };
      }
      rememberCommit(key, value);
      rawSet(key, value);
      syncMemory(key, value);
      state.lastError = null;
      return { ok: true, key, authoritative: true };
    } catch (e) {
      state.lastError = String(e?.message || e);
      restoreLastCommit(key);
      return { ok: false, error: state.lastError };
    } finally {
      state.pendingKeys.delete(key);
    }
  }

  async function setAuthoritative(key, value) {
    if (UI_ONLY_KEYS.has(key)) {
      rawSet(key, value);
      return { ok: true, uiOnly: true };
    }
    if (state.bundleActive && isBundledOperationalKey(key)) {
      queueBundleOp(key, value);
      return { ok: true, queued: true, bundle: true };
    }
    if (CORE_TABLES.includes(key)) return commitOperational(key, Array.isArray(value) ? value : []);
    if (KV_MIRROR.includes(key) || OPERATIONAL_KEYS.has(key)) return commitKv(key, value);
    rawSet(key, value);
    return { ok: true, local: true };
  }

  function installReadThrough() {
    if (typeof DB === 'undefined') return;
    DB.__sqliteReadThrough = true;
    DB.readOperational = readOperational;
  }

  function installWriteThrough() {
    if (typeof DB === 'undefined') return;
    if (!DB.__rawSet) {
      const candidate = DB.raw?.set ? DB.raw.set.bind(DB.raw) : DB.set.bind(DB);
      DB.__rawSet = candidate;
    }
    if (DB.__sqliteWriteThrough) {
      DB.__sqliteWriteThrough = false;
    }
    const baseRaw = DB.__rawSet;
    DB.set = function sqliteAuthoritativeSet(k, v) {
      if (UI_ONLY_KEYS.has(k)) {
        baseRaw(k, v);
        return true;
      }
      const db = api();
      if (!db || !state.sqlitePrimary) {
        baseRaw(k, v);
        rememberCommit(k, v);
        return true;
      }
      if (CORE_TABLES.includes(k) || OPERATIONAL_KEYS.has(k) || KV_MIRROR.includes(k)) {
        if (state.bundleActive) {
          queueBundleOp(k, v);
          return false;
        }
        const run = CORE_TABLES.includes(k)
          ? commitOperational(k, Array.isArray(v) ? v : [])
          : commitKv(k, v);
        Promise.resolve(run).then((res) => {
          if (!res?.ok) {
            try {
              global.notify?.(
                '⚠️ فشل الحفظ في SQLite — أُعيدت آخر حالة معتمدة (' + (res?.error || 'commit_failed') + ')',
                'danger'
              );
            } catch { /* empty */ }
          }
        });
        return false;
      }
      baseRaw(k, v);
      return true;
    };
    DB.__sqliteWriteThrough = true;
    DB.__noOptimisticOperational = true;
    DB.commitOperational = commitOperational;
    DB.setAuthoritative = setAuthoritative;
    DB.restoreLastCommit = restoreLastCommit;
    DB.readOperational = readOperational;
    DB.beginBundle = beginBundle;
    DB.commitBundle = commitBundle;
  }

  async function bootFromSQLiteSoT() {
    const db = api();
    if (!db) {
      return { ok: true, mode: 'browser_localStorage_fallback' };
    }
    let res = await hydrateIntoMemory();
    if (!res?.ok) {
      const mig = await migrateAndEnable({ sourceLabel: 'boot_localStorage_migration' });
      if (mig?.ok) res = mig;
    }
    if (res?.ok) {
      try {
        if (typeof global.reloadClientStoreFromDb === 'function') global.reloadClientStoreFromDb();
        if (typeof global.syncAppGlobals === 'function') global.syncAppGlobals();
      } catch { /* empty */ }
    }
    return res || { ok: false, error: 'boot_hydrate_failed' };
  }

  function bootFromSQLiteSoTOnce() {
    if (!state.bootPromise) {
      state.bootPromise = bootFromSQLiteSoT();
    }
    return state.bootPromise;
  }

  async function status() {
    const db = api();
    if (!db) return { ok: false, error: 'database_api_unavailable' };
    state.status = await db.status();
    state.sqlitePrimary = !!(state.status && state.status.sqlitePrimary);
    return state.status;
  }

  function isPrimary() {
    return !!state.sqlitePrimary;
  }

  global.SqliteBridge = {
    migrateAndEnable,
    hydrateIntoMemory,
    bootFromSQLiteSoT,
    bootFromSQLiteSoTOnce,
    ensureSqlitePrimaryEnabled,
    commitOperational,
    commitKv,
    setAuthoritative,
    beginBundle,
    commitBundle,
    isBundleActive,
    restoreLastCommit,
    readOperational,
    status,
    isPrimary,
    collectSnapshotFromLocal,
    CORE_TABLES,
    KV_MIRROR,
    OPERATIONAL_KEYS,
    getState: () => ({
      ready: state.ready,
      sqlitePrimary: state.sqlitePrimary,
      lastError: state.lastError,
      pending: Array.from(state.pendingKeys),
      bundleActive: state.bundleActive,
      bundleQueued: state.bundleOps.length,
      hasLastCommitted: Object.keys(state.lastCommitted),
    }),
    getLastError: () => state.lastError,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      void bootFromSQLiteSoTOnce();
    });
  }
})(typeof window !== 'undefined' ? window : global);
