# ai-switcher — Local Operator Gateway

Локальный HTTP-gateway для запуска Claude Code и Codex через изолированные профили.

## Быстрый старт

```bat
claude-launcher.bat        # выбор аккаунта + запуск Claude
```

```powershell
node server.js             # запустить gateway (порт 7700)
bin\ai-status.ps1          # статус
bin\ai-policy.ps1 list     # политики проектов
bin\ai-register.ps1 <id>   # зарегистрировать проект
bin\ai-claude.ps1 "1+1="   # запрос через gateway
bin\ai-kill.ps1 claude     # остановить запущенный процесс
```

## Профили

| Профиль | Config dir |
|---------|-----------|
| claude acc1 | `%USERPROFILE%\.claude` (default) |
| claude acc2 | `auth\claude-acc2` |
| codex acc1  | `%CODEX_HOME%` (default) |
| codex acc2  | `auth\codex-acc2` |

## HTTP API (127.0.0.1:7700)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET   | /status  | Активные профили, failover |
| POST  | /run     | Запуск Claude/Codex |
| POST  | /switch  | Переключить профиль |
| POST  | /register| Зарегистрировать проект |
| GET   | /policy  | Список политик |
| POST  | /policy  | Установить политику |
| POST  | /kill    | Остановить процесс |

## Политики проектов

- `protected` — заблокированы (adaptive_systems_lab, game_agent)
- `client-allowed` — разрешены (Work, codeburn, AI_Bot, Council Room)
- `ignore` — пропускаются (cvat, OpenCode, ...)
- `unclassified` — блокируются по умолчанию

## Файлы состояния

| Файл | Назначение |
|------|-----------|
| `active.json` | Текущий активный профиль |
| `profiles.json` | Все профили + failover флаги |
| `projects.policy.json` | Политики проектов |
| `audit.ndjson` | Лог всех запусков (gitignore) |
| `limits.ndjson` | Лог rate-limit событий (gitignore) |

## Phase 1B

Разблокируется только после реального Codex sample с `rate_limit_reached_type != null`.  
Codex `failoverEnabled` = **false** до тех пор.
