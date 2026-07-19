# Equipment → Work-plan → Orchestrator — deep audit (2026-07-17)

**Question asked:** does the orchestrator use Equipment 2.0 correctly, and what more could be used — first
embedded in work-plan **tasks**, then exploited by the **orchestrator** — to reach *maximal sensible* use?

**Verdict:** equipment currently changes the plan's **words**, almost never its **schedule**. Four things
reach a task; everything else the app knows about your gear is trapped in recipe cards. The root cause is
architectural, not a set of missing features.

---

## 1. Root cause — equipment enters ~2,500 lines too late

`itemStages(meta, methodKey, ready, order)` (app.js:2190-2240) builds every stage — `{label, hours, kind,
temp?, note?}` — from the **recipe alone**. A grep for equipment/cooker/device across its entire body
returns nothing. Absolute times are then assigned by a pure walk-back (app.js:4643-4647), and equipment is
attached only at render time in `workPlanHtml` (app.js:4765) as a display string:

```js
cooker: cookerLabel(c.m.key, s.kind)      // a NAME, appended after durations are already fixed
```

**Consequence:** equipment can never change a stage's **duration**, **split** it, or **add** one. That is
exactly why the plan cannot adapt to your kit, and why "use more equipment properties" cannot be solved by
adding more labels.

## 2. What actually reaches a work-plan task today

| # | Reaches a task | Where | Effect |
|---|---|---|---|
| 1 | `preheatHint()` | 4787 (`sub`) | text only — **the 45-min schedule is hard-coded** |
| 2 | `cookerLabel()` | 4765 (`cooker`) | which device, as a label |
| 3 | `_svBatch` bath size | 4708-4714 (`sub`) | labels a batch decision already made |
| 4 | `contention` flag | 4765 | ⚠ marker |

Everything else that *is* gear-aware — `smokerTip` (270), `gearThermoNote` (316), `gearMissingHelp` (277),
`wcimGearOk` (6780), `gearCan` (131) — renders into **recipe/UI panels only**. The knowledge exists and
never reaches the plan.

## 3. Confirmed defects (evidence-backed)

| # | Defect | Evidence |
|---|---|---|
| D1 | **Preheat contradicts itself.** Schedule reserves a hard-coded 45 min; the label bakes in "45 דק׳"; the `sub` says "~15 min (pellet heats fast)". Same screen, two numbers, 30 min of dead plan. | 4655, 4673, 271-276 |
| D2 | **Only smoking gets a preheat at all.** `earliestSmoke` scans `kind==='smoke'` only — sous-vide and grill get no lead-time task. Heating a 24 L bath (~40 min) is invisible to the plan. | 4654-4655 |
| D3 | **Fuel is never reconciled.** The smoke task's detail reads the *recipe's* `wood`/`coal`. A pellet or electric smoker owner is told "🪵 Wood: oak · charcoal: lump". `d.fuel` is read only inside the equipment form. | 4753-4756, 5377/5395 |
| D4 | **Reload reminder is fixed.** "↻ add wood every ~90 min" fires for any smoke stage > 2.5 h — identical for an offset (needs ~45 min) and a pellet (needs none). | 4878 |
| D5 | **All capacity is decorative.** No path compares anything against `racks`/`zones`/`volume`/`baths`/`area` to decide whether two items fit. Contention = device-id + time overlap only. | 84-89 |
| D6 | **More equipment makes detection *worse*.** `cookerFor` returns `null` when 2+ devices qualify, and contention **silently skips unresolved items** — buying a second smoker can make clashes vanish instead of resolve. | 66-71, 79 |
| D7 | **Scale resolution unused in dosing.** `cap.res` (1g / 0.1g) is captured but never read by the cure/salt calculator. Cure #1 at ~2.5 g weighed on a 1 g scale is a ±40 % error — a safety-relevant number. | 5089, 1118-1158 |
| D8 | **Nozzles fully orphaned** though the data supports matching: casings are `K22`/`K32`/`K36` (22/32/36 mm) across 34 recipes; your stuffer reported nozzles [16, 22, 32, 38]. | sausages_new.py:26, 5372 |
| D9 | **Edge vs chamber vacuum never checked.** An edge sealer cannot seal liquids; nothing warns before a wet brine / liquid sous-vide step. | 39, 235/642 |
| D10 | **Probe channels are a display count.** `probeChannels()` feeds one footer line; nothing checks whether enough channels exist for the items needing monitoring. | 54, 5204 |
| D11 | **No cooler / cambro exists in the model** — yet the live advisor repeatedly proposes "hold in a cooler (faux cambro)" and **Phase 3's whole cook-early-and-hold strategy depends on holding gear.** | 4403/4410/4414, EQUIP_CATS:34-44 |

## 4. The maximal-use matrix

**Layer 1 = embed in the task** (changes duration / splits / adds stages / conditions instructions).
**Layer 2 = orchestrator optimization** over those enriched tasks.

### Smoker
| Property | Layer 1 — task | Layer 2 — orchestration |
|---|---|---|
| `type` | preheat **duration** (not just text); fire-management stages: offset → "add a split" every ~45 min, kamado → single load, pellet → hopper check, electric → none | thermal-recovery penalty after door-opens → batch openings; type sets temp stability class |
| `fuel` | reconcile with recipe: "add 2 oak chunks" vs "fill hopper with oak pellets" vs "electric — no wood" | wood-swap feasibility; sharing requires compatible fuel |
| `cap.racks` | "rack 2 of 5 (upper)" placement | **fit test** — the slot budget |
| `cap.area` | — | better packing than rack *count* for mixed sizes |

### Grill
| Property | Layer 1 | Layer 2 |
|---|---|---|
| `type` | preheat duration (gas ~10, charcoal chimney ~25-30, kamado ~20); plancha oil/preheat; infrared = sear only | lighting lead time |
| `cap.zones` | two-zone setup task | **zones are genuinely parallel slots** — direct + indirect run at once; today any overlap is a false clash |

### Sous-vide
| Property | Layer 1 | Layer 2 |
|---|---|---|
| `cap.baths[]` | **bath preheat stage** sized by volume (12 L ~20 min, 24 L ~40 min) — missing entirely today | **volume-gated batching**: items must physically fit (displacement), not just match temp |
| device count vs baths | — | **one circulator = one temp at a time**, even with two baths. The model cannot express this today |
| `type` | lid/insulation task for long cooks | — |

### Probe
| Property | Layer 1 | Layer 2 |
|---|---|---|
| `cap.channels` | "probe A and B; spot-check C with the instant-read" | **channel budget** — concurrently monitored items ≤ channels |
| `type` | instant-read → discrete spot-check tasks; leave-in → continuous; **controller-fan → removes vent-tending tasks entirely** | set-and-forget lowers attention cost, enabling tighter overlap |

### Stuffer / Grinder (charcuterie)
| Property | Layer 1 | Layer 2 |
|---|---|---|
| `cap.volume` (L) | **cylinder loads = farce ÷ capacity** → 8 kg in a 5 L stuffer generates 2 refill tasks | stuffing duration estimate |
| `cap.nozzles[]` | "use the 32 mm nozzle" matched to the recipe's `K32` casing; warn when no nozzle matches | — |
| grinder `type` | dedicated vs mixer-attachment → batch size, passes, chill-between-passes | — |

### Vacuum
| `type` | **edge → "freeze the marinade first"** before a liquid seal; chamber → seal liquids directly | chamber is faster for batches |

### Accessories (18 captured, ~1 used)
| Item | Layer 1 | Layer 2 |
|---|---|---|
| `scale.res` | **cure-dosing precision guard** — warn when the dose is too small for a 1 g scale; suggest scaling the batch | safety gate |
| `curechamber.kind` | dry-cure feasibility + achievable RH → drying plan | project scheduling |
| `humidity`, `hooks` | RH-control tasks; hang vs lay | — |
| `chimney` | charcoal lighting duration; absence changes the lighting method | feeds preheat lead time |
| `blower` | faster recovery / fire control | shortens recovery penalty |
| `injector`, `slicer` | injection task; slicing task (pastrami/bacon) | prep-time budget |
| `paper` / `foil` | **wrap material at the stall conditioned on what you own** (today: generic text naming both) | — |
| `spritz`, `drippan` | spritz schedule; water-pan setup | — |
| `torch` | sear-finish task (today only alt-text in a card) | alternative to a grill slot |

## 5. What must exist to enable this

1. **Stages must be equipment-aware at creation.** `itemStages` needs the resolved device (or a device
   context) so it can set durations, split stages, and emit gear-specific stages. This is the one
   structural change everything else depends on.
2. **A device→task annotator.** The natural seam is the precompute block at 4701-4714 (where `_ckMap`,
   `_clashes`, `_svBatch` already live) plus the per-kind branches at 4740-4767.
3. **A holding-gear category** (cooler / cambro / warming drawer) — Phase 3's hold strategy is unbacked
   without it.
4. **An item-weight source.** Capacity budgeting needs per-item weight; cuts carry no weight field and
   `eventQty` (3649) only covers sides/desserts/drinks. **This input must be resolved before slot/area
   budgeting can work** — likely guests × per-person grams, or an explicit per-item quantity.

## 6. Consequences for the Phase 3a spec

- §3.4's rack-slot budget is right but **blocked on item weight** (point 4 above).
- The spec assumes hold is possible; **add the holding-gear category** or the `hold` move is unbackable (D11).
- **Add to §3:** probe-channel budgeting, volume-gated SV batching, zones-as-parallel-slots, and the
  one-circulator-one-temp constraint.
- **Add to §5 (safety):** scale-resolution dosing guard (D7) — it belongs with the safety floors.
- **Fix D6 first** — ambiguous items must stay in contention, otherwise the solver never sees the clashes
  it exists to resolve.
- D1-D4 are cheap task-embedding wins that need no solver and could ship inside Slice 1½.

---

## 7. Addendum — hanging vs. grate occupancy (owner, 2026-07-17)

Occupancy has **two modes**, not one. §4's footprint model assumes an item *lies on a grate*. When smoking
by **hanging** (hooks / hanging bars — common for sausages, salami, ribs, biltong, whole birds, bacon
slabs, and most dry-curing), the binding constraint is completely different:

| | grate mode | hang mode |
|---|---|---|
| capacity unit | grate **area** (cm²) | **hook / rod positions** (count), or linear rod space (cm) |
| item consumes | `footprint_cm2` | one hook (or N cm of rod) + its hanging **length** |
| device limit | `cap.area` / per-shelf area | number of hooks + chamber **height** (vertical clearance) |
| fails when | area exceeded | no free hook, or the item is longer than the chamber is tall |

Consequences for the consumption layer:
- An item needs a `hang` capability flag plus, when hanging, `hang_len_cm` (drop length) and `hooks: 1`.
- A cut hung instead of laid **frees its grate area entirely** — hanging is itself an optimization move
  ("hang the ribs to free a shelf for the brisket").
- The `hooks` accessory (already in `EQUIP_OTHER_ITEMS`) becomes a real capacity input, not decoration.
- The device side needs a vertical-clearance figure for cabinet smokers / cure chambers; `cap.area` alone
  cannot express hang capacity.
- Dry-curing (`curechamber`) is almost always hang mode — its capacity was never modelled at all.
