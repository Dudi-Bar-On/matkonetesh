# W1-E — Food Science & Data Audit

**Scope:** `data.py`, `sources.py`, `equipment_map.py`, `sausages_new.py`, `descriptions.py`,
`docs/sources/baldwin-backbone.md`, `docs/analysis/2026-07-21-nitrite-dosing-threshold.md`, and the
safety-bearing paths in `app.js` (`bcheck`, `safe`, `svt`/`smt`, `pasteur`, cure/nitrite, `safetyDiff`,
`itemStages`, `cureScaleGuardHTML`).

**Method:** every quantitative claim below was checked by loading the actual Python data structures
(`python -c "from data import CUTS..."`) and by reading `app.js` at the cited line numbers — not by
reading prior analysis documents' conclusions. Where a prior document's conclusion was re-tested and
disproved, that is stated explicitly, including two near-misses of my own that I verified away before
writing them down (see §2.4).

---

## 0. Verdict summary

| Question | Answer |
|---|---|
| Is the citation chain (baldwin-backbone.md's "never guess" rule) real? | **Yes, at coverage level.** 130/130 cuts, 47/47 specials, 102/102 makes carry a merged `src` block (279 top-level blocks total, matching the brief's figure exactly). A prior auditor's claim of "0 citations" was **false** — it greped only `data.py`, missing that `sources.py` merges in at build time (`build.py:84-105`). |
| Does the content of those citations hold up? | **Mostly yes**, with one confirmed, unresolved, self-flagged contradiction (Kabanos, §2.2) and a systemic-but-defused footgun (32 stale `calc` overrides in `MAKE_SOURCES` that `build.py` deliberately ignores, §2.3). |
| Is `bcheck`/`safe` a real HACCP control? | **No — it is a critical-limit *display*, not a *control*.** No verification is recorded, nothing blocks progression, and there is no corrective-action path. Same pattern as the (already-known) advisory-only cure-scale guard. See §1. |
| Any unsupported science claims found? | **None disproved.** Every `safe` value sampled traces to USDA FSIS's standard safe-minimum-internal-temperature chart or to Baldwin's pasteurization tables, correctly applied per category (whole-muscle vs. ground vs. poultry vs. fish). One low-confidence area: `safe` for foie gras/veal-brain/sweetbreads is sourced to culinary blogs, not a food-safety authority (§3.3). |

---

## 1. HACCP mapping (Mission 1)

Mapping the brief's framing onto what's actually implemented:

| HACCP concept | App mechanism | State |
|---|---|---|
| Hazard identification | `sources.py`'s per-item `safe`/`cure` research notes | Done, off-line (build-time research), not runtime |
| Critical Control Point | `kind:'bcheck'` stage, emitted by `itemStages()` for every item with a numeric `safe`/`tgt` (`app.js:3260-3261`) | **Identified, not controlled** — see below |
| Critical limit | The `safe` field (e.g. 63/71/74°C) | **Displayed, not enforced** |
| Monitoring | The bcheck task text: "🌡️ Internal temp check — target N°" (`app.js:5815`, `app.js:5993`) | Text reminder only — **no field to record the measured value** |
| Verification | — | **Absent.** No confirmation step, no logged reading |
| Corrective action | — | **Absent.** Nothing happens if the user proceeds without checking |
| Preventive control (cure dosing) | `cureScaleGuardHTML()` (`app.js:1849-1874`), thresholds from `nitrite-dosing-threshold.md` (5×d hard / 20×d advisory) | **Advisory only.** Warning text literally says "risking... botulism risk" but a prior audit (`docs/analysis/2026-07-22-audit-research-safety.md` S1, independently re-confirmed here) found the computed cure dose is byte-identical whether or not the guard fires — no button is disabled, no save is blocked |
| Structural invariant | `safetyDiff(before, after)` (`app.js:3039-3052`) | **Real, enforced** — but it guards a different hazard: it stops the *scheduling/placement* layer from silently altering a stage's `kind`/`temp`/`safe` after the fact. It does not gate whether a cook proceeds without verification |

**Verdict:** the architecture has the *shape* of HACCP (hazard→limit→monitor→verify) but only the first
two links are built. `bcheck` functions as a **checklist item**, not a control point — nothing prevents a
user from tapping past it, and no reading is ever captured, so there is nothing to verify or act on. This
matches the pattern already found for cure dosing (advisory, non-blocking) and appears to be a deliberate,
consistent product choice (the app's role is "informed cook," not an automated safety interlock) rather
than an oversight — but it means the two HACCP components with directly life-safety consequences
(pathogen kill temp, nitrite dose) are both advisory-only in the current build.

One genuinely strong point: `safetyDiff()` is a *runtime* invariant (not just a test), and the code comment
at `app.js:3033-3038` states the rule explicitly: nothing in the plan/placement layer may shorten a cook,
alter a temperature, or touch a bcheck gate. That is real engineering discipline, just scoped to a
different failure mode (schedule corruption) than "did the user actually check the temperature."

---

## 2. Citation chain (Mission 2)

### 2.1 Coverage — verified by executing the actual merge

`build.py:84-105` does:
```python
from sources import CUT_SOURCES, SPEC_SOURCES, MAKE_SOURCES
for _c in CUTS:      _src = CUT_SOURCES.get(_c["n"]);  if _src: _c.update(_src)
for _sp in SPECIALS: _src = SPEC_SOURCES.get(_sp["n"]); if _src: _sp.update(_src)
for _mid, _src in MAKE_SOURCES.items():
    if _mid not in MAKES: continue
    for _k, _v in _src.items():
        if _k == "calc": continue   # deliberately skipped — see §2.3
        MAKES[_mid][_k] = _v
```
Reproducing this exactly (including `MAKES.update(NEW_SAUSAGES)` from `sausages_new.py`, which `build.py:26-29`
runs *before* the sources merge — my first pass missed this and produced a false "52 orphaned citations"
result that a second, corrected pass disproved, see §2.4):

- `CUT_SOURCES`: **130/130** cuts covered, keyed by numeric `n`.
- `SPEC_SOURCES`: **47/47** specials covered.
- `MAKE_SOURCES`: **102/102** makes covered (50 from `data.py`'s own `MAKES` + 52 from `sausages_new.py`'s
  `NEW_SAUSAGES`, both present in `MAKE_SOURCES`).
- **130 + 47 + 102 = 279** top-level `src` blocks — exactly the figure in the mission brief.
- Every one of the 130 cuts carries a `safe` sub-citation specifically. 33/47 specials lack a `safe`
  sub-citation, but this is **not a gap**: those 33 are all cold-smoked/aged cheeses (spec `n=15..47`),
  which have no `safe` field in `data.py` in the first place (cheese isn't pathogen-kill-temperature gated
  the same way meat is) — `.get('safe')` correctly returns `None` for a field that was never meant to exist.

**The prior claim of "0 citations, S3 NOT DONE"** (`docs/analysis/2026-07-22-audit-research-safety.md:21`)
is **false**. It ran `grep -c '\bsrc\b' data.py` — which is right that `data.py` itself carries no `src` key
literally — but missed that the merge happens at build time from a separate file. This is the exact false
alarm the mission brief warned about, and I can now confirm concretely which document produced it and why.

### 2.2 A real, unresolved contradiction — Kabanos (`spec-10`)

Searching all of `sources.py` for self-flagged discrepancies (`WRONG|incorrect|should be|mismatch|
inconsistent|contradicts`) turns up exactly one unresolved case (`sources.py:3353`):

> `"cure": {"note": "FLAG: current says 'fermentation culture + Cure #2' — WRONG per Marianski. Authoritative
> kabanosy is NOT fermented: cure with Cure #1 (2.5 g/kg = 156 ppm nitrite), hot-smoke then bake to internal
> 68-71°C (154-160°F), then OPTIONALLY semi-dry. Cooked product → Cure #1, not Cure #2... Only a raw,
> uncooked, purely air-dried variant would need Cure #2 — not this cooked recipe."}`

This citation is genuinely correct and well-sourced (meatsandsausages.com/Marianski). But **the flagged
value was never fixed**:
- `data.py:152` — SPECIALS row 10 still reads `cure="תרבית התססה + Cure #2"` (fermentation culture + Cure #2).
- `data.py:490` (`sausage_dry(...)`) and `data.py:524` (`setcalc("spec-10", ..., cure="2", ...)`) — the
  actual calculator still uses Cure #2.
- The recipe as modeled has **no cook/bake step at all** — `smt=50` (warm smoke only) then
  `age="5-10 ימים (ירידה 30-35%)"` (5-10 days drying to 30-35% weight loss), i.e. it is built as a raw,
  fermented, dry-cured product, not the cooked-then-optionally-dried product the citation says is
  authoritative.

I did **not** find a second, independent citation confirming the raw/fermented pathway is a legitimate
alternate style of kabanos worth keeping as-is — the app's own bundled research says the current recipe is
wrong and was never corrected. Whether the fix is "switch to Cure #1 + add a cook step" or "keep Cure #2 but
document this as a deliberately non-traditional, longer-fermented variant with its own validated pH/Aw
target" is a product decision, but as shipped, the item has **no explicit safety floor at all** (`tgt="—"`,
no `safe` field for SPECIALS) and its own citation says the cure type doesn't match the process it's paired
with. This is the one item in the audited corpus where I'd call the safety modeling genuinely incomplete
rather than merely under-explained.

### 2.3 A systemic footgun that is already defused — `calc` overrides in `MAKE_SOURCES`

`build.py:96-102` explicitly skips the `calc` key when merging `MAKE_SOURCES` into `MAKES`, with a comment
explaining why: an earlier version of the merge let a "stale numeric `cure` (2.5) [...] clobber the type."
I confirmed this is not a hypothetical: **32 of 102** `MAKE_SOURCES` entries carry a `calc` override where
`cure` is the bare number `2.5` (e.g. `m-nduja: {"salt": 26, "cure": 2.5}`) instead of the type string `'1'`
or `'2'` that `MAKES[id]["calc"]["cure"]` actually needs (`app.js:8533-8534` treats `cure:'1'` vs `cure:'2'`
as the type discriminator). Had these been merged, `cure` would have silently become a truthy number that
compares unequal to both `'1'` and `'2'`, breaking the cure-type-driven logic across a third of the
"make-from-scratch" catalog. **This is currently a non-issue only because `build.py:96-98` skips it** — it
is load-bearing, not vestigial.

One of these 32 (`m-nduja`) also carries a note (`sources.py`) claiming *"CRITICAL GAP: current cure=None on
a raw, fermented, weeks-aged spreadable Calabrian salami = botulism/Listeria risk."* I traced this to be
**stale/incorrect**, not a live defect: `data.py:668` builds nduja via `sausage_dry(...)`, whose body
(`data.py:397-413`) **hardcodes** `calc=dict(salt=28, cure='2', cureRate=2.5, ...)` for every dry-sausage
product regardless of the display-label string passed in. The shipped `calc.cure` for nduja is `'2'` at
2.5 g/kg (156 ppm) — correct for a raw fermented dry sausage, not `None`. The auto-generated research note
appears to have inspected the wrong thing (likely the literal `cure` label string at the call site, not the
helper's hardcoded return value) and its "CRITICAL GAP" is not real. I flag this mainly as a documentation
hazard: this exact stale note is exactly the kind of thing that could cause a future reader — human or AI —
to "fix" a non-problem by applying the source's own bad `calc` suggestion, which is precisely the bug
`build.py`'s skip-guard was written to prevent.

### 2.4 Two near-misses I ruled out before writing them down

In the interest of the "evidence or it doesn't exist" rule: two apparent findings from my own first pass
turned out to be artifacts of an incomplete build-pipeline simulation, and are **not** included as findings
above:
- "52 of 102 MAKE_SOURCES entries are orphaned" — false; caused by not calling `MAKES.update(NEW_SAUSAGES)`
  before checking coverage. Once replicated correctly, coverage is 102/102.
- "33 specials lack a safety citation" — true as a raw fact but not a gap; those items (cheeses) have no
  `safe` field to cite in the first place.

---

## 3. Science check (Mission 3)

### 3.1 `safe` floors sampled against USDA FSIS's safe-minimum-internal-temperature chart

Grouping all 130 `CUTS` by category and `safe` value (`python -c "from data import CUTS..."`):

| Category | `safe` values found | USDA FSIS standard | Match |
|---|---|---|---|
| Beef/lamb/pork (whole muscle) | 63°C | 145°F = 62.8°C | ✓ |
| Poultry (chicken/turkey/goose/duck) | 74°C | 165°F = 73.9°C | ✓ |
| Ground meat (kebab, hamburger) | 71°C | 160°F = 71.1°C | ✓ |
| Fish | 63°C | 145°F = 62.8°C | ✓ |
| Shellfish | 63°C | FDA: cook until opaque/145°F | ✓ |
| Vegetables/fruit | 0°C (no floor) | N/A — no pathogen floor applies | ✓ |

All "outliers" from a pure by-category grouping resolve correctly on inspection: ground beef/kebab at 71°C
vs. whole-muscle beef at 63°C is the *correct* USDA distinction (grinding distributes surface pathogens
throughout the mass), not a data error.

### 3.2 Ground-meat pasteurization-by-time — correctly modeled, not just labeled

For Kebab (`data.py` n=17, `svt=55, svh="2-3"`) and Hamburger (n=18, `svt=55, svh="2.5"`), `safe` stays at
71°C (the instant-kill floor) even though these items are served at 55-65°C. The citations
(`sources.py`, cut 17/18 `sv` sub-block) correctly invoke Douglas Baldwin's distinct **ground-meat-as-slab**
pasteurization table (not the whole-muscle table) — "Baldwin treats ground as slab: 55C 20mm=2.5h... Hold
>=2h after core reaches 55C" — and the hold times in `data.py` (2-3h, 2.5h) meet or exceed that. For
Hamburger specifically, the citation shows the researched value **corrected an existing under-hold** (from
1.5h to 2.5h — "P3 GROUND: 1.5h->2.5h"), and `data.py:23` now reads `svh="2.5"`, confirming the fix was
actually applied to this item (unlike Kabanos, §2.2). This is the single most technically careful piece of
the whole corpus: it correctly distinguishes "ground meat needs the *whole* pasteurization time-at-temp
because pathogens aren't confined to the surface" from the whole-muscle case, and does not silently reuse
the whole-muscle table.

### 3.3 Nitrite dosing — matches an independently well-sourced derivation

`data.py`'s cure defaults (`app.js:8533-8534`: cooked `cureRate:2.5` Cure #1, dried `cureRate:2.5` Cure #2)
both land on 156 ppm ingoing nitrite, which `docs/analysis/2026-07-21-nitrite-dosing-threshold.md` (already
sourced to 9 CFR 424.21, EU 2023/2108, and PMC6043430) independently confirms is exactly the USDA comminuted
maximum and squarely inside the microbiologically-effective range (72-150 ppm per the cited PMC review).
Bacon specifically uses a *lower*, bacon-specific rate: `bacon()` helper (`data.py:415-428`) hardcodes
"Cure #1 ~2.0 g/kg (≈120ppm ניטריט — תקן USDA לבייקון)" — this matches 9 CFR 424.22(b)'s bacon-specific
120 ppm mandate exactly, correctly distinguished from the general 156 ppm rate used elsewhere. This is a
level of regulatory precision I did not expect to find and could not fault.

### 3.4 Lower-confidence area: `safe` sourced to culinary blogs, not food-safety authorities

Offal items served as delicacies below the general organ-meat floor cite non-regulatory sources for their
`safe` value:
- Goose Liver (`n=74`, `safe=65`): cited to ChefSteps' foie gras torchon page — "foie gras is traditionally
  served mi-cuit BELOW the 71°C organ floor... floor kept at its served temp 65°C."
- Veal Brain (`n=80`, `safe=65`): cited to offallygoodcooking.com — "brains poached just below simmer to
  custardy set (~65°C)."
- Veal/Lamb Sweetbreads (`n=75,76`, `safe=65`): cited to AmazingFoodMadeEasy's sweetbreads guide.

These are all *below* the app's own general poultry/organ-meat guidance (74°C, cited elsewhere to
`ask.usda.gov`'s organ-meat safety article). This may be defensible as recognized culinary practice (foie
gras mi-cuit and poached sweetbreads/brains are established preparations, generally lower-volume/
higher-provenance product), but the `safe` field here functions as a policy-set floor sourced to a recipe
blog rather than a food-safety authority, which is a materially weaker citation than the rest of the
corpus. I am not asserting this is unsafe — I don't have a primary source either confirming or contradicting
a 65°C floor for these specific tissues — I'm flagging that the citation quality here is inconsistent with
baldwin-backbone.md's stated standard, and it is the one place the app trades a lower confidence bar for
culinary authenticity.

### 3.5 Fish parasite risk (Anisakis) — real, cited, and actually surfaced to the user

Fish served rare/low-temp (Salmon 50°C, Trout 50°C, Tuna 45°C, Halibut 52°C, Swordfish 54°C) are explicitly
flagged in their citations as below the pasteurization floor (e.g. cut 125/Tuna: "center is not pasteurized...
use sushi/sashimi-grade, parasite-frozen"). I confirmed this is not citation-only dead information — it
reaches the user through at least four separate paths: the fish-category prep step
(`app.js:1381`, "⚠ use sushi-grade fish or fish frozen (-20°C, 7 days)"), the bcheck note for fish items
(`app.js:1388`), the troubleshooting FAQ (`app.js:3823-3824`, matching FDA's own -20°C/7d or -35°C/15h
freeze rule), and an AI-tooltip regex that explicitly matches "טונה" (tuna) among other fish
(`app.js:4089`). This is a genuine, well-designed hazard communication for a risk the numeric `safe` field
cannot express (freezing, not cooking, is the control).

---

## 4. Technique coverage (Mission 4)

- **Sous-vide**: core temp bands, pasteurization-by-time (including the ground-meat distinction, §3.2),
  the "come-up time" caveat (`app.js:3254-3256`, added so a thick item's pasteurization clock isn't started
  before the core actually reaches bath temp), and danger-zone-adjacent low-temp fish handling (§3.5) are
  all present and generally well-modeled.
- **Smoking**: cold-smoke (≤30°C, cheese) vs. hot-smoke distinction is consistently applied and matches the
  glossary's own stated definitions (`data.py:201-202`). The 3-2-1 method and "the Stall"/Texas Crutch are
  documented in the glossary (`data.py:198,200`).
- **Curing/charcuterie**: pH (≤5.3 dry / 4.6-5.2 semi-dry) and water-activity (~0.85 via 30-40% weight loss)
  are named as the "first safety barrier" for dry sausage in the glossary (`data.py:231,233`) and echoed in
  `sausage_dry()`'s generated phase text (`data.py:408,410`) — case-hardening avoidance (periodic
  ventilation) is also modeled (`data.py:410`). This is a reasonably complete mental model of dry-sausage
  safety for a consumer app, short of instructing the user to actually measure pH/Aw with equipment (the
  materials list does include a pH meter and hygrometer, `data.py:401`).
- **Grilling**: handled as a `combo` stage or standalone method; direct/indirect zoning appears in citation
  data (`grz` field, e.g. "עקיף→ישיר") but I did not verify this is fully wired into the schedule UI —
  out of my scope (see W1's UI/scheduling axes).
- **Gap found**: Kabanos (§2.2) is the one item where the technique model (raw fermented dry sausage) and
  the cited authoritative technique (cooked, hot-smoked-then-baked) genuinely diverge, with no cook step and
  no explicit safety floor in the shipped recipe.
- **Not evaluated**: I did not independently verify grill-zone temperatures, wood-pairing choices, or
  doneness/texture targets against literature beyond the `safe`/pasteurization axis — those are craft
  judgment calls, not safety claims, and outside what I can verify against a primary source.

---

## 5. Data integrity (Mission 5)

Checked programmatically against the actual loaded `CUTS`/`SPECIALS`/`MAKES` (not by inspection alone):

- **IDs**: 130 unique cut IDs, 47 unique special IDs — no duplicates or gaps.
- **Numeric ranges**: `kg` (weight), `svt`/`smt` (temperatures) all fall within plausible bounds
  (0 < kg ≤ 10, 0 ≤ svt/smt ≤ 300°C) for every cut — no negative, zero, or absurd values found.
- **`saved` (smoker-time-saved) vs. `svh`**: no cut claims to save more time than its own sous-vide hold
  takes — internally consistent.
- **Equipment coverage**: `equipment_map.apply()` (`equipment_map.py`) tags all 130+47+MAKES recipes with
  exactly **one** uncovered item — Halloumi (a direct-grill cheese with no smoker/sous-vide step), which is
  correct, not a bug.
- **`tgt` < `safe` for 36 cuts**: initially flagged as a possible integrity issue, but this is the *intended*
  sous-vide pasteurization-by-time model (interior sterile in intact whole muscle; texture target can sit
  below the instant-kill floor because time compensates for temperature) — the app's own glossary documents
  this explicitly (`data.py:228`, "Safety is time×temp at the core, not just the number"). The two ground-meat
  members of this set (Kebab, Hamburger) were separately verified in §3.2 to have a real pasteurization-time
  citation backing the lower serve temp, not just an assumption.
- **Cure-type consistency**: `data.py`'s dry-sausage helper (`sausage_dry()`) and bacon helper (`bacon()`)
  apply consistent, category-correct cure types/rates across the whole corpus **except** Kabanos (§2.2).

No other outliers, impossible values, or internal contradictions were found in the sampled data.

---

## 6. Honest limitations of this audit

- I sampled widely (every category of `CUTS`, the full jerky/bacon/smoked-sausage/dry-sausage/cheese range
  of `SPECIALS`, and a cross-section of `MAKES` including world-sausage-catalog entries) but did not
  individually verify all 279 citations against their live URLs — I verified the *structure* (100% merge
  coverage) exhaustively and the *content* of roughly 40 citations by close reading against known primary
  literature (USDA FSIS safe-temp chart, 9 CFR 424.21/424.22, Baldwin's pasteurization tables, the PMC
  nitrite review already vetted in `nitrite-dosing-threshold.md`).
- I did not re-fetch any external URL in `sources.py` — verification was against my own knowledge of the
  cited primary sources (USDA/FSIS temperature charts, CFR text, Baldwin's published tables) cross-checked
  against the already-thoroughly-sourced `nitrite-dosing-threshold.md`, not a live web fetch of every link.
  Where I was not confident a claim was correct (§3.4), I said so rather than asserting either way.
- Grill-zone, wood-pairing, and pure-texture/doneness claims are craft judgment, not safety claims, and were
  not fact-checked against literature.
