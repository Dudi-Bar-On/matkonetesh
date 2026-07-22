---
name: no-inert-shipment
description: Use when about to mark a task done, open a PR, or write a test for anything that computes a value, sets a flag, captures a field, or detects a violation — especially where the value lands on a global, a returned object, or a stored property.
---

# No Inert Shipment

## Overview

**A computed value with no consumer is not shipped. It is stored.**

The work feels finished because the hard part *is* finished: the invariant is correct, the number is right,
the field is captured. Then it lands somewhere nothing reads, and the feature that was supposed to exist
does not exist — while every test passes and every reviewer nods.

Two rules, both about the same gap between *computed* and *observable*:

1. **A value with no production reader is not done.**
2. **A test that asserts the value rather than the effect it should produce is not a test of the feature.**

## When to Use

Before saying "done" about anything that produces a value:
detectors, guards, validators, invariants, computed capacities, captured device/user properties, feature
flags, "we now know X" work. Also when writing the test for such work.

Not needed for: work whose entire output *is* the rendered thing you just looked at.

## The Consumer Trace

For every value your change creates, answer three questions **with a line number**:

| Question | Not an answer |
|---|---|
| Which production line **reads** this? | "a test does" / "the next phase will" |
| What does the user **see or experience** differently when it changes? | "it's recorded" / "it's available" |
| What **breaks** if I delete the write? | "nothing yet" — then you shipped nothing |

If the honest answer to #3 is "one test goes red," you have built a monitored variable, not a feature. That
may be a legitimate deliberate step — then **say so in the commit and the plan**, as a named partial. What is
not legitimate is calling it done.

Cheap check: `grep -rn "<symbol>" <src> <tests>` and read the hits. Writes on the left, reads on the right.
All-writes plus a test read means inert.

## Worked Example — the same function, wired and unwired, six lines apart

`app.js:5691-5717` computes two verdicts in the same block:

```js
window._plcConflicts = _plc.conflicts;          // app.js:5692
...
window._planSafetyViolations = [];              // app.js:5711
if (bad.length) window._planSafetyViolations.push({key: c.m.key, violations: bad});
```

- `_plcConflicts` → read at `app.js:5739` → `_schedAdviceHtml()` → advisory HTML the cook reads. **Wired.**
- `_planSafetyViolations` → `grep -rn "_planSafetyViolations" app.js tests/` returns **3 hits in `app.js`,
  all writes**, and **1 in `tests/safety-invariant.spec.ts:81`**. **Inert.**

The comment directly above it (`app.js:5709-5710`) says a violation is *"recorded and surfaced rather than
quietly shipped into a cook."* It is recorded. "Surfaced" resolves to a global no renderer reads. If
`safetyDiff()` ever fires in a real cook, the plan renders exactly as if it had not.

And the test:

```ts
const violations = await page.evaluate(`window._planSafetyViolations || []`);
expect(violations).toEqual([]);          // tests/safety-invariant.spec.ts:81
```

This asserts the *value*. It passes identically whether the app warns the user, silently swallows the
violation, or does not render at all. An effect-level assertion would be: *inject a violation, then assert
the user-visible warning appears.* That test would fail today — which is the point.

The same shape, generalized across this codebase: 14 device properties are captured from the user by the
equipment form and read by nothing (`W1-A-code.md` §2, verified `grep -c "propOf([^)]*,'X')\|\.cap\.X\b"` = 0
for each), and `choosePlate`/`chooseNozzle` (`app.js:3014,3024`) are unit-tested with zero production callers.
Each was built correctly. None of them do anything.

## Rationalizations

| Excuse | Reality |
|---|---|
| "The next phase wires it up" | Then the task is "compute X", not "X". Name it that in the plan, or wire it now. |
| "The test proves it works" | The test proves the value is correct. Nobody asked whether the value is correct; they asked whether the app behaves differently. |
| "It's a safety invariant — it's supposed to be quiet" | A safety detector nobody is told about protects nobody. Quiet is the *display*; the *path to the display* still has to exist. |
| "It's on `window`, anyone can read it" | Capability is not a consumer. Name the line. |
| "Asserting the effect is brittle / needs DOM setup" | Brittleness is the cost of testing the thing that matters. A value-only assertion is cheap because it tests nothing. |
| "The form captures it so the data is there for later" | You added a question the user must answer and gave nothing back. That is a cost shipped without its benefit. |
| "Deleting the write would break the test, so it's used" | The test is the consumer. That is the definition of inert. |

## Red Flags — stop before claiming done

- Every `grep` hit for your new symbol is an assignment, except one in `tests/`.
- Your test body contains `expect(<the thing you just computed>)` and no DOM/user-visible assertion.
- You can delete the whole feature and only the test suite notices.
- The word "recorded", "available", "captured", or "surfaced" is doing the work in your commit message.
- A capture-schema field was added and no renderer changed.

**All of these mean: name the reader, or downgrade the claim from "done" to "computed."**

## Baseline (RED phase) — where this skill's test cases came from

Real, recorded failures on this project, not hypotheticals: `equipPlan` built and unreachable, `scale_res`
shipped unread, `hooksOver` computed and unread (all three later fixed — `W1-A-code.md` §0);
`_planSafetyViolations` still inert today (`app.js:5711` vs `tests/safety-invariant.spec.ts:81`);
14 captured-and-unread device properties; `choosePlate`/`chooseNozzle` tested with no callers
(`W1-A-code.md` §2). The structural cause is documented too: 482 `typeof X==='function'` guards across 427
lines mean a broken wire-up no-ops instead of throwing.

**Still untested:** whether this wording stops an agent from declaring done under time pressure with a green
suite. Run the pressure scenario — "the invariant is correct and all 82 specs pass, ship it" — before
treating it as bulletproof.
