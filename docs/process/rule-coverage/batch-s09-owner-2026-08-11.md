# Batch s09 — L87 and L88 classified by the owner, 2026-08-11

Both lessons were written during Arc 4's final task and, being unclassified, immediately blocked the
next commit. `check-corpus-consistency` — wired into `check-meta.mjs` by that same task, hours
earlier — is what caught them. The gate's first real catch was the arc that built it.

## `L87` → `A` · `pretooluse:Edit|Write`

**A liveness test that spawns the dispatcher it is testing must guard against re-entry.**

Task 9's wiring test ran `check-meta.mjs` as a subprocess to prove a gate blocks. `check-meta` runs
`check-pytest`, which runs the suite, which contains the test — which spawns `check-meta` again.
About 35 orphaned node and python processes before the implementer caught it and killed them by PID
and tree.

Decidable from the artifact: a test file that spawns `check-meta.mjs` (or `check-pytest.mjs`)
without setting the nesting guard is a pattern visible in the text, needing no knowledge of intent.
Same shape as `L73`, which already inspects a call for a forbidden combination.

## `L88` → `B` · `stop`

**A test that hides a credential file must put it back, and only the clock proves it did.**

R-147(a) renamed `infra/.env` and `infra/rules-db/.env` to `.env.hidden-for-test` at 15:52 to
simulate an unconfigured machine, and never renamed them back. For 2h46m the geniza and mk_rules
were unreachable to every later agent — and every gate reported it correctly, which is exactly why
nobody noticed: `SKIPPED — the geniza is not reachable` is identical whether a service is down, was
never configured, or was configured an hour ago and is not now. Task 9 reported it as
"pre-existing, I have no credentials to fix it"; it was 90 minutes old and one `mv` from repaired.

`B`, not `A`, and the distinction is the whole point. The `mv` itself is visible in a command, but
the `mv` is legitimate — it is the documented way to reproduce an unconfigured machine. **The defect
is the absence of the restoring half, and an absence is not a pattern in any artifact.** Deciding it
requires a PRIOR FACT: was this channel reachable earlier in this session? Same reason `L84`
(a timestamp with no clock read behind it) is `B` on `stop`.

The mechanism is `R-152`: a session-scoped memory of which channels answered, so a channel going
dark mid-session is reported as an EVENT rather than as a standing condition.

```json
{
 "approved_by_owner": "2026-08-11",
 "entries": [
  {
   "rule_id": "L87",
   "rule_group": "A",
   "mechanism": "pretooluse:Edit|Write",
   "mechanism_target": "a test file that spawns check-meta.mjs or check-pytest.mjs without the re-entry guard"
  },
  {
   "rule_id": "L88",
   "rule_group": "B",
   "mechanism": "stop",
   "mechanism_target": "an evidence channel reported unreachable that answered earlier in this same session"
  }
 ]
}
```
