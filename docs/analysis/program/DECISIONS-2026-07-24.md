# Decision questionnaire — 2026-07-24

**How to use this:** answer each decision inline (tick one, or write your own). When you're done, we turn
the answers into an implementation plan and run it through the normal pipeline (spec → plan → SDD → gate).

**Nothing here is being acted on until you answer.** Three items are already in flight because you approved
them earlier today; they're listed at the bottom under "already decided" so the picture is complete.

Every option marked ⭐ is my recommendation, with the reason. Where I have low confidence I say so.

---

# SECTION 1 · Safety — the two open 🔴 items

These are the only decisions on this page where the downside is someone getting hurt rather than
inconvenienced. I'd answer these first.

## D1 · G-T1 — the translation guard can't see an allergen disappear

**Context.** `mtSafe` compares a multiset of *numbers*. An ingredient substitution changes no number, so it
is blind **by construction, on every backend including the Gemini path that ships today**. Measured on real
Hebrew strings from this repo: *anchovy fillets → dill leaves*, *oyster sauce → soy sauce*, *sauerkraut →
cucumber*. All ten cases passed the guard. Two of the three are allergen erasures. Full evidence: G-T1 in
`new-gaps-2026-07-24-p0-app.md`.

**This blocks D9 (bulk translation) — you can't safely mass-produce translations behind a guard that can't
see the worst failure.**

- **A — Content-fidelity gate before any bulk translation** ⭐ **RECOMMENDED**
  Score ingredient/content-word recall against the existing English ground truth, with a measurable bar
  (the study proposed ≥0.90 mean, ≥0.70 worst-case; `gemma3:27b` fails at 0.86/0.67). Catches the general
  case, not just allergens, and gives D9 a real acceptance test. Cost: a scorer + a labelled sample.
- **B — Allergen lexicon, checked bidirectionally**
  Cheaper and targeted: a term list (fish/shellfish/nuts/dairy/gluten/soy…) that must survive translation
  in both directions. Misses non-allergen corruption (*sauerkraut → cucumber* passes).
- **C — Both A and B**
  Belt and braces. B ships in days and covers the health risk; A follows as the general quality gate.
- **D — Human review before any translation publishes**
  No automation. Safest, doesn't scale to 3,677 strings.

**Your answer:** ☐ A ☐ B ☐ C ☐ D ☐ other: ______________________

## D2 · G-A1 — the spoken guard only inspects what the extractor tokenizes

**Context.** A number the extractor can't see (`"pull at 165 internal"`, or one spelled as a word) is
spoken with no inspection, **and the sentence-level "per the verified guide" marker is still appended to the
whole answer**. Four syntax-keyed patches were each defeated by a phrasing the previous one didn't list, so
you ruled we fix it deliberately rather than patch again.

- **A — Scope the marker to the number, not the sentence** ⭐ **RECOMMENDED**
  Mark the verified figure inline instead of appending a claim about the whole answer. Kills the entire
  class permanently — the guard can then never assert anything about text it didn't inspect. Requires a
  spec-copy change (§3.1) and a DoD-9 Hebrew pass.
- **B — Number-word lexicon**
  Disqualify eligibility when a spelled-out number is present. Closes the demonstrated case; adds a fifth
  syntax-keyed surface after four were defeated. Fails closed, so it's safe — just not conclusive.
- **C — Leave registered, revisit after Phase B**
  It's fail-safe today in the sense that nothing wrong is *substituted* — but a model number does reach
  speech, so the headline invariant stays technically false.

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D3 · G-A2 — a verified figure from the *wrong field* is spoken as verified

**Context.** `vcVerifiedNums` pools `safe`/`tgt`/`svt`/`smt`/`sot` into one flat set, so a model asserting
`63°C` as a *safe internal temperature* is marked verified when 63 is actually that cut's *sous-vide bath*
figure. Real number, wrong claim.

- **A — Fold into D2's fix** ⭐ **RECOMMENDED**
  If the marker only ever claims the number itself, "which field it came from" stops being a claim the app
  makes. One design change closes both. Only coherent if you pick D2-A.
- **B — Field-aware matching**
  Teach the guard which quantity the sentence is asserting. Materially harder — it needs to classify the
  claim, not just match a value.
- **C — Leave registered**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

---

# SECTION 2 · Navigation — 18 of 21 exits land in the wrong place

Full audit with 9 gap entries (G-N1…G-N9), screenshots and reproductions:
`docs/analysis/2026-07-24-navigation-model-audit.md`.

## D4 · Which navigation fix, and in what order

**Context.** Root cause: three non-communicating layers of CSS toggles, zero history integration, and
`closePanel()` — bound to ✕, Escape *and* backdrop tap — runs `panelStack=[]`, destroying the whole
"came-from" stack instead of popping one entry.

- **A — Option B first, then Option A** ⭐ **RECOMMENDED** *(the auditor's own recommendation, and I agree)*
  **B** is ~6 surgical edits in funnel functions (point ✕/Escape/backdrop at `panelBack()`; make
  `openMoreSheet` use `openFrom`; give the wizard a `returnTo`). Low risk, ships independently, and is a
  strict subset of A's contract so it isn't throwaway. **A** (real `history.pushState`/`popstate`) is the
  correct destination and the only route to reload-restore, but it needs `panelStack`'s closures replaced
  with a serializable panel registry — a design change deserving its own spec and mockup.
- **B — Go straight to A**
  One disruption instead of two. But it's a genuine re-architecture of navigation in a 9,700-line single
  file, unspecced, while P0-app is mid-flight.
- **C — Option B only, stop there**
  Fixes 18 mismatched exits cheaply. **Leaves your worst case standing:** on the installed PWA the hardware
  Back button still quits the app mid-wizard, because the app holds exactly one history entry.
- **D — Defer all of it until P0-app is finished**

**Your answer:** ☐ A ☐ B ☐ C ☐ D ☐ other: ______________________

## D5 · `openTools` is dead code — and it's the *good* implementation

**Context.** It's the only launcher that sets `openFrom` (so the only one whose tools get back buttons),
and nothing can reach it: its sole caller is an impossible `typeof showPanel!=='function'` fallback. The
launcher users actually hit wipes the stack before opening.

- **A — Revive it as the single launcher** ⭐ **RECOMMENDED**
  The correct behaviour already exists and is unreachable. Route `openMoreSheet` through it rather than
  writing new code. Falls naturally out of D4-A.
- **B — Delete it, build the behaviour into the new launcher**
  Cleaner slate; discards a working implementation.
- **C — Leave it** — dead code stays dead in the file (contradicts DoD-5 / `no-inert-shipment`).

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D6 · Two buttons on nested panels that do different things

**Context.** `s9-nested-cart-has-backbtn.png` shows a large circled **✕** and a text button
**"→ חזרה לחלון הקודם"** side by side. The ✕ destroys the stack; the text button correctly pops one.

- **A — One control: ✕ becomes "back" whenever a stack exists** ⭐ **RECOMMENDED**
  Matches what users expect from a phone. Remove the duplicate text button.
- **B — Keep both, make ✕ mean "close everything"** — honest but needs a visual language users can read.
- **C — Keep both, swap which is prominent.**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

---

# SECTION 3 · P0-app programme sequencing

## D7 · What happens after Phase A closes

- **A — Phase B next (items 4, 5, 6 + the `usageMetadata` rider)** ⭐ **RECOMMENDED**
  Finishes the approved spec before opening new fronts. TTS routing, the `addDays` DST fix (which
  *shortens a nitrite cure*), and the false cross-event warning are all specced, scoped and small.
- **B — Navigation first** — 18 broken exits are what you actually feel daily; the safety work is invisible
  when it's working.
- **C — Safety gaps (D1–D3) first** — closes the 🔴 items before anything else.
- **D — Phase B and navigation in parallel** — they touch disjoint code; costs more agent time and more of
  your review attention.

**Your answer:** ☐ A ☐ B ☐ C ☐ D ☐ other: ______________________

## D8 · When do we ship Phase A to production

**Context.** Nothing shipped today. The version stamp is still **מהדורה 261** — the spec's own baseline.
§10.10 requires a Playwright check against the live URL before any release is reported done.

- **A — Ship Phase A alone, once the gate passes** ⭐ **RECOMMENDED**
  Three 🔴 safety items reaching real cooks sooner, in one small, revertible release. Smaller blast radius
  than a combined ship.
- **B — Ship Phase A + Phase B together** — one deploy, one live verification, bigger diff to debug.
- **C — Hold until navigation is fixed too** — longest exposure of the current spoken-safety gaps.

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

---

# SECTION 4 · Local models and graphify

Full report: `docs/research/2026-07-24-local-model-opportunities.md`.

## D9 · Bulk pre-translation of the 3,677 recipe strings

**Context.** Today `mtTranslate` fires **one Gemini call per string, per device, per user**. **Gated on
D1** — do not start before the content-fidelity bar exists.

- **A — Yes, after D1's gate is in place** ⭐ **RECOMMENDED** — kills per-user cost and latency, unblocks
  `fr`/`de`/`es` from 2.1% coverage. Pull `translategemma:27b` (17 GB, 55 languages incl. Hebrew).
- **B — Yes, but Gemini rather than a local model** — better quality, real API cost, same D1 gate needed.
- **C — Not now.**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D10 · `mk-mtcache` is capped at 3,000 entries against 3,677 strings

**Context.** It cannot hold even one language; the overflow re-translates forever, per device, per user.
This is a live defect regardless of what you decide about D9.

- **A — Fix now, independently of D9** ⭐ **RECOMMENDED** — small, self-contained, saves real API spend today.
- **B — Fix as part of D9.**
- **C — Register only.**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D11 · Make the local model graphify's default

**Context.** It works today only when four flags are passed by hand. **Hazard:** setting `OLLAMA_BASE_URL`
*without* `OLLAMA_MODEL` silently routes extraction to `qwen2.5-coder:7b` — the model that produced **zero
edges**.

- **A — Wrapper script that sets all four, leave env vars alone** ⭐ **RECOMMENDED** — gets the default
  without the footgun, and keeps `--mode deep --token-budget 4000` (which have no env equivalent).
- **B — Set both env vars and accept the hazard** — simpler, one wrong-variable mistake away from silent
  garbage extraction.
- **C — Leave it opt-in.**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D12 · Embedding-backed `graphify query`

**Context.** `bge-m3` (~1.2 GB) runs *alongside* the 18 GB extractor. Today's substring selector resolves
**0 of 5** Hebrew-term queries by construction.

- **A — Yes** ⭐ **RECOMMENDED** — cheap, and the graph is our stated evidence tool (§10.13); Hebrew queries
  failing by construction undercuts that. Bar: top-5 recall ≥0.90 on 20 known-answer queries.
- **B — Later.** ☐ **C — No.**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D13 · The graphify prompt patch lives in the installed package

**Context.** `graphify install` (offered: 0.9.22 → 0.9.25) **silently reverts it**. Also note the PASS-3
correction: the patch is *not* a general cure — it made things worse on a repo corpus.

- **A — Upstream it, pinning the current version until then** ⭐ **RECOMMENDED**
- **B — Document + a re-apply script.** ☐ **C — Revert the patch, accept mis-attribution.**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

---

# SECTION 5 · Queued items

## D14 · R11 — the footer still claims "data is local, no network"

Four sites, no safety exposure, false since the online-first decision.
- **A — Bundle into the next spec that touches those files** ⭐ **RECOMMENDED** ☐ **B — Its own micro-task now** ☐ **C — Leave for P7**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D15 · The app heap leak (~2.5 MB/reload, no plateau)

Not one of the original 141. Reload-driven; equivalence to a long cooking session is itself unanswered.
- **A — Scope it first (answer the equivalence question), then decide** ⭐ **RECOMMENDED** ☐ **B — Own phase now** ☐ **C — Fold into P7**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D16 · `app.js`'s graph content is stale

Twelve enriched code files need semantic re-extraction; today's commits made it staler.
- **A — Code-side pass after Phase A ships** ⭐ **RECOMMENDED** ☐ **B — Now** ☐ **C — Next full refresh**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

## D17 · PRE-4's comparative eval bar was never run

The harness was built to prove "no regression" on a model swap; the swap shipped on a narrower preflight.
~$2.50 to run.
- **A — Run it now** ⭐ **RECOMMENDED** — the harness and the banked baseline are fresh, and it also answers
  the open 3.6-flash thinking-cost question. ☐ **B — After Phase B** ☐ **C — Skip; the preflight sufficed**

**Your answer:** ☐ A ☐ B ☐ C ☐ other: ______________________

---

# Already decided today — listed for completeness, in flight or done

| Item | Your decision |
|---|---|
| P0-app spec, five flagged items | Approved as drafted |
| A range is never spoken as verified | Approved |
| Syntax-independent eligibility (one number or none) | Approved, over-redaction cost accepted |
| `vcTransSafe` unit-class pairs | Approved |
| Word-form units into the shared `SAFETY_UNIT` | Approved |
| Unify the on-screen gate (more caveats will render) | Approved — **in flight** |
| Tighten `deg`, accept the angle over-match | Approved — **in flight** |
| Spec amended (A-1…A-4), §3.3 test, `dir="ltr"` island | Done |

---

## What I need from you

Answer what you can. **D1 is the one I'd not leave open** — it's the only item where the failure mode is a
person eating an allergen. D4 is the one you'll feel every day.

Anything you skip, I'll leave registered and untouched rather than choosing for you.
