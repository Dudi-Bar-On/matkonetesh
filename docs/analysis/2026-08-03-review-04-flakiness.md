# Review 04 — test non-determinism forensics

**Date:** 2026-08-03 · **Repo:** `C:\Users\dudib\source\repos\matconetesh` · **Branch:** `main`
**Commit under audit:** `a362b5a` (the brief's HEAD). During the audit the branch advanced to `0768380`
via three docs-only commits; `git diff --stat a362b5a 0768380 -- tests/ playwright.config.ts serve.js
build.py app.js` is **empty**, so every measurement below is valid for both.
**Files changed by this audit:** this file only. No commit made. The temporary worktree was removed.

---

## 0. The one-sentence mechanism

> **This machine's loopback HTTP path stalls a large HTTP response for ~19 or ~29 seconds under
> concurrency; every test that navigates to the real `index.html` over that path (i.e. every
> `isolatedPage` test and every worker's one cold `goto`) is exposed, and the full suite is green only
> because its schedule happens to keep those real navigations sparse and out of phase — not because
> anything prevents them from colliding.**

The gate is **HTTP-protocol-aware, not TCP**, and it is **not** in Chromium, not in Playwright, not in
`serve.js`, and not CPU. It is below all of them. That is a correction to the project's own recorded
root cause, and it is proven in §3 with the browser removed entirely.

**Answer to the question the owner actually asked:** the green suite is green for the *right result* but
the *wrong reason*. It passes because of how tests happen to be scheduled. A green run is not evidence
that the next run will be green, and it is provably not evidence that the code is correct — the identical
code fails 80–100% when the same tests are scheduled differently.

---

## 1. Method and hygiene

- Exit codes captured directly (`cmd; ec=$?`), never through a pipe.
- Port 8123 verified free before every Playwright run; verified free again at the end.
- **Never two suite runs at once.** Every run allowed to complete; none killed mid-flight.
- One subagent was used, for read-only file auditing, and it was finished before the full-suite run
  started. No agent ran concurrently with a measurement.
- **Machine load, stated honestly:** the machine was **not idle** in the strict sense. Sampled before
  measuring: total CPU **14.1%** over 5s on 32 logical cores, with background services consuming ~3–4
  cores steadily — `navigraphsimlink` (~0.9 core), `elgatoaudiocontrolserver` (~0.7 core), `wmiprvse`,
  `nordvpn-service`, `asusfancontrolservice`, `lightingservice`, `tobii.eyex.engine`, plus Task Manager
  open. This load was present and roughly constant across **all** runs below, so comparisons are valid;
  but §11a's "idle machine" precondition was **not** met, and on this machine it is rarely going to be.
- **PREDICT → TEST → OBSERVE → CONCLUDE** was followed. My first prediction was **wrong** and is recorded
  as wrong in §2.

---

## 2. Reproduction — the incident, reproduced exactly, and the worker curve

### 2.1 The incident reproduces

Command (identical in every row; `$SPECS` = the four `isolatedPage`-heavy specs, 25 tests):

```
$SPECS = tests/equipment-walkthrough.spec.ts tests/d2-bcheck-alert.spec.ts \
         tests/vg-rearm-gate.spec.ts tests/p0-adddays-dst.spec.ts
npx playwright test $SPECS --reporter=json      # workers = 20 from the config
```

| Commit | What it is | Workers | Result | Wall |
|---|---|---|---|---|
| `a362b5a` (HEAD) | after the `e1bd8fb` items.json fix | 20 | **20 failed / 5 passed**, exit 1 | 82.0s |
| `04856ce` | **true pre-change baseline** — the parent of `df84324` | 20 | **25 failed / 0 passed**, exit 1 | 57.2s |

`git log --oneline 04856ce..HEAD` confirms `df84324` is the oldest commit in the range, so `04856ce` is
genuinely *before* the suspect change. `git diff 04856ce HEAD -- playwright.config.ts` is empty; only
`tests/_fixtures.ts` differs (+57 lines). The baseline worktree was created with
`git worktree add … 04856ce`, given a junction to the main `node_modules`, and removed afterwards
(`git worktree list` now shows only the main checkout).

**Both numbers match the brief exactly.** The reported incident is real and reproducible on demand.

### 2.2 Every failure is one mechanism — there are no product failures

Failure signatures, classified from the JSON reporter across all runs:

```
TimeoutError: page.orig: Timeout 20000ms exceeded.
  Call log: navigating to "http://localhost:8123/index.html", waiting until "domcontentloaded"
```
(`page.orig` is the fixture's `dclGoto` rebinding of `page.goto`.) The remainder are the 30s test-level
timeout firing on top of the same stalled navigation — the `page.reload` inside `seedApp`. **Zero
assertion failures. Zero product failures.** Every single failure in every run in this report is a
20-second navigation timeout on the real `index.html` document.

Per §4 of `tests/TEST-AUTHORING-CONTRACT.md` and **L36**, "Target page, context or browser has been
closed" would have been the symptom, not the cause — that trap did not fire here because the JSON
reporter preserved the underlying nav-timeout error. Worth noting: the JSON reporter gives a strictly
better failure signature than the `list` reporter for this class.

### 2.3 The worker curve — my prediction was wrong

**I predicted before running:** "failures begin between 8 and 12 workers; at 4 workers, zero."

**Observed** (same `$SPECS`, same commit `a362b5a`, only `--workers` changed, run back-to-back):

| Workers | Passed | Failed | Wall | Signature |
|---|---|---|---|---|
| 4 | 21 | **4** | 44s | 4 × nav timeout |
| 8 | 17 | **8** | 67s | 6 × nav timeout + 2 × 30s test timeout |
| 12 | 4 | **21** | 60s | 13 × nav timeout + 8 × `page.reload` timeout |
| 16 | 0 | **25** | 97s | 25 × nav timeout |
| 20 | 5 | 20 | 82s | 10 × nav timeout + 10 × 30s test timeout |

**I was wrong: it already fails at 4 workers — one sixth of the certified worker count.** There is no
clean threshold below which this shape is safe; it degrades continuously from very low concurrency. The
curve is also **non-monotonic** (16 workers is worse than 20), which is the signature of a shared gate
plus scheduling noise, not a smooth capacity curve.

---

## 3. The mechanism, proven with the browser removed

This is the part that overturns the project's recorded root cause. A harness of plain Node HTTP clients
against a plain server, on loopback, no Chromium and no Playwright anywhere:

### 3.1 It reproduces with no browser at all, at concurrency 2

`node serve.js 8199`, then 2 concurrent `http.get('/index.html')` from one Node process:

```
#0 ttfb=  32ms total=    47ms bytes=2457592 status=200
#1 ttfb=  32ms total= 19011ms bytes=2415220 status=ERR:ECONNRESET
```

Request #1 received **2,415,220 of 2,457,592 bytes** — 98.3% — with a maximum inter-chunk gap of 23ms,
then the stream stopped 42,372 bytes short and the connection was **RESET after 19 seconds**. The
truncation point was byte-identical across independent stalled requests. The stall constants cluster at
**~10s, ~19s, ~29s** — a ~10-second retry quantum.

### 3.2 It is not `serve.js`

The same harness against `python -m http.server` (Python 3.10.4, `ThreadingHTTPServer`) serving the same
`dist/`, N=4, 5 repetitions: **1 of 5 runs stalled (2 bad, 19s)**. Node's server is more susceptible
(5/5 runs affected) — it does one giant `res.end(2.4MB)` write where Python chunks — but the defect is
**not** server-specific.

### 3.3 It is HTTP-aware, not TCP — the decisive experiment

One Node process serving the **identical 2,457,592 bytes** two ways: port 8197 as **raw TCP** (no HTTP
framing at all), port 8196 as **HTTP**. Clients interleaved in time to control for drift:

| Transport | Concurrency | Result |
|---|---|---|
| **Raw TCP** | 1 and 4, 15 requests | **0 bad**, 6–165 ms each |
| **HTTP** | 1 and 4, 32 requests | **16 bad**, stalls of 19,000–29,000 ms |

Same bytes. Same process. Same loopback. Same seconds. **Raw TCP is flawless; HTTP framing stalls half
the time.** This eliminates: the TCP stack, CPU, payload size alone, Chromium, Playwright, `serve.js`,
and the file system. Something on this machine **parses HTTP on loopback and stalls it.**

### 3.4 Size-graded, port-independent, spacing-independent

| Variable | Result |
|---|---|
| Body 64 KB | 0/20 bad (but one 10.3s outlier) |
| Body 512 KB | 5/20 bad |
| Body 2.4 MB | 9–12/20 bad |
| Content-Type `text/html` / `text/plain` / `application/octet-stream` | no difference (11, 12, 8 of 20) |
| Path with/without `.html` extension | no difference (11 vs 9 of 20) |
| Ports 8123, 8080, 8000, 3000, 5000, 9876, 12345, 49500, 7777 | **all affected**, 4–9 bad of 12 each |
| Sequential with 0 / 250 / 1000 / 3000 ms spacing | 4, 3, 5, 5 bad of 12 — **spacing does not help** |

### 3.5 The environmental agent — named as candidates, not asserted

Three HTTP/network-filtering products are installed and running on this machine:

| Driver / service | What it is |
|---|---|
| `IDMWFP` (`C:\WINDOWS\system32\drivers\idmwfp.sys`) | Internet Download Manager's WFP callout — **inspects HTTP responses to detect downloadable content**. The strongest a-priori fit for an HTTP-aware, size-graded stall. |
| `nordlwf` (`NordVPN LightWeight Firewall`) + `tapnordvpn` + `nordvpn-service` | NordVPN filtering stack, running |
| `Norton Firewall` service + `NortonVpn` service | Norton's HTTP-inspecting firewall, running |

Also: `Get-MpPreference` fails with `0x800106ba` (Defender service disabled) — consistent with Norton
having taken over inspection.

**I did not disable any of these** — that is the owner's machine and his decision. **I am not asserting
which one it is.** The evidence supports the *class* (an HTTP-inspecting network filter) beyond
reasonable doubt; identifying the individual driver needs one 5-minute test the owner can run, given in
§8.

### 3.6 Chromium is more resilient than Node — and that is the whole reason the suite is green

Same server, same moment, two clients:

| Client | Concurrency | Result |
|---|---|---|
| **Chromium** (fresh context per nav) | 1 | **0/8 bad**, p50 644 ms, worst 3.5 s |
| **Chromium** | 4 | **0/16 bad**, p50 888 ms, **worst 10.9 s** ← the gate brushing |
| **Chromium** | 8 | **9/24 bad**, **p50 21.9 s** ← cliff |
| Node `http.get` | 1 | 1/8 bad, worst 19.1 s |
| Node `http.get` | 4 | 6/16 bad, worst 19.1 s |

**The measured threshold for the real product client is between 4 and 8 simultaneous real `index.html`
navigations.** At 4 it survives with a 10.9 s worst case — inside the 20 s nav timeout, but with only
~9 s of margin. At 8 it collapses.

---

## 4. Testing the hypothesis where it predicts the opposite

An explanation that fits is where investigations go to die. Three tests were run specifically to break
this one.

### 4.1 Remove the transfer, keep everything else — PREDICTED, then OBSERVED

**Prediction stated before running:** if the mechanism is the loopback HTTP transfer, then fulfilling the
app document from memory for `isolatedPage` gives **25/25 pass at 20 workers**; if the mechanism were CPU
or cold-parse contention, it will **not** help, because all 25 fresh contexts still parse the full 2.4 MB
app.

Instrument: a temporary worktree at `a362b5a` with `APP_DOC_RE` also routed on `isolatedPage`. Same
`$SPECS`, same 20 workers.

```
{"duration":12423.0,"expected":25,"skipped":0,"unexpected":0,"flaky":0}   EXIT=0
```

| | Passed | Failed | Wall |
|---|---|---|---|
| `a362b5a` as shipped | 5 | 20 | 82.0 s |
| `04856ce` pre-change | 0 | 25 | 57.2 s |
| **`a362b5a` + in-memory app doc on `isolatedPage`** | **25** | **0** | **12.4 s** |

**Confirmed, and the CPU hypothesis is refuted.** Every cold parse still happens; the run gets *6.6×
faster* and goes from 0–20% to 100%. The transfer was the entire mechanism.

> This is an **experiment, not a proposal.** It cannot be shipped as-is: it would break
> `warm-fixture.spec.ts`'s L19 contract test (which asserts `isolatedPage`'s `index.html` carries no
> `x-mk-warm-fulfill` header) and it would silently defeat `security-headers.spec.ts:26`, which installs
> its **own** `index.html` route to serve the real CSP headers. Options are in §8. The worktree was
> removed; nothing in the repo was changed.

### 4.2 A case where my explanation and the project's recorded lesson predict *different* failures

`playwright.config.ts` and **L30** both state that `fullyParallel:false` on the `service-worker` project
is load-bearing because those tests "each drive a real SW register/install/activate plus reload +
`context.setOffline` cycles — measurably heavier than a warm-page test". That explanation predicts
**service-worker-specific** failures when parallelism is restored. My explanation predicts **navigation
timeouts on `index.html`**, because that project deliberately gets no in-memory routes.

```
npx playwright test tests/service-worker.spec.ts --project=service-worker --fully-parallel --reporter=json
EXIT=1   {"duration":43949,"expected":0,"unexpected":9,"flaky":0}
  8 × NAV-TIMEOUT goto/reload index.html
  1 × 30s test timeout
```

**8 of 9 are nav timeouts on the app document.** L30's *setting* is right and must stay; L30's *stated
root cause is wrong*. The `service-worker` project is not slow because service workers are heavy — it is
sitting directly on the loopback cliff, and `fullyParallel:false` is the only thing holding it off. That
matters, because a lesson with the wrong mechanism sends the next person to the wrong place: L30 tells
you to watch spec-file growth for SW weight, when what actually needs watching is **any** growth in
tests that navigate for real.

### 4.3 Where my explanation does *not* fully close

Honest limit. In the green full-suite run I measured (§5), the **time-weighted peak concurrency of
`isolatedPage`-family tests was 18**, and the run spent ~7% of its window with 8 such tests in flight and
~4% with 9. By §3.6's threshold that should have produced failures. It did not — **0 tests took even 15
seconds.**

The resolution is that *concurrent tests* is a poor proxy for *concurrent navigations*. An
`isolatedPage` test navigates for roughly the first second of a 3–9 second test; the rest is assertions.
Eighteen concurrent such tests may have only two or three navigations genuinely in flight together. What
kills the subset run is not concurrency but **phase-locking**: 25 tests that are *all* `isolatedPage`,
started by 20 workers at the same instant, put ~20 navigations in flight simultaneously.

**I did not directly instrument in-flight navigation count inside a full suite run** — that would need a
network-level probe or a fixture hook, and a fixture hook is a repo change I was told not to make. So the
claim "the full suite stays under the cliff" is **inferred, not measured**. It is consistent with all
the data and I could not construct a case against it, but it is the weakest link in this report and I am
naming it rather than dressing it up.

---

## 5. Is the green suite green for the right reason?

`npx playwright test --reporter=json`, commit `a362b5a`, config workers = 20:

```
{"startTime":"2026-08-03T18:58:42.818Z","duration":198929.1,"expected":1176,"skipped":0,
 "unexpected":0,"flaky":0}   EXIT=0
```

**1176 passed, exit 0, 198.9 s.** Green, and consistent with the three green runs the brief reports and
with last night's 191.8 s / 1144-test baseline.

Sweep-line analysis of that green run:

| Measure | Value |
|---|---|
| Peak concurrency, all tests | 20 (the config ceiling, never exceeded) — 63.9% of the window at 20, 10.3% at 19 |
| `isolatedPage`-family tests | **92 of 1176 — 7.8% of the suite** |
| Peak concurrency, `isolatedPage`-family | **18**, at t+135.1 s |
| Share of window with **zero** `isolatedPage` tests in flight | **45.3%** |
| Tests taking ≥ 15 s in the green run | **0** |
| Slowest `isolatedPage` test | 12.5 s (`d2-bcheck-alert` "reload persistence") |

**The verdict.** 92.2% of the suite — every test on the warm page — never opens a real HTTP connection
for the app document at all; `_fixtures.ts` fulfills it, `lang-*.json` and `items.json` from memory. Those
tests are structurally immune. **The entire exposed surface of this suite is 92 tests**, plus the one
cold `goto` each of the 20 workers performs at start-up (which is why `F1`'s `parallelIndex * 700 ms`
stagger exists — that stagger is, in hindsight, a de-phasing device against exactly this gate).

So the gate passes because:
1. only 7.8% of tests navigate for real, and
2. those 92 are spread across 16 files that the scheduler interleaves with ~1084 immune tests, so their
   navigation moments rarely coincide.

**Neither of those is a designed property. Both are accidents of the current test mix.** Nothing in the
config, the fixtures, or the authoring contract measures or bounds simultaneous real navigations. The
margin is unknown, unmonitored, and moves every time someone adds an `isolatedPage` test or a spec file
grows (**L30**'s mechanism, now correctly explained).

**This is the finding that outranks everything else in this report: the gate is green by scheduling.**

---

## 6. Adjudicating the three reversals

| Claim | Verdict |
|---|---|
| Subagent: *"21 pre-existing failures, confirmed on baseline `b2ba95c`"* | **Right conclusion, invalid evidence.** `b2ba95c` is four commits **after** `df84324` — a baseline inside the regression window, which always reads "pre-existing". The failures genuinely *are* pre-existing (`04856ce` → 25/25 fail, §2.1), but that run did not show it. Being right by luck is not being right. |
| Controller: *"our regression from Task B"*, overruling the subagent | **Wrong.** The true pre-change baseline refutes it. The controller overruled a correct conclusion on the strength of a reasonable-looking inference, and the failure mode was not the subagent's — it was accepting a baseline without checking its ancestry. `git merge-base --is-ancestor` is one command. |
| `e1bd8fb` — route `items.json` in-memory for `isolatedPage` | **Correct, real, and insufficient.** It removes one real 185 KB transfer per boot, worth 0/25 → 5/25. It does not touch the 2.4 MB document navigation, which is the actual mechanism. It is not wrong and should not be reverted. |

**Is `e1bd8fb`'s `chromium`-only guard right? Yes, and it is load-bearing.** The `service-worker`
project's tests use `isolatedPage` (in `beforeEach` and in all 9 tests), so the guard *is* evaluated for
that project on every test and correctly declines to install the route. `service-worker.spec.ts:179`
polls `caches.keys()` for a real `items.json` cache entry then asserts a 200 from cache while offline — a
memory fulfill would short-circuit the SW's fetch handler and that poll would hang. The guard is the only
thing separating the two projects at fixture level. Correct as written.

**One L19 gap it leaves:** the warm-side route has a firing guard (the `x-mk-warm-fulfill` header, asserted
by `warm-fixture.spec.ts`). The new `isolatedPage` `ITEMS_JSON_RE` route has **none** — nothing proves it
fires, which is exactly the placebo shape L19 exists to catch. Also, `warm-fixture.spec.ts`'s trailing
comment *"isolatedPage's own context never installs the route — no leak"* is now false: since `e1bd8fb`,
`isolatedPage` on chromium does install a fulfill route and its `items.json` responses do carry
`x-mk-warm-fulfill`. The assertion still passes (it reads the header off the *navigation* response), but
the header is no longer a warm-vs-isolated discriminator and the comment will mislead the next reader.

---

## 7. Other non-determinism found — ranked by whether it can make a GREEN suite lie

### Rank 1 — the scheduling dependency (§5). Already stated. A green run does not predict the next one.

### Rank 2 — `page.exposeFunction` on the shared warm page, permanently
`tests/vg-schedule-cards.spec.ts:36` calls `await page.exposeFunction('__spoke', …)` where `page` is the
**worker-shared warm page**. `exposeFunction` has **no removal API**, survives navigation, and is
re-installed on every document — precisely the class the warm fixture's `addInitScript` hard trap
(`tests/_fixtures.ts:198`) exists to forbid, arriving through a door the trap does not cover. It leaves
`window.__spoke` in every later test in that worker, across all spec files, holding a closure over a dead
test's counter. A second `exposeFunction('__spoke')` anywhere in the same worker throws
`Function "__spoke" has been already registered`. Nothing collides **today** (`vg-voicesay.spec.ts:49`
exposes `__said`, but on `isolatedPage`), so this is latent — one name collision from a cross-file
phantom failure that would look like anything but its cause. Its two sibling tests in the same file
already use `isolatedPage`; this one should too.

### Rank 3 — aging date fixtures against a real clock
Four specs seed events with dates now in the past and run on the warm page with **no clock pin**:
`tests/active-hub.spec.ts:54,121` and `tests/adaptive-home.spec.ts:163-164` (`'2026-07-20'`),
`tests/wave2-combined.spec.ts:37-38` (`'2026-07-20'`, `'2026-07-21'`), and — the one that crossed most
recently — `tests/cart-quantity.spec.ts:102` (`date:'2026-08-01'`, future when written, two days past
today). Since R-57 shipped `evState` with a 13-hour-after-serve `needsUpdate`/stale classification, these
fixtures now sit on the far side of that threshold: the tests are asserting against the **stale** branch,
not the branch they were authored to exercise. They are green. They are green about the wrong thing —
**L45**'s exact shape. `tests/waveB-datetime.spec.ts:31` pins `'2026-12-25'` as "future" and will age on
that date.

Also: `tests/d3-reminders-fire.spec.ts:12-13,41-44` mixes a **local-time** `new Date()`/`setDate()` with a
**UTC** `.toISOString().slice(0,10)`. On a UTC+3 machine between 00:00 and 03:00 local the seeded start
date lands a day early. Both cases survive a ±1-day shift today, so it is latent — but it is the exact
class `p0-adddays-dst.spec.ts` exists to guard.

### Rank 4 — an inert mechanism (L19 shape)
`tests/d3-reminders-fire.spec.ts:49-50` destructures `{ page, context }`: `page` is the warm page owned by
`warmContext`, while `context` is the **built-in per-test context — a different browser context with no
page in this test**. `context.grantPermissions(['notifications'])` therefore grants on nothing. The test
passes only because line 57 overwrites `Notification.permission` directly. Dead code that reads as
coverage, plus an unused BrowserContext instantiated per run.

### Rank 5 — the suite writes into tracked repo files
The run I performed modified eight tracked PNGs under `mockups/` (`git diff --stat` after the run:
`mockups/gaps23-labeled-chips-he.png Bin 48522 -> 50166 bytes`, and seven more). Tests take screenshots
into the working tree. This makes "is the repo clean?" untrustworthy after any suite run and can mask a
real diff. Not a correctness bug; a hygiene one that costs time during review.

### Rank 6 — data-dependent silent skips
`tests/scheduler-placement.spec.ts:173` (`test.skip(keys.length < 2, …)`) and
`tests/waveDF-legibility.spec.ts:54` (`test.skip(!key, …)`) vanish silently if the catalogue changes.
Coverage shrinks without the count moving in a way anyone reads.

### Cleared — audited and found sound
- **Route leaks: none.** 24 `route` installs across the specs, 24 matching `unroute` calls, including
  every one installed on the shared warm page (`i18n-split`, `metered-streaming`, `voice-wave0`,
  `vg-classifier`, `vg-classifier-schema`). §3.2 of the authoring contract is respected everywhere. One
  stylistic gap: `service-worker.spec.ts:221`'s `unroute` is not in a `finally`, but the context is
  per-test so it cannot leak. In `metered-streaming` and `voice-wave0` the `await page.route(...)` sits
  one line *above* the `try {` — safe today, one edit from a shared-page leak.
- **Order dependence:** one file only, `warm-fixture.spec.ts`, `test.describe.configure({mode:'serial'})`
  — deliberate and correct (test B asserts the reset of what test A wrote).
- **`test.use` at file level:** two, both on files that use `isolatedPage` exclusively
  (`equipment-walkthrough.spec.ts:17` viewport, `p0-adddays-dst.spec.ts:12` `timezoneId`) — correct,
  since `test.use` reaches only the built-in context and would be silently ignored on the warm page.
- **Storage carry-over:** `seedApp` clears `localStorage`, `sessionStorage` and `window.name` every call.
- **Listeners:** the `warm` fixture's `removeAllListeners(…, {behavior:'wait'})` + `clearCookies()` handle
  it structurally.
- **Module-level mutable state:** none in any spec.
- **Cross-test disk coupling:** none — the only `readFileSync` calls read `dist/` build outputs produced
  before any worker starts.
- **`addInitScript` / `setOffline` / `page.clock`:** all reached only through `isolatedPage`. The R-57
  family (`vg-evstate`, `vg-rearm-gate`, `vg-stale-suppress`, `vg-schedule-cards`), `d1`, `d2`,
  `waveB-datetime`, `vg-voicesay`, `vg-voice-queue` all pin the clock and do **not** age.

---

## 8. What would make the failure return on demand, and what the options are

**To reproduce, any time, in ~80 seconds:**
```
npx playwright test tests/equipment-walkthrough.spec.ts tests/d2-bcheck-alert.spec.ts \
                    tests/vg-rearm-gate.spec.ts tests/p0-adddays-dst.spec.ts
```
**To reproduce without any browser, in ~20 seconds** — two concurrent HTTP GETs of a 2.4 MB body over
loopback; roughly half stall for 19 s. The harness scripts are in this session's scratchpad and are
trivial to re-create from §3.

**To identify the culprit driver — the owner's 5-minute test.** Run the raw-vs-HTTP harness (§3.3),
then disable **one** of `IDMWFP` / NordVPN's filtering / Norton's firewall, re-run, restore, repeat.
Single variable at a time. If HTTP goes clean while raw TCP stays clean, the disabled product is the
gate. This is a machine-configuration test and it is the owner's call to run it; I did not touch his
security software.

**Options for the code, ranked. None of these is applied — this report changes nothing.**

1. **Fix the machine, not the tests.** If §3.5 identifies the driver, an exclusion for loopback (or for
   `node.exe`/`chrome.exe`) removes the root cause the project has been building workarounds against
   since 2026-07-23. Every other option on this list is a workaround for it. This is the one that would
   let the warm-page architecture be a *speed* optimisation rather than a *survival* mechanism.
2. **Shrink the document.** The stall is size-graded: 64 KB was clean where 2.4 MB fails ~50%. The
   single-file PWA inlines everything into a 2.4 MB `index.html`. Nothing here argues for changing the
   product, but it explains why this project and not others.
3. **Give `isolatedPage` the in-memory document** — §4.1 proves it works (25/25, 12.4 s). It requires
   resolving two real conflicts first: `warm-fixture.spec.ts`'s L19 contract test, and
   `security-headers.spec.ts:26`, which installs its own `index.html` route to deliver real CSP headers
   (Playwright resolves routes LIFO, so a page-level route registered inside the test would still win —
   but that needs asserting, not assuming). It must stay off the `service-worker` project.
4. **Bound the exposure explicitly.** Whatever else is decided, the number of tests that navigate for real
   is currently 92 and unmeasured by any gate. If it is going to be the thing standing between the
   project and a lying green suite, it should be counted and asserted, not left to the scheduler.

**What I did not recommend and will not:** no retries, no longer timeouts, no `test.skip`, no
`--workers=1`, no weakened assertion. Raising the nav timeout above 20 s would convert these failures
into 29 s stalls and then into 30 s test timeouts — it would change the error message and nothing else,
which is **L19**'s placebo shape precisely.

---

## 9. Corrections this report makes to the recorded record

1. **The root cause is not "a shared Windows/chromium connection layer."** `docs/research/flake-refactor-rootcause.md`'s
   conclusion, quoted into `playwright.config.ts` and `tests/_fixtures.ts`, says the request "sits ~20 s
   inside chromium before it even reaches serve.js". §3.3 shows the stall with **no Chromium in the
   process at all** and with the *same bytes* passing flawlessly over raw TCP on the same socket layer.
   The cure the project derived (`route.fulfill` from memory) is **correct and should stay** — it works
   because it removes the HTTP transfer, which is the true variable. The *explanation* attached to it is
   wrong, and a wrong explanation is what sent this week's investigation to `items.json`.
2. **L30's stated cause is wrong** (§4.2). The setting stays; the reason must be corrected, or the next
   person watches the wrong number.
3. **The workers=24 result in `docs/analysis/2026-08-03-suite-performance.md` §4 is now explained.** It was
   not "the loopback wall is a threshold effect between 20 and 24 workers." Raising workers raised the
   number of *cold* worker `goto`s in flight at run start past what the F1 stagger de-phases, and the 39
   failures carried the identical nav-stall signature. The recommendation (keep 20) stands; the reasoning
   should name the gate.
4. **`04856ce` is the baseline for anything touching `df84324`**, and `b2ba95c` is not. Recorded so the
   next person does not repeat it.

---

## 10. What I did not do, stated plainly

- **I did not instrument in-flight navigation count inside a full suite run** (§4.3). The claim that the
  full suite stays under the cliff is inferred from consistency, not measured. It is the weakest link here.
- **I ran the full suite once, not 6–9×** (§11a's bar). One green run at 1176/1176 plus the brief's three
  is not a reliability certification and I am not claiming one.
- **I did not disable any security driver**, so §3.5 names candidates and does not identify the culprit.
- **I did not test workers between 16 and 20, or below 4.** The curve's shape is established; the exact
  floor is not.
- **The machine was not idle** (§1). Load was constant across runs so comparisons hold, but absolute
  numbers would improve on a quiet machine.
- **Nothing was changed, fixed, or committed.** The §4.1 instrument lived in a temporary worktree that has
  been removed; `git status --porcelain tests/ playwright.config.ts serve.js` is empty.

---

## 11. H9 — task summary

| | |
|---|---|
| **מה היה** | שער ירוק (1176 עוברות, exit 0, שלוש ריצות) לצד תת-קבוצה סבירה שנכשלת ב-80%. שלוש מסקנות סותרות נאמרו והופרכו. שורש הבעיה הרשום בפרויקט — "שכבת החיבור המשותפת של chromium" — מעולם לא נבדק מחוץ ל-Playwright. |
| **מה נעשה + ראיות** | האירוע שוחזר בדיוק (20/5 ב-a362b5a; 25/0 בבסיס האמיתי 04856ce). עקומת workers נמדדה — נכשל כבר ב-4 workers, בניגוד לתחזית שלי. המנגנון בודד **בלי דפדפן בכלל**: אותם 2,457,592 בתים עוברים ב-TCP גולמי 0/15 כשלים, וב-HTTP 16/32 כשלים עם תקיעות 19–29 שניות. הניסוי המכריע (הגשת המסמך מהזיכרון ל-isolatedPage) נתן 25/25, 12.4 שניות במקום 82 — ומפריך את השערת ה-CPU. סף למדוד ללקוח האמיתי: בין 4 ל-8 ניווטים אמיתיים בו-זמנית. |
| **מה נשאר** | לזהות איזה משלושת מנהלי-ההתקן (IDM / NordVPN / Norton) הוא השער — בדיקה של 5 דקות שרק הבעלים יכול להריץ. להכריע בין ארבע האפשרויות בסעיף 8. לתקן את L30 ואת שורש-הבעיה הרשום. |
| **איפה אנחנו** | אין רגרסיה במוצר. אין באג ב-Playwright. יש תקלה סביבתית במכונה שהפרויקט עוקף מאז 23.7 בלי לדעת מה היא, ושער שירוק בזכות תזמון. |
| **הבא בתור** | החלטת בעלים על סעיף 8. עד אז — שום דבר לא שונה, שום דבר לא נדחה, ואף בדיקה לא הוחלשה. |

---

## תקציר לבעלים

**צדקת. אנחנו לא דטרמיניסטיים — והשער הירוק ירוק בזכות מזל בתזמון, לא בזכות תקינות.**

מצאתי את המנגנון והוא לא באג שלנו ולא באג של Playwright: **במכונה הזאת יש משהו שמנתח תעבורת HTTP ותוקע תשובות גדולות על ה-loopback ל-19 או 29 שניות.** הוכחתי את זה בלי דפדפן בכלל — אותם 2,457,592 בתים בדיוק: ב-TCP גולמי 15 בקשות, אפס כשלים, 35 מילישניות. באותם בתים עם עטיפת HTTP: 16 כשלים מתוך 32, תקיעות של 19 שניות. אותו תהליך, אותה שנייה, אותו socket. שלושה מוצרי סינון-רשת רצים אצלך במקביל — **IDM, NordVPN ו-Norton** — ואחד מהם עושה את זה. איזה מהם, אתה יכול לגלות בחמש דקות; לא נגעתי לך בתוכנות האבטחה.

**מה זה אומר בפועל:** 92 בדיקות מתוך 1176 (7.8%) מנווטות באמת ל-`index.html` דרך הרשת. כל השאר מקבלות את המסמך מהזיכרון ולכן חסינות. הסוויטה עוברת כי המתזמן במקרה לא מסנכרן את ה-92 האלה — לא כי משהו מונע את זה. הסף שמדדתי ללקוח האמיתי הוא **בין 4 ל-8 ניווטים אמיתיים בו-זמנית**, ו-`workers` שלנו הוא 20. ברגע שמישהו מריץ תת-קבוצה, או שקובץ בדיקות גדל — זה נופל.

**שלוש תיקונים למה שרשום אצלנו:** שורש הבעיה הרשום ("שכבת החיבור של chromium") שגוי — התרופה נכונה, ההסבר לא, וההסבר השגוי הוא מה ששלח את החקירה השבוע ל-`items.json`. גם L30 שגוי: פרויקט ה-service-worker לא איטי כי service workers כבדים — כשהכרחתי אותו לרוץ במקביל, 8 מתוך 9 הכשלים היו timeout ניווט על `index.html`. והבסיס `b2ba95c` היה בתוך חלון הרגרסיה; הסוכן שאמר "קיים מלפני" צדק, הבקר שדרס אותו טעה.

**התיקון `e1bd8fb` נכון ולא מספיק** — הוא הוריד העברה אמיתית אחת של 185KB, אבל המנגנון הוא המסמך של 2.4MB. כשהרצתי ניסוי שמגיש גם אותו מהזיכרון: 25/25 עוברות ב-12.4 שניות במקום 20 כשלים ב-82. זה ניסוי, לא הצעה — הוא מתנגש בשתי בדיקות קיימות.

**לא שיניתי כלום ולא החלשתי שום בדיקה.** אין באג במוצר; אף כשל בכל הריצות לא היה כשל אמיתי של תוכן — כולם timeout ניווט. ההחלטה מה עושים היא שלך (סעיף 8), ואני ממליץ להתחיל בלתקן את המכונה ולא את הבדיקות.
