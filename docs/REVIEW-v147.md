# מתכונת · v147 — Source-Verification Review (sign-off)

Full source-verification pass over the **entire 279-item catalog**. Every cut/special/make now
carries a cited source (`src`) shown in-app under "📚 מקורות ואימות", with a clickable link and the
exact figure taken. This doc is the change log for your sign-off.

## Coverage
| Collection | Sourced | UNVERIFIED |
|---|---|---|
| CUTS | **130 / 130** | 0 |
| SPECIALS | **47 / 47** | 0 |
| MAKES | **102 / 102** | 0 |
| **Total** | **279 / 279** | **0** |

Canonical sources: Baldwin (sous-vide/pasteurization — the P3 backbone), AmazingRibs/Meathead
(smoke/grill), Serious Eats/Kenji + ChefSteps (sous-vide by cut), Marianski/meatsandsausages +
USDA FSIS (charcuterie cure). Tests: `npx playwright test` — **8/8 green**.

---

## ⚠️ 1. NEEDS YOUR DECISION — Nem Chua
Traditional Vietnamese fermented raw pork is made **without nitrite**. The audit recommends adding
**Cure #1** (156 ppm) because an app audience can't reliably achieve the rapid acidification the
traditional method depends on (botulism/Listeria/parasite risk on raw room-temp pork). I did **not**
apply it — the recipe stays traditional (`cure=None`) and the recommendation lives in its source note.
**Decide:** add Cure #1 for safety, or keep traditional? (One word and I'll set it.)

---

## 🔴 2. Safety-critical — MAKES cure fixes (APPLIED)
Home-curing nitrite gaps — the highest-stakes numbers in the app. All raised to the standard
**2.5 g/kg = 156 ppm**. Every change is safety-positive (adds/raises nitrite; nothing lowered).

**Was ZERO nitrite on raw fermented/dried sausage → now cured (Cure #2):**
| Make | cure |
|---|---|
| Cacciatore, Nduja, Saucisson Sec, Soppressata, Sucuk | none → **2.5** |

> These recipes' *materials text already said "+ Cure #2"* — only the calculator was computing 0 g.
> The fix reconciles the calculator with the recipe.

**Under-dosed → 2.5:**
| Make | cure |
|---|---|
| Bologna, Frankfurter, Mortadella | 1 → 2.5 (was ~62 ppm) |
| Droëwors, Lap Cheong | 1 → 2.5 |
| Linguiça, Loukaniko, Snack Sticks | none → 2.5 (smoked, warm-held) |
| Bresaola, Coppa, Guanciale, Lonzino, Pancetta, Speck | 2 → 2.5 |

**Salt raised for water-activity (aw) control on dry-cured (13):** Chorizo Curado 24→25, Csabai 22→25,
Finocchiona 24→26, Fuet 24→26, Kabanosy 18→25, Krakowska Pod. 20→25, Kulen 24→25, Landjäger 22→26,
Salame Milano 24→26, Pepperoni 24→25, Salchichón 25→26, Sremska 22→25, Teewurst 22→25.

---

## 🟠 3. Physical-consistency / safety fixes on cuts (APPLIED)
| Cut | Change | Why |
|---|---|---|
| Beef Tongue | smoke target 90 → **70°C** | a 70°C sous-vide bath can't drive the core to 90°C |
| Rump Roast | target 57 → **56°C** | core can't exceed the 56°C bath |
| Kebab (ground) | sous-vide 1h → **2–3h** | P3: 1h can't pasteurize a thick ground log (Baldwin) |
| Hamburger (ground) | sous-vide 1.5h → **2.5h** | P3: pasteurize a 55°C medium-rare burger |
| Sausages (ground) | target 70 → **71°C** | ground-meat floor (USDA 160°F) |
| Pork Shoulder | target 98 → **95°C** | AmazingRibs pulled-pork 203°F |
| Marrow Bones | smoke-only 120°C/1.5h → **150°C/40min** | low/slow renders marrow out before browning |
| Beef Pastrami | sous-vide 12h → **24–36h**; smoke-only → 107°C/6–8h | cured brisket needs long collagen breakdown |

## 🟡 4. Seafood — real sous-vide values added (were 0)
Shellfish/fish that had **no sous-vide step** now have cited temps (ChefSteps/Serious Eats/Kenji):
Jumbo Shrimp 57°C, Black Tiger 57°C, Prawns 54°C, Scallops 50°C, Lobster Tail 54°C, Whole Lobster
60°C, Langoustine 50°C, Octopus 77°C/5h, Squid 59°C, Tuna 45°C (rare), Swordfish 54°C, Halibut 52°C.
Bivalves (mussels/clams/oysters) & crab correctly kept **no sous-vide** (steam/live-fire only).

## 🟢 5. Other confirmed value tweaks (APPLIED)
Brisket & Beef Back Ribs target →95°C (AmazingRibs 203°F) · Oxtail 79°C/24–48h · Tomahawk sv 2–3h ·
Chicken Breast 63→65°C (Meathead) · Beets 85→90°C (starchy root) · Artichoke sv →2h · Whole Garlic
smoke 110°C/2h · pork/lamb smoke-only temps normalized to 107–110°C · Turkey Jerky cure "+Cure #1"
recommended · Smoked Fior di Latte 28→25°C (softest cheese).

## 6. NEW: grill numbers on every item
Each grillable cut now has a grill temperature, time, and zone technique (direct / two-zone /
reverse-sear) with a source. Long-cook collagen cuts (brisket, shoulder, shank, oxtail…) are marked
**"לא מומלץ לגריל ישיר"** rather than given a fabricated number.

## 7. NEW: order-effect (sous-vide ↔ smoke) data
The two orders differ materially and are stored per eligible cut: **sv→smoke** = hot brief finish
(e.g. 120°C, no smoke ring); **smoke→sv** = cool smoke on raw meat for a smoke ring, then the bath
pasteurizes. Reverse order is offered **only** for intact whole-muscle cuts with cited pasteurization
data (enforced by a test); never for ground meat or thin cuts.

---

## Reviewed & intentionally NOT applied
- 8 spec `safe` cook-temps (jerky/bacon/sausage) — captured in each item's source note; the numeric
  field wasn't added (specials don't display it). Can add if you want them for completeness.
- Cheese wood-option drops (Blue Cheese, Oregon Blue, Stilton) — kept the original fuller options.
- A halloumi typo and a Hebrew spelling variant an agent introduced — rejected.
- Kabanos cure (spec): agent suggested Cure #2→#1, but the app models the **dried** version →
  Cure #2 is correct and safer. Kept.

## Files changed
- `data.py` — cut/special value corrections (in place).
- `sources.py` — **auto-generated** citations + order-effect + grill + make calc-overrides (merged at build).
- `gen_sources.py` — regenerates `sources.py` from `scratch/research/*.json` + reports changes.
- `build.py` — source panel (📚) in cut/special/make views; grill display; sources merge; portable output path; v147 stamp.
- `docs/sources/` — Baldwin backbone + research protocol. `tests/` — Playwright suite.

## Definition of Done
- [x] All 279 items sourced or explicitly UNVERIFIED (0 UNVERIFIED)
- [x] Values corrected per primary sources (no general formula)
- [x] Order-effect implemented in data + enforced by a test
- [x] No safety number guessed — all cited (or, for Nem Chua, surfaced for your decision)
- [x] Source panel live in-app with clickable links
- [x] Playwright suite green (8/8); `python build.py` + `node --check` clean
- [x] v147 packaged (`index.html`)
- [ ] **Your sign-off** + Nem Chua decision → then manual Netlify upload of `index.html` + `site/`
