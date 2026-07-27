# Gap-Closing Programme — BIG STATUS REPORT
**Generated 2026-07-27 (as of v272).** Where the whole programme stands: the 47-tool discovery sweep → the grouped findings → the 141 gaps → what is closed, partial, open, or waived, and what remains until the final.

Sources (authoritative): `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` (the 141 gaps, §3 bands) · `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` (phases + 11-subsystem decomposition) · `docs/analysis/program/{ARCH,SEQ,SPEC}-analysis.md` · the conformance audits `docs/analysis/2026-07-22-audit-*.md` · `CHANGELOG.md` v261–v272 · the local knowledge graph (`graphify-out/graph.json`).

---

## 1. Provenance — how the 141 gaps were found
A **47-tool, 11-axis, 5-wave discovery sweep** (`docs/analysis/2026-07-22-discovery-sweep-roster.md`), every finding **adversarially re-verified against code or a primary source** before entering the record (two of three earlier auditors had produced a false *safety* alarm — the sweep's defining discipline).

- **Axes (11):** documents (2) · code line-by-line (5, `vibe-code-auditor` highest-signal) · spec↔code conformance (2) · running app via Playwright (3) · non-functional (4) · food & domain science (7) · UI/UX (5) · AI (6) · workplan/workflows (owner-added) · probes & sous-vide telemetry (owner-added) · synthesis & gates (4) · business (6, deferred).
- **Waves (5):** ① Discovery → ② Adversarial verification → ③ Synthesis (the ULTIMATE doc) → ④ Business → ⑤ Returns/second-opinion.
- **Yield:** **206 confirmed · 42 refuted · 13 unverifiable.** The 42 refutations became §4 of the ULTIMATE doc (the "refutation ledger" — do not re-raise). The confirmed findings distilled to **141 gaps**.

---

## 2. Three lenses on the same 141 gaps

### 2.1 By harm band (the ULTIMATE §3 reporting taxonomy) — detail tables in §5
| Band | What it covers |
|---|---|
| **A · Safety** | close first — the values/paths that can harm |
| **B · Correctness** | the plan/data says the wrong thing |
| **C · Orchestrator & workflows** | the core cook loop |
| **D · Equipment-to-plan** | the kit→schedule join |
| **E · AI** | egress, grounding, guards |
| **F · Non-functional** | i18n, a11y, PWA, perf |
| **G · Product-platform** | delivery shell, presentation system |
| **H · Business** | monetization (unstarted, listed for honesty) |

### 2.2 By fix-location subsystem (charter §2.1 — where the fix LANDS; sums to 141)
| | Subsystem | Gaps | Defining property |
|---|---|---|---|
| S1 | Build, data & verification pipeline | 11 | `build.py` had **zero assertions** |
| **S2** | **Plan pipeline** | **25** | a private closure inside a render fn; only 5 `window` exports |
| S3 | Capacity & occupancy | 15 | one correct verdict `out.fit` that **2 of 3 consumers bypass** |
| S4 | Identity & scope keyspace | 6 | four incompatible scope namespaces |
| S5 | AI egress | 16 | a transport chokepoint with **no egress chokepoint** |
| S6 | Managed-AI Worker | 9 | check-then-act; debit **after** the spend |
| S7 | Localization | 11 | two competing translation mechanisms over one DOM |
| S8 | Time & calendar | 3 | two unnamed "day" conventions |
| S9 | Delivery shell | 13 | **nothing that ships the app is exercised by a test** |
| S10 | Presentation system | 19 | colour tokenised; type/space/radius not |
| S11 | Commercial | 13 | no code (listed for honest arithmetic) |

### 2.3 By common-cause cluster (charter §2.2 — nine structural changes close 54 of 141)
extract the plan pipeline (13) · one capacity verdict (6) · scope authority + keyspace schema (6) · AI egress chokepoint (6) · build assertions (6) · Worker bounded + debit-first (6) · collapse localization (5) · one task identity (3) · one day vocabulary (3).

**Specification deficit (§2.3):** 20 specified-and-unbuilt · 37 specified-and-built-wrong · **72 specified nowhere** · 12 contradict an approved spec. *This is mostly a design programme, not a backlog burn-down.*

---

## 3. The two execution tracks
The charter's abstract phases (P0–P10) were executed on the ground as **two owner-named tracks** plus the Phase-−1 harness:

### 3.1 Charter phases — status as of v272
| Phase | Subsystems | Status | Evidence |
|---|---|---|---|
| **Phase −1** (8 prerequisites) | infra | ✅ **DONE** (all 8) | test-port param, CI (`.github/workflows/`), worker harness, live-eval harness+baseline, validator coverage, SW-testable env, 390×844 standardization, worker-ceiling re-measure (workers:20) |
| **P0-app** spoken bleeding | S5·S8 | ✅ **DONE** | v262 (spoken-safety) + v263 (DST `addDays`, TTS managed, false cross-event warning) |
| **P0-worker** the meter | S6 | ◻ **NOT STARTED** | `worker/index.js` still fails **open** on bad KV, debits after forward, CORS `*`; harness ready, RED test waiting |
| **P1** model migration | S5 | ✅ **DONE** | v261 (text→gemini-3.6-flash, TTS→3.1; central registry) |
| **P2** safety gates | S2 | ◑ **PARTIAL** | thermometer gate ✅ (E3, v266); **cure-scale BLOCK still only warns** |
| **P3** monitoring→control | S2 | ◻ **NOT STARTED** | `safetyDiff` computed but **not surfaced**; bcheck reading not recorded |
| **P4** build assertions + data | S1 | ◻ **NOT STARTED** | build.py has only incidental asserts; Kabanos/salt/offal corrections not made |
| **P5a** plan-pipeline extraction | S2 | ◻ **NOT STARTED** | `buildList` still a nested closure (riskiest change) |
| **P5b** structural boundaries | S3·S4 | ◻ **NOT STARTED** | `out.fit` not unified; no keyspace schema/migration registry |
| **P6** localization | S7 | ✅ **DONE** (pulled forward, out of order) | v268–v272 — two mechanisms collapsed, data-values translated, build guards + leak test |
| **P7** product surface | S9·S10 | ◻ **NOT STARTED** | no R7 home-screen spec; delivery shell + presentation tokens untouched |
| **P8** orchestrator | S2·S3 | ◻ **NOT STARTED** | solver 0% built (last, per D1; needs P3+P5) |
| **P9** cross-event allocation | S2·S3 | ◻ **NOT STARTED** | gated behind P8 |
| **P10** commercial | S11 | ⏸ **DEFERRED** (R8) | pricing/tiering a separate business decision |

### 3.2 Equipment (E) + Cooking-Paths (CP) — the owner-named execution track (mostly S2/S3)
| Increment | Status | Evidence |
|---|---|---|
| **E1** requires-layer foundation | ✅ CLOSED + shipped **v263** | `equipment.js`/EQM, `deriveRequires`, ownership verdicts, catalog requires-chip |
| **E2** ledger + availability | ◑ built + review-clean (v263); capability-aware-serving fix shipped **v267** — **but v267 HALTED, phase gate never closed** | mk-eqm-ledger, eqmFitVerdict, allocate/release |
| **E3** validity gates | ✅ T1–T4 CLOSED **v266** (682/682); **T5** (event-add window gate) shipped **v267**, ungated | eqmValidity, plan-add gate, probe capability, delete-warn |
| **E4** | ◻ NEXT: minTempC/cold-smoke + O-3 timeline-impact preview + downgrade-edit warn + 2 more | owner ruling; D4 deferrals ride here |
| **E5, E6** | ◻ later | bound by amendments O-1…O-7 |
| **CP1** single-source schedules | ✅ CLOSED + gated **v266** | `itemStages`/`effectiveSchedule`/`itemPaths` — contradictions dead by construction |
| **CP2** card path-panel | ◻ **variant B CHOSEN, not built** | mockups `mockups/cp2/variant-{a,b,c}.png`; 2 copy calls pending |
| **CP3** cited-paths research batch | ◻ data-only, zero new JS | |
| **CP4** E4-remainder integration | ◻ per-event override + O-3 preview | |

**★ Where the roadmap resumes:** v267 shipped **E2 capability-aware serving + E3-T5 event-window gate + wood-advisory** but the owner **halted it for inadequate UI verification** → the localization detour (v268–v272) happened instead. So the resume point is: **deep UI-verify + close the E2 / E3-T5 phase gates**, then build **CP2 (variant B)**, then **E4 → CP3 → CP4 → E5/E6**, with the auto-optimize **orchestrator (charter P8)** at the far end.

---

## 4. Localization track (parallel) — the 23-language queue
Fixed owner-ordered queue (2026-07-26, `scratch/translate-bulk/run-queue.mjs`, do not reorder):
`it → pt → el → ja → ko → th → nl → hu → pl → ro → vi → hi → id → ru → uk → da → fi → nb → tr → sv → cs → ar → zh`
**Shipped:** he, en, fr, de, es, **it** (v267). **Next: pt (Portuguese).** (A 2026-07-27 Russian-first attempt was an ordering error; the in-flight Russian run finishes then the track holds.)

---

## 5. The 141 gaps — detailed status
<!-- ASSEMBLED FROM: gap-status-parts/part-AB.md (Safety+Correctness), part-CDE.md (Orchestrator+Equipment+AI), part-FGH.md (Non-functional+Product+Business) -->

### 5.A–B · Safety + Correctness

# Gap status — Band 3.A SAFETY + Band 3.B CORRECTNESS

**Source of gaps:** `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §3.A (lines 323–342) + §3.B (lines 343–497).
**Status verified against:** CHANGELOG v261–v272, code (`app.js`, `worker/index.js`, `serve.js`, `build.py`, `data.py`, `sources.py`) at HEAD, and the three 2026-07-22 analyses. Every verdict is grounded in a cited line; none guessed.

**Counts — Safety (A1–A15): 15 gaps — 4 CLOSED, 3 PARTIAL, 8 OPEN, 0 WAIVED. Correctness (B1–B31): 31 gaps — 2 CLOSED, 1 PARTIAL, 28 OPEN, 0 WAIVED.**

## 3.A · SAFETY

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| A1 | Safety | S5 | Voice Cook Q&A (`vcAskAI`) was unguarded spoken web-grounded AI | P0-app | **CLOSED v262** | `vcAskFlow` now calls `vcGuardSpoken(answer,tiers,ansL)` before speaking (app.js:6571); `google_search` conditional via `searchFor('vcAsk',!!ent)` (6551). CHANGELOG v262 spoken-safety hardening. |
| A2 | Safety | S5 | `vcTranslateToEn` translated+spoke recipe content with no guard | P0-app | **CLOSED v262** | `vcSpeakContent` gates on `vcTransSafe(text,en)` value+unit-class set-compare; fail → speaks Hebrew (app.js:6364-6375). CHANGELOG v262 "voice-translation gained a numeric guard". |
| A3 | Safety | S5 | AI numeric guard unit-blind (74°F matched 74°C grounding) | P0-app | **CLOSED v262** | `aiSafetyToC(n,unit)` converts F→C before compare (app.js:5418-5421); `aiUngroundedSafety` runs on normalized values (5451). CHANGELOG v262 "Fahrenheit … no longer misread as Celsius". |
| A4 | Safety | S5 | Diagnose has no refusal gate nor vetted grounding | P0-app/P3 | **OPEN** | No release adds `askSafetyIntent`/`SAFETY_FACTS()` to the diagnose grounding builder; not in CHANGELOG v261–272. |
| A5 | Safety | S2 | Thermometer refuse-to-schedule + cure task must BLOCK (not warn) | P2 | **PARTIAL** | Thermometer admission built in E3 v266 (internal-temp recipes require a probe; add-to-plan blocked). Cure BLOCK NOT built — `cureScaleGuardHTML` still returns an advisory `<div>`, dose printed regardless (app.js:2585-2609, 2652-2656). |
| A6 | Safety | S2 | `bcheck` ticked but the numeric reading never recorded | P3 | **OPEN** | Task is a plain checkbox `data-wpck` (app.js:7258-7260); bcheck stage carries a target temp but no numeric input (4058). P3 "record the reading" not shipped. |
| A7 | Safety | S2 | `safetyDiff` computed but never surfaced to the user | P3 | **OPEN** | Only writes `window._planSafetyViolations` (app.js:6983,6989); no reader anywhere. Comment still claims "surfaced" (6981-6982). P3 not done. |
| A8 | Safety | S7 | Alarm banner + OS notification Hebrew-only in every language | P6 | **OPEN** | Banner heading + `aria-label='טיימר הסתיים'` + per-row `🔕 עצור` hardcoded (app.js:3160-3162); notify text hardcoded (3139). Only "Stop all" localized (3163). |
| A9 | Safety | S8 | `addDays()` lost a day across spring DST | P0-app | **CLOSED v263** | Rewritten all-UTC: `Date.UTC` parse + `setUTCDate`/`getUTCDate` + `toISOString` (app.js:3553-3558). CHANGELOG v263 "Date math is now DST-proof". |
| A10 | Safety | S1 | Kabanos (spec-10) cure type contradicts its own citation | P4 | **OPEN** | Still `cure="…Cure #2"` and `smt=50` cold-smoke (data.py:152); `sausage_dry("…","Cure #2",…)` (data.py:490). Citation says Cure #1 + cook to 68-71°C. |
| A11 | Safety | S1 | 18 researched salt overrides computed, "APPLIED", silently discarded | P4 | **PARTIAL** | Silent-clobber hazard fixed — build now explicitly ignores sources' `calc` with an honest comment (build.py:96-102, "Wave 0 safety fix"). But the 18 researched values are still NOT applied — reconciliation deferred to "Wave 2b / T6". |
| A12 | Safety | S5 | Guard/caveat text never reaches speech | P0-app | **PARTIAL** | The voice-ask path is now guarded in speech via `vcGuardSpoken` (A1, v262). But the 5 visual guard sites (cure-scale etc.) still emit HTML only and never feed TTS. |
| A13 | Safety | S5 | Model output reaches `innerHTML` unescaped | P0-app/P3 | **OPEN** | `padvRender` reason still `<div class="pp-desc">${r.reason}</div>` with no `esc()` (app.js:10060); sibling seasoning path IS escaped (10240), so inconsistent, flagged path unfixed. |
| A14 | Safety | S1 | Three offal `safe` floors sourced to culinary blogs (65 vs 72°C) | P4 | **OPEN** | Goose Liver `safe=65` (data.py:80), Veal/Lamb Sweetbreads `safe=65` (81,82) — unchanged; USDA-cited comparator is 72 (78,79). Data Correction Gate item, no owner sign-off recorded. |
| A15 | Safety | S5 | `hebSpeechText` has no `%` and no pH/aw spoken rule | P0-app | **OPEN** | No `%`/pH replacement added to the speech-text ruleset; not in CHANGELOG v261–272. |

## 3.B · CORRECTNESS

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| B1 | Correctness | S3 | Three different capacity rules for one device | P5b | **OPEN** | One capacity verdict is P5b, "ships only after the before/after review (D6)"; not built. v266 E3 "capability-aware serving" touches sufficiency, not the 3-rule unification. |
| B2 | Correctness | S2 | Serve time — three surfaces, 3.5 h apart | P5a | **OPEN** | Plan-pipeline extraction (P5a) not started; `mk-tlserve` global never written back to `ev.serve`. |
| B3 | Correctness | S2 | Multi-day items blocked in one view, scheduled in the other | P5a | **OPEN** | `combinedEventsRows` still has no multi-day/`blocked` concept. P5a not started. |
| B4 | Correctness | S2 | Only the vertical plan shape can be ticked | P5a | **OPEN** | Three renderers dispatched (app.js:7250-7252); checkbox key logic lives only in `renderWpVertical` (7258-7260). No evidence accordion/horizontal gained checkboxes. |
| B5 | Correctness | S3 | Advisory vs clash banner disagree by construction | P5b | **OPEN** | `_plcConflicts` pre-shift vs `cookerContention` post-shift under different rules; unchanged. P5b not built. |
| B6 | Correctness | S3 | Combined view calls every clash "Smoker" | P5b | **OPEN** | Hardcoded `חפיפת מעשנה` / "Smoker overlap" persists (app.js:9764). P0 R5 interim only neutralized the no-equipment false warning (CHANGELOG v263), not the mislabel. |
| B7 | Correctness | S3 | Bath advice contradicts the occupancy model | P5b | **OPEN** | `_svBatch` Math.max with no litre check vs `deviceOccupancy` pctFloor; unchanged. P5b not built. |
| B8 | Correctness | S2 | Rendering the plan writes user state | P5a | **OPEN** | `buildList` still assigns `st.method`/`st.stage`/`st.ready` then persists. P5a not started. |
| B9 | Correctness | S2 | Window-global singletons in a parallel-events app | P5a | **OPEN** | `_wpTasks`/`_wpCtx`/`_plcConflicts`/`_wpServe`/`_planSafetyViolations` still window-global. P5a not started. |
| B10 | Correctness | S4 | `cardSess` keyed by item only, shared across events | P5b | **OPEN** | Keyspace schema is P5b; unchanged. |
| B11 | Correctness | S3 | `cookerFor` conflates "no gear" with "needs a pick" | P5b | **OPEN** | `null` at both branches; unchanged. |
| B12 | Correctness | S4 | `store.set` return ignored; success reported unconditionally | P5b | **OPEN** | No evidence the `toast('נרשם ✓')` path now checks the boolean; not in CHANGELOG. |
| B13 | Correctness | S4 | Checkbox keys are the translated label (lang switch wipes ticks; refuel rows collide) | P5b | **OPEN** | Key still `'wpck:'+sc+':'+tk.label` on the translated label (app.js:7258). One task identity is P5b, unbuilt. |
| B14 | Correctness | S2 | ⚡ card toggles don't reach the plan outside a project | P5a | **OPEN** | `activeMethods` still reads only `store.get('method:…')`, never `cardSess`; unchanged. |
| B15 | Correctness | S2 | Copilot reserves no rest and follows the wrong event | P5a/P8 | **OPEN** | `restMin` still never written to the session shape; unchanged. |
| B16 | Correctness | S2 | Timers are stopwatches, not schedule-aware | P5a | **OPEN** | `wireTimer` still counts from the ▶ press; no reconciliation with plan clock. Unchanged. |
| B17 | Correctness | S7 | `"1 events"` — no plural helper | P6 | **OPEN** | `${list.length} ${L('אירועים','events')}` with no singular branch (app.js:9787,9824). No `plural()` helper exists. |
| B18 | Correctness | S8 | `today()` returns UTC date; `isoDate()` returns local date | P5b | **OPEN** | `today()` UTC via `toISOString` (app.js:3547); `isoDate()` local via getFullYear/Month/Date (6803). Divergent. (A9 DST fix is a separate, closed item.) |
| B19 | Correctness | S6 | Worker token cap bypassed by `:streamGenerateContent` | P0-worker | **OPEN** | Router still admits `streamGenerateContent` (worker/index.js:43); metering `JSON.parse(text)` skips a streamed array body (77-86). Blocked on PRE-3. |
| B20 | Correctness | S6 | Worker fails OPEN on a corrupted KV record | P0-worker | **OPEN** | Still `catch { rec = { active: true }; }` (worker/index.js:56) — no cap, never rewritten. Blocked on PRE-3. |
| B21 | Correctness | S6 | Worker usage counter is a read-modify-write race | P0-worker | **OPEN** | Read at :53, upstream at :66, write at :84 — unchanged. Blocked on PRE-3. |
| B22 | Correctness | S6 | No timeout/AbortController on the upstream Gemini fetch | P0-worker | **OPEN** | `fetch(...)` at worker/index.js:66-70 has no `signal`. Blocked on PRE-3. |
| B23 | Correctness | S9 | `serve.js` fork-crash restart loop | Phase −1 (L18) | **CLOSED** | De-clustered to a SINGLE in-memory process; the `cluster.on('exit',fork)` respawn is gone (serve.js:1-10), SIGINT/SIGTERM handlers added (53-55). Lesson L18. |
| B24 | Correctness | S1 | `build.py _js_str` does not escape `</script` | P4 | **OPEN** | Latent — app.js `__JS__` is substituted raw at build.py:586, not through `_js_str`; no `</script` build guard added. (Build did gain F5/i18n asserts, not this one.) |
| B25 | Correctness | S9 | Service-worker registration catch is empty | P7 | **OPEN** | No evidence the SW `.register` catch gained a body; not in CHANGELOG. |
| B26 | Correctness | S9 | SW gate stricter than platform (`protocol==='https:'`) | Phase −1 (PRE-6) | **CLOSED** | Gate now `self.isSecureContext` — covers trusted localhost so the update channel is testable (app.js:11397, comment "2026-07-23, owner §4 sign-off"). |
| B27 | Correctness | S9 | First visit downloads the whole document three times | P7 | **OPEN** | SW `SHELL` double-key + `no-cache` on index.html; delivery-shell work (P7) not done. |
| B28 | Correctness | S9 | Origin returns 200 + 2.27 MB for every unknown path | P7 | **OPEN** | Cloudflare Pages SPA fallback; no `robots.txt`/`llms.txt` shipped. P7 not done. |
| B29 | Correctness | S1 | Nine cuts violate the `saved`/`svh` relation; invariant is wrong comparison | P4 | **OPEN** | Flagged "defect or hand-tuning is open"; no data correction shipped. |
| B30 | Correctness | S1 | Six cuts carry `svt=0` as a "no sous-vide" sentinel | P4 | **OPEN** | Unchanged; no data cleanup shipped. |
| B31 | Correctness | S1 | Five `MAKE_SOURCES` carry a stale "CRITICAL GAP … cure=None … botulism" note | P4 | **PARTIAL** | The hazard mechanism is neutralized — build now ignores sources' `calc` so the bad note can't drive a value (build.py:96-102). The stale note text itself is not confirmed removed. |

### 5.C–E · Orchestrator + Equipment-to-plan + AI

# Gap status — bands 3.C (Orchestrator & workflows), 3.D (Equipment-to-plan), 3.E (AI)

Read-only synthesis. Source of gaps: `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §§3.C–3.E (lines 498–551).
Status grounded in: `CHANGELOG.md` v261–v272, `docs/analysis/2026-07-22-audit-orchestrator.md`,
`docs/analysis/2026-07-22-status-and-gaps.md`, and code probes against `app.js` / `worker/index.js` / `build.py`.
Subsystems (S1–S11) and phases per `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` §2.1 / §4.

**Band counts.**
- **3.C Orchestrator & workflows (12):** CLOSED 0 · PARTIAL 0 · OPEN 12 · WAIVED 0. (C3 has an interim R5 mitigation shipped v263, but the gap — cross-event *allocation* — is unbuilt.)
- **3.D Equipment-to-plan (11):** CLOSED 1 (D3) · PARTIAL 3 (D4, D10, D11) · OPEN 7 (D1, D2, D5, D6, D7, D8, D9) · WAIVED 0.
- **3.E AI (16):** CLOSED 6 (E1, E2, E3, E4, E7, E8) · PARTIAL 2 (E9, E12) · OPEN 8 (E5, E6, E10, E11, E13, E14, E15, E16) · WAIVED 0.

---

## 3.C · Orchestrator & workflows

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| C1 | 3.C | S2 | Phase 3a solver 0% built (`orchestrate`/`movesForClash`/`applyMove`) | P8 (not started) | OPEN | `grep -nE "function orchestrate|movesForClash|applyMove|safetyGate" app.js` = 0 hits; audit-orchestrator P3A-7/8 NOT DONE; charter D1 (orchestrator last) |
| C2 | 3.C | S2·S5 | No AI proposer; `safetyDiff` gate not wired to any AI | P8 (not started) | OPEN | `grep -Ec "aiPropose|proposeMove|planMove|aiOrchestrat|safetyGate" app.js` = 0; audit P3A-12 NOT DONE |
| C3 | 3.C | S2·S3 | Cross-event resource allocation does not exist; only raw smoke-window time-overlap | P9 (after P8); R5 interim in P0 | OPEN | status-and-gaps §B.4; charter R5/P9. Interim: false cross-event warning neutralised for unconfigured kit (CHANGELOG v263). `combinedEventsRows` gained occupancy-based *detection* (audit OCC-9) but no allocation |
| C4 | 3.C | S2·S3 | Placer searches on whole-device `usableCm2`, not `perSlot`; volume stages early-return slack 0 | P5a/P8 | OPEN | `schedulePlacements` (app.js:3860), `_windowFits` (3844) unchanged in shape; no fix in v261–v272 |
| C5 | 3.C | S2 | Non-uniform slack set silently discarded (`uniq.length!==1` guard) | P5a/P8 | OPEN | scheduler-internal advisory path unchanged; not addressed in CHANGELOG |
| C6 | 3.C | S2 | Advisory recommends a "cook in batches" feature that does not exist | P8 | OPEN | no batch feature; unchanged |
| C7 | 3.C | S2·S10 | `SCHED_PULL_MAX_MS` has no UI / no explanation | P8/P7 | OPEN | constant-only; unchanged |
| C8 | 3.C | S2·S10 | User cannot influence stage durations, shelf assignment, preheat, or method from work-plan view | P7/P8 | OPEN | no override affordances shipped v261–v272 |
| C9 | 3.C | S10 | Work Plan opens ~2.1 screens above "now"; nothing scrolls to `.wp-next` | P7 (product surface) | OPEN | UI/product; no scroll-to-now fix in CHANGELOG |
| C10 | 3.C | S8·S10 | Voice-cook jump list drops the day marker (`fmtClock` vs `fmtClockRel`) | P7 | OPEN | not addressed; v270 only relabels the speech-language button |
| C11 | 3.C | S3·S10 | Occupancy view orders empty devices above the occupied one | P7 | OPEN | narrow residual; no ordering fix in CHANGELOG (occupancy honesty ladder addressed fit-verdict, not device order) |
| C12 | 3.C | S10 | Live Copilot is the thinnest surface (~430px empty); no serve countdown/temperature/other timers | P7 | OPEN | product surface; unchanged |

---

## 3.D · Equipment-to-plan

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| D1 | 3.D | S2·S3 | `choosePlate`/`chooseNozzle` built+tested, called from nowhere in production | equip consumption (post-E3, unsched)/P8 | OPEN | defined app.js:3785/3795, **no callers** (`grep -nE "choosePlate|chooseNozzle"` = defs only); audit CONS-11/13, PROP-13 NOT DONE |
| D2 | 3.D | S3 | 14 device properties read for display (chips) only; none feeds planning/occupancy/safety | P5b | OPEN | audit PROP-8 (most of ~20 props have zero consumers); chips at app.js:6389-6398; unchanged |
| D3 | 3.D | S3 | Two cooking-area form fields (`#eqvArea` + `#eqProp-areaCm2`); only one drove the engine | **E1 (v263)** | **CLOSED (v263)** | CHANGELOG v263 "two cooking-area fields collapsed into one canonical metric field"; single `areaCm2` core prop (app.js:37/82/93); no `#eqvArea` residue |
| D4 | 3.D | S2 | `equipPlan` seam narrow; cook stages carry no equipment-specific instruction | P5a/P8 | PARTIAL | `equipPlan` shipped (app.js:973-986, sets `fuelNote`/`refuelEveryMin` only); audit CONS-1 PARTIAL, D4 "what holds: cook stages carry no equip instruction" |
| D5 | 3.D | S3 | Occupancy demand ignores guest count and piece count (`footprint_cm2` static) | P5b (owner-raised) | OPEN | `footprint_cm2` static (app.js:494); `rawGramsFor` per-guest exists but only for the shopping/menu list (app.js:3352/3363/3371), not for `itemOccupancy` demand |
| D6 | 3.D | S3 | Probe-channel budgeting is a footer count only; no BLE | equip consumption (unsched) | OPEN | `probeChannels` 2 hits (def + footer 6425); `navigator.bluetooth`/`requestDevice`/`GATT` = 0; audit CONS-18 NOT DONE |
| D7 | 3.D | S2·S3 | Charcuterie Slice B 0% — cylinder loads, vacuum liquid-seal warn, grind-plate matching | equip Slice B (unsched) | OPEN | audit CONS-10/11/13/14 NOT DONE |
| D8 | 3.D | S2 | Warm-up is smoker-only; no bath come-up, grill chimney, or oven preheat task | P5a/P8 | OPEN | audit CONS-4 / D2 NOT DONE (`earliestSmoke` filters `kind==='smoke'`). v267 wood-load advisory is flavor, not preheat |
| D9 | 3.D | S2·S3 | `grz` grill zoning on 118/130 cuts has exactly one consumer (grill summary line) | P5a/P8 | OPEN | audit W1-E C15; nothing in scheduler/plan/occupancy reads `grz`; unchanged |
| D10 | 3.D | S2 | Pellet/electric owner still sees "🪵 wood: oak" on the smoke task itself | P5a/P8 | PARTIAL | audit CONS-7 PARTIAL: refuel wording device-aware (`equipPlan`→`fuelNote`), smoke task's own fuel line still reads recipe `wood`/`coal` (app.js ~5826). v267 wood-load advisory added, does not suppress the line |
| D11 | 3.D | S3 | "✓ everything fits" is the fall-through for an empty device | P5b | PARTIAL | occupancy Phase 2 honesty ladder reworked the grate fall-through (explicit "NOT fall through to ✓ everything fits" guard, app.js:801-810; `out.fit` default handling); specific empty-device path materially changed but the fall-through class not fully certified closed |

---

## 3.E · AI

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| E1 | 3.E | S5 | Text model `gemini-2.5-flash` shuts down 2026-10-16; every AI feature routes through it | **P1 (v261)** | **CLOSED (v261)** | CHANGELOG v261 migration text→`gemini-3.6-flash`, TTS→`gemini-3.1-flash-tts-preview` via model registry; 2.5-flash commented out (app.js:5087/5090, legacy at 5095) |
| E2 | 3.E | S5 | `google_search` attached unconditionally (COGS + injection surface #3) | **P0-app (v262–v263)** | **CLOSED** | `searchFor('ask',!!ctx)?[{google_search:{}}]:undefined` (app.js:5255) + `searchFor('vcAsk',!!ent)` (6551); comments "P0-app item 3: search only when local grounding is empty" |
| E3 | 3.E | S9 | No CI at all; `package.json` test script an error stub | **PRE-2** | **CLOSED** | `.github/workflows/` has `test.yml` + `eval.yml`; `package.json` `"test": "playwright test"` (not a stub) |
| E4 | 3.E | S5 | Grounding validators (`aiValidateKeys/Items/Seasonings`) untested | **PRE-5** | **CLOSED** | `tests/ai-validators.spec.ts` exists (`grep -rl` now returns it) |
| E5 | 3.E | S5 | `aiConfirmPanel` not the universal contract; seasoning recommender writes state directly | P8 precondition | OPEN | `aiConfirmPanel` still 3 sites; `[data-seasadd]` click → `cwApplySeasKind` directly (app.js:10250-10253), bypassing the panel; audit R6 pattern unchanged |
| E6 | 3.E | S5 | Managed→BYOK fallback is silent (no toast/state change on 401/402/403) | P0/P1 | OPEN | app.js ~5231: `if(mode==='managed' && [401,402,403]... && gemKey()){ return gemFetch(...{key:gemKey()}); }` — still no toast/state change |
| E7 | 3.E | S5 | Managed-AI users never reach the guaranteed-Hebrew Gemini voice | **P0-app (v263)** | **CLOSED (v263)** | CHANGELOG v263 "Voice replies route through managed AI correctly — TTS works for managed-access users"; `vcSpeak` now gates on `aiAvail()` "P0-app item 4: a managed-only user must reach Gemini TTS" (app.js:6210-6214) |
| E8 | 3.E | S5·S6 | TTS silently bills the owner (routes to Worker unmetered) | **P0-app (v263)** | **CLOSED (v263)** | v263 made managed TTS intentional (E7) + added per-call usage metering `gemNoteUsage` "P0-app item 7" (app.js ~5231). NB: worker-side bounded/debit-first cap is E14 / P0-worker, not shipped |
| E9 | 3.E | S7 | MT hydration uncapped leak; cache stops persisting >3000 entries | P6 | PARTIAL | build-time localization overhaul (CHANGELOG v268–v270: ~1,300 strings unified, build-time coverage guard, ~740 data values baked) removes the runtime re-run driver; but the >3000-entry persistence cap code still present (app.js:8712) |
| E10 | 3.E | S5 | `aiJSON` makes 2 billed attempts on HTTP-200-empty-candidate | P1/P5 | OPEN | `aiJSON` (app.js:5478); v271 raised output budget (truncation) but the empty-candidate retry cost is unaddressed |
| E11 | 3.E | S5 | No constrained decoding (`responseSchema`) | P1/P5 | OPEN | `grep -nc responseSchema app.js` = 0; only `responseMimeType:'application/json'` |
| E12 | 3.E | S5 | User free text concatenated into prompts with no delimiting/sanitization | P0-app | PARTIAL | spoken-safety guard layer strengthened (CHANGELOG v262 numeric/unit guard, redaction) — the "enforcement" E12 names — but the raw concatenation itself is unchanged |
| E13 | 3.E | S7 | `vcSpeak` TTS error detail strings are Hebrew-only | P6 | OPEN | app.js:6218-6221 — four `if(...) m='<bare Hebrew literal>'` inside the `.catch`; only the envelope uses `L(...)` (6222); not swept into the unified translatable path |
| E14 | 3.E | S6 | Worker security posture dev/beta; CORS `*`, no rate limit, health leaks `hasKey`, shareable bearer code, `cap:0` unmetered | **P0-worker (not shipped)** | OPEN | `worker/index.js:21` CORS `'*'` "tighten for production"; `:39` health returns `hasKey`; no rate-limit code |
| E15 | 3.E | S9 | No CSP / security headers while Gemini key lives in `localStorage` | P0/P7 | OPEN | `build.py:636` `_headers` writes only `Cache-Control`; no CSP/HSTS/X-Frame |
| E16 | 3.E | S9·S10 | AI hub lists 5 of 14 features (discoverability) | P7 | OPEN | `AI_TOOLS` unchanged; no CHANGELOG entry |

### 5.F–H · Non-functional + Product-platform + Business

# Gap status — Bands 3.F (non-functional), 3.G (product-platform), 3.H (business/monetization)

Read-only synthesis. Source of gaps: `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` §3.F/§3.G/§3.H (lines 552–807). Baseline audited v258; status assessed against v272 (CHANGELOG v261–v272) + live code probes.

## Counts per band

- **Band F (non-functional, 36 gaps):** CLOSED 3 · PARTIAL 1 · WAIVED 1 · OPEN 31.
  The i18n subsystem (S7) closed via the v268–v272 localization overhaul; **all performance, a11y, PWA, and UI-craft gaps remain OPEN — charter Phase P7 (product surface) has not started.**
- **Band G (product-platform, 8 gaps):** PARTIAL 1 · DEFERRED 4 · OPEN 3.
- **Band H (business/monetization, 12 items):** DEFERRED 9 · OPEN 3.
  Per charter R8/§12 "do not monetise now"; P10 deferred. The **marketing-claim corrections (R8) are largely NOT done** — only the footer offline string was fixed (see H-9, H-10, G-1).

| Gap | Band | Subsystem | Description | Phase | Status | Evidence |
|---|---|---|---|---|---|---|
| F-1 | 3.F-i | S7 | fr/de/es shipped at 2.1% coverage with no gate; item data untranslated; 53 toasts leak Hebrew | P6 | **CLOSED (v268–v272)** | CHANGELOG v268 (full chrome), v269 (data values: names/categories/origins/woods), v270–v272; coverage Guard A + numeric Guard B; 5 active langs he/en/fr/de/es/it (`build.py` `_active_langs`); `tests/i18n-completeness.spec.ts` render-path leak gate |
| F-2 | 3.F-i | S7 | English-mode leaks (`רענן עכשיו`, `בטל`, step counter, kosher chip reverting) | P6 | **CLOSED (v268–v272)** | v268 "every button, label, panel, message, dialog, toast" unified; leak test drives fired-toast + language-switch-while-open + raw-Hebrew DOM scan |
| F-3 | 3.F-i | S7 | `data-mt="sv"` collision destroys English method toggles; `hydrateMT` treats value as source | P6 | **CLOSED (v268–v272)** | v268 "~1,300 inline bilingual strings unified into one translatable path fed by an extractor; nine parallel English lookup tables removed"; v270 work-plan method labels translated + leak test drives the timeline |
| F-4 | 3.F-i | S7 | RTL isolation applied locally, not systematically (was 7 `dir="ltr"`) | P6 | **PARTIAL** | `dir="ltr"` grew 7→18 in app.js (more coverage) but still ad-hoc per-site, no systematic mechanism; 🟡, not a claimed visual defect |
| F-5 | 3.F-i | S7 | 14 of 15 `data-i18n*` attributes are dead markup (`applyI18n` queries only `[data-i18n-html]`) | P6 | **OPEN** | `build.py` still ships 13 `data-i18n` + 1 `data-i18n-ph` + 1 `data-i18n-html` (unchanged); dead markup persists (also G-7). Minor |
| F-6 | 3.F-ii | S9/S10 | Cold CWV bad: LCP 2863 · CLS 0.29 · TBT 853 (JS boot rewrites home 3.4s after paint) | P7 | **OPEN** | No P7 perf work in CHANGELOG v261–v272 |
| F-7 | 3.F-ii | S9 | Cost is parse not bandwidth: decoded 2.69MB, ParseHTML 400ms, Layout 812ms at 4× | P7 | **OPEN** | Not addressed; P7 not started |
| F-8 | 3.F-ii | S7/S9 | Non-Hebrew: 62% wall-clock in long tasks — whole-body `MutationObserver` re-runs applyI18n+tnode+hydrateMT on 250ms timer ticks | P6/P7 | **OPEN** | 🔴 Still present: `app.js:11390` observes `document.body {childList,subtree}` and re-runs `applyI18n`/`tnode`/`hydrateMT` on 50ms debounce when `lang!=='he'`. The i18n overhaul unified strings but did NOT remove this walk |
| F-9 | 3.F-ii | S9 | Render-blocking Google Fonts on critical path (~620ms block + 102KB woff2) | P7 | **OPEN** | `build.py:150` / `index.html:18` still load 8 external Google Font families (`display=swap` only) |
| F-10 | 3.F-ii | S9 | No minification for 882KB JS + 172KB CSS | P7 | **OPEN** | `grep -inE "terser|uglify|minif|csso|esbuild" build.py` → 0 |
| F-11 | 3.F-iii | S10/S9 | Lighthouse A11y 94 · SEO 82; failing color-contrast, landmark-one-main, meta-description, robots/llms-txt | P7 | **OPEN** | No P7 a11y work; wave1/wave4-a11y tests are discovery characterization, not fixes |
| F-12 | 3.F-iii | S10 | Default (cream) theme worst contrast — 5 of 8 pairs fail AA (`.foot-stamp` 1.77:1) | P7 | **OPEN** | Accent ramp still untokenised/uncorrected; P7 not started |
| F-13 | 3.F-iii | S10/S9 | `<main>` measures 0×0 (inside hidden `#scr-catalog`); skip link targets a hidden element | P7 | **OPEN** | Not addressed |
| F-14 | 3.F-iii | S9 | Zero `aria-live` regions at rest; `toast()` sets live attrs on the just-inserted node | P7 | **OPEN** | Not addressed |
| F-15 | 3.F-iii | S10 | 25 of 36 home interactive targets under 44px (lane-chip 37px, 13px safety checkbox) | P7 | **OPEN** | Not addressed |
| F-16 | 3.F-iii | S3/S9 | `occ2` + cook timeline carry 0 ARIA / 0 role; fit verdict flips silently for SR users | P7 | **OPEN** | Not addressed |
| F-17 | 3.F-iii | S9 | Wizard focus not managed; Chrome logs aria-hidden-with-focus | P7 | **OPEN** | Not addressed |
| F-18 | 3.F-iii | S9 | 13 unlabelled form fields; 11/11 equipment-form labels unlinked; `#eqvArea` no inputmode | P7 | **OPEN** | Not addressed (equipment form reworked E1–E3 for logic, not label linkage) |
| F-19 | 3.F-iii | S9 | Wizard step 2 puts 279 buttons in the a11y tree, ~40-word names, no group semantics | P7 | **OPEN** | Not addressed |
| F-20 | 3.F-iii | S9 | `label-content-name-mismatch`: `#cHomeLang` aria-label "Language" vs visible `🇮🇱 עברית ▾` | P7 | **OPEN** | Not addressed |
| F-21 | 3.F-iii | S9/S10 | `.cnav` is a plain `<div>` — 0 nav landmarks, 0 aria-current | P7 | **OPEN** | `build.py:331` still `<div class="cnav">` with plain buttons |
| F-22 | 3.F-iii | S9 | User-uploaded content photos ship `alt=""` | P7 | **OPEN** | `app.js:3631` not changed |
| F-23 | 3.F-iii | S10 | No `prefers-color-scheme`; bright cream default at 02:00 | P7 | **WAIVED** | Mechanism explicitly rejected: app themes at runtime via JS, dead media-query block removed (review finding I1, `app.css:1750/1763`). Auto-dark UX concern not otherwise solved — flag if owner wants it |
| F-24 | 3.F-iv | S9 | Installability passive — no `beforeinstallprompt`/`deferredPrompt`/`appinstalled` | P7 | **OPEN** | 0 matches in app.js/index.html/build.py |
| F-25 | 3.F-iv | S9 | Manifest has no `shortcuts`, no `screenshots` | P7 | **OPEN** | `grep shortcuts\|screenshots` → 0 |
| F-26 | 3.F-iv | S9 | No `meta description` | P7 | **OPEN** | `name="description"` → 0 in build.py/index.html (also F-11 SEO failure) |
| F-27 | 3.F-v | S10 | Serving DATE clips the year (`22/07/202`), `width:120px`, no DOM signal | P7 | **OPEN** | `app.css:555-556` not changed |
| F-28 | 3.F-v | S10 | Navigating to Catalog scrolls the search box off-screen while telling you to use it | P7 | **OPEN** | `cNavGo('catalog')` `scrollIntoView` unchanged |
| F-29 | 3.F-v | S10 | Occupancy tile labels truncate to 2–3 chars; full name only in dead `title=` | P7 | **OPEN** | `app.js:568` `Math.max(18,…)` unchanged |
| F-30 | 3.F-v | S3 | "Cannot check capacity" then reports a capacity conflict on the next line | P5b | **OPEN** | Capacity unification (one verdict, D6) not shipped |
| F-31 | 3.F-v | S3 | SV bath over-capacity described in Hebrew as *area* overflow for volume devices | P5b | **OPEN** | `bad='area'` for any over-verdict; capacity unification not shipped |
| F-32 | 3.F-v | S10 | Short-time warning ungrammatical both languages (`ב-אתמול`); reports raw minutes (`1627 דק׳`) | P7 | **OPEN** | Not addressed |
| F-33 | 3.F-v | S7/S10 | Row chevrons never mirror — hard-coded `←` in English | P7 | **OPEN** | Not addressed |
| F-34 | 3.F-v | S10 | "⎙ PDF" print button appears on every panel incl. first-run modal + language picker | P7 | **OPEN** | Shared `toolTop` header unchanged |
| F-35 | 3.F-v | S10 | Projects header block reads as broken (title box 68×72, chips wrap raggedly) | P7 | **OPEN** | Not addressed |
| F-36 | 3.F-v | S10 | Type, space, radius not tokenised (34 font sizes, 24 paddings, 21 radii) | P7 | **OPEN** | No `--space/--radius/--type` tokens in app.css; only `--r` radius token, redefined per theme + used ~few times. Colour tokenised (the counter-example) — matches charter S10 |
| G-1 | 3.G | S9/S7 | "Works with no network" claim in 4 places, both languages — contradicts online-first decision | P0/P2 (R8/R11) | **PARTIAL** | Footer offline claim (was `build.py:334`) **removed** — footer now "…נשמרים בדפדפן"; BUT about panel `app.js:4778-4779` ("קובץ אחד. בלי שרת" / "בלי התקנה, בלי חשבון, בלי שרת") and `README.md:4` ("fully local-first") **still stale** |
| G-2 | 3.G | S4 | No unified `mk-schema` migration registry (since ROADMAP-v149) | P5b | **OPEN** | Charter puts migration registry in P5b (not started) |
| G-3 | 3.G | S11 | Zero analytics anywhere — every allowance/tier/threshold is a guess | P10 | **DEFERRED (R8)** | Charter §12 "do not monetise now"; analytics deferred with pricing |
| G-4 | 3.G | S11 | No account system; managed code is a 72-bit bearer, no device binding, CORS `*` | P10 | **DEFERRED (R8)** | Accounts deferred; CORS still `*` (worker unchanged, see H-3) |
| G-5 | 3.G | S11 | No cloud sync (deliberately deferred pending a business decision) | P10 | **DEFERRED** | Owner-deferred by original design |
| G-6 | 3.G | S2/S3 | No probe integration, no log-import path (staged rec §7 step 12) | P7/later | **DEFERRED** | Staged future recommendation; not scheduled in v261–v272 |
| G-7 | 3.G | S9/S10 | Dead surface: 9 orphan fns, 4 stubs, ~70 lines dead theme CSS, 14/15 dead `data-i18n` | P7 | **OPEN** | No cleanup shipped; overlaps F-5. E1–E3 added code, did not remove the orphans |
| G-8 | 3.G | S5 | 116 empty catches (`catch(e){}`) — majority legitimate PE guards | P7 | **OPEN** | Not swept; the user-visible exceptions live in §3.B.12/§3.B.25 |
| H-1 | 3.H | S11 | No billing code anywhere | P10 | **DEFERRED (R8)** | Charter R8 pricing deferred; §12 "do not monetise now" |
| H-2 | 3.H | S6/S5 | Metering blind to ~90% of cost (grounded-search per-request fee unmetered); 2M cap authorises ~$16 meters ~$1.60 | P10 / P0-app | **DEFERRED (R8)** | Full metering deferred (P10). Underlying **cost** partly mitigated by P0-app search-conditional target ($1.22→$0.39) + v263 token metering; but search-fee metering itself not built |
| H-3 | 3.H | S6 | Four Worker revenue blockers: fail-open, cap-by-omission, TOCTOU, zero rate limiting | P0-worker | **OPEN** | 🔴 `worker/index.js` still 91 lines; CORS still `'*'`; no `429`/`Retry-After`/rate-limit/debit-first. P0-worker ("Blocked on PRE-3") shows no ship in v261–v272 |
| H-4 | 3.H | S11 | Measured unit economics (blended $1.22/mo; 77–90% is the $0.035 search fee) | P10 | **DEFERRED (R8)** | Analysis finding; pricing deferred |
| H-5 | 3.H | S11 | Two business reports contradict 10.9×; reconciliation kills the drafted allowance model | P10 | **DEFERRED (R8)** | Analysis finding; pricing deferred |
| H-6 | 3.H | S11 | Minimum viable price $4.99 floor / $7.99 defensible; margin positive only after search fix | P10 | **DEFERRED (R8)** | Pricing deferred |
| H-7 | 3.H | S11 | Free/paid boundary the code already earns: deterministic free, probabilistic (search) metered | P10 | **DEFERRED (R8)** | Packaging decision deferred |
| H-8 | 3.H | S11 | Market reality: TAM $40–80M · SOM $90k–255k ARR; Israel Y3 ≈ $38k — not venture-scale | P10 | **DEFERRED (R8)** | Analysis finding |
| H-9 | 3.H | S11 | Competitive claim `docs/ai-strategy.md:77` "Nobody owns the software-first AI copilot" overstated | P10 (R8 marketing) | **OPEN** | R8 says correct now; `ai-strategy.md:77` **still says** "**Nobody owns** the software-first AI copilot … offline" — NOT corrected |
| H-10 | 3.H | S11/S2 | Real differentiation measured (Hebrew-first, cited corpus, capacity scheduler); BUT "guards your cure" is a claim the code doesn't earn | P2 (R8 marketing) | **OPEN** | Differentiation confirmed (279 `src` blocks). Cure-guard claim still unearned: cure guard remains advisory — P2 (cure task blocks without a 0.1g scale) not shipped in v261–v272 |
| H-11 | 3.H | S11 | Anova is licence-blocked (personal/non-commercial ToU) — reclassify to hobbyist only | P10 | **DEFERRED (R8)** | Documentation reclassification; no integration exists; commercial track deferred |
| H-12 | 3.H | S11 | Honest recommendation adopted: do not monetise now — problem is unbounded cost, not missing revenue | P10 | **DEFERRED (owner-adopted)** | This IS the R8/§12 decision. A1/A2 flagged as paid-launch blockers, not current bugs |

---

## 6. Burn-down — distance to final

**Of 141 gaps (verdicts grounded in code/CHANGELOG/graph, 2026-07-27, v272):**

| Band | Total | ✅ Closed | ◑ Partial | ⏸ Waived/Deferred | ◻ Open |
|---|---|---|---|---|---|
| A · Safety | 15 | 4 | 3 | 0 | 8 |
| B · Correctness | 31 | 2 | 1 | 0 | 28 |
| C · Orchestrator | 12 | 0 | 0 | 0 | 12 |
| D · Equipment-to-plan | 11 | 1 | 3 | 0 | 7 |
| E · AI | 16 | 6 | 2 | 0 | 8 |
| F · Non-functional | 36 | 3 | 1 | 1 | 31 |
| G · Product-platform | 8 | 0 | 1 | 4 | 3 |
| H · Business | 12 | 0 | 0 | 9 | 3 |
| **TOTAL** | **141** | **16** | **11** | **14** | **100** |

**Reading it honestly.** The shipped work (Phase −1 harness, P1 model migration, P0-app spoken-safety, the **Equipment E1–E3 + CP1** track, and the **P6 localization** overhaul) closed the *user-facing* safety, kit→plan, AI-transport and translation gaps — that is the 16 closed + 11 partial, concentrated in bands A/D/E/F-i18n. The **100 open** are concentrated where whole phases have **not started**: the correctness/plan-pipeline cluster (band B, charter P4/P5), the orchestrator solver (band C, charter P8 — last by design), and the non-functional/perf/a11y/presentation bulk (band F/G, charter P7). Band H (business) is 9 deferred per R8. **This matches the charter's own finding that the programme is mostly a design programme (72 of 141 specified nowhere), not a backlog burn-down — so "16 closed" is early-but-expected, not behind.**

**The immediate open items that are NOT waiting on a big phase (quick, high-value):**
- **A5 cure-scale BLOCK** (currently only warns) — finishes P2 safety gates.
- **A11 / A12** — apply the 18 researched salt values (data-correction gate); feed the 5 visual safety guards into TTS.
- **P0-worker** (band B/H: B19–B22, H-3) — Worker still fails open / CORS `*` / no debit-first; harness + RED test ready.
- **F-8 i18n MutationObserver perf** — the overhaul unified strings but left the whole-body observer walk (62% long-task cost).
- **R8 marketing-claim corrections** (G-1 partial, H-9/H-10) — "works offline / no server / guards your cure" claims now largely untrue post online-first pivot.

**Programme DoD (charter §9):** all 141 closed or owner-waived · every close has a RED→GREEN test · full suite green with the worker ceiling re-measured · CI on every push · live-verify each release · retired docs marked · knowledge graph current (`--mode deep`).
