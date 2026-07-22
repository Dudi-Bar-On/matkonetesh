---
name: verify-against-the-runtime-path
description: Use when about to assert that something is missing, broken, uncovered, or "0 of N" based on reading or grepping a file — especially when the codebase has a build step, a merge, a generator, a fallback chain, or more than one file that could supply the value.
---

# Verify Against The Runtime Path

## Overview

**A file is not a path. Reading one artifact and concluding what the program does is a guess wearing
evidence's clothes.**

You grep `data.py` for `src`, get zero hits, and report "0 citations." You are right about `data.py` and
wrong about the app: `build.py:85-105` merges the citations in from `sources.py` at build time. 279 of them
ship. You measured a real thing accurately, and the thing you measured was not the thing you claimed.

The rule: **before asserting an absence, trace the chain the running program actually walks, and measure at
the end of it.**

## When to Use

Any time you are about to write the words *missing*, *absent*, *never*, *uncovered*, *not wired*, *0 of N*,
or *X% untranslated*. Also whenever a grep returns zero and that zero is about to become a finding.

The risk is highest when the project has any of:

- a build step that merges, generates, or substitutes (`build.py`, codegen, bundlers)
- a `*.generated.*` / `AUTO-GENERATED` file feeding a hand-written one
- more than one file that could supply the same key (`en.json` **and** `en.data.json`)
- a fallback chain (`dict[k] ?? inline ?? source`)
- a dynamic dispatch the grep can't see (`typeof X==='function'`, string-keyed lookup, `page.evaluate`)

Not needed for: a claim about a single file, stated as being about that file.

## The Procedure

1. **Name the consumer.** Which line of running code reads this value? Find it. If you cannot name it, you
   are not ready to make a claim about it.
2. **Walk backwards from the consumer, not forwards from the file you happen to have open.**
   Consumer → what populates it → what populates *that* → the authoring source.
3. **Measure at the consumer's input, not at any intermediate.** If `getDict()` returns a merged object,
   count keys in the merged object.
4. **Prefer executing to reading.** Replay the merge in a script; load the app and read the value; run the
   feature. A build pipeline you simulate incompletely lies to you exactly like a grep does.
5. **State the path in the finding.** "Checked `X`" is not evidence. "Traced `toast()` → `getDict()` →
   `I18N_DICTS.en` ← `build.py:362-366` merge of `en.json` + `en.data.json`; measured 3,985 keys" is.

## Worked Example — the failure this skill was written from

Three false alarms in one project, all the same shape:

| Claim | Artifact checked | The path that was not traced | Truth |
|---|---|---|---|
| "0 citations, S3 NOT DONE" | `grep src data.py` → 0 | `build.py:85-105` merges from `sources.py` | 279 `src` blocks ship |
| "52 orphaned make-citations" | `MAKE_SOURCES` vs `MAKES` | `build.py:29` `MAKES.update(NEW_SAUSAGES)` runs first | 102/102 covered |
| "55 of 56 toasts untranslated" | `lang/en.json` → 309 keys | `build.py:362-366` merges `en.data.json`; `toast()` reads the merge at `app.js:2775` | 48 of 53 covered, 5 missing |

The third is the instructive one. The auditor checked one dictionary file. **The controller then repeated the
identical error while "independently verifying" it** and reported it to the owner as confirmed. A second
agent got it right by a different method: it ran the app in English and watched `copyText` render
"List copied." Running the feature beat reading the file — twice.

## Rationalizations

| Excuse | Reality |
|---|---|
| "I grepped the whole repo" | Grep finds text, not paths. Merged/generated/computed values have no literal to find. |
| "The data file is obviously the source of truth" | It is the *authoring* source. The shipped value is whatever the build emits. |
| "There's only one dictionary" | There were two. Measure how many there are; don't assume one. |
| "Another agent already verified it" | The controller re-verified a false claim by repeating the same single-artifact check. Independent means *different method*, not *different person*. |
| "I'll soften it to 'appears to be'" | A hedge on an untraced claim is still an untraced claim, and it still reaches the owner as a defect. Drop it or trace it. |
| "Executing the pipeline takes too long" | Less time than the retraction, the re-verification, and the credibility. |
| "It's a safety finding, better to over-report" | A false safety alarm burns the attention that a real one needs. Two of three auditors produced confident false safety alarms on this project. |

## Red Flags — stop and trace

- Your evidence is one `grep` and one filename.
- You are about to write "0" or "never" about something a build step touches.
- The file you read is named `*.data.*`, `*-ext.*`, `*_new.*`, or says `AUTO-GENERATED`.
- You cannot name the line number that *reads* the value.
- You are confirming someone else's finding using the same command they used.

**All of these mean: find the consumer, walk back, measure there.**

## Baseline (RED phase) — where this skill's test cases came from

This skill was not written from imagination. Its failing tests are three real, recorded violations from the
2026-07-22 discovery sweep, with verbatim agent text preserved in
`docs/analysis/sweep/_agent-summaries.md` (see the `> CONTROLLER` notes at the W1-D and W1-E entries) and
the measurement in `docs/analysis/sweep/_toast-verification.txt`.

**Still untested:** whether this wording makes an agent trace the path under the pressure of a
seemingly-conclusive grep result. Run it as a pressure scenario — hand an agent
`grep -c '\bsrc\b' data.py` → `0` and a deadline — before treating it as bulletproof.
