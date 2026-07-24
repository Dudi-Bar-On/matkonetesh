# Implementation programme — from the 2026-07-24 decisions

**Owner answered all 17** (`DECISIONS-2026-07-24.md`), every one the recommended option. This document turns
them into a sequence. It is a **sequencing plan, not an implementation plan** — items needing design go
through the normal pipeline (brainstorm → spec → owner approval → `writing-plans` → SDD → gate) and are
marked as such. Nothing below skips that.

## The decisions, recorded

| | Decision | Consequence for this programme |
|---|---|---|
| D1 | Content-fidelity gate before bulk translation | **Design work.** Gates D9 |
| D2 | Scope the verified marker to the number, not the sentence | **Spec change** to §3.1 + DoD-9 copy pass |
| D3 | Fold G-A2 into D2's fix | Rides on D2 — no separate work |
| D4 | Surgical navigation fixes first, history integration after | Two stages; stage 2 needs its own spec |
| D5 | Revive `openTools` as the single launcher | Falls out of D4 stage 1 |
| D6 | ✕ means "back" whenever a stack exists | Falls out of D4 stage 1 |
| D7 | Phase B next | Already specced and approved — straight to SDD |
| D8 | Ship Phase A alone, once the gate passes | **Immediate**, blocked only on the gate |
| D9 | Bulk pre-translation, local model, after D1 | Blocked on D1 |
| D10 | Fix the translation cache cap now | Independent, small |
| D11 | Wrapper script for graphify's local default | Independent, small |
| D12 | Embedding-backed `graphify query` | Independent |
| D13 | Upstream the graphify prompt patch, pin until then | Independent, small |
| D14 | Bundle R11 into the next spec touching those files | Rides on Phase B |
| D15 | Scope the heap leak before deciding | Small investigation |
| D16 | Code-side graph pass after Phase A ships | Blocked on D8 |
| D17 | Run the comparative eval bar now | Independent |

---

## Why this order

Three constraints shape it, and they are not negotiable:

1. **The full Playwright suite cannot run twice at once** (L15 — racing runs produced 12 then 127 phantom
   failures). So *implementation* work is serial by nature. **Design, spec and research work is not**, and
   runs alongside.
2. **Nothing creative starts without an approved spec** (the HARD-GATE). D1, D2/D3 and D4-stage-2 are design
   work; they enter as brainstorms, not as tasks.
3. **Ship early, ship small** (D8). Phase A is three 🔴 safety items that are finished and unreleased.
   Every hour they sit unshipped is an hour real cooks don't have them.

---

## Wave 1 — Ship Phase A · *in flight*

**Gate first.** One fix is running: the whitespace-class leak found in gate round 7 (a Fahrenheit number
voiced as a verified Celsius value, because the tokenizer matches whitespace with `\s` and the classifier
with `[ \t]`). When it lands, the independent gate re-runs. **Phase A ships only on a clean verdict** —
seven rounds have each found something real, and the eighth gets the same standing as the first.

Then **D8**: build, bump `מהדורה`, push, and verify the live URL with Playwright — the `.foot-stamp` must
match the shipped version **and** a feature probe from this release must be present. Cloudflare takes
minutes; poll, never assume (§10.10, L14). **Not reported as shipped until that check passes.**

Immediately after the ship, two items that were deliberately queued behind it:
- **D16** — code-side graph refresh (`app.js` drifted across ~30 commits today).
- **D17** — the comparative eval bar (~$2.50), which also answers the open thinking-cost question.

## Wave 2 — Phase B · *straight to SDD, no new spec needed*

Items 4, 5, 6 and the §4.4 rider are already in the approved spec, with the owner's five confirmations on
record. **D7.** Four tasks, each with a witnessed RED, a review and the DoD gate:

- **Item 5 · `addDays` DST** — open with it. Zero blast radius, and its error direction *shortens a nitrite
  cure*, which is a safety defect in its own right.
- **Item 4 · TTS managed routing** — `gemSpeak` + `vcSpeak` must change together or the fix is inert (L8).
- **Item 6 · the false cross-event warning** — the unconfigured branch asserts nothing.
- **Item 7 · `usageMetadata` capture** — read-only; must use `r.clone()` or it consumes the body every AI
  caller depends on.
- **D14 rides here** — R11's four offline-copy sites, since Phase B touches `app.js` and `build.py`.

Phase B closes with its own independent gate, run the same way as Phase A's.

## Wave 3 — The safety design work · *brainstorm → spec → approval*

Runs **in parallel with Wave 2's implementation**, because it is design, not code.

- **D2 + D3 · Scope the marker to the number.** The single change that closes both G-A1 (the guard claims
  the whole sentence while only inspecting part of it) and G-A2 (a figure from the wrong field). It changes
  approved spec copy, so: brainstorm → amend §3.1 → your approval → DoD-9 Hebrew pass → implement.
  **This is the structural end of the seven-round whack-a-mole** — once the marker only ever claims the
  number it actually verified, an unrecognised phrasing stops being a correctness bug.
- **D1 · Content-fidelity gate.** Ingredient/content-word recall against the existing English ground truth,
  with the ≥0.90 mean / ≥0.70 worst-case bar. Needs a labelled sample and a scorer. **This is the gate that
  unblocks D9**, so it is on the critical path for the translation work.

## Wave 4 — Navigation · *stage 1 to plan, stage 2 to spec*

**D4 stage 1 (surgical), D5, D6 — one plan, no new spec.** The audit already specifies them precisely:
point ✕/Escape/backdrop at `panelBack()` instead of `closePanel()`; route the More sheet through the
revived `openTools` so `openFrom` is set; give the wizard a `returnTo`; collapse the duplicate ✕/back
control. ~6 edits, independently shippable, and a strict subset of stage 2's contract.

**D4 stage 2 (real history integration) — its own spec and an interactive mockup** (§10.9), because it
replaces `panelStack`'s closures with a serializable panel registry. This is the only route to
reload-restore and to the Android hardware Back button behaving, which is the failure that actually quits
the app mid-wizard.

## Wave 5 — Infrastructure and small fixes · *slot between suite runs*

Each is independent and small enough to land in a gap:
- **D10** — the translation cache holds 3,000 entries against 3,677 strings, so it cannot hold even one
  language and the overflow re-translates forever, per device, per user. Real money, today.
- **D11** — a wrapper script setting all four graphify flags. **Do not** set `OLLAMA_BASE_URL` without
  `OLLAMA_MODEL`: that silently routes extraction to the model that produced zero edges.
- **D13** — upstream the extraction-prompt patch; pin the graphify version until it lands, because
  `graphify install` silently reverts it.
- **D12** — embedding-backed `graphify query` (`bge-m3`, ~1.2 GB, runs alongside the extractor). Bar: top-5
  recall ≥0.90 on 20 known-answer queries; today's substring selector resolves 0 of 5 Hebrew queries.
- **D15** — scope the heap leak: answer whether reload-accumulation equals a long cooking session. That
  answer decides whether it is urgent or academic.

## Then — D9, once D1's gate exists

Bulk pre-translation of the 3,677 recipe strings with `translategemma:27b`. **Gated on D1 and on D10** —
translating into a cache that cannot hold the result would waste the entire run.

---

## What is explicitly *not* in this plan

- The remaining 141-gap programme beyond P0-app. This plan covers what the 17 decisions cover; the charter's
  later phases are unchanged and unscheduled here.
- Anything the owner skipped. Nothing was skipped — all 17 were answered.
