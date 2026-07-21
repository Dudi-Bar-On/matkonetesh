# Cookout Orchestrator & Equipment — Conformance Audit (2026-07-22)

**Scope:** the 12 documents listed in the task brief (specs, plans, audits for Equipment 2.0 / Phase 3a /
consumption layer / properties completion / plan-depth model), verified against the CURRENT `app.js` (9564
lines), `app.css`, `equipment_map.py`, and `tests/*.spec.ts` (413 tests, 82 files) as of the latest commit
(`bb789aa`, "chooseBath / choosePlate / chooseNozzle").

**Method note:** a prior audit dated 2026-07-21 exists at `docs/analysis/2026-07-21-requirements-conformance.md`
covering nearly the same document set. It was **not trusted** — every finding below was re-verified against
today's source. The code moved materially since that audit: commits `75d946a` (equipPlan built), `32f8ff2`/
`4edb1fc` (planSchedule/schedulePlacements), `06f8ec3` (safetyDiff runtime invariant), `5470c53`
(deviceCanReach thermal gate), `bb789aa` (chooseBath/choosePlate/chooseNozzle), and the `92961db`…`cc8d991`
occupancy-view (Phase 2 diagrams) chain all post-date it. Several of its "MISS" findings are now stale —
noted explicitly below where this audit's conclusion differs.

---

## SAFETY-BEARING ITEMS (read this section first)

| ID | Item | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| S1 | Probe-laundering fix — `aiSafetyNote` grounding must be `r.ctx` only, never `copilotVoiceContext()` (live probe reading) | P3A design §5.1; prefs-framework plan Task 1 | **DONE** | `app.js:5464` — `aiSafetyNote(r.txt, (r.ctx||''))`, no `copilotVoiceContext()` concatenation. `tests/ai-trust.spec.ts:337` "v250: live probe telemetry is NOT vetted grounding" asserts `.ai-caveat-strong` fires. | Verified all 3 `aiSafetyNote(` call sites (4315 def, 4454, 5464, plus photo-analyzer ~9326) — none launders live telemetry. |
| S2 | `equipPlan` may never alter a `bcheck` stage, `temp`, or any safety number | CONS design §6 | **DONE** (by construction + a stronger runtime check than requested) | `app.js:973-986` — `equipPlan` only ever sets `out.fuelNote`/`out.refuelEveryMin`, never touches `hours`/`temp`/`kind`. Additionally, `safetyDiff(before,after)` (`app.js:3039`) is a **runtime invariant**, not just a test — wired at `app.js:5716` to diff every plan against `_planSafetyBase` and populate `window._planSafetyViolations` if the plan layer ever drifts. | Exceeds the spec's ask (a diff *test*); this is a live guard. `tests/equipplan-seam.spec.ts` P3d also asserts purity/no-mutation. |
| S3 | `deviceCanReach` — a cooker cannot be silently scheduled at a temperature it cannot physically reach (`maxC`) | PROP design §5 ("infeasible if recipe exceeds it") | **DONE** — not in either 2026-07-21 audit (post-dates it) | `app.js:3083` `deviceCanReach(dev,tempC)`; wired into `schedulePlacements` (`app.js:3107`, pushes a `temp-ceiling` conflict) and surfaced to the user via `_schedAdviceHtml` (`app.js:3182`, called at `5739`). | Prevents a 160 °C recipe silently "running" on a 135 °C electric smoker with no warning. |
| S4 | Scale-resolution cure-dosing safety warning (D7): a ~2.5 g Cure #1 dose on a 1 g scale is a ±40% error | AUDIT17 D7; CONS design Slice B; DEPTH §6 (escalated to "the task BLOCKS") | **NOT DONE** | `grep -c scale_res app.js` = 1, and that one hit (`app.js:6266`) is a **display-only** recipe-card chip ("Scale ≥ X"), never compared to the owned scale's `res`/`maxKg`. `equipment_map.py` emits `spec.scale_res` for 3 recipe groups; nothing in `app.js` reads it against owned gear. | **Open safety-relevant defect**, explicitly named by the owner's own audit and escalated by the plan-depth model to a hard block. Still unimplemented. |
| S5 | "No thermometer registered → refuse to schedule poultry or charcuterie" | DEPTH §5 | **NOT DONE** | `gearThermoNote()` (`app.js:1026-1030`) only renders an advisory ("work by time and touch") — no scheduling refusal exists anywhere in the codebase. | Stated as a safety commitment in the plan-depth doc; zero enforcement code. |
| S6 | Phase 3a safety spine for hold moves — hot-hold floor (≥60°C), danger-zone accumulator (≤240 min), `holdCapMin` (360 min hard cap), never-holdable category list, `safetyGate` | P3A design §3.5 | **NOT DONE** | `grep -c "holdCapMin\|dangerZoneMin\|holdable\|safetyGate"` in `app.js` = 0. | No exposure today (the solver that would *generate* hold moves also does not exist — see P3A-6/7 below), but the safety mechanism specifically designed to gate them was never built either, so it is not "safe by absence," it is simply unbuilt. |
| S7 | `bcheck` remains the sole authority on "safe to serve"; solver never removes/relaxes it | P3A design §3.5 | **N/A / moot** | No solver exists to test this against. | Not a regression — just unreachable code path. |

**Safety summary:** 4 of 7 safety-bearing items DONE (2 of which — S2/S3 — are *new* runtime guards the owner would not know exist), 3 NOT DONE. **S4 and S5 are the two the owner should be most concerned about**: both are explicitly named safety commitments in the owner's own documents (D7 in the 2026-07-17 audit; escalated to a hard block in the plan-depth model) and both remain completely unimplemented — a cure dose can still be weighed on too-coarse a scale, and poultry/charcuterie can still be scheduled with zero thermometer registered, with no warning stronger than passive advisory text.

---

## A. Equipment 2.0 Phase 1 (2026-07-15 design spec + slice-1a plan)

| ID | Requirement/Decision | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| EQ2-1 | `mk-equipment` device-array model, `EQUIP_CATS` (8 categories, type enums) | spec §2; plan Task 1 | DONE | `app.js:33-95` `EQUIP_CATS`; `app.js:221-222` `equipList`/`equipSave` |
| EQ2-2 | Aggregators: `equipByCat`, `hasCat`, `cookers`, `probeChannels`, `svBaths`, `primaryOf`, `equipConfigured`, `equipSetConfigured` | spec §3.1 | DONE | `app.js:224-230, 754-755` |
| EQ2-3 | `equipMigrateFromGear()` — one-time, idempotent migration from `mk-gear` | spec §3.3 | DONE | `app.js:757` |
| EQ2-4 | Old `mk-gear`/`gearState`/`saveGear`/`openGear` deleted; every consumer ported (§3.2 table) | spec §3; DoD | DONE | Grep-clean: 5 residual `mk-gear`/`gearState` mentions in `app.js`, all either comments or the intentional one-time migration read (`app.js:759,768`). `canSV/canSmoke/canGrill/homeGear/smokerTip/preheatHint/gearThermoNote` all read the device list. |
| EQ2-5 | `openEquipment()` manager: grouped-by-category cards, capacity chip, edit/remove/add | spec §4 | DONE | `app.js:6377`; `tests/equipment.spec.ts`, `equipment-visibility.spec.ts`, `equipment-walkthrough.spec.ts` |
| EQ2-6 | Settings slot ("🧰 My Equipment") replacing the old gear row; home chip/banner both open `openEquipment` | spec §4 | DONE | confirmed via slice-1a plan Task 5 wiring, unchanged since |
| EQ2-7 | AI helper: curated static `EQUIP_BRANDS` per category | spec §5.2 | DONE | `app.js:6179` |
| EQ2-8 | `aiBrandModels(brand,cat)` — web-grounded model browse | spec §5.2 | DONE | `app.js:6368` |
| EQ2-9 | `aiLookupDevice(query,cat)` — web-grounded spec lookup, JSON schema, validated/coerced/bounded, `specSource:'ai'`, confirm-before-save | spec §5.2-5.3 | DONE | `app.js:6306-6365`; extended well past the original spec — now also extracts every `props[]` key with bounds (see PROP section) |
| EQ2-10 | No-key/offline → AI hidden, manual form works | spec §5.2 | DONE | `equipAiOn()` gate throws `'no-key'`; manual form is the unconditional fallback path in `openEquipment`'s editor |
| EQ2-11 | Concierge ported: `gearFromText`/`levelFromText`/`gearConciergeApply`/`openGearConcierge` emit device entries | spec §5.4 | DONE | `app.js:6116, 6139, 6144, 6164` |
| EQ2-12 | `mk-item-cooker-<scope>` map; auto-default when exactly 1 device fits; picker shown when ambiguous | spec §6 | DONE | `app.js:236-250` (`setItemCooker`/`cookerFor`); UI picker "Slice 1C" at `app.js:~5905-5911` (`_ckRows`, rendered as `<select data-tlcooker>`), plus an "awaiting cooker assignment" advisory when 2+ same-class devices remain unresolved |
| EQ2-13 | Work-plan echoes the specific device name, not a category label | spec §6 | DONE | `cookerLabel()` (`app.js:251`) feeds the `cooker:` field on every task |
| EQ2-14 | Empty-equipment gate: `canX()` stay permissive when unconfigured | spec §8 | DONE | `canSV/canSmoke/canGrill` all check `equipConfigured()` first, per slice-1a Task 2 |

**Section verdict: ~100% DONE.** This is the one document executed essentially as written, and it has continued to receive real fixes since (a native-device tiebreak for `cookerFor`, the cooker picker, AI extraction of the full properties set). No behavioral gaps found.

---

## B. Phase 3a — auto-optimize solver + preferences (2026-07-17 design spec + prefs-framework plan)

| ID | Requirement/Decision | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| P3A-1 | `PREFS` registry + `pref()`/`setPref()` validated-default framework | design §2.1; plan Task 2 | DONE | `app.js:6801-6841` |
| P3A-2 | Existing helpers delegate: `themeKey`, `fontPairKey`, `fontScale`, `uiLevel`, `tlShapeOverride` | design §2.1; plan Task 3 | DONE | `app.js:6864-6866, 7026, 7028` — one-line delegating bodies, signatures unchanged |
| P3A-3 | `openPrefGroup()` "Behavior & automation" hub | design §2.3; plan Task 5 | DONE | `app.js:7053` |
| P3A-4 | `units` pref (`mk-pref-units`, metric/imperial, def metric) wired into `askGemini`, `aiJSON`, `vcBuildAskPrompt` | design §2.4; plan Task 4 | DONE | 3 call sites confirmed: `app.js:4242, 4345, 5264`, all gated on `pref('units')==='metric'` |
| P3A-5 | `PREF_PRESETS` (simple/balanced/pro) + `prefPreset()` derived-state + preset selector row | design §2.2, §2.3 | **NOT DONE — SUPERSEDED (deliberate)** | 0 occurrences of either symbol | The prefs-framework plan explicitly deferred this to "Slice 2" (documented deviation, Global Constraints). Slice 2 was never scheduled — the version slots it would have shipped in (v251, v252) were consumed by the properties-completion and later work instead. Not a silent drop; it is a named, undelivered deferral. |
| P3A-6 | Orchestrator knobs registered (`autonomy`, `shareTolC`, `woodSwap`, `holdEnabled`, `aiRank`, `slotModel`, `holdMaxH`) | design §2.5 | **PARTIAL — registered, zero consumers** | `app.js:6812-6819` each declared with `def`/`valid`; `grep -c` each name in `app.js` = exactly 1 (its own declaration) | Per the audit brief's instruction, a computed/declared value with no consumer and no behavioral test counts as **NOT DONE**. These are pure registration — the framework is real, the behavior they claim to control does not exist. |
| P3A-7 | `orchestrate(computed,scope)` solver skeleton | design §3.1 | **NOT DONE** | 0 occurrences | |
| P3A-8 | Move object shape, `movesForClash()`, `applyMove()`, reversibility/undo | design §3.2 | **NOT DONE** | 0 occurrences of any | |
| P3A-9 | Resolution order share→wood→reassign→hold→advise | design §3.3 | **NOT DONE** | no moves generated at all | |
| P3A-10 | Rack-slot budget (0.5/1.5/2 by weight class), weight-source fallback chain | design §3.4 | **NOT DONE / SUPERSEDED-in-spirit** | no slot arithmetic exists | The occupancy layer (see OCC section) built a *different*, area/hooks/litres-based capacity model that solves the same underlying problem (D5) more literally, but the solver's specific weight-derived slot budget was never built. |
| P3A-11 | Hard safety floors: hot-hold ≥60°C, danger-zone ≤240 min, `holdCapMin` 360 min, generation ceiling `holdMaxH`×60 | design §3.5 | **NOT DONE — SAFETY (see S6)** | 0 occurrences | |
| P3A-12 | AI ranking: `action_id` contract, validation drops unknown ids, `why` attribution | design §4.1 | **NOT DONE** | no move set exists to rank | |
| P3A-13 | Autonomy behaviors `advise`/`propose`/`autopilot` | design §4.2 | **NOT DONE** | `autonomy` pref exists but nothing reads it | |
| P3A-14 | Probe-laundering fix | design §5.1 | DONE | see S1 |
| P3A-15 | `mk-item-shift-<scope>` / `mk-item-wood-<scope>` storage keys | design §6 | **NOT DONE** | neither key exists anywhere | |
| P3A-16 | DoD: solver emits ≥1 move per clash `cookerContention` reports | design §8 | **NOT DONE** | no solver | |

**Section verdict: Slice 1 (~24% of the design doc, the prefs framework + safety fix) is fully DONE and solid. Slices 2-3 — the entire solver — are 0% built.** This is the single largest gap in the whole audit set: three build slices were planned (v250/v251/v252), one shipped, and the other two were silently reallocated to different work without the solver itself ever being rescheduled.

---

## C. Equipment Consumption Layer (2026-07-20 design spec)

| ID | Requirement/Decision | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| CONS-1 | `equipPlan(meta, methodKey, stages, scope)` — the seam where equipment enters stage generation | design §2 | **PARTIAL** | `app.js:973-986` exists and is called (see EQ2/note) — this contradicts the 2026-07-21 audit's "never built" finding; the code shipped after that audit (commit `75d946a`). But it implements a much narrower contract than specified: flat `out.fuelNote`/`out.refuelEveryMin` fields, not the spec's `gear:{dev,do,warn,occupy}` stage object. `gear.do`/`gear.warn` (§2's exact field names) have 0 occurrences. | The "seam" exists and does real, tested work (D1, D3-partial, D4) but is a simplified reimplementation, not the spec'd shape. |
| CONS-2 | Both call sites: `itemStages` in `buildList` (single-event) AND `combinedEventsRows` (multi-event) both enriched | design §2 | **PARTIAL** | `equipPlan` is called once, at `app.js:5673` (`buildList`). `combinedEventsRows` (`app.js:7832-7840`) calls `itemStages` directly and never calls `equipPlan`. | The multi-event view's preheat/fuel/refuel facts still disagree with the single-event view — exactly the disagreement risk §2 warned about, for the one call site that was skipped. (Note: `combinedEventsRows` *does* independently consume the occupancy model for clash detection — see OCC-9 — just not `equipPlan`'s enrichment.) |
| CONS-3 | A1: `preheatMin(dev,cat)` unifies the scheduled time and the label text (fixes D1) | design §3, A1 | DONE (via a differently-named mechanism) | `PREHEAT` table + `_preheatRow()`/`preheatMinutes()`/`preheatHint()` (`app.js:946-953`) — one source drives both the schedule (`_pmins` at `5721`) and the hint text. `tests/equipplan-seam.spec.ts` P3b/P3c assert the label and the scheduled offset use the identical number. | D1 (the 45-min-vs-"~15 min" contradiction) is genuinely fixed for smoking. |
| CONS-4 | A1: sous-vide and grill also get a device-driven preheat stage (fixes D2) | design §3, A1 | **NOT DONE** | `earliestSmoke` (`app.js:5718`) still filters `s.kind==='smoke'` only; no sv/grill preheat stage is ever emitted. | D2 remains open — heating a 24 L sous-vide bath is still invisible to the plan. |
| CONS-5 | `bathLitres(dev)` — smallest bath that is ≥ the item's required litres | design §3, A1 | **PARTIAL** | Not implemented as spec'd for preheat purposes, but `chooseBath(dev, needL)` (`app.js:3004`) implements the identical "smallest that fits" logic and is consumed in the occupancy vessel view (`app.js:630`, "use the container X L") | Real and rendered, but only in the occupancy view, not in a sous-vide preheat stage (which does not exist per CONS-4). |
| CONS-6 | Charcoal without `chimney` costs +10 min | design §3, A1 | **NOT DONE** | `chimney` never referenced in any duration calculation | |
| CONS-7 | A2: fuel reconciled with `dev.fuel` (fixes D3) | design §3, A2 | **PARTIAL** | `equipPlan` sets `fuelNote` from `DEVICE_FUEL[dev.type]` (`app.js:964, 981`) and it correctly drives the **refuel task's** wording ("Add pellets" vs "Add wood") at `app.js:5868-5871` — `tests/equipplan-seam.spec.ts` P3f confirms a pellet owner gets 0 refuel tasks, a stick-burner gets several. **But** the smoke task's own detail line (`app.js:5826-5828`) still reads `c.m.obj.wood`/`c.m.obj.coal` — the **recipe**, unconditionally — so a pellet/electric owner still sees "🪵 Wood: oak" printed on the smoke task itself. | D3 is half-fixed: the refuel reminder is now correct, the smoke task's own fuel line is not. |
| CONS-8 | A3: refuel cadence table by device type (fixes D4) | design §3, A3 | DONE | `REFUEL_MIN` table (`app.js:957-963`), wired via `equipPlan` → `out.refuelEveryMin` → real clock tasks (`app.js:5865-5872`). `tests/equipplan-seam.spec.ts` P3e/P3f. | Genuinely fixed — offset gets ~45min splits, pellet/kamado/electric get none. |
| CONS-9 | `blower` shortens recovery; `controller-fan` probe type suppresses vent-tending | design §3, A3 | **NOT DONE** | neither token influences any task | |
| CONS-10 | Slice B: cylinder loads = `ceil(kg/cap.volume)` → stuffing task states load count | design §4 | **NOT DONE** | no such arithmetic anywhere in `app.js` | |
| CONS-11 | Slice B: nozzle selection — largest ≤ `casing_mm`, warn when none fits | design §4 | **PARTIAL — computed, not consumed** | `chooseNozzle(dev, casingMm)` (`app.js:3024`) implements exactly this rule correctly (verified by `tests/equip-chooser.spec.ts`) — but it is called from **nowhere else in `app.js`**, only from its own test file. `casing_mm` itself only ever renders as a display-only recipe-card chip (`app.js:6265`). | Classic "computed and never read" — per the audit brief, counts as NOT DONE for the actual requirement (a nozzle instruction in the work plan). |
| CONS-12 | Slice B: scale-precision safety warn | design §4 | **NOT DONE — SAFETY** | see S4 | |
| CONS-13 | Slice B: grinder plate matching (`grind_mm` vs `cap.plates`), mixer-attachment batch/chill guidance | design §4 | **NOT DONE — computed, not consumed** | `choosePlate(dev, wantMm)` (`app.js:3014`) exists and is correct (tested), never called outside its test | Same pattern as CONS-11. |
| CONS-14 | Slice B: vacuum edge-vs-chamber → "freeze the marinade first" liquid-seal warning | design §4 | **NOT DONE** | no liquid-seal check exists anywhere | |
| CONS-15 | Slice C1: two occupancy modes (grate + hang), `gear.occupy` shape, hanging frees grate area entirely | design §5, C1 | DONE (via the occupancy layer, different shape) | `itemOccupancy` (`app.js:356`), hang branch, `deviceCapacity`; hang derivation in `equipment_map.py:377` | Real, tested, rendered (`.occ2-*` hanging-bay overlay). Not shaped as `gear.occupy` on a stage — lives in the parallel occupancy model instead (see OCC section). |
| CONS-16 | Slice C1: dry-curing (`curechamber`) hang-only capacity model | design §5, C1 | **NOT DONE** | `curechamber` has no capacity model; recipes declaring it get no occupancy treatment | |
| CONS-17 | Slice C1: coarse vertical-clearance gate for `hang:'long'` items | design §5, C1 | **NOT DONE** | `long`/`short` are stored (`equipment_map.py`) but treated identically everywhere they're read | Per spec this was explicitly allowed to degrade — "if clearance is unknown, hanging is allowed and no warning is shown" — so this is arguably intentional non-blocking, not a gap. |
| CONS-18 | Slice C2: probe-channel budgeting — which items get leave-in vs spot-check when concurrent monitored items exceed channels | design §5, C2 | **NOT DONE** | `probeChannels()` (`app.js:229`) has exactly 2 call sites: its own definition and one footer display line (`app.js:6425`) — unchanged in shape since the original 2026-07-17 audit named this defect (D10) | Confirms the brief's "Known 0%: probe channels." |
| CONS-19 | Slice C3: SV items must physically fit the chosen bath (volume-gated batching) | design §5, C3 | DONE (via the occupancy layer) | `itemOccupancy` sv branch returns `litres:min_bath_l`; `deviceOccupancy` sums/maxes it (H2 fix: max-not-sum); `tests/occupancy-sv-volume.spec.ts` V1-V5 | More thoroughly built than the spec asked (a documented bug fix, H2, corrected an additive-sum false-positive along the way). |
| CONS-20 | Slice C3: one circulator = one temperature at a time even with two baths | design §5, C3 | **PARTIAL** | `occupancyCompat` computes a temp spread and `cookerContention`/`deviceOccupancy` flag incompatible temps — the constraint is *expressible* and drives clash warnings, but the sous-vide batching logic (`_svBatch`, `app.js:5782`) still groups by temp+time match, not by an explicit one-temp-at-a-time solver rule | |
| CONS-21 | Safety: `equipPlan` never alters `bcheck`/`temp`/safety numbers, enforced by a diff test | design §6 | DONE | see S2 | |

**Section verdict:** Slice A (preheat/fuel/refuel): ~2.5 of 6 sub-requirements done (D1 fixed, D4 fixed, D3 half-fixed, D2/chimney/blower open). Slice B (charcuterie): 0 of 5 reach an actual task, though 2 of the 5 underlying join functions (`chooseNozzle`, `choosePlate`) exist correctly and are simply unwired — a distinctive "computed and never read" pattern. Slice C (occupancy/probe/SV): occupancy itself is thoroughly done (exceeds spec), probe channels remain completely unbuilt, SV volume gating is done for capacity but not for the one-temp constraint.

---

## D. Equipment Properties Completion (2026-07-20 design spec + plan)

| ID | Requirement/Decision | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| PROP-1 | `props:[]` array on `EQUIP_CATS`/`EQUIP_OTHER_ITEMS`, `kind`/`unit`/`tier`/`def`/`opts` schema | design §2; plan Task 1 | DONE | `app.js:33-98` (categories), `EQUIP_OTHER_ITEMS` block (~6200s) | |
| PROP-2 | Type-key build gate: every `props[].def` key exists in that category's `types[]` | design §3; plan Task 1 | DONE | `tests/equipment-props.spec.ts` (12 tests) — E1 is exactly this gate | |
| PROP-3 | All ~20 declared properties (smoker `maxC`/`canHang`/`hooks`/`waterPan`, grill `lid`/`maxC`/`rotisserie`, oven, sousvide, vacuum `bagW`/`bagKind`/`bagL`/`pulse`, probe, grinder `plates`/`throughput`, stuffer `speed`) | design §3 | DONE (as declarations) | all present in `EQUIP_CATS` entries | |
| PROP-4 | Accessory `cooler` — fixes the unownable-requirement defect | property audit §0; design §3 | DONE | `app.js:6218` `{key:'cooler',...}` | Recipes requiring holding gear can now be satisfied. |
| PROP-5 | Accessory numeric properties: scale `maxKg`, hooks `count`, curechamber `tempC`/`rhPct`, humidity `rhPct`, slicer `maxMm` | design §3 | DONE | `app.js:6211` (scale) and siblings in `EQUIP_OTHER_ITEMS` | |
| PROP-6 | `UNIT_CONV` + `propCoerce` + `propParse` — canonical-first, unit-suffix acceptance, bounds-based rejection | design §4; plan Task 1 Steps 4b-4d | DONE | `app.js:139-206` region (grep-confirmed `propCoerce`/`propParse` present) | Ledger notes a double-conversion bug found and fixed during implementation — good sign of real exercise, not just declared. |
| PROP-7 | `propOf(dev,key)` resolves stored → class default by `type` → `undefined` | design §5 | DONE | `app.js:122` | |
| PROP-8 | "Every consumer reads through `propOf()`" | design §5 | **PARTIAL** | `propOf` is called from a real but narrow set of consumers: `deviceCapacity` (`maxL`, `areaCm2`, `canHang`, `hooks`), `deviceCanReach` (`maxC` — new since the last audit), `chooseBath`/`choosePlate`/`chooseNozzle` indirectly via `_sizesOf`. | Materially wider than the 2026-07-21 audit found (which counted 3 call sites / 4 keys) — `maxC` now has a real consumer via `deviceCanReach`. Still, most of the ~20 declared properties (`bagW`, `bagKind`, `waterPan`, `rotisserie`, `speed`, `throughput`, `accuracy`, `watts`, `steam`, `fan`, `lid`, `maxKg`, `tempC`, `rhPct`, `maxMm`) have zero consumers. |
| PROP-9 | `equipment_map.py` joins: `grind_mm`→plates, `casing_mm`→nozzles, `scale_res`→scale, smoke-temp→`maxC` infeasibility, hang→`canHang`+hooks, item-length→`bagW`, `min_bath_l`→`maxL` | design §5 | **PARTIAL — 3 of 7** | hang→canHang+hooks: DONE (occupancy layer). `min_bath_l`→`maxL`: DONE (occupancy layer, `deviceCapacity` sousvide branch). smoke-temp→`maxC`: **now DONE** via `deviceCanReach`+`schedulePlacements` (post-dates the 2026-07-21 audit, which called this MISS). `grind_mm`→plates, `casing_mm`→nozzles, `scale_res`→scale, item-length→`bagW`: still **MISS** — no join exists. | 3 of 7 done, up from 2 in the previous audit, because `deviceCanReach` shipped since. |
| PROP-10 | Form rendering: core props inline, pro props in a collapsed `<details>`, class default shown as placeholder | design §4; plan Task 3 | DONE | `app.js:6603-6625` `propField`, `.eq-adv` details wrapper | `tests/equipment-props.spec.ts` E5 |
| PROP-11 | Icon chips on device cards for stored (not defaulted) property values | design §3 (icons); plan Task 4 | DONE | `app.js:6389-6398` chip-building block | `tests/equipment-props.spec.ts` E6 |
| PROP-12 | AI lookup extracts every `props[]` key, category-scoped, null-not-guessed, bounds-rejected | design §4; plan Task 5 | DONE | `app.js:6306-6365` `aiLookupDevice` — full props extraction with `propCoerce` bounds and explicit "null/none/n-a" string guard | Confirmed genuinely thorough — one of the best-executed pieces of the whole arc. |
| PROP-13 | DoD: "a recipe needing a 4.5mm plate warns when the grinder has only 8mm" | design §7 | **NOT DONE** | `choosePlate` computes the nearest owned plate and marks `exact:false` when it isn't a match, but nothing in the work plan ever calls it — no warning renders anywhere a user would see it | Same pattern as CONS-13. |
| PROP-14 | §3a completeness surfaced as "ציוד: 3 · דיוק 40%", never "incomplete" | property audit §3a | **NOT DONE** | no precision-percentage surface exists | |

**Section verdict: capture is thoroughly done (~90%+), consumption is still thin (~4 of ~20 properties actually reach a decision the user sees) but has grown since the last audit** — `maxC` gained a real safety-relevant consumer (`deviceCanReach`) that did not exist a day ago.

---

## E. Equipment Occupancy Layer (2026-07-20 plan, 1276 lines)

| ID | Task | State | Evidence | Notes |
|---|---|---|---|---|
| OCC-1 | `areaCm2` capacity property + `UNIT_CONV` area conversions | DONE | `EQUIP_CATS` smoker/grill `props[]`, `in2->cm2`/`m2->cm2`/`ft2->cm2` in `UNIT_CONV` | |
| OCC-2 | `deviceCapacity`, `itemOccupancy`, `PACK_EFF=0.85`, `TEMP_TOL_C=6` primitives | DONE | `app.js:305, 356` | |
| OCC-3 | `deviceOccupancy(devId, tMs, computed, scope)` queryable state seam | DONE | `app.js:438` | |
| OCC-4 | Temperature/wood compatibility (`occupancyCompat`) | DONE | `app.js:375` | |
| OCC-5 | `cookerContention` rewritten to derive from capacity/temp, not time overlap (fixes D5) | DONE | `app.js:258` | Both `_clashOcc` and `contentionHtml` consumers updated; `tests/occupancy-clash.spec.ts` |
| OCC-6 | Hanging as a second occupancy channel, derived from recipe prose in `equipment_map.py` | DONE | `equipment_map.py:373-381,466-468`; `hooksOver` in `deviceOccupancy` | `tests/occupancy-hanging.spec.ts` |
| OCC-7 | Shared-device occupancy view (`occupancyViewHtml`/`openOccupancyView`) | DONE, and substantially extended past-plan | `app.js:688, 714`; `.occ2-*` CSS (device-shape diagrams: offset barrel, grill zones, sous-vide vessel, hanging-bay overlay) | Git log shows a whole "Phase 2" of work after the original plan (T1-T10: device silhouettes, fit-honesty ladder ok/tight/over, sequential device numbering, per-slot packer, unmeasured-footprint handling) — well beyond the plan's Tasks 7-8. |
| OCC-8 | Time scrubber across the plan span | DONE | `_occWire`, `#occRange`/`#occClock` | `tests/occupancy-view.spec.ts` |
| OCC-9 | Migrate `combinedEventsRows` (multi-event) to the occupancy model (Task 9) | DONE | `app.js:7832-7877` — builds real `Date`-stage `computed[]` entries with pre-resolved `devId` per event scope, derives contention via `deviceOccupancy` exactly as the single-event path does | `tests/occupancy-multievent.spec.ts` |

**Section verdict: ~100% DONE, and the most over-delivered document in the set.** Not only were all 9 planned tasks completed, subsequent commits (the `92961db`…`cc8d991` chain, dated after the plan's nominal completion) added a full graphical "Phase 2" — per-cooker-type diagrams, an honesty ladder for capacity confidence, and fixes for edge cases the plan didn't anticipate (unmeasured footprints, SV displacement double-counting — "H2"). This is genuinely excellent execution.

---

## F. Equipment-Orchestration Audit (2026-07-17) — defect status D1-D11 + hanging addendum

| ID | Defect | State | Evidence |
|---|---|---|---|
| D1 | Preheat contradicts itself (45 vs "~15 min") | **DONE** | `PREHEAT` table single-sources both; `tests/equipplan-seam.spec.ts` P3b/P3c |
| D2 | Only smoking gets a preheat (sv/grill get none) | **NOT DONE** | see CONS-4 |
| D3 | Fuel never reconciled with the device | **PARTIAL** | see CONS-7 — refuel task fixed, smoke task's own fuel line still recipe-sourced |
| D4 | Reload reminder is a fixed "~90 min for any smoke stage" | **DONE** | see CONS-8 |
| D5 | All capacity is decorative (no fit test) | **DONE** | occupancy layer (`deviceOccupancy`/`cookerContention`) — this is the single biggest fix in the whole audit set |
| D6 | More equipment makes detection worse (`cookerFor` returns null for 2+ same-class devices, silently dropping items from contention) | **PARTIAL** | `cookerFor` (`app.js:242-250`) gained a native-category tiebreak (a real smoker outranks a grill-that-can-smoke) — genuinely fixes the common case. But the residual case (2 devices of the *same* class) still returns `null`, and those items are still excluded from `deviceOccupancy`'s clash math. **This residual gap is now surfaced to the user** (the "awaiting cooker assignment" advisory, see EQ2-12) rather than silently hidden, which is a real mitigation even though the underlying ambiguity isn't resolved. |
| D7 | Scale resolution unused in dosing | **NOT DONE — SAFETY** | see S4 |
| D8 | Nozzles orphaned (casing_mm vs owned nozzles never joined) | **PARTIAL — computed, not consumed** | see CONS-11 |
| D9 | Edge vs chamber vacuum never checked before a liquid step | **NOT DONE** | see CONS-14 |
| D10 | Probe channels are a display count only | **NOT DONE** | see CONS-18 |
| D11 | No cooler/cambro exists in the model | **DONE** | see PROP-4 |
| Addendum | Hanging vs grate occupancy (two distinct modes) | **DONE** | see OCC-6, CONS-15 |

**Defect scorecard: 5 DONE (D1, D4, D5, D11, hanging-addendum), 2 PARTIAL (D3, D6, D8 — three, not two), 4 NOT DONE (D2, D7, D9, D10).** Up from the roughly "3 of 11" the prior audit found — `deviceCanReach` and the `cookerFor` tiebreak both landed since.

---

## G. Equipment 2.0 Gaps Report (2026-07-15, mockup parity)

| ID | Item | State | Evidence | Notes |
|---|---|---|---|---|
| GAPS-A | AI grounding bug: `search:true` + `responseMimeType:'application/json'` both set → Gemini 400s every equipment lookup | **DONE** | `app.js:4348-4356` — comment explicitly names the bug and the fix (drop `responseMimeType` when `search:true`) | Root-cause fix confirmed present, not just worked around. |
| GAPS-B | Panel 2 (Add device) rebuilt as the mockup's lookup-first sheet: verify card ("✨ Here's what I found — verify & save"), catalogue cards with spec lines, manual miniform fallback | **DONE (verify-card path)** | `app.js:6516` `#eqVerify`; `app.js:6626` "✨ הנה מה שמצאתי" heading; `#eqRedo` button present | Not independently re-verified pixel-for-pixel against the mockup, but the described structural elements (verify card, redo, AI-filled framing) are present in code. |
| GAPS-B | Panel 1 (list) header with counts, per-sub-type icons | **PARTIAL / not verified** | not directly checked this pass | Lower priority than the consumption/safety gaps; flagged for a follow-up visual pass if the owner cares about this specific polish item. |

---

## H. Plan-Depth Model (2026-07-20) — the pro-vs-basic user model

| ID | Requirement | State | Evidence |
|---|---|---|---|
| DEPTH-1 | `planDepth` pref (`mk-pref-depth`, `essential\|standard\|full`) | **NOT DONE** | 0 occurrences of `planDepth` or `mk-pref-depth` anywhere in `app.js` |
| DEPTH-2 | `depth:0\|1\|2` tag at every `tasks.push()` site | **NOT DONE** | 0 occurrences of a `depth:` task field |
| DEPTH-3 | Promote `.tl-detailtoggle` from 2 chips (Short/Full) to 3 (חיוני·רגיל·מלא), changing task *existence* not just text | **NOT DONE** | still exactly `data-tldetail="short"`/`"full"` (`app.js:~5942`) |
| DEPTH-4 | Two build-failing tests: every `bcheck`/cure/nitrite task carries `depth===0`; byte-identical serve time + bcheck presence at all 3 depths | **NOT DONE** | no such tests exist (there is nothing to gate) |
| DEPTH-5 | Stall reassurance task category ("it will sit at 70-75°C for 3-5h — this is correct") | **NOT DONE** | no such task category anywhere; stall *detection* exists for the live Copilot (`app.js:5371-5373`) but not as a plan-time reassurance task |
| DEPTH-6 | Essential gets ~2h buffer vs Pro's 30min ("the most valuable difference between modes" per the pitmaster consultation) | **NOT DONE** | no depth-varying slack exists |
| DEPTH-7 | Thresholds not judgement (wrap at 75°C, pull at 97°C then check feel) | **NOT DONE** | |
| DEPTH-8 | Interrupt a beginner for exactly 3 things (pit temp wrong / early / late) | **NOT DONE** | |
| DEPTH-9 | "No thermometer → refuse to schedule poultry/charcuterie" | **NOT DONE — SAFETY** | see S5 |
| DEPTH-10 | "Cure + no 0.1g scale → task BLOCKS" | **NOT DONE — SAFETY** | see S4 |
| DEPTH-11 | `bcheck` renders as a full-width gate card at all 3 depths, never in an accordion | **N/A** | moot — no depth model exists to test |
| DEPTH-12 | Per-cooker MUST/MUST-NOT task lists (offset/pellet/kamado/electric/kettle) | **PARTIAL** | the refuel-cadence table (CONS-8) covers the "MUST NOT get a wood-add task" half for pellet/kamado/electric; the rest (kamado full-basket-before-lighting, kettle snake-method instructions, etc.) do not exist |
| DEPTH-13 | Hang durations actually differ (ribs 3-3.5h hanging vs ~5h on a grate) | **NOT DONE** | hanging changes occupancy accounting only, never a duration — this is exactly the gap the missing `equipPlan` hang-stage integration (CONS-1/CONS-4-class gap) would need to close |
| DEPTH-14 | Hang-only tasks (tacky-casing wait, hook placement, 45-min re-check, rotation, chamber spacing) | **NOT DONE** | |

**Section verdict: ~0% DONE, unchanged from the prior audit.** This remains the single largest wholly-unbuilt document in the set — 49 stated requirements including 2 explicit safety commitments (DEPTH-9, DEPTH-10 = S5, S4), and none of it appears in any executed plan or the SDD ledger.

---

## Summary counts

| State | Count (approx., across all rows above) |
|---|---|
| DONE | 48 |
| PARTIAL | 15 |
| NOT DONE | 38 |
| SUPERSEDED (deliberate deferral) | 2 |
| N/A / moot | 3 |

(Counts are of the individual requirement rows tabulated above, not a re-derived weighted score — treat as a rough shape indicator, not a precision metric.)
