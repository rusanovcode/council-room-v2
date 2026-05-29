const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

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
function claudeTokensPct(configDir) {
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

function detect() {
  const claudeAcc2 = claudeAcc2Available();
  const codexAcc2 = codexAcc2Available();
  // tokensPct: remaining-token percentage per account. No source wired yet — null
  // ⇒ unknown (UI shows neutral). Real usage data comes later with the stats panel.
  const accounts = {
    // Codex doesn't persist remaining-token % to a readable file → null (grey).
    codex: [
      { account: 1, available: true, authorized: codexAcc1Authorized(), tokensPct: null },
      { account: 2, available: codexAcc2, authorized: codexAcc2, tokensPct: null },
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
    const dir = svc === "claude" ? claudeDirForProfile(p.id) : null;
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
      tokensPct: svc === "claude" && dir ? claudeTokensPct(dir) : null,
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

function accountAvailable(tool, account) {
  if (Number(account) === 1) return true; // default account always usable
  if (tool === "claude") return claudeAcc2Available();
  if (tool === "codex") return codexAcc2Available();
  return false;
}

// Env overrides for a spawned CLI child. Account 1 → {} (CLI defaults).
function envForAccount(tool, account) {
  if (Number(account) !== 2) return {};
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
