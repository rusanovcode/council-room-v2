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
`<repo>/ai-switcher` — HTTP gateway, уже работает. Эндпоинты (изученные в Phase 1):
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

### Решения по дизайну (согласованы 2026-05-30)
- **Разделение public/local — флаг сборки в одном репо.** `PROVIDERS_MODE=full|api`
  (env, default `full`). `full` — текущая приватная сборка (CLI Codex/Claude + switcher +
  OAuth). `api` — публичная (только API-ключи + Ollama). Ничего физически не удаляем,
  локальная версия продолжает работать. (Отвергли отдельную ветку и физическое удаление.)
- **Старт фазы — слой провайдеров (адаптеры).** Сначала фундамент `runProfile`, потом
  профили/роли поверх него. CLI Codex/Claude обернём как ещё один тип провайдера (full).
- **Ключи — env + `.env` (gitignored).** Профиль хранит `credentialRef` (имя env-переменной),
  сам ключ — в `.env`/окружении, НЕ в репозитории и НЕ в `state.json`.

### Прогресс
- **[DONE 2026-05-30] Слой провайдеров.** `lib/providers.js` — контракт
  `runProfile(profile, prompt, opts) → {ok, text, aborted, result}` (сигнатура как у
  `runCodex`/`runClaude`); реализации `openai-compatible` (стрим+нестрим, abort vs timeout,
  ошибки) и `ollama`; пресеты openai/deepseek/groq/openrouter/mistral/together/ollama;
  `credentialRef`→`process.env`. `lib/env.js` — zero-dep загрузчик `.env` (не перетирает
  реальное окружение), подключён в `server.js` до прочих require. `.env.example`, `.env` в
  `.gitignore`, `PROVIDERS_MODE` (default `full`). Тест `test/providers.test.js` (мок-сервер
  `/v1/chat/completions`: нестрим, стрим, отсутствие ключа, keyless-ollama, user-abort,
  timeout, пресеты) — всё зелёное. Сервер чисто стартует с загрузчиком (regression OK).
  **Ещё НЕ сделано (на момент step 1):** профили (CRUD/UI), роли A/B, интеграция в `runRound`.
- **[DONE 2026-05-30] Профили + роли (модель + раннер + проводка + UI).**
  - **2a** `lib/profiles.js` — схема профиль/роль. Два фиксированных слота с историческими
    ключами `codex` (роль A) / `claude` (роль B) → `questions.js`/KB-атрибуция/терминалы НЕ
    трогаются; настраиваются подпись и цепочка профилей слота. `effectiveConfig` резолвит явные
    (`settings.profiles`+`settings.roles`) ИЛИ legacy-поля в одну форму → старые чаты работают.
    Мультиаккаунт acc1/acc2 обобщён в цепочку с failover; `legacyChain` воспроизводит текущий
    выбор аккаунта + одношаговый auto-failover. CRUD+валидация. `lib/roles.js` — `runProfile`
    (диспетчер CLI/сеть; CLI заблокирован в `api`) + `runRole` (цепочка: auto=failover,
    manual=первый; не фейловерит на user-abort; verify-override только по запросу вызывающего).
  - **2b** `runRound` больше не хардкодит Codex/Claude: резолвит два слота через
    `profiles.effectiveConfig` и гоняет каждый через `roles.runRole` (failover внутри цепочки,
    `onFailover` логирует и чистит терминал). `VERIFY_AGENTS` — единый источник в `lib/profiles`.
    Trace «Round backends». Валидация профилей в `/api/settings`; `providers:{mode,presets,types,
    credentials}` в `publicState`.
  - **2c** UI «Профили и роли» (`public/`): сворачиваемая `<details>`-панель в Настройках —
    CRUD профилей (провайдер из пресетов/типов, модель, для CLI аккаунт, для сети baseUrl+
    credentialRef+статус ключа) и редакторы ролей A/B (подпись, режим, цепочка чекбоксами).
    Gating по режиму: в `full` старые Codex/Claude-контролы первичны + панель дополнительна; в
    `api` старые CLI-контролы скрыты. Bilingual RU/EN + tooltips. Правка в локальном draft (SSE
    не затирает), Apply → `/api/settings`; пустой набор → сброс к legacy. Бейдж режима full/api.
  - **Проверено:** `test/round.integration.test.js` — реальный `runRound` в `PROVIDERS_MODE=api`
    гоняет оба слота через мок-бэкенд по HTTP (без подписок/CLI); `test/roles.test.js` — деривация/
    failover/verify/CRUD; boot-смоук full-режима (панель отдаётся, `/api/state.providers` корректен).
  - **Ещё НЕ сделано:** CLI-as-provider живьём не прогонялся (только мок); живой прогон реального
    API-провайдера/Ollama — за пользователем.
- **[DONE 2026-05-30] Панель токенов под API-ключи (step 3).** У API-ключей нет «остатка %» →
  показываем фактический расход. `lib/providers` перестал выбрасывать `usage` из ответа
  (`prompt_tokens`/`completion_tokens`; стрим — `stream_options.include_usage`), `normalizeUsage`
  → `result.usage`. `lib/usage.js` — кумулятивный per-profile store в `rooms/.provider-usage.json`
  (gitignored): `record`/`summary`/`reset`. `runRound` пишет расход по сетевым профилям (CLI/OAuth
  usage не шлют → не считаются), бампит `statsVersion`. `/api/switcher/stats` отдаёт `providers`
  (свежим, вне кэша); `POST /api/providers/usage/reset`. UI: во вкладке «Расход» строки API-профилей
  (вход/выход/всего/запросов + кнопка «Сбросить расход»), во «Лимитах» — пометка «у API-ключа нет
  окон-лимитов». Bilingual + стиль. Тест: usage-парсинг (нестрим+стрим) и round-trip store в
  `test/providers.test.js` — зелёные; boot-смоук `PROVIDERS_MODE=api` (stats.providers, reset) OK.

### Задачи
- ~~Интерфейс провайдера + реализации `openai-compatible` и `ollama`.~~ **DONE** (см. Прогресс).
- ~~Профили (CRUD в настройках) + роли A/B со списком failover → заменить хардкод Codex/Claude.~~ **DONE**.
- ~~Хранение ключей — env / настройки, НЕ в репозитории.~~ **DONE** (`credentialRef`+`.env`).
- ~~**Мониторинг токенов**: «остаток %» — это про подписку/OAuth (usage-cache/rollout). Для
  API-ключей остатка нет → показывать расход (spend) или прятать; панель статистики переосмыслить.~~
  **DONE** (step 3): расход токенов из `usage` ответа → `lib/usage.js` → вкладки «Расход»/«Лимиты».
- **Публичная сборка без OAuth/switcher**: убрать из репозитория OAuth/подписочный путь
  (код `cli.js` spawnLogin + `codex`/`claude` вызовы, `switcher.js` oauth/usage) и все доки о нём;
  оставить только API-адаптер + Ollama. Подписочный путь — только в локальной/приватной версии.

### Ограничения
- «Бесплатно» = бесплатные тиры (всё равно нужен API-ключ) ИЛИ локальные модели; «скачать API» нельзя.
- Подписочные аккаунты (ChatGPT Plus, Copilot) через неофициальные API — нарушение ToS, не делаем.
- Copilot: официального chat-API для сторонних приложений нет — пропускаем.
- Ротация множества бесплатных ключей ради обхода лимитов — серая зона ToS; легитимно несколько своих ключей.

---

## Phase 6 — Пересборка стадии выбора агентов (2–5 спорщиков)

Раньше дебат жёстко на двух слотах (`codex`/`claude`). Цель: пользователь выбирает **2–5 агентов** на чат, авто- или вручную, через навигатор; реестр зарегистрированных агентов отделён от выбора для чата.

**Решения (зафиксированы с пользователем):** участников **2–5**; промты **НЕ сжимать** (каждый агент видит полный контекст всех остальных) — рост стоимости гасится только **эскалирующим предупреждением о токенах**; авто-выбор по умолчанию = 2 разных дешёвых; параметр «скорость» — убрать (нет такой ручки у CLI/API, реальные ручки = модель + усилие); реестр («Регистрация агентов») и выбор для чата (чипы) — **разные сущности**.

### Phase 6a — ядро (CLOSED 2026-05-30)
Генерализация двух слотов → массив участников. Слот-ключ стал произвольной строкой: legacy `codex`/`claude`, новые `a1..a5`. Миграции данных нет. Подробности — `HANDOFF.md §2e`.
- [x] `profiles.js`: `settings.participants[2..5]`, `effectiveConfig→participants[]`, приоритет participants→roles{a,b}→legacy, `roles{a,b}`=первые 2 (back-compat), `validateParticipants`/`setParticipants`, `MIN/MAX_PARTICIPANTS`.
- [x] `questions.js`: `resolvedBy` по ключам участников; закрытие когда **все** отметили (`requiredKeys`); `reopen`→`{}`.
- [x] `prompt.js`: `otherAgentNames[]`, «2 to 5 AI agents»; промты не сжимаются.
- [x] `server.js runRound`: цикл `Promise.all(participants.map)`; полные промты со всеми оппонентами; терминалы/стрим по ключу (+label); стоп-условия — все resolve / любой block / все stale; verify per-participant; валидация `body.participants`.
- [x] Клиент: динамические терминалы по ключам (`#terminalsBody`, `ensureTermPane`).
- [x] Тесты: участники (2/3/5), questions N-ключей, integration реальный `runRound` на 3 агента через мок; boot-смоук `full`. Все зелёные.

### Phase 6b — UX выбора (CLOSED 2026-05-30)
Чип-участник несёт inline-backend (развязан с реестром `settings.profiles`). Детали — `HANDOFF.md §2f`.
- [x] Кнопка «Добавить агента» (2 строки) в шапке центра слева от Закрыть/Заморозить/Лог; подсветка навигатором.
- [x] Выбор авто/ручной (модалка); авто — 2 разных доступных дешёвых бэкенда; добавление до 5.
- [x] Чипы участников; клик → новая панель-редактор сверху правого столбца (агент + модель + усилие, **без «скорости»**); дефолт слабая модель+усилие `low`, подсвечены (`.hl-default`).
- [x] Навигатор: шаги `coach.agents`→`coach.agentsConfig`; `▶ Запустить раунд` и Autopilot заблокированы на свежем чате при <2 (legacy с историей не блокируются).
- [x] **Эскалирующее предупреждение о токенах** (`tokenWarn2..5`: 2 норм … 5 «очень дорого»).
- [x] **Тумблер «Файлы вне scope» (`strictScope`) включён по умолчанию** (`settings.strictScope=true`).
- [x] **Навигатор-подсветка**: каждый шаг подсвечивает целевые контролы (`.nav-highlight`), авто-сброс при выполнении (нет чата→`newRun`+`runList`; нет подзадачи→`openSubtask`; <2 агентов→`addAgent`; агенты→чипы+документы+галочки+запуск).
- [x] **Чистый лист на новом чате**: `defaultRun` не наследует `participants`; `applyRunSettings` зеркалит выбор активного чата (был баг наследования).
- [x] **Документы** (`lib/documents.js`): per-chat приложенные тексты → секция ATTACHED DOCUMENTS в промте (кэп ~12K, легитимный источник в изоляции); панель UI (файл/вставка), `/api/documents/add|remove`.
- [x] bilingual + tooltips на все новые элементы.
- [x] Проверки: тесты зелёные (+inline-backend юнит-кейс), boot-смоук full (валидация/persist), реальный раунд на 3 inline-бэкендах через мок, смоук документов (документ доходит до промта). Визуальная проверка в браузере — за пользователем.

### Phase 6c — реестр (CLOSED 2026-05-30, commits e194456..3989727)

**Решение пользователя:** отдельный столбик иконок не делаем — зарегистрированные агенты отображаются чипами справа от модуль свитчера в 2-строчной сетке.

- [x] Мёртвые i18n-строки роль-редактора удалены (`ui.roleMode`, `ui.roleChain`, `ui.apiModeNote`, `ui.chainEmpty`, `tip.roleChain`); все ссылки на «Профили и роли» переименованы в «Регистрация агентов».
- [x] **Чипы зарегистрированных агентов** (`#switcherAgents`): 2-строчная CSS-сетка (`grid-template-rows: auto auto; grid-auto-flow: column`) справа от аккаунтов Codex/Claude. Цвет чипа — зелёный (ключ верифицирован / Ollama/CLI) / янтарный (ключ есть, не проверен) / серый-пунктир (нет ключа). Чипы читают `currentState.settings.profiles` (saved state, не draft — баг с устаревшим черновиком исправлен).
- [x] **Плейсхолдер «Агенты не зарегистрированы»** с `nav-highlight` (оранжевое пульсирующее свечение) пока нет ни одного профиля; клик → открывает панель «Регистрация агентов».
- [x] **Клик по чипу** → `openProfilesPanel(profileId)`: открывает `#providersDetails`, прокручивает и подсвечивает (`profileFlash`) нужную строку профиля.
- [x] **Кнопка «Настройки» переименована** в «Настройки модуль свитчера» (отделена от настроек агентов чипов).
- [x] **«Разрешить агентам сканировать файлы»** вынесена из «Настройки модуль свитчера» в отдельную `.filescan-panel` сразу под панелью «Агенты обсуждения».
- [x] **Компактный редактор агентов**: поля «Бэкенд / Модель / Усилие» переведены в горизонтальный inline-ряд (`.p-field flex-direction: row`, `gap: 3px`); нажатие «Применить» явно перерисовывает редактор из черновика → `hl-default` не сбрасывается.
- [x] **Кнопка × в профиле** всегда в одной строке с выпадающим меню провайдера (`flex-wrap: nowrap` на `.profile-head`).
- [x] Фикс `initProvidersDraft`: профили теперь загружаются независимо от наличия `roles` в state.
- [x] Bilingual + tooltips на все новые элементы. Тесты зелёные (roles/providers/round.integration). **Визуальная проверка в браузере** — проведена через CDP headless (скриншоты), все шаги PASS.

### Phase 6c follow-up (CLOSED 2026-05-31, commits bfcfe31..dc7ee6c)

- [x] **Per-participant `_confirmed` флаг** (заменил глобальный `participantsApplied`): pulse чипа + `hl-default` + `nav-highlight` на Apply горят только на **текущем неподтверждённом** агенте; остальные чипы молчат.
- [x] **Apply подтверждает только текущего агента** — не сбрасывает pulse у остальных неподтверждённых.
- [x] **removeAgent не требует повторного Apply** — удаление авто-сохраняется, флаг не сбрасывается.
- [x] **Glow снимается только явным Apply**, не авто-сохранением при добавлении агента.
- [x] **Manual add: пустые поля** — новый агент открывается с `model=""`, `effort=""`; Apply отключён пока поля не заполнены.
- [x] **Switcher UI**: аккаунты Codex/Claude в двух колонках (`flex-direction: row` на `.switcher-accounts`); `.switcher-module-box` объединяет label + ↻▾ + аккаунты в рамку с border; `#switcherAgents` (зарег. профили) — снаружи рамки; статус-текст двустрочный через `<br>`.

### НЕ проверено вживую (намеренно)
Реальный прогон 2–5 агентов с настоящими CLI/API — за пользователем (подписки). В Phase 6a проверено только моком.

---

## Phase 8 — Post-Consensus Authoring (выработка deliverable-файлов)

Статус: **design-doc готов, не реализовано**. Полный дизайн → `PHASE8_AUTHORING.md`.

### Цель
Добавить к совещанию исполнительный слой: по итогам консенсуса выработать готовый
файл-deliverable (summary / checklist / **closure-review** / report) выбранным
агентом и доставить (copy / handoff-packet / gated-write). Механика дебатов не меняется.
Закрывает разрыв **decision → artifact** (сейчас файл копируется из чата руками).

### Зафиксированные решения
- **Overwrite — настройка пользователя** (не «только новые»); перезапись через тяжёлый гейт (превью + diff + `.bak` + confirm). Создание новых файлов — безопасный дефолт.
- **Две кнопки автопилота**: совещание (текущий) и **исполнение** (новый).
- **Разблокировка исполнения — двойной гейт**: подзадача `resolved` + разовый явный опт-ин.
- **Петля draft→review→revise — настраиваемая** (итерации + budget-cap).
- **Автор ≠ ревьюер** (self-review запрещён); пользователь выбирает обоих.
- **closure-review — обязательный встроенный тип шаблона**; **артефакт + его review-gate производятся парой**.
- **Дёшево/дорого**: local summary (0 токенов) дефолтом; агент на максималках (`VERIFY_AGENTS`) по кнопке.
- **Версионирование** артефакта (`{sourceRound, kbDigest}`, `stale` → перегенерация).

### Поэтапно
A1 — `lib/templates.js` + `/api/deliverables/create` → артефакт как chat-документ (copy).
A2 — панель Deliverables + версионирование.
B — write-примитив (new + gated-диалог; overwrite-настройка; handoff-packet).
C — execution-autopilot (петля + двойной гейт + budget/iteration limits).

### Файлы для правки
| Файл | Что |
|---|---|
| `lib/templates.js` (новый) | реестр шаблонов (по образцу `lib/domains.js`) |
| `lib/deliverables.js` (новый) | хранение/версионирование (`deliverables.jsonl`) |
| `server.js` | эндпойнты `/api/deliverables/*`, `/api/exec-autopilot/*`, `/api/deliverables/write`; хук на resolve |
| `lib/profiles.js` | `VERIFY_AGENTS` как пресет «максималки»; резолв автор/ревьюер |
| `lib/knowledge.js` | `snapshotForPrompt` как вход; digest для `stale` |
| `public/app.js` / `index.html` / `styles.css` | кнопки, панель Deliverables, gated-write диалог (bilingual + `?`) |

---

## Сводка приоритетов

| Phase | Стоимость работы | Польза | Зависимости |
|---|---|---|---|
| ~~Phase 2~~ | **CLOSED 2026-05-28** (token-gate перенесён в Phase 3) | большая — основной workflow пользователя | нет |
| Phase 3 | низко-средняя (читать ai-switcher API, простая панель) + token-gate stop-condition из Phase 2 | средняя — удобство, не блокер | ai-switcher должен быть запущен |
| Phase 4 | средняя (gate + handoff кроссплатформенно) | высокая — замыкает цикл «дебат → реализация» | желательно после Phase 2 (autopilot закроет больше подзадач быстрее) |
| Phase 6 | **CLOSED 2026-05-30** (6a ядро + 6b UX + 6c реестр — всё закрыто) | высокая — пользовательский запрос на пересборку выбора агентов | — |
| Phase 7 | **CLOSED 2026-05-31** — универсальный агент: доменные профили (code/general/research/creative), TAIL_CONTRACT (единственный источник истины якорей), золотой снапшот code-профиля | высокая — выход за пределы software-dev | — |

Рекомендуемый порядок: ~~2~~ → ~~6a~~ → ~~6b~~ → ~~6c~~ → ~~7~~ → **4 → 3**. (Phase 2, 6 и 7 полностью закрыты.)

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
