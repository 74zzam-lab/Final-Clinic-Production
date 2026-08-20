# RC UAT Runbook — Authorized Build Only

**Status:** `SOURCE VERIFIED / RUNTIME UAT PENDING`

## Authorized identity (do not change mid-UAT)

| Role | Value |
|------|-------|
| RC branch | `cursor/final-stable-operational-rc-7c71` |
| **RUNTIME / BUILD SOURCE** | `c2c2ad6650797af8e9769722aaa094f76176459e` |
| **EVIDENCE / DOC HEAD** | `70468aba361a5e9e2c8fb4609f9dbc0bd87c33cf` |
| **EXE SHA-256** | `174ab10a016deddfe3758e08bec59e47cd953a0535b167bbd108e4bbb25747a9` |
| **ASAR SHA-256** | `f8a02983e7fedf5c8027c18665e6c8a48fdd8aea2302b7b00cb4f8056d6400fe` |

Path: `dist/win-unpacked/Hijama Management System.exe`

## Execution order (mandatory)

1. Clean Install
2. Owner/Admin Login
3. Branch A/B switching
4. Migration / Existing upgrade
5. Backup / Restore
6. Device A/B
7. Offline / Reconnect
8. Google OAuth
9. Live Drive CAS
10. Final restart / integrity checks

## Pre-UAT verification (completed)

- [x] Post-build commits `c2c2ad6..70468ab` are docs-only — no packaged runtime changes
- [x] EXE SHA-256 on disk matches authorized hash
- [x] No rebuild required

## UAT log

| Step | Status | Notes |
|------|--------|-------|
| 1 Clean Install | PENDING | Requires Windows host |
| 2 Owner/Admin Login | PENDING | |
| 3 Branch A/B | PENDING | |
| 4 Migration/Upgrade | PENDING | |
| 5 Backup/Restore | PENDING | |
| 6 Device A/B | PENDING | |
| 7 Offline/Reconnect | PENDING | |
| 8 Google OAuth | PENDING | |
| 9 Live Drive CAS | PENDING | |
| 10 Final integrity | PENDING | |
