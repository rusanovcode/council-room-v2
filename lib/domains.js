"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Profile registry. Adding a profile here is the only change needed to
// support a new discussion domain — no edits to server.js or prompt.js.
// TAIL_CONTRACT (anchors, statusValues, signals) is invariant across all
// profiles and lives in prompt.js; profiles only define systemLines + sections.

const BUILTIN = [
  {
    id: "code",
    label: { ru: "Разработка ПО", en: "Software" },
    guards: { scanApplies: true, scopeApplies: true },
    systemLines: [
      "You are a participant in Council Room v2 — a closed room of 2 to 5 AI agents.",
      "Room goal: drive every open subtask to a closed state through structured debate.",
      "",
      "Rules (fixed, no need to repeat):",
      "- Debate is strictly read-only. Do not implement, do not modify files.",
      "- Answer about THE ONE active subtask only. Do not discuss past/future ones.",
      "- If the active subtask lacks facts — start with `QUESTION:` and up to 3 short questions.",
      "- If facts are sufficient — give a position, risks, open questions, and a `REPORT:` block.",
      "- Each answer ≤ 12 sentences. Brevity is a feature, not a flaw.",
    ],
    sections: [
      { key: "decisions",             title: "Decisions (Frozen)", scope: "subtask" },
      { key: "prohibitions",          title: "Prohibitions", scope: "global" },
      { key: "control_contract",      title: "Control Contract", scope: "global" },
      { key: "files_in_scope",        title: "Files in Scope", scope: "subtask" },
      { key: "files_out_of_scope",    title: "Files Out of Scope", scope: "subtask" },
      { key: "verification_commands", title: "Verification Commands", scope: "subtask" },
      { key: "open_questions",        title: "Open Questions", scope: "subtask" },
    ],
  },
  {
    id: "general",
    label: { ru: "Общий", en: "General" },
    guards: { scanApplies: false, scopeApplies: false },
    systemLines: [
      "You are a participant in Council Room — a closed room of 2 to 5 AI agents.",
      "Room goal: drive every open subtask to a closed state through structured debate.",
      "",
      "Rules (fixed, no need to repeat):",
      "- This is a discussion, not execution: reason, weigh options, decide. Do not perform external actions.",
      "- Answer about THE ONE active subtask only. Do not discuss past or future ones.",
      "- Ground every claim in the subtask text, the Knowledge Base, or any attached documents.",
      "  Do not invent facts — if something is missing, start with `QUESTION:` and up to 3 short questions.",
      "- If the facts are sufficient — give a clear position, the main objections to it, and what stays open.",
      "- Each answer ≤ 12 sentences. Brevity is a feature, not a flaw.",
      "- In the closing lines, read 'New risks' as weaknesses / objections to your position,",
      "  and 'New alternatives' as competing options or interpretations.",
    ],
    sections: [
      { key: "key_claims",     title: "Key Claims",     tipRu: "Главные тезисы и позиции по задаче.",           tipEn: "Main claims and positions on the task." },
      { key: "evidence",       title: "Evidence",       tipRu: "Факты, данные и доводы в подтверждение тезисов.", tipEn: "Facts, data and reasoning that support the claims." },
      { key: "definitions",    title: "Definitions",    tipRu: "Согласованные термины и трактовки.",            tipEn: "Agreed terms and framings." },
      { key: "constraints",    title: "Constraints",    tipRu: "Условия и рамки задачи: что нельзя нарушать.",  tipEn: "Conditions and boundaries that must hold." },
      { key: "decisions",      title: "Decisions",      tipRu: "Зафиксированные выводы.",                       tipEn: "Settled conclusions." },
      { key: "open_questions", title: "Open Questions", tipRu: "Что ещё не решено.",                            tipEn: "What remains unresolved." },
    ],
  },
  {
    id: "research",
    label: { ru: "Исследование", en: "Research" },
    guards: { scanApplies: false, scopeApplies: false },
    systemLines: [
      "You are a participant in Council Room — a closed room of 2 to 5 AI agents.",
      "Room goal: drive every open subtask (research question) to a closed state through structured debate.",
      "",
      "Rules (fixed, no need to repeat):",
      "- This is an analytical inquiry: argue from evidence, separate fact from inference.",
      "- Answer about THE ONE active subtask only.",
      "- Every factual claim must be traceable to a source, the Knowledge Base, or attached documents.",
      "  Record sources in the Sources section. Do not fabricate citations — if a source is missing, ask via `QUESTION:`.",
      "- Explicitly distinguish established fact, reasoned inference, and speculation.",
      "- If the evidence is sufficient — state conclusions with their degree of confidence and the strongest counterpoints.",
      "- Each answer ≤ 12 sentences.",
      "- In the closing lines, read 'New risks' as weak points / threats to a conclusion's validity,",
      "  and 'New alternatives' as competing hypotheses or interpretations.",
    ],
    sections: [
      { key: "thesis",         title: "Thesis",              tipRu: "Исследуемый вопрос или гипотеза.",              tipEn: "The question under study or the hypothesis." },
      { key: "definitions",    title: "Definitions & Scope", tipRu: "Термины и границы исследования.",               tipEn: "Terms and the boundaries of the inquiry." },
      { key: "evidence",       title: "Evidence",            tipRu: "Данные, наблюдения, цитаты за/против.",         tipEn: "Data, observations, quotes for or against." },
      { key: "sources",        title: "Sources",             tipRu: "Первоисточники и ссылки.",                      tipEn: "Primary sources and references." },
      { key: "counterpoints",  title: "Counterpoints",       tipRu: "Возражения и альтернативные гипотезы.",         tipEn: "Objections and competing hypotheses." },
      { key: "conclusions",    title: "Conclusions",         tipRu: "Обоснованные выводы с уверенностью.",           tipEn: "Justified conclusions with stated confidence." },
      { key: "open_questions", title: "Open Questions",      tipRu: "Что ещё не выяснено.",                          tipEn: "What remains to be established." },
    ],
  },
  {
    id: "creative",
    label: { ru: "Творческий", en: "Creative" },
    guards: { scanApplies: false, scopeApplies: false },
    systemLines: [
      "You are a participant in Council Room — a closed room of 2 to 5 AI agents.",
      "Room goal: drive every open subtask to a closed state through structured debate.",
      "",
      "Rules (fixed, no need to repeat):",
      "- This is a creative / interpretive discussion: develop ideas, weigh choices, refine the work.",
      "- Answer about THE ONE active subtask only.",
      "- Build on the premise, themes and constraints in the Knowledge Base and attached documents.",
      "  If the brief is unclear, ask via `QUESTION:` before inventing a direction.",
      "- Offer concrete options and their trade-offs, not vague praise; respect the stated constraints (genre, tone, length).",
      "- Each answer ≤ 12 sentences.",
      "- In the closing lines, read 'New risks' as weaknesses / what could fall flat,",
      "  and 'New alternatives' as other creative directions worth considering.",
    ],
    sections: [
      { key: "premise",        title: "Premise",       tipRu: "Замысел: идея, посыл, вопрос произведения.",   tipEn: "Core idea, message or question of the work." },
      { key: "themes",         title: "Themes",        tipRu: "Темы и мотивы, которые держим.",               tipEn: "Themes and motifs to sustain." },
      { key: "constraints",    title: "Constraints",   tipRu: "Рамки: жанр, тон, объём, стиль.",              tipEn: "Boundaries: genre, tone, length, style." },
      { key: "elements",       title: "Elements",      tipRu: "Персонажи, образы, структура.",                tipEn: "Characters, images, structure." },
      { key: "decisions",      title: "Decisions",     tipRu: "Зафиксированные творческие решения.",          tipEn: "Settled creative choices." },
      { key: "open_questions", title: "Open Questions", tipRu: "Открытые творческие развилки.",               tipEn: "Open creative forks." },
    ],
  },
  {
    id: "free",
    label: { ru: "Свободный спор", en: "Free Debate" },
    guards: { scanApplies: false, scopeApplies: false },
    systemLines: [
      "You and the other participants debate ONE subtask, by talking to each other, to reach a shared conclusion.",
      "No domain rules, tone, structure, or format are imposed beyond the lines below.",
      "- Defend your position with reasoning. Agree only when the other's argument is actually correct — and say why.",
      "  Never concede just to end the discussion faster. If the other is wrong, show concretely where and why.",
      "- Drive the open questions to answers the same way: argue them out, don't leave them hanging.",
      "- Reach agreement on the merits, not by splitting the difference.",
      "- When ALL participants genuinely agree, end with Status: resolve. Until then Status: continue (or block if you need the user).",
      "- Be brief: a few sentences. No filler, no restating what was already said. Brevity saves tokens.",
    ],
    sections: [
      { key: "notes",          title: "Notes",          tipRu: "Свободные заметки без фиксированной структуры.", tipEn: "Free-form notes without a fixed structure." },
      { key: "decisions",      title: "Decisions",      tipRu: "Любые зафиксированные выводы.",                  tipEn: "Any settled conclusions." },
      { key: "open_questions", title: "Open Questions", tipRu: "Что ещё не решено.",                             tipEn: "What remains unresolved." },
    ],
  },
];

const DEFAULT = "code";
const PROFILES_DIR = path.join(__dirname, "..", "profiles");
const SECTION_SCOPE = { GLOBAL: "global", SUBTASK: "subtask" };

// Live registry = built-in profiles (above) + user profiles loaded from
// PROFILES_DIR/*.md. reload() re-scans the folder; createProfile() writes a new
// file and reloads, so a new profile is usable without restarting the process.
let PROFILES = BUILTIN.slice();
let _map = new Map(PROFILES.map((p) => [p.id, p]));

function _rebuild(fileProfiles) {
  PROFILES = BUILTIN.concat(fileProfiles);
  _map = new Map(PROFILES.map((p) => [p.id, p]));
}

const ID_RE = /^[a-z][a-z0-9_]*$/;
const SECTION_KEY_RE = /^[a-z_]+$/; // the KB-patch parser only accepts [a-z_]+ section keys
const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v == null ? "" : v).trim());
const oneLine = (v) => String(v == null ? "" : v).replace(/[\r\n|]/g, " ").trim();
const normalizeSectionScope = (v) => String(v || "").trim().toLowerCase() === SECTION_SCOPE.SUBTASK
  ? SECTION_SCOPE.SUBTASK
  : SECTION_SCOPE.GLOBAL;
const sectionScope = (section) => normalizeSectionScope(section && section.scope);

// Parse a profile .md file: a `---` frontmatter block followed by a body that
// becomes systemLines (the prompt). Returns a profile object, or null when the
// text is not a valid profile — so non-profile files (README.md, notes) are skipped.
function parseProfileFile(text, fallbackId) {
  const norm = String(text).replace(/\r\n/g, "\n");
  const m = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  const sections = [];
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (!mm) continue;
    const key = mm[1].toLowerCase();
    const val = mm[2].trim();
    if (key === "section") {
      const parts = val.split("|").map((s) => s.trim());
      const skey = (parts[0] || "").toLowerCase();
      if (!skey || !SECTION_KEY_RE.test(skey)) continue;
      sections.push({
        key: skey,
        title: parts[1] || skey,
        tipEn: parts[2] || "",
        tipRu: parts[2] || "",
        scope: skey === "open_questions"
          ? normalizeSectionScope(parts[3] || SECTION_SCOPE.SUBTASK)
          : normalizeSectionScope(parts[3]),
      });
    } else {
      meta[key] = val;
    }
  }
  const id = (meta.id || fallbackId || "").trim().toLowerCase();
  if (!ID_RE.test(id)) return null;
  // Body → systemLines: preserve internal blank lines, trim leading/trailing blanks.
  let body = m[2].split("\n");
  while (body.length && body[0].trim() === "") body.shift();
  while (body.length && body[body.length - 1].trim() === "") body.pop();
  if (!body.length) return null;
  // open_questions is mandatory — the questions/verify logic depends on it.
  if (!sections.some((s) => s.key === "open_questions")) {
    sections.push({ key: "open_questions", title: "Open Questions", scope: SECTION_SCOPE.SUBTASK });
  }
  return {
    id,
    label: { ru: meta.label_ru || meta.label_en || id, en: meta.label_en || meta.label_ru || id },
    guards: { scanApplies: truthy(meta.scan), scopeApplies: truthy(meta.scope) },
    systemLines: body,
    sections,
    source: "file",
  };
}

// Serialize a profile back to the .md file format (round-trips with parseProfileFile).
function serializeProfile(p) {
  const lines = [
    "---",
    `id: ${p.id}`,
    `label_en: ${oneLine(p.label && p.label.en) || p.id}`,
    `label_ru: ${oneLine(p.label && p.label.ru) || oneLine(p.label && p.label.en) || p.id}`,
    `scan: ${p.guards && p.guards.scanApplies ? "true" : "false"}`,
    `scope: ${p.guards && p.guards.scopeApplies ? "true" : "false"}`,
  ];
  for (const s of p.sections || []) {
    const tip = oneLine(s.tipEn || s.tip || "");
    const cells = [oneLine(s.key), oneLine(s.title) || oneLine(s.key)];
    if (tip) cells.push(tip);
    if (sectionScope(s) === SECTION_SCOPE.SUBTASK) cells.push(SECTION_SCOPE.SUBTASK);
    lines.push(`section: ${cells.join(" | ")}`);
  }
  lines.push("---", "");
  for (const l of p.systemLines || []) lines.push(String(l).replace(/\r/g, ""));
  lines.push("");
  return lines.join("\n");
}

function loadFromDir(dir) {
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
  } catch {
    return []; // folder absent — only built-ins
  }
  const out = [];
  const seen = new Set(BUILTIN.map((p) => p.id));
  for (const f of files.sort()) {
    let text;
    try { text = fs.readFileSync(path.join(dir, f), "utf8"); } catch { continue; }
    const prof = parseProfileFile(text, path.basename(f, ".md"));
    if (!prof) { console.warn(`[domains] skipped ${f}: not a valid profile file`); continue; }
    if (seen.has(prof.id)) { console.warn(`[domains] skipped ${f}: id "${prof.id}" already exists`); continue; }
    seen.add(prof.id);
    out.push(prof);
  }
  return out;
}

function reload() {
  _rebuild(loadFromDir(PROFILES_DIR));
  return PROFILES.map((p) => p.id);
}

// Validate + persist a new profile to PROFILES_DIR/<id>.md, then reload so it is
// immediately usable. Throws on invalid input or id collision. Returns the new id.
function createProfile(input) {
  const id = String((input && input.id) || "").trim().toLowerCase();
  if (!ID_RE.test(id)) throw new Error("id must match ^[a-z][a-z0-9_]*$ (lowercase letter, then letters/digits/_)");
  if (_map.has(id)) throw new Error(`profile "${id}" already exists`);

  let systemLines = Array.isArray(input.systemLines)
    ? input.systemLines.map((l) => String(l).replace(/\r/g, ""))
    : String(input.systemLines || "").replace(/\r\n/g, "\n").split("\n");
  while (systemLines.length && systemLines[0].trim() === "") systemLines.shift();
  while (systemLines.length && systemLines[systemLines.length - 1].trim() === "") systemLines.pop();
  if (!systemLines.length) throw new Error("systemLines (the prompt) must not be empty");
  if (systemLines.some((l) => l.trim() === "---")) throw new Error("the prompt body must not contain a line that is just '---'");

  let sections = (Array.isArray(input.sections) ? input.sections : [])
    .map((s) => ({
      key: String((s && s.key) || "").trim().toLowerCase(),
      title: oneLine((s && s.title) || ""),
      tipEn: oneLine((s && (s.tipEn || s.tip)) || ""),
      scope: String((s && s.key) || "").trim().toLowerCase() === "open_questions"
        ? normalizeSectionScope((s && s.scope) || SECTION_SCOPE.SUBTASK)
        : normalizeSectionScope(s && s.scope),
    }))
    .filter((s) => s.key);
  for (const s of sections) {
    if (!SECTION_KEY_RE.test(s.key)) throw new Error(`section key "${s.key}" must match ^[a-z_]+$ (lowercase letters/underscores)`);
    if (!s.title) s.title = s.key;
    s.tipRu = s.tipEn;
  }
  if (!sections.some((s) => s.key === "open_questions")) {
    sections.push({ key: "open_questions", title: "Open Questions", scope: SECTION_SCOPE.SUBTASK });
  }

  const profile = {
    id,
    label: {
      en: oneLine((input.label && input.label.en) || id) || id,
      ru: oneLine((input.label && (input.label.ru || input.label.en)) || id) || id,
    },
    guards: {
      scanApplies: Boolean(input.guards && input.guards.scanApplies),
      scopeApplies: Boolean(input.guards && input.guards.scopeApplies),
    },
    systemLines,
    sections,
  };

  try { fs.mkdirSync(PROFILES_DIR, { recursive: true }); } catch {}
  fs.writeFileSync(path.join(PROFILES_DIR, `${id}.md`), serializeProfile(profile), "utf8");
  reload();
  return id;
}

function getProfile(id) {
  return _map.get(id) || _map.get(DEFAULT);
}

function list() {
  return PROFILES.map((p) => p.id);
}

// Lightweight list for the UI profile selector: {id, label} only (no systemLines/
// sections payload). Lets the frontend build the dropdown straight from the
// registry — adding a profile here makes it appear in the UI with no app.js edit.
function options() {
  return PROFILES.map((p) => ({ id: p.id, label: p.label }));
}

// Load user profiles from disk at startup.
reload();

module.exports = {
  getProfile, DEFAULT, list, options,
  SECTION_SCOPE, sectionScope,
  reload, createProfile, parseProfileFile, serializeProfile, PROFILES_DIR,
};
