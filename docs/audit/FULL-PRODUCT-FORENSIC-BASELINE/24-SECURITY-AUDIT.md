# 24 — Security Audit

| Area | Classification | Notes |
|------|----------------|-------|
| Electron sandbox | **SECURE** (code) | sandbox:true per K-01 fix |
| IPC validation | **SECURE** (code) | Typed allowlist |
| Preload surface | **SECURE** (code) | Restricted bridge |
| CSP | **WEAK** | unsafe-inline allowed |
| OAuth secret in repo | **WEAK** | embedded by owner request K-05 |
| V5 license HMAC in client | **WEAK** | forgeable if algorithm known |
| V6 Ed25519 | **SECURE** | verify-only, no private key in client |
| RBAC enforcement | **WEAK** | live bypass UNVERIFIED |
| innerHTML / XSS | **WEAK** | broad usage, sanitizer partial |
| Backup encryption | **SECURE** (code) | v2 crypto module |
| Path traversal | **SECURE** (code) | path-guard.js |
| Benign error suppression | **BROKEN** | hides ReferenceErrors |
| Debug/dev panel | **WEAK** | must be gated in production |
| Dependency vulns | **WEAK** | npm audit: 30 vulns (6 critical) |

## Private Signing Keys in Client Package

**Ed25519 private key: NOT shipped** (verified by phase3 test).  
**V5 HMAC signing material: derived in client** — not a PEM private key but equivalent weakness.

## Result

**SECURITY: WEAK overall** — architecture sound; operational and legacy gaps block production.
