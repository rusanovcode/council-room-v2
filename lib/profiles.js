// Phase 5: profiles + roles data model.
//
// A *profile* is a named backend: { id, label, provider, model, effort, ... }.
//   - CLI providers (full build only): provider "cli-codex" | "cli-claude",
//     account "acc1" | "acc2" (the old multi-account is now just two profiles).
//   - Network providers: provider = a preset id (deepseek, ollama, …) or a raw
//     type ("openai-compatible" | "ollama") with baseUrl/credentialRef.
//
// A *participant* is one debate slot. The internal slot key is an opaque string:
// legacy/2-agent chats keep "codex" (slot A) and "claude" (slot B) for backward
// compatibility — questions.js, KB attribution, the transcript and the client
// terminals all key off whatever the slot key is. New N-agent chats use generic
// keys "a1".."a5". What's configurable per participant is the display label and
// the ordered chain of profiles (primary + failover).
//
// Settings may be, in priority order:
//   1. EXPLICIT PARTICIPANTS — settings.participants[] (the N-agent model, 2..5),
//   2. EXPLICIT ROLES        — settings.roles {a,b} (old Phase 5 two-slot UI),
//   3. LEGACY                — the old codexModel/codexAccount/… fields.
// effectiveConfig resolves any of them into the same { participants[] } shape, so
// old chats keep working untouched. It also exposes roles {a,b} = the first two
// participants, for the handful of back-compat callers/tests that still read it.

// How many debate agents a chat may have. Minimum 2 keeps the dialectic; the cap
// is a deliberate token-spend guard (each agent sees the full context of all the
// others — prompts are NOT compressed).
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 5;

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

function hasExplicitParticipants(settings) {
  // Participants may run from inline backends alone, so the registry
  // (settings.profiles) is NOT required here — only a participants array of >= 2.
  return Boolean(settings && Array.isArray(settings.participants)
    && settings.participants.length >= MIN_PARTICIPANTS);
}

function byIdMap(profilesArr) {
  const byId = {};
  for (const p of profilesArr || []) if (p && p.id) byId[p.id] = p;
  return byId;
}

// Build a synthetic profile object from a participant's inline backend. This is
// how the Phase 6b selection UI stores a chip's backend (provider/model/effort…)
// WITHOUT touching settings.profiles (the registry) — selection and registry stay
// fully decoupled. The id is derived from the slot so usage/logs stay stable.
function backendToProfile(slot, backend) {
  const p = {
    id: `__p_${slot}`,
    label: backend.label || "",
    provider: backend.provider,
    model: backend.model || "",
    effort: backend.effort || "auto",
  };
  if (backend.account) p.account = backend.account;
  if (backend.baseUrl) p.baseUrl = backend.baseUrl;
  if (backend.credentialRef) p.credentialRef = backend.credentialRef;
  return p;
}

// Resolve one stored participant/role into a ready-to-run shape:
// { slot, label, mode, verify, chain: [profileObj…] }. The chain comes from
// profileIds (registry references — used by legacy/Phase-5 and tests) OR, when
// there are none, from an inline backend (Phase 6b selection). `fallbackSlot`
// and `fallbackLabel` cover the legacy two-slot case (codex/claude).
function resolveSlot(r, byId, fallbackSlot, fallbackLabel) {
  const slot = (r && (r.key || r.slot)) || fallbackSlot;
  let chain = ((r && r.profileIds) || []).map((id) => byId[id]).filter(Boolean);
  if (!chain.length && r && r.backend && r.backend.provider) {
    chain = [backendToProfile(slot, r.backend)];
  }
  return {
    slot,
    label: (r && r.label) || fallbackLabel || fallbackSlot,
    mode: (r && r.mode) || "auto",
    verify: (r && r.verify) || null,
    chain,
  };
}

// Resolve settings (explicit participants, explicit roles, or legacy) into an
// ordered list of ready-to-run participants. Returns
//   { profilesById, participants: [ { slot, label, mode, verify, chain } … ] }
// plus roles { a, b } = the first two participants (back-compat convenience).
function effectiveConfig(settings = {}, env = {}) {
  let participants;
  let byId;
  if (hasExplicitParticipants(settings)) {
    byId = byIdMap(settings.profiles);
    participants = settings.participants
      .slice(0, MAX_PARTICIPANTS)
      .map((p, i) => resolveSlot(p, byId, `a${i + 1}`, `Agent ${i + 1}`));
  } else {
    let profilesArr, roles;
    if (hasExplicitConfig(settings)) {
      profilesArr = settings.profiles;
      roles = settings.roles;
    } else {
      const d = deriveFromLegacy(settings, env);
      profilesArr = d.profiles;
      roles = d.roles;
    }
    byId = byIdMap(profilesArr);
    participants = [
      resolveSlot(roles.a, byId, "codex", "Codex"),
      resolveSlot(roles.b, byId, "claude", "Claude Code"),
    ];
  }
  return {
    profilesById: byId,
    participants,
    roles: { a: participants[0], b: participants[1] || null },
  };
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
  // Same for the N-agent participant chains.
  if (Array.isArray(settings.participants)) {
    for (const p of settings.participants) {
      if (p && Array.isArray(p.profileIds)) p.profileIds = p.profileIds.filter((x) => x !== id);
    }
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

// --- Participants (N-agent model) -----------------------------------------

// Validate a participants array against a profiles array. Returns an error
// string or null. Each participant needs a unique key and a non-empty profile
// chain whose ids all exist. The count must be within [MIN, MAX].
function validateParticipants(participants, profilesArr) {
  if (!Array.isArray(participants)) return "participants must be an array";
  if (participants.length < MIN_PARTICIPANTS) return `at least ${MIN_PARTICIPANTS} participants required`;
  if (participants.length > MAX_PARTICIPANTS) return `at most ${MAX_PARTICIPANTS} participants allowed`;
  const ids = new Set((profilesArr || []).map((p) => p && p.id).filter(Boolean));
  const seenKeys = new Set();
  for (const p of participants) {
    if (!p || typeof p !== "object") return "participant must be an object";
    const key = p.key || p.slot;
    if (!key || !/^[A-Za-z0-9._-]+$/.test(key)) return "participant key required (alphanumeric . _ -)";
    if (seenKeys.has(key)) return `duplicate participant key "${key}"`;
    seenKeys.add(key);
    // A participant runs from EITHER a registry chain (profileIds) OR an inline
    // backend (Phase 6b selection). Exactly one is required.
    const hasChain = Array.isArray(p.profileIds) && p.profileIds.length;
    const hasBackend = p.backend && p.backend.provider;
    if (!hasChain && !hasBackend) return `participant "${key}" needs a backend or a profile`;
    if (hasChain) {
      for (const id of p.profileIds) if (!ids.has(id)) return `participant "${key}" references unknown profile "${id}"`;
    }
    if (hasBackend) {
      const e = validateProfile({ id: "x", ...p.backend });
      if (e) return `participant "${key}" backend: ${e}`;
    }
  }
  return null;
}

// Replace the participants list (validated against settings.profiles). Each entry
// is normalized to { key, label, mode, profileIds, verify? }.
function setParticipants(settings, participants) {
  const err = validateParticipants(participants, settings.profiles);
  if (err) throw new Error(err);
  settings.participants = participants.map((p, i) => ({
    key: p.key || p.slot || `a${i + 1}`,
    label: p.label || `Agent ${i + 1}`,
    mode: p.mode === "manual" ? "manual" : "auto",
    ...(Array.isArray(p.profileIds) && p.profileIds.length ? { profileIds: [...p.profileIds] } : {}),
    ...(p.backend && p.backend.provider ? { backend: { ...p.backend } } : {}),
    ...(p.verify ? { verify: p.verify } : {}),
  }));
  return settings.participants;
}

module.exports = {
  VERIFY_AGENTS,
  MIN_PARTICIPANTS,
  MAX_PARTICIPANTS,
  isCliProvider,
  cliTool,
  deriveFromLegacy,
  hasExplicitConfig,
  hasExplicitParticipants,
  effectiveConfig,
  validateProfile,
  upsertProfile,
  removeProfile,
  setRole,
  validateParticipants,
  setParticipants,
};
