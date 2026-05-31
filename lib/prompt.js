const knowledge = require("./knowledge");
const domains = require("./domains");

// Single source of truth for the machine-readable tail anchors.
// Profiles may change systemLines/sections, but NEVER these anchors.
const TAIL_CONTRACT = {
  emptyTokens: ["none", "нет"],
  statusValues: ["continue", "resolve", "block"],
  fields: [
    { key: "newFacts",        anchor: "New facts",        hint: "[list or 'none']", list: true },
    { key: "newRisks",        anchor: "New risks",        hint: "[list or 'none']", list: true },
    { key: "newAlternatives", anchor: "New alternatives", hint: "[list or 'none']", list: true },
    { key: "status",          anchor: "Status",           hint: "continue | resolve | block" },
    { key: "kbPatch",         anchor: "KB-patch",         hint: "[section: item] (one line per patch, or 'none')" },
  ],
  signals: { resolved: "Resolved", verify: "Verify", priority: "Priority" },
  statusSemantics: [
    "- Status=resolve means: the subtask is ready to close (nothing left to debate).",
    "- Status=block means: the subtask is blocked — state what is needed from the user.",
  ],
};

function availableSectionsLines(keys, maxWidth = 78) {
  const head = "    Available KB sections: ", indent = "    ";
  const out = []; let line = head, atStart = true;
  keys.forEach((key, i) => {
    const piece = key + (i < keys.length - 1 ? "," : "");
    const candidate = atStart ? line + piece : line + " " + piece;
    if (!atStart && candidate.length > maxWidth) { out.push(line); line = indent + piece; }
    else line = candidate;
    atStart = false;
  });
  out.push(line);
  return out;
}

function tailPromptLines(sectionKeys) {
  const lines = ["- Every answer MUST end with these lines:"];
  for (const f of TAIL_CONTRACT.fields) lines.push(`    ${f.anchor}: ${f.hint}`);
  lines.push(...availableSectionsLines(sectionKeys));
  lines.push(...TAIL_CONTRACT.statusSemantics);
  return lines;
}

// Prompt scaffolding is kept in English as the single source of truth (best for
// the models, and the machine-readable tail tokens below are English anyway).
// The agent's RESPONSE language is controlled separately by the LANGUAGE
// directive at the top of each prompt (see buildDebatePrompt/buildSynthesisPrompt).
// Shared protocol block for OPEN QUESTIONS / Resolved / Priority / Verify signals.
// Anchor words match TAIL_CONTRACT.signals — kept in sync as literals here since
// they are also rendered in the prompt text (not just parsed as machine tokens).
const QUESTIONS_PROTOCOL = [
  "Working with OPEN QUESTIONS (when an OPEN QUESTIONS block is shown):",
  "- Each question has a stable ID (Q1, Q2…). Do not rephrase an already-open question —",
  "  refer to its ID. Raise a new question via KB-patch: open_questions: <text>.",
  "- When a question becomes clear — add the line `Resolved: Q1, Q3`",
  "  (optionally with a short answer: `Resolved: Q1 — <answer>`). A question counts as resolved",
  "  only once BOTH participants have marked it resolved; then it is no longer asked.",
  "- Each question has a priority: critical (blocks moving to execution) or minor",
  "  (secondary, can be deferred and caught up later). Default — critical.",
  "  Mark as secondary: `Priority: Q2=minor`. Raise it back: `Priority: Q2=critical`.",
  "  IMPORTANT: raise a minor to critical as soon as execution would break without it.",
  "- If a FINAL VERIFICATION block is shown — it is the final check of the resolved-question batch:",
  "  confirm everything at once with `Verify: ok`, or return specific ones with `Verify: reopen Q3`.",
];

// STATIC_SYSTEM assembled from the `code` profile — identical content to pre-7c,
// kept as a named export for any consumers that reference it directly.
const CODE_SECTION_KEYS = domains.getProfile("code").sections.map((s) => s.key);
const STATIC_SYSTEM = [
  ...domains.getProfile("code").systemLines,
  ...tailPromptLines(CODE_SECTION_KEYS),
  "",
  ...QUESTIONS_PROTOCOL,
];

const STRICT_SCOPE_RULE = [
  "=== ⚠️ STRICT SCOPE (COMPLEMENT) ===",
  "Strict scope mode is active:",
  "- ANYTHING not listed in the 'Files in Scope' section of the Knowledge Base is automatically considered OUT of scope.",
  "- It is strictly forbidden to propose changes, actions or decisions that touch files/folders outside 'Files in Scope'.",
  "- 'Files Out of Scope' = the complement of 'Files in Scope' (everything else), even if a specific path is not listed explicitly.",
  "- If 'Files in Scope' is empty — scope is undefined: do not guess, clarify first via QUESTION:.",
  "",
];

const NO_SCAN_GUARD = [
  "=== ⚠️ ISOLATED MODE (NO-FILESYSTEM-SCAN) ===",
  "This is a THEORETICAL discussion. Hard constraints apply:",
  "- FORBIDDEN to read, scan, list, or assume the structure of any of the user's files or folders.",
  "- FORBIDDEN to reference specific files, paths, or module names that are not in the Knowledge Base or the subtask text.",
  "- FORBIDDEN to tailor the answer to the assumed structure of the user's existing project.",
  "- Answer ONLY from the subtask text, the Knowledge Base, and any ATTACHED DOCUMENTS above. If they are insufficient — ask via QUESTION:, do not guess.",
  "- If the subtask genuinely needs data from the user's project — STOP and write: `QUESTION: answering this needs such-and-such files — may I scan?` Wait for the user's permission.",
  "Violating this mode = a wrong answer. Re-check your draft before sending.",
  "",
];

// One directive line that flips the agent's response language by `language`.
function languageDirective(language) {
  return `LANGUAGE: ${language === "en"
    ? "Write your ENTIRE response in English, even if the task, guidance, and knowledge base are in another language. This overrides the language of the input."
    : "Пиши весь ответ ПО-РУССКИ, даже если задача, направление и база знаний на другом языке. Это важнее языка ввода."}`;
}

// "You are X. The other participant is Y." / "…participants are Y, Z, W."
// Accepts either a list (N-agent) or the legacy single name.
function roleLine(agentName, otherNames, otherName) {
  const others = (Array.isArray(otherNames) && otherNames.length)
    ? otherNames
    : (otherName ? [otherName] : []);
  if (!others.length) return `You are ${agentName}.`;
  const noun = others.length > 1 ? "participants are" : "participant is";
  return `You are ${agentName}. The other ${noun} ${others.join(", ")}.`;
}

function buildDebatePrompt({
  agentName,
  otherAgentName,
  otherAgentNames,
  language,
  subtask,
  kbSnapshot,
  documentsSnapshot,
  recentTurns,
  guidance,
  round,
  allowFilesystemScan = false,
  strictScope = false,
  openQuestions = [],
  verify = null,
  deferredMinors = [],
  domain = domains.getProfile("code"),
}) {
  const lines = [
    languageDirective(language),
    "",
  ];
  if (!allowFilesystemScan && domain.guards.scanApplies) lines.push(...NO_SCAN_GUARD);
  if (strictScope && domain.guards.scopeApplies) lines.push(...STRICT_SCOPE_RULE);
  lines.push(
    `=== STATIC SYSTEM ===`,
    ...domain.systemLines,
    ...tailPromptLines(domain.sections.map((s) => s.key)),
    "",
    ...QUESTIONS_PROTOCOL,
    "",
    `=== YOUR ROLE ===`,
    roleLine(agentName, otherAgentNames, otherAgentName),
    "",
    `=== KNOWLEDGE BASE (current snapshot) ===`,
    kbSnapshot || "(empty)",
    "",
  );

  if (documentsSnapshot) {
    lines.push(
      `=== ATTACHED DOCUMENTS (user-provided reference — you MAY rely on these) ===`,
      documentsSnapshot,
      "",
    );
  }

  lines.push(
    `=== ACTIVE SUBTASK ===`,
    `ID: ${subtask.id}`,
    `Title: ${subtask.title}`,
    `Mode: ${subtask.mode}`,
    `Round in this subtask: ${round}`,
    "",
  );

  if (guidance) {
    lines.push(`=== USER GUIDANCE THIS ROUND ===`, guidance, "");
  }

  if (recentTurns && recentTurns.length) {
    lines.push(`=== RECENT TURNS IN THIS SUBTASK ===`);
    for (const turn of recentTurns) {
      lines.push(`[${turn.name}]`);
      lines.push(turn.text || "");
      lines.push("");
    }
  } else {
    lines.push(`=== RECENT TURNS IN THIS SUBTASK ===`, "(none yet — this is the first round on this subtask)", "");
  }

  if (verify && Array.isArray(verify.batch) && verify.batch.length) {
    lines.push(`=== ⚠️ FINAL VERIFICATION ===`);
    lines.push(`All CRITICAL questions for this subtask are marked resolved. Verify the whole batch:`);
    for (const item of verify.batch) {
      lines.push(`  ${item.id}: ${item.text}`);
      if (item.answer) lines.push(`     → answer: ${item.answer}`);
    }
    if (deferredMinors && deferredMinors.length) {
      lines.push(`DEFERRED (minor, still open) — do NOT block, but re-check:`);
      for (const q of deferredMinors) lines.push(`  ${q.id} [minor]: ${q.text}`);
      lines.push(`If any of them actually blocks execution — return it to critical: \`Priority: Qn=critical\`.`);
    }
    lines.push(`Confirm everything at once: \`Verify: ok\` — or return specific ones: \`Verify: reopen Q3\`.`, "");
  } else if (openQuestions && openQuestions.length) {
    lines.push(`=== OPEN QUESTIONS (active subtask) ===`);
    for (const q of openQuestions) lines.push(`  ${q.id} [${q.priority || "critical"}]: ${q.text}`);
    lines.push(`Mark resolved with \`Resolved: Q1, Q3\`. Priority — \`Priority: Q2=minor\`. New ones — via KB-patch: open_questions:.`, "");
  }

  lines.push(`=== YOUR TURN ===`);
  if (verify && Array.isArray(verify.batch) && verify.batch.length) {
    lines.push(`This is the final verification. End your answer with \`Verify: ok\` or \`Verify: reopen <ID>\`, plus the usual 5-line tail.`);
  } else {
    lines.push(`Answer strictly about the active subtask. You MUST end with the 5-line tail (New facts / New risks / New alternatives / Status / KB-patch). When questions become clear, add \`Resolved: <ID>\`.`);
  }

  return lines.join("\n");
}

function buildSynthesisPrompt({ agentName, subtask, language, recentTurns, kbSnapshot }) {
  const lines = [
    languageDirective(language),
    "",
    `You are ${agentName}, acting as the moderator.`,
    `The subtask "${subtask.title}" (id ${subtask.id}) is ready to close.`,
    "",
    `Task: produce a subtask summary (≤ 10 lines) that will replace the debate in history.`,
    "Summary structure:",
    "- Goal: one sentence",
    "- Decision: what was decided",
    "- Open questions: what remains unresolved (or 'none')",
    "- KB updates: which items went into the Knowledge Base",
    "",
    `=== KNOWLEDGE BASE ===`,
    kbSnapshot || "(empty)",
    "",
    `=== DEBATE TURNS ===`,
  ];
  for (const turn of recentTurns) {
    lines.push(`[${turn.name}]`);
    lines.push(turn.text || "");
    lines.push("");
  }
  return lines.join("\n");
}

function parseAgentTail(text) {
  const tail = { newFacts: [], newRisks: [], newAlternatives: [], status: "continue", kbPatches: [], resolved: [], verify: null, priority: [] };
  if (!text) return tail;
  const lines = String(text).split(/\r?\n/);

  const emptyRe = new RegExp(`^(?:${TAIL_CONTRACT.emptyTokens.join("|")})$`, "i");
  const grabList = (raw) => {
    const cleaned = String(raw || "").trim();
    if (!cleaned || emptyRe.test(cleaned)) return [];
    return cleaned.replace(/^[\[\(]|[\]\)]$/g, "").split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
  };

  // Build per-field matchers from TAIL_CONTRACT.fields.
  const listFieldMatchers = TAIL_CONTRACT.fields
    .filter((f) => f.list)
    .map((f) => ({ key: f.key, re: new RegExp(`^\\s*${f.anchor}:\\s*(.*)$`, "i") }));
  const statusRe = new RegExp(`^\\s*${TAIL_CONTRACT.fields.find((f) => f.key === "status").anchor}:\\s*(${TAIL_CONTRACT.statusValues.join("|")})\\b`, "i");
  const kbRe = new RegExp(`^\\s*KB-patch:\\s*(.+)$`, "i");
  const resolvedRe = new RegExp(`^\\s*${TAIL_CONTRACT.signals.resolved}:\\s*(.+)$`, "i");
  const verifyRe = new RegExp(`^\\s*${TAIL_CONTRACT.signals.verify}:\\s*(.+)$`, "i");
  const priorityRe = new RegExp(`^\\s*${TAIL_CONTRACT.signals.priority}:\\s*(.+)$`, "i");

  for (const line of lines) {
    for (const { key, re } of listFieldMatchers) {
      const m = line.match(re);
      if (m) tail[key] = grabList(m[1]);
    }
    const ms = line.match(statusRe);
    if (ms) tail.status = ms[1].toLowerCase();
    const mk = line.match(kbRe);
    if (mk) {
      const payload = mk[1].trim();
      if (payload && !emptyRe.test(payload)) {
        const match = payload.match(/^\[?\s*([a-z_]+)\s*:\s*(.+?)\s*\]?$/i);
        if (match) tail.kbPatches.push({ section: match[1].toLowerCase(), item: match[2] });
      }
    }
    const mr = line.match(resolvedRe);
    if (mr && !emptyRe.test(mr[1].trim())) {
      for (const seg of mr[1].split(/,(?=\s*Q\d+\b)/i)) {
        const idm = seg.match(/Q(\d+)/i);
        if (!idm) continue;
        const am = seg.match(/Q\d+\s*[—:\-]\s*(.+)$/i);
        tail.resolved.push({ id: `Q${idm[1]}`, answer: am ? am[1].trim() : "" });
      }
    }
    const mv = line.match(verifyRe);
    if (mv) {
      const payload = mv[1].trim();
      const reopen = [...payload.matchAll(/Q(\d+)/gi)].map((m) => `Q${m[1]}`);
      tail.verify = { ok: reopen.length === 0 && /\bok\b/i.test(payload), reopen };
    }
    const mp = line.match(priorityRe);
    if (mp) {
      for (const seg of mp[1].split(/[,;]/)) {
        const mm = seg.match(/Q(\d+)\s*[=:]\s*(critical|minor)/i);
        if (mm) tail.priority.push({ id: `Q${mm[1]}`, priority: mm[2].toLowerCase() });
      }
    }
  }
  return tail;
}

module.exports = {
  TAIL_CONTRACT,
  STATIC_SYSTEM,
  QUESTIONS_PROTOCOL,
  tailPromptLines,
  availableSectionsLines,
  buildDebatePrompt,
  buildSynthesisPrompt,
  parseAgentTail,
};
