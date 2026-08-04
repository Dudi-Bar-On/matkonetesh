---
name: bmad-docs-19
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 19/30 (raw.githubusercontent.com)"
type: reference
---

### 4. Personal vs Team

**Team file** (`bmad-agent-pm.toml`): Committed to git. Shared across the org. Use for compliance rules, company persona, custom capabilities.

**Personal file** (`bmad-agent-pm.user.toml`): Gitignored automatically. Use for tone adjustments, personal workflow preferences, and private facts the agent should keep in mind.

```toml
# _bmad/custom/bmad-agent-pm.user.toml

[agent]
persistent_facts = [
  "Always include a rough complexity estimate (low/medium/high) when presenting options.",
]
```

## How Resolution Works

On activation, the agent's SKILL.md runs a shared Python script that does the three-layer merge and returns the resolved block as JSON. The script uses only the Python standard library's `tomllib` module (no external dependencies). BMad is standardizing on `uv run` to invoke these scripts (uv provisions a suitable Python for you); a plain `python3` still works during the transition:

```bash
uv run {project-root}/_bmad/scripts/resolve_customization.py \
  --skill {skill-root} \
  --key agent
```

**Requirements**: Python 3.11+ (earlier versions don't include `tomllib`); nothing to `pip install`. Running via `uv run` is the going-forward standard — uv resolves a suitable interpreter for you. If you run it with `python3` directly during the transition, check your version with `python3 --version`: some platforms (macOS without Homebrew, Ubuntu 22.04) default `python3` to 3.10 or earlier, so you may need to install 3.11+ separately.

`--skill` points at the skill's installed directory (where `customize.toml` lives). The skill name is derived from the directory's basename, and the script looks up `_bmad/custom/{skill-name}.toml` and `{skill-name}.user.toml` automatically.

Useful invocations:

```bash
# Resolve the full agent block
uv run {project-root}/_bmad/scripts/resolve_customization.py \
  --skill /abs/path/to/bmad-agent-pm \
  --key agent

# Resolve a single field
uv run {project-root}/_bmad/scripts/resolve_customization.py \
  --skill /abs/path/to/bmad-agent-pm \
  --key agent.icon

# Full dump
uv run {project-root}/_bmad/scripts/resolve_customization.py \
  --skill /abs/path/to/bmad-agent-pm
```

Output is always JSON. If the script is unavailable on a given platform, the SKILL.md tells the agent to read the three TOML files directly and apply the same merge rules.

## Workflow Customization

Workflows (skills that drive multi-step processes like `bmad-product-brief`) share the same override mechanism as agents. Their customizable surface lives under `[workflow]` instead of `[agent]`:

```toml
# _bmad/custom/bmad-product-brief.toml

[workflow]
# Same prepend/append semantics as agents — runs before and after the workflow's
# own activation steps. Overrides append to defaults.
activation_steps_prepend = [
  "Load {project-root}/docs/product/north-star-principles.md as context.",
]

activation_steps_append = []

# Same literal-or-file: semantics as the agent variant. Loaded as foundational
# context for the duration of the workflow run.
persistent_facts = [
  "All briefs must include an explicit regulatory-risk section.",
  "file:{project-root}/docs/compliance/product-brief-checklist.md",
]

# Scalar: runs once the workflow finishes its main output. Override wins.
on_complete = "Summarize the brief in three bullets and offer to email it via the gws-gmail-send skill."
```

The same field conventions cross the agent/workflow boundary: `activation_steps_prepend`/`activation_steps_append`, `persistent_facts` (with `file:` refs), and menu-style `[[…]]` tables with `code`/`id` for keyed merge. The resolver applies the same four structural rules regardless of the top-level key. SKILL.md references follow the namespace: `{workflow.activation_steps_prepend}`, `{workflow.persistent_facts}`, `{workflow.on_complete}`. Any additional fields a workflow exposes (output paths, toggles, review settings, stage flags) follow the same shape-based merge rules. Read the workflow's `customize.toml` to see what's customizable.

### Activation Order

Customizable workflows run their activation in a fixed sequence so you know exactly when your hooks fire:

1. Resolve the `[workflow]` block (base → team → user merge)
2. Execute `activation_steps_prepend` in order
3. Load `persistent_facts` as foundational context for the run
4. Load config (`_bmad/bmm/config.yaml`) and resolve standard variables (project name, languages, paths, date)
5. Greet the user
6. Execute `activation_steps_append` in order

After step 6 the workflow body begins. Use `activation_steps_prepend` when you need context loaded before the greeting can be personalized; use `activation_steps_append` when the setup is heavy and you'd rather the user sees the greeting first.

### Scope of This Initial Pass

Customization is rolling out incrementally. The fields documented above — `activation_steps_prepend`, `activation_steps_append`, `persistent_facts`, `on_complete` — are the **baseline surface** that every customizable workflow exposes, and they will remain stable across versions. They give you broad-stroke control today: inject pre/post steps, pin foundational context, trigger follow-up actions.

Over time, individual workflows will expose **more targeted customization points** tailored to what that workflow actually does — things like step-specific toggles, stage flags, output template paths, or review gates. When those arrive, they stack on top of the baseline fields rather than replacing them, so customizations you author today keep working.

If you need a fine-grained knob that isn't exposed yet, either use `activation_steps_*` and `persistent_facts` to steer behavior, or open an issue describing the specific customization point you want — those requests are what drive which targeted fields get added next.

## Central Configuration

Per-skill `customize.toml` covers **deep behavior** (hooks, menus, persistent_facts, persona overrides for a single agent or workflow). A separate surface covers **cross-cutting state** — install answers and the agent roster that external skills like `bmad-party-mode`, `bmad-retrospective`, and `bmad-advanced-elicitation` consume. That surface lives in four TOML files at project root:

```text
_bmad/config.toml               (installer-owned)  team scope:   install answers + agent roster
_bmad/config.user.toml          (installer-owned)  user scope:   user_name, language, skill level
_bmad/custom/config.toml        (human-authored)   team overrides (committed to git)
_bmad/custom/config.user.toml   (human-authored)   personal overrides (gitignored)
```

### Four-Layer Merge

```text
Priority 1 (wins): _bmad/custom/config.user.toml
Priority 2:        _bmad/custom/config.toml
Priority 3:        _bmad/config.user.toml
Priority 4 (base): _bmad/config.toml
```

Same structural rules as per-skill customize (scalars override, tables deep-merge, `code`/`id`-keyed arrays merge by key, other arrays append).

### What Lives Where

The installer partitions answers by the `scope:` declared on each prompt in `module.yaml`:

- `[core]` and `[modules.<code>]` sections — install answers. Scope `team` lands in `_bmad/config.toml`; scope `user` lands in `_bmad/config.user.toml`.
- `[agents.<code>]` — agent essence (code, name, title, icon, description, team) distilled from each module's `module.yaml` `agents:` block. Always team-scoped.
