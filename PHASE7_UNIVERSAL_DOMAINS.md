# Phase 7 — Universal Council Room (domain profiles as data, "Plan B")

Goal: drop the "software-development" specialization and make the agent universal (problem
solving, philosophy, history, literature, sciences). The debate mechanics (subtask → rounds →
questions → verify → resolve/block) DO NOT change. The "code framing" is extracted into a
swappable **domain profile** (pure data). The default profile `code` reproduces today's behavior.

> Document for step-by-step execution **by another agent in small steps**. Each step ends with a
> verification block. After all steps — return to the lead agent for a joint review
> (see "Final acceptance").

---

## 0. NON-NEGOTIABLE invariants (a breach = failed step)

1. **The machine tail-contract is identical for all profiles.** The anchors read by
   `parseAgentTail` — `New facts:`, `New risks:`, `New alternatives:`, `Status:`,
   `KB-patch:`, `Resolved:`, `Verify:`, `Priority:` — and the `KB-patch: [section: item]`
   grammar are **fixed**. A profile changes only the intro text/wording, NOT the anchors.
2. **The `code` profile = current prompt byte-for-byte** (golden snapshot, step 7a).
3. **Isolation by default is preserved**: with `allowFilesystemScan=false`, `code` still injects
   `NO_SCAN_GUARD`; with `strictScope=true` — `STRICT_SCOPE_RULE`.
4. Rooms with no profile field are silently treated as `code` (no forced migration of
   `rooms/<id>/state.json`).
5. Prompts are **not summarized**; answers ≤ 12 sentences; the subtask→round→questions→verify loop
   is untouched.

### Environment notes (from prior phases)
- After edits — **a real process restart**: kill the holder of port **8788**, relaunch
  `Council Room v2.bat`. "Seems to have restarted" does not count.
- Settings use a **dual store**: `state.settings` (global) vs `state.run.settings` (per-chat),
  synced via `applyRunSettings`. Treat the new `discussionMode` field like `strictScope`.
- POST of non-ASCII (RU) text — only via a file (`--data-binary @`) or PowerShell, never inline
  `curl -d` (otherwise mojibake).
- Files touched: `lib/prompt.js`, `lib/knowledge.js`, `server.js`, `public/app.js`,
  new `lib/domains.js`, tests under `test/`.

### Coupling map (what breaks easily)
- The answer tail lives in 3 places: emitted in `prompt.js`, parsed in `prompt.js`
  (`parseAgentTail`), parsed again in the frontend `app.js` (coach, ~lines 1139-1141). There must
  be a single source of truth.
- KB section set: `knowledge.js` (`SECTIONS` + `addItem` validation), the `open_questions`
  special case in `server.js` (~line 483), and duplicated labels/tips + render list in
  `app.js` (~71-100, 420-449, 1663-1692).

---

## Phase 7a — Safety net first (golden snapshot)

**Do not proceed without this step.** Capture the baseline BEFORE any edits.

### Step 7a.1 — Pin the current prompt output
- Create `test/prompt.snapshot.test.js`: on a fixed input (subtask + KB + recentTurns +
  openQuestions; plus a separate case with `verify`) call `prompt.buildDebatePrompt(...)` against
  the current code and write the output to `test/__snapshots__/code-debate.txt` (create if absent;
  if present — compare and fail on any diff).
- Also pin the `parseAgentTail` output on 5–6 real answers (take from any
  `rooms/*/transcript.jsonl`, the `text` field of `kind:"debate"`) → `test/__snapshots__/parse-tail.json`.

**Check 7a.1**
- [ ] `node test/prompt.snapshot.test.js` — green, baselines created.
- [ ] Baselines committed (this is the "gold" we compare against throughout Phase 7).
- [ ] `node --check server.js lib/prompt.js` — no errors.

---

## Phase 7b — Extract `TAIL_CONTRACT` (refactor, behavior identical)

Goal: a single source of truth for the tail. Behavior unchanged; the 7a golden must stay green.

### Step 7b.1 — Add the contract and builders to `prompt.js` (do not wire yet)
Insert (without rewriting anything yet):

```js
const TAIL_CONTRACT = {
  emptyTokens: ["none", "нет"],
  statusValues: ["continue", "resolve", "block"],
  fields: [
    { key: "newFacts",        anchor: "New facts",        hint: "[list or 'none']", list: true },
    { key: "newRisks",        anchor: "New risks",        hint: "[list or 'none']", list: true },
    { key: "newAlternatives", anchor: "New alternatives", hint: "[list or 'none']", list: true },
    { key: "status",          anchor: "Status",           hint: "continue | resolve | block" },
    { key: "kbPatch",         anchor: "KB-patch",         hint: "[section: item] (one line per patch, or 'none')" },
  ],
  signals: { resolved: "Resolved", verify: "Verify", priority: "Priority" },
  statusSemantics: [
    "- Status=resolve means: the subtask is ready to close (nothing left to debate).",
    "- Status=block means: the subtask is blocked — state what is needed from the user.",
  ],
};

function availableSectionsLines(keys, maxWidth = 78) {
  const head = "    Available KB sections: ", indent = "    ";
  const out = []; let line = head, atStart = true;
  keys.forEach((key, i) => {
    const piece = key + (i < keys.length - 1 ? "," : "");
    const candidate = atStart ? line + piece : line + " " + piece;
    if (!atStart && candidate.length > maxWidth) { out.push(line); line = indent + piece; }
    else line = candidate;
    atStart = false;
  });
  out.push(line);
  return out;
}

function tailPromptLines(sectionKeys) {
  const lines = ["- Every answer MUST end with these lines:"];
  for (const f of TAIL_CONTRACT.fields) lines.push(`    ${f.anchor}: ${f.hint}`);
  lines.push(...availableSectionsLines(sectionKeys));
  lines.push(...TAIL_CONTRACT.statusSemantics);
  return lines;
}
```

**Check 7b.1**
- [ ] `node --check lib/prompt.js`.
- [ ] Micro-test: `availableSectionsLines(["decisions","prohibitions","control_contract","files_in_scope","files_out_of_scope","verification_commands","open_questions"])`
  yields exactly 2 lines:
  - `    Available KB sections: decisions, prohibitions, control_contract,`
  - `    files_in_scope, files_out_of_scope, verification_commands, open_questions`
- [ ] 7a golden still green (nothing wired yet).

### Step 7b.2 — Rewrite `parseAgentTail` on top of the contract
Replace the body with a version that derives all matchers from `TAIL_CONTRACT` (anchors + signals).
Regex logic unchanged: `emptyTokens` → `/^(?:none|нет)$/i`; `Status` with `\b`;
KB-patch `^\[?\s*([a-z_]+)\s*:\s*(.+?)\s*\]?$`; Resolved split `,(?=\s*Q\d+\b)`;
Verify `matchAll(/Q(\d+)/gi)` + `\bok\b`; Priority split `[,;]` + `Q(\d+)\s*[=:]\s*(critical|minor)`.

**Check 7b.2**
- [ ] `node test/prompt.snapshot.test.js` — `parse-tail.json` matches the 7a baseline (parity).
- [ ] `node --check lib/prompt.js`.

### Step 7b.3 — Wire `tailPromptLines` into `STATIC_SYSTEM`
In `STATIC_SYSTEM` replace the current tail lines (from `"- Every answer MUST end with these lines:"`
through `"- Status=block means: …"`, including the hardcoded "Available KB sections") with a call to
`...tailPromptLines(<code section keys>)`. Code keys = the current 7 sections.

**Check 7b.3**
- [ ] `node test/prompt.snapshot.test.js` — `code-debate.txt` matches the 7a baseline **byte-for-byte**.
- [ ] `node --check lib/prompt.js server.js`.
- [ ] Restart the server (port 8788), run one round in an existing chat — answers parse as before.

---

## Phase 7c — Profile registry `lib/domains.js` (+ the `code` profile)

### Step 7c.1 — Create `lib/domains.js`
Profile schema: `{ id, label:{ru,en}, systemLines:[...], sections:[{key,title,tipRu,tipEn}],
guards:{scanApplies,scopeApplies}, tail: TAIL_CONTRACT }`.
Exports: `getProfile(id)`, `DEFAULT="code"`, `list()`. Unknown id → `getProfile("code")`.

The `code` profile (framing = current lines 1–16 of `STATIC_SYSTEM`, WITHOUT the tail block — that
comes from `tailPromptLines`; sections = current 7; both guards true):

```js
{
  id: "code",
  label: { ru: "Разработка ПО", en: "Software" },
  guards: { scanApplies: true, scopeApplies: true },
  systemLines: [
    "You are a participant in Council Room v2 — a closed room of 2 to 5 AI agents.",
    "Room goal: drive every open subtask to a closed state through structured debate.",
    "",
    "Rules (fixed, no need to repeat):",
    "- Debate is strictly read-only. Do not implement, do not modify files.",
    "- Answer about THE ONE active subtask only. Do not discuss past/future ones.",
    "- If the active subtask lacks facts — start with `QUESTION:` and up to 3 short questions.",
    "- If facts are sufficient — give a position, risks, open questions, and a `REPORT:` block.",
    "- Each answer ≤ 12 sentences. Brevity is a feature, not a flaw.",
  ],
  sections: [
    { key: "decisions",            title: "Decisions (Frozen)" },
    { key: "prohibitions",         title: "Prohibitions" },
    { key: "control_contract",     title: "Control Contract" },
    { key: "files_in_scope",       title: "Files in Scope" },
    { key: "files_out_of_scope",   title: "Files Out of Scope" },
    { key: "verification_commands",title: "Verification Commands" },
    { key: "open_questions",       title: "Open Questions" },
  ],
}
```

> ⚠️ Verify the `code` `systemLines` against the real lines 1–16 of the current `STATIC_SYSTEM`
> verbatim (including `REPORT:`/`QUESTION:`), or the 7a golden will break.

**Check 7c.1**
- [ ] `node --check lib/domains.js`.
- [ ] `node -e "console.log(require('./lib/domains').list())"` — includes `code`.

### Step 7c.2 — `buildDebatePrompt` assembles the system block from the profile
Add a `domain` parameter (default `getProfile("code")`). Assemble:
`[...domain.systemLines, ...tailPromptLines(domain.sections.map(s=>s.key)), "", ...QUESTIONS_PROTOCOL]`,
where `QUESTIONS_PROTOCOL` = the current "Working with OPEN QUESTIONS …" block (lines 28–40 of
`STATIC_SYSTEM`), extracted into a shared constant (its `Resolved/Priority/Verify` anchors also come
from `TAIL_CONTRACT.signals`). Guard conditions: `if (!allowFilesystemScan && domain.guards.scanApplies)`
and `if (strictScope && domain.guards.scopeApplies)`.

**Check 7c.2**
- [ ] `node test/prompt.snapshot.test.js` — `code-debate.txt` still **byte-for-byte** (now via the profile).
- [ ] `node --check lib/prompt.js`.

---

## Phase 7d — KB sections as a function of the profile (`lib/knowledge.js`)

### Step 7d.1 — Parameterize the section set
`load/save/parse/serialize/addItem/removeItem/replaceSection/snapshotForPrompt` take a section set
(or `domainId`), resolved via `domains.getProfile`. Default with no argument = `code` (old calls keep
working). `addItem` validates a section against the **active profile's** set for the room.
`open_questions` is still excluded from `snapshotForPrompt`.

**Check 7d.1**
- [ ] `node --check lib/knowledge.js`.
- [ ] An old call `knowledge.load(dir)` (no domain) returns the same 7 sections as before.
- [ ] A KB-patch into a section not in the profile is safely ignored (no crash): verify
  `try{ addItem(dir,"nonsense","x") }catch{}` writes nothing.

---

## Phase 7e — Profile pass-through in `server.js` + dual store

### Step 7e.1 — `discussionMode` in settings
- Add `discussionMode` to `state.settings` and `state.run.settings` (default `"code"`).
- Handle it in `applyRunSettings` (mirrors active room ↔ global) and in `defaultRun`.
- `/api/settings` validates `discussionMode ∈ domains.list()`, else → `"code"`.

**Check 7e.1**
- [ ] `node --check server.js`.
- [ ] `POST /api/settings` with a valid `discussionMode` persists; with garbage → falls back to `code`.
- [ ] An existing chat with no field loads as `code` (no errors).

### Step 7e.2 — Pass the profile into the prompt and KB
- In `promptCommon` add
  `domain: domains.getProfile(state.run.settings?.discussionMode ?? state.settings.discussionMode ?? "code")`.
- `knowledge.*` calls for this room get its section set.
- Keep the KB-patch routing (`open_questions` special case); everything else `try{ knowledge.addItem }catch{}`.

**Check 7e.2**
- [ ] Restart the server; round in a `code` chat — golden behavior, answers parse.
- [ ] `publicState()` exposes the active profile (for the frontend) — e.g. `state.domain = {id, label, sections}`.

### Step 7e.3 — Guard switching the profile on a non-empty KB
Switching `discussionMode` on a room whose `knowledge.md` already holds items not in the new set must
be **blocked or warned** (no silent loss of sections). First iteration: forbid the switch if any
"foreign" items exist.

**Check 7e.3**
- [ ] Attempting to switch the profile on a room with a populated KB of another set → refused/warned, data intact.

---

## Phase 7f — Frontend `public/app.js` (remove hardcode duplication)

### Step 7f.1 — KB sections from state
Build KB labels/tips (~71-100, 420-449) and the section render list (~1663-1692) from
`state.domain.sections`, not literals. Add a profile selector to chat settings (next to the
scope/scan toggles). Hide/disable the scan/scope toggles when `guards.scanApplies/scopeApplies=false`.

**Check 7f.1**
- [ ] The coach panel (facts/risks/alts, ~1139-1141) is **untouched** and still fills (shared anchors).
- [ ] In a `code` chat the KB shows the previous 7 sections with the previous RU/EN labels.
- [ ] No orphaned section literals remain in `app.js` (grep old keys — only via data).

---

## Phase 7g — The `general` profile (first non-code)

### Step 7g.1 — Add `general` to `domains.js`
```js
{
  id: "general",
  label: { ru: "Общий", en: "General" },
  guards: { scanApplies: false, scopeApplies: false },
  systemLines: [
    "You are a participant in Council Room — a closed room of 2 to 5 AI agents.",
    "Room goal: drive every open subtask to a closed state through structured debate.",
    "",
    "Rules (fixed, no need to repeat):",
    "- This is a discussion, not execution: reason, weigh options, decide. Do not perform external actions.",
    "- Answer about THE ONE active subtask only. Do not discuss past or future ones.",
    "- Ground every claim in the subtask text, the Knowledge Base, or any attached documents.",
    "  Do not invent facts — if something is missing, start with `QUESTION:` and up to 3 short questions.",
    "- If the facts are sufficient — give a clear position, the main objections to it, and what stays open.",
    "- Each answer ≤ 12 sentences. Brevity is a feature, not a flaw.",
    "- In the closing lines, read 'New risks' as weaknesses / objections to your position,",
    "  and 'New alternatives' as competing options or interpretations.",
  ],
  sections: [
    { key: "key_claims",     title: "Key Claims",     tipRu: "Главные тезисы и позиции по задаче.", tipEn: "Main claims and positions on the task." },
    { key: "evidence",       title: "Evidence",       tipRu: "Факты, данные и доводы в подтверждение тезисов.", tipEn: "Facts, data and reasoning that support the claims." },
    { key: "definitions",    title: "Definitions",    tipRu: "Согласованные термины и трактовки.", tipEn: "Agreed terms and framings." },
    { key: "constraints",    title: "Constraints",    tipRu: "Условия и рамки задачи: что нельзя нарушать.", tipEn: "Conditions and boundaries that must hold." },
    { key: "decisions",      title: "Decisions",      tipRu: "Зафиксированные выводы.", tipEn: "Settled conclusions." },
    { key: "open_questions", title: "Open Questions", tipRu: "Что ещё не решено.", tipEn: "What remains unresolved." },
  ],
}
```

**Check 7g.1**
- [ ] `node --check lib/domains.js`; `list()` includes `general`.
- [ ] Create a `general` chat, open a subtask, run 2 rounds: answers parse (same tail), a question
  closes only once ALL participants marked it; the prompt has no mention of files/scope.
- [ ] KB renders with the `general` sections; scan/scope toggles hidden.
- [ ] Run with RU input — no mojibake (POST via file/PowerShell).

---

## Phase 7h — The `research` and `creative` profiles

### Step 7h.1 — `research`
```js
{
  id: "research",
  label: { ru: "Исследование", en: "Research" },
  guards: { scanApplies: false, scopeApplies: false },
  systemLines: [
    "You are a participant in Council Room — a closed room of 2 to 5 AI agents.",
    "Room goal: drive every open subtask (research question) to a closed state through structured debate.",
    "",
    "Rules (fixed, no need to repeat):",
    "- This is an analytical inquiry: argue from evidence, separate fact from inference.",
    "- Answer about THE ONE active subtask only.",
    "- Every factual claim must be traceable to a source, the Knowledge Base, or attached documents.",
    "  Record sources in the Sources section. Do not fabricate citations — if a source is missing, ask via `QUESTION:`.",
    "- Explicitly distinguish established fact, reasoned inference, and speculation.",
    "- If the evidence is sufficient — state conclusions with their degree of confidence and the strongest counterpoints.",
    "- Each answer ≤ 12 sentences.",
    "- In the closing lines, read 'New risks' as weak points / threats to a conclusion's validity,",
    "  and 'New alternatives' as competing hypotheses or interpretations.",
  ],
  sections: [
    { key: "thesis",         title: "Thesis",            tipRu: "Исследуемый вопрос или гипотеза.", tipEn: "The question under study or the hypothesis." },
    { key: "definitions",    title: "Definitions & Scope", tipRu: "Термины и границы исследования.", tipEn: "Terms and the boundaries of the inquiry." },
    { key: "evidence",       title: "Evidence",          tipRu: "Данные, наблюдения, цитаты за/против.", tipEn: "Data, observations, quotes for or against." },
    { key: "sources",        title: "Sources",           tipRu: "Первоисточники и ссылки.", tipEn: "Primary sources and references." },
    { key: "counterpoints",  title: "Counterpoints",     tipRu: "Возражения и альтернативные гипотезы.", tipEn: "Objections and competing hypotheses." },
    { key: "conclusions",    title: "Conclusions",       tipRu: "Обоснованные выводы с уверенностью.", tipEn: "Justified conclusions with stated confidence." },
    { key: "open_questions", title: "Open Questions",    tipRu: "Что ещё не выяснено.", tipEn: "What remains to be established." },
  ],
}
```

### Step 7h.2 — `creative`
```js
{
  id: "creative",
  label: { ru: "Творческий", en: "Creative" },
  guards: { scanApplies: false, scopeApplies: false },
  systemLines: [
    "You are a participant in Council Room — a closed room of 2 to 5 AI agents.",
    "Room goal: drive every open subtask to a closed state through structured debate.",
    "",
    "Rules (fixed, no need to repeat):",
    "- This is a creative / interpretive discussion: develop ideas, weigh choices, refine the work.",
    "- Answer about THE ONE active subtask only.",
    "- Build on the premise, themes and constraints in the Knowledge Base and attached documents.",
    "  If the brief is unclear, ask via `QUESTION:` before inventing a direction.",
    "- Offer concrete options and their trade-offs, not vague praise; respect the stated constraints (genre, tone, length).",
    "- Each answer ≤ 12 sentences.",
    "- In the closing lines, read 'New risks' as weaknesses / what could fall flat,",
    "  and 'New alternatives' as other creative directions worth considering.",
  ],
  sections: [
    { key: "premise",        title: "Premise",      tipRu: "Замысел: идея, посыл, вопрос произведения.", tipEn: "Core idea, message or question of the work." },
    { key: "themes",         title: "Themes",       tipRu: "Темы и мотивы, которые держим.", tipEn: "Themes and motifs to sustain." },
    { key: "constraints",    title: "Constraints",  tipRu: "Рамки: жанр, тон, объём, стиль.", tipEn: "Boundaries: genre, tone, length, style." },
    { key: "elements",       title: "Elements",     tipRu: "Персонажи, образы, структура.", tipEn: "Characters, images, structure." },
    { key: "decisions",      title: "Decisions",    tipRu: "Зафиксированные творческие решения.", tipEn: "Settled creative choices." },
    { key: "open_questions", title: "Open Questions", tipRu: "Открытые творческие развилки.", tipEn: "Open creative forks." },
  ],
}
```

**Check 7h**
- [ ] `node --check lib/domains.js`; `list()` = `[code, general, research, creative]`.
- [ ] One chat each on `research` and `creative`: round runs, tail parses, KB shows the profile's
  sections, scan/scope hidden.
- [ ] `research`: confirm the `sources` section accepts KB-patches and fills.

---

## Phase 7i — Documentation and memory

### Step 7i.1 — Update docs
- `DATA_SOURCES.md`: add `lib/domains.js` to the file map; describe `discussionMode` and profiles.
- `HANDOFF.md` / `ROADMAP.md`: note Phase 7 and the `TAIL_CONTRACT`/`code`-snapshot invariant.

**Check 7i.1**
- [ ] Docs mention `domains.js`, `discussionMode`, `TAIL_CONTRACT`, the golden snapshot.

---

## Phase 7j — File-based profiles + builder UI

Goal: let users add a profile (a custom system prompt) WITHOUT editing `lib/domains.js`,
either by dropping a file or via an in-app builder. Built-in profiles stay in code.

### Step 7j.1 — File loader (`lib/domains.js`)
- A `profiles/` folder at repo root. Each `*.md` = one profile: a `---` frontmatter block
  (`id`, `label_en`, `label_ru`, `scan`, `scope`, repeated `section: key | Title | tip`) and a
  body that becomes `systemLines`. `README.md` is ignored.
- Built-in profiles move to `BUILTIN`; the live registry = `BUILTIN` + files. `reload()` re-scans.
- `parseProfileFile` returns `null` for non-profile text (so stray files are skipped); invalid id
  or id collision with a built-in/another file → skipped with a `console.warn`.
- `open_questions` auto-added if missing; section keys validated `^[a-z_]+$`; id `^[a-z][a-z0-9_]*$`.

**Check 7j.1**
- [ ] `parseProfileFile`/`serializeProfile` round-trip preserves systemLines (incl. blank lines).
- [ ] `README.md` and malformed files are skipped; built-ins still load.
- [ ] A hand-written `profiles/<id>.md` appears in `list()`/`options()` after `reload()`.

### Step 7j.2 — Create endpoint (`server.js`)
- `POST /api/domains/create` → `domains.createProfile(body)` writes `profiles/<id>.md` and reloads;
  validation errors → HTTP 400 with message; success → `{ok, id, domains}` and a `broadcast()`.
- `createProfile` validates BEFORE writing (no stray files on bad input).

**Check 7j.2**
- [ ] Valid payload creates the file and the profile is immediately in `options()`.
- [ ] Duplicate id, bad section key, empty prompt → 400, and no file written.

### Step 7j.3 — Builder UI (`public/app.js`)
- A **"+ New profile"** button next to the Mode selector opens a **two-step modal** (English only):
  step 1 = a guide explaining each field and why; step 2 = the form (id, labels, system prompt,
  KB sections as `key | Title | tip` lines, two guard checkboxes).
- The Mode selector reconciles its options against `state.domains` each render, so a freshly
  created profile shows up without a page reload.

**Check 7j.3**
- [ ] Clicking "+ New profile" shows the guide first, then the form.
- [ ] Creating a profile closes the modal and the new profile appears in the Mode selector.
- [ ] Server-side validation errors are shown inline in the form.

---

## Final acceptance (return to the lead agent — review together)

Run everything at once and present the results:

- [ ] **Code regression (the key one):** `node test/prompt.snapshot.test.js` — `code-debate.txt`
      byte-for-byte, `parse-tail.json` parity. Baseline was not re-captured.
- [ ] `node test/round.integration.test.js`, `roles.test.js`, `providers.test.js` — green.
- [ ] `node --check server.js lib/prompt.js lib/knowledge.js lib/domains.js` — clean.
- [ ] Tail anchors from a single source: grep `New facts|New risks|New alternatives` in `prompt.js`
      and `app.js` points to the shared contract/matches; no manual duplicates.
- [ ] `NO_SCAN_GUARD` present in `code` with `allowFilesystemScan=false`; absent in general/research/creative.
- [ ] `open_questions` present in all profiles; Q-ID/priority/verify work regardless of profile.
- [ ] Dual store: `discussionMode` persists in both layers, mirrored by `applyRunSettings`, a new chat
      gets the default; invalid → `code`.
- [ ] Switching the profile on a non-empty KB of another set — blocked/warned.
- [ ] Frontend: KB sections and tips from `state.domain`; coach fills; RU/EN i18n ok; scan/scope
      toggles hidden for non-code profiles.
- [ ] Smoke run: `general` chat — subtask → 2 rounds → question → verify → resolve.
- [ ] The same scenario on a `code` chat — behavior unchanged.
- [ ] Server actually restarted (port 8788), checks done on a fresh process.

---

### Phase 7 artifact map
| File | What was added |
|---|---|
| `lib/domains.js` | NEW: profile registry `code/general/research/creative`, `getProfile/list/DEFAULT` |
| `lib/prompt.js` | `TAIL_CONTRACT`, `tailPromptLines`, `availableSectionsLines`, `QUESTIONS_PROTOCOL`; `buildDebatePrompt(domain)`; `parseAgentTail` on the contract |
| `lib/knowledge.js` | sections as a function of the profile |
| `server.js` | `discussionMode` (dual store + validation), pass `domain` into prompt and KB, `state.domain` in publicState |
| `public/app.js` | KB sections/tips/profile selector from `state.domain`; scan/scope toggles per guards; **7j** "+ New profile" two-step builder modal; selector reconciles with `state.domains` |
| `test/` | `prompt.snapshot.test.js` + `__snapshots__/` (golden code prompt + parse parity) |
| `lib/domains.js` (7j) | file loader (`profiles/*.md`), `parseProfileFile`/`serializeProfile`, `reload`, `createProfile` |
| `server.js` (7j) | `POST /api/domains/create` (write file + reload) |
| `profiles/` (7j) | NEW: user profile files + `README.md` (format documentation, English) |
