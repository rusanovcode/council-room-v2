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
    "ui.msgTrash": "Корзина ответов",
    "ui.trashResponse": "В корзину",
    "ui.restoreResponse": "Восстановить",
    "ui.trashedEmpty": "Корзина ответов пуста.",
    "ui.traceSummary": "Служебные события",
    "ui.runRound": "▶ Запустить раунд",
    "ui.guidancePlaceholder": "Направление на следующий раунд (опц.)",
    "ui.knowledgeBase": "База знаний",
    "ui.settings": "Настройки модуль свитчера",
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
    "ui.feedbackTitle": "Обратная связь",
    "ui.feedbackBug": "Баг",
    "ui.feedbackFeature": "Пожелание",
    "ui.feedbackOther": "Другое",
    "ui.feedbackSend": "Отправить письмо",
    "ui.feedbackNext": "Выбрать приложение →",
    "ui.feedbackBack": "← Назад",
    "ui.feedbackChooseClient": "Выбери почтовое приложение:",
    "ui.feedbackDefaultApp": "Приложение по умолчанию",
    "ui.feedbackPlaceholder": "Опиши проблему или пожелание…",
    "tip.feedback": "Отправить баг-репорт или пожелание по улучшению разработчику.",
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
    "tip.msgTrash": "Показать/скрыть удалённые ответы агентов.\nОтвет в корзине скрыт из ленты и не передаётся агентам в контекст следующего раунда — но не удаляется, его можно восстановить.|||ошибочный или шумный ответ убираешь в корзину кнопкой 🗑 на карточке; передумал — открываешь корзину и жмёшь «Восстановить».",
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
    "ui.qCounts": "открыто {open} (crit {crit} / minor {minor}) · решено {resolved} · проверено {verified}",
    "ui.qPrioToggle": "Приоритет: critical блокирует исполнение, minor можно отложить. Клик — переключить.",
    "ui.qDeferred": "Критичные решены — готово к исполнению. Отложено второстепенных: {n} (висят здесь). Догнать позже; если станет блокирующим — переключи в critical.",
    "tip.verifyBadge": "Финальная проверка: открытых вопросов не осталось, все решённые собраны в пакет.\nСледующий раунд — проверочный, его гоняют МАКСИМАЛЬНЫЕ агенты (топ-модель + max reasoning). Если оба подтвердят весь пакет — подзадача готова к закрытию; любой вернёт вопрос в работу — цикл продолжится.|||3 вопроса решены обоими → бейдж VERIFY. Жмёшь раунд (или autopilot): codex gpt-5.5/xhigh и claude opus/max перепроверяют пакет. Оба «Verify: ok» → можно закрывать.",
    "ui.codexAccount": "Codex — аккаунт",
    "ui.claudeAccount": "Claude — аккаунт",
    "ui.accShort": "акк",
    "ui.archived": "Архив",
    "ui.trash": "Корзина",
    "ui.emptyTrash": "Очистить",
    "ui.archiveEmpty": "(пусто)",
    "ui.toArchive": "В архив",
    "ui.toTrash": "В корзину",
    "ui.restore": "Восстановить",
    "ui.previewBanner": "Просмотр (только чтение): {title}",
    "ui.closePreview": "Закрыть просмотр",
    "ui.confirmEmptyTrash": "Очистить корзину подзадач? Удалённые безвозвратно исчезнут.",
    "ui.confirmEmptyChatTrash": "Очистить корзину чатов? Удалённые чаты исчезнут безвозвратно вместе со всей историей.",
    "tip.chatArchive": "Архив чатов. По «🗄» чат уходит в архив (не удаляется). Тут можно его восстановить (↩) обратно в «Чаты» или отправить в корзину (×).|||закрыл рабочий чат «Phase 1» → он в архиве; через неделю вернулся, нажал ↩ — снова в списке.",
    "tip.chatTrash": "Корзина чатов. По «×» чат уходит сюда (восстановимо). ↩ — вернуть в «Чаты»; «Очистить» — удалить безвозвратно вместе со всей историей.|||удалил ненужный чат → он в корзине. Передумал — ↩ вернул. Или «Очистить» — стереть навсегда.",
    "tip.subtaskArchive": "Архив подзадач. Кнопка «в архив» (🗄) на подзадаче убирает её из стека, но сохраняет. Клик по архивной — read-only просмотр в центре; ↩ — вернуть в стек.|||закрытую подзадачу «выбор БД» отправил в архив, чтобы не мешала. Позже кликнул — перечитал решение.",
    "tip.subtaskTrash": "Корзина подзадач. По «×» подзадача уходит сюда (восстановимо). Клик — read-only просмотр; ↩ — вернуть в стек; «Очистить» — удалить безвозвратно.|||создал лишнюю подзадачу, нажал × → в корзине. Передумал — ↩ вернул. Или «Очистить» — стереть весь мусор.",
    "ui.switcherConnected": "модуль свитч<br>подключён",
    "ui.switcherOffline": "модуль свитч<br>не подключён",
    "ui.agentsLabel": "подключено:",
    "ui.agentReady": "проверен, рабочий",
    "ui.agentUnverified": "ключ задан, но не проверен",
    "ui.agentNoKey": "нет ключа",
    "tip.agentChip": "{prov} · {model} — {status}. Inline-бэкенд участника. Цвет: зелёный — ключ прошёл живой тест (или Ollama/CLI); жёлтый — ключ задан, но не проверен; серый — ключа нет.",
    "ui.toggleStatement": "Развернуть / свернуть текст постановки подзадачи",
    "ui.checkUpdates": "Обновления",
    "ui.checkUpdatesTitle": "Проверить обновления на GitHub",
    "ui.updateTitle": "Обновление",
    "ui.updateChecking": "Проверяю обновления на GitHub…",
    "ui.updateUpToDate": "Установлена актуальная версия ({sha}).",
    "ui.updateAvailable": "Доступно обновление: {n} коммит(ов). Текущая {local} → новая {remote}.",
    "ui.updateChanges": "Изменения:",
    "ui.updateApply": "Обновить",
    "ui.updateApplying": "Обновляю…",
    "ui.updateDone": "Обновлено до {head}. Чаты и настройки сохранены. Перезапусти приложение (Council Room v2.bat), чтобы применить.",
    "ui.updateError": "Ошибка: {error}",
    "ui.updateDirtyNote": "⚠️ Есть незакоммиченные локальные изменения — обновление может не примениться.",
    "ui.switcherStats": "Подробная статистика",
    "ui.refreshTokens": "Обновить остаток токенов (мини-запрос самой дешёвой моделью к каждому аккаунту)",
    "ui.confirmRefresh": "Обновить остаток токенов?\n\nК каждому авторизованному аккаунту (Codex и Claude) будет отправлен крошечный запрос («What is 1+3?») самой дешёвой моделью (Codex gpt-5.4-mini / Claude haiku), чтобы обновить данные по использованию. Виден в логе «Служебные события». Тратит немного подписки.",
    "ui.apiTitle": "{tool}: API-ключ",
    "ui.apiSteps": "Это профиль с API-ключом, а не OAuth-аккаунт.|Ключ задаётся в ai-switcher (profiles / api-keys), не через это окно.|Вход через терминал тут не нужен.",
    "ui.tabLimits": "Лимиты",
    "ui.tabSpend": "Расход",
    "ui.tabSub": "Подписка",
    "ui.hourlyReset": "Часовой сброс",
    "ui.weeklyReset": "Недельный сброс",
    "ui.windowStart": "Начало окна",
    "ui.used": "использовано",
    "ui.now": "сейчас",
    "ui.noData": "нет данных",
    "ui.codexNoData": "нет данных (запусти раунд с этим аккаунтом)",
    "ui.codexNoSpend": "расход не отслеживается (нет в session-логах Codex)",
    "ui.periodToday": "сегодня",
    "ui.periodWeek": "неделя",
    "ui.periodAll": "всё",
    "ui.spendIn": "вход",
    "ui.spendOut": "выход",
    "ui.sessions": "запросов",
    "ui.spendTotal": "всего",
    "ui.requests": "запросов",
    "ui.apiBadge": "API-ключ",
    "ui.apiNoLimit": "у API-ключа нет окон-лимитов — смотри расход",
    "ui.resetSpend": "Сбросить расход",
    "ui.confirmResetSpend": "Сбросить накопленный расход по всем API-профилям?\n\nЭто только локальные счётчики токенов (rooms/.provider-usage.json), на сам биллинг провайдера не влияет.",
    "ui.subStart": "начало",
    "ui.subEnd": "конец",
    "ui.daysLeft": "осталось дней: {n}",
    "ui.openLogin": "Открыть окно входа",
    "ui.relogin": "Перелогиниться",
    "ui.loginAlready": "✓ Этот аккаунт уже авторизован. Повторный вход обычно не нужен — только если проблемы со входом или сменил аккаунт.",
    "ui.loginTitle": "Авторизация: {tool} — аккаунт {account}",
    "ui.loginSteps": "Откроется отдельное окно терминала в окружении этого аккаунта.|В нём запустится команда входа: {cmd}|Следуй подсказкам CLI — обычно откроется браузер. Войди ИМЕННО в нужный аккаунт (не перепутай с другим).|Аккаунт 2: данные входа сохранятся в папку ai-switcher этого аккаунта; аккаунт 1 — в дефолтную.|После сообщения об успехе вернись сюда. Окно терминала можно закрыть.",
    "tip.acctBtn": "{tool} — аккаунт {account}. Остаток токенов: {pct}.\nЦвет: зелёный ≥50%, жёлтый 16–49%, красный 1–15%, серый <1% (исчерпан), чёрный — нет данных / не подключён. Клик — авторизовать этот аккаунт (откроется окно login).|||Cx1 серый → у Codex акк 1 почти нет токенов до сброса лимита; кликнул — открылось окно входа.",
    "tip.switcher": "Модуль свитч (ai-switcher) — мультиаккаунт для агентов. Необязателен: если не подключён, всё работает в стандартном режиме на 1 аккаунте.\nПодключён = в ai-switcher настроен второй аккаунт (auth-папки на месте). Тогда доступен свитч/failover между аккаунтами.|||зелёная точка «подключён» → можно выбрать акк 2 и авто-failover. Серая «не подключён» → только акк 1.",
    "tip.account": "Режим: auto — при лимите/ошибке агент сам переключится на другой аккаунт и повторит раунд; manual — жёстко закреплён выбранный аккаунт, без авто-свитча.\nАккаунт: какой использовать как стартовый (в auto) или закреплённый (в manual). Акк 2 доступен только если модуль свитч подключён.|||Codex auto + акк 1: ловит лимит на акк 1 → сам уходит на акк 2. Claude manual + акк 2: всегда только акк 2.",
    "tip.strictScope": "Спец-режим. Когда включён (☑): всё, что НЕ перечислено в секции «Файлы в scope», автоматически считается вне scope, и агентам СТРОГО запрещено это трогать.\nВ промт добавляется жёсткое правило-дополнение (complement). Удобно, когда проще перечислить разрешённое, чем запрещённое.|||в «Файлы в scope» три файла. Включаешь ☑ — агенты понимают: любой другой файл/папку проекта трогать нельзя, даже если он не указан явно в «Файлы вне scope».",
    "tip.stopStatus": "Остановить — прервать текущий процесс. Раунд обрывается кооперативно (агенты в терминалах останавливаются), частичный результат отбрасывается.",
    "tip.autopilot": "Автопилот: Codex и Claude пинг-понгуют по активной подзадаче без участия пользователя.\nЦикл сам останавливается по стоп-условию: оба resolve, два «пустых» раунда подряд (stale×2), block, или достигнут лимит раундов по режиму (LIGHT 3 / STANDARD 6 / STRICT 10 / CRITICAL 12).\nНажми ещё раз (⏹ Стоп), чтобы прервать — текущий раунд обрывается кооперативно.|||открыта подзадача в режиме STANDARD. Жмёшь «Autopilot ▶» — идут раунды 1,2,3… На 4-м оба агента дают Status: resolve → loop стоп с «debate-complete», coach предлагает «Закрыть».",
    "tip.autoResolve": "Когда включено и автопилот ловит debate-complete (оба resolve) — подзадача закрывается автоматически с кратким резюме из Базы знаний, без лишнего вызова агента.\nКогда выключено (по умолчанию) — автопилот просто останавливается, а закрываешь ты сам (с собственным резюме).|||галка снята: на debate-complete loop стопится, ты пишешь резюме «stop = stale×2 OR token<25%» и жмёшь «Закрыть». Галка стоит: loop сам резолвит и пишет резюме из секции Решения.",
    "tip.terminals": "Live-вывод (stdout+stderr) обоих агентов во время раунда.\nОчищается в начале каждого раунда. Раскрывашка ▾/▴ сворачивает панель; состояние сохраняется между запусками.|||во время autopilot-раунда видишь как Codex стримит рассуждения слева, Claude — справа. Полезно чтобы понять, завис агент или думает.",
    "coach.autopilot.title": "Autopilot работает",
    "coach.autopilot.body": "Codex и Claude идут раунд за раундом по активной подзадаче. Остановится сам по стоп-условию (оба resolve / stale×2 / block / лимит раундов). Можешь прервать в любой момент.",
    "coach.autopilot.action": "⏹ Остановить autopilot",
    "ui.providersPanel": "Регистрация агентов",
    "ui.profiles": "Профиль",
    "ui.registeredModels": "Зарегистрированные модели",
    "ui.regModelLabel": "Подпись",
    "ui.regModelAgent": "Агент",
    "ui.regModelModel": "Модель",
    "ui.regModelEffort": "Сила",
    "ui.regModelSpeed": "Скорость",
    "ui.noNewProfiles": [
      "Нет новых профилей? Нажми «+ Профиль» чтобы добавить.",
      "Нажми на «+ Профиль», сладенький.",
      "Нажимай «+ Профиль», кожанный!!! :)",
      "При нажатии на «+ Профиль» появится хомячек! 🐹",
      "Одна кнопка, бесконечные возможности. Нажми «+ Профиль».",
      "Агентов нет? Всё решается одной кнопкой! 👇",
      "Пустовато тут… «+ Профиль» ждёт тебя!",
      "ИИ-агенты не размножаются сами. Нажми «+ Профиль»! 🤖",
      "Твой дедлайн плачет в углу. «+ Профиль» спасёт ситуацию. 😭",
      "Согласно прогнозу синоптиков — ожидается нажатие «+ Профиль». ⛅",
      "Мой дедушка говорил: «Зарегистрируй профиль, внучок». Мудрый был человек. 👴",
      "ChatGPT бы уже нажал. А ты? 😏",
      "«+ Профиль» — единственная кнопка, которая изменит твою жизнь. Ну или хотя бы чат.",
      "Без агентов как без рук. «+ Профиль» вернёт тебе руки! 🙌",
      "Соседка Валентина уже нажала «+ Профиль» три раза. Не отставай! 👀",
      "Загадка: что нужно нажать, чтобы появились агенты? 🏆 Правильно!",
      "Эй ты, да ты! Кнопка «+ Профиль» смотрит на тебя. 👁️",
    ],
    "ui.regModelNoProfiles": "Нет зарегистрированных моделей. Добавь профиль в «Регистрация агентов».",
    "ui.regModelSaved": "Модель сохранена",
    "ui.providerLog": "Журнал событий",
    "ui.providerLogClear": "Очистить",
    "ui.providerLogEmpty": "Журнал пуст",
    "ui.regModelRetest": "Проверить доступность модели",
    "ui.regModelTesting": "Проверяю…",
    "ui.addProfile": "+ Профиль",
    "ui.applyProviders": "Применить",
    "ui.providersSaved": "Сохранено ✓",
    "ui.profileModelRequired": "Укажи модель для «{label}» (например: llama3.2, gpt-4o-mini)",
    "ui.ollamaSelectModel": "— выбери модель —",
    "ui.ollamaRegisterHint": "← зарегистрируй в «Регистрация агентов»",
    "ui.ollamaNoModels": "Ollama не запущена?",
    "ui.ollamaDetected": "Ollama обнаружена на порту {port} · {n} модел{suffix}",
    "ui.ollamaNotFound": "Ollama не обнаружена (проверяется порт {port})",
    "ui.ollamaChecking": "Проверяю Ollama…",
    "ui.ollamaTesting": "Идёт проверка подключения к Ollama…",
    "ui.ollamaTestingModel": "Проверяю: {model}…",
    "ui.ollamaConnected": "✓ Подключено",
    "ui.ollamaConnectedModels": "✓ Подключено: {models}",
    "ui.ollamaNotConnected": "✗ Не подключена: {e}",
    "ui.noProfiles": "Профилей нет — раунд использует поведение по умолчанию (Codex/Claude).",
    "ui.profileProvider": "Провайдер",
    "ui.profileModel": "Модель",
    "ui.profileAccount": "Аккаунт",
    "ui.profileBaseUrl": "Base URL",
    "ui.profileCredRef": "Env-переменная ключа",
    "ui.profileApiKey": "API-ключ (прямой ввод)",
    "ui.profileLabel": "Подпись",
    "ui.keySet": "ключ задан",
    "ui.keyMissing": "нет ключа",
    "ui.keyKeepPlaceholder": "ключ задан — оставь пустым, чтобы не менять",
    "ui.providersKeySaved": "Ключ(и) сохранены в .env ✓",
    "ui.keyNeedsRef": "Введён ключ, но не задано имя Env-переменной у профиля «{p}». Заполни поле «Env-переменная ключа».",
    "ui.keyTesting": "Проверяю ключ мини-запросом…",
    "ui.keyWorks": "Ключ рабочий ✓ (ответ: «{reply}») — сохранён в .env",
    "ui.keyFailed": "Ключ не прошёл проверку: {e}",
    "ui.keyTestNeedsModel": "Для проверки ключа сначала укажи модель в этом профиле.",
    "ui.keyVerified": "Ключ проверен живым запросом — рабочий (зелёная галочка).",
    "ui.keyUnverified": "Ключ задан, но не проверен (жёлтая галочка). Введи/перевведи ключ в поле — он протестируется автоматически.",
    "ui.remove": "Удалить",
    "tip.providersPanel": "Регистрация агентов: здесь регистрируешь и авторизуешь бэкенды. Профиль — это именованный бэкенд: API-провайдер (по ключу из .env), локальная Ollama или (в full-сборке) подписочный CLI. Зарегистрированные профили становятся доступны при выборе агентов обсуждения (кнопка «Добавить агента» в шапке чата).|||Зарегистрируй профиль «DeepSeek» с ключом DEEPSEEK_API_KEY → он появится в списке бэкендов, когда добавляешь агента в чат.",
    "tip.registeredModels": "Глобальный список зарегистрированных моделей — доступен во всех чатах. Здесь можно быстро сменить модель или усилие без входа в «Регистрация агентов». Изменения сохраняются сразу.|||Сменил модель Ollama с llama3.2 на qwen2.5 — при следующем «Добавить агента» подберётся уже новая.",
    "tip.agentSettings": "Язык агентов и БЫСТРЫЙ выбор для двух стандартных спорщиков — модель/усилие/аккаунт Codex и Claude. Упрощённый путь «по умолчанию». Для подключения API-провайдеров/Ollama используй «Регистрация агентов» (в режиме API эти простые контролы скрыты).|||Хочешь быстро сменить модель Codex на gpt-5.4-mini — здесь. Хочешь добавить DeepSeek или Ollama — в «Регистрация агентов».",
    "tip.profileLabel": "Человекочитаемое имя профиля — только для отображения (в чипе агента и в логах раунда). Ни на что в запросе не влияет. Если оставить пустым, показывается технический id (например p_mprga7ou).|||«DeepSeek основной», «Ollama локальная».",
    "tip.profileModel": "Идентификатор модели у провайдера — точная строка, которую он ждёт в поле model запроса. Бери из документации провайдера. Для CLI можно оставить «auto».|||DeepSeek: deepseek-chat / deepseek-reasoner · OpenAI: gpt-4o-mini · Groq: llama-3.3-70b-versatile · Ollama: llama3.1 (то, что показывает `ollama list`).",
    "tip.profileBaseUrl": "Корень API провайдера, заканчивается на /v1 (адаптер сам допишет /chat/completions). Для пресета подставляется автоматически — меняй только для своего/прокси-эндпоинта или саморазмещённой Ollama.|||https://api.deepseek.com/v1 · http://localhost:11434/v1 (Ollama).",
    "tip.profileCredRef": "Имя переменной окружения, где лежит API-ключ (например DEEPSEEK_API_KEY). Сам ключ хранится в .env (он в .gitignore) или в окружении — НЕ в репозитории и не в state.json. Можно либо вписать ключ напрямую в поле ниже, либо самому добавить строку в .env.|||DEEPSEEK_API_KEY → в .env строка DEEPSEEK_API_KEY=sk-...",
    "tip.profileApiKey": "Можно вставить API-ключ прямо здесь — по «Применить» он сохранится в файл .env (он в .gitignore) под именем из «Env-переменная ключа», а НЕ в state.json. Поле всегда пустое (ключ не показывается); оставь пустым, чтобы не менять уже сохранённый.|||Вставь sk-... → в .env появится DEEPSEEK_API_KEY=sk-...",
    "ui.addAgent": "Добавить агента",
    "ui.addAgentTitle": "Добавить агента",
    "ui.addAgentChoose": "Как добавить агентов в обсуждение?",
    "ui.agentAddAuto": "Авто — 2 разных",
    "ui.agentAddAutoHint": "Подобрать 2 разных доступных бэкенда с дешёвыми моделями.",
    "ui.agentAddManual": "Вручную (+1)",
    "ui.agentAddManualHint": "Добавить одного агента и настроить его.",
    "ui.agentsHeader": "Агенты обсуждения",
    "ui.agentEditorEmpty": "Кликни по чипу агента в шапке, чтобы настроить бэкенд, модель и усилие.",
    "ui.agentBackend": "Агент (бэкенд)",
    "ui.agentModel": "Модель",
    "ui.agentEffort": "Усилие",
    "ui.agentLabelField": "Подпись",
    "ui.agentApply": "Применить",
    "ui.agentRemove": "Убрать агента",
    "ui.agentSaved": "Агенты сохранены ✓",
    "ui.agentNoBackends": "Нет доступных бэкендов. Зарегистрируй/авторизуй агента в «Регистрация агентов».",
    "ui.noRegisteredAgents": "Агенты не<br>зарегистрированы",
    "tip.noRegisteredAgents": "Нет зарегистрированных бэкендов. Добавь профиль в панели «Регистрация агентов» (правая колонка).",
    "ui.agentMin2": "Нужно минимум 2 агента, чтобы запустить раунд.",
    "ui.agentMax": "Максимум 5 агентов.",
    "ui.agentNoneYet": "Агенты не выбраны",
    "ui.agentChipHint": "Клик — настроить · ×: убрать",
    "ui.tokenWarnTitle": "Расход токенов",
    "ui.tokenWarn2": "2 агента — базовый дебат, расход умеренный.",
    "ui.tokenWarn3": "3 агента: каждый видит ПОЛНЫЙ контекст двух других — расход заметно растёт (≈×1.5 к раунду).",
    "ui.tokenWarn4": "4 агента: полный контекст ×4 без сжатия — дорого. Это 4 бэкенда/подписки за каждый раунд.",
    "ui.tokenWarn5": "5 агентов — максимум. Очень дорого: полный контекст ×5 каждому, без сжатия промта.",
    "coach.agents.title": "Шаг 3: выбери агентов",
    "coach.agents.body": "Сверху по центру нажми «Добавить агента». Можно «Авто» (2 разных бэкенда подберутся сами) или «Вручную». Нужно минимум 2, максимум 5. Чем больше агентов — тем дороже раунд (промт не сжимается).",
    "coach.agents.action": "Добавить агента",
    "coach.ollamaReg.title": "Нужно зарегистрировать Ollama",
    "coach.ollamaReg.body": "Ты выбрал Ollama как бэкенд, но профиль ещё не зарегистрирован. Открой панель «Регистрация агентов» справа → нажми «+ Профиль» → выбери Ollama → укажи модель (например llama3.2) → «Применить». После этого модель появится в списке бэкендов.",
    "coach.ollamaReg.action": "Открыть регистрацию",
    "coach.agentsConfig.title": "Шаг 4: проверь модели агентов",
    "coach.agentsConfig.body": "По умолчанию подставлены слабые модели и низкое усилие — дёшево. Кликни по чипу агента сверху, чтобы сменить бэкенд/модель/усилие. Готово — запусти раунд.",
    "coach.agentsConfig.action": "Запустить раунд",
    "tip.addAgent": "Добавляет спорщика в обсуждение (от 2 до 5). «Авто» подберёт 2 разных доступных бэкенда с дешёвыми моделями; «Вручную» добавит одного, которого ты настроишь. Каждый агент видит полный контекст всех остальных — поэтому каждый добавленный заметно увеличивает расход токенов.|||2 агента — базовый дебат. 4–5 — дорого: полный контекст ×N за раунд.",
    "tip.agentBackend": "Какой бэкенд отвечает за этого агента: подписочный CLI (Codex/Claude, по аккаунтам), сетевой API-провайдер или локальная Ollama. Список — из доступного: авторизованные аккаунты + зарегистрированные провайдеры.|||«Codex · акк 1», «Claude · акк 2», «DeepSeek», «Ollama (локально)».",
    "tip.agentModel2": "Модель выбранного бэкенда. По умолчанию — самая дешёвая (экономия токенов). Для CLI — из списка; для сетевого провайдера — точная строка модели.|||Codex: gpt-5.4-mini (дёшево) … gpt-5.5. Claude: haiku … opus. DeepSeek: deepseek-chat.",
    "tip.agentEffort2": "Усилие рассуждения (только для подписочных CLI). По умолчанию low — дёшево и быстро. Выше — дороже и медленнее, но тщательнее. У сетевых провайдеров такой ручки нет.|||low — быстрый черновой проход; high/xhigh/max — для сложных спорных мест.",
    "ui.documents": "Документы",
    "ui.docAddFile": "+ Файл",
    "ui.docAdd": "Добавить",
    "ui.docNamePlaceholder": "Имя (опц.)",
    "ui.docPastePlaceholder": "…или вставь текст документа",
    "ui.docEmpty": "Документов нет. Приложи текстовый файл или вставь текст — он попадёт в контекст агентов на раунде.",
    "ui.docRemove": "Удалить документ",
    "ui.docAdded": "Документ добавлен ✓",
    "ui.docCharsBadge": "{docs} док · {chars} симв.",
    "ui.docChars": "{n} симв.",
    "ui.docBudgetNote": "В промт идёт до ~{n} символов суммарно (дальше — усечение). Экономь токены.",
    "tip.documents": "Приложенные текстовые документы этого чата — справочный материал, который кладётся в промт каждого раунда секцией ATTACHED DOCUMENTS. В отличие от сканирования файлов, это явно переданный тобой источник, поэтому разрешён даже в изолированном режиме. В промт идёт до ~12000 символов суммарно (дальше усечение) — следи за расходом.|||Прикладываешь спецификацию API или кусок лога → агенты ссылаются на него в дебате, не угадывая.",
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
    "ui.msgTrash": "Response bin",
    "ui.trashResponse": "Trash",
    "ui.restoreResponse": "Restore",
    "ui.trashedEmpty": "Response bin is empty.",
    "ui.traceSummary": "Process trace (system events)",
    "ui.runRound": "▶ Run round",
    "ui.guidancePlaceholder": "Steer the next round (optional)",
    "ui.knowledgeBase": "Knowledge Base",
    "ui.settings": "Switcher module settings",
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
    "ui.feedbackTitle": "Feedback",
    "ui.feedbackBug": "Bug",
    "ui.feedbackFeature": "Feature request",
    "ui.feedbackOther": "Other",
    "ui.feedbackSend": "Send email",
    "ui.feedbackNext": "Choose app →",
    "ui.feedbackBack": "← Back",
    "ui.feedbackChooseClient": "Choose your email app:",
    "ui.feedbackDefaultApp": "Default mail app",
    "ui.feedbackPlaceholder": "Describe the issue or your wish…",
    "tip.feedback": "Send a bug report or feature request to the developer.",
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
    "tip.msgTrash": "Show/hide trashed agent responses.\nA trashed response is hidden from the feed and excluded from the context sent to the agents next round — but not deleted, it can be restored.|||trash a wrong or noisy answer with the 🗑 button on its card; changed your mind — open the bin and hit «Restore».",
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
    "ui.qCounts": "open {open} (crit {crit} / minor {minor}) · resolved {resolved} · verified {verified}",
    "ui.qPrioToggle": "Priority: critical blocks execution, minor can be deferred. Click to toggle.",
    "ui.qDeferred": "Critical resolved — ready for execution. Deferred minor questions: {n} (kept here). Catch up later; if one becomes blocking, switch it to critical.",
    "tip.verifyBadge": "Final verification: no open questions left, all resolved ones are batched.\nThe next round is a verification pass run by the STRONGEST agents (top model + max reasoning). If both confirm the whole batch — the subtask is ready to close; if either reopens a question — the cycle continues.|||3 questions resolved by both → VERIFY badge. Run a round (or autopilot): codex gpt-5.5/xhigh and claude opus/max recheck the batch. Both «Verify: ok» → ready to close.",
    "ui.codexAccount": "Codex — account",
    "ui.claudeAccount": "Claude — account",
    "ui.accShort": "acc",
    "ui.archived": "Archive",
    "ui.trash": "Trash",
    "ui.emptyTrash": "Empty",
    "ui.archiveEmpty": "(empty)",
    "ui.toArchive": "Archive",
    "ui.toTrash": "To trash",
    "ui.restore": "Restore",
    "ui.previewBanner": "Preview (read-only): {title}",
    "ui.closePreview": "Close preview",
    "ui.confirmEmptyTrash": "Empty the subtask trash? Deleted items are gone for good.",
    "ui.confirmEmptyChatTrash": "Empty the chat trash? Trashed chats disappear permanently along with all their history.",
    "tip.chatArchive": "Chat archive. The «🗄» moves a chat to the archive (not deleted). Restore it (↩) back to «Chats» or send it onward to the trash (×) from here.|||closed the «Phase 1» chat → it's archived; a week later you click ↩ and it's back in the list.",
    "tip.chatTrash": "Chat trash. The «×» sends a chat here (recoverable). ↩ returns it to «Chats»; «Empty» deletes it permanently along with all history.|||trashed an unneeded chat → it's in the trash. Changed your mind — ↩ restored it. Or «Empty» to wipe it for good.",
    "tip.subtaskArchive": "Subtask archive. The «🗄» button moves a subtask out of the stack but keeps it. Click an archived one for a read-only preview; ↩ returns it to the stack.|||archived the resolved «pick DB» subtask to keep it out of the way; later clicked it to re-read the decision.",
    "tip.subtaskTrash": "Subtask trash. The «×» sends a subtask here (recoverable). Click for a read-only preview; ↩ restores to the stack; «Empty» deletes permanently.|||made an extra subtask, hit × → in trash. Changed your mind — ↩ restored it. Or «Empty» to wipe the junk.",
    "ui.switcherConnected": "switch module<br>connected",
    "ui.switcherOffline": "switch module<br>not connected",
    "ui.agentsLabel": "connected:",
    "ui.agentReady": "verified, working",
    "ui.agentUnverified": "key set but unverified",
    "ui.agentNoKey": "no key",
    "tip.agentChip": "{prov} · {model} — {status}. Inline agent backend. Colour: green — key passed a live test (or Ollama/CLI); amber — key set but unverified; grey — no key.",
    "ui.toggleStatement": "Expand / collapse the subtask statement",
    "ui.checkUpdates": "Updates",
    "ui.checkUpdatesTitle": "Check for updates on GitHub",
    "ui.updateTitle": "Update",
    "ui.updateChecking": "Checking GitHub for updates…",
    "ui.updateUpToDate": "You are on the latest version ({sha}).",
    "ui.updateAvailable": "Update available: {n} commit(s). Current {local} → new {remote}.",
    "ui.updateChanges": "Changes:",
    "ui.updateApply": "Update",
    "ui.updateApplying": "Updating…",
    "ui.updateDone": "Updated to {head}. Chats and settings are preserved. Restart the app (Council Room v2.bat) to apply.",
    "ui.updateError": "Error: {error}",
    "ui.updateDirtyNote": "⚠️ There are uncommitted local changes — the update may not apply.",
    "ui.switcherStats": "Detailed stats",
    "ui.refreshTokens": "Refresh remaining tokens (tiny request on the cheapest model to each account)",
    "ui.confirmRefresh": "Refresh remaining tokens?\n\nA tiny request («What is 1+3?») is sent to every authorized account (Codex and Claude) on the cheapest model (Codex gpt-5.4-mini / Claude haiku) to update usage data. Shown in the Process trace. Spends a little subscription.",
    "ui.apiTitle": "{tool}: API key",
    "ui.apiSteps": "This is an API-key profile, not an OAuth account.|The key is configured in ai-switcher (profiles / api-keys), not here.|No terminal login is needed.",
    "ui.tabLimits": "Limits",
    "ui.tabSpend": "Spending",
    "ui.tabSub": "Subscription",
    "ui.hourlyReset": "Hourly reset",
    "ui.weeklyReset": "Weekly reset",
    "ui.windowStart": "Window start",
    "ui.used": "used",
    "ui.now": "now",
    "ui.noData": "no data",
    "ui.codexNoData": "no data (run a round on this account)",
    "ui.codexNoSpend": "spend not tracked (not in Codex session logs)",
    "ui.periodToday": "today",
    "ui.periodWeek": "week",
    "ui.periodAll": "all",
    "ui.spendIn": "in",
    "ui.spendOut": "out",
    "ui.sessions": "requests",
    "ui.spendTotal": "total",
    "ui.requests": "requests",
    "ui.apiBadge": "API key",
    "ui.apiNoLimit": "API keys have no limit windows — see spending",
    "ui.resetSpend": "Reset spending",
    "ui.confirmResetSpend": "Reset accumulated spending for all API profiles?\n\nThis only clears local token counters (rooms/.provider-usage.json); it does not affect the provider's actual billing.",
    "ui.subStart": "start",
    "ui.subEnd": "end",
    "ui.daysLeft": "days left: {n}",
    "ui.openLogin": "Open login window",
    "ui.relogin": "Re-login",
    "ui.loginAlready": "✓ This account is already authorized. Re-login is usually unnecessary — only if you have sign-in trouble or switched accounts.",
    "ui.loginTitle": "Authorize: {tool} — account {account}",
    "ui.loginSteps": "A separate terminal window opens in this account's environment.|It runs the login command: {cmd}|Follow the CLI prompts — a browser usually opens. Sign in with the RIGHT account (don't mix them up).|Account 2: credentials save into this account's ai-switcher folder; account 1 — the default one.|After the success message, come back here. You can close the terminal window.",
    "tip.acctBtn": "{tool} — account {account}. Tokens left: {pct}.\nColour: green ≥50%, yellow 16–49%, red 1–15%, grey <1% (exhausted), black — no data / not connected. Click to authorize this account (opens a login window).|||Cx1 grey → Codex acc 1 is out of tokens until the limit resets; clicked it → a login window opened.",
    "tip.switcher": "Switch module (ai-switcher) — multi-account for the agents. Optional: if not connected, everything runs in standard single-account mode.\nConnected = a second account is set up in ai-switcher (auth folders present). Then switching/failover between accounts is available.|||green dot «connected» → you can pick acc 2 and auto-failover. Grey «not connected» → only acc 1.",
    "tip.account": "Mode: auto — on a limit/error the agent switches to the other account and retries the round; manual — the chosen account is pinned, no auto-switch.\nAccount: which to use as the start account (in auto) or the pinned one (in manual). Acc 2 is only available when the switch module is connected.|||Codex auto + acc 1: hits a limit on acc 1 → moves to acc 2 itself. Claude manual + acc 2: always acc 2 only.",
    "tip.strictScope": "Special mode. When on (☑): everything NOT listed in the «Files in Scope» section is automatically considered out of scope, and agents are STRICTLY forbidden to touch it.\nA hard complement rule is injected into the prompt. Handy when it's easier to list what's allowed than what's forbidden.|||«Files in Scope» has three files. Turn on ☑ — agents understand any other project file/folder must not be touched, even if not explicitly listed in «Files Out of Scope».",
    "tip.stopStatus": "Stop — interrupt the current process. The round is cancelled cooperatively (agents in the terminals stop), the partial result is discarded.",
    "tip.autopilot": "Autopilot: Codex and Claude ping-pong on the active subtask without you.\nThe loop stops on its own when a stop-condition fires: both resolve, two stale rounds in a row (stale×2), block, or the per-mode round budget is hit (LIGHT 3 / STANDARD 6 / STRICT 10 / CRITICAL 12).\nClick again (⏹ Stop) to interrupt — the current round is cancelled cooperatively.|||a STANDARD-mode subtask is open. You click «Autopilot ▶» — rounds 1,2,3 run. On round 4 both agents return Status: resolve → loop stops with «debate-complete», coach suggests «Resolve».",
    "tip.autoResolve": "When on and autopilot hits debate-complete (both resolve), the subtask is closed automatically with a short summary from the Knowledge Base — no extra agent call.\nWhen off (default) the autopilot just stops and you resolve it yourself (with your own summary).|||unchecked: on debate-complete the loop stops, you type a summary «stop = stale×2 OR token<25%» and click «Resolve». Checked: the loop resolves it itself with a summary built from the Decisions section.",
    "tip.terminals": "Live output (stdout+stderr) of both agents during a round.\nCleared at the start of each round. The ▾/▴ toggle collapses the panel; the state is persisted between sessions.|||during an autopilot round you watch Codex stream its reasoning on the left, Claude on the right. Useful to tell whether an agent is stuck or thinking.",
    "coach.autopilot.title": "Autopilot running",
    "coach.autopilot.body": "Codex and Claude are going round after round on the active subtask. It stops on its own at a stop-condition (both resolve / stale×2 / block / round budget). You can interrupt anytime.",
    "coach.autopilot.action": "⏹ Stop autopilot",
    "ui.providersPanel": "Agent registration",
    "ui.profiles": "Profile",
    "ui.registeredModels": "Registered models",
    "ui.regModelLabel": "Label",
    "ui.regModelAgent": "Agent",
    "ui.regModelModel": "Model",
    "ui.regModelEffort": "Effort",
    "ui.regModelSpeed": "Speed",
    "ui.noNewProfiles": [
      "No new profiles? Click «+ Profile» to add one.",
      "Click «+ Profile», sweetie.",
      "Hit «+ Profile», you leather-clad legend!!! :)",
      "Click «+ Profile» and a hamster appears! 🐹",
      "One button, endless possibilities. Click «+ Profile».",
      "Empty in here… «+ Profile» is waiting for you!",
      "Agents? None. Fix that with «+ Profile» 👇",
      "AI agents don't self-replicate. Click «+ Profile»! 🤖",
      "Your deadline is sobbing in the corner. «+ Profile» to the rescue. 😭",
      "Weather forecast: high chance of clicking «+ Profile». ⛅",
      "My grandpa always said: register a profile, kiddo. Wise man. 👴",
      "ChatGPT would've clicked already. What about you? 😏",
      "«+ Profile» — the one button that will change your life. Or at least your chat.",
      "No agents, no glory. «+ Profile» brings both! 🙌",
      "Neighbour Karen has already clicked «+ Profile» three times. Keep up! 👀",
      "Riddle: what do you press to summon agents? 🏆 Correct!",
      "Hey you, yeah YOU! The «+ Profile» button is staring at you. 👁️",
    ],
    "ui.regModelNoProfiles": "No registered models. Add a profile in «Agent registration».",
    "ui.regModelSaved": "Model saved",
    "ui.providerLog": "Event log",
    "ui.providerLogClear": "Clear",
    "ui.providerLogEmpty": "Log is empty",
    "ui.regModelRetest": "Check model availability",
    "ui.regModelTesting": "Testing…",
    "ui.addProfile": "+ Profile",
    "ui.applyProviders": "Apply",
    "ui.providersSaved": "Saved ✓",
    "ui.profileModelRequired": "Enter a model name for «{label}» (e.g. llama3.2, gpt-4o-mini)",
    "ui.ollamaSelectModel": "— select model —",
    "ui.ollamaRegisterHint": "← register in «Agent registration»",
    "ui.ollamaNoModels": "Ollama not running?",
    "ui.ollamaDetected": "Ollama detected on port {port} · {n} model{suffix}",
    "ui.ollamaNotFound": "Ollama not detected (checked port {port})",
    "ui.ollamaChecking": "Checking Ollama…",
    "ui.ollamaTesting": "Testing Ollama connection…",
    "ui.ollamaTestingModel": "Testing: {model}…",
    "ui.ollamaConnected": "✓ Connected",
    "ui.ollamaConnectedModels": "✓ Connected: {models}",
    "ui.ollamaNotConnected": "✗ Not connected: {e}",
    "ui.noProfiles": "No profiles — the round uses the default Codex/Claude behavior.",
    "ui.profileProvider": "Provider",
    "ui.profileModel": "Model",
    "ui.profileAccount": "Account",
    "ui.profileBaseUrl": "Base URL",
    "ui.profileCredRef": "API key env var",
    "ui.profileApiKey": "API key (enter directly)",
    "ui.profileLabel": "Label",
    "ui.keySet": "key set",
    "ui.keyMissing": "key missing",
    "ui.keyKeepPlaceholder": "key set — leave empty to keep it",
    "ui.providersKeySaved": "Key(s) saved to .env ✓",
    "ui.keyNeedsRef": "A key was entered but profile «{p}» has no env var name. Fill the «API key env var» field.",
    "ui.keyTesting": "Testing key with a tiny request…",
    "ui.keyWorks": "Key works ✓ (reply: «{reply}») — saved to .env",
    "ui.keyFailed": "Key failed the test: {e}",
    "ui.keyTestNeedsModel": "Set a model in this profile first to test the key.",
    "ui.keyVerified": "Key verified with a live request — working (green check).",
    "ui.keyUnverified": "Key is set but unverified (amber check). Enter/re-enter the key in the field — it will be tested automatically.",
    "ui.remove": "Remove",
    "tip.providersPanel": "Agent registration: register and authorize backends here. A profile is a named backend: an API provider (key from .env), local Ollama, or (full build) a subscription CLI. Registered profiles become available when you pick debate agents (the \"Add agent\" button in the chat header).|||Register a \"DeepSeek\" profile with key DEEPSEEK_API_KEY → it shows up in the backend list when you add an agent to a chat.",
    "tip.registeredModels": "Global list of registered models — available in all chats. Quickly change the model or effort without opening «Agent registration». Changes save immediately.|||Switched Ollama model from llama3.2 to qwen2.5 — the next «Add agent» will pick the new one.",
    "tip.agentSettings": "Agent language and a QUICK picker for the two standard debaters — Codex and Claude model/effort/account. Simple default path. To wire in API providers/Ollama use «Agent registration» (in API mode these simple controls are hidden).|||Want to quickly switch Codex to gpt-5.4-mini — do it here. Want to add DeepSeek or Ollama — use «Agent registration».",
    "tip.profileLabel": "Human-readable name for the profile — display only (in the agent chip and round logs). It has no effect on the request. If left empty, the technical id is shown (e.g. p_mprga7ou).|||«DeepSeek main», «Ollama local».",
    "tip.profileModel": "The provider's model id — the exact string it expects in the request's model field. Take it from the provider's docs. For CLI you can leave «auto».|||DeepSeek: deepseek-chat / deepseek-reasoner · OpenAI: gpt-4o-mini · Groq: llama-3.3-70b-versatile · Ollama: llama3.1 (whatever `ollama list` shows).",
    "tip.profileBaseUrl": "The provider's API root, ending in /v1 (the adapter appends /chat/completions). Auto-filled for a preset — change it only for a custom/proxy endpoint or a self-hosted Ollama.|||https://api.deepseek.com/v1 · http://localhost:11434/v1 (Ollama).",
    "tip.profileCredRef": "Name of the environment variable holding the API key (e.g. DEEPSEEK_API_KEY). The key itself lives in .env (gitignored) or the environment — NEVER in the repo or state.json. You can either type the key directly in the field below, or add the line to .env yourself.|||DEEPSEEK_API_KEY → a line DEEPSEEK_API_KEY=sk-... in .env",
    "tip.profileApiKey": "You can paste the API key right here — on «Apply» it is saved to the .env file (gitignored) under the «API key env var» name, NOT to state.json. The field is always blank (the key is never shown); leave it empty to keep the already-saved key.|||Paste sk-... → .env gets DEEPSEEK_API_KEY=sk-...",
    "ui.addAgent": "Add agent",
    "ui.addAgentTitle": "Add agent",
    "ui.addAgentChoose": "How to add agents to the debate?",
    "ui.agentAddAuto": "Auto — 2 distinct",
    "ui.agentAddAutoHint": "Pick 2 distinct available backends with cheap models.",
    "ui.agentAddManual": "Manually (+1)",
    "ui.agentAddManualHint": "Add one agent and configure it.",
    "ui.agentsHeader": "Debate agents",
    "ui.agentEditorEmpty": "Click an agent chip in the header to set its backend, model and effort.",
    "ui.agentBackend": "Agent (backend)",
    "ui.agentModel": "Model",
    "ui.agentEffort": "Effort",
    "ui.agentLabelField": "Label",
    "ui.agentApply": "Apply",
    "ui.agentRemove": "Remove agent",
    "ui.agentSaved": "Agents saved ✓",
    "ui.agentNoBackends": "No available backends. Register/authorize one in «Agent registration».",
    "ui.noRegisteredAgents": "No agents<br>registered",
    "tip.noRegisteredAgents": "No backends registered yet. Add a profile in the «Agent registration» panel (right column).",
    "ui.agentMin2": "At least 2 agents are required to run a round.",
    "ui.agentMax": "Maximum 5 agents.",
    "ui.agentNoneYet": "No agents selected",
    "ui.agentChipHint": "Click — configure · ×: remove",
    "ui.tokenWarnTitle": "Token spend",
    "ui.tokenWarn2": "2 agents — basic debate, moderate spend.",
    "ui.tokenWarn3": "3 agents: each sees the FULL context of the other two — spend grows noticeably (≈×1.5 per round).",
    "ui.tokenWarn4": "4 agents: full context ×4, no compression — expensive. That's 4 backends/subscriptions per round.",
    "ui.tokenWarn5": "5 agents — the maximum. Very expensive: full context ×5 for each, no prompt compression.",
    "coach.agents.title": "Step 3: pick your agents",
    "coach.agents.body": "At the top center click «Add agent». Use «Auto» (2 distinct backends are picked for you) or «Manually». Minimum 2, maximum 5. More agents = a pricier round (prompts are not compressed).",
    "coach.agents.action": "Add agent",
    "coach.ollamaReg.title": "Register Ollama first",
    "coach.ollamaReg.body": "You picked Ollama as backend but no profile is registered yet. Open «Agent registration» panel on the right → click «+ Profile» → select Ollama → enter a model name (e.g. llama3.2) → click «Apply». The model will then appear in the backend list.",
    "coach.ollamaReg.action": "Open registration",
    "coach.agentsConfig.title": "Step 4: check the agents' models",
    "coach.agentsConfig.body": "Weak models and low effort are pre-filled by default — cheap. Click an agent chip at the top to change its backend/model/effort. When ready, run the round.",
    "coach.agentsConfig.action": "Run round",
    "tip.addAgent": "Adds a debater (2 to 5). «Auto» picks 2 distinct available backends with cheap models; «Manually» adds one for you to configure. Every agent sees the full context of all the others — so each added agent noticeably raises token spend.|||2 agents — a basic debate. 4–5 — expensive: full context ×N per round.",
    "tip.agentBackend": "Which backend powers this agent: a subscription CLI (Codex/Claude, per account), a network API provider, or local Ollama. The list comes from what's available: authorized accounts + registered providers.|||«Codex · acc 1», «Claude · acc 2», «DeepSeek», «Ollama (local)».",
    "tip.agentModel2": "The chosen backend's model. Defaults to the cheapest (token economy). For CLI — from a list; for a network provider — the exact model string.|||Codex: gpt-5.4-mini (cheap) … gpt-5.5. Claude: haiku … opus. DeepSeek: deepseek-chat.",
    "tip.agentEffort2": "Reasoning effort (subscription CLI only). Defaults to low — cheap and fast. Higher = pricier and slower but more thorough. Network providers have no such knob.|||low — a quick draft pass; high/xhigh/max — for hard contested points.",
    "ui.documents": "Documents",
    "ui.docAddFile": "+ File",
    "ui.docAdd": "Add",
    "ui.docNamePlaceholder": "Name (opt.)",
    "ui.docPastePlaceholder": "…or paste document text",
    "ui.docEmpty": "No documents. Attach a text file or paste text — it goes into the agents' context for the round.",
    "ui.docRemove": "Remove document",
    "ui.docAdded": "Document added ✓",
    "ui.docCharsBadge": "{docs} doc · {chars} chars",
    "ui.docChars": "{n} chars",
    "ui.docBudgetNote": "Up to ~{n} chars total go into the prompt (truncated beyond that). Mind the tokens.",
    "tip.documents": "Text documents attached to this chat — reference material injected into every round's prompt as an ATTACHED DOCUMENTS section. Unlike filesystem scanning, this is a source you explicitly provided, so it's allowed even in isolated mode. Up to ~12000 chars total go into the prompt (truncated beyond) — watch the spend.|||Attach an API spec or a log snippet → agents cite it in the debate instead of guessing.",
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
  let value = dict[key] ?? STRINGS.ru[key] ?? key;
  // Arrays = random rotation (e.g. fun "no profiles" messages).
  if (Array.isArray(value)) value = value[Math.floor(Math.random() * value.length)];
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
  // The UI uses body `zoom` for font scaling; getBoundingClientRect/innerHeight are
  // in visual px, but a fixed element's style offsets get multiplied by zoom — so
  // we compute everything in visual px and divide the final offsets by zoom.
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const margin = 8;
  const gap = 6;
  const a = anchor.getBoundingClientRect();
  let tr = tooltipEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - a.bottom - margin - gap;
  const spaceAbove = a.top - margin - gap;
  // Prefer below; flip above if it doesn't fit; if neither fits, use the larger side.
  let placeAbove;
  if (tr.height <= spaceBelow) placeAbove = false;
  else if (tr.height <= spaceAbove) placeAbove = true;
  else placeAbove = spaceAbove > spaceBelow;
  const avail = placeAbove ? spaceAbove : spaceBelow;
  // Cap height to the chosen side so the tooltip never overlaps the anchor button.
  if (tr.height > avail) {
    tooltipEl.style.maxHeight = `${Math.max(60, avail) / zoom}px`;
    tr = tooltipEl.getBoundingClientRect();
  }
  let top = placeAbove ? a.top - tr.height - gap : a.bottom + gap;
  let left = a.left;
  if (left + tr.width > window.innerWidth - 10) left = window.innerWidth - tr.width - 10;
  if (left < 6) left = 6;
  tooltipEl.style.top = `${top / zoom}px`;
  tooltipEl.style.left = `${left / zoom}px`;
}
function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

// Render the docked bottom panel from the live coach state (kept current so its
// tone/colour reflects the actual situation, not a stale snapshot).
function renderPinnedHint() {
  const panel = $("pinnedHint");
  if (!panel) return;
  if (!coachPinned) { panel.classList.add("hidden"); return; }
  const step = computeNextStep();
  if (!step) { panel.classList.add("hidden"); return; }
  $("pinnedHintTitle").textContent = step.title;
  const body = $("pinnedHintBody");
  body.innerHTML = "";
  const textDiv = document.createElement("div");
  textDiv.className = "tt-text";
  textDiv.textContent = step.body;
  body.appendChild(textDiv);
  panel.classList.remove("hidden");
  panel.classList.toggle("tone-danger", step.tone === "danger");
  panel.classList.toggle("tone-ok", step.tone === "ok");
  panel.classList.toggle("tone-warn", step.tone === "warn");
}

// Pin button on the floating coach → dock guidance at the bottom, hide floating.
function pinCoach() {
  if (!computeNextStep()) return;
  coachPinned = true;
  saveCoachPinned();
  renderPinnedHint();
  renderNextStep();
}

// Pin button on the docked panel → restore the floating coach (unfold).
function unpinCoach() {
  coachPinned = false;
  saveCoachPinned();
  nextStepDismissed = false;
  $("pinnedHint").classList.add("hidden");
  renderNextStep();
}

// Close (×) on the docked panel → fully close; floating stays dismissed (💡 reopen remains).
function closeCoachPinned() {
  coachPinned = false;
  saveCoachPinned();
  nextStepDismissed = true;
  $("pinnedHint").classList.add("hidden");
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
// One live buffer per participant slot key (codex/claude legacy, or a1..a5).
// Panes are created on demand so the count follows the chat's participants.
const termBuffers = {};

// Ensure a <pre> pane exists for `key`, creating it (with a label header) on first
// use. Returns the <pre> element, or null if the container isn't mounted.
function ensureTermPane(key, label) {
  const safe = String(key).replace(/[^A-Za-z0-9._-]/g, "_");
  let pre = document.getElementById(`term-${safe}`);
  if (!pre) {
    const body = $("terminalsBody");
    if (!body) return null;
    const pane = document.createElement("div");
    pane.className = "terminal-pane";
    const lbl = document.createElement("div");
    lbl.className = "terminal-label";
    lbl.id = `termlabel-${safe}`;
    lbl.textContent = label || key;
    pre = document.createElement("pre");
    pre.className = "terminal";
    pre.id = `term-${safe}`;
    pane.appendChild(lbl);
    pane.appendChild(pre);
    body.appendChild(pane);
  } else if (label) {
    const lbl = document.getElementById(`termlabel-${safe}`);
    if (lbl) lbl.textContent = label;
  }
  return pre;
}

function appendTerminal(key, chunk, reset, label) {
  const el = ensureTermPane(key, label);
  if (!el) return;
  if (reset) {
    termBuffers[key] = "";
  } else {
    termBuffers[key] = ((termBuffers[key] || "") + chunk).slice(-TERM_CAP);
  }
  el.textContent = termBuffers[key];
  el.scrollTop = el.scrollHeight;
  updateTerminalsVisibility();
}

// Hide the terminals section entirely while there's nothing to show (no buffered
// output and no round in progress).
function updateTerminalsVisibility() {
  const section = $("terminals");
  if (!section) return;
  const hasContent = Object.values(termBuffers).some((b) => b && b.trim());
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
      if (!data.agent) return; // slot key: codex/claude (legacy) or a1..a5
      appendTerminal(data.agent, data.chunk || "", Boolean(data.reset), data.label);
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
  // Clear the Ollama registration hint once a profile is saved.
  if (pendingOllamaRegistration && hasRegisteredOllamaProfile()) {
    pendingOllamaRegistration = false;
  }
  // Green border on Updates button when an update is available.
  const hasUpdate = Boolean(currentState.updateStatus && currentState.updateStatus.updateAvailable);
  $("checkUpdates")?.classList.toggle("update-available", hasUpdate);
  renderRuns();
  renderStatus();
  renderSubtasks();
  renderActiveSubtask();
  renderConversation();
  renderKnowledge();
  renderDocuments();
  renderSettings();
  renderAgentsInit();
  renderRegisteredModels();
  renderNextStep();
  renderPinnedHint();
  renderSwitcher();
  updateTerminalsVisibility();
}

// Phase 6b: how many debate agents the active chat has explicitly chosen, and
// whether a fresh subtask is still missing the required minimum (2). Legacy
// chats with history (rounds > 0) are never blocked — they ran with defaults.
function selectedAgentCount() {
  return (currentState?.settings?.participants?.length) || 0;
}
function needsAgents() {
  const active = currentState?.run?.activeSubtask;
  return Boolean(active) && (active.rounds || 0) === 0 && selectedAgentCount() < 2;
}

// ---- Next-step coach -----------------------------------------------------

// Set when the user picks the fallback "Ollama (local)" backend that has no
// registered profile yet. Cleared once a real Ollama profile appears in state.
let pendingOllamaRegistration = false;

function hasRegisteredOllamaProfile() {
  return ((currentState.settings && currentState.settings.profiles) || [])
    .some((p) => p.provider === "ollama");
}

let nextStepDismissed = false;
let subtaskStatementExpanded = false; // subtask-statement field: collapsed (2 lines) ↔ full
// UI-chrome prefs below are global (per-browser) and persisted in localStorage so
// they survive reload / PC reboot — same store as font scale and language.
let coachPinned = localStorage.getItem("council-room-v2.coachPinned") === "true";
const PANELS_KEY = "council-room-v2.panels";
const panelOpen = (() => {
  const def = { chatArchive: false, chatTrash: false, subtaskArchive: false, subtaskTrash: false, switcherStats: false };
  try { return { ...def, ...JSON.parse(localStorage.getItem(PANELS_KEY) || "{}") }; } catch { return def; }
})();
function savePanelOpen() { try { localStorage.setItem(PANELS_KEY, JSON.stringify(panelOpen)); } catch {} }
function saveCoachPinned() { try { localStorage.setItem("council-room-v2.coachPinned", String(coachPinned)); } catch {} }
let showTrashedMsgs = false; // header toggle: reveal the response bin
let previewSubtaskId = null;

function openPreview(id) {
  previewSubtaskId = id;
  render();
}
function closePreview() {
  previewSubtaskId = null;
  render();
}

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
      highlight: ["newRun", "runList"],
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
  if (pendingOllamaRegistration && !hasRegisteredOllamaProfile()) {
    return {
      title: t("coach.ollamaReg.title"),
      body: t("coach.ollamaReg.body"),
      action: { label: t("coach.ollamaReg.action"), target: "providersDetails" },
      highlight: ["providersDetails"],
      tone: "warn",
    };
  }
  if (!active && !subtasks.length) {
    return {
      title: t("coach.step2.title"),
      body: t("coach.step2.body"),
      action: { label: t("coach.step2.action"), target: "openSubtask" },
      highlight: ["openSubtask"],
    };
  }
  if (!active) {
    // No open one, but stack has items
    const allResolved = subtasks.every((st) => st.status === "resolved");
    if (allResolved) {
      return { title: t("coach.allDone.title"), body: t("coach.allDone.body"), action: null, tone: "ok" };
    }
    return {
      title: t("coach.step2.title"),
      body: t("coach.step2.body"),
      action: { label: t("coach.step2.action"), target: "openSubtask" },
      highlight: ["openSubtask"],
    };
  }
  if (s.busy) {
    return { title: t("coach.busy.title"), body: t("coach.busy.body"), action: null };
  }
  if (active.rounds === 0) {
    // Phase 6b: agents must be chosen (2–5) before the first round.
    if (selectedAgentCount() < 2) {
      return {
        title: t("coach.agents.title"),
        body: t("coach.agents.body"),
        action: { label: t("coach.agents.action"), target: "addAgent" },
        highlight: ["addAgent"],
      };
    }
    return {
      title: t("coach.agentsConfig.title"),
      body: t("coach.agentsConfig.body"),
      action: { label: t("coach.agentsConfig.action"), target: "runRound" },
      // "галочки / документы / запуск всё подсвечивается" — the optional configure
      // controls + both run paths glow until the round starts.
      highlight: ["agentChips", "documentsPanel", "allowFilesystemScan", "autoResolve", "runRound", "autopilot"],
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
        tone: "ok",
      };
    }
    if (statuses.some((st) => st === "block")) {
      return { title: t("coach.block.title"), body: t("coach.block.body"), action: null, tone: "danger" };
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
    tone: "warn",
  };
}

// Navigator highlights: persistently glow the control(s) the current step points
// at, until the step is satisfied. computeNextStep recomputes every render, so a
// highlight clears itself the moment its step is done. Cleared while the coach is
// dismissed (quiet mode). This is the "подсвечивает кнопку … гаснет когда сделано"
// behavior threaded through every onboarding step.
let navHighlighted = [];
function applyNavHighlights(ids) {
  const want = new Set(ids || []);
  for (const id of navHighlighted) {
    if (!want.has(id)) { const el = $(id); if (el) el.classList.remove("nav-highlight"); }
  }
  for (const id of want) { const el = $(id); if (el) el.classList.add("nav-highlight"); }
  navHighlighted = [...want];
}

function renderNextStep() {
  const step = computeNextStep();
  const panel = $("nextStep");
  const reopen = $("nextStepReopen");
  applyNavHighlights(step && !nextStepDismissed ? (step.highlight || []) : []);
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
  } else if (el.tagName === "DETAILS") {
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.click();
  }
  el.classList.add("coach-highlight");
  setTimeout(() => el.classList.remove("coach-highlight"), 4500);
}

function renderRuns() {
  const allRuns = currentState.runs || [];
  const active = allRuns.filter((r) => !r.archived && !r.trashed);
  const archived = allRuns.filter((r) => r.archived && !r.trashed);
  const trashed = allRuns.filter((r) => r.trashed);

  const list = $("runList");
  list.innerHTML = "";
  for (const run of active) {
    const li = document.createElement("li");
    if (run.id === currentState.activeRunId) li.classList.add("active");
    li.innerHTML = `<span>${escapeHtml(run.topic)}</span><span class="run-actions">`
      + `<button class="archive-run" title="${escapeHtml(t("ui.toArchive"))}">🗄</button>`
      + `<button class="trash-run" title="${escapeHtml(t("ui.toTrash"))}">×</button></span>`;
    li.addEventListener("click", (event) => {
      if (event.target.classList.contains("archive-run")) { api("POST", "/api/runs/archive", { runId: run.id }); return; }
      if (event.target.classList.contains("trash-run")) { api("POST", "/api/runs/trash", { runId: run.id }); return; }
      api("POST", "/api/runs/switch", { runId: run.id });
    });
    list.appendChild(li);
  }

  // Chat archive panel — restore back to active, or send onward to the trash.
  $("toggleChatArchive").textContent = `🗄${archived.length ? " " + archived.length : ""}`;
  $("chatArchive").classList.toggle("hidden", !panelOpen.chatArchive);
  fillRunBin($("archivedRunList"), archived, { trash: true });

  // Chat trash panel — hide button and panel when empty.
  $("toggleChatTrash").style.display = trashed.length ? "" : "none";
  if (!trashed.length) panelOpen.chatTrash = false;
  $("chatTrash").classList.toggle("hidden", !panelOpen.chatTrash);
  fillRunBin($("trashedRunList"), trashed, { trash: false });
}

// Render a chat bin list (archive or trash). Every row can be restored; archive
// rows additionally offer a "× → trash" action (withTrash).
function fillRunBin(listEl, runs, { trash: withTrash }) {
  listEl.innerHTML = "";
  if (!runs.length) {
    const empty = document.createElement("li");
    empty.className = "muted small";
    empty.style.cursor = "default";
    empty.textContent = t("ui.archiveEmpty");
    listEl.appendChild(empty);
    return;
  }
  for (const run of runs) {
    const li = document.createElement("li");
    li.classList.add("archived-row");
    let actions = `<button class="restore-run" title="${escapeHtml(t("ui.restore"))}">↩</button>`;
    if (withTrash) actions += `<button class="trash-run" title="${escapeHtml(t("ui.toTrash"))}">×</button>`;
    li.innerHTML = `<span>${escapeHtml(run.topic)}</span><span class="run-actions">${actions}</span>`;
    li.querySelector(".restore-run").addEventListener("click", (event) => {
      event.stopPropagation();
      api("POST", "/api/runs/restore", { runId: run.id });
    });
    const trashBtn = li.querySelector(".trash-run");
    if (trashBtn) trashBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      api("POST", "/api/runs/trash", { runId: run.id });
    });
    listEl.appendChild(li);
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

function makeIconBtn(cls, glyph, title, handler) {
  const b = document.createElement("button");
  b.className = cls;
  b.type = "button";
  b.textContent = glyph;
  b.title = title;
  b.addEventListener("click", (event) => { event.stopPropagation(); handler(); });
  return b;
}

function renderSubtaskRow(st, context) {
  const li = document.createElement("li");
  li.classList.add(st.status);
  if (context === "stack" && st.rounds === 0 && st.status !== "resolved") li.classList.add("editable");
  if (previewSubtaskId === st.id) li.classList.add("previewing");

  const titleSpan = document.createElement("span");
  titleSpan.className = "subtask-title";
  titleSpan.textContent = st.title;
  li.appendChild(titleSpan);

  const right = document.createElement("span");
  right.className = "subtask-actions";
  if (context === "stack") {
    if (st.rounds === 0 && st.status !== "resolved") {
      right.appendChild(makeIconBtn("subtask-edit", "✎", t("ui.editIcon"), () => openSubtaskModal({ editId: st.id, title: st.title, mode: st.mode })));
    }
    right.appendChild(makeIconBtn("subtask-archive", "🗄", t("ui.toArchive"), () => api("POST", "/api/subtasks/archive", { id: st.id })));
    right.appendChild(makeIconBtn("subtask-delete", "×", t("ui.toTrash"), () => api("POST", "/api/subtasks/trash", { id: st.id })));
  } else {
    right.appendChild(makeIconBtn("subtask-restore", "↩", t("ui.restore"), () => api("POST", "/api/subtasks/restore", { id: st.id })));
  }
  li.appendChild(right);

  const tag = document.createElement("span");
  tag.className = "subtask-tag";
  tag.textContent = `${st.id.slice(-6)} · ${st.mode} · R${st.rounds}`;
  li.appendChild(tag);

  li.title = `${st.status} — ${st.id}`;
  if (context === "stack") {
    if (st.status === "pending" || st.status === "frozen" || st.status === "resolved") {
      li.style.cursor = "pointer";
      li.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        if (st.status === "resolved" && !confirm(t("ui.confirmReopen"))) return;
        api("POST", "/api/subtasks/reopen", { id: st.id });
      });
    }
  } else {
    // Archived / trashed → click opens a read-only preview in the center.
    li.style.cursor = "pointer";
    li.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openPreview(st.id);
    });
  }
  return li;
}

function renderSubtasks() {
  const all = currentState.run?.subtasks || [];
  const stack = all.filter((s) => !s.bin);
  const archived = all.filter((s) => s.bin === "archive");
  const trashed = all.filter((s) => s.bin === "trash");

  const list = $("subtaskList");
  list.innerHTML = "";
  if (!stack.length) {
    const empty = document.createElement("li");
    empty.className = "muted small";
    empty.style.cursor = "default";
    empty.textContent = t("ui.openFirstHint");
    list.appendChild(empty);
  } else {
    for (const st of stack) list.appendChild(renderSubtaskRow(st, "stack"));
  }

  $("toggleSubtaskArchive").textContent = `🗄${archived.length ? " " + archived.length : ""}`;
  $("toggleSubtaskTrash").textContent = `🗑${trashed.length ? " " + trashed.length : ""}`;
  // Hide trash/archive buttons and panels when empty.
  $("toggleSubtaskArchive").style.display = archived.length ? "" : "none";
  $("toggleSubtaskTrash").style.display = trashed.length ? "" : "none";
  if (!archived.length) panelOpen.subtaskArchive = false;
  if (!trashed.length) panelOpen.subtaskTrash = false;
  $("subtaskArchive").classList.toggle("hidden", !panelOpen.subtaskArchive);
  $("subtaskTrash").classList.toggle("hidden", !panelOpen.subtaskTrash);

  const fillBin = (listEl, items, context) => {
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "muted small";
      empty.style.cursor = "default";
      empty.textContent = t("ui.archiveEmpty");
      listEl.appendChild(empty);
      return;
    }
    for (const st of items) listEl.appendChild(renderSubtaskRow(st, context));
  };
  fillBin($("archivedSubtaskList"), archived, "archive");
  fillBin($("trashedSubtaskList"), trashed, "trash");
}

function renderActiveSubtask() {
  const active = currentState.run?.activeSubtask;
  const autopilotRunning = Boolean(currentState.autopilot?.running);
  // Subtask statement — its own field below the buttons, above the chat. Shown
  // clamped to 2 lines; the ▾ toggle (only when it actually overflows) opens it.
  const stEl = $("subtaskStatementText");
  const stToggle = $("toggleSubtaskStatement");
  if (stEl && stToggle) {
    stEl.textContent = active ? active.title : t("ui.noActiveSubtask");
    stEl.classList.add("clamped"); // measure overflow against the 2-line clamp
    const overflowing = stEl.scrollHeight - stEl.clientHeight > 2;
    if (!overflowing) subtaskStatementExpanded = false;
    stToggle.classList.toggle("hidden", !overflowing);
    stEl.classList.toggle("clamped", !subtaskStatementExpanded);
    stToggle.textContent = subtaskStatementExpanded ? "▴" : "▾";
    stToggle.setAttribute("aria-expanded", String(subtaskStatementExpanded));
  }
  $("activeSubtaskMeta").textContent = active
    ? t("ui.subtaskMeta", { id: active.id, mode: active.mode, rounds: active.rounds })
    : t("ui.noActiveSubtaskHint");
  $("runRound").disabled = !active || currentState.busy || autopilotRunning || needsAgents();
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
  // While running, Stop must stay clickable; otherwise needs an active subtask
  // and the minimum agents chosen (Phase 6b).
  btn.disabled = running ? false : (!active || currentState.busy || needsAgents());
  const autoResolve = $("autoResolve");
  if (autoResolve) autoResolve.disabled = running;
}

// Service/trace messages carry a Russian variant (textRu); show it when the UI
// is Russian, English (text) otherwise. Agent replies have no textRu → their own
// language. Switches live on language toggle (render() re-runs).
function msgText(msg) {
  return (UI_LANG === "ru" && msg.textRu) ? msg.textRu : (msg.text || "");
}

function renderConversation() {
  const target = $("conversation");
  const trace = $("traceList");
  // Preserve the reading position: only auto-scroll to the bottom when the user
  // is already near it. Re-renders fire on every SSE broadcast (frequent during
  // autopilot), so an unconditional scroll-to-bottom yanks the user away from
  // whatever response they're reading.
  const stick = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
  const prevScrollTop = target.scrollTop;
  target.innerHTML = "";
  trace.innerHTML = "";
  const messages = currentState.run?.messages || [];
  const active = currentState.run?.activeSubtask;

  // Read-only preview of an archived/trashed subtask: show its messages + a banner.
  const previewSt = previewSubtaskId
    ? (currentState.run?.subtasks || []).find((s) => s.id === previewSubtaskId)
    : null;
  if (previewSt) {
    const banner = document.createElement("div");
    banner.className = "preview-banner";
    banner.innerHTML = `<span>${escapeHtml(t("ui.previewBanner", { title: previewSt.title }))}</span><button class="ghost small" id="closePreviewBtn" type="button">${escapeHtml(t("ui.closePreview"))}</button>`;
    target.appendChild(banner);
    banner.querySelector("#closePreviewBtn").addEventListener("click", closePreview);
    for (const msg of messages.filter((m) => m.subtaskId === previewSt.id)) {
      if (msg.kind === "process" || msg.kind?.startsWith("subtask-")) continue;
      const card = document.createElement("div");
      card.className = `msg ${msg.role}`;
      const meta = msg.round ? `R${msg.round}` : msg.kind || "";
      card.innerHTML = `<div class="name"><span>${escapeHtml(msg.name)}</span><span>${escapeHtml(meta)} · ${formatTime(msg.at)}</span></div><div class="text">${escapeHtml(msg.text)}</div>`;
      target.appendChild(card);
    }
    return;
  }

  const filtered = active ? messages.filter((m) => !m.subtaskId || m.subtaskId === active.id) : messages;
  for (const msg of filtered) {
    const isProcess = msg.kind === "process" || msg.kind?.startsWith("subtask-");
    if (isProcess) {
      const row = document.createElement("div");
      row.className = "trace-row";
      row.textContent = `[${formatTime(msg.at)}] ${msg.name}: ${msgText(msg)}`;
      trace.appendChild(row);
      continue;
    }
    if (msg.trashed) continue; // hidden from the main feed; shown in the response bin
    const card = document.createElement("div");
    card.className = `msg ${msg.role}`;
    const meta = msg.round ? `R${msg.round}` : msg.kind || "";
    // Agent responses can be trashed (excluded from the feed and the next round's context).
    const trashBtn = msg.role === "agent"
      ? `<button class="msg-trash" type="button" data-id="${escapeHtml(msg.id)}" title="${escapeHtml(t("ui.trashResponse"))}">🗑</button>`
      : "";
    card.innerHTML = `
      <div class="name"><span>${escapeHtml(msg.name)}</span><span class="name-right">${escapeHtml(meta)} · ${formatTime(msg.at)}${trashBtn}</span></div>
      <div class="text">${escapeHtml(msgText(msg))}</div>
    `;
    target.appendChild(card);
  }

  // Response bin: trashed agent responses with a Restore button (toggled in the header).
  if (showTrashedMsgs) {
    const trashed = filtered.filter((m) => m.trashed && m.role === "agent");
    const bin = document.createElement("div");
    bin.className = "msg-bin";
    const head = document.createElement("div");
    head.className = "msg-bin-head";
    head.textContent = t("ui.msgTrash");
    bin.appendChild(head);
    if (!trashed.length) {
      const empty = document.createElement("div");
      empty.className = "msg-bin-empty muted small";
      empty.textContent = t("ui.trashedEmpty");
      bin.appendChild(empty);
    } else {
      for (const msg of trashed) {
        const card = document.createElement("div");
        card.className = `msg ${msg.role} trashed`;
        const meta = msg.round ? `R${msg.round}` : msg.kind || "";
        card.innerHTML = `
          <div class="name"><span>${escapeHtml(msg.name)}</span><span class="name-right">${escapeHtml(meta)} · ${formatTime(msg.at)}<button class="msg-restore" type="button" data-id="${escapeHtml(msg.id)}">↩ ${escapeHtml(t("ui.restoreResponse"))}</button></span></div>
          <div class="text">${escapeHtml(msg.text)}</div>
        `;
        bin.appendChild(card);
      }
    }
    target.appendChild(bin);
  }
  // Stick to the bottom only if the user was already there; otherwise keep their place.
  target.scrollTop = stick ? target.scrollHeight : prevScrollTop;
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

    if (key === "open_questions") {
      renderQuestionsBlock(block, tools, help, label);
      target.appendChild(block);
      continue;
    }

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

function renderQuestionsBlock(block, tools, help, label) {
  const qs = currentState.run?.questions || [];
  const open = qs.filter((q) => q.status === "open");
  const resolved = qs.filter((q) => q.status === "resolved");
  const verified = qs.filter((q) => q.status === "verified");
  const criticalOpen = open.filter((q) => q.priority === "critical");
  const minorOpen = open.filter((q) => q.priority === "minor");

  // VERIFY badge once no CRITICAL question is open (minor open ones are deferred).
  if (!criticalOpen.length && resolved.length) {
    const badge = document.createElement("span");
    badge.className = "verify-badge";
    badge.textContent = "VERIFY";
    badge.dataset.tooltipText = t("tip.verifyBadge");
    tools.insertBefore(badge, help);
  }

  const counts = document.createElement("div");
  counts.className = "q-counts muted small";
  counts.textContent = t("ui.qCounts", { open: open.length, crit: criticalOpen.length, minor: minorOpen.length, resolved: resolved.length, verified: verified.length });
  block.appendChild(counts);

  // Deferred-minors warning: ready for execution, but minor questions still hang here.
  if (!criticalOpen.length && resolved.length && minorOpen.length) {
    const warn = document.createElement("div");
    warn.className = "q-deferred-warn";
    warn.textContent = t("ui.qDeferred", { n: minorOpen.length });
    block.appendChild(warn);
  }

  const ul = document.createElement("ul");
  ul.className = "q-list";
  const renderQ = (q) => {
    const li = document.createElement("li");
    li.className = `q-item q-${q.status} qp-${q.priority}`;
    const mark = q.status === "open" ? q.id : (q.status === "resolved" ? `✓ ${q.id}` : `✓✓ ${q.id}`);
    const answer = q.answer ? `<span class="q-answer">→ ${escapeHtml(q.answer)}</span>` : "";
    const prio = q.status === "open"
      ? `<button class="q-prio q-prio-${q.priority}" type="button" title="${escapeHtml(t("ui.qPrioToggle"))}">${q.priority === "critical" ? "crit" : "minor"}</button>`
      : "";
    li.innerHTML = `<span class="q-text"><b>${escapeHtml(mark)}</b> ${escapeHtml(q.text)}${answer}</span>${prio}<button class="remove" title="remove">×</button>`;
    li.querySelector(".remove").addEventListener("click", () => api("POST", "/api/questions/remove", { id: q.id }));
    const prioBtn = li.querySelector(".q-prio");
    if (prioBtn) prioBtn.addEventListener("click", () => api("POST", "/api/questions/priority", { id: q.id, priority: q.priority === "critical" ? "minor" : "critical" }));
    ul.appendChild(li);
  };
  criticalOpen.forEach(renderQ);
  minorOpen.forEach(renderQ);
  resolved.forEach(renderQ);
  verified.forEach(renderQ);
  block.appendChild(ul);

  const add = document.createElement("div");
  add.className = "kb-add";
  add.innerHTML = `<input placeholder="${escapeHtml(t("ui.addPlaceholder", { label }))}" /><button class="ghost">${t("ui.add")}</button>`;
  const input = add.querySelector("input");
  const button = add.querySelector("button");
  const submit = () => {
    if (!input.value.trim()) return;
    api("POST", "/api/questions/add", { text: input.value.trim() });
    input.value = "";
  };
  button.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
  block.appendChild(add);
}

let pendingLogin = null;
function openLoginModal(tool, account, authorized, isApi) {
  const stepsEl = $("loginModalSteps");
  stepsEl.innerHTML = "";
  const note = $("loginModalNote");
  const confirmBtn = $("confirmLoginBtn");

  if (isApi) {
    // API-key profile — configured in ai-switcher, not via a terminal OAuth login.
    pendingLogin = null;
    $("loginModalTitle").textContent = t("ui.apiTitle", { tool });
    note.classList.add("hidden");
    for (const step of t("ui.apiSteps", { tool }).split("|")) {
      const li = document.createElement("li");
      li.textContent = step;
      stepsEl.appendChild(li);
    }
    confirmBtn.style.display = "none"; // nothing to spawn
    $("loginModal").classList.remove("hidden");
    return;
  }

  confirmBtn.style.display = "";
  pendingLogin = { tool, account };
  const cmd = tool === "codex" ? "codex login" : "claude /login";
  $("loginModalTitle").textContent = (authorized ? "✓ " : "") + t("ui.loginTitle", { tool, account });
  note.classList.toggle("hidden", !authorized);
  if (authorized) note.textContent = t("ui.loginAlready");
  for (const step of t("ui.loginSteps", { tool, account, cmd }).split("|")) {
    const li = document.createElement("li");
    li.textContent = step;
    stepsEl.appendChild(li);
  }
  // Already signed in → re-login is optional, not the implied default.
  confirmBtn.textContent = authorized ? t("ui.relogin") : t("ui.openLogin");
  $("loginModal").classList.remove("hidden");
}

// ---- Switcher detailed-stats panel (tabbed, CodeBurn-style) ----------------
let statsData = null;
let statsPeriod = "today";
let statsTab = localStorage.getItem("council-room-v2.statsTab") || "limits";
let statsLoading = false;
let lastStatsVersion = null; // server statsVersion last applied (re-fetch on bump)
let switcherRefreshing = false;   // true while account-chip animation is running
let switcherRefreshBaseVer = null; // statsVersion at the moment refresh was triggered

function stopSwitcherRefreshAnim() {
  if (!switcherRefreshing) return;
  switcherRefreshing = false;
  $("refreshIcon")?.classList.remove("refresh-spinning");
  $("switcherAccounts")?.classList.remove("chips-loading");
}

async function loadStats() {
  statsLoading = true;
  try {
    statsData = await api("GET", `/api/switcher/stats?period=${statsPeriod}`);
  } catch {
    statsData = null;
  }
  statsLoading = false;
  renderStatsPanel();
}

function fmtCountdown(iso) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t("ui.now");
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(UI_LANG === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}
function fmtTokK(n) { return `${(Number(n || 0) / 1000).toFixed(1)}K`; }

function renderStatsPanel() {
  const panel = $("switcherStats");
  if (!panel || panel.classList.contains("hidden")) return;
  const tabs = [["limits", t("ui.tabLimits")], ["spend", t("ui.tabSpend")], ["sub", t("ui.tabSub")]];
  const tabBar = tabs.map(([id, label]) => `<button class="stats-tab${statsTab === id ? " active" : ""}" data-tab="${id}">${escapeHtml(label)}</button>`).join("");
  let body = "";
  // Registered accounts per service (acc1 always + authorized acc2/api).
  const accs = [];
  for (const tool of ["codex", "claude"]) {
    for (const p of visibleAccounts(tool)) {
      const isApi = p.id === "apikey" || p.mode === "api";
      const num = p.id === "acc1" ? 1 : p.id === "acc2" ? 2 : null;
      const tn = tool === "codex" ? "Codex" : "Claude";
      accs.push({ tool, id: p.id, label: isApi ? `${tn} API` : `${tn} ${num}` });
    }
  }
  const accData = (a) => statsData?.[a.tool]?.[a.id];
  const noDataNote = (a) => a.tool === "codex" ? escapeHtml(t("ui.codexNoData")) : escapeHtml(t("ui.noData"));

  if (statsTab === "limits") {
    body = accs.map((a) => {
      const w = accData(a)?.windows;
      if (!w) return `<div class="stats-acc"><b>${escapeHtml(a.label)}</b> <span class="muted small">${noDataNote(a)}</span></div>`;
      const fh = w.fiveHour, sd = w.sevenDay;
      return `<div class="stats-acc"><b>${escapeHtml(a.label)}</b>
        <div>${escapeHtml(t("ui.hourlyReset"))}: <b>${fh ? fmtCountdown(fh.resetsAt) : "—"}</b> ${fh ? `(${escapeHtml(t("ui.used"))} ${fh.utilization}%)` : ""}</div>
        <div>${escapeHtml(t("ui.weeklyReset"))}: <b>${sd ? fmtDateTime(sd.resetsAt) : "—"}</b> ${sd ? `(${escapeHtml(t("ui.used"))} ${sd.utilization}%)` : ""}</div>
        <div class="muted small">${escapeHtml(t("ui.windowStart"))}: ${fh ? fmtDateTime(fh.startsAt) : "—"}</div></div>`;
    }).join("");
    // API-key profiles have no rolling-window limits — note them so the user
    // knows where to look (Spending tab) instead of seeing nothing.
    const prov = statsData?.providers || {};
    body += Object.keys(prov).map((id) =>
      `<div class="stats-acc"><b>${escapeHtml(prov[id].label || id)}</b> <span class="muted small">${escapeHtml(t("ui.apiNoLimit"))}</span></div>`).join("");
  } else if (statsTab === "spend") {
    const periods = [["today", t("ui.periodToday")], ["week", t("ui.periodWeek")], ["all", t("ui.periodAll")]];
    body = `<div class="stats-periods">${periods.map(([p, l]) => `<button class="stats-period${statsPeriod === p ? " active" : ""}" data-period="${p}">${escapeHtml(l)}</button>`).join("")}</div>`;
    body += accs.map((a) => {
      const s = accData(a)?.spending;
      if (!s) return `<div class="stats-acc"><b>${escapeHtml(a.label)}</b> <span class="muted small">${a.tool === "codex" ? escapeHtml(t("ui.codexNoSpend")) : noDataNote(a)}</span></div>`;
      return `<div class="stats-acc"><b>${escapeHtml(a.label)}</b>
        <div>${escapeHtml(t("ui.spendIn"))}: ${s.inputK}K · ${escapeHtml(t("ui.spendOut"))}: ${s.outputK}K</div>
        <div class="muted small">cache R ${s.cacheReadK}K / W ${s.cacheWriteK}K · ${escapeHtml(t("ui.sessions"))}: ${s.sessions}</div></div>`;
    }).join("");
    // API-key profiles: cumulative token spend (no per-period source) from the
    // provider usage block. Shown after the windowed Claude/Codex accounts.
    const prov = statsData?.providers || {};
    const provIds = Object.keys(prov);
    if (provIds.length) {
      body += provIds.map((id) => {
        const e = prov[id];
        return `<div class="stats-acc"><b>${escapeHtml(e.label || id)}</b> <span class="muted small">${escapeHtml(t("ui.apiBadge"))}</span>
          <div>${escapeHtml(t("ui.spendIn"))}: ${fmtTokK(e.inputTokens)} · ${escapeHtml(t("ui.spendOut"))}: ${fmtTokK(e.outputTokens)}</div>
          <div class="muted small">${escapeHtml(t("ui.spendTotal"))}: ${fmtTokK(e.totalTokens)} · ${escapeHtml(t("ui.requests"))}: ${e.requests}</div></div>`;
      }).join("");
      body += `<button class="stats-reset" type="button">${escapeHtml(t("ui.resetSpend"))}</button>`;
    }
  } else if (statsTab === "sub") {
    const subs = currentState?.settings?.subscriptions || {};
    body = accs.map((a) => {
      const key = `${a.tool}:${a.id}`;
      const sub = subs[key] || {};
      const dlRaw = sub.end ? Math.ceil((new Date(sub.end).getTime() - Date.now()) / 86400000) : null;
      const dl = dlRaw !== null && dlRaw < 0 ? null : dlRaw;
      return `<div class="stats-acc"><b>${escapeHtml(a.label)}</b>
        <label class="sub-row">${escapeHtml(t("ui.subStart"))} <input type="date" data-subkey="${key}" data-field="start" value="${escapeHtml(sub.start || "")}"></label>
        <label class="sub-row">${escapeHtml(t("ui.subEnd"))} <input type="date" data-subkey="${key}" data-field="end" value="${escapeHtml(sub.end || "")}"></label>
        <div class="${dl !== null && dl <= 7 ? "stats-warn" : ""}">${dl === null ? "" : escapeHtml(t("ui.daysLeft", { n: dl }))}</div></div>`;
    }).join("");
  }

  const cliBlock = currentState.cli
    ? `<div class="stats-cli">${escapeHtml("codex: " + currentState.cli.codex)}<br>${escapeHtml("claude: " + currentState.cli.claude)}<br>${escapeHtml("workdir: " + currentState.workdir)}</div>`
    : "";
  panel.innerHTML = `<div class="stats-tabs">${tabBar}<button class="stats-close" type="button">×</button></div><div class="stats-body">${body}</div>${cliBlock}`;
  panel.querySelectorAll(".stats-tab").forEach((b) => b.addEventListener("click", () => { statsTab = b.dataset.tab; try { localStorage.setItem("council-room-v2.statsTab", statsTab); } catch {} renderStatsPanel(); }));
  panel.querySelector(".stats-close")?.addEventListener("click", () => { panelOpen.switcherStats = false; savePanelOpen(); renderSwitcher(); });
  panel.querySelectorAll(".stats-period").forEach((b) => b.addEventListener("click", () => { statsPeriod = b.dataset.period; loadStats(); }));
  panel.querySelector(".stats-reset")?.addEventListener("click", async () => {
    if (!confirm(t("ui.confirmResetSpend"))) return;
    try { await api("POST", "/api/providers/usage/reset", {}); } catch {}
    loadStats();
  });
  panel.querySelectorAll("input[data-subkey]").forEach((inp) => inp.addEventListener("change", () => {
    const key = inp.dataset.subkey;
    const cur = (currentState?.settings?.subscriptions || {})[key] || {};
    const start = inp.dataset.field === "start" ? inp.value : (cur.start || "");
    const end = inp.dataset.field === "end" ? inp.value : (cur.end || "");
    api("POST", "/api/switcher/subscription", { key, start, end });
  }));
}

function tokenClass(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return "tok-unknown"; // no data / not connected → black
  const n = Number(pct);
  if (n >= 50) return "tok-green";
  if (n >= 16) return "tok-yellow";
  if (n >= 1) return "tok-red";
  return "tok-empty"; // < 1% left → grey
}

// Which account profiles to surface for a service. acc1 is always shown; acc2
// and an API profile only when the switch module is connected AND the profile
// is authorized. Without the switcher there are no second accounts to display.
function visibleAccounts(tool) {
  const sw = currentState?.switcher || {};
  const connected = Boolean(sw.connected);
  return (sw.accounts?.[tool] || []).filter((p) => {
    if (p.id === "acc1" || p.account === 1) return true;
    return connected && Boolean(p.authorized);
  });
}

// Phase 5/6c: registered backend profiles shown as chips next to the switcher.
// Always reads the saved server state so chip additions/removals are immediate.
// (The providersDraft is for the panel editor only — chips reflect persisted state.)
function connectedAgents() {
  const list = (currentState.settings && currentState.settings.profiles) || [];
  const creds = (currentState.providers && currentState.providers.credentials) || {};
  const validated = (currentState.providers && currentState.providers.validated) || {};
  const usage = (currentState.providers && currentState.providers.usage) || {};
  return list.map((p) => {
    let prov, present, ok;
    if (isCliProviderId(p.provider)) {
      prov = p.provider === "cli-codex" ? "Codex CLI" : "Claude CLI";
      present = true; ok = true; // subscription CLI — covered by the account buttons too
    } else if (p.provider === "ollama") {
      prov = "Ollama";
      present = true; ok = true; // keyless local model
    } else {
      const preset = presetById(p.provider);
      prov = preset ? preset.label : (p.provider || "API");
      present = Boolean(creds[p.id]);
      ok = Boolean(validated[p.id]); // green only when the key passed a live test
    }
    const model = p.model || (isCliProviderId(p.provider) ? "auto" : "—");
    const u = usage[p.id];
    const spentK = u && u.totalTokens ? u.totalTokens / 1000 : 0;
    // Same colour scheme as the API-key field check: verified → green, key
    // present but unverified → amber, no key → grey. Mirrors the account-button
    // token buckets so the public build looks identical.
    const tok = ok ? "tok-green" : (present ? "tok-yellow" : "tok-unknown");
    const status = ok ? "ok" : (present ? "unverified" : "nokey");
    return { id: p.id, name: p.label || prov, prov, model, present, ok, status, spentK, tok };
  });
}

function fmtSpentK(k) {
  if (!k) return "";
  return ` · Σ${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
}

// Render the connected-agent chips, styled like the switch-module account
// buttons (same pill + token-colour classes) so the public build looks identical.
// Click on a chip → opens #providersDetails and scrolls to that profile row.
function renderConnectedAgents() {
  const box = $("switcherAgents");
  if (!box) return;
  box.innerHTML = "";
  const agents = connectedAgents();
  if (!agents.length) {
    const ph = document.createElement("span");
    ph.className = "agent-no-reg nav-highlight";
    ph.innerHTML = t("ui.noRegisteredAgents");
    ph.dataset.tooltipText = t("tip.noRegisteredAgents");
    ph.addEventListener("click", () => openProfilesPanel(null));
    box.appendChild(ph);
    return;
  }
  for (const a of agents) {
    const chip = document.createElement("span");
    chip.className = `acct-btn agent-chip ${a.tok}${a.present ? "" : " unauthorized"}`;
    chip.dataset.profileId = a.id;
    const spent = fmtSpentK(a.spentK);
    chip.innerHTML = `${escapeHtml(a.name)}${spent ? `<span class="agent-spend">${escapeHtml(spent)}</span>` : ""}`;
    const statusText = a.status === "ok" ? t("ui.agentReady") : (a.status === "unverified" ? t("ui.agentUnverified") : t("ui.agentNoKey"));
    chip.dataset.tooltipText = t("tip.agentChip", { prov: a.prov, model: a.model, status: statusText })
      + (a.spentK ? ` · ~${a.spentK.toFixed(1)}K tok` : "");
    chip.addEventListener("click", () => openProfilesPanel(a.id));
    box.appendChild(chip);
  }
}

// Open #providersDetails, and if profileId given scroll+flash that profile row.
function openProfilesPanel(profileId) {
  const panel = $("providersDetails");
  if (!panel) return;
  panel.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (!profileId) return;
  const row = panel.querySelector(`.profile-row[data-id="${CSS.escape(profileId)}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  row.classList.add("profile-row-flash");
  setTimeout(() => row.classList.remove("profile-row-flash"), 1200);
}

function renderSwitcher() {
  const el = $("switcherStatus");
  if (!el) return;
  const sw = currentState.switcher || {};
  // Stop refresh animation once server broadcasts a new statsVersion.
  if (switcherRefreshing && sw.statsVersion !== undefined && sw.statsVersion !== switcherRefreshBaseVer) {
    stopSwitcherRefreshAnim();
  }
  const connected = Boolean(sw.connected);
  const apiBuild = ((currentState.providers && currentState.providers.mode) || "full") === "api";
  const agents = connectedAgents();

  // Local (full) build: the switch module is ALWAYS shown (mandatory) — its
  // status text + login account buttons + refresh. The connected-agent chips
  // sit alongside as a complement. Public (api) build: there is no switch
  // module — hide its status/refresh/account buttons; the chips are the whole
  // display (same pill style + token colours).
  const leftEl = el.querySelector(".switcher-left");
  const refreshEl = $("refreshSwitcher");
  if (leftEl) leftEl.style.display = apiBuild ? "none" : "";
  if (refreshEl) refreshEl.style.display = apiBuild ? "none" : "";

  if (apiBuild) {
    el.classList.toggle("connected", agents.some((a) => a.ready));
  } else {
    el.classList.toggle("connected", connected);
    $("switcherStatusText").innerHTML = connected ? t("ui.switcherConnected") : t("ui.switcherOffline");
  }

  renderConnectedAgents();

  // Switch-module account buttons (login/failover) — full build only. Colour =
  // remaining-token bucket; click → authorize that account.
  const box = $("switcherAccounts");
  box.innerHTML = "";
  const toolName = { codex: "Codex", claude: "Claude" };
  if (!apiBuild) for (const tool of ["codex", "claude"]) {
    // Show acc1 always; the 2nd account / API only when the switcher is connected.
    const profs = visibleAccounts(tool);
    if (!profs.length) continue;
    const row = document.createElement("div");
    row.className = "acct-row";
    for (const a of profs) {
      const isApi = a.id === "apikey" || a.mode === "api";
      const accountNum = a.account || (a.id === "acc1" ? 1 : a.id === "acc2" ? 2 : null);
      const label = isApi ? `${toolName[tool]} API` : `${toolName[tool]} ${accountNum}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `acct-btn ${tokenClass(a.tokensPct)}${a.authorized ? "" : " unauthorized"}${a.active ? " active" : ""}`;
      btn.textContent = label;
      btn.dataset.tooltipText = t("tip.acctBtn", { tool, account: isApi ? "API" : accountNum, pct: a.tokensPct == null ? "—" : `${a.tokensPct}%` });
      btn.addEventListener("click", () => openLoginModal(tool, isApi ? "apikey" : `acc${accountNum}`, a.authorized, isApi));
      row.appendChild(btn);
    }
    box.appendChild(row);
  }

  // Detailed-stats expander — sits below the bar and opens downward.
  $("switcherStats").classList.toggle("hidden", !panelOpen.switcherStats);
  $("toggleSwitcherStats").textContent = panelOpen.switcherStats ? "▴" : "▾";
  // Panel persisted open across a reload → fetch stats once (the toggle handler
  // only fires on click). Guarded so SSE re-renders don't refetch or rebuild the
  // panel mid-interaction (e.g. typing a subscription date). When the server's
  // statsVersion bumps (the ↻ refresh finished), re-fetch so the Limits/Spend
  // tabs show the fresh numbers, not the stale cached ones.
  const ver = sw.statsVersion;
  if (panelOpen.switcherStats && !statsLoading) {
    if (statsData === null) loadStats();
    else if (lastStatsVersion !== null && ver !== undefined && ver !== lastStatsVersion) loadStats();
  }
  if (ver !== undefined) lastStatsVersion = ver;
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
  // Account / mode controls. The account dropdown is built from the switch
  // module's profiles (acc1 + registered acc2/api), so it auto-includes new
  // accounts. Values are profile ids ("acc1"/"acc2"/"apikey").
  const sw = currentState.switcher || {};
  const norm = (v) => (v === "acc2" || Number(v) === 2) ? "acc2" : (v === "apikey" ? "apikey" : "acc1");
  for (const tool of ["codex", "claude"]) {
    const modeEl = $(`${tool}Mode`);
    const accEl = $(`${tool}Account`);
    if (modeEl) modeEl.value = s[`${tool}Mode`] || "auto";
    if (accEl) {
      const profs = visibleAccounts(tool);
      const list = profs.length ? profs : [{ id: "acc1" }];
      const cur = norm(s[`${tool}Account`]);
      accEl.innerHTML = list.map((p) => {
        const isApi = p.id === "apikey" || p.mode === "api";
        const num = p.id === "acc1" ? 1 : p.id === "acc2" ? 2 : null;
        const label = isApi ? "API" : `${t("ui.accShort")} ${num}`;
        // apikey isn't run-routable from here yet (gateway-only) → shown but disabled.
        return `<option value="${p.id}"${isApi ? " disabled" : ""}${p.id === cur ? " selected" : ""}>${label}</option>`;
      }).join("");
      accEl.value = cur;
      const offline = !currentState.switcher?.connected;
      modeEl.disabled = offline;
      accEl.disabled = offline;
    }
  }
  // Phase 5: build-mode gating + provider profiles/roles panel.
  const pmode = (currentState.providers && currentState.providers.mode) || "full";
  const legacy = $("legacyAgents");
  if (legacy) legacy.style.display = pmode === "api" ? "none" : "";
  const badge = $("buildModeBadge");
  if (badge) { badge.textContent = pmode; badge.className = `mode-badge ${pmode}`; }
  renderProvidersInit();
}

// ---- Phase 5: provider profiles + debate roles editor --------------------
// The panel edits a local DRAFT so SSE state updates don't clobber in-progress
// edits. The draft is (re)initialized from the active chat's settings when the
// chat changes or the UI language flips; otherwise it persists across renders.
let providersDraft = null;
let providersForRunId = undefined;
// Ollama auto-detection result (null = not yet fetched).
let ollamaDetect = null;

// Persistent provider event log (stored in localStorage, survives reload).
// Each entry: { at: ISO string, ru: string, en: string }
const PROV_LOG_KEY = "council-room-v2.providerLog";
const PROV_LOG_MAX = 100;

function provLogLoad() {
  try { return JSON.parse(localStorage.getItem(PROV_LOG_KEY) || "[]"); } catch { return []; }
}
function provLogSave(entries) {
  try { localStorage.setItem(PROV_LOG_KEY, JSON.stringify(entries.slice(-PROV_LOG_MAX))); } catch {}
}
function provLogAdd(ru, en) {
  const entries = provLogLoad();
  entries.push({ at: new Date().toISOString(), ru, en });
  provLogSave(entries);
  renderRegisteredModels(); // refresh the log section
  // Mirror to "Служебные события" trace (no-op when no active run).
  fetch("/api/log", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: en, textRu: ru }),
  }).catch(() => {});
}

// baseUrl → string[] of model names fetched from Ollama /api/tags
const ollamaModelsCache = {};

async function detectOllama() {
  if (ollamaDetect !== null) return ollamaDetect;
  try {
    const r = await fetch("/api/ollama/detect");
    ollamaDetect = await r.json().catch(() => ({ detected: false }));
    if (ollamaDetect.detected && Array.isArray(ollamaDetect.models)) {
      ollamaModelsCache[ollamaDetect.baseUrl] = ollamaDetect.models;
      const n = ollamaDetect.models.length;
      const suffix = n === 1 ? "" : "s";
      const suffixRu = n === 1 ? "ь" : n >= 2 && n <= 4 ? "и" : "ей";
      const names = ollamaDetect.models.slice(0, 5).join(", ");
      const more = n > 5 ? ` +${n - 5}` : "";
      provLogAdd(
        `Ollama обнаружена на порту ${ollamaDetect.port} · ${n} модел${suffixRu}: ${names}${more}`,
        `Ollama detected on port ${ollamaDetect.port} · ${n} model${suffix}: ${names}${more}`
      );
    } else if (ollamaDetect && !ollamaDetect.detected) {
      provLogAdd(
        `Ollama не обнаружена (порт ${ollamaDetect.port || 11434})`,
        `Ollama not detected (port ${ollamaDetect.port || 11434})`
      );
    }
  } catch { ollamaDetect = { detected: false }; }
  return ollamaDetect;
}

async function fetchOllamaModels(baseUrl) {
  const key = baseUrl || "http://localhost:11434/v1";
  if (ollamaModelsCache[key]) return ollamaModelsCache[key];
  try {
    const r = await fetch(`/api/ollama/models?baseUrl=${encodeURIComponent(key)}`);
    const j = await r.json().catch(() => ({}));
    ollamaModelsCache[key] = Array.isArray(j.models) ? j.models : [];
  } catch { ollamaModelsCache[key] = []; }
  return ollamaModelsCache[key];
}
let providersLang = null;

function blankRoles() {
  return {
    a: { slot: "codex", label: "Codex", mode: "auto", profileIds: [] },
    b: { slot: "claude", label: "Claude Code", mode: "auto", profileIds: [] },
  };
}

function initProvidersDraft() {
  const s = currentState.settings || {};
  providersDraft = {
    profiles: Array.isArray(s.profiles) ? JSON.parse(JSON.stringify(s.profiles)) : [],
    roles: (s.roles && s.roles.a && s.roles.b) ? JSON.parse(JSON.stringify(s.roles)) : blankRoles(),
  };
  providersDraft.profiles.push(makeBlankProfile());
}

function renderProvidersInit() {
  const rid = currentState.activeRunId || null;
  if (providersDraft === null || providersForRunId !== rid) {
    providersForRunId = rid;
    initProvidersDraft();
    renderProviders();
  } else if (providersLang !== UI_LANG) {
    syncProvidersFromDOM();
    renderProviders();
  }
  providersLang = UI_LANG;
  // Auto-detect Ollama (fills banner + model cache for dropdown).
  if (ollamaDetect === null) {
    detectOllama().then(() => renderProviders());
  }
}

function isCliProviderId(provider) { return provider === "cli-codex" || provider === "cli-claude"; }

function presetById(id) {
  return ((currentState.providers && currentState.providers.presets) || []).find((p) => p.id === id) || null;
}

function providerOptions() {
  const info = currentState.providers || {};
  // Returns objects {id, label} so the dropdown shows readable names.
  const opts = (info.presets || []).map((p) => ({ id: p.id, label: p.label || p.id }));
  // "openai-compatible" is a raw type for custom endpoints not in the preset list.
  // "ollama" is already a preset — don't add it again.
  opts.push({ id: "openai-compatible", label: "OpenAI-compatible (custom)" });
  if ((info.mode || "full") !== "api") {
    opts.push({ id: "cli-codex", label: "Codex CLI" });
    opts.push({ id: "cli-claude", label: "Claude CLI" });
  }
  return opts;
}

function helpIcon(tipKey) {
  const tip = t(`tip.${tipKey}`);
  return `<span class="help" data-tooltip-key="t.${tipKey}" data-tooltip-text="${escapeHtml(tip)}">?</span>`;
}

function renderProfileRow(p) {
  const provSel = providerOptions().map((o) => `<option value="${escapeHtml(o.id)}"${o.id === p.provider ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
  const cli = isCliProviderId(p.provider);
  const preset = presetById(p.provider);
  const creds = (currentState.providers && currentState.providers.credentials) || {};
  const validated = (currentState.providers && currentState.providers.validated) || {};
  const needsKey = !cli && p.provider !== "ollama" && (preset ? preset.needsKey : true);
  const keyBadge = needsKey
    ? `<span class="key-badge ${creds[p.id] ? "ok" : "miss"}">${creds[p.id] ? t("ui.keySet") : t("ui.keyMissing")}</span>`
    : "";
  const isOllama = p.provider === "ollama";
  const ollamaModels = isOllama ? (ollamaModelsCache[p.baseUrl || (preset && preset.baseUrl) || "http://localhost:11434/v1"] || null) : null;
  let modelWidget;
  if (cli) {
    modelWidget = `<input class="p-model" value="${escapeHtml(p.model || "")}" placeholder="auto">`;
  } else if (isOllama && ollamaModels && ollamaModels.length) {
    const opts = ollamaModels.map((m) => `<option value="${escapeHtml(m)}"${m === p.model ? " selected" : ""}>${escapeHtml(m)}</option>`).join("");
    const emptyOpt = p.model && ollamaModels.includes(p.model) ? "" : `<option value="${escapeHtml(p.model || "")}" selected>${escapeHtml(p.model || t("ui.ollamaSelectModel"))}</option>`;
    modelWidget = `<select class="p-model">${emptyOpt}${opts}</select>`;
  } else if (isOllama) {
    const hint = ollamaModels !== null ? ` (${t("ui.ollamaNoModels")})` : "";
    modelWidget = `<input class="p-model" value="${escapeHtml(p.model || "")}" placeholder="llama3.2${hint}">`;
  } else {
    modelWidget = `<input class="p-model" value="${escapeHtml(p.model || "")}" placeholder="model">`;
  }
  let fields = `<label class="p-field"><span>${t("ui.profileModel")} ${helpIcon("profileModel")}</span>${modelWidget}</label>`;
  if (cli) {
    fields += `<label class="p-field"><span>${t("ui.profileAccount")}</span><select class="p-account">
      <option value="acc1"${p.account === "acc1" ? " selected" : ""}>acc1</option>
      <option value="acc2"${p.account === "acc2" ? " selected" : ""}>acc2</option>
    </select></label>`;
  } else {
    fields += `<label class="p-field"><span>${t("ui.profileBaseUrl")} ${helpIcon("profileBaseUrl")}</span><input class="p-baseurl" value="${escapeHtml(p.baseUrl || (preset ? preset.baseUrl : ""))}" placeholder="https://.../v1"></label>`;
    if (p.provider !== "ollama") {
      fields += `<label class="p-field"><span>${t("ui.profileCredRef")} ${helpIcon("profileCredRef")}</span><input class="p-credref" value="${escapeHtml(p.credentialRef || (preset ? preset.credentialRef : ""))}" placeholder="MY_API_KEY"></label>`;
      // Three states for the ✓: green = key passed a live test (verified);
      // amber = key present but not yet verified; none = no key. Placeholder
      // reflects presence ("key set — leave empty").
      const keyPresent = Boolean(creds[p.id]);
      const keyOk = Boolean(validated[p.id]);
      const mark = keyOk
        ? `<span class="key-ok" title="${escapeHtml(t("ui.keyVerified"))}">✓</span>`
        : (keyPresent ? `<span class="key-pending" title="${escapeHtml(t("ui.keyUnverified"))}">✓</span>` : "");
      const inputCls = keyOk ? " has-key" : (keyPresent ? " has-key-pending" : "");
      fields += `<label class="p-field"><span>${t("ui.profileApiKey")} ${helpIcon("profileApiKey")}</span>
        <span class="p-key-wrap">
          <input type="password" class="p-apikey${inputCls}" value="" autocomplete="off" placeholder="${keyPresent ? escapeHtml(t("ui.keyKeepPlaceholder")) : "sk-..."}">
          ${mark}
        </span></label>`;
    }
  }
  return `<div class="profile-row" data-id="${escapeHtml(p.id)}">
    <div class="profile-head">
      <input class="p-label" value="${escapeHtml(p.label || "")}" placeholder="${t("ui.profileLabel")}">
      ${helpIcon("profileLabel")}
      <select class="p-provider">${provSel}</select>
      <button type="button" class="p-remove" title="${t("ui.remove")}">×</button>
    </div>
    ${keyBadge ? `<div class="profile-key-row">${keyBadge}</div>` : ""}
    <div class="profile-fields">${fields}</div>
  </div>`;
}

function ollamaBanner() {
  if (ollamaDetect === null) return `<div class="ollama-status checking">${escapeHtml(t("ui.ollamaChecking"))}</div>`;
  if (!ollamaDetect.detected) {
    return `<div class="ollama-status miss">${escapeHtml(t("ui.ollamaNotFound", { port: ollamaDetect.port || 11434 }))}</div>`;
  }
  const n = (ollamaDetect.models || []).length;
  const suffix = UI_LANG === "ru" ? (n === 1 ? "ь" : n >= 2 && n <= 4 ? "и" : "ей") : (n === 1 ? "" : "s");
  const names = (ollamaDetect.models || []).slice(0, 5).map(escapeHtml).join(", ");
  const more = n > 5 ? ` +${n - 5}` : "";
  return `<div class="ollama-status ok">${escapeHtml(t("ui.ollamaDetected", { port: ollamaDetect.port, n, suffix }))}`
    + (names ? `<br><span class="ollama-models">${names}${more}</span>` : "") + `</div>`;
}

function renderProviders() {
  if (!providersDraft) return;
  // Ollama banner: only when there are UNSAVED Ollama profiles (not already-saved).
  const savedIds = new Set(((currentState.settings && currentState.settings.profiles) || []).map((p) => p.id));
  const newProfiles = providersDraft.profiles.filter((p) => !savedIds.has(p.id));
  const banner = $("ollamaBanner");
  if (banner) {
    const hasNewOllama = newProfiles.some((p) => p.provider === "ollama");
    banner.innerHTML = hasNewOllama ? ollamaBanner() : "";
  }
  const list = $("profilesList");
  if (!list) return;
  list.innerHTML = newProfiles.length
    ? newProfiles.map(renderProfileRow).join("")
    : `<div class="reg-hint muted small">${escapeHtml(t("ui.noNewProfiles"))}</div>`;
  // "Применить" hidden until at least one new profile exists.
  const applyBtn = $("applyProvidersBtn");
  if (applyBtn) applyBtn.style.display = newProfiles.length ? "" : "none";
  renderConnectedAgents();
  renderRegisteredModels();
}

// ---- Registered models panel ------------------------------------------
// A global, user-friendly view of all saved profiles. Persists across chats.
// Shows: ↻ | label | provider name | model dropdown | effort | speed (if supported).
// Changes auto-save via POST /api/settings (no Apply button).

// Per-profile test status: { ok: bool, testing: bool }
const rmStatus = {};

function regModelProviderLabel(provider) {
  if (provider === "cli-codex") return "Codex CLI";
  if (provider === "cli-claude") return "Claude CLI";
  if (provider === "ollama") return "Ollama";
  const preset = ((currentState.providers && currentState.providers.presets) || []).find((p) => p.id === provider);
  return preset ? preset.label : (provider || "API");
}

function renderRegisteredModelRow(p) {
  const prov = p.provider || "";
  const cli = isCliProviderId(prov);
  const isOllama = prov === "ollama";
  const provLabel = regModelProviderLabel(prov);

  // Model dropdown or input.
  let modelField;
  if (cli) {
    const models = CLI_MODELS[prov] || [];
    const opts = models.map((m) => `<option value="${escapeHtml(m)}"${m === (p.model || "") ? " selected" : ""}>${escapeHtml(m)}</option>`).join("");
    modelField = `<select class="rm-model">${opts}</select>`;
  } else if (isOllama) {
    const baseUrl = p.baseUrl || "http://localhost:11434/v1";
    const models = ollamaModelsCache[baseUrl] || [];
    if (models.length) {
      const emptyOpt = models.includes(p.model || "") ? "" : `<option value="${escapeHtml(p.model || "")}" selected>${escapeHtml(p.model || "—")}</option>`;
      const opts = models.map((m) => `<option value="${escapeHtml(m)}"${m === (p.model || "") ? " selected" : ""}>${escapeHtml(m)}</option>`).join("");
      modelField = `<select class="rm-model">${emptyOpt}${opts}</select>`;
    } else {
      modelField = `<input class="rm-model" value="${escapeHtml(p.model || "")}" placeholder="llama3.2">`;
    }
  } else {
    modelField = `<input class="rm-model" value="${escapeHtml(p.model || "")}" placeholder="model">`;
  }

  // Effort dropdown — CLI providers and Ollama (if effort makes sense).
  const effortLevels = CLI_EFFORTS[prov] || (isOllama ? [] : []);
  let effortField = "";
  if (effortLevels.length) {
    const opts = effortLevels.map((e) => `<option value="${e}"${e === (p.effort || "auto") ? " selected" : ""}>${e}</option>`).join("");
    effortField = `<td class="rm-cell"><span class="rm-col-head">${escapeHtml(t("ui.regModelEffort"))}</span>${"<select class=\"rm-effort\">" + opts + "</select>"}</td>`;
  }

  // Speed — currently no provider defines distinct speed levels; field reserved.
  const speedLevels = []; // extend when a provider needs it
  let speedField = "";
  if (speedLevels.length) {
    const opts = speedLevels.map((s) => `<option value="${s}"${s === (p.speed || "") ? " selected" : ""}>${s}</option>`).join("");
    speedField = `<td class="rm-cell"><span class="rm-col-head">${escapeHtml(t("ui.regModelSpeed"))}</span><select class="rm-speed">${opts}</select></td>`;
  }

  const st = rmStatus[p.id] || {};
  const rowCls = st.testing ? " rm-testing" : (st.ok === true ? " rm-ok" : (st.ok === false ? " rm-fail" : ""));
  const btnIcon = st.testing ? "⟳" : "↻";
  const btnTitle = st.testing ? t("ui.regModelTesting") : t("ui.regModelRetest");

  return `<tr class="rm-row${rowCls}" data-id="${escapeHtml(p.id)}">
    <td class="rm-cell rm-cell-retest">
      <button class="rm-retest ghost" type="button" title="${escapeHtml(btnTitle)}"${st.testing ? " disabled" : ""}>${btnIcon}</button>
    </td>
    <td class="rm-cell rm-cell-label">
      <span class="rm-col-head">${escapeHtml(t("ui.regModelLabel"))}</span>
      <input class="rm-label" value="${escapeHtml(p.label || "")}" placeholder="${escapeHtml(provLabel)}">
    </td>
    <td class="rm-cell rm-cell-agent">
      <span class="rm-col-head">${escapeHtml(t("ui.regModelAgent"))}</span>
      <span class="rm-prov-badge">${escapeHtml(provLabel)}</span>
    </td>
    <td class="rm-cell">
      <span class="rm-col-head">${escapeHtml(t("ui.regModelModel"))}</span>
      ${modelField}
    </td>
    ${effortField}${speedField}
  </tr>`;
}

function renderRegisteredModels() {
  const list = $("registeredModelsList");
  if (!list) return;
  const profs = (currentState.settings && currentState.settings.profiles) || [];
  // Fetch Ollama models for any Ollama profiles if not yet cached.
  for (const p of profs) {
    if (p.provider === "ollama") {
      const key = p.baseUrl || "http://localhost:11434/v1";
      if (!ollamaModelsCache[key]) fetchOllamaModels(key).then(() => renderRegisteredModels());
    }
  }
  const tableHtml = profs.length
    ? `<table class="rm-table"><tbody>${profs.map(renderRegisteredModelRow).join("")}</tbody></table>`
    : `<div class="muted small">${escapeHtml(t("ui.regModelNoProfiles"))}</div>`;

  // Persistent event log — collapsible, newest first.
  const logEntries = provLogLoad();
  let logHtml = "";
  {
    const items = logEntries.length
      ? [...logEntries].reverse().map((e) => {
          const dt = new Date(e.at);
          const dateStr = dt.toLocaleDateString(UI_LANG === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
          const timeStr = dt.toLocaleTimeString(UI_LANG === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const msg = escapeHtml(UI_LANG === "ru" ? (e.ru || e.en || "") : (e.en || e.ru || ""));
          return `<div class="plog-entry"><span class="plog-dt"><span class="plog-date">${dateStr}</span><span class="plog-time">${timeStr}</span></span><span class="plog-msg">${msg}</span></div>`;
        }).join("")
      : `<div class="muted small" style="padding:4px 0">${escapeHtml(t("ui.providerLogEmpty"))}</div>`;
    logHtml = `<details class="plog-details">
      <summary class="plog-summary">
        <span>${escapeHtml(t("ui.providerLog"))}</span>
        <button class="plog-clear ghost small" type="button">${escapeHtml(t("ui.providerLogClear"))}</button>
      </summary>
      <div class="plog-box">${items}</div>
    </details>`;
  }

  list.innerHTML = tableHtml + logHtml;
  bindRegisteredModels();
}

async function saveRegisteredModelRow(id, fields) {
  const profs = JSON.parse(JSON.stringify((currentState.settings && currentState.settings.profiles) || []));
  const p = profs.find((x) => x.id === id);
  if (!p) return;
  if ("label" in fields) p.label = fields.label;
  if ("model" in fields) p.model = fields.model;
  if ("effort" in fields) p.effort = fields.effort;
  if ("speed" in fields) p.speed = fields.speed;
  try {
    await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles: profs }),
    });
  } catch {}
}

function bindRegisteredModels() {
  const table = document.querySelector("#registeredModelsList .rm-table");
  if (!table) return;
  table.addEventListener("change", (e) => {
    const row = e.target.closest(".rm-row");
    if (!row) return;
    const id = row.dataset.id;
    const q = (sel) => row.querySelector(sel);
    const fields = {};
    if (e.target.classList.contains("rm-label")) fields.label = e.target.value;
    if (e.target.classList.contains("rm-model")) fields.model = e.target.value;
    if (e.target.classList.contains("rm-effort")) fields.effort = e.target.value;
    if (e.target.classList.contains("rm-speed")) fields.speed = e.target.value;
    if (Object.keys(fields).length) saveRegisteredModelRow(id, fields);
  });
  table.addEventListener("input", (e) => {
    if (e.target.classList.contains("rm-label") || e.target.classList.contains("rm-model")) {
      // live update without save (save on blur/change)
    }
  });
  table.addEventListener("blur", (e) => {
    if (e.target.classList.contains("rm-label") || e.target.classList.contains("rm-model")) {
      const row = e.target.closest(".rm-row");
      if (!row) return;
      const fields = {};
      if (e.target.classList.contains("rm-label")) fields.label = e.target.value;
      if (e.target.classList.contains("rm-model")) fields.model = e.target.value;
      if (Object.keys(fields).length) saveRegisteredModelRow(row.dataset.id, fields);
    }
  }, true);
  // Clear log button (inside <details>, stop event from toggling it).
  document.querySelector("#registeredModelsList .plog-clear")?.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    provLogSave([]);
    renderRegisteredModels();
  });
  // Retest buttons.
  document.querySelector("#registeredModelsList .rm-table")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".rm-retest");
    if (!btn) return;
    const id = btn.closest(".rm-row")?.dataset.id;
    if (id) retestRegisteredModel(id);
  });
}

async function retestRegisteredModel(id) {
  const profs = (currentState.settings && currentState.settings.profiles) || [];
  const p = profs.find((x) => x.id === id);
  if (!p || !p.model) return;
  rmStatus[id] = { testing: true };
  renderRegisteredModels();
  try {
    const r = await fetch("/api/providers/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p.provider, baseUrl: p.baseUrl, credentialRef: p.credentialRef, model: p.model }),
    });
    const j = await r.json().catch(() => ({}));
    rmStatus[id] = { ok: Boolean(j.ok) };
    const lbl = p.label || p.model || id;
    if (j.ok) {
      provLogAdd(
        `✓ ${lbl} (${p.provider} / ${p.model}) — доступна`,
        `✓ ${lbl} (${p.provider} / ${p.model}) — available`
      );
    } else {
      provLogAdd(
        `✗ ${lbl} (${p.provider} / ${p.model}) — недоступна: ${j.error || "ошибка"}`,
        `✗ ${lbl} (${p.provider} / ${p.model}) — unavailable: ${j.error || "error"}`
      );
    }
  } catch (e) {
    rmStatus[id] = { ok: false };
    provLogAdd(
      `✗ ${p.label || p.model || id} — ошибка: ${e.message}`,
      `✗ ${p.label || p.model || id} — error: ${e.message}`
    );
  }
  renderRegisteredModels();
}

function syncProvidersFromDOM() {
  if (!providersDraft) return;
  document.querySelectorAll("#profilesList .profile-row").forEach((row) => {
    const p = providersDraft.profiles.find((x) => x.id === row.dataset.id);
    if (!p) return;
    const q = (sel) => row.querySelector(sel);
    if (q(".p-label")) p.label = q(".p-label").value;
    if (q(".p-provider")) p.provider = q(".p-provider").value;
    if (q(".p-model")) p.model = q(".p-model").value;
    if (q(".p-account")) p.account = q(".p-account").value;
    if (q(".p-baseurl")) p.baseUrl = q(".p-baseurl").value;
    if (q(".p-credref")) p.credentialRef = q(".p-credref").value;
  });
  // Roles A/B are no longer edited in this panel (debate agents are picked per-chat
  // via the "Add agent" chips → settings.participants). The draft keeps whatever
  // roles were already persisted so applyProviders re-sends them untouched.
}

function makeBlankProfile() {
  const apiMode = (currentState.providers && currentState.providers.mode) === "api";
  const useOllama = ollamaDetect && ollamaDetect.detected;
  const provider = (apiMode || useOllama) ? "ollama" : "cli-codex";
  const p = { id: `p${Date.now().toString(36)}`, label: "", provider, model: "" };
  if (isCliProviderId(provider)) {
    p.account = "acc1";
  } else if (provider === "ollama" && useOllama) {
    p.baseUrl = ollamaDetect.baseUrl;
  }
  return p;
}

function addProfileDraft() {
  syncProvidersFromDOM();
  providersDraft.profiles.push(makeBlankProfile());
  renderProviders();
}

function removeProfileDraft(id) {
  syncProvidersFromDOM();
  providersDraft.profiles = providersDraft.profiles.filter((p) => p.id !== id);
  for (const slot of ["a", "b"]) {
    const r = providersDraft.roles[slot];
    r.profileIds = (r.profileIds || []).filter((x) => x !== id);
  }
  renderProviders();
}

// Live-test a freshly entered API key: persist it to .env and fire a tiny
// request. Green ✓ appears only when the request actually returns an answer.
async function testProfileKey(p, apiKey) {
  if (!p) return;
  const ref = (p.credentialRef || "").trim();
  if (!ref) { showProvidersMsg(t("ui.keyNeedsRef", { p: p.label || p.id }), true); return; }
  if (!(p.model || "").trim()) { showProvidersMsg(t("ui.keyTestNeedsModel"), true); return; }
  showProvidersMsg(t("ui.keyTesting"), false);
  try {
    const r = await fetch("/api/providers/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p.provider, baseUrl: p.baseUrl, credentialRef: ref, model: p.model, apiKey }),
    });
    const j = await r.json().catch(() => ({}));
    if (currentState.providers) {
      if (j.credentials) currentState.providers.credentials = j.credentials;
      if (j.validated) currentState.providers.validated = j.validated;
    }
    if (j.ok) showProvidersMsg(t("ui.keyWorks", { reply: j.reply || "" }), false);
    else showProvidersMsg(t("ui.keyFailed", { e: j.error || `error ${r.status}` }), true);
    renderProviders(); // refresh the ✓ / placeholder and chips
  } catch (e) {
    showProvidersMsg(e.message, true);
  }
}

function showProvidersMsg(text, isError, timeoutMs = 4000) {
  const el = $("providersMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `providers-msg ${isError ? "err" : "ok"}`;
  clearTimeout(showProvidersMsg._t);
  if (timeoutMs > 0) {
    showProvidersMsg._t = setTimeout(() => { el.textContent = ""; el.className = "providers-msg"; }, timeoutMs);
  }
}

async function applyProviders() {
  syncProvidersFromDOM();
  const ids = providersDraft.profiles.map((p) => p.id);
  if (new Set(ids).size !== ids.length) { showProvidersMsg("duplicate profile ids", true); return; }
  for (const p of providersDraft.profiles) {
    const isCli = isCliProviderId(p.provider);
    if (!isCli && !(p.model || "").trim()) {
      showProvidersMsg(t("ui.profileModelRequired", { label: p.label || p.id }), true);
      return;
    }
  }

  // Ollama profiles: run a live test before saving. The chip only appears if
  // the test passes — so we only proceed to the POST /api/settings on success.
  // Test only NEW Ollama profiles (not already saved ones — they passed test before).
  const savedIds = new Set(((currentState.settings && currentState.settings.profiles) || []).map((p) => p.id));
  const ollamaProfiles = providersDraft.profiles.filter((p) => p.provider === "ollama" && !savedIds.has(p.id));
  if (ollamaProfiles.length) {
    const testedModels = [];
    for (const p of ollamaProfiles) {
      const lbl = p.label ? `${p.label} (${p.model})` : p.model;
      showProvidersMsg(t("ui.ollamaTestingModel", { model: lbl }), false, 0);
      try {
        const r = await fetch("/api/providers/test", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "ollama", baseUrl: p.baseUrl || "http://localhost:11434/v1", model: p.model }),
        });
        const j = await r.json().catch(() => ({}));
        if (j.validated && currentState.providers) currentState.providers.validated = j.validated;
        if (!j.ok) {
          showProvidersMsg(t("ui.ollamaNotConnected", { e: j.error || `HTTP ${r.status}` }), true);
          return;
        }
        testedModels.push(lbl);
      } catch (e) {
        showProvidersMsg(t("ui.ollamaNotConnected", { e: e.message }), true);
        return;
      }
    }
    // All passed — store for success message after save.
    ollamaProfiles._testedModels = testedModels;
  }

  // Direct API-key entry: any non-empty .p-apikey field is persisted to .env
  // (gitignored) under that profile's credentialRef — never into the profiles
  // body / state.json. Keys read straight from the DOM (not stored in the draft).
  const keyWrites = [];
  for (const row of document.querySelectorAll("#profilesList .profile-row")) {
    const inp = row.querySelector(".p-apikey");
    if (!inp || !inp.value.trim()) continue;
    const p = providersDraft.profiles.find((x) => x.id === row.dataset.id);
    if (!p) continue;
    const ref = (p.credentialRef || "").trim();
    if (!ref) { showProvidersMsg(t("ui.keyNeedsRef", { p: p.label || p.id }), true); return; }
    keyWrites.push({ credentialRef: ref, value: inp.value.trim() });
  }
  for (const w of keyWrites) {
    try {
      const r = await fetch("/api/providers/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); showProvidersMsg(j.error || `key error ${r.status}`, true); return; }
      const j = await r.json().catch(() => ({}));
      if (j.credentials && currentState.providers) currentState.providers.credentials = j.credentials;
    } catch (e) { showProvidersMsg(e.message, true); return; }
  }

  // No profiles ⇒ clear explicit config (revert to the default Codex/Claude
  // behavior) rather than persisting an empty override that would break rounds.
  const body = providersDraft.profiles.length
    ? { profiles: providersDraft.profiles, roles: providersDraft.roles }
    : { profiles: null, roles: null };
  try {
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showProvidersMsg(j.error || `error ${res.status}`, true);
      return;
    }
    // Log ALL newly added profiles (any type: Ollama, CLI, API).
    // savedIds was computed before the save — anything not in it is new.
    for (const p of providersDraft.profiles) {
      if (savedIds.has(p.id)) continue; // already existed before this Apply
      const provLabel = p.provider === "cli-codex" ? "Codex CLI"
        : p.provider === "cli-claude" ? "Claude CLI"
        : p.provider === "ollama" ? "Ollama"
        : p.provider || "API";
      const lbl = p.label ? `«${p.label}»` : `«${p.model || p.id}»`;
      const mdl = p.model ? ` / ${p.model}` : "";
      provLogAdd(
        `Агент зарегистрирован: ${lbl} (${provLabel}${mdl})`,
        `Agent registered: ${lbl} (${provLabel}${mdl})`
      );
    }
    const successMsg = ollamaProfiles.length
      ? t("ui.ollamaConnectedModels", { models: (ollamaProfiles._testedModels || []).join(", ") })
      : (keyWrites.length ? t("ui.providersKeySaved") : t("ui.providersSaved"));
    showProvidersMsg(successMsg, false, ollamaProfiles.length ? 5000 : 4000);
    providersDraft.profiles = [makeBlankProfile()]; // reset to one blank card
    renderProviders();
  } catch (e) {
    showProvidersMsg(e.message, true);
  }
}

// ---- Phase 6b: debate-agent selection ------------------------------------
// Per-chat selection of 2–5 debate agents. Each agent carries an INLINE backend
// (provider/account/model/effort) — fully decoupled from the registry
// (settings.profiles / the Phase-5 panel). The working list lives in a draft and
// is persisted to settings.participants once it has the required 2+ agents.
let participantsDraft = null;
let participantsForRunId = undefined;
let selectedAgentKey = null;

const CLI_MODELS = {
  "cli-codex": ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.3-codex"],
  "cli-claude": ["haiku", "sonnet", "opus", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"],
};
const CLI_EFFORTS = {
  "cli-codex": ["auto", "low", "medium", "high", "xhigh"],
  "cli-claude": ["auto", "low", "medium", "high", "xhigh", "max"],
};
// Weakest (cheapest) model per backend — the token-saving default.
function weakModelFor(provider, fallback) {
  if (provider === "cli-codex") return "gpt-5.4-mini";
  if (provider === "cli-claude") return "haiku";
  return fallback || "";
}
function isWeakBackend(b) {
  if (!b) return false;
  return b.model === weakModelFor(b.provider, b.model) && (b.effort === "low" || b.effort === "auto" || !isCliProviderId(b.provider));
}

// Available backends to choose an agent from: authorized subscription CLI
// accounts (full build) + registered network profiles + local Ollama.
function agentCatalog() {
  const info = currentState.providers || {};
  const apiBuild = (info.mode || "full") === "api";
  const out = [];
  if (!apiBuild) {
    const toolName = { codex: "Codex", claude: "Claude" };
    for (const tool of ["codex", "claude"]) {
      // acc1 is the default account — always available, even without the switcher
      // gateway. acc2 only when the switch module reports it authorized.
      const accNums = new Set([1]);
      for (const a of visibleAccounts(tool)) {
        if (a.id === "apikey" || a.mode === "api") continue;
        const num = a.account || (a.id === "acc1" ? 1 : a.id === "acc2" ? 2 : null);
        if (num) accNums.add(num);
      }
      for (const num of [...accNums].sort()) {
        out.push({
          id: `cli-${tool}-acc${num}`, kind: "cli", provider: `cli-${tool}`,
          account: `acc${num}`, label: `${toolName[tool]} · ${t("ui.accShort")} ${num}`,
          defaultModel: weakModelFor(`cli-${tool}`),
        });
      }
    }
  }
  for (const p of (currentState.settings && currentState.settings.profiles) || []) {
    if (isCliProviderId(p.provider)) continue;
    out.push({
      id: `net-${p.id}`, kind: "net", provider: p.provider, baseUrl: p.baseUrl,
      credentialRef: p.credentialRef, label: p.label || p.provider, defaultModel: p.model || "",
    });
  }
  if (!out.some((o) => o.provider === "ollama")) {
    out.push({ id: "ollama-local", kind: "net", provider: "ollama", baseUrl: "http://localhost:11434/v1", label: "Ollama (local)", defaultModel: "" });
  }
  return out;
}

function catalogEntryForBackend(b) {
  const cat = agentCatalog();
  if (!b) return cat[0] || null;
  // For CLI providers: match by provider + account.
  // For network providers: prefer matching by model (since multiple Ollama/API
  // profiles can share the same provider but have different models).
  return cat.find((c) => {
    if (c.provider !== b.provider) return false;
    if (c.account || b.account) return (c.account || "") === (b.account || "");
    return c.defaultModel === (b.model || "");
  }) || cat.find((c) => c.provider === b.provider) || cat[0] || null;
}

function makeAgentFromCatalog(entry, idx) {
  const provider = entry.provider;
  const backend = { provider, model: entry.defaultModel || weakModelFor(provider, ""), effort: isCliProviderId(provider) ? "low" : "auto" };
  if (entry.account) backend.account = entry.account;
  if (entry.baseUrl) backend.baseUrl = entry.baseUrl;
  if (entry.credentialRef) backend.credentialRef = entry.credentialRef;
  return { key: `a${idx + 1}`, label: entry.label, mode: "manual", backend, _confirmed: false };
}

function rekeyAgents(list) {
  return (list || []).map((p, i) => ({ ...p, key: `a${i + 1}` }));
}

function initParticipantsDraft() {
  const s = currentState.settings || {};
  participantsDraft = Array.isArray(s.participants)
    ? JSON.parse(JSON.stringify(s.participants)).map((p) => ({ ...p, _confirmed: true }))
    : [];
}

function renderAgentsInit() {
  const rid = currentState.activeRunId || null;
  if (participantsDraft === null || participantsForRunId !== rid) {
    participantsForRunId = rid;
    initParticipantsDraft();
    selectedAgentKey = (participantsDraft[0] && participantsDraft[0].key) || null;
    // Chats with already-saved participants are considered confirmed; fresh chats are not.
  }
  renderAgentChips();
  renderAgentEditor();
}

function renderAgentChips() {
  const box = $("agentChips");
  if (!box) return;
  const list = participantsDraft || [];
  const rounds = currentState.run?.activeSubtask?.rounds || 0;
  box.innerHTML = "";
  for (const p of list) {
    const chip = document.createElement("span");
    chip.className = `agent-chip-sel${p.key === selectedAgentKey ? " selected" : ""}${rounds === 0 && !p._confirmed ? " pulse" : ""}`;
    chip.dataset.key = p.key;
    chip.dataset.tooltipText = t("ui.agentChipHint");
    chip.innerHTML = `<span class="ac-label">${escapeHtml(p.label || p.key)}</span>`
      + `<button class="ac-remove" type="button" title="${escapeHtml(t("ui.agentRemove"))}">×</button>`;
    box.appendChild(chip);
  }
  const addBtn = $("addAgent");
  if (addBtn) addBtn.disabled = !currentState.activeRunId || list.length >= 5;
}

function renderAgentEditor() {
  const body = $("agentEditorBody");
  if (!body) return;
  const list = participantsDraft || [];
  let warnHtml = "";
  if (list.length >= 2) warnHtml = `<div class="token-warn lvl${Math.min(5, list.length)}">${escapeHtml(t(`ui.tokenWarn${Math.min(5, list.length)}`))}</div>`;
  else if (list.length === 1) warnHtml = `<div class="token-warn muted">${escapeHtml(t("ui.agentMin2"))}</div>`;
  if (!list.length) {
    body.innerHTML = `<div class="muted small">${escapeHtml(t("ui.agentEditorEmpty"))}</div>`;
    return;
  }
  const sel = list.find((p) => p.key === selectedAgentKey) || null;
  body.innerHTML = warnHtml + (sel ? renderOneAgentEditor(sel) : `<div class="muted small">${escapeHtml(t("ui.agentEditorEmpty"))}</div>`);
  bindAgentEditor();
}

function renderOneAgentEditor(p) {
  const cat = agentCatalog();
  const b = p.backend || {};
  const curId = (catalogEntryForBackend(b) || {}).id || "";
  const backendOpts = cat.length
    ? cat.map((c) => `<option value="${escapeHtml(c.id)}"${c.id === curId ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("")
    : `<option value="">${escapeHtml(t("ui.agentNoBackends"))}</option>`;
  const cli = isCliProviderId(b.provider);
  const hl = !p._confirmed; // highlight only unconfirmed participants
  // True when the selected backend is the auto-added fallback Ollama (no registered profile).
  const isFallbackOllama = curId === "ollama-local" && !hasRegisteredOllamaProfile();
  let modelField;
  if (cli) {
    const models = CLI_MODELS[b.provider] || [];
    const weak = weakModelFor(b.provider);
    const hlModel = hl && (b.model === weak || b.model === "");
    const emptyModelOpt = b.model === "" ? `<option value="" selected>—</option>` : "";
    modelField = `<select class="ag-model${hlModel ? " hl-default" : ""}">${emptyModelOpt}${models.map((m) => `<option value="${m}"${m === b.model ? " selected" : ""}>${m}</option>`).join("")}</select>`;
  } else if (isFallbackOllama) {
    modelField = `<span class="ag-model-hint">${escapeHtml(t("ui.ollamaRegisterHint"))}</span>`;
  } else {
    modelField = `<input class="ag-model${hl && !b.model ? " hl-default" : ""}" value="${escapeHtml(b.model || "")}" placeholder="model">`;
  }
  let effortField = "";
  if (cli) {
    const efforts = CLI_EFFORTS[b.provider] || [];
    const cur = b.effort || "";
    const hlEffort = hl && (cur === "low" || cur === "auto" || cur === "");
    const emptyEffortOpt = cur === "" ? `<option value="" selected>—</option>` : "";
    effortField = `<label class="p-field"><span>${t("ui.agentEffort")} ${helpIcon("agentEffort2")}</span>`
      + `<select class="ag-effort${hlEffort ? " hl-default" : ""}">${emptyEffortOpt}${efforts.map((e) => `<option value="${e}"${e === cur ? " selected" : ""}>${e}</option>`).join("")}</select></label>`;
  }
  const canApply = cli ? (b.model !== "" && b.effort !== "") : b.model !== "";
  return `<div class="agent-edit-card" data-key="${escapeHtml(p.key)}">
    <div class="agent-edit-name">${escapeHtml(p.label || p.key)}</div>
    <label class="p-field"><span>${t("ui.agentBackend")} ${helpIcon("agentBackend")}</span><select class="ag-backend">${backendOpts}</select></label>
    <label class="p-field"><span>${t("ui.agentModel")} ${helpIcon("agentModel2")}</span>${modelField}</label>
    ${effortField}
    <div class="agent-edit-actions">
      <button class="primary small ag-apply${hl ? " nav-highlight" : ""}" type="button"${canApply ? "" : " disabled"}>${t("ui.agentApply")}</button>
      <button class="ghost small ag-remove" type="button">${t("ui.agentRemove")}</button>
    </div>
  </div>`;
}

function bindAgentEditor() {
  const card = document.querySelector(".agent-edit-card");
  if (!card) return;
  const key = card.dataset.key;
  const p = (participantsDraft || []).find((x) => x.key === key);
  if (!p) return;
  const q = (sel) => card.querySelector(sel);
  q(".ag-backend")?.addEventListener("change", (e) => {
    const entry = agentCatalog().find((c) => c.id === e.target.value);
    if (!entry) return;
    const idx = participantsDraft.findIndex((x) => x.key === key);
    const fresh = makeAgentFromCatalog(entry, idx < 0 ? 0 : idx);
    p.backend = fresh.backend;
    p.label = fresh.label;
    p._confirmed = false;
    // Show navigator hint when fallback Ollama (no registered profile) is picked.
    pendingOllamaRegistration = (entry.id === "ollama-local" && !hasRegisteredOllamaProfile());
    renderAgentChips();
    renderAgentEditor();
    renderNextStep();
  });
  q(".ag-model")?.addEventListener("change", (e) => { p.backend.model = e.target.value; p._confirmed = false; renderAgentChips(); renderAgentEditor(); });
  q(".ag-model")?.addEventListener("input", (e) => { p.backend.model = e.target.value; p._confirmed = false; });
  q(".ag-effort")?.addEventListener("change", (e) => { p.backend.effort = e.target.value; p._confirmed = false; renderAgentChips(); renderAgentEditor(); });
  q(".ag-apply")?.addEventListener("click", async () => {
    p._confirmed = true; // only confirm the agent currently open in the editor
    await applyParticipants();
    renderAgentChips();
    renderAgentEditor();
  });
  q(".ag-remove")?.addEventListener("click", () => removeAgent(key));
}

function openAddAgentModal() {
  showAddAgentMsg("", false);
  $("addAgentModal").classList.remove("hidden");
}
function closeAddAgentModal() { $("addAgentModal").classList.add("hidden"); }
function showAddAgentMsg(text, isError) {
  const el = $("addAgentMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `providers-msg ${text ? (isError ? "err" : "ok") : ""}`;
}

// Auto: pick 2 distinct available backends with cheap defaults (replaces the
// list — only offered from a blank slate).
function addAgentAuto() {
  const cat = agentCatalog();
  if (!cat.length) { showAddAgentMsg(t("ui.agentNoBackends"), true); return; }
  const picks = [];
  for (const c of cat) {
    if (picks.length >= 2) break;
    // For CLI: unique by provider+account. For network: unique by catalog id
    // (each registered profile is a distinct backend even if same provider).
    const isDup = picks.some((x) => {
      if (x.provider !== c.provider) return false;
      if (x.account || c.account) return (x.account || "") === (c.account || "");
      return x.id === c.id;
    });
    if (!isDup) picks.push(c);
  }
  while (picks.length < 2) picks.push(cat[picks.length % cat.length]); // single backend → duplicate
  participantsDraft = rekeyAgents(picks.slice(0, 2).map((c, i) => makeAgentFromCatalog(c, i)));
  selectedAgentKey = participantsDraft[0].key;
  closeAddAgentModal();
  applyParticipants();
}

// Manual: append one agent (a distinct backend if available), up to 5.
function addAgentManual() {
  const cat = agentCatalog();
  if (!cat.length) { showAddAgentMsg(t("ui.agentNoBackends"), true); return; }
  const list = participantsDraft || [];
  if (list.length >= 5) { showAddAgentMsg(t("ui.agentMax"), true); return; }
  // Unique by catalog id for network providers, by provider+account for CLI.
  const usedIds = new Set(list.map((p) => {
    const match = agentCatalog().find((c) => {
      if (c.provider !== p.backend?.provider) return false;
      if (c.account || p.backend?.account) return (c.account || "") === (p.backend?.account || "");
      return c.defaultModel === (p.backend?.model || "");
    });
    return match ? match.id : `${p.backend?.provider}|${p.backend?.account || ""}`;
  }));
  const entry = cat.find((c) => !usedIds.has(c.id)) || cat[0];
  const newAgent = makeAgentFromCatalog(entry, list.length);
  newAgent.backend.model = "";
  newAgent.backend.effort = "";
  participantsDraft = rekeyAgents([...list, newAgent]);
  selectedAgentKey = participantsDraft[participantsDraft.length - 1].key;
  closeAddAgentModal();
  renderAgentChips();
  renderAgentEditor();
  if (participantsDraft.length >= 2) applyParticipants();
}

function removeAgent(key) {
  participantsDraft = rekeyAgents((participantsDraft || []).filter((p) => p.key !== key));
  if (selectedAgentKey === key) selectedAgentKey = (participantsDraft[0] && participantsDraft[0].key) || null;
  renderAgentChips();
  renderAgentEditor();
  applyParticipants();
}

// Persist the selection. Server validateParticipants needs 2..5, so a sub-2 draft
// clears the explicit participants (reverts to legacy) but is kept locally so the
// in-progress chips/editor survive until a 2nd agent is added.
async function applyParticipants() {
  participantsDraft = rekeyAgents(participantsDraft || []);
  const body = participantsDraft.length >= 2 ? { participants: participantsDraft } : { participants: null };
  try {
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); showProvidersMsg(j.error || `error ${res.status}`, true); return; }
    if (participantsDraft.length >= 2) showProvidersMsg(t("ui.agentSaved"), false);
  } catch (e) { showProvidersMsg(e.message, true); }
}

// ---- Phase 6b: attached documents ----------------------------------------
function showDocMsg(text, isError) {
  const el = $("docMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `providers-msg ${text ? (isError ? "err" : "ok") : ""}`;
  clearTimeout(showDocMsg._t);
  showDocMsg._t = setTimeout(() => { el.textContent = ""; el.className = "providers-msg"; }, 4000);
}

function renderDocuments() {
  const list = $("documentsList");
  if (!list) return;
  const docs = (currentState.run && currentState.run.documents) || [];
  const total = docs.reduce((s, d) => s + (d.chars || 0), 0);
  const badge = $("docsCount");
  if (badge) badge.textContent = docs.length ? t("ui.docCharsBadge", { docs: docs.length, chars: total }) : "";
  if (!docs.length) {
    list.innerHTML = `<div class="muted small">${escapeHtml(t("ui.docEmpty"))}</div>`;
    return;
  }
  list.innerHTML = docs.map((d) => `<div class="doc-row" data-id="${escapeHtml(d.id)}">
    <span class="doc-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
    <span class="doc-chars">${escapeHtml(t("ui.docChars", { n: d.chars }))}</span>
    <button class="doc-remove" type="button" title="${escapeHtml(t("ui.docRemove"))}">×</button>
  </div>`).join("");
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

// Check GitHub for a newer version and show the result in a modal. Update is
// fast-forward only on the server, so chats/settings (gitignored) always survive.
async function openUpdateModal() {
  const modal = $("updateModal");
  const body = $("updateModalBody");
  const confirmBtn = $("updateConfirm");
  confirmBtn.classList.add("hidden");
  body.textContent = t("ui.updateChecking");
  modal.classList.remove("hidden");
  let info;
  try { info = await api("GET", "/api/update/check"); }
  catch (e) { body.textContent = t("ui.updateError", { error: e.message }); return; }
  if (!info || !info.ok) { body.textContent = t("ui.updateError", { error: (info && info.error) || "?" }); return; }
  if (!info.updateAvailable) { body.textContent = t("ui.updateUpToDate", { sha: info.local }); return; }
  const parts = [`<div>${escapeHtml(t("ui.updateAvailable", { n: info.behind, local: info.local, remote: info.remote }))}</div>`];
  if (info.commits && info.commits.length) {
    parts.push(`<div class="update-changes">${escapeHtml(t("ui.updateChanges"))}</div>`);
    parts.push(`<ul class="update-commits">${info.commits.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`);
  }
  if (info.dirty) parts.push(`<div class="update-warn">${escapeHtml(t("ui.updateDirtyNote"))}</div>`);
  body.innerHTML = parts.join("");
  confirmBtn.classList.remove("hidden");
}

async function applyUpdate() {
  const body = $("updateModalBody");
  $("updateConfirm").classList.add("hidden");
  body.textContent = t("ui.updateApplying");
  let res;
  try { res = await api("POST", "/api/update/apply", {}); }
  catch (e) { body.textContent = t("ui.updateError", { error: e.message }); return; }
  if (!res || !res.ok) { body.textContent = t("ui.updateError", { error: (res && res.error) || "?" }); return; }
  body.textContent = t("ui.updateDone", { head: res.head });
}

function bindUi() {
  $("fontUp").addEventListener("click", () => bumpScale(SCALE_STEP));
  $("fontDown").addEventListener("click", () => bumpScale(-SCALE_STEP));

  const FEEDBACK_TO = "bbomidor@gmail.com";
  const feedbackTypeLabels = { bug: "Баг / Bug", feature: "Пожелание / Feature request", other: "Другое / Other" };

  function feedbackShowStep(n) {
    $("feedbackStep1").classList.toggle("hidden", n !== 1);
    $("feedbackStep2").classList.toggle("hidden", n !== 2);
  }

  $("feedbackBtn").addEventListener("click", () => {
    $("feedbackText").value = "";
    feedbackShowStep(1);
    $("feedbackModal").classList.remove("hidden");
    $("feedbackText").focus();
  });
  $("feedbackCancel").addEventListener("click", () => $("feedbackModal").classList.add("hidden"));
  $("feedbackNext").addEventListener("click", () => {
    if (!$("feedbackText").value.trim()) { $("feedbackText").focus(); return; }
    feedbackShowStep(2);
  });
  $("feedbackBack").addEventListener("click", () => feedbackShowStep(1));

  $("feedbackModal").addEventListener("click", (e) => {
    const btn = e.target.closest(".feedback-client-btn");
    if (!btn) return;
    const client = btn.dataset.client;
    const type = document.querySelector("input[name=feedbackType]:checked")?.value || "other";
    const text = $("feedbackText").value.trim();
    const subject = encodeURIComponent(`Council Room v2 — ${feedbackTypeLabels[type] || type}`);
    const body = encodeURIComponent(text);
    const to = encodeURIComponent(FEEDBACK_TO);
    const urls = {
      gmail:   `https://mail.google.com/mail/?view=cm&to=${to}&su=${subject}&body=${body}`,
      outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`,
      yahoo:   `https://compose.mail.yahoo.com/?to=${FEEDBACK_TO}&subject=${subject}&body=${body}`,
      yandex:  `https://mail.yandex.ru/compose?to=${FEEDBACK_TO}&subject=${subject}&body=${body}`,
      mailto:  `mailto:${FEEDBACK_TO}?subject=${subject}&body=${body}`,
    };
    const url = urls[client] || urls.mailto;
    if (client === "mailto") { window.location.href = url; }
    else { window.open(url, "_blank", "noopener"); }
    $("feedbackModal").classList.add("hidden");
  });

  $("checkUpdates").addEventListener("click", openUpdateModal);
  $("updateCancel").addEventListener("click", () => $("updateModal").classList.add("hidden"));
  $("updateConfirm").addEventListener("click", applyUpdate);

  $("nextStepClose").addEventListener("click", () => {
    nextStepDismissed = true;
    renderNextStep();
  });
  $("nextStepReopen").addEventListener("click", () => {
    nextStepDismissed = false;
    renderNextStep();
  });

  $("toggleSubtaskStatement").addEventListener("click", () => {
    subtaskStatementExpanded = !subtaskStatementExpanded;
    renderActiveSubtask();
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

  $("toggleChatArchive").addEventListener("click", () => { panelOpen.chatArchive = !panelOpen.chatArchive; savePanelOpen(); render(); });
  $("toggleChatTrash").addEventListener("click", () => { panelOpen.chatTrash = !panelOpen.chatTrash; savePanelOpen(); render(); });
  $("emptyChatTrash").addEventListener("click", () => { if (confirm(t("ui.confirmEmptyChatTrash"))) api("POST", "/api/runs/trash/empty", {}); });
  $("toggleSubtaskArchive").addEventListener("click", () => { panelOpen.subtaskArchive = !panelOpen.subtaskArchive; savePanelOpen(); render(); });
  $("toggleSubtaskTrash").addEventListener("click", () => { panelOpen.subtaskTrash = !panelOpen.subtaskTrash; savePanelOpen(); render(); });
  $("emptyTrash").addEventListener("click", () => { if (confirm(t("ui.confirmEmptyTrash"))) api("POST", "/api/subtasks/trash/empty", {}); });
  $("toggleSwitcherStats").addEventListener("click", () => {
    panelOpen.switcherStats = !panelOpen.switcherStats;
    savePanelOpen();
    render();
    if (panelOpen.switcherStats) loadStats();
  });
  $("refreshSwitcher")?.addEventListener("click", () => {
    if (confirm(t("ui.confirmRefresh"))) {
      // Animation runs until server broadcasts a new statsVersion (real work done).
      switcherRefreshing = true;
      switcherRefreshBaseVer = currentState?.switcher?.statsVersion ?? null;
      $("refreshIcon")?.classList.add("refresh-spinning");
      $("switcherAccounts")?.classList.add("chips-loading");
      api("POST", "/api/switcher/refresh", {});
      // Fallback: clear after 120s in case broadcast never arrives.
      setTimeout(() => stopSwitcherRefreshAnim(), 120000);
    }
  });
  $("cancelLogin").addEventListener("click", () => $("loginModal").classList.add("hidden"));
  $("confirmLoginBtn").addEventListener("click", () => {
    $("loginModal").classList.add("hidden");
    if (pendingLogin) api("POST", "/api/switcher/login", pendingLogin);
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

  // Auto-resolve checkbox is a global UI pref (persisted in localStorage).
  const AUTORESOLVE_KEY = "council-room-v2.autoResolve";
  const autoResolveEl = $("autoResolve");
  if (autoResolveEl) {
    autoResolveEl.checked = localStorage.getItem(AUTORESOLVE_KEY) === "true";
    autoResolveEl.addEventListener("change", () => {
      try { localStorage.setItem(AUTORESOLVE_KEY, String(autoResolveEl.checked)); } catch {}
    });
  }

  $("autopilot").addEventListener("click", async () => {
    if (currentState.autopilot?.running) {
      await api("POST", "/api/autopilot/stop", {});
    } else {
      const autoResolve = $("autoResolve").checked;
      const guidance = $("guidance").value.trim();
      $("guidance").value = "";
      await api("POST", "/api/autopilot/start", { autoResolve, guidance });
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

  $("toggleMsgTrash").addEventListener("click", () => {
    showTrashedMsgs = !showTrashedMsgs;
    $("toggleMsgTrash").classList.toggle("active", showTrashedMsgs);
    $("toggleMsgTrash").lastChild.textContent = showTrashedMsgs ? " ▴" : " ▾";
    renderConversation();
  });

  // Trash / restore agent responses (delegated — cards are rebuilt each render).
  $("conversation").addEventListener("click", (event) => {
    const trashBtn = event.target.closest(".msg-trash");
    if (trashBtn) { api("POST", "/api/messages/trash", { id: trashBtn.dataset.id }); return; }
    const restoreBtn = event.target.closest(".msg-restore");
    if (restoreBtn) { api("POST", "/api/messages/restore", { id: restoreBtn.dataset.id }); return; }
  });

  const settingsHandlers = ["language", "codexModel", "codexEffort", "claudeModel", "claudeEffort", "codexMode", "codexAccount", "claudeMode", "claudeAccount"];
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

  // Phase 6b: debate-agent selection. The "Add agent" button offers auto/manual
  // from a blank slate; once agents exist it just appends one. Chips select an
  // agent (→ editor) or remove it.
  $("addAgent")?.addEventListener("click", () => {
    if (!(participantsDraft && participantsDraft.length)) openAddAgentModal();
    else addAgentManual();
  });
  $("addAgentAuto")?.addEventListener("click", addAgentAuto);
  $("addAgentManual")?.addEventListener("click", addAgentManual);
  $("addAgentCancel")?.addEventListener("click", closeAddAgentModal);
  $("agentChips")?.addEventListener("click", (event) => {
    const chip = event.target.closest(".agent-chip-sel");
    if (!chip) return;
    const key = chip.dataset.key;
    if (event.target.closest(".ac-remove")) { removeAgent(key); return; }
    selectedAgentKey = key;
    renderAgentChips();
    renderAgentEditor();
  });

  // Phase 6b: attached documents (file upload read as text, or pasted).
  $("docFileBtn")?.addEventListener("click", () => $("docFile")?.click());
  $("docFile")?.addEventListener("change", (event) => {
    const f = event.target.files && event.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("docText").value = String(reader.result || "");
      if (!$("docName").value.trim()) $("docName").value = f.name;
    };
    reader.onerror = () => showDocMsg(t("ui.docEmpty"), true);
    reader.readAsText(f);
    event.target.value = ""; // allow re-selecting the same file
  });
  $("docAdd")?.addEventListener("click", async () => {
    const text = $("docText").value;
    if (!text.trim()) { showDocMsg(t("ui.docEmpty"), true); return; }
    const name = $("docName").value.trim() || "document";
    try {
      const r = await fetch("/api/documents/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, text }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); showDocMsg(j.error || `error ${r.status}`, true); return; }
      $("docText").value = ""; $("docName").value = "";
      showDocMsg(t("ui.docAdded"), false);
    } catch (e) { showDocMsg(e.message, true); }
  });
  $("documentsList")?.addEventListener("click", (event) => {
    const rm = event.target.closest(".doc-remove");
    if (!rm) return;
    const id = rm.closest(".doc-row")?.dataset.id;
    if (id) api("POST", "/api/documents/remove", { id });
  });

  // Phase 5: profiles/roles panel. Add/apply buttons + delegated row controls.
  $("addProfileBtn")?.addEventListener("click", () => {
    addProfileDraft();
    // Surprise hamster 🐹 — appears ~30% of the time
    const h = $("profileHamster");
    if (h && Math.random() < 0.3) {
      h.classList.remove("hidden");
      h.classList.add("hamster-pop");
      setTimeout(() => { h.classList.add("hidden"); h.classList.remove("hamster-pop"); }, 1800);
    }
  });
  $("applyProvidersBtn")?.addEventListener("click", applyProviders);
  $("profilesList")?.addEventListener("click", (event) => {
    const rm = event.target.closest(".p-remove");
    if (rm) removeProfileDraft(rm.closest(".profile-row").dataset.id);
  });
  $("profilesList")?.addEventListener("change", (event) => {
    // Provider change swaps which fields are shown → full panel re-render.
    // Any other field change (label/model/...) just syncs the draft and
    // refreshes the connected-agent chips (no re-render, so focus is kept).
    if (event.target.classList.contains("p-provider")) {
      syncProvidersFromDOM();
      const id = event.target.closest(".profile-row")?.dataset.id;
      const p = providersDraft && providersDraft.profiles.find((x) => x.id === id);
      if (p && p.provider === "ollama") {
        const baseUrl = p.baseUrl || "http://localhost:11434/v1";
        fetchOllamaModels(baseUrl).then(() => renderProviders());
      } else {
        renderProviders();
      }
    }
    else if (event.target.classList.contains("p-apikey")) {
      // A key was just entered/changed → test it live; green ✓ only on success.
      syncProvidersFromDOM();
      const id = event.target.closest(".profile-row")?.dataset.id;
      const p = providersDraft.profiles.find((x) => x.id === id);
      const key = event.target.value.trim();
      if (p && key) testProfileKey(p, key);
    }
    else { syncProvidersFromDOM(); renderConnectedAgents(); }
  });

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
