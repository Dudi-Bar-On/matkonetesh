# Warm-Page Test Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the suite's cold `addInitScript(seed)+page.goto('/index.html')` per test (433 cold parses of the 2.7 MB single-file app per run) with a **worker-scoped warm page** reset per test by `seedApp(kv)` = clear-storage → set-keys → `reload({waitUntil:'domcontentloaded'})` — 8 cold parses per run instead of 433, with the warm reload measured at **p50 ~1028 ms vs cold ~2155 ms** (W0).

**Architecture:** A worker-scoped `warmContext`+`warmPage` pair (ONE ephemeral `browser.newContext()` per worker, ONE cold `goto` at creation) plus a test-scoped `warm` wrapper that adds per-test trace **chunks** (`startChunk`/`stopChunk` — the documented cure for retain-on-failure on a shared context, playwright #14027), listener cleanup, a closed-page guard, and a hard **trap on `page.addInitScript`** (script ordering across accumulated init scripts is documented-undefined and there is no removal API — research Q2). `seedApp(page, kv)` is the one per-test reset primitive, self-contained on both classic and warm pages so migration can proceed file-by-file with `main` green at every commit; the default `page` fixture is **flipped** to the warm page only after every spec is migrated or escape-hatched. `isolatedPage` (a fresh page in the test's own built-in context) is the escape hatch for the three specs that genuinely need per-test isolation (page.clock, service-worker project, per-file `test.use` viewport). A failing test can never poison successors: "Workers are always shutdown after a test failure" (playwright test-parallel docs) — the warm page dies with the worker and the next test gets a fresh one, free.

**Tech Stack:** Playwright Test fixtures (`base.extend` with worker-scoped tuple fixtures), the repo's existing `tests/_fixtures.ts` (absorbed/superseded), TypeScript specs. No app code, no server code, no config-behavior change.

**Authoritative design:** `docs/research/warm-page-architecture-research.md` (Q1–Q6, D1–D4) **as amended by the W0 measured decisions below, which OVERRIDE the research doc wherever they differ.** Format template: `docs/superpowers/plans/2026-07-23-ai-model-selection-migration.md`.

## W0 measured decisions (2026-07-23) — these OVERRIDE the research doc

Source: `docs/research/measurements/w0-2026-07-23T19-06-51-827Z.json` (gitignored raw data; `selfVerification.ok: true`, 270 real navigations, 597 server requests — numbers therefore inlined here per the RUNBOOK's own rule).

| # | Decision | Evidence (from the W0 JSON) |
|---|---|---|
| **W0-a** | **Ephemeral warm contexts — STAY-ON-A.** Never build `launchPersistentContext` (research Option B) — it measured **WORSE**: warm-persistent@304 p50 **1787.7 ms** (max 12,073 ms) vs warm-ephemeral **1027.65 ms** (`gate.escalateToB: "STAY-ON-A"`, `improvementOverA: -0.74`). The compile-skip engine in ephemeral contexts is V8's in-isolate source-keyed compilation cache — no disk cache needed. | `gate.warmBP50: 1787.7`, `gate.warmAP50: 1027.65` |
| **W0-b** | **serve.js is NOT touched. Skip the ETag/304 change (research D1) entirely — YAGNI.** 200-vs-304 measured statistically identical for the metric the suite gates on: warm-ephemeral@**200** p50 **1029.15 ms** vs warm-ephemeral@**304** p50 **1027.65 ms**. The win is V8's in-isolate cache, which is source-keyed and does not care about HTTP caching. | `armStats['warm-ephemeral@200'].dcl.p50: 1029.15` vs `['warm-ephemeral@304'].dcl.p50: 1027.65` |
| **W0-c** | **The win to preserve:** warm reload p50 **~1028 ms** vs cold goto p50 **~2155 ms** (`gate.ratio: 0.477` ≤ the 0.60 gate → `result: "GO"`). Halving per-test navigation cost is the entire point; any design choice that reintroduces a per-test cold `goto` on the main path defeats it. | `gate.coldP50: 2155.15`, `gate.warmAP50: 1027.65`, `gate.result: "GO"` |

Anything in the research doc that assumes D1 (serve.js 304s) or offers Option B/C escalation is **dead for this plan** — do not implement it, do not "prepare seams" for it.

## Global Constraints

*(Every task's requirements implicitly include this section. Values copied verbatim from the task brief + `CLAUDE.md`/discipline.)*

- **`retries: 0`** stays. Never pass `--retries` or `--workers` on any command line (DoD 12; L10).
- **No `waitForTimeout`** — the suite currently contains **zero** (`grep -rn waitForTimeout tests/` → no matches, measured 2026-07-23; the L15 backlog was fully converted). It stays at zero: every wait in this plan is a condition wait (DoD 11).
- **`serve.js` untouched** (W0-b). Zero edits, zero new headers.
- **`playwright.config.ts` `workers` untouched** — `workers: process.env.CI ? 2 : 8` stays byte-identical. Task 7 edits the **comment only**. No worker-count change in this plan (phase B/C is the controller's).
- **No push.** Every task commits **locally on `main`**; the controller owns deploy/verification phases. (Graph sync via `scripts/sync-docs.sh` is likewise the controller's close-out — noted, not silently skipped.)
- **Each task commits separately.**
- **Behavior-parity bar:** no pre-existing assertion changes except the enumerated init-pattern migrations in this plan. A migration edit may touch a spec's seeding/navigation lines ONLY; every `expect(...)` stays byte-identical.
- **Full suite gate = plain `npx playwright test`** (file arguments allowed for inner-loop targeted runs; flags never). Run it **serialized on an idle machine** — pause CPU-heavy background agents, stop any manual `serve.js` on :8123 first, never two runs concurrently (§11a).
- **DoD 8 (390×844 screenshot) and DoD 9 (Hebrew check) are N/A for every task here** — this is test-infrastructure only; no user-facing pixel or string changes. Stated explicitly rather than skipped silently.
- **DoD 10 (safety invariance) holds trivially and is named per task:** no task touches `app.js`, `data.py`, `build.py`, or any `bcheck`/`temp`/`safe`/duration value. The suite's existing safety specs (`safety-invariant.spec.ts`, `wave0-safety.spec.ts`, `cure-scale-guard.spec.ts`, …) run green in every task's gate — that is the assertion.
- **Ephemeral contexts only** (W0-a): `launchPersistentContext` must not appear anywhere.
- **Suite arithmetic for gates:** today `npx playwright test --list` reports **433 tests in 85 files**. After Task 1: **437** (433 + 4 warm-fixture tests). After Task 6: **438** (+1 flip test). Tasks 7–8: **438**.

## Sequencing gate — why the flip is LAST (read before starting)

The brief's constraint #1 is **"sequence so `main` never breaks."** Flipping the default `page` to the warm page while 84 files still call `page.addInitScript` would either (a) trip the trap in every un-migrated file → a mostly-red suite, or (b) without the trap, stack up to ~54 per-test init scripts on the shared page in **documented-undefined order** (research Q2 — the landmine) → heisen-failures. Both violate the constraint. Therefore:

1. **Task 1** builds and TDDs the complete warm machinery under its own fixture names (`warm`, `warmPage`, `warmContext`, `isolatedPage`, `seedApp`) — the default `page` keeps today's exact behavior. The machinery is NOT inert: `tests/warm-fixture.spec.ts` exercises it in every suite run from this commit on (`no-inert-shipment` satisfied by a real, running consumer).
2. **Task 2** routes the three special specs to `isolatedPage` **before** any default changes (pre-flip, `isolatedPage` ≡ today's `page`, so this is a pure refactor).
3. **Tasks 3–5** migrate all remaining specs to `seedApp`, in three reviewable batches, each ending suite-green. `seedApp` is deliberately **self-contained on a classic page too** (it navigates first if the page is not on the app origin), so a migrated file is correct under BOTH the old and new default — during this window a migrated test pays one extra navigation (goto+reload instead of goto), a bounded, temporary cost that buys zero-risk sequencing.
4. **Task 6 — the flip** — is a one-body change (`page` → the `warm` wrapper) once `grep` proves zero `addInitScript` call sites remain outside `tests/_fixtures.ts` and the three escape-hatched files. This is where the W0-c win lands for the whole suite.
5. **Task 7** carries the L21/config-comment corrections; **Task 8** is the full-suite parity gate with the wall-time record.

Any deviation that would waive/reinterpret a requirement (e.g. "skip the trap", "flip early", "touch serve.js after all") goes to the owner **in conversation** first (§4 Waiver Gate).

---

## Init-pattern inventory (the survey — evidence, 2026-07-23)

Repo facts measured for this plan: **85 spec files, 433 tests** (`npx playwright test --list`), **154 `page.goto` call sites — every one targets `'/index.html'`**, **145 `addInitScript` call sites in 84 files** (only `occ-css-tokens.spec.ts` navigates without seeding), **all 85 files import `{ test, expect }` from `./_fixtures`** (zero direct `@playwright/test` imports — the fixture core reaches every spec from one file). One `test.use()` (equipment-walkthrough, viewport), one `page.on(...)` listener (ai-model-registry console tap), one `page.clock` user (waveB-datetime), two mid-test `page.reload()` users (occupancy-unknown-footprint:104, scheduler-placement:191 — both re-seed patterns), zero `context.`/popup/dialog/`goBack` usage.

### The distinct patterns and their exact replacements

**IP-1 — inline literal seed + goto** (the majority shape; e.g. `kosher`, `prefs`, `copilot`, `wave1-*`, `occ-silhouette`, `setpoint-fence`, …):

```ts
// BEFORE (canonical)
await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
await page.goto('/index.html');
// AFTER
await seedApp(page, { 'mk-uilevel-asked': 'true' });
```

Rule: each `localStorage.setItem(K, JSON.stringify(V))` becomes a kv entry `K: JSON.stringify(V)` **evaluated in Node at the call site** so the stored bytes are identical (`JSON.stringify(true)` → `'true'`, `JSON.stringify('he')` → `'"he"'`). Any `waitForFunction` after the goto stays exactly where it is.

**IP-2 — parameterized seed + goto** (~30 files: the `occ-*`/`occupancy-*`/equipment families, `adaptive-home`, `timeline-enhancements`, `cart-quantity`, `scheduler-placement`, …). Canonical example, `tests/occ-view-bay.spec.ts:2-12`:

```ts
// BEFORE
const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
// AFTER
const boot = async (page: any, kit: any[]) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify(kit),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof occupancyDevHtml==='function'`);
};
```

Single-argument variant (`tests/timeline-enhancements.spec.ts:5-9`): `addInitScript((e:string)=>{…setItem('mk-events', e)…}, ev(keys)); goto` → `seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': ev(keys) })` (`ev()` already returns the JSON string).

**IP-3 — `beforeEach` seed + per-test goto (split shape)** — 4 files after the escape hatch: `order-effect`, `regressions`, `smoke`, `workplan`. The beforeEach becomes a `seedApp` call (which already reloads), and each test's **leading** `await page.goto('/index.html');` line is **deleted** (it would be a redundant second navigation). Canonical, `tests/smoke.spec.ts:4-12`:

```ts
// BEFORE
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});
test('home loads and bottom nav switches screens', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#scr-home')).toBeVisible();
// AFTER
test.beforeEach(async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
});
test('home loads and bottom nav switches screens', async ({ page }) => {
  await expect(page.locator('#scr-home')).toBeVisible();
```

A goto that is NOT the first statement of a test body (a deliberate mid-test re-navigation) is kept — see "mid-test navigation semantics" below.

**IP-4 — re-seed mid-test** (`adaptive-home.spec.ts:218`, `equipplan-seam.spec.ts:115`, `occupancy-unknown-footprint.spec.ts:95+104`, `scheduler-placement.spec.ts:185+191`): a second `addInitScript(seed2)` followed by `page.reload()` or `page.goto('/index.html')` → one call, `await seedApp(page, kv2);` (seedApp both seeds and reloads — the pair collapses).

**IP-5 — no-`clear()` seed** (`data-integrity.spec.ts:5`, `wave0-safety.spec.ts:10`): today they set keys without clearing, which on a fresh per-test context is indistinguishable from clear+set (the context started empty). Replacement is the standard `await seedApp(page, { 'mk-uilevel-asked': 'true' });` — the clear inside seedApp makes the previously-implicit "empty except these keys" contract explicit, exactly as the research doc prescribes (D3).

**IP-6 — bare goto, no seed** (`occ-css-tokens.spec.ts` only): `await page.goto('/index.html');` → `await seedApp(page);` (empty kv = clear-everything reset; preserves today's "boot with empty storage" semantics, which on a shared warm page a bare goto would NOT).

**IP-7 — window/navigator patch inside the seed** (`waveA-alarms.spec.ts:6-12` only — the vibrate stub). `mkVibrate` reads `navigator.vibrate` at CALL time, not boot time (`app.js:2368`: `function mkVibrate(pat){ try{ if(navigator.vibrate) navigator.vibrate(pat||[200,100,200]); }catch(e){} }`), so a post-reload patch is behaviorally identical:

```ts
// BEFORE (tests/waveA-alarms.spec.ts:6-12)
const init = async (page: any, stubVibrate = false) => {
  await page.addInitScript((stub: boolean) => {
    if (stub) { try { Object.defineProperty(navigator, 'vibrate', { value: (p: any) => { (window as any).__vib = ((window as any).__vib || []).concat([p]); return true; }, configurable: true }); } catch {} }
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  }, stubVibrate);
  await page.goto('/index.html');
};
// AFTER
const init = async (page: any, stubVibrate = false) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  if (stubVibrate) await page.evaluate(() => {
    try { Object.defineProperty(navigator, 'vibrate', { value: (p: any) => { (window as any).__vib = ((window as any).__vib || []).concat([p]); return true; }, configurable: true }); } catch {}
  });
};
```

**IP-8 — escape hatches (NOT migrated to seedApp; routed to `isolatedPage` in Task 2):**
- `tests/waveB-datetime.spec.ts` — `page.clock.setFixedTime` before goto; clock installs are init-script-based and would persist on a shared page, poisoning every later test in the worker (research Q2 table).
- `tests/service-worker.spec.ts` — the dedicated `service-worker` project (`serviceWorkers: 'allow'`); its 2 tests must keep real per-test SW registration in a built-in context.
- `tests/equipment-walkthrough.spec.ts` — `test.use({ viewport: { width: 430, height: 920 } })` (its screenshots are the deliverable). A worker-scoped warm context is created ONCE with the project's 390×844 and cannot honor a per-file test-scoped option; on the warm page the file's screenshots would silently shrink with no assertion failing. `isolatedPage` rides the built-in context, where `test.use` applies.

**Mid-test navigation semantics (document once, applies everywhere):** after the flip, a spec-authored `page.goto('/index.html')` or `page.reload()` mid-test still works on the warm page — it is a normal full navigation (fresh document + JS heap, same V8 isolate → still isolate-cache-fast per W0). localStorage persists across it exactly as it always has within a test; the NEXT test's `seedApp` is what resets it. The fixture keeps the `waitUntil:'domcontentloaded'` default on every `goto` (absorbed from the old `_fixtures.ts`).

### Full 85-file disposition table (coverage proof — every file accounted for)

| Disposition | Files | Count |
|---|---|---|
| **Batch 1 (Task 3)** — occupancy + equipment family | contention-per-slot, cooker-ambiguity, equip-chooser, equipment, equipment-form-validation, equipment-props, equipment-visibility, equipplan-seam, occ-css-tokens (IP-6), occ-devname, occ-fit-ladder, occ-setpoint-delta, occ-silhouette, occ-view-bay, occ-view-cabinet, occ-view-grill, occ-view-offset, occ-view-vessel, occupancy-clash, occupancy-hanging, occupancy-model, occupancy-multievent, occupancy-oven, occupancy-slots, occupancy-sv-volume, occupancy-unknown-footprint (IP-4), occupancy-view, thermal-ceiling | 28 |
| **Batch 2 (Task 4)** — core + schedulers + waves 0–3 | active-hub, adaptive-home (IP-4), cart-quantity, copilot, cure-scale-guard, data-integrity (IP-5), hebrew-cooker-term, kosher, order-effect (IP-3), prefs, regressions (IP-3), safety-invariant, scale-res-chip, scheduler-placement (IP-4), scheduler-planschedule, setpoint-fence, smoke (IP-3), timeline-enhancements, workplan (IP-3), wave0-safety (IP-5), wave1-a11y, wave1-theme, wave1-ux, wave2-combined, wave2-foundations, wave2-multievent, wave2-timers, wave3 | 28 |
| **Batch 3 (Task 5)** — AI + waves 4–5 + waveA–F + i18n | ai-model-registry (has the console-tap listener — cleanup covered by the fixture), ai-trust, ai-validators, wave3-ai-hardening, wave4-a11y-depth, wave4-builder-consolidation, wave4-ux-batch2, wave4-ux-batch3, wave4-ux-polish, wave5-desc-offline, wave5-i18n-coverage, wave5-i18n-dict, wave5-i18n-foundation, wave5-lang-switcher, wave5-mt-hydrate, wave5-mt-safety, wave5-recipe-i18n, wave-a-alarm-banner, waveA-alarms (IP-7), waveCD-safety-storage, waveDF-legibility, waveE-multievent-pro, waveE2-shopping-legibility, waveE6-evload-safety, i18n-foundation, wizard-date-locale | 26 |
| **Escape hatch (Task 2)** — `isolatedPage`, addInitScript kept | equipment-walkthrough, service-worker, waveB-datetime | 3 |
| **New (Task 1)** — seedApp-native from birth | warm-fixture | (+1) |

28 + 28 + 26 + 3 = **85** ✓. Pattern tags above are survey-confirmed leads; each batch applies the per-site rules IP-1…IP-7 to whatever mix a file actually contains (files can mix patterns — e.g. `regressions` is IP-3 for its beforeEach plus IP-1/IP-4 at mid-test sites), with the batch's grep gate proving completeness.

---

### Task 1: The fixture core — warm machinery + `seedApp` + `isolatedPage` (default `page` unchanged)

Build the complete warm-page machinery in `tests/_fixtures.ts` under its own names, TDD'd by a new contract spec. The default `page` fixture keeps today's exact behavior (classic per-test page, DCL goto default) — the flip is Task 6.

**Files:**
- Modify: `tests/_fixtures.ts` (full rewrite — the old 28-line file's single behavior, the DCL goto default, is absorbed as `dclGoto()`)
- Test: `tests/warm-fixture.spec.ts` (create)

**Interfaces:**
- Consumes: `@playwright/test` `base.extend`, the built-in `browser`/`context`/`page` fixtures, `workerInfo.project.use`.
- Produces (relied on by every later task):
  - fixture `warmContext: BrowserContext` (worker-scoped; ephemeral; project-faithful options; one tracing session)
  - fixture `warmPage: Page` (worker-scoped; ONE cold `goto('/index.html')`; `addInitScript` trapped; DCL goto default)
  - fixture `warm: Page` (test-scoped wrapper: closed-page guard, trace chunk per test, `__mkWarmServed` counter, listener/cookie cleanup) — **Task 6 aliases `page` to this**
  - fixture `isolatedPage: Page` (fresh page in the test's built-in context; DCL goto default; closed in teardown)
  - `export async function seedApp(page: Page, kv: Record<string, string> = {}): Promise<void>` — kv values are the EXACT strings stored (callers pass `JSON.stringify(v)` where today's seeds did)
  - unchanged exports: `test`, `expect`, `type Page`

- [ ] **Step 1: Write the failing contract spec**

Create `tests/warm-fixture.spec.ts`:

```ts
import { test, expect, seedApp } from './_fixtures';

// Contract spec for the warm-page architecture (docs/research/warm-page-architecture-research.md as
// amended by W0). Serial on purpose: A then B MUST land on the same worker and the same warm page —
// the reuse+reset contract is exactly what is under test here.
test.describe.configure({ mode: 'serial' });

test('A: seeds its own state onto the warm page and leaves a JS-heap marker', async ({ warm: page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-warm-proof-a': '"A"' });
  expect(await page.evaluate(`localStorage.getItem('mk-warm-proof-a')`)).toBe('"A"');
  expect(await page.evaluate(`typeof DATA !== 'undefined'`)).toBe(true);   // the app actually booted at DCL
  await page.evaluate(`window.__warmHeapMarker = 'set-by-A'`);
  expect(await page.evaluate(`window.__warmHeapMarker`)).toBe('set-by-A');
});

test('B: same worker, same page — A\'s storage and heap are GONE after the standard reset', async ({ warm: page }) => {
  // The very same Page object crossed tests (reuse), yet nothing of A survives (reset):
  expect((page as any).__mkWarmServed).toBeGreaterThanOrEqual(2);
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-warm-proof-b': '"B"' });
  expect(await page.evaluate(`localStorage.getItem('mk-warm-proof-a')`)).toBeNull();      // storage isolation
  expect(await page.evaluate(`localStorage.getItem('mk-warm-proof-b')`)).toBe('"B"');
  expect(await page.evaluate(`typeof window.__warmHeapMarker`)).toBe('undefined');        // fresh JS heap (reload re-runs the app from zero)
});

test('the warm page traps addInitScript with a migration hint', async ({ warm: page }) => {
  expect(() => (page as any).addInitScript(() => {})).toThrow(/seedApp|isolatedPage/);
});

test('isolatedPage: fresh classic context — storage not shared, addInitScript allowed', async ({ warm, isolatedPage }) => {
  await seedApp(warm, { 'mk-uilevel-asked': 'true', 'mk-warm-proof-x': '"X"' });
  await isolatedPage.addInitScript(() => { try { localStorage.setItem('mk-iso-proof', '"I"'); } catch {} });   // must NOT throw
  await isolatedPage.goto('/index.html');
  expect(await isolatedPage.evaluate(`localStorage.getItem('mk-warm-proof-x')`)).toBeNull();   // separate storage
  expect(await isolatedPage.evaluate(`localStorage.getItem('mk-iso-proof')`)).toBe('"I"');     // classic seeding path intact
});
```

- [ ] **Step 2: Run the spec to verify it fails (RED witnessed)**

Run: `npx playwright test tests/warm-fixture.spec.ts`
Expected: FAIL — `_fixtures` has no exported member `seedApp` (TS load error) / unknown fixture `warm`. Paste the output. This is the intended reason: the machinery does not exist yet.

- [ ] **Step 3: Write the implementation — full new `tests/_fixtures.ts`**

Replace the entire file with:

```ts
// Shared test fixtures — the WARM-PAGE architecture core.
// Design: docs/research/warm-page-architecture-research.md, amended by the W0 measured decisions
// (docs/superpowers/plans/2026-07-23-warm-page-architecture.md): EPHEMERAL worker contexts only
// (launchPersistentContext measured WORSE — 1788ms vs 1028ms p50), serve.js untouched (200-vs-304
// measured identical; the reload win is V8's in-isolate source-keyed compilation cache).
//
// Shape:
//   warmContext (worker) — ONE ephemeral context per worker, project-faithful options, one tracing session.
//   warmPage    (worker) — ONE page, ONE cold goto('/index.html') per worker; addInitScript TRAPPED.
//   warm        (test)   — per-test wrapper: guard + trace chunk (startChunk/stopChunk — the #14027 cure
//                          for retain-on-failure on a shared context) + listener/cookie cleanup.
//   isolatedPage (test)  — escape hatch: fresh page in the test's BUILT-IN context (per-test isolation,
//                          config trace:'retain-on-failure' and per-file test.use options apply normally).
//   seedApp(page, kv)    — THE per-test reset: clear storage → set kv → reload (DCL). Self-contained on
//                          classic pages too (navigates first if off-origin) so migration can proceed
//                          file-by-file with main green; the warm default lands in the flip (Task 6).
//   page (default)       — STILL the classic per-test page with the DCL-goto default (absorbed from the
//                          previous version of this file). Task 6 replaces this body with the warm page.
//
// Isolation guarantees relied on (all official): a failing test shuts its worker down ("Workers are
// always shutdown after a test failure" — test-parallel docs) so a corrupted warm page can never leak
// forward; init-script ordering across accumulated scripts is UNDEFINED and irremovable (class-page
// docs) — hence the hard trap instead of a convention.
import { test as base, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';

// Every goto defaults to 'domcontentloaded' — the app is a single synchronous inline script, fully
// interactive at DCL; 'load' only waited on fonts/icons and blew timeouts under contention
// (docs/research/playwright-reliability-research.md). Callers may still pass waitUntil explicitly.
function dclGoto(page: Page): void {
  const orig = page.goto.bind(page);
  (page as Page & { goto: Page['goto'] }).goto = ((url: string, opts?: Parameters<Page['goto']>[1]) =>
    orig(url, { waitUntil: 'domcontentloaded', ...(opts || {}) })) as Page['goto'];
}

type WarmWorkerFixtures = { warmContext: BrowserContext; warmPage: Page };
type WarmTestFixtures = { warm: Page; isolatedPage: Page };

export const test = base.extend<WarmTestFixtures, WarmWorkerFixtures>({
  // ONE ephemeral context per worker (W0-a: STAY-ON-A — never launchPersistentContext).
  warmContext: [async ({ browser }, use, workerInfo) => {
    // browser.newContext() does NOT read the config's `use` block (that is the built-in context
    // fixture's job) — pass the project options through explicitly so each project (chromium /
    // service-worker) gets its own viewport/SW policy/baseURL, and set the navigation timeout the
    // built-in context would have had.
    const u = workerInfo.project.use as Record<string, any>;
    const context = await browser.newContext({
      viewport: u.viewport, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor,
      isMobile: u.isMobile, hasTouch: u.hasTouch, serviceWorkers: u.serviceWorkers, baseURL: u.baseURL,
    });
    if (u.navigationTimeout) context.setDefaultNavigationTimeout(u.navigationTimeout);
    // One tracing session per worker; per-test retain-on-failure is delivered via CHUNKS in `warm`
    // (playwright #14027: naive per-test tracing breaks on a shared context; chunks are the cure).
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await use(context);
    await context.tracing.stop();   // §11a: every setup owns its teardown
    await context.close();
  }, { scope: 'worker' }],

  warmPage: [async ({ warmContext }, use) => {
    const page = await warmContext.newPage();
    dclGoto(page);
    await page.goto('/index.html');   // THE one cold parse for this worker (W0-c: every later boot is a ~1028ms warm reload)
    // HARD TRAP. Init scripts accumulate for the life of the page, run in DOCUMENTED-UNDEFINED order
    // across scripts, and cannot be removed (class-page docs) — on a shared page that is a coin flip,
    // so warm mode forbids them loudly instead of by convention.
    (page as unknown as { addInitScript: () => never }).addInitScript = () => {
      throw new Error(
        'warm page: page.addInitScript is forbidden on the shared warm page (scripts accumulate for the ' +
        'whole worker and their ordering is documented-undefined). Migrate this spec: seed localStorage ' +
        'with seedApp(page, kv) instead of addInitScript+goto — or use the isolatedPage fixture if the ' +
        'test genuinely needs per-test isolation (init scripts, page.clock, per-file test.use options).');
    };
    await use(page);
  }, { scope: 'worker' }],

  // Per-test wrapper around the shared page. Task 6 aliases the default `page` to this.
  warm: async ({ warmPage, warmContext }, use, testInfo) => {
    if (warmPage.isClosed())
      throw new Error('warm page was closed by an earlier test — failing so Playwright restarts the ' +
        'worker with a fresh warm page (guard for playwright #16677; worker-shutdown-on-failure is the quarantine).');
    await warmContext.tracing.startChunk({ title: testInfo.titlePath.join(' › ') });
    (warmPage as any).__mkWarmServed = ((warmPage as any).__mkWarmServed || 0) + 1;   // reuse observable by the contract spec
    await use(warmPage);
    // Between-tests cleanup (§11a setup⟺teardown): drop per-test listeners (e.g. console taps) and
    // clear context-wide state a reload cannot reset. App uses no cookies — the clear is defensive.
    await (warmPage as any).removeAllListeners(undefined, { behavior: 'wait' });
    await warmContext.clearCookies();
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) {
      const tracePath = testInfo.outputPath('trace.zip');
      await warmContext.tracing.stopChunk({ path: tracePath });        // retain-on-failure, chunk-style
      testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
    } else {
      await warmContext.tracing.stopChunk();                           // pass → discard (parity with retain-on-failure)
    }
  },

  // Escape hatch: a fresh page in the test's own BUILT-IN context — full per-test isolation; the
  // config's `use` options, per-file test.use overrides, and automatic trace:'retain-on-failure'
  // all apply here exactly as they did to the classic `page`.
  isolatedPage: async ({ context }, use) => {
    const page = await context.newPage();
    dclGoto(page);
    await use(page);
    await page.close();   // §11a: the setup owns its teardown
  },

  // DEFAULT PAGE — unchanged behavior until Task 6 (the flip): classic per-test page + DCL goto default.
  page: async ({ page }, use) => {
    dclGoto(page);
    await use(page);
  },
});

/**
 * The per-test reset for the warm architecture — replaces addInitScript(seed)+goto('/index.html').
 * kv values are the EXACT strings stored (callers keep JSON.stringify(...) at the call site so the
 * stored bytes are byte-identical to the old seeds). Self-contained on BOTH page kinds:
 *   - warm page (already on /index.html): clear+set → reload — ONE navigation (~1028ms p50, W0).
 *   - classic page (about:blank, migration window): goto first, then clear+set → reload — correct,
 *     temporarily two navigations; the flip (Task 6) makes the one-navigation path the default.
 * After it resolves the app has fully re-initialized (DCL; the inline script is synchronous) reading
 * exactly the seeded state — indistinguishable from the old init-script boot for this
 * localStorage-only app (research Q2).
 */
export async function seedApp(page: Page, kv: Record<string, string> = {}): Promise<void> {
  if (!page.url().includes('/index.html'))
    await page.goto('/index.html');   // DCL default via dclGoto
  await page.evaluate((kv) => {
    localStorage.clear();
    sessionStorage.clear();   // app never writes it (0 refs) — defensive: it survives reload
    window.name = '';         // survives navigation — zero it
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, kv);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export { expect };
export type { Page };
```

- [ ] **Step 4: Run the contract spec to verify it passes**

Run: `npx playwright test tests/warm-fixture.spec.ts`
Expected: PASS — 4 tests (serial, one worker).

- [ ] **Step 5: Witness the tracing chunk actually firing (evidence for the retain-on-failure arm)**

The pass path discards chunks, so the failure path needs one deliberate observation. Create a THROWAWAY spec `tests/warm-trace-probe.spec.ts` (never committed):

```ts
import { test, expect, seedApp } from './_fixtures';
test('deliberate failure to witness the per-test trace chunk', async ({ warm: page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  expect(1).toBe(2);   // forced failure
});
```

Run: `npx playwright test tests/warm-trace-probe.spec.ts`
Expected: 1 FAILED, and `test-results/warm-trace-probe-*/trace.zip` EXISTS (paste the `ls` output). Then **delete the probe file** (teardown owned: `rm tests/warm-trace-probe.spec.ts`) and confirm `git status` shows only `_fixtures.ts` + `warm-fixture.spec.ts` changed.

- [ ] **Step 6: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: **437 passed** (433 existing — all still on the classic default page, byte-identical behavior — + 4 contract tests). DoD 10: no app/data files touched. DoD 8/9 N/A (test infra).

- [ ] **Step 7: Commit**

```bash
git add tests/_fixtures.ts tests/warm-fixture.spec.ts
git commit -m "feat(test): warm-page fixture core — worker warmContext/warmPage, seedApp reset, isolatedPage, trace chunks (default page unchanged)"
```

---

### Task 2: Escape hatches — route the 3 special specs to `isolatedPage` (pre-flip refactor)

Pre-flip, `isolatedPage` is behaviorally identical to today's `page` (fresh built-in-context page + DCL default), so this is a pure rename refactor — done NOW so the Task-6 flip cannot break the clock/SW/viewport specs. These files keep `addInitScript` forever (it is legal on isolated pages).

**Files:**
- Modify: `tests/waveB-datetime.spec.ts` (every `({ page })`/`({ page }` destructure → `({ isolatedPage: page }`)
- Modify: `tests/service-worker.spec.ts` (same rename in `test.beforeEach` and both tests)
- Modify: `tests/equipment-walkthrough.spec.ts` (same rename in every test; `test.use({ viewport: … })` stays — it flows through the built-in context that `isolatedPage` rides)

**Interfaces:**
- Consumes: fixture `isolatedPage` (Task 1).
- Produces: the invariant later tasks rely on — **no test in these 3 files references the default `page` fixture**, so the Task-6 flip cannot reach them.

- [ ] **Step 1: Apply the rename**

In each of the three files, every fixture destructure changes shape (the body of every test/hook stays byte-identical):

```ts
// BEFORE (e.g. tests/service-worker.spec.ts:12, :18; tests/waveB-datetime.spec.ts tests; tests/equipment-walkthrough.spec.ts tests)
test.beforeEach(async ({ page }) => {
test('the app registers a service worker on http://localhost via its own gate, and it activates', async ({ page }) => {
// AFTER
test.beforeEach(async ({ isolatedPage: page }) => {
test('the app registers a service worker on http://localhost via its own gate, and it activates', async ({ isolatedPage: page }) => {
```

TDD note: this is a behavior-preserving refactor — the three specs THEMSELVES are the harness (DoD 2 RED is N/A for a rename; stated explicitly, not skipped).

- [ ] **Step 2: Verify the rename is complete (grep gate)**

Run: `grep -n "({ page }" tests/waveB-datetime.spec.ts tests/service-worker.spec.ts tests/equipment-walkthrough.spec.ts`
Expected: no matches.

- [ ] **Step 3: Targeted run of the three files**

Run: `npx playwright test tests/waveB-datetime.spec.ts tests/service-worker.spec.ts tests/equipment-walkthrough.spec.ts`
Expected: all pass (both projects — service-worker runs in its own project). Spot-check the walkthrough screenshots in `mockups/walkthrough/` are still 430×920-framed (its own comment documents why that size).

- [ ] **Step 4: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: **437 passed**. DoD 10 named: no app/data change. DoD 8/9 N/A.

- [ ] **Step 5: Commit**

```bash
git add tests/waveB-datetime.spec.ts tests/service-worker.spec.ts tests/equipment-walkthrough.spec.ts
git commit -m "refactor(test): route clock/SW/viewport specs to isolatedPage (warm-page escape hatches, pre-flip)"
```

---

### Task 3: Migration batch 1 — occupancy + equipment family (28 files)

Apply the IP-rules to the 28 Batch-1 files from the disposition table. Dominant shape: IP-2 (parameterized `boot(page, kit)` helpers). Outliers in this batch: `occ-css-tokens` (IP-6 — bare goto → `seedApp(page)`), `occupancy-unknown-footprint` (IP-4 at lines ~95+104 — addInitScript+`page.reload()` pair → one `seedApp(page, kv2)`).

**Files:**
- Modify: the 28 Batch-1 spec files (list in the disposition table; seeding/navigation lines only — every `expect` stays byte-identical)

**Interfaces:**
- Consumes: `seedApp(page, kv)` (Task 1; kv values are the exact stored strings — keep `JSON.stringify(...)` at call sites).
- Produces: 28 files with **zero** `addInitScript` call sites.

- [ ] **Step 1: Transform each file per the IP-rules**

For every file: add `seedApp` to the `./_fixtures` import, apply IP-1/IP-2/IP-4/IP-6 per call site exactly as specified in the inventory section (worked example for this batch's dominant shape: the `occ-view-bay.spec.ts` before/after under IP-2). `waitForFunction` lines and all assertions stay untouched.

- [ ] **Step 2: Grep gate — batch completeness**

Run: `grep -ln "addInitScript" tests/contention-per-slot.spec.ts tests/cooker-ambiguity.spec.ts tests/equip-chooser.spec.ts tests/equipment.spec.ts tests/equipment-form-validation.spec.ts tests/equipment-props.spec.ts tests/equipment-visibility.spec.ts tests/equipplan-seam.spec.ts tests/occ-css-tokens.spec.ts tests/occ-devname.spec.ts tests/occ-fit-ladder.spec.ts tests/occ-setpoint-delta.spec.ts tests/occ-silhouette.spec.ts tests/occ-view-bay.spec.ts tests/occ-view-cabinet.spec.ts tests/occ-view-grill.spec.ts tests/occ-view-offset.spec.ts tests/occ-view-vessel.spec.ts tests/occupancy-clash.spec.ts tests/occupancy-hanging.spec.ts tests/occupancy-model.spec.ts tests/occupancy-multievent.spec.ts tests/occupancy-oven.spec.ts tests/occupancy-slots.spec.ts tests/occupancy-sv-volume.spec.ts tests/occupancy-unknown-footprint.spec.ts tests/occupancy-view.spec.ts tests/thermal-ceiling.spec.ts`
Expected: no matches.

- [ ] **Step 3: Targeted run of the batch**

Run: `npx playwright test tests/occ-css-tokens.spec.ts tests/occ-devname.spec.ts tests/occ-fit-ladder.spec.ts tests/occ-setpoint-delta.spec.ts tests/occ-silhouette.spec.ts tests/occ-view-bay.spec.ts tests/occ-view-cabinet.spec.ts tests/occ-view-grill.spec.ts tests/occ-view-offset.spec.ts tests/occ-view-vessel.spec.ts tests/occupancy-clash.spec.ts tests/occupancy-hanging.spec.ts tests/occupancy-model.spec.ts tests/occupancy-multievent.spec.ts tests/occupancy-oven.spec.ts tests/occupancy-slots.spec.ts tests/occupancy-sv-volume.spec.ts tests/occupancy-unknown-footprint.spec.ts tests/occupancy-view.spec.ts tests/thermal-ceiling.spec.ts tests/contention-per-slot.spec.ts tests/cooker-ambiguity.spec.ts tests/equip-chooser.spec.ts tests/equipment.spec.ts tests/equipment-form-validation.spec.ts tests/equipment-props.spec.ts tests/equipment-visibility.spec.ts tests/equipplan-seam.spec.ts`
Expected: all pass. (TDD note: behavior-preserving refactor — the batch's own specs are the harness; DoD 2 RED N/A, stated.)

- [ ] **Step 4: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: **437 passed** (migration window: these files run seedApp on the classic page — goto+seed+reload — correct, temporarily one extra navigation each). DoD 10 named: safety specs in other batches still green; no app/data change. DoD 8/9 N/A.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "refactor(test): warm-migration batch 1 — occupancy/equipment family init → seedApp (28 files)"
```

---

### Task 4: Migration batch 2 — core + schedulers + waves 0–3 (28 files)

Same procedure as Task 3 for the 28 Batch-2 files. This batch holds most of the enumerated outliers: IP-3 split files (`smoke`, `regressions`, `order-effect`, `workplan` — beforeEach → `seedApp`, delete each test's LEADING `page.goto('/index.html')` line only), IP-5 no-clear files (`data-integrity`, `wave0-safety`), IP-4 re-seed sites (`adaptive-home:218`, `scheduler-placement:185+191`), and the heaviest-init specs (`active-hub`, `adaptive-home`) named in §11a.

**Files:**
- Modify: the 28 Batch-2 spec files (disposition table; seeding/navigation lines only)

**Interfaces:**
- Consumes: `seedApp(page, kv)` (Task 1).
- Produces: 28 more files with zero `addInitScript` call sites.

- [ ] **Step 1: Transform each file per the IP-rules** (worked examples for this batch's shapes: `smoke.spec.ts` under IP-3, `data-integrity` note under IP-5, IP-4 collapse rule)

- [ ] **Step 2: Grep gate**

Run: `grep -ln "addInitScript" tests/active-hub.spec.ts tests/adaptive-home.spec.ts tests/cart-quantity.spec.ts tests/copilot.spec.ts tests/cure-scale-guard.spec.ts tests/data-integrity.spec.ts tests/hebrew-cooker-term.spec.ts tests/kosher.spec.ts tests/order-effect.spec.ts tests/prefs.spec.ts tests/regressions.spec.ts tests/safety-invariant.spec.ts tests/scale-res-chip.spec.ts tests/scheduler-placement.spec.ts tests/scheduler-planschedule.spec.ts tests/setpoint-fence.spec.ts tests/smoke.spec.ts tests/timeline-enhancements.spec.ts tests/workplan.spec.ts tests/wave0-safety.spec.ts tests/wave1-a11y.spec.ts tests/wave1-theme.spec.ts tests/wave1-ux.spec.ts tests/wave2-combined.spec.ts tests/wave2-foundations.spec.ts tests/wave2-multievent.spec.ts tests/wave2-timers.spec.ts tests/wave3.spec.ts`
Expected: no matches.

- [ ] **Step 3: Targeted run of the batch** (same 28 files as Step 2's list, as `npx playwright test` file arguments)
Expected: all pass.

- [ ] **Step 4: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: **437 passed**. DoD 10 named: `safety-invariant.spec.ts`, `wave0-safety.spec.ts`, `cure-scale-guard.spec.ts` are IN this batch — their unchanged assertions passing IS the safety-invariance evidence. DoD 8/9 N/A.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "refactor(test): warm-migration batch 2 — core + waves 0-3 init → seedApp (28 files)"
```

---

### Task 5: Migration batch 3 — AI + waves 4–5 + waveA–F + i18n (26 files)

Same procedure for the 26 Batch-3 files. Outlier in this batch: `waveA-alarms` (IP-7 — the vibrate stub moves to a post-reload `page.evaluate`, exact code in the inventory; equivalence proven by `app.js:2368` reading `navigator.vibrate` at call time). `ai-model-registry.spec.ts:74`'s `page.on('console')` tap needs no edit — the warm wrapper's `removeAllListeners` covers it after the flip; pre-flip the classic page dies with the test as always.

**Files:**
- Modify: the 26 Batch-3 spec files (disposition table; seeding/navigation lines only)

**Interfaces:**
- Consumes: `seedApp(page, kv)` (Task 1).
- Produces: **zero `addInitScript` call sites remain outside `tests/_fixtures.ts` and the 3 escape-hatched files** — the precondition Task 6 gates on.

- [ ] **Step 1: Transform each file per the IP-rules** (worked example: `waveA-alarms` under IP-7)

- [ ] **Step 2: Grep gate — batch AND global completeness (the flip precondition)**

Run: `grep -rln "addInitScript" tests/`
Expected output — exactly these four (the trap definition + the escape hatches):
```
tests/_fixtures.ts
tests/equipment-walkthrough.spec.ts
tests/service-worker.spec.ts
tests/waveB-datetime.spec.ts
```

- [ ] **Step 3: Targeted run of the batch**

Run: `npx playwright test tests/ai-model-registry.spec.ts tests/ai-trust.spec.ts tests/ai-validators.spec.ts tests/wave3-ai-hardening.spec.ts tests/wave4-a11y-depth.spec.ts tests/wave4-builder-consolidation.spec.ts tests/wave4-ux-batch2.spec.ts tests/wave4-ux-batch3.spec.ts tests/wave4-ux-polish.spec.ts tests/wave5-desc-offline.spec.ts tests/wave5-i18n-coverage.spec.ts tests/wave5-i18n-dict.spec.ts tests/wave5-i18n-foundation.spec.ts tests/wave5-lang-switcher.spec.ts tests/wave5-mt-hydrate.spec.ts tests/wave5-mt-safety.spec.ts tests/wave5-recipe-i18n.spec.ts tests/wave-a-alarm-banner.spec.ts tests/waveA-alarms.spec.ts tests/waveCD-safety-storage.spec.ts tests/waveDF-legibility.spec.ts tests/waveE-multievent-pro.spec.ts tests/waveE2-shopping-legibility.spec.ts tests/waveE6-evload-safety.spec.ts tests/i18n-foundation.spec.ts tests/wizard-date-locale.spec.ts`
Expected: all pass.

- [ ] **Step 4: Full suite (DoD 12)**

Run: `npx playwright test`
Expected: **437 passed**. DoD 10 named: no app/data change; `waveCD-safety-storage`/`waveE6-evload-safety` in this batch pass unchanged. DoD 8/9 N/A.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "refactor(test): warm-migration batch 3 — AI + waves 4-5 + A-F init → seedApp (26 files)"
```

---

### Task 6: THE FLIP — the default `page` becomes the warm page

One-body change in `tests/_fixtures.ts`, TDD'd by a new contract test. From this commit, every migrated test boots via a ~1028 ms warm reload instead of a ~2155 ms cold goto (W0-c), 8 cold parses per run instead of 433.

**Files:**
- Modify: `tests/_fixtures.ts` (the `page` override body only)
- Test: `tests/warm-fixture.spec.ts` (append 1 test)

**Interfaces:**
- Consumes: fixtures `warm`, `warmPage` (Task 1); the Task-5 grep invariant (zero addInitScript outside _fixtures + escape files).
- Produces: default `page` ≡ `warm` for every spec that uses `page`. `isolatedPage` and mid-test `page.goto`/`page.reload` semantics unchanged (documented in the inventory section).

- [ ] **Step 1: Write the failing test (RED)**

Append to `tests/warm-fixture.spec.ts`:

```ts
test('after the flip: the DEFAULT page IS the warm page', async ({ page }) => {
  expect((page as any).__mkWarmServed).toBeGreaterThanOrEqual(1);            // served by the warm wrapper
  expect(() => (page as any).addInitScript(() => {})).toThrow(/seedApp/);    // trapped ⇒ warm, not classic
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  expect(await page.evaluate(`typeof DATA !== 'undefined'`)).toBe(true);     // app fully booted post-reset
});
```

- [ ] **Step 2: Run it to verify it fails (RED witnessed)**

Run: `npx playwright test tests/warm-fixture.spec.ts`
Expected: the new test FAILS — `__mkWarmServed` is `undefined` on the classic page (and classic `addInitScript` does not throw). Paste the output.

- [ ] **Step 3: Flip the override**

In `tests/_fixtures.ts`, replace the `page` override body:

```ts
// BEFORE
  // DEFAULT PAGE — unchanged behavior until Task 6 (the flip): classic per-test page + DCL goto default.
  page: async ({ page }, use) => {
    dclGoto(page);
    await use(page);
  },
// AFTER
  // THE FLIP (2026-07-23): the default page IS the worker-warm page. Per-test reset = seedApp(page, kv).
  // Mid-test page.goto('/index.html') / page.reload() still work — normal full navigations on the warm
  // page (fresh document + JS heap, same V8 isolate → still isolate-cache-fast, W0); localStorage
  // persists across them within a test exactly as before; the NEXT test's seedApp is the reset.
  // Per-test isolation lives in the isolatedPage fixture (clock / SW project / test.use specs).
  page: async ({ warm }, use) => {
    await use(warm);
  },
```

- [ ] **Step 4: Run the contract spec to verify it passes**

Run: `npx playwright test tests/warm-fixture.spec.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Full suite (DoD 12) + first wall-time reading**

Preconditions per §11a: idle machine, no manual serve.js on :8123, no other heavy agents. Run: `npx playwright test`
Expected: **438 passed**, and note the reported wall time (baseline: ~2.3–2.5 m at 433 tests; the halved-navigation architecture should land meaningfully under it — record, do not enforce). If ANY test fails here, it is a real defect in the reset recipe for that spec — `systematic-debugging`, never a re-run, never a retry.

- [ ] **Step 6: Commit**

```bash
git add tests/_fixtures.ts tests/warm-fixture.spec.ts
git commit -m "feat(test): FLIP — default page is the worker-warm page (8 cold parses/run instead of 433)"
```

---

### Task 7: Corrections riding along — rewrite L21 + the config workers comment

Two documentation corrections the measurement programme owes: discipline **L21** asserted a "10 workers → P-core oversubscription → deterministic 10-failure" mechanism that the instrumented rerun on a verified-idle machine did **not reproduce** (contaminated-machine evidence — the same session's own zombie servers and broken probes, L18/L20), and the `playwright.config.ts` workers comment asserts the same refuted ceiling. **`workers: process.env.CI ? 2 : 8` stays byte-identical — comment-only edits.** No worker-count change in this plan (phase B/C is the controller's).

**Files:**
- Modify: `docs/process/development-discipline.md` (the L21 entry, lines ~504–510; plus a one-line supersede pointer in §11a's Concurrency bullet, line ~389)
- Modify: `playwright.config.ts` (comment block above `workers:` only, lines ~19–32)

**Interfaces:**
- Consumes: the M-series measurement artifacts under `docs/research/measurements/` (gitignored raw data — key numbers are inlined in the rewritten text, per the RUNBOOK's own rule).
- Produces: corrected documentation; no behavior change anywhere.

- [ ] **Step 1: Resolve the M1b artifact filenames (HALT gate)**

Run: `ls docs/research/measurements/`
The M1 non-reproduction artifacts exist and are cited by exact name below. The **M1b worker-count-curve** artifacts are produced by the controller's measurement phase; resolve their actual filenames now (expected label pattern `*m1b*`). **If no M1b artifact exists on disk, HALT this task and raise with the controller/owner in conversation** — the correction text must not cite evidence that is not on disk (L16/L20: never trust — or reference — an artifact you have not opened). Do not guess numbers; do not write "presumably".

- [ ] **Step 2: Rewrite L21 in `docs/process/development-discipline.md`**

Replace the existing L21 paragraph (currently: "**L21 · On a hybrid CPU, worker count ≠ logical cores — fit the P-cores (2026-07-23).** …") with the following, substituting `{M1B-FILES}` and `{M1B-SUMMARY}` with the real filenames and the pass/fail + wall-time-per-worker-count numbers read from those files in Step 1:

```markdown
**L21 · A worker ceiling measured on a contaminated machine is not a ceiling — and it cost us a wrong
"hardware truth" (2026-07-23; corrected the same day).** The original entry here asserted a mechanism:
above 8 workers the P-cores oversubscribe and the heaviest-init specs deterministically starve past the
30s timeout ("10 → 10 FAILED, always the same specs"). Re-measured under instrumentation on a
verified-idle machine, that story did NOT reproduce: **M1** (`npx playwright test --workers=10` wrapped
by the per-LP CPU sampler) ran **clean — no failure cluster** — with the P-cores far from saturated
(P-class `% Processor Utility` mean ≈69 / median ≈55; E-class mean ≈84 — the E-cores were the HOTTER
class) against an 8-worker **M0** baseline of P ≈56/36, E ≈72/70. The **M1b** worker-count curve
confirms it: {M1B-SUMMARY}. Raw artifacts (gitignored working data — which is why the numbers are
inlined here): `docs/research/measurements/cpu-sampler-m0-baseline-8w-2026-07-23T22-11-00.summary.json`,
`cpu-sampler-m1-10-workers-2026-07-23T22-14-31.summary.json`,
`census-m1-census-midrun-2026-07-23T22-15-17.csv`, {M1B-FILES}. The original "evidence" was taken on a
machine polluted by the same debugging session's own respawning zombie servers and a broken
`/usr/bin/time` probe (L18/L20) — a contaminated experiment produced a confident, specific, WRONG
mechanism, and it survived here precisely because it sounded like hardware truth. Lessons kept:
(a) a worker-ceiling measurement is only as good as the proven cleanliness of the machine under it —
verify idle (0 orphan `node`/`serve.js`, ports released) BEFORE the runs, and sample §11a's 6–9×, never
3; (b) `workers: 8` stays for now as the last known-clean setting — re-deriving the real ceiling from
the M-series curve is the CPU-max programme's **phase B/C decision (the owner's)**, not a drive-by edit.
```

Then, in §11a's Concurrency bullet (the paragraph beginning "**Concurrency:** `workers: process.env.CI ? 2 : 8`…"), append this one sentence at its end:

```markdown
**Superseded 2026-07-23 (late): the "10 → 10 FAILED / P-core oversubscription" mechanism in this bullet
was contaminated-machine evidence — see L21 (rewritten) and the config comment, which are authoritative.**
```

- [ ] **Step 3: Rewrite the `playwright.config.ts` workers comment**

Replace the comment block above `workers:` (currently lines 19–32, from `// Worker count = fit the 8 PERFORMANCE cores.` through `// mid-run (§11a setup⟺teardown). CI stays 2 …`) — the `workers: process.env.CI ? 2 : 8,` line itself stays byte-identical:

```ts
  // Worker count: 8 — an INTERIM, last-known-clean setting, NOT a derived ceiling.
  // HISTORY + CORRECTION (2026-07-23): an earlier comment here asserted a measured mechanism — ">8
  // oversubscribes the 8 P-cores; 10 workers → the same 10 heavy-init specs fail deterministically".
  // That evidence came from a CONTAMINATED session (the debugging loop's own respawning zombie servers
  // + a broken /usr/bin/time probe — discipline L18/L20) and did NOT reproduce on a verified-idle
  // machine: the instrumented M1 rerun (--workers=10 under the per-LP CPU sampler) was CLEAN, with
  // P-cores far from saturated (P-utility mean ≈69%, median ≈55%) and the E-cores the hotter class
  // (≈84%). See development-discipline.md §11 L21 (rewritten, numbers inlined) and the M0/M1/M1b
  // artifacts under docs/research/measurements/ (gitignored raw data). 8 therefore stays ONLY until the
  // CPU-max programme's phase B/C re-derives the ceiling from the M-series curve on clean evidence —
  // that change is the owner's call, made there, not here. CI stays 2 (GitHub ubuntu-latest is 4-vCPU).
  workers: process.env.CI ? 2 : 8,
```

- [ ] **Step 4: Verify no behavior change (DoD 12; a RED test is impossible for a comment/doc edit — stated, not skipped)**

Run: `git diff playwright.config.ts | grep "^[+-]" | grep -v "^[+-][+-]" | grep -v "^\s*[+-]\s*//"` — expected: only the `workers:` line appearing unchanged on both sides of the comment rewrite, i.e. **no non-comment line changed**. Then run: `npx playwright test`
Expected: **438 passed** (config parses; identical behavior).

- [ ] **Step 5: Commit**

```bash
git add docs/process/development-discipline.md playwright.config.ts
git commit -m "docs(discipline): rewrite L21 + config workers comment — the 10-worker P-core story was contaminated-machine evidence (M1/M1b correction)"
```

---

### Task 8: Final full-suite parity gate + wall-time record

The whole-programme gate: everything migrated, flipped, and corrected — one plain full run, 100% green, with the wall-time number recorded against the ~2.3–2.5 m baseline (no target enforced — record the fact).

**Files:**
- None expected (audit-only; a commit happens only if an audit uncovers a fix, which then re-runs this task from Step 1).

**Interfaces:**
- Consumes: everything above.
- Produces: the parity verdict + the wall-time number for the controller's report.

- [ ] **Step 1: Preconditions (§11a)** — machine idle, CPU-heavy background agents paused, no manual `serve.js` on :8123 (`Get-NetTCPConnection -LocalPort 8123 -State Listen -ErrorAction SilentlyContinue` → nothing), no concurrent suite run.

- [ ] **Step 2: Residual audits (grep gates)**

```
grep -rln "addInitScript" tests/            → exactly: _fixtures.ts, equipment-walkthrough, service-worker, waveB-datetime
grep -rln "launchPersistentContext" tests/  → no matches (W0-a)
git status --short serve.js                 → empty, AND git log -1 --format="%h" -- serve.js → 77cd4c7
                                              (the pre-plan commit — no commit in this plan touched serve.js; W0-b)
grep -rn "waitForTimeout" tests/            → no matches (the suite entered this plan at zero and stays at zero)
grep -ln "test.use" tests/*.spec.ts         → exactly: tests/equipment-walkthrough.spec.ts
```

- [ ] **Step 3: The gate run (DoD 12)**

Run: `npx playwright test`
Expected: **438 passed, 0 failed, 0 flaky** — paste the full tail of the output including the wall time. Any failure — including an intermittent one — is a bug: `systematic-debugging`, root cause, fix, and re-enter this task; never re-run to green.

- [ ] **Step 4: Record the wall-time delta**

State plainly in the task summary: baseline ~2.3–2.5 m (433 tests, cold-goto architecture, per the config's own history) vs the Step-3 number (438 tests, warm architecture). Expectation from W0-c: meaningfully faster from ~425 navigations dropping from ~2155 ms to ~1028 ms p50 — **record the actual number; no target is enforced by this plan.** One clean run is THIS plan's gate; the §11a 6–9× flake-profile sampling and any worker-count re-derivation belong to the controller's phase B/C (stated, not silently skipped — same for the `sync-docs.sh` graph update, which the controller runs at arc close because this plan does not push).

- [ ] **Step 5: Done report**

Report DONE / NEXT / LEFT per §10.6 with: test count, wall time, the residual-audit outputs, and the three escape-hatched files named.

---

## Self-Review (run against the research doc + the W0 overrides)

**1. Spec coverage — research doc, as amended:**
- Worker-scoped warm context/page fixture (Q1, D2) → Task 1 (`warmContext`/`warmPage`, tuple syntax, lazy instantiation). ✓
- `seedApp` reset recipe: clear localStorage + sessionStorage + `window.name`, set kv, `reload({domcontentloaded})` (Q2, D2) → Task 1 `seedApp`, byte-identical stored values rule. ✓
- `addInitScript` trap (Q2 landmine — ordering documented-undefined, no removal API) → Task 1 trap + Task 5 global grep gate + Task 6 flip test asserting the throw. ✓
- Per-test tracing chunks for retain-on-failure on a shared context (#14027, D2) → Task 1 (`startChunk`/`stopChunk`, path only on failure, attachment) + Step-5 witnessed trace.zip. ✓
- Listener cleanup (`removeAllListeners(undefined,{behavior:'wait'})`) + defensive `clearCookies` (Q2 table) → Task 1 `warm` teardown; the one real listener user (ai-model-registry:74) noted in Task 5. ✓
- `isolatedPage` escape hatch (D2) → Task 1; consumers enumerated by grep in Task 2 (waveB-datetime = the one `page.clock` user; service-worker = the SW project; equipment-walkthrough = the one `test.use` user — a survey finding beyond the brief's two named classes, included with rationale). ✓
- Worker-restart-on-failure as free quarantine (Q1) + closed-page guard (#16677) → Task 1 `warm` guard (throws → worker restarts); documented in fixture comments. ✓ (The research sketch's `testInfo.fail()` was replaced with a thrown error — `fail()` marks a test expected-to-fail, which would hide the event; a throw surfaces it and still triggers the restart. Deliberate, reasoned deviation.)
- D3 migration shape (mechanical, per-file, suite green per batch) → Tasks 3–5, IP-rules with exact before/after, disposition table. ✓
- **W0-a** (ephemeral only; no Option B) → no `launchPersistentContext` anywhere; Task 8 grep gate. ✓ **W0-b** (serve.js untouched; no D1/ETag) → no serve.js task exists; Task 8 diff gate. ✓ **W0-c** (preserve the ~1028 vs ~2155 win) → Task 6 flip + Task 8 wall-time record. ✓ Research §D4 escalations and §Measurement-plan items are explicitly dead per the overrides section. ✓
- Brief's plan-requirements: fixture core (Task 1) · mechanical migration with distinct-pattern enumeration + mid-test-goto semantics documented (inventory + Tasks 3–5) · escape hatches enumerated by grep (Task 2) · L21 + config-comment corrections with measurement filenames (Task 7) · final parity gate with wall-time note (Task 8) · flip sequencing justified against "main never breaks" (Sequencing gate). ✓

**2. Placeholder scan:** no TBD/TODO/"similar to Task N"; every code step shows complete code; the two `{M1B-…}` slots in Task 7 are not placeholders but a **HALT-gated substitution** from files that must exist on disk at execution time (Step 1 refuses to proceed without them) — the honest alternative to inventing numbers for gitignored artifacts this plan cannot commit. ✓

**3. Type/signature consistency:** `seedApp(page: Page, kv: Record<string,string> = {}) → Promise<void>` used identically in Tasks 1, 3–6 and all IP examples; fixture names `warm`/`warmPage`/`warmContext`/`isolatedPage` consistent across Tasks 1, 2, 6; `__mkWarmServed` set in Task 1, asserted in Tasks 1 and 6; `dclGoto` applied to warmPage, isolatedPage, and the pre-flip classic page so the DCL default survives every phase; kv values are exact stored strings everywhere (`JSON.stringify` kept at call sites). ✓

**4. Batch coverage:** 28 + 28 + 26 migrated + 3 escape-hatched = **85/85 files accounted**; the one no-nav-seed file (`occ-css-tokens`) is explicitly IP-6, the one no-addInitScript-with-goto file is the same file, and the new `warm-fixture.spec.ts` is seedApp-native. Suite arithmetic per task stated (433 → 437 → 438). ✓
