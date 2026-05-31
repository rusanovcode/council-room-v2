# Council Room v2 — Handoff (2026-05-30)

Документ для следующей сессии. Куда мы пришли, что проверено, что осталось.

## Update 2026-05-31 — current main working tree, not committed yet

Context for the next agent using this folder:
- Active branch: `main`.
- Current work is intentionally on `main`, not `public`.
- Existing local commit before this work: `8968cff Add branch switch helper`.
- Uncommitted files after the latest edits: `lib/domains.js`, `profiles/README.md`, `public/app.js`, `HANDOFF.md`.

What changed:
- Added built-in discussion profile `free` / `Без правил` in `lib/domains.js`.
- This profile has no filesystem-scan guard and no strict-scope guard: `scanApplies: false`, `scopeApplies: false`.
- Its prompt is intentionally minimal: no domain-specific rules, constraints, tone, structure, or limits beyond the shared invariant prompt tail in `lib/prompt.js`.
- Its KB sections are `notes`, `decisions`, `open_questions`.
- Updated `profiles/README.md` so the built-in profile list includes `free`.
- Moved the discussion mode selector row to the top of the right column in `public/app.js`; the row now has `id="discussionModeRow"` and is inserted before `#agentEditorPanel`.

Verification already done:
- `node --check lib/domains.js`
- `node --check public/app.js`
- `npm test`
- Restarted local server on `http://localhost:8788/`.
- Browser verification confirmed the first right-column element is `#discussionModeRow` and its options include `Без правил`.

Important note:
- `Без правил` removes only profile-level/domain-level rules. The global tail contract from `lib/prompt.js` still applies to every profile by design.

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

## 2b. Что сделано в Phase 2 (CLOSED 2026-05-28)

Автопилот: Codex и Claude гоняют раунды по активной подзадаче без участия пользователя до стоп-условия. Плюс два закреплённых терминала с live-выводом агентов.

### Изменения (новых файлов нет)
| Файл | Что добавлено |
|---|---|
| `lib/cli.js` | Отмена через `AbortSignal`: `spawn({signal, killSignal:"SIGTERM"})`, проброшено в `runCodex`/`runClaude`, в результат `aborted`. |
| `server.js` | `state.autopilot`, `ROUND_BUDGET`, `activeAbort`, `broadcastStream` (именованный SSE `event: stream`), рефактор `runRound` (AbortController + onStream + reset-маркеры + возврат `{round,stale,resolve,block,aborted}`), `runAutopilot` loop, `stopAutopilot`, `buildLocalSummary`, эндпоинты `/api/autopilot/start|stop`, guard 409 на `/api/round` во время автопилота. |
| `public/index.html` | Секция `#terminals` (collapsible, два `<pre>`) между лентой и trace; кнопка `#autopilot` + чекбокс `#autoResolve` в composer. |
| `public/app.js` | SSE-обработчик `stream` (буфер cap 40 КБ, reset чистит), биндинги Autopilot/terminals, coach-ветка «Autopilot работает», i18n RU/EN (~13 ключей), tooltips (`tip.autopilot/autoResolve/terminals`), collapse в localStorage. |
| `public/styles.css` | Стили терминалов, `.autoresolve-row`, pulse на `#autopilot.running`. |

### Стоп-условия (5 из 6; любое = стоп)
`debate-complete` (оба resolve), `stale-x2`, `block`, `round-budget` (LIGHT 3 / STANDARD 6 / STRICT 10 / CRITICAL 12), `user-stop`. **token-gate перенесён в Phase 3** (нужен ai-switcher).

### Решения
- На `block` → стоп + coach (модалку не навязываем).
- На `debate-complete` → стоп, подзадачу НЕ закрываем. Опциональный чекбокс «Авто-закрытие» (default OFF): автопилот сам резолвит с локальным summary из KB, без доп. вызова агента.
- Прерванный (⏹) раунд отбрасывается и НЕ инкрементит rounds; завершённые раунды пишут KB как обычно.
- `lib/prompt.js` и `lib/subtasks.js` не тронуты; `autopilotHistory` намеренно не добавлен (стоп-причины — в transcript/trace).

### НЕ проверено (намеренно — не палим подписки)
Реальный autopilot-прогон с Codex/Claude. Проверено на уровне кода/HTTP: модули парсятся, сервер стартует, `/api/state` отдаёт `autopilot`, start/stop корректны, guard «нет подзадачи» останавливает loop чисто, SSE state-канал не сломан (regression), вся разметка отдаётся, i18n-ключи в обеих локалях. Живой прогон (стрим в терминалы, срабатывание стоп-условий, кооперативный ⏹, корректность state после стопа) + визуальный осмотр UI — за пользователем.

## 2c. Что сделано в Phase 5 — ядро (2026-05-30, ЯДРО ЗАКРЫТО)

Единый слой провайдеров: «мультиаккаунт» = несколько профилей на роль. Детали и решения — в **`ROADMAP.md` §Phase 5 → Прогресс** и **`DATA_SOURCES.md`**.

5 шагов, все закоммичены и протестированы:
- **1** `lib/providers.js` (`openai-compatible` + `ollama`, стрим/нестрим, abort↔timeout, пресеты, `credentialRef`→env), `lib/env.js` (zero-dep `.env`), `.env.example`, флаг `PROVIDERS_MODE=full|api` (default `full`).
- **2a** `lib/profiles.js` (схема профиль/роль, `effectiveConfig` — явные `settings.profiles/roles` ИЛИ legacy в одну форму, `legacyChain`, CRUD, `VERIFY_AGENTS`) + `lib/roles.js` (`runProfile` диспетчер CLI/сеть, `runRole` цепочка failover).
- **2b** `runRound` переведён с хардкода Codex/Claude на роли через `roles.runRole`; failover в цепочке; trace «Round backends».
- **2b.1** валидация профилей в `/api/settings` + `publicState().providers{mode,presets,types,credentials}`.
- **2c** UI «Профили и роли» (`public/`): CRUD профилей + редакторы ролей A/B, gating по режиму (full → старые контролы первичны + панель; api → старые CLI скрыты), bilingual + tooltips, локальный draft + Apply.

**Ключевые решения:** один репо + флаг (ничего не удалено, локальная версия цела); ключи `credentialRef`→`.env`; внутренние ключи слотов `codex`/`claude` (роль A/B) сохранены → `questions.js`/KB/терминалы не тронуты, миграции нет, старые чаты идут через legacy-деривацию.

**Тесты:** `test/{providers,roles,round.integration}.test.js` — все зелёные. `round.integration` поднимает сервер в `PROVIDERS_MODE=api` и гоняет реальный `runRound` через мок-OpenAI-бэкенд по HTTP (без подписок/CLI).

### Phase 5 — step 3 (панель токенов под API-ключи) — DONE 2026-05-30
У API-ключей нет «остатка %» → показываем фактический расход токенов из `usage` ответа провайдера.
- `lib/providers.js`: перестал выбрасывать `usage` (`prompt_tokens`/`completion_tokens`; стрим — `stream_options.include_usage`), `normalizeUsage` → `result.usage`.
- `lib/usage.js` (новый): кумулятивный per-profile store в `rooms/.provider-usage.json` (gitignored) — `record`/`summary`/`reset`.
- `server.js`: `runRound` пишет расход по сетевым профилям (CLI/OAuth usage не шлют → не считаются); `/api/switcher/stats` отдаёт `providers` (свежим, вне кэша); `POST /api/providers/usage/reset`.
- `public/`: вкладка «Расход» — строки API-профилей (вход/выход/всего/запросов) + кнопка «Сбросить расход»; «Лимиты» — пометка «нет окон-лимитов»; bilingual + стиль.
- Тесты: usage-парсинг (нестрим+стрим) и round-trip store в `test/providers.test.js` — зелёные; boot-смоук `PROVIDERS_MODE=api` (stats.providers, reset) OK.

### Phase 5 — UI-доводка профилей/ролей (2026-05-30, сессия 2)
Серия UI-правок по запросам пользователя (все закоммичены на `main`):
- **Прямой ввод API-ключа** (`2ee1557`): поле-пароль у сетевых профилей → `POST /api/providers/key` пишет ключ в `.env` (`env.setEnvVar`), НЕ в `state.json`/ответ. Подсказки «?» к Base URL/Модель/Подпись; переписан `tip.roleChain` (галочка = включить профиль в цепочку). Фикс стиля: тёмные поля ввода (селектор ловил только `input[type=text]`).
- **Layout** (`e82ed68`, `58bb400`, `3b1d74e`): «Профили и роли» закреплены sticky сверху правой колонки; «+ Профиль» — RGB-перелив; «Настройки» подняты под неё и сделаны сворачиваемыми (`<details>`, sticky только у `#providersDetails`); «?» у «Настроек» поясняет отличие от «Профили и роли»; фикс переполнения полей (`min-width:0`).
- **Расход в publicState** (`836b4f1`): `providersInfo()` отдаёт `usage` (per-profile spend).
- **Чипы подключённых агентов в строке свитчера** (`836b4f1`): в **full** модуль свитч показывается всегда + чипы рядом; в **api** свитч/↻/кнопки аккаунтов скрыты, чипы — весь индикатор, тот же стиль `acct-btn` + цвет токенов, суффикс `Σ…K` расхода. Источник — живой draft панели ИЛИ `settings.profiles`.
- **Тест ключа при вводе** (`34aa867`, `69dd2db`): `POST /api/providers/test` — сохраняет ключ в `.env`, шлёт мини-запрос, помечает `validatedRefs`. Галочка поля: **зелёная** = прошёл живой тест, **жёлтая** = ключ есть, но не проверен, нет = ключа нет. `publicState().providers.validated`.
- **Проверено:** все 3 теста зелёные; boot-смоук `api` (stats.providers, /providers/test 400-валидация); `/run`-демо на :8790 в `api` с 2 профилями (DeepSeek+Ollama) → headless-скриншот: чипы зелёные, заменяют модуль свитч. Реальный `.env` не тронут (фиктивный ключ — только в env процесса демо).

### Phase 5 — доводка валидации/чипов (2026-05-30, сессия 3) — DONE
- **Персист валидации ключей** (`a5fe946`): `lib/validated.js` — verified `credentialRef`'ы пишутся в `rooms/.validated-keys.json` с привязкой к fingerprint (усечённый SHA-256) значения ключа. `validatedRefs` на старте сидится из файла → проверенный в прошлой сессии ключ остаётся зелёным; смена значения (UI или правка `.env`) → fingerprint не совпал → авто-инвалидация. `/providers/test` и `/providers/key` синхронизируют файл.
- **Цвет чипа = как галочка поля** (`a5fe946`): зелёный (проверен) / жёлтый (ключ есть, не проверен) / серый-пунктир (нет ключа). Раньше чип зеленел по наличию ключа — расходилось с жёлтой галочкой поля.
- Тест `validated` (persist + fingerprint-инвалидация) в `test/providers.test.js` — зелёный.

### Phase 5 — осталось на след. сессию
- **Живой прогон** реального API-провайдера / Ollama / CLI-as-provider — за пользователем (ключи/подписки). Проверено только моком. Заодно сверить, что у выбранного провайдера приходит `usage` (некоторые шлют не всегда; Ollama обычно не шлёт → расход = 0).
- **Цвет чипа — green/yellow/grey по validated/present/no-key**: бакеты «остатка %» (green/yellow/red) для API-ключей не применяются (нет источника). Если появится — бакетить в `connectedAgents()`.
- **Визуальная проверка пользователем** в реальном приложении: sticky-панель, сворачивание «Настроек», фикс переполнения, состояния галочки ключа (зел/жёлт), RGB-кнопка, цвета чипов (зел/жёлт/сер) — ассистент видел только headless-скриншот api-чипов (когда они были зелёными по наличию ключа; теперь логика — по validated).
- **Публичная сборка**: = `PROVIDERS_MODE=api` + положить `.env`. Отдельной вырезки кода НЕ требуется (решили флагом).

## 2e. Что сделано в Phase 6a — ядро на N агентов (2026-05-30, ЯДРО ЗАКРЫТО)

Пересборка стадии выбора агентов. Раньше дебат был жёстко на **двух слотах** (`codex`/`claude`); теперь — **массив участников 2–5**. Слот-ключ стал произвольной строкой: legacy-чаты сохраняют `codex`/`claude`, новые — `a1..a5`. **Миграции данных нет** — код перестал предполагать «ровно два» и итерирует по списку.

**Решения пользователя (зафиксированы):** участников **2–5**; промты **НЕ сжимать** (каждый агент видит полный контекст всех остальных) — цена за рост числа агентов гасится только предупреждением о токенах (UI — в Phase 6b); авто-выбор по умолчанию = 2 разных; «скорость» как параметр — убрать (нет такой ручки у CLI/API).

5 узлов, всё закоммичено и протестировано:
- **profiles.js** — модель участников: `settings.participants[2..5]`; `effectiveConfig` отдаёт `participants[]` (resolved-роли со `slot`=ключ). Приоритет: явные `participants` → явные `roles{a,b}` (Phase 5) → legacy. В результате сохранён `roles{a,b}` = первые два участника (back-compat для тестов/панели Phase 5). CRUD/валидация (`validateParticipants`, `setParticipants`, `MIN_PARTICIPANTS=2`/`MAX_PARTICIPANTS=5`); `removeProfile` чистит и цепочки участников.
- **questions.js** — `resolvedBy` теперь карта по произвольным ключам участников; `recordResolve(...,requiredKeys)` закрывает вопрос только когда **все** текущие участники отметили; `reopen` сбрасывает все метки в `{}`; дефолт ключей `[codex,claude]` хранит старую двух-агентную семантику.
- **prompt.js** — `STATIC_SYSTEM`: «room of 2 to 5 AI agents»; `buildDebatePrompt` принимает `otherAgentNames[]` → «The other participants are …». Промты не сжимаются.
- **server.js `runRound`** — цикл `Promise.all(participants.map(...))` вместо двух хардкод-слотов; полные промты со всеми оппонентами; reset/stream терминалов по каждому ключу (+`label` в `broadcastStream`); парсинг tails по участникам; `addMessage` пишет `slot`; KB/resolve по ключу с `requiredKeys`; стоп-условия обобщены — **все** resolve / **любой** block / **все** stale; verify по `participant.verify`; `recentTurns = participants.length*2`; логи раунда `R{n}-{slot}.{txt,log}`. Валидация `body.participants` в `/api/settings`.
- **Клиент** — динамические терминалы: `#terminalsBody` + `ensureTermPane(key,label)`; пейн на каждого участника создаётся на лету; SSE-стрим принимает любой ключ; `appendTerminal`/`updateTerminalsVisibility` по карте буферов вместо `{codex,claude}`.

**Тесты:** `roles.test.js` (+участники: 3 агента/валидация/`setParticipants`/`removeProfile`-cleanup; questions `resolvedBy` по N ключам), `providers.test.js` (без регрессий), `round.integration.test.js` (реальный `runRound` через мок: legacy 2-слот **И** новый 3-агентный, проверены 3 debate-сообщения со `slot`=a1/a2/a3 и ≥3 запроса в мок) — все зелёные. Boot-смоук `full` — стартует, `/api/state` 200, legacy-чат авто-выбран.

## 2f. Что сделано в Phase 6b — UX выбора агентов (2026-05-30, ЗАКРЫТО)

Стадия выбора агентов пересобрана: пользователь набирает 2–5 спорщиков на чат с чистого листа через навигатор. Детали решений — `ROADMAP.md §Phase 6`.

**Ключевое архитектурное:** чип-участник несёт **inline-backend** (`participant.backend = {provider, account, model, effort, baseUrl, credentialRef}`), а НЕ ссылку на `settings.profiles`. Так выбор (settings.participants) и реестр (settings.profiles, Phase 5/6c) полностью развязаны — нет драки за общий список профилей.

- **profiles.js** (доработка 6a): `resolveSlot` строит синтетический профиль из `backend`, если нет `profileIds` (`backendToProfile`); `validateParticipants` принимает backend ИЛИ profileIds (через `validateProfile`); `setParticipants` сохраняет backend; `hasExplicitParticipants` больше НЕ требует `settings.profiles`.
- **server.js**: дефолт `settings.strictScope = true` (тумблер «Файлы вне scope» включён на новых чатах).
- **public/index.html**: в шапке центра слева — `#agentChips` + 2-строчная `#addAgent` (+`.head-divider`); модалка `#addAgentModal` (Авто/Вручную); новая панель `#agentEditorPanel` сверху правого столбца (над Phase 5-панелью).
- **public/app.js**: `participantsDraft` (per-chat, как providersDraft); `agentCatalog()` (full: Codex/Claude акк1 всегда + акк2 если авторизован + сетевые + Ollama; api: сетевые + Ollama); add-flow `addAgentAuto` (2 разных дешёвых)/`addAgentManual` (+1 до 5); редактор агента (backend/model/effort, дефолт слабые+усилие `low`, подсветка `.hl-default`); `applyParticipants`→`/api/settings` (persist при ≥2, иначе `participants:null`); эскалирующее предупреждение о токенах (`tokenWarn2..5`); navigator-шаги `coach.agents`/`coach.agentsConfig`; `needsAgents()` блокирует «▶ Запустить раунд»/Autopilot на свежем чате при <2 (legacy с историей не блокируются). «Скорость» убрана. i18n RU/EN + tooltips на всё.
- **Навигатор-подсветка (сквозная):** каждый шаг навигатора несёт `highlight:[ids]` — `applyNavHighlights` ставит персистентный класс `.nav-highlight` (пульсирующая обводка) на целевые контролы и АВТО-СБРАСЫВАЕТ при выполнении шага (computeNextStep пересчитывается каждый render). Шаги: нет чата → `newRun`+`runList`; нет подзадачи → `openSubtask`; <2 агентов → `addAgent`; агенты есть → `agentChips`+`documentsPanel`+`allowFilesystemScan`+`autoResolve`+`runRound`+`autopilot` («галочки/документы/запуск всё подсвечивается»). Дефолтные (слабые) поля редактора — `.hl-default` (янтарь). Гаснет, когда коуч закрыт (тихий режим).
- **Чистый лист на новом чате:** `defaultRun` НЕ копирует `participants` из `state.settings`; `applyRunSettings` зеркалит `participants` активного чата (очищает при отсутствии). Новый чат всегда стартует без выбранных агентов (раньше наследовал от прошлого чата — баг для «чистого листа»).
- **Документы (`lib/documents.js`):** per-chat приложенные текстовые документы (`rooms/<id>/documents.jsonl`) → секция `ATTACHED DOCUMENTS` в промте каждого раунда. Легитимный источник (явно приложен пользователем) → разрешён даже в изолированном режиме (`NO_SCAN_GUARD` обновлён). Кэп: 40K/документ на хранении, ~12K суммарно в промт (усечение). Эндпоинты `/api/documents/add|remove`; `publicState.run.documents` (мета без text); UI-панель «Документы» (файл через FileReader или вставка, список name·chars·×, бейдж размера). Проверено смоуком: документ реально доходит до промта раунда.
- **public/styles.css**: 2-строчная кнопка, чипы в шапке (`.head-actions` wrap), панель-редактор, `.token-warn.lvl3/4/5`, `.hl-default` (янтарь), модалка выбора.

**Проверено (код/HTTP):** все тесты зелёные (+inline-backend юнит-кейс в roles.test.js); boot-смоук `full` (strictScope=true, participants 2 OK / 1→400 / кривой backend→400 / clear→null); **реальный раунд на 3 inline-бэкендах через мок** — 3 debate-сообщения, слоты a1/a2/a3, 3 хита. **Визуальная проверка в браузере — за пользователем** (headless-модуля нет): чипы/панель/модалка/подсветка/перенос тулбара.

## 2g. Что сделано в Phase 6c — реестр (2026-05-30, ЗАКРЫТО)

**Phase 6c полностью закрыта** (commits `e194456`..`3989727`). Столбик-иконок решили не делать — зарегистрированные агенты живут как чипы у свитчера.

| Файл | Что изменено |
|---|---|
| `public/app.js` | Чипы `#switcherAgents`: 2-строчная сетка, плейсхолдер «Агенты не зарегистрированы» с `nav-highlight`, клик → `openProfilesPanel()` + flash профиля. Редактор агентов: компактный inline-ряд (`.p-field row`, gap 3px), Apply явно перерисовывает из черновика. `connectedAgents()` читает `currentState.settings.profiles` (не draft — баг с устаревшим черновиком исправлен). `initProvidersDraft` больше не требует `roles` для загрузки профилей. i18n: убраны мёртвые строки роль-редактора, «Профили и роли» → «Регистрация агентов», «Настройки» → «Настройки модуль свитчера». |
| `public/index.html` | `allowFilesystemScan` вынесен из `#settingsDetails` в отдельную `.filescan-panel` под панелью «Агенты обсуждения». |
| `public/styles.css` | `.switcher-agents`: `grid-template-rows: auto auto; grid-auto-flow: column` (2-строчная сетка). `.agent-no-reg` + `nav-highlight`. `.profile-row-flash`. `.profile-head`: `flex-wrap: nowrap`, `max-width: 130px` на `.p-provider` (× не переносится). `.agent-edit-card .p-field`: `flex-direction: row` (компактный редактор). `.filescan-panel`. |

**Проверено (CDP headless + API):** все 5 шагов PASS — 2-строчная сетка чипов, плейсхолдер с nav-highlight (появляется/исчезает по SSE), filescan под агент-редактором, × в одной строке с провайдером, hl-default сохраняется после Apply. Тесты зелёные.

**Живой прогон** реальными агентами (2–5) — за пользователем (подписки).

## 2h. Что сделано после Phase 6c (2026-05-31, ЗАКРЫТО)

Две группы улучшений после закрытия Phase 6c (commits `bfcfe31`..`dc7ee6c`).

### Chip pulse & Apply-glow UX (commits `bfcfe31`..`3e996bf`)

Переработана индикация «агент не подтверждён»: от глобального флага к per-participant `_confirmed`.

| Файл | Что изменено |
|---|---|
| `public/app.js` | `participantsApplied` (глобальный) → `p._confirmed` (per-participant). Новые агенты (`makeAgentFromCatalog`) стартуют с `_confirmed: false`; загруженные из state — `true`. Apply ставит `_confirmed = true` только текущему агенту, не всем. `removeAgent` не сбрасывает флаг (удаление авто-сохраняется без подтверждения). Glow (`hl-default` на полях model/effort + `.pulse` на чипе + `nav-highlight` на кнопке Apply) — только при `!p._confirmed`; снимается только явным кликом Apply, **не** авто-сохранением. `addAgentManual`: новый агент открывается с `model=""`, `effort=""`; кнопка Apply отключена (`canApply`) пока поля пустые. |

### Switcher UI polish (commits `eec65c6`..`dc7ee6c`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `renderSwitcher`: статус-текст переведён с `textContent` на `innerHTML` — поддержка `<br>` для двустрочного отображения. |
| `public/index.html` | `.switcher-module-box` оборачивает `.switcher-left` + кнопки ↻▾ + `#switcherAccounts`; `#switcherAgents` (зарег. профили) остаётся снаружи рамки. |
| `public/styles.css` | `.switcher-accounts`: `flex-direction: row` (два столбца Codex \| Claude); `.acct-row`: `flex-direction: column` (аккаунты 1/2 стопкой внутри столбца). `.switcher-module-box`: border + border-radius + padding. `.switcher-left` — убран per-label border (перенесён на box). |

## 2i. Публичная ветка + Ollama UX (2026-05-31, ЗАКРЫТО)

### Публикация репозитория (commits `a829374`, orphan `public`)

| Что | Детали |
|---|---|
| Orphan-ветка `public` | Отдельный root-commit без истории — нет acc1/acc2/OAuth/switcher в прошлом. |
| `lib/switcher.js` → заглушка | Нет gateway-логики, нет OAuth, нет acc1/acc2 путей. Экспортирует тот же интерфейс с нейтральными возвращаемыми значениями. |
| `server.js` | Убраны `/api/switcher/subscription`, `/api/switcher/refresh` (acc1/acc2 логика), упрощён `/api/switcher/stats`. |
| `public/app.js` | Удалены `renderSwitcher`, `renderStatsPanel`, `openLoginModal`, кнопки аккаунтов, subscription UI. Очищены i18n-строки от acc1/acc2/OAuth/ai-switcher упоминаний. |
| `public/index.html` | Убраны switcher-module-box, stats div, loginModal. `#switcherAgents` остаётся (чипы провайдеров). |
| Документы | `DATA_SOURCES.md`, `HANDOFF.md`, `ROADMAP.md`, `SETUP.md` — удалены из public-ветки. `README.md` переписан для публичной аудитории. |
| GitHub | Репо сделано публичным; default branch → `public`. URL: https://github.com/rusanovcode/council-room-v2 |

### Исправления дропдауна провайдеров (commits `c9f3574`, `f6a36b1`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `providerOptions()` теперь возвращает `{id, label}` — дропдаун показывает `OpenAI`, `DeepSeek`, `Ollama (local)`, `Codex CLI` вместо сырых id. Убран дублирующийся `"ollama"` (был в пресетах И в ручном push). `applyProviders()` проверяет пустое поле модели до отправки на сервер — показывает «Укажи модель для «…»» вместо серверной ошибки. Placeholder поля модели для Ollama = `llama3.2`. |

### Ollama: автообнаружение + дропдаун моделей (commits `b92cb56`, `2d52d8b`)

| Файл | Что изменено |
|---|---|
| `server.js` | `GET /api/ollama/detect` — пробует `OLLAMA_HOST` env, затем `localhost:11434`; возвращает `{ detected, baseUrl, port, models[] }`. `GET /api/ollama/models?baseUrl=` — проксирует `GET <base>/api/tags` (обход CORS). |
| `public/app.js` | `detectOllama()` — вызывается при открытии панели «Регистрация агентов», результат кэшируется. `ollamaBanner()` — зелёный/серый статус-баннер с портом и списком моделей. При выборе Ollama в дропдауне провайдера — подгружает модели через `fetchOllamaModels()` и показывает `<select>` с доступными моделями вместо текстового поля. `addProfileDraft()` — если Ollama обнаружена, новый профиль сразу создаётся с Ollama + detected baseUrl. |
| `public/index.html` | `#ollamaBanner` над списком профилей в панели «Регистрация агентов». |
| `public/styles.css` | `.ollama-status ok/miss/checking` — стили баннера. |

### Ollama: навигатор при незарегистрированном бэкенде (commit `fcaa280`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `pendingOllamaRegistration` flag + `hasRegisteredOllamaProfile()`. Когда пользователь выбирает fallback «Ollama (local)» (нет зарег. профиля) в редакторе агентов дебатов: поле «Модель» показывает «← зарегистрируй в «Регистрация агентов»» оранжевым; `computeNextStep()` выдаёт warn-шаг с инструкцией; `#providersDetails` получает `nav-highlight`. Флаг сбрасывается как только профиль появляется в state (SSE). `triggerCoachTarget` расширен для `<details>` (открывает + скроллит). |
| `public/styles.css` | `.ag-model-hint` (оранжевый курсив), `.next-step.tone-warn .next-step-title` (янтарный заголовок). |

### Ollama: тест перед сохранением профиля (commit `1349f70`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `applyProviders()`: для Ollama-профилей перед `POST /api/settings` вызывается `/api/providers/test`. «Идёт проверка…» (без таймера). Успех → сохранение → «✓ Подключено» на 5 сек → чип появляется. Провал → «✗ Не подключена: …» → сохранения нет, чипа нет. `showProvidersMsg(text, isError, timeoutMs)` — добавлен параметр `timeoutMs` (0 = без таймера). |

### Trace-логирование событий агентов (commit `f21f7ae`)

| Файл | Что изменено |
|---|---|
| `server.js` | `/api/providers/test`: логирует старт теста + результат (pass/fail) с провайдером и моделью. `/api/settings` (body.profiles): логирует добавление/удаление профилей из реестра. `/api/settings` (body.participants): логирует добавление/обновление/удаление агентов дебатов с полным бэкенд-строкой (провайдер / модель / усилие). Все сообщения двуязычные (text EN + textRu RU), `kind: "process"`. `addMessage()` — no-op при `state.run === null`, падения нет. |

## 2j. Фиксы и панель зарегистрированных моделей (2026-05-31, ЗАКРЫТО)

Четыре коммита `306906f`..`c5416e2`.

### Отображение прогресса теста Ollama по каждой модели (commit `306906f`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `applyProviders()`: при тестировании нескольких Ollama-профилей теперь показывает «Проверяю: llama3.2…» / «Проверяю: mistral:7b…» для каждого по очереди (вместо одного общего «Идёт проверка…»). Сообщение об успехе перечисляет все протестированные модели: «✓ Подключено: llama3.2, qwen2.5:7b». |

### Фикс: каждый registered-профиль — уникальный бэкенд (commit `f79aee8`)

**Баг:** `addAgentAuto()` и `addAgentManual()` считали два разных Ollama-профиля (разные модели) одним бэкендом — оба агента получали одну и ту же модель.

**Причина:** проверка уникальности `x.provider === c.provider && x.account === c.account` — для Ollama оба условия всегда совпадают.

| Файл | Что изменено |
|---|---|
| `public/app.js` | `addAgentAuto()`: уникальность для сетевых провайдеров по `catalog.id`, а не по `provider+account`. `addAgentManual()`: аналогичный фикс `usedIds` через id каталога. `catalogEntryForBackend()`: для сетевых провайдеров ищет совпадение по `defaultModel` — редактор чипа показывает правильный профиль. |

### Панель «Зарегистрированные модели» (commit `e09b111`)

Новая секция `<details id="registeredModelsPanel">` — ниже «Регистрация агентов», выше «Настройки». Показывает глобальные `settings.profiles` в user-friendly табличном формате.

| Файл | Что изменено |
|---|---|
| `public/index.html` | Новый `<details id="registeredModelsPanel">` с `<div id="registeredModelsList">`. |
| `public/app.js` | `renderRegisteredModels()` — строит таблицу `.rm-table` из `currentState.settings.profiles`. `renderRegisteredModelRow(p)` — одна строка: label-инпут, бейдж провайдера, model-select (дропдаун из Ollama `/api/tags` или CLI_MODELS; text-input для API), effort-select (только где `CLI_EFFORTS[prov]` определён), speed (зарезервировано — поле появится когда провайдер добавит поддержку). `saveRegisteredModelRow(id, fields)` — немедленный `POST /api/settings { profiles }` без валидации/теста (профили уже протестированы). `bindRegisteredModels()` — событие `change` на таблице (делегирование), `blur` для текстовых инпутов. Автосохранение без кнопки «Применить». Вызывается из `render()` и из `renderProviders()`. i18n RU+EN. |
| `public/styles.css` | `.rm-table`, `.rm-row`, `.rm-cell`, `.rm-cell-label`, `.rm-cell-agent`, `.rm-col-head`, `.rm-prov-badge` — компактная таблица регистраций. |

### Скрытие пустых корзин (commit `c5416e2`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | Кнопки 🗑 и 🗄 чатов/подзадач скрываются (`style.display = "none"`) когда соответствующий массив пуст. Панели (`chatTrash`, `subtaskTrash`, `subtaskArchive`) авто-закрываются при опустении. Кнопки и панели появляются обратно как только появляется хотя бы один элемент. |

## 2k. Условный баннер Ollama + постоянный журнал событий (2026-05-31, commit `514ea93`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | **Баннер Ollama** в «Регистрация агентов» (`renderProviders`): показывается только когда хотя бы один профиль в черновике имеет `provider === "ollama"`, иначе скрыт. **Журнал событий** (`providerEventLog`): хранится в localStorage (`council-room-v2.providerLog`, до 100 записей), каждая запись `{at: ISO, ru, en}`. `provLogAdd(ru, en)` — добавляет запись и вызывает ре-рендер. `detectOllama()` пишет в лог результат обнаружения (найдена с портом+моделями, или не найдена). `applyProviders()` пишет в лог каждый успешно зарегистрированный профиль. `renderRegisteredModels()` рендерит лог внизу панели «Зарегистрированные модели» — новые записи сверху, колонки дата+время / сообщение. Кнопка «Очистить» сбрасывает лог через `provLogSave([])`. |
| `public/styles.css` | `.plog-wrap`, `.plog-head`, `.plog-table`, `.plog-dt`, `.plog-msg` — стили постоянного журнала. |

## 2l. Макет журнала событий (2026-05-31, commit `6566285`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `renderRegisteredModels()`: лог переработан с `<table>` на `<div class="plog-box">` + `<div class="plog-entry">`. Каждая запись — flex-column: дата сверху, сообщение снизу. |
| `public/styles.css` | `.plog-box` — единый прокручиваемый контейнер (`max-height: 180px`, `overflow-y: auto`, фон `--panel-2`, border+border-radius). `.plog-entry` — flex-column, разделитель `border-bottom`. `.plog-dt` — 10px мono-шрифт, цвет `--muted`. `.plog-msg` — 11px, `word-break: break-word`. Таблица `.plog-table` убрана. |

## 2m. Key-badge строкой ниже + дублирование лога в трейс (2026-05-31)

### «нет ключа» на отдельной строке (commit `d3fe9fc`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `renderProfileRow()`: `keyBadge` перенесён из `<div class="profile-head">` в отдельный `<div class="profile-key-row">` между `.profile-head` и `.profile-fields`. |
| `public/styles.css` | `.profile-key-row { padding: 2px 0 0 2px }` — новая строка для бейджа. |

### Дублирование событий провайдеров в «Служебные события» (commit `662f88a`)

| Файл | Что изменено |
|---|---|
| `server.js` | `POST /api/log { text, textRu }` — тонкий эндпоинт, вызывает `addMessage({ role: "system", kind: "process", ... })`. No-op когда `state.run === null` (нет активного чата). |
| `public/app.js` | `provLogAdd(ru, en)`: после записи в localStorage делает fire-and-forget `fetch("/api/log", ...)`. Все события журнала «Зарегистрированные модели» (обнаружение Ollama, регистрация агентов) теперь появляются и в трейсе «Служебные события» активного чата. |

## 2n. Панель регистрации только для новых + ↻ ретест + раскрывашка + кнопка фидбэка (2026-05-31)

### «Регистрация агентов» показывает только несохранённые профили (commit `f0aaa60`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `renderProviders()`: фильтрует `providersDraft.profiles` — показывает только профили, id которых отсутствует в `currentState.settings.profiles` (ещё не сохранённые). Уже сохранённые профили видны исключительно в «Зарегистрированные модели». `applyProviders()`: тестирует через `/api/providers/test` только **новые** Ollama-профили (не уже сохранённые). Заголовок «Профили» → «Профиль» (единственное число). i18n `ui.noNewProfiles`. |

### Кнопка ↻ ретест, журнал под раскрывашкой, дата/время в две строки (commit `a778d8f`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `rmStatus{}` — per-profile `{ testing, ok }`. `renderRegisteredModelRow()`: крайняя левая ячейка `.rm-cell-retest` с кнопкой `↻`; строка получает класс `rm-ok`/`rm-fail`/`rm-testing` по статусу. Журнал событий обёрнут в `<details class="plog-details">` (раскрывашка). Дата и время разбиты на `.plog-date` / `.plog-time` (две строки). Кнопка «Очистить» не закрывает `<details>` (`stopPropagation`). Пустой журнал: «Журнал пуст». `retestRegisteredModel(id)`: `POST /api/providers/test` → обновляет `rmStatus[id]`, пишет результат в `provLogAdd` + трейс, ре-рендерит панель. |
| `public/styles.css` | `.plog-details` / `.plog-summary` / `.plog-date` / `.plog-time`. `.rm-cell-retest`, `.rm-retest` (кнопка ↻, спиннер при `disabled`), `.rm-row.rm-ok` / `.rm-row.rm-fail` (цвет фона + бейджа). |

### Кнопка обратной связи ✉ в заголовке (commit `9652762`)

| Файл | Что изменено |
|---|---|
| `public/index.html` | `<button id="feedbackBtn" class="feedback-btn">✉</button>` справа от `?` в `<h1>`. Модалка `#feedbackModal`: радиокнопки тип (Баг / Пожелание / Другое), `<textarea id="feedbackText">`, кнопки «Отправить письмо» / «Отмена». |
| `public/app.js` | Обработчики `feedbackBtn`, `feedbackCancel`, `feedbackSend`. «Отправить» строит `mailto:bbomidor@gmail.com?subject=...&body=...` с типом в теме и текстом в теле, открывает почтовый клиент. i18n RU+EN. |
| `public/styles.css` | `.feedback-btn` (мелкая кнопка ✉ в h1), `.feedback-type-row`, `.feedback-textarea`. |

## 2o. Фидбэк-кнопка 2-шага, фикс логирования, KB, чипы, UX регистрации (2026-05-31)

### Фидбэк-модал 2-шага (commit `f713a46`)

| Файл | Что изменено |
|---|---|
| `public/index.html` | Модал разбит на `#feedbackStep1` (тип + textarea + «Выбрать приложение →») и `#feedbackStep2` (сетка клиентов: Gmail, Outlook, Yahoo, Яндекс Почта, Приложение по умолчанию). |
| `public/app.js` | `feedbackShowStep(n)` переключает шаги. «Выбрать приложение →» переходит к шагу 2. Каждая кнопка-клиент строит compose-URL своего сервиса (`window.open` для веб-клиентов, `location.href` для mailto). |
| `public/styles.css` | `.feedback-clients` (grid 2-col), `.feedback-client-btn`, `.fc-icon`. |

### Фикс логирования + KB + анимация чипов (commit `b784210`)

| Файл | Что изменено |
|---|---|
| `public/app.js` | `applyProviders()`: логирование ВСЕХ новых профилей (любого типа) после успешного сохранения через единый цикл по `savedIds` — CLI, Ollama и API покрываются. Раньше CLI не логировались, не-Ollama пропускались в Ollama-ветке. `$("refreshSwitcher")?.addEventListener`: добавляет `chips-loading` на `#switcherAgents` / `#switcherAccounts` пока `POST /api/switcher/refresh` в полёте, снимает в `.finally()`. |
| `public/styles.css` | `#registeredModelsPanel[open] .providers-body { max-height: 45vh; overflow-y: auto }` — панель больше не выталкивает «Базу знаний» за экран. `@keyframes chipPulse` + `.chips-loading .acct-btn/.agent-chip` — пульсация чипов при обновлении. |

### UX «Регистрации агентов» + хомячок + подсказки (commits `bc1312d`, `5b16ea7`)

| Файл | Что изменено |
|---|---|
| `public/index.html` | Убран `<div class="providers-subhead">` и заголовок «Профиль». `#addProfileBtn` — теперь полноширинная кнопка `.add-profile-wide`. Добавлен `<span id="profileHamster">🐹</span>`. |
| `public/app.js` | `t()`: массивы в STRINGS → случайный элемент (`Math.random`). `"ui.noNewProfiles"` — массив из **17 RU + 17 EN** случайных шуточных подсказок (хомячок, кожанный, Валентина, ChatGPT, синоптик и др.). `renderProviders()`: «Применить» скрывается (`display:none`) пока нет несохранённых профилей; Ollama-баннер показывается только при несохранённых Ollama-профилях. `#addProfileBtn` клик: анимирует `#profileHamster` через класс `.hamster-pop` (1.8 сек). |
| `public/styles.css` | `.add-profile-wide` (100% ширины), `.profile-hamster` + `@keyframes hamsterPop` (scale+rotate+fade). |

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
  - `council-room-v2.terminalsCollapsed` — свёрнутость терминалов
- ai-switcher (`C:\AI\ai-switcher`) — **используется** (модуль свитч). Источники, пути и форматы — в **`DATA_SOURCES.md`**.

## 5. Открытые вопросы / known issues

- **Codex sandbox**: `--sandbox read-only` не запрещает чтение всего диска — только мешает писать. Изоляция держится на (а) пустой cwd, (б) промт-блоке. Если агент явно нарушит — нужно ужесточать промт.
- **Tooltip ширина**: max-width 420px достаточна для текущих подсказок. Если будут длиннее — растягиваем.
- **Trace toggle ▾/▴**: завязан на `lastChild.textContent` — хрупко, но работает. При следующем рефакторе UI заменить на data-binding.
- **Старый Council Room v1** (порт 8787): не трогаем. Удалить можно только когда пользователь закончит свою задачу в одном из его чатов.

## 6. Что делать в следующей сессии — старт-чеклист

1. **Прочитать**: этот HANDOFF.md + **`DATA_SOURCES.md`** (откуда что берётся, структура файлов) + `ROADMAP.md` + `MEMORY.md` (если запрошено).
2. **Спросить пользователя**: что делаем дальше? (**Phase 2, 5, 6 — все закрыты 2026-05-30.** Раньше построены: цикл вопросов, мультиаккаунт/свитч+gateway, архив/корзина, статистика — §10. Не закрыто: Phase 3 (панель аккаунтов) / Phase 4 (Implementation Gate + Handoff); отложено: Codex OAuth-usage, живой прогон реальных агентов.)
3. **Перед любой реализацией**: проверить что v2 запускается — `Council Room v2.bat` → http://localhost:8788 → состояние не сломано.
4. **Если идём в Phase 4** — открыть `ROADMAP.md` секцию Phase 4 и следовать. Phase 4 (Implementation Gate + Handoff) выигрывает от Phase 2: автопилот быстрее закрывает подзадачи → gate срабатывает чаще.
5. **Phase 2 — живая валидация осталась за пользователем**: прогнать реальный autopilot-раунд и сверить acceptance criteria в ROADMAP §Phase 2.

## 7. Файлы, которые надо открыть для контекста

| Файл | Зачем |
|---|---|
| `HANDOFF.md` (этот) | сводка состояния |
| `DATA_SOURCES.md` | **откуда что берётся** (gateway, токены, статистика) + структура файлов |
| `ROADMAP.md` | планы Phase 3/4 |
| `lib/prompt.js` | промты, NO_SCAN_GUARD, STRICT_SCOPE_RULE, parseAgentTail (Resolved/Verify/Priority) |
| `lib/cli.js` | запуск агентов, AbortSignal/killTree, accountEnv, spawnLogin |
| `lib/switcher.js` | модуль свитч: gateway-клиент + файловый фолбэк, envForAccount |
| `lib/questions.js` | цикл вопросов (ID/priority/resolve/verify, near-dup дедуп) |
| `lib/stats.js` | окна usage-cache + расход из session-JSONL |
| `server.js` (`runRound`/`runAutopilot`) | основной цикл раунда, автопилот, switcher-кэш |
| `public/app.js` (`computeNextStep`, `renderSwitcher`, `renderStatsPanel`) | коуч, кнопки аккаунтов, раскрывашка |
| `..\Council Room\AGENT_WORKFLOW_PLAYBOOK.md` | первоисточник правил (Operation Modes, Implementation Gate) |

## 8. Принципы, которые держим (правила пользователя)

- **Изоляция по умолчанию** — агенты не читают проект без явного разрешения.
- **Экономия токенов** — scoped prompts, KB snapshot вместо транскрипта.
- **Не палить подписки на dry-run** — реальные раунды агентов запускает только пользователь.
- **Не трогать старый v1** до явного разрешения.
- **Перед опасными действиями** (delete, force push, drop) — confirm у пользователя.
- **Bilingual**: UI и подсказки — RU primary, EN secondary. Технические термины — в скобках (pending), (Status: resolve).

## 9. Git

v2 — отдельный репозиторий (`C:\AI\Council Room v2\.git`), независимый от внешнего `C:\AI\.git` и от v1 (`C:\AI\Council Room\.git`).

## 10. Что построено поверх Phase 2 (текущее состояние, 2026-05-29)

Источники/пути/форматы по каждому пункту — в **`DATA_SOURCES.md`**.

- **Цикл вопросов** (`lib/questions.js`, `questions.jsonl`): стабильные ID (Q1…), near-dup дедуп (char-trigram), `Resolved:`-протокол — вопрос закрывается только когда оба агента его решили; финальная VERIFY-проверка пакета **максимальными агентами** (gpt-5.5/xhigh, opus/max); **приоритет** critical/minor — гейт по critical, minor откладываются (висят с предупреждением), повышение minor→critical снова блокирует.
- **Мультиаккаунт / модуль свитч** (`lib/switcher.js`): источник истины — **gateway ai-switcher на 7700** (профили acc1/acc2/apikey, активный), фолбэк — файлы. Режимы auto (failover при ошибке) / manual. Индикатор «подключён/нет» слева снизу; 4 кнопки аккаунтов (цвет = остаток токенов Claude), активный подсвечен; клик = авторизация (терминал в env аккаунта, с пошаговой модалкой), уже-авторизованный — «перелогиниться» опционально; кнопка ↻ refresh (мини-запрос наполняет usage-cache).
- **Статистика (раскрывашка ▴, вкладки)** (`lib/stats.js`, `GET /api/switcher/stats`): Лимиты (5h/7d сброс, загрузка окон), Расход (in/out/cache/запросы, today/week/all из session-JSONL), Подписка (ручные даты + дней до конца). **Только Claude** — у Codex нет файлового источника.
- **Архив/корзина**: чаты (× → архив, восстановление), подзадачи (🗄 архив / × корзина, read-only превью по клику, ↩ восстановить, «Очистить»).
- **Инфраструктура**: лаунчеры освобождают порт перед стартом (конец EADDRINUSE-ловушки); `server.on("error")` для занятого порта; cache-bust ассетов через `BUILD_ID` (`?v=__V__`) + `no-store`; авто-выбор последнего чата при старте; стоп реально убивает дерево процессов (`taskkill /T`).

### Отложено (следующий этап)
- **Codex-цифры (остаток %) и авто-подписка** через OAuth-usage API (как CodeBurn: `wham/usage`, `oauth/usage` с токеном аккаунта). Тяжелее (внешние HTTPS + секреты) — вынесено. Детали в `DATA_SOURCES.md` §5.
- **Phase 3** (полная панель аккаунтов с usage-историей) и **Phase 4** (Implementation Gate + Handoff) — см. ROADMAP.

### НЕ проверено вживую (намеренно — не палим подписки)
Реальные раунды/автопилот/failover/refresh с настоящими Codex/Claude запускает пользователь. Вся проверка в сессиях — на уровне кода/HTTP (модули парсятся, endpoints отвечают, юнит-логика).

## 11. План живой проверки АВТОПИЛОТА (перенесено, делать заново в след. сессии)

Не доделали ранее. Прогнать заново, дёшево (минимум токенов).

**Настройки (чтобы дёшево):** Codex `gpt-5.4-mini`/effort `low`, Claude `haiku`/`low`; «Разрешить сканировать файлы» OFF (изолированно, промт ~2 КБ); аккаунт 1.

**Подзадача:** новый чат → подзадача в режиме **LIGHT** (budget 3 раунда). Постановка тривиальная и однозначная, чтобы оба быстро дали `Status: resolve`, напр.: «булевы поля JSON — camelCase или snake_case, если проект уже на camelCase?».

**Чек-лист (сверить каждое):**
1. Кнопка «Autopilot ▶» активна только при открытой подзадаче; жмём → раунды идут друг за другом, лента наполняется, **оба терминала стримят stdout** (раскрыть панель терминалов).
2. **debate-complete**: оба `Status: resolve` → в trace «Autopilot stopped: debate-complete», кнопка вернулась в ▶, coach предлагает «Закрыть».
3. **⏹ Stop (user-stop)**: на свежей LIGHT-подзадаче запустить и сразу ⏹ → раунд **реально прерывается** (проверить, что codex/claude-процессы убиты — `taskkill /T`, не осталось сирот в диспетчере), в trace «user-stop», rounds НЕ инкрементнулся.
4. **round-budget**: если агенты не сходятся — стоп на лимите режима (LIGHT=3).
5. **stale-x2**: два пустых раунда подряд → стоп.
6. После стопа state корректный (rounds, KB, questions).
7. **Авто-закрытие** (чекбокс ON): на debate-complete подзадача авто-резолвится с локальным summary.
8. **Финальная VERIFY** (если по подзадаче все critical-вопросы решены): раунд идёт **максимальными агентами** (gpt-5.5/xhigh, opus/max) — отметка в trace; оба `Verify: ok` → готово к закрытию.

Запускает ПОЛЬЗОВАТЕЛЬ (тратит подписки). Ассистент — только наблюдает trace/логи `rooms/<id>/R{n}-*.log`.

`rooms/` — gitignored (пользовательские данные). `rooms/.keep` оставлен в репозитории чтобы папка существовала.

`node_modules/` — gitignored.

---

## Phase 7 — Universal Council Room (2026-05-31, CLOSED)

Агент стал универсальным: добавлены доменные профили (`code`, `general`, `research`, `creative`).
Дебатная механика (subtask → rounds → questions → verify → resolve/block) **не изменилась**.

**Ключевые инварианты:**
- `TAIL_CONTRACT` в `lib/prompt.js` — единственный источник якорей хвоста (`New facts`, `New risks`, `New alternatives`, `Status`, `KB-patch`, `Resolved`, `Verify`, `Priority`). Профили не меняют якоря — только `systemLines` и `sections`.
- Золотой снапшот `code`-профиля: `test/__snapshots__/code-debate.txt` (byte-for-byte) + `test/__snapshots__/parse-tail.json` (parity). Пересоздавать снапшот нельзя — это регрессия.
- Чаты без поля `discussionMode` → `"code"` (без миграции).

**Новые файлы:**
| Файл | Назначение |
|---|---|
| `lib/domains.js` | Реестр профилей; `getProfile(id)`, `list()`, `DEFAULT="code"` |
| `test/prompt.snapshot.test.js` | Золотой тест 7a; защита от регрессии промта и парсера |
| `test/__snapshots__/code-debate.txt` | Снапшот `buildDebatePrompt` для `code`-профиля |
| `test/__snapshots__/parse-tail.json` | Снапшот `parseAgentTail` на 6 типовых хвостах |

**Изменённые файлы:**
- `lib/prompt.js` — `TAIL_CONTRACT`, `tailPromptLines`, `QUESTIONS_PROTOCOL`, `buildDebatePrompt(domain=)`, `parseAgentTail` через TAIL_CONTRACT
- `lib/knowledge.js` — `load/save/addItem/snapshotForPrompt` принимают `domainIdOrSections`
- `server.js` — `discussionMode` в dual-store settings, валидация, guard смены профиля на непустом KB, `state.domain` в `publicState()`
- `public/app.js` — `renderKnowledge()` из `state.domain.sections`; profile selector; scan/scope toggles скрыты для неприменимых профилей
