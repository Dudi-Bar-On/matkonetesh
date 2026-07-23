import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// PRE-4 eval harness — an ISOLATED Playwright project, deliberately separate from the root suite.
// testDir is 'tests' relative to THIS file (evals/tests), never the root's ./tests, so a plain
// `npx playwright test` at the repo root (which resolves the nearest playwright.config.ts — the root
// one, testDir './tests') never discovers anything in here. Invoked only via
// `npm run eval` → `playwright test --config evals/playwright.config.ts` (see root package.json).
//
// Design doc: docs/analysis/program/PRE-4-eval-harness-design.md
//  §4.3 — isolation rationale (own config, no exclude-list to keep in sync, no risk of a live call
//         ever firing during a routine DoD-line-12 run).
//  §8   — workers:1 is a DELIBERATE divergence from the root suite's workers:10/§11a tuning. The root
//         suite is a free, deterministic, in-memory suite where concurrency buys speed. This suite's
//         cost driver is live, paid, rate-limited API calls (once a key is present) — serial execution
//         avoids racing concurrent calls against the same key's rate limit. Not a violation of "never
//         --workers=1" (CLAUDE.md §11a) — that rule targets the MAIN suite specifically.
//
// Own port (default 8199, overridable) so this config's webServer never collides with the root
// suite's :8123 if a leftover process exists, mirroring the root config's MK_TEST_PORT pattern.
const PORT = Number(process.env.MK_EVAL_PORT) || 8199;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,   // a scorer failure is a real bug; a live-call failure should be visible, not silently retried
  workers: 1,   // deliberate — see header comment; this suite's cost is API calls, not wall time
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
    launchOptions: { args: ['--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1'] },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, serviceWorkers: 'block' } },
  ],
  webServer: {
    // Same build+serve convention as the root config — tests exercise the real dist/ artifact.
    // Playwright's webServer.command defaults its cwd to this config file's own directory (evals/),
    // but build.py/serve.js live at the repo root — so cwd must be set explicitly.
    command: `python build.py && node serve.js ${PORT}`,
    cwd: path.resolve(__dirname, '..'),
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
