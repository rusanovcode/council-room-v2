# Переключение аккаунтов Claude Code и Codex

## Быстрый запуск

| Что запустить | Команда / файл |
|---------------|----------------|
| Claude Code — акк 1 | `claude` |
| Claude Code — акк 2 | `claude2` или `C:\AI\claude2.bat` |
| Codex — акк 1 | `codex` |
| Codex — акк 2 | `codex2` или `C:\AI\codex2.bat` |
| Council Room — акк 1 | `C:\AI\Council Room\Council Room.bat` → http://localhost:8787 |
| Council Room — акк 2 | `C:\AI\Council Room\council2.bat` → http://localhost:8788 |

---

## Принцип работы

Чтобы инструмент использовал **второй аккаунт** — нужно задать переменную окружения **перед запуском**:

```bat
rem Claude Code
set "CLAUDE_CONFIG_DIR=C:\AI\ai-switcher\auth\claude-acc2"

rem Codex
set "CODEX_HOME=C:\AI\ai-switcher\auth\codex-acc2"
```

Без переменной → первый аккаунт (папки по умолчанию).

---

## Если добавляешь новый батник / скрипт

Вставь одну строку перед запуском claude или codex:

```bat
@echo off
set "CLAUDE_CONFIG_DIR=C:\AI\ai-switcher\auth\claude-acc2"   <- добавить эту строку
claude ...
```

```bat
@echo off
set "CODEX_HOME=C:\AI\ai-switcher\auth\codex-acc2"           <- или эту
codex ...
```

---

## Где хранятся данные

```
C:\AI\ai-switcher\auth\
├── claude-acc2\    ← конфиг, credentials, settings Claude Code акк 2
└── codex-acc2\     ← auth.json Codex акк 2
```

---

## PowerShell-переключатель

```powershell
cd C:\AI\ai-switcher
.\switch.ps1 claude 1   # Claude Code, акк 1
.\switch.ps1 claude 2   # Claude Code, акк 2
.\switch.ps1 codex 1    # Codex, акк 1
.\switch.ps1 codex 2    # Codex, акк 2
```
