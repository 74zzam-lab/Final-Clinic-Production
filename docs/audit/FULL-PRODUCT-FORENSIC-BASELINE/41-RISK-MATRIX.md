# 41 — Risk Matrix

| Change Area | Risk | Notes |
|-------------|------|-------|
| Startup / main.js | CRITICAL | Window lifecycle |
| Login / RBAC session | CRITICAL | Auth boundary |
| Database migrations | CRITICAL | Irreversible schema |
| Backup V2 format | CRITICAL | Customer DR |
| Restore pipeline | CRITICAL | Full data replace |
| Sync merge policies | CRITICAL | Multi-device data loss |
| Disable Backup V1 | HIGH | Ops habit change |
| Remove localStorage mirror | HIGH | Migration ordering |
| OAuth config | HIGH | All cloud features |
| License V5 removal | HIGH | Existing customers |
| Commission formulas | CRITICAL | Financial |
| index.html split | MEDIUM | Long-term |
| ESLint fixes | LOW | Quality |
| Docs archive | LOW | No runtime |

## Future Remediation Risk Rule

Any CRITICAL area change requires: unit test → production-path test → installed test → commit → freeze.
