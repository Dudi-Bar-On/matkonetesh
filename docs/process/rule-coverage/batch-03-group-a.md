# מנה 3 — עשרה נוספים

**אושר על-ידי הבעלים 8.8.26 ("מאשר").** ה-CLI יסרב עד ש-`approved_by_owner` יישא תאריך.

⚠️ **שלושה מהעשרה עוברים קבוצה** — מ-`A` ל-`C` או ל-`none`. זו לא הורדה של דרישה אלא תיקון סיווג:
מישהו סימן אותם כדטרמיניסטיים, והם אינם. ה-CLI יצהיר על כל מעבר במפורש.

| מזהה | קבוצה | מנגנון · יעד | הנימוק |
|---|---|---|---|
| **9** | `A` | `pretooluse:Bash` · `git worktree add, git checkout -b` | **כבר נאכף** — `main-only-no-worktrees.mjs` |
| **H8** | `A` | `commit-gate` · `check-h8-ledger` | **כבר נאכף** — `check-meta.mjs` מריץ את שער H8 |
| **DoD-3** | `A` | `stop` · `טענות הצלחה` | **כבר נאכף** — `verify-before-success-claim.mjs`: טענת "ירוק" בלי פלט מודבק נחסמת |
| **DoD-11** | `A` | `ci-gate` · `tests/**.ts` | סריקה סטטית ל-`waitForTimeout`. בדיק לחלוטין, **לא נאכף היום** |
| **L10** | `A` | `pretooluse:Bash` · `playwright test` | ‏`--workers=1`/`--retries` בפקודת הסוויטה. ה-hook רואה את הפקודה. **לא נאכף היום** |
| **DoD-10** | `A` | `commit-gate` · `data.py, sources.py` | שינוי בשדה `safe`/`temp`/`bcheck` בלי אזכור בהודעת ההפקדה. **זה שער בטיחות ולכן שווה גם אם יקר** |
| **DoD-8** | `A` | `commit-gate` · `app.js, app.css → mockups/**` | שינוי UI בלי צילום ב-390×844 בהפקדה. בדיק, **לא נאכף היום** |
| DoD-2 | `C` | — | **תיקון סיווג, לא ויתור.** "‏RED נצפה מהסיבה הנכונה" — הסיבה היא שיפוט. מכנית אפשר לראות שבדיקה רצה ונכשלה; **אי-אפשר לראות שנכשלה מהסיבה הנכונה**, וזו כל תכליתו של הכלל. ‏**עלות:** דורש שופט. **חשיבות:** גבוהה מאוד — דחיתי שש REDs מזויפות היום |
| H15 | `C` | — | **תיקון סיווג.** בחירת מודל ומאמץ לפי קושי המשימה — "קושי" אינו נגזר מכני. ‏**עלות:** דורש שופט. **חשיבות:** בינונית |
| 12.5 | `none` | — | דפוסי ניסוח לשאלות-שער — **הדרכה, לא דרישה**. ‏**עלות:** אין דפוס לבדוק. **חשיבות:** בינונית ככתיבה טובה |

## מה יוחל אם תאשר

```json
{
  "approved_by_owner": "2026-08-08",
  "entries": [
    { "rule_id": "9", "rule_group": "A", "mechanism": "pretooluse:Bash", "mechanism_target": "git worktree add, git checkout -b" },
    { "rule_id": "H8", "rule_group": "A", "mechanism": "commit-gate", "mechanism_target": "check-h8-ledger" },
    { "rule_id": "DoD-3", "rule_group": "A", "mechanism": "stop", "mechanism_target": "success claims" },
    { "rule_id": "DoD-11", "rule_group": "A", "mechanism": "ci-gate", "mechanism_target": "tests/**.ts" },
    { "rule_id": "L10", "rule_group": "A", "mechanism": "pretooluse:Bash", "mechanism_target": "playwright test" },
    { "rule_id": "DoD-10", "rule_group": "A", "mechanism": "commit-gate", "mechanism_target": "data.py, sources.py" },
    { "rule_id": "DoD-8", "rule_group": "A", "mechanism": "commit-gate", "mechanism_target": "app.js, app.css -> mockups/**" },
    { "rule_id": "DoD-2", "rule_group": "C",
      "cost": "דורש שופט — 'נכשלה מהסיבה הנכונה' אינו נגזר מכנית",
      "importance": "גבוהה מאוד — שש REDs מזויפות נדחו היום" },
    { "rule_id": "H15", "rule_group": "C",
      "cost": "דורש שופט — 'קושי המשימה' אינו נגזר מכנית",
      "importance": "בינונית" },
    { "rule_id": "12.5", "rule_group": "none", "mechanism": "none",
      "cost": "הדרכת ניסוח — אין דפוס מכני",
      "importance": "בינונית ככתיבה טובה, אפס כשער" }
  ]
}
```

**להחלה אחרי אישור:** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-03-group-a.md`
