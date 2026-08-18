# 38 — Reuse / Repair / Redesign Matrix

| Subsystem | Classification | Rationale |
|-----------|----------------|-----------|
| Electron main + IPC security | **REUSE AS-IS** | Evidence: phase2 tests, architecture sound |
| better-sqlite3 + migrations | **REUSE AS-IS** | Schema v4/v5 stable |
| Backup V2 core/crypto | **REUSE AS-IS** | Unit tests PASS |
| Sync engine + outbox | **REPAIR ONLY** | Architecture good; needs live proof + attachment fix |
| SqliteBridge | **REPAIR ONLY** | Complete write-through; remove LS mirror |
| localStorage operational mirror | **REMOVE LATER** | After migration verified |
| Backup V1 | **FREEZE then REMOVE** | Disable UI now |
| License V6 verify | **REUSE AS-IS** | Correct design |
| License V5 codec | **REMOVE LATER** | After customer migration |
| index.html monolith | **REDESIGN REQUIRED** | Long-term only; not pre-pilot blocker |
| BootFlow + CenterSetup | **REPAIR ONLY** | Consolidate under setup-state-service |
| isBenignCloudErr | **REPAIR ONLY** | Surgical fix |
| Test suite static gates | **REPAIR ONLY** | Add production-path tier |
| ZIP-only workspace repo | **REPAIR ONLY** | Proper git extraction |
| Owner Hub | **INVESTIGATE** | Live UAT first |
| Import studio | **REUSE AS-IS** | verify PASS |
| Communication gateway | **INVESTIGATE** | UNVERIFIED |
| docs/integration-v2* | **FREEZE** | Archive post-pilot |
