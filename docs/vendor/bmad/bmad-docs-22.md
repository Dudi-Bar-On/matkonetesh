---
name: bmad-docs-22
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 22/30 (raw.githubusercontent.com)"
type: reference
---

# Terminal hook. Scalar override replaces the empty default wholesale.
on_complete = """
Publish and offer follow-up:

1. Read the finalized brief file path from the prior step.
2. Call `mcp__atlassian__confluence_create_page` with:
   - space: "PRODUCT"
   - parent: "Product Briefs"
   - title: the brief's title
   - body: the brief's markdown contents
   Capture the returned page URL.
3. Tell the user: "Brief published to Confluence: <url>".
4. Ask: "Want me to open a Jira epic for this brief now?"
5. If yes, call `mcp__atlassian__jira_create_issue` with:
   - type: "Epic"
   - project: "PROD"
   - summary: the brief's title
   - description: a short summary plus a link back to the Confluence page.
   Report the epic key and URL.
6. If no, exit cleanly.

If either MCP tool fails, report the failure, print the brief path,
and ask the user to publish manually.
"""
```

**Why `on_complete` and not `activation_steps_append`:** `on_complete` runs exactly once, at the terminal stage, after the workflow's main output is written. That's the right moment to publish artifacts. `activation_steps_append` runs every activation, before the workflow does its work.

**Tradeoffs:**
- **Confluence publication is non-destructive** and always runs on completion
- **Jira epic creation is visible to the whole team** and kicks off sprint-planning signals, so gate it on user confirmation
- **Graceful fallback:** if MCP tools fail, hand off to the user rather than silently dropping the output

## Recipe 4: Swap in Your Own Output Template

**Use case:** The default output structure doesn't match your organization's expected format, or different orgs in the same repo need different templates.

**Example: point the product-brief workflow at an enterprise-owned template.**

```toml
# _bmad/custom/bmad-product-brief.toml

[workflow]
brief_template = "{project-root}/docs/enterprise/brief-template.md"
```

**How it works:** The workflow's `customize.toml` ships with `brief_template = "resources/brief-template.md"` (bare path, resolves from skill root). Your override points at a file under `{project-root}`, so the agent reads your template in Stage 4 instead of the shipped one.

**Template authoring tips:**
- Keep templates in `{project-root}/docs/` or `{project-root}/_bmad/custom/templates/` so they version alongside the override file
- Use the same structural conventions as the shipped template (section headings, frontmatter); the agent adapts to what's there
- For multi-org repos, use `.user.toml` to let individual teams point at their own templates without touching the committed team file

## Recipe 5: Customize the Agent Roster

**Use case:** Change *who's in the room* for roster-driven skills like `bmad-party-mode`, `bmad-retrospective`, and `bmad-advanced-elicitation`, without editing any source or forking. Three common variants follow.

### 5a. Rebrand a BMad Agent Org-Wide

Every real agent has a descriptor the installer synthesizes from `module.yaml`. Override it to shift voice and framing across every roster consumer:

```toml
# _bmad/custom/config.toml (committed — applies to every developer)

[agents.bmad-agent-analyst]
description = "Mary the Regulatory-Aware Business Analyst — channels Porter and Minto, but lives and breathes FDA audit trails. Speaks like a forensic investigator presenting a case file."
```

Party-mode spawns Mary with the new description. The analyst activation itself still runs normally because Mary's behavior lives in her per-skill `customize.toml`. This override changes how **external skills perceive and introduce her**, not how she works internally.

### 5b. Add a Fictional or Custom Agent

A full descriptor is enough for roster-based features, with no skill folder needed. Useful for personality variety in party mode or brainstorming sessions:

```toml
# _bmad/custom/config.user.toml (personal — gitignored)

[agents.spock]
team = "startrek"
name = "Commander Spock"
title = "Science Officer"
icon = "🖖"
description = "Logic first, emotion suppressed. Begins observations with 'Fascinating.' Never rounds up. Counterpoint to any argument that relies on gut instinct."

[agents.mccoy]
team = "startrek"
name = "Dr. Leonard McCoy"
title = "Chief Medical Officer"
icon = "⚕️"
description = "Country doctor's warmth, short fuse. 'Dammit Jim, I'm a doctor not a ___.' Ethics-driven counterweight to Spock."
```

Ask party-mode to "invite the Enterprise crew." It filters by `team = "startrek"` and spawns Spock and McCoy with those descriptors. Real BMad agents (Mary, Amelia) can sit at the same table if you ask them to.

### 5c. Pin Team Install Settings

The installer prompts each developer for values like `planning_artifacts` path. When the org needs one shared answer across the team, pin it in central config — any developer's local prompt answer gets overridden at resolution time:

```toml
# _bmad/custom/config.toml

[modules.bmm]
planning_artifacts = "{project-root}/shared/planning"
implementation_artifacts = "{project-root}/shared/implementation"

[core]
document_output_language = "English"
```

Personal settings like `user_name`, `communication_language`, or `user_skill_level` stay under each developer's own `_bmad/config.user.toml`. The team file shouldn't touch those.

**Why central config vs per-agent customize.toml:** Per-agent files shape how *one* agent behaves when it activates. Central config shapes what roster consumers *see when they look at the field:* which agents exist, what they're called, what team they belong to, and the shared install settings the whole repo agrees on. Two surfaces, different jobs.
