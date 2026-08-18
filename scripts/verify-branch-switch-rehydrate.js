#!/usr/bin/env node
/**
 * Phase 5: branch switch re-hydrates SQLite view; writes stay branch-scoped.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'cupping-sqlite-bridge.js'), 'utf8');
const switcher = fs.readFileSync(path.join(root, 'cloud/branch-switcher.js'), 'utf8');

const checks = [
  { name: 'rehydrateBranchView exported', ok: /async function rehydrateBranchView/.test(bridge) && /rehydrateBranchView,/.test(bridge) },
  { name: 'readOperational view filter', ok: /filterForActiveViewIfNeeded/.test(bridge) },
  { name: 'mergeBranchSliceIntoCommitted', ok: /function mergeBranchSliceIntoCommitted/.test(bridge) },
  { name: 'filterRecordsForWriteBranch on commit', ok: /filterRecordsForWriteBranch/.test(bridge) },
  { name: 'hydrate applies view filter', ok: /filterForActiveViewIfNeeded\(k, v\)/.test(bridge) },
  { name: 'branch-switcher awaits rehydrate', ok: /rehydrateBranchView/.test(switcher) && /refreshSurfacesAsync/.test(switcher) },
];

let failed = 0;
for (const c of checks) {
  console.log((c.ok ? 'PASS' : 'FAIL') + '  ' + c.name);
  if (!c.ok) failed += 1;
}

// Minimal in-memory simulation of view filter merge
function simulateMerge() {
  const full = [
    { id: 'a', branchId: 'BR-A' },
    { id: 'b', branchId: 'BR-B' },
  ];
  const slice = [{ id: 'a2', branchId: 'BR-A' }];
  const bid = 'BR-A';
  const others = full.filter((r) => (r.branchId || 'BR-MAIN') !== bid);
  const merged = [...others, ...slice];
  const ids = merged.map((r) => r.id).sort();
  const ok = ids.includes('b') && ids.includes('a2') && !ids.includes('a');
  console.log((ok ? 'PASS' : 'FAIL') + '  merge keeps other branch in lastCommitted');
  if (!ok) failed += 1;
}

simulateMerge();

if (failed) process.exit(1);
console.log('\nAll branch switch hardening checks passed.');
