# Custom discussion profiles

Each `*.md` file in this folder defines one **discussion profile** — the system
prompt and Knowledge-Base sections that tell Council Room *how* to think for a
given domain (software, research, legal, etc.). Built-in profiles
(`code`, `general`, `research`, `creative`, `free`) live in `lib/domains.js`; files here
are loaded **in addition** to them at server startup.

`README.md` itself is ignored by the loader.

## File format

A `---` frontmatter block (metadata) followed by a body (the prompt):

```md
---
id: legal
label_en: Legal
label_ru: Юридический
scan: false
scope: false
section: thesis | Thesis | The legal question under analysis
section: evidence | Evidence | Statutes, cases and facts
section: precedents | Precedents | Relevant prior rulings
section: open_questions | Open Questions
---
You are a participant in Council Room — a closed room of 2 to 5 AI agents.
Room goal: drive every open subtask to a closed state through structured debate.

Rules (fixed, no need to repeat):
- This is a legal analysis: argue from statutes and precedent, not opinion.
- Answer about THE ONE active subtask only.
- Ground every claim in the Knowledge Base or attached documents; if a source
  is missing, ask via `QUESTION:`.
- Each answer <= 12 sentences.
```

### Frontmatter keys

| Key | Meaning | Default |
|---|---|---|
| `id` | unique profile id, `^[a-z][a-z0-9_]*$`; also the filename | filename |
| `label_en` | name shown in the UI selector (English) | `id` |
| `label_ru` | name shown in the UI selector (Russian) | `label_en` |
| `scan` | apply the NO-FILESYSTEM-SCAN guard when filesystem access is off | `false` |
| `scope` | apply the STRICT-SCOPE guard | `false` |
| `section` | one KB section: `key \| Title \| tip (optional)`; repeat per section | — |

### Body = the prompt (`systemLines`)

The body is the profile's framing/rules. **Do not** include the answer tail
(`New facts / New risks / New alternatives / Status / KB-patch`) or the
open-questions protocol — those are shared across all profiles and appended
automatically. Blank lines inside the body are preserved.

## Rules and constraints

- **`open_questions` is mandatory.** If you omit it, it is added automatically.
- **Section keys must match `^[a-z_]+$`** (lowercase letters/underscores only) —
  the KB-patch parser only accepts those.
- A profile id must be unique. A file whose id collides with a built-in or
  another file is skipped (a warning is logged).
- The body must not contain a line that is exactly `---`.

## Creating profiles

You can either drop a file here by hand (then restart the server, port 8788), or
use the **"+ New profile"** builder in the UI, which writes the file for you and
reloads the registry without a restart. Either way the new profile appears in the
chat **Mode** selector automatically.
