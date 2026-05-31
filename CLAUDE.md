# CLAUDE.md — Council Room v2

Guidance for Claude Code working in this repo. Read `DATA_SOURCES.md` and `HANDOFF.md`
first — they are the source of truth for data sources, the file map, and where the
project currently stands. This file is the short orientation; those two are the detail.

## What this is
A local web app where 2–5 AI agents debate a topic in structured rounds and drive each
subtask to a closed state. Node, zero-framework backend (`server.js` + `lib/*`), vanilla
frontend (`public/`). No build step.

## Run / restart
- Launch: `Council Room v2.bat` (Windows). It frees the port before starting.
- Port: **8788** (`COUNCIL_ROOM_V2_PORT`). UI at `http://localhost:8788/`.
- A code change needs an **actual server-process restart** — the running process holds the
  old code in memory. `node --check <file>` alone proves nothing about the live app; relaunch
  the `.bat` (it kills the port holder) and re-test in the browser.

## Tests
- Plain Node scripts, no runner: `npm test`, or `node test/<file>.js` individually.
- `test/prompt.snapshot.test.js` guards a **golden snapshot** of the `code`-profile debate
  prompt — if you change prompt scaffolding, expect it to flag drift; update intentionally.

## Architecture (where things live)
- `server.js` — HTTP API + SSE, `runRound`/`runAutopilot`, static serving, `publicState()`.
- `lib/prompt.js` — `buildDebatePrompt`, `parseAgentTail`, and the **`TAIL_CONTRACT`** (the
  5-line machine tail anchors). The tail is invariant across ALL profiles by design: the app
  parses `Status` to detect consensus and applies `KB-patch`. Do not remove it per-profile.
- `lib/domains.js` — discussion-profile registry (`code`/`general`/`research`/`creative`/`free`).
  Adding a profile here makes it appear in the UI selector with no frontend edit. Profiles only
  change `systemLines` + `sections`; never the tail anchors.
- `lib/cli.js` — `runCodex`/`runClaude` (subscription CLI backends). Isolated runs use a
  throwaway dir in the **OS temp area** (`fs.mkdtempSync(os.tmpdir()/"council-room-v2-")`,
  removed in a `finally`) — deliberately outside `C:\AI` so Claude Code does not walk up into
  `C:\AI\CLAUDE.md`. Unique per call → race-free for parallel participants.
- `lib/providers.js` — network/API backends: `anthropic` (native `/v1/messages`, prompt
  caching), `openai-compatible` (OpenAI/DeepSeek/Groq/OpenRouter/Mistral/Together), `ollama`.
  `runProfile(profile, prompt, opts)` is the uniform contract shared with `cli.js`. OpenRouter
  gets two failover layers: `fallbackModels` → `models:[...]` (model-level) and `openrouterPool`
  (account-level, across a `keyPool` of every `OPENROUTER_API_KEY*` key; reports `usedRef`).
- `lib/orquota.js` → `rooms/.or-quota.json` — per-key daily request tally for the OpenRouter
  free pool (it exposes no remaining number); drives the Agents-panel quota readout.
- `lib/roles.js` — dispatches a resolved role to its backend (CLI vs network) with failover.
- `public/app.js` — i18n (RU/EN dicts ~line 90 and ~line 490), `render*`, tooltips
  (`helpIcon(tipKey)` → `tip.<key>` in both dicts — keep RU/EN in parity).
- `rooms/<runId>/` — per-chat data (gitignored).

## Conventions
- **Prompt scaffolding is English** as the single source of truth; the agent's *response*
  language is set separately by the `LANGUAGE:` directive. Tail tokens are English literals.
- **Backends — token economy:** CLI backends carry a ~6–7k-token agent harness on every call
  (one Codex turn ≈ 8k, measured); the network/API path is ~1–2k (no harness). For minimal-token
  debates prefer an API backend — OpenRouter `:free` models cost $0; add several keys for a pooled,
  failover'd, load-spread setup. See the `tip.tokenEconomy` tooltip for the full rationale.
- **Settings dual-store:** `state.settings` (global UI) vs `state.run.settings` (per-chat);
  `applyRunSettings` syncs them on chat activation. Global UI prefs go to `localStorage`.
- **Windows / PowerShell** shell. Non-ASCII (Cyrillic) POST bodies via inline `curl -d` get
  mangled — POST non-ASCII from a file (`--data-binary @file`) or via PowerShell.

## Git
- Commit/push only when asked. Default branch is `main`.
- End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
