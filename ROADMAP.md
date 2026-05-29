# Council Room v2 — Roadmap

Phase 1 закрыт 2026-05-28. Это план Phase 2/3/4. Перед каждой фазой — обсудить с пользователем, актуален ли план, или приоритеты сместились.

---

## Phase 2 — Autopilot loop + закреплённые терминалы + stop-condition (CLOSED 2026-05-28)

### Цель
Превратить ручной «Run round» в автопилот: Codex и Claude пинг-понгуют по активной подзадаче без участия пользователя, пока не сработает стоп-условие.

### Решения по открытым вопросам (согласованы с пользователем)
- **Token-gate (<25%)** — отложен до Phase 3 (нужен ai-switcher). Реализовано 5 из 6 стоп-условий.
- **На `block`** — стоп + существующий coach «Требуется твоё решение». Модалку не навязываем.
- **На DEBATE_COMPLETE** — стоп, подзадачу НЕ закрываем (закрытие требует summary). Добавлен опциональный чекбокс «Авто-закрытие» (default OFF): при включении автопилот сам резолвит подзадачу с локальным summary из KB (без доп. вызова агента).

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
- [x] Кнопка «Autopilot ▶» доступна когда есть активная подзадача и не идёт раунд. *(renderAutopilot disabled-логика)*
- [x] Запуск → раунды идут друг за другом, лента наполняется, оба терминала стримят stdout+stderr. *(код готов; живой прогон — за пользователем)*
- [x] Стоп-условие завершает loop с сообщением «Autopilot stopped: [reason]». Реализовано 5 из 6 (debate-complete, stale-x2, block, round-budget, user-stop); token-gate → Phase 3.
- [x] Кнопка «⏹ Stop» прерывает текущий раунд кооперативно (AbortController → SIGTERM child). *(живой прогон — за пользователем)*
- [x] После стопа — состояние корректное. Частичный (прерванный) раунд отбрасывается и НЕ инкрементит rounds; завершённые раунды пишут KB как обычно.
- [x] Терминалы collapsible, состояние свёрнутости в localStorage (`council-room-v2.terminalsCollapsed`).

### Реализация (факт)
- НИ одного нового файла — правки в `lib/cli.js`, `server.js`, `public/{index.html,app.js,styles.css}`.
- `lib/prompt.js` и `lib/subtasks.js` НЕ тронуты. `autopilotHistory` намеренно не добавлен — стоп-причины пишутся system-сообщениями в transcript/trace.
- Стрим агентов — отдельный именованный SSE-канал `event: stream` (state-канал безымянный, regression проверен).
- **НЕ проверено живьём** (намеренно — не палим подписки): реальный autopilot-прогон с Codex/Claude. Запускает пользователь.

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

## Phase 5 — Единая модель провайдеров: API-адаптер + профили + настраиваемые «спорщики»

### Цель
Один общий слой провайдеров, где «мультиаккаунт» — это просто несколько профилей на роль.
**Публичная сборка работает только на API-ключах и локальных моделях; никакого OAuth,
подписочных CLI и switch-модуля в публичной версии нет.**

### Единый дизайн (обсудили 2026-05-30)
Три уровня вместо двух параллельных систем (адаптер vs switch-модуль):

1. **Адаптеры провайдеров** — общий контракт `run(prompt, opts) → {ok, text}` (как
   `runCodex`/`runClaude` в `lib/cli.js`):
   - `openai-compatible` — по API-ключу (`/v1/chat/completions`): DeepSeek, OpenAI, Groq,
     OpenRouter, Mistral, Together и пр.;
   - `ollama` — локальные бесплатные модели (`http://localhost:11434`);
   - *(локально-приватно, НЕ в публичной сборке)* подписочные CLI как ещё один тип провайдера.
2. **Профили** — именованные `{provider, model, credentialRef}`. «Акк 1 / акк 2» = просто
   два профиля одного провайдера (для API — два ключа). Failover/ротация — общая логика:
   на лимите/ошибке берём следующий профиль той же роли (обобщение текущего switcher).
3. **Роли «спорщиков» A/B** — каждая указывает на профиль (или список профилей с failover).
   Сейчас раунд жёстко зашит на Codex+Claude (`runCodexOn`/`runClaudeOn` в `server.js`) — обобщить.

### Задачи
- Интерфейс провайдера + реализации `openai-compatible` и `ollama`.
- Профили (CRUD в настройках) + роли A/B со списком failover → заменить хардкод Codex/Claude.
- Хранение ключей — env / настройки, НЕ в репозитории.
- **Мониторинг токенов**: «остаток %» — это про подписку/OAuth (usage-cache/rollout). Для
  API-ключей остатка нет → показывать расход (spend) или прятать; панель статистики переосмыслить.
- **Публичная сборка без OAuth/switcher**: убрать из репозитория OAuth/подписочный путь
  (код `cli.js` spawnLogin + `codex`/`claude` вызовы, `switcher.js` oauth/usage) и все доки о нём;
  оставить только API-адаптер + Ollama. Подписочный путь — только в локальной/приватной версии.

### Ограничения
- «Бесплатно» = бесплатные тиры (всё равно нужен API-ключ) ИЛИ локальные модели; «скачать API» нельзя.
- Подписочные аккаунты (ChatGPT Plus, Copilot) через неофициальные API — нарушение ToS, не делаем.
- Copilot: официального chat-API для сторонних приложений нет — пропускаем.
- Ротация множества бесплатных ключей ради обхода лимитов — серая зона ToS; легитимно несколько своих ключей.

---

## Сводка приоритетов

| Phase | Стоимость работы | Польза | Зависимости |
|---|---|---|---|
| ~~Phase 2~~ | **CLOSED 2026-05-28** (token-gate перенесён в Phase 3) | большая — основной workflow пользователя | нет |
| Phase 3 | низко-средняя (читать ai-switcher API, простая панель) + token-gate stop-condition из Phase 2 | средняя — удобство, не блокер | ai-switcher должен быть запущен |
| Phase 4 | средняя (gate + handoff кроссплатформенно) | высокая — замыкает цикл «дебат → реализация» | желательно после Phase 2 (autopilot закроет больше подзадач быстрее) |

Рекомендуемый порядок: ~~2~~ → **4 → 3**. (Phase 2 закрыт.)

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
