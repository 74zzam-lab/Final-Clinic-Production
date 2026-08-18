# 19 — Backup Audit

## Paths

| System | Entry | Format | Status |
|--------|-------|--------|--------|
| Backup V2 | `backup-v2-core.js` | Encrypted SQLite snapshot + manifest | SOURCE_CONFIRMED |
| Backup V1 | `electron/backup.js` | LevelDB snapshot | **LEGACY — RISK** |
| Cloud JSON | `cloud/backup-layer.js` | Daily JSON layer | SOURCE_CONFIRMED |
| Scheduler | `backup-v2-scheduler.js` | Auto upload | SOURCE_CONFIRMED |

## V2 Flow

```
trigger → serialize DB → manifest → encrypt (backup-crypto-v2) → file → verify → optional cloud upload
```

## Scope

- Org + branch metadata in manifest (phase35 test PASS)
- Credentials excluded from plaintext
- Password handling via user-provided encryption password

## Tests

- `test-phase7-backup.js` — PASS
- `hybrid:backup-v2` — PASS
- `v2-5-1:backup-restore-v2` — PASS

## Result

**BACKUP V2: PARTIAL** (unit PASS, installed UNVERIFIED)  
**BACKUP V1: BROKEN RISK** if used for DR
