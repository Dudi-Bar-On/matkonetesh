---
name: bmad-docs-14
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 14/30 (raw.githubusercontent.com)"
type: reference
---

## Architecture as Shared Context

Think of architecture as the shared context that all agents read before implementing:

```text
PRD: "What to build"
     ↓
Architecture: "How to build it"
     ↓
Agent A reads architecture → implements Epic 1
Agent B reads architecture → implements Epic 2
Agent C reads architecture → implements Epic 3
     ↓
Result: Consistent implementation
```

## Key ADR Topics

Common decisions that prevent conflicts:

| Topic            | Example Decision                             |
| ---------------- | -------------------------------------------- |
| API Style        | GraphQL vs REST vs gRPC                      |
| Database         | PostgreSQL vs MongoDB                        |
| Auth             | JWT vs Sessions                              |
| State Management | Redux vs Context vs Zustand                  |
| Styling          | CSS Modules vs Tailwind vs Styled Components |
| Testing          | Jest + Playwright vs Vitest + Cypress        |

## Anti-Patterns to Avoid

:::caution[Common Mistakes]
- **Implicit Decisions** — "We'll figure out the API style as we go" leads to inconsistency
- **Over-Documentation** — Documenting every minor choice causes analysis paralysis
- **Stale Architecture** — Documents written once and never updated cause agents to follow outdated patterns
:::

:::tip[Correct Approach]
- Document decisions that cross epic boundaries
- Focus on conflict-prone areas
- Update architecture as you learn
- Use `bmad-correct-course` for significant changes
:::


<!-- source: docs/explanation/project-context.md -->

---
title: "Project Context"
description: How project-context.md guides AI agents with your project's rules and preferences
sidebar:
  order: 11
---

The `project-context.md` file is your project's implementation guide for AI agents. Similar to a "constitution" in other development systems, it captures the rules, patterns, and preferences that ensure consistent code generation across all workflows.

## What It Does

AI agents make implementation decisions constantly — which patterns to follow, how to structure code, what conventions to use. Without clear guidance, they may:
- Follow generic best practices that don't match your codebase
- Make inconsistent decisions across different stories
- Miss project-specific requirements or constraints

The `project-context.md` file solves this by documenting what agents need to know in a concise, LLM-optimized format.

## How It Works

Every implementation workflow automatically loads `project-context.md` if it exists. The architect workflow also loads it to respect your technical preferences when designing the architecture.

**Loaded by these workflows:**
- `bmad-architecture` — respects technical preferences during solutioning
- `bmad-build` — informs story planning and implementation with project patterns
- `bmad-code-review` — validates against project standards
- `bmad-sprint-planning`, `bmad-retrospective`, `bmad-correct-course` — provides project-wide context

## When to Create It

The `project-context.md` file is useful at any stage of a project:

| Scenario | When to Create | Purpose |
|----------|----------------|---------|
| **New project, before architecture** | Manually, before `bmad-architecture` | Document your technical preferences so the architect respects them |
| **New project, after architecture** | Via `bmad-generate-project-context` or manually | Capture architecture decisions for implementation agents |
| **Existing project** | Via `bmad-generate-project-context` | Discover existing patterns so agents follow established conventions |
| **Direct implementation entry** | Before or during `bmad-build` | Ensure implementation respects your patterns even without upstream planning |

:::tip[Recommended]
For new projects, create it manually before architecture if you have strong technical preferences. Otherwise, generate it after architecture to capture those decisions.
:::

## What Goes In It

The file has two main sections:

### Technology Stack & Versions

Documents the frameworks, languages, and tools your project uses with specific versions:

```markdown
## Technology Stack & Versions

- Node.js 20.x, TypeScript 5.3, React 18.2
- State: Zustand (not Redux)
- Testing: Vitest, Playwright, MSW
- Styling: Tailwind CSS with custom design tokens
```

### Critical Implementation Rules

Documents patterns and conventions that agents might otherwise miss:

```markdown
## Critical Implementation Rules

**TypeScript Configuration:**
- Strict mode enabled — no `any` types without explicit approval
- Use `interface` for public APIs, `type` for unions/intersections

**Code Organization:**
- Components in `/src/components/` with co-located `.test.tsx`
- Utilities in `/src/lib/` for reusable pure functions
- API calls use the `apiClient` singleton — never fetch directly

**Testing Patterns:**
- Unit tests focus on business logic, not implementation details
- Integration tests use MSW to mock API responses
- E2E tests cover critical user journeys only

**Framework-Specific:**
- All async operations use the `handleError` wrapper for consistent error handling
- Feature flags accessed via `featureFlag()` from `@/lib/flags`
- New routes follow the file-based routing pattern in `/src/app/`
```

Focus on what's **unobvious** — things agents might not infer from reading code snippets. Don't document standard practices that apply universally.

## Creating the File

You have three options:

### Manual Creation

Create the file at `_bmad-output/project-context.md` and add your rules:

```bash
# In your project root
mkdir -p _bmad-output
touch _bmad-output/project-context.md
```

Edit it with your technology stack and implementation rules. The architect and implementation workflows will automatically find and load it.

### Generate After Architecture

Run the `bmad-generate-project-context` workflow after completing your architecture:

```bash
bmad-generate-project-context
```

This scans your architecture document and project files to generate a context file capturing the decisions made.

### Generate for Existing Projects

For existing projects, run `bmad-generate-project-context` to discover existing patterns:

```bash
bmad-generate-project-context
```

The workflow analyzes your codebase to identify conventions, then generates a context file you can review and refine.

## Why It Matters

Without `project-context.md`, agents make assumptions that may not match your project:

| Without Context | With Context |
|----------------|--------------|
| Uses generic patterns | Follows your established conventions |
| Inconsistent style across stories | Consistent implementation |
| May miss project-specific constraints | Respects all technical requirements |
| Each agent decides independently | All agents align with same rules |

This is especially important for:
- **Direct-entry work** — when there is no PRD or architecture, the context file supplies durable project conventions
- **Team projects** — ensures all agents follow the same standards
- **Existing projects** — prevents breaking established patterns
