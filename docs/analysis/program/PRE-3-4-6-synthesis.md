# PRE-3 / PRE-4 / PRE-6 — synthesis and decision brief

**Purpose.** These three prerequisites were designed independently. This document (a) independently
re-verifies each design's load-bearing claim against the code rather than trusting the doc's word, (b)
surfaces the interactions the three docs could not see from inside their own scope, and (c) gives the
owner one decision per prerequisite, each answerable in a sentence.

**Constraint under which this was written.** A worker-ceiling measurement (Task 6) may have been running
`npx playwright test` on this machine at the time of writing. No server was started, `npx playwright test`
was not run, and no `serve.js`/wrangler process was launched for this document — everything below is Read
+ Grep + `git`/`node -e` static inspection.

---

## 1. Verification verdicts

### PRE-6 — CONFIRMED (the pivotal claim, and it holds)

- **The gate.** Read `app.js:9544-9564` directly. Line 9546 is exactly
  `if('serviceWorker' in navigator && location.protocol==='https:'){` — matches the doc's quote verbatim,
  including the surrounding comment ("https only — the http test server skips it") and every line of the
  `register()`/`updatefound`/`_swPoke` block downstream. Nothing about the quote is paraphrased or trimmed
  in a way that changes its meaning.
- **The prior measurement PRE-6 cites.** `docs/analysis/sweep/VERIFY-W1-C-app-walkthrough.md:87`, finding
  **D24**, verdict **CONFIRMED** in that document's own table:
  > `app.js:9546` `if('serviceWorker' in navigator && location.protocol==='https:')`. On
  > `http://localhost:8211` I measured `isSecureContext: **true**`, `protocol: "http:"`,
  > `getRegistrations() → 0`.
  This is a real, prior, live measurement in this repo — not something PRE-6 invented or inferred. It
  proves `isSecureContext` is `true` on `http://localhost` in this project's own test environment, and that
  the gate is strictly narrower than that.
- **What it does *not* prove, and PRE-6 says so itself (§7.1):** that `register('sw.js')` actually succeeds
  once the gate is removed — D24 only measured `isSecureContext`, not a live registration, because the gate
  blocked the call. PRE-6 flags this as the literal first implementation step (a throwaway registration
  spike) before the one-line fix is treated as certain to work. This is an honest, stated gap, not a hole
  the verification found on its own.
- **Verdict: the doc's central claim — "http://localhost is already a secure context, so this is a one-line
  `isSecureContext` change, not an HTTPS server build" — is CONFIRMED against the code and against a real
  prior in-repo measurement.**

### PRE-4 — CONFIRMED

- **The stub.** `tests/ai-trust.spec.ts:15` (inside `bootAI`):
  `window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body}); return { ok:true, status:200,
  json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]}) }; }` — every test that calls
  `bootAI` gets this stub installed before any AI call. Read `:225` (`bootManaged`) — the identical pattern,
  a second stub for the managed-mode boot path. Read `:166` —
  `expect(await page.evaluate(`window.__cap.length`)).toBe(0);   // the AI was never called` — this is a
  real assertion in the file, correctly scoped to the refusal-classifier test (which is designed to
  short-circuit before any transport call), but it demonstrates the stub/capture mechanism precisely as
  cited. No path in this file reaches `fetch()` or the real Gemini endpoint.
- **`GEM_MODEL`.** `app.js:4206`: `const GEM_MODEL='gemini-2.5-flash';` — exact match.
- **The second literal.** `app.js:5030`, inside `gemSpeak`: `gemFetch('gemini-2.5-flash-preview-tts', ...)`
  — exact match, confirming a model-swap that only edits `GEM_MODEL` would silently miss the TTS path.
- **Verdict: CONFIRMED on all three sub-claims.**

### PRE-3 — CONFIRMED

- **`workerd`/`miniflare` already on disk.** `worker/node_modules/workerd/bin/workerd` exists (directory
  listing confirmed). `worker/node_modules/miniflare` exists with `package.json`, `bootstrap.js`, `dist/` —
  a real, resolved package, not just a lockfile entry. Both are transitive dependencies of `wrangler`
  today; adopting either the vitest-pool-workers option or the standalone-Miniflare option would not
  trigger a new *binary* download, exactly as the doc claims.
- **The Node-version conflict.** Queried `worker/package-lock.json` directly (not grepped/assumed):
  `node_modules/wrangler` → `"engines":{"node":">=22.0.0"}`, version `4.111.0`;
  `node_modules/miniflare` → `"engines":{"node":">=22.0.0"}`, version `4.20260710.0`. `.github/workflows/
  test.yml:18` pins `node-version: 20` for the (only) job in the (only) workflow file. This is a real,
  live conflict for any PRE-3 option that shells out to `wrangler`/`miniflare` in CI (Options A and C in
  PRE-3's own lettering), confirmed independently of the doc's own citation.
- **Also confirmed in passing:** root `package.json` has exactly one devDependency
  (`@playwright/test": "^1.61.1"`); `worker/package.json` has exactly one devDependency
  (`"wrangler": ">=3.90.0"`) — both toolchain-minimality claims PRE-3 leans on are accurate.
- **Verdict: CONFIRMED on both sub-claims.**

**Summary: all three documents' load-bearing claims are CONFIRMED. Nothing here overturns a
recommendation; the synthesis below is about interactions between the three, not about correcting any of
them.**

---

## 2. The three decisions — one per prerequisite

### Decision 1 — PRE-3: how should `worker/index.js` get test coverage?

**One-sentence question:** *Do we want Worker tests to run inside the real `workerd` runtime (two new
devDependencies, a second CI job, CI's Node floor raised to ≥22), or as a same-process Node unit test
against a mocked `env` (zero new dependencies, no CI change, but it tests a copy of the logic rather than
the deployed artifact)?*

| Option | What it buys | Cost |
|---|---|---|
| **A — `@cloudflare/vitest-pool-workers`** *(PRE-3's own recommendation)* | Tests execute inside the actual `workerd` process; first-party KV-injection and outbound-fetch-mock recipes cover all 5–6 named defects (D1–D5+timeout) with no production-code change needed for testability. | 2 new devDependencies (`vitest`, `@cloudflare/vitest-pool-workers`); a second CI job; CI Node floor → ≥22 for that job; a second required local/CI test command, meaning DoD line 12 ("`npx playwright test` — plain, nothing else") has to be read as "and also `npx vitest`" going forward. |
| **B — Unit-test the handler with a hand-rolled mock `env`, run as a Playwright project** | Zero new dependencies; no CI Node bump; folds directly into the existing `npx playwright test` command, so DoD line 12 stays exactly as written today; cheapest and fastest to author for these five/six defects, which are all pure application logic (JSON parsing, a regex, response headers, timing of two async ops). | Does not exercise the real `workerd` runtime — a bug specific to how `workerd` implements `Request`/`Response`/KV bindings (as opposed to a bug in this file's own logic) would not be caught. Needs `"type":"module"` added to `worker/package.json` for a bare `import` to parse. |
| **C — `wrangler dev` + HTTP requests** | Real `workerd`, zero new devDependencies. | No documented way to mock the outbound Gemini call — fully testing the metering-race/token-cap defects (D2/D3/D5) means either burning a real network call per run or making `GEMINI_BASE` overridable, a small production-code change made solely for testability. Still needs the Node ≥22 bump. Weakest of the three; PRE-3 itself does not lead with it. |

**Recommendation carried forward from PRE-3: Option A**, with the explicit tradeoff PRE-3 itself names —
Option B would very likely catch every one of the five/six named defects too (they are pure logic, not
runtime edge cases), at zero toolchain cost. This is a real decision, not a foregone one: the owner is
being asked whether "runs in the real `workerd`" is worth two new devDependencies, a second CI job, a CI
Node bump, and a second mandatory test command, for a defect surface PRE-3's own analysis calls "otherwise
pure logic."

**Verification verdict on this doc's load-bearing claim: CONFIRMED** (§1 above).

---

### Decision 2 — PRE-4: how does the eval harness run and get paid for, before the 2026-10-16 shutdown?

**One-sentence question:** *Approve a new, dedicated `GEMINI_EVAL_KEY` GitHub Actions secret (paid tier,
separate from the Worker's production `GEMINI_KEY`) and a `workflow_dispatch`-only (never push/PR) eval
job, at an estimated $2.50/run and ≈$15–20 total through the migration?*

| Option | What it buys | Cost |
|---|---|---|
| **Run in ordinary CI on every push** | Simplicity — one workflow, no new trigger type. | **Rejected by the charter itself** (§6): a live, cost-bearing, nondeterministic call on every contributor's unrelated commit, blockable by Gemini's own availability. Not a real option. |
| **Local-only `npm run eval`, no CI job** | Fastest to build; a fallback if a CI runner's IP gets rate-limited. | The baseline capture — the one artifact that becomes permanently unrepeatable after 2026-10-16 — lives only on one person's machine, unrepeatable and unreviewable. |
| **`workflow_dispatch` + `npm run eval`** *(PRE-4's own recommendation)* | One implementation, two triggers (local + manual CI); reproducible by anyone with the secret; results captured centrally and committed (`docs/analysis/program/eval/baseline-gemini-2.5-flash-<date>.json/.md`); matches the existing repo pattern of a secret-gated key for exactly this kind of infra (`worker/README.md:33`). | One new secret to provision; one new manual-trigger CI job; a real, small, recurring spend (≈$2.50/run, ≈$15–20 total including margin for re-runs). |

**Recommendation carried forward from PRE-4: `workflow_dispatch` + a new `GEMINI_EVAL_KEY` secret**, paid
tier (the free tier's rate limits are undocumented per PRE-4's own source, `W5-D-api-docs.md:194-201`, and
a reliability-gated suite shouldn't depend on an undocumented quota).

**This is the one time-critical decision of the three** — see §3 below. `gemini-2.5-flash` shuts down
2026-10-16; PRE-4 recommends the baseline captured before 2026-09-01. Every week this decision is
undecided is a week off a fixed, non-negotiable, external deadline that does not move for any other
program priority.

**Verification verdict on this doc's load-bearing claim: CONFIRMED** (§1 above).

---

### Decision 3 — PRE-6: how does the Service Worker become testable?

**One-sentence question:** *Approve relaxing `app.js:9546`'s SW-registration gate from the literal string
check `location.protocol==='https:'` to a secure-context check (`self.isSecureContext`) — a one-line
production-code change to a security-adjacent gate — run through its own RED/GREEN cycle, starting with a
throwaway registration-probe spike to confirm `register()` actually succeeds on `http://localhost` before
the one-liner ships?*

| Option | What it buys | Cost |
|---|---|---|
| **A — Relax the gate to `isSecureContext`** *(PRE-6's own recommendation)* | SW becomes testable on the existing `http://localhost` suite immediately — no new server, no cert, no CI change; makes currently-dead code (`reg.update()` on launch/foreground, the update-toast flow, the v256 "reached the server but not the device" fix) live under the *entire* existing 420-test suite, not a segregated corner of it. | One line in `app.js`, run through its own DoD RED/GREEN cycle — **and see the flag below.** |
| **B — Second HTTPS `webServer` + self-signed/mkcert cert + a dedicated `testMatch`-scoped Playwright project** | Exercises the literal, unmodified shipped `location.protocol==='https:'` check — no `app.js` change at all. | New TLS wrapper/cert lifecycle to maintain; a documented, open, unresolved intermittent-failure report against current Chromium for the ignore-errors path (`microsoft/playwright#33596`); every suite run boots a second server even for tests that never touch the SW. |

**Recommendation carried forward from PRE-6: Option A**, with PRE-6's own §7.1 spike run and reported
first (a throwaway `page.evaluate`-driven registration probe against `http://localhost:8123`, bypassing
the gate manually, confirming `getRegistrations().length===1` and a `caches.keys()` entry appears) — this
is stated in PRE-6 itself as a real, unverified gap, not a formality.

**Verification verdict on this doc's load-bearing claim: CONFIRMED** (§1 above) — and this is the
recommendation that most needs the flag in §4 below spelled out to the owner explicitly, not folded
silently into "PRE-6 approved."

---

## 3. Cross-cutting issue A — one CI decision, hiding inside two docs

`.github/workflows/test.yml` today is **one job, one workflow file, Node 20, triggered on push+PR to
`main`.** Read independently, PRE-3 and PRE-4 each assume they are the only one adding to it:

- **PRE-3 (if Option A or C is chosen)** needs a **second job**, scoped to `worker/`, with its own
  `npm ci` and its own `setup-node` step pinned to **Node ≥22** (confirmed above — `wrangler`/`miniflare`
  both declare that floor in the lockfile; `workerd` itself only needs `>=16`, so the ceiling comes from
  the JS tooling, not the runtime binary). Triggered the same way as the existing job (push/PR), since
  these are ordinary deterministic tests with no live network call.
- **PRE-4** needs a **third job** (or a second workflow file), triggered *only* by `workflow_dispatch`,
  requiring a new secret (`GEMINI_EVAL_KEY`) and never running on push/PR.

**Neither document says the other exists.** They compose without conflicting — different trigger types
(push/PR vs. manual), different Node floors (PRE-3's worker job at ≥22, PRE-4's eval job unaffected since
it drives the app through Playwright/Chromium exactly like the main suite, no wrangler/miniflare
involved) — but the owner is currently being asked to approve **two separate CI-shape changes** as if they
were each the only one. Worth deciding once, together: does `test.yml` grow to three jobs (main suite,
worker unit/vitest, eval-on-demand), or does the worker test job and/or the eval job move to its own
workflow file? This is a five-minute decision if surfaced now; it is a much larger one if PRE-3 and PRE-4
are each executed by a different subagent weeks apart, each independently modifying `.github/workflows/`
and only discovering the other's change in a merge conflict.

**One thing that does *not* collide:** PRE-6, if Option A is approved, adds **no CI job at all** — the new
SW specs are ordinary Playwright tests that fold into the existing single job, at the existing Node 20,
with no new secret, server, or trigger. PRE-6 is CI-neutral; the CI decision above is a PRE-3/PRE-4-only
question.

---

## 4. Cross-cutting issue B — PRE-6 is the only one of the three that touches `app.js`, and that is a
Waiver-Gate-shaped fact regardless of how safe the change is argued to be

`CLAUDE.md` §4 states: *"A plan may never waive, defer, or reinterpret a requirement from an approved
spec... any such change is raised with the owner in conversation... requires explicit approval."* The task
brief that produced this synthesis frames it more specifically: **a production-code change that relaxes a
safety/security gate is an owner decision.**

PRE-6's Option A is exactly that shape: it edits `app.js:9546`, in shipped production code, to make a
currently-stricter registration condition (`location.protocol==='https:'`) accept a broader set of
contexts (any `isSecureContext===true` origin, which includes `http://localhost`/`127.0.0.1`/`file:`).
PRE-6's own §6 argues at length that this is not a real weakening — `isSecureContext` is computed
entirely by the browser from the navigated origin, an app cannot spoof it, and on the real production
origin (`https://matkonetesh.pages.dev`) the two checks agree on every real user's session; the only
divergence is the browser's own long-standing, platform-level development carve-out for loopback/`file:`
origins.

**That argument may well be correct — this document is not overturning it — but it does not change the
procedural fact:** this is a change to shipped code that widens what a security-relevant gate accepts, and
PRE-3/PRE-4 (a new test harness and a new eval process, both purely additive, touching no production file)
are not in the same category. **Flagging this plainly, as instructed:** whichever of the three decisions
the owner approves fastest, PRE-6's should not be waved through as "just a design doc's recommendation" —
it is the one item in this trio that needs the owner's explicit, in-conversation sign-off on the
production-code change itself, separate from and in addition to approving the *design* of how the SW
becomes testable. The §7.1 registration-probe spike (run and reported *before* the one-liner ships) is the
right gate to insist on regardless of which way this decision goes.

---

## 5. Cross-cutting issue C — ordering and time-pressure are not symmetric across the three

| Prerequisite | Blocks | External deadline? |
|---|---|---|
| **PRE-3** | `P0-worker` (charter:113) — explicitly named a hard blocker: *"Zero tests reference `worker/index.js`; six P0 items are ungateable."* Nothing else in the program can gate a Worker fix (fail-open on bad KV, the metering race, `CORS:*`) until this lands. | None. Can move on the program's own schedule. |
| **PRE-4** | The `GEM_MODEL` migration (P1) — no baseline, no way to prove "no regression" per §7's bar, and per the Waiver Gate a breach of the grounding/numeric-safety/guard-extraction bars cannot be silently absorbed into "the migration shipped, mostly." | **Yes — the only hard external date of the three.** `gemini-2.5-flash` shuts down **2026-10-16**. PRE-4's own cadence table wants the baseline captured **before 2026-09-01** and a validation run against the replacement **before 2026-09-15**. Once the model shuts down, a fresh baseline becomes permanently impossible to generate — this is not a schedule preference, it is a point of no return. |
| **PRE-6** | The SW/update-delivery channel's testability — including the kind of live-URL release verification §10.10 requires (`.foot-stamp` matches the shipped `מהדורה NNN` *and* a feature probe from that release is present). Today that channel (`reg.update()`, the update toast, the content-hashed cache) is provably dead under test (D24), so a regression there would ship undetected by any automated gate. | None with a fixed calendar date, but every release between now and whenever this lands ships with the update-delivery path unverified by anything except manual spot-checks. |

**Read together:** PRE-4 is the one to decide first if the owner is optimizing by deadline risk — it is
the only one of the three with a date that does not move. PRE-3 is the one to decide first if the owner is
optimizing by what's currently blocking the most other work — it is named a hard blocker for six P0 items
in the charter, while PRE-6 blocks one channel's testability and PRE-4 blocks one migration. None of the
three blocks either of the other two directly (they touch disjoint files: `worker/index.js`, the AI call
path in `app.js`, and the SW-registration line in `app.js` respectively) — they can be decided and executed
in any order or in parallel, except for the shared CI-wiring question in §3.

---

## Sources

All verification in §1 was performed by direct file reads and one `node -e` script against
`worker/package-lock.json`'s `packages` map in this session — not by trusting any of the three source
documents' citations. Files read: `app.js:9538-9564`, `app.js:4200-4214`, `app.js:5025-5034`,
`tests/ai-trust.spec.ts:1-40, 155-234`, `docs/analysis/sweep/VERIFY-W1-C-app-walkthrough.md:75-88`,
`.github/workflows/test.yml`, `package.json`, `worker/package.json`, `worker/package-lock.json` (queried
programmatically for the `wrangler`/`miniflare` `engines` fields), `playwright.config.ts`, and a directory
listing of `worker/node_modules/{workerd,miniflare}`.

---

## Owner decisions (2026-07-23)

All three load-bearing claims were verified CONFIRMED against source before these were put to the owner.

| Prereq | Decision | Consequence |
|---|---|---|
| **PRE-3** | **Real `workerd` via `@cloudflare/vitest-pool-workers`** (owner chose A over the controller's B) | Adds 2 devDependencies, a **second CI job**, a **Node 20→22 bump** in `.github/workflows/test.yml:18`, and a second test command separate from `npx playwright test`. Tests the deployed artifact in the real runtime with a first-party mock for the outbound Gemini call. |
| **PRE-4** | **`GEMINI_EVAL_KEY` GitHub secret + `workflow_dispatch`-only CI job** | ~$2.50/run, ~$15–20 total. Never runs on push. **Time-critical:** baseline of `gemini-2.5-flash` wanted before 2026-09-01; the model retires 2026-10-16. |
| **PRE-6** | **Relax `app.js:9546` from `location.protocol==='https:'` to `isSecureContext`** — one line, gated on a registration-probe spike first | **Owner's choice here is the Waiver-Gate sign-off (§4) for the production `app.js` change.** `isSecureContext` is browser-computed, agrees with the https check on every real user session, and additionally covers only trusted localhost — it does not weaken the production gate. |

### Cross-cutting consequence, now resolved together

PRE-3's choice forces the **CI Node bump (20→22)**, which the Task-5 CI currently pins. PRE-4 adds a second (manual-trigger) job. So `.github/workflows/test.yml` gains: a Node bump, PRE-3's worker-test job, and PRE-4's `workflow_dispatch` eval job. Deciding PRE-3 and PRE-4 together (rather than each editing CI blind) was the point of the synthesis — the CI reshape is now one coherent change, not two colliding ones.

### Ordering into the program

- **PRE-3** blocks the most: the charter names it a hard blocker for six P0-worker items.
- **PRE-4** owns the only external deadline. Its baseline capture is the time-critical path.
- **PRE-6** blocks nothing downstream directly but leaves §10.10 release verification partly manual until done.
- All three touch disjoint files and can be planned as one "Phase −1, part 2" once Task 6 (worker ceiling) closes Phase −1's mechanical half.
