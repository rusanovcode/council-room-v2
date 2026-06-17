# Codex task prompt — Deliverables panel: bug-fixes & UI polish

Hand this file to Codex as the implementation task. Recommended model: **gpt-5.3-codex**
at **high** effort (execution of an already-diagnosed punch-list, not open-ended design).

This is the follow-up to PHASE8_EXEC_FORM_CODEX_PROMPT.md (which replaced the exec
prompt() chain with the inline dropdown form). The form now exists; this task fixes the
bugs and rough edges found during a live Phase 12 verification run. The authoritative
list is PHASE8_DELIVERABLES_UI_PUNCHLIST.md — implement all 11 items below.

---

REPO: Council Room v2 (Node, zero-framework backend `server.js` + `lib/*`, vanilla
`public/` frontend, no build step). Read CLAUDE.md, DATA_SOURCES.md, HANDOFF.md first.
Run/restart via "Council Room v2.bat" (port 8788); a code change needs an ACTUAL
server-process restart, not just `node --check`.

WHERE THINGS LIVE (verified pointers):
- Panel markup: `public/index.html` — `#deliverablesPanel` (~329), `<summary>` with
  `data-i18n="ui.deliverables"` + `data-tooltip-key="t.deliverables"` (~331), the
  autopilot form `#deliverablesExecForm` (~337: selects `#execSubtask`, `#execTemplate`,
  `#execAuthor`, `#execReviewer`, button `#execAutopilot`), the doc form
  `#deliverablesDocForm` (~356: `#docTemplate`, `#docAuthor`, button `#generateDoc`),
  and the status line `#deliverablesMsg` (~367).
- Frontend logic: `public/app.js`
    * i18n dicts: RU ~line 20-50, EN ~line 456-486. `ui.execAutopilot` (RU ~46 / EN ~482),
      `ui.deliverables` (RU ~34 / EN ~470), `ui.docTemplateLabel`/`ui.docAuthorLabel`
      (RU ~27-28 / EN ~463-464). Tooltips `tip.deliverables` / `tip.generateDoc`
      (RU ~111-112 / EN ~547-548).
    * Dropdown/agent-pool plumbing: `buildDeliverablesActorPool()` (~4290),
      `agentCatalog()` (~3912), `backendFromCatalogEntry()` (~4268),
      `actorDisplayLabel(label, backend)` (~4286), `ensureDeliverablesFormState()` (~4330),
      `syncDeliverablesFormFromDom()` (~4358), `actorChoiceFromId()` (~4378),
      `optionsHtml()` (~4387), `renderDeliverables()` (~4398).
    * Highlight machinery (reuse, don't reinvent): `applyNavHighlights(ids)` (~1412),
      coach step `highlight: [...]` wiring (~1425), CSS `.nav-highlight` in
      `public/styles.css` (~1328, `--orange` pulsing frame).
- Backend: `server.js` — `runExecutionAutopilot()` (~1048-1122), the author call
  `runAuthoringRole(author, ...)` (~1078, draft is ONLY `broadcastStream`ed + written to
  a file; NOT added to the feed), the reviewer message `addMessage({ kind:
  "deliverable-review" })` (~1090), empty-draft guard (~1079),
  `prepareExecutionAutopilot()` (~1029, `pickParticipant` throws "Unknown participant"),
  `runAuthoringRole()` (~846, `roles.runRole` failover chain, throws on `!result.ok`).

---

## TASKS (all 11; numbers match PHASE8_DELIVERABLES_UI_PUNCHLIST.md)

1. **Signal-highlight the exec dropdowns.** Give `#execTemplate`, `#execAuthor`,
   `#execReviewer` (the autopilot form) the same orange pulsing `.nav-highlight` frame the
   Deliverables panel uses, as a "fill these, then press" cue. Apply it while the form is
   ready and NOT running; clear it once **Execution autopilot** is pressed (and while
   `execAutopilot.running`). Reuse `.nav-highlight` / `applyNavHighlights`; do not invent
   a new animation.

2. **Localize the "Execution autopilot" button.** `ui.execAutopilot` is the same English
   string in both dicts. Give the RU dict a proper Russian label; keep EN as is. The
   button uses `data-i18n="ui.execAutopilot"` and the running-state label `ui.autopilotStop`
   — make sure both render in the active language.

3. **Box + explain the Doc form.** Visually separate `#deliverablesDocForm` into its own
   framed block with a header that states its purpose: ONE agent, NO review — versus the
   autopilot block above (author + reviewer with a PASS/FAIL loop). Add a `?` tooltip
   (`tip.docForm` or similar, RU+EN) explaining the Doc path. Localize the field labels
   `ui.docTemplateLabel` / `ui.docAuthorLabel` and the `#generateDoc` button label
   (`ui.generateDoc`) for the active language.

4. **Localize the panel title.** `ui.deliverables` is "Deliverables" in both dicts. In RU
   show a Russian name with "(Deliverables)" in parentheses; keep EN as "Deliverables".

5. **Let the operator choose ACCOUNT + MODEL + EFFORT, not just a pre-picked model.**
   Today `agentCatalog()` emits one entry per (tool, account) locked to a single
   `defaultModel` (`weakModelFor(...)`), and `actorDisplayLabel()` renders
   `label · model · effort` WITHOUT the account — so the operator cannot pick the desired
   account/model/effort, only a pre-baked default. Fix so the author/reviewer dropdowns
   let the operator actually choose account + model + effort:
     - Include the account in the option display: `label · account · model · effort`.
     - Make model and effort selectable for a chosen backend (e.g. expand catalog entries
       into the real available model/effort combos, or add small model/effort selectors
       next to author/reviewer). The chosen account+model+effort MUST be what is sent to
       and used by exec-autopilot — verify it arrives in the backend (not silently
       replaced by the weak default).
   Keep the existing author != reviewer enforcement (compare by `identity`).

6. **Persistent run status.** `#deliverablesMsg` must stay visible for the WHOLE run —
   from pressing Execution autopilot until the deliverable is produced or the run halts —
   instead of flashing once. Show live progress (e.g. "drafting (iteration N)…" →
   "reviewing…" → "PASS / FAIL / halted"). Drive it from `execAutopilot` state
   (`running`, `iteration`, `reason`) and the SSE stream; only clear/replace it when the
   run ends.

7. **Persist the author's draft to the feed (ROOT-CAUSE bug).** `runExecutionAutopilot()`
   only `broadcastStream`s the author draft live and writes it to a file — it never
   `addMessage`s it, while the reviewer's review IS added (`kind: "deliverable-review"`).
   After a run the feed shows reviews but no drafts, so the operator concludes the author
   produced nothing. Add a persistent feed message for EACH draft iteration, parallel to
   the review message: `addMessage({ role: "agent", name: "<author.label> · draft N",
   kind: "deliverable-draft", text: draft, subtaskId, slot: author.slot })`. Make sure the
   frontend renders `kind: "deliverable-draft"` (mirror how `deliverable-review` is shown).

8. **Friendly empty-draft message.** The empty-draft guard already exists
   (`if (!draft.trim()) throw "Execution draft is empty"`; review is NOT run on an empty
   draft — keep that). Surface it in the UI as a clear message
   (e.g. "Author produced no draft — review skipped; re-run or pick another author"),
   not a raw thrown-error string. Add the i18n key in RU+EN.

9. **Real usage-cap failover / clear halt.** Author/reviewer backends may be single-account
   (no failover link). If a CLI account genuinely hits its daily cap or auth-fails
   mid-author/review, exec-autopilot currently halts with a generic
   "CLI failed exitCode -1". Improve: if the chosen backend has a failover link, use it on
   a usage-cap/auth failure (the `roles.runRole` chain already supports failover — make
   sure exec-autopilot passes a chain when one is configured); if none, halt with a clear,
   operator-readable message that names the cause (account/cap), not just the raw exit
   code. Do NOT fabricate failover when there is no configured backup. (Note: this did not
   actually trigger in the verification run — that stop was a manual Stop — so treat it as
   hardening, and test it with a deliberately bad/exhausted backend.)

10. **Stale/confusing feed error lines.** Drop the now-impossible "Unknown participant: N"
    path for exec-autopilot (author/reviewer are dropdowns of valid pool ids now —
    `pickParticipant`/the resolver should never see a bare number). And visually
    de-emphasize or clear superseded `process`/error lines so a NEW run's real state is
    unambiguous and old "aborted"/error lines aren't read as the current run's failure.

11. **Refresh the tooltips.** Rewrite `tip.deliverables` and `tip.generateDoc` (RU+EN) to
    match the new inline-dropdown form: inherited subtask, template ▾, author ▾ / reviewer ▾
    from the full agent pool (account·model·effort), Doc = one agent / autopilot = author+
    review. Drop the old `prompt()`-era wording ("author codex, reviewer claude"). Keep
    RU/EN parity.

---

CONSTRAINTS:
- Bilingual UI: every new/changed string in BOTH the RU and EN i18n dicts; every `?`
  tooltip key (`tip.*`) present in both — keep RU/EN parity (CLAUDE.md).
- Do NOT change `TAIL_CONTRACT`, `lib/prompt.js` scaffolding, or domain profiles.
  `test/prompt.snapshot.test.js` must still pass (`npm test`).
- Do NOT weaken Phase 8 governance: keep the double gate (subtask `resolved` AND
  `optIn:true`), the narrowed write root, and CLI isolation (`isolated: true`,
  throwaway temp cwd outside C:\AI). UI/visibility changes only must not touch these.
- No new dependencies; no build step. Do not sweep unrelated modified files into scope.

VERIFICATION (do this, report what you saw):
1. Restart via "Council Room v2.bat" and drive it in the browser at localhost:8788.
2. Open the Phase 12 chat (a resolved subtask exists), expand Deliverables.
3. Confirm: orange highlight on the three exec dropdowns until you press the button (1);
   RU button label + RU panel title with "(Deliverables)" (2,4); the Doc form is a
   separate framed block with a `?` (3); author/reviewer options show
   `label · account · model · effort` and you can pick a non-default model/effort that
   actually reaches the backend (5).
4. Run Execution autopilot to completion (do NOT press Stop): confirm the status line
   stays up with live progress (6), the author's draft appears as a feed message every
   iteration (7), and a `checklist` deliverable is produced (PASS) or a halted deliverable
   with the review attached.
5. Force an empty/failed author (e.g. a deliberately bad backend) and confirm the friendly
   messages (8,9) instead of raw errors; confirm no "Unknown participant" path is
   reachable from the dropdowns (10). Confirm refreshed tooltips (11).
6. `npm test` stays green. Provide a short before/after note (and screenshots if possible).

COMMIT ETIQUETTE (per CLAUDE.md):
- Commit only when asked; default branch is `main`.
- Commit a NARROW range — expect `public/app.js`, `public/index.html`, `public/styles.css`,
  `server.js`, and possibly `lib/*` only if strictly required (e.g. for the
  account/model/effort pool). Do NOT include unrelated working-tree changes.
- End every commit message with the trailer:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
