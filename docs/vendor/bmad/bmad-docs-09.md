---
name: bmad-docs-09
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 09/30 (raw.githubusercontent.com)"
type: reference
---

## Why the reports hold up

Two rules run through everything. First, no conclusions from training data: the model's memory proposes questions and search strategy, but every claim in the report traces to a source retrieved or imported during this engagement. Second, the research firewall: your project files and briefs shape what gets asked, never what gets found. Research assistants receive only their assignment, so a run can't come back quietly biased toward what your local context already believed.

Every claim carries a publisher, a publication date, and an access date, with inline `[n]` citations resolving to a source appendix. Verification runs as material lands, at a level you choose: `normal` spot-checks the claims the recommendation rests on, `high` cross-checks the pack's critical claim classes and red-teams major conclusions, and `max` checks everything. Freshness is part of truth here too; each pack sets windows per claim class, and a market size from three years ago gets reported as history, not fact.

:::note[Everything lands on disk]
Digests, extractions, and report sections are written to the run folder the moment they exist. A run that dies mid-flight resumes from disk with nothing lost, and the report builds in front of you instead of behind a spinner.
:::

## The run folder and refresh

Each engagement gets one folder under your planning artifacts: the original imports untouched, the extracted digests, the drafted brief when there is one, and `research.md`. The report ends with a staleness map naming which claims age fastest and when to re-check them.

That map powers the lifecycle. **Refresh** re-verifies only the stale claims and appends a delta report (confirmed, changed, overturned), warning you when an overturned claim feeds a downstream artifact. **Deepen** drills into one dimension without re-running the rest. Research stays a living asset instead of a snapshot.

## Starting it

| Goal | Type this |
| --- | --- |
| Research something | `/bmad-deep-recon` then describe the decision, or just "research the self-hosted analytics market" |
| Force a type | "competitive research on Linear and Height" |
| Draft a prompt for your tool | "draft a deep research prompt about X for Gemini" |
| Process a report | "there's a research report at ~/Downloads/report.pdf, process it" |
| Choose between options | "help me choose between Postgres and MySQL for this" |
| Refresh an existing report | "refresh the market research" |
| Customize defaults | `/bmad-customize bmad-deep-recon` |

## Where the old research skills went

The v6 `bmad-market-research`, `bmad-domain-research`, and `bmad-technical-research` skills merged into Deep Recon as the `market`, `domain`, and `technical` types. The old names still work and forward to the new skill, so existing habits and menu entries keep functioning.


<!-- source: docs/explanation/established-projects-faq.md -->

---
title: "Established Projects FAQ"
description: Common questions about using BMad Method on established projects
sidebar:
  order: 12
---
Quick answers to common questions about working on established projects with the BMad Method (BMM).

## Questions

- [Do I have to run document-project first?](#do-i-have-to-run-document-project-first)
- [What if I forget to run document-project?](#what-if-i-forget-to-run-document-project)
- [How does implementation work in established projects?](#how-does-implementation-work-in-established-projects)
- [What if my existing code doesn't follow best practices?](#what-if-my-existing-code-doesnt-follow-best-practices)

### Do I have to run document-project first?

Highly recommended, especially if:

- No existing documentation
- Documentation is outdated
- AI agents need context about existing code

You can skip it if you have comprehensive, up-to-date documentation including `docs/index.md` or will use other tools or techniques to aid in discovery for the agent to build on an existing system.

### What if I forget to run document-project?

Don't worry about it - you can do it at any time. You can even do it during or after a project to help keep docs up to date.

### How does implementation work in established projects?

Run `bmad-build`, just as you would for new development. It will:

- Auto-detect your existing stack
- Analyze existing code patterns
- Detect conventions and ask for confirmation
- Generate context-rich spec that respects existing code

You can enter directly for a clear change or provide a planned story and its upstream artifacts for larger work.

### What if my existing code doesn't follow best practices?

Build detects your conventions and asks: "Should I follow these existing conventions?" You decide:

- **Yes** → Maintain consistency with current codebase
- **No** → Establish new standards (document why in spec)

BMM respects your choice — it won't force modernization, but it will offer it.

**Have a question not answered here?** Please [open an issue](https://github.com/bmad-code-org/BMAD-METHOD/issues) or ask in [Discord](https://discord.gg/gk8jAdXWmj) so we can add it!


<!-- source: docs/explanation/forge-idea.md -->

---
title: "Forge an Idea"
description: Pressure-test an idea through persona-driven interrogation until it hardens, proves out, or dies cheaply
sidebar:
  order: 13
---

Take a half-formed idea and pressure-test it now, in conversation, while changing your mind is still free.

## What is Forge Idea?

Run `bmad-forge-idea` and an exacting interrogator goes to work on your idea, one question at a time, until what survives is something you can act on with earned conviction. The skill is domain-agnostic. It runs on a software feature, a business model, a research hypothesis, or a life decision you keep circling.

What you walk away with is sharper thinking. A distilled `forged-idea.md` is only ever one possible exit, and the session never herds you toward "shall we build it?"

Forge Idea is one of the core module's thinking skills, so it is present in every BMad installation.

## Why Pressure-Test Early

The enemy is the hole you can't see in your own idea. An unexamined assumption or an unresolved branch is a crack, and a crack you miss now resurfaces later — in the build, or the launch, when it costs far more to fix.

A conversation is the cheapest place to catch it, because changing your mind here costs nothing. The forge spends that cheapness on purpose, going after the weak points while fixing them is still free.

## How a Session Runs

The interrogator works one question at a time, in dependency order, and puts its own recommended answer on the table each time. A position you can push against gets further than an open prompt. It finds discoverable answers itself instead of sending you to fetch them.

When your idea lands inside an existing project, that project's material becomes the ground truth. The interrogator checks your claims against what already exists and names the contradictions. Your vocabulary gets the same treatment. When a term is fuzzy or carries two meanings, it forces a precise choice before the branch can resolve, because a branch built on an overloaded word resolves falsely.
