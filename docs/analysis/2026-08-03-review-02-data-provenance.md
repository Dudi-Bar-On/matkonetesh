# Review 02 — Data provenance & domain-correctness audit of the shipped safety model

**Date:** 2026-08-03 · **Branch:** main · **Artefact audited:** `dist/items.json`, rebuilt from
source with `python build.py` at the start of this audit (`279 items · unconverted entries: 384`).
**Scope:** whether the shipped safety values are *right* — not whether they are *unchanged*.
**Nothing was modified.** This file is the only file written.

---

## 0 · Coverage — what I actually opened, and what I did not

Silence about what was not checked reads as coverage, so it is stated in numbers first.

**Shipped safety blocks (recounted from `dist/items.json`, not from the brief):**
`thermal` 103 · `cure` 67 · `drying` 36 · `aging` 24 · `fermentation` **20** — **250 total**, not the
245 the brief quotes. `fermentation` grew from 15 to 20 in commit `499bf5a` ("Task 1c-c"), after the
brief was written.

**Corpus artefacts opened and read (12):**

| Source | What I opened |
|---|---|
| #3 FSIS Safe Min Temp | `safe-min-temp-chart.csv` — all 11 rows |
| #4 AskUSDA variety meats | `organ-meat-temps.csv` — both rows, verbatim quotes |
| #5 FDA fish guidance | `histamine-and-parasite-tables.csv` — all rows |
| #6 9 CFR 424.21 | `extracted-text-raw.txt` around the 200 ppm sentence |
| #7 9 CFR 424.22 | `bacon-curing-formulas.csv` — all 5 formula rows |
| #8 FSIS GD-2023-0002 | `PROVENANCE.md` in full |
| #9 FSIS jerky 2014 | `PROVENANCE.md`, value-types section verbatim |
| #10 AMI 1997 | `PROVENANCE.md`, the degree-hours block verbatim |
| #11 CFIA | `PROVENANCE.md` + `extracted-text-fermented-dried-page.txt` |
| #12 21 CFR 133 | `PROVENANCE.md`, the 60-day sentence |
| #13 FDA Listeria RTE | `PROVENANCE.md`, the pH/a_w confirmation table |
| #15 Baldwin · #18 AmazingRibs | `PROVENANCE.md` in full + `SOURCE-COPY.md` greps, both |

**Corpus sources NOT opened:** #1 Food Code, #2 FSIS Appendix A, #14 EU 2023/915 PAH, #16 Tornberg,
#17 Modernist Cuisine, #19 Serious Eats. **None of these six appears as a `source_id` anywhere in
the shipped model**, so nothing shipped depends on them — but I did not verify that absence is
correct, only that it is factual.

**Item-level verification:**

| Block kind | Verified by opening the source / authored row individually | Assessed structurally (from the converter's own gate, proven on read siblings) |
|---|---|---|
| thermal 103 | **103** citation strings read; **99** value-vs-source compared against an opened corpus artefact | 4 (`source_id: null`, no corpus target to open) |
| drying 36 | **23** authored rows read line by line | 13 |
| fermentation 20 | **12** authored rows read line by line | 8 |
| cure 67 | **67** shipped blocks dumped; **7** with a `source_id` traced to the corpus folder | — |
| aging 24 | **24** (the `age` prose is one string, read for every row) | — |
| texture 288 | **288** (whole-field census, mechanical) | — |
| steps 311 | **311** trigger census; 17 `every` steps traced to their authored prose | — |

**What I did not do:** I did not drive the running UI. Every finding below is about the data
artefact and its converters. Whether a given wrong value currently reaches a screen is a question
for the UI reviewer, not answered here — but `dist/items.json` is fetched on demand by the shipped
app (`model.py:26`, Task B), so these values are shipped, not staged.

---

## 1 · Findings — value vs. cited source

### F-1 · The Baldwin attribution is wrong on 63 of 63 thermal blocks · **FALSE ALARM (mis-citation), high**

63 of 103 thermal blocks carry `source_id: 15` (Baldwin). Baldwin's own retrieved text, from
`docs/sources/corpus/15-baldwin-sous-vide/SOURCE-COPY.md`, verbatim:

> "You usually cook at 130°F (54.4°C) or higher" (general sous-vide safety floor).

and its `PROVENANCE.md` describes the tabulated range:

> `pasteurization-poultry.csv` — Table 4.1. Thickness 5–70mm × **nine temperatures (57–65°C)**, from 5°C.

**No shipped value attributed to Baldwin is a Baldwin number.** The shipped values are 63 °C, 71 °C
and 74 °C. 74 °C is above Baldwin's entire tabulated range.

Worse, **49 of the 63 citation strings name a different authority for the very number shipped**, and
the classifier (`model.py:63-99`, `_SOURCE_KEYWORDS`, `("baldwin", …)` first in the list) picks
Baldwin anyway because it matches first. Examples, verbatim from `sources.py`:

| Item | Shipped | `src.safe.ref` verbatim | Assigned | Correct target |
|---|---|---|---|---|
| `cuts:11` טומאהוק (+14 more) | 63 | `Baldwin — SV floor 54.4C; USDA 145F/63C` | 15 | **#3** — the ref says the 63 is USDA's |
| `cuts:41` חזה עוף (+16 more) | 74 | `Baldwin/USDA poultry floor` | 15 | **#3** — `all_poultry,165,73.9` |
| `cuts:18` המבורגר, `cuts:17` קבב | 71 | `USDA FSIS — ground beef 160F/71C; Baldwin (SV alt)` | 15 | **#3** — Baldwin is named as the *alternative* |
| `cuts:49` סלמון (+13 more) | 63 | `FDA cooked-fish 145°F / Baldwin fish pasteurization 55–60°C` | 15 | **#5** |
| `cuts:35/36/60` lamb | 63 | `AmazingRibs — Food Temperature Guide + Baldwin Table 5.1` | 15 | — |

The same product class splits on a keyword: `cuts:120` סרטן כחול (`FDA — cook crab until internal
145°F/63°C`) correctly resolves to **#5**, while `cuts:118` לובסטר שלם (`FDA shellfish / Baldwin`)
resolves to **#15** — identical value, identical class, different citation, purely because one
string contains the word "Baldwin".

The remaining **14** name Baldwin alone (`Baldwin — pasteurization tables`, `Baldwin poultry floor —
but intact whole-muscle exception noted`). Those are not misattributed to the wrong *authority*, but
the value still does not appear in the source: Baldwin's floor is 54.4 °C, the shipped value is 63.

**Verdict: 49 out-of-scope/wrong · 14 unverifiable. 0 confirmed correct against #15.**

### F-2 · Corpus #18 contains no temperature guide, yet 21 safety floors cite it · **FALSE ALARM (mis-citation), high**

21 thermal blocks carry `source_id: 18` from refs reading `AmazingRibs — Food Temperature Guide`.
Corpus #18's own `PROVENANCE.md` lists what it is:

> | Title | "What Causes The BBQ Stall: It's Not What You Think" · "What You Need to Know About Wood,
> Smoke, And Combustion" · (bonus) "Resting Meat: Why I Don't Believe The Hype" |
> | Rating | **D+** — "measured craft" … **Not A/B** |
> | Value-types covered | The stall mechanism … wood type → smoke intensity … combustion-stage
> temperature ranges … resting-meat juice-loss comparisons |

Its seven artefacts are the stall experiment, the wrap trial, a wood-type table, combustion stages,
wood-smoking parameters and resting data. **No Food Temperature Guide was retrieved.** A full grep of
the folder for `145` returns exactly one hit, and it is an anecdote:

> `resting-meat-data.csv:2` … "carryover raised rested steak center from 125F to 145F"

So `source_id: 18` on 21 safety floors points at a document that does not contain the value. Eleven of
those refs themselves name USDA as the origin (`AmazingRibs — Food Temperature Guide (USDA
whole-muscle pork)`, `AmazingRibs — ground-meat rule / USDA 160°F ground`), i.e. the *right* corpus
source (#3) exists and was not used.

Separately, `CLAUDE.md` states the standing rule: *"USDA/FSIS, Baldwin, 9 CFR — not blogs."* 21
thermal safety floors and 5 `cure` blocks are cited to a D+ commercial blog.

**Verdict: 21 unverifiable/wrong.**

### F-3 · Organ-meat floor does not match its own citation · **wrong, low severity, conservative direction**

`cuts:72/73/78/79` (beef & lamb liver, beef & lamb kidney) ship `instant_c: 72`, `source_id: 4`.
Corpus #4's CSV, verbatim quote of the article:

> "Organs, such as kidney, liver, stomach, tongue, and tripe, from red meats (beef, veal, pork, or
> lamb) should be cooked to a minimum internal temperature of **160 °F**"
> — `temp_f,160 · temp_c,71.1 · extraction,VERBATIM`

160 °F = 71.1 °C. The ref string itself says `USDA — variety/organ meats 160°F/71°C`. Shipped: **72**.
Scope is correct (all four organs and species are named in the source). The value is not.

**Verdict: wrong by 0.9 °C, in the safe direction. Scope correct.**

### F-4 · Four thermal floors have no source at all and are shaped exactly like cited ones · **missed honesty control, medium**

`cuts:74` כבד אווז 65 °C, `cuts:75`/`76` שקדי עגל/טלה 65 °C, `cuts:80` מוח עגל 65 °C carry
`source_id: null`. Their refs are craft prose: `Served mi-cuit (delicacy) — ChefSteps torchon`,
`Poached/seared offal — cooked through at serving temp`.

`_texture()` (`model.py:172`) gives every texture target an explicit `provenance: "cited"|"craft"`.
**`_thermal_block()` gives thermal blocks no provenance field at all.** So a 65 °C craft number for
veal brain sits in `item.safety[]` in the identical shape as a USDA floor, distinguishable only by a
`null` a consumer must think to check. `model.py:138` calls the gap out in a comment and reports it —
but the *shipped block* does not carry the distinction that `texture` does.

**Verdict: unverifiable, and encoded so it does not read as unverifiable.**

---

## 2 · Findings — scope: is the threshold applied to the class its source governs?

### F-5 · `a_w ≤ 0.85` is attached to products whose own recipe says they must not reach it · **FALSE ALARM, high**

Source #8 is titled, verbatim from its `PROVENANCE.md`:

> "FSIS Ready-to-Eat **Fermented, Salt-Cured, and Dried** Products Guideline," FSIS-GD-2023-0002
> **Value types covered:** … shelf-stability / *S. aureus* control … for fermented, salt-cured, and
> dried products including biltong and droëwors

Source #9 is narrower still and *conditional*, verbatim:

> "a water activity critical limit of **0.85 or lower** should be targeted for products stored in an
> **aerobic or oxygen containing environment**… if the product will be held in impermeable packaging
> (creating an anaerobic environment)… the water activity critical limit can be **0.91** or lower."

The model ships `aw_max: 0.85, limit_is_regulatory: true` on 36 items with no packaging condition and
no 0.91 branch. That alone is conservative. The scope failures are these five, where the item's own
authored prose states it is *not* a shelf-stable dried product:

| Item | The recipe's own words (`sausages_new.py` / `data.py`) | Why 0.85 does not govern |
|---|---|---|
| `make:n-teewurst` טווורסט | `dry="הבשל 7-10 ימים ב-15° — **נשאר רך למריחה**"` (*stays soft for spreading*); intro: *"הממרח הגרמני… רך למריחה על לחם"* | A spreadable refrigerated raw sausage. It is ripened, not dried; it never approaches a_w 0.85. |
| `make:n-nemchua` נם צ׳ואה | `dry="**התססה** 3-5 ימים בטמפ׳ חדר."` — the body is a *fermentation* instruction with no drying in it; cook: *"לזהירים — צלייה קצרה"* | A wet, high-moisture fermented sausage. **Nothing in this row describes drying at all.** |
| `make:n-krakowska-pod` קרקובסקה מיובשת | intro: *"הגרסה המיובשת-**חצי**… **בין מעושן למיובש**"*; `dry="תלה 5-7 ימים ב-14° עד קשיחות-פריסה (**איבוד ~15%**)"` | Semi-dried at a 15 % weight-loss target, explicitly for slicing firmness. Shipped block carries `weight_loss_pct_min/max: 15` **and** `aw_max: 0.85` side by side — two numbers that cannot both be true. |
| `make:n-kabanos` קבנוס | cook: *"חטיף מוכן — **נשמר שבועות בקירור**"* (*keeps weeks under refrigeration*); 30 % loss | A refrigerated product; its own text does not claim shelf stability. |
| `make:m-lapcheong` לאפ צ'ונג | phase 5: *"**אחסן במקרר/מקפיא**. לפני אכילה — אדה או טגן"* (*store refrigerated/frozen; before eating, steam or fry*) | Refrigerated and **must be cooked**. It is not an RTE shelf-stable product at all. |

**The mechanism behind all five is a single defect in the gate, and it is systemic.**
`model_process.py:295-312` (`_drying_phases`) requires a drying word (`ייבוש`/`הבשלה`) **and** a
day-word in the same phase's own label+body, and the module docstring defends this at length:

> "**Category is deliberately NOT the gate** … the phase-keyword gate gets both right for free
> because it **reads what the recipe itself states**"

But for every `SG()`-generated item — 52 of the 102 MAKES rows — the label is a **hard-coded
template**, `sausages_new.py:19`:

```python
if dry: phases.append([f"{len(phases)+1} · ייבוש/הבשלה", dry, 0])
```

The word `ייבוש` is supplied by the generator regardless of what `dry=` says. It is not read from the
recipe. For `n-teewurst` the body word is `הבשל` — not a substring of `הבשלה` — so **the template
label is the sole source of the drying word**. For `n-nemchua` the body is `התססה` (fermentation).
For `n-krakowska-pod` and `n-kabanos` the body says only `תלה` (hang). In all four the gate fired on
a string the recipe author never wrote.

**Verdict: 5 of 36 drying blocks out-of-scope, on a gate whose stated basis does not hold for half
the corpus it runs over.** The remaining 31 I read individually or by sibling (bresaola, coppa,
pancetta, guanciale, lonzino, speck, m-sopr, m-sauci, m-cacc, m-nduja, m-sucuk, p-bast, m-droe,
biltong, salami, chorizo, pepperoni, landjager, and the SG dry-cured Iberian/Italian/Balkan set) are
genuine shelf-stable dried products and correctly in scope.

### F-6 · Two scope decisions that are CORRECT, and should not be "fixed"

Both were verified against the source, not accepted on the code's word:

1. **21 CFR 133 / 60 days at 35 °F, 24 cheeses.** Corpus #12 `PROVENANCE.md` verbatim:
   > "pasteurized, the cheese is cured at a temperature of **not less than 35 °F for at least 60
   > days**" — preceded by "If the dairy ingredients used are **not** pasteurized"

   The data never states milk pasteurization. `model_process.py:506-510` ships
   `limit_check: "not-applicable"` with the reason spelled out and reports
   `aging-milk-not-authored`. **Correct, and correctly named rather than silently skipped.**

2. **CFIA 100 ppm + 2.5 % salt.** Corpus #11's artefact is literally the page
   `inspection.canada.ca/en/preventive-controls/meat/**fermented-and-dried**`, verbatim:
   > "…minimum level of **100 ppm** along with a minimum of **2.5 % of salt**."

   `model_cure.py:146` restricts the floor to `cure_type == '2'`. **Right instinct.** But see F-7.

### F-7 · `cure_type == '2'` is not the same class as "fermented and dried" · **latent FALSE ALARM, low today**

The CFIA floor is scoped to *fermented **and** dried*. `cure_type == '2'` catches ten items that are
dry-cured but **not fermented** — `sal-bresaola`, `sal-coppa`, `sal-pancetta`, `sal-guanciale`,
`sal-lonzino`, `sal-speck`, `p-bast` — and two that are not dried in the CFIA sense —
`n-teewurst` (spreadable), `n-krakowska-pod` (semi-dried). All twelve currently read `within`, so
nothing fires. It is latent, not harmless: the proxy will produce a confident regulatory breach on a
class the regulation does not govern the first time an authored salt figure drops below 2.5 %.

**Also worth knowing where the "within" comes from.** `sausages_new.py:12`:

```python
if _ctype == '2' and cat == "נקניק מיובש" and salt < 28:
    salt = 28
```

Twelve items pass the CFIA 2.5 % floor only because the generator silently raised the authored salt
(`n-krakowska-pod` 20→28, `n-landjager`/`n-sremska`/`n-csabai`/`n-teewurst` 22→28, six more 24→28,
`n-salchichon` 25→28). The recipe text the user reads is regenerated from the clamped value, so it
is internally consistent — but the regulatory verdict is being satisfied by a build-time override,
not by what the recipe author wrote.

### F-8 · Bacon is expressly carved out of the 200 ppm ceiling the model applies universally · **latent MISSED MECHANISM (false negative), medium**

`model_cure.py:54`: `NITRITE_PPM_MAX = 200  # 9 CFR 424.21(c) — general finished-product ceiling`,
applied to every cure block with a dose. 9 CFR 424.21(c), verbatim from
`06-9cfr-424-21/extracted-text-raw.txt:1409`:

> "The use of nitrites, nitrates or combination shall not result in more than **200 ppm** of nitrite,
> calculated as sodium nitrite in finished product, **except that nitrites may be used in bacon only
> in accordance with paragraph (b) of this section.**"

Corpus #7's own `bacon-curing-formulas.csv` gives paragraph (b)'s real numbers:

| Product | ppm | Cite |
|---|---|---|
| Pumped bacon, standard | **120** | 9 CFR 424.22(b)(1) |
| Pumped bacon, alt. A | **100** | (b)(1)(ii)(A) |
| Pumped bacon, alt. B (fermented) | **40-80** | (b)(1)(ii)(B) |
| Immersion cured bacon | **120** | (b)(2) |
| Dry cured bacon | 200 | (b)(3) |

`model_cure.py:51`'s comment — `SRC_9CFR_424_22 = 7  # bacon-specific ppm schedule (dry-cured bacon:
same 200 ppm ceiling)` — is true only for the last row and misleading for the other four. No bacon
item currently carries a `cure_rate_g_per_kg`, so the check never fires. **The direction matters: if
it ever fires, it fires too late — 156 ppm on pumped bacon would read `within` against 200 when the
governing figure is 120.** That is a missed breach, not a false one.

Additionally, `specials:4 בייקון חזיר` and `specials:5 בייקון בקר` carry `"source_id": 18` on their
**cure** block — a bacon curing citation resolved to a BBQ-stall blog (see F-2).

### F-9 · Degree-hours: right numbers, right class, no way to evaluate them · **MISSED MECHANISM, medium-high**

The numbers are correct. Corpus #10 `PROVENANCE.md`, verbatim:

> "Processes attaining a temperature less than 90°F before reaching pH 5.3 are limited to **1200
> degree-hours**. Processes reaching a temperature of **90°F-100°F** prior to reaching pH 5.3 are
> limited to **1000** degree-hours. Processes exceeding **100°F** before reaching pH 5.3 are limited
> to **900** degree hours."

Scope, from the same file: *"Good Manufacturing Practices for **Fermented Dry and Semi-dry Sausage
Products**"*. 18 of the 20 attachments are dry/semi-dry fermented sausages — in scope. `n-teewurst`
(spreadable) is out; `n-nemchua`/`n-saikrok` are fermented meat but not dry/semi-dry sausages —
defensible, arguably the most useful attachments in the set.

**But the fermentation block carries no fermentation temperature.** Its fields are `ph_max`,
`degree_hours_max`, `duration_h`, `limit_is_regulatory`, `source_id`, `limit_sources`. Degree-hours
is (T °F − 60) × hours; without a temperature nothing can compute it, and nothing does. The limit
ships as `limit_is_regulatory: true` with no verdict field at all — unlike `cure` and `aging`, which
both carry `limit_check`.

That is not merely incomplete. On the authored figures, two recipes appear to **exceed** the limit
now decorating them. *This arithmetic is mine, from the recipes' own stated numbers, and is not a
claim by any source:*

- `n-saikrok` — `"תלה 2-3 ימים ב-25-30°"` → 25 °C = 77 °F, 72 h → (77 − 60) × 72 ≈ **1224** > 1200.
- `n-nemchua` — `"התססה 3-5 ימים בטמפ׳ חדר"` → at 25 °C room temperature, 120 h → ≈ **2040** > 1200.

The model attaches the regulatory limit and stays silent about the recipe breaching it.

### F-10 · Jerky, biltong and cold-smoked fish ship no lethality mechanism at all · **MISSED MECHANISM, highest severity**

Corpus #9's `PROVENANCE.md` states its own second half explicitly:

> **Humidity as a lethality condition** … the document treats relative humidity during the
> cook/lethality step as a genuine critical operational parameter — **not merely a comfort setting**
> … An establishment that does NOT add or maintain humidity **must document scientific support that
> humidity is not critical** for its specific process.
> … Attachment 2: a large literature-derived table of time/temperature/humidity combinations …
> claimed to achieve **≥5-log10 reduction of *Salmonella* and *E. coli* O157:H7** in beef jerky.

What ships for `specials:1 ג'רקי בקר` and `specials:2 ג'רקי הודו`:

```json
"safety": [{"kind":"cure","cure_type":"1","source_id":9,"limit_check":"unknown"},
           {"kind":"drying","aw_max":0.85,"limit_is_regulatory":true,"source_id":9}]
```

No thermal block (`safe` is `None` in `data.py`). No lethality. No humidity. The smoke leg is
70 °C for 4-6 h. **a_w 0.85 is the shelf-stability limit; it is not the pathogen kill.** The model
attaches the shelf-stability half of source #9 and drops the half the same source insists on.

And the lethality number is *in the data and was thrown away*: turkey jerky's `tgt` field reads
literally **`"74°C ואז יבש"`** — *74 °C then dry*. `model.py:160` classifies it `tgt-nonnumeric` and
returns `None`. The one authored lethality figure in the jerky rows is discarded as unparseable
prose.

`specials:3 בילטונג` is worse: `safety` is the a_w block alone, `paths` is `{}`. Raw, unheated,
vinegar-and-salt beef with a 7-day dry and no lethality mechanism of any kind.

**The three smoked-fish items ship an empty safety array while their own prose states the control:**

```json
make:fish-lox   "safety": []
make:fish-gravlax "safety": []
make:fish-mackerel "safety": []
```

`data.py`'s `fish-lox` phase 1, verbatim:

> `1 · בטיחות טפילים || חובה דג סושי-גרייד או שהוקפא -20°C ל-7 ימים — **עישון קר אינו הורג טפילים**.`
> (*mandatory sushi-grade or frozen at −20 °C for 7 days — cold smoking does not kill parasites*)

That is an exact match for corpus #5, verbatim:
> `parasite_kill_freeze_and_store,-20,C,"Freeze and store at ambient temp of -4F(-20C) or below for
> **7 days** total time - sufficient to kill parasites"`

The right source is in the corpus, the right control is in the prose, and the structured model says
these items have **zero safety mechanisms**. Same for `fish-mackerel`, whose phase 3 states
`עד טמפ׳ פנימית 63°C` and whose thermal block does not exist.

**Verdict for F-10: 6 items (2 jerky, 1 biltong, 3 fish) where the real safety control is
unmodelled and the source that governs it is already downloaded.** This is the finding a user could
be hurt by.

Related scale: **83 of 279 items carry an empty `safety` array.** 27 of those are produce
(`ירקות` 21, `פירות` 6) where `safe == 0` correctly means not-applicable — that is right. The other
**56** are meat, fish and cheese: 32 fresh sausages (`נקניקיות`, raw ground meat), 9 cheeses,
5 שווארמה, 4 צלייה טחונה, 3 smoked fish, 3 BBQ. For the 32 fresh sausages `build.py:66` injects
`"בשל עד 71° פנים"` into the cook prose at build time — so the number exists in text and not in the
model, the same split F-10 describes.

### F-11 · Source #13 (Listeria) was retrieved for cheese gating and is used nowhere

Corpus #13's `PROVENANCE.md` says why it exists:

> the two numbers **this project actually uses for cheese `safe` gating** (pH ≤4.4, a_w ≤0.92)
> … pH ≤ 4.4 … **CONFIRMED VERBATIM** — page 4: *"The pH of the food is less than or equal to 4.4"*
> … a_w ≤ 0.92 … **CONFIRMED VERBATIM** — page 4: *"The water activity of the food is less than or
> equal to 0.92"*

`source_id: 13` appears **zero times** in `dist/items.json`. All 33 cheese items carry either an
`aging` block alone (24) or nothing (9). Cold-smoked cheese is a recognised *L. monocytogenes*
vehicle; the model asserts no control. **MISSED MECHANISM, medium** — named as a gap, not as a number
I am inventing.

---

## 3 · Findings — did the extraction read the prose correctly?

### F-12 · The three misattributed fermentation durations are still shipped — and the module docstring says they were fixed · **wrong, high (documentation contradicts artefact)**

Confirmed present in `dist/items.json` today:

| Item | Shipped `duration_h` | What the authored `dry=` string actually says |
|---|---|---|
| `make:n-chorizo-esp` | **840** (= 35 d) | `"תסס **24-48ש** ב-22°, ואז תלה **3-5 שבועות** ב-13-15° 75% לחות עד איבוד 35% משקל."` — 840 h is the *hang* time |
| `make:n-fuet` | **504** (= 21 d) | `"תסס **24ש** ב-22°, תלה **2-3 שבועות** ב-13° 80% לחות."` — 504 h is the *hang* time |
| `make:n-landjager` | **6** | Its ferment word is in `materials` only. 6 h is phase 5, `"עשן קר 25° **4-6 שעות** עם אשור"` — the **cold-smoke** duration |

`model_process.py`'s docstring, lines 101-120, states this was corrected:

> "**A pre-existing misattribution bug, found while building this correctly, fixed in the same
> pass.** … Verified in production before this fix: `n-fuet` reported `duration_h: 504` … **After the
> fix, n-fuet/n-chorizo-esp correctly report `ferment-duration-not-authored`**"

The same file, lines 435-441, says the opposite:

> "If it detects a block, that block (**duration_h included, bugs included**) is returned AS-IS. …
> including three (n-fuet/n-chorizo-esp/n-landjager) whose `duration_h` this investigation found to
> be misattributed … **Left untouched**"

The artefact agrees with the second passage. The tier-1 preservation path (`_fermentation_block_for_makes`,
line 458) short-circuits before the corrected tier-2 logic ever runs for these three. **A reader of
this module's headline docstring would conclude the defect is closed. It is not.** That is the more
dangerous half of this finding: it removes the defect from anyone's list.

### F-13 · `m-droe` is handled correctly — verified, not assumed

`data.py` `m-droe` intro, verbatim: *"…בן-דוד של בילטונג; **ללא התססה** — חומץ ותבלינים."*
(*…without fermentation — vinegar and spices*). Shipped `safety`: `cure` + `drying` only, **no
fermentation block**. `_NEGATED_FERMENT` (`model_process.py:184`) strips the negated clause before the
presence check. Drying `days: 3` traces to phase 5, `"5 · ייבוש (**1–3 ימים**)"`. **Correct.**

### F-14 · Four fermented dry sausages carry no fermentation mechanism · **MISSED MECHANISM, medium**

`_FERMENT_WORDS_MAKES` (`model_process.py:175`) is `("תרבית","תסיסה","התססה","התסס","תסס")`. It does
not contain **`סטרטר`** — the transliterated "starter", which is how four recipes name their culture:

| Item | Spice line, verbatim | Shipped blocks |
|---|---|---|
| `make:n-salchichon` | `"…מוסקט, אורגנו + **סטרטר**/ק״ג"` | `cure`, `drying` — **no fermentation** |
| `make:n-kulen` | `"פפריקה חריפה 20 ג׳ + מתוקה 10 ג׳, שום 4 ג׳ + **סטרטר**/ק״ג"` | same |
| `make:n-sremska` | `"…שום 4 ג׳, פלפל 2 ג׳ + **סטרטר**/ק״ג"` | same |
| `make:n-csabai` | `"…שום 4 ג׳, קימל 1 ג׳ + **סטרטר**/ק״ג"` | same |

All four are shelf-stable fermented dry sausages — precisely the class source #8's pH ≤ 5.3 hurdle
governs, and precisely the class whose *first* safety barrier is the pH drop, not the drying. The
model applies the drying limit and asserts no fermentation hurdle. **The product asserts a weaker
basis than reality.**

### F-15 · A duplicate dict key silently deletes a recipe · **data defect, medium**

`sausages_new.py` defines `"n-salchichon"` **twice**, at line 146 and line 230. Python keeps the
second. Measured: 53 literal `SG(` entries, 52 unique keys, `len(NEW_SAUSAGES) == 52`.

The discarded first definition carried `dry="**תסס 24-48ש**, תלה 4-6 שבועות ב-13° 75% עד 35% איבוד."`
— i.e. an explicit fermentation clause. The surviving one says `dry="תלה 5-8 שבועות ב-12° 75% עד
איבוד 33%."` with none. **The lost row is exactly why `n-salchichon` appears in F-14.** No error, no
warning, no test.

### F-16 · Range collapse: every duration ships as a point value at the top of its range

`_duration_days` / `_mk_duration_days` return `int(m.group(2) or m.group(1))` — the high end. Verified
correct against the prose in every case I read (biltong `4-7 ימים` → 7; salami `3-6 שבועות` → 42;
chorizo `3-5 שבועות` → 35; cheese `2+ שבועות` → 14; kabanos `3-5 ימים` → 5). The *number* is authored.
What is lost is that it was a range, and for cheese that `2+` meant "or more". `n-kabanos` ships
`weight_loss_pct_min: 30, weight_loss_pct_max: 30` from the authored `"~30%"` — the tilde is dropped
and an approximation is presented as an exact bound. **Low severity; noted so it is not rediscovered.**

---

## 4 · Findings — derived values, invented values, and sentinels

### F-17 · A 45-minute interval nobody authored, on 17 shipped steps · **invented value, medium**

`model_triggers.py:49-51`:

```python
if raw in _EVERY:
    return ({'action': _EVERY[raw], 'trigger': {'every': {'min': 45}},
             'source': 'legacy:' + field}, None, None)
```

`_EVERY` maps the bare strings `הפיכה` / `הפיכת עור` / `סיבוב שיפוד` — *flip*, *flip the skin*,
*rotate the skewer*. **Those strings contain no number.** 45 appears nowhere in the source field.
Confirmed in the artefact: 17 steps across 17 items, all `"source": "legacy:somid"`, all
`{"every":{"min":45}}` — `cuts:3, 9, 16, 20, 27, 28, 30, 33, 36, 39, 45, 47, 48, 60, 65, 66, 111`.

`source: "legacy:somid"` is an assertion of provenance for a value that has none. This is not a
safety threshold, but it is a guessed number wearing a provenance tag, under a plan that forbids
exactly that. `model_triggers.py:63-66` already has the correct pattern for this case
(`action-without-trigger` → reported, not invented); it simply is not used here.

### F-18 · The 0 °C sentinel survives — in a cooking leg, on shellfish · **sentinel-in-domain, medium-high**

R-82 was fixed at one site. `model.py:129-134` correctly refuses `safe == 0`:

> `if v == 0:` … *"NOT a temperature. The data layer's encoding of 'core temperature does not govern
> this item'"* → reported as `safe-not-applicable`, no block emitted.

`model_paths.py:45-50` has no such guard:

```python
if row.get("svt") is not None and row.get("smt") is not None:
    paths["c:smoke_sv"] = {"legs": {"sv": {"t": row["svt"], "h": _hours_upper(row.get("svh"))}, …
```

Six CUTS rows carry `svt: 0, svh: '0'` — the data layer's "there is no sous-vide route" encoding —
and all six ship a full `c:smoke_sv` path with `"sv": {"t": 0, "h": "0"}`:

| id | item | shipped |
|---|---|---|
| `cuts:120` | סרטן כחול | `"sv": {"t": 0, "h": "0"}` |
| `cuts:121` | רגלי סרטן מלך | same |
| `cuts:122` | סרטן רך | same |
| `cuts:128` | מולים | same |
| `cuts:129` | צדפות (קלאמס) | same |
| `cuts:130` | אויסטרים | same |

**0 °C is a valid temperature.** A consumer reading `legs.sv.t` cannot distinguish "hold at 0 °C"
from "this leg does not exist" — the exact R-82 failure mode, in a new field. It landed on the six
items least able to absorb it: raw-consumption-risk molluscan shellfish. `cuts:130`'s own citation
string reads `FDA — cook shellfish until shells open (**raw oysters carry Vibrio risk**)`.

Also present: `sugar_g_per_kg: 0` on 39 cure blocks. That one is a genuine authored zero (no sugar in
the cure) and is fine.

### F-19 · `curve` and `basis` are `null` on all 103 thermal blocks — and 36 items ship a target below their own floor · **MISSED MECHANISM, high**

Confirmed: `curve: null, basis: null, basis_ref: null` on **103/103**.

The approved spec, `docs/superpowers/specs/2026-08-03-data-model-design-v2.md`, line 66:

> `thermal` (**עקומה, לא מספר**) — *a curve, not a number*

and line 224, under what v1 settled and stands:

> `thermal כעקומה` — *thermal as a curve*

**What its absence means for correctness, not just completeness.** With no curve and no basis, the
only assertion a thermal block makes is an instant temperature. Measured against that assertion:

- **36 items** ship an item-level `texture.target_c` **below** their own `thermal.instant_c`.
- **41 path-level** texture targets do the same.

The extremes: `cuts:125` סטייק טונה target **45 °C** vs floor 63 · `cuts:48` חזה ברווז 57 vs 74 ·
`cuts:49` סלמון 52 vs 63 · `cuts:18` **המבורגר 55 vs 71** — and hamburger is ground beef, which has
no whole-muscle exemption in any source in this corpus.

The real basis for most of these is time-at-temperature equivalence — which is exactly what source
#15 (Baldwin) exists to supply, and the one thing #15 is genuinely authoritative for
(`PROVENANCE.md`: *"the thickness→time geometric model is flagged **PRIMARY, independently derived
and empirically verified**"*). The model cites Baldwin 63 times and uses none of his tables.

So the shipped state is: 36 items whose craft target sits below the only safety assertion the model
makes about them, with no mechanism expressing why that can be legitimate. **The product asserts an
instant-temperature basis it does not meet, for items whose true basis is a hold it does not model.**

### F-20 · Texture provenance is honest — verified, and larger than reported

Brief said 136. Measured: **288** texture blocks (136 item-level + 152 path-level). **All 288** carry
`provenance: "craft"` and `source_id: null`. Zero present as cited. `model.py:167-172` and
`model_paths.py:54/64/155` all hard-code `provenance` to `"craft"` unless a source resolves — and no
`tgt` ref ever resolves, because there is no `tgt` key in `sources.py` at all. **Correct. Nothing
here misrepresents craft as cited.**

### F-21 · 48 `within` verdicts cite nothing

`model_cure.py:113-118` deliberately omits `nitrite_ppm_max` and `limit_sources` from every cure
block ("shipping an identical value 60+ times with nobody reading it is exactly what
no-inert-shipment forbids"). The consequence is that 48 blocks assert `"limit_check": "within"` with
**no source_id for the limit they are within**. A verdict without its authority is not a citation.
The reasoning for omitting it is sound on bundle grounds; the honesty cost should be a named
trade-off rather than a silent one.

Separately, the module's documented `not-applicable` verdict for the CFIA floor on Cure #1 items
**never appears in the output**: 67 cure blocks are 48 `within` + 19 `unknown` + **0 not-applicable**.
`_finalize`'s precedence (lines 160-166) lets a `within` from the nitrite check absorb the
`not-applicable` from the salt check. So the scoping decision the module is proudest of is invisible
to every consumer.

---

## 5 · Ranked by what a user could actually do wrong

| # | Finding | Type | Items | What goes wrong |
|---|---|---|---|---|
| 1 | **F-10** jerky/biltong/cold-smoked fish have no lethality or parasite mechanism | MISSED | 6 | Makes jerky at 70 °C with no 5-log basis, or cold-smokes salmon without the −20 °C/7-day freeze. The controls are in the prose and in the corpus; the model says `safety: []`. |
| 2 | **F-19** `curve`/`basis` never built; 36 targets below their own floor | MISSED | 103 / 36 | Cooks a burger to 55 °C against a 71 °C floor with nothing modelling why a hold could make that safe. |
| 3 | **F-1 + F-2** 84 of 103 thermal citations point at a source that does not contain the value | mis-citation | 84 | Verifies a floor, opens the cited source, and it is not there. Every correct citation loses credibility with it. |
| 4 | **F-5** `a_w ≤ 0.85` asserted as regulatory on 5 products that must not reach it | FALSE ALARM | 5 | Dries Teewurst or Nem Chua to "meet" a limit that destroys the product — or believes a refrigerated Lap Cheong is shelf-stable. |
| 5 | **F-12** three fermentation durations still misattributed, docstring claims fixed | wrong | 3 | Ferments Fuet for 21 days instead of 24 h, believing the model. And nobody re-checks, because the module says it is closed. |
| 6 | **F-9** degree-hours attached, uncomputable, two recipes appear to exceed it | MISSED | 20 | Follows `n-saikrok`'s own 2-3 days at 25-30 °C, past the limit the model displays beside it. |
| 7 | **F-18** `sv.t = 0 °C` on six molluscan-shellfish items | sentinel | 6 | Reads a sous-vide leg that does not exist, on oysters. |
| 8 | **F-14 + F-15** four fermented sausages with no fermentation block, one recipe deleted by a duplicate key | MISSED | 4 + 1 | Skips the pH ≤ 5.3 hurdle on a salchichón/kulen/sremska/csabai — the first barrier, not the second. |
| 9 | **F-17** 45-minute flip interval invented on 17 steps | invented | 17 | Low direct harm; high precedent harm — a guessed number carrying `source: legacy:somid`. |
| 10 | **F-11** source #13 retrieved for cheese Lm gating, used nowhere | MISSED | 33 | Cold-smoked cheese with no Lm control asserted. |
| 11 | **F-8** bacon checked against 200 ppm when (b) says 120 | latent MISSED | 0 today | A future bacon dose reads `within` when it is a breach. |
| 12 | **F-4** four uncited craft floors shaped like cited ones | honesty | 4 | 65 °C for veal brain reads as a cited floor. |
| 13 | **F-3** organ meats 72 vs cited 71.1 | wrong | 4 | Negligible (conservative), but the value does not match its own citation. |
| 14 | **F-7 + F-21 + F-16** scope proxy, verdicts without authority, range collapse | latent / honesty | 12 / 48 / all | No immediate user harm; each removes a check someone will later assume ran. |

**What is right and should be protected:** the `safe == 0` guard in `_thermal_block` (F-18 shows the
lesson was learned once and not generalised) · the 21 CFR 133 not-applicable on 24 cheeses (F-6) ·
the CFIA scoping instinct (F-6) · `m-droe`'s negation guard (F-13) · texture provenance on all 288
blocks (F-20) · the classifier's refusal to guess, which produced 4 honest `null`s rather than 4
false citations (F-4).

**Nothing in this report proposes a number.** Every gap is named as a gap. Where I computed something
(the degree-hours arithmetic in F-9) it is labelled as my arithmetic on the recipe's own figures, not
as a source's claim.

---

## תקציר לבעלים

**המודל החדש מדויק בצורתו ולא-מדויק בתוכנו.** בדקתי 250 בלוקי בטיחות מול המקורות עצמם — פתחתי 12
ארטיפקטים מהקורפוס, לא הסתמכתי על תוויות.

1. **הכי חמור — מנגנון חסר, לא אזעקת שווא.** ג'רקי (2), בילטונג, ולוקס/גרבלקס/מקרל (3) נשלחים **בלי
   שום מנגנון קטלניות**. אצל הדגים `safety` הוא מערך ריק — בזמן שהמתכון עצמו כותב במפורש "חובה דג
   שהוקפא ‎-20°C ל-7 ימים — עישון קר אינו הורג טפילים", וזה בדיוק מה שמקור #5 אומר. הבקרה קיימת בטקסט
   וקיימת בקורפוס, ופשוט לא הומרה. אצל הודו-ג'רקי המספר `74°C ואז יבש` נזרק כ"טקסט לא מספרי".
2. **84 מתוך 103 ציטוטים תרמיים מפנים למסמך שהמספר לא נמצא בו.** בולדווין אומר 54.4°C — אנחנו שולחים
   63/71/74 ומייחסים לו. ב-49 מהם מחרוזת הציטוט עצמה אומרת "USDA". ו-21 ערכי בטיחות מיוחסים ל-#18
   (AmazingRibs) — שהתיקייה שלו מכילה רק מאמרי stall/עצים/מנוחה, **אין בה שום Food Temperature Guide**.
3. **‎a_w ≤ 0.85 הודבק כמגבלה רגולטורית ל-5 מוצרים שאסור להם להגיע אליה** — טווורסט ("נשאר רך
   למריחה"), נם צ׳ואה (שאין בו ייבוש בכלל), קרקובסקה מיובשת-חצי (‎15% איבוד), קבנוס, לאפ צ'ונג. הסיבה
   שיטתית: השער נשען על המילה `ייבוש` שמגיעה מ**תבנית קוד** (`sausages_new.py:19`), לא ממה שהמתכון כתב.
4. **‎`curve`/`basis` ריקים ב-103/103.** המנגנון המרכזי של המפרט המאושר לא נבנה, ולכן 36 פריטים שולחים
   יעד מרקם **מתחת** לרצפת הבטיחות של עצמם — המבורגר 55° מול 71°.
5. **שלוש שגיאות משך התססה עדיין באוויר** (‎n-fuet 504ש, n-chorizo-esp 840ש, n-landjager 6ש שהן בכלל
   זמן עישון) — **ותיעוד המודול כותב שהן תוקנו.** זה החלק המסוכן: הן ירדו מהרשימה של כולם.
6. **ה-0°C חזר.** R-82 תוקן במקום אחד; ב-`model_paths.py` אין שמירה מקבילה, ושישה פריטי צדפות/מולים/
   אויסטרים שולחים רגל סו-ויד של **0 מעלות ל-0 שעות**. סנטינל בתוך תחום הערך, על המוצרים הכי רגישים.

**זה לא ליקוי אחד — זו תבנית: המבנה נבדק, התוכן לא.** כל הוכחה עד היום הראתה ש"שום ערך לא זז"; אף
אחת לא שאלה אם הוא נכון. לא הצעתי שום מספר חלופי — פער ששמו נאמר הוא ממצא, מספר שניחשתי הוא תקלה.
