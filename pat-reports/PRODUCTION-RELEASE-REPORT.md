# Production Release Gate Report

**Date:** 2026-08-18
**Version:** 2.0.1
**Product:** Hijama Management System
**Decision:** READY_UNSIGNED_INTERNAL

## Blocking

- none

## Warnings

- REL-08: no CSC_LINK — READY_UNSIGNED_INTERNAL; Windows host + certificate still required for public signed release (K-32)

## Checks

| ID | OK | Level | Detail |
|----|----|-------|--------|
| REL-01 | YES | blocking | version=2.0.1 |
| REL-02 | YES | blocking | productName must match branding |
| REL-03 | YES | blocking | nsis config present |
| REL-04 | YES | blocking | artifactName includes version |
| REL-05 | YES | blocking | cloud files packaged |
| REL-06 | YES | blocking | better-sqlite3 unpacked |
| REL-BRAND | YES | blocking | Generated BMP: Installer-Sidebar, Uninstaller-Sidebar, Installer-Header / Logo resize: downscale only (no upscale beyond source resolution) / App icon preserved: /workspace/extracted/Tadawi-Clinic-Production-cursor-v2-5-10-final-consolidation-cea9/build/Program-Icon.ico (valid Windows ICO) |
| ASSET:Program-Icon.ico | YES | blocking | build/Program-Icon.ico |
| ASSET:Installer-Sidebar.bmp | YES | blocking | build/Installer-Sidebar.bmp |
| ASSET:Installer-Header.bmp | YES | blocking | build/Installer-Header.bmp |
| ASSET:Uninstaller-Sidebar.bmp | YES | blocking | build/Uninstaller-Sidebar.bmp |
| ASSET:installer.nsh | YES | blocking | build/installer.nsh |
| ASSET:installer-branding.nsh | YES | blocking | build/installer-branding.nsh |
| SCRIPT:fpv-final-production-validation.mjs | YES | blocking | scripts/fpv-final-production-validation.mjs |
| SCRIPT:rc-validation.mjs | YES | blocking | scripts/rc-validation.mjs |
| SCRIPT:code-freeze-gate.mjs | YES | blocking | scripts/code-freeze-gate.mjs |
| SCRIPT:release-evidence-bundle.mjs | YES | blocking | scripts/release-evidence-bundle.mjs |
| SCRIPT:validate-production-deps.mjs | YES | blocking | scripts/validate-production-deps.mjs |
| REL-07 | YES | blocking | installer.nsh policy ok |
| REL-08 | YES | warning | afterPack/resedit icon embed; Authenticode cert still required for public Stable (K-32) |
| REL-09 | YES | blocking | ✓ Production dependency validation passed /   • google-auth-library /   • fflate |

## Manual Windows checklist

- [ ] Build NSIS installer on Windows host
- [ ] Validate installer branding (icon/sidebar/header)
- [ ] Optional: Authenticode sign with NajjarTech certificate
- [ ] Smoke-test First Run + print + backup on Windows
- [ ] Confirm zero console errors on installed build
