# Phase 2 · Device-occupancy diagrams — design spec

**Date:** 2026-07-21
**Status:** APPROVED (owner approved the interactive mockup 2026-07-21; §10.9 satisfied — graphics may be implemented).
**Basis:** `docs/analysis/2026-07-21-device-visualization.md` (the original design) refined by the approved mockup (`scratchpad/occupancy-mockup.html`, artifact rev3) and the owner's mockup-review decisions.
**Depends on:** H1–H4 (the honest occupancy model) — all shipped and green. Phase 2 is a **view** rewrite over that model, plus three small model additions.

---

## 1. What Phase 2 is (and is not)

**Is:** replace the current occupancy card — a flat `%` bar + a wrapped row of item chips (`occupancyDevHtml`, app.js:466) — with a **device-shaped diagram per cooker**: a cabinet as a shelf stack, an offset smoker as a barrel + firebox, a grill as a top-view of heat zones (round for a kettle), a sous-vide as a vessel, hanging as its own bay. The approved mockup is the pixel target.

**Is not:** any change to the schedule, the packer, or how items resolve to devices. The model (`deviceOccupancy`) already computes `slots[]`, `unplaced[]`, `item.slot`, `cap.*`, `compat`. The view renders that object and computes **no** placement of its own (the plan's one-source-of-truth rule). Timeline optimization is Phase 4.

**The whole diagram is a rendering of `deviceOccupancy()`.** A diagram and a warning can never disagree because both read the same object — this invariant is preserved, not weakened.

---

## 2. The honesty rule the diagram must encode (owner decision)

The mockup made one promise the owner explicitly accepted: **the picture never lies, and never over-claims failure.**

Three fill states, one legend, no fourth:

| State | Meaning | Drawing |
|---|---|---|
| **solid** | measured (a real footprint) | filled tile, sized to its area share |
| **dashed** | exists but unmeasured (`cm2 === null`, H1) | dashed tile, **never numbered**, never on a shelf |
| **empty** | free | drawn empty ("מדף פנוי"), never hidden |

And the **fit verdict ladder** (owner's accuracy model — "user's area wins; hard 'won't fit' only for the owner's numbers or a large overflow; estimates say 'might be tight'"):

- **✓ green** — everything fits its slot.
- **◐ orange "ייתכן צפוף — השטח מוערך"** — a slot is over, BUT the device area is a **class-default estimate** (not user-entered) and the overflow is moderate. Never says "won't fit."
- **⚠ red "…לא נכנס למדף בודד"** — a slot is over AND either the area is **user-measured** (trust the number) OR a single item is so much larger than a slot that no estimate slack could explain it.

This verdict is a **model** value (`out.fit`), computed once in `deviceOccupancy`, so the diagram, the sentence, and the a11y list all agree. The view never re-derives fit.

---

## 3. Model additions (three small, tested pieces)

### 3.1 `deviceSilhouette(dev) -> 'cabinet'|'offset'|'grill-round'|'grill-rect'|'vessel'`
Type-based contour now; model-based shape capture is deferred (owner: "type-based silhouettes now, model-based via the add-device AI lookup later"). Pure function of `(dev.cat, dev.type)`:

- `sousvide` → **`vessel`**.
- `grill` → **`grill-round`** for round bodies (`type` ∈ {`קטל`, `פחם`}), else **`grill-rect`** ({`גז`, `פלנצ׳ה / פלטה`, `לבה / אינפרא`}). A kettle MUST draw as a true circle.
- `smoker` type `אופסט / סטיק-ברנר` → **`offset`** (horizontal barrel + firebox — the owner called this out as looking different).
- everything else rack-based (all other smokers, all ovens) → **`cabinet`** (a vertical shelf stack — physically truthful for stacked-grate bodies even when the outer shell is round; round-body refinement is deferred with model-based capture).

Default for an unknown/absent type within a rack device → `cabinet`; within a grill → `grill-rect`.

### 3.2 `cap.areaMeasured` (boolean) + `out.fit`
- `cap.areaMeasured = !!(dev.cap && Number(dev.cap.areaCm2) > 0)` — the user entered a real cooking area, vs. a class default from `propDef`. (`deviceCapacity` currently reads `propOf(dev,'areaCm2')` which already prefers `cap` over the default; this flag records *which source won*.)
- `out.fit = { verdict:'ok'|'tight'|'over', measured:boolean, hardItems:[name…], softItems:[name…] }`, computed for **area devices only** (volume/bath devices keep the H2 rules: no `%`, `over` means an item needs a bigger bath than owned — that maps to `verdict:'over'`, `measured` per `cap.known`).
  - Gather every measured item that is over its slot or unplaced (a single `cm2 > cap.perSlotCm2`, or `key ∈ unplaced`).
  - Classify each: **hard** if `cap.areaMeasured` OR `cm2 > FIT_HARD_FACTOR * cap.perSlotCm2`; else **soft**.
  - `verdict = hardItems.length ? 'over' : softItems.length ? 'tight' : 'ok'`.
- **`FIT_HARD_FACTOR = 1.6`** — a named constant, not a magic number. Rationale: a default shelf area is a rough class estimate; a real shelf can plausibly be ~30–50 % larger than the default, so a 1.29× overflow (the brisket case: 1320 vs 1020) is *tight*, not *impossible*. Past 1.6× no plausible slack explains it, so even an estimate calls it over. When the user has entered a real area (`areaMeasured`), there is no slack — any overflow is hard.

### 3.3 `deviceDisplayName(dev) -> string`
The card shows the device's own name, and disambiguates duplicates (owner: "אביה 150, not ארון עישון 150 … more of the same model get a sequential number 1, 2"). Base name = `dev.name` (falls back to `t(dev.type)`). If 2+ devices in `equipList()` resolve to the same base name, append ` · מס׳ N` / ` · #N` in `equipList()` order. Used to set `out.devName` (replacing the current `dev.name || t(dev.type)` line at app.js:404). Single-of-its-name devices get no suffix.

---

## 4. The view (`occupancyDevHtml` rewrite)

`occupancyDevHtml(o)` becomes a dispatcher on `deviceSilhouette(o.dev)`, delegating to a small pure sub-renderer per silhouette. All read only `o` (the `deviceOccupancy` object) — no new computation. Each returns an HTML string. Layout, class names, and proportions follow the approved mockup; **colors come from the app's existing tokens** (`--char/--ember/--ash/--bone/--smoke/--line/--fresh/--over/--grate/…`) and **all text sizes use `calc(Npx * var(--fscale))`** so the app's accessibility text-scaling keeps working (the mockup omitted `--fscale`; the real CSS must not).

Shared header (all silhouettes): `deviceDisplayName` + setpoint (`o.compat.setpoint°`) + a facts line (silhouette type label, wood, area/slot count with `cap.slotLabelHe/En`). Then the silhouette body. Then the **fit line** from `o.fit.verdict` (green ✓ / orange ◐ / red ⚠, naming the items in `hardItems`/`softItems`). Then the **accessible list** (`<ul>` of “item · slot N · cm²”) — the printable / screen-reader layer, present for every rack/zone device.

### 4.1 `cabinet` (rack devices: cabinet smokers, ovens)
A vertical stack of `cap.slots` shelves (mockup `.rack`/`.shelf`). Each shelf: a right-aligned index number, then a tile per item in `slot.items`, tile flex-basis ∝ `cm2 / cap.perSlotCm2` (min ~18 %). An empty shelf renders "מדף פנוי". An item whose `cm2 > cap.perSlotCm2` renders as an over tile: capped width, hatched "bleed" past the rail, ⚠, red border (mockup `.tile.big`/`.bleed`). Dashed (`cm2===null`) items render as a dashed tile with no number.

### 4.2 `offset` (offset smoker)
A horizontal barrel with a firebox to the side (mockup `.offset`/`.barrel`/`.firebox`/`.grate`). Grates run across; items are tiles on a grate row. Otherwise identical fill/over/dashed rules to `cabinet`.

### 4.3 `grill-round` / `grill-rect` (grill)
A top-view grate texture split into `cap.slots` heat zones side by side (mockup `.grill`/`.zones`/`.zone`). **`grill-round` is a true circle** (`width==height`, `border-radius:50%`) — the owner's hard requirement. Each zone shows its item tile or "פנוי", with a zone label `אזור N` (never "ישיר/עקיף" — the model does not know direct vs. indirect). Zone slot label from `cap.slotLabelHe` ("אזורי חום"), never "מדפים".

### 4.4 `vessel` (sous-vide)
An open-topped vessel with a water line and circulator stub (mockup `.vessel`/`.wl`/`.circ`/`.bags`). One `.bag` per item. **No `%`** (H2). A capacity sentence: bag count · largest required litres · bath litres. `over` (an item needs a bigger bath than owned) → red fit line.

### 4.5 Hanging bay (overlay, any device with hooks)
When `cap.hooks > 0`, a dashed bay above the shelves (mockup `.bay`/`.hooks`/`.hung`): lit hooks = `hooksUsed`, dimmed = remaining; a `.hung` tag per hung item dangling downward (longer item hangs lower). The shelves below still draw **empty** — the visual proof that hanging frees grate area (H3). `hooksOver` → red fit line naming the overflow.

---

## 5. Non-goals / safety

- No scheduler, packer, or resolution change. No new measurement invented. Unknown area → dashed, no number; unknown device area → the existing "add the cooking area" prompt (app.js:472), no fabricated fill.
- The scrubber, `openOccupancyView`, `_occOpenAt`, `_occWire` are unchanged — they already call `occupancyViewHtml` → `occupancyDevHtml`; only the HTML those emit changes.
- Works in **all three** app themes (light, light-high-contrast at app.css:389, dark at app.css:435) via tokens — not just the mockup's light+dark. Any token the mockup used that the app lacks (`--over`, `--over-l`, `--grate`, `--cool`, `--cooll`, `--fresh-l`) is added once to all three `:root` blocks.
- Hebrew + English (every string via `L(he,en)`); RTL correct; numeric readouts `dir="ltr"` where a bidi flip could occur (lesson L13).

---

## 6. Testing (acceptance)

1. **Silhouette mapping:** `deviceSilhouette` returns `cabinet` for a cabinet smoker & every oven type, `offset` for `אופסט`, `grill-round` for `קטל`/`פחם`, `grill-rect` for `גז`, `vessel` for sous-vide.
2. **Round grill is a circle:** the rendered `grill-round` element has equal width/height and `border-radius:50%` (regression fence for the owner's "weird shape").
3. **Fit ladder — estimate:** a cabinet with a **default** area and a brisket 1.29× a shelf → `fit.verdict==='tight'`, orange "ייתכן צפוף", **not** red, **not** "לא נכנס".
4. **Fit ladder — measured:** the same load with a **user-entered** `cap.areaCm2` too small → `fit.verdict==='over'`, red "לא נכנס למדף בודד", naming the brisket.
5. **Fit ladder — huge:** an item > 1.6× the slot on an estimated area → `over` (red) even though unmeasured.
6. **Everything fits:** a load within every shelf → `fit.verdict==='ok'`, green ✓, no warning.
7. **Cabinet render:** N shelves drawn = `cap.slots`; empty shelves show "מדף פנוי"; two small cuts that share a shelf render in the same shelf row; the a11y `<ul>` lists each item with its slot and cm².
8. **Dashed unmeasured:** a `cm2===null` item renders dashed with no number and sits on no shelf (H1 preserved).
9. **Hanging:** a hanging device draws a bay with `hooksUsed` lit hooks and the shelves below drawn empty.
10. **Vessel:** a sous-vide draws bags, shows **no `%`**, shows the litres sentence.
11. **Sequential name:** two devices named "אביה 150" render "אביה 150 · מס׳ 1" / "· מס׳ 2"; a unique device gets no suffix.
12. **Regression:** occupancy-slots, occupancy-oven, and all H1–H3 specs stay green; the scrubber still repaints.
13. **UI-verified with Playwright at 390px, Hebrew and English, light + dark** — screenshots viewed, not just captured (§10.2). Full suite green once.

---

## 7. Definition of Done

- Every cooker renders as its device-shaped diagram matching the approved mockup, from `deviceOccupancy` alone (no view-side placement).
- The fit ladder (ok/tight/over) is a model value; the diagram, sentence, and a11y list agree.
- Device name + sequential number shown; round grill is a true circle.
- Three fill states only (solid/dashed/empty); no invented measurement.
- All three themes, both languages, 390px, RTL correct; scrubber intact.
- New model helpers each have a real reader; no orphaned field.
- Full suite green; H1–H4 unbroken; UI verified by viewed screenshots.
