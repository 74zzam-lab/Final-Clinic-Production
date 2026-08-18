# 42 — Ordered Remediation Roadmap

**Philosophy:** One root cause → minimal repair → regression test → production-path verification → installed verification → commit → freeze.

---

## Phase 1: Repository Baseline Fix
- **Goal:** Proper git SoT matching product inside zip
- **Cluster:** RC-07
- **Scope:** Extract to `Tadawi-Clinic-Production` repo; align remote; tag `audit-baseline-2026-08-18`
- **Risk:** LOW | **Rollback:** Keep zip archive
- **Exit gate:** `git log` shows full history; CI triggers on push

## Phase 2: Disable Backup V1 Operations
- **Goal:** Eliminate wrong-SoT restore path
- **Cluster:** RC-02 | **Files:** Settings UI, `backup-v1-gate.js`, IPC handlers
- **Risk:** HIGH (ops) | **Rollback:** Feature flag restore
- **Tests:** IPC reject + UI absent | **Installed:** Settings scan
- **Exit gate:** No reachable V1 restore on EXE

## Phase 3: isBenignCloudErr Surgical Fix
- **Goal:** Stop hiding ReferenceErrors
- **Cluster:** RC-05 | **Files:** `index.html` initProductionErrorHandlers
- **Risk:** MEDIUM | **Rollback:** Revert single function
- **Tests:** Inject missing module → error logged
- **Exit gate:** Zero suppressed ReferenceErrors in Scenario A smoke

## Phase 4: SQLite Read-Path Authority
- **Goal:** Renderer reads operational data from SQLite only on boot
- **Cluster:** RC-01 | **Files:** SqliteBridge, hydrate paths in index.html
- **Risk:** CRITICAL | **Data migration:** None if write-through complete
- **Tests:** test write→restart→read | **Installed:** daily ops journey
- **Exit gate:** localStorage ops keys not read on boot

## Phase 5: SQLite Write-Path Completion
- **Goal:** All mutations go through SqliteBridge; LS write-only for legacy compat window
- **Cluster:** RC-01
- **Risk:** CRITICAL
- **Exit gate:** Grep shows no direct LS write for clients/visits/invoices

## Phase 6: Attachment Metadata Unification
- **Goal:** Single SoT `attachments_meta`
- **Cluster:** RC-06 | **Files:** attachment sync modules
- **Risk:** HIGH
- **Exit gate:** Attachment A/B test PASS on EXE

## Phase 7: Conflict Queue Unification
- **Goal:** SQLite `sync_conflicts` only
- **Cluster:** RC-06
- **Risk:** HIGH
- **Exit gate:** No LS conflict queue reads

## Phase 8: Windows Build + SHA Verification
- **Goal:** Reproducible EXE from baseline commit
- **Cluster:** RC-10
- **Risk:** MEDIUM
- **Exit gate:** CI green NSIS build; SHA published

## Phase 9: Installed Smoke Test Harness
- **Goal:** Automated startup/login smoke on Windows CI
- **Cluster:** RC-03
- **Risk:** LOW
- **Exit gate:** Playwright/smoke exits 0 on installed EXE

## Phase 10: Scenario A — Device A/B Sync UAT
- **Goal:** Close RB-01, DEF-001
- **Cluster:** RC-04
- **Risk:** CRITICAL
- **Exit gate:** `v2-5-10:validate-ae` exit 0 with evidence pack

## Phase 11: Activation OAuth UAT
- **Goal:** Close RB-02, DEF-004
- **Cluster:** RC-04
- **Exit gate:** Google connect → license pull → restart PASS

## Phase 12: Scenario C — Cloud Restore DR
- **Goal:** Close RB-03, DEF-005
- **Cluster:** RC-04
- **Exit gate:** Full restore journey on EXE with populated DB

## Phase 13: Scope Isolation UAT
- **Goal:** Close RB-06, DEF-006
- **Cluster:** RC-04
- **Exit gate:** Branch A/B leakage test 0 unauthorized reads

## Phase 14: Runtime Error Sweep
- **Goal:** Close RB-09
- **Cluster:** RC-05
- **Exit gate:** Zero unhandled errors on A–E journeys

## Phase 15: Responsive UI Matrix
- **Goal:** Close RB-08
- **Exit gate:** 1366×768 modal footers visible

## Phase 16: License V5 → V6 Migration Path
- **Goal:** Close DEF-012
- **Risk:** HIGH
- **Exit gate:** New activations V6 only; V5 migrate tool tested

## Phase 17: Dependency Security Pass
- **Goal:** Close DEF-013
- **Risk:** MEDIUM
- **Exit gate:** npm audit critical = 0 or documented exceptions

## Phase 18: ESLint Gate Restoration
- **Goal:** Close DEF-014
- **Exit gate:** `npm run lint` exit 0

## Phase 19: localStorage Legacy Removal
- **Goal:** Complete RC-01
- **Risk:** CRITICAL
- **Exit gate:** No operational LS keys after upgrade migration

## Phase 20: Setup Wizard Consolidation
- **Goal:** RC-09
- **Risk:** MEDIUM
- **Exit gate:** Single setup-state-service path for all onboarding

## Phase 21: Production Candidate Checklist
- **Goal:** 40/40 requirements PASS
- **Exit gate:** CURRENT-STATUS all PASS; score re-baselined independently

## Phase 22: Signed Release Build
- **Goal:** Commercial distribution
- **Risk:** MEDIUM
- **Exit gate:** Code-signed NSIS; installer validation

## Phase 23: Pilot Program
- **Goal:** Controlled customer pilot
- **Exit gate:** 2+ clinics, 30 days, no P0 incidents

## Phase 24: Post-Pilot Cleanup
- **Goal:** Remove dead code, archive docs
- **Risk:** LOW
- **Exit gate:** Dead code inventory executed

## Phase 25: Commercial SELLABLE Declaration
- **Goal:** Independent re-score ≥80, 0 P0, 0 blocking P1
- **Exit gate:** 40-COMMERCIAL-READINESS.md updated to SELLABLE

---

**DO NOT start Phase 1 implementation until explicit approval.**
