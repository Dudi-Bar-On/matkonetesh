# מנה 2 — סיווג מחדש לפי הקריטריון

**אושר על-ידי הבעלים 9.8.26 ("מאשר את כל 4 המנות, תחיל אותן").**

כל שורה כאן היא **הסכמה עיוורת של שתי מסווגות** שלא ראו זו את תשובות זו, לא ראו את
הסיווג הקיים, ולא ידעו באיזה כלל מדובר. אי-ההסכמות אינן כאן — הן ברשימה נפרדת.

| מזהה | מ- | ל- | מנגנון | הנימוק המוסכם |
|---|---|---|---|---|
| **L27** | `none` | `A` | `posttooluse` · יעד `docs/superpowers/plans/**` | the rule already names its own mechanical detector: fenced-block counts and a truncation detector run on every generated plan before review |
| **L39** | `C` | `A` | `pretooluse:Bash` · יעד `commands that echo/print/log an API-key variable or literal` | The enforceable core is the never-echo-a-key clause, decided by the presence of a key name/literal in an output-producing command; the env-scope retrieval line is a how-to attached to it. |
| **L52** | `none` | `A` | `pretooluse:Edit|Write` · יעד `docker-compose.yml / container and dependency version pins in config files` | The operative rule — pin the newest version NUMBER, never the floating 'latest' tag — is decided by the literal presence/absence of the tag in the file; the read-the-release-notes rider is advisory around it. |
| **L57** | `C` | `A` | `pretooluse:Edit|Write` · יעד `tests/**` | The forbidden shape — skip fed by a catch-all — is a literal structural pattern in the diff; its presence decides non-compliance without reading intent. |
| **L9** | `none` | `A` | `pretooluse:Edit|Write` · יעד `tests/**` | Both halves of the hazard are literal tokens in one file; their co-occurrence decides the sweep-is-needed condition without reading intent. |
| **10** | `none` | `B` | `sessionstart` · יעד `docs/process/development-discipline.md` | Compliance is a sequencing fact — the doc was re-read before the task started — decidable from prior observed Read events, not from any single artifact's content. |
| **10.1** | `C` | `B` | `commit-gate` · יעד `git commit` | Compound ('review clean' is judgment); I weighted the operative 'only then move forward' clause — a sequencing fact over prior recorded runs and edits, observable in the state store. |
| **10.14** | `C` | `B` | `pretooluse:Edit|Write` · יעד `the file/target of the current fix attempt` | Compound (depth-of-research is judgment); I weighted the operative STOP — blocking attempt #4 turns on a prior-event counter, not on content meaning. |
| **DoD-2** | `C` | `B` | `commit-gate` · יעד `git commit introducing a test + implementation pair` | Compound: 'failing for the intended reason' is a judgment clause, but the operative requirement is the witnessed sequence (test first → observed RED → then implementation), which is a question about prior events observab |

## מה יוחל אם תאשר

```json
{
 "approved_by_owner": "2026-08-09",
 "entries": [
  {
   "rule_id": "L27",
   "rule_group": "A",
   "mechanism": "posttooluse",
   "mechanism_target": "docs/superpowers/plans/**"
  },
  {
   "rule_id": "L39",
   "rule_group": "A",
   "mechanism": "pretooluse:Bash",
   "mechanism_target": "commands that echo/print/log an API-key variable or literal"
  },
  {
   "rule_id": "L52",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "docker-compose.yml / container and dependency version pins in config files"
  },
  {
   "rule_id": "L57",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "tests/**"
  },
  {
   "rule_id": "L9",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "tests/**"
  },
  {
   "rule_id": "10",
   "rule_group": "B",
   "mechanism": "sessionstart",
   "mechanism_target": "docs/process/development-discipline.md"
  },
  {
   "rule_id": "10.1",
   "rule_group": "B",
   "mechanism": "commit-gate",
   "mechanism_target": "git commit"
  },
  {
   "rule_id": "10.14",
   "rule_group": "B",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "the file/target of the current fix attempt"
  },
  {
   "rule_id": "DoD-2",
   "rule_group": "B",
   "mechanism": "commit-gate",
   "mechanism_target": "git commit introducing a test + implementation pair"
  }
 ]
}
```
