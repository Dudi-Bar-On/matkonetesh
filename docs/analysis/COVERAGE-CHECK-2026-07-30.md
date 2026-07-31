# COVERAGE CHECK — 2026-07-30: האם כל 156 הפערים משוקללים בתוכנית?

> משימת אימות לבקשת התכנון (משימה 7/7). מקורות: `2026-07-27-gap-closing-BIG-STATUS.md` + `gap-status-parts/part-*.md` (141) ·
> `GAP-DELTA-2026-07-30.md` (+15 = מרשם 156) · `ROADMAP-2026-07-30.md` (הנחיתות) ·
> `docs/research/v5-engine/DECISION-REGISTER.md` · `DECISIONS-TO-PLAN-2026-07-30.md` · `METHODS-RESEARCH-HE.md`.
>
> **מקרא נחיתה:** CLOSED = סגור היום · Phase N / Thread = נוחת בפאזה נקובה בשם ·
> ⚠️Phase N = נחיתת-יתום מוצעת, **טעונה אישור בעלים בשער Phase 0** · DEFERRED = דחוי בהחלטת בעלים (R8) ·
> **NO LANDING** = פתוח ואינו נוחת בשום פאזה נקובה.

---

## Part 1 · הטבלה המלאה — 156 שורות

### Band A · Safety (15)

| ID | Landing | הערה |
|---|---|---|
| A1 | **CLOSED** v262 | vcGuardSpoken |
| A2 | **CLOSED** v262 | vcTransSafe |
| A3 | **CLOSED** v262 | aiSafetyToC |
| A4 | **⚠️ NO LANDING** | שער סירוב לאבחון — ברשימת "כמעט-יתומים" בלבד, ללא פאזה |
| A5 🔴 | ⚠️Phase 3 | cure-scale BLOCK כחוק ב-`rules.js`; נחיתת-יתום, מאומתת בשער ה-Phase |
| A6 | Sync Thread | RESHAPED (Dec-D2): קריאות פרוב = execution-writes |
| A7 | Phase 10 | `safetyGate` (פרוסה 2) = הצרכן של `safetyDiff` |
| A8 | Phase 12 | band-F i18n, נקוב בשם |
| A9 | **CLOSED** v263 | DST fix |
| A10 | ⚠️Phase 2 | תיקון נתון קבאנוס — נחיתת-יתום |
| A11 | ⚠️Phase 3 | 18 ערכי מלח ↔ `thresholds.py` — נחיתת-יתום |
| A12 | ⚠️Phase 12 | הזנת 5 אתרי הגארד ל-TTS, רוכב על חילוץ Voice — נחיתת-יתום |
| A13 | **⚠️ NO LANDING** | `padvRender` innerHTML לא-מוגן — "כמעט-יתום", ללא פאזה |
| A14 | Phase 7 | CP3 סופג (ציטוט ראשוני לרצפות איברים) |
| A15 | **⚠️ NO LANDING** | חוק %/pH בדיבור — "כמעט-יתום", ללא פאזה |

### Band B · Correctness (31)

| ID | Landing | הערה |
|---|---|---|
| B1 | ⚠️Phase 9b | איחוד פסק-קיבולת — תחיית P5b, טעונה אישור |
| B2 | Phase 3 | אשכול ה-13 (חילוץ ORCH) |
| B3 | Phase 3 | אשכול ה-13 |
| B4 | Phase 3 | אשכול ה-13 |
| B5 | ⚠️Phase 9b | פסק-קיבולת |
| B6 | ⚠️Phase 9b | פסק-קיבולת |
| B7 | ⚠️Phase 9b | פסק-קיבולת |
| B8 | Phase 3 | אשכול ה-13 |
| B9 | Phase 3 | אשכול ה-13 |
| B10 | ⚠️Phase 9b | סכימת keyspace |
| B11 | ⚠️Phase 9b | פסק-קיבולת |
| B12 | ⚠️Phase 9b | keyspace |
| B13 | ⚠️Phase 9b | keyspace (זהות משימה) |
| B14 | Phase 3 | אשכול ה-13 |
| B15 | Phase 3 | אשכול ה-13 |
| B16 | Phase 3 | אשכול ה-13 |
| B17 | Phase 12 | plural helper, נקוב |
| B18 | ⚠️Phase 9b | `today()`/`isoDate()` |
| B19 | Phase 1 | P0-worker |
| B20 | Phase 1 | P0-worker |
| B21 | Phase 1 | P0-worker |
| B22 | Phase 1 | P0-worker |
| B23 | **CLOSED** | serve.js de-clustered (L18) |
| B24 | **⚠️ NO LANDING** | `</script` escape — לא מופיע בשום מקום ב-ROADMAP, גם לא ב-backlog |
| B25 | **⚠️ NO LANDING** | SW catch ריק — לא מופיע ב-ROADMAP כלל |
| B26 | **CLOSED** | isSecureContext (PRE-6) |
| B27 | Phase 12 | שארית CWV (reshaped ע"י Dec-A1) |
| B28 | **⚠️ NO LANDING** | SPA fallback 200/2.27MB — לא מופיע ב-ROADMAP כלל |
| B29 | ⚠️Phase 3 | נורמליזציית saved/svh — נחיתת-יתום |
| B30 | ⚠️Phase 3 | סנטינל `svt=0` — נחיתת-יתום |
| B31 | **⚠️ NO LANDING** (partial) | טקסט ההערה הישנה — לא מופיע ב-ROADMAP כלל |

### Band C · Orchestrator (12)

| ID | Landing | הערה |
|---|---|---|
| C1 | Phase 10 | RESHAPED: מדרג מסלולים מצוטטים, לעולם לא מייצר (Dec-F1/G1) |
| C2 | Phase 10 | RESHAPED: AI מדרג `action_id` מוטיפס בלבד |
| C3 | Phase 10 | share/reassign (פרוסה 2) |
| C4 | Phase 10 | perSlot fix |
| C5 | Phase 10 | slack fix |
| C6 | Phase 10 | RESHAPED: batch = מהלך סולבר |
| C7 | **⚠️ NO LANDING** | `SCHED_PULL_MAX_MS` ללא UI — "כמעט-יתום" |
| C8 | Phase 8 (חלקי) | O-1 override פר-אירוע; overrides לשלב/מדף/חימום **נשארים פתוחים** |
| C9 | **⚠️ NO LANDING** | scroll-to-now — "כמעט-יתום" |
| C10 | **⚠️ NO LANDING** | סמן יום ב-voice-cook — "כמעט-יתום" |
| C11 | **⚠️ NO LANDING** | סדר מכשירים ב-occupancy — "כמעט-יתום" |
| C12 | Phase 11 | קופיילוט חי; `advanceWhen` מ-CP2 הוא הקלט |

### Band D · Equipment-to-plan (11)

| ID | Landing | הערה |
|---|---|---|
| D1 | Phase 9 | E6 "D1-join" (אומת: עדיין אפס callers) |
| D2 | Phase 9 | RESHAPED (Dec-G3): הטוקנים החדשים נצרכים ב-E6 |
| D3 | **CLOSED** v263 | |
| D4 | Phase 2+4 | RESHAPED (Dec-F2a): עטיפה=שלב (P2), רינדור הרצף (P4) |
| D5 | **⚠️ NO LANDING** | ביקוש לפי סועדים/חתיכות — "כמעט-יתום" |
| D6 | Sync Thread (אחרי S1) | RESHAPED committed-later (Dec-D7); **לא נספר בברן-דאון** |
| D7 | Phase 9 | E6 grinder/stuffer±sealer |
| D8 | Phase 2 | RESHAPED (Dec-G1/G2): preheat כתכונת-שיטה |
| D9 | Phase 2 | ישיר/עקיף למודל (כשל #4) |
| D10 | **⚠️ NO LANDING** | pellet רואה "🪵 oak" — "כמעט-יתום" |
| D11 | **CLOSED** | שער E2 (2026-07-27), D11-negative witnessed |

### Band E · AI (16)

| ID | Landing | הערה |
|---|---|---|
| E1 | **CLOSED** v261 | |
| E2 | **CLOSED** v262-263 | |
| E3 | **CLOSED** PRE-2 | |
| E4 | **CLOSED** PRE-5 | |
| E5 | Phase 9 | סולם approve/deny (O-2) = חוזה האישור האוניברסלי |
| E6 | **⚠️ NO LANDING** | fallback שקט ל-BYOK — לא מופיע ב-ROADMAP כלל |
| E7 | **CLOSED** v263 | |
| E8 | **CLOSED** v263 | |
| E9 | Phase 1 + Phase 12 | פיצול מילונים (P1); שארית observer/cap (P12) |
| E10 | **⚠️ NO LANDING** | retry כפול-חיוב — לא מופיע ב-ROADMAP כלל |
| E11 | **⚠️ NO LANDING** | `responseSchema` — לא מופיע ב-ROADMAP כלל |
| E12 | **⚠️ NO LANDING** | קונקטנציית טקסט חופשי — לא מופיע ב-ROADMAP כלל |
| E13 | ⚠️Phase 12 | שגיאות TTS — נחיתת-יתום (Dec-E6 לא מכסה) |
| E14 | Phase 1 | P0-worker |
| E15 | **⚠️ NO LANDING** | CSP/security headers — לא מופיע ב-ROADMAP כלל |
| E16 | Phase 5 | אימוץ+מחיקת `openTools` (Dec-B1) |

### Band F · Non-functional (36)

| ID | Landing | הערה |
|---|---|---|
| F-1 | **CLOSED** v268-272 | |
| F-2 | **CLOSED** v268-272 | |
| F-3 | **CLOSED** v268-272 | |
| F-4 | **NO LANDING** | בלוק ה-a11y (⚠️ הצעת "Phase 12b" — טרם נפסקה) |
| F-5 | Phase 12 | נקוב |
| F-6 | Phase 12 | CWV, נקוב (+reshaped Dec-A1) |
| F-7 | Phase 12 | CWV, נקוב |
| F-8 | Phase 12 | MutationObserver, עם חילוץ I18N |
| F-9 | **NO LANDING** | בלוק ה-a11y |
| F-10 | Phase 12 | מיניפיקציה (מותרת מאז Dec-A3) |
| F-11…F-22 | **NO LANDING** ×12 | בלוק ה-a11y: Lighthouse/ARIA/contrast/targets/labels/landmarks |
| F-23 | **WAIVED** | prefers-color-scheme נדחה במפורש |
| F-24 | Phase 12 | RESHAPED: TWA ל-Play |
| F-25 | Phase 12 | TWA |
| F-26…F-29 | **NO LANDING** ×4 | בלוק ה-a11y/craft |
| F-30 | ⚠️Phase 4 (ביניים) + Phase 9b (סופי) | סימפטום ריבוי פסקי-קיבולת |
| F-31 | ⚠️Phase 4 + Phase 9b | כנ"ל |
| F-32 | **NO LANDING** | בלוק ה-craft |
| F-33 | Phase 12 | chevrons, נקוב |
| F-34…F-36 | **NO LANDING** ×3 | בלוק ה-craft/tokens |

### Band G · Product-platform (8)

| ID | Landing | הערה |
|---|---|---|
| G-1 | Phase 12 | ניקוי טענות אופליין, נקוב |
| G-2 | Sync Thread + ⚠️Phase 9b | SYNCABLE = סכימת סנכרון; רגיסטר מיגרציות מלא ב-9b |
| G-3 | Phase 12 | **בוטלה הדחייה** — אנליטיקס נותק מהתמחור |
| G-4 | Sync Thread | RESHAPED (Dec-D8): קוד גישה→זכאות, token קשור-מכשיר |
| G-5 | Sync Thread | SUPERSEDED (Dec-D1–D5): פאזת CRDT נמחקה בהחלטה; נבנה כותב-אחד |
| G-6 | Sync Thread (אחרי S1) | committed-later (Dec-D7) |
| G-7 | Phase 2+5 (חלקי) / **שארית NO LANDING** | `svOrderDesc` (P2) + `openTools` (P5); שאר סריקת ה-dead-surface ללא נחיתה |
| G-8 | **⚠️ NO LANDING** | 116 empty catches — "כמעט-יתום" |

### Band H · Business (12)

| ID | Landing | הערה |
|---|---|---|
| H-1 | **DEFERRED** | Paddle הוחלט (Dec-D8), קוד נדחה עם band H |
| H-2 | **DEFERRED** (R8) | |
| H-3 | Phase 1 | P0-worker |
| H-4…H-8 | **DEFERRED** (R8) ×5 | |
| H-9 | **⚠️ NO LANDING** | תיקון טענת "Nobody owns" — "כמעט-יתום" |
| H-10 | **⚠️ NO LANDING** | "guards your cure" — כבול ל-A5; "כמעט-יתום" |
| H-11 | **DEFERRED** (R8) | |
| H-12 | **DEFERRED** (owner-adopted) | |

### N-series (15) — כולם נחתו

| ID | Landing | ID | Landing | ID | Landing |
|---|---|---|---|---|---|
| N-1 🔴 | Phase 1 | N-6 🔴 | Phase 2 | N-11 | Phase 3/5/9/12 |
| N-2 | Phase 1 | N-7 | Phase 2 | N-12 | Phase 3 |
| N-3 | Language Thread | N-8 | Phase 7 | N-13 | Phase 5 |
| N-4 | Phase 1 | N-9 | Phase 5 | N-14 | Sync Thread |
| N-5 | Phase 1 (מדיניות) | N-10 | Phase 12 | N-15 | Phase 0 |

---

## Part 1a · סיכום המספרים + אימות אריתמטיקת הברן-דאון

**חלוקת 156:**

| קטגוריה | כמות | פירוט |
|---|---|---|
| CLOSED היום | **17** | A1-A3, A9, B23, B26, D3, D11, E1-E4, E7, E8, F-1..F-3 |
| נוחת בפאזה נקובה | **86** | מהם **18 נחיתות-יתום ⚠️** (A5,A10,A11,A12,E13,B29,B30,B1,B5,B6,B7,B10,B11,B12,B13,B18,F-30,F-31) + Phase 9b עצמה — הכול טעון אישור בשער Phase 0; ומהם D6 committed-later שאינו נספר בברן-דאון |
| DEFERRED/WAIVED | **10** | F-23 + H-1, H-2, H-4..H-8, H-11, H-12 |
| **NO LANDING** | **43** | ראו רשימה מלאה מטה |

**רשימת ה-NO LANDING המלאה (43):**
- **בלוק ה-a11y/presentation — 22** (לא "~20" כפי שנכתב ב-GAP-DELTA וב-ROADMAP; הספירה בפועל: F-4, F-9, F-11–F-22 [12], F-26–F-29 [4], F-32, F-34–F-36 [3] = 22). הצעת "Phase 12b" קיימת אך **טרם נפסקה**.
- **12 "כמעט-יתומים" שנקובים ב-ROADMAP §3 כ-backlog לפסיקה:** A4, A13, A15, C7, C9, C10, C11, D5, D10, G-8, H-9, H-10.
- **9 פערים פתוחים שאינם מופיעים ב-ROADMAP בכלל** (לא בפאזות ולא ב-backlog; מופיעים רק כ-"unaffected" ב-GAP-DELTA): **B24, B25, B28, B31, E6, E10, E11, E12, E15** — וגם שארית G-7 (סריקת dead-surface). זהו החור השקט ביותר במסמך התוכנית.

**אימות הברן-דאון (טענת ה-ROADMAP: 17 → ~100/156):**
- ספירת מזהים בשורות המרשם: P0:1 · P1:10 · P2:5 · P3:13 · P4:1 · P5:3 · P6:0 · P7:2 · P8:1 · P9:4 · P9b:11 · P10:**7** (A7+C1..C6) · P11:1 · P12:18 · L:1 · S:6 = **84**; ‎17+84 = **101**, לא 100. הפער: שורת Phase 10 מונה 7 מזהים אך המצטבר (68→74) מוסיף 6 — off-by-one בתוך ה-±1 שהמסמך עצמו מצהיר.
- הנותר בסיום: 156−101 = **55** (ה-ROADMAP: "~56"). פירוקו בפועל: 10 דחויים (ה-ROADMAP כתב 9 — H-1 לא נספר) + 22 a11y (נכתב ~20) + 23 קטנים (נכתב ~27). **סה"כ מתכנס; תתי-הסעיפים אינם מדויקים.**
- D6 נחת (Sync, committed-later) אך אינו נספר כסגירה — עקבי עם ה-55.

---

## Part 2 · השפעת v5.0 מול מפת הפערים

**מקרא:** ADDS = יכולת ששום פער לא ביקש (סקופ חדש מעבר ל-141) · REPLACES = הפער היה קיים וההחלטה שינתה את **צורת הפתרון** · CHANGES = הפער עוצב/הורחב מחדש.

| רכיב v5 | סיווג | פער/ים קשורים | נוחת ב |
|---|---|---|---|
| `rules.js` רגיסטר חוקים + `thresholds.py` (Dec-F5) | **REPLACES** — 13 אתרי החלטה מפוזרים → רגיסטר קודים מוטיפסים; הופך לרכב הנחיתה של יתומי הבטיחות/נתונים | A5 (BLOCK כחוק), A11, B29, B30; מזין את C2 | Phase 3 |
| outcome-as-input / `path_outcomes` (Dec-F1/F2/F2a) | **ADDS** (וקטור תוצאה מצוטט — אף פער לא ביקש) + **REPLACES** את צורת הסולבר: מדרג מסלולים מצוטטים, לעולם לא מייצר | C1, C2 (reshaped), D4 (reshaped), G-7 (`svOrderDesc` נצרך) | Phase 2 (נתון) → 4 (תצוגה) → 10 (דירוג) |
| מדד קולגן + `item_facts.py` (Dec-F4) | **REPLACES** — מודל לא-מוצהר משוכפל (`c.doneness`/`tgt>=90`) → עובדות נגזרות מוצהרות | אין פער ממוספר ישיר; תומך בנורמליזציית B29/B30 | Phase 3 |
| הרחבת אוצר השיטות ~30+~10 (Dec-G1/G4/G5) | **CHANGES** — מרחב המהלכים של הסולבר גדל פי 10; preheat הופך תכונת-שיטה; היקף המחקר של CP3 גדל 3→~30; מוליד את N-6/N-8 | C1, C6, D8, A14 (נספג ב-CP3), N-6, N-8 | Phase 2 (שכבה 1) → Phase 7 (שכבה 2, מתמשך) |
| תוספות ציוד: קדרה · סיר לחץ · מחולל עשן קר · פלאנצ'ה · רוטיסרי · מייבש (Dec-G3) | **ADDS** (סקופ חדש) + **CHANGES** D2 — הנכסים מקבלים צרכני-תכנון ראשונים | D2, D8 | Phase 2 (סכימה) → Phase 9 (צריכה ב-E6) |
| סנכרון כותב-אחד + fan-out חד-כיווני (Dec-D1–D5, D8) | **REPLACES** — פאזת CRDT/יישוב-התנגשויות שלמה **נמחקה בהחלטה**; קוד גישה מודר מזהות לזכאות; קריאות פרוב הופכות execution-writes | G-5 (superseded), G-4, G-2, A6, G-6/N-14 | Sync Thread (אחרי אישור מפרט S1) |
| `advanceWhen` תנאי-מעבר פר-שלב | **ADDS** (פרדיקטים מנתון מצוטט — אף פער לא ביקש) + **CHANGES** את פתרון C12: הקופיילוט משווה קריאת פרוב מול הפרדיקט | C12 | Phase 4 (כתכונת מסלול) → Phase 11 (כמנגנון חי) |
| מחשבון מתכלים (פחם/פלט/נייר) | **ADDS** — אין לנו כלום כזה; הקצבים שלהם לא מצוטטים → צורה נאמצת, מספרים מצוטטים בעצמנו | ליד D10 (fuelNote) בלבד | Phase 10 פרוסה 3 (wood/hold) — ⚠️ ראו הערה |
| צידנית כבאפר (Faux Cambro) | **ADDS** — מהלך hold משחרר-מקום; מוקשח בביקורת המומחים (מינימום-טמפ, תקציב danger-zone, איסור עוף/דג) | C6 (מרחב מהלכי hold) | Phase 10 פרוסה 3 (hold+danger-zone) — ⚠️ |
| כשל מכשיר → re-plan | **ADDS** — יש גלאי התנגשות, אין התאוששות מנפילת חומרה | C12-סמוך | Phase 11 (re-solve חי) — ⚠️ |
| הזנת פרמטרי מתכון | **מפוצל:** עקרון הפרמטרים המוטיפסים (enum ולא פרוזה; עטיפה=שלב) = **CHANGES**, נוחת Phase 2/3. הפיצ'ר "מתכון טקסטואלי → פרמטרים" (Gemini) = **אין החלטה ואין נחיתה** | D4/F2a (העיקרון) | Phase 2/3 (עיקרון) · הפיצ'ר: **NO LANDING — טעון פסיקה** |

**⚠️ הערת עיגון לשלושת רכיבי "גל 3":** מתכלים/צידנית/כשל-מכשיר אומצו ב-`DECISION-HE.md` ("גל 3 — עם האורקסטרטור P8") אך **אינם מופיעים ברגיסטר ההחלטות (A1..H7) ואינם נקובים בשמם בתוכן Phase 10/11 ב-ROADMAP** ("wood/hold+danger-zone" מגלם אותם חלקית). מומלץ לאשרר אותם בשם בשער ה-go/no-go של Phase 10.

---

## שורה תחתונה

התוכנית נותנת נחיתה נקובה ל-86 פערים וסוגרת ~101/156 בסיומה — אך **43 פערים פתוחים אינם נוחתים בשום פאזה**: 22 בלוק ה-a11y (הצעת Phase 12b טרם נפסקה), 12 "כמעט-יתומים" שממתינים לפסיקת שער Phase 0, ו-**9 שאינם מופיעים במסמך התוכנית כלל** (B24, B25, B28, B31, E6, E10, E11, E12, E15 + שארית G-7). המסמך אינו שלם עד ששלוש הפסיקות הללו — 18 נחיתות היתומים + Phase 9b, גורל בלוק ה-a11y, ותיוג 9 הנעדרים — נכנסות אליו במפורש.

---

## Part 3 · Resolution — פסיקת בעלים 30.7 (המסמך נסגר)

**ארבע הפסיקות אושרו במלואן 30.7**, יחד עם **Dec-H8 — כלל הנחיתה המלאה ("שום דבר באוויר")** ועם H9/H10 (טבלת סיכום-משימה + לוח מצב חי): (1) 18 נחיתות היתומים + Phase 9b · (2) בלוק ה-a11y → **Phase 12b** חדש (+F-23, הוויתור בוטל) · (3) 9 החורים השקטים נחתו · (4) 12 הכמעט-יתומים שובצו (שיבוצי-מנהל, §10.8). הכול הוחל על `ROADMAP-2026-07-30.md`.

**43 פריטי ה-NO LANDING — כולם נחתו:**
- **בלוק ה-a11y (22, +F-23):** F-4, F-9, F-11–F-22, F-26–F-29, F-32, F-34–F-36 (+F-23) → **Phase 12b**.
- **12 הכמעט-יתומים:** A4→Phase 9 · A13→Phase 5 · A15→Phase 12 · C7→Phase 10 · C9→Phase 12 · C10→Phase 12 · C11→Phase 12 · D5→Phase 9b · D10→Phase 10 · G-8→Phase 12 · H-9→Phase 0 · H-10→Phase 3.
- **9 הנעדרים:** B24/B25/E15→Phase 1 · B31→Phase 2 · E6/E10/E11/E12→Phase 9 · B28→Phase 12; **שארית G-7**→Phase 12.

**אריתמטיקה סופית (מתקנת את סטיות Part 1a, כולל ה-off-by-one של Phase 10):**
156 = **17 CLOSED** + **129 נסגרים בפאזות נקובות** + **10 מעוגני-טריגר** (9 band-H — טריגר: אבן-הדרך זהות/Paddle של ה-Sync Thread; D6 — טריגר: השלמת S1). **מצב סיום התוכנית: 146/156 (~94%).** תתי-הספירות תוקנו: deferred = 9 (band H; F-23 יצא ל-12b) + D6 · a11y = 23 (כולל F-23) · "קטנים ללא נחיתה" = **0**.

בנוסף: רכיבי גל-3 (מחשבון מתכלים · צידנית-כבאפר · כשל-מכשיר→re-plan) עוגנו **בשמם** ב-Phase 10/11 (מספריהם יצוטטו בעצמנו, לא מההצעה), והפיצ'ר "מתכון טקסטואלי → פרמטרים" נרשם כ**משימת-דיון (H8-ג)** ב-Phase 9.

**המרשם נחות במלואו — 0 פריטים "באוויר".** נאכף מכנית מעתה: בדיקת no-unlanded-items ב-`check-meta.mjs` בכל שער-Phase ובסגירת קשת; מצב חי ב-`docs/STATUS-BOARD.md`.
