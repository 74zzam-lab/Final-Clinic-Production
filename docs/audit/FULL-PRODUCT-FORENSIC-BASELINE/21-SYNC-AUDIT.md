# 21 — Sync Audit

## Architecture

```
LOCAL COMMIT → sync_outbox → sync-engine → Drive write → remote read → cursor update → inbox apply → ACK
```

## Model

- Record-level sync with `revision` CAS
- Per-table merge policies (`table-merge-policy.js`)
- Tombstones for deletes
- Conflict queue: SQLite + localStorage duplicate

## Guards (V2-5.9)

- No optimistic operational cache for core tables
- Restore reconcile-before-push
- Branch context split
- Legacy migration push block

## Multi-Device

RB-01: Device A/B never proven on Setup EXE — **P0 UNVERIFIED**

## Offline / Reconnect

Outbox persists — unit tests PASS. Live offline edit conflict — **UNVERIFIED**.

## Data Loss Risk

Any path overwriting valid remote with empty/stale local = **P0**.  
Code has guards; **runtime UNVERIFIED**.

## Tests

- `v2-4:outbox-dual-device` — PASS (simulated unit)
- `v2-4:conflict-resolution` — PASS (unit)

## Result

**SYNC: UNVERIFIED (FAIL for release)**
