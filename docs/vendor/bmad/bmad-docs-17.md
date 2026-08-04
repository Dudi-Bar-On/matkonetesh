---
name: bmad-docs-17
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 17/30 (raw.githubusercontent.com)"
type: reference
---

## When to use a web bundle

- You're doing the upfront thinking for a project and you want a focused tool with persona, Canvas, and Deep Research.
- You want to keep IDE token spend for actual coding.
- You're sharing the planning artifact with collaborators who don't have your IDE setup.

## When to stay in the IDE

- The work needs to read or modify code in your repo.
- You're already mid-implementation and want to keep context.
- You don't have a Gemini Advanced or ChatGPT Plus subscription.

## Updating and customizing

Bundles evolve. When you pull a newer version of a bundle, the typical update is to its knowledge files (the `SKILL.md` protocol and any attached templates, CSVs, or validation checklists). Re-upload those into your Gem or Custom GPT to take the update. The instructions block usually does not change.

If you want to customize a bundle for your team or your voice, do it in the **instructions block** you pasted into the Gem or GPT, not in the knowledge files. The instructions block is where the persona, preferences, and any local overrides live; the knowledge files are the protocol the bundle ships with. Keeping customization in the instructions block means future updates are a swap-the-attachments operation, not a merge-your-edits-back-in operation.

:::tip[Customize the instructions, attach the knowledge]
Persona swaps, default user name, team-specific guardrails, preferred phrasing: all of that belongs in the pasted instructions block. The knowledge files stay stock so you can refresh them without losing your changes.
:::

## Building your own

Web bundles are generated from BMad skills using the `bmad-os-skill-to-bundle` utility skill. Point it at any BMad skill folder and it produces the bundle files with persona inheritance from the owning agent.

Install any bundle from [bmadcode.com/web-bundles](https://bmadcode.com/web-bundles/).


<!-- source: docs/explanation/why-solutioning-matters.md -->

---
title: "Why Solutioning Matters"
description: Understanding why the solutioning phase is critical for multi-epic projects
sidebar:
  order: 5
---


Phase 3 (Solutioning) translates **what** to build (from Planning) into **how** to build it (technical design). This phase prevents agent conflicts in multi-epic projects by documenting architectural decisions before implementation begins.

## The Problem Without Solutioning

```text
Agent 1 implements Epic 1 using REST API
Agent 2 implements Epic 2 using GraphQL
Result: Inconsistent API design, integration nightmare
```

When multiple agents implement different parts of a system without shared architectural guidance, they make independent technical decisions that may conflict.

## The Solution With Solutioning

```text
architecture workflow decides: "Use GraphQL for all APIs"
All agents follow architecture decisions
Result: Consistent implementation, no conflicts
```

By documenting technical decisions explicitly, all agents implement consistently and integration becomes straightforward.

## Solutioning vs Planning

| Aspect   | Planning (Phase 2)      | Solutioning (Phase 3)             |
| -------- | ----------------------- | --------------------------------- |
| Question | What and Why?           | How? Then What units of work?     |
| Output   | FRs/NFRs (Requirements) | Architecture + Epics/Stories      |
| Agent    | PM                      | Architect → PM                    |
| Audience | Stakeholders            | Developers                        |
| Document | PRD (FRs/NFRs)          | Architecture + Epic Files         |
| Level    | Business logic          | Technical design + Work breakdown |

## Key Principle

**Make technical decisions explicit and documented** so all agents implement consistently.

This prevents:
- API style conflicts (REST vs GraphQL)
- Database design inconsistencies
- State management disagreements
- Naming convention mismatches
- Security approach variations

## Choosing Solutioning Depth

| Work characteristics | Solutioning guidance |
|---|---|
| Clear, local change with established patterns | Usually unnecessary |
| Several related components with known constraints | Optional, based on coordination risk |
| Multiple epics or cross-system decisions | Needed to align implementation |
| Regulated, high-risk, or enterprise initiative | Follow required governance; solutioning is normally required |

Solutioning changes the context available to `bmad-build`; it does not change the implementation workflow.

:::tip[Rule of Thumb]
If you have multiple epics that could be implemented by different agents, you need solutioning.
:::

## The Cost of Skipping

Skipping solutioning on complex projects leads to:

- **Integration issues** discovered mid-sprint
- **Rework** due to conflicting implementations
- **Longer development time** overall
- **Technical debt** from inconsistent patterns

:::caution[Cost Multiplier]
Catching alignment issues in solutioning is 10× faster than discovering them during implementation.
:::


<!-- source: docs/how-to/customize-bmad.md -->

---
title: 'How to Customize BMad'
description: Customize agents and workflows while preserving update compatibility
sidebar:
  order: 8
---

Tailor agent personas, inject domain context, add capabilities, and configure workflow behavior -- all without modifying installed files. Your customizations survive every update.

:::tip[Don't want to hand-author TOML? Use `bmad-customize`]
The `bmad-customize` skill is a guided authoring helper for the **per-skill agent/workflow override surface** described in this doc. It scans what's customizable in your installation, helps you choose the right surface (agent vs workflow) for your intent, writes the override file for you, and verifies the merge landed. Central-config overrides (`_bmad/custom/config.toml`) are out of scope for v1 — hand-author those per the Central Configuration section below. Run the skill whenever you want to make a per-skill change; this doc is the reference for *what* each surface exposes and how merging works.
:::

## When to Use This

- You want to change an agent's personality or communication style
- You need to give an agent persistent facts to recall (e.g. "our org is AWS-only")
- You want to add procedural startup steps the agent must run every session
- You want to add custom menu items that trigger your own skills or prompts
- Your team needs shared customizations committed to git, with personal preferences layered on top

:::note[Prerequisites]

- BMad installed in your project (see [How to Install BMad](./install-bmad.md))
- A way to run the resolver script — BMad is standardizing on `uv` (`uv run`, which provisions Python for you); a plain `python3` 3.11+ on your PATH still works during the transition. The script uses only stdlib `tomllib`, so there's nothing to `pip install`.
- A text editor for TOML files
:::

## How It Works

Every customizable skill ships a `customize.toml` file with its defaults. This file defines the skill's complete customization surface -- read it to see what's customizable. You never edit this file. Instead, you create sparse override files containing only the fields you want to change.
