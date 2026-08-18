# 28 — Performance Baseline

**Not optimized — measurement only where possible.**

| Operation | Small | Medium | Large | Result |
|-----------|-------|--------|-------|--------|
| npm test suite | 106 tests ~52s | — | — | MEASURED |
| Startup | — | — | — | UNVERIFIED |
| Login | — | — | — | UNVERIFIED |
| Large table load | — | — | — | UNVERIFIED |
| Sync large queue | v2-4:large-queue unit | — | — | UNIT only |
| Backup | — | — | — | UNVERIFIED |
| v2-5-5 perf bench | script exists | — | — | NOT RUN |

## Future Needs (Source Indicators)

- Pagination for large client lists
- Indexes on branch_id, dates (partial in schema)
- Streaming for large backup files
- Lazy loading for Owner Hub

## Result

**PERFORMANCE: UNVERIFIED** for product runtime.
