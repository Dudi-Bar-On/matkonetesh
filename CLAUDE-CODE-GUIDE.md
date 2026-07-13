# מדריך ל-Claude Code — פרויקט "מתכונת · מדריך האש"

מסמך זה נועד להעביר ל-Claude Code (או כל agent) כדי שיכיר את הפרויקט, יבין את
הארכיטקטורה, ויקים חבילת בדיקות **Playwright** שתתפוס באגי-UI לפני שהם מגיעים
למשתמש. קרא אותו **במלואו** לפני שתיגע בקוד.

> מבוסס על גרסה **v143** של האפליקציה (הקוד המצורף עדכני לגרסה זו).

---

## 1. מה זה הפרויקט (בקצרה)

**"מתכונת · מדריך האש" (Matkonet)** — אפליקציית PWA עברית-first (RTL) לבישול-אש:
סו-ויד, עישון, גריל ושרקוטרי. מבשר ופירות-ים ועד גבינות וירקות — מהחומר-גלם ועד
הצלחת. כוללת קטלוג של ~279 פריטים, 102 מלאכות בנייה-מאפס, מחשבוני מלח/ריפוי,
מתזמן ציר-זמן, מזווה/פרויקטים, אשף-אירוע, ו**שכבת AI אופציונלית (BYOK — Gemini)**
עם 7 יכולות + ממשק קולי דו-לשוני.

- **קהל:** משתמש יחיד (בעל האפליקציה) — חובב-אש מתקדם, עובד בעברית, נייד.
- **פרטיות:** local-first. כל נתוני-המשתמש ב-`localStorage` (בלי שרת, בלי חשבון).
- **הפצה:** Cloudflare Pages. ידנית (index.html + site/) או auto-deploy מ-GitHub (build: `python build.py`).

---

## 2. ארכיטקטורה — קריטי להבנה

### 2.1 מקור-אמת יחיד: `build.py` → `index.html`
האפליקציה כולה היא **קובץ HTML יחיד** (`index.html`, ~1.1MB) שרץ בכל דפדפן בלי
התקנה. **לא עורכים את `index.html` ידנית** — הוא **נוצר** על-ידי `build.py`:

```
python3 build.py    # קורא את קבצי ה-py + כותב index.html
```

`build.py` (~7150 שורות) מכיל את **כל** ה-HTML/CSS/JavaScript של האפליקציה
כמחרוזות-פייתון, ומזריק לתוכן את נתוני-הדאטה מקבצי-פייתון נפרדים. כל שינוי בקוד
או בעיצוב נעשה **ב-`build.py`**, ואז מריצים build.

### 2.2 גרף התלויות (מה build.py מייבא)
```
build.py
 ├── data.py            → CUTS(130), SPECIALS(47), GLOSSARY(52), BUILDS, MAKES
 ├── seasonings.py      → SEASONINGS (בסיס)
 ├── seasonings_ext.py  → SEASONINGS_EXT (הרחבה)
 ├── seasoning_tags.py  → SEASONING_TAGS (flavor/base/heat)
 ├── house_rub_map.py   → HOUSE_RUB_MAP
 ├── sausages_new.py    → NEW_SAUSAGES(52), ORIGINS
 └── descriptions.py    → CUT_DESC, SPEC_DESC, SPEC_ORIGIN
```

**קבצי-פייתון שהם dev-only ולא נדרשים לבנייה** (מחוללים חד-פעמיים; אפשר להתעלם):
`descs.py`, `gen_house.py`, `gen_tags.py`.

### 2.3 שכבת האחסון
עטיפה בת 2 שורות מעל `localStorage`:
```js
const store={ get(k){...JSON.parse...}, set(k,v){...JSON.stringify...} };
```
כל נתוני-המשתמש עוברים דרכה (~32 מפתחות `mk-*`). **חשוב לבדיקות:** ערכים נשמרים
כ-JSON — לכן ב-Playwright, כדי לזרוע state צריך `JSON.stringify`:
```js
localStorage.setItem('mk-gemkey', JSON.stringify('FAKE-KEY'));
localStorage.setItem('mk-context', JSON.stringify('event'));
```

מפתחות עיקריים: `mk-menu` (התפריט הפעיל), `mk-context` (cook/event — קובע איזה תפריט),
`mk-pantry` (פרויקטים), `mk-inventory`, `mk-journal`, `mk-fav`, `mk-gear`,
`mk-gemkey` (מפתח Gemini — נוכחותו מפעילה את שכבת ה-AI), `mk-tlstate` (מצב מתזמן),
`mk-umakes` (מתכוני-AI שנוצרו), `mk-vclang`/`mk-vcanslang` (שפת ממשק קולי).

### 2.4 עקרונות שכבת ה-AI (P1–P7) — לא לשבור
כל 7 יכולות ה-AI מצייתות ל: **grounded-only** (ה-AI בוחר רק מהקטלוג — כל key
שאינו קיים נזרק), ו**never-invent-safety-numbers** (מלח/ריפוי/טמפ׳ תמיד מהאפליקציה,
לא מה-AI). ראה `ai-prd.md` ו-`ai-implementation-plan.md` המצורפים.

---

## 3. מבנה ה-UI (מסכים, ניווט, זרימות)

### מסכים (`id="scr-*"`)
`scr-home` · `scr-catalog` · `scr-wizard` · `scr-events` · `scr-projects`

### ניווט תחתון
כפתורים עם `data-cnav="home|catalog|wizard|events|projects"`.

### פאנלים
רוב הפעולות פותחות **פאנל מודאלי** — `showPanel(html)` מזריק ל-`#panel` וקורא לו
`.open`. סגירה: כפתור `.x` או `closePanel()`.

### זרימות מרכזיות שכדאי לכסות ב-E2E
1. **אשף אירוע:** `data-cnav="wizard"` → 6 שלבים (בסיס→בחירת-פריטים→שיטות→תיבול→
   תוספות→סקירה). המעבר: `cwGo(n)`. שלב הסקירה = 5.
2. **בורר-פריטים באשף (step 1):** רשימה ב-`#cwPickList`, פריטים עם `data-cwpick="<key>"`,
   טוגל-כשרות `#cwKosher` (צריך לסנן חזיר בלחיצה).
3. **מתזמן/תוכנית-עבודה:** `openTimeline()` בונה משימות ל-`window._wpTasks`. תצוגת
   "תוכנית עבודה" (`mk-tlview="plan"`). בורר-שיטה per-item: `data-tlmethod="<key>"`.
4. **מזווה/פרויקטים:** כפתורים `#cProjWcim` (מה אפשר להכין), `#cProjAdv` (יועץ תזמון),
   `#cProjGen` (מחולל מתכונים). כרטיס-פרויקט עם `data-cprecipe` (מתכון מלא).
5. **אירועים:** `#cEvAiPlan` (מתכנן-אירוע AI), `#cEvNew` (אירוע חדש).
6. **מצב הצילו:** `openHelp()` → `#tAiDiag` (אבחון AI).
7. **יומן:** `openJournal()` → `#jInsights` (תובנות AI).
8. **בישול קולי:** `openVoiceCook(tasks)` → `#vcBody`. שדה-שאלה מוקלד `#vcAskInput`,
   טוגל-שפה `data-vc="lang-en|lang-he|anslang-en|anslang-he"`.

### מפתחות (keys) של פריטים
`cut-<n>` (נתחים) · `spec-<n>` (מיוחדים) · `make-<id>` (מלאכות) · `umake-<id>`
(מתכוני-AI). `resolveItem(key)` מחזיר meta לכל אחד. `kosherStatus(key)` מחזיר
`kosher|pork|shellfish` (קטגוריה `חזיר` תמיד `pork`).

---

## 4. קבצים להעביר ל-Claude Code

העבר את **כל** אלה (שמור על מבנה התיקיות):

### נדרש לבנייה (שורש הפרויקט)
```
build.py
data.py
seasonings.py
seasonings_ext.py
seasoning_tags.py
house_rub_map.py
sausages_new.py
descriptions.py
```

### נכסי-אתר (תיקיית site/)
```
site/manifest.webmanifest
site/icon-192.png
site/icon-512.png
site/README.txt
site/product.html          # דף שיווק חיצוני (סטטי, לא נוצר מ-build)
```

### מסמכים (לרקע — לא חובה לבנייה, אבל חשוב להיכרות)
```
ai-prd.md                  # מפרט 7 יכולות ה-AI + 7 העקרונות
ai-implementation-plan.md  # ארכיטקטורת השכבה + מפת-גרסאות
CLAUDE-CODE-GUIDE.md       # המסמך הזה
```

### לא צריך להעביר
- `index.html` / `matkonet-esh.html` — **נוצרים** מ-build. (אפשר להעביר כ-reference,
  אבל Claude Code ייצר אותם מחדש.)
- `descs.py`, `gen_house.py`, `gen_tags.py` — מחוללים dev-only.
- קבצי בדיקות ישנים (harness.js וכו') — Claude Code יכתוב Playwright חדש.

> טיפ: הדרך הכי נקייה היא להעביר את **כל תיקיית הפרויקט** (git repo אם יש), ולציין
> במפורש ש-`index.html` הוא artifact שנוצר.

---

## 5. המשימה ל-Claude Code: הקמת Playwright

### 5.1 למה Playwright דווקא
כל הבאגים האחרונים בפרויקט היו **באגי-חיווט ב-UI**: כפתור שמעדכן state אבל לא
מרנדר מחדש, פילטר שלא מיושם על הרשימה, שיטה שלא מסתנכרנת מהכרטיס לתוכנית. בדיקות-
יחידה (לוגיקה מבודדת) **פספסו** אותם. Playwright מריץ את האפליקציה בדפדפן אמיתי,
לוחץ, ובודק **מה מוצג בפועל** — בדיוק סוג הבאגים האלה.

### 5.2 setup מבוקש
```bash
npm init -y
npm install -D @playwright/test
npx playwright install chromium
```
- הגדר `playwright.config.ts` עם `webServer` שמריץ `python3 build.py` ואז מגיש את
  `index.html` (למשל `python3 -m http.server` על תיקיית הפלט), baseURL מתאים.
- הרץ build לפני הבדיקות (בכל שינוי ב-build.py צריך rebuild).

### 5.3 stubs חובה (אחרת הבדיקות לא-דטרמיניסטיות/עולות כסף)
1. **Gemini API** — יירט את `https://generativelanguage.googleapis.com/**` דרך
   `page.route(...)` והחזר תשובות-מוק. אל תבצע קריאות-רשת אמיתיות.
   - האפליקציה כבר כוללת test-seams פנימיים: `window.__aiMock`, `window.__vcAskMock`,
     `window.__vcTransMock`. אפשר לזרוע אותם מ-`page.addInitScript` במקום route.
2. **Web Speech API** — `SpeechRecognition`/`speechSynthesis` לא ניתנים לאוטומציה.
   - הזרק stub ב-`addInitScript`. לבדיקת ה-Q&A הקולי, השתמש בשדה-הטקסט `#vcAskInput`
     (עוקף זיהוי-דיבור) — הוא ניתן לבדיקה מלאה.
3. **מפתח AI** — זרע `localStorage['mk-gemkey']=JSON.stringify('TEST')` להפעלת מסלולי-AI,
   או השאר ריק לבדיקת מסלולי-הנפילה (graceful degradation).

### 5.4 תרחישים לכיסוי (smoke + regression)
כתוב לפחות את אלה, כל אחד כ-spec נפרד:

**ניווט בסיסי**
- טעינה נקייה → מסך בית מוצג, ניווט תחתון עובר בין 5 המסכים.

**קטלוג + סינון-כשרות** *(באג עבר!)*
- קטלוג → קבוצת "בשר אדום" → נתחי-חזיר מוצגים.
- לחיצה על "כשר בלבד" (`[data-f="kosher"]`) → **כל** נתחי-החזיר נעלמים; כיבוי → חוזרים.

**אשף אירוע (מלא)**
- `data-cnav="wizard"` → step 0 בסיס → step 1 בחירת-פריטים.
- ב-step 1: `#cwKosher` → כל `data-cwpick` של חזיר נעלמים מ-`#cwPickList`. *(באג עבר!)*
- בחר 2-3 פריטים → step 2 שיטות → בחר sv+גריל לפריט → ... → step 5 סקירה.
- מסקירה: "תוכנית עבודה" → מכילה שלב **סו-ויד** לפריט שבחרת sv אליו. *(באג עבר!)*

**בישול קולי דו-לשוני** *(דרך שדה-טקסט, לא דיבור)*
- `openVoiceCook` → `#vcAskInput` קיים.
- טוגל `anslang-en` → הקלד שאלה → תשובה במסלול-אנגלית (עם __vcAskMock שמכבד את
  `vcAnsLang`). טוגל `anslang-he` → מסלול-עברית. *(באג עבר!)*
- הקראת-תוכן: `anslang-en` + כפתור "הקרא" → קריאת-תרגום מופעלת (__vcTransMock). *(באג עבר!)*
- טוגל-השפה מוצג **גם בלי מפתח AI** (בורר `data-vc="lang-en"`); בישול קולי מהאשף
  (`#cwVoice` בסקירה) נטען עם משימות ולא ריק. *(באגים עברו!)*

**סינון כשרות — עקביות מלאה** *(משפחת באגים חוזרת — כסה ביסודיות!)*
- קטלוג: קבוצת "בשר אדום" → "כשר בלבד" (`[data-f="kosher"]`) → כל נתחי-חזיר נעלמים;
  **הצ'יפ נשאר משקף 'on'** גם אחרי rebuild של סרגל-הסינון (בדוק `buildFilterBar`). *(באג עבר!)*
- **צ'יפי תת-קטגוריה**: עם כשר פעיל — צ'יפ שכל פריטיו לא-כשרים (חזיר, בייקון) **נעלם**;
  צ'יפ עם חלק כשר (פירות ים) **נשאר** אבל הספירה יורדת (18→2). בדוק
  `allCatCounts(true)` מול `allCatCounts(false)`. *(באג עבר!)*
- אשף picker: `#cwKosher` → כל `data-cwpick` של חזיר נעלמים מ-`#cwPickList`. *(באג עבר!)*
- **שורש משותף לכל אלה:** state שמשתנה בלי שהרינדור/הוויזואל עוקב. זה בדיוק סוג
  הבאג ש-Playwright תופס ובדיקות-יחידה מפספסות.

**מתזמן — סנכרון שיטה** *(באג עבר!)*
- אשף → בחר sv+גריל לחציל (או כל פריט) → סקירה → "תוכנית עבודה" → **מכיל שלב סו-ויד**.
  ברירת-המחדל של השיטה בתוכנית עוקבת אחרי הכרטיס אלא אם המשתמש ננעץ במפורש
  (`methodPinned`) בבורר `data-tlmethod`.

**מזווה/פרויקטים + מחולל-AI**
- זרע `mk-gemkey` + `window.__aiMock` → `#cProjGen` → הקלד תיאור → "צור מתכון" →
  פאנל-אישור עם badge "לא-מאומת" → שמור → מופיע ב"המתכונים שלי".
- מ-כרטיס-הפרויקט של umake: "📖 מתכון מלא" → **מציג שלבים** (לא ריק). *(באג עבר!)*
- אמת P3: mock שמזריק `salt:999,cure:'FAKE'` → ה-calc שנשמר בטוח (מהאפליקציה).

**מתכנן-אירוע AI + double-guard כשרות**
- `#cEvAiPlan` → mock שמחזיר פריט-חזיר לבקשה "כשר" → הפריט **נזרק**, לא נטען לתפריט.

**בישול קולי דו-לשוני** *(דרך שדה-טקסט, לא דיבור)*
- `openVoiceCook` → `#vcAskInput` קיים.
- טוגל `anslang-en` → הקלד שאלה → תשובה במסלול-אנגלית (עם __vcAskMock שמכבד את
  `vcAnsLang`). טוגל `anslang-he` → מסלול-עברית. *(באג עבר!)*
- הקראת-תוכן: `anslang-en` + כפתור "הקרא" → קריאת-תרגום מופעלת (__vcTransMock). *(באג עבר!)*

**נפילה-בחן (בלי מפתח)**
- בלי `mk-gemkey`: כל כפתורי-ה-AI מוסתרים/מציגים הצעת-חיבור; המסלולים המקומיים עובדים.

### 5.5 עקרונות עבודה (הטמע כ-CLAUDE.md בפרויקט)
- **תמיד** `python3 build.py` לפני הבדיקות; אמת `node --check` על ה-JS המחולץ.
- **לכל באג חדש שמתגלה → כתוב בדיקת-רגרסיה** שנכשלת לפני התיקון ועוברת אחריו.
- שנה רק ב-`build.py`, לעולם לא ב-`index.html`.
- בדוק **התנהגות נצפית** (מה ב-DOM/במסך), לא רק לוגיקה פנימית.
- **היגיינת-בדיקות (שיעור מהניסיון):** אל תצבור בדיקות בהוספה עיוורת לקובץ אחד —
  זה יוצר בלוקים כפולים שדורכים זה על זה דרך state גלובלי דולף (למשל `filters` שנשמר
  בין תרחישים), ומנפח ספירות. ב-Playwright כל spec מבודד עם `beforeEach` שמאפס
  `localStorage` ומצב — נצל את זה. אם תרחיש תלוי בסדר, אפס במפורש בתחילתו.
- שמור על העיצוב ("Warm Cream" theme — משתני-CSS `--fresh`, `--ember` וכו').
- אל תפר את עקרונות ה-AI (grounded-only, safety-from-app).

---

## 6. פקודות מהירות (cheat-sheet)

```bash
# בנייה
python3 build.py                      # → index.html

# אימות שה-JS תקין (מחלצים ומריצים node --check)
python3 -c "import re; h=open('index.html',encoding='utf-8').read(); \
open('/tmp/app.js','w').write(h[h.index('<script>')+8:h.rindex('</script>')])" \
&& node --check /tmp/app.js

# בדיקות
npx playwright test
npx playwright test --ui              # מצב אינטראקטיבי
npx playwright show-report

# הפצה: Cloudflare Pages — ידנית (index.html + site/) או auto-deploy מ-GitHub (build: python build.py)
```

---

## 7. שאלות שכדאי ש-Claude Code ישאל את עצמו לפני שמסיים
- האם כל זרימה מרכזית מכוסה בבדיקה שרצה בדפדפן אמיתי?
- האם כל קריאות-הרשת (Gemini) ממוקמקות? אין קריאה אמיתית בבדיקות?
- האם יש בדיקת graceful-degradation לכל יכולת-AI (בלי מפתח)?
- האם הוספתי רגרסיה לכל אחד מ-8 הבאגים ההיסטוריים המסומנים "*(באג עבר!)*"?
- האם ה-build רץ נקי ו-`node --check` עובר?
