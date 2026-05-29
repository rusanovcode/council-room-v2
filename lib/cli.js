const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const IS_WIN = process.platform === "win32";
const ROOT = path.resolve(__dirname, "..");
const LOCAL_CODEX_JS = path.join(ROOT, "node_modules", "@openai", "codex", "bin", "codex.js");
const LOCAL_CLAUDE_EXE = path.join(ROOT, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
const LOCAL_CLAUDE_CMD = path.join(ROOT, "node_modules", ".bin", IS_WIN ? "claude.cmd" : "claude");
const LOCAL_CODEX_CMD_WIN = path.join(ROOT, "node_modules", ".bin", "codex.cmd");
const LOCAL_CODEX_CMD_NIX = path.join(ROOT, "node_modules", ".bin", "codex");

const NPM_PREFIX = (() => {
  if (IS_WIN) return path.join(process.env.APPDATA || "", "npm");
  // POSIX: typical global npm dirs
  const home = process.env.HOME || "";
  for (const candidate of ["/usr/local", "/opt/homebrew", path.join(home, ".npm-global"), path.join(home, ".nvm/versions")]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return "/usr/local";
})();
const DEFAULT_CODEX_CMD_WIN = path.join(NPM_PREFIX, "codex.cmd");
const DEFAULT_CODEX_CMD_NIX = "codex"; // rely on PATH
const DEFAULT_CODEX_JS_WIN = path.join(NPM_PREFIX, "node_modules", "@openai", "codex", "bin", "codex.js");
const DEFAULT_CODEX_JS_NIX = path.join(NPM_PREFIX, "lib", "node_modules", "@openai", "codex", "bin", "codex.js");
const DEFAULT_TIMEOUT_MS = Number(process.env.COUNCIL_ROOM_V2_TIMEOUT_MS || 300000);

function getCodexJs() {
  if (process.env.CODEX_JS && fs.existsSync(process.env.CODEX_JS)) return process.env.CODEX_JS;
  if (fs.existsSync(LOCAL_CODEX_JS)) return LOCAL_CODEX_JS;
  const sys = IS_WIN ? DEFAULT_CODEX_JS_WIN : DEFAULT_CODEX_JS_NIX;
  if (fs.existsSync(sys)) return sys;
  return "";
}

function getCodexCmd() {
  if (process.env.CODEX_CMD) return process.env.CODEX_CMD;
  if (IS_WIN) {
    if (fs.existsSync(LOCAL_CODEX_CMD_WIN)) return LOCAL_CODEX_CMD_WIN;
    return DEFAULT_CODEX_CMD_WIN;
  }
  if (fs.existsSync(LOCAL_CODEX_CMD_NIX)) return LOCAL_CODEX_CMD_NIX;
  return DEFAULT_CODEX_CMD_NIX;
}

function getClaudeCmd() {
  if (process.env.CLAUDE_CMD) return process.env.CLAUDE_CMD;
  if (IS_WIN && fs.existsSync(LOCAL_CLAUDE_EXE)) return LOCAL_CLAUDE_EXE;
  if (fs.existsSync(LOCAL_CLAUDE_CMD)) return LOCAL_CLAUDE_CMD;
  return "claude";
}

function describeCodex() {
  const js = getCodexJs();
  return js ? `node ${js}` : getCodexCmd();
}

function describeClaude() {
  return getClaudeCmd();
}

// Kill a child AND its descendants. On Windows the cmd.exe wrapper spawns the
// real agent (node/codex) as a grandchild, and child.kill()/SIGTERM only kills
// the wrapper — leaving the agent running. taskkill /T kills the whole tree.
function killTree(child) {
  if (!child || child.killed || child.exitCode !== null || child.signalCode) return;
  const pid = child.pid;
  if (!pid) return;
  try {
    if (IS_WIN) {
      spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
      try { process.kill(-pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
    }
  } catch {}
}

function runCommand(command, args, input, options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const useCmd = options.useCmd || false;
    const cwd = options.cwd || ROOT;
    const signal = options.signal || undefined;
    // NOTE: on Windows with useCmd, abort/SIGTERM kills the cmd.exe wrapper; the
    // inner node/codex process can survive as an orphan. Same limitation as the
    // timeout path — acceptable for Phase 2.
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let child;
    if (signal && signal.aborted) {
      resolve({ ok: false, code: -1, stdout: "", stderr: "aborted", timedOut: false, aborted: true, durationMs: Date.now() - startedAt });
      return;
    }
    try {
      const env = options.env ? { ...process.env, ...options.env } : process.env;
      const spawnOpts = { cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], signal, killSignal: "SIGTERM", env };
      child = useCmd
        ? spawn("cmd.exe", ["/d", "/c", command, ...args], spawnOpts)
        : spawn(command, args, spawnOpts);
    } catch (error) {
      resolve({ ok: false, code: -1, stdout: "", stderr: error.message, timedOut: false, durationMs: Date.now() - startedAt });
      return;
    }
    if (typeof options.onChild === "function") {
      try { options.onChild(child); } catch {}
    }
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    if (typeof options.onStdout === "function") {
      child.stdout.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        stdout += text;
        try { options.onStdout(text); } catch {}
      });
    } else {
      child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    }
    if (typeof options.onStderr === "function") {
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        stderr += text;
        try { options.onStderr(text); } catch {}
      });
    } else {
      child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    }
    child.on("error", (error) => {
      clearTimeout(timer);
      const aborted = error && error.name === "AbortError";
      resolve({ ok: false, code: -1, stdout, stderr: aborted ? "aborted" : `${stderr}\n${error.message}`.trim(), timedOut, aborted, durationMs: Date.now() - startedAt });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const aborted = Boolean(signal && signal.aborted);
      resolve({ ok: code === 0 && !timedOut && !aborted, code, stdout, stderr, timedOut, aborted, durationMs: Date.now() - startedAt });
    });
    child.stdin.end(input || "", "utf8");
  });
}

async function runCodex(prompt, { workdir, model = "", effort = "auto", outFile = "", logFile = "", onStream, isolated = true, signal, onChild, accountEnv } = {}) {
  const codexJs = getCodexJs();
  // When isolated: point --cd at an empty sandbox dir so the agent has nothing nearby to scan.
  // When opened: --cd points at the real project workdir.
  let cdTarget = workdir || ROOT;
  if (isolated) {
    cdTarget = path.join(ROOT, "rooms", "_sandbox");
    fs.mkdirSync(cdTarget, { recursive: true });
  }
  const args = [
    ...(codexJs ? [codexJs, "exec"] : ["exec"]),
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--cd",
    cdTarget,
  ];
  if (outFile) args.push("--output-last-message", outFile);
  if (model) args.push("--model", model);
  if (effort !== "auto") args.push("--config", `model_reasoning_effort="${effort}"`);
  args.push("-");
  const result = await runCommand(codexJs ? "node" : getCodexCmd(), args, prompt, {
    useCmd: IS_WIN, // cmd.exe wrapping fixes PowerShell shell_snapshot on Windows; on macOS/Linux spawn directly
    onStdout: onStream,
    onStderr: onStream,
    signal,
    onChild,
    env: accountEnv,
  });
  if (logFile) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, [
      `command: codex`, `args: ${JSON.stringify(args)}`, `code: ${result.code}`, `timedOut: ${result.timedOut}`,
      `durationMs: ${result.durationMs}`, "", "STDOUT:", result.stdout, "", "STDERR:", result.stderr,
    ].join("\n"), "utf8");
  }
  const output = outFile && fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim() : result.stdout.trim();
  if (result.ok && output) return { ok: true, text: output, result };
  return {
    ok: false,
    text: ["Codex CLI failed.", `exitCode: ${result.code}`, result.timedOut ? "timedOut: true" : "", result.stderr ? `stderr:\n${result.stderr.slice(0, 2000)}` : ""].filter(Boolean).join("\n"),
    result,
  };
}

async function runClaude(prompt, { workdir, model = "", effort = "auto", logFile = "", onStream, isolated = true, signal, onChild, accountEnv } = {}) {
  const args = ["-p", "--permission-mode", "default", "--output-format", "text", "--tools", "", "--no-session-persistence"];
  if (model) args.push("--model", model);
  if (effort !== "auto") args.push("--effort", effort);
  let cwd = workdir;
  if (isolated) {
    cwd = path.join(ROOT, "rooms", "_sandbox");
    fs.mkdirSync(cwd, { recursive: true });
  }
  const result = await runCommand(getClaudeCmd(), args, prompt, {
    cwd,
    onStdout: onStream,
    onStderr: onStream,
    signal,
    onChild,
    env: accountEnv,
  });
  if (logFile) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, [
      `command: claude`, `args: ${JSON.stringify(args)}`, `code: ${result.code}`, `timedOut: ${result.timedOut}`,
      `durationMs: ${result.durationMs}`, "", "STDOUT:", result.stdout, "", "STDERR:", result.stderr,
    ].join("\n"), "utf8");
  }
  const output = result.stdout.trim();
  if (result.ok && output) return { ok: true, text: output, result };
  return {
    ok: false,
    text: ["Claude CLI failed.", `exitCode: ${result.code}`, result.timedOut ? "timedOut: true" : "", result.stderr ? `stderr:\n${result.stderr.slice(0, 2000)}` : ""].filter(Boolean).join("\n"),
    result,
  };
}

// Open a VISIBLE terminal that logs in the given account. Interactive auth
// (OAuth/device flow) can't run headless, so we launch a console in the account's
// env and let the user finish there. Windows: a temp .bat avoids quoting hell.
function spawnLogin(tool, accountEnv = {}) {
  const loginCmd = tool === "codex" ? "codex login" : "claude /login";
  try {
    if (IS_WIN) {
      // English hints in the console to dodge cmd code-page issues; the in-app modal
      // carries the localized step-by-step guidance.
      const lines = [
        "@echo off",
        "chcp 65001 >nul",
        ...Object.entries(accountEnv).map(([k, v]) => `set "${k}=${v}"`),
        `echo ============================================`,
        `echo  Council Room v2 - login: ${tool}`,
        `echo ============================================`,
        "echo  1) The login command runs below.",
        "echo  2) If a browser opens, sign in with the CORRECT account.",
        "echo  3) Wait for a success message.",
        "echo.",
        loginCmd,
        "echo.",
        "echo Done? You can close this window and return to Council Room.",
        "pause",
      ];
      const bat = path.join(os.tmpdir(), `crv2-login-${tool}-${Date.now()}.bat`);
      fs.writeFileSync(bat, lines.join("\r\n"), "utf8");
      spawn("cmd.exe", ["/c", "start", "", bat], { windowsHide: false, detached: true, stdio: "ignore" }).unref();
    } else {
      const envPrefix = Object.entries(accountEnv).map(([k, v]) => `${k}="${v}"`).join(" ");
      const full = `${envPrefix} ${loginCmd}`.trim();
      if (process.platform === "darwin") {
        spawn("osascript", ["-e", `tell app "Terminal" to do script "${full.replace(/"/g, '\\"')}"`], { detached: true, stdio: "ignore" }).unref();
      } else {
        spawn("x-terminal-emulator", ["-e", "bash", "-lc", `${full}; exec bash`], { detached: true, stdio: "ignore" }).unref();
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  getCodexJs,
  getCodexCmd,
  getClaudeCmd,
  describeCodex,
  describeClaude,
  runCodex,
  runClaude,
  killTree,
  spawnLogin,
};
