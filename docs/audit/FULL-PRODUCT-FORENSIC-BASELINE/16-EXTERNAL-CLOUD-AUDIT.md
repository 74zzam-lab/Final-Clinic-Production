# 16 — External Account / Cloud Audit

## Integration: Google Drive OAuth

| Flow | Implementation | Status |
|------|----------------|--------|
| Connect | `oauth-loopback.js` + embedded config | UNVERIFIED live |
| Disconnect | token-store clear | UNVERIFIED |
| Reconnect | OAuth refresh | UNVERIFIED |
| Wrong account | UI reconciliation | UNVERIFIED |
| Token expiry | google-auth-library refresh | UNVERIFIED |
| Restart | token-store persistence | UNVERIFIED |

## Token Storage

- `electron/cloud-providers/token-store.js`
- Embedded OAuth config: `cloud-oauth.embedded.json` (K-05: secret by owner request)

## Multiple "Connected" Implementations

- BootFlow Google step
- Settings cloud panel
- License Drive pull
- Hidden login panel

**Risk:** stale external state, double login — UNVERIFIED

## isBenignCloudErr Suppression

`index.html:10762` suppresses errors matching cloud module ReferenceErrors — may hide real load failures.

## Result

**EXTERNAL CLOUD: UNVERIFIED (FAIL for release)**
