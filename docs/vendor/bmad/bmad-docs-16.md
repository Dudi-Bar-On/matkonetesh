---
name: bmad-docs-16
description: "BMAD (multi-agent methodology: bmm/wds/...) — vendor doc 16/30 (raw.githubusercontent.com)"
type: reference
---

## Deterministic where it should be

Parsing epic files, deriving story keys, ordering entries, merging with an existing status file, and counting statuses are not judgment calls — so they aren't done by inference. A script inside the skill (`sprint_plan.py`) owns them:

- **`generate`** parses `## Epic N:` / `### Story N.M: Title` headings into kebab-case keys (fenced code blocks ignored, non-Latin titles keep their characters), orders each epic with its stories and retrospective entry, and merges against any existing file: advanced statuses are preserved, never downgraded; legacy v6 values (`drafted`, `contexted`) are normalized to their modern meaning rather than reset; retrospective `action_items`, custom keys, and hand-written comments pass through untouched; and `project_key`/`tracking_system`/`story_location` are kept from the existing file unless explicitly overridden. A story file already on disk floors its status at `ready-for-dev`. `--dry-run` doubles as the drift report (`in_sync`, new entries, orphans with their old statuses, illegal values) without writing. Writes are atomic and validated, with the original restored on failure.
- **`status`** computes counts, risk flags (stale file, orphaned stories, in-progress epics with no stories, stories waiting in review, unrecognized keys), open action items, and the next recommended action by fixed priority: resume in-progress → review what's waiting → start the next ready story → start the first backlog story → run an open retrospective → done.
- **`validate`** reports whether the file is structurally sound — recognized keys, legal statuses, well-formed action items, parseable timestamps — without writing.

The LLM keeps the parts that need judgment: deciding which files are epics, weighing readiness, and reconciling what the script flags — unparsed headings, orphaned entries whose old status now rides along in the report so a rename can be transplanted with `--set`. And if a hand-edited file defeats the script entirely, the skill falls back to reading it directly and giving you a best-judgment summary, telling you the deterministic path failed and offering the fix flow.

## Repair

"Fix sprint status" rebuilds a broken or drifted tracking file to a pristine state. The order matters: inference first, confirmation second, script last. Subagents fan out over the evidence — epic files for the work breakdown, story files and git history for what actually got built, the current file for anything salvageable — and reconcile it into one proposed state table. Nothing is written until you confirm that table. Then a single `generate --fresh --set key=status ...` run produces a clean, canonical file, and `validate` confirms it. The `--set` path is deliberately the only one allowed to downgrade a status: repair reflects confirmed reality, not the never-downgrade merge rule.

## The status view

"Show sprint status" skips the gate and renders the script's summary: counts, risks, open action items from retrospectives, and one recommended next action with its story key. No time estimates — status, risks, and next steps only. Legacy status values from older files (`drafted`, `contexted`) are mapped transparently and reported.

## Migration notes

- `bmad-check-implementation-readiness` has been removed; the `IR` agent menu trigger forwards here.
- `bmad-sprint-status` is now a deprecation shim that forwards here with status-view intent. Migrate any `_bmad/custom/bmad-sprint-status.toml` overrides to `_bmad/custom/bmad-sprint-planning.toml`.
- The output format of `sprint-status.yaml` is unchanged — build's sprint sync and the retrospective tooling read and write it exactly as before.


<!-- source: docs/explanation/web-bundles.md -->

---
title: 'Web Bundles'
description: BMad skills packaged for Google Gemini Gems and ChatGPT Custom GPTs
---

Run the planning side of BMad in your web LLM subscription, then bring the artifacts into your IDE.

## What is a Web Bundle?

A web bundle is a BMad skill repackaged for installation as a **Google Gemini Gem** or **ChatGPT Custom GPT**. Each bundle includes a `SKILL.md` protocol you upload as a knowledge file, an `INSTRUCTIONS.md` block you paste into the Gem or GPT instructions, and any data files the skill needs (CSVs, templates, validation checklists, additionally progressively disclosed content). The persona lives in the pasted instructions; the protocol lives in the knowledge file. Swap personas without touching the protocol.

Setup is not one-click, but the steps are guided. **Install from [bmadcode.com/web-bundles](https://bmadcode.com/web-bundles/)**. The site lists every bundle in a card grid, shows you the Gemini and ChatGPT install steps inline, and hands you the ZIP download. That is the supported install path; the pattern is the same across the shelf, so once you've installed one the next one is mechanical.

V4 of BMad shipped web bundles. V6 brings them back, rewritten for the current Gem and Custom GPT platforms with Canvas, Deep Research, and image generation in mind.

## Why use them

Planning work and implementation work want different tools. Web bundles let each use the right one.

| Concern | Web LLM (Gem or GPT) | IDE (Claude Code, Cursor) |
| --- | --- | --- |
| Cost model | Flat-rate subscription | Metered tokens |
| Strongest at | Conversation, Canvas, Deep Research, images | Files, terminal, codebase context |
| Best for | Brainstorming, briefs, PRDs, research | Implementation, refactoring, code review |

Running a full PRD or market research conversation in an IDE burns tokens that a Gem or Custom GPT handles for the price of your existing subscription. The polished artifact then drops into your repo and Claude Code or Cursor takes it from there.

:::tip[Plan in the web, build in the IDE]
The cost saving compounds on longer engagements. A PRFAQ pass and three rounds of research in a Gem cost zero marginal dollars; the same work in an IDE is real spend.
:::

## What's in the shelf

The current set of bundles covers the analysis and planning phases:

| Bundle | Phase | Persona lineage |
| --- | --- | --- |
| Brainstorming Coach | Analysis | Osborn (default), Minto (swap) |
| Product Brief Coach | Analysis | Mary (BMad analyst) |
| PRFAQ Coach | Analysis | Working Backwards (Bezos) |
| PRD Coach | Planning | Cagan |
| UX Coach | Planning | Norman |
| Market & Industry Research | Analysis | Porter and Christensen |

Each bundle carries a default persona inherited from its owning BMad agent (where one exists) and a contrasting swap example to demonstrate the voice change pattern.

## How a session works

1. **Open the Gem or Custom GPT.** Persona greets in character and opens conversational discovery.
2. **Discover scope.** The persona asks what you're trying to do, what you have on hand, what constraints apply. No form fill.
3. **Do the work in Canvas.** The protocol opens Canvas at session start and updates it continuously. Mermaid diagrams and HTML tables go in alongside the prose.
4. **Hand off.** When you're done, you have a Canvas document you can export, paste into your repo, or feed to a BMad skill in your IDE for the next phase.

For bundles that integrate Deep Research (currently Market & Industry Research), the persona drafts a Deep Research brief mid-session for you to paste into Gemini's or ChatGPT's Deep Research mode, then ingests the returned report.
