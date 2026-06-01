// Phase 8 A1: post-consensus document templates.
//
// This registry keeps "what to produce" as data. Delivery is intentionally
// limited to in-chat documents in A1; file writes stay behind later gated phases.

const VALID_IDS = new Set(["summary", "checklist", "closure-review"]);

function mdList(items, fallback = "-") {
  const clean = (items || []).map((x) => String(x || "").trim()).filter(Boolean);
  return clean.length ? clean.map((x) => `- ${x}`).join("\n") : `- ${fallback}`;
}

function renderRecentTurns(turns) {
  const clean = (turns || [])
    .map((m) => {
      const name = String(m.name || m.role || "speaker").trim();
      const text = String(m.text || "").trim();
      if (!text) return "";
      return `### ${name}\n${text.slice(0, 2500)}`;
    })
    .filter(Boolean);
  return clean.length ? clean.join("\n\n") : "(none)";
}

function baseContext(ctx) {
  const docs = String(ctx.documentsSnapshot || "").trim();
  return [
    `# Source Context`,
    ``,
    `## Chat`,
    `Topic: ${ctx.run?.topic || "Untitled"}`,
    `Language: ${ctx.language || "en"}`,
    ``,
    `## Subtask`,
    `ID: ${ctx.subtask.id}`,
    `Title: ${ctx.subtask.title}`,
    `Mode: ${ctx.subtask.mode}`,
    `Status: ${ctx.subtask.status}`,
    ctx.subtask.summary ? `Summary: ${ctx.subtask.summary}` : "",
    ``,
    `## Knowledge Base Snapshot`,
    String(ctx.kbSnapshot || "(empty)").trim(),
    ``,
    `## Attached Documents Snapshot`,
    docs || "(none)",
    ``,
    `## Recent Turns`,
    renderRecentTurns(ctx.recentTurns),
  ].filter((line) => line !== "").join("\n");
}

function reviewGateInstructions(kind) {
  return [
    `Also append a section named "Review Gate".`,
    `The Review Gate must list: entry conditions, source evidence used, checks to run, PASS criteria, FAIL criteria, and rollback/follow-up notes.`,
    `Keep it concrete enough that a different reviewer can mark PASS or FAIL without reading the whole chat.`,
    `For ${kind}, do not invent facts beyond the source context.`,
  ].join("\n");
}

function buildAgentPrompt(ctx, taskLines) {
  return [
    `You are authoring a post-consensus deliverable for Council Room.`,
    `Produce only the deliverable markdown. Do not wrap it in code fences.`,
    `Ground every claim in the source context. If a required fact is missing, write "TBD" and name the missing input.`,
    `Do not claim files were written or commands were run.`,
    ``,
    ...taskLines,
    ``,
    reviewGateInstructions(ctx.templateId),
    ``,
    baseContext(ctx),
  ].join("\n");
}

function localSummary(ctx) {
  const kb = ctx.kb || { sections: {} };
  const decisions = kb.sections.decisions || [];
  const risks = kb.sections.risks || kb.sections.open_risks || [];
  const verification = kb.sections.verification_commands || [];
  return [
    `# Consensus Summary`,
    ``,
    `## Subtask`,
    `- ID: ${ctx.subtask.id}`,
    `- Title: ${ctx.subtask.title}`,
    `- Status: ${ctx.subtask.status}`,
    ctx.subtask.summary ? `- Existing summary: ${ctx.subtask.summary}` : "",
    ``,
    `## Decisions`,
    mdList(decisions, "No decisions captured in the Knowledge Base."),
    ``,
    `## Risks / Open Items`,
    mdList(risks, "No risks captured in the Knowledge Base."),
    ``,
    `## Verification`,
    mdList(verification, "No verification commands captured in the Knowledge Base."),
    ``,
    `## Review Gate`,
    `- Entry conditions: subtask is resolved and this document was generated from the current Knowledge Base snapshot.`,
    `- PASS: decisions and verification steps match the Knowledge Base and subtask summary.`,
    `- FAIL: required source facts are missing, contradicted, or not traceable to the Knowledge Base/transcript.`,
    `- Rollback: remove this generated chat document and regenerate after updating the Knowledge Base.`,
  ].filter((line) => line !== "").join("\n");
}

const TEMPLATES = [
  {
    id: "summary",
    label: "Consensus summary",
    defaultAuthor: "local",
    producesReviewGate: true,
    localBuilder: localSummary,
    promptBuilder: (ctx) => buildAgentPrompt({ ...ctx, templateId: "summary" }, [
      `Task: write a concise consensus summary for the resolved subtask.`,
      `Include sections: Subtask, Decisions, Risks / Open Items, Verification, Review Gate.`,
    ]),
  },
  {
    id: "checklist",
    label: "Implementation checklist",
    defaultAuthor: "agent",
    producesReviewGate: true,
    promptBuilder: (ctx) => buildAgentPrompt({ ...ctx, templateId: "checklist" }, [
      `Task: write an implementation checklist/spec for the resolved subtask.`,
      `Include sections: Entry Conditions, Goals, Allowed Files / Scope, Explicit Out-of-Scope, Prohibitions, Steps, Verification Commands, PASS/FAIL Criteria, Rollback / Closure Notes, Review Gate.`,
      String(ctx.customPrompt || "").trim() ? `User customization: ${String(ctx.customPrompt).trim()}` : "",
    ].filter(Boolean)),
  },
  {
    id: "closure-review",
    label: "Closure review",
    defaultAuthor: "agent",
    producesReviewGate: true,
    promptBuilder: (ctx) => buildAgentPrompt({ ...ctx, templateId: "closure-review" }, [
      `Task: write a closure-review instrument for validating that the subtask can be closed.`,
      `Include sections: Entry Conditions, Source Contracts, Verification Matrix, PASS Criteria, FAIL Criteria, Residual Risks, Rollback / Reopen Notes, Review Gate.`,
      String(ctx.customPrompt || "").trim() ? `User customization: ${String(ctx.customPrompt).trim()}` : "",
    ].filter(Boolean)),
  },
];

function buildReviewPrompt(ctx) {
  return [
    `You are reviewing a Council Room post-consensus deliverable.`,
    `Read the source context and the draft. Return a strict review.`,
    `Start the response with exactly one of these lines:`,
    `Review: PASS`,
    `Review: FAIL`,
    ``,
    `If FAIL, list concrete findings that the author must fix. Do not rewrite the whole artifact.`,
    `If PASS, list the checks that passed.`,
    ``,
    baseContext(ctx),
    ``,
    `# Draft Deliverable`,
    String(ctx.draft || "").trim(),
  ].join("\n");
}

function parseReview(text) {
  const clean = String(text || "");
  const first = clean.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  return {
    pass: /^Review:\s*PASS\b/i.test(first),
    fail: /^Review:\s*FAIL\b/i.test(first),
    text: clean,
  };
}

function list() {
  return TEMPLATES.map(({ id, label, defaultAuthor, producesReviewGate }) => ({
    id,
    label,
    defaultAuthor,
    producesReviewGate,
  }));
}

function get(id) {
  const clean = String(id || "summary");
  if (!VALID_IDS.has(clean)) throw new Error(`Unknown deliverable template: ${clean}`);
  return TEMPLATES.find((t) => t.id === clean);
}

module.exports = { list, get, baseContext, buildReviewPrompt, parseReview };
