# Discovery Sweep — tool roster & missions

**Date:** 2026-07-22 · **Owner-approved.** Purpose: a maximal, evidence-based sweep over every document, every line of code, the running app, and the domain science — producing an "ultimate knowledge & gaps" document complementary to `2026-07-22-status-and-gaps.md`, before the gap-closing program (Option A) begins.

**Selection method:** 1,308 antigravity skills + 14 superpowers + workflow collections were searched by capability description, not by memory. Irrelevant families (Kubernetes, AWS/cloud pen-testing, blockchain, React/Next specialists, the six health analyzers) were excluded deliberately.

**Two structural safeguards, non-negotiable:**
1. **Adversarial verification wave.** Every finding is re-checked against code or a primary source before it enters the final document. *Two of three document auditors on 2026-07-21 produced a false safety alarm* (see `2026-07-22-status-and-gaps.md` §0). A bigger sweep without this simply produces more confident errors.
2. **No claim without evidence.** A finding cites `file:line`, a test name, or a primary source. Unverifiable claims are dropped, not softened.

**Standing product correction (2026-07-22):** the app is **no longer offline-first**. Online + AI key is the model, and online matters *more* than offline. The shipped README still says *"הנתונים מקומיים, ללא חיבור לרשת"* — a live document-vs-decision conflict the sweep must flag, not preserve.

---

## Axis 1 · Documents (2)
| Tool | Mission |
|---|---|
| `superpowers:dispatching-parallel-agents` | Fan-out discipline for the whole sweep — wave structure, no duplicated reading |
| `audit-context-building` | Build the shared corpus map so no document is read twice or missed |

## Axis 2 · Code, line by line (5)
| Tool | Mission |
|---|---|
| **`vibe-code-auditor`** | Audit AI-produced code for structural flaws, fragility, production risk. **Highest-signal tool here**: this codebase is largely AI-written, and the entire refactoring report exists because AI-written features shipped *inert* |
| **`production-code-audit`** | Autonomous line-by-line scan of ~9,000-line `app.js` — architecture, patterns, dead code, duplicated logic |
| `find-bugs` | Defect and vulnerability sweep |
| `clean-code` | Quality, naming, structure, function size |
| `error-handling-patterns` | Failure paths — **re-scoped to network/API failure** (now the primary failure mode), plus storage quota and SW |

## Axis 3 · Spec ↔ code conformance (2)
| Tool | Mission |
|---|---|
| **`spec-to-code-compliance`** | Verify code implements exactly what the ~12,000 lines of specification state. Written for blockchain audits; the *method* is precisely ours |
| `comprehensive-review:full-review` | Architect + code-reviewer + security-auditor trio over the result |

## Axis 4 · The running app, via Playwright (3)
| Tool | Mission |
|---|---|
| **`webapp-testing`** | Drive **every screen and flow** at 390px, Hebrew **and** English. This axis exists because TTS — a real, substantial feature — was missed by a purely document-driven audit |
| `chrome-devtools:lighthouse_audit` | Objective PWA / performance / accessibility / best-practice scores |
| `chrome-devtools:a11y-debugging` | Real assistive-technology behaviour, not markup inference |

## Axis 5 · Non-functional properties (4)
| Tool | Mission |
|---|---|
| **`i18n-localization`** | Hardcoded strings, locale files, **RTL correctness** — the 18 Hebrew toasts, fr/de/es completeness |
| `accessibility-compliance-audit` | WCAG conformance |
| `progressive-web-app` | **Re-scoped:** installability and update delivery (not offline correctness) |
| `web-performance-optimization` | A 2.6 MB single file loading on a phone at a fire |

## Axis 6 · Food & domain science (7)
**Honest limitation: no culinary-craft skill exists among the 1,308** — nothing for BBQ, smoking, curing, fermentation or butchery. Process expertise is therefore *researched*, not *encoded*: treat craft output as well-sourced research to check against the owner's experience. Everything safety-related traces to primary literature.

| Tool | Mission |
|---|---|
| **`fda-food-safety-auditor`** | FSMA / **HACCP** / PCQI. Near-exact mapping: `bcheck` gates = critical control points, `safe` temps = critical limits, cure dosing = a preventive control |
| **`pubmed-database`** | Boolean/MeSH access to primary literature — pasteurization time–temperature, nitrite limits, *Listeria* / *C. botulinum* thresholds |
| **`citation-management`** | `baldwin-backbone.md` mandates *"every `safe` value must trace to a cited primary source. Never guess."* 279 `src` blocks exist — verify the chain holds item by item |
| `scientific-writing` | Rigorous, cited write-up of the food-science section |
| `quality-nonconformance` | Root-cause / corrective-action discipline |
| `data-quality-frameworks` | Integrity of the recipe data itself — 177 items, temperature ranges, yields, footprints, outliers |
| **`deep-research` + `exa-search`/`tavily-web`** | **Sous-vide and every technique the app uses** — knowledge bases, recipes, craft literature (Baldwin, USDA/FSIS, Modernist Cuisine, AmazingRibs). **Must read our own `data.py`, `sources.py`, `equipment_map.py` and the equipment model** and reconcile them against the literature |

## Axis 7 · UI / UX (5)
| Tool | Mission |
|---|---|
| **`mobile-design`** | Mobile-first, touch-first — a 390px app operated with greasy hands beside a live fire |
| **`ui-visual-validator`** | Visual validation against screenshots — catches the class found by eye (bidi scrambling, clipped tiles, collided labels) |
| `ui-ux-pro-max` | Comprehensive web/mobile design review |
| `web-design-guidelines` | Objective Web Interface Guidelines conformance |
| `ui-ux-designer` | User research and design-system coherence |

## Axis 8 · AI (6) — now central, not an enhancement
| Tool | Mission |
|---|---|
| **`ai-agents-architect`** | Autonomous-but-controllable design — the exact problem for an AI orchestrator proposer gated by `safetyDiff` |
| **`ai-product`** | Product review of the 11 existing AI features; hallucination surfaces |
| **`llm-evaluation`** + **`agent-evaluation`** | How to *measure* grounding, the numeric guard, and refusal behaviour |
| `prompt-engineering` / `llm-prompt-optimizer` | Prompts carrying safety constraints (never alter a number) |
| `llm-structured-output` | The AI-proposer contract — moves must be structured and machine-validated |
| `api-security-testing` | The Worker holds the Gemini key: abuse, rate limits, key exposure |

## Axis 9 · Workplan & workflows — the core loop (owner-added)
**No fitting packaged skill exists** (`workflow-orchestration-patterns` is Temporal; `n8n-workflow-patterns` is n8n — both backend durable-execution, wrong shape). Covered by composition:
| Tool | Mission |
|---|---|
| `production-code-audit` *(re-pointed)* | The workplan/timeline/voice-cook code paths end to end |
| `visual-documentation:flowchart-creator` | Map the **actual** user and data flows as built — plan build, stage generation, placement, task rendering, timers, live cook |
| `spec-to-code-compliance` *(re-pointed)* | Workplan behaviour vs everything specified about it |
| `webapp-testing` *(re-pointed)* | Trace real flows in the browser, not inferred ones |

## Axis 10 · Probes & sous-vide telemetry (owner-added)
**No Bluetooth/IoT skill exists**, and the app has **no probe integration today** — `probeChannels()` merely sums channels into one footer chip; `navigator.bluetooth` appears nowhere. This axis is therefore *discovery and feasibility*, not audit.
| Tool | Mission |
|---|---|
| `deep-research` + `context7-auto-research` | **Web Bluetooth API** capability and browser support; whether a PWA can hold a background BLE connection |
| `exa-search` / `tavily-web` | Vendor realities — Meater, ThermoWorks, Inkbird, Combustion Inc: open APIs, BLE characteristics, cloud APIs, and **log/CSV export formats** as a fallback path |
| `api-documentation` | Model the ingestion contract for probe readings / imported logs |

## Axis 11 · Synthesis & gates (4)
| Tool | Mission |
|---|---|
| **`code-documentation:docs-architect`** | Write the long-form "ultimate knowledge" manual from the codebase and findings |
| `visual-documentation:architecture-diagram-creator` | System and data-flow diagrams |
| **`superpowers:verification-before-completion`** | **The adversarial gate.** Every finding re-verified before publication |
| `superpowers:writing-skills` | Codify recurring lessons as reusable skills |

## Deferred until after discovery — Business (6)
Sequenced deliberately: pricing and tiering depend on knowing which features exist and **what they cost to run**.
| Tool | Mission |
|---|---|
| **`startup-financial-modeling`** | **Insisted upon:** online-AI-first means every user costs real Gemini tokens. Tiers must be modelled against measured consumption or a plan loses money per user |
| **`pricing-strategy`** | Pricing and packaging by value and willingness to pay |
| **`paywall-upgrade-cro`** | In-app paywalls and upgrade flows — subscription levels by feature |
| `startup-business-analyst-market-opportunity` | TAM / SAM / SOM |
| `competitive-landscape` | Differentiation |
| `product-manager` | SaaS metrics and feature-tiering frameworks |

---

## Wave structure
1. **Wave 1 — Discovery.** Axes 1–5 and 7–10 in parallel, each writing findings to its own file under `docs/analysis/sweep/`.
2. **Wave 2 — Adversarial verification.** Every finding re-checked against code or primary source; unverifiable claims dropped.
3. **Wave 3 — Synthesis.** One knowledge-and-gaps document, cross-referenced to `2026-07-22-status-and-gaps.md`.
4. **Wave 4 — Business** (post-discovery, as directed).

**Estimated cost:** 10–18M tokens over several hours. Measured basis: the three document auditors burned 198k / 313k / 263k tokens each.
