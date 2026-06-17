# Codex task prompt — Execution-autopilot / deliverable inline form

Hand this file to Codex as the implementation task. Recommended model: **gpt-5.3-codex**
at **high** effort (this is execution of an already-decided design, not open-ended
architecture). Bump to gpt-5.5 only for a specific thorny sub-decision if one arises.

---

TASK: Replace the Execution-autopilot / deliverable prompt() chain in Council Room v2
with proper inline dropdowns, and let author/reviewer be chosen from the full agent pool.

REPO: Council Room v2 (Node, zero-framework backend server.js + lib/*, vanilla
public/ frontend, no build step). Read CLAUDE.md, DATA_SOURCES.md, HANDOFF.md first.
Run/restart via "Council Room v2.bat" (port 8788); a code change needs an actual
server-process restart, not just node --check.

CONTEXT (what exists today):
- Phase 8 "post-consensus authoring": after a subtask is `resolved`, the user can
  generate deliverables. Two entry points in public/app.js:
    * generateDeliverableForSubtask(st)  -> the "Doc" button on a resolved subtask
      (POST /api/deliverables/create). Currently uses prompt() for the template.
    * startExecutionAutopilot()          -> the "Execution autopilot" button in the
      Deliverables panel (#deliverablesPanel / #execAutopilot in public/index.html).
      Currently a chain of 5 prompt()/confirm() dialogs: subtask id, template,
      author slot, reviewer slot, confirm. POST /api/exec-autopilot/start with
      { subtaskId, template, authorSlot, reviewerSlot, optIn:true }.
- Server: server.js runExecutionAutopilot(body) resolves author/reviewer via
  pickParticipant(participants, slot, idx) (~line 776) which throws
  "Unknown participant: <slot>" if the slot key is not one of the chat participants.
  So today author/reviewer MUST be existing chat participants (keys e.g. "codex"/"claude").
- Templates registry: lib/templates.js (summary | checklist | closure-review).
- Agent backends: lib/profiles.js. A participant may run from a registry profile
  (profileIds) OR an inline backend {provider, account?, model?, effort?, label?}.
  Helper profiles.backendToProfile(slot, backend) turns a backend into a profile object,
  and resolveSlot()/effectiveConfig() turn that into a ready { slot, label, mode, chain }.
  validateProfile() validates a backend.

GOALS:
1. Subtask is INHERITED automatically — do NOT ask for a subtask id. Use the active
   resolved subtask; if several are resolved, show a small <select> defaulting to the
   most recently resolved one.
2. Template is a DROPDOWN, not typed: <select> of summary / checklist / closure-review
   (source the list from /api/state deliverableTemplates, which already exists).
   Sensible default: checklist for exec-autopilot, summary for the Doc button.
3. Author and Reviewer are DROPDOWNS sourced from the FULL agent pool, not only the
   chat participants. The pool = the chat participants PLUS registered profiles
   (settings.profiles) PLUS switcher CLI accounts — i.e. the SAME backend list the
   existing top agent-chip / participant picker already offers. Render each option as
   "label · model · effort". Pre-fill author and reviewer to two different agents
   (default: the chat's two participants). Enforce author != reviewer in the UI
   (disable the matching option / block Start with a clear message).
4. Replace the prompt()/confirm() chain with an inline mini-form rendered inside
   #deliverablesPanel (template ▾, author ▾, reviewer ▾, [Start]). Keep one explicit
   confirm before spending tokens (the existing ui.execConfirm text). Apply the same
   dropdown treatment to the Doc button path (at least template ▾ + author ▾).

SERVER CHANGE (required for goal 3):
- Extend /api/exec-autopilot/start and /api/deliverables/create to accept author and
  reviewer as EITHER a participant slot string (current behavior) OR an inline backend
  object { provider, account?, model?, effort?, label? }. Backward compatible: existing
  string slots keep working.
- In runExecutionAutopilot()/createDeliverable(), when author/reviewer is a backend
  object, build a ready participant from it via profiles.backendToProfile(<stableSlot>,
  backend) + the existing resolveSlot/chain machinery, instead of pickParticipant().
  Validate the backend with profiles.validateProfile(); on failure return a clear 400.
- Keep the author != reviewer rule (D6): compare by a stable identity (slot key, or
  provider+account+model for inline backends). Keep the double gate (subtask resolved
  AND optIn:true). Do NOT weaken isolation or the narrowed write root.

CONSTRAINTS:
- Bilingual UI: every new string goes in BOTH the RU and EN i18n dicts in public/app.js,
  and every "?" tooltip key (tip.*) must exist in both — keep RU/EN parity (CLAUDE.md).
- Do NOT change the TAIL_CONTRACT, lib/prompt.js scaffolding, or domain profiles.
  test/prompt.snapshot.test.js must still pass (npm test).
- Do NOT touch unrelated files. No new dependencies; no build step.
- Remove or repurpose the now-unused exec prompt i18n keys (ui.execSubtaskPrompt,
  ui.execAuthorPrompt, ui.execReviewerPrompt, ui.execSlotAvail, ui.execTemplatePrompt)
  cleanly, keeping RU/EN in sync.

VERIFICATION (do this, report what you saw):
1. Restart via "Council Room v2.bat" and drive it in the browser at localhost:8788.
2. Open a chat with a resolved subtask, expand the Deliverables panel.
3. Confirm the form shows: inherited subtask, template ▾, author ▾, reviewer ▾, Start;
   no typing required; author != reviewer enforced.
4. Pick an author/reviewer that is NOT a current chat participant (from the registered/
   switcher pool) and Start — confirm exec-autopilot runs with the chosen backends and
   produces a deliverable (PASS) or a halted deliverable, with an audit trail.
5. npm test stays green. Provide a short before/after note and any screenshots.

COMMIT & PROJECT NOTES:
- ai-switcher is ALREADY BUNDLED into this repo (lives at ai-switcher/, paths are
  relativized to the project — do not hardcode C:\AI\ai-switcher\... ). Its CLI accounts
  (cli-codex / cli-claude, acc1/acc2) are part of the agent pool the author/reviewer
  dropdowns must offer — reuse them, do not invent a separate source.
- Commit etiquette (per CLAUDE.md): commit only when asked; default branch is main.
  Commit a NARROW range — only the files this task actually touches (expect
  public/app.js, public/index.html, public/styles.css, server.js, and possibly
  lib/profiles.js / lib/templates.js); do NOT sweep unrelated modified files into the
  commit. End every commit message with the trailer:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
