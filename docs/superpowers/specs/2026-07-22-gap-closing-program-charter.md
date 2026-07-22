# Gap-Closing Program — Charter

**Date:** 2026-07-22 · **Status:** awaiting owner approval of this charter
**Baseline audited:** v258 · **Scope:** all 141 gaps in `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`

**Inputs.** The 47-tool, 5-wave discovery sweep (206 confirmed / 42 refuted / 13 unverifiable), plus three
program analyses commissioned 2026-07-22 and committed alongside this charter:
`docs/analysis/program/ARCH-analysis.md` · `SEQ-analysis.md` · `SPEC-reconciliation.md`.

> **This charter is a program-level document. It is not an implementation plan and contains no code.**
> Each phase below decomposes into its own spec → owner approval → plan → subagent-driven build cycle,
> per `docs/process/development-discipline.md` §2. A phase may not begin before its spec is approved.

---

## 1. Owner decisions already taken

| # | Decision | Consequence |
|---|---|---|
| D1 | **Orchestrator last** | Phase 3a solver lands after safety, cost, correctness and structure. Its preconditions (a *visible* `safetyDiff`, one capacity verdict) are built first, so it is built once |
| D2 | **All 141 closed** | Every gap is fixed, or waived by the owner in conversation with the reason recorded. **"Deferred" is no longer a call the assistant can make** (§4) |
| R1 | **Only the 2 safety items of `plan-depth-model` are binding** | The thermometer gate and the cure block become commitments. The other 47 items remain proposals, triaged in Phase P7's home-screen work |
| R2 | **v256 / v257 stamped approved retroactively, and the crossing logged** | `equipment-consumption-layer-design.md` and `scheduler-phase4-spec.md` get an approval stamp; the process failure becomes a lesson (L18) |
| R3 | **Data corrections proceed under a stricter gate**, not DoD §3.10's blanket block | See §5.2 — the Data Correction Gate |
| R5 | **Cross-event allocation waits until after the orchestrator** | The Phase 3a non-goal stands. See §4 P9. **Interim:** the currently-wrong overlap warning is neutralised in P0 |
| R6 | **Bath selection is context-dependent and explicit** | Smallest-that-fits for a single item, largest for a multi-item batch, in **one** shared function. Requires an amendment to the consumption spec |
| R7 | **One new home-screen spec replaces all three** | `fire-guide-ux-refactor-prompt.md`, `home-adaptive-design.md` and `plan-depth-model.md`'s UX half are retired into a single authoritative spec |
| R8 | **Unearned claims corrected now; pricing deferred** | Four marketing claims fixed in this program; the free-vs-paid model is a separate commercial decision |
| R11 | **Offline copy made precise, not binary** | "Catalog, work plan, timers and safety data work without a connection; AI features need one" |

---

## 2. What the program is closing

### 2.1 The real decomposition — 11 subsystems, summing to exactly 141

The audit's 8 bands are a **reporting** taxonomy. Gaps are assigned here to the subsystem where the **fix**
lands. The SAFETY band splinters across five subsystems with five different mechanisms, which is why
*"safety first"* is not by itself an executable instruction.

| | Subsystem | Gaps | Defining property |
|---|---|---|---|
| S1 | Build, data & verification pipeline | 11 | `build.py` contains **zero assertions**; every anomaly is a `print()` |
| **S2** | **Plan pipeline** | **25** | The pipeline is a private closure inside a render function (`app.js:5622`); its only exports are 5 `window` globals |
| S3 | Capacity & occupancy | 15 | A correct shared verdict (`out.fit`) that **2 of 3 consumers bypass** |
| S4 | Identity & scope keyspace | 6 | Four incompatible scope namespaces; key formats duplicated 4–6× as string literals |
| S5 | AI egress | 16 | A transport chokepoint (`gemFetch`) with **no egress chokepoint** |
| S6 | Managed-AI Worker | 9 | Check-then-act; debit taken **after** the spend |
| S7 | Localization | 11 | Two competing translation mechanisms over one DOM |
| S8 | Time & calendar | 3 | Two "day" conventions, neither named |
| S9 | Delivery shell | 13 | **Nothing that ships the app is exercised by any test** |
| S10 | Presentation system | 19 | Colour is tokenised; type, space and radius are not |
| S11 | Commercial | 13 | No code — listed so the arithmetic stays honest |

### 2.2 Honest size

**~9 structural changes + ~55 independent code tasks + ~32 items needing no architecture.**
Not 141 discrete builds; not the 30 an optimistic reading would give.

**Nine common-cause clusters close 54 gaps:** extract the plan pipeline (13) · one capacity verdict (6) ·
scope authority + keyspace schema (6) · AI egress chokepoint (6) · build assertions (6) · Worker bounded
and debit-first (6) · collapse localization (5) · one task identity (3) · one day vocabulary (3).

### 2.3 The specification deficit — the number that shapes the program

Of the 141: **20 are specified-and-unbuilt · 37 are specified-and-built-wrong · 72 are specified nowhere ·
12 contradict an approved spec.**

**Only 40 % have a written clause. 72 gaps have never been specified anywhere.** This program is therefore
*mostly a design programme*, not a backlog burn-down, and its phases are sized accordingly.

---

## 3. Phase −1 · Prerequisites (blocking, ~1 week)

**Four Tier-1 items cannot pass DoD lines 2, 3, 4 or 12 today.** Building them first would violate our own
gate, so the gate gets built first.

| # | Item | Why it blocks |
|---|---|---|
| **PRE-1** | **Parameterize the test port** — one line | `playwright.config.ts` hardcodes `PORT = 8123` with `reuseExistingServer: false`; §11a forbids concurrent runs, so N parallel agents produce N queued runs. **This is the program's first commit** — it unlocks every parallel track |
| PRE-2 | CI on GitHub Actions | Absent. `forbidOnly: !!process.env.CI` is already wired; `build.py` imports only stdlib |
| **PRE-3** | **Worker test harness** | **Hard blocker.** Zero tests reference `worker/index.js`; six P0 items are ungateable |
| **PRE-4** | **Live-model eval harness + incumbent baseline** | **Hard blocker, deadline-bound** — see §6 |
| PRE-5 | Coverage for the 3 grounding validators | `aiValidateKeys / aiValidateItems / aiValidateSeasonings` → 0 test hits, described as "the primary defence for 7 features" |
| PRE-6 | A service-worker-exercisable environment | `app.js:9546` gates on `protocol === 'https:'`, so the whole update-delivery channel is untestable |
| PRE-7 | A **390 × 844** Playwright project | The config declares only Desktop Chrome; **DoD line 8 mandates 390 × 844** and only 2 specs use it |
| PRE-8 | Re-measure the worker ceiling | Pinned at a 324-test measurement; the suite is now 415 declarations (~28 % past it) |

---

## 4. The phases

Each row is a separate spec → approval → plan → build cycle.

| # | Phase | Subsystems | Contents and rationale |
|---|---|---|---|
| **P0** | **Stage 0 — the bleeding** | S5 · S6 · S8 | Guard `vcAskAI` and `vcTranslateToEn` (the only paths where a wrong safety number is **spoken**; both guards already exist, one 1,700 lines away) · make `google_search` conditional (**COGS $1.22 → $0.39 *and* closes hallucination surface #3**) · fix `aiSafetyNums` unit-blindness (74 °F passing as grounded against 74 °C) · Worker fail **closed**, debit-before-forward, rate limit, drop `streamGenerateContent` · route TTS through the managed path · **`addDays` DST fix** (moved up from §7 Step 4: hours of work, **zero** test blast radius, and its error direction *shortens a nitrite cure*) · **neutralise the false cross-event warning** (R5 interim) |
| **P1** | **Model migration** | S5 | The only externally-dated item. Requires PRE-4 |
| **P2** | Safety gates | S2 | Thermometer admission gate; cure task **blocks** without a 0.1 g scale. Binding per R1. `cureScaleGuardHTML`'s thresholds are already correct — only the *effect* is missing |
| **P3** | Monitoring → control | S2 | **Surface `safetyDiff`** — 6 lines from its answer; `_plcConflicts` already shows the way. **Precondition for the orchestrator: an invariant nobody sees cannot gate anything.** Record the `bcheck` *reading*, not just the tick |
| **P4** | Build assertions, **then** data | S1 | **Assertions first (ordering constraint P5):** the mechanism that would silently drop the corrections is the same one that dropped the last 18. Then the R3-gated data corrections, the `calc.cure` key collision, and the silent `except ImportError: pass` that would drop all 279 citations **and** 130 cuts' grill path with no message |
| **P5** | Structural boundaries | S2 · S3 · S4 | Extract the plan pipeline from its render closure · **one** capacity verdict · migration registry (blocks the re-keying work) · keyspace schema · one task identity · one day vocabulary. **Track S runs alone** — see §7 |
| **P6** | Localization | S7 | Hebrew-leak assertion **first** (ordering constraint P9) — it is the only regression net for changing how every string is translated. Then collapse the two competing mechanisms |
| **P7** | Product surface | S9 · S10 | **Opens with the new home-screen spec (R7)**, which consumes R1's 47 deferred `planDepth` proposals so the triage happens once. Then delivery shell and presentation tokens |
| **P8** | **Orchestrator** | S2 · S3 | Phase 3a: `orchestrate`, `movesForClash`, `applyMove`, `safetyGate`, the hold-safety spine. **Requires P3 and P5.** Last, per D1 |
| **P9** | Cross-event allocation | S2 · S3 | Per R5, after the orchestrator, as its generalization. Formally reverses the Phase 3a non-goal — recorded, not silent |
| **P10** | Commercial | S11 | Claims corrected in P0/P2 as they become true; pricing and tiering deferred per R8 |

---

## 5. Gates

### 5.1 Every task passes the 12-point DoD in `CLAUDE.md` §3

No exceptions, including *witnessed RED*, a **named production consumer** for any computed value, a
screenshot at **390 × 844** for any UI change, and a full green suite with no `--retries` and no
`--workers=1`.

### 5.2 The Data Correction Gate (new, per R3)

DoD §3.10 forbids altering a shipped `safe`, cure or salt value. That rule exists to stop **incidental
drift**, not deliberate sourced correction. Data corrections therefore proceed under a gate that is
**stricter** than the blanket block:

1. The **primary citation quoted in full**, with its URL, fetched and re-read in this session.
2. **Old and new value side by side**, with the unit and the derived ppm or g/kg where applicable.
3. The **direction of risk** stated explicitly (does this raise or lower a safety margin?).
4. **Owner sign-off per value.** Not per batch.
5. A regression test asserting the new value, and the citation ID that justifies it.

Applies to: Kabanos (`spec-10`) cure type · the 18 researched salt overrides · the three offal 65 °C floors.

### 5.3 The Waiver Gate stands (§4)

Any requirement that cannot be met is raised **in conversation** with the spec text and the reason.
Recording it in a document does not count as raising it. Per D2, this now includes anything the assistant
would otherwise call "deferred".

---

## 6. The one externally-set date

`gemini-2.5-flash` shuts down **2026-10-16**.

**The binding constraint is not the flip — it is the baseline.** You cannot tell whether the replacement
regressed without a recorded measurement of the incumbent, and **the incumbent disappears with the
deadline. No baseline exists anywhere in the repo.**

| Date | Milestone |
|---|---|
| **2026-08-05** | PRE-4 starts (recommended) — P0's guard changes alter what the model is asked and how its output is judged, so without a live harness those ship blind too. One harness, two payoffs |
| 2026-08-25 | Latest safe start for PRE-4 |
| 2026-09-01 | Incumbent baseline recorded |
| 2026-09-08 | Migration task begins |
| 2026-09-15 | Latest safe flip — leaves ~4 weeks with both models live, so a regression is diagnosable against the incumbent |
| 2026-10-16 | Shutdown |

**Correction to the audit:** §7 proposes validating the migration with `tests/ai-trust.spec.ts`. That file
**stubs `window.gemFetch` and asserts on the outgoing prompt body** — it never calls a model and would pass
identically against a broken one. Also, *"one constant"* is **two**: `app.js:5030` carries a model literal.
Rollback is a single constant — the migration's best property, which §7 does not mention.

---

## 7. Parallelism

After PRE-1 lands, up to **3–4 tracks** run concurrently:

- **Track W — Worker.** Separate deploy target, zero app-side overlap. The cleanest track in the program.
- **Track D — dates.** Zero test overlap.
- **Track G — copy and claims.** Zero test overlap.
- **Track S — capacity.** **Runs alone.** Blast radius is 22 + 14 + 6 + 4 spec files; a red suite becomes
  unattributable.

Strictly serial: PRE-3 → Worker items · PRE-4 → baseline → migration · P3 → P8 · P5 → P8 → P9 ·
build assertions → data corrections · Hebrew-leak assertion → localization collapse.

---

## 8. Corrections this charter makes to its own source

The ULTIMATE document was wrong 42 times out of 261 by its own verification wave. Three further
corrections, verified independently for this charter:

1. **The `typeof` thesis is refuted.** W1-A's #1 finding — 483 guards acting as "a de-facto module system
   where a broken wire-up silently no-ops" — does not hold. **475 of 483 guard a top-level `function`
   declaration inside the single `<script>` `build.py` emits**, so they are hoisted and can never be false
   (`toast` alone is guarded 49 times). **Zero of the five documented inert-shipment cases involves a
   guard.** *Do not fund a guard sweep as boundary work.*
2. **The date collision at `app.js:3550` is refuted** — both sides of that comparison are UTC. The real
   seam is UTC-written pantry/reminder dates against local-written serve dates.
3. **`choosePlate` / `chooseNozzle` are tested** (`tests/equip-chooser.spec.ts`); they lack production
   callers, not coverage. Only `svBaths` is both uncalled and untested.

The boundary thesis itself **holds on 4 of its 5 named instances**, and the analysis added a sixth the
sweep missed: the keyspace has no schema — `'mk-plan-started-'` appears at 6 sites, four of which
reverse-engineer the format by prefix-scanning `localStorage`.

**The codebase's characteristic defect is not missing structure. It is structure built correctly and then
bypassed by one consumer, seven times over** — and its own detector already exists in `safetyDiff`. Four
values deserve that treatment: the capacity verdict, the serve instant, the day key, and the active
methods. Four assertions, not a refactor.

---

## 9. Definition of done for the program

1. All 141 gaps closed or explicitly waived by the owner, with each waiver's reason recorded.
2. No gap closed without a test that fails before the fix and passes after.
3. `npx playwright test` green, plain, with the worker ceiling re-measured for the grown suite.
4. CI running that suite on every push.
5. The live site verified with Playwright after each release (§10.10) — version stamp **and** a feature
   probe.
6. Every retired document removed or marked superseded; every surviving spec's status line matching
   reality.
7. The knowledge graph current, `--mode deep`, covering documents and code.
