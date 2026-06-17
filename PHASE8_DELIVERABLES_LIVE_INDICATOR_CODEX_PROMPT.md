# Codex task prompt — Deliverables: live indicator + coach lifecycle + row polish

Follow-up to PHASE8_DELIVERABLES_UI_PUNCHLIST.md, items **12, 13, 14 and 15** (all found
during a live Phase 12 run). 12 = live "author is working" indicator; 13 + 15 = the two
halves of the coach lifecycle (while running / after PASS); 14 = the deliverable row
(tooltips + one-line overflow). Recommended model: **gpt-5.3-codex** at **high** effort.
Frontend-focused; one small optional server touch for the streaming option. No engine or
governance changes.

REPO: Council Room v2 (Node, zero-framework `server.js` + `lib/*`, vanilla `public/`, no
build step). Read CLAUDE.md / DATA_SOURCES.md / HANDOFF.md first. Restart via
"Council Room v2.bat" (port 8788) — a code change needs an ACTUAL process restart.

---

## ITEM 12 — Live "author is working" indicator (terminal + feed are blank during a draft)

SYMPTOM (confirmed live, author = Claude·acc2·opus): from pressing Execution autopilot until
the document finishes, the author TERMINAL pane stays empty and the chat feed shows nothing;
then the terminal fills with the full text ALL AT ONCE the instant the draft completes. The
operator reads the multi-minute silence as "stuck".

ROOT CAUSE (already diagnosed — do NOT re-chase a wiring bug):
- The streaming wiring is intact: `runAuthoringRole` (server.js ~891) sets
  `onStream: (chunk) => broadcastStream(role.slot, chunk, …)`; `roles.runRole` forwards
  onStream; `runClaude` (lib/cli.js ~216) passes `onStdout: onStream` / `onStderr: onStream`
  (~228); the spawn helper calls `options.onStdout(text)` on each stdout 'data' (lib/cli.js
  ~126). `broadcastStream` (server.js ~379) emits SSE `event: stream` with
  `{agent, chunk, reset}`; the client maps it to a pane via `appendTerminal(key,…)` /
  `ensureTermPane` (public/app.js ~1116-1152), keyed by the stream `agent` (= role.slot).
- The pane IS created and labelled (`inline-author-cli-claude-acc2-opus`). The reason it is
  empty is that **Claude CLI is launched with `--output-format text` (lib/cli.js ~216),
  which does not stream incrementally** — it emits the whole answer once at process close.
  So no 'data' chunks arrive mid-generation. (Codex CLI streams; Claude text-mode does not.)

REQUIRED FIX — pick ONE, default to (B):
- (A) Streaming output for Claude: switch the author/reviewer Claude invocation to a
  streaming mode (`--output-format stream-json`, parse partial messages, feed text to
  `onStream`). If you do this, you MUST verify the deliverable text and the debate
  `parseAgentTail` / `TAIL_CONTRACT` parsing are unaffected and `npm test` (incl.
  `test/prompt.snapshot.test.js`) stays byte-for-byte green. Higher risk.
- (B) **Live "working…" indicator (recommended, low-risk, no prompt/parse change):**
  while exec-autopilot is generating, show a visible alive-state for the active role:
    * In the role's TERMINAL pane: a placeholder line that updates, e.g.
      "⏳ <author.label> is writing draft N… (elapsed Ns)" with a ticking elapsed counter,
      replaced by the real streamed/!final text when it arrives.
    * In the CHAT FEED: a transient placeholder ("<author> is writing draft N…",
      "<reviewer> is reviewing draft N…") that is replaced/upgraded by the real
      `deliverable-draft` / `deliverable-review` message on completion (item 7 already adds
      the draft message — make the placeholder converge to it, no duplicates).
  Drive phase/iteration from `execAutopilot` state (`running`, `iteration`, `phase`) +
  the SSE stream. Clear placeholders when the run ends (PASS/halted/stop).

## ITEM 13 — Coach is state-blind during a run

SYMPTOM: while exec-autopilot is RUNNING, the coach still shows `coach.allDone`
("Consensus is in — next step: generate a document via Doc / Execution autopilot…"), telling
the operator to start generating when generation is already in progress.

FIX: in the coach state machine (public/app.js, the `allResolved` branch ~1378 that returns
`coach.allDone`), add a branch that fires BEFORE `allDone` when
`currentState.execAutopilot?.running` (or `deliverablesExecPendingStart`) is true. Return a
new `coach.execRunning` step that narrates the live state, e.g. RU "Идёт Автопилот
исполнения: <фаза> (итерация N). Дождись Review: PASS/FAIL — не жми Stop." / EN equivalent.
Reuse the `ui.execStatus*` strings where sensible; highlight the Deliverables panel. Add
`coach.execRunning.title`/`coach.execRunning.body` in BOTH RU and EN dicts (parity).

## ITEM 15 — Navigator must guide delivery AFTER PASS (manual handoff stays)

IMPORTANT: Council Room is a PROJECT-AGNOSTIC tool. The target project/path is whatever the
operator set on the deliverable (the existing Packet/Write "target path"). Do NOT hardcode
any specific project or task id (game_agent / phase12 are only the current example).

SYMPTOM: after exec-autopilot PASS the coach gives no next-step guidance, so the flow feels
broken — even though the manual handoff is intentional (the app deliberately does NOT write
outside its own folder; Phase 8 narrowed write root, commit e5082ee).

DECISION (operator-confirmed): KEEP the governance boundary — do NOT auto-write outside the
app folder, do NOT relax the write root. Instead make the navigator walk delivery.

FIX: add a coach state that fires when ALL subtasks are resolved AND a `status:"ready"`
deliverable exists for the resolved subtask AND nothing is running (place it near the
`allResolved`/`coach.allDone` branch, public/app.js ~1378; post-run counterpart to item 13).
Return a generic `coach.delivered` step built from the deliverable's actual template and
target path, e.g. RU:
  "Документ «<deliverable.template>» готов. 1) Packet → <target path> (или Копировать).
   2) Применить в целевом проекте через его operator-сессию.
   3) Отметить задачу выполненной в том проекте."
EN equivalent. Do NOT name any specific project/path in the strings — interpolate the
deliverable's own fields. Highlight the deliverable row / Packet button. Add
`coach.delivered.title` / `coach.delivered.body` in BOTH RU and EN dicts (parity). Guidance
only — no writing, no governance change.

Coach lifecycle after this task: running (item 13) → ready/deliver (item 15) → normal.

## ITEM 14 — Deliverable row: button tooltips + it overflows one line

SYMPTOM (live): the produced-deliverable row in the Deliverables panel does not fit one line
and the label gets clipped (operator saw "hecklist v1" — the leading "c" cut). Also the row's
action buttons have no explanation. The row is now even tighter because an Apply button was
added (item 16) — the row holds label + status + Copy / Packet / Write / Apply.

WHERE: public/app.js — the deliverable-row markup (~5150 area and a near-duplicate ~4882;
see NOTE below): `<span class="doc-name">…deliverableLabel…</span>` + `.del-copy` /
`.del-packet` / `.del-write` / `.del-apply` buttons. Click handler ~5647. CSS in
public/styles.css (`.deliverable-row` / `.doc-row`).

FIX:
- **Tooltips on every action button** (RU+EN parity). `.del-apply` already has
  `tip.apply` — add the same treatment to Copy / Packet / Write: new `tip.deliverableCopy`,
  `tip.deliverablePacket`, `tip.deliverableWrite` (or `title=`), explaining each, and that
  **Write stays inside the app folder** whereas Apply can write to an external target under
  confirm. Keep them short.
- **Layout so nothing is clipped.** Let the label ellipsize (`text-overflow: ellipsis`,
  `min-width:0`, `title=` full name already present) and/or wrap the action buttons to a
  second line (flex-wrap), or use compact icon buttons. The RU labels ("Копировать",
  "Применить") are wider than EN — verify both languages fit with 4 buttons.
- **NOTE / consolidate:** there appear to be TWO near-duplicate deliverable-row render
  blocks (~4882 and ~5150) and two `const list = $("deliverablesList")` blocks (~4773 /
  ~4892). Confirm which is the LIVE path, apply the fix there, and remove/merge the dead
  duplicate so the row is defined once.

---

## CONSTRAINTS
- Bilingual UI: every new string in BOTH RU and EN i18n dicts; every `tip.*` in both; keep
  RU/EN parity (CLAUDE.md).
- Do NOT change `TAIL_CONTRACT`, `lib/prompt.js` scaffolding, or domain profiles. `npm test`
  (incl. `test/prompt.snapshot.test.js`) must stay green. If you choose fix (A), prove the
  snapshot is still byte-for-byte.
- Do NOT change Phase 8 governance (resolved + optIn gate, narrowed write root, CLI
  isolation). Item 13 is frontend-only. Item 12 is frontend-only unless you pick (A), whose
  only server/lib touch is the Claude streaming output mode.
- No new dependencies; no build step.

## VERIFICATION (do this, report what you saw)
1. Restart via "Council Room v2.bat"; open the Phase 12 chat (resolved subtask), expand
   Deliverables; run Execution autopilot (author Claude, reviewer Codex), do NOT press Stop.
2. From button-press onward the author terminal AND the feed show a live "working…/writing…"
   indicator (or real streamed tokens if you did (A)); no multi-minute blank silence.
3. While running, the coach explains the run ("Автопилот исполнения идёт… дождись PASS/FAIL"),
   not "go generate a document".
4. On completion the placeholders converge to the real draft/review messages with no
   duplicates; coach returns to its normal post-run state.
5. After PASS, the coach shows a generic "document ready → deliver" step (item 15), built
   from the deliverable's own template/target path (no hardcoded project).
6. The deliverable row (item 14) fits without clipping the label in BOTH RU and EN, and every
   action button (Copy / Packet / Write / Apply) has a tooltip; only one row render path
   remains (duplicate removed/merged).
7. `npm test` green (snapshot byte-for-byte). Short before/after note + screenshots.

## COMMIT ETIQUETTE (per CLAUDE.md)
- Commit only when asked; default branch `main`; NARROW range (expect public/app.js,
  public/index.html, public/styles.css; lib/cli.js + server.js only if you pick fix (A)).
- End the commit message with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
