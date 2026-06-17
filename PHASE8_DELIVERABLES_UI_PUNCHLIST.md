# Deliverables panel — UI/UX punch-list (Phase 8, post exec-form)

Collected during the live Phase 12 verification run. **Not yet implemented** —
"позже поправим". Hand to Codex (gpt-5.3-codex / high) when ready; same constraints
as PHASE8_EXEC_FORM_CODEX_PROMPT.md (bilingual RU/EN parity, no TAIL_CONTRACT change,
npm test green, narrow commit).

## From the operator (2026-06-01)

1. **Signal-highlight the exec dropdowns.** The Template / Author / Reviewer `<select>`s
   in `#deliverablesExecForm` should get the same orange pulsing frame (`.nav-highlight`,
   `--orange`) as the Deliverables panel does — as a "fill these, then press" cue —
   and the highlight should clear once **Execution autopilot** is pressed.

2. **Localize the "Execution autopilot" button.** `ui.execAutopilot` is currently the
   same English string in both dicts. Give it a proper RU label (match interface language).

3. **Box + explain the Doc form.** `#deliverablesDocForm` (Doc template, Doc author,
   "Doc" button) must be visually separated into its own framed block with a header that
   makes its purpose clear (one agent, no review) vs the autopilot block above
   (author + reviewer). Add a `?` tooltip (`tip.*`, RU+EN) explaining what the Doc path is.
   Localize the field labels (`ui.docTemplateLabel`, `ui.docAuthorLabel`) and the
   "Doc" button per interface language.

4. **Localize the panel title.** `ui.deliverables` is "Deliverables" in both dicts.
   In RU show a Russian name with "(Deliverables)" in parentheses; keep EN as is.

5. **Author/Reviewer dropdowns must expose account + model, not just a pre-picked model.**
   Today the dropdown shows an already-selected model and the operator cannot set the
   desired account+model. The dropdowns should offer the full pool (switcher CLI accounts
   + registered profiles + chat participants) rendered as label · account · model · effort,
   and the chosen account/model must actually be sent to and used by exec-autopilot.

6. **Persistent "Execution autopilot started" status.** The "started" message
   (`#deliverablesMsg`) must stay visible for the WHOLE run — from pressing the button
   until the document is finished (or halts) — instead of flashing once and clearing.
   Ideally show live progress (drafting → reviewing → done/PASS/FAIL), and only clear/
   replace it when the deliverable is produced or the run stops.

## From the live Phase 12 run (2026-06-01, root-cause findings)

7. **Persist the author's draft to the feed (ROOT CAUSE of "author didn't respond").**
   Today `runExecutionAutopilot` only `broadcastStream`s the author draft live + writes it
   to a file; it does NOT `addMessage` it. Only the reviewer's review is added to the feed
   (`kind: "deliverable-review"`). So after the run the feed shows the review but no draft —
   the operator reasonably concluded the author produced nothing. Add a persistent feed
   message for each draft (e.g. `kind: "deliverable-draft"`, `name: "<author> · draft N"`),
   parallel to the review message, so every iteration's draft is visible afterward.

8. **Friendly empty-draft message.** The empty-draft guard already exists in the engine
   (`if (!draft.trim()) throw "Execution draft is empty"` — review is NOT run on an empty
   draft, so no code change needed there). But surface it as a clear UI message
   ("Author produced no draft — review skipped, re-run or switch author"), not a raw error.

9. **Real usage-cap failover / clear halt.** NOTE: in the 2026-06-01 run no token limit
    was hit — the stop was a manual Stop during review2 (`aborted`), not exhaustion. Still
    valid as hardening: chat participants here are single-account (no failover link), so if
    a CLI account genuinely hits its daily cap mid-author/review, exec-autopilot halts with
    a generic error. Desired: if the author/reviewer backend has a failover link (e.g.
    acc2 → acc1), use it on a usage-cap/auth failure; if none, halt with a clear,
    operator-readable message naming the cap (not just "CLI failed exitCode -1").

10. **Stale/confusing error lines in the feed.** Old `process`/error messages linger and
    mislead — e.g. "Execution autopilot failed: Unknown participant: 1" (impossible now
    that author/reviewer are dropdowns) and an earlier "aborted" line stayed visible and
    were read as the current run's failure. Consider: drop the now-impossible
    "Unknown participant" path, and/or visually de-emphasize/clear superseded error lines
    so the latest run's real state is unambiguous.

## From the agent (earlier, tooltip drift)

11. **Stale tooltips.** `tip.deliverables` and `tip.generateDoc` (RU+EN) still describe the
   old `prompt()` flow ("resolve → Execution autopilot, шаблон checklist, author codex,
   reviewer claude"). Rewrite to the new inline-dropdown form, mention the inherited
   subtask, and the full agent pool. Keep RU/EN parity.

## From the second live run (2026-06-01, author=Claude·acc2 / reviewer=Codex·acc2)

12. **No live "author is working" indicator — chat feed AND author terminal are both empty
    during generation.** While exec-autopilot is drafting, the main chat feed shows nothing
    (process lines are hidden by design; the `deliverable-draft` message is only committed
    AFTER the author finishes — item 7), and the operator reasonably reads the run as
    "nothing is happening / stuck". Worse: the AUTHOR'S TERMINAL pane stays EMPTY during the
    draft. Expected: the author/reviewer terminal streams live like a debate round.
    Investigate & fix:
      - ROOT CAUSE (confirmed live, author=Claude·acc2·opus): the terminal pane IS created
        and labelled (`inline-author-cli-claude-acc2-opus`) — the earlier "synthetic slot
        has no pane" guess was WRONG. The streaming wiring is intact:
        `runAuthoringRole` → `roles.runRole` (forwards onStream) → `runClaude`
        (`onStdout: onStream`, lib/cli.js:228) → spawn helper calls `options.onStdout(text)`
        on each stdout 'data' (lib/cli.js:126). The real cause is that **Claude CLI is
        launched with `--output-format text` (lib/cli.js:216), which does NOT stream
        incrementally** — it emits the whole answer once at process close. So during the
        multi-minute draft, no 'data' chunks fire and the pane stays empty until the very
        end (by which point the loop has moved on to review). Codex streams; Claude in
        text-mode does not.
      - FIX OPTIONS: (a) switch the Claude author/reviewer invocation to a streaming output
        mode (`--output-format stream-json` + partial-message handling) so tokens reach the
        terminal live — verify the existing text parser / TAIL_CONTRACT parsing still works;
        OR (b) since text-mode won't stream, show a live "working… (elapsed Ns)" placeholder
        in BOTH the terminal pane and a feed placeholder ("<author> is writing draft N…"),
        upgraded to the real `deliverable-draft` message on completion (item 7). Option (b)
        is lower-risk (no prompt/parse changes); do (b) unless (a) is explicitly wanted.
      - NOTE: empty terminal does NOT mean the agent stalled — the draft files
        (`EXEC-…-draft{1,2}-inline-author-cli-claude-acc2-opus.*`) prove Claude produced
        output; the gap is purely the live indicator.
      - CONFIRMED BY OPERATOR (live): the author terminal stayed empty for the whole
        generation and then filled with the full text ALL AT ONCE the moment the document
        finished — exactly the `--output-format text` batch-at-close behavior. This rules out
        a wiring bug and confirms the fix is option (a) stream-json OR (b) a "working…"
        placeholder during generation.
      - Net effect: from the moment Execution autopilot is pressed, the operator must SEE
        the author working (terminal stream or a clear "writing…" indicator), not a blank
        chat + blank terminal.

13. **Coach hint is state-blind during a run.** The coach `allResolved` branch
    (public/app.js ~1378) always returns `coach.allDone` ("next step: generate a document
    via Doc / Execution autopilot…") — even WHILE exec-autopilot is actively running. So
    mid-run the operator is told to "go generate a document" although one is being generated.
    Add a coach branch that fires BEFORE `allDone` when `currentState.execAutopilot?.running`
    (or `deliverablesExecPendingStart`) is true, explaining what is happening right now
    (e.g. "Execution autopilot is running: drafting / reviewing (iteration N) — wait for
    PASS/FAIL, do not press Stop"). Reuse the `ui.execStatus*` strings; new
    `coach.execRunning.*` keys in RU+EN parity. Pairs with items 6/12 (make the run visibly
    alive and correctly narrated end-to-end).

14. **Deliverable row: no button tooltips + overflows one line.** The produced-deliverable
    row (public/app.js ~4882-4887: `<span class="doc-name">checklist v1</span>` +
    `.del-copy` / `.del-packet` / `.del-write` buttons) has TWO problems in the narrow
    Deliverables panel:
      - **No explanation of the buttons.** Copy / Packet / Write have no `?`/tooltip; the
        operator can't tell from the UI what each does (Copy = clipboard; Packet = handoff
        packet with operator instructions + target path; Write = writes a file, app-folder
        only). Add per-button tooltips (`title=` or the `tip.*` help system), RU+EN parity:
        explain Copy/Packet/Write and that Write cannot escape the app folder.
      - **Row doesn't fit one line** — the label (e.g. "checklist v1" + stale badge) + three
        buttons overflow, clipping the label (operator saw "hecklist v1", the leading "c"
        cut). Fix layout: allow the label to ellipsize and/or wrap the action buttons to a
        second line (or use compact icon buttons) so nothing is clipped; the RU labels
        ("Копировать") are wider than EN — handle both.
    NOTE: there appear to be TWO near-duplicate deliverable-row render blocks
    (~4882 and ~5059) and two `const list = $("deliverablesList")` blocks (~4773 and ~4892)
    — check whether one is dead code and consolidate while fixing, so the layout/tooltip fix
    applies to the live path only.

15. **Navigator goes silent after PASS — add a "document ready, here's how to deliver" step
    (OPERATOR DECISION: keep manual handoff, just guide it).** IMPORTANT: Council Room is a
    PROJECT-AGNOSTIC tool — the target project/path is whatever the operator set on the
    deliverable (the existing Packet/Write "target path"); game_agent / phase12 are just the
    CURRENT example, never hardcode them. After exec-autopilot PASS the coach gives NO
    next-step guidance, so the chain feels broken even though the manual handoff is
    intentional (the app deliberately does NOT write outside its own folder — the Phase 8
    narrowed write root, commit e5082ee). Operator chose to KEEP that boundary and have the
    navigator walk delivery instead. Add a coach state that fires when all subtasks are
    resolved AND a `status:"ready"` deliverable exists for the resolved subtask AND nothing
    is running. The message must be generic, e.g.:
      "Документ «<deliverable.template>» готов. 1) Packet → <target path> (или Копировать).
       2) Применить в целевом проекте через его operator-сессию.
       3) Отметить задачу выполненной в том проекте."
    Use the deliverable's actual template/target-path; do NOT name any specific project.
    Highlight the deliverable row / Packet button. New `coach.delivered.*` keys, RU+EN
    parity. Do NOT auto-write outside the app folder and do NOT relax the write root — the
    boundary stays; this is guidance only. Pairs with items 13 (coach while running) and 14
    (the row): together the navigator narrates the lifecycle — running → ready → deliver.

16. **Universal "Apply" button (operator-confirmed; this DOES relax the write boundary).**
    Add an "Apply" action on a `status:"ready"` deliverable that, under ONE explicit confirm,
    automates delivery PROJECT-AGNOSTICALLY (never hardcode game_agent/phase12):
      - (a) **Write** the deliverable to the operator-specified target path — which MAY be
        outside the app folder. Today `deliveryRoots()` returns `{root: ROOT}` and
        `resolveTarget` refuses anything outside it (server.js ~deliveryRoots; lib/
        deliverables.js resolveTarget). Add a gated `allowExternal` path: only when the Apply
        flow sets it (after the explicit confirm that shows the resolved ABSOLUTE path + diff)
        may the write resolve to an external absolute target. Default Write button behavior
        stays app-folder-only. `deliverables.write` already backs up + atomically writes +
        marks the deliverable `status:"delivered"` — reuse it.
      - (b) **Form the next task** = open the next Council Room SUBTASK in the same chat (the
        app's own stack) — generic; optionally prompt for / pre-fill its title.
      - (c) NOT POSSIBLE generically, do NOT attempt: marking a task "done" or mutating
        task-state INSIDE the external target project (session_state.json, foreign schemas).
        A project-agnostic tool cannot know the target's task model — leave that to the
        target project's operator session (the item-15 navigator already guides it).
    Governance: this is the deliberate, operator-approved relaxation of the Phase 8 narrowed
    write root (commit e5082ee), gated behind an explicit per-write confirm showing the
    absolute path. Keep the confirm; keep backups; never silent. Pairs with item 15 (the
    navigator should then offer BOTH "Apply" and the manual handoff).

## KB scope per phase (found in the live Phase 13 run)

- **F-KB. Per-subtask KB scope so a new phase never inherits the previous phase's frozen
  scope.** In the umbrella-chat model (phases = subtasks of one chat) the KB is shared, so a
  new phase subtask inherits the prior phase's `files_in_scope`/`decisions` and the strict-
  scope guard BLOCKS it (live: Phase 11's `docs/phase11_checklist.md only` blocked the
  Phase 13 debate until manually fixed). Make this automatic — operator never manages scope
  per phase. See PHASE8_KB_PER_SUBTASK_SCOPE_CODEX_PROMPT.md. **Core implemented & verified**
  (per-subtask scope, global envelope, migration, snapshot byte-for-byte, 38 PASS).

- **F-KB2. Proposal-relaxation trigger is too narrow + no UI toggle.** The "don't block on
  empty files_in_scope, propose instead" branch only fires when `subtask.scopeMode ===
  "proposal"`, which is set only by `inferScopeMode` via `SCOPE_PROPOSAL_RE` (server.js ~421).
  That regex MISSES common phrasings — "Propose … scope", "предложить scope/чек-лист",
  "proposal-only" — and there is NO UI to set scopeMode explicitly. So a scope-defining
  subtask with an ordinary title stays `scopeMode:"normal"` and still soft-blocks (QUESTION)
  on empty scope. Fix: broaden the regex AND add an explicit UI toggle. See
  PHASE8_SCOPEMODE_TRIGGER_CODEX_PROMPT.md.

## Delivery UX

- **F-PATH. Auto-suggest the deliverable target filename/path (don't make the operator type
  the full path).** Apply/Write/Packet currently prompt for an absolute path; a folder-only
  path silently failed once (operator typed `...\docs` instead of `...\docs\phase13_checklist.md`).
  Pre-fill the path prompt with a smart default: derive a filename from the subtask title +
  template — e.g. extract a phase number (`Фаза 13` / `Phase 13` → `phase13`) + the template
  id (`checklist`) → `phase13_checklist.md`; fallback to a slug of the title. Combine with the
  remembered directory (`rememberDeliverableTargetPath` already recalls the last path — this
  adds the smart FIRST-TIME default). Validate it's a file path, not a directory, and surface
  a clear message if a directory is given. Project-agnostic (no hardcoded project/phase).
  See PHASE8_DELIVERY_PATH_DEFAULT_CODEX_PROMPT.md.

## Future / parked (not now)

- **F1. Full-automation "trusted operator" mode.** A future mode where the chain runs
  end-to-end without per-step confirms — incl. writing to the external target and advancing
  the next task automatically (i.e. an opt-in relaxation of the per-write confirm from item
  16). Explicitly DEFERRED by the operator ("это в будущем"). Must stay opt-in, scoped, and
  project-agnostic; design the audit/undo story before building. Do NOT implement yet.

## Notes
- Items 1–15 are UI/UX polish only; the exec-autopilot engine and governance
  (resolved + optIn double gate, narrowed write root, isolation) stay unchanged.
- **Item 16 is the ONE exception**: it deliberately relaxes the narrowed write root to allow
  an operator-confirmed external write. Everything else keeps the boundary.
- Items 3 and the header part overlap; do them together.
- Everything must stay PROJECT-AGNOSTIC — game_agent/phase12 are only the current example,
  never hardcode a project, task id, or path; use the deliverable's own target path/template.
- Item 12 pairs with items 6 (persistent panel status) and 7 (draft → feed): together they
  make the run visibly alive from button-press to finished document.
