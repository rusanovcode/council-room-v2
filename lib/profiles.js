// Phase 5: profiles + roles data model.
//
// A *profile* is a named backend: { id, label, provider, model, effort, ... }.
//   - CLI providers (full build only): provider "cli-codex" | "cli-claude",
//     account "acc1" | "acc2" (the old multi-account is now just two profiles).
//   - Network providers: provider = a preset id (deepseek, ollama, …) or a raw
//     type ("openai-compatible" | "ollama") with baseUrl/credentialRef.
//
// A *role* is one of the two debate slots. The internal slot keys stay "codex"
// (role A) and "claude" (role B) for backward compatibility — questions.js,
// KB attribution, the transcript and the client terminals all key off those.
// What's configurable per role is the display label and the ordered chain of
// profiles (primary + failover). Role A always drives slot "codex", role B
// slot "claude"; only their backends and labels change.
//
// Settings may be EXPLICIT (settings.profiles + settings.roles, written by the
// new UI) or LEGACY (the old codexModel/codexAccount/… fields). effectiveConfig
// resolves either into the same shape, so old chats keep working untouched.

// The FINAL VERIFICATION pass is run by the strongest CLI agents at max reasoning.
// (Mirrors server.js VERIFY_AGENTS; kept here so derived roles carry the override.)
const VERIFY_AGENTS = { codexModel: "gpt-5.5", codexEffort: "xhigh", claudeModel: "opus", claudeEffort: "max" };

const CLI_PROVIDERS = new Set(["cli-codex", "cli-claude"]);

function isCliProvider(provider) {
  return CLI_PROVIDERS.has(provider);
}

function cliTool(provider) {
  return provider === "cli-codex" ? "codex" : provider === "cli-claude" ? "claude" : null;
}

// --- Legacy → profiles/roles derivation (reproduces today's runRound behavior) ---

function legacyProfiles(settings) {
  const mk = (tool, acc) => ({
    id: `${tool}-${acc}`,
    label: `${tool === "codex" ? "Codex" : "Claude"} · ${acc}`,
    provider: tool === "codex" ? "cli-codex" : "cli-claude",
    account: acc,
    model: (tool === "codex" ? settings.codexModel : settings.claudeModel) || "",
    effort: (tool === "codex" ? settings.codexEffort : settings.claudeEffort) || "auto",
  });
  return [mk("codex", "acc1"), mk("codex", "acc2"), mk("claude", "acc1"), mk("claude", "acc2")];
}

// Ordered profile-id chain for a slot, matching the current account pick +
// single-step auto-failover. env = { connected, codexAcc2, claudeAcc2 }.
function legacyChain(tool, settings, env) {
  const wantAcc2 = settings[`${tool}Account`] === "acc2" || Number(settings[`${tool}Account`]) === 2;
  const acc2Avail = tool === "codex" ? Boolean(env.codexAcc2) : Boolean(env.claudeAcc2);
  const primary = wantAcc2 && acc2Avail ? "acc2" : "acc1";
  const mode = settings[`${tool}Mode`] || "auto";
  const chain = [primary];
  if (mode === "auto" && env.connected) {
    const other = primary === "acc1" ? "acc2" : "acc1";
    const otherAvail = other === "acc1" ? true : acc2Avail; // acc1 is always usable
    if (otherAvail) chain.push(other);
  }
  return chain.map((acc) => `${tool}-${acc}`);
}

function deriveFromLegacy(settings, env = {}) {
  return {
    profiles: legacyProfiles(settings),
    roles: {
      a: { slot: "codex", label: "Codex", mode: settings.codexMode || "auto", profileIds: legacyChain("codex", settings, env), verify: { model: VERIFY_AGENTS.codexModel, effort: VERIFY_AGENTS.codexEffort } },
      b: { slot: "claude", label: "Claude Code", mode: settings.claudeMode || "auto", profileIds: legacyChain("claude", settings, env), verify: { model: VERIFY_AGENTS.claudeModel, effort: VERIFY_AGENTS.claudeEffort } },
    },
  };
}

function hasExplicitConfig(settings) {
  return Boolean(Array.isArray(settings && settings.profiles)
    && settings.roles && settings.roles.a && settings.roles.b);
}

// Resolve settings (explicit or legacy) into ready-to-run roles with profile
// objects already looked up. Returns { profilesById, roles: { a, b } } where each
// role = { slot, label, mode, verify, chain: [profileObj…] }.
function effectiveConfig(settings = {}, env = {}) {
  let profilesArr, roles;
  if (hasExplicitConfig(settings)) {
    profilesArr = settings.profiles;
    roles = settings.roles;
  } else {
    const d = deriveFromLegacy(settings, env);
    profilesArr = d.profiles;
    roles = d.roles;
  }
  const byId = {};
  for (const p of profilesArr) if (p && p.id) byId[p.id] = p;
  const resolveRole = (r, slot) => ({
    slot,
    label: (r && r.label) || (slot === "codex" ? "Codex" : "Claude Code"),
    mode: (r && r.mode) || "auto",
    verify: (r && r.verify) || null,
    chain: ((r && r.profileIds) || []).map((id) => byId[id]).filter(Boolean),
  });
  return { profilesById: byId, roles: { a: resolveRole(roles.a, "codex"), b: resolveRole(roles.b, "claude") } };
}

// --- CRUD helpers (operate on a settings object; used by the API endpoints) ---

function validateProfile(p) {
  if (!p || typeof p !== "object") return "profile must be an object";
  if (!p.id || !/^[A-Za-z0-9._-]+$/.test(p.id)) return "id required (alphanumeric . _ -)";
  if (!p.provider) return "provider required";
  if (isCliProvider(p.provider)) {
    if (p.account !== "acc1" && p.account !== "acc2") return "CLI profile needs account acc1|acc2";
  } else if (!p.model) {
    return "model required for network providers";
  }
  return null;
}

function upsertProfile(settings, profile) {
  const err = validateProfile(profile);
  if (err) throw new Error(err);
  if (!Array.isArray(settings.profiles)) settings.profiles = [];
  const i = settings.profiles.findIndex((p) => p.id === profile.id);
  if (i >= 0) settings.profiles[i] = { ...settings.profiles[i], ...profile };
  else settings.profiles.push(profile);
  return settings.profiles;
}

function removeProfile(settings, id) {
  if (!Array.isArray(settings.profiles)) return [];
  settings.profiles = settings.profiles.filter((p) => p.id !== id);
  // Drop the id from any role chain so roles never reference a deleted profile.
  for (const slot of ["a", "b"]) {
    const r = settings.roles && settings.roles[slot];
    if (r && Array.isArray(r.profileIds)) r.profileIds = r.profileIds.filter((x) => x !== id);
  }
  return settings.profiles;
}

function setRole(settings, slot, patch) {
  if (slot !== "a" && slot !== "b") throw new Error("role slot must be a|b");
  if (!settings.roles) settings.roles = {};
  const cur = settings.roles[slot] || { slot: slot === "a" ? "codex" : "claude" };
  settings.roles[slot] = { ...cur, ...patch, slot: slot === "a" ? "codex" : "claude" };
  return settings.roles[slot];
}

module.exports = {
  VERIFY_AGENTS,
  isCliProvider,
  cliTool,
  deriveFromLegacy,
  hasExplicitConfig,
  effectiveConfig,
  validateProfile,
  upsertProfile,
  removeProfile,
  setRole,
};
