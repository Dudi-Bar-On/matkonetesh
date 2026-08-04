---
name: superpowers-docs-21
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 21/33 (README.md)"
type: reference
---

## Part 6 — Distribution and release

A working integration in this repo isn't usable until a real user can install
it. Distribution differs per harness ecosystem — find yours:

| Channel | Example | What you do |
|---|---|---|
| Native plugin marketplace | Claude Code | Register in `.claude-plugin/marketplace.json`; users `/plugin install`. The external `superpowers-marketplace` repo is the source of truth users install from — see the release steps in `CLAUDE.md`. |
| External marketplace fork, synced by script | Codex | `scripts/sync-to-codex-plugin.sh` rsyncs the tracked plugin files into a separate fork repo and opens a PR. Read its include/exclude list so you ship the right tree (it deliberately drops repo-internal dirs and other harnesses' dotdirs). |
| Git-URL extension install | Gemini, Kimi Code, OpenCode | Users install from a git URL (`gemini extensions install …`; Kimi Code `/plugins install …`; an `opencode.json` `plugin` array entry). Document the exact command. |
| Package-manifest fields | pi | Declared through fields in the repo-root `package.json`; users install via the harness's package command. |
| Local installer (plugin install) | Antigravity (`agy`) | A small `install.sh` that runs the harness's own `agy plugin install` against a staging dir holding the manifest, the skills, and a generated `contextFileName` context file (the bootstrap). Everything arrives through the install mechanism — *not* by editing the user's config (see below). |

Then:

- **A plugin installer may silently strip *undeclared* files — so make the
  bootstrap a file the installer *recognizes*, never a user-config edit.** A
  `plugin install` typically copies only the components it knows about
  (skills/agents/commands/mcp/hooks/context) and discards anything else, so a
  context file the manifest doesn't declare just vanishes from the install. The
  fix is **not** to give up and write into the user's config (**rule 2**) — it's
  to declare the bootstrap as a recognized component. In escalation order:
  - **Ship a context file the manifest declares.** If the harness has a
    `contextFileName`-style field (an extension-declared file it loads every
    session), that is the strongest clean bootstrap: declare it, and the installer
    preserves it *and* the harness loads it. Generate it at install time from the
    live `using-superpowers/SKILL.md` + the tool mapping (wrapped in
    `<EXTREMELY_IMPORTANT>`) so the installed bootstrap never drifts. This is what
    `.antigravity-plugin/install.sh` does — `agy plugin install` reports
    `✔ context : ANTIGRAVITY.md`, and a clean session reads `using-superpowers`'s
    SKILL.md, loads `brainstorming`, and enters the brainstorming flow before any
    code. **Verify with a marker** that the installer keeps the file and the
    harness loads it: one porter wrongly concluded it couldn't, because they
    shipped the file *without* declaring `contextFileName` and it was stripped as
    unrecognized.
  - **Otherwise lean on the installed `using-superpowers` skill itself.** If the
    harness surfaces each installed skill's name + description at session start,
    the `using-superpowers` description ("Use when starting any conversation…")
    can prompt the model to load it — installing the skill *is* the bootstrap.
    Softer (no guaranteed wrapper; it carries triggering but not the tool mapping
    — see Step 5), so prefer the declared context file when available.
  - If neither works, the harness cannot be cleanly supported yet — **say so**
    and raise it, rather than hand-editing the user's config.

- **Write install docs.** A `docs/README.<harness>.md` and/or a
  `.<harness>/INSTALL.md` (see `docs/README.opencode.md` and
  `.opencode/INSTALL.md`), plus an install section in the top-level `README.md`.
  The only supported install action is **running the harness's own install
  command** (`agy plugin install`, `gemini extensions install`, `/plugin
  install`, etc.). Hand-copying skill files and editing the user's global/personal
  config are *both* off-limits (rule 2 / the PR rules). If the harness has no
  install command at all — its only surface is a user-owned config file — then it
  fails the "deliver via install mechanism" rule, and you should raise that rather
  than ship an installer that edits the user's files.
- **Register the version.** If your harness introduces a *new* versioned
  manifest, add its path and version field to `.version-bump.json` so
  `scripts/bump-version.sh` keeps it in lockstep (read that file to see what's
  currently tracked). A new manifest that isn't registered there will ship a
  stale version. If your harness instead rides an already-tracked file — pi
  declares itself in the repo-root `package.json`, which is already listed —
  there's nothing new to add.
- **If no existing channel fits, you're standing up a new one.** None of the four
  rows may match your harness. If it needs a Codex-style external fork sync,
  `scripts/sync-to-codex-plugin.sh` is the template to clone (note its anchored
  include/exclude list and its PR automation). And whenever you add a new
  per-harness directory, add it to the *other* harnesses' sync excludes (e.g. the
  EXCLUDES list in `sync-to-codex-plugin.sh`) so your dotdir doesn't leak into
  their distributions.

---

## Part 7 — Cross-platform / Windows

Only relevant to the shell-hook shape. `hooks/run-hook.cmd` is a polyglot: a
single file that's valid as both a Windows batch script and a Unix shell script.
On Windows, `cmd.exe` runs the batch portion, which locates `bash` (Git for
Windows, then `bash` on PATH) and runs the named hook script; if no bash is
found it exits cleanly so the harness still works, just without injection. On
Unix, the leading `:` makes the batch block a no-op and the shell runs the
script directly.

Two rules this enforces, which you must respect:

- **Hook scripts are extensionless** (`session-start`, not `session-start.sh`).
  Claude Code's Windows handling prepends `bash` to any command containing
  `.sh`, which would double-invoke. Name your hook script without an extension.
- Don't write per-OS variants of the hook script. One extensionless bash script
  plus the polyglot wrapper covers all three platforms.

`hooks/run-hook.cmd` itself is the authoritative implementation — read it. See
`docs/windows/polyglot-hooks.md` for the background and rationale behind the
dispatcher pattern.

---

## Part 8 — Submitting the PR

- Target the **`dev`** branch. One harness per PR.
- Fill in the PR template's **"New harness support"** section and paste the
  complete acceptance-test transcript (the "Let's make a react todo list"
  session showing `brainstorming` auto-triggering). A PR without this proof will
  be closed.
- Superpowers is a zero-dependency plugin. Don't add a third-party runtime
  dependency. Adding a new harness is the one carve-out the contributor rules
  allow, and even then keep it to what the integration strictly requires —
  type-only imports that compile away are fine; runtime packages are not.
- Don't touch skill bodies (Part 1). If you found yourself editing a `SKILL.md`
  to make the port work, the fix belongs in your tool mapping instead.

---
