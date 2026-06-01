const path = require("node:path");
const { readText, writeText, readJson, writeJson, now } = require("./store");
const { similarity } = require("./questions");
const domains = require("./domains");

// Durable KB items are short; only collapse near-identical rewordings, never
// merge genuinely distinct entries.
const KB_DUP_THRESHOLD = 0.85;

// Legacy export — the code-profile section list. Kept for any callers that
// reference SECTIONS directly; all internal functions now accept a section set.
const SECTIONS = domains.getProfile("code").sections;

function _sections(domainIdOrSections) {
  if (!domainIdOrSections) return SECTIONS;
  if (Array.isArray(domainIdOrSections)) return domainIdOrSections;
  return domains.getProfile(domainIdOrSections).sections;
}

function _context(domainIdOrSections, context = {}) {
  return {
    sects: _sections(domainIdOrSections),
    subtaskId: String((context && context.subtaskId) || "").trim(),
    migrateLegacy: Boolean(!context || context.migrateLegacy !== false),
  };
}

function _sectionByKey(sects, key) {
  return sects.find((s) => s.key === key) || null;
}

function _isSubtaskSection(section) {
  return domains.sectionScope(section) === domains.SECTION_SCOPE.SUBTASK;
}

function _cleanList(items) {
  return Array.isArray(items)
    ? items.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
}

function _pushDedup(list, item) {
  const isDup = list.some((existing) => existing === item || similarity(existing, item) >= KB_DUP_THRESHOLD);
  if (!isDup) list.push(item);
}

function knowledgeFile(runDir) {
  return path.join(runDir, "knowledge.md");
}

function scopeFile(runDir) {
  return path.join(runDir, "kb-scope.json");
}

function emptyKB(sects) {
  const lines = ["# Knowledge Base", "", `Updated: ${now()}`, ""];
  for (const section of sects) {
    lines.push(`## ${section.title}`, "", "_(empty)_", "");
  }
  return lines.join("\n");
}

function loadGlobal(runDir, sects) {
  const text = readText(knowledgeFile(runDir));
  if (!text.trim()) return parse(emptyKB(sects), sects);
  return parse(text, sects);
}

function saveGlobal(runDir, parsed, sects) {
  writeText(knowledgeFile(runDir), serialize(parsed, sects));
}

function loadScoped(runDir) {
  const raw = readJson(scopeFile(runDir), {});
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [subtaskId, sections] of Object.entries(raw)) {
    const sid = String(subtaskId || "").trim();
    if (!sid || !sections || typeof sections !== "object" || Array.isArray(sections)) continue;
    const bucket = {};
    for (const [key, items] of Object.entries(sections)) {
      bucket[key] = _cleanList(items);
    }
    out[sid] = bucket;
  }
  return out;
}

function saveScoped(runDir, scoped) {
  const clean = {};
  for (const [subtaskId, sections] of Object.entries(scoped || {})) {
    const sid = String(subtaskId || "").trim();
    if (!sid || !sections || typeof sections !== "object" || Array.isArray(sections)) continue;
    const bucket = {};
    let nonEmpty = 0;
    for (const [key, items] of Object.entries(sections)) {
      const list = _cleanList(items);
      bucket[key] = list;
      if (list.length) nonEmpty += 1;
    }
    if (nonEmpty > 0) clean[sid] = bucket;
  }
  writeJson(scopeFile(runDir), clean);
}

function migrateLegacyPerSubtask(runDir, parsedGlobal, sects, subtaskId) {
  if (!subtaskId) return parsedGlobal;
  const scopedSections = sects.filter((section) => _isSubtaskSection(section) && section.key !== "open_questions");
  if (!scopedSections.length) return parsedGlobal;
  const legacy = scopedSections
    .map((section) => ({ key: section.key, items: _cleanList(parsedGlobal.sections[section.key]) }))
    .filter((entry) => entry.items.length);
  if (!legacy.length) return parsedGlobal;

  const scoped = loadScoped(runDir);
  const bucket = scoped[subtaskId] && typeof scoped[subtaskId] === "object" ? { ...scoped[subtaskId] } : {};
  for (const entry of legacy) {
    const list = _cleanList(bucket[entry.key]);
    for (const item of entry.items) _pushDedup(list, item);
    bucket[entry.key] = list;
    parsedGlobal.sections[entry.key] = [];
  }
  scoped[subtaskId] = bucket;
  saveScoped(runDir, scoped);
  parsedGlobal.updatedAt = now();
  saveGlobal(runDir, parsedGlobal, sects);
  return parsedGlobal;
}

function load(runDir, domainIdOrSections, context = {}) {
  const { sects, subtaskId, migrateLegacy } = _context(domainIdOrSections, context);
  let parsedGlobal = loadGlobal(runDir, sects);
  if (!subtaskId) return parsedGlobal;
  if (migrateLegacy) parsedGlobal = migrateLegacyPerSubtask(runDir, parsedGlobal, sects, subtaskId);

  const scoped = loadScoped(runDir);
  const bucket = scoped[subtaskId] && typeof scoped[subtaskId] === "object" ? scoped[subtaskId] : {};
  const sections = {};
  for (const section of sects) {
    if (_isSubtaskSection(section) && section.key !== "open_questions") {
      sections[section.key] = _cleanList(bucket[section.key]);
    } else {
      sections[section.key] = _cleanList(parsedGlobal.sections[section.key]);
    }
  }
  return { sections, updatedAt: parsedGlobal.updatedAt };
}

function save(runDir, parsed, domainIdOrSections, context = {}) {
  const { sects, subtaskId } = _context(domainIdOrSections, context);
  if (!subtaskId) {
    saveGlobal(runDir, parsed, sects);
    return;
  }

  const currentGlobal = loadGlobal(runDir, sects);
  const scoped = loadScoped(runDir);
  const bucket = scoped[subtaskId] && typeof scoped[subtaskId] === "object" ? { ...scoped[subtaskId] } : {};
  const globalOut = { sections: {}, updatedAt: parsed.updatedAt || now() };
  for (const section of sects) {
    const key = section.key;
    if (_isSubtaskSection(section) && key !== "open_questions") {
      bucket[key] = _cleanList(parsed.sections[key]);
      globalOut.sections[key] = _cleanList(currentGlobal.sections[key]);
    } else {
      globalOut.sections[key] = _cleanList(parsed.sections[key]);
    }
  }
  scoped[subtaskId] = bucket;
  saveScoped(runDir, scoped);
  saveGlobal(runDir, globalOut, sects);
}

function parse(text, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  const sections = {};
  for (const section of sects) sections[section.key] = [];
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      const title = heading[1].trim();
      const found = sects.find((s) => s.title === title);
      current = found ? found.key : "";
      continue;
    }
    if (!current) continue;
    const item = line.trim();
    if (!item || item === "_(empty)_") continue;
    if (item.startsWith("- ") || item.startsWith("* ")) {
      sections[current].push(item.slice(2).trim());
    } else if (item.startsWith("| ") && current === "control_contract") {
      sections[current].push(item);
    }
  }
  return { sections, updatedAt: now() };
}

function serialize(parsed, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  const lines = ["# Knowledge Base", "", `Updated: ${parsed.updatedAt || now()}`, ""];
  for (const section of sects) {
    lines.push(`## ${section.title}`, "");
    const items = parsed.sections[section.key] || [];
    if (!items.length) {
      lines.push("_(empty)_");
    } else if (section.key === "control_contract") {
      for (const item of items) lines.push(item);
    } else {
      for (const item of items) lines.push(`- ${item}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function addItem(runDir, sectionKey, item, domainIdOrSections, context = {}) {
  const { sects, subtaskId } = _context(domainIdOrSections, context);
  if (!_sectionByKey(sects, sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir, sects, { subtaskId });
  const clean = String(item || "").trim();
  if (!clean) return parsed;
  const list = parsed.sections[sectionKey];
  _pushDedup(list, clean);
  parsed.updatedAt = now();
  save(runDir, parsed, sects, { subtaskId });
  return parsed;
}

function removeItem(runDir, sectionKey, item, domainIdOrSections, context = {}) {
  const { sects, subtaskId } = _context(domainIdOrSections, context);
  if (!_sectionByKey(sects, sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir, sects, { subtaskId });
  const list = parsed.sections[sectionKey] || [];
  parsed.sections[sectionKey] = list.filter((value) => value !== item);
  parsed.updatedAt = now();
  save(runDir, parsed, sects, { subtaskId });
  return parsed;
}

function replaceSection(runDir, sectionKey, items, domainIdOrSections, context = {}) {
  const { sects, subtaskId } = _context(domainIdOrSections, context);
  if (!_sectionByKey(sects, sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir, sects, { subtaskId });
  parsed.sections[sectionKey] = _cleanList(items);
  parsed.updatedAt = now();
  save(runDir, parsed, sects, { subtaskId });
  return parsed;
}

function snapshotForPrompt(runDir, domainIdOrSections, context = {}) {
  const { sects, subtaskId } = _context(domainIdOrSections, context);
  const parsed = load(runDir, sects, { subtaskId });
  const lines = [];
  let nonEmpty = 0;
  for (const section of sects) {
    // open_questions live in the per-subtask questions store and are sent to the
    // prompt as a dedicated OPEN QUESTIONS block — keep them out of the KB snapshot.
    if (section.key === "open_questions") continue;
    const items = parsed.sections[section.key] || [];
    if (!items.length) continue;
    nonEmpty += 1;
    lines.push(`### ${section.title}`);
    for (const item of items.slice(0, 30)) {
      lines.push(section.key === "control_contract" ? item : `- ${item}`);
    }
    lines.push("");
  }
  if (!nonEmpty) return "(empty)";
  return lines.join("\n").trim();
}

function isSubtaskScoped(sectionKey, domainIdOrSections) {
  const section = _sectionByKey(_sections(domainIdOrSections), sectionKey);
  return Boolean(section && _isSubtaskSection(section));
}

module.exports = {
  SECTIONS,
  load,
  save,
  parse,
  serialize,
  addItem,
  removeItem,
  replaceSection,
  snapshotForPrompt,
  isSubtaskScoped,
};
