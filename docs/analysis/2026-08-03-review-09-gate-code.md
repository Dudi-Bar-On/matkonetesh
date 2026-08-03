# Review 09 — קוד האכיפה עצמו: האם השערים יכולים להיכשל?

**סוקר 9 מתוך 10 · 2026-08-03 · היקף: `scripts/check-*.mjs`, `scripts/gate-lessons.mjs`, `scripts/session-*.mjs`, `scripts/tests/run-all.mjs`, `.githooks/`, `.github/workflows/`, `.claude/settings.json`, `docs/process/gate-baselines.json`, `.superpowers/gate-skip-log.jsonl`.**

**לא סוקר קוד מוצר.** לא הרצתי `npx playwright test` (הוראת התדריך). כל מספר כאן נמדד — מהרצת הסקריפטים, מ-`git log`, מלוגי CI אמיתיים (`gh run view`), או מניסוי מוטציה בעותק בקובץ זמני. שום דבר לא שוחזר מהזיכרון ולא נערך בקוד.

## מה הורץ בפועל

| פקודה | תוצאה |
|---|---|
| `node scripts/check-meta.mjs` | `META GATE OK`, EXIT=0 |
| `node scripts/tests/run-all.mjs` | `9/9 test files passed`, EXIT=0 |
| `gh run list --workflow=graph-freshness.yml` | 8 ריצות, **0 הצלחות** |
| `gh run view --job 91555240777 --log` | לוג ה-`discipline` האמיתי מ-CI על קומיט release(v290) |
| ניסוי מוטציה על `check-h8-ledger` (עותק ב-scratchpad) | EXIT_A=0 / EXIT_B=1 — ראה §2.1 |
| ניסוי מוטציה על `gate-lessons` (עותק ב-scratchpad) | EXIT=0 עם לקח מתוארך 2099 — ראה §2.4 |

## מה **לא** נבדק (מידע, לא חסר)

- `scripts/session-brief.mjs` — נקרא רק ה-header ו-40 השורות הראשונות; הבדיקות-העצמי שלו עוברות (3/3). לא ביקורת מלאה.
- `scripts/session-rules.mjs` — נקרא במלואו, אך **לא** אימתתי שהחיתוכים (§3/§4/§10/§11) באמת מחזירים את הטקסט הנכון מהמסמך הנוכחי. אין לו בדיקה-עצמית כלל.
- `.githooks/post-commit` ו-`post-checkout` (‏9,643 + 9,049 בתים, של graphify) — לא נקראו.
- `scripts/central-code.mjs`, `scripts/make-brief.mjs` — לא נסקרו לעומק (‏make-brief עובר 9/9 בבדיקות שלו).
- לא בדקתי אם ה-hooks מותקנים אצל כל מפעיל — `git config core.hooksPath` = `.githooks` במכונה הזו בלבד.

---

# 1 · לכל שער: מה הוא סורק, ומה הוא **לא** סורק

הפלט המלא של הריצה מצורף בהמשך. הטבלה היא התשובה לשאלה 1.

| שער | סורק | **לא** סורק | הפלט מבחין "נסרק ותקין" מ"לא נסרק"? |
|---|---|---|---|
| `check-graph-fresh` | mtime של 292 קבצי `docs/**/*.md` מול mtime של `graphify-out/graph.json` | תוכן. לא בודק שהגרף מכיל את המסמכים — רק תאריך | ✅ מדפיס `docs scanned: 292` |
| `gate-lessons` | הקיום של `**LNN ·` עם תאריך ISO בכל מקום ב-§11; ספירת קומיטי `release(v` מאוחרים ממנו | **שום קשר בין הלקח לשחרור.** לא נושא, לא תוכן, לא מספר | ⚠️ מדפיס תאריך, לא מדפיס כמה שחרורים נסרקו-ונמצאו-מכוסים |
| `check-board-fresh` | מספר אחד: `בסיס: vNNN` מול הקומיט האחרון | כל שאר תוכן הלוח. שורה תקועה, סטטוס שגוי, פער — בלתי נראים | ✅ מדפיס `board declares / commits scanned` |
| `check-brief` | 41 קבצי brief; מהם 35 חדשים מהתבנית; נוכחות 6 סימני שדה `(א)..(ו)` + איסור `npx playwright test` חשוף | **תוכן השדות.** `(א) TODO` עובר. וגם: 6 briefs שקדמו לתבנית — כולם 6/6 חסרים — לא נספרים בשום מקום בפלט | ⚠️ חלקית — מדפיס 41/35/27 אבל לא אומר ש-6 יצאו מההיקף |
| `check-h9` | 140 קבצי report; **9 בלבד** נבדקים; נוכחות 5 מחרוזות כותרת | **131 מהם — כלל לא.** מדדתי: מתוך 130 שמחוץ להיקף, **106 חסרים את כל חמש הכותרות**. גם: תוכן השורות | ❌ **לא.** מדפיס `newer than last release: 9` ואז `OK` — לעולם לא "131 לא נסרקו, 106 מהם פגומים" |
| `check-release` | 23 קומיטי release; 10 בהיקף; נוכחות `exit 0` ×2, `on the tree being shipped`, קובץ UX | האם ההרצות באמת קרו. זו **בדיקת תחביר על טקסט שהכותב עצמו כתב** | ✅ מדפיס `scanned 23 · in scope 10` ואת 4 הכשלים — **ואז יוצא 0** |
| `check-h8-ledger` | 18 שורות §5, 2 בולטים, 88 שורות §5a; עמודת נחיתה/סטטוס לא-ריקה | האם הנחיתה **נכונה**. `| Phase 99 |` שאינה קיימת — עובר | ✅ מדפיס ספירות לשתי הסקציות |
| `check-shipped-closed` | 23 קומיטים + 16 דוחות; ‏**8 אזכורים** של `סוגר את`/`closes`; 106 שורות מרשם | כל שורה שהסתיימה בלי שמישהו כתב את הביטוי. 4 מזהים מתוך 106 נבדקו | ✅ מדפיס `8 mentions covering 4 distinct ids` |

**המסקנה החוצה את הטבלה:** כל שמונת השערים קוראים **קבצי Markdown ו-`git log` בלבד**. אף אחד מהם לא נוגע ב-`dist/index.html`, לא ב-`items.json`, לא ב-DOM, ולא מריץ בדיקה אחת. זו התשובה למשפט הפותח של התדריך: מערכת שלמה של שערים הייתה ירוקה כשנשלחו שבעה מספרי בטיחות שגויים, כי **אף שער לא מסתכל על מספרים**. סוקר 08 ניסח את אותו דבר משורה 366 שלו: `check-meta.mjs` עוטף שמונה שערי-מסמכים ואין בו בדיקת DOM אחת.

---

# 2 · שערים שאינם יכולים להיכשל

זו ההוראה החשובה בתדריך, ומצאתי **חמישה** מופעים של הצורה שסוקר 6 תיאר (`safe-source-unmapped: 4` — סופר האם הייתה התאמה, לעולם לא האם היא נכונה). שניים מהם מוכחים בניסוי.

## 2.1 · `check-h8-ledger` הוא no-op גמור ב-CI — הרגל שנקראת "הסמכות בפועל" [קריטי]

`scripts/check-h8-ledger.mjs:104` — ‏`const ref = process.env.H8_BASELINE_REF || 'HEAD'`, ואז שורה 107 קוראת `git show HEAD:docs/ROADMAP-2026-07-30.md`, ומשווה מול **עץ העבודה**.

- ב-pre-commit זה נכון: `HEAD` הוא הקומיט הקודם, ועץ העבודה הוא מה שעומד להיכנס. השוואה אמיתית.
- **ב-CI ובכל עץ נקי `HEAD` הוא בדיוק אותו תוכן כמו עץ העבודה.** ‏`analyze(current)` ו-`analyze(baseline)` מחזירים אותה קבוצה מילה במילה, ולכן `newFindings` (שורה 116) ריקה **תמיד**. נשארות רק שתי בדיקות מבניות (§5 חסר, §5a חסר).

**ההוכחה** — שכפלתי את הרואדמאפ ל-scratchpad ושיניתי שורה אחת בטבלת §5 מ-`| Phase 0 |` ל-`| מתישהו |` (הפרה מובהקת של "כל שורה נוחתת בפאזה מנויה"):

```
--- A: baseline == current  (צורת CI) ---
  ~ §5 ledger row without a named phase: "| מתישהו | H-9, N-15 | 2 | 19 |"
  OK - no new or worsened H8 finding in this change (1 standing-debt finding)
  EXIT_A=0

--- B: baseline == הרואדמאפ הנקי  (צורת pre-commit) ---
  x §5 ledger row without a named phase: "| מתישהו | H-9, N-15 | 2 | 19 |"
  FAIL: no-unlanded-items (H8) - 1 new/worsened finding(s).
  EXIT_B=1
```

אותה הפרה בדיוק. אותו קוד. ‏EXIT 0 בצורה שרצה ב-CI, EXIT 1 בצורה שרצה ב-hook המקומי הניתן לעקיפה. וזה מאושש בלוג CI אמיתי (‏job 91555240777, ‏2026-08-02): `§5a: 82 row(s) scanned … OK - no new or worsened H8 finding`.

**התיקון המדויק** (`scripts/check-h8-ledger.mjs`, אחרי שורה 104): כשמריצים ללא שינויים לא-מקומיים, הבסיס חייב להיות `HEAD~1`, לא `HEAD`. קונקרטית — הוסף לפני `loadBaseline()`:

```js
// If the working tree is identical to HEAD (CI, or a clean local tree), comparing against HEAD is a
// tautology: analyze(current) === analyze(baseline) and nothing can ever be "new". Compare against
// the PARENT commit instead, so the change under review is the commit itself.
const ref = process.env.H8_BASELINE_REF
  || (execFileSync('git', ['status', '--porcelain', '--', roadPath], { cwd: GITROOT, encoding: 'utf8' }).trim()
      ? 'HEAD' : 'HEAD~1');
```

ובנוסף — קבע ב-`.github/workflows/test.yml` ‏`H8_BASELINE_REF: ${{ github.event.before }}` על push, שזה הבסיס הנכון לדחיפה מרובת-קומיטים. **ובלי זה, כל מה שסעיף 4.2 בכותרת של `check-meta.mjs` אומר על "worsening-only blocking" נכון רק ברגל שהיא עצמה מוצהרת כלא-סמכותית.**

## 2.2 · `check-brief` ו-`check-h9` הם no-op גמור ב-CI [קריטי]

`.superpowers/sdd/.gitignore` מכיל `*`. ‏`git ls-files .superpowers` → **0 קבצים**. הספרייה אינה במאגר.

`check-brief.mjs:58-61` ו-`check-h9.mjs:61-64`:
```js
if (!existsSync(SDD_DIR)) { console.log('OK - .superpowers/sdd not present, nothing to scan.'); process.exit(0); }
```

**מהלוג האמיתי של `discipline` ב-CI (‏2026-08-02T22:22, ריצה 30769941655):**
```
=== check-brief ===
OK - .superpowers/sdd not present, nothing to scan.
=== check-h9 ===
OK - .superpowers/sdd not present, nothing to scan.
```

שני השערים שנעקפו 22 פעם מקומית **אינם מסוגלים לרוץ בשכבה שמסמכי הפרויקט מכנים "הסמכות בפועל, שאינה ניתנת לעקיפה"**. הם מדווחים `OK` — לא `SKIPPED`, לא `NOT APPLICABLE`. זו בדיוק המילה `OK` על מה שלא נסרק.

**התיקון המדויק:** ‏(א) שנה את שתי השורות מ-`console.log('OK - ...')` ל-
```js
console.log('NOT APPLICABLE - .superpowers/sdd does not exist here (untracked by design). This gate did NOT run.');
```
כך `META GATE OK` לא ייקרא כאילו הן נבדקו. ‏(ב) ההחלטה האמיתית שצריכה להגיע לבעלים: או שה-briefs וה-reports נכנסים ל-git (ואז שני השערים מקבלים סמכות אמיתית ב-CI ואת נתיב ה-`git log` שהכותרות שלהם כבר מתארות), או שמכריזים במפורש שהם שערים מקומיים-בלבד ומורידים אותם מרשימת "מה CI אוכף". **המצב הנוכחי — טוען אכיפה, מקבל `OK`, לא סורק דבר — הוא הגרוע משלושתם.**

## 2.3 · `check-release` ב-`check-meta` אינו יכול להיכשל, והכותרת של `check-meta` טוענת את ההפך [קריטי]

`check-meta.mjs:42-46` (כותרת, מובאה מדויקת):
> `check-board-fresh / check-release / gate-lessons / check-shipped-closed: UNCHANGED, still contribute to failed on every run.`

`check-release.mjs:112-117`:
```js
if (process.env.AUDIT_STRICT === '1') { ...; process.exit(1); }
console.error('\nReported, not blocking (history is immutable) ...');
process.exit(0);
```

במצב AUDIT — המצב היחיד ש-`check-meta` מפעיל — **הקוד יוצא 0 בכל מסלול**. ‏`AUDIT_STRICT` לא מוגדר בשום מקום ב-`.githooks/`, ב-`.github/workflows/` או ב-`.claude/settings.json` (בדקתי). מהריצה של היום:

```
FINDINGS: 4/10 in-scope release commit(s) fail H7 x2 / DoD-12 / L29 / H14:
  21170d6  release(v284) … x H7 … x DoD-12 … x L29 … x H14
  1bd1779  release(v283) … 1bd… 5420061  release(v282) … 176cea1  release(v281)
…
META GATE OK
```

ארבעה שחרורים מפרים את H7/DoD-12/L29/H14 — **והשער הכולל ירוק.** האכיפה האמיתית של H7/H14 קיימת אך ורק ב-hook המקומי `commit-msg`, שהוא בדיוק הרגל שהמסמכים מגדירים כניתנת לעקיפה.

**התיקון המדויק:** ‏(1) תקן את הכותרת של `check-meta.mjs:42` — היא מצהירה עובדה שגויה על הקוד שלה עצמה. ‏(2) ב-`.github/workflows/test.yml`, ב-step של `discipline`, הוסף `env: { AUDIT_STRICT: '1' }`. ‏(3) `CUTOFF` ב-`check-release.mjs:33` הוא `2026-08-01`, וההיסטוריה שמאחוריו באמת בלתי-ניתנת לתיקון — אז העבר את ה-CUTOFF ל-`2026-08-03` (או לתאריך שבו v281–v284 מוכרזים כחוב קפוא), ומאותו רגע `AUDIT_STRICT=1` חוסם. אחרת אתה קופא לנצח על ארבעה ממצאים שאיש לא יסגור.

## 2.4 · `gate-lessons` — לקח מתוארך-עתיד מנטרל אותו לצמיתות [חמור]

`gate-lessons.mjs:34-35`: `const last = dated.reduce((a,b) => b.n > a.n ? b : a); const cover = [last.date, ...decls].sort().at(-1);` — ואז שורה 41 מסננת `c.d > cover`.

השער בודק **רק שקיים לקח שתאריכו ≥ תאריך השחרור**. הוא לא בודק שהלקח קשור לשחרור, שיש בו תוכן, או שמישהו קרא אותו. ניסוי (עותק ב-scratchpad, הוספתי שורה אחת):

```
$ DISCIPLINE=<copy> node scripts/gate-lessons.mjs
last lesson: L99 (2099-01-01) · declarations: 0 · coverage date: 2099-01-01
release(v commits dated after 2099-01-01: 0
OK - no release without lesson coverage.        EXIT=0
```

שורה אחת בת 60 תווים מכבה את השער עד 2099. ומעבר לניצול המכוון: `%cs` נותן תאריך-יום בלבד, וההשוואה היא `>` חמור — **כל שחרור שנשלח באותו יום כמו הלקח האחרון נחשב מכוסה אוטומטית**, וזה המצב הנפוץ כאן (הריצה של היום: `coverage date: 2026-08-03`, ‏`release commits after: 0`).

**התיקון המדויק** (`gate-lessons.mjs`): החלף את "יש לקח מאוחר יותר" ב-"כל קשת שנסגרה מקושרת מפורשות". קונקרטית — דרוש שכל שחרור `release(vNNN)` יופיע בשמו בתוך רשומת L או בתוך `No-lesson declaration`, למשל
```js
const covered = new Set([...text.matchAll(/\bv(\d+)\b/g)].map(m => m[1]));
const uncovered = releases.filter(r => !covered.has(r.version));
```
ובנוסף פסול תאריך עתידי: `if (last.date > new Date().toISOString().slice(0,10)) FAIL('lesson dated in the future')`.

## 2.5 · `check-board-fresh` בודק מספר אחד, ‏`check-shipped-closed` בודק 4 מתוך 106 [בינוני]

- `check-board-fresh.mjs:20` — כל השער הוא `board.match(/בסיס:\s*v(\d+)/)`. עריכה של תו אחד בכותרת מספקת אותו במלואו, בזמן שכל 106 שורות המרשם בלוח יכולות להיות תקועות. זה שער-הצהרה, לא שער-תוכן. (מוצהר בכותרת שלו — לגיטימי, אבל שווה לומר בפלט: `content of the board is NOT checked`.)
- `check-shipped-closed.mjs:48` — ‏`CLAIM_RE` דורש `סוגר את` / `closes`. ‏23 קומיטי שחרור ייצרו **8 אזכורים על 4 מזהים** מתוך 106 שורות. השער יעיל בדיוק כשהכותב טרח לכתוב את הביטוי; לא לכתוב אותו = ירוק. הכותרת מודה בזה במפורש ("no claim, no opinion"), וזו הכרעה מנומקת — אבל **הכיסוי בפועל הוא 3.8% מהמרשם**, וזה לא מופיע בפלט. תיקון: הוסף לשורת הסיכום `coverage: 4/106 ledger rows (3.8%) were covered by any claim — the remaining 102 are not evaluated by this gate.`

---

# 3 · ‏22 העקיפות — מה הכלל שאינו מתאים למציאות

הלוג (`.superpowers/gate-skip-log.jsonl`, 22 שורות, נקרא במלואו):

| שער שנעקף | מספר | חלון זמן |
|---|---|---|
| `check-brief` | **20** | 2026-08-01T22:18 → 2026-08-02T04:46 |
| `check-h9` | 1 | 2026-08-01T23:06 |
| `check-brief,check-h9` | 1 | 2026-08-01T23:07 |

**22 עקיפות ב-6.5 שעות.** זה לא מפר — זה מופרך, בדיוק כפי שהתדריך ניסח.

**הכלל שאינו מתאים למציאות:** `check-brief` דורש שכל brief יישא שישה סימני שדה. ה-brief-ים נוצרים במהלך העבודה — חלקם נחתכים אוטומטית מטקסט תוכנית — ואילו השער נאכף **בזמן הקומיט**, על **כל** הספרייה, בלי קשר לשאלה אם הקומיט נוגע ב-brief כלשהו. מפתח שכותב תיקון בטיחות נחסם על ידי קובץ brief שנכתב לפני יומיים ואינו קשור לשום דבר. התוצאה הבלתי נמנעת: `META_SKIP_GATE=check-brief` הופך למקש בררת-מחדל.

**שים לב שהתיקון כבר נוסה ולא הספיק.** ב-2026-08-02 הוסיף הבעלים 5 קבצים לרשימת ה-baseline **ובנה את `scripts/make-brief.mjs`** — מחולל שמסרב לפלוט brief בלי שני שדות שיפוט אמיתיים (‏9/9 בדיקות עוברות, כולל "check-brief מקבל את הפלט"). זו הייתה ההחלטה הנכונה. ולמרות זאת העקיפה האחרונה בלוג היא **2026-08-02T04:46** — כלומר ההחלטה נרשמה ב-`_owner_additions` באותו יום, אבל 6 briefs שאינם ב-baseline ואינם עומדים בכלל עדיין יושבים בספרייה:

```
BAD 2026-07-30T15:27  coverage-audit-brief.md      missing (א)(ב)(ג)(ד)(ה)(ו)
BAD 2026-07-26T18:42  i18n-v2-brief.md             missing (א)(ב)(ג)(ד)(ה)(ו)
BAD 2026-07-26T09:45  owner-morning-brief.md       missing (א)(ב)(ג)(ד)(ה)(ו)
BAD 2026-07-26T09:03  probe-nudge-brief.md         missing (א)(ב)(ג)(ד)(ה)(ו)
BAD 2026-07-30T15:56  recovery-landing-brief.md    missing (א)(ב)(ג)(ד)(ה)(ו)
BAD 2026-07-26T13:13  wood-advisory-brief.md       missing (א)(ב)(ג)(ד)(ה)(ו)
```

הם עוברים רק כי הם קודמים לתאריך הקומיט של התבנית (`2026-07-30T22:04:01+03:00`). כלומר יש **שני** מנגנוני פטור מקבילים (חתך-תבנית + baseline), ואף אחד מהם לא מדווח על עצמו בפלט הסופי.

**הצורה הנכונה של הכלל — התיקון המדויק:** השער חייב לשפוט את **מה שהקומיט נוגע בו**, לא את מצב הספרייה. ב-`check-brief.mjs`, במקום `readdirSync(SDD_DIR)`:

```js
// Judge the change, not the repo. Only briefs actually touched by this commit are enforced;
// everything else is reported as a count, never blocks. Falls back to the full scan when there
// is no index (CI / manual audit), where blocking is not the point anyway.
const staged = new Set(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: GITROOT, encoding: 'utf8' })
  .split('\n').filter(f => f.endsWith('-brief.md')).map(f => f.split('/').pop()));
const enforce = staged.size ? (f => staged.has(f)) : (() => false);
```
ואז: קובץ בהיקף-אכיפה וגם פגום → חוסם. קובץ פגום שהקומיט לא נגע בו → שורת ספירה בלבד. **זה מייתר את `gate-baselines.json` כולו** (ראה §4), מייתר את חתך-התבנית, ומייתר את מקש ה-`META_SKIP_GATE`. אותו תיקון בדיוק ל-`check-h9.mjs`.

## 3.1 · פגם נלווה: יומן העקיפות אינו במאגר וניתן למחיקה [חמור]

`git ls-files .superpowers` → **0**. הספרייה כולה untracked (‏`git status`: `?? .superpowers/`), ואינה ב-`.gitignore` — פשוט מעולם לא נוספה. משמעויות:

1. **ב-CI היומן אינו קיים.** ‏`check-meta.mjs:66` ‏(`if (existsSync(SKIP_LOG))`) לא נכנס, ו-CI מדפיס אפס עקיפות. הטענה בכותרת (שורות 52-55) — "a skip cannot quietly age out of view — it resurfaces every time discipline is checked" — נכונה במכונה אחת בלבד.
2. **`.claude/settings.local.json` מתיר במפורש `Bash(rm -f .superpowers/gate-skip-log.jsonl)`.** מסלול הביקורת מחיק בלחיצה, בלי עקבות.
3. **`git commit --no-verify` עוקף הכול ואינו נרשם כלל.** ה-hook לא רץ, ולכן אין שורה ב-JSONL. המנגנון "צר ורועש" מכסה רק את הנתיב שמישהו בחר להשתמש בו ביושר.

**התיקון המדויק:** ‏(א) הוסף `.superpowers/gate-skip-log.jsonl` (בלבד — לא `sdd/`) למעקב git ודרוש שהוא ייכלל בקומיט שהשתמש בעקיפה — הוסף ב-`.githooks/pre-commit` אחרי כתיבת השורה: `git add .superpowers/gate-skip-log.jsonl`. ‏(ב) הסר את `rm -f` מרשימת ההיתרים ב-`.claude/settings.local.json`. ‏(ג) ל-`--no-verify` אין תיקון ב-hook מעצם הגדרתו — התיקון היחיד הוא ש-CI יאכוף באמת (§2.1–2.3), ואז עקיפה מקומית עולה סיבוב ל-CI במקום להיות חינם.

---

# 4 · ‏27 פריטי ה-baseline — תור שאיש לא מרוקן

**מי הוסיף ומתי, מהקובץ עצמו:**
- `"_frozen_at": "2026-08-01"` — 22 פריטים במקור (מספר שמופיע במפורש ב-`.githooks/pre-commit`: *"22 historical briefs"*).
- `"_owner_additions"`, ‏`"date": "2026-08-02"` — הבעלים הוסיף **5 נוספים** (`task-7,8,9,12,13`), עם נימוק כתוב במלואו: הם נחתכו מכונית מטקסט תוכנית, הם ארטיפקטים היסטוריים שכבר בוצעו, ועריכתם עכשיו הייתה **מפברקת ראיה** לחוזה שלא קוים.

**האם התור גדל? כן — ‏22 → 27, יום אחד אחרי שהוקפא.** זו התשובה העובדתית לשאלה. הכללים בקובץ אומרים "‏NOT auto-updated: a file added here later must be a deliberate owner decision" — והכלל קוים במלואו: החלטה מפורשת, נימוק, ותיקון-שורש באותה נשימה (`make-brief.mjs`). **זה הוסף היטב.**

**האם זה פטור לגיטימי או תור?** שניהם, וזו הבעיה:
- הנימוק לגיטימי — לתקן קובץ היסטורי כדי לרצות סורק-מחרוזות זו בדיוק פברוק ראיות, והבעלים צדק שסירב.
- אבל **אין מנגנון ריקון, אין תפוגה, ואין מדד burn-down.** ‏27 פריטים, 0 הוסרו. הקובץ אף אומר במפורש: *"A file already on the list that becomes compliant is harmless to leave here… removing it is optional cleanup, not required."* תור שהניקוי שלו מוגדר כאופציונלי אינו תור — הוא רשימה קבועה.
- וב-CI, כזכור (§2.2), הרשימה חסרת משמעות ממילא: הספרייה שהיא מתארת לא קיימת שם.

**התיקון המדויק:** אם מיישמים את §3 (אכיפה על הקומיט בלבד), **‏`gate-baselines.json` נמחק כליל** — 27 קבצים היסטוריים ששום קומיט לא נוגע בהם לא ייבדקו מלכתחילה, בלי רשימת פטורים, בלי הקפאה, בלי דיון. זה התיקון הנכון: לא לנהל את תור החוב טוב יותר, אלא להסיר את הסיבה שבגללה הוא נוצר. אם בכל זאת נשארים עם הרשימה — הוסף לה `"_expires": "YYYY-MM-DD"` והפוך תאריך שעבר לחסימה.

---

# 5 · מקומי מול CI — לא זהים, וההפרש הוא בדיוק בשערים החשובים

**בדקתי, לא הנחתי.** מקור: לוג `discipline` אמיתי, ריצה 30769941655, ‏job 91555240777, קומיט `release(v290)`, ‏2026-08-02T22:22Z.

הפקודה זהה בשתי השכבות (`node scripts/check-meta.mjs`, בלי ארגומנטים, בלי env מלבד `CI`). **התנהגות השערים אינה זהה:**

| שער | מקומי (היום) | CI (הלוג האמיתי) | ההפרש |
|---|---|---|---|
| `check-graph-fresh` | mtime, 292 מסמכים, 113 ישנים | git-log, 269 מסמכים, 98 ישנים | מוצהר בכותרת ✅ |
| `gate-lessons` | OK | OK | זהה |
| `check-board-fresh` | OK (v290) | **FAIL** (v289 מול v290) | ההפרש היחיד שתפס משהו |
| `check-brief` | 41 סרוקים, 27 חוב | **`nothing to scan`** | ❌ §2.2 |
| `check-h9` | 140 סרוקים, 9 נבדקים | **`nothing to scan`** | ❌ §2.2 |
| `check-release` | 4 ממצאים, exit 0 | 4 ממצאים, exit 0 | חסר `AUDIT_STRICT` ❌ §2.3 |
| `check-h8-ledger` | 88 שורות §5a | 82 שורות §5a, `OK` תמיד | ❌ §2.1 — inert ב-CI |
| `check-shipped-closed` | 16 דוחות | 15 דוחות | תלוי-tree, תקין |

**ממצא נלווה מאותה ריצה:** ה-job `discipline` **נכשל** על קומיט `release(v290)` (‏`META GATE FAIL: check-board-fresh` — הלוח הכריז v289 בזמן שv290 נשלח), והעבודה המשיכה. ‏v290 נשלח לייצור. הכשל תוקן בקומיט מאוחר יותר, אבל **אין שום מנגנון שקושר "CI אדום על קומיט שחרור" ל"אל תכריז שהגרסה חיה"**. ‏§10.10 דורש אימות Playwright מול ה-URL החי; הוא אינו דורש `discipline` ירוק.

**התיקון המדויק:**
1. `.github/workflows/test.yml`, ‏job `discipline`: הוסף
   ```yaml
   env:
     AUDIT_STRICT: '1'
     H8_BASELINE_REF: ${{ github.event.before }}
   ```
2. הוסף ל-`check-meta.mjs`, בסוף, שורת כיסוי מפורשת שמבדילה בין השלושה:
   ```js
   console.log(`\nCOVERAGE: ${ran} gate(s) ran · ${notApplicable} could not run here (no input present) · ${advisory} advisory.`);
   ```
   ואם `notApplicable > 0` — אל תדפיס `META GATE OK` אלא `META GATE OK (PARTIAL — N gate(s) had no input)`.
3. חסום את v-NNN מלהיחשב "חי" בלי `discipline` ירוק — הוסף ל-`docs/process/checklists/arc-close.md` שורה שדורשת `gh run view <sha> --json conclusion` ירוק, והוסף אותה כבדיקה ב-`check-release.mjs` במצב HOOK.

---

# 6 · `STANDING DEBT` — האם אי-פעם ירד?

**התשובה, במספרים: לא. אף פעם. הוא רק גדל.**

- **חותמת הגרף המקומית: `2026-07-30T16:33:16Z`.** ארבעה ימים ללא בנייה מחדש, למרות ש-§10.12 מחייבת `--mode deep` שוטף.
- **`GRAPH_REPORT.md` (ה-proxy של CI) קומיט אחרון: `2026-07-30T19:34:45+03:00`** — הקומיט `b04163e`. מאז, שום דבר.
- מספר המסמכים ה"חדשים מהגרף": **98 ב-CI ב-2026-08-02 → 113 מקומית ב-2026-08-03.** גדל ב-15 ביום אחד.
- **`graph-freshness.yml` — ה-workflow שהמסמכים מכנים "blocking":**

```
completed  failure  graph-freshness  schedule          30788417288  2026-08-03T05:53Z
completed  failure  graph-freshness  schedule          30734445943  2026-08-02T05:37Z
completed  failure  graph-freshness  workflow_dispatch 30710464696  2026-08-01T17:30Z
completed  failure  ... (5 ריצות נוספות, כולן 0s — עידן ה-YAML השבור)
```

**8 ריצות. 0 הצלחות. אפס.** מיום שנוצר, ה-workflow הזה מעולם לא היה ירוק. ולראייה שהוא מוכר כרעש: הקומיט שתיקן אותו נקרא `fix(ci): the nightly graph workflow was invalid and never ran` — כלומר גם לפני התיקון וגם אחריו הוא נכשל, פשוט מסיבות שונות.

זהו "אות ענבר קבוע" בצורתו הטהורה: ‏`check-meta` מדפיס 113 שורות אדומות, מסיים אותן במילה `OK`, ומפנה לאחריות של workflow לילי שנכשל 100% מהזמן ואיש לא פותח.

**התיקון המדויק — שלוש אפשרויות, בסדר העדפה:**
1. **הטוב:** הפוך את בניית הגרף לאוטומטית. `graph-freshness.yml` לא רק מדווח — הוא מריץ את הבנייה ופותח PR עם `GRAPH_REPORT.md` מעודכן. חוב שנפרע אוטומטית מפסיק להיות אות.
2. **הסביר:** קבע תקציב מוצהר. שנה את `check-graph-fresh.mjs:90/120` להשוות מול סף: `STALE_BUDGET_DAYS=2`. מתחת לסף — שורת מידע שקטה בת שורה אחת. מעל — **חוסם**, גם ב-`check-meta`. אות שיכול להשתנות הוא אות; אות קבוע אינו.
3. **הכן ביותר:** אם הפרויקט מחליט שהגרף לא באמת חייב להיות טרי — הסר את השער ואת ה-workflow. **שער שלעולם לא ירוק ולעולם לא חוסם גורע מהאמון בשבעת האחרים**, כי הוא מלמד שהמילה FAIL בפלט הזה לא אומרת כלום.

בכל שלוש האפשרויות — הפסק להדפיס 113 שורות `x` בכל SessionStart. שורת סיכום אחת עם המספר והגיל מספיקה; 113 שורות הן הדרך המהירה ביותר לאמן קורא להתעלם מהפלט כולו.

---

# 7 · באגים נוספים בקוד השערים

## 7.1 · השוואת ISO עם אזורי-זמן שונים — חלון עיוור של 3 שעות בכל יום [חמור]

`check-h9.mjs:76-77`:
```js
const landedAt = committedAt ?? new Date(statSync(abs).mtimeMs).toISOString();  // "…Z"
const isNewer = cutoff ? landedAt > cutoff : true;                             // cutoff: "…+03:00"
```
`cutoff` מגיע מ-`git log --format=%cI` ונראה `2026-08-03T01:21:36+03:00`. ‏`landedAt` מ-`statSync` הוא תמיד UTC עם `Z`. **ההשוואה היא מילונית על מחרוזות בעלות היסטים שונים** — כלומר שגויה. הדגמה:

```js
cutoff = '2026-08-03T01:21:36+03:00'   // = 2026-08-02T22:21:36Z
mtime  = '2026-08-02T23:30:00.000Z'    // אמיתית: מאוחר יותר ב-69 דקות
mtime > cutoff  (lexicographic) → false     ← הקובץ מוצא מההיקף
new Date(mtime) > new Date(cutoff) → true   ← האמת
```

כל דוח שנוצר בשלוש השעות שאחרי שחרור (בשעון ישראל, ‏UTC+3) יוצא מההיקף בשקט. אותו באג בדיוק ב-`check-brief.mjs:73` (`fileDate <= templateDate`).

**התיקון:** `const isNewer = cutoff ? Date.parse(landedAt) > Date.parse(cutoff) : true;` — ואותו שינוי בשורה 73 של `check-brief.mjs`.

## 7.2 · הבדיקות-העצמי של הבודקים לא רצות בשום מקום אוטומטית [חמור]

`grep -rn "run-all" .github .githooks .claude scripts/*.mjs scripts/*.sh package.json` — **התוצאה היחידה** היא `.claude/commands/enforce.md:20`, כלומר פקודת סלאש ידנית (`/enforce full`). ‏`run-all.mjs` אינו ב-pre-commit, לא ב-commit-msg, לא ב-`test.yml`, ולא ב-SessionStart.

מסקנה: אם מישהו ישבור `check-h8-ledger.mjs`, שום דבר לא יגלה זאת — הבודקים עצמם אינם תחת שער.

**התיקון המדויק:** הוסף ל-`.github/workflows/test.yml` בתוך `discipline`, **לפני** הרצת `check-meta`:
```yaml
      - name: Self-test the gate checkers
        run: node scripts/tests/run-all.mjs
```
עלות: פחות מ-10 שניות (מדוד — 9 קבצים, ללא HTTP).

## 7.3 · כיסוי הבדיקות-העצמי: 3 שערים ללא בדיקה כלל, כולל הלוגיקה שמחליטה מי חוסם [חמור]

מהריצה: `9/9 test files passed`, ‏42 טענות. אין קובץ בדיקה עבור:

| ללא בדיקה-עצמית | מה זה אומר |
|---|---|
| `gate-lessons.mjs` | הבאג של §2.4 (תאריך-עתיד + `>` חמור) בלתי מכוסה |
| `check-graph-fresh.mjs` | שני מצבים (mtime / git-log), 126 שורות, אפס טענות |
| **`check-meta.mjs` עצמו** | ‏`ADVISORY`, ‏`SKIP_IDS`, ‏`SKIP_ALL`, וצבירת `failed` — **הקוד שמחליט אם משהו חוסם בכלל — אינו נבדק** |
| `session-rules.mjs` | חילוץ §3/§4/§10/§11; הכותרת מודה שכבר היה בו באג `lastIndex` שנתפס ידנית |

**התיקון:** קובץ `scripts/tests/test-check-meta.mjs` עם ארבע טענות: (1) שער כושל שאינו ADVISORY → exit 1; (2) שער כושל ב-ADVISORY → exit 0 + השורה `STANDING DEBT` בפלט; (3) `META_SKIP_GATE=<id>` → אותו שער מדפיס `SKIPPED` והשאר רצים; (4) ‏`META_SKIP_GATE=ALL` → אף שער לא רץ. אותו דבר ל-`gate-lessons` (כולל מקרה תאריך-עתיד, שחייב להיות אדום).

## 7.4 · `META_SKIP_GATE` עם שם שגוי — נרשם, לא מזהיר [נמוך]

`.githooks/pre-commit` רושם את הערך ל-JSONL ללא אימות; `check-meta.mjs:80-87` פשוט לא מוצא התאמה. ‏`META_SKIP_GATE=check-briefs` (ברבים) יוצר רשומת ביקורת מטעה ולא מדלג על כלום.
**התיקון:** ב-`check-meta.mjs`, אחרי שורה 108: `for (const id of SKIP_IDS) if (id!=='ALL' && !KNOWN_IDS.has(id)) { console.error(\`META_SKIP_GATE names an unknown gate: "${id}"\`); process.exit(2); }`

## 7.5 · חלון 80 התווים ב-`check-brief` [נמוך]

`check-brief.mjs:83` — ‏`text.slice(m.index, m.index + 80)`, כאשר `m.index` הוא תחילת `"npx"`. נשארים ~62 תווים לאיתור `.spec.ts`. ‏brief שכותב `npx playwright test --config=playwright.config.ts tests/model-cure.spec.ts` נכשל שקרית (73 תווים עד `.spec.ts` — גבולי).
**התיקון:** `text.slice(m.index, m.index + 200)`, או טוב יותר — בדוק את יתרת השורה בלבד: `text.slice(m.index).split('\n')[0]`.

## 7.6 · `check-shipped-closed`: שורה שאינה מסתיימת ב-`|` נעלמת [נמוך]

`check-shipped-closed.mjs:89` — `if (!m || !line.trim().endsWith('|')) continue;`. שורת מרשם עם רווח נגרר או עמודה חסרה יוצאת מהמפה כליל. הכיוון בטוח (המזהה יידווח כ"לא קיים במרשם"), אבל ההודעה תהיה `typo, or the row was deleted` — אבחון שגוי שישלח מישהו לחפש את הדבר הלא נכון. **התיקון:** הפרד את המקרה — אם המזהה נמצא בקובץ אך לא נותח, אמור `row found but malformed (does not end with "|")`.

---

# 8 · התשובה לשאלה שמעל כולן

התדריך שאל: מערכת שלמה של שערים הייתה ירוקה לאורך כל הזמן שבו הפגמים נכנסו ונשלחו — מה זה אומר על השערים?

זה אומר שלושה דברים מדידים:

1. **השערים בודקים את הצורה של המסמכים על אודות העבודה, לא את העבודה.** שמונה שערים, 1,395 שורות, ואף לא אחד קורא ערך נתונים אחד או פיקסל אחד. סוקר 06 מצא 53 בלוקים עם ציטוט שגוי; סוקר 08 מצא 279 פריטים עם חותמת אימות זהה חסרת מידע; סוקר 05 מצא 24 מתוך 25 טענות ששורדות מוטציה. **לאף אחד משלושת הממצאים האלה אין שער שיכול היה לתפוס אותו — לא כי השערים כשלו, אלא כי הם מסתכלים במקום אחר.**
2. **חמישה מתוך שמונה השערים אינם יכולים להיכשל בשכבה שהוגדרה כסמכותית** (§2.1–2.5). זה לא כשל תכנוני של אדם אחד — זו התוצאה של החלטת ה-`worsening-only`/`grandfather` שנעשתה מסיבה נכונה (שער שחוסם את הקומיט שבא לתקן אותו הוא רעיל) ויושמה במנגנון שגוי (השוואה מול `HEAD`, רשימת פטורים סטטית) במקום במנגנון הנכון (**היקף = מה שהקומיט נוגע בו**).
3. **מספר העקיפות הוא מדד המהימנות האמיתי של השער.** ‏20 עקיפות של `check-brief` ב-6.5 שעות מודדות את איכות הכלל בדיוק כמו ש-24/25 מוטציות ששרדו מודדות את איכות הבדיקות. שניהם אומרים: הצורה נמדדת, המהות לא.

## סדר עדיפויות מוצע לתיקון

| # | תיקון | סעיף | עלות |
|---|---|---|---|
| 1 | `AUDIT_STRICT=1` + `H8_BASELINE_REF` ב-CI | 2.1, 2.3, 5 | 4 שורות YAML |
| 2 | `check-brief`/`check-h9`: `NOT APPLICABLE` במקום `OK` כשאין קלט | 2.2 | 2 שורות |
| 3 | `run-all.mjs` ב-job `discipline` | 7.2 | 3 שורות YAML |
| 4 | היקף = ה-diff המשוער; מחיקת `gate-baselines.json` | 3, 4 | ~15 שורות, מבטל 2 מנגנוני פטור |
| 5 | `Date.parse` בשתי ההשוואות | 7.1 | 2 שורות |
| 6 | `gate-lessons`: קישור לפי מספר גרסה + פסילת תאריך עתידי | 2.4 | ~10 שורות |
| 7 | שורת `COVERAGE:` ב-`check-meta` + `OK (PARTIAL)` | 1, 5 | ~8 שורות |
| 8 | `test-check-meta.mjs` + `test-gate-lessons.mjs` | 7.3 | ~80 שורות |
| 9 | תקציב-ימים ל-`check-graph-fresh`, או אוטומציה של הבנייה | 6 | החלטת בעלים |
| 10 | יומן העקיפות ב-git; הסרת ה-`rm -f` מרשימת ההיתרים | 3.1 | 2 שורות |

**שערים 1–3 ו-5 ניתנים לביצוע בפחות מ-15 שורות סך הכול, והם מחזירים ל-CI את הסמכות שהמסמכים כבר מייחסים לו.** הם התיקון הזול והמשמעותי ביותר בדוח הזה.

---

## תקציר לבעלים

בדקתי את קוד האכיפה כמו קוד רגיל, והרצתי אותו. **חמישה משמונת השערים אינם יכולים להיכשל בשכבה שאתה מכנה "הסמכות בפועל".** הוכחתי שניים בניסוי: `check-h8-ledger` משווה מול `HEAD`, וב-CI ‏`HEAD` הוא בדיוק העץ הנבדק — שיברתי שורה במרשם וקיבלתי EXIT 0; ‏`gate-lessons` מנוטרל לצמיתות על ידי שורת לקח אחת מתוארכת 2099. וראיתי בלוג CI אמיתי ש-`check-brief` ו-`check-h9` מדפיסים שם `nothing to scan` — הספרייה שהם סורקים אינה במאגר כלל, ולכן שני השערים שנעקפו 22 פעם מקומית לא רצים ב-CI ולו פעם אחת. ‏`check-release` מצא היום ארבעה שחרורים מפרים (v281–v284) ויצא 0, כי `AUDIT_STRICT` אינו מוגדר בשום מקום.

‏22 העקיפות אינן הפרת משמעת אלא כלל שאינו מתאים למציאות: `check-brief` שופט את כל הספרייה בכל קומיט, ולכן חוסם עבודה שאינה נוגעת בו. התיקון הנכון הוא שהשער ישפוט את מה שהקומיט נגע בו — וזה מייתר גם את 27 פריטי ה-baseline (שגדלו מ-22 ל-27 יום אחרי ההקפאה, ואיש לא הסיר אף אחד) וגם את מקש העקיפה עצמו. שים לב שהתיקון שלך מ-2 באוגוסט — `make-brief.mjs` — היה הצעד הנכון; הוא פשוט לא נגע בסיבה שבגללה השער חוסם.

ה-`STANDING DEBT` מעולם לא ירד: הגרף לא נבנה מ-30 ביולי, המספר עלה מ-98 ל-113 ביומיים, ו-`graph-freshness.yml` נכשל בכל שמונה הריצות שלו מאז שנוצר — אפס הצלחות. ומעל הכול: כל שמונת השערים קוראים Markdown ו-`git log` בלבד. אף אחד לא נוגע בנתונים ולא במסך. לכן שבעת מספרי הבטיחות השגויים עברו — לא כי שער נכשל, אלא כי אף שער לא מסתכל לשם. ארבעה תיקונים בפחות מ-15 שורות מחזירים ל-CI את הסמכות שהמסמכים כבר מייחסים לו; פירטתי אותם עם קובץ ושורה. לא נגעתי בשום שער ולא ביצעתי commit.
