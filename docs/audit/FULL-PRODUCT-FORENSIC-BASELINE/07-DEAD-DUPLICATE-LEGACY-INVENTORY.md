# 07 — Dead / Duplicate / Legacy Inventory

## Duplicate Systems

### DUP-01: Triple Backup Architecture
| | |
|---|---|
| **SYSTEM** | Backup V1 (LevelDB), Backup V2 (SQLite encrypted), Cloud V2 daily JSON |
| **AUTHORITATIVE** | Backup V2 + SQLite SoT (intended) |
| **PARALLEL** | `electron/backup.js`, `cupping-cloud-db-backup.js`, `cloud/backup-layer.js` |
| **REACHABLE** | Yes — V1 still in Settings UI |
| **DATA RISK** | **CRITICAL** — restore wrong format corrupts clinic |
| **ACTION** | FREEZE V1 UI; REMOVE-LATER after migration proof |

### DUP-02: Dual Persistence (SQLite + localStorage)
| | |
|---|---|
| **SYSTEM** | Operational data |
| **AUTHORITATIVE** | SQLite (intended) |
| **PARALLEL** | localStorage mirrors in `index.html`, `license-store.js` |
| **REACHABLE** | Yes — write-through not universal |
| **DATA RISK** | **HIGH** — stale cache overrides DB |
| **ACTION** | REPAIR ONLY — complete SQLite-native path |

### DUP-03: Multiple Setup / Activation Surfaces
| | |
|---|---|
| **PARALLEL PATHS** | BootFlow, CenterSetup, first-run wizard, hidden login Drive panel, license Drive drawer, DevTools pull |
| **AUTHORITATIVE** | `setup-state-service.js` (V2-5.10 intent) |
| **DATA RISK** | MEDIUM — conflicting step state |
| **ACTION** | INVESTIGATE → consolidate UX post-pilot |

### DUP-04: Conflict Storage Split
| | |
|---|---|
| **PATHS** | SQLite `sync_conflicts` + renderer localStorage conflict queue |
| **DATA RISK** | MEDIUM — desync between stores |
| **ACTION** | REPAIR ONLY |

### DUP-05: Attachment Metadata Dual
| | |
|---|---|
| **PATHS** | `__tdw_attachment_manifest__` vs catalog `attachments_meta` |
| **DATA RISK** | HIGH per RB-05 |
| **ACTION** | REPAIR ONLY |

### DUP-06: Feature Registry Duplicate
| | |
|---|---|
| **PATHS** | Inline `index.html` registry + generated `license/registries/` |
| **RISK** | Drift — `v2-5-10:registry-drift` script exists |
| **ACTION** | FREEZE generated as SoT |

### DUP-07: License Codec V5 + V6
| | |
|---|---|
| **PATHS** | HMAC V5 (client-derived key) + Ed25519 V6 verify |
| **SECURITY RISK** | V5 client-side signing weak |
| **ACTION** | REPAIR — migrate customers to V6 only |

## Legacy / Migration-Only

| Module | Purpose | Reachable | Action |
|--------|---------|-----------|--------|
| `database/migrate-from-json.js` | JSON → SQLite | On migration | KEEP |
| `migration/migration-engine.js` | Legacy data import | Import flows | KEEP |
| `electron/backup-v1-gate.js` | Restrict V1 ops | Partial gate | INVESTIGATE |
| `license/migrations/migrate-1.0.0-to-1.1.0.mjs` | License schema | Upgrade path | KEEP |
| `electron/userdata-migration.js` | Folder rename compat | First boot | KEEP |

## Suspected Dead / Low Reach

| Item | Evidence | Classification |
|------|----------|----------------|
| `electron/*.example.js` | Example files not in build | DEAD in production |
| `tools/license-admin/` | Excluded from ASAR build | DEAD in client; alive in dev |
| `docs/` (693 files) | Excluded from package | DEAD at runtime |
| `tests/` | Excluded from package | DEAD at runtime |
| Commented blocks in `index.html` | TODO/FIXME sparse | INVESTIGATE per block |

## Feature Flags / Debug

| Pattern | Location | Risk |
|---------|----------|------|
| `PRODUCTION LOCK` | `cupping-production.js` | Intentional — blocks feature work |
| Developer panel | `license/ui/developer-panel` | Must not ship enabled |
| `isBenignCloudErr` | `index.html:10762` | **HIGH** — suppresses ReferenceErrors |

## TODO/FIXME Density

~30 files with TODO/FIXME markers — mostly in verify scripts and docs, not blocking.

## Patch Archaeology

- V2-5.x program left transitional bridges (localStorage mirror, Backup V1 gate, V5 license)
- `docs/integration-v2-5-10/` documents consolidation without removing legacy paths
- Production lock policy = bugs/UX/UAT only — no architecture cleanup allowed pre-PC
