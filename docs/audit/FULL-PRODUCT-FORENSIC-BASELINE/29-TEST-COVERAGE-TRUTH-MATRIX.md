# 29 — Test Coverage Truth Matrix

## Classification of `npm test` (106 suites)

| Type | Approx Count | Proves Production? |
|------|-------------|-------------------|
| REGEX / STATIC CONTRACT | ~60 | **NO** |
| UNIT (mocked DB/fs) | ~25 | **NO** |
| INTEGRATION (node spawn) | ~15 | **PARTIAL** |
| PRODUCTION-PATH (installed EXE) | 0 in npm test | **NO** |
| WINDOWS UAT scripts | ~10 (separate, not run) | **YES if run** — NOT RUN |

## Critical Bug vs Test

| Bug | Would Test Fail? |
|-----|------------------|
| Device A/B sync data loss | **NO** — simulated unit only |
| Live OAuth failure | **NO** |
| Backup V1 wrong restore | **PARTIAL** — v2-5-10 stage1 gates V1 but not UI removal |
| Dual persistence divergence | **NO** |
| isBenignCloudErr hiding errors | **NO** |
| Scenario C restore hang | **NO** — harness not installed path |

## False Confidence Risk

**106/106 PASS creates false release confidence** per executive summary — confirmed in this audit.

## Result

**TEST TRUTHFULNESS: LOW** for production readiness; **HIGH** for wiring/static contracts.
