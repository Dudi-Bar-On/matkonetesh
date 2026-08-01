# Selector contract — the rule (Phase 0) · the full inventory lands with the Phase 3 codemod (Dec-H3/H4)

**הכלל (discipline §9, מחייב מ-Phase 0):**
1. בדיקה נשענת אך ורק על סלקטורים הרשומים כאן (data-testid / id / class יציבים). סלקטור שלא ברשימה —
   מוסיפים אותו לכאן באותו commit שמשתמש בו.
2. כל מפתח אחסון (localStorage) חדש נכתב תחת קידומת `mk-`.
3. בהסבת קוד (חילוצי המודולים, Phase 3/5/9/12) כל `id`/`class`/`data-*` שבדיקה נשענת עליו נשמר (Dec-H4)
   — מאות בדיקות DOM עוברות בחינם.

**זרע (סלקטורים שכבר משמשים חוזים דה-פקטו):**
| Selector | Meaning | Used by |
|---|---|---|
| `.foot-stamp` | version stamp `מהדורה NNN` | §10.10 live verification + release probes |
| `#mkWarnAlarm` / `.mk-alarm-warn` | D1/V-1: persistent visual counterpart to the spoken timer 2-min warning | d1-timer-warn-visual.spec.ts |
| `[data-warnstop]` | dismiss button on the timer-warning card | d1-timer-warn-visual.spec.ts |

*(הטבלה מתמלאת אינקרמנטלית; האינוונטר המלא — משימה נקובה בתוכנית Phase 3.)*
