# Review 06 — silent failures across the pipeline

**Date:** 2026-08-03 · **Scope:** the whole data pipeline + app, emphasis on the last day's code
(`model*.py`, `build.py`, `app.js` safety paths, `sources.py` classifier)
**Method:** every count was measured at the END of the runtime chain — `python build.py` (exit 0), then
`dist/items.json` and the rendered call sites — not by grepping a source file
(`docs/process/skills/verify-against-the-runtime-path/SKILL.md`). Every line number quoted below was
opened and read; findings delegated to specialist agents were re-verified against the file and the
corpus before being restated here.
**Audit only. No repository file was modified except this report.**

Build under audit: `written 2161430 bytes; 130 cuts 47 specials 52 glossary` ·
`[model] items: 279 · unconverted entries: 384` · exit 0.

---

## Where this build sits, in the brief's own three categories

| Category | This build |
|---|---|
| An absence reported honestly | 384 report rows are built — **and then discarded at `build.py:140`** (F-6) |
| **An absence silently filled with a default** | F-1 (dry-cure nitrite), F-2 (8 recipes), F-9 (6 items), F-13, F-16, F-17 |
| **A wrong value produced confidently** | F-3 (1 item, user-visible), F-4 (32+21 items), F-5 (voice stamp), F-8 (3 items) |

Three of the top five findings are the third category — not merely unbacked numbers, but numbers
attributed to a document that states a different figure, or stamped "verified" without attribution.

---

# CRITICAL

## F-1 · `app.js:2843–2850` — the nitrite dose on the uncooked dry-cure preset comes from a `||` fallback, and the screen contradicts itself

```js
2843	        const doseG=x*(calc.cureRate||2.5)/1000;
2844	        h+=line('Cure #'+calc.cure, fmtG(doseG), (calc.cureRate||2.5)+' '+gKg);
2845	        g+=cureScaleGuardHTML(doseG, calc.cureRate||2.5, 'ק״ג בשר','kg meat');
```

The presets (`app.js:2961–2965`, read directly):

```js
2961	  const R={fresh:{salt:18,cure:null,sugar:0,water:10,brine:false},
2962	    smoked:{salt:18,cure:'1',sugar:1,water:10,brine:false},
2963	    dry:{salt:29,cure:'2',sugar:3,water:0,brine:false},
2964	    bacon:{salt:20,cure:'1',sugar:10,water:0,brine:false,cureRate:2.0},
```

**`smoked` and `dry` carry no `cureRate` key at all.** The 2.5 g/kg they display is manufactured by the
`||`. And `dry` is `cure:'2'` — the uncooked, dry-cured, shelf-stable class. Two lines below, the app
prints its own warning for that exact preset (`app.js:2849`):

> `⚠ מוצר מיובש לא מבושל — דיוק ה-Cure קריטי לבטיחות.`

**The screen that says nitrite accuracy is critical for safety is the screen supplying the nitrite rate
from a fallback.** This is `${c.safe||63}` with a worse consequence: a fabricated safety *temperature*
is a number the cook can sanity-check against a thermometer; a fabricated *nitrite dose* is weighed out
and eaten.

**Second defect on the same screen.** `app.js:2850` hardcodes the note for `cure:'1'`:

> `Cure #1 ב-2.5 ג׳/ק״ג ≈ 156ppm ניטריט (תקני ובטוח).`

The `bacon` preset is `cure:'1', cureRate:2.0`. So the calculator prints the dose at **2.0 g/kg** and
directly beneath it asserts that **2.5 g/kg is "the standard and safe" rate** — two different nitrite
rates on one screen, one of them labelled the standard, with no explanation. A cook who trusts the
sentence over the table over-doses by 25%.

**What it should do instead:** every preset carries an explicit `cureRate` — no `||` anywhere in a
nitrite path. The note interpolates `calc.cureRate` rather than hardcoding 2.5. If a preset genuinely
has no authored rate, the calculator shows no dose and says so.

## F-2 · `build.py:59–62` — the build INVENTS a core temperature and writes it into 8 shipped recipes

```python
59	    _tgt="74° פנים (עוף)" if _isPoultry else "71° פנים"
61	    if not _isThin and not _isBlood and not _has_internal_temp(_body):
62	        _newbody=_body.rstrip()+f" בשל עד {_tgt} (מד-חום)."
```

**Measured — 8 MAKES rows receive a core temperature no author, source or `src.safe` entry supplied:**

```
m-weiss וייסוורסט · m-ital נקניק איטלקי · m-toul טולוז · m-carnati קרנאצי דה קאסה
m-patricieni קרנאצי פטריצ׳ני · m-boerewors בוארוורס · n-cotechino קוטקינו · n-alheira אליירה   → all 71
```

The header at `build.py:40` calls them *"grounded in professional practice"* — a synonym for uncited.

**Why this outranks a normal defaulted value:** it does not go through `model.py`. It is appended to the
recipe **prose**, so it reaches the cook as an instruction while bypassing every mechanism this project
built against exactly this:

- no `safety` block is created — **measured: all 102 MAKES items ship with zero `thermal` blocks**;
- so `_classify_source()` never runs and no `source_id` attaches;
- so it never enters the 384-row report;
- so `citedSafeC()` — the app's arbiter, which correctly refuses to state an unbacked number — never
  sees it. The number arrives already rendered, as text.

**The poultry test reads the name, not the recipe.** `build.py:58`:
`_isPoultry = re.search(r"עוף|הודו|chicken|turkey", heb + eng)`. `build.materials` is never consulted.
A poultry sausage whose Hebrew and English names contain neither word gets **71 °C instead of 74 °C**
— on the one class where the floor is higher. `n-alheira` (the Portuguese bread sausage classically
made with poultry) is on the list; its materials name only casing, salt and a thermometer.

Same block, `build.py:71–78`: `_b["store"]=_store` is an **unconditional** assignment (no
"only-if-absent" test, unlike the branch above it) carrying three more uncited figures — `75°`,
`72° פנים`, `71°/74° פנים` — over whatever the recipe authored.

**What it should do instead:** emit nothing into the prose. If the figures are wanted, author them in
`data.py`/`sausages_new.py` with an `src.safe` ref so they become real `thermal` blocks the classifier,
the report and `citedSafeC()` all see. At minimum, append a report row so the 8 items are *named*.

## F-3 · Beef tongue ships 63 °C where the governing source says 71.1 °C — the one finding a cook could act on today

Independently verified in both directions.

**Shipped** (`data.py`, rendered at `app.js:1741` and `app.js:3104` from the legacy `c.safe`):

```
n=22  לשון בקר  cat=בקר  safe=63  ref="Baldwin — pasteurization (beef floor 54.4C)"
```

**The governing source**, read directly at
`docs/sources/corpus/04-askusda-variety-meats/organ-meat-temps.csv` (marked `VERBATIM`, verified
2026-08-02 against ask.fsis.usda.gov):

> "Organs, such as kidney, liver, stomach, **tongue**, and tripe, from red meats (beef, veal, pork, or
> lamb) should be cooked to a minimum internal temperature of **160 °F**" — 71.1 °C

**Tongue is named explicitly.** The app ships **8 °C below** the applicable floor, cites a document
whose own stated beef figure is 54.4 °C — a third number, present in neither — and renders the result
in the catalogue as a safety temperature.

**The mechanism, and why no gate caught it:** `cuts:22` is categorised `cat=בקר` (beef), not
`איברים פנימיים`. Every organ-meat guard in the pipeline keys off category or off the word "variety" in
the ref string; this row has neither. The classifier could not have helped — the ref contains no organ
vocabulary. **This is a missed mechanism, not a misclassification: nothing in the pipeline knows that
tongue is an organ.**

Adjacent, same shape, lower confidence: `cuts:75`/`cuts:76` (sweetbreads) and `cuts:80` (calf brain)
ship 65 °C and are honestly flagged `safe-source-unmapped` — the flag is correct, but it records "no
source" for items the same article plausibly governs. The corpus author anticipated this and wrote the
boundary into the CSV notes ("does not explicitly cover heart or chitterlings … by analogy only"); the
classifier cannot read prose notes.

## F-4 · `model.py:63–114` — first-match-wins cites the wrong document for 53 shipped safety numbers

`_SOURCE_KEYWORDS` is scanned first-match-wins (`model.py:111–113`). `("baldwin", …)` is at **index 0**.

**Measured, end of chain:**

```
cuts:6   instant_c=63  source_id=15  | ref="Baldwin — SV floor 54.4C; USDA whole-muscle 145F/63C"
cuts:11  instant_c=63  source_id=15  | ref="Baldwin — SV floor 54.4C; USDA 145F/63C"
... 32 thermal blocks whose ref names BOTH Baldwin and USDA
```

Read the ref: **the citation itself says 63 °C is USDA's. Baldwin's number in the same string is 54.4.**
The classifier attaches Baldwin. Corpus #3 — the USDA FSIS chart that *does* carry
`fish_and_shellfish,145,62.8` and the whole-cut 145 °F row — sits unused at the end of the list.

**Ambiguity census** — refs where an earlier keyword suppressed a *different* later match: **66 of the
refs reached; 59 of the 103 thermal blocks (57%)**.

| Won | Suppressed | n |
|---|---|---|
| baldwin | usda | 32 |
| baldwin | fish / shellfish | 12 / 7 |
| amazingribs | usda | 6 |
| **variety** | usda | 4 |
| baldwin | amazingribs | 3 |
| baldwin | usda, fsis | 2 |

**Two firm misattributions verified against the corpus itself:**

- **21 blocks cite corpus #18 (AmazingRibs) for a temperature guide that is not in it.** I read
  `docs/sources/corpus/18-amazingribs-blonder/PROVENANCE.md` and listed the folder: the three articles
  are the BBQ stall, wood/smoke/combustion, and resting meat; the seven artifacts are
  `stall-experiment-data.csv`, `wood-type-table.csv`, `combustion-stages.csv`, `resting-meat-data.csv`,
  `pork-shoulder-wrap-trial.csv`, `wood-smoking-parameters.csv`, `SOURCE-COPY.md`. The refs say
  *"AmazingRibs — Food Temperature Guide"*. **That page was never downloaded.** Not fixable by
  re-ordering keywords — it needs a source acquired.
- **6 seafood blocks cite corpus #5 (FDA Fish Guidance) for figures it does not contain, and encode a
  30-minute hold as an instant.** I grepped the 498-page extraction directly: `"shells open"` → **0
  hits**, `"opaque"` → **0 hits**. The only relevant 145 °F occurrences are lines 26211 and 27160,
  under *"1C. HOT SMOKING — Set Critical Limits"*: **"maintained at or above 145 °F (62.8 °C) … for at
  least 30 minutes."** The app ships that as
  `{"kind":"thermal","instant_c":63}` (`model.py:142–143`). A sustained process critical limit has
  become an instantaneous floor.

**The design defect, stated plainly:** the function's docstring (`model.py:104–108`) calls itself
*"deliberately conservative"* and says it *"refuses to guess when nothing matches"*. That describes only
the zero-match path. On **two** matches it guesses silently, by list order, with a citation attached and
no report row — the failure the owner instruction quoted at `model.py:60` ("a wrong source_id is worse
than a missing one") exists to prevent. There is no `ambiguous` reason in the report at all.

**And the report reads green because of it.** `safe-source-unmapped` = **4**. It counts refs matching
*nothing*. It cannot count the 53 matching the *wrong thing*. **A coverage metric was mistaken for a
correctness metric.**

**One retraction worth recording** (the provenance auditor caught itself, and it is instructive): the 17
poultry blocks at 74 °C citing Baldwin were nearly filed as "value absent from the source". Baldwin's
primary text (`15-baldwin-sous-vide/extracted-text-2012-paper-PRIMARY.txt:591–594`) **does** contain
74 °C — while quoting it as the traditional USDA figure in order to argue against it. So the verdict is
attribution to the quoting source, not absence. Weaker than first stated, and still wrong.

**What it should do instead:** when two keywords resolve to different corpus ids, emit
`safe-source-ambiguous` naming all candidates and ship `source_id: null`. Additionally, the refs contain
temperatures — `"Baldwin 54.4C; USDA 63C"` shipping `63` is machine-decidable. A classifier that
reconciled value against citation catches this class without opening a single corpus file.

---

# HIGH

## F-5 · `app.js:8830–8831` — the voice guard refuses Tier 1 for substitution and admits it for the "verified" stamp

The substitution path deliberately refuses a context-only match (`app.js:8114–8116`):

```js
8114	function vcIdentifiedSafeItem(tiers){
8115	  const m=tiers && tiers.t2;
8116	  if(!m || !m.obj) return null;   // no question-text match — Tier 1 alone is never sufficient
```

with the reasoning at 8100–8107: being mid-cook on an item is no evidence the number is *about* that
item. Seven hundred lines later the marker-eligibility map takes both tiers:

```js
8830	  vcVerifiedSafeNums(tiers && tiers.t1).forEach(function(n){ ok[n]=true; });
8831	  vcVerifiedSafeNums(tiers && tiers.t2).forEach(function(n){ ok[n]=true; });
```

and `app.js:8875–8887` stamps any match with **`לפי המדריך המאומת`** — the app's most authoritative
sentence. **The hazard the weaker claim refuses is admitted on the stronger claim.** Mid-cook on brisket
(`safe=63`), an off-topic answer containing "63°C" gets stamped as verified guide data.

Same map, second leak — `vcVerifiedSafeNums` (`app.js:8082–8087`, read directly) pools
`['safe','tgt']`. `app.js:8108` says in its own words that *"`tgt` is a texture target, not a safety
figure"*. A texture number is therefore eligible for the safety-verified stamp.

**What it should do instead:** marker eligibility restricted to `t2`, exactly as substitution is; `tgt`
excluded from the pool on a safety question.

## F-6 · `build.py:140–141` — the non-conversion report is computed, then discarded

```python
140	    "unconvertedReasons": sorted({u["reason"] for u in _unconverted}),
141	    "unconvertedIds":     sorted({u["id"] for u in _unconverted if u["id"] is not None}),
```

384 rows are built, each `{id, name, field, value, reason}`. What ships is **two flattened sets** — 16
reason strings and a bag of ids with no reason attached. The pairing (*which item lacks what*) is
destroyed on line 140. Nothing is written to disk either (verified: no report file in `dist/`).

Every converter in this pipeline was written to report honestly, and every one of them reports into a
sink. This is the structural reason the brief's findings #3 and #5 were invisible.

**Fixing this one line converts most of the pipeline's invisible failures into visible ones.**

## F-7 · `app.js:5757` / `5784` — the divergence `citedSafeC()` was built to end still exists in two branches

`citedSafeC` (`app.js:5702–5708`) is correct: absent / `''` / NaN / `0` → `null`, and no caller applies
`||` to its return. Its comment at 5694 says it *"is now the only place that answers the question"*.
It is not. Two `askFire` branches still read the raw scalar:

```js
5757	 ... יעד פנימי ${donenessTarget(c)}°C${c.safe?` · בטיחות ${c.safe}°C`:''}. ...
5784	 ... יעד ${donenessTarget(c)}°C${c.safe?` · בטיחות ${c.safe}°C`:''} · עץ ${c.wood||'—'}.
```

(also `app.js:1741` and `app.js:3104`, the recipe step and the card's temperature table).

**What the user sees:** truthiness coincides with `citedSafeC` for `0` and `null`, so no `63` is
fabricated today — but it produces **silence** where `citedSafeC` + `safeAbsenceKind` produce the honest
sentence, and it renders a non-numeric truthy value verbatim and unrounded. Ask *"מה הטמפרטורה לתירס"*
(hits 5757) and the safety line is simply **missing**, unexplained; ask *"האם תירס בטוח"* (hits 5770,
the guarded branch) and you get the correct "no such temperature exists". Same item, same session, two
different answers.

## F-8 · `model_process.py:436–441` — three known-wrong fermentation durations ship, recorded only in a docstring

The module docstring states (lines 105–115) that the old whole-blob duration scan misattributed a
drying-hang figure as fermentation time, verified in production. Tier 1 then returns those blocks as-is:

> *"that block (duration_h included, **bugs included**) is returned AS-IS … including three
> (n-fuet/n-chorizo-esp/n-landjager) whose `duration_h` this investigation found to be misattributed …
> the report names it for a separate owner decision instead."*

**Measured — live in this build:**

```
make:n-chorizo-esp  duration_h=840   (35 days — the HANG time)
make:n-fuet         duration_h=504   (21 days — the HANG time)
make:n-landjager    duration_h=6     (its unrelated SMOKE phase)
```

**"The report names it" is false.** I searched all 384 rows: no reason mentions these items or this
defect. The only record is a Python comment. A correctly diagnosed bug was consciously left shipping and
its paper trail was a docstring.

## F-9 · `model_paths.py:45–50` — the `0` sentinel, and `app.js:5834` feeds it to the AI

`model.py:129` guards `v == 0` on `safe` with a named report row. `_cut_paths` has no equivalent:

```python
45	    if row.get("svt") is not None and row.get("smt") is not None:
46	        paths["c:smoke_sv"] = {"legs": {"sv": {"t": row["svt"], "h": _hours_upper(row.get("svh"))}, ...
```

**Measured — 6 shellfish rows ship a sous-vide leg at 0 °C for 0 hours:** `cuts:120` סרטן כחול,
`cuts:121`, `cuts:122`, `cuts:128` מולים, `cuts:129`, `cuts:130` אויסטרים → `sv {'t': 0, 'h': '0'}`.

**New here — it also reaches the AI.** `app.js:5834` builds the assistant's grounding string:

```js
`• ${e.heb} (${e.cat}): סו-ויד ${o.svt}°C/${o.svh}ש · … · עישון-בלבד ${o.sot}°C/${o.soh}ש
 · יעד … ${citedSafeC(o)!=null?` · בטיחות ${citedSafeC(o)}°C`:''} …`
```

Look at what one line does: `safe` goes through the arbiter and is correctly omitted when uncited;
`svt`/`svh`/`sot`/`soh` **on the same line** are raw. For oysters the model is told, as catalogue fact,
**"סו-ויד 0°C/0ש"**. The guard exists and stops one field short.

## F-10 · Fabricated durations and chamber temperatures from absent data (`app.js`)

Verified at each line:

| Line | Code | What is invented |
|---|---|---|
| `app.js:4426` | `coldSmokeTemp(hotTemp){ const t=Math.round((hotTemp||110)*0.55); … }` | An item with **no** smoke temperature yields `110*0.55 → 61 °C`, a specific chamber temperature conjured from a default times a formula. The call site's own comment (4686–4687) says "never a formula for safety-relevant temps/times" — the fallback *is* the formula. |
| `app.js:6–11` | `upperHours`: `parseFloat(h)||0` ×2 | An unparsable or absent cook duration becomes **0 hours**. `app.js:4448` states the choice: *"an unmeasured duration is 0, not a poisoned chain"*. A zero-length stage renders as a plausible schedule that tells the cook to start at serve time; NaN would at least have looked broken. |
| `app.js:4899` | `למשך ${o.smh\|\|'2-4'} שעות` … `(parseInt(o.smh)\|\|3)*3600` | Two inventions from one absence, **inconsistent with each other**: the prose says 2-4 hours, the timer counts 3. |
| `app.js:4393` | `upperHours(s.smh)\|\|3` ×2 | A spec item with no smoke hours gets a fabricated 3-hour smoke stage on the timeline. |
| `app.js:5004` | `…match(/\d+/)?.[0]\|\|'')\|\|7` | An unparsable aging spec becomes **7 days** for a dry-cure project. |
| `app.js:14323`, `5038`, `13763` | `factor \|\| 0.62` → `targetLoss=Math.round((1-(p.factor\|\|0.62))*100)` | The dry-cure **target weight-loss** — the charcutier's a_w proxy, the safety barrier on that product class — defaults to 38% and is rendered to the user as a target. |

Grep confirms the R-69 literals are gone: `?? <number>`, `.safe ||`, `|| 63`, `|| 71`, `|| 74`,
`|| 145`, `|| 165` → **zero hits in app.js**. The shape moved to `cureRate`, `smh`, `factor` and `age`.

## F-11 · `model_process.py:239, 338, 380` — 56 blocks ship a regulatory threshold with no verdict, while their siblings ship one

| kind | count | carries `limit_check`? |
|---|---|---|
| cure | 67 | **yes** (within 48 / unknown 19) |
| aging | 24 | **yes** (not-applicable 24) |
| **drying** | 36 | **no — 36/36 missing** |
| **fermentation** | 20 | **no — 20/20 missing** |

Every drying block ships `aw_max: 0.85, limit_is_regulatory: true`; every fermentation block ships
`ph_max: 5.3, degree_hours_max: {...}`. Neither says whether this item meets it. `model_cure.py:160–176`
computes a real verdict; `_aging_block_for_specials` (`model_process.py:506`) sets an explicit
`not-applicable` **with a reason string**. The two mechanisms in the *same module* do neither. A
regulatory number shown beside an item with no statement of compliance reads as a claim of compliance.

## F-12 · `build.py` — 520 authored values dropped with zero report rows; the one field designed out got one

```
rub    non-empty 130/130  e.g. 'מלח+פלפל גס (טקסני)'
wood   non-empty 130/130  e.g. 'אלון/היקורי'
diff   non-empty 130/130  e.g. 5
saved  non-empty 130/130  e.g. 9.0
```

No counterpart in `items.json`; no report row (verified: zero rows with `field in {rub,wood,diff,saved}`).

The asymmetry is the finding. `wrap` — the field whose retirement was a *deliberate decision* — gets a
dedicated summary row (`model.py:278–280`). The four nobody decided anything about get nothing. **A
conscious drop is documented; an unconscious drop is silent.** That is exactly backwards.

## F-13 · `app.js:3311`, `3313`, `3339–3344`, `5011` — swallowed timer, alarm and reminder failures

```js
3311	  if(…&&opts.onWarn){ warned=true; try{opts.onWarn(left);}catch(e){} }
3313	  if(left<=0){ done(); timerBeep(); _timerSet(…); if(opts.onEnd){ try{opts.onEnd();}catch(e){} } return; }
5011	  if(typeof projSeedReminders==='function'){ try{ projSeedReminders(p); }catch(e){} }
```

- **3313** — a cook timer's **end action** (spoken alert, stage advance) throws and is dropped. `done()`
  already ran, so the app *looks* correct while the side-effect that mattered never happened.
- **3311** — same for the pre-warning, and `warned=true` is latched **before** the call, so a throw means
  the warning is never retried.
- **3339–3344** — `mkNotify` swallows both delivery attempts and returns `false`; the caller (3377)
  discards the return inside another empty catch. **A timer alarm that failed to deliver is
  indistinguishable from one that delivered.** On a phone in the background at the smoker, that is a
  missed cook. The comment at 3336 promises the alerts toggle "says so honestly" — the *runtime*
  delivery failure is still silent.
- **5011** — cure/dry-aging **reminders never seeded** for a new project. A dry-cure schedule silently
  has none; the user finds out in weeks.

The right pattern already exists in the same file: `app.js:1797` (`store.set`) catches, calls
`mkStorageWarn`, and toasts at 1805. Four safety-adjacent paths should follow it.

## F-14 · `build.py:104–105` — `except ImportError: pass` around the entire citation merge

```python
85	try:
86	    from sources import CUT_SOURCES, SPEC_SOURCES, MAKE_SOURCES
…
104	except ImportError:
105	    pass
```

An empty catch over the step that attaches **all 279 citations**. A typo'd import inside `sources.py`
surfaces as `ImportError` and is swallowed; the build completes with exit 0 and ships every safety number
with `src` absent → `source_id: null` on all of them, with nothing on stdout. Compare `build.py:115–116`,
where the *equipment* import failure at least prints — the less consequential merge has the better guard.

---

# MEDIUM

## F-15 · `app.js:6436–6443` — the worst grounding state produces the weakest warning

```js
6438	  const ung=(groundingText!=null && groundingText!=='') ? aiUngroundedSafety(answerText, groundingText) : null;
6439	  if(ung && ung.length){ return '…🚫 …אל תסתמך עליהם…' }
6442	  return aiSafetyCaveat(answerText);
```

When `askContextFor` returns an **empty** context (no catalogue match and `askSafetyIntent` false —
`app.js:5844`), `ung` is `null`, so an answer whose safety numbers are **100% model-generated with zero
grounding** falls through to the mild caveat ("not verified — check them") instead of the strong 🚫 "do
not rely on them". Empty grounding should be treated as fully ungrounded, not as unknown.

## F-16 · `app.js:8294–8301` — the spoken path collapses the two absences

`safeAbsenceKind` (`app.js:5713–5716`) is correct and has **exactly one consumer**, `app.js:5773`.
`vcSafeSubstitutionParts` says, for both states:
`'אין לנו ערך בטיחות מאומת ל' + name`. **What the cook hears for corn** (`safe=0`, kind `na`, safety
genuinely not governed by core temperature) is *"we have no verified safety figure for corn"* — implying
a gap in our data rather than a category where no such temperature exists. They may go looking for one,
or infer the item is unsafe. `askContextFor` (5834) likewise omits the clause for both, so the AI gets
no signal that "not applicable" ≠ "unknown" and is free to fill it.

## F-17 · `app.js:11466–11480` — the items loader has zero user-facing signal on every failure mode

```js
11472	  DATA.items = d || [];
11474	}).catch(function(e){
11478	  try{ console.warn('[items] boot load failed', e); }catch(_){}
11479	  return DATA.items;      // stays []
```

| Failure | Signal |
|---|---|
| 404 / 5xx | none — `console.warn` only |
| offline / DNS | none |
| malformed JSON | none |
| **valid JSON, wrong shape** (`{}`, `"x"`, `null`) | **no catch at all** — assigned verbatim; `DATA.items` is a non-array that throws on the first `.filter` |

Two properties worth naming. The sibling lang loader (`app.js:11488–11504`, and `setLang` at 11457)
does all three recoveries including a Hebrew toast — the path that will carry the **safety catalogue**
degrades more quietly than the path carrying UI strings. And the catch **resolves** `__mkItemsReady`
with `[]`, so a test awaiting the handle cannot distinguish a successful empty payload from a total load
failure — the DoD-11 seam is blind to the failure it exists to observe.

Correctly scoped today (nothing reads `DATA.items`; verified by grep — only lines 11466/11472/11473/11479).
It lands pre-broken the moment an R-75 consumer ships.

## F-18 · `model.py:146–172` — 136 texture blocks, 136 unresolved citations, zero report rows

**`src.tgt` does not exist anywhere in `sources.py`.** Enumerated sub-keys across `CUT_SOURCES` +
`SPEC_SOURCES`: `{'sv':130, 'smoke':177, 'safe':144, 'verified':177, 'grill':131, 'cure':14}` — **`tgt`
appears 0 times**. So `ref` at `model.py:165` is always `""` and the `_classify_source` call at 166 is
**provably inert**: it cannot return anything but `None`. All 136 texture blocks ship
`source_id: null, provenance: "craft"`.

The `"craft"` label (`model.py:172`, R-79) is honest and correct. But unlike `_thermal_block`,
`_texture` appends **nothing** to `unconverted` — there is no `tgt-source-unmapped` reason, so 136
unresolved citations leave no trace. Silence reading as coverage.

## F-19 · `model_triggers.py:50` — the invented 45-minute interval is still live

```python
50	        return ({'action': _EVERY[raw], 'trigger': {'every': {'min': 45}}, …
```

**Measured: 17 shipped steps** (`cuts:3 שווארמה` rotate, `cuts:9 חזה אווז` flip, `cuts:16`, `cuts:20`,
`cuts:27`, `cuts:28`, …). The source prose is the bare word `הפיכה`/`סיבוב שיפוד` — an action, no
interval. The 45 is authored by the converter.

The same function reports `action-without-trigger` **48 times** — 48 real actions correctly demoted to
notes. So the module *can* say "no trigger". Line 50 is the one branch that invents one instead; the two
behaviours are three lines apart.

The brief is right that `T4r` rewards this. Restated: a test requiring every step to carry a trigger
makes "invent a plausible interval" the passing strategy and "report the gap" the failing one.

## F-20 · `model_paths.py:54` vs `:155` — the type guard exists in one sibling and not the other

```python
155	    texture = ({"target_c": tgt, …} if isinstance(tgt, (int, float)) else None)   # _special_paths
 54	            "texture": {"target_c": row.get("tgt"), "source_id": None, …},         # _cut_paths
```

`_special_paths` type-checks because SPECIALS carries prose in `tgt`. `_cut_paths` checks neither type
nor `None`. Measured today: 0 prose and 0 null targets reach a CUTS path — latent. But `model.py:_texture`
reports `tgt-nonnumeric` **twice in this very build**, so prose in that column is a live shape.

## F-21 · `model_sheet.py:58–74` — a set-based guard that cannot see a duplicate; half the catalogue joins to nothing

```python
60	        he = _ALIASES.get(r[_A_HE], r[_A_HE])
61	        a_by_he[he] = r          # duplicate Hebrew name → silent overwrite
68	    only_a = set(a_by_he) - set(b_by_he)
```

1. The "loud, not silent" guard at 70–74 compares **sets of surviving keys**. A name duplicated in
   *both* files overwrites in both and the sets stay equal — the check passes on 67 joined items where
   68 were authored. Measured today: 68/68 unique, no dup. The docstring's claim is nonetheless untrue.
2. **Measured: 63 of 130 CUTS have no sheet row.** `model.py:207` yields `None`, `_cut_paths` skips the
   entire per-path `texture`/`sear`/`coal` block (`if sheet_row:`) with **no report row**. Half the
   catalogue's paths ship without those fields and the report says nothing. The one sheet-side orphan
   (`ספייריבס חזיר`) is likewise unreported.

## F-22 · `build.py:29` — `MAKES.update(NEW_SAUSAGES)` has no collision guard (latent, 0 today)

**Measured honestly: there is no collision.** `data.MAKES` 50 keys, `NEW_SAUSAGES` 52, intersection
**empty**, union 102. **The reported `n-salchichon` duplicate does not exist in this build.** The defect
is the missing guard: `dict.update` replaces silently, and 102 hand-maintained keys across two files
with no assertion is one rename away from deleting a recipe at exit 0. One line —
`assert not (set(MAKES) & set(NEW_SAUSAGES))` — makes it impossible.

## F-23 · `app.js:3001` — an absent citation styled as data

```js
3001	  return `<tr><td>${label}</td><td>${o.ref||'—'}${link}${note}</td></tr>`;
```

Inside the "Sources & verification" table, a source object with an empty `ref` renders an **em-dash**,
visually indistinguishable from a formatting placeholder — where the sibling branches at `app.js:2998`
(`⚠ טרם אומת ממקור`) and `3016` say so outright. Same defect at `app.js:320` (`UNITS.fmt`): a missing
value renders as an **empty string**, so `UNITS.fmt(c.tgt,'temp')` at `3104` with no `tgt` produces a
blank cell rather than any sign the figure is absent.

---

# LOW / LATENT

| # | Location | Issue |
|---|---|---|
| F-24 | `model.py:142` | `int(round(v))` — Python banker's rounding sends a `62.5` floor **down** to 62. All `safe` values are `int` today (verified) so latent; wrong direction for a floor regardless. `math.ceil`. |
| F-25 | `app.js:5715` | `Number('')===0`, so an empty-string `safe` would say "not governed by core temperature" instead of "no figure". No row has it today (all `int`). Wrong sentence, latent. |
| F-26 | `model.py:88` / `:82` | `"shellfish"` is **provably unreachable** — every string containing it contains `"fish"` one index earlier; both map to the same id today, so no misattribution, but the entry expresses an intent the code cannot honour and fails silently if the ids ever diverge. `" pah "` matches **0 of 1,008** refs (cannot match a trailing "PAH" or "PAHs"). Dead entries that make the list look broader than it is. |
| F-27 | `model.py:85` | `"variety"` — a generic English word, listed **12 places above `"usda"`**. Exactly 1 match corpus-wide today, and it is the intended one. Highest-probability *future* false alarm in the list: any ref reading "a variety of cuts" routes to organ-meat guidance. |
| F-28 | `model.py:63–99` | There is **no `"fda"` keyword at all**. A ref reading *"FDA cooked-fish 145 °F / Baldwin…"* can only land on `fish` or `baldwin` — the publisher named first in the string is not a term the classifier knows. |
| F-29 | `model_triggers.py:32–36` | `_action_of` is first-match-wins over `_ACTION` — the same engine as F-4, smaller stakes. Prose naming two actions yields one, silently. |
| F-30 | `model_cure.py:63` | `_CURE_N` has no negation guard. `model_process.py:184` has `_NEGATED_FERMENT` for exactly this ("ללא התססה"). A `"ללא Cure #2"` would create a cure block. None exists today; the asymmetry does. |
| F-31 | `model_process.py:219` vs `model_cure.py:64` | Range collapse in **opposite directions** in sibling modules: `_duration_days` takes the upper bound ("4-7 ימים" → 7), `model_cure._DAYS` the lower. Neither records that a range was collapsed. For a shelf-stability hurdle the lower bound is conservative. |
| F-32 | `build.py:25` | `_s['heat'] = _t.get('heat', 0)` — 44 of 354 seasonings ship `heat: 0` ("not spicy") because no tag was authored. Only 2 are pepper-named, so low impact; the shape is a default standing in for an absence. |
| F-33 | `build.py:113–114` | `"uncovered: 1"` is printed as a **count**. The item is `('special','חלומי')` — it ships with no equipment requirements and is never named in any artifact. |
| F-34 | `build.py:14–18` · `build.py:782` | Seasoning de-dup by silent `continue`, no count printed · service worker `c.addAll(SHELL).catch(function(){})` — the forbidden empty catch, verbatim, low consequence. |
| F-35 | `model_triggers.py:18` | `_TEMP` makes `°` optional and would read a **chamber** temperature as `at_core_temp`. Checked every match: the 3 distinct prose strings that fire it are genuine core temps (`עטיפה ב-70°C`). Clean today; the regex does not encode the distinction it depends on. |
| F-36 | `model.py:142–143` | `instant_c` **cannot express a dwell or rest**, and `curve`/`basis`/`basis_ref` are hardcoded `None`. The FSIS 145 °F whole-cut floor carries `rest_min: 3` in corpus #3's own CSV; Baldwin's 63 °C is time-dependent; the Food Code figure he quotes is *15 seconds at 63 °C*. The shipped shape asserts instantaneous lethality where every cited source conditions the number. Structural — this is the same defect as F-4's FDA-fish case, generalised. |

---

# The pattern behind the pattern

**1. Every honest report in this pipeline drains into `build.py:140`.** The converters are individually
disciplined — they report gaps by name, scope regulatory limits to the product class their source
governs, and refuse to guess. That work produces 384 rows and the build keeps 16 strings and a bag of
ids. **F-6 is the cheapest high-value fix in this document.**

**2. The recurring shape is not "a missing guard" — it is "a guard not propagated to its sibling".**
Nine live instances: F-5 (substitution refuses Tier 1, the stamp accepts it) · F-7 (`citedSafeC` is the
one reader, except in four places) · F-9 (`model.py:129` has the 0-check, `model_paths.py:45` does not) ·
F-11 (cure and aging compute a verdict, drying and fermentation do not, same module) · F-14 (the
equipment import prints on failure, the sources import does not) · F-17 (the lang loader toasts, the
items loader console-warns) · F-18 (`_thermal_block` reports unmapped, `_texture` does not) · F-20
(`_special_paths` type-checks, `_cut_paths` does not) · F-30 (`model_process` guards negation,
`model_cure` does not). The brief said this asymmetry caused three incidents; it is present in nine more
places right now. The countermeasure is not another review — it is making each guard a shared function
with one caller each, the way `citedSafeC()` was made the only reader of `safe`. That refactor was the
right move and it was left 80% done.

**3. Two gates actively reward the defect.** `T4r` (every step must carry a trigger) makes inventing an
interval the cheapest way to pass — F-19. And `safe-source-unmapped: 4` reads green while 53 blocks
carry the wrong citation, because it measures whether a match happened, never whether it was right. **A
metric that cannot fail in the presence of the defect it is named after is not a gate.**

**4. Blast-radius note that changes the priority order.** `source_id` is read **nowhere** in `app.js`
(grep: zero hits; `app.js:11462` says so itself). Every misattribution in F-4 is currently shipped and
rendered to nobody. **This is the window in which the citation layer is cheap to correct.** The moment a
consumer renders "מקור: Baldwin" next to a 74 °C poultry floor, 63 of 103 blocks become false
provenance in the UI. By contrast F-1 (nitrite), F-2 (injected prose) and F-3 (tongue) are on screen
today.

**What is well built and should not be disturbed:** `citedSafeC()`/`safeAbsenceKind()`
(`app.js:5702–5716`) — three states, no substitution, and `askContextFor:8130–8131` refuses to swap
`tgt` for `safe`. `UNITS.toCanonical:264` and `aiSafetyToC:6396` fail closed on NaN, explicitly.
`vcIdentifiedSafeItem:8115` refuses Tier 1 for the right stated reason. `model_cure.py`'s scoping of
the CFIA floor to `cure_type=='2'` and `model_process.py`'s per-phase co-occurrence gate both check the
source's own scope before applying it. The corpus PROVENANCE files are unusually honest — #4's notes
flag their own scope boundary, #18's names what did not parse. F-2 and F-4 are worth fixing partly
because they undo work of this quality one layer up.

---

## Recommended order

1. **F-1** — `cureRate||2.5` on the uncooked dry-cure preset, and the 2.0-vs-2.5 contradiction on one screen.
2. **F-3** — beef tongue 63 °C against a source that names tongue at 71.1 °C. The only finding that could put an undercooked item on a plate.
3. **F-2** — stop injecting the 8 temperatures into recipe prose, or make them real cited blocks.
4. **F-5** — restrict the verified-marker map to Tier 2 and drop `tgt` from the pool.
5. **F-6** — write the 384 rows to disk. Two lines; prerequisite for trusting any future sweep.
6. **F-4** — report ambiguity instead of resolving it by list order; acquire the AmazingRibs source or drop the 21 citations.
7. **F-13** — the four swallowed timer/alarm/reminder failures.
8. **F-8, F-14, F-22** — name the three known-wrong durations in the report; make the two silent build failures loud (2 lines each).

---

## תקציר לבעלים

הממצא החמור ביותר הוא במחשבון המלח: `app.js:2843` מחשב את מנת הניטריט עם ‏`calc.cureRate||2.5`,
ולפריסטים `smoked` ו-`dry` **אין בכלל שדה `cureRate`** — כלומר 2.5 ג׳/ק״ג הוא המצאה של הקוד. `dry` הוא
בדיוק המוצר המיובש הלא-מבושל, ושתי שורות מתחת האפליקציה עצמה כותבת "דיוק ה-Cure קריטי לבטיחות". באותו
מסך: הפריסט `bacon` הוא 2.0, וההערה מתחתיו מצהירה ש-2.5 הוא "התקני והבטוח" — שני מינונים סותרים על מסך
אחד. טמפרטורה מומצאת אפשר לבדוק במד-חום; מינון ניטריט מומצא נשקל ונאכל.

שנית — **לשון בקר (`cuts:22`) משגרת 63°C.** המקור של USDA שכבר יושב אצלנו בקורפוס מונה במפורש "kidney,
liver, stomach, **tongue**, and tripe … 160 °F", כלומר 71.1. בדקתי את שני הקצוות בעצמי. אנחנו 8 מעלות
מתחת, מצטטים את Baldwin שהמספר שלו הוא 54.4 — מספר שלישי. הסיבה שאף שער לא תפס: לשון מסווגת `cat=בקר`,
לא "איברים פנימיים", ושום דבר בצינור לא יודע שלשון היא איבר פנימי.

שלישית — `build.py:59` **ממציא טמפרטורת ליבה ומדביק אותה לתוך 8 מתכוני נקניקייה** ("בשל עד 71° פנים").
המספר לא עובר דרך `model.py`, אין לו מקור, והוא לא בדוח. זיהוי העוף לפי **שם** בלבד, לא לפי הרכיבים.
ורביעית — המסווג ב-`model.py` בוחר את ההתאמה הראשונה, ו"baldwin" ראשון: **32 ערכים מצטטים את Baldwin
עבור 63°C כשהציטוט עצמו כתוב "Baldwin 54.4C; USDA 63C"**, ועוד 21 מצטטים מסמך של AmazingRibs שפשוט
לא הורד (פתחתי את התיקייה — יש בה מאמרים על stall, עץ ומנוחה, אין מדריך טמפרטורות).

והדבר שמסביר למה כל אלה שרדו: **הצינור מייצר 384 שורות דוח ואז זורק אותן** — `build.py:140` שומר רק
רשימת סיבות ו-ids בלי הצימוד ביניהם, ולא כותב קובץ. המדד `safe-source-unmapped` מראה 4 ונראה ירוק, כי
הוא סופר התאמות ולא נכונות. מדד שלא יכול להיכשל בנוכחות התקלה ששמו על שמה אינו שער.

התבנית האמיתית אינה "שכחו שומר" אלא **"שומר נכתב במסלול אחד ולא הועתק לאחיו"** — תשע הופעות חיות,
כולל אחת מביכה: מנגנון הקול מסרב במפורש לייחס מספר לפריט על סמך הקשר בלבד (`app.js:8115`), ו-700 שורות
אחר כך מחתים בדיוק את המספר הזה ב"לפי המדריך המאומת" (`app.js:8830`). ההיגיון הנכון כבר כתוב בקוד — הוא
פשוט לא הועתק למקום שבו הטענה חזקה יותר.
