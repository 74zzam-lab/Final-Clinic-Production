# 02 — Product Business Model

## Product Identity

**Hijama Management System** (branded Tadawi Al-Madinah) — desktop clinic management for **cupping/hijama centers** in Arabic-speaking markets (RTL UI). Publisher: NajjarTech.

## Primary Users

| User | Role | Needs |
|------|------|-------|
| Reception / front desk | `employee` | Client intake, bookings, visits, invoices, cash drawer |
| Practitioner | `doctor` | Case notes, cupping maps, commissions |
| Branch manager | `manager` | Branch ops, reports, attendance |
| Clinic owner | `owner` | Multi-branch, licensing, cloud sync, Owner Hub, backup/restore |
| System admin | `admin` | Users, roles, settings (within license) |

## Secondary Users

- Accountants (payroll, tax invoices, ledgers)
- IT operator (install, backup, cloud setup)
- NajjarTech support (license issuance via `tools/license-admin`)

## Business Entities

| Entity | Scope | Persistence |
|--------|-------|-------------|
| Client / patient file | Branch | SQLite `clients` + payload_json |
| Visit / case | Branch | `visits`, `visit_cups` |
| Booking / appointment | Branch | `appointments` |
| Invoice | Branch | `invoices` |
| Expense | Branch/org | `index.html` + DB |
| Employee / doctor | Org | `employees`, `doctors` in renderer |
| Payroll / commission | Org/branch | Renderer calculations + ledger |
| Branch | Org | `cloud/branch-*`, device registry |
| Organization / center | Org | `center-setup`, `center-id` |
| License / activation | Device + org | `license/`, Drive push |
| Device | Org | `device_registry_local`, Drive |
| Attachment | Branch | Manifest + `attachments_meta` |
| Audit event | Org | `audit_events`, license audit log |

## Critical Workflows

1. **Daily clinic ops:** client → visit → invoice → print/QR → payment
2. **Bookings:** schedule → status lifecycle → visit conversion
3. **Payroll cycle:** attendance → commission calc → payroll generate → print/WhatsApp
4. **First-time setup:** license activation → center setup → Google Drive → branch enrollment
5. **Multi-device sync:** outbox → Drive → peer pull → conflict resolution
6. **Disaster recovery:** Backup V2 encrypt → cloud/local → restore wizard → reconcile → resume sync
7. **Owner management:** Owner Hub — devices, branches, licensing, audit

## Money-Related Workflows

- Visit totals, VAT, cash/card split
- Commission engine (9+ commission types — must preserve)
- Payroll generation, insurance deductions
- Simplified tax invoice (ZATCA-style QR)
- Employee ledger closings
- Expenses and budget

**Risk:** Financial formulas live primarily in `index.html` renderer — hard to unit-test; dual-write to SQLite + localStorage.

## Identity / Auth Workflows

- Local user login (username/password, roles)
- Main-process RBAC session (`electron/rbac-session.js`)
- Google OAuth for Drive (loopback + embedded config)
- License activation (V5 HMAC + V6 Ed25519 verify)
- Owner password / setup gates
- Device registration and limits

## Data Ownership Boundaries

| Boundary | Enforcement |
|----------|-------------|
| Branch scope | `branch_id` on records; branch context in sync |
| Org scope | Center ID, Owner Hub |
| Device scope | Device registry, license device limits |
| User scope | RBAC roles + permissions table |

**Gap:** UI hiding + renderer filtering; IPC validation exists but live cross-scope leakage **UNVERIFIED**.

## Offline / Online

- **Offline-first** daily ops (SQLite local)
- **Online required** for: Google Drive sync, cloud backup upload, license pull from Drive, OAuth refresh
- Sync outbox queues offline writes

## Multi-Device / Multi-Location

- Multi-branch supported in cloud V2 architecture
- Device A/B sync scenarios defined but **live UNVERIFIED**
- Owner "All Branches" mode

## Backup Requirements

- Local encrypted Backup V2 (SQLite snapshot)
- Cloud upload to Google Drive
- Legacy Backup V1 (LevelDB) still present — **data risk**
- Uninstall: default keep userData

## Regulatory / Security-Sensitive

- Patient health data (clients, visits)
- Financial records (invoices, payroll)
- VAT/tax invoicing
- OAuth tokens in secure storage
- License cryptography
- Arabic RTL, Unicode printing
