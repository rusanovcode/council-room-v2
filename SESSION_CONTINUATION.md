# Session continuation — Council Room v2 + game_agent phases

Working state so the next session can resume without re-deriving context. Read this +
CLAUDE.md / DATA_SOURCES.md / HANDOFF.md. Last updated: 2026-06-01.

## Working rules (how we operate — learned + confirmed by operator)
- **Operator drives the UI, agent verifies.** For anything with a button (select chat, Run
  round, Resolve, Execution autopilot, Apply, KB edit) the OPERATOR clicks; the agent only
  sets up cheap backend plumbing (no UI button), watches (read-only), and reports/verifies.
- **Phases live as SUBTASKS of the umbrella chat** "создать кор игрового агента" (the migrated
  v1 master chat, room id `2026-05-22T15-33-40-262Z-создать-кор-игрового-агента-суть-изложена-в-файл`).
  NOT separate rooms. The vision/direction lives in that chat's 10 attached docs
  (MMORPG_AI_Plan.md, Unified Architecture, etc.). The old 444-msg transcript is NOT fed to
  agents — only the active subtask + KB + attached docs go into the prompt.
- **Governance boundary:** the app does NOT auto-write into external projects. Delivery is
  manual (Packet/Copy) OR the gated **Apply** button (writes to an operator-typed ABSOLUTE
  file path under one explicit confirm). Default Write stays inside the app folder.
- **Per-subtask KB scope** is live (F-KB): each phase subtask has its own scope; envelope
  sections (prohibitions, control_contract) are global. Reset/carryover is automatic.
- Restart the server (`Council Room v2.bat` or `node server.js`) after code changes — it holds
  old code in memory. Port 8788.

## Council Room work this session — Phase 8 deliverables overhaul
Source of truth: **PHASE8_DELIVERABLES_UI_PUNCHLIST.md** (16 items + F-KB/F-KB2/F-PATH + F1).
All found via live testing on the real game_agent Phase 12/13 runs.

Codex task prompts (hand each to Codex; status):
- PHASE8_EXEC_FORM_CODEX_PROMPT.md — inline exec form. DONE, verified.
- PHASE8_DELIVERABLES_FIX_CODEX_PROMPT.md — items 1–11. DONE, verified.
- PHASE8_DELIVERABLES_ITEM5_FOLLOWUP_CODEX_PROMPT.md — cascade account/model/effort. DONE, verified.
- PHASE8_DELIVERABLES_APPLY_BUTTON_CODEX_PROMPT.md — item 16 Apply. DONE, verified (used live).
- PHASE8_DELIVERABLES_LIVE_INDICATOR_CODEX_PROMPT.md — items 12,13,14,15. DONE, verified.
- PHASE8_KB_PER_SUBTASK_SCOPE_CODEX_PROMPT.md — F-KB (approach B). DONE, verified.
- PHASE8_SCOPEMODE_TRIGGER_CODEX_PROMPT.md — F-KB2 (broaden regex + UI toggle). DONE, verified.
- PHASE8_DELIVERY_PATH_DEFAULT_CODEX_PROMPT.md — F-PATH (smart default path). DONE, verified.

Commits on `main`: `cfdc254` (deliverables inline form/picker/apply/indicator/coach),
`1293b19` (right-panel/deliverables refine), `dec6b04` (F-KB + F-KB2: per-subtask scoped KB +
scope-mode triggers), `e2f3849` (F-PATH: smart deliverable target-path defaults). Everything
Phase 8 + F-KB/F-KB2/F-PATH is now COMMITTED. Tests: `npm test` 39 PASS / 0 FAIL; golden
snapshot byte-for-byte. Stray untracked `hegc-stars-summary.md` is NOT ours — do not commit it.
`SESSION_CONTINUATION.md` itself is untracked (commit if you want it tracked).

## game_agent phase status
- Phases 0–12 CLOSED. Phase 12 closed PASS (127/127, bootstrap 0); docs/phase12_checklist.md +
  closure report; session_state bookkeeping done.
- **Phase 13** (Offline World Model Readiness): consensus reached in the room → exec-autopilot
  authored `docs/phase13_checklist.md` (Codex author / Claude reviewer PASS) → **delivered via
  Apply to C:\AI\game_agent\docs\phase13_checklist.md** (6665 b, deliverable status=delivered).
  Closure artifacts created: docs/phase13_closure_review_checklist.md +
  docs/phase13_closure_report.TEMPLATE.md.
  Bookkeeping for "checklist authored" NOT yet applied — instructions in
  docs/phase13_session_state_bookkeeping.md (3 edits, apply by hand).
- **Phases 14, 15, 16** (TBD scope — room proposes each, just-in-time, each depends on the
  prior): framing docs `phase{14,15,16}_context.md` created; each seeded as a proposal-mode
  subtask in the master chat (Phase 14 = `st_5e2f62a8` ACTIVE/open; 15 = `st_33cbf0ef`; 16 =
  `st_a8f2900d` — both pending). Closure scaffolding created for each as honest SKELETONS
  (`phase{14,15,16}_closure_review_checklist.md` + `..._closure_report.TEMPLATE.md`): constant
  parts (envelope, verification, governance) filled, scope-specific acceptance marked TBD until
  the room authors `phaseN_checklist.md`. NONE run — need operator GO; debate IN ORDER 14→15→16.

## OPEN / NEXT ACTIONS
1. Apply the 3 edits in `game_agent/docs/phase13_session_state_bookkeeping.md` to
   session_state.json (records Phase 13 checklist authored). Validate JSON after.
2. Phase 14: when ready, operator runs the debate round on its subtask `st_5e2f62a8`
   (scopeMode=proposal; tokens) → consensus → exec-autopilot → checklist → deliver.
   (Optionally authorize Phase 13 implementation first; Phase 14 scope depends on it.)
3. Phase 13 implementation itself remains operator-gated (not started).
4. Housekeeping: trash the stray empty subtask "Следующая подзадача" (`st_64466de5`,
   artifact of the Apply "next subtask" step) if unwanted; consider gitignoring `server-*.txt`.

DONE since first draft: F-PATH given to Codex + verified + committed (e2f3849); F-KB+F-KB2
committed (dec6b04). Phase 8 deliverables overhaul fully landed.
