# 14 — Management Console Audit

## Owner Hub (`page-owner-hub`)

| Tab/Action | Handler | Classification |
|------------|---------|----------------|
| Device list | `device-registry.js` | UNVERIFIED |
| Register device | device-registry IPC | UNVERIFIED |
| Branch summary | branch-summary modules | UNVERIFIED |
| Licensing panel | license engine | UNVERIFIED |
| Audit expansion | audit_events | UNVERIFIED |

## Settings (`page-settings`)

| Action | Classification |
|--------|----------------|
| Backup V2 create/restore | SOURCE_CONFIRMED |
| Backup V1 cloud DB | **BROKEN RISK** |
| Google connect/disconnect | UNVERIFIED |
| Sync controls | UNVERIFIED |

## Users (`page-users`)

| Action | Classification |
|--------|----------------|
| Create/assign role | SOURCE_CONFIRMED |
| Delete user | UNVERIFIED |

## Result

0 WORKING (runtime), ~25 SOURCE_CONFIRMED, ~25 UNVERIFIED, 1 BROKEN RISK.
