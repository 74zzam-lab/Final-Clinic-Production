/**
 * Branch data isolation — literal per-branch runtime view for owners.
 * Org-wide: license, device, backup tokens, user directory (filtered by branchScope).
 * Branch-scoped: settings/prices, counters, packages, services, workforce, inventory, logs.
 */
(function (global) {
  'use strict';

  const BRANCH_SETTINGS_STORE = '__tdw_branch_settings_store__';
  const BRANCH_COUNTERS_STORE = '__tdw_branch_counters_store__';

  const BRANCH_SCOPED_ARRAY_KEYS = new Set([
    'packages', 'services', 'otRecords', 'nextSessions', 'employeeLeaveRequests',
    'employeeLedgerAccruals', 'employeeLedgerPayments', 'employeeLedgerEntries',
    'inventoryItems', 'inventorySuppliers', 'inventoryMovements',
    'activityLog', 'messageLog', 'importHistory', 'cashDrawerSession',
    'communicationWebhookLog', 'communicationQueue', 'luxQueue'
  ]);

  const BRANCH_PRICE_KEYS = [
    'cupPrice', 'vatRate', 'threshold', 'commissionRate',
    'siliconFacePrice', 'siliconCommission', 'siliconCommissionType',
    'massagePrice', 'massageCommission', 'bankRates'
  ];

  function branchSettingsKeys() {
    const base = global.SettingsSplit?.BRANCH_SETTINGS_KEYS || [
      'centerName', 'centerNameEn', 'address', 'phone', 'taxNum', 'brandLogo',
      'centerName', 'branchName', 'messaging', 'communication', 'leavePolicy',
      'attendanceDefaults', 'waTemplate', 'promoTemplate', 'appointmentTemplate', 'printReports',
      'simplifiedTaxInvoice', 'invoiceSystem', 'clientOverdueDays'
    ];
    return [...new Set(base.concat(BRANCH_PRICE_KEYS))];
  }

  function getViewBranchId() {
    if (global.BranchScope?.isAggregateBranchView?.()) return null;
    return global.BranchContexts?.getOperationalWriteBranch?.()
      || global.BranchScope?.getViewBranchFilter?.()
      || global.BranchScope?.getActiveBranchId?.()
      || global.BranchScope?.DEFAULT_BRANCH_ID
      || 'BR-MAIN';
  }

  function isAggregateView() {
    return !getViewBranchId() || global.BranchScope?.isAggregateBranchView?.();
  }

  function loadStore(key) {
    return global.DB?.get?.(key, {}) || {};
  }

  function saveStore(key, data) {
    global.DB?.set?.(key, data);
    return data;
  }

  function pickBranchFields(obj, keys) {
    obj = obj || {};
    const out = {};
    keys.forEach((k) => {
      if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
  }

  function applyBranchFields(obj, patch, keys) {
    if (!obj || !patch) return obj;
    keys.forEach((k) => {
      if (patch[k] !== undefined) obj[k] = patch[k];
    });
    return obj;
  }

  function persistBranchSettings(branchId) {
    branchId = String(branchId || '').trim();
    if (!branchId || branchId === '*' || branchId === '__ALL__') return;
    const settings = global.settings || global.DB?.get?.('settings', {}) || {};
    const store = loadStore(BRANCH_SETTINGS_STORE);
    store[branchId] = pickBranchFields(settings, branchSettingsKeys());
    saveStore(BRANCH_SETTINGS_STORE, store);
  }

  function applyBranchSettings(branchId) {
    branchId = String(branchId || '').trim();
    if (!branchId || branchId === '*' || branchId === '__ALL__') return;
    const settings = global.settings || global.DB?.get?.('settings', {}) || {};
    const store = loadStore(BRANCH_SETTINGS_STORE);
    const slice = store[branchId];
    if (slice) applyBranchFields(settings, slice, branchSettingsKeys());
    global.settings = settings;
    global.DB?.set?.('settings', settings);
  }

  function persistBranchCounters(branchId) {
    branchId = String(branchId || '').trim();
    if (!branchId || branchId === '*' || branchId === '__ALL__') return;
    const store = loadStore(BRANCH_COUNTERS_STORE);
    store[branchId] = {
      invoiceCounter: Number(global.invoiceCounter ?? global.DB?.get?.('invoiceCounter', 1)) || 1,
      clientFileCounter: Number(global.clientFileCounter ?? global.DB?.get?.('clientFileCounter', 1)) || 1,
      budget: Number(global.DB?.get?.('budget', 0)) || 0
    };
    saveStore(BRANCH_COUNTERS_STORE, store);
  }

  function applyBranchCounters(branchId) {
    branchId = String(branchId || '').trim();
    if (!branchId || branchId === '*' || branchId === '__ALL__') return;
    const store = loadStore(BRANCH_COUNTERS_STORE);
    const slice = store[branchId] || { invoiceCounter: 1, clientFileCounter: 1, budget: 0 };
    global.invoiceCounter = slice.invoiceCounter;
    global.clientFileCounter = slice.clientFileCounter;
    global.DB?.set?.('invoiceCounter', slice.invoiceCounter);
    global.DB?.set?.('clientFileCounter', slice.clientFileCounter);
    global.DB?.set?.('budget', slice.budget);
  }

  function filterArrayForView(key, records) {
    if (!Array.isArray(records)) return records;
    if (isAggregateView()) return records.slice();
    if (global.BranchScope?.filterForActiveView) {
      return global.BranchScope.filterForActiveView(records);
    }
    const bid = getViewBranchId();
    if (global.BranchScope?.filterByBranch) return global.BranchScope.filterByBranch(records, bid);
    return records.slice();
  }

  function filterUsersForView(users) {
    if (!Array.isArray(users)) return [];
    if (isAggregateView()) return users.slice();
    const bid = getViewBranchId();
    if (global.SettingsSplit?.filterUsersForBranch) {
      return global.SettingsSplit.filterUsersForBranch(users, bid);
    }
    return users.slice();
  }

  function filterLogsForView(logs) {
    if (!Array.isArray(logs)) return [];
    if (isAggregateView()) return logs.slice();
    const bid = getViewBranchId();
    return logs.filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      if (entry.branchId) return entry.branchId === bid;
      // Legacy entries without branchId — hide from branch-specific view
      return false;
    });
  }

  function filterKvForView(key, value) {
    if (isAggregateView()) return value;
    if (CORE_TABLES.has(key) || BRANCH_SCOPED_ARRAY_KEYS.has(key)) {
      return filterArrayForView(key, value);
    }
    if (key === 'users') return filterUsersForView(value);
    if (key === 'activityLog' || key === 'messageLog') return filterLogsForView(value);
    if (key === 'settings') return value;
    return value;
  }

  const CORE_TABLES = new Set([
    'clientsRegistry', 'cases', 'bookings', 'doctors', 'attendance', 'expenses'
  ]);

  function stampBranchId(record) {
    if (!record || typeof record !== 'object') return record;
    if (!record.branchId) {
      record.branchId = getViewBranchId()
        || global.BranchScope?.getActiveBranchId?.()
        || global.BranchScope?.DEFAULT_BRANCH_ID
        || 'BR-MAIN';
    }
    return record;
  }

  function stampLogEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    if (!entry.branchId) {
      entry.branchId = getViewBranchId()
        || global.BranchScope?.getActiveBranchId?.()
        || global.BranchScope?.DEFAULT_BRANCH_ID
        || 'BR-MAIN';
    }
    return entry;
  }

  function persistOutgoing(branchId) {
    if (!branchId || branchId === '*' || branchId === '__ALL__') return;
    persistBranchSettings(branchId);
    persistBranchCounters(branchId);
  }

  function applyIncoming(branchId) {
    if (!branchId || branchId === '*' || branchId === '__ALL__') return;
    applyBranchSettings(branchId);
    applyBranchCounters(branchId);
  }

  function beforeBranchSwitch(fromBranchId, toBranchId) {
    if (fromBranchId && fromBranchId !== '*' && fromBranchId !== '__ALL__') {
      persistOutgoing(fromBranchId);
    }
  }

  function afterBranchSwitch(toBranchId) {
    if (toBranchId && toBranchId !== '*' && toBranchId !== '__ALL__') {
      applyIncoming(toBranchId);
    }
  }

  /** Call after saving branch-specific settings/prices from UI. */
  function persistActiveBranchSettings() {
    const bid = getViewBranchId();
    if (bid) persistBranchSettings(bid);
  }

  function persistActiveBranchCounters() {
    const bid = getViewBranchId();
    if (bid) persistBranchCounters(bid);
  }

  global.BranchDataIsolation = {
    BRANCH_SETTINGS_STORE,
    BRANCH_COUNTERS_STORE,
    BRANCH_SCOPED_ARRAY_KEYS,
    BRANCH_PRICE_KEYS,
    branchSettingsKeys,
    getViewBranchId,
    isAggregateView,
    filterKvForView,
    filterArrayForView,
    filterUsersForView,
    filterLogsForView,
    stampBranchId,
    stampLogEntry,
    persistOutgoing,
    applyIncoming,
    beforeBranchSwitch,
    afterBranchSwitch,
    persistActiveBranchSettings,
    persistActiveBranchCounters,
    persistBranchSettings,
    applyBranchSettings
  };
})(typeof window !== 'undefined' ? window : globalThis);
