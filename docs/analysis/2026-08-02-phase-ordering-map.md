# מפת סדר-השלבים (Phase Ordering) — מפה עובדתית לקראת שיחת עיצוב

**תאריך:** 2026-08-02 · **סוג:** חקירה קריאה-בלבד (READ-ONLY). לא שונה קוד, לא בוצע commit.
**מקור הראיות:** קריאה ישירה של `app.js` (14,109 שורות), `data.py`, `tests/`, `app.css` ב-HEAD הנוכחי.
כל טענה נושאת `file:line` שנקרא בפועל. מה שלא נקבע — מסומן **UNDETERMINED**.

**שאלת הבעלים:** לנתח בשר יש טיפול מסודר — הכנה/ריפוי → עישון → מנוחה. הבעלים סבור שזה שגוי
שהאפליקציה מרשה למשתמש למקם "מנוחה" לפני שהנתח עושן. איך מטופל הסדר? האם נאכף? באיזו דרגה?
מה עם פריטים/שלבים שאינם חלק מטיפול של נתח יחיד? ובנפרד — הצעת UI: לכל פריט קטלוג, ציור מסלול
הבישול שלו כ-**תחנות ממוספרות** על ציר הזמן, עם הפרדת צבע לפי פריט.

---

## תקציר התשובות

| שאלה | תשובה קצרה |
|---|---|
| Q1 · מודל הטיפול | שני מודלים נפרדים: **stages** (נגזרות בקוד, לנתחים) ו-**phases** (טאפלים בדאטה, למתכוני בנייה). לשניהם **אין שדה סדר מפורש** — הסדר הוא מיקום במערך. |
| Q2 · אכיפת סדר | **אין שום אילוץ סדר בשום מקום.** יש בדיקת אי-שינוי (`safetyDiff`) שמשווה תוכנית לעצמה לפני/אחרי טרנספורמציה — היא לא מאמתת שהסדר נכון, רק שלא השתנה. |
| Q3 · נקודות כניסה | 4 נקודות. שלוש מהן **נגזרות** (המשתמש בוחר שיטה/נתיב, לא סדר). אחת — מחולל המתכונים AI — מקבלת סדר **שרירותי ללא בדיקה**. |
| Q4 · `path_outcomes` | וקטור **תוצאה** מצוטט לכל מסלול (מרקם/קרום/עשן/עסיסיות). ‏0 שורות קוד — קיים במסמכים בלבד; יעדו `sources.py`. ‏**אורתוגונלי לסדר** — לא תקדים. |
| Q5 · פריטים שאינם נתח | חימום מוקדם, תדלוק והגשה קיימים על אותו ציר, ומובחנים רק ב-`kind` (`fire`/`serve`) ובהיעדר `ikey`. אין `hold`/`ambient`/`custom` כלל. |
| Q6 · ה-UI כיום | אין מספור, אין צבע-לפי-פריט, אין מושג "תחנה". צבע קיים לפי **סוג שלב** ולפי **אירוע** — לא לפי פריט. |
| Q7 · צימוד בטיחות | **קריטי:** זמן התראת ה-`bcheck` נגזר ישירות ממיקומו במערך. שינוי סדר = הזזת שער הבטיחות. |
| Q8 · תקדים במסמכים | ‏**ULTIMATE: אפס פסיקות** על סדר שלבים (נקראו כל 248 ה-CONFIRMED/REFUTED). התקדים האמיתי: החלטה **F2a** + שער הציטוט `comboHasSvSmoke` + פריט "אוצר-הסדרים" הרשום-ולא-מתוזמן. |

---

## Q1 · איך ממודל טיפול של נתח?

יש **שני מודלים נפרדים ולא-מאוחדים**.

### 1א · `stages` — לנתחי בשר (נגזר בקוד, לא בדאטה)

`data.py` **אינו מכיל** רשימת שלבים לנתחים. כל נתח הוא dict שטוח של ערכי-קצה
(`data.py:6-8`, מפתחות `n,cat,heb,eng,kg,svt,svh,smt,smh,tgt,safe,sear,mid,wrap,rest,rub,wood,coal,diff,sot,soh,somid,saved`):

```python
# data.py:8
dict(n=1,cat="בקר",heb="בריסקט",eng="Brisket",kg=5.5,svt=68,svh="30",smt=105,smh="3",
     tgt=95,safe=63,...,rest=60,...)
```

זה **לא** רצף — אלה פרמטרים. הרצף נבנה ב-`itemStages()` — `app.js:4678-4753`. צורת שלב יחיד:

```js
// app.js:4712 (דוגמה מייצגת)
{ label:'סו-ויד 68°', hours:30, kind:'sv', temp:68, note:'…', sub:'…', safety:'pasteur' }
```

השדות שקיימים בפועל: `label`, `hours`, `kind`, `temp`, `note`, `sub`, `safety`.
נוספים בהמשך צינור העיבוד: `tid` (`app.js:9104`), `start`/`end` (`app.js:9109`),
`fuelNote`/`refuelEveryMin` (`app.js:1319-1322`).

> **אין שדה `order`, אין `after`, אין `dependsOn`, אין `seq`.** הסדר הוא **מיקום במערך בלבד**,
> והמיקום נקבע ע"י סדר קריאות ה-`push` בגוף הפונקציה — כלומר **מקודד קשיח בקוד**:
> prep (4682) → [smoke→sv או sv→dry→smoke] (4687-4737) → grill (4738) → rest (4750) → bcheck (4752).

אוצר ה-`kind` שנוצר בפועל: `prep, smoke, note, sv, dry, cook, rest, bcheck` (`app.js:4682-4752`).

### 1ב · `phases` — למתכוני בנייה (בדאטה, טאפלים)

ב-`data.py`, מבני `BUILDS`/`make(...)` נושאים `phases` — **מערך של טאפלים** `(כותרת, גוף, שניות)`:

```python
# data.py:276-289 (cut-16, נקניקיות)
phases=[
  ("1 · בחירת בשר ושומן","יחס שומן 20–30%…",0),
  ("2 · צינון עמוק","הקפא חלקית…",2700),
  ...
  ("10 · עישון","עשן בחום נמוך-בינוני…",0),
  ("12 · צלייה והגשה","סיים על גריל פחם חם…",0),
]
```

כאן המספור **הוא חלק ממחרוזת הכותרת** ("1 · ", "2 · ") — טקסט, לא נתון. אין שדה סדר;
הסדר שוב = מיקום במערך. אותו דפוס ב-`data.py:678-684`, `700-707`, `750-757` ועוד ~30 מופעים
(`grep -n "phases=\[" data.py` → 30 מופעים).

**המשמעות לעיצוב:** שינוי סדר ב-BUILDS מחייב גם עריכת מחרוזות המספור, אחרת המספר יסתור את המיקום.

---

## Q2 · אילו כללי סדר קיימים היום? — **אין. אף אחד.**

זהו הממצא המרכזי, והוא **שלילי**. להלן ההוכחה, לא הקביעה.

### 2א · המחולל (`itemStages`) — הסדר קשיח, אין ולידציה

`app.js:4678-4753` — פונקציה אחת, `push` ברצף קבוע. אין `sort`, אין `validate`, אין השוואת קדימויות.
המשתמש לא מזין לכאן רשימת שלבים — הוא מזין `methodKey` ו-`order`, ומקבל רצף שנבנה.

### 2ב · המתזמן (`planSchedule`) — מקבל את המערך **כפי שהוא**

```js
// app.js:4443-4457
function planSchedule(stages, serveMs){
  const list=stages||[], out=new Array(list.length);
  let end=Number(serveMs);
  for(let i=list.length-1;i>=0;i--){
    const s=list[i]||{};
    const hrs=Number(s.hours)||0;
    const start=end-hrs*3600e3;
    out[i]={ i:i, tid:s.tid||null, kind:s.kind||null, hours:hrs, startMs:start, endMs:end, ... };
    end=start;
  }
  return {stages:out, startMs:end};
}
```

**זו ההוכחה החזקה ביותר.** המתזמן הולך אחורה מזמן ההגשה על פני המערך **בסדר האינדקסים**.
הוא לא בודק דבר על `kind`. אם `rest` יהיה באינדקס 0 ו-`smoke` באינדקס 1 — הוא יתזמן מנוחה לפני עישון
בלי מילה. אין `if`, אין `throw`, אין אזהרה.

### 2ג · `equipPlan` — מיפוי 1:1, לא נוגע בסדר

```js
// app.js:1314-1327
function equipPlan(meta, methodKey, stages, scope){
  const list=stages||[];
  if(typeof equipConfigured!=='function' || !equipConfigured()) return list;
  return list.map(function(s){ ... return out; });   // .map — אורך וסדר נשמרים
}
```

### 2ד · `schedulePlacements` — מזיז בזמן, לא בסדר

`app.js:4554+`. ההערה בקוד מפורשת (`app.js:4527-4531`):
> *"a placement carries ONLY a new start/end pair of the SAME length. There is no representation here
> for a different duration, a different temperature, or a different stage order — the forbidden moves are
> structurally unreachable, not filtered after the fact."*

כלומר: המניעה היא **מבנית** (אין ייצוג לשינוי סדר), לא ולידציה.

### 2ה · `safetyDiff` — נראה כמו אכיפה, אבל אינו

```js
// app.js:4504-4519
function safetyDiff(before, after){
  ...
  if(a.kind!==b.kind)   out.push({at:i, field:'kind', was:a.kind, now:b.kind});   // reorder/replace
  ...
}
```

נקרא בדיוק במקום אחד — `app.js:9145`:
```js
const base=_planSafetyBase[c.m.key]; if(!base) return;
const now=c.stages.map(s=>({kind:s.kind, hours:s.hours, temp:s.temp, safe:s.safe}));
const bad=safetyDiff(base, now);
if(bad.length) window._planSafetyViolations.push({key:c.m.key, violations:bad});
```
`base` נלקח ב-`app.js:9101` **מיד אחרי** `itemStages` ולפני `equipPlan`. כלומר `safetyDiff` משווה את
התוכנית **לעצמה** לפני/אחרי הטרנספורמציות של שכבת התוכנית. הוא מוכיח *"לא שינינו את מה שיצרנו"* —
הוא **לא** מוכיח *"מה שיצרנו נכון"*. ואם נמצאה הפרה, התוצאה נכתבת ל-`window._planSafetyViolations`
בלבד — **אין חסימה, אין הודעה למשתמש** (`app.js:9139-9147`).

הטסט `tests/safety-invariant.spec.ts:44` ("V5: reordering stages is a violation — a bcheck must never
precede its cook") בודק בדיוק את זה: הוא מחליף ידנית שני שלבים ומצפה ש-`safetyDiff` יזהה **שינוי**.
זו בדיקת אי-שינוי, לא בדיקת תקינות-סדר.

### 2ו · המקום שבו רשימת שלבים מתקבלת **ללא כל בדיקה** — מחולל המתכונים AI

```js
// app.js:13045-13060
function umakeValidateStructure(raw, type){
  if(!raw||typeof raw!=='object') return null;
  const name=...; if(!name) return null;
  const t=Object.keys(UMAKE_CALC).includes(raw.type)?raw.type:...;
  const materials=...;
  const phasesRaw=Array.isArray(raw.phases)?raw.phases:[];
  const phases=phasesRaw.map((p,i)=>{
    const title=...; const body=...;
    return body?[title,body,0]:null;
  }).filter(Boolean).slice(0,14);
  if(phases.length<2) return null;   // need a real procedure
  ...
}
```

הפונקציה נקראת **strict structure validation** בהערה שלה (`app.js:13046`). היא מוודאת:
שם קיים · סוג מוכר · חומרים מחרוזות · לכל שלב יש גוף · **לפחות 2 שלבים** · לכל היותר 14.
היא **אינה** בודקת: מה סוג השלב, מה בא לפני מה, האם יש עישון לפני מנוחה, האם יש בכלל שלב בישול.
הסדר שה-AI החזיר נשמר כפי שהוא (`app.js:13070`: `phases:v.phases`) ונשמר לאחסון המשתמש
(`app.js:13072-13076`, `umakeSave`).

### 2ז · השלמת שלבים — נספרת, לא מסודרת

סימון "בוצע" בפרויקט (`app.js:13302-13303`) שומר אינדקסים לרשימה, בכל סדר:
```js
p.doneSteps=p.doneSteps||[]; const i=+cb.dataset.cpi;
if(cb.checked){ if(!p.doneSteps.includes(i)) p.doneSteps.push(i); } else { ... }
```
ומצב "מוכן" הוא **ספירה** בלבד (`app.js:4964`, `app.js:13211`):
```js
if(p.type==='scratch'){ const ph=projPhases(p); return ph.length? (p.doneSteps||[]).length>=ph.length : true; }
```
כלומר: אפשר לסמן "מנוחה" (שלב 6) לפני "עישון" (שלב 3), והמערכת תראה 2/12 — ללא אזהרה.
אותו דפוס בכרטיס המתכון (`app.js:3271-3282`, `wireSteps`) ובתוכנית העבודה
(`app.js:9444`, `data-wpck` — כל תיבה עצמאית, המפתח הוא `scope+label`).

### 2ח · שריד: `FINISH_RE` — קוד מת שנראה כמו ניסיון סיווג-סדר

```js
// app.js:4863-4864
const REST_RE=/מנוחה|קירור|יישון|לילה|שעות|24|48|התייצב|הבשלה/;
const FINISH_RE=/בישול|צלייה|עישון|הגשה|טיגון|גריל|בשל|צלה|סיום|חריכה|צריבה/;
```
`grep -n "FINISH_RE" app.js` → מופע יחיד: ההצהרה. **אף אחד לא קורא לו.** רק `REST_RE` בשימוש
(`app.js:4868`, `4871`), וגם הוא היוריסטיקה של **טקסט** ("איפה הכותרת מכילה 'מנוחה'?") לצורך פיצול
"מראש / סיום" — לא אילוץ.

### מסקנת Q2

> **לא קיימת שום ולידציה, מיון, קדימות, תלות או כלל "חייב לבוא אחרי" על שלבים — בשום מקום בקוד.**
> הסדר הוא תוצר לוואי של מיקום במערך, שנקבע קשיח בגוף `itemStages` לנתחים, ומועתק כפי-שהוא מהדאטה
> או מה-AI למתכוני בנייה. המנגנון היחיד שנראה כמו אכיפה (`safetyDiff`) הוא בדיקת אי-שינוי, שתוצאתה
> נכתבת למשתנה גלובלי ולא נראית למשתמש.

---

## Q3 · היכן משתמש יכול ליצור או לסדר שלבים?

| # | נקודת כניסה | file:line | הסדר בשליטת המשתמש? |
|---|---|---|---|
| 1 | **בורר השיטות (Wizard שלב 2 / כרטיס פריט)** — `methodToggleHTML` | `app.js:1348-1362`; ניווט: `app.js:11409-11426` (`cwGo`, `n===2 → cwPaintMethodsFull`) | **נגזר.** המשתמש מדליק/מכבה `sv`/`smoke`/`grill`. הרצף נבנה ב-`itemStages`. |
| 2 | **בורר סדר sv↔smoke בציר-הזמן** — `<select data-tlorder>` | markup: `app.js:9391`, `9493`; wiring: `app.js:9553-9555` | **נשלט חלקית — ושתי אפשרויות בלבד.** ה-`<select>` נבנה מ-`Object.entries(SV_SMOKE_ORDERS)` (`app.js:4408-4414`) = `sv-smoke` / `smoke-sv` בלבד. שתיהן **מצוטטות**: הכיוון ההפוך מוצע רק אם `comboHasSvSmoke(meta,key)` (`app.js:4766-4769`, `itemPaths`). ראה `tests/order-effect.spec.ts:9-28` — בריסקט כן, פסטרמה לא. |
| 3 | **בורר שיטה בציר-הזמן** — `<select data-tlmethod>` | `app.js:9475`, wiring `app.js:9550-9552` | **נגזר.** בוחר `methodKey` מתוך `itemProfile(meta).methods`. |
| 4 | **מחולל המתכונים AI** — `aiGenerateRecipe` → `umakeValidateStructure` → `umakeSave` | `app.js:13061-13076`, ולידציה `13045-13060`, שמירה `13072-13076` | **שרירותי לחלוטין, ללא בדיקת סדר.** הסדר שה-AI ייצר נכנס למערכת כמות שהוא. |

**שלוש דרכים שבהן משתמש *אינו* יכול לשנות סדר** (נבדק במפורש):
- אין drag-to-reorder על שלבים. `grep -nE "draggable|dragstart|reorder|moveUp|arrayMove|sortable" app.js` — כל
  המופעים הם התאמת מסך-הבית ומזח-הכלים (`app.js:13848`, `13888`, `13900`, `11785`), לא שלבים.
- **מתכנן האירוע AI אינו מייצר שלבים.** הסכימה שלו (`app.js:12812`) מחזירה
  `{guests, appetite, kosher, keys[], sides[], drinks[], desserts[]}` — מפתחות קטלוג בלבד. `evPlanApply`
  (`app.js:12840-12854`) כותב ל-`menuState` ולא נוגע בשלבים.
- אין הוספת משימה חופשית לתוכנית העבודה. `grep` ל-`wp-add|addCustom|customTasks|userTask` — המופע היחיד
  (`app.js:10211-10216`) הוא מוסיף "פריט ציוד אחר", לא משימה.

---

## Q4 · מה זה `path_outcomes`?

### 4א · מה זה היה אמור להיות

וקטור **תוצאה מצוטט לכל מסלול** — לא רצף. ההגדרה הקנונית ב-`docs/research/v5-engine/p2-routing.json`
(שדה `proposedModel`):

> *"Thesis: outcome-driven routing and cited-only paths are compatible, because the outcome vector belongs
> to the CITATION, not to the engine. The engine never derives a schedule from an outcome; it derives a
> RANKING. The path set stays exactly `itemPaths`. No new schedule math, no new number."*

הסכימה המוצעת (אותו קובץ) — ממופתחת **באותו path id ש-`itemPaths` פולט**:
```python
'path_outcomes': {
  'c:smoke_sv': { 'texture':'sliceable', 'crust':'bark-firm', 'smoke':2, 'juice':3,
                  'chew_risk':0, 'attention':1, 'ref':'…','url':'…','note':'…' },
  'c:smoke_sv:rev': {...}, 'c:smoke': {...}
}
```

הניסוח העברי — `docs/research/v5-engine/DECISION-HE-v2.md:137-138`:
> *"וקטור התוצאה שייך **לציטוט**, לא למנוע. המנוע לעולם לא גוזר לו"ז מתוצאה — הוא גוזר **דירוג**.
> אוסף המסלולים נשאר בדיוק `itemPaths`. אפס מתמטיקה חדשה, אפס מספר חדש."*

כרטיס המשימה — `docs/ROADMAP-task-cards.md:85-89`:
> *"### 2.4 · `path_outcomes` — וקטור תוצאה מצוטט (F1) … זה מה שמאפשר ל-CP2 'שורות מדברות תוצאה'
> ולסולבר 'מדרג — לעולם לא מייצר'."*

### 4ב · מה קיים היום — **כלום בקוד**

`grep -c "path_outcomes" sources.py data.py app.js` → **0, 0, 0** (אומת ידנית).
כל מופע ברפו נמצא ב-`docs/` בלבד.

**היעד המתוכנן הוא `sources.py`, לא `data.py`** — `docs/research/v5-engine/arch-sequencing.json`
(`recommendation`, P0): *"Then **`path_outcomes` in `sources.py`** — the cited outcome vector, 2 units,
must land before CP2 Task 2/3 because that is what the rows will speak."*
(ה-`data.py` שלילי צפוי לפי `docs/analysis/program/registered-2026-07-25-order-vocabulary.md:10-12`,
אבל גם `sources.py` ריק — הפריט פשוט לא נבנה.)

**סטטוס:** ‏`docs/STATUS-BOARD.md:61` — Phase 2 (גל 0): `0/~7-8`, *"🔄 פעיל — נפתח 2026-08-02 באישור הבעלים"*.
`docs/analysis/REMAINING-WORK-2026-07-30.md:38` — *"❌ — **תנאי ל-CP2** | גל 0 | 2"*.
`docs/research/v5-engine/DECISION-REGISTER.md:68` (E1) — *"CP2 משוחררת — אחרי גל 0"*.

### 4ג · האם זה קשור לסדר? — **לא. אורתוגונלי.**

`path_outcomes` הוא וקטור **תכונות תוצאה** (מרקם, קרום, עשן, עסיסיות, לעיסתיות, קשב), ממופתח לפי מסלול.
הוא אינו פולט ואינו מאלץ רצף. `docs/analysis/COVERAGE-CHECK-2026-07-30.md:218` מתאר אותו כמחליף את
**צורת הסולבר** ("מדרג מסלולים מצוטטים, לעולם לא מייצר") — לא את הסדר.

הזיקה היחידה: המפתח שלו (`c:smoke_sv` מול `c:smoke_sv:rev`) **מקודד** סדר. אבל מנגנון הסדר עצמו הוא
החלטה אחרת — **F2a** (ראה Q8). ‏**אין לצטט את `path_outcomes` כתקדים ל"מנוחה לא לפני עישון".**

---

## Q5 · פריטים שאינם חלק מטיפול של נתח יחיד

בתצוגת **"לפי פריט"** — שתי שורות סינתטיות שאינן פריטים כלל, מובחנות רק ב-CSS class:
```js
// app.js:9194
if(preheat) html+=`<div class="tlrow tl-preheat">…🔥 הדלקת מעשנת (חימום מוקדם, N דק׳)…</div>`;
// app.js:9195
html+=sorted.map(c=>itemRowHtml(c,serve)).join('');
// app.js:9196
html+=`<div class="tlrow tl-serve">…🍽️ הגשה…</div>`;
```

בתצוגת **"תוכנית עבודה"** — כולן משימות באותו מערך שטוח, מובחנות ב-`kind` **ובהיעדר `ikey`**:

| ישות | `kind` | file:line | יש `ikey`? |
|---|---|---|---|
| חימום מוקדם של המעשנת | `fire` | `app.js:9364` | **לא** |
| תדלוק תקופתי (עצים/פחם) | `fire` | `app.js:9374-9378` | **לא** |
| הגשה | `serve` | `app.js:9380` | **לא** |
| מקבץ mise-en-place (איחוד הכנות דומות) | `prep` | `app.js:9357-9363` | **לא** (נוצר אחרי תיוג ה-`ikey`) |
| רוטב / מרינדה / ראב / פירוט הכנה | `prep` | `app.js:9279-9285` | כן |
| גלייז (משויך ל-`lastCook.end − 15דק׳`) | `glaze` | `app.js:9347` | כן |
| שלבי בנייה-מאפס (`makeBuildTasks`) | `prep` | `app.js:4880` | כן |

התיוג עצמו:
```js
// app.js:9246
const _tn0=tasks.length;   // tag every task this item pushes with its key
// app.js:9348
for(let _ti=_tn0;_ti<tasks.length;_ti++){ if(tasks[_ti]&&tasks[_ti].ikey===undefined) tasks[_ti].ikey=c.m.key; }
```

**מה שאינו קיים כלל:** אין `kind` בשם `ambient`, `hold`, `holding`, `custom`, או `preheat`.
חימום מוקדם ותדלוק חולקים את אותו `kind:'fire'` — כלומר **אי אפשר להבחין ביניהם בשכבת הנתונים**,
רק לפי המחרוזת. שלב `note` נזרק כליל מהתוכנית (`app.js:9290`: `else if(s.kind==='note') return;`).

**מיון:** `app.js:9381` — `tasks.sort((a,b)=>a.t-b.t);` — לפי זמן בלבד, ללא מפתח משני.
תיקו נשאר בסדר ההוספה. אין מיון לפי פריט, לפי סוג או לפי מכשיר.

**אירועים מרובים:** `combinedEventsRows` (`app.js:12323-12377`) עובד בגרנולריות של **(אירוע, פריט)** —
שורה אחת לפריט, `{ev,ei,key,name,serve,totalH,contention}` (`app.js:12342`). השלבים נצרכים לחישוב
תפוסה ואז **נזרקים**. מיון: `app.js:12354`, לפי `start`.

---

## Q6 · מה ה-UI מציג היום (וממה ההצעה תתנגש)

### מה קיים
- **מיכל קיבוץ לפי פריט — רק בתצוגת "לפי פריט":** `<div class="tlcard">` (`app.js:9509`) עם
  `.tlc-head`, `.tlc-controls` (צ'יפים ready/prepped/scratch + `<select>` שיטה + `<select>` סדר),
  ורשימת שלבים מכווצת `<div class="tl-stages" id="tlstages-${cssKey(m.key)}" style="display:none">`
  (`app.js:9533`). שורות שלב: `.tl-stage` / `.tl-stage tl-bcheck` / `.tl-stage-note` / `.tl-stage-sub`
  (`app.js:9496-9506`).
- **בתוכנית העבודה — אין קיבוץ לפי פריט כלל.** מערך שטוח אחד, ממוין גלובלית לפי זמן. זהות הפריט
  שורדת רק כ-`data-tlitem="${tk.ikey||''}"` ובסיומת השם בתווית (`… — ${name}`).
- **שלוש צורות תצוגה** (`renderWorkplanShape`, `app.js:9433-9437`, שמות ב-`app.js:11173`):
  `'1'` אנכי (`renderWpVertical`, 9438-9448) · `'3'` סטפר אופקי (`renderWpHorizontal`, 9456-9460) ·
  `'5'` אקורדיון (`renderWpAccordion`, 9449-9455). **כולן סידור חד-ממדי של אותו מערך שטוח.**
- **צבע — לפי סוג שלב, לא לפי פריט:**
  `app.css:1295` — `.wp-row.wp-fire{border-right-color:#e0662e}` · `.wp-sv{#4a90c2}` · `.wp-smoke{#8a7a5c}` ·
  `.wp-cook{#cf6a4a}` · `.wp-prep{var(--saved-ink)}` · `.wp-glaze{#d9a62b}` · `.wp-dry{#c98a1a}` ·
  `.wp-serve{rgba(245,147,49,.08)}`; `app.css:1319` — `.wp-bcheck{#c0392b}`;
  `app.css:1317-1318` — `.wp-bar-<kind>` לאקורדיון.
  **`.wp-rest` — אין חוק CSS כלל** (`app.css:1293` נותן `border-right:3px solid transparent`) → משימת
  מנוחה בתצוגה האנכית יוצאת חסרת-צבע. פער קיים, ראוי לתיקון בעיצוב.
- **צבע — לפי אירוע:** `EV_COLORS` (`app.js:12321`, 7 צבעים) בשימוש inline ב-`tlEventBanner`
  (`app.js:9042`, `9045`) ובציר-הזמן המשולב (`app.js:12431`, `12433`, `12436`) — modulo לפי אינדקס האירוע.
- **`catColor()`** (`app.js:1849`) — צבע לפי **קטגוריה**, בשימוש בכרטיסי קטלוג ושורות תפריט בלבד
  (`app.js:1887, 2450, 2493, 2510, 3044, 3787, 3837, 5348, 6834, 6897`) — **אף פעם לא בציר-הזמן**.

### מה לא קיים
- **מושג "תחנה" — אפס מופעים** של `station` ב-`app.js` וב-`app.css`.
- **מספור שלבים בתצוגה — אין.** אינדקסים קיימים רק כ-fallback למזהי טיימר (`'wpv-'+i`, `'wpa-'+i`,
  `'wph-'+i`) ולאקורדיון (`data-wpacc="${i}"`). מספור מוצג קיים במקומות אחרים בלבד:
  `app.js:13081` (תצוגה מקדימה של מתכון AI, `${i+1}.`) ו-`app.js:13188` (`${n}/${total}` — סה"כ, לא אינדקס).
  בכרטיס המתכון האינדקס קיים כ-`data-i="${i}"` (`app.js:3245`) אך **לא מוצג**.
- **צבע לפי פריט — אינו קיים בשום מקום בציר-הזמן.**

### התנגשויות והכפלות עם הצעת הבעלים
1. **צבע לפי פריט מתנגש חזיתית בצבע לפי סוג-שלב** (`app.css:1295`, `1317-1319`). לא ניתן לצבוע את אותו
   `border-right` בשני מפתחות. צריך החלטה: להעביר את סוג-השלב לאייקון/צורה, או להוסיף ערוץ שני
   (רקע/נקודה/רצועה) לפריט.
2. **צבע לפי פריט מתנגש גם בצבע לפי אירוע** (`EV_COLORS`) בציר המשולב — שני ממדים על אותה רצועת
   `border-inline-start` (`app.js:12436`).
3. **"תחנות ממוספרות לאורך ציר הזמן" כבר קיים חלקית** כ-`renderWpHorizontal` (`app.js:9456-9460`) —
   סטפר אופקי עם `.wp-hdot`/`.wp-htime`/`.wp-hlabel` וקו-מחבר ב-`:before` (`app.css:1327-1332`).
   הנקודות **חסרות מספר** וכולן באותו צבע (`app.css:1330`), פרט ל-`bcheck` (`app.css:1319`).
   ההצעה היא בעיקרה **שדרוג** של הצורה הזו, לא צורה רביעית.
4. **מספור מתנגש במספור שכבר טבוע במחרוזות** של `BUILDS.phases` ("1 · ", "2 · " — `data.py:276-289`).
   פריט שהוא גם נתח וגם מתכון-בנייה יראה שני מספורים.
5. **המערך השטוח וממוין-הזמן אינו מבטיח רצף רציף לפריט.** משימות של פריטים שונים משתלבות זו בזו
   (`app.js:9381`). "מסלול לכל פריט" מחייב או קיבוץ מחדש (שסותר את מיון-הזמן) או קו-חיבור חוצה-שורות.
6. **מפתח סימון "בוצע" הוא `scope + label`** (`app.js:9442`) — לא מזהה. אם המספור ייכנס לתווית, כל
   הסימונים הקיימים יאבדו.

### אוצר-מילים כפול — סיכון לעיצוב
שלושה מילונים שונים ולא-מתואמים של סוגי שלב:
- מה ש-`itemStages` באמת מייצר: `prep, smoke, note, sv, dry, cook, rest, bcheck` (`app.js:4682-4752`)
- `STAGE_KIND` (`app.js:11946`): `sv, smoke, grill, sear, rest, prep, hot, cold, serve, dry, cure` —
  בשימוש **רק** ב-`timerKindLabel` (`app.js:11947-11952`). חסרים בו `bcheck`, `cook`, `note`, `glaze`, `fire`.
  ההערה מעליו (`app.js:11943`) מצהירה ש-`hot`/`cold` מתים.
- `EQUIP_PHASE_LABEL` (`app.js:9829`): `sv, smoke, grill, cook, cure, prep`.

**UNDETERMINED:** לא נמצאה פונקציה שמתאמת בין השלושה. חיפוש הצלבות לא החזיר דבר, אך לא נקראו כל 14k השורות.

---

## Q7 · צימוד בטיחות ↔ סדר

### 7א · הצימוד החזק — זמן שער ה-`bcheck` נגזר ממיקומו במערך

שלב הבדיקה נדחף **אחרון**, אחרי המנוחה, עם `hours:0`:
```js
// app.js:4750
if(p.restMin>0) stages.push({label:L('מנוחה','Rest'),hours:p.restMin/60,kind:'rest'});
// app.js:4751-4752
{ const sc = meta.obj ? (meta.obj.safe!=null?meta.obj.safe:meta.obj.tgt) : null;
  if(typeof sc==='number' && sc>0) stages.push({label:`… ${sc}°`, hours:0, kind:'bcheck', temp:sc, …}); }
```

ההערה בקוד מצהירה על התלות במפורש (`app.js:3649-3651`):
> *"planSchedule already computes a 0-hour stage's `start` as the instant the stage before it ends,
> so s.start IS 'when the preceding stage completes'."*

וההתראה נורית בדיוק ב-`s.start` (`app.js:3713`, `3730-3732`):
```js
if(s.kind!=='bcheck'||!s.start||!s.tid) return;
...
const ms=s.start.getTime()-nowTs;
if(ms<=0){ if(_fireImmediate) mark(); else _suppressed++; }
else if(ms<24*3600e3) tlTimers.push(setTimeout(mark, ms));
```

> **המשמעות:** מיקום ה-`bcheck` במערך **הוא** תזמון שער הבטיחות היחיד לפני ההגשה. כל עיצוב שנוגע
> בסדר נוגע ישירות בבטיחות. אזור זה כפוף ל-DoD-10 (CLAUDE.md §3 סעיף 10).

**נקודה לשיחת העיצוב (עובדה, לא המלצה):** מכיוון ש-`bcheck` נדחף *אחרי* `rest` ובעל `hours:0`,
זמן ההתראה שלו שווה לזמן ההגשה. אין בקוד בדיקה לפני המנוחה.

### 7ב · צימודים נוספים
- **פסטור:** בכיוון `smoke-sv` הפסטור המלא נמצא בשלב ה-sv שבא **אחרי** העישון, מסומן
  `safety:'pasteur'` (`app.js:4707`), עם תת-שורה "עישון קצר — הפסטור המלא בסו-ויד" (`app.js:4703`).
  היפוך הסדר כאן = שינוי היכן הפסטור מתרחש. לכן הכיוון ההפוך מוצע **רק כשיש ציטוט**
  (`app.js:4766-4769`, `comboHasSvSmoke`) ולעולם לא מנוסחה — `tests/order-effect.spec.ts:9-28`.
- **טמפ' עישון קר:** `coldSmokeTemp` (`app.js:4426`) הוא נוסחת גיבוי בלבד; ערכים מצוטטים
  (`order_smokesv`) גוברים (`app.js:4688-4694`).
- **`safetyDiff`** משווה `kind, hours, temp, safe` (`app.js:4507-4517`) — `start`/`end` **מוחרגים
  במכוון** (`app.js:4503`), כי הזזה בזמן היא בדיוק תפקידו של ה-placer.
- **`lastCook`** לגלייז נקבע לפי מיקום: `c.stages.filter(s=>s.kind!=='rest'&&s.kind!=='note').pop()`
  (`app.js:9346`) — כלומר גם עיתוי הגלייז תלוי סדר.

---

## Q8 · תקדים במסמכים שלנו

**שיטה (‏§10.13):** גרף הידע נשאל תחילה. הערה תפעולית: `npx graphify` נכשל
("could not determine executable to run"), אך הבינארי מותקן ב-`/c/Users/dudib/.local/bin/graphify`
ופועל. `graphify query "phase ordering"` → 210 צמתים; הצומת המוביל:
`Ordering constraints P1–P10 [src=analysis/program/ARCH-analysis.md]`.
`graphify explain` נתן `loc=None`, ולכן מספרי השורות הושלמו בקריאת המקור.

### 8א · ‏`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` — **אין שום פסיקה בנושא**

הקובץ מכיל 206 ‏CONFIRMED ו-42 ‏REFUTED (טבלה ב-`:821-822`). נקראו כל שורות ה-CONFIRMED/REFUTED
וכל מופעי `order`/`sequenc`.

> **אין ולו ממצא אחד, מאושר או מופרך, על סדר שלבי בישול.**

שלושת הפריטים הקרובים הם על סדר **רשימות UI**, לא שלבים:
- `:896-902` — D15 "תצוגת התפוסה נפתחת על מדף ריק" — **REFUTED**; שארית: סדר כרטיסי המכשירים.
- `:518` — C11 (🟡): *"The occupancy view orders empty devices above the occupied one."*
- `:920` — ממצא שנזנח: *"the 'out-of-order' task list (monotonic; the real defect is the missing day marker)"*.

> **המשמעות:** הטענה "מנוחה לא יכולה לבוא לפני עישון" **לא נדונה מעולם** בקורפוס הזה. אין פסיקה
> קודמת שסותרת או תומכת — הנושא פתוח.

ממצא נלווה רלוונטי ל-UI המוצע, `:654`: לתוכנית הבישול הרצפית יש **אפס סמנטיקת `ol`/`ul`** —
כלומר גם היום היא לא מוכרזת כרשימה מסודרת לקורא-מסך.

### 8ב · התקדים האמיתי #1 — ‏`comboHasSvSmoke`: "סדר הוא החלטת בטיחות, לא כפתור"

`docs/analysis/2026-07-21-scheduling-architecture.md:382`:
> *"`comboHasSvSmoke` offers `smoke-sv` **only** when the item carries *cited*, pasteurize-safe reverse
> data (`order_smokesv` with `sv.pasteurize===true`). **The order is a safety decision with a citation
> requirement, not a sequencing knob.**"*

חיזוקים: `docs/analysis/2026-07-25-equipment-substrate-map.md:218-224` · `docs/OPERATIONS-v157.md:136`
("gates the risky smoke-first order to only items with cited `pasteurize:true` data + a standing warning") ·
`docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md:404-405` (*"E4 must not touch that gate"*).

> **הדפוס לשימוש חוזר:** סדר שאינו ברירת-המחדל הבטוחה הוא **affordance מגודר** — הוא **מוצע** רק
> כשציטוט פר-פריט מתיר אותו; לעולם לא נגזר, לא מחושב ולא מומצא ע"י המשתמש.
> ההבדל למקרה של הבעלים: "מנוחה אחרי עישון" הוא ככל הנראה אילוץ **מבני** (שום ציטוט לא יתיר את ההיפוך),
> לא אילוץ מגודר-ציטוט.

### 8ג · התקדים האמיתי #2 — החלטה **F2a**: "רצף המכשירים בסדר הנכון בתוכנית העבודה"

`docs/research/v5-engine/DECISION-REGISTER.md:83`:
> *"| **F2a** | ⚠️ **חידוד מחייב:** משמעות המכשירים מופיעה **בסדר הנכון בתוכנית העבודה** | 🧑 |
> בחירה בשפת התוצאה; **ביצוע בשפת רצף המכשירים.** מחייב שהעטיפה תהיה שלב אמיתי |"*

הפיצול לביצוע — `docs/analysis/DECISIONS-TO-PLAN-2026-07-30.md:75`: **פ2** (העטיפה = שלב אמיתי) +
**פ4/CP2** (התצוגה). ו-`docs/analysis/GAP-DELTA-2026-07-30.md:65` מסביר למה:
> *"'Device meaning appears in the right order in the workplan' forces stages to carry equipment-specific
> meaning — the wrap becomes a real stage (פ2), CP2 renders the sequence (פ4)."*

> **זהו התקדים הישיר ביותר לשאלת הבעלים** — ולא `path_outcomes`.

### 8ד · פריט רשום ולא מתוזמן — אוצר-הסדרים

`docs/analysis/program/registered-2026-07-25-order-vocabulary.md:1-5`:
> *"Registered: 2026-07-25, by owner instruction … **Status:** REGISTERED, not scheduled."*

מצב קיים (`:9-16`): נתוני הסדר כבר קיימים מצוטטים ב-`sources.py` כ-`order_smokesv`/`order_svsmoke`,
עם פרמטרים פר-שלב `smoke:{t,h,cold}` ו-`sv:{pasteurize}`; ‏`deriveRequires(meta, methodKey, order)`
מודע-סדר בחתימתו.
הפער (`:17-20`): ברירת המחדל היא גלובלית קשיחה (`svSmokeOrderDefault()` → `'sv-smoke'`, `app.js:4424`),
ובחירת המשתמש היא state פר-אירוע (`all[k].svSmokeOrder`, `app.js:9554`). **E4** אמור להעביר את ברירת המחדל לרמת המתכון.

**רף הקבלה העומד** (`:24-32`, מוזכר גם ב-`docs/ROADMAP-task-cards.md:196-199`):
> *"adding an order pair reaches the app with zero new JS (data + citation + build only)"*,
> ושקילת סכימה כללית `orders: {<orderKey>: {…cited stage params}}`.

> **השלכה לעיצוב:** אילוץ סדר קשיח ("מנוחה אחרי עישון") צריך לחיות כ**דאטה/פרדיקט הצהרתי**,
> לא כ-`if` בקוד — אחרת הוא שובר את רף הקבלה הזה.

### 8ה · ‏`advanceWhen` — קרוב, אבל עונה על שאלה אחרת

`docs/research/v5-engine/expert-architecture.json:6`:
> *"Per-stage transition predicate — add an `advanceWhen` field to the stage object emitted by
> `itemStages`, e.g. `{tempC: 71}` / `{elapsedH: 2}` / `{either: […]}`, **populated ONLY from cited data
> (never a formula)**, defaulting to today's pure-duration behaviour when absent."*

שיוך שנקבע — `docs/research/v5-engine/OPEN-QUESTIONS-HE.md:73`: כתכונת מסלול → CP2; כמנגנון בישול-חי → Phase 3b.

> ‏`advanceWhen` הוא תנאי **מתי שלב נגמר**, לא **מה מותר לבוא אחרי מה**.
> **אין בשום מקום אוצר-מילים לפרדיקט "יורש חוקי".** זה הפער שהעיצוב הזה נועד למלא.

### 8ו · `seq` — הדבר הקרוב ביותר לרצף מוצהר, וגם הוא ללא ולידטור

`docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md:36-37`:
> *"each entry carrying its full cited schedule `{seq:['sv','oven'], stages:{sv:{t,h}, oven:{t,h}}, ref, url, note}`"*

**מסלול = רצף, לפי הגדרה** (`:25`): *"A cooking path = an ordered device-method sequence for an item"*.
ואולם — `seq` הוא דאטה מחובר-מקור; **שום דבר בספק לא אוסר `seq` לא-חוקי.**

### 8ז · ‏`svOrderDesc` — טקסט שמסביר *למה* כל סדר קיים, ומעולם לא הוצג

`docs/research/v5-engine/DECISION-HE-v2.md:34`:
> *"כתבנו טקסט-תוצאה — ומעולם לא שלחנו אותו … **`grep` מחזיר שורה אחת — ההגדרה. אפס קוראים.**"*

מאושר במקור החי — ההערה ב-`app.js:4410-4412`: *"this desc is currently DEAD (unwired — never rendered)"*.
פתרונו נמצא בגל 0 (`docs/ROADMAP-2026-07-30.md:61` — *"פותר את הגופה `svOrderDesc`"*).

> כלומר: כבר קיימת פרוזה מנומקת לכל סדר. כל UI של סדר צריך להניח שהמחרוזת הזו נהיית חיה בגל 0.

### 8ח · תקדים סגנוני (לא-בישולי) — מרשם P1–P10

`docs/analysis/program/ARCH-analysis.md:480` — *"## 4. Architectural preconditions and ordering constraints"*,
עם ערכים בצורה "X before Y + נימוק + דגל provenance" (`:488-495`), למשל
`:495` — *"| **P8** | **CC2 before C1 (the solver)** | A proposer cannot evaluate a move when the three
consumers disagree what a clash is."*
זהו סדר **משימות פיתוח**, לא שלבי בישול — אך צורת הניסוח ("hard gate", "in that order, strictly")
היא התקדים הכתוב הטוב ביותר לניסוח אילוץ.

### 8ט · פערים ב-UI המוצע שאין להם תקדים כלל

| נושא | תוצאה |
|---|---|
| מספור שלבים | **UNDETERMINED** — `grep` ל-`number\|מספור\|numbering` בכל ספקי ה-CP: אפס. אין ספק שדורש מספור. |
| צבע לפי פריט | **UNDETERMINED** — `grep` ל-`colou?r\|צבע` בספק CP1 ובתוכנית CP2: אפס. שום ספק לא מקצה צבע לפריט. |
| "תחנות" כמושג CP | **UNDETERMINED** — `grep` ל-`station\|תחנ` בספקי CP: אפס. המקבילה ברפו היא מכשירים/משבצות תפוסה (`docs/superpowers/specs/2026-07-21-occupancy-slots-h4-design.md` ואחרים — לא נקראו במלואם). |

---

## נספח · מה נבדק ולא נמצא (ממצאים שליליים מוכחים)

| נבדק | פקודה/מקום | תוצאה |
|---|---|---|
| שדה סדר/תלות על שלב | קריאת `app.js:4678-4753` במלואה | אין `order`/`after`/`dependsOn`/`seq` |
| ולידציית סדר כלשהי | `planSchedule` 4443-4457, `equipPlan` 1314-1327, `schedulePlacements` 4554+ | אין |
| גרירה לשינוי סדר שלבים | `grep -nE "draggable\|dragstart\|reorder\|moveUp\|arrayMove\|sortable" app.js` | רק מסך-בית/מזח |
| בדיקת סדר במחולל AI | `umakeValidateStructure` 13045-13060 | רק שם/סוג/גוף/אורך≥2 |
| מושג "תחנה" | `grep -i station app.js app.css` | 0 מופעים |
| `kind` של החזקה/סביבה | `grep` ל-`ambient\|hold` כ-kind | לא קיים |
| מספור מוצג בציר-הזמן | קריאת 9438-9460, 9496-9533 | לא קיים |
| צבע לפי פריט בציר-הזמן | קריאת `catColor` callers + app.css 1292-1360 | לא קיים |
| `FINISH_RE` בשימוש | `grep -n "FINISH_RE" app.js` | הצהרה בלבד — קוד מת |
