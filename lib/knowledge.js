const path = require("node:path");
const { readText, writeText, now } = require("./store");
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

function knowledgeFile(runDir) {
  return path.join(runDir, "knowledge.md");
}

function emptyKB(sects) {
  const lines = ["# Knowledge Base", "", `Updated: ${now()}`, ""];
  for (const section of sects) {
    lines.push(`## ${section.title}`, "", "_(empty)_", "");
  }
  return lines.join("\n");
}

function load(runDir, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  const text = readText(knowledgeFile(runDir));
  if (!text.trim()) return parse(emptyKB(sects), sects);
  return parse(text, sects);
}

function save(runDir, parsed, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  writeText(knowledgeFile(runDir), serialize(parsed, sects));
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

function addItem(runDir, sectionKey, item, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  if (!sects.find((s) => s.key === sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir, sects);
  const clean = String(item || "").trim();
  if (!clean) return parsed;
  const list = parsed.sections[sectionKey];
  const isDup = list.some((existing) => existing === clean || similarity(existing, clean) >= KB_DUP_THRESHOLD);
  if (!isDup) list.push(clean);
  parsed.updatedAt = now();
  save(runDir, parsed, sects);
  return parsed;
}

function removeItem(runDir, sectionKey, item, domainIdOrSections) {
  const parsed = load(runDir, domainIdOrSections);
  const list = parsed.sections[sectionKey] || [];
  parsed.sections[sectionKey] = list.filter((value) => value !== item);
  parsed.updatedAt = now();
  save(runDir, parsed, domainIdOrSections);
  return parsed;
}

function replaceSection(runDir, sectionKey, items, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  if (!sects.find((s) => s.key === sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir, sects);
  parsed.sections[sectionKey] = Array.isArray(items)
    ? items.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  parsed.updatedAt = now();
  save(runDir, parsed, sects);
  return parsed;
}

function snapshotForPrompt(runDir, domainIdOrSections) {
  const sects = _sections(domainIdOrSections);
  const parsed = load(runDir, sects);
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
};
