---
name: project-phase1b
description: Phase 1B implementation — Codex via node-pty with limit detection, completed 2026-05-27
metadata:
  type: project
---

Phase 1B завершена: Codex запускается через node-pty (PTY) с JSONL limit detection.

**Key implementation details:**
- `codex exec --json --skip-git-repo-check <prompt>` — non-interactive mode
- After PTY spawn, send `\x04` (EOT) after 500ms to signal no more stdin input (Codex blocks on stdin otherwise)
- `checkCodexOutput()`: deny-list checked FIRST, then rate_limit_reached_type whitelist
- JSONL tailing: polls `CODEX_HOME/sessions/**/*.jsonl` every 500ms as parallel detection channel
- node-pty 1.1.0 installed with prebuilt binaries (no MSVC needed on this machine)

**Why:** `codex` (interactive) needed PTY to avoid "stdin is not a terminal". `codex exec` is non-interactive but still reads stdin — EOT closes it.

**How to apply:** When modifying Codex launch in server.js, keep the EOT write and the `exec --json --skip-git-repo-check` flags. Do NOT use plain `codex <prompt>` (interactive, hangs). [[project-phase1a]]
