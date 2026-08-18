# 23 — Document I/O Audit

## Print

| Type | Path | Status |
|------|------|--------|
| Thermal receipt | devices.js | UNVERIFIED (no printer) |
| A4 tax invoice | simplified-tax-invoice | SOURCE_CONFIRMED |
| Payroll print | cupping-production.js | UNVERIFIED |
| Print preload | preload-print.js sandbox | SOURCE_CONFIRMED |

## PDF / Export

- Tax invoice QR generation — unit tests
- XLSX import/export — import-studio, xlsx package

## Import

- Import Studio pipeline — `verify:import-studio` PASS
- Client import — `verify:client-import` PASS

## RTL / Unicode

- Arabic RTL in index.html — SOURCE_CONFIRMED
- Unicode print on real printer — UNVERIFIED

## Result

**DOCUMENT I/O: PARTIAL** (import verify PASS; print UNVERIFIED)
