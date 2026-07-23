// Shared test fixtures. The ONLY behavioural change vs bare @playwright/test: every `page.goto`
// defaults to `waitUntil: 'domcontentloaded'` instead of Playwright's default `'load'`.
//
// Why (root-cause fix, see docs/research/playwright-reliability-research.md):
//   The app is a single inlined HTML with synchronous inline JS, so DOMContentLoaded fires strictly
//   AFTER the app's own script has run — the app is fully interactive at DCL. The default `'load'`
//   additionally blocks on every subresource (Google Fonts, icons, manifest) finishing. Under worker
//   contention that long tail crawls (benchmarked: domcontentloaded ~159ms vs load ~10.1s) and blows the
//   30s TEST timeout — the intermittent `page.goto: Test timeout of 30000ms exceeded` flake. `'load'`
//   buys these tests nothing, so switching the default to DCL removes the flake at its source.
//
// Any test that genuinely needs a different strategy can still pass it explicitly:
//   `page.goto(url, { waitUntil: 'load' })` — the caller's options win (spread last).
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const orig = page.goto.bind(page);
    (page as Page & { goto: Page['goto'] }).goto = ((url: string, opts?: Parameters<Page['goto']>[1]) =>
      orig(url, { waitUntil: 'domcontentloaded', ...(opts || {}) })) as Page['goto'];
    await use(page);
  },
});

export { expect };
export type { Page };
