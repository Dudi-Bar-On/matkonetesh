# MASTER ONBOARDING — matconetesh gap-closing programme

> ⚠️ **2026-08-05 — `graphify` was removed from this project.** Any instruction below that names it, `graphify-out/`, `/graphify` or `check-graph-fresh` is a **record of what was done at the time**, not something to run. The live equivalents are:
> `from src.knowledge import retrieval` → `search_current_docs(q, filters=…)` / `semantic_search(q, filters=…)` (query) · `python scripts/ingest.py --scope` (ingest, delta by content hash) · `node scripts/check-geniza-fresh.mjs` (the gate, and it BLOCKS). See discipline §10.11–§10.13. **`agent-memory.db`, `scripts/memsync.py` and `scripts/memenrich.py` were themselves deleted 2026-08-05** — this banner used to point at them, which made its own redirect dead two levels deep.


**Date:** 2026-07-24 · **Purpose:** the one table-driven view for re-onboarding onto the audit corpus, the gap
inventory, the activity arcs since the charter, and the current queue. **This is an INDEX, not new analysis.**
Every row is traceable to a path or a commit. Where a claim required a fresh read against the live repo (not
just a source document), that is marked "verified live, 2026-07-24."

**Reconciliation status: LANDED IN TIME.** `docs/analysis/program/P0-kickoff-brief.md` (commit `4d1a4af`,
current HEAD at assembly time) was already on disk when this document's research started — it is used
throughout as the authoritative status column, not a pre-reconciliation estimate. Where a subsystem or item
falls outside what that brief covers, this document says so explicitly rather than borrowing its authority.

**Sources read in full to build this document:** `CLAUDE.md`, `docs/process/development-discipline.md`,
`docs/analysis/2026-07-22-discovery-sweep-roster.md`, `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`
(all 8 sections), `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md`,
`docs/analysis/graph/GRAPH_REPORT.md` (skimmed per the assignment's own instruction — corpus map only),
`docs/analysis/program/P0-kickoff-brief.md`, `docs/analysis/program/model-selection-architecture-design.md`,
`docs/research/measurements/m1b-capacity-probes-2026-07-23.md`, `docs/research/flake-refactor-rootcause.md`,
`docs/process/serena-first-use.md`, `docs/process/graphify-improvements.md`, plus targeted reads of
`docs/research/gpu-cpu-decision-report.md`, `docs/research/gpu-local-model-integration.md`, and live
`git log` / `playwright.config.ts` / `app.js` checks to confirm claims still hold at HEAD.

---

## Headline callout — the auditor count

**The owner's remembered "47 auditors" does not reproduce from `2026-07-22-discovery-sweep-roster.md` by any
counting method tried.** A direct row-by-row recount of the roster gives:

| Count | What it measures |
|---|---|
| **45** | Tool/mission rows across the **11 active axes** (Axes 1–11) — what Waves 1–3 (Discovery, Adversarial verification, Synthesis) actually ran |
| **51** | The above **+ 6** deferred Business-axis rows (Axis 12, sequenced as **Wave 4**, explicitly "post-discovery, as directed" — not part of the initial dispatch) |
| 38 | Sum of only the axes carrying an explicit header count (Axes 1–8, 11) — excludes the two owner-added axes (9, 10) that have no header number |
| 51 / 57 | Splitting every bundled multi-tool cell (`deep-research + exa-search/tavily-web`, `llm-evaluation + agent-evaluation`, etc.) into individual tool-name mentions — 51 active-axis mentions, 57 including Business |

**None of these is 47.** The likely source of "47" is not the roster at all — it is
`docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md`'s own opening line, *"The 47-tool, 5-wave
discovery sweep (206 confirmed / 42 refuted / 13 unverifiable)."* That sentence is itself imprecise against
its own cited source: the roster's own "Wave structure" section defines **4** waves (1 Discovery · 2
Adversarial verification · 3 Synthesis · 4 Business), not 5, and no grouping of the roster's own rows produces
47. This is a small, low-stakes instance of the exact failure pattern the sweep itself found 42+3 times over
(§1 below, §4.J of the ULTIMATE doc): a summary trusted in place of the artifact it summarizes. **Report the
roster's own numbers — 45 active / 51 total — not the charter's rounded "47," and not the remembered figure.**

---

## §1 · The audit corpus

### 1.1 The roster — waves, axes, composition

Source: `docs/analysis/2026-07-22-discovery-sweep-roster.md`. Selection method: 1,308 antigravity skills +
14 superpowers + workflow collections searched by capability description; irrelevant families (Kubernetes,
cloud pen-testing, blockchain, React/Next specialists, health analyzers) excluded deliberately. Two
non-negotiable safeguards: an **adversarial verification wave** (every finding re-checked before it enters
the final document) and **no claim without evidence** (`file:line`, a test name, or a primary source).

| Wave | Purpose | Axes run | Rows (tool/mission entries) | Output location |
|---|---|---|---|---|
| **1 — Discovery** | Axes 1–5, 7–10 in parallel, each writing findings to its own file | Axes 1,2,3,4,5,7,8,9,10 | 41 (all active axes except Axis 6 and 11, which are food-science and synthesis) | `docs/analysis/sweep/W1-*.md` |
| **1 — Discovery (food science)** | Axis 6 — domain research, not audit (no culinary-craft skill exists among the 1,308) | Axis 6 | 7 | `docs/analysis/sweep/W1-E-food-safety.md` |
| **2 — Adversarial verification** | Every Wave-1 finding re-checked against code or a primary source; unverifiable claims dropped | — | — | `docs/analysis/sweep/VERIFY-*.md` |
| **3 — Synthesis** | One knowledge-and-gaps document, cross-referenced to the prior status-and-gaps doc | Axis 11 | 4 | `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` |
| **4 — Business** *(deferred, sequenced after discovery)* | Axis 12 — pricing/tiering, deliberately last because it depends on knowing what exists and what it costs | Axis 12 | 6 | ULTIMATE §3.H |

**Full per-axis breakdown** (row counts as counted directly from the roster table, not the header labels
where those diverge — they don't, here, except the two owner-added axes carry no header number at all):

| Axis | Subject | Rows | Representative tools |
|---|---|---|---|
| 1 | Documents | 2 | `dispatching-parallel-agents`, `audit-context-building` |
| 2 | Code, line by line | 5 | `vibe-code-auditor`, `production-code-audit`, `find-bugs`, `clean-code`, `error-handling-patterns` |
| 3 | Spec ↔ code conformance | 2 | `spec-to-code-compliance`, `comprehensive-review:full-review` |
| 4 | Running app, via Playwright | 3 | `webapp-testing`, `chrome-devtools:lighthouse_audit`, `chrome-devtools:a11y-debugging` |
| 5 | Non-functional properties | 4 | `i18n-localization`, `accessibility-compliance-audit`, `progressive-web-app`, `web-performance-optimization` |
| 6 | Food & domain science | 7 | `fda-food-safety-auditor`, `pubmed-database`, `citation-management`, `scientific-writing`, `quality-nonconformance`, `data-quality-frameworks`, `deep-research`+`exa-search`/`tavily-web` |
| 7 | UI / UX | 5 | `mobile-design`, `ui-visual-validator`, `ui-ux-pro-max`, `web-design-guidelines`, `ui-ux-designer` |
| 8 | AI | 6 | `ai-agents-architect`, `ai-product`, `llm-evaluation`+`agent-evaluation`, `prompt-engineering`/`llm-prompt-optimizer`, `llm-structured-output`, `api-security-testing` |
| 9 | Workplan & workflows *(owner-added, composed from re-pointed tools)* | 4 | `production-code-audit` (re-pointed), `flowchart-creator`, `spec-to-code-compliance` (re-pointed), `webapp-testing` (re-pointed) |
| 10 | Probes & sous-vide telemetry *(owner-added, discovery/feasibility only)* | 3 | `deep-research`+`context7-auto-research`, `exa-search`/`tavily-web`, `api-documentation` |
| 11 | Synthesis & gates | 4 | `docs-architect`, `architecture-diagram-creator`, `verification-before-completion`, `writing-skills` |
| **Subtotal, active sweep (Waves 1–3)** | | **45** | |
| 12 | Business *(deferred, Wave 4)* | 6 | `startup-financial-modeling`, `pricing-strategy`, `paywall-upgrade-cro`, `startup-business-analyst-market-opportunity`, `competitive-landscape`, `product-manager` |
| **Grand total, all 12 axes** | | **51** | |

**Estimated cost of the sweep:** 10–18M tokens over several hours (roster's own estimate, based on three
document auditors from the prior 2026-07-21 audit burning 198k/313k/263k tokens each).

### 1.2 Verification stats — 261 → 42 refuted → 141 gaps

Source: `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §4. Wave 2 adjudicated **261 substantive
claims** across the eight Wave-1 reports:

| Verdict | A (Safety) | B (Correctness) | C (Orchestrator) | D (Equip→plan) | E (AI) | F (Non-functional) | G (Platform) | H (Business) | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| CONFIRMED | 22 | 57 | 21 | 22 | 16 | 16 | 24 | 28 | **206** |
| **REFUTED** | 5 | 4 | 3 | 4 | 9 | 8 | 1 | 8 | **42** |
| UNVERIFIABLE | 1 | 2 | 0 | 1 | 1 | 3 | 1 | 4 | **13** |

**16% refutation rate**, under a report-writing rule that already required "evidence or it does not exist."
Add the **3 pre-existing false alarms** that predated this sweep (a mis-cited cure-scale claim, a "0 of 177
items cited" claim refuted by the very corpus the sweep re-verified, and a "55/56 toasts untranslated" claim)
and **the total corrected count is 45** — the same shape recurring: *a grep, a quotation, or one artifact
trusted without tracing the runtime path* (ULTIMATE §4.J; the two skills this produced —
`docs/process/skills/verify-against-the-runtime-path/SKILL.md` and
`docs/process/skills/no-inert-shipment/SKILL.md` — are load-bearing project skills, not optional reading).

**206 confirmed claims → 141 gaps.** Not every confirmed claim is a gap — §2 of the ULTIMATE doc ("What is
genuinely delivered and solid") absorbs the confirmed claims that are *assets*, not defects. The **141**
figure is the charter's own re-decomposition of the ULTIMATE doc's §3 gap bands (A–H) into 11 subsystems,
independently verified in this document to sum to exactly 141 (§2 below).

---

## §2 · Gaps by subsystem

Source: subsystem definitions, gap counts and "defining property" quotes are verbatim from
`docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` §2.1 (which sums to exactly **141**,
re-verified: 11+25+15+6+16+9+11+3+13+19+13 = 141). **Method note on the "headline gaps" column**: the charter
does not publish an item-by-item subsystem crosswalk, so the specific ULTIMATE item IDs cited here are this
document's own reading — matched from the charter's one-line "defining property" to the corresponding
ULTIMATE §3 band items — not a verbatim source table. Treat them as pointers into the ULTIMATE doc, not a
certified partition. The **status** column follows `P0-kickoff-brief.md` where it speaks (S5, S9); elsewhere
it follows the charter's own phase sequencing plus the brief's explicit confirmation that P0-app — the
programme's first phase — is still untouched, meaning nothing sequenced after it has started either.

| Subsystem | Gaps | Headline gaps (ULTIMATE IDs) | Charter phase(s) | Status | Evidence |
|---|---|---|---|---|---|
| **S1** Build, data & verification pipeline | 11 | A10 (Kabanos contradicts its own citation) · A11 (18 salt overrides computed, discarded) · §5.5/§5.6 ("APPLIED" vs discarded) · B-v.24 (`_js_str` no `</script` escape) | P4 | **OPEN** | ULTIMATE §3.A.10–11, §5.5–5.6; charter §2.1 row S1 |
| **S2** Plan pipeline | 25 (largest) | C1–C5 (orchestrator solver 0% built, no AI proposer, wrong fit test) · B-ii.8–9 (rendering writes state, window-global singletons) · B-iii.13–17 (checkbox-key collisions, ⚡ toggle doesn't reach plan) · D1 (`choosePlate`/`chooseNozzle` orphaned) | P2, P3, P5a, P8, P9 | **OPEN** | ULTIMATE §3.B–D; charter §2.1 row S2, §4 P5a description |
| **S3** Capacity & occupancy | 15 | B-i.1 (three capacity rules for one device) · B-i.7 (bath advice contradicts occupancy model) · D5 (guest-count ignored) · D6 (probe channels a footer count only) | P5b, P8 | **OPEN** | ULTIMATE §3.B-i, §3.D.5–6; charter §2.1 row S3 |
| **S4** Identity & scope keyspace | 6 | B-ii.9 (5 window-global singletons) · B-iii.13 (checkbox key collision) · `'mk-plan-started-'` prefix-scanned at 6 sites (charter §8) | P5b | **OPEN** | ULTIMATE §3.B-ii/iii; charter §8 |
| **S5** AI egress | 16 | **A1/A2 (Critical — unguarded spoken AI paths)** · A3 (unit-blind numeric guard) · **E1 (model shutdown risk) — CLOSED** · E2 (`google_search` unconditional) | P0-app, P1, P2 | **PARTIAL** — E1 closed; A1/A2/A3/E2 and the rest of P0-app's scope confirmed **0 of 6 items touched** | `P0-kickoff-brief.md` §1 (E1), §4 (P0-app diff-verified untouched) |
| **S6** Managed-AI Worker | 9 | B-v.19 (`streamGenerateContent` bypasses the token cap) · B-v.20 (fail-open on corrupted KV) · B-v.21 (TOCTOU metering race) · H2–H3 (metering blind to ~90% of cost, 4 revenue blockers) | P0-worker | **OPEN** — blocked on PRE-3 (worker test harness), itself not yet built; `worker/` had **0 commits** in the reconciliation window | `P0-kickoff-brief.md` §4 (`git log … -- worker/` → 0 commits); charter §3 PRE-3 |
| **S7** Localization | 11 | F-i.1 (fr/de/es at 2.1% coverage, no gate) · F-i.2 (English-mode leaks: alarm banner, wizard step counter) · F-i.3 (`data-mt` attribute collision breaks English method toggles) | P6 | **OPEN** | ULTIMATE §3.F-i |
| **S8** Time & calendar | 3 | **A9 (`addDays` loses a day across DST — shortens a nitrite cure)** · B-iv.18 (`today()` UTC vs `isoDate()` local) | P0-app, P4 | **OPEN** — `addDays` unchanged at HEAD, confirmed by the brief's own diff | `P0-kickoff-brief.md` §4 (`addDays (app.js:2790) — unchanged`) |
| **S9** Delivery shell | 13 | B-v.23 (`serve.js` fork-crash loop) **— CLOSED** · B-v.25 (empty SW-registration catch) · B-v.26 (SW gate stricter than platform) · B-v.27 (first visit downloads 3×) | P7 | **PARTIAL** — the test-infra instance of this defect class is fixed; the shipped-app instances (SW catch, SW gate, triple-download) are untouched | `P0-kickoff-brief.md` §1 (serve.js row); ULTIMATE §3.B-v.25–27 |
| **S10** Presentation system | 19 | F-iii (contrast, touch targets, ARIA) · F-v (serve-date clips the year, occupancy labels truncate) · G7 (dead surface area — 9 orphaned functions, ~70 lines dead CSS) | P7 | **OPEN** — P7's home-screen spec (R7) not started | ULTIMATE §3.F-iii/v, §3.G.7; charter §4 P7 |
| **S11** Commercial | 13 | H1 (no billing code) · H5 (two business reports contradict 10.9×) · H12 (recommendation: do not monetise now) | P10 | **OPEN, deliberately deferred** per owner decision R8 | ULTIMATE §3.H; charter §1 row R8 |

**Sum check:** 11+25+15+6+16+9+11+3+13+19+13 = **141.** ✓

---

## §3 · The activity arcs since the charter

Four arcs ran in the ~2-day window between the charter's approval (2026-07-22) and this document
(2026-07-24), per `P0-kickoff-brief.md`'s own reconciliation window `git log bfb3e9a..HEAD` (65 commits,
current HEAD `4d1a4af`). **None of them touched P0-app or P0-worker** — the programme's first phase is still
at zero (§2, S5/S6 rows).

| Arc | What it delivered | Status | Key docs | Key commits |
|---|---|---|---|---|
| **Phase −1 test-infra** (PRE-4, PRE-8) | Live-model eval harness (`evals/lib/{runner,scorers,prompts,preflight}.ts`, `npm run eval`), a `workflow_dispatch`-only CI eval gate, a banked incumbent baseline (`gemini-2.5-flash`, 24 cases: 3 grounding + 16 safety/refusal + 5 freeform) · worker-ceiling re-measured for the grown suite (324→439 tests) | **CLOSED** — both PRE-4 and PRE-8 done per the charter's own Phase −1 definition | `docs/analysis/program/PRE-4-eval-harness-design.md`, `PRE-4-baseline-runbook.md`, `eval/baseline-gemini-2.5-flash-2026-07-23.{json,md}`, `docs/research/measurements/m1b-capacity-probes-2026-07-23.md` | harness+baseline: `495c946`, `dd0f2de`, `abf81ed` · CI integration/preflight: `1cabce9` |
| **AI model migration (מהדורה 261)** | `GEM_MODELS` registry (text + tts as first-class roles with independent payload builders/response readers) · `AI_THINK` per-usage thinking-level map (11 usages, safety-floored) · text migrated `gemini-2.5-flash`→**`gemini-3.6-flash`**, TTS migrated →**`gemini-3.1-flash-tts-preview`** (both confirmed live in `app.js` at HEAD, with a commented `textLegacy` rollback pin) · ListModels+one-real-call-per-role preflight | **PARTIAL** — the shutdown-risk (E1) is closed and shipped ahead of the charter's own schedule, but PRE-4's own designed "no-regression" comparative bar was never run against the replacement model, and the 3.6-flash real-payload thinking-token cost + repriced unit economics remain unverified | `docs/analysis/program/model-selection-architecture-design.md`, `gemini-3.6-thinking-research.md`, `tts-3.1-migration-research.md` | text flip: `b59e642` (מהדורה 261) · tts flip: `a400230` |
| **Warm-page + loopback suite arc** (the flake saga, L22) | Root cause **proven by cure** via boundary instrumentation (a purpose-built reload-storm harness): the Windows/chromium loopback connection layer serializes concurrent local navigations under N≳4 concurrent `page.reload`, releasing requests to `serve.js` in a multi-second staircase while the machine sits ~85% idle · fix: `context.route` fulfills `/index.html` from an in-memory Buffer, removing the per-test loopback connection entirely · `serve.js` de-clustered to a single process (kills the respawn-on-kill zombie failure mode, L18) · workers promoted 8→20, **certified 7/7 clean** (8/8 combined with the curve probe), suite time ~54s | **CLOSED** — fix proven, independently reviewed (`ba1da6a`, "root cause CONFIRMED, refactor APPROVED"), certified. **NEW gap surfaced, not yet investigated**: an app-side JS renderer heap leak, ~2.4–2.8 MB/reload with no plateau across 50 reloads, on all 4 tested serving configurations | `docs/research/flake-refactor-rootcause.md`, `flake-refactor-review.md`, `m1b-capacity-probes-2026-07-23.md` (POST-LOOPBACK-FIX session), `development-discipline.md` §11 L18–L22 | fix: `7d5402d`, `f74f1b8` · review: `ba1da6a` · de-cluster+DCL: `77cd4c7` · workers=20 promotion: `7fcc4e1` |
| **Infra: Serena / graphify / GPU / Ollama** | **Serena**: all 8 configured languages verified live (TS/Python/bash/PowerShell/TOML/YAML/JSON/HTML), root `tsconfig.json` added (fixed cross-file TS reference search, 0→234 refs), `pyright`/ShellCheck TLS-blocked installs worked around, project indexed (207 files), trust config fixed. **graphify**: manifest-desync fixed (`docs/.graphifyignore`, 213→25 real changed docs), deep-mode backend unblocked (`--backend claude-cli`, **$0 cost**, no key needed), global corpus grown 6770→7068 nodes across 3 deposit passes (`gemini-api-docs`, `cloudflare-workers-docs`, `playwright-official-docs`, `nodejs-v8-docs`, `ollama-docs`, `semantic-search-mcp-docs`, `windows-scheduling-docs`). **GPU/Ollama**: RTX 3090 confirmed working for local inference (no TLS wall, unlike `uv`; 71% peak `nvidia-smi` utilization) but no local model has yet matched `claude-cli`'s extraction quality (`qwen2.5-coder:7b` → 0 edges, unusable; `14b` timed out twice) | **PARTIAL** — Serena and graphify's two blockers are CLOSED and verified; the **local doc-graph refresh itself is still pending** (owner must run `/graphify docs --update --mode deep`, since this session's tooling has no Agent tool to dispatch it); GPU/Ollama hardware is proven but the "genuinely free local extraction model" goal is still open | `docs/process/serena-first-use.md`, `docs/process/graphify-improvements.md`, `docs/research/gpu-cpu-decision-report.md`, `docs/research/gpu-local-model-integration.md` | Serena: `5b982e9`, `b5438b9` · graphify deposit #2: `55413e9` · Ollama proxy test: `5062f76` |

---

## §4 · The live queue

Source: `P0-kickoff-brief.md` §3 (NEW items), §6 (open questions), and `m1b-capacity-probes-2026-07-23.md`
(the wall-time anomaly). Tiering reflects urgency/blast-radius as stated in those documents, not a new
priority call by this document.

| Tier | Item | What | Why tiered here | Trigger to act |
|---|---|---|---|---|
| **1 — in flight** | P0-app kickoff | The gap-closing programme's first and only 🔴-Critical-containing phase (A1, A2, A3 — spoken, unguarded, safety-adjacent AI paths). `P0-kickoff-brief.md` is the evidence pack for the owner's brainstorm; it makes **no design decision** itself | Programme is stalled at its own first phase — everything in §2/§3 downstream of P0-app is blocked on it starting | Owner brainstorm session resolving `P0-kickoff-brief.md` §6 questions Q1–Q5 (reprioritize now vs continue momentum; one spec vs split by blast radius; close PRE-4's regression bar now; where the heap-leak gap enters the ledger; bundle R11 or leave for P7) |
| **1 — in flight** | Local graphify graph refresh | `/graphify docs --update --mode deep` — both blockers that made this unsafe/expensive are fixed (`docs/.graphifyignore`, `--backend claude-cli`), but the command has **not been run**; `GRAPH_REPORT.md` (2026-07-23) predates this entire reconciliation arc, so the local graph does not yet cover `P0-kickoff-brief.md`, the model-registry design, or the loopback-fix research | CLAUDE.md §10.12/§10.13 make this mandatory before/at every push that changes documents; several such pushes have already happened since the graph's last update | Owner (or a session with Agent/Task-tool access) runs the skill flow — the task agent that unblocked it explicitly could not run it itself |
| **2** | R11 copy fix | "Offline copy made precise, not binary" — `build.py:334`, `app.js:3929/3931/3939`, `README.md:4` still read as fully offline in a now online-first product | Small (4 sites), isolated, no safety exposure, confirmed still-open at HEAD — cheap to close whenever a spec opens near it | Bundled into the next spec that touches `build.py`/`app.js` marketing strings (P0/P2 or P7 — open question Q5) |
| **2** | Heap-leak gap | Renderer JS heap grows ~2.4–2.8 MB per reload with no plateau across 50 reloads, all 4 tested serving configs | **Newly filed, not one of the original 141** — needs a ledger decision before it can be worked; the reload-vs-long-session equivalence is itself unanswered | Owner decides where it enters the programme (own phase, folded into P7, or scoped first) — open question Q4 |
| **2** | 3.6-flash cost check | Production `thoughtsTokenCount` under `minimal` verified **0** only on a short arithmetic prompt, not the app's real grounded/JSON payloads; base per-token price is 3–5× `gemini-2.5-flash`'s, staling the ULTIMATE §3.H unit-economics figures | Directly affects whether the shipped migration is cost-safe in production, not just functionally correct | A follow-up probe using a real app prompt shape (part of open question Q3, PRE-4's unexecuted comparative bar) |
| **3** | GPU/local-model queue | `docs/research/gpu-cpu-decision-report.md`'s ranked opportunities — top pick (graphify local extraction) is done via `claude-cli`, but a genuinely free/local model with usable `--mode deep` quality is still unfound (`qwen2.5-coder:32b` untested; a non-coder 20–30B model untried; the 14b timeout undiagnosed) | Nice-to-have cost/availability improvement, not blocking any programme phase | Dedicated research pass per `graphify-improvements.md`'s own "Owner follow-up" note |
| **3** | Worker `role→id` override | `model-selection-architecture-design.md` §7 decision 1 — a managed-Worker KV override for hot-swapping models without a client rebuild, deliberately deferred | Explicitly deferred by the design's own recommendation until the managed tier has real traffic | Managed tier going live |
| **3** | Micro-fixes (graphify hygiene) | `methodology` corpus holds another project's private docs (1,875 nodes, 0 keys leaked — flagged, not fixed) · post-commit hook not installed (code-freshness gap) · headless `graphify extract` hazard on this two-rooted repo (documented, not hardened) | Each is small, non-blocking, and explicitly flagged as "needs owner ok" in its source | Owner decision on `graphify global remove methodology` / `graphify hook install`; hazard note stands as a do-not-run warning until the repo is made single-rooted |
| **Monitor** | Cert +30s anomaly | At the certified `workers=20`, 4 of 7 runs clustered 53–55s and 3 clustered a contiguous ~30s slower (81–84s) with **no CPU-delta or process signature explaining it** — all 7 still passed 439/439 clean | Not a failure — a wall-time pattern with no root cause yet; §10.18 forbids opening a new debugging thread while nothing is actually broken | Re-open only if the slow cluster starts correlating with an actual failure, or grows in frequency across future certified runs |

---

## §5 · Reading order for onboarding

Read in this order — each line is what that document gives you that the previous ones do not.

1. **`CLAUDE.md`** — the always-in-context loader. The two gates that get skipped when nobody is looking
   (§3 the 12-point DoD, §4 the Waiver Gate), plus the pointer to everything else.
2. **`docs/process/development-discipline.md`** — the full discipline `CLAUDE.md` points to: the 14 skills
   and their mandatory triggers, the pipeline, the owner's standing instructions (§10.1–10.18), and the
   Lessons log (L1–L22) — read before repeating a mistake someone already paid for.
3. **`docs/analysis/2026-07-22-discovery-sweep-roster.md`** — who looked and how: 45 active-axis
   tool/mission assignments across 4 waves, the two structural safeguards, why business analysis ran last.
4. **`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`** — what was found: 261 claims adjudicated,
   141 surviving gaps by band, the refutation ledger (§4, read it before trusting any absence claim), and
   the recommended closing order (§7).
5. **`docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md`** — the approved plan: 11 subsystems,
   10 phases, the owner decisions D1–D8/R1–R11, and the gates (§5) that govern every task in the programme.
6. **`docs/analysis/program/P0-kickoff-brief.md`** — where the plan actually stands: what the 2-day detour
   arc closed/partially-closed, verified proof that P0-app is still untouched, and the 5 open questions
   blocking the next spec.
7. **`docs/analysis/program/model-selection-architecture-design.md`** — the detour's largest shipped
   artifact: the `GEM_MODELS`/`AI_THINK` registry now underneath every AI call site in `app.js` — read this
   before citing an AI-feature line number from the ULTIMATE doc (they have all drifted ~83–89 lines).
8. **`docs/research/flake-refactor-rootcause.md`** (+ `docs/research/measurements/m1b-capacity-probes-2026-07-23.md`
   for the certification numbers) — why the test suite behaves the way it does now: root cause, the fix, and
   the certified `workers=20`/~54s configuration every future DoD-12 gate runs against.

*Deeper tool context, if needed beyond onboarding: `docs/analysis/graph/GRAPH_REPORT.md` (the queryable
knowledge graph — query it before grepping, per CLAUDE.md §10.13, though it currently predates this arc and
needs the refresh in §4's Tier 1), `docs/process/serena-first-use.md` and `docs/process/graphify-improvements.md`
(what the two tooling investments actually verified working, and their remaining gaps).*
