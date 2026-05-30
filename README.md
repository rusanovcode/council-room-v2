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
- **API-key backends** — register any OpenAI-compatible provider (OpenAI, Anthropic, Ollama, etc.) in the Backends panel alongside CLI agents.
- **In-app updates** — the *Updates* button checks GitHub and fast-forwards the repo; chats and settings are preserved.
- **i18n RU/EN**, font scaling, coach hints.

### Requirements

- **Node.js** 18+ (no external npm dependencies — standard library only).
- **Codex CLI** (`@openai/codex`) and/or **Claude Code CLI** (`@anthropic-ai/claude-code`), installed and authorized. The server spawns them as subprocesses (`codex exec …`, `claude -p …`). Override the path with `CODEX_CMD` / `CLAUDE_CMD`.
- Alternatively, register API-key backends in the *Backends* panel (no CLI required).

### Run

```bash
git clone https://github.com/rusanovcode/council-room-v2.git
cd council-room-v2
node server.js          # or: npm start
```

Opens at **http://localhost:8788**.

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

### Structure

```
server.js              HTTP API + SSE
lib/
  store.js             id / json / jsonl IO
  subtasks.js          open / resolve / freeze / reopen / edit / delete
  knowledge.js         sectioned KB (snapshot for the prompt)
  prompt.js            scoped buildDebatePrompt + parse + system-guard
  cli.js               runCodex / runClaude (cross-platform)
  profiles.js          participant schema + effectiveConfig
  providers.js         API-key backends + Ollama
  questions.js         per-subtask open questions
public/                index.html · app.js (UI, i18n) · styles.css
rooms/                 chat data (gitignored)
```

Round data is stored locally in `rooms/<id>/` and never committed.

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
- **API-key бэкенды** — зарегистрируй любого OpenAI-совместимого провайдера (OpenAI, Anthropic, Ollama и др.) в панели «Регистрация агентов».
- **Обновления из приложения** — кнопка «Обновления» проверяет GitHub и обновляет репозиторий через fast-forward; чаты и настройки сохраняются.
- **i18n RU/EN**, масштаб шрифта, подсказки-коуч.

### Требования

- **Node.js** 18+ (без внешних npm-зависимостей — только стандартная библиотека).
- **Codex CLI** (`@openai/codex`) и/или **Claude Code CLI** (`@anthropic-ai/claude-code`), установленные и авторизованные. Сервер вызывает их как подпроцессы (`codex exec …`, `claude -p …`). Путь можно переопределить через `CODEX_CMD` / `CLAUDE_CMD`.
- Либо зарегистрируй API-key бэкенды в панели «Регистрация агентов» (CLI не нужен).

### Запуск

```bash
git clone https://github.com/rusanovcode/council-room-v2.git
cd council-room-v2
node server.js          # или: npm start
```

Откроется на **http://localhost:8788**.

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

### Структура

```
server.js              HTTP API + SSE
lib/
  store.js             id / json / jsonl IO
  subtasks.js          open / resolve / freeze / reopen / edit / delete
  knowledge.js         секционный KB (snapshot для промта)
  prompt.js            scoped buildDebatePrompt + parse + system-guard
  cli.js               runCodex / runClaude (кроссплатформенно)
  profiles.js          схема участника + effectiveConfig
  providers.js         API-key бэкенды + Ollama
  questions.js         открытые вопросы подзадачи
public/                index.html · app.js (UI, i18n) · styles.css
rooms/                 данные чатов (в .gitignore)
```

Данные раундов хранятся локально в `rooms/<id>/` (в репозиторий не попадают).

### Лицензия

[MIT](LICENSE) © 2026 rusanovcode
