# Methodology Compliance Audit — 2026-07-30

> ⚠️ **2026-08-05 — `graphify` was removed from this project.** Any instruction below that names it, `graphify-out/`, `/graphify` or `check-graph-fresh` is a **record of what was done at the time**, not something to run. The live equivalents are:
> `python scripts/memsync.py` (ingest, delta by content hash) · `--query "<text>"` / `--tool <name>` (search) · `python scripts/memenrich.py` (embeddings, never blocking) · `node scripts/check-memory-fresh.mjs` (the gate). See discipline §10.11–§10.13.


**Scope:** actual practice as recorded in artifacts (git history, `.superpowers/sdd/`, `docs/superpowers/{specs,plans}/`, `docs/analysis/`, configs) audited against `docs/process/development-discipline.md` (§1–§12), `CLAUDE.md`, and the two project skills. The auditor cannot read past conversations; items verifiable only from conversation are marked **owner-attested** and are included because the owner supplied them as seed evidence — they were checked for artifact corroboration, not assumed.

**Verdict scale:** COMPLIED · PARTIAL · DRIFTED · NOT-DONE.

---

## 1. §3 DoD gate on releases — PARTIAL (strong core, one severe lapse)

**Rule (§3.2/3/8/12):** *"RED witnessed... Output pasted"* · *"Full suite green... Output pasted"* · *"Visual evidence... 390×844... actually looked at"* · *"Hebrew check... Screenshot."*

**Evidence, compliant side:**
- `06fc954` (v274): *"cook-measure RED/GREEN witness 12/12 OK exit 0; python build.py Guard-A OK + Guard-B OK; npx playwright test → 801 passed (2.4m), plain run, no retries/workers overrides."*
- `58975e1` (v277): *"Guard-A OK (1535 keys) + Guard-B OK + Guard-C OK; npx playwright test → 816 passed (2.7m), plain run, no overrides."*
- `.superpowers/sdd/e1-task-1-report.md`: RED witnessed per-assertion with pasted Playwright output and the *reason* for each failure — textbook DoD 2.
- `.superpowers/sdd/e3-phase-gate-verdict.md`: independent gate agent, audited **against the spec, not the ledger**, access rule honored (did not read progress.md/reports), verbatim spec lines in a requirements table. Textbook §3 per-phase gate + §7.
- 390×844 screenshots exist in volume (`mockups/*-390x844.png`, `task-7-dod8-unconfigured-no-clash.png`, `task-2-ltr-island-390x844.png`).

**Evidence, drifted side — the v267 rendered-DOM failure (owner-attested, artifact-corroborated):**
The v267 localization claim ("~99% translated", "ready to test") was measured on **proxy metrics** (key coverage + bundle strings), while real fr/de/es/it screens were ~half English. The owner caught it on screen. Corroboration: `docs/analysis/2026-07-26-v267-ui-audit-phase1.md` and `d20e59f` ("full-localization design spec + **v267 real-UI audit report**") exist precisely to repair this; memory file `verify-rendered-not-metric.md` records the sequel (v269/v270 data-value + shell leak layer). This is the exact failure the project's own skill `verify-against-the-runtime-path` was written to prevent — *"measure at the consumer's input, not at any intermediate"* — violated by the controller a second time after the skill existed.
**Cost:** three follow-up releases (v268–v270) plus an owner-run QA cycle to discover what a single rendered-DOM measurement would have shown before the claim; owner trust burned on a "done" that wasn't.

**Internal contradiction found (nobody noticed):** §9 settled decisions says *"FULL suite ×2 per task. Runtime cost accepted"* while DoD 12 says *"Run once; if 100% green, the gate is met (owner decision 2026-07-21, superseding ×2)"* — and the memory note `testing-discipline.md` records later owner feedback: *"run suite twice, BEFORE shipping."* Practice is mixed: v274/v277 ship on one run; the E3 phase gate ran *"twice on an idle machine (pre-disclosed)."* The document contradicts itself and the newest owner instruction is only in private memory, invisible to subagents. **Cost:** every ship gate is interpretable; an intermittent flake can pass a single-run ship. Needs one owner ruling written into §3/§9.

## 2. §4 Waiver Gate — COMPLIED (post-equipPlan)

**Rule:** *"A plan may never waive, defer, or reinterpret a requirement from an approved spec... raised with the owner in conversation."*

No silently-waived approved-spec requirement found after the original `equipPlan` incident. Positive evidence:
- E3 plan Task-5 precondition quoted and honored by the gate agent: *"If E2 is not closed when T1–T4 finish, the phase gate runs on T1–T4 with T5 documented PENDING — do not improvise around the dependency"* → verdict CONFORMING-PENDING, not a silent drop (`e3-phase-gate-verdict.md`).
- `docs/analysis/2026-07-27-gap-closing-BIG-STATUS.md` (`b578859`, owner-requested) surfaces every waived/deferred gap explicitly (e.g. F-23 waived with the review-finding rationale and *"flag if owner wants it"*); bands G/H deferrals are owner scope decisions.
**Keep:** the registered-work-item pattern (`registered-2026-07-25-*.md`) — deferrals written down AND anchored to an owner conversation, exactly what §4 demands. But see §5: registering is not executing.

## 3. §1/§2 pipeline (brainstorm → spec → plan → SDD → review) — COMPLIED, one near-miss

- 15 specs and 17 plans in `docs/superpowers/{specs,plans}/`; plans follow specs (`33aa4e7` "plan(i18n): ... from approved spec"; `40cc204` "design v3 — hardened through 5 review passes").
- SDD executed with per-task fresh agents: ~40 task reports + ~70 `review-*.diff` packages in `.superpowers/sdd/` — per-task review is real, not ceremonial.
- Owner approval loops visible in git: `2f28229` "owner approves the full method vocabulary, all equipment, re-tagging"; `DECISION-REGISTER`/`OWNER-DECISIONS` docs.
- **Near-miss (owner-attested, artifact-corroborated):** the first CP2 plan was generated by asking an LLM to concatenate ~237k chars; it **silently truncated** and Tasks 6–10 had zero code blocks — caught just before presentation. Corroboration: `53777af` "assemble the **rebuilt** CP2 plan (10 tasks, **code-complete**)" + `56e727e` "review Tasks 1-6 + apply all surviving fixes". The writing-plans requirement (*"EXACT code in each step"*) held only because of a late manual check. **Cost:** hours; one step from dispatching implementers against empty tasks. **Gate to add:** any generated plan gets a mechanical completeness check (per-task code-block count > 0) before review.

## 4. §10.13/§10.17 tool discipline (graph/serena before grep) — DRIFTED

**Rule:** *"Reach for the graph BEFORE grepping"* · *"Maximize the use of Serena for code work."*
The owner corrected the controller **twice** for grepping where serena/graphify was the mandated tool (owner-attested; institutionalized in memory `tool-discipline-serena-graphify.md`: *"owner feedback (repeated)"*). A rule that needs the same correction twice is not being followed, it is being reminded. **Cost:** owner attention spent policing a written rule; on a ~1MB `app.js`, text-grep answers are exactly the evidence class that produced the 42 refuted findings (16%) in the 2026-07-22 sweep.

## 5. Module extraction — registered, then never executed — DRIFTED

**Rule (registered doc, anchored to equipment spec §2.7):** *"Every re-architected pillar leaves app.js into its own source file... app.js shrinks by attrition."*
**Facts:** `docs/analysis/program/registered-2026-07-25-appjs-modularization.md` names candidates (ORCH/NAV/VOICE/AI/I18N). Since then: E2, E3, CP1, v268-localization (a full re-architecture of the i18n pillar — a named candidate), CP2 planning — and **zero further extractions**. `equipment.js` = 34,662 bytes; `app.js` = **1,046,429 bytes**. The extraction rule’s own trigger — *"a pillar is extracted when a programme phase re-architects it — extraction is part of that phase's plan"* — fired at least once (I18N, v268) and was not honored; the v268 plan shipped 12 tasks inside `app.js`.
**Cost:** compounding — every future edit, review diff, merge, and serena LSP pass pays the monolith tax; the "generalize build.py at the SECOND extraction" step is indefinitely deferred, so the seam design is untested beyond n=1.
**Registered-roadmap inventory:** `registered-2026-07-25-appjs-modularization.md` — **registered, binding principle, NOT executed** (this section). `registered-2026-07-25-order-vocabulary.md` — registered, explicitly *"sequencing is the owner's call once E4 lands"* → holding compliantly; E4 not landed. No other `registered-*` files exist.

## 6. External-proposal analysis depth — DRIFTED, then recovered

First panel on the external v5.0 rules-engine proposal audited its illustrative numbers and missed its concepts (owner-attested). The recovery is in the history itself: `a58e166` "six-expert analysis" → owner pushback → `a2c8535` *"second v5.0 panel — read for CONCEPTS; **owner was right, we have real gaps**"*. **Cost:** a full re-run of a six-expert panel; the first pass's defensive posture (auditing the messenger's arithmetic instead of the message) is the same failure shape as L16 — trusting the artifact-level reading over the substance. **Kept honest:** the second-panel commit admits the error in the permanent record — that is the right way to be wrong.

## 7. Subagent operations (§10.5 vs §11a prudence) — DRIFTED

Two owner-attested incidents, both consistent with §10.5 (*"maximize subagent usage"*) read without §11a's load discipline:
- **Over-bundling:** three independent bug fixes bundled into one long-running subagent (wave reports `bug1-wave-a/bug2-wave-b/bug3-wave-c` exist); owner had to ask *"why so long?"*. Independent work should have been three parallel dispatches — `dispatching-parallel-agents` exists for exactly this.
- **Fan-out wedge:** ~50 agents / 25 concurrent wedged the machine and returned unreliable partials — the same lesson §11a already teaches for suite runs (*"the local worker count assumes an idle machine"*) applied to agents instead of workers, relearned at full price. Prior 529-killed audit runs are the same class.
**Cost:** wall-clock waste, unreliable partial data that had to be redone, and a wedged workstation. **Gate to add:** a concurrency ceiling for agent fan-out, written into §10.5, exactly as workers are pinned in `playwright.config.ts`.

## 8. §10.6 three-part summaries — PARTIAL (artifact-limited)

Conversation-borne, so only indirectly auditable. The **LEFT-UNTIL-THE-GRAND-FINAL** part demonstrably decayed: the programme burn-down was produced as a one-off, **owner-requested** report (`b578859` BIG STATUS, 2026-07-27: 16 closed / 11 partial / 14 waived / 100 open of 141) rather than appearing routinely — §10.6's own rationale (*"without the third part a long programme reads as an unbounded run of green ticks"*) describes precisely why the owner had to ask. **Cost:** the owner discovering programme position by demanding a report instead of receiving it every step.

## 9. §10.16 lessons banked per arc — DRIFTED (the quietest, most expensive drift)

**Rule:** *"write its lessons into the Lessons log (§11)... Untracked lessons get relearned at full price."*
The §11 log **ends at L22 (2026-07-24)**. Every failure since lives only in the assistant's **private memory**, which subagents never inherit (the exact gap L16 documented): v267 proxy-metric claim (`verify-rendered-not-metric.md`), the token-cap truncation bug (`ai-never-cap-tokens.md` — became policy + release v271 but no L-entry), fan-out wedge, over-bundling, the CP2 truncation near-miss, "fight for the goal / ask before final". Meanwhile owner *instructions* did keep landing in the doc (§10.19–§10.21, 2026-07-26) — so the doc is maintained, but the failure→lesson channel specifically stopped. **Cost:** CLAUDE.md's own premise — *"subagents inherit CLAUDE.md but do not inherit conversation memory"* — means every dispatched agent since 7-24 works blind to five paid-for lessons. Graphify-global deposits: last global write 2026-07-26 03:01; the 7-27→7-30 v5-engine research arc has no visible deposit pass.

## 10. §10.12 local graph currency — DRIFTED

**Rule:** *"Update the local graphify graph whenever a document is added or changed... At minimum, before git push. Always --mode deep."*
Last graph refresh: `2c96385` **2026-07-25**. Since then **53 documents** changed/added and were pushed (v268 spec+plan, the whole `docs/research/v5-engine/` decision arc, BIG STATUS, HANDOVER, REMAINING-WORK-2026-07-30, this discipline file itself — §10.19–§10.21 are not in the graph). The doc's own warning applies verbatim: *"a stale map is trusted and wrong."* **Cost:** §10.13 tells everyone to query the graph before grepping — and right now the graph does not know the current planning arc exists; every graph-first query into recent work returns confident staleness. (Honest note: the doc records this failure mode happening once before — *"six agent reports were committed and pushed WITHOUT ever updating the graph"* — it recurred.)

## 11. §10.17a single shared Serena server — COMPLIED

Wired 2026-07-24, same day as the instruction: `da9a3c9` "chore(serena): §10.17a single shared server — streamable-HTTP, .mcp.json URL form, start script". `.mcp.json` today: `{"serena": {"type": "http", "url": "http://127.0.0.1:9121/mcp"}}`. Config-level verification only (runtime single-process check not repeatable in audit), but the seed question "ever wired?" — yes, and promptly.

## 12. §10.10 live verification — PARTIAL

**Compliant practice is real:** `progress.md` 2026-07-27: *"RUSSIAN SHIPPED v273 + LIVE-VERIFIED... LIVE: Говядина/Брискет/🇺🇸 Мемфис/'30 минут' render"*; `release-262-live.png` exists. **Two gaps:**
- One release shipped without the controller's own live verification when browser tooling broke (owner-attested); §10.10 has no fallback path (e.g. curl-probe of `.foot-stamp` + feature string) written for that failure mode.
- **Co-Authored-By model names are inferred, not verified:** 245 commits say `Claude Opus 4.8 (1M context)`, 84 `Claude Fable 5`, 12 `Claude Opus 5`. "Opus 4.8 (1M context)" matches no verified model identity; the trailer is a factual claim in the permanent record, generated by guesswork. Small per-commit, but it is exactly the *"being wrong is worse than being silent"* class from the Reporting rule.

## 13. §11a testing infrastructure — COMPLIED (current practice)

- Pause/resume for the translation GPU queue was built **specifically** to serialize heavy load against suite runs (`a1d63a9`; progress.md: *"pause → free GPU → run Playwright suite... (§11a) → resume"*).
- The E3 phase gate **declined** to re-run the suite on a busy machine (*"Not re-run per the machine-serialization rule"*) — the rule being obeyed even when it was inconvenient.
- `sweep-logs/w24.log` (24-worker mass-fail run, 2026-07-24) belongs to the documented M1b curve-probe campaign, not to an undisciplined concurrent run. No artifact evidence of racing suite runs after 2026-07-24.

## 14. §5 3-fix rule / systematic-debugging — COMPLIED (recent record)

Debug reports exist as first-class artifacts (`e2-witness-debug-report.md`, `e3-validity-debug-report.md`); the Russian-gate diagnosis in progress.md is evidence-first (failure classes counted from `ru.failed.json` before any fix). L22's boundary-instrumentation method visibly changed behavior after 7-24. No post-7-24 fix-churn incident found in artifacts.

---

## Summary of what to KEEP (working as designed)

1. **Independent phase-gate agents audited against the spec** (`e3-phase-gate-verdict.md`) — the strongest single artifact in the repo.
2. **RED-witness discipline with pasted output** in task reports and release commit bodies.
3. **Registered-work-item pattern** for owner-anchored deferrals.
4. **Admitting error in the permanent record** (`a2c8535` "owner was right").
5. **§11a serialization discipline** incl. purpose-built pause/resume.
6. **Build guards (A/B/C/D)** as un-skippable mechanical gates.

## The five fixes this audit argues for (worst first)

1. **Backfill §11:** write L23–L27 (v267 proxy-metric, token-cap, fan-out wedge, over-bundling, CP2 truncation) into the discipline doc so subagents inherit them. One session, high leverage.
2. **Refresh the local graph** (`--mode deep`, word-budget chunking) — 53 docs behind — and run the §10.16 deposit pass for the v5-engine research arc.
3. **Owner ruling on suite ×1 vs ×2 at ship**, written into §3/§9, resolving the doc's self-contradiction and the memory-only "twice before shipping" instruction.
4. **Schedule the second module extraction** (I18N or NAV per the registered roadmap) as a real phase task — or have the owner explicitly re-time the roadmap; today it is drifting, not deferred.
5. **Write the agent-concurrency ceiling and plan-completeness check** (per-task code-block count) into §10.5 / writing-plans usage — both incidents were single-point process gaps, not judgment failures.
