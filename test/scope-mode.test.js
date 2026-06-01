// Scope-mode title inference checks (Phase 8 F-KB2).
// Run: node test/scope-mode.test.js
const assert = require("node:assert");
const path = require("node:path");

const { inferScopeMode } = require(path.resolve(__dirname, "../lib/scope-mode.js"));

function check(title, expected) {
  const got = inferScopeMode(title);
  assert.strictEqual(got, expected, `inferScopeMode("${title}") -> ${got}, expected ${expected}`);
}

try {
  check("Propose game_agent Phase 13 scope + checklist outline", "proposal");
  check("предложить scope + чек-лист", "proposal");
  check("Фаза N: предложить scope", "proposal");
  check("proposal-only: scope + checklist", "proposal");
  check("Implement policy_hash field", "normal");

  // Explicit value always wins over title inference.
  assert.strictEqual(inferScopeMode("Implement policy_hash field", "proposal"), "proposal");
  assert.strictEqual(inferScopeMode("Propose scope + checklist", "normal"), "normal");

  console.log("PASS scope-mode inference (title + explicit override)");
} catch (error) {
  console.error("SCOPE-MODE TEST FAILED:", error.stack || error.message);
  process.exit(1);
}

