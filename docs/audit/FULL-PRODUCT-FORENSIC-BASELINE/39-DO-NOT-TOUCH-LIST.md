# 39 — Do-Not-Touch List

| Component | Evidence | Why Stable | Regression Risk | Freeze Rule |
|-----------|----------|------------|-----------------|-------------|
| Commission calc formulas | FEATURE-INVENTORY | Business-critical | HIGH financial | No formula changes without golden tests |
| `database/migrations/001_initial.js` | Applied in field | Schema v4 deployed | HIGH data | Additive migrations only |
| `electron/security/ipc-validate.js` | phase2 PASS | Security boundary | CRITICAL | Extend only with tests |
| `electron/rbac-session.js` | phase6 PASS | Auth boundary | CRITICAL | No loosening |
| `backup-crypto-v2.js` | backup tests PASS | Customer backups | HIGH | No algorithm change |
| `license-codec-v6.js` + pubkey | phase3 PASS | License verify | HIGH | Verify-only path frozen |
| NSIS uninstall keep userData | installer.nsh | Customer data safety | HIGH | Default must remain keep |
| `table-merge-policy.js` | v2-4 tests | Sync semantics | HIGH | Policy changes need A/B proof |
| Tax invoice QR format | verify:tax-invoice PASS | Regulatory | HIGH | Golden file tests first |
| Production lock policy | PRODUCTION-LOCK.md | Stability program | MEDIUM | Bugs/UX/UAT only until PC |
