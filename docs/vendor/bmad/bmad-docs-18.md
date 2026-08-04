---
name: bmad-docs-18
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 18/30 (raw.githubusercontent.com)"
type: reference
---

### Three-Layer Override Model

```text
Priority 1 (wins): _bmad/custom/{skill-name}.user.toml  (personal, gitignored)
Priority 2:        _bmad/custom/{skill-name}.toml        (team/org, committed)
Priority 3 (last): skill's own customize.toml                    (defaults)
```

The `_bmad/custom/` folder starts empty. Files only appear when someone actively customizes.

### Merge Rules (by shape, not by field name)

The resolver applies four structural rules. Field names are never special-cased — behavior is determined purely by the value's shape:

| Shape | Rule |
|---|---|
| Scalar (string, int, bool, float) | Override wins |
| Table | Deep merge (recursively apply these rules) |
| Array of tables where every item shares the **same** identifier field (every item has `code`, or every item has `id`) | Merge by that key — matching keys **replace in place**, new keys **append** |
| Any other array (scalars; tables with no identifier; arrays that mix `code` and `id` across items) | **Append** — base items first, then team items, then user items |

**No removal mechanism.** Overrides cannot delete base items. If you need to suppress a default menu item, override it by `code` with a no-op description or prompt. If you need to restructure an array more deeply, fork the skill.

**The `code` / `id` convention.** BMad uses `code` (short identifier like `"BP"` or `"R1"`) and `id` (longer stable identifier) as merge keys on arrays of tables. If you author a custom array-of-tables that should be replaceable-by-key rather than append-only, pick **one** convention (either `code` on every item, or `id` on every item) and stick with it across the whole array. Mixing `code` on some items and `id` on others falls back to append — the resolver won't guess which key to merge on.

### Some agent fields are read-only

`agent.name` and `agent.title` live in `customize.toml` as source-of-truth metadata, but the agent's SKILL.md doesn't read them at runtime — they're hardcoded identity. Putting `name = "Bob"` in an override file has no effect. If you genuinely need a different-named agent, copy the skill folder, rename it, and ship it as a custom skill.

## Steps

### 1. Find the Skill's Customization Surface

Look at the skill's `customize.toml` in its installed directory. For example, the PM agent:

```text
.claude/skills/bmad-agent-pm/customize.toml
```

(Path varies by IDE -- Cursor uses `.cursor/skills/`, Cline uses `.cline/skills/`, and so on.)

This file is the canonical schema. Every field you see is customizable (excluding the read-only identity fields noted above).

### 2. Create Your Override File

Create the `_bmad/custom/` directory in your project root if it doesn't exist. Then create a file named after the skill:

```text
_bmad/custom/
  bmad-agent-pm.toml        # team overrides (committed to git)
  bmad-agent-pm.user.toml   # personal preferences (gitignored)
```

:::caution[Do NOT copy the whole `customize.toml`]
Override files are **sparse**. Include only the fields you're changing — nothing else. Every field you omit is inherited automatically from the layer below (team from defaults, user from team-or-defaults).

Copying the full `customize.toml` into an override is actively harmful: the next update ships new defaults, but your override file locks in the old values. You'll silently drift out of sync with every release.
:::

**Example — changing the icon and adding one principle**:

```toml
# _bmad/custom/bmad-agent-pm.toml
# Just the fields I'm changing. Everything else inherits.

[agent]
icon = "🏥"
principles = [
  "Ship nothing that can't pass an FDA audit.",
]
```

This appends the new principle to the defaults (leaving the shipped principles intact) and replaces the icon. Every other field stays as shipped.

### 3. Customize What You Need

All examples below assume BMad's flat agent schema. Fields live directly under `[agent]` — no nested `metadata` or `persona` sub-tables.

**Scalars (icon, role, identity, communication_style).** Scalar overrides win. You only need to set the fields you're changing:

```toml
# _bmad/custom/bmad-agent-pm.toml

[agent]
icon = "🏥"
role = "Drives product discovery for a regulated healthcare domain."
communication_style = "Precise, regulatory-aware, asks compliance-shaped questions early."
```

**Persistent facts, principles, activation hooks (append arrays).** All four arrays below are append-only. Team items run after defaults, user items run last.

```toml
[agent]
# Static facts the agent keeps in mind the whole session — org rules, domain
# constants, user preferences. Distinct from the runtime memory sidecar.
#
# Each entry is either a literal sentence, or a `file:` reference whose
# contents are loaded as facts (glob patterns supported).
persistent_facts = [
  "Our org is AWS-only -- do not propose GCP or Azure.",
  "All PRDs require legal sign-off before engineering kickoff.",
  "Target users are clinicians, not patients -- frame examples accordingly.",
  "file:{project-root}/docs/compliance/hipaa-overview.md",
  "file:{project-root}/_bmad/custom/company-glossary.md",
]

# Adds to the agent's value system
principles = [
  "Ship nothing that can't pass an FDA audit.",
  "User value first, compliance always.",
]

# Runs BEFORE the standard activation (persona, persistent_facts, config, greet).
# Use for pre-flight loads, compliance checks, anything that needs to be in
# context before the agent introduces itself.
activation_steps_prepend = [
  "Scan {project-root}/docs/compliance/ and load any HIPAA-related documents as context.",
]

# Runs AFTER greet, BEFORE the menu. Use for context-heavy setup that should
# happen once the user has been acknowledged.
activation_steps_append = [
  "Read {project-root}/_bmad/custom/company-glossary.md if it exists.",
]
```

**The two hooks do different jobs.** Prepend runs before greeting so the agent can load context it needs to personalize the greeting itself. Append runs after greeting so the user isn't staring at a blank terminal while heavy scans complete.

**Menu customization (merge by `code`).** The menu is an array of tables. Each item has a `code` field (BMad convention), so the resolver merges by code: matching codes replace in place, new codes append.

TOML array-of-tables syntax uses `[[agent.menu]]` for each item:

```toml
# Replace the existing CE item with a custom skill
[[agent.menu]]
code = "CE"
description = "Create Epics using our delivery framework"
skill = "custom-create-epics"

# Add a new item (code RC doesn't exist in defaults)
[[agent.menu]]
code = "RC"
description = "Run compliance pre-check"
prompt = """
Read {project-root}/_bmad/custom/compliance-checklist.md
and scan all documents in {planning_artifacts} against it.
Report any gaps and cite the relevant regulatory section.
"""
```

Each menu item has exactly one of `skill` (invokes a registered skill) or `prompt` (executes the text directly). Items not listed in your override keep their defaults.

**Referencing files.** When a field's text needs to point at a file (in `persistent_facts`, `activation_steps_prepend`/`activation_steps_append`, or a menu item's `prompt`), use a full path rooted at `{project-root}`. Even if the file sits next to your override in `_bmad/custom/`, spell out the full path: `{project-root}/_bmad/custom/info.md`. The agent resolves `{project-root}` at runtime.
