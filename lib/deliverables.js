// Phase 8 A2/B/C: versioned deliverable storage and safe delivery helpers.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { readJsonl, rewriteJsonl, appendJsonl, makeId, now, writeText, readText } = require("./store");

function indexFile(runDir) {
  return path.join(runDir, "deliverables.jsonl");
}

function dir(runDir) {
  return path.join(runDir, "deliverables");
}

function digestText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function kbDigest(kb) {
  return digestText(JSON.stringify((kb && kb.sections) || {}));
}

function safePart(value, fallback = "deliverable") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function normalize(item) {
  return {
    id: String(item.id || makeId("del")),
    template: String(item.template || "summary"),
    version: Number(item.version || 1),
    subtaskId: String(item.subtaskId || ""),
    sourceRound: Number(item.sourceRound || 0),
    kbDigest: String(item.kbDigest || ""),
    author: String(item.author || ""),
    reviewer: String(item.reviewer || ""),
    status: String(item.status || "ready"),
    createdAt: String(item.createdAt || now()),
    name: String(item.name || "deliverable.md"),
    path: String(item.path || ""),
    chars: Number(item.chars || 0),
    lastDelivery: item.lastDelivery || null,
  };
}

function loadAll(runDir, currentKbDigest = "") {
  return readJsonl(indexFile(runDir)).map(normalize).map((item) => ({
    ...item,
    stale: Boolean(currentKbDigest && item.kbDigest && item.kbDigest !== currentKbDigest),
  }));
}

function nextVersion(runDir, template) {
  const max = loadAll(runDir)
    .filter((item) => item.template === template)
    .reduce((n, item) => Math.max(n, item.version), 0);
  return max + 1;
}

function get(runDir, id, currentKbDigest = "") {
  const found = loadAll(runDir, currentKbDigest).find((item) => item.id === id);
  if (!found) throw new Error(`Deliverable ${id} not found`);
  return found;
}

function readContent(runDir, id) {
  const item = get(runDir, id);
  return readText(path.join(runDir, item.path));
}

function create(runDir, input) {
  const template = safePart(input.template || "summary", "summary");
  const version = nextVersion(runDir, template);
  const id = makeId("del");
  const base = `${template}-${version}-${safePart(input.subtaskId || id)}.md`;
  const rel = path.join("deliverables", base);
  const text = String(input.text || "");
  const item = normalize({
    id,
    template,
    version,
    subtaskId: input.subtaskId,
    sourceRound: input.sourceRound,
    kbDigest: input.kbDigest,
    author: input.author,
    reviewer: input.reviewer,
    status: input.status || "ready",
    name: base,
    path: rel,
    chars: text.length,
    createdAt: now(),
  });
  writeText(path.join(runDir, rel), text);
  appendJsonl(indexFile(runDir), item);
  return item;
}

function update(runDir, id, patch) {
  const all = loadAll(runDir);
  const idx = all.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error(`Deliverable ${id} not found`);
  all[idx] = normalize({ ...all[idx], ...patch });
  rewriteJsonl(indexFile(runDir), all);
  return all[idx];
}

function remove(runDir, id) {
  const all = loadAll(runDir);
  const idx = all.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error(`Deliverable ${id} not found`);
  const [item] = all.splice(idx, 1);
  rewriteJsonl(indexFile(runDir), all);
  const absPath = path.join(runDir, item.path || "");
  try {
    if (item.path && fs.existsSync(absPath)) fs.rmSync(absPath, { force: true });
  } catch {}
  return item;
}

function isWithinAllowedRoots(absPath, roots) {
  const lowerAbs = path.resolve(absPath).toLowerCase();
  const allowed = [roots.root, roots.workdir].filter(Boolean).map((p) => path.resolve(p).toLowerCase());
  return allowed.some((root) => lowerAbs === root || lowerAbs.startsWith(`${root}${path.sep}`));
}

function resolveTarget(targetPath, roots, options = {}) {
  const raw = String(targetPath || "").trim();
  if (!raw) throw new Error("targetPath required");
  const allowExternal = Boolean(options.allowExternal || roots.allowExternal);
  if (allowExternal) {
    if (!path.isAbsolute(raw)) throw new Error("Absolute targetPath required for external apply");
    return path.resolve(raw);
  }
  const base = path.resolve(roots.workdir || roots.root);
  const abs = path.resolve(path.isAbsolute(raw) ? raw : path.join(base, raw));
  const allowed = [roots.root, roots.workdir].filter(Boolean).map((p) => path.resolve(p).toLowerCase());
  if (!isWithinAllowedRoots(abs, roots)) {
    throw new Error(`Refusing to write outside allowed roots: ${allowed.join(", ")}`);
  }
  return abs;
}

function assertTargetIsFilePath(absPath) {
  if (!fs.existsSync(absPath)) return;
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    throw new Error(`Target must be a file path, not a folder: ${absPath}`);
  }
}

function simpleDiff(oldText, newText, maxLines = 120) {
  const oldLines = String(oldText || "").split(/\r?\n/);
  const newLines = String(newText || "").split(/\r?\n/);
  const out = [];
  const len = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < len && out.length < maxLines; i++) {
    const a = oldLines[i];
    const b = newLines[i];
    if (a === b) continue;
    if (a !== undefined) out.push(`- ${a}`);
    if (b !== undefined) out.push(`+ ${b}`);
  }
  if (out.length >= maxLines) out.push("... diff truncated ...");
  return out.join("\n") || "(no textual diff)";
}

function previewWrite(runDir, id, targetPath, roots, options = {}) {
  const item = get(runDir, id);
  const abs = resolveTarget(targetPath, roots, options);
  const content = readContent(runDir, id);
  assertTargetIsFilePath(abs);
  const exists = fs.existsSync(abs);
  const oldText = exists ? fs.readFileSync(abs, "utf8") : "";
  const isExternal = !isWithinAllowedRoots(abs, roots);
  return {
    deliverable: item,
    targetPath: abs,
    exists,
    isExternal,
    mode: exists ? "overwrite" : "new",
    chars: content.length,
    diff: exists ? simpleDiff(oldText, content) : "",
  };
}

function write(runDir, id, targetPath, opts = {}) {
  const preview = previewWrite(runDir, id, targetPath, opts.roots, opts);
  if (preview.exists && !opts.allowOverwrite) {
    throw new Error("Target exists and overwrite is disabled");
  }
  const content = readContent(runDir, id);
  fs.mkdirSync(path.dirname(preview.targetPath), { recursive: true });
  let backupPath = "";
  if (preview.exists) {
    backupPath = `${preview.targetPath}.bak-${now().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(preview.targetPath, backupPath);
  }
  const tmp = `${preview.targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, content, "utf8");
    fs.renameSync(tmp, preview.targetPath);
  } catch (error) {
    try { if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true }); } catch {}
    if (backupPath) {
      try { fs.copyFileSync(backupPath, preview.targetPath); } catch {}
    }
    throw error;
  }
  const item = update(runDir, id, {
    status: "delivered",
    lastDelivery: { at: now(), targetPath: preview.targetPath, mode: preview.mode, backupPath },
  });
  return { ...preview, backupPath, deliverable: item };
}

function makePacket(runDir, id, targetPath, roots) {
  const preview = previewWrite(runDir, id, targetPath, roots);
  const content = readContent(runDir, id);
  const packet = [
    `# Deliverable Handoff Packet`,
    ``,
    `Deliverable: ${preview.deliverable.name}`,
    `Target path: ${preview.targetPath}`,
    `Mode: ${preview.mode}`,
    ``,
    `## Operator Instructions`,
    `1. Review the deliverable content below.`,
    `2. Create or update the target file exactly with this content.`,
    `3. If overwriting, keep a backup before replacing the file.`,
    `4. Run the verification commands listed inside the deliverable, if any.`,
    ``,
    preview.diff ? `## Current Diff Preview\n\n\`\`\`diff\n${preview.diff}\n\`\`\`\n` : "",
    `## Deliverable Content`,
    ``,
    "```markdown",
    content,
    "```",
  ].filter(Boolean).join("\n");
  return create(runDir, {
    template: "handoff-packet",
    subtaskId: preview.deliverable.subtaskId,
    sourceRound: preview.deliverable.sourceRound,
    kbDigest: preview.deliverable.kbDigest,
    author: "system",
    reviewer: "",
    status: "packet",
    text: packet,
  });
}

module.exports = {
  kbDigest,
  loadAll,
  get,
  readContent,
  create,
  update,
  remove,
  previewWrite,
  write,
  makePacket,
};
