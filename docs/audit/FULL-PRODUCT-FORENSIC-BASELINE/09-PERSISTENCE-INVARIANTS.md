# 09 — Persistence Invariants

## Test Matrix

Environment: Linux dev extract, `npm test` + source analysis. **No installed Windows EXE.** Machine restart = **UNVERIFIED**.

| Invariant | WRITE→READ | RELOAD | APP RESTART | PROCESS RESTART | RESTORE | RECONNECT | Result |
|-----------|------------|--------|-------------|-----------------|---------|-----------|--------|
| Client record identity stable | SOURCE_CONFIRMED | SOURCE_CONFIRMED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | **PARTIAL** |
| Visit totals non-negative | DB CHECK constraint | SOURCE_CONFIRMED | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A | **SOURCE_CONFIRMED** |
| License after activation | test-phase3 | SOURCE_CONFIRMED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | **PARTIAL** |
| User session after restart | rbac-session code | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A | N/A | **UNVERIFIED** |
| Sync outbox survives crash | sync_outbox table | test v2-4 outbox | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | **PARTIAL** |
| Setup step after close/reopen | setup-state-service | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A | N/A | **UNVERIFIED** |
| OAuth token after restart | token-store | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A | UNVERIFIED | **UNVERIFIED** |
| No duplicate entity on reconnect | sync idempotency code | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | **UNVERIFIED** |
| Backup V2 round-trip | test backup-restore-v2 | PASS unit | UNVERIFIED | UNVERIFIED | UNVERIFIED | N/A | **PARTIAL** |
| localStorage vs SQLite agreement | dual-write paths | **FAIL risk** | **FAIL risk** | **FAIL risk** | UNVERIFIED | UNVERIFIED | **FAIL (design)** |

## Key Findings

### INV-01: Dual-Write Divergence (P0)
**WRITE** to SQLite via SqliteBridge may not update all localStorage keys (or vice versa).  
**READ** path may prefer localStorage cache on hydrate.  
**RESTART** can surface stale data.  
**Evidence:** K-10, executive summary, `license-store.js` still LS-primary.

### INV-02: Restore Must Reconcile Before Push (P0)
Code in `restore-reconciliation.js` enforces reconcile-before-push.  
**Runtime on installed EXE:** UNVERIFIED (Scenario C FAIL per docs).

### INV-03: Migration Idempotency
`schema_migrations` table tracks applied migrations.  
`001_initial` uses `CREATE IF NOT EXISTS` — idempotent.  
**Partial migration mid-crash:** UNVERIFIED.

### INV-04: License UI Success vs Durable Commit
Invariant required: UI SUCCESS = durable localStorage + valid crypto state.  
V5 HMAC can be forged if signing material exposed in client.  
**Runtime:** SOURCE_CONFIRMED for happy path unit tests only.

### INV-05: No Replay of Committed Setup Steps
`setup-state-service.js` tracks completed steps with revision merge.  
**Live restart loop:** documented as fixed in V2-5.10 — UNVERIFIED.

## Recommendations (Audit Only — Not Implemented)

1. Single read path: SQLite only for operational entities
2. Persistence integration tests on installed EXE with process kill
3. Property test: write → kill -9 → restart → read equals
