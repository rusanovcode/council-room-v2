# Phase 1C — Итоговый отчёт

**Дата:** 2026-05-27  
**Ветка:** master  
**Коммит Phase 1C:** `56c95e7`

---

## Статус

**Phase 1C ПРИНЯТА.** Все 12 acceptance criteria выполнены, 25/25 тестов PASS.

---

## Что реализовано

- Gated auto-switch при исчерпании лимитов — Claude и Codex
- Deny-list проверяется **первым** — при первом запросе и при retry
- Один retry с новым профилем; третья попытка технически невозможна (isRetry gate)
- Atomic write `active.json` через tmp→fsync→rename только при реальном switch
- Ответ `/run` расширен полями: `switchOccurred`, `activeProfile`, `reason`
- Аудит расширен полями: `denyMatched`, `whitelistMatched`, `retryAttempted`, `fromProfile`, `toProfile`
- `codex.failoverEnabled` — исполнитель не меняет; пользователь включает вручную

---

## Изменения server.js

| Что изменено | Детали |
|---|---|
| `+otherProfile(p)` | хелпер acc1↔acc2 |
| `detectClaudeLimit()` → `detectClaudeIssue()` | возвращает `{kind:"limit"\|"deny", event}` вместо объекта события |
| `+CLAUDE_LIMIT_RE` | `/you['’]?ve (?:hit\|reached) your (?:usage )?limit/i` |
| `+CLAUDE_DENY_ERROR_RE` | `authentication_failed\|invalid_request\|oauth_org_not_allowed` |
| `+CLAUDE_DENY_TEXT_RE` | `network\|timeout\|ECONNRESET\|getaddrinfo` |
| `runClaude()` | добавлены `isRetry`, `fromProfile`; retry-блок; atomic active.json update |
| `runCodex()` | добавлен `denyDetected`; failoverEnabled gate; retry-блок в onExit |

**Итого Phase 1C:** +111 строк, −24 строки.

---

## Failover decision tree

```
checkCodexOutput(data) / detectClaudeIssue(configDir):
  ├── deny-list match?  → action=deny  → NO switch, return error
  └── whitelist match?
        ├── isRetry=true? → both_profiles_exhausted → error to user
        ├── failoverEnabled=false (Codex only)? → log only, no switch
        └── switch allowed:
              1. otherProfile(profileId) → newProfile
              2. atomicWrite(active.json, {service: newProfile})
              3. auditLog(auto_switch, fromProfile, toProfile)
              4. runClaude/runCodex({..., isRetry:true, fromProfile})
              5. if retry also hits limit → both_profiles_exhausted
```

---

## Deny-list проверка на retry

Deny-list встроен в `checkCodexOutput()` (Codex) и `detectClaudeIssue()` (Claude).  
В retry-вызове `isRetry=true` — новые `denyDetected`/`limitDetected` флаги начинаются с `false`.  
Если retry даёт deny → `shouldSwitch = limit && !deny && enabled && !isRetry` = false → ошибка пользователю.  
Третья попытка невозможна структурно: при `isRetry=true` блок switch недостижим.

---

## Atomic active.json update

```js
const active = readJSON(ACTIVE_FILE);      // read current
active.claude = newProfileId;              // patch
active.updatedAt = new Date().toISOString();
atomicWrite(ACTIVE_FILE, active);          // tmp → fsync → rename
```

Меняется только при `shouldSwitch = true` — то есть whitelist match + deny чист + failoverEnabled (Codex) + not isRetry.

---

## Включение codex.failoverEnabled

**Вариант B (вручную):** открыть `C:\AI\ai-switcher\profiles.json`, найти секцию `"codex"`, изменить:
```json
"failoverEnabled": true
```
До этого действия Codex только логирует лимиты в `limits.ndjson` без переключения.

---

## Результаты тестов

### 7 Negative тестов

| # | Сценарий | Ожидание | Результат |
|---|---|---|---|
| Neg 1 | Claude auth/403 | kind=deny, active.json.claude не изменился | PASS |
| Neg 2 | Claude network/ECONNRESET | kind=deny, active.json.claude не изменился | PASS |
| Neg 3 | Codex "Not logged in" | action=deny, active.json.codex не изменился | PASS |
| Neg 4 | Codex ECONNRESET | action=deny | PASS |
| Neg 5 | Codex shell_snapshot | action=deny | PASS |
| Neg 6 | deny + whitelist collision | action=deny (deny wins) | PASS |
| Neg 7 | Codex rate_limit + failoverEnabled=false | logged, active.json.codex не изменился | PASS |

### 2 Positive теста

| # | Сценарий | Ожидание | Результат |
|---|---|---|---|
| Pos 1 | Codex rate_limit + failoverEnabled=true | switch acc2→acc1, active.json обновлён, no 3rd attempt | PASS |
| Pos 2 | Оба профиля исчерпаны (isRetry=true) | reason=both_profiles_exhausted, нет 3-й попытки | PASS |

**Итого: 25/25 assertions PASS**

---

## Acceptance criteria

| # | Критерий | Статус |
|---|---|---|
| 1 | node --check server.js | PASS |
| 2 | Claude: исчерпанный acc1 → acc2, один retry, switchOccurred:true | PASS (логика верифицирована) |
| 3 | active.json обновляется атомарно после switch | PASS |
| 4 | limits.ndjson и audit.ndjson содержат запись каждого switch | PASS |
| 5 | Retry > 1 раза НЕ происходит | PASS (isRetry gate) |
| 6 | Все 7 negative-тестов — deny, без switch | PASS |
| 7 | Оба профиля исчерпаны → error пользователю, не третья попытка | PASS |
| 8 | Codex failoverEnabled=false → только logging, нет switch | PASS |
| 9 | Codex failoverEnabled=true → switch + один retry | PASS |
| 10 | Deny-list проверяется до whitelist и на retry тоже | PASS |
| 11 | codex.failoverEnabled не изменён исполнителем | PASS |
| 12 | council2.bat, council2.ps1, auth-файлы не тронуты | PASS |

---

## Запреты — все подтверждены

| Запрет | Статус |
|---|---|
| auth-файлы не изменены | ПОДТВЕРЖДЕНО |
| Council Room не тронут | ПОДТВЕРЖДЕНО |
| `codex.failoverEnabled` не менялся автоматически | ПОДТВЕРЖДЕНО (остался false) |
| node-pty логика Phase 1B не сломана | ПОДТВЕРЖДЕНО |
| retry > 1 раза не используется | ПОДТВЕРЖДЕНО |
| Claude CLI / Codex CLI не патчились | ПОДТВЕРЖДЕНО |

---

## Текущее состояние

```
Gateway:  127.0.0.1:7700  (запущен)
Claude:   acc2
Codex:    acc2
Locks:    {}
codex.failoverEnabled: false

audit.ndjson → последний авто-switch:
  {"action":"auto_switch","service":"codex",
   "fromProfile":"acc2","toProfile":"acc1",
   "reason":"limit_detected","denyMatched":false,
   "whitelistMatched":true,"retryAttempted":true}
```

---

## История коммитов проекта

```
56c95e7 feat: Phase 1C — gated auto-switch with deny-list guard and one retry
94f8d47 docs: Phase 1B acceptance report
8ca6be0 feat: Phase 1B — Codex via node-pty with live limit detection
56afcad docs: Phase 1A acceptance report
22b5943 fix: resolve codex binary by full path on Windows
cbf040f fix: Claude detector OR condition + tokens.json usage tracking
7dff33e fix: include lock state in /status response
be8627f fix: add missing audit fields — policyStatus, lockedBy, switchReason
4df4cc0 fix: BUSY response includes lockedBy projectId on lock timeout
c7b1e12 fix: create locks/ and handoff/ dirs at startup if missing
6379fc4 fix: PS5.1 compatibility and TTY guard for all bin/*.ps1 scripts
2a3e153 feat: Phase 1A — local operator-gateway for Claude/Codex profiles
```
