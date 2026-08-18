# 32 — Critical Journey Evidence

| Journey | Screens | Trusted Boundary | DB Effect | Remote | Result |
|---------|---------|------------------|-----------|--------|--------|
| FIRST-TIME CUSTOMER | BootFlow, setup, license | setup-state-service | SQLite init | Drive connect | UNVERIFIED |
| EXISTING CUSTOMER login | login, dashboard | rbac-session | session read | — | UNVERIFIED |
| DAILY OPERATION | daily, clients, invoices | SqliteBridge | writes | sync queue | UNVERIFIED |
| ADMIN OPERATION | users, settings | IPC+RBAC | users table | — | UNVERIFIED |
| OWNER/MANAGEMENT | owner-hub | cloud+license | registry | Drive | UNVERIFIED |
| BACKUP | settings backup | backup-v2 main | snapshot file | upload | PARTIAL unit |
| RESTORE | restore wizard | restore-staging | DB swap | download | FAIL doc Scenario C |
| SYNC MULTI-DEVICE | sync engine | outbox | sync tables | Drive | UNVERIFIED |
| MULTI-BRANCH | branch enrollment | branch-context | branch_id | Drive | UNVERIFIED |
| UPGRADE | migrations | connection.js | schema_migrations | — | PARTIAL unit |
| RECOVERY | backup V2 restore | reconcile | full replace | — | UNVERIFIED |

## Evidence Standard

No journey has installed EXE runtime proof in this audit.
