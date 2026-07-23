import { test, expect } from '@playwright/test';

// PRE-6 (Phase -1, Part 2, Task 1): app.js:9546 used to gate SW registration on the literal string
// check location.protocol==='https:', so under this suite's http://localhost server the entire
// update-delivery channel — register(), mkSWReg, the v256 reg.update() "device never asked" fix, the
// update-toast flow — was dead code with zero coverage (docs/analysis/program/PRE-6-service-worker-env-design.md).
// The gate now checks self.isSecureContext (owner §4 sign-off, 2026-07-23), which the platform already
// treats as true on http://localhost (MDN "Secure contexts"; Chromium's "treat localhost as a secure
// context" ship). This spec never calls navigator.serviceWorker.register() itself — every assertion
// below observes the APP'S OWN registration path (app.js:9544-9564) actually firing under test.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});

test('the app registers a service worker on http://localhost via its own gate, and it activates', async ({ page }) => {
  await page.goto('/index.html');

  // mkSWReg (app.js:2360) is the app's own registration handle, assigned synchronously inside its OWN
  // .then(function(reg){ mkSWReg=reg; ... }) (app.js:9548-9549) — this test never calls register()
  // itself. `mkSWReg` is declared with `let` at the top level of app.js's classic script, so — unlike
  // a `var` — it is a lexical binding, NOT a `window` property; `window.mkSWReg` is genuinely undefined
  // even once the real variable is set (confirmed via a throwaway diagnostic during this task, which
  // also confirmed page.waitForFunction does not reliably await an async/Promise-returning predicate).
  // Reference it as a bare identifier in a STRING expression, same convention the rest of this suite
  // already uses for app.js globals (e.g. adaptive-home.spec.ts: `typeof cRefreshHome==='function'`).
  await page.waitForFunction(`!!mkSWReg && !!mkSWReg.active && mkSWReg.active.state==='activated'`);

  // Cross-check against the browser's OWN registration bookkeeping, independent of the app's variable —
  // proof this is a real Service Worker registration, not just a JS assignment. page.evaluate (unlike
  // waitForFunction) does properly await a returned promise — confirmed by the same diagnostic.
  const regs = await page.evaluate(() => navigator.serviceWorker.getRegistrations());
  expect(regs.length).toBeGreaterThan(0);

  // mkSWReg is also a real production consumer: showNotification() (app.js:2362-2363) reads it to fire
  // background alarm notifications on Android, where `new Notification()` is a no-op — already proven
  // truthy above.

  // The real sw.js (build.py:403-423) ran its own 'install' handler and precached the shell under a
  // content-hashed cache name (CACHE='mk-'+md5(html)[:8]) — proof the actual built artifact, not a
  // stub, is what registered and installed.
  const cacheKeys = await page.evaluate(() => caches.keys());
  expect(cacheKeys.some((k) => /^mk-[0-9a-f]{8}$/.test(k))).toBe(true);
});

test('reg.update() (the v256 "reached the server but not the device" fix) fires on load and again when the tab becomes visible', async ({ page }) => {
  // Spy on the real ServiceWorkerRegistration.prototype.update so the count reflects the app's own two
  // call sites (app.js:9557-9561) invoking the browser's real update mechanism — not a mock replacing it.
  await page.addInitScript(() => {
    (window as any).__mkUpdateCalls = 0;
    const orig = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = function (this: ServiceWorkerRegistration, ...args: unknown[]) {
      (window as any).__mkUpdateCalls++;
      return (orig as any).apply(this, args);
    };
  });

  await page.goto('/index.html');

  // _swPoke() (app.js:9557-9560) calls reg.update() once, unconditionally, right after registration —
  // the "check on launch" half of the v256 fix.
  await page.waitForFunction(() => (window as any).__mkUpdateCalls >= 1);

  // "check again on foreground" half (app.js:9561): a visibilitychange while the document IS visible
  // must poke reg.update() again.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => (window as any).__mkUpdateCalls >= 2);

  // Negative case (the guard baked into app.js:9561's own condition): a visibilitychange while the
  // document is NOT visible must not poke update() again. The listener runs synchronously inside
  // dispatchEvent, so reading the counter immediately after — no await, no timeout — is deterministic,
  // not a race.
  const baseline = await page.evaluate(() => (window as any).__mkUpdateCalls);
  const after = await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return (window as any).__mkUpdateCalls;
  });
  expect(after).toBe(baseline);
});
