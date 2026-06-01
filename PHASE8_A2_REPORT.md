# Phase 8 A2 Implementation Report

Date: 2026-06-01

## Scope

Implemented versioned deliverable storage and the Deliverables UI panel.

## Implemented

- Added `lib/deliverables.js`.
- Added per-run deliverable index: `rooms/<run>/deliverables.jsonl`.
- Added versioned markdown files under `rooms/<run>/deliverables/`.
- Added `kbDigest` over Knowledge Base sections.
- Added stale detection: deliverables are marked `stale` when the current KB digest differs from the digest captured at creation time.
- Added `run.deliverables` to `/api/state`.
- Updated `POST /api/deliverables/create` to store a versioned deliverable record in addition to the chat document.
- Added right-column Deliverables panel with version, status, stale badge, Copy, Packet, and Write actions.

## Verification

Commands run:

```powershell
node --check server.js
node --check public\app.js
node --check lib\templates.js
node --check lib\deliverables.js
npm test
```

Smoke test covered:

- Create resolved subtask.
- Generate `summary` deliverable.
- Confirm `/api/state` exposes `run.deliverables`.
- Mutate KB and confirm the previous deliverable becomes `stale`.
- Read deliverable content through `/api/deliverables/content`.

Result:

```text
PASS A2/B/C smoke: deliverables=3, mockHits=2
```

## Residual Risks

- The panel is intentionally compact and uses simple row actions; a richer version browser can be added later.
- Stale detection is digest-based over KB sections only; attached document changes do not currently mark deliverables stale.
