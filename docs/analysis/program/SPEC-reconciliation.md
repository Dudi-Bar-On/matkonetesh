# Spec reconciliation — what is already specified, before the gap-closing program is designed

**Date:** 2026-07-22 · **Against:** shipped `v258` (`fc80664`), working tree at `365f2bc`
**Purpose:** stop a new program from re-inventing what ~12,000 lines of existing specification already
decided, and stop it from silently contradicting an approved spec (CLAUDE.md §4, the Waiver Gate).
**Method:** the knowledge graph (`graphify query/path/explain` over `graphify-out/graph.json`) to locate,
then the documents and `app.js` to verify. Every claim below carries `file:line` or `document §section`.

### What this document is, and is not

- It **is** a register of commitments, a classification of the 141 gaps against those commitments, a verdict
  on four graph-surfaced contradictions, and a retire/reuse list.
- It is **not** a re-audit. I re-verified ~25 load-bearing claims against `app.js` directly (every one is
  marked "verified here"); the rest of the 141 are taken as the ULTIMATE document states them, and the
  classification is my judgement from reading the specs and that document in full.
- Where the ULTIMATE document or the graph report is wrong, it is said so explicitly (§0 and §3).

---

## 0. Three corrections to the source material, made first

Per CLAUDE.md ("if a claim contradicts a `REFUTED` verdict there, trace the runtime path"; "the ULTIMATE
document has been wrong 42 times out of 261"), these are stated before anything is built on them.

| # | Claim | Correction | Evidence |
|---|---|---|---|
| 0.1 | `W1-GRAPH-docs.md` §Q4.3 attributes the "never invent a measurement" half of the honest-fill duplication to **Equipment 2.0 Phase 1** | **Wrong file.** `graphify explain "Never invent a measurement principle"` → `Source: superpowers/plans/2026-07-20-equipment-occupancy-layer.md`. The sentence is at `docs/superpowers/plans/2026-07-20-equipment-occupancy-layer.md:18`. `docs/superpowers/specs/2026-07-15-cookout-orchestrator-equipment-2.0-design.md` contains no such sentence (`grep -i invent` → 0 hits). See §3.3. |
| 0.2 | ULTIMATE §3.A.5 and `2026-07-22-status-and-gaps.md` §A.1 treat the two plan-depth safety commitments as **commitments** ("0 % built (49 requirements)") | `docs/plan-depth-model-2026-07-20.md:3` reads **`Status: awaiting owner approval`**. It is a design proposal, not an approved spec. Its content is excellent and should be approved — but until it is, it cannot generate plan entries, and calling it "0 % built" implies a delivery failure where none exists. |
| 0.3 | `docs/superpowers/specs/2026-07-20-equipment-consumption-layer-design.md:4` reads **`Status: Awaiting owner approval`** | …yet its Slice A shipped as **v257** (`75d946a` "feat(equip): equipPlan — the waived seam, built"). A spec was executed while its own header says it was never approved. Either the approval happened in conversation and was never recorded, or the Waiver Gate was crossed in the other direction. **Ask the owner and stamp the header.** |

---

## 1. The register of already-approved-but-unbuilt commitments

Legend for **State**: `0 %` absent · `PARTIAL` some clauses met · `DIVERGED` built, differently from the
clause · `SHIPPED` met. Every `0 %`/`PARTIAL` figure in the "verified here" rows was re-grepped against
`app.js` at v258 for this document.

### 1.1 Phase 3a orchestrator — the headline (spec: `docs/superpowers/specs/2026-07-17-cookout-orchestrator-phase3a-design.md`, **Status: Approved by owner 2026-07-17**)

| Clause | Requirement | State | ULTIMATE gap |
|---|---|---|---|
| §3.1 | `orchestrate(computed, scope)` | **0 %** — `grep -c "function orchestrate" app.js` → **0** (verified here) | C1 |
| §3.1 | `movesForClash(cl, computed, scope, i)` | **0 %** — 0 hits (verified here) | C1 |
| §3.2 | `applyMove(move, scope)` + the Move schema `{id,kind,clashIdx,itemKey,devId,he,en,delta,risk}` | **0 %** — 0 hits (verified here) | C1 |
| §3.3 | 5 move kinds `share → wood → reassign → hold → advise` | **0 %** | C1 |
| §3.4 | Rack budget (`slotModel:'size'`, 0.5/1/2 slots, "never guess large") | **0 %** — `pref('slotModel')` has 0 consumers (verified here) | C1, D2 |
| §3.5 | `safetyGate(move)`, `holdCapMin(it)` (360 min hard cap), `dangerZoneMin()` (240 min accumulator), hot-hold ≥60 °C floor, holdable-category ban | **0 %** — all four symbols 0 hits (verified here) | A-spine (ULTIMATE §5.9 row 10) |
| §4.1 | The `action_id` contract — AI ranks only, ids validated, deterministic order on failure | **0 %** — no AI proposer exists anywhere (`aiPropose\|proposeMove\|planMove\|aiOrchestrat` → 0) | C2 |
| §4.2 | `autonomy: propose` UI (top move pre-selected, one-tap Apply + undo toast) | **0 %** — `pref('autonomy')` has 0 consumers (verified here) | — |
| §2.2 | `PREF_PRESETS` + `prefPreset()` + the Simple/Balanced/Pro selector | **0 %** — 0 hits (verified here). **Deferred in a plan file**: `plans/2026-07-17-phase3a-slice1-prefs-framework.md:21` "Deviation from the spec's slicing, deliberate". Slice 2 never shipped, so a spec §2.2 requirement is now waived-by-attrition. | ULTIMATE §5.9 row 5 |
| §2.5 | 7 orchestrator knobs with live consumers | **REGISTERED, 0 consumers** — `PREFS` at `app.js:6801-6820`; `pref('<k>')` → **0** for all seven (verified here). By design per plan line 199, but the *requirement* (a preference that does something) is unmet. | ULTIMATE §5.9 row 6 |
| §6 | `mk-item-shift-<scope>`, `mk-item-wood-<scope>` | **0 %** — 0 hits (verified here) | — |
| §9 | Ships as **v250 / v251 / v252** | Slice 1 shipped as v250 (`ef2ab14`). **v251 and v252 were spent on other work** (`e1668b0` equipment properties, `834d3f1` four real-usage fixes) — verified against `git log`. | — |
| §5.1 | Probe-laundering fix (grounding = `r.ctx` only) | **SHIPPED** — `app.js:5464` is `aiSafetyNote(r.txt, (r.ctx||'')`; no `copilotVoiceContext()` in any of the 3 call sites (verified here) | — |
| §2.1–2.4 | `PREFS`/`pref()`/`setPref()`, helper delegation, hub, Units | **SHIPPED** (v250) — `openPrefGroup` present, `pref('units')` has 3 consumers | — |

**Net: 12 of 14 tracked clauses unbuilt or unconsumed; 2 shipped.** The spec is the single most complete
design artefact in the corpus and needs no re-brainstorming — only §9's version numbers are stale.

### 1.2 Equipment consumption layer (spec: `docs/superpowers/specs/2026-07-20-equipment-consumption-layer-design.md` — **header says awaiting approval; Slice A shipped as v257**, see §0.3)

| Clause | Requirement | State | ULTIMATE gap |
|---|---|---|---|
| §2 | `equipPlan` emits `gear:{dev, do, warn, occupy}` on enriched stages | **DIVERGED** — shipped `equipPlan` (`app.js:973-987`) writes only `fuelNote` and `refuelEveryMin`; `grep -c "gear.do\|gear.warn\|occupy" app.js` → **0** (verified here) | D4 |
| §2 | Enrichment applies at **both** call sites (`buildList` **and** `combinedEventsRows`) | **PARTIAL** — one call site only (`app.js:5673`) | status-and-gaps §B.5 |
| §3 A1 | Preheat as a real stage "per cooker actually used (smoke **and** sv **and** grill)"; `bathLitres(dev)` | **PARTIAL** — smoker only; `bathLitres` → **0 hits** (verified here) | D8 |
| §3 A2 | Fuel table (charcoal/pellet/gas/electric wording) reaching the **smoke task itself** | **PARTIAL** — only the refuel wording became device-aware | D10 |
| §3 A3 | Refuel cadence by device type | **SHIPPED** (`REFUEL_MIN`) | — |
| §4 Slice B | Cylinder loads `ceil(kg/volume)`; nozzle ≤ casing bore + warn; scale-resolution warn; grind-plate batching; vacuum liquid-seal "freeze first" | **0 %** — `choosePlate`/`chooseNozzle` each appear **exactly once** in `app.js` (their definitions) and are called from nowhere; `grind_mm` → 0; `casing_mm` → 1 (display) (verified here) | D1, D7 · ULTIMATE §5.9 rows 1–2 |
| §5 C1 | Hang vs grate occupancy, `long`/`short` clearance gate | **PARTIAL** — `deviceCanHang`/`hooks` shipped; the `long`/`short` class is carried into data and never read | D-cluster |
| §5 C2 | Probe-channel budgeting (leave-in vs spot-check when concurrent monitored items exceed channels) | **0 %** — `probeChannels()` has 2 occurrences: definition + one footer template (verified here) | D6 · ULTIMATE §5.9 row 4 |
| §5 C3 | SV volume fit + "one circulator = one temperature" | **0 %** | — |
| §9 | Ships as v251 / v252 / v253 | Slice A shipped as **v257**; B and C never | — |

### 1.3 Phase 4 scheduler (spec: `docs/superpowers/specs/2026-07-21-scheduler-phase4-spec.md` — **Status: DRAFT; 4b/4c "needs an explicit go"**)

| Clause | Requirement | State |
|---|---|---|
| §3 (4a) | `planSchedule()` extracted, duplicate walk deleted, `latestFinish`/`slack` recorded | **SHIPPED** (v256, `32f8ff2`) |
| §4 (4b) | Priority = least-slack → largest-demand → **fewest feasible devices** → stable key | **PARTIAL** — 3 of 4 criteria (`outstanding-register` item 20) |
| §4 (4b) | Per-device feasible-window sweep using the occupancy model as the capacity oracle | **DIVERGED** — searches earlier windows on the **one already-resolved device**; `_windowFits` tests **whole-device** `cap.usableCm2` (`app.js:3155`) while `perSlot` is only used to reject | C4 |
| §5 (4c) | Repair ladder `share → hang → reassign → shift → hold → advise` | **1 of 6 rungs** — only "pull earlier, bounded" (`SCHED_PULL_MAX_MS`) + advise |
| §5 (4c) | Limited-discrepancy search under a wall-clock guard | **0 %** — exactly one schedule is ever produced |
| §6 | Forbidden moves **structurally unrepresentable, not filtered after the fact** | **DIVERGED** — `safetyDiff` (v258) is an after-the-fact diff, and its output `_planSafetyViolations` has **no production reader** (2 hits in `app.js`: the write and the push — verified here) | A7 |
| §6 | Lexicographic objective, never a weighted sum | **moot** — no multi-candidate objective exists |
| §6 | Setpoint delta displayed now, before any solver | **SHIPPED** (v256, `ac5495c`) |
| §2 | Placements become **data, not mutation**, keyed by stage id | **0 %** — `buildList` still mutates `s.start`/`s.end` and writes `st.method` while rendering | B-ii.8 |

**Process note:** 4b and 4c shipped although the spec header says they need an explicit owner go. If that
go was given in conversation it should be stamped on the spec; if not, it is a Waiver-Gate crossing in the
build-more-than-approved direction.

### 1.4 Older commitments still open

| Source | Clause | State | ULTIMATE gap |
|---|---|---|---|
| `docs/ai-strategy.md:69` (A6) | "One caveat/citation layer applied to **any** answer with safety numbers (**voice** + diagnosis included)" | **0 % for voice** — `vcAskAI`/`vcAskFlow` (`app.js:5269-5300`) has no guard, and no guard text reaches speech | A1, A4, A12 |
| `docs/ai-strategy.md:67` (A3) | `responseSchema` typed JSON mode | **0 %** — `grep -n responseSchema app.js` → 0 | E11 |
| `docs/ai-strategy.md:48` | Extend the safety regex to °F / salt % / pH / aw | **DIVERGED** — `aiSafetyNums` (`app.js:4304`) puts the unit in a **non-capturing** group and compares bare numbers, so 74 °F matches 74 °C (verified here) | A3 |
| `docs/copilot-wave2.md:23` | Pace compares finish vs `serveTs − restMin` | **DIVERGED** — `restMin` is never written into the session shape | B-iii.15 |
| `docs/copilot-wave2.md:22` | Follow-on: Web-Bluetooth live probe reads / CSV import | **0 %** — `navigator.bluetooth`/`requestDevice`/`GATT` → 0 repo-wide | D6, G6 |
| `docs/OPERATIONS-v157.md` §2 [P2] | "▶ התחל תוכנית records `Date.now()` but never uses it" — start must re-anchor the schedule | **0 %** | B-iii.16 |
| `docs/OPERATIONS-v157.md` §2 [P3] | DST-crossing overnight cooks show clocks off by an hour (**ranked P3, "low value"**) | **0 %** — and the ULTIMATE measurement shows the same class shortens a **nitrite cure** (`addDays` at `app.js:2790`). **This is a safety re-rank of an existing P3, not a new finding.** | A9 |
| `docs/ANALYSIS-v149.md` §5 / ROADMAP Wave 3 | Self-hosted Hebrew woff2 in the SW shell | **0 %** — Google Fonts still render-blocking, 619.5 ms | F-ii.9 |
| `docs/ROADMAP-v149.md` | Unified `mk-schema` migration registry | **0 %** | G2 |
| `docs/superpowers/plans/2026-07-15-i18n-foundation-phase0.md:346` | Follow-on: full voice-assistant localization (`vcBuildAskPrompt`, `vcAnsLang`/`vcLang`) for fr/de/es | **0 %** | F-i.1 · ULTIMATE §5.9 row 8 |
| same, Task 5 note | Follow-on: delete the dead `data-i18n=` markup | **0 %** — 14 of 15 attributes dead | F-i.5 · ULTIMATE §5.9 row 9 |
| `docs/superpowers/plans/2026-07-20-equipment-occupancy-layer.md:1224` | "Known limitation to carry into the next plan": migrate `combinedEventsRows` off its own time-only overlap | **0 %** — still whole-device + time-only | B-i.1, C3 |
| refactoring-report §7 item 8 | A shared plural helper | **0 %** — `heCount`/`plural` → 0 (verified here); 4 named broken sites still broken | B-iii.17 |
| Equipment 2.0 §4 (via plan `:551`) | Edit-in-place of an existing device (plan shipped add/remove only, "flag this to the owner at execution handoff") | **SHIPPED later** — `openEquipment` + `specSource` + `aiLookupDevice` all present (verified here) | — |

**Total distinct unbuilt-or-diverged commitments: 38** — 11 in §1.1, 8 in §1.2, 6 in §1.3, 13 in §1.4 —
across 10 source documents, of which **25 sit in the three orchestrator / scheduler / consumption specs**.

---

## 2. The 141 gaps mapped onto existing specs

Counts are over all 141 items in ULTIMATE §3 (A1–A15 = 15, B = 31, C1–C12 = 12, D1–D11 = 11, E1–E16 = 16,
F = 36, G = 8, H = 12).

Each gap is assigned to **exactly one** category, so the four columns sum to 141.

| Category | Count | Meaning |
|---|---|---|
| **(a) already specified, unbuilt** | **20** | An approved (or, in 3 cases, executed-but-unstamped) spec clause requires it; nothing exists. Adopt the clause; do not re-design. |
| **(b) specified, built wrong** | **37** | A spec clause exists and something was built that diverges. Needs a diff against the clause, not a fresh design. |
| **(c) not specified anywhere** | **72** | Genuinely new. This is where brainstorming is warranted. |
| **(d) contradicts an existing spec** | **12** | **Owner decision under the Waiver Gate. Not a plan entry.** 12 gap rows → **10 rulings** (three business gaps share one). Listed in full in §2.1. |

Per band: A `3/6/3/3` · B `3/11/16/1` · C `2/2/7/1` · D `6/2/3/0` · E `1/5/10/0` · F `3/9/24/0` ·
G `2/0/5/1` · H `0/2/4/6` — reading `a/b/c/d`. Three borderline items are marked `†` (A5, A9, F-iii.11);
two of them sit on the (a)/(c) line and turn on whether an unapproved document counts as a commitment.

**The number that matters for the program's shape: 57 of 141 gaps (a + b = 40 %) already have a written
clause.** Only the 72 in (c) warrant a brainstorm.

### 2.1 Category (d) — every one, in full. These need an owner ruling before any plan entry exists.

> **§4 of CLAUDE.md:** *"A plan may never waive, defer, or reinterpret a requirement from an approved spec.
> Any such change is raised with the owner **in conversation** … 'Recorded in a document' does not count as
> raised."* Each item below is a case where **closing the gap requires overturning something already written
> down**, so writing it into a plan would be exactly the failure that rule exists to prevent.

| # | Gap | The spec it contradicts | Why it is a decision, not a task |
|---|---|---|---|
| **D-1** | **G1** — the shipped product tells users it works with no network, in 4 places, in both languages (`build.py:334`, `lang/en.json:261`, `app.js:3929`, `README.md:4`) | `docs/ai-strategy.md:96` PART D: *"Resolve the offline-first principle honestly: **the app stays fully functional offline** (data, calculators, timers, multi-event, journal, BYOK-AI all work with no network); Managed AI is an opt-in online convenience."* · `ai-prd.md:4` defines the product as *"PWA עברית, **Local-First**"*, status *"מאושר לביצוע מדורג"* | The owner overturned offline-first on 2026-07-22. Deleting the copy is trivial; **retiring the approved PRD's product definition and `ai-strategy.md` PART D's stated resolution is not.** Decide which documents are withdrawn, then delete the strings. |
| **D-2** | **A10** — Kabanos (`spec-10`) ships `Cure #2` + a cold-smoke process against its own bundled citation, which says Cure #1 at 156 ppm + cook to 68–71 °C | `docs/sources/baldwin-backbone.md:7` "Never guess"; every `safe` value traces to a primary source (CLAUDE.md) | **Fixing it changes a shipped cure type, a cure rate and adds a cook step.** DoD §3.10 forbids altering any `safe` value / cook duration at task level. Needs an explicit owner instruction that this class of task is exempt, with the primary source quoted in the task. |
| **D-3** | **A11** — 18 researched salt overrides are printed as "APPLIED" and discarded; `n-kabanos` ships 18 g/kg against 25 researched (**28 % low**) on a Cure #1 semi-dry sausage | same as D-2; plus `gen_sources.py:91-98` and `build.py:96-103` assert opposite things (ULTIMATE §5.5) | Same DoD §3.10 collision — **18 salt values change**. And the field-name collision `calc.cure` (a *rate* in the researched JSON, a *type* in `build.calc`) is still live in `sources.py` (ULTIMATE §5.6), so wiring `calc` through "properly" will reintroduce the original failure. Two decisions: (i) exempt the task class, (ii) rename one side of the collision. |
| **D-4** | **A14** — four offal `safe` floors (n=74, 75/76, 80) are sourced to culinary blogs at 65 °C, below the app's own USDA-cited 72 °C organ floor | `docs/sources/baldwin-backbone.md:7`; `docs/sources/agent-research-protocol.md` | Same DoD §3.10 collision — **raising a `safe` value is still altering a `safe` value.** Also a genuine safety call: raise to 72 °C, or keep 65 °C and re-source? Owner + a cited source, not a plan entry. |
| **D-5** | **C3** — cross-event resource allocation does not exist; both `status-and-gaps` §3.3 and ULTIMATE §7 Step 7 propose building it | `specs/2026-07-17-cookout-orchestrator-phase3a-design.md` §Non-goals: *"**Cross-event optimization** (today's cross-event smoker warning stays as-is)"* — an explicit deferral in an **approved** spec | Building it **reverses an approved non-goal.** That is precisely a §4 case. (The `combinedEventsRows` migration flagged at `plans/2026-07-20-equipment-occupancy-layer.md:1224` is a *different*, smaller commitment and is legitimately category (a).) |
| **D-6** | **B-i.7** — two shipped rules pick opposite sous-vide baths: `_svBatch` advises the **largest** (`Math.max`, `app.js:5785`, rendered `:5837`), `chooseBath` (v258) picks the **smallest** vessel that fits (`app.js:630`, `3001-3010`) | `specs/2026-07-20-equipment-consumption-layer-design.md` §3 A1: *"This is the same bath the existing `_svBatch` advisory names, so the preheat and the 'use the N L bath' text **cannot disagree**."* | The spec asserts an invariant that the shipped code violates in both directions. **The owner must pick the governing rule** (smallest-that-fits is the physically better one, but it is not what the spec says), then one path is deleted. |
| **D-7** | **H7 / H12 / H6** — the measured recommendation is *"deterministic ⇒ free forever; probabilistic ⇒ metered"*, *"make grounded web search the paid capability"*, *"do not monetise now"*, *"`mk-uilevel` must never be a price axis"* | `docs/ai-strategy.md` PART D tier table sells **"Pro Tools (one-time) — Offline/compute-free power features: advanced multi-event orchestration UI, full charcuterie calculator suite, pro export/print"** ≈ **$29–39** — i.e. it sells the deterministic layer · `ai-prd.md` (approved) is BYOK-only · `ROADMAP-v149.md` §C Wave 6-Money | Three approved documents describe a monetisation model the measurement now contradicts by construction. **Owner decision, then rewrite PART D.** |
| **D-8** | **H9** — *"Nobody owns the software-first AI copilot"* is overstated; Time To Plate ($39–99/yr) and Weber BBQ Timer's free "Cook Plan" occupy the middle | `docs/ai-strategy.md:77`, verbatim | The sentence is load-bearing for PART C's whole prioritisation. Correct the document, then re-check whether PART C's Tier ordering survives. |
| **D-9** | **H10** — *"guards your cure"* is a claim the code does not earn: the cure guard is advisory and both plan-depth gates are 0 % built | `docs/ai-strategy.md:9`, the product's one-line positioning | A public safety claim the product does not meet. Either build the gates (which first requires **approving** `plan-depth-model-2026-07-20.md`, §0.2) or change the positioning line. Owner call, and arguably a liability one. |
| **D-10** | **H11** — Anova's official API is licence-blocked to *"personal, non-commercial purposes"*; W1-H called it "the best risk/reward integration in this whole survey" | `docs/copilot-wave2.md:22`'s Web-Bluetooth follow-on and W1-H's ranking | Reclassify to self-host/hobbyist-only in both documents. A contractual fact, not an engineering task. |

**Not (d), though it looks like one:** *A5 / the plan-depth model.* It cannot contradict an approved spec
because it **is not one** (§0.2). It should be put in front of the owner for approval — after which its two
safety commitments become category (a), and the loudest ones.

### 2.2 Per-band classification

**3.A · Safety (15)**

| Gap | Cat | Governing clause / note |
|---|---|---|
| A1 unguarded voice Q&A | **a** | `ai-strategy.md:69` A6 names **voice** explicitly |
| A2 unguarded `vcTranslateToEn` | **b** | the correct guard (`mtGuard`/`mtSafe`) exists 1,700 lines away for the same content class |
| A3 unit-blind numeric guard | **b** | `ai-strategy.md:48` "extend the safety regex (°F, salt %, pH, aw)" |
| A4 Diagnose ungated | **b** | `ai-strategy.md:44` 🔴H, `:46` always-on grounding by intent |
| A5 two plan-depth gates | **c†** | source doc unapproved (§0.2) — becomes **a** on approval |
| A6 `bcheck` never records a number | **c** | Phase 3a §3.5 makes `bcheck` the sole serve authority; a numeric input was never specified |
| A7 `safetyDiff` not surfaced | **b** | scheduler §6 requires *structurally unrepresentable*, not a post-hoc diff |
| A8 alarm banner Hebrew-only | **b** | i18n Phase 0 DoD "English 100 %" |
| A9 `addDays` DST | **a†** | named at `OPERATIONS-v157` §2 [P3]; the safety consequence is new |
| A10 Kabanos vs its citation | **d** | §2.1 D-2 |
| A11 18 salt overrides discarded | **d** | §2.1 D-3 |
| A12 guards never reach speech | **a** | `ai-strategy.md:69` A6 ("voice included") |
| A13 model output unescaped | **b** | ANALYSIS-v149 §4 #1 escaping discipline, applied elsewhere |
| A14 offal floors from blogs | **d** | §2.1 D-4 |
| A15 `hebSpeechText` no %/pH | **c** | — |

**3.B · Correctness (31)** — a: 3 · b: 11 · c: 16 · d: 1

`d`: B-i.7 (the two contradictory bath rules — §2.1 D-6).
`b`: B-i.1 (three capacity rules — occupancy specs require one signal; the v258 fix landed in
`cookerContention`, not `combinedEventsRows`) · B-i.5 (advisory vs banner — `plans/2026-07-21-occupancy-view-phase2.md:7`
"the diagram and the warnings can never disagree") · B-i.6 (every clash called "Smoker" — the v258
terminology pass half-applied) · B-ii.8 (scheduler §2 "placements become data, not mutation") ·
B-ii.11 (`cookerFor` null-conflation — outstanding-register S3/D6 PARTIAL) ·
B-iii.13 (checkbox keys are translated labels — the shopping list already does it right, `app.js:7916`) ·
B-iii.15 (`restMin` — `copilot-wave2.md:23`) · B-v.19/20/21 (Worker metering — `ai-strategy.md:96` "meters
usage") · B-v.27 (triple download — ANALYSIS-v149 SW spec).
`a`: B-ii.12 (`store.set` return ignored — ANALYSIS-v149 T5 + ROADMAP Wave 3 "surface quota failures") ·
B-iii.16 (timers not schedule-aware — `OPERATIONS-v157` §2 [P2]) · B-iii.17 (plural helper — refactoring-report
§7 item 8).
`c`: B-i.2, B-i.3, B-i.4, B-ii.9, B-ii.10, B-iii.14, B-iv.18, B-v.22 (no upstream Worker timeout — no spec
asks for one; `ai-strategy.md:22` describes `gemFetch`'s timeout, and PART D asks the proxy only to
"enforce the same grounding/validation"), B-v.23, B-v.24, B-v.25, B-v.26, B-v.28, B-vi.29, B-vi.30, B-vi.31.

**3.C · Orchestrator & workflows (12)** — a: 2 · b: 2 · c: 7 · d: 1

`a`: C1 (Phase 3a §3), C2 (Phase 3a §4). `b`: C4 (scheduler §4 capacity oracle), C5 (scheduler §4 placement
output). `d`: C3 (§2.1 D-5). `c`: C6, C7, C8, C9, C10, C11, C12.

**3.D · Equipment-to-plan (11)** — a: 6 · b: 2 · c: 3 · d: 0

`a`: D1 (consumption §4 + properties DoD "a recipe needing a 4.5 mm plate warns"), D2 (consumption §4/§5),
D6 (consumption §5 C2), D7 (consumption §4), D8 (consumption §3 A1 "smoke **and** sv **and** grill"),
D10 (consumption §3 A2 fuel table). `b`: D3 (two area fields — properties spec has one `areaCm2`),
D4 (`equipPlan` narrow — consumption §2). `c`: D5 (guest-count scaling, owner-raised), D9 (`grz`), D11.

**3.E · AI (16)** — a: 1 · b: 5 · c: 10 · d: 0

`a`: E11 (`responseSchema` — `ai-strategy.md:67` A3). `b`: E5 (`aiConfirmPanel` not universal — the
"output→action" contract at `ai-strategy.md:20`), E8 (TTS billed to owner — `ai-strategy.md:96` metering),
E9 (MT hydration leak), E13 (Hebrew-only TTS errors — i18n DoD), E14-metering-half. `c`: E1, E2, E3, E4,
E6, E7, E10, E12, E15, E16.

**3.F · Non-functional (36)** — a: 3 · b: 9 · c: 24 · d: 0

`a`: F-i.5 (dead `data-i18n` — i18n plan Task 5 follow-on), F-ii.9 (self-hosted fonts — ANALYSIS-v149 §5 #2 /
ROADMAP Wave 3), F-iii.12 (default theme AA — `fire-guide-ux-refactor-prompt.md:88`, the one clause of that
document worth keeping, §4). `b`: F-i.1 (fr/de/es shipped with no gate — the i18n spec §3 explicitly did
**not** author the dicts, and `I18N_LANGS` publishes whatever files exist), F-i.2, F-i.3 (`data-mt`
collision), F-iii.11†, F-iii.13 (`<main>` 0×0), F-iii.16 (no ARIA on `occ2` — Phase 2 spec's own ARIA-list
item was deferred), F-v.29 (tile labels truncate — Phase 2 spec §4), F-v.31 (bath over-capacity called
"area"), F-v.33 (chevrons never mirror). `c`: the remaining 24 (performance, a11y depth, PWA polish, UI craft).

**3.G · Product-platform (8)** — a: 2 · b: 0 · c: 5 · d: 1

`d`: G1 (§2.1 D-1). `a`: G2 (`mk-schema` — ROADMAP-v149), G6 (probe/CSV import — `copilot-wave2.md:22`).
`c`: G3, G4, G5, G7 (its dead-`data-i18n` sub-item is counted once, under F-i.5), G8.

**3.H · Business (12)** — a: 0 · b: 2 · c: 4 · d: 6

`d`: H6, H7, H12 (**one** ruling, §2.1 D-7), H9 (D-8), H10 (D-9), H11 (D-10) — six gap rows, four rulings.
`b`: H2 (metering blind — `ai-strategy.md:96`), H3 (Worker revenue blockers). `c`: H1, H4, H5, H8.

---

## 3. The four "specified twice" contradictions, verified

Each was located with the graph (`graphify query` / `explain` / `path`), then adjudicated by reading the
documents. **An edge is a lead, not a verdict** — two of the four do not survive first contact.

### 3.1 Competing home-screen strategies — **CONFIRMED**

| | |
|---|---|
| **Side A** | `docs/fire-guide-ux-refactor-prompt.md` §3 (`:57-69`): a **mode switcher** chosen on first entry ("מסך 'כמה ניסיון יש לך עם מעשנת?' עם שלושה כרטיסים"), persisted in `localStorage`, a permanent toggle in ☰, wired as `body.mode-beg / mode-home / mode-pro`. Made an **acceptance criterion** at `:93-94`. |
| **Side B** | `docs/home-adaptive-design.md:9`: *"Two axes, one model: `gear` decides what's relevant · `level` decides how dense. … **No hard beginner/home/pro fork.**"* |
| **Citation** | `grep -rn "home-adaptive-design\|fire-guide-ux-refactor" docs/ *.md` outside `docs/analysis/` → **0 hits**. Neither document names the other. Confirms the graph's single-INFERRED-hop reading. |
| **Shipped** | `grep -c "mode-beg\|mode-home\|mode-pro" app.js` → **0**. `lvl-beg`/`lvl-mid`/`lvl-pro` present; `UI_LEVELS` = `beginner\|mid\|pro` (`app.js:7015`); `homeGear`/`cRefreshHome` → 28 hits; `mk-homecustom` → 3 hits (= `home-adaptive-design.md`'s own owner-addition Phase 7). *(All verified here.)* |

**Verdict: `home-adaptive-design.md` governs, and it has shipped essentially in full.**
`fire-guide-ux-refactor-prompt.md` §3 and its §5 mode-switcher acceptance lines are **superseded and should
be retired** — but §5's contrast (`:88`) and 44 px touch-target (`:89`) criteria are **still unmet at v258**
(ULTIMATE F-iii.12, F-iii.15) and must be re-homed before that file is retired.

**A third document re-decides the same thing, and nobody has cited it either:**
`docs/plan-depth-model-2026-07-20.md:9-16` — *"One product with a depth dial — **NOT two modes**. Two modes
means two plan generators … the second place for the internal-temp gate to go missing is the one that kills
someone."* It proposes `planDepth: essential|standard|full` as a **third** axis, orthogonal to `uiLevel`.
`grep -c "planDepth\|mk-pref-depth" app.js` → **0** (verified here), and the document is unapproved. So the
home/level/depth axis question has been decided **three times by three documents that do not cite each
other**, and only one of the three has shipped.

### 3.2 `ai-strategy.md` "safety numbers from presets" vs ANALYSIS-v149 T1 — **REFUTED as framed; a real contradiction sits one line above it**

The graph framed this as *"the stated policy and the audited implementation disagree."* Reading both:

- `ai-strategy.md:24` is **narrow and accurate**: it is a claim about the **recipe generator** only —
  *"recipe generator takes creative prose from AI but salt/cure/nitrite numbers come from app presets
  (`UMAKE_CALC`), never the model."* That is true; `UMAKE_CALC` is still the dosing source.
- `ai-strategy.md:40` is stated as **the principle PART A exists to install** — it opens PART A, headed
  *"do this FIRST; it's the liability line"* — not as an achieved state.
- `ai-strategy.md:34-38`, **in the same document**, names exactly the holes T1 names: *"the two free-prose
  flows — Ask-the-Fire and Diagnose — are where the LLM can speak a wrong number, and **Diagnose has no
  safety flag at all**."*
- `ANALYSIS-v149.md:324` says the same thing from its side: *"The guarantee covers numbers the app
  computes, not numbers the model narrates. (This is theme **T1** on the AI side.)"*

**The two documents agree.** There is no policy contradiction to resolve.

**What is genuinely contradictory, and still live at v258**, is `ai-strategy.md:20` — the summary bullet
claiming *"a principled contract **is followed**: optional · grounded-only · **never invents safety numbers**
· output→action · local-first fallback."* Four of its five clauses are contradicted by the sweep:

- *never invents safety numbers* → A1 (voice Q&A unguarded and **spoken**), A2 (translation twin unguarded),
  A4 (Diagnose ungated);
- *grounded-only* → A3, verified here: `aiSafetyNums` (`app.js:4304`) is
  `/(\d+(?:\.\d+)?)\s*(?:°\s*[CF]?|[CF]\b|ppm|%)|\bpH\s*(\d+(?:\.\d+)?)/gi` — the **unit is a non-capturing
  group**, so `aiUngroundedSafety` string-compares bare numbers and *"74 °F"* is grounded by *"74 °C"*;
- *output→action* → E5 (`aiConfirmPanel` has 2 call sites; the seasoning recommender writes state directly);
- *local-first fallback* → superseded by the 2026-07-22 online-first decision.

**Which version governs:** keep `:40` (the trust-architecture principle) as binding — it is the best sentence
in the corpus and the orchestrator's AI role (Phase 3a §4.1) is derived from it. **Correct `:20`** to state
the contract as *intended and partially enforced*, listing the four unguarded paths by name. **T1's data
half is still live**: verified here at `sausages_new.py:16-20`, salt g/kg and the cure label are interpolated
into free-text phase strings (`f"מלח {salt} ג׳/ק״ג{', '+_cl if cure else ''}…"`), exactly as T1 describes.

### 3.3 The "honest fill" principle restated near-verbatim — **CONFIRMED (and it is three times, not two; and the graph report names the wrong file)**

`W1-GRAPH-docs.md` §Q4.3 attributes one side to *"Equipment 2.0 Phase 1"*. It is not there —
`grep -i invent docs/superpowers/specs/2026-07-15-cookout-orchestrator-equipment-2.0-design.md` → 0 hits, and
`graphify explain "Never invent a measurement principle"` gives
`Source: superpowers/plans/2026-07-20-equipment-occupancy-layer.md`. The actual restatements:

1. `docs/superpowers/plans/2026-07-20-equipment-occupancy-layer.md:18` — *"**Never invent a measurement.**
   If a capacity figure is unknown, degrade to 'unknown' and do not warn — never block a plan on a number we
   do not have."*
2. `docs/superpowers/plans/2026-07-21-occupancy-view-phase2.md:15` — *"**Honest fill — three states only:**
   solid = measured, dashed = `cm2===null` (unmeasured, never numbered, never on a shelf), empty = free.
   No fourth state; **no invented measurement**."*
3. `docs/superpowers/specs/2026-07-20-equipment-properties-completion-design.md:137` — *"**never invent**: a
   property the page doesn't state must come back `null`, not a guess."*

And a fourth, narrower instance in the same family:
`plans/2026-07-20-equipment-occupancy-layer.md:765` — *"**Length is a CLASS, not a measurement** — we have no
real dimensions and must not invent centimetres."*

No document cites any other (verified: neither Phase-2 file names `equipment-occupancy-layer`). The graph's
`semantically_similar_to` INFERRED edge between (1) and (2) is the only link that exists anywhere.

**Verdict: not a conflict — a duplicated invariant with no home.** All statements say the same thing and all
three are honoured in shipped code (`itemOccupancy` `cm2=null` at `app.js:357-358`, `.occ2-dashed`,
`propOf` returning `null`). The risk is that the *next* author restates it a fourth time, slightly
differently, and the fourth version is the wrong one.
**Which version should govern:** none of the three as-is. **Promote it once**, into
`docs/process/development-discipline.md` (or a project-local skill beside
`no-inert-shipment`), phrased to cover measurements, properties **and** durations — because the Phase-3
commit already applied it to a *duration* (`outstanding-register` item 17: *"a cook duration is exactly the
thing this layer may not invent"*) without any document saying it covered durations. Then have the three
documents cite the one home.

### 3.4 The EN/HE audit twins — **CONFIRMED as a structure, REFUTED as a live drift**

Measured here:

| Pair | headings | `[P0]` | `[P1]` | `[P2]` | last commit |
|---|---|---|---|---|---|
| `ANALYSIS-v149.md` | 130 | 9 | 36 | 42 | `7eef967` 2026-07-13 |
| `ANALYSIS-v149-he.md` | 130 | 9 | 36 | 42 | `7eef967` 2026-07-13 |
| `OPERATIONS-v157.md` | 12 | 7 | 33 | 21 | `c89b585` 2026-07-13 |
| `OPERATIONS-v157-he.md` | 12 | 7 | 33 | 21 | `c89b585` 2026-07-13 |

`diff` of the `§n` heading sequence between the ANALYSIS twins is **empty**. Both pairs were last written in
a **single commit** each. **They have not drifted.** Neither twin declares which is canonical and neither
cites the other, so the risk is entirely prospective.

**Verdict:** the drift risk is real but the cheapest resolution is not parity enforcement — **both pairs are
v149/v157 audits now wholly superseded by `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` (v258).**
Retire the two Hebrew twins; keep the English originals as historical record with a one-line
"superseded by" header. If the owner wants the Hebrew kept, add a single line to each Hebrew file naming the
English file as canonical — the graph cannot enforce what the documents do not say.

---

## 4. Specs to retire, rewrite, or correct

### Retire outright

| File | Why |
|---|---|
| `ai-prd.md` (repo root) | v1.0, dated 6.7.2026, `סטטוס: מאושר לביצוע מדורג`, defines the product as *"PWA עברית, **Local-First**"* and the AI layer as **BYOK-only**. Both premises overturned: managed AI shipped v242–v246; online-first decided 2026-07-22. An *approved* document asserting a retired architecture is the most dangerous artefact in the corpus. |
| `ai-implementation-plan.md` (repo root) | Its companion; same date, same premises. |
| `roadmap-vNext.md` (repo root) | *"מבוסס על v143"*. Shipped is v258. |
| `docs/ANALYSIS-v149-he.md` · `docs/OPERATIONS-v157-he.md` | §3.4 — untranslated-canonical twins of superseded audits. |
| `docs/ANALYSIS-v149.md` §5 #1 / T4 ("no service worker") and §5 #2 findings that shipped | The SW shipped. Keep the file, mark the closed findings. |

### Rewrite / correct in place (do **not** retire — these are still the only spec for their subject)

| File | Correction |
|---|---|
| `docs/ai-strategy.md:20` | Stop asserting the trust contract *is followed*. Name the four unguarded paths (§3.2). |
| `docs/ai-strategy.md:9`, `:77`, `:96`, `:102` | *"guards your cure"* (D-9), *"Nobody owns…"* (D-8), the offline-first resolution (D-1), the "Pro Tools" deterministic-paywall tier (D-7). **All four are owner decisions, not edits.** |
| `docs/copilot-wave2.md:6` | *"Local-first."* → same online-first correction. |
| `docs/ROADMAP-v149.md` | Waves 0–5 targeted v150–v156; all shipped or overtaken. Keep **§D (matkonet platform backlog)** and the `mk-schema` item; mark the rest closed. |
| `docs/fire-guide-ux-refactor-prompt.md` | Retire §3 + the §5 mode-switcher acceptance lines (§3.1). **Before retiring, re-home §5:88 (WCAG AA on secondary text) and §5:89 (≥44 px touch targets)** — both still failing at v258. |
| `README.md:4` | *"fully local-first"*. |
| `docs/research/04a-architecture.md`, `04b-business.md` | Predate the measured unit economics; mark superseded by `docs/analysis/2026-07-22-business-model.md` and W4-A/W4-B. |
| `docs/superpowers/specs/2026-07-20-equipment-consumption-layer-design.md:4` | Header says *Awaiting owner approval*; Slice A shipped as v257. Stamp the approval or record the crossing (§0.3). |
| `docs/superpowers/specs/2026-07-21-scheduler-phase4-spec.md:4` | Header says 4b/4c *"needs an explicit go"*; both shipped as v256. Same stamp. |
| `docs/superpowers/specs/2026-07-17-cookout-orchestrator-phase3a-design.md` §9 | Version numbers v250/v251/v252 are spent. Renumber; the rest of the spec is intact. |
| `docs/plan-depth-model-2026-07-20.md:3` | *Awaiting owner approval* — put it in front of the owner. Two audits already treat it as binding (§0.2). |
| Code comments asserting untruths | `app.js:5709-5710` (safetyDiff "surfaced"), `app.js:971-972` (`equipPlan` the single point), `app.js:2984-2986`/`3070-3071` (present-tense "until Phase 3 exists", written after Phase 3 shipped), `app.js:7332` (`cwToggleSeasByKind` "used by tests"), `gen_sources.py:91-98` ("APPLIED"). ULTIMATE §5.7 + §5.5. |

---

## 5. Reusable material — adopt these, do not re-brainstorm

| Artefact | What to adopt, verbatim |
|---|---|
| **`specs/2026-07-17-cookout-orchestrator-phase3a-design.md`** — *the single best design document in the corpus* | §2 the `PREFS` registry + presets + hub · §3.1–3.3 `orchestrate`/`movesForClash`/`applyMove`, the Move schema and the 5-kind resolution order · §3.4 the rack-budget table with *"never guess large; an unknown item costs exactly one slot"* · **§3.5 the hard-floor table and the `safetyGate` body** — hot-hold ≥60 °C, 240-min danger-zone budget, `holdCapMin` 360 min vs the ≤180 min generation ceiling, and the stated reason for keeping the two numbers separate · §4.1 the `action_id` contract (AI ranks, never prices) · §6 storage keys · §7 the ten named tests. Only §9's version numbers are stale. |
| **`specs/2026-07-21-scheduler-phase4-spec.md` §6** | The best-written safety clause in the repository: *"Forbidden moves must be **structurally unrepresentable**, not filtered after the fact"* + the explicit forbidden-move list + *"**Lexicographic objective — never a weighted sum.** A weighted sum permits trading safety for convenience at some exchange rate. There is no such rate."* + the setpoint-laundering hazard at `:75-76`. Adopt as the governing safety clause for **any** future solver, not just the scheduler. |
| **`specs/2026-07-20-equipment-consumption-layer-design.md`** | §2 the `equipPlan` seam and *why a post-processor* · §3 the preheat / fuel / refuel tables (Slice A already shipped from them) · §4 the Slice-B table · §5 the two occupancy modes and *"Length is a CLASS, not a measurement"* · §6 the safety fence · §7 the eight tests. |
| **`specs/2026-07-21-occupancy-slots-h4-design.md` + `2026-07-21-occupancy-view-phase2-spec.md`** | Delivered and conformant (`outstanding-register` items 4–12 mostly DONE with live tests). §2 of the Phase-2 spec — *the honesty rule the diagram must encode* — generalises to any capacity display. |
| **`specs/2026-07-15-cookout-orchestrator-equipment-2.0-design.md`** | The graph calls it nearly orphaned (27 nodes, 5 cross-file edges). **It is not orphaned — `app.js` is its consumer:** `aiBrandModels`, `aiLookupDevice`, `EQUIP_BRANDS`, `mk-item-cooker-`, `equipMigrateFromGear`, `specSource`, `openEquipment` all present; `gearState` → 0 (verified here). Keep §2 (device schema) and §3.1 (helper API) as the data-model reference. |
| **`specs/2026-07-15-i18n-foundation-phase0-design.md`** | §4 Change 1 (dict-aware `L()`) and §4 Change 4 (the build-time coverage check that produces the `de: 83/3985 (2%)` line) — both shipped and load-bearing. |
| **`docs/home-adaptive-design.md`** | The governing home strategy (§3.1). Phases 0–7 shipped, including the owner-addition `mk-homecustom`. Its "Adaptation logic" section is the model any home-screen work must extend. |
| **`docs/analysis/2026-07-21-outstanding-register.md`** | **The best existing artefact for this job.** Every row verified line-by-line against v257 source, with the project's own DoD-4/DoD-5 rule applied ("computed-and-unread counts as NOT DONE"). **Re-verify its NOT-DONE rows against v258** — several were closed by `fc80664` (`deviceCanReach`, `FIT_SLOT_TOL`, per-slot clash in `cookerContention`, `safetyDiff`, `chooseBath`) — then adopt it as the backlog spine rather than building a new one. |
| **`docs/sources/baldwin-backbone.md` + `agent-research-protocol.md`** | Graph-orphaned (5 edges each) but binding via CLAUDE.md. Every category-(d) safety-data ruling in §2.1 turns on them. |
| **`docs/plan-depth-model-2026-07-20.md`** (pending approval) | §3 *"Essential is a DERIVATION, never an authored list"* + its **two build-failing tests** · §5 the never-droppable list · §7 the per-device task matrix (*"a pellet plan telling you to add wood makes the whole app look fake"*) · §9 demand-driven capture. Approve it before quoting it. |

---

## 6. What the program should do first, in Waiver-Gate order

1. **Take the ten category-(d) items to the owner in conversation**, before any plan exists. Four are
   document corrections, three are safety-data rulings that collide with DoD §3.10, one is a spec non-goal
   reversal (cross-event), one is a shipped-rule conflict (the bath), one is monetisation.
2. **Stamp three headers** (§0.3, §4): the consumption-layer spec and the Phase-4 spec were executed while
   their own headers say they were not approved; `plan-depth-model` was never put in front of the owner.
3. **Do not re-design the orchestrator.** §5 row 1 is a complete, approved, unbuilt spec. Renumber its
   slices and build them.
4. **Promote the "never invent" invariant to one home** (§3.3) before writing any plan that touches
   measurement, capacity or duration.
5. **Re-verify `outstanding-register` against v258** and use it as the backlog, rather than deriving a new
   one from the 141 gaps — it already applies the project's own DoD to every row.
