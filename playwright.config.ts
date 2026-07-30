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
  // Test-level timeout is the hard ceiling over EVERYTHING a test does, navigation included. 30s test /
  // 20s nav (below) — ADOPTED PRODUCTION GEOMETRY (2026-07-24, owner-approved). Originated as a CANARY/
  // debugging geometry for the flake-refactor loop (deliberately MIDDLE values: tight enough a surviving
  // root-cause stall still FIRES — the 28s/40s SPLITTER had masked the defect — loose enough to trim pure
  // worker-restart-cascade noise). The root cause is now fixed (loopback-connection nav stall; route.fulfill
  // serves the warm doc in-memory, commits 7d5402d+f74f1b8) and certification kept these same values rather
  // than loosening them (see the workers comment below), so they are promoted here from instrument to
  // shipped config. retries stays 0.
  timeout: 30_000,
  // Worker count: 20 — CERTIFIED (2026-07-24) on the post-loopback-fix architecture. The nav-stall root
  // cause — concurrent page.reload navigations serializing on the loopback connection layer, not a P-core
  // or worker-count limit (proof: docs/research/flake-refactor-rootcause.md) — is fixed by route.fulfill
  // in-memory doc serving (commits 7d5402d+f74f1b8, reviewed ba1da6a). With the fix in place a fresh
  // 12/16/20/24-worker curve probe ran CLEAN at every point (439 passed each); 20 was the fastest clean
  // count (~54s) and was then certified over 7 serialized full-suite runs — 7/7 clean (plus the curve
  // probe's own clean reading = 8/8 clean at workers=20). Full numbers: the POST-LOOPBACK-FIX session in
  // docs/research/measurements/m1b-capacity-probes-2026-07-23.md. This SUPERSEDES every earlier worker-count
  // story in this repo's history — including the contaminated "10 workers oversubscribes the 8 P-cores"
  // claim (development-discipline.md §11 L21) and this document's own prior 16-worker "16 FAILED" blip —
  // all of which were the loopback wall, now refuted by the cure. CI stays 2 (GitHub ubuntu-latest is 4-vCPU).
  workers: process.env.CI ? 2 : 20,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Navigation timeout — 20s, below the 30s test ceiling — ADOPTED PRODUCTION GEOMETRY (2026-07-24,
    // owner-approved via certification; see the workers comment above). seedApp's warm reload is ~1s
    // steady-state now that route.fulfill removes the per-test loopback connection (the former nav-stall
    // root cause), so 20s is ample headroom rather than a tight canary bound. Applies to seedApp's reload
    // via the context default; the worker cold goto keeps its own explicit 28s (F2 — outside the per-test
    // budget, addresses worker-restart re-entry) — unchanged.
    navigationTimeout: 20_000,
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
    // Dedicated project so the service-worker tests run with the SW actually enabled
    // (serviceWorkers:'allow' is Playwright's own default; stated explicitly here for clarity).
    //
    // fullyParallel:false is LOAD-BEARING here (2026-07-30, Phase 1 Task 3). These tests each drive a
    // real SW register/install/activate plus reload + context.setOffline cycles — measurably heavier
    // than a warm-page test and NOT curable by the loopback fixture (this project deliberately gets no
    // in-memory routes; its whole point is real HTTP + real SW caching). Measured: one test solo 2.4s,
    // but 12.5s at just TWO concurrent workers. The file grew from 2 tests to 5, and because Playwright
    // caps workers at the test count, that silently raised this project's own concurrency from 2-way to
    // 5-way — which blows the 30s test timeout, and the timeout teardown then closes the page mid-call,
    // surfacing as "Target page, context or browser has been closed" rather than a plain timeout.
    // Reproduced in isolation 3/3 at 5-way; 5/5 pass at workers=1 (14.5s) and at 2. With fullyParallel
    // off, this file's tests share ONE worker sequentially (~15s total) while the chromium project keeps
    // its certified 20. Evidence: .superpowers/sdd/sw-failure-diagnosis.md.
    // DO NOT "fix" a failure here by adding retries or raising the timeout — that hides the capacity
    // signal this setting exists to keep honest (§11a, retries:0).
    {
      name: 'service-worker',
      fullyParallel: false,
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
