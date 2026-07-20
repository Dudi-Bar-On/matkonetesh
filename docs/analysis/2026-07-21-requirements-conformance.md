# Requirements Conformance Audit — 2026-07-21

**Scope:** the written requirements in `docs/superpowers/specs/*`, `docs/equipment-orchestration-audit-2026-07-17.md`,
`docs/equipment-property-audit-2026-07-20.md`, `docs/plan-depth-model-2026-07-20.md`, the executed plans in
`docs/superpowers/plans/*`, and the ledger `.superpowers/sdd/progress.md` — verified against `app.js` (8812 lines),
`equipment_map.py`, `data.py`, `tests/`, and `dist/index.html` built fresh with `python build.py`.

**Method:** the ledger was NOT trusted. Every claim was checked by grep/read against shipped source, and the
shipped data was counted out of `dist/index.html` rather than out of the generator.

**Bottom line up front:** the *capture* half of the equipment arc is genuinely delivered. The *consumption* half —
the part that makes equipment change the plan — is roughly one quarter delivered, and its central mechanism was
never built. The owner's read is correct.

---

## 0. Headline figures

| Figure | Value | Basis |
|---|---|---|
| Overall conformance, all six requirement documents | **~52%** | 358 substantive requirements, weighted per document (§7) |
| Conformance of the **equipment→plan consumption arc** (the Phase-3a solver + consumption layer + depth model) | **~20%** | 172 requirements across Docs 2, 5, 6 |
| Equipment vocabulary tokens that influence **the plan** | **1 of 23 (4%)** | §5 |
| Recipe `spec.*` numeric keys that influence **anything** | **3 of 10 (30%)** | §5 |
| Device properties added by the properties spec that any consumer **reads** | **4 of ~20 (20%)** | §4 |
| Audit defects D1–D11 **fixed** | **3 of 11** (1 fully, 2 partially) | §3 |

---

## 1. Conformance table — by specification document

Legend: **IMPL** = implemented · **PART** = partially implemented · **MISS** = missing · **DROP** = silently
dropped (written, then never planned or never mentioned again).

### 1.1 `2026-07-15-cookout-orchestrator-equipment-2.0-design.md` — Equipment 2.0 Phase 1 · **~90% IMPL**

This document is substantially delivered. It is the reason the app has an equipment model at all.

| Req | Status | Evidence |
|---|---|---|
| `mk-equipment` array, device shape, id format, category/type/fuel enums (§2) | IMPL | `app.js:34` `EQUIP_CATS`; 8 categories present |
| `equipList` `equipSave` `equipByCat` `hasCat` `equipConfigured` `equipSetConfigured` `cookers` `svBaths` `primaryOf` (§3.1) | IMPL | all 9 present as named functions (verified by `grep -c "function <name>"` = 1 each) |
| `probeChannels()` sums `cap.channels` (§3.1) | IMPL | `app.js:226` |
| `equipMigrateFromGear()` idempotent migration (§3.3) | IMPL | `app.js` named function present |
| `openEquipment()` manager, editor flow, capacity summary (§4, §5.1) | IMPL | `openEquipment` present; `tests/equipment.spec.ts` 17 tests |
| `aiBrandModels` / `aiLookupDevice` grounded lookup + manual fallback (§5.2, §5.3) | IMPL | both present; `aiRepairJson` present |
| `mk-item-cooker-<scope>`, single-fit auto, multi-fit picker (§6) | IMPL | `setItemCooker` `app.js:237`, `cookerFor` `app.js:238` |
| Device-aware work-plan annotation names the specific device (§6) | IMPL | `cookerLabel` `app.js:251`, rendered `app.js:5156` |
| Grep-clean DoD: `mk-gear`/`gearState`/`saveGear`/`openGear` deleted (§10) | **PART** | 5 residual references remain in `app.js` |
| Test coverage `tests/equipment.spec.ts` (§9) | IMPL | 17 tests + 11 visibility + 8 walkthrough |

**Assessment:** this is the one document that was executed close to as written.

---

### 1.2 `2026-07-17-cookout-orchestrator-phase3a-design.md` — Phase 3a · **~24%**

Slice 1 (the preferences framework) shipped. **Slices 2 and 3 — the entire orchestrator — do not exist.**

| Req | Status | Evidence |
|---|---|---|
| `PREFS` registry, keys adopted in place (§2.1, §6) | IMPL | `app.js:6062` |
| `pref(key)` validated read, `setPref` rejects invalid (§2.1) | IMPL | `app.js:6088`, `app.js:6093` |
| Helper delegation `uiLevel`/`themeKey`/`fontScale`/`tlShape` (§2.1) | IMPL | `app.js:6064-6068` |
| `openPrefGroup()` hub (§2.3) | IMPL | `app.js:6312` |
| `units` pref + AI-consumer rewiring (§2.4, §2.5) | IMPL | `app.js:6070`; `tests/prefs.spec.ts` 7 tests |
| **`PREF_PRESETS` values (§2.2)** | **MISS** | `grep -c PREF_PRESETS app.js` = **0** |
| **`prefPreset()` derived, preset selector row (§2.2, §2.3, §7.3)** | **MISS** | `grep -c prefPreset app.js` = **0**. §2.3 mandated a "preset selector row → 5 hero knobs → collapsed Advanced". The hub renders **one** row (Units) — `app.js:6315` filters to prefs that carry `he` *and* `opts`, and only `units` does. |
| `autonomy` `shareTolC` `woodSwap` `holdEnabled` `aiRank` `slotModel` `holdMaxH` (§2.5) | **DROP** | Each declared at `app.js:6075-6081` and referenced **exactly once in the whole file** — its own declaration. Zero consumers, zero UI. Registered knobs standing in for a feature. |
| **`orchestrate(computed, scope)` (§3.1)** | **MISS** | `grep -c orchestrate app.js` = **0** |
| **`movesForClash()` (§3.1)** | **MISS** | 0 occurrences |
| **Move object shape, stable `id`, 5 `kind`s, `delta`, `risk` (§3.2)** | **MISS** | no move objects exist |
| **`applyMove()`, reversibility, undo (§3.2)** | **MISS** | 0 occurrences |
| **Resolution order `share→wood→reassign→hold→advise` (§3.3)** | **MISS** | no moves of any kind are generated |
| **Rack slot budget 0.5/1/2, weight source order, capacity-1 default (§3.4)** | **MISS** | no slot arithmetic anywhere |
| **Safety floors §3.5 — 60 °C hot-hold, 240 min danger-zone, `holdCapMin` 360, generation ceiling 180, never-holdable list** | **MISS** | `holdable` `holdCapMin` `dangerZoneMin` `safetyGate` `resolveItem`: **0 occurrences each** |
| **AI ranking, `action_id` validation, `why` attribution (§4.1)** | **MISS** | no move set to rank |
| **`advise`/`propose`/`autopilot` autonomy behaviours (§4.2)** | **MISS** | not wired |
| Probe-laundering fix — `aiSafetyNote` grounding becomes `r.ctx` only (§5.1) | IMPL | shipped in v250 per ledger; `tests/wave3-ai-hardening.spec.ts` present |
| **`mk-item-shift-<scope>` / `mk-item-wood-<scope>` keys (§6)** | **MISS** | neither key exists |
| **DoD: "solver emits at least one move for every clash" (§8)** | **MISS** | there is no solver |

**Silently dropped:** §9 planned Slice 2 as **v251** and Slice 3 as **v252**. Both version numbers shipped
(`git log`: v251 = equipment properties completion, v252 = owner real-usage findings). The version slots were
consumed by different work and the solver was never re-scheduled. The ledger records the substitution without
flagging it as a deferral — the only trace is a parenthetical in the v252 entry: *"NOTE the solver still does not
exist."*

---

### 1.3 `2026-07-20-equipment-consumption-layer-design.md` — **~30%** · the sharpest case

**The owner's belief is CONFIRMED on both counts.**

#### The `equipPlan` seam — never built

`grep -rn "equipPlan"` across the whole repo returns **7 hits, none of them code**: 5 in the spec itself, and 2
in plan documents. There is no `equipPlan` in `app.js`.

The spec calls this "the seam" (§2) and "one pure, testable seam where equipment enters stage generation"
(§1 Goals 1). It is the mechanism the entire document is built on. It was explicitly waived in the executed plan:

> `docs/superpowers/plans/2026-07-20-equipment-occupancy-layer.md:1220` —
> *"The `equipPlan` seam that A introduces is **not** required by this plan: occupancy reads `computed` stages
> directly rather than enriching them."*

That is a defensible local engineering call for the occupancy slice in isolation. But because Slices A and B were
never subsequently built, the seam has no other route into the codebase — and the architectural root cause the
audit identified (§1: *"equipment enters ~2,500 lines too late"*) is **entirely unaddressed**. `itemStages`
(`app.js:2190`) is still recipe-only; equipment is still attached at render time in `workPlanHtml`
(`app.js:5156`) as a display string. Nothing in the shipped app can change a stage's duration, split it, or add
one on account of your gear.

Also never built: the `gear:{dev,do,warn,occupy}` stage field (§2) — `gear.do` and `gear.warn` have zero
occurrences, so no gear-specific instruction or caveat renders into any task.

#### Slice-by-slice

| Slice | Requirement | Status | Evidence |
|---|---|---|---|
| **A** | `equipPlan` seam | **MISS** | 0 code occurrences (above) |
| A1 | `preheatMin(dev,cat)` device-driven preheat (D1, D2) | **MISS** | `grep -c preheatMin` = 0. `app.js:5043` still `earliestSmoke - 45*60e3` |
| A1 | `bathLitres(dev)` smallest-qualifying-bath rule | **MISS** | 0 occurrences |
| A1 | Charcoal without `chimney` costs +10 min | **MISS** | `chimney` never influences any duration |
| A2 | Fuel reconciled with `dev.fuel` (D3) | **MISS** | `app.js:5144-5147` still reads `c.m.obj.wood` / `c.m.obj.coal` — the recipe, not the device |
| A3 | Refuel cadence table by device type (D4) | **MISS** | `grep -c refuel` = 0; fixed reminder unchanged |
| A3 | `blower` shortens recovery; `controller-fan` suppresses vent-tending | **MISS** | neither is read |
| **B** | Cylinder loads = `ceil(kg / cap.volume)` | **MISS** | no such arithmetic |
| B | Nozzle selection: largest nozzle ≤ `casing_mm`, warn when none fits | **MISS** | `casing_mm` appears **once** in `app.js` — line 5543, inside `equipSpecNote`, as recipe-card **chip text**. It is never compared to `cap.nozzles`. |
| B | Scale-precision safety warn (`spec.scale_res` vs `cap.res`) | **MISS** | `grep -c scale_res app.js` = **0**. 67 recipes ship `scale_res` and nothing reads it. |
| B | Grind: mixer-attachment → smaller batches + chill-between-passes | **MISS** | `grep -c grind_mm app.js` = **0**. 59 recipes ship it. |
| B | Vacuum edge vs chamber → "freeze the marinade first" | **MISS** | no liquid-seal check exists |
| **C1** | Two occupancy modes, grate + hang; `gear.occupy` | **IMPL** (via a different route) | `itemOccupancy` `app.js:307-318`; hang gate `app.js:316`; `deviceCapacity` `app.js:287-303` |
| C1 | `hang` derived in `equipment_map.py`, class not measurement | **IMPL** | 28 of 102 makes carry `hang` — confirmed in `dist/index.html` (28 occurrences) |
| C1 | Hanging frees grate area entirely | **IMPL** | `app.js:316` returns `cm2:0` |
| C1 | Dry-curing (`curechamber`) hang-only capacity | **MISS** | `curechamber` has no capacity model; 27 recipes declare it |
| C1 | Coarse vertical-clearance gate for `long` items | **MISS** | no clearance check; `long` and `short` are treated identically |
| **C2** | Probe channels: budget concurrent monitored items, say which get leave-in vs spot-check | **MISS** | `probeChannels()` still has exactly the two call sites the audit named — its own definition (`app.js:226`) and one footer line (`app.js:5702`). D10 verbatim unchanged. |
| **C3** | SV volume-gated batching (`min_bath_l`, displacement) | **PART** | `itemOccupancy` returns `{mode:'volume', litres:min_bath_l}` (`app.js:314`) and `deviceOccupancy` sums it — but `_svBatch` (`app.js:5101`) still batches on temp+time only and is not gated on volume |
| C3 | One circulator = one temperature at a time | **PART** | `occupancyCompat` (`app.js:322`) computes a temp spread and `cookerContention` flags it — the constraint is now *expressible*, but not enforced against the SV batcher |
| **Safety** | `equipPlan` never alters `bcheck`/`temp`/safety numbers; enforced by a diff test | N/A | moot — no enrichment layer exists to constrain |
| **Testing 1** | No-op gate: unset `mk-equip-set` → identity | IMPL (for occupancy) | ledger Task 9 records this gate being caught and fixed; `waveE E3+E4` guards it |
| **DoD** | "The preheat contradiction (D1) cannot recur" | **NOT MET** | see §3 |
| **DoD** | "A pellet owner is never told to add charcoal (D3)" | **NOT MET** | see §3 |

**Verdict on the owner's belief:** *"only part of Slice C shipped and the `equipPlan` seam was never built at all."*
**Confirmed.** Slice A: 0 of 6 requirements. Slice B: 0 of 5. Slice C: C1 substantially yes, C2 no, C3 partial —
about 5 of 10. The seam: not built, and formally waived in the plan that superseded it.

---

### 1.4 `2026-07-20-equipment-properties-completion-design.md` — **~78% captured, ~20% consumed**

The capture side is real and well-executed. The consumption side — the reason the spec gives for capturing —
is not.

| Req | Status | Evidence |
|---|---|---|
| `props: []` on `EQUIP_CATS` + `EQUIP_OTHER_ITEMS`, `kind`/`unit`/`tier`/`def`/`opts` (§2) | IMPL | `app.js:34-98` |
| Type-key build gate (§3, §6.0) | IMPL | ledger Task 1 "build gate E1"; `tests/equipment-props.spec.ts` 12 tests |
| smoker `maxC` `canHang` `hooks` `waterPan` (§3) | IMPL (declared) | `app.js:41,43,45` |
| grill `lid` `maxC` `rotisserie`; oven `maxC` `fan` `steam`; sousvide `maxL` `watts` `maxC` (§3) | IMPL (declared) | `app.js:52-72` |
| vacuum `bagW` `bagKind` `bagL` `pulse` (§3) | IMPL (declared) | `app.js:74-80` |
| probe `maxC` `accuracy`; grinder `plates` `throughput`; stuffer `speed` (§3) | IMPL (declared) | `app.js:84-92` |
| Accessory `cooler` ownable (§3, DoD 3.66) | IMPL | `app.js:5496` |
| Accessory `scale.maxKg`, `hooks.count`, `curechamber.tempC/rhPct`, `humidity.rhPct`, `slicer.maxMm` (§3) | IMPL (declared) | `EQUIP_OTHER_ITEMS` §5487+ |
| `UNIT_CONV` + `propCoerce` + `propParse`, unit-suffix acceptance (§4) | IMPL | `app.js:139-179`; ledger Task 1, double-conversion bug found and fixed |
| AI lookup primary, category-scoped schema, null-not-guess, nothing persists without Save (§4) | IMPL | ledger Task 5; `app.js:5586`, `app.js:5902` |
| Core inline / pro in collapsed `<details>`, default as placeholder, no new CSS (§4) | IMPL | ledger Tasks 3-4 |
| `propOf(dev,key)` stored → class default → undefined (§5) | IMPL | `app.js:119` |
| **§5.55 "Every consumer reads through `propOf()`"** | **PART** | `propOf` has **3 call sites**, all inside `deviceCapacity` (`app.js:297,300,302`) — `maxL`, `areaCm2`, `canHang`, `hooks`. Everything else has no consumer to read through. |
| **§5.56 `equipment_map.py` joins — 7 named joins** | **MISS (all 7)** | `grind_mm`→plates: 0 · `casing_mm`→nozzles: display only · `scale_res`→scale: 0 · smoke temp→`maxC` infeasibility: **`maxC` appears only in its 5 declarations and 2 comments — no feasibility check exists** · hang→`canHang`+hooks: **IMPL** (the one join that landed) · item length→`bagW`: `bagW` = 1 occurrence (declaration only) · `min_bath_l`→`maxL`: IMPL |
| **DoD §7: "a recipe needing a 4.5 mm plate warns when the grinder has only 8 mm"** | **MISS** | `plates` = 2 occurrences (declaration + a comment). No warning path. |
| DoD §7: `cooler` ownable, no recipe requires unownable gear | IMPL | `app.js:5496` |
| DoD §7: empty properties never block a plan | IMPL | vacuously — nothing consumes them |

**The pattern:** of ~20 properties this spec added, **4 are read by anything** (`maxL`, `areaCm2`, `canHang`,
`hooks`), all four by the same function, all four in service of Slice C occupancy. `bagW`, `bagKind`, `plates`,
`waterPan`, `rotisserie`, `speed`, `throughput`, `accuracy`, `watts`, `steam`, `fan`, `lid`, `maxC`(×5),
`maxKg`, `tempC`, `rhPct`, `maxMm` are captured from the user and never read. The spec's own §7 DoD test — the
plate warning — is the clearest single instance of a stated Definition of Done that did not ship.

---

### 1.5 `docs/equipment-property-audit-2026-07-20.md` — **~80% (as capture)**

Requirements here are near-identical to §1.4 (this audit produced that spec). Capture-side items landed.

| Req | Status | Evidence |
|---|---|---|
| CORE/PRO tiering as one mechanism (§Preamble, 4.1) | IMPL | `tier:'core'\|'pro'` on every prop |
| `cooler` defect — 13 cuts request unownable gear (§0) | IMPL | now ownable; **44 recipes** declare `cooler` in shipped data |
| 9 CORE + 11 PRO additions (§3) | IMPL | all declared |
| Explicit non-additions honoured (§3) | IMPL | no `tempCtl`, no vacuum liquid flag, no probe wireless flag |
| **§3a demand-driven capture — "never ask for a property until a plan needs it"** | **DROP** | superseded by the properties-completion spec (which asks for everything up front) — a legitimate and documented supersession, but it means the audit's stated capture philosophy is not what shipped |
| **§3a completeness wording "ציוד: 3 · דיוק 40%", never "incomplete"** | **MISS** | no precision-percentage surface exists anywhere |
| **§4 sequencing step 4: "then revisit the consumption-layer spec"** | **MISS** | never revisited; §4.40's stated consumption-spec debt (bath preheat assumes `watts`; hang assumes clearance) is unresolved and both assumptions still stand unimplemented |

---

### 1.6 `docs/plan-depth-model-2026-07-20.md` — **0%** · written, never planned

This is the largest wholly-unimplemented document. 49 substantive requirements, **none** delivered. It does not
appear in any file in `docs/superpowers/plans/`, and it is not mentioned anywhere in `.superpowers/sdd/progress.md`.

| Req | Status | Evidence |
|---|---|---|
| `planDepth` pref `mk-pref-depth`, `essential\|standard\|full` (§2) | **MISS** | `grep -c planDepth app.js` = **0**; not in `PREFS` (`app.js:6062-6082`) |
| `depth: 0\|1\|2` tag at every `tasks.push()` (§3) | **MISS** | `grep -c "depth:" app.js` = **0** — exactly as the doc itself predicted at §3.15 |
| Promote `.tl-detailtoggle` to three depth chips (§2) | **MISS** | still the two-chip Short/Full detail toggle at `app.js:5214` |
| Depth changes task EXISTENCE not detail text (§2) | **MISS** | the toggle still swaps only the `det` string |
| Per-cook override per `evScope()` (§2) | **MISS** | — |
| Build-fail tests A and B (bcheck at all depths, byte-identical serve time) (§3) | **MISS** | — |
| **Stall reassurance task** — "it will sit at 70–75 °C for 3–5 h. This is correct. Do not raise the heat." (§4) | **MISS** | the category does not exist |
| **~2 h Essential buffer vs 30 min Pro** — the doc calls this "the most valuable difference between the two modes" (§4) | **MISS** | no depth-varying slack |
| Thresholds not judgement: wrap at 75 °C, pull at 97 °C (§4) | **MISS** | — |
| Three interrupts only (§4) | **MISS** | — |
| **"No thermometer registered → refuse to schedule poultry or charcuterie"** (§5) | **MISS** | no such refusal; a safety commitment |
| **"Cure + no 0.1 g scale registered → the task BLOCKS"** (§6, ties to D7) | **MISS** | `scale_res` unread (0 occurrences); nothing blocks |
| Cure naming precision — name the product and the number, never "מלח ורוד" alone (§6) | **MISS** | — |
| bcheck renders as full-width gate card at all depths (§6) | **MISS** | — |
| Per-cooker task sets: offset / pellet / kamado / electric / kettle MUST and MUST-NOT lists (§7) | **MISS** | none exist — this is the same ground as consumption-layer Slice A3, also unbuilt |
| chimney back-schedule 15–20 vs 25–30 min (§7) | **MISS** | duplicate of A1; unbuilt |
| Probe-type branching: alertable event vs scheduled checks (§7) | **MISS** | duplicate of C2; unbuilt |
| Hang capacity 4–6 rack-equivalents vs 2 (§8) | **PART** | occupancy models hooks; the *capacity multiplier* insight is not modelled |
| **Hang durations — ribs 3–3.5 h at 120–135 °C hanging vs ~5 h at 107 °C on a grate (§8)** | **MISS** | hanging changes occupancy only; it changes **no duration**. This is precisely the class of thing the missing `equipPlan` seam existed to enable. |
| Hang-only tasks (tacky casing, hook placement, re-check at 45 min) (§8) | **MISS** | — |
| Hang rotation — 20–30 °C hotter at the top, swap at halfway (§8) | **MISS** | — |
| Chamber hang spacing (§8) | **MISS** | — |

---

## 2. The executed plans vs. the ledger

| Plan file | Ledger claim | Verified |
|---|---|---|
| `2026-07-15-equipment-2.0-slice-1a.md` | Slice 1 complete, v250 | **True** — §1.1 confirms |
| `2026-07-17-phase3a-slice1-prefs-framework.md` | Task 6 complete, v250 | **True with a caveat** — the framework shipped, but the *preset selector* the plan's own Task 5 references (`prefPreset`) is absent from `app.js`. The ledger records "P5's `prefPreset===undefined` throws ReferenceError; fixed to typeof" — i.e. the guard against a missing function was fixed, and the function itself was never added. |
| `2026-07-20-equipment-properties-completion.md` | 6 tasks complete, v251 | **True for capture** — §1.4 |
| `2026-07-20-equipment-occupancy-layer.md` | 9 tasks complete, v253 | **True** — this is genuinely delivered work: `deviceCapacity`, `itemOccupancy`, `deviceOccupancy`, `occupancyCompat`, the occupancy view + time scrubber, hanging from recipe prose, and the multi-event migration. 45 tests across 4 `occupancy-*.spec.ts` files. |
| **No plan exists for** | — | consumption-layer **Slice A**, consumption-layer **Slice B**, Phase 3a **Slice 2**, Phase 3a **Slice 3**, the **entire plan-depth model** |

The ledger is honest in tone — it flags its own substitutions ("NOTE the solver still does not exist") and
records reviewer findings and fixes. Its failure mode is not misreporting but **omission of the denominator**:
it records what was done without ever restating what remained, so five undone bodies of work accumulate with no
running total.

---

## 3. Audit defects D1–D11 — fix status

| # | Defect | Status | Evidence |
|---|---|---|---|
| **D1** | **Preheat contradicts itself** | **OPEN** | `app.js:5043` `const preheat = earliestSmoke ? new Date(earliestSmoke.getTime()-45*60e3) : null` — still the hard-coded 45 min. `app.js:5061` still renders the label `'הדלקת מעשנת (חימום מוקדם, 45 דק׳)'` with the figure baked in. `app.js:5178` still sets `sub: preheatHint()`, and `preheatHint()` (`app.js:658-663`) still returns `'~15 דק׳'` for a pellet smoker. **All three of the audit's cited lines are unchanged.** A pellet owner still sees a task labelled "45 min" whose sub-line says "~15 min", with 45 min reserved in the schedule. The consumption spec's DoD "the preheat contradiction cannot recur" is not met. |
| **D2** | Only smoking gets a preheat | **OPEN** | `app.js:5042` still `if(s.kind==='smoke' && ...)`. No sous-vide or grill lead time. Heating a 24 L bath is still invisible to the plan. |
| **D3** | **Fuel never reconciled** | **OPEN** | `app.js:5144-5147`: `const wd = c.m.kind==='cut' ? c.m.obj.wood : (c.profile&&c.profile.wood); const cl = c.m.kind==='cut' ? c.m.obj.coal : ''; ... det += "[🪵 Wood: ${wd} · charcoal: ${cl}]"`. Reads the **recipe**, never `dev.fuel`. A pellet or electric owner is still told "🪵 Wood: oak · charcoal: lump". The consumption spec's DoD "a pellet owner is never told to add charcoal" is not met. |
| **D4** | Reload reminder is fixed | **OPEN** | no `refuel` / cadence logic exists |
| **D5** | All capacity is decorative | **FIXED** | this is the one substantive fix. `deviceCapacity` (`app.js:287`), `itemOccupancy` (`app.js:307`), `deviceOccupancy` (`app.js:342`), `PACK_EFF=0.85`. `cookerContention` (`app.js:254`) now derives a clash from over-capacity or irreconcilable temperature rather than time overlap. Commit `3b1a22a`. Verified live per ledger Task 5 (brisket+ribs, 1680/5100 cm², no clash). |
| **D6** | **More equipment makes detection worse** | **PARTIAL** | `cookerFor` (`app.js:238-250`) gained a native-category tiebreak in v252 (`834d3f1`): a real smoker now outranks a grill-that-can-also-smoke. But the last line is still `return null` for two devices of the same class, and `deviceOccupancy` (`app.js:355`) still returns early on an unresolved device — so **two smokers still silently drop items out of contention**, which is the exact failure mode the audit named ("buying a second smoker can make clashes vanish"). The audit's instruction was "**Fix D6 first** — ambiguous items must stay in contention"; the ambiguous case is still excluded rather than retained. |
| **D7** | Scale resolution unused in dosing | **OPEN** | `grep -c scale_res app.js` = **0**. 67 recipes ship a `scale_res` requirement; the cure calculator never reads it. A ±40% error on a 2.5 g Cure #1 dose remains unwarned. This is the one open defect the audit itself classed as safety-relevant, and the plan-depth model escalated it to "the task BLOCKS". |
| **D8** | Nozzles fully orphaned | **OPEN** | `casing_mm` appears once (`app.js:5543`) as recipe-card chip text; never compared to `cap.nozzles`. 71 recipes ship a `casing_mm`. |
| **D9** | Edge vs chamber vacuum never checked | **OPEN** | no liquid-seal warning; `bagKind` declared, 1 occurrence |
| **D10** | Probe channels are a display count | **OPEN** | `probeChannels()` still has exactly two call sites: its definition (`app.js:226`) and one footer line (`app.js:5702`). Verbatim unchanged. |
| **D11** | No cooler / cambro in the model | **PARTIAL** | `cooler` is now an ownable accessory (`app.js:5496`) and 44 recipes declare it — the *data* half is fixed. But the live advisor still proposes "hold in a cooler (faux cambro)" **ungated** at `app.js:4791`, `4798`, `4802` — no `hasGear('cooler')` / `equipOwnsToken('cooler')` check guards any of the three. The app still tells you to use gear it now knows you may not own. And Phase 3's hold strategy, the reason D11 was raised, does not exist at all. |

**Score: 1 fixed (D5), 2 partial (D6, D11), 8 open.**

---

## 4. Device properties: captured vs. consumed

Built fresh from `python build.py`. Of the ~20 properties the properties-completion spec added:

| Read by something | Read by nothing |
|---|---|
| `maxL` (`app.js:297`) · `areaCm2` (`app.js:300`) · `canHang` (`app.js:302`) · `hooks` (`app.js:302`) | `maxC` (×5 categories) · `lid` · `rotisserie` · `waterPan` · `fan` · `steam` · `watts` · `accuracy` · `bagW` · `bagKind` · `bagL` · `pulse` · `plates` · `throughput` · `speed` · `maxKg` · `tempC` · `rhPct` · `maxMm` |
| **4** | **~20** |

All four consumers are inside a single function, `deviceCapacity`. `propOf()` — the mandated read-through
accessor (§5.55) — has three call sites in the entire file.

The two properties the audit called out as pure feasibility gates are the starkest: `maxC` (§4.4: *"electric
smokers cap ~135 °C; a 150 °C recipe must be flagged not scheduled"*) and `lid` (§4.8: *"without a lid you cannot
cook indirect; lidless plancha must not be offered indirect methods"*). Both are captured from the user. Neither
gates anything.

---

## 5. The "maximal equipment use" requirement — quantified

> *"you use only small part of the equipment while my intention is to use maximal amount of equipment that makes
> sense to use in this context."*

Counted directly out of `dist/index.html` (279 tagged recipes, 1 uncovered).

### 5.1 Vocabulary tokens

**23 distinct tokens are declared by recipes**, 2,528 declarations in total:

```
probe 511 · gloves 310 · smoker 213 · drippan 213 · knife 130 · board 130 · chimney 130
sousvide 130 · vacuum 130 · spritz 130 · grill 97 · torch 97 · tongs 97 · grinder 79
stuffer 72 · scale 67 · slicer 49 · cooler 44 · curechamber 27 · humidity 27 · hooks 27
paper 24 · foil 24
```

| Measure | Ratio |
|---|---|
| Tokens that render **anything the user sees** | **23 / 23 (100%)** — but all via one surface: `equipSectionHtml(c.equip)` is called at **exactly one place**, `app.js:1726`, inside the recipe card. They are a have/missing chip list on a card, nothing more. |
| Tokens that influence **the plan** (a duration, a task, a warning, a clash) | **1 / 23 (4%)** — only `hooks`, via `equipOwnsToken('hooks')` at `app.js:316`, which gates hang-mode occupancy. |

`smoker`, `grill`, `sousvide` look like exceptions but are not: `cookerFor`/`cookerCandidates` resolve a device
from the **stage kind**, not from the recipe's declared token. The plan would behave identically if every
`equip.need` block were deleted.

**Unused in the plan (22 of 23):** `probe`, `gloves`, `smoker`, `drippan`, `knife`, `board`, `chimney`,
`sousvide`, `vacuum`, `spritz`, `grill`, `torch`, `tongs`, `grinder`, `stuffer`, `scale`, `slicer`, `cooler`,
`curechamber`, `humidity`, `paper`, `foil`.

Several of these have a written, specified job that was never built: `chimney` (130 recipes) was to add 10 min to
charcoal preheat; `scale` (67) was to gate cure dosing; `spritz` (130) and `drippan` (213) were to emit schedule
tasks; `paper`/`foil` (24 each) were to condition the wrap instruction on what you own; `cooler` (44) was to back
the hold strategy; `torch` (97) was to become a sear-finish task.

### 5.2 Numeric spec keys

**10 distinct `spec.*` keys ship**, and the divide is sharp:

| Key | Recipes | Consumed by | Status |
|---|---|---|---|
| `footprint_cm2` | 357 | `itemOccupancy` `app.js:317` + chip text | **used** |
| `min_bath_l` | 130 | `itemOccupancy` `app.js:314` + chip text | **used** |
| `hang` | 28 | `itemOccupancy` `app.js:315` | **used** |
| `casing_mm` | 71 | chip text only (`app.js:5543`) | display only |
| `kg` | 130 | nothing | **unused** |
| `shape` | 130 | nothing | **unused** |
| `scale_res` | 67 | nothing | **unused** (D7) |
| `grind_mm` | 59 | nothing | **unused** |
| `rh_pct` | 27 | nothing | **unused** |
| `slice_mm` | 1 | nothing | **unused** |

**3 of 10 keys (30%) influence anything.** Note `kg` at 130 recipes: the audit's §5.4 named "an item-weight
source" as one of the four things that *must exist* before capacity budgeting can work. It now exists, in the
data, on 130 recipes — and nothing reads it, because the slot budget that needed it (Phase 3a §3.4) was never
built.

### 5.3 Summary of the ratio

The honest one-line answer to the owner's complaint: **the app captures 23 equipment tokens and 10 numeric
requirements per recipe, joins 4 device properties, and lets exactly 1 token and 3 numbers reach the plan.**
Everything else is a chip on a recipe card. The proportion of the declared equipment vocabulary that does
work is roughly **4%** by token and **30%** by numeric spec.

---

## 6. Requirements written and then never planned

Searched for commitments appearing in a spec or audit but in **no** file under `docs/superpowers/plans/` and
**no** entry in `.superpowers/sdd/progress.md`.

1. **The entire plan-depth model** (`docs/plan-depth-model-2026-07-20.md`, 49 requirements). Written 2026-07-20.
   Zero plan files, zero ledger mentions, zero code (`planDepth` = 0, `depth:` = 0). Includes two safety
   commitments — refuse to schedule poultry/charcuterie without a registered thermometer (§5); block the cure
   task without a registered 0.1 g scale (§6).
2. **Consumption-layer Slice A** (spec §3, scheduled v251). No plan file. v251 shipped different content.
3. **Consumption-layer Slice B** (spec §4, scheduled v252). No plan file. v252 shipped different content.
4. **Phase 3a Slice 2** — `orchestrate()` + `share` + `reassign` + rack budget + safety gate + `advise`
   (spec §9, scheduled v251). No plan file.
5. **Phase 3a Slice 3** — `wood` + `hold` + danger-zone accumulator + AI ranking + `propose` (spec §9,
   scheduled v252). No plan file.
6. **The Phase 3a preset selector** — `PREF_PRESETS`, `prefPreset()`, the Simple/Balanced/Pro row (spec §2.2,
   §2.3, test §7.3). Inside a plan that was executed and marked complete; the function is absent from `app.js`.
7. **The property audit's §4 step 4** — "then revisit the consumption-layer spec". The audit explicitly logged
   consumption-spec debt (§4.40: bath preheat assumes `watts`, which was never captured as a consumer; hang mode
   assumes vertical clearance, which was explicitly deferred). Never revisited; both assumptions still stand.
8. **The completeness-as-precision surface** — "ציוד: 3 · דיוק 40%, never 'incomplete'" (property audit §3a,
   plan-depth §9). Never planned, never built.
9. **`cooler` gating on the hold advice** — D11's data half shipped; the three advisor call sites
   (`app.js:4791/4798/4802`) were never gated on ownership.
10. **The audit's §6 instruction "Fix D6 first"** — ambiguous items must *stay* in contention. The v252 tiebreak
    narrowed the ambiguous set but did not change the exclusion rule.

---

## 7. Basis for the conformance figure

| Document | Substantive reqs | Delivered (weighted) | % |
|---|---|---|---|
| Equipment 2.0 (2026-07-15) | 78 | 70 | 90% |
| Phase 3a (2026-07-17) | 93 | 22 | 24% |
| Properties completion (2026-07-20) | 68 | 53 | 78% |
| Property audit (2026-07-20) | 40 | 32 | 80% |
| Plan-depth model (2026-07-20) | 49 | 0 | 0% |
| Consumption layer (2026-07-20) | 30 | 9 | 30% |
| **Total** | **358** | **186** | **~52%** |

Two caveats that matter more than the headline:

- **The 52% is flattered by sequencing.** Equipment 2.0 and the two property documents — 186 of the 358
  requirements, and the bulk of the delivered mass — are all *capture*. They ask the user for data. The three
  documents about *doing something with that data* (Phase 3a, plan-depth, consumption layer) total 172
  requirements and are **~20% delivered**. The project has built a very good intake form for a decision engine
  that does not exist.
- **Docs 3 and 4 overlap substantially** (the audit produced the spec), so their combined 108 requirements
  represent less independent scope than the count implies. Excluding the duplication pushes the overall figure
  down toward **~48%**.

---

## 8. Blunt assessment

The work that shipped is not low quality. The occupancy layer (v253) is real, tested (45 tests across four spec
files), reviewed, and it genuinely fixed D5 — the "all capacity is decorative" defect — with a live-verified
scenario. The equipment model, the property schema with unit coercion, and the AI lookup path are solid
engineering. The ledger is candid; reviewers caught real bugs and they were fixed.

The failure is one of **arc, not craft**. Six months of specs describe a system where equipment changes *when you
cook and what you do*. What shipped is a system where equipment changes *what a card says* and, since v253, *whether
two items are flagged as clashing*. The seam that was supposed to connect the two — `equipPlan` — was designed,
approved, waived once for local convenience in the occupancy plan, and then never picked up, because the two
slices that would have introduced it were never planned. Each individual decision was reasonable. The cumulative
result is that the single most important architectural finding of the 2026-07-17 audit — *equipment enters 2,500
lines too late* — is as true today as when it was written.

The owner's complaint is accurate and, if anything, understated. The specific charge — "you use only a small part
of the equipment" — measures out at **4% of declared tokens** and **30% of numeric requirements** reaching the
plan.

---

## 9. Gaps ranked by impact on a pitmaster actually running a cook

1. **The plan still cannot change a single duration because of your gear** (`equipPlan` seam, consumption Slice A;
   plan-depth §7-8). A pellet owner and an offset owner get an identical schedule. Ribs hung vs. laid cook in
   3–3.5 h vs. ~5 h and the plan shows one number. This is the whole premise of the arc, and it is unbuilt.
   Everything below is downstream of it.
2. **D1 preheat, live and self-contradicting, on the highest-stakes task of the cook.** The one task where being
   wrong means the meat goes on cold. A pellet owner reads a task labelled "45 min" whose own sub-line says
   "~15 min", against 45 min reserved in the walk-back. Three lines of code (`app.js:5043`, `5061`, `5178`),
   all named in the audit eight months ago, all unchanged. Cheapest high-value fix on this list.
3. **D7 — cure dosing with no scale-resolution guard.** The only open defect with a food-safety consequence.
   2.5 g of Cure #1 on a 1 g scale is a ±40% nitrite error. 67 recipes ship `scale_res`; `grep` finds it zero
   times in `app.js`. Two documents escalated it — the audit ("belongs with the safety floors") and the
   plan-depth model ("the task BLOCKS"). Neither shipped.
4. **No orchestrator: a clash is detected and then you are on your own.** v253 made clash detection genuinely
   correct — and there is still no `share`, `reassign`, `hold`, `wood`, or `advise` move. The app now tells you
   accurately that your cook will not fit, and offers nothing. Seven preference knobs sit in `PREFS` with zero
   consumers, advertising a solver that does not exist.
5. **D3 fuel — the app tells a pellet or electric owner to add charcoal.** Purely cosmetic in effect but
   corrosive to trust in a way the others are not: it is the moment the user discovers the app is not really
   reading the equipment it made them enter. It is also a single lookup table against `dev.fuel` (consumption
   spec §3 A2), fully specified and never written.

Runners-up: D6 (two smokers still silently drop items out of contention — a second cooker can make clashes
*vanish*); D10/C2 (probe channels never budgeted, so the plan will happily require four leave-in probes on a
two-channel unit); D11 (the advisor recommends a cooler hold without checking whether you own a cooler, at
`app.js:4791/4798/4802`).
