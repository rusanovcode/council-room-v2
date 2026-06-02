// Phase 6b: per-chat attached documents. User-provided reference material
// (pasted text or an uploaded text file) that is fed into the debate prompt as
// an ATTACHED DOCUMENTS section. Unlike filesystem scanning, these are EXPLICITLY
// provided by the user, so they are a legitimate context source even in isolated
// mode. Token economy still applies: each document is capped on store, and the
// prompt snapshot is capped in total (with truncation markers).
const path = require("node:path");
const { readJsonl, appendJsonl, rewriteJsonl, makeId, now } = require("./store");

const MAX_DOC_CHARS = 40000;          // hard cap per stored document
const MAX_PROMPT_CHARS = 24000;       // total budget injected into a single prompt
                                      // NB: documents are injected into EVERY agent's prompt EVERY round,
                                      // so a larger budget raises token spend per round. Prefer putting the
                                      // essential facts directly into the subtask statement over relying on
                                      // many large attachments.

function file(runDir) {
  return path.join(runDir, "documents.jsonl");
}

// Document scope (per-subtask isolation, mirrors the Knowledge Base model):
//   "shared"  — injected into every subtask's prompt (chat-wide reference).
//   "subtask" — injected only when its subtaskId is the active subtask.
//   "library" — stored but NEVER injected until explicitly assigned/shared.
// Legacy records (no scope, no subtaskId) are treated as "library" so old chats
// stop leaking every past subtask's documents into a new subtask's prompt.
function scopeOf(d) {
  if (d.scope === "shared" || d.scope === "subtask" || d.scope === "library") return d.scope;
  if (d.subtaskId) return "subtask";
  return "library";
}

function normalize(d) {
  const text = String(d.text || "");
  const scope = scopeOf(d);
  return {
    id: String(d.id || ""),
    name: String(d.name || "document").slice(0, 200),
    text,
    chars: Number.isFinite(d.chars) ? Number(d.chars) : text.length,
    addedAt: String(d.addedAt || now()),
    scope,
    subtaskId: scope === "subtask" ? String(d.subtaskId || "") : "",
  };
}

function loadAll(runDir) {
  return readJsonl(file(runDir)).map(normalize);
}

// Metadata only (no text) — for publicState / the UI list, keeping state small.
function listMeta(runDir) {
  return loadAll(runDir).map((d) => ({ id: d.id, name: d.name, chars: d.chars, addedAt: d.addedAt, scope: d.scope, subtaskId: d.subtaskId }));
}

// Resolve the scope for a new document. opts.scope may force "shared"; otherwise a
// document attached while a subtask is active is scoped to that subtask, and one
// attached with no active subtask is chat-wide ("shared").
function resolveScope(opts = {}) {
  const subtaskId = String(opts.subtaskId || "");
  if (opts.scope === "shared") return { scope: "shared", subtaskId: "" };
  if (opts.scope === "library") return { scope: "library", subtaskId: "" };
  if (subtaskId) return { scope: "subtask", subtaskId };
  return { scope: "shared", subtaskId: "" };
}

function add(runDir, name, text, opts = {}) {
  const clean = String(text || "");
  if (!clean.trim()) return null;
  const truncated = clean.slice(0, MAX_DOC_CHARS);
  const { scope, subtaskId } = resolveScope(opts);
  const d = normalize({
    id: makeId("doc"),
    name: String(name || "document").slice(0, 200),
    text: truncated,
    chars: truncated.length,
    addedAt: now(),
    scope,
    subtaskId,
  });
  appendJsonl(file(runDir), d);
  return d;
}

// Re-scope an existing document (e.g. promote a library doc to shared, or attach
// it to a subtask). Returns false when the id is unknown or the request invalid.
function setScope(runDir, id, scope, subtaskId = "") {
  const list = loadAll(runDir);
  let changed = false;
  for (const d of list) {
    if (d.id !== id) continue;
    if (scope === "shared") { d.scope = "shared"; d.subtaskId = ""; }
    else if (scope === "library") { d.scope = "library"; d.subtaskId = ""; }
    else if (scope === "subtask" && String(subtaskId)) { d.scope = "subtask"; d.subtaskId = String(subtaskId); }
    else return false;
    changed = true;
  }
  if (!changed) return false;
  rewriteJsonl(file(runDir), list.map(normalize));
  return true;
}

function remove(runDir, id) {
  const list = loadAll(runDir);
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return false;
  rewriteJsonl(file(runDir), next);
  return true;
}

// Build the prompt section, capped to MAX_PROMPT_CHARS. Only "shared" documents
// and the active subtask's own documents are injected; "library" docs never are.
// Shared docs come first, then the active subtask's. Returns "" when none apply.
function snapshotForPrompt(runDir, activeSubtaskId = "") {
  const sid = String(activeSubtaskId || "");
  const list = loadAll(runDir)
    .filter((d) => d.scope === "shared" || (d.scope === "subtask" && d.subtaskId && d.subtaskId === sid))
    .sort((a, b) => (a.scope === b.scope ? 0 : a.scope === "shared" ? -1 : 1));
  if (!list.length) return "";
  let budget = MAX_PROMPT_CHARS;
  const parts = [];
  for (const d of list) {
    if (budget <= 0) { parts.push(`--- ${d.name} ---\n…[omitted — prompt document budget reached]`); break; }
    const slice = d.text.slice(0, budget);
    const trunc = slice.length < d.text.length ? "\n…[truncated]" : "";
    parts.push(`--- ${d.name} (${d.chars} chars) ---\n${slice}${trunc}`);
    budget -= slice.length;
  }
  return parts.join("\n\n");
}

module.exports = { loadAll, listMeta, add, setScope, remove, snapshotForPrompt, MAX_DOC_CHARS, MAX_PROMPT_CHARS };
