# Is `serve.js` the right ingredient? — deep research + skeptical evaluation

**Date:** 2026-07-23 · **Trigger:** §10.15 (evaluate-better-alternatives), invoked after the mid-run kill on
2026-07-23 wedged port 8123 with a respawning zombie cluster. **Scope:** research only — no suite run, no
code change.

## Verdict, up front

**Harden `serve.js`; do not switch static servers.** But **simplify** it: the evidence says the `cluster`
module is not paying for itself and is the entire source of the demonstrated failure mode. Drop the
cluster, keep the in-memory Buffer design (that part is correct and better than every alternative
evaluated), add the two Node-documented safety nets (`exitedAfterDisconnect` check, explicit signal
handlers), and — the actual biggest lever available — **stop killing the suite mid-flight**, which §11a
already prohibits. No alternative static server removes the need for that discipline.

The task's headline hypothesis — that HTTP cache headers would let Chromium cache the app across
`page.goto` calls and cut the ~154-navigation cost — **does not survive contact with Playwright's own
documented context-isolation model.** That is the single most important finding in this report and it
overturns the framing of the original question. Details in [§3](#3-the-cache-header-hypothesis-checked-against-playwrights-own-model-and-refuted).

---

## 0. What was actually read (not recalled)

- `serve.js` (57 lines, full file) and `playwright.config.ts` (92 lines, full file) — read directly for
  this task, not from memory.
- `docs/process/development-discipline.md` §10.15/§10.11/§11a — via the always-loaded `CLAUDE.md`, which
  inlines the current text of those sections.
- Measured, not assumed: `tests/**/*.spec.ts` = **85 spec files**, **154 bare `page.goto` calls**, **441
  `test(...)` definitions** (the task's own "~433" and the config's own comment of "419 tests, measured
  2026-07-23" are all in the same ballpark — the exact count drifts run to run as specs are added; no
  single figure is load-bearing for the conclusions below).
- `package.json` — confirms zero static-server dependency exists today; `serve.js` is 100% custom, using
  only Node core (`http`, `cluster`, `fs`, `path`, `os`).

## 1. §10.11 graphify-global-first — result: genuine miss, recorded, then went to the web

Queried `~/.graphify/global-graph.json` (vendor-docs, methodology, gemini-api-docs, cloudflare-workers-docs
— 4 corpora) for `sirv static file server`, `Playwright webServer teardown SIGTERM`, and `node cluster
module workers respawn`. All three returned only case-folded substring noise (Vitest/BMAD/Lit docs
matching stray words like "server", Cloudflare "Workers" matching "workers", a `Thinking Models: Planning
Cluster` node matching "cluster"). **No real vocabulary hit** — per §10.11 this is a genuine miss, not a
reason to invent tokens, so this report goes to primary sources on the web instead. Deposit candidates
identified along the way are listed in [§7](#7-deposit-worthy-docs-not-deposited).

## 2. The comparison table

| Option | Concurrency model | Teardown cleanliness | Windows fit | Simplicity | Verdict |
|---|---|---|---|---|---|
| **`serve.js` as-is (cluster + in-memory)** | 12-worker cluster, each an in-memory `Buffer` — zero per-request disk I/O | **Bad**: `cluster.on('exit', () => cluster.fork())` respawns unconditionally, no `exitedAfterDisconnect` check → infinite respawn storm if a kill lands asymmetrically (workers die, primary lives) | Cluster load-balancing degrades on Windows — libuv defaults to `SCHED_NONE` there, not the round-robin `SCHED_RR` used on Linux/macOS ([nodejs.org/api/cluster.html](https://nodejs.org/api/cluster.html)), so the 12-way fan-out doesn't even distribute evenly on this OS | 57 lines, but the cluster machinery is the most complex part and the part demonstrated to fail | **Fix, don't discard** — the in-memory design is sound; the cluster is the defect |
| **`serve.js` hardened (in-memory, single process, no cluster)** | 1 process, in-memory `Buffer`, zero disk I/O | Good — one PID, explicit `SIGTERM`/`SIGINT` handlers close the listener cleanly; nothing to respawn | No cluster ⇒ the `SCHED_NONE` caveat above is moot | Slightly simpler than today (delete ~15 lines of cluster glue) | **Recommended** |
| `sirv` / `sirv-cli` | 1 process; caches **stat/etag metadata** upfront but the actual bytes are streamed per request via `fs.createReadStream(file).pipe(res)` ([source](https://raw.githubusercontent.com/lukeed/sirv/main/packages/sirv/index.mjs)) — **not** an in-memory Buffer like `serve.js` | Plain Node process — no built-in graceful-shutdown story documented; relies on the caller (same as any option here) | Streams from disk on every request — re-exposes exactly the per-request-disk-I/O path that motivated moving off Python's `http.server` in the first place (Windows Defender real-time protection adds scan overhead on file access, [Microsoft's own performance-troubleshooting doc](https://learn.microsoft.com/en-us/defender-endpoint/troubleshoot-performance-issues), though this is a plausible contributing factor, not something this research isolated experimentally) | Adds a dependency; ~53% faster than `http-server` in a published benchmark (42,256 rps @ 2.27ms vs 27,594 rps @ 3.49ms, Node 16.13 — [npmtrends discussion](https://npmtrends.com/http-server-vs-lite-server-vs-serve-vs-sirv-cli-vs-static-server)) but that benchmark is *sirv vs http-server*, not *sirv vs an in-memory Buffer server*, which is the actual comparison that matters here | **No** — architecturally a step backward from what `serve.js` already does |
| `http-server` | 1 process, disk-per-request, no upfront caching | Same caveat as above, worse baseline throughput | Same disk-I/O exposure as sirv, slower | Zero-config, ubiquitous | **No** — the slower of the two disk-based options; already implicitly ruled out (same class of tool as the abandoned Python `http.server`) |
| `vite preview` | 1 process, Vite's own static-serve path | Vite's own docs are explicit: **"vite preview is intended for previewing the build locally and not meant as a production server"** ([vite.dev/guide/static-deploy](https://vite.dev/guide/static-deploy)) — not benchmarked or hardened for this | Not evaluated for Windows-specific teardown; the framework itself disclaims fitness for exactly this kind of load | Requires adopting a bundler-shaped tool for a build this project doesn't otherwise produce with Vite | **No** — wrong tool for the job by the maintainer's own admission |
| `esbuild --serve` | 1 process, `servedir` disk-based fallback serving | Not documented | **Actively worse**: esbuild's Windows dev-server had a published security advisory for arbitrary file read via path-normalization bugs on Windows specifically ([GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)) — esbuild's own docs call it a bundler, not a dev server, and point users at Vite or "a simple static server" instead | Minimal but the wrong abstraction | **No** |
| `@web/dev-server` | Koa + `koa-static`/`koa-send` under the hood, disk-based | Standard Koa process lifecycle; not evaluated in depth — no evidence found that it solves either the throughput or the teardown problem, and it pulls in a framework (`@web/*` component-testing ecosystem) this project doesn't otherwise use | Not evaluated | Heaviest dependency footprint of any option here for what is a one-file static serve | **No** — no signal it's better, meaningfully more surface |
| **Playwright serving the file itself** (no separate server) | N/A | N/A | N/A | Playwright's own `webServer` docs ([playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver)) document *launching and tearing down* a server; they do not offer a built-in static-file-serving mode of their own | **No such feature exists** — Playwright always expects you to bring a server |

**Every alternative surveyed serves bytes from disk per request.** `serve.js`'s core idea — read `dist/`
into memory once, serve from `Buffer` — is not something any of these off-the-shelf tools do by default,
and it is the one design choice that is unambiguously *better* than the field. The problem was never "wrong
ingredient"; it was **one blind respawn line** and (per §11a) **an out-of-band kill that didn't go through
Playwright's own teardown.**

## 3. The cache-header hypothesis, checked against Playwright's own model — and refuted

The task's framing was: *"serving `dist/index.html` with HTTP cache headers would let Chromium cache the
app across navigations, so `page.goto` is fast after the first load."* Checked against Playwright's own
documentation, this does not hold for this suite's structure:

1. **The `browser` fixture is worker-scoped; `context` and `page` are test-scoped.** Confirmed directly
   from [playwright.dev/docs/test-fixtures](https://playwright.dev/docs/test-fixtures): "Browsers are
   shared across tests to optimize resources" (one `Browser` process persists for the whole worker), but
   `context`/`page` are explicitly "Isolated context for this test run" / "Isolated page for this test
   run" — fresh every test.
2. **Cache is a context-scoped resource, not a browser-process-scoped one.** Confirmed directly from
   [playwright.dev/docs/api/class-browsercontext](https://playwright.dev/docs/api/class-browsercontext):
   a new context "won't share cookies/cache with other browser contexts." Chromium's own architecture
   backs this independently — there is one `HttpCache` instance per profile/isolated-storage-partition, and
   the ephemeral (non-persistent) contexts Playwright creates by default don't carry a cache forward between
   them ([chromium.org HTTP Cache design doc](https://www.chromium.org/developers/design-documents/network-stack/http-cache/)).
3. **Net effect:** every one of this suite's ~154 `page.goto` calls, across ~441 tests, happens in a
   brand-new, cache-empty `BrowserContext` (this project's own `playwright.config.ts` even documents the
   related `serviceWorkers: 'block'` decision precisely because a fresh context means a fresh SW registration
   attempt on every load). Setting `Cache-Control`/`ETag` on `serve.js`'s responses cannot make Chromium skip
   re-fetching, re-parsing, or re-executing the 2.4 MB inlined app on the next test's `page.goto`, because
   there is no cache left over from the previous test to hit. This is Playwright's isolation model working
   exactly as designed — it is a deliberate test-correctness tradeoff, not a `serve.js` shortcoming.
4. **Where cache headers* would *help, narrowly:** repeated navigation to the same URL *within one test*
   (rare in this suite), and even then the saving is bounded — Chromium's V8 "code cache" mechanism can skip
   re-parsing/re-compiling a *previously executed* script (a documented 20–40% reduction in parse+compile
   time, ~86% hit rate for cacheable scripts in Google's own data —
   [v8.dev/blog/code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs)) — but it **never** skips
   script *execution*, DOM construction, or app bootstrap, which is most of the 2.4 MB cost, and it only
   activates on a second load within the *same* cache/profile, which (per point 2) this suite's per-test
   contexts don't provide.
5. **The network-fetch saving cache headers target is already ~zero here.** `serve.js` already serves the
   file from an in-process `Buffer` over `localhost` — there is no disk seek, no upstream round-trip, and no
   TLS handshake to amortize. The remaining ~154×2.4 MB cost is V8 parse+execute time inside Chromium, which
   happens client-side regardless of how the bytes arrived.

**Conclusion:** cache headers are not the "likely headline" lever the task hypothesized they'd be. They cost
nothing to add (harmless, and do help the narrow within-test-reload case, plus any manual debugging in a
real browser), but they will not move the ~154-navigation aggregate cost. The actual lever for that cost is
reducing the shipped payload or the navigation count — both are application/test-authoring changes, out of
scope for "which static server" and explicitly out of scope for this research task (no code changes
requested). This should be surfaced to the owner as a separate, larger conversation if the per-test reload
cost is to be attacked directly; it is not a server-selection problem.

## 4. The zombie, root-caused precisely

`serve.js`'s primary does exactly this:

```js
cluster.on('exit', () => cluster.fork());   // keep the pool full if a worker dies
```

Node's own cluster documentation names this exact anti-pattern and its fix
([nodejs.org/api/cluster.html](https://nodejs.org/api/cluster.html)):

> `worker.exitedAfterDisconnect` ... is `true` if the worker exited due to `.disconnect()`. If the worker
> exited any other way, it is `false`. ... this allows the primary to choose not to respawn ...

`serve.js` never checks it, so **any** worker death — intentional or not — triggers an unconditional
refork, with no backoff. If a mid-flight kill lands asymmetrically (some workers killed, primary process
still alive — plausible on Windows since a plain `taskkill /PID` without `/T` only hits the process it
names, not descendants — confirmed by multiple sources on the Windows child-process-tree gotcha:
[pnpm#12406](https://github.com/pnpm/pnpm/issues/12406),
["Killing process families with node"](https://medium.com/@almenon214/killing-processes-with-node-772ffdd19aad)),
the primary enters an unbounded fork loop: each new worker takes a moment to synchronously re-read `dist/`
into memory before it starts listening, and a churning pool can leave the shared port accepting TCP
connections (the primary/OS-level listener) while no worker is actually ready to answer them — exactly the
"listens, accepts, never responds" symptom this session hit.

**This is a `serve.js` code defect, not evidence against the cluster/in-memory design generally**, and it
is independent of which static server is chosen — any tool spawning multiple OS processes on Windows and
respawning blindly on exit would be exposed to the same class of bug.

## 5. The correct teardown pattern (§11a)

Two layers, and both already point the same direction as the existing discipline text:

1. **Let Playwright own the lifecycle — this is already the documented, correct pattern, confirmed via
   Playwright's own docs and source discussion.** Playwright's `webServer.gracefulShutdown` option
   (added v1.50.0) defaults to killing "the process group" via `SIGKILL`; `{ signal: 'SIGTERM', timeout }`
   is available as an opt-in for POSIX. **Windows doesn't support `SIGTERM`/`SIGINT` — the option is
   explicitly ignored on Windows** ([playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver)).
   On Windows, the reliable pattern (independently confirmed by the `tree-kill` package's own
   implementation, used elsewhere specifically to fix Playwright `webServer` cleanup issues) is
   `taskkill /pid <pid> /T /F` — kill the **tree**, forcefully. `/T` is what makes this safe against
   exactly the asymmetric-kill scenario in §4: it takes down primary *and* every cluster worker atomically,
   so there's no window where the primary survives to respawn. **This is what happens automatically when a
   Playwright run is allowed to complete or fail on its own** — which is precisely why §11a already says
   "let a run COMPLETE... never kill a suite mid-flight."
2. **If a manual kill is ever unavoidable, it must be a tree-kill from the primary PID, not a port-based
   kill of one process** — confirmed as the load-bearing distinction by every Windows-process-tree source
   found (`taskkill /PID <primaryPid> /T /F`, or the `tree-kill` npm package which wraps the identical
   `taskkill ... /T /F` call on Windows). A bare `taskkill /PID <pid> /F` (no `/T`) or a port-based kill that
   only reaches one member of the tree is exactly the shape of the incident that caused this task.
3. **Defense in depth inside `serve.js` itself** (belt-and-suspenders, since Windows signal delivery to
   Node is unreliable): install `process.on('SIGINT', shutdown)` / `process.on('SIGTERM', shutdown)`
   handlers in the primary that call `server.close()` on every worker and `process.exit()`, so a POSIX-style
   kill (e.g. from WSL, or from a future CI runner on Linux) also tears down cleanly without relying on the
   OS to already have killed every worker.

## 6. Is the cluster even needed? — no supporting evidence found

`serve.js`'s own comment blames "one event loop doing a fresh 2.4MB disk read per request" for both
Python's `http.server` *and* an earlier "naive single-process node server" stalling. That comment conflates
two different variables: **process count** and **caching strategy**. The earlier single-process Node
attempt that stalled was, by the comment's own description, doing a **fresh disk read per request** — i.e.
it was single-process *and* uncached, not single-process *with* the in-memory Buffer this file now uses.
No evidence was found (in the repo history available to this research, or in any external benchmark) that
a **single process with the in-memory Buffer** was ever tried and found insufficient — the cluster appears
to have been added at the same time as the in-memory cache, without isolating which of the two fixes was
load-bearing.

At the current measured concurrency — 10 Playwright workers locally (2 in CI), each running its tests
serially, so at most on the order of 10–20 simultaneous connections for a handful of small/medium files —
a single Node process copying bytes out of an in-memory `Buffer` (no I/O, no CPU-bound work; a `Buffer`
write over loopback is memory-bandwidth-speed, not disk- or network-bound) has no documented reason to
saturate. `sirv-cli`'s own published benchmark of **42,256 requests/sec on a single process**
([npmtrends](https://npmtrends.com/http-server-vs-lite-server-vs-serve-vs-sirv-cli-vs-static-server)) — and
that number is with per-request disk streaming, which is strictly slower than an in-memory `Buffer` write —
is roughly 3 orders of magnitude more throughput than this suite's actual peak concurrency requires.

Combined with §4 (the cluster is the sole source of the demonstrated failure) and the Windows-specific
`SCHED_NONE` load-balancing caveat (§2 table), **the evidence favors dropping the cluster**: it adds a real,
demonstrated risk class and a Windows-specific correctness gap, in exchange for headroom this workload
doesn't need.

## 7. Deposit-worthy docs (not deposited)

Per §10.11's usefulness gate — these are general-purpose vendor/tool docs, not project-private, and came up
from a genuine graph miss, so they're candidates for `graphify add` + `graphify global add --as <tool>-docs`
in a follow-up task, not this one:

- [playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver) — `webServer`,
  `gracefulShutdown`, Windows signal caveat. High reuse value — this project (and others) will hit this
  again.
- [playwright.dev/docs/test-fixtures](https://playwright.dev/docs/test-fixtures) — fixture scope
  (`browser` worker-scoped vs `context`/`page` test-scoped). Directly load-bearing for this report's §3
  finding and likely to matter again for any Playwright perf question.
- [nodejs.org/api/cluster.html](https://nodejs.org/api/cluster.html) — `exitedAfterDisconnect`, graceful
  shutdown pattern, `SCHED_RR`/`SCHED_NONE` platform caveat. General Node knowledge, not project-specific.
- [v8.dev/blog/code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs) — V8 code-caching
  heuristics, general web-perf knowledge.
- [github.com/lukeed/sirv](https://github.com/lukeed/sirv) (`readme.md` + `packages/sirv/index.mjs`) — only
  if this project or another starts actually evaluating `sirv` for something; a one-off lookup otherwise,
  skip unless reused.

## 8. Recommendation (research only — not applied)

1. **Remove the `cluster` layer from `serve.js`.** Keep the in-memory `Buffer` cache exactly as-is (it is
   the one part of the design that beats every alternative surveyed). Result: one process, one PID, no
   respawn logic to get wrong.
2. **Add `process.on('SIGINT'/'SIGTERM', ...)` handlers** that call `server.close()` before exit, as
   defense in depth beyond relying solely on the OS/Playwright to kill the tree.
3. **Add (optional, low-cost, not the headline fix) `Cache-Control`/`ETag` headers** for the narrow
   within-test-reload case and for the general courtesy of not looking broken under manual debugging in a
   real browser — but document plainly, at the point of change, that this is **not** expected to move the
   suite's aggregate wall-clock time, per §3.
4. **No config or process change to §11a's existing discipline is needed** — "let a run COMPLETE, never
   kill mid-flight; if you must kill, kill the whole tree from the primary" is already the correct rule,
   independently re-derived from Playwright's own and Node's own documentation in this research. The
   incident was a violation of that existing rule combined with the cluster's missing safety check, not a
   gap in the rule itself.
5. **Do not adopt `sirv`, `http-server`, `vite preview`, `esbuild --serve`, or `@web/dev-server`** — every
   one of them is disk-per-request, which is a step backward from what `serve.js` already does, and none
   of them documents a teardown story better than "let Playwright own it," which this project already
   knows to do.

If the team later wants to attack the *actual* dominant cost (154 × 2.4 MB parse+execute), that is a
payload-size or navigation-count question, not a server-selection question, and belongs in its own
brainstorm/spec cycle per this project's normal process — flagged here, not solved here.
