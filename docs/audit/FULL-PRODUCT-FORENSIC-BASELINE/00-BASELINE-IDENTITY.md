# 00 — Baseline Identity

**DATE OF AUDIT:** 2026-08-18 (UTC)

## Repository (Git Workspace)

| Field | Value |
|-------|-------|
| **REPOSITORY** | `Final-Clinic-Production` |
| **REMOTE** | `https://github.com/74zzam-lab/Final-Clinic-Production` |
| **BRANCH** | `main` |
| **HEAD** | `ea1cd1cbc479bbe0c0f7841b128ce550fe007127` |
| **HEAD MESSAGE** | Add files via upload |
| **HEAD DATE** | 2026-08-18 |
| **WORKTREE** | **CLEAN** (tracked: 1 file only) |
| **UNTRACKED** | `docs/audit/` (audit artifacts only — created during this audit) |
| **TAGS AT HEAD** | None |
| **PARENT** | Initial commit (single-commit repo) |
| **MERGE COMMIT** | No |

### Critical Repository Anomaly

The git repository contains **only** `Final Stage-Clinic-Production.zip` (7.6 MB). **No product source is checked out at repo root.** The product was extracted read-only to:

`docs/audit/_extracted/Tadawi-Clinic-Production-cursor-v2-5-10-final-consolidation-cea9/`

## Product Inside Archive

| Field | Value |
|-------|-------|
| **PRODUCT NAME** | Hijama Management System / Tadawi Al-Madinah |
| **PACKAGE NAME** | `hijama-management-system` |
| **VERSION (package.json)** | `2.0.1` |
| **PROGRAM TRACK** | V2-5.10 final consolidation (`cea9`) |
| **PUBLISHER** | NajjarTech |
| **DOCUMENTED SoT REPO** | `https://github.com/7uzzam/Tadawi-Clinic-Production` (inside zip README — **different from workspace remote**) |
| **ARCHIVE REPO** | `https://github.com/7uzzam/Cupping-System-Management` |

## Runtime

| Field | Value |
|-------|-------|
| **AUDIT ENV NODE** | v22.14.0 |
| **AUDIT ENV NPM** | 10.9.7 |
| **AUDIT ENV OS** | Linux x86_64 (Cloud Agent VM) |
| **ELECTRON (declared)** | ^43.2.0 |
| **NODE ENGINES (package)** | >=22 <=24 |
| **APPLICATION ENTRY** | `electron/main.js` |
| **UI ENTRY** | `index.html` (27,278 lines) |
| **PRELOAD** | `electron/preload.js` |

## Database

| Field | Value |
|-------|-------|
| **ENGINE** | SQLite via `better-sqlite3` ^13.0.2 |
| **MIGRATIONS** | `database/migrations/001_initial.js` (v4), `002_sync_platform.js` (v5) |
| **LEGACY** | localStorage mirror still active |

## Build System

| Field | Value |
|-------|-------|
| **BUILD** | electron-builder ^25.1.8 |
| **TARGET** | Windows NSIS x64 only |
| **ARTIFACT** | `HijamaManagement-Setup-2.0.1.exe` |
| **APP ID** | `com.tadawi.cuppingcenter` |
| **ASAR** | Yes (better-sqlite3 unpacked) |

## OS Support

| Platform | Status |
|----------|--------|
| **Windows 10/11** | Primary production target |
| **macOS** | Not packaged |
| **Linux** | Dev-only (`npm start`); dbus/GUI required |

## Test Runners

| Runner | Command |
|--------|---------|
| Unified suite | `npm test` → `tests/run-all.js` (106 suites) |
| Lint | `npm run lint` (ESLint 9) |
| Release gates | `verify:v2-5-*-release-gate`, `v2-5-10:stage1` |
| Windows UAT | `scripts/windows-uat/*.cjs` |
| Playwright | Used in `scripts/fpa-final-audit.mjs` (not primary `npm test`) |

## CI Workflows

17 workflows under `.github/workflows/` — all `runs-on: windows-2022`. Primary: `v2-5-10-release-gate.yml`.

## Baseline Trust Classification

| Classification | **REMEDIATION / ARCHIVE HYBRID** |
|----------------|----------------------------------|
| **Confidence** | **LOW** for release readiness; **MEDIUM** for source completeness inside zip |

**Why LOW:** Single-commit ZIP-only repo; workspace remote differs from documented production SoT; 0/40 live UAT requirements PASS per product docs; no installed Windows EXE tested in this audit environment.

**Why MEDIUM for source:** Extracted zip contains 1,231 files, full package.json, lockfile, migrations, tests, CI configs — appears to be complete V2-5.10 consolidation snapshot.
