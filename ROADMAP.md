# Council Room v2 — Roadmap

Phase 1 закрыт 2026-05-28. Это план Phase 2/3/4. Перед каждой фазой — обсудить с пользователем, актуален ли план, или приоритеты сместились.

---

## Phase 2 — Autopilot loop + закреплённые терминалы + stop-condition

### Цель
Превратить ручной «Run round» в автопилот: Codex и Claude пинг-понгуют по активной подзадаче без участия пользователя, пока не сработает стоп-условие.

### Stop-conditions (любое = стоп)
- **DEBATE_COMPLETE**: оба агента подряд `Status: resolve` в одном раунде.
- **Stale × 2**: два последовательных раунда без новых facts/risks/alternatives.
- **Block**: любой агент `Status: block` → ждём пользователя.
- **Token gate**: <25% у любого агента (через ai-switcher или Codex/Claude usage cache).
- **Round budget**: достигнут лимит по `subtask.mode` (LIGHT=3, STANDARD=6, STRICT=10, CRITICAL=12).
- **User Stop**: явная кнопка остановки.

### Закреплённые терминалы (collapsible)
Под основной лентой — две панели (Codex output, Claude output) с live stdout. Когда autopilot включён — раскрываются. Свернуть/раскрыть кнопкой «раскрывашка».

Реализация:
- В `lib/cli.js` добавить `onStream(text)` callback — уже частично есть, не используется. Подключить.
- SSE-канал нового типа `stream` с `{ agent, runId, subtaskId, chunk }`.
- На клиенте — два `<pre class="terminal">` с auto-scroll.

### Файлы для правки
| Файл | Что |
|---|---|
| `server.js` | новый `runAutopilot(subtaskId)` цикл, эндпоинты `/api/autopilot/start` и `/stop`, поле `state.autopilot = { running, subtaskId, reason, startedAt }` |
| `lib/cli.js` | прокинуть `onStream` в runCodex/runClaude, использовать в server |
| `lib/prompt.js` | unchanged |
| `lib/subtasks.js` | добавить поле `autopilotHistory: [{ round, stop, reason }]` |
| `public/index.html` | две `<pre class="terminal">` под лентой, кнопка «Autopilot ▶ / ⏹», collapsible toggle |
| `public/app.js` | биндинг кнопок, SSE-обработчик `stream` события, рендер терминалов |
| `public/styles.css` | стили терминалов (моноширинный, dark, scrollable) |

### Acceptance criteria
- [ ] Кнопка «Autopilot ▶» доступна когда есть активная подзадача и не идёт раунд.
- [ ] Запуск → раунды идут друг за другом, лента наполняется, оба терминала стримят stdout.
- [ ] Любое из 6 стоп-условий завершает loop с сообщением «Autopilot stopped: [reason]».
- [ ] Кнопка «⏹ Stop» прерывает текущий раунд кооперативно (SIGTERM child).
- [ ] После стопа — состояние корректное (рaunds incremented, KB пополнена тем что успели).
- [ ] Терминалы collapsible, состояние свёрнутости в localStorage.

### Открытые вопросы Phase 2
- Когда autopilot ловит `block` — авто-открывать модалку для guidance, или просто показывать coach?
- Если оба агента дают `resolve` подряд — авто-закрывать подзадачу или ждать пользователя? Я бы _не_ авто-закрывал — закрытие требует summary.
- Терминалы: показывать stderr тоже? (Сейчас в логи пишется и то и другое.)

---

## Phase 3 — Multi-account tokens panel через ai-switcher

### Цель
Показать в UI Council Room v2 актуальное состояние всех аккаунтов Claude и Codex, с возможностью переключения. Использовать существующий ai-switcher API без дублирования логики.

### Источник истины
`C:\AI\ai-switcher` — HTTP gateway, уже работает. Эндпоинты (изученные в Phase 1):
- `GET /status` → `{ active: {claude, codex}, profiles: {claude:[{id,label,mode,apiKeySet}], codex:[...]} }`
- `POST /switch { service, profile, reason }` → переключение активного профиля
- `tokens.json` — usageEvents per profile (ts, exitCode, limitDetected)

Структура `profiles.json`:
- `claude.profiles`: acc1, acc2, apikey
- `codex.profiles`: acc1, acc2, apikey (+ failoverEnabled)

### Что показать в UI v2
Новая панель слева (под «Status»), либо отдельная aside-секция:
- Сервис (claude/codex) → список профилей
- Для каждого профиля:
  - метка (label), флаг «активный»
  - последний usage event (timestamp, exitCode)
  - индикатор: ok / limit-recent / auth-error (по последним 3 usageEvents)
  - remaining % если можно достать (только для активного — из CLI usage cache)
- Кнопка «Switch» на каждом неактивном профиле

### Файлы
| Файл | Что |
|---|---|
| `lib/aiswitcher.js` (новый) | HTTP клиент к ai-switcher: getStatus, switch, readTokens |
| `server.js` | подмешать `accounts: {...}` в `publicState()`, эндпоинт `/api/accounts/switch` |
| `public/index.html` | панель «Accounts» в левой колонке |
| `public/app.js` | renderAccounts, биндинг switch-кнопок |
| `public/styles.css` | стили статусных индикаторов |

### Acceptance criteria
- [ ] ai-switcher НЕ запущен → панель показывает «ai-switcher offline» с инструкцией поднять.
- [ ] Запущен → видны все профили обоих сервисов.
- [ ] Активный профиль явно выделен (зелёная точка / иконка).
- [ ] Last event: timestamp и exitCode для каждого.
- [ ] Switch button → POST в ai-switcher → панель обновляется.
- [ ] Если у активного `limit-detected` за последние 5 минут — красный значок и подсказка.

### Открытые вопросы Phase 3
- Хост/порт ai-switcher: вшит в код или конфиг? (Сейчас известно: HTTP на каком-то порту локально. Изучить в Phase 3.)
- Read-only от ai-switcher или Council Room v2 имеет право `/switch`? Думаю — да, имеет, по явному клику пользователя.
- Когда autopilot (Phase 2) ловит token-gate stop — автоматически предлагать switch или просто стопиться?

---

## Phase 4 — Implementation Gate + Handoff (Spawn / Copy prompt)

### Цель
Когда все подзадачи закрыты и KB собрана — сгенерировать self-contained промт для исполнителя по шаблону Playbook §9.5 (Subagent-Executor). Передать руками или автоматически открыть новый CLI-сеанс в проектной папке.

### Implementation Gate чек (по Playbook §1.5)
Кнопка «Open Implementation Gate» доступна когда:
- Нет открытых подзадач (status: open) — все resolved / frozen
- Нет open_questions с пометкой `[BLOCKING]` в KB
- KB не пустая (есть хотя бы decisions + control_contract + files_in_scope)
- Пользователь явно нажал «Open Gate»

Gate-экран: чек-лист зелёных галок («все critarian met»), плюс текст «User must explicitly type GO to proceed» — типизированное подтверждение по Playbook.

### Handoff
Две кнопки:
- **Copy prompt**: генерит executor-промт (KB + список открытых файлов + acceptance criteria из чеклиста + правила из STATIC_SYSTEM) → в буфер обмена.
- **Spawn executor**: пользователь выбирает Codex или Claude → открывает новый видимый терминал в `WORKDIR_TARGET` (предоставленная пользователем путь к реальному проекту) → пушит туда промт.

### Файлы
| Файл | Что |
|---|---|
| `lib/handoff.js` (новый) | генерация executor-промта из KB + subtasks |
| `lib/gate.js` (новый) | проверка condition (BLOCKING questions, KB completeness) |
| `server.js` | эндпоинты `/api/gate/check`, `/api/handoff/copy`, `/api/handoff/spawn` |
| `public/index.html` | панель «Implementation Gate» в правой колонке (появляется когда все subtasks resolved) |
| `public/app.js` | renderGate, биндинг Copy/Spawn |
| `public/styles.css` | стили gate-экрана |

### Spawn-механика
- Windows: `start "Executor" cmd /k "cd /d <projectDir> && claude"` или `... codex`
- macOS: `osascript -e 'tell app "Terminal" to do script "cd \"<projectDir>\" && claude"'`
- Linux: `gnome-terminal -- bash -c 'cd "<projectDir>" && claude; exec bash'`

После открытия терминала — записать промт в clipboard и сказать пользователю «вставь Ctrl+V в открытом терминале». Прямой stdin-стрим в чужой терминал — ненадёжно кроссплатформенно.

### Acceptance criteria
- [ ] Кнопка «Open Gate» появляется только когда условия выполнены.
- [ ] Gate-экран показывает зелёные/красные галки по каждому критерию.
- [ ] Без явного типа «GO» — Spawn/Copy недоступны.
- [ ] Copy кладёт корректно сформированный промт (Playbook §9.5 template) в clipboard.
- [ ] Spawn открывает реальный терминал на текущей ОС.
- [ ] Council Room v2 после handoff остаётся открыт — пользователь может в нём продолжать дебаты в новых подзадачах.

### Открытые вопросы Phase 4
- Куда именно spawn — в `WORKDIR` v2 (`C:\AI`) или в отдельный проект пользователя? Должно быть полем в UI с пресетами.
- Кто отвечает за `--sandbox` и `--permission-mode` исполнителя? Скорее всего — поле в gate-экране: «sandbox: read-only / workspace-write / danger», требует явного выбора.
- Должен ли v2 знать что executor сделал? Простейшее — нет, пользователь сам возвращается с отчётом. Сложнее — slurp stdout исполнителя в отдельную trace-ленту.

---

## Сводка приоритетов

| Phase | Стоимость работы | Польза | Зависимости |
|---|---|---|---|
| Phase 2 | средне-высокая (autopilot + терминалы + stop-condition × 6) | большая — основной workflow пользователя | нет |
| Phase 3 | низко-средняя (читать ai-switcher API, простая панель) | средняя — удобство, не блокер | ai-switcher должен быть запущен |
| Phase 4 | средняя (gate + handoff кроссплатформенно) | высокая — замыкает цикл «дебат → реализация» | желательно после Phase 2 (autopilot закроет больше подзадач быстрее) |

Рекомендуемый порядок: **2 → 4 → 3**.

Phase 3 можно делать параллельно или последним — это украшение, не блокер.

Phase 4 имеет смысл только после Phase 2: пока подзадачи закрываются медленно вручную, gate редко срабатывает.

---

## Правила, которые держим во всех фазах

1. **Изоляция по умолчанию**: новый функционал не должен случайно разрешать агентам читать проект пользователя. Проверять что NO_SCAN_GUARD сохраняется.
2. **Экономия токенов**: при любой новой логике — проверить размер промта до и после.
3. **Не палить подписки**: реальные раунды Codex/Claude запускает только пользователь, не я.
4. **Не трогать старый v1**.
5. **Bilingual**: каждая новая строка UI добавляется в обе локали.
6. **Подсказки с примерами**: каждый новый элемент UI получает `?` с подсказкой формата `текст|||пример`.
7. **Confirm перед опасными действиями**: spawn executor, switch account, mass delete.
