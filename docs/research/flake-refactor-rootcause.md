# Warm-page flake — root-cause refactor loop (running log)

**Role:** ARCHITECT in the full debugging loop (owner mandate 2026-07-24). **Method:** systematic-debugging
— evidence → root cause → minimal refactor → verify. Fast targeted probes (a reload-storm harness) drive
each iteration; a single `--workers=12` canary full-suite run (nav 20s / test 30s, config `a93e12e`) is the
acceptance check. No campaigns (§10.18). Analysis committed here per iteration; code committed separately.

**Canary geometry (committed `a93e12e`):** `navigationTimeout: 20_000`, `timeout: 30_000`, config
`workers: 8` unchanged; acceptance/repro runs use `--workers=12` (the high-signal stress level: only 5/15
historical 12-worker runs were clean). Splitter (28s/40s) data is treated as anecdote (it masked the defect).

---

## The instrument — `scratch/reload-storm.mjs` (single-driver) + `scratch/server-storm.mjs` + `scratch/storm-worker.mjs` (multi-process)

`reload-storm.mjs`: launches **N chromium browsers** (one each — mirrors the suite's per-worker browser +
ephemeral context + one reused page), all cold-`goto` `/index.html`, then loops ROUNDS of a **lockstep**
`seedApp`-shaped reset (`localStorage.clear`+set → `page.reload({waitUntil:'domcontentloaded'})`) fired via
`Promise.all` so all N reload at once (worst-case collision). Font hosts are mapped to 127.0.0.1 (same as the
suite's launch arg) so it is hermetic. A 2 s **heartbeat prints whole-machine CPU%** (`os.cpus()` delta) so a
hang can be classified CPU-bound vs blocked-waiting. `STORM_PATH`, `STORM_RECYCLE`, `STORM_TRACE`,
`STORM_JSFLAGS` knobs let one variable change per run. Server: `node serve.js 8126` (never 8123).

---

## Arms run and RAW numbers (2026-07-24, idle machine, machine verified clean of orphans first)

| # | Arm | Result | Verdict |
|---|---|---|---|
| 1 | `server-storm` N=12 (pure `fetch`, NO browser) | serve.js delivers 12×2.7 MB in **73–143 ms/round** (max per-req 109 ms) | **serve.js is NOT the bottleneck** |
| 2 | `reload-storm` **N=1**, 6 rounds | clean: 154, 1889, 165, 1872, 148, 1893 ms — the exact W0 **154↔1889 ms alternation**; heap flat 14 MB | single warm page is fine; reproduces W0 |
| 3 | N-sweep (1 sample each) | N=2 clean (1896); N=4 **10–12 s**; N=6 **20 s all-hang**; N=8 clean (1938) | superlinear **and high-variance** near a threshold (~N=4–8) |
| 4 | **N=12**, 8 rounds, +CPU | rounds 0,1,2,4 = **all 12 hang at 20 s**; r3 clean; r5 partial (7 fail); r6,7 clean. **CPU 7–14% (IDLE) through every hang.** heartbeat ticks cleanly. setup (12 cold gotos) took 21–30 s | hang is **browser-side and NOT CPU-bound** — a WAIT, releasing in bursts |
| 5 | **tiny.html** (145 bytes) N=12, 5 rounds | ALSO hangs: fails 11,8,6,12,12; CPU ~20% idle; within a round `min=11–14 ms` (some instant) mixed with 20 s hangs | **the 2.7 MB app is IRRELEVANT** — machinery, not app |

### What arm 4 + 5 REFUTE (by direct measurement, not opinion)
- **CPU/P-core saturation, memory-bandwidth/GC contention, compile-storm** — all predict *saturated* CPU;
  measured CPU during every hang is **7–20 %**. Refuted.
- **V8 heap leak (the panel's #1 "ignition"), V8 compile-cache eviction, the 2.7 MB parse cost** — a
  **145-byte** page hangs identically. Refuted as the concurrency-hang driver. (The leak/alternation are
  real in isolation — arm 2 — but they are NOT what makes concurrent reloads hang.)
- **serve.js single-process head-of-line** — arm 1 (12×2.7 MB in <150 ms). Refuted.

## Current lead hypothesis (after arms 1–5)
The residual flake is a **serialization / lock in the browser-side navigation machinery** (chromium and/or
Playwright and/or a Windows per-navigation resource) that triggers when **N≳4 `page.reload` +
`waitUntil:'domcontentloaded'` run concurrently**, stalling some navigations to the timeout while the
machine sits **~85–90 % idle**, and releasing in **bursts** (some rounds all-hang, the next all-clean). This
is a direct, CPU-instrumented reproduction of the evidence analyst's previously-unexplained **"one shared
gate releasing"** — now shown to be a low-CPU wait, not contention. Neither the app, V8, nor the server is
involved. `min=11 ms` reloads coexisting with 20 s hangs in the same round point to an unfair per-navigation
wait, not a global freeze.

## Next
1. **Faithfulness check (in progress):** `storm-worker.mjs`+`storm-multi.mjs` — 12 **independent** node+browser
   processes (fork+IPC lockstep) = the suite's real model. If it hangs → chromium/OS root cause (faithful);
   if clean → my single-node driver is the artifact and the suite's cause differs. Decisive before any fix.
2. **Locate the stall phase:** request/response/`domcontentloaded`/`load` event timestamps on a hung reload —
   is the navigation stuck pre-commit (network service) or is DCL firing but the wait not resolving?
3. Only then: name the shared resource and refactor it (candidates gated on 1–2: drop the DCL-wait model /
   `waitUntil:'commit'`; reduce concurrent in-flight navigations; a chromium launch flag; NOT recycle — arm 4
   refutes heap as the driver).

_Log continues per iteration._
