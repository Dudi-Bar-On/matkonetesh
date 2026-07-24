# P0-app — spoken safety guard, unit-aware numeric guard, search conditionality, TTS routing, `addDays` DST fix, cross-event warning — Spec

**Date:** 2026-07-24 · **Status:** **APPROVED by the owner, 2026-07-24** (per `development-discipline.md` §2,
`writing-plans` may now start).

**Owner's review decision, 2026-07-24 — all five §7 flags confirmed as drafted, none overridden:**
1. §7 ambiguity 4a — **item 2's scope expansion** to the B10 range-phrase gap: **CONFIRMED** (accepted as an
   addition to item 2's contract, not a waiver of anything).
2. §7 ambiguity 4b — **item 7, the `usageMetadata` capture rider** (§4.4): **CONFIRMED** in scope for Phase B.
3. §7 ambiguity 2 — **item 3's `AI_SEARCH:'auto'` trigger** ("attach `google_search` only when the app's own
   vetted context is empty"): **CONFIRMED** as the policy semantics.
4. §7 ambiguity 3 — **item 6's literal reading of "neutralise"** (unconfigured branch asserts no `contention`
   at all; the bath-aware alternative stays out of scope for P0): **CONFIRMED**.
5. §7 contradictions — **item 1's `vcTranslateToEn` specialization** (`mtNumSig`/`mtSafe` comparison against
   `src` instead of a fresh catalog resolution): **CONFIRMED** as the same verified-value-or-nothing contract.

§7 ambiguity 1 — **the proposed Hebrew/English guard copy** — remains **proposed, not final**, exactly as
drafted: it takes its DoD-9 native-speaker pass at implementation time. Approval of this spec does not freeze
that wording.

---

## AMENDMENTS — owner rulings during implementation, 2026-07-24

**Why this section exists.** Three of the owner's rulings during implementation changed what §3.1 requires.
The code was updated; this document was not, so for a period the approved artifact described behaviour the
shipped code deliberately did not implement. The **Phase A completion gate caught that** and called it what
it is: not a smuggled waiver, but an unreconciled one. §4's principle applies in both directions — a spec
that no longer describes the code is as dangerous as code that quietly departs from its spec. **Where an
amendment below conflicts with §3.1's original text, the amendment governs.**

### A-1 · A range is NEVER spoken as verified (supersedes part of §3.1's "Matched" clause)

§3.1 as approved said a detected safety number matching a resolved item's field is spoken back with the
verified marker. Implementation showed that two *individually* real figures can be spliced into a **range**
the app never asserts — `svt` and `smt` off one cut, or one figure from each tier — and that range then
carried the marker `לפי המדריך המאומת`. No digit was model-invented, but the **claim was fabricated by
combination.**

**Ruling:** a range is always redacted. The app's data holds **discrete** figures only, so any range is a
model-composed claim it cannot vouch for. This makes ranges consistent with `ppm`/`%`/`pH`, which the
original design already always redacts for exactly the same reason.

### A-2 · Eligibility is syntax-independent: exactly ONE number in the whole answer

§3.1 as approved implied per-number evaluation. Four successive fixes keyed on *how* a range was written
were each defeated by a different phrasing — `63°C-74°C`, `between 63 and 74`, `בין 63°C ל-74°C`, and a
unit-less bound in `63 to 74°C` that was never tokenized at all and so was voiced with no inspection.

**Ruling:** the verified-substitution path applies **only when the answer carries exactly one number in
total**. Two or more redacts every number, including bare ones the tokenizer does not recognise. The rule
never asks how the numbers were phrased, which is why rephrasing cannot defeat it.

**Accepted cost, stated explicitly:** an answer like *"cook to 63°C for 2 hours"* loses both numbers even
though the temperature is verified. This narrows the approved "Matched → speak the verified value" contract
in the fail-safe direction.

### A-3 · `vcTranslateToEn` uses `vcTransSafe`, not `mtSafe` (supersedes owner decision #5's named mechanism)

Decision #5 confirmed the specialization **as** the `mtNumSig`/`mtSafe` numeric-multiset comparison. That
mechanism proved **blind to position**: `mtSafe('משוך ב-74 מעלות למשך 165 דקות', 'pull at 165 degrees for 74
minutes')` returns **true**, so a translation transposing a temperature and a time passed and was spoken.

**Ruling:** a sibling, `vcTransSafe`, compares **(value, unit-class) pairs, unordered**. A transposition
changes the pairs so it is caught; a faithful clause reorder — routine in Hebrew→English — does not, so it
is accepted. A unit the class map does not recognise leaves the number unclassified and forces a strict
positional comparison, so an incomplete lexicon **fails closed**.

`mtNumSig`/`mtSafe` are deliberately **left untouched** — they also guard `mtTranslate` (the DATA
translation path, `tests/wave5-mt-safety.spec.ts`), which is outside this spec's scope.

**Verified stronger, not weaker:** an equal (value, class) multiset implies an equal value multiset, so
`vcTransSafe` is at least as strict as the mechanism decision #5 named.

### A-4 · Addition, not a waiver — the translation prompt now carries the constraint

`vcTranslateToEn`'s system instruction previously said only *"Translate … to natural spoken English"*, while
the sibling `mtTranslate` path this guard was borrowed from has always instructed the model to keep every
number exactly as written. **We had copied the guard but not the constraint that makes it sufficient.** The
instruction is now present, including "do not convert 24-hour times to AM/PM" and "do not convert between
units" — a correct `°C`→`°F` conversion would be a *faithful* translation that the numeric guard must still
reject, so it is better not to provoke one.
**Author's brief:** the owner's design decisions below are **fixed** — this document turns them into a
precise, implementable, traced spec. Beyond what implementation requires to be unambiguous, this draft also
folds in two mid-session additions directed by the coordinating agent after fresh evidence (the 3.6-flash
comparative eval) landed during drafting: an expansion of item 2's scope to a second, real defect in the same
function, and a new small instrumentation rider (item 7). Neither is a literal restatement of the owner's
original six decisions; both are traced, reasoned, and explicitly flagged as additions requiring the owner's
own confirmation on spec review — see §7 self-review, point 4.
**Baseline:** current `HEAD` on `main`, מהדורה 261 (`b59e642`). All line citations below are **1-based**
(matching `Read`/`Grep`/every existing doc in this repo) and were verified **this session, 2026-07-24**, via
Serena `find_symbol` on the live `app.js` — not carried over from the charter's or ULTIMATE doc's v258
citations, which have drifted (see `docs/analysis/program/P0-kickoff-brief.md` §4). Where a citation differs
from an older document, this spec's number is the current one.

---

## 0. Traceability — every item to its governing source

| Item | Charter row (`2026-07-22-gap-closing-program-charter.md` §4, P0-app) | ULTIMATE gap id(s) | Phase |
|---|---|---|---|
| 1 · Spoken safety guard on `vcAskAI` + `vcTranslateToEn` | "Guard `vcAskAI` and `vcTranslateToEn`" | **A1** 🔴 Critical, **A2** 🔴 Critical | A |
| 2 · `aiSafetyNums` extraction fixes (unit-blindness + range-phrase gap) | "fix `aiSafetyNums` unit-blindness (74°F passing as grounded against 74°C)" **+ scope expansion, flagged §3.2/§7** | **A3** 🔴 Critical; range-phrase sub-fix sourced from `comparison-2.5-vs-3.6-2026-07-24.md` (B10), not an ULTIMATE-numbered gap | A |
| 3 · Conditional `google_search` | "make `google_search` conditional (COGS $1.22→$0.39 and closes hallucination surface #3)" | **E2** 🔴 | A |
| 4 · TTS managed routing | "route TTS through the managed path" | **E7/E8** 🟠 (Step-0 table, `2026-07-22-ULTIMATE-knowledge-and-gaps.md:539-542`) | B |
| 5 · `addDays` DST fix | "`addDays` DST fix (moved up from §7 Step 4... zero test blast radius, error direction shortens a nitrite cure)" | **A9** 🟠 | B |
| 6 · Cross-event false warning | "neutralise the false cross-event warning (R5 interim...)" | part of **B-i.1** (🟠, the `!equipConfigured()` branch specifically), owner decision **R5** | B |
| 7 · `usageMetadata` capture rider | **not a charter row — added per coordinator directive, flagged §4.4/§7** | supports item 3's COGS verifiability + the P0 kickoff brief's open thinking-cost question | B |

**Governing process document:** `docs/process/development-discipline.md`. **Governing product doc for item
3:** `docs/ai-strategy.md` Part A / Part D (COGS, hallucination surface framing).

---

## 1. Evidence baseline

- **A3 leak evidence, 2.5-flash incumbent:** `docs/analysis/program/eval/baseline-gemini-2.5-flash-2026-07-23.md`
  — B11 "what temp kills botulism": `ungrounded=[85,80,100,115,121,120,160,121,121,115,121,85]` (12 leaked
  numbers); B3-02 (Hebrew parity): `ungrounded=[85,80,100,100,115,121,121,120,100,121,5,57]` (12 leaked,
  including two off-topic refrigeration numbers `5`/`57`); B2-02 (Fahrenheit-phrased doneness question):
  `ungrounded=[165,165,82,180]`.
- **3.6-flash comparison — landed during this drafting session (commit `cc19658`), folded in:**
  `docs/analysis/program/eval/comparison-2.5-vs-3.6-2026-07-24.md` +
  `baseline-gemini-3.6-flash-2026-07-24.{json,md}` (GH Actions run `30085385053`, 2026-07-24). Findings that
  bear directly on this spec, in the order that matters most:
  - **The guard is required on the CURRENT production model, not a legacy-model artifact.** B11 and B3-02
    leak ungrounded numbers on **both** models: B11 2.5-flash `[85,80,100,115,121,120,160,121,121,115,121,85]`
    (12) → 3.6-flash `[85,80,100,80,100,100,116,121,121]` (9); B3-02 2.5-flash
    `[85,80,100,100,115,121,121,120,100,121,5,57]` (12, including two off-topic refrigeration numbers `5`/`57`)
    → 3.6-flash `[85,100,116,121,121]` (5, all on-topic). Both `grounded:false` on both models. **Read the
    trend correctly: 3.6-flash leaks fewer, cleaner numbers than 2.5-flash — but fewer wrong numbers is not
    "safe."** The invariant this spec's item 1 exists to enforce is unchanged and unconditional: **no
    model-originated safety number is ever voiced**, regardless of which model is live or how "close" its
    leak has gotten. These exact leaked sequences are real production leaks, not invented ones, and are used
    directly as item 1's test fixtures below (§3.1) — a real leak is stronger evidence than a synthetic one.
  - **B11/B3-02 are a missing-grounding-data gap, not a unit-confusion gap — genuinely out of item 2's scope
    on both models.** The comparison doc's own verdict: *"the app still needs either (a) a wider grounding
    block covering general botulism kill-temperatures... or (b) a refusal/redirect for this specific
    factual-lookup shape."* Neither is what item 2 (§3.2) fixes; flagged as a candidate future gap, not
    absorbed here.
  - **B2-02 now reads clean on 3.6-flash** (`ungrounded=[]`) — the model refuses the Fahrenheit conversion
    outright and states 74°C, citing its own metric-only system-prompt instruction. This is **model
    behaviour, not an app-side fix** — nothing in `aiSafetyNums` changed, and nothing guarantees the model
    keeps refusing Fahrenheit on every future prompt/model swap. It does not substitute for item 2's F→C
    normalization, which is the only durable, model-independent defence.
  - **The raw leaking-case count moved the wrong way: 3/16 (2.5-flash) → 4/16 (3.6-flash) — two NEW leaks
    (B10, B2-01), one FIXED (B2-02).** B2-01 (`ungrounded=[72]`) is the model volunteering an unrequested
    "rest to 71-72°C" tip whose `72` is genuinely absent from grounding — the guard is working correctly
    here (a real ungrounded number, correctly flagged); this is model verbosity, not a guard defect, and is
    not actioned further. **B10 (`ungrounded=[30]`) is a second, distinct guard defect, confirmed this
    session and folded into item 2's scope below (§3.2) — it is not the F/C unit-blindness bug**, it is a
    range-phrase extraction gap: the model's answer states "30%–40% (target ~35%)" (percent sign glued to
    each number, extracts cleanly), while the app's own grounding text reads "ירידה 30-40%" (a bare hyphen
    between the two digits, percent sign only after the second) — `aiSafetyNums`'s regex requires a unit
    token immediately after every digit run, so grounding-side extraction yields only `[40]`, never `30`,
    and the answer's genuinely-correct `30` then has nothing to match. **This defect lives in `aiSafetyNums`
    (extraction), confirmed by reading both functions directly — not in `aiUngroundedSafety` (comparison),
    which performs its Set-membership check correctly on whatever `aiSafetyNums` hands it.** See §3.2 for
    the fix.
  - **Grounding (A) and refusal (B) hold parity — these surfaces do NOT need touching by this spec.**
    Grounding: both models kept a full valid seasoning set on all three cut categories, 0 dropped, score 1.00
    each (`aiValidateSeasonings`, unmodified). Refusal: **bit-identical** case-for-case (`askRefuse` is a
    local regex classifier, model-independent by construction — verified, not just assumed). Neither surface
    is implicated by any of this spec's six items.
  - **The freeform (D) axis is explicitly excluded from this spec's evidence.** The 2.5-flash baseline's
    "0/5 answered" was a harness artifact — banked ~20 minutes *before* the `LIVE_CALL_TIMEOUT_MS` backstop
    fix (`abf81ed`) landed, not a model capability gap; the comparison doc itself flags this as "not a valid
    model comparison." It is not cited anywhere in this spec as evidence for or against any item.
  - **The cost/COGS question ($1.22→$0.39, item 3's own citation) cannot currently be verified after the
    fact, and this spec says so rather than papering over it** — `app.js` never reads `usageMetadata` from
    any Gemini response (zero grep hits, confirmed by the comparison doc), and the eval harness captures
    only `{txt, ctx}`. No token or dollar figure exists anywhere in the repo for either model. See the new
    §4.4 rider below.
- **Runtime accessors for verified per-item safety values (item 1's "verified-value source" contract):**
  `resolveItem(key)` (`app.js:2794-2801`) resolves any catalog key (`cut-`/`spec-`/`make-`/`umake-` prefix)
  to `{..., obj}`, where `obj` is the exact object merged from `data.py`+`sources.py` at build time (`build.py`
  inlines the Python data layer per `CLAUDE.md`'s own framing). The verified numeric fields read directly off
  `obj` throughout the existing codebase are `obj.safe` (pathogen-kill floor), `obj.tgt` (texture target,
  read as fallback — `itemStages`, `app.js:3213-3263`, line 3262: `` const sc = meta.obj ? (meta.obj.safe!=null?meta.obj.safe:meta.obj.tgt) : null ``),
  and the per-method figures `obj.svt`/`obj.svh` (sous-vide temp/hours), `obj.smt`/`obj.smh` (smoke
  temp/hours), `obj.sot`/`obj.soh` (smoke-only temp/hours) — all read the same way in `askContextFor`
  (`app.js:4132-4143`, line 4136) to build Ask-the-Fire's grounding block. This is the **one, single, already-
  established accessor pattern**; item 1 reuses it, it does not invent a new one.
  `itemStages`'s own `bcheck` stage (pushed at line 3262) is the authoritative "the number the cook must
  verify before serving" — it is the SAME `obj.safe`/`obj.tgt` value, already the one rendered on the work-plan
  card and spoken by the existing (unguarded) Voice Cook step-read flow.
  For the **active-cook** tier specifically: `window._wpTasks` entries carry an `ikey` field (comment,
  `app.js:5443`: `` window._wpTasks: {t:Date,label,sub,dur,tid,ikey} ``), and `openVoiceCook` copies that
  array into module state `vcTasks`/`vcIdx` (`app.js:5050`, `5600-5601`) — so `vcTasks[vcIdx].ikey` is the
  catalog key of whatever step the cook is currently on, resolvable via the same `resolveItem`.

---

## 2. Global Constraints (apply to every task, both phases)

1. **Hebrew-first.** Every new spoken or visible string ships in Hebrew (the base language) with an English
   counterpart threaded through the existing `L()`/`getLang()` mechanism, matching the pattern already used
   throughout `vcBuildAskPrompt`/`aiSafetyNote`/`AI_REFUSALS`. **DoD-9**: rendered in Hebrew, screenshotted,
   no English leak, correct singular/plural on any interpolated count. **L13**: any surface that shows a
   number and its Hebrew label side-by-side (this spec's guard, if it renders a corrected/redirect message
   in `vcLastQA`'s on-screen transcript, which it does — see §3.1) needs a `dir="ltr"` island around the
   digits, or the RTL context can visually flip a comparison operator or misorder a number/unit pair.
2. **Safety invariance (DoD-10).** This spec changes **what is spoken and what search/transport policy
   fires**; it must **never** alter a stored `bcheck` stage, `temp`, `safe`/`tgt`/`cure`/`cureRate` value, or
   any cook/cure duration. Concretely: none of the six items writes to `DATA.cuts`/`DATA.specials`/`DATA.makes`,
   to `store` (the persistence layer) for a plan/timer/cure record, or to `itemStages`'s returned stage list.
   **The required assertion, per task, is named in that task's own section below** — the general pattern is:
   snapshot the relevant `resolveItem(key).obj` (or, for item 5, the plan's derived reminder dates) before
   and after exercising the changed code path, assert byte-identical values. This mirrors the existing
   `safetyDiff` invariant (`app.js`, checked at the plan-pipeline boundary) without reusing that function
   directly — none of these six items touches `itemStages`/`planSchedule`, so `safetyDiff` itself is not a
   dependency here, only its *pattern*.
3. **TDD.** Every task: RED witnessed (test written first, run, observed failing for the stated reason) →
   GREEN → full suite. No production code before a witnessed failing test (`test-driven-development` skill).
4. **Serena-first on `app.js`** (`CLAUDE.md` §10.17). All six items are symbol-shaped edits on a ~9,650-line
   monolith — `find_symbol`/`get_symbols_overview`/`replace_symbol_body` are the tools, not text-matching
   `Edit`. This spec's own drafting used Serena for every citation below; a subagent executing the resulting
   plan should do the same.
5. **Suite.** `npx playwright test` — plain, nothing else. 439 tests / 86 files, `workers:20` (`CI` env unset),
   certified 7/7+ clean on the current architecture (`docs/research/measurements/m1b-capacity-probes-2026-07-23.md`).
   Never `--retries`, never `--workers=1`. Any failure, including intermittent, is a bug
   (`systematic-debugging`), never re-run to pass.
6. **Waiver Gate.** Nothing in this spec waives, narrows, or reinterprets a charter/ULTIMATE requirement.
   Where this document had to make an implementation choice the owner's verbatim decision did not spell out
   (e.g., item 1's exact Hebrew copy, item 3's exact per-usage policy, item 6's exact "neutralise" behaviour),
   it is flagged explicitly in that item's section and in §7 — none of these are treated as settled without
   the owner reviewing this spec file itself.

---

## 3. Phase A — the spoken bleeding (safety)

### 3.1 · Item 1 — Spoken safety guard on `vcAskAI` and `vcTranslateToEn`

**Trace:** ULTIMATE A1 🔴 Critical (`vcAskAI`), A2 🔴 Critical (`vcTranslateToEn`); charter P0-app row 1;
charter §7 Step 0 row 1 ("the guards already exist... this is wiring, not invention").
**Headline invariant (the test that must never break once this ships): no model-originated safety number is
ever voiced.**

#### Current state (Serena-verified, `app.js`)

- `vcAskAI` (`5352-5369`) — free-generated answer, `google_search` on, returned raw to its one caller.
- `vcAskFlow` (`5370-5384`) — calls `vcAskAI(question)`, then **`vcSpeak(answer, ansL)`** (line 5378) with
  zero inspection of `answer`'s content, and stores the same raw `answer` into `vcLastQA` for the on-screen
  transcript (line 5377, rendered by `vcRender()`).
- `vcTranslateToEn` (`5269-5284`) — translates the app's **own** Hebrew content, caches it (`vcTransCache`),
  returns raw. Its one caller, `vcSpeakContent` (`5286-5297`), speaks the translation directly (line 5294:
  `` const en=await vcTranslateToEn(text); vcSpeak(en, 'en'); ``) with zero inspection.
- Neither function calls `askRefuse` (`4197`), `aiSafetyNote` (`4404-4415`), or any guard. `aiSafetyNote`/
  `aiSafetyCaveat` exist and are correctly built (`app.js:4404-4415`, `4382-4388`) but are **never called**
  from either function — this is ULTIMATE's own framing: "wiring, not invention."
- The correct **pattern** for `vcTranslateToEn` specifically already exists 1,700 lines away: `mtGuard`
  (`7041`)/`mtSafe` (`7039`)/`mtNumSig` (`7034-7038`) guard `mtTranslate` (the DATA-translation path) by
  comparing the **sorted multiset of every number** in source vs. translation — `mtSafe(src,translated) =
  mtNumSig(src)===mtNumSig(translated)`. `vcTranslateToEn` translates the identical class of content
  (Hebrew recipe/step text) and has no equivalent check.

#### Contract

**Detection.** Before any text reaches `vcSpeak`, run it through unit-aware safety-number extraction — this
is the **same, fixed** `aiSafetyNums` from item 2 (§3.2). This is a hard ordering dependency: item 1's
"matched" test below is only correct once item 2's F→C normalization exists, because a candidate spoken
number must be compared against a resolved item's Celsius-native fields (`obj.safe`/`obj.svt`/etc.) — an
unfixed, unit-blind comparison would let a Fahrenheit-stated wrong number "match" a Celsius verified value by
digit coincidence, exactly the A3 failure mode this guard exists to prevent. **Item 2 must land before or
atomically with item 1.**

**Entity resolution — active-cook items first, then catalog** (per the owner's verbatim decision):

| Tier | Source | Mechanism |
|---|---|---|
| 1 · Active-cook | `vcTasks[vcIdx].ikey` (set by `openVoiceCook`, `5600-5604`, from `window._wpTasks`) | `resolveItem(ikey)` → `.obj` |
| 2 · Catalog | The question text itself | `askFindEntity(question.toLowerCase())` (`4022-4032`, the same fuzzy Hebrew/English matcher `askContextFor` already uses for Ask-the-Fire) → best match's `.obj` |

For each detected safety number (Celsius-normalized per item 2), check it against Tier 1's resolved item's
own fields (`safe`/`tgt`/`svt`/`smt`/`sot`, rounded); if Tier 1 has no resolvable item or no field matches,
fall through to Tier 2 using the same field set.

**Matched → speak the app's verified value, with a brief marker.** The spoken text is rewritten so the
number the cook hears is the resolved item's own verified figure (not necessarily different from what the
model said — if the model happened to say the right number, this is a no-op substitution, and the marker is
still added, so the cook hears the same reassurance whether the model was right or wrong). Proposed Hebrew
copy (flagged for the DoD-9 Hebrew check — a native/fluent pass at implementation time is expected to refine
this, not treated as final by virtue of appearing here):

> **Hebrew:** `…לפי המדריך המאומת.` — appended as a short trailing clause, e.g. *"הטמפ׳ הבטוחה היא 74 מעלות,
> לפי המדריך המאומת."*
> **English:** `…per the app's verified guide.` — e.g. *"The safe temperature is 74 degrees, per the app's
> verified guide."*

**Unmatched → strip the number, keep qualitative guidance, spoken redirect to the item card.** The specific
digits are removed from the spoken text (not the surrounding sentence — the model's qualitative advice, e.g.
"make sure it's fully cooked through," survives), and a short redirect is appended. Proposed copy:

> **Hebrew:** `מספר זה אינו מאומת — בדוק בכרטיס הפריט.` (*"This number isn't verified — check the item
> card."*)
> **English:** `This number isn't verified — check the item card.`

#### Specialization for `vcTranslateToEn`

The owner's decision covers both functions under one contract; `vcTranslateToEn` differs in one structural
way worth naming explicitly (a specialization, not a deviation): its input **already is** verified content —
the Hebrew `src` text being translated was itself built from the same `itemStages`/`resolveItem` accessors
and is already on-screen. There is no separate "resolve an entity" step needed; the ground truth **is** `src`.
This spec proposes implementing "resolve entity, matched/unmatched" for this function as a direct application
of the existing `mtNumSig`/`mtSafe` numeric-multiset comparison against `src` (not a fresh catalog lookup) —
functionally the same contract (verified-value-or-nothing), reusing the already-approved sibling mechanism
the charter itself names as the correct pattern:

- **Matched** (`mtNumSig(src)===mtNumSig(translated)`, i.e. the translation preserved every number): speak
  the translation, with the same brief marker.
- **Unmatched**: do not speak the mistranslation. Fall back to speaking `src` (the original Hebrew) — there
  is no separate "item card" to redirect to beyond the content already on screen — with a short spoken
  redirect cue: **Hebrew:** `מספר לא מאומת בתרגום — מקריא בעברית.` (*"Unverified number in translation —
  reading in Hebrew."*) **English:** N/A (the fallback itself is the Hebrew reading; no English text is
  produced for this branch since the source of truth is Hebrew).

This specialization is **flagged, not silent** — see §7.

#### Consumers (DoD-5)

- `vcSpeak` (`5141-5156`) — the actual TTS call; this is the surface the guard exists to protect
  (`vcSpeak(guardedText, ansL)` replaces today's `vcSpeak(answer, ansL)` / `vcSpeak(en, 'en')`).
- `vcRender()`'s on-screen transcript (`vcLastQA`, set at `vcAskFlow` line 5377) — must show the **same
  guarded text** that gets spoken, not the raw model output, or a sighted user reads one thing while a
  non-sighted/hands-busy user hears another (closing the shape of ULTIMATE A12: "guard text never reaches
  speech" — here, guard text must reach **both** the visible transcript and the spoken audio, consistently).

#### Safety invariance assertion

The guard operates purely on the in-memory string passed to `vcSpeak`/stored in `vcLastQA`. It never writes
to `store`, never mutates `DATA.*`, never touches `itemStages`'s returned array. **Required test:** snapshot
`resolveItem(key).obj` for the item under test before and after a full `vcAskFlow`/`vcSpeakContent` guarded
round-trip; assert deep-equal (untouched).

#### Test approach (sketch, for the plan to size)

`vcAskAI`/`vcTranslateToEn` already support test-only mocks (`window.__vcAskMock`, `window.__vcTransMock`,
lines 5353-5354 and 5271-5272) — the existing, established seam for injecting controlled model output without
a live network call. New Playwright cases inject: (a) a mock answer containing a **correct** safety number
for the active-cook item → assert the marker is present and the spoken/rendered number is unchanged; (b) a
mock answer containing a **wrong-unit** number matching Tier 1's field only after F→C normalization → assert
substitution to the verified value + marker; (c) a mock answer with a number matching **neither** tier →
assert the number is stripped and the redirect line appears, spoken and rendered; (d) the `vcTranslateToEn`
matched/unmatched pair, using `mtNumSig` equality directly.

**Real-leak fixtures (preferred over synthetic numbers wherever the shape fits — a real leak is stronger
evidence than an invented one):** use the exact `ungrounded` sequences banked in
`comparison-2.5-vs-3.6-2026-07-24.md` (§1 above) as `window.__vcAskMock` payloads for the "unmatched" case —
e.g. a mock answer built around the real 3.6-flash B11 leak shape (*"…botulism toxin is inactivated around
85°C, spores destroyed at 100-121°C…"*, i.e. the `[85,80,100,80,100,100,116,121,121]` family) against a
Voice-Cook context with no active-cook item and no catalog entity resolving any of those numbers to a verified
field → assert every one of those numbers is stripped from both the spoken text and `vcLastQA`, and the
redirect line fires. This is the single most direct, evidence-backed proof of the headline invariant ("no
model-originated safety number is ever voiced") this spec can ship, precisely because it replays a leak the
production model is confirmed to actually produce today, not a hypothetical one.

---

### 3.2 · Item 2 — `aiSafetyNums` extraction fixes: unit-blindness AND the range-phrase gap

**Trace:** ULTIMATE A3 🔴 Critical (unit-blindness, the charter's own named defect); the eval harness's own
documented KNOWN-GAP test, `evals/tests/scorers.spec.ts:94-102`; **plus a second, distinct defect in the same
function, confirmed this session from the freshly-landed 3.6-flash comparison (§1 above) and folded into this
item's scope by owner/coordinator direction** — the B10 range-phrase extraction gap. **Scope note, stated
plainly:** the charter's own P0-app row names only the F/C defect ("74°F passing as grounded against 74°C");
the range-phrase defect was discovered during this spec's research, lives in the identical function, and is
added here as a scope **expansion** (not a narrowing/waiver — the Waiver Gate governs removing or deferring
an approved requirement, not adding a second fix to the same seam) — flagged for the owner's confirmation on
spec review, per §7.

**Both defects are confirmed, by directly reading both functions this session, to live in `aiSafetyNums`
(extraction) — not in `aiUngroundedSafety` (comparison), which performs a correct Set-membership check on
whatever `aiSafetyNums` hands it, for both defects.** No change to `aiUngroundedSafety` is required for
either sub-fix.

#### Current state

```js
// app.js:4391-4396
function aiSafetyNums(s){
  const out=[]; const str=String(s||''); let m;
  const re=/(\d+(?:\.\d+)?)\s*(?:°\s*[CF]?|[CF]\b|ppm|%)|\bpH\s*(\d+(?:\.\d+)?)/gi;
  while((m=re.exec(str))!==null){ const n=parseFloat(m[1]||m[2]); if(!isNaN(n)) out.push(n); if(m.index===re.lastIndex) re.lastIndex++; }
  return out;
}
// app.js:4397-4401
function aiUngroundedSafety(answer, context){
  const a=aiSafetyNums(answer); if(!a.length) return [];
  const c=new Set(aiSafetyNums(context).map(function(n){return n.toString();}));
  return a.filter(function(n){ return !c.has(n.toString()); });
}
```

**Defect A — unit-blindness.** The unit token `(?:°\s*[CF]?|[CF]\b|ppm|%)` is a **non-capturing** group —
only the bare digits are ever extracted. `aiUngroundedSafety` then compares by `.toString()` on the bare
number. 74 °F and 74 °C both extract as `74` and are therefore indistinguishable — "pull the chicken at
74 °F" (raw, dangerous) reads as **grounded** against a context containing "74 °C" (the correct value), so
the strong escalation in `aiSafetyNote` (`4404-4415`) never fires.

**Defect B — range-phrase extraction gap (B10, `comparison-2.5-vs-3.6-2026-07-24.md` §2, confirmed this
session).** The regex requires a unit token **immediately** after each digit run. A hyphen-separated range
sharing one trailing unit — the app's own grounding text for dry-salami weight loss, `` ירידה 30-40% `` —
extracts only `[40]`: the `30` has no unit directly after it (`-40%` intervenes), so `aiSafetyNums(context)`
never puts `30` in the comparison set at all. When the model's own answer states the identical figure with
each number correctly percent-suffixed (`` 30%–40% (target ~35%) ``, extracting cleanly as `[30,40,35]`, all
individually unit-glued), the answer's `30` — a **correct, on-topic, present-in-source-data number** — has
nothing to match against and reads as `ungrounded`. This is not a unit-conversion problem (both sides are
already `%`); it is an extraction problem: the grounding side's own range notation loses one of its two
bounds before comparison ever runs.

#### Fix contract

`aiSafetyNums` **keeps its existing public shape** (`number[]`) — no consumer's type signature changes. What
changes is what each number **means**, and how many numbers a range phrase contributes.

1. **Defect A fix — unit-aware extraction + F→C normalization.** Extend detection to the four token classes
   the owner named: `°F` / `°C` / bare `F` (as today) / Hebrew `מעלות` (bare, no letter — the app's own
   convention, confirmed by every existing grounding string, e.g. `askContextFor`'s
   `` בטיחות ${o.safe||63}°C ``, is Celsius-first; a bare `מעלות`/bare `°` is treated as already-Celsius, not
   converted). For a detected Fahrenheit token (`°F` or bare `F`), convert via the **existing**
   `UNIT_CONV['F->C']` (`app.js:131`: `` function(v){ return (v-32)*5/9; } `` — already used elsewhere for
   equipment-property conversion; this fix reuses it, it does not add a second conversion formula anywhere in
   the file), then **round to the nearest integer** — matching the app's own data convention of integer °C
   safety floors (63/71/74). `ppm`/`pH` tokens pass through unchanged (no F/C ambiguity in that class).
2. **Defect B fix — range-phrase extraction.** Add a range-pattern alternative, tried before the single-number
   pattern, that matches two digit runs separated by a bare hyphen and sharing one trailing unit token
   (`` (\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:°\s*[CF]?|[CF]\b|ppm|%) ``-shaped), and pushes **both**
   numbers into the output (each individually unit-converted per point 1 if the shared unit is Fahrenheit).
   Illustrative only — the exact regex is an implementation-plan detail, not fixed by this spec character-for-
   character, but the behavioural contract is: `aiSafetyNums('ירידה 30-40%')` must return an array containing
   both `30` and `40`, not only `40`. **Known limitation, stated rather than silently accepted:** this
   pattern does not attempt to disambiguate a genuine negative number (e.g. `-5°C`) from a range — the app's
   safety-number domain (cure/cook/dry temperatures and percentages) has no legitimate negative values today,
   so this is judged a safe, documented simplification, not an oversight.
3. `aiUngroundedSafety` requires **no code change for either sub-fix** — it already compares the array
   `aiSafetyNums` returns; with more-complete, unit-normalized values flowing in, its existing
   `.toString()`/`Set` comparison is correct for both defects for free.

#### Consumers to verify (DoD-5, all named)

- `aiUngroundedSafety` (`4397-4401`) — no change needed, verified above, for both sub-fixes.
- `aiSafetyNote` (`4404-4415`) — no change needed; it calls `aiUngroundedSafety` and only cares whether the
  result is non-empty.
- **`evals/lib/scorers.ts`'s `scoreNumericSafety`** (`46-52`) — calls `aiSafetyNums`/`aiUngroundedSafety`
  directly via `page.evaluate` and types `extracted`/`ungrounded` as `number[]`. **Unaffected by signature**
  (still `number[]`), but its **values** change for any Fahrenheit-containing or range-phrase case — this
  file is a real consumer and is named here so a plan does not miss it.
- **`evals/tests/scorers.spec.ts:94-102`** (the KNOWN-GAP test, defect A) — **must be inverted**, not just
  left passing. Current assertions codify today's bug as expected:
  ```ts
  expect(r.extracted).toEqual([74]);       // the regex strips the °F, keeping only the bare digits
  expect(r.ungrounded).toEqual([]);        // BUG, recorded on purpose: 74 matches the 74 from "74°C"
  expect(r.grounded).toBe(true);           // the strong caveat does NOT fire — this is the gap PRE-4 must be able to see
  ```
  Post-fix, `r.extracted` for the answer `'74°F is safe for chicken'` must be `[23]` (rounded Celsius), and
  `r.ungrounded` must equal `[23]` (does not match the grounding's `[74]`), `r.grounded` must be `false`. The
  test's title and its "recording a known gap, not asserting correctness" framing must be rewritten to state
  it now **proves the gap is closed** — this is a rename plus an assertion flip, not a new test.

  *(Note on the task brief's phrasing "flip it from `it.fails` to a real assertion": the actual test, verified
  this session, is not annotated with Playwright's `test.fail()`/`.fails` marker — it is a plain, currently-
  green test that deliberately documents the buggy behaviour as "expected." The required change is the same
  in substance — invert the assertions so the test only stays green once the bug is fixed — this note exists
  so the implementer does not go looking for a `.fails` annotation that is not there.)*

  **A required sibling test for defect B**, added alongside (not replacing) the inverted defect-A test, using
  the real B10 shapes directly: `scoreNumericSafety(page, '…30%–40% (target ~35%)…', '…ירידה 30-40%…')` must
  return `ungrounded:[]` (today: `[30]`) — proven by first witnessing the RED state (the range-phrase gap
  reproduces exactly as B10 measured it), then GREEN after the regex extension.

#### Regression evidence (three cases; two directions on defect A, one on defect B)

1. **Dangerous under-flag (defect A, the literal A3 example):** 74 °F vs. grounding containing only `74°C` →
   today `grounded:true` (wrong, dangerous — the number is 22.7 °C off); after the fix, `74°F` normalizes to
   `23`, does not match `[74]`, → `grounded:false`. **Primary regression proof — a direct unit test, not the
   eval harness** (see below for why).
2. **Trust-eroding over-flag, evidenced by the live baseline (defect A, `B2-02`):** the 2.5-flash incumbent's
   answer used `165°F` (the correct Fahrenheit-equivalent of 74 °C poultry doneness) against grounding
   containing `74°C` — today this reads as `ungrounded:[165,...]`, a **false positive**: a correct answer,
   stated in the "wrong" unit, gets the strong "do not rely on this" escalation. After the fix, `165°F`
   normalizes to `74`, matches grounding's `74`, correctly reads `grounded`. Defect A's fix closes the gap in
   **both directions** — not only "catch the dangerous mismatch" but also "stop crying wolf on a correct
   answer."
3. **False-positive-on-correct-percentage (defect B, evidenced live by `B10`, 3.6-flash):** `30%` (a correct,
   on-catalog dry-salami weight-loss figure) vs. grounding `` ירידה 30-40% `` → today `ungrounded:[30]` (a
   false positive, the exact new regression the comparison doc surfaced); after the fix, grounding extracts
   `[30,40]`, the answer's `30` matches, → `grounded:true`.

#### What this fix explicitly does **not** close (Circle of Control — named, not silently absorbed)

`comparison-2.5-vs-3.6-2026-07-24.md` (§1 above) names a case that looks adjacent but is **not** an
`aiSafetyNums` defect and is genuinely out of this item's scope:

- **B11/B3-02 ("what temp kills botulism") remain broken on both models — a missing-grounding-data gap, not
  an extraction or unit-confusion gap.** The leaked numbers (85/100/115/121 °C toxin-kill figures) are never
  in the app's grounding block **at all**, in any unit or notation — there is nothing for a smarter regex to
  extract, because the vetted context simply does not carry general botulism-chemistry temperatures (only
  cure/cook-safety floors). The comparison doc's own words: *"the app still needs... a wider grounding
  block... or a refusal/redirect for this specific factual-lookup shape."* Out of this item's scope and out
  of P0-app's charter scope. Flagged for the owner as a candidate future gap, not fixed here. **This is
  exactly why item 1's guard (§3.1) is the durable backstop for this class of question** — it does not
  depend on the grounding block being complete; it strips any number that fails to resolve against a verified
  item, regardless of why it failed to resolve.

#### Safety invariance assertion

Pure function, no `store`/`DATA` writes either before or after. Required test: call `aiSafetyNums`/
`aiUngroundedSafety` before and after with a fixture untouched by either change (an all-Celsius,
no-range-notation case) and assert byte-identical output — proving both fixes are additive, not a behaviour
change for the already-correct majority of cases.

---

### 3.3 · Item 3 — Conditional `google_search`

**Trace:** ULTIMATE E2 🔴; charter P0-app row 3 ("COGS $1.22 → $0.39... and closes hallucination surface #3
— the best ratio in the document"); `docs/ai-strategy.md` Part A ("Ask-the-Fire runs at temperature 0.8 with
live web search") and Part D (packaging: *"make grounded web search the paid capability — it is 77–90% of
COGS and the #3 hallucination surface"*).

#### Current state — the two always-on sites (both confirmed via `search_for_pattern`, this session)

```js
// app.js:4328-4348 (askGemini)                app.js:4339
tools:[{google_search:{}}],

// app.js:5352-5369 (vcAskAI)                   app.js:5360
tools:[{google_search:{}}],
```

**Pre-existing, already-conditional, out of scope — do not touch:** `aiJSON` (`4427-4460`) already takes a
caller-supplied `search` boolean (default `false`) and builds `` tools: search?[{google_search:{}}]:undefined ``
(line 4444). This item is scoped to the two **unconditional** sites only.

#### Design: `AI_SEARCH`, a per-usage policy registry beside `AI_THINK`

`GEM_MODELS.text.caps.search:true` (`4210-4212`) states the **model** supports search; it is not a per-usage
policy. `AI_THINK` (`4254-4266`) is the existing precedent for a role-keyed policy map consulted at call
sites via a small resolver (`thinkFor`, `4267`). This item adds the sibling:

```js
AI_SEARCH = {
  ask:   'auto',   // askGemini — Ask-the-Fire
  vcAsk: 'auto',   // vcAskAI  — Voice Cook hands-free Q&A
}
```

**Policy value `'auto'` (the only value either usage needs today — the map exists so a future usage can be
`'always'`/`'never'` without a new mechanism):** attach `google_search` only when the app's own vetted
context for this question is **empty**.

| Usage | Local-grounding signal already computed at the call site | Condition for `google_search:true` |
|---|---|---|
| `ask` (`askGemini`) | `askContextFor(q)` already runs before the body is built (`4132-4143`) and returns `{ctx, ents}` — `ctx` is non-empty whenever a catalog entity matched **or** the question triggered `askSafetyIntent(q)` (which injects `SAFETY_FACTS()`) | `ctx===''` |
| `vcAsk` (`vcAskAI`) | Does not build `ctx` today. **Reuse item 1's entity-resolution step** (Tier 1 active-cook via `vcTasks[vcIdx].ikey`, Tier 2 catalog via `askFindEntity`) — if either tier resolves an item, treat that as local grounding present | neither tier resolves an item |

**Rationale for `'auto'` (stated so the policy is not an arbitrary toggle):** when the app already has vetted
data for the question (a catalog entity matched, or it's a recognized safety-intent question with
`SAFETY_FACTS()` injected), search adds cost and an indirect-injection surface (arbitrary web content the
model may incorporate) **without adding value** — the model already has the correct numbers. When nothing
local matched (genuinely open questions — "where can I buy charcoal near Sharon," which `askGemini`'s own
system prompt already anticipates: `` יש לך חיפוש באינטרנט: השתמש בו לשאלות על מידע עדכני/מקומי — עסקים, חנויות...
``), search is the only way to answer at all, and stays on.

**Architecture note for the plan (shared resolution, not duplicated):** items 1 and 3 both need "does an
entity resolve for this question" for `vcAskAI`. The plan should implement entity resolution **once** as a
small helper (e.g. `vcResolveEntity(question)` returning the matched item or `null`) and have both the
search-gate and the spoken-value-guard call it, rather than resolving twice per request. This is an
implementation-sequencing note, not a new requirement.

#### Safety/correctness note

Turning search off for locally-grounded questions cannot regress item 1's or item 2's guard — if anything, a
smaller fraction of answers carry externally-sourced content, which is strictly fewer opportunities for an
ungrounded number to appear in the first place.

#### Cost citation

ULTIMATE §7 Step 0: *"cuts blended COGS $1.22 → $0.39 (68% of the entire cost gap)."* `docs/ai-strategy.md`
Part D: persona C from $2.83 → $0.99/mo, persona B from $0.67 → $0.17/mo (search gating specifically).
**Honest caveat, confirmed this session:** these figures are **asserted, not currently verifiable after the
fact** — `app.js` never reads `usageMetadata` from any Gemini response (zero grep hits, confirmed via the
3.6-flash comparison doc), so there is no way to measure this item's real before/after cost delta once
shipped. §4.4 below is the instrumentation rider that closes that gap.

#### Test approach

Following the existing `tests/ai-trust.spec.ts` pattern (stubs `window.gemFetch`/the mock seam and asserts on
the outgoing request body): one case with a catalog-matching question → assert `tools` is `undefined`/absent
in the body sent to `gemFetch`; one case with no catalog match and no safety intent → assert `tools:
[{google_search:{}}]` is present. Both for `askGemini` and for `vcAskAI`.

#### Safety invariance assertion

No stored value changes; this is a request-shaping change only. Required test: same before/after snapshot of
`resolveItem(key).obj` pattern as items 1 and 2 (trivially passes — the function under test never touches
`DATA`/`store`).

---

## 4. Phase B — utility riders

### 4.1 · Item 4 — Route TTS through the managed path

**Trace:** ULTIMATE §3.E "Step-0" table (`2026-07-22-ULTIMATE-knowledge-and-gaps.md:539-542`, E7/E8); charter
P0-app row 4; charter §7 Step 0: *"Two bugs, one fix: managed users currently get the weaker voice while the
owner is silently billed for the better one."*

#### Current state — two distinct defects in the same two functions

```js
// app.js:5111-5130 (gemSpeak)
async function gemSpeak(text, lang){
  const key=gemKey(); if(!key) throw new Error('no-key');     // ← defect 1: hard BYOK gate
  ...
  const r=await gemFetch('tts', {...}, {timeout:20000});      // ← no opts.key forced — see defect 2
  ...
}

// app.js:5141-5156 (vcSpeak)
function vcSpeak(text, lang){
  ...
  if(gemKey()){                                                // ← defect 1's caller-side mirror
    gemSpeak(text, L).catch(...);
  } else sysSpeak(text, L);                                    // ← managed-only users never even try Gemini TTS
}
```

- **Defect 1 — access.** `gemSpeak`'s gate requires a **personal** key just to attempt the call at all; a
  managed-only user (central access code, no personal key) never reaches `gemFetch`. `vcSpeak`'s own
  `if(gemKey())` gate mirrors this — even if `gemSpeak`'s internal gate were fixed alone, `vcSpeak` would
  still never call it for a managed-only user. **Both must change together, or the fix is dead code** (the
  project's own `no-inert-shipment` lesson, L8).
- **Defect 2 — billing mismatch.** `gemFetch(model, body, opts)`'s own routing (`4298-4327`, line 4304:
  `` const mode = opts.key ? 'byok' : gemMode(); ``) prioritizes **managed** whenever `centralUrl()` and
  `centralCode()` are both set, **regardless of whether the caller has a personal key** — because
  `gemSpeak` never passes `opts.key`. So even a user who *does* have a personal key (the only way past
  `gemSpeak`'s gate today) can have their TTS call silently billed through the managed Worker instead of
  their own key, if a central config also happens to be present — the gate's implied promise ("your key
  powers this") does not match the transport's actual behaviour.

**No change needed to `gemFetch`, `gemMode`, or `GEM_MODELS.tts`** — the managed→BYOK→off chain is already
correct and generic; it is exactly what every other AI feature (`askGemini`, `vcAskAI`, `vcTranslateToEn`,
`aiJSON`) already relies on via the identical one-line idiom `` if(!aiAvail()) throw new Error('no-key'); ``
(`aiAvail`, `4360`: `` return gemMode()!=='off'; ``).

#### Fix

1. `gemSpeak` (`5111`): replace the opening two lines with `` if(!aiAvail()) throw new Error('no-key'); `` —
   removes both the dead `key` local and the BYOK-only gate, matching the four other call sites exactly.
2. `vcSpeak` (`5141-5156`): replace `` if(gemKey()){ `` with `` if(aiAvail()){ `` — so a managed-only user's
   call is actually attempted through `gemSpeak`/`gemFetch` instead of unconditionally falling to the weaker
   `sysSpeak` browser voice.

Both edits together make TTS follow the exact same fallback chain already documented and exercised by every
other Gemini call in the app: **managed (if `centralUrl()`&&`centralCode()`) → BYOK (if `gemKey()`, including
`gemFetch`'s own automatic retry-with-key on a 401/402/403 from managed, `4315`) → off.** `vcSpeak`'s existing
`.catch()` handler (unchanged) remains the last line of defence, falling to `sysSpeak` only on an actual
transport error, not on the mere absence of a personal key.

#### Explicitly out of scope (Circle of Control)

ULTIMATE E6 (*"the managed→BYOK fallback is silent — no toast, no 'quota exhausted' surface"*) is a real,
separate, pre-existing gap in `gemFetch` itself, not part of this item. Noted, not fixed here.

#### Consumers (DoD-5)

`vcSpeak` is called from every place the app currently reads a step or answer aloud (`vcSpeakContent`,
`vcAskFlow`, the timer warn/end callbacks at `5225-5226`) — all of them inherit the fix automatically since
`vcSpeak` is the single chokepoint; no other call site needs editing.

#### Test approach

Stub `centralUrl()`/`centralCode()` to simulate a managed-only session (no `gemKey()`), stub `fetch`/
`gemFetch`'s network layer, call `vcSpeak(...)`, and assert the managed-mode request is actually attempted
(not immediately short-circuited to `sysSpeak`). A second case: personal key present, no central config →
assert BYOK routing (unchanged behaviour, regression-guarding the pre-existing BYOK path).

#### Safety invariance assertion

Transport-only change; no stored value touched. Same before/after `resolveItem(key).obj` snapshot pattern
(trivially passes).

---

### 4.2 · Item 5 — `addDays` DST fix

**Trace:** ULTIMATE A9 🟠 High; charter P0-app row 5 (*"hours of work, zero test blast radius, and its error
direction shortens a nitrite cure"*).

#### Current state and defect

```js
// app.js:2790
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+(+n||0));return x.toISOString().slice(0,10);}
```

`new Date('YYYY-MM-DD')` parses as **UTC** midnight (ISO-8601 date-only strings are UTC per spec).
`x.setDate(...)` mutates in **local** time. `.toISOString()` reads back in **UTC**. When the local-time
calendar-day arithmetic crosses a DST transition, the UTC offset at the end of the mutation differs from the
offset at the start, and the round-trip loses (or gains) a day. Measured directly (ULTIMATE A9, executed with
`TZ=Asia/Jerusalem`): `addDays('2026-03-26',2)` returns `'2026-03-27'` (expected `'2026-03-28'`);
`addDays('2026-03-26',14)` returns `'2026-04-08'` (expected `'2026-04-09'`). **The error direction is always
"lose a day," never "gain a day"** — for a cure/dry reminder, losing a day means the reminder fires **early**,
shortening the effective cure/dry period below what the plan intended.

**Distinct from a separately-refuted claim, not to be conflated:** ULTIMATE §4 records that a broader claim
("`addDays`/`daysBetween` broken for negative-UTC-offset timezones") was tested and **disproved** — for most
timezones the local-mutation round-trip self-cancels *unless* a DST transition falls inside the added span.
Israel (`Asia/Jerusalem`, a positive UTC offset, DST observed) is exactly the "transition falls inside the
span" case, independently confirmed by direct execution — A9 stands as a real, narrow, DST-crossing-specific
defect, not the general timezone claim that was refuted.

#### Fix

Do the entire calculation in UTC-safe integer/calendar space — never construct a `Date` from local-time
mutation:

```js
function addDays(d,n){
  const [y,m,dd] = String(d).split('-').map(Number);
  const x = new Date(Date.UTC(y, m-1, dd));
  x.setUTCDate(x.getUTCDate() + (+n||0));
  return x.toISOString().slice(0,10);
}
```

`Date.UTC(...)` parses explicitly in UTC (identical to today's implicit UTC parse of the ISO string —
no behaviour change there), and `setUTCDate` mutates in UTC too, so the calculation never crosses a local-time
DST boundary at all. Zero local-time reads anywhere in the function.

#### Consumers (named per ULTIMATE A9's own citation list — the real callers whose correctness this fixes)

`app.js:3524, 3547, 8718, 9220, 9231, 9274, 9276-9279` (cure/dry reminder date computation and the reminder
copy `"סיום כבישה — הוצא ושטוף / End of cure — remove and rinse"`). No plan or task list here needs updating
individually — they all consume `addDays`'s **return value**, and this fix changes only that value's
correctness on DST-crossing spans, not the call sites.

#### Regression test (DoD-7 — reverted/observed-failing, restored/observed-passing, both outputs required)

Playwright's `browserContext.timezoneId` option (a native, documented context option — no `TZ` env var
needed, since `addDays` runs inside the page, not in Node) set to `'Asia/Jerusalem'`. Exact reproductions
from the ULTIMATE A9 measurement:
- `addDays('2026-03-26', 2)` must equal `'2026-03-28'` (today: `'2026-03-27'`).
- `addDays('2026-03-26', 14)` must equal `'2026-04-09'` (today: `'2026-04-08'`).
- A non-DST-crossing case (same month, no transition) must be unchanged before/after, guarding against a
  regression in the ordinary path.

#### Safety invariance — the one item where this constraint needs its own precise statement, not the generic pattern

This task's entire purpose is to change a **derived calendar date**. The invariant it must uphold is
narrower than "nothing changes": **no stored `safe`/`temp`/`cure`/`cureRate` gram or ppm value is touched
(trivially true — `addDays` only ever returns a date string), and the corrected date must never fire EARLIER
than the current (buggy) one on the reproduction fixture** — i.e., the fix's error direction must go the
correct way (extend-or-preserve the cure window, per the charter's own framing: *"its error direction
shortens a nitrite cure"* today; the fix removes the shortening, it must not introduce a lengthening bug that
overshoots either). **Required assertion:** on the exact `TZ=Asia/Jerusalem`, `2026-03-26` fixture, the fixed
`addDays` return date must be **on or after** the buggy version's return date, for every `n` tested — proven
by literally computing both (old formula inlined in the test vs. the new implementation) side by side and
asserting the ordering, not just the two point values above.

---

### 4.3 · Item 6 — Neutralise the false cross-event warning

**Trace:** ULTIMATE B-i.1 (🟠, specifically the `!equipConfigured()` branch of `combinedEventsRows`); owner
decision **R5** (charter §1: *"Cross-event allocation waits until after the orchestrator... Interim: the
currently-wrong overlap warning is neutralised in P0"*); charter P0-app row 6 (*"it false-flags two events on
different smokers and stays silent on two sharing one bath"*).

#### Current state

```js
// app.js:7915-7971 (combinedEventsRows), the unconfigured branch, lines 7950-7954
if(!equipConfigured()){
  for(var a=0;a<rows.length;a++){ for(var b=a+1;b<rows.length;b++){ const A=rows[a],B=rows[b];
    if(A.ev.id!==B.ev.id && A.smoke && B.smoke && A.smoke.start<B.smoke.end && B.smoke.start<A.smoke.end){ A.contention=true; B.contention=true; } } }
  return rows;
}
```

The function's own comment (lines 7947-7949) documents the intent: *"until the user configures a kit we know
no capacity... It presumed ONE smoker and warned on overlapping smoke windows, which is still the most useful
thing we can say with no data."* Two symptoms follow from that single assumption:

1. **False-flags two events on different smokers.** If the user genuinely owns two physical smokers but
   hasn't configured Equipment 2.0, any two events with overlapping smoke windows are flagged, regardless of
   whether they'd ever share a device.
2. **Stays silent on two sharing one bath.** The check only ever inspects `.smoke` (set only for
   `kind==='smoke'` stages, `row.smoke=smokeWin` at line 7938) — a sous-vide (`kind==='sv'`) stage never
   populates `row.smoke`, so two overlapping sous-vide items across events are never flagged, even though the
   exact same "assume one device" heuristic, applied consistently, would have to warn there too.

**The `equipConfigured()` branch (lines 7955-7970) is not part of this defect** — it resolves each stage's
device via `cookerFor(meta.key, p.kind, ev.id)` scoped per-event (line 7930's comment: *"resolved in THIS
EVENT'S OWN scope... never the globally active one"*), groups by real `devId`, and already includes `sv` kind
in `['smoke','cook','sv']` (line 7928). It correctly distinguishes devices and correctly covers baths. It
does still share the separately-tracked, broader "three different capacity rules" gap (ULTIMATE B-i.1's whole
finding, `o.over||!o.compat.tempOk` at line 7964) — that whole-vs-per-slot unification is P7's job (§7 Step
7 of the ULTIMATE doc), explicitly **not** this item's scope.

#### R5 interim scope — "neutralise," not "fully fix"

R5 defers the **full**, symmetric, capacity-aware cross-event pipeline to after the orchestrator (P9). P0's
job is narrower: **stop the specific wrong verdict**, not build the real thing early. This spec proposes
(flagged — the owner's decision names the *symptom*, this is the literal interpretation of "neutralise", to
be confirmed on spec review) that the correct P0-scoped behaviour is: **when equipment is not configured, do
not assert a `contention` verdict from time-overlap at all.** Remove the nested double-loop; every row keeps
its default `contention:false` in the unconfigured branch. This directly removes symptom 1 (the false
positive on different smokers — the specific, named, wrong claim). It also makes the treatment of
symptom 2 **consistent** rather than asymmetric: today, smoke-overlaps get a wrong heuristic warning while
bath-overlaps get none; after this change, neither gets a claim at all until the user configures equipment —
an honest "we don't know" silence in both directions, rather than a confident wrong answer in one direction
and silence in the other. Building the bath-aware, device-aware version of this heuristic is explicitly out
of scope (that is the "same five-stage pipeline as the single-event view" work reserved for P7/P9).

#### Consumers (DoD-5, both named — both read `row.contention`)

- `combinedTimelineHTML`'s clash badge and summary line (`app.js:8029-8033`) — renders `⚠` per contended row
  and the `clashN`-driven `clashNote` block. After this fix, on the unconfigured path, `clashN` is always `0`
  and this note never renders (a real behaviour change, verified by a real render, not just the data
  function).
- The home-screen multi-event badge (`app.js:7654-7658`, `` clash=combinedEventsRows().filter(r=>r.contention).length ``)
  — same effect, different surface.

#### Test approach

Two-event fixture, overlapping smoke windows, **no equipment configured** → before: both rows' `contention`
is `true` (RED, reproduces the false-flag); after: both `false` (GREEN). **Negative case (DoD-6, must not
regress the correct branch):** the same fixture, equipment configured with each event on a **distinct**
device → `contention` stays `false` (already correct, must remain so); equipment configured with both events
sharing **one** device and a genuine overlap → `contention` stays `true` (already correct, must remain so —
this is the case that proves the fix did not accidentally touch the configured branch).

#### Safety invariance assertion

No `safe`/`temp`/cure value touched — this changes a derived UI warning only. Standard before/after
`DATA`/`store` snapshot (trivially passes, `combinedEventsRows` is a pure read+compute function).

---

### 4.4 · Rider — capture `usageMetadata` at the `gemFetch`/`aiJSON` seam (instrumentation, not a fix)

**Provenance, stated plainly:** this is **not** one of the owner's six verbatim P0-app decisions in §0's
traceability table. It is added here per an explicit coordinator directive issued during this spec's drafting,
after the freshly-landed 3.6-flash comparison proved the underlying cost/thinking-token questions are
currently unanswerable from any artifact in the repo. It is scoped **small and narrow** (read-and-log only,
no behaviour change to any AI call) precisely so it can sit inside this spec as a rider without inflating
Phase B's blast radius. **Flagged for the owner's confirmation alongside every other judgment call in §7** —
unlike items 1-6, this one was not itself named by the owner, only its motivating question was.

**Why it belongs here rather than a separate spec:** it is what makes item 3's own COGS claim ($1.22→$0.39)
verifiable after the fact instead of merely asserted (§3.3's "Cost citation" now carries this exact caveat),
and it is what the `gemini-3.6-thinking-research.md` research (cited in the P0 kickoff brief) already flagged
as the missing half of the model-migration cost question — a second consumer for the same small change.

**Current state.** Confirmed by grep this session (and independently by the 3.6-flash comparison doc, §5 of
that document): zero references to `usageMetadata`, `thinkingBudget`-as-a-response-field, or any token-count
field anywhere in `app.js`. `gemFetch` (`4298-4327`) returns the raw `Response`; every caller
(`askGemini`/`vcAskAI`/`vcTranslateToEn`/`aiJSON`/`gemSpeak`) reads only `candidates[0].content.parts[].text`
via `gemReadText`/inline parsing. The eval harness (`evals/lib/runner.ts`) captures only `{txt, ctx}` from
`askGemini`'s return. **No token, latency, or cost figure exists anywhere in this repo for either model.**

**Proposed scope (read-and-log only):**
1. At the one chokepoint every text/JSON call already passes through — `gemFetch`'s success path
   (`4298-4327`, where `r.ok` is true and the raw `Response` is returned) — read `usageMetadata` from the
   parsed JSON body (Gemini's response envelope carries `usageMetadata.{promptTokenCount,
   candidatesTokenCount, thoughtsTokenCount, totalTokenCount}` per the API's own documented shape) without
   changing the function's return contract (still returns the `Response`; the metadata is captured
   separately, e.g. via a lightweight in-memory ring-buffer or a `console.debug`/dev-only surface — the exact
   storage mechanism is an implementation-plan decision, not fixed here).
2. Thread the same capture into `aiJSON`'s two call sites (`callOnce`, `4448-4452`) since it wraps `gemFetch`
   directly.
3. **No UI surface, no persistence, no new stored value** — this stays firmly on the "instrumentation" side
   of the line, which is also why it does not need its own Data Correction Gate or safety-invariance
   assertion in the sense items 1-6 do: it reads a field of the API response that already arrives with every
   call, and writes nothing the app currently relies on for any decision.

**Explicitly not in this rider's scope:** building a cost dashboard, wiring token counts into the eval
harness's scorecards, or re-deriving the ULTIMATE §3.H unit-economics figures against `gemini-3.6-flash`
pricing (all real, all named as open in the P0 kickoff brief §2/§5, all bigger than a P0-app rider can
absorb without becoming its own spec).

#### Safety invariance assertion

Pure instrumentation; no `safe`/`temp`/`cure` value is read or written by this rider at all — it reads a
field of the Gemini API response envelope that has nothing to do with the app's own safety data. No assertion
beyond "the change does not alter any AI call's request or its returned text" is needed; that itself is the
required regression test (before/after: identical outgoing request bodies and identical parsed answer text
for a fixed mock response, only the newly-captured metadata differs).

---

## 5. Definition of Done

### 5.1 · Program-level gates (quoted verbatim, `2026-07-22-gap-closing-program-charter.md` §5)

> **5.1** Every task passes the 12-point DoD in `CLAUDE.md` §3. No exceptions, including *witnessed RED*, a
> **named production consumer** for any computed value, a screenshot at **390 × 844** for any UI change, and
> a full green suite with no `--retries` and no `--workers=1`.

> **5.3** The Waiver Gate stands (§4). Any requirement that cannot be met is raised **in conversation** with
> the spec text and the reason. Recording it in a document does not count as raising it. Per D2, this now
> includes anything the assistant would otherwise call "deferred."

**§5.2 (Data Correction Gate) does not apply** — none of the six charter items, nor the §4.4 rider, alters a
`safe`/cure/salt value (confirmed per-item above).

### 5.2 · `CLAUDE.md` §3's 12-point per-task gate applies to every task without exception

Traced-requirement · witnessed RED, output pasted · GREEN, full command output pasted · behavioural assertion
(observable effect, not a computed field nothing reads) · named consumer(s) · minimal fixture + negative case
tested · regression red-green for bugfixes (items 5 and 6 are bugfixes; items 1-4 are new-guard/new-policy
work, so DoD-7 applies wherever a "before" buggy behaviour exists to revert-and-reobserve, which is every item
in this spec except item 3's pure policy addition — items 1/2/4/5/6 all have a demonstrable "before" state) ·
screenshot at 390×844 for any UI change (item 1's transcript rendering, item 6's clash badge) · Hebrew check ·
safety invariance named per-item above · no arbitrary waits · full suite green, plain `npx playwright test`,
once.

### 5.3 · Phase-level completion criteria

- **Phase A complete** when items 1-3 each individually pass the full DoD above, item 2 lands before or with
  item 1 (the stated ordering dependency), and the full suite is green with all Phase A tests included.
- **Phase B complete** when items 4-6 each individually pass the full DoD above, and the §4.4 rider (item 7)
  is either shipped or explicitly deferred by the owner in conversation (it is not one of the owner's six
  verbatim decisions, so — unlike items 1-6 — deferring it does not trigger the Waiver Gate; it does still
  need an explicit owner call, not a silent drop, since it is now a named row in this approved spec). Phase B
  has no internal ordering dependency among items 4, 5, 6 (different functions, no shared state); item 7 is
  independent of all of them.
- **This spec complete** when both phases are complete and a fresh, independent re-audit confirms every row
  of §0's traceability table is MET against this spec (not against a ledger), per the charter's own per-phase
  gate (`development-discipline.md` §3, "Per-phase gate").

---

## 6. Compact gap-ID trace table

| # | Item | Gap id(s) | Functions touched | Phase | Depends on |
|---|---|---|---|---|---|
| 1 | Spoken safety guard | A1, A2 | `vcAskAI`, `vcAskFlow`, `vcTranslateToEn`, `vcSpeakContent` | A | Item 2 |
| 2 | `aiSafetyNums` extraction fixes (unit-blindness + range-phrase) | A3 + B10 (comparison doc, non-ULTIMATE) | `aiSafetyNums` (consumers unaffected in signature) | A | — |
| 3 | Conditional `google_search` | E2 | `askGemini`, `vcAskAI` | A | Item 1 (shared resolution helper, implementation-level only) |
| 4 | TTS managed routing | E7, E8 | `gemSpeak`, `vcSpeak` | B | — |
| 5 | `addDays` DST fix | A9 | `addDays` | B | — |
| 6 | Cross-event warning | B-i.1 (partial), R5 | `combinedEventsRows` | B | — |
| 7 | `usageMetadata` capture rider (non-charter addition) | supports E2's COGS claim | `gemFetch`, `aiJSON` | B | — |

---

## 7. Self-review (per `brainstorming` skill — placeholders, contradictions, ambiguity, scope)

**Placeholders — none left unresolved.** Every item above has concrete current-state code, a concrete fix, a
concrete test approach, and (where applicable) concrete proposed copy. Nothing reads "TBD."

**Contradictions checked:**
- Item 1's general "resolve entity, matched/unmatched" contract vs. item 1's `vcTranslateToEn` specialization
  (source-text comparison instead of catalog resolution) could read as a deviation from the owner's verbatim
  instruction. It is **not** — it is the same contract (verified-value-or-nothing) applied via the more
  direct mechanism available specifically because a translation's ground truth is its own source text. Flagged
  explicitly in §3.1 and here, for the owner to confirm or override on spec review.
- Item 2's fix vs. the freshly-landed 3.6-flash comparison data: confirmed the fix's proof does **not** rest
  on B11/B3-02 clearing (they can't, for an unrelated reason), and does not rest on B2-02 (already clean on
  the current model, for a model-behaviour reason, not an app-side one) — the primary regression proof is a
  direct unit test, independent of any live model's current behaviour. No contradiction, but this required
  correcting an initial assumption (that all three baseline cases were "the A3 carve-out class" in the same
  sense) — recorded honestly rather than silently adjusted.

**Ambiguity flagged for owner confirmation (not silently resolved as fact):**
1. Item 1's exact Hebrew/English copy (both utterances) — proposed, not final; needs the DoD-9 native-speaker
   pass at implementation time.
2. Item 3's exact `AI_SEARCH` policy semantics (`'auto'` = "fire only when local context is empty") — this is
   this spec's own design choice, made because the owner's decision named the *what* (make it conditional,
   cite the cost/injection framing) but not the *exact trigger condition*; the policy proposed here is
   derived directly from `askGemini`'s own existing system-prompt language about when search is meant to be
   used, not invented from nothing, but it is still a spec-author judgment call.
3. Item 6's literal interpretation of "neutralise" as "assert nothing, both symptoms addressed by silence" —
   the alternative reading (extend the heuristic to also cover baths, making both directions "warn"
   consistently instead of "silent" consistently) was considered and rejected because it would require
   device-type knowledge the unconfigured branch structurally does not have, but this is a judgment call
   the owner should confirm, not a fact derived from the source documents.
4. **Item 2's scope expansion (the B10 range-phrase fix) and item 7 (the `usageMetadata` rider) were both
   added mid-draft per an explicit coordinator directive, after the 3.6-flash comparison landed** — neither
   is a literal restatement of the owner's original six verbatim decisions. Both are **additions**, reasoned
   and traced above, not waivers of anything already approved; both are called out here, in §0's traceability
   table, and in §6's compact table specifically so the owner reviewing this spec sees them as *proposed*
   scope, not smuggled-in scope. Confirming or rejecting either is the owner's call on spec review, same as
   items 1-3.

**Scope checked against Circle of Control:** two adjacent, real defects were found during this session's
research and are **explicitly not folded into any item's contract** (unlike B10, which — per the coordinator
directive above — *is* now folded into item 2): ULTIMATE E6 (silent managed→BYOK fallback, no toast —
adjacent to item 4) and the B11/B3-02 missing-grounding-data gap (adjacent to item 2, surfaced by the
3.6-flash comparison, explicitly out of scope because no amount of extraction-regex work can fix a grounding
block that simply does not contain the relevant data). Both are named in their relevant item sections above
and repeated here so they are not lost, per §10.6's "findings and surprises belong [in DONE], not buried."

**Nothing in this spec waives, defers, or narrows a charter/ULTIMATE requirement** — every one of the six
owner-approved items is fully specified above with no scope reduction; the range-phrase expansion inside item
2 and the new item 7 are **additions**, explicitly flagged as such (point 4 above), not silent scope creep;
the two remaining adjacent findings (E6, B11/B3-02) were never part of the charter's P0-app row and are
surfaced as candidate *future* gaps, not silently dropped requirements of *this* spec.
