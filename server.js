// Load .env before any module reads process.env (timeouts, ports, API keys).
const env = require("./lib/env");
env.loadEnv(__dirname);

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");
const { execFile } = require("node:child_process");

const store = require("./lib/store");
const subtasks = require("./lib/subtasks");
const knowledge = require("./lib/knowledge");
const questions = require("./lib/questions");
const documents = require("./lib/documents");
const prompt = require("./lib/prompt");
const cli = require("./lib/cli");
const switcher = require("./lib/switcher");
const stats = require("./lib/stats");
const profiles = require("./lib/profiles");
const roles = require("./lib/roles");
const providers = require("./lib/providers");
const usage = require("./lib/usage");
const validatedStore = require("./lib/validated");
const domains = require("./lib/domains");

const ROOT = __dirname;
const ROOMS_DIR = path.join(ROOT, "rooms");
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = Number(process.env.COUNCIL_ROOM_V2_PORT || 8788);
const WORKDIR = process.env.COUNCIL_ROOM_V2_WORKDIR || path.dirname(ROOT);

fs.mkdirSync(ROOMS_DIR, { recursive: true });

const GLOBAL_SETTINGS_PATH = path.join(ROOMS_DIR, "global-settings.json");

let state = {
  activeRunId: null,
  busy: false,
  status: "idle",
  run: null,
  autopilot: { running: false, subtaskId: null, reason: "", startedAt: null, round: 0 },
  updateStatus: { checked: false, updateAvailable: false },
  settings: {
    language: "ru",
    codexModel: "",
    codexEffort: "auto",
    claudeModel: "",
    claudeEffort: "auto",
    moderator: "codex",
    allowFilesystemScan: false,
    // Strict scope ON by default (Phase 6b): everything outside "Files in Scope"
    // is off-limits. On a fresh chat files_in_scope is empty, so this just tells
    // agents to clarify scope before touching anything — reinforces isolation.
    // Turning on allowFilesystemScan auto-clears it (see /api/settings).
    strictScope: true,
    codexMode: "auto",
    codexAccount: 1,
    claudeMode: "auto",
    claudeAccount: 1,
    subscriptions: {}, // { "claude:acc1": { start, end } } — manual, no API source
    discussionMode: "code",
  },
};

// Asset cache-bust id — changes every server start, stamped into served HTML.
const BUILD_ID = Date.now();

const ROUND_BUDGET = { LIGHT: 3, STANDARD: 6, STRICT: 10, CRITICAL: 12 };

// The FINAL VERIFICATION pass (the gate that closes a subtask) is always run by
// the strongest available agents at max reasoning, regardless of the cheaper
// models used for regular debate rounds. Single source of truth in lib/profiles
// (derived roles/participants carry it as their per-slot verify override) so this
// never drifts; runRound passes role.verify to roles.runRole in verifyMode.

// Shared across manual round and autopilot so the Stop button can cancel either.
let activeAbort = null;
let activeChildren = new Set();

// Cached switch-module status (gateway is async, publicState is sync). Refreshed
// on a timer + after switcher actions; falls back to file detection if gateway down.
let switcherStatus = switcher.detect();
let statsCache = {};
// credentialRefs whose key passed a live test request. Drives the green
// "verified" check on the API-key field (and the green agent chip) — presence
// alone isn't enough. Persisted across restarts (rooms/.validated-keys.json),
// pinned to the key value's fingerprint so a changed key auto-invalidates.
const validatedRefs = validatedStore.validatedSet(ROOMS_DIR, (ref) => process.env[ref]);
// Bumped whenever the token-usage sources are force-refreshed (the ↻ button), so
// the client knows to re-fetch the stats panel (Limits tab) once it lands.
let statsVersion = 0;
// Per-account ping results from the last ↻ refresh: key "tool+num" → bool (ok/fail).
// Cleared ~5s after the refresh completes so the UI can flash chips green/red.
let switcherPingResults = null;
async function refreshSwitcher() {
  try { switcherStatus = await switcher.status(); } catch { switcherStatus = switcher.detect(); }
}

// Run a git command in the project root. Resolves with {ok, stdout, stderr} and
// never rejects, so callers can branch on `ok` without try/catch.
function git(args, timeout = 30000) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd: ROOT, timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || "").trim(), stderr: String(stderr || "").trim() });
    });
  });
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
  // A new chat is a clean slate (Phase 6b): inherit the global defaults (models,
  // language, scan, strictScope…) but NOT the previous chat's agent selection —
  // the user picks agents fresh for each chat.
  const { participants, ...inheritable } = state.settings || {};
  return {
    id: store.makeRunId(topic),
    topic: String(topic || "Untitled").slice(0, 200),
    createdAt: store.now(),
    rounds: 0,
    archived: false,
    trashed: false,
    settings: { ...inheritable },
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

// Provider-layer info for the settings UI: build mode, preset catalog, provider
// types, and per-profile credential presence (whether the env key is set — the
// key itself is never exposed). Keyed by profile id.
function providersInfo() {
  const cfg = (state.run && state.run.settings && state.run.settings.profiles) || state.settings.profiles || [];
  const credentials = {};
  const validated = {};
  for (const p of cfg) if (p && p.id) {
    credentials[p.id] = providers.credentialPresent(p);
    // "validated" = the key passed a live test request this session. Keyless
    // providers (Ollama) need no key, so they count as validated when present.
    const ref = p.credentialRef || (providers.resolveProfile(p).credentialRef);
    validated[p.id] = ref ? validatedRefs.has(ref) : Boolean(credentials[p.id]);
  }
  // Per-profile cumulative token spend (API keys have no remaining %, only spend)
  // so the connected-agent chips can show how much each backend has used.
  return { mode: providers.mode(), presets: providers.presets(), types: providers.providerTypes(), credentials, validated, usage: usage.summary(ROOMS_DIR) };
}

function publicState() {
  if (!state.run) {
    const globalDomain = domains.getProfile(state.settings.discussionMode ?? "code");
    return {
      activeRunId: null,
      busy: state.busy,
      status: state.status,
      run: null,
      domain: { id: globalDomain.id, label: globalDomain.label, guards: globalDomain.guards, sections: globalDomain.sections },
      domains: domains.options(),
      autopilot: state.autopilot,
      runs: listRuns().map((r) => ({ id: r.id, topic: r.topic, createdAt: r.createdAt, rounds: r.rounds, archived: Boolean(r.archived), trashed: Boolean(r.trashed) })),
      settings: state.settings,
      switcher: { ...switcherStatus, statsVersion, pingResults: switcherPingResults },
      providers: providersInfo(),
      workdir: WORKDIR,
      port: PORT,
      cli: { codex: cli.describeCodex(), claude: cli.describeClaude() },
      updateStatus: state.updateStatus,
    };
  }
  const dir = runDir(state.run.id);
  const allSubtasks = subtasks.loadAll(dir);
  const active = allSubtasks.find((item) => item.status === "open") || null;
  if (active) ensureQuestionsMigrated(dir, active.id);
  const messages = store.readJsonl(transcriptPath(state.run.id));
  const activeQuestions = active ? questions.forSubtask(dir, active.id) : [];
  const runDomainId = state.run.settings?.discussionMode ?? state.settings.discussionMode ?? "code";
  const runDomain = domains.getProfile(runDomainId);
  return {
    activeRunId: state.run.id,
    busy: state.busy,
    status: state.status,
    domain: { id: runDomain.id, label: runDomain.label, guards: runDomain.guards, sections: runDomain.sections },
    domains: domains.options(),
    run: {
      ...state.run,
      activeSubtask: active,
      subtasks: allSubtasks,
      knowledge: knowledge.load(dir, runDomain.sections),
      questions: activeQuestions,
      documents: documents.listMeta(dir),
      messages,
    },
    autopilot: state.autopilot,
    runs: listRuns().map((r) => ({ id: r.id, topic: r.topic, createdAt: r.createdAt, rounds: r.rounds, archived: Boolean(r.archived), trashed: Boolean(r.trashed) })),
    settings: state.settings,
    switcher: { ...switcherStatus, statsVersion, pingResults: switcherPingResults },
    providers: providersInfo(),
    workdir: WORKDIR,
    port: PORT,
    cli: { codex: cli.describeCodex(), claude: cli.describeClaude() },
    updateStatus: state.updateStatus,
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

function addMessage({ role, name, kind = "", text, textRu = "", subtaskId = "", round = 0, slot = "" }) {
  if (!state.run) return null;
  const item = {
    id: store.makeId("msg"),
    at: store.now(),
    role,
    name,
    kind,
    subtaskId,
    round,
    // Slot key of the authoring participant (codex/claude legacy, or a1..a5).
    // Lets the client map an agent message to its live terminal pane.
    ...(slot ? { slot } : {}),
    // Service/trace messages are bilingual: `text` holds English, `textRu` the
    // Russian variant. The client renders the one matching the UI language
    // (live-switchable). Agent replies pass only `text` (their own language).
    text: String(text || "").trim(),
    ...(textRu ? { textRu: String(textRu).trim() } : {}),
  };
  store.appendJsonl(transcriptPath(state.run.id), item);
  broadcast();
  return item;
}

// Return the last `count` agent/user turns of a subtask (one round = one turn
// per participant, so callers pass participants.length * rounds-to-show).
function recentTurnsForSubtask(runId, subtaskId, count = 4) {
  if (!subtaskId) return [];
  const messages = store.readJsonl(transcriptPath(runId));
  return messages
    .filter((m) => m.subtaskId === subtaskId && (m.role === "agent" || m.role === "user") && !m.trashed)
    .slice(-count);
}

// Move an agent response to the trash (or restore it). Trashed messages are kept
// in the transcript but hidden from the conversation and excluded from the
// context fed to the next round.
function setMessageTrashed(runId, id, trashed) {
  const file = transcriptPath(runId);
  const messages = store.readJsonl(file);
  const target = messages.find((m) => m.id === id);
  if (!target) throw new Error("Message not found");
  target.trashed = Boolean(trashed);
  store.rewriteJsonl(file, messages);
  return target;
}

async function runRound({ guidance = "" } = {}) {
  if (!state.run) throw new Error("No active run");
  if (state.busy) throw new Error("Busy");
  const dir = runDir(state.run.id);
  const active = subtasks.activeSubtask(dir);
  if (!active) throw new Error("No active subtask — open a subtask before running a round");

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
    const activeDomainId = state.run.settings?.discussionMode ?? state.settings.discussionMode ?? "code";
    const domain = domains.getProfile(activeDomainId);
    const kbSnapshot = knowledge.snapshotForPrompt(dir, domain.sections);
    const documentsSnapshot = documents.snapshotForPrompt(dir);
    const language = state.run.settings.language || "ru";

    // Resolve the debate participants (2..5). Legacy / Phase-5 two-slot settings
    // derive the old Codex/Claude behavior; explicit settings.participants override
    // it. Each participant = { slot(key), label, mode, verify, chain }. The slot key
    // is opaque — questions / KB / transcript / terminals all key off it.
    const sw = switcher.detect();
    const swInfo = {
      connected: sw.connected,
      codexAcc2: switcher.accountAvailable("codex", "acc2"),
      claudeAcc2: switcher.accountAvailable("claude", "acc2"),
    };
    const eff = profiles.effectiveConfig(state.run.settings, swInfo);
    const participants = eff.participants;
    const partKeys = participants.map((p) => p.slot);

    // Recent turns: show the last two FULL rounds (one round = one turn per
    // participant). Prompts are intentionally NOT compressed — each agent sees the
    // complete context of every other agent.
    const recent = recentTurnsForSubtask(state.run.id, active.id, participants.length * 2);

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

    const allowScan = Boolean(state.run.settings?.allowFilesystemScan ?? state.settings.allowFilesystemScan);
    const strictScope = Boolean(state.run.settings?.strictScope ?? state.settings.strictScope);
    const promptCommon = {
      language,
      subtask: active,
      kbSnapshot,
      domain,
      documentsSnapshot,
      recentTurns: recent,
      guidance,
      round,
      allowFilesystemScan: allowScan,
      strictScope,
      openQuestions: openQs.map((q) => ({ id: q.id, text: q.text, priority: q.priority })),
      verify,
      deferredMinors: minorOpen.map((q) => ({ id: q.id, text: q.text })),
    };
    // Each participant sees the full context of all the others (no summarization).
    const prompts = participants.map((p) =>
      prompt.buildDebatePrompt({
        ...promptCommon,
        agentName: p.label,
        otherAgentNames: participants.filter((x) => x !== p).map((x) => x.label),
      }),
    );

    const promptSizes = participants.map((p, i) => `${p.label} ${prompts[i].length}c`).join(", ");
    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Round ${round} (subtask ${active.id})${verifyMode ? " — FINAL VERIFICATION (max agents)" : ""}: launching ${participants.length} agents in parallel [${promptSizes}].`,
      textRu: `Раунд ${round} (subtask ${active.id})${verifyMode ? " — ФИНАЛЬНАЯ ПРОВЕРКА (максимальные агенты)" : ""}: запуск ${participants.length} агентов параллельно [${promptSizes}].`,
      subtaskId: active.id,
      round,
    });

    // Clear each participant's pinned terminal for this round on the client.
    for (const p of participants) {
      broadcastStream(p.slot, "", { subtaskId: active.id, round, reset: true, label: p.label });
    }

    const stamp = `R${round}-${active.id}`;
    activeChildren = new Set();
    const trackChild = (child) => {
      activeChildren.add(child);
      child.on("close", () => activeChildren.delete(child));
    };
    // Run one participant via its role. Failover (auto mode) and the verify-pass
    // model override are handled inside roles.runRole; onFailover logs the switch
    // and clears the live terminal, exactly like the old per-account retry did.
    // outFile is the codex CLI's raw transcript dump (other backends ignore it),
    // keyed by the participant slot so any codex-backed agent writes its own file.
    const runSlot = (role, agentPrompt) => roles.runRole(role, agentPrompt, {
      workdir: WORKDIR,
      isolated: !allowScan,
      signal: ac.signal,
      onStream: (chunk) => broadcastStream(role.slot, chunk, { subtaskId: active.id, round, label: role.label }),
      onChild: trackChild,
      outFile: path.join(dir, `${stamp}-${role.slot}.txt`),
      logFile: path.join(dir, `${stamp}-${role.slot}.log`),
      verify: verifyMode ? role.verify : null,
      onFailover: (next, prev) => {
        addMessage({
          role: "system", name: "Council Room", kind: "process",
          text: `${role.label}: error/limit on ${prev.label || prev.id} → switching to ${next.label || next.id} (auto-failover).`,
          textRu: `${role.label}: ошибка/лимит на ${prev.label || prev.id} → переключаюсь на ${next.label || next.id} (auto-failover).`,
          subtaskId: active.id, round,
        });
        broadcastStream(role.slot, "", { subtaskId: active.id, round, reset: true, label: role.label });
      },
    });

    const backendOf = (role) => (role.chain[0] ? (role.chain[0].label || role.chain[0].id) : "—");
    const backendList = participants.map((p) => `${p.label} via ${backendOf(p)} (${p.mode})`).join(", ");
    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Round backends: ${backendList}.${sw.connected ? "" : " Switch module not connected — standard mode."}`,
      textRu: `Бэкенды раунда: ${backendList}.${sw.connected ? "" : " Модуль свитч не подключён — стандартный режим."}`,
      subtaskId: active.id,
      round,
    });

    const results = await Promise.all(participants.map((p, i) => runSlot(p, prompts[i])));

    if (ac.signal.aborted) {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Round ${round} (subtask ${active.id}) cancelled by user — partial result discarded (round not counted).`,
        textRu: `Раунд ${round} (subtask ${active.id}) прерван пользователем — частичный результат отброшен (раунд не засчитан).`,
        subtaskId: active.id,
        round,
      });
      return { aborted: true };
    }

    // Accumulate API-profile token spend (subscription/CLI backends report no
    // usage, so only network providers contribute). The winning profile of each
    // slot is on the role result; bump the stats panel when anything was recorded.
    let usageRecorded = false;
    for (const r of results) {
      const u = r && r.result && r.result.usage;
      if (u && r.profile) { usage.record(ROOMS_DIR, r.profile, u); usageRecorded = true; }
    }
    if (usageRecorded) { statsCache = {}; statsVersion++; }

    const tails = results.map((r) => prompt.parseAgentTail(r.text));

    participants.forEach((p, i) => {
      addMessage({
        role: "agent",
        name: p.label,
        kind: "debate",
        text: results[i].text,
        subtaskId: active.id,
        round,
        slot: p.slot,
      });
    });

    // Route KB-patches: open_questions go to the per-subtask questions store
    // (deduped), everything else into the durable Knowledge Base. A question
    // closes only when ALL current participants (partKeys) have marked it resolved.
    participants.forEach((p, i) => {
      const tail = tails[i];
      for (const patch of tail.kbPatches) {
        if (patch.section === "open_questions") {
          questions.addQuestion(dir, active.id, patch.item, round);
        } else {
          try { knowledge.addItem(dir, patch.section, patch.item, domain.sections); } catch {}
        }
      }
      // Record this participant's resolutions of existing questions.
      for (const r of tail.resolved) questions.recordResolve(dir, r.id, p.slot, r.answer, partKeys);
      // Apply priority changes; warn when a deferred question is promoted to critical.
      for (const pr of tail.priority || []) {
        const before = questions.forSubtask(dir, active.id).find((x) => x.id === pr.id);
        questions.setPriority(dir, pr.id, pr.priority);
        if (before && before.priority === "minor" && pr.priority === "critical" && before.status === "open") {
          addMessage({ role: "system", name: "Council Room", kind: "process", text: `⚠️ ${p.label} raised question ${pr.id} to CRITICAL — it now blocks execution.`, textRu: `⚠️ ${p.label} повысил вопрос ${pr.id} до CRITICAL — теперь он блокирует исполнение.`, subtaskId: active.id, round });
        }
      }
    });

    // Final-verification pass: reopen anything any agent flagged; if ALL confirm
    // with no reopens, mark the whole batch verified → debate complete.
    let verifyPassed = false;
    if (verifyMode) {
      const reopen = new Set(tails.flatMap((t) => t.verify?.reopen || []));
      for (const id of reopen) questions.reopen(dir, id);
      if (reopen.size) {
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Final verification: returned to work — ${[...reopen].join(", ")}.`, textRu: `Финальная проверка: возвращены в работу — ${[...reopen].join(", ")}.`, subtaskId: active.id, round });
      } else if (tails.every((t) => t.verify?.ok)) {
        questions.markSubtaskVerified(dir, active.id);
        verifyPassed = true;
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Final verification passed by all agents — critical questions verified, subtask ready to close.`, textRu: `Финальная проверка пройдена всеми агентами — критичные вопросы verified, подзадача готова к закрытию.`, subtaskId: active.id, round });
        const stillMinor = questions.openForSubtask(dir, active.id).filter((q) => q.priority === "minor");
        if (stillMinor.length) {
          addMessage({ role: "system", name: "Council Room", kind: "process", text: `⚠️ Deferred ${stillMinor.length} minor question(s) — catch up later: ${stillMinor.map((q) => q.id).join(", ")}. If any becomes blocking — raise it to critical.`, textRu: `⚠️ Отложено ${stillMinor.length} второстепенных вопрос(ов) — догнать позже: ${stillMinor.map((q) => q.id).join(", ")}. Если какой-то станет блокирующим — повысь до critical.`, subtaskId: active.id, round });
        }
      }
    }

    const qStats = questions.forSubtask(dir, active.id);
    const openNow = qStats.filter((q) => q.status === "open");
    addMessage({
      role: "system",
      name: "Council Room",
      kind: "process",
      text: `Questions: open ${openNow.length} (critical ${openNow.filter((q) => q.priority === "critical").length} / minor ${openNow.filter((q) => q.priority === "minor").length}), resolved ${qStats.filter((q) => q.status === "resolved").length}, verified ${qStats.filter((q) => q.status === "verified").length}.`,
      textRu: `Вопросы: открыто ${openNow.length} (critical ${openNow.filter((q) => q.priority === "critical").length} / minor ${openNow.filter((q) => q.priority === "minor").length}), решено ${qStats.filter((q) => q.status === "resolved").length}, проверено ${qStats.filter((q) => q.status === "verified").length}.`,
      subtaskId: active.id,
      round,
    });

    subtasks.incrementRounds(dir, active.id);

    // Stop signals are over ALL participants: stale = nobody added anything new;
    // debate-complete = everyone resolved; block = anyone blocked.
    const stale = tails.every((t) => !t.newFacts.length && !t.newRisks.length && !t.newAlternatives.length);
    if (stale) {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Round ${round}: stale (no new facts/risks/alternatives from any agent). Consider closing the subtask or giving guidance.`,
        textRu: `Раунд ${round}: stale (нет новых facts/risks/alternatives ни у одного агента). Рекомендуется закрыть подзадачу или ввести guidance.`,
        subtaskId: active.id,
        round,
      });
    }
    const allResolve = tails.every((t) => t.status === "resolve");
    if (allResolve) {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Round ${round}: all agents reported Status: resolve. The subtask can be closed.`,
        textRu: `Раунд ${round}: все агенты сообщили Status: resolve. Можно закрывать подзадачу.`,
        subtaskId: active.id,
        round,
      });
    }
    const debateComplete = allResolve || verifyPassed;
    const anyBlock = tails.some((t) => t.status === "block");
    if (anyBlock) {
      addMessage({
        role: "system",
        name: "Council Room",
        kind: "process",
        text: `Round ${round}: an agent reported Status: block — user decision required.`,
        textRu: `Раунд ${round}: один из агентов сообщил Status: block — требуется решение пользователя.`,
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
      stale,
      resolve: debateComplete,
      block: anyBlock,
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
  lines.push("Closed by autopilot (DEBATE_COMPLETE: all agents Status: resolve).");
  return lines.join("\n");
}

async function runAutopilot({ autoResolve = false, guidance = "" } = {}) {
  if (!state.run) throw new Error("No active run");
  if (state.busy) throw new Error("Busy");
  if (state.autopilot.running) throw new Error("Autopilot already running");
  const dir = runDir(state.run.id);
  const active = subtasks.activeSubtask(dir);
  if (!active) throw new Error("No active subtask — open a subtask before autopilot");

  state.autopilot = { running: true, subtaskId: active.id, reason: "", startedAt: store.now(), round: active.rounds };
  addMessage({
    role: "system",
    name: "Council Room",
    kind: "process",
    text: `Autopilot started on subtask ${active.id} (mode ${active.mode}, budget ${ROUND_BUDGET[active.mode] || 6} rounds, auto-resolve ${autoResolve ? "ON" : "OFF"}).`,
    textRu: `Autopilot запущен по подзадаче ${active.id} (mode ${active.mode}, budget ${ROUND_BUDGET[active.mode] || 6} раундов, авто-закрытие ${autoResolve ? "ON" : "OFF"}).`,
    subtaskId: active.id,
  });
  broadcast();

  let staleStreak = 0;
  let pendingGuidance = guidance; // forwarded to the first round only, then cleared
  try {
    while (state.autopilot.running) {
      const cur = subtasks.activeSubtask(dir);
      if (!cur || cur.id !== active.id) { stopAutopilot("subtask-changed"); break; }
      const budget = ROUND_BUDGET[cur.mode] || 6;
      if (cur.rounds >= budget) { stopAutopilot("round-budget"); break; }

      let r;
      try {
        r = await runRound({ guidance: pendingGuidance });
        pendingGuidance = "";
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
            text: `Subtask ${cur.id} auto-resolved by autopilot. Summary: ${summary}`,
            textRu: `Подзадача ${cur.id} авто-закрыта автопилотом. Резюме: ${summary}`,
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
      applyRunSettings(run);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/runs/switch") {
      const body = await readBody(req);
      const run = loadRun(body.runId);
      state.run = run;
      state.activeRunId = run.id;
      applyRunSettings(run);
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

    if (method === "POST" && (pathname === "/api/runs/archive" || pathname === "/api/runs/trash" || pathname === "/api/runs/restore")) {
      const body = await readBody(req);
      const run = loadRun(body.runId);
      // archive ⇄ trash ⇄ active are mutually exclusive bins; restore clears both.
      if (pathname.endsWith("/archive")) { run.archived = true; run.trashed = false; }
      else if (pathname.endsWith("/trash")) { run.archived = false; run.trashed = true; }
      else { run.archived = false; run.trashed = false; }
      saveRun(run);
      // Archiving/trashing the active chat clears the view; restore just flips the flags.
      if ((run.archived || run.trashed) && state.run && state.run.id === run.id) {
        state.run = null;
        state.activeRunId = null;
      }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/runs/trash/empty") {
      let removed = 0;
      for (const r of listRuns()) {
        if (!r.trashed) continue;
        const dir = runDir(r.id);
        if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); removed++; }
        if (state.run && state.run.id === r.id) { state.run = null; state.activeRunId = null; }
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
        text: `Subtask opened: ${subtask.title} (id ${subtask.id}, mode ${subtask.mode}).`,
        textRu: `Открыта подзадача: ${subtask.title} (id ${subtask.id}, mode ${subtask.mode}).`,
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
        text: `Subtask ${resolved.id} resolved.${body.summary ? ` Summary: ${body.summary}` : ""}`,
        textRu: `Подзадача ${resolved.id} закрыта.${body.summary ? ` Резюме: ${body.summary}` : ""}`,
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
        text: `Subtask ${frozen.id} frozen. Reason: ${body.reason || "not specified"}.`,
        textRu: `Подзадача ${frozen.id} заморожена. Причина: ${body.reason || "не указана"}.`,
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
        text: `Subtask ${edited.id} edited: title="${edited.title}", mode=${edited.mode}.`,
        textRu: `Подзадача ${edited.id} отредактирована: title="${edited.title}", mode=${edited.mode}.`,
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
        text: `Subtask ${body.id} deleted (no rounds yet).`,
        textRu: `Подзадача ${body.id} удалена (раундов не было).`,
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
      const label = bin === "trash" ? "to trash" : (bin === "archive" ? "to archive" : "back to the stack");
      const labelRu = bin === "trash" ? "в корзину" : (bin === "archive" ? "в архив" : "восстановлена в стек");
      addMessage({ role: "system", name: "Council Room", kind: `subtask-${bin || "restore"}`, text: `Subtask ${item.id} moved ${label}.`, textRu: `Подзадача ${item.id} перемещена ${labelRu}.`, subtaskId: item.id });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && (pathname === "/api/messages/trash" || pathname === "/api/messages/restore")) {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const trashed = pathname.endsWith("/trash");
      try {
        setMessageTrashed(state.run.id, body.id, trashed);
      } catch (error) {
        return sendJson(res, 404, { error: error.message });
      }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/subtasks/trash/empty") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const dir = runDir(state.run.id);
      const { removed } = subtasks.emptyTrash(dir);
      addMessage({ role: "system", name: "Council Room", kind: "subtask-trash", text: `Subtask trash emptied (removed: ${removed}).`, textRu: `Корзина подзадач очищена (удалено: ${removed}).` });
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
        text: `Subtask ${reopened.id} reopened.`,
        textRu: `Подзадача ${reopened.id} переоткрыта.`,
        subtaskId: reopened.id,
      });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/round") {
      if (state.autopilot.running) return sendJson(res, 409, { error: "Autopilot is running — stop it before a manual round" });
      const body = await readBody(req);
      runRound({ guidance: body.guidance || "" }).catch((error) => {
        addMessage({ role: "system", name: "Council Room", kind: "error", text: `Round failed: ${error.message}`, textRu: `Раунд завершился ошибкой: ${error.message}` });
      });
      return sendJson(res, 202, { accepted: true });
    }

    if (method === "POST" && pathname === "/api/autopilot/start") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      runAutopilot({ autoResolve: Boolean(body.autoResolve), guidance: body.guidance || "" }).catch((error) => {
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
        addMessage({ role: "system", name: "Council Room", kind: "process", text: "Autopilot stopped: user-stop.", textRu: "Autopilot остановлен: пользователь.", subtaskId: state.autopilot.subtaskId || "" });
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
      const kbDomain = domains.getProfile(state.run.settings?.discussionMode ?? state.settings.discussionMode ?? "code");
      knowledge.addItem(dir, body.section, body.item, kbDomain.sections);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/kb/remove") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      const dir = runDir(state.run.id);
      const kbDomain = domains.getProfile(state.run.settings?.discussionMode ?? state.settings.discussionMode ?? "code");
      knowledge.removeItem(dir, body.section, body.item, kbDomain.sections);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    // Phase 6b: per-chat attached reference documents (fed into the debate prompt).
    if (method === "POST" && pathname === "/api/documents/add") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      if (!body.text || !String(body.text).trim()) return sendJson(res, 400, { error: "Empty document" });
      documents.add(runDir(state.run.id), body.name, body.text);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/documents/remove") {
      if (!state.run) return sendJson(res, 400, { error: "No active run" });
      const body = await readBody(req);
      documents.remove(runDir(state.run.id), body.id);
      broadcast();
      return sendJson(res, 200, publicState());
    }

    // Phase 7: create a new discussion profile from the builder UI. Writes
    // profiles/<id>.md and reloads the registry so it appears immediately.
    if (method === "POST" && pathname === "/api/domains/create") {
      const body = await readBody(req);
      let newId;
      try {
        newId = domains.createProfile(body);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      broadcast();
      return sendJson(res, 200, { ok: true, id: newId, domains: domains.options() });
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
        addMessage({ role: "system", name: "Council Room", kind: "process", text: `Authorization started: ${tool} account ${account}${result.ok ? " (terminal window opened)" : ` (error: ${result.error})`}.`, textRu: `Запущена авторизация: ${tool} аккаунт ${account}${result.ok ? " (окно терминала открыто)" : ` (ошибка: ${result.error})`}.` });
      }
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    if (method === "GET" && pathname === "/api/switcher/stats") {
      const period = ["today", "week", "all"].includes(parsed.query.period) ? parsed.query.period : "today";
      const key = `stats:${period}`;
      const now = Date.now();
      if (!statsCache[key] || now - statsCache[key].at > 60000) {
        const dirs = switcher.claudePaths();
        const codexDirs = switcher.codexPaths();
        statsCache[key] = {
          at: now,
          data: {
            period,
            claude: {
              acc1: stats.accountStats(dirs.acc1, period),
              acc2: stats.accountStats(dirs.acc2, period),
            },
            // Codex: rolling-window limits from its rollout rate_limits. No spend
            // figure (codex usage isn't in the Claude session JSONL).
            codex: {
              acc1: { windows: switcher.codexUsageWindows(codexDirs.acc1), spending: null },
              acc2: { windows: switcher.codexUsageWindows(codexDirs.acc2), spending: null },
            },
          },
        };
      }
      // Provider spend is cumulative (no per-period source), so attach it fresh
      // rather than caching it with the windowed Claude/Codex stats.
      return sendJson(res, 200, { ...statsCache[key].data, providers: usage.summary(ROOMS_DIR) });
    }

    if (method === "GET" && pathname === "/api/ollama/detect") {
      // Auto-detect Ollama: try OLLAMA_HOST env, then default port 11434.
      // Returns { detected, baseUrl, port, models[] }.
      async function tryOllamaAt(baseUrl) {
        const tagsUrl = baseUrl.replace(/\/v1\/?$/, "") + "/api/tags";
        const mod = tagsUrl.startsWith("https") ? require("node:https") : require("node:http");
        return new Promise((resolve) => {
          const r2 = mod.get(tagsUrl, { timeout: 3000 }, (r) => {
            let body = "";
            r.on("data", (c) => { body += c; });
            r.on("end", () => {
              try {
                const data = JSON.parse(body);
                const models = Array.isArray(data.models)
                  ? data.models.map((m) => m.name || m.model).filter(Boolean)
                  : [];
                resolve({ detected: true, models });
              } catch { resolve(null); }
            });
          });
          r2.on("error", () => resolve(null));
          r2.on("timeout", () => { r2.destroy(); resolve(null); });
        });
      }

      // Candidates: OLLAMA_HOST env first, then localhost:11434.
      const envHost = process.env.OLLAMA_HOST || "";
      const candidates = [];
      if (envHost) {
        const base = envHost.startsWith("http") ? envHost : `http://${envHost}`;
        candidates.push(base.replace(/\/$/, "") + "/v1");
      }
      candidates.push("http://localhost:11434/v1");

      for (const baseUrl of candidates) {
        const result = await tryOllamaAt(baseUrl);
        if (result) {
          const portMatch = baseUrl.match(/:(\d+)/);
          const port = portMatch ? Number(portMatch[1]) : 11434;
          return sendJson(res, 200, { detected: true, baseUrl, port, models: result.models });
        }
      }
      return sendJson(res, 200, { detected: false, baseUrl: "http://localhost:11434/v1", port: 11434, models: [] });
    }

    if (method === "GET" && pathname === "/api/ollama/models") {
      // Proxy Ollama's model list to avoid CORS. baseUrl param mirrors the profile's
      // baseUrl (e.g. http://localhost:11434/v1); we strip /v1 to reach /api/tags.
      const rawBase = parsed.query.baseUrl || "http://localhost:11434/v1";
      const tagsUrl = rawBase.replace(/\/v1\/?$/, "") + "/api/tags";
      try {
        const mod = tagsUrl.startsWith("https") ? require("node:https") : require("node:http");
        const data = await new Promise((resolve, reject) => {
          const req2 = mod.get(tagsUrl, { timeout: 5000 }, (r) => {
            let body = "";
            r.on("data", (c) => { body += c; });
            r.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
          });
          req2.on("error", reject);
          req2.on("timeout", () => { req2.destroy(); reject(new Error("timeout")); });
        });
        const models = (data && Array.isArray(data.models))
          ? data.models.map((m) => m.name || m.model).filter(Boolean)
          : [];
        return sendJson(res, 200, { models });
      } catch (e) {
        return sendJson(res, 200, { models: [], error: e.message });
      }
    }

    if (method === "POST" && pathname === "/api/providers/key") {
      // Direct API-key entry: persist the typed key to .env (gitignored) under
      // the given env var name and load it live. The key NEVER touches state.json
      // or the response body — profiles only ever store the credentialRef name.
      const body = await readBody(req);
      const ref = String((body && body.credentialRef) || "").trim();
      const value = String((body && body.value) || "");
      if (!ref) return sendJson(res, 400, { error: "credentialRef required" });
      if (!value) return sendJson(res, 400, { error: "value required" });
      try {
        env.setEnvVar(ROOT, ref, value);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
      validatedRefs.delete(ref); // new key is unproven until a live test passes
      validatedStore.clearValidated(ROOMS_DIR, ref);
      broadcast();
      // Echo back which profiles now have their key present (no key values).
      return sendJson(res, 200, { ok: true, credentials: publicState().providers.credentials });
    }

    if (method === "POST" && pathname === "/api/providers/test") {
      // Validate an API key with a tiny live request. Optionally persists the
      // typed key to .env first (so the user gets the green check the moment a
      // working key is entered). Only network providers; CLI is out of scope.
      const body = await readBody(req);
      const provider = String((body && body.provider) || "");
      const credentialRef = String((body && body.credentialRef) || "").trim();
      const model = String((body && body.model) || "").trim();
      const apiKey = String((body && body.apiKey) || "");
      if (profiles.isCliProvider(provider)) return sendJson(res, 400, { error: "CLI providers can't be key-tested" });
      if (!credentialRef && provider !== "ollama") return sendJson(res, 400, { error: "credentialRef required" });
      if (!model) return sendJson(res, 400, { error: "set a model first" });
      if (apiKey && credentialRef) {
        try { env.setEnvVar(ROOT, credentialRef, apiKey); } catch (e) { return sendJson(res, 400, { error: e.message }); }
      }
      const provLabel = provider === "ollama" ? "Ollama" : provider;
      addMessage({ role: "system", name: "Council Room", kind: "process",
        text: `Agent test: ${provLabel} / ${model} — connecting…`,
        textRu: `Тест агента: ${provLabel} / ${model} — проверяю подключение…` });
      const profile = { provider, baseUrl: body.baseUrl, credentialRef, model };
      const r = await providers.runProfile(profile, "What is 1+3? Reply with just the number.", { timeoutMs: 25000 })
        .catch((e) => ({ ok: false, text: e && e.message ? e.message : "error" }));
      if (credentialRef) {
        if (r.ok) { validatedRefs.add(credentialRef); validatedStore.markValidated(ROOMS_DIR, credentialRef, process.env[credentialRef]); }
        else { validatedRefs.delete(credentialRef); validatedStore.clearValidated(ROOMS_DIR, credentialRef); }
      }
      const errText = String(r.text || "").split("\n")[0].slice(0, 200);
      const reply = String(r.text || "").replace(/\s+/g, " ").trim().slice(0, 40);
      if (r.ok) {
        addMessage({ role: "system", name: "Council Room", kind: "process",
          text: `✓ ${provLabel} / ${model} — connected (reply: «${reply}»)`,
          textRu: `✓ ${provLabel} / ${model} — подключён (ответ: «${reply}»)` });
      } else {
        addMessage({ role: "system", name: "Council Room", kind: "process",
          text: `✗ ${provLabel} / ${model} — connection failed: ${errText}`,
          textRu: `✗ ${provLabel} / ${model} — ошибка подключения: ${errText}` });
      }
      broadcast();
      const info = publicState().providers;
      return sendJson(res, 200, {
        ok: Boolean(r.ok),
        error: r.ok ? "" : errText,
        reply: r.ok ? reply : "",
        credentials: info.credentials,
        validated: info.validated,
      });
    }

    if (method === "POST" && pathname === "/api/providers/usage/reset") {
      const body = await readBody(req);
      usage.reset(ROOMS_DIR, body && body.profileId ? String(body.profileId) : null);
      statsCache = {};
      statsVersion++;
      broadcast();
      return sendJson(res, 200, { ok: true, providers: usage.summary(ROOMS_DIR) });
    }

    if (method === "POST" && pathname === "/api/switcher/subscription") {
      const body = await readBody(req);
      if (!body.key) return sendJson(res, 400, { error: "key required" });
      const subs = { ...(state.settings.subscriptions || {}) };
      subs[body.key] = { start: String(body.start || ""), end: String(body.end || "") };
      state.settings.subscriptions = subs;
      if (state.run) { state.run.settings = { ...state.run.settings, subscriptions: subs }; saveRun(state.run); }
      const curGs = store.readJson(GLOBAL_SETTINGS_PATH) || {};
      store.writeJson(GLOBAL_SETTINGS_PATH, { ...curGs, subscriptions: subs });
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "POST" && pathname === "/api/log") {
      // Lightweight client-side event logger: adds a process message to the
      // current run's trace so it appears in "Служебные события". No-op when
      // no run is active (addMessage guards against that).
      const body = await readBody(req);
      const text = String((body && body.text) || "").trim();
      const textRu = String((body && body.textRu) || "").trim();
      if (text || textRu) {
        addMessage({ role: "system", name: "Council Room", kind: "process", text: text || textRu, textRu: textRu || text });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/switcher/refresh") {
      // Token monitor: fire a tiny prompt at the CHEAPEST model of every
      // authorized account so its usage source repopulates (Codex → a persisted
      // rollout with fresh rate_limits; Claude → its usage cache), then re-poll.
      // Each ping is logged to the Process trace so the spend is visible.
      const CHEAP_MODEL = { codex: "gpt-5.4-mini", claude: "haiku" };
      const PING_PROMPTS = [
        "What is 1+3? Reply with just the number.",
        "What is 2+2? Reply with just the number.",
        "What is 5+5? Reply with just the number.",
        "What is 3+1? Reply with just the number.",
        "What is 6+2? Reply with just the number.",
        "What is 4+3? Reply with just the number.",
        "What is 1+7? Reply with just the number.",
        "What is 2+6? Reply with just the number.",
      ];
      const pingPrompt = PING_PROMPTS[Math.floor(Math.random() * PING_PROMPTS.length)];
      const sw = switcherStatus.accounts || {};
      const connected = Boolean(switcherStatus.connected);
      const targets = [];
      for (const tool of ["codex", "claude"]) {
        for (const p of sw[tool] || []) {
          const isApi = p.id === "apikey" || p.mode === "api";
          const isAcc1 = p.id === "acc1" || p.account === 1;
          // acc1 always; acc2 only when the switcher is connected. Skip API + unauthorized.
          if (isApi || !p.authorized || (!isAcc1 && !connected)) continue;
          const num = p.account || (p.id === "acc1" ? 1 : p.id === "acc2" ? 2 : null);
          if (num) targets.push({ tool, num });
        }
      }
      const sid = state.run ? (subtasks.activeSubtask(runDir(state.run.id))?.id || "") : "";
      // Remaining-token % for a given account in a switcher-status snapshot.
      const pctOf = (st, tool, num) => {
        const p = ((st.accounts || {})[tool] || []).find((x) =>
          (x.account || (x.id === "acc1" ? 1 : x.id === "acc2" ? 2 : null)) === num);
        return p && p.tokensPct != null ? p.tokensPct : null;
      };
      const fmtPct = (v) => (v == null ? "—" : `${v}%`);
      (async () => {
        if (!targets.length) {
          addMessage({ role: "system", name: "Council Room", kind: "process", subtaskId: sid,
            text: "Token monitor: no authorized accounts to poll.",
            textRu: "Мониторинг токенов: нет авторизованных аккаунтов для опроса." });
          return;
        }
        const before = {}; // tool:num → remaining % before the ping
        const list = targets.map(({ tool, num }) => {
          before[`${tool}${num}`] = pctOf(switcherStatus, tool, num);
          return `${tool} acc ${num} (${CHEAP_MODEL[tool]})`;
        }).join(", ");
        addMessage({
          role: "system", name: "Council Room", kind: "process", subtaskId: sid,
          text: `Token monitor: tiny request («${pingPrompt}») to ${targets.length} account(s) on the cheapest model — ${list}.`,
          textRu: `Мониторинг токенов: мини-запрос («${pingPrompt}») к ${targets.length} аккаунт(ам) самой дешёвой моделью — ${list}.`,
        });
        const pingOk = {};
        await Promise.all(targets.map(async ({ tool, num }) => {
          await new Promise((r) => setTimeout(r, Math.random() * 1000));
          const model = CHEAP_MODEL[tool];
          const runner = tool === "codex" ? cli.runCodex : cli.runClaude;
          const r = await runner(pingPrompt, {
            workdir: WORKDIR,
            isolated: true,
            model,
            accountEnv: switcher.envForAccount(tool, num),
            ...(tool === "codex" ? { ephemeral: false } : {}), // persist rollout → fresh rate_limits
          }).catch((e) => ({ ok: false, text: e?.message || "error" }));
          pingOk[`${tool}${num}`] = Boolean(r?.ok);
          switcherPingResults = { ...pingOk }; // partial results — flash this chip immediately
          broadcast();
          const secs = r?.result?.durationMs ? `, ${(r.result.durationMs / 1000).toFixed(1)}s` : "";
          const okEn = r?.ok ? `reply «${String(r.text || "").replace(/\s+/g, " ").trim().slice(0, 40)}»` : `error/limit (${String(r?.text || "").split("\n")[0].slice(0, 80)})`;
          const okRu = r?.ok ? `ответ «${String(r.text || "").replace(/\s+/g, " ").trim().slice(0, 40)}»` : `ошибка/лимит (${String(r?.text || "").split("\n")[0].slice(0, 80)})`;
          addMessage({
            role: "system", name: "Council Room", kind: "process", subtaskId: sid,
            text: `Token monitor: ${tool} acc ${num} (${model})${secs} → ${okEn}.`,
            textRu: `Мониторинг токенов: ${tool} акк ${num} (${model})${secs} → ${okRu}.`,
          });
        }));
        await switcher.refreshUsage(); // force the displayed % to actually move
        statsCache = {}; // force recompute after fresh requests
        await refreshSwitcher();
        statsVersion++; // signal the client to re-fetch the stats panel (Limits tab)
        // Per-account summary: overall remaining (before → after) + the two
        // rolling windows (5h / weekly). utilization = % USED, so remaining = 100 − it.
        const winRem = (w) => (w && typeof w.utilization === "number")
          ? `${Math.max(0, Math.min(100, Math.round(100 - w.utilization)))}%` : "—";
        for (const { tool, num } of targets) {
          const b = before[`${tool}${num}`];
          const a = pctOf(switcherStatus, tool, num);
          const win = tool === "claude"
            ? stats.usageWindows(switcher.claudePaths()[`acc${num}`])
            : switcher.codexUsageWindows(switcher.codexPaths()[`acc${num}`]);
          const winStr = win ? ` [windows: 5h ${winRem(win.fiveHour)} · weekly ${winRem(win.sevenDay)}]` : " [windows: no data]";
          const winStrRu = win ? ` [окна: 5ч ${winRem(win.fiveHour)} · нед ${winRem(win.sevenDay)}]` : " [окна: нет данных]";
          addMessage({
            role: "system", name: "Council Room", kind: "process", subtaskId: sid,
            text: `Token monitor: ${tool} acc ${num} — remaining ${fmtPct(b)} → ${fmtPct(a)}${winStr}.`,
            textRu: `Мониторинг токенов: ${tool} акк ${num} — остаток ${fmtPct(b)} → ${fmtPct(a)}${winStrRu}.`,
          });
        }
        broadcast();
        // Clear chip flash after 5 seconds.
        setTimeout(() => { switcherPingResults = null; broadcast(); }, 5000);
      })();
      return sendJson(res, 202, { accepted: true });
    }

    if (method === "POST" && pathname === "/api/settings") {
      const body = await readBody(req);
      if (body.allowFilesystemScan === true) body.strictScope = false;
      // Phase 7: validate and guard discussionMode changes.
      if (body.discussionMode !== undefined) {
        if (!domains.list().includes(body.discussionMode)) body.discussionMode = "code";
        // Guard switching profile on a non-empty KB that contains sections foreign to the new profile.
        if (state.run) {
          const currentDomainId = state.run.settings?.discussionMode ?? state.settings.discussionMode ?? "code";
          if (body.discussionMode !== currentDomainId) {
            const newProfile = domains.getProfile(body.discussionMode);
            const newKeys = new Set(newProfile.sections.map((s) => s.key));
            const currentProfile = domains.getProfile(currentDomainId);
            const kb = knowledge.load(runDir(state.run.id), currentProfile.sections);
            const foreignSections = currentProfile.sections.filter((s) => !newKeys.has(s.key) && (kb.sections[s.key] || []).length > 0);
            if (foreignSections.length > 0) {
              return sendJson(res, 409, { error: `Cannot switch to "${body.discussionMode}": the KB contains items in sections not available in the new profile (${foreignSections.map((s) => s.key).join(", ")}). Clear those sections first.` });
            }
          }
        }
      }
      // Phase 5: validate provider profiles before persisting them.
      if (Array.isArray(body.profiles)) {
        for (const p of body.profiles) {
          const err = profiles.validateProfile(p);
          if (err) return sendJson(res, 400, { error: `Invalid profile "${p && p.id || "?"}": ${err}` });
        }
      }
      // Phase 6: validate the N-agent participants (2..5) against the profiles.
      if (Array.isArray(body.participants)) {
        const pool = Array.isArray(body.profiles) ? body.profiles : (state.settings.profiles || []);
        const perr = profiles.validateParticipants(body.participants, pool);
        if (perr) return sendJson(res, 400, { error: `Invalid participants: ${perr}` });
      }

      // --- Trace: provider profile changes ---
      const fmtProv = (p) => {
        const prov = p.provider === "ollama" ? "Ollama" : p.provider || "?";
        return `${p.label || p.id} (${prov}${p.model ? " / " + p.model : ""})`;
      };
      if (Array.isArray(body.profiles)) {
        const oldProfs = state.settings.profiles || [];
        const oldMap = new Map(oldProfs.map((p) => [p.id, p]));
        const newMap = new Map(body.profiles.map((p) => [p.id, p]));
        for (const [id, p] of newMap) {
          if (!oldMap.has(id)) {
            addMessage({ role: "system", name: "Council Room", kind: "process",
              text: `Agent registered: ${fmtProv(p)}`,
              textRu: `Агент зарегистрирован: ${fmtProv(p)}` });
          }
        }
        for (const [id, p] of oldMap) {
          if (!newMap.has(id)) {
            addMessage({ role: "system", name: "Council Room", kind: "process",
              text: `Agent removed from registry: ${fmtProv(p)}`,
              textRu: `Агент удалён из реестра: ${fmtProv(p)}` });
          }
        }
      } else if (body.profiles === null) {
        const oldProfs = state.settings.profiles || [];
        if (oldProfs.length) {
          addMessage({ role: "system", name: "Council Room", kind: "process",
            text: `All registered agents cleared.`,
            textRu: `Все зарегистрированные агенты удалены.` });
        }
      }

      // --- Trace: debate participant changes ---
      const fmtBackend = (b) => {
        if (!b) return "?";
        const prov = b.provider === "cli-codex" ? "Codex CLI" : b.provider === "cli-claude" ? "Claude CLI"
          : b.provider === "ollama" ? "Ollama" : b.provider || "?";
        const acc = b.account ? ` acc ${b.account}` : "";
        const mdl = b.model ? ` / ${b.model}` : "";
        const eff = b.effort && b.effort !== "auto" ? ` / ${b.effort}` : "";
        return `${prov}${acc}${mdl}${eff}`;
      };
      if (Array.isArray(body.participants)) {
        const cur = state.run
          ? (state.run.settings.participants || [])
          : (state.settings.participants || []);
        const oldMap = new Map(cur.map((p) => [p.key, p]));
        for (const p of body.participants) {
          const old = oldMap.get(p.key);
          const bStr = fmtBackend(p.backend);
          if (!old) {
            addMessage({ role: "system", name: "Council Room", kind: "process",
              text: `Debate agent added: ${p.label || p.key} → ${bStr}`,
              textRu: `Агент дебатов добавлен: ${p.label || p.key} → ${bStr}` });
          } else {
            const ob = old.backend || {};
            const nb = p.backend || {};
            if (ob.provider !== nb.provider || ob.model !== nb.model || ob.effort !== nb.effort || ob.account !== nb.account) {
              addMessage({ role: "system", name: "Council Room", kind: "process",
                text: `Debate agent updated: ${p.label || p.key} → ${bStr}`,
                textRu: `Агент дебатов обновлён: ${p.label || p.key} → ${bStr}` });
            }
          }
        }
        for (const old of cur) {
          if (!body.participants.some((p) => p.key === old.key)) {
            addMessage({ role: "system", name: "Council Room", kind: "process",
              text: `Debate agent removed: ${old.label || old.key}`,
              textRu: `Агент дебатов удалён: ${old.label || old.key}` });
          }
        }
      } else if (body.participants === null) {
        const cur = state.run
          ? (state.run.settings.participants || [])
          : (state.settings.participants || []);
        if (cur.length) {
          addMessage({ role: "system", name: "Council Room", kind: "process",
            text: `Debate agents cleared.`,
            textRu: `Агенты дебатов очищены.` });
        }
      }

      state.settings = { ...state.settings, ...body };
      if (state.run) {
        state.run.settings = { ...state.run.settings, ...body };
        saveRun(state.run);
      }
      if ("profiles" in body) {
        const curGs2 = store.readJson(GLOBAL_SETTINGS_PATH) || {};
        store.writeJson(GLOBAL_SETTINGS_PATH, { ...curGs2, profiles: state.settings.profiles || [] });
      }
      broadcast();
      return sendJson(res, 200, publicState());
    }

    if (method === "GET" && pathname === "/api/update/check") {
      // Compare local HEAD with the tracked upstream branch on GitHub.
      const repo = (await git(["rev-parse", "--is-inside-work-tree"])).stdout === "true";
      if (!repo) return sendJson(res, 200, { ok: false, error: "Not a git repository — updates are unavailable." });
      const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout || "main";
      const fetched = await git(["fetch", "origin", branch, "--quiet"]);
      if (!fetched.ok) return sendJson(res, 200, { ok: false, error: `git fetch failed: ${fetched.stderr || "no network / no remote"}` });
      const upstream = `origin/${branch}`;
      const local = (await git(["rev-parse", "HEAD"])).stdout;
      const remote = (await git(["rev-parse", upstream])).stdout;
      const behind = Number((await git(["rev-list", "--count", `HEAD..${upstream}`])).stdout) || 0;
      const ahead = Number((await git(["rev-list", "--count", `${upstream}..HEAD`])).stdout) || 0;
      const log = behind > 0 ? (await git(["log", "--no-merges", "--pretty=%h %s", `HEAD..${upstream}`])).stdout : "";
      const dirty = Boolean((await git(["status", "--porcelain"])).stdout);
      return sendJson(res, 200, {
        ok: true,
        branch,
        local: local.slice(0, 7),
        remote: remote.slice(0, 7),
        behind,
        ahead,
        updateAvailable: behind > 0,
        commits: log ? log.split("\n").filter(Boolean) : [],
        dirty,
      });
    }

    if (method === "POST" && pathname === "/api/update/apply") {
      // Fast-forward only. Never touches untracked/gitignored files (rooms/ chats,
      // per-run settings), so chats and settings always survive an update.
      const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout || "main";
      const fetched = await git(["fetch", "origin", branch, "--quiet"]);
      if (!fetched.ok) return sendJson(res, 200, { ok: false, error: `git fetch failed: ${fetched.stderr || "no network / no remote"}` });
      const merged = await git(["merge", "--ff-only", `origin/${branch}`]);
      if (!merged.ok) {
        return sendJson(res, 200, {
          ok: false,
          error: `Fast-forward update failed (local changes diverged): ${merged.stderr || merged.stdout}`.trim(),
        });
      }
      const head = (await git(["rev-parse", "--short", "HEAD"])).stdout;
      return sendJson(res, 200, { ok: true, head, restartRequired: true });
    }

    if (method === "GET") return serveStatic(req, res);
    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message });
  }
}

// Rehydrate the in-memory state.settings (what the UI reads) from the run's
// persisted settings (what rounds read) whenever a run is activated. Without
// this the two diverge after a restart: state.settings falls back to code
// defaults (e.g. mode "auto") while run.settings keeps the on-disk value
// (e.g. "manual") — the UI then shows auto but rounds use manual.
function applyRunSettings(run) {
  if (!run?.settings) return;
  for (const [key, value] of Object.entries(run.settings)) {
    if (value !== undefined) state.settings[key] = value;
  }
  // Agent selection is strictly per-chat: mirror it exactly (clearing it when the
  // chat has none), so a fresh/blank chat never shows the previous chat's agents.
  state.settings.participants = run.settings.participants || null;
  // Migrate subscriptions from run settings into global-settings.json so they
  // survive a server restart even when no run is active.
  if (run.settings.subscriptions && typeof run.settings.subscriptions === "object") {
    const curGs = store.readJson(GLOBAL_SETTINGS_PATH) || {};
    const merged = { ...curGs.subscriptions, ...run.settings.subscriptions };
    store.writeJson(GLOBAL_SETTINGS_PATH, { ...curGs, subscriptions: merged });
  }
}

// Phase 6b+: a server restart intentionally lands on a CLEAN start screen — no
// chat selected, empty fields, no agents — so every session begins fresh for a
// new task. The chat list stays available in the sidebar (publicState always
// returns `runs`), so the user can return to a previous session by picking it
// from "Chats". Kept as a function in case we later add an opt-in "resume last
// chat" setting; it is deliberately NOT invoked on startup anymore.
function selectLastRunOnStartup() {
  const runs = listRuns(); // sorted ascending by createdAt
  if (!runs.length) return;
  const last = runs[runs.length - 1];
  state.run = last;
  state.activeRunId = last.id;
  applyRunSettings(last);
}

// Intentionally NOT called — clean start screen on every server start (see above).
void selectLastRunOnStartup;

// Load globally-persisted profiles and subscriptions (saved independently of any run).
{
  const gs = store.readJson(GLOBAL_SETTINGS_PATH) || {};
  if (Array.isArray(gs.profiles)) state.settings.profiles = gs.profiles;
  if (gs.subscriptions && typeof gs.subscriptions === "object") state.settings.subscriptions = gs.subscriptions;
}

// Background update check on every server start — result broadcast via SSE.
async function checkUpdateOnStartup() {
  try {
    const repo = (await git(["rev-parse", "--is-inside-work-tree"])).stdout === "true";
    if (!repo) return;
    const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout || "main";
    const fetched = await git(["fetch", "origin", branch, "--quiet"]);
    if (!fetched.ok) return;
    const behind = Number((await git(["rev-list", "--count", `HEAD..origin/${branch}`])).stdout) || 0;
    state.updateStatus = { checked: true, updateAvailable: behind > 0 };
    broadcast();
  } catch {}
}
checkUpdateOnStartup();

// Poll the switch-module gateway so the UI reflects profiles/active/tokens live.
refreshSwitcher().then(broadcast);
setInterval(() => { refreshSwitcher().then(broadcast); }, 15000).unref();

const server = http.createServer(router);
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`\n[Council Room v2] Port ${PORT} is already in use — an old instance is probably running.`);
    console.error(`Close it and restart via "Council Room v2.bat" (it frees the port), or: taskkill /F /PID <pid from netstat -ano | findstr :${PORT}>.`);
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
