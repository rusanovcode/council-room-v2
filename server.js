const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const store = require("./lib/store");
const subtasks = require("./lib/subtasks");
const knowledge = require("./lib/knowledge");
const questions = require("./lib/questions");
const prompt = require("./lib/prompt");
const cli = require("./lib/cli");
const switcher = require("./lib/switcher");
const stats = require("./lib/stats");

const ROOT = __dirname;
const ROOMS_DIR = path.join(ROOT, "rooms");
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.COUNCIL_ROOM_V2_PORT || 8788);
const WORKDIR = process.env.COUNCIL_ROOM_V2_WORKDIR || path.dirname(ROOT);

fs.mkdirSync(ROOMS_DIR, { recursive: true });

let state = {
  activeRunId: null,
  busy: false,
  status: "idle",
  run: null,
  autopilot: { running: false, subtaskId: null, reason: "", startedAt: null, round: 0 },
  settings: {
    language: "ru",
    codexModel: "",
    codexEffort: "auto",
    claudeModel: "",
    claudeEffort: "auto",
    moderator: "codex",
    allowFilesystemScan: false,
    strictScope: false,
    codexMode: "auto",
    codexAccount: 1,
    claudeMode: "auto",
    claudeAccount: 1,
    subscriptions: {}, // { "claude:acc1": { start, end } } — manual, no API source
  },
};

// Asset cache-bust id — changes every server start, stamped into served HTML.
const BUILD_ID = Date.now();

const ROUND_BUDGET = { LIGHT: 3, STANDARD: 6, STRICT: 10, CRITICAL: 12 };

// The FINAL VERIFICATION pass (the gate that closes a subtask) is always run by
// the strongest available agents at max reasoning, regardless of the cheaper
// models used for regular debate rounds.
const VERIFY_AGENTS = { codexModel: "gpt-5.5", codexEffort: "xhigh", claudeModel: "opus", claudeEffort: "max" };

// Shared across manual round and autopilot so the Stop button can cancel either.
let activeAbort = null;
let activeChildren = new Set();

// Cached switch-module status (gateway is async, publicState is sync). Refreshed
// on a timer + after switcher actions; falls back to file detection if gateway down.
let switcherStatus = switcher.detect();
let statsCache = {};
async function refreshSwitcher() {
  try { switcherStatus = await switcher.status(); } catch { switcherStatus = switcher.detect(); }
}

const sseClients = new Set();

function runDir(runId) {
  return path.join(ROOMS_DIR, store.safeId(runId));
}

function statePath(runId) {
  return path.join(runDir(runId), "state.json");
}

function transcriptPath(runId) {
  return path.join(runDir(runId), "transcript.jsonl");
}

function defaultRun(topic) {
  return {
    id: store.makeRunId(topic),
    topic: String(topic || "Untitled").slice(0, 200),
    createdAt: store.now(),
    rounds: 0,
    archived: false,
    settings: { ...state.settings },
  };
}

function loadRun(runId) {
  const data = store.readJson(statePath(runId));
  if (!data) throw new Error("Conversation not found");
  return data;
}

function saveRun(run) {
  store.writeJson(statePath(run.id), run);
}

function listRuns() {
  if (!fs.existsSync(ROOMS_DIR)) return [];
  return fs
    .readdirSync(ROOMS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => store.readJson(path.join(ROOMS_DIR, entry.name, "state.json")))
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// One-time, idempotent: move legacy free-text open_questions from knowledge.md
// into the per-subtask questions store (deduped), then clear the KB section.
function ensureQuestionsMigrated(dir, subtaskId) {
  if (!subtaskId) return;
  const kb = knowledge.load(dir);
  const legacy = kb.sections.open_questions || [];
  if (!legacy.length) return;
  questions.migrateStrings(dir, subtaskId, legacy, 0);
  knowledge.replaceSection(dir, "open_questions", []);
}

function publicState() {
  if (!state.run) {
    return {
      activeRunId: null,
      busy: state.busy,
      status: state.status,
      run: null,
      autopilot: state.autopilot,
      runs: listRuns().map((r) => ({ id: r.id, topic: r.topic, createdAt: r.createdAt, rounds: r.rounds, archived: Boolean(r.archived) })),
      settings: state.settings,
      switcher: switcherStatus,
      workdir: WORKDIR,
      port: PORT,
      cli: { codex: cli.describeCodex(), claude: cli.describeClaude() },
    };
  }
  const dir = runDir(state.run.id);
  const allSubtasks = subtasks.loadAll(dir);
  const active = allSubtasks.find((item) => item.status === "open") || null;
  if (active) ensureQuestionsMigrated(dir, active.id);
  const messages = store.readJsonl(transcriptPath(state.run.id));
  const activeQuestions = active ? questions.forSubtask(dir, active.id) : [];
  return {
    activeRunId: state.run.id,
    busy: state.busy,
    status: state.status,
    run: {
      ...state.run,
      activeSubtask: active,
      subtasks: allSubtasks,
      knowledge: knowledge.load(dir),
      questions: activeQuestions,
      messages,
    },
    autopilot: state.autopilot,
    runs: listRuns().map((r) => ({ id: r.id, topic: r.topic, createdAt: r.createdAt, rounds: r.rounds, archived: Boolean(r.archived) })),
    settings: state.settings,
    switcher: switcherStatus,
    workdir: WORKDIR,
    port: PORT,
    cli: { codex: cli.describeCodex(), claude: cli.describeClaude() },
  };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

// Live agent stdout/stderr → named "stream" SSE event (separate channel from state).
function broadcastStream(agent, chunk, { subtaskId = "", round = 0, reset = false } = {}) {
  const data = JSON.stringify({ agent, runId: state.run?.id || null, subtaskId, round, chunk: String(chunk || ""), reset });
  const payload = `event: stream\ndata: ${data}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

function addMessage({ role, name, kind = "", text, subtaskId = "", round = 0 }) {
  if (!state.run) return null;
  const item = {
    id: store.makeId("msg"),
    at: store.now(),
    role,
    name,
    kind,
    subtaskId,
    round,
    text: String(text || "").trim(),
  };
  store.appendJsonl(transcriptPath(state.run.id), item);
  broadcast();
  return item;
}

function recentTurnsForSubtask(runId, subtaskId, limit = 2) {
  if (!subtaskId) return [];
  const messages = store.readJsonl(transcriptPath(runId));
  return messages
    .filter((m) => m.subtaskId === subtaskId && (m.role === "agent" || m.role === "user"))
    .slice(-limit * 2);
}

async function runRound({ guidance = "" } = {}) {
  if (!state.run) throw new Error("No active run");
  if (state.busy) throw new Error("Busy");
  const dir = runDir(state.run.id);
  const active = subtasks.activeSubtask(dir);
  if (!active) throw new Error("No active subtask — открой подзадачу перед раундом");

  const ac = new AbortController();
  activeAbort = ac;
  state.busy = true;
  state.status = "running";
  broadcast();
  try {
    const round = active.rounds + 1;
    if (guidance) {
      addMessage({ role: "user", name: "User", kind: "guidance", text: guidance, subtaskId: active.id, round });
    }
    const recent = recentTurnsForSubtask(state.run.id, active.id, 2);
    const kbSnapshot = knowledge.snapshotForPrompt(dir);
    const language = state.run.settings.language || "ru";

    // Question lifecycle: feed only OPEN questions; if none open but some resolved
    // remain, this round is the FINAL VERIFICATION pass over the resolved batch.
    ensureQuestionsMigrated(dir, active.id);
    const openQs = questions.openForSubtask(dir, active.id);
    const criticalOpen = openQs.filter((q) => q.priority === "critical");
    const minorOpen = openQs.filter((q) => q.priority === "minor");
    const resolvedQs = questions.forSubtask(dir, active.id).filter((q) => q.status === "resolved");
    // Gate on CRITICAL only: verification starts when no critical question is open.
    // Open minor questions are deferred (don't block) but still surfaced.
    const verifyMode = criticalOpen.length === 0 && resolvedQs.length > 0;
    const verify = verifyMode
      ? { batch: resolvedQs.map((q) => ({ id: q.id, text: q.text, answer: q.answer })) }
      : null;

    // Final verification → strongest agents at max reasoning; otherwise per-chat settings.
    const codexModel = verifyMode ? VERIFY_AGENTS.codexModel : state.run.settings.codexModel;
    const codexEffort = verifyMode ? VERIFY_AGENTS.codexEffort : state.run.settings.codexEffort;
    const claudeModel = verifyMode ? VERIFY_AGENTS.claudeModel : state.run.settings.claudeModel;
    const claudeEffort = verifyMode ? VERIFY_AGENTS.claudeEffort : state.run.settings.claudeEffort;

    const allowScan = Boolean(state.run.settings?.allowFilesystemScan ?? state.settings.allowFilesystemScan);
    const strictScope = Boolean(state.run.settings?.strictScope ?? state.settings.strictScope);
    const promptCommon = {
      language,
      subtask: active,
      kbSnapshot,
      recentTurns: recent,
      guidance,
      round,
      allowFilesystemScan: allowScan,
      strictScope,
      openQuestions: openQs.map((q) => ({ id: q.id, text: q.text, priority: q.priority })),
      verify,
      deferredMinors: minorOpen.map((q) => ({ id: q.id, text: q.text })),
    };
    const codexPrompt = prompt.buildDebatePrompt({
      ...promptCommon,
      agentName: "Codex",
      otherAgentName: "Claude Code",
    });
    const claudePrompt = prompt.buildDebatePrompt({
      ...promptCommon,
      agentName: "Claude Code",
      otherAgentName: "Codex",
    });

    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Раунд ${round} (subtask ${active.id})${verifyMode ? " — ФИНАЛЬНАЯ ПРОВЕРКА (максимальные агенты: codex " + codexModel + "/" + codexEffort + ", claude " + claudeModel + "/" + claudeEffort + ")" : ""}: запуск Codex и Claude параллельно. Codex prompt ${codexPrompt.length} chars, Claude prompt ${claudePrompt.length} chars.`,
      subtaskId: active.id,
      round,
    });

    // Clear pinned terminals for this round on the client.
    broadcastStream("codex", "", { subtaskId: active.id, round, reset: true });
    broadcastStream("claude", "", { subtaskId: active.id, round, reset: true });

    // Account selection (multi-account via the optional switch module).
    const sw = switcher.detect();
    const codexMode = state.run.settings.codexMode || "auto";
    const claudeMode = state.run.settings.claudeMode || "auto";
    const pickAccount = (tool, acc) => (Number(acc) === 2 && switcher.accountAvailable(tool, 2)) ? 2 : 1;
    let codexAccount = pickAccount("codex", state.run.settings.codexAccount);
    let claudeAccount = pickAccount("claude", state.run.settings.claudeAccount);

    const stamp = `R${round}-${active.id}`;
    activeChildren = new Set();
    const trackChild = (child) => {
      activeChildren.add(child);
      child.on("close", () => activeChildren.delete(child));
    };
    const runCodexOn = (account) => cli.runCodex(codexPrompt, {
      workdir: WORKDIR,
      model: codexModel,
      effort: codexEffort,
      outFile: path.join(dir, `${stamp}-codex.txt`),
      logFile: path.join(dir, `${stamp}-codex.log`),
      isolated: !allowScan,
      signal: ac.signal,
      onStream: (chunk) => broadcastStream("codex", chunk, { subtaskId: active.id, round }),
      onChild: trackChild,
      accountEnv: switcher.envForAccount("codex", account),
    });
    const runClaudeOn = (account) => cli.runClaude(claudePrompt, {
      workdir: WORKDIR,
      model: claudeModel,
      effort: claudeEffort,
      logFile: path.join(dir, `${stamp}-claude.log`),
      isolated: !allowScan,
      signal: ac.signal,
      onStream: (chunk) => broadcastStream("claude", chunk, { subtaskId: active.id, round }),
      onChild: trackChild,
      accountEnv: switcher.envForAccount("claude", account),
    });

    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Аккаунты раунда: Codex акк${codexAccount} (${codexMode}), Claude акк${claudeAccount} (${claudeMode}).${sw.connected ? "" : " Модуль свитч не подключён — стандартный режим."}`,
      subtaskId: active.id,
      round,
    });

    let [codexResult, claudeResult] = await Promise.all([runCodexOn(codexAccount), runClaudeOn(claudeAccount)]);

    // Auto-failover: a failed agent in "auto" mode retries once on the other account.
    if (!ac.signal.aborted && !codexResult.aborted && !codexResult.ok && codexMode === "auto" && sw.connected) {
      const other = codexAccount === 1 ? 2 : 1;
      if (switcher.accountAvailable("codex", other)) {
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Codex: ошибка/лимит на акк${codexAccount} → переключаюсь на акк${other} (auto-failover).`, subtaskId: active.id, round });
        broadcastStream("codex", "", { subtaskId: active.id, round, reset: true });
        codexResult = await runCodexOn(other);
        codexAccount = other;
      }
    }
    if (!ac.signal.aborted && !claudeResult.aborted && !claudeResult.ok && claudeMode === "auto" && sw.connected) {
      const other = claudeAccount === 1 ? 2 : 1;
      if (switcher.accountAvailable("claude", other)) {
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Claude: ошибка/лимит на акк${claudeAccount} → переключаюсь на акк${other} (auto-failover).`, subtaskId: active.id, round });
        broadcastStream("claude", "", { subtaskId: active.id, round, reset: true });
        claudeResult = await runClaudeOn(other);
        claudeAccount = other;
      }
    }

    if (ac.signal.aborted) {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Раунд ${round} (subtask ${active.id}) прерван пользователем — частичный результат отброшен (раунд не засчитан).`,
        subtaskId: active.id,
        round,
      });
      return { aborted: true };
    }

    const codexTail = prompt.parseAgentTail(codexResult.text);
    const claudeTail = prompt.parseAgentTail(claudeResult.text);

    addMessage({
      role: "agent",
      name: "Codex",
      kind: "debate",
      text: codexResult.text,
      subtaskId: active.id,
      round,
    });
    addMessage({
      role: "agent",
      name: "Claude Code",
      kind: "debate",
      text: claudeResult.text,
      subtaskId: active.id,
      round,
    });

    // Route KB-patches: open_questions go to the per-subtask questions store
    // (deduped), everything else into the durable Knowledge Base.
    for (const [agent, tail] of [["codex", codexTail], ["claude", claudeTail]]) {
      for (const patch of tail.kbPatches) {
        if (patch.section === "open_questions") {
          questions.addQuestion(dir, active.id, patch.item, round);
        } else {
          try { knowledge.addItem(dir, patch.section, patch.item); } catch {}
        }
      }
      // Record per-agent resolutions of existing questions.
      for (const r of tail.resolved) questions.recordResolve(dir, r.id, agent, r.answer);
      // Apply priority changes; warn when a deferred question is promoted to critical.
      for (const pr of tail.priority || []) {
        const before = questions.forSubtask(dir, active.id).find((x) => x.id === pr.id);
        questions.setPriority(dir, pr.id, pr.priority);
        if (before && before.priority === "minor" && pr.priority === "critical" && before.status === "open") {
          addMessage({ role: "system", name: "Council Room", kind: "process", text: `⚠️ ${agent} повысил вопрос ${pr.id} до CRITICAL — теперь он блокирует исполнение.`, subtaskId: active.id, round });
        }
      }
    }

    // Final-verification pass: reopen anything either agent flagged; if both
    // confirm with no reopens, mark the whole batch verified → debate complete.
    let verifyPassed = false;
    if (verifyMode) {
      const reopen = new Set([...(codexTail.verify?.reopen || []), ...(claudeTail.verify?.reopen || [])]);
      for (const id of reopen) questions.reopen(dir, id);
      if (reopen.size) {
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Финальная проверка: возвращены в работу — ${[...reopen].join(", ")}.`, subtaskId: active.id, round });
      } else if (codexTail.verify?.ok && claudeTail.verify?.ok) {
        questions.markSubtaskVerified(dir, active.id);
        verifyPassed = true;
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Финальная проверка пройдена обоими — критичные вопросы verified, подзадача готова к закрытию.`, subtaskId: active.id, round });
        const stillMinor = questions.openForSubtask(dir, active.id).filter((q) => q.priority === "minor");
        if (stillMinor.length) {
          addMessage({ role: "system", name: "Council Room", kind: "process", text: `⚠️ Отложено ${stillMinor.length} второстепенных вопрос(ов) — догнать позже: ${stillMinor.map((q) => q.id).join(", ")}. Если какой-то станет блокирующим — повысь до critical.`, subtaskId: active.id, round });
        }
      }
    }

    const qStats = questions.forSubtask(dir, active.id);
    const openNow = qStats.filter((q) => q.status === "open");
    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Вопросы: открыто ${openNow.length} (critical ${openNow.filter((q) => q.priority === "critical").length} / minor ${openNow.filter((q) => q.priority === "minor").length}), решено ${qStats.filter((q) => q.status === "resolved").length}, проверено ${qStats.filter((q) => q.status === "verified").length}.`,
      subtaskId: active.id,
      round,
    });

    subtasks.incrementRounds(dir, active.id);

    const codexStale = !codexTail.newFacts.length && !codexTail.newRisks.length && !codexTail.newAlternatives.length;
    const claudeStale = !claudeTail.newFacts.length && !claudeTail.newRisks.length && !claudeTail.newAlternatives.length;
    if (codexStale && claudeStale) {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Раунд ${round}: stale (нет новых facts/risks/alternatives ни у одного агента). Рекомендуется закрыть подзадачу или ввести guidance.`,
        subtaskId: active.id,
        round,
      });
    }
    if (codexTail.status === "resolve" && claudeTail.status === "resolve") {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Раунд ${round}: оба агента сообщили Status: resolve. Можно закрывать подзадачу.`,
        subtaskId: active.id,
        round,
      });
    }
    const debateComplete = (codexTail.status === "resolve" && claudeTail.status === "resolve") || verifyPassed;
    if (codexTail.status === "block" || claudeTail.status === "block") {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Раунд ${round}: один из агентов сообщил Status: block — требуется решение пользователя.`,
        subtaskId: active.id,
        round,
      });
    }

    state.run.rounds += 1;
    saveRun(state.run);

    return {
      aborted: false,
      round,
      subtaskId: active.id,
      stale: codexStale && claudeStale,
      resolve: debateComplete,
      block: codexTail.status === "block" || claudeTail.status === "block",
    };
  } finally {
    activeAbort = null;
    activeChildren.clear();
    state.busy = false;
    state.status = "idle";
    broadcast();
  }
}

function stopAutopilot(reason) {
  state.autopilot.running = false;
  state.autopilot.reason = reason;
  if (state.run) {
    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Autopilot stopped: ${reason}.`,
      subtaskId: state.autopilot.subtaskId || "",
    });
  }
}

// Local summary on auto-resolve — no extra agent call (token economy).
function buildLocalSummary(dir, subtask) {
  const kb = knowledge.load(dir);
  const decisions = (kb.sections.decisions || []).slice(0, 5);
  const lines = [`Goal: ${subtask.title}`];
  if (decisions.length) lines.push(`Decisions: ${decisions.join("; ")}`);
  lines.push("Closed by autopilot (DEBATE_COMPLETE: both agents Status: resolve).");
  return lines.join("\n");
}

async function runAutopilot({ autoResolve = false } = {}) {
  if (!state.run) throw new Error("No active run");
  if (state.busy) throw new Error("Busy");
  if (state.autopilot.running) throw new Error("Autopilot already running");
  const dir = runDir(state.run.id);
  const active = subtasks.activeSubtask(dir);
  if (!active) throw new Error("No active subtask — открой подзадачу перед автопилотом");

  state.autopilot = { running: true, subtaskId: active.id, reason: "", startedAt: store.now(), round: active.rounds };
  addMessage({
    role: "system",
    name: "Council Room",
    kind: "process",
    text: `Autopilot запущен по подзадаче ${active.id} (mode ${active.mode}, budget ${ROUND_BUDGET[active.mode] || 6} раундов, авто-закрытие ${autoResolve ? "ON" : "OFF"}).`,
    subtaskId: active.id,
  });
  broadcast();

  let staleStreak = 0;
  try {
    while (state.autopilot.running) {
      const cur = subtasks.activeSubtask(dir);
      if (!cur || cur.id !== active.id) { stopAutopilot("subtask-changed"); break; }
      const budget = ROUND_BUDGET[cur.mode] || 6;
      if (cur.rounds >= budget) { stopAutopilot("round-budget"); break; }

      let r;
      try {
        r = await runRound({});
      } catch (error) {
        stopAutopilot(`error: ${error.message}`);
        break;
      }
      if (!state.autopilot.running) break; // stop pressed during the round
      if (r.aborted) { stopAutopilot("user-stop"); break; }

      state.autopilot.round = r.round;

      if (r.block) { stopAutopilot("block"); break; }
      if (r.resolve) {
        if (autoResolve) {
          const summary = buildLocalSummary(dir, cur);
          subtasks.resolveSubtask(dir, cur.id, summary);
          addMessage({
            role: "system",
            name: "Council Room",
            kind: "subtask-resolve",
            text: `Подзадача ${cur.id} авто-закрыта автопилотом. Резюме: ${summary}`,
            subtaskId: cur.id,
          });
          stopAutopilot("debate-complete-resolved");
        } else {
          stopAutopilot("debate-complete");
        }
        break;
      }
      if (r.stale) {
        staleStreak += 1;
        if (staleStreak >= 2) { stopAutopilot("stale-x2"); break; }
      } else {
        staleStreak = 0;
      }
    }
  } finally {
    state.autopilot.running = false;
    broadcast();
  }
}

// ---- HTTP -----------------------------------------------------------------

function sendJson(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const parsed = url.parse(req.url);
  let pathname = parsed.pathname || "/";
  if (pathname === "/") pathname = "/index.html";
  const file = path.join(PUBLIC_DIR, pathname.replace(/^\//, ""));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
  // Local dev tool — never cache, so frontend edits show up on a normal reload.
  res.writeHead(200, { "content-type": types[ext] || "text/plain; charset=utf-8", "cache-control": "no-store" });
  // For HTML, stamp asset URLs with the server build id so a restart always busts
  // any stale cached app.js/styles.css (the recurring "old code" trap).
  if (ext === ".html") {
    const html = fs.readFileSync(file, "utf8").replace(/__V__/g, String(BUILD_ID));
    res.end(html);
    return;
  }
  fs.createReadStream(file).pipe(res);
}

async function router(req, res) {
  const parsed = url.parse(req.url, true);
  const method = req.method.toUpperCase();
  const pathname = parsed.pathname;

  try {
    if (method === "GET" && pathname === "/api/state") return sendJson(res, 200, publicState());

    if (method === "GET" && pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify(publicState())}\n\n`);
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    if (method === "POST" && pathname === "/api/runs") {
      const body = await readBody(req);
      const run = defaultRun(body.topic);
      saveRun(run);
      state.run = run;
      state.activeRunId = run.id;
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/runs/switch") {
      const body = await readBody(req);
      const run = loadRun(body.runId);
      state.run = run;
      state.activeRunId = run.id;
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/runs/delete") {
      const body = await readBody(req);
      const dir = runDir(body.runId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      if (state.run && state.run.id === body.runId) {
        state.run = null;
        state.activeRunId = null;
      }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && (pathname === "/api/runs/archive" || pathname === "/api/runs/restore")) {
      const body = await readBody(req);
      const run = loadRun(body.runId);
      run.archived = pathname.endsWith("/archive");
      saveRun(run);
      // Archiving the active chat clears the view; restore just flips the flag.
      if (run.archived && state.run && state.run.id === run.id) {
        state.run = null;
        state.activeRunId = null;
      }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/open") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const subtask = subtasks.openSubtask(dir, { title: body.title || "Untitled", mode: body.mode || "STANDARD" });
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "subtask-open",
        text: `Открыта подзадача: ${subtask.title} (id ${subtask.id}, mode ${subtask.mode}).`,
        subtaskId: subtask.id,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/resolve") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const resolved = subtasks.resolveSubtask(dir, body.id, body.summary || "");
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "subtask-resolve",
        text: `Подзадача ${resolved.id} закрыта.${body.summary ? ` Резюме: ${body.summary}` : ""}`,
        subtaskId: resolved.id,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/freeze") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const frozen = subtasks.freezeSubtask(dir, body.id, body.reason || "");
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "subtask-freeze",
        text: `Подзадача ${frozen.id} заморожена. Причина: ${body.reason || "не указана"}.`,
        subtaskId: frozen.id,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/edit") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const edited = subtasks.editSubtask(dir, body.id, { title: body.title, mode: body.mode });
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "subtask-edit",
        text: `Подзадача ${edited.id} отредактирована: title="${edited.title}", mode=${edited.mode}.`,
        subtaskId: edited.id,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/delete") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      subtasks.deleteSubtask(dir, body.id);
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "subtask-delete",
        text: `Подзадача ${body.id} удалена (раундов не было).`,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && (pathname === "/api/subtasks/trash" || pathname === "/api/subtasks/archive" || pathname === "/api/subtasks/restore")) {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const bin = pathname.endsWith("/trash") ? "trash" : (pathname.endsWith("/archive") ? "archive" : "");
      const item = subtasks.setBin(dir, body.id, bin);
      const label = bin === "trash" ? "в корзину" : (bin === "archive" ? "в архив" : "восстановлена в стек");
      addMessage({ role: "system", name: "Council Room", kind: `subtask-${bin || "restore"}`, text: `Подзадача ${item.id} перемещена ${label}.`, subtaskId: item.id });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/trash/empty") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const dir = runDir(state.run.id);
      const { removed } = subtasks.emptyTrash(dir);
      addMessage({ role: "system", name: "Council Room", kind: "subtask-trash", text: `Корзина подзадач очищена (удалено: ${removed}).` });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/reopen") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const reopened = subtasks.reopenSubtask(dir, body.id);
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "subtask-reopen",
        text: `Подзадача ${reopened.id} переоткрыта.`,
        subtaskId: reopened.id,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/round") {
      if (state.autopilot.running) return sendJson(res, 409, { error: "Autopilot is running — stop it before a manual round" });
      const body = await readBody(req);
      runRound({ guidance: body.guidance || "" }).catch((error) => {
        addMessage({ role: "system", name: "Council Room", kind: "error", text: `Round failed: ${error.message}` });
      });
      return sendJson(res, 202, { accepted: true });
    }

    if (method === "POST" && pathname === "/api/autopilot/start") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      runAutopilot({ autoResolve: Boolean(body.autoResolve) }).catch((error) => {
        stopAutopilot(`error: ${error.message}`);
        broadcast();
      });
      return sendJson(res, 202, { accepted: true });
    }

    if (method === "POST" && pathname === "/api/autopilot/stop") {
      const wasRunning = state.autopilot.running;
      state.autopilot.running = false;
      if (wasRunning) {
        state.autopilot.reason = "user-stop";
        addMessage({ role: "system", name: "Council Room", kind: "process", text: "Autopilot stopped: user-stop.", subtaskId: state.autopilot.subtaskId || "" });
      }
      try { activeAbort?.abort(); } catch {}
      // Hard-kill the agent process trees — abort/SIGTERM alone leaves the cmd.exe-wrapped codex orphaned on Windows.
      for (const child of activeChildren) cli.killTree(child);
      activeChildren.clear();
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/kb/add") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      knowledge.addItem(dir, body.section, body.item);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/kb/remove") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      knowledge.removeItem(dir, body.section, body.item);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/questions/add") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const active = subtasks.activeSubtask(dir);
      if (!active) return sendJson(res, 400, { error: "No active subtask" });
      questions.addQuestion(dir, active.id, body.text || "", state.run.rounds || 0);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/questions/remove") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      questions.removeById(dir, body.id);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/questions/priority") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      questions.setPriority(dir, body.id, body.priority);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/switcher/login") {
      const body = await readBody(req);
      const tool = body.tool === "claude" ? "claude" : "codex";
      const account = Number(body.account) === 2 ? 2 : 1;
      const result = cli.spawnLogin(tool, switcher.envForAccount(tool, account));
      if (state.run) {
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Запущена авторизация: ${tool} аккаунт ${account}${result.ok ? " (окно терминала открыто)" : ` (ошибка: ${result.error})`}.` });
      }
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (method === "GET" && pathname === "/api/switcher/stats") {
      const period = ["today", "week", "all"].includes(parsed.query.period) ? parsed.query.period : "today";
      const key = `stats:${period}`;
      const now = Date.now();
      if (!statsCache[key] || now - statsCache[key].at > 60000) {
        const dirs = switcher.claudePaths();
        statsCache[key] = {
          at: now,
          data: {
            period,
            claude: {
              acc1: stats.accountStats(dirs.acc1, period),
              acc2: stats.accountStats(dirs.acc2, period),
            },
          },
        };
      }
      return sendJson(res, 200, statsCache[key].data);
    }

    if (method === "POST" && pathname === "/api/switcher/subscription") {
      const body = await readBody(req);
      if (!body.key) return sendJson(res, 400, { error: "key required" });
      const subs = { ...(state.settings.subscriptions || {}) };
      subs[body.key] = { start: String(body.start || ""), end: String(body.end || "") };
      state.settings.subscriptions = subs;
      if (state.run) { state.run.settings = { ...state.run.settings, subscriptions: subs }; saveRun(state.run); }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/switcher/refresh") {
      // Fire a tiny prompt per Claude account so its .usage-cache.json repopulates,
      // then re-poll the gateway. Codex has no usage source, so we skip it.
      (async () => {
        await Promise.all([1, 2].map((acc) =>
          cli.runClaude("What is 1+3? Reply with just the number.", {
            workdir: WORKDIR,
            isolated: true,
            accountEnv: switcher.envForAccount("claude", acc),
          }).catch(() => {})
        ));
        statsCache = {}; // force recompute after fresh requests
        await refreshSwitcher();
        broadcast();
      })();
      return sendJson(res, 202, { accepted: true });
    }

    if (method === "POST" && pathname === "/api/settings") {
      const body = await readBody(req);
      state.settings = { ...state.settings, ...body };
      if (state.run) {
        state.run.settings = { ...state.run.settings, ...body };
        saveRun(state.run);
      }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "GET") return serveStatic(req, res);
    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message });
  }
}

// Auto-select the most recently created chat on startup so a server restart
// doesn't land the user on an empty screen ("куда делись чаты?").
function selectLastRunOnStartup() {
  const runs = listRuns(); // sorted ascending by createdAt
  if (!runs.length) return;
  const last = runs[runs.length - 1];
  state.run = last;
  state.activeRunId = last.id;
}

selectLastRunOnStartup();

// Poll the switch-module gateway so the UI reflects profiles/active/tokens live.
refreshSwitcher().then(broadcast);
setInterval(() => { refreshSwitcher().then(broadcast); }, 15000).unref();

const server = http.createServer(router);
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`\n[Council Room v2] Порт ${PORT} уже занят — вероятно, запущен старый экземпляр.`);
    console.error(`Закрой его и перезапусти через "Council Room v2.bat" (он сам освобождает порт), либо: taskkill /F /PID <pid с netstat -ano | findstr :${PORT}>.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
server.listen(PORT, () => {
  console.log(`Council Room v2 listening on http://localhost:${PORT}`);
  console.log(`Workdir: ${WORKDIR}`);
  console.log(`Codex: ${cli.describeCodex()}`);
  console.log(`Claude: ${cli.describeClaude()}`);
  console.log(`Active chat: ${state.activeRunId || "(none)"}`);
});
