# 27 — Async / Race Condition Audit

## High-Risk Async Patterns

| Pattern | Location | Guard Present | Guard Used |
|---------|----------|---------------|------------|
| Cloud sync after navigation | sync-engine.js | generation IDs partial | UNVERIFIED |
| Setup wizard async steps | setup-state-service | revision merge | SOURCE_CONFIRMED |
| Restore download | backup-v2-transfer | timeout partial | UNVERIFIED |
| License pull | license-router | UNVERIFIED | UNVERIFIED |
| Search debounce | index.html | UNVERIFIED | UNVERIFIED |

## Stale Completion Risks

- Async cloud init finishing after user logs out — **UNVERIFIED**
- Restore progress after cancel — **UNVERIFIED**
- Branch switch during sync push — **UNVERIFIED**

## Result

**ASYNC/RACE: UNVERIFIED** — guards exist in places; production-path proof missing.
