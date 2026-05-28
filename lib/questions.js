const path = require("node:path");
const { readJsonl, rewriteJsonl, now } = require("./store");

const VALID_STATUS = new Set(["open", "resolved", "verified"]);
// Char-trigram Jaccard >= this ⇒ near-duplicate. Trigrams (not whole words) so
// Russian inflection ("пользователь"/"пользователя") still overlaps. Conservative
// on purpose — better to keep a near-dup than to merge two distinct questions.
const DUP_THRESHOLD = 0.4;

function questionsFile(runDir) {
  return path.join(runDir, "questions.jsonl");
}

function normalize(item) {
  const rb = item.resolvedBy || {};
  return {
    id: String(item.id || ""),
    subtaskId: String(item.subtaskId || ""),
    text: String(item.text || "").slice(0, 600),
    status: VALID_STATUS.has(item.status) ? item.status : "open",
    resolvedBy: { codex: Boolean(rb.codex), claude: Boolean(rb.claude) },
    answer: String(item.answer || ""),
    raisedRound: Number(item.raisedRound || 0),
    createdAt: String(item.createdAt || now()),
  };
}

function loadAll(runDir) {
  return readJsonl(questionsFile(runDir)).map(normalize);
}

function save(runDir, list) {
  rewriteJsonl(questionsFile(runDir), list);
}

// ---- near-duplicate detection -------------------------------------------

function normText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(value) {
  const t = normText(value).replace(/ /g, "_");
  const set = new Set();
  for (let i = 0; i < t.length - 2; i += 1) set.add(t.slice(i, i + 3));
  return set;
}

function similarity(a, b) {
  if (normText(a) === normText(b)) return 1;
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function nextId(list) {
  let max = 0;
  for (const q of list) {
    const m = /^Q(\d+)$/.exec(q.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Q${max + 1}`;
}

// ---- queries -------------------------------------------------------------

function forSubtask(runDir, subtaskId) {
  return loadAll(runDir).filter((q) => q.subtaskId === subtaskId);
}

function openForSubtask(runDir, subtaskId) {
  return forSubtask(runDir, subtaskId).filter((q) => q.status === "open");
}

function findById(list, id) {
  return list.find((q) => q.id === id) || null;
}

// ---- mutations -----------------------------------------------------------

// Add a question; collapse near-duplicates against existing OPEN ones for the
// same subtask (keeps the first/fuller wording — preserves nuance).
function addQuestion(runDir, subtaskId, text, round = 0) {
  const clean = String(text || "").trim();
  if (!clean) return null;
  const list = loadAll(runDir);
  const dup = list.find(
    (q) => q.subtaskId === subtaskId && q.status === "open" && similarity(q.text, clean) >= DUP_THRESHOLD,
  );
  if (dup) return dup;
  const q = normalize({
    id: nextId(list),
    subtaskId,
    text: clean,
    status: "open",
    raisedRound: round,
    createdAt: now(),
  });
  list.push(q);
  save(runDir, list);
  return q;
}

// Record that `agent` ("codex" | "claude") considers question `id` resolved.
// When both agents have resolved it ⇒ status becomes "resolved".
function recordResolve(runDir, id, agent, answer = "") {
  if (agent !== "codex" && agent !== "claude") return null;
  const list = loadAll(runDir);
  const q = findById(list, id);
  if (!q || q.status === "verified") return q;
  q.resolvedBy[agent] = true;
  if (answer && !q.answer) q.answer = String(answer).trim().slice(0, 600);
  if (q.resolvedBy.codex && q.resolvedBy.claude) q.status = "resolved";
  save(runDir, list);
  return q;
}

function removeById(runDir, id) {
  const list = loadAll(runDir);
  const next = list.filter((q) => q.id !== id);
  if (next.length === list.length) return false;
  save(runDir, next);
  return true;
}

function reopen(runDir, id) {
  const list = loadAll(runDir);
  const q = findById(list, id);
  if (!q) return null;
  q.status = "open";
  q.resolvedBy = { codex: false, claude: false };
  save(runDir, list);
  return q;
}

// All resolved questions of a subtask → verified (used after a passing verify pass).
function markSubtaskVerified(runDir, subtaskId) {
  const list = loadAll(runDir);
  let changed = false;
  for (const q of list) {
    if (q.subtaskId === subtaskId && q.status === "resolved") {
      q.status = "verified";
      changed = true;
    }
  }
  if (changed) save(runDir, list);
  return changed;
}

// Import legacy free-text open_questions (strings) into the store, deduped.
function migrateStrings(runDir, subtaskId, texts, round = 0) {
  let added = 0;
  for (const text of texts || []) {
    const before = openForSubtask(runDir, subtaskId).length;
    addQuestion(runDir, subtaskId, text, round);
    if (openForSubtask(runDir, subtaskId).length > before) added += 1;
  }
  return added;
}

module.exports = {
  DUP_THRESHOLD,
  similarity,
  loadAll,
  forSubtask,
  openForSubtask,
  addQuestion,
  recordResolve,
  reopen,
  removeById,
  markSubtaskVerified,
  migrateStrings,
};
