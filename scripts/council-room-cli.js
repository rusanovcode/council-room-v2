#!/usr/bin/env node

const DEFAULT_BASE = process.env.COUNCIL_ROOM_URL || "http://localhost:8788";

function usage() {
  console.log(`Council Room CLI

Usage:
  node scripts/council-room-cli.js <command> [args]

Read:
  state                         Print active room summary
  agents [--limit N] [--json]    Print recent agent messages
  trace [--limit N] [--json]     Print recent service events
  transcript [--limit N] [--json] Print recent visible messages
  review-prompt [--limit N]      Build an external-review prompt from recent room messages
  stream [--state]               Follow live room events and agent terminal chunks

Control:
  open-subtask <title> [--mode MODE]
  run-round [guidance text]
  autopilot-start [--auto-resolve] [guidance text]
  autopilot-stop
  resolve <subtaskId> [summary]
  freeze <subtaskId> [reason]
  reopen <subtaskId>
  switch-run <runId>
  post <apiPath> <jsonBody>       Generic POST escape hatch

Options:
  --url URL                       Default: ${DEFAULT_BASE}
  --json                          JSON output for read commands
`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--state") out.state = true;
    else if (a === "--auto-resolve") out.autoResolve = true;
    else if (a === "--url") out.url = argv[++i];
    else if (a === "--limit") out.limit = Number(argv[++i] || 0);
    else if (a === "--mode") out.mode = argv[++i] || "";
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";
const base = String(args.url || DEFAULT_BASE).replace(/\/+$/, "");

async function request(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data && data.error ? data.error : text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function getState() {
  return request("GET", "/api/state");
}

function activeSubtask(state) {
  return state?.run?.activeSubtask || null;
}

function msgText(msg) {
  return String(msg?.textRu || msg?.text || "");
}

function formatMsg(msg) {
  const when = String(msg.at || "").replace("T", " ").replace(/\.\d+Z$/, "Z");
  const meta = [msg.kind, msg.round ? `R${msg.round}` : "", msg.slot || ""].filter(Boolean).join(" ");
  return `[${when}] ${msg.name || msg.role}${meta ? ` (${meta})` : ""}\n${msgText(msg)}`;
}

function roomMessages(state) {
  return state?.run?.messages || [];
}

function latest(items, n) {
  const limit = Number.isFinite(n) && n > 0 ? n : 20;
  return items.slice(-limit);
}

function printItems(items, json) {
  if (json) console.log(JSON.stringify(items, null, 2));
  else console.log(items.map(formatMsg).join("\n\n---\n\n"));
}

async function cmdState(json) {
  const s = await getState();
  const active = activeSubtask(s);
  const summary = {
    activeRunId: s.activeRunId || "",
    topic: s.run?.topic || "",
    busy: Boolean(s.busy),
    status: s.status || "",
    autopilot: s.autopilot || null,
    execAutopilot: s.execAutopilot || null,
    activeSubtask: active ? {
      id: active.id,
      status: active.status,
      mode: active.mode,
      rounds: active.rounds,
      title: active.title,
    } : null,
    participants: s.run?.settings?.participants || s.settings?.participants || [],
  };
  if (json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Run: ${summary.activeRunId || "(none)"}`);
    console.log(`Topic: ${summary.topic || "(none)"}`);
    console.log(`Status: ${summary.status}${summary.busy ? " (busy)" : ""}`);
    console.log(`Active subtask: ${summary.activeSubtask ? `${summary.activeSubtask.id} ${summary.activeSubtask.mode} R${summary.activeSubtask.rounds} - ${summary.activeSubtask.title}` : "(none)"}`);
    console.log(`Autopilot: ${summary.autopilot?.running ? "running" : "off"}; exec: ${summary.execAutopilot?.running ? "running" : "off"}`);
  }
}

function reviewPrompt(state, limit) {
  const active = activeSubtask(state);
  const msgs = latest(roomMessages(state).filter((m) => m.role === "agent" || m.role === "user"), limit || 12);
  return [
    "You are an external reviewer for a Council Room debate.",
    "Evaluate whether the agents reached a coherent decision, identify contradictions, missing evidence, and next action.",
    "",
    `Active subtask: ${active ? `${active.id} - ${active.title}` : "(none)"}`,
    "",
    "Recent room transcript:",
    msgs.map(formatMsg).join("\n\n---\n\n"),
  ].join("\n");
}

async function streamEvents(showState) {
  const res = await fetch(`${base}/api/events`);
  if (!res.ok || !res.body) throw new Error(`SSE failed: HTTP ${res.status}`);
  const decoder = new TextDecoder();
  let buf = "";
  let eventName = "message";
  let dataLines = [];
  const flush = () => {
    if (!dataLines.length) return;
    const raw = dataLines.join("\n");
    dataLines = [];
    const name = eventName;
    eventName = "message";
    if (name === "stream") {
      try {
        const d = JSON.parse(raw);
        const label = d.label || d.agent || "agent";
        if (d.reset) console.log(`\n[stream:${label}] reset`);
        if (d.chunk) process.stdout.write(`[${label}] ${d.chunk}`);
      } catch {
        console.log(raw);
      }
    } else if (showState) {
      try {
        const s = JSON.parse(raw);
        const active = activeSubtask(s);
        console.log(`[state] ${s.status || "idle"}${active ? ` active=${active.id} R${active.rounds}` : ""}`);
      } catch {
        console.log(raw);
      }
    }
  };
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      if (!line) { flush(); continue; }
      if (line.startsWith("event:")) eventName = line.slice(6).trim() || "message";
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
  }
}

async function main() {
  if (command === "help" || command === "--help" || command === "-h") return usage();
  if (command === "state") return cmdState(args.json);
  if (command === "agents") {
    const s = await getState();
    return printItems(latest(roomMessages(s).filter((m) => m.role === "agent"), args.limit), args.json);
  }
  if (command === "trace") {
    const s = await getState();
    return printItems(latest(roomMessages(s).filter((m) => m.kind === "process" || String(m.kind || "").startsWith("subtask-")), args.limit), args.json);
  }
  if (command === "transcript") {
    const s = await getState();
    return printItems(latest(roomMessages(s).filter((m) => !m.trashed), args.limit), args.json);
  }
  if (command === "review-prompt") {
    console.log(reviewPrompt(await getState(), args.limit));
    return;
  }
  if (command === "stream") return streamEvents(Boolean(args.state));
  if (command === "open-subtask") {
    const title = args._.slice(1).join(" ").trim();
    if (!title) throw new Error("open-subtask requires a title");
    console.log(JSON.stringify(await request("POST", "/api/subtasks/open", { title, mode: args.mode || "STANDARD" }), null, 2));
    return;
  }
  if (command === "run-round") {
    console.log(JSON.stringify(await request("POST", "/api/round", { guidance: args._.slice(1).join(" ") }), null, 2));
    return;
  }
  if (command === "autopilot-start") {
    console.log(JSON.stringify(await request("POST", "/api/autopilot/start", { autoResolve: Boolean(args.autoResolve), guidance: args._.slice(1).join(" ") }), null, 2));
    return;
  }
  if (command === "autopilot-stop") {
    console.log(JSON.stringify(await request("POST", "/api/autopilot/stop", {}), null, 2));
    return;
  }
  if (command === "resolve") {
    const id = args._[1];
    if (!id) throw new Error("resolve requires subtaskId");
    console.log(JSON.stringify(await request("POST", "/api/subtasks/resolve", { id, summary: args._.slice(2).join(" ") }), null, 2));
    return;
  }
  if (command === "freeze") {
    const id = args._[1];
    if (!id) throw new Error("freeze requires subtaskId");
    console.log(JSON.stringify(await request("POST", "/api/subtasks/freeze", { id, reason: args._.slice(2).join(" ") }), null, 2));
    return;
  }
  if (command === "reopen") {
    const id = args._[1];
    if (!id) throw new Error("reopen requires subtaskId");
    console.log(JSON.stringify(await request("POST", "/api/subtasks/reopen", { id }), null, 2));
    return;
  }
  if (command === "switch-run") {
    const runId = args._[1];
    if (!runId) throw new Error("switch-run requires runId");
    console.log(JSON.stringify(await request("POST", "/api/runs/switch", { runId }), null, 2));
    return;
  }
  if (command === "post") {
    const path = args._[1];
    if (!path) throw new Error("post requires apiPath");
    const body = args._[2] ? JSON.parse(args._.slice(2).join(" ")) : {};
    console.log(JSON.stringify(await request("POST", path, body), null, 2));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Council Room CLI error: ${error.message}`);
  process.exit(1);
});
