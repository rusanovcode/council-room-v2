# Council Room v2 — Data Sources & File Map

Справочник: **откуда что берётся** и **где что лежит**. Читать в начале сессии вместе с
`HANDOFF.md`. Обновлять при изменении источников.

Порт: **8788** (`COUNCIL_ROOM_V2_PORT`). Запуск: `Council Room v2.bat` (сам убивает старый
процесс на порту перед стартом). Workdir агентов: `C:\AI` (`COUNCIL_ROOM_V2_WORKDIR`).

---

## 1. Структура проекта

```
Council Room v2/
├── server.js                 HTTP API + SSE; runRound/runAutopilot; switcher-кэш; раздача статики
├── lib/
│   ├── store.js              id/json/jsonl IO (readJson, appendJsonl, makeRunId…)
│   ├── subtasks.js           подзадачи: open/resolve/freeze/edit/delete, bin (archive/trash), incrementRounds
│   ├── knowledge.js          KB (7 секций markdown), near-dup дедуп, snapshotForPrompt (open_questions исключён)
│   ├── questions.js          per-subtask вопросы (questions.jsonl): ID, priority, resolvedBy, verify, near-dup
│   ├── prompt.js             buildDebatePrompt, parseAgentTail, STATIC_SYSTEM, NO_SCAN_GUARD, STRICT_SCOPE_RULE
│   ├── cli.js                runCodex/runClaude (spawn, AbortSignal, killTree, accountEnv), spawnLogin
│   ├── switcher.js           модуль свитч: gateway-клиент (7700) + файловый фолбэк; envForAccount; claudePaths
│   └── stats.js              окна usage-cache + расход из session-JSONL (для раскрывашки)
├── public/                   index.html, app.js (i18n RU/EN, render*, coach), styles.css
├── Council Room v2.bat/.command/.sh   лаунчеры (освобождают порт перед стартом)
├── HANDOFF.md  ROADMAP.md  DATA_SOURCES.md (этот)
└── rooms/<runId>/            данные чата (gitignored)
```

### rooms/<runId>/ — данные одного чата
| Файл | Что |
|---|---|
| `state.json` | run: id, topic, createdAt, rounds, **archived**, settings (копия глобальных на момент) |
| `transcript.jsonl` | все сообщения (role/kind/text/subtaskId/round); `kind:process`/`subtask-*` → trace-лента |
| `subtasks.jsonl` | подзадачи: status(open/pending/resolved/frozen), mode, rounds, **bin** ("" / archive / trash) |
| `questions.jsonl` | вопросы: id(Q1…), subtaskId, text, status(open/resolved/verified), **priority**(critical/minor), resolvedBy{codex,claude}, answer |
| `knowledge.md` | KB-секции: decisions, prohibitions, control_contract, files_in_scope, files_out_of_scope, verification_commands, open_questions(legacy→мигрирует в questions.jsonl) |
| `R{n}-{subtaskId}-{codex,claude}.log/.txt` | сырые логи раунда |

---

## 2. Модуль свитч (мультиаккаунт) — `lib/switcher.js`

**Это ai-switcher (`C:\AI\ai-switcher`).** Источник истины — его **HTTP-gateway**, фолбэк — файлы.

### Gateway (первичный источник)
- URL: `http://127.0.0.1:7700/status` (`GATEWAY_PORT`, `AI_SWITCHER_HOST`). Поднимается отдельно (трей/демон ai-switcher).
- `/status` отдаёт: `active{claude,codex}` (активный профиль), `profiles{claude:[{id,label,mode,apiKeySet}],codex:[…]}` — профили **acc1 / acc2 / apikey**, `codexFailoverEnabled`.
- Другие эндпоинты gateway: `/run`, `/switch {service,profile}`, `/register`, `/policy`, `/api-key`, `/kill`. **Токенов/usage НЕ отдаёт.**
- Council Room поллит `/status` раз в 15с → кэш `switcherStatus` (server.js), отдаётся в `publicState().switcher`.

### Файловый фолбэк (если gateway не отвечает)
- «Подключён» = есть auth-папки acc2. Аккаунт 2 выбирается переменными окружения:
  - Claude acc2: `CLAUDE_CONFIG_DIR` + `CLAUDE_USAGE_CACHE` = `C:\AI\ai-switcher\auth\claude-acc2`
  - Codex acc2: `CODEX_HOME` = `C:\AI\ai-switcher\auth\codex-acc2`
  - acc1 = переменные НЕ заданы → дефолт (`%USERPROFILE%\.claude`, `%USERPROFILE%\.codex`)
- `envForAccount(tool, account)` возвращает эти overrides; `cli.runCodex/runClaude` прокидывают их в дочерний процесс.
- Авторизация по кнопке: `cli.spawnLogin` открывает терминал в env аккаунта и запускает `codex login` / `claude /login`.

---

## 3. Токены и статистика — `lib/stats.js`, `.usage-cache.json`, session-JSONL

| Что | Источник | Есть для |
|---|---|---|
| **Остаток % (цвет кнопки)** | `<configDir>/.usage-cache.json` → `five_hour.utilization`, `seven_day.utilization`; остаток = `100 − max(util)` | **только Claude** |
| **Часовой/недельный сброс** | то же, поле `resets_at`; начало окна = `resets_at − 5ч/7д` | только Claude |
| **Расход** (input/output/cache/запросы) | `<configDir>/projects/**/*.jsonl`, поле `message.usage` (input_tokens, output_tokens, cache_*); период по `timestamp` | только Claude (у Codex формат session-логов другой) |
| **Стоимость $** | в сыром JSONL **нет** (CodeBurn считает по прайсингу моделей) — показываем 0/опускаем | — |
| **Даты подписки** | **источника нет нигде** → ручной ввод, хранится в `settings.subscriptions["claude:acc1"]={start,end}` | ручками |
| **Codex остаток %/окна** | **нет файлового источника.** `ai-switcher/tokens.json` логирует лишь `usageEvents{ts,exitCode,limitDetected}` (грубо). Реальные цифры — через OAuth API (см. §5, отложено) | — |

`configDir`: acc1 = `%USERPROFILE%\.claude`, acc2 = `C:\AI\ai-switcher\auth\claude-acc2` (`switcher.claudePaths()`).
Раскрывашка тянет `GET /api/switcher/stats?period=today|week|all` (кэш 60с). Кнопка ↻ refresh шлёт мини-запрос «What is 1+3?» по каждому Claude-аккаунту → наполняет `.usage-cache.json`.

---

## 4. Council Room v2 — HTTP API (server.js)

- `GET /api/state`, `GET /api/events` (SSE: безымянное `data:` = state; именованное `event: stream` = live-stdout агентов в терминалы)
- runs: `/api/runs` (create), `/api/runs/switch|delete|archive|restore`
- subtasks: `/api/subtasks/open|resolve|freeze|edit|delete|reopen|trash|archive|restore`, `/api/subtasks/trash/empty`
- questions: `/api/questions/add|remove|priority`
- kb: `/api/kb/add|remove`
- round/autopilot: `/api/round`, `/api/autopilot/start|stop`
- switcher: `/api/switcher/login|refresh|stats|subscription`
- `/api/settings`
- Статика: `?v=__V__` → подставляется `BUILD_ID` (время старта сервера) → кэш всегда свежий; `Cache-Control: no-store`.

Состояние/настройки: `state.settings` (глобально) и `state.run.settings` (per-chat в state.json).
localStorage клиента: `uiLang`, `scale`, `coachPos`, `terminalsCollapsed`.

---

## 5. Внешние инструменты (C:\AI) и отложенное

- **CodeBurn** (`C:\AI\codeburn`, `codeburn-pr`) — отдельное Electron-трей-приложение (вкладки History/Yield/Dashboard/Optimize/Plan). Читает session-JSONL + зовёт **OAuth-usage API**:
  - Claude: `~/.claude/.credentials.json` → `https://api.anthropic.com/api/oauth/usage`
  - Codex: `~/.codex/auth.json` → `https://chatgpt.com/backend-api/wham/usage`
  - Наружу данные НЕ отдаёт (внутренний Electron IPC) → переиспользовать нельзя, только повторить логику.
- `C:\AI\jq.exe` — обработка JSON для статистики.
- `C:\AI\service_limit_table*.md` — карта источников от CodeBurn (env/auth-пути/regex лимитов).
- `C:\AI\claude2.bat`, `codex2.bat` — запуск CLI на 2-м аккаунте (env-обёртки).

### ОТЛОЖЕНО (следующий этап) — Codex-цифры и авто-подписка через OAuth-usage API
Чтобы получить **Codex остаток %** и **реальные даты подписки** обоих сервисов: повторить путь
CodeBurn — читать токен из `auth.json`/`.credentials.json` и звать `wham/usage` (Codex) и
`oauth/usage` (Claude). Тяжелее (внешние HTTPS + секретные токены) → вынесено отдельно.
