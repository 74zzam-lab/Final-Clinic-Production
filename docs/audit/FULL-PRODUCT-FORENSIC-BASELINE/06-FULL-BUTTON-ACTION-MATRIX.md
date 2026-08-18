# 06 — Full Button / Action Matrix (Summary)

**Full machine inventory:** `05-FULL-PRODUCT-FORENSIC-INVENTORY.json`  
**Counts:** 334 buttons, 390 onclick handlers, 22 page sections

## Pages Inventoried

| Page ID | Label (approx) | Classification |
|---------|----------------|----------------|
| page-dashboard | Dashboard | UNVERIFIED |
| page-daily | New visit / daily | UNVERIFIED |
| page-clients | Clients | UNVERIFIED |
| page-bookings | Bookings | UNVERIFIED |
| page-invoices | Invoices | UNVERIFIED |
| page-expenses | Expenses | UNVERIFIED |
| page-attendance | Attendance | UNVERIFIED |
| page-payroll | Payroll | UNVERIFIED |
| page-employee-ledger | Employee ledger | UNVERIFIED |
| page-doctors | Practitioners | UNVERIFIED |
| page-employee | Employees | UNVERIFIED |
| page-users | Users / RBAC | UNVERIFIED |
| page-settings | Settings | UNVERIFIED |
| page-reports | Reports | UNVERIFIED |
| page-logs | Audit logs | UNVERIFIED |
| page-messages | Messaging | UNVERIFIED |
| page-packages | Service packages | UNVERIFIED |
| page-inventory | Inventory | UNVERIFIED |
| page-cashfloat | Cash float | UNVERIFIED |
| page-search | Global search | UNVERIFIED |
| page-queue-display | Queue display | UNVERIFIED |
| page-owner-hub | Owner Hub | UNVERIFIED |

## Critical Action Categories

### Clinic Operations (UNVERIFIED — source confirmed handlers exist)

| Action | Handler | API/IPC | Expected | Runtime |
|--------|---------|---------|----------|---------|
| Save visit | `saveVisit()` | SqliteBridge + db IPC | Persist visit | UNVERIFIED |
| Print invoice | tax invoice builders | print IPC | Thermal/A4 output | UNVERIFIED |
| Open cash drawer | preload | `devices:openCashDrawer` | Hardware pulse | UNVERIFIED |
| Generate payroll | `generatePayroll()` | renderer calc + DB | Payroll records | UNVERIFIED |

### Backup / Restore

| Action | Handler | Classification |
|--------|---------|----------------|
| Local backup V2 | `backup-v2:create` IPC | SOURCE_CONFIRMED |
| Cloud backup upload | backup-v2-scheduler | SOURCE_CONFIRMED |
| **Backup V1 restore** | `cupping-cloud-db-backup.js` | **BROKEN RISK** — wrong SoT path |
| Cloud restore wizard | `restore-wizard.js` | PARTIAL — Scenario C FAIL per docs |
| Discover restore points | `cloud-data-discovery` | SOURCE_CONFIRMED — live UNVERIFIED |

### Cloud / Sync

| Action | Handler | Classification |
|--------|---------|----------------|
| Connect Google | OAuth loopback | UNVERIFIED live |
| Sync now | `sync-engine.js` | UNVERIFIED Device A/B |
| Resolve conflict | `conflict-manager-ui.js` | UNVERIFIED |
| Disconnect Drive | token-store clear | UNVERIFIED |

### Setup / Onboarding

| Action | Handler | Classification |
|--------|---------|----------------|
| Setup Next/Back | `setup-state-service.js` | SOURCE_CONFIRMED — live UNVERIFIED |
| Center setup complete | `center-setup-ui.js` | UNVERIFIED |
| First-run tour | `cupping-first-run.js` | UNVERIFIED |

### Owner Hub / Admin

| Action | Handler | Classification |
|--------|---------|----------------|
| Register device | `device-registry.js` | UNVERIFIED |
| Branch create/join | `branch-enrollment` | UNVERIFIED |
| License panel | Owner Hub licensing | UNVERIFIED |
| Owner password set | setup gates | UNVERIFIED |

### License

| Action | Handler | Classification |
|--------|---------|----------------|
| Activate key | `license-router.js` | SOURCE_CONFIRMED |
| Pull from Drive | license drive push/pull | UNVERIFIED live |
| Developer panel | `license/ui/` | SOURCE_CONFIRMED — dev only |

## Classification Summary

| Status | Count (est.) | Notes |
|--------|-------------|-------|
| WORKING | 0 | No runtime proof in audit environment |
| SOURCE_CONFIRMED | ~350+ | Handlers exist in source |
| UNVERIFIED | ~350+ | Requires Windows installed EXE |
| BROKEN (documented) | 3+ | Backup V1 path, Scenario C, benign error suppression |
| DEAD / PLACEHOLDER | Unknown | Requires interactive trace |
| DUPLICATE | 5+ clusters | Multiple setup/activation/backup entry points |

## Visibility / Role Rules

- Sidebar nav items gated by `applyRoleUI()` and license feature registry
- Owner Hub visible to `owner` role only (renderer)
- Cloud panels may be hidden until license tier permits

**Security note:** UI hiding alone does not prove IPC blocks unauthorized calls — main-process validation required per action.
