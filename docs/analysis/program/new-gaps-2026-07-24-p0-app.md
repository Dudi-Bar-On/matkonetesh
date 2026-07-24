# NEW gaps found during P0-app implementation — registered, not deferred

**Date:** 2026-07-24 · **Status:** REGISTERED for the Phase A re-audit. Owner decided each explicitly;
none of these is an assistant-side deferral (charter decision **D2**: "deferred is no longer a call the
assistant can make").

These were found by adversarial review *during* implementation, not by the original 2026-07-22 sweep, so
they sit outside the 141. Each is recorded with its reproduction so nobody has to rediscover it.

---

## G-A1 · The spoken guard only inspects what the extractor tokenizes — and the marker claims the whole sentence

**Severity:** 🟠 real residual hole in the headline invariant ("no model-originated safety number is ever
voiced"). **Owner decision, 2026-07-24:** track both instances as ONE gap and fix them together with a
deliberate design change; do not add a fifth patch to `vcGuardSpoken`.

`vcGuardSpoken` gates on `aiSafetyNums`, which recognises a number only when it carries a unit token
(`°`, `°C`, `°F`, bare `C`/`F`, `ppm`, `%`, `pH`, `מעלות`). Anything else passes through **untouched and
uninspected**, while the sentence-level marker is still appended to the whole answer.

Two demonstrated instances of the same root cause:

1. **A unit-less number is never seen at all.** `"pull it at 165 internal"` → `aiSafetyNums` returns
   empty → `vcGuardSpoken` returns early → the model's number is spoken verbatim with no inspection.
2. **A number spelled as a word defeats the eligibility count.** Reproduced against the shipped code:
   ```
   "63°C, or in some references seventy-four degrees"
     → digitRuns=1 → eligible → 63 matches a verified figure → substituted
     → the WHOLE sentence, including the unchecked "seventy-four degrees",
       receives "לפי המדריך המאומת" (per the verified guide)
   ```

**Why it was left open rather than patched:** the eligibility rule already survived four rounds of
syntax-keyed fixes, each defeated by a phrasing the previous one did not list. A number-word lexicon
would be a fifth such surface. The structural alternative considered and recorded for the fix: **scope
the marker to the number itself rather than the sentence**, so the guard never asserts anything about
text it did not inspect. That is a change to approved spec copy (§3.1), hence a spec-level decision.

**Do not widen `aiSafetyNums` to bare numbers as a quick fix** — it would redact every "2 hours" and
"3 racks" the model utters. The extractor's unit requirement is deliberate.

---

## G-A2 · A verified figure from the WRONG field is still spoken as verified

**Severity:** 🟠 · **Status:** OPEN, untouched by any of the four Task-2 fix waves.

`vcVerifiedNums` pools an item's `safe`/`tgt`/`svt`/`smt`/`sot` into one flat set, so a number is
"verified" if it matches **any** of them. A model asserting `63°C` as a *safe internal temperature* is
therefore marked verified when `63` is actually that cut's *sous-vide bath* figure — a real number,
attached to the wrong claim.

This is the single-number cousin of the range-splicing defect that the 2026-07-24 owner ruling closed
("a range is never verified"). That ruling removed the *combination* surface; this one remains because
the guard compares values without knowing which quantity the model was asserting.

**Note for whoever fixes it:** closing this requires the guard to know what kind of claim the sentence is
making, which is a materially harder problem than value matching. It may be better solved by narrowing
what the marker claims (see G-A1's structural alternative) than by trying to classify the assertion.

---

## Where these are formally accounted

Both enter the programme at the **Phase A completion gate**, whose re-audit runs against the spec rather
than against any ledger (`development-discipline.md` §3, per-phase gate). They are **not** counted as
closed in any burn-down until then.

**Related, already documented elsewhere, not duplicated here:**
- The four graphify defects and the correction to PASS 3 finding (c) — `docs/process/graphify-improvements.md`.
- Ollama's `/v1/chat/completions` silently ignoring `max_completion_tokens` and discarding
  `extra_body.options`, which made graphify's output cap, `num_ctx` derivation and keep-alive all inert —
  `docs/research/2026-07-24-local-gpu-model-for-graphify.md`.
