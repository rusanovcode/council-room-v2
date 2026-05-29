const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

// "Switch module" = the ai-switcher at C:\AI\ai-switcher. Primary source is its
// HTTP gateway (/status on 7700) — profiles incl. an API-key profile, plus the
// active profile. If the gateway is down we fall back to file-based detection
// (account dirs under auth/), which is the plain standard mode.
const SWITCHER_ROOT = process.env.COUNCIL_ROOM_V2_SWITCHER_ROOT || "C:\\AI\\ai-switcher\\auth";
const GATEWAY_HOST = process.env.AI_SWITCHER_HOST || "127.0.0.1";
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || 7700);

function claudeDir() {
  return path.join(SWITCHER_ROOT, "claude-acc2");
}
function codexDir() {
  return path.join(SWITCHER_ROOT, "codex-acc2");
}

function fileExists(p) {
  try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; }
}

// account 2 is "available" only if its auth credentials are actually present.
function claudeAcc2Available() {
  const d = claudeDir();
  return fileExists(path.join(d, ".credentials.json")) || fileExists(path.join(d, ".claude.json"));
}
function codexAcc2Available() {
  return fileExists(path.join(codexDir(), "auth.json"));
}

// Account 1 = the CLI's default home. "authorized" = its auth file already exists,
// so we don't push a redundant login when the user is already signed in.
function codexAcc1Authorized() {
  const home = process.env.CODEX_HOME && !process.env.CODEX_HOME.includes("ai-switcher")
    ? process.env.CODEX_HOME
    : path.join(os.homedir(), ".codex");
  return fileExists(path.join(home, "auth.json"));
}
function claudeAcc1Authorized() {
  const home = path.join(os.homedir(), ".claude");
  return fileExists(path.join(home, ".credentials.json")) || fileExists(path.join(home, ".claude.json"));
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

// Claude Code persists rolling-window usage in <configDir>/.usage-cache.json as
// `utilization` (percent USED) per window. Remaining % = 100 - the most-used
// window (the limit you hit first). null = no cache yet.
//
// Interactive Claude writes this file itself; a headless/gateway account (e.g.
// claude-acc2, only ever run with -p --no-session-persistence) never gets one,
// so its button stayed grey. We fill the gap by fetching the same data from
// Anthropic's own OAuth usage API (the account's token → its issuer) and writing
// the cache file, so the sync reader below works unchanged for every account.
const claudeUsageRefreshAt = new Map(); // configDir -> last attempt ts
const CLAUDE_USAGE_FRESH_MS = 10 * 60 * 1000; // don't refetch if the file is newer than this
const CLAUDE_USAGE_THROTTLE_MS = 5 * 60 * 1000; // min between fetch attempts per dir

function fetchAndWriteClaudeUsage(configDir) {
  return new Promise((resolve) => {
    let cred;
    try { cred = JSON.parse(fs.readFileSync(path.join(configDir, ".credentials.json"), "utf8")); } catch { return resolve(); }
    const oa = cred && cred.claudeAiOauth;
    const tok = oa && oa.accessToken;
    if (!tok) return resolve();
    if (oa.expiresAt && Date.now() > oa.expiresAt) return resolve(); // expired — token refresh not wired
    const req = https.request({
      host: "api.anthropic.com", path: "/api/oauth/usage", method: "GET", timeout: 8000,
      headers: {
        Authorization: `Bearer ${tok}`,
        "anthropic-beta": "oauth-2025-04-20",
        "anthropic-version": "2023-06-01",
        "User-Agent": "council-room-v2",
        Accept: "application/json",
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => { d += c; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try { JSON.parse(d); fs.writeFileSync(path.join(configDir, ".usage-cache.json"), d, "utf8"); } catch {}
        }
        resolve();
      });
    });
    req.on("error", () => resolve());
    req.on("timeout", () => { req.destroy(); resolve(); });
    req.end();
  });
}

// Fire-and-forget: refresh the on-disk cache when it's missing or stale. The
// current poll reads whatever exists; the next one picks up the fresh file.
function maybeRefreshClaudeUsage(configDir) {
  try {
    let mtime = 0;
    try { mtime = fs.statSync(path.join(configDir, ".usage-cache.json")).mtimeMs; } catch {}
    if (mtime && Date.now() - mtime < CLAUDE_USAGE_FRESH_MS) return; // fresh enough
    const last = claudeUsageRefreshAt.get(configDir) || 0;
    if (Date.now() - last < CLAUDE_USAGE_THROTTLE_MS) return; // attempted recently
    claudeUsageRefreshAt.set(configDir, Date.now());
    fetchAndWriteClaudeUsage(configDir).catch(() => {});
  } catch {}
}

function claudeTokensPct(configDir) {
  if (!configDir) return null;
  maybeRefreshClaudeUsage(configDir);
  const data = readJsonSafe(path.join(configDir, ".usage-cache.json"));
  if (!data || typeof data !== "object") return null;
  let maxUtil = null;
  for (const v of Object.values(data)) {
    if (v && typeof v === "object" && typeof v.utilization === "number") {
      maxUtil = maxUtil === null ? v.utilization : Math.max(maxUtil, v.utilization);
    }
  }
  if (maxUtil === null) return null;
  return Math.max(0, Math.min(100, Math.round(100 - maxUtil)));
}

const CLAUDE_HOME = path.join(os.homedir(), ".claude");

// Codex persists rolling-window rate limits in its session rollout JSONL files
// (<codexHome>/sessions/.../rollout-*.jsonl) as `token_count` events:
//   rate_limits.primary.used_percent  → 5-hour window
//   rate_limits.secondary.used_percent → weekly window
// Remaining % = 100 − the most-used window (the limit you hit first) — the same
// model as Claude's usage cache. Local file, no network / token needed.
// Cached per home (rollout files are large; the gateway polls every few seconds).
const codexUsageCache = new Map(); // codexHome -> { ts, pct }
const CODEX_USAGE_TTL_MS = 30000;

function codexHomeAcc1() {
  return process.env.CODEX_HOME && !process.env.CODEX_HOME.includes("ai-switcher")
    ? process.env.CODEX_HOME
    : path.join(os.homedir(), ".codex");
}

// rollout-*.jsonl under <codexHome>/sessions and /archived_sessions, newest first.
function rolloutFilesByMtime(codexHome) {
  const files = [];
  for (const sub of ["sessions", "archived_sessions"]) {
    const stack = [path.join(codexHome, sub)];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) { stack.push(fp); continue; }
        if (!e.name.startsWith("rollout-") || !e.name.endsWith(".jsonl")) continue;
        let m; try { m = fs.statSync(fp).mtimeMs; } catch { continue; }
        files.push({ fp, m });
      }
    }
  }
  return files.sort((a, b) => b.m - a.m).map((x) => x.fp);
}

// Most recent valid rate_limits snapshot in a rollout file (null windows skipped).
function pctFromRollout(file) {
  let lines;
  try { lines = fs.readFileSync(file, "utf8").split(/\r?\n/); } catch { return null; }
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || line.indexOf("rate_limits") === -1) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    const rl = ev && ev.payload && ev.payload.rate_limits;
    if (!rl) continue;
    const used = [rl.primary, rl.secondary]
      .filter((w) => w && typeof w.used_percent === "number")
      .map((w) => w.used_percent);
    if (!used.length) continue; // empty snapshot (null windows) — keep looking
    return Math.max(0, Math.min(100, Math.round(100 - Math.max(...used))));
  }
  return null;
}

function codexTokensPct(codexHome) {
  if (!codexHome) return null;
  const now = Date.now();
  const cached = codexUsageCache.get(codexHome);
  if (cached && now - cached.ts < CODEX_USAGE_TTL_MS) return cached.pct;
  let pct = null;
  // The newest file may carry only an empty snapshot; walk recent files until one
  // has a real rate_limits window (bounded so we don't read the whole history).
  for (const file of rolloutFilesByMtime(codexHome).slice(0, 12)) {
    const p = pctFromRollout(file);
    if (p !== null) { pct = p; break; }
  }
  codexUsageCache.set(codexHome, { ts: now, pct });
  return pct;
}

function codexHomeForProfile(id) {
  if (id === "acc1") return codexHomeAcc1();
  if (id === "acc2") return codexDir();
  return null; // apikey — no rollout sessions
}

function detect() {
  const claudeAcc2 = claudeAcc2Available();
  const codexAcc2 = codexAcc2Available();
  // tokensPct: remaining-token percentage per account. No source wired yet — null
  // ⇒ unknown (UI shows neutral). Real usage data comes later with the stats panel.
  const accounts = {
    // Codex: remaining % from its session rollout rate_limits (see codexTokensPct).
    codex: [
      { account: 1, available: true, authorized: codexAcc1Authorized(), tokensPct: codexTokensPct(codexHomeAcc1()) },
      { account: 2, available: codexAcc2, authorized: codexAcc2, tokensPct: codexAcc2 ? codexTokensPct(codexDir()) : null },
    ],
    // Claude: real source — its per-account usage cache.
    claude: [
      { account: 1, available: true, authorized: claudeAcc1Authorized(), tokensPct: claudeTokensPct(CLAUDE_HOME) },
      { account: 2, available: claudeAcc2, authorized: claudeAcc2, tokensPct: claudeTokensPct(claudeDir()) },
    ],
  };
  return {
    root: SWITCHER_ROOT,
    source: "files",
    connected: claudeAcc2 || codexAcc2,
    claude: { acc2: claudeAcc2, dir: claudeDir() },
    codex: { acc2: codexAcc2, dir: codexDir() },
    accounts,
  };
}

// Claude usage-cache dir for a gateway profile id.
function claudeDirForProfile(id) {
  if (id === "acc1") return CLAUDE_HOME;
  if (id === "acc2") return claudeDir();
  return null; // apikey — no rolling-window cache
}

function httpGetJson(host, port, pathname, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: pathname, timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// Primary source: the ai-switcher gateway. Returns null if it's not reachable.
async function fetchGatewayStatus() {
  const s = await httpGetJson(GATEWAY_HOST, GATEWAY_PORT, "/status");
  if (!s || s.status !== "ok" || !s.profiles) return null;
  const active = s.active || {};
  const mapProfiles = (svc) => (s.profiles[svc] || []).map((p) => {
    const isApi = p.mode === "api" || p.id === "apikey";
    const dir = svc === "claude" ? claudeDirForProfile(p.id) : codexHomeForProfile(p.id);
    return {
      id: p.id,
      label: p.label || p.id,
      mode: p.mode || "session",
      active: active[svc] === p.id,
      available: true,
      authorized: isApi
        ? Boolean(p.apiKeySet)
        : (svc === "claude"
            ? (p.id === "acc1" ? claudeAcc1Authorized() : claudeAcc2Available())
            : (p.id === "acc1" ? codexAcc1Authorized() : codexAcc2Available())),
      tokensPct: dir ? (svc === "claude" ? claudeTokensPct(dir) : codexTokensPct(dir)) : null,
    };
  });
  return {
    root: SWITCHER_ROOT,
    source: "gateway",
    connected: true,
    active,
    codexFailoverEnabled: Boolean(s.codexFailoverEnabled),
    accounts: { codex: mapProfiles("codex"), claude: mapProfiles("claude") },
  };
}

// Gateway status if up, otherwise file-based detect (standard mode).
async function status() {
  return (await fetchGatewayStatus()) || detect();
}

// Normalize an account ref (number 1/2 or id "acc1"/"acc2"/"apikey") → id.
function normAccount(account) {
  if (account === "acc2" || Number(account) === 2) return "acc2";
  if (account === "apikey") return "apikey";
  return "acc1";
}

function accountAvailable(tool, account) {
  const a = normAccount(account);
  if (a === "acc1") return true; // default account always usable
  if (a === "acc2") return tool === "claude" ? claudeAcc2Available() : codexAcc2Available();
  return false; // apikey — direct-spawn routing not wired (gateway-only), see DATA_SOURCES §5
}

// Env overrides for a spawned CLI child. acc1 (and apikey for now) → {} (CLI defaults).
function envForAccount(tool, account) {
  if (normAccount(account) !== "acc2") return {};
  if (tool === "claude") {
    const d = claudeDir();
    return { CLAUDE_CONFIG_DIR: d, CLAUDE_USAGE_CACHE: d };
  }
  if (tool === "codex") {
    return { CODEX_HOME: codexDir() };
  }
  return {};
}

// Config dirs per Claude account (for usage cache / session JSONL stats).
function claudePaths() {
  return { acc1: CLAUDE_HOME, acc2: claudeDir() };
}

module.exports = {
  SWITCHER_ROOT,
  detect,
  fetchGatewayStatus,
  status,
  accountAvailable,
  envForAccount,
  claudePaths,
};
