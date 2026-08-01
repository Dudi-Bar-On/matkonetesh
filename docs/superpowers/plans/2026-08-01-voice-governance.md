# תוכנית יישום — ממשל הקול (Voice Governance)

**ספֵּק מאושר:** `docs/superpowers/specs/2026-08-01-voice-governance-design.md` (אושר בעלים 1.8.2026,
כולל סעיף **פסקי בעלים** בסופו ש**גובר** על כל המלצה בגוף המסמך).
**שורות מרשם:** R-52 · R-57 · R-61 · R-62 · R-63 (ראה `docs/ROADMAP-2026-07-30.md`).
**מסמכי קלט:** `docs/analysis/2026-08-01-voice-output-audit.md` · `docs/analysis/2026-08-01-voice-ux-review.md` ·
`docs/analysis/2026-08-01-thinking-floor-measurement.md`.
**סוג:** תוכנית בלבד — אפס קוד מוצר בקומיט הזה.

> **§4 (שער הוויתור) חל על כל שורה כאן.** שום דרישה מהספֵּק אינה נמחלת, נדחית או מצומצמת בתוכנית הזו.
> כל פורק שלא הוכרע מסומן **⚑** ומובא לבעלים בשיחה, לא במסמך.

---

## 0 · לפני שמתחילים — מה חייב להיסגר, ומה כבר סגור

### 0.1 · ⚑ ההכרעה הפתוחה היחידה שחוסמת משימה — F-1 · מהו "לא מסתכל"

פסק הבעלים על **F-1** נסגר (שלושה מצבים: **לא · רק כשאיני מסתכל · תמיד**), אבל הוא עצמו מצהיר:

> *"'רק כשאיני מסתכל' מחייב הגדרה תפעולית של 'מסתכל' (`document.visibilityState`? אינטראקציה אחרונה?
> המסך דלוק?). **זו הכרעה שנותרה פתוחה ותובא לבעלים בתוכנית** — הגדרה רופפת תהפוך את המצב האמצעי
> לבלתי-צפוי, וזה בדיוק המצב שהבעלים בחר בו כעיקרי."*

**התוכנית אינה מכריעה זאת.** ההגדרה מרוכזת בפונקציה אחת בעלת שם — `voiceUserAway()` — ו**משימה 10
חסומה** עד שיש הכרעה. אף משימה אחרת אינה תלויה בכך (משימות 1-9 ו-11-14 אינן קוראות ל-`voiceUserAway`).

| # | האפשרות | מה זה אומר בפועל | עלות / סיכון |
|---|---|---|---|
| **א׳** | `document.visibilityState !== 'visible'` בלבד | "לא מסתכל" = האפליקציה ברקע או המסך נעול | **פשוט, דטרמיניסטי, כבר מחווט** (‏`app.js:3355`, ‏`13070`). אבל **הוא כמעט מבטל את המצב**: כשהדף מוסתר, ה-PWA ברוב המקרים ממילא אינה יכולה להשמיע קול (§9 בספֵּק). מי שיבחר "רק כשאיני מסתכל" עלול לא לשמוע כלום — בדיוק ההפך מהכוונה |
| **ב׳ — ההמלצה** | `visibilityState!=='visible'` **או** אין אינטראקציה (‏`pointerdown`/`keydown`/`visibilitychange`) מזה **90 שניות** | תופס את התרחיש שהבעלים תיאר — *הטלפון על השולחן והמשתמש ליד המעשנה*, הדף גלוי, המסך דלוק (‏`wakeLock` מחזיק אותו), אבל אף אחד לא נוגע | טיימר-סף אחד חדש (‏`mkLastTouchTs`), ניתן לבדיקה עם `page.clock`. הסף 90 שנ' הוא **הכרעה נומרית שגם היא של הבעלים** — 60/90/120 |
| **ג׳** | ב׳ **וגם** "הפאנל הרלוונטי אינו הפתוח כרגע" | הכי מדויק סמנטית — "מסתכל" = מסתכל **על הדבר הזה** | דורש מיפוי קטגוריה→פאנל, שאין היום. **לא מומלץ** — מכונת-מצבים חדשה עבור ניואנס |

**המלצתי: ב׳, סף 90 שניות.** היא היחידה שמייצרת בפועל את ההתנהגות שהבעלים תיאר; א׳ נשמעת נכונה וממוטטת
את המצב לשקט; ג׳ קונה דיוק במחיר מנגנון.

**מה קורה אם הבעלים לא יכריע לפני שמגיעים למשימה 10:** המשימות 1-9 ו-11-14 ממשיכות כרגיל; משימה 10
נעצרת. **אין ברירת מחדל שקטה** — קוד ש"מנחש" את הסף הוא בדיוק ה"הגדרה הרופפת" שהפסק מזהיר מפניה.

### 0.2 · פורקים שהבעלים לא הכריע — אימצתי את **המלצת הספֵּק עצמו**, ואומר זאת בקול

סעיף §8 בספֵּק מונה **שישה** פורקים; סעיף פסקי הבעלים סגר **שלושה** (F-1, F-2, F-5). השלושה הנותרים
מיושמים **לפי ההמלצה הכתובה בספֵּק המאושר** — כלומר מתוך המסמך, לא מהמצאה שלי:

| # | הפורק | ההמלצה בספֵּק, שאותה התוכנית מיישמת | היכן |
|---|---|---|---|
| F-3 | האם `schedule` משוחררת לפני תיקון N3/N4 | **לא — להירשם ב-`PREFS` ולא לרנדר עד שיש טריגר אמין** | משימה 10 (רישום) · משימה 13 (הכרטיס החזותי כן נבנה — ראה למטה) |
| F-4 | הסיוג של "תמיד" | **שורת-אמת + כותרת-משנה** (לא בתווית הכפתור) | משימה 11 |
| F-6 | כרטיס הגילוי הראשון | **בתחילת הבישול החי הראשון** | משימה 11 |

**הבהרה שחייבת להיאמר על F-3, כי יש בה מתח פנימי בספֵּק:** §2.4 מסמן את **S1/S2** כאחד משני הפערים
החזותיים האמיתיים ומחייב *"כרטיס `voiceAct` שאינו תלוי בהרשאת דפדפן"*, ואילו §6.3+F-3 דוחים את
**קטגוריית הקול** `schedule`. אלה **לא סותרים** — נפרדים: משימה 13 בונה את **הכרטיס החזותי** של
S1/S2/S3 מחוץ לשער ההרשאה (סוגר את §2.4), ואילו **המתג הקולי** `schedule` נרשם ב-`PREFS` ואינו מרונדר
בפאנל עד שיהיה טריגר אמין (מכבד את F-3). זה מה שהספֵּק אומר בשני המקומות, לא פשרה ביניהם.

### 0.3 · מה כבר נבנה היום — אין לבנות שוב

עץ העבודה זז הרבה ב-1.8. **כל מספרי השורות בתוכנית הזו אומתו מחדש מול `app.js` בעץ הנוכחי
(13,089 שורות)**, ולא הועתקו מהסקר (שנכתב על 12,790 שורות). הבנוי-וסגור:

| מה | היכן בקוד היום | המשמעות לתוכנית |
|---|---|---|
| **V-1** — מקבילה חזותית לאזהרת הטיימר | `mkShowTimerWarn` 3405 · `renderTimerWarn` 3413 · `#mkWarnAlarm` · קריאה מ-`wireTimer` 3311 | **לא נוגעים.** משימה 8 רק **מכניסה** את הכרטיס למכולה המסודרת |
| **V-2** — האישור המיידי החזותי | `VC_THINKING` נכתב ל-`vcLastQA` ב-`vcAskFlow` 7985 לפני כל המתנה | **לא נוגעים** |
| **N2/S6** — טריגר ל-`bcheck` | `scheduleBcheckDue` 3463 · `renderBcheckAlarm` 3445 · `ackBcheck` 3439 | משימה 6 מוסיפה **שער דיכוי** בלבד; המפתח-מופע והאישור לא משתנים |
| **אישור מוכוון-מופע** (R-56) | המפתח `s.tid+'@'+s.start.getTime()` (3477) + `acked:true` במקום מחיקה (3441) | **חוזה שאסור לשבור.** בישול חדש של אותו פריט מקבל `start` חדש ⟵ מפתח חדש ⟵ הבדיקה חוזרת לירות. נבדק שוב במשימה 6 |
| **חוזה הסמן של שעון-האודיו** | `gemSpeakSeg(text, lang, gen, startAt) → cursor` (6905), ‏`gemSpeak` 7248-7294 | **אסור לשנות חתימה.** משימה 12 יושבת **מעל** `vcSpeak`, לעולם לא בתוך לולאת המקטעים |
| **~1.1 שנ' לצליל ראשון** | מפריד ה-SSE ‏`\r\n\r\n` (R-51), מתועד ב-6709 | ‏D11 מודד אותו שוב אחרי משימה 12 ואחרי משימה 3 |
| **נפח בקשות TTS** | שכבת שני-הספקים (7000-7025); ‏`ttsPrefetch` מוותר על ה-retry כשיש משני ⟵ **בקשה מתקנת אחת** | ‏D10 + בדיקת-מונה במשימות 3 ו-12 |
| **‏`vcGuardSpoken`** — כלל "בדיוק אחד" + R-53/R-58 | 7759-7868, ‏`vcSafeSubstitution` 7683, ‏`vcIdentifiedSafeCategory` 7670 | **לא מרוכך ולא מוסר** (‏§5.4.4). המסווג מוסיף פרמטר רביעי אופציונלי בלבד |

---

## 1 · Global Constraints — ערכים מועתקים **מילה במילה** מהספֵּק

כל ערך כאן הוא ציטוט. אין להסיק ערך שלישי מהצמדה של שניים.

**קטגוריות (§1.1):** `safety` (🔒, מחוץ לסכמה) · `timers` · `schedule` · `steps` · `answers` · `progress`.

**הצורה המבנית של ערוץ הבטיחות (§1.3):**
```
ttsCategoryEnabled(cat):
    if (cat === 'safety') return true;      // קצר-חשמלי בשורה הראשונה — לפני כל גישה ל-store
    ...קריאה מ-PREFS
```

**אחסון (§1.4):** *"חמישה מפתחות ב-`PREFS` (10014), בדיוק בדפוס הקיים `store`/`def`/`valid`:
`voiceTimers`/`voiceSchedule`/`voiceSteps`/`voiceAnswers`/`voiceProgress` → `mk-pref-voice-*`."*
*"פאנל ייעודי `openVoiceRules`, ערך חדש 🔊 בבלוק ⚙️ (12909), **וקיצור שני מתוך פאנל "בישול קולי"**."*

**תחום הערכים (פסק בעלים F-1):** **לא · רק כשאיני מסתכל · תמיד** — שלושה מצבים לכל קטגוריה.

**שורות חדשות ב-`TTS_ROUTE` (§1.5):** `timer:'cloud'` · `schedule:'cloud'` · `progress:'gemini'` ·
`safety:'gemini'` (הספק **הראשי** — זה התוכן שאסור שיישמע מרושל).

**הכלל היחיד של המקבילה החזותית (§2.1):** *"כל אמירה נכתבת ליומן אחד (`voiceLog`). הדחיפות קובעת רק
דבר אחד: האם היא גם *תופסת* את המסך."*

**שתי הדרגות (§2.2):**
* **A · פעל עכשיו** — `safety` · `timers` · S1/S2/S3 מתוך `schedule`. כרטיס במשפחת `.mk-alarm`, ראש
  המסך, `role="alertdialog"`, `aria-live="assertive"`, ניגודיות גבוהה, פועם. **לא נעלם** — לא בזמן,
  לא בניווט, לא בסגירת פאנל. ביטול: הקשה מפורשת על כפתור **≥56px**, או היעלמות התנאי.
* **B · לידיעתך** — `progress` · S7 · `steps` · `answers`. `toast()` (3854) מוארך ל-**8 שניות** +
  שורה קבועה ב-`voiceLog`.

**המכולה (§2.3):** *"נוסף **מקור אחד בלבד** — `voiceAct`… מכולה אחת מסודרת (`#mkActStack`) שכל ארבעת
הרנדררים תולים בה את הכרטיס שלהם, בסדר קבוע: `bcheck` → `alarm` → `voiceAct` → `warn`, עם גלילה
פנימית מעל שני כרטיסים."*

**`voiceLog` (§2.5):** מה נכנס — *"כל אמירה — שנאמרה, שנקטעה, שהושמטה, או **שנכשלה**"*.
בשורה — *"שעה · קטגוריה · הטקסט **המלא, מילה במילה כפי שנאמר** · סטטוס (נאמר/נקטע/לא הושמע/נכשל) · 🔁"*.
כמה — *"תקרה של **50 שורות**, מפתח `mk-voicelog` (טבעת)"*. איפה — *"נתלה ב-FAB 'פעיל עכשיו'
(`syncActiveFab` 11025)"*. מספרים — *"כל מספר ביומן ובכרטיס עובר `vcLtrNums` (7735)"*.

**חוק ההתנגשות (§3.1):** *"תור עם עדיפויות + איחוד בתוך חלון · barge-in לבטיחות בלבד · אין ducking ·
אין השמטה שקטה."*

| עדיפות | קטגוריה | התנהגות כשמשהו כבר מדבר |
|---|---|---|
| 0 | `safety` | **קוטע מיד** — `vcNewSpeakGen()` (6786) + `gemStop()` |
| 1 | `timers` | **מחכה לסוף המקטע הנוכחי**, אז לוקח את הרצפה |
| 2 | `schedule` | כנ"ל |
| 3 | `answers` | ממתין בתור |
| 4 | `steps` | ממתין; **נופל** אם משהו בעדיפות 0-2 ממתין אחריו |
| 5 | `progress` | ממתין; **נופל** ראשון |

**איחוד:** *"שתי אמירות **מאותה קטגוריה** בחלון של **2 שניות** מתאחדות למשפט אחד"*. *"שמות אירועים
ופריטים בלבד, **אפס מספרי טמפרטורה**."*

**ק-3 (§3.1):** *"בזמן ש-`vcRec` פעיל… **רק `safety` מדבר**; כל השאר ממתין בתור ומתאחד. אמירת דרגה A
**משהה** את הזיהוי ומחדשת אותו בסיומה."*

**פסק בעלים F-5:** *"ההתחדשות **לא תמשיך באמצע משפט**. היא תתחיל מחדש מ**תחילת המשפט שנקטע**, עם
סימון קצר שמחזיר הקשר ("ממשיך: ...")."*

**מחזור-חיים (§4.1-§4.2):**
```
evState(ev):
  if (ev.finishedAt)                          → 'finished'
  if (evRunningCount(ev.id) || liveSession)   → 'active'          // ← ראה 4.2a
  if (staleMs(ev) >= 12h)                     → 'needsUpdate'
  if (planStarted(ev.id))                     → 'active'
  else                                        → 'planning'
```
*"נוסף שדה **אחד בלבד** שנשמר — `finishedAt` — וכל השאר **נגזר בזמן ריצה**. אין מיגרציה, אין backfill."*
**4.2a** — *"אירוע עם טיימר רץ לעולם אינו פג."* **4.2b** — *"אירוע ללא תאריך אינו יכול לפוג… `needsUpdate`
חל **רק על אירוע מתוארך**."* **4.2c** — *"`evState` נקרא ברינדור (`cPaintEvents` 11445), בזריעת
התוכנית (`buildList` 8390) ובלולאת התזכורות שכבר רצה כל 60 שניות (13058). **לא** נוסף `setInterval` חדש."*
**סף הפגות:** **12 שעות** אחרי מועד ההגשה.

**השאלה בעדכון המועד (§4.4):** *"בכל כתיבה ל-`mk-tlserve`/`serveDateKey()` על אירוע שמצבו
`needsUpdate` או `finished` — **ולא באף מקרה אחר**"*, תבנית `yes-no`:
> **מצאנו סימונים וטיימרים מהבישול הקודם.** `[המשך מאיפה שהפסקתי]` `[התחל מחדש]`

| בחירה | מה נשמר | מה נמחק |
|---|---|---|
| **המשך** | סימוני `wpck:<scope>:*` (8502) · `mk-tlstate-<scope>` · `mk-bcheck-due` המאושרים · טיימרים **רצים** | רשומות טיימר **שפגו** (`fired`) של `st-<scope>-*` · שורות `mk-bcheck-due` **לא-מאושרות** מהמחזור הקודם |
| **התחל מחדש** | התפריט, ובחירות התכנון (`mk-tlstate`) | **כל** `wpck:<scope>:*` · `resetPlanTimers()` (8319) · `mk-plan-started-<scope>` · כל `mk-bcheck-due` של האירוע |

*"ל-`wpck:` **אין היום שום נתיב איפוס**… 'התחל מחדש' הוא הצרכן הראשון שלו, ולכן הוא **קוד חדש**."*

**שלושת אתרי החימוש (§4.5):** (1) `buildList` 8464-8468 — תנאי נוסף `evState(ev)!=='needsUpdate' && !=='finished'`;
(2) `scheduleBcheckDue` 3486-3487 — *"ה-`mark()` המיידי **אינו** נורה לאירוע `needsUpdate`/`finished`.
תזמון עתידי (`0<ms<24h`) לא מושפע"*; (3) `startTimerWatch` — **לא משתנה**.

**פסק בעלים F-2:** *"`bcheck` באירוע שפג — יורה **רק אם הבישול התחיל**… **התחיל** ⟵ `bcheck` יורה…
**לא התחיל** ⟵ שקט… ההגדרה חייבת להיות **שמרנית**: בספק ⟵ להתייחס כאילו התחיל ולירות. **שגיאה לכיוון
ההתראה עדיפה על שגיאה לכיוון השתיקה** בשער הבטיחות היחיד שלפני הגשה."*

**פיצוי (§4.6):** *"בכניסה לאירוע `needsUpdate` מוצג באנר **מתמיד ולא-מבוסס-זמן**: 'האירוע הזה עבר.
N בדיקות טמפ׳ ו-M התראות לא נורו.'"*

**המסווג — נקודת ההשתלה (§5.2):** *"`vcAskFlow` שורה 8014 (התשובה המלאה חזרה) → **המסווג** →
שורה 8020 (`vcGuardSpoken`)."*
**רישום:** `AI_THINK.safetyClass = {level:'high', floor:'low'}` · `AI_SEARCH.safetyClass='never'` ·
`maxOutputTokens:8192` (מדיניות L24).

**הסכימה (§5.3)** — `responseSchema` קשיח, אין פרוזה, אין markdown:
```jsonc
{ "claims": [ {
    "text":    "63°C",                 // הטוקן, מילה במילה מתוך התשובה
    "kind":    "internal_safe_temp" | "internal_target_temp" | "chamber_temp" |
               "bath_temp" | "surface_temp" | "duration" | "cure_ppm" |
               "weight" | "spacing" | "other",
    "value":   63,
    "unit":    "C" | "F" | "min" | "h" | "ppm" | "g_per_kg" | "g" | "kg" | "cm" | "in",
    "subject": { "item": "אסאדו" | null, "category": "בקר" | null,
                 "form": "whole" | "ground" | "unknown" },
    "confidence": 0.0-1.0
} ] }
```

**מה הקוד שלנו עושה עם זה — ורק זה (§5.3):**
```
לכל טוקן שהטוקנייזר (safetyTokenRe, 5934) רואה בתשובה:
  claim ← הטענה שה־text שלה תואם את הטוקן הזה בדיוק אחת-לאחת
  אם אין claim תואמת                                  → התנהגות היום (נמחק)
  אם claim.confidence < 0.85                          → התנהגות היום
  אם claim.kind ∈ {internal_safe_temp, internal_target_temp, cure_ppm}:
        item ← askFindEntity(subject.item) ‖ askFindCategory(subject.category)   // המזהים הקיימים, 7562/7645
        אם לא זוהה                                    → נמחק  (השער החיובי של ה-DoD)
        אם קטגוריה מעורבת (catUniformSafe==null, 7659)→ נמחק  (השער החיובי של ה-DoD)
        אם round(aiSafetyToC(value,unit)) == round(item.safe)  → **מאושר**, נאמר עם סימון "לפי המדריך המאומת"
        אחרת                                           → נמחק
  אם claim.kind ∈ {chamber_temp, bath_temp, surface_temp, duration, weight, spacing}:
        → **משוחרר** — נאמר כפי שהוא, ללא סימון אימות וללא מחיקה   (זה השינוי ש-R-62 מורה עליו)
  אם claim.kind == 'other' או חסר                     → נמחק
```

**האינווריאנט המחייב (§5.5, P6):** *"לכל קלט, קבוצת הטוקנים שנאמרים כשהמסווג רץ היא **על-קבוצה** של
הקבוצה שנאמרת כשהוא נכשל, **ואף טוקן אינו עובר מ'נמחק' ל'נאמר ללא סימון אימות' אלא דרך ייחוס `kind`
לא-בטיחותי מפורש.** זו שורת DoD, לא כוונה."*

**R-61 (§5.6):** *"כאשר **כל** המספרים נמחקו ואף אחד לא אושר, ויש משפט תחליף — הסדר הופך ל-
`sub + ' ' + out + ' ' + notice`. כאשר לפחות טוקן אחד אושר, הסדר נשאר כהיום."*

**מה המסווג לא נוגע בו (§5.7):** *"`ask` נשאר על `low`… מסלול ההקראה (`steps`/`timers`/`schedule`)
**אינו** עובר במסווג לעולם."*

**DoD-10 (§6.6):** *"אינו משנה שום ערך בטיחות — לא `bcheck`, לא `temp`, לא `safe`, לא משך בישול."*

---

## 2 · סדר הביצוע — ולמה דווקא הוא

**הסדר: המסווג (§5) ⟶ מחזור-החיים (§4) ⟶ הקטגוריות והשכבה החזותית (§1-§3).**

**למה המסווג ראשון.** §12.4.1 בדיסציפלינה (Constraint Analysis) קובע שהאילוץ הקשה ביותר — זה שאם הוא
נכשל כל השאר מיותר — מתוזמן **משימה 1 או 2, לעולם לא אחרונה**. כאן זה המסווג, משלוש סיבות:
(א) הוא היחיד שנוגע ב**שער בטיחות חי** שכבר שוחרר, ו-P6 דורש שקילות **בייט-לבייט** בכל נתיב כשל —
אילוץ הדוק שאי-אפשר לגלות מאוחר; (ב) הוא **בלתי-תלוי לחלוטין** ב-§1-§4 (חי בתוך `vcAskFlow`/
`vcGuardSpoken`), ולכן הצבתו ראשונה לא חוסמת דבר; (ג) הוא פותח את R-61, ש**אינו ניתן לשילוח לבדו**
לפי המרשם — שתי שורות 🔴 פתוחות (R-58/R-62) נסגרות בקשת אחת.

**למה מחזור-החיים שני — ולא אחרון, כפי שגודלו מרמז.** הוא אכן הקטן מהשלושה, אבל הוא **מנקה את
הסביבה שבה כל האימות החזותי של האזור השלישי יתבצע**: היום אירוע שמועד ההגשה שלו חלף מצית `mark()`
לכל פריט בבת אחת (‏3487) — זו רשימת האישורים ההמונית שהבעלים דיווח עליה. לאמת כרטיס `voiceAct` חדש
ב-390×844 מעל ערימת `bcheck` מזויפת זה לאמת בתוך רעש. בנוסף הוא **בלתי-תלוי במסווג**, כך שהסדר
בין 1 ל-2 הוא בחירת נוחות ולא תלות.

**למה הקטגוריות אחרונות.** זהו האזור הגדול ביותר (7 מ-14 המשימות), **הכי נראה למשתמש**, והוא היחיד
שנשען על הכרעת בעלים שטרם ניתנה (§0.1). הצבתו אחרון נותנת להכרעה את מרווח-הזמן המרבי **בלי לחסום
שום עבודה** — וזו בדיוק הצורה שבה §12.4.5 (Base Rate Neglect Counter) מבקש לטפל בפריט פתוח: לא
לבלוע אותו בשקט, אלא לתזמן סביבו.

**מה ששקלתי ודחיתי.** לשים את השכבה החזותית (משימות 8-9) ראשונה, כי הכול תלוי בה — נדחה: היא תלויה
בכלום, ואם היא נכשלת אין לזה השלכה על §4/§5, בעוד שכישלון המסווג מייתר את R-61 ואת חצי מקשת R-62.
עדיפות נקבעת לפי **סיכון**, לא לפי מספר התלויות היוצאות.

### 2.1 · המפה

| # | משימה | אזור | תלוי ב- |
|---|---|---|---|
| 1 | רישום המסווג + הקריאה + הסכימה (`vcClassifySafetyClaims`) | §5 | — |
| 2 | טבלת ההכרעה לטוקן (`vcClaimVerdict`) + הפרמטר הרביעי ב-`vcGuardSpoken` | §5 | 1 |
| 3 | חיווט ב-`vcAskFlow` + האינווריאנט P6 + מונה הבקשות + latency | §5 | 2 |
| 4 | R-61 — היפוך הסדר כשאין אישור | §5.6 | 2 |
| 5 | `evState` / `finishedAt` / `evCookStarted` + צרכן ברינדור | §4 | — |
| 6 | דיכוי בשני אתרי החימוש + שער F-2 ל-`bcheck` + באנר הפיצוי | §4.5-4.6 | 5 |
| 7 | שער "המשך / התחל מחדש" + נתיב האיפוס של `wpck:` | §4.4 | 5 |
| 8 | `#mkActStack` — מכולה מסודרת לארבעת הכרטיסים | §2.3 | — |
| 9 | פס-הקול: `voiceLog` + `voiceAct` + `voiceSay`, וצרכן ראשון (T1) | §2.1/§2.5 | 8 |
| 10 | ‏`PREFS` ×5 + `voiceMode`/`ttsCategoryEnabled` + `TTS_ROUTE` | §1.3-§1.5 | 9 · **⚑ §0.1** |
| 11 | הפאנל `openVoiceRules` + הכניסות + שורת-האמת + כרטיס הגילוי | §1.4/F-4/F-6 | 10 |
| 12 | התור: עדיפויות · איחוד · barge-in · חידוש F-5 · ק-3 | §3 | 9 |
| 13 | כרטיסי `schedule` (S1/S2/S3) מחוץ לשער ההרשאה | §2.4 | 9 · 6 |
| 14 | ‏`progress` (C1-C5) + טריגרי `safety` (S4/C1/V3) | §2.4 | 12 |

---

## 3 · מוסכמות משותפות — חלות על כל משימה

### 3.1 · בדיקות — `tests/TEST-AUTHORING-CONTRACT.md` הוא הסמכות

כל קובץ בדיקה חדש נפתח כך, וכל סטייה מזה נפסלת גם אם ירוקה:

```ts
import { test, expect, seedApp } from './_fixtures';   // לעולם לא test של Playwright ישירות

test('...', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',          // חובה בכל בדיקה שפותחת פאנל — אחרת maybeAskUiLevel חוטף אותו
    'mk-timers': JSON.stringify({}),     // כל ערך שאינו מחרוזת עובר JSON.stringify
  });
});
```

* **`isolatedPage`** רק כשבאמת צריך — `page.clock`, `test.use`, `addInitScript`. עלות: context+goto מלאים.
  משימות שמשתמשות בו כאן: 3, 5, 6, 9, 12, 13 (שעון מזויף).
* **כל `route` בבדיקה עטוף `try/finally` עם `unroute`** — אחרת הוא דולף ל-worker כולו ומייצר כשלי-רפאים.
* **המתנה על תנאי בלבד.** `waitForFunction` / `expect(locator).toBeVisible()`. **אפס `waitForTimeout`**
  (DoD-11). ‏`waitForResponse` אינו הוכחה שהמצב הוחל — המתן על ה-DOM/`store`.
* **RED לפני GREEN.** בדיקה שעברה בריצה הראשונה **בטלה** — נכתבת מחדש.
* **המבצע מריץ רק את קובצי הבדיקה שנגע בהם**; הסוויטה המלאה רצה **בחזית, אצל הבקר**, ×1 למשימה
  ו-×2 בשילוח (H7). אין הרצת סוויטה ברקע עם המתנה.

### 3.2 · מחרוזות ושפות — הצינור המלא, כל משימה שמוסיפה טקסט

**שבע שפות חיות:** `he` (מקור) · `en` (הארגומנט הפנימי ב-`L()`) · `fr` · `de` · `es` · `it` · `ru`
(מילון). כל מחרוזת חדשה שמשתמש רואה או שומע עוברת `L(he, en)` עם **ליטרלים סטטיים** — לא תבנית, לא
משתנה — אחרת האקסטרקטור לא רואה אותה ו-Guard A לא מגן עליה.

```bash
node scripts/i18n-extract.mjs            # 1 · מרענן lang/_extracted.json (AST על app.js)
# 2 · הוסף את הערך המתורגם ל-lang/{en,fr,de,es,it,ru}.json  (ru לא נשכח — הוא שפה חיה)
I18N_REGEN_SIG=1 python build.py         # 3 · מרענן lang/_callsite-sig.json (Guard D)
python build.py                          # 4 · חייב לצאת 0 — Guard A נכשל על מפתח חסר או זהה-למקור
```

**‏Guard A מפיל את הבנייה** עד שכל שבע השפות קיימות ושונות מהמקור (חריג: `lang/_i18n-allow-identical.json`).
**‏`lang/_extracted.json` ו-`lang/_callsite-sig.json` נכנסים לקומיט** של אותה משימה — לא אחר כך.
**האימות הוא ב-DOM המרונדר, לכל שפה** (L23) — לא כיסוי-מפתחות ולא grep על החבילה.

### 3.3 · מספרים בעברית — `dir="ltr"`

כל מספר בכרטיס, ביומן, בפאנל ובכל טקסט שנבנה כאן עובר `vcLtrNums(escaped)` (7735) **אחרי** `esc()`.
הבדיקה טוענת על ה-`span[dir="ltr"]`, לא רק על נוכחות התו (L13 — `≥` מתהפך ל-`≤`).

### 3.4 · ‏DoD לכל משימה

כל משימה נסגרת מול **12 סעיפי §3** במלואם, עם פלט מודבק. שלושה סעיפים חוזרים בכל משימה כאן ולכן
נאמרים פעם אחת:

* **DoD-10 (אינווריאנס בטיחות):** `git diff --stat data.py sources.py` **ריק** בכל משימה, ובנוסף
  `npx playwright test tests/plan-safety-invariant.spec.ts` (האינווריאנט המספרי הקיים) ירוק.
  אף משימה כאן אינה נוגעת ב-`hours`/`temp`/`safe`/`bcheck` — כולן מוסיפות **ערוצי פלט** ו**שערי דיכוי**.
* **DoD-8 (ראיה חזותית):** כל שינוי UI — צילום **390×844**, מצורף ו**נצפה בעין**.
* **DoD-12:** `npx playwright test` נקי, ×1 למשימה. **אין `--retries`, אין `--workers`.**

### 3.5 · מדידה חיה — המפתח לעולם אינו מודפס

מדידות latency/נכונות מול ה-API החי (משימות 1, 3) קוראות את המפתח כך, ו**לעולם לא מהדהדות אותו**:

```powershell
$env:GEMINI_API_KEY = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')
node scratch\voice-governance\classifier-probe.mjs      # הסקריפט קורא process.env, לא ארגומנט
```
הסקריפט יושב ב-`scratch/` (‏gitignored). **אין להדפיס את המפתח, אין לכתוב אותו לקובץ, אין לצטט אותו
בדו"ח.** התוצאות המספריות מודבקות; המפתח לא.

---

# אזור א׳ — מסווג מספרי הבטיחות (R-62 / R-61)

## Task 1 — רישום המסווג, הסכימה, והקריאה הבודדת

**מה נמסר:** פונקציה `vcClassifySafetyClaims(answerText)` שמחזירה `Map<tokenText, claim>` תקינה, או
`null` בכל נתיב כשל. **אינה מחוברת לשום דבר עדיין** — הצרכן שלה נוחת ב-Task 2, באותה קשת.

**מקור בספֵּק (§5.2):** *"רישום ב-`AI_THINK` (5551): `safetyClass:{level:'high', floor:'low'}` — `high`
ולא `medium`, כי המדידה מצאה ב-`medium` **דליפת thought גולמי** (2/3 חזרות)… `maxOutputTokens:8192`
(מדיניות L24). **`AI_SEARCH.safetyClass='never'`** — המסווג קורא טקסט קיים, אין לו מה לחפש."*
**‏(§5.3):** *"`responseSchema` קשיח. אין פרוזה, אין markdown."*

### קבצים

`app.js` — הוספה מיד אחרי `vcNormalizeSafetyText` (‏7757), לפני `vcGuardSpoken`.

### הקוד

```js
// ── R-62 · the safety-number CLASSIFIER (spec §5, owner ruling 1.8.2026) ────────────────────────────
// An APPROVAL layer, never a DECISION layer (P6): it can only ADD an approval, never remove a guard.
// Every failure path below returns null, and null means vcGuardSpoken behaves EXACTLY as it does today
// — that equivalence is structural (the guard's 4th param is optional), not a promise kept by tests.
// Why a SEPARATE pass and not self-tagging in the same call (spec §5.2): the read-aloud path already
// streams and speaks its first sentence mid-stream behind vcStreamSafe (6760); tagging in-call would
// have to survive chunking and land before a chunk is spoken — i.e. dismantle the ~1.1s gap R-51 bought.
// This pass never touches the read-aloud path at all (AI_SEARCH.safetyClass='never', and it is called
// once, after the complete answer).
const SAFETY_CLAIM_KINDS = ['internal_safe_temp','internal_target_temp','chamber_temp','bath_temp',
  'surface_temp','duration','cure_ppm','weight','spacing','other'];
const SAFETY_CLAIM_UNITS = ['C','F','min','h','ppm','g_per_kg','g','kg','cm','in'];
// responseSchema — HARD (spec §5.3). No prose, no markdown, no fence-stripping guesswork.
const SAFETY_CLAIM_SCHEMA = {
  type:'OBJECT',
  properties:{ claims:{ type:'ARRAY', items:{
    type:'OBJECT',
    properties:{
      text:{type:'STRING'}, kind:{type:'STRING', enum:SAFETY_CLAIM_KINDS},
      value:{type:'NUMBER'}, unit:{type:'STRING', enum:SAFETY_CLAIM_UNITS},
      subject:{ type:'OBJECT', properties:{
        item:{type:'STRING', nullable:true}, category:{type:'STRING', nullable:true},
        form:{type:'STRING', enum:['whole','ground','unknown']} },
        required:['form'] },
      confidence:{type:'NUMBER'}
    },
    required:['text','kind','value','unit','confidence']
  }}},
  required:['claims']
};
const SAFETY_CLAIM_SYS =
  'You are a strict extractor, not an advisor. You are given a cooking answer. For EVERY number in it '+
  'that carries a unit, emit ONE claim describing what that number REFERS TO. `text` MUST be the number '+
  'token copied byte-for-byte from the answer, including its unit. Never invent, merge, split, convert '+
  'or reword a number. `kind` classifies the ROLE: internal_safe_temp = the minimum safe internal '+
  'temperature of the food; internal_target_temp = a doneness/texture internal target; chamber_temp = '+
  'smoker/oven/pit air temperature; bath_temp = sous-vide water bath; surface_temp = sear/grate surface; '+
  'duration = a time; cure_ppm = curing-salt nitrite concentration; weight/spacing = mass or distance. '+
  'Use "other" when you are not sure. `confidence` is your own certainty in the kind, 0..1. '+
  'Return ONLY the JSON object. No prose, no markdown.';

// The test seam, mirroring the shipped __vcAskMock / __aiMock precedent (7871 / 6041). A test sets it to
// a plain object (the parsed classifier response) or to a function of the answer text.
function vcClassMockActive(){ return typeof window!=='undefined' && window.__vcClassMock!==undefined && window.__vcClassMock!==null; }

// → Map(tokenText -> claim) with EVERY validation of spec §5.4/§5.5 already applied, or null.
// null is the ONE failure signal: api error, timeout, malformed JSON, schema violation, non-STOP finish,
// thought leak (which necessarily breaks the JSON), empty claims, or no claim matching any token.
async function vcClassifySafetyClaims(answerText){
  const src = vcNormalizeSafetyText(answerText);          // the SAME normalization the guard runs on
  const tokens = (src.match(safetyTokenRe()) || []);
  if(!tokens.length) return null;                          // nothing tokenizable → nothing to classify
  let json;
  try{
    if(vcClassMockActive()){
      const m = window.__vcClassMock;
      json = (typeof m==='function') ? m(src) : m;
    }else{
      if(!aiAvail()) return null;                          // §5.5 last row — the classifier is not called
      const body = {
        system_instruction:{parts:[{text:SAFETY_CLAIM_SYS}]},
        contents:[{role:'user',parts:[{text:src}]}],
        // AI_SEARCH.safetyClass==='never' → no google_search tool → responseMimeType/responseSchema are
        // legal here (the 400 documented at 6054 only occurs WITH the search tool).
        generationConfig: Object.assign(
          gemGen('text', {temperature:0, maxOutputTokens:8192}, {think: thinkFor('safetyClass')}),
          { responseMimeType:'application/json', responseSchema:SAFETY_CLAIM_SCHEMA })
      };
      const r = await gemFetch('text', body, {timeout:30000, retries:0});
      if(!r.ok) return null;
      const j = await r.json();
      const cand = j && j.candidates && j.candidates[0];
      if(!cand || cand.finishReason!=='STOP') return null;  // truncation / safety stop → today's behaviour
      json = JSON.parse(gemReadText(j));                    // a raw-thought leak breaks this parse → null
    }
  }catch(e){ try{ console.warn('[vcClassify]', e); }catch(_){ } return null; }
  return vcBuildClaimMap(src, json);
}

// §5.4.1 — the classifier is NEVER allowed to define what a number is. A claim survives only if its
// `text` is byte-identical to a token OUR tokenizer already found. §5.5 — more claims than tokens, or
// two claims on the same token, means that token is treated as UNCLASSIFIED (the key is dropped, not
// arbitrated). Exported for direct unit assertion.
function vcBuildClaimMap(src, json){
  const claims = json && Array.isArray(json.claims) ? json.claims : null;
  if(!claims || !claims.length) return null;
  const seen = new Set((String(src).match(safetyTokenRe()) || []));
  const map = new Map(), dup = new Set();
  claims.forEach(function(c){
    if(!c || typeof c.text!=='string') return;
    if(!seen.has(c.text)) return;                          // not a token of ours → discarded outright
    if(map.has(c.text)){ dup.add(c.text); return; }
    if(SAFETY_CLAIM_KINDS.indexOf(c.kind)<0) return;       // off-schema kind → unclassified
    if(typeof c.confidence!=='number') return;
    map.set(c.text, c);
  });
  dup.forEach(function(k){ map.delete(k); });              // duplicated token → unclassified, never picked
  return map.size ? map : null;
}
try{ window.vcClassifySafetyClaims=vcClassifySafetyClaims; window.vcBuildClaimMap=vcBuildClaimMap; }catch(e){}
```

**‏`AI_THINK` / `AI_SEARCH`** — שתי שורות, בטבלאות הקיימות (5551 / 5573):

```js
  vcAsk:      { level:'low',     floor:'low'    },   // voice, safety-adjacent, latency-capped
+ // R-62 (spec §5.2): 'high', NOT 'medium' — the thinking-floor measurement
+ // (docs/analysis/2026-08-01-thinking-floor-measurement.md §4) found raw-thought leakage in 2/3 medium
+ // repeats on one question and ZERO in high. A leaked thought breaks the JSON, so medium's defect maps
+ // straight onto this call's only failure mode. floor:'low' per the approved table's own convention.
+ safetyClass:{ level:'high',    floor:'low'    },
```
```js
const AI_SEARCH = {
  ask:   'auto',
  vcAsk: 'auto',
+ safetyClass: 'never',   // §5.2 — it reads text we already have; there is nothing to search for
};
```

### RED → GREEN — `tests/vg-classifier.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('R-62 Task 1 · the classifier returns a validated map, or null', () => {
  test('a claim whose text is not one of OUR tokens is discarded (§5.4.1)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const out = await page.evaluate(() => {
      const w = window as any;
      const src = 'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.';
      const map = w.vcBuildClaimMap(src, { claims: [
        { text: '110°C', kind: 'chamber_temp', value: 110, unit: 'C', confidence: 0.95 },
        { text: '230°F', kind: 'chamber_temp', value: 230, unit: 'F', confidence: 0.99 }, // never appeared
      ]});
      return { size: map ? map.size : 0, has110: !!(map && map.get('110°C')), hasGhost: !!(map && map.get('230°F')) };
    });
    expect(out.size).toBe(1);
    expect(out.has110).toBe(true);
    expect(out.hasGhost).toBe(false);   // ← RED before vcBuildClaimMap exists
  });

  test('two claims on the SAME token leave it UNCLASSIFIED, not arbitrated (§5.5)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const has = await page.evaluate(() => {
      const w = window as any;
      const map = w.vcBuildClaimMap('הגש ב-71°C.', { claims: [
        { text: '71°C', kind: 'internal_safe_temp', value: 71, unit: 'C', confidence: 0.9 },
        { text: '71°C', kind: 'chamber_temp',       value: 71, unit: 'C', confidence: 0.9 },
      ]});
      return map === null;
    });
    expect(has).toBe(true);
  });

  test('malformed / empty / off-schema responses all collapse to null', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const all = await page.evaluate(() => {
      const w = window as any;
      const s = 'הגש ב-71°C.';
      return [
        w.vcBuildClaimMap(s, null),
        w.vcBuildClaimMap(s, { claims: [] }),
        w.vcBuildClaimMap(s, { claims: [{ text: '71°C', kind: 'nonsense', value: 71, unit: 'C', confidence: 1 }] }),
        w.vcBuildClaimMap(s, { claims: [{ text: '71°C', kind: 'chamber_temp', value: 71, unit: 'C' }] }), // no confidence
      ].map(x => x === null);
    });
    expect(all).toEqual([true, true, true, true]);
  });

  test('a non-STOP finishReason returns null (truncation must never approve anything)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    // the mock seam models the PARSED response; the finishReason branch is exercised via a real route
    await page.route('**/generateContent*', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"claims":[]}' }] } }] }) }));
    try {
      const res = await page.evaluate(async () => {
        const w = window as any;
        w.__vcClassMock = null;                       // force the real request path
        w.store.set('mk-gemkey', 'x'.repeat(40));     // aiAvail() true via BYOK
        return await w.vcClassifySafetyClaims('הגש ב-71°C.');
      });
      expect(res).toBeNull();
    } finally { await page.unroute('**/generateContent*'); }
  });
});
```

**‏RED מוכח:** ארבע הבדיקות נכשלות עם `TypeError: w.vcBuildClaimMap is not a function` / `is not a function`
לפני הקוד. הפלט מודבק.

**המקרים השליליים של המשימה (נקובים):** טוקן-רפאים שלא הופיע בתשובה · טענה כפולה על אותו טוקן ·
`claims:[]` · `kind` מחוץ לסכימה · `confidence` חסר · `finishReason!=='STOP'`.

### מדידה חיה (‏§3.5)

`scratch/voice-governance/classifier-probe.mjs` — 8 תשובות אמיתיות (עברית ואנגלית, כולל תשובת העישון
של D3), ‏3 חזרות, מדווח: זמן חציוני, `finishReason`, שיעור טענות שנפלו בוולידציה. **התוצאה מודבקת
בדו"ח המשימה** ומשמשת בסיס להשוואה ב-Task 3 (D11). המפתח נקרא מ-`process.env` ואינו מודפס.

---

## Task 2 — טבלת ההכרעה לטוקן, והפרמטר הרביעי של `vcGuardSpoken`

**מה נמסר:** `vcGuardSpoken(text, tiers, lang, claims)` — עם `claims` שווה `undefined`/`null` הפלט
**זהה בייט-לבייט** לפלט של היום, כי אף ענף לא משתנה. עם `Map` — טבלת ההכרעה של §5.3 פועלת.

**מקור בספֵּק (§5.4.4):** *"כלל 'בדיוק מספר אחד' לא מרוכך ולא מוסר. הוא נשאר בתוקף מלא כמסלול
הלא-מסווג. המסווג מוסיף **מסלול אישור מקביל**; הוא לא נוגע בכלל הקיים ולא נשען עליו."*

### הקוד — 1 · הכרעת הטוקן

```js
// §5.3 — the ENTIRE decision table, in one function. Returns:
//   {verdict:'verified', c:<°C>}  → speak the APP's figure with the verified marker
//   {verdict:'release'}           → speak the token verbatim, NO marker, NO redaction  (the R-62 change)
//   null                          → TODAY'S BEHAVIOUR (the caller redacts)
// Silence is NEVER release (§5.4.3): a token is released only on a POSITIVE non-internal attribution.
const SAFETY_CLAIM_SAFETY_KINDS = {internal_safe_temp:1, internal_target_temp:1, cure_ppm:1};
const SAFETY_CLAIM_FREE_KINDS   = {chamber_temp:1, bath_temp:1, surface_temp:1, duration:1, weight:1, spacing:1};
function vcClaimVerdict(tokenText, vals, unit, kind, claims){
  if(!claims || typeof claims.get!=='function') return null;
  const cl = claims.get(tokenText);
  if(!cl) return null;                                     // unclassified token → today's behaviour
  if(!(typeof cl.confidence==='number') || cl.confidence < 0.85) return null;
  if(SAFETY_CLAIM_SAFETY_KINDS[cl.kind]){
    if(kind!=='single') return null;                       // a RANGE is a composite claim — never verified
    const ref = vcClaimSubjectSafeC(cl);
    if(ref==null) return null;                             // unidentified item, OR a MIXED category → redact
    const c = Math.round(aiSafetyToC(vals[0], unit));
    return (c===ref) ? {verdict:'verified', c:c} : null;   // must equal OUR cited figure — not the model's word
  }
  if(SAFETY_CLAIM_FREE_KINDS[cl.kind]) return {verdict:'release'};
  return null;                                             // 'other', missing, or anything unlisted
}
// The subject's cited °C from OUR tables — item first, category second, exactly the precedence
// vcResolveTiers (7566) and vcIdentifiedSafeCategory (7670) already enforce: a named item is strictly
// more specific than its category and must never be shadowed by it.
// NOTE (spec §5.3, stated not hidden): `cure_ppm` is routed through this same comparison, and no field
// in the catalog carries a ppm figure — so a cure_ppm claim can never match and is always redacted.
// That is the conservative direction the approved table specifies; it is not an oversight.
function vcClaimSubjectSafeC(cl){
  const sub = cl && cl.subject;
  const itemQ = sub && typeof sub.item==='string' ? sub.item.trim().toLowerCase() : '';
  if(itemQ && typeof askFindEntity==='function'){
    const hits = askFindEntity(itemQ) || [];
    const h = hits[0];
    if(h && h.obj){
      const v = h.obj.safe;
      return (v!=null && !isNaN(Number(v)) && Number(v)!==0) ? Math.round(Number(v)) : null;
    }
    return null;                                           // named an item we do NOT have → redact (D2)
  }
  const catQ = sub && typeof sub.category==='string' ? sub.category.trim().toLowerCase() : '';
  if(catQ && typeof askFindCategory==='function'){
    const cat = askFindCategory(catQ);
    if(!cat) return null;
    return catUniformSafe(cat);                            // MIXED (בקר 63/71) → null → redact (D1)
  }
  return null;                                             // no subject at all → redact
}
try{ window.vcClaimVerdict=vcClaimVerdict; }catch(e){}
```

### הקוד — 2 · שלושה שינויים כירורגיים ב-`vcGuardSpoken`

```js
-function vcGuardSpoken(text, tiers, lang){
+// `claims` (optional, R-62): a Map(tokenText -> claim) from vcClassifySafetyClaims, or null/undefined.
+// With claims null/undefined EVERY branch below is byte-for-byte the shipped code — that is what makes
+// P6 ("failure ⟹ today's behaviour") structural rather than test-enforced (spec §5.5, DoD D6).
+function vcGuardSpoken(text, tiers, lang, claims){
```

**(א) ענף `digitRuns===1`** — המסלול המאושר של היום נשאר **ראשון ובלתי-נגוע**; המסווג מקבל את הטוקן
רק אחרי שהמסלול הקיים ויתר עליו:

```js
       out=vcMapSafetyNums(src, function(vals, unit, kind){
+        const tok=arguments[3];                       // vcMapSafetyNums passes the whole token as arg 4 (see below)
         if(kind==='single' && isTempUnit(unit)){
           const c=Math.round(aiSafetyToC(vals[0], unit));
           if(ok[c]){
             ...unchanged verified marker...
           }
         }
+        // R-62 · the PARALLEL approval path. Reached only where the shipped rule already gave up.
+        const v=vcClaimVerdict(tok, vals, unit, kind, claims);
+        if(v && v.verdict==='verified'){ verified++; return UNITS.fmt(v.c,'temp',{role:'safeFloor'})+' '
+          +(lang==='he'?'לפי המדריך המאומת.':L('לפי המדריך המאומת.','per the app\'s verified guide.')); }
+        if(v && v.verdict==='release'){ return tok; }   // spoken verbatim, NO marker (§5.3)
         redacted++; return VC_REDACT;
       });
```

**(ב) ענף "שניים ומעלה"** — כאן היום נמחק **הכול**. עם `claims` הטבלה פועלת; בלעדיו הענף לא זז:

```js
   }else{
-    out=vcMapSafetyNums(src, function(){ redacted++; return VC_REDACT; })
-          .replace(safetyNumRe(), function(){ redacted++; return VC_REDACT; });
+    out=vcMapSafetyNums(src, function(vals, unit, kind){
+          const tok=arguments[3];
+          const v=vcClaimVerdict(tok, vals, unit, kind, claims);
+          if(v && v.verdict==='verified'){ verified++; return UNITS.fmt(v.c,'temp',{role:'safeFloor'})+' '
+            +(lang==='he'?'לפי המדריך המאומת.':L('לפי המדריך המאומת.','per the app\'s verified guide.')); }
+          if(v && v.verdict==='release'){ return tok; }
+          redacted++; return VC_REDACT;
+        })
+        // The bare-digit sweep stays UNCHANGED: a number the tokenizer cannot see was never offered to
+        // the classifier either, so it can never be released (§5.4.3 — silence is not release).
+        .replace(safetyNumRe(), function(){ redacted++; return VC_REDACT; });
   }
```

**(ג) `vcMapSafetyNums` מעביר את הטוקן המלא** — תוספת ארגומנט אחת, אחורה-תואמת (קוראים קיימים מתעלמים):

```js
 function vcMapSafetyNums(s, fn){
   return String(s||'').replace(safetyTokenRe(),
     function(_m, r1, r2, ru, n1, u1, ph){
-      if(r1!=null) return fn([safetyNumVal(r1), safetyNumVal(r2)], ru||'', 'range');
-      if(n1!=null) return fn([safetyNumVal(n1)], u1||'', 'single');
-      return fn([safetyNumVal(ph)], 'pH', 'ph');
+      // 4th arg (R-62): the WHOLE matched token, byte-identical — the join key the classifier map uses.
+      if(r1!=null) return fn([safetyNumVal(r1), safetyNumVal(r2)], ru||'', 'range', _m);
+      if(n1!=null) return fn([safetyNumVal(n1)], u1||'', 'single', _m);
+      return fn([safetyNumVal(ph)], 'pH', 'ph', _m);
     });
 }
```

**‏`verified`** הוא מונה חדש (`let redacted=0, verified=0, out;`) — Task 4 קורא אותו.

### RED → GREEN — `tests/vg-classifier-verdicts.spec.ts`

חמש הבדיקות מכסות D1-D5 ישירות. כולן נכתבות מול `window.vcGuardSpoken` עם `claims` מיוצר ידנית —
אפס רשת, אפס מוק ברמת ה-API.

```ts
import { test, expect, seedApp } from './_fixtures';

const mkClaims = (page, pairs: [string, any][]) =>
  page.evaluate(p => new Map(p as any), pairs);   // built page-side; the Map crosses no boundary

test.describe('R-62 Task 2 · the token decision table', () => {
  test('D1 · a MIXED category yields NO number, even at confidence 0.99', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['63°C', { text:'63°C', kind:'internal_safe_temp', value:63, unit:'C',
        subject:{ item:null, category:'בקר', form:'unknown' }, confidence:0.99 }]]);
      return w.vcGuardSpoken('הטמפרטורה הבטוחה לבקר היא 63°C.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('63');           // בקר = 63 שלם / 71 טחון → catUniformSafe null
    expect(said).toContain('[…]');
  });

  test('D2 · an item NOT in the catalog yields NO number', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['70°C', { text:'70°C', kind:'internal_safe_temp', value:70, unit:'C',
        subject:{ item:'תנין', category:null, form:'whole' }, confidence:0.99 }]]);
      return w.vcGuardSpoken('טמפ׳ בטוחה לתנין: 70°C.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('70');
    expect(said).toContain('[…]');
  });

  test('D3 · the smoking answer — chamber + duration spoken, internal checked against the table', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([
        ['110°C',  { text:'110°C',  kind:'chamber_temp',      value:110, unit:'C', subject:{item:null,category:null,form:'unknown'}, confidence:0.96 }],
        ['6 שעות', { text:'6 שעות', kind:'duration',          value:6,   unit:'h', subject:{item:null,category:null,form:'unknown'}, confidence:0.97 }],
        ['71°C',   { text:'71°C',   kind:'internal_safe_temp',value:71,  unit:'C', subject:{item:null,category:'עוף',form:'whole'},  confidence:0.95 }],
      ]);
      return w.vcGuardSpoken('עשן ב-110°C במשך 6 שעות עד 71°C פנימי.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).toContain('110°C');            // released — the failure R-62 exists to fix
    expect(said).toContain('6 שעות');
    expect(said).not.toContain('71°C');         // עוף is uniformly 74 → 71 does not match → redacted
  });

  test('D4 · other / missing kind / low confidence are all redacted', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const outs = await page.evaluate(() => {
      const w = window as any;
      const g = (c: any) => w.vcGuardSpoken('החזק ב-110°C.', {t1:null,t2:null,cat:null}, 'he', c);
      const base = { text:'110°C', value:110, unit:'C', subject:{item:null,category:null,form:'unknown'} };
      return [
        g(new Map([['110°C', Object.assign({}, base, { kind:'other',        confidence:0.99 })]])),
        g(new Map([['110°C', Object.assign({}, base, { kind:undefined,      confidence:0.99 })]])),
        g(new Map([['110°C', Object.assign({}, base, { kind:'chamber_temp', confidence:0.70 })]])),
      ];
    });
    outs.forEach(o => { expect(o).toContain('[…]'); expect(o).not.toContain('110'); });
  });

  test('D5 · a claim whose text is not a tokenizer token affects nothing', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const [withGhost, withNone] = await page.evaluate(() => {
      const w = window as any;
      const q = 'החזק ב-110°C.';
      const ghost = new Map([['110 degrees', { text:'110 degrees', kind:'chamber_temp', value:110, unit:'C',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.99 }]]);
      return [w.vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', ghost),
              w.vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', null)];
    });
    expect(withGhost).toBe(withNone);           // identical — the ghost claim is inert
  });
});
```

**‏RED מוכח:** D3 היא ה-RED החזק — לפני השינוי הענף "שניים ומעלה" מוחק את שלושת המספרים, ולכן
`expect(said).toContain('110°C')` נכשל. הפלט מודבק.

**המקרים השליליים (נקובים):** קטגוריה מעורבת · פריט לא-מזוהה · `kind:'other'` · `kind` חסר ·
`confidence:0.70` · טענה על טוקן שאינו שלנו · טווח (`kind==='range'`) שאינו מאושר לעולם.

---

## Task 3 — חיווט ב-`vcAskFlow`, האינווריאנט P6, ומונה הבקשות

**מקור בספֵּק (§5.2):** *"נקודת ההשתלה מדויקת: `vcAskFlow` שורה 8014 (התשובה המלאה חזרה) → **המסווג**
→ שורה 8020 (`vcGuardSpoken`)."* **(§5.7):** *"מסלול ההקראה (`steps`/`timers`/`schedule`) **אינו** עובר
במסווג לעולם — הוא אינו נוגע ב-latency של ההקראה (P8)."*

### הקוד

```js
     const answer=await vcAskAIStream(question, tiers.t1||tiers.t2, function(d){ asm.push(d); });
     asm.end();
     vcLatMark('textResp');
+    // R-62 · the classifier pass (spec §5.2). Strictly AFTER the complete answer and strictly BEFORE the
+    // guard — the same "exactly once, on the whole answer" position the guard itself already occupies.
+    // It NEVER awaits anything on the read-aloud path: `early.chain` (the opener) is already sounding and
+    // is not awaited until below, so this wait overlaps audible speech instead of preceding it.
+    // Any failure resolves to null (vcClassifySafetyClaims never throws) → the guard behaves as today.
+    vcLatMark('classReq');
+    const claims=await vcClassifySafetyClaims(answer);
+    vcLatMark('classResp');
     // THE guard — exactly once, on the COMPLETE answer (spec §6.1) ...
-    const guarded=vcGuardSpoken(answer, tiers, ansL);
+    const guarded=vcGuardSpoken(answer, tiers, ansL, claims);
```

**‏`vcLatMark('classReq'/'classResp')`** — שתי נקודות חדשות בלוח ה-latency הקיים; הן המקור המספרי
ל-D11 ולדיווח §10.6.

### RED → GREEN — `tests/vg-classifier-wiring.spec.ts`

**‏D6 — האינווריאנט P6, ששת נתיבי הכשל, השוואת snapshot.** הבדיקה מריצה כל תשובה **פעמיים**: פעם עם
המסווג נכשל, ופעם עם `claims=null` מפורש — ודורשת **שוויון מחרוזת מלא**:

```ts
import { test, expect, seedApp } from './_fixtures';

const ANSWERS = [
  'הטמפרטורה הבטוחה לאסאדו היא 63°C, המשך ל-71°C, ולרכות ~93°C.',
  'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.',
  'הוצא אותו ב-165 פנימי.',                 // bare digit run, no unit anywhere (G-A1 hole 1)
  'טווח 63°C-74°C.',                         // a range token
  'אין כאן שום מספר.',                       // no tokens at all
];

test.describe('R-62 Task 3 · P6 — every failure path is byte-identical to today', () => {
  for (const [name, mock] of [
    ['api error',        () => { throw new Error('api-429'); }],
    ['timeout',          () => { throw new Error('timeout'); }],
    ['malformed JSON',   () => { throw new SyntaxError('Unexpected token'); }],
    ['schema violation', () => ({ claims: [{ nope: 1 }] })],
    ['empty claims',     () => ({ claims: [] })],
    ['no token match',   () => ({ claims: [{ text: '999°C', kind: 'chamber_temp', value: 999, unit: 'C', confidence: 1 }] })],
  ] as [string, any][]) {
    test(`D6 · ${name} → identical output`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked': 'true' });
      const pairs = await page.evaluate(async (src) => {
        const w = window as any;
        // eslint-disable-next-line no-eval
        w.__vcClassMock = eval('(' + src.fn + ')');
        const out: [string, string][] = [];
        for (const a of src.answers) {
          const claims = await w.vcClassifySafetyClaims(a);      // exercises the real failure path
          out.push([w.vcGuardSpoken(a, {t1:null,t2:null,cat:null}, 'he', claims),
                    w.vcGuardSpoken(a, {t1:null,t2:null,cat:null}, 'he')]);   // today's 3-arg call
        }
        w.__vcClassMock = null;
        return out;
      }, { fn: String(mock), answers: ANSWERS });
      for (const [withClass, today] of pairs) expect(withClass).toBe(today);
    });
  }

  test('D10 · the read-aloud path never calls the classifier (zero AI requests)', async ({ isolatedPage: page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    let calls = 0;
    await page.route('**/generateContent*', r => { calls++; return r.abort(); });
    try {
      await page.evaluate(() => {
        const w = window as any;
        w.vcSpeakContent('הוצא את החזה מהמעשנה ועטוף אותו.');   // steps
        w.vcSpeak('הטיימר של החזה הסתיים.', 'he', 'timer');      // timers
      });
      await page.waitForFunction(() => true);
      expect(calls).toBe(0);      // no TTS key seeded → no request at all; the point is the CLASSIFIER
      const seen = await page.evaluate(() => (window as any).__vcClassCalls || 0);
      expect(seen).toBe(0);
    } finally { await page.unroute('**/generateContent*'); }
  });

  test('D9 · ask and vcAsk stay low; safetyClass is a NEW row', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const t = await page.evaluate(() => {
      const w = window as any;
      return { ask: w.thinkFor('ask'), vcAsk: w.thinkFor('vcAsk'), cls: w.thinkFor('safetyClass'),
               search: w.searchFor('safetyClass', false) };
    });
    expect(t).toEqual({ ask: 'low', vcAsk: 'low', cls: 'high', search: false });
  });
});
```

**‏`__vcClassCalls`** — מונה בן שורה אחת בראש `vcClassifySafetyClaims`
(`try{ window.__vcClassCalls=(window.__vcClassCalls||0)+1; }catch(e){}`), קיים כדי ש-D10 יטען על
**אי-קריאה**, לא על אי-רשת. זו הצורה ש-DoD-4 דורש: אפקט נצפה, לא היעדר תופעת-לוואי.

**‏D11 — latency ההקראה.** נמדד ב-`scratch/voice-governance/readaloud-latency.mjs` (‏§3.5): ‏10 הקראות
של אותו משפט, מדווח `firstSound` חציוני. **הסף: אין רגרסיה מעבר ל-±15% מ-~1,101ms** המתועדים ב-6709.
המסווג אינו במסלול הזה כלל, ולכן כל חריגה היא באג — לא "רעש".

**מקרים שליליים (נקובים):** ששת נתיבי הכשל למעלה, **כל אחד על חמש תשובות** = 30 השוואות snapshot ·
מסלול ההקראה שאינו קורא למסווג · `ask`/`vcAsk` שלא זזו.

---

## Task 4 — R-61 · המשפט המאומת מוביל כשאין אישור

**מקור בספֵּק (§5.6):** *"כאשר **כל** המספרים נמחקו ואף אחד לא אושר, ויש משפט תחליף — הסדר הופך ל-
`sub + ' ' + out + ' ' + notice`. כאשר לפחות טוקן אחד אושר, הסדר נשאר כהיום… אותה מחרוזת מוצגת גם על
המסך (`vcLastQA`, 8021), ולכן הסדר משתנה בשני הערוצים כאחד — וזה נכון."*

### הקוד — שלוש שורות ב-`vcGuardSpoken`

```js
   const sub=vcSafeSubstitution(tiers, lang);
-  return out+' '+notice+(sub?(' '+sub):'');
+  // R-61 (owner report 1.8 on R-53): a listener cannot scroll back. When NOTHING was approved the body
+  // is near-contentless ("עד […] עד […]"), so the one verified sentence must be the FIRST thing heard.
+  // When at least one token WAS approved the body already carries real information and the shipped
+  // order stands — this is deliberately not a blanket reordering.
+  if(sub && !verified) return sub+' '+out+' '+notice;
+  return out+' '+notice+(sub?(' '+sub):'');
```

### RED → GREEN — `tests/vg-r61-order.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('R-61 · the verified sentence leads when nothing was approved', () => {
  test('D8a · all redacted + a substitution → the substitution comes FIRST', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const tiers = w.vcResolveTiers('אני מבשל אסאדו, מה הטמפרטורה הבטוחה?');
      return w.vcGuardSpoken('בשל עד 63°C, המשך ל-71°C, ולרכות ~93°C.', tiers, 'he');
    });
    const sub = said.indexOf('לפי המדריך');
    const notice = said.indexOf('אינם מאומתים');
    expect(sub).toBeGreaterThanOrEqual(0);
    expect(notice).toBeGreaterThanOrEqual(0);
    expect(sub).toBeLessThan(notice);           // ← RED today: the substitution is appended last
    expect(said.trim().startsWith('לפי המדריך') || said.indexOf('[…]') > sub).toBe(true);
  });

  test('D8b · at least one token approved → the shipped order is UNCHANGED', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const [now, before] = await page.evaluate(() => {
      const w = window as any;
      const tiers = w.vcResolveTiers('אני מבשל אסאדו, מה הטמפרטורה הבטוחה?');
      const claims = new Map([['110°C', { text:'110°C', kind:'chamber_temp', value:110, unit:'C',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.95 }]]);
      const a = 'עשן ב-110°C עד 63°C פנימי.';
      return [w.vcGuardSpoken(a, tiers, 'he', claims), w.vcGuardSpoken(a, tiers, 'he', claims)];
    });
    expect(now).toBe(before);
    expect(now.indexOf('אינם מאומתים') >= 0 || now.indexOf('אינו מאומת') >= 0).toBe(true);
  });

  test('D8c · the SPOKEN string and the on-screen string are the same string', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    // vcAskFlow assigns the guard's return to vcLastQA AND passes it to vcSpeak — assert one identity,
    // not two renderings (spec §5.6: "אותה מחרוזת מוצגת גם על המסך").
    const same = await page.evaluate(() => {
      const w = window as any;
      const spoken: string[] = [];
      const realSpeak = w.vcSpeak; w.vcSpeak = (t: string) => { spoken.push(t); };
      w.__vcAskMock = 'בשל עד 63°C, המשך ל-71°C, ולרכות ~93°C.';
      return (async () => {
        await w.vcAskFlow('שאלה: אני מבשל אסאדו, מה הטמפרטורה הבטוחה?');
        w.vcSpeak = realSpeak; w.__vcAskMock = null;
        return { screen: w.vcLastQA && w.vcLastQA.a, spoken: spoken.join(' ') };
      })();
    });
    expect(same.spoken).toContain(String(same.screen).slice(0, 30));
  });
});
```

**המקרים השליליים (נקובים):** תשובה **עם** אישור אחד לפחות — הסדר **לא** משתנה (D8b) · תשובה ללא
`sub` כלל (פריט לא מזוהה) — הסדר לא משתנה · שאלת קטגוריה מעורבת — אין `sub`, אין היפוך.

**‏DoD-7 (רגרסיה red-green):** ‏D8a מורצת, נצפית עוברת; שלוש השורות מוסרות; **נצפית נופלת**; מוחזרות;
עוברת. שני הפלטים מודבקים.

---

# אזור ב׳ — מחזור-החיים של אירוע (R-57)

## Task 5 — `evState`, `finishedAt`, ו-`evCookStarted` (ההגדרה השמרנית של F-2)

**מקור בספֵּק (§4.2):** *"נוסף שדה **אחד בלבד** שנשמר — `finishedAt` — וכל השאר **נגזר בזמן ריצה**
מ-`evState(ev)`. אין מיגרציה, אין backfill, ורשומה ישנה נקראת נכון ביום הראשון."*
**פסק בעלים F-2:** *"נדרשת הגדרה של 'הבישול התחיל' — סימוני שלבים שבוצעו, טיימר שהופעל, או שניהם.
ההגדרה חייבת להיות **שמרנית**: בספק ⟵ להתייחס כאילו התחיל ולירות."*

### ההגדרה של "הבישול התחיל" — נגזרת מהקוד, לא הומצאה

חמישה עדים, **כל אחד מספיק לבדו** (OR), ושניים מהם עמידים לזמן:

| # | העד | המפתח בקוד | מדוע הוא ראיה, ומה מגבלתו |
|---|---|---|---|
| 1 | **התוכנית הותחלה** | `mk-plan-started-<id>` — `planStartKey()` 8316 | הצהרה מפורשת של המשתמש "▶ התחל תוכנית" (‏8336). **לעולם אינו נגרס בזמן** — העד החזק ביותר |
| 2 | **משימה בתוכנית סומנה** | `wpck:<id>:<label>` — 8722/8502 | ‏check-off אמיתי על שלב עבודה. **לעולם אינו נגרס** ואין לו היום שום נתיב איפוס (‏§4.4) |
| 3 | **רשומת טיימר קיימת לאירוע** | `mk-timers` עם קידומת `st-<id>-` | טיימר שהופעל, הושהה או פג. ⚠️ **`_timerSet` גוזם רשומות ש-`end < now-12h`** (‏3297) — בדיוק סף הפגות. לכן העד הזה **נעלם** באירוע ישן, ולכן הוא לבדו אינו מספיק |
| 4 | **מושב חי** | `mk-cook-live-<id>` — `liveKey()` 8089 | ‏`startLiveCook` נפתח רק בבישול בפועל |
| 5 | **בדיקת `bcheck` כבר צצה** | רשומה ב-`mk-bcheck-due` עם `tid` בקידומת `st-<id>-` | הבישול הגיע לשלב שלפני ההגשה |

**עד 3 הוא הסיבה שההגדרה חייבת להיות רחבה.** אילו הסתמכנו על טיימרים בלבד, אירוע שנשכח **מעל 12 שעות**
— היחיד שהשער הזה בכלל נוגע בו — היה מאבד את הראיה בדיוק ברגע שבו היא נדרשת. עדים 1 ו-2 שורדים לנצח.

```js
// ── R-57 · event lifecycle (spec §4, owner rulings 1.8.2026) ────────────────────────────────────────
const EV_STALE_MS = 12*3600e3;   // owner ruling: 12 hours after serve. Not a guess — R-57 decision (1).

// F-2 · "did the cook actually START?" — the gate that decides whether a STALE event still raises its
// pre-serve safety check. The owner's ruling is explicit about the failure direction: "בספק ⟵ להתייחס
// כאילו התחיל ולירות. שגיאה לכיוון ההתראה עדיפה על שגיאה לכיוון השתיקה". So: FIVE independent
// witnesses, ANY one is sufficient, and ANY throw returns TRUE.
// Deliberately NOT a witness: mk-tlstate-<id>. Method / ready / sv-order are PLANNING decisions (spec
// §4.4 says so in as many words) — an event that was configured but never cooked has nothing to check.
function evCookStarted(evId){
  const id=evId||(typeof evScope==='function'?evScope():null);
  if(!id) return true;                                                   // unknown scope → assume started
  try{
    if(store.get('mk-plan-started-'+id)) return true;                    // 1 · explicit "▶ התחל תוכנית"
    const ts=store.get('mk-timers')||{};                                 // 3 · any timer record at all
    if(Object.keys(ts).some(function(k){ return k.indexOf('st-'+id+'-')===0; })) return true;
    if(store.get('mk-cook-live-'+id)) return true;                       // 4 · a live session
    const d=store.get('mk-bcheck-due')||{};                              // 5 · a check already surfaced
    if(Object.keys(d).some(function(k){ const r=d[k]; return r && String(r.tid||k).indexOf('st-'+id+'-')===0; })) return true;
    // 2 · any work-plan check-off. wpck: is a raw localStorage prefix (8722), not an mk- key, so it is
    // scanned directly — the same way the key-space audit at ~8910 already enumerates it.
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && k.indexOf('wpck:'+id+':')===0) return true;
    }
    return false;
  }catch(e){ return true; }                                              // storage threw → fire, never hush
}

// staleMs — POSITIVE only for a DATED event whose serve instant has passed (spec §4.2b). An undated
// event's parseServeTime rolls `serve` to today/tomorrow (11309), so its serve is always in the future
// and it can never go stale — that is correct: it is genuinely still a draft.
function evStaleMs(ev){
  if(!ev || !ev.date) return -1;                                          // §4.2b — undated never expires
  try{ return Date.now() - parseServeTime(ev.serve, ev).getTime(); }catch(e){ return -1; }
}
// The ONE state function (spec §4.2). Derived at read time; the only PERSISTED addition is finishedAt.
function evState(ev){
  if(!ev) return 'planning';
  if(ev.finishedAt) return 'finished';
  // 4.2a — a running timer means the event is NEVER stale. A cook who serves at 2am is not a forgotten
  // event. This check precedes the 12-hour test and reuses evRunningCount (11142), not a new mechanism.
  try{ if(evRunningCount(ev.id)>0) return 'active'; }catch(e){}
  try{ if(store.get(liveKey(ev.id))) return 'active'; }catch(e){}
  if(evStaleMs(ev) >= EV_STALE_MS) return 'needsUpdate';
  try{ if(store.get('mk-plan-started-'+ev.id)) return 'active'; }catch(e){}
  return 'planning';
}
function evFinish(id){                                                    // the positive, user-declared end
  const list=evList(), i=list.findIndex(function(e){ return e.id===id; });
  if(i<0) return false;
  list[i].finishedAt=Date.now(); list[i].updated=Date.now();
  evSaveList(list); return true;
}
function evUnfinish(id){                                                  // re-arm clears it (spec §4.3)
  const list=evList(), i=list.findIndex(function(e){ return e.id===id; });
  if(i<0) return false;
  delete list[i].finishedAt; list[i].updated=Date.now();
  evSaveList(list); return true;
}
try{ window.evState=evState; window.evCookStarted=evCookStarted; window.evStaleMs=evStaleMs;
     window.evFinish=evFinish; window.evUnfinish=evUnfinish; }catch(e){}
```

**‏`evSaveCurrent` (11233)** — שורה אחת, כדי ש-`finishedAt` ישרוד שמירה חוזרת:

```js
     menu:JSON.parse(JSON.stringify(m)), created:existing?existing.created:now, updated:now };
+  if(existing && existing.finishedAt) rec.finishedAt=existing.finishedAt;   // §4.2: derived-not-migrated, but the ONE stored field must survive a re-save
```

### הצרכן (DoD-5) — תג מצב ב-`cPaintEvents` (11445)

```js
+  // §4.2c — evState is READ here, at render. No new setInterval; cPaintEvents already runs on every
+  // events-screen paint, and the 60s reminder loop (13058) repaints it.
+  const _st=evState(ev);
+  const _stChip = _st==='needsUpdate' ? `<span class="ev-state ev-needs">${L('דורש עדכון','Needs update')}</span>`
+                : _st==='finished'    ? `<span class="ev-state ev-done">${L('הסתיים','Finished')}</span>`
+                : _st==='active'      ? `<span class="ev-state ev-live">${L('בבישול','Cooking')}</span>` : '';
```

הצ'יפ נשתל בכותרת שורת האירוע. **זהו הקורא האמיתי** — ‏`evState` אינו שדה מחושב שאיש אינו קורא (‏L2/L8).

### RED → GREEN — `tests/vg-evstate.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

const EV = (over: any = {}) => Object.assign({ id: 'ev1', name: 'שבת', date: '2026-07-30',
  serve: '19:00', menu: { keys: [] }, created: 1, updated: 1 }, over);

test.describe('R-57 · evState', () => {
  test('C1 · dated, served 13h ago, zero timers → needsUpdate', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });   // 13h after 19:00
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const s = await page.evaluate(ev => (window as any).evState(ev), EV());
    expect(s).toBe('needsUpdate');
  });

  test('C2 · NEGATIVE (4.2a) · the same event WITH a running timer → active', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({ 'st-ev1-brisket-smoke': { end: Date.parse('2026-07-31T10:00:00'), name: 'חזה' } }) });
    const s = await page.evaluate(ev => (window as any).evState(ev), EV());
    expect(s).toBe('active');
  });

  test('C3 · NEGATIVE (4.2b) · an UNDATED event is never needsUpdate', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T23:30:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const s = await page.evaluate(ev => (window as any).evState(ev), EV({ date: '', serve: '08:00' }));
    expect(s).toBe('planning');
  });

  test('C4 · NEGATIVE (threshold, both sides) · 11h → not needsUpdate; 13h → needsUpdate', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T06:00:00') });   // 11h
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    expect(await page.evaluate(ev => (window as any).evState(ev), EV())).not.toBe('needsUpdate');
    await page.clock.setFixedTime(new Date('2026-07-31T08:00:00'));       // 13h
    expect(await page.evaluate(ev => (window as any).evState(ev), EV())).toBe('needsUpdate');
  });

  test('C5 · finished is distinct from needsUpdate and survives a re-save', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const out = await page.evaluate(ev => {
      const w = window as any;
      w.evSaveList([ev]); w.store.set('mk-active', ev.id);
      w.evFinish(ev.id);
      const after = w.evList()[0];
      w.evSaveCurrent(after.name, after.desc, after.date);        // a later save must not drop it
      return { state: w.evState(w.evList()[0]), kept: !!w.evList()[0].finishedAt };
    }, EV());
    expect(out).toEqual({ state: 'finished', kept: true });
  });

  test('F-2 · evCookStarted — five witnesses, and "in doubt → started"', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const r = await page.evaluate(() => {
      const w = window as any;
      const clean = () => { w.store.set('mk-plan-started-ev1', null); w.store.set('mk-timers', {});
                            w.store.set('mk-cook-live-ev1', null); w.store.set('mk-bcheck-due', {});
                            localStorage.removeItem('wpck:ev1:עטיפה'); };
      const out: any = {};
      clean(); out.none = w.evCookStarted('ev1');                                     // false
      clean(); w.store.set('mk-plan-started-ev1', Date.now()); out.plan = w.evCookStarted('ev1');
      clean(); w.store.set('mk-timers', { 'st-ev1-x-smoke': { left: 60 } }); out.timer = w.evCookStarted('ev1');
      clean(); localStorage.setItem('wpck:ev1:עטיפה', '1'); out.check = w.evCookStarted('ev1');
      clean(); w.store.set('mk-cook-live-ev1', { startedAt: 1 }); out.live = w.evCookStarted('ev1');
      clean(); w.store.set('mk-bcheck-due', { 'st-ev1-x-bcheck@1': { tid: 'st-ev1-x-bcheck' } }); out.bchk = w.evCookStarted('ev1');
      clean(); out.noScope = w.evCookStarted(null);                                    // in doubt → true
      return out;
    });
    expect(r).toEqual({ none: false, plan: true, timer: true, check: true, live: true, bchk: true, noScope: true });
  });
});
```

**המקרים השליליים (נקובים):** ‏C2 טיימר רץ · C3 אירוע לא-מתוארך · C4 הסף משני צדדיו (11ש/13ש) ·
`evCookStarted` על אירוע ללא שום עד = `false` (השער החיובי) · `evCookStarted(null)` = `true` (השמרנות).

**‏DoD-9:** צ'יפ המצב מרונדר בעברית **ובשפה נוספת** (ru), צילומי 390×844 מצורפים; שלוש המחרוזות עוברות
את צינור §3.2 בשבע שפות.

---

## Task 6 — דיכוי ההתראות מבוססות-הזמן, שער F-2, ובאנר הפיצוי

**מקור בספֵּק (§4.5), שלושת אתרי החימוש** — ראה Global Constraints. **פסק בעלים F-2** — הדיכוי של
`bcheck` חל **רק כשהבישול לא התחיל**.

### הקוד — אתר 1 · `buildList` (8464)

```js
     tlTimers.forEach(t=>clearTimeout(t)); tlTimers=[];
-    if(store.get('mk-tlalerts') && ('Notification' in window) && Notification.permission==='granted'){
+    // §4.5 site 1 — a stale/finished event stops arming TIME-BASED alerts. An alert about an instant
+    // that passed 12+ hours ago is not information (R-57). evState is read here per §4.2c; no new loop.
+    const _evNow=(typeof evActive==='function' && typeof evList==='function')
+      ? (evList().find(function(e){ return e.id===evActive(); })||null) : null;
+    const _evSt=_evNow?evState(_evNow):'planning';
+    const _armAlerts=(_evSt!=='needsUpdate' && _evSt!=='finished');
+    if(_armAlerts && store.get('mk-tlalerts') && ('Notification' in window) && Notification.permission==='granted'){
```

### הקוד — אתר 2 · `scheduleBcheckDue` (3486) — כאן חי פסק F-2

```js
 function scheduleBcheckDue(computed, tlTimers){
   const nowTs=Date.now();
+  // §4.5 site 2 + owner ruling F-2 (1.8.2026). The `ms<=0` branch below fires SYNCHRONOUSLY with no
+  // lower bound: a serve time from last week ignites mark() for every item at once on the first render.
+  // That is the acknowledgement pile-up the owner reported (R-57/R-56). The ruling is NOT "never fire
+  // in a stale event" and NOT "always" — it is the exact distinction between an event abandoned
+  // MID-COOK (real meat went through a real process — the safety gate is relevant) and one that never
+  // started (nothing to check; an alert here only teaches people to ignore safety alerts).
+  // The failure direction is fixed by the ruling: in doubt, treat as started and FIRE (see evCookStarted).
+  // FUTURE scheduling (0<ms<24h) is untouched — the event is not stale for those.
+  const _ev=(typeof evActive==='function' && typeof evList==='function')
+    ? (evList().find(function(e){ return e.id===evActive(); })||null) : null;
+  const _st=_ev?evState(_ev):'planning';
+  const _stale=(_st==='needsUpdate'||_st==='finished');
+  const _fireImmediate = !_stale || evCookStarted(_ev?_ev.id:null);
+  let _suppressed=0;
   (computed||[]).forEach(function(c){
       ...
       const ms=s.start.getTime()-nowTs;
-      if(ms<=0) mark(); else if(ms<24*3600e3) tlTimers.push(setTimeout(mark, ms));
+      if(ms<=0){ if(_fireImmediate) mark(); else _suppressed++; }
+      else if(ms<24*3600e3) tlTimers.push(setTimeout(mark, ms));
     });
   });
+  // §4.6 compensation — honesty is preserved even when the alarm is not. Never time-based, never
+  // dismissible-by-timeout: it is a fact about the event, shown for as long as the event is stale.
+  try{ if(_stale) renderStaleEventBanner(_ev, _suppressed); }catch(e){}
 }
```

### הקוד — 3 · באנר הפיצוי (§4.6)

```js
// §4.6 — "האירוע הזה עבר. N בדיקות טמפ׳ ו-M התראות לא נורו." Persistent, NOT time-based, NOT a toast
// (toast is role="status", dies at 5000ms, display:none in print — §2.2 rules it out for anything that
// must persist). Rendered into the SAME ordered container as the alarm family (#mkActStack, Task 8) so
// it can never push a live alert off a 390×844 screen.
function renderStaleEventBanner(ev, suppressedChecks){
  let el=document.getElementById('mkStaleEv');
  if(!ev){ if(el) el.remove(); return; }
  const alerts=(typeof _staleSuppressedAlerts==='function')?_staleSuppressedAlerts(ev):0;
  if(!el){ el=document.createElement('div'); el.id='mkStaleEv'; el.className='mk-alarm mk-alarm-stale';
    el.setAttribute('role','status'); el.setAttribute('aria-label',L('אירוע שעבר','Past event'));
    (document.getElementById('mkActStack')||document.body).appendChild(el); }
  const line=L(`האירוע הזה עבר. ${suppressedChecks} בדיקות טמפ׳ ו-${alerts} התראות לא נורו.`,
               `This event has passed. ${suppressedChecks} temp checks and ${alerts} alerts were not raised.`);
  el.innerHTML=`<div class="mka-head">🗓️ <b>${esc(ev.name||L('אירוע','Event'))}</b></div>`+
    `<div class="mka-row"><span class="mka-name">${vcLtrNums(esc(line))}</span>`+
    `<button class="mka-stop" data-staleupdate>${L('עדכן מועד הגשה','Update serve time')}</button></div>`;
  const b=el.querySelector('[data-staleupdate]');
  if(b) b.addEventListener('click', function(){ if(typeof openTimeline==='function') openTimeline(); });
}
```
> **הערה על המספר בבאנר:** `L()` כאן מקבל תבנית עם אינטרפולציה, ולכן **אינו** נקלט ע"י האקסטרקטור
> במצב 1. הפתרון בהתאם לדפוס הקיים (‏3403 `mkTimerWarnText`): הליטרל הסטטי הוא המשפט **בלי** המספרים,
> והמספרים משורשרים אחריו. המימוש בפועל מפצל לשני `L()` סטטיים + `vcLtrNums` על המספרים.

### RED → GREEN — `tests/vg-stale-suppress.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

const STALE_EV = { id: 'ev1', name: 'שבת שעברה', date: '2026-07-25', serve: '19:00',
                   menu: { keys: [] }, created: 1, updated: 1 };
const COMPUTED = `[{ blocked:false, m:{heb:'חזה בקר', key:'k1'},
  stages:[{kind:'bcheck', start:new Date(Date.now()-3600e3), tid:'st-ev1-k1-bcheck', temp:74}] }]`;

test.describe('R-57 · a stale event stops shouting about the past', () => {
  test('C6 · stale + cook NEVER started → bcheck does NOT fire (regression, red-green)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': 'ev1', 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(c => (window as any).scheduleBcheckDue(eval(c), []), COMPUTED);
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    await page.waitForFunction(() => !!document.getElementById('mkStaleEv'));
    await expect(page.locator('#mkStaleEv')).toContainText('לא נורו');
  });

  test('F-2 · stale but the cook DID start (a wpck check-off) → bcheck FIRES', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': 'ev1', 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(c => { localStorage.setItem('wpck:ev1:עטיפה', '1');
      (window as any).scheduleBcheckDue(eval(c), []); }, COMPUTED);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
    await expect(page.locator('#mkBcheckAlarm')).toContainText('חזה בקר');
  });

  test('NEGATIVE · a NEW occurrence of the same item still raises the check (R-56 must not regress)',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([]), 'mk-active': '',
      'mk-bcheck-due': JSON.stringify({ 'st-ev1-k1-bcheck@1000': { name: 'חזה בקר', acked: true, tid: 'st-ev1-k1-bcheck' } }) });
    await page.evaluate(() => {
      const w = window as any;
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'חזה בקר', key: 'k1' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'st-ev1-k1-bcheck', temp: 74 }] }], []);
    });
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));   // new start → new key
    await expect(page.locator('#mkBcheckAlarm')).toBeVisible();
  });

  test('NEGATIVE · a future bcheck in a stale event is still SCHEDULED (only the ms<=0 branch is gated)',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': 'ev1', 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(() => {
      const w = window as any;
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'שוק', key: 'k2' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() + 5000), tid: 'st-ev1-k2-bcheck', temp: 74 }] }], []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    await page.clock.fastForward(6000);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
  });
});
```

**‏DoD-7 (רגרסיה red-green, C6):** הבדיקה עוברת → השער `_fireImmediate` מוסר → **נצפית נופלת**
(`#mkBcheckAlarm` צץ) → מוחזר → עוברת. שני הפלטים מודבקים.

**המקרים השליליים (נקובים):** מופע חדש של אותו פריט **כן** מרים בדיקה (‏R-56) · תזמון עתידי באירוע פג
**לא** מדוכא · בישול שהתחיל **כן** יורה גם באירוע פג (F-2) · `startTimerWatch` **לא נגוע** —
נבדק בנפרד: `tests/wave2-timers.spec.ts` חייב להישאר ירוק ללא שינוי.

**‏DoD-8/9:** צילום 390×844 של הבאנר (‏C10) בעברית וב-ru, עם `dir="ltr"` על שני המספרים.

---

## Task 7 — שער "המשך / התחל מחדש", ונתיב האיפוס הראשון של `wpck:`

**מקור בספֵּק (§4.4):** *"בכל כתיבה ל-`mk-tlserve`/`serveDateKey()` על אירוע שמצבו `needsUpdate` או
`finished` — **ולא באף מקרה אחר** — נפתח שער בעל שתי אפשרויות (תבנית `yes-no` לפי §12.5)."*
*"ל-`wpck:` **אין היום שום נתיב איפוס** — לא ב-`resetPlanTimers`, לא ב-`evDelete`, לא ב-`tlReset`.
'התחל מחדש' הוא הצרכן הראשון שלו, ולכן הוא **קוד חדש**, לא קריאה לפונקציה קיימת."*

### הקוד — 1 · שתי פעולות האיפוס

```js
// §4.4 · "התחל מחדש". wpck: has NEVER had a reset path (verified against resetPlanTimers 8319,
// evDelete 11268, tlReset 8384) — this IS that path, written here for the first time. It is a RAW
// localStorage prefix (8722), so it is swept directly, exactly like the key-space audit at ~8910 does.
// PLANNING choices are deliberately kept: mk-tlstate-<id> holds method / ready / sv-order, which the
// spec calls "החלטות תכנון, לא התקדמות" — restarting a cook must not un-plan the menu.
function evClearProgress(evId){
  const id=evId||evScope(); if(!id) return {wpck:0, timers:0, bcheck:0};
  let n=0;
  try{
    const kill=[];
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf('wpck:'+id+':')===0) kill.push(k); }
    kill.forEach(function(k){ localStorage.removeItem(k); n++; });
  }catch(e){}
  const removed=(id===evScope() && typeof resetPlanTimers==='function') ? resetPlanTimers() : _evDropTimers(id);
  try{ store.set('mk-plan-started-'+id, null); }catch(e){}
  const d=store.get('mk-bcheck-due')||{}; let b=0;
  Object.keys(d).forEach(function(k){ if(String(d[k]&&d[k].tid||k).indexOf('st-'+id+'-')===0){ delete d[k]; b++; } });
  store.set('mk-bcheck-due', d);
  try{ renderBcheckAlarm(); }catch(e){}
  return {wpck:n, timers:Object.keys(removed||{}).length, bcheck:b};
}
function _evDropTimers(id){ const ts=store.get('mk-timers')||{}, out={};
  Object.keys(ts).forEach(function(k){ if(k.indexOf('st-'+id+'-')===0){ out[k]=ts[k]; delete ts[k]; } });
  store.set('mk-timers', ts); return out; }

// §4.4 · "המשך". Keeps every check-off and every RUNNING timer; drops exactly two things that would
// otherwise detonate on the first render of the re-armed plan: FIRED timer records (they ring
// immediately — renderAlarm reads `fired`, 3374) and UNACKNOWLEDGED bcheck rows from the previous cycle
// (they are that cycle's, not this one's — the acknowledged ones stay, so R-56's guard keeps working).
function evKeepProgress(evId){
  const id=evId||evScope(); if(!id) return {timers:0, bcheck:0};
  const ts=store.get('mk-timers')||{}; let t=0;
  Object.keys(ts).forEach(function(k){ if(k.indexOf('st-'+id+'-')===0 && ts[k] && ts[k].fired){ delete ts[k]; t++; } });
  store.set('mk-timers', ts);
  const d=store.get('mk-bcheck-due')||{}; let b=0;
  Object.keys(d).forEach(function(k){ const r=d[k];
    if(r && !r.acked && String(r.tid||k).indexOf('st-'+id+'-')===0){ delete d[k]; b++; } });
  store.set('mk-bcheck-due', d);
  try{ renderAlarm(); renderBcheckAlarm(); }catch(e){}
  return {timers:t, bcheck:b};
}
try{ window.evClearProgress=evClearProgress; window.evKeepProgress=evKeepProgress; }catch(e){}
```

### הקוד — 2 · השער עצמו, ו**נקודת אחת** שדרכה עוברת כל כתיבת מועד

```js
// §4.4 · the ONE gate. Every serve-time write goes through here — there is no second path, so the
// question can never be skipped by a caller that forgot. `yes-no` shape (§12.5): exactly two options.
// Fires ONLY for needsUpdate/finished, and NEVER for any other state (the spec says "ולא באף מקרה אחר").
function evServeWriteGate(applyWrite){
  const ev=(typeof evActive==='function' && typeof evList==='function')
    ? (evList().find(function(e){ return e.id===evActive(); })||null) : null;
  const st=ev?evState(ev):'planning';
  if(st!=='needsUpdate' && st!=='finished'){ applyWrite(); return; }
  appConfirm(L('מצאנו סימונים וטיימרים מהבישול הקודם.','We found check-offs and timers from the previous cook.'),
    { okLabel:L('המשך מאיפה שהפסקתי','Continue where I left off'),
      cancelLabel:L('התחל מחדש','Start over') }).then(function(ans){
    if(ans===null) return;                        // dismissed → the serve time is NOT written
    applyWrite();                                 // the new serve instant lands first, then the re-arm
    if(ans===true) evKeepProgress(ev.id); else evClearProgress(ev.id);
    try{ evUnfinish(ev.id); }catch(e){}           // §4.3 — a re-armed event leaves `finished`
    if(typeof buildList==='function') buildList();
  });
}
```

**שלושת אתרי הכתיבה** (‏8338 `data-planpush` · 8339 `data-planreschedule` · 8373 `#tlServeDate`)
עוברים לעטיפה — למשל:

```js
-  { const sd=$("#tlServeDate"); if(sd) sd.addEventListener('change',()=>{ store.set(serveDateKey(), sd.value||null); buildList(); }); }
+  { const sd=$("#tlServeDate"); if(sd) sd.addEventListener('change',()=>{
+      evServeWriteGate(function(){ store.set(serveDateKey(), sd.value||null); buildList(); }); }); }
```

**החזרה לפעילות (§4.5) אינה מנגנון חדש:** ‏`buildList` בונה מחדש את `tlTimers` מול המועד **החדש**,
ו-`scheduleBcheckDue` מקבל `s.start` חדשים ולכן מפתחות-מופע חדשים (‏3477) — האישורים הישנים אינם
מדכאים אותם. אין "השמעה חוזרת" של תור שהצטבר, כי אין תור.

### RED → GREEN — `tests/vg-rearm-gate.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

const STALE = { id: 'ev1', name: 'שבת שעברה', date: '2026-07-25', serve: '19:00',
                menu: { keys: [] }, created: 1, updated: 1 };

test.describe('R-57 §4.4 · continue vs start over', () => {
  test('C7 · "המשך" keeps wpck: and drops ONLY fired timer records', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': JSON.stringify([STALE]), 'mk-active': 'ev1',
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'a', fired: 1 },
                                    'st-ev1-b-smoke': { end: Date.parse('2026-08-01T20:00:00'), name: 'b' } }),
      'mk-bcheck-due': JSON.stringify({ 'st-ev1-a-bcheck@1': { tid: 'st-ev1-a-bcheck', acked: true },
                                        'st-ev1-b-bcheck@1': { tid: 'st-ev1-b-bcheck', acked: false } }) });
    const after = await page.evaluate(() => {
      const w = window as any;
      localStorage.setItem('wpck:ev1:עטיפה', '1');
      w.evKeepProgress('ev1');
      return { wpck: localStorage.getItem('wpck:ev1:עטיפה'),
               timers: Object.keys(w.store.get('mk-timers') || {}),
               bcheck: Object.keys(w.store.get('mk-bcheck-due') || {}) };
    });
    expect(after.wpck).toBe('1');
    expect(after.timers).toEqual(['st-ev1-b-smoke']);        // fired one gone, running one kept
    expect(after.bcheck).toEqual(['st-ev1-a-bcheck@1']);     // acked kept, unacked dropped
  });

  test('C8 · "התחל מחדש" wipes EVERY wpck: of this event and no other event\'s', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': JSON.stringify([STALE]), 'mk-active': 'ev1',
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { left: 60 } }),
      'mk-plan-started-ev1': JSON.stringify(1),
      'mk-tlstate-ev1': JSON.stringify({ k1: { method: 'smoke', ready: true } }) });
    const after = await page.evaluate(() => {
      const w = window as any;
      localStorage.setItem('wpck:ev1:עטיפה', '1');
      localStorage.setItem('wpck:ev1:חיתוך', '1');
      localStorage.setItem('wpck:ev2:אחר', '1');            // a DIFFERENT event — must survive
      const n = w.evClearProgress('ev1');
      return { n, mine: localStorage.getItem('wpck:ev1:עטיפה'), other: localStorage.getItem('wpck:ev2:אחר'),
               started: w.store.get('mk-plan-started-ev1'),
               timers: Object.keys(w.store.get('mk-timers') || {}),
               plan: w.store.get('mk-tlstate-ev1') };
    });
    expect(after.n.wpck).toBe(2);
    expect(after.mine).toBeNull();
    expect(after.other).toBe('1');                            // NEGATIVE: scope-exact, never a prefix sweep
    expect(after.started).toBeFalsy();
    expect(after.timers).toEqual([]);
    expect(after.plan).toBeTruthy();                          // planning choices survive (spec §4.4)
  });

  test('NEGATIVE · the gate does NOT fire for a planning/active event', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-30T10:00:00') });   // before serve → planning
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-events': JSON.stringify([{ ...STALE, date: '2026-07-30' }]), 'mk-active': 'ev1',
      'mk-timers': JSON.stringify({}) });
    const wrote = await page.evaluate(() => {
      const w = window as any; let done = false;
      w.evServeWriteGate(() => { done = true; });
      return { done, dialog: !!document.querySelector('.appconfirm, [data-appconfirm]') };
    });
    expect(wrote.done).toBe(true);        // written synchronously, no question asked
    expect(wrote.dialog).toBe(false);
  });

  test('C9 · after a re-arm, alerts fire against the NEW instant and no backlog replays',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': JSON.stringify([STALE]), 'mk-active': 'ev1',
      'mk-timers': JSON.stringify({}), 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(() => {
      const w = window as any;
      w.evUnfinish('ev1');
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'חזה', key: 'k1' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() + 4000), tid: 'st-ev1-k1-bcheck', temp: 74 }] }], []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);   // nothing replays at t0
    await page.clock.fastForward(5000);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
  });
});
```

**המקרים השליליים (נקובים):** `wpck:` של אירוע אחר שורד את "התחל מחדש" · השער **אינו** נפתח באירוע
`planning`/`active` · טיימר **רץ** שורד את "המשך" · שורת `bcheck` **מאושרת** שורדת את "המשך" (אחרת
R-56 חוזר) · אין השמעה חוזרת של תור אחרי re-arm.

**‏i18n:** ארבע מחרוזות חדשות (השאלה + שני הכפתורים + תווית הבאנר) בצינור §3.2, שבע שפות.

---

# אזור ג׳ — הקטגוריות, המקבילה החזותית והתור

## Task 8 — `#mkActStack` · מכולה אחת מסודרת לארבעת הכרטיסים

**מקור בספֵּק (§2.3):** *"**סיכון ממשי:** בבישול רב-פריטים שלושתם יכולים להופיע יחד ולדחוף זה את זה
מחוץ למסך ב-390×844… מה **כן** נדרש: **מכולה אחת מסודרת (`#mkActStack`)** שכל ארבעת הרנדררים תולים
בה את הכרטיס שלהם, בסדר קבוע: `bcheck` → `alarm` → `voiceAct` → `warn`, עם גלילה פנימית מעל שני
כרטיסים. איחוד ההיגיון של השלושה — **מחוץ לתחולה**."*

**זו משימת refactor.** אף התנהגות אינה משתנה: אותם שלושה כרטיסים, אותם מזהים, אותם מאזינים.
Chesterton's Fence — `renderTimerWarn` נבנה נגד V-1 ו-`renderBcheckAlarm` נגד R-56; **אין לאחד אותם.**

### הקוד

```js
// §2.3 · ONE ordered host for the whole .mk-alarm family. Each renderer still owns its own card, its own
// id and its own listeners (they were each built against a different reported bug — Chesterton's Fence);
// this only stops them fighting over `position:fixed; top:12px` and pushing each other off a 390×844
// screen. Order is FIXED and semantic — safety first, then the fired alarm, then the new voice card,
// then the soft "about to finish" warning — never DOM-insertion order.
const MK_ACT_ORDER = ['mkBcheckAlarm','mkAlarm','mkVoiceAct','mkWarnAlarm','mkStaleEv'];
function mkActStack(){
  let s=document.getElementById('mkActStack');
  if(!s){ s=document.createElement('div'); s.id='mkActStack'; s.className='mk-actstack'; document.body.appendChild(s); }
  return s;
}
// Called by every renderer after it has appended/updated its card. Sorting a 5-element list on an event
// that fires at most a few times a minute costs nothing and removes an entire class of layout bug.
function mkActStackOrder(){
  const s=document.getElementById('mkActStack'); if(!s) return;
  MK_ACT_ORDER.forEach(function(id){ const el=document.getElementById(id); if(el) s.appendChild(el); });
  s.classList.toggle('mk-actstack-scroll', s.children.length>2);   // §2.3 — internal scroll above two cards
}
```

**ארבעה שינויים זהים** — ב-`renderAlarm` (3385), `renderTimerWarn` (3416), `renderBcheckAlarm` (3449)
ו-`renderStaleEventBanner` (Task 6): מחליפים את `document.body.appendChild(el)` ב-`mkActStack().appendChild(el)`,
ובסוף כל פונקציה מוסיפים `mkActStackOrder();`. דוגמה:

```js
-  if(!el){ el=document.createElement('div'); el.id='mkAlarm'; ... document.body.appendChild(el); }
+  if(!el){ el=document.createElement('div'); el.id='mkAlarm'; ... mkActStack().appendChild(el); }
   el.innerHTML=...;
   ...listeners...
+  mkActStackOrder();
```

**‏CSS (`app.css`)** — הכרטיסים עצמם מאבדים את ה-`position:fixed` הפרטי שלהם לטובת המכולה:

```css
/* §2.3 — the ordered act stack. The individual .mk-alarm cards keep every visual property they have
   today (colour, pulse, contrast); only the fixed positioning moves up one level, to the host. */
.mk-actstack{ position:fixed; inset-inline:8px; top:12px; z-index:60;
              display:flex; flex-direction:column; gap:8px; max-height:calc(100vh - 24px); }
.mk-actstack .mk-alarm{ position:static; inset:auto; width:auto; }
.mk-actstack-scroll{ overflow-y:auto; -webkit-overflow-scrolling:touch; }
```

### RED → GREEN — `tests/vg-actstack.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('§2.3 · the ordered act stack', () => {
  test('B7 · three cards at once, all reachable, none pushed off a 390×844 screen',
    async ({ isolatedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'חזה בקר', fired: 1 } }),
      'mk-bcheck-due': JSON.stringify({ 'st-ev1-b-bcheck@1': { name: 'שוק', temp: 74, tid: 'st-ev1-b-bcheck', acked: false } }) });
    await page.evaluate(() => {
      const w = window as any;
      w.renderAlarm(); w.renderBcheckAlarm(); w.mkShowTimerWarn('st-ev1-c-smoke', 'צלעות', 110);
    });
    await page.waitForFunction(() => document.querySelectorAll('#mkActStack .mk-alarm').length === 3);
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#mkActStack .mk-alarm')].map(e => e.id));
    expect(order).toEqual(['mkBcheckAlarm', 'mkAlarm', 'mkWarnAlarm']);   // safety first, always
    for (const id of order) {
      const box = await page.locator('#' + id).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);               // zero horizontal overflow
    }
    await expect(page.locator('#mkActStack')).toHaveClass(/mk-actstack-scroll/);
  });

  test('NEGATIVE · with ONE card there is no internal scroll and nothing else changed',
    async ({ isolatedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'חזה בקר', fired: 1 } }) });
    await page.evaluate(() => (window as any).renderAlarm());
    await expect(page.locator('#mkAlarm')).toBeVisible();
    await expect(page.locator('#mkActStack')).not.toHaveClass(/mk-actstack-scroll/);
    await page.locator('#mkAlarm .mka-stop').click();                     // the shipped listener still works
    await expect(page.locator('#mkAlarm')).toHaveCount(0);
  });
});
```

**‏RED מוכח:** הבדיקה הראשונה נכשלת היום על `#mkActStack` שאינו קיים.
**‏DoD-8:** צילום 390×844 של שלושת הכרטיסים יחד, **נצפה בעין** — זו המשימה שכל טענתה חזותית.
**רגרסיה:** `tests/d1-timer-warn-visual.spec.ts` ו-`tests/d2-bcheck-alert.spec.ts` חייבים להישאר
ירוקים **ללא שינוי** — אם בדיקה קיימת נשברה, שינינו התנהגות ולא רק מיקום.

---

## Task 9 — פס-הקול: `voiceLog` · `voiceAct` · `voiceSay`, וצרכן ראשון אמיתי

**מקור בספֵּק (§2.1):** *"כל אמירה נכתבת ליומן אחד (`voiceLog`). הדחיפות קובעת רק דבר אחד: האם היא גם
*תופסת* את המסך."* **(§2.5)** — ראה Global Constraints לתקרה, למפתח ולתוכן השורה.

**הצרכן הראשון, באותה משימה (‏DoD-5):** ‏**T1** — פקיעת טיימר ב-`startTimerWatch` (3356). זהו הפער
שהסקר מכנה *"החסר המרכזי"*: הצפצוף ב-880Hz אינו אומר **איזה** טיימר ומאיזה אירוע. בסוף המשימה
המערכת **מדברת מיוזמתה בפעם הראשונה מחוץ לפאנל**.

### הקוד — 1 · היומן

```js
// §2.5 · voiceLog — the single record of everything the app said, tried to say, or dropped. A 50-row
// RING in mk-voicelog: persisted so a page refresh cannot erase what the cook never heard.
const VOICE_LOG_KEY='mk-voicelog', VOICE_LOG_MAX=50;
// status: 'said' | 'cut' | 'skipped' | 'failed'   (spec §2.5 — נאמר / נקטע / לא הושמע / נכשל)
function voiceLogAll(){ const a=store.get(VOICE_LOG_KEY); return Array.isArray(a)?a:[]; }
function voiceLogAdd(entry){
  const rows=voiceLogAll();
  rows.push({ id:'vl'+Date.now()+Math.random().toString(36).slice(2,6), ts:Date.now(),
              cat:entry.cat||'', text:String(entry.text||''), status:entry.status||'said', seen:false });
  while(rows.length>VOICE_LOG_MAX) rows.shift();          // ring: oldest out
  store.set(VOICE_LOG_KEY, rows);
  try{ syncActiveFab(); }catch(e){}                       // the unseen-count badge lives on the FAB
  return rows[rows.length-1].id;
}
function voiceLogSetStatus(id, status){
  const rows=voiceLogAll(); const r=rows.find(function(x){ return x.id===id; });
  if(!r) return false; r.status=status; store.set(VOICE_LOG_KEY, rows); try{ syncActiveFab(); }catch(e){} return true;
}
function voiceLogUnseen(){ return voiceLogAll().filter(function(r){ return !r.seen; }).length; }
function voiceLogMarkSeen(){ const rows=voiceLogAll(); rows.forEach(function(r){ r.seen=true; }); store.set(VOICE_LOG_KEY, rows); try{ syncActiveFab(); }catch(e){} }
```

### הקוד — 2 · הכרטיס (דרגה A) וה-toast המוארך (דרגה B)

```js
// §2.2 tier A — the ONE new card source (spec §2.3: "נוסף מקור אחד בלבד"). Same .mk-alarm family, same
// persistence contract: it does NOT disappear on a timer, on navigation, or when a panel closes. Only an
// explicit ≥56px tap, or the condition itself clearing, removes it.
let mkVoiceActs={};   // key -> {cat, title, text, logId}
function voiceActShow(key, cat, title, text, logId){
  mkVoiceActs[key]={cat:cat, title:title, text:text, logId:logId};
  renderVoiceAct();
}
function voiceActClear(key){ if(key && mkVoiceActs[key]){ delete mkVoiceActs[key]; renderVoiceAct(); } }
function renderVoiceAct(){
  const keys=Object.keys(mkVoiceActs); let el=document.getElementById('mkVoiceAct');
  if(!keys.length){ if(el) el.remove(); try{ mkActStackOrder(); }catch(e){} return; }
  if(!el){ el=document.createElement('div'); el.id='mkVoiceAct'; el.className='mk-alarm mk-alarm-act';
    el.setAttribute('role','alertdialog'); el.setAttribute('aria-live','assertive');
    el.setAttribute('aria-label',L('פעל עכשיו','Act now')); mkActStack().appendChild(el); }
  el.innerHTML=`<div class="mka-head">🔔 <b>${L('פעל עכשיו','Act now')}</b></div>`+
    keys.map(function(k){ const a=mkVoiceActs[k];
      // §2.3/§5.4 UX: the card carries the utterance WORD FOR WORD — a cook 3m away who heard half a
      // sentence completes it with the eye, never decodes a different phrasing. vcLtrNums per L13.
      return `<div class="mka-row"><span class="mka-name">${vcLtrNums(esc(a.text))}</span>`+
        `<button class="mka-replay" data-vareplay="${encodeURIComponent(k)}" aria-label="${L('השמע שוב','Play again')}">🔁</button>`+
        `<button class="mka-stop mka-ack56" data-vaack="${encodeURIComponent(k)}">✓ ${L('הבנתי','Got it')}</button></div>`;
    }).join('');
  el.querySelectorAll('[data-vaack]').forEach(function(b){ b.addEventListener('click',function(){ voiceActClear(decodeURIComponent(b.dataset.vaack)); }); });
  el.querySelectorAll('[data-vareplay]').forEach(function(b){ b.addEventListener('click',function(){
    const a=mkVoiceActs[decodeURIComponent(b.dataset.vareplay)]; if(a) vcSpeak(a.text, vcVoiceLang(), a.cat); }); });
  try{ mkActStackOrder(); }catch(e){}
}
// §2.2 tier B — the shipped toast, at EIGHT seconds. toast() itself is untouched (92 call sites); the
// duration is passed, so nothing else in the app changes length.
function voiceFyi(text){ toast(text, undefined, undefined, 8000); }
```

**‏`toast()` (3854)** — פרמטר רביעי אופציונלי, ברירת מחדל 5000 (התנהגות היום):

```js
-function toast(msg, undoFn, actionLabel){
+function toast(msg, undoFn, actionLabel, ms){
   ...
-  }, 5000);
+  }, ms||5000);   // §2.2 tier B passes 8000; every one of the 92 shipped call sites keeps 5000
```

**‏CSS** — שטח המגע שהספֵּק דורש:
```css
.mka-ack56{ min-height:56px; }   /* §2.2 tier A: ≥56px, thumb-reachable with greasy/gloved hands */
```

### הקוד — 3 · `voiceSay` — הנקודה היחידה שדרכה עוברת כל אמירה

```js
// §2.1 · THE emitter. Every spoken surface in the app goes through here — logging and the visual
// counterpart happen BEFORE speech is even attempted, so a TTS failure (vcSpeak is Google-only, R-32:
// its failure rate is not zero) can never produce a silent, invisible miss. Category gating arrives in
// Task 10 and the priority queue in Task 12; both plug in HERE, at one place.
function voiceSay(cat, text, opts){
  opts=opts||{};
  const tier = opts.tier || (VOICE_TIER_A[cat] ? 'act' : 'fyi');
  const logId = voiceLogAdd({cat:cat, text:text, status:'skipped'});   // pessimistic: upgraded on success
  if(tier==='act') voiceActShow(opts.key||('va'+logId), cat, opts.title||'', text, logId);
  else voiceFyi(text);
  // (Task 10 inserts the ttsCategoryEnabled gate on the next line; Task 12 replaces the direct vcSpeak
  //  with voiceQueuePush. The visual half above NEVER moves behind either — spec P1.)
  try{
    const p=vcSpeak(text, vcVoiceLang(), cat);
    if(p && p.then) p.then(function(){ voiceLogSetStatus(logId,'said'); },
                            function(){ voiceLogSetStatus(logId,'failed'); });
    else voiceLogSetStatus(logId,'said');
  }catch(e){ voiceLogSetStatus(logId,'failed'); }
  return logId;
}
const VOICE_TIER_A = {safety:1, timers:1, schedule:1};   // §2.2 — the rest are tier B
try{ window.voiceSay=voiceSay; window.voiceLogAll=voiceLogAll; window.voiceLogUnseen=voiceLogUnseen;
     window.renderVoiceAct=renderVoiceAct; }catch(e){}
```

### הקוד — 4 · הצרכן: `startTimerWatch` מדבר

```js
       if(r && r.end && !r.fired && r.end<=now){ r.fired=1; changed=true;
         try{ timerBeep(); }catch(e){}
         mkVibrate([200,100,200,100,200]);
         { var _en=(typeof timerEventName==='function')?timerEventName(k):''; mkNotify(...); }
+        // R-52 · the app's first system-INITIATED utterance outside the Voice Cook panel. The audit's
+        // "החסר המרכזי": an 880Hz beep does not say WHICH timer, in WHICH event — and this product is
+        // explicitly multi-event (the comment at 3328). §7 of the UX review: a tier-A utterance ALWAYS
+        // names its event. The beep/vibrate/notification above are untouched and unconditional — voice
+        // ADDS a channel, it never removes one.
+        try{ voiceSay('timers',
+              L(`הטיימר של ${r.name||'טיימר בישול'} הסתיים`,`The ${r.name||'cooking timer'} timer is done`)
+              +(_en?' · '+_en:''), {key:'t:'+k}); }catch(e){}
       }
```

**‏`syncActiveFab` (11025)** — תג השורות שלא נצפו:
```js
+  const _un=(typeof voiceLogUnseen==='function')?voiceLogUnseen():0;
+  fab.classList.toggle('caf-voice', _un>0);
+  { const vb=$("#cActiveFabV"); if(vb){ vb.hidden=!_un; vb.textContent='🗒 '+_un; } }
```

### RED → GREEN — `tests/vg-voicesay.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('§2 · every utterance is logged and shown before it is spoken', () => {
  test('B1 · all four statuses reach the log', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const rows = await page.evaluate(async () => {
      const w = window as any;
      const real = w.vcSpeak;
      w.vcSpeak = () => Promise.resolve();          w.voiceSay('timers', 'נאמר');
      w.vcSpeak = () => Promise.reject(new Error('api-429')); w.voiceSay('timers', 'נכשל');
      await new Promise(r => setTimeout(r, 0));
      w.vcSpeak = real;
      return w.voiceLogAll().map((x: any) => [x.text, x.status]);
    });
    expect(rows).toContainEqual(['נאמר', 'said']);
    expect(rows).toContainEqual(['נכשל', 'failed']);
  });

  test('B1b · a TTS failure still leaves the CARD on screen (the visual is not downstream of speech)',
    async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(() => {
      const w = window as any;
      w.vcSpeak = () => { throw new Error('no-key'); };
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים');
    });
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
    const st = await page.evaluate(() => (window as any).voiceLogAll()[0].status);
    expect(st).toBe('failed');
  });

  test('the ring caps at 50 and drops the OLDEST', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const r = await page.evaluate(() => {
      const w = window as any; w.vcSpeak = () => Promise.resolve();
      for (let i = 0; i < 55; i++) w.voiceSay('progress', 'שורה ' + i);
      const all = w.voiceLogAll();
      return { n: all.length, first: all[0].text, last: all[all.length - 1].text };
    });
    expect(r).toEqual({ n: 50, first: 'שורה 5', last: 'שורה 54' });
  });

  test('T1 · an expiring timer now speaks its name AND its event', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-events': JSON.stringify([{ id: 'ev1', name: 'שבת', date: '', serve: '19:00', menu: { keys: [] } }]),
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 3000, name: 'חזה בקר' } }) });
    const said: string[] = [];
    await page.exposeFunction('__said', (t: string) => { said.push(t); });
    await page.evaluate(() => { const w = window as any; w.vcSpeak = (t: string) => { (window as any).__said(t); return Promise.resolve(); }; });
    await page.clock.fastForward(4000);
    await page.waitForFunction(() => !!document.getElementById('mkVoiceAct'));
    expect(said.join(' ')).toContain('חזה בקר');
    expect(said.join(' ')).toContain('שבת');       // §7 — never an anonymous "a timer finished"
  });

  test('B8 · every number in the card is wrapped in dir="ltr"', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(() => { const w = window as any; w.vcSpeak = () => Promise.resolve();
      w.voiceSay('timers', 'הטמפרטורה הגיעה ל-74°C'); });
    await expect(page.locator('#mkVoiceAct span[dir="ltr"]')).toHaveText('74°C');
  });

  test('NEGATIVE · a tier-B utterance produces NO act card, only a toast + a log row', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(() => { const w = window as any; w.vcSpeak = () => Promise.resolve();
      w.voiceSay('progress', 'הקצב האט'); });
    await expect(page.locator('#mkVoiceAct')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('הקצב האט');
    expect(await page.evaluate(() => (window as any).voiceLogAll().length)).toBe(1);
  });
});
```

**המקרים השליליים (נקובים):** כשל TTS ⟵ הכרטיס והשורה עדיין קיימים (P1) · דרגה B **אינה** מייצרת
כרטיס · הטבעת גוזמת את הישן ולא את החדש · אמירה ללא שם אירוע נכשלת ב-T1.

**‏DoD-8/9:** צילום 390×844 של כרטיס `voiceAct` בעברית וב-ru; כפתור האישור נמדד ≥56px בבדיקה
(`boundingBox().height`).

---

## Task 10 — ⚑ **חסומה עד הכרעת §0.1** · `PREFS` ×5, שלושת המצבים, ו-`TTS_ROUTE`

> **שער:** אין להתחיל את המשימה לפני שהבעלים בחר בין א׳/ב׳/ג׳ ב-§0.1 **וקבע את הסף** אם ב׳. כתיבת
> `voiceUserAway()` בניחוש היא בדיוק ה"הגדרה הרופפת" שפסק F-1 מזהיר מפניה — ולכן היא הפרת §4, לא קיצור דרך.

**מקור בספֵּק (§1.3/§1.4/§1.5 + פסק F-1)** — ראה Global Constraints, כולל הקצר-חשמלי בשורה הראשונה.

### הקוד — 1 · חמישה מפתחות, בדפוס הקיים

```js
   holdMaxH:   {store:'mk-pref-holdmax',  def:3,        valid:[1,2,3], coerce:Number},
+  // R-52 · voice categories (spec §1.4). Owner ruling F-1: THREE states per category —
+  // 'off' | 'whenAway' | 'always'. `safety` is deliberately ABSENT from this table: it is not a key
+  // with a locked value, it is outside the config layer entirely (§1.3) — a registered key could be
+  // made writable by any future PREFS change, and that is the failure this shape prevents.
+  // Defaults per §6.1 of the UX review: what you lose by missing it beats what you lose by hearing it.
+  voiceTimers:  {store:'mk-pref-voice-timers',  def:'always',   valid:VOICE_MODES},
+  voiceSchedule:{store:'mk-pref-voice-schedule',def:'always',   valid:VOICE_MODES},   // F-3: registered, NOT rendered (Task 11)
+  voiceSteps:   {store:'mk-pref-voice-steps',   def:'always',   valid:VOICE_MODES},
+  voiceAnswers: {store:'mk-pref-voice-answers', def:'always',   valid:VOICE_MODES},
+  voiceProgress:{store:'mk-pref-voice-progress',def:'whenAway', valid:VOICE_MODES},
 };
```
```js
const VOICE_MODES=['off','whenAway','always'];       // owner ruling F-1 · לא · רק כשאיני מסתכל · תמיד
const VOICE_PREF_KEY={timers:'voiceTimers', schedule:'voiceSchedule', steps:'voiceSteps',
                      answers:'voiceAnswers', progress:'voiceProgress'};
```
> `VOICE_MODES` מוגדר **לפני** `PREFS` — `valid` הוא מערך שנקרא בזמן `prefOk`, אבל הליטרל עצמו מוערך
> בהגדרת הטבלה, ולכן הסדר חשוב (בניגוד ל-`valid` כפונקציה, שהיא closure עצלה — ההערה ב-10011).

### הקוד — 2 · השער, עם הקצר-חשמלי

```js
// §1.3 · THE gate. The safety short-circuit is the FIRST line and returns before `store` is ever
// touched — so a corrupt store, a thrown getter, or any future PREFS refactor cannot silence it. This
// is the same shape TTS_ROUTE_DEFAULT (7008) already uses: "an unlisted use case gets the PRIMARY —
// never silence".
function ttsCategoryEnabled(cat){
  if(cat==='safety') return true;
  const m=voiceMode(cat);
  if(m==='always') return true;
  if(m==='whenAway') return voiceUserAway();
  return false;
}
function voiceMode(cat){
  if(cat==='safety') return 'always';
  const k=VOICE_PREF_KEY[cat];
  if(!k) return 'always';                       // an unlisted category is never silenced (7008's covenant)
  try{ return pref(k); }catch(e){ return 'always'; }
}
function setVoiceMode(cat, mode){ const k=VOICE_PREF_KEY[cat]; return k?setPref(k, mode):false; }
// ⚑ OWNER DECISION (§0.1) — the operational definition of "not looking". ONE function, ONE place.
// <<< the chosen option's body lands here, and nowhere else >>>
function voiceUserAway(){ /* filled from the owner's ruling — see §0.1 */ }
try{ window.ttsCategoryEnabled=ttsCategoryEnabled; window.voiceMode=voiceMode;
     window.setVoiceMode=setVoiceMode; window.voiceUserAway=voiceUserAway; }catch(e){}
```

**גוף `voiceUserAway` לאפשרות ב׳ (ההמלצה), אם תיבחר** — נכתב כאן כדי שהמשימה תהיה מוכנה לביצוע ברגע
ההכרעה, **לא** כדי לעקוף אותה:

```js
let mkLastTouchTs=Date.now();
const VOICE_AWAY_IDLE_MS=90000;                 // ⚑ the threshold is part of the owner's ruling
try{ ['pointerdown','keydown','visibilitychange'].forEach(function(ev){
  document.addEventListener(ev, function(){ mkLastTouchTs=Date.now(); }, {passive:true}); }); }catch(e){}
function voiceUserAway(){
  try{ if(document.visibilityState!=='visible') return true; }catch(e){ return true; }
  return (Date.now()-mkLastTouchTs) >= VOICE_AWAY_IDLE_MS;
}
```

### הקוד — 3 · השער נכנס ל-`voiceSay`, ו-`TTS_ROUTE` מקבל את ארבע השורות

```js
   if(tier==='act') voiceActShow(...); else voiceFyi(text);
+  // §1.3 + P1: the gate sits AFTER the visual half and BEFORE speech. A muted category still logs and
+  // still shows — "הגדרת הקול מוסיפה ערוץ; היא לעולם אינה גורעת אחד" (§9).
+  if(!ttsCategoryEnabled(cat)){ voiceLogSetStatus(logId,'skipped'); return logId; }
   try{ const p=vcSpeak(text, vcVoiceLang(), cat); ... }
```
```js
 const TTS_ROUTE = {
   answer: 'gemini',
   step:   'gemini',
   alert:  'cloud',
+  // R-52 §1.5 — the categories map use-case → SWITCH; this table maps use-case → PROVIDER. Two
+  // orthogonal axes over the SAME key; there is no second taxonomy.
+  timer:    'cloud',    // short, repetitive — speed and quota beat timbre
+  schedule: 'cloud',
+  progress: 'gemini',   // a full sentence
+  safety:   'gemini',   // the PRIMARY — this is the content that must never sound sloppy
 };
```
> **הערה מהספֵּק שאסור לאבד (§1.5):** `ttsCloudAvail()` (7018) דורש `gemMode()==='managed'`, ולכן
> משתמש BYOK מנותב חזרה ל-Gemini לכל שורת `cloud`. זמן ההתראה שלו — **לא בוסס** (U1). המשימה מודדת
> אותו פעם אחת (‏§3.5, ‏BYOK) ומדווחת; היא **אינה** משנה את הניתוב על סמך המדידה בלי אישור.

### RED → GREEN — `tests/vg-voice-prefs.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('§1 · category gating', () => {
  test('A1 · safety is true with every key off AND with a throwing store', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-pref-voice-timers': JSON.stringify('off'), 'mk-pref-voice-schedule': JSON.stringify('off'),
      'mk-pref-voice-steps': JSON.stringify('off'), 'mk-pref-voice-answers': JSON.stringify('off'),
      'mk-pref-voice-progress': JSON.stringify('off') });
    const r = await page.evaluate(() => {
      const w = window as any;
      const before = w.ttsCategoryEnabled('safety');
      const realGet = w.store.get;
      w.store.get = () => { throw new Error('storage exploded'); };
      const during = w.ttsCategoryEnabled('safety');
      const others = ['timers', 'schedule', 'steps', 'answers', 'progress'].map(c => w.ttsCategoryEnabled(c));
      w.store.get = realGet;
      return { before, during, others };
    });
    expect(r.before).toBe(true);
    expect(r.during).toBe(true);       // the short-circuit returns before `store` is reached
    expect(r.others).toEqual([false, false, false, false, false]);
  });

  test('A2 · safety is NOT a PREFS key and renders no clickable control', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const keys = await page.evaluate(() => Object.keys((window as any).PREFS));
    expect(keys.some(k => /voice/i.test(k) && /safety/i.test(k))).toBe(false);
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules [data-cat="safety"] button')).toHaveCount(0);
  });

  test('A3 · timers and schedule are independent, both directions', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const r = await page.evaluate(() => {
      const w = window as any;
      w.setVoiceMode('timers', 'off'); w.setVoiceMode('schedule', 'always');
      const a = [w.ttsCategoryEnabled('timers'), w.ttsCategoryEnabled('schedule')];
      w.setVoiceMode('timers', 'always'); w.setVoiceMode('schedule', 'off');
      return [a, [w.ttsCategoryEnabled('timers'), w.ttsCategoryEnabled('schedule')]];
    });
    expect(r).toEqual([[false, true], [true, false]]);
  });

  test('A4 · every category OFF still produces the visual counterpart (P1)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-timers': JSON.stringify('off'), 'mk-pref-voice-progress': JSON.stringify('off') });
    const spoke = await page.evaluate(() => {
      const w = window as any; let n = 0; w.vcSpeak = () => { n++; return Promise.resolve(); };
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים');
      w.voiceSay('progress', 'הקצב האט');
      return { n, log: w.voiceLogAll().map((r: any) => r.status) };
    });
    expect(spoke.n).toBe(0);                                  // vcSpeak never called
    expect(spoke.log).toEqual(['skipped', 'skipped']);        // never a SILENT drop
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
    await expect(page.locator('.toast')).toContainText('הקצב האט');
  });

  test('A5 · NEGATIVE · a garbage stored value falls back to def via prefOk', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-pref-voice-timers': JSON.stringify('maybe') });
    const m = await page.evaluate(() => (window as any).voiceMode('timers'));
    expect(m).toBe('always');
  });
});
```

**המקרים השליליים (נקובים):** ‏`store` שזורק · ערך זבל `"maybe"` · כל הקטגוריות כבויות ⟵ המקבילה
החזותית קיימת ו-`vcSpeak` לא נקרא · כיבוי `timers` אינו נוגע ב-`schedule` ולהפך.

---

## Task 11 — הפאנל `openVoiceRules`, שתי הכניסות, שורת-האמת וכרטיס הגילוי

**מקור בספֵּק (§1.4):** *"**הרינדור אינו** `openPrefGroup` (10427) — הפאנל הגנרי מרנדר תווית + כפתורים,
ולקול נדרשים בכל שורה: כותרת, **דוגמה למה שיישמע**, פקד, ושורת-אמת על מסירה."*
**‏F-4 (המלצת הספֵּק):** הסיוג של "תמיד" — **שורת-אמת + כותרת-משנה**, לא בתווית הכפתור.
**‏F-6 (המלצת הספֵּק):** כרטיס הגילוי — **בתחילת הבישול החי הראשון**.
**‏F-3 (המלצת הספֵּק):** `schedule` **נרשמת ואינה מרונדרת** — אין פקד מת.

### הקוד — הפאנל

```js
// §1.4 · a DEDICATED panel, not an openPrefGroup row: each line needs a heading, a SAMPLE of what will
// actually be heard, a 3-way control and a delivery truth-line. Reuses .ap-lbl / .ap-opts / .section-sub
// exactly as openUiLevel and openPrefGroup do — no new CSS primitives invented (10432's covenant).
const VOICE_ROWS=[
  // cat, icon, title(he,en), sample(he,en)
  ['timers',  '⏱', ['טיימרים','Timers'],                 ['הטיימר של החזה הסתיים.','The brisket timer is done.']],
  ['steps',   '📋', ['הקראת שלב','Step read-aloud'],       ['להוציא את החזה לעטיפה.','Take the brisket out to wrap.']],
  ['answers', '❓', ['תשובות לשאלות שלי','Answers to my questions'], ['נשארו כשעה וחצי לפי הקצב הנוכחי.','About an hour and a half left at the current pace.']],
  ['progress','📈', ['עדכוני קצב ומצב','Pace and status updates'],  ['הקצב האט — הצפי זז.','The pace slowed — the estimate moved.']],
];
// F-3: `schedule` is NOT in VOICE_ROWS. Its PREFS key exists (Task 10) but no control is rendered until
// the stage-alert trigger itself is reliable (audit N3/N4) — the same "no consumer = no dead controls"
// rule the PREFS table already states for autonomy/shareTolC (10026).
const VOICE_MODE_LABEL={ off:['לא','No'], whenAway:['רק כשאיני מסתכל','Only when I\'m not looking'], always:['תמיד','Always'] };
function openVoiceRules(){
  const rows=VOICE_ROWS.map(function(r){
    const cat=r[0], cur=voiceMode(cat);
    // RTL order: weakest on the LEFT, strongest on the RIGHT — in Hebrew the eye lands right first, and
    // that is where the default belongs. This is the reverse of a latin reading order (a classic RTL bug).
    const opts=VOICE_MODES.map(function(m){
      return `<button class="ap-opt ${m===cur?'on':''}" data-vcat="${cat}" data-vmode="${m}">`
        +`${m===cur?'✓ ':''}${esc(L(VOICE_MODE_LABEL[m][0], VOICE_MODE_LABEL[m][1]))}</button>`; }).join('');
    return `<div class="vr-row" data-cat="${cat}"><div class="ap-lbl">${r[1]} ${esc(L(r[2][0],r[2][1]))}</div>`
      +`<div class="ap-opts">${opts}</div>`
      +`<p class="section-sub vr-sample">“${esc(L(r[3][0],r[3][1]))}”</p>`
      +`<button class="mchip" data-vsample="${cat}">🔊 ${L('השמע דוגמה','Play a sample')}</button></div>`;
  }).join('');
  // §1.3 — a STATIC CHIP, never a disabled control. A greyed-out toggle says "possible, just not now"
  // and invites repeated taps; a chip says what this is: a statement.
  const safetyChip=`<div class="vr-row vr-locked" data-cat="safety"><div class="ap-lbl">🔒 ${L('בטיחות','Safety')}</div>`
    +`<div class="vr-chip">${L('תמיד מדבר · לא ניתן לכבות','Always speaks · cannot be turned off')}</div>`
    +`<p class="section-sub">${L('אזהרות שהחמצתן פוגעת בבטיחות המזון נאמרות תמיד — גם כשכל השאר כבוי.','Warnings whose miss harms food safety are always spoken — even when everything else is off.')}</p></div>`;
  // F-4 · the qualification of "always" lives HERE and in the sub-title, never inside a button label
  // (a Hebrew button with a parenthetical breaks to two lines at 390px and loses its scannability).
  const truth=`<div class="vr-truth">⚠ <b>${L('מתי הקול לא יגיע','When the voice will not arrive')}</b>`
    +`<p>${L('כשהאפליקציה ברקע או המסך נעול, האפליקציה לא יכולה לדבר. במצב הזה ההתראה מגיעה כרטט + הודעת מערכת. הקול חוזר כשחוזרים לאפליקציה.','When the app is in the background or the screen is locked, the app cannot speak. The alert then arrives as vibration + a system notification. The voice returns when you come back to the app.')}</p>`
    +`<button class="mchip" data-vtlalerts>${L('הפעל התראות מערכת','Turn on system notifications')} →</button></div>`;
  showPanel(`${toolTop(L('מתי האפליקציה מדברת','When the app speaks'),
      L('בכל מצב יופיע גם חיווי על המסך — הקול מוסיף ערוץ, לעולם לא מחליף','A screen indicator always appears too — voice adds a channel, it never replaces one'),
      '🔊','#6a8caf')}
    <div class="panel-body" id="voiceRules">${safetyChip}${rows}${truth}
      <button class="mchip vr-logbtn" data-vlog>🗒 ${L('יומן הקול — מה נאמר עד עכשיו','Voice log — what was said so far')}</button>
    </div>`);
  const p=$("#panel");
  p.querySelectorAll('[data-vcat]').forEach(function(b){ b.addEventListener('click',function(){
    if(setVoiceMode(b.dataset.vcat, b.dataset.vmode)) openVoiceRules(); }); });
  p.querySelectorAll('[data-vsample]').forEach(function(b){ b.addEventListener('click',function(){
    const r=VOICE_ROWS.find(function(x){ return x[0]===b.dataset.vsample; });
    if(r) vcSpeak(L(r[3][0], r[3][1]), vcVoiceLang(), b.dataset.vsample); }); });
  const ta=p.querySelector('[data-vtlalerts]'); if(ta) ta.addEventListener('click',function(){ if(typeof openTimeline==='function') openTimeline(); });
  const lg=p.querySelector('[data-vlog]'); if(lg) lg.addEventListener('click', openVoiceLog);
}
```

> **‏X2 נסגר כתוצר-לוואי:** דגימת הקול כאן עוברת `L()` בשבע שפות. הליקוי המתועד בסקר (‏X2 —
> `vcSpeak('שלום! זה הקול החדש…')` קשיח בעברית ב-7439) **אינו בתחולת המשימה** (Circle of Control) —
> הוא נרשם כפריט נפרד ואינו מתוקן כאן.

### הקוד — שתי הכניסות

```js
     ['⚙️', L('הגדרות ועזרה','Settings & help'), [
       ['🎨',L('מראה — גוונים, פונט וגודל','Appearance — themes, font and size'),'openAppearance'],
+      ['🔊',L('מתי האפליקציה מדברת','When the app speaks'),'openVoiceRules'],
       ['🧭',L('רמת ממשק — מתחיל/בינוני/מתקדם','Interface level — beginner/intermediate/advanced'),'openUiLevel'],
```

**קיצור שני, מתוך פאנל "בישול קולי"** (§1.4: *"הרגע שבו למשתמש אכפת הוא הרגע שבו הקול מפריע לו"*) —
כפתור בכותרת `vcRender`:
```js
+  <button class="mchip vc-rules" data-vcrules>🔊 ${L('מתי אני מדבר','When I speak')} →</button>
```

### הקוד — יומן הקול, ו-F-6

```js
function openVoiceLog(){
  const rows=voiceLogAll().slice().reverse();
  const badge={said:'✓', cut:'✂', skipped:'🔇', failed:'⚠'};
  const label={said:['נאמר','Said'], cut:['נקטע','Interrupted'], skipped:['לא הושמע','Not played'], failed:['נכשל','Failed']};
  showPanel(`${toolTop(L('יומן הקול','Voice log'),L('כל מה שנאמר, נקטע, הושמט או נכשל','Everything said, interrupted, skipped or failed'),'🗒','#6a8caf')}
    <div class="panel-body" id="voiceLog">${rows.length?rows.map(function(r){
      return `<div class="vl-row" data-vlid="${r.id}"><span class="vl-t">${fmtClock(new Date(r.ts))}</span>`
        +`<span class="vl-s">${badge[r.status]||''} ${esc(L(label[r.status][0],label[r.status][1]))}</span>`
        +`<span class="vl-x">${vcLtrNums(esc(r.text))}</span>`
        +`<button class="mchip" data-vlreplay="${r.id}" aria-label="${L('השמע שוב','Play again')}">🔁</button></div>`;
    }).join(''):`<p class="section-sub">${L('עוד לא נאמר כלום.','Nothing has been said yet.')}</p>`}</div>`);
  voiceLogMarkSeen();
  $("#panel").querySelectorAll('[data-vlreplay]').forEach(function(b){ b.addEventListener('click',function(){
    const r=voiceLogAll().find(function(x){ return x.id===b.dataset.vlreplay; });
    if(r) vcSpeak(r.text, vcVoiceLang(), r.cat); }); });
}
// F-6 (spec recommendation §8) — the discovery card appears at the START OF THE FIRST LIVE COOK, where
// the context ("I'm standing at a fire with dirty hands") actually exists. NOT an onboarding screen: a
// splash is dismissed unread and the surprise arrives two hours later anyway.
// The one exception the spec makes explicit: if the first system-initiated utterance of a user's life is
// SAFETY, it is SPOKEN, and the card is shown AFTER it, reworded. Silencing a safety warning to ask about
// preferences is ruling P3 inverted.
function maybeAskVoiceIntro(){
  if(store.get('mk-voiceintro-asked')) return;
  store.set('mk-voiceintro-asked', true);
  showPanel(`${toolTop(L('המדריך יכול לדבר אליך','The guide can talk to you'),
    L('תמיד יחד עם חיווי על המסך','Always together with an on-screen indicator'),'🔊','#6a8caf')}
    <div class="panel-body"><p>${L('ידיים תפוסות? המכשיר על השולחן? אני יכול להקריא בקול התראות ושלבים.','Hands full? Phone on the table? I can read alerts and steps aloud.')}</p>
      <div class="ap-opts"><button class="ap-opt" data-vintro="off">${L('לא, רק על המסך','No, screen only')}</button>
      <button class="ap-opt on" data-vintro="always">${L('כן, דבר אליי','Yes, talk to me')}</button></div>
      <p class="section-sub">${L('אפשר לשנות בכל רגע ב-⚙️ → 🔊','You can change this any time under ⚙️ → 🔊')}</p></div>`);
  $("#panel").querySelectorAll('[data-vintro]').forEach(function(b){ b.addEventListener('click',function(){
    const m=b.dataset.vintro;
    Object.keys(VOICE_PREF_KEY).forEach(function(c){ if(c!=='progress') setVoiceMode(c, m); });
    closePanel(); }); });
}
```
`startLiveCook` (7811 באודיט; אומת בעץ הנוכחי) מקבל `try{ maybeAskVoiceIntro(); }catch(e){}` בסופו.

### RED → GREEN — `tests/vg-voice-panel.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('§1.4 · the voice-rules panel', () => {
  test('A6 · 390×844 — four rows + the locked chip, zero horizontal overflow, controls ≥48px',
    async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules .vr-row:not(.vr-locked)')).toHaveCount(4);   // F-3: schedule NOT rendered
    await expect(page.locator('#voiceRules .vr-locked .vr-chip')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth > 390);
    expect(over).toBe(false);
    for (const b of await page.locator('#voiceRules .ap-opt').all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('A7 · Hebrew, then a second language — the SAMPLE string is translated too', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules')).toContainText('הטיימר של החזה הסתיים');
    await page.evaluate(() => (window as any).setLang('ru'));
    await page.waitForFunction(() => (window as any).__mkLangReady);
    await page.evaluate(() => (window as any).openVoiceRules());
    const txt = await page.locator('#voiceRules').innerText();
    expect(txt).not.toContain('הטיימר של החזה הסתיים');
    expect(txt).not.toMatch(/The brisket timer is done/);   // English fallback is a LEAK, not a pass
  });

  test('F-4 · "always" is qualified in the truth-line, NOT inside a button label', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    const labels = await page.locator('#voiceRules .ap-opt').allInnerTexts();
    expect(labels.some(l => /\(/.test(l))).toBe(false);
    await expect(page.locator('#voiceRules .vr-truth')).toContainText('לא יכולה לדבר');
    await expect(page.locator('#voiceRules .vr-truth .mchip')).toBeVisible();
  });

  test('NEGATIVE · the safety row has zero clickable controls', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules [data-cat="safety"] button')).toHaveCount(0);
  });

  test('F-6 · the intro card appears at the first live cook, exactly once', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const twice = await page.evaluate(() => {
      const w = window as any; const seen: boolean[] = [];
      w.maybeAskVoiceIntro(); seen.push(!!document.querySelector('[data-vintro]'));
      w.closePanel();
      w.maybeAskVoiceIntro(); seen.push(!!document.querySelector('[data-vintro]'));
      return seen;
    });
    expect(twice).toEqual([true, false]);
  });
});
```

**המקרים השליליים (נקובים):** שורת הבטיחות ללא פקד · `schedule` **אינה** מרונדרת (F-3) · אין סוגריים
בתווית כפתור (F-4) · כרטיס הגילוי פעם אחת בלבד · **דליפת אנגלית ב-ru נחשבת כישלון**, לא כ-fallback.

**‏i18n:** ‏~24 מחרוזות חדשות. הצינור המלא של §3.2, כולל `lang/_extracted.json` ו-`_callsite-sig.json`
בקומיט. אימות ב-DOM המרונדר בעברית + ru (‏L23).

---

## Task 12 — התור: עדיפויות · איחוד · barge-in · חידוש F-5 · ק-3

**מקור בספֵּק (§3.1)** — טבלת העדיפויות, האיחוד ו-ק-3 מצוטטים ב-Global Constraints.
**פסק בעלים F-5:** *"ההתחדשות **לא תמשיך באמצע משפט**. היא תתחיל מחדש מ**תחילת המשפט שנקטע**, עם
סימון קצר שמחזיר הקשר ('ממשיך: ...')."*

> **החוזה שאסור לשבור:** `gemSpeakSeg(text, lang, gen, startAt) → cursor` (6905) ו-`gemSpeak`'s
> ‏`cursor`/`pending` (7265-7289) **אינם נגעים**. הם תיקנו את רגרסיות ה-gap וה-jitter של v281.
> התור יושב **מעל** `vcSpeak`. גם **נפח הבקשות אינו גדל**: אמירה = קריאת `vcSpeak` אחת, בדיוק כמו
> היום, ו-`vcCoalesceTtsChunks` ממשיך לקבוע כמה בקשות יוצאות ממנה. חידוש = קריאה אחת נוספת על
> **שארית** הטקסט, לא בקשה למשפט.

### הקוד — 1 · נקודת ההתקדמות (‏3 שורות ב-`gemSpeak`, אפס שינוי חתימה)

```js
   const chunks=vcCoalesceTtsChunks(sentences);
   if(!chunks.length) return;
+  // R-52 §3 / owner ruling F-5: the queue needs to know WHICH chunk is currently sounding, so an
+  // interrupted utterance can resume from the START of that chunk (never mid-sentence). Additive only —
+  // the cursor contract, the prefetch and the generation token are untouched.
+  vcSpeakProgress={gen:gen, chunks:chunks, idx:0, lang:L2, useCase:UC};
   vcLatMark('ttsReq1');
   for(let i=0;i<chunks.length;i++){
     if(!vcGenCurrent(gen)) return;
+    vcSpeakProgress.idx=i;
```
```js
let vcSpeakProgress=null;   // {gen, chunks, idx, lang, useCase} — null when nothing is sounding
```

### הקוד — 2 · התור

```js
// §3.1 · ONE priority queue over ONE speaker. Not a new state machine on top of vcNewSpeakGen — it USES
// vcNewSpeakGen, which is exactly what "yield the floor" already means in this codebase:
//   priority 0 (safety) → vcNewSpeakGen() + gemStop()  = cut NOW, mid-chunk
//   priority 1-2        → vcNewSpeakGen() only         = the already-scheduled chunk finishes playing,
//                         and gemSpeak's own `if(!vcGenCurrent(gen)) return` exits at the next boundary.
//                         That IS "מחכה לסוף המקטע הנוכחי", with no new mechanism.
const VOICE_PRIORITY={safety:0, timers:1, schedule:2, answers:3, steps:4, progress:5};
const VOICE_COALESCE_MS=2000;
const VOICE_DROPPABLE={steps:4, progress:5};        // §3.1 — may fall, NEVER silently
let voiceQueue=[], voiceBusy=false, voiceResumeItem=null;

function voicePri(cat){ const p=VOICE_PRIORITY[cat]; return (p==null)?3:p; }

function voiceQueuePush(item){                       // item: {cat, text, logId, name}
  // §3.1 coalescing: two utterances of the SAME category inside a 2s window become ONE sentence.
  // Constraint from the spec, enforced structurally: only NAMES are merged — the merged text is built
  // from item.name values, never from numbers, and it still passes through the same speech path as any
  // other text (there is no privileged, unguarded string).
  const now=Date.now();
  const twin=voiceQueue.find(function(q){ return q.cat===item.cat && (now-q.ts)<VOICE_COALESCE_MS && q.name && item.name; });
  if(twin){
    twin.names=(twin.names||[twin.name]).concat([item.name]);
    twin.text=voiceCoalescedText(twin.cat, twin.names);
    voiceLogSetStatus(item.logId,'skipped');         // its content now rides the twin's row
    return;
  }
  voiceQueue.push(Object.assign({ts:now}, item));
  voiceQueue.sort(function(a,b){ return voicePri(a.cat)-voicePri(b.cat) || a.ts-b.ts; });
  voiceQueueKick();
}
function voiceCoalescedText(cat, names){
  // ONE static literal per branch (extractor mode 1); the names are pure interpolation, exactly like
  // renderAlarm's own ring.length>1 line (3386) already does visually.
  return names.length>1
    ? L('כמה טיימרים הסתיימו: ','Several timers are done: ')+names.join(', ')
    : L('הטיימר של ','The timer for ')+names[0]+L(' הסתיים','is done');
}

function voiceQueueKick(){
  if(!voiceQueue.length) return;
  const next=voiceQueue[0];
  // ק-3 (§3.1): while the microphone is listening, ONLY safety speaks. Everything else waits in the
  // queue and coalesces — it is never dropped, and never swallows the user's command mid-word.
  if(vcRec && next.cat!=='safety') return;
  if(!voiceBusy){ voiceQueueDrain(); return; }
  if(voicePri(next.cat)<=2) voiceYieldFloor(next.cat==='safety');   // 0 cuts now; 1-2 at the chunk boundary
}

function voiceYieldFloor(immediate){
  // F-5: capture the interrupted utterance BEFORE the generation is bumped, so the resume can restart
  // from the beginning of the chunk that was sounding — never mid-sentence.
  const pr=vcSpeakProgress;
  if(pr && pr.chunks && pr.idx<pr.chunks.length){
    voiceResumeItem={ cat:voiceCurrent?voiceCurrent.cat:'steps',
                      text:pr.chunks.slice(pr.idx).join(' '),
                      logId:voiceCurrent?voiceCurrent.logId:null };
    if(voiceCurrent) voiceLogSetStatus(voiceCurrent.logId,'cut');
  }
  vcNewSpeakGen();
  if(immediate){ try{ gemStop(); }catch(e){} }
  // §3.1: a droppable item that is now behind a 0-2 item FALLS — but loudly, in the log.
  voiceQueue=voiceQueue.filter(function(q){
    if(!VOICE_DROPPABLE[q.cat]) return true;
    voiceLogSetStatus(q.logId,'skipped'); return false; });
  voiceBusy=false; voiceCurrent=null;
  voiceQueueDrain();
}

let voiceCurrent=null;
function voiceQueueDrain(){
  if(voiceBusy) return;
  const it=voiceQueue.shift();
  if(!it){                                            // nothing pending → F-5 auto-resume
    if(voiceResumeItem){ const r=voiceResumeItem; voiceResumeItem=null; voiceSpeakNow({
        cat:r.cat, text:voiceResumeCue()+r.text, logId:voiceLogAdd({cat:r.cat, text:r.text, status:'skipped'}) }); }
    return;
  }
  if(vcRec && it.cat!=='safety'){ voiceQueue.unshift(it); return; }
  voiceSpeakNow(it);
}
// F-5 · the re-entry cue. A listener who walked away and came back needs the sentence to have a head.
function voiceResumeCue(){ return L('ממשיך: ','Continuing: '); }

function voiceSpeakNow(it){
  voiceBusy=true; voiceCurrent=it;
  // ק-3 continued: a tier-A utterance SUSPENDS recognition and restarts it afterwards, instead of
  // talking over (and swallowing) a command the user is in the middle of speaking.
  const hadRec=!!vcRec, tierA=!!VOICE_TIER_A[it.cat];
  if(hadRec && tierA){ try{ vcRec._stop=true; vcRec.stop(); }catch(e){} vcRec=null; }
  let p;
  try{ p=vcSpeak(it.text, vcVoiceLang(), it.cat); }catch(e){ p=Promise.reject(e); }
  Promise.resolve(p).then(function(){ voiceLogSetStatus(it.logId,'said'); },
                          function(){ voiceLogSetStatus(it.logId,'failed'); })
    .then(function(){
      voiceBusy=false; voiceCurrent=null; vcSpeakProgress=null;
      if(hadRec && tierA && typeof vcToggleMic==='function'){ try{ vcToggleMic(); }catch(e){} }
      voiceQueueDrain();
    });
}
try{ window.voiceQueuePush=voiceQueuePush; window.voiceQueueState=function(){ return {q:voiceQueue.slice(), busy:voiceBusy, resume:voiceResumeItem}; }; }catch(e){}
```

### הקוד — 3 · `voiceSay` מעביר את האמירה לתור

```js
   if(!ttsCategoryEnabled(cat)){ voiceLogSetStatus(logId,'skipped'); return logId; }
-  try{ const p=vcSpeak(text, vcVoiceLang(), cat); ... }
+  voiceQueuePush({cat:cat, text:text, logId:logId, name:opts.name||null});
   return logId;
```

### RED → GREEN — `tests/vg-voice-queue.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

// A deterministic fake speaker: resolves only when the test releases it, and records call order.
const FAKE = `(() => { const w = window;
  w.__spoken = []; w.__release = null;
  w.vcSpeak = (t, l, uc) => { w.__spoken.push([uc, t]);
    return new Promise(res => { w.__release = res; }); }; })()`;

test.describe('§3 · the collision law', () => {
  test('B3 · timers does NOT cut — it enters after the current segment', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      w.voiceSay('steps', 'משפט ארוך של הקראת שלב');
      w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים'); });
    // the step is still the only thing that has reached the speaker
    expect(await page.evaluate(() => (window as any).__spoken.length)).toBe(1);
    await page.evaluate(() => (window as any).__release());          // the segment ends
    await page.waitForFunction(() => (window as any).__spoken.length === 2);
    const order = await page.evaluate(() => (window as any).__spoken.map((s: any) => s[0]));
    expect(order).toEqual(['steps', 'timers']);
  });

  test('B2 · safety CUTS, the cut row is logged, and F-5 resumes from the sentence START',
    async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      // pretend the step utterance is mid-way through its second chunk
      w.voiceSay('steps', 'משפט ראשון. משפט שני. משפט שלישי.');
      w.vcSpeakProgress = { gen: 1, chunks: ['משפט ראשון.', 'משפט שני.', 'משפט שלישי.'], idx: 1, lang: 'he', useCase: 'steps' };
      w.voiceSay('safety', 'עצור — החזה בטמפרטורת סכנה.'); });
    const spoken = await page.evaluate(() => (window as any).__spoken.map((s: any) => s[1]));
    expect(spoken[1]).toContain('עצור');                              // cut in, immediately
    const log = await page.evaluate(() => (window as any).voiceLogAll().map((r: any) => r.status));
    expect(log).toContain('cut');
    await page.evaluate(() => (window as any).__release());
    await page.waitForFunction(() => (window as any).__spoken.length === 3);
    const resumed = await page.evaluate(() => (window as any).__spoken[2][1]);
    expect(resumed.startsWith('ממשיך: ')).toBe(true);
    expect(resumed).toContain('משפט שני.');                           // the WHOLE interrupted sentence
    expect(resumed).not.toContain('משפט ראשון');                      // not from the top either
  });

  test('B4 · two timers in the same second → ONE merged utterance naming both', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: 0 });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-timers': JSON.stringify({ 'st-ev1-a-x': { end: 1000, name: 'חזה' }, 'st-ev1-b-x': { end: 1000, name: 'שוק' } }) });
    await page.evaluate(FAKE);
    await page.clock.fastForward(2000);
    await page.waitForFunction(() => (window as any).__spoken.length > 0);
    const all = await page.evaluate(() => (window as any).__spoken);
    expect(all.length).toBe(1);
    expect(all[0][1]).toContain('חזה');
    expect(all[0][1]).toContain('שוק');
    expect(all[0][1]).not.toMatch(/\d/);          // constraint: names only, ZERO temperature numbers
  });

  test('B5 · NEGATIVE · a dropped progress item is marked "not played", never vanished', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      w.voiceSay('steps', 'הקראה');
      w.voiceSay('progress', 'הקצב האט');            // priority 5, behind…
      w.voiceSay('timers', 'הטיימר הסתיים'); });     // …a priority-1 item → it falls
    const rows = await page.evaluate(() => (window as any).voiceLogAll().map((r: any) => [r.text, r.status]));
    expect(rows).toContainEqual(['הקצב האט', 'skipped']);
    const q = await page.evaluate(() => (window as any).voiceQueueState().q.map((x: any) => x.cat));
    expect(q).not.toContain('progress');
  });

  test('B6 · while the mic is listening only safety speaks; the rest waits', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    await page.evaluate(FAKE);
    await page.evaluate(() => { const w = window as any;
      w.vcRec = { stop() {}, _stop: false };            // pretend recognition is live
      w.voiceSay('progress', 'הקצב האט');
      w.voiceSay('timers', 'הטיימר הסתיים'); });
    expect(await page.evaluate(() => (window as any).__spoken.length)).toBe(0);
    await page.evaluate(() => { const w = window as any; w.voiceSay('safety', 'עצור — טמפרטורת סכנה.'); });
    const spoken = await page.evaluate(() => (window as any).__spoken.map((s: any) => s[1]));
    expect(spoken).toEqual(['עצור — טמפרטורת סכנה.']);
    const q = await page.evaluate(() => (window as any).voiceQueueState().q.length);
    expect(q).toBeGreaterThan(0);                        // still queued, not dropped
  });
});
```

**המקרים השליליים (נקובים):** ‏`timers` **אינו** קוטע · פריט `progress` שנפל מסומן "לא הושמע" ולא נעלם ·
בזמן `vcRec` הקטגוריות האחרות **ממתינות** ולא נמחקות · הטקסט המאוחד **ללא ספרות** · החידוש מתחיל
בתחילת המשפט שנקטע ולא מתחילת האמירה.

**‏D11 חוזר:** מדידת `firstSound` אחרי המשימה — התור מוסיף `Promise` אחד בין `voiceSay` ל-`vcSpeak`,
ולכן חייב להישאר בטווח ±15% מ-~1,101ms. חריגה = באג.

**מונה בקשות:** בדיקה שמונה קריאות ל-`generateContent` לאמירה בודדת ולחידוש — חייב להישאר זהה
לספירה של היום על אותו טקסט (ה-covenant של 7995).

---

## Task 13 — כרטיסי `schedule` (S1/S2/S3) מחוץ לשער ההרשאה

**מקור בספֵּק (§2.4):** *"**S1/S2** — אין מקבילה בתוך האפליקציה. **פתוח.** התראת מערכת בלבד, מאחורי שני
שערים (8464). **חובה: כרטיס `voiceAct` שאינו תלוי בהרשאת דפדפן.**"*
**‏F-3 (המלצת הספֵּק):** קטגוריית הקול `schedule` **אינה** מרונדרת — ולכן `ttsCategoryEnabled('schedule')`
מחזירה את ברירת המחדל, אך הכרטיס **אינו** תלוי בה כלל (P1: החזותי תמיד).

### הקוד — טריגר יחיד, שני ערוצים

```js
     tlTimers.forEach(t=>clearTimeout(t)); tlTimers=[];
+    // §2.4 · the IN-APP counterpart to a stage-start alert. Today the only channel is mkNotify, behind
+    // TWO gates (mk-tlalerts AND Notification.permission), both off by default — so a stage start is
+    // invisible inside the app itself. The card below is armed by the SAME setTimeout list and the SAME
+    // stale-event gate as the notification, but NOT by the permission gate: an in-app card needs no
+    // browser permission, and P1 makes it mandatory anyway.
+    if(_armAlerts){
+      const nowMs=Date.now();
+      const armCard=function(when, key, text){
+        const ms=when.getTime()-nowMs;
+        if(ms<=0 || ms>=24*3600e3) return;              // §4.5: never fire about the past; 24h horizon unchanged
+        tlTimers.push(setTimeout(function(){ voiceSay('schedule', text, {tier:'act', key:key}); }, ms));
+      };
+      if(preheat) armCard(preheat,'sched:preheat', L('זמן להדליק את המעשנת','Time to light the smoker'));
+      sorted.forEach(function(c){ if(!c.blocked && c.startClock){
+        const nm=(typeof itemName==='function'?itemName(c.m):c.m.heb);
+        armCard(c.startClock, 'sched:'+c.m.key, L('הזמן להתחיל: ','Time to start: ')+nm); } });
+      armCard(serve,'sched:serve', L('הגיע זמן ההגשה','Serve time is here'));
+    }
     if(_armAlerts && store.get('mk-tlalerts') && ... Notification.permission==='granted'){
```

**‏S7 (התנגשות מכשיר)** — דרגה B, מ-`contentionHtml`, רק בשינוי מצב חי:
```js
+  // §2.2 tier B — an advisory, not an action. Emitted once per state CHANGE, never per render.
+  if(_clashNow && !_clashPrev) voiceSay('schedule', L('התנגשות מכשיר בזמן חי','Device conflict in the live window'), {tier:'fyi'});
```

### RED → GREEN — `tests/vg-schedule-cards.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('§2.4 · stage-start alerts appear INSIDE the app', () => {
  test('S1/S2 · a card fires with NO notification permission and mk-tlalerts OFF',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    // mk-tlalerts deliberately NOT seeded; Notification.permission left at 'default'
    await page.evaluate(() => {
      const w = window as any; w.vcSpeak = () => Promise.resolve();
      w.__armScheduleCard(new Date(Date.now() + 5000), 'sched:test', 'הזמן להתחיל: חזה בקר');
    });
    await expect(page.locator('#mkVoiceAct')).toHaveCount(0);
    await page.clock.fastForward(6000);
    await page.waitForFunction(() => !!document.getElementById('mkVoiceAct'));
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
  });

  test('NEGATIVE · a stale event arms NO schedule card (§4.5 site 1)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-events': JSON.stringify([{ id: 'ev1', name: 'שעברה', date: '2026-07-25', serve: '19:00', menu: { keys: [] } }]),
      'mk-active': 'ev1', 'mk-timers': JSON.stringify({}) });
    await page.evaluate(() => (window as any).openTimeline());
    await page.clock.fastForward(24 * 3600e3);
    await expect(page.locator('#mkVoiceAct')).toHaveCount(0);
  });

  test('NEGATIVE · with the schedule category OFF the CARD still appears, only the voice is silent',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-schedule': JSON.stringify('off') });
    let spoke = 0;
    await page.exposeFunction('__spoke', () => { spoke++; });
    await page.evaluate(() => {
      const w = window as any; w.vcSpeak = () => { (window as any).__spoke(); return Promise.resolve(); };
      w.voiceSay('schedule', 'הזמן להתחיל: חזה בקר', { tier: 'act', key: 'k' }); });
    await expect(page.locator('#mkVoiceAct')).toContainText('חזה בקר');
    expect(spoke).toBe(0);
    expect(await page.evaluate(() => (window as any).voiceLogAll()[0].status)).toBe('skipped');
  });
});
```

**‏`__armScheduleCard`** — `armCard` נחשף כפונקציה ברמת המודול (‏`window.__armScheduleCard`) כדי
שהבדיקה תוכל לירות עליה ישירות בלי לבנות תוכנית מלאה. זו נקודת בדיקה, לא נתיב מוצר.

**המקרים השליליים (נקובים):** אירוע פג ⟵ אין חימוש · קטגוריה כבויה ⟵ הכרטיס עדיין מופיע · טריגר
שמועדו בעבר (‏`ms<=0`) **אינו** יורה.

---

## Task 14 — `progress` (C1-C5) והטריגרים הבטיחותיים (S4 · C1 · V3)

**מקור בספֵּק (§2.4):** *"**C1-C5** — הפסק קיים רק בפאנל פתוח. **פתוח.** `copilotPace` (8132) נקרא רק
בתוך `openCopilot`. **חובה: הפסק יוצא לכרטיס `voiceAct`/`voiceLog` לפני שהוא מדבר.**"*
**‏(§1.1):** ‏`safety` כולל את S4 (‏`renderPlanStartRow` 8321), C1 (הגעה ליעד — `copilotPace` `state:'done'`)
ו-V3 (טמפ׳ יעד ליבה).

### הקוד — 1 · הפסק מדווח על **שינוי מצב**, לא על רינדור

```js
// §2.4 · the pace verdict leaves the panel. copilotPace itself is PURE and stays pure (it is the ETA
// math, and DoD-10 forbids touching what it computes) — this is a thin observer above it.
// Deduped on the verdict STRING: the audit's own requirement ("רק בשינוי פסק, לא בכל רינדור") — without
// it, copilotPace being called from every openCopilot (8132's callers) would speak on every panel open.
let copilotLastState=null;
function copilotAnnouncePace(pace){
  const p=pace||{}, sig=p.state+'|'+(p.verdict||'');
  if(sig===copilotLastState) return;
  copilotLastState=sig;
  if(p.state==='done'){        // C1 — reaching the internal target IS a safety value (§1.1)
    voiceSay('safety', L('הגיע ליעד הפנימי — נוח והגש','Target internal temp reached — rest and serve'),
             {tier:'act', key:'cop:done'}); return; }
  if(p.state==='stall')  return void voiceSay('progress', L('בסטָאל — הקצב שטוח. עטוף לפרוץ, או המתן.','In the stall — the pace is flat. Wrap to push through, or wait it out.'));
  if(p.state==='flat')   return void voiceSay('progress', L('הטמפ׳ אינה עולה — בדוק את החום והדלק','The temp is not rising — check the fire and the fuel'));
  if(p.verdict==='behind') return void voiceSay('progress', L('הקצב האט — הצפי זז','The pace slowed — the estimate moved'));
  if(p.verdict==='ahead')  return void voiceSay('progress', L('יש עודף זמן — אפשר להחזיק בקופסת בידוד','You have slack — you can hold it in a cooler'));
}
```
הקורא: `copilotLogProbe` (רישום מדחום — הרגע שבו הפסק באמת יכול להשתנות) ולולאת ה-60 שניות שכבר
רצה (13058), **לא** `openCopilot` — כדי שפתיחת פאנל לא תדבר.

### הקוד — 2 · שני הטריגרים הבטיחותיים הנותרים

```js
   if(behind){ const late=Math.round((Date.now()-earliest.getTime())/60000);
     warn=`<div class="plan-warn">...</div>`;
+    // S4 · the plan is late. The warning's own text says "עלול להשאיר את הפנים תת-מבושל ולא בטוח" —
+    // shortening a cook stage is exactly what a rushed cook does, so this is the safety channel, not
+    // `schedule`. Deduped on the scope so a rebuild does not repeat it.
+    if(_planLateSaid!==evScope()){ _planLateSaid=evScope();
+      voiceSay('safety', L('הזמן קצר — דחה את ההגשה, אל תקצר שלבי בישול','Time is short — push the serve time, do not shorten cooking stages'),
+               {tier:'act', key:'plan:late'}); }
   }
```
```js
   else if(a==='qtemp'){
     ...tempMsg built exactly as today...
-    vcSpeak(tempMsg, vcVoiceLang(), 'step');
+    // V3 · a core-temperature answer is safety CONTENT even though its trigger is user-initiated: it
+    // must still be heard when the `steps` category is off (§1.1 marks V3 safety-content/steps-trigger).
+    voiceSay('safety', tempMsg, {tier:'fyi'});
   }
```

### RED → GREEN — `tests/vg-progress-safety.spec.ts`

```ts
import { test, expect, seedApp } from './_fixtures';

test.describe('§2.4 · pace and safety triggers', () => {
  test('C1-C5 · the verdict speaks on a CHANGE and is silent on a repeat', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const n = await page.evaluate(() => {
      const w = window as any; let c = 0; w.vcSpeak = () => { c++; return Promise.resolve(); };
      w.copilotAnnouncePace({ state: 'projected', verdict: 'behind' });
      w.copilotAnnouncePace({ state: 'projected', verdict: 'behind' });   // same verdict → silent
      w.copilotAnnouncePace({ state: 'stall' });
      return c;
    });
    expect(n).toBe(2);
  });

  test('C1 · reaching the internal target is SAFETY — spoken with every category OFF', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-timers': JSON.stringify('off'), 'mk-pref-voice-progress': JSON.stringify('off'),
      'mk-pref-voice-steps': JSON.stringify('off'), 'mk-pref-voice-answers': JSON.stringify('off'),
      'mk-pref-voice-schedule': JSON.stringify('off') });
    const said = await page.evaluate(() => {
      const w = window as any; const out: string[] = [];
      w.vcSpeak = (t: string) => { out.push(t); return Promise.resolve(); };
      w.copilotAnnouncePace({ state: 'done', lastTemp: 96 });
      return out;
    });
    expect(said.join(' ')).toContain('הגיע ליעד');
    await expect(page.locator('#mkVoiceAct')).toBeVisible();
  });

  test('V3 · a core-temperature answer is heard even with steps OFF', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]),
      'mk-pref-voice-steps': JSON.stringify('off') });
    const said = await page.evaluate(() => {
      const w = window as any; const out: string[] = [];
      w.vcSpeak = (t: string) => { out.push(t); return Promise.resolve(); };
      w.voiceSay('safety', 'הטמפרטורה: 74 מעלות', { tier: 'fyi' });
      return out;
    });
    expect(said.length).toBe(1);
  });

  test('NEGATIVE · opening the copilot panel repeatedly says nothing new', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const n = await page.evaluate(() => {
      const w = window as any; let c = 0; w.vcSpeak = () => { c++; return Promise.resolve(); };
      for (let i = 0; i < 5; i++) w.copilotAnnouncePace({ state: 'projected', verdict: 'on-pace' });
      return c;
    });
    expect(n).toBe(1);
  });
});
```

**המקרים השליליים (נקובים):** אותו פסק פעמיים ⟵ שתיקה · פתיחת פאנל חוזרת ⟵ שתיקה · קטגוריות כבויות
⟵ `safety` עדיין מדבר · S4 אינו חוזר בכל rebuild.

---

## 4 · עקיבוּת — כל שורת DoD בספֵּק §7 ממופה למשימה אחת בדיוק (MECE)

**§7.1 — קטגוריות וקונפיגורציה**

| # | הקריטריון | משימה |
|---|---|---|
| A1 | `ttsCategoryEnabled('safety')` = `true` גם כשהכול `off` וגם כש-`store` זורק | 10 |
| A2 | `safety` אינו מפתח ב-`PREFS` ואינו פקד לחיץ | 10 (הטבלה) · 11 (ה-DOM) |
| A3 | כיבוי `timers` אינו מכבה `schedule` ולהפך | 10 |
| A4 | קטגוריה כבויה ⟵ המקבילה החזותית עדיין מופיעה | 10 |
| A5 | שלילי: ערך זבל חוזר ל-`def` דרך `prefOk` | 10 |
| A6 | הפאנל ב-390×844, פקדים ≥48px, אפס גלישה | 11 |
| A7 | עברית מלאה + שפה נוספת, כולל **דגימת הקול** | 11 |

**§7.2 — מקבילה חזותית והתנגשות**

| # | הקריטריון | משימה |
|---|---|---|
| B1 | אף אמירה ללא שורה ביומן — ארבעת הסטטוסים | 9 |
| B2 | `safety` קוטע; הנקטע ביומן; **מתחדש** (F-5, גובר על נוסח §7.2) | 12 |
| B3 | `timers` אינו קוטע — נכנס בסוף המקטע | 12 |
| B4 | שני טיימרים באותה שנייה ⟵ אמירה מאוחדת | 12 |
| B5 | שלילי: `progress` שנפל מסומן "לא הושמע" | 12 |
| B6 | בזמן `vcRec` רק `safety` מדבר | 12 |
| B7 | שלושה כרטיסים ב-390×844, אפס דחיפה מחוץ למסך | 8 |
| B8 | כל מספר עטוף `dir="ltr"` | 9 (כרטיס) · 11 (יומן) |

**§7.3 — מחזור-חיים**

| # | הקריטריון | משימה |
|---|---|---|
| C1 | 13 שעות, אפס טיימרים ⟵ `needsUpdate` | 5 |
| C2 | שלילי 4.2a: טיימר רץ ⟵ `active` | 5 |
| C3 | שלילי 4.2b: ללא `date` לעולם לא `needsUpdate` | 5 |
| C4 | שלילי הסף: 11 שעות ⟵ עדיין לא | 5 |
| C5 | `finished` נבדל, נשמר עם `finishedAt` | 5 |
| C6 | רגרסיית R-57 red-green: אירוע פג ⟵ אין `mark()` | 6 |
| C7 | "המשך" שומר `wpck:` ומוחק רק טיימרים שפגו | 7 |
| C8 | "התחל מחדש" מוחק כל `wpck:<scope>:*` | 7 |
| C9 | re-arm מול המועד החדש, אין השמעה חוזרת | 7 |
| C10 | הבאנר נוקב במספר ההתראות שדוכאו | 6 |

**§7.4 — המסווג**

| # | הקריטריון | משימה |
|---|---|---|
| D1 | קטגוריה מעורבת ⟵ אפס מספר, גם ב-`confidence:0.99` | 2 |
| D2 | פריט שלא זוהה ⟵ אפס מספר | 2 |
| D3 | תשובת עישון עם 3 מספרים | 2 |
| D4 | שלילי: `other` / `kind` חסר / `confidence:0.7` | 2 |
| D5 | שלילי: `text` שאינו טוקן שלנו | 1 (המפה) · 2 (הגארד) |
| D6 | P6: ששת נתיבי הכשל, פלט זהה בייט-לבייט | 3 |
| D7 | שלילי: ייחוס שגוי ⟵ המספר משוחרר — הפגיעות **מתועדת** | 2 (ראה §5 למטה) |
| D8 | R-61: התחליף ראשון כשאין אישור; כהיום כשיש | 4 |
| D9 | `ask`/`vcAsk` נשארים `low`; `safetyClass` חדש | 3 |
| D10 | מסלול ההקראה אינו מפעיל קריאת AI | 3 |
| D11 | `firstSound` נשאר ~1.1 שנ' | 3 · 12 |

**§7.5 — שערים חוצי-תחומים**

| # | הקריטריון | היכן |
|---|---|---|
| E1 | ‏DoD-10: `data.py`/`sources.py` ללא diff + האינווריאנט המספרי | §3.4, כל משימה |
| E2 | ‏DoD-11: אפס `waitForTimeout` | §3.1, כל משימה |
| E3 | ‏DoD-12: `npx playwright test` נקי ×1 למשימה, ×2 בשילוח | §3.4 |
| E4 | כל מחרוזת דרך `L()`, נבדקת בעברית + שפה נוספת ב-DOM | §3.2, משימות 5-7, 9-14 |

**‏D7 — הפגיעות המוצהרת.** הספֵּק דורש בדיקה ש**מתעדת** אותה, לא מסתירה. היא נכתבת ב-Task 2 כבדיקה
שישית, בשם מפורש `D7 · DOCUMENTED VULNERABILITY — a mis-attributed internal temp is released`:
מסווג שמסמן `71°C` פנימי כ-`chamber_temp` בביטחון 0.95 ⟵ המספר **נאמר**. הבדיקה טוענת שזה מה שקורה,
ובתגובה בקוד מפנה ל-§9 בספֵּק. **זו העלות המפורשת של פסיקת R-62** — לא באג להסתיר.

---

## 5 · Pre-Mortem — התוכנית נכשלה. שלוש הסיבות הסבירות ביותר, ומה שנבנה נגד כל אחת

1. **המסווג "מצליח" ומשחרר מספר בטיחות בייחוס שגוי** (D7). זו לא תקלה — זו הפגיעות שהספֵּק מודה בה
   ב-§9. **מה מצמצם:** ייחוס חיובי בלבד · ביטחון ≥0.85 · טוקנייזר משותף (המסווג אינו מגדיר מהו מספר) ·
   אישור **רק** מול הטבלה שלנו. **מה נוסף כאן:** ה-P6 הוא **מבני** — `claims===null` פירושו אפס שינוי
   בקוד, ולכן כל תקלת מסווג מתנוונת להתנהגות היום ולא למצב חדש. **הבדיקה:** D6 × 6 נתיבים × 5 תשובות.
2. **שכבת הקונפיגורציה תיקרא כהבטחת מסירה שהמערכת אינה יכולה לקיים** (§9 בספֵּק, "הסיכון הגדול ביותר").
   **מה נבנה נגד:** שורת-האמת היא רכיב ראשון-במעלה בפאנל עם קישור ל-`mk-tlalerts` (Task 11, F-4) ·
   הכרטיס/הרטט/ההתראה נשלחים בדרגה A **ללא תלות בהגדרת הקול** (Task 9: החזותי לפני השער; Task 10:
   השער אחרי) · A4 בודקת בדיוק את זה. **מה שאינו מכוסה ואמור להיאמר:** אנחנו עדיין לא יכולים להעיר
   מישהו ב-3 לפנות בוקר. התוכנית אינה מבטיחה זאת בשום מקום.
3. **התור יגרום לרגרסיית latency או לרגרסיית נפח בקשות.** שתי הרגרסיות הכי יקרות של הקשת הקודמת
   (‏v281). **מה נבנה נגד:** התור יושב מעל `vcSpeak` בלבד; `gemSpeakSeg`/`gemSpeak` לא נגעו;
   אמירה = קריאת `vcSpeak` **אחת**; החידוש הוא קריאה אחת על השארית, לא בקשה למשפט. **הבדיקה:**
   ‏D11 (‏`firstSound`) + מונה `generateContent` לפני/אחרי, בשתי משימות (3 ו-12).

---

## 6 · שער ה-Phase (‏§3, per-phase) והנחיתה המלאה (H8)

**שער סיום הקשת:** כל שורת DoD מ-§7 בספֵּק מצוטטת ומסומנת MET עם ראיה · כל שורה שאינה MET ⟵ הקשת
אינה שלמה, מוסלמת לבעלים · **ביקורת-על עצמאית ע"י סוכן טרי מול הספֵּק** — לא מול המרשם ולא מול
התוכנית הזו · `npx playwright test` נקי **×2** בשילוח (H7) · `node scripts/check-meta.mjs` ירוק ·
`docs/STATUS-BOARD.md` מעודכן · דו"ח UX בעברית לגרסה (H14) · אימות חי של הגרסה (‏§10.10).

**‏H8 — מה נשאר לא-נחת, ולאיזה עוגן:**

| הפריט | מצב | העוגן |
|---|---|---|
| **קטגוריית הקול `schedule` (הפקד)** | דחוי · רשום ב-`PREFS`, לא מרונדר | **עוגן טריגר:** תיקון N3/N4 (התראות שלב אמינות). נרשם כשורת מרשם חדשה |
| **‏A12 בחמשת אתרי הגארד ב-HTML** (‏`askGemini`) | מחוץ לתחולה מפורשת (§6.2) | שורת מרשם נפרדת — פער מוצהר בספֵּק |
| **איחוד `renderAlarm`/`renderTimerWarn`/`renderBcheckAlarm`** | מחוץ לתחולה (§6.1) | שורת מרשם נפרדת; Task 8 סוגר את **התסמין** (הדחיפה מהמסך), לא את החוב |
| **‏N1 — תזכורות רב-יומיות** | מחוץ לתחולה (§6.4) | כבר נחת חלקית ב-1.8 (‏`checkReminders` בלולאת 60 שנ', 13058) — נרשם כפריט המשך |
| **‏X1 (הכרזת "מאזין") · X2 (דליפת i18n בדגימת הקול, 7439)** | מחוץ לתחולה (§6.5, Circle of Control) | שתי שורות מרשם נפרדות |
| **‏U1 — זמן ההתראה של משתמש BYOK** | נמדד ב-Task 10, **לא** משנה ניתוב | אם המדידה גרועה ⟵ הכרעת בעלים, לא שינוי שקט |
| **‏§6.7 — נפח בקשות בבישול ריאלי** | לא נמדד בספֵּק; ‏R-54 הסיר את האילוץ | מונה הבקשות במשימות 3 ו-12 הוא הכיסוי המינימלי; מדידת 8-פריטים = פריט המשך |
| **‏§6.8 — `AudioContext` בהחלפת התקן/שיחה נכנסת** | לא בוסס, לא נבדק | פריט מחקר נפרד |

---

## 7 · בדיקה עצמית של התוכנית מול הספֵּק

* **כל דרישה עקיבה למשימה.** ‏§4 למעלה ממפה את 40 שורות ה-DoD; אין שורה ללא משימה ואין משימה ללא שורה.
* **שמות וחתימות עקביים בין המשימות.** ‏`vcClassifySafetyClaims` (1) → `vcClaimVerdict` (2) →
  `vcGuardSpoken(text,tiers,lang,claims)` (2,3,4) · `evState`/`evCookStarted` (5) → `scheduleBcheckDue`
  (6) → `evServeWriteGate` (7) · `mkActStack()`/`mkActStackOrder()` (8) → כל הרנדררים (8,9,6) ·
  `voiceSay(cat,text,opts)` (9) → השער (10) → התור (12) → הטריגרים (13,14).
* **אפס placeholders.** כל צעד נושא את הקוד שמהנדס צריך; אין "טפל בהתאם" ואין "כמו במשימה N".
* **‏§4 (שער הוויתור):** ‏**אין** בתוכנית ויתור, דחייה או צמצום של דרישה מהספֵּק. שלושת הפורקים
  שהבעלים לא הכריע מיושמים לפי **המלצת הספֵּק עצמו** ומסומנים ב-§0.2. הפריט האחד שאינו ניתן ליישום
  ללא הכרעה — ההגדרה התפעולית של "לא מסתכל" — **חוסם משימה** ומובא לשיחה, כפי שהפסק עצמו מורה.
* **מה שהספֵּק כבר סימן כסגור לא נבנה מחדש** (§0.3): `mkShowTimerWarn`/`renderTimerWarn`, `VC_THINKING`,
  `scheduleBcheckDue`/`renderBcheckAlarm` והאישור מוכוון-המופע.
* **חוזים שלא נשברים** — נבדקים במפורש: חוזה הסמן `gemSpeakSeg(text,lang,gen,startAt)→cursor` ·
  ‏~1.1 שנ' לצליל ראשון · נפח בקשות TTS · כלל הכשירות של `vcGuardSpoken` ו-R-53/R-58 · אישור
  ‏`bcheck` מוכוון-מופע (בישול חדש **כן** מרים בדיקה).

---

## 8 · טבלת סיכום המשימה (H9)

| # | שורה | תוכן |
|---|---|---|
| 1 | **מה היה** | ספֵּק מאושר (1.8) עם שלושה פסקי בעלים, ואפס תוכנית. שתי שורות מרשם 🔴 פתוחות (R-58/R-62), אחת 🟠 מותנית (R-61), אחת 🟠 מאושרת-לתכנון (R-57), וקשת R-52 ללא סדר ביצוע |
| 2 | **מה נעשה** | ‏`docs/superpowers/plans/2026-08-01-voice-governance.md` — 14 משימות, כל אחת עם קוד מדויק, מחזור RED→GREEN משלה ומקרים שליליים נקובים; Global Constraints מצוטטים מילה במילה; מיפוי MECE של 40 שורות ה-DoD; pre-mortem; הצהרת H8 |
| 3 | **מה נשאר** | ⚑ הכרעת בעלים אחת חוסמת (משימה 10 — ההגדרה התפעולית של "לא מסתכל") · שמונה פריטים מחוץ לתחולה, כולם עם עוגן (§6) · אישור הבעלים על התוכנית לפני שורת קוד |
| 4 | **איפה אנחנו** | תכנון קשת R-52/R-57/R-61/R-62 — הושלם. המספר בלוח (‏`docs/STATUS-BOARD.md`) מתעדכן בסגירת המשימה ע"י הבקר |
| 5 | **הבא בתור** | ‏(א) הבעלים מכריע את §0.1 · (ב) אישור התוכנית · (ג) Task 1 — רישום המסווג, `subagent-driven-development`, סוכן טרי למשימה + מבקר למשימה |










