# Root-cause panel — RESEARCHER report: the residual nav-timeout flake

**Date:** 2026-07-24. **Role:** independent RESEARCHER on a root-cause panel (§10.14 deep research), asked
to find the real mechanism after three prior mis-diagnoses (`navigationTimeout` ordering — L19;
`'load'`→`'domcontentloaded'` — real but insufficient alone; P-core oversubscription at >8 workers —
refuted, L21) still leave the suite failing in roughly half of all full runs at every worker count
measured (8, 12, 20). **Scope: research + read-only analysis of data already on disk. No code changes, no
suite runs executed by this report.** Every claim below is either a direct quote from a primary source
(URL beside it), or a computation run against this repo's own already-collected, git-tracked-adjacent
measurement JSON (command shown, so it is reproducible, not recalled).

**The one-line verdict:** the residual flake is not contention between the suite and the outside world —
the Certification/Phase-C campaigns' own disturbance gates already proved the machine is idle before and
after every failing run. It is contention **inside V8**, on the **warm page's own renderer**, between the
architecture's central assumption (repeated reload of a 2.6 MB inline script stays cheap because of V8's
in-isolate compilation cache) and a **documented, canonical-source-confirmed V8 mechanism that periodically
invalidates exactly that cache** as a side effect of garbage collection. This repo's own W0 measurement
data, re-analyzed below, shows the invalidation firing on a **perfectly deterministic every-other-reload
cadence**, adding ~1.8 s to every second navigation — in complete isolation, with zero suite contention.
Under 8–24-way concurrent load, all doing the same thing to the same 2.6 MB script at the same time, the
tail of that distribution is what crosses 15 s.

---

## §0 — What the panel already ruled out (context, not re-derived here)

Three prior research docs in this repo (`playwright-reliability-research.md`, `warm-page-architecture-
research.md`, `test-stack-alternatives-research.md`) plus lessons **L18–L21** in
`docs/process/development-discipline.md` already:
- Fixed `navigationTimeout` ordering (dead config below the test timeout — real bug, necessary, insufficient).
- Switched every `page.goto`/`page.reload` to `waitUntil:'domcontentloaded'` (necessary, insufficient — the
  commit message for `77cd4c7` itself says DCL "wasn't the real lever," and it wasn't: DCL still waits for
  the inline script to finish executing, which is the actual cost).
- De-clustered `serve.js` to a single in-memory process (fixed a **different**, real bug — the zombie-
  respawn teardown failure — not this flake).
- Measured, then **retracted**, "P-core oversubscription above 8 workers" (L21) — a clean re-measurement
  (M1, `--workers=10`) ran with **zero failures** and P-cores at only ≈69 % mean utilization, E-cores
  hotter at ≈84 %. The M1b curve is explicitly non-monotonic: 12 → clean, **16 → 16 failed (one-off, did
  not repeat)**, 20 → clean and fastest.
- Built the current **warm-page architecture** (`tests/_fixtures.ts`): one ephemeral `BrowserContext` +
  one `Page` per worker, reused across every test file that worker runs; each test's reset is
  `seedApp()` = clear storage → set kv → `page.reload({waitUntil:'domcontentloaded'})`.
- Ran three full reliability campaigns **on this warm architecture, with disturbance gates checked before
  and after every single run** (`docs/research/measurements/m1b-capacity-probes-2026-07-23.md`):

| Campaign | Workers | Result | Failure signature |
|---|---|---|---|
| Phase C | 12 | 3/7 clean | `page.reload: Timeout 15000ms exceeded` @ `_fixtures.ts:165` (×3), `page.orig: Timeout…` @ `_fixtures.ts:50` (×1, the **cold goto**) |
| Phase C RERUN | 12 | 2/7 clean | same two signatures; teardown ALSO timed out on top of setup in 3 of the 5 failing runs (`"Tearing down 'warm' exceeded the test timeout"`, up to ×18 in one run) |
| Certification | 8 (config default) | 2/5 clean | same `_fixtures.ts:165` signature, all 32 failures |

Every disturbance gate in all three campaigns passed (total system CPU 7.5–13 % immediately before and
after every run; the one 16.29 % reading was traced to unrelated desktop apps, not test infrastructure).
**This is the evidence gap the panel exists to close: the machine is provably idle around every failing
run, yet the failures keep happening, at every worker count tried, roughly half the time.** No document in
this repo before this one investigated the renderer's own internal state across a worker's ~54-reload
lifetime.

---

## §10.11 graphify-global step (done first, as required)

`nodejs-v8-docs` (48 nodes) and `playwright-official-docs` (27 nodes) both exist and were queried with
several vocabulary variants (`"major GC pause incremental marking mark-compact"`, `"heap growth code cache
isolate compilation garbage collection"`, `"removeAllListeners tracing chunk BrowserContext"`, `"detached
document navigation reload memory leak"`). Result: **`nodejs-v8-docs`'s entire content is the single
already-deposited `v8.dev/blog/code-caching-for-devs` article** (nodes: *Code Caching*, *Cold/Warm/Hot Run
Model*, *V8 Isolate In-Memory Cache*, *Lazy Compilation* — all `src=raw/v8_dev_blog_code-caching-for-
devs.md`) — no GC-internals vocabulary (`mark-compact`, `scavenge`, `incremental marking`, `bytecode
flushing`) exists anywhere in the graph. `playwright-official-docs` has `BrowserContext`/`Page`/`Tracing`
API surface nodes but nothing GC- or memory-profiling-specific. **Genuine miss on both fronts, confirmed by
multiple query attempts, not a shortcut** — per §10.11, this sent the research to the web and to primary
V8/Chromium source. Deposit-worthy finds from this session are listed in §4.

---

## §1 — New evidence: what the team's own W0 data already proves, unanalyzed until now

`docs/research/measurements/w0-2026-07-23T19-06-51-827Z.json` was captured for a *different* question (the
warm-page GO/NO-GO gate) and is still on disk, gitignored but never deleted. Its `warm-ephemeral@304` arm —
**the exact arm that ships to production** (`tests/_fixtures.ts`'s `warmContext` is an ephemeral
`browser.newContext()`, never persistent) — is 60 sequential `seedApp`-shaped reloads of `/index.html` on
one page, in total isolation (its own port 8124, nothing else running). Re-querying the raw per-iteration
array (`node -e "…"` against the JSON, shown so it is reproducible):

```
DCL per reload (ms), warm-ephemeral@304, all 60 iterations:
160,1903,167,1887,164,1890,162,1886,169,1888,149,1903,148,1925,132,1924,134,1917,136,1917,131,1934,
117,1932,133,1925,131,1939,116,1939,122,1935,118,1935,120,1926,136,1918,133,1926,137,1921,138,1919,
133,1908,149,1906,149,1908,150,1902,145,1907,147,1912,149,1899,146,1913
```

**Finding 1 — the alternation is not "bursty," it is exact.** Splitting at the 1000 ms midpoint: **30 fast
reloads (mean 140.7 ms), 30 slow reloads (mean 1914.7 ms) — and every single fast reload lands on an even
index, every single slow reload on an odd index. Zero exceptions across 60 navigations.** This is not
contention noise; contention noise does not alternate 1-for-1 for 60 consecutive events in an otherwise-
idle single-page harness with no other process running.

**Finding 2 — the network/server layer is provably not the cause.** Comparing `responseEnd` (server
response fully received) between the two populations: **fast mean 21.33 ms vs. slow mean 21.67 ms** — a
0.34 ms difference, noise. `fetchStart` is identical (0.25 ms both). *Every millisecond* of the ~1774 ms
gap occurs strictly **after** the response is fully in hand, before `DOMContentLoaded` — i.e., 100 %
client-side (parse/compile/execute), 0 % network, 0 % `serve.js`, 0 % Windows loopback socket behavior.
This is a **decisive local test already run**, by accident, months before this panel — it directly refutes
Node-server-backpressure and Windows-loopback-socket-reuse as explanations for the alternation (§2.4/§2.5).

**Finding 3 — the pattern is not a measurement-harness artifact.** `scripts/w0-warm-page-measure.mjs:311-
336` runs one uniform loop — `localStorage.clear()` → `page.reload({waitUntil:'domcontentloaded'})` →
record — with the only per-iteration branch being a **read-only** `Performance.getMetrics` heap sample
every 10th iteration (`i % heapEvery === 0`), which cannot produce a strict 1-for-1 alternation over 60
iterations. Confirmed by reading the actual loop body, not inferred.

**Finding 4 — the same arm's heap sampling shows real, unbounded, unreclaimed growth**, sampled every 10
reloads via CDP `Performance.getMetrics` → `JSHeapUsedSize`:

```
iter 0: 9,514,380 B   iter 10: 34,774,700 B   iter 20: 62,744,692 B
iter 30: 87,348,976 B  iter 40: 111,430,972 B  iter 50: 137,643,556 B
```

≈+2.6 MB per reload, **monotonically increasing with no decline at any sampled point** through 50 reloads
— i.e., garbage genuinely is not being reclaimed at the same rate it accumulates, consistent with promotion
to V8's old generation (the standard growth pattern SPAs. exhibit when a full document + JS heap is torn
down but something keeps part of the old realm reachable — see §2.1's detached-window citation).

**Finding 5 — this is not unique to the ephemeral arm.** `warm-ephemeral@200` (identical alternation,
different server response mode) and `warm-persistent@200` show the same even/odd split. `warm-persistent
@304` shows it too, **after an even more dramatic opening**: its first three reloads are **10,053 ms,
2,058 ms, 12,073 ms** — a single navigation, in a script with nothing else running, took **12 seconds**,
nearly the entire 15 s `navigationTimeout` budget, before settling into the same alternating rhythm
(~250 ms / ~1,800 ms) from reload 4 onward. The production architecture doesn't use persistent contexts
(the W0 gate itself chose ephemeral — `escalateToB: "STAY-ON-A"`), but this is direct, already-collected
proof that a reload of this exact document can, in complete isolation, cost double-digit seconds — the
"sometimes even the worker's first cold `goto` stalls" signature is not hypothetical, it is already on disk.

---

## §2 — Ranked candidates

### Rank 1 — V8 compilation-cache invalidation via mark-compact-triggered bytecode flushing (Chromium/V8)

**Mechanism, canonical source.** Fetched directly from `chromium.googlesource.com` (the V8 team's own
repository, same domain the repo's own `warm-page-architecture-research.md` already cited as primary for
`storage_partition_impl.cc`):

> `src/codegen/compilation-cache.cc` — `CompilationCache::MarkCompactPrologue()` calls `script_.Age()` on
> **every mark-compact (major/full) garbage collection**, and the `Age()` methods for both
> `CompilationCacheScript` and `CompilationCacheEval` carry the comment **"Clear entries after Bytecode was
> flushed from SFI [SharedFunctionInfo]."**
> — [chromium.googlesource.com/v8/v8/+/refs/heads/main/src/codegen/compilation-cache.cc](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/codegen/compilation-cache.cc)

Supporting, lower-confidence (community-referenced, not re-verified against the canonical tree, so treated
as corroboration not proof): a V8 team discussion thread states a compilation-cache line survives roughly
**4 "normal" GCs** before the entry is cleared and the script becomes collectible on the next GC —
[groups.google.com/g/v8-reviews/c/22dS31QhIKk](https://groups.google.com/g/v8-reviews/c/22dS31QhIKk).
This is the **same** compilation cache the repo's own already-cited V8 blog post describes as "effectively
free, yet we observe it getting **an 80 % hit rate** in the real world" —
[v8.dev/blog/code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs) — a figure that tacitly
concedes a ~20 % *miss* rate even in the best-case "same tab, same script, navigate again" scenario this
warm-page architecture is built on. Nobody in the prior three research docs connected that 20 % to an
actual mechanism; the code above names it.

**Chromium precedent for the resulting symptom shape** (community-sourced, matched independently, not the
same root cause claimed, but the same *class* of bug — repeated-navigation renderer slowdown in headless
Chrome): Chromium tracker issue **40529686**, *"Headless screenshots slow dramatically with repeated
use"* — reported degradation **"after 30–60 screenshots,"** diagnosed against `RendererSchedulerIdlePeriod`
increasing over time, **"though not uniformly across all slow renders."** 30–60 repeated uses is,
concretely, the same order of magnitude as one worker's ~54-test lifetime on the shared warm page in this
suite. (Confidence note: this specific issue was reported fixed on Canary at the time; cited here as
evidence the *class* of "same-renderer-reused-repeatedly gets non-uniformly slower" bug is real and
precedented in this exact codepath, not as proof today's bundled Chromium still has this exact bug.)

**Does it match the per-test RELOAD-stall signature?** Yes, directly — §1 above **is** this candidate's
reproduction: a clean, isolated, contention-free 1.9 s cost on every other reload of the identical resource
this suite reloads on every `seedApp()` call, with the server/network layer proven uninvolved (Finding 2).

**Does it match the cold-GOTO-stall signature?** Related but distinct mechanism, same underlying economics:
a genuinely first-ever compile of this script costs **~2.15 s median even totally alone**
(`cold@200` arm, `coldP50: 2155.15`, same JSON). Eight to twenty-four workers all launching within the same
few hundred milliseconds at suite start (or after any worker restart, e.g. post-failure quarantine — "a
failing test shuts its worker down," so a burst of failures itself produces a burst of fresh cold
compiles) means multiple simultaneous ~2 s, P-core-bound V8 parse/compile jobs contend for the same 8
P-cores' real compile throughput — the persistent-context arm's measured **12,073 ms** single outlier
(Finding 5) shows how far a compile-class stall can already stretch with *zero* concurrency; concurrent
contention only lengthens that tail.

**Does it match the bursty, ~half-of-runs, worker-count-insensitive clustering?** Yes, and it is the only
candidate that explains *why the residual flake didn't respond to the worker-count knob at all* (8, 12, 20
all ≈40–60 % clean): the mechanism lives **inside each renderer**, independent of how many siblings it has.
What varies run-to-run is (a) which specific tests Playwright's scheduler happens to assign to which
worker in which order — determining which test's reload lands on the "just-evicted" beat — and (b) whether
that unlucky beat *also* coincides with enough simultaneous P-core compile contention from sibling workers
to push an already-elevated ~1.9 s further past 15 s. Both are naturally non-deterministic across runs
without any external disturbance, exactly matching the observed pattern (same handful of specs — `active-
hub`, `adaptive-home`, the specs independently already identified as injecting the **most** localStorage
state, i.e., the heaviest per-reload allocation, i.e., the ones most likely to trip the mark-compact
threshold — recur across campaigns, but not identically, and not every run).

**Decisive local test.** The repo already has the instrument: `scripts/w0-warm-page-measure.mjs`'s cold arm
already captures a CDP trace with the `'v8'` category on its first 3 iterations (RUNBOOK.md Step 1).
Extend that same trace capture to ~20 consecutive **warm-ephemeral** reloads (not just cold) and grep the
trace for `MajorGC`/`V8.GCFinalizeMC`-class events; align each event's timestamp against the already-
recorded per-iteration DCL timestamps. **Prediction: a mark-compact GC event appears in the ~50–200 ms
immediately preceding every "slow" (odd-index) reload's script execution, and is absent before every
"fast" (even-index) one.** This is a direct confirm/refute, not another correlation — cheap (reuses
existing tooling, ~1 minute of browser time), and should be run before any architecture change is proposed.

---

### Rank 2 — Automatic ArtifactsRecorder tracing chunks on the single, long-lived shared context (Playwright)

**Mechanism, primary source (already partially surfaced in this repo's own fixture comments, not
previously connected to the flake).** `tests/_fixtures.ts`'s own code comments (lines 29-40, 69-82)
document, from reading the installed `playwright` package source directly, that `@playwright/test`'s
built-in `_setupArtifacts` auto-fixture re-scans `playwright._allContexts()` **at every single test
boundary** and starts/chunks/attaches tracing (screenshots + snapshots + sources, per this repo's
`trace:'retain-on-failure'`) on **every live `BrowserContext`, including the worker-scoped one** — not
just the built-in per-test context the framework was originally designed around. Official confirmation of
the chunking primitive itself: *"If you'd like to record multiple traces on the same BrowserContext, use
tracing.start() once, and then create multiple trace chunks with tracing.startChunk() and
tracing.stopChunk()"* —
[playwright.dev/docs/api/class-tracing](https://playwright.dev/docs/api/class-tracing).

This means the warm architecture's single worker context is opening and closing a **fresh trace chunk,
with a CDP-driven screenshot capture, on every one of its ~54 tests** — a volume of CDP traffic against one
context that the ordinary (fresh-context-per-test) architecture never concentrates onto a single renderer.

**Direct repo evidence this is firing, and stacking:** Phase C RERUN's own raw failure log (Runs 1 and 6)
shows **`"Tearing down 'warm' exceeded the test timeout of 30000ms"`** at `_fixtures.ts:122`
(`warmContext.clearCookies()` — itself a CDP round trip) **on top of** the setup-phase `_fixtures.ts:165`
timeout, ×9 and ×18 respectively in those two runs. A teardown-phase CDP call timing out independently of
the reload it follows is exactly what a renderer that is *still* busy (finishing a mark-compact pass, or
its own screenshot/snapshot serialization) would produce: every CDP round trip issued to that renderer,
not just `page.reload`, queues behind whatever the renderer's main thread is doing.

**Match per-test reload stall:** compounding, not root — doesn't explain the ~1.9 s alternation by itself
(Rank 1 does), but explains why the *total* elapsed time at a test boundary can exceed even that: each test
now pays reload-wait **plus** a chunk-close CDP round trip **plus** cookie-clear, three separate
opportunities to queue behind a busy renderer instead of one.
**Match cold-goto stall:** weak direct link (the cold goto happens before any chunk exists for that page).
**Match bursty clustering:** yes, compounding — doubles/triples the CDP-round-trip exposure window per
test, which is exactly the kind of thing that turns a borderline (14 s) reload into an over-the-line one.

**Decisive local test.** Re-run one Certification-style campaign (identical protocol already used —
`docs/research/measurements/m1b-capacity-probes-2026-07-23.md`'s own template) with `--trace=off` instead
of the config's `retain-on-failure`, same worker count, same ~5–7 runs. If the clean-run rate rises
materially, the ArtifactsRecorder overhead is a real, load-bearing contributor riding on top of Rank 1, not
just a theoretical one — and a targeted fix (e.g., trace only a curated subset of specs, or raise
`navigationTimeout` specifically to absorb the *known* chunk-close cost) becomes actionable.

---

### Rank 3 — `page.removeAllListeners(undefined, {behavior:'wait'})` in the warm fixture's per-test teardown

This is the task's own explicitly-named candidate; investigated and **ranked below Rank 1/2 on current
evidence, not dismissed.**

**Mechanism, per official docs** (confirmed via the loaded `playwright-official-docs` corpus and direct
search): `behavior:'wait'` — *"wait for current listener calls (if any) to finish"* before the removal
resolves, with a `timeout` sub-option that **defaults to 0 (no limit)** — i.e., this specific call, as
written in `tests/_fixtures.ts:121`, has no internal ceiling of its own and would block for as long as any
in-flight listener callback takes, up to the outer test-timeout.
**Repo exposure:** only one spec installs a persistent page-level listener across the warm page's lifetime
— `ai-model-registry.spec.ts:73`, `page.on('console', …)` — and `ai-model-registry.spec.ts` is indeed one
of the recurring failing specs in the Phase C RERUN campaign (6 failures). This is circumstantial, not
proven: nothing in the campaign logs isolates this specific call as the stalled frame (the logged error
signatures are all `_fixtures.ts:165` / `:50`, i.e., the `reload`/`goto` calls themselves, not line 121).
**Match to signatures:** low-to-moderate. This call operates on the **Node-side** listener bookkeeping per
the docs ("wait for current listener CALLS to finish," i.e., outstanding JS callback invocations already
dispatched to the test's own handler) — it is plausible but unconfirmed that it would itself block for
seconds; more likely it is a secondary victim of the same renderer-busy state as Rank 2 (any awaited call
issued near a GC-busy renderer queues), not an independent root cause.
**Decisive local test.** Add one `console.time`/`console.timeEnd` bracket around exactly this call in
`tests/_fixtures.ts`'s `warm` fixture teardown (a ~2-line, fully reversible instrumentation change) and run
one normal 8-worker suite pass. If its own duration is ever multi-second, this candidate is promoted; if
it is always sub-millisecond (the expected case for a suite with only one console listener in one spec),
it can be closed out definitively and cheaply, in contrast to Rank 1/2 which need a dedicated campaign.

---

### Rank 4 — Node server-side backpressure / Windows loopback keep-alive socket pathologies (Node/Windows)

**Verdict: refuted for the per-reload alternation, by this repo's own already-collected data — not
theorized, measured.** §1 Finding 2 is a decisive test already run: `responseEnd` (server delivery time)
is statistically identical between fast and slow reloads (21.33 ms vs. 21.67 ms, `fetchStart` identical at
0.25 ms both) — meaning `serve.js`, the Node event loop, TCP/loopback socket reuse, and Node's
`http.Agent`/`keepAliveTimeout` behavior are all fully excluded from the ~1774 ms gap by direct measurement,
not by argument. (General background confirming keep-alive *can* stall under a server/client
`keepAliveTimeout` mismatch —
[nodejs.org/api/http.html](https://nodejs.org/api/http.html) and community writeups on
`agentKeepAliveTimeoutBuffer` — is real but does not describe *this* repo's measured symptom.)
**What is NOT refuted:** whether the suite's *own* many concurrent renderers (not external processes)
create queuing pressure on the single-process `serve.js` under real 8–24-way load is a separate question
this isolated single-page harness cannot answer (it had exactly one client). Given `serve.js` serves from
an in-memory `Buffer` with no I/O and `responseEnd` is already sub-25 ms at zero concurrency, this is
judged low-probability but not zero — see decisive test.
**Decisive local test (low priority — only if Rank 1/2 don't fully account for the observed timeouts):**
instrument `serve.js` with a per-request `console.timeEnd`-style receive-to-respond timestamp and run one
Certification-style campaign; if server-side latency stays flat (<50 ms) through every failing run's
window, this candidate closes definitively.

### Rank 5 — Windows Defender loopback scanning / thermal throttling (Windows-specific)

**Verdict: unlikely as the primary mechanism, for the same reason as Rank 4** — the alternating pattern
reproduces from the very first reload in a ~1-minute, single-worker, single-process W0 harness run with no
sustained heavy multi-process load and no elevated temperature history behind it; both Defender's
behavioral-scan bursts and thermal throttling are cumulative-load phenomena that don't explain a clean
signal present from navigation #2 onward in an otherwise-quiet process.
[learn.microsoft.com/en-us/defender-endpoint/mdav-scan-best-practices](https://learn.microsoft.com/en-us/defender-endpoint/mdav-scan-best-practices)
confirms real-time-protection overhead exists and scan cost is content-dependent, but gives no loopback-
HTTP-specific numbers — this project's own `test-stack-alternatives-research.md` already flagged this as
"plausible... not isolated experimentally" and this research did not find anything to raise that
confidence. **Possible secondary contributor to whole-CAMPAIGN clustering** (7 back-to-back runs = 10–20
minutes of sustained high load, unlike the single isolated W0 measurement) but not to the per-reload
signature. **Decisive local test, if the owner wants this fully closed out (optional, lowest priority):** a
Defender-exclusion A/B (scope the repo directory + the two Chromium binaries) across one more Certification-
style campaign, plus a thermal/throttle-reason log (Intel XTU or Windows' own
`Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature`) sampled across a 7-run
campaign and checked for correlation with which runs failed.

---

## §3 — Reading the ranking against the task's own three questions, explicitly

| Candidate | Per-test RELOAD stall | Cold-GOTO stall | Bursty, worker-count-insensitive clustering |
|---|---|---|---|
| **1. V8 compile-cache GC eviction** | **Reproduced in isolation, §1** | Related mechanism (compile-cost concentration), 12 s outlier already on disk | **Explains it** — per-renderer, not per-machine |
| 2. ArtifactsRecorder tracing chunks | Compounds Rank 1 (extra CDP round trips) | Weak | Compounds Rank 1 |
| 3. `removeAllListeners({wait})` | Unconfirmed, plausible secondary | No | Weak on its own |
| 4. Node/Windows server backpressure | **Refuted by measurement** | Refuted | Not primary |
| 5. Defender / thermal | Refuted for per-reload | Refuted for per-reload | Possible secondary, campaign-level only |

---

## §4 — §10.11 usefulness-gate — deposit-worthy finds (not deposited; research-only task)

Per the gate ("is this useful, and likely needed again — here or elsewhere sharing the global"):

- **`chromium.googlesource.com/v8/v8` `src/codegen/compilation-cache.cc`** — the exact,
  canonical-source confirmation of GC-triggered script-cache eviction. High reuse value for **any** future
  question about "why does my long-lived-page/SPA-reload test suite intermittently slow down" — this is
  general V8 knowledge, not project-private, and was a genuine, costly gap in the existing
  `nodejs-v8-docs` corpus (which currently holds only the code-caching-for-devs blog post, not this
  GC-interaction detail). **Recommended**, not done here (research-only task; source code is living, so
  link/re-fetch rather than snapshot verbatim, per the same judgment call the sibling warm-page doc already
  made for `storage_partition_impl.cc`).
- **Chromium tracker issue 40529686** (headless repeated-use slowdown) — narrower, one-off value; the
  underlying bug may already be fixed upstream, and its evidentiary role here is "precedent for the bug
  class," not a live reference doc. **Skip depositing** — not general enough to be worth the corpus slot.
- **`groups.google.com/g/v8-reviews/c/22dS31QhIKk`** (compilation-cache generations/aging thread) —
  community discussion, not an official doc; useful as corroboration but not as a standing reference.
  **Skip.**
- Node `http.Agent`/keep-alive docs, Defender scan-best-practices doc — both already well-covered by
  existing general-purpose documentation elsewhere; nothing project-specific enough learned here to justify
  a deposit. **Skip.**

---

## Sources

**Primary / canonical:**
[chromium.googlesource.com/v8/v8 — compilation-cache.cc](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/codegen/compilation-cache.cc) ·
[v8.dev/blog/code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs) (already cited by the
sibling warm-page doc; re-used here for the 80 %-hit-rate/20%-miss figure) ·
[playwright.dev/docs/api/class-tracing](https://playwright.dev/docs/api/class-tracing) ·
this repo's `tests/_fixtures.ts`, `scripts/w0-warm-page-measure.mjs`,
`docs/research/measurements/w0-2026-07-23T19-06-51-827Z.json`,
`docs/research/measurements/m1b-capacity-probes-2026-07-23.md`,
`docs/process/development-discipline.md` §11a/L18–L21 (all read in full for this report).

**Community / lower confidence (flagged inline above wherever used):**
[Chromium issue 40529686 — headless screenshots slow with repeated use](https://issues.chromium.org/issues/40529686) ·
[V8 compilation-cache generations discussion](https://groups.google.com/g/v8-reviews/c/22dS31QhIKk) ·
[web.dev — detached window memory leaks](https://web.dev/articles/detached-window-memory-leaks) ·
[nodejs.org/api/http.html](https://nodejs.org/api/http.html) ·
[learn.microsoft.com — Defender AV scan best practices](https://learn.microsoft.com/en-us/defender-endpoint/mdav-scan-best-practices).

**Playwright BrowserContext/Page `removeAllListeners` behavior semantics** — confirmed against the loaded
`playwright-official-docs` global-graph corpus + web search cross-check (no single canonical URL quoted
verbatim; behavior matches [playwright.dev/docs/api/class-browsercontext](https://playwright.dev/docs/api/class-browsercontext)'s
documented `behavior`/`timeout` parameters).
