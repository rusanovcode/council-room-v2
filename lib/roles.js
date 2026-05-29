// Phase 5: role runner. Turns a resolved role (a profile chain + mode) into a
// single { ok, text, aborted, result } by dispatching each profile to its backend
// and applying failover. This is the one place runRound calls to execute a slot,
// replacing the hardcoded runCodexOn/runClaudeOn pair.

const cli = require("./cli");
const providers = require("./providers");
const switcher = require("./switcher");
const { isCliProvider, cliTool } = require("./profiles");

// Run ONE profile against a prompt. Returns the uniform shape. CLI providers are
// only valid in the "full" build; in "api" they fail fast with a clear message.
async function runProfile(profile, prompt, opts = {}) {
  if (!profile) return { ok: false, aborted: false, text: "no profile", result: {} };
  if (isCliProvider(profile.provider)) {
    if (providers.mode() === "api") {
      return { ok: false, aborted: false, text: `CLI provider ${profile.provider} is disabled in the API build (PROVIDERS_MODE=api)`, result: {} };
    }
    const tool = cliTool(profile.provider);
    const runner = tool === "codex" ? cli.runCodex : cli.runClaude;
    return runner(prompt, {
      workdir: opts.workdir,
      model: opts.model || profile.model || "",
      effort: opts.effort || profile.effort || "auto",
      isolated: opts.isolated,
      signal: opts.signal,
      onStream: opts.onStream,
      onChild: opts.onChild,
      outFile: opts.outFile, // codex only; runClaude ignores it
      logFile: opts.logFile,
      accountEnv: switcher.envForAccount(tool, profile.account || "acc1"),
    });
  }
  // Network provider (openai-compatible / ollama / presets).
  return providers.runProfile(profile, prompt, {
    model: opts.model || profile.model || "",
    effort: opts.effort || profile.effort || "auto",
    signal: opts.signal,
    onStream: opts.onStream,
    logFile: opts.logFile,
    timeoutMs: opts.timeoutMs,
    extraHeaders: opts.extraHeaders,
  });
}

// Run a role (resolved by profiles.effectiveConfig): try its profile chain.
// mode "auto" walks the chain until one succeeds; "manual" uses only the first.
// We never fail over on a user abort (matches the old behavior). opts.verify
// overrides model/effort for the verification pass — applied to whichever profile
// answers. The role stores its verify values in role.verify; the CALLER decides
// when to apply them (server passes opts.verify = role.verify only in verifyMode),
// so normal rounds use each profile's own model. opts.onFailover(next, prev) fires
// before each retry (server uses it to reset the live terminal and log the switch).
//
// Returns { ok, text, aborted, result, profile, attempts }.
async function runRole(role, prompt, opts = {}, deps = {}) {
  const exec = deps.runProfile || runProfile;
  const chain = (role && role.chain) || [];
  if (!chain.length) {
    return { ok: false, aborted: false, text: `role "${role && role.label || "?"}" has no profile configured`, result: {}, profile: null, attempts: [] };
  }
  const list = role.mode === "auto" ? chain : chain.slice(0, 1);
  const verify = opts.verify || null; // only when the caller asks (verifyMode)
  const attempts = [];
  let last = null;
  for (let i = 0; i < list.length; i++) {
    const profile = list[i];
    if (i > 0 && typeof opts.onFailover === "function") {
      try { opts.onFailover(profile, list[i - 1]); } catch {}
    }
    const res = await exec(profile, prompt, {
      ...opts,
      // verify override wins; otherwise leave undefined so the profile decides.
      model: (verify && verify.model) || undefined,
      effort: (verify && verify.effort) || undefined,
    });
    attempts.push({ profileId: profile.id, ok: Boolean(res.ok), aborted: Boolean(res.aborted) });
    last = { ...res, profile };
    if (res.ok || res.aborted) break;
  }
  return { ...last, attempts };
}

module.exports = { runProfile, runRole };
