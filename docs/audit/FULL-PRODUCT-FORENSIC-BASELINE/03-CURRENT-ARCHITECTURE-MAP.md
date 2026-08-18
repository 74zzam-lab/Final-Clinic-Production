# 03 — Current Architecture Map

## Overview

Electron desktop app: **main process** (Node) + **preload** (contextBridge) + **renderer** (monolithic `index.html` + `cupping-*.js` + `cloud/*.js`).

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (index.html + cupping-*.js + cloud/*.js)          │
│  localStorage │ SqliteBridge │ UI pages │ License UI        │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC (preload allowlist)
┌──────────────────────────▼──────────────────────────────────┐
│  Main Process (electron/main.js)                            │
│  RBAC │ Backup V1/V2 │ OAuth │ Devices │ DB service │ CSP   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   SQLite (better-    Google Drive      File system
   sqlite3)          OAuth/token       userData
```

## Subsystem Map

### 1. Startup
| | |
|---|---|
| **ENTRY** | `electron/main.js` → `app.whenReady()` |
| **MAIN FILES** | `main.js`, `cupping-production.js`, `cloud/bootstrap.js` |
| **STATE** | `userData`, license store, setup state |
| **FAILURE** | Missing OAuth config → build fail; DB migration fail → gated open |
| **RESTART** | Re-reads SQLite + localStorage hydrate |

### 2. Main Process
| | |
|---|---|
| **ENTRY** | `electron/main.js` |
| **WRITERS** | IPC handlers, backup, OAuth, RBAC session |
| **IPC** | 100+ channels via `preload.js` allowlist |
| **SECURITY** | `electron/security/ipc-validate.js`, `path-guard.js` |

### 3. Renderer / Preload
| | |
|---|---|
| **ENTRY** | `index.html` DOMContentLoaded |
| **PRELOAD** | `electron/preload.js` |
| **STATE** | In-memory + localStorage + SqliteBridge cache |
| **SIDE EFFECTS** | DOM updates, print windows |

### 4. Authentication / Sessions
| | |
|---|---|
| **ENTRY** | Login form in `index.html`; `electron/rbac-session.js` |
| **STATE** | Main-process session; renderer `currentUser` |
| **REMOTE** | None for local auth |
| **FAILURE** | Invalid credentials → UI error |

### 5. Authorization / RBAC
| | |
|---|---|
| **ENTRY** | `rbac-session.js`, `cloud/rbac-guard.js` |
| **ROLES** | employee → doctor → manager → admin → owner |
| **ENFORCEMENT** | Main IPC policy + renderer UI hide |
| **GAP** | Renderer-only restrictions not sufficient alone — main validates key channels |

### 6. Database (SQLite)
| | |
|---|---|
| **ENTRY** | `database/connection.js`, `electron/database/service.js` |
| **MIGRATIONS** | `001_initial`, `002_sync_platform` |
| **WRITERS** | Repositories, sync engine, SqliteBridge write-through |
| **READERS** | Renderer hydrate, reports, sync pull |

### 7. Local Persistence (legacy)
| | |
|---|---|
| **ENTRY** | `localStorage` throughout `index.html`, `license/engine/*` |
| **RISK** | Dual authority with SQLite — **P0 cluster** |

### 8. Setup / Onboarding
| | |
|---|---|
| **ENTRY** | `cupping-first-run.js`, `cloud/center-setup-ui.js`, `cloud/boot-flow-ui.js` |
| **STATE SoT** | `cloud/setup-state-service.js` (intended); DOM mirror `setup-state-dom.js` |
| **PARALLEL** | BootFlow + CenterSetup + first-run wizard |

### 9. Licensing / Activation
| | |
|---|---|
| **ENTRY** | `license/license-router.js`, `index.html` lic* functions |
| **CODECS** | V5 HMAC (`license-codec-v5.js`), V6 Ed25519 verify (`license-codec-v6.js`) |
| **STORAGE** | localStorage `commercial_license_*` |
| **REMOTE** | Drive license pull/push |

### 10. Cloud / OAuth
| | |
|---|---|
| **ENTRY** | `electron/cloud-providers/google-drive.js`, `cloud-oauth-config.js` |
| **TOKEN** | `electron/cloud-providers/token-store.js` |
| **REMOTE** | Google Drive API |

### 11. Sync
| | |
|---|---|
| **ENTRY** | `cloud/sync-engine.js`, `database/peer-sync-engine.js` |
| **QUEUE** | `sync_outbox`, `sync_inbox_applied`, `sync_conflicts` |
| **REMOTE** | Drive JSON layers per table policy |

### 12. Backup V1 (Legacy)
| | |
|---|---|
| **ENTRY** | `electron/backup.js`, `cupping-cloud-db-backup.js` |
| **FORMAT** | LevelDB snapshot |
| **GATE** | `electron/backup-v1-gate.js` — partial restrictions |
| **RISK** | Still reachable from UI — **P0** |

### 13. Backup V2
| | |
|---|---|
| **ENTRY** | `electron/backup-v2-core.js`, `backup-v2-ipc.js` |
| **CRYPTO** | `backup-crypto-v2.js` |
| **SCHEDULER** | `backup-v2-scheduler.js` |

### 14. Restore
| | |
|---|---|
| **ENTRY** | `cloud/restore-wizard.js`, `cloud/restore-staging.js`, `cloud/restore-reconciliation.js` |
| **DISCOVERY** | `electron/cloud-data-discovery.js` |
| **RISK** | Multiple entry points; timeout/abort behavior varies |

### 15. Devices
| | |
|---|---|
| **ENTRY** | `electron/devices.js`, `cloud/device-registry.js` |
| **STATE** | `device_registry_local`, Drive registry |

### 16. Reports / Printing
| | |
|---|---|
| **ENTRY** | `index.html` report pages, `cupping-simplified-tax-invoice.js` |
| **PRINT** | `electron/security/preload-print.js`, `devices.js` |

### 17. Import / Export
| | |
|---|---|
| **ENTRY** | `import-studio/`, `import-engine-*.js`, `cupping-import-wizard.js` |
| **FORMAT** | XLSX via `xlsx` package |

### 18. Communication
| | |
|---|---|
| **ENTRY** | `electron/communication/gateway.js`, `cupping-communication-gateway.js` |
| **PROVIDERS** | SMS/WhatsApp adapters |

### 19. Updater
| | |
|---|---|
| **ENTRY** | `electron/update-policy.js` |
| **VERIFY** | Manifest signature check |

### 20. Owner Hub / Management
| | |
|---|---|
| **ENTRY** | `page-owner-hub` in index.html, `cloud/owner-hub*.js` |
| **SCOPE** | Org-wide admin |

## Packaging

- electron-builder NSIS Windows x64
- ASAR with native module unpack
- `tools/`, `tests/`, `docs/` excluded from package
