# Codex task prompt — Universal "Apply" button for a ready deliverable

Implements PHASE8_DELIVERABLES_UI_PUNCHLIST.md item **16**. Recommended model:
**gpt-5.3-codex** at **high** effort. This is the ONE task that deliberately relaxes the
Phase 8 narrowed write root — under an explicit per-write confirm. Read CLAUDE.md /
DATA_SOURCES.md / HANDOFF.md first. Restart via "Council Room v2.bat" (port 8788).

## CONTEXT / NON-NEGOTIABLE FRAMING
Council Room is a PROJECT-AGNOSTIC tool. The target project and path are whatever the
operator set on the deliverable (the existing Packet/Write "target path"). NEVER hardcode a
project name, task id, or path (game_agent / phase12 / session_state are only today's
example). Anything you build must work for any future project the operator points it at.

## WHAT EXISTS TODAY (verified pointers)
- Deliverable rows: public/index.html `#deliverablesList`; row markup + buttons in
  public/app.js (~4882-4887: `.del-copy` / `.del-packet` / `.del-write`); click handler
  ~5534; `copyDeliverable` / `packetDeliverable` / `writeDeliverable` ~5068-5096.
- Server: `/api/deliverables/write` (~1635) → `writeDeliverable(body)` → `deliverables.write(
  runDir, id, targetPath, { roots: deliveryRoots(), ... })`. `deliveryRoots()` returns
  `{ root: ROOT }` (app folder ONLY — Phase 8). `/api/deliverables/preview-write` (~1060),
  `/api/deliverables/packet` (~1648).
- lib/deliverables.js: `resolveTarget(targetPath, roots)` REFUSES any path outside
  `roots.root`/`roots.workdir` ("Refusing to write outside allowed roots"). `write(...)`
  already: previews, backs up an existing file (`.bak-<ts>`), writes atomically (tmp+rename),
  and marks the deliverable `status:"delivered"` with `lastDelivery {at,targetPath,mode,
  backupPath}`. Reuse all of this.
- Subtasks: `lib/subtasks.js` `openSubtask(runDir, {title, mode, parentId})`; server has a
  subtask-open endpoint (the "+"/openSubtask path). The chat's own subtask stack is the
  generic "next task" target.

## TASK

### 1. Server — gated external write (the governance relaxation)
- Add an `allowExternal` capability to the write path. Default behavior (the existing Write
  button) stays app-folder-only. When `allowExternal` is true, `resolveTarget` may resolve to
  an operator-specified ABSOLUTE path outside the app folder.
  - Implement by extending `resolveTarget(targetPath, roots)` to accept an
    `{ allowExternal }` option (or a roots shape that signals it): when set, an absolute
    `targetPath` is allowed as-is; when not set, keep today's strict in-root check.
  - Plumb a new endpoint `POST /api/deliverables/apply` (do NOT weaken the existing
    `/write`): body `{ id, targetPath, allowOverwrite, confirm:true, allowExternal:true }`.
    Require `confirm:true` AND a non-empty absolute `targetPath`; otherwise 400. Reuse
    `deliverables.write` with roots that permit the external target only for this call.
  - Keep backups + atomic write (already in `write`). Never write silently.
- Optionally also: `POST /api/deliverables/apply-preview` mirroring preview-write but with
  `allowExternal`, so the UI can show the resolved absolute path + diff in the confirm.

### 2. Server — "form next task" (generic, app's own stack)
- After a successful apply, support opening the NEXT Council Room subtask in the same chat
  via the existing `openSubtask` machinery. Either piggyback on the apply response or expose
  it to the UI so the button flow can create it. Pre-fill nothing project-specific; let the
  operator name it (prompt/inline), default a neutral title (e.g. "Next subtask").
- Do NOT touch or assume anything about the EXTERNAL target project's task state
  (session_state, foreign files). That is out of scope and impossible generically.

### 3. Frontend — the "Apply" button
- Add an **Apply** button to each `status:"ready"` deliverable row (next to Copy/Packet/
  Write). Label via new i18n key `ui.apply` (RU + EN).
- Flow on click: read/confirm the target path (reuse the deliverable's stored target path if
  present, else ask once), call apply-preview, show ONE confirm dialog displaying the
  resolved ABSOLUTE path + new/overwrite + diff (reuse `ui.confirmWriteNew`/`confirmOverwrite`
  patterns, extended to say the write is OUTSIDE the app folder when it is). On confirm, call
  `/api/deliverables/apply`. On success show a clear message (`ui.applyDone`) and offer/þ
  create the next subtask (step 2).
- Tooltip (`tip.apply`, RU+EN) explaining: Apply writes the deliverable to the chosen target
  path (may be outside the app folder) under explicit confirm, then can open the next
  subtask; it does NOT modify the target project's own task tracking.

### 4. Tie-in with the navigator (item 15, if already present)
- If `coach.delivered` exists, it should offer BOTH paths: "Apply" (this button) OR the
  manual Packet/operator-session handoff. Keep wording project-agnostic (interpolate the
  deliverable's template/target path).

## CONSTRAINTS
- PROJECT-AGNOSTIC everywhere; no hardcoded project/task/path.
- Bilingual: new strings (`ui.apply`, `ui.applyDone`, `tip.apply`, any confirm text) in BOTH
  RU and EN dicts; RU/EN parity (CLAUDE.md).
- Do NOT change `TAIL_CONTRACT`, `lib/prompt.js`, domain profiles; `npm test` (incl.
  `test/prompt.snapshot.test.js`) stays green.
- Keep ALL other governance intact: the external write is allowed ONLY through the new
  confirmed Apply path with `confirm:true`; the default Write button and agent-driven flows
  remain app-folder-only. Keep CLI isolation and the resolved+optIn exec gate untouched.
- Backups always; atomic write; never silent. No new dependencies; no build step.

## VERIFICATION (do this, report what you saw)
1. Restart via "Council Room v2.bat"; open a chat with a `ready` deliverable; expand
   Deliverables.
2. Apply button present on the ready row with a tooltip. Click → confirm shows the resolved
   ABSOLUTE target path (point it at a path OUTSIDE the app folder, e.g. a scratch dir) + diff.
3. Confirm → file is written at that external path, a `.bak-*` is made if it existed, the
   deliverable flips to `status:"delivered"`, and a clear success message shows.
4. The flow offers to open the next subtask in the chat (generic title); confirm no attempt
   is made to touch any external project's task files.
5. The default **Write** button still refuses external paths (unchanged). `npm test` green
   (snapshot byte-for-byte). Short before/after note + screenshot.

## COMMIT ETIQUETTE (per CLAUDE.md)
- Commit only when asked; default branch `main`; NARROW range (expect public/app.js,
  public/index.html, public/styles.css, server.js, lib/deliverables.js, maybe lib/subtasks.js).
- End the commit message with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
