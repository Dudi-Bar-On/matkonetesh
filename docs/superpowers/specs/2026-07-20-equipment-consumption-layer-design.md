# Equipment Consumption Layer — Design Spec

**Date:** 2026-07-20
**Status:** Awaiting owner approval
**Depends on:** the per-recipe `equip` layer (v250 + fixes, `equipment_map.py`) · `docs/equipment-orchestration-audit-2026-07-17.md`

---

## 1. Context & goal

The audit's root finding: `itemStages()` (app.js:2190) builds every stage from the **recipe alone**, and
equipment is attached ~2,500 lines later in `workPlanHtml` as a *display label*. So equipment can never
change a stage's **duration**, **split** it, or **add** one — which is why the plan cannot adapt to the
user's kit no matter how many properties we capture.

Recipes now declare what they need (`recipe.equip`), and devices declare what they have (`cap.*`). This
spec builds the layer that **joins them into the work plan itself** — the "embed in tasks first" half of
the owner's ordering. Orchestrator optimization (Phase 3 Slices 2-3) then reasons over enriched tasks
rather than over labels.

### Goals
1. One pure, testable seam where equipment enters stage generation.
2. Fix the four confirmed gear-blind defects (D1-D4) — preheat, fuel, refuel cadence.
3. Embed charcuterie equipment in tasks (cylinder loads, nozzle, scale precision, grind).
4. Model occupancy in **both modes** — grate area and **hanging** — plus probe-channel and SV-volume
   budgeting, which is what the orchestrator will consume.

### Non-goals
- No orchestrator/solver changes. This layer only *enriches* stages; nothing re-assigns or re-schedules.
- No new equipment UI. Devices and their properties are already captured.

---

## 2. The seam

```js
// PURE. (meta, methodKey, stages, scope) -> enriched stages. No DOM, no storage writes.
function equipPlan(meta, methodKey, stages, scope){
  if(!equipConfigured()) return stages;      // nothing configured -> unchanged behavior, always
  ...
}
```

**Both call sites, deliberately.** `itemStages` is called at app.js:4641 (`buildList`, the main plan) and
app.js:6539 (`combinedEventsRows`, the multi-event view). Enrichment applies at **both**: a preheat is real
time, so an item's `totalH` in the multi-event view must include it or the two views disagree about when to
start. The multi-event tests must be re-run to confirm the new totals render correctly.

**Why a post-processor rather than parameters on `itemStages`:** it keeps `itemStages` pure and
recipe-only (it is the safety-critical stage generator), makes the whole layer independently testable, and
lets the no-equipment path return the input untouched — which is how "defaults change nothing" stays true.

### What a stage gains

Stages keep their existing fields (`label, hours, kind, temp?, note?`) and may gain:

```js
{
  gear: {
    dev:   'eq-123',                    // the resolved device, if any
    do:    'הוסף 2 בולי אלון',          // gear-specific INSTRUCTION for this stage
    warn:  'משקל 1 ג׳ — מנה קטנה מדי',   // a caveat the user must see
    occupy:{mode:'grate', cm2:1320}     // or {mode:'hang', hooks:1, len_cm:45}
  }
}
```

`workPlanHtml` renders `gear.do` into the task's `sub` and `gear.warn` with the existing `.ai-caveat`
treatment, at the per-kind branches (app.js:4740-4767). **No new CSS.**

---

## 3. Slice A — cooker correctness (fixes D1-D4)

### A1 · Preheat becomes a real, device-driven stage (D1, D2)
Today: a hard-coded 45 min (app.js:4655) for smoking only, with a label that bakes in "45 דק׳" while the
sub-line says "~15 min" — a self-contradiction. And sous-vide and grill get no lead time at all.

```js
function preheatMin(dev, cat){
  if(cat==='sousvide') return Math.round(10 + 1.2*bathLitres(dev));   // 12L ~24m · 24L ~39m
  const t = dev && dev.type;
  if(cat==='grill')  return t==='גז' ? 10 : (hasGear('chimney') ? 25 : 35);
  return ({'פלטים':15,'גז (עם תיבת עשן)':12,'חשמלי':25,'ארון / קבינט':25,
           'קמאדו / קרמי':20,'WSM / חבית':40,'קטל (ככלי עישון)':30,
           'אופסט / סטיק-ברנר':45})[t] || 45;
}
```
- Emitted as a real stage per cooker actually used (smoke **and** sv **and** grill), so the walk-back
  schedules it correctly and the label carries the true figure.
- Charcoal without a `chimney` costs +10 min — the accessory finally does something.

**`bathLitres(dev)` — which bath?** You heat the bath you will actually use: the **smallest configured bath
that is ≥ the item's `spec.min_bath_l`**; if none qualifies, the largest configured; if the device records
no bath sizes, assume 12 L. (This is the same bath the existing `_svBatch` advisory names, so the preheat
and the "use the N L bath" text cannot disagree.)

### A2 · Fuel reconciled with the device (D3)
Today the smoke task prints the *recipe's* `wood`/`coal`, so a pellet or electric owner is told
"🪵 Wood: oak · charcoal: lump".

| `dev.fuel` | `gear.do` |
|---|---|
| charcoal / wood | "הוסף 2 בולי {wood} על הגחלים" |
| pellet | "מלא את המכל בפלטי {wood}" |
| gas | "שים שבבי {wood} בתיבת העשן" |
| electric | "שבבי {wood} במגש — אין פחם" |

### A3 · Refuel cadence by device type (D4)
Today: a fixed "↻ add wood every ~90 min" for any smoke stage > 2.5 h (app.js:4878).

| type | cadence |
|---|---|
| אופסט / סטיק-ברנר | every 45 min — add a split |
| WSM / חבית · קטל | every 90 min (minion) |
| קמאדו / קרמי | none — one load |
| פלטים | hopper check every 4 h |
| חשמלי | none (chips only) |
| גז (עם תיבת עשן) | chips every 60 min |

A `blower` shortens recovery; a `controller-fan` probe type (`בקר-מאוורר`) suppresses vent-tending
entirely.

---

## 4. Slice B — charcuterie in the tasks

| Input | Task effect |
|---|---|
| `cap.volume` (stuffer L) + batch kg | **cylinder loads = ceil(kg / volume)** → the stuffing task states "2 מילויים" and its duration scales. **Batch weight source:** the planned quantity for this item in the event menu when present; otherwise the split is SKIPPED (the task still names the nozzle). Sausage recipes are dosed per-kg and carry no batch size of their own, so inventing one would be a fabricated number. |
| `spec.casing_mm` + `cap.nozzles` | pick the largest nozzle ≤ casing bore → "השתמש בפייה 32 מ״מ"; **warn** when no nozzle fits |
| `spec.scale_res` + `cap.res` | **safety warn**: a cure dose under ~5 g on a 1 g scale is a ±20-40 % error → advise scaling the batch or borrowing a 0.1 g scale |
| `spec.grind_mm` + grinder type | mixer-attachment → smaller batches + a chill-between-passes step |
| vacuum `type` | **edge sealer + a liquid step → "freeze the marinade first"**; chamber → seal directly |

---

## 5. Slice C — occupancy, monitoring, capacity (feeds the orchestrator)

### C1 · Two occupancy modes
Per the owner: smoking is often done by **hanging**, where the constraint is completely different.

| | grate | hang |
|---|---|---|
| item consumes | `spec.footprint_cm2` | 1 hook + `hang_len_cm` |
| device limit | `cap.area` (per shelf) | hook count + vertical clearance |
| unlocks | — | **hanging frees grate area entirely** — an optimization move in its own right |

`equipPlan` chooses the mode: hang when the recipe hangs (sausages, salami, ribs, biltong, whole birds,
all dry-curing) **and** the user owns `hooks`; else grate. Emitted as `gear.occupy`.
Dry-curing (`curechamber`) is hang-only — its capacity is unmodelled today.

**New data:** `equipment_map.py` derives a `hang` capability from the recipe (hanging already appears in
phase text — "תלה", "ווים", "תלייה") — a data change, not a UI one.

**Length is a CLASS, not a measurement.** We have no real dimensions and must not invent centimetres, so a
hung item declares `hang: 'short' | 'long'` (a link/coil vs a full salami/rib rack/whole bird) and consumes
**one hook**. Vertical clearance is checked only as a coarse gate: `long` items require a device the user
has marked as tall enough. If clearance is unknown, hanging is allowed and no warning is shown — never
block a plan on a figure we don't have.

### C2 · Probe channels
`probeChannels()` currently feeds one footer line. Items whose stages include a `bcheck` need monitoring;
when concurrent monitored items exceed channels, the plan says which get a leave-in probe and which are
spot-checked with the instant-read.

### C3 · Sous-vide volume
Batching today matches temp + time only. Add: items must physically **fit** the chosen bath
(`spec.min_bath_l`, displacement), and **one circulator = one temperature at a time** even with two baths —
a constraint the model cannot currently express.

---

## 6. Safety

- `equipPlan` may **never** alter a `bcheck` stage, a `temp`, or any safety number. It adds instructions,
  warnings, and non-safety stages (preheat/refuel/loads) only. Enforced by a test that diffs every
  safety-bearing field before/after.
- The scale-resolution warning (B) is advisory and additive; it never changes a computed dose.
- No AI involvement anywhere in this layer — it is fully deterministic.

---

## 7. Testing

1. **No-op gate:** with `mk-equip-set` unset, `equipPlan` returns the input array unchanged (identity) for
   every recipe in the catalog.
2. **Safety invariance:** for every recipe × method, no `bcheck` stage, `temp`, or `safe` value differs
   before/after enrichment.
3. **Preheat:** a pellet smoker yields 15 min and an offset 45 min for the same recipe; the label and the
   scheduled duration agree (the D1 contradiction cannot recur); sous-vide and grill each get a preheat.
4. **Fuel:** a pellet device never renders charcoal/chunk wording; electric never renders charcoal.
5. **Charcuterie:** 8 kg farce with a 5 L stuffer → 2 loads; a 32 mm casing with nozzles [16,22,32,38]
   picks 32; nozzles [16,22] on a 32 mm casing warns.
6. **Scale:** a 2.5 g cure dose with `cap.res='1g'` warns; with `'0.1g'` it does not.
7. **Occupancy:** a hung item reports `{mode:'hang'}` and consumes no grate area; the same item without
   `hooks` falls back to grate with its `footprint_cm2`.
8. Hebrew **and** English; full suite green ×2 before each ship.

---

## 8. Definition of Done

- With no equipment configured, the plan is byte-identical to today (test 1 is the gate).
- The preheat contradiction (D1) cannot recur — one source of truth for the figure.
- A pellet owner is never told to add charcoal (D3).
- Every `gear.do` / `gear.warn` renders in both languages with no English leaking into Hebrew.
- No safety number is ever altered by this layer (test 2).

## 9. Build order

| slice | contents | ships |
|---|---|---|
| **A** | `equipPlan` seam + preheat (D1,D2) + fuel (D3) + refuel cadence (D4) | v251 |
| **B** | charcuterie: cylinder loads, nozzle, scale precision, grind, vacuum-liquid | v252 |
| **C** | occupancy (grate + **hang**), probe channels, SV volume — the orchestrator's inputs | v253 |

Phase 3 Slices 2-3 (the solver) then consume Slice C instead of the decorative capacity it would have had.
