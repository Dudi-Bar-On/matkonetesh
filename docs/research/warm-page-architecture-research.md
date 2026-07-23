# Warm-page architecture research — pre-loaded app instances instead of a cold `page.goto` per test

**Date:** 2026-07-23 · **Trigger:** owner-proposed direction, researched under §10.14 (deep research, no
guessing) — read the official docs, the Chromium/V8 sources, and the issue trackers of every technology
involved; cite everything. **Scope:** research only — no code changes, no suite runs. Every claim below is
either a direct quote from a named source (URL beside it) or an explicitly-labelled repo measurement.

**§10.11 graphify-global step (done first, as required).** Queried `~/.graphify/global-graph.json`
(4 corpora: vendor-docs 2,435 / methodology 4,335 / gemini-api-docs 71 / cloudflare-workers-docs 56) with
`fixture worker scope`, `code cache`, and `isolation browser context reuse`. All three traversals started
from Vitest/Cloudflare-Workers/GSD nodes — case-folded substring noise, zero Playwright-fixture or
V8-code-cache vocabulary. This matches the sibling research's finding that the `playwright-docs` tag is a
GUI-walk corpus without API-reference material. **Genuine miss, recorded; went to the web per the rule.**
Deposit-worthy finds are listed at the end.

---

## Verdict, up front: **CONDITIONALLY VIABLE — build it behind one cheap measurement gate.**

A worker-scoped warm page that each test reuses via *seed-localStorage → reload* is an officially
supported fixture pattern, its per-test reset is exactly reproducible for this localStorage-only app, and
a failing test can never poison its successors (Playwright kills the worker on failure). The three
decisive technical facts:

1. **Inline scripts ARE code-cached — attached to the HTML document's cache entry** — but that entry only
   survives a reload if the server answers **304**, and today's `serve.js` always answers 200, which
   V8's own documentation says *clears* the code cache ([§Q3b](#q3b)).
2. **Playwright's default (ephemeral, incognito-like) contexts get NO Chromium disk code cache at all** —
   Chromium explicitly skips creating one for in-memory profiles. The mechanism that still makes the
   reload cheap there is **V8's in-isolate compilation cache** (in-heap, keyed by source string, 80%
   real-world hit rate) — the exact "same tab, same script, navigated again" scenario a warm page is
   ([§Q3b](#q3b)).
3. **What a reload can never skip is execution** — bytecode caches avoid parse+compile only; the app's
   top-level init, DOM construction, style and layout re-run every time. So the win is bounded by the
   parse+compile+transfer share of a cold `goto`, which for this app is **unmeasured**. One standalone
   measurement script decides the whole question before any test is touched ([§Measurement](#measurement-plan)).

**Biggest risk:** cross-test state leakage on the shared page — mitigated by a full-origin reset recipe,
a hard trap on `addInitScript` in warm mode, an `isolatedPage` escape hatch, and Playwright's own
worker-shutdown-on-failure guarantee. Second risk: the win measures small because app *execution* (not
parse) dominates init — which is precisely what the W0 gate measures before anything is built.

---

## 0. Repo facts (measured for this task, not recalled)

- `dist/index.html` = **2,707,255 bytes**, containing exactly **one `<script>` tag** — `build.py:340`
  injects `app.js` into a `<script>__JS__</script>` placeholder (`build.py:351` reads `app.js`). The app
  is one synchronous inline classic script.
- `serve.js` (single-process, in-memory) sends **only** `Content-Type` + `Content-Length` — **no
  `Cache-Control`, no `ETag`/`Last-Modified`, no conditional-request handling**; every request is a full
  200 (`serve.js:41-48`).
- Production already revalidates: `dist/_headers` sends `Cache-Control: no-cache` for `/index.html`
  (Cloudflare answers the conditional requests with its own ETags). A 304-capable serve.js is therefore
  **production parity**, not a test-only divergence.
- Tests: **433 tests / ~84 spec files**; **154 `page.goto` call sites — every single one targets
  `'/index.html'`** (zero query-string variants); **145 `addInitScript` call sites**, all
  localStorage seeding (spot-checked; a few, e.g. `data-integrity.spec.ts:5`, seed *without*
  `localStorage.clear()`).
- App state surface: `app.js` touches **`localStorage` only** (20 references) — zero `sessionStorage`,
  `indexedDB`, `caches.open`, `document.cookie`.
- Page-level specials in tests: **one** spec uses `page.clock` (`waveB-datetime.spec.ts`); **one** test
  attaches `page.on('console')` (`ai-model-registry.spec.ts:74`); **zero** uses of `page.route`,
  `exposeFunction`, `grantPermissions`, `setViewportSize`.
- Config: `workers: 8` (P-core ceiling, §11a), `retries: 0`, `trace: 'retain-on-failure'`, main project
  `serviceWorkers: 'block'`, a separate 2-test `service-worker` project, `waitUntil: 'domcontentloaded'`
  defaulted via `tests/_fixtures.ts`.

---

## Q1 — Worker-scoped warm page: officially supported, with the isolation tradeoff on record

**The fixture mechanism is first-class.** Official fixtures doc
([playwright.dev/docs/test-fixtures](https://playwright.dev/docs/test-fixtures)):

> "Note the tuple-like syntax for the worker fixture - we have to pass `{scope: 'worker'}` so that test
> runner sets this fixture up once per worker." · "worker fixtures are set up for each worker process" ·
> "worker-scoped fixtures are only torn down when the worker process executing tests is torn down."

The docs' own worked example is a worker-shared `account` fixture that then **overrides the built-in
`page` fixture** ("you can also override existing fixtures to fit your needs") — i.e., both halves of the
warm-page design (worker-scoped resource + `page` override) are documented patterns, not hacks. Worker
fixtures get their own timeout "equal to the test timeout", changeable per fixture.

**The built-in `page`/`context` are test-scoped by design.** Fixtures doc: "Isolated page for this test
run" / "Isolated context for this test run"; the isolation guide
([playwright.dev/docs/browser-contexts](https://playwright.dev/docs/browser-contexts)) explains why:
"each test is completely isolated from another test", "Playwright creates a context for each test, and
provides a default Page in that context", and contexts are "fast and cheap to create and are completely
isolated" — cheap *context creation*, note, not cheap *app re-initialization*; the 2.6 MB parse+execute
is our cost, not the context object.

**Playwright's own stated tradeoff for cleanup-style reuse** (same isolation guide, quoted verbatim —
this is the honest cost side): "State from one test can leak into the next test which could cause your
test to fail" and "some things are impossible to clean up such as 'visited links'."

**The decisive safety property nobody advertises:** the parallelism doc
([playwright.dev/docs/test-parallel](https://playwright.dev/docs/test-parallel)):

> "Workers are always shutdown after a test failure to guarantee pristine environment for following
> tests."

For a warm-page architecture this is a free quarantine: **a test that fails — for any reason, including
having corrupted the shared page — takes the whole worker (and its page) down with it**, and the next
test starts in a fresh worker with a fresh warm page. With `retries: 0` the failure still surfaces; the
only cost is one extra cold parse after each failure. Also relevant: "Playwright Test reuses a single
worker as much as it can to make testing faster, so multiple test files are usually run in a single
worker one after another" — so a per-worker warm page amortizes across *files*, not just within one.

**Team stance on built-in support:** feature request
[#38575](https://github.com/microsoft/playwright/issues/38575) ("keep browser open between tests when
running in serial mode", Dec 2025) is **closed, not planned** — reuse remains a DIY fixture concern,
which is exactly what this design does.

## Q2 — Per-test reset on a reused page: the recipe, and the `addInitScript` landmine

**The landmine first.** The API docs
([playwright.dev/docs/api/class-page](https://playwright.dev/docs/api/class-page)) state, verbatim:

> "The order of evaluation of multiple scripts installed via browserContext.addInitScript() and
> page.addInitScript() is not defined."

and there is **no API to remove an init script**. So the naive migration — keep each test's
`page.addInitScript(seed)` and just reload a shared page — is **structurally broken**: 54 tests into a
worker, 54 seed scripts all run on every navigation in an *undefined order*, so "last writer wins" is a
coin flip (and the repo really has seeds that don't `clear()` first, e.g. `data-integrity.spec.ts:5`,
which would merge into whatever ran before them). **Warm mode must not use per-test init scripts at
all.** The fixture should make this impossible, not merely discouraged — see the trap in the design.

**The replacement is exact for this app.** The current semantics are: state present in localStorage
*before the app's inline script runs*. `addInitScript` achieves that by running "after the document was
created but before any of its scripts were run" (class-page doc). On a warm page already parked on the
app's origin, the same guarantee is available *before* navigation even starts:

```ts
await page.evaluate(kv => {
  localStorage.clear();                       // same clear the seeds do today
  sessionStorage.clear();                     // app never writes it; defense per reload-persistence
  window.name = '';                           // window.name survives navigation; zero it
  for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
}, seedKV);
await page.reload({ waitUntil: 'domcontentloaded' });   // app re-inits reading exactly that state
```

localStorage is origin-scoped and document-independent, so "written by the previous document, then
reload" and "written by an init script in the new document before app code" are indistinguishable to the
app. `page.reload()` "reloads the current page, in the same way as if the user had triggered a browser
refresh" (class-page doc) — a full new document: fresh JS heap, fresh DOM, the inline script re-executes
from zero. That is the same re-init a `goto` produces.

**What a reload does NOT reset** (each with the correcting API, all official):

| Survives reload | Used by app/tests? | Reset action in warm fixture |
|---|---|---|
| `localStorage` | **yes — the seeding channel** | overwritten by the seed step (that's the feature) |
| `sessionStorage` (per-tab) | no (`app.js`: 0 refs) | `sessionStorage.clear()` in seed, defensively |
| Cookies (context-wide) | no (0 refs) | `context.clearCookies()` once per test, defensively |
| IndexedDB / CacheStorage (context) | no (0 refs) | none needed; revisit if the app ever adopts them |
| Permissions (context) | no `grantPermissions` in tests | `context.clearPermissions()` if ever used |
| Init scripts | **must be zero in warm mode** | fixture traps `addInitScript` (see design) |
| `exposeFunction` bindings — "Functions installed via page.exposeFunction() survive navigations" (class-page) | 0 uses | n/a (no removal API exists — if ever needed, that test goes isolated) |
| Routes (`page.route`) | 0 uses | n/a |
| Page event listeners | 1 test (`page.on('console')`) | `page.removeAllListeners(undefined, { behavior: 'wait' })` in the per-test teardown — official API with a documented `behavior` option (class-page) |
| Viewport / emulation | fixed 390×844 project-wide, no per-test overrides | none needed |
| `page.clock` installs (init-script based → persist across reloads) | 1 spec (`waveB-datetime`) | **excluded from warm mode** — runs on `isolatedPage` |
| Visited-link state | no `:visited` assertions in suite | none possible — Playwright: "impossible to clean up" (isolation guide); accepted |
| SW registrations | blocked in main project (`serviceWorkers: 'block'`) | n/a; the 2 SW tests keep their own isolated project |

**Gotcha logged:** `context.addInitScript` from a *worker-scoped* context would likewise persist for the
worker's lifetime — the design deliberately registers **zero** init scripts on the warm context, so the
reload is bit-for-bit the plain app boot.

## Q3a — The HTTP half: reload revalidates the main resource; 304 is the whole game

**Reload semantics (Chrome ≥ 56, Jan 2017).** Chromium's announcement ("Reload, reloaded: faster and
leaner page reloads", [blog.chromium.org](https://blog.chromium.org/2017/01/reload-reloaded-faster-and-leaner-page_26.html))
and Facebook's collaboration write-up
([engineering.fb.com](https://engineering.fb.com/2017/01/26/web/this-browser-tweak-saved-60-of-requests-to-facebook/))
document the change precisely. Before: "when you reload, browsers revalidate the page that you are
currently on … they also go a step further and revalidate all sub-resources" (FB post). After: reload
**validates only the main resource** and reads subresources "directly from cache without being blocked on
the network" (FB post; Chrome "decided to apply the change for all cached resources"). Outcomes on
record: "reduce static resource requests to our servers by 60%" (FB), "reloading sites … about 28 percent
faster" ([TechCrunch coverage](https://techcrunch.com/2017/01/26/chrome-now-reloads-pages-28-faster/)).

**Applied here:** `page.reload()` on the warm page issues a **conditional request for `/index.html`**
(once the server gives it a validator). A 304 answer has no body — the browser reuses the cached 2.6 MB
from the context's cache, so the per-test transfer drops from 2,707,255 bytes to a ~few-hundred-byte
header exchange. And per Q3b, the 304 is *also* what keeps the compiled-code metadata alive.

**What serve.js must send** (currently: nothing — every response is an unconditional 200):

- `ETag: "<hash>"` — strong validator, computed **once at startup** from each cached Buffer (the files
  never change during a run; the in-memory design makes this free).
- `Cache-Control: no-cache` — "cache it, but revalidate before use". This is exactly what production
  sends for `/index.html` via `dist/_headers`, so tests get production cache semantics. (**Not**
  `no-store`, which forbids caching entirely; `max-age` would also work but diverges from production and
  buys nothing extra — reload revalidates the main resource regardless.)
- On `If-None-Match` matching → **`304` with empty body** (and no `Content-Length` mismatch).

**Prior-finding reconciliation (verify, don't inherit).** The sibling research
(`docs/research/test-stack-alternatives-research.md` §3) concluded cache headers "will not move the
~154-navigation aggregate cost" — **correct then, superseded now, by its own reasoning**: its refutation
rested on "every `page.goto` happens in a brand-new, cache-empty BrowserContext" (confirmed:
[class-browsercontext](https://playwright.dev/docs/api/class-browsercontext) — a new context "won't share
cookies/cache with other browser contexts"). The warm-page architecture removes that premise: **one
context per worker persists across ~54 tests**, its cache persists with it, and cache headers flip from
inert to load-bearing. Both documents are right about their own architecture.

## Q3b — The decisive question: does the 2.4 MB *inline* script get code-cached on reload? {#q3b}

Primary source: V8's official "Code caching for JavaScript developers"
([v8.dev/blog/code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs)), supplemented by
"Improved code caching" ([v8.dev/blog/improved-code-caching](https://v8.dev/blog/improved-code-caching))
and Chromium source. Chrome has **two** JS code caches, and they answer this question differently:

**(1) The disk code cache ("Chrome cache") — cold/warm/hot, keyed by URL, rides the HTTP cache.**

> Cold run: "Chrome downloads it and gives it to V8 to compile. It also stores the file in the browser's
> on-disk cache." · Warm run: "the compiled code is serialized, and is attached to the cached script file
> as metadata." · Hot run: "Chrome takes both the file and the file's metadata from the cache … V8
> deserializes the metadata and can skip compilation."

Eligibility mechanics that matter here, all from the same post: minimum **1 KiB** of source ("smaller
scripts are not cached at all" — our 2.5 MB qualifies ~2500×); the cache "takes advantage of the existing
HTTP resource cache"; **an HTTP 200 "updates our cached resource, and clears the code cache, reverting it
back to a cold run"** while **a 304 "keeps our code cache hot"**; savings measured at **"a reduction of
around 20–40% in both parse and compilation time on most of the pages"** with **~86% hit rate** for
cacheable scripts (improved-code-caching, Chrome 66's cache-after-top-level-execute change).

**Inline scripts — the exact answer to the task's question, verbatim:**

> "Script tags whose source is inline in the HTML do not have an external source file that they are
> associated with, and therefore can't be cached with the above mechanism."
>
> "**Chrome does try to cache inline scripts, by attaching their cache to the HTML document's resource**,
> but these caches then become dependent on the entire HTML document not changing, and are not shared
> between pages."

So the widespread claim "inline scripts are never code-cached" is **false**; the true statement is
*conditionally cached*: the cache rides the **HTML document's own cache entry**, and both of its
kill-conditions are absent in a warm-page test run — the document byte-identical for the whole run
(same build), and "not shared between pages" is irrelevant when there is exactly one page reloading one
URL. V8's own recommendation ("prefer … external files") is about *real-world* pages whose HTML churns
per-visit; a frozen `dist/index.html` behind a 304 is the best case for the doc-attached path.

**(2) BUT: Playwright's default contexts get no disk code cache at all.** Chromium's
`storage_partition_impl.cc` ([source](https://chromium.googlesource.com/chromium/src/+/HEAD/content/browser/storage_partition_impl.cc))
gates code-cache creation on `!is_in_memory()`, with this comment:

> "For Incognito mode, we should not persist anything on the disk so we do not create a code cache.
> Caching the generated code in memory is not useful, since V8 already maintains one copy in memory."

Playwright's per-test **and** any `browser.newContext()` worker context are ephemeral, incognito-style
contexts (in-memory storage partitions) → **no GeneratedCodeCache, no doc-attached disk metadata**. The
sentence's second half, though, names the mechanism that still works there:

**(3) The V8 Isolate compilation cache — the warm page's real engine in ephemeral contexts.** From
code-caching-for-devs:

> "When V8 compiles a script, the compiled bytecode is stored in a hashtable (on the V8 heap), keyed by
> the script's source code." · "The Isolate cache operates on scripts compiled in the same V8 Isolate
> (i.e. same process, roughly 'the same website's pages when navigating in the same tab')." · "This cache
> is fast and effectively free, yet we observe it getting an 80% hit rate in the real world."

A warm page reloading `/index.html` is *literally* "the same website's pages when navigating in the same
tab": same renderer process (same-site navigation), same Isolate, byte-identical inline source string →
the hashtable hit skips parse+compile with **no server, build, or profile change required at all**. Two
honest unknowns the blog does not answer: the cache lives "on the V8 heap" so **GC/memory pressure can
evict it** across a worker's ~54 reloads, and its interaction with lazy compilation (which functions'
bytecode is retained) is unspecified. Both are directly observable in the W0 measurement (below).

**(4) The external-`app.js` build option — what it would and wouldn't unlock.** Emitting the app as
`<script src="app.js">` (build.py change; still one extra static file in `dist/`, still cacheable by the
production SW later — the v8 post even documents the SW path: resources cached during SW install get "a
'full' code cache … we no longer compile functions lazily") would give the script its **own URL-keyed
cache entry**, decoupled from HTML churn — the standard cold/warm/hot ladder. But note what it does *not*
do: in an **ephemeral** context there is still no disk code cache to key (fact 2 — the Isolate cache
doesn't care whether the script is inline or external), and the HTML itself still re-parses. Where it
pays: **(a)** combined with a *persistent* context (Option B below) it moves the app from the fragile
doc-attached path to the first-class URL-keyed path; **(b)** it shrinks the HTML document from 2.6 MB to
~0.2 MB, cutting the per-reload HTML parse and making the 304-vs-200 stakes 13× smaller; **(c)** in
production it decouples app-code caching from HTML updates. It is a **conditional** recommendation:
justified only if W0 shows the isolate cache alone under-delivering.

**Cache-architecture options, ranked:**

| Option | Context type | Compile-skip mechanism | Server/build changes needed | Confidence |
|---|---|---|---|---|
| **A (recommended first)** | worker-scoped `browser.newContext()` (ephemeral) | V8 Isolate cache (in-heap, source-keyed) | ETag/304 for transfer savings only (compile path needs nothing) | mechanism documented; retention across ~54 reloads **needs measurement** |
| **B (escalation)** | worker-scoped `launchPersistentContext(tempDir-per-worker)` | disk code cache: doc-attached (inline) or URL-keyed (external) — 20–40% parse+compile reduction on record | **requires** ETag+304 (a 200 resets it to cold); temp `userDataDir` per worker ("browsers do not allow launching multiple instances with the same User Data Directory" — [class-browsertype](https://playwright.dev/docs/api/class-browsertype)); §11a teardown owns dir cleanup | mechanics fully documented; doc-attached-inline variant is the least-documented corner — prefer with external app.js |
| **C (build change)** | either | upgrades B from doc-attached to URL-keyed; shrinks HTML 13× | `build.py` emits `app.js` separately + `<script src>` | plumbing trivial; only worth it if A under-delivers |

## Q4 — Pre-warm phase: the worker IS the unit; nothing else can hold a live page

The hard boundary first: "All tests run in worker processes. These processes are OS processes"
(test-parallel). Browsers are launched *inside* worker processes; `globalSetup` runs in the runner
process — **a live `Page`/`BrowserContext` cannot cross an OS-process boundary**. Project-dependency
"setup" projects likewise share state only through *artifacts* (files, storageState), not live objects.
Therefore:

- **`globalSetup` / setup projects: not applicable** for page pre-warming (they remain right for
  build-once or auth-file concerns).
- **The worker-scoped fixture is the pre-warm phase.** It runs lazily on the first test that needs it, in
  each worker — 8 workers ⇒ **8 cold parses per run, total** (vs. 433 today). That first wave is exactly
  as heavy as today's first 8 tests, so there is no *new* thundering herd; Playwright also staggers
  worker start naturally. If measurement ever shows the 8-way simultaneous cold parse mattering, jitter
  by `workerInfo.workerIndex * delay` inside the fixture — noted, not recommended (§12.6: no ceremony
  without evidence).
- **`beforeAll` is the inferior variant** — it is per-file-per-worker, would re-run for every spec file,
  and pairs with `describe.configure({ mode: 'serial' })` in the community pattern
  ([#15931](https://github.com/microsoft/playwright/issues/15931)), sacrificing `fullyParallel`. The
  worker fixture amortizes across files with zero serialization.

What real teams do for heavy-SPA suites, per the sources found: worker-scoped auth/account fixtures are
the official pattern (fixtures doc); page reuse itself is repeatedly asked for and consistently DIY
(issues [#12162](https://github.com/microsoft/playwright/issues/12162),
[#15931](https://github.com/microsoft/playwright/issues/15931),
[#38575](https://github.com/microsoft/playwright/issues/38575) closed-not-planned);
Storybook's test-runner ships the adjacent shape at scale — "The Storybook test runner uses Jest as a
runner, and Playwright as a testing framework … each story becomes a test, which is run in a headless
browser" ([storybookjs/test-runner](https://github.com/storybookjs/test-runner)) against one running
Storybook instance, i.e. hundreds of tiny tests against a pre-hosted app rather than a rebuilt world per
test (its README does not document its page-per-worker internals, so no stronger claim is made here).

## Q5 — Warm pool ACROSS runs (owner idea #2): honest verdict — not with `npx playwright test`

Surveyed levers, each with what it can and cannot keep warm:

- **`webServer.reuseExistingServer: true`** keeps the *static server* (and its in-memory `dist/`) alive
  between runs — the only cross-run reuse Playwright officially manages. This repo deliberately runs
  `false` after real stale-server burns (§11a; config comment). Nothing page-shaped lives there anyway;
  keep `false`.
- **`browserType.launchServer()` + `connect()`** ([class-browsertype](https://playwright.dev/docs/api/class-browsertype))
  keeps the **browser process** alive across runs (a long-lived `node browser-server.js`, workers connect
  by `wsEndpoint`). But contexts/pages belong to the connecting client and end with the run — this warms
  OS file cache and skips ~1 browser launch per worker per run (sub-second each), while the actual prize
  (a parsed, initialized page) still dies with the client. **Marginal win, real plumbing** (a daemon to
  own, version-matched client/server: "requires the major/minor client/server version to match"). Not
  recommended.
- **`connectOverCDP` to a hand-managed, always-on Chrome with pre-navigated tabs** is the only way a live
  page can outlive a run — and it abandons the runner's worker model (tests would need out-of-band
  coordination mapping workers to tabs), loses ephemeral-context hygiene, and CDP connect is the path
  Playwright documents for interop rather than test-runner use. Community write-ups use it for REPL/debug
  tooling, not suites ([example](https://dev.to/stevez/i-built-a-vs-code-extension-that-turns-playwright-into-an-interactive-repl-5103),
  community). **No.**
- **UI mode / VS Code extension** is where cross-run warmth officially lives for the *human* loop:
  "Clicking on the icon will activate watch mode which will re-run the test when you make changes to it"
  ([test-ui-mode](https://playwright.dev/docs/test-ui-mode)); the extension's **Show browser** option runs
  headed ([getting-started-vscode](https://playwright.dev/docs/getting-started-vscode)) and community
  references describe the browser session being reused across runs with it enabled
  ([webfuse cheat-sheet](https://www.webfuse.com/playwright-cheat-sheet), community — the current official
  pages stop at describing headed mode, so browser-session reuse across runs is *not* claimed here as
  documented behavior). Internals for this reuse are private to the tooling (no public config knob for
  `npx playwright test`).

**Verdict:** cross-run warm *pages* are not practically reachable under the standard CLI runner; the
per-run warm page (Q1–Q4) captures almost all of the value — after W2, a full run pays 8 cold parses,
and a `--grep` dev-loop run pays 1. For interactive iteration, UI-mode watch is the blessed tool and
needs nothing from us. **Recommend: drop idea #2 for the suite; revisit only if W2 lands and per-run
fixed cost (8 parses ≈ a few seconds) somehow still matters.**

## Q6 — Prior art (what exists, what broke, what it teaches)

- [#12162](https://github.com/microsoft/playwright/issues/12162) — "Reuse single page between tests
  difficult to find": the historically-documented pattern (serial suite + `beforeAll` page) — the shape
  this design improves on (keeps parallelism, adds deterministic reset).
- [#13104](https://github.com/microsoft/playwright/issues/13104) — **video recording breaks** with a
  reused page (not used by this repo — no `video` option set).
- [#14027](https://github.com/microsoft/playwright/issues/14027) — **per-test traces break** naively;
  the documented cure is trace *chunks*: "If you'd like to record multiple traces on the same
  BrowserContext, use tracing.start() once, and then create multiple trace chunks with
  tracing.startChunk() and tracing.stopChunk()"
  ([class-tracing](https://playwright.dev/docs/api/class-tracing)) — adopted in the design, because this
  repo's `trace: 'retain-on-failure'` feeds the CI upload step and must keep working.
- [#16677](https://github.com/microsoft/playwright/issues/16677) — reused-page `goto` after page closed:
  the failure mode the fixture must guard (recreate on `page.isClosed()`).
- [#15931](https://github.com/microsoft/playwright/issues/15931), [#38575](https://github.com/microsoft/playwright/issues/38575)
  — recurring demand; team keeps it userland (closed, not planned).
- Fixture-scoping guides (community: [BrowserStack](https://www.browserstack.com/guide/fixtures-in-playwright),
  [testdino](https://testdino.com/blog/playwright-fixtures), [qaskills](https://qaskills.sh/blog/playwright-fixtures-advanced-guide))
  converge on: promote to worker scope only what profiling shows is expensive, and "ensure worker-scoped
  fixtures are … reset between tests" — this design's seed+reload *is* that reset.
- The sibling repo docs: `playwright-reliability-research.md` (DCL vs load), and
  `test-stack-alternatives-research.md` §3 (cache-header refutation under the old architecture —
  reconciled in Q3a above).

---

## Recommended design

### D1 · serve.js: validators + 304 (production parity; prerequisite for every cache path)

At startup (files are immutable for the run), alongside each Buffer store a strong ETag; in the handler:

```js
// startup: cache.set(path, { data, etag: '"' + sha1(data) + '"' })
// handler:
const hit = cache.get(p);
if (!hit) { res.writeHead(404); res.end('not found'); return; }
if (req.headers['if-none-match'] === hit.etag) {
  res.writeHead(304, { 'ETag': hit.etag, 'Cache-Control': 'no-cache' });
  res.end();
  return;
}
res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream',
  'Content-Length': hit.data.length, 'ETag': hit.etag, 'Cache-Control': 'no-cache' });
res.end(hit.data);
```

Matches `dist/_headers` semantics (`no-cache` = cache-but-revalidate). Harmless to every existing test
(a cache-empty context's first request is a plain 200, exactly as today).

### D2 · The warm fixture (`tests/_fixtures.ts`) — sketch

```ts
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

type WorkerFix = { warmContext: BrowserContext; warmPage: Page };

export const test = base.extend<{ isolatedPage: Page }, WorkerFix>({
  // ONE context per worker. Option B swaps this body for launchPersistentContext(tmpDir(workerIndex)).
  warmContext: [async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await use(context);
    await context.close();                       // §11a: the setup owns its teardown
  }, { scope: 'worker' }],

  warmPage: [async ({ warmContext }, use, workerInfo) => {
    const page = await warmContext.newPage();
    const base = (workerInfo.project.use.baseURL ?? 'http://localhost:8123');
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });  // the ONE cold parse
    // Warm mode bans per-test init scripts (order across scripts is UNDEFINED — class-page docs).
    page.addInitScript = (() => {
      throw new Error('warm page: use seedApp(page, kv) or the isolatedPage fixture');
    }) as never;
    await use(page);
  }, { scope: 'worker' }],

  // Tests keep using `page` — it now IS the warm page, wrapped with per-test trace + cleanup.
  page: async ({ warmPage, warmContext }, use, testInfo) => {
    if (warmPage.isClosed()) testInfo.fail();    // guard #16677; worker restarts on failure anyway
    await warmContext.tracing.startChunk({ title: testInfo.title });
    await use(warmPage);
    warmPage.removeAllListeners(undefined, { behavior: 'wait' } as never);  // e.g. per-test console taps
    const failed = testInfo.status !== testInfo.expectedStatus;
    await warmContext.tracing.stopChunk(
      failed ? { path: testInfo.outputPath('trace.zip') } : {});  // retain-on-failure, chunk-style
  },

  // Escape hatch: true per-test isolation (page.clock spec, SW project, future special cases).
  isolatedPage: async ({ context }, use) => { await use(await context.newPage()); },
});

/** The per-test reset: seed → reload. Replaces addInitScript(seed) + goto('/index.html'). */
export async function seedApp(page: Page, kv: Record<string, string> = {}) {
  await page.evaluate(kv => {
    localStorage.clear(); sessionStorage.clear(); window.name = '';
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, kv);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export { expect }; export type { Page };
```

Notes: fixtures are lazy, so tests using warm `page` never instantiate the per-test `context` fixture at
all; the `service-worker` project and `waveB-datetime.spec.ts` (the one `page.clock` user) are routed to
`isolatedPage`/left un-migrated; the `addInitScript` trap turns any missed migration into a loud
deterministic failure instead of a silent order-undefined leak.

### D3 · Migration shape (84 files, mechanical)

Per spec file, whole-file: `page.addInitScript(seedFn)` + `page.goto('/index.html')` →
`await seedApp(page, kvLiteral)`. The seeds are near-uniform (`clear` + a handful of
`setItem(JSON.stringify(...))`), so the transform is regular; the few no-`clear()` seeds
(`data-integrity.spec.ts`) become explicit about the keys they rely on. TDD discipline applies per file
(§3 DoD); a file is migrated only with the suite green.

### D4 · Conditional escalations (only on W0/W2 evidence)

- **Option B** — persistent context per worker (`launchPersistentContext`, scratch `userDataDir` per
  `workerInfo.workerIndex`, cleaned in teardown) if the isolate cache proves evicted/insufficient.
- **Option C** — `build.py` emits external `app.js` if compile time still dominates after B, or
  independently for the production SW full-code-cache benefit (a product decision beyond tests — raise
  separately, §10.8).

### Expected win — what is known vs. what needs measurement

**Known, cited:** transfer per test 2.6 MB → ~0 (304, Q3a); parse+compile skippable at 20–40% of
parse+compile time via disk cache (Q3b, persistent variant) or via the isolate cache's documented 80%
real-world hit rate (ephemeral variant); per-run cold parses 433 → 8; context/page creation already
"cheap" per Playwright, unchanged. **Unknown until W0 (stated plainly):** this app's split of cold-goto
time between {fetch, HTML parse, JS parse+compile} (recoverable) and {JS execute, render} (never
recoverable — reload always re-executes); isolate-cache retention across ~54 sequential reloads under GC.
**If execute+render dominates, the warm page saves little wall-time** — the remaining prize would be
reliability headroom: every ms shaved from init is P-core pressure removed from exactly the path that
caps workers at 8 (§11a), so even a moderate parse-share win can compound into a higher stable worker
count. That compounding is a hypothesis to re-measure per §11a rules, not a promise.

### Isolation risks and mitigations (consolidated)

| Risk | Mitigation |
|---|---|
| State leaks between tests on the shared page (Playwright's own warning, Q1) | seed+reload resets the entire app-visible surface for a localStorage-only app (Q2 table); cookies/permissions cleared defensively; leak-prone APIs (`route`, `exposeFunction`, clock) are unused or routed to `isolatedPage` |
| A failing test corrupts the page for successors | impossible by construction: "Workers are always shutdown after a test failure" (official) — the page dies with the worker |
| Undefined init-script ordering re-introduced by a future test | fixture trap throws on `addInitScript` in warm mode |
| Per-test traces/videos degrade (prior art #14027/#13104) | trace chunks per test (official API); video is not used in this repo |
| Renderer memory growth across ~54 reloads (heap, detached nodes) | W0 measures RSS across 60 reloads; if it climbs, recycle the warm page every N tests (cheap: one extra cold parse per N) |
| Warm page killed mid-suite (crash, `page.isClosed()`) | fixture guard fails the test → worker restart delivers a fresh warm page (#16677 lesson) |
| Divergence from production first-load behavior | unchanged coverage: every worker's first test still exercises a cold boot; the 2 SW tests and smoke stay isolated; and reload-boot equals goto-boot for this app (Q2) |

## Measurement plan (W0 — decides everything; run per §11a: serialized, idle machine) {#measurement-plan}

**Instrument, don't guess (§5).** A standalone script `scripts/measure-warm-page.mjs` (plain Playwright
library, NOT the test runner, so no config coupling), against `node serve.js 8124` (its own port — never
racing the suite's 8123):

1. **Baseline cold cost + split.** New ephemeral context → `goto('/index.html')` ×30 (fresh context each
   time, today's architecture). Record `performance.getEntriesByType('navigation')[0]` (transferSize,
   domContentLoadedEventEnd) and a CDP trace window (`devtools.timeline` + `v8` categories) on 3 runs to
   split fetch / parse+compile (`v8.compile`, `EvaluateScript`) / execute+render. **This split is the
   go/no-go number.**
2. **Warm-ephemeral (Option A).** One context+page → `goto` once → 60× {seed-evaluate → reload}. Record
   the same metrics per reload: 1st/2nd/3rd, p50, p95; renderer RSS every 10 reloads. Compare against
   (1): the delta on parse+compile shows the isolate-cache hit and its retention; transferSize shows
   304 behavior — run once with today's serve.js (200s) and once with D1 (304s) to isolate the header
   effect (one variable per experiment).
3. **Warm-persistent (Option B).** Same as (2) with `launchPersistentContext(scratchDir)`; a
   `v8.compile` trace shows `consumed cache` vs `produced cache` on reloads 2/3 — direct evidence of the
   doc-attached inline code cache working (or not) — the least-documented corner of Q3b, settled
   empirically.
4. **(Optional, only if 2–3 disappoint) External app.js prototype**: hand-split a copy of
   `dist/index.html` in a scratch dir (no build.py change) and rerun (3).
5. **Success gates.** Proceed to W1/W2 if warm reload p50 ≤ **60%** of cold `goto` p50 (i.e. the
   recoverable share is real) AND RSS is flat-ish over 60 reloads. Escalate to B/C only if their step
   shows a further ≥ **15%** improvement over A. Below the gate → write the numbers down, stop, and
   report the architecture as measured-out (execution-dominated init), with the numbers as the answer to
   the owner's proposal.
6. **After any W2 build-out:** full suite `npx playwright test`, plain, ~6–9 runs over time per §11a's
   own sampling rule before declaring the flake profile unchanged; then (and only then) a separate,
   single-variable re-measurement of the worker ceiling.

## Sources

**Official docs:** Playwright [test-fixtures](https://playwright.dev/docs/test-fixtures) ·
[browser-contexts](https://playwright.dev/docs/browser-contexts) ·
[test-parallel](https://playwright.dev/docs/test-parallel) ·
[class-page](https://playwright.dev/docs/api/class-page) ·
[class-browsercontext](https://playwright.dev/docs/api/class-browsercontext) ·
[class-browsertype](https://playwright.dev/docs/api/class-browsertype) ·
[class-tracing](https://playwright.dev/docs/api/class-tracing) ·
[test-ui-mode](https://playwright.dev/docs/test-ui-mode) ·
[getting-started-vscode](https://playwright.dev/docs/getting-started-vscode) ·
V8 team [code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs) ·
[improved-code-caching](https://v8.dev/blog/improved-code-caching) ·
Chromium [blog: Reload, reloaded (2017)](https://blog.chromium.org/2017/01/reload-reloaded-faster-and-leaner-page_26.html).

**Source code (primary):** Chromium
[storage_partition_impl.cc](https://chromium.googlesource.com/chromium/src/+/HEAD/content/browser/storage_partition_impl.cc)
(in-memory partitions get no code cache — quoted comment) ·
[generated_code_cache.cc](https://chromium.googlesource.com/chromium/src/+/66b9ad64f4a4158e847403f974569dc9ef7c50b3/content/browser/code_cache/generated_code_cache.cc)
(URL+origin-keyed JS bytecode cache, disk backend) · this repo's `serve.js`, `build.py`,
`playwright.config.ts`, `tests/_fixtures.ts`, `dist/_headers` (all read in full).

**Issues (microsoft/playwright):** [#12162](https://github.com/microsoft/playwright/issues/12162) ·
[#13104](https://github.com/microsoft/playwright/issues/13104) ·
[#14027](https://github.com/microsoft/playwright/issues/14027) ·
[#15931](https://github.com/microsoft/playwright/issues/15931) ·
[#16677](https://github.com/microsoft/playwright/issues/16677) ·
[#38575](https://github.com/microsoft/playwright/issues/38575) (closed, not planned).

**Community (marked as such wherever used):**
[engineering.fb.com — browser tweak saved 60% of requests](https://engineering.fb.com/2017/01/26/web/this-browser-tweak-saved-60-of-requests-to-facebook/) ·
[TechCrunch — Chrome reloads 28% faster](https://techcrunch.com/2017/01/26/chrome-now-reloads-pages-28-faster/) ·
[storybookjs/test-runner](https://github.com/storybookjs/test-runner) ·
[BrowserStack fixtures guide](https://www.browserstack.com/guide/fixtures-in-playwright) ·
[testdino fixtures guide](https://testdino.com/blog/playwright-fixtures) ·
[qaskills fixtures guide](https://qaskills.sh/blog/playwright-fixtures-advanced-guide) ·
[webfuse Playwright cheat-sheet](https://www.webfuse.com/playwright-cheat-sheet) ·
[dev.to REPL-extension write-up](https://dev.to/stevez/i-built-a-vs-code-extension-that-turns-playwright-into-an-interactive-repl-5103).

## §10.11 usefulness gate — deposit-worthy finds (listed, not deposited in this research-only task)

Genuinely reusable across projects and highly likely to be needed again — recommended for a
`graphify add` → `graphify global add … --as <name>-docs` pass (consolidating with the sibling docs'
identical recommendation, which is still outstanding): **v8.dev code-caching-for-devs +
improved-code-caching** (the only authoritative statement of inline-script cache semantics found
anywhere), **playwright test-fixtures / browser-contexts / test-parallel / class-tracing** (the
worker-scope, isolation-tradeoff, worker-restart-on-failure, and trace-chunk primitives). One-offs not
worth depositing: the 2017 reload-behavior posts (settled history, easily re-found), the community
fixture guides (restate the official docs), the Chromium source files (living code — link, don't
snapshot).
