---
name: superpowers-docs-19
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 19/33 (README.md)"
type: reference
---

### Step 4 — Write the tool mapping

Translate the action vocabulary into the harness's real tools. Cover every one
of these actions (omit only what genuinely doesn't apply):

- read a file
- create / edit / delete a file (one `apply_patch`-style tool, or separate
  write/edit?)
- run a shell command
- search file contents / find files by name (grep, glob)
- fetch a URL / web search
- **dispatch a subagent**, including how to pass the agent type — and any config
  flag needed to enable it
- **create / update todos** (treat older `TodoWrite` references as this action)
- **invoke a skill** — see Step 5

**Get the real tool names from the harness; never invent them.** If the docs
don't list them, the authoritative source is the harness itself: in a live
session, ask the model to "list the exact machine names of every tool you can
call, one per line" and use what it reports.

**How the harness finds the `skills/` directory is itself per-harness** — confirm
it, don't assume. Possibilities: a manifest `skills` path field (Codex's
`"skills": "./skills/"`); a *co-located* `skills/` the harness auto-scans (where a
path field is **ignored** — one real harness only scanned a `skills/` sitting next
to `plugin.json`); an API/registration call (OpenCode, pi); or you stage an
install dir that pairs the manifest with a **symlink to the repo's `skills/`** and
point the installer at the staging dir (verify the installer *dereferences* the
symlink and copies the real files — confirm with `agy plugin validate`/`install`
or the equivalent before relying on it). A `skills` path field is *not* portable.

Where the mapping lives depends on shape:

- **Shape A:** put it in `skills/using-superpowers/references/<harness>-tools.md`.
  The agent reaches it from the bootstrap — `SKILL.md`'s "Platform Adaptation"
  section links the per-harness references files. (Shape A harnesses have no
  instructions file; the mapping is *not* inlined into the hook output.)
- **Shape B:** the mapping is typically inlined into the bootstrap string you
  inject (see the `toolMapping` constant in `superpowers.js`). pi keeps it in
  *both* places — `piToolMapping()` inline **and** `references/pi-tools.md`. If
  you maintain it in two places, update both, or the port is half-done.
- **Shape C:** put it in `references/<harness>-tools.md` and pull it into the
  always-loaded instructions file (e.g. `GEMINI.md` `@`-includes
  `gemini-tools.md`).

You may also add a one-line pointer to your harness in `SKILL.md`'s "Platform
Adaptation" section so an agent reading the bootstrap knows where its mapping
lives. This is the one edit to a `SKILL.md` a port may make — and only because
that section is a pointer list, not behavior-shaping content. It does not violate
the "don't edit skill bodies" rule (Part 1); do not touch anything else in any
skill. (The list is a convenience pointer, not an exhaustive registry — not every
harness is listed.)

### Step 5 — Handle a harness with no native skill tool

`using-superpowers/SKILL.md` tells the model to *never read skill files manually
with file tools — always use your platform's skill-loading mechanism.* The point
is "don't bypass the mechanism," not "never use file-read." What counts as "your
platform's mechanism" depends on the harness — and for a harness with no skill
tool, the documented mechanism *is* reading `SKILL.md`. So reading it there
honors the rule rather than breaking it. Distinguish three cases:

1. **Native `Skill`-style tool** (Claude Code, Copilot CLI, Gemini's
   `activate_skill`): point the mapping at that tool.
2. **Native skill *discovery* but no `Skill` tool** (pi, Antigravity): the harness
   can find and list skills, but the model can't call a tool to load one. Get the
   skills installed where the harness scans (pi registers via `resources_discover`
   → `skillPaths`; OpenCode via its `config` hook; `agy plugin install` copies
   them in), and tell the model to load a skill by **reading its `SKILL.md` with
   the file-read tool when the skill applies** — the sanctioned mechanism here,
   the way `references/pi-tools.md` states it.

   **For the bootstrap itself, prefer a declared context file (Part 6).** If the
   harness has a `contextFileName`-style manifest field — as Antigravity does —
   ship a generated context file through the installer: it's guaranteed-loaded and
   carries both the `using-superpowers` content and the tool mapping. That is the
   strong, preferred path.

   **Fallback — the surfaced skill index.** If there's no context-file field but
   the harness surfaces each installed skill's name + description at session start,
   you need *neither* a built index nor a runtime-list instruction — the harness
   is the index, and `using-superpowers`'s own surfaced description can be what
   triggers the model to load it. This is softer than a declared context file;
   two things it does **not** give you, versus a context file / hook / in-process
   injector — account for both:
   - **It bootstraps *triggering*, not the *tool mapping*.** An injector prepends
     `<harness>-tools.md` alongside `using-superpowers` every session. Here nothing
     injects the mapping — the model only sees skill *descriptions* and must *read*
     your `references/<harness>-tools.md` when it needs tool names. It works
     because skills name actions (the model reads the mapping when it acts), but
     it's softer than injection. Make sure the mapping is reachable from what the
     model loads — e.g. linked from `SKILL.md`'s Platform Adaptation section and
     installed alongside the skills — not just sitting in the repo.
   - **There's no structural guarantee the trigger fires.** No `<EXTREMELY_IMPORTANT>`
     wrapper, no dedup, no re-injection after compaction — firing depends on the
     model choosing to act on a description it sees in the index. This is exactly
     why the acceptance test is mandatory here: it is the *only* guarantee, so run
     it on the model(s) your users will actually use, not just the strongest one.
3. **No skill system at all:** there is nothing to register, and the *only*
   mechanism is the model reading `SKILL.md` on demand. But the model can't read
   what it can't find: `using-superpowers/SKILL.md` does **not** enumerate the
   available skills, so on its own the model won't know which skills exist or
   their triggers. You must supply a discovery path. Two options, and they differ
   in durability: (a) generate a skill index (each `skills/*/SKILL.md`'s `name` +
   `description` frontmatter) and place it *inside* the `<EXTREMELY_IMPORTANT>`
   wrapper alongside the tool mapping (Shape B recipe above) so it's covered by
   the dedup guard — but a build-time index goes stale as skills are added; or
   (b) instruct the model to list `skills/*/SKILL.md` at runtime and read their
   frontmatter to find a match — slower but never stale. Prefer (b) unless you
   have a reason not to. Without either, a no-skill-system port loads the
   bootstrap but silently never triggers any other skill.

In cases 2 and 3, say plainly in your tool mapping that reading `SKILL.md` is the
blessed path, so the model doesn't think it's violating the "never read skill
files" rule. Don't go hunting for a `skillPaths`-style registration API in a
harness that has no skill system — case 3 has none.
