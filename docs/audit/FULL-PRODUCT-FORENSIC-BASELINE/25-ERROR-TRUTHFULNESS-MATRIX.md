# 25 — Error Truthfulness Matrix

## isBenignCloudErr (index.html:10762)

Suppresses:
- ReferenceErrors for `CloudBootstrap`, `SyncEngine`, etc. (`/is not defined$/`)
- Cloud offline patterns (`no_remote_versions`, `drive_not_connected`, etc.)

**Risk:** Real module load failures classified benign → **P1 defect cluster**

## Error Categories

| Type | Should Show Red? | Current Behavior |
|------|------------------|------------------|
| REQUIRED field | No | Validation UI |
| VALIDATION | No | Form hints |
| OPERATIONAL failure | Yes | Variable — may be suppressed |
| PENDING sync | No | Status indicators |
| CANCELLED | No | UNVERIFIED |

## Patterns Found

- `initProductionErrorHandlers` — filters unhandledrejection/error
- Empty catches in cloud modules — sweep UNVERIFIED (RB-09)
- Generic "unknown" fallbacks — present in cloud error paths

## Invariant Violations (Documented)

- Success followed by error on activation — UNVERIFIED live
- Stale red errors after navigation — UNVERIFIED

## Result

**ERROR TRUTHFULNESS: PARTIAL / WEAK** — benign whitelist is active risk.
