# Refactoring Report — Equipment, Occupancy & Orchestration

**Date:** 2026-07-21
**Trigger:** owner assessment — *"the orchestration optimization is very poor… it is far away from reliable and correct… far from the well defined requirements We wrote."*
**Inputs:** five expert analyses in this directory. Every claim below was independently re-verified by the controller against the code; where an expert overstated something, that is noted.

---

## 1. The diagnosis in one sentence

**The app captures equipment data faithfully and acts on almost none of it.**

Three layers were specified. Only the first is real:

| Layer | Purpose | State |
|---|---|---|
| **Capture** | devices, properties, per-recipe requirements | **78–90% delivered.** 279 recipes carry `equip`; devices carry real, unit-handled properties |
| **Detect** | know when a plan is physically impossible | **Partial, and currently dishonest** — it reports numbers that can be arithmetically true and practically false |
| **Act** | let equipment change what the plan *says* and *when things happen* | **~0% delivered.** The seam was never built |

Overall conformance ≈ 52%, but the average conceals the shape: documents about *capturing* equipment are 78–90% done; the three about *using* it (Phase 3a solver, plan-depth model, consumption layer) are ~20%.

**Root cause, stated plainly:** the consumption layer's central mechanism — `equipPlan`, the one seam where equipment enters stage generation — has **zero occurrences in the codebase**. It was formally waived in `plans/2026-07-20-equipment-occupancy-layer.md:1220`. Without it, no equipment fact can change a duration or a time, by construction. Everything downstream follows from that one decision.

---

## 2. Safety findings (fix before anything else)

### S1 · Cure dosing has no scale guard — SPECIFIED, DATA SHIPPED, CONSUMER NEVER WRITTEN
`scale_res` is present on **67 recipes** in `dist/index.html`. `grep -c scale_res app.js` = **0**.

A 2.5 g cure dose weighed on a 1 g scale is a **±40% nitrite error**, unwarned. This is the only number in the app where being wrong has consequences beyond a ruined cook. Escalated in two documents (`equipment-property-audit`, consumption-layer spec §4), never wired.

### S2 · `setpoint` is one consumer away from becoming unsafe
`occupancyCompat.setpoint = Math.max(temps)` (`app.js:335`). Harmless as advisory text today. If a future scheduler ever *acts* on it, it silently raises a cut's cook temperature by up to `shareTolC` (max 15 °C) and calls it optimisation. Must be fenced explicitly before any solver exists.

### S3 · Owning more equipment reduces safety awareness (residual D6)
`cookerFor` returns `null` for two devices of the same class. Both `cookerContention` (`app.js:260`) and `deviceOccupancy` (`app.js:355`) then silently skip the item. **A second smoker makes cuts invisible to the clash detector.** The v252 fix covered only smoker-vs-grill.

---

## 3. The detect layer is currently dishonest

All four are controller-verified in `app.js`:

| # | Defect | Consequence |
|---|---|---|
| **H1** | `cm2: Number(spec.footprint_cm2) \|\| 0` (`itemOccupancy`) | An unmeasured cut contributes **0 cm²** and vanishes from capacity, while the device still reports `known:true`. "33% full" with uncounted meat on the shelf. Treating unknown as zero *is* inventing a measurement |
| **H2** | `litres: Number(spec.min_bath_l)`, then **summed** | `min_bath_l` is the bath size an item *requires*, not the volume it *displaces*. Two cuts each needing 24 L report 48 L used of 24 L. Observed live: a **500% over-capacity warning** for a load that fits one bath |
| **H3** | Hanging gated on `equipOwnsToken('hooks')` | `hooks` resolves to an **accessory**, so a cabinet declaring `canHang:true, hooks:8` does not satisfy it. Combined with `hooksOver` (`app.js:376`) being **read by nothing**, the hanging channel is inert from both ends |
| **H4** | Percentage measured against the whole device | A 1320 cm² brisket "fits" at 56% of a 5100 cm² cabinet while fitting on **no single shelf** of it. Arithmetically true, practically the opposite of the truth |

**Why the tests did not catch H3:** the Task 6 fixture seeded *both* a smoker with hooks *and* a separate hooks accessory, supplying exactly the thing the bug needed. The test asserted a computed field rather than an observable behaviour. Both are process failures, not luck.

---

## 4. The visualization does not meet the stated requirement

Requirement (owner's words): *"a graphical representation of a shared device setup that shows what cut is mounted where at a specific time."*

Delivered: a flat card, a percentage bar, and a row of chips — **pixel-identical** for a 5-rack cabinet, a 2-zone kettle and a 12 L bath (verified live at 390px).

- Never shows *which* shelf anything is on → the core ask is unmet
- Hanging is not visually distinct from grate-mounted
- Grill heat **zones are aliased into a field called `racks`** (`app.js:301`) and labelled **"מדפים" / "shelves"** (`app.js:401`) for every category — a factual mislabel, live-verified as "1 מדפים" on a grill that My Equipment correctly calls "2 אזורי חום"
- The controller's own `min-width:104px` fix destroyed the proportionality it was meant to protect (a 3.7:1 footprint ratio renders ~1:1) and **test W5 now enforces that state**
- `linear-gradient(90deg)` runs backwards under `dir=rtl`; `transition` is dead because `_occWire` re-writes `innerHTML` per scrub frame

---

## 5. Hebrew quality

- **תנור misused as the generic term** for every cooker, colliding with the app's own oven category (`EQUIP_CATS` `{cat:'oven', he:'תנור'}`). 6 literals across 8 sites. **Fix: מכשיר / מכשירים** — already the app's own word at `app.js:5698`, and the owner's own word in the bug report. English stays "Cooker" (idiomatic, matches ~15 internal identifiers)
- **Singular/plural on interpolated counts** broken at 4 sites. `app.js:5702` gets a probe count right and a channel count wrong *on the same line* — a missing shared helper, not a knowledge gap. Note `app.js:5698` already does it correctly: the pattern existed and the new code ignored it
- `שיוך תנור/מעשנה:` (`app.js:5203`) offers "oven" as if it were a selectable option; `cookerCandidates()` never returns one

---

## 6. Why the plan collides with itself (the fourth complaint)

**The entire scheduler is six lines** (`app.js:5031-5036`):

```js
let end=serve;
for(let i=stages.length-1;i>=0;i--){
  const s=stages[i]; const start=new Date(end.getTime()-s.hours*3600e3);
  s.start=start; s.end=end; end=start;
}
```

`start = serve − Σhours`, per item, **no device term, no capacity term**. Duplicated in `combinedEventsRows` (`app.js:7109`).

Collisions are therefore not occasional — they are **manufactured deterministically**: every chain is anchored to the same instant and the tail stages are short, so every cook converges on the same window by construction.

Every call to `deviceOccupancy` is either *rendering* or *detecting*. **Not one influences placement.** What shipped is a detector bolted onto a scheduler that cannot act on it. `orchestrate`, `movesForClash`, `applyMove`, `safetyGate` — all **0 occurrences**.

Correct formulation: deadline-anchored **multi-mode resource-constrained project scheduling** with multi-dimensional cumulative resources (grate area, hook count, bath volume), machine assignment, and **incompatible batching families** (a pit is a batching machine keyed by temperature + wood). Not job-shop, not plain bin-packing.

**The blocking structural problem:** the walk lives inside a render closure and mutates `start`/`end` onto stage objects. Until placement is a *separate value*, the app cannot hold two candidate schedules at once — so no search, no repair, no capacity-aware placement is possible at all.

### Consequences visible to the user today
- **D1** — preheat hardcoded to 45 min (`app.js:5043`) with "45 דק׳" baked into the label, while `preheatHint()` (`658-661`) already knows a cabinet needs ~20–30 and a pellet ~15. **The app knows the right answer and schedules the wrong one, then displays both.**
- **D3** — the fuel line reads the recipe's `wood`/`coal` (`app.js:5144`), never `dev.fuel`. A pellet or electric owner is told to add charcoal. *This is the moment trust breaks.*
- Hung vs. laid ribs (3.5 h vs 5 h) show one number. Pellet and offset owners get identical schedules.
- Cook-early-and-hold is recommended in four places and schedulable in none.

---

## 7. The plan

Sequenced so each phase makes the next honest. **Do not reorder** — building the view before the model is honest, or the solver before the seam exists, repeats exactly the mistake that produced this report.

### Phase 0 — Safety (do first, small)
1. **S1** wire the `scale_res` cure-dosing guard — data already ships; write the consumer + warning
2. **S2** fence `setpoint` as advisory-only with an explicit comment and a test asserting no caller mutates a stage `temp`
3. **S3** fix residual D6 — an unresolved device must never make an item invisible; surface "needs a pick" instead of silence

### Phase 1 — Make the detect layer honest
4. **H1** unknown footprint → `known:false`, never `0`
5. **H2** separate *requirement* (`max(min_bath_l)`) from *consumption* (displacement); stop summing minimums
6. **H3** hanging reads the device's own `canHang`/`hooks`; wire `hooksOver` to a real warning; delete the fixture that masked it
7. **H4 + slots** — `deviceOccupancy` returns `slots[]` assigning each item to a specific shelf/zone/bath via a chronological arrival-order packer (assign once, never re-place: deterministic and scrub-stable). This makes the percentage a claim about slots that exist
8. Terminology: תנור → מכשיר/מכשירים; a shared plural helper; stop aliasing `zones` into `racks`

### Phase 2 — The device diagrams (depends on 7)
9. Draw the container, then place items in it: cabinet = N drawn shelves (empty ones shown), grill = side-by-side zones, bath = vessel with submerged bags
10. Hanging renders as suspended, visibly freeing grate area
11. Honesty ladder: solid = measured, dotted = present-but-unmeasured, empty = free. Shelf *count* may be drawn without area; shelf *assignment* may not
12. Fix the RTL gradient; stop re-writing `innerHTML` per scrub frame; retire/replace test W5 so it stops enforcing the broken layout

### Phase 3 — Build the seam that was waived (`equipPlan`)
13. `equipPlan(meta, methodKey, stages, scope) → enriched stages`, pure, no-op when no kit is configured
14. **D1** one source of truth for preheat — `preheatHint()`'s device knowledge drives the scheduled stage and its label
15. **D3** fuel instruction from `dev.fuel`, not the recipe
16. **D4** refuel cadence per device type
17. Hung vs. laid durations diverge where the data supports it

### Phase 4 — The scheduler refactor (the fourth complaint)
18. **Extract `planSchedule()`** out of the render closure into a top-level pure function returning placements keyed by stage id — the prerequisite for everything after
19. Stage data model gains earliest-start / latest-finish / shiftable / interruptible
20. Backward serial schedule-generation with priority = least-slack → largest-demand → fewest-devices → stable key; per-device feasible-window sweep
21. A repair ladder (share → hang → re-assign device → shift a shiftable stage → hold in cooler → advise), with **limited-discrepancy search** under a time guard
22. **Lexicographic objective — never a weighted sum.** A weighted sum permits trading safety for convenience. **No move may shorten a cook, alter a `temp`, or touch a `bcheck`.**

### Phase 5 — Remaining specified work
23. Consumption-layer Slice B (charcuterie: cylinder loads, nozzle selection, grind, vacuum-liquid)
24. C2 probe channels; the plan-depth model (49 requirements, never planned, includes two safety commitments)

---

## 8. Process changes (so this does not recur)

1. **A derived field with no consumer is not done.** `hooksOver` and `scale_res` both shipped as computed-and-unread. A build gate should fail when a derived field has no reader.
2. **Test behaviour, not computed fields.** Both inert features had passing tests that asserted a value rather than an observable effect.
3. **Fixtures must not supply what the bug needs.** The Task 6 fixture seeded the accessory that the broken gate required.
4. **Look at the screen.** Two defects (clipped chips, view opening on an empty instant) were invisible to a green suite and obvious in one screenshot at 390px.
5. **A waiver is a decision that needs the owner.** Waiving `equipPlan` was recorded in a plan file and never surfaced in conversation; it is the single decision this whole report traces back to.

---

## 9. Walkthrough defects (independent of the equipment work)

Hands-on Playwright pass at 390px, Hebrew. Full register + 57 screenshots:
`2026-07-21-walkthrough-defects.md` / `shots/`. **2 Critical · 4 Major · 3 Minor.**
Controller-verified items marked ✔.

### C1 ✔ · Two screens disagree about how much meat to buy
Same event, 8 guests, one brisket:

| Screen | Shows |
|---|---|
| 🛒 Shopping cart | **~5.5 ק״ג** — the catalog's whole-cut weight |
| 🖨️ Print menu | **~3.7 ק״ג נא** — correctly 8 × 280 g ÷ yield |

**The cart ignores guest count entirely** — and the cart is the screen you shop from. The disagreement scales with party size (the QA pass measured 2.7× at a smaller count). No warning anywhere. This is independent of all equipment work and arguably the most user-damaging defect in the app.

### C2 · Auto cooker-assignment produces a physically impossible plan
Two items are both assigned to the sous-vide bath (100% + 100%) while the owned grill sits idle at the same timestamp. Root cause is M1 below.

### M1 · Grill cuts default to an all-day sous-vide + smoke plan
Picanha and kebab default to `sv+smoke` even though the app's own home screen files them under Grill. Wrong default method → wrong device → C2.

### M2 ✔ · Equipment form silently discards values that fail validation
`app.js:5823` — `const r=propParse(p, raw); if(r) d.cap[p.key]=r.v; else delete d.cap[p.key];`
Also `app.js:5809` for the capacity field. A rejected value is **deleted with no message**: the user types heat-zones or cooking-area on a charcoal grill, saves, reopens, and it is gone. Silent data loss with no feedback, in the exact flow this whole equipment arc depends on for correct capacity figures.

### M3 · Wizard category filter chips cannot be deselected
Tapping an active chip (e.g. "Pork") does not clear it despite toggle-button ARIA semantics — traps the picker in a false "no items found" state.

### Where these land in the plan
- **C1, M2** → Phase 0 (C1 is a correctness bug that costs the owner money; M2 silently corrupts the capacity data every later phase depends on)
- **M1, C2** → Phase 1 (default-method selection belongs with making device resolution honest)
- **M3** and the Minors → Phase 2 alongside the UI work
