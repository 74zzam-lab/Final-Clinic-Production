# 10 — Database Schema Matrix

**Engine:** SQLite 3 via better-sqlite3  
**Migrations:** `001_initial` (schema v4), `002_sync_platform` (schema v5)

## Core Tables (001_initial)

| Table | PK | Tenant/Org | Branch | Device | FK | Sync | Backup |
|-------|-----|------------|--------|--------|-----|------|--------|
| schema_migrations | id | — | — | — | — | No | Yes |
| meta | key | org via keys | — | — | — | Partial | Yes |
| kv_store | key | — | — | — | — | Selective | Yes |
| clients | id | center | branch_id | — | — | Yes | Yes |
| visits | id | center | branch_id | — | client_id | Yes | Yes |
| visit_cups | id | — | — | — | visit_id CASCADE | Yes | Yes |
| invoices | id | center | branch_id | — | visit_id | Yes | Yes |
| appointments | id | center | branch_id | — | client_id | Yes | Yes |
| employees | id | org | branch_id | — | — | Yes | Yes |
| attendance | id | org | branch_id | — | employee | Yes | Yes |
| payroll_* | id | org | branch | — | employee | Yes | Yes |
| users | id | org | — | — | role | Yes | Yes |
| roles | id | org | — | — | — | Yes | Yes |
| permissions | id | org | — | — | role | Yes | Yes |
| settings | key | org/branch | branch_id | — | — | Yes | Yes |
| attachments | id | org | branch_id | — | — | Yes | Yes |
| audit_events | id | org | branch_id | — | — | Partial | Yes |

*Full column defs in `database/migrations/001_initial.js`*

## Sync Tables (002_sync_platform)

| Table | PK | Purpose | Writers | Readers |
|-------|-----|---------|---------|---------|
| sync_outbox | id | Pending push ops | sync engine, outbox bridge | peer-sync-engine |
| sync_inbox_applied | id | Applied remote ops | sync engine | conflict detection |
| sync_conflicts | id | Conflict records | sync engine | conflict-manager-ui |
| sync_meta | key | Cursors, revs | sync engine | sync-engine |
| device_registry_local | device_id | Local device record | devices.js | Owner Hub |
| sync_audit | id | Sync diagnostics | sync engine | logs |

## Indexes / Constraints

- `PRAGMA foreign_keys = ON`
- `visits.total >= 0` CHECK
- `revision` column on major entities for CAS
- Unique constraints on file_no, user names per migration SQL

## Writers / Repositories

- `database/repositories/index.js` — repository pattern
- `electron/database/service.js` — IPC-facing DB service
- `cupping-sqlite-bridge.js` — renderer write-through
- `cloud/sqlite-outbox-bridge.js` — sync enqueue

## Migration Reachability

| Migration | Reachable | Idempotent |
|-----------|-----------|------------|
| 001_initial | Fresh install + upgrade | Yes (IF NOT EXISTS) |
| 002_sync_platform | After 001 | Yes |
| JSON→SQLite CLI | `npm run db:migrate:file` | Manual |
| Legacy LevelDB | Backup V1 only | **Separate store — risk** |

## Legacy Storage Competition

| Store | Status |
|-------|--------|
| SQLite | Intended SoT |
| localStorage | Active mirror — **competes** |
| LevelDB (Backup V1) | Legacy snapshot — **competes on restore** |

## Migration Tests

- `test-phase4-sqlite.js` — PASS (static/functional unit)
- `v2-5-7:migration` harness — SOURCE_CONFIRMED
- Corrupt DB / partial migration / restart-during-migration — **UNVERIFIED**
