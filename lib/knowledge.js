const path = require("node:path");
const { readText, writeText, now } = require("./store");

const SECTIONS = [
  { key: "decisions", title: "Decisions (Frozen)" },
  { key: "prohibitions", title: "Prohibitions" },
  { key: "control_contract", title: "Control Contract" },
  { key: "files_in_scope", title: "Files in Scope" },
  { key: "files_out_of_scope", title: "Files Out of Scope" },
  { key: "verification_commands", title: "Verification Commands" },
  { key: "open_questions", title: "Open Questions" },
];

function knowledgeFile(runDir) {
  return path.join(runDir, "knowledge.md");
}

function emptyKB() {
  const lines = ["# Knowledge Base", "", `Updated: ${now()}`, ""];
  for (const section of SECTIONS) {
    lines.push(`## ${section.title}`, "", "_(empty)_", "");
  }
  return lines.join("\n");
}

function load(runDir) {
  const text = readText(knowledgeFile(runDir));
  if (!text.trim()) return parse(emptyKB());
  return parse(text);
}

function save(runDir, parsed) {
  writeText(knowledgeFile(runDir), serialize(parsed));
}

function parse(text) {
  const sections = {};
  for (const section of SECTIONS) sections[section.key] = [];
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      const title = heading[1].trim();
      const found = SECTIONS.find((s) => s.title === title);
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

function serialize(parsed) {
  const lines = ["# Knowledge Base", "", `Updated: ${parsed.updatedAt || now()}`, ""];
  for (const section of SECTIONS) {
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

function addItem(runDir, sectionKey, item) {
  if (!SECTIONS.find((s) => s.key === sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir);
  const clean = String(item || "").trim();
  if (!clean) return parsed;
  const list = parsed.sections[sectionKey];
  if (!list.includes(clean)) list.push(clean);
  parsed.updatedAt = now();
  save(runDir, parsed);
  return parsed;
}

function removeItem(runDir, sectionKey, item) {
  const parsed = load(runDir);
  const list = parsed.sections[sectionKey] || [];
  parsed.sections[sectionKey] = list.filter((value) => value !== item);
  parsed.updatedAt = now();
  save(runDir, parsed);
  return parsed;
}

function replaceSection(runDir, sectionKey, items) {
  if (!SECTIONS.find((s) => s.key === sectionKey)) throw new Error(`Unknown section: ${sectionKey}`);
  const parsed = load(runDir);
  parsed.sections[sectionKey] = Array.isArray(items)
    ? items.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  parsed.updatedAt = now();
  save(runDir, parsed);
  return parsed;
}

function snapshotForPrompt(runDir) {
  const parsed = load(runDir);
  const lines = [];
  let nonEmpty = 0;
  for (const section of SECTIONS) {
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
  addItem,
  removeItem,
  replaceSection,
  snapshotForPrompt,
};
