# מנה 5 — חמשת הכללים שנכתבו אחרי אישור המפרט

**טרם אושר.** ‏`approved_by_owner` הוא `null`, וה-CLI יסרב להחיל עד שיישא תאריך.

אלה הכללים שהתגלו ללא קבוצה כלל — ‏L75 עד L79. ארבעה קיבלו הסכמה מלאה של שתי מסווגות
עיוורות; החמישי חלוק ואינו כאן.

**הערה על העיוורון:** ההפניות ההדדיות בין הלקחים — אחד מהם מצטט אחר בשמו — הוסתרו מהמנה,
אחרת שם הכלל היה מדליף למסווגת באיזה כלל היא מסתכלת. זה נבדק מכנית, לא נסמך על כוונה.

| מזהה | קבוצה | מנגנון | הנימוק המוסכם |
|---|---|---|---|
| **L78** | `B` | `pretooluse:Edit|Write` · יעד `the locked classifier-brief/procedure file (docs/process/rule-coverage/**)` | An edit to the brief is not itself a violation; only an edit BETWEEN dispatches of one measured run is, so compliance turns on the prior sequence (run started, not closed), not on any pattern in the edit alone. |
| **L75** | `A` | `commit-gate` · יעד `untracked test files (tests/**) in git status at commit` | The rule's own practical conclusion is a textual check: after every task, git status must show no untracked test file — presence of a `??` test path decides non-compliance with no intent reading. |
| **L79** | `C` | — | Deciding whether a detector/message promises more than its sampling can support ('index healthy' vs what 400 probes actually cover) requires judging the meaning and epistemic strength of a claim against the coverage of i |
| **L77** | `C` | — | Deciding whether a test's assertion overclaims relative to what honest data can satisfy (absolute absence vs absence of distinct identifiers only) requires evaluating the meaning and scope of the claim against the data's |

## הכלל שאינו כאן

**`L76`** — אלפא `B`, בטא `A`. לא מוחל.

- אלפא: The diff to a spec file alone cannot decide compliance; the deciding fact is a prior event (owner approval) observed in the register, so the edit gate must consult recorded prior state.

- בטא: The rule reduces to a lookup: an approved-in-register spec licenses editing itself, an unlisted/new spec does not — presence or absence of a register entry is decisive without reading intent.

## מה יוחל אם תאשר

```json
{
 "approved_by_owner": null,
 "entries": [
  {
   "rule_id": "L78",
   "rule_group": "B",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "the locked classifier-brief/procedure file (docs/process/rule-coverage/**)"
  },
  {
   "rule_id": "L75",
   "rule_group": "A",
   "mechanism": "commit-gate",
   "mechanism_target": "untracked test files (tests/**) in git status at commit"
  },
  {
   "rule_id": "L79",
   "rule_group": "C"
  },
  {
   "rule_id": "L77",
   "rule_group": "C"
  }
 ]
}
```
