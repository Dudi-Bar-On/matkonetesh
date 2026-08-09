# הצעת פיצול לכללים המורכבים — 13 המחלוקות של המסווגים העיוורים

> **הצעה בלבד.** מסד הכללים, מסמך המשמעת וקובצי ה-batch לא נגעו. לפי פסיקת הבעלים (2026-08-09):
> לא מכריעים בין שתי קריאות סבירות — **מפצלים** כלל מורכב לשני כללים, אחד לכל סעיף. כלל שסומן A כי
> חצי ממנו בדיק משאיר את החצי השני נאכף על ידי אף אחד, בעודו נקרא כמכוסה.
>
> אחרי אישור, הפיצולים ייכנסו דרך קובצי batch רגילים (עד 10 רשומות לקובץ, לפי `README.md` של
> התיקייה) — המסמך הזה אינו batch ואין בו בלוק JSON בכוונה, כדי שלא יוחל בטעות.

## טבלת סיכום

| rule id | הכרעה | קבוצות התוצאה | mechanism של החצי הנאכף |
|---|---|---|---|
| L31 | **split** | L31a = A · L31b = C | pretooluse:Agent |
| L23 | **split** | L23a = A · L23b = C | stop |
| L28 | **split** | L28a = B · L28b = C | pretooluse:Grep\|WebSearch |
| L51 | **split** | L51a = A · L51b = C | pretooluse:Bash |
| L43 | **split** | L43a = A · L43b = C | pretooluse:Bash |
| L36 | **split** | L36a = B · L36b = C | pretooluse:Bash |
| L55 | **split** | L55a = A · L55b = C | pretooluse:Bash |
| L63 | **split** | L63a = B · L63b = C | stop |
| L64 | **split** | L64a = A · L64b = C | stop |
| 3 | **no split** | נשאר none (מסמך-מטריה); להשלים חברים חסרים כ-C | — |
| L2 | **no split** | נשאר none; האכיפה חיה ב-DoD-5 | — |
| L48 | **no split** | נשאר none; השער כבר ממומש (check-pytest בתוך check-meta) | — |
| L72 | **no split** | נשאר none; החלטת תכן על היקוף מצב האכיפה עצמו | — |

**מאזן: 9 פיצולים, 4 המלצות לא-לפצל.**

---

## הפיצולים

### L31 — סוכן שממתין על ריצת סוויטה ברקע שורף זמן בלי אות

**L31a — הסעיף הנאכף.** group **A** · mechanism `pretooluse:Agent` ·
mechanism_target: הפרמטר `prompt` של קריאת Agent (שיגור סוכן).
**ארטיפקט קונקרטי:** גוף ה-prompt ב-payload של PreToolUse על כלי Agent.
**תבנית קונקרטית:** ה-prompt מכיל `npx playwright test` או הוראת המתנה/polling על ריצת סוויטה
ברקע — regex: `/npx\s+playwright\s+test|wait(?:ing)?\s+(?:for|on).{0,40}(?:suite|playwright)|poll.{0,40}suite/i`.
התאמה ⇒ השיגור נחסם: הבקר מריץ את הסוויטה בעצמו.

> **נוסח מוצע L31a:** Never dispatch a subagent whose brief includes running or waiting on the
> full Playwright suite. An Agent dispatch whose prompt contains `npx playwright test`, or an
> instruction to wait on or poll a suite run, is blocked at dispatch — the controller runs the
> suite itself (§11a).

**L31b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: האם בפועל הבקר החזיק בשער הסוויטה ומסר לסוכן **verdict** (עבר/נכשל, עם הפלט) — או
שהמתנה גולגלה לסוכן במהות גם בלי המילים החסומות; דיווח סוכן בנוסח "still waiting" הוא פגם תהליך.

> **נוסח מוצע L31b:** The controller owns the full-suite gate in substance, not only in wording:
> a subagent receives a verdict — pass/fail with the pasted output — never a polling loop. Any
> subagent report shaped as "still waiting" on a suite run is itself a process defect to raise.

**מה אובד אם אוכפים רק את a:** ניסוח עקיף ("ודא שהבדיקות ירוקות לפני שתמשיך") עובר את ה-regex,
והסוכן עדיין ימתין; רק שופט רואה שההמתנה הואצלה במהות.

---

### L23 — מדד-פרוקסי אינו המסך: "99% מתורגם" שוגר עם מסכים חצי-אנגליים

**L23a — הסעיף הנאכף.** group **A** · mechanism `stop` ·
mechanism_target: ההודעה הסופית של הסוכן (transcript ב-payload של Stop).
**ארטיפקט קונקרטי:** טקסט ההודעה הסופית.
**תבנית קונקרטית:** טענת אחוז-כיסוי — `/\d{1,3}\s*%.{0,40}(translated|coverage|localiz|מתורגם|כיסוי)/i`
(או בסדר הפוך) — **בלי** אזכור בשם של ארטיפקט מדידה על DOM מרונדר: נתיב screenshot, או קובץ פלט
של סקריפט מדידת-DOM לפי שפה (למשל `measure-rendered-*` / דו"ח leak per-language). טענה בלי
ארטיפקט ⇒ Stop נחסם עד שהראיה נקראת בשם.

> **נוסח מוצע L23a:** A coverage/translation/localization percentage may appear in a final report
> only alongside a NAMED rendered-DOM measurement artifact — a per-language screenshot or the
> output file of a rendered-DOM measure run. A percentage claim with no named artifact is blocked
> at stop.

**L23b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: האם המדידה שצוינה באמת נמדדה **בקלט של הצרכן** — DOM מרונדר, לכל שפה, כולל
data-values ודליפות shell (שכבות v269/v270) — והאם מוני מפתחות ו-grep דווחו רק כפרוקסי מסומן
במפורש, לעולם לא כטענה עצמה (§10.19).

> **נוסח מוצע L23b:** Any coverage claim is judged against WHERE it was measured: the rendered
> DOM per language — including data-values behind translated keys and shell-level strings — is
> the only admissible basis; key-coverage and grep counts are proxies and must be labeled as such.

**מה אובד אם אוכפים רק את a:** טענת "מוכן לבדיקה" בלי מספר עוברת את התבנית; וארטיפקט יכול להיות
נקוב-בשם אך ישן, חלקי (שפה אחת מתוך ארבע) או מודד בשכבת-ביניים — רק שופט רואה זאת.

---

### L28 — שחיקת כללי-כלים תחת קונטקסט ארוך (serena/geniza לפני grep)

> הערת עדכון: הכלל המקורי נוקב ב-**graphify**, שהוחלף ב-**גניזה** ב-2026-08-04 (CLAUDE.md). הנוסחים
> המוצעים להלן כתובים במונחי הגניזה; האזכורים ל-graphify נשארים בגוף L28 כרשומה היסטורית.

**L28a — הסעיף הנאכף.** group **B** · mechanism `pretooluse:Grep|WebSearch` ·
mechanism_target: קריאות Grep שנתיבן/glob שלהן פוגע בקובצי מקור (`app.js`, `*.py`, `*.mjs`, `*.js`).
**ארטיפקט קונקרטי:** payload של PreToolUse:Grep (השדות `path`/`glob`/`type`) + מפתח במחסן-המצב
של ה-session.
**תבנית קונקרטית (תנאי-קדימות, ולכן B):** Grep על קובץ מקור נחסם כל עוד לא נרשם באותו session
אירוע קודם של serena (`find_symbol`/`get_symbols_overview`/`find_referencing_symbols`) או שאילתת
גניזה (`search_current_docs`/`semantic_search`) — דגל `symbol_tool_used=true` במחסן המצב, שנכתב
על ידי posttooluse על כלי serena/גניזה.

> **נוסח מוצע L28a:** ‏Grep על קובצי מקור נחסם כל עוד לא נרשמה באותו session פנייה קודמת ל-serena
> (עבודה סימבולית) או לגניזה (שאלת מסמכים). ‏grep הוא fallback — הוא בא **אחרי** שהכלי הייעודי
> נוסה, לעולם לא במקומו.

**L28b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: (1) האם **העבודה עצמה** — קריאה ועריכה, לא רק חיפוש — נעשתה דרך serena כשהמשימה
סימבולית; (2) האם ה-fallback ל-grep **הוצהר** ונומק; (3) המטא-כלל — האם זיהוי של אי-יישום הכללים
הופעל כאות לשחיקת קונטקסט והוביל להרצה מחדש של `docs/process/checklists/session-start.md` במקום
להמשיך.

> **נוסח מוצע L28b:** עבודת קוד סימבולית — קריאה **ועריכה** — נעשית דרך serena; ‏fallback ל-grep
> מוצהר בקול ומנומק. ואם מזוהה שהכללים האלה אינם מיושמים — זה עצמו אות שהקונטקסט נשחק: עוצרים
> ומריצים מחדש את session-start, לא ממשיכים.

**מה אובד אם אוכפים רק את a:** קריאת serena אחת סמלית בתחילת ה-session מרימה את הדגל לתמיד —
ומכאן grep חופשי; רוח הכלל (העבודה דרך סמלים, הצהרת fallback, מטא-כלל השחיקה) נשארת בלתי-נאכפת.

---

### L51 — התקנה שדורשת סיסמה, בערוץ בלי TTY, נכשלת בשקט

**L51a — הסעיף הנאכף.** group **A** · mechanism `pretooluse:Bash` ·
mechanism_target: פקודות Bash המריצות `sudo` בתוך `wsl` לא-אינטראקטיבי.
**ארטיפקט קונקרטי:** מחרוזת הפקודה ב-payload של PreToolUse:Bash.
**תבנית קונקרטית:** ‏`/\bwsl\b(?![^|;&]*-u\s+root)[^|;&]*\bsudo\b/` — קריאת `wsl … sudo …` בלי
`-u root` ⇒ חסימה, עם הודעת התיקון: `wsl -u root` נותן root בלי סיסמה כי משתמש Windows כבר מאומת.

> **נוסח מוצע L51a:** A `sudo` inside a non-interactive `wsl` invocation is blocked: the password
> prompt reads EOF and the command fails silently. Use `wsl -u root <command>` — the Windows user
> is already authenticated, so root needs no password.

**L51b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: לפני שמבקשים מאדם (או מערוץ כלשהו) להריץ פקודה — האם נבדק אם היא דורשת הרשאה/סיסמה
שהערוץ אינו יכול לספק, והאם חופש נתיב כבר-מאומת; וכשסקריפט-נוחות של ספק נופל — האם זוהה **איזה**
רכיב נפל לפני שהוסק שהפלטפורמה אינה נתמכת.

> **נוסח מוצע L51b:** Before routing any command to a human or a channel, verify it does not need
> elevation or a password the channel cannot supply, and look first for an already-authenticated
> path. When a vendor convenience script fails, read WHICH component failed before concluding the
> platform is unsupported.

**מה אובד אם אוכפים רק את a:** כמעט הכול — התבנית מכסה מופע אחד (wsl+sudo) של עיקרון רחב; ‏UAC
בלתי-נראה, מתקיני winget, ו-`Include_launcher` נשארים בלי כיסוי מכני, וזה מוצהר כאן במפורש.

---

### L43 — קוד שנראה זהה התנהג אחרת: בית-בקרה בלתי-נראה מעריכה סקריפטית

**L43a — הסעיף הנאכף.** group **A** · mechanism `pretooluse:Bash` ·
mechanism_target: עריכה-במקום סקריפטית של קובצי מקור במעקב git.
**ארטיפקט קונקרטי:** מחרוזת הפקודה ב-payload של PreToolUse:Bash.
**תבנית קונקרטית:** ‏`/\b(sed|perl)\s+[^|;&]*-[a-zA-Z]*i/` או `awk -i inplace`, כשהפקודה נוקבת
בנתיב של קובץ מקור בריפו (`*.js`, `*.py`, `*.mjs`, `*.css`) ⇒ חסימה, עם הפניה לכלי Edit
(התאמת מחרוזת מדויקת) — הערוץ שבו הוזרק ה-U+0008.

> **נוסח מוצע L43a:** In-place scripted rewriting of tracked source files (`sed -i`, `perl -i`,
> `awk -i inplace`) is blocked. Source edits go through the exact-string Edit tool; scripted
> line-rewriting is how an invisible control byte entered a regex.

**L43b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: כשקוד שנראה זהה מתנהג אחרת — האם בוצעה השוואת **בתים** (סריקת `charCodeAt` וכדומה)
לפני היפותזות נוספות; האם עריכה סקריפטית שנותרה אומתה **בהרצה** ולא ב-grep על נוכחות הטקסט; והאם
נשקלה האפשרות ששני פגמים באותה פונקציה נראים כפגם אחד שלא תוקן.

> **נוסח מוצע L43b:** When identical-looking code behaves differently, compare BYTES, not glyphs,
> before any further hypothesis. A scripted edit that does happen is verified by RUNNING the
> result, never by grepping that the new text is present. And remember: two defects in one
> function look exactly like one unfixed defect.

**מה אובד אם אוכפים רק את a:** עריכות סקריפטיות דרך `python -c`/heredoc עוקפות את ה-regex; ומשמעת
השוואת-הבתים ואימות-בהרצה — ליבת הלקח — אינן ניתנות לתבנית כלל.

---

### L36 — ‏"Target page … has been closed" הוא כמעט תמיד timeout, לא קריסה

**L36a — הסעיף הנאכף.** group **B** · mechanism `pretooluse:Bash` ·
mechanism_target: ריצת הסוויטה המלאה הבאה אחרי שנצפתה שגיאת page-closed.
**ארטיפקט קונקרטי:** (1) פלט ריצת בדיקות שנלכד ב-posttooluse ומכיל את המחרוזת המילולית
`Target page, context or browser has been closed` — כותב דגל `page_closed_seen` במחסן המצב;
‏(2) פקודת ה-Bash הבאה.
**תבנית קונקרטית (תנאי-קדימות, ולכן B):** בעוד הדגל דלוק, `npx playwright test` **בלי ארגומנט
קובץ/spec** נחסם; ריצת בידוד — `npx playwright test <file>` יחיד — מותרת ומכבה את הדגל.

> **נוסח מוצע L36a:** After a run whose output contains "Target page, context or browser has been
> closed", the next Playwright invocation MUST be an isolated run of the failing spec — a full-
> suite rerun is blocked until that one-minute discriminator has been executed.

**L36b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: האם הסגירה נקראה כסימפטום — "התנאי מעולם לא התקיים" תחת timeout — ולא כקריסת דפדפן;
והאם תוצאת הבידוד פורשה נכון: נעלם בבידוד ⇒ עומס/תחרות, שרד בבידוד ⇒ פגם אמיתי במוצר.

> **נוסח מוצע L36b:** Read the closure as "the condition never became true", not as a crash — and
> interpret the isolation run correctly: load contention vanishes in isolation; a real defect
> does not.

**מה אובד אם אוכפים רק את a:** השער מכריח את הריצה המבודדת אך לא את **הפרשנות** — אפשר להריץ
בבידוד, לראות ירוק, ועדיין לצאת לציד קריסת-דפדפן; המסקנה היא של שופט.

---

### L55 — חריגה ש-pip יכול לבטל בשקט היא צירוף-מקרים, לא החלטה

**L55a — הסעיף הנאכף.** group **A** · mechanism `pretooluse:Bash` ·
mechanism_target: התקנות pip עוקפות-resolver מול `requirements-overrides.txt`.
**ארטיפקט קונקרטי:** מחרוזת הפקודה ב-payload של PreToolUse:Bash + תוכן הקובץ
`requirements-overrides.txt` בריפו.
**תבנית קונקרטית:** פקודה התואמת `/\bpip3?\b[^|;&]*\binstall\b[^|;&]*--no-deps/` — כל pin חבילה
בפקודה (`name==version`) חייב להופיע מילולית ב-`requirements-overrides.txt`; ‏pin שאינו שם ⇒
חסימה עם ההוראה לרשום אותו שם תחילה, עם הסיבה לצדו.

> **נוסח מוצע L55a:** `pip install --no-deps` is blocked unless every package pin in the command
> appears in `requirements-overrides.txt` — the file whose whole subject is "pins that contradict
> upstream", with the reason written beside each.

**L55b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: האם כל חריגה מכוונת נושאת את הצורה המלאה — הצהרה נפרדת, בדיקה שהיא בתוקף, בדיקה
שהיא עדיין נחוצה, ועלות גלויה (`pip check` מתועד ולא מושתק); והאם טענת "בדקתי ולא השתנה דבר"
נוקבת בציר שנמדד — parity פונקציונלי אינו ראיה על ביצועים או תיקוני באגים.

> **נוסח מוצע L55b:** Every deliberate exception carries all four parts: declared separately,
> tested to be in force, tested to be still needed, its cost left visible. And "I tested it and
> nothing changed" is only evidence about the axis you tested — before concluding a version
> brings nothing, read what it claims to bring.

**מה אובד אם אוכפים רק את a:** חריגה יכולה להיכנס לקובץ ה-overrides בלי שתי הבדיקות ובלי סיבה
כתובה — רשומה בלי מנגנון פקיעה; והלקח על ציר-הראיות אינו ניתן לתבנית.

---

### L63 — ציטוט שמעניק יותר ממה שהמקור נותן

**L63a — הסעיף הנאכף.** group **B** · mechanism `stop` ·
mechanism_target: נתיבי קבצים המצוטטים כהצדקה בדו"ח סופי, מול היסטוריית הקריאה של ה-session.
**ארטיפקט קונקרטי:** (1) טקסט ההודעה הסופית ב-payload של Stop; (2) רשימת קובצי-היעד של קריאות
Read/serena באותו session (נצברת ב-posttooluse למחסן המצב).
**תבנית קונקרטית (תנאי-קדימות, ולכן B):** כל נתיב-ריפו שההודעה הסופית מצטטת כביסוס
(`per <path>`, ‏"לפי", quoted from, מרכאות סביב טקסט + שם קובץ) חייב להופיע בקבוצת הקבצים שנקראו
באותו session; נתיב מצוטט שלא נקרא ⇒ חסימה. חל באותה צורה גם ב-subagentstop לדו"חות סוכנים.

> **נוסח מוצע L63a:** A final report may cite a repo file as justification only if that file was
> actually opened this session — a cited path absent from the session's read history blocks the
> report. Open the file while you quote it, not from memory of it.

**L63b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך: האם המילים המצוטטות מופיעות במקור **מילה במילה**, והאם המקור אכן תומך בטענה — בלי
סעיף שנוסף כדי להתאים את הציטוט לטיעון ("/ manual DBA use"). אם צריך להוסיף מילים כדי שהציטוט
יתאים — הטיעון הוא הפגום.

> **נוסח מוצע L63b:** Quote, do not paraphrase: the quoted words must appear verbatim in the
> cited file, and the file must actually say what it is cited for. If you find yourself adding a
> clause to make the quote fit the argument, the argument is what is wrong.

**מה אובד אם אוכפים רק את a:** בדיוק מקרי המקור — בשני התקריות הקובץ *היה זמין*; פתיחתו אינה
מוכיחה שהציטוט מילולי או שהוא אומר את מה שיוחס לו. חצי-a תופס רק ציטוט-מהזיכרון הגס ביותר.

---

### L64 — ‏"יש בגניזה" אינו "יש ב-git"

**L64a — הסעיף הנאכף.** group **A** · mechanism `stop` ·
mechanism_target: טענת "landed/committed" על מסמך בשמו, מול מצב git בפועל.
**ארטיפקט קונקרטי:** (1) טקסט ההודעה הסופית ב-payload של Stop; (2) פלט
`git status --porcelain -- <path>` ו-`git show HEAD:<path>` — שניהם מכניים, ללא זיכרון-עבר, ולכן A.
**תבנית קונקרטית:** הודעה התואמת `/(committed|landed|pushed|נכנס לקומיט|הופקד בריפו)/i` בסמיכות
לנתיב-ריפו ⇒ ההוק מריץ את שתי הפקודות על אותו נתיב; ‏`git show` נכשל או ה-porcelain אינו נקי ⇒
חסימה: הטענה סותרת את המקור.

> **נוסח מוצע L64a:** A claim that a named document landed or was committed is checked against
> git itself — `git show HEAD:<path>` and a clean `git status --porcelain` for that path. A
> "landed" claim over a path git does not confirm is blocked. Presence in the geniza, a search
> hit, or a quote in a commit message is never landing evidence — the geniza ingests from DISK.

**L64b — הסעיף השיפוטי.** group **C** · mechanism `judge`.
השופט מעריך את חצי-הלקח השימושי יותר — עיצוב בדיקות: האם בדיקה על ארטיפקט מתפתח **גוזרת את
ציפייתה מהארטיפקט בזמן הריצה** במקום לקבע רשימה/מספר — כי רק הראשונה מסוגלת להבחין שהעותק שלך
ושל כולם התפצלו.

> **נוסח מוצע L64b:** Prefer a test that derives its expectation from the artefact at test time
> over one that pins a number or a list — only the first can notice that your checkout and
> everyone else's have diverged.

**מה אובד אם אוכפים רק את a:** טענת נחיתה מנוסחת בלי נתיב ("שני הלקחים תועדו") חומקת מהתבנית;
ועקרון גזירת-הציפייה — מה שבפועל תפס את L62/L63 — אינו ניתן לאכיפה מכנית כלל.

---

## הכללים שאני ממליץ **לא** לפצל

### 3 — שער ה-DoD בן 12 הנקודות

**פיצול ל-3a/3b ישכפל כללים קיימים.** שבעה מחבריו כבר רשומים ככללים עצמאיים —
DoD-2, DoD-3, DoD-7, DoD-8, DoD-10, DoD-11, DoD-12 — וכל "חצי נאכף" של 3 יהיה בדיוק איחוד שלהם.
כלל 3 אינו כלל מורכב אלא **מסמך-מטריה** (checklist/index), ומקומו ב-`none` כפי שהוא כבר מסווג.

**ההמלצה במקומו:** להשאיר את 3 כ-`none`, ולסגור את הפער האמיתי — חמשת החברים שאינם רשומים
ככללים עצמאיים: **DoD-1** (עקיבת דרישת-spec, כולל שער H13 לפריט ⚠️R), **DoD-4** (אסרטה
התנהגותית), **DoD-5** (קיום צרכן, L8), **DoD-6** (מינימליות fixture + מקרה שלילי), **DoD-9**
(בדיקת עברית). חמשתם דורשים שיפוט של משמעות (האם השורה המצוטטת באמת חלה; האם האפקט "נצפה";
האם הצרכן "אמיתי ויורה") — ולכן **C**, כל אחד ככלל נפרד עם שאלת-שופט משלו. גם שער ה-per-phase
(re-audit על ידי סוכן טרי מול ה-spec) ראוי לכלל C נפרד. זה batch המשך, לא פיצול a/b.

### L2 — ‏`hooksOver` ו-`scale_res` שוגרו מחושבים-ולא-נקראים

רשומה היסטורית שהפריסקריפציה שלה כבר ממופה: ‏"gate: DoD 5" כתוב בגוף הכלל עצמו. החצי הנאכף
שהיה מוצע כאן הוא מילה-במילה DoD-5, שקיומו העצמאי מוצע לעיל תחת כלל 3. פיצול ייצור כפילות.
נשאר `none` — הרשומה היא ה-argument, DoD-5 הוא ה-gate.

### L48 — שער שאינו מסתכל על שפה אינו יכול להיכשל עליה

הפריסקריפציה של הלקח **כבר ממומשת ופועלת**: ‏`check-pytest` רץ בתוך `scripts/check-meta.mjs`
וחוסם (commit-gate חי, שהוכח בשני הכיוונים — שבירת אסרטה ⇒ exit 1). חצי-a חדש ישכפל שער קיים.
מה שנותר בגוף הכלל — "לכל שפה ומחלקת-ארטיפקט, נקוב בשער שיאדים אם תישבר, ו'אין' הוא היעדר
שטרם נבדק" — הוא שאלת **ביקורת תקופתית**, לא תנאי על ארטיפקט בודד. ההמלצה: L48 נשאר `none`
כרשומה; אם הבעלים רוצה אכיפה פעילה של שאלת-הביקורת, לרשום אותה ככלל C חדש ונפרד
(שופט בסגירת קשת: "נקוב בשער לכל מחלקת-ארטיפקט; היכן שהתשובה 'אין' — נרשם פער"), לא כפיצול.

### L72 — מצב משותף בין שחקנים מקבילים חוסם את מי שלא חטא

זו **החלטת תכן על תשתית האכיפה עצמה** — היקוף המונים: ‏§5 ברמת השחקן, ‏§10.16 ברמת ה-session,
ושורות ישנות נשמרות כהחלטה. אין כאן ציות של סוכן לבדוק: הנמען הוא מי שמחווט את Phase 6, פעם
אחת. האכיפה הנכונה היא **בדיקת רגרסיה על סכימת מחסן-המצב** (שמפתח מונה §5 כולל מזהה-שחקן ומפתח
§10.16 אינו כולל) — פרט מימוש של מערכת האכיפה, שמקומו בסוויטת הבדיקות שלה, לא כלל a/b במרשם.
נשאר `none` כהחלטה מיושבת.

---

## הערות כנות — היכן הייתי הכי פחות בטוח

1. **L23a** — תבנית זיהוי-הטענה היא החלשה מבין התשע: טענת כיסוי בלי ספרת אחוז חומקת, וזיהוי
   "ארטיפקט מדידה נקוב" הוא בעצמו heuristic. אם הבעלים מעדיף, L23 יכול להישאר כולו C בלי נזק רב —
   הצעתי את הפיצול כי המקרה שקרה בפועל ("~99% translated") כן נתפס בתבנית.
2. **L51a** — התבנית אמיתית אך צרה: היא מכסה מופע אחד (wsl+sudo) של עיקרון רחב. שורת ה"מה אובד"
   שם היא כמעט-הכול, במוצהר.
3. **L36a** — מנגנון ה-B (דגל מ-posttooluse + חסימת full-suite) הוא הכבד ביותר למימוש מבין התשע;
   אם עלות החיווט גוברת על הערך, L36 יכול להישאר כולו C.
