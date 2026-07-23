import { defineConfig, devices } from '@playwright/test';

// Serves the freshly-built single-file app. `python build.py` regenerates index.html
// from data.py + friends, then python's http.server serves the project root.
// Overridable so two suite runs can execute concurrently on different ports. serve.js already
// reads its port from process.argv[2] (serve.js:18), so only this constant needed changing.
// Concurrent runs on the SAME port remain forbidden — that produced 127 phantom
// ERR_CONNECTION_REFUSED failures on 2026-07-21 (CLAUDE.md §11a).
const PORT = Number(process.env.MK_TEST_PORT) || 8123;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,   // surface flakes as failures — never retry them away (a flake is a bug to fix)
  // Test-level timeout is the hard ceiling over EVERYTHING a test does, navigation included (Playwright default
  // 30s, made explicit here). navigationTimeout (use.navigationTimeout below) is deliberately kept UNDER this.
  timeout: 30_000,
  // Worker count = fit the 8 PERFORMANCE cores. This machine is an i9-14900: 8 P-cores + 16 E-cores (24C/32T).
  // Every test parses+executes the heavy ~2.2MB inlined app on navigation — P-core-bound work. Above ~8 the
  // P-cores oversubscribe and the heaviest-init tests (active-hub / adaptive-home inject the MOST localStorage
  // state → most app-init) get CPU-STARVED, so their `domcontentloaded` blows the 30s test timeout — a
  // DETERMINISTIC 10-test failure (always the same specs). Root-caused 2026-07-23 via systematic-debugging.
  // Measured that evening (WITH the domcontentloaded fixture in tests/_fixtures.ts + the de-clustered serve.js):
  //   10 workers -> 10 FAILED (P-core oversubscription)
  //    8 workers -> 433 passed, 2.5m, CLEAN   <- chosen (one per P-core: reliable AND fastest reliable count)
  //    6 workers -> 433 passed, 3.1m, CLEAN
  //   the same 10 failing specs pass 23/23 in ISOLATION (proof it is contention, not a bug).
  // An earlier "10 = 3/3 clean" note here was WRONG — contaminated by orphaned zombie servers from
  // kill-restart cycles + a broken /usr/bin/time measurement, and lucky low-load windows. Reliability over
  // speed (retries:0). Re-measure ONLY on a clean/idle machine, single runs to completion, NEVER killing
  // mid-run (§11a setup⟺teardown). CI stays 2 (GitHub ubuntu-latest is 4-vCPU; 10 over-subscribed ~2.5x there).
  workers: process.env.CI ? 2 : 8,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Navigation timeout — kept BELOW the test-level timeout (30s) on purpose. The test timeout is the hard
    // ceiling over EVERYTHING including navigation, so a value above it (the old 60s) was dead config — the
    // 30s test timeout always fired first. Below it, a nav that genuinely hangs gets a nav-specific error.
    // The REAL nav-flake fix is tests/_fixtures.ts (every page.goto now defaults to waitUntil:'domcontentloaded':
    // the app is interactive at DCL; 'load' only waited on fonts/icons and blew the 30s wall under contention —
    // docs/research/playwright-reliability-research.md). A correct nav is now ~ms, so 15s is pure headroom.
    navigationTimeout: 15_000,
    // retries is 0 (see above), so 'on-first-retry' never fires — a zero-retry suite never gets a
    // second attempt to trace. 'retain-on-failure' captures a trace on the first (only) failure, which
    // is what the CI workflow's "Upload traces on failure" step actually needs to have something to upload.
    trace: 'retain-on-failure',
    // The app links Google Fonts externally; page.goto waits for 'load', so a slow/throttled
    // fonts.googleapis.com (many parallel test requests) stalls navigation to the 30s timeout.
    // Fonts are progressive enhancement — make them fail fast so 'load' fires promptly.
    launchOptions: { args: ['--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1'] },
  },
  projects: [
    // The app is mobile-first and DoD line 8 mandates evidence at 390x844, so the suite runs at
    // that size by default. Before 2026-07-22 the default was Desktop Chrome and only 5 of 82
    // specs set a mobile viewport at all (and only 2 of those at exactly 390x844), so a screenshot
    // taken inside a test was usually the wrong size.
    // Individual tests may still override with page.setViewportSize for a specific check.
    //
    // PRE-6 Part 2 Task 1 (2026-07-23): app.js:9546's SW gate now checks self.isSecureContext,
    // which localhost satisfies — so the app registers a real service worker on every page load
    // under test, and sw.js's install handler caches the ~2.4MB index.html each time. None of these
    // ~419 tests exercise the SW; that's what the dedicated 'service-worker' project below is for.
    // serviceWorkers:'block' rejects registration at the browser level (app.js already .catch()es
    // it), so this project behaves exactly as it did before the gate change — no SW, no caching cost.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, serviceWorkers: 'block' },
      testIgnore: '**/service-worker.spec.ts',
    },
    // Dedicated project so the 2 service-worker tests run with the SW actually enabled
    // (serviceWorkers:'allow' is Playwright's own default; stated explicitly here for clarity).
    {
      name: 'service-worker',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' },
      testMatch: '**/service-worker.spec.ts',
    },
  ],
  webServer: {
    // build, then serve the clean deploy folder (dist/) so tests exercise the real artifact
    // and the manifest/icons resolve (no 404 noise)
    command: `python build.py && node serve.js ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    // Always start a fresh server that Playwright tears down after the run. reuseExistingServer:true
    // (the old default locally) would silently reuse a STALE/broken leftover on :8123 → random 30s timeouts.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
