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
│   ├── knowledge.js          KB (секции по профилю домена), near-dup дедуп, snapshotForPrompt(dir, sections) — open_questions всегда исключён из снапшота. Набор секций = domains.getProfile(discussionMode).sections; старые вызовы без аргумента → code-профиль
│   ├── questions.js          per-subtask вопросы (questions.jsonl): ID, priority, resolvedBy ([Phase 6] карта по ключам участников), verify, near-dup; recordResolve(...,requiredKeys) закрывает когда ВСЕ текущие участники отметили; reopen сбрасывает метки
│   ├── domains.js            [Phase 7] реестр доменных профилей (code/general/research/creative): {id,label,guards,systemLines,sections}; getProfile(id)/list()/DEFAULT. TAIL_CONTRACT (якоря хвоста) — единственный источник истины в prompt.js; профили меняют только systemLines и sections
│   ├── prompt.js             TAIL_CONTRACT (якоря хвоста; единственный источник истины), QUESTIONS_PROTOCOL, tailPromptLines/availableSectionsLines, buildDebatePrompt(domain=getProfile("code")), parseAgentTail (на TAIL_CONTRACT), STATIC_SYSTEM (code-профиль; золотой снапшот — test/__snapshots__/code-debate.txt), NO_SCAN_GUARD/STRICT_SCOPE_RULE
│   ├── cli.js                runCodex/runClaude (spawn, AbortSignal, killTree, accountEnv), spawnLogin
│   ├── switcher.js           модуль свитч: gateway-клиент (7700) + файловый фолбэк; envForAccount; claude/codexPaths; токен-% (claude usage-cache+oauth/usage fetch, codex rollout rate_limits)
│   ├── providers.js          [Phase 5] слой провайдеров: runProfile(profile,prompt,opts)→{ok,text,aborted,result}; типы: anthropic (native /v1/messages + prompt-cache), openai-compatible, ollama; пресеты (вкл. anthropic) + debatePresets(); credentialRef→env; mode()=PROVIDERS_MODE full|api. OpenRouter: fallbackModels→`models:[...]` (model-failover) + openrouterPool(keyPool) (account-failover, result.usedRef/blockedRefs)
│   ├── profiles.js           [Phase 5/6] схема профиль/участник; effectiveConfig → participants[2..5] (явные settings.participants → явные roles{a,b} → legacy); участник несёт profileIds (реестр) ИЛИ inline backend{provider,account,model,effort,baseUrl,credentialRef} → синтетический профиль (6b, выбор развязан с реестром); roles{a,b}=первые 2 (back-compat); legacyChain (acc1/acc2 + failover); CRUD профилей+участников (validateParticipants/setParticipants, MIN=2/MAX=5); VERIFY_AGENTS
│   ├── roles.js              [Phase 5] runProfile (диспетчер CLI/сеть, CLI off в api) + runRole (цепочка failover auto/manual, verify-override) — то, что зовёт runRound вместо хардкода Codex/Claude
│   ├── env.js                [Phase 5] zero-dep загрузчик .env + setEnvVar (прямой ввод ключа пишет в .env); зовётся в server.js до прочих require
│   ├── documents.js          [Phase 6b] per-chat приложенные текстовые документы (rooms/<id>/documents.jsonl): add/remove/loadAll/listMeta/snapshotForPrompt (кэп 40K/док, ~12K суммарно в промт); легитимный источник в изоляции
│   ├── usage.js              [Phase 5] кумулятивный расход токенов per-profile (rooms/.provider-usage.json); record/summary/reset
│   ├── orquota.js            OpenRouter free-pool daily quota counter (rooms/.or-quota.json): bump/bump429/summary per credentialRef per day; cap 50 (free) / 1000 (credited). OpenRouter exposes no remaining number, so we tally our own.
│   ├── validated.js          [Phase 5] persist «ключ прошёл живой тест» (rooms/.validated-keys.json, привязка к fingerprint значения ключа); markValidated/clearValidated/validatedSet
│   └── stats.js              окна claude usage-cache + расход из session-JSONL (для раскрывашки)
├── public/                   index.html, app.js (i18n RU/EN, render*, coach), styles.css
├── test/                     [Phase 5] providers.test.js (адаптер), roles.test.js (профили/роли/failover), round.integration.test.js (реальный runRound через мок). Запуск: node test/<f>.js
├── .env.example              [Phase 5] шаблон env (ключи провайдеров + PROVIDERS_MODE); реальный .env gitignored
├── Council Room v2.bat/.command/.sh   лаунчеры (освобождают порт перед стартом)
├── HANDOFF.md  ROADMAP.md  DATA_SOURCES.md (этот)
└── rooms/<runId>/            данные чата (gitignored)
```

### rooms/<runId>/ — данные одного чата
| Файл | Что |
|---|---|
| `state.json` | run: id, topic, createdAt, rounds, **archived**, settings (копия глобальных; [Phase 7] поле **discussionMode** = "code"\|"general"\|"research"\|"creative"; чат без поля → "code") |
| `transcript.jsonl` | все сообщения (role/kind/text/subtaskId/round); `kind:process`/`subtask-*` → trace-лента |
| `subtasks.jsonl` | подзадачи: status(open/pending/resolved/frozen), mode, rounds, **bin** ("" / archive / trash) |
| `questions.jsonl` | вопросы: id(Q1…), subtaskId, text, status(open/resolved/verified), **priority**(critical/minor), resolvedBy{codex,claude}, answer |
| `knowledge.md` | KB-секции по активному домену (code по умолчанию: decisions, prohibitions, control_contract, files_in_scope, files_out_of_scope, verification_commands, open_questions). open_questions мигрирует в questions.jsonl |
| `documents.jsonl` | [6b] приложенные текстовые документы чата: {id,name,text,chars,addedAt} → секция ATTACHED DOCUMENTS в промте |
| `R{n}-{subtaskId}-{codex,claude}.log/.txt` | сырые логи раунда |

---

## 2. Модуль свитч (мультиаккаунт) — `lib/switcher.js`

**Это ai-switcher (`<repo>/ai-switcher`).** Источник истины — его **HTTP-gateway**, фолбэк — файлы.

### Gateway (первичный источник)
- URL: `http://127.0.0.1:7700/status` (`GATEWAY_PORT`, `AI_SWITCHER_HOST`). Поднимается отдельно (трей/демон ai-switcher).
- `/status` отдаёт: `active{claude,codex}` (активный профиль), `profiles{claude:[{id,label,mode,apiKeySet}],codex:[…]}` — профили **acc1 / acc2 / apikey**, `codexFailoverEnabled`.
- Другие эндпоинты gateway: `/run`, `/switch {service,profile}`, `/register`, `/policy`, `/api-key`, `/kill`. **Токенов/usage НЕ отдаёт.**
- Council Room поллит `/status` раз в 15с → кэш `switcherStatus` (server.js), отдаётся в `publicState().switcher`.

### Файловый фолбэк (если gateway не отвечает)
- «Подключён» = есть auth-папки acc2. Аккаунт 2 выбирается переменными окружения:
  - Claude acc2: `CLAUDE_CONFIG_DIR` + `CLAUDE_USAGE_CACHE` = `<repo>/ai-switcher/auth/claude-acc2`
  - Codex acc2: `CODEX_HOME` = `<repo>/ai-switcher/auth/codex-acc2`
  - acc1 = переменные НЕ заданы → дефолт (`%USERPROFILE%\.claude`, `%USERPROFILE%\.codex`)
- `envForAccount(tool, account)` возвращает эти overrides; `cli.runCodex/runClaude` прокидывают их в дочерний процесс.
- Авторизация по кнопке: `cli.spawnLogin` открывает терминал в env аккаунта и запускает `codex login` / `claude /login`.

---

## 3. Токены и статистика — `lib/stats.js`, `.usage-cache.json`, session-JSONL

Остаток % красит кнопки (`tokenClass`: ≥50 зелёный / ≥16 жёлтый / <16 красный / `null` серый) и наполняет вкладку «Лимит». Остаток окна = `100 − max(used%)`.

| Что | Источник | Есть для |
|---|---|---|
| **Claude — остаток %/окна** | `<configDir>/.usage-cache.json` → `five_hour`/`seven_day` (`utilization`, `resets_at`); начало окна = `resets_at − 5ч/7д` (`stats.usageWindows`, `switcher.claudeTokensPct`) | Claude acc1/acc2 |
| **Claude — авто-наполнение кэша** | если `.usage-cache.json` нет/устарел (>10 мин): фоновой GET `https://api.anthropic.com/api/oauth/usage` с OAuth-токеном из `<configDir>/.credentials.json` (`claudeAiOauth.accessToken`) → пишем тот же файл. Нужно для headless-аккаунта (claude-acc2 гоняется `-p`, сам кэш не пишет). Истёкший токен → серый (refresh не реализован) | Claude acc1/acc2 |
| **Codex — остаток %/окна** | `<codexHome>/sessions/**/rollout-*.jsonl` (+`archived_sessions`), события `token_count` → `rate_limits.primary`(5ч)/`.secondary`(нед.): `used_percent`, `resets_at` (**UNIX-сек**). Берём свежайший непустой снапшот (новейший файл часто с null-окнами), кэш 30с (`switcher.latestCodexRateLimits/codexTokensPct/codexUsageWindows`) | Codex acc1/acc2 |
| **Расход** (input/output/cache/запросы) | `<configDir>/projects/**/*.jsonl`, поле `message.usage`; период по `timestamp` (`stats.spending`) | **только Claude** (Codex-расхода в этих логах нет) |
| **Стоимость $** | в сыром JSONL **нет** — показываем 0/опускаем | — |
| **Даты подписки** | источника нет → ручной ввод в `settings.subscriptions["claude:acc1"]={start,end}` (UI вкладка «Подписки») | ручками |
| **API-ключ профили — кнопка** | rollout/usage-cache у них нет (нет «остатка %») → кнопка серая | — |
| **API-ключ профили — расход** | `usage` из ответа провайдера (`prompt_tokens`/`completion_tokens`; стрим — `stream_options.include_usage`) → `lib/providers.normalizeUsage` → кумулятивно `lib/usage.js` в `rooms/.provider-usage.json` (gitignored). Записывается в `runRound`, показывается во вкладках «Расход»/«Лимиты» (пометка «нет окон-лимитов»), сброс — `POST /api/providers/usage/reset` | [Phase 5] любые сетевые профили (openai-compatible; Ollama usage обычно не шлёт → не считается) |
| **OpenRouter — квота пула** | OpenRouter «остаток» не отдаёт (`/api/v1/key` → $0/null для free), поэтому считаем СВОИ запросы per-key per-day в `rooms/.or-quota.json` (`lib/orquota.js`: bump/bump429/summary). Потолок авто: `is_free_tier`→50, иначе 1000 (опрос `/api/v1/key` при старте + каждые 10 мин, `server.refreshOrKeyCaps`). Панель «Агенты» (`renderProviderStatsPanel`): `K1 N/cap`, цвет по остатку, `⚠N`=пойманных 429 за день. Пул = все `OPENROUTER_API_KEY*`, ротация+failover на 429 (`server.openrouterKeyPool` / `providers.openrouterPool`, `result.usedRef`/`blockedRefs`) | OpenRouter (любое число ключей = аккаунтов) |

`configDir` (claude): acc1 = `%USERPROFILE%\.claude`, acc2 = `…\auth\claude-acc2` (`switcher.claudePaths()`).
`codexHome`: acc1 = `%USERPROFILE%\.codex`, acc2 = `…\auth\codex-acc2` (`switcher.codexPaths()`).
Раскрывашка тянет `GET /api/switcher/stats?period=today|week|all` (кэш 60с) → `{claude:{acc1,acc2}, codex:{acc1,acc2}, providers:{profileId→{label,inputTokens,outputTokens,totalTokens,requests,lastAt}}}`, claude/codex — `{windows, spending}`; `providers` отдаётся свежим (вне кэша, расход кумулятивный). Кнопка ↻ refresh (`POST /api/switcher/refresh`) шлёт мини-запрос («What is 1+3?») **по всем авторизованным аккаунтам** самой дешёвой моделью сервиса (Codex `gpt-5.4-mini` — с `--ephemeral`=off, чтобы записался rollout с `rate_limits`; Claude `haiku` — наполняет `.usage-cache.json`), затем форсит перечитку токен-источников (`switcher.refreshUsage()`: сброс throttle Claude-OAuth + сброс 30с-кэша Codex). Каждый пинг пишется в лог «Служебные события» (`kind:"process"`).

---

## 4. Council Room v2 — HTTP API (server.js)

- `GET /api/state`, `GET /api/events` (SSE: безымянное `data:` = state; именованное `event: stream` = live-stdout агентов в терминалы)
- runs: `/api/runs` (create), `/api/runs/switch|delete|archive|restore`
- subtasks: `/api/subtasks/open|resolve|freeze|edit|delete|reopen|trash|archive|restore`, `/api/subtasks/trash/empty`
- questions: `/api/questions/add|remove|priority`
- kb: `/api/kb/add|remove`
- documents: `/api/documents/add` ([6b] `{name,text}` → пишет в `documents.jsonl`, кэп 40K) `/remove` (`{id}`)
- round/autopilot: `/api/round`, `/api/autopilot/start|stop`
- switcher: `/api/switcher/login|refresh|stats|subscription`
- providers: `/api/providers/usage/reset` ([Phase 5] сброс кумулятивного расхода по API-профилям; `{profileId}` или пусто = все)
- providers: `/api/providers/key` ([Phase 5] прямой ввод API-ключа из UI: `{credentialRef, value}` → пишет/заменяет строку `credentialRef=value` в `ROOT/.env` (gitignored) через `env.setEnvVar` и сразу кладёт в `process.env`. Ключ **НЕ** попадает в `state.json` и **НЕ** возвращается в ответе; ответ = `{ok, credentials}` (только флаги keyPresent). Валидирует имя переменной `^[A-Za-z_][A-Za-z0-9_]*$`. Сбрасывает validated-флаг ключа. Альтернатива ручному редактированию `.env`.)
- providers: `/api/providers/test` ([Phase 5] живой тест ключа: `{provider, baseUrl, credentialRef, model, apiKey?}` → опц. сохраняет ключ в `.env`, шлёт мини-запрос («What is 1+3?»), при ответе помечает `credentialRef` как validated (`lib/validated.js` → `rooms/.validated-keys.json`, привязка к fingerprint значения ключа). Только сетевые провайдеры. Ответ `{ok, error, reply, credentials, validated}`. Драйвит галочку поля и цвет чипа: зелёный=validated, жёлтый=ключ есть но не проверен, серый=нет.)
- `/api/settings`
- Статика: `?v=__V__` → подставляется `BUILD_ID` (время старта сервера) → кэш всегда свежий; `Cache-Control: no-store`.

Состояние/настройки: `state.settings` (глобально, синхронизируется из run при активации через `applyRunSettings`) и `state.run.settings` (per-chat в state.json). Включение `allowFilesystemScan` авто-снимает `strictScope` (в одну сторону).
[Phase 5] Настройки могут содержать `profiles:[{id,label,provider,model,effort,account?,baseUrl?,credentialRef?}]` и `roles:{a,b}` (явная конфигурация спорщиков). Если заданы — переопределяют legacy codex/claude-поля (`profiles.effectiveConfig`). `/api/settings` валидирует `body.profiles`. [Phase 6] Настройки также могут содержать `participants:[{key,label,mode,profileIds[]|backend{...},verify?}]` (2–5 спорщиков) — если заданы (≥2), имеют приоритет над `roles{a,b}`; `effectiveConfig` отдаёт `participants[]` (slot=key: legacy `codex`/`claude`, новые `a1..a5`). [6b] участник может нести **inline backend** (`{provider,account,model,effort,baseUrl,credentialRef}`) вместо ссылки на реестр — так выбор для чата развязан с `settings.profiles`. `/api/settings` валидирует `body.participants` (`validateParticipants`: 2–5, уникальные ключи, у каждого либо непустые profileIds на существующие профили, либо валидный backend). [6b] дефолт `strictScope=true` (тумблер «Файлы вне scope» включён на новых чатах). [6b] **чистый лист:** `defaultRun` не копирует `participants` из `state.settings`, `applyRunSettings` зеркалит `participants` активного чата (очищает при отсутствии) → новый чат всегда без выбранных агентов. Вопрос закрывается когда ВСЕ участники его отметили (`questions.recordResolve(...,requiredKeys=partKeys)`). Ключи задаются именем env-переменной (`credentialRef`) — значение в `.env`/окружении, не в `state.json`; ключ можно либо вписать в `.env` руками, либо ввести прямо в UI (поле «API-ключ (прямой ввод)» → `POST /api/providers/key` пишет его в `.env`). `publicState().providers = {mode, presets, types, credentials{profileId→keyPresent}, validated{profileId→keyVerified}, usage{profileId→spend}}` для UI. `PROVIDERS_MODE` (env): `full` (CLI+switcher+OAuth) / `api` (только API-ключи + Ollama, CLI off).
localStorage клиента (глобальные UI-префы): `uiLang`, `scale`, `coachPos`, `terminalsCollapsed`, `panels` (раскрывашки), `statsTab`, `autoResolve`, `coachPinned`.

---

## 5. Внешние инструменты (C:\AI) и отложенное

- **CodeBurn** (`C:\AI\codeburn`, `codeburn-pr`) — отдельное Electron-трей-приложение (вкладки History/Yield/Dashboard/Optimize/Plan). Читает session-JSONL + зовёт **OAuth-usage API**:
  - Claude: `~/.claude/.credentials.json` → `https://api.anthropic.com/api/oauth/usage`
  - Codex: `~/.codex/auth.json` → `https://chatgpt.com/backend-api/wham/usage`
  - Наружу данные НЕ отдаёт (внутренний Electron IPC) → переиспользовать нельзя, только повторить логику.
- `C:\AI\jq.exe` — обработка JSON для статистики.
- `C:\AI\service_limit_table*.md` — карта источников от CodeBurn (env/auth-пути/regex лимитов).
- `C:\AI\claude2.bat`, `codex2.bat` — запуск CLI на 2-м аккаунте (env-обёртки).

### Сделано (был «следующий этап»)
- **Codex остаток %/окна** — БЕЗ внешних вызовов: читаем локальные rollout `rate_limits` (см. §3).
- **Claude остаток %** для headless-аккаунта — фоновой `oauth/usage` с токеном аккаунта (см. §3).

### Остаётся отложенным
- **Реальные даты подписки** обоих сервисов (сейчас ручками). Источник — `oauth/usage`/`wham/usage`
  возвращают окна лимитов, но не дату окончания подписки; её даёт `oauth/profile`
  (`subscription_created_at`, `has_claude_pro/max`) для Claude — можно добавить позже.
- **Token refresh** при истечении OAuth-токена (Claude fetch): сейчас истёкший → серый, пока CLI сам не обновит.
- **Codex через `wham/usage`** не нужен — rollout-файлы уже дают окна.
