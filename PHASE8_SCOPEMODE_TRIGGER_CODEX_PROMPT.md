# Codex task prompt — Reliable scopeMode="proposal" trigger (broaden regex + UI toggle)

Implements PHASE8_DELIVERABLES_UI_PUNCHLIST.md item **F-KB2** — a small follow-up to the
per-subtask KB scope feature (F-KB, already landed). Recommended model: **gpt-5.3-codex** at
**high**. Read CLAUDE.md / DATA_SOURCES.md / HANDOFF.md first. Restart via
"Council Room v2.bat". PROJECT-AGNOSTIC.

## PROBLEM
The proposal-relaxation branch (on an empty `files_in_scope`, "do not block — propose a
minimal scope" instead of QUESTION/block) fires only when `subtask.scopeMode === "proposal"`.
`scopeMode` is set ONLY by `inferScopeMode(title, requested)` (server.js ~424) via
`SCOPE_PROPOSAL_RE` (server.js ~421):
```
/\b(scope proposal|scoping|scope definition|define scope)\b|предлож[её]н\w*\s+scope|определ[её]н\w*\s+scope|скоуп/i
```
This MISSES common scope-defining titles — e.g. "Propose … scope", "предложить scope",
"предложить чек-лист", "proposal-only", "scope + checklist" — and there is NO UI to set
`scopeMode` explicitly. Result: a real scope-defining subtask with an ordinary title stays
`scopeMode:"normal"` and still soft-blocks on empty scope. (Live: our Phase 13 subtask is
`scopeMode:"normal"`.)

## WHERE THINGS LIVE (verified)
- server.js: `SCOPE_PROPOSAL_RE` (~421), `inferScopeMode(title, requested)` (~424),
  `isScopeProposalSubtask(subtask)` → `scopeMode === "proposal"` (~430), used at the round
  build (~504, passed as `scopeProposal` to `buildDebatePrompt`). Subtask endpoints:
  `/api/subtasks/open` (~1481, calls `inferScopeMode(body.title, body.scopeMode)`),
  `/api/subtasks/edit` (~1534).
- lib/subtasks.js: `VALID_SCOPE_MODE = {normal, proposal}` (~6), `normalize` defaults
  `scopeMode:"normal"` (~24), `openSubtask({... scopeMode})` (~61), `editSubtask({... scopeMode})`
  (~113).
- lib/prompt.js: `STRICT_SCOPE_RULE` vs `STRICT_SCOPE_RULE_PROPOSAL`, selected by the
  `scopeProposal` flag (~151).
- UI: the open/edit-subtask modal in public/app.js (`openSubtaskModal`) + its markup in
  public/index.html; i18n dicts in public/app.js (RU + EN).

## TASK
1. **Broaden `SCOPE_PROPOSAL_RE`** so it also matches the common scope-defining phrasings,
   bilingual, without over-matching ordinary implementation titles. At minimum cover:
   - EN: `propose\w*` … `scope`; `scope\s*\+?\s*checklist`; `checklist outline`;
     `proposal-only`; `proposal` near `scope/checklist`.
   - RU: `предлож\w*` near `scope|скоуп|чек-?лист|checklist`; `proposal-only`.
   Keep the existing alternatives. Add a couple of unit assertions (a plain Node test, in the
   repo's test style) that titles like "Propose game_agent Phase 13 scope + checklist outline",
   "предложить scope + чек-лист", and "Фаза N: предложить scope" infer `"proposal"`, while a
   normal impl title (e.g. "Implement policy_hash field") stays `"normal"`.
2. **Explicit UI toggle** in the open-subtask modal: a checkbox/segment
   "Scope-proposal subtask (propose scope instead of blocking on empty Files-in-Scope)".
   When set, send `scopeMode:"proposal"` to `/api/subtasks/open` (and on edit). The explicit
   value must win over the title inference (it already does: `inferScopeMode` honors an
   explicit `requested`). Show the current mode on the subtask row/edit so the operator can
   see/flip it. Bilingual labels + a `tip.*` (RU+EN parity).
3. **Optional convenience** (only if cheap): an `editSubtask` path / small control to flip an
   existing subtask's `scopeMode` even after rounds (today `editSubtask` blocks edits when
   `rounds > 0` — allow toggling ONLY `scopeMode` regardless of rounds, since it changes no
   prompt scaffolding output, just the scope-rule branch). If this risks the snapshot or the
   rounds-guard contract, skip it and note why.

## CONSTRAINTS
- PROJECT-AGNOSTIC; the regex must not key off any project/phase name.
- Do NOT change `TAIL_CONTRACT` or the default (`scopeMode:"normal"`) prompt output —
  `npm test` incl. `test/prompt.snapshot.test.js` stays byte-for-byte green. The proposal
  branch must remain reachable ONLY for `scopeMode:"proposal"`.
- Bilingual UI (RU+EN), `tip.*` parity. No new deps; no build step.
- Do NOT weaken governance (resolved+optIn gate, write root, isolation).

## VERIFICATION (do this, report what you saw)
1. Open a subtask titled "Propose X scope + checklist outline" via the UI → confirm it gets
   `scopeMode:"proposal"` (round uses the propose-not-block rule on empty Files-in-Scope).
2. Open one with an ordinary impl title → stays `normal` (strict scope enforced).
3. Use the new toggle to force `proposal` on a subtask whose title would NOT match → confirm
   it takes effect.
4. `npm test` green incl. golden snapshot byte-for-byte; new inference assertions pass.
   Short before/after note.

## COMMIT ETIQUETTE (per CLAUDE.md)
- Commit only when asked; default branch `main`; narrow range (expect server.js,
  lib/subtasks.js, public/app.js, public/index.html, and a small test file).
- End the commit message with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
