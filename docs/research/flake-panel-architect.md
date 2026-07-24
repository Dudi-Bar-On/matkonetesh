# Flake root-cause panel — the FIXTURE ARCHITECT-ANALYST's report

**Date:** 2026-07-24 · **Role:** design-side analyst on the warm-page flake panel. **Scope:** ANALYSIS
ONLY — no code changed; this file is the whole deliverable. I read the warm machinery
(`tests/_fixtures.ts`), its contract spec (`tests/warm-fixture.spec.ts`), `playwright.config.ts`,
`serve.js`, the design research (`docs/research/warm-page-architecture-research.md`), the Task-1 tracing
deviation (`.superpowers/sdd/task-1-report.md`), and — decisively — the **W0 measurement raw data**
(`docs/research/measurements/w0-2026-07-23T19-06-51-827Z.json`) and the instrument that produced it
(`scripts/w0-warm-page-measure.mjs`). I did **not** reproduce the flake (analysis task) and did **not**
read Playwright's tracing server source line-by-line — the one claim that rests on inference rather than a
read or a measurement is flagged as such.

**The flake:** a normally ~1 s navigation occasionally exceeds the 15 s `navigationTimeout`, failing ~half
of full-suite runs at **any** worker count (8w: 4/7 clean; 12w: 6/15 clean). Two real signatures:
1. `seedApp`'s `page.reload({waitUntil:'domcontentloaded'})` at `_fixtures.ts:165` > 15 s (the common one;
   repeatedly the heaviest-seed specs — active-hub / adaptive-home).
2. The worker-setup **cold** `goto` at `_fixtures.ts:50` (the `dclGoto` wrapper's `orig(url,…)` call, which
   in the flipped suite is only ever line 91's once-per-worker cold parse) > 15 s (12w rerun run 3).
   **Fresh-worker, empty-heap first-load stalls too — so page-state accumulation alone cannot be the whole story.**
Failures **cluster by run** (a run is clean, or has a burst); usually the heavy specs, but one run hit 7
unrelated files.

---

## The evidence I am anchoring on (measured, not recalled)

| Fact | Source | Value |
|---|---|---|
| Machine | `Win32_ComputerSystem` / `Win32_Processor` | **64 GB RAM, 32 logical CPUs** (8 P-core + 16 E-core i9-class; ≈24 physical) |
| Cold `goto` DCL, idle, single-thread | W0 `cold@200` | p50 **2155 ms**, p90 2164, mean 2246, **max 4883** (first-ever cold) |
| Warm `reload` DCL, idle, single-thread | W0 `warm-ephemeral@304` | p50 **1027 ms**, **p90 1927**, max 1939, min 116 — **bimodal ~135 / ~1910** |
| **JS heap across reloads (SAME page)** | W0 `warm-ephemeral`, both arms | **9.5 MB → 137 MB over 50 reloads — linear ≈ 2.5 MB/reload, NO plateau** |
| Heap measurement had tracing? | `scripts/w0-warm-page-measure.mjs:311-337` | **NO** — `Performance.enable` only; no `tracing.start`, no snapshotter/screencast |
| 200 vs 304 effect on DCL | W0 `@200` vs `@304` | **identical** (p50 1029 vs 1027) — transfer volume is **not** on the latency critical path |
| Persistent-context tail (rejected Option B) | W0 `warm-persistent@304` | p50 1788, **max 12073** — a 12 s single reload seen even single-threaded/idle |
| Tracing | `playwright.config.ts:44` | `trace:'retain-on-failure'` **ON**, project-wide |
| Tracing owner | `.superpowers/sdd/task-1-report.md` | @playwright/test's auto `ArtifactsRecorder` runs start + per-test `startChunk`/`stopChunk` on the **worker-scoped** `warmContext` — for its **whole ~55-test life** |
| serve.js | `serve.js` | single-process, in-memory, **no ETag/304** (D1 was *not* implemented), keepAlive 60 s, backlog 1024 |
| Test vs nav timeout | `playwright.config.ts:18,40` | test **30 s**, nav **15 s** — nav cap fires first and is what these failures hit |

Two facts reframe everything the earlier campaigns argued about:

- **64 GB / 24 cores means the machine is NOT globally exhausted at 8–12 workers.** The config's own L21
  note measured P-utility ≈69 % at 10 workers. So a **15 000 ms** stall is not aggregate CPU or RAM
  starvation — it points at a **resource that does not scale with cores**: memory bandwidth (one memory
  controller), the disk (one device), the single `serve.js` event loop, or a single OS service
  (Defender). This is the Occam correction that kills the "oversubscription" family of explanations.
- **The 2.5 MB/reload heap growth is measured with tracing OFF** (proven from the instrument's source).
  So the growth is **inherent to reload-on-a-reused-page for this app**, not a tracing snapshotter
  artifact. Tracing is a *separate, additive* stressor, not the cause of the leak.

---

## What the two signatures + the clustering JOINTLY force (the discriminator)

This is the reasoning that ranks the field before any single mechanism is argued.

1. **Signature 2 (fresh-worker cold `goto` stalls) rules out any purely per-page / per-context
   accumulation as a *complete* cause.** A restarted worker has a brand-new browser → new renderer → empty
   heap, empty V8 isolate cache, empty trace session. So renderer growth (c), trace-session growth (a),
   code-cache eviction (e), detached-DOM leaks — none of these, *acting inside the stalling page*, can by
   themselves explain a cold-goto stall. **The stall must reach the fresh page from OUTSIDE it** — i.e.
   through a resource shared across workers, or through the OS.

2. **"Clean-or-burst by run" is a threshold-with-positive-feedback signature.** A per-test independent dice
   roll would spread failures ~evenly across runs (Poisson-ish), not concentrate them into all-or-nothing
   runs. All-or-nothing means (i) a slowly-varying whole-run state pushes the machine toward an edge, and
   (ii) once crossed, something **amplifies** — one failure makes the next more likely **within the same
   run**. That amplifier is a named feature of this architecture (see (g)).

3. **The heavy-seed bias with occasional spread to unrelated files** means the *ignition* is
   load-correlated (heavy seeds allocate/build more), but the *propagation* is not tied to any one file.

So the shape of the truth is: **an ignition mechanism (load-correlated, per-page is fine here) crosses the
15 s line on one nav → an amplifier turns that single crossing into a by-run burst that also lands on the
most expensive operation in the whole design (the cold goto) and on unrelated files.** Any single-mechanism
story that cannot supply BOTH halves is incomplete. The two mechanisms that supply them are **(c)** for
ignition and **(g)** for propagation; **(a)** is the biggest *additive* push toward the edge and the
cheapest thing to disprove.

---

## Ranked failure modes

| # | Mechanism | Fits sig 1 (reload)? | Fits sig 2 (cold goto)? | Fits by-run burst? | Evidence status |
|---|---|---|---|---|---|
| **1** | **(c) reload-driven renderer heap growth** | **Yes — direct** | Only via cross-worker GC/mem-bandwidth contention | **Yes — threshold** | **MEASURED (W0), tracing-independent** |
| **2** | **(g) worker-restart cold-goto cascade** | Indirect (restart lands elsewhere) | **Yes — this IS the cold goto** | **Yes — the amplifier** | Architectural (from Playwright's own "kill worker on failure" + warm-start cost asymmetry) |
| **3** | **(a) worker-lifetime tracing session** | Additive push | Additive push (disk/Defender, cross-worker) | Yes (Defender = single service) | Config-confirmed ON; disk-accumulation sub-claim = inference |
| 4 | (d) serve.js single-process HOL | Weak | Weak | Possible (shared) | Measured non-causal for *latency* (200≡304) |
| 5 | (e) V8 code-cache eviction on reloads | Weak (2× not 15×) | No (cold has no cache) | No | Partly refuted by W0 (warm p50 ≪ cold, stable over 60) |
| 6 | (f) `clearCookies()` per test | No (wrong location) | No | No | App has 0 cookies |
| 7 | (b) `removeAllListeners{behavior:'wait'}` | No (teardown, not nav) | No | No | Signature location refutes it |

Detail, each with the cheapest decisive test.

### 1 — (c) Reload-driven renderer heap growth  ·  **PRIMARY IGNITION**

**Mechanism.** The warm design's defining novelty is a renderer that survives **50+ reloads** of a
2.7 MB-inline-JS app. The classic per-test-context architecture never did this — every test got a fresh
context → fresh renderer → fresh heap, torn down at test end. W0 measures the consequence directly and
damningly: `usedJSHeapSize` climbs **linearly ~2.5 MB per reload with no plateau** (9.5→137 MB over 50),
and it does so with **tracing off**, so it is intrinsic to reload-on-a-reused-page for this app (≈2.5 MB
is the size of the app's re-parsed `DATA`; the prior document's structures are not reclaimed between
reloads). Total renderer RSS (JS heap + detached DOM + layout + V8 metadata + the in-isolate code cache
the design depends on) is a multiple of the JS-heap number — plausibly several hundred MB per worker by
test ~50.

**Why it fits sig 1 (the common one).** Two compounding effects as a worker ages: (i) a larger, more
fragmented heap makes each `reload` allocate-and-GC more, lengthening DCL; (ii) the design's speed engine —
V8's *in-heap, source-keyed* isolate compilation cache — **lives on the same heap the leak is filling**;
the research flagged that "GC/memory pressure can evict it." An evicted cache reverts a warm reload toward
cold cost. W0 already shows warm reloads are **bimodal with p90 = 1927 ms** — half of all warm reloads
start at ~1.9 s *idle*. Those are the population with only ~8× headroom to 15 s; heap-pressure inflation +
contention closes that gap. Heavy-seed specs (active-hub/adaptive-home) build the most `DATA`-derived
state per reload → fastest heap growth, biggest GCs, least DCL headroom → they ignite first. **Fits the
heavy-spec bias exactly.**

**Why it reaches sig 2 (the hard part) and the clustering.** A per-page leak cannot touch a fresh
worker's page *from inside*. It reaches it through a **non-core-scaling shared resource: memory bandwidth
and the OS pager/GC.** By late in a run, 8–12 workers each hold a 100 MB+ growing heap and are each doing
frequent **major** GCs. Major GC is memory-bandwidth- and allocation-heavy; the memory controller is
shared by all cores, so 8–12 simultaneous major GCs saturate a resource that "24 idle cores" does not
relieve. A fresh worker's cold `goto` — which must itself allocate and parse 2.7 MB — runs into that storm
and stretches from 2.2 s toward 15 s. And because the pressure **rises monotonically over a run** (workers
age), this is a genuine **threshold-with-feedback**: runs that never quite cross 15 s are clean; a run that
crosses once tips into a burst (amplified by (g)). This is the only mechanism that supplies BOTH signatures
from ONE measured, tracing-independent cause — hence rank 1.

**Honest caveat (rigor).** W0 samples `usedJSHeapSize` **without forcing GC first**, so part of the climb
may be collectable garbage rather than a true unreclaimable leak. This does not weaken the ranking: a true
leak grows RSS → the tail; reclaimable-but-lagging garbage means more/longer GCs → also the tail. The
decisive test must force GC to *separate* the two (it changes the fix, not the diagnosis).

**Cheapest decisive test.** Two tiers:
- *Confirm-by-cure (cheapest, one variable):* make the warm fixture **recycle the page every N tests**
  (close + reopen `warmPage` → fresh heap, one extra cold parse per N), run the full suite 6–9× per §11a
  at N≈15. **PREDICT:** the flake rate collapses. If it does, (c) is the root cause.
- *Confirm-by-instrument:* per reload, CDP `HeapProfiler.collectGarbage` **then** `Runtime.getHeapUsage`
  + the renderer's OS RSS, logged with the **within-worker test index** and a run id. **PREDICT:** >15 s
  failures correlate with high within-worker index **and** high aggregate cross-worker RSS at that instant;
  forced-GC readings tell you leak vs GC-lag.

### 2 — (g) Worker-restart cold-goto cascade  ·  **PRIMARY AMPLIFIER**

**Mechanism.** Playwright guarantees "workers are always shutdown after a test failure." In the **classic**
architecture that was cheap insurance — every test was a cold goto, so a restarted worker's first test was
unremarkable. The **warm** architecture inverts the economics: it deliberately concentrates the single most
expensive operation in the design — the **cold 2.7 MB parse+compile+execute** (p50 2155 ms, max 4883 ms
*idle*; far worse under load) — into **worker startup**. Worker startup is **exactly what a failure
triggers.** So the recovery path is the worst-case path.

Now compose it with the 15 s < 30 s timeout gap: the `navigationTimeout` (15 s) fires **below** the test
timeout (30 s), so a nav that is merely *slow* (say 16–25 s under a burst) is **killed at 15 s and reported
as a failure** — not allowed to finish. Each such kill → worker shutdown → replacement worker → its cold
goto runs **into the same burst** that killed the last one → likely to also exceed 15 s → another kill.
**One ignition becomes a chain**, and because Playwright reassigns the dead worker's remaining files to
survivors/replacements, the chain lands on **whatever files those workers pick up next** — which is why one
run hit **7 unrelated files**. This is the amplifier the "clean-or-burst" shape demands, and it explains
signature 2's precise location (the cold goto at `_fixtures.ts:50/91`).

**Fit.** Sig 2: **it is literally the cold goto.** Clustering: it is the positive feedback. Sig 1: indirect
— the ignition is usually a reload (c); (g) propagates it. Heavy-spec bias: ignition-side (c); spread to
unrelated files: (g)-side. Complete.

**Cheapest decisive test (also the single best experiment for the whole panel).** Raise
`navigationTimeout` to **28 000 ms** (just under the 30 s test timeout) for one campaign, nothing else
changed. **PREDICT:** if the failures are slowness+cascade, most convert to **slow-but-PASSING** navs
(you'll see 16–25 s navigations that succeed) and the by-run bursts largely vanish — because a nav that is
merely slow no longer kills its worker, so the cascade never ignites. If instead you still get **30 s
test-timeout** failures, these are **true hangs** (a deadlock — look at serve.js connection wedging or a
CDP-protocol stall), not slowness, and the ranking shifts to (d). This one dial **splits the entire
hypothesis space into "slow+cascade" vs "true hang."** Pair it with a timestamped `console.error` in the
`warmPage` fixture (every cold goto = worker start) and in `warm` (every failure); **PREDICT:** each
signature-2 cold-goto failure is immediately preceded, in the same run's log, by another worker's failure.

### 3 — (a) Worker-lifetime tracing session  ·  **ADDITIVE STRESSOR, CHEAPEST TO DISPROVE**

**Mechanism.** `trace:'retain-on-failure'` + @playwright/test's auto `ArtifactsRecorder` starts a tracing
**session** on the worker-scoped `warmContext` and drives per-test `startChunk`/`stopChunk` on it for the
context's **entire ~55-test life** (Task-1 report, root-caused against 1.61.1 source). retain-on-failure
must record the full screencast + DOM/resource snapshots on **every** test (it cannot know in advance which
will fail) and discard on pass. The architectural point that is **mine to make:** the classic architecture
ran a tracing session **1 test long**; the warm architecture runs it **~55 tests long — a 55× extension of
the exact code path Playwright's common case never stresses.** Whatever is *session-lifetime* in that
subsystem (screencast machinery, snapshotter resource/dedup state, and — inference, not read — trace temp
files that on a per-test context are cleaned every test but here are only cleaned at **worker teardown**)
accumulates 55× longer, and it does so as **continuous disk writes across 8–12 workers.**

**Why additive, not root.** W0 proves the heap leak (c) exists with tracing OFF, so (a) is not the leak's
cause. But (a) is the biggest *extra* push toward the shared-resource edge that ignition needs, and on
**win32** it has a specific amplifier: **Windows Defender real-time scanning** of the trace artifact writes
(screencast frames + snapshot resources, streamed by every worker) is a **single, non-core-scaling service**
whose scan bursts stall disk/CPU machine-wide — a clean match for "clean-or-burst by run" (whether Defender
decides to scan/update during a given run is itself a slowly-varying whole-run state).

**Cheapest decisive test (do this FIRST — highest information per minute).** Full-suite A/B with
`trace:'off'`, single variable, 6–9 runs per §11a. **PREDICT:** if disk/Defender/screencast is a material
contributor, the flake rate drops noticeably (though (c)'s leak — and some residual (g) — will remain).
Second single-variable arm: add a **Defender exclusion** for `test-results/` + Playwright's trace temp dir
and re-run with tracing ON. If the exclusion alone moves the needle, the culprit sub-mechanism is named. If
neither `trace:off` nor the exclusion changes anything, (a) is refuted and the disk-accumulation inference
with it — spend no more on it.

### 4 — (d) serve.js single-process head-of-line

**Mechanism.** One Node event loop serves all 8–24 connections; no 304 (D1 skipped), so every reload
transfers the full 2.7 MB. Candidate: a reload storm (12 × 2.7 MB ≈ 32 MB/wave) head-of-lines the loop.

**Why low.** W0 shows **@200 ≡ @304 DCL** (1029 vs 1027) — cutting transfer from 2.7 MB to 300 B changed
DCL by nothing, so transfer volume is **not** on the latency critical path. serve.js does no per-request
disk I/O and no sync compute; `res.end(buf)` is async with kernel/`drain` backpressure, so it cannot block
the loop for **seconds**. A slow *client* (a busy/GC-ing renderer not draining its socket) stalls only its
**own** connection's write, not others'. serve.js was also just **de-clustered** (commit 77cd4c7) to remove
the zombie-respawn risk, so the historical wedge is gone. Net: unlikely to *originate* a 15 s stall, though
the no-304 full-payload churn does feed (c)'s memory-bandwidth pressure (2.7 MB re-decoded per reload ×
N workers). **Keep it as the prime suspect only if the (g) navTimeout=28 s test reveals true hangs.**

**Cheapest decisive test.** Add per-request server-side timing + a concurrent-connection high-water-mark
log to serve.js. **PREDICT:** handler service time stays sub-millisecond and connection count stays ≤~24
even during a client-observed burst → the stall is downstream of the server (browser/OS), refuting (d).
(A true-hang finding from the (g) test would instead direct you to log socket/keepAlive state here.)

### 5 — (e) V8 code-cache eviction on repeated same-doc reloads

**Partly refuted already.** W0: warm p50 1027 ≈ **half** of cold p50 2155 → the isolate cache is
demonstrably working; and over 60 sequential reloads warm max stayed ~1939 (did **not** drift toward the
2155 cold cost), so within that window the cache is **not** being evicted. Eviction would produce a **~2×**
slowdown (warm→cold), not a **~15×** stall, and it **cannot** explain sig 2 (a cold goto has no cache to
lose). It is at most a contributor to (c)'s body-of-distribution once heap pressure gets extreme — a
consequence of (c), not an independent cause. **Cheapest test:** log `V8.CompileScript` "consumed cache"
vs "produced cache" per reload late-in-worker vs early (CDP `disabled-by-default-v8.compile`); **PREDICT:**
"consumed" persists late unless aggregate heap pressure is extreme — i.e. it tracks (c), not the tail.

### 6 — (f) `context.clearCookies()` per test

The app uses **zero** cookies (research Q2 table); `clearCookies` is a cheap CDP call and, critically, sits
in **teardown** — a stall there surfaces as the *previous* test's 30 s test-timeout, not as a 15 s
navigation timeout at line 165/50. Wrong signature location, no state to clear. **Refuted by location.**
Test: delete it, expect no change.

### 7 — (b) `removeAllListeners(undefined, {behavior:'wait'})`

`behavior:'wait'` can block on an in-flight handler — but again in **teardown** (line 121), so it would
manifest as a test-level (30 s) timeout on the *ending* test, not as a navigation timeout at line 165/50 on
the *next* one. The app's listener surface is ~1 test (`page.on('console')`) and there are no routes to
hang on. **Wrong signature location; minimal surface. Refuted.** (Genuinely, per §12.6, this is the kind of
lead the signature already fault-excludes — don't spend on it.)

---

## Verdict — top 2

**#1 (c) reload-driven renderer heap growth — the ignition.** It is the only mechanism backed by **hard,
tracing-independent measurement** (≈2.5 MB/reload, 9.5→137 MB/50, no plateau), it is the warm design's
defining novelty (a renderer that outlives 50+ reloads, which the classic architecture never had), it
directly produces the slow reloads of signature 1 (with p90 already at 1927 ms idle — the population that
blows the 15 s cap under load), and — through aggregate major-GC / memory-bandwidth contention across
aging workers, a shared non-core-scaling resource — it is the one per-page cause that can also reach a
**fresh** worker's cold goto (signature 2) and produce the rising-pressure, clean-or-burst clustering.

**#2 (g) worker-restart cold-goto cascade — the amplifier.** The warm design concentrates its single most
expensive operation (cold 2.7 MB parse) into worker startup, which is exactly what Playwright's
kill-worker-on-failure triggers; and the 15 s navTimeout sitting **below** the 30 s test timeout means
merely-slow navs are killed rather than allowed to finish, so each kill restarts a worker whose cold goto
runs back into the same burst. This converts one ignition into a by-run burst, explains signature 2's exact
location, and explains the spread to 7 unrelated files (reassigned work after restarts).

**(a) worker-lifetime tracing** is the largest *additive* push toward the edge (55× session, continuous
cross-worker disk writes, Windows-Defender-amplified) and the **cheapest to disprove**, so it is the first
experiment to run even though it is not the root.

The composed thesis: **(c) ignites** (a heavy reload crosses 15 s under rising per-worker heap pressure +
aggregate GC/bandwidth contention), **(g) propagates** (the kill restarts a worker whose cold goto — the
design's worst-case op — re-crosses 15 s in the same burst), and **(a) lowers the ignition threshold**
(disk/Defender/screencast overhead on a 55×-longer session). This single model accounts for **both**
signatures, the by-run clustering, the heavy-spec bias, the spread to unrelated files, and independence
from worker count — nothing else does.

---

## Exact instrumentation I would add (analysis names it; I changed nothing)

Run the experiments in this order; each is a **single variable** (PREDICT→TEST→OBSERVE→CONCLUDE, never two
at once), full suite `npx playwright test` plain, 6–9 runs per §11a on an idle machine:

1. **The splitter — `navigationTimeout: 28_000` for one campaign.** OBSERVE whether failures convert to
   slow-but-passing navs (→ slowness+cascade: (c)+(g)) or stay as 30 s **true hangs** (→ look at (d)/CDP).
   This alone re-partitions the whole investigation and costs one number.
2. **`trace:'off'` A/B** (and a second arm: tracing ON + a Windows-Defender exclusion on `test-results/` +
   the Playwright trace temp dir). OBSERVE the change in flake rate → sizes (a)'s contribution and settles
   the disk/Defender sub-claim.
3. **Heap/RSS probe in the fixture.** In `warm` per test, via a per-worker CDP session: `HeapProfiler.collectGarbage`
   then `Runtime.getHeapUsage`, plus the renderer process RSS, logged as `{runId, workerIndex,
   testIndexInWorker, specFile, usedHeap, rss}`. OBSERVE the correlation of >15 s failures with high
   within-worker index and high **aggregate** RSS; forced-GC separates true-leak from GC-lag. Confirms (c)
   and tells you the fix (recycle-every-N vs. hunt the retainer).
4. **Cure probe for (c) — recycle `warmPage` every N≈15 tests** (close+reopen → fresh heap). If the flake
   collapses, (c) is proven root and the fix is chosen at the same stroke. (This is a **diagnostic** run,
   not a shipped change — the panel decides the real remedy.)
5. **Cascade log.** Timestamped `console.error` on every cold goto (`warmPage`) and every failure (`warm`),
   parsed after a bursty run. OBSERVE whether each signature-2 cold-goto failure is preceded by another
   worker's failure in the same run → confirms (g).
6. **serve.js counters** (only if step 1 shows true hangs): per-request handler ms + concurrent-connection
   high-water mark. OBSERVE sub-ms handler time / bounded connections → refutes (d) and redirects to
   CDP-protocol / socket state.

**One-line design note for the panel (outside my "change nothing" scope, flagged not done):** if (c)+(g) is
confirmed, the two structural levers are (i) **bound the per-worker reload count** (recycle the warm page,
or cap tests-per-worker) so no renderer ages past the pressure knee, and (ii) **remove the timeout
inversion** so slow≠killed doesn't feed the cascade — but the correct remedy is the panel's call under §4,
not this analyst's.
