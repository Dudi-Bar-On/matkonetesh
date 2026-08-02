# אבחון בטיחותי — שורות R-8 ו-R-15 (מרשם ROADMAP §5a)

**תאריך:** 2026-08-02 · **סוג:** חקירה READ-ONLY. לא שונה קוד, לא בוצע commit, לא הורצה סוויטת Playwright.
**מקור המשימה:** `docs/analysis/2026-08-02-h13-sweep-R1-R25.md` (טריאז' — איתר, לא אבחן).
**שיטה:** כל מצביע בסריקה אומת מחדש בקריאה ישירה; נתיב-הריצה נצעד מהצרכן אחורה
(`docs/process/skills/verify-against-the-runtime-path/SKILL.md`); שכבת הציטוטים נמדדה אחרי המיזוג של
`build.py` ולא ב-`data.py` בלבד; והמצב **המשולח** אומת ב-`dist/index.html`.
**בדיקה מקדימה:** ‏`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` — ‏grep על
`picanha|kebab|פיקאניה|קבב|methodRules|order_smokesv|cold` → **אין פסק קיים על אף אחת משתי השורות**.
ההיטים היחידים הם רקע (`:198` על מודל הבשר הטחון של הקבב, `:209` על ההגדרה "cold ≤30 °C vs hot smoke",
`:1601` הערה על ה-`svh` של הקבב) — אף אחד מהם אינו פסק על R-8 או R-15.

---

# ROW R-8 — ‏`def:['sv','smoke']` לכל נתח עם `doneness`

## 1 · מה ברירת-המחדל הזאת באמת שולטת בו — נתיב-הריצה

**המקור.** ‏`methodRules(c)` ‏— `app.js:1157`. שתי השורות שהסריקה נקבה אומתו מילולית:

```
app.js:1166  if(c.doneness) return {allowed:['sv','smoke','grill'], def:['sv','smoke'], minOne:true,
app.js:1167    invalid:[]};
app.js:1169  return {allowed:['sv','smoke','grill'], def:['sv','smoke'], minOne:true,
app.js:1170    needsCookFor:'grill', invalid:[['grill']]};
```

הטיפול הייעודי היחיד הוא צומח (`app.js:1158`, ‏`def:['grill']`) ואיברים פנימיים (`app.js:1160-1165`).

**הצרכנים** (הודפסו מ-grep ואומתו בקריאה):

| # | צרכן | ‏file:line | מה המשתמש רואה |
|---|---|---|---|
| 1 | `paintMethod()` → `composedSteps(c,combo,smokeFin)` | `app.js:3137` → `app.js:1218` | שלבי המתכון בכרטיס: איזה שלבים נכתבים בכלל, ובאיזה סדר (prep → sv → smoke → grill → rest) |
| 2 | `comboNote(combo)` | `app.js:3123-3134` | פסקת "הצירוף" מעל השלבים |
| 3 | מתגי `.mtoggle` | `app.js:1353`, `app.js:3149-3164` | אילו צ'יפים דלוקים כשנכנסים לכרטיס לראשונה |
| 4 | `itemProfile(meta)` → `comboMethodEntry(c,combo,isCard)` | `app.js:4381` → `app.js:4365` | **שיטת ברירת-המחדל של הפריט בתוכנית** (‏`methods[0]`, ‏`⚡ …(מהכרטיסייה)`) |
| 5 | `itemStages(meta,methodKey,ready,order)` | `app.js:4655` ואילך | **שלבי הציר: אילו שלבי בישול נכנסים ללוח-הזמנים ולכמה זמן** |
| 6 | `gearTag(key)` | `app.js:4270` | תג "🔧 בדוק ציוד" |
| 7 | אשף האירוע — כרטיס-שיטה | `app.js:11524`, `11536`, `11649` | הצ'יפים המסומנים מראש בשלב 3 של האשף |
| 8 | `itemPaths(meta)` | `app.js:4762` | ‏`isDefault:i===0` — איזה Cooking Path מסומן כברירת-מחדל |

בין (4) ל-(5) עוברת שרשרת הזמן: ‏`comboMethodEntry` מחשב
`hours` = ‏`upperHours(c.svh)` + `upperHours(c.smh|c.soh)` + `0.3` לפי הצירוף (`app.js:4368-4371`),
ו-`itemStages` דוחף מזה שלבי `kind:'sv'` / `'smoke'` / `'cook'` עם `hours` ו-`temp`.
המתזמן עובד אחורה מהם — וזה בדיוק מה ש-C2 תיאר.

## 2 · האם זה שגוי לנתחי גריל — עם רשומות הנתחים

כן, ובאופן שהאפליקציה סותרת בו את עצמה.

**רשומות הנתחים** (‏`data.py` ‏+ ‏`sources.py` ממוזג ב-`build.py:85-92`; אומת בהרצת המיזוג בפועל):

| n | פריט | `doneness` | `grillable` | `grt` | `grh` | `svh` | ‏`smh` |
|---|---|---|---|---|---|---|---|
| 6 | Picanha ‏(`data.py:11`, ‏`sources.py:271`) | ✔ (`data.py:968`) | `True` | 230° | 0.75 ש | "2-4" | 0.75 |
| 17 | Kebab ‏(`data.py:22`, ‏`sources.py:640`) | ✔ (`data.py:979`) | `True` | 230° | **0.15 ש (‏9 דק׳)** | "2-3" | 0.33 |

לכל אחד מהם יש **לוח-גריל מצוטט משלו** (`grt`/`grh`/`grz`), ובכל זאת ברירת-המחדל שולחת אותם ל-sv+smoke
של 2-4 שעות. הצרכן של `grillable` קיים ורץ: ‏`app.js:2992` ו-`app.js:3065`.

**הסתירה הפנימית.** ‏`HOME_LANES` ‏(`app.js:11851-11859`) — מסך הבית עצמו — מציב את
`cut-6` (פיקאניה) ואת `cut-17` (קבב) במסלול **`m:'grill'`**. אותה אפליקציה מסווגת אותם כפריטי גריל
במסך אחד ומגדירה להם sv+smoke במסך אחר. זו בדיוק הטענה של M1.

**מדידה על הנתונים הממוזגים** (הורץ; ‏130 נתחים):
‏**56 נתחים נושאים `doneness`, ומתוכם 56 — כלומר 100% — הם `grillable:True`.** ‏0 נתחים עם `doneness`
אינם ניתנים לגריל. כלומר הענף כולו נשלח למסלול שכל פריט בו יכול לרוץ על הגריל.

## 3 · מה היה באג C2 — הדיווח המקורי

`docs/analysis/2026-07-21-walkthrough-defects.md:44-56`:

> **C2 — Auto cooker-assignment double-books the sous-vide bath while the grill sits empty; generates a
> schedule that cannot physically be executed**
> **Actual:** … the **sous-vide immersion bath shows 100% occupied by both Picanha and Kebab
> simultaneously** … while the **kettle grill shows 0%, "free"** at the exact same moment.
> **Root cause:** downstream of Major #M1 below — picanha and kebab are defaulted to sous-vide+smoke
> instead of grill, so the scheduler tries to pack four large items onto two devices instead of
> spreading them across all three owned cookers.
> **Severity: Critical**

והשורש עצמו, `:60-66`:

> **M1 — Grill cuts (picanha, kebab) default to "sous-vide + smoke" instead of grill, contradicting the
> app's own categorization**
> **Actual:** `methodRules()` in `app.js` defaults *every* item with a `doneness` property (all
> "steak-like" cuts) to `['sv','smoke']` … Kebab — a dish that should be a 10-minute grill job — is
> scheduled to **start sous-vide the day before a 19:00 dinner, at 14:41**. This is the direct cause of
> C2 above and inflates the multi-event "smoker clash" count from a real 4 legitimate smoke items to a
> reported "6 items."
> **Severity: Major**

## 4 · השאלה המכריעה — האם זה יכול להשפיע על ערך בטיחות, שלב `bcheck` או משך בישול

**‏`safe` — לא. ‏`bcheck` — לא. משך בישול — כן.** בשלושה חלקים, כל אחד עם הראיה שלו:

**(א) שלב ה-bcheck הוא בלתי-תלוי בצירוף.** ‏`app.js:4752`:

```js
{ const sc = meta.obj ? (meta.obj.safe!=null?meta.obj.safe:meta.obj.tgt) : null;
  if(typeof sc==='number' && sc>0) stages.push({label:`… ${sc}°`, hours:0, kind:'bcheck', temp:sc, …}); }
```

‏`sc` נקרא מ-`meta.obj.safe` (ובהיעדרו `tgt`) בלבד. הוא אינו מכיל `combo`, `m`, `methodKey` או `order`
בשום צורה, והשלב נדחף **מחוץ** לכל ענף-הצירוף (אחרי `if(m.combo){…} else {…}` ואחרי המנוחה). פיקאניה
תקבל bcheck 63° וקבב 71° בכל צירוף שהוא. אותו `sc` הוא גם מה שנשמר ל-`mk-bcheck-due` ‏(`app.js:3725`)
ומה שהתראת-הבטיחות מציגה (`app.js:3677`).

**(ב) אף ערך `safe` או `temp` אינו מומצא על-ידי הצירוף.** ‏`comboMethodEntry` ‏(`app.js:4372-4377`)
בוחר בין שדות שכבר קיימים ברשומת הנתח — `c.svt`, ‏`c.smt`, ‏`c.sot` — ואינו מחשב טמפרטורה חדשה.
בענף ה-smoke→sv, `itemStages` קורא את הציטוט (`osm.t`) ורק בהיעדרו נופל לנוסחת `coldSmokeTemp`
(`app.js:4689`). כלומר בחירת ברירת-המחדל **בוררת בין לוחות מצוטטים, לא ממציאה מספר**.

**(ג) משך הבישול המתוזמן כן משתנה.** ‏`app.js:4368-4370`:

```js
if(combo.includes('sv'))    { svH=upperHours(c.svh);  hours+=svH; }
if(combo.includes('smoke')) { smH=combo.includes('sv')?upperHours(c.smh):upperHours(c.soh||c.smh); hours+=smH; }
if(combo.includes('grill'))   hours+=0.3;
```

לקבב: ‏`['sv','smoke']` → 3 + 0.33 ≈ **3.33 שעות**; ‏`['grill']` → **0.3 שעות**. ההפרש הזה הוא ההזזה
של שעת-ההתחלה אחורה, וזה מה שהפיק את "start sous-vide … at 14:41" ואת התנגשות התפוסה של C2.

**המסקנה.** לפי DoD-10 בניסוחו — "‏No `bcheck` stage, `temp`, `safe` value, or cook duration altered" —
**משך הבישול המתוזמן כן משתנה, ולכן התיקון אינו פטור מהשער**; אבל שער-הבטיחות עצמו (‏bcheck על
`safe`) ‏**בלתי-פגיע**, ואף מספר בטיחות אינו נקבע או נגזר מברירת-המחדל. הפגם הוא **פגם תכנון/UX
בעל השלכת-תזמון**, לא פגם בטיחות. הכיוון גם אינו מסוכן: המעבר מ-sv+smoke לגריל **מקצר** חשיפה
ומשאיר את יעד-הליבה זהה.

## 5 · התיקון המינימלי והמקרה השלילי

**התיקון המינימלי:** שינוי `def` בענף `c.doneness` בלבד — `app.js:1166` — מ-`['sv','smoke']` ל-`['grill']`.
‏`allowed` לא משתנה, ‏`invalid:[]` לא משתנה, ולכן כל הצירופים שהיו חוקיים נשארים חוקיים ו-`validCombo`
(`app.js:1209`) לא זז. שלוש שורות ה-`def` האחרות (`1158`, `1162`, `1164`) והענף הקולגני (`1169-1170`)
אינן נגעות. ‏`gearAwareDefault` ‏(`app.js:1195`) כבר מטפל במשתמש שאין לו גריל.

**⚠️ נקודה שדורשת הכרעת בעלים לפני ביצוע.** ‏`grillable` **אינו** מבחין: כל 56 נתחי ה-`doneness`
הם `grillable:True`, ולכן שינוי בשורה 1166 מזיז את כולם — כולל ירך טלה שלמה 2.5 ק"ג (`n=35`, ‏`svh="6-8"`).
זה ייתכן שנכון (ל-`n=35` יש `grt:260`/`grh:1.25`/`grz:'עקיף→ישיר'` מצוטט), אבל זו **החלטת מוצר על 56
פריטים** ולא רק על פיקאניה וקבב. שלוש חלופות, לבחירת הבעלים:
(א) כל נתחי `doneness` → `['grill']` — הפשוטה והעקבית ביותר;
(ב) רק פריטים ב-`HOME_LANES` של הגריל → `['grill']` — הצרה ביותר, אבל קושרת ברירת-מחדל לרשימת-תצוגה;
(ג) סף על `grh` (למשל `grh ≤ 1`) → `['grill']`, והשאר נשארים sh+smoke — נגזר מנתונים מצוטטים,
ומשאיר את ירך-הטלה במסלול הארוך.
**אין להרים את השורה בלי הכרעה בין השלוש** — כל אחת מהן משנה קבוצת-פריטים שונה.

**המקרה השלילי שהבדיקה חייבת לכסות** (‏DoD §3.6): נתח קולגני ארוך ללא `doneness` — בריסקט, `cut-1` —
חייב **להישאר** ‏`def:['sv','smoke']` עם `needsCookFor:'grill'` ו-`invalid:[['grill']]`
(`app.js:1169-1170`), כך שגריל-בלבד נשאר פסול עבורו ו-`validCombo` ממשיך להחזיר `false`.
כמו כן: צומח נשאר `['grill']`, וגיזרד נשאר `require:['sv']`.

## 6 · שחזוריות ואסרשן הבדיקה

**שחזורי היום במוצר המשולח.** ‏`dist/index.html` (‏offset 1,104,490) מכיל את `methodRules` **מילה במילה**
כמו `app.js:1157-1170`, כולל `if(c.doneness) … def:['sv','smoke']`. הפונקציה טהורה ודטרמיניסטית ותלויה
רק ב-`c.doneness`, ולפיקאניה ולקבב יש `doneness` בחבילה המשולחת (אומת: ‏`"doneness"` על רשומת Picanha
ב-`dist/index.html`). אין דגל, אין A/B, אין מצב-משתמש שמעקף.

**האסרשן הקטנה והנצפית ביותר** — על פלט מרונדר שצרכן אמיתי קורא, לא על שדה מחושב:
פותחים בקליק את כרטיס פיקאניה (`cut-6`) ובודקים את מתגי השיטה ב-`#panel`:
`[data-mt="grill"]` נושא `.on` ו-`[data-mt="sv"]` **אינו** נושא `.on`; ובמקביל
`#methodArea .method-note` מכיל "🔥 גריל" ואינו מכיל "🌊 סו-ויד".
**המקרה השלילי באותה בדיקה:** לבריסקט (`cut-1`) — `[data-mt="sv"]` ו-`[data-mt="smoke"]` נושאים `.on`,
ו-`[data-mt="grill"]` אינו.
**עוגן אי-שינוי-הבטיחות (DoD-10):** באותה בדיקה, שלב ה-`bcheck` של פיקאניה בציר נושא `יעד 63°`
**בשני הצירופים** — לפני התיקון ואחריו — כי `app.js:4752` קורא `meta.obj.safe` ולא את הצירוף.

---

# ROW R-15 — שלושה ציטוטי `cold:True` בכבש (n-35 / n-36 / n-60)

## 1 · מה `cold:True` עושה בפועל — הצרכנים, לא ההגדרה

שני צרכנים בלבד, ושניהם **תווית בלבד**:

**צרכן א' — כרטיס המתכון, גוש המקורות.** ‏`sourcesBlock(c)` ‏— `app.js:3027`:

```js
if(ob) order+=`… ${L('עישון','smoke','inline')} ${ob.smoke.t}°/${ob.smoke.h}${hh}${ob.smoke.cold?
  ` <span style="opacity:.65">(${L('עישון קר','cold smoke','inline')})</span>`:''} → …`;
```

הטמפרטורה שמוצגת היא `ob.smoke.t` — היא נקראת **בלי קשר** לדגל; הדגל מוסיף רק את הסוגריים.
הגוש נרנדר בכל פתיחת כרטיס שיש לו `order_smokesv` — כלומר **תמיד** לשלושת נתחי הכבש האלה.

**צרכן ב' — שלבי הציר.** ‏`itemStages` ‏— `app.js:4698`:

```js
const smokeLbl=(osm.cold===true)?L('עישון קר','Cold smoke'):L('עישון','Smoke');
```

ומיד לפניו, `app.js:4689-4690`, מה שבאמת קובע את המספרים:

```js
const coldT  =(osm.t!=null)?osm.t:coldSmokeTemp(m.smTemp);
const coldHrs=(osm.h!=null)?upperHours(osm.h):Math.max(2, Math.round((m.smHours||2)*0.6));
```

**‏`osm.cold` אינו מופיע באף ביטוי שמחשב `temp`, `hours`, ‏`safety` או `bcheck`.** הוא נכנס אך ורק ל-
`smokeLbl`. ‏grep על `cold` בכל `app.js` מחזיר את שני האתרים האלה כצרכנים היחידים של הדגל
(‏`app.js:4730` הוא הענף המקביל ב-`order_svsmoke`, שאין בו `cold:True` בנתונים בכלל).
ענף ה-smoke→sv נפתח רק כאשר `comboHasSvSmoke` מאשר `sv.pasteurize===true` — ולשלושת הנתחים יש
‏`'pasteurize': True`, כך שהמסלול אכן מוצע.

**מסקנת (1):** ‏**‏`cold:True` הוא דגל-תצוגה. הוא לא משנה שום טמפרטורה, שום משך, ולא את `bcheck`.**

## 2 · שלושת הציטוטים במלואם — האם התג שגוי, הטמפ' שגויה, או שהמונח משמש אחרת

שלושתם קיימים כלשונם, ושלושתם משולחים (‏3 מופעים של `"cold":true` ב-`dist/index.html` — בדיוק אלה):

**‏n=35 · Leg of Lamb** ‏(`data.py:40`; ‏`sources.py:1063` ואילך), ‏`sources.py:1094-1101`:
```python
'order_smokesv': {'smoke': {'t': 60, 'h': '1-2', 'cold': True},
                  'sv': {'t': 57, 'h': '5.25', 'pasteurize': True},
                  'ref': 'Baldwin — Practical Guide to Sous Vide, Table 5.1 (Beef/Pork/Lamb pasteurization; start 41°F/5°C)',
                  'url': 'https://douglasbaldwin.com/sous-vide.html',
                  'note': 'Reverse order for an intact whole-muscle leg: cool/warm smoke raw (~50-60°C) for '
                          'smoke ring, then sous-vide to full pasteurization. Baldwin Table 5.1, 70mm at 57°C '
                          "= 5¼h (at 55°C = 6½h, 60°C = 4h). Keep total danger-zone time under Baldwin's 4h "
                          'rule during the smoke phase.'}
```

**‏n=36 · Rack of Lamb** ‏(`data.py:41`), ‏`sources.py:1132-1139`:
```python
'order_smokesv': {'smoke': {'t': 55, 'h': '0.5-1', 'cold': True},
                  'sv': {'t': 57, 'h': '3.25', 'pasteurize': True},
                  'ref': 'Baldwin — Practical Guide to Sous Vide, Table 5.1 (Beef/Pork/Lamb; start 41°F/5°C)',
                  'note': 'Reverse order for an intact whole-muscle rack: brief cool smoke, then sous-vide to '
                          'pasteurization. Baldwin Table 5.1 50mm at 57°C = 3¼h (55°C = 4½h, 60°C = 2½h); a '
                          'rack is thinner than 50mm so this time is conservatively sufficient. Observe the 4h '
                          'danger-zone rule during smoke.'}
```

**‏n=60 · Lamb Loin** ‏(`data.py:65`), ‏`sources.py:1241-1248`: זהה ל-36 בפרמטרים
(`{'t': 55, 'h': '0.5-1', 'cold': True}` → `sv 57°/3.25h pasteurize`), עם ההערה
`'Reverse order for an intact whole-muscle loin: brief cool smoke … Baldwin Table 5.1 50mm at 57°C = 3¼h … Observe the 4h danger-zone rule during smoke.'`

**מה המקור הראשוני באמת אומר.** ‏`ref` בשלושתם הוא **Baldwin, Table 5.1** — טבלת **פסטור לפי עובי
וטמפרטורה**. הטבלה הזאת מספקת את זמן ה-sv (‏70mm@57° = 5¼h; ‏50mm@57° = 3¼h) — והציטוטים אכן מצטטים
אותה נכון עבור **שלב ה-sv**. ‏**Table 5.1 אינה מכילה טמפרטורת עישון כלשהי.** לכן `smoke.t` ‏(55/60°)
**אינו מצוטט מהמקור הנקוב** — הוא בחירה טכנית של המחבר, כפי ש-`note` עצמו מודה במילים
"cool/warm smoke raw (~50-60°C)". דפוס ההודאה הזה מופיע במפורש במקום אחר באותם ערכים —
`sources.py:1113-1114`: *"smt 100°C/0.5h is a technique choice (no exact quoted figure)"*.

**איך המונח משמש כאן.** הקוד עצמו מגדיר "עישון קר" כטווח 45-70°C:
```
app.js:4425  // app-computed (not AI, not user-typed) conservative cold-smoke temperature ceiling …
app.js:4426  function coldSmokeTemp(hotTemp){ const t=Math.round((hotTemp||110)*0.55); return Math.max(45, Math.min(70, t)); }
```
ולשניים מהשלושה המספר בציטוט הוא **בדיוק** פלט הנוסחה: ‏`c.smt=100` → `Math.round(55)=55` — כלומר
n=36 ו-n=60 נושאים 55° שהוא ערך הנוסחה הפנימית של האפליקציה, בעוד ה-`ref` מצביע על Baldwin.
‏(ל-n=35: ‏`c.smt=110` → הנוסחה נותנת 61, והציטוט נושא 60.)

**ההקשר בתוך אותו שדה עצמו — ההשוואה המכריעה.** יש 13 ערכי `order_smokesv` בסך הכול (נמדד):

| טווח | מספר | ‏`cold` | ‏`ref` |
|---|---|---|---|
| ‏75°C | 8 (Brisket, Short Ribs, Chuck, Back Ribs, Chuck Short Ribs, Shank, Short Plate, Chuck Roast) | `False` | Baldwin — pasteurization by thickness |
| ‏70°C | 2 (Beef Cheeks, Oxtail) | `False` | Baldwin — pasteurization by thickness |
| ‏55-60°C | **3 (הכבש)** | **`True`** | Baldwin — Table 5.1 |

שלושת הכבשים חורגים בשני צירים בבת-אחת: גם הטמפרטורה וגם התג. יש לזה **הסבר טכני עקבי**: שלושתם
נתחי medium-rare עם `sv` ב-57°, ולכן קדם-העישון חייב להישאר מתחת ליעד — 55° אכן מתחת ל-57°.
(**חריגה בתוך החריגה:** ל-n=35 העישון הוא **60°, מעל** ה-sv של 57°. זה אינו עקבי עם ההיגיון הזה
ואינו מוסבר באף הערה. מסומן לבעלים — לא ניתן להכריע בלי מקור.)

**ההכרעה המילולית: התג שגוי במונחים של האפליקציה עצמה.** האפליקציה מגדירה "עישון קר" בשני מקומות
נוספים, ובשניהם ≤25-30°C:
- **המילון הפנימי, מוצג למשתמש** — `data.py:201`:
  `("עישון","עישון קר","Cold Smoke","עישון בטמפ' ≤30° ללא בישול — לגבינות, דגים ונקניקים מיובשים. דורש מחולל עשן.")`
- **פרופיל "דג מעושן"** — `app.js:4309`: ‏`{key:'cold',label:'עישון קר',tempC:'≤25°',hours:5,note:'ללא בישול — לקס/גרבלקס'}`
- ובנתונים: גבינות מעושנות ב-`smt=28` עם ההערה `"עישון קצר ובטמפ' נמוכה מאוד (≤28°C)"` ‏(`data.py:159`).

כלומר המשתמש רואה בכרטיס אחד "עישון קר = ≤30°, ללא בישול" ובכרטיס אחר "עישון 60°/1-2ש **(עישון קר)**".
**זו סתירה פנימית באותה אפליקציה, לא רק חריגה ממוסכמה חיצונית.**

**הפסק:** ‏**התג שגוי; הטמפרטורה אינה מוכחת שגויה** (יש לה הצדקה טכנית — מתחת ליעד ה-sv — אך אין לה
מקור ראשוני מצוטט). המונח אכן משמש כאן במשמעות שלישית ("קר ביחס לעישון חם", 45-70° לפי `coldSmokeTemp`)
שאינה מתועדת בשום מקום שהמשתמש רואה.

## 3 · האם תג שגוי יכול להפיק הוראה לא-בטוחה

**מה האפליקציה אומרת בפועל למשתמש:**
- בכרטיס: ‏`עישון 60°/1-2ש (עישון קר) → סו-ויד 57°/5.25ש (פסטור מלא)` ‏(`app.js:3027`), ומתחתיו
  הערת-הציטוט **כלשונה באנגלית** (`orderNoteHTML`, ‏`app.js:3007-3011` — "NO data-mt … must render AS
  STORED"), כלומר ‏*"Keep total danger-zone time under Baldwin's 4h rule during the smoke phase."*
- בציר: שלב `עישון קר 60°` ‏(`app.js:4703`) עם `sub` = *"עישון קצר — הפסטור המלא בסו-ויד"* ‏(`app.js:4701`),
  ואחריו `סו-ויד 57° (כולל פסטור)` עם `safety:'pasteur'` ‏(`app.js:4706`).

**הערכת הסיכון, בראיות:**
1. **המספר תמיד מוצג לצד התווית.** ‏60°/55° נכתבים במפורש; אין מסך שאומר "עישון קר" בלי הטמפרטורה.
2. **שער הבטיחות במורד הזרם ואינו תלוי בדגל.** ה-sv ב-57° עם `pasteurize:True` הוא הפסטור, ושלב ה-`bcheck`
   הסופי מגיע מ-`meta.obj.safe` = ‏**63°** לשלושת הנתחים (‏`app.js:4752`) — לא מהדגל ולא מהצירוף.
3. **הכיוון של אי-ההבנה האפשרית.** משתמש שיפעל לפי המשמעות הקלאסית של "עישון קר" ויוריד את המעשנת
   ל-≤30° יאריך את שהיית הבשר הגולמי באזור-הסכנה — אך הוא מקבל באותה שורה גם את הכלל המפורש
   ("‏4h danger-zone rule") וגם את הפסטור המלא ב-sv אחריו.

**הפסק:** ‏**אין נתיב שבו הדגל עצמו מפיק מספר לא-בטוח.** הוא מפיק **הוראה סותרת את עצמה** —
"קר" לצד "60°" — כשההגדרה שהאפליקציה עצמה מלמדת היא ≤30°. זהו **פגם מינוח/אמון**, לא פגם בטיחות.

## 4 · התיקון המינימלי

**התיקון המינימלי, ואינו נוגע באף מספר:** להחליף `'cold': True` ל-`'cold': False` בשלושת המקומות —
`sources.py:1094`, ‏`sources.py:1132`, ‏`sources.py:1241` — ולהשאיר `t` ו-`h` **כפי שהם**.
התוצאה: התווית הופכת ל-"עישון" רגיל (`app.js:4698`), הסוגריים "(עישון קר)" נעלמים מהכרטיס
(`app.js:3027`), והשורה מתיישרת עם 10 ערכי ה-`order_smokesv` האחרים שכולם `cold:False`.
‏**אף `temp`, אף `hours`, אף `safe` ואף שלב `bcheck` לא זזים** — ולכן זה תיקון תואם-DoD-10 מלא.

**⚠️ מה שאני לא מציע, ולמה.** אני **לא** מציע לשנות את 55/60° ל-≤30° ולא לשום מספר אחר.
ההצדקה לכל שינוי מספרי כאן חייבת לצאת ממקור ראשוני, ו-**המקור הנקוב היום אינו מכיל את הנתון**:
Baldwin *Practical Guide to Sous Vide*, Table 5.1, הוא טבלת זמן-פסטור לפי עובי וטמפרטורת-אמבט;
הוא מספק את `sv.t`/`sv.h` (‏70mm@57°=5¼h; ‏50mm@57°=3¼h — אומתו נגד ההערות) ו**אינו קובע טמפרטורת עישון**.

**מה שדורש עיון במקור ראשוני / הכרעת בעלים** (‏שני פריטים, שניהם מספריים ולכן מחוץ לסמכותי):
- **‏(א) תקרת cold-smoke.** אם רוצים להישאר עם המילה "קר", צריך מקור שקובע את התקרה. המקור המתאים הוא
  **USDA/FSIS — *Smoking Meat and Poultry*** (הגדרת cold smoking וכללי הזמן/טמפ' באזור-הסכנה),
  ו/או **9 CFR §318.7 / §381.147** לתהליכי עישון. אני **לא** מצטט מהם מספר כאן — הם לא נקראו במסגרת
  החקירה הזאת ואני לא ממציא ערך בטיחות.
- **‏(ב) החריגה של n=35: עישון 60° מעל sv 57°.** לשני הנתחים האחרים העישון (55°) נמוך מה-sv (57°);
  ב-n=35 הוא **גבוה** ממנו. אין הערה שמסבירה זאת ואין ל-`smoke.t` מקור מצוטט. **דורש הכרעת בעלים**
  אם לפתוח בדיקת-מקור נפרדת, או להשאיר כפי שהוא (התיקון המינימלי לעיל אינו נוגע בו).

## 5 · שחזוריות ואסרשן הבדיקה

**שחזורי היום במוצר המשולח.** ‏`dist/index.html` מכיל **בדיוק 3** מופעים של `"cold":true` — שלושת
הכבשים. הענף המרנדר (`app.js:3027`) רץ בכל פתיחת כרטיס של אחד מהם, ללא תלות בבחירת המשתמש; ענף הציר
(`app.js:4698`) רץ כשנבחר סדר smoke→sv, שמוצע כי `pasteurize:True`.

**האסרשן הקטנה והנצפית ביותר:** פותחים בקליק את כרטיס ירך-הטלה (`cut-35`), גוללים לגוש
"📚 מקורות ואימות" → "🔀 השפעת סדר", ובודקים שהשורה "עישון→סו-ויד" **אינה** מכילה את המחרוזת
`עישון קר` (‏`(cold smoke)` באנגלית). זהו טקסט מרונדר שהמשתמש קורא, לא שדה מחושב.
**המקרה השלילי:** באותה בדיקה, בריסקט (`cut-1`) — שגם לו יש `order_smokesv` ‏(`75°`, `cold:False`) —
מציג את אותה שורה **בלי** "עישון קר" גם היום; הוא מוודא שהאסרשן בודקת את הדגל ולא את היעדר הבלוק.
**עוגן אי-שינוי-הבטיחות:** באותה בדיקה, המספרים בשורה נשארים `60°/1-2ש → 57°/5.25ש` לפני ואחרי.

---

## סיכום ההכרעות שממתינות לבעלים

| # | שורה | ההכרעה |
|---|---|---|
| 1 | R-8 | בחירה בין (א) כל 56 נתחי `doneness` → `['grill']` · (ב) רק פריטי מסלול-הגריל ב-`HOME_LANES` · (ג) סף על `grh`. ‏`grillable` אינו מבחין — 56/56. |
| 2 | R-15 | האם להסתפק בתיקון-התווית (`cold:True`→`False` ×3, אפס שינוי מספרי), או לפתוח עיון ב-USDA/FSIS *Smoking Meat and Poultry* / 9 CFR §318.7 לתקרת cold-smoke מצוטטת. |
| 3 | R-15 | ‏n=35: עישון 60° מעל ה-sv של 57°, ללא הסבר וללא מקור ל-`smoke.t`. לפתוח בדיקה נפרדת או להשאיר. |
