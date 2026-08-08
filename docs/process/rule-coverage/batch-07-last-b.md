# מנה 7 — תשעת כללי B האחרונים

**אושר על-ידי הבעלים 8.8.26 ("מאשר").** ה-CLI יסרב עד ש-`approved_by_owner` יישא תאריך.

**המנה האחרונה של מעבר הסיווג.** עם אישורה: אפס כללי A או B ללא מנגנון.

| מזהה | קבוצה | מנגנון · יעד | הנימוק |
|---|---|---|---|
| **DoD-12** | `B` | `commit-gate` · `playwright test` | סוויטה מלאה ירוקה, בלי `--retries` ובלי `--workers=1`. **נאכף חלקית** — ‏`check-pytest` חוסם היום; הרגל של Playwright אינו נבדק בהפקדה |
| **DoD-7** | `B` | `posttooluse` · `regression fix cycles` | ‏RED-GREEN לתיקון באג: להחזיר את התיקון, לראות נפילה, להחזיר. דורש מצב על רצף הריצות. **לא נאכף** |
| **H9** | `B` | `stop` · `task summaries` | טבלת סיכום בת חמש שורות בסוף כל משימה. ‏hook של Stop רואה את התשובה ויכול לבדוק את המבנה. **לא נאכף** |
| **H10** | `B` | `commit-gate` · `docs/STATUS-BOARD.md` | הלוח מתעדכן בכל סגירת משימה. **נאכף חלקית** — ‏`check-board-fresh.mjs` קיים |
| **H11** | `B` | `commit-gate` · `docs/CAPABILITIES.md` | טבלת היכולות. אותו דפוס כמו H10. **לא נאכף** |
| **H14** | `B` | `commit-gate` · `release commits` | דו"ח UX לכל גרסה. הטריגר צר וברור: הפקדת שחרור. **לא נאכף** |
| **L12** | `B` | `stop` · `browser_navigate` | בדיקת UI שאימתה build מיושן. **כבר נאכף** — `stale-dev-server.mjs` |
| **L29** | `B` | `commit-gate` · `release state` | שער שחרור שרץ על המצב הלא-נכון. ‏**עלות גבוהה:** דורש לדעת מה ה"מצב הנכון" לכל שער. **חשיבות גבוהה** — זה כשל שחרור |
| **L30** | `B` | `ci-gate` · `test file sizes` | "ירוק אצלי" אינו ירוק — גודל קובץ בדיקה כאות לקטיעה. סריקה זולה, **לא נאכף** |

⚠️ **שלושה מהם מסומנים "נאכף חלקית" ולא "נאכף"** — ‏DoD-12, ‏H10, ‏L12 הוא היחיד שנאכף במלואו. אם
אסמן חלקי כמלא, הכיסוי ייראה טוב יותר והמציאות לא תשתנה.

## מה יוחל אם תאשר

```json
{
  "approved_by_owner": "2026-08-08",
  "entries": [
    { "rule_id": "DoD-12", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "playwright test" },
    { "rule_id": "DoD-7", "rule_group": "B", "mechanism": "posttooluse", "mechanism_target": "regression fix cycles" },
    { "rule_id": "H9", "rule_group": "B", "mechanism": "stop", "mechanism_target": "task summaries" },
    { "rule_id": "H10", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "docs/STATUS-BOARD.md" },
    { "rule_id": "H11", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "docs/CAPABILITIES.md" },
    { "rule_id": "H14", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "release commits" },
    { "rule_id": "L12", "rule_group": "B", "mechanism": "stop", "mechanism_target": "browser_navigate" },
    { "rule_id": "L29", "rule_group": "B", "mechanism": "commit-gate", "mechanism_target": "release state" },
    { "rule_id": "L30", "rule_group": "B", "mechanism": "ci-gate", "mechanism_target": "test file sizes" }
  ]
}
```

**להחלה אחרי אישור:** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-07-last-b.md`
