# 12 — Scope Isolation Audit

## Scope Model

- **Organization / Center:** `center-id`, Owner Hub
- **Branch:** `branch_id` on operational records
- **Device:** device registry per org
- **User:** RBAC role within org

## Test Plan (Designed — Not Executed Live)

Create Scope A (Branch A) and Scope B (Branch B) on two devices.  
**Environment limitation:** No second Windows device in audit VM → **MULTI-DEVICE = UNVERIFIED**

## Isolation Checks

| Operation | Enforcement Layer | Expected | Runtime Result |
|-----------|-------------------|----------|----------------|
| READ client in wrong branch | SQL query + branch filter | 0 rows | **UNVERIFIED** |
| WRITE with wrong branch_id | IPC + repository | Reject | **UNVERIFIED** |
| SEARCH global | Renderer filter | Scope-limited | **UNVERIFIED** |
| REPORTS aggregate | Report SQL | Branch param | **UNVERIFIED** |
| EXPORT | Export handler | Scope filter | **UNVERIFIED** |
| SYNC push | Outbox scoped | Branch partition | **SOURCE_CONFIRMED** code |
| SYNC pull apply | Merge policy | No cross-branch apply | **UNVERIFIED** |
| BACKUP | Manifest includes branch meta | Scoped restore | **PARTIAL** unit |
| RESTORE | Reconciliation | No cross-branch bleed | **UNVERIFIED** |
| Owner All Branches mode | Owner policy | Elevated read | **SOURCE_CONFIRMED** — write rules UNVERIFIED |
| UI hide branch selector | Renderer only | **NOT ISOLATION** | N/A |

## Code Inspection Findings

- `cloud/branch-context.js` — branch context propagation
- `cloud/rbac-guard.js` — role checks
- `database/repositories` — branch_id in queries (pattern present)
- Owner branch mode tests: `test-phase30-owner-branch-mode.js` — **STATIC PASS only**

## Result

**SCOPE ISOLATION: UNVERIFIED (FAIL for release purposes)**

Prior release blocker RB-06 remains open. UI hiding cannot be accepted as isolation proof.

## Recommended Production-Path Test (Not Run)

1. Device A: create client in Branch A
2. Device B: sync pull — must NOT see Branch A client in Branch B context
3. Owner mode: may see both — verify write still scoped
4. SQL injection via forged branch_id in IPC — must reject
