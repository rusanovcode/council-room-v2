// End-to-end test of the REAL runRound through the new role/provider path.
// Boots server.js in a child process with PROVIDERS_MODE=api (so the legacy CLI
// path is off and both debate slots must go through the network provider), points
// both roles at a local mock OpenAI-compatible backend, runs an actual round over
// HTTP, and asserts it completed via the mock. No subscriptions, no real CLI.
// Run: node test/round.integration.test.js
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

// Mock backend: emulates /v1/chat/completions streaming (runRound always streams).
function startMock() {
  return new Promise((resolve) => {
    let hits = 0;
    const srv = http.createServer((req, res) => {
      let body = ""; req.on("data", (c) => { body += c; });
      req.on("end", () => {
        hits += 1;
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        const reply = "Mock analysis of the question.\nNew facts:\n- mock fact one\nStatus: resolve";
        for (const piece of [reply.slice(0, 20), reply.slice(20)]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/v1`, hits: () => hits }));
  });
}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: ROOT,
      env: { ...process.env, COUNCIL_ROOM_V2_PORT: String(port), PROVIDERS_MODE: "api" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const onData = (c) => { out += c; if (/listening on/.test(out)) resolve(child); };
    child.stdout.on("data", onData);
    child.stderr.on("data", (c) => { out += c; });
    child.on("exit", (code) => reject(new Error(`server exited early (${code}):\n${out}`)));
    setTimeout(() => reject(new Error(`server did not start in time:\n${out}`)), 8000);
  });
}

async function api(port, method, p, body) {
  const res = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, json: null, text }; }
}

async function waitForRound(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { json } = await api(port, "GET", "/api/state");
    if (json && json.status === "idle" && json.run && json.run.rounds >= 1) return json;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("round did not complete in time");
}

(async () => {
  const mock = await startMock();
  const port = await freePort();
  let child;
  const createdRunIds = [];
  try {
    child = await startServer(port);

    // New run (becomes active).
    let r = await api(port, "POST", "/api/runs", { topic: "phase5-itest" });
    assert.strictEqual(r.status, 200, "create run");
    let createdRunId = r.json.activeRunId;
    assert.ok(createdRunId, "have active run id");
    createdRunIds.push(createdRunId);

    // Seed explicit profiles/roles pointing both slots at the mock (writes run.settings).
    const profilesBody = {
      profiles: [
        { id: "mockA", label: "Mock A", provider: "ollama", model: "mock-model", baseUrl: mock.base },
        { id: "mockB", label: "Mock B", provider: "ollama", model: "mock-model", baseUrl: mock.base },
      ],
      roles: {
        a: { slot: "codex", label: "Mock A", mode: "manual", profileIds: ["mockA"] },
        b: { slot: "claude", label: "Mock B", mode: "manual", profileIds: ["mockB"] },
      },
    };
    r = await api(port, "POST", "/api/settings", profilesBody);
    assert.strictEqual(r.status, 200, "seed settings");

    // Open a subtask, then run a real round.
    r = await api(port, "POST", "/api/subtasks/open", { title: "integration subtask", mode: "LIGHT" });
    assert.strictEqual(r.status, 200, "open subtask");

    r = await api(port, "POST", "/api/round", {});
    assert.strictEqual(r.status, 202, "round accepted");

    const state = await waitForRound(port);
    assert.strictEqual(state.run.rounds, 1, "rounds incremented to 1");

    const msgs = state.run.messages || [];
    const agentMsgs = msgs.filter((m) => m.role === "agent" && m.kind === "debate");
    assert.strictEqual(agentMsgs.length, 2, "two agent debate messages");
    assert.ok(agentMsgs.every((m) => /Mock analysis/.test(m.text)), "agent text came from the mock backend");

    const backends = msgs.find((m) => /Round backends/.test(m.text || ""));
    assert.ok(backends && /Mock A/.test(backends.text), "backends trace names the mock role");

    assert.ok(mock.hits() >= 2, `mock received both slot requests (got ${mock.hits()})`);
    console.log("PASS real runRound executed both slots via the mock network backend");

    // --- Phase 6: a fresh run with THREE participants (the N-agent path). ---
    const hitsBefore = mock.hits();
    r = await api(port, "POST", "/api/runs", { topic: "phase6-3agents" });
    assert.strictEqual(r.status, 200, "create 3-agent run");
    const runId3 = r.json.activeRunId;
    createdRunIds.push(runId3);

    const partBody = {
      profiles: [
        { id: "m1", label: "M1", provider: "ollama", model: "mock-model", baseUrl: mock.base },
        { id: "m2", label: "M2", provider: "ollama", model: "mock-model", baseUrl: mock.base },
        { id: "m3", label: "M3", provider: "ollama", model: "mock-model", baseUrl: mock.base },
      ],
      participants: [
        { key: "a1", label: "M1", mode: "manual", profileIds: ["m1"] },
        { key: "a2", label: "M2", mode: "manual", profileIds: ["m2"] },
        { key: "a3", label: "M3", mode: "manual", profileIds: ["m3"] },
      ],
    };
    r = await api(port, "POST", "/api/settings", partBody);
    assert.strictEqual(r.status, 200, "seed 3 participants");

    r = await api(port, "POST", "/api/subtasks/open", { title: "three-agent subtask", mode: "LIGHT" });
    assert.strictEqual(r.status, 200, "open subtask (3-agent run)");
    r = await api(port, "POST", "/api/round", {});
    assert.strictEqual(r.status, 202, "round accepted (3-agent run)");

    const state3 = await waitForRound(port);
    assert.strictEqual(state3.run.rounds, 1, "3-agent run rounds incremented");
    const agentMsgs3 = (state3.run.messages || []).filter((m) => m.role === "agent" && m.kind === "debate");
    assert.strictEqual(agentMsgs3.length, 3, "three agent debate messages (one per participant)");
    assert.deepStrictEqual(agentMsgs3.map((m) => m.slot), ["a1", "a2", "a3"], "messages carry participant slot keys");
    assert.ok(mock.hits() - hitsBefore >= 3, `mock received all three participant requests (got ${mock.hits() - hitsBefore})`);
    console.log("PASS real runRound executed three participants via the mock backend");

    console.log("\nROUND INTEGRATION TEST PASSED");
  } finally {
    if (child) child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 300));
    for (const id of createdRunIds) {
      try { fs.rmSync(path.join(ROOT, "rooms", id), { recursive: true, force: true }); } catch {}
    }
    mock.srv.close();
  }
})().catch((err) => { console.error("INTEGRATION TEST FAILED:", err.stack || err.message); process.exit(1); });
