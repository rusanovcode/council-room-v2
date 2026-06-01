# TZ Phase 0B: Codex Launch Fix in Council Room

**Status:** READY for execution  
**Scope:** single change in `server.js` — function `runCodex`, line 3617–3621

---

## 1. Problem

Codex CLI crashes when launched from Council Room with error:
```
Failed to create shell snapshot for powershell
Shell snapshot not supported yet for PowerShell
```

**Root cause (confirmed by reading server.js):**

`server.js` line 21 defines `LOCAL_CODEX_JS`:
```javascript
const LOCAL_CODEX_JS = path.join(ROOT, "node_modules", "@openai", "codex", "bin", "codex.js");
```

`C:\AI\Council Room\node_modules\@openai\codex\bin\codex.js` **exists on disk**.

`getCodexJs()` (line 715) returns `LOCAL_CODEX_JS` when it exists.

`runCodex()` (line 3617) calls:
```javascript
const result = await runCommand(codexJs ? "node" : CODEX_CMD, args, prompt, {
  useCmd: !codexJs,   // ← false when codexJs exists
  ...
});
```

When `codexJs` is set → `useCmd: false` → `runCommand` does `spawn("node", args, {...})` without cmd.exe wrapper.

`council2.ps1` launches `node server.js` inside a new PowerShell window (`Start-Process powershell ...`). Codex CLI sees PowerShell as the inherited shell context and tries to create a snapshot — which is unsupported.

**This is a runtime/shell failure, NOT a rate-limit and NOT an auth error.**

---

## 2. Fix

**File:** `C:\AI\Council Room\server.js`  
**Line:** 3618  
**Change:** `useCmd: !codexJs` → `useCmd: true`

### Before (line 3617–3621):
```javascript
const result = await runCommand(codexJs ? "node" : CODEX_CMD, args, prompt, {
  useCmd: !codexJs,
  logFile,
  timeoutMs: timeoutForSpeed(runtime.codexSpeed),
});
```

### After:
```javascript
const result = await runCommand(codexJs ? "node" : CODEX_CMD, args, prompt, {
  useCmd: true,
  logFile,
  timeoutMs: timeoutForSpeed(runtime.codexSpeed),
});
```

**What this does:** forces Codex to always launch via:
```
cmd.exe /d /s /c node "<codexJs>" exec ...
```
cmd.exe breaks the PowerShell parent-chain; Codex no longer detects PowerShell context.

**`env` note:** `runCommand` does not set `env:` in spawn options (lines 3480–3490). Node.js inherits `process.env` by default when `env` is omitted — so `CODEX_HOME` set in `council2.ps1` already propagates through the chain:
```
council2.ps1 → powershell (node server.js) → Node → cmd.exe → codex
```
No additional `env:` change required.

---

## 3. Boundaries — DO NOT TOUCH

| File / Directory | Reason |
|---|---|
| `C:\AI\Council Room\council2.bat` | Working A0 launcher |
| `C:\AI\Council Room\council2.ps1` | Sets env vars for second account, do not modify |
| `C:\AI\Council Room\Council Room.bat` | Primary launcher |
| `C:\AI\ai-switcher\auth\claude-acc2\` | Second Claude account auth |
| `C:\AI\ai-switcher\auth\codex-acc2\` | Second Codex account auth |
| `%USERPROFILE%\.claude\` | Primary Claude auth |
| `%USERPROFILE%\.codex\` | Primary Codex auth |
| Claude launch in `runClaude()` | Claude works correctly |
| Failover / gateway logic | Not in scope of this phase |

**Prohibited actions:**
- Patching Claude CLI or Codex CLI binaries
- Touching auth.json, .credentials.json, cookies, session tokens
- Adding auto-failover of any kind
- Switching accounts on: `shell_snapshot`, auth errors, 401, 403, network, timeout
- More than one retry
- Modifying council2.bat, council2.ps1, Council Room.bat

**`shell_snapshot` error = deny event, NOT a switch trigger.**

---

## 4. Step-by-Step Implementation Checklist

- [ ] **Step 1** — Open `C:\AI\Council Room\server.js`
- [ ] **Step 2** — Navigate to line 3617 (function `runCodex`)
- [ ] **Step 3** — Change `useCmd: !codexJs` to `useCmd: true`
- [ ] **Step 4** — Verify syntax:
  ```cmd
  node --check "C:\AI\Council Room\server.js"
  ```
  Expected: no output (no errors)
- [ ] **Step 5** — Close current Council Room (if running)
- [ ] **Step 6** — Launch via `Council Room.bat`, run a round with Codex
  - Check logs: no `shell_snapshot` error
- [ ] **Step 7** — Close Council Room
- [ ] **Step 8** — Launch via `council2.bat`, run a round with Codex
  - Check logs: no `shell_snapshot` error
  - Verify `CODEX_HOME` is `C:\AI\ai-switcher\auth\codex-acc2` (check Codex session dir)
- [ ] **Step 9** — Confirm Claude still responds in both launchers
- [ ] **Step 10** — Confirm auth files have unchanged `LastWriteTime`

---

## 5. Risks

| Risk | Description | Mitigation |
|---|---|---|
| New Codex error after fix | PowerShell error gone, another issue surfaces | Read new logs; do NOT add failover |
| `CODEX_HOME` not inherited | If env breaks in cmd chain | Check codex session dir after run; should be in `codex-acc2\sessions\` |
| cmd.exe argument escaping | `quoteForCmd` wraps args in `"..."` — check no special chars in paths | `server.js` already has `quoteForCmd()` handling this |

---

## 6. Acceptance Criteria

- [ ] `node --check server.js` — no output
- [ ] Codex responds via `Council Room.bat` — no `shell_snapshot` in logs
- [ ] Codex responds via `council2.bat` — no `shell_snapshot` in logs  
- [ ] `council2.bat` run: Codex session written to `C:\AI\ai-switcher\auth\codex-acc2\sessions\`
- [ ] Claude continues to respond correctly in both launchers
- [ ] `%USERPROFILE%\.codex\auth.json` — `LastWriteTime` unchanged
- [ ] `C:\AI\ai-switcher\auth\codex-acc2\auth.json` — `LastWriteTime` unchanged
- [ ] `council2.bat`, `council2.ps1` — not modified
- [ ] No failover logic added

---

## 7. Verification Commands

```powershell
# 1. Syntax check
node --check "C:\AI\Council Room\server.js"

# 2. Check auth files not touched
Get-Item "$env:USERPROFILE\.codex\auth.json" | Select-Object LastWriteTime
Get-Item "C:\AI\ai-switcher\auth\codex-acc2\auth.json" | Select-Object LastWriteTime

# 3. After running council2.bat — confirm second profile used
ls "C:\AI\ai-switcher\auth\codex-acc2\sessions\" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 3
```

---

*Phase 1 (gateway/failover) is a separate document: `TZ-phase-1-gateway-failover.md`.*  
*Phase 1 is BLOCKED until a Codex positive limit sample is obtained.*
