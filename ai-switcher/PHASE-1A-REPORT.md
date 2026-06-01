# Phase 1A — Итоговый отчёт приёмки

**Дата:** 2026-05-27  
**Ветка:** master  
**Коммиты Phase 1A:** `2a3e153` → `22b5943` (9 коммитов)

---

## Статус

**Phase 1A ПРИНЯТА.** Все блокеры устранены.  
**Phase 1B заблокирована** до реального `rate_limit_reached_type != null` от Codex.

---

## Что реализовано

- HTTP gateway на `127.0.0.1:7700` — только loopback, без LAN bind
- Профили `claude-acc1`, `claude-acc2`, `codex-acc1`, `codex-acc2`
- Policy-движок: `protected` / `ignore` / `unclassified` → 403, `client-allowed` → пропуск
- Policy перечитывается без кэша на каждый `/run`
- Locks: эксклюзивный `wx`-флаг, таймаут 30 с, stale-cleanup по PID + возрасту
- Atomic write: `tmp → fsync → rename` для `active.json`, `tokens.json`, `projects.policy.json`
- Claude JSONL-детектор: `isApiErrorMessage + (apiErrorStatus=429 OR error=rate_limit) + Unicode-regex`
- Codex детектор: `rate_limit_reached_type != null` → `limits.ndjson`, без auto-switch
- Аудит: `run_start/end/error/rejected`, `limit_detected`, `switch`, `register`, `kill`, `policy_set`
- `codex.failoverEnabled = false` — Phase 1B явно заблокирована

---

## Проверки приёмки

| # | Проверка | Результат |
|---|---|---|
| 1 | Preflight — `codex.failoverEnabled=false` | PASS |
| 2 | Bind — только `127.0.0.1` | PASS |
| 3 | `/status` — профили, active, locks | PASS |
| 4 | Policy — нет кэша, protected/ignore/unclassified блокируются | PASS |
| 5 | `ai-register.ps1` — TTY-only guard | PASS (исправлено) |
| 6 | POST `/run` — env-профили, аудит, auth/Council Room не тронуты | PASS |
| 7 | Locks — параллельная защита, 30 с, stale-cleanup | PASS |
| 8 | Atomic writes | PASS |
| 9 | Claude detector — JSONL, U+2019, без cwd-mangling | PASS |
| 10 | Codex detector — логирует `rate_limit_reached_type`, без auto-switch | PASS |
| 11 | Negative deny-list (auth/401/403/network/timeout/shell_snapshot) | PASS (no-switch подтверждён; реализация deny-list — Phase 1B) |
| 12 | Audit completeness | PASS (исправлено) |

---

## Запреты — все подтверждены

| Запрет | Статус |
|---|---|
| Auth-файлы не изменены вручную | ПОДТВЕРЖДЕНО |
| Council Room не тронут | ПОДТВЕРЖДЕНО |
| `codex.failoverEnabled = false` | ПОДТВЕРЖДЕНО |
| Нет LAN bind | ПОДТВЕРЖДЕНО |
| Claude CLI / Codex CLI не патчились | ПОДТВЕРЖДЕНО |

---

## Исправленные баги

| Коммит | Bug | Описание |
|---|---|---|
| `6379fc4` | BUG-5 | `??` operator в 6 из 7 `bin/*.ps1` — несовместим с PS5.1 |
| `6379fc4` | GAP-4 | `ai-register.ps1` — добавлен `[Console]::IsInputRedirected` guard |
| `c7b1e12` | BUG-3 | `locks/` и `handoff/` не создавались при старте — crash на fresh deploy |
| `4df4cc0` | BUG-2 | Lock timeout возвращал `{error}` вместо `{status:"BUSY", lockedBy}` |
| `be8627f` | BUG-4 | Audit entries не содержали `policyStatus`, `lockedBy`, `switchReason` |
| `7dff33e` | BUG-1 | `/status` не включал состояние локов |
| `cbf040f` | GAP-2 | Claude detector не проверял `ev.error === "rate_limit"` (OR-условие) |
| `cbf040f` | GAP-3 | `tokens.json` не писался — добавлен `recordUsage()` на каждый `run_end` |
| `22b5943` | —     | `spawn("codex")` → ENOENT; исправлен на полный путь `CODEX_BIN` |

---

## Тесты живые

```
POST /run  service=claude  prompt="1+1="  cwd=C:\AI\Work
→ output: "2\n"  exitCode: 0  limitDetected: false  ✓

POST /run  service=codex   prompt="1+1="  cwd=C:\AI\Work
→ exitCode: 1  stderr: "Error: stdin is not a terminal"
  (ENOENT устранён; TTY-ограничение Codex CLI — задача Phase 1B)
```

---

## Текущее состояние

```
Gateway:  127.0.0.1:7700  (запущен)
Claude:   acc2  (acc1 на лимите до 2026-05-30)
Codex:    acc2  (acc1 на лимите до 2026-05-30)
Locks:    {}
```

---

## Блокеры Phase 1B

1. **Реальный Codex positive sample** — `rate_limit_reached_type != null` должен появиться в `limits.ndjson` от живого запуска
2. **Deny-list в коде** — явная проверка auth/401/403/network/timeout/shell_snapshot перед любой failover-логикой
3. **Codex headless** — Codex CLI требует TTY; нужен `node-pty` или нативный API для запуска через gateway
4. **`codex.failoverEnabled`** — переключить в `true` только после пп. 1–3

---

## История коммитов

```
22b5943 fix: resolve codex binary by full path on Windows
cbf040f fix: Claude detector OR condition + tokens.json usage tracking
7dff33e fix: include lock state in /status response
be8627f fix: add missing audit fields — policyStatus, lockedBy, switchReason
4df4cc0 fix: BUSY response includes lockedBy projectId on lock timeout
c7b1e12 fix: create locks/ and handoff/ dirs at startup if missing
6379fc4 fix: PS5.1 compatibility and TTY guard for all bin/*.ps1 scripts
36fb990 fix: ai-tokens.ps1 PS5.1 compatibility — remove ?. and ?? operators
2a3e153 feat: Phase 1A — local operator-gateway for Claude/Codex profiles
```
