# Batch s08 — L86 classified by the owner, 2026-08-11

`L86` was written during Arc 4 Task 11 and, being unclassified, immediately blocked every commit:
`check-rules-classified` fails on any rule carrying no group, by design.

## `L86` → `none`

**A fix verified only by the test it targets is verified against the wrong scope.**

The owner ruled `none` — not because the lesson is unimportant, but because the mechanism that
catches it already exists and already fired. `DoD-12` ("Full suite green") is classified `B` on
`commit-gate` and runs the whole suite before any commit lands. That is precisely what exposed
L86's own defect: the pre-call `requires_database()` guard passed when `test_retrieval.py` was run
alone, and failed only when the full no-database suite reached
`test_service_guard.py::test_find_impact_site_fails_on_a_real_bug` — the R-119a regression that
asserts a real defect must not exit through the absence path.

`R-116` forbids a second detector for a shape that already has one. A dedicated `L86` gate would
watch the same commit boundary `DoD-12` already watches, and would fire on the same evidence.

`none` is a classification, not a blank: the rule stays in the corpus, stays citable, and is
excluded from the mechanically-enforceable denominator rather than counted as an open gap.

```json
{
 "approved_by_owner": "2026-08-11",
 "entries": [
  {
   "rule_id": "L86",
   "rule_group": "none",
   "mechanism": null,
   "mechanism_target": "subsumed by DoD-12 (B, commit-gate) — the full-suite run that caught L86 itself",
   "importance": "High. The failure it describes is silent: a fix passes its own test, the regression it defeated lives in a different file, and nothing in the narrow run says otherwise. Task 11 defeated an R-119a guard exactly this way.",
   "cost": "A dedicated gate would have to know which tests a fix targets and which it could plausibly break — that is the whole suite, which DoD-12 already runs on the same commit boundary, on the same evidence. The cost is not the gate's construction but the second detector: R-116 records what duplicate detectors cost this project. Demoting is cheap here precisely because the expensive mechanism already exists and already fired."
  }
 ]
}
```
