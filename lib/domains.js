"use strict";

// Profile registry. Adding a profile here is the only change needed to
// support a new discussion domain — no edits to server.js or prompt.js.
// TAIL_CONTRACT (anchors, statusValues, signals) is invariant across all
// profiles and lives in prompt.js; profiles only define systemLines + sections.

const PROFILES = [
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
      { key: "decisions",             title: "Decisions (Frozen)" },
      { key: "prohibitions",          title: "Prohibitions" },
      { key: "control_contract",      title: "Control Contract" },
      { key: "files_in_scope",        title: "Files in Scope" },
      { key: "files_out_of_scope",    title: "Files Out of Scope" },
      { key: "verification_commands", title: "Verification Commands" },
      { key: "open_questions",        title: "Open Questions" },
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
];

const DEFAULT = "code";

const _map = new Map(PROFILES.map((p) => [p.id, p]));

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

module.exports = { getProfile, DEFAULT, list, options };
