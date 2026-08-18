# 08 — State Authority Matrix

## Critical State Authorities

| State | Authoritative Writer | Authoritative Reader | Mirrors | Conflict |
|-------|---------------------|---------------------|---------|----------|
| **Current user / session** | `rbac-session.js` (main) | Renderer `currentUser` | localStorage session keys | **COMPETING** — restart may desync |
| **License / activation** | `license-store.js` → localStorage | `license-router.js`, UI gates | Drive remote copy | **COMPETING** — pull vs local |
| **Setup step / wizard** | `setup-state-service.js` | `setup-state-dom.js`, BootFlow UI | localStorage setup keys | **PARTIAL FIX** V2-5.10 — live unverified |
| **Operational records** | SQLite via SqliteBridge | Renderer lists, reports | localStorage legacy keys | **COMPETING** — P0 |
| **Sync cursor** | `sync_meta` table | `sync-engine.js` | Drive remote meta | Single authority if connected |
| **Sync outbox** | `sync_outbox` table | `peer-sync-engine.js` | None | OK |
| **Conflicts** | `sync_conflicts` + LS queue | `conflict-manager-ui.js` | **DUPLICATE** | **COMPETING** |
| **OAuth tokens** | `token-store.js` (main) | Cloud providers | None intended | OK if secure storage works |
| **Device identity** | `device_registry_local` + Drive | Owner Hub, sync | `device-cache.js` | Cache must invalidate |
| **Branch context** | `cloud/branch-context.js` | Sync writers, UI filter | Renderer branch selector | **RISK** — scope leakage unverified |
| **Center / org ID** | `cloud/center-id.js` | All cloud ops | meta table | OK |
| **Backup manifest** | `backup-v2-core.js` | Restore wizard | Cloud file metadata | OK |
| **Attachments** | `attachments_meta` + manifest LS | Sync, UI | **COMPETING** | **HIGH RISK** |
| **Feature flags** | Generated `license/registries` + inline HTML | UI visibility | Drift possible | **COMPETING** |
| **Navigation / page** | Renderer router | DOM | None | OK |
| **Payroll counters** | Renderer + kv_store | Reports | localStorage | **COMPETING** |
| **Audit log** | `audit_events` DB + license audit LS | Logs page | Duplicate | MEDIUM |

## Persistence Layers

| Layer | Location | Used For |
|-------|----------|----------|
| SQLite | `userData/*.db` | Intended SoT for ops + sync |
| localStorage | Renderer | Legacy ops, license, conflicts, setup |
| KV table | SQLite `kv_store` | Settings, counters |
| Files | userData attachments, backups | Blobs |
| Google Drive | Remote JSON + registry | Sync, backup, license |
| Main memory | Session, caches | Runtime only |

## Restart Behavior

| State | Survives Restart? | Notes |
|-------|-------------------|-------|
| SQLite data | YES | Durable |
| localStorage | YES | May disagree with SQLite |
| RBAC session | YES (main rehydrate) | UNVERIFIED |
| OAuth tokens | YES (secure store) | UNVERIFIED refresh |
| In-flight sync | Outbox persists | Retries on boot |
| Setup wizard mid-step | setup-state-service | UNVERIFIED live |

## Invalidation

- SqliteBridge hydrate on boot — may load stale if localStorage written after
- Device cache — unclear invalidation on branch switch
- Cloud meta — refresh on reconnect

## Flagged Competing Authorities (P0/P1)

1. **SQLite vs localStorage** for operational entities
2. **sync_conflicts vs localStorage conflict queue**
3. **attachments_meta vs attachment manifest**
4. **Inline feature registry vs generated registries**
5. **Setup state service vs BootFlow/CenterSetup parallel arrays**
