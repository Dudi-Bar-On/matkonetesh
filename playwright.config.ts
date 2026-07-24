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
  // Test-level timeout is the hard ceiling over EVERYTHING a test does, navigation included. CANARY geometry
  // (2026-07-24, owner) — a DEBUGGING instrument for the flake-refactor loop, NOT a shipped fix. 30s test /
  // 20s nav (below), with every per-iteration acceptance/repro run at --workers=12 (CLI override; config
  // workers stays 8, the last-known-stable interim). Deliberately MIDDLE values: tight enough that a surviving
  // root-cause stall STILL FIRES (the 28s/40s SPLITTER masked the defect — its campaign was cancelled),
  // loose enough to trim pure worker-restart-cascade noise so the ledger shows the true residual. retries
  // stays 0. Revert to a chosen production geometry once the root cause is eliminated.
  timeout: 30_000,
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
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Navigation timeout — CANARY geometry (2026-07-24, owner): 20s, below the 30s test ceiling. Debugging
    // instrument for the flake-refactor loop, not a fix: seedApp's warm reload is ~1s steady-state, so 20s
    // still lets a genuine root-cause stall surface as a nav-specific failure while trimming pure-cascade
    // noise. Applies to seedApp's reload via the context default; the worker cold goto keeps its own explicit
    // 28s (F2 — outside the per-test budget, addresses worker-restart re-entry).
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
