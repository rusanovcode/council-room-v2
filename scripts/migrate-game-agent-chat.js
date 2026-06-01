// One-off migration: carry the very-important "создать кор игрового агента" chat
// from Council Room v1 into Council Room v2 WITHOUT losing anything.
// - transcript: union of pruned current + full pre-prune backup (deduped, time-sorted)
// - documents: every attached source file, stored full-text (no truncation)
// - raw originals (uploads/, reports/, document-context.md) copied for safekeeping
// Re-runnable: it rewrites the target room from scratch each run.
const fs = require("node:fs");
const path = require("node:path");
const store = require("../lib/store");

const SRC = "C:\\AI\\Council Room\\rooms\\2026-05-22T15-33-40-262Z-создать-кор-игрового-агента-суть-изложена-в-файл";
const ID = "2026-05-22T15-33-40-262Z-создать-кор-игрового-агента-суть-изложена-в-файл";
const DST = path.join(__dirname, "..", "rooms", store.safeId(ID));

function loadJsonl(f) {
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// fs.cpSync crashes hard (STATUS_STACK_BUFFER_OVERRUN) on this Windows/Node22 box,
// so copy directory trees the manual way.
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

fs.mkdirSync(DST, { recursive: true });

// 1) state.json (v2 schema)
const srcState = JSON.parse(fs.readFileSync(path.join(SRC, "state.json"), "utf8"));
const state = {
  id: ID,
  topic: srcState.topic,
  createdAt: srcState.createdAt,
  rounds: Number(srcState.rounds) || 0,
  archived: false,
  trashed: false,
  settings: { language: (srcState.settings && srcState.settings.uiLanguage) || "ru" },
};
fs.writeFileSync(path.join(DST, "state.json"), JSON.stringify(state, null, 2));

// 2) transcript.jsonl — union(current, full backup), dedupe by id, sort by time
const current = loadJsonl(path.join(SRC, "transcript.jsonl"));
const backup = loadJsonl(path.join(SRC, "transcript.jsonl.bak-before-keep-last-2026-05-24T12-03-02-166Z"));
const byId = new Map();
for (const m of backup) byId.set(m.id, m);
for (const m of current) byId.set(m.id, m); // current wins on conflict (newer edits)
const merged = [...byId.values()]
  .sort((a, b) => new Date(a.at) - new Date(b.at))
  .map((m) => ({
    id: m.id,
    at: m.at,
    role: m.role,
    name: m.name,
    kind: m.kind || "",            // v1 had none/"documents"; v2 render only skips process/subtask-*
    subtaskId: m.subtaskId || "",
    round: Number(m.round) || 0,
    text: String(m.text || ""),
    ...(m.mode ? { mode: m.mode } : {}),
  }));
fs.writeFileSync(path.join(DST, "transcript.jsonl"), merged.map((m) => JSON.stringify(m)).join("\n") + "\n");

// 3) documents.jsonl — every attached source file, full text (no truncation, lose nothing)
const docSources = [
  ...fs.readdirSync(path.join(SRC, "uploads")).map((n) => ({ name: n, abs: path.join(SRC, "uploads", n) })),
  { name: "R144-codex-report.md", abs: path.join(SRC, "reports", "R144-codex-report.md") },
  { name: "R145-claude-code-report.md", abs: path.join(SRC, "reports", "R145-claude-code-report.md") },
  { name: "phase10_closure_review_20260524.md", abs: "C:\\Obsidian\\Forest\\phase10_closure_review_20260524.md" },
];
const docs = [];
for (const d of docSources) {
  if (!fs.existsSync(d.abs)) { console.warn("MISSING doc:", d.abs); continue; }
  const text = fs.readFileSync(d.abs, "utf8");
  const st = fs.statSync(d.abs);
  docs.push({ id: store.makeId("doc"), name: d.name, text, chars: text.length, addedAt: new Date(st.mtimeMs).toISOString() });
}
fs.writeFileSync(path.join(DST, "documents.jsonl"), docs.map((d) => JSON.stringify(d)).join("\n") + "\n");

// 4) raw preservation copies (so nothing is ever lost, even what v2 won't render)
copyDir(path.join(SRC, "uploads"), path.join(DST, "uploads"));
copyDir(path.join(SRC, "reports"), path.join(DST, "reports"));
if (fs.existsSync(path.join(SRC, "document-context.md")))
  fs.copyFileSync(path.join(SRC, "document-context.md"), path.join(DST, "document-context.md"));
fs.copyFileSync("C:\\Obsidian\\Forest\\phase10_closure_review_20260524.md", path.join(DST, "uploads", "phase10_closure_review_20260524.md"));

console.log("DONE →", DST);
console.log("  messages:", merged.length, "(current", current.length, "+ backup", backup.length, "deduped)");
console.log("  documents:", docs.length, docs.map((d) => `${d.name}(${d.chars})`).join(", "));
