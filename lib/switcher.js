const fs = require("node:fs");
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

function detect() {
  const claudeAcc2 = claudeAcc2Available();
  const codexAcc2 = codexAcc2Available();
  return {
    root: SWITCHER_ROOT,
    connected: claudeAcc2 || codexAcc2,
    claude: { acc2: claudeAcc2, dir: claudeDir() },
    codex: { acc2: codexAcc2, dir: codexDir() },
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
