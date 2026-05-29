const fs = require("node:fs");
const path = require("node:path");

// Minimal zero-dependency .env loader. Reads ROOT/.env and populates process.env
// WITHOUT overriding variables already present in the real environment (so an env
// var set by the shell / launcher always wins). API keys live here, never in the
// repo or in state.json (Phase 5 rule) — .env is gitignored; the repo ships only
// .env.example. Lines: KEY=value, optional surrounding quotes, # comments ignored.
function loadEnv(root) {
  const file = path.join(root || path.resolve(__dirname, ".."), ".env");
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch { return false; }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue; // skips blanks and # comments (don't start with an identifier)
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return true;
}

// Write (or replace) a single KEY=value line in ROOT/.env and apply it to the
// live process.env immediately. Used by the direct-API-key entry in settings:
// the key the user types is persisted ONLY to .env (gitignored) — never to the
// repo or state.json (Phase 5 rule). Values with whitespace get quoted so the
// loader round-trips them. Returns the env var name on success.
function setEnvVar(root, key, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key || ""))) {
    throw new Error("invalid env var name (use letters, digits, underscore; not starting with a digit)");
  }
  const file = path.join(root || path.resolve(__dirname, ".."), ".env");
  let raw = "";
  try { raw = fs.readFileSync(file, "utf8"); } catch {}
  const safe = /\s/.test(value) ? `"${String(value).replace(/"/g, '\\"')}"` : String(value);
  const line = `${key}=${safe}`;
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (re.test(raw)) {
    raw = raw.replace(re, line);
  } else {
    raw = raw + (raw && !raw.endsWith("\n") ? "\n" : "") + line + "\n";
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, raw, "utf8");
  process.env[key] = String(value);
  return key;
}

module.exports = { loadEnv, setEnvVar };
