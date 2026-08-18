# FULL PRODUCT DEFECT & REMEDIATION REPORT

**Audit date:** 2026-08-18 UTC  
**Mode:** ANALYSIS ONLY — no code modified  
**Analyst:** Forensic re-audit from current HEAD + extracted product source

---

## A. Baseline Identity

| Field | Value |
|-------|-------|
| **Repo (workspace)** | `74zzam-lab/Final-Clinic-Production` |
| **Branch** | `cursor/full-product-forensic-audit-b24e` |
| **HEAD SHA** | `44d73b1a5f27be3f077b5c58c01dfee334130fc6` |
| **Parent (main)** | `ea1cd1c` — single commit: ZIP upload only |
| **Git status** | Clean tracked; `docs/audit/_extracted/` untracked (read-only extract) |
| **Git history** | **NOT real product history** — 2 commits, product lives inside ZIP |
| **Documented SoT repo** | `7uzzam/Tadawi-Clinic-Production` (inside zip README — **different remote**) |
| **Product name** | Hijama Management System / Tadawi Al-Madinah |
| **Package version** | `2.0.1` (program track V2-5.10 consolidation `cea9`) |
| **Electron** | ^43.2.0 |
| **Node (audit env)** | v22.14.0 |
| **npm (audit env)** | 10.9.7 |
| **OS (audit env)** | Linux x86_64 — no Windows GUI |
| **Main entry** | `electron/main.js` |
| **UI entry** | `index.html` (27,278 lines) |
| **Database** | SQLite via `better-sqlite3` |
| **Build** | `npm run build:prod` → electron-builder NSIS x64 Windows only |
| **Test** | `npm test` → `tests/run-all.js` (106 suites) |
| **CI** | 17 workflows, all `windows-2022` |
| **Product extract path** | `docs/audit/_extracted/Tadawi-Clinic-Production-cursor-v2-5-10-final-consolidation-cea9/` |

**Baseline trust:** ZIP snapshot of V2-5.10 consolidation. Workspace is not a normal git product tree.

---

## B. Executive Product Assessment

**Hijama Management System** is a mature Electron clinic desktop app (Arabic RTL) covering patients, visits, bookings, finance, payroll, inventory, licensing, Google Drive sync, and encrypted backup. Engineering investment is substantial: IPC security, RBAC session, SQLite schema, sync outbox, Backup V2 crypto, and 106 automated suites.

**However, the product is not release-ready.** From code + limited runtime:

- **Confirmed defects/risks** exist in persistence authority, sync overwrite paths, error suppression, and legacy restore IPC.
- **Backup V1** is UI-gated but **not removed** — env/IPC bypass remains.
- **106/106 tests PASS** on Linux but are predominantly **static/regex** — they do not prove installed Windows behavior.
- **0 live UAT scenarios** executed in this audit environment.
- **Commercial readiness: BLOCKED.**

Prior audit reports treated as hypotheses; findings below re-verified from source.

---

## C. Architecture

```
Renderer (index.html + cupping-*.js + cloud/*.js)
  │ localStorage cache + SqliteBridge mirror
  │ Repository adapter → reads LS (hydrated from SQLite)
  ▼
Preload (allowlisted IPC)
  ▼
Main (electron/main.js)
  │ RBAC session, IPC validate, backup V1/V2, OAuth, DB service
  ▼
SQLite (tadawi.db)  ←→  Google Drive (sync JSON + backup files)
  │
Legacy: LevelDB (Chromium localStorage physical store) ← Backup V1 target
```

**Intended model:** SQLite primary (`meta.sqlitePrimary=true`), localStorage as mirror, Cloud V2 for sync, Backup V2 for DR.  
**Actual model:** Hybrid with 18 restore entry points, 3 backup concepts, 5+ setup surfaces, dual conflict/attachment stores.

---

## D. Complete Surface Inventory

| Category | Count | Runtime verified |
|----------|------:|------------------|
| Pages (`page-*`) | 22 | NO |
| Buttons | 334 | NO |
| onclick handlers | 390 | NO |
| Modals/panels | 50+ (est.) | NO |
| IPC channels | 100+ | SOURCE_CONFIRMED |
| Domain modules (`cupping-*.js`) | 29 | SOURCE_CONFIRMED |
| Cloud modules | 93 | SOURCE_CONFIRMED |

### Pages mapped to domain

| Page | Domain |
|------|--------|
| page-dashboard | Dashboard |
| page-daily | Sessions/Visits |
| page-clients | Patients |
| page-bookings | Appointments |
| page-invoices | Invoices |
| page-expenses | Expenses |
| page-attendance | Staff attendance |
| page-payroll | Payroll |
| page-employee-ledger | Employee ledger |
| page-doctors | Practitioners |
| page-employee | Employees |
| page-users | Users/RBAC |
| page-settings | Settings/Backup/Cloud |
| page-reports | Reports |
| page-logs | Audit logs |
| page-messages | Messaging |
| page-packages | Packages |
| page-inventory | Inventory |
| page-cashfloat | Cash float |
| page-search | Search |
| page-queue-display | Queue display |
| page-owner-hub | Owner Hub |

**All UI controls: UNVERIFIED at runtime** (no installed Windows EXE session).

---

## E. Complete Defect Register

| ID | Area | Problem | Classification | Severity | Evidence | Repro? | Root Cause | Exact File | Exact Function | Call Chain | State Authority | Runtime Impact | Data-Loss | Security | Why Tests Miss | Correct Fix | Files To Change | Regression Test | Installed UAT | Win | Google | 2nd Device | Dependencies | Fix Order |
|----|------|---------|----------------|----------|----------|--------|------------|------------|----------------|------------|-----------------|----------------|-----------|----------|----------------|-------------|-----------------|-----------------|---------------|-----|--------|------------|--------------|-----------|
| DEF-001 | Backup | V1 restore IPC still restores LevelDB over SQLite SoT when `HIJAMA_ALLOW_BACKUP_V1=1` or direct IPC | CONFIRMED RISK | P0 | `backup-v1-gate.js:8-10`, `cloud-db-backup.js:134-167`, `clinic-snapshot.js:184-208` | Code path yes; UI blocked | Legacy V1 not removed, only gated | `electron/cloud-db-backup.js` | `restoreDbBackup` | IPC `backup:restoreDbBackup` → main → LevelDB wipe | LevelDB vs SQLite | Wrong restore corrupts clinic | **HIGH** | Medium | Stage1 tests gate default only | Remove IPC handler or hard-reject always; migrate V1→V2 tool only | `main.js`, `backup.js`, `backup-v1-gate.js` | IPC reject test + no LevelDB touch | Settings scan | Yes | No | No | DEF-002 | 4 |
| DEF-002 | Persistence | SQLite + localStorage dual authority for all operational entities | CONFIRMED RISK | P0 | `cupping-sqlite-bridge.js:12-29,241-271,297-348` | Design repro | Transitional hybrid not finished | `cupping-sqlite-bridge.js` | `installWriteThrough`, `hydrateIntoMemory` | DB.set → bridge → SQLite + LS mirror | SQLite vs LS | Stale reads after restart | **HIGH** | Low | Tests run without Electron or with LS-only | Single read path from SQLite; LS write-only during migration window | `cupping-sqlite-bridge.js`, `cloud/repository.js`, `index.html` | write→kill→restart→read | Daily ops journey | Yes | No | No | — | 2 |
| DEF-003 | Sync | Empty payload push when `Repository.get` returns null | CONFIRMED RISK | P0 | `cloud/sync-engine.js:125-140` | Code path | Null coerced to `[]` in push | `cloud/sync-engine.js` | push enqueue | sync → Drive empty snapshot | Repository/LS | Remote wiped with empty | **HIGH** | Medium | Mocked repos in unit tests | Refuse push if null/uninitialized; guard with row count | `sync-engine.js` | push-null-guard test | Device A/B | Yes | Yes | Yes | DEF-002 | 11 |
| DEF-004 | Sync | `localRev===0` full table replace without conflict check | CONFIRMED RISK | P0 | `database/peer-sync-engine.js:469-493` | Code path | Conflict only when pending>0 AND localRev>0 | `peer-sync-engine.js` | pull apply loop | pull → `state.tables[table]=remote` | SQLite tables | Fresh device overwrites local | **HIGH** | Low | Unit uses seeded rev | Conflict check at localRev=0 if local rows exist | `peer-sync-engine.js` | fresh-device-overwrite test | Device A/B | Yes | Yes | Yes | DEF-002 | 11 |
| DEF-005 | Sync | Legacy import without RecordMerger still runs | CONFIRMED RISK | P1 | `cloud/operational-layer.js:109-123` | Code path | Fallback concat path | `operational-layer.js` | `importTable` | import → setAll | Repository | Wrong merge | **HIGH** | Low | Legacy path rarely hit in tests | Block legacy path in production; force merger | `operational-layer.js` | import-guard test | Import journey | Yes | No | No | DEF-002 | 11 |
| DEF-006 | Errors | `isBenignCloudErr` suppresses ReferenceErrors and push failures | CONFIRMED DEFECT | P1 | `index.html:10762-10776` | Code | Whitelist too broad | `index.html` | `initProductionErrorHandlers` | unhandledrejection → swallow | N/A | Hidden failures | Medium | Medium | No test for suppression | Remove ReferenceError from benign; log all operational failures | `index.html` | injection test | DevTools sweep | Yes | Optional | No | — | 7 |
| DEF-007 | Errors | `isBenignSyncError` + empty msg = benign | CONFIRMED DEFECT | P1 | `cloud/sync-engine.js:39-48` | Code | `if (!msg) return true` | `sync-engine.js` | `isBenignSyncError` | sync error handling | N/A | Silent sync failure | Medium | Low | Sync tests mock success | Never treat empty as benign | `sync-engine.js` | error classification test | Sync journey | Yes | Yes | Yes | DEF-006 | 7 |
| DEF-008 | Errors | 100+ empty catch in production paths | CONFIRMED RISK | P1 | `boot-flow-ui.js`, `cupping-sqlite-bridge.js`, `sync-engine.js` | Widespread | Defensive overuse | multiple | `catch {}` | various | various | Silent partial failure | Medium | Low | Tests don't assert logging | Replace with structured log + user-visible status | cloud/*, bridge | lint rule + spot fixes | A–E sweep | Yes | Optional | No | DEF-006 | 7 |
| DEF-009 | Conflicts | Dual conflict store LS + SQLite non-blocking mirror | CONFIRMED RISK | P1 | `cloud/conflict-queue.js:89-115` | Code | `.catch(()=>{})` on mirror | `conflict-queue.js` | `mirrorOpenToSqlite` | UI queue → optional SQLite | LS vs sync_conflicts | Lost conflicts | **HIGH** | Low | Unit tests single store | SQLite canonical; LS derived read-only | `conflict-queue.js` | mirror-fail test | Conflict A/B | Yes | Yes | Yes | DEF-002 | 9 |
| DEF-010 | Attachments | Manifest vs `attachments_meta` table drift | CONFIRMED RISK | P1 | `attachment-lifecycle.js:8-38`, `table-sync-catalog.js:177` | Code | Lifecycle writes manifest only | `attachment-lifecycle.js` | `saveManifest` | file add → manifest | LS manifest vs DB table | Desync attachments | **HIGH** | Medium | No cross-store test | Unify on `attachments_meta` SoT | `attachment-lifecycle.js`, sync catalog | attachment A/B hash | Attachments A/B | Yes | Yes | Yes | DEF-002 | 10 |
| DEF-011 | Setup | Multiple setup writers (BootFlow, SetupStateService, OwnerSetup) | CONFIRMED RISK | P1 | `setup-state-service.js`, `boot-flow-ui.js`, `owner-setup-state.js` | Code | Incremental UX additions | cloud/* | multiple | boot → setup |多个 LS keys | Step mismatch | Medium | Low | Static harness only | Single writer; others read resolver | setup-state-service.js | step consistency test | Setup journey | Yes | Optional | No | DEF-002 | 8 |
| DEF-012 | Restore | 18 restore entry points with different semantics | CONFIRMED RISK | P1 | See section L | Code inventory | Organic growth | multiple | multiple | various | SQLite/LS/JSON | Wrong path chosen | **HIGH** | Medium | Each path tested in isolation | Route map; deprecate JSON/V1 paths | cloud/restore-*.js, index.html | entry-point matrix test | DR scenarios | Yes | Yes | No | DEF-001,002 | 5 |
| DEF-013 | Restore | Backup V2 download/restore lacks AbortSignal | LIKELY DEFECT | P1 | `backup-v2-ipc.js`, `backup-v2-transfer.js` | Code gap | No cancel propagation | `backup-v2-transfer.js` | `copyWithResume` | restore wizard → IPC | N/A | Hang forever | Medium | Low | No hang test | AbortSignal + timeout + UI cancel | backup-v2-* | cancel-mid-restore test | Scenario C | Yes | Yes | No | — | 5 |
| DEF-014 | Security | V5 license HMAC key derivable in client | CONFIRMED DEFECT | P1 | `license/core/license-crypto.js:5-18` | Trivial | Client-side signing material | `license-crypto.js` | `getSigningKey` | activate → HMAC | license store | Forgeable licenses | Low | **HIGH** | V6 tests don't retire V5 | Migrate all to V6; disable V5 issue | license/* | V5 reject test | Activation | Yes | Optional | No | — | 12 |
| DEF-015 | Security | OAuth confidential client secret in embedded config | CONFIRMED RISK | P1 | `cloud-oauth.embedded.json` | Extractable from ASAR | Desktop confidential client pattern | `cloud-oauth-config.js` | load config | OAuth flow | token store | Token theft if binary leaked | Low | **HIGH** | Documented intentional K-05 | PKCE public client OR token exchange server-side | oauth config, main | OAuth security review | Activation | Yes | Yes | No | — | 12 |
| DEF-016 | Security | 206 innerHTML usages in index.html | CONFIRMED RISK | P2 | `index.html` grep count 206 | Code | Legacy UI patterns | `index.html` | various | render | N/A | XSS if untrusted data | Low | Medium | No XSS fuzz tests | Sanitize or textContent migration | index.html | XSS test vectors | Content injection | Yes | No | No | — | 15 |
| DEF-017 | Security | npm audit 6 critical, 19 high vulns | CONFIRMED RISK | P1 | `npm audit` 2026-08-18 | Repro | Dependency tree | package-lock.json | — | — | N/A | Supply chain | Low | **HIGH** | audit not in npm test | Upgrade/replace vulnerable deps | package.json | audit gate in CI | — | No | No | No | — | 13 |
| DEF-018 | Quality | ESLint 120 errors — lint gate broken | CONFIRMED DEFECT | P2 | `_evidence-npm-lint.log` | Repro | jest globals not in eslint config | `tests/local-qr.test.js` | — | CI verify | N/A | Quality drift | None | Low | lint not in npm test gate | Fix eslint config scope | eslint.config.mjs | lint exit 0 | — | No | No | No | — | 15 |
| DEF-019 | Repo | ZIP-only workspace — no real git product history | CONFIRMED DEFECT | P1 | git log 2 commits | Repro | Upload distribution model | repo root | — | — | N/A | Cannot trace regressions | Medium | Low | N/A | Extract to proper git SoT | repo structure | CI on push | — | No | No | No | — | 0 |
| DEF-020 | Architecture | 27k-line monolithic index.html | CONFIRMED RISK | P2 | line count | N/A | Historical structure | index.html | — | — | N/A | Untestable finance logic | Low | Low | Tests import modules not UI | Incremental extraction post-RC | index.html | golden finance tests | — | No | No | No | — | 24 |
| DEF-021 | RBAC | PUBLIC_CHANNELS include backup discovery/download pre-login | CONFIRMED RISK | P2 | `rbac-session.js:36-37` | By design | Boot restore needs metadata | `rbac-session.js` | PUBLIC_CHANNELS | preload → IPC | N/A | Metadata leak | Low | Medium | Documented | Narrow channel payloads; no PII | rbac-session.js | channel audit | Boot flow | Yes | Yes | No | — | 12 |
| DEF-022 | Tests | 106/106 suites mostly static/regex | CONFIRMED RISK | P1 | `tests/run-all.js`, sample baseline tests | Repro | Phase gate design | tests/baseline/* | readFileSync+regex | npm test | N/A | False confidence | **HIGH** | Low | Self-referential | Tier tests: STATIC vs INSTALLED | tests/, CI | production-path tier | — | Yes | Optional | Optional | — | 14 |
| DEF-023 | Packaging | Windows NSIS build not verified in audit env | UNVERIFIED | — | No build run | N/A | Environment | package.json build | — | — | N/A | Unknown | Unknown | Unknown | CI windows job | Build + hash verify | CI | artifact parity | — | Yes | No | No | DEF-019 | 16 |
| DEF-024 | UAT | Device A/B sync not executed | UNVERIFIED / RELEASE VERIFICATION BLOCKER | — | No Windows devices | N/A | Not a code bug until proven | — | — | — | — | Unknown | Unknown | Unknown | Live Scenario A | windows-uat scripts | A/B evidence pack | Yes | Yes | Yes | DEF-002,011 | 19 |
| DEF-025 | UAT | Live Google OAuth + license pull not executed | UNVERIFIED / RELEASE VERIFICATION BLOCKER | — | No live Google | N/A | Verification gap | — | — | — | — | Unknown | Unknown | UNKNOWN | Activation S1/S2 | v2-5-8 uat scripts | Activation journey | Yes | Yes | No | — | 20 |
| DEF-026 | UAT | Scenario C cloud restore runtime not executed | UNVERIFIED / RELEASE VERIFICATION BLOCKER | — | Docs say FAIL; code has fixes | N/A | Prior failure may be fixed | `cloud-data-discovery.js` | `discoverAllSources` | BootFlow restore | — | Unknown | Unknown | Harness only | Retest on installed EXE | restore-wizard | Scenario C script | Yes | Yes | No | DEF-013 | 21 |
| DEF-027 | UAT | Branch isolation not executed live | UNVERIFIED / RELEASE VERIFICATION BLOCKER | — | No multi-branch test | N/A | Verification gap | `branch-context.js` | — | — | branch_id | Unknown | Unknown | Static tests only | Scenario B UAT | branch tests | 2-branch test | Yes | Yes | Yes | DEF-024 | 18 |
| DEF-028 | UAT | All 334 buttons not runtime tested | UNVERIFIED / RELEASE VERIFICATION BLOCKER | — | No GUI session | N/A | Verification gap | index.html | — | — | — | Unknown | — | — | Button matrix UAT | Playwright matrix | Full UI sweep | Yes | Optional | No | DEF-023 | 17 |
| DEF-029 | Performance | No production perf baseline | UNVERIFIED | P3 | v2-5-5 bench not run | N/A | Not measured | scripts/v2-5-5-perf-bench.cjs | — | — | — | UX | None | — | Run bench on EXE | perf scripts | large dataset | Yes | No | No | — | 24 |
| DEF-030 | Sync | JSON legacy restore via `SyncedWrite.restoreFromBackup` still active | CONFIRMED RISK | P1 | `cupping-drive-sync.js:185`, `index.html:18265` | Code path | Pre-SQLite restore path | multiple | `restoreFromBackup` | settings/import | LS/JSON | Wrong format restore | **HIGH** | Low | Backup V2 tests separate | Route to V2 only; JSON import-only | drive-sync, index.html | restore routing test | Restore journeys | Yes | Optional | No | DEF-012 | 5 |

---

## F. Confirmed P0 (4 code-confirmed risks + 0 runtime-proven blocking bugs)

1. **DEF-001** — V1 restore IPC/env bypass (LevelDB over SQLite)
2. **DEF-002** — Dual persistence authority
3. **DEF-003** — Empty payload sync push
4. **DEF-004** — localRev=0 overwrite without conflict

*Note: P0 here = confirmed in source. Live Device A/B (DEF-024) is a release blocker but classified UNVERIFIED until executed.*

---

## G. Confirmed P1 (16)

DEF-005 through DEF-015, DEF-017, DEF-019, DEF-022, DEF-030, plus DEF-006/007/008 as confirmed defects.

---

## H. P2/P3 (4)

| ID | Issue |
|----|-------|
| DEF-016 | innerHTML XSS risk surface |
| DEF-018 | ESLint gate broken |
| DEF-020 | Monolithic index.html |
| DEF-021 | Public backup discovery channels |
| DEF-029 | Performance unmeasured (P3) |

---

## I. Unverified Release Blockers (6)

| ID | Blocker |
|----|---------|
| DEF-023 | Package/build parity |
| DEF-024 | Device A/B sync |
| DEF-025 | Google OAuth + activation |
| DEF-026 | Scenario C cloud restore |
| DEF-027 | Branch isolation |
| DEF-028 | Full UI/button matrix |

---

## J. State Authority Matrix

| Domain | Authoritative Store | Writer | Reader | Mirrors | Legacy | Conflict? |
|--------|---------------------|--------|--------|---------|--------|-----------|
| Patients (clients) | SQLite `clients` | SqliteBridge→db IPC | Repository→LS cache | localStorage `clientsRegistry` | LS direct writes | **YES** |
| Sessions (visits/cases) | SQLite `visits` | SqliteBridge | Repository→LS | LS `cases` | index.html direct | **YES** |
| Appointments | SQLite `appointments` | SqliteBridge | Repository→LS | LS `bookings` | — | **YES** |
| Payments (cash/card in visit) | SQLite visit fields | saveVisit | reports | LS mirror | — | **YES** |
| Invoices | SQLite `invoices` | SqliteBridge | invoices page | LS | — | **YES** |
| Inventory | SQLite + KV | SqliteBridge | Repository | LS keys | — | **YES** |
| Employees/doctors | SQLite/KV | SqliteBridge | Repository | LS `doctors` | — | **YES** |
| Users | SQLite `users` + KV | SqliteBridge | RBAC | LS `users` | — | **YES** |
| Owner profile | KV + cloud | owner-* modules | Owner Hub | LS flags | — | PARTIAL |
| Organization | center-id + meta | CenterId | cloud ops | LS `__tdw_meta__` | — | PARTIAL |
| Branch | branch-context + DB branch_id | BranchScope | sync/UI | device lock | — | UNVERIFIED |
| Device | `device_registry_local` + Drive | device-registry | Owner Hub | device-cache | — | PARTIAL |
| License | localStorage `commercial_license_*` | license-store | license-router | Drive copy | V5+V6 | **YES** |
| Google connection | token-store (main) | OAuth | Drive adapter | renderer status cache | — | PARTIAL |
| Setup state | setup-state-service LS keys | SetupStateService | BootFlow UI | boot wizard LS | multiple wizards | **YES** |
| Activation | license-store + BootFlow | boot-flow-ui | gates | — | — | **YES** |
| Sync metadata | `sync_meta` table | sync-engine | peer-sync | Drive remote | — | OK |
| Conflicts | `sync_conflicts` + LS queue | conflict-queue | conflict UI | non-blocking mirror | — | **YES** |
| Attachments | LS manifest + `attachments_meta` | attachment-lifecycle | sync | KV mirror | — | **YES** |
| Backup metadata | Backup V2 manifest file | backup-v2-core | restore wizard | cloud file meta | V1 list | **YES** |
| Restore state | restore-staging/reconcile LS | RestoreReconciliation | BootFlow | — | — | PARTIAL |
| Preferences/settings | SQLite KV + settings table | SqliteBridge | UI | LS `settings` | — | **YES** |

**SQLite vs localStorage compete on:** all operational entities, conflicts, attachments, license, setup.

---

## K. Data Integrity

| Check | Result |
|-------|--------|
| Single write path | **FAIL** — dual write |
| Restart consistency | **UNVERIFIED** |
| No duplicate IDs on sync | **UNVERIFIED** — DEF-004 risk |
| No empty-remote overwrite | **FAIL** — DEF-003, DEF-004 |
| Restore reconcile-before-push | **SOURCE_CONFIRMED** (`restore-reconciliation.js`) — live UNVERIFIED |
| Backup round-trip | **PARTIAL** — unit PASS |
| Migration idempotency | **SOURCE_CONFIRMED** — IF NOT EXISTS |
| Financial calc preservation | **SOURCE_CONFIRMED** — not re-verified runtime |

---

## L. Backup / Restore

### Inventory

| Implementation | Entry | Classification | Action |
|----------------|-------|----------------|--------|
| **Backup V1** (LevelDB) | UI hidden; IPC `backup:restoreDbBackup` | **DANGEROUS** (gated) | **DISABLE** IPC entirely |
| **Backup V2** (SQLite encrypted) | Settings, `backup:v2:*` IPC | **ACTIVE** | **KEEP + REPAIR** (abort/timeout) |
| **Cloud DB backup** (V1 upload) | gated same as V1 | **DANGEROUS** | **DISABLE** |
| **Cloud V2 daily JSON** | sync-engine push | **ACTIVE** | **KEEP** |
| **JSON backup import** | `importData`, `SyncedWrite.restoreFromBackup` | **COMPATIBILITY** | **CONVERT TO MIGRATION ONLY** |
| **BootFlow cloud restore** | `cloud-data-discovery.js` | **ACTIVE** | **REPAIR** + UAT |
| **Restore wizard** | `restore-wizard.js` | **ACTIVE** | **KEEP** |
| **Restore staging** | `restore-staging.js` | **ACTIVE** | **KEEP** |
| **License registry restore** | developer-panel | **DEAD** (dev only) | **KEEP** dev-only |
| **Import studio undo** | import-studio-engine | **ACTIVE** | **REPAIR** scope |

### V2 Restore Chain (primary)

```
UI (runBackupV2Restore*) → preload api.v2Restore → backup-v2-ipc.js
  → backup-v2-core.restoreBackupFile → decrypt → validate manifest
  → DB swap → hydrate → RestoreReconciliation → UI
```

**Gap:** No AbortSignal on download (DEF-013).

---

## M. Sync

| Scenario | Risk | Evidence |
|----------|------|----------|
| Push empty table | **DATA LOSS** | DEF-003 |
| Pull at localRev=0 | **DATA LOSS** | DEF-004 |
| Legacy import concat | **DATA LOSS** | DEF-005 |
| Offline queue | Mitigated | outbox persists |
| Tombstones | SOURCE_CONFIRMED | merge policies |
| Branch scope on poll | SOURCE_CONFIRMED | `getSyncBranchScope()` |
| Cross-branch push | UNVERIFIED | needs live test |
| Attachment sync | **RISK** | DEF-010 |
| Post-restore push | Mitigated | RestoreReconciliation block |

---

## N. Branch/Organization Isolation

- **Code:** `branch_id` on records, `BranchScope`, `DeviceConfig.isBranchLocked()`, `shouldSyncBranch()`
- **Enforcement:** App-layer queries + sync scope — no DB RLS
- **Live test:** **UNVERIFIED** (DEF-027)
- **UI-only hiding:** Not relied upon; IPC is authoritative for mutations

---

## O. Setup/Activation

| Surface | Status |
|---------|--------|
| BootFlow (`boot-flow-ui.js`) | **ACTIVE** — primary |
| SetupStateService | **ACTIVE** — resolver |
| CenterSetup | **COMPATIBILITY** |
| First-run tour | **ACTIVE** — non-blocking |
| Owner setup | **ACTIVE** — post-restore |
| Restore wizard in boot | **ACTIVE** |
| License drawer | **ACTIVE** |
| Hidden login Drive panel | **DEAD** (DOM kept, hidden) |

**NEW vs EXISTING:** BootFlow branches on `SetupStateService.getState()` — live consistency **UNVERIFIED**.

---

## P. Owner/RBAC

- **Main IPC:** `rbac-session.js` — authoritative, per-channel minRank
- **Renderer:** `hasPermission()`, `applyRoleUI()` — UX only
- **Authoritative user:** `rbac-guard.js` re-reads role from DB
- **Owner Hub:** phase19-32 tests static only
- **Live bypass test:** UNVERIFIED

---

## Q. Google/Cloud

- **OAuth:** Confidential client, secret in `cloud-oauth.embedded.json` (DEF-015)
- **Drive sync:** sync-engine + Drive adapter
- **Discovery:** `cloud-data-discovery.js` with locks, timeout on discovery
- **Live connect/refresh/disconnect:** UNVERIFIED (DEF-025)

---

## R. Security

| Area | Status |
|------|--------|
| Electron sandbox | **SECURE** (source) |
| IPC validation | **SECURE** (source) |
| CSP | **WEAK** — unsafe-inline |
| OAuth secret in binary | **RISK** — intentional, extractable |
| V5 license | **DEFECT** — client-derived HMAC |
| V6 license | **OK** — verify-only; dev pubkey |
| Ed25519 private key in client | **NOT PRESENT** ✓ |
| innerHTML | **RISK** — 206 uses |
| Dependencies | **RISK** — 6 critical CVEs |
| Path traversal | **MITIGATED** — path-guard.js |

---

## S. Error Truthfulness

### Inventory

| Mechanism | Location | Issue |
|-----------|----------|-------|
| `isBenignCloudErr` | index.html:10762 | Suppresses ReferenceErrors |
| `isBenignSyncError` | sync-engine.js:44 | Empty msg benign |
| `BENIGN_SYNC_ERRORS` set | sync-engine.js:39 | push_failed benign at UI layer |
| Empty catch | 100+ locations | Swallowed exceptions |
| IPC soft deny | ipc-validate.js | Returns `{ok:false}` not throw — OK |

### Proposed Error Architecture (not implemented)

1. **Tier 1 VALIDATION** — form hints, no red
2. **Tier 2 OPERATIONAL** — red + audit ID + retry action
3. **Tier 3 BENIGN** — offline only, with explicit code enum
4. **Never suppress ReferenceError**
5. **Structured error:** `{ code, message, retryable, auditId, step }`

---

## T. Dead/Legacy/Duplicate Code

| Item | Classification | Action |
|------|----------------|--------|
| Backup V1 full pipeline | SUPERSEDED | DISABLE IPC |
| V1 UI buttons (hidden) | DEAD UI | REMOVE LATER |
| `SyncedWrite.restoreFromBackup` JSON path | COMPATIBILITY | MIGRATION ONLY |
| Login Drive panel DOM | DEAD | REMOVE LATER |
| `operational-layer` legacy import | COMPATIBILITY | BLOCK in prod |
| `*.example.js` in electron/ | DEAD | KEEP out of build |
| tools/license-admin | DEV ONLY | Not in ASAR ✓ |
| docs/ 693 files | DEAD at runtime | Archive |
| Duplicate activation surfaces | DUPLICATE | Consolidate post-RC |
| Feature registry inline + generated | DUPLICATE | Generated = SoT |

**Total dead/duplicate paths: 12+ documented**

---

## U. Test Truthfulness

| Tier | % of npm test | Proves runtime? |
|------|--------------|-----------------|
| REGEX/STATIC | ~55% | NO |
| UNIT (node vm) | ~25% | PARTIAL |
| INTEGRATION (spawn) | ~15% | PARTIAL |
| PRODUCTION-PATH | 0% in npm test | NO |
| INSTALLED (windows-uat/) | Exists, not run | YES if executed |
| LIVE-INTEGRATION | 0% in audit | NO |

**False confidence:** 106/106 PASS does not mean product works on installed EXE.

### Required test per P0

| Defect | Required proof test |
|--------|---------------------|
| DEF-001 | IPC `backup:restoreDbBackup` returns DISABLED always |
| DEF-002 | kill -9 after write → restart → SQLite equals read |
| DEF-003 | Repository null → push refused |
| DEF-004 | localRev=0 + local rows → conflict not overwrite |

---

## V. UI/Controls

- 22 pages, 334 buttons, 390 handlers — **all UNVERIFIED** runtime
- Backup V1 buttons: present but `display:none; disabled` — **DEAD UI, LIVE IPC**
- Production lock UI: SOURCE_CONFIRMED

---

## W. Reports/Printing/QR/Import/Export

| Feature | Static test | Runtime |
|---------|-------------|---------|
| Tax invoice / QR | verify:tax-invoice PASS | UNVERIFIED |
| Local QR | test-local-qr PASS | UNVERIFIED |
| Thermal/A4 print | devices.js exists | UNVERIFIED |
| Import studio | verify:import-studio PASS | UNVERIFIED |
| Client import | verify:client-import PASS | UNVERIFIED |
| Reports page | — | UNVERIFIED |
| Ledger | verify:ledger PASS | UNVERIFIED |

---

## X. Recommended Fix For Every Defect

| Defect ID | Root Cause | Recommended Fix | Why | What NOT To Do | Precondition | Files | Tests | Risk | Depends On | Must Fix Before |
|-----------|------------|-----------------|-----|----------------|--------------|-------|-------|------|------------|-----------------|
| DEF-001 | V1 IPC not removed | Hard-disable `backup:restoreDbBackup` always | Prevents LevelDB wipe | Don't delete V1 code yet | Baseline frozen | main.js, backup-v1-gate.js | IPC test | Med | — | V2 DR proof |
| DEF-002 | Hybrid persistence | SQLite-only read; LS mirror write-after-commit | Single truth | Don't delete LS until migration done | sqlitePrimary=true | sqlite-bridge, repository | persistence test | **CRIT** | — | Sync, backup |
| DEF-003 | Null→[] push | Guard: refuse null/empty push | Prevents remote wipe | Don't disable sync entirely | DEF-002 | sync-engine.js | unit | High | DEF-002 | Device A/B |
| DEF-004 | localRev=0 gap | Conflict if local rows exist at rev 0 | Prevents silent overwrite | Don't block legitimate fresh install | DEF-002 | peer-sync-engine.js | unit | High | DEF-002 | Device A/B |
| DEF-005 | Legacy import path | Throw if RecordMerger missing in prod | Blocks bad merge | Don't remove import feature | — | operational-layer.js | unit | Med | — | Sync |
| DEF-006 | Broad benign filter | Remove ReferenceError from whitelist | Surfaces real bugs | Don't remove offline codes | — | index.html | test | Low | — | UAT sweep |
| DEF-007 | Empty=benign sync | Require explicit error code | Truthful errors | — | DEF-006 | sync-engine.js | unit | Low | DEF-006 | — |
| DEF-008 | Empty catches | Log + surface status | Debuggability | Don't blanket try/catch | — | cloud/* | lint | Med | DEF-006 | UAT |
| DEF-009 | Dual conflict store | SQLite canonical; LS read-only view | One authority | Don't delete LS until UI migrated | DEF-002 | conflict-queue.js | integration | Med | DEF-002 | Sync |
| DEF-010 | Attachment triple store | Write `attachments_meta` table | Sync integrity | — | DEF-002 | attachment-lifecycle.js | A/B | Med | DEF-002 | Attachments UAT |
| DEF-011 | Multi setup writers | Route all writes through SetupStateService | Step consistency | Don't merge wizards blindly | — | setup-state-service.js | UI test | Med | — | Activation UAT |
| DEF-012 | 18 restore paths | Deprecation map; route to V2 | Clarity | Don't delete JSON import yet | DEF-001 | restore-*.js | matrix | High | DEF-001,002 | DR UAT |
| DEF-013 | No abort on restore | AbortSignal + timeout | Cancel hang | — | — | backup-v2-* | cancel test | Med | — | Scenario C |
| DEF-014 | V5 client HMAC | V6-only activation | Real crypto | Don't break existing V5 customers without migration | V6 migration tool | license/* | migration | High | — | Commercial |
| DEF-015 | OAuth secret in binary | PKCE public client or backend exchange | Reduce secret exposure | Don't break existing Google projects without plan | Google console | oauth config | OAuth test | Med | — | Activation |
| DEF-016 | innerHTML | Sanitize untrusted | XSS | Don't rewrite entire UI | — | index.html | fuzz | Low | — | Post-RC |
| DEF-017 | Dependency CVEs | npm audit fix | Supply chain | Don't break native modules | — | package.json | audit CI | Med | — | Release |
| DEF-018 | ESLint broken | Fix config for test globals | Quality gate | — | — | eslint.config.mjs | lint | Low | — | — |
| DEF-019 | ZIP repo | Proper git SoT | Traceability | — | — | repo | CI | Low | — | Everything |
| DEF-030 | JSON restore path | Route to V2; JSON import-only | Format safety | — | DEF-012 | drive-sync, index.html | routing | Med | DEF-012 | DR |

---

## Y. FIX DEPENDENCY GRAPH

```
Phase 0: Freeze baseline + proper git repo (DEF-019)
    ↓
Phase 1: Disable Backup V1 IPC entirely (DEF-001) — safe, no migration
    ↓
Phase 2: State authority — SQLite read path (DEF-002) ← CRITICAL FOUNDATION
    ↓
    ├─→ Phase 3: Error truthfulness (DEF-006,007,008) — before UAT or errors hidden
    ├─→ Phase 4: Conflict authority (DEF-009)
    ├─→ Phase 5: Attachment authority (DEF-010)
    ├─→ Phase 6: Sync guards (DEF-003,004,005)
    ├─→ Phase 7: Restore path consolidation (DEF-012,013,030)
    └─→ Phase 8: Setup authority (DEF-011)
            ↓
Phase 9: Windows build + SHA (DEF-023)
    ↓
Phase 10: Installed UI smoke (DEF-028)
    ↓
Phase 11: Branch isolation UAT (DEF-027)
    ↓
Phase 12: Device A/B sync UAT (DEF-024) — requires Phase 2+6
    ↓
Phase 13: Google/Activation UAT (DEF-025)
    ↓
Phase 14: Scenario C DR UAT (DEF-026) — requires Phase 7
    ↓
Phase 15: License V6 migration (DEF-014)
    ↓
Phase 16: OAuth architecture (DEF-015)
    ↓
Phase 17: Dependencies (DEF-017)
    ↓
Phase 18: Test tier reform (DEF-022)
    ↓
Phase 19: Lint + quality (DEF-018)
    ↓
Phase 20: Performance (DEF-029)
    ↓
Phase 21: Monolith extraction (DEF-020) — POST-RC only
```

### Conflict warnings

| If fixed before | Problem |
|-----------------|---------|
| Sync before state authority | Masks dual-write bugs; tests pass on wrong store |
| UAT before error truthfulness | Hidden errors invalidate UAT evidence |
| Remove LS before SQLite read path | Data loss on boot |
| Disable V1 after no V2 DR proof | Operators stranded |
| V6-only before customer migration | Activation breaks existing licenses |

---

## Z. FINAL ORDERED REMEDIATION PLAN

### Phase 0 — Freeze Baseline
- **Objective:** Immutable audit point + proper git repo
- **Defects:** DEF-019
- **Why now:** Cannot remediate safely from ZIP-only repo
- **Work:** Extract product to `Tadawi-Clinic-Production`; tag `audit-baseline-2026-08-18`
- **Tests:** CI triggers on push
- **UAT:** None
- **Exit gate:** Full git history; CI green on `npm test`
- **Rollback risk:** LOW

### Phase 1 — Disable Backup V1 IPC
- **Objective:** Eliminate LevelDB restore foot-gun
- **Defects:** DEF-001
- **Prerequisites:** Phase 0
- **Work:** `backup:restoreDbBackup` always returns `BACKUP_V1_DISABLED`; remove env bypass or support-only build flag
- **Tests:** IPC integration test
- **UAT:** Settings — no V1 restore path
- **Exit gate:** IPC cannot mutate LevelDB
- **Rollback risk:** LOW

### Phase 2 — SQLite Read Authority
- **Objective:** Single source of truth on boot and read
- **Defects:** DEF-002
- **Prerequisites:** Phase 0
- **Work:** Repository reads from SQLite hydrate; no LS read for operational entities
- **Tests:** write→kill→restart→read property test
- **UAT:** Daily ops journey
- **Exit gate:** Grep shows no operational `localStorage.getItem` on boot path
- **Rollback risk:** **CRITICAL** — feature flag `sqlitePrimary`

### Phase 3 — Error Truthfulness
- **Objective:** Stop hiding real failures
- **Defects:** DEF-006, DEF-007, DEF-008
- **Prerequisites:** Phase 2
- **Work:** Fix benign whitelists; add structured logging
- **Tests:** ReferenceError surfaces; push_failed not benign
- **UAT:** DevTools zero unhandled on smoke
- **Exit gate:** No ReferenceError in benign list
- **Rollback risk:** LOW

### Phase 4 — Conflict Authority
- **Defects:** DEF-009 | **Prerequisites:** Phase 2
- **Exit gate:** Conflict mirror failure fails loudly

### Phase 5 — Attachment Authority
- **Defects:** DEF-010 | **Prerequisites:** Phase 2
- **Exit gate:** `attachments_meta` written on every attachment op

### Phase 6 — Sync Correctness Guards
- **Defects:** DEF-003, DEF-004, DEF-005
- **Prerequisites:** Phase 2
- **Exit gate:** Unit tests for null-push, rev-0 conflict, legacy import block

### Phase 7 — Restore Path Consolidation
- **Defects:** DEF-012, DEF-013, DEF-030
- **Prerequisites:** Phase 1, 2
- **Exit gate:** All restore routes go through V2 or import-migration; AbortSignal on download

### Phase 8 — Setup Authority
- **Defects:** DEF-011
- **Prerequisites:** Phase 2
- **Exit gate:** Single setup writer; step header/body consistent in harness

### Phase 9 — Windows Build Parity
- **Defects:** DEF-023
- **Prerequisites:** Phase 0–8 merged
- **External:** windows-2022 CI
- **Exit gate:** NSIS artifact SHA matches published

### Phase 10 — Installed UI Smoke
- **Defects:** DEF-028
- **Prerequisites:** Phase 9
- **External:** Windows 10/11
- **Exit gate:** Playwright smoke — startup, login, navigate all 22 pages

### Phase 11 — Branch Isolation UAT
- **Defects:** DEF-027
- **Prerequisites:** Phase 6, 10
- **External:** 2 branches configured
- **Exit gate:** 0 cross-branch reads

### Phase 12 — Device A/B Sync UAT
- **Defects:** DEF-024
- **Prerequisites:** Phase 6, 11
- **External:** 2 Windows devices, Google Drive
- **Exit gate:** `v2-5-10:validate-ae` exit 0

### Phase 13 — Google Activation UAT
- **Defects:** DEF-025
- **Prerequisites:** Phase 9
- **External:** Real Google account
- **Exit gate:** OAuth→license pull→restart PASS

### Phase 14 — Scenario C DR UAT
- **Defects:** DEF-026
- **Prerequisites:** Phase 7, 9
- **Exit gate:** Cloud restore full journey on populated DB

### Phase 15 — License V6 Migration
- **Defects:** DEF-014
- **Exit gate:** New activations V6-only; V5 migrate tool tested

### Phase 16 — OAuth Architecture Hardening
- **Defects:** DEF-015
- **Exit gate:** Security review sign-off

### Phase 17 — Dependency Security
- **Defects:** DEF-017
- **Exit gate:** 0 critical npm audit

### Phase 18 — Test Tier Reform
- **Defects:** DEF-022
- **Exit gate:** Release gate requires INSTALLED tier PASS

### Phase 19 — Lint Gate
- **Defects:** DEF-018
- **Exit gate:** `npm run lint` exit 0

### Phase 20 — Performance Baseline
- **Defects:** DEF-029
- **Exit gate:** v2-5-5 bench within SLO

### Phase 21 — Commercial Release Gate
- **Objective:** Production Candidate
- **Exit gate:** See section "Release Candidate Definition" below

---

## Release Candidate Definition (Sellable Gate)

| Criterion | Required |
|-----------|----------|
| Confirmed P0 | **0** |
| Release-blocking P1 | **0** |
| Deterministic state authority | SQLite sole ops SoT |
| Data integrity | PASS on installed tests |
| Branch isolation | PASS Scenario B |
| Device A/B sync | PASS Scenario A |
| Backup/Restore | PASS Scenario C + V2 round-trip |
| Restart/recovery | PASS kill-mid-op tests |
| Setup/activation | PASS BootFlow NEW+EXISTING |
| Owner/RBAC | PASS owner-rbac-runtime |
| Google/Drive | PASS if cloud required |
| Installed Windows | PASS full button matrix |
| Package/source parity | SHA verified |
| Reports/printing/QR | PASS sample journeys |
| Import/export | PASS verify scripts on EXE |
| Hidden runtime errors | 0 on A–E journeys |
| No success+error contradiction | PASS |
| No cross-branch leakage | PASS |
| No empty-local overwrite | PASS sync guards |
| Security blockers | Resolved |

---

## Known Findings Re-Verification (F-01 – F-20)

| ID | Verdict | Evidence |
|----|---------|----------|
| F-01 Backup V1 coexisting | **PARTIALLY TRUE** | UI **disabled** (`BACKUP_V1_CUSTOMER_UI_DISABLED=true`); main gate default off; **IPC still exists** with `HIJAMA_ALLOW_BACKUP_V1=1` bypass → CONFIRMED RISK not fully fixed |
| F-02 SQLite/LS dual authority | **CONFIRMED** | `cupping-sqlite-bridge.js` explicit dual-write; Repository reads LS |
| F-03 Scenario C cloud restore | **UNVERIFIED** | Docs say FAIL; code has discovery locks/timeouts; **not re-run on EXE** |
| F-04 isBenignCloudErr | **CONFIRMED** | `index.html:10762-10776` |
| F-05 Multiple setup authorities | **CONFIRMED** | 4+ LS stores + 3 wizards |
| F-06 Multiple conflict stores | **CONFIRMED** | LS queue + `sync_conflicts` non-blocking mirror |
| F-07 Duplicate attachment metadata | **CONFIRMED** | manifest + `attachments_meta` catalog drift |
| F-08 Lint gate problems | **CONFIRMED** | 120 ESLint errors |
| F-09 Dependency vulnerabilities | **CONFIRMED** | 6 critical, 19 high |
| F-10 OAuth desktop secret | **CONFIRMED RISK** | Confidential client secret in embedded JSON — intentional per K-05; extractable from binary; not auto-P0 but release security concern |
| F-11 V5/V6 licensing | **CONFIRMED** | V5 client HMAC weak; V6 verify OK; dev private key in tools/ only |
| F-12 Multi-device sync | **UNVERIFIED** | No code bug proven; release blocker |
| F-13 Branch isolation | **UNVERIFIED** | Scope code exists; no live test |
| F-14 Google/license activation | **UNVERIFIED** | No live test |
| F-15 Windows installed acceptance | **UNVERIFIED** | No EXE test in audit |
| F-16 Source/package parity | **UNVERIFIED** | No Windows build run |
| F-17 UI/control runtime | **UNVERIFIED** | No GUI session |
| F-18 Monolithic index.html | **CONFIRMED RISK** | 27,278 lines — tech debt not functional bug |
| F-19 Multiple activation UX | **CONFIRMED** | 5+ surfaces |
| F-20 Performance | **UNVERIFIED** | Bench not executed |

---

## FINAL SUMMARY

```
TOTAL CONFIRMED P0:        4  (code-confirmed risks)
TOTAL CONFIRMED P1:       16
TOTAL P2:                  4
TOTAL P3:                  1
TOTAL UNVERIFIED RELEASE BLOCKERS: 6
TOTAL DEAD/DUPLICATE PATHS: 12+
```

### FIRST DEFECT TO FIX:
**DEF-019 (Phase 0) — Normalize repository baseline from ZIP to proper git SoT**

### WHY IT MUST BE FIRST:
Without real git history and CI on the actual source tree, every subsequent fix lacks traceability, rollback, and package parity proof. All other fixes applied to an extracted copy risk being lost or unverifiable.

### RECOMMENDED NEXT ACTION:
1. Approve this report  
2. Execute Phase 0 (git normalization)  
3. Execute Phase 1 (disable V1 IPC) as first code change  
4. Schedule Windows operator for Phases 10–14 UAT **in parallel** with Phases 2–8 engineering  

### READY TO BEGIN REMEDIATION: **NO** — awaiting your explicit approval

---

*End of report. No product code was modified during this audit.*
