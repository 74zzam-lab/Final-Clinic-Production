#!/usr/bin/env node
/**
 * Phase 4: branch-scoped SQLite writes do not delete other branches' rows.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('../database/connection');
const { createRepositories } = require('../database/repositories');

const root = path.join(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'cupping-sqlite-bridge.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'electron/database/service.js'), 'utf8');

const checks = [
  { name: 'branch-slice module exists', ok: fs.existsSync(path.join(root, 'database/repositories/branch-slice.js')) },
  { name: 'repos replaceBranchSlice', ok: /replaceBranchSlice/.test(fs.readFileSync(path.join(root, 'database/repositories/index.js'), 'utf8')) },
  { name: 'service persistTable branchId', ok: /options\.branchId/.test(service) },
  { name: 'querySafe getById', ok: /case 'getById'/.test(service) },
  { name: 'bridge passes branchId on persist', ok: /persistTable\(tableKey, list, branchId\)/.test(bridge) },
  { name: 'bundle steps include branchId', ok: /branchId,\s*branchId/.test(bridge) || /records: op\.records \|\| \[\], branchId/.test(bridge) },
];

let failed = 0;
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + '  ' + c.name);
  if (!c.ok) failed += 1;
}

async function runtimeSliceTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-slice-'));
  const dbPath = path.join(tmp, 'tadawi.db');
  const db = openDatabase(dbPath);
  const repos = createRepositories(db);

  repos.clients.upsert({ id: 'c-a', name: 'A', branchId: 'BR-A' });
  repos.clients.upsert({ id: 'c-b', name: 'B', branchId: 'BR-B' });

  repos.clients.replaceBranchSlice([
    { id: 'c-a2', name: 'A2', branchId: 'BR-A' },
  ], 'BR-A');

  const all = repos.clients.getAll();
  const ids = all.map((r) => r.id).sort();
  const ok = ids.includes('c-a2') && ids.includes('c-b') && !ids.includes('c-a');
  console.log((ok ? 'PASS' : 'FAIL') + '  runtime replaceBranchSlice keeps other branch');
  if (!ok) failed += 1;

  let tamperFailed = false;
  try {
    repos.clients.replaceBranchSlice([{ id: 'x', name: 'X', branchId: 'BR-B' }], 'BR-A');
  } catch (e) {
    tamperFailed = e.code === 'branch_id_tamper';
  }
  console.log((tamperFailed ? 'PASS' : 'FAIL') + '  branch_id tamper rejected');
  if (!tamperFailed) failed += 1;

  const scoped = repos.clients.getByIdScoped('c-b', 'BR-A');
  console.log((scoped === null ? 'PASS' : 'FAIL') + '  getByIdScoped denies cross-branch');
  if (scoped !== null) failed += 1;

  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

runtimeSliceTest().then(() => {
  if (failed) process.exit(1);
  console.log('\nAll branch SQL isolation checks passed.');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
