# Equipment properties — completing the known set — Design Spec

**Date:** 2026-07-20 · **Status:** owner-approved scope, awaiting spec review
**Inputs:** `docs/equipment-property-audit-2026-07-20.md` (approved) · `docs/plan-depth-model-2026-07-20.md` (approved)

**Owner decision:** complete **all known** properties now. Demand-driven capture applies only to
equipment types added *after* day one — not to the list we already know.

---

## 1. The problem with the current model

A category declares at most **one** `capKey` plus **one** `multiCap`. That cannot express a smoker needing
`racks` **and** `maxC` **and** `canHang` **and** `waterPan`. Accessory `prop` supports a single *choice*
only, so `scale.maxKg` (a number) and `hooks.count` (a number) have nowhere to live.

**The storage shape is already fine** — everything lands in `d.cap[key]`, and `equipment_map` joins on
`cap.*`. Only the *declaration* and the *form rendering* are single-slot.

## 2. Schema

Add a `props: []` array to any `EQUIP_CATS` entry and to any `EQUIP_OTHER_ITEMS` entry.
`capKey` and `multiCap` stay exactly as they are — they remain the headline capacity, so nothing migrates
and nothing breaks.

```js
{key:'maxC', he:'טמפ׳ מרבית', en:'Max temp', kind:'num', unit:'°C', tier:'core', def:{'חשמלי':135,'פלטים':260}}
```

| field | meaning |
|---|---|
| `kind` | `num` · `bool` · `choice` (needs `opts`) |
| `unit` | rendered suffix; omit for bool |
| `tier` | `core` renders inline · `pro` renders inside a collapsed "מתקדם / Advanced" `<details>` |
| `def` | **class default keyed by device `type`** (or a scalar). An unset property is a precision loss, never a blocker. |
| `opts` | `[{v,he,en}]` for `choice` |

**Reuse over invention:** grinder plate sizes are a *list of millimetres* — exactly what `multiCap` already
does for stuffer nozzles. Grinder gets `multiCap:{key:'plates'}`, **not** a new mechanism. Only genuinely
new shapes (numbers, booleans) go in `props`.

## 3. The properties to add

### Categories

> **⚠ Type keys must be VERBATIM — and this must be enforced, not trusted.** The `def` maps are keyed by
> the exact `types[]` strings. Abbreviating one (`'קמאדו'` for `'קמאדו / קרמי'`) produces a default that
> silently never fires — no error, just a property that is always empty.
>
> These are mixed Hebrew+Latin RTL strings, and they are genuinely easy to corrupt when retyped: while
> writing this spec a verification script mis-compared `'טבילה (immersion)'` purely from bidi byte
> ordering. **Do not hand-type them.** Copy from a programmatic dump of `EQUIP_CATS[].types`.
>
> **REQUIRED TEST (build gate):** assert that every key of every `props[].def` map exists in that
> category's `types[]`. A typo then fails the suite instead of silently disabling a default. This is
> cheap and it removes the whole class of error.
>
> For reference, the exact strings are:
> **smoker** `'ארון / קבינט'` `'אופסט / סטיק-ברנר'` `'פלטים'` `'קמאדו / קרמי'` `'WSM / חבית'`
> `'קטל (ככלי עישון)'` `'גז (עם תיבת עשן)'` `'חשמלי'` ·
> **grill** `'פחם'` `'גז'` `'קטל'` `'פלנצ׳ה / פלטה'` `'לבה / אינפרא'` ·
> **oven** `'ביתי'` `'דק'` `'פיצה'` ·
> **sousvide** `'טבילה (immersion)'` `'מיכל ייעודי'` ·
> **vacuum** `'שקית חיצונית (edge)'` `'חדר (chamber)'` `'ידני / משאבה'` ·
> **grinder** `'ייעודית'` `'מתאם למיקסר'` · **stuffer** `'אנכית'` `'אופקית'` `'מזרק / משפך ידני'`

| cat | new | kind · unit · tier | class default by `type` (verbatim keys) |
|---|---|---|---|
| **smoker** | `maxC` | num · °C · core | `'חשמלי'`135 · `'ארון / קבינט'`150 · `'פלטים'`260 · `'קמאדו / קרמי'`350 · `'אופסט / סטיק-ברנר'`300 · `'WSM / חבית'`150 · `'קטל (ככלי עישון)'`300 · `'גז (עם תיבת עשן)'`260 |
| | `canHang` | bool · core | true: `'ארון / קבינט'`, `'WSM / חבית'` · false: `'קטל (ככלי עישון)'`, `'פלטים'` |
| | `hooks` | num · pro | — |
| | `waterPan` | bool · pro | true: `'ארון / קבינט'`, `'WSM / חבית'` |
| **grill** | `lid` | bool · **core** | false: `'פלנצ׳ה / פלטה'`, `'לבה / אינפרא'` · true otherwise |
| | `maxC` | num · °C · pro | `'גז'`300 · `'פחם'`400 · `'קטל'`350 · `'פלנצ׳ה / פלטה'`300 · `'לבה / אינפרא'`500 |
| | `rotisserie` | bool · pro | — |
| **oven** | `maxC` | num · °C · core | `'ביתי'`275 · `'דק'`400 · `'פיצה'`500 |
| | `fan` · `steam` | bool · pro | fan true for ביתי |
| **sousvide** | `maxL` | num · L · core | טבילה 20 · מיכל ייעודי 12 |
| | `watts` · `maxC` | num · W/°C · pro | watts 1000 · maxC 95 |
| **vacuum** | `bagW` | num · cm · core | edge 30 · chamber 30 · ידני 25 |
| | `pulse` | bool · pro | true for chamber |
| **probe** | `maxC` | num · °C · pro | 300 |
| | `accuracy` | num · ±°C · pro | 1 |
| **grinder** | `plates` | **multiCap** · mm · core | — (no default possible; this is the owner's finding) |
| | `throughput` | num · kg/min · pro | ייעודית 2 · מתאם למיקסר 0.7 |
| **stuffer** | `speed` | choice 1/2 · pro | — |

### Accessories

| item | new | kind · tier | note |
|---|---|---|---|
| **cooler** | *the item itself* | — · core | **Fixes the unownable requirement** — 13 cuts already ask for holding gear that cannot be owned. |
| **scale** | `maxKg` | num · kg · core | A 0.1 g scale usually maxes at 0.5–3 kg. Owning two scales is normal; the plan must send you to the right one. |
| **hooks** | `count` | num · core | The hang-mode budget. No default possible. |
| **curechamber** | `tempC`, `rhPct` | num · pro | Charcuterie feasibility (12–15 °C / 75–80 %). |
| **humidity** | `rhPct` | num · pro | Pairs with the above. |
| **slicer** | `maxMm` | num · mm · pro | Slice thickness. |

**Deliberately excluded** (derivable from `type`, asking would be redundant): smoker `tempCtl`,
vacuum liquid-sealing, probe wireless/alarm.

## 4. UI

Extend `paintVerify` (app.js ~5370) only. After the existing fuel/area row:

- **core** props render inline, in the same `.eq-vfield` / `.eq-vrow` pattern already used — no new CSS.
- **pro** props render inside one collapsed `<details class="eq-adv"><summary>מתקדם</summary>…</details>`,
  reusing the `.vc-gem` details styling that already exists.
- Every field shows its class default as the input **placeholder**, so the user sees the assumed value and
  only types when correcting it. An empty field means "use the default", never "missing".
- `doSave` writes each into `d.cap[key]`, coercing by `kind` (num → `parseFloat`, bool → checkbox).

`chipsFor` gains **only** the properties worth seeing at a glance: `maxC` (when set), `canHang`,
grinder `plates`, `hooks.count`, `scale.maxKg`. Everything else lives in the editor.

## 5. Consumption

`propOf(dev, key)` returns the stored value, else the class default for that `type`, else `undefined`.
**Every consumer reads through it** — never `dev.cap[key]` directly — so defaults apply uniformly and an
unset property never behaves differently from a defaulted one.

`equipment_map.py` then joins recipe → device:

| recipe `spec` | device property |
|---|---|
| `grind_mm` (4.0 / 4.5 / 8.0) | grinder `plates[]` — **warn when no plate matches** |
| `casing_mm` | stuffer `nozzles[]` (already works) |
| `scale_res` + dose grams | scale `res` **and** `maxKg` |
| smoke temp | smoker `maxC` — **infeasible if the recipe exceeds it** |
| hang class | smoker `canHang` + hooks `count` |
| item length/width | vacuum `bagW` |
| `min_bath_l` | sousvide `maxL` |

## 6. Testing

1. **Additive/no-regression:** every existing device round-trips unchanged; `capKey`/`multiCap` behaviour is
   byte-identical (the existing equipment suite must pass untouched).
2. **Defaults:** `propOf()` returns the class default for an unset property, the stored value when set, and
   `undefined` for an unknown key. A pellet smoker defaults to `maxC` 260 without the user typing anything.
3. **Tiering:** core props render inline; pro props are inside the collapsed `<details>` and are not visible
   until it is opened.
4. **Grinder plates:** adding 4.5 and 8 produces chips and persists as a sorted list, exactly like nozzles.
5. **Cooler:** appears in the accessories checklist and satisfies a recipe requiring `cooler`.
6. **Hebrew and English**, no English leaking into the Hebrew UI; full suite green ×2.

## 7. Definition of Done

- Every property in §3 is capturable, persisted, and readable through `propOf()`.
- No existing device or test changes behaviour (test 1 is the gate).
- A recipe needing a 4.5 mm plate warns when the user's grinder has only 8 mm.
- `cooler` is ownable, so no recipe can require unownable gear.
- Empty properties never block a plan — they degrade precision only.

## 8. Deferred

- **Demand-driven capture** (ask inline when a plan first needs it) — per the owner, only for equipment
  types added after day one. The `def`-by-type mechanism here is its foundation.
- Vertical-clearance measurement for hang mode: `canHang` + `hooks.count` are sufficient for Slice C;
  a centimetre figure is not invented until something needs it.
