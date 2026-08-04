---
name: bmad-docs-21
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 21/30 (raw.githubusercontent.com)"
type: reference
---

### During PRD Creation

When creating a brief or jumping directly into the PRD, ensure the agent:

- Finds and analyzes your existing project documentation
- Reads the proper context about your current system

You can guide the agent explicitly, but the goal is to ensure the new feature integrates well with your existing system.

### UX Considerations

UX work is optional. The decision depends not on whether your project has a UX, but on:

- Whether you will be working on UX changes
- Whether significant new UX designs or patterns are needed

If your changes amount to simple updates to existing screens you are happy with, a full UX process is unnecessary.

### Architecture Considerations

When doing architecture, ensure the architect:

- Uses the proper documented files
- Scans the existing codebase

Pay close attention here to prevent reinventing the wheel or making decisions that misalign with your existing architecture.

## More Information

- **[Quick Fixes](./quick-fixes.md)** - Bug fixes and ad-hoc changes
- **[Established Projects FAQ](../explanation/established-projects-faq.md)** - Common questions about working on established projects


<!-- source: docs/how-to/expand-bmad-for-your-org.md -->

---
title: 'How to Expand BMad for Your Organization'
description: Six customization patterns that reshape BMad without forking — agent-wide rules, workflow conventions, external publishing, template swaps, agent roster changes, and advanced integration patterns
sidebar:
  order: 10
---

BMad's customization surface lets an organization reshape behavior without editing installed files or forking skills. This guide walks through six recipes that cover most enterprise needs.

:::note[Prerequisites]

- BMad installed in your project (see [How to Install BMad](./install-bmad.md))
- Familiarity with the customization model (see [How to Customize BMad](./customize-bmad.md))
- Python 3.11+ on PATH (for the resolver — stdlib only, no `pip install`)
:::

:::tip[Applying these recipes]
The **per-skill recipes** below (Recipes 1–4) can be applied by running the `bmad-customize` skill and describing the intent — it will pick the right surface, author the override file, and verify the merge. Recipe 5 (central-config overrides to the agent roster) is out of scope for v1 of the skill and remains hand-authored. The recipes here are the source of truth for *what* to override; `bmad-customize` handles the *how* for the agent/workflow surface.
:::

## The Three-Layer Mental Model

Before picking a recipe, know where your override lands:

| Layer | Where overrides live | Scope |
|---|---|---|
| **Agent** (e.g. Amelia, Mary, John) | `[agent]` section of `_bmad/custom/bmad-agent-{role}.toml` | Travels with the persona into **every workflow the agent dispatches** |
| **Workflow** (e.g. product-brief, create-prd) | `[workflow]` section of `_bmad/custom/{workflow-name}.toml` | Applies only to that workflow's run |
| **Central config** | `[agents.*]`, `[core]`, `[modules.*]` in `_bmad/custom/config.toml` | Agent roster (who's available for party-mode, retrospective, elicitation), install-time settings pinned org-wide |

Rule of thumb: if the rule should apply everywhere an engineer does dev work, customize the **dev agent**. If it applies only when someone writes a product brief, customize the **product-brief workflow**. If it changes *who's in the room* (rename an agent, add a custom voice, enforce a shared artifact path), edit **central config**.

## Recipe 1: Shape an Agent Across Every Workflow It Dispatches

**Use case:** Standardize tool use and external system integrations so every workflow dispatched through an agent inherits the behavior. This is the highest-impact pattern.

**Example: Amelia (dev agent) always uses Context7 for library docs, and falls back to Linear when a story isn't found in the epics list.**

```toml
# _bmad/custom/bmad-agent-dev.toml

[agent]

# Applied on every activation. Carries into build, code-review,
# qa-generate — every skill Amelia dispatches.
persistent_facts = [
  "For any library documentation lookup (React, TypeScript, Zod, Prisma, etc.), call the context7 MCP tool (`mcp__context7__resolve_library_id` then `mcp__context7__get_library_docs`) before relying on training-data knowledge. Up-to-date docs trump memorized APIs.",
  "When a story reference isn't found in {planning_artifacts}/epics-and-stories.md, search Linear via `mcp__linear__search_issues` using the story ID or title before asking the user to clarify. If Linear returns a match, treat it as the authoritative story source.",
]
```

**Why this works:** Two sentences reshape every dev workflow in the org, with no per-workflow duplication and no source changes. Every new engineer who pulls the repo inherits the conventions automatically.

**Team file vs personal file:**
- `bmad-agent-dev.toml`: committed to git; applies to the whole team
- `bmad-agent-dev.user.toml`: gitignored; personal preferences layered on top

## Recipe 2: Enforce Organizational Conventions Inside a Specific Workflow

**Use case:** Shape the *content* of a workflow's output so it meets compliance, audit, or downstream-consumer requirements.

**Example: every product brief must include compliance fields, and the agent knows about the org's publishing conventions.**

```toml
# _bmad/custom/bmad-product-brief.toml

[workflow]

persistent_facts = [
  "Every brief must include an 'Owner' field, a 'Target Release' field, and a 'Security Review Status' field.",
  "Non-commercial briefs (internal tools, research projects) must still include a user-value section, but can omit market differentiation.",
  "file:{project-root}/docs/enterprise/brief-publishing-conventions.md",
]
```

**What happens:** The facts load during Step 3 of the workflow's activation. When the agent drafts the brief, it knows the required fields and the enterprise conventions document. The shipped default (`file:{project-root}/**/project-context.md`) still loads, since this is an append.

## Recipe 3: Publish Completed Outputs to External Systems

**Use case:** Once the workflow produces its output, automatically publish to enterprise systems of record (Confluence, Notion, SharePoint) and open follow-up work (Jira, Linear, Asana).

**Example: briefs auto-publish to Confluence and offer optional Jira epic creation.**

```toml
# _bmad/custom/bmad-product-brief.toml

[workflow]
