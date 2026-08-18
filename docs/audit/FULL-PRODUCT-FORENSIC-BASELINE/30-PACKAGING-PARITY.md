# 30 — Packaging Parity

## Source Identity

| Field | Value |
|-------|-------|
| Workspace HEAD | ea1cd1c (zip only) |
| Product inside zip | V2-5-10 consolidation cea9 |
| package version | 2.0.1 |

## Build Attempt

**NOT EXECUTED** — Windows NSIS build requires windows-2022 (CI target).  
Linux environment cannot produce `HijamaManagement-Setup-2.0.1.exe`.

## CI Parity (from workflow inspection)

`v2-5-10-release-gate.yml`: npm ci → npm test → stage1 → NSIS build → install smoke

## Packaged vs Source

| Check | Status |
|-------|--------|
| ASAR contents match files list | SOURCE_CONFIRMED (config) |
| tools/tests/docs excluded | SOURCE_CONFIRMED |
| better-sqlite3 unpacked | SOURCE_CONFIRMED |
| OAuth embedded at build | prebuild script |
| Installed binary hash | UNVERIFIED |
| Runtime bundle diff | UNVERIFIED |

## Documented UAT EXE

- Tag: `uat-v2-5-10-30897392063`
- SHA-256: `b8f3de3ab56179f8aaa4ff8a963f0e46730d27e52daab1714fe5e9a4f66f7a3b`
- **Not downloaded or verified in this audit**

## Result

**PACKAGING PARITY: UNVERIFIED**
