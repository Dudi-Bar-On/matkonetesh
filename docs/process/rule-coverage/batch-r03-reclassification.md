# מנה 3 — סיווג מחדש לפי הקריטריון

**טרם אושר.** ‏`approved_by_owner` הוא `null`, וה-CLI יסרב להחיל עד שיישא תאריך.

כל שורה כאן היא **הסכמה עיוורת של שתי מסווגות** שלא ראו זו את תשובות זו, לא ראו את
הסיווג הקיים, ולא ידעו באיזה כלל מדובר. אי-ההסכמות אינן כאן — הן ברשימה נפרדת.

| מזהה | מ- | ל- | מנגנון | הנימוק המוסכם |
|---|---|---|---|---|
| **H13** | `C` | `B` | `commit-gate` · יעד `commits implementing an ⚠️R item, checked against its ledger row in docs/ROADMAP-2026-07-30.md §5a` | Compound: the relevance assessment itself is judgment, but the operative requirement is the sequence — verdict recorded with the owner before pickup proceeds — which is a prior-event fact held in the ledger (the state st |
| **L14** | `none` | `B` | `stop` · יעד `responses claiming a version is live / released` | the claim's legitimacy depends entirely on what happened before it — push event followed by a passing live-URL verification — facts observable in the tool log / state store |
| **L16** | `none` | `B` | `pretooluse:Edit|Write` · יעד `CLAUDE.md and other derived/summary artifacts (indexes, agent briefs)` | compliance = the source was opened and worked through before writing; that is a prior-event question observable in the tool log, not a pattern in the written file itself |
| **L25** | `none` | `B` | `pretooluse:Agent` · יעד `agent dispatches under the §10.5a concurrency ceiling` | a single dispatch payload cannot decide compliance; the caps (≤3 light, hard 5, one heavy during a suite) depend entirely on what is already running |
| **L41** | `C` | `B` | `subagentstop` · יעד `git status/git log versus the finished subagent's completion claim` | The decision needs the sequence 'claim made, then repo checked' — both facts are observable at subagent completion, and a claim with a dirty tree/absent commit is non-compliance. |
| **L44** | `C` | `B` | `pretooluse:Agent` · יעד `dispatch of the next implementation task while a prior task's changes lack a full-suite run` | Gate (b) is decidable from the sequence of prior observable events (task finished, suite run or not before next dispatch); gate (a), RED-on-the-brief's-code, rides on the existing TDD rule. |
| **L56** | `C` | `B` | `pretooluse:Edit|Write` · יעד `implementation files (app.js|tests/**) edited under a spec-governed task` | Compliance is 'the spec was opened before implementing from it' — a question about a prior event, not about the edit's content. |
| **L19** | `none` | `C` | — | compliance = the fix was shown to fire via a changed error signature on reproduction; judging whether the observed signature change actually demonstrates the mechanism engaged is an evaluation of evidence meaning, not a  |
| **L22** | `none` | `C` | — | compliance = when a wait hangs on an idle machine, the debugger instrumented the boundary between layers before theorizing within one; assessing whether a debugging session followed that heuristic requires evaluating the |

## מה יוחל אם תאשר

```json
{
 "approved_by_owner": null,
 "entries": [
  {
   "rule_id": "H13",
   "rule_group": "B",
   "mechanism": "commit-gate",
   "mechanism_target": "commits implementing an ⚠️R item, checked against its ledger row in docs/ROADMAP-2026-07-30.md §5a"
  },
  {
   "rule_id": "L14",
   "rule_group": "B",
   "mechanism": "stop",
   "mechanism_target": "responses claiming a version is live / released"
  },
  {
   "rule_id": "L16",
   "rule_group": "B",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "CLAUDE.md and other derived/summary artifacts (indexes, agent briefs)"
  },
  {
   "rule_id": "L25",
   "rule_group": "B",
   "mechanism": "pretooluse:Agent",
   "mechanism_target": "agent dispatches under the §10.5a concurrency ceiling"
  },
  {
   "rule_id": "L41",
   "rule_group": "B",
   "mechanism": "subagentstop",
   "mechanism_target": "git status/git log versus the finished subagent's completion claim"
  },
  {
   "rule_id": "L44",
   "rule_group": "B",
   "mechanism": "pretooluse:Agent",
   "mechanism_target": "dispatch of the next implementation task while a prior task's changes lack a full-suite run"
  },
  {
   "rule_id": "L56",
   "rule_group": "B",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "implementation files (app.js|tests/**) edited under a spec-governed task"
  },
  {
   "rule_id": "L19",
   "rule_group": "C"
  },
  {
   "rule_id": "L22",
   "rule_group": "C"
  }
 ]
}
```
