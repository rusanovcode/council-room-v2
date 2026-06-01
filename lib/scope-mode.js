"use strict";

// Scope-proposal detection for subtask titles.
// Matches explicit scope-definition phrasings (EN/RU) without tying to project names.
const SCOPE_PROPOSAL_RE = new RegExp([
  String.raw`\b(?:scope proposal|scoping|scope definition|define scope)\b`,
  String.raw`\bproposal[-\s]?only\b`,
  String.raw`\bpropos\w*\b[^\n]{0,40}\b(?:scope|checklist|outline)\b`,
  String.raw`\b(?:scope|checklist)\b[^\n]{0,30}\bproposal\b`,
  String.raw`\bscope\s*\+?\s*checklist\b`,
  String.raw`\bchecklist\s+outline\b`,
  String.raw`предлож\w*[^\n]{0,40}(?:scope|скоуп|чек-?лист|checklist)`,
  String.raw`(?:scope|скоуп|чек-?лист|checklist)[^\n]{0,40}предлож\w*`,
  // Legacy alternatives kept for backward compatibility with existing behavior.
  String.raw`предлож[её]н\w*\s+scope`,
  String.raw`определ[её]н\w*\s+scope`,
  String.raw`скоуп`,
].join("|"), "i");

function inferScopeMode(title = "", requested = "") {
  const explicit = String(requested || "").trim().toLowerCase();
  if (explicit === "proposal" || explicit === "normal") return explicit;
  return SCOPE_PROPOSAL_RE.test(String(title || "")) ? "proposal" : "normal";
}

module.exports = {
  SCOPE_PROPOSAL_RE,
  inferScopeMode,
};

