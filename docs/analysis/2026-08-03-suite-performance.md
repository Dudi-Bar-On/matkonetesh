# Suite performance — 2026-08-03 measurement session

**Owner instruction (2026-08-03):** "2 ריצות כל אחת יותר מ-3 דקות יקר מדי — חייבים למצוא פתרונות יותר
זולים." Every release pays ~6 minutes (H7: two clean full runs). Today: 1144 tests, 20 workers, 32
logical cores.

**Method:** measurement first (§10.18), one variable at a time, PREDICT before TEST. No optimisation was
applied to the gate. This document is the deliverable — no code was changed, nothing was committed.

---

## 0. Machine/verification hygiene

- Verified idle before every run: `Get-CimInstance Win32_Processor | LoadPercentage` = 5–8% before each
  run; port 8123 free (no LISTENer) each time.
- No two suite runs executed concurrently. Every run allowed to complete; none killed mid-flight.
- Exit codes captured directly (`cmd; ec=$?`), never through a pipe.
- No commits made. No config file changed. No test dropped, skipped, or grepped-out of any gate run.

## 1. First run hit a failure — stopped and diagnosed (§10.18), not averaged away

The very first `npx playwright test --reporter=json` run (idle machine, exit code 1) failed one test:

```
vg-voice-panel.spec.ts > first-run card guard — never stomps an open panel (shared by both cards)
  > maybeAskUiLevel goes through the SAME guard — also deferred behind an open panel, not lost
  Expected: true / Received: false
```

Per L36 (the one-minute discriminator: run it alone), this was re-run in isolation:

```
npx playwright test tests/vg-voice-panel.spec.ts -g "maybeAskUiLevel goes through the SAME guard"
1 passed (6.2s), exit 0
```

**Diagnosis: a load-contention flake, not a product regression** — the L36 signature (passes alone,
fails only inside the full run). This is not "re-running until green" (forbidden) — it is the prescribed
diagnostic step, and it produced a clean verdict before any baseline number was trusted. It is itself a
data point revisited in §4 (worker-count risk).

## 2. Baseline — clean run, full numbers

Second run, same idle-machine precondition, **exit 0**:

```
stats: {"startTime":"2026-08-02T22:38:19.876Z","duration":191813.5ms,"expected":1144,"skipped":0,"unexpected":0,"flaky":0}
```

| Metric | Value |
|---|---|
| Wall clock | **191.8 s** (~3.2 min) |
| Tests | 1144 (1137 `chromium` + 7 `service-worker`) |
| Sum of all test durations | 3065.0 s |
| Parallelism ratio (sum/wall) | **15.98×** average concurrency out of 20 workers |
| Peak concurrency (sweep-line, exact) | 20 (the config ceiling — never exceeded) |
| Distinct worker PIDs seen (JSON `workerIndex`) | 36 — the extra ~16 are near-zero-duration stray respawns, not real added concurrency (confirmed by per-worker busy-time: workers 0–19 each carried 149–157 s of work; everything else carried <1 s) |

Two release-gate runs today therefore cost **~6.4 minutes actually measured** — matches the owner's
complaint precisely.

### Worker-utilisation timeline (sweep-line concurrency, exact — not a windowed approximation)

```
t=   0s   0            t=  90s  20 (full)
t=   5s  10 (ramping)   t= 120s  20 (full)
t=  10s   4             t= 150s  19
t=  15s  12             t= 160s  20
t=  20s  20  ─┐         t= 165s   2   ─┐
   ...        │ full 20-worker           │  TAIL — service-worker
t= 160s  20  ─┘ plateau, ~140s          │  project running SOLO
t= 165s   2                             │  (fullyParallel:false,
t= 190s   1                            ─┘  1 worker), ~27s
```

**Answer to the mandated question ("are all 20 busy throughout, or does a tail leave 19 idle"):
the second one, and it is precisely quantified:**

- **t = 20s → t = 160s (~140s, 73% of wall clock): all 20 workers fully saturated**, exact peak
  concurrency = 20 the whole time (never higher — the loopback-fix era's ceiling holds).
- **t = 0s → t = 20s (~20s, 10% of wall clock): ramp-up** — concurrency climbs 0→10→4→12→20 as each of
  the 20 browser contexts finishes cold-launching. This is the same territory L22's F1/F2 staggered-start
  fix operates in; not touched (see §5, rejected options).
- **t = 165s → t = 191.8s (~27s, 14% of wall clock): a hard serial tail.** The last handful of `chromium`
  tests (a batch of `i18n-extractor.spec.ts` unit tests, ~10ms each — the queue simply ran dry) finish
  around t=167s, and from that point on **only the `service-worker` project's 7 tests run, one at a time,
  on a single worker** (`fullyParallel:false`, by design — see below). Concurrency during this window: 2,
  then 1, for ~27 seconds straight while 19 workers sit idle.

## 3. Cost-centre breakdown (confirming/refuting the candidate shapes named in the brief)

| Candidate | Confirmed? | Evidence |
|---|---|---|
| **Long tail of a few heavy specs serialising the finish** | **CONFIRMED — and it is the `service-worker` project, exactly** | 27s / 191.8s (14%) of wall clock is a single-worker tail; see §2. |
| **`isolatedPage` tests — count + total time** | Present, moderate cost | 16 spec files use `isolatedPage` (grep). 15 of them (excluding `service-worker.spec.ts`, counted separately as its own project) total **83 tests / 384.9 s of summed test-time = 12.6% of all test-time**, averaging **4.64 s/test** vs the whole-suite average of **2.68 s/test (chromium)** — roughly **1.7× heavier per test**, consistent with "full context+goto each" being real overhead. Heaviest: `d2-bcheck-alert.spec.ts` (68.0s/7 tests, avg 9.7s), `vg-rearm-gate.spec.ts` (49.3s/7, avg 7.0s). |
| **`service-worker` project — real network instead of the route cure** | **CONFIRMED as the tail's cause**, not as extra CPU cost | 7 tests, 22.7s total (`BY PROJECT` breakdown), and — critically — because `fullyParallel:false` pins it to 1 worker (L30, load-bearing: 5-way concurrency there blows the 30s test timeout on real SW registration cycles), it cannot share the other 19 idle slots once the main pool drains. The *design reason* (L30) is sound and not up for revision here; the *scheduling side-effect* (it waits for a free slot, which only appears once `chromium` fully drains) is the actual cost. |
| **Per-test `seedApp` reload cost × 1144** | Not a distinct cost centre | This is the warm-page architecture itself (the thing that already cut the suite 3m→54s in the earlier arc); at steady state it's ~1s per test and is already reflected in the 2.68s/test chromium average. No separate line item to cut without undoing the warm-page win. |
| **Fixed startup/teardown overhead** (`build.py` + server boot) | Negligible | Wall-clock-command time (193s, measured with `date` before/after) vs `stats.duration` (191.8s) differ by ~1–2s only. `build.py`+`serve.js` boot is not a meaningful cost centre. |
| **Tests waiting on real timers / long conditions** | Not separately isolated this session | The slowest individual tests (§below) are dominated by real TTS/voice simulation logic (`vc-ack-gap`, `i18n-completeness`, `d2-bcheck-alert`), not `waitForTimeout` (contract-forbidden) — no smoking gun found without a file-by-file audit, which was out of this session's scope. |

**Slowest 20 specs (summed test-time — NOT wall-clock, since these run in parallel):**
`i18n-completeness.spec.ts` (194.1s/26 tests, avg 7.47s — the single heaviest spec by a wide margin),
`p0-spoken-safety.spec.ts` (122.4s/64), `voice-wave0.spec.ts` (73.5s/41), `e3-plan-gate.spec.ts` (69.8s/18),
`d2-bcheck-alert.spec.ts` (68.0s/7), `e3-validity.spec.ts` (58.7s/22), `ai-trust.spec.ts` (57.3s/20),
`adaptive-home.spec.ts` (55.2s/14), `metered-streaming.spec.ts` (53.2s/18), `catalog-sweep-safety.spec.ts`
(50.4s/20). Full top-20 in the raw analysis (available on request; not attached — see §6 reproducibility).

**Slowest 20 individual tests:** dominated by `vc-ack-gap.spec.ts` (12.8s, 12.0s, 11.6s, 11.4s — real
TTS-timing simulation) and `i18n-completeness.spec.ts`'s per-language checks (9.7–12.4s each, ×4 languages
×3 check-types = structurally repeated cost, not a bug).

## 4. Worker count: 20 → 24 — PREDICTED, TESTED, REJECTED with strong evidence

**PREDICT (before running):** peak concurrency was pegged at exactly 20 for 140/191.8s of the baseline
(73%), and the idle-machine CPU load was only 5–8% — headroom looked real. Predicted: raising to 24 would
shrink the ~140s full-utilisation plateau by roughly 20/24 (≈17%), for a **predicted total-wall saving of
~20–25s (~11–13%)**.

**TEST (single-variable probe, `--workers=24`, everything else identical, idle machine verified before
the run):**

```
npx playwright test --workers=24 --reporter=json
stats: {"duration":345965ms,"expected":1104,"skipped":1,"unexpected":39,"flaky":0}
```

**OBSERVE:** wall clock **345.97s — 1.8× SLOWER**, not faster, and **39 tests failed**, every single one
with the *exact* signature of the pre-loopback-fix defect this project already spent an entire arc curing
(L22):

```
TimeoutError: page.reload: Timeout 20000ms exceeded.
  - waiting for navigation until "domcontentloaded"
  - navigated to "http://localhost:8123/index.html"
```

(Plus cascading `Fixture "warmPage" timeout of 30000ms exceeded during setup` and plain 30s test
timeouts on files queued behind the stalled navigations.)

**CONCLUDE — REJECTED, not "no gain but no harm."** The prediction was wrong by direction, not just
magnitude: raising workers reproduced a nav-stall failure mode identical to the one `route.fulfill`
in-memory doc serving was built to cure. `playwright.config.ts`'s own comment records a 24-worker point
in an earlier clean curve probe (2026-07-24) — **that result did not reproduce today**, which itself
matches this project's history: the loopback wall is a threshold effect, not a smooth CPU curve (L22), and
apparently sits between 20 and 24 workers on the machine as configured right now. Per the brief's own
explicit gate ("a higher count that introduces ONE flake is a net loss") — this introduced 39 failures and
nearly doubled the wall clock. **Workers=28 was not tested**: after a result this unambiguous in the wrong
direction, testing a still-higher count would very likely fail worse for no informational gain (Occam;
§12.6 — a stack-trace-clear result doesn't need a second confirming failure). **Recommendation: keep
`workers: 20` exactly as certified. Do not raise it.**

## 5. CI as the second H7 run — a process option, evidence gathered, no code change

Checked whether CI already runs the suite and whether it's trustworthy:

- `.github/workflows/test.yml` runs `npx playwright test` (the identical plain gate command) on every
  push to `main` and every PR, `workers: 2` (config's own CI branch), `ubuntu-latest` (4 vCPU).
- Recent history (`gh run list`, last 10 runs on `main`): **9/10 green**, 1 failure — consistent with this
  project's already-known flake rate, not a CI-specific problem.
- Timed one recent green run's `playwright` job precisely (`gh run view --json jobs`): **11.4 minutes**
  (22:31:32 → 22:42:54), vs **3.2 minutes** measured locally at 20 workers — CI is ~3.6× slower per run
  (2-worker cap + `npm ci` + Chromium install overhead), consistent with the config's own comment.

**What this buys, and what it doesn't:** CI does NOT make the suite cheaper in total compute — it is
slower per run. What it changes is *where* the wall-clock is spent: today both H7 runs happen locally,
consuming the owner's foreground attention (2 × 3.2 min = 6.4 min of watching a terminal). If the second
of the two required clean runs were satisfied by CI's automatic run-on-push instead of a second local
`npx playwright test`, the **local/foreground cost halves to ~3.2 min**, and the second verification
(~11.4 min) happens unattended in the background after push, gated on before declaring the release live
(consistent with the existing §10.10 "a push is not a release — poll the live URL" discipline, which
already implies waiting on something after push).

**This is a process proposal, not a code change, and is not adopted here — the owner decides.** Open
question for the owner to weigh: H7 currently requires the second run "at the release commit" — CI's run
IS on the exact pushed commit, so it satisfies that clause structurally; the only real trade is trading
5.4 minutes of unattended background CI time for 3.2 minutes of local foreground time.

## 6. Dev-loop command (additive only, does not touch the gate)

Not built this session (no request beyond evaluating whether it's "worth adding") — but worth naming
concretely since it was in scope: `npx playwright test --project=chromium --grep "<pattern>"` or
`--last-failed` / `--only-changed` are already Playwright-native and already documented in §11a as the
debug-loop tools ("adopted 31.7, from review of the tools"). No new script is needed; the discipline
document already tells implementers to use these for the fix-loop while keeping `npx playwright test`
plain as the only DoD gate command. Recommendation: no new file to add — the capability already exists
and is already documented; this session found no gap here.

## 7. Ranked recommendations

| # | Recommendation | Predicted saving | Measured saving | Verdict |
|---|---|---|---|---|
| 1 | **Do NOT raise workers above 20** | predicted ~20-25s gain | **measured: -154s (regression), +39 failures** | **REJECTED — evidence-based, strong** |
| 2 | **Move the 2nd H7 run to CI (process change)** | n/a (not a speed fix) | local foreground cost 6.4min → 3.2min; total wall-clock unchanged, CI run adds ~11.4min unattended | **Proposed — owner decision required, no code change made** |
| 3 | Investigate shaving the `service-worker` tail (~27s / 14% of wall) | unquantified | not attempted — the isolation (`fullyParallel:false`) is explicitly load-bearing (L30); shrinking the tail without violating that needs its own dedicated investigation | **Deferred — flagged for a future dedicated task, not attempted tonight** |
| 4 | Audit `isolatedPage` usage file-by-file for necessity | unquantified (12.6% of test-time, 1.7× per-test cost) | not attempted — each current usage is justified in-file per the TEST-AUTHORING-CONTRACT (clock/SW/`test.use`); auditing 16 files for over-use is real work, out of tonight's scope | **Deferred — candidate for a future task** |
| 5 | Dev-loop subset command | n/a | already exists (`--grep`/`--last-failed`/`--project`), already documented in §11a | **No action needed — not a gap** |

## 8. Rejected options (explicit, with reasons)

- **Raising workers 20→24 (or higher).** Measured regression: 1.8× slower, 39 failures reproducing the
  pre-loopback-fix defect signature. See §4.
- **Any change to `retries`, `--grep` in the gate, skipping the `service-worker` project, or dropping
  tests.** Not evaluated — explicitly forbidden by the hard constraints; would not be a real saving even
  if it moved the number (loses verification).
- **Shrinking the ramp-up window (t=0–20s, ~10% of wall clock) by removing the staggered worker start.**
  Not attempted. That staggering is the F1/F2 fix from the loopback saga (L22) — touching it without a
  dedicated repro-harness investigation risks reintroducing the cold-parse stampede it was built to cure.
  Named as a candidate, deliberately not touched tonight.

## 9. What was NOT done, stated plainly

- No 6–9× reliability sampling of the 20-worker baseline was run (§11a's bar for *establishing a new*
  ceiling) — not needed here since 20 is the already-certified, unchanged setting; one clean run plus
  CI's own 9/10-green recent history is the evidence used, not a new certification claim.
- `service-worker` tail and `isolatedPage` audit are named as real opportunities but not executed —
  correctly scoped out rather than rushed, per the task's own instruction to report gaps rather than
  gold-plate.
- Workers=28 was deliberately not tested (§4) — a documented, reasoned skip, not an omission.

---

## H9 — task summary

| | |
|---|---|
| **מה היה** | הסוויטה עברה מ-876 ל-1144 בדיקות; זמן ריצה מקומי חזר ל-~3.1 דקות; אין מדידה עדכנית של פילוח העלות, ולא נבדק אם 20 workers עדיין אופטימלי אחרי הצמיחה. |
| **מה נעשה + ראיות** | ריצת בסיס נקייה נמדדה (191.8s, exit 0, 1144/1144). כשל בודד בריצה הראשונה אובחן כפלייק-עומס (L36, עבר לבד). נבנה ניתוח sweep-line מדויק של ניצולת workers — חשף plateau של 140s ב-20/20 מלא, ramp-up של 20s, וזנב סדרתי של 27s מפרויקט ה-service-worker. נמדד `isolatedPage` (16 קבצים, 83 בדיקות, 12.6% מזמן-הבדיקה המצטבר, ~1.7× יקר יותר לבדיקה). נבדק CI (test.yml): מריץ את אותו gate, 9/10 ירוק, 11.4 דקות לריצה. **נבדקה השערת ה-workers=24 בפועל** (לא רק תיאורטית) — נכשלה בצורה חדה: 345.97s (כמעט כפול!) ו-39 כשלים עם החתימה המדויקת של תקלת ה-loopback שהפרויקט כבר תיקן. |
| **מה נשאר** | הצעת CI-כריצה-שנייה טעונה החלטת בעלים (לא קוד). חקירת זנב ה-service-worker וביקורת `isolatedPage` — משימות עתידיות מוגדרות, לא בוצעו הלילה. |
| **איפה אנחנו** | קשת "warm page" (2026-07-23/24) עדיין תקפה ומאושרת מחדש הלילה — 20 workers עדיין הנקודה הנכונה, וההוכחה החדשה (24 workers = רגרסיה חדה) רק מחזקת את זה. אין רגרסיה בתשתית; הצמיחה ל-1144 בדיקות היא הסיבה היחידה לעלייה מ-54s. |
| **הבא בתור** | הבעלים מחליט על הצעת ה-CI (סעיף 5). אם אושר — לעדכן את תהליך ה-H7 (לא את קובץ ה-gate עצמו). ללא אישור — אין עוד "win זול" שנמצא הלילה; ההמלצה המרכזית (§7 #1) היא **לא** להעלות workers. |
