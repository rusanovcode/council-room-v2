const knowledge = require("./knowledge");

// Prompt scaffolding is kept in English as the single source of truth (best for
// the models, and the machine-readable tail tokens below are English anyway).
// The agent's RESPONSE language is controlled separately by the LANGUAGE
// directive at the top of each prompt (see buildDebatePrompt/buildSynthesisPrompt).
const STATIC_SYSTEM = [
  "You are a participant in Council Room v2 — a closed room of 2 to 5 AI agents.",
  "Room goal: drive every open subtask to a closed state through structured debate.",
  "",
  "Rules (fixed, no need to repeat):",
  "- Debate is strictly read-only. Do not implement, do not modify files.",
  "- Answer about THE ONE active subtask only. Do not discuss past/future ones.",
  "- If the active subtask lacks facts — start with `QUESTION:` and up to 3 short questions.",
  "- If facts are sufficient — give a position, risks, open questions, and a `REPORT:` block.",
  "- Each answer ≤ 12 sentences. Brevity is a feature, not a flaw.",
  "- Every answer MUST end with these lines:",
  "    New facts: [list or 'none']",
  "    New risks: [list or 'none']",
  "    New alternatives: [list or 'none']",
  "    Status: continue | resolve | block",
  "    KB-patch: [section: item] (one line per patch, or 'none')",
  "    Available KB sections: decisions, prohibitions, control_contract,",
  "    files_in_scope, files_out_of_scope, verification_commands, open_questions",
  "- Status=resolve means: the subtask is ready to close (nothing left to debate).",
  "- Status=block means: the subtask is blocked — state what is needed from the user.",
  "",
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
  "- Answer ONLY from the subtask text and the Knowledge Base above. If they are insufficient — ask via QUESTION:, do not guess.",
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
  recentTurns,
  guidance,
  round,
  allowFilesystemScan = false,
  strictScope = false,
  openQuestions = [],
  verify = null,
  deferredMinors = [],
}) {
  const lines = [
    languageDirective(language),
    "",
  ];
  if (!allowFilesystemScan) lines.push(...NO_SCAN_GUARD);
  if (strictScope) lines.push(...STRICT_SCOPE_RULE);
  lines.push(
    `=== STATIC SYSTEM ===`,
    ...STATIC_SYSTEM,
    "",
    `=== YOUR ROLE ===`,
    roleLine(agentName, otherAgentNames, otherAgentName),
    "",
    `=== KNOWLEDGE BASE (current snapshot) ===`,
    kbSnapshot || "(empty)",
    "",
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
  const grabList = (raw) => {
    const cleaned = String(raw || "").trim();
    if (!cleaned || /^нет$|^none$/i.test(cleaned)) return [];
    return cleaned
      .replace(/^[\[\(]|[\]\)]$/g, "")
      .split(/[,;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  };
  for (const line of lines) {
    const m1 = line.match(/^\s*New facts:\s*(.*)$/i);
    if (m1) tail.newFacts = grabList(m1[1]);
    const m2 = line.match(/^\s*New risks:\s*(.*)$/i);
    if (m2) tail.newRisks = grabList(m2[1]);
    const m3 = line.match(/^\s*New alternatives:\s*(.*)$/i);
    if (m3) tail.newAlternatives = grabList(m3[1]);
    const m4 = line.match(/^\s*Status:\s*(continue|resolve|block)\b/i);
    if (m4) tail.status = m4[1].toLowerCase();
    const m5 = line.match(/^\s*KB-patch:\s*(.+)$/i);
    if (m5) {
      const payload = m5[1].trim();
      if (payload && !/^нет$|^none$/i.test(payload)) {
        const match = payload.match(/^\[?\s*([a-z_]+)\s*:\s*(.+?)\s*\]?$/i);
        if (match) tail.kbPatches.push({ section: match[1].toLowerCase(), item: match[2] });
      }
    }
    const m6 = line.match(/^\s*Resolved:\s*(.+)$/i);
    if (m6 && !/^нет$|^none$/i.test(m6[1].trim())) {
      for (const seg of m6[1].split(/,(?=\s*Q\d+\b)/i)) {
        const idm = seg.match(/Q(\d+)/i);
        if (!idm) continue;
        const am = seg.match(/Q\d+\s*[—:\-]\s*(.+)$/i);
        tail.resolved.push({ id: `Q${idm[1]}`, answer: am ? am[1].trim() : "" });
      }
    }
    const m7 = line.match(/^\s*Verify:\s*(.+)$/i);
    if (m7) {
      const payload = m7[1].trim();
      const reopen = [...payload.matchAll(/Q(\d+)/gi)].map((m) => `Q${m[1]}`);
      tail.verify = { ok: reopen.length === 0 && /\bok\b/i.test(payload), reopen };
    }
    const m9 = line.match(/^\s*Priority:\s*(.+)$/i);
    if (m9) {
      for (const seg of m9[1].split(/[,;]/)) {
        const mm = seg.match(/Q(\d+)\s*[=:]\s*(critical|minor)/i);
        if (mm) tail.priority.push({ id: `Q${mm[1]}`, priority: mm[2].toLowerCase() });
      }
    }
  }
  return tail;
}

module.exports = {
  STATIC_SYSTEM,
  buildDebatePrompt,
  buildSynthesisPrompt,
  parseAgentTail,
};
