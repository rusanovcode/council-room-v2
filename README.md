# Council Room v2

Локальный «совет агентов»: **Codex** и **Claude** обсуждают задачу в параллельных раундах, а ты модерируешь. Переработка v1 вокруг трёх объектов, которые удерживают промт маленьким даже на 30+ раунде:

- **Subtask Stack** — изолированные подзадачи; в промт идёт только активная.
- **Knowledge Base** — секционный markdown (решения / запреты / риски / …), отправляется агентам как снапшот вместо растущего транскрипта.
- **Trace drawer** — служебные события («Служебные события») отделены от основной ленты, чтобы не засорять переписку.

Размер промта: **~1.7–2.5 КБ на раунд** (против 100+ КБ в v1).

> Веб-интерфейс и документация — на русском.

---

## Возможности

- **Раунды дебатов** — Codex и Claude отвечают параллельно по активной подзадаче (read-only, файлы не меняются).
- **Autopilot** — агенты пинг-понгуют сами, пока не сработает стоп-условие (debate-complete, stale×2, block, лимит токенов, бюджет раундов, ручной стоп).
- **Knowledge Base** на чат (`rooms/<id>/knowledge.md`).
- **Switch-module** (опционально, через [ai-switcher](#switch-module-опционально)) — мульти-аккаунт для агентов: переключение/failover между аккаунтами, мониторинг остатка токенов (кнопка ↻), панель подробной статистики (окна 5ч / недельные, расход, подписки).
- **i18n RU/EN**, масштаб шрифта, подсказки-коуч.

---

## Требования

- **Node.js** 18+ (без внешних npm-зависимостей — только стандартная библиотека).
- **Codex CLI** (`@openai/codex`) и **Claude Code CLI** (`@anthropic-ai/claude-code`), установленные и авторизованные. Сервер вызывает их как подпроцессы (`codex exec …`, `claude -p …`). Путь можно переопределить через `CODEX_CMD` / `CLAUDE_CMD`.

---

## Запуск

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

---

## Конфигурация (env)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `COUNCIL_ROOM_V2_PORT` | `8788` | Порт сервера |
| `COUNCIL_ROOM_V2_WORKDIR` | родитель папки проекта | Рабочая директория для «открытых» (не изолированных) запусков |
| `COUNCIL_ROOM_V2_TIMEOUT_MS` | `300000` | Таймаут вызова CLI-агента |
| `CODEX_CMD` / `CLAUDE_CMD` | автопоиск | Явный путь к бинарю агента |
| `COUNCIL_ROOM_V2_SWITCHER_ROOT` | `C:\AI\ai-switcher\auth` | Корень auth-папок switch-модуля |
| `AI_SWITCHER_HOST` / `GATEWAY_PORT` | `127.0.0.1` / `7700` | Адрес gateway switch-модуля |

---

## Switch-module (опционально)

Если рядом установлен **ai-switcher** (HTTP-gateway на `7700` + auth-папки), приложение подхватывает мульти-аккаунт: второй аккаунт, авто-failover и мониторинг токенов. Без него всё работает в обычном одно-аккаунтном режиме (acc2/API в интерфейсе скрыты). Источники данных по токенам подробно описаны в [`DATA_SOURCES.md`](DATA_SOURCES.md).

---

## Структура

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

---

## Документация

- [`HANDOFF.md`](HANDOFF.md) — что сделано/проверено, состояние по фазам.
- [`ROADMAP.md`](ROADMAP.md) — план Phase 2/3/4.
- [`DATA_SOURCES.md`](DATA_SOURCES.md) — откуда берутся токены/статистика, эндпоинты, switch-модуль.

---

## Лицензия

[MIT](LICENSE) © 2026 rusanovcode
