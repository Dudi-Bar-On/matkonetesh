# מנה 6 — עשרת כללי B הראשונים

**אושר על-ידי הבעלים 8.8.26 ("מאשר").** ה-CLI יסרב עד ש-`approved_by_owner` יישא תאריך.

‏**‏B פירושו שהכלל דורש מצב** — מונה, אירוע קודם, או ידיעה מה קרה לפני. **שבעה מהעשרה כבר נאכפים**,
כי בדיוק את זה בנינו בשלב 4 היום.

| מזהה | קבוצה | מנגנון · יעד | הנימוק |
|---|---|---|---|
| **1** | `B` | `pretooluse:Edit\|Write` · `skill invocations` | **כבר נאכף** — שלושת הטריגרים: `brainstorm-before-creative`, `debugging-before-fix-edit`, `verify-before-success-claim` |
| **5** | `B` | `pretooluse:Edit\|Write` · `fix cycles per failing test` | **כבר נאכף** — `fix-cycle-limit.mjs`, תקרת שלושת התיקונים |
| **10.16** | `B` | `commit-gate` · `git commit` | **כבר נאכף** — `lessons-before-commit.mjs`. חסם אותי חמש פעמים היום |
| **10.2** | `B` | `stop` · `app.js, app.css` | **כבר נאכף** — `ui-playwright-before-done.mjs` |
| **10.10** | `B` | `stop` · `live claims` | **כבר נאכף** — `live-url-verified.mjs` |
| **11** | `B` | `commit-gate` · `§11 lessons log` | **כבר נאכף** — אותו שער של 10.16; יומן הלקחים הוא המקום שאליו הוא מפנה |
| **2** | `B` | `pretooluse:Edit\|Write` · `specs, plans` | **כבר נאכף חלקית** — `brainstorm-before-creative` אוכף את שער-העיצוב של הצנרת. השלבים המאוחרים (סקירה, סיום) אינם נאכפים |
| **10.4** | `B` | `commit-gate` · `§11 lessons log` | "ללמוד מכשלים — לכתוב את הלקח". **אותו מנגנון של 10.16**, ומכוסה בו |
| **10.7** | `B` | `sessionstart` · `discipline document` | קריאת המשמעת בתחילת כל משימה. **נאכף חלקית** — ‏`session-rules.mjs` מזריק את החוקים ב-SessionStart; מה שאינו נאכף הוא **קריאה בתחילת כל משימה** בתוך session |
| **10.18** | `B` | `posttooluse` · `measurement runs` | "דיבוג ואז מדידה — כשל **עוצר** את המדידה". דורש מצב: האם רצה מדידה, והאם משהו נכשל בתוכה. **לא נאכף היום** |

## מה יוחל אם תאשר

```json
{
  "approved_by_owner": "2026-08-08",
  "entries": [
    { "rule_id": "1", "rule_group": "B", "mechanism": "pretooluse:Edit|Write", "mechanism_target": "skill invocations" },
    { "rule_id": "5", "rule_group": "B", "mechanism": "pretooluse:Edit|Write", "mechanism_target": "fix cycles per failing test" },
    { "rule_id": "10.16", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "git commit" },
    { "rule_id": "10.2", "rule_group": "B", "mechanism": "stop", "mechanism_target": "app.js, app.css" },
    { "rule_id": "10.10", "rule_group": "B", "mechanism": "stop", "mechanism_target": "live claims" },
    { "rule_id": "11", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "section 11 lessons log" },
    { "rule_id": "2", "rule_group": "B", "mechanism": "pretooluse:Edit|Write", "mechanism_target": "specs, plans" },
    { "rule_id": "10.4", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "section 11 lessons log" },
    { "rule_id": "10.7", "rule_group": "B", "mechanism": "sessionstart", "mechanism_target": "discipline document" },
    { "rule_id": "10.18", "rule_group": "B", "mechanism": "posttooluse", "mechanism_target": "measurement runs" }
  ]
}
```

**להחלה אחרי אישור:** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-06-group-b.md`
