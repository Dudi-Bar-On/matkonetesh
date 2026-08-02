# אינדקס יחיד — קורפוס המקורות (19 מקורות, 113 קבצים, 94 ארטיפקטים)

**מה זה:** תוצר משימת ההורדה (Task 1). **שלב 1** (2026-08-02, שלושה חלקים מקבילים: Part A #1–#5 · Part
B #6–#14 · Part C #15–#19) בנה את הבסיס תחת ההנחה השגויה ש-`WebFetch` הוא ערוץ הרשת היחיד. **סבב 2**
(אותו יום, אחר-כך, שני סוכנים D ו-E) תיקן את האבחון — ל-Node `fetch` יש גישת רשת מלאה — וסגר **ארבעה**
כישלונות מוחלטים של סבב 1 (#4, #8, #13, #19), השלים לחלוטין את הרשת המספרית המרכזית של #2 (Tables 2/3/4,
OCR דו-מעברי), הוסיף אימות XML מובנה ל-#6/#7/#12 מול ה-eCFR, וסגר את מאמר 2012 של Baldwin (#15). ראה
`00-SOURCE-MAP.md` §1 למטריצת השליפה המתוקנת.

**מסמך זה הוא שכבת ביקורת סופית** — נכתב אחרי שני הסבבים, קורא את כל 19 ה-`PROVENANCE.md` בפועל (לא את
כותרות דוחות החלקים), סופר קבצים ישירות מהדיסק, ומתקן שני מקומות שבהם `00-INDEX.md` הקודם נותר לא-מעודכן
אחרי שסוכן D עדכן אותו אך סוכן E (שרץ אחריו וסגר #4/#19/הליבה של #2) לא חזר לעדכנו. כל שורה כאן נקראה
מתוך ה-`PROVENANCE.md` המתאים או נספרה ישירות מהתיקייה, לא הוסקה.

**מספרים בסיסיים (נספרו, לא הוערכו, אחרי שני הסבבים):** 19/19 תיקיות מקור קיימות · **113 קבצים סה"כ**
בתוך 19 התיקיות (`ls -A` על כל תיקייה, סוכם) — כולל 19 `PROVENANCE.md` → **94 ארטיפקטים שאינם
provenance** · **כיסוי אחזור: 12/19 טקסט-מקור מלא 🟢 (היה 7/19 בתום שלב 1) · 6/19 חלקי/מראה 🟠 (היה
7/19) · 1/19 שחזור-בלבד 🔴 (היה 5/19)**.

---

## 1 · טבלת סיכום לפי מקור

דירוג = מ-`00-SOURCE-MAP.md` §2/§10. סטטוס **נחושב מחדש כאן מהדיסק בפועל**, לא הועתק מדוח שום סבב:
🟢 טקסט-מקור מלא הושג (גם אם המקור עצמו קצר/דל, כמו #4) · 🟠 חלקי/מראה (חלק מהטבלה לא פורסר, או שהמקור
עצמו לא הושג ורק מסמך משני מצטט אותו במדויק) · 🔴 לא הושג — שחזור WebSearch/משני בלבד.

| # | מקור | דירוג | extraction | סטטוס | מה מכוסה | הפער בשורה אחת |
|---|---|---|---|---|---|---|
| 1 | FDA Food Code 2022 + Annexes | A2 | `PDF-T` | 🟠 | סולם רוסט 130°F→158°F (Table 3-2), Tables A/B (pH×aw), §3-401.13 | ה-Annexes המלאות (487 עמ', `portal.ct.gov`) חזרו `ECONNRESET`×3 — הוחלפו במראה West Hartford שקולה בתוכן אך לא זהה במסמך. לא נבדק מחדש בסבב 2 |
| 2 | FSIS Appendix A (2021) | A2 | `PDF-T`(Table 1)+`OCR-GEMINI`(Tables 2/3/4, סבב 2) | 🟢 (היה 🟠) | Table 1 מלאה · **Tables 2/3/4 — הרשת המספרית המרכזית, 91/91 שורות, `OCR-2PASS-AGREE` בכל שורה, 0 מחלוקת** | Table 5 (עמ' 43, Scientific Gaps) ו-Table 6 (עמ' 59, יעד 5-Log חלופי) — לא נוגעו, מחוץ להיקף המוצהר של הסט המינימלי, לא נטען שכוסו |
| 3 | FSIS Safe Min Temp Chart + הודעת 2011 | A2 | `MANUAL` | 🟠 | 9 השורות המלאות של התרשים הצרכני (145°F+3min וכו') | הודעת 2011 המקורית (403) — רק ציטוט משני (LSU AgCenter). לא נבדק מחדש בסבב 2 |
| 4 | AskUSDA/askFSIS — organ/variety meat | A2 | `VERBATIM` (Playwright, סבב 2) | 🟢 (היה 🔴) | **המאמר עצמו נשלף verbatim** תחת הדומיין החדש `ask.fsis.usda.gov`; 160°F לאיברי בקר/חזיר/טלה/עגל, 165°F קרביי עוף — ציטוט מדויק, לא שחזור | המקור עצמו דל מטבעו (שני משפטים, אין טבלה/מתודולוגיה) — זו תכונה של המקור, לא של האחזור. 7 מתוך 12 פריטי-האיברים באפליקציה (לב, קרביים וכו') אינם נקובים בו במפורש, רק באנלוגיה לקטגוריה |
| 5 | FDA Fish & Fishery Products Guidance | A2 | `PDF-T` | 🟠 | היסטמין 50/17ppm, 3 שיטות הקפאה לטפילים, בקרת קירור כלי-שיט | מראה מתויגת "March 2020" מול יעד "June 2022" — לא אומת זהות; טבלת זמני-פירוק חולצה רק 2 שורות ראשונות. לא נבדק מחדש בסבב 2 |
| 6 | 9 CFR §424.21 (Curing Agents, תקרת 200ppm) | A1 | `PDF-T`+`XML` (סבב 2) | 🟢 | טבלת Curing Agents מלאה; **אומת שוב מול eCFR XML — התאמה מלאה, אין פער** | אין — טקסט חוק רשמי מ-`govinfo.gov` + `ecfr.gov` API, חילוץ נקי ומלא |
| 7 | 9 CFR §424.22 (נוסחאות בייקון) | A1 | `PDF-T`+`XML` (סבב 2) | 🟢 | כל 5 נוסחאות הבייקון (120/100/40-80/120/200 ppm); **אומת שוב מול eCFR XML — התאמה מלאה** | אין |
| 8 | FSIS-GD-2023-0002 (a_w, pH, בילטונג) | A2 | `PDF-T` (סבב 2 — המסמך האמיתי) | 🟢 (היה 🔴) | **המסמך המקורי עצמו נשלף** דרך Wayback Machine; pH≤5.3, a_w≤0.85, 5-log Salmonella/STEC, 3-log Lm — כולם מילוליים | הטבלה המספרית של degree-hours (1200/1000/900) לא מופיעה כאן במפורש — המסמך מפנה למקור #10 (AMI 1997) לפרטים, וזה אושר כעקבי, לא כפער |
| 9 | FSIS Jerky Guideline 2014 | A2 | `PDF-T` | 🟠 | a_w 0.85 אירובי/0.91 אנאירובי, לחות כתנאי קטלניות | Attachment 2 (טבלת ספרות משולבת) — עמודות התערבבו בחילוץ ליניארי; רק שורה אחת שוחזרה. לא נבדק מחדש בסבב 2 |
| 10 | AMI Foundation 1997 (מקור degree-hours) | C (מקור עצמו) | `MANUAL` | 🟠 | 1200/1000/900 + דוגמה מחושבת מלאה — **ציטוט מילולי ממסמך משני** | **המסמך המקורי של AMI עצמו מת** (`amif.org` → 404); כל מה שיש הוא ציטוט מדויק בתוך מסמך UW-Madison. לא נבדק מחדש בסבב 2, מחוץ להיקף |
| 11 | CFIA — רצפת ניטריט בלבד | A2 | `HTML` | 🟢 | 100ppm + 2.5% מלח (מילולי) | אין, בתוך ההיקף המוצהר (degree-hours הוצא במכוון) |
| 12 | 21 CFR part 133 (פסטור חלב, הבשלת 60 יום) | A1 | `PDF-T`+`XML` (סבב 2) | 🟢 | טבלת פסטור מלאה, כלל 35°F/60-יום; **אומת שוב מול eCFR XML — התאמה מלאה, כולל הבהרת "≥2s" לאולטרה-פסטור** | רק גבינת צ'דר (§133.113) נשלפה כנציגה; ~29 סוגי גבינה נוספים בעלי סעיף דומה לא אומתו פרטנית |
| 13 | FDA — Listeria in RTE Foods (2017) | A2 | `PDF-T` (סבב 2 — המסמך האמיתי) | 🟢 (היה 🔴) | pH≤4.4/a_w≤0.92 — **מילולי מהמסמך הראשוני עצמו**, עמ' 4 | טווח טמפ' (-0.4°C–45°C) ואחוז מלח (<10%) שנרשמו בסבב 1 **לא נמצאו בטקסט המקור** — סומנו כלא-מאושרים, לא הומצאו |
| 14 | Regulation (EU) 2023/915 (PAH) | A1 | `PDF-T`+`HTML` | 🟢 | כל מגבלות PAH + כל חריגי המדינות בשם | אין |
| 15 | Baldwin (מדריך + סקירת 2012) | C (המדריך) / B (המאמר) | `HTML`+`PDF-T` (סבב 2) | 🟢 | 8 טבלאות פסטור/מרקם/קירור + מודל עובי→זמן + **גוף מאמר 2012 המלא (33 עמ') — אושש ישירות מלוא שרשרת הציטוטים O'Bryan/Bolton/Hansen&Knøchel/Embarek/Juneja** | ScienceDirect עדיין paywall אמיתי (403) — לא נדרש, ה-preprint זהה מהותית |
| 16 | Tornberg 2005 | B | `MANUAL` | 🟠 | תקציר בלבד: דנטורציית קולגן 53–63°C | **המאמר המלא נעול (© Elsevier) — רק תקציר, אין טבלאות/גרפים/זמן**. לא נבדק מחדש בסבב 2, מחוץ להיקף |
| 17 | Modernist Cuisine — "Best Bets" | C | `MANUAL` | 🔴 (המקור היחיד שנשאר לגמרי סגור) | 2 שורות בלבד (בריסקט 57°C/יומיים; שריר קצר 60°C/72שע') | **הטבלה המקורית מהספר המודפס לא נגישה כלל; 2 שורות משוחזרות ממקורות משניים.** לא נבדק מחדש בסבב 2 — אין מראה חוקית ידועה |
| 18 | AmazingRibs / Blonder | D+ | `MANUAL` | 🟢 | ה-stall, עץ/עשן, מנוחה — 3 מאמרים HTML נשלפו במלואם | אין טבלת smh/soh לפי משקל — כי היא לא קיימת בשום מקום |
| 19 | Serious Eats / López-Alt | D+ | `VERBATIM` (`node fetch` + UA תקני, סבב 2) | 🟢 (היה 🔴) | **המאמר "Reverse-Seared Steak" נשלף במלואו, 452,140 בייט, ללא סימני paywall**; טבלת דוננס מלאה (target-in-oven + final-target + זמן) | טמפ' שמן/מחבת בשלב הצריבה לא כומתו בטקסט הנבדק; שאר העמוד (452KB) לא נקרא מעבר לטבלת הרוורס-סירי |

---

## 2 · טבלת ארטיפקטים — כל 113 הקבצים (19 `PROVENANCE.md` + 94 ארטיפקטים)

`kind`: **ref** = עותק-אסמכתה (PDF/HTML/PNG מקור) · **table** = טבלת CSV מובנית · **text** = טקסט מחולץ
(אמצעי-ביניים/audit) · **prov** = `PROVENANCE.md` עצמו · **copy** = `SOURCE-COPY.md`.
`conf` = דרגת ביטחון כפי שמצוין ב-PROVENANCE (לא הומצא): **high** / **med** / **low**.

### 01-fda-food-code-2022 (10 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא מלאים למקור #1 |
| fda-food-code-2022-westhartford-mirror.pdf | ref | `PDF-T` | high | מראה West Hartford — גוף Food Code מלא, 181 עמ' |
| fda-food-code-2022-westhartford-mirror-extracted.txt | text | `PDF-T` | high | טקסט מחולץ מהמראה לעיל |
| fda-food-code-2022-chapter3.pdf | ref | `PDF-T` | high | מראה c-uphd.org, פרק 3 בלבד (41 עמ'), לאימות צולב |
| fda-food-code-2022-chapter3-extracted.txt | text | `PDF-T` | high | טקסט מחולץ מהנ"ל |
| fda-food-code-2022-main.pdf | ref | `PDF-T` | med | CT DPH "Guide 3B" — מדריך-פיקוח, לא הקוד עצמו; עותק עיון בלבד |
| extracted-text-main.txt | text | `PDF-T` | med | טקסט מחולץ מ-Guide 3B |
| table-3-2-roast-cooking.csv | table | `PDF-T` | high | סולם 130°F/112min→158°F לרוסט שלם, 17 שורות |
| other-safe-values.csv | table | `PDF-T` | high | 7 ערכי `safe`/`rest` נוספים כולל עוגן טמפ' תנור |
| tcs-classification-table-a-b.csv | table | `PDF-T` | high | סיווג TCS לפי pH×aw — 24 שורות, כל התאים |

### 02-fsis-appendix-a-2021 (11 קבצים — סבב 2 סגר את Tables 2/3/4)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא + תיעוד מלא של שיטת ה-OCR הדו-מעברי + ממצאי הביקורת (RH-eligibility, רדינגי-עיגול) |
| fsis-appendix-a-2021.pdf | ref | `PDF-T` | high | מראה ncagr.gov, 92 עמ' מלאים |
| extracted-text.txt | text | `PDF-T` | high | טקסט מחולץ מלא, 92 עמ' |
| table1-humidity-options.csv | table | `PDF-T` | high | Table 1 — 4 אפשרויות לחות, מלא |
| extracted-facts.csv | table | `PDF-T` | high | footnotes: 158°F מיידי, פיצול עוף/הודו, רולים 160/155°F, CUT 6ש' |
| **table2-meat-lethality.csv** (סבב 2) | table | `OCR-GEMINI` | high, `OCR-2PASS-AGREE` | Table 2, p.35 — 31/31 שורות, 6.5-log/7-log לפי טמפ'; **עודכן ע"י הביקורת: עמודת `rh_options_1_2_eligible`** |
| table2-source-page35.png | ref | `pymupdf` render | high | צילום-עמוד 4x של Table 2, ראיה חזותית |
| **table3-chicken-lethality.csv** (סבב 2) | table | `OCR-GEMINI` | high, `OCR-2PASS-AGREE` | Table 3, p.37 — 30/30 שורות, טמפ'×שומן(1-12%) לעוף; **עודכן ע"י הביקורת: עמודת `rh_options_1_2_eligible`** |
| table3-source-page37.png | ref | `pymupdf` render | high | צילום-עמוד 4x של Table 3 |
| **table4-turkey-lethality.csv** (סבב 2) | table | `OCR-GEMINI` | high, `OCR-2PASS-AGREE` | Table 4, p.38 — 30/30 שורות, טמפ'×שומן(1-12%) להודו; **עודכן ע"י הביקורת: עמודת `rh_options_1_2_eligible`** |
| table4-source-page38.png | ref | `pymupdf` render | high | צילום-עמוד 4x של Table 4 |

### 03-fsis-safe-min-temp (4 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא למקור #3 |
| fsis-safe-min-temp-chart-mirror-kstate.pdf | ref | `PDF-T` | high | מראה K-State, עמוד יחיד, כותרת FSIS מקורית "June 2012" |
| extracted-text.txt | text | `PDF-T` | high | טקסט מחולץ מהתרשים |
| safe-min-temp-chart.csv | table | `MANUAL`/`PDF-T` | high (חוץ משורת 2011: low) | כל 9 שורות התרשים + שורת הודעת 2011 (מסומנת MANUAL/משני) |

### 04-askusda-variety-meats (4 קבצים — סבב 2 סגר את המקור VERBATIM)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | **עודכן סבב 2**: הדף החי אותר תחת הדומיין החדש `ask.fsis.usda.gov` (הישן הוצא משימוש), נשלף verbatim דרך Playwright |
| **askusda-organ-meat-rendered.html** (סבב 2) | ref | `VERBATIM` | high | DOM מלא של העמוד המרונדר, verbatim |
| **askusda-organ-meat-article.png** (סבב 2) | ref | `VERBATIM` (screenshot) | high | צילום מסך מלא כראיה חזותית |
| organ-meat-temps.csv | table | `VERBATIM` (סבב 2, היה `MANUAL`) | high | 160°F איברי בקר/חזיר/טלה/עגל (kidney/liver/stomach/tongue/tripe) · 165°F קרביי עוף — ציטוט מדויק, מתקן רשימת-איברים שגויה מסבב 1 |

### 05-fda-fish-guidance (4 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא + הערת מהדורה (March-2020 מול June-2022) |
| fda-fish-fishery-hazards-guidance-4th-ed-mirror.pdf | ref | `PDF-T` | med | מראה UW-Madison, 498 עמ' |
| extracted-text.txt | text | `PDF-T` | med | טקסט מלא, 498 עמ' |
| histamine-and-parasite-tables.csv | table | `PDF-T` | high (עדכניות מהדורה: med) | 50/17ppm היסטמין, 3 שיטות הקפאה, בקרת כלי-שיט, טבלת פירוק חלקית (2 שורות בלבד) |

### 06-9cfr-424-21 (5 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| CFR-2024-title9-vol2-sec424-21.pdf | ref | `PDF-T` | high | טקסט חוק רשמי מ-govinfo.gov, 22 עמ' |
| PROVENANCE.md | prov | — | — | שדות מוצא למקור #6 + אימות XML (סבב 2) |
| curing-agents-table.csv | table | `PDF-T` | high | תקרת 200ppm + טבלת Curing Agents |
| extracted-text-raw.txt | text | `PDF-T` | high | טקסט מחולץ מלא |
| ecfr-title9-sec424-21.xml (סבב 2) | ref | `XML` | high | eCFR versioner API, 123,214 בייט — אימות צולב, **התאמה מלאה** |

### 07-9cfr-424-22 (5 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| CFR-2024-title9-vol2-sec424-22.pdf | ref | `PDF-T` | high | טקסט חוק רשמי, 4 עמ' |
| PROVENANCE.md | prov | — | — | שדות מוצא למקור #7 + אימות XML (סבב 2) |
| bacon-curing-formulas.csv | table | `PDF-T` | high | כל 5 נוסחאות הבייקון עם pincite מדויק |
| extracted-text-raw.txt | text | `PDF-T` | high | טקסט מחולץ מלא |
| ecfr-title9-sec424-22.xml (סבב 2) | ref | `XML` | high | eCFR versioner API, 14,574 בייט — אימות צולב, **התאמה מלאה** |

### 08-fsis-gd-2023-0002 (7 קבצים — סבב 2 סגר את המקור)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | **עודכן סבב 2**: Status now RETRIEVED — Wayback Machine snapshot |
| FSIS-GD-2023-0002-PRIMARY-wayback.pdf (סבב 2) | ref | `PDF-T` | high | **המסמך הראשוני עצמו**, ארכיון 2025-02-21, 105 עמ' / 1,641,513 בייט |
| extracted-text-PRIMARY.txt (סבב 2) | text | `PDF-T` | high | טקסט מלא, 254,373 תווים |
| extracted-parameters-PRIMARY.csv (סבב 2) | table | `PDF-T` | high | pH≤5.3, a_w≤0.85, 5-log Salmonella/STEC, 3-log Lm (חדש) — כולם מילוליים עם pincite |
| maine-haccp-model-mirror.pdf (סבב 2) | ref | `PDF-T` | high | מראה משנית מ-Maine DACF — מצטטת עמודים ספציפיים מהמקור |
| extracted-text-maine-mirror.txt (סבב 2) | text | `PDF-T` | high | טקסט מחולץ מהמראה, 39,219 תווים |
| **reconstructed-parameters-SUPERSEDED.csv** | table | `MANUAL` | **low-medium** (הוחלף, נשמר) | שחזור סבב 1 — נשמר לתיעוד, לא הוסר |

### 09-fsis-jerky-2014 (5 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| Compliance-Guideline-Jerky-2014.pdf | ref | `PDF-T` | high | מראה Montana legislature, 54 עמ' |
| PROVENANCE.md | prov | — | — | שדות מוצא + פירוט כשלון עמודות Attachment 2 |
| superseded-2007-Quick-Guide-Compliance-Guideline.pdf | ref | — | — | מהדורה 2007 קודמת (לא היעד) — עותק הקשר בלבד, לא נכרה |
| water-activity-and-humidity.csv | table | `PDF-T` | high (שורת Attachment2: **PARTIAL**) | a_w 0.85/0.91, כלל תיוג, לחות כתנאי קטלניות, שורת דוגמה אחת מ-Attachment 2 |
| extracted-text-raw.txt | text | `PDF-T` | high | טקסט מלא, 54 עמ', 135,810 תווים |

### 10-ami-1997-degree-hours (4 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | Status: המסמך המקורי מת (amif.org 404); מסמך משני בלבד |
| UW-FSRE-Principles-of-Preservation-Shelf-Stable-Dried-Meat.pdf | ref | `PDF-T` | high (כמסמך משני מצטט) | UW-Madison, 15 עמ', מכיל ציטוט מילולי מדויק של AMI 1997 |
| degree-hours.csv | table | `PDF-T` | high | 1200/1000/900 + דוגמה מחושבת, ציטוט מילולי |
| extracted-text-raw.txt | text | `PDF-T` | high | טקסט מלא, 33,747 תווים |

### 11-cfia-nitrite-floor (4 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא + הערת-היקף מפורשת (degree-hours לא נכלל בכוונה) |
| extracted-text-nitrites-page.txt | text | `HTML` | high | 100ppm רצפה + תקרות (200/120ppm) |
| extracted-text-fermented-dried-page.txt | text | `HTML` | high | "100 ppm ... 2.5% of salt" מילולי |
| nitrite-floor.csv | table | `HTML` | high | 100ppm + 2.5% מלח + 3 תקרות CFIA |

### 12-21cfr-133 (8 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| CFR-2024-title21-vol2-sec133-3.pdf | ref | `PDF-T` | high | §133.3 טבלת פסטור מלאה |
| CFR-2024-title21-vol2-sec133-113.pdf | ref | `PDF-T` | high | §133.113 כלל 60-יום/35°F לצ'דר |
| PROVENANCE.md | prov | — | — | שדות מוצא + הערה: רק צ'דר נציג + אימות XML (סבב 2) |
| extracted-text-133-3.txt | text | `PDF-T` | high | טקסט מלא §133.3 |
| extracted-text-133-113.txt | text | `PDF-T` | high | טקסט מלא §133.113 |
| pasteurization-and-aging.csv | table | `PDF-T` | high | טבלת פסטור + כלל ההבשלה |
| ecfr-title21-sec133-3.xml (סבב 2) | ref | `XML` | high | eCFR versioner API, 2,779 בייט — התאמה מלאה |
| ecfr-title21-sec133-113.xml (סבב 2) | ref | `XML` | high | eCFR versioner API, 3,914 בייט — התאמה מלאה |

### 13-fda-listeria-rte-2017 (7 קבצים — סבב 2 סגר את המקור)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| Hogan-Lovells-2017-Listeria-webinar-slides-secondary.pdf | ref | `PDF-T` | med (אך **ללא מספרים**) | מצגת משפטית משנית — רקע רגולטורי, אפס נתונים מספריים |
| PROVENANCE.md | prov | — | — | **עודכן סבב 2**: Status now RETRIEVED — fda.gov/media/102633/download |
| FDA-2017-Listeria-RTE-guidance-PRIMARY.pdf (סבב 2) | ref | `PDF-T` | high | **המסמך הראשוני עצמו**, 85 עמ' / 872,618 בייט |
| extracted-text-PRIMARY.txt (סבב 2) | text | `PDF-T` | high | טקסט מלא, 209,584 תווים |
| extracted-parameters-PRIMARY.csv (סבב 2) | table | `PDF-T` | high | pH≤4.4, a_w≤0.92 — מילולי, עמ' 4; טמפ'/מלח סומנו לא-מאושרים |
| extracted-text-secondary-slides.txt | text | `PDF-T` | med | טקסט מלא של המצגת (16 שקפים) |
| **reconstructed-parameters-SUPERSEDED.csv** | table | `MANUAL` | **low** (הוחלף, נשמר) | שחזור סבב 1 — נשמר לתיעוד, לא הוסר |

### 14-eu-2023-915-pah (4 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא למקור #14 |
| Regulation-EU-2023-915.pdf | ref | `PDF-T` | high | טקסט חקיקה רשמי, 55 עמ' |
| extracted-text-raw.txt | text | `PDF-T` | high | טקסט מלא, 117,906 תווים |
| pah-limits.csv | table | `PDF-T`+`HTML` | high | כל מגבלות PAH + כל חריגי המדינות עם pincite |

### 15-baldwin-sous-vide (13 קבצים — סבב 2 סגר את מאמר 2012)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | **עודכן סבב 2**: מאמר 2012 נשלף בהצלחה, ScienceDirect עדיין paywall |
| Baldwin-IJGFS-2012-preprint-PRIMARY.pdf (סבב 2) | ref | `PDF-T` | high | ה-preprint המלא, 33 עמ' / 288,024 בייט |
| extracted-text-2012-paper-PRIMARY.txt (סבב 2) | text | `PDF-T` | high | טקסט מלא, 83,664 תווים — מאמת ציטוטי O'Bryan/Bolton/Hansen&Knøchel/Embarek/Juneja |
| SOURCE-COPY.md | copy | `HTML` | high | עותק-אסמכתה מובנה של דף המדריך |
| pasteurization-meat-55-60C.csv | table | `HTML` | high | Table 5.1, בשר 55-60°C, 14 עוביים |
| pasteurization-meat-61-66C.csv | table | `HTML` | high | Table 5.1, בשר 61-66°C |
| pasteurization-poultry.csv | table | `HTML` | high | Table 4.1, עוף 57-65°C |
| pasteurization-fish-lean.csv | table | `HTML` | high | Table 3.1, דג רזה |
| pasteurization-fish-fatty.csv | table | `HTML` | high | Table 3.1, דג שמן |
| cooling-times-ice-bath.csv | table | `HTML` | high | Table 1.1, קירור בקרח לפי עובי/צורה |
| doneness-temperatures.csv | table | `HTML` | high | Table 2.1, מרקם בקר/דג |
| d-z-values-pathogens.csv | table | `HTML` | high | ערכי D/z לכל פתוגן, עם ציטוט ספרות משלו |
| thickness-time-model-parameters.csv | table | `HTML` | high | α/h/β — מודל עובי→זמן (התרומה העצמאית) |

### 16-tornberg-2005 (3 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא — תקציר בלבד, מאמר נעול |
| SOURCE-COPY.md | copy | `MANUAL` | high (לתקציר בלבד) | ציטוט מלא + תקציר, DOI/PMID |
| collagen-mechanism-data.csv | table | `MANUAL` | high | דנטורציית קולגן 53-63°C, חלבוני סרקופלזמה/מיופיבריל |

### 17-modernist-cuisine (3 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | Status: 2 שורות בלבד ממקורות משניים, ספר מודפס לא נגיש |
| SOURCE-COPY.md | copy | `MANUAL` | **low** | מה שידוע על הטבלה + מה שלא תועתק |
| best-bets-tough-cuts.csv | table | `MANUAL` | **low** | בריסקט 57°C/יומיים; שריר קצר 60°C/72שע' — 2 שורות בלבד |

### 18-amazingribs-blonder (8 קבצים)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | שדות מוצא, 3 מאמרים HTML נשלפו במלואם |
| SOURCE-COPY.md | copy | `HTML`(מקור)/`MANUAL`(עיבוד) | high | עותק-אסמכתה מלא ל-3 המאמרים |
| stall-experiment-data.csv | table | `MANUAL` | high | ניסויי stall של Blonder (קערות מים) |
| pork-shoulder-wrap-trial.csv | table | `MANUAL` | high | ניסוי עטיפה מול לא-עטוף |
| wood-type-table.csv | table | `MANUAL` | med | 6 סוגי עץ — ייתכנו סוגים נוספים בדף שלא נלכדו |
| combustion-stages.csv | table | `MANUAL` | high | 4 שלבי בעירה, טמפ' |
| wood-smoking-parameters.csv | table | `MANUAL` | high | הרכב, BTU, לחות, כמויות, עומק חדירה |
| resting-meat-data.csv | table | `MANUAL` | high | בונוס: מדידות אובדן נוזלים Blonder+López-Alt |

### 19-serious-eats-lopez-alt (4 קבצים — סבב 2 סגר את המקור VERBATIM)
| קובץ | kind | extraction | conf | תוכן בשורה אחת |
|---|---|---|---|---|
| PROVENANCE.md | prov | — | — | **עודכן סבב 2**: `node fetch` + UA תקני → 200, לא חסימת שרת; מסקנה מתוקנת ל-מפת-המקורות |
| **reverse-seared-steak-recipe.html** (סבב 2) | ref | `VERBATIM` | high | העמוד המלא, verbatim, 452,140 בייט, 0 סימני paywall |
| SOURCE-COPY.md | copy | `VERBATIM` (סבב 2, היה MANUAL/שכבת-חיפוש) | high | ציטוטים ישירים + טבלת דוננס מלאה מהעמוד שנשלף |
| reverse-sear-doneness-temps.csv | table | `VERBATIM` (סבב 2, היה MANUAL) | high | דוננס → target-in-oven + final-target + זמן תנור — עמודת final-target ותקן-שם נוספו בסבב 2 |

---

## 3 · מה **לא** כאן — במספרים ובפרוזה

> **מצב אחרי שני הסבבים (2026-08-02/03):** #4, #8, #13, #19, ששיירו "0% ציטוט מילולי" בתום שלב 1,
> **נסגרו במלואן** — המסמכים/העמודים הראשוניים עצמם נשלפו verbatim. הרשת המספרית של #2 (Tables 2/3/4)
> **הושלמה במלואה** (91/91 שורות, אימות דו-מעברי). **מקור יחיד נשאר ללא שום טקסט-מקור: #17.**

**מקור אחד (17) לא הושג כטקסט-מקור בשום צורה** — כל מה שיש לו הוא שחזור מקורות-משניים (2 שורות בלבד).
**6 מקורות נוספים (1, 3, 5, 9, 10, 16) חלקיים** — טקסט אמיתי הושג, אבל חסר נתח מוגדר ומתועד. סה"כ **7
מתוך 19 מקורות (37%) נושאים פער מתועד כלשהו** (היה 10/19=53% בתום שלב 1, 12/19=63% בתום שלב 1 המקורי) —
**12/19 (63%)** הם עכשיו "טקסט-מקור מלא, בלי הסתייגות מהותית" (היה 9/19=47%, ולפני-כן 7/19=37%).

| # | מה חסר בדיוק | מה אדם צריך לעשות כדי לסגור |
|---|---|---|
| 1 | ה-Annexes המלאות של FDA Food Code (487 עמ', Annex 1/4/6) | לגשת ל-`portal.ct.gov` ב-ECONNRESET חוזר, או להשיג עותק ישיר מ-FDA (חסום כאן) |
| ~~2~~ | ~~Tables 2/3/4~~ — **סגור סבב 2**: 91/91 שורות, `OCR-2PASS-AGREE`. **נותר מחוץ להיקף, בעדיפות נמוכה**: Table 5 (עמ' 43) ו-Table 6 (עמ' 59) — לא נדרשו למינימום המוצהר | לחלץ באותה שיטה (pymupdf+Gemini vision) אם יידרשו אי-פעם |
| 3 | הודעת USDA המקורית ל-2011 (403 בכל נתיב) | גישת דפדפן ל-`usda.gov` blog, או חיפוש FSIS Notice/Federal Register מספר רשמי |
| ~~4~~ | ~~הדף החי~~ — **סגור סבב 2**: נשלף verbatim תחת `ask.fsis.usda.gov` דרך Playwright. **נותר פתוח**: 7/12 פריטי-האיברים באפליקציה (לב, קרביים, בלוטות-מתיקה וכו') אינם נקובים במפורש בטקסט המאמר — רק "organs... from red meats" כללי + "poultry livers and other giblets" | לחפש מקור FSIS/USDA שני שממנה במפורש את שאר הפריטים, או להסתפק באנלוגיה המתועדת ולסמן זאת בקרדיט |
| 5 | מהדורת "June 2022" (יש רק "March 2020"); טבלת פירוק אחרי שורה 2 | לאתר עותק 2022 (fda.gov חסום) ולהמשיך לגרוד את 498 העמודים לשורות נוספות |
| ~~8~~ | ~~המסמך כולו~~ — **סגור סבב 2**: נשלף במלואו דרך Wayback Machine (`FSIS-GD-2023-0002-PRIMARY-wayback.pdf`) | — |
| 9 | Attachment 2 — טבלת ספרות רב-עמודות (מעבר לשורה אחת) | לפתוח את ה-PDF בכלי OCR טבלאי, לא `pypdf` (עמודות מתערבבות בחילוץ ליניארי) — אותה שיטה שסגרה את #2 |
| 10 | **מסמך AMI Foundation 1997 המקורי עצמו — מת** (`amif.org` → 404) | ספרייה/ארכיון תעשייה (יורש: North American Meat Institute) או Interlibrary Loan — לא נבדק מחדש בסבב 2, מחוץ להיקף |
| 12 | ~29 סוגי גבינה נוספים בעלי סעיף "60-יום/35°F" דומה (רק צ'דר אומת) | לגרד כל סעיף גבינה ב-21 CFR part 133 בנפרד ולוודא הנוסח זהה |
| ~~13~~ | ~~המסמך כולו~~ — **סגור סבב 2**: נשלף במלואו מ-`fda.gov/media/102633/download`; טווח טמפ' ואחוז מלח שנרשמו בסבב 1 סומנו לא-מאושרים כי לא נמצאו בטקסט | — |
| 16 | גוף המאמר המלא (טבלאות, איורים, זמן-תלות, ציטוטים) | מנוי/גישת Elsevier (© — נעול) — לא נבדק מחדש בסבב 2, מחוץ להיקף (זה Tornberg 2005, לא Baldwin 2012) |
| 17 | **כל שורות "Best Bets" חוץ מ-2 (בריסקט, שריר קצר)** — צ'אק, שוק, זנב-שור וכו' — **המקור היחיד שנותר לגמרי-לא-מושג** | הספר המודפס/ebook מורשה בלבד — אין מראה חוקית ידועה |
| ~~19~~ | ~~הדף החי~~ — **סגור סבב 2**: `node fetch`+UA → 200, 452,140 בייט, ללא paywall. **נותר**: טמפ' שמן/מחבת לא כומתו בטקסט הנבדק | לקרוא את שאר העמוד (452KB) אם יידרש פרט זה |

---

## 4 · טבלת מארחים חסומים — מציאות האחזור, מתוקנת אחרי שני הסבבים

> **תיקון מהותי (סבב 2):** רוב שורות הטבלה הזו בשלב 1 תיארו כשלים של **`WebFetch`**, לא של הרשת עצמה.
> ‏`node fetch` פתר בפועל: `fda.gov` (#13 — כעת 🟢), `fsis.usda.gov` דרך Wayback (#8 — כעת 🟢),
> ‏`douglasbaldwin.com`'s PDF asset (#15 — כעת 🟢), `www.seriouseats.com` עם User-Agent תקני (#19 — כעת
> 🟢), ואת ה-eCFR API (#6/#7/#12 — אימות XML חדש). `ask.usda.gov` הוברר כאתר **שהוצא משימוש לגמרי**
> (הועבר ל-`ask.fsis.usda.gov`, SPA הדורש Playwright), לא כתקלת-503 חולפת. ראה `00-SOURCE-MAP.md` §1
> לטבלת ההשוואה המלאה "מה שלב 1 האמין / מה האמת".

| מארח | תוצאה (node fetch, אחרי שני הסבבים) | הערה תפעולית |
|---|---|---|
| `www.fsis.usda.gov` (כל נתיב ישיר) | **403** (דפי HTML) · **404** (הקובץ הספציפי של #8, הוזז/הוסר) | **חסימה אמיתית, אושרה שוב** — אך **נעקפה** דרך Wayback Machine (`archive.org/wayback/available` API) עבור #8 |
| `www.fda.gov` | ✅ **200** — לכל נתיב שנוסה, כולל `/media/{id}/download` | **תוקן משלב 1** — זו הייתה טעות אבחון, לא חסימת שרת. סגר את #13 |
| `hhs.gov` (guidance portal) | **403** | עדיין חסום — לא נדרש הפעם (fda.gov עצמו עבד) |
| `ecfr.gov`/`federalregister.gov` (אתר HTML אנושי) | חומת בוטים אמיתית (302→`unblock.federalregister.gov`) | **עדיין חסום כאתר** — אך `ecfr.gov/api/versioner/...` (JSON/XML) **עובד ב-200**, ואינו מאחורי אותה חומה. שימוש: אימות XML ל-#6/#7/#12 |
| `web.archive.org` (דף הבית) | ✅ **200** | **תוקן משלב 1** — הייתה חסימת `WebFetch` עצמה, לא רשת. `archive.org/wayback/available` (API) גם עובד — פתח את סגירת #8 |
| `regulations.gov` (docket + attachment URL + API) | **403** על כל השלושה | עדיין חסום — לא נדרש הפעם, Wayback route עבד |
| `amif.org` | **404** (לא נבדק מחדש בשני הסבבים — מחוץ להיקף) | ללא שינוי מהמפה |
| **`www.seriouseats.com`** | **402** ל-`curl`/בקשה ללא UA · **✅ 200 עם `node fetch` + User-Agent תקני** | **תוקן בסבב 2 (Job E)** — 402 היה שער בוט/חסר-UA, לא paywall תוכן אמיתי. סגר את #19 במלואו |
| `douglasbaldwin.com/sous-vide.html` (עמוד HTML) | **403** ל-node fetch (שונה מ-WebFetch שהצליח בשלב 1!) | **ראה השורה הבאה — אותו מארח, תוצאה הפוכה לפי נתיב** |
| `douglasbaldwin.com/Baldwin-IJGFS-Preprint.pdf` (קובץ PDF סטטי) | ✅ **200**, 288,024 בייט | **תוקן/נסגר בסבב 2** — סגר את מאמר 2012 (#15) שנכשל בשלב 1 |
| `www.sciencedirect.com` | **403** (paywall אמיתי) | ללא שינוי מהותי — לא נדרש, ה-preprint מספיק |
| `www.ams.usda.gov` | ✅ **200** | לא כל `*.usda.gov` חסום |
| **`ask.usda.gov`** | **503**, אך גוף התגובה עצמו: *"...no longer available... use ask.fsis.usda.gov"* | **תוקן בסבב 2 (Job E)** — זו **הגירת-אתר מוצהרת**, לא תקלה זמנית. סגר את #4 |
| **`ask.fsis.usda.gov`** (האתר החדש, Lightning Web Components SPA) | `node fetch`/ניווט-ישיר לקישור עמוק → "Invalid Page" · **Playwright + ניווט-שורש + חיפוש-פנימי → 200, מרונדר** | **מארח חדש** — דורש דפדפן, לא fetch ישיר, כי הראוט אינו server-side |
| `www.maine.gov` | ✅ **200** | מארח חדש — מראה איכותית ל-#8, עם ציטוטי עמוד למקור המקורי |
| `curl` (כל היעדים) | **000 — אין רשת ל-`curl` הספציפי** | זו הגבלת sandbox על `curl`, לא ניתוק-רשת של הסביבה. `node fetch` לאותם יעדים מחזיר קודי HTTP אמיתיים |
| `WebSearch` על `site:seriouseats.com` | **לא מחזיר תוצאות מהדומיין** | ממצא סבב 2: אינדקס החיפוש של הכלי לא כולל את הדומיין, גם כשהדומיין עצמו נגיש ל-fetch. יש לנחש/לאמת URL מועמדים ישירות בקוד סטטוס, לא להסתמך על WebSearch |

**עובד ואומת שוב, ללא שינוי מהמפה:** `govinfo.gov` (CFR + FR) · `ncagr.gov` · `inspection.canada.ca` ·
`eur-lex.europa.eu` · `portal.ct.gov` · `www2.myfloridalicense.com` · `amazingribs.com`.

### כלל העבודה לסשן הבא (ללא שינוי מהותי מ-00-SOURCE-MAP §1, מקובע כאן שוב)

1. **התחל תמיד ב-`node -e "fetch(url)"` עם User-Agent תקני, לא ב-`curl` ולא ב-`WebFetch`.**
2. **בדוק תמיד את נתיב ה-API/JSON/XML של מקור לפני שמוותרים על אתר "חסום".**
3. **כשעמוד HTML חסום באתר שכן מכיל PDF ישיר, נסה את קובץ ה-PDF ישירות** — לאו דווקא אותה חסימה.
4. **`fsis.usda.gov` הוא עדיין חסימה אמיתית מאומתת** — העקיפה המאומתת היא Wayback Machine או מראה ממשלתית אחרת.
5. **תמונה מוטמעת ב-PDF (טבלה שלא מפרסרת עם `pypdf`) אינה סוף הדרך** — `pymupdf` render + מודל-ראייה
   (Gemini) בשני מעברים בלתי-תלויים, מודדים הסכמה בפועל, סוגר גם רשתות-מספרים גדולות (הוכח על 91 שורות).
6. **402/403 ראשוני עשוי להיות שער-בוט על UA חסר, לא paywall אמיתי** — נסה שוב עם `User-Agent` דפדפן
   תקני לפני שמסמנים מארח כחסום-תוכן.
7. **SPA שמחזיר "Invalid Page" בניווט ישיר לקישור-עומק** — לרוב פותר הראוטינג רק דרך ניווט-שורש +
   חיפוש/ניווט-פנימי ב-Playwright, לא בקריאת fetch ישירה.

---

*המקור המנחה: `00-SOURCE-MAP.md` §1 (מטריצת השליפה המתוקנת). הדוח המאוחד:
`.superpowers/sdd/corpus-download-task-1-report.md`. דוחות החלקים:
`corpus-download-task-1-report-{A,B,C,D,E}.md`.*
