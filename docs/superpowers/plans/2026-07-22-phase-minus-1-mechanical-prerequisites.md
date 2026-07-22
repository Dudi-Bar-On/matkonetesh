# Phase −1 · Mechanical Prerequisites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the five mechanical prerequisites that must exist before any of the 141 gaps can be closed under the project's own Definition of Done.

**Architecture:** Five independent infrastructure changes to the test harness and CI, ordered so that each one's verification is possible when it runs. The port fix comes first because it unlocks concurrent suite runs, which every later task benefits from. The viewport standardization comes before CI so CI is not born red. The worker-ceiling re-measurement comes last because it must measure the final suite.

**Tech Stack:** Playwright 1.61.1 (`@playwright/test`), Node (CommonJS), Python 3 stdlib (`build.py`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-22-gap-closing-program-charter.md` §3 (PRE-1, PRE-2, PRE-5, PRE-7, PRE-8), approved 2026-07-22.

**Not in this plan:** PRE-3 (Worker test harness), PRE-4 (live-model eval harness + incumbent baseline) and PRE-6 (service-worker-exercisable environment). Each carries a genuine design decision the charter does not answer, and each gets a short design pass first.

## Global Constraints

- **`npx playwright test` — plain.** Never pass `--retries` or `--workers=N` in a committed script or in a verification step. Retries mask flakes; `--workers=1` is the old 13-minute serial path. (`CLAUDE.md` §11a, DoD line 12.) The single exception is Task 5, whose entire purpose is measuring worker counts, and which changes no committed default until its final step.
- **`retries: 0` stays.** A flake is a bug to be debugged, never averaged out.
- **Never run two suite runs concurrently on the same port.** Racing runs previously produced 12 then 127 phantom `ERR_CONNECTION_REFUSED` failures and sent a debugging session after a server bug that did not exist. After Task 1 this becomes possible *on different ports*; it is still forbidden on the same one.
- **After `python build.py`, restart any manual `serve.js`** before a UI check — it caches `dist/` in memory at startup, so you will otherwise verify a stale build.
- **Do not modify `app.js`, `app.css`, `build.py` or the Python data layer in this plan.** The only exception is Task 4, which adds no logic and only touches test files.
- **Baseline at plan time:** 413 tests in 82 files. `workers: 6`. `PORT = 8123`. `.github/` does not exist. `package.json`'s `test` script is an error stub.
- Every task ends with a full `npx playwright test` run, output pasted, per DoD line 12.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `playwright.config.ts` | Single source of truth for port, workers, projects, webServer | 1, 2, 5 |
| `serve.js` | Static server. **Already reads `process.argv[2]`** (`serve.js:18`) — no change needed | — |
| `tests/*.spec.ts` (5 files) | Remove now-redundant `setViewportSize` calls | 4 |
| `tests/ai-validators.spec.ts` | **New.** Coverage for the three grounding validators | 3 |
| `.github/workflows/test.yml` | **New.** CI: build + full suite on every push and PR | 6 |
| `package.json` | Replace the error-stub `test` script | 6 |

---

## Task 1: PRE-1 — parameterize the test port

**Why first:** `playwright.config.ts:5` hardcodes `const PORT = 8123` and `reuseExistingServer: false`. Two agents running the suite concurrently collide on that port. Every parallel track in the program is blocked behind this one line.

**Files:**
- Modify: `playwright.config.ts:5`

**Interfaces:**
- Consumes: nothing.
- Produces: the environment variable **`MK_TEST_PORT`** (integer, optional, default `8123`). Later tasks and all future parallel tracks use it as `MK_TEST_PORT=<n> npx playwright test`.

- [ ] **Step 1: Witness RED — prove two concurrent runs collide today**

Open two terminals. In the first:

```bash
cd /c/Users/dudib/source/repos/matconetesh
npx playwright test tests/equip-chooser.spec.ts
```

While that is still running, in the second terminal:

```bash
cd /c/Users/dudib/source/repos/matconetesh
npx playwright test tests/workplan.spec.ts
```

Expected: the second run fails to start its web server, reporting that port 8123 is already in use (`EADDRINUSE`), or hangs until the 120 s `webServer.timeout` and then errors. **Paste both terminals' output.** This is the failure the task removes.

- [ ] **Step 2: Make the port configurable**

In `playwright.config.ts`, replace line 5:

```ts
const PORT = 8123;
```

with:

```ts
// Overridable so two suite runs can execute concurrently on different ports. serve.js already
// reads its port from process.argv[2] (serve.js:18), so only this constant needed changing.
// Concurrent runs on the SAME port remain forbidden — that produced 127 phantom
// ERR_CONNECTION_REFUSED failures on 2026-07-21 (CLAUDE.md §11a).
const PORT = Number(process.env.MK_TEST_PORT) || 8123;
```

No other line changes. `baseURL` (line 20), `webServer.command` (line 33) and `webServer.url` (line 34) already interpolate `${PORT}`.

- [ ] **Step 3: Verify GREEN — the same two runs now pass concurrently**

Terminal one:

```bash
MK_TEST_PORT=8123 npx playwright test tests/equip-chooser.spec.ts
```

Terminal two, started while the first is still running:

```bash
MK_TEST_PORT=8231 npx playwright test tests/workplan.spec.ts
```

Expected: **both pass.** Paste both outputs, showing the two different ports in the `webServer` lines.

- [ ] **Step 4: Verify the default is unchanged**

```bash
npx playwright test tests/equip-chooser.spec.ts
```

Expected: passes, serving on 8123 exactly as before. A developer who sets nothing sees no change.

- [ ] **Step 5: Full suite**

```bash
npx playwright test
```

Expected: `413 passed`. Paste the output and the exit code.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts
git commit -m "test(config): make the Playwright port overridable via MK_TEST_PORT

playwright.config.ts hardcoded PORT = 8123 with reuseExistingServer: false, so two suite runs
collided and every parallel track in the gap-closing program was blocked behind one line.
serve.js already took its port from argv[2]; only the config constant needed changing.

Concurrent runs on the SAME port are still forbidden - that produced 12 then 127 phantom
ERR_CONNECTION_REFUSED failures on 2026-07-21 and sent a debugging session after a server bug
that did not exist."
```

---

## Task 2: PRE-7a — make 390 × 844 the suite's default viewport, and measure the damage

**Why:** `playwright.config.ts:28` declares only `devices['Desktop Chrome']`. DoD line 8 **mandates** a 390 × 844 screenshot for any UI change, but the suite runs desktop-width by default, so a screenshot taken inside a test is the wrong size unless that test happens to set the viewport. The app is mobile-first; the suite should be too.

**This task is expected to produce failures.** They are findings, not noise — a layout that breaks at 390 × 844 is a real defect in a mobile-first app. This task's deliverable is *the change plus a recorded, categorized failure list*. The fixes are Task 3.

**Files:**
- Modify: `playwright.config.ts:27-29`
- Create: `docs/analysis/program/PRE-7-viewport-failures.md`

**Interfaces:**
- Consumes: `MK_TEST_PORT` from Task 1.
- Produces: every test now runs at **390 × 844** unless it explicitly overrides. Task 4 removes the redundant overrides.

- [ ] **Step 1: Record the current baseline**

```bash
npx playwright test 2>&1 | tail -5
```

Expected: `413 passed`. Paste it. This is the "before" against which the next step's failures are attributed.

- [ ] **Step 2: Change the project's default viewport**

In `playwright.config.ts`, replace lines 27-29:

```ts
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
```

with:

```ts
  projects: [
    // The app is mobile-first and DoD line 8 mandates evidence at 390x844, so the suite runs at
    // that size by default. Before 2026-07-22 the default was Desktop Chrome and only 2 of 82
    // specs set a mobile viewport, so a screenshot taken inside a test was usually the wrong size.
    // Individual tests may still override with page.setViewportSize for a specific check.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
```

- [ ] **Step 3: Run the full suite and capture every failure**

```bash
npx playwright test 2>&1 | tee /tmp/pre7-run.txt | tail -40
```

Do **not** fix anything yet. Paste the summary line.

- [ ] **Step 4: Write the failure register**

Create `docs/analysis/program/PRE-7-viewport-failures.md` with one row per failing test:

```markdown
# PRE-7 · Viewport standardization — failure register

**Before:** 413 passed at Desktop Chrome (1280 x 720).
**After:** <N> passed, <M> failed at 390 x 844.

| # | Spec file : line | Test name | Failure | Category |
|---|---|---|---|---|
| 1 | ... | ... | ... | LAYOUT / SELECTOR / TIMING / REAL-BUG |
```

Categories, applied per failure:
- **LAYOUT** — an element is clipped, overlapped or off-screen at 390 px. **This is a real product defect.**
- **SELECTOR** — the test targeted something that only exists in the desktop layout.
- **TIMING** — the test raced; narrower layout changed render order.
- **REAL-BUG** — behaviour differs, not just presentation.

> **Owner ruling, 2026-07-22 (pre-flight conflict scan):** the original plan split "change the viewport
> and measure" from "fix what broke", which would have committed a **red suite** between two tasks and
> narrowed DoD line 12. §4 makes that the owner's call, and the owner merged the two. **The steps below
> continue in this same task; it does not commit until the suite is green.**

**This task's size is not knowable until Step 3 runs.** If the register holds more than about eight
failures, or any **REAL-BUG** row, **stop and raise it with the owner before fixing** — a wave of real
mobile layout defects is a finding that belongs in the gap register, not a prerequisite to be quietly
absorbed.

- [ ] **Step 5: Confirm each failure reproduces in isolation**

For each row:

```bash
npx playwright test <spec-file> -g "<test name>"
```

Expected: the same failure. A failure that does not reproduce alone is a **TIMING** row and is treated as a flake — that is a bug, debugged via `systematic-debugging`, never retried away.

- [ ] **Step 6: Fix SELECTOR and TIMING rows in the tests**

A SELECTOR fix targets something present in both layouts. A TIMING fix replaces whatever raced with a condition wait — **`waitForFunction`, never `waitForTimeout`** (DoD line 11; the suite currently has zero arbitrary waits and must keep zero).

- [ ] **Step 7: Escalate LAYOUT and REAL-BUG rows**

These are product defects, not test defects. Do **not** widen the viewport to make them pass — that would delete the finding. Add each to `docs/analysis/program/PRE-7-viewport-failures.md` with a proposed gap ID and raise them with the owner. If a fix is small and clearly correct, propose it; otherwise it becomes a gap in the register.

- [ ] **Step 8: Full suite — must be green before committing**

```bash
npx playwright test
```

Expected: all tests passing at 390 × 844. Paste the output and exit code. **Do not commit while red** — per the owner's pre-flight ruling this task carries DoD line 12 unmodified.

- [ ] **Step 9: Commit the change, the register and the fixes together**

```bash
git add playwright.config.ts tests/ docs/analysis/program/PRE-7-viewport-failures.md
git commit -m "test: run the suite at 390x844, and fix what that broke

The app is mobile-first and DoD line 8 mandates evidence at 390x844, but the suite ran Desktop
Chrome and only 2 of 82 specs set a mobile viewport - so a screenshot taken inside a test was
usually the wrong size.

Test-side failures (SELECTOR, TIMING) are fixed here. LAYOUT and REAL-BUG rows are product defects
and are escalated in the register rather than hidden by widening the viewport back."
```

---

## Task 3: PRE-7c — remove the now-redundant viewport overrides

**Why:** 19 `setViewportSize` calls across 5 files set five *different* sizes (390 × 900 ×7, 390 × 820 ×7, 390 × 844 ×2, 390 × 780 ×2, 390 × 1000 ×1). With the project default now 390 × 844, each is either redundant or an undocumented deliberate exception. Two conventions in one suite is how DoD line 8 got missed in the first place.

**Files:**
- Modify: `tests/adaptive-home.spec.ts` (12 calls: lines 43, 77, 104, 142, 167, 209, 226, 249, 275, 310, 345, 389)
- Modify: `tests/occupancy-unknown-footprint.spec.ts` (line 77)
- Modify: `tests/occupancy-view.spec.ts` (line 66)
- Modify: `tests/scheduler-placement.spec.ts` (lines 131, 154)
- Modify: `tests/timeline-enhancements.spec.ts` (lines 59, 90, 131)

**Interfaces:**
- Consumes: the 390 × 844 project default from Task 2.
- Produces: exactly one viewport convention in the suite.

- [ ] **Step 1: Remove the two calls that already match the default**

Delete these lines outright — they now restate the project default:

- `tests/occupancy-unknown-footprint.spec.ts:77`
- `tests/occupancy-view.spec.ts:66`

- [ ] **Step 2: Remove the 17 calls that differ, one file at a time**

For each of `adaptive-home.spec.ts`, `scheduler-placement.spec.ts`, `timeline-enhancements.spec.ts`: delete its `setViewportSize` lines, then run that file alone.

```bash
npx playwright test tests/adaptive-home.spec.ts
```

Expected: passes at the 390 × 844 default.

- [ ] **Step 3: Where a test genuinely needs a different height, keep it — with a reason**

If a test fails at 844 and passes at its original height, that height is load-bearing. Restore it **with a comment stating what it is proving**, for example:

```ts
// 390x1000 deliberately: this test asserts that all six home cards are visible WITHOUT scrolling,
// which needs a taller viewport than the 390x844 default.
await page.setViewportSize({ width: 390, height: 1000 });
```

An override without such a comment is not allowed to survive this task.

- [ ] **Step 4: Confirm no unexplained overrides remain**

```bash
grep -n -B2 "setViewportSize" tests/*.ts
```

Expected: every remaining call is immediately preceded by a comment explaining why. Paste the output.

- [ ] **Step 5: Full suite**

```bash
npx playwright test
```

Expected: all passing. Paste output and exit code.

- [ ] **Step 6: Commit**

```bash
git add tests/
git commit -m "test: collapse five ad-hoc viewports into one 390x844 convention

19 setViewportSize calls across 5 files set five different sizes (900 x7, 820 x7, 844 x2, 780 x2,
1000 x1). With the project default now 390x844 each was redundant or an undocumented exception.
Surviving overrides must state what they prove; two conventions in one suite is how DoD line 8
came to be satisfied by only 2 of 82 specs."
```

---

## Task 4: PRE-5 — cover the three grounding validators

**Why:** `aiValidateKeys` (`app.js:4387`), `aiValidateItems` (`app.js:4394`) and `aiValidateSeasonings` (`app.js:8393`) are described as the primary defence for seven AI features, and **`grep -rn` across all 82 spec files returns zero references to any of them.** They are pure functions over an allow-list — cheap to test and currently unproven.

**Files:**
- Create: `tests/ai-validators.spec.ts`

**Interfaces:**
- Consumes: `MK_TEST_PORT` (Task 1); the 390 × 844 default (Task 2).
- Produces: nothing later tasks depend on.

**What the functions do** (read at the cited lines, not inferred):
- `aiValidateKeys(keys)` → `{kept, dropped}`. Valid set is `cwAllItems().map(i => i.key)` (`cwAllItems` at `app.js:7193`). Non-arrays yield empty. **No dedup.**
- `aiValidateItems(arr)` → `{kept, dropped}`. Same valid set, keyed on `o.key`, **and dedups** via a `seen` set. Duplicates land in `dropped`.
- `aiValidateSeasonings(ids, cat, isProd)` → `{kept, dropped}`. Valid set is `seasoningsFor(cat, produce).map(s => s.id)` (`seasoningsFor` at `app.js:1122`). Dedups.

- [ ] **Step 1: Write the failing test file**

Create `tests/ai-validators.spec.ts`. It follows the boot pattern already used by `tests/equip-chooser.spec.ts:11-21` and derives valid ids from the app at runtime, so it does not hardcode catalog data that may change.

```ts
import { test, expect } from '@playwright/test';

// aiValidateKeys / aiValidateItems / aiValidateSeasonings are the allow-list filters that stop a
// model inventing a recipe or a seasoning. Before 2026-07-22 no spec referenced any of them.
// They are pure functions over a valid set, so they are tested directly via page.evaluate.

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(
    `typeof aiValidateKeys==='function' && typeof aiValidateItems==='function' && typeof aiValidateSeasonings==='function'`
  );
};

test('aiValidateKeys keeps real catalog keys and drops invented ones', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var real = cwAllItems()[0].key;
    return aiValidateKeys([real, 'totally-invented-key']);
  })()`);
  expect(r.kept).toHaveLength(1);
  expect(r.dropped).toEqual(['totally-invented-key']);
});

test('aiValidateKeys returns empty for a non-array', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`aiValidateKeys(null)`);
  expect(r.kept).toEqual([]);
  expect(r.dropped).toEqual([]);
});

test('aiValidateItems drops a duplicate key rather than keeping it twice', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var real = cwAllItems()[0].key;
    return aiValidateItems([{key: real}, {key: real}, {key: 'nope'}]);
  })()`);
  expect(r.kept).toHaveLength(1);
  expect(r.dropped).toHaveLength(2);
});

test('aiValidateItems drops an item with no key at all', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`aiValidateItems([{}, {key: null}])`);
  expect(r.kept).toEqual([]);
  expect(r.dropped).toHaveLength(2);
});

test('aiValidateSeasonings keeps only ids valid for the given category', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    var cat = 'beef';
    var list = seasoningsFor(cat, false);
    var real = list[0].id;
    return { r: aiValidateSeasonings([real, real, 'invented-seasoning'], cat, false), n: list.length };
  })()`);
  expect(r.n).toBeGreaterThan(0);
  expect(r.r.kept).toHaveLength(1);
  expect(r.r.dropped).toHaveLength(2);
});
```

- [ ] **Step 2: Run it and witness RED for the intended reason**

```bash
npx playwright test tests/ai-validators.spec.ts
```

Expected: **all five FAIL.** Paste the output.

**Read the failure reason before continuing.** If they fail on `waitForFunction` timing out, the functions are not reachable as globals and the test's access pattern is wrong — fix the test, not the app. If they fail on an assertion, the validator's real behaviour differs from what was read at the cited lines: **that is a finding — stop and report it, do not adjust the assertion to match.** A test rewritten to fit the implementation is exactly the defect recorded in `W1-B` contradiction #3.

- [ ] **Step 3: Make them pass**

There is no production code to write — the validators already exist. Passing means the assertions match real behaviour. If any test needed a *test-side* correction in Step 2, apply it now and re-run.

```bash
npx playwright test tests/ai-validators.spec.ts
```

Expected: **5 passed.** Paste the output.

- [ ] **Step 4: Full suite**

```bash
npx playwright test
```

Expected: 418 passed (413 + 5). Paste output and exit code.

- [ ] **Step 5: Commit**

```bash
git add tests/ai-validators.spec.ts
git commit -m "test: cover the three AI grounding validators

aiValidateKeys, aiValidateItems and aiValidateSeasonings are the allow-list filters that stop a
model inventing a recipe or a seasoning, described as the primary defence for seven AI features -
and no spec referenced any of them. Pure functions over a valid set; tested directly.

Covers the dedup behaviour in aiValidateItems and aiValidateSeasonings that aiValidateKeys
deliberately does not have."
```

---

## Task 5: PRE-2 — CI on GitHub Actions

**Why:** there is no CI. `package.json`'s `test` script is `echo "Error: no test specified" && exit 1`. Every DoD line-12 run is manual, on one machine, and nothing prevents a red suite from being pushed. `forbidOnly: !!process.env.CI` is already wired in the config and does nothing today.

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `package.json:10`

**Interfaces:**
- Consumes: `MK_TEST_PORT` (Task 1, unused in CI but available); a green suite (Tasks 3–5).
- Produces: a CI run on every push and pull request against `main`.

**Facts that make this small:** the remote is `https://github.com/Dudi-Bar-On/matkonetesh.git`; `build.py` imports only the Python standard library; there is exactly one npm devDependency.

- [ ] **Step 1: Confirm the suite is green locally first**

```bash
npx playwright test
```

Expected: all passing. **Do not add CI on top of a red suite** — a workflow that is red on its first run gets ignored from then on.

- [ ] **Step 2: Add the workflow**

Create `.github/workflows/test.yml`:

```yaml
name: tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  playwright:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      # build.py inlines app.js + app.css + the Python data layer into dist/index.html.
      # It imports only the standard library, so no pip install step is needed.
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: npm ci

      - name: Install Chromium
        run: npx playwright install --with-deps chromium

      # playwright.config.ts's webServer runs `python build.py && node serve.js <port>` itself,
      # so the build is exercised by the same command the suite uses locally.
      - name: Run the suite
        run: npx playwright test

      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7
```

- [ ] **Step 3: Replace the error-stub test script**

In `package.json`, replace line 10:

```json
    "test": "echo \"Error: no test specified\" && exit 1"
```

with:

```json
    "test": "playwright test"
```

- [ ] **Step 4: Verify `npm test` works locally**

```bash
npm test
```

Expected: the full suite runs and passes, identically to `npx playwright test`. Paste the output.

- [ ] **Step 5: Commit and push, then verify the run actually went green**

```bash
git add .github/workflows/test.yml package.json
git commit -m "ci: run the Playwright suite on every push and PR

There was no CI. package.json's test script was an error stub, every DoD line-12 run was manual on
one machine, and forbidOnly: !!process.env.CI had nothing to gate. build.py imports only the Python
stdlib and there is one npm devDependency, so the workflow is checkout + node + python + npm ci +
chromium + npx playwright test.

The config's own webServer runs build.py, so CI exercises the same build the local suite does."
git push origin main
```

Then **watch the run to completion** — a workflow file that was committed is not a workflow that passes:

```bash
gh run list --limit 3
gh run watch
```

Expected: `tests` completes **success**. Paste the result. If it fails, debug it now; a red CI on day one is worse than no CI, because it teaches everyone to ignore the badge.

---

## Task 6: PRE-8 — re-measure the worker ceiling

**Why:** `playwright.config.ts:17` pins `workers: 6`, and the comment above it records that this was measured at **324 tests**. The suite is now 413, and will be ~418 after Task 5 — roughly 29% past the measured point. The comment itself says "Re-measure and adjust if the suite grows substantially again."

**Files:**
- Modify: `playwright.config.ts:12-17` (the comment and the value)

**Interfaces:**
- Consumes: the final suite from Tasks 3–6.
- Produces: a `workers` value justified by a measurement recorded in the comment.

**This is the one task permitted to pass `--workers`,** because measuring worker counts is its entire purpose. No committed default changes until the final step.

- [ ] **Step 1: Confirm the machine is free**

```bash
npx playwright test --list 2>/dev/null | tail -1
```

Record the exact test count. Confirm no other suite run and no manual `serve.js` is active — **a competing run invalidates every number below**, and that exact mistake produced 127 phantom failures on 2026-07-21.

- [ ] **Step 2: Measure the current setting three times**

```bash
for i in 1 2 3; do
  echo "--- run $i at 6 workers ---"
  /usr/bin/time -f "%e s" npx playwright test 2>&1 | tail -3
done
```

Record pass count and wall time for each. **All three must be clean** for 6 to remain a valid floor.

- [ ] **Step 3: Measure a higher candidate three times**

```bash
for i in 1 2 3; do
  echo "--- run $i at 8 workers ---"
  /usr/bin/time -f "%e s" npx playwright test --workers=8 2>&1 | tail -3
done
```

- [ ] **Step 4: Measure one higher still, three times**

```bash
for i in 1 2 3; do
  echo "--- run $i at 10 workers ---"
  /usr/bin/time -f "%e s" npx playwright test --workers=10 2>&1 | tail -3
done
```

- [ ] **Step 5: Choose the ceiling**

The ceiling is **the highest count that passed all three runs cleanly.** Reliability wins over speed: a count that is 30 seconds faster but fails one run in three is not a ceiling, it is a flake generator, and `retries: 0` means it will surface as a red suite.

If 6 itself fails any run, **stop and escalate** — that is a suite reliability problem, not a tuning problem, and it is debugged via `systematic-debugging` before this task continues.

- [ ] **Step 6: Update the config with the measurement**

In `playwright.config.ts`, replace the comment block at lines 12-16 and the value at line 17 with the measured result. Using 8 as an example — **substitute your real numbers**:

```ts
  // Measured reliable ceiling against the clustered in-memory serve.js.
  // Re-measured 2026-07-22 at <N> tests (previous measurement was taken at 324):
  //   6 workers  -> 3/3 clean, ~<X>s
  //   8 workers  -> 3/3 clean, ~<Y>s   <- chosen
  //   10 workers -> <result>
  // Reliability over speed: retries is 0, so a count that fails 1 run in 3 surfaces as a red suite.
  // Re-measure again if the suite grows substantially.
  workers: 8,
```

- [ ] **Step 7: Confirm the committed default**

```bash
npx playwright test
```

Expected: all passing at the new default, in roughly the time recorded. Paste output and exit code.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts
git commit -m "test(config): re-measure the worker ceiling for the grown suite

workers: 6 was measured at 324 tests; the suite is now <N> - about 29% past that point, and the
config's own comment asked for a re-measure. Measured 3 clean runs at each candidate and recorded
the numbers in the comment so the next person does not have to guess what was tested.

Reliability over speed: retries is 0, so a worker count that fails one run in three surfaces as a
red suite, not as a slow one."
```

---

## Self-Review

**1. Spec coverage.** Charter §3: PRE-1 → Task 1 · PRE-7 → Tasks 2, 3 · PRE-5 → Task 4 · PRE-2 → Task 5 · PRE-8 → Task 6. PRE-3, PRE-4 and PRE-6 are explicitly out of scope and named as such in the header. **All five in-scope prerequisites have a task.**

**2. Placeholder scan.** No "TBD" or "add error handling". Task 3's size genuinely cannot be known before Task 2 executes — that is stated as a measurement dependency with an escalation threshold (>8 failures, or any REAL-BUG row), not left vague. Task 7's config values are `<X>`/`<Y>` placeholders **by design**: they are measurements the implementer takes, and pre-filling them would invite copying a fabricated number.

**3. Type consistency.** The env var is `MK_TEST_PORT` in Tasks 1, 2 and 5. The viewport is `{ width: 390, height: 844 }` in Tasks 2 and 4. Validator names match `app.js` at the cited lines: `aiValidateKeys` (4387), `aiValidateItems` (4394), `aiValidateSeasonings` (8393), with helpers `cwAllItems` (7193) and `seasoningsFor(cat, produce)` (1122).

**4. Ordering.** Port before everything (unlocks concurrency) · viewport standardization before CI (so CI is not born red) · validator tests before CI (so CI covers them) · ceiling re-measured last (so it measures the final suite).

**One risk worth stating.** Task 2 could surface a large number of layout failures rather than a handful. Task 2 carries an explicit escalation threshold for exactly that case, because a wave of real mobile defects in a mobile-first app belongs in the gap register as findings — not absorbed silently into a prerequisite.
