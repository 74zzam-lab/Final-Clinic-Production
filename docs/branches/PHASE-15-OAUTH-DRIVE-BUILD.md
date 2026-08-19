# Phase 15 — OAuth / Drive / Sheets build restore

**Branch:** `cursor/phase-15-oauth-drive-build-7c71`  
**Parent:** `cursor/phase-14-build-reliability-gates-7c71`

## Problem

After phase-0 git baseline, `electron/cloud-oauth.embedded.json` had `REPLACE_ME` placeholders. Builds packaged OAuth without working Google credentials.

GitHub push protection blocks committing OAuth secrets — credentials must be bootstrapped at build time (like original ZIP workflow).

## Fix

- **`scripts/bootstrap-oauth-for-build.mjs`** — resolves credentials from (in order):
  1. Local `electron/cloud-oauth.embedded.json` (gitignored)
  2. `electron/cloud-oauth.config.local.json`
  3. `vendor/cloud-oauth.embedded.json` (gitignored drop-in)
  4. `Final Stage-Clinic-Production.zip` at repo root (original bundle)
  5. OS machine store (`NajjarTech/cloud-oauth.local.json`)
  6. `GOOGLE_OAUTH_*` environment variables
- **`prebuild`** runs bootstrap → `generate-oauth-config.mjs --strict`
- **Template** `electron/cloud-oauth.embedded.template.json` (no secrets in git)
- **License/Sheets vault** unchanged in `license/license-vault.defaults.json`

## Windows automatic build

If you have the original ZIP in the project folder:

```bat
npm ci
npm run build:prod
```

Bootstrap extracts OAuth from `Final Stage-Clinic-Production.zip` automatically.

Alternative: copy credentials once to `vendor/cloud-oauth.embedded.json` (see `vendor/cloud-oauth.embedded.example.json`).

## Verification

```bash
node scripts/verify-oauth-build-packaging.js
npm run verify:oauth-build-packaging
```

## Operator UAT (you)

1. Place original ZIP or `vendor/cloud-oauth.embedded.json` → `npm run build:prod` succeeds
2. Installed app → Google OAuth test passes
3. Drive connect + license vault reach Google
