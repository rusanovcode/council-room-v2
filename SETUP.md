# Setup & Authentication

**[English](#english) · [Русский](#русский)**

> Council Room v2 does not ship or store anyone's credentials. Each user signs in
> with **their own** ChatGPT (Codex) and Anthropic (Claude) account via the
> official CLIs. Auth files live only on your machine and are gitignored.

---

## English

### 1. Prerequisites

- **Node.js** 18+ — <https://nodejs.org>
- The two agent CLIs (install globally):

```bash
npm install -g @openai/codex          # Codex (signs in with a ChatGPT account)
npm install -g @anthropic-ai/claude-code   # Claude Code
```

(The app also picks them up from a local `node_modules/` if you install them in the project instead. Override the path with `CODEX_CMD` / `CLAUDE_CMD`.)

### 2. Get & connect your OAuth (you don't copy a token manually)

You don't fetch a token by hand — each CLI runs the **OAuth flow in your browser**
when you log in, and stores the result locally:

**Codex / ChatGPT:**
```bash
codex login
```
A browser opens → sign in with your ChatGPT account → done. Token is saved to
`~/.codex/auth.json` (Windows: `%USERPROFILE%\.codex\auth.json`).

**Claude:**
```bash
claude            # then type:  /login
```
A browser opens → sign in with your Anthropic account → done. Credentials are
saved to `~/.claude/.credentials.json`.

> You can also trigger these logins from inside the app: click an account button
> (e.g. **Codex 1** / **Claude 1**) — it opens a terminal that runs the same
> login command in the right environment.

### 3. Run

```bash
node server.js          # or: npm start  — opens http://localhost:8788
```

Pick model and reasoning effort per agent in **Settings**. That's it — the app
sends prompts to `codex`/`claude`, which use your account's OAuth.

### 4. Security notes

- **Never commit auth files.** `~/.codex`, `~/.claude` and the project's `rooms/`
  are outside the repo / gitignored. Don't add them.
- These CLIs use your **personal subscription** via official OAuth. This is meant
  for **local, personal** use. For a **public/shared** deployment, prefer
  **API-key** providers instead of subscription CLIs (an OpenAI-compatible API
  adapter is planned — see [`ROADMAP.md`](ROADMAP.md)).
- The optional multi-account "switch module" requires a separate local tool
  (ai-switcher) and is not included here; without it the app runs in standard
  single-account mode.

---

## Русский

### 1. Требования

- **Node.js** 18+ — <https://nodejs.org>
- Два CLI-агента (установить глобально):

```bash
npm install -g @openai/codex          # Codex (вход через аккаунт ChatGPT)
npm install -g @anthropic-ai/claude-code   # Claude Code
```

(Приложение также подхватит их из локального `node_modules/`, если установить в проект. Путь можно переопределить через `CODEX_CMD` / `CLAUDE_CMD`.)

### 2. Получить и подключить свой OAuth (токен руками копировать НЕ нужно)

Ты не достаёшь токен вручную — каждый CLI сам проводит **OAuth-вход через браузер**
при логине и сохраняет результат локально:

**Codex / ChatGPT:**
```bash
codex login
```
Откроется браузер → войди в свой аккаунт ChatGPT → готово. Токен сохранится в
`~/.codex/auth.json` (Windows: `%USERPROFILE%\.codex\auth.json`).

**Claude:**
```bash
claude            # затем введи:  /login
```
Откроется браузер → войди в свой аккаунт Anthropic → готово. Креды сохранятся в
`~/.claude/.credentials.json`.

> Эти же логины можно запустить **из приложения**: нажми кнопку аккаунта
> (например **Codex 1** / **Claude 1**) — откроется терминал с нужной командой
> входа в правильном окружении.

### 3. Запуск

```bash
node server.js          # или: npm start  — откроется http://localhost:8788
```

Модель и reasoning-effort для каждого агента выбираются в **Настройках**. Всё —
приложение шлёт промты в `codex`/`claude`, а те используют OAuth твоего аккаунта.

### 4. Замечания по безопасности

- **Никогда не коммить auth-файлы.** `~/.codex`, `~/.claude` и папка проекта
  `rooms/` — вне репозитория / в `.gitignore`. Не добавляй их.
- Эти CLI используют твою **личную подписку** через официальный OAuth. Это —
  для **локального личного** использования. Для **публичного/общего** развёртывания
  лучше брать провайдеров **по API-ключу**, а не подписочные CLI (планируется
  универсальный OpenAI-совместимый адаптер — см. [`ROADMAP.md`](ROADMAP.md)).
- Опциональный мульти-аккаунт «switch module» требует отдельного локального
  инструмента (ai-switcher) и сюда не входит; без него приложение работает в
  обычном одно-аккаунтном режиме.
