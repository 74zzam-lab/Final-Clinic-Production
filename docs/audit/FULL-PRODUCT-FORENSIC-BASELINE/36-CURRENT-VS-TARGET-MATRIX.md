# 36 — Current vs Target Matrix

**Target source:** Product docs (`ARCHITECTURE-CURRENT.md`, V2-5.10 requirements, executive review intended model).

| Subsystem | Target | Current | Classification |
|-----------|--------|---------|----------------|
| SQLite SoT | Single authority | Dual with localStorage | **PARTIAL** |
| Backup DR | V2 only | V1+V2+cloud JSON | **BROKEN** |
| Sync | Device A/B proven | Code complete, live UNVERIFIED | **PARTIAL** |
| License | V6 Ed25519 only | V5+V6 coexist | **PARTIAL** |
| Setup | Single state machine | Multiple wizards | **PARTIAL** |
| Electron security | Sandbox+IPC+RBAC | Implemented | **MATCH** (code) |
| Live UAT 40/40 | All PASS | 0/40 | **MISSING** |
| Windows installer | NSIS signed | NSIS unsigned internal | **PARTIAL** |
| Owner Hub | Operational | Code present | **UNVERIFIED** |
| Import studio | Working | verify PASS | **MATCH** (unit) |
| Commission math | Preserved | In renderer | **MATCH** |
| Git SoT repo | Tadawi-Clinic-Production | ZIP upload repo | **BROKEN** |

No redesign of working Electron security layer recommended.
