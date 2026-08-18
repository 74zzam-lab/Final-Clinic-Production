# Stable Operational Core — Traceability

Independent verification plan (not relying on legacy test PASS claims).

| Branch | Phase | Status | Operator UAT |
|--------|-------|--------|--------------|
| `cursor/phase-0-git-baseline-7c71` | 0 — Git baseline | DONE | — |
| `cursor/phase-1-sqlite-sot-7c71` | 1 — SQLite SoT | DONE (code) | Required after merge |

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

## Deferred phases (2–14)

See planning doc in agent conversation — not started on this branch.
