# Сессия: Настройка переключателя аккаунтов Claude Code и Codex
**Дата:** 2026-05-26

---

## Цель

Настроить возможность использовать два аккаунта Claude Code и два аккаунта Codex (ChatGPT/OpenAI) без ручного логина/логаута — через переключение переменных окружения.

---

## Что сделано

### 1. Авторизация второго аккаунта Codex

Нашли исполняемый файл Codex:
```
C:\Users\Иван\AppData\Local\OpenAI\Codex\bin\codex.exe
```

Запустили логин второго аккаунта с кастомным `CODEX_HOME`:
```powershell
$env:CODEX_HOME = "C:\AI\ai-switcher\auth\codex-acc2"
& "C:\Users\Иван\AppData\Local\OpenAI\Codex\bin\codex.exe" login
```

Результат: `auth.json` появился в `C:\AI\ai-switcher\auth\codex-acc2\` — аккаунт авторизован.

---

### 2. Принцип переключения аккаунтов

| Инструмент | Переменная окружения | Аккаунт 1 (основной) | Аккаунт 2 |
|------------|---------------------|----------------------|-----------|
| Claude Code | `CLAUDE_CONFIG_DIR` | `%USERPROFILE%\.claude\` (по умолчанию) | `C:\AI\ai-switcher\auth\claude-acc2\` |
| Codex | `CODEX_HOME` | `%USERPROFILE%\.codex\` (по умолчанию) | `C:\AI\ai-switcher\auth\codex-acc2\` |

Если переменная **не задана** → используется основной аккаунт.  
Если переменная **задана** → используется указанная папка с учётными данными.

---

### 3. Структура файлов

```
C:\AI\
├── claude2.bat                  ← запуск Claude Code, 2-й аккаунт
├── codex2.bat                   ← запуск Codex, 2-й аккаунт
└── ai-switcher\
    ├── switch.ps1               ← PowerShell-переключатель
    ├── SUMMARY.md               ← этот файл
    └── auth\
        ├── claude-acc2\         ← конфиг Claude Code 2-го аккаунта
        │   ├── .credentials.json
        │   ├── .claude.json
        │   └── settings.json    (bypassPermissions включён)
        └── codex-acc2\          ← конфиг Codex 2-го аккаунта
            └── auth.json

C:\AI\Council Room\
├── Council Room.bat             ← запуск с 1-ми аккаунтами (порт 8787)
├── council2.bat                 ← запуск со 2-ми аккаунтами (порт 8788)
└── council2.ps1                 ← PowerShell-скрипт (вызывается из council2.bat)
```

---

### 4. Созданные файлы

#### `C:\AI\claude2.bat`
```bat
@echo off
set CLAUDE_CONFIG_DIR=C:\AI\ai-switcher\auth\claude-acc2
"%USERPROFILE%\.local\bin\claude" %*
```
Использует `%USERPROFILE%` вместо хардкода пути с кириллицей (`Иван`).

#### `C:\AI\codex2.bat`
```bat
@echo off
set CODEX_HOME=C:\AI\ai-switcher\auth\codex-acc2
"%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe" %*
```

#### `C:\AI\ai-switcher\switch.ps1`
PowerShell-переключатель с валидацией параметров:
```powershell
.\switch.ps1 claude 2   # запустить Claude Code, 2-й аккаунт
.\switch.ps1 codex 1    # запустить Codex, основной аккаунт
```
Поддерживает: `claude` / `codex`, аккаунты `1` / `2`.

#### `C:\AI\Council Room\council2.bat` + `council2.ps1`
Запускает Council Room на порту **8788** (основной — на 8787) со всеми переменными второго аккаунта.

---

### 5. Решённые проблемы

#### Проблема: кириллица в путях
`C:\Users\Иван\...` — в `cmd.exe` (code page 866) кириллические символы не читаются корректно при хардкоде.

**Решение:** использовать `%USERPROFILE%` и `%LOCALAPPDATA%` — Windows сам разворачивает в корректный путь.

#### Проблема: `codex` не найден в PATH
`codex` не добавлен в PATH автоматически при установке через OpenAI desktop app.

**Решение:** прямой путь к `codex.exe` через `%LOCALAPPDATA%`.

#### Проблема: `claude2.bat` и `codex2.bat` не запускались
Версия 1 батников хардкодила путь с кириллицей → сбой.

**Решение:** замена на `%USERPROFILE%` / `%LOCALAPPDATA%`. Проверка: `--version` вернул корректные версии.

#### Проблема: `C:\AI` не в PATH
`claude2` и `codex2` не работали из произвольной папки.

**Решение:** добавили `C:\AI` в начало пользовательского PATH через `[Environment]::SetEnvironmentVariable`.

#### Проблема: Council Room не запускал 2-й сервер (порт занят)
`Council Room.bat` использует порт 8787 — при запуске council2 конфликт.

**Решение:** `council2` использует порт 8788 через `AGENT_ROOM_PORT=8788`.

#### Проблема: Claude в Council Room — "Not logged in"
Council Room читал `CLAUDE_USAGE_CACHE` с первого аккаунта → считал лимит исчерпанным. Плюс переменные окружения не доходили через `cmd /k` конструкцию в BAT.

**Решение (финальное):**
- Добавлен `CLAUDE_USAGE_CACHE` → папка 2-го аккаунта
- Добавлен `CLAUDE_CMD` → короткий путь без кириллицы: `C:\Users\3C8A~1\.local\bin\claude.exe`
- BAT переписан на вызов PowerShell-скрипта (`council2.ps1`) — PowerShell надёжно передаёт переменные окружения в дочерний процесс `node server.js`

---

### 6. Настройки второго аккаунта Claude Code

`C:\AI\ai-switcher\auth\claude-acc2\settings.json`:
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "theme": "dark",
  "skipDangerousModePermissionPrompt": true
}
```

---

### 7. Использование

#### Из терминала (после перезапуска — `C:\AI` в PATH):
```cmd
claude          → Claude Code, основной аккаунт
claude2         → Claude Code, 2-й аккаунт
codex           → Codex, основной аккаунт
codex2          → Codex, 2-й аккаунт
```

#### Council Room:
```
C:\AI\Council Room\Council Room.bat  → агенты на 1-х аккаунтах, http://localhost:8787
C:\AI\Council Room\council2.bat      → агенты на 2-х аккаунтах, http://localhost:8788
```

#### PowerShell-переключатель:
```powershell
cd C:\AI\ai-switcher
.\switch.ps1 claude 1
.\switch.ps1 claude 2
.\switch.ps1 codex 1
.\switch.ps1 codex 2
```

---

### 8. Что не автоматизировано

- **Автопереключение при исчерпании лимитов** — обсуждалось в Council Room (детектор через JSONL для Claude, stdout+stderr для Codex), но не реализовано. Пока переключение ручное.
- **Оркестратор-наблюдатель** — концепция разработана агентами в Council Room, реализация отложена до получения реального sample лимита от Codex.

---

## Итог

Оба аккаунта Claude Code и оба аккаунта Codex готовы к использованию. Переключение — запуском соответствующего батника. Council Room работает с обоими парами аккаунтов на разных портах одновременно.
