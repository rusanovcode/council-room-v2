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

function normalize(d) {
  const text = String(d.text || "");
  return {
    id: String(d.id || ""),
    name: String(d.name || "document").slice(0, 200),
    text,
    chars: Number.isFinite(d.chars) ? Number(d.chars) : text.length,
    addedAt: String(d.addedAt || now()),
  };
}

function loadAll(runDir) {
  return readJsonl(file(runDir)).map(normalize);
}

// Metadata only (no text) — for publicState / the UI list, keeping state small.
function listMeta(runDir) {
  return loadAll(runDir).map((d) => ({ id: d.id, name: d.name, chars: d.chars, addedAt: d.addedAt }));
}

function add(runDir, name, text) {
  const clean = String(text || "");
  if (!clean.trim()) return null;
  const truncated = clean.slice(0, MAX_DOC_CHARS);
  const d = normalize({
    id: makeId("doc"),
    name: String(name || "document").slice(0, 200),
    text: truncated,
    chars: truncated.length,
    addedAt: now(),
  });
  appendJsonl(file(runDir), d);
  return d;
}

function remove(runDir, id) {
  const list = loadAll(runDir);
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return false;
  rewriteJsonl(file(runDir), next);
  return true;
}

// Build the prompt section, capped to MAX_PROMPT_CHARS across all documents.
// Returns "" when there are none.
function snapshotForPrompt(runDir) {
  const list = loadAll(runDir);
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

module.exports = { loadAll, listMeta, add, remove, snapshotForPrompt, MAX_DOC_CHARS, MAX_PROMPT_CHARS };
