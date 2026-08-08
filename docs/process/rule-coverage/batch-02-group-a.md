# מנה 2 — עשרת כללי A הראשונים

**אושר על-ידי הבעלים 8.8.26 ("מאשר").** ה-CLI יסרב עד ש-`approved_by_owner` יישא תאריך.

## מה שיש כאן

ארבעה מהעשרה **כבר נאכפים בפועל** — המנה הזו רק אומרת איפה, כלומר סוגרת את הפער בין "יש כלל" לבין
"ידוע מי אוכף אותו". ארבעה נוספים ניתנים לאכיפה ואינם נאכפים עדיין. שניים אינם דרישות כלל.

| מזהה | קבוצה | מנגנון · יעד | הנימוק |
|---|---|---|---|
| **10.5a** | `A` | `pretooluse:Agent` · `Agent dispatch` | **כבר נאכף** — `agent-concurrency-ceiling.mjs`. המנה רק רושמת זאת |
| **10.13** | `A` | `pretooluse:Grep\|WebSearch` · `docs/**` | **כבר נאכף** — `geniza-fallback-declaration.mjs` |
| **10.17** | `A` | `pretooluse:Grep\|WebSearch` · `app.js, src/**, scripts/**` | **כבר נאכף** — `symbolic-grep-use-serena.mjs` |
| **11a** | `A` | `pretooluse:Bash` · `playwright test, serve.js` | **כבר נאכף** — `no-concurrent-suite-run.mjs` ו-`stale-dev-server.mjs` |
| **10.11** | `A` | `pretooluse:Grep\|WebSearch` · `WebSearch` | "הגניזה לפני האינטרנט". קרוב מאוד ל-10.13 ואותו hook יכול להצהיר על שניהם — אבל **הטריגר שונה**: 10.13 על חיפוש במסמכים, 10.11 על פנייה לרשת. מימוש בקשת 2 |
| **10.12** | `A` | `commit-gate` · `check-geniza-fresh` | **כבר נאכף** — ‏`check-geniza-fresh.mjs` חוסם, וחסם אותי היום. המנה רושמת את הקשר |
| **10.20** | `A` | `commit-gate` · `מילוני השפות` | מחרוזת חדשה מחייבת עדכון **כל** מילוני השפות באותה הפקדה. בדיק מכנית: השוואת מפתחות בין המילונים ב-pre-commit. **לא נאכף היום** |
| **10.23** | `A` | `pretooluse:Agent` · `Agent dispatch` | "סדרתי ובטוח זה ליבת החכמה" — זהו **הנימוק** שמאחורי תקרת 10.5a, ואותו hook אוכף את שניהם. יצהיר על שני המזהים |
| 10.12a | `none` | — | **רשומה היסטורית**, לא דרישה: מתעד את עידן graphify והכלי הוסר ב-4.8.26. **עלות:** אין מה לאכוף. **חשיבות:** נמוכה כדרישה, גבוהה כהסבר למה יצאנו |
| 12.1 | `none` | — | "מה נדחה ומדוע" — **תיעוד החלטה**, לא דרישה. **עלות:** אין דפוס לבדוק. **חשיבות:** גבוהה כזיכרון ארגוני, אפס כשער |

## מה יוחל אם תאשר

```json
{
  "approved_by_owner": "2026-08-08",
  "entries": [
    { "rule_id": "10.5a", "rule_group": "A", "mechanism": "pretooluse:Agent", "mechanism_target": "Agent dispatch" },
    { "rule_id": "10.13", "rule_group": "A", "mechanism": "pretooluse:Grep|WebSearch", "mechanism_target": "docs/**" },
    { "rule_id": "10.17", "rule_group": "A", "mechanism": "pretooluse:Grep|WebSearch", "mechanism_target": "app.js, src/**, scripts/**" },
    { "rule_id": "11a", "rule_group": "A", "mechanism": "pretooluse:Bash", "mechanism_target": "playwright test, serve.js" },
    { "rule_id": "10.11", "rule_group": "A", "mechanism": "pretooluse:Grep|WebSearch", "mechanism_target": "WebSearch" },
    { "rule_id": "10.12", "rule_group": "A", "mechanism": "commit-gate", "mechanism_target": "check-geniza-fresh" },
    { "rule_id": "10.20", "rule_group": "A", "mechanism": "commit-gate", "mechanism_target": "language dictionaries" },
    { "rule_id": "10.23", "rule_group": "A", "mechanism": "pretooluse:Agent", "mechanism_target": "Agent dispatch" },
    { "rule_id": "10.12a", "rule_group": "none", "mechanism": "none",
      "cost": "אין מה לאכוף — הכלי הוסר ב-4.8.26",
      "importance": "נמוכה כדרישה, גבוהה כהסבר היסטורי למה יצאנו מ-graphify" },
    { "rule_id": "12.1", "rule_group": "none", "mechanism": "none",
      "cost": "תיעוד החלטה — אין דפוס מכני לבדוק",
      "importance": "גבוהה כזיכרון ארגוני, אפס כשער" }
  ]
}
```

**להחלה אחרי אישור:** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-02-group-a.md`
