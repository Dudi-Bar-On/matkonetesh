---
name: superpowers-docs-18
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 18/33 (README.md)"
type: reference
---

### Step 3 — Wire the bootstrap injection

This is the heart of the port. The shared goal: at session start, get the
`using-superpowers` skill content (wrapped in `<EXTREMELY_IMPORTANT>` tags) plus
the harness's tool mapping in front of the model, with a note that the skill is
already active so the model doesn't try to load it again. *How* you do that —
and what you assemble vs. what the harness loads raw — depends entirely on your
shape. Do **not** apply one shape's recipe to another.

**Shape A — a script reads `SKILL.md` and prints the harness's JSON.** The
dispatched script (`hooks/session-start`) `cat`s the whole `SKILL.md` (frontmatter
included — that's fine; it's emitted verbatim), wraps it with the "You have
superpowers… for all other skills use the Skill tool" preamble, escapes it, and
prints the harness's JSON shape. The tool mapping for Shape A does **not** go
inline here — it lives in `references/<harness>-tools.md` (Step 4). Get the JSON
output shape exactly right. `hooks/session-start`
detects the harness from environment variables and prints *one of three* shapes:

- Cursor (`CURSOR_PLUGIN_ROOT` set): `{ "additional_context": "…" }`
- Claude Code (`CLAUDE_PLUGIN_ROOT` set, `COPILOT_CLI` unset):
  `{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "…" } }`
- Copilot CLI / SDK standard (else): `{ "additionalContext": "…" }`

This is a trap. Emitting the wrong field, or an extra one, means the bootstrap
either never injects or injects twice (Claude Code reads both
`additional_context` and `hookSpecificOutput` without de-duplicating, so emitting
both double-injects). Find the
exact field, nesting, and event-matcher values your harness expects. Then
decide: add a fourth branch to `hooks/session-start`, or — if the harness needs
a different bootstrap message or env contract — add a dedicated
`hooks/session-start-<harness>` script. If you add a branch
and your harness *also* sets an env var an earlier branch keys on (some harnesses
set `CLAUDE_PLUGIN_ROOT` too), order your branch before the one that would
otherwise shadow it. Match the harness's
own event-matcher strings (Claude Code uses `startup|clear|compact`, Cursor
`sessionStart`); wrong matchers mean the hook silently never fires.

The **hook-config schema itself varies per harness** — don't assume the
Claude Code shape is universal. Compare `hooks/hooks.json` and
`hooks/hooks-cursor.json`: Cursor's uses
`"version": 1`, a lowercase `sessionStart` key, a relative
`./hooks/run-hook.cmd` command, and omits the `matcher`/`type`/`async` fields
Claude Code uses. Match your `hooks-<harness>.json` to whichever existing file is
closest, not to a single canonical template.

The hook **command string references a harness-provided plugin-root variable**,
and its name differs per harness: `hooks.json` uses `${CLAUDE_PLUGIN_ROOT}`,
`hooks-cursor.json` uses a relative path. Use
whatever your harness exports. (The `session-start` script re-derives the root
itself via `dirname`, so the script body doesn't depend on this — but the
command in the manifest does.)

**Discovering the harness's contract.** The three facts above — env var, JSON
field/nesting, matcher strings — are the harness's contract, not Superpowers',
so you have to source them. Read the harness's hook docs, or find out
empirically: register a throwaway session-start hook that dumps its environment
and emits a marker, then observe which env var identifies the harness and
whether/how the harness ingests your stdout. Pin these down before writing the
real branch.

**Shape B — assemble the string in code, then inject as a user message.** Here
you build the bootstrap yourself: read `SKILL.md`, strip its YAML frontmatter,
and assemble `<EXTREMELY_IMPORTANT>` + a short preamble that the skill is already
loaded and must not be re-invoked + the stripped body + the inline tool mapping +
`</EXTREMELY_IMPORTANT>`. One subtlety the references disagree on: OpenCode's
preamble says "do NOT use the skill tool…" (assumes a `skill` tool exists), while
pi's just says "do not try to load using-superpowers again." If your harness has
no skill tool, use pi's wording, not OpenCode's.

Inject the result as a **user-role message, not a system message** — system
messages bloat tokens when repeated every turn (#750) and multiple system
messages break some models (#894). Three things you must replicate:

- **Dedup guard.** The lifecycle callback can fire repeatedly (OpenCode's
  transform runs on *every* agent step; pi's `context` fires per turn). Before
  injecting, check whether a bootstrap marker is already present and skip if so.
  (The references pick different markers — pi a custom string, OpenCode the
  `EXTREMELY_IMPORTANT` tag; matching the tag is more robust since it needs no
  harness-specific constant.) Cache the bootstrap content at module level so
  you're not re-reading and re-parsing `SKILL.md` on every call (#1202).
- **Compaction.** If the harness compacts/summarizes history, re-inject
  afterward. pi sets an `injectBootstrap` flag on `session_start` and
  `session_compact`, clears it on `agent_end`, and inserts the message *after*
  any leading compaction-summary messages. OpenCode relies on its per-step
  re-injection plus the dedup guard.
- **Message-object shape is per-harness — discover yours, don't copy a literal.**
  The two references use *incompatible* shapes: pi builds
  `{ role, content: [{ type, text }], timestamp }`; OpenCode manipulates
  `message.info.role` and `message.parts[]`. Find your harness's message shape
  from its API; copying a reference's object literal verbatim will fail silently.

**Shape C — point your extension's context file at the bootstrap; assemble
nothing.** There is no injector, so you do *not* strip frontmatter or build a
wrapped string. The context file your extension ships (declared by the manifest —
*not* the user's own global file) pulls in two things: the `using-superpowers`
skill and the harness's tool-mapping reference. `GEMINI.md`
does this with two `@`-includes (`@./skills/using-superpowers/SKILL.md` and
`@./skills/using-superpowers/references/<harness>-tools.md`); the harness loads
them raw, frontmatter and all, and `SKILL.md` already carries its own
`<EXTREMELY-IMPORTANT>` block internally. If your harness has no include syntax,
inline the content into the instructions file instead. Gemini ships **no**
"already loaded, don't re-invoke" preamble — for an `@`-include harness the
content is the active instruction set, not a skill the model would re-load. If
you find your harness does try to re-invoke, add that note as a literal line in
the instructions file (you have no code to add it any other way).
