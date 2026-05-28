# Council Room v2 — Handoff (2026-05-28)

Документ для следующей сессии. Куда мы пришли, что проверено, что осталось.

## 1. Что это и почему v2

Council Room v1 (`C:\AI\Council Room`, порт 8787) — рабочий, но к 30+ раунду шлёт ~100 КБ промт каждому агенту (вся история + документы каждый раз заново). 86% сообщений в чате — служебные «process» события, которые засоряют ленту.

v2 (`C:\AI\Council Room v2`, порт 8788) — пересборка вокруг трёх объектов:
- **Subtask Stack** — изолированные подзадачи, в промт идёт только активная.
- **Knowledge Base** — секционный markdown, накапливает решения/запреты/etc, шлётся как снапшот вместо растущего транскрипта.
- **Trace drawer** — служебные сообщения отделены от основной ленты.

Размер промта в v2: **~1.7–2.5 КБ на раунд** (vs 100+ КБ в v1).

Решено в начале:
- v2 рядом со старым (старый не трогаем — там незавершённая работа в трёх чатах).
- KB — per-chat (`rooms/<id>/knowledge.md`).
- Handoff в фазе 4 — две кнопки: Spawn executor + Copy prompt.
- Стартовали с Phase 1: Subtask Stack + scoped prompt.

## 2. Что сделано в Phase 1 (CLOSED)

### Архитектура
| Файл | Назначение |
|---|---|
| `server.js` | HTTP API + SSE на 8788, ~500 строк |
| `lib/store.js` | id/json/jsonl IO |
| `lib/subtasks.js` | open / resolve / freeze / reopen / edit / delete |
| `lib/knowledge.js` | секционный KB с add/remove/snapshot, 7 секций |
| `lib/prompt.js` | scoped buildDebatePrompt + parseAgentTail + STATIC_SYSTEM + NO_SCAN_GUARD |
| `lib/cli.js` | runCodex / runClaude / runCommand, кроссплатформенно |
| `public/index.html` | 3-колоночный UI |
| `public/app.js` | i18n (RU/EN), tooltips, next-step coach, рендер |
| `public/styles.css` | стили |
| `Council Room v2.bat` | Windows launcher |
| `Council Room v2.command` | macOS launcher (chmod +x уже стоит) |
| `Council Room v2.sh` | Linux launcher |

### Фичи поверх Phase 1 (добавлены по запросам)
- **Bilingual UI**: переключатель RU/EN, ~80 ключей в обоих языках, состояние в localStorage. Переключатель в шапке центра.
- **Tooltips с примерами**: 41+ подсказок формата `текст|||пример`. Бейдж «Пример/Example» автоматом локализован. Max-width 420px, position clamps to viewport.
- **Next-step coach**: плавающее окно справа снизу с подсказкой что делать дальше (state machine: no chat → no subtask → 0 rounds → stale → resolve-ready → block → all done). Перетаскиваемое за шапку, позиция в localStorage, dbl-click сбрасывает.
- **Editable Subtask Stack**: подзадачи с `rounds === 0` редактируемы (✎) и удаляемы (×). Backend защита: после раунда — `Subtask already has rounds`.
- **Модалка с `?`**: длинный пояснительный текст убран из тела модалки и спрятан под `?` рядом с заголовком и полем «Постановка подзадачи». Поле — textarea с auto-grow.
- **Model dropdowns**: Codex — gpt-5.5 / gpt-5.4 / -mini / 5.3-codex. Claude — alias (opus/sonnet/haiku) + точные имена (claude-opus-4-7 и т.д.). Подсказка объясняет alias vs explicit.
- **Font scale buttons**: A− / A+ в шапке центра, диапазон 0.7–1.6, шаг 0.1, через CSS `zoom` (вся UI скейлится), localStorage.
- **Isolated mode (NO scan by default)** — критично:
  - В промте — жёсткий блок `=== ⚠️ ИЗОЛИРОВАННЫЙ РЕЖИМ (NO-FILESYSTEM-SCAN) ===` с инструкцией не сканировать/не угадывать структуру проекта.
  - Codex запускается с `--cd rooms/_sandbox` (пустая папка) вместо `--cd C:\AI`.
  - Claude — `--tools ""` + `cwd: rooms/_sandbox`.
  - Чекбокс «Разрешить агентам сканировать файлы» в Настройках — красная плашка, требует `confirm()` при включении.
  - По умолчанию OFF. Включается только когда явно нужно сравнение с реальным проектом.

### Кроссплатформенность
- `lib/cli.js`: cmd.exe-обёртка только для Windows (`process.platform === "win32"`). На macOS/Linux Codex запускается напрямую.
- Discovery: env (`CODEX_CMD`, `CODEX_JS`, `CLAUDE_CMD`) → local `node_modules/.bin` → системный npm prefix → fallback на PATH.
- Лаунчеры: `.bat`, `.command`, `.sh`. `.command` и `.sh` уже исполняемые (chmod +x).
- На macOS Gatekeeper может потребовать `xattr -d com.apple.quarantine "Council Room v2.command"` или открытие через Terminal.

## 3. Что проверено

| Что | Как проверено | Результат |
|---|---|---|
| Все JS-модули парсятся | `node --check` для всех файлов + `new Function(code)` для app.js | OK |
| Subtask lifecycle | E2E: open(A) → open(B) → A→pending; resolve(B) → active=null | OK |
| Subtask edit guard | Edit после `incrementRounds` → бросает `Subtask already has rounds, cannot edit` | OK |
| Subtask delete guard | Delete после round → бросает аналогично | OK |
| KB CRUD | add/dedup/remove/snapshot работают, файл `knowledge.md` создаётся правильно | OK |
| Agent tail parsing | New facts / risks / alternatives / Status / KB-patch — все парсятся | OK |
| HTTP API | curl-тесты: state, runs (create/switch/delete), subtasks (open/edit/delete/resolve), kb (add/remove), settings | OK |
| Static files served | `/index.html`, `/app.js`, `/styles.css` отдаются с правильным content-type | OK |
| SSE | EventSource подключается, `broadcast()` шлёт после каждого изменения state | OK (curl test) |
| Prompt size в изолированном режиме | ~2.5 KB вместо v1's 100+ KB | OK |
| NO_SCAN guard в промте | Включается по умолчанию, исчезает при `allowFilesystemScan: true` | OK |

**НЕ проверено** (намеренно — чтобы не палить подписки пользователя):
- Реальный раунд с Codex/Claude CLI. У пользователя один раз пошёл — агенты полезли в проект, что побудило добавить isolated mode. После добавления режима повторного запуска не было.

## 4. Что в Settings и где хранится

- `state.settings` (глобально, in-memory) — дефолты при создании чата
- `state.run.settings` (per-chat, в `rooms/<id>/state.json`)
- `localStorage` на клиенте:
  - `council-room-v2.uiLang` — язык UI
  - `council-room-v2.scale` — масштаб шрифта
  - `council-room-v2.coachPos` — позиция next-step окошка
- ai-switcher (`C:\AI\ai-switcher`) — рабочий, читать его `/status` будем в Phase 3. **Сейчас НЕ используется.**

## 5. Открытые вопросы / known issues

- **Codex sandbox**: `--sandbox read-only` не запрещает чтение всего диска — только мешает писать. Изоляция держится на (а) пустой cwd, (б) промт-блоке. Если агент явно нарушит — нужно ужесточать промт.
- **Tooltip ширина**: max-width 420px достаточна для текущих подсказок. Если будут длиннее — растягиваем.
- **Trace toggle ▾/▴**: завязан на `lastChild.textContent` — хрупко, но работает. При следующем рефакторе UI заменить на data-binding.
- **Старый Council Room v1** (порт 8787): не трогаем. Удалить можно только когда пользователь закончит свою задачу в одном из его чатов.

## 6. Что делать в следующей сессии — старт-чеклист

1. **Прочитать**: этот HANDOFF.md + `ROADMAP.md` + `MEMORY.md` (если запрошено).
2. **Спросить пользователя**: какую фазу запускаем (2 / 3 / 4) или есть точечные правки по Phase 1?
3. **Перед любой реализацией**: проверить что v2 запускается — `Council Room v2.bat` → http://localhost:8788 → состояние не сломано.
4. **Если идём в Phase 2** — открыть `ROADMAP.md` секцию Phase 2 и следовать.

## 7. Файлы, которые надо открыть для контекста

| Файл | Зачем |
|---|---|
| `HANDOFF.md` (этот) | сводка состояния |
| `ROADMAP.md` | планы Phase 2/3/4 |
| `lib/prompt.js` | как строятся промты, где NO_SCAN_GUARD |
| `lib/cli.js` | как запускаются агенты, isolated mode |
| `server.js` (раздел `runRound`) | основной цикл раунда |
| `public/app.js` (раздел `computeNextStep`) | state machine коуча |
| `..\Council Room\AGENT_WORKFLOW_PLAYBOOK.md` | первоисточник правил (Operation Modes, Implementation Gate, Subagent prompts) |

## 8. Принципы, которые держим (правила пользователя)

- **Изоляция по умолчанию** — агенты не читают проект без явного разрешения.
- **Экономия токенов** — scoped prompts, KB snapshot вместо транскрипта.
- **Не палить подписки на dry-run** — реальные раунды агентов запускает только пользователь.
- **Не трогать старый v1** до явного разрешения.
- **Перед опасными действиями** (delete, force push, drop) — confirm у пользователя.
- **Bilingual**: UI и подсказки — RU primary, EN secondary. Технические термины — в скобках (pending), (Status: resolve).

## 9. Git

v2 — отдельный репозиторий (`C:\AI\Council Room v2\.git`), независимый от внешнего `C:\AI\.git` и от v1 (`C:\AI\Council Room\.git`).

`rooms/` — gitignored (пользовательские данные). `rooms/.keep` оставлен в репозитории чтобы папка существовала.

`node_modules/` — gitignored.
