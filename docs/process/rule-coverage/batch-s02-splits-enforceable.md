# מנה s02 — שמונת החצאים הנאכפים

**אושר על-ידי הבעלים 9.8.26 ("מאשר") — הצעת הפיצול.**

זהו החצי ה-`A`/`B` של כל אחד משמונת הכללים שפוצלו. החצי השיפוטי שלהם במנה `s03`.
כל שורה נושאת ארטיפקט ודפוס קונקרטיים, כפי שש1 בקריטריון דורשת — מי שאינו יכול לנקוב בהם,
תשובתו אינה `A`.

| מזהה | קבוצה | מנגנון | יעד |
|---|---|---|---|
| **`L31a`** | `A` | `pretooluse:Agent` | הפרמטר `prompt` של שיגור סוכן |
| **`L23a`** | `A` | `stop` | ההודעה הסופית של הסוכן |
| **`L28a`** | `B` | `pretooluse:Grep\|WebSearch` | קריאות Grep שפוגעות בקובצי מקור |
| **`L51a`** | `A` | `pretooluse:Bash` | פקודות `sudo` בתוך `wsl` לא-אינטראקטיבי |
| **`L36a`** | `B` | `pretooluse:Bash` | ריצת סוויטה מלאה אחרי שגיאת page-closed |
| **`L55a`** | `A` | `pretooluse:Bash` | התקנות pip עוקפות-resolver |
| **`L63a`** | `B` | `stop` | נתיבים המצוטטים כהצדקה בדוח סופי |
| **`L64a`** | `A` | `stop` | טענת "landed/committed" על מסמך בשמו |

**שלושה מהם `B` ולא `A`, וההבדל מהותי:** ‏`L28a`, ‏`L36a` ו-`L63a` אינם ניתנים להכרעה מתוך
הארטיפקט לבדו — צריך לדעת **מה קרה קודם** באותו session: האם נוסה הכלי הייעודי, האם נצפתה שגיאת
סגירה, ואילו קבצים באמת נקראו. זו ש2, לא ש1.

```json
{
 "approved_by_owner": "2026-08-09",
 "entries": [
  {"rule_id": "L31a", "rule_group": "A", "mechanism": "pretooluse:Agent", "mechanism_target": "the Agent dispatch prompt"},
  {"rule_id": "L23a", "rule_group": "A", "mechanism": "stop", "mechanism_target": "the agent's final message"},
  {"rule_id": "L28a", "rule_group": "B", "mechanism": "pretooluse:Grep|WebSearch", "mechanism_target": "Grep calls whose path or glob hits source files"},
  {"rule_id": "L51a", "rule_group": "A", "mechanism": "pretooluse:Bash", "mechanism_target": "Bash commands running sudo inside a non-interactive wsl"},
  {"rule_id": "L36a", "rule_group": "B", "mechanism": "pretooluse:Bash", "mechanism_target": "the next full-suite run after a page-closed error was observed"},
  {"rule_id": "L55a", "rule_group": "A", "mechanism": "pretooluse:Bash", "mechanism_target": "resolver-bypassing pip installs against requirements-overrides.txt"},
  {"rule_id": "L63a", "rule_group": "B", "mechanism": "stop", "mechanism_target": "file paths cited as justification in a final report"},
  {"rule_id": "L64a", "rule_group": "A", "mechanism": "stop", "mechanism_target": "a landed/committed claim over a named document, against git"}
 ]
}
```
