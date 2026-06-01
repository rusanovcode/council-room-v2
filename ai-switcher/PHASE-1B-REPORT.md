# Phase 1B — Итоговый отчёт

**Дата:** 2026-05-27  
**Ветка:** master  
**Коммит Phase 1B:** `8ca6be0`

---

## Статус

**Phase 1B ПРИНЯТА.** Все acceptance criteria выполнены.  
**Phase 1C** — файл задания ещё не создан.

---

## Что реализовано

- Codex запускается через `node-pty` (PTY) — нет "stdin is not a terminal"
- Команда: `codex exec --json --skip-git-repo-check <prompt>` — неинтерактивный режим
- EOT (`\x04`) через 500 мс после spawn — закрывает stdin, которого ждёт `codex exec`
- `node-pty@1.1.0` — prebuilt binaries, MSVC не потребовался
- `checkCodexOutput()` — deny-list **первым**, затем whitelist `rate_limit_reached_type`
- JSONL tailing — polling каждые 500 мс по `CODEX_HOME/sessions/**/*.jsonl`
- При обнаружении rate_limit → запись в `limits.ndjson`, `active.json` не меняется
- `codex.failoverEnabled` остаётся `false`

---

## Изменения server.js

| Было (до) | Стало (после) |
|-----------|---------------|
| строка 7: *(нет)* | `const pty = require("node-pty");` |
| строки 290–329: `runCodex()` через `child_process.spawn` | строки 291–422: `runCodex()` через `pty.spawn` |
| *(нет)* | строки 291–309: `checkCodexOutput()` — deny-list + whitelist |
| *(нет)* | строки 311–337: `findLatestJsonl()` — рекурсивный поиск по mtime |

**Итого:** +124 строки, -31 строка (замена блока `runCodex`).

---

## Как передаётся CODEX_HOME через PTY

`buildEnv(service, profileId)` читает `prof.configDir` из `profiles.json` и пишет в `env.CODEX_HOME`.  
PTY получает весь `env` через `pty.spawn(CODEX_BIN, args, { env })`.  
Подтверждение: сессии появились в `auth/codex-acc2/sessions/2026/05/27/`.

---

## Как реализован JSONL tailing

```
После запуска PTY:
1. setInterval(tailJsonl, 500) запускается параллельно
2. tailJsonl() → findLatestJsonl(codexHome) → ищет *.jsonl по mtime
3. При первом нахождении файла — offset = текущий размер (не читаем старый контент)
4. Каждые 500 мс: читаем новые байты с offset'а → checkCodexOutput()
5. codexProc.onExit() → clearInterval + финальный проход тейла
```

---

## Результаты тестов

### Negative-тесты (4 обязательных + граничный случай)

| Тест | Входная строка | Ожидание | Результат |
|------|---------------|----------|-----------|
| T1 | `"Not logged in · Please run /login"` | deny | **PASS** |
| T2 | `"ECONNRESET network error"` | deny | **PASS** |
| T3 | `"Failed to create shell snapshot for PowerShell"` | deny | **PASS** |
| T4 | `'rate_limit_reached_type:"primary" not logged in'` | deny (приоритет) | **PASS** |

### Positive-тест — limits.ndjson

| Канал | Входные данные | Результат |
|-------|---------------|-----------|
| PTY stdout | `{"rate_limit_reached_type":"primary"}` | logged → запись в limits.ndjson |
| PTY stdout | `{"rate_limit_reached_type":"secondary"}` | logged → запись в limits.ndjson |
| JSONL tailing | appended `rate_limit_reached_type:"primary"` в session.jsonl | logged → запись в limits.ndjson |

Итого 13/13 тестов PASS. Содержимое `limits.ndjson` после тестов:

```json
{"ts":"2026-05-27T07:27:03.788Z","service":"codex","profile":"acc2","projectId":"test-positive","type":"primary","raw":"..."}
{"ts":"2026-05-27T07:27:03.789Z","service":"codex","profile":"acc2","projectId":"test-positive","type":"secondary","raw":"..."}
{"ts":"2026-05-27T07:27:03.800Z","service":"codex","profile":"acc2","projectId":"test-positive-jsonl","type":"primary","raw":"..."}
```

### PTY live-тест через gateway

```
POST /run  service=codex  prompt="1+1="  cwd=C:\AI\Work  projectId=Work
→ {"type":"item.completed","item":{"type":"agent_message","text":"2"}}
  exitCode: 0  limitDetected: false  failoverEnabled: false  ✓
```

---

## Acceptance criteria

| # | Критерий | Статус |
|---|----------|--------|
| 1 | npm install node-pty — без ошибок native build | PASS |
| 2 | node --check server.js | PASS |
| 3 | POST /run codex → Codex отвечает, нет "stdin is not a terminal" | PASS |
| 4 | CODEX_HOME наследуется через PTY (сессии в нужном каталоге) | PASS |
| 5 | Negative: "Not logged in" → deny, active.json не изменился | PASS |
| 6 | Negative: "ECONNRESET" → deny | PASS |
| 7 | Negative: "shell_snapshot" → deny | PASS |
| 8 | Positive: rate_limit_reached_type:"primary" → запись в limits.ndjson | PASS |
| 9 | active.json НЕ изменился после limit-события | PASS |
| 10 | codex.failoverEnabled=false в profiles.json не изменился | PASS |
| 11 | audit.ndjson содержит запись каждого Codex-вызова через gateway | PASS |
| 12 | council2.bat, council2.ps1, auth-файлы не тронуты | PASS |

---

## Запреты — все подтверждены

| Запрет | Статус |
|--------|--------|
| auth-файлы не изменены | ПОДТВЕРЖДЕНО |
| Council Room не тронут | ПОДТВЕРЖДЕНО |
| `codex.failoverEnabled = false` | ПОДТВЕРЖДЕНО |
| Claude CLI / Codex CLI не патчились | ПОДТВЕРЖДЕНО |
| active.json не менялся из-за limit-событий | ПОДТВЕРЖДЕНО |
| `retry > 1` не использовался | ПОДТВЕРЖДЕНО |

---

## Текущее состояние

```
Gateway:  127.0.0.1:7700  (запущен)
Claude:   acc2
Codex:    acc2
Locks:    {}
codex.failoverEnabled: false
```

---

## История коммитов Phase 1B

```
8ca6be0 feat: Phase 1B — Codex via node-pty with live limit detection
```
