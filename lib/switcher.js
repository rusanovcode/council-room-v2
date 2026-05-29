const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// "Switch module" = the env-var based account switcher at C:\AI\ai-switcher.
// There is NO HTTP gateway: account 2 is selected by pointing the CLI's config
// dir at the switcher's auth folder; account 1 = env unset (CLI default).
const SWITCHER_ROOT = process.env.COUNCIL_ROOM_V2_SWITCHER_ROOT || "C:\\AI\\ai-switcher\\auth";

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

function detect() {
  const claudeAcc2 = claudeAcc2Available();
  const codexAcc2 = codexAcc2Available();
  // tokensPct: remaining-token percentage per account. No source wired yet — null
  // ⇒ unknown (UI shows neutral). Real usage data comes later with the stats panel.
  const accounts = {
    codex: [
      { account: 1, available: true, authorized: codexAcc1Authorized(), tokensPct: null },
      { account: 2, available: codexAcc2, authorized: codexAcc2, tokensPct: null },
    ],
    claude: [
      { account: 1, available: true, authorized: claudeAcc1Authorized(), tokensPct: null },
      { account: 2, available: claudeAcc2, authorized: claudeAcc2, tokensPct: null },
    ],
  };
  return {
    root: SWITCHER_ROOT,
    connected: claudeAcc2 || codexAcc2,
    claude: { acc2: claudeAcc2, dir: claudeDir() },
    codex: { acc2: codexAcc2, dir: codexDir() },
    accounts,
  };
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

module.exports = {
  SWITCHER_ROOT,
  detect,
  accountAvailable,
  envForAccount,
};
