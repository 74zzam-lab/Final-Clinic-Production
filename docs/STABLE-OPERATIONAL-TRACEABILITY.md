# Stable Operational Core — Traceability

Independent verification plan (not relying on legacy test PASS claims).

| Branch | Phase | Status | Operator UAT |
|--------|-------|--------|--------------|
| `cursor/phase-0-git-baseline-7c71` | 0 — Git baseline | DONE | — |
| `cursor/phase-1-sqlite-sot-7c71` | 1 — SQLite SoT | DONE (code) | Required after merge |
| `cursor/phase-2-transactions-crash-7c71` | 2 — Atomic transactions | DONE (code) | Required after merge |
| `cursor/phase-3-remove-backup-encryption-7c71` | 3 — Backup V2 plaintext | DONE (code) | Required after merge |
| `cursor/phase-4-branch-sql-isolation-7c71` | 4 — Branch SQL isolation | DONE (code) | Required after merge |
| `cursor/phase-5-branch-switch-hardening-7c71` | 5 — Branch switch re-hydrate | DONE (code) | Required after merge |
| `cursor/phase-6-sync-guards-7c71` | 6 — Sync guards | DONE (code) | Required after merge |

## Branch naming

`cursor/phase-<N>-<short-name>-7c71`

Each branch includes `docs/branches/PHASE-<N>-*.md` and descriptive commits.

## Phase 0 — Git baseline

**Goal:** Publish full source tree (replace ZIP-only `main`).

**Deliverables:**
- Complete application source at repo root
- This traceability index
- `docs/branches/PHASE-0-GIT-BASELINE.md`

**Not included:** Runtime behavior changes.

## Phase 1 — SQLite source of truth

**Goal:** Operational data reads/writes authoritative via SQLite; localStorage cache-only.

**Code targets:**
- `index.html` — `DB.get` delegates operational keys to `SqliteBridge.readOperational`
- `cupping-sqlite-bridge.js` — memory SoT, read-through, boot hydrate, no LS read for operational when Electron present

**Operator UAT (you):**
1. Create patient → close app → reopen → same data
2. Clear localStorage in DevTools after login → operational data still from SQLite
3. Restart after save (patient, invoice, booking)

## Phase 3 — Backup V2 plaintext

**Goal:** New `.tdw` backups are plaintext ZIP; no password on create/schedule/restore. Legacy encrypted import only.

**Operator UAT (you):**
1. Create backup without password
2. Restore without password
3. Scheduled backup without stored password
4. Legacy encrypted file requires password

## Phase 4 — Branch SQL isolation

**Goal:** Branch-scoped SQLite writes; cross-branch row wipe prevented; IPC `getById` enforces branch.

**Operator UAT (you):**
1. Clients on BR-A and BR-B — save on A → B rows remain in DB
2. Cross-branch id read via IPC → denied

## Phase 5 — Branch switch hardening

**Goal:** Switch branch re-hydrates from SQLite; UI shows active branch only; writes merge without cross-branch memory corruption.

**Operator UAT (you):**
1. Data on BR-A and BR-B — switch branches → correct lists
2. No stale rows from previous branch in operational forms

## Phase 6 — Sync guards

**Goal:** Block empty push, localRev=0 destructive push, stale remote overwrite.

**Operator UAT (you):**
1. New device + cloud data → pull before push
2. Empty export does not wipe Drive

## Deferred phases (7–14)

See planning doc in agent conversation — not started on this branch.
