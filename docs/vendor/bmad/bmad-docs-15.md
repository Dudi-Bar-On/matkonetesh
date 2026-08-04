---
name: bmad-docs-15
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 15/30 (raw.githubusercontent.com)"
type: reference
---

## Editing and Updating

The `project-context.md` file is a living document. Update it when:

- Architecture decisions change
- New conventions are established
- Patterns evolve during implementation
- You identify gaps from agent behavior

You can edit it manually at any time, or re-run `bmad-generate-project-context` to update it after significant changes.

:::note[File Location]
The default location is `_bmad-output/project-context.md`. Workflows search for it there, and also check `**/project-context.md` anywhere in your project.
:::


<!-- source: docs/explanation/retrospective.md -->

---
title: "Retrospective"
description: Close out a finished epic by reading the evidence it left — the diff, the commits, the specs — and judging the result instead of trusting memory.
sidebar:
  order: 15
---

Run `bmad-retrospective` when an epic is done. It reads what the epic actually produced (the specs, the full diff, the per-story commits, the sprint status) and works from that evidence rather than anyone's recollection of how the work went. What comes back is a written review, a set of owned action items, and a verdict on whether the epic met its bar.

## What it does

An epic ships as a stack of stories, each built and reviewed on its own. The retrospective looks at all of it at once and pulls out what no single story could show:

- **Aggregate defects** — the architecture that drifted, the helper written twice, the class that grew past a healthy size a few hundred lines at a time.
- **Diff-scope review** — it hands the epic's diff to `bmad-review` for the code lenses, weighting the seams between stories where no single session saw both sides.
- **Spec reconciliation** — where the built code diverged from what the epic and PRD described.
- **An acceptance verdict** — the epic judged against its own acceptance criteria.

Every finding carries a source reference: a file, a line, a commit, a log. A claim it can't point at doesn't make the report.

## Why run it after an epic

Each story passed its own review in isolation, so the bugs that survive to this point are the ones isolation hides. Nine sessions each add a little to the same file, and none of them ever sees the god class they built together. No session judged the epic as a whole against what it set out to deliver, either. That whole-epic view is the gap this closes, and the end of an epic is the moment to close it: the diff is fresh and the session logs haven't been cleared yet.

:::note[It reads evidence, it doesn't invent it]
The retrospective reports what the diff, the commits, and the specs actually show. It won't manufacture a root cause or a pattern the code doesn't back up.
:::

## What you get

Two artifacts and a decision:

- **A retrospective document** in your implementation artifacts — the evidence inventory, findings grouped with their sources, the verdict, and the action items.
- **An updated sprint status** — the epic's retrospective marked done, each action item appended with a stable id and a link back to its finding.
- **A verdict** of `accepted`, `accepted-with-open-items`, or `rejected`, which tells you whether to start the next epic or hold and fix first. Unfinished stories for that epic make the machine verdict **rejected** (a human can still override interactively).

## What to do with the output

The skill proposes; you decide what runs. Nothing touches your code or your specs automatically.

- **Action items** feed the normal dev loop as fix-now work or fresh stories. The retrospective writes them up. It doesn't execute them.
- **Spec reconciliations** arrive with the evidence attached, for you to apply to the project contract by hand. An uncertain interpretation never gets written into a spec on its own.
- **The verdict** is the gate. A rejected epic, or one accepted with open items, tells the next planning step what to carry forward.

A failing epic never closes as quietly accepted. If the criteria aren't met, or any of the epic's stories are still unfinished, and no one overrides the call, it closes as not accepted.

## Running it

Say "run a retrospective" or "let's retro epic 3." It finds the completed epic from sprint status, or takes the one you name, and by default stops at the written report and verdict.

| You want | Do this |
| --- | --- |
| A standard review | "run a retrospective" |
| A specific epic | "retro epic 3" |
| The team to talk it over | Ask to "discuss it as a team" — it convenes [party mode](./party-mode.md) over the real findings, off by default |
| An unattended run for automation | `-H <epic>` — headless, verdict on the evidence alone |


<!-- source: docs/explanation/sprint-planning.md -->

---
title: "Sprint Planning"
description: One skill owns the sprint-status artifact end to end — gate the plan, generate the tracking, view the status, repair it when it breaks — with the mechanical work done by a deterministic script.
sidebar:
  order: 16
---

Run `bmad-sprint-planning` at the boundary between planning and implementation. It answers three questions with one skill: is this plan actually buildable (the readiness gate), what work exists and where does it stand (`sprint-status.yaml` generation), and where are we now (the status view). It also validates and repairs the tracking file itself. Say "check implementation readiness", "run sprint planning", "show sprint status", "validate sprint status", or "fix sprint status" — the skill detects which you want.

## Why one skill

`sprint-status.yaml` is the single tracking artifact the whole dev cycle reads and writes — build syncs story statuses into it, code-review moves stories through review, the retrospective appends action items to it. Everything that *creates* or *summarizes* that artifact now lives in the skill that owns it. Gating, generating, and viewing were previously spread across three skills (`bmad-check-implementation-readiness`, `bmad-sprint-planning`, `bmad-sprint-status`); consolidation means one owner, one status vocabulary, and no drift between what the gate checks and what the tracker builds.

## The readiness gate

Before any tracking exists, the skill judges the plan like a skeptical senior developer reading a handoff. It inventories whatever planning artifacts the project actually has — briefs, PRFAQs, PRDs, specs, UX outputs, architecture, epics — identifying documents by reading them, not by filename patterns. Then it asks one question: **could a developer implement these epics without inventing decisions nothing records?**

The verdict is `PASS`, `CONCERNS`, or `FAIL`. Concerns are listed and you choose whether to proceed; a fail stops the workflow with findings ordered by severity, each naming the skill that fixes it. A missing document type is only a finding if stories depend on it — a project with no UX artifact and no UI stories is fine.

The `IR` trigger on the Product Manager's and Architect's menus runs this gate.
