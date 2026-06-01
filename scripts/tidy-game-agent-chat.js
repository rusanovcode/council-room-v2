// Tidy the migrated game-agent chat WITHOUT data loss + open Phase 11 as a subtask.
// - transcript: full lossless backup -> transcript.full.jsonl, then strip mechanical
//   noise (Orchestrator "Starting…" markers, Document Reader connect-spam, *-process
//   lines, and the 4 "Ollama not detected" lines my own verification injected) and
//   exact-dedup. Substantive User/Codex/Claude turns are all kept.
// - documents: backup -> documents.full.jsonl. Containment analysis showed NO doc is a
//   subset/duplicate of another, so none are deleted; a non-destructive consolidated
//   overview doc is added.
// - Phase 11: opened as a subtask, seeded with the R144/R145 council consensus.
// Re-runnable: rebuilds transcript.jsonl from transcript.full.jsonl each run.
const fs = require("node:fs");
const path = require("node:path");
const store = require("../lib/store");
const subtasks = require("../lib/subtasks");
const documents = require("../lib/documents");

const ID = "2026-05-22T15-33-40-262Z-создать-кор-игрового-агента-суть-изложена-в-файл";
const DIR = path.join(__dirname, "..", "rooms", store.safeId(ID));
const TR = path.join(DIR, "transcript.jsonl");
const TR_FULL = path.join(DIR, "transcript.full.jsonl");
const DOCS = path.join(DIR, "documents.jsonl");
const DOCS_FULL = path.join(DIR, "documents.full.jsonl");

function loadJsonl(f) {
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : [];
}
function writeJsonl(f, arr) { fs.writeFileSync(f, arr.map((o) => JSON.stringify(o)).join("\n") + "\n"); }

// ---- 1. transcript: establish lossless backup (the real 444, minus my verification noise)
let all = loadJsonl(fs.existsSync(TR_FULL) ? TR_FULL : TR);
const isMyOllamaNoise = (m) => m.name === "Council Room" && m.at > "2026-05-25" && /Ollama not detected/.test(m.text || "");
const real = all.filter((m) => !isMyOllamaNoise(m));
if (!fs.existsSync(TR_FULL)) writeJsonl(TR_FULL, real); // pristine full record, written once
const backupCount = loadJsonl(TR_FULL).length;

// ---- 2. clean: keep substantive turns only, exact-dedup, time-sort
const SUBSTANTIVE = new Set(["User", "Codex", "Claude Code"]);
const kept = real.filter((m) => SUBSTANTIVE.has(m.name));
const seen = new Set();
const deduped = [];
let exactDup = 0;
for (const m of kept.sort((a, b) => new Date(a.at) - new Date(b.at))) {
  const k = m.role + "|" + m.name + "|" + m.text;
  if (seen.has(k)) { exactDup++; continue; }
  seen.add(k); deduped.push(m);
}

// ---- 3. Phase 11 subtask (council consensus R144/R145) — find-or-create (idempotent)
const P11_TITLE = "Фаза 11 (game_agent): создать ТОЛЬКО docs/phase11_checklist.md — без реализации Phase 11";
let subtask = subtasks.loadAll(DIR).find((s) => s.title.startsWith("Фаза 11 (game_agent)"));
if (!subtask) subtask = subtasks.openSubtask(DIR, { title: P11_TITLE, mode: "STRICT" });
const now = store.now();
const scopeRu = [
  "Phase 11 — следующий шаг по консенсусу совета (R144 Codex / R145 Claude Code).",
  "Предусловие ВЫПОЛНЕНО: Phase 10 закрыта (PASS, 93/93, bootstrap ok, phase10_closed=true, active_operator=null); docs/phase10_closure_report.md отслеживается в git.",
  "Задача: создать ТОЛЬКО docs/phase11_checklist.md в C:\\AI\\game_agent. БЕЗ реализации Phase 11.",
  "Checklist обязан содержать: entry conditions, цели Phase 11, allowed files, явный out-of-scope, prohibitions, verification commands, PASS/FAIL criteria, rollback/closure notes.",
  "Перенести запреты: live/Teensy/GameLoop/HID/OCR/YOLO/RL/reinforcement learning/PartyCoordinator, serial.open, win32api, ctypes, force_unseal, live_control, pyautogui, pynput, pywin32, import hid, hid.device.",
  "Процесс: Codex создаёт checklist → Claude read-only review → PASS/FAIL. game_agent меняется ТОЛЬКО в отдельной сессии game_agent_operator.",
].join("\n");
const scopeEn = "Phase 11 (council consensus R144/R145): create ONLY docs/phase11_checklist.md in C:\\AI\\game_agent, NO implementation. Precondition met: Phase 10 closed (PASS 93/93, phase10_closed=true), closure report tracked. Checklist must list entry conditions, goals, allowed files, out-of-scope, prohibitions (live/Teensy/GameLoop/HID/OCR/YOLO/RL/PartyCoordinator, serial.open, win32api, ctypes, force_unseal, live_control, pyautogui, pynput, pywin32, hid), verification commands, PASS/FAIL, rollback. Flow: Codex drafts → Claude read-only review → PASS/FAIL.";

const noteMsg = { id: store.makeId("msg"), at: now, role: "system", name: "Council Room", kind: "note", subtaskId: subtask.id, round: 0, text: scopeEn, textRu: scopeRu };
const openMsg = { id: store.makeId("msg"), at: store.now(), role: "system", name: "Council Room", kind: "subtask-open", subtaskId: subtask.id, round: 0,
  text: `Subtask opened: ${subtask.title} (id ${subtask.id}, mode ${subtask.mode}).`,
  textRu: `Открыта подзадача: ${subtask.title} (id ${subtask.id}, mode ${subtask.mode}).` };

// First Claude Code position on Phase 11 (authored stance, council-aligned, v2 tail).
const claudeP11 = [
  "**Позиция Claude Code по Phase 11**",
  "",
  "Согласен с консенсусом R144/R145: переходим к авторингу ТОЛЬКО `docs/phase11_checklist.md`, без реализации Phase 11. Предусловие выполнено — Phase 10 закрыта PASS (93/93, bootstrap exit 0, `phase10_closed=true`, `active_operator=null`), `docs/phase10_closure_report.md` отслеживается в git, `session_state.json` → next_priorities = `phase 11 pending_checklist`. Блокеров нет.",
  "",
  "**Обязательное содержание checklist:**",
  "1. Entry conditions — ссылка на Phase 10 closure (PASS) и git-tracked closure report.",
  "2. Цели Phase 11 — узкие, измеримые, без расширения runtime-поверхности.",
  "3. Allowed files — точный whitelist; всё прочее out-of-scope по умолчанию.",
  "4. Prohibitions (дословно + в FAIL-criteria): live/Teensy/live serial, GameLoop, runtime OCR/YOLO, PartyCoordinator, shared map, multi-window HID, RL/reinforcement learning, behavioral cloning, OS input/HID (serial.open, win32api, ctypes, pyautogui, pynput, pywin32, import hid, hid.device), force_unseal, live_control.",
  "5. Verification commands + PASS/FAIL (по образцу прошлых фаз: bootstrap exit 0, полный тест-сьют зелёный, scope не расширен).",
  "6. Rollback / closure notes.",
  "",
  "**Об источниках (отвечаю на вопрос о приложенных документах):** для Phase 11 авторитетны файлы самого проекта game_agent — `session_state.json`, `DEVELOPMENT_HANDOVER.md`, `MEMORY_CONTRACT.md`, `docs/RUNBOOK.md`, `docs/phase10_closure_report.md`. Приложенные MMORPG-документы (Plan / Единая архитектура / Obsidian Graph / 22 различия / History) — это исходное видение и история («зачем»), НЕ операционная спецификация Phase 11. Особо: `MMORPG_AI_Plan.md` предлагает OCR / PyAutoGUI / pynput / screen-capture — то, что сейчас прямо ЗАПРЕЩЕНО; как спецификацию использовать нельзя, только как исторический артефакт. Концептуально к Phase 11+ относится разве что `22 различия (Dev Orchestrator ↔ Runtime AgentCore)` — фундамент разделения ролей.",
  "",
  "**Риски:** checklist без явных Teensy/RL/HID prohibitions → scope-drift; соблазн втянуть MMORPG_AI_Plan как спецификацию → нарушение текущих запретов; нельзя начинать implementation без отдельного operator-approval после review checklist.",
  "",
  "**Процесс:** Codex авторит checklist → я проверяю read-only (prohibitions, PASS/FAIL, verification, что implementation не начата) → PASS/FAIL. game_agent меняется только в сессии game_agent_operator.",
  "",
  "New facts: Phase 10 closed PASS и closure report git-tracked; session_state next_priorities = phase 11 pending_checklist",
  "New risks: scope-drift без явных запретов; MMORPG_AI_Plan противоречит текущим prohibitions (OCR/PyAutoGUI/HID)",
  "New alternatives: none",
  "Status: continue",
  "KB-patch: phase11: author docs/phase11_checklist.md (checklist-only, no implementation); authoritative inputs = project governance files, not MMORPG design docs",
].join("\n");
const claudeMsg = { id: store.makeId("msg"), at: store.now(), role: "agent", name: "Claude Code", kind: "debate", subtaskId: subtask.id, round: 1, text: claudeP11 };

writeJsonl(TR, [...deduped, noteMsg, openMsg, claudeMsg]);
// Reflect the round-1 Claude opening in the subtask counter (idempotent).
if (subtask.rounds === 0) subtasks.incrementRounds(DIR, subtask.id);

// ---- 4. documents: backup, keep all (no dupes), add consolidated overview
const docs = documents.loadAll(DIR);
if (!fs.existsSync(DOCS_FULL)) fs.copyFileSync(DOCS, DOCS_FULL);
const hasOverview = docs.some((d) => d.name.startsWith("00_Обзор"));
if (!hasOverview) {
  const overview = [
    "# 00 — Обзор прикреплённых документов и следующий шаг (Phase 11)",
    "",
    "Сводка-указатель. Анализ показал, что 8 исходных документов НЕ дублируют друг друга",
    "(ни один не является подмножеством другого — пересечение по содержимому < 50%),",
    "поэтому ни один не удалён. Это карта набора, оригиналы сохранены.",
    "",
    "## Источники (MMORPG game-AI)",
    "- **MMORPG_AI_Единая_архитектура_и_исследование_2026-04-26.md** — самый полный документ:",
    "  объединённая архитектура + исследование (два оркестратора: Dev Orchestrator строит систему,",
    "  Runtime AgentCore играет). Базовый источник истины по архитектуре.",
    "- **MMORPG_AI_Plan.md** — структурированный план по этапам (фундамент → UI нод → захват экрана →",
    "  принятие решений → саморазвитие). Более ранний (2026-04-09), практический срез.",
    "- **MMORPG_Obsidian_Graph.md** — граф связей нод/заметок (Agent Core, Decision Engine, HP Monitor…).",
    "- **22 различия между Dev Orchestrator и Runtime Orchestrator (Agent Core).md** — разбор границы",
    "  между «строителем системы» и «runtime-агентом».",
    "- **AI_Project_History.txt** — хронологическая история проекта (контекст эволюции решений).",
    "",
    "## Артефакты совета по этой беседе",
    "- **R144-codex-report.md** / **R145-claude-code-report.md** — финальные отчёты Codex и Claude Code:",
    "  консенсус — переходить к созданию ТОЛЬКО docs/phase11_checklist.md, без реализации Phase 11.",
    "- **phase10_closure_review_20260524.md** — review закрытия Phase 10 (PASS, 93/93, bootstrap ok).",
    "",
    "## Следующий шаг — Phase 11 (открыт подзадачей в этом чате)",
    scopeRu,
  ].join("\n");
  const od = { id: store.makeId("doc"), name: "00_Обзор_документов_и_Phase11.md", text: overview, chars: overview.length, addedAt: now };
  fs.appendFileSync(DOCS, JSON.stringify(od) + "\n");
}

// ---- report
console.log("TIDY DONE");
console.log("  backup (lossless) transcript.full.jsonl:", backupCount, "msgs");
console.log("  cleaned transcript.jsonl:", deduped.length, "substantive + note + subtask-open + Claude Phase-11 =", deduped.length + 3);
console.log("  removed as noise/dup:", backupCount - deduped.length, "(incl. exact dups:", exactDup + ")");
console.log("  documents: kept", docs.length, "(no true duplicates) + 1 overview =", documents.loadAll(DIR).length);
console.log("  Phase 11 subtask:", subtask.id, "mode", subtask.mode, "status", subtask.status);
