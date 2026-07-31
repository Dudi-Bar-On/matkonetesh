# R-26 · Units Architecture — Spec (מפרט מאושר-בעלים בהמתנה)

**Date:** 31.7.2026 · **Ledger:** `docs/ROADMAP-2026-07-30.md` §5a row **R-26** · **Investigation (established findings):** `docs/analysis/2026-07-31-units-architecture-investigation.md` · **Plan:** `docs/superpowers/plans/2026-07-31-units-U1-U6.md`
**Owner rulings folded in (31.7):** (א) **תצוגה אימפריאלית מלאה בתכולה** — ~150 אתרי הפורמט מוסבים לפורמטר מרכזי; (ב) אופציית ה-imperial ב-Settings **מתוקנת, לא מוסרת**; (ג) `cited:{value,unit}` שדה מובנה **ב-Phase 3**.
**Sizing (מוסכם):** U-1..U-3 ב-Phase 1 · U-4/U-5 ב-Phase 3 · U-6 ב-Phase 10.

---

## 1 · Goals (דרישות R-26, כלשונן)

1. הגדרת יחידות למשתמש ב-Settings — ממומשת **נכון** (עושה מה שהיא מבטיחה, עם תיוג כן של ההיקף — פסק ב').
2. **רכיב ממיר גנרי אחד** שכל צרכן עובר דרכו — ממשק קולי, מתכונים, בטיחות, ציוד, פרומפטי AI — כך שתמיד מוצג/נאמר הערך הנכון עם היחידה הנכונה.
3. **ייבוא ערך חיצוני מייבא גם את יחידתו** וממיר לקנוני.
4. **הבסיס נשמר מטרי/צלזיוס** — בדיוק כפי שהעברית היא בסיס המילון וכל השאר נגזר ממנה.

**Non-goals (out of scope):** ראו §10.

## 2 · The canonical model

- **שום ערך מאוחסן לא משתנה, לעולם.** `data.py` נשאר מספרים חשופים שפירושם °C/ק״ג/ס״מ/ליטר. הרכיב מוסיף **הצהרת-schema** (שדה→kind, §6) — לא ממיר את הבסיס.
- **דלת-כניסה אחת** (`UNITS.toCanonical`) לכל ערך חיצוני: הערך נכנס **עם יחידתו**, מומר לקנוני, והמקור נשמר כ-provenance (`src:{v,unit}`).
- **דלת-יציאה אחת** (`UNITS.fmt`) לכל תצוגה/דיבור: המרה + תיוג-יחידה קורים אך ורק שם, אחרי שכבת המילון.
- **אין מסלול יציאה→כניסה** — ערך שהוצג/נאמר לעולם אינו נכתב חזרה. זה מה שחוסם המרה-כפולה (63→145.4→63.0).
- ההקבלה למילון: כפי שמילון `lang-XX` נגזר מהעברית ולעולם לא כתוב חזרה אליה, כך תצוגה אימפריאלית נגזרת מהקנון ולעולם לא כתובה חזרה אליו.

## 3 · The component — `UNITS` (namespace object, app.js)

`UNITS` הוא אובייקט-namespace יחיד ב-app.js (section מסומן), **ללא** קריאות למצב-אפליקציה פרט ל-`pref('units')`/`getLang()` בנקודות מוצהרות — **extraction-ready** לחילוץ המודולים של Phase 3 (H1).
**החלטה: U-1 אינו נולד כקובץ נפרד.** קובץ נפרד מחייב שינוי `build.py` כבר ב-Phase 1 בלי צורך; ה-namespace הנקי + טבלת ה-JSON המסומנת (§3.1) נותנים את אותה יכולת-חילוץ ב-Phase 3 עם ORCH, בסיכון Phase-1 נמוך יותר.

### 3.1 · The ONE table — `UNITS_TABLE`

טבלה אחת, כתובה כ-**JSON literal בין מרקרים** בתוך app.js, כך ש-build.py קורא **את אותה טבלה עצמה** (extraction ב-regex + `json.loads`, fail-closed):

```js
const UNITS_TABLE=/*__UNITS_TABLE__*/{ ... strict JSON ... }/*__UNITS_TABLE_END__*/;
```

תכולת הטבלה (המבנה המלא, עם הערכים, בתוכנית — Task 1):

- **`conv`** — 13 ההמרות הקיימות של `UNIT_CONV`, כל אחת כ-`{pre,num,den}` כאשר `canonical=(v+pre)*num/den`. מספרים שלמים ב-num/den ⇒ תוצאות float **זהות-ביט** לנוסחאות הקיימות (`(145-32)*5/9` ≡ `(145+(-32))*5/9`). ההופכי — `foreign = v*den/num − pre` — נגזר מאותה רשומה: סט-מקדמים אחד, שני כיוונים, אפס כפילות.
- **`kinds`** — ‏`temp` · `tempD` (דלתא — **לעולם לא** ענף ה-−32) · `mass` · `vol` · `len` · `area` · `time` · `pct` · `ppm`. לכל kind: ‏`canon`, דגל `safety`, ולכל unit: מפתח-`conv`, ‏`tokens` (צורות-הכתיב לזיהוי, whitespace-stripped+NFKC), ‏`label`/`voice` per-lang, ‏`imperial` (יחידת-התצוגה האימפריאלית של ה-kind — נצרך רק מ-U-6).
- **`vcOrder` / `gbOrder`** — סדרי-ההערכה של מחלקות-הזיהוי בזמן-ריצה ובבנייה (הסדר נושא סמנטיקה — למשל cook_measure לפני time; §7).
- **`tokenizerFragments`** — קטעי ה-regex של `SAFETY_UNIT` (כולל ענף-ה-deg עם ה-lookaheads וענף "מעלות פרנהייט") — ה-tokenizer מורכב מהם ב-`UNITS.tokenizerUnitSrc()`. הקטעים העדינים נשארים regex גולמי, אבל **בתוך הטבלה האחת** — מקור אחד.

### 3.2 · The API (exact signatures)

```js
UNITS.normalize(s)                      // → string. NFKC. vcNormalizeSafetyText DELEGATES here (the Task-13 seam
                                        //   is consumed, not bypassed): vcNormalizeSafetyText(s) ≡ UNITS.normalize(s).

UNITS.classify(token)                   // → {kind, unit} | null. unit='' = scale-unspecified (bare °/מעלות/deg).
                                        //   Normalizes via UNITS.normalize + lowercase + strip ALL whitespace
                                        //   (the 1b248a1 lesson, by construction). Fail-closed: unknown → null.

UNITS.toCanonical(value, unit, kind)    // → {v, unit:<canon>, src:{v, unit}} | null — the ONE import door.
                                        //   unit is a raw token; classified internally. Wrong-kind token → null.
                                        //   Canonical/unspecified token → passthrough (v unchanged). v is
                                        //   FULL-precision; rounding is the caller's storage policy (propCoerce
                                        //   keeps its 2dp; aiSafetyToC keeps its integer 'match' rounding).

UNITS.convert(value, kind, toUnit, role)// → number | null. Canonical → toUnit derivation for DISPLAY, with
                                        //   directional rounding per `role` (§5): 'comfort'|'safeFloor'|'safeCeil'.

UNITS.fmt(value, kind, opts)            // → string — the ONE formatter for render AND voice.
                                        //   opts: {unit:<target|null→UNITS.displayUnit(kind)>,
                                        //          role:'comfort'|'safeFloor'|'safeCeil' (default 'comfort'),
                                        //          cited:{v,unit}|null, voice:false, lang:getLang()}.
                                        //   CANONICAL target ⇒ IDENTITY on the number (String(v) verbatim, no
                                        //   rounding) + canonical label — byte-identity with today's `${x}°C`
                                        //   sites by construction. cited passthrough per §5.

UNITS.fmtHtml(value, kind, opts)        // → '<span dir="ltr" data-units-final>'+esc(fmt(...))+'</span>' — for
                                        //   prose/RTL contexts (L13 bidi islands; tnode skips it, §8).

UNITS.displayUnit(kind)                 // → unit id. Until U-6: always canon. From U-6: pref('units')==='imperial'
                                        //   → kinds[kind].imperial||canon. The ONLY reader of the pref for display.

UNITS.tokenizerUnitSrc()                // → the SAFETY_UNIT regex source, composed from tokenizerFragments.
UNITS.vcClasses()                       // → [{re, cls}] — prefix-classifier rows (replaces VC_UNIT_CLASS).
UNITS.legacyConv()                      // → {'F->C':fn, ...} — UNIT_CONV generated from `conv` (identical math).
```

### 3.3 · Fate of the five duplicate classifiers (collapse into one)

| Classifier | היום | אחרי |
|---|---|---|
| `SAFETY_UNIT` (app.js:5485) | regex literal | `const SAFETY_UNIT=UNITS.tokenizerUnitSrc()` — string-golden-tested שווה-תו-בתו לפני מחיקת הליטרל |
| `isTempUnit` (5498) | regex full-match נגזר-ליטרלית | wrapper: ‏`classify(u)?.kind==='temp'` |
| `isFahrenheitUnit` (5510) | enumerated regex | wrapper: ‏`classify(u)` → ‏`{temp,F}` — ה-enumeration עובר לטבלה כ-tokens |
| `VC_UNIT_CLASS` (9026) | 5 שורות regex ידניות | `const VC_UNIT_CLASS=UNITS.vcClasses()` — נבנה מ-tokens לפי `vcOrder` |
| `_GB_UNIT_CLASS` (build.py:557) | port ידני, 23 שפות | **נגזר מאותה טבלה** בבנייה (§7) |

‏`aiSafetyToC` הופך wrapper דק של `toCanonical` (עיגול-'match' לשלם נשמר — הוא נורמליזציית-השוואה מול רצפות ה-°C השלמות של הדאטה, לא תצוגה). ‏`UNIT_CONV`/`propCoerce`/`propParse` נבלעים כ-implementation (U-1/U-5) — ה-API החיצוני שלהם נשמר, אתרי-קריאה לא זזים.

## 4 · The consumption paths

- **Import (ציוד, AI, ולבסוף CP3):** חובה דרך `toCanonical`. ‏`propCoerce`/`propParse` שומרים על החוזה הקיים (canonical-first, bounds, fail-closed null → המשתמש מקליד) מעל הליבה החדשה. **CP3 (Phase 7): כל ערך מחקרי מצוטט נכנס דרך `toCanonical` בלבד**, ו-`src` שלו הוא שדה ה-`cited` (§6) — U-5 הוא תנאי-מוקדם מוצהר ל-CP3.
- **Display:** אתרי-רינדור עוברים ל-`UNITS.fmt`/`fmtHtml`. כל עוד היעד קנוני — identity על המספר, פלט זהה-בייט; המיגרציה בטוחה ומדידה (§9).
- **Voice:** שער-הבטיחות הקולי ממשיך: ‏`vcNormalizeSafetyText` (מאציל ל-`UNITS.normalize`) → tokenizer (`SAFETY_UNIT` הנגזר) → ‏`aiSafetyToC` (‏wrapper של `toCanonical`) → הדובר עובר דרך `UNITS.fmt` (פלט '63°C' זהה-בייט היום; דיבור-במילים "מעלות צלזיוס" — שאלה פתוחה Q3).
- **AI prompts:** שלושת בוני-הפרומפט (app.js:5358, 5609, 6552) קוראים `pref('units')`; ‏U-6 מתקן את ענף ה-imperial הריק (היום imperial רק *משמיט* את שורת ה-metric-only) לבקשה מפורשת של יחידות אימפריאליות, ושומר על גדר-הבטיחות: מספרי-בטיחות בפרומפט נשארים מנוסחים קנונית — ההמרה לתצוגה נעשית אצלנו, לא אצל המודל.

## 5 · Safety provenance (baldwin-backbone — the non-negotiable)

1. **האחסון לא זז.** ‏`safe:63` נשאר 63 עם הציטוט ב-`sources.py`. אף המרה אינה כותבת לבסיס.
2. **ערך מצוטט מוצג מילולית, לעולם לא נגזר-מחדש.** אם יחידת-התצוגה שווה ל-`cited.unit` — מוצג `cited.v` כלשונו (145°F, לא 63°C→145.4°F). אין עיגול של ערך מצוטט, נקודה.
3. **כשאין ציטוט ביחידת-היעד — עיגול כיווני-בטיחות בלבד:**
   - **רצפת-בטיחות (`role:'safeFloor'`)** — מתעגלת **כלפי מעלה** בלבד (`Math.ceil` בדיוק-התצוגה). ‏54.4°C→‏130°F (130.0 בדיוק — הציטוט המקורי); ‏63°C→‏146°F (‏145.4→ceil; לעולם לא 145).
   - **גבול-עליון בטיחותי (`role:'safeCeil'`)** — מתעגל **כלפי מטה** (תקרת cold-smoke, קצה-תחתון של danger-zone). כלל-העל: **טווח-סכנה מתרחב, לעולם לא מתכווץ.**
   - **מספר-נוחות (`role:'comfort'`)** — עיגול רגיל לקרוב (doneness, משקל, נפח).
4. **הבחנה: match-rounding ≠ display-rounding.** ‏`aiSafetyToC` מעגל לקרוב-שלם כדי **להשוות** מול רצפות ה-°C השלמות של הדאטה (grounding), לא כדי להציג — ההתנהגות נשמרת כלשונה (בדיקות p0 קיימות = עדות).
5. **`tempD` נפרד לדלתאות** — סובלנות ±°C לעולם אינה עוברת בענף ה-−32 (הלקח שכבר כתוב ב-app.js:166).
6. **Assertion נאכף (U-4, DoD):** לכל שדה-בטיחות מוצהר, ‏`convert(v,'temp',F,'safeFloor') ≥ המרה מדויקת` — בדיקה מונעת רגרסיית עיגול-מטה לתמיד.

## 6 · The data layer (U-4, Phase 3)

- **הצהרת-קנון:** מפת schema ‏`fieldKinds` בטבלה — ‏`svt/smt/tgt/safe/sot→temp` · `kg→mass` · ‏`svh/smh/soh→time(hr)` — היחידה הקנונית מפסיקה להיות מרומזת.
- **`cited` מובנה:** ברשומות `sources.py` שכבר נושאות את המקור בפרוזה — נוסף `cited={'v':145,'unit':'F'}` לצד ה-note (מיזוג-בנייה כמו היתר, אפס שינוי ב-data.py). כיסוי חלקי כן עדיף על היסק אוטומטי מהפרוזה (fail-closed; ‏Q4).
- הצרכן (DoD-5): ‏`UNITS.fmt(..., {cited})` — כרטיס-פריט מציג את המקור המצוטט כשיחידת-התצוגה תואמת; CP3 קורא את השדה כ-contract.

## 7 · Guard B unification (U-3)

**איך:** ‏build.py מחלץ את `UNITS_TABLE` מ-app.js (המרקרים, §3.1) ובונה את `_GB_UNIT_CLASS` ממנה:
- **המבנה** — משפחות, סדר-הערכה (`gbOrder`, משמר את אילוצי-הסדר המתועדים: cook_measure לפני time, temp לפני massG), מיפוי coarse (`tempC/tempF→temp` וכו') — **מהטבלה**.
- **צורות he/en/glyph** — נבנות מ-`tokens` של הטבלה (אותם tokens של זמן-הריצה).
- **צורות 23-השפות** — נשארות data של Guard B (`_GB_LANG_WORDS`, ‏keyed לפי אותם מזהי-משפחה מהטבלה) — זמן-הריצה לא צורך אותן, וה-lore המתועד (Cyrillic homoglyphs, ‏negative-lookaheads, הדרות מכוונות) נשמר במקומו.
- **בורג אנטי-drift:** לולאת-אימות בבנייה — **כל token זמן-ריצה חייב להתמיין תחת שורות Guard B המורכבות למשפחה שהטבלה מצהירה**; אי-התאמה → הבנייה נכשלת. בנוסף, מרקרים חסרים/JSON שבור → הבנייה נכשלת (fail-closed).

**מה נשבר אם השניים סוחפים (הנימוק):** טבלת-ריצה שמכירה unit ש-Guard B לא מכיר → תרגום נאמן מסווג `?` ונופל להשוואה-קשיחה → build אדום-שווא שחוסם שילוח; ‏Guard B שמכיר מה שהריצה לא → מחרוזת עוברת את שער-הבנייה אבל הקול/השער מסווגים fail-closed (redaction מיותר) או גרוע מזה — מספר נטול-סיווג שנקרא כקנוני (בדיוק צורת-הבאג שהולידה את R-26). מקור-אחד + לולאת-האימות מוחקים את המחלקה הזו.

## 8 · i18n composition — number-conversion layer × `__units__` word layer

שני צירים שאסור לערבב: **ציר-שפה** (שם היחידה — המילון) ו**ציר-סקאלה** (המספר — הרכיב). הרכב מדויק:

1. **המילונים נשארים קנוניים** — Guard B אוכף שאף `lang-XX` לא ממיר מספר. שכבת `__units__` של `tnode()` ממשיכה להחליף **מילות-יחידה** צמודות-ספרה בפרוזה מתורגמת (ס״מ→cm) — מילים, לא מספרים, ותמיד על ערכים קנוניים.
2. **המרה נומרית קורית רק ב-`UNITS.fmt`**, אחרי המילון, והפלט — מספר+תווית **אטומיים** בשפת-היעד (התוויות per-lang מהטבלה; ברירת-מחדל גליפים ניטרליי-שפה °C/°F/kg/lb).
3. **הפלט המומר מסומן `data-units-final`** (עטוף `dir="ltr"` — L13): ‏`tnode()` **מדלג** על טקסט בתוך `[data-units-final]`. בלי הדילוג, עיצוב נאיבי נשבר כך: ‏fmt מפיק "145 °F", ‏tnode רץ אחריו ומחיל rewrite של מילת-יחידה על השכנות ספרה-מילה — כתיבה-כפולה. הכלל: **מספר שהומר לעולם אינו חוזר לפרוזה כטקסט שעובר שכבת-עיבוד נוספת.**
4. **פרוזה לא-ממופרטרת** (עד המיגרציה, ואחריה במקומות שהם באמת פרוזה) נשארת קנונית-מטרית בכל 7 השפות — נכונה בהגדרה, גם כשהמשתמש בחר imperial: ההבטחה האימפריאלית חלה על readouts ממופרטרים (וזה מתויג בכנות ב-Settings עד השלמת המיגרציה — פסק ב').

## 9 · Fate of the ~150 format sites (Ruling A — sized honestly)

- **ספירה (מהחקירה, מאומתת):** ~89 אתרי `${x}°C` + ~61 גליפים מטריים קשיחים (ק״ג/ליטר/ס״מ) ≈ **150 אתרים**, פרוסים על כל משטחי-הרינדור (כרטיסים, טבלאות, timeline, occupancy, copilot, workplan, voice, share-text).
- **מנגנון:** מיגרציה **בגלים פר-משטח** (wave), כל גל ~15–25 אתרים; כלל-טרנספורמציה מכני אחיד (`${x}°C` → `${UNITS.fmt(x,'temp',{role})}`; שדות-בטיחות מקבלים `role:'safeFloor'`); שער פר-גל: ‏byte-identity במטרי (הסוויטה הקיימת + בדיקת-golden) + צילום 390×844 במטרי **ובאימפריאלי**.
- **אומדן כן:** ~7–9 גלים, כל גל משימת-DoD מלאה עם בנייה+סוויטה — **זה רוב עלות U-6**, לא ה-switch עצמו. ראו Q2 (פיצול U-6 בתוך Phase 10).
- **מה לא מהגר:** מחרוזות-מילון (נשארות קנוניות — Guard B), פרומפטי-AI (מנוסחים קנונית, §4), ערכי אחסון/חישוב (אין להם יחידת-תצוגה).

## 10 · Out of scope

- המרת ערכים מאוחסנים או שינוי `data.py`/מילונים — לעולם.
- המרת יחידות-זמן (דקות/שעות אוניברסליות; `time` בטבלה לצורך סיווג בלבד).
- תרגום-קול מעבר ל-he/en (‏T-GuardB-runtime הקיים), מטבעות, סקלת-מתכון (כמויות מצרכים).
- שכתוב ה-tokenizer של הקול מעבר לגזירת `SAFETY_UNIT` מהטבלה (הלוגיקה של vcGuardSpoken — R-2/R-3 — קפואה).

## 11 · Definition of Done (phase-gate checkable)

| # | שער | איך נבדק |
|---|---|---|
| D1 | `UNITS` קיים כ-namespace אחד; ‏`toCanonical`/`classify`/`fmt`/`normalize` בחתימות §3.2 | בדיקות `tests/units-core.spec.ts` ירוקות |
| D2 | חמשת המסווגים נגזרים/עטופים מהטבלה האחת; הליטרלים הישנים נמחקו | ‏grep: אין `VC_UNIT_CLASS=[`-literal, אין enumeration ב-isFahrenheitUnit; ‏golden-string ל-SAFETY_UNIT עבר לפני המחיקה |
| D3 | ‏`vcNormalizeSafetyText` מאציל ל-`UNITS.normalize` (הseam נצרך, לא נעקף) | קריאת הסימבול + בדיקת שוויון-התנהגות |
| D4 | ‏byte-identity במטרי: אתר מייצג ממופרטר מפיק פלט זהה-תו; הסוויטה המלאה ירוקה ×1 (H7) | פלט `npx playwright test` מודבק |
| D5 | ‏Guard B נבנה מהטבלה; לולאת האנטי-drift אוכפת; ‏diff ריק ב-`_guardB-fails` מול הבנייה הקודמת | פלט `python build.py` |
| D6 | עיגול כיווני: ‏safeFloor רק-מעלה, safeCeil רק-מטה, ‏cited passthrough מילולי — כולם עם בדיקת-שלילה | ‏tests + ‏DoD-10 assertion שמות-שדה |
| D7 | ‏`cited:{v,unit}` ממוזג-בנייה ונקרא ע"י צרכן אמיתי (fmt/כרטיס; DoD-5) | בדיקה + צילום |
| D8 | ייבוא: ‏`propParse`/`propCoerce` עטופים על `toCanonical`; התנהגות קיימת זהה (fail-closed null נשמר) | הסוויטה הקיימת של הציוד ירוקה |
| D9 | אופציית imperial מתוקנת: מבקשת אימפריאלי ב-AI בפועל; תיוג-scope כן ב-Settings | צילום עברית 390×844 + בדיקת-פרומפט |
| D10 | תצוגה אימפריאלית: ‏`displayUnit` קורא את ה-pref; כל גלי-המיגרציה סגורים או ששאריתם רשומה במרשם עם תיוג-scope כן | לוח-הגלים בתוכנית + H10 |
| D11 | בטיחות-אינווריאנטית: אף `safe`/`temp`/משך לא השתנה באחסון | ‏DoD-10 בכל משימה; ‏grep-diff על data.py = ריק |
| D12 | עברית + 6 שפות: readout ממומר נכון בפרוזה מתורגמת; ‏`dir="ltr"` islands | צילומים + בדיקת `[data-units-final]` |

## 12 · Open questions for the owner (spec questions — לא הוכרעו כאן)

- **Q1 · קול במצב imperial:** כשהמשתמש בחר imperial — האם שער-הבטיחות הקולי דובר °F (מומר, safeFloor-ceil) או תמיד °C קנוני? **המלצה:** עוקב אחרי ה-pref (עקביות עין-אוזן), עם עיגול-הבטיחות; אבל זו החלטת-מוצר בטיחותית — של הבעלים.
- **Q2 · פיצול U-6 בתוך Phase 10 (בקשת-פיצול, לא שינוי-phase):** התכולה המוסכמת נשמרת (U-6 ב-Phase 10), אך 150 אתרים במשימה אחת מפרים task-right-sizing. **הצעה:** ‏U-6a (התיקון+ה-switch) + ‏U-6b..h (גלי-מיגרציה, ~7). ראיה: כל גל צריך שער-DoD עצמאי (בנייה+סוויטה+צילומים). לחלופין: התחלת גלים אופורטוניסטית מוקדם יותר ("כשנוגעים במשטח ממילא", Circle of Control) — מקטין את חשבון Phase 10 אך מקדים עבודת-R-26 לפני ה-switch.
- **Q3 · דיבור יחידות במילים:** להחליף '63°C' הדבור ב"63 מעלות צלזיוס" (fmt voice:true)? משנה בדיקות R-2/R-3 קיימות במכוון. **המלצה:** כן, ב-U-6, יחד עם Q1.
- **Q4 · כיסוי `cited`:** ‏U-4 מאכלס רק רשומות שהמקור כבר מילולי בפרוזת-הציטוט (כ-provenance ידני, fail-closed). השלמה ל-279 הציטוטים — עבודת-CP3 (Phase 7) או משימת-דאטה נפרדת? **המלצה:** עם CP3.

---

## 🧑 פסקי בעלים על שאלות ה-spec (31.7.2026)

| # | השאלה | הפסק |
|---|---|---|
| **Q1** | מה הקול אומר במצב אימפריאלי? | **°F מומר, עם עיגול בטיחותי כלפי מעלה** — מה שנראה הוא מה שנשמע. רצפת בטיחות מעוגלת תמיד כלפי מעלה (63°C → 146°F, לא 145°F); המספר הנאמר לעולם אינו נמוך מהמקור. חל על U-6f. |
| **Q2** | פיצול U-6 ל-U-6a + 7 גלים בתוך Phase 10 | **מאושר** (החלטת בקר, נמסרה לבעלים): הפיצול נשאר כפי שנכתב; גל מוקדם הזדמנותי מותר רק כשנוגעים באתרים ממילא (Circle of Control), ונרשם. |
| **Q3** | יחידות בדיבור בצורת מילים ("63 מעלות צלזיוס") | **לא עכשיו** — נשאר כפי שהוא. שינוי כזה נוגע במחרוזות הבדיקה של R-2/R-3 שנסגרו הבוקר; ייבחן בנפרד אחרי שהשכבה יציבה. |
| **Q4** | היקף השדה `cited` | **מושלם יחד עם CP3 (Phase 7)** — ‏U-5 מספק את המבנה והדלת; מילוי הכיסוי לכל 279 הפריטים נוסע עם עבודת הנתונים המצוטטת, לא כמשימת דאטה נפרדת. |

**נגזרת לתכנון:** U-1..U-3 → Phase 1 (אחרי שילוח v278, בשילוח נפרד) · U-4/U-5 → Phase 3 · U-6a+גלים → Phase 10.
