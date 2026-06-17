# Codex task prompt — Deliverables author/reviewer: split the flat model×effort list

Narrow follow-up to PHASE8_DELIVERABLES_FIX_CODEX_PROMPT.md item 5. Recommended model:
**gpt-5.3-codex** at **high** effort. Small, contained UI refactor — no engine changes.

## Status / why this exists
Item 5 is FUNCTIONALLY DONE: the author/reviewer dropdowns already let the operator pick
account + model + effort. `buildDeliverablesActorPool()` (public/app.js) calls
`catalogEntryVariants(entry, catalogEntries)` which expands each CLI account into every
`CLI_MODELS[provider] × CLI_EFFORTS[provider]` combination (e.g. cli-codex 4×5 = 20,
cli-claude 6×6 = 36 options PER account), each rendered as `label · account · model · effort`
via `actorDisplayLabel()`, and the chosen model/effort flow into the backend through
`actorChoiceFromId()`.

THE PROBLEM: that produces a single FLAT dropdown of 100+ options per author and per
reviewer (≈2 accounts × (20 codex + 36 claude) + net profiles). It is technically correct
but unusable to scan. This task replaces the mega-list with cascading selectors.

## Goal
Replace each flat author/reviewer `<select>` in `#deliverablesExecForm` (and the Doc form's
`#docAuthor`) with **cascading selectors**: Agent/Account ▾ → Model ▾ → Effort ▾. The
operator first picks the agent+account, then the model, then the effort — short lists at
every step instead of one 100-row list.

## Where things live (verified)
- public/app.js:
    * `CLI_MODELS` (~3948 area) and `CLI_EFFORTS` (~3948) — the option sources. REUSE these,
      do not invent new lists.
    * `agentCatalog()` (one entry per account), `catalogEntryVariants()` (~4417, the current
      flat expansion — this is what you are replacing for the UI), `backendFromCatalogEntry(entry, {model, effort})` (~4364, already accepts model/effort overrides),
      `buildDeliverablesActorPool()` (uses catalogEntryVariants), `actorDisplayLabel()`
      (~4286, `label · account · model · effort`), `actorChoiceFromId()` (~4378),
      `ensureDeliverablesFormState()` (~4330), `syncDeliverablesFormFromDom()` (~4358),
      `renderDeliverables()` (~4398), `optionsHtml()` (~4387).
    * For reference, the quick agent-chip editor already does cascading CLI model/effort
      selectors (~4090-4115: `ag-model` / `ag-effort` from `CLI_MODELS`/`CLI_EFFORTS`) —
      mirror that pattern and its highlight/disable behavior.
- public/index.html: exec form selects `#execAuthor` / `#execReviewer` (~347-352),
  doc form `#docAuthor` (~362). Add the Model/Effort selects next to each, or build them
  in JS inside `renderDeliverables()`.

## Requirements
1. **Author block**: Agent/Account ▾ (the list of accounts/profiles from `agentCatalog()`,
   NOT the exploded variants) + Model ▾ (`CLI_MODELS[provider]` for the chosen account;
   for net profiles, the profile's own model / a text input as today) + Effort ▾
   (`CLI_EFFORTS[provider]`; hidden/“auto” for non-CLI). Same three for **Reviewer** and for
   the Doc form's **author**.
2. **Defaults**: pre-select the chat's two participants with THEIR real configured model/
   effort as today (Codex gpt-5.5/xhigh, Claude opus/max). Changing the account resets
   Model/Effort to that account's sensible default (the participant's config if it is one,
   else `weakModelFor` / first effort).
3. **Compose the backend** from the three picks via `backendFromCatalogEntry(entry, {model, effort})`
   (keep failover wiring it already adds). The composed backend that reaches
   `/api/exec-autopilot/start` (and `/api/deliverables/create`) MUST be byte-equivalent to
   what the current flat variant produced — so the server side needs NO change. Verify the
   chosen model/effort actually arrive in the backend object.
4. **Keep author != reviewer** enforced by identity (provider+account+model+effort), and
   keep the orange `.nav-highlight` cue on the exec selectors until Execution autopilot is
   pressed (item 1) — extend it to the new Model/Effort selects.
5. Retire the flat-variant path for the UI: `catalogEntryVariants()` can stay as a helper if
   `actorChoiceFromId`/identity still need it, but the dropdowns must no longer render the
   100-row flat list. If `catalogEntryVariants` becomes dead after the refactor, remove it.

## Constraints
- Bilingual UI: any new label/string in BOTH RU and EN i18n dicts; `tip.*` keys in both,
  RU/EN parity (CLAUDE.md). New labels likely needed: model selector, effort selector
  (reuse `ui.agentModel` / `ui.agentEffort` if they fit).
- Do NOT change `TAIL_CONTRACT`, `lib/prompt.js`, domain profiles; `npm test` (incl.
  `test/prompt.snapshot.test.js`) stays green.
- Do NOT change the server/exec-autopilot engine or governance (resolved + optIn gate,
  narrowed write root, CLI isolation). This is a frontend selector refactor only — the only
  acceptable backend touch is none.
- No new dependencies; no build step.

## Verification (do this, report what you saw)
1. Restart via "Council Room v2.bat"; open the Phase 12 chat, expand Deliverables.
2. Author and Reviewer now show three short selectors (Account ▾ / Model ▾ / Effort ▾),
   not one 100-row list. Doc form author likewise.
3. Pick a non-default account, then a non-default model and effort; Start exec-autopilot and
   confirm (via the draft log / state) the run used exactly the chosen account+model+effort.
4. author != reviewer still enforced; orange highlight still cues the selectors pre-run.
5. `npm test` green. Short before/after note + screenshot of the new selectors.

## Commit etiquette (per CLAUDE.md)
- Commit only when asked; default branch `main`; narrow range (expect public/app.js,
  public/index.html, public/styles.css). End the message with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
