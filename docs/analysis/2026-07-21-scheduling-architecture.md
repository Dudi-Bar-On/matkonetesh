# Scheduling architecture — why the orchestrator cannot place along a timeline, and what to build instead

**Date:** 2026-07-21
**Scope:** the orchestration/optimization complaint — *"not taking into account the time all the cuts are mounted from the beginning and not along the timeline as it should be, what basically can reduce collisions in embedding the tasks on the devices."*
**Verdict:** the complaint is correct, and the situation is worse than "poor optimization". **There is no optimizer. There is no placer. There is no representation in which a stage could be placed.** What ships today is the resource-free critical-path relaxation of a scheduling problem, rendered as if it were the answer, with a capacity checker bolted on afterwards that can only tell you the answer was wrong.

---

## 0. Executive finding

Every item's stage chain is laid out by a single backward walk from the event's serve time. `start(stage_i) = serve − Σ_{j≥i} hours_j`. There is no cross-item term anywhere in that expression. Two items cannot see each other; a device cannot influence when anything happens; capacity is consulted only *after* every time is already fixed and immutable.

The failure mode is not "the scheduler sometimes collides." It is structural: because **every** item's last stage is pinned to end exactly at serve, and last stages are short (`rest` ≈ 10-30 min, `bcheck` = 0 min), **every item's cook stage ends within minutes of every other item's**. The architecture does not fail to avoid collisions — it manufactures the maximum possible number of them, deterministically, on every plan.

The occupancy layer (v-recent: `deviceCapacity` / `itemOccupancy` / `deviceOccupancy` / `occupancyCompat` / `cookerContention`) is a genuinely good model. It is wired as a **verifier**. It answers "given a finished schedule, what is on device D at instant t?" A placer needs the inverse question, and that function does not exist.

---

## 1. Where exactly is a stage's start time decided?

### 1.1 The generator emits durations only

`itemStages(meta, methodKey, ready, order)` — **app.js:2578-2628** — returns an array of
`{label, hours, kind, temp?, note?, safety?}`. It reads the recipe profile and nothing else. A grep for `cooker`, `device`, `equip`, `cap`, or `occupancy` across its entire body returns nothing. It has no parameter through which equipment could enter. It emits:

- `prep` (2582), `smoke`/`sv`/`cook` (2594-2617), `dry` (2604), `note` with `hours:0` (2595, 2611), `rest` (2622), `bcheck` with `hours:0` (2626).

No stage carries an earliest-start, a latest-finish, a shiftability class, a resource requirement, or an owner. It is a *bill of durations*.

### 1.2 The times are assigned by a pure backward walk — this is the whole scheduler

**app.js:5031-5036**, inside `buildList`:

```js
let end=serve;
for(let i=stages.length-1;i>=0;i--){
  const s=stages[i]; const start=new Date(end.getTime()-s.hours*3600e3);
  s.start=start; s.end=end; end=start;
}
startClock=end;
```

That is the entire scheduling algorithm in the product. Read it plainly:

- `end` is initialized to `serve` **for every item independently**.
- The loop body contains no reference to any other item, to any device, to any capacity, or to any previously placed stage.
- `s.start` and `s.end` are **mutated onto the stage object returned by `itemStages`** — the generator's output and the scheduler's output are the same mutable object. (This detail matters enormously; see §3c.)

So yes: **purely `serve − sum(durations)` per item.** The hypothesis is confirmed exactly.

### 1.3 It is implemented twice, independently

**app.js:7109-7116**, inside `combinedEventsRows`, does the same walk again with millisecond arithmetic instead of `Date`, keeping only device-relevant stages:

```js
let end=serve.getTime(), smokeWin=null;
for(var i=stages.length-1;i>=0;i--){ const s=stages[i]; const sSt=end-(s.hours||0)*3600e3;
  if(['smoke','cook','sv'].indexOf(s.kind)>=0){ ... computed.push({... start:new Date(sSt), end:new Date(end) ...}); }
  end=sSt;
}
row.start=new Date(end);
```

Two copies of the same design defect. Any fix must delete one of them, and the two are not obviously semantically identical (different scope resolution for devices, different numeric types, different stage filtering) — which is itself a phase-0 risk (§8).

### 1.4 What that walk actually is, in scheduling terms

It is the **backward critical-path pass of an RCPSP instance with all resource constraints removed.** It computes the latest-finish / latest-start times of a resource-unconstrained relaxation. That is a legitimate and necessary *first step* of a real scheduler — it is what gives you each activity's latest-feasible position and therefore its slack.

The defect is that the app **ships the relaxation as the solution.** Everything downstream — the item view, the work plan, the timers, the notifications, the voice-cook task list, the multi-event view — consumes the relaxation as though it were a schedule.

---

## 2. Can anything move a stage in time, or move an item between devices, automatically?

**No. Not one line of code.** Exhaustive inventory of everything that touches placement:

| # | Mechanism | Location | What it actually does | Automatic? |
|---|---|---|---|---|
| 1 | "Move to other cooker" button | emit **5208**, handler **5329** | `setItemCooker(key, kind, deviceId)` then `buildList()`. Always offers `other[0]` — the *first* alternative candidate — with **no check that the target is free, big enough, or even capable of the required temperature**. | **Manual.** One tap, one item, one hop. |
| 2 | Per-item cooker dropdown | **5194-5203** | Same store write, user-chosen. | Manual |
| 3 | "Push serve +30 min" | **4962** | Adds 30 min to the serve time. Every item moves by exactly 30 min. | Manual, and a **rigid translation** — it cannot change any item's position *relative to another*, so it cannot resolve a single collision. |
| 4 | "Reschedule to start now" | **4963** | Shifts serve so `earliest → now`. Same rigid translation. | Manual, same limitation. |
| 5 | Sous-vide batching | **5100-5105** | Finds items that *already* overlap on the same circulator at the same temp and appends `"shared bath with X"` to the task's `sub` string (**5155**). | **Advisory text only.** It never creates the overlap; it never checks volume. |
| 6 | `cookerContention` | **254-279** | Detector. Returns clash descriptors. Rendered as a banner at **5204-5213**. | **Read-only. It has no writer.** |
| 7 | Occupancy view | **413-478** | Scrubbable visualization of `deviceOccupancy`. | Read-only |
| 8 | `PREFS` orchestrator knobs | **6075-6081** | `autonomy`, `shareTolC`, `woodSwap`, `holdEnabled`, `aiRank`, `slotModel`, `holdMaxH` — registered with the comment *"REGISTERED now so Slice 2/3 only add their consumers"*. | **Zero consumers.** `grep "pref('autonomy')"` etc. returns nothing. The settings for the solver shipped; the solver did not. |

Things the Phase 3a design specified that **do not exist in app.js**: `orchestrate()`, `movesForClash()`, `applyMove()`, `safetyGate()`, `holdCapMin()`, `dangerZoneMin()`, and the storage key `mk-item-shift-<scope>`.

That last one is the crux. **There is not even a data structure capable of representing "this stage was moved."** The time axis of the plan is a pure function of `(serve, item set, method choices)` with no free variables. There is nowhere to put a decision.

Similarly, from the consumption-layer spec: `equipPlan()` and `preheatMin()` do not exist. The preheat is still the hard-coded `earliestSmoke − 45 min` at **5043**, smoke-only.

---

## 3. The real coupling that prevents capacity-aware placement

Three distinct couplings. All three must be broken; breaking only one achieves nothing.

### (a) `buildList` is not a scheduler — it is a renderer that computes times as a side effect

`buildList` is a **closure declared at app.js:5012 inside `renderTimelinePanel`**. It is not a top-level function. It cannot be called, cannot be tested, cannot be reused, and cannot be run twice on different candidate inputs. Its body is a straight line: resolve items → walk back → sort → set notification timers → build HTML string → `innerHTML` → wire event handlers. Lines 5017-5087, one pass, no branch point at which a *candidate* schedule exists that could be scored, mutated, and re-scored.

It is also re-entered on **every keystroke** of the serve-time input (**4996**) and on every state toggle. Whatever replaces it must be deterministic and fast enough for that, and must not depend on `Date.now()` or on object iteration order — or the user will watch devices swap under their fingers.

**Current contract:** `buildList()` → `void`, side effects: mutates `allState`, mutates every stage object with `start`/`end`, sets `window._wpTasks` / `_wpServe` / `_wpStart`, writes `#tlList.innerHTML`, registers `setTimeout` notification timers.

**Required contract:** a top-level pure `planSchedule(items, serve, opts) → {placements[], deficits[], diagnostics}` with no DOM and no storage writes, called by both `buildList` **and** `combinedEventsRows`.

### (b) `deviceOccupancy` has a verifier's contract, and a placer needs the inverse

**app.js:344-379.** Signature: `deviceOccupancy(devId, tMs, computed, scope)`. It requires a **fully-timed** `computed` array, and it hard-filters out anything incomplete:

```js
if(!c || c.blocked || !c.stages || !c.m) return;               // 350
if(['smoke','cook','sv'].indexOf(s.kind)<0 || !s.start || !s.end) return;   // 352
if(tMs<st || tMs>=en) return;                                  // 354
```

It answers: *given a finished schedule, what is on D at t?* A placer needs: *given a partially built schedule, a stage of duration H requiring resource vector R with attributes A, what is the latest window ending no later than LF where R fits and A is compatible with every co-resident?*

That inverse function — call it `deviceFreeWindows(devId, partial, req, attrs, lf)` — does not exist. It is cheap to build (capacity changes only at interval endpoints; ≤ 2n endpoints per device; n ≤ 12) but it cannot be layered on top of `deviceOccupancy` without accepting the partial-schedule shape that `deviceOccupancy` explicitly rejects.

### (c) `s.start`/`s.end` are mutated onto the generator's output — so two candidate schedules cannot coexist

Line **5034**: `s.start=start; s.end=end;`. The stage object *is* the placement. There is exactly one, and it is destroyed by the next assignment. Any search — even a two-option comparison — requires holding schedule A while evaluating schedule B. **This single line is the reason no search algorithm can be written against the current model**, independent of everything else. Placements must become a separate array keyed by stable stage id (`tid` already exists, generated at **5030**).

### (d) Device assignment is an input, not a decision — and ambiguity is silently invisible

`cookerFor(itemKey, kind, scope)` — **238-250** — reads the user's stored assignment, falls back to "single candidate" or "single native candidate", and otherwise **returns `null` (line 249)**. Both consumers then *skip* the item entirely:

- `cookerContention` line **260**: `const d=cookerFor(...); if(!d) return;`
- `deviceOccupancy` line **355**: `if(!d || d.id!==devId) return;`

This is defect **D6** from the 2026-07-17 audit, still live: **buying a second smoker makes clashes disappear rather than resolve.** For a placer this becomes moot — the placer *chooses* the device — but until then the detector is unsound in exactly the situation it exists for.

Also unused despite being available: `propOf(dev,'maxC')` (**app.js:41-42**, with per-type defaults: electric 135 °C, cabinet 150 °C, pellet 260 °C…). `cookerCandidates` (**230-235**) filters by *category only*. Nothing prevents proposing a 110 °C smoke on a device whose max is lower, or a 260 °C sear on a 150 °C cabinet.

---

## 4. Modelling the problem properly

### 4.1 What this problem actually is

Not job-shop. Job-shop assumes unit-capacity machines processing one job at a time; a pit holds six cuts simultaneously, which is precisely what job-shop cannot express.

Not bin-packing over time. That is the right intuition for the *resource* dimension (area × time is a 2D strip-packing), but bin-packing has no precedence and no deadline. It is a sub-problem, not the formulation.

The correct formulation is:

> **Deadline-anchored multi-mode resource-constrained project scheduling (MRCPSP) with multi-dimensional cumulative renewable resources, machine assignment, and incompatible batching families.**

Component by component, against this codebase:

| Element | This app |
|---|---|
| **Activities** | Stages from `itemStages`. 2-12 items × 2-6 stages ⇒ **10-45 activities**. |
| **Precedence** | Finish-to-start chains per item, currently zero-lag. Real lags exist and are faked as `hours:0` `note` stages (**2595**, **2611**) that `workPlanHtml` then *discards entirely* (**5134**: `else if(s.kind==='note') return;`). |
| **Deadline** | One shared hard deadline: serve. All chains terminate there. This is what makes it *deadline-anchored* rather than makespan-minimizing — there is nothing to minimize at the tail. |
| **Renewable cumulative resources** | Each cooker. Capacity is a **vector**, not a scalar: grate area cm² (`usableCm2` = `areaCm2 × PACK_EFF 0.85`, **303**), hook count (**302**), and for sous-vide, litres (**298**). `deviceCapacity` already returns all three. |
| **Resource demand** | `itemOccupancy` (**308-318**) returns `{mode:'area'\|'hang'\|'volume', cm2, hooks, litres}`. Derived in `equipment_map.py:167` as `kg × SHAPE_CM2_PER_KG[shape]`, **`None` when weight is unknown**. |
| **Modes** (the *multi-mode* part) | (i) grate vs hang for the same item; (ii) which device, from `cookerCandidates`; (iii) sv→smoke vs smoke→sv ordering. Each mode changes the resource vector and sometimes the durations. |
| **Incompatible batching families** | **The constraint that breaks vanilla RCPSP.** Two activities may co-reside on a pit only if a single temperature suits both (`tempOk`, spread ≤ `TEMP_TOL_C` 6 °C, **334**) and one wood serves both (`woodOk`, **338**). This is not capacity — it is a *compatibility graph on co-residency*. In OR terms it is **p-batching with incompatible job families**: a pit is a batching machine, jobs belong to (temp, wood, fuel) families, only same-family jobs batch. |
| **Shiftable vs fixed** | Rests may extend; prep may float earlier; cooks may not shrink and (under the safety rule) may not be interrupted. The data model has **no field for any of this** (§5). |

NP-hard in general. Irrelevant at this size. 10-45 activities and 1-4 resources is a *tiny* instance; the entire difficulty is in the modelling and the safety boundary, not the search.

### 4.2 The algorithm: backward serial SGS + priority rule + limited-discrepancy repair

Deterministic, offline, vanilla JS, sub-millisecond at this size, and — critically — **degrades to today's output** if every extension is disabled.

#### Phase 0 — Build the activity network

For each item, take `itemStages` output unchanged (it is safety-critical; do not touch it) and *annotate* it (post-processor, exactly the `equipPlan` seam the consumption spec already argued for):

```
for each item I, for each stage s:
  s.res    = itemOccupancy(I.meta, s.kind)     // {mode, cm2, hooks, litres}
  s.attrs  = {tempC: s.temp, wood: I.wood, fuel: required fuel class}
  s.shift  = shiftClass(s.kind)                // see §5
  s.lag    = transferLag(s, next(s))           // the note-stages become real lags
  s.devKind= s.kind in {smoke,cook,sv} ? s.kind : null
```

#### Phase 1 — Resource-free backward CPM pass (this is today's walk, kept)

```
LF(last stage of I) = serve
LF(s) = LS(succ(s)) − lag(s, succ(s))
LS(s) = LF(s) − dur(s)
```

Also compute earliest-start bounds: `ES(first stage of I) = max(now, thawReady(I))`. Today the plan happily schedules into the past, which is why the "reschedule to now" bolt-on at **4963** exists.

`slack(I) = LS(first stage) − ES(first stage)`. **This pass is the current product.** Everything after it is new.

#### Phase 2 — Priority ordering (the heuristic that does most of the work)

Sort items by, in strict lexicographic order:

1. **least total slack** — a 14 h brisket against an 18:00 serve has ~zero slack and must own its window;
2. **largest resource demand** — `cm2` desc, then `litres` desc, then `hooks` desc. Decreasing-first-fit: place the big things first, let small things fill gaps. This is the single most important tie-break;
3. **fewest feasible devices** — `cookerCandidates(kind).length` asc. An item with one possible pit is placed before one with three;
4. **longest total duration** desc;
5. **stable item key** — determinism is mandatory (§3a).

#### Phase 3 — Serial schedule generation, backward, with device choice

```
placements = []
for I in priorityOrder:
  lf = serve
  for s in reverse(I.stages):
    if s.devKind == null:                       // prep, dry, rest, note, bcheck
       place(s, [lf − dur(s), lf]); lf = start(s) − lag; continue

    cands = cookerCandidates(s.kind)
            .filter(d => capable(d, s.attrs))   // NEW: maxC gate, fuel gate
            .sort(by: 1. already hosts a COMPATIBLE batch overlapping [lf−dur, lf]   // sharing is free
                      2. residual capacity in the binding dimension, desc
                      3. matches the user's stored assignment                        // respect intent
                      4. stable device id)

    win = null
    for d in cands:
      win = latestFeasibleWindow(d, dur(s), s.res, s.attrs, lf, placements)
      if win: break

    if win: place(s, win, device=d); lf = win.start − lag
    else:   deficits.push({item:I, stage:s, dimension, shortfall, lf}); lf = lf − dur(s)  // place at CPM position, flag it
```

`latestFeasibleWindow(d, H, req, attrs, lf, placements)`:

```
events = sorted endpoints of placements on d, restricted to (−∞, lf]
sweep backward from lf; maintain used vector and the co-resident attribute set
a candidate window [t, t+H] is feasible iff for every instant in it:
    used.cm2 + req.cm2    ≤ cap.usableCm2
 && used.hooks + req.hooks ≤ cap.hooks
 && used.litres+ req.litres≤ cap.litres
 && occupancyCompat(coResidents ∪ {s}).tempOk && .woodOk
return the LATEST such window, or null
```
O(k) over ≤ 2n endpoints. At n ≤ 12 the whole placement is a few thousand operations.

Note what "latest" buys: it keeps every item as close to serve as physics allows, so nothing sits around unnecessarily. Items only move earlier when they *must*, which is exactly the food-safety-preferred direction.

#### Phase 4 — Repair ladder (only reached when `deficits` is non-empty)

Ordered cheapest-and-safest first. Each rung is a typed *move* with a cost, and each is individually gated by §6.

| Rung | Move | Cost | Notes |
|---|---|---|---|
| **R1** | **share** — accept co-residency within `pref('shareTolC')` | 0 | Already attempted inside Phase 3. Reaching R1 explicitly means relaxing the *default* tolerance to the user's setting. **See §6 — the setpoint hazard.** |
| **R2** | **hang instead of grate** | 0 | Item declares `spec.hang`, device has `canHang` + free hooks. Frees the item's *entire* footprint. Zero time, zero safety cost. **The highest-value move the app never makes.** |
| **R3** | **reassign** to another capable device | 0 | With the `maxC`/fuel gate that `cookerCandidates` lacks today. |
| **R4** | **pull the chain earlier and hold** | hold-minutes | The move that actually decongests. Removes the biggest, longest item from the peak window. Hard-gated by §6. |
| **R5** | **extend the rest** | hold-minutes | Mechanically identical to R4 with the slack absorbed by an existing stage. **Gated identically** — a 3 h "rest" at ambient is not a rest. |
| **R6** | **stagger into two batches** | staggered start | Split a same-temp group into two sequential batches on one device. |
| **R7** | **advise** | 0 | Always emitted. "Push serve by N min", where N is computed by re-running Phase 3 at `serve+Δ` and bisecting Δ over 15-min steps to 120 min — a *real* number, not a guess. Or "this needs a second pit / move X to the oven". |

#### Phase 5 — Limited-discrepancy search (the backtracking strategy)

Full backtracking is unnecessary and unbounded. **LDS** is the right fit because it encodes exactly the correct assumption: *the greedy is usually right, and wrong in only one or two places.*

```
best = greedyResult
if best has deficits:
  for k in 1..2:                             // discrepancy budget, hard cap 2
    for each choice point cp in recorded order:      // device pick, or repair rung
      rerun Phase 3+4 taking the (1+k)-th ranked option at cp, 1st elsewhere
      best = betterOf(best, result)
      if best has no deficits and no holds: break all
      if elapsed > 50ms or reruns > 200: break all   // wall-clock guard
```

**Objective is lexicographic, never a weighted sum:**
1. fewest unresolved deficits
2. fewest hold-minutes
3. fewest departures from the user's stored device assignments
4. latest overall plan start (least early rising)
5. first-found under the fixed ordering (ties → determinism)

A weighted sum would invite the search to trade a safety-adjacent quantity against a convenience one. Lexicographic ordering makes that structurally impossible, which is the point.

**Why not CP/MIP:** no solver offline, and unnecessary at n ≤ 45 activities.
**Why not simulated annealing / GA:** nondeterministic. The panel re-renders on every keystroke (**4996**); a plan that differs between two identical renders is unusable. Determinism is a hard requirement, not a preference.

---

## 5. What must change in the data model

Today a stage is `{label, hours, kind, temp?, note?, safety?}` plus `tid` (**5030**) plus mutated `start`/`end` (**5034**).

### 5.1 The stage gains placement metadata — and never loses a safety field

```js
{
  // EXISTING — authoritative, produced by itemStages, NEVER modified by the scheduler
  label, hours, kind, temp, note, safety,

  // NEW — placement metadata. Derived, not authored. Never safety-bearing.
  id,      // promote the existing `tid` to a first-class stable identity
  item,    // owning item key — a stage must know its chain
  seq,     // index within the chain

  dur: { nominal, min, max },
     // nominal === hours ALWAYS. min/max differ ONLY for kinds whose shift class allows it.
     // For smoke/cook/sv/bcheck: min === max === nominal === hours. Enforced by assertion.

  shift: 'fixed' | 'elastic' | 'floating',
     // fixed    — position determined by successor; duration immovable. smoke, cook, sv, bcheck
     // elastic  — duration may EXTEND, never shrink. rest, dry, hold
     // floating — may move earlier without changing duration. prep, marinade, sauce, rub

  lag: { before, after },      // real transfer/handling minutes. Replaces the fake hours:0 `note`
                               // stages at 2595/2611 that workPlanHtml discards at 5134.

  res: { devKind: 'smoke'|'cook'|'sv'|null,
         mode:    'area'|'hang'|'volume',
         cm2, hooks, litres,
         alt: [ {mode:'hang', hooks:1}, ... ],   // the grate-vs-hang CHOICE, currently
                                                 // decided by mere ownership at line 316
         provenance: 'measured'|'catalog'|'class-default' },

  attrs: { tempC, wood, fuel },   // the batching-family key for co-residency

  window: { es, lf },             // computed by the CPM pass, not authored
  interruptible: false,           // a cook may not be paused; a dry/rest may
}
```

### 5.2 Placements become a separate, addressable structure

```js
placement = { stageId, devId, start, end, mode, batchId, viaMoves:[...] }
schedule  = { placements: Map<stageId, placement>, deficits: [...], score: [...] }
```

**This is the enabling change.** Placements must not live on the stage (§3c) or no search is possible. Two schedules must be able to coexist.

### 5.3 Item-level additions

- **`weight_kg`** — the audit's blocking gap. Source order with recorded provenance: `mk-menuqty-<scope>` → catalog `kg` → shape class default. `_footprint_cm2` (`equipment_map.py:167-173`) returns `None` when `kg` is absent, so demand is currently *unknown* for those items and `itemOccupancy` yields `cm2: 0` — an item that consumes nothing. Note also that catalog `kg` is a *per-cut* figure and does **not** scale with guest count; a 20-guest event and a 6-guest event currently demand identical grate area.
- **`earliest_start`** — thaw/temper constraints and `now`.
- **`hold_class`** — derived from category by the safety layer, never authored per-stage.

### 5.4 Storage

- `mk-item-shift-<scope>` — `{ "<itemKey>|<kind>": minutes }`. Specified in Phase 3a §6, **never created**. Without it a move cannot be persisted.
- `mk-plan-<scope>` — the accepted schedule, so it is stable across re-renders and manual overrides survive.

---

## 6. The safety boundary — explicitly, move by move

**The rule:** this layer may never alter a `bcheck` stage, a `temp`, a `safe` figure, or a cook duration.

### 6.1 Moves that are SAFE under the rule

| Move | Why safe | Caveat |
|---|---|---|
| **reassign** (device change) | Duration and temperature untouched; only *which* box. | **Requires a capability gate that does not exist today.** `cookerCandidates` (230-235) filters by category only. Add `propOf(dev,'maxC')` and a fuel check before this is ever automatic. |
| **hang instead of grate** | A placement mode. No time, no temperature. | Must never be used to justify *shortening* anything on airflow grounds. The app does not model cook rate and must not start. |
| **stagger into sequential batches** | Each item's own cook is unchanged; only the start offsets differ. | — |
| **push serve** | Moves the deadline, not the cook. | Requires explicit user confirmation — it is a real-world commitment. |
| **reorder independent prep / mise-en-place** | No safety-bearing value. | Already done crudely at 5164-5177 by label matching. |
| **pull a chain earlier + refrigerated wait** | Duration and temp unchanged; the item waits *cold*. | Only if the model can state *where* it waits (§8, Phase 3). |
| **hot hold** | Duration and temp unchanged. | **Only under the full Phase 3a §3.5 spine** — see 6.3. |
| **extend a rest** | Only extends; never shortens. | **Gated identically to a hot hold.** See 6.3. |

### 6.2 Moves that VIOLATE the rule — reject at generation, not at review

| Forbidden move | Why |
|---|---|
| **Shorten a cook to fit a window** | Absolutely forbidden. Any move whose delta reduces `hours` on a `smoke`/`cook`/`sv` stage must be structurally unrepresentable, not merely filtered. |
| **Raise a temperature to cook faster** | Forbidden — including *indirectly*. See the setpoint hazard below. |
| **Shorten or skip a rest below `p.restMin`** | The authored rest is a floor. For sv→sear items it carries a real carryover/doneness consequence. |
| **Move, relax, or drop a `bcheck`** | It is the sole authority on "safe to serve" (2626). Immovable, and must never be placed before the cook it verifies. |
| **Flip sv↔smoke ordering to gain a window** | `comboHasSvSmoke` (2629-2637) offers `smoke-sv` **only** when the item carries *cited*, pasteurize-safe reverse data (`order_smokesv` with `sv.pasteurize===true`). The order is a safety decision with a citation requirement, not a sequencing knob. |
| **Batch two sous-vide items at different temps** | `cookerContention` already demands exact equality for `sv`. Any "close enough" tolerance on a pasteurization bath is a safety change. `shareTolC` must never apply to `sv`. |
| **Trim the sous-vide come-up allowance** | The note appended at **2621** exists because pasteurization is timed from core-at-temp. |
| **Treat an unknown capacity as infinite or as zero to force a fit** | Unknown must stay unknown and must not *block*, but it must not silently *permit* either. |

### 6.3 The setpoint hazard — a live, shipped, one-step-from-laundering issue

`occupancyCompat` — **app.js:335**:

```js
setpoint: temps.length ? Math.max.apply(null, temps) : null,
```

Rendered directly into the occupancy card at **398** as `🌡️ {setpoint}°C`.

**Running a pit at the maximum of two items' required temperatures raises the cooler item's cook temperature.** That is a temperature change, presented as a fact about the device. Today it is only a display value on a view the user opened deliberately, and the spread is bounded by `TEMP_TOL_C = 6`, so the exposure is small. But the moment a solver uses `share` as an automatic move with `pref('shareTolC')` at `15`, the app will be *silently changing an item's cook temperature by up to 15 °C* and calling it a scheduling decision.

**Requirement:** `share` beyond `TEMP_TOL_C` must be a *proposal shown to the user with the temperature delta stated*, never an automatic move. And the displayed setpoint should carry the delta today, before any solver exists.

### 6.4 Enforcement as a runtime invariant, not a convention

```js
function safetyDiff(before, after){
  // for every stage id, for kinds in {smoke, cook, sv, bcheck}:
  //   assert identical (kind, hours, temp, safety, label)
  // ANY difference => reject the schedule, fall back to the CPM-backward baseline
}
```

Run on every accepted schedule, in production, not only in tests. The search *will* be extended later; the invariant must survive the extension by someone who has not read this document.

---

## 7. Staging and sequencing opportunities the current design misses entirely

### 7.1 Cook-early-and-hold is unrepresentable — while the app already recommends it

The app tells the user to do this in **four places**:
- `composedSteps` **1080**: for collagen cuts with `tgt ≥ 90`, *"a long hold in an insulated box (cambro/cooler) of an hour+ greatly improves juiciness."*
- `_copilotPaceHtml` **4791**: *"You have slack — hold it wrapped in a cooler (faux cambro)."*
- `copilotAdviceLocal` **4798** and **4802**: same.
- `equipment_map.py` adds `cooler` to a cut's `opt` gear list when the cook is ≥ 4 h or the rest is ≥ 30 min.

And a cooler exists as an owned accessory — `EQUIP_OTHER_ITEMS`, **app.js:5496** `{key:'cooler', he:'צידנית / קמברו', en:'Cooler / cambro'}` — **with no properties at all**: no capacity, no count, no whether it is preheated. So the audit's D11 is *half* closed: the ownership token exists, the schedulable resource does not.

**The scheduler has no way to express any of it.** This is the single biggest decongestant available: it removes the largest, longest, most capacity-hungry item from the peak window entirely, and for collagen cuts it is a *quality improvement*, not a compromise. It should be the **first** move implemented after reassignment, not the last.

### 7.2 Hanging is decided by ownership, never chosen to relieve pressure

`itemOccupancy` **316**:

```js
if(hang && equipOwnsToken('hooks')) return {mode:'hang', cm2:0, hooks:1, litres:0, hang:hang};
```

Own hooks → everything hangable hangs. Don't → nothing does. It is never *traded off*.

And the hook dimension is **computed and discarded**:
- `deviceOccupancy` **376**: `out.hooksOver = cap.hooks>0 && out.hooksUsed>cap.hooks;`
- `cookerContention` **270**: `const bad = o.over ? 'area' : (!o.compat.tempOk ? 'temp' : null);`

`hooksOver` is read **nowhere**. Running out of hooks is never a clash. (Compounding this: the smoker's `hooks` property is `tier:'pro'` with **no class default** — **app.js:44** — so `cap.hooks` is 0 for nearly every user, meaning `hooksOver` would be false regardless. Two different hook sources exist: the *cooker's* `propOf(dev,'hooks')` for capacity, and the *accessory's* `count` at **5498**, which is never used as capacity at all.)

### 7.3 Sous-vide batching is a label, not a plan

`_svBatch` (**5100-5105**) finds items that **already** overlap on the same circulator at the same temperature and appends text. It does not:

- **create** the overlap — the move that matters is *"shift the 4 h chicken breast to start when the 6 h short rib does, both at 63 °C, one bath"*, which requires moving a stage in time and is therefore impossible;
- **check volume** — `spec.min_bath_l` exists in the data (`equipment_map.py:176-180`), `deviceOccupancy` sums `usedLitres` (**361**), and `_svBatch` consults **neither**. It picks `Math.max(baths)` purely for the label;
- **express one-circulator-one-temperature** — two baths on one circulator can currently be shown running at two different temperatures.

### 7.4 Smoke and finish are one atomic stage

`itemStages` emits a single `{kind:'smoke', hours:m.smHours}`. Real practice splits it: smoke phase → wrap → finish, and the wrap is exactly the moment a cut can leave the pit and free its area. The model has no `interruptible` flag and no split point. The irony: `itemRowHtml` **5274** prints *"add wood every ~90 min"* for smoke stages > 2.5 h — **the app already knows the stage has internal structure** and still treats it as indivisible for placement.

### 7.5 Transfer time is fake and then discarded

`{label:'Seal and move to sous-vide', hours:0, kind:'note'}` (**2595**) and `{label:'Move to smoker', hours:0, kind:'note'}` (**2611**) are real handling operations modelled as instantaneous — and then dropped entirely by `workPlanHtml` **5134** (`else if(s.kind==='note') return;`). The plan hides the transition and allocates it zero time. These are precisely the moments one device is freed and another loaded, which is when a capacity-aware scheduler most needs a real lag.

### 7.6 Preheat consumes no device, and only smoking gets one

**app.js:5043**: `const preheat = earliestSmoke ? new Date(earliestSmoke.getTime() - 45*60e3) : null;`

One global task, hard-coded 45 min, smoke-only. It occupies nothing in the occupancy model, so a pit coming to temperature reads `פנוי / Free` and a placer would happily schedule a cook into it. Sous-vide baths (a 24 L bath is ~40 min) and grills get no lead time at all. D1/D2 from the audit, both still open — `equipPlan` and `preheatMin` from the consumption-layer spec were never built.

### 7.7 The operator is not a resource

Nothing models that one person can do one thing at a time. Three items whose `bcheck` all land at serve, plus a sear, plus a glaze at serve−15 min, is a physically impossible few seconds of human activity. The mise-en-place clustering at **5164-5177** is the only nod to this, and it groups by **label prefix**, not by time.

### 7.8 Nothing exploits resource independence

A sous-vide item and a smoked item never compete for anything, yet both are laid out on the same converging timeline. There is no notion of *"this item is alone on its resource — give it the window it prefers, and let the contested resource drive the ordering."*

---

## 8. Phased implementation sequence

Each phase is independently shippable and independently testable. Each names its riskiest assumption.

### Phase 0 — Extract and dedupe the walk (no behavior change)

Lift **5017-5039** into a top-level pure `planSchedule(items, serve, opts)`. Make `combinedEventsRows` (**7109-7116**) call it instead of its private copy. Change the output shape from "stages with `start`/`end` mutated in" to `{stages, placements[]}`. Snapshot-test byte-identical rendered output in Hebrew and English.

> **Riskiest assumption:** that the two walks are *semantically* identical. They are not obviously so — different numeric types, different stage filtering, different device-scope resolution (`ev.id` vs the active scope). **Verify with a fixture that produces both views and diffs every derived start time before merging them.** If they differ, one of the two views is already wrong today and that must be resolved first.

### Phase 1 — Make placement observable (still CPM-backward)

Add `res` / `attrs` / `window` / `shift` / `lag` as derived annotations. Resolve `weight_kg` with provenance. Build `deviceFreeWindows` as the inverse of `deviceOccupancy`. Report per-device deficits with dimension and shortfall — **including `hooksOver`, which is computed at 376 and discarded**. Fix D6: an ambiguous device must not make an item invisible to the detector.

> **Riskiest assumption:** that per-item resource demand is knowable. `footprint_cm2` is `kg × class constant` (`equipment_map.py:167`), not a measurement, and is `None` whenever `kg` is absent; catalog `kg` does not scale with guest count. **If the demand numbers are garbage, a capacity-aware placer is worse than none** — it will confidently refuse feasible plans. Mitigation: record provenance per figure, and **never let an estimated demand block a placement — it may only rank alternatives.** Measure first: what fraction of a real 8-item menu has measured vs class-default demand?

### Phase 2 — Backward serial SGS with device choice; `share` + `reassign` only

No time shifting. Every stage still ends as late as precedence allows. The gain: the **device** is now chosen to avoid collisions instead of read from a stored preference. Add the `maxC`/fuel capability gate. Wire `pref('shareTolC')` and `pref('slotModel')` — knobs that shipped in v250 with no consumers.

> **Riskiest assumption:** that determinism survives. The panel re-renders on every keystroke of the serve input (**4996**). If the placer's output depends on object iteration order or on `Date.now()`, the user watches devices swap under their fingers. Enforce a total order on every candidate list; add a test that renders the same fixture 50 times and asserts byte-identical output.

### Phase 3 — Time shifting for provably-cold or in-place waits only. **No hold yet.**

Pull a chain earlier only where every resulting gap is refrigerated, or where the item simply stays on its (already-occupied) device. Make transfer lags real. Make preheat a per-device stage that *occupies* the device.

> **Riskiest assumption:** that pulling a chain earlier is neutral. **It is not** — an item that finishes early sits *somewhere*, and "somewhere" is both a resource and a food-safety state the model lacks. Ship this without an explicit representation of where the item waits and it will silently invent unrefrigerated ambient holds. **Gate: a chain may be pulled earlier only if every gap is assigned a holding state, and Phase 3 offers exactly two: `fridge` and `in-place-on-device`.**

### Phase 4 — Hot hold, with the full safety spine

Give the cooler real properties (capacity, preheated y/n). Build `dangerZoneMin`, `holdCapMin`, `holdable(category)`, and `safetyGate` per Phase 3a §3.5: ≥60 °C ambient throughout; collagen cuts only; ≤360 min hard cap; ≤ `pref('holdMaxH')×60` generated; cumulative 5-60 °C exposure ≤240 min; never poultry, fish, lean, or anything served medium-rare. Wire `pref('holdEnabled')` and `pref('holdMaxH')`. Extend the same gate to R5 (rest extension).

> **Riskiest assumption:** that a hot hold is *verifiable*. The floor assumes ≥60 °C ambient for the entire hold and **nothing measures a cooler's temperature.** The app would be asserting a safety condition it cannot observe. Either the hold move must budget a probe channel to it (`probeChannels()` exists at **226** and currently feeds one footer line), or the hold must be capped far below the theoretical 6 h, stated explicitly as the user's responsibility, and accompanied by a scheduled check-in task. **Do not ship a hold whose safety the plan silently assumes.**

### Phase 5 — LDS repair, the full move ladder, and `orchestrate()`/`applyMove()`

Per Phase 3a §3.1-3.2, plus the advisory fallback with a *computed* minimum serve-push (bisected, not guessed). Wire `pref('autonomy')`.

> **Riskiest assumption:** that users want an optimizer. A schedule that silently reorganizes itself is harder to trust than one that is wrong in a legible way. **Ship at `autonomy:'advise'`** (already the registered default at **6075**), present moves as proposals with a one-line deterministic reason and a single-level undo, and measure acceptance before ever defaulting to `propose`.

---

## 9. Blunt summary

1. There is no scheduler. There is a backward CPM relaxation (**5031-5036**) written twice (**7109-7116**), shipped as the answer.
2. Because every chain is anchored to the same instant, the design **guarantees** maximum collision rather than merely failing to avoid it.
3. Nothing in the codebase can move a stage in time. There is no storage key, no data structure, and no function that could represent such a move. `mk-item-shift-<scope>` was specified and never created.
4. `s.start = start` at **5034** means one schedule exists at a time. That alone forecloses every search algorithm.
5. The occupancy model is good and is wired backwards — as a verifier of a schedule nothing can revise.
6. The preference knobs for the solver shipped (**6075-6081**) with zero consumers. The UI for a decision surface exists; the decision does not.
7. `hooksOver` is computed at **376** and read nowhere. The hook dimension is modelled and thrown away.
8. The app recommends cook-early-and-hold in four places and cannot schedule it in any.
9. `occupancyCompat.setpoint = max(temps)` (**335**) is one solver away from silently changing an item's cook temperature and calling it a scheduling decision.

**The single most important structural change:** extract the backward walk out of the `buildList` render closure into a top-level pure `planSchedule()` that returns **placements as a separate structure keyed by stage id**, rather than mutating `start`/`end` onto the stage objects. Everything else in this document — capacity-aware device choice, any repair move, any search, any comparison of two candidate plans — is impossible until the app can hold more than one schedule in memory at a time.
