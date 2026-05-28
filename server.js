const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const store = require("./lib/store");
const subtasks = require("./lib/subtasks");
const knowledge = require("./lib/knowledge");
const prompt = require("./lib/prompt");
const cli = require("./lib/cli");

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
  settings: {
    language: "ru",
    codexModel: "",
    codexEffort: "auto",
    claudeModel: "",
    claudeEffort: "auto",
    moderator: "codex",
    allowFilesystemScan: false,
  },
};

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

function publicState() {
  if (!state.run) {
    return {
      activeRunId: null,
      busy: state.busy,
      status: state.status,
      run: null,
      runs: listRuns().map((r) => ({ id: r.id, topic: r.topic, createdAt: r.createdAt, rounds: r.rounds })),
      settings: state.settings,
      workdir: WORKDIR,
      port: PORT,
      cli: { codex: cli.describeCodex(), claude: cli.describeClaude() },
    };
  }
  const dir = runDir(state.run.id);
  const allSubtasks = subtasks.loadAll(dir);
  const active = allSubtasks.find((item) => item.status === "open") || null;
  const messages = store.readJsonl(transcriptPath(state.run.id));
  return {
    activeRunId: state.run.id,
    busy: state.busy,
    status: state.status,
    run: {
      ...state.run,
      activeSubtask: active,
      subtasks: allSubtasks,
      knowledge: knowledge.load(dir),
      messages,
    },
    runs: listRuns().map((r) => ({ id: r.id, topic: r.topic, createdAt: r.createdAt, rounds: r.rounds })),
    settings: state.settings,
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

    const allowScan = Boolean(state.run.settings?.allowFilesystemScan ?? state.settings.allowFilesystemScan);
    const promptCommon = {
      language,
      subtask: active,
      kbSnapshot,
      recentTurns: recent,
      guidance,
      round,
      allowFilesystemScan: allowScan,
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
      text: `Раунд ${round} (subtask ${active.id}): запуск Codex и Claude параллельно. Codex prompt ${codexPrompt.length} chars, Claude prompt ${claudePrompt.length} chars.`,
      subtaskId: active.id,
      round,
    });

    const stamp = `R${round}-${active.id}`;
    const [codexResult, claudeResult] = await Promise.all([
      cli.runCodex(codexPrompt, {
        workdir: WORKDIR,
        model: state.run.settings.codexModel,
        effort: state.run.settings.codexEffort,
        outFile: path.join(dir, `${stamp}-codex.txt`),
        logFile: path.join(dir, `${stamp}-codex.log`),
        isolated: !allowScan,
      }),
      cli.runClaude(claudePrompt, {
        workdir: WORKDIR,
        model: state.run.settings.claudeModel,
        effort: state.run.settings.claudeEffort,
        logFile: path.join(dir, `${stamp}-claude.log`),
        isolated: !allowScan,
      }),
    ]);

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

    for (const patch of [...codexTail.kbPatches, ...claudeTail.kbPatches]) {
      try {
        knowledge.addItem(dir, patch.section, patch.item);
      } catch {}
    }

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
  } finally {
    state.busy = false;
    state.status = "idle";
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
  res.writeHead(200, { "content-type": types[ext] || "text/plain; charset=utf-8" });
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
      const body = await readBody(req);
      runRound({ guidance: body.guidance || "" }).catch((error) => {
        addMessage({ role: "system", name: "Council Room", kind: "error", text: `Round failed: ${error.message}` });
      });
      return sendJson(res, 202, { accepted: true });
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

const server = http.createServer(router);
server.listen(PORT, () => {
  console.log(`Council Room v2 listening on http://localhost:${PORT}`);
  console.log(`Workdir: ${WORKDIR}`);
  console.log(`Codex: ${cli.describeCodex()}`);
  console.log(`Claude: ${cli.describeClaude()}`);
});
