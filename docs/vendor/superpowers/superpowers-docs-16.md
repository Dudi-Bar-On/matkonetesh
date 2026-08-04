---
name: superpowers-docs-16
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 16/33 (README.md)"
type: reference
---

### How to tell which shape you have

Before routing, learn the harness's *actual* mechanism — and don't assume it's
well documented or that it behaves like whatever harness it forked from.

**Find the surface:**

- **Search the web for the harness's docs** (extension / plugin / hook / skill /
  MCP / "context file" / "rules file"). Vendor tools change fast; search rather
  than trust training knowledge.
- **Find and read an existing third-party extension/plugin for the harness.** A
  real working example beats docs — it shows the manifest shape, the install
  command, and which components the harness actually loads.
- Check what the harness loads at startup: a settings file? an extensions
  directory? a per-project or global instructions file (`AGENTS.md`, `<NAME>.md`)?

**If it's underdocumented, reverse-engineer it empirically** (a real porter has
had to do every one of these):

- `strings` the binary / grep the install tree for hook event names, config
  paths, and the instructions file it reads.
- **Ask the running model to enumerate its own tool names** — e.g. "list the
  exact machine names of every tool you can call." This is the authoritative way
  to get tool names without inventing them (see Step 4).
- Prove every assumption with a **unique-marker test**: inject a nonsense token
  through the mechanism you think works, start a fresh session, and confirm the
  token actually reached the model.

**A fork does not inherit its parent's behavior.** A harness derived from another
(e.g. a Gemini-derived CLI) may expose the parent's manifest fields and
`@`-include syntax and *still not honor them the same way*. Verify with a marker;
never assume the parent's recipe transfers.

Then route to a shape:

- Shell command at session start whose stdout is read → **Shape A**.
- Plugin/extension module with lifecycle callbacks you run code in → **Shape B**.
- Only ever an always-on instructions file, no hook and no code plugin →
  **Shape C**.

**Shapes compose — they are not mutually exclusive.** The *skill-discovery*
mechanism and the *bootstrap* mechanism need not be the same shape — but **both
must still ride the install mechanism** (rule 2). Decide the two questions
separately: *where do skills get discovered?* and *how does the bootstrap reach
the model every session?* A harness might install skills via a plugin yet need
the bootstrap delivered another install-shipped way (an extension-declared
context file, or — see below — by the harness surfacing the installed
`using-superpowers` skill's own description at session start). If more than one
install-mechanism surface injects automatically, prefer the most reliable. What
you may **not** do is bridge a gap by editing the user's global config.

### Shape A — Shell-hook

The harness has a hook system that runs a shell command at session start and
reads JSON from its stdout. The configured command runs `run-hook.cmd`, a
polyglot wrapper that just locates bash and dispatches the named script; the
script (`hooks/session-start`, or a harness-specific variant) is what reads
`using-superpowers/SKILL.md` and prints a JSON object whose **field name and
nesting differ per harness**.

- Reference: `hooks/session-start`, `hooks/run-hook.cmd`, and the per-harness
  hook config `hooks/hooks.json` (Claude Code) and `hooks/hooks-cursor.json`
  (Cursor).
- Manifests: `.cursor-plugin/plugin.json` is the Shape A manifest example that
  points the harness at `./skills/` and the right `hooks-*.json`. Claude Code's
  `.claude-plugin/plugin.json` sets neither field — it auto-discovers `skills/`
  and `hooks/hooks.json` by convention. Do **not** copy Codex's
  `.codex-plugin/plugin.json` for Shape A: it declares an empty `hooks` object
  specifically to suppress Codex's `hooks/hooks.json` auto-discovery, because
  Codex surfaces skills natively and runs no session-start hook.

> **A hook *system* is not a session-start *event*.** A harness can have a
> `hooks.json` mechanism — and even contain the literal string `SessionStart` in
> its binary — while having no hook event that fires at session start and can
> inject context. (One real harness only exposed pre/post-tool and stop events;
> the `SessionStart` strings were telemetry.) Confirm the *specific event* you
> need exists and can write to the model's context before committing to Shape A.
> If it can't, the bootstrap belongs in an instructions file (Shape C) instead.

### Shape B — In-process plugin / extension

The harness loads a JS/TS module that exposes lifecycle callbacks. You register
the skills directory through the harness's API and inject the bootstrap by
mutating the message array in code.

- Reference: `.opencode/plugins/superpowers.js` (JavaScript) and
  `.pi/extensions/superpowers.ts` (TypeScript). pi is the closest reference for
  any harness that has **no native skill tool**.

### Shape C — Instructions-file

The harness has neither a shell hook nor a code plugin — its session-start
surface is a context file that *your installed extension ships and the manifest
declares* (e.g. Gemini's `contextFileName` → the extension's own `GEMINI.md`).
You can't run code or mutate messages; the extension's context file points at the
bootstrap. There is no injector to assemble a string or strip frontmatter — the
harness loads the referenced content as-is. **This works only because the file is
part of the installed extension** — never substitute "edit the user's global
`GEMINI.md`/`AGENTS.md`" for shipping your own (rule 2).

- Reference: `gemini-extension.json` (manifest, with `contextFileName`),
  `GEMINI.md` (two `@`-includes — the bootstrap skill and the tool-mapping
  reference), `skills/using-superpowers/references/gemini-tools.md`.
- Note: `@`-include is a Gemini feature. If your harness loads an instructions
  file but has no include syntax, you must inline the bootstrap content into the
  file instead.
- **Don't trust that an `@`-include is actually expanded — prove it.** A
  Gemini-*derived* harness can accept `@./path` syntax yet treat it as a *hint
  the model may choose to read* (it emits a file-read tool call) rather than a
  guaranteed inline expansion. That's the difference between the bootstrap being
  reliably present every session and the model maybe-reading it. Run a
  unique-marker test: if the marker isn't in context *without* a tool call,
  **inline the content** rather than `@`-include it.

### Routing table

| If the harness… | Use shape | Copy from |
|---|---|---|
| runs a shell command at session start and reads its stdout | A (shell-hook) | Cursor (`hooks/session-start` + `hooks/hooks-cursor.json` + `.cursor-plugin/`) |
| is a JS/TS plugin host with session/message lifecycle callbacks | B (in-process) | OpenCode (`.opencode/`) — or pi (`.pi/`) if it has no native skill tool |
| ships an extension-declared context file it always loads | C (instructions-file) | Gemini (`gemini-extension.json` + `GEMINI.md` + `references/gemini-tools.md`) |
| has a plugin install command and a manifest `contextFileName` (or equivalent) the installer keeps | C via the plugin installer | Antigravity (`.antigravity-plugin/` — `agy plugin install` ships a generated context file; verify the installer preserves it — Part 6) |

Most real harnesses fit one row cleanly; the last is the hybrid case (rule 2 still
holds — the bootstrap rides the install mechanism, never a user-config edit).

---

## Part 5 — The porting procedure
