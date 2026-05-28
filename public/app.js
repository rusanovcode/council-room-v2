const $ = (id) => document.getElementById(id);
let currentState = null;

// ---- i18n ----------------------------------------------------------------

const STRINGS = {
  ru: {
    "ui.newChat": "+ Новый чат",
    "ui.chats": "Чаты",
    "ui.subtaskStack": "Стек подзадач",
    "ui.status": "Статус",
    "ui.noActiveSubtask": "Нет активной подзадачи",
    "ui.resolve": "Закрыть",
    "ui.freeze": "Заморозить",
    "ui.trace": "Лог",
    "ui.traceSummary": "Служебные события",
    "ui.runRound": "▶ Запустить раунд",
    "ui.guidancePlaceholder": "Направление на следующий раунд (опц.)",
    "ui.knowledgeBase": "База знаний",
    "ui.settings": "Настройки",
    "ui.agentLanguage": "Язык агентов",
    "ui.allowScan": "Разрешить агентам сканировать файлы",
    "ui.confirmAllowScan": "Разрешить агентам читать файлы проекта?\n\nПо умолчанию агенты в изолированном режиме и не видят твой код. Включай только когда явно нужно сравнение с реальным проектом.",
    "ui.codexModel": "Модель Codex",
    "ui.codexEffort": "Codex effort",
    "ui.claudeModel": "Модель Claude",
    "ui.claudeEffort": "Claude effort",
    "ui.openNewSubtask": "Открыть новую подзадачу",
    "ui.editSubtask": "Редактировать подзадачу",
    "ui.openSubtaskHint": "Подзадача становится активной. Предыдущая (если была открыта) переходит в ожидание (pending).",
    "ui.title": "Постановка подзадачи",
    "ui.mode": "Режим",
    "ui.cancel": "Отмена",
    "ui.open": "Открыть",
    "ui.save": "Сохранить",
    "ui.editIcon": "Редактировать (доступно пока нет раундов)",
    "ui.deleteIcon": "Удалить (доступно пока нет раундов)",
    "ui.confirmDeleteSubtask": "Удалить подзадачу \"{title}\"? Раундов ещё не было.",
    "ui.idle": "ожидание",
    "ui.busy": "занят",
    "ui.runInProgress": "Раунд выполняется…",
    "ui.openFirstHint": "(нет подзадач — открой первую через +)",
    "ui.noActiveSubtaskHint": "Открой подзадачу слева, чтобы начать раунды.",
    "ui.subtaskMeta": "id {id} · режим {mode} · раунды {rounds}",
    "ui.tracePrefix": "Лог",
    "ui.confirmDelete": "Удалить чат \"{topic}\"?",
    "ui.confirmReopen": "Переоткрыть закрытую подзадачу?",
    "ui.askTopic": "Тема нового чата:",
    "ui.askSummary": "Резюме (опц.):",
    "ui.askReason": "Причина заморозки:",
    "ui.alertNoChat": "Сначала создай чат.",
    "ui.add": "+",
    "ui.addPlaceholder": "добавить в {label}…",
    "kb.decisions": "Решения",
    "kb.prohibitions": "Запреты",
    "kb.control_contract": "Контракт владения",
    "kb.files_in_scope": "Файлы в scope",
    "kb.files_out_of_scope": "Файлы вне scope",
    "kb.verification_commands": "Верификация",
    "kb.open_questions": "Открытые вопросы",
    "tip.councilRoom": "Локальная комната дебатов между двумя AI-агентами (Codex и Claude).\nЦель: довести каждую открытую подзадачу до закрытого решения, не дрейфуя в стороны.|||тема чата «Phase 2 v2: autopilot loop». Внутри 4 подзадачи: «стоп-условие», «UI терминалов», «handoff», «таймаут». Каждая закрывается отдельно — общая тема нигде целиком не обсуждается.",
    "tip.subtaskStack": "Каждая подзадача — изолированный мини-дебат. Активная одна.\nВ промт агентам отправляется ТОЛЬКО она + база знаний — не вся история чата. Это главная экономия токенов.|||открыто: «выбрать stop-condition для autopilot». После закрытия открываешь следующую: «формат логов терминалов». Агенты НЕ видят первую — только KB-итоги.",
    "tip.openSubtask": "Открыть новую подзадачу. Предыдущая активная уходит в ожидание (pending).|||название: «выбрать stop-condition для autopilot». Режим: STANDARD. Через 3 раунда оба агента дают Статус: готова к закрытию (Status: resolve) — закрываешь.",
    "tip.openSubtaskModal": "Подзадача становится активной — следующий «▶ Запустить раунд» будет уже по ней.\nПредыдущая активная (если была) переходит в ожидание (pending) — её можно вернуть кликом в списке.\nПока по подзадаче не было раундов, её название и режим можно редактировать (✎) или удалить (×).|||открыл подзадачу «выбрать stop-condition» по ошибке вместо «выбрать UI терминалов» — пока не запускал раунд, можешь нажать ✎ и переписать название.",
    "tip.subtaskTitle": "Одно короткое предложение — что именно дебатируем. Не общая тема, а конкретный вопрос с ожидаемым ответом.|||плохо: «autopilot». Лучше: «выбрать stop-condition для autopilot». Идеально: «stop-condition: stale×2 или token<25% — что приоритетнее?»",
    "tip.knowledgeBase": "Единая база собранных правил по этому чату.\nАгенты добавляют пункты через строку KB-patch: в конце ответа. Можно править вручную.\nСнапшот KB шлётся в каждый промт вместо растущей истории.|||Codex в ответе пишет «KB-patch: prohibitions: не использовать PowerShell для codex CLI». Сервер парсит и кладёт в секцию Запреты. В следующем раунде эта строка уже в промте обоих.",
    "tip.resolve": "Закрыть активную подзадачу. Она исчезает из ленты, остаётся в стеке как закрытая (resolved).|||оба агента сообщили Статус: готова к закрытию (Status: resolve), KB пополнен 3 пунктами — жмёшь «Закрыть», вводишь короткое резюме («stop = stale×2 OR token<25%»).",
    "tip.freeze": "Заморозить подзадачу с причиной. Не закрыта, но временно не дебатируется.|||подзадача «выбор UI-библиотеки» — ждёт пока пользователь сравнит варианты. Причина: «жду решения пользователя по vanilla vs preact».",
    "tip.runRound": "Один синхронный раунд: Codex и Claude отвечают параллельно ПО АКТИВНОЙ подзадаче.\nРеализацию не запускает, файлы не меняет (read-only debate).|||жмёшь «▶ Запустить раунд». Через 30-90 секунд в ленте два новых сообщения: Codex и Claude, каждое заканчивается хвостом «New facts / risks / alternatives / Status / KB-patch».",
    "tip.trace": "Служебные сообщения (запуск CLI, KB-патчи и т.п.).\nСкрыты из обычной ленты, чтобы не засорять её.|||«Раунд 3 (subtask st_5a625327): запуск Codex и Claude параллельно. Codex prompt 1842 chars, Claude prompt 1842 chars.» — техническая запись, не для чтения.",
    "tip.mode": "LIGHT — хотфикс ≤3 файлов, без дебатов.\nSTANDARD — обычная фича, 2–4 раунда.\nSTRICT — критичные системы, 4–8 раундов.\nCRITICAL — прод/финансы, 6–10 раундов + независимый аудит.|||смена цвета кнопки → LIGHT. Новый эндпоинт API → STANDARD. Переезд auth-логики → STRICT. Миграция платёжной БД → CRITICAL.",
    "tip.langToggle": "Переключить язык интерфейса (RU ⇄ EN). Также влияет на язык ответов агентов.|||клик на «RU» → весь UI становится английским, агенты в следующем раунде ответят по-английски.",
    "tip.fontUp": "Увеличить размер интерфейса (текст + контролы). Масштаб сохраняется между запусками.|||при работе на 4K-мониторе или с расстояния — нажми A+ 2-3 раза.",
    "tip.fontDown": "Уменьшить размер интерфейса (текст + контролы). Масштаб сохраняется между запусками.|||на ноутбуке хочется больше информации на экране — нажми A− чтобы все панели сжались.",
    "tip.allowScan": "По умолчанию ВЫКЛЮЧЕНО — это важно.\n\nКогда выключено:\n• агенты сидят в пустой sandbox-папке без доступа к твоему коду;\n• в промт добавляется жёсткий блок «не сканировать, не читать файлы, не подстраиваться под структуру проекта»;\n• Codex --cd указывает на rooms/_sandbox; Claude запускается с --tools \"\" (без файловых тулзов).\n\nВключай ТОЛЬКО если осознанно хочешь чтобы агенты прочитали твой проект — например для сравнения архитектуры или ревью кода. После завершения такого обсуждения выключай обратно.|||тебе нужно сравнить дизайн нового модуля с тем что уже есть в C:\\AI\\my-project. Включаешь чекбокс → запускаешь раунд → агенты читают файлы → закрываешь подзадачу → выключаешь чекбокс обратно.",
    "tip.agentLanguage": "На каком языке Codex и Claude должны писать ответы. Можно отличаться от языка интерфейса.|||интерфейс RU, агенты EN — полезно когда копируешь их ответы в код-комментарии или в англоязычный PR.",
    "tip.model": "Точное имя модели для CLI.\n\nauto = выбор из конфига CLI (~/.codex/config.toml или ~/.claude/settings.json).\n\nАлиасы Claude (opus/sonnet/haiku) — короткие имена, которые CLI разворачивает в ПОСЛЕДНЮЮ версию линейки. Авто-апгрейдятся, когда Anthropic выпустит новую версию.\n\nТочные имена (claude-opus-4-7, gpt-5.5) — закрепляют конкретную версию. Полезно для воспроизводимости.|||opus → сейчас claude-opus-4-7, через полгода может стать claude-opus-4-8 без правки настроек.\nclaude-opus-4-7 — закреплено навсегда.",
    "tip.effort": "Уровень reasoning (сколько модель «думает» перед ответом).\n\nauto — настройки CLI по умолчанию.\nlow — быстро и дёшево, для простых вопросов.\nmedium — баланс.\nhigh — медленнее и дороже, заметно точнее.\nxhigh — ещё медленнее, для архитектурных решений.\nmax — только Claude, максимум reasoning (security/compliance).|||тривиальный фикс → low. Выбор библиотеки → medium. Дизайн API → high. Подбор алгоритма безопасности → max (Claude) / xhigh (Codex).",
    "tip.kb.decisions": "Фиксированные решения по архитектуре/процессу (decision freeze). Не пересматриваются без явного rationale.|||«codex запускать только через cmd.exe — PowerShell даёт shell_snapshot ошибку».",
    "tip.kb.prohibitions": "Что нельзя трогать/использовать. Каждый пункт с причиной (файл, команда, библиотека).|||«не трогать C:\\AI\\game_agent — отдельный проект, своя сессия».\n«не добавлять retry на shell_snapshot — это deny event, не switch trigger».",
    "tip.kb.control_contract": "Кто что владеет: компонент → ответственный агент → команда верификации.|||«server.js → оба → node --check server.js → PASS/FAIL».\n«subtasks.jsonl → runtime agent → read-only в дебате».",
    "tip.kb.files_in_scope": "Список файлов, которые разрешено менять в этой задаче.|||«C:\\AI\\Council Room v2\\server.js».\n«C:\\AI\\Council Room v2\\lib\\cli.js».",
    "tip.kb.files_out_of_scope": "Файлы и директории, которые не трогать.|||«C:\\AI\\Council Room\\* — старая версия, отдельный сервер на 8787».\n«C:\\AI\\ai-switcher\\auth\\* — auth-токены».",
    "tip.kb.verification_commands": "Команды copy-paste, по которым проверяется PASS/FAIL фазы.|||«node --check server.js».\n«curl -s http://localhost:8788/api/state | python -m json.tool».",
    "tip.kb.open_questions": "Нерешённые вопросы. BLOCKING блокируют gate, RESEARCH можно откладывать.|||«[BLOCKING] какой порт использовать когда 8788 занят?»\n«[RESEARCH] стоит ли вынести KB в SQLite вместо markdown?»",
    "coach.step1.title": "Шаг 1: создай чат",
    "coach.step1.body": "Слева сверху нажми «+ Новый чат» и введи короткую тему — например, «Phase 2 v2».",
    "coach.step1.action": "Создать чат",
    "coach.step2.title": "Шаг 2: открой первую подзадачу",
    "coach.step2.body": "Дебат всегда идёт по ОДНОЙ подзадаче. Слева в блоке «Стек подзадач» нажми + и опиши одно конкретное обсуждение (например: «выбрать stop-condition для autopilot»). Это ключ к экономии токенов.",
    "coach.step2.action": "Открыть подзадачу",
    "coach.step3.title": "Шаг 3: запусти первый раунд",
    "coach.step3.body": "Внизу нажми «▶ Запустить раунд». Codex и Claude параллельно ответят по активной подзадаче — без чтения всей истории чата.\n\nGuidance сверху textarea — опционально (направить агентов).",
    "coach.step3.action": "Запустить раунд",
    "coach.busy.title": "Раунд выполняется",
    "coach.busy.body": "Codex и Claude отвечают параллельно. Логи раунда пишутся в rooms/<id>/R{N}-<subtask>-{codex,claude}.log",
    "coach.stale.title": "Дебат не движется",
    "coach.stale.body": "Оба агента не дали новых facts/risks/alternatives. Варианты:\n• введи направление в окно guidance и запусти ещё раунд;\n• закрой подзадачу через «Закрыть»;\n• ручной патч в Knowledge Base.",
    "coach.stale.action": "Сфокусироваться на guidance",
    "coach.resolveReady.title": "Можно закрыть подзадачу",
    "coach.resolveReady.body": "Оба агента сообщили Статус: готова к закрытию (Status: resolve). Нажми «Закрыть» в шапке центра.",
    "coach.resolveReady.action": "Закрыть подзадачу",
    "coach.block.title": "Требуется твоё решение",
    "coach.block.body": "Один из агентов сообщил Статус: заблокирован (Status: block). Перечитай его сообщение, добавь нужный факт в Базу знаний (справа) или дай направление в окошке guidance и запусти раунд.",
    "coach.allDone.title": "Все подзадачи закрыты",
    "coach.allDone.body": "Knowledge Base собрана. Следующий шаг — handoff к исполнителю (Phase 4 в разработке: кнопки Spawn / Copy prompt).",
    "coach.runRound.title": "Готов к следующему раунду",
    "coach.runRound.body": "Можешь запустить ещё раунд или закрыть подзадачу, если решение собрано. В Knowledge Base уже добавлено: {kbCount} пункт(а).",
    "coach.runRound.action": "Запустить раунд",
    "ui.autopilotStart": "Autopilot ▶",
    "ui.autopilotStop": "⏹ Стоп",
    "ui.autoResolve": "Авто-закрытие",
    "ui.terminals": "Терминалы агентов",
    "ui.termCodex": "Codex",
    "ui.termClaude": "Claude",
    "ui.autopilotStartedHint": "Autopilot работает…",
    "ui.pinHint": "Закрепить подсказку внизу",
    "ui.unfoldHint": "Развернуть обратно в плавающее окно",
    "ui.strictScope": "Строгий scope: всё вне «Файлы в scope» — запрещено",
    "tip.strictScope": "Спец-режим. Когда включён (☑): всё, что НЕ перечислено в секции «Файлы в scope», автоматически считается вне scope, и агентам СТРОГО запрещено это трогать.\nВ промт добавляется жёсткое правило-дополнение (complement). Удобно, когда проще перечислить разрешённое, чем запрещённое.|||в «Файлы в scope» три файла. Включаешь ☑ — агенты понимают: любой другой файл/папку проекта трогать нельзя, даже если он не указан явно в «Файлы вне scope».",
    "tip.stopStatus": "Остановить — прервать текущий процесс. Раунд обрывается кооперативно (агенты в терминалах останавливаются), частичный результат отбрасывается.",
    "tip.autopilot": "Автопилот: Codex и Claude пинг-понгуют по активной подзадаче без участия пользователя.\nЦикл сам останавливается по стоп-условию: оба resolve, два «пустых» раунда подряд (stale×2), block, или достигнут лимит раундов по режиму (LIGHT 3 / STANDARD 6 / STRICT 10 / CRITICAL 12).\nНажми ещё раз (⏹ Стоп), чтобы прервать — текущий раунд обрывается кооперативно.|||открыта подзадача в режиме STANDARD. Жмёшь «Autopilot ▶» — идут раунды 1,2,3… На 4-м оба агента дают Status: resolve → loop стоп с «debate-complete», coach предлагает «Закрыть».",
    "tip.autoResolve": "Когда включено и автопилот ловит debate-complete (оба resolve) — подзадача закрывается автоматически с кратким резюме из Базы знаний, без лишнего вызова агента.\nКогда выключено (по умолчанию) — автопилот просто останавливается, а закрываешь ты сам (с собственным резюме).|||галка снята: на debate-complete loop стопится, ты пишешь резюме «stop = stale×2 OR token<25%» и жмёшь «Закрыть». Галка стоит: loop сам резолвит и пишет резюме из секции Решения.",
    "tip.terminals": "Live-вывод (stdout+stderr) обоих агентов во время раунда.\nОчищается в начале каждого раунда. Раскрывашка ▾/▴ сворачивает панель; состояние сохраняется между запусками.|||во время autopilot-раунда видишь как Codex стримит рассуждения слева, Claude — справа. Полезно чтобы понять, завис агент или думает.",
    "coach.autopilot.title": "Autopilot работает",
    "coach.autopilot.body": "Codex и Claude идут раунд за раундом по активной подзадаче. Остановится сам по стоп-условию (оба resolve / stale×2 / block / лимит раундов). Можешь прервать в любой момент.",
    "coach.autopilot.action": "⏹ Остановить autopilot",
  },
  en: {
    "ui.newChat": "+ New chat",
    "ui.chats": "Chats",
    "ui.subtaskStack": "Subtask Stack",
    "ui.status": "Status",
    "ui.noActiveSubtask": "No active subtask",
    "ui.resolve": "Resolve",
    "ui.freeze": "Freeze",
    "ui.trace": "Trace",
    "ui.traceSummary": "Process trace (system events)",
    "ui.runRound": "▶ Run round",
    "ui.guidancePlaceholder": "Steer the next round (optional)",
    "ui.knowledgeBase": "Knowledge Base",
    "ui.settings": "Settings",
    "ui.agentLanguage": "Agent language",
    "ui.allowScan": "Allow agents to scan files",
    "ui.confirmAllowScan": "Allow agents to read project files?\n\nBy default agents run in isolated mode and do not see your code. Enable only when you explicitly want a comparison with the real project.",
    "ui.codexModel": "Codex model",
    "ui.codexEffort": "Codex effort",
    "ui.claudeModel": "Claude model",
    "ui.claudeEffort": "Claude effort",
    "ui.openNewSubtask": "Open new subtask",
    "ui.editSubtask": "Edit subtask",
    "ui.openSubtaskHint": "This subtask becomes active. The previous active one (if any) moves to pending.",
    "ui.title": "Subtask statement",
    "ui.mode": "Mode",
    "ui.cancel": "Cancel",
    "ui.open": "Open",
    "ui.save": "Save",
    "ui.editIcon": "Edit (available until first round)",
    "ui.deleteIcon": "Delete (available until first round)",
    "ui.confirmDeleteSubtask": "Delete subtask \"{title}\"? No rounds yet.",
    "ui.idle": "idle",
    "ui.busy": "busy",
    "ui.runInProgress": "Round in progress…",
    "ui.openFirstHint": "(no subtasks — open the first one via +)",
    "ui.noActiveSubtaskHint": "Open a subtask on the left to start rounds.",
    "ui.subtaskMeta": "id {id} · mode {mode} · rounds {rounds}",
    "ui.tracePrefix": "Trace",
    "ui.confirmDelete": "Delete chat \"{topic}\"?",
    "ui.confirmReopen": "Re-open a resolved subtask?",
    "ui.askTopic": "New chat topic:",
    "ui.askSummary": "Summary (optional):",
    "ui.askReason": "Freeze reason:",
    "ui.alertNoChat": "Create a chat first.",
    "ui.add": "+",
    "ui.addPlaceholder": "add to {label}…",
    "kb.decisions": "Decisions",
    "kb.prohibitions": "Prohibitions",
    "kb.control_contract": "Control Contract",
    "kb.files_in_scope": "Files in Scope",
    "kb.files_out_of_scope": "Files Out of Scope",
    "kb.verification_commands": "Verification",
    "kb.open_questions": "Open Questions",
    "tip.councilRoom": "Local debate room between two AI agents (Codex and Claude).\nGoal: drive every opened subtask to a closed decision, without drifting sideways.|||chat topic “Phase 2 v2: autopilot loop”. Inside it: 4 subtasks — “stop condition”, “terminal UI”, “handoff”, “timeout”. Each is closed separately; the umbrella topic is never debated as a whole.",
    "tip.subtaskStack": "Each subtask is an isolated mini-debate. One active at a time.\nThe agent prompt receives ONLY the active subtask + KB snapshot — not the whole chat history. This is the main token economy.|||open: “pick stop-condition for autopilot”. Once closed, you open the next: “terminal log format”. Agents do NOT see the first one — only the KB-rolled outcomes.",
    "tip.openSubtask": "Open a new subtask. The previous active one moves to pending.|||title: “pick stop-condition for autopilot”. Mode: STANDARD. After 3 rounds both agents return Status: resolve — you close it.",
    "tip.openSubtaskModal": "The subtask becomes active — the next “▶ Run round” will target it.\nThe previous active one (if any) moves to pending — you can return to it by clicking it in the list.\nUntil any round has been run, the title and mode are editable (✎) and the subtask can be deleted (×).|||you opened “pick stop-condition” by mistake instead of “pick terminal UI” — while no round has run yet, click ✎ and rewrite the title.",
    "tip.subtaskTitle": "One short sentence — what specifically you're debating. Not a broad topic, but a concrete question with an expected answer.|||bad: “autopilot”. Better: “pick stop-condition for autopilot”. Best: “stop-condition: stale×2 or token<25% — which takes priority?”",
    "tip.knowledgeBase": "Single accumulator of agreed rules for this chat.\nAgents add items via the KB-patch: line at the end of their answer. Editable manually.\nKB snapshot is sent in every prompt instead of a growing transcript.|||Codex ends its answer with “KB-patch: prohibitions: don't use PowerShell for codex CLI”. The server parses it and pushes into the Prohibitions section. Next round both agents see this line in the prompt.",
    "tip.resolve": "Resolve the active subtask. It disappears from the feed, stays in the stack as resolved.|||both agents returned Status: resolve, KB got 3 new items — you click Resolve and type a short summary (“stop = stale×2 OR token<25%”).",
    "tip.freeze": "Freeze the subtask with a reason. Not closed, but paused from debate.|||subtask “pick UI library” — waiting for the user to compare options. Reason: “awaiting user decision on vanilla vs preact”.",
    "tip.runRound": "One synchronous round: Codex and Claude answer in parallel ON THE ACTIVE subtask.\nDoes not run implementation, does not modify files (read-only debate).|||click ▶ Run round. After 30-90 seconds, two new messages appear: Codex and Claude, each ending with “New facts / risks / alternatives / Status / KB-patch”.",
    "tip.trace": "System messages (CLI launch, KB patches, etc.).\nHidden from the main feed to keep it clean.|||“Round 3 (subtask st_5a625327): Codex and Claude launched in parallel. Codex prompt 1842 chars, Claude prompt 1842 chars.” — a technical record, not for reading.",
    "tip.mode": "LIGHT — hotfix ≤3 files, no debate.\nSTANDARD — normal feature, 2–4 rounds.\nSTRICT — critical systems, 4–8 rounds.\nCRITICAL — production/finance, 6–10 rounds + independent audit.|||recoloring a button → LIGHT. New API endpoint → STANDARD. Moving auth logic → STRICT. Migrating the payments DB → CRITICAL.",
    "tip.langToggle": "Toggle interface language (RU ⇄ EN). Also drives agent answer language.|||click EN → the whole UI becomes Russian, agents will answer in Russian on the next round.",
    "tip.fontUp": "Increase interface size (text + controls). Scale is persisted between sessions.|||working on a 4K display or from a distance — hit A+ 2-3 times.",
    "tip.fontDown": "Decrease interface size (text + controls). Scale is persisted between sessions.|||on a laptop you want more info on screen — hit A− to shrink all panels.",
    "tip.allowScan": "OFF by default — this matters.\n\nWhen OFF:\n• agents run in an empty sandbox folder with no access to your code;\n• the prompt gets a hard “do not scan, do not read files, do not tailor the answer to project structure” block;\n• Codex --cd points at rooms/_sandbox; Claude is launched with --tools \"\" (no file tools).\n\nTurn ON only when you intentionally want agents to read your project — e.g. for architecture comparison or code review. Turn back OFF after that subtask is done.|||you want to compare a new module's design with what already exists in C:\\AI\\my-project. Tick the box → run a round → agents read files → resolve the subtask → uncheck the box.",
    "tip.agentLanguage": "Which language Codex and Claude should answer in. Can differ from the UI language.|||interface EN, agents RU — useful when you copy their answers into Russian-language docs or PRs.",
    "tip.model": "Exact model name for the CLI.\n\nauto = use CLI default (~/.codex/config.toml or ~/.claude/settings.json).\n\nClaude aliases (opus/sonnet/haiku) — short names that the CLI resolves to the LATEST version of the family. Auto-upgrade when Anthropic releases a new version.\n\nExplicit names (claude-opus-4-7, gpt-5.5) — pin a specific version. Useful for reproducibility.|||opus → now resolves to claude-opus-4-7, in six months may become claude-opus-4-8 without any config change.\nclaude-opus-4-7 — pinned forever.",
    "tip.effort": "Reasoning effort (how long the model thinks before answering).\n\nauto — CLI defaults.\nlow — fast and cheap, for simple questions.\nmedium — balanced.\nhigh — slower and more expensive, noticeably more accurate.\nxhigh — even slower, for architectural decisions.\nmax — Claude only, maximum reasoning (security/compliance).|||trivial fix → low. Library choice → medium. API design → high. Security algorithm pick → max (Claude) / xhigh (Codex).",
    "tip.kb.decisions": "Frozen architecture/process decisions (decision freeze). Not reopened without explicit rationale.|||“Launch codex only via cmd.exe — PowerShell triggers a shell_snapshot error”.",
    "tip.kb.prohibitions": "What must not be touched/used. Each item with a reason (file, command, library).|||“don't touch C:\\AI\\game_agent — separate project, own session”.\n“don't add retry on shell_snapshot — it's a deny event, not a switch trigger”.",
    "tip.kb.control_contract": "Who owns what: component → responsible agent → verification command.|||“server.js → both → node --check server.js → PASS/FAIL”.\n“subtasks.jsonl → runtime agent → read-only during debate”.",
    "tip.kb.files_in_scope": "Files that are allowed to change in this task.|||“C:\\AI\\Council Room v2\\server.js”.\n“C:\\AI\\Council Room v2\\lib\\cli.js”.",
    "tip.kb.files_out_of_scope": "Files and directories that must not be touched.|||“C:\\AI\\Council Room\\* — old version, separate server on 8787”.\n“C:\\AI\\ai-switcher\\auth\\* — auth tokens”.",
    "tip.kb.verification_commands": "Copy-paste commands that prove PASS/FAIL of the phase.|||“node --check server.js”.\n“curl -s http://localhost:8788/api/state | python -m json.tool”.",
    "tip.kb.open_questions": "Unresolved questions. BLOCKING ones block the gate, RESEARCH ones can be deferred.|||“[BLOCKING] which port to use when 8788 is taken?”\n“[RESEARCH] should we move KB into SQLite instead of markdown?”",
    "coach.step1.title": "Step 1: create a chat",
    "coach.step1.body": "Top-left, click «+ New chat» and type a short topic — for example «Phase 2 v2».",
    "coach.step1.action": "Create chat",
    "coach.step2.title": "Step 2: open the first subtask",
    "coach.step2.body": "Debate always runs on ONE subtask. In the «Subtask Stack» block on the left, click + and describe one concrete discussion (for example «pick stop-condition for autopilot»). This is the key to token economy.",
    "coach.step2.action": "Open subtask",
    "coach.step3.title": "Step 3: run the first round",
    "coach.step3.body": "At the bottom, click «▶ Run round». Codex and Claude answer in parallel on the active subtask — without re-reading the whole chat history.\n\nThe guidance textarea above is optional (to steer the agents).",
    "coach.step3.action": "Run round",
    "coach.busy.title": "Round in progress",
    "coach.busy.body": "Codex and Claude are answering in parallel. Round logs go to rooms/<id>/R{N}-<subtask>-{codex,claude}.log",
    "coach.stale.title": "Debate stuck",
    "coach.stale.body": "Both agents reported no new facts/risks/alternatives. Options:\n• type a guidance steer and run another round;\n• resolve the subtask via «Resolve»;\n• edit Knowledge Base manually.",
    "coach.stale.action": "Focus guidance",
    "coach.resolveReady.title": "Ready to resolve",
    "coach.resolveReady.body": "Both agents reported Status: resolve. Click «Resolve» in the center header.",
    "coach.resolveReady.action": "Resolve subtask",
    "coach.block.title": "Decision needed from you",
    "coach.block.body": "One of the agents returned Status: block. Re-read its message, add the missing fact into the Knowledge Base (right) or provide guidance and run another round.",
    "coach.allDone.title": "All subtasks resolved",
    "coach.allDone.body": "Knowledge Base is collected. Next step — handoff to the executor (Phase 4 WIP: Spawn / Copy prompt buttons).",
    "coach.runRound.title": "Ready for next round",
    "coach.runRound.body": "You can run another round or resolve the subtask if the decision is collected. Knowledge Base already has {kbCount} item(s).",
    "coach.runRound.action": "Run round",
    "ui.autopilotStart": "Autopilot ▶",
    "ui.autopilotStop": "⏹ Stop",
    "ui.autoResolve": "Auto-resolve",
    "ui.terminals": "Agent terminals",
    "ui.termCodex": "Codex",
    "ui.termClaude": "Claude",
    "ui.autopilotStartedHint": "Autopilot running…",
    "ui.pinHint": "Pin this hint at the bottom",
    "ui.unfoldHint": "Expand back into the floating panel",
    "ui.strictScope": "Strict scope: everything outside «Files in Scope» is forbidden",
    "tip.strictScope": "Special mode. When on (☑): everything NOT listed in the «Files in Scope» section is automatically considered out of scope, and agents are STRICTLY forbidden to touch it.\nA hard complement rule is injected into the prompt. Handy when it's easier to list what's allowed than what's forbidden.|||«Files in Scope» has three files. Turn on ☑ — agents understand any other project file/folder must not be touched, even if not explicitly listed in «Files Out of Scope».",
    "tip.stopStatus": "Stop — interrupt the current process. The round is cancelled cooperatively (agents in the terminals stop), the partial result is discarded.",
    "tip.autopilot": "Autopilot: Codex and Claude ping-pong on the active subtask without you.\nThe loop stops on its own when a stop-condition fires: both resolve, two stale rounds in a row (stale×2), block, or the per-mode round budget is hit (LIGHT 3 / STANDARD 6 / STRICT 10 / CRITICAL 12).\nClick again (⏹ Stop) to interrupt — the current round is cancelled cooperatively.|||a STANDARD-mode subtask is open. You click «Autopilot ▶» — rounds 1,2,3 run. On round 4 both agents return Status: resolve → loop stops with «debate-complete», coach suggests «Resolve».",
    "tip.autoResolve": "When on and autopilot hits debate-complete (both resolve), the subtask is closed automatically with a short summary from the Knowledge Base — no extra agent call.\nWhen off (default) the autopilot just stops and you resolve it yourself (with your own summary).|||unchecked: on debate-complete the loop stops, you type a summary «stop = stale×2 OR token<25%» and click «Resolve». Checked: the loop resolves it itself with a summary built from the Decisions section.",
    "tip.terminals": "Live output (stdout+stderr) of both agents during a round.\nCleared at the start of each round. The ▾/▴ toggle collapses the panel; the state is persisted between sessions.|||during an autopilot round you watch Codex stream its reasoning on the left, Claude on the right. Useful to tell whether an agent is stuck or thinking.",
    "coach.autopilot.title": "Autopilot running",
    "coach.autopilot.body": "Codex and Claude are going round after round on the active subtask. It stops on its own at a stop-condition (both resolve / stale×2 / block / round budget). You can interrupt anytime.",
    "coach.autopilot.action": "⏹ Stop autopilot",
  },
};

let UI_LANG = localStorage.getItem("council-room-v2.uiLang") || "ru";
let UI_SCALE = parseFloat(localStorage.getItem("council-room-v2.scale")) || 1.0;
const SCALE_MIN = 0.7;
const SCALE_MAX = 1.6;
const SCALE_STEP = 0.1;

function applyScale() {
  // CSS zoom scales fonts and layout proportionally — same as browser zoom but UI-local
  document.body.style.zoom = String(UI_SCALE);
  try { localStorage.setItem("council-room-v2.scale", String(UI_SCALE)); } catch {}
}
function bumpScale(delta) {
  UI_SCALE = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round((UI_SCALE + delta) * 100) / 100));
  applyScale();
}
const t = (key, vars = {}) => {
  const dict = STRINGS[UI_LANG] || STRINGS.ru;
  let value = dict[key] || STRINGS.ru[key] || key;
  for (const [k, v] of Object.entries(vars)) value = value.replace(`{${k}}`, v);
  return value;
};

function applyLanguage() {
  document.documentElement.lang = UI_LANG;
  $("langToggle").textContent = UI_LANG === "ru" ? "RU" : "EN";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-tooltip-key]").forEach((el) => {
    const key = el.dataset.tooltipKey;
    // Map: data-tooltip-key="t.foo" → look up "tip.foo"
    const tip = key.startsWith("t.") ? t(`tip.${key.slice(2)}`) : t(key);
    el.setAttribute("aria-label", tip);
    el.dataset.tooltipText = tip;
  });
  render();
}

// ---- Floating tooltip ----------------------------------------------------

let tooltipEl = null;
function showTooltip(text, anchor) {
  hideTooltip();
  if (!text) return;
  tooltipEl = document.createElement("div");
  tooltipEl.className = `tooltip-floating lang-${UI_LANG}`;
  const [main, example] = String(text).split("|||");
  const textDiv = document.createElement("div");
  textDiv.className = "tt-text";
  textDiv.textContent = main || "";
  tooltipEl.appendChild(textDiv);
  if (example && example.trim()) {
    const exampleDiv = document.createElement("div");
    exampleDiv.className = "tt-example";
    exampleDiv.textContent = example.trim();
    tooltipEl.appendChild(exampleDiv);
  }
  document.body.appendChild(tooltipEl);
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const gap = 6;
  const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
  const spaceAbove = rect.top - margin - gap;
  const fullH = tooltipEl.offsetHeight;
  // Prefer below; flip above if it doesn't fit; if neither fits, use the larger side.
  let placeAbove;
  if (fullH <= spaceBelow) placeAbove = false;
  else if (fullH <= spaceAbove) placeAbove = true;
  else placeAbove = spaceAbove > spaceBelow;
  const avail = placeAbove ? spaceAbove : spaceBelow;
  // Cap height to the chosen side so the tooltip never overlaps the anchor button.
  if (fullH > avail) tooltipEl.style.maxHeight = `${Math.max(60, avail)}px`;
  const tipRect = tooltipEl.getBoundingClientRect();
  let top = placeAbove ? rect.top - tipRect.height - gap : rect.bottom + gap;
  let left = rect.left;
  if (left + tipRect.width > window.innerWidth - 10) left = window.innerWidth - tipRect.width - 10;
  if (left < 6) left = 6;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}
function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

// Pin the current next-step coach (lightbulb) guidance into the docked bottom panel.
function pinCoach() {
  const step = computeNextStep();
  const panel = $("pinnedHint");
  const body = $("pinnedHintBody");
  if (!step || !panel || !body) return;
  $("pinnedHintTitle").textContent = step.title;
  body.innerHTML = "";
  const textDiv = document.createElement("div");
  textDiv.className = "tt-text";
  textDiv.textContent = step.body;
  body.appendChild(textDiv);
  panel.classList.remove("hidden");
  coachPinned = true;
  renderNextStep();
}

// Pin button on the docked panel → restore the floating coach (unfold).
function unpinCoach() {
  $("pinnedHint").classList.add("hidden");
  coachPinned = false;
  nextStepDismissed = false;
  renderNextStep();
}

// Close (×) on the docked panel → fully close; floating stays dismissed (💡 reopen remains).
function closeCoachPinned() {
  $("pinnedHint").classList.add("hidden");
  coachPinned = false;
  nextStepDismissed = true;
  renderNextStep();
}

function bindTooltipDelegation() {
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-tooltip-key]");
    if (!target) return;
    showTooltip(target.dataset.tooltipText || "", target);
  });
  document.addEventListener("mouseout", (event) => {
    if (event.target.closest("[data-tooltip-key]")) hideTooltip();
  });
  document.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("blur", hideTooltip);
}

// ---- API + SSE -----------------------------------------------------------

async function api(method, path, body) {
  const opts = { method, headers: { "content-type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const response = await fetch(path, opts);
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}`);
  if (response.headers.get("content-type")?.includes("application/json")) return response.json();
  return null;
}

const TERM_CAP = 40000; // chars per pinned terminal
const termBuffers = { codex: "", claude: "" };

function appendTerminal(agent, chunk, reset) {
  const el = agent === "codex" ? $("termCodex") : $("termClaude");
  if (!el) return;
  if (reset) {
    termBuffers[agent] = "";
  } else {
    termBuffers[agent] = (termBuffers[agent] + chunk).slice(-TERM_CAP);
  }
  el.textContent = termBuffers[agent];
  el.scrollTop = el.scrollHeight;
  updateTerminalsVisibility();
}

// Hide the terminals section entirely while there's nothing to show (no buffered
// output and no round in progress).
function updateTerminalsVisibility() {
  const section = $("terminals");
  if (!section) return;
  const hasContent = Boolean(termBuffers.codex.trim() || termBuffers.claude.trim());
  const show = hasContent || Boolean(currentState && currentState.busy);
  section.classList.toggle("empty", !show);
}

function connectEvents() {
  const source = new EventSource("/api/events");
  source.onmessage = (event) => {
    try {
      currentState = JSON.parse(event.data);
      render();
    } catch (error) {
      console.error("SSE parse failed", error);
    }
  };
  source.addEventListener("stream", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.agent !== "codex" && data.agent !== "claude") return;
      appendTerminal(data.agent, data.chunk || "", Boolean(data.reset));
    } catch (error) {
      console.error("SSE stream parse failed", error);
    }
  });
  source.onerror = () => {
    setTimeout(connectEvents, 2000);
    source.close();
  };
}

// ---- Render --------------------------------------------------------------

function render() {
  if (!currentState) return;
  renderRuns();
  renderStatus();
  renderSubtasks();
  renderActiveSubtask();
  renderConversation();
  renderKnowledge();
  renderSettings();
  renderNextStep();
  updateTerminalsVisibility();
  $("cliInfo").textContent = currentState.cli
    ? `codex: ${currentState.cli.codex}\nclaude: ${currentState.cli.claude}\nworkdir: ${currentState.workdir}`
    : "";
}

// ---- Next-step coach -----------------------------------------------------

let nextStepDismissed = false;
let coachPinned = false;

function parseStatusFromAgent(text) {
  if (!text) return "";
  const match = String(text).match(/^\s*Status:\s*(continue|resolve|block)\b/im);
  return match ? match[1].toLowerCase() : "";
}

function parseListLine(text, label) {
  if (!text) return [];
  const re = new RegExp(`^\\s*${label}:\\s*(.*)$`, "im");
  const m = String(text).match(re);
  if (!m) return [];
  const v = m[1].trim();
  if (!v || /^нет$|^none$/i.test(v)) return [];
  return v.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
}

function computeNextStep() {
  const s = currentState;
  if (!s) return null;
  if (!s.activeRunId) {
    return {
      title: t("coach.step1.title"),
      body: t("coach.step1.body"),
      action: { label: t("coach.step1.action"), target: "newRun" },
    };
  }
  const active = s.run?.activeSubtask;
  const subtasks = s.run?.subtasks || [];
  if (s.autopilot?.running) {
    return {
      title: t("coach.autopilot.title"),
      body: t("coach.autopilot.body"),
      action: { label: t("coach.autopilot.action"), target: "autopilot" },
    };
  }
  if (!active && !subtasks.length) {
    return {
      title: t("coach.step2.title"),
      body: t("coach.step2.body"),
      action: { label: t("coach.step2.action"), target: "openSubtask" },
    };
  }
  if (!active) {
    // No open one, but stack has items
    const allResolved = subtasks.every((st) => st.status === "resolved");
    if (allResolved) {
      return { title: t("coach.allDone.title"), body: t("coach.allDone.body"), action: null };
    }
    return {
      title: t("coach.step2.title"),
      body: t("coach.step2.body"),
      action: { label: t("coach.step2.action"), target: "openSubtask" },
    };
  }
  if (s.busy) {
    return { title: t("coach.busy.title"), body: t("coach.busy.body"), action: null };
  }
  if (active.rounds === 0) {
    return {
      title: t("coach.step3.title"),
      body: t("coach.step3.body"),
      action: { label: t("coach.step3.action"), target: "runRound" },
    };
  }
  // Inspect last two agent messages of this subtask
  const msgs = (s.run?.messages || []).filter(
    (m) => m.role === "agent" && m.subtaskId === active.id,
  );
  const lastTwo = msgs.slice(-2);
  if (lastTwo.length >= 2) {
    const statuses = lastTwo.map((m) => parseStatusFromAgent(m.text));
    if (statuses.every((st) => st === "resolve")) {
      return {
        title: t("coach.resolveReady.title"),
        body: t("coach.resolveReady.body"),
        action: { label: t("coach.resolveReady.action"), target: "resolveSubtask" },
      };
    }
    if (statuses.some((st) => st === "block")) {
      return { title: t("coach.block.title"), body: t("coach.block.body"), action: null };
    }
    const facts = lastTwo.flatMap((m) => parseListLine(m.text, "New facts"));
    const risks = lastTwo.flatMap((m) => parseListLine(m.text, "New risks"));
    const alts = lastTwo.flatMap((m) => parseListLine(m.text, "New alternatives"));
    if (!facts.length && !risks.length && !alts.length) {
      return {
        title: t("coach.stale.title"),
        body: t("coach.stale.body"),
        action: { label: t("coach.stale.action"), target: "guidance" },
      };
    }
  }
  const kbCount = Object.values(s.run?.knowledge?.sections || {}).reduce((sum, list) => sum + list.length, 0);
  return {
    title: t("coach.runRound.title"),
    body: t("coach.runRound.body", { kbCount }),
    action: { label: t("coach.runRound.action"), target: "runRound" },
  };
}

function renderNextStep() {
  const step = computeNextStep();
  const panel = $("nextStep");
  const reopen = $("nextStepReopen");
  if (coachPinned) {
    // Guidance is docked at the bottom — hide the floating panel to avoid duplication.
    panel.classList.add("hidden");
    reopen.classList.add("hidden");
    return;
  }
  if (!step) {
    panel.classList.add("hidden");
    reopen.classList.add("hidden");
    return;
  }
  if (nextStepDismissed) {
    panel.classList.add("hidden");
    reopen.classList.remove("hidden");
    return;
  }
  panel.classList.remove("hidden");
  reopen.classList.add("hidden");
  $("nextStepTitle").textContent = step.title;
  $("nextStepBody").textContent = step.body;
  const actionBtn = $("nextStepAction");
  if (step.action) {
    actionBtn.hidden = false;
    actionBtn.textContent = step.action.label;
    actionBtn.onclick = () => triggerCoachTarget(step.action.target);
  } else {
    actionBtn.hidden = true;
    actionBtn.onclick = null;
  }
}

function initCoachDrag() {
  const panel = $("nextStep");
  const head = panel.querySelector(".next-step-head");
  if (!head) return;

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem("council-room-v2.coachPos") || "null");
    } catch {
      return null;
    }
  })();
  if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    panel.style.left = `${saved.left}px`;
    panel.style.top = `${saved.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const onDown = (event) => {
    if (event.target.closest("button")) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    startX = event.clientX;
    startY = event.clientY;
    panel.style.left = `${originLeft}px`;
    panel.style.top = `${originTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.classList.add("dragging");
    event.preventDefault();
  };

  const onMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const rect = panel.getBoundingClientRect();
    let nextLeft = originLeft + dx;
    let nextTop = originTop + dy;
    const maxLeft = window.innerWidth - rect.width - 4;
    const maxTop = window.innerHeight - rect.height - 4;
    nextLeft = Math.max(4, Math.min(maxLeft, nextLeft));
    nextTop = Math.max(4, Math.min(maxTop, nextTop));
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("dragging");
    const rect = panel.getBoundingClientRect();
    try {
      localStorage.setItem(
        "council-room-v2.coachPos",
        JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }),
      );
    } catch {}
  };

  head.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  // Touch
  const toMouse = (touchEvent, handler) => {
    const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
    if (!touch) return;
    handler({ clientX: touch.clientX, clientY: touch.clientY, target: touchEvent.target, preventDefault() { touchEvent.preventDefault(); } });
  };
  head.addEventListener("touchstart", (e) => toMouse(e, onDown), { passive: false });
  document.addEventListener("touchmove", (e) => toMouse(e, onMove), { passive: false });
  document.addEventListener("touchend", () => onUp());

  // Double-click on header → reset to default corner
  head.addEventListener("dblclick", (event) => {
    if (event.target.closest("button")) return;
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.bottom = "";
    try {
      localStorage.removeItem("council-room-v2.coachPos");
    } catch {}
  });
}

function triggerCoachTarget(target) {
  const el = document.getElementById(target);
  if (!el) return;
  if (target === "guidance") {
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.click();
  }
  el.classList.add("coach-highlight");
  setTimeout(() => el.classList.remove("coach-highlight"), 4500);
}

function renderRuns() {
  const list = $("runList");
  list.innerHTML = "";
  for (const run of currentState.runs || []) {
    const li = document.createElement("li");
    if (run.id === currentState.activeRunId) li.classList.add("active");
    li.innerHTML = `<span>${escapeHtml(run.topic)}</span><button class="delete-run" title="${escapeHtml(t("ui.confirmDelete", { topic: run.topic }))}">×</button>`;
    li.addEventListener("click", (event) => {
      if (event.target.classList.contains("delete-run")) {
        if (confirm(t("ui.confirmDelete", { topic: run.topic }))) api("POST", "/api/runs/delete", { runId: run.id });
        return;
      }
      api("POST", "/api/runs/switch", { runId: run.id });
    });
    list.appendChild(li);
  }
}

function renderStatus() {
  const el = $("status");
  const busy = Boolean(currentState.busy);
  const idleLabel = currentState.status === "idle" ? t("ui.idle") : currentState.status;
  el.textContent = busy ? `${t("ui.busy")} · ${currentState.status}` : idleLabel;
  el.classList.toggle("busy", busy);
  el.classList.toggle("stoppable", busy);
  if (busy) {
    el.dataset.tooltipText = t("tip.stopStatus");
  } else {
    delete el.dataset.tooltipText;
    hideTooltip();
  }
  $("busyIndicator").textContent = currentState.autopilot?.running
    ? t("ui.autopilotStartedHint")
    : (busy ? t("ui.runInProgress") : "");
}

function renderSubtasks() {
  const list = $("subtaskList");
  list.innerHTML = "";
  const subtasks = currentState.run?.subtasks || [];
  if (!subtasks.length) {
    const empty = document.createElement("li");
    empty.className = "muted small";
    empty.style.cursor = "default";
    empty.textContent = t("ui.openFirstHint");
    list.appendChild(empty);
    return;
  }
  for (const st of subtasks) {
    const li = document.createElement("li");
    li.classList.add(st.status);
    const editable = st.rounds === 0 && st.status !== "resolved";
    if (editable) li.classList.add("editable");

    const titleSpan = document.createElement("span");
    titleSpan.className = "subtask-title";
    titleSpan.textContent = st.title;
    li.appendChild(titleSpan);

    const right = document.createElement("span");
    right.className = "subtask-actions";
    if (editable) {
      const edit = document.createElement("button");
      edit.className = "subtask-edit";
      edit.type = "button";
      edit.textContent = "✎";
      edit.title = t("ui.editIcon");
      edit.addEventListener("click", (event) => {
        event.stopPropagation();
        openSubtaskModal({ editId: st.id, title: st.title, mode: st.mode });
      });
      right.appendChild(edit);

      const del = document.createElement("button");
      del.className = "subtask-delete";
      del.type = "button";
      del.textContent = "×";
      del.title = t("ui.deleteIcon");
      del.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!confirm(t("ui.confirmDeleteSubtask", { title: st.title }))) return;
        api("POST", "/api/subtasks/delete", { id: st.id });
      });
      right.appendChild(del);
    }
    li.appendChild(right);

    const tag = document.createElement("span");
    tag.className = "subtask-tag";
    tag.textContent = `${st.id.slice(-6)} · ${st.mode} · R${st.rounds}`;
    li.appendChild(tag);

    li.title = `${st.status} — ${st.id}`;
    if (st.status === "pending" || st.status === "frozen" || st.status === "resolved") {
      li.style.cursor = "pointer";
      li.addEventListener("click", (event) => {
        if (event.target.closest(".subtask-edit, .subtask-delete")) return;
        if (st.status === "resolved" && !confirm(t("ui.confirmReopen"))) return;
        api("POST", "/api/subtasks/reopen", { id: st.id });
      });
    }
    list.appendChild(li);
  }
}

function renderActiveSubtask() {
  const active = currentState.run?.activeSubtask;
  const autopilotRunning = Boolean(currentState.autopilot?.running);
  $("activeSubtaskTitle").textContent = active ? active.title : t("ui.noActiveSubtask");
  $("activeSubtaskMeta").textContent = active
    ? t("ui.subtaskMeta", { id: active.id, mode: active.mode, rounds: active.rounds })
    : t("ui.noActiveSubtaskHint");
  $("runRound").disabled = !active || currentState.busy || autopilotRunning;
  $("resolveSubtask").disabled = !active || autopilotRunning;
  $("freezeSubtask").disabled = !active || autopilotRunning;
  renderAutopilot();
}

function renderAutopilot() {
  const btn = $("autopilot");
  if (!btn) return;
  const active = currentState.run?.activeSubtask;
  const running = Boolean(currentState.autopilot?.running);
  btn.textContent = running ? t("ui.autopilotStop") : t("ui.autopilotStart");
  btn.classList.toggle("running", running);
  btn.classList.toggle("primary", running);
  btn.classList.toggle("ghost", !running);
  // While running, Stop must stay clickable; otherwise needs an active subtask.
  btn.disabled = running ? false : (!active || currentState.busy);
  const autoResolve = $("autoResolve");
  if (autoResolve) autoResolve.disabled = running;
}

function renderConversation() {
  const target = $("conversation");
  const trace = $("traceList");
  target.innerHTML = "";
  trace.innerHTML = "";
  const messages = currentState.run?.messages || [];
  const active = currentState.run?.activeSubtask;
  const filtered = active ? messages.filter((m) => !m.subtaskId || m.subtaskId === active.id) : messages;
  for (const msg of filtered) {
    const isProcess = msg.kind === "process" || msg.kind?.startsWith("subtask-");
    if (isProcess) {
      const row = document.createElement("div");
      row.className = "trace-row";
      row.textContent = `[${formatTime(msg.at)}] ${msg.name}: ${msg.text}`;
      trace.appendChild(row);
      continue;
    }
    const card = document.createElement("div");
    card.className = `msg ${msg.role}`;
    const meta = msg.round ? `R${msg.round}` : msg.kind || "";
    card.innerHTML = `
      <div class="name"><span>${escapeHtml(msg.name)}</span><span>${escapeHtml(meta)} · ${formatTime(msg.at)}</span></div>
      <div class="text">${escapeHtml(msg.text)}</div>
    `;
    target.appendChild(card);
  }
  target.scrollTop = target.scrollHeight;
}

function renderKnowledge() {
  const target = $("kbSections");
  target.innerHTML = "";
  const kb = currentState.run?.knowledge;
  $("kbUpdated").textContent = kb ? formatTime(kb.updatedAt) : "";
  if (!kb) {
    target.innerHTML = `<p class="muted small" style="padding:10px 14px">(${t("ui.noActiveSubtask")})</p>`;
    return;
  }
  const sectionsDef = [
    "decisions",
    "prohibitions",
    "control_contract",
    "files_in_scope",
    "files_out_of_scope",
    "verification_commands",
    "open_questions",
  ];
  for (const key of sectionsDef) {
    const label = t(`kb.${key}`);
    const items = kb.sections[key] || [];
    const block = document.createElement("div");
    block.className = "kb-section";
    const h3 = document.createElement("h3");
    const labelSpan = document.createElement("span");
    labelSpan.className = "kb-section-label";
    labelSpan.textContent = label;
    h3.appendChild(labelSpan);
    const tools = document.createElement("span");
    tools.className = "kb-section-tools";
    if (key === "files_out_of_scope") {
      const on = Boolean(currentState.settings?.strictScope);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "kb-scope-toggle" + (on ? " active" : "");
      toggle.textContent = on ? "☑" : "☐";
      toggle.title = t("ui.strictScope");
      toggle.dataset.tooltipText = t("tip.strictScope");
      toggle.addEventListener("click", () => api("POST", "/api/settings", { strictScope: !on }));
      tools.appendChild(toggle);
    }
    const help = document.createElement("span");
    help.className = "help";
    help.dataset.tooltipKey = `t.kb.${key}`;
    help.dataset.tooltipText = t(`tip.kb.${key}`);
    help.textContent = "?";
    tools.appendChild(help);
    h3.appendChild(tools);
    block.appendChild(h3);
    const ul = document.createElement("ul");
    for (const item of items) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(item)}</span><button class="remove" title="remove">×</button>`;
      li.querySelector(".remove").addEventListener("click", () => api("POST", "/api/kb/remove", { section: key, item }));
      ul.appendChild(li);
    }
    block.appendChild(ul);
    const add = document.createElement("div");
    add.className = "kb-add";
    const placeholder = t("ui.addPlaceholder", { label });
    add.innerHTML = `<input placeholder="${escapeHtml(placeholder)}" /><button class="ghost">${t("ui.add")}</button>`;
    const input = add.querySelector("input");
    const button = add.querySelector("button");
    const submit = () => {
      if (!input.value.trim()) return;
      api("POST", "/api/kb/add", { section: key, item: input.value.trim() });
      input.value = "";
    };
    button.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
    block.appendChild(add);
    target.appendChild(block);
  }
}

function renderSettings() {
  if (!currentState.settings) return;
  const s = currentState.settings;
  $("language").value = s.language || "ru";
  $("codexModel").value = s.codexModel || "";
  $("codexEffort").value = s.codexEffort || "auto";
  $("claudeModel").value = s.claudeModel || "";
  $("claudeEffort").value = s.claudeEffort || "auto";
  const scan = $("allowFilesystemScan");
  if (scan) {
    scan.checked = Boolean(s.allowFilesystemScan);
    scan.closest("label.toggle-row")?.classList.toggle("active", Boolean(s.allowFilesystemScan));
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const locale = UI_LANG === "ru" ? "ru-RU" : "en-GB";
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function autoGrowTextarea(el) {
  el.style.height = "auto";
  el.style.height = `${Math.max(52, el.scrollHeight)}px`;
}

function openSubtaskModal({ editId = "", title = "", mode = "STANDARD" } = {}) {
  const modal = $("openSubtaskModal");
  modal.dataset.editId = editId;
  const titleInput = $("subtaskTitleInput");
  titleInput.value = title;
  $("subtaskModeInput").value = mode;
  $("subtaskModalTitle").textContent = t(editId ? "ui.editSubtask" : "ui.openNewSubtask");
  $("confirmSubtask").textContent = t(editId ? "ui.save" : "ui.open");
  modal.classList.remove("hidden");
  setTimeout(() => {
    titleInput.focus();
    autoGrowTextarea(titleInput);
  }, 0);
}

function bindUi() {
  $("fontUp").addEventListener("click", () => bumpScale(SCALE_STEP));
  $("fontDown").addEventListener("click", () => bumpScale(-SCALE_STEP));

  $("nextStepClose").addEventListener("click", () => {
    nextStepDismissed = true;
    renderNextStep();
  });
  $("nextStepReopen").addEventListener("click", () => {
    nextStepDismissed = false;
    renderNextStep();
  });

  $("langToggle").addEventListener("click", () => {
    UI_LANG = UI_LANG === "ru" ? "en" : "ru";
    localStorage.setItem("council-room-v2.uiLang", UI_LANG);
    // Also push to agent language setting (one knob — simpler UX, can be split later)
    api("POST", "/api/settings", { language: UI_LANG });
    applyLanguage();
  });

  $("newRun").addEventListener("click", async () => {
    const topic = prompt(t("ui.askTopic"));
    if (!topic) return;
    await api("POST", "/api/runs", { topic });
  });

  $("subtaskTitleInput").addEventListener("input", (event) => autoGrowTextarea(event.target));

  $("openSubtask").addEventListener("click", () => {
    if (!currentState?.activeRunId) {
      alert(t("ui.alertNoChat"));
      return;
    }
    openSubtaskModal();
  });
  $("cancelSubtask").addEventListener("click", () => $("openSubtaskModal").classList.add("hidden"));
  $("confirmSubtask").addEventListener("click", async () => {
    const title = $("subtaskTitleInput").value.trim();
    if (!title) return;
    const mode = $("subtaskModeInput").value;
    const editId = $("openSubtaskModal").dataset.editId || "";
    $("openSubtaskModal").classList.add("hidden");
    if (editId) {
      await api("POST", "/api/subtasks/edit", { id: editId, title, mode });
    } else {
      await api("POST", "/api/subtasks/open", { title, mode });
    }
  });

  $("runRound").addEventListener("click", async () => {
    const guidance = $("guidance").value.trim();
    $("guidance").value = "";
    await api("POST", "/api/round", { guidance });
  });

  $("autopilot").addEventListener("click", async () => {
    if (currentState.autopilot?.running) {
      await api("POST", "/api/autopilot/stop", {});
    } else {
      const autoResolve = $("autoResolve").checked;
      await api("POST", "/api/autopilot/start", { autoResolve });
    }
  });

  // Click the busy Status field to interrupt the current round (manual or autopilot).
  $("status").addEventListener("click", () => {
    if (!currentState?.busy) return;
    hideTooltip();
    api("POST", "/api/autopilot/stop", {});
  });

  const TERMINALS_KEY = "council-room-v2.terminalsCollapsed";
  const applyTerminalsCollapsed = (collapsed) => {
    $("terminals").classList.toggle("collapsed", collapsed);
    const arrow = $("terminals").querySelector(".terminals-arrow");
    if (arrow) arrow.textContent = collapsed ? "▾" : "▴";
  };
  // Default expanded: the panel only appears when there's output, so showing it
  // expanded by default means the stream is visible the moment a round runs.
  applyTerminalsCollapsed(localStorage.getItem(TERMINALS_KEY) === "true");
  $("toggleTerminals").addEventListener("click", () => {
    const collapsed = !$("terminals").classList.contains("collapsed");
    applyTerminalsCollapsed(collapsed);
    try { localStorage.setItem(TERMINALS_KEY, String(collapsed)); } catch {}
  });

  $("resolveSubtask").addEventListener("click", async () => {
    const active = currentState.run?.activeSubtask;
    if (!active) return;
    const summary = prompt(t("ui.askSummary"), "");
    await api("POST", "/api/subtasks/resolve", { id: active.id, summary: summary || "" });
  });
  $("freezeSubtask").addEventListener("click", async () => {
    const active = currentState.run?.activeSubtask;
    if (!active) return;
    const reason = prompt(t("ui.askReason"), "");
    if (reason === null) return;
    await api("POST", "/api/subtasks/freeze", { id: active.id, reason });
  });

  $("toggleTrace").addEventListener("click", () => {
    const trace = $("trace");
    trace.open = !trace.open;
    const traceLabelEl = $("toggleTrace").querySelector("[data-i18n='ui.trace']");
    const arrow = trace.open ? " ▴" : " ▾";
    $("toggleTrace").lastChild.textContent = arrow;
  });

  const settingsHandlers = ["language", "codexModel", "codexEffort", "claudeModel", "claudeEffort"];
  for (const id of settingsHandlers) {
    const el = $(id);
    const event = el.tagName === "INPUT" ? "blur" : "change";
    el.addEventListener(event, () => {
      const value = el.value;
      api("POST", "/api/settings", { [id]: value });
    });
  }

  const scan = $("allowFilesystemScan");
  if (scan) {
    scan.addEventListener("change", () => {
      if (scan.checked && !confirm(t("ui.confirmAllowScan"))) {
        scan.checked = false;
        return;
      }
      api("POST", "/api/settings", { allowFilesystemScan: scan.checked });
    });
  }

  // Tooltip on dynamically-added KB help icons uses data-tooltip-text directly
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-tooltip-text]:not([data-tooltip-key])");
    if (!target) return;
    showTooltip(target.dataset.tooltipText, target);
  });
  document.addEventListener("mouseout", (event) => {
    if (event.target.closest("[data-tooltip-text]:not([data-tooltip-key])")) hideTooltip();
  });

  $("nextStepPin").addEventListener("click", (event) => {
    event.stopPropagation();
    pinCoach();
  });
  $("pinnedHintPin").addEventListener("click", (event) => {
    event.stopPropagation();
    unpinCoach();
  });
  $("pinnedHintClose").addEventListener("click", closeCoachPinned);
}

bindUi();
bindTooltipDelegation();
initCoachDrag();
applyLanguage();
applyScale();
connectEvents();
