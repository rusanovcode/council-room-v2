# Codex task prompt — Per-subtask KB scope (no per-phase scope friction)

Implements PHASE8_DELIVERABLES_UI_PUNCHLIST.md item **F-KB**. Recommended model:
**gpt-5.3-codex** at **high** effort. Read CLAUDE.md / DATA_SOURCES.md / HANDOFF.md first.
Restart via "Council Room v2.bat" (port 8788). PROJECT-AGNOSTIC — no hardcoded project/phase.

## PROBLEM (found live)
The Knowledge Base is shared per CHAT. In the umbrella-chat model (phases run as subtasks of
one chat), a new phase subtask inherits the previous phase's `files_in_scope` / `decisions`,
and the `code` profile's strict-scope guard then BLOCKS the new phase. Live example:
Phase 11's KB item `files_in_scope: docs/phase11_checklist.md only` blocked the Phase 13
debate until the operator hand-edited the KB mid-run. Goal: make scope per-phase
AUTOMATIC so the operator never manages it again.

## DECISION (operator)
Implement **approach B (per-subtask KB scope)** — this is the chosen design. Approach A is a
LAST-RESORT fallback only if B is genuinely infeasible; if you think you must fall back to A,
stop and flag it rather than silently switching.

## DESIRED OUTCOME
- Opening a new subtask gives it a CLEAN scope — it does NOT inherit the prior subtask's
  scope items.
- The constant "envelope" (prohibitions, control_contract) PERSISTS across all subtasks.
- A proposal/scoping subtask (whose whole point is to define scope) is NOT hard-blocked by an
  empty `files_in_scope`.
- Fully backward-compatible: existing chats/KB keep working; the golden prompt snapshot stays
  byte-for-byte.

## WHERE THINGS LIVE (verified)
- KB store: `lib/knowledge.js` — `load(runDir, sections)`, `addItem`, `removeItem`,
  `replaceSection`, `snapshotForPrompt(runDir, sections)`. Items are plain strings under
  section headers in `rooms/<id>/knowledge.md`. Section list comes from the domain profile.
- Sections + guards: `lib/domains.js` — the `code` profile has `guards.scopeApplies: true`
  and sections incl. `files_in_scope`, `files_out_of_scope`, `decisions`, `prohibitions`,
  `control_contract`, `verification_commands`, `open_questions` (~lines 31-32, 15).
- Prompt build: `server.js` ~453 / ~854 call `knowledge.snapshotForPrompt(dir, domain.sections)`
  → `prompt.buildDebatePrompt({ kbSnapshot, ... })`. KB add UI/agent path: `/api/kb/add`,
  `/api/kb/remove` (server ~1633/1643), and agent KB-patch `knowledge.addItem` (server ~633).
- Subtask lifecycle: `lib/subtasks.js` — `openSubtask(runDir, {...})` (creates the new
  active subtask; this is the natural reset hook).

## IMPLEMENTATION — primary approach (B): per-subtask scope
1. **Classify sections** (in `lib/domains.js` or a small helper): GLOBAL vs PER-SUBTASK.
   - GLOBAL (persist across subtasks): `prohibitions`, `control_contract`.
   - PER-SUBTASK (belong to the active subtask): `files_in_scope`, `files_out_of_scope`,
     `decisions`, `verification_commands`, `open_questions`.
   Make the split data-driven (a flag on the section definition), not hardcoded per project.
2. **Storage**: keep `knowledge.md` for GLOBAL sections (unchanged on disk/format). Store
   PER-SUBTASK section items keyed by `subtaskId` (e.g. `rooms/<id>/kb-scope.json`:
   `{ "<subtaskId>": { files_in_scope: [...], decisions: [...], ... } }`). This keeps the
   human-readable global KB intact and isolates per-phase scope.
3. **Compose for the prompt**: `snapshotForPrompt` (and `load` where it feeds the prompt)
   returns GLOBAL items + the ACTIVE subtask's per-subtask items. A subtask with no entries
   yet shows empty scope sections — no carryover.
4. **Writes**: `/api/kb/add`, `/api/kb/remove`, and agent KB-patches route PER-SUBTASK
   sections to the active subtask's bucket; GLOBAL sections to `knowledge.md` as today.
5. **openSubtask**: nothing to clear — a new subtask simply has no per-subtask entries yet.
   (No destructive reset needed.)
6. **Proposal relaxation**: when the active subtask is a scope/proposal subtask, the strict-
   scope guard must NOT hard-block on empty `files_in_scope` (defining scope is the task).
   Detect via a subtask flag/mode or a profile signal; soften the `code`-profile scope
   wording for that case so the agent proposes instead of returning `block`. Keep strict
   scope for normal implementation subtasks.

## SIMPLER FALLBACK (A) — if (B) proves too invasive
On `openSubtask`, auto-clear the PER-SUBTASK sections (`files_in_scope`,
`files_out_of_scope`, `open_questions`, `verification_commands`, and optionally `decisions`)
while PRESERVING `prohibitions` + `control_contract`. One contained change in `openSubtask`
+ a `knowledge` helper. Downside: loses accumulated `decisions` from the prior phase.
Prefer (B); use (A) only if (B) can't land cleanly.

## MIGRATION / BACK-COMPAT
- Existing `knowledge.md` items: treat as GLOBAL by default (so current chats are unaffected),
  OR assign per-subtask sections to the chat's most-recently-active subtask. Default to the
  no-surprises path. The change must be transparent when a chat has a single active subtask.
- `test/prompt.snapshot.test.js` MUST stay byte-for-byte: the `kbSnapshot` output for the
  test's existing input must be identical. Verify before finishing.

## CONSTRAINTS
- PROJECT-AGNOSTIC; the GLOBAL/PER-SUBTASK split is by section, not by project/phase name.
- Do NOT change `TAIL_CONTRACT`, `lib/prompt.js` scaffolding output for the existing case, or
  domain profile sections' identities. `npm test` (incl. the golden snapshot) stays green.
- Do NOT weaken governance (resolved+optIn exec gate, narrowed write root, CLI isolation).
- Bilingual: any new UI string in RU+EN; `tip.*` parity.
- No new dependencies; no build step.

## VERIFICATION (do this, report what you saw)
1. Restart; in one chat open subtask S1, add `files_in_scope: A` + a `prohibitions` item;
   resolve S1; open S2 — confirm S2 sees the `prohibitions` item but an EMPTY
   `files_in_scope` (no carryover of `A`).
2. Run a proposal/scoping subtask with empty `files_in_scope` — confirm the agent proposes a
   scope instead of returning `Status: block` on the scope guard.
3. A normal implementation subtask with a set `files_in_scope` still enforces strict scope.
4. `npm test` green; `node test/prompt.snapshot.test.js` byte-for-byte. Short before/after note.

## COMMIT ETIQUETTE (per CLAUDE.md)
- Commit only when asked; default branch `main`; narrow range (expect `lib/knowledge.js`,
  `lib/domains.js`, `lib/subtasks.js`, `server.js`, maybe `public/app.js` for the KB panel).
- End the commit message with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
