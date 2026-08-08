# מנה 5 — תשעת כללי A האחרונים

**אושר על-ידי הבעלים 8.8.26 ("מאשר").** ה-CLI יסרב עד ש-`approved_by_owner` יישא תאריך.

עם המנה הזו **נסגר צד ה-A**. חמישה מהתשעה הם סריקות סטטיות זולות; ארבעה הם ניסיון שנרשם.

| מזהה | קבוצה | מנגנון · יעד | הנימוק |
|---|---|---|---|
| **L58** | `A` | `ci-gate` · `scripts/**, tests/**` | `\|\| true` על המתנה או על בדיקה — **"המתנה שאינה יכולה להיכשל אינה המתנה"**. סריקה סטטית, ומוצאת בדיוק את הדפוס |
| **L61** | `A` | `ci-gate` · `**/*.yml, **/*.yaml` | מפתח YAML כפול — **שקט מקומית, קטלני מרחוק**. פרסור ובדיקת כפילות. זול לחלוטין |
| **L66** | `A` | `ci-gate` · `scripts/**.ps1` | ב-PowerShell ה-pipeline הוא ערך-ההחזרה: השמה חשופה פולטת, ‏`Write-Host` לא מגיע. הופיע **ארבע פעמים ויותר** |
| **L59** | `A` | `ci-gate` · `scripts/**, .github/**` | ‏`python` ב-Windows הוא alias של החנות. סריקה ל-`python ` שאינו `py -3`/`python3` |
| **L53** | `A` | `ci-gate` · `scripts/**` | סוד כארגומנט בשורת פקודה. ‏⚠️ **קרוב ל-`check-no-secrets` אך אינו זהה** — זה על **העברה** ולא על אחסון |
| L52 | `none` | — | "תמיד לקחת את החדש" היא מדיניות גרסאות, לא תיוג. **עלות:** דורש שיפוט על כל תלות. **חשיבות:** גבוהה — והיא **הוראת בעלים גורפת** שכבר פועלת בלי שער |
| L54 | `none` | — | שער שמאשים גרוע משער שמפספס. ‏**עלות:** "מאשים" הוא שיפוט על ניסוח. **חשיבות:** גבוהה מאוד — וזו כבר **דרישת-תהליך בכל מפרט מכאן** (תקציב אזהרות-שווא אפס) |
| L55 | `none` | — | חריגה ש-pip יכול לבטל בשקט. ‏**עלות:** תלוי-סביבה, אין דפוס יציב. **חשיבות:** בינונית |
| L9 | `none` | — | שעון-דפדפן נעוץ חשף בדיקה שמערבבת זמן-דף וזמן-בדיקה. ‏**עלות:** דורש הבנת כוונת הבדיקה. **חשיבות:** בינונית — ומכוסה חלקית ב-DoD-11/L15 |

## מה יוחל אם תאשר

```json
{
  "approved_by_owner": "2026-08-08",
  "entries": [
    { "rule_id": "L58", "rule_group": "A", "mechanism": "ci-gate", "mechanism_target": "scripts/**, tests/**" },
    { "rule_id": "L61", "rule_group": "A", "mechanism": "ci-gate", "mechanism_target": "**/*.yml, **/*.yaml" },
    { "rule_id": "L66", "rule_group": "A", "mechanism": "ci-gate", "mechanism_target": "scripts/**.ps1" },
    { "rule_id": "L59", "rule_group": "A", "mechanism": "ci-gate", "mechanism_target": "scripts/**, .github/**" },
    { "rule_id": "L53", "rule_group": "A", "mechanism": "ci-gate", "mechanism_target": "scripts/**" },
    { "rule_id": "L52", "rule_group": "none", "mechanism": "none",
      "cost": "דורש שיפוט על כל תלות בנפרד",
      "importance": "גבוהה — אבל היא הוראת בעלים גורפת שכבר פועלת בלי שער" },
    { "rule_id": "L54", "rule_group": "none", "mechanism": "none",
      "cost": "'מאשים' הוא שיפוט על ניסוח, לא דפוס",
      "importance": "גבוהה מאוד — וכבר דרישת-תהליך בכל מפרט: תקציב אזהרות-שווא אפס" },
    { "rule_id": "L55", "rule_group": "none", "mechanism": "none",
      "cost": "תלוי-סביבה, אין דפוס יציב",
      "importance": "בינונית" },
    { "rule_id": "L9", "rule_group": "none", "mechanism": "none",
      "cost": "דורש הבנת כוונת הבדיקה",
      "importance": "בינונית — מכוסה חלקית ב-DoD-11/L15" }
  ]
}
```

**להחלה אחרי אישור:** `py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-05-last-a.md`
