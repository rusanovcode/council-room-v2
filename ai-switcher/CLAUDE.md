# CLAUDE.md — ai-switcher

## Проект
Локальный operator-gateway для запуска Claude Code / Codex через изолированные профили.

## Ключевые файлы
- `server.js` — HTTP gateway (127.0.0.1:7700)
- `profiles.json` — профили acc1/acc2, `codex.failoverEnabled=false`
- `active.json` — текущий активный профиль (atomic write)
- `projects.policy.json` — политики, читается без кэша на каждый `/run`
- `bin/*.ps1` — CLI обёртки

## Правила
- Сервер слушает **только** 127.0.0.1 — никакого LAN bind
- Auth-файлы в `auth/` не трогать и не коммитить (gitignored)
- `codex.failoverEnabled` остаётся `false` до Phase 1B
- Phase 1B разблокируется только при реальном `rate_limit_reached_type != null` от Codex
- Atomic write через tmp→fsync→rename для `active.json`, `tokens.json`, `projects.policy.json`
- Lock timeout 30s, stale lock cleanup если pid мёртв + lock старше 10 минут

## Env vars для профилей
- Claude acc2: `CLAUDE_CONFIG_DIR=C:\AI\ai-switcher\auth\claude-acc2`
- Codex acc2: `CODEX_HOME=C:\AI\ai-switcher\auth\codex-acc2`

## Тестирование
Тестовый промт: `1+1=` — минимальный ответ, минимальные токены.

## Не делать
- Не патчить Claude CLI / Codex CLI
- Не копировать auth/cookies/session-токены
- Не автоматизировать login
- Не трогать Council Room, council2.bat/council2.ps1
