# Equipment / Occupancy / Scheduling Substrate — Current-State Map

**Date:** 2026-07-25 · **Status:** read-only analysis, ground truth for the Equipment-Manager-as-SSOT brainstorm.
**Method:** local knowledge graph (`graphify-out/graph.json`, refreshed 2026-07-24, 6,150 nodes) queried first
per §10.13, then every claim confirmed against the live `app.js` (9,970 lines) via Serena
(`find_symbol`/`find_referencing_symbols`/`get_symbols_overview`) and a final `grep -n` ground-truth pass —
**every `app.js:N` citation below is a 1-based line number confirmed against the file at the time of this
read**, not copied from the graph or from either prior document. Two documents were cross-checked against
the code and are named explicitly wherever their line numbers or their factual claims have drifted:
`docs/analysis/2026-07-21-refactoring-report.md` and `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`.

**Headline correction before anything else.** The refactoring report's central claim — *"`equipPlan`, the
one seam where equipment enters stage generation, has zero occurrences in the codebase … formally waived"*
— is **no longer true**. `equipPlan` was built the same day the report was written (commit `75d946a`,
2026-07-21, *"equipPlan — the waived seam, built (Phase 3: D1, D3, D4)"*) and the report's entire Phase
0–4a repair ladder (S1–S3 safety, H1–H4 occupancy honesty, the `planSchedule` extraction) shipped across
some 25 commits between 2026-07-21 and 2026-07-24, confirmed live in the code read for this map. L1's
*process* lesson (a plan silently waiving an approved spec's central mechanism) remains exactly as
important — the Waiver Gate exists because of it — but its *technical* referent is closed. This map treats
L1 as a closed-and-superseded case study in §5, not as a live gap.

---

## 0. The verdict

**What genuinely exists and is solid:** a real, typed device data model (`EQUIP_CATS`, `app.js:34`) with
per-category capacity/property schemas, unit conversion and class defaults; an honest, per-slot capacity/fit
model (`deviceOccupancy`, `app.js:438`; `schedulePlacements`, `app.js:3099`) that already resolved the
report's H1–H4 honesty defects (unknown-as-zero, bath-summing, hooks, whole-device-vs-shelf); a real
device→time-shift mechanism (`schedulePlacements` moves a stage earlier under capacity pressure, bounded by
`SCHED_PULL_MAX_MS`); and a reachable, wired UI (`openEquipment`, `app.js:6773`; `openOccupancyView`,
`app.js:714`, opened from a real `data-occview` button inside the Work Plan, `app.js:6448`) with five
device-silhouette renderers (cabinet/grill/vessel/bay/offset — see §1.6 for the exact function names, which
differ from the brief's `occ-view-*` guess). **What is genuinely partial:** device *properties* are 79%
captured-and-unread (14 of 19 registered properties, plus `choosePlate`/`chooseNozzle`, have zero production
callers — confirmed unchanged from the 2026-07-22 audit); the cook→device *requirement* is inferred from a
stage's `kind` at schedule time via a hardcoded category map, never declared per-recipe; and the cross-event
view (`combinedEventsRows`) explicitly bypasses `equipPlan` and `schedulePlacements` entirely, gated
off unless `equipConfigured()`. **What is genuinely absent:** a persisted, queryable device-reservation
ledger that can answer *"is device X free for window [t1,t2)"* independent of re-deriving a full plan; any
resource-aware **cross-event** allocation (explicitly deferred by charter decision R5 to Phase P9, "after
the orchestrator"); and the Phase 3a solver itself (`orchestrate`/`movesForClash`/`applyMove`/`safetyGate`
— zero declarations anywhere in `app.js`, confirmed by `grep -n "^function orchestrate\|^function
movesForClash\|^function applyMove\|^function safetyGate" app.js` returning nothing). An Equipment-Manager-
as-SSOT needs a genuinely new ledger/allocation layer; it can **absorb** the capacity/fit model underneath
it almost unchanged.

---

## 1. The seven mapped areas

### 1.1 · The device data model — **SOLID**, with two named partial defects (D2, D3)

- **Storage.** `equipList()` (`app.js:221`) reads `store.get('mk-equipment')` — an array of device records.
  `equipConfigured()` (`app.js:754`) gates the whole equipment-aware code path on a separate boolean,
  `store.get('mk-equip-set')`; `equipSetConfigured()` (`app.js:755`) sets it. A one-time migration path from
  the legacy flat `mk-gear`/`mk-gear-set` keys exists at `equipMigrateFromGear()` (`app.js:757`).
- **Device shape on disk:** `{id, cat, type, name, brand, model, fuel, cap:{...}, specSource, notes}`,
  confirmed both in `openEquipment`'s save path and in the fixture literals of `tests/equipplan-seam.spec.ts`.
- **Category schema — `EQUIP_CATS`** (`app.js:34`, 9 categories: smoker, grill, oven, sousvide, vacuum,
  probe, grinder, stuffer, other). Each category carries `types[]`, either a scalar `capKey` (racks / zones /
  channels / cylinder volume) **or** a `multiCap` — an **array**-valued capacity (sous-vide `baths` in L,
  grinder `plates` in mm, stuffer `nozzles` in mm) — plus a typed `props[]` list (`num`/`bool`/`choice`, each
  with `bounds`, a unit-conversion table `alt`, and a per-type class default `def`).
- **Capacity resolution — `deviceCapacity(dev)`** (`app.js:305`). Area devices: `usableCm2 =
  round(areaCm2 * PACK_EFF)`, `racks`/`zones`, `hooks` gated on the `canHang` property. **Sous-vide devices
  return `{mode:'volume', litres}`** with an explicit, commented precedence — registered `cap.baths[]` (the
  max of the owned sizes) → legacy single `cap.bathL` → the class default via `propOf(dev,'maxL')`
  (`app.js:308-312` comment: never skip to the class default while a real measurement exists).
- **Bath *size* — yes, explicitly modeled.** The sous-vide category's `multiCap` (`app.js:64` region) stores
  an array of owned bath sizes in litres; `chooseBath(dev, needL)` (`app.js:3014`) picks the smallest
  registered size that fits (`sizes.find(v => v >= need)`), reported `ok:false` if none is big enough.
- **D2 — 14 of 19 registered properties are display-only, reconfirmed live.** `nozzles, plates, bagKind,
  bagW, lid, fan, accuracy, pulse, rotisserie, speed, steam, throughput, waterPan, watts` are read **only**
  by `EQUIP_CATS`'s own schema and the generic display-chip loop inside `openEquipment` (`chipsFor`,
  `app.js:6784` region). `grep -n "propOf(dev,'watts')\|propOf(dev,'fan')\|propOf(dev,'lid')\|propOf(dev,
  'steam')\|propOf(dev,'rotisserie')\|propOf(dev,'waterPan')\|propOf(dev,'pulse')\|propOf(dev,'bagKind')\|
  propOf(dev,'bagW')\|propOf(dev,'accuracy')\|propOf(dev,'throughput')\|propOf(dev,'speed')" app.js` returns
  **zero matches** — matches the 2026-07-22 ULTIMATE audit's D2 exactly, unchanged three days later.
- **D3 — two cooking-area fields, still both present.** `openEquipment`'s form has `#eqvArea` (free text,
  saved to `d.cap.area`, display-only — used only by a chip and the print preview) **and**
  `#eqProp-areaCm2` (numeric, routed through `propParse`, the only one `deviceCapacity`/`propOf(dev,
  'areaCm2')` actually reads for fit/capacity math). Nothing on screen distinguishes them — same defect the
  audit found, reconfirmed unchanged.

### 1.2 · The availability / occupancy engine — **PARTIAL** (this is the keystone; full answer in §3)

- **`deviceOccupancy(devId, tMs, computed, scope)`** (`app.js:438`) answers *"what is on device X at
  **one instant** `tMs`"*, given an already-computed `computed[]` array (a specific event's, or
  `combinedEventsRows`'s, already-resolved stage list). It is **recomputed by scanning `computed` on every
  call — not a stored table.** Returns per-slot placement (`slots[]`, one shelf/zone/bath), an honesty-
  laddered `fit` verdict (`ok`/`tight`/`over`, §1.2 of the refactoring report's H4 fix — measured vs.
  estimated items get different tolerance, `FIT_SLOT_TOL` vs `FIT_HARD_FACTOR`), and `hooksOver`.
- **`schedulePlacements(computed, scope)`** (`app.js:3099`) is the actual **time-shifting placer**: a
  per-device greedy backward walk, stages sorted by slack → demand → stable key, trying `[latestFinishMs] ∪
  {other placed items' start times}` as candidate end-times via `_windowFits` (`app.js:3083`), **bounded by
  `SCHED_PULL_MAX_MS`** — past that bound it refuses to reschedule silently and raises a `pull-too-far`
  conflict instead. This is the one place equipment fact genuinely changes **when** something happens
  (not merely detects a clash) — the refactoring report's Phase 4b item, confirmed shipped and wired into
  the real render path (`app.js:6087`, inside `buildList`, called with the whole event's `computed` array).
- **`cookerFor`/`cookerContention`** (`app.js:242`, `app.js:258`) resolve one item's device and detect
  same-event clashes using the **same** `deviceOccupancy`/`.fit` verdict (comment at `app.js:258-288`
  documents the exact H4 fix: judged by the per-slot verdict, never the whole-device sum).
- **`combinedEventsRows`** (`app.js:8260`), the cross-event view, is gated: `if(!equipConfigured()) return
  rows;` (`app.js:8298`) — with no kit configured, cross-event time-overlap is **not** treated as evidence
  of a conflict at all (2026-07-24 fix, commit `1a55aba`, per charter R5's interim). When configured, it
  samples `deviceOccupancy` only at **stage-start instants** across events ("marks"), and — confirmed by
  reading the function body — it **never calls `schedulePlacements`**: cross-event conflicts are *detected*
  post-hoc at instants where stages already begin, never *placed/resolved*.
- **What is confirmed absent, by reading these three functions together:** no function anywhere takes
  `(deviceId, proposedWindow)` and returns free/busy without first re-deriving the full computed stage set
  for every item in every event. `setItemCooker`/`mk-item-cooker-<scope>` (`app.js:240-241`) stores only a
  **manual device pick** per `(item, kind, event-scope)` — not a time window, not a reservation. There is no
  standing "is device X free for [t1,t2)" query answerable against a hypothetical/future event.

### 1.3 · The cook → device binding — **PARTIAL / inferred at schedule time, not declared in data**

- Recipe data does **not** declare a required device *type* or *instance*. What it declares per stage-kind
  is a **space/volume/hang requirement**: `meta.obj.equip = {spec:{footprint_cm2, min_bath_l, hang}, by:
  {<stageKind>:{spec:{...}}}}`, read by `itemOccupancy(meta, stageKind, dev)` (`app.js:356`).
- The **category** a stage needs is inferred from `stage.kind` (`smoke`/`cook`/`sv`) via
  `cookerCandidates(kind)` (`app.js:233`) — a hardcoded rule: `smoke` also accepts a charcoal/kettle/gas
  grill, `cook` also accepts an oven. This mapping lives in code, not in per-recipe data.
- **`itemStages(meta, methodKey, ready, order)`** (`app.js:3223`) builds `{kind, hours, temp}` from the
  recipe's method/profile data and carries **no device field at all** — devices enter only downstream.
- **`equipPlan(meta, methodKey, stages, scope)`** (`app.js:973`) — confirmed built and wired (§1.5) — is the
  one seam. For `kind ∈ {smoke, cook}` only, it resolves `cookerFor`, then may attach `fuelNote` (from
  `DEVICE_FUEL`, `app.js:964`, keyed by device **type string**) and `refuelEveryMin` (from `REFUEL_MIN`,
  `app.js:957`) if the cook outlasts one fuel load. Its own comment (`app.js:969-972`) states the contract:
  *"may ENRICH a stage… may never change one: no duration, no temperature, no kind, no order."*
  `DEVICE_FUEL`/`REFUEL_MIN` still cover only smoker types (never grill/oven), and `equipPlan` never
  touches `kind==='sv'` — matches the ULTIMATE D4 finding, reconfirmed unchanged.
- **`equipPlan` has exactly one production call site**, confirmed via `find_referencing_symbols`: inside
  `buildList` at `app.js:6069` (the single-event Work Plan render). **`combinedEventsRows` never calls
  `equipPlan`** — confirmed by reading its body — so the cross-event view carries no fuel/refuel enrichment
  at all, a gap not previously logged this precisely.
- Device *assignment itself*, when ambiguous, is a manual per-(item, kind, event-scope) sticky pick —
  `setItemCooker`/`mk-item-cooker-<scope>` (`app.js:240-241`) — auto-resolved by `cookerFor` only when
  exactly one candidate exists.

### 1.4 · The plan / work-plan / event layers — **PARTIAL**

- The one production pipeline, confirmed live inside `buildList()` (`renderTimelinePanel`, `app.js:6018`
  onward — the Work Plan render closure, still a **private closure inside a render function**, not an
  extracted module): `itemStages` (`app.js:6067`) → `equipPlan` (`app.js:6069`) → `planSchedule`
  (`app.js:2988`, called `app.js:6074`) → `schedulePlacements` (`app.js:3099`, called `app.js:6087`) →
  a runtime `safetyDiff` (`app.js:3049`) check. This is the exact chain the local graph names (community
  `equipPlan`), confirmed by direct read — the graph's own line numbers for this region were stale (it
  cited `5659-5718`; the actual code is at `6018-6110+`), a useful illustration of §10.13's "lead, not
  verdict" caveat.
- **A live correctness gap, reconfirmed unchanged from the ULTIMATE audit (its B-ii.9 / C5):**
  `if(uniq.length!==1 || !uniq[0]) return;` (`app.js:6098`) — any item whose stages want *different* time
  shifts silently keeps the over-subscribed relaxation with no advisory. Still present, same shape, new
  line number.
- **Where a "you don't own this device" gate would have to live:** `equipPlan` (`app.js:973`, the enrichment
  seam) or `schedulePlacements` (`app.js:3099`, which already raises `conflicts[]` for `hooks`, `bath-temp`,
  `bath-too-small`, `no-single-slot`, `no-window`, `pull-too-far`, `temp-ceiling`) are the two natural
  attachment points — both already exist and already carry a conflict-reporting shape; neither currently
  blocks a plan from being built or shown (they annotate/shift, never refuse).
- `combinedEventsRows` (§1.2) is the only cross-event surface, and it explicitly does not run the placer.

### 1.5 · The `equipPlan` history (L1) — **RESOLVED**, superseding the refactoring report

Per `docs/analysis/2026-07-21-refactoring-report.md`: `equipPlan` was specified in
`docs/superpowers/specs/2026-07-20-equipment-consumption-layer-design.md` as the seam where equipment facts
enter stage generation, and was **waived in a plan file**
(`plans/2026-07-20-equipment-occupancy-layer.md:1220`) without being raised with the owner — the exact
failure the Waiver Gate (`CLAUDE.md` §4) now exists to prevent. At the time the report was written,
`grep -c equipPlan app.js` was reported as 0.

**Current state, verified today:** `git log -S"function equipPlan" --oneline -- app.js` returns exactly one
commit, `75d946a feat(equip): equipPlan — the waived seam, built (Phase 3: D1, D3, D4)`, dated **2026-07-21
— the same day as the refactoring report**. The function exists at `app.js:973` (body quoted in §1.3), is
wired into the live render path (`app.js:6069`), and is covered by `tests/equipplan-seam.spec.ts` (128
lines) asserting the D1 behavioural claim specifically (`preheatMinutes()` differs by device type and the
scheduled light-up matches its own label — the exact "D1: preheat hardcoded to 45 min" defect the report
raised). `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` R2 records the process
resolution: *"v256 / v257 stamped approved retroactively, and the crossing logged."*

**What this means for the brainstorm:** L1 is a closed technical case, live in `CLAUDE.md` §11 as a
**process** lesson (the Waiver Gate), not a live product gap. Do not re-litigate "build equipPlan" — it
exists. What remains open and IS still gap-shaped: `equipPlan`'s narrow scope (`smoke`/`cook` only, no `sv`,
smoker-only fuel/refuel tables) and its single call site (§1.3/§1.4).

### 1.6 · The existing equipment UI — **SOLID**

- **`openEquipment()`** (`app.js:6773`, ~300 lines) is a full CRUD surface: empty-state onboarding
  (`drawEmpty`), a device list grouped by `EQUIP_CATS` with capability chips (*what you can cook* —
  sous-vide/smoke/grill unlocked or not), an "Other" category rendered as an **accessories checklist**
  (not device cards), a category picker, and a form (`drawForm`) with AI web-lookup
  (`aiLookupDevice`/`aiBrandModels`) plus manual entry, save-time validation that **surfaces** invalid
  values instead of silently deleting them (`app.js` doSave — confirms the 2026-07-21 M2 fix shipped: a
  `toast` + `.eq-invalid` class, not a silent `delete`).
- **`openOccupancyView(computed, serve, scope)`** (`app.js:714`) is reachable from a real button:
  `find_referencing_symbols` shows exactly one call site, `list.querySelectorAll('[data-occview]')…
  openOccupancyView(cx.computed, cx.serve, cx.scope)` inside `renderTimelinePanel`'s wiring
  (`app.js:6448` region) — this is a live, clicked-from-the-Work-Plan surface, not dead code.
- **Device-silhouette dispatch — `occupancyDevHtml(o)`** (`app.js:525`) picks one of five renderers via
  `deviceSilhouette(dev)` (`app.js:334`): `_occVesselBody` (sous-vide, `app.js:625` region — bags + water
  line, deliberately **no %** per H2), `_occOffsetBody` (offset smoker — firebox + barrel of grates),
  `_occGrillBody` (round for kettle/charcoal, rect otherwise — heat *zones*, honestly labelled "Zone N", not
  claiming direct/indirect knowledge it doesn't have), `_occCabinetBody` (`app.js:572`, the fallback for
  every other smoker + all ovens — a truthful stacked-shelf view), plus an overlay `_occBayHtml` for hanging
  capacity when `cap.hooks>0`. **Correction to the task brief:** the actual function/CSS naming is
  `_occCabinetBody`/`_occGrillBody`/`_occVesselBody`/`_occBayHtml`/`_occOffsetBody` with CSS classes
  prefixed `occ2-*` (e.g. `occ2-rack`, `occ2-shelf`, `occ2-vessel`) — there is no `occ-view-*` class prefix
  anywhere in `app.js`; the mechanism the brief described exists, the exact token does not.
- `chooseBath` is wired into `_occVesselBody` (`app.js:630` region) as an **advisory display line**
  ("use the N L bath") — it does not feed back into `equipPlan` or the schedule.

### 1.7 · Cooking order today — **deep in data + generation, thin in device/plan influence**

- **Expressible and cited-data-gated, not a formula guess.** `comboHasSvSmoke(meta, methodKey)`
  (`app.js:3274`) only offers the reverse `smoke-sv` order when the recipe carries **cited** reverse-order
  data — `meta.obj.order_smokesv` with `sv.pasteurize===true` — never a generic heuristic. The two orders
  are named in `SV_SMOKE_ORDERS` (`app.js:2963`): `sv-smoke` (default, safe-by-default) and `smoke-sv`
  (advanced, cold-smoke-then-pasteurize).
- **Depth: recipe data → stage generation → both plan renderers**, confirmed by reading all three sites.
  `itemStages(meta, methodKey, ready, order)` (`app.js:3223`) branches on `order==='smoke-sv'` to build a
  cold-smoke stage followed by a sous-vide-pasteurization stage with cited temps/hours where available,
  falling back to conservative computed values only when data is missing. The order is stored per-item,
  per-event: `st.svSmokeOrder` in `buildList`'s `allState` (Work Plan) and `evState[key].svSmokeOrder` in
  `combinedEventsRows` (`app.js:8260`) — **both call sites pass it into the same `itemStages`**, so the two
  plan surfaces agree by construction rather than by convention.
- **Where it stops:** `equipPlan` (`app.js:973`) branches only on `s.kind` (`smoke`/`cook`), never on
  `order` — a device is resolved and enriched identically regardless of which order produced that stage.
  Order does not reach device *suitability* (e.g. nothing checks whether a device can do a genuine cold
  smoke vs. only a hot one) — it reaches temperature/duration/sequence, not device selection.

---

## 2. Charter cross-reference table

Source: `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` §2.1 (gap counts, "defining
property") and §4 (phases). Gap counts are the charter's own, as of its 2026-07-22 v258 baseline — not
re-audited here; several of the underlying *facts* were reconfirmed live in §1 above and are noted where
they still hold.

| Map area | Charter subsystem | Gap count | Charter's defining property | Phase | Status vs. code, today |
|---|---|---|---|---|---|
| 1.4 Plan/workplan pipeline | **S2 · Plan pipeline** | **25** | *"The pipeline is a private closure inside a render function (`app.js:5622`); its only exports are 5 `window` globals"* | P5a (extraction, "riskiest single change in the program"), P3 (surface `safetyDiff`), P8 (orchestrator) | **Still true in shape** — confirmed live: the pipeline (`itemStages→equipPlan→planSchedule→schedulePlacements→safetyDiff`) still runs inside `buildList`'s render closure (`app.js:6018+`); the charter's own citation `app.js:5622` is now stale (current site is `~6018-6110`) — the pipeline's *internals* were extracted into real top-level pure(ish) functions (`planSchedule`, `schedulePlacements`, `equipPlan`) between the charter's baseline and today, but the closure itself, and its `window` globals (`window._plcConflicts`, `window._planSafetyViolations`, `window._occT`, …), were not |
| 1.1 Device data model, 1.2 Occupancy engine | **S3 · Capacity & occupancy** | **15** | *"A correct shared verdict (`out.fit`) that 2 of 3 consumers bypass"* | P5b (one capacity verdict, "ships only after a before/after review" — D6) | **Partially closed since baseline** — `deviceOccupancy`'s `.fit` verdict is now the verdict `cookerContention` reads (confirmed, `app.js:258-288` comment names the H4 fix explicitly); `combinedEventsRows` still uses its own instant-sampling logic rather than calling `schedulePlacements`/the shared placer (§1.2) — the "3 consumers, 1 verdict" unification is not complete |
| 1.3 Cook→device binding, 1.5 `equipPlan` | S2 (D1–D11 live under §3.D "Equipment-to-plan") | *(counted inside S2's 25)* | — | P2/P3 (safety gates, monitoring), P8 | `equipPlan`'s narrow scope (D4: smoker-only fuel tables, no `sv`) and D2 (14 unread properties)/D1 (`choosePlate`/`chooseNozzle` uncalled) reconfirmed unchanged in §1.1/§1.3 |
| 1.2 keystone (allocation), 1.4 cross-event | S2 + S3 | — | *"Cross-event resource allocation does not exist… only a raw time-overlap that ignores device and capacity"* (C3) | **P9 · Cross-event allocation**, explicitly **after** the orchestrator, per owner decision **R5** | **Confirmed still true**, and now more precisely so: `combinedEventsRows` bypasses `equipPlan`/`schedulePlacements` entirely (§1.2/§1.3); the 2026-07-24 fix (commit `1a55aba`) made the *interim* behaviour more honest (silent unless `equipConfigured()`) without building the real allocator — matching R5's "interim: neutralise the currently-wrong overlap warning" instruction exactly |
| — (the solver itself) | S2 | — | *"The Phase 3a solver is 0% built"* (C1) | **P8 · Orchestrator**: `orchestrate`, `movesForClash`, `applyMove`, `safetyGate`, the hold-safety spine. **Requires P3 and P5. Last, per D1** | **Confirmed unchanged**: `grep -n "^function orchestrate\|^function movesForClash\|^function applyMove\|^function safetyGate" app.js` → zero hits |
| 1.6 Equipment UI, 1.7 Cooking order | S2/S9/S10 (product surface) | — | — | P7 (product surface, opens with the new home-screen spec) | Both reconfirmed **solid/live** in §1.6/§1.7 — not blocking, but P7 is where any UI rework for a new Equipment Manager would land per the charter's own phase ordering |

**Reading this table for the brainstorm:** the charter already places the exact two pieces this design needs
— a unified capacity verdict (P5b) and the orchestrator/allocator (P8, followed by cross-event allocation in
P9) — as the **last** structural work in the program (P8/P9 sit after P5a/P5b/P6/P7 in the phase order, and
P8 is explicitly gated on P3+P5). An Equipment-Manager-as-SSOT proposal is, in the charter's own vocabulary,
**most of P8+P9 plus a slice of S3's "one capacity verdict"** — not a new, twelfth subsystem.

---

## 3. The keystone question, answered from the code

> **Does time-windowed device allocation exist today, or must it be built?**

**It must be built.** What exists today is a **same-render-pass, in-memory, best-effort scheduler** confined
to whichever items are already entered into the plan being rendered:

1. `planSchedule` (`app.js:2988`) computes an unconstrained backward relaxation (every stage ends exactly
   when the previous one starts, working back from serve time) — no device term at all.
2. `schedulePlacements` (`app.js:3099`) then re-places stages **against one device's capacity at a time**,
   pulling a stage earlier (never later, never onto a different device) when it collides with another stage
   already claiming that device — bounded, reported as a conflict when it can't fit within the bound. This
   *is* real time-shifting driven by equipment fact — the report's Phase 4b claim is now true — but it only
   ever operates on the `computed[]` array handed to it by the caller for **one already-fully-specified
   render pass**.
3. `deviceOccupancy` (`app.js:438`) answers "what's on device X at instant `t`" by **re-scanning that same
   `computed[]` array** — it is a live query over already-resolved stage times, not a stored ledger.
4. `combinedEventsRows` (`app.js:8260`) is the only place that reasons across **multiple** events, and it
   explicitly does not call the placer — it only samples the honest verdict at stage-start instants, gated
   entirely off when no kit is configured.

**No function in `app.js` takes `(deviceId, proposedStart, proposedEnd)` and returns a free/busy answer
independent of first re-deriving the full stage set for every item across every event.** There is no
persisted reservation record — `mk-item-cooker-<scope>` stores a manual device *pick*, not a time window.
Two events on the same device today can only be checked for conflict by rendering **both** into one
`computed[]` array and re-running the whole pipeline (which is exactly, and only, what `combinedEventsRows`
does, and only at the instants where a stage happens to start).

This matches the charter's own framing precisely (§2, C3: *"Cross-event resource allocation does not
exist"*; §4, R5: *"Cross-event allocation waits until after the orchestrator"*) and is now confirmed by
direct code inspection rather than inherited from either document. **An Equipment-Manager-as-SSOT that
answers "is device X free for this window" to event planning is new work — the allocator/ledger layer, not
the capacity/fit model underneath it, which can largely be absorbed.**

---

## 4. What I could NOT determine from the code

- **Whether `equipConfigured()`'s single boolean (`mk-equip-set`) is the right identity boundary for a
  future Equipment Manager**, or whether it should key off `equipList().length>0` directly — both exist
  today (`equipConfigured` reads the flag; `openEquipment`'s empty-state branches on `equipList().length`)
  and I did not trace every place that reads one vs. the other under time budget.
- **Test-suite pass/fail state for the equipment/occupancy specs.** Per the task's explicit instruction I did
  not run `npx playwright test`; I counted the relevant spec files (`tests/equipplan-seam.spec.ts` 128
  lines, `tests/safety-invariant.spec.ts` 76, `tests/occupancy-slots.spec.ts` 104,
  `tests/contention-per-slot.spec.ts` 61, `tests/occupancy-clash.spec.ts` 110,
  `tests/cooker-ambiguity.spec.ts` 73, `tests/equipment-visibility.spec.ts` 140,
  `tests/equip-chooser.spec.ts` 92 — 784 lines total) and read one file's assertions in detail, but did not
  verify all of them currently pass.
- **D5 (guest-count-scaled occupancy demand) and D6–D11** from the ULTIMATE §3.D list — I reconfirmed D5
  live (`footprint_cm2` is used as a static constant at exactly two sites, `app.js:368` and `app.js:6660`
  region, with no guest/piece-count multiplication found by grep) and D2/D1 in detail, but did not
  individually re-verify D6 (`probeChannels()`), D7 (charcuterie Slice B), D8 (warm-up), D9 (`grz` zoning) or
  D10/D11 line-by-line against current code — flagging them as **not reconfirmed today**, only inherited
  from the 2026-07-22 audit.
- **Whether the AI equipment-lookup path (`aiLookupDevice`/`aiBrandModels`, wired into `openEquipment`)
  writes values that later collide with the D2/D3 defects** (e.g. does an AI-sourced spec ever populate
  `#eqvArea` instead of `#eqProp-areaCm2`?) — I read the call sites but not the full AI-response-mapping
  logic in depth.
- **The exact current size and pass state of the full Playwright suite** (the discipline doc's own §11a
  narrative cites a moving number, "415 declarations" as of the charter, "784 lines" across the 8 files
  I counted above) — not re-measured here, per the read-only scope of this task.
- **Whether any spec beyond the five read in full**
  (`2026-07-15-cookout-orchestrator-equipment-2.0-design.md`, `2026-07-20-equipment-consumption-layer-
  design.md`, `2026-07-20-equipment-properties-completion-design.md`, `2026-07-21-occupancy-slots-h4-
  design.md`, `2026-07-21-occupancy-view-phase2-spec.md`, `2026-07-21-scheduler-phase4-spec.md`) contains a
  Definition-of-Done line still unmet — I traced the code, not each spec's own DoD checklist line-by-line
  against the code (that is a per-phase DoD audit per `CLAUDE.md` §3, out of scope for a read-only map).

---

## Appendix — file:symbol index (all `app.js` lines grep-confirmed, 1-based)

| Symbol | Line | Role |
|---|---|---|
| `EQUIP_CATS` | 34 | device category/property schema |
| `propOf` | 122 | property resolver (stored value → class default) |
| `equipList` | 221 | reads `mk-equipment` |
| `svBaths` | 230 | **zero production callers**, confirmed (charter §8 self-correction, reconfirmed) |
| `cookerCandidates` | 233 | kind → candidate device category mapping |
| `itemCookerScope` / `setItemCooker` | 240 / 241 | manual per-(item,kind,event) device pick storage |
| `cookerFor` | 242 | resolves one device for (item, kind, scope) |
| `cookerContention` | 258 | same-event clash detection |
| `deviceCapacity` | 305 | area/volume capacity resolution incl. bath-size precedence |
| `deviceSilhouette` | 334 | occupancy-view renderer dispatch key |
| `itemOccupancy` | 356 | per-recipe space/volume/hang requirement reader |
| `packDevice` | 403 | stable item→shelf/zone/bath slot assignment |
| `deviceOccupancy` | 438 | instant-in-time occupancy query (not a stored ledger) |
| `occupancyDevHtml` | 525 | silhouette dispatch |
| `_occCabinetBody` | 572 | shelf-stack renderer |
| `equipConfigured` / `equipSetConfigured` | 754 / 755 | `mk-equip-set` gate |
| `equipMigrateFromGear` | 757 | legacy `mk-gear` migration |
| `occupancyViewHtml` | 688 | per-device occupancy view assembly |
| `openOccupancyView` | 714 | panel opener, wired to a real `data-occview` button |
| `equipPlan` | 973 | the enrichment seam (fuel/refuel only, smoke+cook only) |
| `REFUEL_MIN` | 957 | smoker-type refuel cadence table |
| `DEVICE_FUEL` | 964 | smoker-type fuel-label table |
| `SV_SMOKE_ORDERS` | 2963 | the two named sv/smoke orders |
| `svSmokeOrderDefault` | 2969 | defaults to `'sv-smoke'` |
| `planSchedule` | 2988 | unconstrained backward relaxation |
| `chooseBath` | 3014 | smallest-fitting registered bath — wired to display only |
| `choosePlate` | 3024 | **zero production callers** (D1, reconfirmed) |
| `chooseNozzle` | 3034 | **zero production callers** (D1, reconfirmed) |
| `_windowFits` | 3083 | capacity-window feasibility check |
| `schedulePlacements` | 3099 | the real device-capacity time-shifting placer |
| `itemStages` | 3223 | stage generation, order-aware, no device field |
| `comboHasSvSmoke` | 3274 | gates reverse order on cited `order_smokesv` data |
| `renderTimelinePanel` / `buildList` | 6018 / 6049 | the one production pipeline (private render closure) |
| `openEquipment` | 6773 | full equipment CRUD UI |
| `combinedEventsRows` | 8260 | cross-event view — bypasses `equipPlan`/`schedulePlacements` |
