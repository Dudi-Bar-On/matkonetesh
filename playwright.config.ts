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
  // Measured reliable ceiling against the clustered in-memory serve.js.
  // Re-measured 2026-07-23 at 419 tests (previous measurement was taken at 324, then lowered to 6):
  //   6 workers  -> 3/3 clean, ~175s (175/176/174)
  //   8 workers  -> 3/3 clean, ~139s (143/142/133)
  //   10 workers -> 3/3 clean, ~110s (116/107/108)   <- chosen
  // 10 was both the fastest and as reliable as 6 and 8 on this measurement — the earlier flakiness at
  // 8 workers (recorded below at 324 tests) did not reproduce at any of the three candidates this time.
  // Reliability over speed: retries is 0, so a count that fails 1 run in 3 surfaces as a red suite.
  // Re-measure again if the suite grows substantially.
  // Prior note (2026-07-21, 308→324 tests): 8 workers began an occasional short run (a burst of
  // client-side page.goto timeouts under contention, ~2.5min instead of 1.8), so it was lowered to 6.
  // (16 = the CPU/2 default is much faster but was clearly non-deterministic at that time.)
  //
  // CI CAVEAT (2026-07-23): the ceiling above was measured on THIS multi-core machine. GitHub's
  // ubuntu-latest runner is 4-vCPU, where 10 over-subscribes ~2.5× and starves interaction handlers —
  // equipment-walkthrough's #eqAddNew click timed out under that contention on CI run 29983060583
  // (a genuine flake: the same test also fails on Node 20, and the test itself uses proper condition
  // waits). §11a and the sequencing analysis both predicted the local ceiling would be wrong for the
  // runner. So CI uses a conservative 2 (Playwright's 50%-of-cores default for 4 vCPU) — reliability
  // over speed, since retries is 0. Local stays at the measured 10.
  workers: process.env.CI ? 2 : 10,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
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
