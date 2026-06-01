# Подключение HERMES к ai-switcher

Документ описывает, как HERMES-IDE использует профили Claude Code и Codex из `C:\AI\ai-switcher`.

## Что уже подключено

HERMES умеет запускать Claude/Codex с выбором аккаунта при создании новой сессии.

В окне `New session` для Claude и Codex доступен выбор:

| Выбор в HERMES | Что происходит |
| --- | --- |
| `Switcher active` | HERMES читает `C:\AI\ai-switcher\active.json` и берет активный профиль |
| `Account 1` | HERMES убирает переменную профиля и запускает дефолтный аккаунт |
| `Account 2` | HERMES выставляет путь к профилю из `C:\AI\ai-switcher\auth` |

## Пути аккаунтов

Для второго аккаунта используются эти переменные окружения:

```bat
CLAUDE_CONFIG_DIR=C:\AI\ai-switcher\auth\claude-acc2
CODEX_HOME=C:\AI\ai-switcher\auth\codex-acc2
```

Если переменная не задана, CLI использует первый аккаунт:

| Инструмент | Account 1 | Account 2 |
| --- | --- | --- |
| Claude Code | стандартный профиль Claude | `C:\AI\ai-switcher\auth\claude-acc2` |
| Codex | стандартный профиль Codex | `C:\AI\ai-switcher\auth\codex-acc2` |

## Активный профиль switcher

Файл активного выбора:

```text
C:\AI\ai-switcher\active.json
```

Пример:

```json
{
  "claude": "acc2",
  "codex": "acc2",
  "updatedAt": "2026-05-27T08:03:42.226Z"
}
```

Если в HERMES выбран `Switcher active`, то:

- Claude берет `active.json -> claude`
- Codex берет `active.json -> codex`

Если файл не читается или там неизвестное значение, HERMES использует `acc1`.

## Как переключить активный профиль

Через PowerShell:

```powershell
cd C:\AI\ai-switcher
.\switch.ps1 claude 1
.\switch.ps1 claude 2
.\switch.ps1 codex 1
.\switch.ps1 codex 2
```

После переключения новые сессии HERMES с выбором `Switcher active` будут использовать обновленный аккаунт.

Уже запущенная сессия не меняет аккаунт на лету. Нужно создать новую сессию.

## Как запустить HERMES

Из проекта HERMES:

```powershell
cd C:\AI\hermes-ide
npm run tauri dev
```

Dev-сервер HERMES привязан к:

```text
http://127.0.0.1:1420/
```

На этой машине `localhost:1420` может не отвечать из-за IPv6/IPv4 loopback, поэтому для браузера используй `127.0.0.1`.

## Как создать сессию с нужным аккаунтом

1. Открыть HERMES.
2. Создать `New session`.
3. Выбрать режим:
   - `Chat with Claude` для agent-mode Claude.
   - `Terminal` для Claude/Codex CLI.
4. Для Claude или Codex выбрать `Account`:
   - `Switcher active`
   - `Account 1`
   - `Account 2`
5. Создать сессию.

## Важные ограничения

- HERMES выбирает аккаунт только при старте процесса `claude` или `codex`.
- Смена `active.json` не переключает уже работающую сессию.
- Для Codex failover в `profiles.json` сейчас отключен (`failoverEnabled: false`), HERMES его не включает автоматически.
- SSH-сессии не используют локальные профили `ai-switcher`, потому что CLI запускается на удаленной машине.

## Проверка

Проверить активный профиль:

```powershell
Get-Content C:\AI\ai-switcher\active.json
```

Проверить второй Codex-профиль вручную:

```powershell
set CODEX_HOME=C:\AI\ai-switcher\auth\codex-acc2
codex
```

Проверить второй Claude-профиль вручную:

```powershell
set CLAUDE_CONFIG_DIR=C:\AI\ai-switcher\auth\claude-acc2
claude
```
