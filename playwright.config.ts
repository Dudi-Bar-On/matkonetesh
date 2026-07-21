import { defineConfig, devices } from '@playwright/test';

// Serves the freshly-built single-file app. `python build.py` regenerates index.html
// from data.py + friends, then python's http.server serves the project root.
const PORT = 8123;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,   // surface flakes as failures — never retry them away (a flake is a bug to fix)
  // Measured reliable ceiling against the clustered in-memory serve.js. As the suite grew (308→324 tests)
  // 8 workers began an occasional short run (a burst of client-side page.goto timeouts under contention,
  // ~2.5min instead of 1.8), so it was lowered to 6: 324/324 across repeated runs at ~145s. Re-measure and
  // adjust if the suite grows substantially again. Reliability over the last ~40s — a flake is a bug, not
  // something to average out. (16 = the CPU/2 default is much faster but clearly non-deterministic here.)
  workers: 6,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // The app links Google Fonts externally; page.goto waits for 'load', so a slow/throttled
    // fonts.googleapis.com (many parallel test requests) stalls navigation to the 30s timeout.
    // Fonts are progressive enhancement — make them fail fast so 'load' fires promptly.
    launchOptions: { args: ['--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1'] },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
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
