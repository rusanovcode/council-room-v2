# ai-switcher — Инструкция по установке и эксплуатации

## Принцип действия

```
Агент / скрипт
     │
     ▼  HTTP POST /run
┌─────────────────────────────────────────────────┐
│  server.js  (127.0.0.1:7700)                    │
│                                                 │
│  1. Проверяет политику проекта (projects.policy.json)
│  2. Берёт активный профиль из active.json       │
│  3. Строит env (configDir или API-ключ)         │
│  4. Запускает claude / codex через этот env     │
│  5. Детектирует лимиты → авто-переключает профиль
│  6. Пишет аудит в audit.ndjson                  │
└─────────────────────────────────────────────────┘
     │
     ├── claude CLI  (использует CLAUDE_CONFIG_DIR)
     └── codex.exe   (использует CODEX_HOME)
```

### Три режима профиля

| Профиль | Режим    | Что используется                          |
|---------|----------|-------------------------------------------|
| `acc1`  | session  | дефолтная папка `~/.claude` / `~/.codex`  |
| `acc2`  | session  | `auth/claude-acc2` или `auth/codex-acc2`  |
| `apikey`| api      | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`    |

Активный профиль хранится в `active.json`. Переключение — запрос к `/switch`.

---

## Требования

- **Windows 10/11**, PowerShell 5.1+
- **Node.js 18+** (проверить: `node -v`)
- **Claude CLI** — установлен и доступен как `claude` в PATH
- **Codex CLI** — `%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe` (стандартный путь установщика OpenAI)
- **npm** — для `npm install` зависимостей

---

## 1. Первоначальная установка (новый ПК)

### 1.1 Скопировать репозиторий

```powershell
# Папка должна быть именно здесь — пути захардкожены в auth/
xcopy /E /I "\\source\ai-switcher" "C:\AI\ai-switcher"
cd C:\AI\ai-switcher
npm install
```

> **Важно:** `auth/` содержит сессии и ключи — в git не хранится.
> Её нужно скопировать вручную или заново авторизоваться (см. ниже).

### 1.2 Создать структуру auth/

Если `auth/` не переносится, создать вручную:

```powershell
New-Item -ItemType Directory -Force C:\AI\ai-switcher\auth\claude-acc2
New-Item -ItemType Directory -Force C:\AI\ai-switcher\auth\codex-acc2
# api-keys.json создаётся автоматически при первом POST /api-key,
# либо создать вручную:
'{"claude":{},"codex":{}}' | Out-File C:\AI\ai-switcher\auth\api-keys.json -Encoding utf8
```

---

## 2. Авторизация аккаунтов

### Аккаунт 1 — стандартный (acc1)

Acc1 использует дефолтную папку Claude/Codex (`~/.claude`, `~/.codex`).
Если вы уже залогинены через обычный `claude` — acc1 готов.

```powershell
# Проверить:
claude --version
# Если не залогинен:
claude
# → пройти авторизацию в браузере
```

Для Codex acc1:
```powershell
# Если не залогинен:
& "$env:LOCALAPPDATA\OpenAI\Codex\bin\codex.exe"
# → пройти авторизацию
```

### Аккаунт 2 — изолированный (acc2)

Acc2 хранит свою сессию в `auth/claude-acc2` и `auth/codex-acc2`.

**Claude acc2:**
```powershell
# Запустить claude с указанием папки конфига:
$env:CLAUDE_CONFIG_DIR = "C:\AI\ai-switcher\auth\claude-acc2"
claude
# → залогиниться под ВТОРЫМ аккаунтом в браузере
# После успешного входа — закрыть
Remove-Item Env:\CLAUDE_CONFIG_DIR
```

**Codex acc2:**
```powershell
$env:CODEX_HOME = "C:\AI\ai-switcher\auth\codex-acc2"
& "$env:LOCALAPPDATA\OpenAI\Codex\bin\codex.exe"
# → залогиниться под вторым аккаунтом
Remove-Item Env:\CODEX_HOME
```

> Сессии сохраняются в папках `auth/`. После перезапуска сервера
> авторизация сохраняется — повторять не нужно.

### API-ключ (apikey)

API-режим не требует браузерного входа. Ключ хранится в `auth/api-keys.json` (gitignored).

**Через PowerShell-хелпер (рекомендуется — ввод скрыт):**
```powershell
.\bin\ai-apikey.ps1 set -Service claude
# Введёт: Enter API key for claude/apikey: ****

.\bin\ai-apikey.ps1 set -Service codex
# Введёт: Enter API key for codex/apikey:  ****
```

**Через curl / напрямую:**
```powershell
# Claude (Anthropic):
Invoke-RestMethod http://127.0.0.1:7700/api-key -Method POST `
  -Body '{"service":"claude","profile":"apikey","key":"sk-ant-XXXX"}' `
  -ContentType "application/json"

# Codex (OpenAI):
Invoke-RestMethod http://127.0.0.1:7700/api-key -Method POST `
  -Body '{"service":"codex","profile":"apikey","key":"sk-XXXX"}' `
  -ContentType "application/json"
```

**Проверить, что ключ установлен:**
```powershell
.\bin\ai-apikey.ps1 status
# или
Invoke-RestMethod "http://127.0.0.1:7700/api-key?service=claude&profile=apikey"
# → { service: "claude", profile: "apikey", set: true }
```

**Удалить ключ:**
```powershell
.\bin\ai-apikey.ps1 delete -Service claude
```

---

## 3. Запуск сервера

```powershell
cd C:\AI\ai-switcher
node server.js
# Gateway listening on http://127.0.0.1:7700
```

**В фоне (скрытое окно):**
```powershell
Start-Process node -ArgumentList "C:\AI\ai-switcher\server.js" `
  -WorkingDirectory "C:\AI\ai-switcher" -WindowStyle Hidden
```

**Проверить статус:**
```powershell
.\bin\ai-status.ps1
# или
Invoke-RestMethod http://127.0.0.1:7700/status
```

---

## 4. Переключение активного профиля

```powershell
# Переключить Claude на acc2 (сессия второго аккаунта):
Invoke-RestMethod http://127.0.0.1:7700/switch -Method POST `
  -Body '{"service":"claude","profile":"acc2"}' -ContentType "application/json"

# Переключить Claude на API-ключ:
Invoke-RestMethod http://127.0.0.1:7700/switch -Method POST `
  -Body '{"service":"claude","profile":"apikey"}' -ContentType "application/json"

# Переключить Codex на acc1 (основной):
Invoke-RestMethod http://127.0.0.1:7700/switch -Method POST `
  -Body '{"service":"codex","profile":"acc1"}' -ContentType "application/json"
```

Текущий активный профиль виден в `/status` → поле `active`.

---

## 5. Политики проектов

Сервер **откажет** запускать проект, если его путь не прошёл политику.
Политики описаны в `projects.policy.json`.

| Политика         | Что означает                              |
|------------------|-------------------------------------------|
| `client-allowed` | Разрешено — агенты могут делать `/run`    |
| `protected`      | Запрещено — только ручной запуск          |
| `ignore`         | Явно отключено (системные папки)          |
| `unclassified`   | Не найдено правило → тоже запрещено       |

**Зарегистрировать новый проект (добавить как client-allowed):**
```powershell
.\bin\ai-register.ps1 "MyProject" "C:\AI\MyProject"
```

**Посмотреть все правила:**
```powershell
.\bin\ai-policy.ps1 list
```

**Вручную установить политику:**
```powershell
.\bin\ai-policy.ps1 set "MyProject" client-allowed
.\bin\ai-policy.ps1 set "MyProject" protected
```

> Matching идёт по подстроке пути. Например, правило `"Work"` сработает
> для `C:\AI\Work\myproject` и для `D:\Work\other`.

---

## 6. Подключение агентов

Агент делает один HTTP-запрос — никаких зависимостей не нужно.

### Минимальный пример (PowerShell):

```powershell
$resp = Invoke-RestMethod http://127.0.0.1:7700/run -Method POST -ContentType "application/json" -Body (
    @{
        service   = "claude"
        prompt    = "Напиши функцию сортировки на Python"
        cwd       = "C:\AI\MyProject"
        projectId = "MyProject"
    } | ConvertTo-Json
)
Write-Output $resp.output
```

### Минимальный пример (Node.js / fetch):

```javascript
const resp = await fetch("http://127.0.0.1:7700/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    service:   "claude",      // "claude" или "codex"
    prompt:    "1+1=",
    cwd:       "C:\\AI\\MyProject",
    projectId: "MyProject"   // должен совпадать с правилом в policy
  })
});
const data = await resp.json();
console.log(data.output);
```

### Поля ответа `/run`:

```jsonc
{
  "output":        "2",          // stdout процесса
  "stderr":        "",           // stderr (только Claude)
  "exitCode":      0,
  "limitDetected": false,        // был ли обнаружен рейт-лимит
  "denyMatched":   false,        // ошибка авторизации/сети
  "switchOccurred":false,        // произошло ли авто-переключение профиля
  "activeProfile": "acc2",       // какой профиль ответил
  "reason":        null          // причина остановки, если было
}
```

---

## 7. Детектирование и обработка ошибок

### Как работает авто-переключение

Сервер анализирует вывод процесса по двухуровневой схеме:

```
Запуск на активном профиле
        │
        ▼
Deny-list проверка (приоритет!)
  • HTTP 401/403
  • "authentication_failed", "invalid_request", "oauth_org_not_allowed"
  • "network", "timeout", "ECONNRESET", "getaddrinfo"
        │ совпало?
        ▼ ДА → ответить клиенту, НЕ переключать
        │ НЕТ
        ▼
Whitelist проверка
  Claude: HTTP 429 + текст "you've hit your limit"
  Codex:  rate_limit_reached_type в JSONL
        │ совпало?
        ▼ ДА (и первая попытка) → переключить на другой профиль → повтор
        │ НЕТ / уже retry → вернуть результат
```

**Для Claude** лимиты читаются из JSONL-файлов в `CLAUDE_CONFIG_DIR/projects/`.
**Для Codex** лимиты читаются из PTY-вывода и JSONL в `CODEX_HOME/sessions/`.

> В API-режиме JSONL-файлов нет — авто-переключение не работает.
> Ошибки API возвращаются напрямую в `stderr` / `output`.

### Диагностика вручную

```powershell
# Последние события аудита:
Get-Content C:\AI\ai-switcher\audit.ndjson -Tail 20 | ForEach-Object { $_ | ConvertFrom-Json } | Format-Table ts, action, service, profile, switchReason -AutoSize

# Обнаруженные лимиты:
Get-Content C:\AI\ai-switcher\limits.ndjson -Tail 10

# Текущие локи (активные запуски):
.\bin\ai-status.ps1 | ConvertFrom-Json | Select-Object -ExpandProperty locks
```

**Принудительно убить зависший процесс:**
```powershell
.\bin\ai-kill.ps1 claude acc2
.\bin\ai-kill.ps1 codex acc1
```

---

## 8. Полный список эндпоинтов

| Метод  | Путь          | Назначение                                   |
|--------|---------------|----------------------------------------------|
| GET    | `/status`     | Статус сервера, активные профили, локи       |
| POST   | `/run`        | Запустить claude/codex                       |
| POST   | `/switch`     | Сменить активный профиль                     |
| GET    | `/policy`     | Список политик проектов                      |
| POST   | `/policy`     | Установить политику проекта                  |
| POST   | `/register`   | Зарегистрировать проект как client-allowed   |
| GET    | `/api-key`    | Проверить, установлен ли ключ (без значения) |
| POST   | `/api-key`    | Сохранить API-ключ                           |
| DELETE | `/api-key`    | Удалить API-ключ                             |
| POST   | `/kill`       | Убить зависший процесс                       |

---

## 9. CLI-хелперы (bin/)

| Скрипт              | Что делает                                |
|---------------------|-------------------------------------------|
| `ai-status.ps1`     | Показать `/status` в JSON                 |
| `ai-claude.ps1`     | Отправить промт в Claude через gateway    |
| `ai-codex.ps1`      | Отправить промт в Codex через gateway     |
| `ai-register.ps1`   | Зарегистрировать проект                   |
| `ai-policy.ps1`     | Просмотр и изменение политик              |
| `ai-apikey.ps1`     | Управление API-ключами                    |
| `ai-tokens.ps1`     | Статистика использования токенов          |
| `ai-kill.ps1`       | Убить зависший процесс                    |

**Быстрый тест после установки:**
```powershell
# Сервер должен быть запущен
.\bin\ai-claude.ps1 "1+1=" "C:\AI\ai-switcher"
# Ожидаемый ответ: 2
```

---

## 10. Чеклист переноса на новый ПК

- [ ] Скопировать `C:\AI\ai-switcher\` (без `node_modules/`, `auth/`, `*.ndjson`, `tokens.json`)
- [ ] `npm install` в папке проекта
- [ ] Установить Claude CLI, залогиниться (acc1)
- [ ] Установить Codex CLI, залогиниться (acc1)
- [ ] Запустить `claude` с `CLAUDE_CONFIG_DIR=...auth\claude-acc2`, залогиниться (acc2)
- [ ] Запустить `codex` с `CODEX_HOME=...auth\codex-acc2`, залогиниться (acc2)
- [ ] Если нужен API-режим: `.\bin\ai-apikey.ps1 set -Service claude`
- [ ] Запустить сервер: `node server.js`
- [ ] Проверить: `Invoke-RestMethod http://127.0.0.1:7700/status`
- [ ] Проверить: `.\bin\ai-claude.ps1 "1+1=" "C:\AI\ai-switcher"`
- [ ] Настроить `projects.policy.json` под свои проекты

---

## 11. Ключевые файлы

```
C:\AI\ai-switcher\
├── server.js              # HTTP gateway (ядро системы)
├── profiles.json          # Описание профилей (acc1, acc2, apikey)
├── active.json            # Текущий активный профиль (писать не вручную)
├── projects.policy.json   # Политики допуска проектов
├── SETUP.md               # Этот файл
│
├── auth/                  # GITIGNORED — сессии и ключи
│   ├── claude-acc2/       # Данные второго аккаунта Claude
│   ├── codex-acc2/        # Данные второго аккаунта Codex
│   └── api-keys.json      # API-ключи (записываются через /api-key)
│
├── bin/                   # PowerShell-хелперы
│   ├── ai-status.ps1
│   ├── ai-claude.ps1
│   ├── ai-codex.ps1
│   ├── ai-apikey.ps1
│   ├── ai-register.ps1
│   ├── ai-policy.ps1
│   ├── ai-tokens.ps1
│   └── ai-kill.ps1
│
├── audit.ndjson           # Лог всех операций (gitignored)
├── limits.ndjson          # Лог обнаруженных лимитов (gitignored)
└── tokens.json            # Статистика использования (gitignored)
```
