// Tests for subtask statement persistence. Run: node test/subtasks.test.js
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const subtasks = require(path.resolve(__dirname, "../lib/subtasks.js"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cr2-subtasks-"));

try {
  const longTitle = "Постановка ".repeat(80).trim(); // > 220 chars
  const opened = subtasks.openSubtask(tmp, { title: longTitle, mode: "STANDARD" });
  assert.strictEqual(opened.title, longTitle.trim(), "openSubtask preserves long statements");

  const editedTitle = "Updated statement ".repeat(60).trim();
  const edited = subtasks.editSubtask(tmp, opened.id, { title: editedTitle, mode: "STRICT" });
  assert.strictEqual(edited.title, editedTitle.trim(), "editSubtask preserves long statements");
  assert.strictEqual(edited.mode, "STRICT", "editSubtask still updates mode");

  const overLimit = "x".repeat(subtasks.MAX_TITLE_CHARS + 50);
  const capped = subtasks.editSubtask(tmp, opened.id, { title: overLimit });
  assert.strictEqual(capped.title.length, subtasks.MAX_TITLE_CHARS, "statements are capped at MAX_TITLE_CHARS");

  console.log("PASS subtask long statement persistence");
} catch (error) {
  console.error("SUBTASK TEST FAILED:", error.stack || error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
