# RC UAT Runbook — Authorized Build Only

**Status:** `SOURCE VERIFIED / RUNTIME UAT PENDING`

## Authorized identity (do not change mid-UAT)

| Role | Value |
|------|-------|
| RC branch | `cursor/final-stable-operational-rc-7c71` |
| **RUNTIME / BUILD SOURCE** | `c2c2ad6650797af8e9769722aaa094f76176459e` |
| **EVIDENCE / DOC HEAD** | `88506d2e883f9e3becac6ebae6124fddb7f7c0e6` |
| **EXE SHA-256** | `174ab10a016deddfe3758e08bec59e47cd953a0535b167bbd108e4bbb25747a9` |
| **ASAR SHA-256** | `f8a02983e7fedf5c8027c18665e6c8a48fdd8aea2302b7b00cb4f8056d6400fe` |

Path: `dist/win-unpacked/Hijama Management System.exe`

## Post-build audit (`c2c2ad6..88506d2`)

**Docs/evidence only** — no packaged runtime path changes. **No rebuild.**

## Execution order

1. Clean Install → 2. Owner/Admin Login → 3. Branch A/B → 4. Migration/Upgrade → 5. Backup/Restore → 6. Device A/B → 7. Offline/Reconnect → 8. Google OAuth → 9. Live Drive CAS → 10. Final integrity

## UAT log (2026-08-20, Linux VM)

| Step | Status | Notes |
|------|--------|-------|
| SHA-256 verify | **PASS** | EXE hash exact match |
| 1 Clean Install | **PARTIAL** | Wine: EXE crash (Crashpad). Source parity `npm start` @ c2c2ad6 launches |
| 2 Owner/Admin Login | **BLOCKED** | Google OAuth gate — no test credentials |
| 3 Branch A/B | **BLOCKED** | Requires login |
| 4 Migration/Upgrade | **BLOCKED** | Requires login |
| 5 Backup/Restore | **BLOCKED** | Requires Google Drive auth |
| 6 Device A/B | **BLOCKED** | Requires cloud session |
| 7 Offline/Reconnect | **BLOCKED** | Requires baseline sync |
| 8 Google OAuth | **PARTIAL** | OAuth screen renders; manual completion needed |
| 9 Live Drive CAS | **BLOCKED** | Requires OAuth |
| 10 Final integrity | **BLOCKED** | Requires full flow |

**Next:** Native Windows host + Google test account on **authorized EXE only** (same SHA-256).
