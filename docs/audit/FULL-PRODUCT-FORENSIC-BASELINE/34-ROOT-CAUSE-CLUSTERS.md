# 34 — Root-Cause Clusters

## RC-01: MULTIPLE STATE AUTHORITIES
**Root cause:** Transitional V2-5 program kept localStorage while adding SQLite SoT.  
**Symptoms:** Stale data, hydrate mismatch, license/ops disagreement.  
**Files:** `index.html`, `cupping-sqlite-bridge.js`, `license-store.js`  
**Data risk:** P0 | **Security:** Medium  
**Minimal repair:** Single read/write path through SQLite; localStorage read-only legacy migration.

## RC-02: LEGACY PATH BYPASS (Backup V1)
**Root cause:** Backup V1 not removed when V2 + SQLite shipped.  
**Symptoms:** Operator restores LevelDB while SQLite is SoT.  
**Files:** `electron/backup.js`, `cupping-cloud-db-backup.js`  
**Data risk:** P0  
**Minimal repair:** Hide/disable V1 UI; hard gate restore to V2 only.

## RC-03: TEST FALSE CONFIDENCE
**Root cause:** 106 static/regex tests labeled as release gates.  
**Symptoms:** CI green while 0/40 live requirements PASS.  
**Files:** `tests/run-all.js`, phase verify scripts  
**Data risk:** High (undetected regressions)  
**Minimal repair:** Mandatory Windows UAT harness in release gate; fail if UNVERIFIED.

## RC-04: UNVERIFIED LIVE INTEGRATIONS
**Root cause:** No Device A/B + Google OAuth proof on installed EXE.  
**Symptoms:** RB-01, RB-02, Scenario C failures.  
**Data risk:** P0 | **Security:** P0  
**Minimal repair:** Execute OPERATOR-LIVE-UAT A→E; fix findings.

## RC-05: ERROR SUPPRESSION (Benign Whitelist)
**Root cause:** `isBenignCloudErr` treats ReferenceErrors as benign.  
**Symptoms:** Silent module load failures; RB-09.  
**Files:** `index.html:10762`  
**Security:** Medium  
**Minimal repair:** Remove ReferenceError from benign list; fix root load order.

## RC-06: DUPLICATE SYNC/ATTACHMENT METADATA
**Root cause:** Parallel manifest systems during V2-4 attachment work.  
**Symptoms:** Attachment desync RB-05.  
**Files:** attachment sync modules  
**Data risk:** P1  
**Minimal repair:** Unify on `attachments_meta` SoT.

## RC-07: REPO / DELIVERY IDENTITY SPLIT
**Root cause:** ZIP-only upload repo vs documented Git SoT.  
**Symptoms:** No git history, wrong remote, cannot CI from workspace.  
**Data risk:** Medium (wrong baseline deployed)  
**Minimal repair:** Extract zip to proper git repo; align remotes.

## RC-08: MONOLITHIC RENDERER
**Root cause:** 27k-line index.html resists testing.  
**Symptoms:** Finance logic untestable; maintainability 48/100.  
**Not blocking pilot if RC-01..06 addressed.**

## RC-09: MULTIPLE ACTIVATION SURFACES
**Root cause:** Incremental cloud/license UX additions.  
**Symptoms:** Cognitive load; stale external state.  
**Minimal repair:** Post-pilot UX consolidation.

## RC-10: PACKAGE/SOURCE UNVERIFIED PARITY
**Root cause:** No local Windows build in audit env.  
**Symptoms:** Cannot prove EXE matches source.  
**Minimal repair:** CI artifact hash verification + operator SHA check.
