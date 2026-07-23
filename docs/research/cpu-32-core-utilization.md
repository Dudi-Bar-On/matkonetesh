# CPU utilization audit — are the 32 local cores under-used, and where?

Research task (read-only). No suite runs, no builds, no benchmarks were executed — a run now would
collide with the in-progress migration's own suite runs (§11a's serialize-the-suite rule). Findings below
are evidence-based reasoning over `playwright.config.ts`, `serve.js`, `build.py`, the installed `graphify`
package, and `docs/process/development-discipline.md`, plus one query against the graphify **global**
graph (§10.11). Where a claim can't be verified read-only, it's flagged as such, not asserted.

Environment verified: `python -c "import os; print(os.cpu_count())"` → **32**; `node -e
"console.log(require('os').cpus().length)"` → **32**. Node v24.18.0, Python 3.10.4.

## Executive summary

- **Yes, under-used — one clear place, one soft place.** Playwright's local worker count (`10`) is the
  one lever with real, currently-unclaimed headroom: two of the failure modes that justified capping it
  below Playwright's own `cpus/2` default (16) have since been fixed in this repo (clustered server,
  60s nav timeout), so a re-measure at 16/20/24 is warranted. `serve.js`'s cluster cap (`min(12,
  cpus.length)`) leaves 20 cores unused by design, but is very unlikely to be a real bottleneck (argued
  below) — worth a glance during the re-measure, not a priority fix on its own.
- **Everything else is already either maxed or correctly not parallelized.** graphify's AST extraction
  pass already defaults to `ProcessPoolExecutor` across `cpu_count` (32) workers — confirmed by reading
  the installed library, not just `--help`. `build.py` is genuinely single-threaded, sequential,
  I/O-light work with real data dependencies between steps — parallelizing it would add complexity for
  no measurable gain. The subagent dev loop is gated by remote LLM inference and orchestration
  coordination, not local cores — confirmed against how the graphify skill itself dispatches subagents.
- **Highest-value change:** re-measure the Playwright local worker count at 16/20/24 (candidates below),
  using the existing 9×-clean serialized procedure, once the current migration's suite runs are done.
- **Recommended candidates to re-measure:** **12, 16, 20, 24** (in that order, stop climbing at the first
  count that either doesn't beat the previous candidate's wall time or fails to go 9/9 clean).

---

## 1. Current-use audit — what actually engages how many cores today

| Task | Mechanism | Cores actually engaged | Verdict |
|---|---|---|---|
| Playwright suite (main) | `workers: process.env.CI ? 2 : 10` (`playwright.config.ts:36`) | 10 of 32 (~31%) | **Under-used relative to headroom that now plausibly exists** — see §2 |
| `serve.js` (test webServer) | Node `cluster`, `WORKERS = Math.max(2, Math.min(12, os.cpus().length))` | 12 of 32 (~38%), capped by design | Almost certainly not the bottleneck (see §2.3) — not a priority |
| `build.py` | Single Python process, sequential | 1 of 32 (~3%) | **Correctly not parallelized** — see §3 |
| graphify AST extraction (`extract()` in the installed library) | `ProcessPoolExecutor`, `max_workers` defaults to `cpu_count` when corpus ≥ `_PARALLEL_THRESHOLD` (20 files) | **32 of 32 — already maxed** | Nothing to gain; already fully engaged |
| graphify semantic extraction (Part B) | Either Claude subagents dispatched in one message, or (with a Gemini key) `extract_corpus_parallel(..., backend="gemini")` — remote LLM calls either way | 0 local cores — API/network-bound | Correctly not core-gated; concurrency lever is dispatch batch size / `--max-concurrency`, not cores |
| Subagent-driven dev loop | Claude Code `Agent`/Task dispatch → remote model inference | 0 local cores for the inference itself | Cores don't gate this — see §4 |
| `evals/` Playwright config | `workers: 1`, deliberate | 1 of 32 | **Correctly not parallelized** — rate-limited paid API calls, not CPU work (see §5, this is a good existing example in-repo) |
| `npm`/Node tooling | No build/lint/typecheck step exists in this repo | n/a | No `tsc`/`eslint`/bundler to parallelize — `package.json` has only `test` and `eval` scripts |
| Serena/LSP | Configured, **not live** (`uv` not installed) | 0 — not running | Even once live, a single-repo LSP session isn't a core-parallelism opportunity (see §5) |

---

## 2. Playwright workers — the biggest lever

### 2.1 What the config says today, and why

`playwright.config.ts:16–36` (read directly, not from memory — the file itself flags its own comment as
the authority over the discipline doc's summary):

```
// Re-measured 2026-07-23 at 419 tests (previous measurement was taken at 324, then lowered to 6):
//   6 workers  -> 3/3 clean, ~175s (175/176/174)
//   8 workers  -> 3/3 clean, ~139s (143/142/133)
//   10 workers -> 3/3 clean, ~110s (116/107/108)   <- chosen
// ...
// Prior note (2026-07-21, 308→324 tests): 8 workers began an occasional short run ... so it was
// lowered to 6. (16 = the CPU/2 default is much faster but was clearly non-deterministic at that time.)
```

Two facts matter for whether 16+ deserves a second look:

1. **The suite has grown.** 324 → 419 → 425 (discipline doc, §11a) → **429** tests today, at 85 spec
   files under `tests/`. A bigger suite means more independent test *files*, which is exactly the axis
   Playwright's worker pool scales on (`fullyParallel: true`) — more work items to spread across workers,
   not more per-item cost.
2. **Both root causes of the earlier 16-worker instability have since been fixed, and the fixes are
   dated after the "16 was non-deterministic" note:**
   - **L11 (server bottleneck, 2026-07-21 era):** the original server was single-process, re-reading the
     2.4 MB `index.html` from disk on every request, and stalled under concurrent load. `serve.js` (read
     in full — 57 lines) replaced it with a clustered, in-memory server: `cluster.fork()` × up to 12
     workers, each caching `dist/` into memory once at startup and serving from a `Buffer` — zero
     per-request disk I/O. This directly targeted the mechanism that made higher worker counts flaky.
   - **`navigationTimeout: 60_000` (2026-07-23, commit `690f92d`, same day and just before this task):**
     the config's own comment names the exact failure mode — 154 bare `page.goto` calls waiting for
     `'load'`, which "occasionally stretches past 30s even though the page HAS rendered" under
     N-worker contention. This is *precisely* the flake shape a higher worker count would be expected to
     trigger more often (more simultaneous navigations racing for the same event loop / network stack),
     and it was verified non-product (DOM present, isolated reruns ~2.8s) — a timeout-ceiling problem,
     not a real hang.

So the two things that made 16 "clearly non-deterministic" at an earlier, smaller suite size — a
disk-bound single-process server, and a navigation timeout tight enough that healthy-but-slow loads
under contention read as failures — are both gone. That doesn't guarantee 16/20/24 will be clean and
faster now; it removes the two concrete reasons they weren't before. The honest position is: **worth
re-measuring, not worth assuming.**

### 2.2 Why cores are the plausible remaining ceiling, not something else

Each Playwright worker is a full **Chromium instance** (browser process + at least one renderer process,
GPU process, sandbox), not a lightweight thread — so the real OS process count under load is a multiple
of the worker count, and the practical ceiling is genuinely CPU/memory-bound, not just "how many workers
Playwright will schedule." This is why diminishing or even negative returns are plausible somewhere
between 20 and 32, even with both software bottlenecks fixed — context-switching and memory-bandwidth
contention across dozens of browser processes don't necessarily improve linearly with logical core count.
This is reasoning from how Chromium/Playwright's process model works, not from a run of this specific
suite — flagged as such per the "don't benchmark" instruction.

### 2.3 `serve.js`'s 12-worker cluster cap — probably not the bottleneck, worth a glance

`serve.js:28`: `const WORKERS = Math.max(2, Math.min(12, os.cpus().length));` — hard-capped at 12
regardless of the 32 available. At today's `workers:10` this is a non-issue (12 ≥ 10). If Playwright's
worker count rises to 16/20/24, the server side would have fewer cluster processes than test workers.
This is very unlikely to matter in practice: each cluster worker runs Node's normal single-threaded,
non-blocking event loop, and the actual per-request work here is a `Map.get()` + a synchronous
`res.end(buffer)` — microsecond-scale, in-memory, no per-request disk I/O (that was the whole point of
the L11 fix). A single event loop can comfortably serve thousands of such requests concurrently; the
cluster's purpose is to spread OS-level connection acceptance across cores, not to bound concurrent
connections per worker. **Verdict: flag it, don't fix it pre-emptively.** If a re-measure at 20+ workers
shows contention that isn't explained by the browser-process reasoning in §2.2, `serve.js:28`'s cap is
the first thing to revisit (raise `12` — trivial one-line change, but only if evidence calls for it).

### 2.4 Sharding — a genuinely different lever, but it conflicts with a standing rule

Playwright supports splitting a suite across processes/machines with `--shard=N/M` (confirmed against the
graphify **global** graph, `playwright-docs-20.md:110–158`, queried per §10.11 before any web search —
see §6). This is a materially different lever from raising `workers`: instead of one Playwright process
scheduling more parallel workers, it runs **multiple separate Playwright processes**, each with its own
worker pool. The config already has the plumbing for two runs to coexist port-wise
(`MK_TEST_PORT`/`PORT`, `playwright.config.ts:9`, comment: *"Overridable so two suite runs can execute
concurrently on different ports"*).

This is worth naming as a real option for later, but it **directly conflicts with the current explicit
rule** in `CLAUDE.md` §11a: *"Never run two suite runs concurrently"* and *"run the suite SERIALIZED more
broadly."* That rule exists because a concurrency accident on the same port produced 127 phantom
`ERR_CONNECTION_REFUSED` failures (L11a/L11). Sharding on separate ports is a different scenario than the
one that caused that incident, but adopting it would still be a deliberate reversal of a standing testing-
infra rule — not something to slide in as an implementation detail. **Flagged for the owner, not
recommended as a default next step.** If a single-process worker count of 20–24 hits diminishing returns
(§2.2), sharding is the next lever to formally propose — as its own decision, with the port-collision
history named.

---

## 3. `build.py` — single-threaded, and correctly so

Read in full (430 lines). What it does: imports several Python data modules (`data.py`, `seasonings.py`,
`sausages_new.py`, `sources.py`, `equipment_map.py`, …), merges/deduplicates dictionaries in memory,
applies regex-based text transforms over recipe dicts, reads `app.css`/`app.js` and every `lang/*.json`
i18n file from disk, JSON-serializes the merged data payload, string-substitutes it into an HTML template,
and writes `index.html` / `dist/index.html` / `dist/sw.js` / `dist/_headers` to disk (plus copying
`site/` assets).

**Verdict: not core-bound, not worth parallelizing.**

- **Data dependencies, not independent work items.** `equipment_map.apply(CUTS, SPECIALS, MAKES)`
  (`build.py:112`) needs `CUTS`/`SPECIALS`/`MAKES` fully merged first; the sources merge
  (`build.py:85–105`) needs the make/cut dicts to exist; the i18n coverage report needs every language
  dict loaded. These are sequential by construction, not by omission.
  Parallelizing would mean re-architecting the merge order, for a step that plausibly runs in low single-
  digit seconds — no timing was taken here per the no-benchmark rule, but the work volume (a handful of
  in-memory dict merges plus writing one ~2.6 MB file, per the discipline doc's own figure) does not
  suggest a build-time problem worth solving.
- **The one place with genuinely independent items** is the `glob(lang/*.json)` loop (`build.py:355`)
  reading each language's i18n dictionary — those file reads *are* independent of each other. But there
  are only a handful of language files (the discipline doc's i18n work names `en` plus a few others), and
  each is a small JSON file — multiprocessing overhead (process spawn, pickling) would very plausibly cost
  more than the I/O it saves. Not worth it at this scale.
- Nothing here is CPU-bound in the sense that matters for 32 cores — no image processing, no large-loop
  numeric work, no compilation step (confirmed: `package.json` has no `tsc`/bundler/lint script at all,
  only `test` and `eval`).

---

## 4. The subagent-driven dev loop — cores don't gate it, and this repo's own tooling proves it

Per the task framing: subagent LLM inference is remote (Anthropic's serving infrastructure), not local
compute. That's confirmed by how this **very project's** `/graphify` skill dispatches its own semantic-
extraction subagents (`.claude/skills/graphify/SKILL.md:205,250–252`):

> "MANDATORY: You MUST use the Agent tool here... Call the Agent tool multiple times IN THE SAME
> RESPONSE — one call per chunk. This is the only way they run in parallel."

The parallelism lever named there is explicitly the **number of `Agent` tool calls issued in one
message** — an orchestration/dispatch-batching concern — not anything to do with the local CPU. Local
cores are engaged only for what a subagent does *locally* once dispatched: file reads/writes, `git`,
`bash`, JSON parsing — all lightweight relative to 32 cores, and typically I/O- or single-thread-bound
individually.

**The real constraint on subagent parallelism is elsewhere, and this repo already documents it — in the
opposite direction:** §11a's rule to *"pause other CPU-heavy background agents"* during a Playwright run
exists precisely because subagents that **do** run local CPU-heavy work (their own `python build.py`,
their own test runs) compete for the same 32 cores as the suite and cause exactly the contention-flake
this report is examining (`ERR_ABORTED` on navigation, discipline doc line 390: *"a migration task's
suite flaked 10/425 mid-run under parallel-subagent load; 3× clean once the machine was idle"*). So the
honest, complete answer: **core count does not gate how many subagents can be usefully dispatched for
reasoning/API-bound work** (that's bounded by API concurrency limits and coordination complexity,
neither measured here), **but it absolutely gates how many subagents can safely run their own local
CPU-heavy tool calls at the same time as anything else CPU-sensitive** — and this project has already
learned that the hard way once (the exact incident cited above).

---

## 5. Serena/LSP, node/npm, and anything else

- **Serena:** configured (`.mcp.json`) but **not live** — `uv` is not installed in this environment
  (`docs/process/serena-adoption.md:59-61`, confirmed current as of this task; not re-verified here since
  it's read-only status, not something this task changes). Even once live, Serena runs as a single
  per-language LSP session (`typescript-language-server` for `app.js`, Pyright for the Python data
  layer) against a near-monolithic codebase (`app.js` at 9,565 lines is the only large file; everything
  else is small). A single LSP indexing pass over one file of that size is not a workload that benefits
  from more of the 32 cores — it's not a core-parallelism opportunity in this repo's shape, live or not.
- **`npm`:** no build/lint/typecheck script exists at all (`package.json` scripts are only `test` and
  `eval`, both Playwright invocations already covered in §2). `npm install` itself is network-bound
  (package downloads), not CPU-bound, and its concurrency isn't something this project's workflow
  currently exercises in a way worth tuning.
- **`evals/playwright.config.ts`:** a second, genuinely useful data point *for* this report's framing.
  It deliberately sets `workers: 1` with a comment explaining exactly why: *"this suite's cost driver is
  live, paid, rate-limited API calls... serial execution avoids racing concurrent calls against the same
  key's rate limit... Not a violation of 'never --workers=1' — that rule targets the MAIN suite
  specifically."* This is the same distinction this report draws for the subagent dev loop (§4) and for
  graphify's semantic pass (§1 table) — **API/rate-limit-bound work should not be scaled with local
  cores, and this codebase already has one correct, well-reasoned example of exactly that judgment call
  in production.**

---

## 6. §10.11 — graphify global graph checked before any web search

Queried `~/.graphify/global-graph.json` for `"playwright workers sharding parallel CPU cores"` and
`"node cluster worker threads CPU parallelism"` before any web search, per the standing instruction. Hit:
a `playwright-docs-20` community (`raw/playwright-docs-20.md`, sourced from a sibling project's raw
corpus, not this repo's own) with a "Use parallelism and sharding" node (L110) and a "Run tests on CI"
node (L85-104) covering `--shard=N/M` and CI browser-install trimming — read directly at
`C:\Users\dudib\source\repos\matkonet\raw\playwright-docs-20.md:85-158` and used in §2.4 above. No node
existed for Playwright's own default-worker-count formula, Chromium's per-instance process model, or
Node's `cluster`/`worker_threads` APIs — those sections of this report rely on the config's own comments
plus general knowledge of the tools, not a graph hit, and are stated as reasoning rather than sourced
fact.

**No new documentation is being deposited from this task.** The `playwright-docs-20` content already in
the global graph covered what was needed (sharding + CI tips); nothing new was fetched from the web, so
there is nothing new to run through the usefulness gate. If a future task needs Playwright's worker-count
default formula or Chromium's multi-process model documented in the graph, that would be a legitimate
`graphify add` candidate at that time — noted, not done here.

---

## 7. Recommendations, ranked by value

1. **Re-measure the Playwright local worker ceiling at 16, 20, and 24** (plan in §8). This is the one
   lever with plausible, currently-unclaimed headroom, and the two prior blockers are both fixed and
   dated. Highest value because a lower wall-clock suite time compounds across every future DoD-line-12
   run.
2. **If the re-measure shows contention that isn't consistent with per-Chromium-instance cost (§2.2),
   check `serve.js:28`'s `min(12, ...)` cap next** — a one-line raise, but only pull this lever if the
   re-measure's evidence points at the server rather than the browser processes themselves.
3. **Raise sharding (`--shard=N/M`) with the owner as a separate, explicit decision** if worker-count
   scaling plateaus before saturating the machine. Do not adopt it unilaterally — it reverses the current
   "never run two suite runs concurrently" rule, even though the collision that produced that rule was a
   same-port accident and sharding would use separate ports.
4. **No action on `build.py`, graphify AST extraction, the subagent dev loop, or Serena/LSP** — each was
   checked and is either already fully using available cores (graphify AST: `ProcessPoolExecutor` at
   `cpu_count`) or is correctly *not* core-bound (build.py: sequential/dependent; subagents and graphify's
   semantic pass: remote-API-bound; Serena: not live, and not a core-parallelism shape even when it is).

---

## 8. Post-migration re-measure plan — Playwright worker ceiling

**Preconditions (per §11a):** the in-progress migration's own suite runs are finished; no other heavy
subagents/processes are running; the manual `serve.js` on 8123 (if any) is stopped so it doesn't collide
with Playwright's managed server.

**Candidates, in order:** `12 → 16 → 20 → 24`. Start at 12 (matches `serve.js`'s current cluster cap —
a natural checkpoint before crossing it) rather than jumping straight to 16, so a regression exactly at
the server's worker cap would be visible instead of skipped over.

**Procedure per candidate** (per the discipline doc's own corrected guidance — 3 runs hid a ~1-in-6 flake
before, per L-series lesson dated 2026-07-23 in §11a):

1. Set `workers: N` in `playwright.config.ts` for the candidate (temporary, local-only edit — do not
   commit until a candidate is chosen).
2. Run `npx playwright test` — plain, nothing else, never `--retries` or `--workers=1` overrides —
   **9 times**, serialized (one run at a time, not concurrent with anything else CPU-heavy).
3. Record: pass/fail per run, wall-clock time per run, and if a run fails — the actual failing spec(s)
   and error type (nav-timeout vs. something else), so a genuine product regression is never mistaken for
   worker-count noise.
4. **Stop and accept the previous candidate** if the current one produces even one failure in the 9 runs
   (retries is 0 by design — a flake must surface, never be averaged away) or does not clearly beat the
   previous candidate's wall-clock time.
5. **Expected direction, not a promised number:** wall-clock time should keep falling from 10→16 workers
   if the two 2026-07-23 fixes (clustered server, 60s nav timeout) actually removed the earlier
   instability's causes, since more independent spec files get scheduled in parallel. Beyond roughly the
   physical core count, expect diminishing or possibly negative returns (§2.2 — each worker is a full
   Chromium process, and CPU/memory contention across dozens of browser processes doesn't have to scale
   linearly with logical cores). Treat any number below as a hypothesis to test, not a result:
   *if* 16 and 20 are both clean, 20 is very plausibly still faster than 10; whether 24 beats 20 is the
   genuinely open question this plan exists to answer.
6. Once a ceiling is chosen, update `playwright.config.ts`'s comment block (`:16-27`) with the new
   measurement numbers in the same format as the existing 2026-07-23 entry — keep the history, don't
   overwrite it, per the doc's own established convention.
7. If the chosen count ends up needing `serve.js`'s cluster cap raised (§2.3), that is a one-line change
   to `serve.js:28`'s `Math.min(12, ...)` — only make it if step 3's failure evidence points there.
8. **CI is out of scope for this re-measure.** The CI runner is a 4-vCPU box (`workers: 2` there,
   `playwright.config.ts:29-36`) — a different machine profile entirely; nothing in this plan should touch
   the CI worker count.

No numeric result is asserted anywhere in this document — every count above is a candidate to test, not
a claimed outcome, per the task's explicit no-benchmark constraint.
