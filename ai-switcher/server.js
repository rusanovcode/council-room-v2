"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const os = require("node:os");
const pty = require("node-pty");

const ROOT = __dirname;
const CODEX_BIN = path.join(process.env.LOCALAPPDATA, "OpenAI", "Codex", "bin", "codex.exe");
const PROFILES_FILE = path.join(ROOT, "profiles.json");
const ACTIVE_FILE = path.join(ROOT, "active.json");
const POLICY_FILE = path.join(ROOT, "projects.policy.json");
const TOKENS_FILE = path.join(ROOT, "tokens.json");
const API_KEYS_FILE = path.join(ROOT, "auth", "api-keys.json");
const AUDIT_FILE = path.join(ROOT, "audit.ndjson");
const LIMITS_FILE = path.join(ROOT, "limits.ndjson");
const LOCKS_DIR = path.join(ROOT, "locks");
const HANDOFF_DIR = path.join(ROOT, "handoff");

const HOST = "127.0.0.1";
const PORT = parseInt(process.env.GATEWAY_PORT || "7700", 10);
const LOCK_WAIT_MS = 30_000;
const STALE_LOCK_MINUTES = 10;

// ---------------------------------------------------------------------------
// Atomic write: tmp → fsync → rename
// ---------------------------------------------------------------------------
function atomicWrite(filePath, data) {
  const tmp = filePath + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  const fd = fs.openSync(tmp, "r+");
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, filePath);
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function otherProfile(profileId) {
  return profileId === "acc1" ? "acc2" : "acc1";
}

// ---------------------------------------------------------------------------
// Policy check (no cache — fresh read every call)
// ---------------------------------------------------------------------------
function resolvePolicy(cwd) {
  const policy = readJSON(POLICY_FILE);
  const normalised = (cwd || "").replace(/\\/g, "/");
  for (const rule of policy.rules) {
    const seg = rule.match.replace(/\\/g, "/");
    if (normalised.includes(seg)) return rule.policy;
  }
  return policy.defaultPolicy || "unclassified";
}

// ---------------------------------------------------------------------------
// Locks
// ---------------------------------------------------------------------------
function lockPath(service, profile) {
  return path.join(LOCKS_DIR, `${service}-${profile}.lock`);
}

function readLocks() {
  const result = {};
  try {
    const files = fs.readdirSync(LOCKS_DIR).filter(f => f.endsWith(".lock"));
    for (const f of files) {
      const key = f.replace(/\.lock$/, "");
      try {
        const content = fs.readFileSync(path.join(LOCKS_DIR, f), "utf8").trim();
        const [pidStr, lockedBy] = content.split(":");
        const pid = parseInt(pidStr, 10);
        result[key] = { pid, lockedBy: lockedBy || null, alive: isAlive(pid) };
      } catch {
        result[key] = { pid: null, lockedBy: null, alive: false };
      }
    }
  } catch {}
  return result;
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function cleanStaleLock(lp) {
  try {
    const stat = fs.statSync(lp);
    const ageMin = (Date.now() - stat.mtimeMs) / 60000;
    if (ageMin < STALE_LOCK_MINUTES) return false;
    const content = fs.readFileSync(lp, "utf8").trim();
    const pid = parseInt(content.split(":")[0], 10);
    if (!isNaN(pid) && isAlive(pid)) return false;
    fs.unlinkSync(lp);
    return true;
  } catch { return false; }
}

function acquireLock(service, profile, projectId) {
  const lp = lockPath(service, profile);
  const deadline = Date.now() + LOCK_WAIT_MS;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      cleanStaleLock(lp);
      try {
        const fd = fs.openSync(lp, "wx");
        fs.writeSync(fd, `${process.pid}:${projectId || ""}`);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        return resolve(() => { try { fs.unlinkSync(lp); } catch {} });
      } catch (e) {
        if (e.code !== "EEXIST") return reject(e);
        if (Date.now() >= deadline) {
          let lockedBy = "unknown";
          try {
            const content = fs.readFileSync(lp, "utf8").trim();
            lockedBy = content.split(":")[1] || "unknown";
          } catch {}
          const err = new Error(`Lock timeout for ${service}-${profile}`);
          err.lockedBy = lockedBy;
          return reject(err);
        }
        setTimeout(attempt, 500);
      }
    };
    attempt();
  });
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
function appendLine(filePath, obj) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function auditLog(entry) {
  appendLine(AUDIT_FILE, { ts: new Date().toISOString(), ...entry });
}

function limitsLog(entry) {
  appendLine(LIMITS_FILE, { ts: new Date().toISOString(), ...entry });
}

function recordUsage(service, profileId, entry) {
  try {
    const tokens = readJSON(TOKENS_FILE);
    if (!tokens[service]) tokens[service] = {};
    if (!tokens[service][profileId]) tokens[service][profileId] = { usageEvents: [] };
    tokens[service][profileId].usageEvents.push({ ts: new Date().toISOString(), ...entry });
    atomicWrite(TOKENS_FILE, tokens);
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Claude issue detector — deny-list checked FIRST
// Returns { kind: "limit"|"deny", event } or null
// Deny wins if both deny and limit events found in same session
// ---------------------------------------------------------------------------
const CLAUDE_LIMIT_RE = /you[‘’]?ve (?:hit|reached) your (?:usage )?limit/i;
const CLAUDE_DENY_ERROR_RE = /authentication_failed|invalid_request|oauth_org_not_allowed/i;
const CLAUDE_DENY_TEXT_RE = /network|timeout|ECONNRESET|getaddrinfo/i;

function detectClaudeIssue(configDir, startTime) {
  const projectsDir = path.join(configDir, "projects");
  if (!fs.existsSync(projectsDir)) return null;
  let denyEvent = null, limitEvent = null;
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith(".jsonl"));
  for (const file of files) {
    try {
      const lines = fs.readFileSync(path.join(projectsDir, file), "utf8")
        .split("\n").filter(Boolean);
      for (const line of lines) {
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (!ev.timestamp) continue;
        const evTime = new Date(ev.timestamp).getTime();
        if (evTime < startTime - 5000) continue;
        if (!ev.isApiErrorMessage) continue;
        // Step 1: deny-list (absolute priority)
        if (!denyEvent) {
          if (ev.apiErrorStatus === 401 || ev.apiErrorStatus === 403 ||
              CLAUDE_DENY_ERROR_RE.test(ev.error || "") ||
              CLAUDE_DENY_TEXT_RE.test(ev.text || "")) {
            denyEvent = ev;
          }
        }
        // Step 2: whitelist (only if deny not already found)
        if (!limitEvent && (ev.apiErrorStatus === 429 || ev.error === "rate_limit")) {
          const text = ev.text || (ev.content && ev.content[0] && ev.content[0].text) || "";
          if (CLAUDE_LIMIT_RE.test(text)) limitEvent = ev;
        }
      }
    } catch { /* skip unreadable files */ }
  }
  if (denyEvent) return { kind: "deny", event: denyEvent };
  if (limitEvent) return { kind: "limit", event: limitEvent };
  return null;
}

// ---------------------------------------------------------------------------
// Profile env builder
// ---------------------------------------------------------------------------
function buildEnv(service, profileId) {
  const profiles = readJSON(PROFILES_FILE);
  const svc = profiles[service];
  if (!svc) throw new Error(`Unknown service: ${service}`);
  const prof = svc.profiles[profileId];
  if (!prof) throw new Error(`Unknown profile: ${service}/${profileId}`);

  const env = { ...process.env, ...prof.env };

  if (prof.mode === "api") {
    let apiKey = null;
    try {
      const keys = readJSON(API_KEYS_FILE);
      apiKey = (keys[service] && keys[service][profileId]) || null;
    } catch {}
    if (!apiKey) throw new Error(`API key not set for ${service}/${profileId}. Use POST /api-key to set it.`);
    if (service === "claude") {
      env.ANTHROPIC_API_KEY = apiKey;
      delete env.CLAUDE_CONFIG_DIR;
    } else if (service === "codex") {
      env.OPENAI_API_KEY = apiKey;
      delete env.CODEX_HOME;
    }
  } else if (prof.configDir) {
    if (service === "claude") {
      env.CLAUDE_CONFIG_DIR = prof.configDir;
    } else if (service === "codex") {
      env.CODEX_HOME = prof.configDir;
    }
  } else {
    if (service === "claude") delete env.CLAUDE_CONFIG_DIR;
    if (service === "codex") delete env.CODEX_HOME;
  }
  return { env, prof };
}

// ---------------------------------------------------------------------------
// Run handler
// ---------------------------------------------------------------------------
async function handleRun(body, res) {
  const { service, prompt, cwd, projectId } = body || {};

  if (!service || !["claude", "codex"].includes(service)) {
    return send(res, 400, { error: "service must be 'claude' or 'codex'" });
  }
  if (!prompt) return send(res, 400, { error: "prompt required" });
  if (!cwd) return send(res, 400, { error: "cwd required" });

  // Policy check — no cache
  const policy = resolvePolicy(cwd);
  if (policy !== "client-allowed") {
    auditLog({ action: "run_rejected", service, cwd, policy, projectId });
    return send(res, 403, { error: `Project rejected`, policy });
  }

  // Read active profile
  const active = readJSON(ACTIVE_FILE);
  const profileId = active[service] || "acc1";

  let releaseLock;
  try {
    releaseLock = await acquireLock(service, profileId, projectId);
  } catch (e) {
    if (e.lockedBy !== undefined) {
      return send(res, 503, { status: "BUSY", lockedBy: e.lockedBy });
    }
    return send(res, 503, { error: e.message });
  }

  const startTime = Date.now();
  let env, prof;
  try {
    ({ env, prof } = buildEnv(service, profileId));
  } catch (e) {
    releaseLock();
    return send(res, 400, { error: e.message });
  }

  auditLog({ action: "run_start", service, profile: profileId, cwd, projectId, policyStatus: "client-allowed", lockedBy: projectId });

  try {
    if (service === "claude") {
      await runClaude({ prompt, cwd, env, res, service, profileId, prof, startTime, projectId });
    } else {
      await runCodex({ prompt, cwd, env, res, service, profileId, startTime, projectId });
    }
  } finally {
    releaseLock();
  }
}

function runClaude({ prompt, cwd, env, res, service, profileId, prof, startTime, projectId, isRetry = false, fromProfile = null }) {
  return new Promise((resolve) => {
    const args = ["-p", prompt, "--permission-mode", "default", "--output-format", "text", "--no-session-persistence"];
    const child = spawn("claude", args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "", stderr = "";
    child.stdout.on("data", d => { stdout += d; });
    child.stderr.on("data", d => { stderr += d; });

    child.on("close", (code) => {
      const configDir = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
      const issue = detectClaudeIssue(configDir, startTime);

      const denyMatched = issue?.kind === "deny";
      const whitelistMatched = issue?.kind === "limit";

      if (issue) {
        limitsLog({ service, profile: profileId, projectId, source: "claude_jsonl",
                    type: issue.kind, raw: JSON.stringify(issue.event).slice(0, 500), cwd });
      }

      // Auto-switch: whitelist match, deny-list clean, first attempt only
      if (whitelistMatched && !denyMatched && !isRetry) {
        const newProfileId = otherProfile(profileId);
        const profiles = readJSON(PROFILES_FILE);
        if (profiles.claude.profiles[newProfileId]) {
          const active = readJSON(ACTIVE_FILE);
          active.claude = newProfileId;
          active.updatedAt = new Date().toISOString();
          atomicWrite(ACTIVE_FILE, active);
          auditLog({ action: "auto_switch", service, fromProfile: profileId, toProfile: newProfileId,
                     projectId, cwd, reason: "limit_detected", denyMatched: false,
                     whitelistMatched: true, retryAttempted: true,
                     policyStatus: "client-allowed", lockedBy: projectId });
          const { env: newEnv, prof: newProf } = buildEnv(service, newProfileId);
          return runClaude({ prompt, cwd, env: newEnv, res, service, profileId: newProfileId,
                             prof: newProf, startTime: Date.now(), projectId,
                             isRetry: true, fromProfile: profileId }).then(resolve);
        }
      }

      const reason = denyMatched ? "deny_matched"
                   : (isRetry && whitelistMatched) ? "both_profiles_exhausted"
                   : null;
      auditLog({ action: "run_end", service, profile: profileId, cwd, projectId, exitCode: code,
                 limitDetected: !!issue, denyMatched, whitelistMatched, retryAttempted: isRetry,
                 fromProfile: fromProfile || profileId, toProfile: profileId,
                 policyStatus: "client-allowed", lockedBy: projectId, switchReason: reason });
      recordUsage(service, profileId, { exitCode: code, limitDetected: !!issue });
      send(res, 200, { output: stdout, stderr, exitCode: code, limitDetected: !!issue,
                       denyMatched, switchOccurred: fromProfile !== null, activeProfile: profileId,
                       ...(reason && { reason }) });
      resolve();
    });

    child.on("error", (err) => {
      auditLog({ action: "run_error", service, profile: profileId, cwd, projectId, error: err.message, lockedBy: projectId });
      send(res, 500, { error: err.message });
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Codex limit detection — deny-list checked FIRST
// ---------------------------------------------------------------------------
const CODEX_DENY_RE = /not logged in|please run \/login|unauthorized|401|403|forbidden|network|timeout|ECONNRESET|ECONNREFUSED|getaddrinfo|socket|shell_snapshot|shell snapshot/i;
const CODEX_LIMIT_RE = /rate_limit_reached_type"\s*:\s*"(primary|secondary)"/i;

function checkCodexOutput(data, profileId, projectId, limitAlreadyLogged) {
  // Step 1: deny-list has absolute priority
  if (CODEX_DENY_RE.test(data)) {
    return { action: "deny", reason: "deny_list_match" };
  }
  // Step 2: whitelist (only if deny didn't match)
  const m = CODEX_LIMIT_RE.exec(data);
  if (m && !limitAlreadyLogged) {
    limitsLog({ service: "codex", profile: profileId, projectId, type: m[1], raw: data.slice(0, 500) });
    return { action: "logged", type: m[1] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// JSONL session tailing — finds latest *.jsonl under CODEX_HOME/sessions/
// ---------------------------------------------------------------------------
function findLatestJsonl(codexHome) {
  const sessionsDir = path.join(codexHome, "sessions");
  if (!fs.existsSync(sessionsDir)) return null;
  let latest = null;
  let latestMtime = 0;

  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          try {
            const mtime = fs.statSync(full).mtimeMs;
            if (mtime > latestMtime) { latestMtime = mtime; latest = full; }
          } catch {}
        }
      }
    } catch {}
  }
  walk(sessionsDir);
  return latest;
}

function runCodex({ prompt, cwd, env, res, service, profileId, startTime, projectId, isRetry = false, fromProfile = null }) {
  return new Promise((resolve) => {
    const codexHome = env.CODEX_HOME || path.join(os.homedir(), ".codex");

    let codexProc;
    try {
      // "exec" = non-interactive; "--json" = JSONL events; "--skip-git-repo-check" = no git required
      codexProc = pty.spawn(CODEX_BIN, ["exec", "--json", "--skip-git-repo-check", prompt], {
        name: "xterm-color",
        cols: 120,
        rows: 30,
        cwd,
        env
      });
    } catch (spawnErr) {
      auditLog({ action: "run_error", service, profile: profileId, cwd, projectId, error: spawnErr.message, lockedBy: projectId });
      send(res, 500, { error: spawnErr.message });
      return resolve();
    }

    let outputBuffer = "";
    let limitDetected = false;
    let limitType = null;
    let denyDetected = false;

    function handleChunk(data) {
      outputBuffer += data;
      const result = checkCodexOutput(data, profileId, projectId, limitDetected);
      if (result) {
        if (result.action === "deny") {
          denyDetected = true;
        } else if (result.action === "logged" && !limitDetected) {
          limitDetected = true;
          limitType = result.type;
          auditLog({ action: "limit_detected", service, profile: profileId, cwd, projectId });
        }
      }
    }

    codexProc.onData(handleChunk);

    // Send EOT (Ctrl+D) to signal no additional stdin — codex exec blocks until stdin closes
    setTimeout(() => { try { codexProc.write("\x04"); } catch {} }, 500);

    // JSONL tailing — parallel read of session file for rate_limit_reached_type
    let jsonlPath = null;
    let jsonlOffset = 0;
    const jsonlInterval = setInterval(() => {
      if (!jsonlPath) {
        jsonlPath = findLatestJsonl(codexHome);
        if (!jsonlPath) return;
        try { jsonlOffset = fs.statSync(jsonlPath).size; } catch { jsonlOffset = 0; }
      }
      try {
        const size = fs.statSync(jsonlPath).size;
        if (size <= jsonlOffset) return;
        const fd = fs.openSync(jsonlPath, "r");
        const buf = Buffer.alloc(size - jsonlOffset);
        fs.readSync(fd, buf, 0, buf.length, jsonlOffset);
        fs.closeSync(fd);
        jsonlOffset = size;
        handleChunk(buf.toString("utf8"));
      } catch {}
    }, 500);

    codexProc.onExit(({ exitCode }) => {
      clearInterval(jsonlInterval);
      // final tail pass
      if (jsonlPath) {
        try {
          const size = fs.statSync(jsonlPath).size;
          if (size > jsonlOffset) {
            const fd = fs.openSync(jsonlPath, "r");
            const buf = Buffer.alloc(size - jsonlOffset);
            fs.readSync(fd, buf, 0, buf.length, jsonlOffset);
            fs.closeSync(fd);
            handleChunk(buf.toString("utf8"));
          }
        } catch {}
      }

      // Read failoverEnabled fresh (user may have changed it)
      const profiles = readJSON(PROFILES_FILE);
      const failoverEnabled = profiles.codex.failoverEnabled;

      // Auto-switch: limit detected, deny clean, failover enabled, first attempt only
      const shouldSwitch = limitDetected && !denyDetected && failoverEnabled && !isRetry;
      const reason = denyDetected ? "deny_matched"
                   : (isRetry && limitDetected) ? "both_profiles_exhausted"
                   : null;

      auditLog({ action: "run_end", service, profile: profileId, cwd, projectId, exitCode,
                 limitDetected, denyMatched: denyDetected, whitelistMatched: limitDetected,
                 retryAttempted: shouldSwitch, fromProfile: fromProfile || profileId, toProfile: profileId,
                 policyStatus: "client-allowed", lockedBy: projectId, switchReason: reason });
      recordUsage(service, profileId, { exitCode, limitDetected });

      if (shouldSwitch) {
        const newProfileId = otherProfile(profileId);
        if (profiles.codex.profiles[newProfileId]) {
          const active = readJSON(ACTIVE_FILE);
          active.codex = newProfileId;
          active.updatedAt = new Date().toISOString();
          atomicWrite(ACTIVE_FILE, active);
          auditLog({ action: "auto_switch", service, fromProfile: profileId, toProfile: newProfileId,
                     projectId, cwd, reason: "limit_detected", denyMatched: false,
                     whitelistMatched: true, retryAttempted: true,
                     policyStatus: "client-allowed", lockedBy: projectId });
          const { env: newEnv } = buildEnv(service, newProfileId);
          return runCodex({ prompt, cwd, env: newEnv, res, service, profileId: newProfileId,
                            startTime: Date.now(), projectId, isRetry: true, fromProfile: profileId }).then(resolve);
        }
      }

      send(res, 200, { output: outputBuffer, exitCode, limitDetected, limitType, failoverEnabled,
                       switchOccurred: fromProfile !== null, activeProfile: profileId,
                       ...(reason && { reason }) });
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function router(req, res) {
  const url = new URL(req.url, `http://${HOST}`);
  const method = req.method.toUpperCase();
  const pathname = url.pathname;

  try {
    if (method === "GET" && pathname === "/status") {
      const profiles = readJSON(PROFILES_FILE);
      const active = readJSON(ACTIVE_FILE);
      let apiKeysSet = {};
      try {
        const keys = readJSON(API_KEYS_FILE);
        for (const svc of ["claude", "codex"]) {
          apiKeysSet[svc] = {};
          const svcKeys = keys[svc] || {};
          for (const pid of Object.keys(svcKeys)) {
            apiKeysSet[svc][pid] = !!svcKeys[pid];
          }
        }
      } catch {}
      const profileInfo = {};
      for (const svc of ["claude", "codex"]) {
        profileInfo[svc] = Object.entries(profiles[svc].profiles).map(([id, p]) => ({
          id, label: p.label, mode: p.mode || "session",
          apiKeySet: !!(apiKeysSet[svc] && apiKeysSet[svc][id])
        }));
      }
      return send(res, 200, {
        status: "ok",
        host: HOST,
        port: PORT,
        active,
        codexFailoverEnabled: profiles.codex.failoverEnabled,
        profiles: profileInfo,
        locks: readLocks()
      });
    }

    if (method === "POST" && pathname === "/run") {
      const body = await readBody(req);
      return await handleRun(body, res);
    }

    if (method === "POST" && pathname === "/switch") {
      const body = await readBody(req);
      const { service, profile, reason } = body || {};
      if (!service || !profile) return send(res, 400, { error: "service and profile required" });
      const profiles = readJSON(PROFILES_FILE);
      if (!profiles[service]) return send(res, 400, { error: `Unknown service: ${service}` });
      if (!profiles[service].profiles[profile]) return send(res, 400, { error: `Unknown profile: ${service}/${profile}` });
      const active = readJSON(ACTIVE_FILE);
      active[service] = profile;
      active.updatedAt = new Date().toISOString();
      atomicWrite(ACTIVE_FILE, active);
      auditLog({ action: "switch", service, profile, switchReason: reason || "manual" });
      return send(res, 200, { ok: true, active });
    }

    if (method === "POST" && pathname === "/register") {
      const body = await readBody(req);
      const { projectId, cwd } = body || {};
      if (!projectId || !cwd) return send(res, 400, { error: "projectId and cwd required" });
      const policy = readJSON(POLICY_FILE);
      // Only allow registering client-allowed projects (not protected/ignore/unclassified)
      const existing = resolvePolicy(cwd);
      if (existing === "protected") return send(res, 403, { error: "Cannot register protected project" });
      if (existing === "ignore") return send(res, 403, { error: "Cannot register ignored project" });
      // Add new rule as client-allowed
      policy.rules.push({ match: projectId, policy: "client-allowed" });
      atomicWrite(POLICY_FILE, policy);
      auditLog({ action: "register", projectId, cwd });
      return send(res, 200, { ok: true, projectId, policy: "client-allowed" });
    }

    if (method === "GET" && pathname === "/policy") {
      const policy = readJSON(POLICY_FILE);
      return send(res, 200, policy);
    }

    if (method === "POST" && pathname === "/policy") {
      const body = await readBody(req);
      const { projectId, policy: pol } = body || {};
      if (!projectId || !pol) return send(res, 400, { error: "projectId and policy required" });
      const validPolicies = ["client-allowed", "protected", "ignore", "unclassified"];
      if (!validPolicies.includes(pol)) return send(res, 400, { error: `Invalid policy. Valid: ${validPolicies.join(", ")}` });
      const policy = readJSON(POLICY_FILE);
      const existing = policy.rules.find(r => r.match === projectId);
      if (existing) {
        existing.policy = pol;
      } else {
        policy.rules.push({ match: projectId, policy: pol });
      }
      atomicWrite(POLICY_FILE, policy);
      auditLog({ action: "policy_set", projectId, policy: pol });
      return send(res, 200, { ok: true, projectId, policy: pol });
    }

    if (method === "GET" && pathname === "/api-key") {
      const service = url.searchParams.get("service");
      const profile = url.searchParams.get("profile");
      if (!service || !profile) return send(res, 400, { error: "service and profile query params required" });
      const profiles = readJSON(PROFILES_FILE);
      if (!profiles[service]?.profiles[profile]) return send(res, 404, { error: `Unknown profile: ${service}/${profile}` });
      let set = false;
      try {
        const keys = readJSON(API_KEYS_FILE);
        set = !!(keys[service] && keys[service][profile]);
      } catch {}
      return send(res, 200, { service, profile, set });
    }

    if (method === "POST" && pathname === "/api-key") {
      const body = await readBody(req);
      const { service, profile, key } = body || {};
      if (!service || !profile) return send(res, 400, { error: "service and profile required" });
      if (!key || typeof key !== "string" || !key.trim()) return send(res, 400, { error: "key required" });
      const profiles = readJSON(PROFILES_FILE);
      if (!profiles[service]) return send(res, 400, { error: `Unknown service: ${service}` });
      if (!profiles[service].profiles[profile]) return send(res, 400, { error: `Unknown profile: ${service}/${profile}` });
      if (profiles[service].profiles[profile].mode !== "api") {
        return send(res, 400, { error: `Profile ${service}/${profile} is not an API key profile` });
      }
      let keys = {};
      try { keys = readJSON(API_KEYS_FILE); } catch {}
      if (!keys[service]) keys[service] = {};
      keys[service][profile] = key.trim();
      atomicWrite(API_KEYS_FILE, keys);
      auditLog({ action: "api_key_set", service, profile });
      return send(res, 200, { ok: true, service, profile });
    }

    if (method === "DELETE" && pathname === "/api-key") {
      const body = await readBody(req);
      const { service, profile } = body || {};
      if (!service || !profile) return send(res, 400, { error: "service and profile required" });
      let keys = {};
      try { keys = readJSON(API_KEYS_FILE); } catch {}
      if (keys[service]) delete keys[service][profile];
      atomicWrite(API_KEYS_FILE, keys);
      auditLog({ action: "api_key_delete", service, profile });
      return send(res, 200, { ok: true, service, profile });
    }

    if (method === "POST" && pathname === "/kill") {
      const body = await readBody(req);
      const { service, profile } = body || {};
      if (!service) return send(res, 400, { error: "service required" });
      const lp = lockPath(service, profile || "acc1");
      let killed = false;
      if (fs.existsSync(lp)) {
        try {
          const pid = parseInt(fs.readFileSync(lp, "utf8").trim(), 10);
          if (!isNaN(pid) && isAlive(pid)) {
            process.kill(pid, "SIGTERM");
            killed = true;
          }
          fs.unlinkSync(lp);
        } catch {}
      }
      auditLog({ action: "kill", service, profile });
      return send(res, 200, { ok: true, killed });
    }

    return send(res, 404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message });
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
fs.mkdirSync(LOCKS_DIR, { recursive: true });
fs.mkdirSync(HANDOFF_DIR, { recursive: true });

const server = http.createServer(router);
server.listen(PORT, HOST, () => {
  console.log(`Gateway listening on http://${HOST}:${PORT}`);
  console.log(`Profiles: ${PROFILES_FILE}`);
  console.log(`Policy:   ${POLICY_FILE}`);
  console.log(`Audit:    ${AUDIT_FILE}`);
});
