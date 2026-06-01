// Single-agent Codex round: Codex (gpt-5.5, effort xhigh) answers Claude's Phase 11
// position. Reuses the app's own prompt builder / backend / tail parser so the
// result is identical to a real round, just with one participant (the API path
// requires >=2; here we want only Codex to reply to the existing Claude turn).
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const store = require(path.join(ROOT, "lib/store"));
const subtasks = require(path.join(ROOT, "lib/subtasks"));
const knowledge = require(path.join(ROOT, "lib/knowledge"));
const documents = require(path.join(ROOT, "lib/documents"));
const questions = require(path.join(ROOT, "lib/questions"));
const domains = require(path.join(ROOT, "lib/domains"));
const prompt = require(path.join(ROOT, "lib/prompt"));
const roles = require(path.join(ROOT, "lib/roles"));

const ID = "2026-05-22T15-33-40-262Z-создать-кор-игрового-агента-суть-изложена-в-файл";
const DIR = path.join(ROOT, "rooms", store.safeId(ID));
const TR = path.join(DIR, "transcript.jsonl");

(async () => {
  const run = store.readJson(path.join(DIR, "state.json"));
  const active = subtasks.activeSubtask(DIR);
  if (!active) throw new Error("no active subtask");
  const round = active.rounds + 1;
  const domain = domains.getProfile(run.settings?.discussionMode ?? "code");
  const language = run.settings?.language || "ru";

  // Claude's position (and any prior agent/user turns) as context.
  const msgs = store.readJsonl(TR);
  const recentTurns = msgs.filter((m) => m.subtaskId === active.id && (m.role === "agent" || m.role === "user") && !m.trashed).slice(-6);
  const openQs = questions.openForSubtask(DIR, active.id);

  const agentPrompt = prompt.buildDebatePrompt({
    agentName: "Codex",
    otherAgentNames: ["Claude Code"],
    language,
    subtask: active,
    kbSnapshot: knowledge.snapshotForPrompt(DIR, domain.sections),
    documentsSnapshot: documents.snapshotForPrompt(DIR),
    recentTurns,
    guidance: "",
    round,
    allowFilesystemScan: false,
    strictScope: Boolean(run.settings?.strictScope),
    openQuestions: openQs.map((q) => ({ id: q.id, text: q.text, priority: q.priority })),
    verify: null,
    deferredMinors: [],
    domain,
  });

  const role = {
    slot: "codex", label: "Codex", mode: "manual",
    chain: [{ id: "codex-acc2", provider: "cli-codex", account: "acc2", model: "gpt-5.5", effort: "xhigh" }],
  };

  console.error(`[codex-round] prompt ${agentPrompt.length} chars, model gpt-5.5 / xhigh, round ${round}. Running…`);
  const t0 = Date.now();
  const result = await roles.runRole(role, agentPrompt, {
    workdir: ROOT,
    isolated: true, // sandbox temp dir outside C:\AI
    outFile: path.join(DIR, `R${round}-${active.id}-codex.txt`),
    logFile: path.join(DIR, `R${round}-${active.id}-codex.log`),
  });
  console.error(`[codex-round] done in ${Math.round((Date.now() - t0) / 1000)}s ok=${result.ok}`);

  if (!result.ok) {
    console.error("[codex-round] FAILED — not appending. Output:\n" + String(result.text).slice(0, 1200));
    process.exit(2);
  }

  // Append Codex turn exactly like runRound's addMessage shape.
  const codexMsg = { id: store.makeId("msg"), at: store.now(), role: "agent", name: "Codex", kind: "debate", subtaskId: active.id, round, slot: "codex", text: String(result.text).trim() };
  store.appendJsonl(TR, codexMsg);

  // Route the machine tail (KB-patches / questions) like a normal round.
  const tail = prompt.parseAgentTail(result.text);
  for (const patch of tail.kbPatches || []) {
    if (patch.section === "open_questions") questions.addQuestion(DIR, active.id, patch.item, round);
    else { try { knowledge.addItem(DIR, patch.section, patch.item, domain.sections); } catch {} }
  }
  for (const r of tail.resolved || []) questions.recordResolve(DIR, r.id, "codex", r.answer, ["codex"]);
  subtasks.incrementRounds(DIR, active.id);

  console.error(`[codex-round] appended Codex round ${round}. Status tail: ${tail.status || "(none)"}`);
  console.log("\n================ CODEX (gpt-5.5 / xhigh) — round " + round + " ================\n");
  console.log(result.text);
})().catch((e) => { console.error("[codex-round] ERROR:", e); process.exit(1); });
