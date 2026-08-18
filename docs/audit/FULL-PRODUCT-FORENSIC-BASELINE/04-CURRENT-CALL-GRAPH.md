# 04 — Current Call Graph (Critical Paths)

## Application Boot

```
app.start (electron/main.js)
  ├─ loadOAuthConfig() → cloud-oauth.embedded.json
  ├─ initDatabase() → database/connection.js → runMigrations()
  ├─ initRbacSession() → electron/rbac-session.js
  ├─ registerIpcHandlers() → backup, cloud, devices, attachments, license-data
  ├─ createMainWindow() → load index.html
  │     └─ preload.js → contextBridge.exposeInMainWorld
  └─ renderer: DOMContentLoaded
        ├─ cupping-production.js (production lock check)
        ├─ cloud/bootstrap.js → CloudV2Init
        ├─ cupping-sqlite-bridge.js → hydrate from SQLite
        ├─ license/license-router.js → validate license
        ├─ cupping-first-run.js OR cloud/boot-flow-ui.js (setup)
        └─ initProductionErrorHandlers() → isBenignCloudErr filter
```

## Login Flow

```
UI login form (index.html)
  → validateLocalUser(credentials)
  → ipc: rbac:login (if applicable)
  → rbac-session.js setSession(user, role)
  → renderer: set currentUser, applyRoleUI()
  → navigateToPage('dashboard')
```

## Visit Create (Daily Ops)

```
page-daily form submit
  → saveVisit() [index.html]
  → calcDoctorCommission() [renderer]
  → SqliteBridge.write('visits', record)
  → ipc: db:upsert (main database service)
  → localStorage mirror (legacy)
  → sync: queueOutbox() → cloud/sync-engine.js
  → Drive upload (if connected)
```

## Backup V2 Create

```
UI Settings → Backup
  → ipc: backup-v2:create
  → backup-v2-core.js serialize SQLite + manifest
  → backup-crypto-v2.js encrypt
  → backup-v2-transfer.js write file
  → optional: cloud upload via backup-v2-scheduler
```

## Restore (Cloud Discovery)

```
UI Restore Wizard
  → ipc: backup:discoverCloudRestorePoints
  → electron/cloud-data-discovery.js
  → Google Drive list versions
  → user selects point
  → ipc: backup:downloadCloudBackup
  → restore-staging.js decrypt + validate
  → restore-reconciliation.js reconcile before push
  → database swap/import
  → renderer hydrate
```

## License Activation

```
BootFlow OR license drawer
  → user enters key OR pull from Drive
  → license-router.js route by codec version
  → V6: license-v6-verify.js (Ed25519 pubkey only)
  → V5: license-codec-v5.js (HMAC — key in client)
  → license-store.js → localStorage commit
  → UI success banner
  → restart may re-validate
```

## Sync Push

```
Local write committed to SQLite
  → sqlite-outbox-bridge.js enqueue
  → sync_outbox table
  → sync-engine.js processOutbox()
  → google-drive.js upload JSON delta
  → update sync_meta cursor
  → on conflict: sync_conflicts + conflict-manager-ui
```

## Owner Hub Device Register

```
page-owner-hub → register device
  → cloud/device-registry.js
  → ipc + Drive write registry JSON
  → device_registry_local update
  → license device limit check (phase26)
```

## Print Tax Invoice

```
cupping-simplified-tax-invoice.js build payload
  → QR generate (qrcode-generator)
  → window.open print preview
  → preload-print.js (restricted preload)
  → devices.js print OR browser print
```

## IPC Trust Boundary

```
Renderer call → preload allowlist check
  → main ipc-validate.js typed validation
  → rbac-session channel policy
  → handler execution
  → return sanitized result
```

**Note:** Call graph derived from source inspection. Runtime tracing on installed EXE = **UNVERIFIED**.
