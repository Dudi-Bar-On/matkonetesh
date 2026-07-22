# Discovery Sweep — the 47 tools, their wave, and their status

**Date:** 2026-07-22 · Companion to `2026-07-22-discovery-sweep-roster.md` (which defines each tool's
mission) and `sweep/README.md` (which indexes the reports).

**Why this document exists.** The roster was written before Wave 5 existed, so it describes Waves 1–4
only. The per-tool wave number and status was reported to the owner in conversation and never
persisted. A fact that lives only in a chat log is a fact the next session loses.

**Honesty note on attribution.** The dispatch records tie each *agent* to its report, and the roster ties
each *tool* to its axis. The tool→agent mapping below is reconstructed from the roster's axis structure
plus each report's own content. Rows marked **(inferred)** are ones where the tool's output is visible in
a report but the dispatch did not name the tool explicitly. No row claims an output that does not exist
in a committed file.

**Result summary: 47 tools assigned · 47 operated · 27 agents · 27 reports · 0 tools dropped.**

---

## Axis 1 · Documents (2 tools) — Wave 1

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 1 | `superpowers:dispatching-parallel-agents` | 1 | *(process, all reports)* | ✅ operated — governed the whole wave structure |
| 2 | `audit-context-building` | 1 | `sweep/README.md` | ✅ operated — corpus map, no document read twice |

## Axis 2 · Code, line by line (5 tools)

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 3 | `vibe-code-auditor` | 1 | `W1-A-code.md` | ✅ operated |
| 4 | `production-code-audit` | 1 | `W1-A-code.md` | ✅ operated |
| 5 | `find-bugs` | 5 | `W5-C-second-opinion.md` | ✅ operated (inferred) |
| 6 | `clean-code` | 5 | `W5-C-second-opinion.md` | ✅ operated (inferred) |
| 7 | `error-handling-patterns` | 1 | `W1-A-code.md` | ✅ operated — re-scoped to network/API failure |

## Axis 3 · Spec ↔ code conformance (2 tools)

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 8 | `spec-to-code-compliance` | 1 | `W1-B-conformance.md` | ✅ operated — 6 specs, clause by clause |
| 9 | `comprehensive-review:full-review` | 5 | `W5-C-second-opinion.md` | ✅ operated (inferred) |

## Axis 4 · The running app, via Playwright (3 tools)

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 10 | `webapp-testing` | 1 | `W1-C-app-walkthrough.md` | ✅ operated — every screen, HE + EN, 390px |
| 11 | `chrome-devtools:lighthouse_audit` | 5 | `W5-A-measured.md` | ✅ operated — Lighthouse 13.4.0 / axe-core 4.12.0 |
| 12 | `chrome-devtools:a11y-debugging` | 5 | `W5-A-measured.md` | ✅ operated |

## Axis 5 · Non-functional properties (4 tools)

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 13 | `i18n-localization` | 1 | `W1-D-nonfunctional.md` | ⚠️ operated — **produced the sweep's worst false alarm** (see below) |
| 14 | `accessibility-compliance-audit` | 5 | `W5-A-measured.md` | ✅ operated |
| 15 | `progressive-web-app` | 1 | `W1-D-nonfunctional.md` | ✅ operated — re-scoped to installability + update delivery |
| 16 | `web-performance-optimization` | 5 | `W5-A-measured.md` | ✅ operated — measured, not inferred |

## Axis 6 · Food & domain science (7 tools) — Wave 1

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 17 | `fda-food-safety-auditor` | 1 | `W1-E-food-safety.md` | ✅ operated — HACCP mapping |
| 18 | `pubmed-database` | 1 | `W1-E-food-safety.md` | ✅ operated |
| 19 | `citation-management` | 1 | `W1-E-food-safety.md` | ✅ operated — 279/279 citation chain verified |
| 20 | `scientific-writing` | 1 | `W1-E-food-safety.md` | ✅ operated |
| 21 | `quality-nonconformance` | 3 | `ULTIMATE` (synthesis verdict) | ✅ operated — supplied the "one nonconformance in many costumes" frame |
| 22 | `data-quality-frameworks` | 1 | `W1-E-food-safety.md` | ✅ operated — recipe-data integrity |
| 23 | `deep-research` + `exa-search`/`tavily-web` | 1 | `W1-E`, `W1-H`, `W5-D` | ✅ operated — sous-vide + every technique, per owner instruction |

## Axis 7 · UI / UX (5 tools) — Wave 5

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 24 | `mobile-design` | 5 | `W5-B-ux.md` | ✅ operated |
| 25 | `ui-visual-validator` | 5 | `W5-B-ux.md` | ✅ operated — screenshot validation |
| 26 | `ui-ux-pro-max` | 5 | `W5-B-ux.md` | ✅ operated (inferred) |
| 27 | `web-design-guidelines` | 5 | `W5-B-ux.md` | ✅ operated (inferred) |
| 28 | `ui-ux-designer` | 5 | `W5-B-ux.md` | ✅ operated (inferred) |

## Axis 8 · AI (6 tools) — Wave 1

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 29 | `ai-agents-architect` | 1 | `W1-F-ai.md` | ✅ operated |
| 30 | `ai-product` | 1 | `W1-F-ai.md` | ✅ operated — 11 AI features reviewed |
| 31 | `llm-evaluation` + `agent-evaluation` | 1 | `W1-F-ai.md` | ✅ operated |
| 32 | `prompt-engineering` / `llm-prompt-optimizer` | 1 | `W1-F-ai.md` | ✅ operated |
| 33 | `llm-structured-output` | 5 | `W5-D-api-docs.md` | ✅ operated (inferred) |
| 34 | `api-security-testing` | 1 | `W1-F-ai.md` | ✅ operated — found the Worker fail-open |

## Axis 9 · Workplan & workflows (owner-added) — Wave 1

Covered by composition; the tools are re-points of ones already counted above, so they add no new number.

| Tool (re-pointed) | Wave | Report | Status |
|---|---|---|---|
| `production-code-audit` → workplan paths | 1 | `W1-G-workflows.md` | ✅ operated |
| `visual-documentation:flowchart-creator` | 5 | `W5-E-diagrams.md` | ✅ operated — 4 mermaid diagrams, every node carries `file:line` |
| `spec-to-code-compliance` → workplan | 1 | `W1-G-workflows.md` | ✅ operated |
| `webapp-testing` → real flows | 1 | `W1-G-workflows.md` | ✅ operated |

## Axis 10 · Probes & sous-vide telemetry (owner-added) — Wave 1

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 35 | `deep-research` + `context7-auto-research` | 1 | `W1-H-probes.md` | ✅ operated — Web Bluetooth feasibility |
| 36 | `exa-search` / `tavily-web` | 1 | `W1-H-probes.md` | ✅ operated — Meater / ThermoWorks / Inkbird / Combustion |
| 37 | `api-documentation` | 5 | `W5-D-api-docs.md` | ✅ operated — **overturned W1-H on Anova** (licence-blocked) |

## Axis 11 · Synthesis & gates (4 tools)

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 38 | `code-documentation:docs-architect` | 3 | `2026-07-22-ULTIMATE-knowledge-and-gaps.md` | ✅ operated — the 148 KB synthesis |
| 39 | `visual-documentation:architecture-diagram-creator` | 5 | `W5-E-diagrams.md` | ✅ operated |
| 40 | `superpowers:verification-before-completion` | **2** | 8 × `VERIFY-*.md` | ✅ operated — **the highest-value tool in the sweep**, see below |
| 41 | `superpowers:writing-skills` | 3 | `process/skills/verify-against-the-runtime-path/`, `no-inert-shipment/` | ✅ operated — 2 reusable skills produced |

## Business (6 tools) — Wave 4, deliberately last

Sequenced after discovery because pricing depends on knowing what exists and what it costs to run.

| # | Tool | Wave | Report | Status |
|---|---|---|---|---|
| 42 | `startup-financial-modeling` | 4 | `W4-A-unit-economics.md` | ✅ operated — measured **$0.0381/action** |
| 43 | `pricing-strategy` | 4 | `W4-B-pricing.md` | ⚠️ operated — **priced on $0.0035, wrong by 10.9×** (see below) |
| 44 | `paywall-upgrade-cro` | 4 | `W4-B-pricing.md` | ✅ operated |
| 45 | `startup-business-analyst-market-opportunity` | 4 | `W4-C-market.md` | ✅ operated — TAM/SAM/SOM |
| 46 | `competitive-landscape` | 4 | `W4-C-market.md` | ✅ operated |
| 47 | `product-manager` | 4 | `2026-07-22-business-model.md` | ✅ operated — tiering synthesis |

---

## Waves as actually run

| Wave | What | Agents | Output |
|---|---|---|---|
| 1 | Discovery — axes 1–6, 8–10 | 8 | `W1-A` … `W1-H` |
| 2 | **Adversarial verification** | 8 | `VERIFY-W1-A` … `VERIFY-W1-H` |
| 3 | Synthesis | 1 | `ULTIMATE-knowledge-and-gaps.md` |
| 5 | The 12 unassigned tools — measurement, UX, second opinion, API docs, diagrams | 5 | `W5-A` … `W5-E` |
| 4 | Business — chained after Wave 5 | 3 | `W4-A/B/C` + `business-model.md` |
| — | Knowledge graph over `docs/` | 2 | `W1-GRAPH-docs.md` |

Wave 5 was created after the roster was written, which is why the roster does not mention it: the owner
asked for the 12 tools that no Wave 1 agent had carried to run as their own wave, chained ahead of
business. Numbering is historical — Wave 5 ran **before** Wave 4.

## The two tools whose status is not a plain ✅

**#40 `verification-before-completion` earned the whole sweep.** It refuted **42 of 261 adjudicated
findings — 16%**. Every refutation had one shape: a grep, a quote, or a single artifact trusted without
tracing the runtime path. Without Wave 2 the sweep would have delivered 42 confident errors as fact.

**#13 `i18n-localization` produced the sweep's worst false alarm.** It reported "55 of 56 toasts
untranslated" after checking `lang/en.json` alone. The real lookup path also reads `lang/en.data.json`;
the true number of missing toasts is **0 of 53**. Two things make this the worst one: `W1-B` independently
got it right *by running the app in English*, and I repeated the error to the owner after checking only
one more file instead of tracing the path. It is the origin of the
`verify-against-the-runtime-path` skill.

**#43 `pricing-strategy` is wrong by 10.9×.** It priced $0.0035/action against `W4-A`'s measured
$0.0381, because it omitted the $0.035 grounded-search fee. The knowledge graph now carries this as an
explicit `refutes` edge. **Correct this before any pricing decision is taken.**
