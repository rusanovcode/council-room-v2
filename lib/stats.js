const fs = require("node:fs");
const path = require("node:path");

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

// 5h / 7d rolling windows from Claude's usage cache.
function usageWindows(configDir) {
  const data = readJsonSafe(path.join(configDir, ".usage-cache.json"));
  if (!data || typeof data !== "object") return null;
  const win = (w, hours) => {
    if (!w || typeof w.utilization !== "number") return null;
    const resetsAt = w.resets_at || null;
    const startsAt = resetsAt && hours ? new Date(new Date(resetsAt).getTime() - hours * 3600 * 1000).toISOString() : null;
    return { utilization: w.utilization, resetsAt, startsAt };
  };
  return { fiveHour: win(data.five_hour, 5), sevenDay: win(data.seven_day, 24 * 7) };
}

function listJsonl(dir) {
  const out = [];
  const walk = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function cutoffFor(period) {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  return null; // all
}

// Cumulative spending from Claude session JSONL (message.usage), like CodeBurn / ai-tokens.ps1.
function spending(configDir, period) {
  const projectsDir = path.join(configDir, "projects");
  if (!fs.existsSync(projectsDir)) return null;
  const cutoff = cutoffFor(period);
  let inTok = 0, outTok = 0, cacheR = 0, cacheW = 0, sessions = 0, cost = 0;
  for (const file of listJsonl(projectsDir)) {
    let content;
    try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.timestamp && cutoff && new Date(ev.timestamp) < cutoff) continue;
      const u = ev.message && ev.message.usage;
      if (u) {
        inTok += u.input_tokens || 0;
        outTok += u.output_tokens || 0;
        cacheR += u.cache_read_input_tokens || 0;
        cacheW += u.cache_creation_input_tokens || 0;
        sessions += 1;
      }
      if (ev.costUSD) cost += Number(ev.costUSD) || 0;
    }
  }
  const k = (n) => Math.round(n / 100) / 10;
  return { inputK: k(inTok), outputK: k(outTok), cacheReadK: k(cacheR), cacheWriteK: k(cacheW), sessions, costUSD: Math.round(cost * 10000) / 10000 };
}

function accountStats(configDir, period = "today") {
  return { windows: usageWindows(configDir), spending: spending(configDir, period) };
}

module.exports = { accountStats, usageWindows, spending };
