const fs = require("node:fs");
const path = require("node:path");
const { StringDecoder } = require("node:string_decoder");

// Phase 5: a single provider layer. Every "debater" — whether an API-key model,
// a local Ollama model, or (full build only) a subscription CLI — runs through the
// same contract:
//
//   runProfile(profile, prompt, opts) -> { ok, text, aborted, result }
//
// matching lib/cli.js (runCodex/runClaude) so roles can call any backend the same
// way. This file implements the network providers (openai-compatible + ollama);
// the CLI providers stay in lib/cli.js and are only wired in the "full" build.

const DEFAULT_TIMEOUT_MS = Number(process.env.COUNCIL_ROOM_V2_TIMEOUT_MS || 300000);

// Build mode. "full" keeps the subscription/OAuth path (Codex/Claude CLI +
// switcher) for the private local install; "api" is the public build — only
// API-key providers and local Ollama, no OAuth, no switcher. Default "full" so
// the existing install is unchanged; the public build sets PROVIDERS_MODE=api.
function mode() {
  return (process.env.PROVIDERS_MODE || "full").toLowerCase() === "api" ? "api" : "full";
}

// Known OpenAI-compatible endpoints. baseUrl has NO trailing /chat/completions
// (the adapter appends it). credentialRef = the name of the env var holding the
// API key — keys are never stored in the repo or state.json. Ollama needs no key.
const PRESETS = {
  anthropic:  { type: "anthropic",         label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", credentialRef: "ANTHROPIC_API_KEY" },
  openai:     { type: "openai-compatible", label: "OpenAI",        baseUrl: "https://api.openai.com/v1",     credentialRef: "OPENAI_API_KEY" },
  deepseek:   { type: "openai-compatible", label: "DeepSeek",      baseUrl: "https://api.deepseek.com/v1",    credentialRef: "DEEPSEEK_API_KEY" },
  groq:       { type: "openai-compatible", label: "Groq",          baseUrl: "https://api.groq.com/openai/v1", credentialRef: "GROQ_API_KEY" },
  openrouter: { type: "openai-compatible", label: "OpenRouter",    baseUrl: "https://openrouter.ai/api/v1",   credentialRef: "OPENROUTER_API_KEY" },
  mistral:    { type: "openai-compatible", label: "Mistral",       baseUrl: "https://api.mistral.ai/v1",      credentialRef: "MISTRAL_API_KEY" },
  together:   { type: "openai-compatible", label: "Together",      baseUrl: "https://api.together.xyz/v1",    credentialRef: "TOGETHER_API_KEY" },
  ollama:     { type: "ollama",            label: "Ollama (local)", baseUrl: "http://localhost:11434/v1",     credentialRef: "" },
};

// Cheap, ready-to-use defaults for the "minimal-token debate" use case (variant 3):
// a network backend skips the ~7k-token CLI agent harness entirely (~850 tokens/turn).
// The UI offers these as one-click debater presets. recommendedModel is just a hint;
// the user can override. Order = suggested preference (best economy/quality first).
const DEBATE_PRESETS = [
  { preset: "anthropic", recommendedModel: "claude-haiku-4-5",      note: "Claude via API + prompt caching" },
  { preset: "groq",      recommendedModel: "llama-3.3-70b-versatile", note: "very fast, very cheap" },
  { preset: "deepseek",  recommendedModel: "deepseek-chat",         note: "cheap, strong reasoning" },
];
function debatePresets() {
  return DEBATE_PRESETS.map((d) => {
    const p = PRESETS[d.preset] || {};
    return { preset: d.preset, type: p.type, label: p.label, baseUrl: p.baseUrl, credentialRef: p.credentialRef, needsKey: Boolean(p.credentialRef), recommendedModel: d.recommendedModel, note: d.note };
  });
}

function presets() {
  // Shape for the settings UI: pick a preset → baseUrl + credentialRef prefilled.
  return Object.entries(PRESETS).map(([id, p]) => ({ id, type: p.type, label: p.label, baseUrl: p.baseUrl, credentialRef: p.credentialRef, needsKey: Boolean(p.credentialRef) }));
}

// A profile is { id, label, provider, model, baseUrl?, credentialRef?, extraHeaders? }.
// `provider` is either a preset id (e.g. "deepseek") or a raw type ("openai-compatible"
// / "ollama") with an explicit baseUrl. Resolve to a concrete call config and pull
// the API key from the environment (never persisted).
function resolveProfile(profile = {}) {
  const preset = PRESETS[profile.provider] || null;
  const type = preset ? preset.type : profile.provider;
  const baseUrl = profile.baseUrl || (preset && preset.baseUrl) || "";
  const credentialRef = profile.credentialRef || (preset && preset.credentialRef) || "";
  const apiKey = credentialRef ? (process.env[credentialRef] || "") : "";
  return {
    type,
    baseUrl,
    credentialRef,
    apiKey,
    model: profile.model || "",
    // Ordered fallback models (OpenRouter only): if the primary 429s/errors,
    // OpenRouter's `models` routing tries the next one automatically.
    fallbackModels: Array.isArray(profile.fallbackModels) ? profile.fallbackModels.filter(Boolean) : [],
    label: profile.label || (preset && preset.label) || type || "provider",
    extraHeaders: profile.extraHeaders || {},
  };
}

// Whether the profile's API key is present in the environment (for UI status
// without ever exposing the key itself). Keyless providers (Ollama) are "ready".
function credentialPresent(profile = {}) {
  const cfg = resolveProfile(profile);
  if (!cfg.credentialRef) return true;
  return Boolean(cfg.apiKey);
}

// OpenAI-compatible usage block → a uniform { promptTokens, completionTokens,
// totalTokens }. Returns null when the provider sent no usage (e.g. Ollama or a
// stream without include_usage support) so callers can tell "no data" apart from 0.
function normalizeUsage(u) {
  if (!u || typeof u !== "object") return null;
  const prompt = Number(u.prompt_tokens || 0);
  const completion = Number(u.completion_tokens || 0);
  const total = Number(u.total_tokens || prompt + completion);
  if (!prompt && !completion && !total) return null;
  return { promptTokens: prompt, completionTokens: completion, totalTokens: total };
}

function logResult(logFile, label, req, result) {
  if (!logFile) return;
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, [
      `provider: ${label}`, `url: ${req.url}`, `model: ${req.model}`, `stream: ${req.stream}`,
      `ok: ${result.ok}`, `status: ${result.result.status ?? ""}`, `durationMs: ${result.result.durationMs}`,
      "", "OUTPUT:", result.text,
    ].join("\n"), "utf8");
  } catch {}
}

// Shared OpenAI-compatible chat call. Ollama exposes the same /v1 surface, so both
// provider types route through here; only the resolved baseUrl/key differ.
async function chatCompletion(prompt, opts = {}) {
  const startedAt = Date.now();
  const label = opts.label || "provider";
  const baseUrl = String(opts.baseUrl || "").replace(/\/+$/, "");
  const model = opts.model || "";
  const fail = (msg, extra = {}) => {
    const r = { ok: false, aborted: Boolean(extra.aborted), text: msg, result: { durationMs: Date.now() - startedAt, ...extra } };
    logResult(opts.logFile, label, { url: `${baseUrl}/chat/completions`, model, stream: false }, r);
    return r;
  };
  if (!baseUrl) return fail(`${label}: no baseUrl configured`);
  if (!model) return fail(`${label}: no model configured`);
  if (opts.credentialRequired && !opts.apiKey) return fail(`${label}: API key missing (set ${opts.credentialRef || "the API key env var"})`);

  const url = `${baseUrl}/chat/completions`;
  const headers = { "Content-Type": "application/json", ...(opts.extraHeaders || {}) };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  const stream = typeof opts.onStream === "function";
  const body = { model, messages: [{ role: "user", content: prompt }], stream };
  // Automatic failover: OpenRouter accepts a `models` list and routes to the next
  // one when the primary is rate-limited (429) or errors — server-side, one call.
  // Only sent to OpenRouter (other OpenAI-compatible APIs would reject the field).
  if (Array.isArray(opts.fallbackModels) && opts.fallbackModels.length && /openrouter\.ai/i.test(baseUrl)) {
    body.models = [model, ...opts.fallbackModels];
    body.route = "fallback";
  }
  // Ask for the usage block on the final stream chunk too (OpenAI-compatible).
  // Providers that don't support it just ignore the field; we treat missing
  // usage as "no spend data" rather than an error.
  if (stream) body.stream_options = { include_usage: true };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.maxTokens === "number") body.max_tokens = opts.maxTokens;
  // Reasoning effort is CLI-shaped ("auto" = don't send). Only forward a real value;
  // providers that don't support it ignore the field.
  if (opts.effort && opts.effort !== "auto") body.reasoning_effort = opts.effort;

  // Our own timeout, combined with any caller-supplied abort signal. We track the
  // user signal separately so we can distinguish a user Stop from a timeout.
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const userSignal = opts.signal;
  if (userSignal && userSignal.aborted) return fail("aborted", { aborted: true });
  const signal = AbortSignal.any([
    ...(userSignal ? [userSignal] : []),
    AbortSignal.timeout(timeoutMs),
  ]);
  const userAborted = () => Boolean(userSignal && userSignal.aborted);

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if (userAborted()) return fail("aborted", { aborted: true });
    return fail(`${label}: request failed — ${err.message}`, { error: err.message });
  }

  if (!res.ok) {
    let errText = "";
    try { errText = await res.text(); } catch {}
    return fail(
      [`${label} API error.`, `status: ${res.status}`, errText ? `body:\n${errText.slice(0, 2000)}` : ""].filter(Boolean).join("\n"),
      { status: res.status },
    );
  }

  let text = "";
  let usage = null;
  if (stream) {
    const decoder = new StringDecoder("utf8");
    let buf = "";
    try {
      for await (const chunk of res.body) {
        buf += decoder.write(Buffer.from(chunk));
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          let obj; try { obj = JSON.parse(payload); } catch { continue; }
          const delta = obj && obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
          if (delta) { text += delta; try { opts.onStream(delta); } catch {} }
          if (obj && obj.usage) usage = obj.usage; // final chunk (stream_options.include_usage)
        }
      }
      buf += decoder.end();
    } catch (err) {
      if (userAborted()) return fail("aborted", { aborted: true });
      return fail(`${label}: stream error — ${err.message}`, { error: err.message });
    }
  } else {
    let data;
    try { data = await res.json(); } catch (err) {
      if (userAborted()) return fail("aborted", { aborted: true });
      return fail(`${label}: invalid JSON response — ${err.message}`, { error: err.message });
    }
    text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    if (data && data.usage) usage = data.usage;
  }

  text = String(text).trim();
  const result = { ok: Boolean(text), aborted: false, text: text || `${label}: empty response`, result: { status: res.status, durationMs: Date.now() - startedAt, usage: normalizeUsage(usage) } };
  logResult(opts.logFile, label, { url, model, stream }, result);
  return result;
}

// Anthropic Messages usage → uniform shape. Anthropic splits input into fresh /
// cache-write / cache-read; all three are "prompt tokens" for spend accounting.
function normalizeAnthropicUsage(u) {
  if (!u || typeof u !== "object") return null;
  const prompt = Number(u.input_tokens || 0) + Number(u.cache_read_input_tokens || 0) + Number(u.cache_creation_input_tokens || 0);
  const completion = Number(u.output_tokens || 0);
  if (!prompt && !completion) return null;
  return { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion };
}

// Split a built debate prompt into a stable head (cached as a system block) and a
// variable tail (the user message). The head — LANGUAGE directive + system
// scaffolding + role — repeats across rounds of a subtask, so marking it with
// cache_control lets rounds 2+ read it from cache (~10% cost) instead of re-billing
// the full prefix. Falls back to "all user, no cache" when the marker is absent.
function splitForCache(prompt) {
  const text = String(prompt || "");
  const i = text.indexOf("=== KNOWLEDGE BASE");
  if (i <= 0) return { system: "", user: text };
  return { system: text.slice(0, i).trimEnd(), user: text.slice(i) };
}

const ANTHROPIC_VERSION = "2023-06-01";

// Native Anthropic Messages API (NOT openai-compatible: /v1/messages, x-api-key,
// content blocks). Non-streaming for simplicity; emits the full text once via
// onStream so the live terminal still shows the answer. Enables prompt caching.
async function anthropicMessages(prompt, opts = {}) {
  const startedAt = Date.now();
  const label = opts.label || "Anthropic";
  const baseUrl = String(opts.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "");
  const model = opts.model || "";
  const fail = (msg, extra = {}) => {
    const r = { ok: false, aborted: Boolean(extra.aborted), text: msg, result: { durationMs: Date.now() - startedAt, ...extra } };
    logResult(opts.logFile, label, { url: `${baseUrl}/messages`, model, stream: false }, r);
    return r;
  };
  if (!model) return fail(`${label}: no model configured`);
  if (!opts.apiKey) return fail(`${label}: API key missing (set ${opts.credentialRef || "ANTHROPIC_API_KEY"})`);

  const { system, user } = splitForCache(prompt);
  const url = `${baseUrl}/messages`;
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": opts.apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    ...(opts.extraHeaders || {}),
  };
  const body = {
    model,
    max_tokens: typeof opts.maxTokens === "number" ? opts.maxTokens : 4096,
    messages: [{ role: "user", content: user }],
  };
  if (system) body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const userSignal = opts.signal;
  if (userSignal && userSignal.aborted) return fail("aborted", { aborted: true });
  const signal = AbortSignal.any([...(userSignal ? [userSignal] : []), AbortSignal.timeout(timeoutMs)]);
  const userAborted = () => Boolean(userSignal && userSignal.aborted);

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if (userAborted()) return fail("aborted", { aborted: true });
    return fail(`${label}: request failed — ${err.message}`, { error: err.message });
  }
  if (!res.ok) {
    let errText = ""; try { errText = await res.text(); } catch {}
    return fail([`${label} API error.`, `status: ${res.status}`, errText ? `body:\n${errText.slice(0, 2000)}` : ""].filter(Boolean).join("\n"), { status: res.status });
  }
  let data;
  try { data = await res.json(); } catch (err) {
    if (userAborted()) return fail("aborted", { aborted: true });
    return fail(`${label}: invalid JSON response — ${err.message}`, { error: err.message });
  }
  const text = (Array.isArray(data && data.content) ? data.content : [])
    .filter((b) => b && b.type === "text").map((b) => b.text).join("").trim();
  if (text && typeof opts.onStream === "function") { try { opts.onStream(text); } catch {} }
  const result = { ok: Boolean(text), aborted: false, text: text || `${label}: empty response`, result: { status: res.status, durationMs: Date.now() - startedAt, usage: normalizeAnthropicUsage(data && data.usage) } };
  logResult(opts.logFile, label, { url, model, stream: false }, result);
  return result;
}

// Provider type → implementation. openai-compatible and ollama share the chat call;
// they differ only in resolved defaults (baseUrl, whether a key is required).
const IMPLS = {
  "anthropic": (prompt, opts) => anthropicMessages(prompt, opts),
  "openai-compatible": (prompt, opts) => chatCompletion(prompt, { ...opts, credentialRequired: true }),
  "ollama": (prompt, opts) => chatCompletion(prompt, { ...opts, credentialRequired: false }),
};

function providerTypes() {
  return Object.keys(IMPLS);
}

// Run a profile against a prompt. opts (all optional): model (overrides the
// profile's), effort, temperature, maxTokens, signal, onStream, logFile,
// extraHeaders, timeoutMs. Returns the uniform { ok, text, aborted, result }.
function runProfile(profile, prompt, opts = {}) {
  const cfg = resolveProfile(profile);
  const impl = IMPLS[cfg.type];
  if (!impl) {
    return Promise.resolve({ ok: false, aborted: false, text: `unknown provider type: ${cfg.type || "(none)"}`, result: {} });
  }
  return impl(prompt, {
    ...opts,
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    credentialRef: cfg.credentialRef,
    model: opts.model || cfg.model,
    fallbackModels: cfg.fallbackModels,
    label: cfg.label,
    extraHeaders: { ...cfg.extraHeaders, ...(opts.extraHeaders || {}) },
  });
}

module.exports = {
  mode,
  presets,
  debatePresets,
  providerTypes,
  resolveProfile,
  credentialPresent,
  runProfile,
  normalizeUsage,
};
