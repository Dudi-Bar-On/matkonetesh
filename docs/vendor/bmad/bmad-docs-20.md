---
name: bmad-docs-20
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 20/30 (raw.githubusercontent.com)"
type: reference
---

### Editing Rules

- `_bmad/config.toml` and `_bmad/config.user.toml` are **regenerated every install** from the answers collected during the installer flow. Treat them as read-only outputs — direct edits will be overwritten on the next install. To change an install answer durably, re-run the installer (it remembers your prior answers as defaults) or shadow the value in `_bmad/custom/config.toml`.
- `_bmad/custom/config.toml` and `_bmad/custom/config.user.toml` are **never touched** by the installer. This is the correct surface for custom agents, agent descriptor overrides, team-enforced settings, and any value you want to pin regardless of install answers.

### Example — Rebrand an Agent

```toml
# _bmad/custom/config.toml (committed to git, applies to every developer)

[agents.bmad-agent-pm]
description = "Healthcare PM — regulatory-aware, stakeholder-driven, FDA-shaped questions first."
icon = "🏥"
```

The resolver merges over the installer-written `[agents.bmad-agent-pm]`. `bmad-party-mode` and any other roster consumer pick up the new description automatically.

### Example — Add a Fictional Agent

```toml
# _bmad/custom/config.user.toml (personal, gitignored)

[agents.kirk]
team = "startrek"
name = "Captain James T. Kirk"
title = "Starship Captain"
icon = "🖖"
description = "Bold, rule-bending commander. Speaks in dramatic pauses. Thinks aloud about the weight of command."
```

No skill folder required — the essence alone is enough for party-mode to spawn Kirk as a voice. Filter by the `team` field to invite just the Enterprise crew to a roundtable.

### Example — Override Module Install Settings

```toml
# _bmad/custom/config.toml

[modules.bmm]
planning_artifacts = "/shared/org-planning-artifacts"
```

The override wins over whatever each developer answered during their local install. Useful for pinning team conventions.

### When to Use Which Surface

| Need | Use |
|---|---|
| Add MCP tool calls to every dev workflow | Per-skill: `_bmad/custom/bmad-agent-dev.toml` `persistent_facts` |
| Add a menu item to an agent | Per-skill: `_bmad/custom/bmad-agent-{role}.toml` `[[agent.menu]]` |
| Swap a workflow's output template | Per-skill: `_bmad/custom/{workflow}.toml` scalar override |
| Rebrand an agent's public descriptor | **Central**: `_bmad/custom/config.toml` `[agents.<code>]` |
| Add a custom or fictional agent to the roster | **Central**: `_bmad/custom/config.*.toml` new `[agents.<code>]` entry |
| Pin team-enforced install settings | **Central**: `_bmad/custom/config.toml` `[modules.<code>]` or `[core]` |

Use both surfaces in the same project as needed.

## Worked Examples

For enterprise-oriented recipes (shaping an agent across every workflow it dispatches, enforcing org conventions, publishing outputs to Confluence and Jira, customizing the agent roster, and swapping in your own output templates), see [How to Expand BMad for Your Organization](./expand-bmad-for-your-org.md).

## Troubleshooting

**Customization not appearing?**

- Verify your file is in `_bmad/custom/` with the correct skill name
- Check TOML syntax: strings must be quoted, table headers use `[section]`, array-of-tables use `[[section]]`, and any scalar or array keys for a table must appear *before* any of that table's `[[subtables]]` in the file
- For agents, customization lives under `[agent]` -- fields written below that header belong to `agent` until another table header begins
- Remember `agent.name` and `agent.title` are read-only; overrides there have no effect

**Updates broke my customization?**

- Did you copy the full `customize.toml` into your override file? **Don't.** Override files should contain only the fields you're changing. A full copy locks in old defaults and silently drifts every release. Trim your override back to just the deltas.

**Need to see what's customizable?**

- Run the `bmad-customize` skill — it enumerates every customizable skill installed in your project, shows which ones already have overrides, and walks you through adding or updating one
- Or read the skill's `customize.toml` directly — every field there is customizable (except `name` and `title`)

**Need to reset?**

- Delete your override file from `_bmad/custom/` -- the skill falls back to its built-in defaults


<!-- source: docs/how-to/established-projects.md -->

---
title: 'Established Projects'
description: How to use BMad Method on existing codebases
sidebar:
  order: 7
---

Use BMad Method effectively when working on existing projects and legacy codebases.

This guide covers the essential workflow for onboarding to existing projects with BMad Method.

:::note[Prerequisites]

- BMad Method installed (`npx bmad-method install`)
- An existing codebase you want to work on
- Access to an AI-powered IDE (Claude Code or Cursor)
  :::

## Step 1: Clean Up Completed Planning Artifacts

If you have completed all PRD epics and stories through the BMad process, clean up those files. Archive them, delete them, or rely on version history if needed. Do not keep these files in:

- `docs/`
- `_bmad-output/planning-artifacts/`
- `_bmad-output/implementation-artifacts/`

## Step 2: Create Project Context

:::tip[Recommended for Existing Projects]
Generate `project-context.md` to capture your existing codebase patterns and conventions. This ensures AI agents follow your established practices when implementing changes.
:::

Run the generate project context workflow:

```bash
bmad-generate-project-context
```

This scans your codebase to identify:

- Technology stack and versions
- Code organization patterns
- Naming conventions
- Testing approaches
- Framework-specific patterns

You can review and refine the generated file, or create it manually at `_bmad-output/project-context.md` if you prefer.

[Learn more about project context](../explanation/project-context.md)

## Step 3: Maintain Quality Project Documentation

Your `docs/` folder should contain succinct, well-organized documentation that accurately represents your project:

- Intent and business rationale
- Business rules
- Architecture
- Any other relevant project information

For complex projects, consider using the `bmad-document-project` workflow. It offers runtime variants that will scan your entire project and document its actual current state.

## Step 3: Get Help

### BMad-Help: Your Starting Point

**Run `bmad-help` anytime you're unsure what to do next.** This intelligent guide:

- Inspects your project to see what's already been done
- Shows options based on your installed modules
- Understands natural language queries

```
bmad-help I have an existing Rails app, where should I start?
bmad-help How much planning does this change need before implementation?
bmad-help Show me what workflows are available
```

BMad-Help also **automatically runs at the end of every workflow**, providing clear guidance on exactly what to do next.

### Choose Planning Depth

All implementation uses `bmad-build`; scope determines what context you prepare first:

| Scope | Recommended preparation |
| --- | --- |
| **Clear updates or additions** | Enter `bmad-build` directly with the request, issue, or existing spec. |
| **Major changes or additions** | Prepare the useful PRD, UX, architecture, epic, story, readiness, and sprint context, then pass the selected work to `bmad-build`. |
