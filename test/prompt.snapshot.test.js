// Phase 7a — Golden snapshot test.
// First run: creates baselines in test/__snapshots__/.
// Subsequent runs: compares against those baselines and FAILS on any diff.
// Run: node test/prompt.snapshot.test.js
"use strict";
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const { buildDebatePrompt, parseAgentTail } = require(path.join(ROOT, "lib/prompt"));

const SNAPSHOTS = path.join(__dirname, "__snapshots__");
fs.mkdirSync(SNAPSHOTS, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────

function readSnapshot(name) {
  const p = path.join(SNAPSHOTS, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function writeSnapshot(name, content) {
  fs.writeFileSync(path.join(SNAPSHOTS, name), content, "utf8");
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    // Show a short diff (first mismatch).
    const aLines = actual.split("\n");
    const eLines = expected.split("\n");
    for (let i = 0; i < Math.max(aLines.length, eLines.length); i++) {
      if (aLines[i] !== eLines[i]) {
        console.error(`    First diff at line ${i + 1}:`);
        console.error(`    EXPECTED: ${JSON.stringify(eLines[i])}`);
        console.error(`    ACTUAL:   ${JSON.stringify(aLines[i])}`);
        break;
      }
    }
    failed++;
  }
}

// ── Test 1: code-debate.txt ───────────────────────────────────────────────────

const FIXED_INPUT = {
  agentName: "Codex",
  otherAgentNames: ["Claude"],
  language: "ru",
  subtask: { id: "st_snapshot01", title: "Snapshot fixture subtask", mode: "STANDARD" },
  kbSnapshot: "### Decisions (Frozen)\n- Use Node.js for the backend.\n",
  documentsSnapshot: null,
  recentTurns: [
    { name: "Claude", text: "I propose using Express for routing.\nNew facts: none\nNew risks: none\nNew alternatives: none\nStatus: continue\nKB-patch: none" },
  ],
  guidance: "",
  round: 2,
  allowFilesystemScan: false,
  strictScope: false,
  openQuestions: [],
  verify: null,
  deferredMinors: [],
};

const FIXED_INPUT_WITH_VERIFY = {
  ...FIXED_INPUT,
  openQuestions: [],
  verify: { batch: [{ id: "Q1", text: "Which DB to use?", answer: "PostgreSQL" }] },
  deferredMinors: [{ id: "Q2", text: "Logging format?" }],
};

console.log("\n[7a] code-debate.txt snapshot");
{
  const output = buildDebatePrompt(FIXED_INPUT);
  const outputVerify = buildDebatePrompt(FIXED_INPUT_WITH_VERIFY);
  const combined = output + "\n\n===VERIFY_CASE===\n\n" + outputVerify;
  const existing = readSnapshot("code-debate.txt");
  if (existing === null) {
    writeSnapshot("code-debate.txt", combined);
    console.log("  ★ Baseline created: test/__snapshots__/code-debate.txt");
    passed++;
  } else {
    check("code-debate.txt matches baseline (byte-for-byte)", combined, existing);
  }
}

// ── Test 2: parse-tail.json ──────────────────────────────────────────────────

// Fixed tail strings (hand-crafted to cover all fields, no dependency on real transcripts)
const TAIL_SAMPLES = [
  // 1: typical continue
  "REPORT: blah blah.\nNew facts: the DB has 7 tables\nNew risks: migration cost\nNew alternatives: none\nStatus: continue\nKB-patch: decisions: use PostgreSQL",
  // 2: block with open_questions patch
  "QUESTION:\n1. What is the scope?\nNew facts: нет\nNew risks: no context\nNew alternatives: нет\nStatus: block\nKB-patch: open_questions: clarify scope and target artifact",
  // 3: resolve, none fields
  "REPORT: done.\nNew facts: none\nNew risks: none\nNew alternatives: none\nStatus: resolve\nKB-patch: none",
  // 4: Resolved + Priority
  "Analysis.\nNew facts: found 3 edge cases\nNew risks: performance hit\nNew alternatives: use Redis instead\nStatus: continue\nKB-patch: files_in_scope: src/db.js\nResolved: Q1 — use PostgreSQL\nPriority: Q2=minor",
  // 5: Verify ok
  "Summary.\nNew facts: none\nNew risks: none\nNew alternatives: none\nStatus: resolve\nKB-patch: none\nVerify: ok",
  // 6: Verify reopen
  "Check.\nNew facts: none\nNew risks: Q3 still unclear\nNew alternatives: none\nStatus: continue\nKB-patch: none\nVerify: reopen Q3",
];

console.log("\n[7a] parse-tail.json snapshot");
{
  const results = TAIL_SAMPLES.map((text, i) => ({ sample: i + 1, tail: parseAgentTail(text) }));
  const json = JSON.stringify(results, null, 2);
  const existing = readSnapshot("parse-tail.json");
  if (existing === null) {
    writeSnapshot("parse-tail.json", json);
    console.log("  ★ Baseline created: test/__snapshots__/parse-tail.json");
    passed++;
  } else {
    check("parse-tail.json matches baseline (parity)", json, existing);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
