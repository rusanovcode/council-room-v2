"use strict";
const path = require("node:path");
const os = require("node:os");

const home = os.homedir();

// Stub: no multi-account gateway. Single-account mode only.
module.exports = {
  detect: () => ({ connected: false, accounts: { claude: [], codex: [] } }),
  status: async () => ({ connected: false, accounts: { claude: [], codex: [] } }),
  accountAvailable: () => false,
  envForAccount: () => ({}),
  claudePaths: () => ({ acc1: path.join(home, ".claude") }),
  codexPaths: () => ({ acc1: path.join(home, ".codex") }),
  codexUsageWindows: () => null,
  refreshUsage: async () => {},
};
