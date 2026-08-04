---
name: bmad-docs-29
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 29/30 (raw.githubusercontent.com)"
type: reference
---

## Tips

:::tip[Best Practices]

- **Focus on the unobvious** — Document patterns agents might miss (e.g., "Use JSDoc on every public class"), not universal practices like "use meaningful variable names."
- **Keep it lean** — This file is loaded by every implementation workflow. Long files waste context. Exclude content that only applies to narrow scope or specific stories.
- **Update as needed** — Edit manually when patterns change, or re-generate after significant architecture changes.
- Supports the same `bmad-build` loop whether work enters directly or after extensive planning.
  :::

## Next Steps

- [**Project Context Explanation**](../explanation/project-context.md) — Learn more about how it works
- [**Workflow Map**](../reference/workflow-map.md) — See which workflows load project context


<!-- source: docs/how-to/quick-fixes.md -->

---
title: 'Quick Fixes'
description: How to make quick fixes and ad-hoc changes
sidebar:
  order: 6
---

Bug fixes, refactorings, and small targeted changes can enter **Build** directly with little or no upstream planning. This is the same implementation workflow used for fully planned stories.

## When to Use This

- Bug fixes with a clear, known cause
- Small refactorings (rename, extract, restructure) contained within a few files
- Minor feature tweaks or configuration changes
- Dependency updates

:::note[Prerequisites]

- BMad Method installed (`npx bmad-method install`)
- An AI-powered IDE (Claude Code, Cursor, or similar)
  :::

## Steps

### 1. Start a Fresh Chat

Open a **fresh chat session** in your AI IDE. Reusing a session from a previous workflow can cause context conflicts.

### 2. Give It Your Intent

Build accepts free-form intent — before, with, or after the invocation. Examples:

```text
run build — Fix the login validation bug that allows empty passwords.
```

```text
run build — fix https://github.com/org/repo/issues/42
```

```text
run build — implement the intent in _bmad-output/implementation-artifacts/my-intent.md
```

```text
I think the problem is in the auth middleware, it's not checking token expiry.
Let me look at it... yeah, src/auth/middleware.ts line 47 skips
the exp check entirely. run build
```

```text
run build
> What would you like to do?
Refactor UserService to use async/await instead of callbacks.
```

Plain text, file paths, GitHub issue URLs, bug tracker links — anything the LLM can resolve to a concrete intent.

### 3. Answer Questions and Approve

Build may ask clarifying questions or present a short spec for your approval before implementing. Answer its questions and approve when you're satisfied with the plan.

### 4. Review and Push

Build implements the change, reviews its own work, patches issues, and commits locally. When it's done, it shows you the review spec.

- Skim the diff to confirm the change matches your intent
- If something looks off, tell the agent what to fix — it can iterate in the same session

Once satisfied, push the commit. Build will offer to push and create a PR for you.

:::caution[If Something Breaks]
If a pushed change causes unexpected issues, use `git revert HEAD` to undo the last commit cleanly. Then start a fresh chat and run Build again to try a different approach.
:::

## What You Get

- Modified source files with the fix or refactoring applied
- Passing tests (if your project has a test suite)
- A ready-to-push commit with a conventional commit message

## Deferred Work

Build keeps each run focused on a single goal. If your request contains multiple independent goals, or if the review surfaces pre-existing issues unrelated to your change, Build defers them to a file (`deferred-work.md` in your implementation artifacts directory) rather than trying to tackle everything at once.

Check this file after a run — it's your backlog of things to come back to. Each deferred item can be fed into a fresh Build run later.

## When to Add Formal Planning

Before running the same Build implementation loop, consider adding PRD, UX, architecture, or story planning when:

- The change affects multiple systems or requires coordinated updates across many files
- You are unsure about the scope and need requirements discovery first
- You need documentation or architectural decisions recorded for the team

See [Build](../explanation/build.md) for how direct intent and planned work converge on the same implementation loop.


<!-- source: docs/how-to/upgrade-to-v6.md -->

---
title: 'How to Upgrade to v6'
description: Migrate from BMad v4 to v6
sidebar:
  order: 4
---

Use the BMad installer to upgrade from v4 to v6, which includes automatic detection of legacy installations and migration assistance.

## When to Use This

- You have BMad v4 installed (`.bmad-method` folder)
- You want to migrate to the new v6 architecture
- You have existing planning artifacts to preserve

:::note[Prerequisites]

- Node.js 20.12+
- Existing BMad v4 installation
  :::

## Steps

### 1. Run the Installer

Follow the [Installer Instructions](./install-bmad.md).

### 2. Handle Legacy Installation

When v4 is detected, you can:

- Allow the installer to back up and remove `.bmad-method`
- Exit and handle cleanup manually

If you named your bmad method folder something else - you will need to manually remove the folder yourself.

### 3. Clean Up IDE Skills

Manually remove legacy v4 IDE commands/skills - for example if you have Claude Code, look for any nested folders that start with bmad and remove them:

- `.claude/commands/`

The new v6 skills are installed to:

- `.claude/skills/`

### 4. Migrate Planning Artifacts

**If you have planning documents (Brief/PRD/UX/Architecture):**

Move them to `_bmad-output/planning-artifacts/` with descriptive names:

- Include `PRD` in filename for PRD documents
- Include `brief`, `architecture`, or `ux-design` accordingly
- Sharded documents can be in named subfolders

**If you're mid-planning:** Consider restarting with v6 workflows. Use your existing documents as inputs—the new progressive discovery workflows with web search and IDE plan mode produce better results.

### 5. Migrate In-Progress Development

If you have stories created or implemented:

1. Complete the v6 installation
2. Place `epics.md` or `epics/epic*.md` in `_bmad-output/planning-artifacts/`
3. Run the Developer's `bmad-sprint-planning` workflow
4. Tell the agent which epics/stories are already complete

## What You Get

**v6 unified structure:**

```text
your-project/
├── _bmad/               # Single installation folder
│   ├── _config/         # Your customizations
│   │   └── agents/      # Agent customization files
│   ├── core/            # Universal core framework
│   ├── bmm/             # BMad Method module
│   ├── bmb/             # BMad Builder
│   └── cis/             # Creative Intelligence Suite
└── _bmad-output/        # Output folder (was doc folder in v4)
```
