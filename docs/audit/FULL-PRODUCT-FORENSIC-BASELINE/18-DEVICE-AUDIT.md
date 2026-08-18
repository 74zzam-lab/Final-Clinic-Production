# 18 — Device Audit

## Model

- Device ID + fingerprint in `device_registry_local`
- Remote registry on Google Drive
- License device limits (phase26)

## Idempotency

Registration code includes dedup logic — **SOURCE_CONFIRMED**.  
Double-click / retry on live EXE — **UNVERIFIED**.

## Tests

- `test-phase26-device-limits.js` — PASS (static)
- `v2-4:device-registry` — PASS (unit)

## Scenarios

| Scenario | Result |
|----------|--------|
| Same machine restart | UNVERIFIED |
| Fresh profile | UNVERIFIED |
| Second device join | UNVERIFIED (RB-01) |
| Device replacement | UNVERIFIED |

## Result

**DEVICE: UNVERIFIED**
