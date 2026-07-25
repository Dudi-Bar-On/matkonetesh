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

---

## G-T1 · 🔴 The translation guard is blind to ALLERGEN SUBSTITUTION — it only compares numbers

**Found:** 2026-07-24, during the local-model opportunity study, on **real Hebrew strings from this repo**.
**Severity:** 🔴 — an allergen erased from translated recipe content is a health risk, not a quality issue.
**Scope:** this is **not** a local-model defect. It is structural, and it applies to **every** translation
backend including the Gemini path that ships today.

A model translating this project's own recipe strings produced:

| Hebrew source | Translation produced | What was lost |
|---|---|---|
| anchovy fillets (`פילה אנשובי`) | *dill leaves* | **fish allergen erased** |
| oyster sauce (`רוטב צדפות`) | *soy sauce* | **shellfish allergen erased**, replaced by a different allergen |
| sauerkraut (`כרוב כבוש`) | *cucumber* | fermented product silently becomes a raw one |

**`mtSafe` passed all ten cases.** Confirmed by execution against the shipped functions, not inferred:

```
mtSafe("פילה אנשובי", "dill leaves")            → true
mtSafe("רוטב צדפות", "soy sauce")               → true
mtSafe("כרוב כבוש", "cucumber")                 → true
mtSafe("2 כפות רוטב צדפות", "2 tbsp soy sauce") → true    ← number preserved, shellfish gone
```

**Root cause, structural:** `mtNumSig` builds a multiset of the **numbers** in a text and `mtSafe` compares
those multisets. An ingredient substitution changes no number, so the guard **cannot** see it — by
construction, for any model, forever. The guard is correctly named (`mtNumSig` — a *numeric* signature);
what is wrong is the confidence placed in it. The charter names this mechanism as "the correct pattern",
and it **is** correct for the risk it was built for (a dropped or altered dose/temperature) — it was simply
never a content-fidelity guard, and has been relied on as though it were.

**Both translation paths are exposed:**
- `mtTranslate` — the DATA path that produces `fr`/`de`/`es` recipe content.
- `vcTransSafe` — the Voice Cook path added today. It compares `(value, unit-class)` pairs, so it is
  strictly stronger on *numbers* but has the **identical blindness** to ingredient names.

**Why this matters more than it looks:** the ULTIMATE doc records `fr`/`de`/`es` at ~2.1% coverage with no
gate. Any bulk-translation push — local model or Gemini — would generate thousands of strings whose only
automated check is a guard that cannot see the single most dangerous failure mode. **An i18n acceptance
bar built on `mtSafe` pass-rate is measuring the wrong thing.**

**Candidate directions (not chosen — owner's call):** content-word/ingredient recall scored against the
existing English ground truth; an allergen-term lexicon checked bidirectionally; refusing to auto-publish
any translation of a string containing a known allergen without human review. The study proposed a
measurable bar — ingredient-fidelity ≥0.90 mean and ≥0.70 worst-case content-word recall — and noted that
`gemma3:27b` **fails** it at 0.86/0.67.

**Cross-reference:** `docs/research/2026-07-24-local-model-opportunities.md` (commit `d57521a`) carries the
full ten-string evidence set and the measured fidelity scores.

---

## G-T2 · 🔴 The translation guards are also blind to UNIT INVENTION — °C silently becomes °F

**Found:** 2026-07-25, during the `translategemma:27b` smoke run (10 real strings, he→en), on the
translation-harness track. **Severity:** 🔴 — sibling of G-T1, same structural class, arguably worse
direction. **Scope:** every translation backend, both paths (`mtTranslate`/`mtSafe` DATA path and
`vcTransSafe` Voice path).

**The reproduction:** string s10 — *"Cook to 71° internal"*, with 70–75 °C established two sentences
earlier in the same string — was translated as **"71°F"**. An invented unit that contradicts its own
context. 71 °F ≈ 21.7 °C: read literally, a dangerous undercook instruction.

**Why every existing guard passes it:**
- `mtSafe`/`mtNumSig` compare **numbers** — 71 is unchanged → pass. (G-T1's blindness, same root.)
- The D1 content-word recall scorer filters single-letter unit suffixes as noise → pass.
- `vcTransSafe` compares `(value, unit-CLASS)` pairs — `°` and `°F` both classify as `temp`, so
  `(71,temp)==(71,temp)` → pass. **The class comparison was built to catch cross-class swaps (temp
  vs time); it is blind to intra-class scale swaps (°C vs °F) by construction.**

**Consequence for D1/D9:** the content-fidelity bar (≥0.90/≥0.70 recall + mtSafe 100%) is NOT
sufficient for a ship decision. The D1 gate needs a third check: **unit-literal fidelity** — the unit
token attached to each number must survive translation verbatim-or-equivalent (°/°C stays Celsius;
°F may never be introduced where the source has none). Cheap to implement in the existing scorer
(the harness already extracts number+unit pairs via the shipped `mtNumSig` machinery's siblings).

**Cross-reference:** `scratch/translate-eval/REPORT` content in the session ledger; harness at
`scratch/translate-eval/` (untracked). Registered the same day the harness was built — before any
bulk run, which is the point.

**OWNER RULING (2026-07-25, in conversation):** temperatures are **Celsius everywhere, especially in
Hebrew**; the displayed unit changes **only via the system units setting** (which already exists —
`pref('units')`, app.js:7274, metric/imperial), and when it changes, the **value is converted by the
app's internal deterministic algorithm** — **never by translation**. Translation must preserve unit
tokens verbatim; unit localization is an app function, full stop. This ruling makes G-T2's check
well-defined: the D1 scorer's unit-literal test fails any translation whose unit token differs from
the source's.

---

## G-T3 · 🔴 Chemical-term swap in curing chemistry — "nitrate"→"nitrite" survives every guard

**Found:** 2026-07-25, adversarial verification pass (50-string audit), on string s28 (Cure #2).
**Severity:** 🔴 — Cure #1 (nitrite) vs Cure #2 (nitrite+nitrate) is a real curing-chemistry
distinction with food-safety semantics; **BOTH finalists** (translategemma:27b AND aya-expanse:32b)
independently rendered "nitrate" as "nitrite". No number changes, no unit changes, high content-word
overlap — invisible to mtSafe, recall, unit-literal, and leak checks alike. Found only by manual read.
**Class:** sibling of G-T1 (ingredient identity) — a **safety-term lexicon** (nitrate/nitrite,
Cure #1/#2, botulism-relevant vocabulary) checked bidirectionally is the plausible automated cure;
belongs to the D1 gate before any bulk run, alongside the unit-literal check.

## Production finding · shipped `mtSafe` has a ½-vs-1/2 blind spot (fails closed — benign but costly)

**Found:** same pass, by executing the SHIPPED dist functions. `mtNumSig` silently drops the Unicode
fraction `½` but parses ASCII `1/2` as two numbers — so a translation that faithfully renders `½` as
`1/2` (numerically identical) is falsely flagged unsafe and falls back to Hebrew. Fails CLOSED (safe
direction), but it caused 100% of one finalist's automated mtSafe failures and will cost benign
rejections in any bulk run. Fix direction: NFKC-fold/normalize unicode fractions inside `mtNumSig`
before signature comparison. Small, testable, registered for the translation track.

---

**Root-cause detail found while registering:** the DATA-path prompt (`mtTranslate`, app.js:7466)
says only *"Keep ALL numbers, temperatures, times and units EXACTLY as written"* — it LACKS the
explicit *"do NOT convert between units (no °C→°F, no metric→imperial)"* clause the VOICE path's
prompt gained in P0 (app.js:5531, amendment A-4). The smoke run used the data-path prompt and the
model invented °F anyway — explicit beats implied. **Registered fix (first task of the translation
track, full TDD cycle):** harden `mtTranslate`'s prompt to match the voice path's clause; the
harness will A/B both prompts in the full eval to measure whether the clause alone closes the gap
or the unit-literal scorer must remain the backstop (it remains regardless — a prompt is a request,
a scorer is a gate).

---

## G-A1 addendum · non-canonical Unicode, and two spoken-as-verified boundaries

**Added 2026-07-24 at the Phase A gate's request (round 8), measured on the real built app.** These are
**not** unmet spec lines — the gate passed with them open — but they are real, and registering them is the
condition on which it passed.

### Pass through unguarded (G-A1's registered class, new triggers)

`aiSafetyNums` returns `[]`, so `vcGuardSpoken` early-returns and the number is voiced raw:

`74ºC` (U+00BA masculine ordinal — **renders identically to °**) · `74℃` (U+2103) · `74℉` (U+2109) ·
`74˚C` (U+02DA) · `74ᵒC` · `７４°C` (full-width digits) · `74‏°F` (RLM between number and unit).

### Read as Celsius and spoken as **verified** — the dangerous direction

- `"pull it at 74°Ｆ"` (full-width `Ｆ`) → *"74°CＦ … per the app's verified guide."*
- `"משוך ב-74 מעלות פרנהייט"` → *"74°C פרנהייט … per the app's verified guide."*

**Neither violates the spec**, which states a bare `°` and a bare `מעלות` are *"treated as already-Celsius,
not converted"* — the tokenizer never claimed to know full-width `Ｆ` or Hebrew `פרנהייט`. The gate's own
standard: a defect is a captured unit classified **wrongly**; a boundary is a vocabulary the app never
claimed.

**The Hebrew one is the one to action first.** English *"degrees fahrenheit"* is handled; Hebrew
*"מעלות פרנהייט"* is not — in a Hebrew-first product. That asymmetry is a product defect even though it is
not a spec breach.

**Partial cure worth knowing:** `.normalize('NFKC')` folds `℃`→`°C`, `℉`→`°F`, `Ｆ`→`F`, `７`→`7` — one line
closes four of these. It does **not** fold `º`→`o` or `˚`, so it is not a general fix, and `º` is the most
dangerous of the set precisely because it is visually indistinguishable from `°`.

### The `deg` + line-break trade-off — measured, two-sided, deliberate

The gate reported this against **its own** round-7 prescription. The `deg` branch uses `[^\S\r\n]*`:

| fixture | shipped `[^\S\r\n]*` | widened `\s*` |
|---|---|---|
| `hold at 63 degrees\nF is what the probe shows.` | `[63]` ✓ | `[17]` ✗ |
| `pull it at 74 deg\nF` | `[74]` ✗ | `[23]` ✓ |

Neither class is free. The shipped residual points the **dangerous** way (Fahrenheit read as Celsius, digits
preserved, can match a verified figure); the widened residual points the **safe** way (`63`→`17` matches
nothing and is redacted). Both require a line break falling exactly between an abbreviation and a stray
scale letter, so both are remote. **Recorded so the next person weighs a measured trade-off rather than
rediscovering it.**
