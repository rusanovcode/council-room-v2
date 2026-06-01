# TZ Phase 1: Local Gateway / Auto-Failover

## ⚠️ STATUS: BLOCKED

**Unblock condition:** a real Codex positive limit sample with `rate_limit_reached_type != null`  
must be observed in a Codex JSONL session file.

Until then: `codex.failoverEnabled = false`. Do not start implementation.

**Prerequisite:** Phase 0B (`TZ-phase-0B-codex-launch-fix.md`) must be completed first.

---

## 1. Goal

Build a local `operator-gateway` (`ai-server`) on `127.0.0.1` that:
- Launches Claude Code and Codex CLI through isolated auth profiles
- Exposes a single HTTP interface to all projects (`POST /run`, `GET /status`, `POST /switch`)
- On detected rate-limit error: auto-switches to the second profile and retries once
- Never switches on: auth / network / timeout / shell errors

**Context:**
- Claude account 1: `%USERPROFILE%\.claude\` (env unset)  
- Claude account 2: `C:\AI\ai-switcher\auth\claude-acc2\` (via `CLAUDE_CONFIG_DIR`)
- Codex account 1: `%USERPROFILE%\.codex\` (env unset)  
- Codex account 2: `C:\AI\ai-switcher\auth\codex-acc2\` (via `CODEX_HOME`)
- Manual switching already works via `switch.ps1`, `claude2.bat`, `codex2.bat` (see `SUMMARY.md`)
- Council Room already has two launchers: `Council Room.bat` (acc1, port 8787) and `council2.bat` (acc2, port 8788)

---

## 2. File Layout

```
C:\AI\ai-switcher\
├── profiles.json          ← profile registry (name, service, config path, active flag)
├── active.json            ← current active profile per service
├── projects.policy.json   ← per-project ACL (allow/deny/protected/ignore)
├── tokens.json            ← usage counters (updated on each run)
├── limits.ndjson          ← append-only log of detected limit events
├── audit.ndjson           ← append-only log of every switch event
├── locks\                 ← per-profile mutex files (profile-name.lock)
├── handoff\               ← per-project handoff docs
│   └── <projectId>.md
├── switch.ps1             ← existing manual switcher (DO NOT MODIFY in Phase 1)
├── auth\
│   ├── claude-acc2\       ← existing Claude acc2 config
│   └── codex-acc2\        ← existing Codex acc2 config
└── TZ-phase-0B-...md      ← this phase's prerequisite
    TZ-phase-1-...md       ← this file
```

---

## 3. CLI Commands

| Command | Description |
|---|---|
| `ai-server start` | Start the gateway process on 127.0.0.1 |
| `ai-status` | Show active profiles, current locks, recent limit events |
| `ai-register` | Register current working directory as a project |
| `ai-claude -p "<prompt>"` | Run Claude through the gateway |
| `ai-codex -p "<prompt>"` | Run Codex through the gateway |
| `ai-kill <projectId>` | Terminate the running command for a project |
| `ai-policy list` | Show ACL for all registered projects |
| `ai-policy allow <path>` | Allow a project to use the gateway |
| `ai-policy deny <path>` | Block a project from using the gateway |

Later (Phase 1.1): `ai-register`, `ai-server stop`, `ai-policy set/revoke`

---

## 4. profiles.json Schema

```json
{
  "claude": [
    {
      "name": "claude-acc1",
      "configDir": null,
      "active": true
    },
    {
      "name": "claude-acc2",
      "configDir": "C:\\AI\\ai-switcher\\auth\\claude-acc2",
      "active": false
    }
  ],
  "codex": [
    {
      "name": "codex-acc1",
      "codexHome": null,
      "active": true,
      "failoverEnabled": false
    },
    {
      "name": "codex-acc2",
      "codexHome": "C:\\AI\\ai-switcher\\codex-acc2",
      "active": false,
      "failoverEnabled": false
    }
  ]
}
```

`codex.failoverEnabled = false` for all Codex profiles until positive limit sample is confirmed.

---

## 5. projects.policy.json Schema

```json
{
  "C:\\AI\\Work": { "policy": "allow", "service": "claude" },
  "C:\\AI\\adaptive_systems_lab": { "policy": "protected" },
  "C:\\AI\\game_agent": { "policy": "protected" },
  "C:\\Users\\Иван\\Documents": { "policy": "unclassified" }
}
```

**Policy rules:**
- `allow` — project can use `ai-claude` / `ai-codex`
- `deny` — gateway rejects all requests from this path
- `protected` — read-only for gateway; no commands executed
- `ignore` — gateway ignores this path entirely
- `unclassified` — reject with an explicit message asking user to classify

**Inheritance:** a subdirectory inherits the most restrictive parent policy.  
**Re-read on every `/run`:** policy is never cached between requests.

**Hardcoded deny-write list (no policy can override):**
- `C:\AI\adaptive_systems_lab` — system agent runtime
- `C:\AI\game_agent` — isolated runtime, read-only per CLAUDE.md

---

## 6. Limit Detection

### 6.1 Claude

Source: JSONL session files in `%USERPROFILE%\.claude\projects\` and `CLAUDE_CONFIG_DIR\projects\`

Trigger condition (all three must be true):
1. Event has `"isApiErrorMessage": true`
2. `"apiErrorStatus": 429` OR `"error": "rate_limit"`
3. Whitelist regex matches `content[0].text`:
   ```
   (?i)(you.?ve hit your limit|rate limit reached|usage limit|rate_limit)
   ```
   Note: `you've` uses U+2019 RIGHT SINGLE QUOTATION MARK — regex `you.?ve` covers it.

Deny-list (do NOT trigger failover):
- `"error": "authentication_failed"` / status 403
- `"error": "invalid_request"`
- `"error": "oauth_org_not_allowed"`
- Text matches `(?i)(not logged in|please run /login|401|403)`

JSONL slug mapping: `sessionId` from the first event in the file maps to the session.  
Do NOT derive slug from `cwd` path mangling (known issue with Cyrillic paths like `C:\Users\Иван`).

### 6.2 Codex

Source: stdout/stderr of Codex CLI process + JSONL session files in `CODEX_HOME\sessions\YYYY\MM\DD\`

Trigger condition:
1. `rate_limit_reached_type` field is non-null:
   ```
   rate_limit_reached_type":\s*"
   ```
2. OR stdout/stderr matches whitelist regex:
   ```
   (?i)(rate[_ -]?limit|429|too many requests|quota|usage limit|limit reached)
   ```

**`codex.failoverEnabled` check:**  
Before any Codex switch: read `profiles.json` → if `failoverEnabled = false` → abort switch, log to `limits.ndjson`, do NOT retry.

Deny-list (do NOT trigger failover regardless of failoverEnabled):
- `shell_snapshot not supported for PowerShell`
- `Failed to create shell snapshot`
- `Not logged in` / `Please run /login`
- Exit code due to auth (401, 403)
- Network errors: ECONNRESET, ECONNREFUSED, ETIMEDOUT, timeout flag

### 6.3 Switch Rule (whitelist + exit ≠ 0 + deny-list)

```
switch = whitelist_match AND exit_code != 0 AND NOT deny_match AND failoverEnabled
```

Retry: exactly **one** retry after switch. No further retries.

---

## 7. Lock System

- Lock file: `C:\AI\ai-switcher\locks\<profile-name>.lock`
- Content: `{ "lockedBy": "<projectId>", "pid": <pid>, "since": "<ISO>" }`
- Acquire: atomic create-if-not-exists
- Timeout: 30 seconds — if lock is held longer, it is stale and can be overwritten
- While locked: other `/run` requests receive `{ "status": "BUSY", "lockedBy": "<projectId>" }`
- `ai-kill` releases the lock immediately

---

## 8. Atomic Writes

All writes to `projects.policy.json`, `tokens.json`, `active.json` must use:
```
write to .tmp file → fsync → rename to target
```
Never write directly to target to avoid partial-JSON on disk.

---

## 9. HTTP API

**Server:** `http://127.0.0.1:<port>` — LAN binding prohibited.

### POST /run
```json
{
  "service": "claude",
  "prompt": "...",
  "cwd": "C:\\AI\\Work",
  "projectId": "my-project"
}
```
Response:
```json
{
  "ok": true,
  "output": "...",
  "profile": "claude-acc1",
  "switchOccurred": false,
  "durationMs": 1234
}
```

### GET /status
```json
{
  "claude": { "activeProfile": "claude-acc1", "locked": false },
  "codex": { "activeProfile": "codex-acc1", "locked": false, "failoverEnabled": false },
  "recentLimits": []
}
```

### POST /switch
Manual override (not auto-failover):
```json
{ "service": "claude", "profile": "claude-acc2" }
```

---

## 10. handoff/<projectId>.md Schema

```
projectId: my-project
cwd: C:\AI\Work
service: claude
activeProfile: claude-acc1
lastCommand: claude -p "..."
exitCode: 0
switchReason: null
policyStatus: allow
lockedBy: null
timestamp: 2026-05-26T12:00:00.000Z
```

---

## 11. Implementation Checklist (for when unblocked)

### 11.1 File initialization
- [ ] `profiles.json` — all profiles, `failoverEnabled: false` for Codex
- [ ] `active.json` — both services pointing to acc1
- [ ] `projects.policy.json` — classify all `C:\AI\*` projects
- [ ] `locks\` directory created

### 11.2 Server
- [ ] HTTP server on 127.0.0.1 only (reject non-loopback)
- [ ] `POST /run` — validate projectId, check policy, acquire lock, run CLI, release lock
- [ ] `GET /status` — read active.json + locks
- [ ] `POST /switch` — manual profile switch, write audit.ndjson

### 11.3 CLI wrappers
- [ ] `ai-status`
- [ ] `ai-policy list/set/allow/deny`
- [ ] `ai-codex`, `ai-claude` (wrappers to `/run`)
- [ ] `ai-kill <projectId>`

### 11.4 Limit detector
- [ ] JSONL watcher for Claude (cwd→sessionId mapping)
- [ ] stdout/stderr parser for Codex
- [ ] Two-pass whitelist+denylist logic
- [ ] `codex.failoverEnabled` check before any Codex switch

### 11.5 Lock system
- [ ] Acquire/release with 30s timeout
- [ ] `BUSY` response with `lockedBy`
- [ ] Stale lock cleanup on startup

### 11.6 Atomic writes
- [ ] `projects.policy.json` — tmp+fsync+rename
- [ ] `tokens.json` — tmp+fsync+rename

### 11.7 ACL
- [ ] Re-read policy on every `/run` (do not cache)
- [ ] `unclassified` → reject with classification prompt
- [ ] `protected` / `ignore` → reject silently
- [ ] Hardcoded denylist for `adaptive_systems_lab` and `game_agent` write access

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| False failover on per-minute rate limit | Whitelist only subscription/monthly limits, not bare 429 |
| Token-leak via shared gateway | `ai-revoke` + Windows ACL on `C:\AI\ai-switcher\` |
| Race on auth files | Per-profile mutex lock |
| Partial JSON on disk | Atomic write (tmp+rename) |
| JSONL slug unknown | Read `sessionId` from first event, NOT cwd mangling |
| No Codex positive sample | `failoverEnabled=false` until sample confirmed |
| Cyrillic/spaces in paths | Test slug mapping on Cyrillic paths before enabling |
| Mixing Phase 0B and Phase 1 | This document is strictly separated; do not combine execution |

---

## 13. Acceptance Criteria (for when unblocked)

- [ ] Switch occurs **only** when: whitelist match + exitCode ≠ 0 + NOT deny match + failoverEnabled
- [ ] Switch does NOT occur on: auth / 401 / 403 / network / timeout / shell_snapshot
- [ ] After failover: retry executed exactly once
- [ ] `protected` / `ignore` / `unclassified` projects → rejected at `ai-register`
- [ ] Policy change via `ai-policy deny` blocks next request (not current)
- [ ] `ai-kill` interrupts current command for projectId
- [ ] Two projects on different profiles run in parallel without blocking each other
- [ ] Every switch is written to `audit.ndjson`
- [ ] Server does not listen on LAN (127.0.0.1 only)
- [ ] `codex.failoverEnabled = false` — Codex does NOT auto-switch by default

---

*Phase 0B (server.js fix) must be completed before starting Phase 1.*  
*Phase 1 remains blocked until Codex `rate_limit_reached_type != null` sample is obtained.*
