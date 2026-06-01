# Phase 8 — Post-Consensus Authoring (turning a decision into deliverable files)

Goal: add an **execution layer** on top of the debate. Today Council Room is a
*decision* tool — its output is `knowledge.md` (structured decisions) + the
subtask `summary` + the transcript. The deliverable file (checklist,
closure-review, report) is still produced by hand, by copying out of the chat.
Phase 8 closes the **decision → artifact** gap: after consensus, author a document
with a chosen agent and deliver it (copy / handoff-packet / gated-write). The
debate mechanics (subtask → rounds → questions → verify → resolve/block) DO NOT
change.

> Document for step-by-step execution **by another agent in small steps**. Each
> step ends with a verification block. After all steps — return to the lead agent
> for a joint review (see "Phased plan"). Status: **A1/A2/B/C implemented
> 2026-06-01**.

---

## TL;DR
`runRound` accumulates KB-patches into `knowledge.md`; `resolveSubtask` sets a
`summary` (see `buildLocalSummary`, deliberately agent-free for token economy).
There is no deliverable file, so the "last mile" is manual and gets lost. Phase 8
is an **artifact factory**: from the consensus, generate a document with a chosen
agent and deliver it. We just ran this whole pipeline **by hand** for the
`game_agent` Phase 11 (Claude position → Codex review → checklist → review-gate →
closure-review) — proof the factory is worth automating.

## 1. Core principle — separate "what is produced" from "how it is delivered"
One **artifact factory** (in-chat generation) × three **delivery modes**:

| Delivery | What it does | Risk |
|---|---|---|
| **Copy** | artifact sits in the chat; the human copies it out | none |
| **Handoff-packet** | artifact + patch + an instruction for an operator session; a human applies it | none (nothing written outside) |
| **Gated-write** | the app writes the file(s) after an informed approval | medium (see §6) |

"Manual / semi-auto / auto" are **different tails of one factory**, not different
features.

## 2. Levels (by increasing risk)
- **Level A — in-chat generation** (safe, fits the current model). *First increment.*
- **Level B — gated-write / handoff-packet** outward (§6).
- **Level C — auto-orchestration** (execution autopilot, §5).

This doc covers all three; implement in order.

## 3. Locked decisions
| # | Decision |
|---|---|
| D1 | **Overwrite is a user setting**, not a hard "new files only" rule. Creating new files is the low-risk default; overwriting an existing file is allowed only if the user enables it, and then goes through the heavy gate (preview + diff + `.bak` backup + confirm). |
| D2 | **Gated-write with informed approval = the new operator mandate.** The approval carries responsibility → it must be heavy and honest. |
| D3 | **Two autopilot buttons:** council (the existing `runAutopilot`) and a new **execution** autopilot. |
| D4 | **Execution unlock = double gate:** the subtask is `resolved` AND a one-time explicit user opt-in. |
| D5 | **The draft→review→revise loop is configurable** (iteration count + token budget set by the user). |
| D6 | **Author/reviewer: the user picks both, self-review is forbidden** (author ≠ reviewer). |
| D7 | **closure-review is a mandatory built-in template type** (the second after summary). |
| D8 | **Artifact and its review-gate are produced as a pair.** |
| D9 | **Cheap by default, expensive on demand:** local KB summary (0 tokens) by default; agent authoring at max effort on a button (the `VERIFY_AGENTS = {gpt-5.5/xhigh, opus/max}` hook). |
| D10 | **Artifact versioning:** bind to `{sourceRound, kbDigest}`; if KB changes, mark `stale` + offer regenerate; store versioned. |

## 4. Template registry
Modeled on `lib/domains.js` — a registry, so adding a type is a data entry with no
frontend edit. Each template: `{ id, label, defaultAuthor, producesReviewGate,
promptBuilder }`.

| id | Purpose | Default author |
|---|---|---|
| `summary` | summarize the consensus | local (no agent) / any |
| `checklist` | structured spec (phaseN-style) | Codex xhigh |
| `closure-review` | verification instrument (entry / contracts / verification / PASS-FAIL / rollback) | Codex xhigh |
| `report` | results report | Claude max |
| `custom` | freeform prompt | user choice |

`promptBuilder` assembles input from `subtask + knowledge.snapshotForPrompt() +
documents.snapshotForPrompt() + recentTurns` (all already present in `runRound`).

## 5. Execution autopilot — state machine
A new button, separate from `runAutopilot`. **Disabled** until the D4 double gate
is met (`resolve: debateComplete` returned by `runRound` + a one-time opt-in).

```
[ready?] --resolved + opt-in--> DRAFT(author)
   DRAFT      -> REVIEW(reviewer, read-only PASS/FAIL)    // author != reviewer (D6)
   REVIEW FAIL-> REVISE(findings as guidance) -> DRAFT     // iteration + budget limit (D5)
   REVIEW PASS-> READY
   READY      -> DELIVER: copy | handoff-packet | gated-write(approval §6)
   limit/budget hit -> HALT(call the human)
```
Reuses `runAutopilot` primitives (agent calls, stop control, budget), but the goal
is not "close the subtask" — it is "produce (artifact + its review-gate) and
deliver".

## 6. Write-primitive contract
A single primitive `applyDeliverable(files[], mode)`:
- **New file** → create after preview (`new`) + approval. Low risk.
- **Existing file** → only if the user enabled overwrite (D1): preview with
  **diff**, `.bak` backup next to it (a pattern already used: `transcript.full.jsonl`
  during the chat tidy), then confirm. If overwrite is off → do not write; produce
  a **handoff-packet** (patch + operator instruction) instead.
- **Atomic:** all files or none; roll back on error.
- **Scope:** write exactly what is in the preview. No "while I was at it".
- **Audit:** a system message into the transcript (`addMessage`, `kind:"write"`):
  "Wrote: <file> → <abs path> (new|overwrite, backup .bak)".
- **The council sandbox is not weakened:** executor agents still run in a throwaway
  temp dir outside `C:\AI` (`lib/cli.js makeSandboxDir`); the **server** performs
  the write on approval, not an agent from inside the sandbox.

## 7. Data model / storage
- Artifacts stored versioned in `rooms/<id>/deliverables/<template>-<n>.md` plus an
  index `deliverables.jsonl` (`{id, template, version, sourceRound, kbDigest,
  author, reviewer, status, stale}`). May also be surfaced as a chat document
  (`documents.jsonl`).
- `kbDigest` from `knowledge.load(dir)` (compute over sections). On mismatch →
  `stale = true`.

## 8. UI surface
- Button **"Generate document"** on a resolved subtask: `[template ▾] [author ▾]
  [⚙ effort] [⚙ reviewer ▾]` (selectors reuse participants/profiles).
- Button **"Execution autopilot"** next to "Council autopilot"; disabled until D4.
- **Deliverables** panel (versions, stale badge, Copy / Packet / Write buttons).
- **Gated-write** dialog: file list, full path, `new|overwrite`, diff on overwrite,
  an "I understand what and where" checkbox.

## 9. Integration points (existing code)
- `server.js`: hook on `/api/subtasks/resolve` (offer "Generate"); new endpoints
  `/api/deliverables/*`, `/api/exec-autopilot/*`, `/api/deliverables/write`.
- `lib/profiles.js`: `VERIFY_AGENTS` as the "max effort" preset; `effectiveConfig`
  to resolve author/reviewer into a backend.
- `lib/documents.js` / new `lib/deliverables.js`: storage + versioning.
- `lib/knowledge.js`: `snapshotForPrompt` as input; digest for `stale`.
- new `lib/templates.js`: the template registry (§4).
- `public/app.js`: buttons, panel, write dialog (bilingual + `?` tooltips).

## 10. Safety / governance
- The council stays read-only by default; **writing is gated by explicit approval**
  (D2).
- Overwriting foreign files is behind a user setting (D1), with diff + backup.
- Author ≠ reviewer (D6) — against self-review bias.
- Budget cap + iteration limit (D5) — against token runaway and looping.
- An audit trail in the transcript on every write.

## 11. Non-goals / later
- Not building a full dev-orchestrator; the execution autopilot is a narrow
  "artifact + review-gate" loop.
- The tail contract / domain profiles are untouched.
- Complex multi-file patches into existing files go through a handoff-packet for
  now, not auto-merge.

## 12. Phased plan
1. **A1 — DONE 2026-06-01** — `lib/templates.js` (summary, checklist, closure-review) + endpoint
   `/api/deliverables/create` (agent of choice) → artifact as a chat document.
   Copy delivery.
2. **A2 — DONE 2026-06-01** — Deliverables panel + versioning + `stale`.
3. **B — DONE 2026-06-01** — write primitive (§6): new files + gated dialog; overwrite setting;
   handoff-packet.
4. **C — DONE 2026-06-01** — execution autopilot (§7): draft→review→revise loop, D4 double gate,
   budget/iteration limits.

Rules kept across all phases (per ROADMAP): isolation by default, token economy,
the user (not the assistant) launches real Codex/Claude rounds, bilingual UI,
`?` tooltips, confirm before dangerous actions.
