// Self-test for lib/providers.js — spins a local mock that emulates an
// OpenAI-compatible /v1/chat/completions endpoint (streaming and non-streaming)
// so the adapter is exercised end-to-end with no network, no API keys, no
// subscriptions. Run: node test/providers.test.js  (or: npm test)
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert");
const os = require("node:os");
const fs = require("node:fs");

const providers = require(path.resolve(__dirname, "../lib/providers.js"));

let lastRequest = null;

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const parsed = JSON.parse(body);
    lastRequest = { url: req.url, auth: req.headers.authorization || "", apiKeyHeader: req.headers["x-api-key"] || "", body: parsed };
    if (req.url === "/slow/chat/completions") {
      return; // never respond -> exercises timeout/abort; keep socket open
    }
    if (req.headers.authorization === "Bearer sk-exhausted") { // simulate a quota-blocked key
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "rate-limited" } }));
      return;
    }
    if (req.url.endsWith("/messages")) { // native Anthropic Messages shape
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content: [{ type: "text", text: "Hello world" }], usage: { input_tokens: 8, cache_read_input_tokens: 10, cache_creation_input_tokens: 2, output_tokens: 5 } }));
      return;
    }
    if (parsed.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const piece of ["Hel", "lo ", "wor", "ld"]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      }
      // Final usage-only chunk (OpenAI-compatible stream_options.include_usage).
      res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 } })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "Hello world" } }], usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 } }));
    }
  });
});

function run() {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      const port = server.address().port;
      const base = `http://127.0.0.1:${port}`;
      try {
        // --- non-streaming ---
        const p1 = { id: "t1", provider: "openai-compatible", model: "mock-1", baseUrl: base, credentialRef: "SELFTEST_KEY" };
        process.env.SELFTEST_KEY = "sk-test-123";
        const r1 = await providers.runProfile(p1, "ping");
        assert.strictEqual(r1.ok, true, "non-stream ok");
        assert.strictEqual(r1.text, "Hello world", "non-stream text");
        assert.deepStrictEqual(r1.result.usage, { promptTokens: 11, completionTokens: 3, totalTokens: 14 }, "non-stream usage surfaced");
        assert.strictEqual(lastRequest.auth, "Bearer sk-test-123", "auth header from env");
        assert.strictEqual(lastRequest.body.model, "mock-1", "model in body");
        assert.strictEqual(lastRequest.body.messages[0].content, "ping", "prompt as user message");
        console.log("PASS non-streaming + auth header from credentialRef");

        // --- streaming ---
        let streamed = "";
        const r2 = await providers.runProfile(p1, "ping", { onStream: (c) => { streamed += c; } });
        assert.strictEqual(r2.ok, true, "stream ok");
        assert.strictEqual(r2.text, "Hello world", "stream accumulated text");
        assert.strictEqual(streamed, "Hello world", "onStream received all chunks");
        assert.strictEqual(lastRequest.body.stream, true, "stream flag sent");
        assert.deepStrictEqual(lastRequest.body.stream_options, { include_usage: true }, "stream_options requests usage");
        assert.deepStrictEqual(r2.result.usage, { promptTokens: 7, completionTokens: 2, totalTokens: 9 }, "stream usage from final chunk");
        console.log("PASS streaming + onStream chunks + usage");

        // --- missing API key for a key-required provider ---
        const p2 = { id: "t2", provider: "openai-compatible", model: "mock-1", baseUrl: base, credentialRef: "DEFINITELY_UNSET_KEY" };
        const r3 = await providers.runProfile(p2, "ping");
        assert.strictEqual(r3.ok, false, "missing key -> not ok");
        assert.ok(/API key missing/.test(r3.text), "missing key message");
        console.log("PASS missing API key rejected before request");

        // --- ollama type needs no key ---
        const p3 = { id: "t3", provider: "ollama", model: "mock-1", baseUrl: base };
        const r4 = await providers.runProfile(p3, "ping");
        assert.strictEqual(r4.ok, true, "ollama keyless ok");
        assert.strictEqual(lastRequest.auth, "", "no auth header when keyless");
        console.log("PASS ollama keyless (no Authorization header)");

        // --- user abort ---
        const ac = new AbortController();
        const slow = { id: "t4", provider: "ollama", model: "mock-1", baseUrl: `${base}/slow` };
        const promise = providers.runProfile(slow, "ping", { signal: ac.signal });
        setTimeout(() => ac.abort(), 100);
        const r5 = await promise;
        assert.strictEqual(r5.ok, false, "aborted -> not ok");
        assert.strictEqual(r5.aborted, true, "aborted flag set");
        console.log("PASS user abort (aborted flag, distinct from timeout)");

        // --- timeout ---
        const r6 = await providers.runProfile(slow, "ping", { timeoutMs: 150 });
        assert.strictEqual(r6.ok, false, "timeout -> not ok");
        assert.strictEqual(r6.aborted, false, "timeout is not a user abort");
        console.log("PASS timeout (not flagged as user abort)");

        // --- presets / mode sanity ---
        assert.ok(providers.presets().some((p) => p.id === "deepseek"), "deepseek preset present");
        assert.ok(providers.presets().some((p) => p.id === "ollama" && p.needsKey === false), "ollama preset keyless");
        assert.strictEqual(providers.mode(), "full", "default mode full");
        assert.ok(providers.presets().some((p) => p.id === "anthropic"), "anthropic preset present");
        assert.ok(providers.providerTypes().includes("anthropic"), "anthropic provider type registered");
        assert.ok(providers.debatePresets().some((d) => d.preset === "anthropic"), "anthropic in debate presets");
        console.log("PASS presets + default mode=full");

        // --- anthropic native adapter: /messages shape, cache split, usage ---
        process.env.ANTHROPIC_SELFTEST = "sk-ant-xyz";
        const pa = { id: "ta", provider: "anthropic", model: "claude-mock", baseUrl: base, credentialRef: "ANTHROPIC_SELFTEST" };
        const ra = await providers.runProfile(pa, "head\n=== KNOWLEDGE BASE ===\ntail");
        assert.strictEqual(ra.ok, true, "anthropic ok");
        assert.strictEqual(ra.text, "Hello world", "anthropic text from content blocks");
        assert.strictEqual(lastRequest.url, "/messages", "posts to /messages");
        assert.strictEqual(lastRequest.apiKeyHeader, "sk-ant-xyz", "x-api-key from env (not Bearer)");
        assert.ok(lastRequest.body.system && lastRequest.body.system[0].cache_control.type === "ephemeral", "stable head sent as cached system block");
        assert.strictEqual(lastRequest.body.system[0].text, "head", "head -> system");
        assert.strictEqual(lastRequest.body.messages[0].content, "=== KNOWLEDGE BASE ===\ntail", "variable tail -> user message");
        assert.deepStrictEqual(ra.result.usage, { promptTokens: 20, completionTokens: 5, totalTokens: 25 }, "anthropic usage = fresh+cache_read+cache_creation inputs");
        delete process.env.ANTHROPIC_SELFTEST;
        console.log("PASS anthropic native adapter (cache split + usage)");

        // --- OpenRouter account-failover key pool ---
        const pool = { id: "pool", provider: "openrouter", model: "mock-1", baseUrl: base };
        const rpool = await providers.runProfile(pool, "ping", {
          keyPool: [{ ref: "OR_K1", apiKey: "sk-exhausted" }, { ref: "OR_K2", apiKey: "sk-good" }],
        });
        assert.strictEqual(rpool.ok, true, "pool fell over to a working key");
        assert.strictEqual(rpool.result.usedRef, "OR_K2", "usedRef = the key that served (after K1 429)");
        assert.strictEqual(rpool.text, "Hello world", "pool returned the answer");
        // non-429 error must NOT burn the whole pool: bad model on first key stops early.
        const rpoolStop = await providers.runProfile(pool, "ping", {
          keyPool: [{ ref: "OR_K2", apiKey: "sk-good" }, { ref: "OR_K3", apiKey: "sk-exhausted" }],
        });
        assert.strictEqual(rpoolStop.result.usedRef, "OR_K2", "first key succeeds → no needless failover");
        console.log("PASS openrouter account-failover key pool");

        // --- usage store: accumulate, summarize, reset ---
        const usage = require(path.resolve(__dirname, "../lib/usage.js"));
        const tmp = path.join(os.tmpdir(), `cr2-usage-${process.pid}-${Date.now()}`);
        const prof = { id: "deepseek-main", label: "DeepSeek", provider: "deepseek" };
        usage.record(tmp, prof, { promptTokens: 11, completionTokens: 3, totalTokens: 14 });
        usage.record(tmp, prof, { promptTokens: 7, completionTokens: 2, totalTokens: 9 });
        usage.record(tmp, prof, null); // no-data call must not bump the counter
        let sum = usage.summary(tmp);
        assert.strictEqual(sum["deepseek-main"].inputTokens, 18, "input accumulates");
        assert.strictEqual(sum["deepseek-main"].outputTokens, 5, "output accumulates");
        assert.strictEqual(sum["deepseek-main"].totalTokens, 23, "total accumulates");
        assert.strictEqual(sum["deepseek-main"].requests, 2, "null usage not counted");
        usage.reset(tmp, "deepseek-main");
        assert.strictEqual(Object.keys(usage.summary(tmp)).length, 0, "reset clears profile");
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
        console.log("PASS usage store accumulate/summary/reset");

        // --- env.setEnvVar: write/replace a .env line + live process.env ---
        const envmod = require(path.resolve(__dirname, "../lib/env.js"));
        const etmp = path.join(os.tmpdir(), `cr2-env-${process.pid}-${Date.now()}`);
        fs.mkdirSync(etmp, { recursive: true });
        envmod.setEnvVar(etmp, "CR2_SELFTEST_KEY", "sk-first");
        assert.strictEqual(process.env.CR2_SELFTEST_KEY, "sk-first", "process.env set live");
        assert.ok(fs.readFileSync(path.join(etmp, ".env"), "utf8").includes("CR2_SELFTEST_KEY=sk-first"), "key written to .env");
        envmod.setEnvVar(etmp, "CR2_SELFTEST_KEY", "sk-second");
        const envBody = fs.readFileSync(path.join(etmp, ".env"), "utf8");
        assert.ok(envBody.includes("CR2_SELFTEST_KEY=sk-second"), "key replaced");
        assert.ok(!envBody.includes("sk-first"), "old value gone (replaced, not appended)");
        assert.throws(() => envmod.setEnvVar(etmp, "1bad name", "x"), /invalid env var name/, "rejects bad var name");
        try { fs.rmSync(etmp, { recursive: true, force: true }); } catch {}
        delete process.env.CR2_SELFTEST_KEY;
        console.log("PASS env.setEnvVar write/replace/validate");

        // --- validated-keys store: persist + fingerprint-pinned invalidation ---
        const validated = require(path.resolve(__dirname, "../lib/validated.js"));
        const vtmp = path.join(os.tmpdir(), `cr2-val-${process.pid}-${Date.now()}`);
        validated.markValidated(vtmp, "DEEPSEEK_API_KEY", "sk-aaa");
        validated.markValidated(vtmp, "OPENAI_API_KEY", "sk-bbb");
        // env still matches → both verified.
        let set = validated.validatedSet(vtmp, (r) => ({ DEEPSEEK_API_KEY: "sk-aaa", OPENAI_API_KEY: "sk-bbb" }[r]));
        assert.ok(set.has("DEEPSEEK_API_KEY") && set.has("OPENAI_API_KEY"), "both verified when values unchanged");
        // DEEPSEEK key changed → its fingerprint no longer matches → dropped.
        set = validated.validatedSet(vtmp, (r) => ({ DEEPSEEK_API_KEY: "sk-CHANGED", OPENAI_API_KEY: "sk-bbb" }[r]));
        assert.ok(!set.has("DEEPSEEK_API_KEY"), "changed key auto-invalidated");
        assert.ok(set.has("OPENAI_API_KEY"), "unchanged key stays verified");
        validated.clearValidated(vtmp, "OPENAI_API_KEY");
        set = validated.validatedSet(vtmp, () => "sk-bbb");
        assert.ok(!set.has("OPENAI_API_KEY"), "clearValidated removes the ref");
        try { fs.rmSync(vtmp, { recursive: true, force: true }); } catch {}
        console.log("PASS validated-keys persist + fingerprint invalidation");

        console.log("\nALL PROVIDER SELF-TESTS PASSED");
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

run().catch((err) => { console.error("SELFTEST FAILED:", err.message); process.exit(1); });
