# Device occupancy: the diagram this should have been

**Date:** 2026-07-21
**Scope:** `occupancyDevHtml` / `occupancyViewHtml` / `_occWire` in `app.js`, the `.occ-*` block in `app.css`, and the fields `deviceOccupancy()` must start returning.
**Measured against:** live app at 390 px, kit = `{smoker: 5 racks / 6000 cm² / 8 hooks}`, `{grill: קטל, 2 zones, 2400 cm²}`, `{sousvide: 12 L}`, 12-guest menu (`cut-1`, `cut-7`, `cut-2`, `cut-12`). Device card content width measured at **304 px** — every number below is sized to that.

---

## 0. The owner's requirement, restated as acceptance criteria

> *"a graphical representation of a shared device setup that shows what cut is mounted where at a specific time, the percentage of the device usage at a specific time in the future or now and any important helpful info about the device"*

| # | Criterion | Current status |
|---|---|---|
| A1 | **Where** a cut is mounted — a named, countable location | ✗ not modelled, not drawn |
| A2 | Two cuts on one shelf read as **side by side** | ✗ |
| A3 | 5 shelves **look like** 5 shelves | ✗ |
| A4 | Hanging reads as hanging, distinct from a grate | ✗ (dashed border, 1.5 px) |
| A5 | Usage % **at a future instant** | ~ (a scalar, and see §1.3) |
| A6 | Device-relevant facts (temp, wood) | ~ (present, but see §1.7) |
| A7 | Three device classes look like three different objects | ✗ (pixel-identical) |

Five of seven fail. That is the honest scoreboard.

---

## 1. Critique of the current implementation

### 1.1 It renders three different physical objects identically

Screenshot evidence, 390 px, one scrub instant: a 5-shelf cabinet smoker, a 2-zone kettle and a 12 L water bath are three identical rounded cards, each with a header line, a pill-shaped percentage bar, and a wrapped grid of chips. Nothing in the pixels distinguishes a cabinet from a tub. `EQUIP_CATS` already carries `icon`, `acc`, `accL`, `capEm`, `capKey` per category — the diagram consults **none** of it. The information needed to differentiate was sitting one function call away.

### 1.2 The one thing the chips encode is destroyed by the CSS that renders them

`occupancyDevHtml` sets `flex: 1 1 <frac>%` where `frac = cm2 / cap.usableCm2 * 100`, floored at 8. `.occ-item` then sets `min-width: 104px` and `.occ-slots` sets `flex-wrap: wrap`. At 304 px:

| item | cm² | intended frac | rendered width |
|---|---|---|---|
| בריסקט | 1320 | 26 % | ~150 px |
| ספייריבס | 360 | 8 % (floored) | ~150 px |
| אסאדו | 600 | 12 % | ~150 px |
| פסטרמה בקר | 600 | 12 % | ~150 px |

A 3.7 : 1 footprint ratio renders as **1 : 1**, in a tidy 2 × 2 grid. `flex-grow: 1` plus a `min-width` floor plus wrapping means the proportion is thrown away in every realistic case. The diagram claims to be proportional and is not. Test **W5** (`no occupancy chip clips its own label`) is what forced `min-width: 104px` in — so the test suite is currently *enforcing* the destruction of the only quantitative claim the view makes. That is the deepest problem here: the design had an internal contradiction, and the fix for the symptom cemented it.

The root cause is the denominator. Dividing by the **whole cabinet** (5100 cm²) makes every item small enough to need a legibility floor. Dividing by **one shelf** (1020 cm²) puts every item between 35 % and 130 % of its row — legible without any floor. Shelf decomposition is not just prettier; it is what makes proportional widths *possible*.

### 1.3 The percentage can be true and still wrong

Live figures: cabinet `areaCm2 = 6000`, `PACK_EFF 0.85` → `usableCm2 = 5100`, `racks = 5`. Four cuts totalling 2880 cm² → **56 %**, green bar, no warning.

But per shelf that cabinet offers `5100 / 5 = 1020 cm²`, and בריסקט alone is **1320 cm²**. The brisket does not fit on any single shelf of this cabinet. The view says "56 %, plenty of room" about a load that cannot be physically arranged. A gauge that reports comfort for an impossible configuration is worse than no gauge, because it is confidently wrong.

`over` has the same defect in the other direction: two 700 cm² items on a 5-shelf 5100 cm² cabinet are "27 %" whether they fit one shelf or need two.

### 1.4 Unknown is silently rendered as zero

`itemOccupancy` (app.js:317): `cm2: Number(spec.footprint_cm2) || 0`. `_footprint_cm2()` in `equipment_map.py` returns `None` whenever the cut has no `kg`. So an unweighed brisket contributes **0 cm²**, and `usedCm2` / `pct` / `over` are all computed as if it were not there. The cabinet reads *emptier* because we know *less*. This directly violates the project's "never invent a measurement" rule — it invents the measurement zero.

### 1.5 The sous-vide number is a category error

`_bath_l()` returns the **smallest bath that will work for this item** (12 L up to 3 kg, else 24 L). It is a *minimum requirement*, not a displacement. `deviceOccupancy` sums them (`out.usedLitres += occ.litres`). Live result: four items × 12 L on a 12 L bath = **500 %, red, "חריגה מהקיבולת"** — for a load that in reality needs a 12 L bath. Two items each needing a 12 L bath need one 12 L bath, not 24 L. The correct predicate is `max(min_bath_l) > cap.litres`; the correct occupancy measure for a bath is *bag count and circulation clearance*, which we do not have and must not fake.

### 1.6 Hanging is modelled but unreachable, and mis-scoped

`itemOccupancy` gates hanging on `equipOwnsToken('hooks')`. `'hooks'` is not a device category — it resolves to `EQUIP_OTHER_ITEMS`, i.e. a **separate accessory device** `{cat:'other', type:'hooks'}`. Consequences:

- The cabinet's own `canHang: true` / `hooks: 8` — which `deviceCapacity` reads into `cap.hooks` and the header prints as `🪝 0/8` — plays **no part** in deciding whether anything hangs. Live run: 8 hooks advertised, 0 used, because no separate "ווים" accessory was in the kit.
- Conversely, own the accessory plus a plancha, and a sausage assigned to the plancha is counted as hung: 0 cm², grate freed, on a device with no hooks at all.

Tests O24/O25 both seed `{cat:'other', type:'hooks'}` explicitly, so the suite **encodes** the bug rather than catching it. The correct gate is `deviceCapacity(dev).hooks > 0` — a property of the device the item is assigned to.

### 1.7 The facts strip mislabels, and mostly says nothing actionable

- `🗄️ 2 מדפים` **on a kettle grill.** `deviceCapacity` merges `cap.racks || cap.zones` into one `racks` field (app.js:301) and `occupancyDevHtml` hard-codes the label `מדפים / racks` (app.js:401). A kettle's heat zones are not shelves. This is wrong *content*, not just a weak picture — and `EQUIP_CATS` already carries the right words in `capHe` / `capEn` (`אזורי חום` / `heat zones`).
- `🪵 עצים שונים` ("different woods") appears whenever two cuts list different wood *options*. אלון/היקורי and היקורי/תפוח share היקורי — `commonWood` finds it, but the `else if (woods.length > 1)` branch fires first only when `commonWood` is null… and in the live run it fired anyway on the sv device because the sv items carry unrelated wood lists. Either name the wood to use, or name the actual conflict. "Different woods" is an observation, not advice.
- `🌡️ 110°C` is the single most useful number on the card and is rendered at 12.5 px in a grey run-on strip, smaller and fainter than the device name.

### 1.8 Craft defects

- **Gradient is physically directional in an RTL document.** `.occ-bar i` uses `linear-gradient(90deg, …)`; measured, the fill originates at x = 340 and grows *leftward*, while the gradient's 0 % stop sits at the geometric left — the far end of the fill. The colour ramp runs backwards. Use solid fills.
- **`transition: width .2s` on `.occ-bar i` is dead code.** `_occWire.paint()` does `body.innerHTML = occupancyViewHtml(...)` on every `input` event. Every node is destroyed and recreated, so nothing ever transitions, and dragging the scrubber re-parses three full device cards per frame on a phone.
- **`min-width: 104px` does not scale with `--fscale`,** while the font inside it does (`calc(12.5px * var(--fscale))`). At the 1.3–1.4× text scale the app offers, "פסטרמה בקר" clips. W5 only ever runs at 1.0.
- **`title="…"` on the chips** is a hover tooltip in a touch-only app. Dead.
- **Nothing in the diagram is tappable.** The chips are `<span>`s. The user can see a clash and cannot act on it without leaving the view.
- **`🥩` on every item** carries zero bits when every item is meat.
- **No `aria` story at all.** The chips are unlabelled spans; a screen reader gets a soup of names and numbers with no structure.

---

## 2. The design

### 2.1 One principle

> **Draw the container, then put the items inside it. Solid fill is reserved for measured quantities.**

Everything below follows from those two sentences. The container's *shape* comes from `dev.cat`; its *subdivision* comes from `cap`; the items' *position* comes from a model-side packer; and anything we do not know is drawn dotted and unnumbered rather than omitted or zeroed.

### 2.2 Vertical cabinet smoker — N shelves (A1, A2, A3)

Live data, packed by the algorithm in §3.2 (per-shelf 1020 cm²):

```
 ┌──────────────────────────────────────────┐  ← 304 px content
 │ ארון עישון 150             🌡 110°  🪵 היקורי│  header 24px
 │                                           │
 │ 🪝 🪝 ○ ○ ○ ○ ○ ○                    2/8 │  hook bay 34px
 │  ┌────────┐┌────┐                         │   (only if cap.hooks>0)
 │  │ סלמי  ⌄││נקנ⌄│                         │
 │  └────────┘└────┘                         │
 │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
 │ 1 ▐███████████████████████████████████⚠▌ │  ← בריסקט 1320/1020
 │   ┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅ │     = 129%, over
 │ 2 ▐████████████████▌▐█████████▌           │  ← אסאדו 59% + ספייריבס 35%
 │   ┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅ │     6% bare grate visible
 │ 3 ▐████████████████▌                      │  ← פסטרמה 59%
 │   ┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅ │
 │ 4                                         │  ← empty: bare rail
 │   ┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅ │
 │ 5                                         │
 │   ┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅ │
 │ ▁▁▂▄▆████▆▄▂▁▁▁                    ⌁16:50 │  ribbon 12px
 │ ספייריבס יורדים בעוד 40 דק׳                │  next-event 18px
 └──────────────────────────────────────────┘
```

*(ASCII drawn LTR; in the app `dir="rtl"`, so shelf numbers sit at the inline-start = **right** edge and tiles fill rightward. Everything uses logical properties, so this is automatic.)*

**Layout maths at 304 px.** Shelf index gutter 18 px, so the shelf surface is 286 px. Row height `calc(34px * var(--fscale))` + 6 px gap. Five shelves = 200 px; plus header 24, hook bay 34, ribbon 12, next-line 18, padding 24 → **≈ 312 px per device.** Two devices fit a 390 × 844 screen below the scrubber. That is the right density: this view is *about* one cooker at a time. Devices with zero items at the scrub instant collapse to a 40 px summary row (`name · פנוי · N מדפים`) so idle gear never costs a screenful.

**Every shelf is drawn, including empty ones.** The empty shelves *are* the free capacity — collapsing them would hide the answer to "can I still fit the chicken". A bare rail (`┅┅┅`, a 5 px grate hatch) with nothing on it is the clearest possible "this shelf is free".

**Partially-filled shelves are honest by construction.** Shelf 2 is `59 % + 35 % = 94 %`; the remaining 6 % (17 px) is drawn as bare grate between the tile's edge and the shelf's end. No fudging: the tiles occupy exactly their fraction and the leftover is visible. This is why `flex-wrap: nowrap` is mandatory on a shelf — a wrapped tile is a lie about the shelf's width.

**Over-capacity is a shape, not a red number.** Shelf 1's tile is capped at 100 % width but gets a hatched bleed past the rail end plus `⚠`. The label reads `בריסקט · 1320 / 1020 סמ״ר`. That is the sentence the current 56 % gauge cannot say.

**Legibility without a min-width floor.** Against a 286 px shelf, the smallest live tile (ספייריבס, 35 %) is 100 px — comfortable. The floor is enforced by the *packer*, not by CSS: a shelf holding six items is a shelf we should be warning about, not silently squeezing. For the residual case, tiles measuring under 56 px get `.occ-tile-mini` (JS sets it from `frac × shelfW`, no container queries needed), which shows a 1-char initial and defers the name to the list in §2.7.

### 2.3 Hanging (A4)

Hanging is a **second channel**, not a smaller footprint, so it gets its own bay above the shelf stack, separated by a dashed hairline. Two claims, both fully supported by data we have:

1. **Hook count is an integer we actually know.** Draw `cap.hooks` glyphs; fill `hooksUsed` of them. `🪝 🪝 ○ ○ ○ ○ ○ ○` is countable, exact, and needs no measurement.
2. **The shelves below a hung item stay drawn as free.** That *is* the visual proof that hanging frees grate area. A hung salami must never shave a pixel off any shelf's bare rail.

Hung tiles are visually distinct on four axes at once, so it survives sunlight and a glance: `--fresh-l` fill (the shelf tiles are `--char3`), a **notched top edge** (`border-block-start: 2px dotted` plus a `::before` hook glyph straddling the rail), **top-aligned and hanging downward** while shelf tiles are bottom-aligned and rest upward, and **depth by class** — `spec.hang === 'long'` (salami, whole bird, rib rack) renders 44 px tall, `'short'` (links, coils) 28 px. `_hang_class()` already emits exactly these two values.

**What we deliberately do not draw:** a long salami physically blocks the shelves beneath it. The model does not know the cabinet's internal geometry, so the diagram gives hanging its own bay rather than overlaying the shelves. Overlaying would look better and would be an invention.

### 2.4 Grill — heat zones, not shelves (A7)

A grill is a **plan view**, horizontal, not a stack:

```
 ┌──────────────────────────────────────────┐
 │ קטל 57                    🌡 230°  2 אזורים│
 │  ╭───────────────────╮╭───────────────────╮
 │  │▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨││▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨│  grate hatch
 │  │ ┌───────────────┐ ││                   │
 │  │ │   אנטרקוט     │ ││       פנוי        │
 │  │ └───────────────┘ ││                   │
 │  ╰───────────────────╯╰───────────────────╯
 │        אזור 1              אזור 2          │
 │ ▂▄▆████▆▄▂                         ⌁18:20 │
 └──────────────────────────────────────────┘
```

Differentiators from the cabinet, all at a glance: **zones run side by side** (`grid-template-columns: repeat(var(--zones), 1fr)`), the surface carries a **cross-hatch grate texture** in both axes rather than horizontal rails, the outline is **squat and wide** (fixed ~86 px tall regardless of zone count) rather than a tall stack, and for `type === 'קטל'` the outline gets `border-radius: 50% / 22%` so a kettle reads as round.

**Honesty constraint — this matters.** `cap.zones` is a *count*. The model knows nothing about which zone is direct and which is indirect, nor their relative areas. So: zones are labelled `אזור 1 / אזור 2`, **never** "direct/indirect", and the flame band under the grate is uniform, driven only by `compat.setpoint`. Direct/indirect would need a new grill property (`zoneMix`) — see §5. Equal-width zones are an assumption; state it once in the empty-state copy rather than in the diagram, and never print a per-zone cm² figure derived from the equal split.

And fix the label: `EQUIP_CATS` already has `capHe: 'אזורי חום'`. Read `equipCat(dev.cat).capHe / capEn` instead of hard-coding `מדפים`.

### 2.5 Sous-vide — a volume of liquid (A7)

```
 ┌──────────────────────────────────────────┐
 │ אמבט סו-ויד                        🌡 56.5°│
 │                    ╻                      │
 │  ╷~~~~~~~~~~~~~~~~~┃~~~~~~~~~~~~~~~~~~~╷ │  water line + circulator
 │  │  ╭────────────╮ ┃ ╭──────────╮       │ │
 │  │  │  אנטרקוט   │ ┃ │  צלעות   │       │ │  submerged bags
 │  │  ╰────────────╯ ┃ ╰──────────╯       │ │
 │  ╰──────────────────────────────────────╯ │  vessel: 3 sides, open top
 │  2 שקיות · הגדולה דורשת 12 ל׳ · האמבט 12 ל׳│
 └──────────────────────────────────────────┘
```

The vessel is a three-sided outline (open top), filled with a translucent `--tint-cool` water body carrying a subtle wave on its surface, an immersion-circulator stub clipped to the rim, and the **setpoint printed large** — for sous-vide the setpoint is the whole game and it is exact to 0.5 °C.

**Bags are sized by relative `kg`, not by litres**, precisely because litres here is a minimum-bath requirement (§1.5), not a displacement. Occupancy is stated as a **count** plus the binding requirement: `2 שקיות · הגדולה דורשת 12 ל׳ · האמבט 12 ל׳`. No percentage, because we cannot honestly compute one.

Over-capacity is `max(min_bath_l) > cap.litres`, and it renders as **a bag breaching the rim** — sticking out above the water line with the vessel outline broken at that point. Legible in a glance and far more actionable than "500 %".

### 2.6 Time (A5)

**Density ribbon.** A 12 px strip per device spanning the plan's `lo..hi`, bucketed at 15 min, bar height = item count in that bucket, with a playhead `⌁` at the scrub instant. It answers "when is this pit busy, and where am I in that" in one glance, and it turns the scrubber from blind hunting into aimed navigation. Buckets, not per-item lanes: 6 items × 5 px of lanes would cost 30 px per device for information that belongs in the list.

**Ghosting, ±20 minutes.** An item whose `start` is up to 20 min *ahead* of the scrub instant renders in its assigned slot as a dotted, 45 %-opacity ghost — "this space is spoken for". An item whose `end` is within 20 min renders with a striped trailing edge and a `↑` glyph — "coming off". This is what makes the diagram *predictive* rather than a snapshot, and it is exactly the owner's "at a specific time in the future". It needs no new model data: `start` and `end` are already on every item.

**Next-event line.** One sentence under the ribbon: `ספייריבס יורדים בעוד 40 דק׳`. Next-event-only, never a list. Next to a hot pit this is the highest-value line on the card.

**Update, don't rebuild.** Replace `body.innerHTML = …` with: build the device skeletons once on open; on scrub, run `deviceOccupancy` per device and reconcile a keyed `Map<itemKey, HTMLElement>` — set `--w`, `--rack`, and state classes on survivors, append entrants, remove leavers. Then `transition: inline-size .18s, opacity .18s` finally does something, tiles slide between shelves instead of popping, and the frame cost drops from three full re-parses to a handful of style writes. Throttle to `requestAnimationFrame`; gate the transitions behind `@media (prefers-reduced-motion: reduce)` as the codebase already does in three places.

### 2.7 Signal vs clutter on a phone, one-handed, next to a fire (A6)

**Promote:** setpoint (largest non-name text on the card); the single actionable wood, or a named conflict, and nothing in between; what is on which shelf; what comes off next; the over/clash condition as a *shape*.

**Demote to the list:** every cm² figure. Nobody acts on "600 סמ״ר" mid-cook — it belongs in the text list under the diagram, not painted on a tile you are trying to read at arm's length.

**Cut entirely:** `title` tooltips; `🥩` on every tile; `עצים שונים`; the standalone percentage bar (the shelves *are* the gauge — a shelf stack that is 3/5 full is a better percentage bar than a percentage bar).

**Add:** tap targets. Every tile is a `<button>` that opens that item's cooker-assignment sheet. Seeing "brisket doesn't fit shelf 1" and being able to move it in the same gesture is the difference between a diagram and a tool. Minimum 34 px tall rows already clear the target guidance when the whole row is the hit area.

**The list is not optional.** Under every diagram, a compact `<ul>`: `בריסקט · מדף 1 · 1320 סמ״ר · 06:00–18:00`. It is the readable layer at 1.4× text scale, the printable layer for the PDF export, and — since the diagram carries `aria-hidden="true"` — the **only** accessible layer. A box diagram is unreadable to a screen reader no matter how much ARIA you hang on it; the correct move is to hide it and label the list properly.

### 2.8 Degradation under unknown data (A5 honesty)

| # | `areaCm2` | `racks` | Render |
|---|---|---|---|
| 1 | known | known | Full shelf diagram, proportional tiles, per-shelf %, over-flags |
| 2 | known | 0 / unknown | **One** shelf, full width, proportional tiles against `usableCm2`. "We know the area, not how it is divided." |
| 3 | unknown | known | Cabinet outline with N rails drawn **dimmed and empty**; items in one undivided tray across the interior, dotted borders, **no figures**, labelled `לא ידוע על איזה מדף`, plus a tappable `הוסף שטח בישול` |
| 4 | unknown | unknown | No vessel at all. Device name, the item list, and the prompt. Never draw a box that implies a capacity we do not have. |

Case 3 is the subtle one: **shelf placement requires per-shelf capacity, which requires `areaCm2`.** A shelf *count* is a fact and may be drawn; a shelf *assignment* without area would be invented, so it is withheld. Drawing the rails and refusing to place on them is the honest picture.

Per-item unknowns compose with this. `cm2 === null` (cut has no `kg`) renders as a **dotted tile with `?`**, sized by a neutral share of the shelf, excluded from `usedCm2`, and the shelf's percentage is prefixed `לפחות` ("at least"). Compare with today, where the same item silently contributes 0 and makes the cabinet look emptier (§1.4).

**The rule, stated once, enforced everywhere:** solid fill = measured; dotted fill = present but unmeasured; nothing = free. Three states, no ambiguity, no invention.

---

## 3. What the model must expose

All of this belongs in `deviceOccupancy` / `deviceCapacity` / `itemOccupancy`. **The view must compute no placement of its own** — the plan's architecture rule ("one pure, queryable seam") is right and this design does not weaken it. A view-side packer would be a second source of truth and would drift from the clash advisories.

### 3.1 New / changed fields

```js
deviceOccupancy(devId, tMs, computed, scope) -> {
  …existing…,
  cap: { …existing…,
    slots:      5,            // rack count | zone count | 1 for a bath
    slotKind:   'rack'|'zone'|'bath',
    perSlotCm2: 1020,         // usableCm2 / slots  — null when areaCm2 unknown
    slotLabelHe:'מדפים', slotLabelEn:'racks',   // from EQUIP_CATS.capHe/capEn — FIXES §1.7
  },
  slots: [                    // ALWAYS cap.slots long, empty ones included
    { i:0, capCm2:1020, usedCm2:1320, over:true,  items:[…], pct:129 },
    { i:1, capCm2:1020, usedCm2: 960, over:false, items:[…], pct:94  },
    …
  ],
  unplaced: [],               // fits nowhere -> the overflow tray
  hung:     [],               // hook-channel items, never in slots[]
  items: [ { …existing…,
    slot:       1,            // index into slots[], or null when unplaceable/unknown
    cm2:        600,          // null, NOT 0, when unmeasured   — FIXES §1.4
    unmeasured: false,
    shape:     'slab',        // from spec.shape — already computed in equipment_map.py
    kg:         3.5,          // from spec.kg    — already computed
    hangClass: 'long'|'short'|null,
  } ],
  anyUnmeasured: false,       // -> "לפחות" prefix on every percentage
  pctBasis: 'measured'|'partial'|'unknown',
  nextEvent: { key, name, dir:'on'|'off', atMs },   // drives the next-event line
}
```

Plus a new, additive sibling for the ribbon (it needs the whole span, not one instant):

```js
deviceTimeline(devId, computed, scope) -> { lo, hi, buckets:[{tMs, n}], spans:[{key,name,start,end}] }
```

### 3.2 The packer: assign on arrival, never re-place

Per-instant bin-packing is the wrong shape — the assignment would churn as the scrubber moves and tiles would teleport between shelves. Instead, **replay the cook once, chronologically:**

1. Collect every (item, start, end) for this device across the whole plan.
2. Sort by `(start ASC, cm2 DESC, key ASC)` — total order, no ties, deterministic.
3. Sweep events in time order. On **on**: free the area of anything that has already come off, then place the item on the **lowest-index slot whose free area ≥ its cm²**; if none, push to `unplaced`. On **off**: release its area.
4. Freeze the result. Each item has **one** slot for its entire life.

This is deterministic, stable under scrubbing (the diagram never reshuffles), independent of `tMs` (memoise per `(devId, computedRev)`), and — the reason it is the right model rather than merely a convenient one — it is **physically true**: you put the meat on whichever shelf has room when you carry it out, and you do not move it mid-cook.

Verified against live data: brisket (1320) → slot 0, over-flagged; asado (600) → slot 1; pastrami (600) → slot 2 (600 + 600 > 1020); spareribs (360) → slot 1 (600 + 360 = 960 ≤ 1020). **Shelf 2 holds אסאדו and ספייריבס side by side** — the owner's A2, falling out of real data with no hand-tuning.

### 3.3 Three model bugs to fix alongside

| Bug | Fix |
|---|---|
| §1.6 hanging gated on a global accessory | `itemOccupancy(meta, stageKind, dev)` — gate on `deviceCapacity(dev).hooks > 0`. Threading `dev` through is a 3-line change at the one call site (app.js:356). Update O24/O25 to drop the `{cat:'other',type:'hooks'}` prop and assert the *device's* hooks instead. |
| §1.5 sous-vide sums minimums | `usedLitres` → `reqLitres = max(items.litres)`; `over = reqLitres > cap.litres`; add `bagCount`. Delete the volume `pct` entirely — there is no honest denominator. |
| §1.4 unknown footprint → 0 | `cm2: (spec.footprint_cm2 == null ? null : Number(...))`, `unmeasured` flag, and skip nulls in the sum while setting `anyUnmeasured`. |

None of the three is cosmetic; each currently produces a *wrong statement* on screen.

---

## 4. DOM and CSS

### 4.1 Structure

```html
<section class="occ-dev occ-cat-smoker" data-dev="d1" data-slotkind="rack"
         style="--slots:5; --acc:#9a6a3a; --accL:#f4e6d6">
  <header class="occ-h">
    <b class="occ-name">ארון עישון 150</b>
    <span class="occ-set">🌡 110°</span>
    <span class="occ-wood">🪵 היקורי</span>
  </header>

  <!-- hook bay: only when cap.hooks > 0 -->
  <div class="occ-bay" style="--hooks:8; --hooks-used:2">
    <div class="occ-hookrail" aria-hidden="true"></div>   <!-- glyphs via ::before repeat -->
    <div class="occ-hungrow">
      <button class="occ-tile occ-t-hang occ-hang-long" data-item="make-salami">סלמי</button>
    </div>
  </div>

  <!-- the vessel -->
  <ol class="occ-slots" aria-hidden="true">
    <li class="occ-slot occ-slot-over" style="--fill:1.29">
      <span class="occ-slot-n">1</span>
      <div class="occ-surface">
        <button class="occ-tile" style="--w:100%" data-item="cut-1">בריסקט</button>
      </div>
    </li>
    <li class="occ-slot" style="--fill:.94">
      <span class="occ-slot-n">2</span>
      <div class="occ-surface">
        <button class="occ-tile" style="--w:58.8%" data-item="cut-2">אסאדו</button>
        <button class="occ-tile occ-t-soon" style="--w:35.3%" data-item="cut-7">ספייריבס</button>
      </div>
    </li>
    <li class="occ-slot"><span class="occ-slot-n">3</span><div class="occ-surface"></div></li>
    …
  </ol>

  <div class="occ-tray" hidden>…unplaced…</div>
  <div class="occ-ribbon" style="--play:.42" aria-hidden="true">…</div>
  <p class="occ-next">ספייריבס יורדים בעוד 40 דק׳</p>

  <ul class="occ-list">                       <!-- readable + accessible truth -->
    <li><b>בריסקט</b> · מדף 1 · 1320 סמ״ר · 06:00–18:00</li>
    …
  </ul>
</section>
```

`aria-hidden` on the diagram, real content in `.occ-list`; the `<section>` gets `aria-label="${devName} — ${nItems} פריטים"`.

### 4.2 CSS — plain, custom properties, logical, no SVG

**No inline SVG.** Considered and rejected: SVG has no logical properties, so every RTL mirror would be a manual transform in a `dir="rtl"`-first app; `--fscale` text sizing does not compose with `viewBox` units; and the whole diagram is axis-aligned boxes, which is exactly what flex/grid do natively. The only place SVG would earn its keep is the kettle's round outline, and `border-radius: 50% / 22%` covers that. This also keeps the single-file build unchanged.

```css
/* vessel */
.occ-slots{display:flex;flex-direction:column;gap:6px;margin:8px 0}
.occ-slot{display:flex;align-items:flex-end;gap:6px;
          min-block-size:calc(34px * var(--fscale))}      /* scales with text, unlike min-width:104px */
.occ-slot-n{flex:0 0 14px;font-size:calc(10.5px * var(--fscale));color:var(--smoke);
            text-align:center;align-self:center}
.occ-surface{position:relative;flex:1 1 auto;display:flex;flex-wrap:nowrap;   /* NEVER wrap */
             align-items:flex-end;gap:2px;min-inline-size:0;
             padding-block-end:5px;
             background:repeating-linear-gradient(to right,var(--line) 0 2px,transparent 2px 7px)
                        bottom/100% 5px no-repeat}          /* the grate rail */

/* tiles: fixed basis, no grow, no floor — the packer guarantees legibility */
.occ-tile{flex:0 0 var(--w);min-inline-size:0;overflow:hidden;text-overflow:ellipsis;
          white-space:nowrap;border:0;text-align:center;cursor:pointer;
          block-size:calc(26px * var(--fscale));border-radius:5px 5px 0 0;
          background:var(--char3);box-shadow:inset 0 0 0 1.5px var(--line2);
          color:var(--bone);font:700 calc(12px * var(--fscale))/1 var(--font-body);
          transition:flex-basis .18s ease,opacity .18s ease}

/* four states, zero new colours */
.occ-tile-mini            {font-size:calc(10px * var(--fscale))}
.occ-slot-over .occ-tile  {background:var(--tint-warn);color:var(--tint-warn-ink);
                           box-shadow:inset 0 0 0 1.5px var(--tint-warn-ink)}
.occ-t-unmeasured         {background:none;box-shadow:inset 0 0 0 2px var(--line2);opacity:.7}
.occ-t-ghost              {opacity:.45;box-shadow:inset 0 0 0 2px var(--line2);background:none}
.occ-t-soon::after        {content:'↑';margin-inline-start:4px;color:var(--ember)}

/* hanging: top-aligned, notched, depth by class */
.occ-bay{border-block-end:1px dashed var(--line2);padding-block-end:6px;margin-block-end:6px}
.occ-hungrow{display:flex;gap:6px;align-items:flex-start}
.occ-t-hang{align-self:flex-start;border-radius:0 0 5px 5px;
            background:var(--fresh-l);box-shadow:inset 0 0 0 1.5px var(--fresh);
            border-block-start:2px dotted var(--fresh)}
.occ-hang-long {block-size:calc(44px * var(--fscale))}
.occ-hang-short{block-size:calc(28px * var(--fscale))}

/* grill: side by side, cross-hatch, squat */
.occ-cat-grill .occ-slots{flex-direction:row;gap:4px;block-size:calc(86px * var(--fscale))}
.occ-cat-grill .occ-surface{
  background:repeating-linear-gradient(to right,var(--line) 0 2px,transparent 2px 8px),
             repeating-linear-gradient(to bottom,var(--line) 0 1px,transparent 1px 9px)}
.occ-cat-grill[data-round] .occ-slots{border-radius:50% / 22%;overflow:hidden}

/* bath */
.occ-cat-sousvide .occ-vessel{
  border:2px solid var(--line2);border-block-start:0;border-radius:0 0 10px 10px;
  background:linear-gradient(var(--tint-cool),var(--tint-cool));
  display:flex;align-items:center;gap:8px;padding:10px 8px}

@media (prefers-reduced-motion:reduce){.occ-tile{transition:none}}
```

Notes: **no directional gradients carry meaning** — the grate hatches are symmetric, and fills are solid, which sidesteps the RTL bug in §1.8 permanently. Everything sizes off `--fscale`. Everything spatial uses logical properties, so the RTL mirror is free. Colours are existing tokens only: `--char3` / `--line2` (resting), `--tint-warn` / `--tint-warn-ink` (over), `--fresh-l` / `--fresh` (hung), `--tint-cool` (water) — all already contrast-checked.

---

## 5. Achievable incrementally vs needs the model first

**Ship now, view-only, no model change (≈ half the perceived gap):**
1. Fix the `מדפים`-on-a-kettle label — read `equipCat(cat).capHe/capEn`. *Two lines, and it is currently wrong on screen.*
2. Per-category shells: grill = horizontal zones + cross-hatch; sous-vide = vessel + bags; smoker keeps the stack. `dev.cat` is already in hand, so the three stop being pixel-identical immediately.
3. Kill the tooltips, the universal `🥩`, and `עצים שונים`; promote the setpoint; make tiles `<button>`s that open the assignment sheet.
4. Solid fills instead of `linear-gradient(90deg,…)`.
5. Move `min-width: 104px` to a `--fscale`-aware `min-block-size` and let the label truncate.
6. Keyed DOM reconciliation in `_occWire` instead of `innerHTML =`, plus `requestAnimationFrame` throttling. Unblocks every transition and fixes scrub jank.
7. Ghost / coming-off states — `start` and `end` are already on `items[]`.
8. The `.occ-list` + `aria-hidden` split. Independent of everything else and the only accessibility story this view will ever have.

**Blocked on the model:**
9. Shelf and zone *placement* — needs `cap.slots`, `cap.perSlotCm2`, `slots[]`, `items[].slot`, and the §3.2 packer. **This is the requirement.** Items 1–8 make the view better; item 9 is the one the owner actually asked for.
10. Honest over-capacity — needs per-slot capacity, otherwise "over" keeps meaning the wrong thing (§1.3).
11. Working hanging — needs the §3.3 device-scoped gate, or the bay renders empty forever on a correctly-configured cabinet.
12. Truthful sous-vide — needs `reqLitres = max(...)` instead of the sum, or the vessel faithfully draws a 500 % lie.
13. `unmeasured` propagation — needs `cm2: null`, or the dotted-tile rule in §2.8 has nothing to key off.
14. The ribbon — needs the additive `deviceTimeline()`.

**Deferred, needs new device properties:** per-zone direct/indirect (a `zoneMix` prop on the grill category); per-rack dimensions for non-uniform cookers (an offset's shelves are not equal); rotisserie as a third occupancy channel alongside grate and hooks.

**Suggested order:** §3.3 bug fixes (they are wrong statements on screen today) → §3.1/§3.2 model fields + packer, behind the existing `occupancy-model.spec.ts` gate → cabinet diagram → grill and bath shells → ribbon and ghosting → reconciliation and polish.

---

## 6. The single highest-impact change

**Make `deviceOccupancy` return `slots[]` with each item assigned to a slot, and draw the slots.**

It is the one change that simultaneously satisfies A1, A2 and A3; it *enables* proportional tiles by shrinking the denominator from 5100 cm² to 1020 cm², which removes the `min-width` floor that currently destroys proportionality (§1.2); and it converts the percentage from a number that can be true-and-useless — 56 % for a brisket that fits on no shelf in the cabinet (§1.3) — into a claim about slots that actually exist. Everything else in this document is finishing work on top of it.
