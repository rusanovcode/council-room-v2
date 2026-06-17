# Codex task prompt — Smart default target path for deliverable delivery (F-PATH)

Implements PHASE8_DELIVERABLES_UI_PUNCHLIST.md item **F-PATH**. Recommended model:
**gpt-5.3-codex** at **high**. Read CLAUDE.md / DATA_SOURCES.md / HANDOFF.md first. Restart
via "Council Room v2.bat" (port 8788). PROJECT-AGNOSTIC — no hardcoded project/phase/path.

## PROBLEM (found live)
Apply / Write / Packet prompt for the target path via `promptDeliverableTargetPath(id, {...})`
(public/app.js). It pre-fills only `knownDeliverableTargetPath(id)` — the REMEMBERED last path,
set AFTER the first successful delivery. So the FIRST delivery shows an empty field; the
operator typed a FOLDER once (`...\docs`) and the write silently failed (you can't write a file
over a directory). There is NO smart first-time default derived from the subtask/template.

## GOAL
Pre-fill the path prompt with a useful default the first time, and reject directory paths with
a clear message. Keep the existing "remember last path" behavior.

## WHERE THINGS LIVE (verified)
- public/app.js: `promptDeliverableTargetPath(id, { requireAbsolute })`,
  `knownDeliverableTargetPath(id)`, `rememberDeliverableTargetPath(id, path)`,
  `deliverableTargetPathHints` (map), `isAbsoluteTargetPath(path)`,
  `applyDeliverable` / `writeDeliverable` / `packetDeliverable`. i18n:
  `ui.applyTargetPathPrompt`, `ui.targetPathPrompt`, `ui.applyAbsoluteRequired` (RU+EN dicts).
- Deliverable object carries `template` (summary | checklist | closure-review) and `subtaskId`.
  The subtask (its `title`) is in `currentState.run.subtasks` (find by `deliverable.subtaskId`).
- Server: `applyDeliverable` / `writeDeliverable` (server.js ~1077/1095), `lib/deliverables.js`
  `resolveTarget` / `write` — where an existing-directory target should be rejected cleanly.

## TASK
1. **Smart default filename** (front-end, in/around `knownDeliverableTargetPath` /
   `promptDeliverableTargetPath`): when there is no remembered path for this deliverable,
   compute a default from the subtask + template:
   - Extract a phase number from the subtask title with a GENERIC regex (e.g. `Фаза\s*(\d+)` or
     `Phase\s*(\d+)`, case-insensitive). If found, base name = `phase<N>_<template>` →
     e.g. `phase13_checklist.md`.
   - Else, slug the subtask title (lowercase, non-alnum → `_`, trimmed, capped ~40 chars) +
     `_<template>.md`; final fallback `<template>.md`.
   - Directory part: reuse the chat's most-recent delivery directory if known (track a
     chat-level last dir alongside `deliverableTargetPathHints`), so only the filename is new;
     otherwise leave the directory for the operator (filename-only default is still helpful).
   - The operator can always edit the pre-filled value. Remembered exact path (2nd time) still
     wins over the derived default.
2. **Reject directory targets with a clear message** (both layers):
   - Front-end: if the entered path ends with a path separator or has no filename/extension,
     show a clear error ("target must be a FILE path, not a folder — e.g. add
     `phase13_checklist.md`") before POSTing. New i18n key, RU+EN.
   - Server (`lib/deliverables.write` / `resolveTarget`): if the resolved target is an existing
     directory, throw a clear error instead of letting `fs.writeFileSync` fail with a raw
     EISDIR. Surface it to the Deliverables panel message.
3. Keep `rememberDeliverableTargetPath` and the `requireAbsolute` check for Apply unchanged.

## CONSTRAINTS
- PROJECT-AGNOSTIC: the phase-number/slug heuristic must not key off any project name; the
  template comes from the deliverable. No hardcoded paths.
- UI only + a small server-side guard; do NOT change `TAIL_CONTRACT`, `lib/prompt.js`, or
  domain profiles. `npm test` incl. `test/prompt.snapshot.test.js` stays byte-for-byte green.
- Do NOT weaken governance: Apply still requires absolute path + explicit confirm +
  `allowExternal`; default Write stays app-folder-only.
- Bilingual (RU+EN) for any new string; `tip.*` parity. No new deps; no build step.

## VERIFICATION (do this, report what you saw)
1. On a NEVER-delivered deliverable whose subtask title is "Фаза 13 … checklist", open Apply →
   the path prompt is pre-filled with a sensible default ending in `phase13_checklist.md`
   (filename at least; full path if a chat dir is known).
2. Enter a folder path (e.g. `C:\AI\game_agent\docs`) → clear "must be a file path" message,
   no silent failure; nothing written.
3. Enter a full file path → writes; a second Apply pre-fills that remembered path.
4. A summary-template deliverable on a non-phase title → default like `<slug>_summary.md`.
5. `npm test` green incl. golden snapshot byte-for-byte. Short before/after note.

## COMMIT ETIQUETTE (per CLAUDE.md)
- Commit only when asked; default branch `main`; narrow range (expect public/app.js,
  lib/deliverables.js, maybe server.js).
- End the commit message with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
