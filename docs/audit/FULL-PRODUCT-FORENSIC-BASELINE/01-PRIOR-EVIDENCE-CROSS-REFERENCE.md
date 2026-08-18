# 01 — Prior Evidence Cross-Reference

Prior documents found **inside extracted product** at `docs/`. Workspace repo has no prior audits.

## Summary Table

| OLD CLAIM | SOURCE | DATE | OLD STATUS | CURRENT SOURCE | CURRENT RUNTIME | STILL VALID? | COMMENTS |
|-----------|--------|------|------------|----------------|-----------------|--------------|----------|
| Production Candidate NO until A–E on Installed EXE | `docs/integration-v2-5-10/CURRENT-STATUS.md` | 2026-08-03 | FAIL | **CONFIRMED** — PRODUCTION LOCK active | **UNVERIFIED** — no Windows EXE in audit env | **YES** | Canonical status unchanged |
| 0/40 requirements PASS | `CURRENT-STATUS.md`, `final-review/00-EXECUTIVE-SUMMARY.md` | 2026-08-01–03 | 0 PASS | **CONFIRMED** — no contradicting code | **UNVERIFIED** live | **YES** | Live operator proof still missing |
| Baseline score 58/100 | README, executive summary | 2026-08-01 | 58 | **CONFIRMED** — docs say do not inflate | N/A | **YES** | Independent re-score not done |
| 97/97 (now 106/106) automated tests PASS | `final-review`, `npm test` | 2026-08-01 | PASS | **CONFIRMED** — 106/106 on Linux Node 22 | **SOURCE_CONFIRMED** only | **PARTIAL** | Tests are mostly static/regex; not production-path |
| Electron security baseline real | `final-review` | 2026-08-01 | PASS | **SOURCE_CONFIRMED** — sandbox, IPC validation, RBAC session | **UNVERIFIED** installed | **PARTIAL** | Code present; runtime not exercised on EXE |
| Dual persistence SQLite + localStorage | `KNOWN-ISSUES.md` K-10, executive summary | Phase 4+ | PARTIAL | **CONFIRMED** — `license-store.js`, SqliteBridge, mirror paths | **UNVERIFIED** | **YES** | Competing authorities remain |
| Three backup systems (V1 LevelDB, V2 SQLite, Cloud JSON) | `final-review`, K docs | 2026-08-01 | OVERBUILT | **CONFIRMED** — `backup.js`, `backup-v2-*`, `cloud-db-backup.js` | **UNVERIFIED** DR | **YES** | RB-04 still open |
| OAuth secret committed by owner request | `KNOWN-ISSUES.md` K-05 | Phase 5 | HIGH | **SOURCE_CONFIRMED** — `cloud-oauth.embedded.json` exists | **UNVERIFIED** live OAuth | **YES** | Security risk for private repo automation |
| V6 Ed25519 added; V5 HMAC remains | K-06 | Phase 3 | PARTIAL | **CONFIRMED** — both codecs present | **SOURCE_CONFIRMED** | **YES** | Client HMAC signing key derived in renderer |
| Scenario C cloud restore FAIL until retest | `CURRENT-STATUS.md` | 2026-08-03 | FAIL | Code fixes referenced in SYNC-UX doc | **UNVERIFIED** | **LIKELY YES** | Needs installed EXE retest |
| SetupState SoT implemented | `CURRENT-STATUS.md` | 2026-08-03 | IMPLEMENTED | **SOURCE_CONFIRMED** — `setup-state-service.js` | **UNVERIFIED** Device A/B | **PARTIAL** | Engineering landed; live journey not proven |
| Category B offline engineering COMPLETE | `CURRENT-STATUS.md` | 2026-08-03 | COMPLETE | **SOURCE_CONFIRMED** | N/A | **YES** | Offline code paths exist |
| Release blockers RB-01..RB-09 open | `final-review/03-RELEASE-BLOCKERS.md` | 2026-08-01 | OPEN | **CONFIRMED** — no closure evidence | **UNVERIFIED** | **YES** | None closed in this baseline |
| ESLint Phase-1 scoped | K-20 | Phase 1 | PARTIAL | **FAIL** — 120 lint errors on full run | Ran 2026-08-18 | **UPDATED** | Worse than prior claim |
| ZIP-only distribution on main | K-24 | Phase 1 | Medium | **CONFIRMED** — this workspace IS zip-only | N/A | **YES** | Repo hygiene blocker |

## Stale / Conflicting Prior Claims

| Claim | Conflict | Resolution |
|-------|----------|------------|
| Phase docs showing PASS for individual features | vs 0/40 live requirements | **Trust 0/40 canonical** — phase PASS = engineering gate, not product acceptance |
| README Node 20/22 only vs engines `>=22 <=24` | Version policy drift | **CONFLICT** — Node 24 allowed in package but README warns against it |
| Production SoT = `7uzzam/Tadawi-Clinic-Production` | Workspace = `74zzam-lab/Final-Clinic-Production` | **DIFFERENT REPO** — identity ambiguity; treat zip contents as product baseline |

## Audit Method

No prior PASS status inherited. Each claim re-evaluated against extracted source + `npm test` run on 2026-08-18.
