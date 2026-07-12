# תוכנית-ביצוע מפורטת — שכבת AI (BYOK)

**נלווה ל:** `ai-prd.md` · **גרסה:** 1.0 · **תאריך:** 6.7.2026

---

## חלק א' — ארכיטקטורה משותפת (תשתית לפני פיצ'רים)

### A1 · `aiJSON()` — הליבה הגנרית
פונקציה אחת שכל הפיצ'רים המבוססי-בחירה (1,2,3,6) בונים עליה. מרחיבה את הדפוס של `askGemini` אבל מחזירה **JSON מובנה ומאומת** במקום טקסט חופשי.

```
async function aiJSON({task, schemaHint, grounding, temperature=0.4, maxTokens=1200}){
  const key=gemKey(); if(!key) throw new Error('no-key');
  const sys = AI_JSON_SYS;              // "החזר JSON תקין בלבד, ללא markdown, מפתחות מהרשימה בלבד..."
  const userText = grounding + '\n\nמשימה: ' + task + '\n\nהחזר JSON במבנה: ' + schemaHint;
  // קריאה ל-Gemini (ללא google_search כברירת מחדל — חוסך מכסה; מודלק רק היכן שצריך)
  // temperature נמוך יותר מ-Q&A (0.4) ליציבות-מבנה
  // פרסינג סובלני: הסרת ```json fences, JSON.parse, retry אחד אם נכשל
  // מחזיר object מפורסר, או זורק 'bad-json' אחרי retry
}
```

**עקרונות:**
- `AI_JSON_SYS` קבוע: מחייב JSON-only, מפתחות מרשימה נתונה, "אל תמציא מספרי-בטיחות".
- `thinkingConfig:{thinkingBudget:0}` לחיסכון; `temperature:0.4`.
- פרסר: `stripFences → JSON.parse`; כשל → retry אחד עם "החזר JSON תקין בלבד"; כשל שני → זריקה.

### A2 · `aiValidateKeys()` — שומר-הסף (Grounding enforcement, P2)
```
function aiValidateKeys(keys){
  const valid=new Set(cwAllItems().map(i=>i.key));
  const kept=[], dropped=[];
  (keys||[]).forEach(k=> valid.has(k) ? kept.push(k) : dropped.push(k));
  if(dropped.length) console.warn('[AI] dropped invalid keys:', dropped);
  return {kept, dropped};
}
```
כל פיצ'ר שמחזיר keys **חייב** לעבור דרך זה לפני תצוגה/פעולה. **זו נקודת-הבדיקה המרכזית.**

### A3 · `aiAvail()` — בקרת-זמינות ונפילה-בחן (P1)
```
function aiAvail(){ return !!gemKey(); }
// כל כפתור-AI: if(!aiAvail()) → מציג רמז-שדרוג במקום, או מסלול מקומי.
```

### A4 · `aiConfirmPanel()` — תבנית אישור אחידה (P4, P5)
פאנל-אישור גנרי: מציג תוצר-AI (מסומן "✨ נוצר ע"י AI") + כפתורי "החל" / "ערוך" / "בטל". שום פיצ'ר לא משנה state בלי מעבר דרכו.

### A5 · שכבת-בדיקות: `aiMock`
דגל-בדיקה `window.__aiMock` — כשמוגדר, `aiJSON` מחזיר אותו במקום קריאת-רשת. מאפשר להריץ את **כל** זרימות-ה-AI בהרנס האופליין.

**גרסת שחרור A (v124):** רק התשתית (A1–A5) + בדיקות-יחידה לוולידטור/פרסר/נפילה. אין עדיין פיצ'ר-משתמש גלוי. זה מבטיח שהיסודות מוצקים לפני שבונים מעליהם.

---

## חלק ב' — R1: הפיצ'רים 1,2,3

### שלב R1.1 — פיצ'ר 3 ("מה אפשר להכין") — **מתחילים כאן**
*הכי פשוט, דטרמיניסטי-ברובו, מוכיח את התשתית.*

**נקודות-חיבור:**
- קלט: `invEnsure()` (24 חומרים), `gearState()`+`canSV/canSmoke/canGrill`, `cwAllItems()` (מסונן ל-`isProjectItem`/makes).
- `aiWhatCanIMake()`: בונה grounding (מלאי>0 + יכולות-ציוד + רשimת makes עם ה-materials שלהם), קורא `aiJSON`, מוולד keys.
- מסלול-מקומי (בלי מפתח): הצלבה דטרמיניסטית `materials ∩ inventory` + בדיקת-ציוד — כבר אפשרי לגמרי בלי AI. ה-AI מוסיף ניסוח, הסבר, ו"כמעט".
- UI: כפתור במסך המזווה → פאנל "אפשר עכשiv / חסר מעט".

**בדיקות R1.1 (אופליין, mock):**
- בונה-grounding: מלאי נתון → payload מכיל רק חומרים>0 + יכולות נכונות.
- מסלול-מקומי: פריט שכל-חומריו במלאי + ציוד תומך → "makeable"; חסר חומר → "almost"; חסר ציוד → לא-makeable.
- mock-AI: תגובה עם key לא-קיים → נזרק; רשimת-קניות רק לחסרים.
- נפילה: בלי מפתח → מסלול-מקומי רץ ומחזיר תוצאה.

### שלב R1.2 — פיצ'ר 2 (יועץ-מזווה, תכנון-אחורה)
**נקודות-חיבור:**
- משך-ייצור מ**הדאטה**: `projPhases`/`itemScratchBuild`/`AGED_CATS`/ימי-כבישה → `prodDaysFor(meta)` (pure, דטרמיניסטי).
- `aiPantryAdvisor(targetDate)`: grounding = תאריך + מזווה נוכחי + רשimת-מועמדים עם `prodDaysFor` שלהם. ה-AI מסדר ומנמק; **המספרים מהדאטה**.
- ולידציה: keys + הצלבת `startBy = targetDate − prodDaysFor` (מחושב באפליקציה, לא AI).
- UI: מסך פרויקטים → "יועץ תזמון" → ציר-לאחור + "צור פרויקט" לכל שורה (`pwCreate`).

**בדיקות R1.2:**
- `prodDaysFor`: ברזאולה→~14+, מרגז→~1, גבינה-מעושנת→ימי-יישון. דטרמיניסטי.
- אזהרת-חוסר-זמן: יעד קרוב מדי → warning.
- "צור פרויקט" → פרויקט עם `start` נכון.
- נפילה: בלי מפתח → טבלת-משכים ממוינת סטטית.

### שלב R1.3 — פיצ'ר 1 (מתכנן-אירוע) — **השיא של R1**
**נקודות-חיבור:**
- grounding: קטלוג מקוצר (keys+heb+cat+kosherStatus) מקובץ לפי קטגוריה, + פרמטרי-בקשה.
- `aiPlanEvent(prompt)`: `aiJSON` → `{guests,appetite,kosher,keys,sides,drinks,desserts,rationale}`.
- ולידציה: `aiValidateKeys`; סינון-כשרות אם התבקש; דדופ.
- החלה: `aiConfirmPanel` → `saveMenu` + `cwSyncFromMenu` + `cwGo(review)`.
- UI: כפתור "✨ תכנן עם AI" בראש אשף-האירוע ובדף-הבית.

**בדיקות R1.3:**
- בונה-grounding: כולל את כל הקטגוריות; kosherStatus נכון לכל פריט.
- mock-AI "בלי חזיר": ולידטור מוודא 0 פריטי-חזיר גם אם ה-mock החזיר אחד (double-guard).
- כמויות: אחרי טעינה, מחשבון-הכמויות עקבי עם מס' הסועדים.
- החלה: menuState מתעדכן רק אחרי "החל"; "בטל" משאיר ריק.
- נפילה: בלי מפתח → הכפתור מוחלף ברמז + אשף ידני רגיל.

---

## חלק ג' — R2 ו-R3 (אחרי אימות R1)

### R2.1 — פיצ'ר 4 (תיבול מותאם-פריט)
חיבור: `openCut`/`openMake` → כפתור "המלץ תיבול AI"; grounding = הנתח + 289 המתבלים (id+heb+flavor/base/heat); שמירה כ-instance `seas:<ctx>:key`. degrades ל-`recsFor`.

### R2.2 — פיצ'ר 5 (אבחון אישי)
חיבור: "מצב הצילו" → שדה-תיאור-חופשי + הקשר `journal()`/`pantry()`; מפנה ל-anchor מבין 41 הפתרונות. degrades למצב-הצילו המקומי.

### R3.1 — פיצ'ר 6 (מחולל→פרויקט) — הכי מחמיר
חיבור: `aiJSON` עם schema של build (intro/materials/phases); **מחשבון-מלח מחושב באפליקציה** מהמשקל; ולידצית-מבנה קשוחה; סימון "לא-מאומת"; אישור מפורש → נשמר כ-make משתמש (מרחב-מפתחות נפרד `umake-*`).

### R3.2 — פיצ'ר 7 (תובנות-יומן)
חיבור: `journal()` → `aiJSON` תובנות; מעוגן-נתונים; מסומן AI.

---

## חלק ד' — מפת-שחרורים וגרסאות

| גרסה | תוכן | בדיקות חדשות (יעד) |
|---|---|---|
| v124 | תשתית A1–A5 + `__aiMock` | ~15 (ולידטור/פרסר/נפילה/mock) |
| v125 | R1.1 · פיצ'ר 3 | ~12 (grounding/local/mock/action) |
| v126 | R1.2 · פיצ'ר 2 | ~12 (prodDaysFor/warn/create/fallback) |
| v127 | R1.3 · פיצ'ר 1 | ~15 (grounding/kosher-guard/apply/fallback) |
| v128 | R2.1 · פיצ'ר 4 | ~10 |
| v129 | R2.2 · פיצ'ר 5 | ~10 |
| v130 | R3.1 · פיצ'ר 6 | ~15 (schema-validation/salt-calc/guardrails) |
| v131 | R3.2 · פיצ'ר 7 | ~8 |

**כל גרסה:** rebuild + DATA-verify + node --check + סוויטה מלאה (יחידה + E2E) + audit נקי + zip + Netlify. שום פיצ'ר לא נשלח בלי בדיקות-רגרסיה ייעודיות.

## חלק ה' — קונבנציות-בדיקה לפיצ'רי-AI (מחייב)

לכל פיצ'ר-AI, **ארבע שכבות-בדיקה** (כולן אופליין):
1. **Grounding builder** — app-state ידוע → payload צפוי (assert על תוכן).
2. **Validator** — inject תגובת-mock עם keys תקינים+פסולים → רק התקינים עוברים.
3. **Action applier** — תוצר-תקין → assert על menuState/pantry/timeline.
4. **Graceful degradation** — `gemKey=''` → מסלול-מקומי רץ, אין קריסה, אין כפתור-AI תלוי-רשת.

בנוסף: **E2E flow** דרך `__aiMock` שמריץ את הזרימה מקצה-לקצה (כפתור→פאנל→אישור→state).

## חלק ו' — מבנה-נתונים חדש (מינימלי)

- `mk-gemkey` — קיים (BYOK key).
- `umake-*` — מרחב-מפתחות למתכוני-משתמש (פיצ'ר 6). נשמר ב-`mk-umakes`.
- `mk-ai-log` (אופציונלי) — לוג-פעולות-AI אחרונות לשקיפות/ביטול.
- אין שינוי סכמה לפריטים קיימים.

## חלק ז' — פתיחת עבודה

**מתחילים ב-v124 (תשתית).** אחרי אישור שהתשתית מוצקה (בדיקות ירוקות), נעבור ל-R1.1 (פיצ'ר 3), ואז 2, ואז 1 — כל אחד גרסה נפרדת עם בדיקות ייעודיות, לפי המפה בחלק ד'.
