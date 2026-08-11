# Batch s07 — four rules classified by the owner, 2026-08-11

**Approved by the owner 2026-08-11**, decided one at a time in conversation. Three of the four were
written in the preceding three days, each from a failure where knowing the rule did not prevent the
behaviour — which is the argument the owner accepted for giving each one a mechanism.

## `10.25` → `A` · `pretooluse:Edit|Write`

The owner's own instruction from 2026-08-10: the infrastructure is written in English; only the
conversation is Hebrew. Hebrew written into a gate script, a rule pattern, a plan, a brief or a
register row is a pattern visible in the artifact, decidable without reading intent.

The controller stated the caveat before the owner ruled: classifying this `A` **creates** work
rather than removing it, so the usual "the comfortable answer is the suspicious one" test does not
apply — but the owner had not been asked, and an unasked decision is not a decision.

Target: `scripts/**`, `docs/superpowers/**`, and new register rows — never the product's own strings
and never the safety data.

## `L84` → `B` · `stop`

A timestamp in a report with no clock reading behind it. It needs a PRIOR FACT — did a clock read
happen in this session — which no amount of reading the message text can decide. Same shape as
`L63a`, already classified `B` for the same reason.

Born from the controller writing "16:40" when the clock read 16:27, then promising in writing that
every timestamp would be read from the system, then writing "09:15" at 09:09 the next morning. Every
other rule here had a mechanism; the timestamp had only the promise, and the promise is what failed.

## `L85` → `A` · `pretooluse:Bash`

Composing code-bearing prose inside a bash heredoc. A heredoc whose body carries a backslash escape
or a nested quote is a pattern plainly visible in the command text, decidable without intent — the
same shape as `L73`, which already inspects Bash calls for a forbidden combination.

Fifteen failures in three days, all with full knowledge of the hazard: `\b` in a non-raw Python
string became a literal BACKSPACE byte and put control characters into the register twice — while
the row being written described a word-boundary defect. That is the strongest available evidence
that awareness is not the remedy and a mechanism is.

## `L76` → `A`

Open since 2026-08-09, where the two blind classifiers disagreed: is "a spec approved in the
register" a pattern in the artifact (alpha said `A`) or a prior fact that must be known (beta said
`B`)? The owner ruled `A`: it reduces to a lookup. A spec present in the register as approved
licenses editing itself; one absent or marked unapproved does not. Presence or absence decides it,
without reading intent.

```json
{
 "approved_by_owner": "2026-08-11",
 "entries": [
  {
   "rule_id": "10.25",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "Hebrew written into scripts/**, docs/superpowers/** or a new register row — never product strings or safety data"
  },
  {
   "rule_id": "L84",
   "rule_group": "B",
   "mechanism": "stop",
   "mechanism_target": "a report carrying a clock timestamp with no clock_read event recorded this session"
  },
  {
   "rule_id": "L85",
   "rule_group": "A",
   "mechanism": "pretooluse:Bash",
   "mechanism_target": "a heredoc body containing a backslash escape or a nested quote"
  },
  {
   "rule_id": "L76",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "a spec file edit checked against the register's approved-spec list"
  }
 ]
}
```
