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
    "tip.chatArchive": "Архив чатов. По «×» чат уходит в архив (не удаляется). Тут можно его восстановить обратно в «Чаты».|||закрыл рабочий чат «Phase 1» → он в архиве; через неделю вернулся, нажал ↩ — снова в списке.",
    "tip.subtaskArchive": "Архив подзадач. Кнопка «в архив» (🗄) на подзадаче убирает её из стека, но сохраняет. Клик по архивной — read-only просмотр в центре; ↩ — вернуть в стек.|||закрытую подзадачу «выбор БД» отправил в архив, чтобы не мешала. Позже кликнул — перечитал решение.",
    "tip.subtaskTrash": "Корзина подзадач. По «×» подзадача уходит сюда (восстановимо). Клик — read-only просмотр; ↩ — вернуть в стек; «Очистить» — удалить безвозвратно.|||создал лишнюю подзадачу, нажал × → в корзине. Передумал — ↩ вернул. Или «Очистить» — стереть весь мусор.",
    "ui.switcherConnected": "модуль свитч подключён",
    "ui.switcherOffline": "модуль свитч не подключён",
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
    "ui.providersPanel": "Профили и роли",
    "ui.profiles": "Профили",
    "ui.addProfile": "+ Профиль",
    "ui.applyProviders": "Применить",
    "ui.providersSaved": "Сохранено ✓",
    "ui.noProfiles": "Профилей нет — раунд использует поведение по умолчанию (Codex/Claude).",
    "ui.profileProvider": "Провайдер",
    "ui.profileModel": "Модель",
    "ui.profileAccount": "Аккаунт",
    "ui.profileBaseUrl": "Base URL",
    "ui.profileCredRef": "Env-переменная ключа",
    "ui.profileLabel": "Подпись",
    "ui.keySet": "ключ задан",
    "ui.keyMissing": "нет ключа",
    "ui.remove": "Удалить",
    "ui.roleMode": "Режим",
    "ui.roleChain": "Бэкенды (failover по порядку)",
    "ui.apiModeNote": "Режим API: подписочные CLI (Codex/Claude) отключены. Настрой роли через профили ниже.",
    "tip.providersPanel": "Единый слой провайдеров (Фаза 5). Профиль — это именованный бэкенд: API-провайдер (по ключу из .env), локальная Ollama или (в full-сборке) подписочный CLI. Роль A управляет слотом Codex, роль B — слотом Claude; каждая роль указывает на цепочку профилей (первый + failover). Если роли заданы здесь — они переопределяют простые контролы Codex/Claude выше.|||Роль A: [deepseek-chat]. Роль B: [ollama-llama3 → deepseek-chat] (auto) — на ошибке llama3 переключится на deepseek.",
    "tip.profileCredRef": "Имя переменной окружения, где лежит API-ключ (например DEEPSEEK_API_KEY). Сам ключ хранится в .env (он в .gitignore) или в окружении — НЕ в репозитории и не в state.json.|||DEEPSEEK_API_KEY → в .env строка DEEPSEEK_API_KEY=sk-...",
    "tip.roleChain": "Упорядоченная цепочка профилей. Режим auto: на ошибке/лимите первого пробуется следующий (failover). Режим manual: только первый, без переключения. Порядок = порядок профилей в списке выше.|||auto + [A, B]: A упал → пробуем B. manual + [A, B]: только A.",
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
    "tip.chatArchive": "Chat archive. The «×» moves a chat to the archive (not deleted). Restore it back to «Chats» from here.|||closed the «Phase 1» chat → it's archived; a week later you click ↩ and it's back in the list.",
    "tip.subtaskArchive": "Subtask archive. The «🗄» button moves a subtask out of the stack but keeps it. Click an archived one for a read-only preview; ↩ returns it to the stack.|||archived the resolved «pick DB» subtask to keep it out of the way; later clicked it to re-read the decision.",
    "tip.subtaskTrash": "Subtask trash. The «×» sends a subtask here (recoverable). Click for a read-only preview; ↩ restores to the stack; «Empty» deletes permanently.|||made an extra subtask, hit × → in trash. Changed your mind — ↩ restored it. Or «Empty» to wipe the junk.",
    "ui.switcherConnected": "switch module connected",
    "ui.switcherOffline": "switch module not connected",
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
    "ui.providersPanel": "Profiles & Roles",
    "ui.profiles": "Profiles",
    "ui.addProfile": "+ Profile",
    "ui.applyProviders": "Apply",
    "ui.providersSaved": "Saved ✓",
    "ui.noProfiles": "No profiles — the round uses the default Codex/Claude behavior.",
    "ui.profileProvider": "Provider",
    "ui.profileModel": "Model",
    "ui.profileAccount": "Account",
    "ui.profileBaseUrl": "Base URL",
    "ui.profileCredRef": "API key env var",
    "ui.profileLabel": "Label",
    "ui.keySet": "key set",
    "ui.keyMissing": "key missing",
    "ui.remove": "Remove",
    "ui.roleMode": "Mode",
    "ui.roleChain": "Backends (failover in order)",
    "ui.apiModeNote": "API mode: subscription CLIs (Codex/Claude) are disabled. Configure roles via the profiles below.",
    "tip.providersPanel": "Unified provider layer (Phase 5). A profile is a named backend: an API provider (key from .env), local Ollama, or (full build) a subscription CLI. Role A drives the Codex slot, role B the Claude slot; each role points at a profile chain (primary + failover). Roles defined here override the simple Codex/Claude controls above.|||Role A: [deepseek-chat]. Role B: [ollama-llama3 → deepseek-chat] (auto) — on a llama3 error it fails over to deepseek.",
    "tip.profileCredRef": "Name of the environment variable holding the API key (e.g. DEEPSEEK_API_KEY). The key itself lives in .env (gitignored) or the environment — NEVER in the repo or state.json.|||DEEPSEEK_API_KEY → a line DEEPSEEK_API_KEY=sk-... in .env",
    "tip.roleChain": "Ordered profile chain. auto mode: on an error/limit of the first, the next is tried (failover). manual mode: first only, no switching. Order = the profile order in the list above.|||auto + [A, B]: A fails → try B. manual + [A, B]: A only.",
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
  renderPinnedHint();
  renderSwitcher();
  updateTerminalsVisibility();
}

// ---- Next-step coach -----------------------------------------------------

let nextStepDismissed = false;
let subtaskStatementExpanded = false; // subtask-statement field: collapsed (2 lines) ↔ full
// UI-chrome prefs below are global (per-browser) and persisted in localStorage so
// they survive reload / PC reboot — same store as font scale and language.
let coachPinned = localStorage.getItem("council-room-v2.coachPinned") === "true";
const PANELS_KEY = "council-room-v2.panels";
const panelOpen = (() => {
  const def = { chatArchive: false, subtaskArchive: false, subtaskTrash: false, switcherStats: false };
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
      return { title: t("coach.allDone.title"), body: t("coach.allDone.body"), action: null, tone: "ok" };
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
  const allRuns = currentState.runs || [];
  const active = allRuns.filter((r) => !r.archived);
  const archived = allRuns.filter((r) => r.archived);

  const list = $("runList");
  list.innerHTML = "";
  for (const run of active) {
    const li = document.createElement("li");
    if (run.id === currentState.activeRunId) li.classList.add("active");
    li.innerHTML = `<span>${escapeHtml(run.topic)}</span><button class="archive-run" title="${escapeHtml(t("ui.toArchive"))}">🗄</button>`;
    li.addEventListener("click", (event) => {
      if (event.target.classList.contains("archive-run")) {
        api("POST", "/api/runs/archive", { runId: run.id });
        return;
      }
      api("POST", "/api/runs/switch", { runId: run.id });
    });
    list.appendChild(li);
  }

  // Chat archive panel
  $("toggleChatArchive").textContent = `🗄${archived.length ? " " + archived.length : ""}`;
  $("chatArchive").classList.toggle("hidden", !panelOpen.chatArchive);
  const aList = $("archivedRunList");
  aList.innerHTML = "";
  if (!archived.length) {
    const empty = document.createElement("li");
    empty.className = "muted small";
    empty.style.cursor = "default";
    empty.textContent = t("ui.archiveEmpty");
    aList.appendChild(empty);
  }
  for (const run of archived) {
    const li = document.createElement("li");
    li.classList.add("archived-row");
    li.innerHTML = `<span>${escapeHtml(run.topic)}</span><button class="restore-run" title="${escapeHtml(t("ui.restore"))}">↩</button>`;
    li.querySelector(".restore-run").addEventListener("click", (event) => {
      event.stopPropagation();
      api("POST", "/api/runs/restore", { runId: run.id });
    });
    aList.appendChild(li);
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

function renderSwitcher() {
  const el = $("switcherStatus");
  if (!el) return;
  const sw = currentState.switcher || {};
  const connected = Boolean(sw.connected);
  el.classList.toggle("connected", connected);
  $("switcherStatusText").textContent = connected ? t("ui.switcherConnected") : t("ui.switcherOffline");

  // 4 account buttons (2 codex, 2 claude); colour = remaining-token bucket.
  // Click → authorize that account (opens a login terminal in its env).
  const box = $("switcherAccounts");
  box.innerHTML = "";
  const accounts = sw.accounts || {};
  // One row per service (Codex / Claude) → 2 buttons per row normally, 3 when an
  // API profile is present. Hide an API profile until its key is actually set.
  const toolName = { codex: "Codex", claude: "Claude" };
  for (const tool of ["codex", "claude"]) {
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
let providersLang = null;

function blankRoles() {
  return {
    a: { slot: "codex", label: "Codex", mode: "auto", profileIds: [] },
    b: { slot: "claude", label: "Claude Code", mode: "auto", profileIds: [] },
  };
}

function initProvidersDraft() {
  const s = currentState.settings || {};
  if (Array.isArray(s.profiles) && s.profiles.length && s.roles && s.roles.a && s.roles.b) {
    providersDraft = JSON.parse(JSON.stringify({ profiles: s.profiles, roles: s.roles }));
  } else {
    providersDraft = { profiles: [], roles: blankRoles() };
  }
}

function renderProvidersInit() {
  const rid = currentState.activeRunId || null;
  if (providersDraft === null || providersForRunId !== rid) {
    providersForRunId = rid;
    initProvidersDraft();
    renderProviders();
  } else if (providersLang !== UI_LANG) {
    syncProvidersFromDOM(); // preserve edits across a language flip
    renderProviders();
  }
  providersLang = UI_LANG;
}

function isCliProviderId(provider) { return provider === "cli-codex" || provider === "cli-claude"; }

function presetById(id) {
  return ((currentState.providers && currentState.providers.presets) || []).find((p) => p.id === id) || null;
}

function providerOptions() {
  const info = currentState.providers || {};
  const opts = (info.presets || []).map((p) => p.id);
  opts.push("openai-compatible", "ollama");
  if ((info.mode || "full") !== "api") opts.push("cli-codex", "cli-claude");
  return opts;
}

function helpIcon(tipKey) {
  const tip = t(`tip.${tipKey}`);
  return `<span class="help" data-tooltip-key="t.${tipKey}" data-tooltip-text="${escapeHtml(tip)}">?</span>`;
}

function renderProfileRow(p) {
  const provSel = providerOptions().map((o) => `<option value="${o}"${o === p.provider ? " selected" : ""}>${o}</option>`).join("");
  const cli = isCliProviderId(p.provider);
  const preset = presetById(p.provider);
  const creds = (currentState.providers && currentState.providers.credentials) || {};
  const needsKey = !cli && p.provider !== "ollama" && (preset ? preset.needsKey : true);
  const keyBadge = needsKey
    ? `<span class="key-badge ${creds[p.id] ? "ok" : "miss"}">${creds[p.id] ? t("ui.keySet") : t("ui.keyMissing")}</span>`
    : "";
  let fields = `<label class="p-field"><span>${t("ui.profileModel")}</span><input class="p-model" value="${escapeHtml(p.model || "")}" placeholder="${cli ? "auto" : "model"}"></label>`;
  if (cli) {
    fields += `<label class="p-field"><span>${t("ui.profileAccount")}</span><select class="p-account">
      <option value="acc1"${p.account === "acc1" ? " selected" : ""}>acc1</option>
      <option value="acc2"${p.account === "acc2" ? " selected" : ""}>acc2</option>
    </select></label>`;
  } else {
    fields += `<label class="p-field"><span>${t("ui.profileBaseUrl")}</span><input class="p-baseurl" value="${escapeHtml(p.baseUrl || (preset ? preset.baseUrl : ""))}" placeholder="https://.../v1"></label>`;
    if (p.provider !== "ollama") {
      fields += `<label class="p-field"><span>${t("ui.profileCredRef")} ${helpIcon("profileCredRef")}</span><input class="p-credref" value="${escapeHtml(p.credentialRef || (preset ? preset.credentialRef : ""))}" placeholder="MY_API_KEY"></label>`;
    }
  }
  return `<div class="profile-row" data-id="${escapeHtml(p.id)}">
    <div class="profile-head">
      <input class="p-label" value="${escapeHtml(p.label || "")}" placeholder="${t("ui.profileLabel")}">
      <select class="p-provider">${provSel}</select>
      ${keyBadge}
      <button type="button" class="p-remove" title="${t("ui.remove")}">×</button>
    </div>
    <div class="profile-fields">${fields}</div>
  </div>`;
}

function renderRoleEditor(slot) {
  const r = providersDraft.roles[slot];
  const title = slot === "a" ? "A · Codex" : "B · Claude";
  const checks = providersDraft.profiles.map((p) => {
    const checked = (r.profileIds || []).includes(p.id);
    return `<label class="chain-item"><input type="checkbox" class="role-chain" data-id="${escapeHtml(p.id)}"${checked ? " checked" : ""}> ${escapeHtml(p.label || p.id)}</label>`;
  }).join("") || `<span class="muted small">—</span>`;
  return `<div class="role-card" data-slot="${slot}">
    <div class="role-title">${title}</div>
    <label class="p-field"><span>${t("ui.profileLabel")}</span><input class="role-label" value="${escapeHtml(r.label || "")}"></label>
    <label class="p-field"><span>${t("ui.roleMode")}</span><select class="role-mode">
      <option value="auto"${r.mode === "auto" ? " selected" : ""}>auto</option>
      <option value="manual"${r.mode === "manual" ? " selected" : ""}>manual</option>
    </select></label>
    <div class="role-chain-label">${t("ui.roleChain")} ${helpIcon("roleChain")}</div>
    <div class="role-chain-list">${checks}</div>
  </div>`;
}

function renderProviders() {
  if (!providersDraft) return;
  const list = $("profilesList");
  if (!list) return;
  list.innerHTML = providersDraft.profiles.length
    ? providersDraft.profiles.map(renderProfileRow).join("")
    : `<div class="muted small">${t("ui.noProfiles")}</div>`;
  $("roleAEdit").innerHTML = renderRoleEditor("a");
  $("roleBEdit").innerHTML = renderRoleEditor("b");
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
  for (const slot of ["a", "b"]) {
    const card = document.querySelector(`.role-card[data-slot="${slot}"]`);
    if (!card) continue;
    const r = providersDraft.roles[slot];
    if (card.querySelector(".role-label")) r.label = card.querySelector(".role-label").value;
    if (card.querySelector(".role-mode")) r.mode = card.querySelector(".role-mode").value;
    r.profileIds = [...card.querySelectorAll(".role-chain:checked")].map((c) => c.dataset.id);
  }
}

function addProfileDraft() {
  syncProvidersFromDOM();
  const apiMode = (currentState.providers && currentState.providers.mode) === "api";
  const provider = apiMode ? "ollama" : "cli-codex";
  const p = { id: `p${Date.now().toString(36)}`, label: "", provider, model: "" };
  if (isCliProviderId(provider)) p.account = "acc1";
  providersDraft.profiles.push(p);
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

function showProvidersMsg(text, isError) {
  const el = $("providersMsg");
  if (!el) return;
  el.textContent = text;
  el.className = `providers-msg ${isError ? "err" : "ok"}`;
  clearTimeout(showProvidersMsg._t);
  showProvidersMsg._t = setTimeout(() => { el.textContent = ""; el.className = "providers-msg"; }, 4000);
}

async function applyProviders() {
  syncProvidersFromDOM();
  const ids = providersDraft.profiles.map((p) => p.id);
  if (new Set(ids).size !== ids.length) { showProvidersMsg("duplicate profile ids", true); return; }
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
    showProvidersMsg(t("ui.providersSaved"), false);
  } catch (e) {
    showProvidersMsg(e.message, true);
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
  $("toggleSubtaskArchive").addEventListener("click", () => { panelOpen.subtaskArchive = !panelOpen.subtaskArchive; savePanelOpen(); render(); });
  $("toggleSubtaskTrash").addEventListener("click", () => { panelOpen.subtaskTrash = !panelOpen.subtaskTrash; savePanelOpen(); render(); });
  $("emptyTrash").addEventListener("click", () => { if (confirm(t("ui.confirmEmptyTrash"))) api("POST", "/api/subtasks/trash/empty", {}); });
  $("toggleSwitcherStats").addEventListener("click", () => {
    panelOpen.switcherStats = !panelOpen.switcherStats;
    savePanelOpen();
    render();
    if (panelOpen.switcherStats) loadStats();
  });
  $("refreshSwitcher").addEventListener("click", () => {
    if (confirm(t("ui.confirmRefresh"))) api("POST", "/api/switcher/refresh", {});
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

  // Phase 5: profiles/roles panel. Add/apply buttons + delegated row controls.
  $("addProfileBtn")?.addEventListener("click", addProfileDraft);
  $("applyProvidersBtn")?.addEventListener("click", applyProviders);
  $("profilesList")?.addEventListener("click", (event) => {
    const rm = event.target.closest(".p-remove");
    if (rm) removeProfileDraft(rm.closest(".profile-row").dataset.id);
  });
  $("profilesList")?.addEventListener("change", (event) => {
    if (event.target.classList.contains("p-provider")) { syncProvidersFromDOM(); renderProviders(); }
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
