---
name: superpowers-docs-17
description: "superpowers (skills library: TDD/brainstorm/SDD) — vendor doc 17/33 (README.md)"
type: reference
---

### Step 1 — Study the closest reference implementation

Open the files named in Part 4 for your shape and read them end to end. The
patterns below are summaries; the code is the spec.

### Step 2 — Create the manifest / entry point

Create whatever the harness uses to recognize the plugin. Match the existing
ones in spirit:

- **Shape A:** a `*-plugin/plugin.json` (see `.cursor-plugin/plugin.json`) with
  `name`, `version`, `description`, author/license/keywords, `"skills":
  "./skills/"`, and `"hooks": "./hooks/hooks-<harness>.json"`. Plus the
  `hooks-<harness>.json` itself, registering a session-start hook whose command
  invokes `run-hook.cmd`.
- **Shape B:** the module the harness loads (e.g. `.<harness>/plugins/*.js`) plus
  whatever package metadata it needs to be discovered. The committed package
  metadata is the **repo-root `package.json`**: `main` points at the OpenCode
  plugin, the `pi` field (`pi.extensions`, `pi.skills`) plus the `pi-package`
  keyword declare the pi extension. Per-harness local manifests and lockfiles are
  kept out of git — `.opencode/.gitignore` excludes `node_modules`,
  `package.json`, and lockfiles. Do the same for your harness's *local* install
  artifacts so they don't pollute the repo — but never gitignore the repo-root
  `package.json`, which is the tracked source of truth.
  - **Build/dependency check.** Decide how the harness loads your module:
    does it run the source directly (pi's `.ts` is referenced as-is from
    `package.json`; OpenCode ships plain `.js`), or does it need a transpile/build
    step? Superpowers is zero-runtime-dependency. pi's `import type
    { ExtensionAPI }` works specifically because the harness runs the `.ts`
    directly, supplies that type at load, and the repo never type-checks the file
    in CI — the import isn't even declared as a dependency. If *your* harness
    actually type-checks or bundles the plugin, that breaks: an undeclared type
    import fails, and the PR rules only carve out *runtime* deps for new
    harnesses, not dev/type packages. If you hit this, confirm the approach with
    the maintainer rather than quietly adding a dependency. Keep any build output
    out of git and document the command.
- **Shape C (instructions-file):** a small manifest (see `gemini-extension.json`:
  `name`, `description`, `version`, `contextFileName`) plus the context file
  itself (`GEMINI.md` is just two `@`-includes: the bootstrap skill and the
  tool-mapping reference). The Gemini manifest has no `skills` field — Gemini
  auto-discovers the `skills/` directory bundled in the installed extension. If
  your harness has a native skill tool but no manifest field to register the
  directory, you must find its discovery convention (read its extension docs),
  then verify empirically: after wiring, ask the model to list its available
  skills — if the bundled skills don't appear, discovery isn't working yet.
