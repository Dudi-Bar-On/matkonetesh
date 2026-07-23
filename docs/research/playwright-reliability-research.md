# Playwright reliability research — killing the navigation-timeout flake at the root

**Status:** research only. No suite runs, no builds, no code changes — per the task's own rule and
CLAUDE.md §10.14/§10.15 (research before guessing/patching). Everything below is either a direct quote
from an official Playwright doc (fetched 2026-07-23) or an explicitly-labelled community source (blog,
GitHub issue), with the URL next to every claim.

**Files read for repo context (not modified):** `playwright.config.ts`, `serve.js`, `package.json`,
`docs/process/development-discipline.md` §11a, `docs/research/cpu-32-core-utilization.md` (sibling
research doc — already covers the worker-count-vs-cores question in depth; this doc defers to it for §3
and focuses on the navigation/timeout/teardown questions the task actually asked).

**§10.11 graphify-global step (done first, as required).** `graphify god-nodes` and targeted
`graphify query` calls against `~/.graphify/global-graph.json` confirmed the corpus tagged `playwright-docs`
(30 files under `C:\Users\dudib\source\repos\matkonet\raw\playwright-docs-*.md`) is **not** what its tag
suggests: it is a "Playwright (GUI-walk driver)" doc set — installation, the `playwright-cli`/MCP tool for
coding agents, test isolation, sharding overview, soft assertions. A `grep` of all 30 files for
`waitUntil|navigationTimeout|actionTimeout|domcontentloaded|reuseExistingServer|webServer|networkidle`
returned **zero matches**. This is a genuine miss, not a shortcut taken — the deep API-reference material
this task needed (navigation semantics, timeout hierarchy, webServer lifecycle) simply isn't in the global
graph, so the web was the correct next step per §10.11's own rule ("if no vocabulary token matches, say so
and stop — never invent tokens to force a hit"). Deposit-worthy finds are listed at the end; nothing was
deposited during this research-only task.

---

## Root cause, stated up front

The repo's own diagnosis is correct and this research confirms it precisely, with the official mechanism
named: **`navigationTimeout: 60_000` cannot ever fire while the test-level `timeout` stays at Playwright's
30 000 ms default**, because the test timeout is a hard ceiling over *everything* the test function does —
including a `page.goto` that is still legitimately in flight. Official docs, verbatim:

> "Time spent by the test function, fixture setups, and `beforeEach` hooks is included in the test
> timeout." — [playwright.dev/docs/test-timeouts](https://playwright.dev/docs/test-timeouts)

So with `timeout` (test-level) = 30 000 and `navigationTimeout` = 60 000, the **smaller** number always
wins the race, every time, unconditionally — `navigationTimeout: 60_000` is dead configuration until the
test-level timeout is also raised above it. That is exactly the observed symptom: `Test timeout of 30000ms
exceeded` at a `page.goto` call, never `page.goto: Timeout 60000ms exceeded`.

But raising the test timeout further is treating the symptom. The actual defect is **what `page.goto`
waits for by default**: `'load'`, which blocks on *every* subresource on the page finishing — not just the
DOM being ready or the app's own inline script having executed. For a 2.4 MB single-file inlined PWA whose
JS is synchronous and inline (interactive well before `'load'` could fire), waiting for `'load'` buys
nothing and costs everything: under worker contention, the long tail of `'load'` (font requests, the
manifest, icons, any progressive-enhancement fetch) is exactly what stretches past 30s while the app has
already been fully interactive for seconds. The correct fix is **changing what 154 `page.goto` calls wait
for**, not raising a ceiling that the mis-diagnosis never even lets fire.

---

## Q1 — `waitUntil`: `'load'` vs `'domcontentloaded'` vs `'commit'`, and can it be defaulted globally?

**Exact semantics, official docs** ([playwright.dev/docs/api/class-page#page-goto](https://playwright.dev/docs/api/class-page#page-goto)):

| Value | Waits until | Source |
|---|---|---|
| `'commit'` | "network response is received and the document started loading" | official API docs |
| `'domcontentloaded'` | "the `DOMContentLoaded` event is fired" | official API docs |
| `'load'` (**default**) | "the `load` event is fired" | official API docs |
| `'networkidle'` | "no network connections for at least 500 ms" — **docs mark this "DISCOURAGED"**, recommending web-first assertions instead | official API docs |

The [navigations guide](https://playwright.dev/docs/navigations) lays out the actual event sequence a
navigation goes through, confirming `'load'` is strictly the last and heaviest of the three useful options:

> "1. `page.url()` updates … 2. Document content loads over the network … 3. `page.on('domcontentloaded')`
> fires … 4. Scripts and resources (stylesheets, images) load … 5. `page.on('load')` fires … 6. Dynamically
> loaded scripts execute."

**What exactly does `'load'` block on?** The official page-goto doc does not enumerate the resource types
by name; the MDN-derived community explanation (quoted directly by the blog below) fills that gap
precisely and matches browser spec behaviour: *"the `load` event is fired when the whole page has loaded,
including all dependent resources such as stylesheets, scripts, iframes, and images."* This is the
mechanism, and it is why an unrelated slow third-party resource (a font, an ad script, a slow CDN) can
stall a navigation that has nothing to do with that resource.

**Real measured numbers**, from [checklyhq.com — "Why `page.goto()` is slowing down your Playwright
tests"](https://www.checklyhq.com/blog/why-page-goto-is-slowing-down-your-playwright-test/) (blog, not
official, but concrete and directly on-point — the article's own repro had one slow SVG logo stall
`'load'`):

> `commit`: 62ms · `domcontentloaded`: 159ms · `load`: 10.1s

> "such a small delay results in more than 15 minutes of waiting time in your CI/CD pipeline" (across a
> full suite) — and the article's explicit recommendation is `waitUntil: 'commit'` or `'domcontentloaded'`
> plus a targeted wait/assertion for the thing the test actually needs, "aligning tests with actual user
> behavior: people click and interact with your site whenever something's visible."

**Is `'domcontentloaded'` correct for THIS app specifically?** Yes, and more precisely than for a generic
SPA: because the 2.4 MB `dist/index.html` inlines its JS as a **synchronous inline `<script>`** (not
`async`/`defer`, not an external bundle), the browser executes that script *during* HTML parsing, before
`DOMContentLoaded` can fire. So for this app, `domcontentloaded` firing is not merely "close enough to
interactive" — it is, by the HTML spec's own event ordering, strictly *after* the app's own script has run.
`'load'` adds nothing here except waiting for whatever else is referenced (fonts, the manifest, icons),
which is unrelated to whether the app itself can be interacted with.

**Can `waitUntil` be defaulted globally in config, only per-call?** Confirmed **per-call only** — there is
no config-level default. Checked directly against the full `TestOptions` (`use` block) property list at
[playwright.dev/docs/api/class-testoptions](https://playwright.dev/docs/api/class-testoptions): it has
`navigationTimeout`, `actionTimeout`, `baseURL`, ~40 properties total, and no `waitUntil`/default-navigation
option. A follow-up search independently converged on the same conclusion. **The only way to change the
default across 154 call sites is a shared helper or a fixture override of `page.goto` itself** — there is
no config knob.

---

## Q2 — the timeout hierarchy, and the correct fix vs the wrong one

**Full hierarchy**, from [playwright.dev/docs/test-timeouts](https://playwright.dev/docs/test-timeouts)
and [playwright.dev/docs/test-use-options](https://playwright.dev/docs/test-use-options):

| Timeout | Default | Scope | Config key |
|---|---|---|---|
| Test timeout | **30 000 ms** | whole test function + fixture setup + `beforeEach`, cumulative | `timeout` (top-level) |
| Expect (assertion) timeout | 5 000 ms | each auto-retrying `expect(...)` call, independently | `expect.timeout` |
| Action timeout | **0 (no limit)** | each interaction (`click`, `fill`, …) | `use.actionTimeout` |
| Navigation timeout | **0 (no limit)**, unless raised, e.g. by this repo's `60_000` | each navigation (`goto`, `waitForNavigation`) | `use.navigationTimeout` |
| Global timeout | 0 (no limit) | entire run, all tests combined | `globalTimeout` |

**How they nest — the load-bearing sentence:**

> "Time spent by the test function, fixture setups, and `beforeEach` hooks is included in the test
> timeout." — [test-timeouts](https://playwright.dev/docs/test-timeouts)

> "Assertion timeout is unrelated to the test timeout." — same page (the one exception: `expect()` has its
> own independent clock).

Action/navigation timeouts are **not** independent of the test timeout the way `expect` is — they are
sub-budgets *inside* the outer test-timeout clock. A navigation that would legitimately finish at 45s under
`navigationTimeout: 60_000` never gets the chance: the outer 30s test-timeout clock, which started at the
same moment, fires first and kills the whole test with the generic message. **The specific,
diagnostically-useful `navigationTimeout` error only ever surfaces if `navigationTimeout` (plus whatever
else the test does) is set to LESS than the outer test timeout.** Currently `navigationTimeout=60_000 >
timeout=30_000` (the repo's `timeout` is unset, so it's Playwright's default 30 000) — this ordering makes
`navigationTimeout` structurally unreachable. This is the precise, docs-confirmed explanation for why
raising `navigationTimeout` this session did not fix anything: the change never took effect.

**Is raising the test timeout the right move, or fixing the nav wait?** Fixing the wait. Raising the test
timeout (or fixing the `navigationTimeout`/`timeout` ordering alone) treats a symptom that a `'load'`-based
goto produces by design under any nontrivial resource set; it does not reduce how much time 154 navigations
actually spend blocked on irrelevant subresources, it only gives that blocking more room before the suite
notices. Reducing what `goto` waits for (`domcontentloaded`) removes the actual tail-latency source, which
is strictly better for both speed (every navigation gets faster, not just the ones near a threshold) and
reliability (there's no longer a race against an arbitrary ceiling for the common case).

**Correct relationship to configure, going forward:** `navigationTimeout` (and `actionTimeout`) should be
set to a value **meaningfully below** the test-level `timeout`, not above it — that is the only way its own
specific error message (rather than the generic "Test timeout exceeded") ever has a chance to fire and
tell a future debugger *what* was slow.

---

## Q3 — parallelism: `workers`, `fullyParallel`, hybrid P/E-cores, sharding

**Official default formula**, confirmed directly against
[class-testconfig#test-config-workers](https://playwright.dev/docs/api/class-testconfig#test-config-workers):

> "Defaults to half of the number of logical CPU cores." — applies uniformly, no CI-vs-local split in the
> docs (the repo's CI-vs-local split is a project decision layered on top, not something Playwright itself
> distinguishes by default).

**`fullyParallel`**, from [test-parallel](https://playwright.dev/docs/test-parallel):

> "By default, test **files** are run in parallel. Tests in a single file are run in order, in the same
> worker process." `fullyParallel: true` (the repo's setting) lifts that file-level grouping so **all**
> tests across **all** files can interleave across workers — this is correct for a suite of 433 mostly-
> independent specs and is exactly what the docs describe as the mechanism for using more of the machine.

**Does more workers stop helping — real evidence, not doc theory.** GitHub issue
[microsoft/playwright#26739](https://github.com/microsoft/playwright/issues/26739) ("Confusing performance
issues when using many workers") is the single most relevant thread found. A Playwright maintainer
(`aslushnikov`) gives the mechanism directly:

> "the main reason is system saturation. As the wall time passes, only some processes get a chance to run.
> As a result, tests timeout."

And separately in the same thread, community consensus converged on a concrete per-core budget:

> "With 4-cores you should use max 2 workers; 2 cpu per worker" — `MindaugasMateika`
> "we made sure to always use as many workers as equal to 50% of the CPU cores (in our case 8-12 cores, so
> 4-6 workers). This eliminated the weird timeout problems for us." — `csvtuda`

This corroborates, from an independent source, both Playwright's own default formula (50% of logical
cores) *and* the general shape of the repo's own empirical finding (§11a: 10 workers chosen over
higher counts because it was "as reliable" while faster — i.e. more workers past a point adds no
throughput and only adds saturation risk).

**Hybrid P-core/E-core guidance — explicitly searched for, explicitly a gap.** No official Playwright
documentation, and no credible blog/issue found in this research, gives P-core/E-core-specific guidance.
General Node.js guidance (community, not Playwright-specific) says only: `os.cpus().length` reports
*logical* cores (hyperthreads included), and CPU-bound work is "best served by a pool roughly equal to the
number of physical cores — more threads than cores just means the OS scheduler thrashes context switches."
Playwright's own workers are **not purely CPU-bound** (each spins up a real browser and spends real wall
time waiting on rendering/network, i.e. I/O-bound stretches interleave with CPU-bound stretches), which is
the standard justification for oversubscribing physical-core count somewhat — consistent with why the
project's empirically-measured 10 sits between "24 physical cores at 50%" (12) and a purely CPU-bound
"1-per-physical-core" number, without over-subscribing the 32 logical count. **Conclusion: no vendor
guidance exists for this specific hardware class; the project's own re-measurement discipline (§11a, and
the sibling `docs/research/cpu-32-core-utilization.md`, which recommends re-measuring at 12/16/20/24) *is*
the correct approach in the absence of one** — this research finds nothing that should override it.

**Sharding.** Official guidance is unambiguous that sharding (`--shard=1/N`) is a **multi-machine** lever:

> "Playwright Test can shard a test suite, so that it can be executed on multiple machines." —
> [test-parallel](https://playwright.dev/docs/test-parallel); reinforced in the maintainer's own reply in
> issue #26739 as the recommended path once a *single* machine is saturated: "the best strategy to
> parallelize on low-resource CI is to shard across multiple machines."

**Sharding is not relevant to this single-machine problem.** Splitting 433 tests across N shards on the
*same* box does not add cores — it is only useful when adding *more machines*. Not applicable here.

---

## Q4 — retries: is `retries: 0` aligned with Playwright's own guidance?

Official definition of "flaky", from [test-retries](https://playwright.dev/docs/test-retries):

> "flaky" — "tests that failed on the first run, but passed when retried."

> "By default failing tests are not retried." (the framework's own baseline is `retries: 0`, matching the
> project's setting exactly)

Playwright's docs present retries as an **opt-in convenience for known-flaky environments** (`--retries=3`
is the example given), without a stated CI-vs-local recommendation in the fetched material. The
[best-practices](https://playwright.dev/docs/best-practices) guide reinforces the same posture indirectly
by pushing hard on root-causing flakiness at the source — web-first assertions over manual polling, full
test isolation via a fresh `BrowserContext` per test ("No failure carry-over. If one test fails it doesn't
affect the other test... Easy to debug errors or flakiness, because you can run just a single test as many
times as you'd like") — rather than retrying past it.

**Both views, honestly:**
- **Playwright's framework default is 0** (matches the project) — retries are opt-in, not prescribed.
- **Common community practice** (widely seen in scaffolded configs and blog posts, not sourced to an
  official doc in this research) is `retries: process.env.CI ? 2 : 0` — nonzero on CI specifically, to
  absorb CI-only environmental noise (resource contention on shared runners) while keeping local runs
  strict. This is a *convention*, not an official recommendation this research can cite to a primary
  source.
- **Playwright does not, anywhere found, say a flake should be silently retried instead of fixed** — the
  framework gives you the tool and lets you decide; it does not make the project's stricter stance
  "wrong" by its own documentation. The project's rule (§11a: "a flake must surface as a failure and be
  fixed, never retried away") is **stricter than Playwright's default posture but not contradicted by it**,
  and is well-supported by the parallel finding in this research: this session's flake was not
  environmental noise, it was a real, fixable navigation-wait defect that a retry would have hidden
  indefinitely. **Recommendation: `retries: 0` stands**, per the task's own instruction that the project's
  rule governs unless the docs strongly disagree — they do not.

---

## Q5 — `webServer` lifecycle and teardown

**Core properties**, from [playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver):

- **`command`** — "Shell command to start the local dev server of your app." (runs through a shell — see
  the teardown risk below)
- **`url`** — polled until it "return[s] a 2xx, 3xx, 400, 401, 402, or 403 status code" before tests start
- **`reuseExistingServer`** — if `true`, reuses whatever is already listening on `port`/`url`; if `false`
  (the repo's setting), Playwright always starts its own fresh server and **owns its teardown**
- **`timeout`** — how long to wait for the server to become ready (repo: `120_000`, default is 60s)
- **`gracefulShutdown`** — "If unspecified, the process group is forcefully `SIGKILL`ed. If set to `{
  signal: 'SIGTERM', timeout: 500 }`, the process group is sent a `SIGTERM` signal, followed by `SIGKILL`
  if it doesn't exit within 500ms." **Critical platform caveat, quoted exactly: "Windows doesn't support
  `SIGTERM` and `SIGINT` signals, so this option is ignored on Windows."**

**How Windows teardown actually works — this directly answers the §11a "respawning zombie server"
concern.** Search evidence (not an official doc page, but converging web sources) confirms Playwright's
Windows implementation kills via `taskkill /T /F` — the `/T` flag terminates the **entire process tree**
rooted at the PID Playwright itself spawned, not just that one PID. This matters concretely for this repo's
`command: 'python build.py && node serve.js ${PORT}'`: the process Playwright spawns *is* the shell running
that `&&` chain; by the time tests run, the live tree is `[shell] → node serve.js (primary) → N forked
cluster workers`. A `taskkill /T /F` against the shell's PID should tear down that entire tree — primary
*and* all `cluster.fork()` workers — **simultaneously**, which is exactly what avoids the "primary survives,
refork loop respawns a workerless zombie" failure mode documented in **L (§11a)**: that failure specifically
required a *manual*, port-based, single-PID kill that left the primary alive to keep calling
`cluster.fork()`. **Letting Playwright's own webServer lifecycle own start/stop (never a manual
`taskkill`/port-based kill) is confirmed, not just asserted, as the correct pattern** — consistent with
existing §11a guidance, now with the mechanism named.

**But this exact command *shape* — build-then-serve chained with `&&` behind a shell — is precisely the
shape that has produced real, repeated teardown bugs in Playwright's own issue tracker, across many
versions.** [microsoft/playwright#19049 — "webServer not closing"](https://github.com/microsoft/playwright/issues/19049)
was opened against an `npm run start` → `"start": "npm run build && npm run preview"` config (a chained
build-then-serve command, structurally identical to this repo's), "fixed" in 1.28.1, and then **reopened by
different reporters at 1.42.1, 1.43.0, 1.44.1, 1.48.1, 1.49.0, 1.54.1, and 1.58.2** — a six-version, multi-year
recurrence, not a one-off. The related thread
[#18865](https://github.com/microsoft/playwright/issues/18865) captures *why* chained/wrapped commands are
fragile: Playwright once switched its Linux/Mac default from `SIGKILL` to `SIGTERM`, which broke exactly
this shape of command because "npm run dev spawns npm as parent and the actual server as child, so
stopping only kills npm, leaving the server running" — a maintainer response confirms the framework itself
has gone back and forth on this exact problem class. One commenter's own workaround, verbatim: *"even
SIGKILL can be problematic still, i have run into situations where that wasn't enough and resorted to use
tree-kill on the process pid to ensure everything is gone."*

**Honest confidence level on this point:** this is not a proven bug in *this exact* `python build.py && node
serve.js` config — no reproduction was run (research-only task) and Windows' forceful `taskkill /T /F` path
is structurally different from (and reportedly more reliable than) the Linux `SIGTERM`-then-orphan failure
mode in the cited issues. It is a **defense-in-depth recommendation based on a recurring pattern across the
ecosystem**, not a confirmed defect here, and should be reported as such.

---

## Q6 — flaky `page.goto` in heavy apps: the pattern in the wild

Every relevant issue found independently converges on the same two root causes, both present in this repo:

1. **`'load'` waiting on unrelated subresources** — checklyhq's measured 10.1s-vs-159ms gap (Q1) is the
   general case; [BrowserStack's writeup](https://www.browserstack.com/guide/playwright-goto) and
   [ScrapeOps' guide](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-waiting-page-element-load/)
   both independently reach "use `domcontentloaded`/`commit` plus a targeted wait for your app's own ready
   signal" as the standard fix, e.g. `page.goto(url, { waitUntil: 'commit' })` followed by
   `await expect(page.locator('<app-ready-selector>')).toBeVisible()` — `commit` returns as soon as the
   first response bytes arrive (before parsing), and the subsequent locator wait is Playwright's own
   auto-retrying web-first assertion, which is exactly the pattern §11a's DoD line 11 already mandates
   ("tests wait on conditions … never `waitForTimeout`"). This repo's existing per-test assertions after
   `goto` already provide that second half; only the `goto` wait itself needs to change.
2. **Worker-count-driven system saturation**, not a Playwright defect — issue
   [#6680](https://github.com/microsoft/playwright/issues/6680) ("tests occasionally end navigation with
   `ERR_ABORTED` after 1 or 2 seconds, and the random nature of where/when a test might fail makes it
   impossible to debug") and [#18578](https://github.com/microsoft/playwright/issues/18578) both describe
   symptoms that resolve to the same maintainer explanation given in Q3: too many workers relative to real
   available cores causes some worker's browser process to be starved of CPU time long enough to blow a
   timeout that would otherwise pass comfortably. This is a second, independent reason the project's
   measure-don't-guess worker discipline (§11a) is the right process, separate from the `waitUntil` fix.

No issue or blog found in this research proposes retrying past this class of flake as the recommended
fix — every credible source treats it as a wait-strategy or resource-budget defect to be fixed at the
source, which lines up with this project's `retries: 0` rule (Q4).

---

## Concrete recommended change set

**(a) Kill the nav flake at the root — change what `page.goto` waits for, not the ceiling around it.**
Since there is no config-level default (Q1), introduce one shared entry point (e.g. a `gotoApp(page, path)`
helper, or a `page` fixture override calling the real `goto` with a default) that all 154 call sites use
instead of bare `page.goto(...)`:
```ts
await page.goto(path, { waitUntil: 'domcontentloaded' });
```
`domcontentloaded` is correct (not merely adequate) for this specific app because its JS is inline and
synchronous (Q1) — `DOMContentLoaded` cannot fire until that script has already executed. This removes the
dependency on fonts/manifest/icon fetches ever completing before a test can proceed, which is the actual
long-tail source of the flake under contention — a strictly better fix than any timeout adjustment because
it reduces real elapsed time on every run, not just the ones that happened to be close to a threshold.

**(b) Fix the timeout *ordering*, not just the numbers.** `navigationTimeout` must be set to a value
strictly *less* than the test-level `timeout` or it can structurally never fire (Q2) — currently
`60_000 > 30_000` (implicit default), which makes the current `navigationTimeout: 60_000` dead
configuration. Recommended, once (a) lands and normal navigations are back to sub-second:
```ts
export default defineConfig({
  timeout: 30_000,               // Playwright's own default; no evidence it needs raising once (a) lands
  use: {
    navigationTimeout: 15_000,   // meaningfully below the test timeout — a genuine hang now reports as
                                  // "page.goto: Timeout 15000ms exceeded" instead of the generic,
                                  // less diagnostic "Test timeout of 30000ms exceeded"
    actionTimeout: 10_000,       // currently unset (0/unlimited) — same "specific error over generic
                                  // timeout" reasoning extends to click/fill actions
  },
});
```
If, after (a), full-suite measurement still shows occasional genuinely-slow-but-successful navigations
under the chosen worker count, the correct lever is a **worker re-measurement** (Q3, and the sibling
`cpu-32-core-utilization.md` doc already proposes this), not stretching timeouts further.

**(c) Worker count** — no change recommended by this research; official default (50% of logical cores) and
the independent maintainer/community evidence in Q3 both support the project's existing measure-at-several-
candidates discipline over any fixed formula, especially with no hybrid P/E-core guidance existing anywhere
in the ecosystem. Defer to `docs/research/cpu-32-core-utilization.md`'s recommendation to re-measure at
12/16/20/24 once (a) removes the current confound (a chunk of "workers" flakiness may itself have been the
`'load'`-driven long tail, not true CPU saturation — re-measure after (a), not before, or the result will
be contaminated by the very defect this doc fixes).

**(d) `retries: 0`** — no change. Confirmed aligned with, not contradicted by, official guidance (Q4).

**(e) Guarantee clean teardown.** Two independent, low-risk changes:
1. **Never manually kill a `serve.js` process by port lookup.** Confirmed mechanism (Q5): Playwright's own
   Windows teardown (`taskkill /T /F`) kills the *entire* tree it spawned in one shot, which is what
   correctly prevents the cluster's `cluster.on('exit', () => cluster.fork())` respawn loop from ever
   getting a chance to run (the primary dies in the same forceful strike as its children). This is already
   the project's rule (§11a) — this research adds the confirming mechanism, no change needed to the rule
   itself.
2. **Consider splitting `command: 'python build.py && node serve.js ${PORT}'` into a pre-step + a direct
   server command** (e.g. run `python build.py` once before invoking `playwright test`, and set
   `webServer.command: 'node serve.js ${PORT}'` alone) — defense-in-depth given the repeated, multi-version
   pattern in [#19049](https://github.com/microsoft/playwright/issues/19049) of chained/wrapped commands
   escaping cleanup, even though this repo's Windows-specific tree-kill path looks structurally more robust
   than the Linux cases in that issue (Q5's honest-confidence note). This is optional, not urgent — no
   evidence this repo has actually hit an orphaned-server bug from the `&&` shape itself (its documented
   zombie incident was the manual-kill case, already covered by point 1).
3. `gracefulShutdown` — no change needed. Unspecified means forceful `SIGKILL` of the whole process group
   on the `ubuntu-latest` CI runner too (Linux process-group kill is itself a tree-kill), which is the
   simplest and safest choice for a stateless in-memory static server with nothing to flush on shutdown.

---

## Sources cited (official vs community, marked explicitly)

**Official Playwright docs** (playwright.dev, fetched 2026-07-23):
[class-page#page-goto](https://playwright.dev/docs/api/class-page#page-goto) ·
[navigations](https://playwright.dev/docs/navigations) ·
[test-timeouts](https://playwright.dev/docs/test-timeouts) ·
[test-use-options](https://playwright.dev/docs/test-use-options) ·
[api/class-testoptions](https://playwright.dev/docs/api/class-testoptions) ·
[test-parallel](https://playwright.dev/docs/test-parallel) ·
[api/class-testconfig#test-config-workers](https://playwright.dev/docs/api/class-testconfig#test-config-workers) ·
[test-retries](https://playwright.dev/docs/test-retries) ·
[test-webserver](https://playwright.dev/docs/test-webserver) ·
[best-practices](https://playwright.dev/docs/best-practices)

**GitHub issues** (microsoft/playwright, fetched via `gh issue view --comments` for full threads):
[#26739](https://github.com/microsoft/playwright/issues/26739) (worker saturation, maintainer + community) ·
[#19049](https://github.com/microsoft/playwright/issues/19049) (webServer not closing, 1.28→1.58) ·
[#18865](https://github.com/microsoft/playwright/issues/18865) (SIGTERM/SIGKILL history) ·
[#20705](https://github.com/microsoft/playwright/issues/20705) (graceful shutdown feature request) ·
[#30406](https://github.com/microsoft/playwright/issues/30406), [#12297](https://github.com/microsoft/playwright/issues/12297),
[#6680](https://github.com/microsoft/playwright/issues/6680), [#18578](https://github.com/microsoft/playwright/issues/18578),
[#12182](https://github.com/microsoft/playwright/issues/12182) (flaky `page.goto` under parallel load, various causes)

**Community/blog** (opinion, explicitly not official — flagged inline above wherever used):
[checklyhq.com — why page.goto() is slowing down your tests](https://www.checklyhq.com/blog/why-page-goto-is-slowing-down-your-playwright-test/) ·
[browserstack.com/guide/playwright-goto](https://www.browserstack.com/guide/playwright-goto) ·
[scrapeops.io — waiting for page/element to load](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-waiting-page-element-load/)

## §10.11 usefulness gate — deposit-worthy finds (not deposited; research-only task)

Per the task's explicit instruction ("List deposit-worthy docs (don't deposit)"): the official
`test-timeouts`, `test-webserver`, `test-use-options`, and `class-page#page-goto` pages would be genuinely
useful additions to the global `playwright-docs` tag — the existing 30-file corpus under that tag is
introductory/CLI-tool material and has a real, demonstrated gap (zero hits) on exactly the API-reference
vocabulary (`waitUntil`, `navigationTimeout`, `webServer`, `gracefulShutdown`) that this and any future
Playwright reliability question will need. Recommended for a future `graphify add` pass, not done here.
