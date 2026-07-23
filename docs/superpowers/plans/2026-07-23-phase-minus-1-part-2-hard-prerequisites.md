# Phase −1 Part 2 · The Hard Prerequisites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three prerequisites that carried a design decision the charter did not answer — now decided by the owner (2026-07-23) — so that Stage 0's Worker fixes, the model migration, and the PWA update-delivery channel can all be tested under the project's Definition of Done.

**Architecture:** Three independent test-enablement tracks that share one CI reshape. PRE-6 is a one-line production change (owner-signed-off under §4) plus a service-worker test, gated on a probe that proves the premise. PRE-3 adds a real-`workerd` test runner for `worker/index.js`. PRE-4 builds a live-model eval harness whose live baseline run is gated on an owner-provisioned secret. The CI workflow gains a Node bump, a worker-test job, and a manual-trigger eval job — as one coherent edit, not three colliding ones.

**Tech Stack:** Playwright 1.61.1, `@cloudflare/vitest-pool-workers` + Vitest (new, worker tests only), Node (CI bump 20→22), GitHub Actions, the app's own AI validators/guards for deterministic eval scoring.

**Spec:** `docs/analysis/program/PRE-3-4-6-synthesis.md` (owner decisions, 2026-07-23) and the three design docs `docs/analysis/program/PRE-{3,4,6}-*.md`. Implementers MUST read the relevant design doc for their track — it carries the fine-grained evidence and options this plan references rather than repeats.

## Global Constraints

- **`npx playwright test` — plain.** Never `--retries`, never `--workers=N` in a committed script or verification step (§11a, DoD 12). `retries: 0` and `workers: 10` stay as committed.
- **Never run two suite runs concurrently on the same port.** After Phase −1 Part 1, `MK_TEST_PORT` lets runs use different ports; same-port concurrency is still forbidden.
- **The worker tests are a SECOND runner** (Vitest), invoked separately from Playwright. They must not be pulled into `npx playwright test`, and Playwright must not try to run them.
- **`app.js` may be modified in exactly ONE place in this whole plan:** Task 1's one-line SW gate change, which the owner signed off under §4. No other task touches `app.js`, `app.css`, `build.py`, or the Python data layer.
- **A GitHub secret (`GEMINI_EVAL_KEY`) cannot be created by an implementer.** Task 5's live run is gated on the owner provisioning it; the task ships the harness and its CI wiring, not a green live eval.
- Any DoD-8 screenshot is **saved** to `docs/analysis/program/part-2-shots/` and named in the report — a screenshot looked at but not kept is an unverifiable claim (L-from-Part-1).
- **Baseline entering this plan:** 419 tests, green, `workers: 10`, CI on Node 20 with one Playwright job. `worker/index.js` is `export default { async fetch(request, env) }` (ES module). SW gate is `app.js:9546` `if('serviceWorker' in navigator && location.protocol==='https:')`.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `app.js:9546` | The SW registration gate — one-line change to `isSecureContext` | 1 |
| `tests/service-worker.spec.ts` | **New.** SW registers + update-flow assertions at `http://localhost` | 1 |
| `worker/vitest.config.*` | **New.** Vitest + `@cloudflare/vitest-pool-workers` config | 2 |
| `worker/test/index.spec.*` | **New.** Worker fetch-handler tests (fail-open, metering, CORS) | 2 |
| `worker/package.json` | Add Vitest devDeps + a `test` script | 2 |
| `.github/workflows/test.yml` | Node 20→22; add worker-test job; add manual eval job | 3, 5 |
| `evals/` (config + harness + fixtures) | **New.** Live-model eval harness, deterministic scoring | 4 |
| `package.json` | An `eval` script | 4 |

---

## Task 1: PRE-6 — probe the premise, relax the gate, test the SW

**Design doc:** `docs/analysis/program/PRE-6-service-worker-env-design.md`. **Owner decision:** relax `app.js:9546` to `isSecureContext`, probe first. **This is the only production-code change in the plan; the owner signed it off under §4.**

**Files:**
- Modify: `app.js:9546`
- Create: `tests/service-worker.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the SW now registers under test at `http://localhost`; later work can assert the update-delivery channel.

- [ ] **Step 1: The probe spike — prove the premise before changing anything**

The entire decision rests on `http://localhost` being a secure context in which a service worker will actually `register()`. A prior sweep measured `isSecureContext:true` on `http://localhost` (`docs/analysis/sweep/VERIFY-W1-C-app-walkthrough.md:87`, D24) — but that measured the *flag*, not a real registration. Write a throwaway spec that, against the running app, forces the registration path and checks a SW actually reaches `activated`:

```ts
import { test, expect } from '@playwright/test';
test('PROBE: a service worker registers and activates on http://localhost', async ({ page }) => {
  await page.goto('/index.html');
  const ok = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no-sw-api';
    if (!window.isSecureContext) return 'not-secure-context';
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      return reg.active ? 'activated' : 'registered-not-active';
    } catch (e) { return 'register-threw: ' + (e as Error).message; }
  });
  expect(ok).toBe('activated');
});
```

- [ ] **Step 2: Run the probe**

Run: `npx playwright test tests/service-worker.spec.ts -g PROBE`
Expected: **PASS** with `activated`.

**If it does not activate — STOP.** Do not change `app.js`. Report the exact returned string with status BLOCKED. The whole one-line-fix decision is invalid if the SW will not register on `http://localhost`, and the owner must then choose the HTTPS-harness path instead. **This is the gate the owner's decision was explicitly conditioned on.**

- [ ] **Step 3: Relax the production gate (the signed-off change)**

In `app.js`, change line 9546 from:

```js
if('serviceWorker' in navigator && location.protocol==='https:'){
```

to:

```js
if('serviceWorker' in navigator && self.isSecureContext){   // was location.protocol==='https:' — isSecureContext is browser-computed, agrees with https on every real user session, and additionally covers trusted localhost so the update-delivery channel is testable (2026-07-23, owner §4 sign-off)
```

Nothing else in the block changes. `isSecureContext` is `true` on `https://matkonetesh.pages.dev` (real users) exactly as the old check was, and additionally `true` on `http://localhost` — it does not weaken the production gate.

- [ ] **Step 4: Rewrite the probe as a real regression test**

Replace the throwaway PROBE test with the permanent coverage the channel never had. Assert what the update-delivery path actually does — registration, and that `reg.update()` is reachable (the v256 fix for "v255 reached the server but not the device"). Derive the assertions from `app.js:9544-9564`; do not assert on wall-clock timing — use `waitForFunction` on `navigator.serviceWorker.controller` / registration state, never `waitForTimeout`.

- [ ] **Step 5: Full suite**

Run: `npx playwright test`
Expected: **420 passed** (419 + the new SW test). Paste output and exit code. Confirm the ~419 pre-existing tests are unaffected by the gate change (none of them exercised the SW, so none should move).

- [ ] **Step 6: Commit**

```bash
git add app.js tests/service-worker.spec.ts
git commit -m "test(sw): relax the SW gate to isSecureContext so the update channel is testable

app.js:9546 gated SW registration on the literal location.protocol==='https:', so under the http
test server the service worker never registered and the entire PWA update-delivery channel — the
v256 reg.update() fix included — had zero coverage. isSecureContext is browser-computed, matches the
https check on every real user session, and additionally covers trusted localhost. Production gate
unchanged in effect; owner-signed-off under §4. Probe confirmed the SW actually activates on
http://localhost before the change was made."
```

---

## Task 2: PRE-3 — real-`workerd` tests for the Worker

**Design doc:** `docs/analysis/program/PRE-3-worker-harness-design.md`. **Owner decision:** real `workerd` via `@cloudflare/vitest-pool-workers` (chosen over a mock-env unit test). All commands in this task run **inside `worker/`**.

**Files:**
- Modify: `worker/package.json` (add devDeps + `test` script)
- Create: `worker/vitest.config.js` (or `.ts`), `worker/test/index.spec.js` (or `.ts`)

**Interfaces:**
- Consumes: `worker/index.js`'s `export default { async fetch(request, env) }`.
- Produces: `npm test` inside `worker/` runs the Worker in real `workerd` with a mocked KV `env` and a mocked outbound Gemini fetch.

- [ ] **Step 1: Add the toolchain**

In `worker/package.json`, add to `devDependencies`: `vitest` and `@cloudflare/vitest-pool-workers` (versions compatible with the already-installed `wrangler@4.111.0`; the design doc §4 records these ship a first-party `fetchMock` for the outbound call). Add `"test": "vitest run"` to `scripts`. Then `cd worker && npm install`.

- [ ] **Step 2: Configure the pool**

Create `worker/vitest.config.js` using `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`, pointing at `wrangler.toml` for bindings, and providing a **miniflare KV** for the `CODES` namespace so tests can seed and corrupt records. Follow the design doc's §5 configuration sketch; do not invent a shape it did not specify without saying so.

- [ ] **Step 3: Write the failing tests — the three known defects**

Create `worker/test/index.spec.js`. Import the Worker's `fetch` (its default export) and drive it with a `Request` and a mocked `env`. Cover, at minimum, the three defects P0-worker will fix (cite `worker/index.js:line` for each in a comment):

1. **Fail-open on a malformed KV record.** Seed the `CODES` KV with a **non-JSON** value for a code, send a request using it, and assert the request is **rejected / capped**, not served as `{active:true}`. (Today it fails OPEN — this test must be RED against the current Worker, proving the defect exists, then P0-worker makes it GREEN. If it is GREEN now, the defect was already fixed and you must report that.)
2. **Metering.** A request against a code at its cap is refused; the debit is applied.
3. **CORS.** Assert the `Access-Control-Allow-Origin` header value the design doc specifies as correct (not `*` once P0-worker tightens it — for now, characterise the current value so the change is visible).

Mock the outbound Gemini call with the pool's `fetchMock` so **no real key or network is used**.

- [ ] **Step 4: Run and read the result honestly**

Run: `cd worker && npm test`
Expected: the fail-open test is **RED** (the defect is still present — P0-worker fixes it later), the others green or red per current behaviour. **Paste the output.** This task's job is to build the harness and *characterise* current behaviour — it does **not** fix the Worker (that is P0-worker). Report clearly which defects are currently red.

- [ ] **Step 5: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/vitest.config.js worker/test/
git commit -m "test(worker): real-workerd test harness via @cloudflare/vitest-pool-workers

worker/index.js had zero tests; npx playwright test drives the browser and never loads the Worker,
so six P0-worker safety fixes were ungateable. Adds Vitest + the Workers pool (owner chose the real
runtime over a mock-env unit test), running the deployed handler in workerd with a miniflare KV and a
first-party mock for the outbound Gemini call. Characterises the current fail-open / metering / CORS
behaviour so P0-worker's fixes have a red-then-green gate. This task does not modify the Worker."
```

---

## Task 3: CI — bump Node to 22 and add the worker-test job

**Depends on:** Task 2 (there must be worker tests to run). **Design source:** synthesis §"CI collision".

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Bump Node and confirm the existing suite still passes on it**

Change `.github/workflows/test.yml:18` `node-version: 20` → `node-version: 22` (required: `wrangler`/`miniflare` declare `engines.node >=22`). The existing Playwright job now runs on Node 22 — **this is the risk this task must discharge.** Do not assume it is safe.

- [ ] **Step 2: Add the worker-test job**

Add a second job that `cd worker && npm ci && npm test`. It needs Node 22 and does **not** need Chromium or Python. Keep it a separate job so a Worker failure and an app failure are distinguishable.

- [ ] **Step 3: Push and watch BOTH jobs to green**

```bash
git add .github/workflows/test.yml
git commit -m "ci: bump to Node 22 and add the worker-test job

@cloudflare/vitest-pool-workers requires Node >=22; CI was pinned to 20. Bumps the runner and adds a
separate job running the worker/ Vitest suite, so a Worker regression and an app regression report
independently. The existing Playwright job is re-confirmed green on Node 22."
git push origin main
gh run watch --exit-status
```

Expected: **both** jobs conclude success. **Paste the `gh run` result.** If the Playwright job regresses on Node 22, that is a real finding — debug it (do not silently revert the bump, since PRE-3 needs 22); if it cannot be made green on 22, STOP and escalate, because the owner's real-workerd choice assumed the bump was viable.

---

## Task 4: PRE-4 — build the eval harness (no secret needed yet)

**Design doc:** `docs/analysis/program/PRE-4-eval-harness-design.md`. **Owner decision:** `GEMINI_EVAL_KEY` secret + `workflow_dispatch`-only job. This task builds and **unit-tests the harness against canned responses** — it does not make live calls, so it needs no key. The live baseline run is Task 5.

**Files:**
- Create: `evals/` — a Playwright (or plain Node) config with `testDir` **outside** `./tests`, the harness, a fixed prompt suite, and the scorers.
- Modify: `package.json` (add `"eval": ...`)

**Interfaces:**
- Consumes: the app's own validators/guards as deterministic scorers — `aiValidateKeys` (`app.js:4387`), `aiValidateItems` (`4394`), `aiValidateSeasonings` (`8393`), `aiSafetyNums` (`4302`), `aiUngroundedSafety` (`4308`), `askRefuse` (`4197`).
- Produces: `npm run eval` — runs the prompt suite against a real model **when a key is present**, scores deterministically, writes a scorecard. **Plain `npx playwright test` must never pick these up** (separate `testDir`/config).

- [ ] **Step 1: The scorers, tested against fixtures (RED first)**

The deterministic scorers (grounding via the validators; numeric safety via `aiSafetyNums`/`aiUngroundedSafety`, including a probe for the known unit-blindness bug where `74°F` extracts as bare `74` and matches a `74°C` grounding value) are pure and testable **without a model**. Write tests that feed each scorer a **canned** good and bad model response and assert the score. Witness RED, then wire the scorers, GREEN. This is the part that must work regardless of the key.

- [ ] **Step 2: The prompt suite + runner, guarded on the key**

Build the fixed prompt suite (grounding / numeric-safety / refusal cases, per the design doc's axes) and the runner that calls the real model **only if `GEMINI_EVAL_KEY` (or a local key) is set**, and otherwise **skips with a clear message** — never fails for a missing key, never silently passes as if it ran. Confirm the separation: `npx playwright test` at the repo root still reports **420**, untouched by `evals/`.

- [ ] **Step 3: Commit**

```bash
git add evals/ package.json
git commit -m "eval: live-model eval harness with deterministic scorers (baseline run gated on a key)

Builds the harness the migration off gemini-2.5-flash needs: a fixed prompt suite scored by the app's
own validators/guards (aiValidateKeys/Items/Seasonings, aiSafetyNums/aiUngroundedSafety, askRefuse),
plus a probe for the known unit-blind numeric guard. Unlike tests/ai-trust.spec.ts — which stubs the
model and would pass against a shut-down one — this calls a real model when a key is present and skips
(never fails, never fake-passes) when absent. Isolated testDir so npx playwright test never runs it.
The live baseline capture is Task 5, gated on the owner provisioning GEMINI_EVAL_KEY."
```

---

## Task 5: PRE-4 — the manual eval CI job (baseline run gated on the owner's secret)

**External dependency the implementer CANNOT satisfy:** the `GEMINI_EVAL_KEY` GitHub secret must be created by the owner. This task ships the CI wiring and verifies it as far as possible without the secret; the actual baseline run is an owner-triggered step recorded as a follow-up.

**Files:**
- Modify: `.github/workflows/test.yml` (add a `workflow_dispatch` job)

- [ ] **Step 1: Add the manual eval job**

Add a job triggered by `workflow_dispatch` **only** (never on push/PR), that installs Node 22, runs `npm run eval`, and reads the key from `secrets.GEMINI_EVAL_KEY`. It uploads the scorecard as an artifact.

- [ ] **Step 2: Verify the wiring as far as a missing secret allows**

`gh workflow list` shows the job; a `workflow_dispatch` run with **no secret set** must reach the eval step and **skip cleanly** (Task 4 Step 2's guard), proving the plumbing without a paid call. Paste that run's result. **Do not fabricate a green baseline** — there is none until the owner adds the key.

- [ ] **Step 3: Commit, and record the owner follow-up**

```bash
git add .github/workflows/test.yml
git commit -m "ci: manual-trigger eval job (workflow_dispatch, GEMINI_EVAL_KEY-gated)

Adds the owner-triggered eval job. It never runs on push. Without the secret it reaches the eval step
and skips cleanly, proving the wiring; the real baseline of gemini-2.5-flash is captured once the owner
provisions GEMINI_EVAL_KEY. That baseline is time-critical — the model retires 2026-10-16 and the
charter wants the baseline before 2026-09-01."
```

Then write the follow-up plainly in the report: **the owner must (a) create `GEMINI_EVAL_KEY` as a repo secret, (b) trigger the eval job to capture the incumbent baseline before 2026-09-01.** This plan cannot close that step for them.

---

## Self-Review

**1. Spec coverage.** PRE-6 → Task 1 (probe + one-line fix + SW test). PRE-3 → Task 2 (harness) + Task 3 (CI Node bump + worker job). PRE-4 → Task 4 (harness, no key) + Task 5 (manual CI job, baseline gated on the owner's secret). The three owner decisions in `PRE-3-4-6-synthesis.md` each map to a task. The shared CI reshape is Tasks 3 and 5, sequenced after their harnesses exist.

**2. Placeholder scan.** Task 2's exact Vitest config shape and Task 4's exact prompt cases are referenced to the design docs rather than reproduced, because those docs carry the verified detail and an implementer is told to read them — this is a deliberate handoff, not a "figure it out." Task 1's, Task 3's code is given in full. Task 5 has an irreducible external dependency (a secret only the owner can create); it is stated as such, not hidden.

**3. Ordering & type consistency.** PRE-6 probe **gates** its own one-line change (Step 2 STOP). Task 3 depends on Task 2 (needs worker tests to run). Task 5 depends on Task 4 (needs the harness to invoke). Node bump (Task 3) is required by the runner Task 2 introduces. `isSecureContext` used consistently in Task 1. Worker `export default { async fetch }` matches `worker/index.js`.

**One risk stated.** Task 3's Node 20→22 bump re-runs the existing Playwright job on a new Node major. It is low-risk (Playwright supports Node 22), but it is a real change to the green CI just shipped, so Task 3 discharges it explicitly by watching both jobs to green rather than assuming.
