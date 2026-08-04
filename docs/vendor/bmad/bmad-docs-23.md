---
name: bmad-docs-23
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 23/30 (raw.githubusercontent.com)"
type: reference
---

## Reinforce Global Rules in Your IDE's Session File

BMad customizations load when a skill is activated. Many IDE tools also load a global instruction file at the **start of every session**, before any skill runs (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, etc). For rules that should hold even outside BMad skills, restate the critical ones there too.

**When to double up:**
- A rule is important enough that a plain chat conversation (no skill active) should still follow it
- You want belt-and-suspenders enforcement because training-data defaults might otherwise pull the model off-course
- The rule is concise enough to repeat without bloating the session file

**Example: one line in the repo's `CLAUDE.md` reinforcing the dev-agent rule from Recipe 1.**

```markdown
<!-- Any file-read of library docs goes through the context7 MCP tool
(`mcp__context7__resolve_library_id` then `mcp__context7__get_library_docs`)
before relying on training-data knowledge. -->
```

One sentence, loaded every session. It pairs with the `bmad-agent-dev.toml` customization so the rule applies both inside Amelia's workflows and during ad-hoc chats with the assistant. Each layer owns its own scope:

| Layer | Scope | Use for |
|---|---|---|
| IDE session file (`CLAUDE.md` / `AGENTS.md`) | Every session, before any skill activates | Short, universal rules that should survive outside BMad |
| BMad agent customization | Every workflow the agent dispatches | Agent-persona-specific behavior |
| BMad workflow customization | One workflow run | Workflow-specific output shape, publishing hooks, templates |
| BMad central config | Agent roster + shared install settings | Who's in the room and what shared paths the team uses |

Keep the IDE file **succinct**. A dozen well-chosen lines are more effective than a sprawling list. Models read it every turn, and noise crowds out signal.

## Recipe 6: Advanced Integration Patterns

Several BMad workflows expose a richer configuration surface beyond the basics covered in Recipes 1–5. These patterns — on-demand knowledge sources, automatic output publishing, finalize-time doc standards, and swappable templates — appear across multiple workflows. Check a workflow's `customize.toml` to see which fields it exposes; the examples below use `bmad-prd` because it exposes all of them, but the same patterns apply wherever the field appears.

### On-demand knowledge sources (`external_sources`)

Connect the workflow to internal knowledge bases, competitive databases, or compliance references. The agent consults these on demand when the conversation surfaces a matching need — never preemptively.

```toml
# _bmad/custom/bmad-prd.toml  (same pattern works in any workflow that exposes external_sources)

[workflow]
external_sources = [
  "When the user mentions a competitor or market segment, query corp:competitive_db (category={project_name}) before drafting the differentiation section.",
  "For regulatory domains (healthcare, fintech, education), consult corp:compliance_reference before drafting domain-specific sections.",
]
```

Each entry is a natural-language directive naming the MCP tool, the trigger condition, and any fields the tool needs. If the tool is unavailable at runtime, the workflow falls back to standard behavior and notes the gap.

### Automatic output publishing (`external_handoffs`)

Route completed artifacts to external systems of record after the workflow finalizes. Unlike `on_complete` (Recipe 3), `external_handoffs` is a dedicated append array — team entries stack, and each handoff fires independently with graceful degradation if a tool is unavailable.

```toml
# _bmad/custom/bmad-prd.toml  (same pattern works in any workflow that exposes external_handoffs)

[workflow]
external_handoffs = [
  "After finalize, upload prd.md and addendum.md to Confluence via corp:confluence_upload (space_key='PROD', parent_page='PRDs', label='prd', author={user_name}). Capture and surface the returned page URL.",
  "Mirror to Notion via notion:create_page (database_id='abc123', title='PRD: ' + {project_name}).",
]
```

If a named tool is unavailable, the handoff is skipped and flagged — local files always exist regardless.

### Finalize-time doc standards (`doc_standards`)

Apply org writing standards to human-consumed documents at finalize, after content is complete but before the user sees the output. Each entry is a `skill:`, `file:`, or plain-text directive; passes run as parallel subagents.

```toml
# _bmad/custom/bmad-prd.toml  (same pattern works in any workflow that exposes doc_standards)

[workflow]
doc_standards = [
  "file:{project-root}/docs/enterprise/voice-and-tone.md",
  "All dates must use ISO 8601 format (YYYY-MM-DD).",
  "Replace any use of 'leverage' with 'use'.",
]
```

`doc_standards` is an append array — team entries stack on top of whatever defaults the workflow ships with. Broader structural passes should come before narrower prose passes.

### Swappable templates and checklists

Workflows that produce structured documents typically expose template and checklist paths as overridable scalars. Point them at org-owned files under `{project-root}` to enforce a different structure without editing any source.

```toml
# _bmad/custom/bmad-prd.toml

[workflow]
# Regulated-industry PRD structure
prd_template = "{project-root}/docs/enterprise/prd-template-hipaa.md"

# Org-specific validation criteria
validation_checklist = "{project-root}/docs/enterprise/prd-checklist-regulated.md"
```

The agent adapts to whatever structure the template defines. Keep templates under `{project-root}/docs/` or `{project-root}/_bmad/custom/templates/` so they version alongside the override file. For multi-org repos, use `.user.toml` to let teams point at their own templates without touching the committed team file.

## Combining Recipes

All six recipes compose. A realistic enterprise override for `bmad-product-brief` might set `persistent_facts` (Recipe 2), `on_complete` (Recipe 3), and `brief_template` (Recipe 4) in one file. The agent-level rule (Recipe 1) lives in a separate file under the agent's name, central config (Recipe 5) pins the shared roster and team settings, advanced integration patterns (Recipe 6) configure external sources and handoffs, and all layers apply in parallel.

```toml
# _bmad/custom/bmad-product-brief.toml (workflow-level)

[workflow]
persistent_facts = ["..."]
brief_template = "{project-root}/docs/enterprise/brief-template.md"
on_complete = """ ... """
```

```toml
# _bmad/custom/bmad-agent-analyst.toml (agent-level — Mary dispatches product-brief)

[agent]
persistent_facts = ["Always include a 'Regulatory Review' section when the domain involves healthcare, finance, or children's data."]
```

Result: Mary loads the regulatory-review rule at persona activation. When the user picks the product-brief menu item, the workflow loads its own conventions on top, writes to the enterprise template, and publishes to Confluence on completion. Every layer contributes, and none of them required editing BMad source.
