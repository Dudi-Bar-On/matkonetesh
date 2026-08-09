# מנה 1 — סיווג מחדש לפי הקריטריון

**אושר על-ידי הבעלים 9.8.26 ("מאשר את כל 4 המנות, תחיל אותן").**

כל שורה כאן היא **הסכמה עיוורת של שתי מסווגות** שלא ראו זו את תשובות זו, לא ראו את
הסיווג הקיים, ולא ידעו באיזה כלל מדובר. אי-ההסכמות אינן כאן — הן ברשימה נפרדת.

| מזהה | מ- | ל- | מנגנון | הנימוק המוסכם |
|---|---|---|---|---|
| **10.12a** | `none` | `A` | `pretooluse:Bash` · יעד `claude -p` | Compound (mostly historical record + one live hazard rule); I weighted the operative neutral-cwd requirement — the command text plus cwd decide compliance mechanically, no intent reading needed. |
| **10.6** | `C` | `A` | `stop` · יעד `the task-closing response (and subagent final reports)` | Compound (structure + honesty-of-content); I weighted the operative structural demand — the fixed table's presence/absence in the closing message decides compliance without reading intent; content truthfulness stays a se |
| **12.1** | `none` | `A` | `pretooluse:Edit|Write` · יעד `PLAN.md|SUMMARY.md|VERIFICATION.md|gsd-*` | Compound (decision record + prohibition); I weighted the operative prohibition — importing the rejected machinery manifests as concretely named artifacts whose mere presence decides violation without reading intent. |
| **12.5** | `none` | `A` | `posttooluse` · יעד `owner-facing gate prompts (structured question tool payloads)` | Every constraint is a countable/structural property of the prompt payload — pure shape rules; no vocabulary entry intercepts the question tool pre-flight, so the check is an observe-and-record on the payload. |
| **13** | `C` | `A` | `pretooluse:Agent` · יעד `task briefs under .superpowers/sdd/** (template docs/process/templates/task-brief.md)` | Compound rule — the runs-where allocation table needs judgment, but the operative, enforced demand is the brief/report file contract, which the rule itself already made mechanical ('a missing field = an invalid brief', t |
| **H15** | `C` | `A` | `pretooluse:Agent` · יעד `every subagent/workflow dispatch` | Compound: whether the RIGHT model per task type was chosen, and the no-escalation-after-success clause, need judgment/history — but the bolded operative demand is 'chosen explicitly, never silently inherited', which the  |
| **L13** | `C` | `A` | `pretooluse:Edit|Write` · יעד `app.js|app.css` | the gate is structural — LTR-island attribute present around math glyphs in Hebrew text — presence/absence of dir="ltr" near those characters is decidable without judging meaning |
| **L17** | `none` | `A` | `commit-gate` · יעד `git commit / the docs-sync script's push` | the gate the rule states is mechanical: diff the staged set against modified tracked files and warn on any leftover — presence of an unstaged-modified line decides, no intent needed |
| **L21** | `none` | `A` | `pretooluse:Edit|Write` · יעד `playwright.config.*` | the operative clause is 'workers: 8 stays' pending an owner decision; a config diff touching that key is a concrete pattern whose presence decides, no intent-reading needed |

## מה יוחל אם תאשר

```json
{
 "approved_by_owner": "2026-08-09",
 "entries": [
  {
   "rule_id": "10.12a",
   "rule_group": "A",
   "mechanism": "pretooluse:Bash",
   "mechanism_target": "claude -p"
  },
  {
   "rule_id": "10.6",
   "rule_group": "A",
   "mechanism": "stop",
   "mechanism_target": "the task-closing response (and subagent final reports)"
  },
  {
   "rule_id": "12.1",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "PLAN.md|SUMMARY.md|VERIFICATION.md|gsd-*"
  },
  {
   "rule_id": "12.5",
   "rule_group": "A",
   "mechanism": "posttooluse",
   "mechanism_target": "owner-facing gate prompts (structured question tool payloads)"
  },
  {
   "rule_id": "13",
   "rule_group": "A",
   "mechanism": "pretooluse:Agent",
   "mechanism_target": "task briefs under .superpowers/sdd/** (template docs/process/templates/task-brief.md)"
  },
  {
   "rule_id": "H15",
   "rule_group": "A",
   "mechanism": "pretooluse:Agent",
   "mechanism_target": "every subagent/workflow dispatch"
  },
  {
   "rule_id": "L13",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "app.js|app.css"
  },
  {
   "rule_id": "L17",
   "rule_group": "A",
   "mechanism": "commit-gate",
   "mechanism_target": "git commit / the docs-sync script's push"
  },
  {
   "rule_id": "L21",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "playwright.config.*"
  }
 ]
}
```
