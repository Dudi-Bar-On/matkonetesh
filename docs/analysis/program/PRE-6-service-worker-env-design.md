# PRE-6 · A service-worker-exercisable environment — design document

**Status:** DESIGN ONLY — options + recommendation, no code. Awaiting owner decision.
**Charter reference:** `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md:100` — "PRE-6 | A
service-worker-exercisable environment | `app.js:9546` gates on `protocol === 'https:'`, so the whole
update-delivery channel is untestable." Explicitly out of scope for the Phase −1 mechanical plan
(`docs/superpowers/plans/2026-07-22-phase-minus-1-mechanical-prerequisites.md:13`): *"PRE-6 ... carries a
genuine design decision the charter does not answer... gets a short design pass first."* This is that pass.
**Written under a hard constraint:** a worker-ceiling measurement (Task 6 of the Phase −1 plan) was running
the Playwright suite repeatedly on this machine at the time of writing. No server was started and
`npx playwright test` was not run for this document. Where that matters for confidence, it is flagged
explicitly (§6).

---

## 1. The problem, traced in the code

**`app.js:9544-9564`** — the entire SW registration block:

```js
9544  /* T4: register the service worker in production (https only — the http test server skips it).
9545     Prompts a refresh when a new build has been fetched and is waiting. */
9546  if('serviceWorker' in navigator && location.protocol==='https:'){
9547    window.addEventListener('load',function(){
9548      navigator.serviceWorker.register('sw.js').then(function(reg){
9549        mkSWReg=reg; try{ navigator.serviceWorker.ready.then(function(r){ mkSWReg=r||reg; }); }catch(e){}
9550        reg.addEventListener('updatefound',function(){ const nw=reg.installing; if(!nw) return;
9551          nw.addEventListener('statechange',function(){ if(nw.state==='installed' && navigator.serviceWorker.controller && typeof toast==='function'){
9552            if((typeof anyTimerActive==='function'&&anyTimerActive())||(typeof planStarted==='function'&&planStarted())) return;
9553            toast('גרסה חדשה זמינה', function(){location.reload();}, 'רענן עכשיו'); } });
9554        });
9555        // Actively ASK for a new worker instead of waiting for the browser to notice...
9556        // ...v255 reached the server but not the device. Check on launch, and again on foreground.
9557        const _swPoke=function(){ try{ reg.update(); }catch(e){} };
9558        _swPoke();
9559        document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') _swPoke(); });
9560      }).catch(function(){});
9561    });
9562  }
```

Everything downstream of line 9546 — `register()`, `mkSWReg`, the `updatefound`/`statechange` update-toast
flow, `reg.update()` on launch and on `visibilitychange` (the v256 fix for "v255 reached the server but not
the device", `docs/process/development-discipline.md` L14) — is dead code under test, because the `if` on
9546 is false in every Playwright run.

**`build.py:400-425`** — `sw.js` generation, unconditional (no `https` check here; the file is always
written to `dist/`):

```python
400  # service worker (T4): precache the shell so the app works offline (phone-by-the-smoker).
401  # cache name keyed on a content hash so every build invalidates cleanly.
403  _ver = _hashlib.md5(html.encode("utf-8")).hexdigest()[:8]
404  _sw = """const CACHE='mk-%s';
405  const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
406  self.addEventListener('install', ... caches.open(CACHE).then(...c.addAll(SHELL)...
407  self.addEventListener('activate', ... caches.keys()... k!==CACHE ... caches.delete(k) ...
408  self.addEventListener('fetch', ...
423  """ % _ver
424  with open(_os.path.join(_dist, "sw.js"), "w", encoding="utf-8") as f:
425      f.write(_sw)
```

`CACHE` is `'mk-' + <8-char md5 of the built HTML>`. `dist/sw.js` exists on every build, gated on nothing —
so the artifact under test is real; only the browser-side registration call is skipped.

**`serve.js:1-57`** — a clustered, in-memory, **plain-HTTP-only** static server. `http.createServer` at
`serve.js:48`; no TLS anywhere in the file. It serves every file under `dist/` (recursively cached into a
`Map`, `serve.js:38-46`), including `sw.js` with the correct MIME type (`'.js': 'text/javascript;
charset=utf-8'`, `serve.js:21`) — so nothing about the artifact or the server blocks a registration attempt
except the app's own `protocol==='https:'` gate.

**`playwright.config.ts:23-30, 42-51`** — `use.baseURL` is `http://localhost:${PORT}` (line 24); no
`ignoreHTTPSErrors` is set anywhere; `webServer.command` is `python build.py && node serve.js ${PORT}`
(line 45), plain HTTP. One `projects` entry (`chromium` / Desktop Chrome at 390×844).

---

## 2. What is already known — prior in-repo evidence

This exact question was already investigated once, independently, during the 2026-07-22 sweep, with a live
measurement — not a guess:

> **`docs/analysis/sweep/VERIFY-W1-C-app-walkthrough.md:87` (finding D24, CONFIRMED):**
> `app.js:9546` `if('serviceWorker' in navigator && location.protocol==='https:')`. On
> `http://localhost:8211` I measured `isSecureContext: **true**`, `protocol: "http:"`,
> `getRegistrations() → 0`. The gate is strictly narrower than the platform's secure-context rule, so the
> SW, its update toast and its alarms are unexercisable locally or in CI.

That same finding is gap **#26** in `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md:469-472`
("The SW gate is stricter than the platform") and is cited again in `docs/analysis/program/SEQ-analysis.md
:605-612` (§7.6), which already sketches both branches of the decision this document is resolving:

> `docs/analysis/program/SEQ-analysis.md:612`: **"Either relax the gate to `isSecureContext`, or add one
> HTTPS CI job."**

**What that prior measurement proves, precisely:** `window.isSecureContext` was `true` on a real
`http://localhost:<port>` origin served by this project's own dev/test server. **What it does not prove:**
that `navigator.serviceWorker.register('sw.js')` would actually succeed if the app's own gate were removed
— because the gate was never removed for that measurement, so `register()` was never called.
`getRegistrations() → 0` in that finding is a direct consequence of the gate blocking the call, not
independent evidence about registration success. Closing that specific gap is the "first implementation
step" flagged in §6 below.

---

## 3. The pivotal question — resolved

**Is `http://localhost` (or `http://127.0.0.1`) a secure context for Service Worker registration, as
Chromium actually implements it today?**

### 3.1 Graph-first, per §10.11 — and a stated miss

Queried `~/.graphify/global-graph.json` before searching the web, per CLAUDE.md §10.11/§10.13:

```
graphify query "service worker https localhost secure context registration" --graph "$G" --budget 1500
graphify query "ignoreHTTPSErrors https webServer localhost" --graph "$G" --budget 1500
graphify query "secure context trustworthy origin certificate self-signed" --graph "$G" --budget 1200
```

**No relevant vocabulary matched.** The corpus's `playwright-docs-*` nodes (`playwright-docs-02` through
`-15`, inspected via `graphify explain`) are the **Playwright MCP/CLI tool** docs — "Cookies", "Core
Commands", "DevTools", "Interacting with pages", "Named sessions" — not the `@playwright/test` Node config
API reference, and the corpus holds nothing about Chromium's secure-context algorithm. Per §10.11's own
rule ("if no vocabulary token matches, say so and stop; never invent tokens to force a hit"), this is
recorded as a genuine miss, not silently skipped — and per the §10.11 feedback loop, official Playwright
API docs are a legitimate candidate to add to the global graph after this task (noted in §7).

Went to primary sources next. This project's installed package types were checked directly as well —
see §4.

### 3.2 MDN — Secure Contexts (fetched directly, quoted verbatim)

> "A **potentially trustworthy origin** is one that the browser can generally trust to deliver data
> security, even though strictly speaking it does not meet the criteria of a secure context.
>
> Locally-delivered resources such as those with `http://127.0.0.1`, `http://localhost`, and
> `http://*.localhost` URLs (for example, `http://dev.whatever.localhost/`) are not delivered using HTTPS,
> but they can be considered to have been delivered securely because they are on the same device as the
> browser. They are therefore potentially trustworthy. This is convenient for developers testing
> applications locally."

And MDN's own worked example for gating a feature on secure-context status is the canonical form of
exactly the fix this document evaluates:

```js
if (window.isSecureContext) {
  // Page is a secure context so service workers are now available
  navigator.serviceWorker.register("/offline-worker.js").then(() => { /* … */ });
}
```
— [MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)

### 3.3 Chromium — historical confirmation

`http://127.0.0.1` has always been "potentially trustworthy" (loopback IP is in the primary spec
algorithm). `http://localhost` specifically needed its own fix because `localhost` was not historically
*guaranteed* to resolve to a loopback address on every OS/network configuration — closed by Chromium's own
**"Intent to Implement and Ship: Treat `http://localhost` as a secure context"** (blink-dev,
`https://groups.google.com/a/chromium.org/g/blink-dev/c/RC9dSw-O3fE/m/E3_0XaT0BAAJ`), which states Chrome
"will ensure that `localhost` resolves to a loopback address, thereby ensuring that `http://localhost/` and
`http://*.localhost/` can be safely treated as secure contexts, just like `https://example.com/` and
`http://127.0.0.1/`." This shipped years ago (Chrome ~71, 2018) and is long-settled, stable platform
behaviour — not a moving target for the Chromium build Playwright currently bundles.

**Verdict: CITED, high confidence.** `http://localhost:8123` (this project's exact test origin) is a secure
context in Chromium today, for Service Worker registration specifically — MDN uses that exact API as its
example. **The only thing stopping SW registration under the current Playwright run is the app's own
`location.protocol==='https:'` string check, which is narrower than the platform's actual secure-context
boundary.** This confirms `docs/analysis/program/SEQ-analysis.md:612`'s framing and turns it from a
plausible hypothesis into a cited fact.

---

## 4. `ignoreHTTPSErrors` and a self-signed cert — does the SW actually register?

Checked the primary source first: this repo's own installed package, `node_modules/playwright/types/test.d.ts`.

- **`webServer` accepts an array**, not just a single server object (`test.d.ts:1043`:
  `webServer?: TestConfigWebServer | TestConfigWebServer[]`), with a documented multi-server example
  (`test.d.ts:989-1015`). This is what makes Option 4 (§5) mechanically possible without forking the config
  into two files.
- **`ignoreHTTPSErrors: boolean`** (`test.d.ts:7274`) — "Whether to ignore HTTPS errors when sending network
  requests. Defaults to `false`." Settable globally in `use` or per-project.

**Does `ignoreHTTPSErrors` let a Service Worker register on a self-signed cert, or does Chromium still
refuse?** Secure-context determination for the `https:` scheme is scheme-based, not certificate-validity
based — nothing in the W3C Secure Contexts algorithm conditions "potentially trustworthy" on certificate
trust for an `https:` origin; certificate validation is a separate TLS-layer check that `ignoreHTTPSErrors`
(Playwright) / `--ignore-certificate-errors` (Chromium flag) suppresses. Community practice confirms this
works in practice for SW specifically:

> "You also won't see any warning errors anymore and your service worker will register." — Dean Hume,
> [*Testing Service Workers locally with self signed certificates*](https://deanhume.com/testing-service-workers-locally-with-self-signed-certificates/),
> describing `--ignore-certificate-errors` / `--unsafely-treat-insecure-origin-as-secure`.

But there is a real, cited counter-signal worth weighing honestly: [mswjs.io's own local-HTTPS
recipe](https://mswjs.io/docs/recipes/using-local-https) documents the **default failure mode** — an
*untrusted* self-signed cert, with **no override flag applied**, produces `SecurityError: Failed to
register a ServiceWorker: An SSL certificate error occurred when fetching the script` — and mswjs's own
fix is to make the cert **actually trusted** (`mkcert`), not to pass an ignore-errors flag. And a live,
open GitHub issue — [microsoft/playwright#33596](https://github.com/microsoft/playwright/issues/33596),
titled *"Self-signed cert fails in Firefox (and sometimes Chrome)"* — reports Chromium intermittently
rejecting a self-signed cert even with the ignore-errors path applied, with **no root cause identified in
the thread**. Chromium's own narrower, purpose-built escape hatch for exactly this scenario —
`chrome://flags/#allow-insecure-localhost` / `--allow-insecure-localhost` — **has been removed** in current
Chrome ("Chrome will no longer automatically load insecure websites on the local machine" as of ~Chrome
118), so it cannot be relied on going forward.

**Verdict: INFERRED with moderate-to-high confidence, not a clean citation.** `ignoreHTTPSErrors: true` (or
the equivalent `--ignore-certificate-errors` launch flag) most likely lets the SW register on a self-signed
cert, and this is standard practice reported by multiple independent sources — but it is not spec-guaranteed
and has at least one open, unresolved intermittent-failure report against current Chromium. Anyone choosing
Option 1 should budget a short spike to confirm it locally before committing to the approach, or use a
properly locally-trusted cert (`mkcert`) instead of the ignore-errors flag to remove this risk entirely, at
the cost of adding `mkcert` (or equivalent) as a dev-machine + CI prerequisite.

---

## 5. The options

| # | Option | Mechanism | Does the SW register? | App code touched? | New infra? | Blast radius on existing ~420 tests |
|---|---|---|---|---|---|---|
| **1** | **HTTPS test server + self-signed/mkcert cert** | A `https.createServer` wrapper around (or replacing) `serve.js`, on a second port; `use.ignoreHTTPSErrors: true` or an mkcert-trusted cert | Yes — exercises the **exact unmodified** production gate (`location.protocol==='https:'`) | **None** | A cert (generated fresh per run, or `mkcert`-installed), a `https.createServer`/TLS wrapper file, cert lifecycle (expiry, CI generation) | None directly, but `webServer` boots for *every* run once added (both servers start; §4 array support confirms this is one Playwright config, not two) — small startup-time cost on every suite run, not just SW specs |
| **2 · Recommended** | **Relax the app's own gate to match the platform's real boundary** | `app.js:9546`: `location.protocol==='https:'` → `self.isSecureContext` (or equivalent) | Yes — on `https:` in production **and** on `http://localhost`/`127.0.0.1` in dev/test, because that is what `isSecureContext` already evaluates to (§3) | **One line, `app.js`** | None | Zero — no config or server change; existing tests are unaffected because they never touch this code path today either way |
| **3** | **`--unsafely-treat-insecure-origin-as-secure=http://localhost:8123`** Chromium launch flag | Add to `playwright.config.ts`'s `launchOptions.args` (a slot already used, `playwright.config.ts:29`, for the fonts host-resolver-rules trick) | Yes, for the named origin | None | None (config-only) | None — but **solves a problem that does not exist here**: `http://localhost` is already secure per §3, so this flag is redundant for this project's exact setup. It would matter if the test origin were a *non-*localhost hostname (the way `--host-resolver-rules` is used for `fonts.googleapis.com` at `playwright.config.ts:29`), which it is not |
| **4** | **Dedicated HTTPS Playwright *project*** (packaging, not an alternative mechanism) | A second `projects[]` entry with its own `testMatch`/`testIgnore` and `use.baseURL: https://localhost:<port2>`, paired with Option 1's server | Same as Option 1 | None | Same as Option 1, plus per-project `testMatch` bookkeeping | Structurally the safest way to run Option 1 if chosen — isolates new SW specs from the other ~420 by file pattern, so nothing about the existing suite's `use`/`baseURL` changes |

**Option 3 is not a real alternative to Option 2 here** — it is the mechanism you'd reach for if the
platform did *not* already treat `localhost` as secure, or if the test origin needed to be some other
hostname. Since the app's `baseURL` is already `http://localhost:${PORT}` (`playwright.config.ts:24`), §3
already answers the question this flag exists to solve. Listed for completeness because the task explicitly
asked for it to be compared, not because it earns a place in the recommendation.

**Option 4 is a packaging technique for Option 1**, not a fifth path — it answers "how do you keep the
blast radius small" *if* you choose the HTTPS-server route. It is folded into Option 1's cost estimate
above rather than carrying its own row of consequences.

---

## 6. Recommendation

**Option 2 — relax `app.js:9546`'s gate from `location.protocol==='https:'` to a secure-context check
(`self.isSecureContext`, or the equivalent already-computed value).**

**Why this, over building an HTTPS harness:**

1. **It is the smaller, cheaper, more correct change**, not a workaround. The current gate is a
   hand-written reimplementation of a platform check the browser already performs natively —
   `navigator.serviceWorker.register()` itself will refuse to run outside a secure context regardless of
   what the app's own `if` says. The app's check is currently **stricter than the browser's own gate**
   (it accepts only the literal string `'https:'`), which is the actual bug MDN's own canonical example
   (`if (window.isSecureContext) { navigator.serviceWorker.register(...) }`, §3.2) does not have.
2. **It does not touch `serve.js`, `playwright.config.ts`, or add any new dependency, certificate, or
   process.** Options 1/4 require a TLS wrapper, a cert (self-signed with real, cited intermittent-failure
   risk in current Chromium, §4 — or `mkcert` with its own install/CI prerequisite), and ongoing cert
   lifecycle maintenance for a project whose actual production deployment (`https://matkonetesh.pages.dev`,
   Cloudflare Pages) already terminates TLS for it — none of that machinery reflects anything the real
   deployment needs.
3. **It exercises the real code, not a parallel path.** The whole point of PRE-6 is that `reg.update()` on
   launch/`visibilitychange` (the v256 fix, L14) and the update-toast flow are currently dead under test.
   Option 2 makes them live under the **existing** 420-test suite and CI, immediately, for every test that
   happens to touch this code — not only inside a separate HTTPS-only project that most contributors will
   forget exists.

**Safety consideration — does this weaken the production gate? No, and here is the reasoning to state
explicitly, since §4 of `CLAUDE.md` requires flagging exactly this kind of change:**

- `isSecureContext` is computed **entirely by the browser** from the actual navigated origin and scheme. An
  app cannot spoof it. A real attacker serving a phishing clone over plain HTTP on the public internet
  produces `isSecureContext === false` — identically to today.
- On the real production origin, `https://matkonetesh.pages.dev`, `isSecureContext` is `true` for exactly
  the same reason `location.protocol==='https:'` is currently true — **the two checks agree on every real
  user's session.** The only place they diverge is the browser's own carved-out development exception
  (`localhost`/`127.0.0.1`/`file:`), which was never a real risk surface to begin with — it requires
  physical or process access to the same machine.
- So this is not "loosening a safety check" in the sense §4 cares about (a `bcheck`/`temp`/`safe`-value
  change) — it is aligning a hand-rolled proxy check with the platform primitive it was trying to
  approximate, strictly widening only the already-trusted loopback/file case.

**What the fix buys, concretely, for a test:** once `register()` actually runs, a Playwright test can
directly assert the previously-dead code:

- `await page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready)` —
  registration/activation actually happened (today: impossible, `getRegistrations() → 0` per D24).
- `await page.evaluate(() => caches.keys())` — should contain exactly one key matching `mk-[0-9a-f]{8}`,
  proving `build.py`'s content-hash `CACHE` naming (§1) reaches the browser.
- **The update flow**, without needing a second real build: intercept the SW script URL
  (`page.route('**/sw.js', route => route.fulfill({ body: <modified sw.js with a different CACHE const> }))`),
  call `reg.update()` in-page, and assert `updatefound` fires, the new worker reaches `'installed'`, and —
  with a controlled `navigator.serviceWorker.controller` already set from a prior load — the
  `toast('גרסה חדשה זמינה', ...)` call fires (`app.js:9551-9553`). This is a standard, well-established
  technique for testing SW update flows without a second real deployment.
- The "don't interrupt a live cook" guard (`app.js:9552`) becomes testable too: same flow, but with
  `anyTimerActive()`/`planStarted()` returning true, asserting the toast is **suppressed**.

**Cost:** one line in `app.js`, changed in a dedicated task (its own RED/GREEN cycle per DoD lines 2-3, not
folded into the Phase −1 mechanical plan, which explicitly excludes PRE-6 and forbids touching `app.js`
— `docs/superpowers/plans/2026-07-22-phase-minus-1-mechanical-prerequisites.md:21`). New SW-specific specs
are additive, ordinary Playwright tests — no new project, no new server, no new webServer entry.

**If the owner prefers to also exercise the literal, unmodified `location.protocol==='https:'` string** —
e.g. wanting the test suite to prove the *exact* shipped condition rather than a corrected one — that is
Option 1/4, and it remains a legitimate, fully-specified fallback in the table above. It costs materially
more (a TLS wrapper + cert lifecycle + the open Chromium intermittent-failure risk in §4) for a benefit
that, per §3's citations, is already covered by the browser's own native secure-context enforcement
underneath whatever string the app checks.

---

## 7. Honest gaps in this evidence

Two things this document does **not** claim to have verified, stated plainly rather than implied:

1. **No live registration probe was run in this repo this session.** The task's hard constraint (a
   worker-ceiling measurement was running; no server, no `npx playwright test`) forbade starting `serve.js`
   or launching a browser against it. The MDN citation (§3.2), Chromium's shipped behaviour (§3.3), and this
   repo's own prior D24 measurement of `isSecureContext` (§2) triangulate to high confidence, but the actual
   sentence **"calling `register('sw.js')` on `http://localhost:8123` in *this* `serve.js` succeeds and
   installs"** has not been executed and witnessed in this session. **This is recommended as literally step
   1 of implementing Option 2** — before writing the app.js one-liner, prove the hypothesis with a throwaway
   script: load `http://localhost:8123`, call `navigator.serviceWorker.register('sw.js')` directly from
   devtools/`page.evaluate` (bypassing the gate manually), and confirm `getRegistrations().length === 1`
   and a `caches.keys()` entry appears. If that fails for any reason not predicted here, the recommendation
   in §6 should be revisited before the one-line fix is written as if it were certain to work.
2. **The graphify global graph has no vocabulary for this question** (§3.1) — a genuine coverage gap in the
   `playwright-docs` corpus (it covers the MCP/CLI tool, not the `@playwright/test` config API or browser
   platform semantics). Per the §10.11 feedback loop, this is worth closing later by adding the official
   Playwright test-config docs and/or MDN's Secure Contexts page to the global corpus, tagged
   `playwright-test-docs`/`web-platform-docs`, so the next session does not repeat this same web search. Not
   done in this document because it is a design pass, not a documentation-maintenance task, and the owner
   has not been asked whether to fold it in.

---

## 8. The decision for the owner

**Question:** which environment should make the Service Worker exercisable under test?

| Option | One-line summary | Cost |
|---|---|---|
| **A — Recommended** | Relax `app.js:9546` from `location.protocol==='https:'` to a secure-context check (`self.isSecureContext`). One line of production code; SW becomes testable on the existing `http://localhost` suite immediately, no new infrastructure. | Smallest: 1 line + new SW specs. No cert, no TLS wrapper, no new webServer entry. |
| **B** | Keep `app.js` untouched; build a second HTTPS `webServer` entry + self-signed/mkcert cert + a dedicated `projects[]` entry (`testMatch`-scoped) for SW-only specs. Exercises the literal shipped `https:` string check unmodified. | Larger: new TLS wrapper/cert lifecycle, a documented intermittent-failure risk in current Chromium with the ignore-errors path (§4), ongoing maintenance. Existing suite unaffected either way. |

**This document's recommendation is A**, on the grounds in §6: it is provably a correctness fix (the app's
existing check is narrower than the platform boundary it was trying to express), it costs one line versus
new infrastructure, and it makes the dead update-delivery code (`reg.update()`, the update toast, the
content-hashed cache) exercisable by the *entire* existing suite rather than a segregated HTTPS-only corner
of it. **Recommend the owner approve Option A**, with the §7.1 registration-probe spike run first (and
reported) before the one-line change is committed as a normal TDD task under its own RED/GREEN cycle.

---

## Sources

- **In-repo, read this session:** `app.js:9538-9564`, `build.py:390-430`, `serve.js:1-57`,
  `playwright.config.ts:1-52`, `package.json`, `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md:94-103`,
  `docs/superpowers/plans/2026-07-22-phase-minus-1-mechanical-prerequisites.md:1-24`,
  `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md:466-472`,
  `docs/analysis/sweep/VERIFY-W1-C-app-walkthrough.md:87`, `docs/analysis/program/SEQ-analysis.md:605-612`,
  `node_modules/playwright/types/test.d.ts:940-1043, 7256-7274`, `docs/process/development-discipline.md` (L14).
- **Global graphify graph** (`~/.graphify/global-graph.json`): queried, no relevant vocabulary found (§3.1)
  — logged as a miss per §10.11, not a source.
- [MDN — Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) — quoted directly, §3.2.
- [Chromium blink-dev — "Intent to Implement and Ship: Treat `http://localhost` as a secure context"](https://groups.google.com/a/chromium.org/g/blink-dev/c/RC9dSw-O3fE/m/E3_0XaT0BAAJ) — §3.3.
- [Chrome Platform Status — feature 6269417340010496](https://chromestatus.com/feature/6269417340010496) — listed, page did not render fetchable text content; not directly quoted.
- Playwright installed package types, `webServer` array support and `ignoreHTTPSErrors` — `node_modules/playwright/types/test.d.ts`, §4.
- [Dean Hume — Testing Service Workers locally with self signed certificates](https://deanhume.com/testing-service-workers-locally-with-self-signed-certificates/) — §4.
- [mswjs.io — Using local HTTPS](https://mswjs.io/docs/recipes/using-local-https) — counter-evidence, §4.
- [microsoft/playwright#33596 — "Self-signed cert fails in Firefox (and sometimes Chrome)"](https://github.com/microsoft/playwright/issues/33596) — open risk, §4.
- `chrome://flags/#allow-insecure-localhost` removal — search-engine-synthesized summary, not a single fetched primary source; treated as directional, not load-bearing for the recommendation.
