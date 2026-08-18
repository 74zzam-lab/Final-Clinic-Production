#!/usr/bin/env node
/**
 * Phase 9 — operational RBAC hardening (authoritative user + main syncOp gates).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const errors = [];

function assert(c, m) {
  if (!c) errors.push(m);
}

const policy = require('../database/operational-rbac-policy');
assert(policy.SYNC_OP_MIN_RANK.resolveConflict === policy.MANAGER_MIN_RANK, 'resolveConflict needs manager rank');
assert(policy.isManagerRole('admin'), 'admin is manager');
assert(!policy.isManagerRole('reception'), 'reception not manager');
assert(policy.isOwnerRole('owner'), 'owner role');

const users = [
  { id: '2', role: 'admin', active: true, branchScope: ['*'] },
  { id: '3', role: 'reception', active: true, branchScope: ['BR-MAIN'] },
];
const lookupUsers = () => users;

const rbacSession = require('../electron/rbac-session');
const fakeEvent = { sender: { id: 9001 } };
rbacSession.bindSession(fakeEvent, {
  userId: '3',
  role: 'reception',
  branchScope: ['BR-MAIN'],
  lookupUsers,
});
try {
  rbacSession.assertSyncOpAllowed(fakeEvent, 'resolveConflict');
  errors.push('reception should not resolveConflict');
} catch (e) {
  assert(e.code === 'rbac_rank_denied', 'reception blocked with rank_denied');
}
rbacSession.assertSyncOpAllowed(fakeEvent, 'listOpenConflicts');

rbacSession.bindSession({ sender: { id: 9002 } }, {
  userId: '2',
  role: 'admin',
  branchScope: ['*'],
  lookupUsers,
});
rbacSession.assertSyncOpAllowed({ sender: { id: 9002 } }, 'resolveConflict');

// Renderer operational guard
const context = {
  window: {},
  globalThis: {},
  console,
  notify: () => {},
  currentUser: { id: '3', username: 'rec1', role: 'owner' }, // forged owner
  users: [{ id: '3', username: 'rec1', role: 'reception', active: true, branchScope: ['BR-MAIN'] }],
  DB: {
    _d: {},
    get(k, d) {
      try {
        const v = context.DB._d[k];
        return v !== undefined ? v : d;
      } catch { return d; }
    },
    set(k, v) { context.DB._d[k] = v; },
  },
  OwnerProfile: { hasProfile: () => true },
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync(path.join(root, 'cloud/role-policy.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'cloud/rbac-guard.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'cloud/operational-rbac-guard.js'), 'utf8'), context);

const tamper = context.RbacGuard.rejectTamperedRole(context.currentUser);
assert(!tamper.ok && tamper.error === 'tampered_role', 'tampered role rejected');

const mgr = context.OperationalRbacGuard.requireManager({ action: 'test', notify: false });
assert(!mgr.ok && mgr.error === 'manager_only', 'forged owner not manager after auth resolve');

context.currentUser.role = 'reception';
const ownerGate = context.OperationalRbacGuard.requireOwner({ action: 'hub', notify: false });
assert(!ownerGate.ok, 'reception cannot owner mutate');

context.users[0].role = 'admin';
context.currentUser = { id: '3', username: 'rec1', role: 'admin' };
const adminMgr = context.OperationalRbacGuard.requireManager({ notify: false });
assert(adminMgr.ok, 'real admin passes manager gate');

const mainSrc = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
assert(mainSrc.includes('assertSyncOpAllowed'), 'main wires syncOp RBAC');

const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSrc.includes('operational-rbac-guard.js'), 'index loads operational RBAC guard');

if (errors.length) {
  console.error('FAIL verify-operational-rbac:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}
console.log('OK: Phase 9 operational RBAC verified');
