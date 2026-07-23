# PRE-3 · Worker test harness — design document

**Status:** DESIGN ONLY — options and a recommendation, not an implementation, not a plan. Per the gap-closing
program charter, PRE-3 "carries a genuine design decision the charter does not answer" and "gets a short
design pass first" before `writing-plans` runs
(`docs/superpowers/plans/2026-07-22-phase-minus-1-mechanical-prerequisites.md:13`). This document is that
pass. It ends with one decision for the owner (§7) — it does not make that decision.

**Why PRE-3 exists.** `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md:97` marks it a
**hard blocker**: *"Zero tests reference `worker/index.js`; six P0 items are ungateable."* `P0-worker`
(`charter:113`) is blocked on it explicitly. Under this project's DoD (`CLAUDE.md` §3, lines 2–4 and 12),
every one of those fixes needs a test that is **witnessed failing for the intended reason before the fix**,
and the full suite command must stay green. Today `npx playwright test` never loads `worker/index.js` — it
drives only the browser app — so nothing in the DoD gate can fire for a Worker change.

---

## 1. What P0-worker must be able to prove

Five concrete defects are named against `worker/index.js`, each already root-caused and line-cited in
`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` (§3.B.19–22, and its summary line at `:1371`) and
echoed in the charter's P0-worker row (`charter:113`). A harness that cannot exercise all five does not close
PRE-3.

| # | Defect | Citation | What a test must be able to do |
|---|---|---|---|
| D1 | **Fails open on a malformed KV record.** `raw` is truthy but not valid JSON → `catch { rec = { active: true }; }` (`worker/index.js:56`). `rec.active === false` (`:57`) is then false and `typeof rec.cap === 'number'` (`:58`) is false (`cap` is `undefined`), so the cap check never fires — unmetered, permanent, self-never-healing access. | gaps doc §3.B.20 | Inject a **non-JSON string** as the KV value for a code, POST as that code, assert the request is **not** granted (fails closed) instead of proceeding past the cap check. |
| D2 | **Token cap is bypassed by `streamGenerateContent`.** The router regex admits it (`worker/index.js:43`), but the metering block (`:77-87`) does `JSON.parse(text)` on what is, for a stream, an SSE/array body — parse fails or `usageMetadata` is `undefined`, `used` stays `0`, nothing is ever written. | gaps doc §3.B.19 | POST to the `:streamGenerateContent` path with a capped code and a streamed/non-JSON-object response body; assert either the route is rejected outright (once dropped per the charter) or that usage is still correctly metered. |
| D3 | **Metering is a read-modify-write race, not atomic.** Read at `:53`, a multi-second upstream round-trip at `:66`, write at `:84`. Two concurrent requests both read the same `rec.used`; the later write wins and the earlier increment is lost — this is a **check-then-act race across an async gap in the Worker's own code**, reproducible under ordinary concurrency and independent of KV's separately-noted eventual consistency (`worker/index.js:76`'s own comment). | gaps doc §3.B.21 | Fire **N concurrent requests** for the same code against a mocked/delayed upstream and assert the final `used` reflects all N increments, not `~used/N` of them. |
| D4 | **`Access-Control-Allow-Origin: '*'`.** `worker/index.js:21`. A leaked or shared access code works from any origin — "one paid code serves fifty people, no bug required" (gaps doc line 723). | gaps doc line 723 | Send an `OPTIONS`/actual request with an arbitrary `Origin` header and assert the response's `Access-Control-Allow-Origin` is the app's origin, not `*`, once tightened. |
| D5 | **No per-code rate limit.** Not a bug in existing code — a control that does not exist yet (charter:113: *"per-code rate limit"*). | charter:113 | Fire a burst of requests for one code within a short window and assert throttling (a new response shape, e.g. 429) once added. |

A sixth, related-but-not-yet-named-in-the-charter-row defect is also root-caused at the same file and worth
the harness supporting even if P0-worker's scope stays at five: **no timeout on the upstream Gemini
`fetch`** (`worker/index.js:66-70` — no `signal`/`AbortController`; gaps doc §3.B.22). Whichever count the
task brief's "six" refers to, the harness design below covers all of D1–D5 plus this one, since none of them
need a fundamentally different testing mechanism.

**A cross-cutting requirement all five/six share:** the handler must be invoked with a **mock or local KV**
whose `.get()` can be made to return an arbitrary raw string (including malformed JSON), and the Worker's
outbound `fetch()` to `GEMINI_BASE` (`worker/index.js:18,66`) must be interceptable so tests never spend the
real Gemini key or depend on network reachability.

---

## 2. What's already true about this repo's toolchain (verified, not assumed)

- **Root devDependencies: exactly one** — `@playwright/test": "^1.61.1"` (`package.json:17`). No other test
  runner exists at the repo root. `package.json:10`'s `test` script is `playwright test`.
- **`worker/package.json:12-14`** declares exactly one devDependency: `"wrangler": ">=3.90.0"`. Installed
  version is `4.111.0` (`worker/package-lock.json:1470-1471`).
- **`workerd` — the real production Workers runtime — is already downloaded**, transitively, as wrangler's
  own dependency: `worker/package-lock.json:1448-1467` pins `workerd@1.20260710.1` with platform binaries
  for macOS, Linux **and Windows** (`@cloudflare/workerd-windows-64`, line 1466) plus Linux x64/arm64 for
  CI. Confirmed present on disk at `worker/node_modules/workerd/bin/workerd` (this machine, Windows).
- **`miniflare` is also already downloaded**, transitively (wrangler's local-dev layer):
  `worker/package-lock.json:1314-1334`, version `4.20260710.0`, hoisted to a top-level
  `node_modules/miniflare` — resolvable by a plain `import 'miniflare'` from a script under `worker/`
  **today**, with zero new download, though it is not currently a *declared* direct dependency.
- **`@cloudflare/vitest-pool-workers` is NOT installed** anywhere in the lockfile (`grep` for
  `vitest-pool-workers` and `"vitest"` against `worker/package-lock.json` returns nothing). Adopting it
  means two genuinely new devDependencies: `vitest` and `@cloudflare/vitest-pool-workers`.
- **`worker/wrangler.toml:9-11`**: one KV binding (`CODES`), a real `id`, and `preview_id` **commented
  out**. `compatibility_date = "2024-11-01"` (`wrangler.toml:3`).
- **A Node version mismatch exists between this machine and CI, material to every wrangler/miniflare-based
  option.** `wrangler@4.111.0` and `miniflare@4.20260710.0` both directly declare
  `"engines": {"node": ">=22.0.0"}` in the lockfile — `worker/package-lock.json:1490-1491` for wrangler's own
  entry, `:1331-1333` for miniflare's. This machine runs Node **v24.18.0** (verified: `node -v`), comfortably
  above that floor. **`.github/workflows/test.yml:18` pins CI to `node-version: 20`** — below the floor.
  Any option that shells out to `wrangler` or `miniflare` in CI needs that bumped (at minimum a second
  `setup-node` step scoped to a worker-test job), or CI will attempt to run binaries built against
  assumptions Node 20 doesn't meet. `workerd` itself only requires `>=16` (`package-lock.json:1459`), so this
  ceiling comes from the JS tooling around it, not the runtime binary.
- **The Worker's `env` shape is trivial to fake.** `env.GEMINI_KEY` is a plain string secret;
  `env.CODES` is used only via `.get(key)` (`:53`) and `.put(key, value)` (`:84`) — the full surface a stub
  needs to implement is two methods.
- **`worker/index.js` is written as a plain ES module** (`export default { async fetch(request, env) {…} }`,
  `:31`). `worker/package.json` does **not** declare `"type": "module"`, so a bare Node `import` of the file
  from a `.js` test under `worker/` would be parsed as CommonJS and fail on `export default`. This is a
  one-line fix (`"type": "module"` in `worker/package.json`, or a `.mjs` test extension) — not a new
  dependency, but a real prerequisite for the unit-test option (§3.4).

---

## 3. Research: the options, verified against sources

**Method note (per CLAUDE.md §10.11).** The graphify **global** graph
(`~/.graphify/global-graph.json`, corpora `vendor-docs` + `methodology`) was queried first, per instruction,
before any web search. `graphify query "workerd"` and `graphify query "miniflare"` both returned **"No
matching nodes found"**; `graphify god-nodes --top 30` confirms the corpus's actual content is
`playwright-docs`, `vitest-docs` (generic Vitest config surface, not the Workers pool), `superpowers-docs`,
`bmad-docs`, `serena-docs` — no Cloudflare Workers/wrangler/miniflare documentation exists in the global
graph today. Per the rule ("if no vocabulary token matches, say so and stop; never invent tokens to force a
hit"), this is stated rather than forced, and research fell back to the web — official
`developers.cloudflare.com` and `blog.cloudflare.com` pages, cited per claim below. **This gap is a candidate
for the §10.11 feedback loop** (fetch → graph → `graphify global add … --as cloudflare-workers-docs`) but
that population step is outside this document's scope (a design pass, not a toolchain change) and is not
done here — flagged for whoever executes PRE-3.

### 3.1 `@cloudflare/vitest-pool-workers` — runs tests *inside* the real `workerd` process

**What it is.** Cloudflare's official Vitest integration. Per Cloudflare's own announcement,
tests execute "directly in our runtime, workerd" — not a Node reimplementation.
[Improved Cloudflare Workers testing via Vitest and workerd](https://blog.cloudflare.com/workers-vitest-integration/)
states the three-layer architecture explicitly: **workerd** (the actual production runtime) ← **Miniflare
v3** (spawns and manages the workerd process) ← **`@cloudflare/vitest-pool-workers`** (the Vitest pool that
routes each test file into that workerd process over an RPC channel). The same post explains *why*: Miniflare
v2/Jest-based testing "reimplemented Workers Runtime APIs in a Node.js environment," which could not
guarantee production-identical behaviour — the whole point of this package is to close that gap.

**Install.** `npm i -D vitest@^4.1.0 @cloudflare/vitest-pool-workers`
([Write your first test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)).
Two genuinely new devDependencies (three including `vitest`'s own subdependency tree) on top of this
project's one.

**KV binding + malformed-value injection.** Config in `vitest.config.ts` via the pool's plugin, pointing at
`wrangler.toml` for bindings; a test imports `env` from the special module `"cloudflare:workers"` and can
call `env.CODES.put("corrupt", "not-valid-json{]")` directly, then drive the Worker's exported `fetch`
handler via `exports.default.fetch(...)` (also from `"cloudflare:workers"`) — this is exactly D1's shape
(source:
[Write your first test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/),
[test-apis](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/)).

**Outbound-fetch mocking (needed so tests never spend the real Gemini key).** The pool ships a `fetchMock`
from `"cloudflare:test"` — an embedded `undici.MockAgent`, documented to intercept the Worker's own global
`fetch()` and (with `fetchMock.disableNetConnect()`) throw on any request that isn't explicitly mocked. This
directly covers D2/D3's need to control the upstream response and its timing (source: search result
digest of `cloudflare/workers-sdk` `fetch-mock.ts` and the "request-mocking" recipe under
`fixtures/vitest-pool-workers-examples/` in the same repo, both cited via
[the Vitest recipes index](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/)).

**Concurrency for D3.** Vitest tests run as ordinary async JS; firing N `Promise.all([...])` calls into the
mocked-fetch-delayed handler reproduces the check-then-act race directly — no special primitive needed.

**Requirements.** `compatibility_date` must be `2022-10-31` or later — `wrangler.toml:3`'s `2024-11-01`
already satisfies this. No `preview_id` requirement is documented for this path (it drives its own isolated
KV simulation via the `miniflare` config key, independent of `wrangler.toml`'s KV `id`/`preview_id`). No
network access or real `GEMINI_KEY` needed — `fetchMock` replaces the network call entirely.

**Toolchain/CI cost.** Two new devDependencies in `worker/package.json`. `workerd`'s binary is already
resolved in the lockfile (§2), so no new *binary* download, but `vitest` and `@cloudflare/vitest-pool-workers`
themselves are new. CI needs a Node bump for the `worker/` job specifically (§2's Node ≥22 finding) and a
**second job** in `.github/workflows/test.yml` (separate `npm ci`/`npm test` scoped to `worker/`, since the
root Playwright job's `npm ci` installs only root `package.json`'s tree). Does not touch or slow the existing
`npx playwright test` command or its DoD-12 gate.

### 3.2 Miniflare, used directly (standalone API) — simulates the Workers runtime, does not run `workerd` itself as the request handler

**What it is.** Per Cloudflare's own Miniflare docs, Miniflare "runs your code in a sandbox implementing
Workers' runtime APIs" and the docs explicitly steer most users elsewhere: "most users should use Wrangler to
build, run & deploy their Workers locally" rather than the Miniflare API directly
([Miniflare overview](https://developers.cloudflare.com/workers/testing/miniflare/)). **Correction to a
common misconception, stated precisely per the vitest-pool-workers blog post (§3.1):** *Miniflare v3* itself
is architected as a thin manager that **spawns and drives a real `workerd` process** — so "Miniflare"
in its current major version is not a from-scratch API reimplementation the way Miniflare v2 was; it is the
same `workerd` binary as options 1 and 3, just invoked through a different, unofficial-for-this-purpose API
surface with no first-party Vitest/Playwright glue.

**Usage shape.** Instantiate `new Miniflare({...})` programmatically, `dispatchFetch()` to send a request
into the Worker, `getBindings()` to reach into KV directly for setup/assertions. This is a hand-rolled
driver — you write your own thin runner (plain Node script, or wrapped in whatever assertion library you
choose) that starts a `Miniflare` instance, seeds `CODES` with a malformed value via the bindings API, calls
`dispatchFetch`, and asserts on the `Response`. Malformed-KV injection and outbound-fetch control are
possible (Miniflare supports an `outboundService`/fetch-mock hook conceptually, per the same underlying
`workerd`+undici stack as §3.1), but there is **no first-party recipe** the way `@cloudflare/vitest-pool-workers`
ships one — you would be assembling the equivalent of that package's plumbing by hand.

**Toolchain/CI cost.** `miniflare` is already resolved in the lockfile (§2) — adding it as a **declared**
direct devDependency of `worker/package.json` costs one line and zero new downloads (best case among the
options that touch the real runtime). But you still need *some* assertion/runner layer (plain `node:assert`
+ `node --test`, or reuse `@playwright/test` as a pure-Node runner — see §3.4's runner discussion), so the
"one new package" framing understates the actual authored surface: this option is the most build-it-yourself
of the four, trading a documented package for hand-written harness code.

### 3.3 `wrangler dev` + HTTP requests against a locally-served Worker — also the real `workerd`, driven externally

**What it is.** `wrangler dev` (no `--remote` flag; this is the Wrangler v3+ default) "runs the local
`workerd` runtime" locally
(source: Cloudflare's Wrangler commands documentation, `developers.cloudflare.com/workers/wrangler/commands/`
— the general dev-command description; the `--remote` distinction is explicit: only `--remote` connects to
live Cloudflare resources, and `preview_id` on a KV binding is **"required when using `wrangler dev --remote`
… If developing locally, this is an optional field"** — and when absent, **"wrangler dev will use `id`"**,
i.e. it falls back to referencing the *production* namespace's ID but still writes to a **local**, disk-
persisted simulation of that namespace, not the real remote data
(source: [Wrangler configuration — kv_namespaces](https://developers.cloudflare.com/workers/wrangler/configuration/)).
This directly answers the brief's question: **the commented-out `preview_id` in `wrangler.toml:11` does not
block this option** — plain `wrangler dev` works without it.

**Testing shape.** Start `wrangler dev` (or `npx wrangler dev --port <N>`) as a child process (the same
pattern this repo already uses for `serve.js` in `playwright.config.ts`'s `webServer`), then drive it with
plain `fetch()`/`node:http` requests from a test script — or from **Playwright itself**, using
`request.post()`/`request.get()` (Playwright's built-in APIRequestContext, already bundled inside
`@playwright/test`, zero new dependency for the HTTP-client half).

**Malformed-KV injection.** No `env` import available (that only exists inside the pool-workers
`cloudflare:workers`/`cloudflare:test` special modules, §3.1) — injection has to go through `wrangler kv key
put --binding CODES ... --local` (the local-mode KV CLI, writing to wrangler's on-disk local persistence),
run as a setup step before the HTTP request. This works, but is slower per-test (a CLI subprocess round-trip)
and clumsier to reset between tests (you're managing a local KV directory's lifecycle by hand, not an
in-process reset).

**Outbound-fetch control — the real weak point of this option.** There is no documented interception layer
for the Worker's outbound call to `GEMINI_BASE` (`worker/index.js:18,66`) when driving `wrangler dev`
externally — the process is a separate OS process from the test driver, so no `fetchMock`-style monkeypatch
reaches inside it. Testing D2/D3 fully (proving the metering fix survives a slow/streamed upstream) would
require either (a) actually letting the request reach `https://generativelanguage.googleapis.com` with a
throwaway/fake key and accepting whatever real error Google returns (network-dependent, and burns a real
outbound call per test run), or (b) editing the Worker to read the upstream base URL from an environment
var/binding so tests can point it at a local mock HTTP server — a small **production-code** change purely to
make this option testable, which is itself a design decision worth flagging if chosen.

**Toolchain/CI cost.** Zero new devDependencies — `wrangler` is already the sole one. The HTTP-driving side
can reuse `@playwright/test`'s request context, so no new package there either. Still needs the Node ≥22 CI
bump (§2) and a scoped second job/step, since it shells out to `wrangler`.

### 3.4 Unit-test the handler directly, with a hand-rolled mock `env` — no Workers runtime at all

**What it is.** `worker/index.js` exports a plain object with an `async fetch(request, env)` method
(`:31`). Nothing about it is Workers-specific syntax — it is ordinary JS using the standard `fetch`/`Request`/
`Response`/`URL` globals, all of which exist natively in Node ≥18 (this machine: v24.18.0; CI: already
node-version 20, which is sufficient — **no CI Node bump needed for this option**, unlike §3.1/§3.3). A test
can `import worker from '../worker/index.js'` and call `worker.fetch(new Request(url, opts), mockEnv)`
directly, where `mockEnv = { GEMINI_KEY: 'test', CODES: { get: async (k) => store[k], put: async (k, v) => {
store[k] = v; } } }` — a two-method stub, matching exactly the two calls the code makes (`:53`, `:84`).

**Malformed-KV injection.** Trivial and fully in-process: `store['code:bad'] = 'not-json{]'` before the call.
No CLI, no subprocess, no serialization boundary.

**Outbound-fetch control.** Also trivial and fully in-process: `globalThis.fetch` can be swapped for a mock
function for the duration of a test (restored after), including one that delays its resolution to reproduce
D3's race window deterministically. This is the cleanest of the four options for D2/D3/D5, precisely because
nothing crosses a process boundary.

**Concurrency for D3.** Same as §3.1 — `Promise.all` against the mocked, delayed `fetch`.

**The real cost, stated plainly: this tests a copy of the logic, not the deployed artifact.** `worker/index.js`
runs in production inside `workerd`, which implements the Workers runtime's edges (its own `Request`/
`Response` object identity and quirks, KV's actual binding semantics, CPU/subrequest limits, the
`ExecutionContext` argument the handler doesn't currently use). A bug that lives specifically at one of those
edges — not in this file's own logic — would pass a Node-side unit test and still exist in production. For
the five/six defects in §1, all of which are pure application logic (JSON parsing, arithmetic, a regex, a
response header, timing of two async operations), this gap is unlikely to hide anything — but it is a real,
stated limitation, not a hypothetical one.

**Prerequisite fix, not a new dependency.** As noted in §2, `worker/package.json` needs `"type": "module"`
added (or the test file needs a `.mjs`/build-step workaround) for a bare `import` of `worker/index.js` to
parse under Node's module resolution. This is a one-line, zero-download change — but it is a change to
`worker/package.json`, worth naming rather than silently doing.

**Which runner.** Two sub-options, both zero-new-dependency:
- **Reuse `@playwright/test`** as a pure-Node test runner (no `page`/browser fixture used) — the test file
  lives wherever `playwright.config.ts`'s `testDir`/a new `projects[]` entry points, and gets swept into the
  existing `npx playwright test` command and DoD-12 gate automatically, no second CI job, no second command.
  Trade-off: mixing a zero-browser, zero-webServer test project into a config currently built around one
  browser project with a shared `webServer` block is itself a small config change, and the worker tests would
  count against the tuned `workers: 6` concurrency ceiling (`playwright.config.ts:21`, measured against
  browser-test load, not Node-only load — re-measurement may not even be needed given how light these tests
  are, but that is a claim to verify, not assume, when this is built).
- **Node's built-in `node:test`** (`node --test worker/test/*.test.js`) — zero dependency, but a genuinely
  separate command, meaning DoD-12's `npx playwright test` would no longer be the single full-suite gate
  unless CI/the discipline is updated to run both commands and both are required for "full suite green."

---

## 4. Comparison

| | **1. `@cloudflare/vitest-pool-workers`** | **2. Miniflare (standalone API)** | **3. `wrangler dev` + HTTP** | **4. Unit-test with mock `env`** |
|---|---|---|---|---|
| Runs real `workerd`? | **Yes** — tests execute inside the workerd process | Yes (Miniflare v3 spawns real workerd) — but via an unofficial-for-this-purpose API | **Yes** — same workerd, driven externally | **No** — Node executing the same source file |
| Inject malformed KV value | Yes, in-process (`env.CODES.put` via `cloudflare:workers`) | Yes, via Miniflare's bindings API | Yes, via `wrangler kv key put --local` CLI (subprocess, slower) | Yes, in-process (mock store) — simplest |
| Mock outbound Gemini `fetch` | Yes — first-party `fetchMock` (undici `MockAgent`) | Possible, unofficial/hand-rolled | **No documented path** — real network or a production-code change to make the base URL configurable | Yes — trivial, in-process |
| Needs `preview_id` | No | No | No (falls back to `id`, stays local) | N/A |
| Needs network / real key | No | No | Yes, for anything past the auth gate (§3.3) unless code changes | No |
| New devDependencies | **2** (`vitest`, `@cloudflare/vitest-pool-workers`) — `workerd` binary itself already resolved | **0–1** (`miniflare` undeclared→declared; assertion layer still needed) | **0** | **0** (reuse `@playwright/test`, or `node:test`) |
| CI Node floor | ≥22 (bump needed; test.yml pins 20) | ≥22 (same) | ≥22 (same) | **None — current Node 20 is fine** |
| Fits `npx playwright test` / one command | No — separate Vitest command, separate CI job | No — hand-rolled runner, separate command | No — separate command (though could be one more Playwright `request.post` spec if wired that way) | **Yes, if run as a Playwright project**; no, if `node:test` |
| Authoring effort | Low — documented, first-party recipes for every need in §1 | **High** — no first-party recipe for this use case; you build the harness | Medium — CLI-driven setup, no fetch mock, possibly needs a production code change | Low — plain JS, no new API surface to learn |
| Tests the deployed artifact exactly | Yes | Yes | Yes | **No — tests a copy of the logic** |

---

## 5. Cross-cutting findings worth carrying into whichever option is chosen

- **D3 (the metering race) is not literally about KV's eventual consistency** — it is a check-then-act race
  in the Worker's own code across the multi-second upstream call (`worker/index.js:53` read → `:66` await →
  `:84` write). All four options can reproduce it with ordinary concurrent requests against a
  slowed/mocked upstream; none need to simulate KV's actual cross-region propagation delay. This lowers the
  bar for every option, not just the "real runtime" ones.
- **The CI Node-version ceiling (§2) is the single most concrete, previously-unstated cost** of options 1–3.
  It's a real blocker, not a hypothetical one: `wrangler`/`miniflare` in the current lockfile both declare
  `engines.node >=22.0.0`, and `.github/workflows/test.yml:18` currently pins Node 20 for the (only) job.
- **Whichever option is chosen, it needs its own CI wiring** distinct from the existing Playwright job unless
  Option 4 is run as a Playwright project — even then, a `worker/` `npm ci` step (or reusing the root
  install if the runner lives at the repo root) has to happen before the tests can import anything.
- **This document does not verify** whether `@cloudflare/vitest-pool-workers`'s `wrangler.configPath` accepts
  a `.toml` file directly (the one official example fetched used `.jsonc`); Wrangler itself supports both
  formats project-wide, so this is very likely fine, but it is inferred, not confirmed against a `.toml`
  specific example, and should be checked at implementation time.

---

## 6. Sources

- `worker/index.js` (all line citations above), `worker/wrangler.toml`, `worker/package.json`,
  `worker/package-lock.json`, `worker/README.md`, `scripts/central-code.mjs` — read in full for this
  document.
- `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` (lines 34–113).
- `docs/superpowers/plans/2026-07-22-phase-minus-1-mechanical-prerequisites.md` (lines 9–13).
- `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` (§3.B.19–22, line 723, line 1371).
- `.github/workflows/test.yml`, `playwright.config.ts`, root `package.json`.
- graphify global graph — `graphify god-nodes --graph ~/.graphify/global-graph.json --top 30`,
  `graphify query "workerd"`, `graphify query "miniflare"` (both zero matches; run 2026-07-22/23).
- [Improved Cloudflare Workers testing via Vitest and workerd](https://blog.cloudflare.com/workers-vitest-integration/) — Cloudflare Blog.
- [Write your first test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/) — Cloudflare Workers docs.
- [Vitest integration — test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/) — Cloudflare Workers docs.
- [Vitest integration — recipes](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/) — Cloudflare Workers docs (outbound-request-mocking recipe).
- [Miniflare overview](https://developers.cloudflare.com/workers/testing/miniflare/) — Cloudflare Workers docs.
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) — Cloudflare Workers docs.
- [Wrangler configuration — `kv_namespaces`/`preview_id`](https://developers.cloudflare.com/workers/wrangler/configuration/) — Cloudflare Workers docs.
- `node -v` on this machine (v24.18.0), read directly rather than assumed.

---

## 7. The decision for the owner

Three real shapes, not two — the middle ground (Option 3) turned out weaker than expected once the
outbound-fetch-mocking gap surfaced, so it's included for completeness but not as a leading contender.

**Option A — Adopt `@cloudflare/vitest-pool-workers` as a second test runner.**
*Buys:* tests run inside the actual `workerd` process — the closest a test gets to "this is what runs in
production" — with a documented, first-party way to seed malformed KV records (D1) and mock the outbound
Gemini call (D2/D3/D5), so all five/six defects are testable with no production-code changes made solely for
testability.
*Costs:* two new devDependencies (`vitest`, `@cloudflare/vitest-pool-workers`); a second CI job; CI's Node
floor must rise to ≥22 for that job; a second local test command (`npx vitest` alongside `npx playwright
test`) that the DoD's "full suite green" (line 12) would need to name explicitly as also-required, since it
currently reads as one command.

**Option B — Unit-test the handler with a hand-rolled mock `env` (Option 4 above), run as a Playwright project.**
*Buys:* zero new dependencies (reuses the repo's one existing devDependency); no CI Node bump; the tests are
literally swept into the existing `npx playwright test` command, so DoD-12 stays exactly as currently
written; fastest and simplest to author for these five/six specific defects, all of which are pure
application logic in this one file.
*Costs:* does **not** exercise the real `workerd` runtime — it tests a copy of the same source running under
Node, so any bug specific to how `workerd` implements `Request`/`Response`/KV bindings (as opposed to a bug
in this file's own logic) would not be caught; requires adding `"type": "module"` to `worker/package.json`
(a real but small change to name, not silently make); requires deciding whether these tests live as a new
`projects[]` entry in the existing `playwright.config.ts` (shares one config, no webServer needed for them)
or a wholly separate config invoked by the same `npx playwright test` command via `--project`.

**Option C — `wrangler dev` + HTTP requests (Option 3 above), for completeness.**
*Buys:* real `workerd`, zero new devDependencies, no `preview_id` needed.
*Costs:* no documented way to mock the outbound Gemini call, so fully testing D2/D3/D5 either burns a real
network call per run or requires a small **production-code change** (making `GEMINI_BASE` overridable) made
solely so tests can intercept it — the one option here that would touch shipped code to become testable; KV
seeding goes through a slower CLI round-trip instead of an in-process call; still needs the CI Node ≥22 bump;
still a second command/job. Not recommended as a starting point unless Options A/B are both rejected for a
reason this document doesn't anticipate.

**Recommendation: Option A** for exactly the defects PRE-3 exists to unblock. All five/six D1–D5(+timeout)
issues are about how the Worker behaves in the runtime it actually runs in — a fail-open branch, a routing
regex, a race across an async boundary, a response header, a missing control. Testing a copy of the logic
(Option B) would very likely also catch every one of them, and at a fraction of the toolchain cost — which is
why this is a real decision and not a foregone one. The owner should weigh: **is "runs in the real
`workerd`" worth two new devDependencies, a second CI job, a CI Node-version bump, and a second required test
command for a five/six-defect surface that is otherwise pure logic** — or does Option B's zero-cost,
same-command fit better with this project's stated preference for keeping the toolchain at one devDependency
and one full-suite command as the DoD's single gate. This document does not choose between them.
