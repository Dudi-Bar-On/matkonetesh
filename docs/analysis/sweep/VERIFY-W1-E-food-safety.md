# VERIFY — W1-E Food Science & Data Audit (adversarial)

**Verifier posture:** every substantive claim in `W1-E-food-safety.md` was attacked, not accepted. Data
claims were re-derived by replicating the *build pipeline* (`data.py` + `sausages_new.py` +
`sources.py` merge per `build.py:26-105`), not by grepping one source file. `app.js` claims were checked
at the cited line numbers and then followed to their real consumers. Two external sources were re-fetched
live.

**Tally: 16 CONFIRMED · 9 REFUTED · 1 UNVERIFIABLE**

Scripts used (scratchpad, not committed):
`verify1.py` (merge replication), `verify3.py` (calc overrides), `verify4.py` (integrity/ranges).

---

## REFUTED (9)

### R1 — §2.3: "**32 of 102** MAKE_SOURCES entries carry a `calc` override where `cure` is the bare number `2.5`"
**False as stated.** 32 entries carry a `calc` key, but only **19** have `cure: 2.5`. The other **13** have
`cure: None` — all of them `n-*` ids from `sausages_new.py`:
`n-chorizo-esp, n-csabai, n-finocchiona, n-fuet, n-kabanos, n-krakowska-pod, n-kulen, n-landjager,
n-milano, n-pepperoni, n-salchichon, n-sremska, n-teewurst`.
Evidence: replicated merge over `sources.MAKE_SOURCES` — `len([k for k,v in MAKE_SOURCES.items() if 'calc' in v]) == 32`,
of which `cure == 2.5` is 19.
The *conclusion* survives and is arguably stronger: merging `cure: None` would make `if(calc.cure)`
(`app.js:1918`) falsy and delete the entire cure line, dose and warning — a worse failure than the 2.5 case.
`build.py:96-102` remains load-bearing.

### R2 — §2.3: "**One** of these 32 (`m-nduja`) also carries a note claiming *CRITICAL GAP*"
**False.** **Five** entries carry a `CRITICAL GAP … cure=None … botulism/Listeria risk` note:
`m-cacc`, `m-nduja`, `m-sauci`, `m-sopr`, `m-sucuk` (all in the `src.cure` sub-block).
All five are equally stale for the same reason the report gives for nduja: all five ship
`build.calc == {'salt':28,'cure':'2','cureRate':2.5,…}` because `sausage_dry()` hardcodes it
(`data.py:400`). The documentation hazard the report flags is therefore 5× larger than reported.

### R3 — §3.3: "156 ppm … squarely inside the microbiologically-effective range (**72-150 ppm** per the cited PMC review)"
**Self-contradictory: 156 > 150.** Re-fetched PMC6043430 live; the review says verbatim:
> "They found that *C. botulinum* did not grow in the presence of **72 to 150 ppm** nitrite irrespective of
> pH, levels of sodium chloride, levels of sodium lactate, or temperature."

156 ppm sits **above** the top of that band, not inside it. The defensible statement is the one the app's
own doc makes (`docs/analysis/2026-07-21-nitrite-dosing-threshold.md:45,129`): 156 ppm is the USDA
comminuted ingoing **maximum**, with the 200 ppm finished-product ceiling above it. Nothing here suggests
the dose is unsafe — only that the report's stated justification does not hold arithmetically.

### R4 — §3.3: bacon at ~2.0 g/kg "matches **9 CFR 424.22(b)'s bacon-specific 120 ppm mandate exactly**"
**Wrong regulation for this recipe.** Re-fetched 9 CFR 424.22 (Cornell LII) — paragraph (b) is
method-specific:
- pumped/massaged bacon: "sodium nitrite **shall be used at 120 ppm ingoing**" (a *required* level)
- immersion-cured bacon: "shall **not exceed 120 ppm** ingoing" (a maximum)
- **dry-cured bacon: "shall not exceed 200 ppm ingoing"** (a maximum; no minimum stated)

`bacon()` at `data.py:415-428` is unambiguously a **dry** cure — phase 1 is
`"1 · כבישה יבשה (equilibrium)"`, rubbed on and vacuum-sealed, `data.py:421-422`. The governing clause is
therefore the 200 ppm dry-cure ceiling. 120 ppm is legal and conservative there, but it is not "the mandate,
exactly" — the mandate cited applies to a production method the app does not model.

### R5 — §1 (HACCP table, "Verification"): "**Absent.** No confirmation step, no logged reading"
**Half false.** Every Work-Plan task row — **including `bcheck`** — renders a checkbox whose state is
**persisted across rebuilds** under `wpck:<scope>:<label>`:
- render: `app.js:5940` — `<label class="wp-row wp-${tk.kind} …"><input type="checkbox" class="wp-ck" data-wpck="…">`
- persist: `app.js:5766` — `store.set(k, cb.checked||null)`
- bcheck enters `tasks` at `app.js:5815` with `kind:'bcheck'`, so it is rendered by that same map.

That is a confirmation step, and it *is* logged (as a boolean). What is genuinely absent is a **numeric
field for the measured value** — I searched `app.js` for every `bcheck` reference (5 total: 3035, 3261,
5159-5161, 5815, 5993) and none accepts input. The correct finding is "checked off, never *recorded*",
not "no confirmation step".

### R6 — §1 (HACCP table, "Structural invariant"): `safetyDiff()` is "**Real, enforced**"
**Detected, not enforced — and not surfaced either.** `safetyDiff` (`app.js:3039-3052`) is called at
runtime exactly once (`app.js:5716`) and its output goes to a global:
```js
window._planSafetyViolations.push({key:c.m.key, violations:bad});   // app.js:5717
```
`grep -rn "_planSafetyViolations" app.js tests/` returns **three** hits: the write at 5711, the push at
5717, and `tests/safety-invariant.spec.ts:81`. **Nothing in the app reads it.** A violation in production
is recorded to a window global that only the Playwright suite ever inspects — nothing throws, nothing
blocks, nothing renders. The code comment at `app.js:5709-5710` claims it is "recorded and **surfaced**
rather than quietly shipped into a cook"; the "surfaced" half is not implemented. §1's own framing that
`safetyDiff` is the app's one "real, enforced" control is therefore overstated: it is a runtime *assertion
harness*, one step better than a test-only check, but still invisible to the cook.

### R7 — §2.1/§2.4: 33 specials lack a `safe` citation "but this is **not a gap**: those 33 … have no `safe` field in `data.py` in the first place"
**The finding is right; the stated reason is false.** **Zero of 47** specials carry a `safe` field — the
key does not exist anywhere in `SPECIALS`. Verified key union:
`['age','cat','cure','diff','eng','heb','n','note','smh','smt','tgt','wood']`.
So "has no `safe` field" cannot be what separates the 33 from the 14 that *do* carry a `src.safe`
sub-citation (n=1..14: jerky, bacon, smoked sausage, dry sausage). The real distinction is category —
all 33 are `cat="גבינה"` (n=15..47), which I confirmed item by item — and cheese genuinely has no
pathogen-kill-temperature model here. Conclusion stands; the justification the report gives for it does not.

### R8 — §5: "`saved` vs `svh`: **no cut** claims to save more time than its own sous-vide hold takes — internally consistent"
**False, twice over.**
(a) **9 cuts violate the stated invariant**: n=49 Salmon (`saved=1.5`, `svh="0.75"`), n=50 Trout (1.2 vs "0.5"),
n=106 Grilled Watermelon (0.2 vs "0.1"), and six shellfish with `svh="0"` — i.e. no sous-vide at all — yet
`saved` > 0: n=120 Blue Crab 0.51, n=121 King Crab Legs 0.68, n=122 Soft-Shell Crab 0.26, n=128 Mussels 0.85,
n=129 Clams 0.85, n=130 Oysters 0.42.
(b) **The invariant is the wrong comparison.** `saved` means *smoker* hours saved versus the smoke-only
path, not sous-vide hold: `app.js:1569` `⏱ חוסך ${c.saved}ש מעשנת`, `app.js:2092` `"Smoker saved"`, glossary
`data.py:227` "כמה זמן פעיל ליד המעשנת חוסכת שיטת הסו-ויד מול עישון בלבד". The meaningful check is
`saved ≈ soh − smh`, and that mismatches by >0.35 h on **29 of 130** cuts (e.g. n=12 Beef Pastrami:
soh=8, smh=2, saved=3.0; n=77 Chicken Gizzards: soh=4, smh=1, saved=1.0). Whether that is a defect or a
hand-tuned figure is open, but "internally consistent" is not established by the check the report ran.

### R9 — §5: numeric ranges — "no negative, **zero**, or absurd values found"
**False for `svt`.** Six cuts carry `svt=0`: n=120, 121, 122, 128, 129, 130 (Blue Crab, King Crab Legs,
Soft-Shell Crab, Mussels, Clams, Oysters) — a sentinel for "no sous-vide path", which is exactly why their
`svh` is `"0"` and why they trip R8(a). They satisfy the report's own stated bound (`0 ≤ svt ≤ 300`) while
contradicting its prose. `kg` range is 0.1–6.0 (the report's `0 < kg ≤ 10` holds); `smt` max is 240; no
`None` in `svt`/`smt`.

---

## CONFIRMED (16)

### C1 — Citation coverage: 130/130 cuts, 47/47 specials, 102/102 makes = **279** `src` blocks
Independently replicated the full pipeline (`MAKES.update(NEW_SAUSAGES)` first, per `build.py:29`, then the
`sources.py` merge per `build.py:87-103`):
```
CUTS 130  SPECIALS 47  MAKES(after new) 102  NEW_SAUSAGES 52
cuts covered 130/130 · specials covered 47/47 · makes with sources 102/102
makes WITHOUT sources: []   orphan MAKE_SOURCES keys: []
TOTAL src blocks = 279
post-merge: 130 cuts / 47 specials / 102 makes carry a 'src' key
```
The report's warning about the orphan false-positive is real and it avoided it. **130/130 cuts carry a
`src.safe` sub-citation** — also confirmed.

### C2 — The prior "0 citations / S3 NOT DONE" claim is genuinely false
`docs/analysis/2026-07-22-audit-research-safety.md:21` exists and reads exactly as quoted
(`grep -c '\bsrc\b' data.py` = **0** … "0 of 177 items"). Combined with C1, that conclusion is wrong, and
the reason is the one the report gives: the merge is at build time from a separate module. This is the
third instance of the same class of error on this project.

### C3 — `bcheck` is emitted for every item with a numeric `safe`/`tgt`
`app.js:3260-3261`: `const sc = meta.obj.safe!=null?meta.obj.safe:meta.obj.tgt;` then
`if(typeof sc==='number' && sc>0) stages.push({… kind:'bcheck', temp:sc …})`. Exactly as cited.

### C4 — `bcheck` is display-only, with no gate and no corrective-action path
Complete inventory of `bcheck` in `app.js`: 3035 (comment), 3261 (emission), 5159-5161 (voice-cook speech),
5815 (work-plan task), 5993 (timeline row). None reads a value, none blocks. The only "block" affordance in
the plan layer is time-based (`app.js:5598`, "Block when there isn't enough time"). Modulo R5, the
substance — *identified and displayed, never controlled* — holds.

### C5 — The cure-scale guard is advisory-only and the dose is byte-identical either way
Verified from the code, not from the prior audit. `cureScaleGuardHTML` occupies exactly
`app.js:1849-1874`; `hardMax=5*d`, `advMax=20*d` (`app.js:1852`), `hard = doseG<hardMax` (1854). Its three
call sites (1899, 1911, 1920) all do `g += cureScaleGuardHTML(...)` into a **separate** string that lands in
a separate node (`guard.innerHTML=g`, `app.js:1926`). The dose is computed at `app.js:1918`
(`doseG = x*(calc.cureRate||2.5)/1000`) and rendered at 1919, untouched by the guard, which receives it
read-only. Nothing is disabled or blocked. Corroborated by `tests/cure-scale-guard.spec.ts` G8 per
`2026-07-22-audit-research-safety.md:19`. The warning text does say "risking … (botulism risk)"
(`app.js:1864`, `1866`).

### C6 — Kabanos (`spec-10`) contradiction is real and unresolved
Every cited location checks out:
- `sources.py:3353` — `"FLAG: current says 'fermentation culture + Cure #2' — WRONG per Marianski … Change required."`
- `data.py:152` — `dict(n=10,…,cure="תרבית התססה + Cure #2",smt=50,smh="2-3",tgt="—",age="5-10 ימים (ירידה 30-35%)"…)`
- `data.py:490` — `BUILDS["spec-10"] = sausage_dry("חזיר רזה + שומן גב","Cure #2",…)`
- `data.py:524` — `for k in ["spec-10",…]: setcalc(k, salt=29, cure="2", sugar=3)`
- `sausage_dry()`'s 8 phases (`data.py:403-412`) contain **no cook/bake step**; phase 6 is optional **cold**
  smoke ≤25°C, which also contradicts the row's own `smt=50`.
- SPECIALS carry no `safe` key at all, and `tgt="—"` here.

One nuance the report omits: `spec-10` **does** ship a `src.safe` citation
("Cook to internal 68-71°C (154-160°F). Conservative ground-meat floor 71°C"), so the item is not
citation-silent about a floor — it simply has no numeric field, and the citation it does ship describes a
process the recipe does not implement. That sharpens rather than weakens the finding.

### C7 — The `m-nduja` "CRITICAL GAP: cure=None" note is stale, not a live defect
`data.py:668` builds nduja through `sausage_dry(...)`, and `data.py:400` hardcodes
`calc=dict(salt=28, cure='2', cureRate=2.5, …)` regardless of the label string passed in. Post-build
`MAKES['m-nduja']['build']['calc']` is `{'salt':28,'cure':'2','cureRate':2.5,…}` — Cure #2 at 156 ppm, correct
for a raw fermented dry sausage. (See R2: the same is true of four more items.)

### C8 — `'1'`/`'2'` really is the cure **type** discriminator, and 2.5 would break it
The report cites `app.js:8533-8534`; those lines are the `UMAKE_CALC` `cooked:`/`dried:` **preset rows**, not
a discriminator. The actual discriminator is `app.js:1919` (`h+=line('Cure #'+calc.cure, …)` → would render
literally "Cure #2.5") and `app.js:1922-1923`
(`calc.cure==='2' ? '⚠ dry-cured, uncooked — Cure accuracy is critical' : calc.cure==='1' ? … : ''`) — a
numeric 2.5 matches neither and **silently suppresses the dried-safety warning**, exactly as `build.py:99-100`
says. Claim confirmed at better line numbers than the ones given.

### C9 — §3.1 `safe` floors, as far as the report's own table goes
Re-derived by category from the loaded `CUTS`. The six rows in the report are accurate:
beef/lamb/pork whole-muscle 63, poultry 74, ground 71, fish 63, shellfish 63, produce 0.
**But the table is incomplete** — it silently omits 2 of the 13 categories present:
- `איברים פנימיים` (organ meats, 12 cuts): `safe ∈ {63×1, 65×4, 72×4, 74×3}`
- `נקניקיות` (sausages, 1 cut): `safe = 71`

The four cuts at **72°C** (n=72 Beef Liver, n=73 Lamb Liver, n=78 Beef Kidney, n=79 Lamb Kidney) appear
nowhere in the report. They are cited in-repo to `ask.usda.gov`'s organ-meat article ("USDA — variety/organ
meats 160°F/71°C") and sit 1°C conservative to it — defensible, but they are not "on the USDA chart" the
report compares against. §0's "every `safe` value sampled traces to USDA FSIS's standard chart" therefore
overstates the coverage actually shown.

### C10 — §3.2 ground-meat pasteurization is genuinely modeled, not just labeled
`data.py:22` Kebab `svt=55, svh="2-3", safe=71, tgt=65`; `data.py:23` Hamburger `svt=55, svh="2.5",
safe=71, tgt=55`. Citations verified verbatim: cut 17 `src.sv` = *"P3 GROUND: 1h->2-3h. Baldwin treats ground
as slab: 55C 20mm=2.5h, 25mm=2.75h to pasteurize … Hold >=2h after core reaches 55C"*; cut 18 `src.sv` =
*"P3 GROUND: 1.5h->2.5h …"*; both `src.safe` = *"GROUND floor 71C … NOT lowered"* citing the FSIS chart URL.
The correction really was applied. **Caveat:** "the hold times (2-3h, 2.5h) meet or exceed that" is true only
against the citation's `>=2h` clause. The same citation gives 20 mm @ 55 °C = 2.5 h and 25 mm = 2.75 h, and
cut 17's own note calls a 1 kg kebab log "thick" — so the **2 h low end of "2-3"** is below the thickness
figure in its own source. Worth a look; not a fabrication by the report.

### C11 — §3.3 156 ppm = the USDA comminuted ingoing maximum
`docs/analysis/2026-07-21-nitrite-dosing-threshold.md:45,49` derives it (0.25 oz × 28.3495 ÷ 45 359.2 =
156.3 ppm) and cites 9 CFR 424.21 via Cornell LII; `:129` lists it at 0% headroom.
`app.js:8533-8534` (`cooked` Cure #1 / `dried` Cure #2, both `cureRate:2.5`) and `data.py:400` all land on
2.5 g/kg. (The *characterisation* of that number as "squarely inside 72-150" is refuted at R3.)

### C12 — §3.4 offal `safe` floors are sourced to culinary blogs, verbatim
Confirmed at the exact ids: n=74 Goose Liver `safe=65` → ChefSteps foie-gras torchon; n=75 & n=76
Sweetbreads `safe=65` → amazingfoodmadeeasy.com; n=80 Veal Brain `safe=65` → offallygoodcooking.com. All
three sit below the app's own USDA-cited organ floor.
**Correction to the comparator:** the report says these are below "the app's own general poultry/organ-meat
guidance (74°C, cited to `ask.usda.gov`)". The *same* `ask.usda.gov` article is cited in-repo for the
non-poultry organ floor at **72°C** (n=72/73/78/79); the 74°C figure is the *poultry*-organ policy
(n=70 Chicken Hearts, 71 Chicken Liver, 77 Chicken Gizzards). The relevant comparator for liver/kidney is
72°C, not 74°C. The finding — inconsistent citation quality against `baldwin-backbone.md:7` ("Never guess.")
— stands.

### C13 — §3.5 Anisakis risk really does reach the user through four paths
All four line cites are exact: `app.js:1381` (fish `pellicle` prep step, "⚠ use sushi-grade fish or fish
frozen (-20°C, 7 days) for parasite safety"); `app.js:1388` (safety-check step, "(and for fish — see the
parasite note above)"); `app.js:3823-3824` (troubleshooting FAQ, "-20°C ל-7 ימים (או −35°C ל-15 שעות)" —
matches the FDA freeze rule); `app.js:4089` (AI-tooltip regex `/דג|סלמון|טונה|פורל/`). A **fifth** path the
report missed: glossary entry `data.py:230` ("טפילים בדג / Anisakis"). Low-temp `svt` values confirmed:
Salmon 50, Trout 50, Tuna 45, Halibut 52, Swordfish 54; cut 125's citation reads verbatim "center is not
pasteurized … use sushi/sashimi-grade, parasite-frozen".
Minor label correction: `app.js:1388` is the recipe card's *"Safety check"* step inside `svSteps()`, not "the
`bcheck` note" — `bcheck` is a scheduler stage kind and has no fish-specific text.

### C14 — §4 technique-coverage line cites
`app.js:3254-3256` (sous-vide come-up-time caveat injected onto every `sv` stage) ✓.
`data.py:198` 3-2-1 ✓, `:199` Texas Crutch, `:200` the Stall ✓, `:201` cold smoke ≤30° / `:202` hot smoke ✓.
`data.py:231` Aw ≈0.85 via 30-40% loss ✓, `:233` fermentation pH ≤5.3 dry / 4.6-5.2 semi-dry as
"מחסום הבטיחות הראשון" ✓, echoed in `sausage_dry()` at `data.py:408` and case-hardening/ventilation at
`data.py:410` ✓, pH meter + hygrometer in materials at `data.py:401` ✓, `data.py:228` "safety is time×temp
at the core" ✓.

### C15 — §4's open question about `grz`, now settled
The report declined to verify whether direct/indirect grill zoning is wired into the schedule UI. It is
**not**. `grz` is populated on 118/130 cuts (`ישיר` 59, `דו-אזורי` 30, `עקיף→ישיר` 19, `עקיף` 10) and has
exactly **one** consumer in the whole app — `app.js:2035`, a grill summary line
(`${c.grt}°C · ${c.grh}h · ${t(c.grz)}`). Nothing in the scheduler, plan or occupancy layer reads it.

### C16 — §5 IDs, `tgt < safe`, and equipment coverage
- Cut ids: 130 unique, contiguous 1..130, no gaps. Special ids: 47 unique, contiguous 1..47, no gaps. ✓
- `tgt < safe` on **exactly 36** cuts ✓ (and the glossary does document the model at `data.py:228`).
- Ran `equipment_map.apply(CUTS, SPECIALS, MAKES)` for real: **279 recipes tagged, `uncovered` = 1 =
  `('special', 'חלומי')`** (Halloumi). Exactly as reported.

---

## UNVERIFIABLE (1)

### U1 — The USDA FSIS safe-minimum-internal-temperature chart itself (145 °F / 160 °F / 165 °F)
Could not be re-fetched: `https://www.fsis.usda.gov/…/safe-temperature-chart` returns **HTTP 403**, and the
`foodsafety.gov` mirror returns **HTTP 403** as well. The 63/71/74 °C values and the whole-muscle-vs-ground
distinction were verified *inside the repo* (values, categories, and the citation URLs that point at that
chart), and 9 CFR 424.21/424.22 and PMC6043430 were fetched successfully — but the FSIS chart's own text
could not be re-read from source in this session. This is the same limitation the report declares in §6, and
it is stated here rather than softened into agreement.

---

## Note on scope discipline

No source file was modified. The three prior false alarms named in the sweep rules
(279 citations, `hardMax=5*d`, `lang/en.data.json` toasts) were **not** re-raised by this report and are not
re-raised here.
