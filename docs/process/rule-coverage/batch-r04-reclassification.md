# מנה 4 — סיווג מחדש לפי הקריטריון

**אושר על-ידי הבעלים 9.8.26 ("מאשר את כל 4 המנות, תחיל אותן").**

כל שורה כאן היא **הסכמה עיוורת של שתי מסווגות** שלא ראו זו את תשובות זו, לא ראו את
הסיווג הקיים, ולא ידעו באיזה כלל מדובר. אי-ההסכמות אינן כאן — הן ברשימה נפרדת.

| מזהה | מ- | ל- | מנגנון | הנימוק המוסכם |
|---|---|---|---|---|
| **L3** | `none` | `C` | — | deciding whether a test asserts an observable behavioural effect versus a computed field, and whether a fixture is tailored to feed a broken gate, requires judging what the assertion and fixture MEAN, not their text shap |
| **L54** | `none` | `C` | — | Judging whether a gate script distinguishes tool-absence from tool-failure and truthfully states what it ran against requires understanding the script's error-handling semantics — a code-quality judgement, not a token ma |
| **L6** | `none` | `C` | — | Whether `תנור` is used as a generic device word or legitimately means the oven category requires judging the meaning of the string in its domain context; mere presence of the word decides nothing. |
| **L68** | `none` | `C` | — | Compliance is 'before blaming the system under test, verify your instrument measures what you think' — evaluating whether a verification tool was itself validated requires judging the meaning and adequacy of the debuggin |
| **L69** | `none` | `C` | — | Deciding whether at least one test genuinely exercises the entry point with no environment override requires understanding what each test actually spawns and with what env — the compliance condition lives in the tests' s |
| **L7** | `none` | `C` | — | Deciding whether each spec DoD line is genuinely MET by the pasted evidence — versus merely declared MET — requires judging the evidence against the spec's meaning; a present-but-hollow audit block satisfies any textual  |
| **L70** | `none` | `C` | — | The rule is 'fix a false-alarming gate by making its measure precise, never by loosening it' — telling a precision fix from a loosening fix requires judging the intent and effect of the change to the gate. |
| **8** | `C` | `none` | — | בינונית — it is a retrospective declaration whose operative content lives in other rules; as its own rule there is no compliance condition. |
| **L67** | `C` | `none` | — | Medium — it names a real reasoning trap (two stale things agreeing), but it guides judgement rather than constraining any checkable action. |

## מה יוחל אם תאשר

```json
{
 "approved_by_owner": "2026-08-09",
 "entries": [
  {
   "rule_id": "L3",
   "rule_group": "C"
  },
  {
   "rule_id": "L54",
   "rule_group": "C"
  },
  {
   "rule_id": "L6",
   "rule_group": "C"
  },
  {
   "rule_id": "L68",
   "rule_group": "C"
  },
  {
   "rule_id": "L69",
   "rule_group": "C"
  },
  {
   "rule_id": "L7",
   "rule_group": "C"
  },
  {
   "rule_id": "L70",
   "rule_group": "C"
  },
  {
   "rule_id": "8",
   "rule_group": "none",
   "cost": "A personal resolutions list — each bullet restates a requirement that is (or should be) enforced by its own gate (evidence pasting, 390px screenshots, escalation, flaky-as-bug, diff verification); enforcing the list itself would duplicate those gates.",
   "importance": "בינונית — it is a retrospective declaration whose operative content lives in other rules; as its own rule there is no compliance condition."
  },
  {
   "rule_id": "L67",
   "rule_group": "none",
   "cost": "Nothing to enforce: 'consistency with another artefact is not correctness' is a pure principle with no artifact, no prior facts, and no content whose evaluation would constitute compliance.",
   "importance": "Medium — it names a real reasoning trap (two stale things agreeing), but it guides judgement rather than constraining any checkable action."
  }
 ]
}
```
