# Rule-coverage classification batches

> **קו-הבסיס של הכיסוי — דרך כתיבה אחת בלבד.**
> ‏`docs/process/rule-coverage-baseline.json` נכתב **רק** על ידי
> `node scripts/check-rule-coverage.mjs --update-baseline` — לעולם לא ביד, ולעולם לא על ידי השער עצמו.
> הסיבה אינה סגנון: שער שכותב מחדש את קו-הבסיס שלו **מאשר בדיוק את הנסיגה שהוא נועד לתפוס**, כמו
> בדיקה שמעדכנת את ה-snapshot שלה כשהיא נכשלת. מעדכנים **אחרי** שהבעלים אישר את אובדן הכיסוי.

One batch file per owner approval; the JSON is the record, the prose is the argument. A batch file
is a Markdown file: a human-readable proposal table, a rationale, a mandatory `## הורדות מוצעות`
section (proposed demotions to `none` — or the line `אין הורדות מוצעות במנה זו` if there are
none this batch), and **exactly one** fenced ` ```json ` block:

```json
{"batch": 1, "approved_by_owner": null,
 "entries": [
   {"rule_id": "L68", "rule_group": "A", "mechanism": "pretooluse:Bash",
    "mechanism_target": "git commit", "reason": "…", "cost": null, "importance": null}
 ]}
```

`approved_by_owner` starts `null` (a draft) and is only ever set to a `YYYY-MM-DD` string by a
controller who was told the approval in conversation — never inferred, never pre-filled. A demotion
(`rule_group` or `mechanism` == `"none"`) must carry non-empty `cost` and `importance` strings.
A batch may hold at most 10 entries.

Apply with:

```
py -3 scripts/classify_rules.py docs/process/rule-coverage/batch-NN.md [--dry-run]
```
