/**
 * RC Hotfix Round 2 — authoritative user credentials before login (post-restore).
 */
(function (global) {
  'use strict';

  const OWNER_SEED_HASH = 'pbkdf2:owner:f28c4134eec2cebf7631ab559ec0eb794280730d728919f259438a3441f5266b';

  function readAuthoritativeUsers() {
    if (global.SqliteBridge?.getCommittedRaw) {
      const raw = global.SqliteBridge.getCommittedRaw('users');
      if (Array.isArray(raw) && raw.length) return raw.slice();
    }
    const fromDb = global.DB?.get?.('users', null);
    if (Array.isArray(fromDb) && fromDb.length) return fromDb.slice();
    return Array.isArray(global.users) ? global.users.slice() : [];
  }

  function hasRestoredOwnerCredential(list) {
    return (list || []).some((u) => u
      && String(u.role || '').toLowerCase() === 'owner'
      && u.active !== false
      && u.password
      && u.password !== OWNER_SEED_HASH
      && !u.seedDefaultPassword);
  }

  /**
   * Reload in-memory users from SQLite/KV — call before login and after hydrate.
   */
  function syncUsersFromAuthoritativeStore() {
    const store = readAuthoritativeUsers();
    if (!store.length) return store;
    global.users = store;
    if (typeof global.__assignUsersClosure === 'function') {
      global.__assignUsersClosure(store);
    }
    return store;
  }

  async function ensureAuthCredentialsReady() {
    if (global.SqliteBridge?.bootFromSQLiteSoTOnce) {
      await global.SqliteBridge.bootFromSQLiteSoTOnce();
    }
    syncUsersFromAuthoritativeStore();
    if (hasRestoredOwnerCredential(global.users)) {
      try {
        global.OwnerLifecycleAuthority?.markRestorePreserve?.();
      } catch { /* empty */ }
    }
    return { ok: true, users: global.users || [] };
  }

  function shouldBlockOwnerSeed(list) {
    return hasRestoredOwnerCredential(list || readAuthoritativeUsers());
  }

  global.AuthCredentialTruth = {
    OWNER_SEED_HASH,
    readAuthoritativeUsers,
    hasRestoredOwnerCredential,
    syncUsersFromAuthoritativeStore,
    ensureAuthCredentialsReady,
    shouldBlockOwnerSeed,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.AuthCredentialTruth;
  }
})(typeof window !== 'undefined' ? window : globalThis);
