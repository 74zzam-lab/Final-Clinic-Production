# 37 — Historical Regression Matrix

## Repo History

Workspace repo: **single commit** (zip upload) — no git history for regression analysis.

## Product History (from docs)

| Area | Old Behavior | Current | Change | Impact |
|------|--------------|---------|--------|--------|
| Storage | localStorage only | SQLite+dual | Phase 4 migration | Data authority split |
| Backup | V1 only | V1+V2 | V2 added, V1 not removed | DR confusion |
| License | V5 HMAC | V5+V6 | V6 added | Compatibility window |
| Setup | Multiple arrays | setup-state-service | V2-5.10 fix | UNVERIFIED live |
| Cloud restore | FAIL discovery | Fix claimed | SYNC-UX doc | Needs retest |
| Test count | 97 | 106 | More gates | False confidence ↑ |

## Cross-Repo

Documented SoT migrated from `Cupping-System-Management` → `Tadawi-Clinic-Production` → workspace is `74zzam-lab/Final-Clinic-Production` (zip only).

**No blind porting recommended** — verify compatibility per change.
