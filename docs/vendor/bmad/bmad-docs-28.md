---
name: bmad-docs-28
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 28/30 (raw.githubusercontent.com)"
type: reference
---

## Creating Your Own Modules

Use [BMad Builder](https://github.com/bmad-code-org/bmad-builder) to create modules that others can install:

1. Run `bmad-module-builder` to scaffold your module structure
2. Add skills, agents, and workflows with the various bmad builder tools
3. Publish to a Git repository or share the folder collection
4. Others install with `--custom-source <your-repo-url>`

For modules to support discovery mode, include a `.claude-plugin/marketplace.json` in your repository root (this is a cross-tool convention, not Claude-specific). See the [BMad Builder documentation](https://github.com/bmad-code-org/bmad-builder) for the marketplace.json format.

:::tip[Testing Locally First]
During development, install your module with a local path to iterate quickly before publishing to a Git repository.
:::


<!-- source: docs/how-to/non-interactive-installation.md -->

---
title: Non-Interactive Installation
description: Headless / CI install docs have moved
sidebar:
  order: 2
---

:::note[This page has moved]
Headless and CI install flags, channel selection, and pinning now live in the unified [How to Install BMad](./install-bmad.md) guide. Jump to the [Headless / CI installs](./install-bmad.md#headless-ci-installs) section for the flag reference and copy-paste recipes.
:::


<!-- source: docs/how-to/pressure-test-an-idea.md -->

---
title: "Pressure-Test an Idea"
description: Use the bmad-forge-idea skill to harden, prove, or kill an idea before you invest in it
sidebar:
  order: 11
---

Use the `bmad-forge-idea` skill to put a half-formed idea under adversarial questioning. It either survives with earned conviction or dies cheaply.

## When to Use This

- You hold an idea and want it stress-tested before you commit time or money
- You want an honest read on whether to kill it, not encouragement
- You're choosing between branches of a decision and need each one resolved
- Your idea lives inside an existing project and needs to be checked against what's already there

## When to Skip This

- You have no idea yet and need to generate options — use `bmad-brainstorming`
- You've committed to a product and want it proven customer-first — use `bmad-prfaq`
- You want your agents to debate a decision together — use `bmad-party-mode`

:::note[Prerequisites]
None. The forge runs in plain conversation. Installed agents and a configured persona roster make the session richer, but it works without them.
:::

## Run a Session

### 1. Invoke the skill

Type `bmad-forge-idea` in your IDE, or say "forge an idea" or "pressure-test this." Name the idea in the same message or wait for the first question.

### 2. State your goal

Tell the forge what you want: harden the idea, prove or kill it, or just think it through. The goal steers the questioning. Proving goes after the load-bearing claim first, and hardening drives each branch to a resolved answer.

### 3. Defend your thinking, one branch at a time

The interrogator asks one question at a time and puts its own recommended answer on the table for you to push against. Answer honestly. When it challenges a fuzzy term or a claim that doesn't match your project, settle that before you move on.

### 4. Steer the room

Every branch arrives with two voices — one from your roster, one conjured by the topic. Call a specific persona by name, summon a saved party, or say "adversarial on this" to have a claim attacked while you defend it.

### 5. Land an exit

Drive each branch to a resolved answer until the idea is hardened, killed, or simply clearer. Say when you're done, or let the forge call it.

## What You Get

The forge writes a self-contained `forge-report.html` every run, stamped to match the outcome. A hardened idea also distills into `forged-idea.md`, which captures the locked decisions and what was killed and why. That file feeds `bmad-spec`, `bmad-prd`, or `bmad-prfaq` for a product concept. A killed or clarified session needs no artifact; the report stands on its own.

:::tip[Let it kill the idea]
Finding out cheaply that an idea doesn't hold is the win. Don't steer the session toward a yes.
:::


<!-- source: docs/how-to/project-context.md -->

---
title: 'Manage Project Context'
description: Create and maintain project-context.md to guide AI agents
sidebar:
  order: 9
---

Use the `project-context.md` file to ensure AI agents follow your project's technical preferences and implementation rules throughout all workflows. To make sure this is always available, you can also add the line `Important project context and conventions are located in [path to project context]/project-context.md` to your tools context or always rules file (such as `AGENTS.md`)

:::note[Prerequisites]

- BMad Method installed
- Understanding of your project's technology stack and conventions
  :::

## When to Use This

- You have strong technical preferences before starting architecture
- You've completed architecture and want to capture decisions for implementation
- You're working on an existing codebase with established patterns
- You notice agents making inconsistent decisions across stories

## Step 1: Choose Your Approach

**Manual creation** — Best when you know exactly what rules you want to document

**Generate after architecture** — Best for capturing decisions made during solutioning

**Generate for existing projects** — Best for discovering patterns in existing codebases

## Step 2: Create the File

### Option A: Manual Creation

Create the file at `_bmad-output/project-context.md`:

```bash
mkdir -p _bmad-output
touch _bmad-output/project-context.md
```

Add your technology stack and implementation rules:

```markdown
---
project_name: 'MyProject'
user_name: 'YourName'
date: '2026-02-15'
sections_completed: ['technology_stack', 'critical_rules']
---

# Project Context for AI Agents

## Technology Stack & Versions

- Node.js 20.x, TypeScript 5.3, React 18.2
- State: Zustand
- Testing: Vitest, Playwright
- Styling: Tailwind CSS

## Critical Implementation Rules

**TypeScript:**

- Strict mode enabled, no `any` types
- Use `interface` for public APIs, `type` for unions

**Code Organization:**

- Components in `/src/components/` with co-located tests
- API calls use `apiClient` singleton — never fetch directly

**Testing:**

- Unit tests focus on business logic
- Integration tests use MSW for API mocking
```

### Option B: Generate After Architecture

Run the workflow in a fresh chat:

```bash
bmad-generate-project-context
```

The workflow scans your architecture document and project files to generate a context file capturing the decisions made.

### Option C: Generate for Existing Projects

For existing projects, run:

```bash
bmad-generate-project-context
```

The workflow analyzes your codebase to identify conventions, then generates a context file you can review and refine.

## Step 3: Verify Content

Review the generated file and ensure it captures:

- Correct technology versions
- Your actual conventions (not generic best practices)
- Rules that prevent common mistakes
- Framework-specific patterns

Edit manually to add anything missing or remove inaccuracies.

## What You Get

A `project-context.md` file that:

- Ensures all agents follow the same conventions
- Prevents inconsistent decisions across stories
- Captures architecture decisions for implementation
- Serves as a reference for your project's patterns and rules
