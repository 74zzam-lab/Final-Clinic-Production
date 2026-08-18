# 13 — Auth / RBAC Audit

## User Model

| Role | Level | Capabilities (intended) |
|------|-------|-------------------------|
| employee | 1 | Basic clinic ops |
| doctor | 2 | Own patients, commissions |
| manager | 3 | Branch management |
| admin | 4 | Users, settings |
| owner | 5 | Org, branches, cloud, license |

## Authentication

| Aspect | Implementation | Status |
|--------|----------------|--------|
| Local credentials | users table + password hash | SOURCE_CONFIRMED |
| Session storage | `rbac-session.js` main process | SOURCE_CONFIRMED |
| Session expiry | Policy in rbac-session | UNVERIFIED runtime |
| Logout | Clears session + UI | UNVERIFIED |
| Restart persistence | Session rehydrate code | UNVERIFIED |
| Google OAuth | Separate from local login | UNVERIFIED live |

## Authorization Boundaries

| Layer | Mechanism | Trust Level |
|-------|-----------|-------------|
| UI | `applyRoleUI()`, hidden nav | **UNTRUSTED** |
| Preload | Channel allowlist | Trusted partial |
| Main IPC | `ipc-validate.js` + rbac channel policy | **TRUSTED** |
| Database | No row-level security in SQLite | App-layer only |

## Tests

- `test-phase6-permissions.js` — PASS (static)
- `test-v2-5-4-rbac-audit.js` — PASS (static)
- `v2-5-3:owner-rbac-runtime` — Windows UAT script — **NOT RUN**

## Security Gaps

| ID | Issue | Severity |
|----|-------|----------|
| AUTH-01 | Renderer-only restrictions bypassable if IPC unguarded | P1 if any channel open |
| AUTH-02 | Owner password gate — live UNVERIFIED | P1 |
| AUTH-03 | Session fixation / concurrent sessions — UNVERIFIED | P2 |
| AUTH-04 | Password recovery flow — UNVERIFIED | P2 |

## Result

**AUTHENTICATION: PARTIAL**  
**AUTHORIZATION: PARTIAL**
