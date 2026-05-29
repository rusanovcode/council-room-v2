// Phase 5: cumulative token spend per API profile.
//
// API-key providers have no "remaining %" the way subscription/OAuth accounts do
// (there is no rollout window or usage-cache to read) — the only thing we can show
// is how much we have actually spent. OpenAI-compatible responses carry a `usage`
// block; lib/providers surfaces it as result.usage and we accumulate it here.
//
// Stored as a single JSON map keyed by profile id under rooms/ (gitignored,
// per-user). Cumulative since the last reset — there is no per-window source.

const fs = require("node:fs");
const path = require("node:path");

function file(roomsDir) {
  return path.join(roomsDir, ".provider-usage.json");
}

function load(roomsDir) {
  try {
    const data = JSON.parse(fs.readFileSync(file(roomsDir), "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function save(roomsDir, data) {
  try {
    fs.mkdirSync(roomsDir, { recursive: true });
    fs.writeFileSync(file(roomsDir), JSON.stringify(data, null, 2), "utf8");
  } catch {}
}

// Add one call's usage to a profile's running total. `usage` is the normalized
// shape from providers.normalizeUsage ({promptTokens, completionTokens,
// totalTokens}); a falsy usage (no data — e.g. Ollama or unsupported stream) is
// ignored so we don't inflate the request count with un-measured calls.
function record(roomsDir, profile, usage) {
  if (!profile || !usage) return null;
  const id = profile.id || profile.provider;
  if (!id) return null;
  const data = load(roomsDir);
  const e = data[id] || { label: "", provider: "", inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, lastAt: null };
  e.label = profile.label || e.label || id;
  e.provider = profile.provider || e.provider || "";
  e.inputTokens += usage.promptTokens || 0;
  e.outputTokens += usage.completionTokens || 0;
  e.totalTokens += usage.totalTokens || 0;
  e.requests += 1;
  e.lastAt = new Date().toISOString();
  data[id] = e;
  save(roomsDir, data);
  return e;
}

// All per-profile totals (the raw stored map). UI formats tokens → K itself.
function summary(roomsDir) {
  return load(roomsDir);
}

// Reset spend: a single profile id, or everything when no id is given.
function reset(roomsDir, profileId) {
  if (!profileId) {
    save(roomsDir, {});
    return {};
  }
  const data = load(roomsDir);
  delete data[profileId];
  save(roomsDir, data);
  return data;
}

module.exports = { record, summary, reset, file };
