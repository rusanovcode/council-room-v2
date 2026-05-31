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

// Increment one field of a key's record for today (auto-resets on date change).
function _inc(dir, credentialRef, field) {
  if (!credentialRef) return;
  const data = _load(dir);
  const d = today();
  let cur = data[credentialRef];
  if (!cur || cur.date !== d) cur = { date: d, count: 0, blocked: 0 };
  cur[field] = (cur[field] || 0) + 1;
  data[credentialRef] = cur;
  store.writeJson(path.join(dir, FILE), data);
}

// Count one request against a key for today.
function bump(dir, credentialRef) { _inc(dir, credentialRef, "count"); }
// Count one 429 (rate-limit / daily cap) caught on a key today — shows which
// account hits its limit first.
function bump429(dir, credentialRef) { _inc(dir, credentialRef, "blocked"); }

// UI view: { credentialRef: { date, count, blocked, cap, remaining } } for today.
// Includes every ref in `refs` (configured-but-unused keys then show 0). `caps` is
// an optional per-ref cap map (e.g. 1000 for accounts with credit); else DEFAULT_CAP.
function summary(dir, { cap = DEFAULT_CAP, caps = {}, refs = [] } = {}) {
  const data = _load(dir);
  const d = today();
  const out = {};
  for (const ref of new Set([...Object.keys(data), ...refs])) {
    const v = data[ref];
    const fresh = v && v.date === d;
    const c = caps[ref] || cap;
    const count = fresh ? (v.count || 0) : 0;
    out[ref] = { date: d, count, blocked: fresh ? (v.blocked || 0) : 0, cap: c, remaining: Math.max(0, c - count) };
  }
  return out;
}

module.exports = { bump, bump429, summary, DEFAULT_CAP };
