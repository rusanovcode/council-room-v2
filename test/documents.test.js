// Tests for per-subtask document scoping. Run: node test/documents.test.js
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const documents = require(path.resolve(__dirname, "../lib/documents.js"));
const { appendJsonl } = require(path.resolve(__dirname, "../lib/store.js"));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cr2-documents-"));

try {
  // add with an active subtask -> subtask-scoped; add as shared -> shared.
  const sub = documents.add(tmp, "subtask-doc", "alpha", { subtaskId: "st_A" });
  assert.strictEqual(sub.scope, "subtask", "doc added with a subtask is subtask-scoped");
  assert.strictEqual(sub.subtaskId, "st_A", "subtask id is stamped");

  const shared = documents.add(tmp, "shared-doc", "beta", { scope: "shared", subtaskId: "st_A" });
  assert.strictEqual(shared.scope, "shared", "explicit shared scope wins over an active subtask");
  assert.strictEqual(shared.subtaskId, "", "shared docs carry no subtask id");

  const noSub = documents.add(tmp, "no-active", "gamma", {});
  assert.strictEqual(noSub.scope, "shared", "doc added with no active subtask defaults to shared");

  // Prompt snapshot: shared + active subtask only, shared first.
  const snapA = documents.snapshotForPrompt(tmp, "st_A");
  assert.ok(snapA.includes("alpha"), "active subtask doc is injected");
  assert.ok(snapA.includes("beta") && snapA.includes("gamma"), "shared docs are injected");
  assert.ok(snapA.indexOf("beta") < snapA.indexOf("alpha"), "shared docs come before subtask docs");

  const snapB = documents.snapshotForPrompt(tmp, "st_B");
  assert.ok(!snapB.includes("alpha"), "another subtask does NOT see st_A's doc");
  assert.ok(snapB.includes("beta"), "shared docs are visible to every subtask");

  // Legacy record (no scope, no subtaskId) -> library, never injected.
  appendJsonl(path.join(tmp, "documents.jsonl"), { id: "doc_legacy", name: "legacy", text: "delta", addedAt: "x" });
  const legacy = documents.loadAll(tmp).find((d) => d.id === "doc_legacy");
  assert.strictEqual(legacy.scope, "library", "legacy doc normalizes to library scope");
  assert.ok(!documents.snapshotForPrompt(tmp, "st_A").includes("delta"), "library docs are never injected");

  // setScope: promote the library doc to shared, then attach to a subtask.
  assert.ok(documents.setScope(tmp, "doc_legacy", "shared"), "setScope shared succeeds");
  assert.ok(documents.snapshotForPrompt(tmp, "st_A").includes("delta"), "promoted-to-shared doc is now injected");
  assert.ok(documents.setScope(tmp, "doc_legacy", "subtask", "st_B"), "setScope subtask succeeds");
  assert.ok(!documents.snapshotForPrompt(tmp, "st_A").includes("delta"), "re-scoped doc leaves st_A");
  assert.ok(documents.snapshotForPrompt(tmp, "st_B").includes("delta"), "re-scoped doc joins st_B");
  assert.ok(!documents.setScope(tmp, "doc_legacy", "subtask", ""), "subtask scope without an id is rejected");

  // listMeta exposes scope + subtaskId.
  const meta = documents.listMeta(tmp).find((d) => d.id === sub.id);
  assert.strictEqual(meta.scope, "subtask", "listMeta exposes scope");
  assert.strictEqual(meta.subtaskId, "st_A", "listMeta exposes subtaskId");

  console.log("PASS documents: per-subtask scope, shared, library/legacy, setScope");
} catch (error) {
  console.error("DOCUMENTS TEST FAILED:", error.stack || error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
