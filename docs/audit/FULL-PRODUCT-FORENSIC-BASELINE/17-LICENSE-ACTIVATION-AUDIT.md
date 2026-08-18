# 17 — License / Activation Audit

## Codecs

| Version | Crypto | Client Ships |
|---------|--------|--------------|
| V5 | HMAC-SHA256 | Signing key derived in renderer (`licGetSigningKey`) — **WEAK** |
| V6 | Ed25519 verify only | Public key only — **CORRECT** |

## Private Key Shipment

- `tools/license-admin/keys/dev/ed25519-private.pem` — **admin tooling only**, excluded from ASAR build
- `test-phase3-licensing-v6.js` verifies no private key in client trees — **PASS**
- V5 HMAC secret material in client — **SECURITY = WEAK** (not BROKEN like shipping Ed25519 private key)

## Activation Flow

```
Input → license-router → codec validate → license-store (localStorage) → UI success → restart re-validate
```

## Invariant: UI Success = Durable Commit

Unit tests PASS for happy path. Live Google pull + restart **UNVERIFIED**.

## Tests

- `license:test` — PASS
- `test-phase3-licensing-v6.js` — PASS
- `v2-5-8:auth-activation-ui` — static PASS

## Result

**LICENSE: PARTIAL** — V6 design sound; V5 legacy weak; live activation UNVERIFIED.
