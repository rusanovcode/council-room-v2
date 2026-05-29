# Council Room v2

**[English](#english) · [Русский](#русский)**

---

## English

A local "council of agents": **Codex** and **Claude** debate a task in parallel rounds while you moderate. A rebuild of v1 around three objects that keep the prompt small even at round 30+:

- **Subtask Stack** — isolated subtasks; only the active one goes into the prompt.
- **Knowledge Base** — sectioned markdown (decisions / prohibitions / risks / …), sent to the agents as a snapshot instead of an ever-growing transcript.
- **Trace drawer** — system events are kept out of the main feed so the conversation stays clean.

Prompt size: **~1.7–2.5 KB per round** (vs 100+ KB in v1).

> The UI is bilingual (RU/EN). The language toggle drives the agents' reply language; the prompt scaffolding sent to agents is always English.

### Features

- **Debate rounds** — Codex and Claude answer in parallel on the active subtask (read-only, no file changes).
- **Autopilot** — the agents ping-pong on their own until a stop condition fires (debate-complete, stale×2, block, token limit, round budget, manual stop).
- **Knowledge Base** per chat (`rooms/<id>/knowledge.md`).
- **Switch module** (optional, via [ai-switcher](#switch-module)) — multi-account for the agents: account switching/failover, remaining-token monitoring (↻ button), detailed-stats panel (5h / weekly windows, spend, subscriptions).
- **In-app updates** — the *Updates* button checks GitHub and fast-forwards the repo; chats and settings are preserved.
- **i18n RU/EN**, font scaling, coach hints.

### Requirements

- **Node.js** 18+ (no external npm dependencies — standard library only).
- **Codex CLI** (`@openai/codex`) and **Claude Code CLI** (`@anthropic-ai/claude-code`), installed and authorized. The server spawns them as subprocesses (`codex exec …`, `claude -p …`). Override the path with `CODEX_CMD` / `CLAUDE_CMD`.

### Run

```bash
git clone https://github.com/rusanovcode/council-room-v2.git
cd council-room-v2
node server.js          # or: npm start
```

Opens at **http://localhost:8788**.

First time? See **[SETUP.md](SETUP.md)** — install the agent CLIs and sign in with your own ChatGPT/Anthropic account (OAuth).

Launchers (free the port from an old instance and open the browser):

| OS | File |
|---|---|
| Windows | `Council Room v2.bat` |
| macOS | `Council Room v2.command` |
| Linux | `Council Room v2.sh` |

### Configuration (env)

| Variable | Default | Purpose |
|---|---|---|
| `COUNCIL_ROOM_V2_PORT` | `8788` | Server port |
| `COUNCIL_ROOM_V2_WORKDIR` | parent of the project dir | Working dir for "opened" (non-isolated) runs |
| `COUNCIL_ROOM_V2_TIMEOUT_MS` | `300000` | CLI-agent call timeout |
| `CODEX_CMD` / `CLAUDE_CMD` | auto-detect | Explicit path to the agent binary |
| `COUNCIL_ROOM_V2_SWITCHER_ROOT` | `C:\AI\ai-switcher\auth` | Root of the switch-module auth folders |
| `AI_SWITCHER_HOST` / `GATEWAY_PORT` | `127.0.0.1` / `7700` | Switch-module gateway address |

### Switch module

If **ai-switcher** is installed alongside (HTTP gateway on `7700` + auth folders), the app picks up multi-account support: a second account, auto-failover, and token monitoring. Without it everything runs in standard single-account mode (acc2/API hidden in the UI). Token data sources are documented in [`DATA_SOURCES.md`](DATA_SOURCES.md).

### Structure

```
server.js              HTTP API + SSE
lib/
  store.js             id / json / jsonl IO
  subtasks.js          open / resolve / freeze / reopen / edit / delete
  knowledge.js         sectioned KB (snapshot for the prompt)
  prompt.js            scoped buildDebatePrompt + parse + system-guard
  cli.js               runCodex / runClaude (cross-platform)
  switcher.js          switch-module client + token %
  stats.js             usage windows + spend for the stats panel
  questions.js         per-subtask open questions
public/                index.html · app.js (UI, i18n) · styles.css
rooms/                 chat data (gitignored)
```

Round data is stored locally in `rooms/<id>/` and never committed.

### Docs

- [`SETUP.md`](SETUP.md) — install the CLIs and sign in (OAuth), per user.
- [`HANDOFF.md`](HANDOFF.md) — what's done/verified, phase status.
- [`ROADMAP.md`](ROADMAP.md) — Phase 2/3/4 plan.
- [`DATA_SOURCES.md`](DATA_SOURCES.md) — where tokens/stats come from, endpoints, switch module.

### License

[MIT](LICENSE) © 2026 rusanovcode

---

## Русский

Локальный «совет агентов»: **Codex** и **Claude** обсуждают задачу в параллельных раундах, а ты модерируешь. Переработка v1 вокруг трёх объектов, которые удерживают промт маленьким даже на 30+ раунде:

- **Subtask Stack** — изолированные подзадачи; в промт идёт только активная.
- **Knowledge Base** — секционный markdown (решения / запреты / риски / …), отправляется агентам как снапшот вместо растущего транскрипта.
- **Trace drawer** — служебные события («Служебные события») отделены от основной ленты, чтобы не засорять переписку.

Размер промта: **~1.7–2.5 КБ на раунд** (против 100+ КБ в v1).

> Интерфейс двуязычный (RU/EN). Переключатель языка задаёт язык ответов агентов; служебный текст промта, отправляемый агентам, всегда английский.

### Возможности

- **Раунды дебатов** — Codex и Claude отвечают параллельно по активной подзадаче (read-only, файлы не меняются).
- **Autopilot** — агенты пинг-понгуют сами, пока не сработает стоп-условие (debate-complete, stale×2, block, лимит токенов, бюджет раундов, ручной стоп).
- **Knowledge Base** на чат (`rooms/<id>/knowledge.md`).
- **Switch-module** (опционально, через [ai-switcher](#switch-module)) — мульти-аккаунт для агентов: переключение/failover между аккаунтами, мониторинг остатка токенов (кнопка ↻), панель подробной статистики (окна 5ч / недельные, расход, подписки).
- **Обновления из приложения** — кнопка «Обновления» проверяет GitHub и обновляет репозиторий через fast-forward; чаты и настройки сохраняются.
- **i18n RU/EN**, масштаб шрифта, подсказки-коуч.

### Требования

- **Node.js** 18+ (без внешних npm-зависимостей — только стандартная библиотека).
- **Codex CLI** (`@openai/codex`) и **Claude Code CLI** (`@anthropic-ai/claude-code`), установленные и авторизованные. Сервер вызывает их как подпроцессы (`codex exec …`, `claude -p …`). Путь можно переопределить через `CODEX_CMD` / `CLAUDE_CMD`.

### Запуск

```bash
git clone https://github.com/rusanovcode/council-room-v2.git
cd council-room-v2
node server.js          # или: npm start
```

Откроется на **http://localhost:8788**.

Первый запуск? Смотри **[SETUP.md](SETUP.md)** — установка CLI-агентов и вход в свой аккаунт ChatGPT/Anthropic (OAuth).

Лаунчеры (освобождают порт от старого экземпляра и открывают браузер):

| ОС | Файл |
|---|---|
| Windows | `Council Room v2.bat` |
| macOS | `Council Room v2.command` |
| Linux | `Council Room v2.sh` |

### Конфигурация (env)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `COUNCIL_ROOM_V2_PORT` | `8788` | Порт сервера |
| `COUNCIL_ROOM_V2_WORKDIR` | родитель папки проекта | Рабочая директория для «открытых» (не изолированных) запусков |
| `COUNCIL_ROOM_V2_TIMEOUT_MS` | `300000` | Таймаут вызова CLI-агента |
| `CODEX_CMD` / `CLAUDE_CMD` | автопоиск | Явный путь к бинарю агента |
| `COUNCIL_ROOM_V2_SWITCHER_ROOT` | `C:\AI\ai-switcher\auth` | Корень auth-папок switch-модуля |
| `AI_SWITCHER_HOST` / `GATEWAY_PORT` | `127.0.0.1` / `7700` | Адрес gateway switch-модуля |

### Switch-module (опционально)

Если рядом установлен **ai-switcher** (HTTP-gateway на `7700` + auth-папки), приложение подхватывает мульти-аккаунт: второй аккаунт, авто-failover и мониторинг токенов. Без него всё работает в обычном одно-аккаунтном режиме (acc2/API в интерфейсе скрыты). Источники данных по токенам подробно описаны в [`DATA_SOURCES.md`](DATA_SOURCES.md).

### Структура

```
server.js              HTTP API + SSE
lib/
  store.js             id / json / jsonl IO
  subtasks.js          open / resolve / freeze / reopen / edit / delete
  knowledge.js         секционный KB (snapshot для промта)
  prompt.js            scoped buildDebatePrompt + parse + system-guard
  cli.js               runCodex / runClaude (кроссплатформенно)
  switcher.js          клиент switch-модуля + токен-%
  stats.js             окна usage + расход для панели статистики
  questions.js         открытые вопросы подзадачи
public/                index.html · app.js (UI, i18n) · styles.css
rooms/                 данные чатов (в .gitignore)
```

Данные раундов хранятся локально в `rooms/<id>/` (в репозиторий не попадают).

### Документация

- [`SETUP.md`](SETUP.md) — установка CLI и вход (OAuth), для каждого пользователя.
- [`HANDOFF.md`](HANDOFF.md) — что сделано/проверено, состояние по фазам.
- [`ROADMAP.md`](ROADMAP.md) — план Phase 2/3/4.
- [`DATA_SOURCES.md`](DATA_SOURCES.md) — откуда берутся токены/статистика, эндпоинты, switch-модуль.

### Лицензия

[MIT](LICENSE) © 2026 rusanovcode
