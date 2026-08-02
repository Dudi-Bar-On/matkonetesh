# בטיחות המלחה וגבינה — מה באמת שולט, ומה `safe` לא מסוגל לתאר

**תאריך:** 2026-08-02 · **סוג:** מחקר מקורות ראשוניים · **סטטוס:** ממצאים לקבלת החלטה
**רקע:** סריקת קטלוג מצאה 74 פריטים בלי ערך `safe`. הערת הבעלים (2.8.26):
> "בעקרון אם צריך להשלים אבל להבנתי הבטיחות שם לא עוסקת בטמפרטורה אלא ב cure#1, cure#2"

**המסקנה בשורה אחת:** הבעלים צודק לגבי רוב הפריטים, ולא לגבי כולם. מתוך 14 פריטי הבשר/צ'רקוטרי —
ל‑6 יש טמפרטורת קטלניות פנימית אמיתית, ל‑6 אין כזו בכלל, ול‑2 (בייקון) `safe` הוא **השדה הלא נכון**
כי המוצר אינו ready‑to‑eat מלכתחילה.

> **כלל שנשמר לאורך כל המסמך:** כל מספר נושא את מקורו. היכן שלא הצלחתי לאמת ממקור ראשוני —
> כתוב **UNDETERMINED**, לא ניחוש. הבחנה מפורשת בין *מה שהמקור אומר* לבין *מה שאני מסיק*.

**הערת §10.11:** הגרף הגלובלי של graphify נשאל תחילה עבור
`nitrite`, `curing`, `jerky`, `sausage`, `listeria`, `water activity`, `FSIS`, `botulism`, `cheese`,
`pasteurization`, `food safety` — **אין בו שום קורפוס בטיחות מזון**. שתי ההתאמות היחידות
(`water activity`, `food safety`) הן צמתים תוכנתיים לא‑קשורים. מכאן — חיפוש רשת, כמתועד למטה.

---

## 1 · מה באמת שולט בכל אחת מארבע מחלקות המוצר

### 1.1 המכנה המשותף — מלחי ההמלחה (nitrite / nitrate)

הרגולציה האמריקאית **אינה** מכירה בשמות המסחריים "Prague Powder #1/#2" או "Cure #1/#2". היא מגבילה
את החומר עצמו. ‏9 CFR §424.21(c), טבלת Curing Agents (המקור ההיסטורי שהבעלים הזכיר, §318.7, הועבר לכאן):

> **Sodium or potassium nitrite** — "2 lb to 100 gal pickle at 10 percent pump level;
> **1 oz to 100 lb meat or poultry product (dry cure); 1/4 oz to 100 lb chopped meat**, meat byproduct
> or poultry product. **The use of nitrites, nitrates or combination shall not result in more than
> 200 ppm of nitrite**, calculated as sodium nitrite in finished product, except that nitrites may be
> used in bacon only in accordance with paragraph (b) of this section."

> **Sodium or potassium nitrate** — Products: "**Cured meat products other than bacon.**" ·
> "7 lb to 100 gal pickle; 3 1/2 oz to 100 lb meat or poultry product (dry cure);
> 2 3/4 oz to 100 lb chopped meat or poultry."

*(מקור: eCFR, 9 CFR §424.21(c), נמשך 2026‑08‑02 — https://www.ecfr.gov/current/title-9/section-424.21)*

**זה מסביר את ההבחנה #1 / #2 בלי להסתמך על שם מסחרי:** ניטרט (nitrate) מותר **רק** במוצרים שאינם
בייקון — כלומר במוצרים ארוכי‑הבשלה שבהם דרוש מאגר ניטריט מתמשך. זו בדיוק ההבחנה בין Cure #1
(ניטריט בלבד → מוצרים שנאכלים אחרי בישול/עישון קצר) ל‑Cure #2 (ניטריט + ניטרט → יבש/מותסס לשבועות).

**חישוב שלי, מסומן ככזה (לא ציטוט):** ‏1/4 oz ל‑100 lb = ‏7.087 g ל‑45,359 g = **156 ppm**.
זהו בדיוק המספר שהעולם המקצועי מכיר כ"4 oz Cure #1 ל‑100 lb". המספר נגזר מה‑CFR, לא ממתכון.

**גבול הבייקון — 9 CFR §424.22(b), ציטוטים מדויקים:**
- **Pumped/massaged bacon:** "sodium nitrite shall be used at **120 parts per million (ppm) ingoing**
  or an equivalent amount of potassium nitrite (**148 ppm ingoing**); and **550 ppm of sodium ascorbate
  or sodium erythorbate** (isoascorbate) shall be used."
- חלופה: "**100 ppm ingoing** (potassium nitrite at 123 ppm) ... **or** a predetermined level between
  **40 and 80 ppm** ... plus additional sucrose ... at a minimum of **0.7 percent** and an inoculum of
  lactic acid producing bacteria ... **for the purpose of preventing the production of botulinum toxin**."
- **Immersion cured bacon:** "shall not exceed **120 ppm ingoing**".
- **Dry cured bacon:** "shall not exceed **200 ppm ingoing** (potassium nitrite at 246 ppm ingoing)".

*(מקור: eCFR, 9 CFR §424.22(b), נמשך 2026‑08‑02)*

**מינימום ניטריט — הפער החשוב:** ה‑CFR האמריקאי קובע **תקרה** בלבד, לא רצפה. הרצפה המספרית היחידה
שמצאתי במקור רגולטורי ראשוני היא קנדית — CFIA, "Preventive control recommendations for manufacturing
fermented and dried meat products", תחת *Control of Clostridium botulinum in fermented meat products*:
> "nitrite/nitrate are added at a minimum level of **100 ppm** along with a minimum of **2.5% of salt**."

*(https://inspection.canada.ca/en/food-safety-industry/preventive-control-plans/controls-food/meat/fermented-and-dried)*

זו נקודה מהותית לשומר: טענה כמו "156 ppm" אינה ניתנת **לא** לאישור ולא להפרכה מול שדה שהוא תקרה בלבד.

---

### 1.2 נקניק מיובש/מותסס (dry & semi‑dry fermented sausage)

מסמך השליטה: **FSIS Ready‑to‑Eat Fermented, Salt‑Cured, and Dried Products Guideline**
‏(FSIS‑GD‑2023‑0002, 105 עמ'). המשוכות, כפי שהמסמך עצמו מונה אותן:

**א. degree‑hours — שליטה ב‑Staphylococcus aureus.** הגדרה מילולית מהמסמך:
> "Degree‑hours is the amount of time in hours **above 60°F** (the critical temperature at which
> staphylococcal growth effectively begins) an establishment's fermentation process can take at a
> specific temperature to **reduce the pH to 5.3 or below** in order to control S. aureus growth."
> · "The limitation of the number of degree‑hours depends upon the **highest temperature** in the
> fermentation process prior to the time that a pH of 5.3 or less is attained."

הטבלה המספרית עצמה נגזרת מ‑AMI Foundation, *Good Manufacturing Practices for Fermented Dry and Semi‑Dry
Sausage Products*, ומופיעה מילולית במסמך ההדרכה הרשמי של FSIS
**"Lethality, Stabilization and Multiple Hurdles" (10/27/2021)**:
> "Processes attaining a temperature **less than 90°F** before reaching pH 5.3 are limited to
> **1200 degree‑hours**. Processes reaching a temperature of **90°F–100°F** ... limited to
> **1000 degree‑hours**. Processes exceeding **100°F** ... limited to **900 degree hours**."

| Maximum Temperature | Maximum Degree Hours |
|---|---|
| < 90°F | 1200 |
| 90°F to 100°F | 1000 |
| > 100°F | 900 |

*(מקור: FSIS‑GD‑2023‑0002; FSIS 25_IM_Lethality‑Stabilization‑Student‑10272021.pdf)*
*(השוואה: CFIA נוקבת במספרים אחרים לגמרי — 665 / 555 / 500 degree‑hours מעל 33°C / 33–37°C / >37°C.
שתי הרשויות אינן מסכימות. **זהו פער שדורש הכרעת מומחה**, ראו §5.)*

**ב. אזהרת FSIS המפורשת — degree‑hours אינו מספיק.** ציטוט, ההדגשה במקור:
> "It is **not enough** to only meet degree‑hours, follow a drying or salt‑curing method for
> Trichinella, and achieve a final water activity for shelf‑stability. Degree‑hours are intended to
> control the outgrowth of *S. aureus*. To reduce levels of other pathogens such as Salmonella,
> products often need to be fermented to a **lower pH than 5.3**."
> · "**Fermentation and drying alone are not particularly effective lethality treatments.**"

**ג. יעדי הקטלניות (log targets):**
> "FSIS recommends that the lethality treatment ... achieve at least a **5.0‑log reduction of
> Salmonella, STEC (in beef), and at least a 3.0‑log reduction in Lm**."

**ד. פעילות מים (a_w) ליציבות מדף:** "water activity ≤ **0.85**" (חוזר פעמיים במסמך, לגבי מיובשי
מלח ומיובשי המלחה כאחד), "especially toxigenic microorganisms such as S. aureus".

**ה. טריכינלה — שינוי רגולטורי שחשוב לדעת:** ‏**9 CFR §318.10 הוא היום `[Reserved]`** — אימתתי מול
eCFR. הדרישות המפורטות (חימום/הקפאה/ייבוש/המלחה) בוטלו בחוק הסופי
*"Elimination of Trichinae Control Regulations"*, ‏83 FR 25302, 31.5.2018, ובמקומן באה חובת ניתוח
סיכונים לפי 9 CFR part 417 + ה‑FSIS Trichinella Guideline. **אין יותר טבלת ימי‑ייבוש מחייבת ב‑CFR.**

**ו. אין תקן זהות:** ‏9 CFR part 319 — **Subpart I "Semi‑Dry Fermented Sausage [Reserved]"** ו‑
**Subpart J "Dry Fermented Sausage [Reserved]"**. אין standard of identity לסלמי/פפרוני/קבנוס.
מה שכן קיים ב‑319 (למשל §319.180 פרנקפורטר, §319.107 בייקון) הוא **הרכבי** — אחוז שומן, מים מוספים,
PFF — **לא טמפרטורות בטיחות**. אימתתי את כל אלה מול eCFR.

---

### 1.3 נקניק מעושן (smoked sausage) — כאן צריך להבחין

הקטלוג מערבב שני דברים שונים לגמרי תחת `cat="נקניק מעושן"`:

**(א) מבושל‑מעושן (cooked‑smoked)** — קילבסה, אנדוי, סרוולט, סאמר סוסג'. אלה עוברים **שלב קטלניות
תרמי אמיתי** ולכן **יש** להם טמפרטורה פנימית משמעותית. מסמך השליטה:
**FSIS Cooking Guideline for Meat and Poultry Products (Revised Appendix A)**, דצמבר 2021.
הערת השוליים 5 לטבלה 2, מילולית:
> "The required Log reductions are achieved **instantly (0 seconds)** when the internal temperature of a
> cooked meat product reaches **158°F or above**." *(158°F = 70°C)*

והכותרת של טבלה 2 עצמה:
> "Temperatures stated are the **minimum internal temperatures** that must be met in all parts of the
> meat product for the total dwell time listed. ... **Relative humidity and heating come‑up‑time (CUT)
> are also critical operating parameters** when using this table."

כלומר: מתחת ל‑70°C המספר לבדו חסר משמעות — נדרש זוג (טמפרטורה, זמן שהייה) + לחות. הקטלוג היום נוקב
`tgt=68` לארבעת אלה — **68°C נמצא מתחת לסף ה‑"מיידי"** ולכן דורש זמן שהייה מטבלה 2. ראו §5.

**(ב) מעושן‑לא‑מבושל (uncooked, smoked)** — 9 CFR part 319 **Subpart F "Uncooked, Smoked Sausage"**
קיים כקטגוריה. עבור אלה, העישון **אינו** קטלניות והמצב זהה למחלקה 1.2. אף לא אחד מ‑14 פריטי המשימה
נופל כאן לפי הקטלוג הנוכחי, אבל הקטגוריה קיימת בקטלוג הרחב.

---

### 1.4 בשר מיובש — ג'רקי לעומת בילטונג (שני מוצרים, שתי בעיות שונות)

**FSIS מפריד ביניהם במפורש.** ‏FSIS‑GD‑2023‑0002, מילולית:
> "This guideline does not cover **jerky**, which is considered a dried product, as **most jerky
> processes rely on cooking** ... to achieve lethality. Guidance regarding the production of jerky
> [is in] *FSIS Compliance Guideline for Meat and Poultry Jerky Produced by Small and Very Small
> Establishments*."

ובאותו מסמך, **בילטונג ודרוורס נמצאים דווקא ברשימת המוצרים שכן מכוסים** (יחד עם
"dried beef, beef nuggets, steak tenders, kippered beef, meat sticks, tasajo, pemmican, pipi kaula,
droëwors, biltong, jamon"), ויש להם טבלת תמיכה מדעית ייעודית ("Table 12. Summary of Scientific
Support Available for Lethality in Biltong").

**ג'רקי — FSIS Compliance Guideline for Meat and Poultry Jerky (2014):**
- קטלניות: "The lethality treatment of **meat** jerky should achieve at least a **5.0‑log10 reduction of
  Salmonella spp. and at least a 5.0‑log10 reduction for STEC** for products containing beef." ·
  "The lethality treatment of **poultry** jerky should achieve at least a 5.0‑log10 reduction of
  Salmonella spp." · "at least a **3.0‑log10 reduction in Lm**".
- **הלחות היא תנאי לקטלניות, לא נוחות:** "it is **crucial that the processor prevent drying of the
  product until a lethal time‑temperature combination is attained**" · "the drying of the product
  surface before the pathogens are destroyed will **increase pathogen heat resistance** and allow them
  to survive the heating process" · "establishments may not introduce relative humidity into the
  process until **15 to 30 minutes** after the product is placed in the heated oven."
- סדר הפעולות: "FSIS also recommends that establishments treat the **lethality and drying steps as
  separate stages** to ensure that lethality is achieved **before** the product dries out."
- טמפרטורה כהתערבות: "Preheating the meat or poultry jerky strips in the marinade to a **minimum
  internal temperature of 160°F** will provide an immediate reduction of Salmonella (Harrison and
  Harrison, 1996)." *(160°F = 71°C)*
- ‏a_w סופי: "a water activity critical limit of **0.85 or lower** should be targeted for products
  stored in an **aerobic** ... environment ... If the product is **vacuum packaged** in an oxygen
  impervious packaging ... then the water activity critical limit can be **0.91 or lower**. These
  limits are based on the growth limits for *Staphylococcus aureus* with and without oxygen present
  (ICMSF, 1996)."
- ‏**MPR נפסל מפורשות:** "MPR is an **inappropriate indicator** of shelf‑stability. Water activity ...
  is the more appropriate indicator."
- **המלחה אינה נדרשת לג'רקי** — המסמך אינו מציב דרישת ניטריט; הקטלניות תרמית.

**בילטונג — אין שלב בישול כלל.** FSIS‑GD‑2023‑0002, נספח 10:
> "Some dried products, such as **biltong**, contain a marination step with acids such as **vinegar
> (acetic acid)** that contribute to the overall reductions of pathogens. Critical operational
> parameters for antimicrobial application include the **pH, temperature, pressure or flow rate,
> coverage, and contact time**."

כלומר: לבילטונג הבטיחות היא חומצה + מלח + a_w — **ואין לו טמפרטורה פנימית בכלל**.

---

### 1.5 בייקון — לא ready‑to‑eat, ולכן `safe` הוא השדה הלא נכון

**FSIS Generic HACCP Model for Heat‑Treated, Not Fully Cooked (Bacon)**, מילולית:
> "Bacon receives a heat processing step but **the application of heat is not adequate to achieve food
> safety**. Therefore, **bacon is not ready‑to‑eat**, it must be kept refrigerated or frozen, and it is
> **cooked before consumption**."

ובגיליון העובדות של FSIS *Bacon and Food Safety*: "Pork bacon without any other descriptors is raw or
uncooked, and **must be cooked before eating**."

לכן עבור בייקון: הבטיחות היא (1) המלחה בגבולות §424.22(b) לעיל, (2) **קירור**, (3) בישול על ידי הצרכן.
טמפרטורת בית‑העישון (הקטלוג: `smt=90`, `tgt=65`) היא **פרמטר איכות/מרקם, לא ערך בטיחות**.

---

## 2 · האם קיימת טמפרטורה פנימית משמעותית? — 14 הפריטים, שלוש קבוצות

| # | פריט (`n` ב‑`SPECS`) | `cat` | קבוצה | טמפ׳ פנימית משמעותית? |
|---|---|---|---|---|
| 1 | ג'רקי בקר | בשר מיובש | **A** | **כן** — שלב הקטלניות הוא בישול. אך המספר לבדו אינו מספיק (לחות + a_w) |
| 2 | ג'רקי הודו | בשר מיובש | **A** | **כן** — אותו דבר; הערת הקטלוג "74°C" עקבית עם מוצר עוף |
| 6 | קילבסה | נקניק מעושן | **A** | **כן** — cooked‑smoked; Appendix A |
| 7 | אנדוי | נקניק מעושן | **A** | **כן** — cooked‑smoked; Appendix A |
| 8 | סרוולט | נקניק מעושן | **A** | **כן** — cooked‑smoked (+ התססה) |
| 9 | סאמר סוסג' | נקניק מעושן | **A** | **כן** — מותסס **ואז** מבושל; שתי משוכות במקביל |
| 3 | בילטונג | בשר מיובש | **B** | **לא** — אין בישול. חומץ + מלח + a_w |
| 10 | קבנוס | נקניק מיובש | **B** | **לא** — עישון קר‑פושר 50°C אינו קטלניות |
| 11 | סלמי | נקניק מיובש | **B** | **לא** — עישון קר אופציונלי בלבד |
| 12 | צ'וריסו מיובש | נקניק מיובש | **B** | **לא** — עישון קר אופציונלי בלבד |
| 13 | לנדיגר | נקניק מיובש | **B** | **לא** — עישון קר 50°C; לא קטלניות |
| 14 | פפרוני | נקניק מיובש | **B** | **לא** — מיובש‑מותסס; שייך לקבוצת הבעלים אף שלא נמנה בה |
| 4 | בייקון חזיר | בייקון | **C** | **השדה הלא נכון** — NRTE; הצרכן מבשל |
| 5 | בייקון בקר | בייקון | **C** | **השדה הלא נכון** — NRTE; הצרכן מבשל |

**סיכום: 6 · 6 · 2.**
- **קבוצה A (6):** מותר למלא `safe` — אבל **רק** עם המקור והסייג ("הטמפרטורה לבדה אינה מספיקה").
- **קבוצה B (6):** `safe` צריך להישאר **ריק**. "חסר" מתאר את המצב באופן שגוי; המצב הוא *לא רלוונטי*.
- **קבוצה C (2):** `safe` הוא שדה שגוי לחלוטין. המוצר אינו RTE.

---

## 3 · צורת הנתונים המינימלית, ומקור לכל שדה

השומר כבר מכיר את סוג‑הטענה `cure_ppm` (‏`app.js:8325`, `SAFETY_CLAIM_SAFETY_KINDS` ב‑`app.js:8494`)
אך "no field in the catalog carries a ppm figure — so a `cure_ppm` claim can never match and is always
redacted" (ההערה בקוד עצמו, `app.js:8531`). ההצעה מוסיפה בדיוק את מה שחסר ולא יותר.

הצורה מחקה את `CUT_SOURCES` הקיים ב‑`sources.py` (‏`src.<field>.{ref,url,note}` + `verified`):

```python
"safety": {
  # איזה מודל בטיחות שולט — קובע אילו שדות אחרים בכלל תקפים ומה ה-UI/AI רשאים לומר
  "model": "cook_lethality" | "ferment_dry" | "dry_acid" | "cure_nrte",

  # קיים אך ורק כאשר model == "cook_lethality"
  "safe_c": 70,
  "safe_dwell": "0s @70C",        # זוג (טמפ׳, זמן שהייה); ריק = אין ערך

  "rte": True | False,            # False ⇒ אסור להציג "בטוח לאכילה ב-X°C"

  "cure": {
    "agent": "nitrite" | "nitrite+nitrate",   # לא "Cure #1/#2" — אלה שמות מסחריים
    "nitrite_ppm_max_finished": 200,
    "nitrite_ppm_max_ingoing": 120 | 200,     # בייקון בלבד; לפי שיטת ההמלחה
    "nitrate_permitted": True | False
  },

  "aw_max": 0.85,                 # אווירני
  "aw_max_anaerobic": 0.91,       # ואקום
  "ph_target": 5.3,               # נקודת עצירת S. aureus
  "degree_hours_max": {"lt_90F": 1200, "f90_100": 1000, "gt_100F": 900},
  "log_targets": {"salmonella": 5.0, "stec": 5.0, "lm": 3.0},

  "src": { ... }, "verified": "2026-08-02"
}
```

**המקור המצוטט לכל שדה — זו הנקודה שהמשימה ביקשה להיות קונקרטית לגביה:**

| שדה | מקור מצוטט (`ref` + `url`) |
|---|---|
| `safe_c`, `safe_dwell` | FSIS Cooking Guideline (Revised Appendix A), Dec 2021, Table 2 + הערת שוליים 5 — `https://www.fsis.usda.gov/guidelines/2021-0014` |
| `rte` | ‏FSIS Generic HACCP Model — Bacon (Heat‑Treated, Not Fully Cooked), FSIS‑GD‑2021‑0002 |
| `cure.nitrite_ppm_max_finished`, `nitrate_permitted` | 9 CFR §424.21(c), טבלת Curing Agents — `https://www.ecfr.gov/current/title-9/section-424.21` |
| `cure.nitrite_ppm_max_ingoing` (בייקון) | 9 CFR §424.22(b)(1)–(3) — `https://www.ecfr.gov/current/title-9/section-424.22` |
| `aw_max`, `aw_max_anaerobic` | FSIS Jerky Compliance Guideline 2014, עמ' 15 (ICMSF 1996) · ו‑FSIS‑GD‑2023‑0002 נספחים 10–11 |
| `ph_target`, `degree_hours_max` | FSIS‑GD‑2023‑0002 (הגדרה) + FSIS "Lethality, Stabilization and Multiple Hurdles" 10/27/2021 (הטבלה) |
| `log_targets` | FSIS‑GD‑2023‑0002 §"Targets" · FSIS Jerky Guideline 2014 |

**מה זה נותן לשומר:** `cure_ppm` מקבל סוף‑סוף מולו ערך. אבל — ראו §5 — התאמה **מדויקת** (השוואת שוויון,
כפי שהיא היום ב‑`app.js:8518`) תיכשל תמיד, כי הערך ב‑CFR הוא **תקרה** ולא נקודה.

---

## 4 · גבינה מעושנת (33 פריטים) — התשובה הכנה

**לא קיימת "טמפרטורת בטיחות פנימית" לגבינה. זה לא מושג שחל.** אין ב‑21 CFR, אין ב‑FDA Food Code,
ואין ב‑PMO שום דרישה המנוסחת כטמפרטורת בישול פנימית לגבינה — לא לגבינה מעושנת ולא לאחרת.
המספרים היחידים שקיימים הם משלושה סוגים אחרים לגמרי:

**(א) פסטור החלב — לפני הגבינה, לא בתוכה.** ‏21 CFR §133.3(d), מילולית:
> "**Pasteurized** ... every particle of such ingredient shall have been heated ... and held
> continuously at or above that temperature for the specified time":
> **145 °F / 30 min · 161 °F / 15 s · 191 °F / 1 s · 204 °F / 0.05 s · 212 °F / 0.01 s**
> · "If the dairy ingredient has a fat content of 10 percent or more, the specified temperature shall be
> **increased by 5 °F**." · §133.3(e) Ultrapasteurized: "at or above **280 °F for at least 2 seconds**".

*(אימתתי מילולית מול eCFR, 21 CFR part 133, נמשך 2026‑08‑02.)*

**(ב) חלופת ה‑60 יום לחלב גולמי — דרישת *הבשלה בקירור*, ההפך מבישול.** נוסח זהה חוזר בעשרות תקני זהות,
למשל §133.113 (Cheddar) ו‑§133.108 (Brick):
> "If the dairy ingredients used are **not pasteurized**, the cheese is cured at a temperature of
> **not less than 35 °F for at least 60 days**."

וב‑§133.102 (Blue): "Blue cheese is at least **60 days** old." ‏(21 CFR §1240.61 הוא האיסור הכללי על
מכירת חלב לא‑מפוסטר; חריגי part 133 הם מה שמתיר גבינות חלב גולמי מיושנות.)

**(ג) האם הגבינה היא TCS — כאן pH ו‑a_w, לא טמפרטורה.** ‏FDA Food Code 2022, §1‑201.10(B), Table A/B —
אימתתי מילולית מה‑PDF הרשמי:

*Table A (מחוממת להשמדת תאים וגטטיביים, ואז ארוזה):*
| a_w | pH ≤ 4.6 | pH > 4.6–5.6 | pH > 5.6 |
|---|---|---|---|
| ≤ 0.92 | non‑TCS | non‑TCS | non‑TCS |
| > 0.92–0.95 | non‑TCS | non‑TCS | **PA** |
| > 0.95 | non‑TCS | **PA** | **PA** |

*Table B (לא מחוממת, או מחוממת ולא ארוזה):*
| a_w | pH < 4.2 | 4.2–4.6 | > 4.6–5.0 | > 5.0 |
|---|---|---|---|---|
| < 0.88 | non‑TCS | non‑TCS | non‑TCS | non‑TCS |
| 0.88–0.90 | non‑TCS | non‑TCS | non‑TCS | **PA** |
| > 0.90–0.92 | non‑TCS | non‑TCS | **PA** | **PA** |
| > 0.92 | non‑TCS | **PA** | **PA** | **PA** |

‏(**PA** = Product Assessment required.)

ובנוסף, ‏Food Code §3‑501.17(G) פוטר מסימון‑תאריך במפורש:
> "(2) **Hard cheeses containing not more than 39% moisture** as defined in 21 CFR 133 ... such as
> cheddar, gruyere, parmesan and reggiano, and romano; (3) **Semi‑soft cheeses containing more than 39%
> moisture, but not more than 50% moisture** ... such as blue, edam, gorgonzola, gouda, and monterey jack"

והנימוק בנספח 3: "hard and semi‑soft cheeses each manufactured according to 21 CFR 133 are **exempt from
date marking**" בשל "organic acids, preservatives, competing microorganisms, pH, water activity, or salt
concentration". רשימות השמות המלאות מופיעות שם ("LIST OF HARD CHEESES / SEMI‑SOFT CHEESES EXEMPT FROM
DATE MARKING") וכוללות Cheddar, Colby, Emmentaler, Asiago medium/old · Blue, Brick, Edam, Gouda, Havarti,
Gorgonzola, Fontina.

**(ד) ליסטריה.** ‏FDA, *Control of Listeria monocytogenes in Ready‑To‑Eat Foods: Guidance for Industry*
(final, 2017) מונה במפורש גבינות רכות/רכות‑מבשילות ‏(Cottage, Cream, Ricotta, Queso Fresco, Blue, Brick,
Monterey, Brie, Camembert, Feta) כמזונות **שתומכים בגידול** L. monocytogenes, וקובע ספי גורמים פנימיים
של **pH ≤ 4.4 או a_w ≤ 0.92** כמונעי‑גידול.

**(ה) עישון קר — פער נקוב.** **לא מצאתי ב‑FDA/CFR/Food Code שום תקרת טמפרטורה או מגבלת זמן ייעודית
לעישון קר של גבינה.** המספר היחיד הרלוונטי ב‑Food Code הוא החזקה בקור הכללית למזון TCS ‏(≤41°F/5°C),
ולא מגבלת תא‑עישון. **UNDETERMINED — ראו §5.**

### מסקנת הגבינה, בשורה אחת
עבור 33 פריטי הגבינה, **`safe` צריך להישאר ריק, וזו התשובה הנכונה ולא פער**. אם רוצים לומר משהו נכון
ומצוטט, הדבר היחיד שניתן לומר הוא: *"גבינה מפוסטרת (או מיושנת ≥60 יום ב‑≥35°F לפי 21 CFR §133.113)
בטוחה לאכילה כמות שהיא; אין לה טמפרטורת בישול פנימית."* — וזה טקסט, לא מספר.

---

## 5 · פערים שדורשים הכרעת מומחה — לא להמציא מספר

> הבעלים ביקש במפורש: **פער נקוב עדיף על מספר סמכותי‑למראה.** אלה הפערים.

| # | הפער | למה זו הכרעת מומחה ולא החלטת מפתח |
|---|---|---|
| **G1** | **`tgt=68` לארבעת המבושלים‑מעושנים** (קילבסה, אנדוי, סרוולט, סאמר סוסג'). ‏68°C נמצא **מתחת** לסף ה‑158°F/70°C ה"מיידי" של Appendix A, ולכן חוקי **רק** עם זמן שהייה מטבלה 2 שלא נקבע אצלנו | לבחור זוג (טמפ׳, זמן) מטבלה 2 זו החלטת בטיחות. אסור להעלות ל‑70 "כדי שיסתדר" ואסור להשאיר 68 בלי זמן |
| **G2** | **degree‑hours: FSIS נוקבת 1200/1000/900, CFIA נוקבת 665/555/500.** פער של פי ~2 בין שתי רשויות | איזו רשות קובעת עבור משתמש ישראלי? זו הכרעת מדיניות‑מוצר עם השלכת בטיחות ישירה |
| **G3** | **מינימום ניטריט לשליטה ב‑*C. botulinum*** — ל‑CFR האמריקאי **אין** רצפה, רק תקרה. הרצפה היחידה שמצאתי היא CFIA (‏100 ppm + 2.5% מלח) | בלי רצפה, השומר לא יכול להזהיר מפני **תת**‑המלחה — שהיא סכנת הבוטוליזם האמיתית בצ'רקוטרי ביתי |
| **G4** | **השומר משווה שוויון מדויק ל‑`cure_ppm`** (‏`app.js:8518`). ערך CFR הוא **תקרה**, לא נקודה. השוואת שוויון תיכשל תמיד | דורש שינוי סמנטיקה של השומר (`≤` במקום `=`) — שינוי בלוגיקת בטיחות, לא ריפקטור |
| **G5** | **טריכינלה בנקניק חזיר מיובש ביתי.** ‏9 CFR §318.10 בוטל (83 FR 25302); אין יותר טבלת ימי‑ייבוש מחייבת, ובמקומה ניתוח סיכונים לפי part 417 | אין מספר להעתיק. חזיר‑מיובש‑ביתי הוא בדיוק המקרה שבו הרגולטור החליף מספר בשיפוט מקצועי |
| **G6** | **תקרת טמפרטורה לעישון קר** (בשר וגבינה כאחד). לא קיימת ב‑FDA/CFR/Food Code | אם המוצר צריך להציג מספר, הוא יבוא ממקור שאינו ראשוני — החלטה מודעת שרק הבעלים יקבל |
| **G7** | **חלומי, מוצרלה, ברי ודומיהן** — גבינות טריות/רכות בעלות a_w גבוה נופלות בצד ה‑TCS/PA של Table A/B. **לא אימתתי ערכי pH/a_w ספציפיים לאף פריט בקטלוג** | סיווג TCS פר‑פריט דורש נתוני pH/a_w אמיתיים לגבינה הספציפית — לא ניתן להסיק מהשם |
| **G8** | **התוקף הגיאוגרפי.** כל המסמך נשען על USDA/FSIS/FDA. המשתמשים בישראל | האם ערכי USDA הם הבסיס הנכון? זו החלטה שכבר התקבלה עבור `safe` הקיים, אבל היא לא נבחנה עבור המלחה |

**פער מתודולוגי אחד נוסף, מוצהר:** `www.fsis.usda.gov` ו‑`www.usda.gov` מחזירים **HTTP 403** גם ל‑WebFetch
וגם ל‑curl מהסביבה הזו. כל מסמכי FSIS כאן הובאו דרך `web.archive.org/web/2024id_/<url>` או דרך מראה
מוסדית (‏`ncagr.gov`, `maine.gov`, `archive.legmt.gov`). התוכן אומת כ‑PDF מקורי, אך **מי שמאמת מחדש
צריך לדעת שהקישור הישיר ייכשל**.

---

## נספח · המקורות הראשוניים שנמשכו ואומתו (2026‑08‑02)

| מסמך | מזהה | כתובת |
|---|---|---|
| 9 CFR §424.21 — Use of food ingredients (טבלת Curing Agents) | eCFR current | https://www.ecfr.gov/current/title-9/section-424.21 |
| 9 CFR §424.22 — נוסחאות ניטריט בבייקון | eCFR current | https://www.ecfr.gov/current/title-9/section-424.22 |
| 9 CFR part 319 — תקני זהות (Subparts F/G/I/J) | eCFR current | https://www.ecfr.gov/current/title-9/part-319 |
| 9 CFR §318.10 — `[Reserved]` (בוטל) | eCFR current | https://www.ecfr.gov/current/title-9/section-318.10 |
| Elimination of Trichinae Control Regulations | 83 FR 25302 (31.5.2018) | https://www.federalregister.gov/documents/2018/05/31/2018-11300 |
| FSIS RTE Fermented, Salt‑Cured, and Dried Products Guideline | FSIS‑GD‑2023‑0002 (105 עמ') | https://www.fsis.usda.gov/guidelines/2023-0002 |
| FSIS Compliance Guideline for Meat and Poultry Jerky | 2014 (54 עמ') | https://www.fsis.usda.gov/sites/default/files/import/Compliance-Guideline-Jerky-2014.pdf |
| FSIS Cooking Guideline (Revised Appendix A) | FSIS‑GD‑2021‑0014, 12/2021 (92 עמ') | https://www.fsis.usda.gov/guidelines/2021-0014 |
| FSIS Lethality, Stabilization and Multiple Hurdles (הדרכה) | 10/27/2021 (43 עמ') | FSIS `25_IM_Lethality-Stabilization-Student-10272021.pdf` |
| FSIS Generic HACCP Model — Bacon (Heat‑Treated, Not Fully Cooked) | FSIS‑GD‑2021‑0002 | https://www.fsis.usda.gov/guidelines/2021-0002 |
| AMI Foundation — GMP for Fermented Dry and Semi‑Dry Sausage (מקור טבלת degree‑hours) | 1997 | מצוטט בתוך מסמך ההדרכה של FSIS; המקור עצמו לא נמשך |
| 21 CFR part 133 — Cheeses and Related Cheese Products | eCFR current | https://www.ecfr.gov/current/title-21/part-133 |
| FDA Food Code 2022 (668 עמ') | §1‑201.10(B), §3‑501.17(G), Annex 3 | https://www.fda.gov/media/164194/download |
| FDA — Control of L. monocytogenes in RTE Foods | Guidance for Industry, final 2017 | https://www.fda.gov/media/102633/download |
| CFIA — Preventive controls, fermented and dried meat | current | https://inspection.canada.ca/en/food-safety-industry/preventive-control-plans/controls-food/meat/fermented-and-dried |

**הפקדה ל‑graphify global (§10.11):** לא בוצעה. `graphify add <url>` מושך דרך שכבת רשת שנחסמת מול
`fsis.usda.gov`/`usda.gov` (‏403), ולא אפקיד סיכומים משלי במקום מסמכי המקור — זה בדיוק סוג התחליף
שהכלל נועד למנוע. **מה שראוי להפקיד כשהחסימה תיפתר** (כולם בעלי ערך חוצה‑פרויקטים, ללא תוכן פרטי):
‏FSIS‑GD‑2023‑0002 · FSIS Jerky Guideline 2014 · FSIS Appendix A (2021) · FDA Food Code 2022 ·
‏21 CFR 133 · 9 CFR 424.21/424.22.
