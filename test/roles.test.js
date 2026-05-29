// Tests for lib/profiles.js (effectiveConfig / derivation / CRUD) and lib/roles.js
// (failover chain, manual mode, abort, verify override). The role chain logic is
// tested with an injected fake runner so no CLI is spawned; the network dispatch
// is exercised against a local mock /v1/chat/completions. Run: node test/roles.test.js
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert");

const profiles = require(path.resolve(__dirname, "../lib/profiles.js"));
const roles = require(path.resolve(__dirname, "../lib/roles.js"));

function chainIds(role) { return role.chain.map((p) => p.id); }

function testProfiles() {
  // --- legacy derivation: default acc1, auto, connected, acc2 available -> failover chain
  let eff = profiles.effectiveConfig(
    { codexMode: "auto", codexAccount: 1, claudeMode: "auto", claudeAccount: 1 },
    { connected: true, codexAcc2: true, claudeAcc2: true },
  );
  assert.deepStrictEqual(chainIds(eff.roles.a), ["codex-acc1", "codex-acc2"], "A: acc1 then failover acc2");
  assert.deepStrictEqual(chainIds(eff.roles.b), ["claude-acc1", "claude-acc2"], "B: acc1 then failover acc2");
  assert.strictEqual(eff.roles.a.slot, "codex", "role A drives slot codex");
  assert.strictEqual(eff.roles.b.slot, "claude", "role B drives slot claude");
  assert.strictEqual(eff.roles.a.label, "Codex");
  assert.strictEqual(eff.roles.b.label, "Claude Code");
  console.log("PASS legacy derive: default auto chains with failover");

  // --- manual mode: no failover
  eff = profiles.effectiveConfig({ codexMode: "manual", codexAccount: 1 }, { connected: true, codexAcc2: true });
  assert.deepStrictEqual(chainIds(eff.roles.a), ["codex-acc1"], "manual: single profile, no failover");
  console.log("PASS legacy derive: manual = no failover");

  // --- not connected: no failover even in auto
  eff = profiles.effectiveConfig({ codexMode: "auto", codexAccount: 1 }, { connected: false, codexAcc2: true });
  assert.deepStrictEqual(chainIds(eff.roles.a), ["codex-acc1"], "disconnected: no failover");
  console.log("PASS legacy derive: disconnected = no failover");

  // --- want acc2 and available: acc2 primary, acc1 failover
  eff = profiles.effectiveConfig({ codexMode: "auto", codexAccount: 2 }, { connected: true, codexAcc2: true });
  assert.deepStrictEqual(chainIds(eff.roles.a), ["codex-acc2", "codex-acc1"], "acc2 primary then acc1");
  console.log("PASS legacy derive: acc2 primary with acc1 failover");

  // --- want acc2 but unavailable: falls back to acc1 primary
  eff = profiles.effectiveConfig({ codexMode: "auto", codexAccount: 2 }, { connected: true, codexAcc2: false });
  assert.deepStrictEqual(chainIds(eff.roles.a), ["codex-acc1"], "acc2 unavailable -> acc1, no acc2 in chain");
  console.log("PASS legacy derive: acc2 unavailable falls back to acc1");

  // --- verify override carried on derived roles
  assert.deepStrictEqual(eff.roles.a.verify, { model: "gpt-5.5", effort: "xhigh" }, "A verify override");
  console.log("PASS legacy derive: verify override present");

  // --- explicit config passthrough
  const explicit = {
    profiles: [
      { id: "ds", label: "DeepSeek", provider: "deepseek", model: "deepseek-chat" },
      { id: "ol", label: "Ollama", provider: "ollama", model: "llama3" },
    ],
    roles: {
      a: { slot: "codex", label: "DeepSeek", mode: "manual", profileIds: ["ds"] },
      b: { slot: "claude", label: "Local", mode: "auto", profileIds: ["ol", "ds"] },
    },
  };
  assert.strictEqual(profiles.hasExplicitConfig(explicit), true);
  eff = profiles.effectiveConfig(explicit, {});
  assert.deepStrictEqual(chainIds(eff.roles.a), ["ds"]);
  assert.deepStrictEqual(chainIds(eff.roles.b), ["ol", "ds"]);
  assert.strictEqual(eff.roles.a.verify, null, "no verify override unless set");
  console.log("PASS explicit config passthrough");

  // --- CRUD
  const s = {};
  profiles.upsertProfile(s, { id: "ds", provider: "deepseek", model: "deepseek-chat" });
  assert.strictEqual(s.profiles.length, 1);
  profiles.upsertProfile(s, { id: "ds", provider: "deepseek", model: "deepseek-reasoner" });
  assert.strictEqual(s.profiles.length, 1, "upsert replaces, not duplicates");
  assert.strictEqual(s.profiles[0].model, "deepseek-reasoner");
  profiles.setRole(s, "a", { profileIds: ["ds"], mode: "manual" });
  assert.strictEqual(s.roles.a.slot, "codex", "role a fixed to slot codex");
  profiles.removeProfile(s, "ds");
  assert.strictEqual(s.profiles.length, 0);
  assert.deepStrictEqual(s.roles.a.profileIds, [], "removeProfile drops id from role chains");
  assert.throws(() => profiles.upsertProfile(s, { id: "x", provider: "openai-compatible" }), /model required/, "network needs model");
  assert.throws(() => profiles.upsertProfile(s, { id: "y", provider: "cli-codex" }), /account/, "CLI needs account");
  console.log("PASS profiles CRUD + validation");
}

async function testRoleFailover() {
  const A = { id: "A", provider: "ollama", model: "m" };
  const B = { id: "B", provider: "ollama", model: "m" };
  const calls = [];
  // fake runner: succeed only for the profile id in `okSet`
  const fake = (okSet) => (profile, prompt, opts) => {
    calls.push({ id: profile.id, model: opts.model, effort: opts.effort });
    if (profile.id === "ABORT") return Promise.resolve({ ok: false, aborted: true, text: "aborted", result: {} });
    return Promise.resolve({ ok: okSet.has(profile.id), aborted: false, text: profile.id, result: {} });
  };

  // auto: first fails -> failover to second
  calls.length = 0;
  let failovers = 0;
  let r = await roles.runRole(
    { label: "R", mode: "auto", chain: [A, B], verify: null },
    "p",
    { onFailover: () => { failovers += 1; } },
    { runProfile: fake(new Set(["B"])) },
  );
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.profile.id, "B", "answered by failover profile");
  assert.strictEqual(failovers, 1, "onFailover fired once");
  assert.deepStrictEqual(r.attempts.map((a) => a.profileId), ["A", "B"]);
  console.log("PASS runRole auto: failover to second profile");

  // manual: never fails over
  calls.length = 0;
  r = await roles.runRole(
    { label: "R", mode: "manual", chain: [A, B], verify: null },
    "p", {}, { runProfile: fake(new Set(["B"])) },
  );
  assert.strictEqual(r.ok, false, "manual stops at first");
  assert.deepStrictEqual(r.attempts.map((a) => a.profileId), ["A"], "manual tried only first");
  console.log("PASS runRole manual: no failover");

  // abort: no failover
  r = await roles.runRole(
    { label: "R", mode: "auto", chain: [{ id: "ABORT", provider: "ollama", model: "m" }, B], verify: null },
    "p", {}, { runProfile: fake(new Set(["B"])) },
  );
  assert.strictEqual(r.aborted, true, "aborted bubbles up");
  assert.strictEqual(r.attempts.length, 1, "no failover after abort");
  console.log("PASS runRole: no failover on user abort");

  // verify override reaches the runner; normal round does NOT
  calls.length = 0;
  await roles.runRole(
    { label: "R", mode: "manual", chain: [A], verify: { model: "verify-model", effort: "max" } },
    "p", {}, { runProfile: fake(new Set(["A"])) },
  );
  assert.strictEqual(calls[0].model, undefined, "normal round: no model override (profile decides)");
  calls.length = 0;
  await roles.runRole(
    { label: "R", mode: "manual", chain: [A], verify: { model: "verify-model", effort: "max" } },
    "p", { verify: { model: "verify-model", effort: "max" } }, { runProfile: fake(new Set(["A"])) },
  );
  assert.strictEqual(calls[0].model, "verify-model", "verify mode: model overridden");
  assert.strictEqual(calls[0].effort, "max", "verify mode: effort overridden");
  console.log("PASS runRole: verify override only when caller asks");

  // empty chain
  r = await roles.runRole({ label: "R", mode: "auto", chain: [] }, "p", {}, {});
  assert.strictEqual(r.ok, false);
  assert.ok(/no profile configured/.test(r.text));
  console.log("PASS runRole: empty chain handled");
}

async function testNetworkDispatch() {
  const server = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "ok-from-network" } }] }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const profile = { id: "n", provider: "ollama", model: "m", baseUrl: `http://127.0.0.1:${port}/v1` };
    const r = await roles.runProfile(profile, "hi");
    assert.strictEqual(r.ok, true, "network profile runs via providers");
    assert.strictEqual(r.text, "ok-from-network");
    console.log("PASS roles.runProfile dispatches network provider");

    // CLI provider disabled in api build
    const prev = process.env.PROVIDERS_MODE;
    process.env.PROVIDERS_MODE = "api";
    const r2 = await roles.runProfile({ id: "c", provider: "cli-codex", account: "acc1" }, "hi");
    process.env.PROVIDERS_MODE = prev;
    assert.strictEqual(r2.ok, false, "CLI disabled in api build");
    assert.ok(/disabled in the API build/.test(r2.text));
    console.log("PASS roles.runProfile blocks CLI provider in api build");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

(async () => {
  try {
    testProfiles();
    await testRoleFailover();
    await testNetworkDispatch();
    console.log("\nALL PROFILES/ROLES TESTS PASSED");
  } catch (err) {
    console.error("TEST FAILED:", err.stack || err.message);
    process.exit(1);
  }
})();
