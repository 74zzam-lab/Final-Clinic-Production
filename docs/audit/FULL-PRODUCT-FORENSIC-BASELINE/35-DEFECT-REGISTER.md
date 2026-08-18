# 35 — Defect Register

## P0 Defects

### DEF-001: Multi-device sync unproven
- **Severity:** P0 | **Status:** OPEN
- **Impact:** Cannot certify clinic sync | **Data:** High loss risk
- **Root cause:** RC-04 | **Chain:** sync-engine → Drive → peer pull
- **Repro:** Two Windows installs, same license — not executed
- **Why tests missed:** Unit simulation only
- **Fix:** Live Scenario A UAT; fix defects
- **Tests needed:** Production-path A/B harness

### DEF-002: Backup V1 restore path active
- **Severity:** P0 | **Status:** OPEN
- **Impact:** Wrong SoT restore corrupts clinic
- **Root cause:** RC-02 | **Files:** `cupping-cloud-db-backup.js`
- **Fix:** Disable V1 UI; gate IPC
- **Tests:** UI absent + IPC reject

### DEF-003: Dual persistence SQLite/localStorage
- **Severity:** P0 | **Status:** OPEN
- **Impact:** Stale/missing data after restart
- **Root cause:** RC-01
- **Fix:** SQLite-only read path
- **Tests:** write→kill→restart property test

### DEF-004: Live OAuth/license activation unverified
- **Severity:** P0 | **Status:** OPEN
- **Security:** High | **Root cause:** RC-04
- **Fix:** Scenario activation S1/S2 on EXE

### DEF-005: Cloud restore Scenario C FAIL
- **Severity:** P0 | **Status:** OPEN (per docs)
- **Impact:** DR failure | **Fix:** Retest discovery-fix EXE

### DEF-006: Cross-scope isolation unverified
- **Severity:** P0 | **Status:** OPEN
- **Impact:** Branch data leakage | **Root cause:** RC-04

## P1 Defects

### DEF-007: Attachment metadata duplicate (RB-05)
### DEF-008: isBenignCloudErr suppresses ReferenceErrors (RB-09)
### DEF-009: Conflict queue dual storage
### DEF-010: Responsive UI matrix unverified (RB-08)
### DEF-011: OAuth secret in embedded config (K-05) — accepted risk, still P1
### DEF-012: V5 HMAC license forgeable
### DEF-013: npm audit 30 dependency vulnerabilities
### DEF-014: ESLint 120 errors (quality gate broken)
### DEF-015: Repo ZIP-only — no proper source control at workspace

## P2 Defects

### DEF-016: 27k-line monolith maintainability
### DEF-017: Docs sprawl conflicting PASS language
### DEF-018: Node engines vs README version conflict
### DEF-019: Multiple activation UX surfaces
### DEF-020: Performance unbenchmarked on real data

**P0 Count: 6 | P1 Count: 9 | P2 Count: 5**
