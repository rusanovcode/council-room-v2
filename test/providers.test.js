// Self-test for lib/providers.js — spins a local mock that emulates an
// OpenAI-compatible /v1/chat/completions endpoint (streaming and non-streaming)
// so the adapter is exercised end-to-end with no network, no API keys, no
// subscriptions. Run: node test/providers.test.js  (or: npm test)
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert");

const providers = require(path.resolve(__dirname, "../lib/providers.js"));

let lastRequest = null;

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const parsed = JSON.parse(body);
    lastRequest = { url: req.url, auth: req.headers.authorization || "", body: parsed };
    if (req.url === "/slow/chat/completions") {
      return; // never respond -> exercises timeout/abort; keep socket open
    }
    if (parsed.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const piece of ["Hel", "lo ", "wor", "ld"]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "Hello world" } }] }));
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
        console.log("PASS streaming + onStream chunks");

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
        console.log("PASS presets + default mode=full");

        console.log("\nALL PROVIDER SELF-TESTS PASSED");
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

run().catch((err) => { console.error("SELFTEST FAILED:", err.message); process.exit(1); });
