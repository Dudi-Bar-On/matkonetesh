// Shared test fixtures — the WARM-PAGE architecture core.
// Design: docs/research/warm-page-architecture-research.md, amended by the W0 measured decisions
// (docs/superpowers/plans/2026-07-23-warm-page-architecture.md): EPHEMERAL worker contexts only
// (launchPersistentContext measured WORSE — 1788ms vs 1028ms p50), serve.js untouched (200-vs-304
// measured identical; the reload win is V8's in-isolate source-keyed compilation cache).
//
// Shape:
//   warmContext (worker) — ONE ephemeral context per worker, project-faithful options. NO manual
//                          tracing.start() — see the comment on this fixture below for why.
//   warmPage    (worker) — ONE page, ONE cold goto('/index.html') per worker; addInitScript TRAPPED.
//   warm        (test)   — per-test wrapper: closed-page guard, __mkWarmServed counter, listener/cookie
//                          cleanup. Trace-chunk-per-test (the #14027 cure for retain-on-failure on a
//                          shared context) is delivered by @playwright/test's OWN automatic artifact
//                          recorder, not by manual startChunk/stopChunk here — see `warmContext`.
//   isolatedPage (test)  — escape hatch: fresh page in the test's BUILT-IN context (per-test isolation,
//                          config trace:'retain-on-failure' and per-file test.use options apply normally).
//   seedApp(page, kv)    — THE per-test reset: clear storage → set kv → reload (DCL). Self-contained on
//                          classic pages too (navigates first if off-origin) so migration can proceed
//                          file-by-file with main green; the warm default lands in the flip (Task 6).
//   page (default)       — THE FLIP (Task 6, 2026-07-23): now an alias for `warm` — every migrated spec's
//                          default `page` boots via the worker-warm reload. `isolatedPage` is still the
//                          classic per-test-context escape hatch (DCL-goto default, addInitScript allowed).
//
// Isolation guarantees relied on (all official): a failing test shuts its worker down ("Workers are
// always shutdown after a test failure" — test-parallel docs) so a corrupted warm page can never leak
// forward; init-script ordering across accumulated scripts is UNDEFINED and irremovable (class-page
// docs) — hence the hard trap instead of a convention.
//
// TRACING DEVIATION FROM THE PLAN'S D2 SKETCH (root-caused against installed playwright 1.61.1 source,
// not guessed — see the comments on `warmContext`/`warm` below): the plan's sketch called
// context.tracing.start() once per worker plus manual startChunk()/stopChunk() per test to implement
// the #14027 cure by hand. Running it threw "Tracing has been already started" on the very first test.
// Root cause: this repo's playwright.config.ts already sets `trace: 'retain-on-failure'`, and
// @playwright/test's `_setupArtifacts` auto-fixture (node_modules/playwright/lib/index.js) ALREADY
// implements the #14027 chunk cure automatically for every live BrowserContext, worker-scoped or not —
// it re-scans playwright._allContexts() at every test boundary and starts/chunks/attaches tracing on
// each one. Manual calls on top of that raced and lost. The fix removes the manual calls entirely and
// lets the framework's own mechanism own tracing for the shared context — same observable outcome
// (trace.zip attached on failure, discarded on pass), zero custom state machine to keep in sync with
// the framework's.
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
    // DELIBERATELY no context.tracing.start() here (deviation from the plan's D2 sketch, root-caused
    // against the installed playwright 1.61.1 source, not guessed): with `trace` configured in
    // playwright.config.ts, @playwright/test's OWN automatic artifact recorder (the `_setupArtifacts`
    // auto-fixture in node_modules/playwright/lib/index.js) already starts tracing on EVERY
    // BrowserContext the instant browser.newContext() creates it — built-in `context` fixture or a
    // custom worker-scoped one, it listens on the shared playwright._instrumentation, not on the
    // built-in fixture specifically. Because willStartTest()/didFinishTest() re-scan
    // playwright._allContexts() at EVERY test boundary, it also opens/closes a fresh CHUNK on THIS
    // exact context per test and attaches trace.zip on failure (testInfo.attachments, name:'trace')
    // — precisely the #14027 chunk cure the design calls for, delivered for free, for the whole
    // worker's lifetime. Calling context.tracing.start() ourselves here throws "Tracing has been
    // already started" — the automatic recorder always wins the race, since it fires from
    // browser.newContext() itself, before this line runs. See `warm` below for the matching reason
    // per-test startChunk/stopChunk calls are also omitted.
    await use(context);
    await context.tracing.stop();   // safe with no args even mid-chunk (discard-mode no-op) — §11a teardown
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
  warm: async ({ warmPage, warmContext }, use) => {
    if (warmPage.isClosed())
      throw new Error('warm page was closed by an earlier test — failing so Playwright restarts the ' +
        'worker with a fresh warm page (guard for playwright #16677; worker-shutdown-on-failure is the quarantine).');
    // No manual tracing.startChunk()/stopChunk()/attachment code here (see the long comment in
    // `warmContext` above for the full root-cause). @playwright/test's automatic artifact recorder
    // already opens a fresh chunk on `warmContext` at the start of THIS exact test and closes +
    // attaches-on-failure at the end, keyed off the same test boundary this fixture wraps. Calling
    // startChunk() again here would DISCARD the framework's already-open chunk (server
    // Tracing.startChunk: "if a chunk is already recording, stopChunk({mode:'discard'}) it first") —
    // throwing away real trace coverage instead of adding any, for zero benefit.
    (warmPage as any).__mkWarmServed = ((warmPage as any).__mkWarmServed || 0) + 1;   // reuse observable by the contract spec
    await use(warmPage);
    // Between-tests cleanup (§11a setup⟺teardown): drop per-test listeners (e.g. console taps) and
    // clear context-wide state a reload cannot reset. App uses no cookies — the clear is defensive.
    await (warmPage as any).removeAllListeners(undefined, { behavior: 'wait' });
    await warmContext.clearCookies();
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

  // THE FLIP (2026-07-23): the default page IS the worker-warm page. Per-test reset = seedApp(page, kv).
  // Mid-test page.goto('/index.html') / page.reload() still work — normal full navigations on the warm
  // page (fresh document + JS heap, same V8 isolate → still isolate-cache-fast, W0); localStorage
  // persists across them within a test exactly as before; the NEXT test's seedApp is the reset.
  // Per-test isolation lives in the isolatedPage fixture (clock / SW project / test.use specs).
  page: async ({ warm }, use) => {
    await use(warm);
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
