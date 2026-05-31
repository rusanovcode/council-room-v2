"use strict";

// Per-API-key daily request counter for OpenRouter's free pool.
//
// OpenRouter does not expose remaining free-tier quota numerically — its
// /api/v1/key endpoint returns $0 usage and null limit/remaining for free models.
// So we count OUR OWN requests per credentialRef (= per account) per day and
// compare against the known free cap. Persisted in <dir>/.or-quota.json.

const path = require("node:path");
const store = require("./store");

const FILE = ".or-quota.json";
// OpenRouter free models: ~50 requests/day per account with < $10 lifetime credit,
// 1000/day once an account has bought >= $10. We can't read which from the API, so
// default to the conservative 50; override per call if needed.
const DEFAULT_CAP = 50;

function today() { return new Date().toISOString().slice(0, 10); }

function _load(dir) { return store.readJson(path.join(dir, FILE)) || {}; }

// Count one request against a key for today (auto-resets when the date rolls over).
function bump(dir, credentialRef) {
  if (!credentialRef) return;
  const data = _load(dir);
  const d = today();
  const cur = data[credentialRef];
  data[credentialRef] = (cur && cur.date === d) ? { date: d, count: cur.count + 1 } : { date: d, count: 1 };
  store.writeJson(path.join(dir, FILE), data);
}

// UI view: { credentialRef: { date, count, cap, remaining } } for today. Includes
// every ref in `refs` (configured-but-unused keys then show count 0) plus any ref
// that has been used today.
function summary(dir, { cap = DEFAULT_CAP, refs = [] } = {}) {
  const data = _load(dir);
  const d = today();
  const out = {};
  for (const ref of new Set([...Object.keys(data), ...refs])) {
    const v = data[ref];
    const count = (v && v.date === d) ? v.count : 0;
    out[ref] = { date: d, count, cap, remaining: Math.max(0, cap - count) };
  }
  return out;
}

module.exports = { bump, summary, DEFAULT_CAP };
