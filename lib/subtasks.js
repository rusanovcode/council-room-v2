const path = require("node:path");
const { appendJsonl, readJsonl, rewriteJsonl, makeId, now } = require("./store");

const VALID_STATUS = new Set(["open", "pending", "resolved", "frozen"]);
const VALID_MODE = new Set(["LIGHT", "STANDARD", "STRICT", "CRITICAL"]);

function subtasksFile(runDir) {
  return path.join(runDir, "subtasks.jsonl");
}

function loadAll(runDir) {
  return readJsonl(subtasksFile(runDir)).map(normalize);
}

function normalize(item) {
  return {
    id: String(item.id || makeId("st")),
    title: String(item.title || "Untitled subtask").slice(0, 220),
    status: VALID_STATUS.has(item.status) ? item.status : "pending",
    mode: VALID_MODE.has(item.mode) ? item.mode : "STANDARD",
    openedAt: String(item.openedAt || now()),
    resolvedAt: String(item.resolvedAt || ""),
    parentId: String(item.parentId || ""),
    reason: String(item.reason || ""),
    rounds: Number(item.rounds || 0),
    summary: String(item.summary || ""),
  };
}

function activeSubtask(runDir) {
  const all = loadAll(runDir);
  return all.find((item) => item.status === "open") || null;
}

function openSubtask(runDir, { title, mode = "STANDARD", parentId = "" }) {
  const all = loadAll(runDir);
  for (const item of all) {
    if (item.status === "open") item.status = "pending";
  }
  const subtask = normalize({
    id: makeId("st"),
    title,
    mode,
    parentId,
    status: "open",
    openedAt: now(),
  });
  all.push(subtask);
  rewriteJsonl(subtasksFile(runDir), all);
  return subtask;
}

function resolveSubtask(runDir, id, summary = "") {
  return updateStatus(runDir, id, "resolved", { resolvedAt: now(), summary });
}

function freezeSubtask(runDir, id, reason = "") {
  return updateStatus(runDir, id, "frozen", { reason });
}

function reopenSubtask(runDir, id) {
  const all = loadAll(runDir);
  for (const item of all) {
    if (item.status === "open") item.status = "pending";
  }
  const target = all.find((item) => item.id === id);
  if (!target) throw new Error(`Subtask ${id} not found`);
  target.status = "open";
  target.resolvedAt = "";
  rewriteJsonl(subtasksFile(runDir), all);
  return target;
}

function updateStatus(runDir, id, status, extra = {}) {
  const all = loadAll(runDir);
  const target = all.find((item) => item.id === id);
  if (!target) throw new Error(`Subtask ${id} not found`);
  target.status = status;
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) target[key] = value;
  }
  rewriteJsonl(subtasksFile(runDir), all);
  return target;
}

function editSubtask(runDir, id, { title, mode }) {
  const all = loadAll(runDir);
  const target = all.find((item) => item.id === id);
  if (!target) throw new Error(`Subtask ${id} not found`);
  if (target.rounds > 0) throw new Error("Subtask already has rounds, cannot edit");
  if (target.status === "resolved") throw new Error("Subtask is resolved, cannot edit");
  if (typeof title === "string" && title.trim()) target.title = title.trim().slice(0, 220);
  if (typeof mode === "string" && VALID_MODE.has(mode)) target.mode = mode;
  rewriteJsonl(subtasksFile(runDir), all);
  return target;
}

function deleteSubtask(runDir, id) {
  const all = loadAll(runDir);
  const idx = all.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error(`Subtask ${id} not found`);
  if (all[idx].rounds > 0) throw new Error("Subtask already has rounds, cannot delete");
  all.splice(idx, 1);
  rewriteJsonl(subtasksFile(runDir), all);
  return { ok: true, id };
}

function incrementRounds(runDir, id) {
  const all = loadAll(runDir);
  const target = all.find((item) => item.id === id);
  if (!target) return null;
  target.rounds += 1;
  rewriteJsonl(subtasksFile(runDir), all);
  return target;
}

function appendEvent(runDir, event) {
  appendJsonl(path.join(runDir, "subtask-events.jsonl"), { at: now(), ...event });
}

module.exports = {
  loadAll,
  activeSubtask,
  openSubtask,
  editSubtask,
  deleteSubtask,
  resolveSubtask,
  freezeSubtask,
  reopenSubtask,
  incrementRounds,
  appendEvent,
};
