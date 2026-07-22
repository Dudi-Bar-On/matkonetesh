# Discovery Sweep — agent reports index

**Started:** 2026-07-22 · **Roster & missions:** `../2026-07-22-discovery-sweep-roster.md`
**Purpose:** a maximal, evidence-based sweep over every document, every line of code, the running app, and the domain science — producing an "ultimate knowledge & gaps" document complementary to `../2026-07-22-status-and-gaps.md`, before the gap-closing program begins.

Each agent writes **its own report file** here. Each agent's **returned summary is also captured verbatim** in `_agent-summaries.md`, because a summary can carry a verdict that the file states differently. Everything is committed and pushed so it survives this session.

## Standing rules every agent works under
1. **Evidence or it does not exist.** Every finding cites `file:line`, a test name, or a real source with a URL.
2. **Drop, do not soften.** An unverifiable claim is removed, never downgraded to a maybe. *Two of three auditors on 2026-07-21 produced confident FALSE safety alarms* (one claimed a 2.5 g cure dose on a 1 g scale warns nobody — the hard warning does fire; one claimed no safety value carries a citation — 279 do, merged from `sources.py` at build). Being wrong is worse than being silent.
3. **No source file is modified.** Discovery only.

## Standing product correction (2026-07-22)
The app is **no longer offline-first**. Online + an AI key is the model, and online matters **more** than offline. The shipped README still says *"הנתונים מקומיים, ללא חיבור לרשת"* — a live document-vs-decision conflict to flag, not preserve.

## Wave 1 — discovery

| Report | Agent | Domain |
|---|---|---|
| `W1-A-code.md` | W1-A | Code line-by-line: architecture map, the inert-shipment failure mode, dead code, duplicated logic, network/API failure paths, worker key safety |
| `W1-B-conformance.md` | W1-B | Spec↔code clause by clause over the largest plans (1,276-line occupancy plan first), plus **contradictions between documents** and orphaned commitments |
| `W1-D-nonfunctional.md` | W1-D | i18n/RTL completeness, PWA installability + update delivery, performance of a 2.6 MB single file, WCAG |
| `W1-E-food-safety.md` | W1-E | HACCP mapping of `bcheck`/`safe`/cure controls, the 279-citation chain verified item by item, claims vs primary literature, recipe-data integrity |
| `W1-F-ai.md` | W1-F | Every AI feature and its guards, hallucination risk on safety numbers, prompt injection, worker security, Hebrew TTS, AI-orchestrator readiness |
| `W1-H-probes.md` | W1-H | Probe/sous-vide telemetry feasibility: Web Bluetooth reality, per-vendor APIs, the iOS blocker, log-import fallback |
| `W1-C-app-walkthrough.md` | W1-C | *(pending)* Full Playwright walkthrough of every screen and flow at 390px, Hebrew and English, plus Lighthouse and a11y |
| `W1-G-workflows.md` | W1-G | *(pending)* The workplan/workflow core loop traced as built |

Browser-driving agents (C, G) run **after** the static agents. Two Playwright instances alongside six analysis agents is exactly the contention that produced 127 phantom test failures on 2026-07-21.

## Wave 2 — adversarial verification
Every finding re-checked against code or a primary source before it enters the final document.

## Wave 3 — synthesis
One knowledge-and-gaps document, cross-referenced to `../2026-07-22-status-and-gaps.md`.

## Wave 4 — business
Deferred until after discovery: pricing and tiering depend on knowing which features exist and what they cost to run in tokens.
