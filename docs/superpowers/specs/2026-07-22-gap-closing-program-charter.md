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

### 1.1 Charter-review decisions (owner, 2026-07-22)

Taken after the owner reviewed the six points where the assistant judged itself most likely to be wrong.

| # | Decision | Consequence |
|---|---|---|
| D3 | **P0 splits into P0-app and P0-worker** | The original P0 was 8 workstreams sized at "one week" — an underestimate, and its worker half is blocked by PRE-3 while its spoken-guard half is not. Two deploys, each independently revertible |
| D4 | **All of Phase −1 completes before any gap closes** | Owner chose the stricter path *against* the assistant's recommendation of a minimal-infrastructure fast path. The spoken-AI guards wait for the full harness. Rationale: this project has shipped inert code three times, and the harness is what stops a fourth |
| D5 | **The plan-pipeline extraction gets its own spec and its own phase** | Promoted out of a table row in P5 to phase **P5a**. Requires a compatibility shim for the 5 `window` globals and **`safetyDiff` as an equivalence oracle** proving the extracted pipeline yields an identical plan |
| D6 | **The capacity unification ships only after a before/after review** | Build it, render the same real plan under the old and new rules, show both, get explicit sign-off. It is a user-visible behaviour change and therefore an owner decision under §4 |
| D7 | **Rough envelope now, firm estimate at each spec gate** | See §10 |
| D8 | **The whole suite standardizes on 390 × 844** | One dedicated task converts every ad-hoc viewport (390×900 ×7, 390×820 ×7, 390×844 ×2, 390×780 ×2, 390×1000 ×1). Whatever breaks is treated as a real finding. Suite runtime unchanged; DoD line 8 satisfied by default thereafter |

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
| PRE-7 | **Standardize the whole suite on 390 × 844** (D8) | The config declares only Desktop Chrome; **DoD line 8 mandates 390 × 844** and only 2 specs use it. Convert every ad-hoc viewport in one task and fix what breaks — expect a batch of layout failures on the first run, and treat them as findings, not noise |
| PRE-8 | Re-measure the worker ceiling | Pinned at a 324-test measurement; the suite is now 415 declarations (~28 % past it) |

---

## 4. The phases

Each row is a separate spec → approval → plan → build cycle.

| # | Phase | Subsystems | Contents and rationale |
|---|---|---|---|
| **P0-app** | **Stage 0 — the spoken bleeding** | S5 · S8 | Guard `vcAskAI` and `vcTranslateToEn` — **the only paths where a wrong safety number is spoken** to a cook with busy hands and no visible caveat; both guards already exist, one 1,700 lines away · fix `aiSafetyNums` unit-blindness (74 °F passing as grounded against 74 °C) · make `google_search` conditional (**COGS $1.22 → $0.39 *and* closes hallucination surface #3** — the best ratio in the document) · route TTS through the managed path · **`addDays` DST fix** (moved up from §7 Step 4: hours of work, **zero** test blast radius, and its error direction *shortens a nitrite cure*) · **neutralise the false cross-event warning** (R5 interim — it false-flags two events on different smokers and stays silent on two sharing one bath) |
| **P0-worker** | Stage 0 — the meter | S6 | Fail **closed** on a malformed KV record (today it yields `{active:true}` with no cap — unmetered spend on the owner's key) · debit **before** forwarding · per-code rate limit · drop `streamGenerateContent` from the router until metering handles it · tighten CORS. **Blocked on PRE-3** |
| **P1** | **Model migration** | S5 | The only externally-dated item. Requires PRE-4 |
| **P2** | Safety gates | S2 | Thermometer admission gate; cure task **blocks** without a 0.1 g scale. Binding per R1. `cureScaleGuardHTML`'s thresholds are already correct — only the *effect* is missing |
| **P3** | Monitoring → control | S2 | **Surface `safetyDiff`** — 6 lines from its answer; `_plcConflicts` already shows the way. **Precondition for the orchestrator: an invariant nobody sees cannot gate anything.** Record the `bcheck` *reading*, not just the tick |
| **P4** | Build assertions, **then** data | S1 | **Assertions first (ordering constraint P5):** the mechanism that would silently drop the corrections is the same one that dropped the last 18. Then the R3-gated data corrections, the `calc.cure` key collision, and the silent `except ImportError: pass` that would drop all 279 citations **and** 130 cuts' grill path with no message |
| **P5a** | **Plan-pipeline extraction** | S2 | **Its own spec and its own phase (D5)** — the riskiest single change in the program. 413 tests reach the pipeline only through the DOM and 5 `window` globals. Requires a compatibility shim for those globals and **`safetyDiff` as an equivalence oracle**: the extracted pipeline must produce a byte-identical plan before anything is removed. Closes 13 gaps |
| **P5b** | Remaining structural boundaries | S3 · S4 | **One** capacity verdict — **ships only after the before/after review (D6)** · migration registry (blocks the re-keying work) · keyspace schema · one task identity · one day vocabulary. **Track S runs alone** — see §7 |
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

## 10. Timeline envelope (D7 — deliberately wide, superseded phase by phase)

**This is an envelope, not an estimate.** A firm, defensible number is produced at each phase's spec gate,
where the tasks are actually enumerated. Anyone quoting the figures below as a commitment is misreading
them.

**What is countable:** ~60–70 DoD-gated code tasks, plus Phase −1's 8–12. Each carries the real gate cost
— witnessed RED, GREEN, a full suite run (3–5 runs per task, ~3 min each at the current 415 tests), review
and fix loops.

**What is not countable:** **72 of the 141 gaps are specified nowhere.** They need roughly **8 design
cycles** (brainstorm → spec → owner approval → plan), and a design cycle's length is set almost entirely by
how many review rounds it takes — which depends on the owner, not the assistant.

| Segment | Envelope | Confidence |
|---|---|---|
| Phase −1 | ~1 week | **High** — the tasks are known and small; PRE-1 is one line |
| P0-app + P0-worker | 1–2 weeks | Medium-high — mostly wiring guards that already exist |
| P1 migration | 2–3 weeks, **anchored to §6's dates** | Medium — the harness is new work, the flip is one constant |
| P2 + P3 + P4 (safety gates, monitoring→control, data) | 3–5 weeks | Medium — P4 carries per-value owner sign-off |
| P5a + P5b (structural) | 4–8 weeks | **Low** — P5a is the riskiest change in the program |
| P6 + P7 (localization, product surface) | 4–8 weeks | **Low** — contains most of the 72 unspecified gaps and the new home-screen spec |
| P8 + P9 (orchestrator, cross-event) | 4–6 weeks | Low — fully specified, but large |
| P10 commercial | deferred | — |

**Calendar reading: roughly August through November/December 2026**, with Phase −1, P0 and P1 forced into
place by the 2026-10-16 shutdown. The back half is where the range is widest, and honestly so.

**The three things that would move this most:** how many review rounds the 8 design cycles take · whether
P5a's equivalence oracle works first time or forces a rethink · whether standardizing on 390 × 844 (D8)
surfaces a handful of layout failures or a wave of them.

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
