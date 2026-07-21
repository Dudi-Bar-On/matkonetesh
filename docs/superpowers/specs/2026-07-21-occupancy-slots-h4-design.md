# H4 · Per-slot occupancy (`slots[]`) — design spec

**Date:** 2026-07-21
**Status:** AWAITING OWNER APPROVAL — no code until approved.
**Basis:** `docs/analysis/2026-07-21-device-visualization.md` §3 (the model contract) + refactoring report §7 (Phase 1, item 7).
**Depends on:** H1 (unknown→null) ✅, H2 (sv max-not-sum) ✅, H3 (device-driven hang) ✅ — all shipped.

---

## 1. The problem H4 closes

Today `deviceOccupancy` reports one scalar per device: `usedCm2 / usableCm2`. That number can be **true and still wrong**:

> A 5-shelf cabinet is 6000 cm² (5100 usable). Four cuts total 2880 cm² → **"56%, green, room to spare."** But each shelf is only 1020 cm², and the brisket alone is **1320 cm²** — it fits on **no single shelf**. The gauge reports comfort for a load that cannot be physically arranged.

The fix is to stop measuring against the whole cabinet and start measuring against **slots that actually exist** — shelves, grill zones, a bath. Each item gets assigned to one slot; the occupancy becomes a set of per-slot claims; "doesn't fit any shelf" becomes something the model can *say*.

**This is the last piece of the honest model (Phase 1). It is spatial, not temporal — it does NOT schedule or move items in time (that is Phase 4).**

---

## 2. Scope decision (the one thing I need you to confirm)

The analysis doc designs a full visual redesign — drawn shelf stacks, a hook bay, grill-zone plan views, a sous-vide vessel, a time ribbon, ghosting, tap-to-reassign, an accessible list. **That is a large piece, and the report scopes it as Phase 2** ("the real device diagrams").

**H4 (this spec) is the MODEL + the honesty, not the drawing:**

- ✅ **In H4:** `deviceOccupancy` returns `slots[]` (the packer); each item carries its `slot`; the device flags per-slot over-capacity and items that fit nowhere; the occupancy view *states* per-slot reality in its **current** card format (a sentence + honest %), so the "56% but fits no shelf" lie is gone **now**.
- ⏭ **Deferred to Phase 2:** the actual shelf-stack / zone / vessel **graphics**, the ribbon, ghosting, tap targets, the ARIA list.

**My recommendation: do H4 as model+honesty now, Phase 2 for the graphics.** Reason: the graphics depend on the model, and shipping the honest *number* first fixes a wrong statement on screen without a 2-week view rewrite. If you'd rather fold the graphics into H4 as one bigger task, say so — that's your call.

---

## 3. The model contract (what `deviceOccupancy` starts returning)

```js
deviceOccupancy(devId, tMs, computed, scope) -> {
  …existing…,
  cap: { …existing…,
    slots:      5,                 // rack count | zone count | 1 for a bath
    slotKind:   'rack'|'zone'|'bath',
    perSlotCm2: 1020,              // usableCm2 / slots — null when areaCm2 unknown
    slotLabelHe:'מדפים', slotLabelEn:'racks',   // from EQUIP_CATS.capHe/capEn (fixes the "מדפים on a kettle" mislabel)
  },
  slots: [                         // ALWAYS cap.slots long; empty slots included
    { i:0, capCm2:1020, usedCm2:1320, over:true,  pct:129, items:[{key,name,cm2}] },
    { i:1, capCm2:1020, usedCm2: 960, over:false, pct:94,  items:[…] },
    …
  ],
  unplaced: [ {key,name,cm2} ],    // items that fit no single slot at this instant
  slotOver: true,                  // any slot over OR anything unplaced — the honest "over"
  items: [ { …existing…, slot: 1 } ],   // slot index, or null when unplaceable/unknown
}
```

**Grill** → `slotKind:'zone'`, `slots = cap.zones`, packed the same way (an item takes a zone-share of area). **Sous-vide** → `slotKind:'bath'`, one slot; the H2 volume logic (max-not-sum, no honest %) is unchanged — slots don't apply a per-area split to a bath.

`hooksOver` (H3) and the hung channel are unchanged — hung items never enter `slots[]`.

---

## 4. The packer (the heart of H4)

**Assign on arrival, never re-place** (analysis §3.2). Per-instant bin-packing would make tiles teleport as the scrubber moves; replaying the cook once chronologically is deterministic, scrub-stable, and *physically true* (you put meat on whichever shelf has room when you carry it out; you don't move it mid-cook).

```
packDevice(devId, computed, scope):
  events = every (item, start, end, cm2) whose stage resolves to this device (area mode only)
  sort by (start ASC, cm2 DESC, key ASC)          # total order, deterministic, no ties
  slots = array(cap.slots) of { freeCm2: perSlotCm2, items: [] }
  active = []                                       # items currently on the device
  for each item in event order:
     release from its slot everything in `active` whose end <= item.start
     place item on the LOWEST-index slot whose freeCm2 >= item.cm2
        else → unplaced
     active.push(item)
  freeze: each item has ONE slot for its whole life
  memoise per (devId, computedRev)                  # recomputed only when the plan changes
```

- **`cm2 === null` (unmeasured, from H1):** cannot be packed by area → goes to a dedicated "unknown size" bucket, NOT `unplaced` and NOT silently on a shelf. The slot % already carries the H1 floor semantics.
- **`perSlotCm2 === null` (areaCm2 unknown):** the packer does not assign slots at all — `item.slot = null`, and the view shows the item list without placement (analysis §2.8 case 3: draw the count, withhold the assignment).
- **Verified against live data** (analysis §3.2): brisket 1320→slot 0 (over), asado 600→slot 1, pastrami 600→slot 2, spareribs 360→slot 1 (600+360=960≤1020) — **asado + spareribs share shelf 2, side by side**, falling out of real data with no tuning.

---

## 5. The honest occupancy (H4's visible payoff, current card format)

The device's `over` becomes `slotOver` (any slot over, or anything unplaced) — not `usedCm2 > usableCm2`. The bar/warning then tells the truth:

- Brisket that fits no shelf → **⚠ warning** naming it: `בריסקט לא נכנס למדף בודד (1320 > 1020 לכל מדף)` — the sentence the 56% gauge could never say.
- A load that genuinely fits every shelf → no warning.
- The `≥`/floor and unknown-size logic from H1/H2 are preserved.

The full shelf **drawing** is Phase 2; H4 makes the **number and the warning** honest in the card that exists today.

---

## 6. Safety & non-goals

- **No scheduler/temporal changes.** The packer replays the existing timeline; it never moves an item in time or reassigns devices. Timeline optimization is Phase 4.
- **Never invent a measurement.** Unknown area → no slot assignment, no fabricated %. Unmeasured item → its own bucket, floor semantics.
- **One source of truth.** The packer lives in the model (`deviceOccupancy`), never the view — the plan's architecture rule. The view renders `slots[]`; it computes no placement.
- The packer must be **pure and deterministic** (memoised by plan revision) — same plan → identical assignment every render, so the scrubber never reshuffles.

---

## 7. Testing (acceptance)

1. **Packer determinism:** same `computed` → identical `slots[]`/`item.slot` across repeated calls.
2. **The headline case:** 5-shelf cabinet, brisket 1320 + three ~600 cuts → brisket `slot:0 over:true`, `slotOver:true`, and the view renders a "doesn't fit a single shelf" warning — NOT "56%, green".
3. **Side-by-side:** asado + spareribs land on the same slot (their combined cm² ≤ perSlotCm2); the model reports both in that slot's `items`.
4. **Grill zones:** a 2-zone grill packs into 2 slots labelled from `capHe` (`אזורי חום`), never "מדפים".
5. **Unknown area:** `areaCm2` unset → `item.slot === null`, no placement, no fabricated %.
6. **Unmeasured item:** `cm2 === null` → not placed on a shelf, not in `unplaced`; floor semantics intact (H1 still green).
7. **Regression:** H1/H2/H3 specs stay green; sous-vide (bath) still uses max-not-sum with no per-area %.
8. Hebrew + English; UI-verified at 390px; full suite green.

---

## 8. Definition of Done

- `deviceOccupancy` exposes `slots[]`, `unplaced[]`, `item.slot`, `cap.slots/slotKind/perSlotCm2/slotLabel`, `slotOver` — each with a real reader (the view), no orphaned field.
- The occupancy view states per-slot truth: an item that fits no shelf is warned about by name; a genuinely-fitting load is not.
- The packer is pure, deterministic, memoised; verified identical across renders.
- No temporal/scheduler behaviour changed. No measurement invented.
- Full suite green; H1/H2/H3 unbroken.
