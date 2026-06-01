# Phase 8 A1 Implementation Report

Date: 2026-06-01

## Scope

Implemented the first safe increment of Phase 8: in-chat post-consensus authoring.

This increment does not write deliverables to external project files. Generated
documents are added to the chat transcript and attached as chat documents, so the
delivery mode is copy/manual handoff only.

## Implemented

- Added `lib/templates.js` as the Phase 8 template registry.
- Added built-in templates:
  - `summary` (local, zero-token builder)
  - `checklist` (agent-authored markdown prompt)
  - `closure-review` (agent-authored markdown prompt)
- Added `POST /api/deliverables/create`.
- Added `deliverableTemplates` to `/api/state`.
- Added a `Doc` action on resolved subtasks in the UI.
- Added bilingual UI strings/tooltips for the new action.
- Generated deliverables are:
  - inserted into the transcript as `kind: "deliverable"`
  - attached through the existing chat-document store (`documents.jsonl`)
  - blocked unless the source subtask is already `resolved`
- Agent-authored deliverables run isolated (`isolated: true`) and reuse the existing
  participant/profile runner.
- Author/reviewer self-review is guarded when reviewer is provided or inferred.
- API errors now surface server error text in the browser client.

## Not Implemented Yet

These are intentionally left for later Phase 8 increments:

- A2 deliverables panel, versioning, stale detection, and `deliverables.jsonl`.
- B gated-write primitive, overwrite setting, diffs, backups, and handoff packets.
- C execution autopilot draft/review/revise loop.

## Verification

Commands run:

```powershell
node --check server.js
node --check public\app.js
node --check lib\templates.js
npm test
git diff --check -- server.js public/app.js lib/templates.js
```

Additional smoke test:

- Started the server on temporary port `18788`.
- Created a temporary chat.
- Opened and resolved a temporary subtask.
- Added a KB decision.
- Called `POST /api/deliverables/create` with `{ template: "summary", authorSlot: "local" }`.
- Verified a `summary-...md` chat document was returned.
- Deleted the temporary chat.

Result:

```text
PASS summary-st_96fff51e-generate-local-summary-deliverab.md 796
```

## Residual Risks

- The minimal A1 UI uses prompt dialogs rather than a full selector panel.
- Agent-authored checklist/closure-review generation was not smoke-tested with a
  real external model to avoid launching paid/real agent calls during implementation.
- Deliverable text is capped by the existing chat-document limit (`MAX_DOC_CHARS`).
