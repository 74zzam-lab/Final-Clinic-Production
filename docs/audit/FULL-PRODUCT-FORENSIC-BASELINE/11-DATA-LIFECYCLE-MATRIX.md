# 11 — Data Lifecycle Matrix

## Entity: Client

| Stage | Implementation | Scope | Risk |
|-------|----------------|-------|------|
| CREATE | `saveClient()` → SqliteBridge | branch_id | Duplicate file_no if no unique enforce at UI |
| VALIDATE | Renderer form | — | Client-side only |
| WRITE | SQLite `clients` + payload_json | branch | LS mirror may lag |
| SYNC | sync_outbox → Drive | branch | UNVERIFIED A/B |
| DELETE | Soft/hard per UI action | branch | Tombstone policy in merge |
| EXPORT | Import studio reverse | branch | UNVERIFIED |
| BACKUP | Backup V2 includes table | org | PASS unit |
| RESTORE | restore-wizard import | org | UNVERIFIED live |

## Entity: Visit / Invoice

| Stage | Notes |
|-------|-------|
| CREATE | Commission calc in renderer before write |
| FINANCIAL | total, vat, cash, card — CHECK >= 0 |
| SYNC | Record-level with revision CAS |
| REPORT | Aggregated in reports page — timezone UNVERIFIED |

## Entity: Booking

| Stage | Notes |
|-------|-------|
| STATUS | Lifecycle expanded phase 11; legacy aliases normalized in code |
| CONVERT | Booking → visit linkage |

## Entity: Employee / Payroll

| Stage | Notes |
|-------|-------|
| COMMISSION | 9+ types in `calcDoctorCommission` — preserve semantics |
| PAYROLL | `generatePayroll` — renderer heavy |
| LEDGER | `cupping-employee-ledger.js` closings |

## Entity: Branch

| Stage | Notes |
|-------|-------|
| CREATE | Owner Hub / center setup |
| SCOPE | branch_id on records |
| ISOLATION | **UNVERIFIED** cross-branch read |

## Entity: Device

| Stage | Notes |
|-------|-------|
| REGISTER | Drive + local registry |
| LIMIT | License device limits (phase26) |
| REPLACE | UNVERIFIED idempotency live |

## Entity: Attachment

| Stage | Notes |
|-------|-------|
| WRITE | File + metadata |
| SYNC | Manifest vs attachments_meta — **DUP RISK** |
| DELETE | Orphan risk UNVERIFIED |

## Entity: License

| Stage | Notes |
|-------|-------|
| ACTIVATE | V5/V6 codecs |
| REMOTE | Drive push/pull |
| REVOKE | v6 revocations in localStorage |

## Cross-Cutting Risks

| Risk | Severity | Evidence |
|------|----------|----------|
| Cross-scope leakage | P0 | RB-06, unverified queries |
| Orphan records on delete | P1 | UNVERIFIED |
| Duplicate IDs on reconnect | P0 | RB-01 |
| Silent overwrite (LWW) | P1 | merge policies exist — live UNVERIFIED |
| Stale cache | P0 | dual persistence |
