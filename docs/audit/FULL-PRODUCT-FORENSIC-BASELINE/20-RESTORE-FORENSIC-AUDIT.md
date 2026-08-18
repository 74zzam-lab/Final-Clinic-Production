# 20 — Restore Forensic Audit

## Entry Points

| Entry | File | Notes |
|-------|------|-------|
| Settings → Backup V2 restore | `backup-v2-ipc.js` | Primary intended path |
| Cloud restore wizard | `cloud/restore-wizard.js` | Scenario C |
| Cloud discovery | `electron/cloud-data-discovery.js` | List restore points |
| **Backup V1 restore** | `cupping-cloud-db-backup.js` | **WRONG SoT — P0** |
| Import/migration | `migration-engine.js` | Separate from DR |

## V2 Restore Chain

```
UI → password → ipc download → decrypt → validate manifest → staging → reconcile → DB swap → hydrate → UI result
```

## Async / Timeout Audit (Source)

| Await | Timeout | Abort | Hang Risk |
|-------|---------|-------|-----------|
| Cloud download | Partial in transfer module | UNVERIFIED | **POSSIBLE** |
| Decrypt | Sync | No | Low |
| DB swap | Main process | UNVERIFIED | Medium |
| Discovery list | Drive API | UNVERIFIED | Medium |

**Full production-path trace on installed EXE: UNVERIFIED**

## Documented Failures

- Scenario C cloud restore: **FAIL** per CURRENT-STATUS.md until retest on discovery-fix EXE
- RB-03: DR reconcile proven in unit only

## Tests

- `v2-5-10:cloud-discovery-restore` — PASS (static/harness)
- `backup-restore-v2.test.js` — PASS (unit)

## Result

**RESTORE: PARTIAL / FAIL for release** (Scenario C, V1 path, live DR unproven)
