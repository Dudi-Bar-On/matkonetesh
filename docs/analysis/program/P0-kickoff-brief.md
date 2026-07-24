# P0 kickoff brief — reconciling the gap-closing programme after the infrastructure detour

**Date:** 2026-07-24 · **Status:** EVIDENCE PACK for the owner's brainstorm — **contains no design decisions**.
**Purpose:** the gap-closing programme (`docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md`,
`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`) paused for a ~2-day AI-model-migration +
test-infrastructure arc. This brief reconciles what that arc actually closed, confirms P0-app's scope is
untouched and ready to start, and lays out what the owner's brainstorm needs to decide before a P0-app spec
can be written. **No fix is proposed or chosen here** — that is `brainstorming`'s job, gated per
`docs/process/development-discipline.md` §2.

**Reconciliation window:** `git log bfb3e9a..HEAD` (65 commits). Where a fact predates that window it is
labelled "pre-existing" rather than credited to the detour.

---

## 0. Headline counts

| | Count | Items |
|---|---|---|
| **CLOSED** | 4 numbered items + 1 unnumbered structural fix | E1 (text+TTS shutdown risk), PRE-4 (eval harness + baseline), PRE-8 (worker-ceiling re-measurement), ULTIMATE §3.B item 23 (serve.js fork-crash loop), + the loopback nav-flake root-cause fix that makes the other three durable |
| **PARTIAL** | 1 | P1 Model migration — deadline risk retired and shipped, but PRE-4's own designed "no-regression" comparative bar was not run against the replacement, and two related verifications are explicitly open |
| **NEW** | 3 | App heap leak (~2.5 MB/reload, no plateau) · R11 re-confirmed still open · the 3.6-flash thinking-cost check |
| **P0-app scope** | 0 of 6 items touched | Verified by diffing every `app.js` commit in the window against P0-app's named functions — see §4 |

---

## 1. Reconciliation table — CLOSED

| Item | ID | Evidence |
|---|---|---|
| **Text model's 2026-10-16 shutdown risk** | ULTIMATE **E1** | `app.js` `GEM_MODELS.text.id` is now `'gemini-3.6-flash'` (confirmed live at HEAD and in the release commit `b59e642:app.js`). Shipped as **מהדורה 261** (`b59e642`, 2026-07-23): *"Preflight PASSED live (CI run 30012898000): both ids listed + one real call per role through the app's own builders… Full suite 433/433."* Rollback stays one line — a commented `textLegacy` row pins the old id (`app.js`, adjacent to `GEM_MODELS`). |
| **Second, independent TTS model literal** (flagged by PRE-4's own design doc as a second, easy-to-miss shutdown-risk literal — not its own ULTIMATE gap ID) | — | `gemini-2.5-flash-preview-tts` → `gemini-3.1-flash-tts-preview`, commit `a400230`. Same registry mechanism (`GEM_MODELS.tts`), same preflight. |
| **PRE-4 — Live-model eval harness + incumbent baseline** | charter Phase −1 **PRE-4** | Harness: `evals/` (`lib/runner.ts`, `lib/scorers.ts`, `lib/prompts.ts`, `lib/preflight.ts`, `tests/*.spec.ts`), `npm run eval` → `playwright test --config evals/playwright.config.ts` (`package.json:11`). CI gate: `.github/workflows/eval.yml` — `workflow_dispatch`-only, never push/PR, matching the design's §8 recommendation exactly. Baseline: `docs/analysis/program/eval/baseline-gemini-2.5-flash-2026-07-23.{json,md}` — 3 grounding cases, 16 safety/refusal cases, 5 freeform cases, committed per the design's §10 ("the raw baseline output... cannot be regenerated after a fixed calendar date"). **Timing note:** the harness-build and baseline-bank commits (`495c946`, `dd0f2de`, `abf81ed`) land just *before* `bfb3e9a`; the CI-integration/preflight commit (`1cabce9`) is inside the window. Same continuous arc, called out for precision. |
| **PRE-8 — Re-measure the worker ceiling** | charter Phase −1 **PRE-8** | Charter text: *"Pinned at a 324-test measurement; the suite is now 415 declarations (~28% past it)."* Now: **439 tests in 86 files** (verified live via `npx playwright test --list`, this session). Full re-derivation in `docs/research/measurements/m1b-capacity-probes-2026-07-23.md`'s POST-LOOPBACK-FIX session — a clean 12/16/20/24-worker curve, then **workers=20 certified 8/8 clean** (1 curve-probe reading + a 7-run campaign, 53.3–54.9s Playwright-reported on the fast cluster). Config promoted: `playwright.config.ts:36` `workers: process.env.CI ? 2 : 20` (commit `7fcc4e1`, *"pin workers=20, promote canary geometry to shipped production"*). |
| **`serve.js` fork-crash loop** | ULTIMATE **§3.B item 23** (*"cluster.on('exit', () ⇒ cluster.fork()) — no backoff, no health gate… 1,146 crash-restarts in 6 s"*) | De-clustered to a single in-memory process (commit `77cd4c7`, *"de-cluster serve, domcontentloaded, workers=8"*). Current `serve.js:4-9` comment names the exact anti-pattern removed: *"cluster.on('exit', () => cluster.fork()) respawn (no exitedAfterDisconnect guard)."* Also closes **L18** (the respawning-zombie-server lesson in `CLAUDE.md` §11a). |
| **Nav-timeout flake — root cause** (not a numbered ULTIMATE gap; discovered *after* the 2026-07-22 sweep, during this arc's own test-infra work — but it is the mechanism that makes PRE-8's number durable and DoD line 12 ("full suite green… any failure is a bug") achievable at the certified worker count) | — | `docs/research/flake-refactor-rootcause.md`: root cause **PROVEN by cure** — the Windows/chromium loopback HTTP connection layer serializes concurrent local navigations under N≳4 concurrent `page.reload`, releasing requests to `serve.js` in a multi-second staircase while the machine sits ~85% idle. Fix: `context.route` fulfills `/index.html` from an in-memory Buffer instead of a real loopback connection (commits `7d5402d`, `f74f1b8` — the L19 firing-guard test). **Independently reviewed and APPROVED**: `docs/research/flake-refactor-review.md` (commit `ba1da6a`, *"root cause CONFIRMED, refactor APPROVED"*). |

## 2. Reconciliation table — PARTIAL

| Item | ID | Status and evidence |
|---|---|---|
| **P1 — Model migration** | charter **P1** (*"The only externally-dated item. Requires PRE-4."*) | **What's closed:** the deadline risk (E1, above) is retired, and the migration **shipped** — well ahead of the charter's own §6 schedule (baseline banked + flip both landed 2026-07-23, vs. the charter's 2026-09-01/09-08/09-15 targets). **What's still open, found by reading the harness's own acceptance bar against what actually ran:** (a) PRE-4 design §7 defines a "no regression" comparative bar — grounding drop-count deltas, a **zero-ungrounded-numbers** bar held across repeats, and guard-extraction-rate parity, scored by a second live run against the *replacement* model. That comparative run was **not executed**; the ship decision was gated by a narrower check — `evals/lib/preflight.ts` (ListModels + one real call per role, confirming the endpoint exists and returns the right shape), not the full 24-case scorecard. (b) `docs/analysis/program/gemini-3.6-thinking-research.md`'s own **"What could NOT be verified"** section: *"Production `thoughtsTokenCount` under `minimal` on the app's hardest grounded/extraction prompts — measured 0 on a short arithmetic prompt… may be small-but-nonzero on complex prompts per Google's own caveat. Not yet probed with a real app payload."* (c) The ULTIMATE doc's §3.H unit-economics figures (persona costs $0.27–$2.83/mo, the $4.99–$7.99 price-floor recommendation) are computed against `gemini-2.5-flash` pricing and have **not** been re-run against `gemini-3.6-flash`'s base tier, which the same research doc states plainly is *"~5× input and ~3× output per token vs 2.5-flash… even with thinking neutralized"* (line 122) — see §5 New item 3 below. |

## 3. Reconciliation table — NEW (register into the ledger)

| Item | Evidence |
|---|---|
| **App heap leak — renderer JS heap grows ~2.5 MB/reload, no plateau observed** | Raw data: `docs/research/measurements/w0-2026-07-23T19-06-51-827Z.json`, `armResults.*.heapSamples` — all **4** tested serving configurations (`warm-ephemeral@200/304`, `warm-persistent@200/304`) show near-identical growth: `jsHeapUsedSize` **9.51 MB → 137.6 MB over 50 reloads** (iterations 0/10/20/30/40/50), with per-10-reload deltas of 24.1–28.0 MB throughout — i.e. **~2.4–2.8 MB per reload, consistently, with no sign of leveling off** in the measured window. Already named in prose, not just raw JSON: `docs/research/flake-panel-SYNTHESIS.md:28-30` — *"Renderer heap growth ~2.5 MB/reload, no plateau (A, tracing-off) — a REAL app-side leak worth its own investigation, but B found no late-run failure pattern, so at today's suite length it is not the flake driver. Filed as an app bug lead."* — and explicitly queued at line 52: *"F4 \| App heap-leak hunt (2.5 MB/reload) \| The long-term health item \| separate task (app-side, Serena-ready)."* **It was never actually filed into the charter or the ULTIMATE ledger** — this brief is that filing. Scoping caveat, stated plainly: the measured pattern is a *reload*-driven accumulation (the test harness's own access pattern — `seedApp`'s `localStorage.clear → page.reload`), not yet shown to be equivalent to what a single long-running user session (the real product's own usage shape, a multi-hour live cook) would accumulate — that equivalence is itself the first open question the app-side investigation needs to answer, not assumed here. |
| **R11 — still open** (*"Offline copy made precise, not binary… 'Catalog, work plan, timers and safety data work without a connection; AI features need one.'"*) | Confirmed unfixed at current HEAD (מהדורה 261): `build.py:334` — `<div class="footnote">...הנתונים מקומיים, ללא חיבור לרשת...</div>` — byte-for-byte the same defect ULTIMATE §3.G item 1 described at v258 (*"the footer... on every screen"*, deliberately translated into English at `lang/en.json:261`, plus `app.js:3929/3931/3939` and `README.md:4`). Zero commits in the `bfb3e9a..HEAD` window touch `build.py`, `app.js`'s marketing strings, or `README.md`. R11's decision is recorded but not implemented anywhere. |
| **The 3.6-flash thinking-cost check** | Two distinct open verifications, both sourced from `docs/analysis/program/gemini-3.6-thinking-research.md`: **(a)** production `thoughtsTokenCount` under `thinkingLevel:'minimal'` was measured **0** only on a *"short arithmetic prompt"* — the document's own words: *"a follow-up probe using a real app prompt (grounding payload + JSON schema) would tighten the production number… the exact production thinking-token count on the hardest prompts is not [verified]"* (line 125). This matters because `AI_THINK` (`app.js`) sets several usages **above** `minimal` in production — `diagnose:'high'`, `ask:'low'`, `vcAsk:'low'`, `eventPlan:'medium'`, `vision:'low'` — none of which have been cost-probed against a real payload. **(b)** Even at `minimal`, the base per-token price moved: *"gemini-3.6-flash — $1.50/1M in, $7.50/1M out"* vs *"gemini-2.5-flash — $0.30/1M in, $2.50/1M out"* — a **3–5×** increase the document itself flags as *"a business/pricing decision… the honest headline for the owner"* (line 122). This directly stales the §3.H unit-economics figures referenced in §2's PARTIAL row above — same underlying gap, cross-referenced rather than double-counted. |

## 4. P0-app is untouched — verified, not assumed

Every `app.js` commit in the reconciliation window was diffed against P0-app's six named functions/behaviours:

```
git log bfb3e9a..HEAD --oneline -- app.js   → 9 commits, ALL are AI-model-registry/migration work
git log bfb3e9a..HEAD -p -- app.js | grep for aiSafetyNums / addDays / vcAskAI / askRefuse /
                                              combinedEventsRows / aiUngroundedSafety additions → 0 hits
git log bfb3e9a..HEAD --oneline -- worker/  → 0 commits (worker/ untouched entirely)
```

Confirmed directly in the current source (this session):

- `app.js:4340` `tools:[{google_search:{}}]` — **still unconditional** at `askGemini`. (Line `4445`'s `aiJSON` path was *already* conditional before this arc — `tools: search?[{google_search:{}}]:undefined` — that's pre-existing, not new.)
- `app.js:5111-5130` `gemSpeak` — **still gates on `const key=gemKey(); if(!key) throw new Error('no-key')`**, i.e. still BYOK-only; TTS does not route through the managed path.
- `aiSafetyNums`/`aiUngroundedSafety` (now at `app.js:4391`/`4397`) — regex and comparison logic byte-identical to what the ULTIMATE doc describes; still unit-blind.
- `addDays` (`app.js:2790`) — unchanged; the DST bug (ULTIMATE **A9**) is still live.
- `combinedEventsRows` (now at `app.js:7915`) — unchanged; the false cross-event warning still fires as described.
- `vcAskAI`/`vcTranslateToEn` — unchanged in substance; **relocated** (see below).

**Line-number drift, measured (not assumed).** The AI-registry insertion (`GEM_MODELS`/`AI_THINK`/`gemGen`/`gemThink`, roughly `app.js:4205-4266`) pushed every downstream citation the charter/ULTIMATE docs used:

| Function | ULTIMATE citation (v258) | Current (HEAD, this session) | Drift |
|---|---|---|---|
| `aiSafetyNums` | `4302-4306` | `4391` | +89 |
| `aiUngroundedSafety` | `4308-4312` | `4397` | +89 |
| `vcTranslateToEn` | `5186`/`5196` | `5269` | +83 |
| `vcAskAI` | `5269-5300` | `5352` | +83 |
| `combinedEventsRows` | `7832-7887` | `7915` | +83 |
| `addDays`, `askRefuse` | `2790`, `4197` | `2790`, `4197` | **0** (both sit before the insertion point) |

Whoever writes the P0-app spec next should re-locate these functions (`Grep`/Serena `find_symbol`, not the charter's line numbers) before citing exact ranges in the spec. `app.js` is now 9,648 lines (was 9,564 at v258).

## 5. What's already in place — assets P0 builds on

- **The eval harness (`evals/`) and the banked incumbent baseline.** One **full** baseline exists —
  `gemini-2.5-flash`, 24 cases, committed `docs/analysis/program/eval/baseline-gemini-2.5-flash-2026-07-23.{json,md}`.
  **Precision, not the framing in the original task brief:** there is *not* a second, equally-full `3.6-flash`
  baseline — the model flip was gated by the narrower preflight (§2, PARTIAL row). What the banked baseline
  *does* give P0-app directly: a **pre-fix reference point for gap A3** (the unit-blindness fix). Three of
  the 16 banked safety cases already show the guard's raw behaviour on exactly the carve-out class A3 concerns
  — `B11` ("what temp kills botulism") recorded `ungrounded=[85,80,100,115,121,120,160,121,121,115,121,85]`;
  `B2-02` (a Fahrenheit-phrased doneness question) recorded `ungrounded=[165,165,82,180]`; `B3-02` (the Hebrew
  parity case) recorded a similar list. **P0-app's A3 task can re-run this exact case set post-fix and diff
  against these banked lists** — a real regression baseline, not a from-scratch fixture build.
- **The AI registry / `AI_THINK` seam** (`app.js`, `GEM_MODELS`/`gemModel`/`gemId`/`gemGen`/`gemThink`/`AI_THINK`/`thinkFor`,
  confirmed live via Serena `find_symbol` this session — see `docs/process/serena-first-use.md`). P0-app's
  `google_search`-conditional item and TTS-routing item both touch code adjacent to this seam
  (`askGemini`'s body at `app.js:4340`, `gemSpeak` at `5111`) — the registry did not implement either fix, but
  it is the seam through which a routing/capability toggle would naturally be expressed (`caps.search`,
  `caps.audio` already exist as per-role metadata in `GEM_MODELS`).
- **Serena, live and verified for `app.js` work.** `docs/process/serena-first-use.md`: JS/TS on `app.js`
  "fully reliable, including on the ~9.6k-line app.js monolith" — `find_symbol`, `get_symbols_overview`,
  `get_diagnostics_for_file` all verified working and fast; cross-file reference search across `tests/*.ts`
  fixed via a root `tsconfig.json` (234 cross-file references now found for a probe symbol, was `{}` before).
  All 8 configured languages (including Python for `build.py`, relevant to the R11 fix) are active and indexed.
- **The 54-second suite.** `docs/research/measurements/m1b-capacity-probes-2026-07-23.md` POST-LOOPBACK-FIX
  Phase 2: **workers=20, 7/7 clean, 53.3–54.9s** (Playwright-reported) per run; 439 tests, 86 files. This is
  the suite P0-app's own tasks will run against for DoD line 12 — materially faster and more reliable than
  what existed when the charter was written.
- **The Data Correction Gate and Waiver Gate are unaffected** — nothing in this arc touched a `safe`, `temp`,
  or cook-duration value, and no charter requirement was waived; the reprioritization itself is an open
  question for §6, not a silent deviation (see Q1).

## 6. Open questions for the owner's brainstorm

**Q1 — Reprioritize back to P0-app now, or continue the current arc's momentum?**
The ULTIMATE doc's own §7 "Recommended closing order" states: *"Do not defer any of these [P0-app's items]
behind the model migration. They are independent."* The actual order executed was the opposite for this
window — migration and test-infra first, P0-app's six items still at zero. This does not breach the Waiver
Gate (P0-app and P1 share no dependency in either direction per the charter's own §7 parallelism table, and
the migration carried a hard external deadline), but it is a real deviation from the documented
recommendation, and P0-app contains the programme's only 🔴-Critical, still-open SAFETY items (A1, A2, A3 —
spoken, unguarded, safety-adjacent AI paths). Does the owner want P0-app to become the immediate next spec, matching the original intent?

**Q2 — P0-app has no spec yet. One spec covering all six items, or split by blast radius?**
P0-app currently exists only as one row in the charter's phase table — no spec has been through
`brainstorming` → owner approval yet (per `development-discipline.md` §2, no plan may be written before that
happens). §4 above shows the six items cluster into roughly three blast-radius groups (Voice Cook guards;
the numeric-guard fix; search-conditionality, which cross-cuts into the Voice Cook group; TTS routing;
`addDays` — charter's own words, "zero test blast radius"; the cross-event warning). Single spec, or several
narrower ones?

**Q3 — Close PRE-4's own regression bar before or alongside P0-app?**
The eval harness was built specifically to prove "no regression" on a model swap (§2, PARTIAL row), and that
comparative run (~$2.50 per the design's own cost table) was never executed against the model now live in
production. Worth doing now — while the harness and the exact banked baseline are fresh — or is the
narrower preflight's live-CI pass (§1) sufficient closure for this programme's purposes?

**Q4 — Where does the new heap-leak finding (§3) enter the programme?**
It is not one of the 141 original gaps (a long-running-memory profile was never part of the original sweep).
Charter decision D2 says "all 141 closed... deferred is no longer a call the assistant can make" — but this
item sits outside that count entirely. Does it become gap #142 inside an existing phase (P7 Product
surface? a new performance band?), get its own small phase, or wait until its scoping question (§3's
reload-vs-session-equivalence caveat) is answered first?

**Q5 — Bundle R11 (offline-copy precision) into the next available spec, or leave it for P7?**
It is a small, isolated, four-site text/copy fix (`build.py:334`, `app.js:3929/3931/3939`, `README.md:4`) with
no safety exposure — the charter's own P7 row ("Product surface... claims corrected in P0/P2 as they become
true") suggests P0/P2 as a candidate landing point, not only P7's home-screen work.

## 7. Recommended task shape (structural only — no fixes chosen here)

- **First step is process, not code:** P0-app needs a `brainstorming` pass and an approved spec before any
  `writing-plans` work starts (§2 above) — none of the pipeline's gates have been entered yet for this phase.
- **Candidate task boundaries**, by shared file/blast-radius (grouping only — sequencing and actual fixes are
  the spec's job):
  1. Voice Cook guards — `vcAskAI` (`app.js:5352`) + `vcTranslateToEn` (`app.js:5269`) — same module, the
     charter notes the correct guard pattern already exists ~1,700 lines away (`askRefuse`/`aiSafetyNote` for
     the first, `mtGuard`/`mtSafe` for the second).
  2. The numeric-guard unit-fix — `aiSafetyNums`/`aiUngroundedSafety` (`app.js:4391`/`4397`) — self-contained;
     has a ready-made pre/post regression set via the banked baseline's B11/B2-02/B3-02 cases (§5).
  3. `google_search` conditionality — two call sites (`askGemini` `app.js:4340`, `vcAskAI`), cross-cuts with
     group 1.
  4. TTS routing — `gemSpeak` (`app.js:5111`), self-contained, sits in code the migration already touched
     this arc (re-read current state before editing, not the charter's citation).
  5. `addDays` DST fix (`app.js:2790`) — charter's own words, "zero test blast radius" — candidate to open
     the phase with a fast, isolated win.
  6. Cross-event warning neutralization — `combinedEventsRows` (`app.js:7915`), self-contained.
- **Reuse, don't rebuild:** the banked 2.5-flash eval baseline (§5) is a ready-made "before" state for group 2
  specifically — re-running the same 16 safety/refusal cases post-fix and diffing the `ungrounded` lists is
  cheaper and more rigorous than a new fixture.
- **Gates unchanged:** CLAUDE.md §3's 12-point DoD and the charter's §5.1/§5.3 gates apply exactly as written
  (quoted in full below) — nothing about this arc changes what "done" means for P0-app.

---

## Appendix A — P0-app's scope, quoted verbatim from the charter

`docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md`, §4 "The phases" table:

> | **P0-app** | **Stage 0 — the spoken bleeding** | S5 · S8 | Guard `vcAskAI` and `vcTranslateToEn` — **the
> only paths where a wrong safety number is spoken** to a cook with busy hands and no visible caveat; both
> guards already exist, one 1,700 lines away · fix `aiSafetyNums` unit-blindness (74 °F passing as grounded
> against 74 °C) · make `google_search` conditional (**COGS $1.22 → $0.39 *and* closes hallucination surface
> #3** — the best ratio in the document) · route TTS through the managed path · **`addDays` DST fix** (moved
> up from §7 Step 4: hours of work, **zero** test blast radius, and its error direction *shortens a nitrite
> cure*) · **neutralise the false cross-event warning** (R5 interim — it false-flags two events on different
> smokers and stays silent on two sharing one bath) |

§1.1, decision D3 (why P0-app exists as its own split):

> **D3 | P0 splits into P0-app and P0-worker | The original P0 was 8 workstreams sized at "one week" — an
> underestimate, and its worker half is blocked by PRE-3 while its spoken-guard half is not. Two deploys,
> each independently revertible**

## Appendix B — the DoD lines that govern P0-app, quoted verbatim

`docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md`, §5 "Gates":

> ### 5.1 Every task passes the 12-point DoD in `CLAUDE.md` §3
>
> No exceptions, including *witnessed RED*, a **named production consumer** for any computed value, a
> screenshot at **390 × 844** for any UI change, and a full green suite with no `--retries` and no
> `--workers=1`.

> ### 5.3 The Waiver Gate stands (§4)
>
> Any requirement that cannot be met is raised **in conversation** with the spec text and the reason.
> Recording it in a document does not count as raising it. Per D2, this now includes anything the assistant
> would otherwise call "deferred".

**Note:** §5.2 (the Data Correction Gate) does not apply — P0-app touches no `safe`/cure/salt value. No
P0-app-*specific* Definition of Done exists yet beyond these charter-wide gates plus `CLAUDE.md` §3's 12
points — a phase-specific DoD section is written as part of its own spec (`development-discipline.md` §2's
pipeline), which has not happened yet (Q2 above).

## Appendix C — evidence index (files read/verified to produce this brief)

- `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` (full read)
- `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` (full read, all 8 sections)
- `docs/analysis/program/model-selection-architecture-design.md` (full read)
- `docs/analysis/program/PRE-4-eval-harness-design.md` (full read)
- `docs/analysis/program/gemini-3.6-thinking-research.md` (full read)
- `docs/analysis/program/eval/baseline-gemini-2.5-flash-2026-07-23.{json,md}` (full read)
- `docs/research/measurements/m1b-capacity-probes-2026-07-23.md` (full read)
- `docs/research/flake-refactor-rootcause.md` (full read)
- `docs/research/flake-panel-SYNTHESIS.md` (full read)
- `docs/research/warm-page-architecture-research.md` (relevant sections)
- `docs/research/measurements/w0-2026-07-23T19-06-51-827Z.json` (parsed programmatically — `armStats`,
  `gate`, `armResults.*.heapSamples`)
- `docs/process/serena-first-use.md` (full read)
- `docs/process/development-discipline.md` (full read)
- `app.js` (current HEAD — `GEM_MODELS`/`AI_THINK` region, `askGemini`, `gemSpeak`, `aiSafetyNums`,
  `aiUngroundedSafety`, `addDays`, `vcAskAI`, `vcTranslateToEn`, `combinedEventsRows`), `build.py:334`,
  `playwright.config.ts`, `serve.js`, `.github/workflows/{test,eval}.yml`, `package.json`
- `git log bfb3e9a..HEAD` (65 commits, full enumeration) + targeted `git show`/`git merge-base --is-ancestor`
  checks to place individual commits inside or outside the reconciliation window
