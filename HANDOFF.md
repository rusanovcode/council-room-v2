# Council Room v2 — Handoff (2026-05-30)

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
2. **Спросить пользователя**: что делаем дальше? (Phase 2 закрыт; **Phase 5 ЯДРО + панель токенов закрыты 2026-05-30** — провайдеры/профили/роли + spend по API-ключам, см. §2c. Не закрыто в Phase 5: живой прогон реальных провайдеров (за пользователем). Раньше построены цикл вопросов, мультиаккаунт/свитч+gateway, архив/корзина, статистика — §10. Не закрыто: Phase 3 панель/Phase 4 gate; отложено: Codex OAuth-usage.)
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
