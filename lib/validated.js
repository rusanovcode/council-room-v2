// Phase 5: persistent record of which API keys passed a live test request.
//
// The green ✓ on the API-key field (and the green connected-agent chip) means
// "this key was proven working", not merely "a key is present". Keeping that
// only in memory meant a server restart dropped it — a key in .env that was
// verified last session showed the amber "unverified" state again. We persist
// the verified credentialRefs here, each pinned to a fingerprint of the key
// VALUE at verification time. On load a ref counts as verified only if the
// current env value still matches that fingerprint, so changing the key (via
// the UI or by editing .env directly) auto-invalidates the stale ✓.
//
// Stored in rooms/.validated-keys.json (gitignored, per-user). Values are
// fingerprints (a truncated SHA-256), never the keys themselves.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function file(roomsDir) {
  return path.join(roomsDir, ".validated-keys.json");
}

// Short, non-reversible fingerprint of a key value. Empty value → "" (a missing
// key can never match a stored fingerprint).
function fingerprint(value) {
  if (!value) return "";
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
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

// Record that `ref`'s current key value (`keyValue`) passed a live test.
function markValidated(roomsDir, ref, keyValue) {
  if (!ref) return;
  const data = load(roomsDir);
  data[ref] = { fp: fingerprint(keyValue), at: new Date().toISOString() };
  save(roomsDir, data);
}

// Forget a ref's verified status (key changed / test failed).
function clearValidated(roomsDir, ref) {
  if (!ref) return;
  const data = load(roomsDir);
  if (data[ref]) { delete data[ref]; save(roomsDir, data); }
}

// The set of refs still verified: stored fingerprint matches the live env value.
// `envLookup(ref)` returns the current key value for a ref (e.g. r => process.env[r]).
function validatedSet(roomsDir, envLookup) {
  const data = load(roomsDir);
  const set = new Set();
  for (const [ref, rec] of Object.entries(data)) {
    if (rec && rec.fp && rec.fp === fingerprint(envLookup(ref))) set.add(ref);
  }
  return set;
}

module.exports = { fingerprint, markValidated, clearValidated, validatedSet, file };
