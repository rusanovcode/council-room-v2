---
name: feedback_exit_command
description: При команде "выход" выполнить сохранение: коммит кода без секретов, остановка gateway
metadata:
  type: feedback
---

При команде **"выход"** выполнить следующее:

1. **Проверить незакоммиченные изменения** (`git status`)
2. **Коммитить только:** `server.js`, `bin\*.ps1`, `profiles.json`, `active.json`, `projects.policy.json`, отчёты `*.md`
   ```powershell
   git add server.js bin\*.ps1 profiles.json active.json projects.policy.json PHASE-1A-REPORT.md
   git commit -m "feat: accept phase 1A operator gateway scaffold"
   ```
3. **НЕ добавлять в git:** `auth\`, `tokens.json`, `locks\`, `handoff\`, `audit.ndjson`, `limits.ndjson`, `.credentials.json`, `auth.json`, любые session/cookie/token-файлы
4. **Если секреты уже трекаются** — остановиться и проверить `.gitignore` перед коммитом
5. **Если gateway запущен** — показать процесс и предложить остановить:
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*node*" }
   ```
6. **Сохранить memory** (этот файл)

**Why:** пользователь хочет чистое завершение сессии — без секретов в git, с фиксацией кода и отчёта.

**How to apply:** при любом сообщении "выход", "exit", "закрой сессию", "заверши работу".
