const knowledge = require("./knowledge");

const STATIC_SYSTEM = [
  "Ты участник Council Room v2 — закрытой комнаты двух AI-агентов.",
  "Цель комнаты: довести каждую открытую подзадачу до закрытого состояния через структурированный дебат.",
  "",
  "Правила (фиксированы, повторять не нужно):",
  "- Дебаты строго read-only. Не выполнять реализацию, не менять файлы.",
  "- Отвечать ПО ОДНОЙ активной подзадаче. Не обсуждать прошлые/будущие.",
  "- Если для активной подзадачи не хватает фактов — начни с `QUESTION:` и до 3 коротких вопросов.",
  "- Если факты есть — дай позицию, риски, открытые вопросы, и `REPORT:` блок.",
  "- Каждый ответ ≤ 12 предложений. Краткость — функция, не недостаток.",
  "- В конце ответа обязательны строки:",
  "    New facts: [список или 'нет']",
  "    New risks: [список или 'нет']",
  "    New alternatives: [список или 'нет']",
  "    Status: continue | resolve | block",
  "    KB-patch: [секция: пункт] (одна строка на патч, или 'нет')",
  "    Доступные секции KB: decisions, prohibitions, control_contract,",
  "    files_in_scope, files_out_of_scope, verification_commands, open_questions",
  "- Status=resolve означает: подзадача готова к закрытию (дальше дебатить нечего).",
  "- Status=block означает: подзадача заблокирована — назвать что нужно от пользователя.",
];

const STRICT_SCOPE_RULE = [
  "=== ⚠️ STRICT SCOPE (COMPLEMENT) ===",
  "Активирован строгий режим scope:",
  "- ВСЁ, что НЕ перечислено в секции 'Files in Scope' Базы знаний, автоматически считается ВНЕ scope.",
  "- Категорически запрещено предлагать изменения, действия или решения, затрагивающие файлы/папки вне 'Files in Scope'.",
  "- 'Files Out of Scope' = дополнение к 'Files in Scope' (всё остальное), даже если конкретный путь не перечислен явно.",
  "- Если 'Files in Scope' пуст — scope не определён: не угадывай, сначала уточни через QUESTION:.",
  "",
];

const NO_SCAN_GUARD = [
  "=== ⚠️ ИЗОЛИРОВАННЫЙ РЕЖИМ (NO-FILESYSTEM-SCAN) ===",
  "Это ТЕОРЕТИЧЕСКОЕ обсуждение. Действуют жёсткие ограничения:",
  "- ЗАПРЕЩЕНО читать, сканировать, листать или предполагать структуру каких-либо файлов и папок пользователя.",
  "- ЗАПРЕЩЕНО ссылаться на конкретные файлы, пути, имена модулей, которых нет в Базе знаний или в тексте подзадачи.",
  "- ЗАПРЕЩЕНО подстраивать ответ под предполагаемую структуру существующего проекта пользователя.",
  "- Отвечай ТОЛЬКО на основе текста подзадачи и Базы знаний выше. Если их недостаточно — задай вопрос через QUESTION:, не угадывай.",
  "- Если для подзадачи реально нужны данные из проекта пользователя — ОСТАНОВИСЬ и напиши: `QUESTION: для ответа нужны такие-то файлы — разрешишь сканировать?` Жди разрешения пользователя.",
  "Нарушение этого режима = неверный ответ. Перепроверь свой черновик перед отправкой.",
  "",
];

function buildDebatePrompt({
  agentName,
  otherAgentName,
  language,
  subtask,
  kbSnapshot,
  recentTurns,
  guidance,
  round,
  allowFilesystemScan = false,
  strictScope = false,
}) {
  const lines = [
    `LANGUAGE: ${language === "en" ? "Write in English." : "Пиши по-русски."}`,
    "",
  ];
  if (!allowFilesystemScan) lines.push(...NO_SCAN_GUARD);
  if (strictScope) lines.push(...STRICT_SCOPE_RULE);
  lines.push(
    `=== STATIC SYSTEM ===`,
    ...STATIC_SYSTEM,
    "",
    `=== YOUR ROLE ===`,
    `Ты ${agentName}. Второй участник — ${otherAgentName}.`,
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
    lines.push(`=== RECENT TURNS IN THIS SUBTASK ===`, "(none yet — это первый раунд по этой подзадаче)", "");
  }

  lines.push(`=== YOUR TURN ===`);
  lines.push(`Дай ответ строго по активной подзадаче. Обязательно заверши хвостом из 5 строк (New facts / New risks / New alternatives / Status / KB-patch).`);

  return lines.join("\n");
}

function buildSynthesisPrompt({ agentName, subtask, language, recentTurns, kbSnapshot }) {
  const lines = [
    `LANGUAGE: ${language === "en" ? "Write in English." : "Пиши по-русски."}`,
    "",
    `Ты ${agentName}, выступаешь модератором.`,
    `Подзадача "${subtask.title}" (id ${subtask.id}) готова к закрытию.`,
    "",
    `Задача: создать summary подзадачи (≤ 10 строк), который заменит дебаты в истории.`,
    "Структура summary:",
    "- Goal: одно предложение",
    "- Decision: что решено",
    "- Open questions: что осталось не решено (или 'нет')",
    "- KB updates: какие пункты пошли в Knowledge Base",
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
  const tail = { newFacts: [], newRisks: [], newAlternatives: [], status: "continue", kbPatches: [] };
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
  }
  return tail;
}

module.exports = {
  STATIC_SYSTEM,
  buildDebatePrompt,
  buildSynthesisPrompt,
  parseAgentTail,
};
