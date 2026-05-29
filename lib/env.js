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

module.exports = { loadEnv };
