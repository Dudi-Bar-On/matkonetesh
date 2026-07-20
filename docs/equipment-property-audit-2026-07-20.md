# Equipment property audit — what's missing, and why it matters

**Date:** 2026-07-20 · **Status:** awaiting owner approval before any code change

Triggered by the owner's observation that the **grinder has no plate-size property**, even though recipes
specify plates ("דק 4.5 מ״מ", "גס 8 מ״מ"). That turned out to be one of several gaps. Below is every
equipment item, what it records today, what it's missing, and the concrete work-plan / orchestration
decision each missing property unlocks.

**Tiering.** Each proposal is marked **CORE** or **PRO**. CORE is asked of everyone (one tap or one number,
and something real breaks without it). PRO is only surfaced at the pro interface level — the basic user is
never asked for circulator wattage. This is the same tiering the two-user-model question needs, so it is
one mechanism, not two.

---

## 0. A defect to fix first

**`cooler` (צידנית / קמברו) does not exist as an ownable item.** I added it to the recipe vocabulary in
`equipment_map.py` (Phase 3's cook-early-and-hold needs holding gear), but never added it to
`EQUIP_OTHER_ITEMS` in app.js. So **13 cuts can now request holding gear that no user can ever own.**
→ Add `cooler` to the accessories checklist. **CORE**, presence only.

---

## 1. Cookers

### smoker — has: `type`, `fuel`, `racks`, `area`
| Missing | Tier | What it unlocks |
|---|---|---|
| `maxC` — max temp | **CORE** | Feasibility. Many electric smokers cap ~135 °C; a 150 °C recipe is simply not doable and the plan should say so instead of scheduling it. |
| `canHang` + clearance | **CORE** | The **hang occupancy mode**. A cabinet smoker hangs sausage/salami; a kettle cannot. Without this, hang mode has nothing to test against. |
| `hooks` count | PRO | How many hanging positions — the hang-mode budget. |
| `waterPan` built-in | PRO | Suppresses/keeps the water-pan setup task. |

*(`tempCtl` — whether it self-regulates — is derivable from `type`: pellet/electric yes, offset no. Don't ask.)*

### grill — has: `type`, `fuel`, `zones`, `area`
| Missing | Tier | What it unlocks |
|---|---|---|
| `lid` yes/no | **CORE** | **Without a lid you cannot cook indirect or roast.** This is a capability gate, not a detail — a lidless plancha/lava grill must not be offered indirect methods. |
| `maxC` | PRO | Sear capability; infrared/lava reach 400-500 °C. |
| `rotisserie` | PRO | Enables specific cooks. |

### oven — has: `type`, `racks`, `fuel`
| Missing | Tier | What it unlocks |
|---|---|---|
| `maxC` | **CORE** | Home ovens cap ~250-300 °C; deck/pizza ovens 400-500. Straight feasibility. |
| `fan` (convection) | PRO | Changes times and drying behaviour. |
| `steam` | PRO | Bread and some charcuterie steps. |

### sousvide — has: `type`, `baths[]` (L)
| Missing | Tier | What it unlocks |
|---|---|---|
| `maxL` the circulator can actually drive | **CORE** | An underpowered circulator cannot hold 24 L. Today any bath may be chosen regardless. |
| `watts` | PRO | Makes **bath preheat time real** instead of my spec's formula. |
| `maxC` | PRO | Most cap 90-95 °C. |

*(One circulator + several containers is already expressible: one device, many `baths` ⇒ one temperature at
a time. Two circulators = two devices. The model is fine here.)*

### vacuum — has: `type`
| Missing | Tier | What it unlocks |
|---|---|---|
| `bagW` max seal width | **CORE** | **A 5.5 kg brisket does not fit a 30 cm sealer.** Real, common, and currently invisible. |
| `pulse`/moist mode | PRO | Wet items. |

*(Liquid-sealing is derivable from `type`: chamber yes, edge no. Don't ask.)*

### probe — has: `type`, `channels`
| Missing | Tier | What it unlocks |
|---|---|---|
| `maxC` | PRO | Some probes cap at 100 °C and cannot read pit temp. |
| `accuracy` ±°C | PRO | Pro calibration workflow. |

*(Wireless/alarm is derivable from `type`.)*

### grinder — has: `type` **and nothing else** ← the owner's finding
| Missing | Tier | What it unlocks |
|---|---|---|
| **`plates[]` (mm) — a multi-value list** | **CORE** | Recipes already specify the plate ("דק 4.5 מ״מ", "גס 8 מ״מ", derived as `spec.grind_mm`: 4.0 / 4.5 / 8.0). Without owned plates we cannot say **which plate to fit** or warn that you don't have it. Same shape as the stuffer's `nozzles`. |
| throughput kg/min | PRO | Batch sizing and grind duration. |

### stuffer — has: `volume` (L), `nozzles[]` (mm)
Best-specified item in the model. Only `speed` (1/2-speed) is missing — **PRO**, low value.

---

## 2. Accessories

| Item | Has | Missing | Tier | What it unlocks |
|---|---|---|---|---|
| **scale** | `res` (1g/0.1g) | **`maxKg`** | **CORE** | A 0.1 g scale usually maxes at 0.5-3 kg — **you cannot weigh a 5.5 kg brisket on it.** Many people own *two* scales, and the plan should send you to the right one per step. Today `res` alone implies one scale does everything. |
| **hooks** | — | **`count`** | **CORE** | The hang-mode budget. Without a count, hanging capacity is unknowable. |
| **curechamber** | `kind` | `tempRange`, `rhRange` | PRO | Charcuterie feasibility — a converted fridge without control can't hold 12-15 °C / 75-80 % RH. |
| **humidity** | — | `rhRange` | PRO | Pairs with the above. |
| **slicer** | — | `maxMm` | PRO | Slice thickness for pastrami/bacon/biltong. |
| **cooler** | *does not exist* | add the item | **CORE** | See §0. |
| injector · torch · chimney · blower · gloves · tongs · brush · drippan · spritz · paper · foil · knife · board | — | — | — | Genuinely binary. Leave as checkboxes. |

---

## 3. Summary — what I propose adding

**CORE (9) — asked of everyone, something breaks without them**
1. `cooler` as an ownable accessory *(fixes an unownable requirement I introduced)*
2. grinder `plates[]` (mm) *(the owner's finding)*
3. hooks `count`
4. scale `maxKg`
5. smoker `canHang` (+ clearance)
6. vacuum `bagW`
7. grill `lid`
8. smoker `maxC`
9. oven `maxC`, sousvide `maxL`

**PRO (11) — surfaced only at the pro level**
sousvide `watts`/`maxC` · probe `maxC`/`accuracy` · smoker `hooks`/`waterPan` · grill `maxC`/`rotisserie` ·
oven `fan`/`steam` · curechamber `tempRange`/`rhRange` · humidity `rhRange` · slicer `maxMm` · grinder
throughput · stuffer `speed`

**Deliberately NOT adding** (derivable — asking would be redundant): smoker `tempCtl`, vacuum liquid
capability, probe wireless/alarm.

---

## 4. Sequencing (per the owner's ground-up rule)

1. **Approve this list** (owner).
2. Add the approved properties to `EQUIP_CATS` / `EQUIP_OTHER_ITEMS` + the equipment editor UI, tiered.
3. Extend `equipment_map.py` so recipes state the matching requirement (e.g. `spec.grind_mm` already
   exists and would now join onto grinder `plates`; `min_bag_cm` for vacuum; hang class for hooks).
4. **Then** revisit the consumption-layer spec: several of its rules currently assume properties that do
   not exist yet (bath preheat assumes `watts`; hang mode assumes clearance and hook count; the nozzle rule
   already works because the stuffer is well-specified).
