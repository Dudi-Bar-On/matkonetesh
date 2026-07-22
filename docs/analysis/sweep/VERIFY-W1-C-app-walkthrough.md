# VERIFY — W1-C (running-app defects)

**Verifier:** adversarial pass, 2026-07-22 · **Target:** `docs/analysis/sweep/W1-C-app-walkthrough.md`
**Method:** independent Playwright run (own port **8211** via `node serve.js 8211` against the same
`dist/index.html`, 2,701,065 B, edition 258 · 22.7.26), 390×844 / DPR 2 / isMobile / hasTouch; plus
line-exact source reads, a replication of `build.py`'s own i18n coverage algorithm from `lang/*.json`,
and direct reads of the report's cited PNGs. **No source file was modified.**
Probe scripts + my own screenshots: session scratchpad (`p2.js`…`p10.js`, `v5-date-probe.png`, `v6-*.png`, `v9-equip-edit.png`).

**Verdict: 21 CONFIRMED · 3 REFUTED · 0 UNVERIFIABLE.**

Every line number the report cites (1019, 1563–1571, 1679, 1697, 1705, 5115, 5520, 5562, 5594, 5913,
5914, 5920, 6392, 6552, 6803, 6989, 7137, 7156, 9546, and 319) was opened and **all 20 are exact**.
Zero `pageerror` in my runs too.

---

## REFUTED

### D15 — "Opening the occupancy view lands on an empty rack … a default of 'the busiest moment' would open on the answer" → **REFUTED**

The busiest-moment default **already exists and is deliberate**. `app.js:695–713`:

```
695: // Opening on the wall clock is right while you are actually cooking, but useless the rest of the
696: // time — browse a plan at 18:56 and every cooker reads "פנוי" … So: use the clock when it lands on
697: // something, otherwise open on the busiest moment, which is the one worth seeing.
698: function _occOpenAt(computed, span, scope){
704:   if(anyAt(span.now)) return span.now;
705:   let best=span.now, bestN=-1;               // ← otherwise: scan every stage start, keep the fullest
711:     if(n>bestN){ bestN=n; best=tMs; } }); });
```

`openOccupancyView` calls it at `app.js:718` before setting `window._occT`. The view opened at 08:09
**because `anyAt(08:09)` returned true** — the Anova bath was loaded, which the report itself states
("The one card with content (the Anova)"). So the view did land on a non-empty instant, and the fix the
report proposes is the code that is already shipping. The residual, much narrower issue is **device card
order** (empty smoker/offset/kettle rendered above the one occupied device), not the default time.

### D18 — "'פרויקטים ומזווה' … the pantry (מזווה) section is ~800 px below. The label promises a destination the tap does not reach." → **REFUTED**

`openPantry` (`app.js:3502–3505`) closes the panel and calls `cNavGo('projects')`. Measured after a real
`openPantry()` call: `screenOn:true, scrollY:0`, and the pantry header `📦 מזווה — חומרי גלם` sits at
**docTop 382** in an **844 px** viewport — on screen, with its first four inventory rows, without scrolling.
The report's **own screenshot** `he-07-projects.png` (780×1688 @DPR2 = 390×844 CSS) shows the same thing:
the מזווה header is at ≈405 CSS px and four `cinv-row` items are visible below it. The tap reaches the
destination. (It would only fall below the fold once enough *active projects* exist — a state the report
did not have either; its screenshot reads "אין פרויקטים פעילים".)

### D22 — "'הבא11:00' — the 'next' badge and the time run together with no separator" → **REFUTED**

Two independent contradictions:
1. `app.css:160` — `.wp-nowtag{…padding:0 5px;margin-inline-end:5px;vertical-align:middle}`. A 5 px
   inline-end margin plus 5 px padding is rendered between the badge and the time.
2. The report's **own evidence file** `wp-p2.png` shows the orange `הבא` pill on its **own line, above**
   `11:00` in the narrow time column — visibly separated, never "running together".

`הבא11:00` is what `textContent` returns (there is no whitespace text node between the two spans at
`app.js:5941`). It is a DOM-dump artefact, not something a user sees.

---

## CONFIRMED (with independent evidence)

| # | Verdict | My own evidence |
|---|---|---|
| **D1** | CONFIRMED | Reproduced from scratch. `app.css:555-556` → `.calcrow input{width:120px;padding:9px 11px;font-size:15px}`. I injected `<div class="calcrow"><input type="date" value="2026-07-22"></div>` into the live page: `{w:120,h:44,sw:118,cw:118,val:"2026-07-22"}` — identical to the report — and the element screenshot (`v5-date-probe.png`) paints **`22/07/202`**, last digit clipped by the calendar glyph. I also re-read `v-date-row.png`: same. |
| **D2** | CONFIRMED | `app.js:1019` emits `data-mt="${m}"` — and it is the **only valued** `data-mt` in the file: `grep -o 'data-mt="[^"]*"'` → 1 hit; bare `data-mt` → 67 hits. `app.js:6989` uses the attribute as source text; `app.js:6987` returns early for `he`. Neither `lang/en.json` nor `lang/en.data.json` has a `sv`/`smoke`/`grill` key, so `mtTranslate` returns the source. Fresh EN boot, real card click: `[{txt:"sv"},{txt:"smoke"},{txt:"grill"}]`, sizes 46×38 / 73×38 / 55×38. |
| **D3** | CONFIRMED | `app.js:7137` exact. Measured on arrival: `y:179`, `#q` top **−72**, `#scr-catalog .cshead` top **−179** (h 93, `position:static`), the ☰ `capp-ico` top **−151**, `burgerVisible:false`. Visible hero copy is `"בחר קטגוריה או חפש למעלה"`. *(An unscoped `.cshead` selector reads 0 because it hits the hidden wizard header at `build.py:188`; the report's scoped number is the correct one.)* |
| **D4** | CONFIRMED | `build.py:334` — the string lives in a global `<footer>` outside every `.screen`. Runtime on Events: `visible:true`, text = `"…הנתונים מקומיים, ללא חיבור לרשת. סימוני ה-checklist נשמרים בדפדפן. מהדורה 258 · 22.7.26"`. |
| **D5** | CONFIRMED | `app.js:5115` builds the jump `<option>` from `fmtClock(tk.t)` — `app.js:4876`, a bare `he-IL` HH:MM. The work plan uses `fmtClockRel` (`app.js:4881`) which prefixes `<span class="wp-day">`; `wp-p2.png` shows the `יום לפני` markers there. `app.js:5520` `vcTasks.findIndex(t=>t.t>=now)` exact. |
| **D6** | CONFIRMED | I re-ran build.py's own coverage algorithm over `lang/*.json` standalone: `de 83/3985 (2%) · es 83/3985 (2%) · fr 83/3985 (2%)` — byte-identical to the quoted build log. `L()` (`app.js:6896-6902`) falls back to **en** for fr/de/es. Live `fr` boot: `dir=ltr`, French chrome (`Bonjour`, `Demandez au Feu`, `Le plus populaire`) mixed with English (`Set up your equipment`, `Low & slow — 105–110°C, oak/hickory smoke`) **and** Hebrew (`עוזר בישול חכם…`, `✨ עוד כלי AI`, `מארח? תכנן את האירוע`, …) plus `#q` placeholder `חפש נתח, מוצר או שם באנגלית…`. Same for `de`. **Caveat:** the exact ratio "9 of 70" is seed-dependent — unseeded I get 5 of 58. The substance stands; the ratio should not be quoted as a constant. |
| **D7** | CONFIRMED | `app.css:179` `.cwseg{flex:1;height:7px}`; handler `app.js:7156` exact. Real navigation (`cNavGo('wizard')` then `cwGo(0)`): 6 `BUTTON[data-cwseg]`, **all 55×7**, `aria-label:"שלב 1: בסיס"`. |
| **D8** | CONFIRMED | Measured on `#scr-projects`: `.cinv-rm` **14×20**, `−` **26×26**, `+` **26×26**, qty input 52×31, `.cev-act` 121×**33**. Identical to the report. `.cinv-rm` has no size rule at all (`app.css:299`, `padding:0 2px`). |
| **D9** | CONFIRMED | All four line cites exact. Fresh EN boot: `#count` = `"130 נתחים · 102 מלאכה · 47 מיוחדים"`; card meta = `"Sous-vide 68°/30ש Smoking 105°/3ש יעד 95°"` + `"⏱ חוסך 9ש מעשנת"`; chip `"Kosher only"` → **one real click** → `"✓ כשר בלבד"`, and toggling back leaves `"כשר בלבד"`. Live-switch sub-claim also holds: `buildFilterBar` is called only from 6733/6791/7119 (never `applyLang`), and after `setLang('en')` the chip is still `כשר בלבד` — `getDict()['כשר בלבד']` is **MISSING**, so `tnode` cannot rescue it either. |
| **D10** | CONFIRMED | English more sheet: 27 `.cmore-item`, `dir=ltr`, every chevron `←` (`"🔥Active now←"`, `"🍽️Meal builder←"`, …). |
| **D11** | CONFIRMED | Every row checks against CSS or measurement: `.cbx` 26×26 (`app.css:650`), `.timer button` 30×30 (`660`), `.eq-iconbtn` 30×30 (`1438`), `.favstar` 30×30 (`815`), `.addcart` 34×34 (`819`), `.cwseg` 7 px (`179`), home chips ×**36** and bottom nav **78×70** (measured), `.plan-strict` (`1353`) wraps an unstyled native checkbox, `.occ-scrub input[type=range]` has `width:100%` and **no height** (`1637`). |
| **D12** | CONFIRMED (substance) — **one number is wrong** | `v-he-copilot.png` shows exactly two cards + one chip, then empty space to the bottom of the panel; my own `openCopilot()` panel is a single non-scrolling screen (`scrollHeight 844 = clientHeight 844`). But "**~900 px of empty space**" is impossible inside an 844 px viewport — the empty region is ≈**430** CSS px. Fix the figure before quoting it. |
| **D13** | CONFIRMED | `app.js:5913` `unresolvedHtml`, `5914` `contentionHtml`, concatenated bare at `app.js:5924` (`…${unresolvedHtml}${contentionHtml}…`) with no mutual guard. They are **not** mutually exclusive by construction: `_unresolved` collects items where `cookerFor()` is ambiguous, `_clashes` (`app.js:262-288`) is computed only over items that **did** resolve — so a partly-assigned plan renders "I cannot check capacity" immediately above a capacity verdict. |
| **D14** | CONFIRMED | `app.js:5920` exact: `L('חורגים מהשטח של','exceed the capacity of')` — Hebrew says *area* (שטח), English is dimension-neutral. It fires for volume devices too: `app.js:280` sets `bad='area'` for **any** over-verdict, and `devCapacity` returns `{mode:'volume', litres}` for sous-vide (`app.js:317`). The same feature prints the bath in litres at `app.js:637` (`…הגדולה דורשת X ל׳ · האמבט Y ל׳…`). |
| **D16** | CONFIRMED | Runtime field dump of the real edit form (seeded 4-shelf cabinet, ✎ clicked): `#eqvArea` label `"שטח בישול"` ph `"לדוגמה 3700 cm²"` 156×41, **and** `#eqProp-areaCm2` label `"📐 שטח בישול כולל (ס״מ²)"` 156×41 — adjacent, on one form. `d.cap.area` is written at `app.js:6552` and read **only** at `6392` (display chip) and `6674` (preview); the engine reads `propOf(dev,'areaCm2')` at `app.js:319`. **Caveat:** `#eqProp-areaCm2` had **no** placeholder in my run (report says `6000`), so the "both render their effective value as a placeholder" clause is not general. |
| **D17** | CONFIRMED | `app.js:6803` `theme:{store:'mk-theme',def:'cream',…}`. `prefers-color-scheme` occurrences: `app.css` 0, `index.html` 0, `build.py` 0, `dist/index.html` 0; no `matchMedia` dark probe in `app.js`. Runtime: `themeKey()==='cream'`, body `rgb(250,236,216)` on `rgb(90,58,40)`. |
| **D19** | CONFIRMED | `.cnav` → `tagName "DIV"`, `role null`; `document.querySelectorAll('nav')` **0**, `[role="navigation"]` **0**, `.cnav [aria-current]` **0**. Clean elsewhere: `lang=he/dir=rtl`, `h1:1`, `main:1`, skip link present, `img` without alt **0**. |
| **D20** | CONFIRMED | `app.js:5562` `fmtServe` returns `serveDayLabel(d)+' '+fmtClock(d)` whenever the day ≠ today; `app.js:5594` interpolates it after a literal `ב-` in Hebrew and after `at` in English → *"ב-אתמול 05:00"* / *"at yesterday 05:00"*, and prints `${late} דק׳` as raw minutes. |
| **D21** | CONFIRMED | Runtime: the first-run modal's panel text is `"✕🧭 ToolsHow much experience do you have?…⎙ PDF"` and the More sheet also carries `["⎙ PDF"]` — both from the shared `toolTop` header. |
| **D23** | CONFIRMED | Measured on `#scr-projects`: the `🧫 פרויקטים פעילים` title box is **68×72** (wrapped) while five `.cev-act` chips sit at y = 97, 97, 136, 136, 175 — **three rows**. Overflow scan (`right > innerWidth` / `left < 0`) returns `[]`, matching the report's own "no overflow" caveat. `he-07-projects.png` shows it. |
| **D24** | CONFIRMED | `app.js:9546` `if('serviceWorker' in navigator && location.protocol==='https:')`. On `http://localhost:8211` I measured `isSecureContext: **true**`, `protocol: "http:"`, `getRegistrations() → 0`. The gate is strictly narrower than the platform's secure-context rule, so the SW, its update toast and its alarms are unexercisable locally or in CI. |

---

## Notes on the report's own §3 ("claims I dropped")

Not re-litigated — they are self-refutations and none of them re-enters the defect list. I did spot-check
#3: `wp-p2.png` does show the `יום לפני` day markers in the work plan, which is exactly the asymmetry D5
rests on.

## Corrections to carry forward

1. **D15 and D18 should be struck**; **D22 should be struck** (DOM-dump artefact, not a rendering bug).
2. **D12**: replace "~900 px of empty space" with ≈430 CSS px.
3. **D6**: "9 of 70 Hebrew nodes" is seed-dependent (5 of 58 unseeded) — quote the mechanism and the
   2 % build number, not the ratio.
4. **D16**: drop the "both render their effective value as a placeholder" clause — `#eqProp-areaCm2`
   ships with no placeholder for a smoker.
5. Screenshot count is 188 in `docs/analysis/shots/sweep/`, not 190.
