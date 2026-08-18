# Phase 1 — SQLite Source of Truth

**Branch:** `cursor/phase-1-sqlite-sot-7c71`  
**Parent:** `cursor/phase-0-git-baseline-7c71`

## Requirement

Operational data (patients, sessions, bookings, invoices path via cases/KV, users, settings, inventory, conflicts, attachments meta) must read from SQLite after boot — not localStorage as authority.

## What changed

| File | Change |
|------|--------|
| `index.html` | `DB.get` delegates operational keys to `SqliteBridge.readOperational` before LS fallback |
| `cupping-sqlite-bridge.js` | Memory SoT (`lastCommitted`), `readOperational`, `bootFromSQLiteSoT` on DOMContentLoaded, expanded operational key set, Electron path blocks stale LS reads |

## Write path (unchanged intent)

SQLite commit → success → localStorage mirror + globals.

## What this branch does NOT do

- Branch SQL isolation (Phase 4)
- Backup encryption removal (Phase 3)
- Sync empty-push guards (Phase 7)

## Operator UAT (required)

1. Save patient → close app → reopen → same data.
2. After login, clear localStorage in DevTools → operational lists still correct from SQLite.
3. Restart after invoice/booking save.

## Verification script (independent)

```bash
node scripts/verify-sqlite-sot-readpath.js
```
