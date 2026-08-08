# R-72 — 33 smoked cheeses with no `safe` value: is there a requirement, or does the concept not apply?

**Date:** 2026-08-08 · **Register row:** R-72 · **Owner ruling invoked:** 2026-08-02, "CHECK, do not
assume" · **Status:** findings for owner decision. No application data changed.

**Answer up front:** the owner's second hypothesis is correct. **"Internal safe temperature" is not a
concept that applies to cheese**, cold-smoked or otherwise. This is not an absent value waiting to be
filled — it is the honest, source-backed answer for all 33 items. §4 explains what *does* govern safety
for this product class, and §5 gives a one-reading recommendation.

---

## 0 · Method and what was reused

Per §10.11/§10.13 this task should query the geniza first. **I could not** — this subagent instance has
no code-execution tool, so `retrieval.search_current_docs` / `semantic_search` were not callable. Stating
this plainly rather than skipping it silently (per the reporting rule). What I did instead, in order:

1. **Grepped the repo directly** and found that this exact question was already researched in depth on
   2026-08-02 (same day as the owner's ruling) in
   `docs/research/2026-08-02-cure-and-cheese-safety.md` §4, with a dedicated primary-source download
   corpus at `docs/sources/corpus/12-21cfr-133/` and `docs/sources/corpus/13-fda-listeria-rte-2017/`
   (21 CFR part 133 as XML from eCFR + PDF from govinfo.gov; FDA's 2017 Listeria guidance as the actual
   85-page PDF from fda.gov, not a summary). This is exactly the kind of primary-source, cited work
   `baldwin-backbone.md`'s discipline requires — it was not, however, ever applied back onto the current
   33-item cheese catalog or read as an answer to R-72 specifically.
2. **Independently re-verified** the load-bearing quotes against the raw extracted text files rather
   than trusting the prior doc's summary (per L16 — a hit is a lead, not a verdict). Specifically pulled:
   `extracted-text-133-3.txt` (21 CFR §133.3(d)/(e)), `extracted-parameters-PRIMARY.csv` +
   `PROVENANCE.md` for the FDA 2017 Listeria guidance, and `fda-food-code-2022-westhartford-mirror-extracted.txt`
   for Food Code §3-501.17(G). All three quotes below were found verbatim in the actual downloaded text,
   not reconstructed from memory or a blog.
3. **Read the repo's actual data**, not just the prior doc's description of it: `data.py` lines 161–193
   (the 33 cheese `dict()` records, `n=15..47`, all `cat="גבינה"`) and their matching entries in
   `sources.py` lines ~3424–3600+ (the `smoke` citations, one per item).

**No web search was needed** — the primary-source material was already downloaded, verified against
XML/PDF, and sufficient to answer R-72. I did not add anything not already cited to a primary source.

---

## 1 · What the repo currently holds for the 33 items

`data.py` cheese records (`n=15` through `n=47`) carry these keys: `cure, smt, smh, tgt, age, wood, diff,
note`. **There is no `safe` key in the dict literal at all** — not `safe=None`, not `safe=""`. The field
simply does not exist in the schema for this category, unlike every meat/poultry/fish record (`n=1..14`
etc.), which all carry `safe=<number>`. Example, meat: `dict(n=1,cat="בקר",...,safe=63,...)`. Example,
cheese: `dict(n=15,cat="גבינה",...,tgt="—",...)` — no `safe` at all.

`sources.py` carries one citation per cheese item, keyed `smoke` (not `safe`), e.g. item 15:
```
'smoke': {'ref': 'AmazingRibs / TheOnlineGrill — cold smoking cheese',
          'url': 'https://theonlinegrill.com/how-to-smoke-cheese/', ...}
```
Every one of the 33 `smoke` citations traces to `theonlinegrill.com`, `heygrillhey.com`, or
`smokedbbqsource.com` — **general-audience BBQ blogs, not primary regulatory sources.** They are cited
correctly as the source for `smt` (smoke-chamber temperature, a texture/melt-point parameter — cheese
sweats and liquefies above ~32°C/90°F), not as a safety claim. That distinction matters for §4.6 below.

**Conclusion of this section:** the "33 cheeses with no safety value" is accurate — and it is a schema
gap by design, not an oversight. The category was built without a `safe` field because none of the meat
pasteurization logic (`Baldwin — Practical Guide to Sous Vide`, `docs/sources/baldwin-backbone.md`)
applies to a fully-manufactured, shelf-stable dairy product being cold-smoked after the fact.

---

## 2 · What a smoked cheese in this catalog actually *is*

Every one of the 33 items is a **finished, store-bought or artisan-purchased cheese** — Gouda, Cheddar,
Gruyère, Brie, etc. — that the user cold-smokes (or, for item 19, hot-smokes) *after* it has already been
manufactured, pasteurized-or-aged, and sold as ready-to-eat. The user is not curdling milk, not culturing,
not aging from raw ingredients. **All of the manufacturing-stage safety controls (milk pasteurization,
raw-milk aging) already happened at the dairy, before the product reached the user — they are not
something the app's smoking instructions can or should re-govern.** This is the single fact that resolves
most of the confusion in "why doesn't this have a `safe` value like meat does."

The one process step the app *does* control is: chamber temperature and duration during smoking (`smt`,
`smh`), and post-smoke handling (`age` = rest/seal). Neither of those is a food-safety lethality step —
they are flavor/texture parameters, as `note` already says explicitly for items like #15 ("עישון קר חובה
(≤30°C) למניעת המסה" — mandatory cold smoke ≤30°C to prevent the cheese *melting*, not to prevent a
pathogen).

---

## 3 · Product classes among the 33, verified where possible

The task warned explicitly against misapplying a threshold across product classes. Checking each of the
33 individually against 21 CFR 133's ~30 named standards-of-identity was out of scope for what a single
regulatory fact can resolve — no primary source states per-SKU moisture/pH/a_w for "Aged Gouda" vs "Gouda"
as sold in this catalog. What **is** independently verified, by directly re-reading the retrieved primary
text (not the prior doc's summary):

**A. Named explicitly in FDA Food Code 2022 §3-501.17(G)(2)–(3)** (date-marking exemption for RTE
TCS food — verbatim, `fda-food-code-2022-westhartford-mirror-extracted.txt:3880-3886`, cross-confirmed in
the separate Chapter-3-only mirror):
> "(2) Hard cheeses containing not more than 39% moisture as defined in 21 CFR 133 ... such as **cheddar,
> gruyere, parmesan and reggiano, and romano**; (3) Semi-soft cheeses containing more than 39% moisture,
> but not more than 50% moisture, as defined in 21 CFR 133 ... such as **blue, edam, gorgonzola, gouda,
> and monterey jack**."

Catalog items whose *name* matches this list exactly: **Smoked Cheddar (#16), Aged Cheddar (#20),
Gruyère (#23), Parmigiano (#33)** [hard]; **Smoked Gouda (#15), Gouda (#21), Aged Gouda (#22), Edam (#27),
Blue Cheese (#39), Gorgonzola (#41), Monterey Jack (#29)** [semi-soft]. 11 SKUs. This is an "exempt from
date-marking" classification, not a safety instruction for the smoking process — see §3.C for why it
cannot be read as "these are safe, others aren't."

**B. Named explicitly in FDA's 2017 "Control of *Listeria monocytogenes* in RTE Foods" guidance**
(primary PDF fetched directly from `fda.gov/media/102633/download`, verified verbatim,
`extracted-text-PRIMARY.txt:344-346`):
> "...soft unripened cheese (**Cottage Cheese, Cream Cheese**, Ricotta), ... fresh soft cheese (Queso
> Fresco), semi-soft cheese (**Blue**, Brick, **Monterey**), soft-ripened cheese (**Brie, Camembert**,
> Feta), deli-..."

This is FDA's own list of cheese categories it classifies as **capable of supporting Listeria growth** —
the opposite kind of fact from (A)'s "exempt, low risk" list. Catalog items whose name matches exactly:
**Smoked Cream Cheese (#19), Blue Cheese (#39), Monterey Jack (#29), Brie (#45), Camembert (#46)**.
5 SKUs.

**C. The class-boundary trap the task warned about, made concrete:** **Blue Cheese (#39)** and
**Monterey Jack (#29)** appear on *both* lists above — named by FDA's own Food Code as exempt from
date-marking (a shelf-stability/low-moisture judgment) **and** named by FDA's own Listeria guidance as a
category that supports pathogen growth (a different judgment, about what happens if the cold chain is
broken). These are not contradictory — they answer different questions (a low-moisture semi-soft cheese
is shelf-stable at room temperature for date-marking purposes, but if it is left out or cross-contaminated
it can still support Listeria growth like any other RTE dairy food) — but it is exactly the kind of
"threshold that applies to one class does not automatically apply to another" trap the task named. **A
single number could not represent both facts correctly**, which is one more reason a numeric `safe` field
is the wrong container for any of this.

**D. Everything else (17 of 33 SKUs)** — Scamorza/Mozzarella (#17), Provolone (#18), Comté (#24),
Emmental (#25), Manchego (#26), Colby Jack (#28), Pepper Jack (#30), Havarti (#31), Asiago (#32),
Raclette (#34), Fontina (#35), Tilsit (#36), Jarlsberg (#37), Cantal (#38), Oregon Blue (#40),
Stilton (#42), Roquefort (#43), Fior di Latte (#44), Halloumi (#47) — **not independently verified by name
against the specific primary-source lists I re-read**, even though several are plausible family-members
of the named classes above (e.g. Oregon Blue and Stilton are both blue-mold cheeses like Blue Cheese/
Gorgonzola; Fior di Latte is a fresh pasta-filata cheese like the fresh/soft-unripened category). Where
the prior 2026-08-02 doc claimed additional names (e.g. "Asiago medium/old", "Fontina") via an Annexes
document, **that document could not be retrieved** (3× `ECONNRESET`, logged in
`docs/sources/corpus/01-fda-food-code-2022/PROVENANCE.md`) — those specific claims are therefore
**not independently confirmed by me** and I am not carrying them forward as verified. This is intentional
under-claiming, per the owner's standing instruction that an absent number beats an invented one.

**Roquefort (#43)** has its own named standard of identity, 21 CFR §133.184 "Roquefort cheese, sheep's
milk blue-mold, and blue-mold cheese from sheep's milk" (confirmed present in the §133 table of contents
extracted alongside §133.3), but the standard's text (compositional requirements, not a safety threshold)
was not fetched — noted for completeness, not claimed as a safety finding.

---

## 4 · What actually governs cheese safety (none of it is an internal temperature)

**4.1 — Milk pasteurization, before the cheese exists.** 21 CFR §133.3(d), verified verbatim in the
directly-downloaded XML/PDF (`extracted-text-133-3.txt:71-90`):
> "Pasteurized when used to describe a dairy ingredient means that every particle of such ingredient
> shall have been heated ... to one of the temperatures specified ... and held continuously at or above
> that temperature for the specified time: **145°F/30 min · 161°F/15 s · 191°F/1 s · 204°F/0.05 s ·
> 212°F/0.01 s.** If the dairy ingredient has a fat content of 10 percent or more, the specified
> temperature shall be increased by 5°F." §133.3(e): "Ultrapasteurized ... at or above **280°F for at
> least 2 seconds**."

This governs the **milk**, at the dairy, before cheesemaking. It is a real, citable regulatory
requirement — but it is not applicable to any per-item record in this catalog, because the app does not
model cheese manufacture, only post-purchase smoking of finished cheese.

**4.2 — The raw-milk alternative: 60-day cold aging, not heat.** 21 CFR §133.113(a)(1) (Cheddar,
confirmed by direct PDF+XML extraction, cross-checked against the eCFR API — no disagreement between the
two retrieval methods):
> "If the dairy ingredients used are not pasteurized, the cheese is cured at a temperature of **not less
> than 35°F for at least 60 days**."

Note the direction: this is a **cold, long-hold** requirement, the opposite shape of a meat "safe"
temperature. It substitutes *time and refrigeration* for pasteurization heat. This clause (or a near
identical one) recurs across roughly 30 individual §133 standards-of-identity — confirmed present at
Cheddar (§133.113); not independently re-fetched for every other named cheese, so do not assume identical
wording for e.g. Gruyère or Roquefort without checking.

**4.3 — Whether it needs refrigeration at all: pH and water activity, not temperature.** FDA Food Code
2022, Chapter 1 "Time/Temperature Control for Safety Food" Tables A/B (pH × a_w grids), and the FDA 2017
Listeria guidance's own non-growth thresholds, confirmed verbatim on page 4 of the actual guidance PDF:
> "The pH of the food is less than or equal to **4.4**." / "The water activity of the food is less than
> or equal to **0.92**."

A cheese below either threshold does not need active temperature control the way a cooked meat does.
**This is the real governing variable for cheese — not a cook temperature, a compositional one** (how
much free water is available to bacteria, and how acidic the product is). No pH or a_w value has been
measured or sourced for any of the 33 specific catalog items — stating that gap plainly rather than
guessing a number per §5.

**4.4 — Whether the batch needs date-marking as RTE-TCS food.** Food Code §3-501.17(G) (§3 above):
hard cheeses ≤39% moisture and semi-soft cheeses 39–50% moisture, by name, are **exempt** from the
date-marking rule that otherwise applies to RTE TCS food — precisely because "organic acids,
preservatives, competing microorganisms, pH, water activity, or salt concentration" already control
growth. This is a real, citable, class-level fact, but it answers a shelf-life/labeling question, not
"what internal temperature is safe."

**4.5 — Listeria growth-support category.** FDA's 2017 guidance (§3.B above) names soft, fresh, and
semi-soft cheese categories as growth-supporting. The controlling action there is **cold-chain hygiene**
(keep refrigerated, avoid cross-contamination, avoid extended time in the smoker's danger zone), not a
number the app could display as "cook to X°C."

**4.6 — Cold-smoking chamber temperature: a genuine, disclosed gap.** I found **no** FDA/CFR/Food Code
text anywhere in the retrieved corpus that sets a food-safety ceiling or duration limit for cold-smoking
cheese specifically. The ≤28–30°C figures already in `data.py`/`sources.py` for all 33 items are sourced
to blog aggregators and are, by their own wording, about **preventing the cheese from sweating/melting**
(a quality concern — fat liquefies above ~32°C/90°F), not about pathogen control. This matches the prior
2026-08-02 research's conclusion (its §5, gap G6) and I did not find anything in the primary corpus that
overturns it. **UNDETERMINED, stated as such** — not filled with an invented number.

---

## 5 · Recommendation — one reading

1. **Leave `safe` absent for all 33 cheese items.** This is not a gap; it is the correct, source-backed
   state. Do not add a numeric internal-temperature value to any of the 33 records — none is supported by
   FDA, 21 CFR, or the Food Code, for any of the 33 product classes checked.
2. **Do not extend `safe`'s meaning to "exempt from date-marking" or "Listeria growth-supporting."**
   Both are real, citable facts (§3.A/§3.B), but they are a different kind of fact from a cook
   temperature, they are not numeric, and — per §3.C — a single field cannot represent both without losing
   the distinction between "shelf-stable enough not to need date-marking" and "still capable of
   supporting Listeria if mishandled." Retrofitting them into `safe` would repeat the exact mistake this
   project already caught and logged for bacon (a `safe`-shaped field used for a non-`safe` fact).
3. **If the owner wants the app to say anything at all about cheese safety, it should be prose, not a
   number**, and it should say what §4 actually supports: *"גבינה זו כבר מיוצרת ומוכנה לאכילה; אין לה
   טמפרטורת בישול פנימית. שמרו על קירור עד לתחילת העישון והחזירו למקרר מיד אחריו — עישון קר עצמו הוא
   שלב טעם, לא שלב בטיחות."* (This cheese is already manufactured and ready to eat; it has no internal
   cook temperature. Keep it refrigerated until smoking and return it to the fridge immediately after —
   cold-smoking itself is a flavor step, not a safety step.) This is a decision for the owner, not
   something this research task should ship.
4. **§4.6 (cold-smoke chamber ceiling) is the one open thread**, and it is a texture question, not a
   safety one — no action needed unless the owner wants a genuinely primary-sourced ceiling researched
   (none was found; it may not exist as a regulated value at all, since home cold-smoking of cheese is not
   itself a regulated commercial process).

---

## Sources used (all already in-repo, primary, previously downloaded and verified against raw text)

| Source | Location | What it settles here |
|---|---|---|
| 21 CFR §133.3(d)/(e) — milk pasteurization/ultrapasteurization | `docs/sources/corpus/12-21cfr-133/extracted-text-133-3.txt`, cross-checked vs eCFR XML | §4.1 |
| 21 CFR §133.113(a)(1) — raw-milk 60-day cold-aging (Cheddar, representative) | `docs/sources/corpus/12-21cfr-133/extracted-text-133-113.txt` | §4.2 |
| FDA Food Code 2022 §3-501.17(G)(2)-(3) — date-marking exemption, named cheeses | `docs/sources/corpus/01-fda-food-code-2022/fda-food-code-2022-westhartford-mirror-extracted.txt:3880-3886` (cross-confirmed in the Chapter-3-only mirror) | §3.A, §4.4 |
| FDA Food Code 2022 Ch.1 Tables A/B — TCS pH×a_w classification | `docs/sources/corpus/01-fda-food-code-2022/` (`tcs-classification-table-a-b.csv`) | §4.3 |
| FDA 2017 "Control of *Listeria monocytogenes* in RTE Foods" — pH≤4.4/a_w≤0.92 + named cheese categories | `docs/sources/corpus/13-fda-listeria-rte-2017/extracted-text-PRIMARY.txt` (page-4 thresholds; lines 344-346 for named categories) | §3.B, §4.3, §4.5 |
| Prior in-repo research reusing/pointing at the above | `docs/research/2026-08-02-cure-and-cheese-safety.md` §4 | Starting point; independently re-verified, not trusted blind |
| `data.py` lines 161-193 (33 cheese records) + `sources.py` lines ~3424-3600+ | this repo | §1, §2 |

**Nothing new was fetched from the web for this task** — the existing corpus was sufficient and already
primary-sourced. No usefulness-gate recommendation to make (nothing new to ingest); if anything, the
existing corpus at `docs/sources/corpus/12-21cfr-133/` and `.../13-fda-listeria-rte-2017/` deserves a
pointer from `docs/sources/baldwin-backbone.md` or an equivalent index, since it is exactly the kind of
cheese/dairy safety backbone that document does not currently cover (`baldwin-backbone.md` is meat/
poultry/fish/egg only) — flagged for the owner, not actioned here.

**Geniza note:** could not query `src.knowledge.retrieval` (no code-execution tool available to this
subagent). If the geniza has since ingested `docs/research/2026-08-02-cure-and-cheese-safety.md` or the
`docs/sources/corpus/12-21cfr-133/` and `13-fda-listeria-rte-2017/` folders, a follow-up session should
confirm this document's claims are retrievable there too — not verified here.
