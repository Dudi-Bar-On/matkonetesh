import { test, expect } from './_fixtures';

// PRE-6 (Phase -1, Part 2, Task 1): app.js:9546 used to gate SW registration on the literal string
// check location.protocol==='https:', so under this suite's http://localhost server the entire
// update-delivery channel — register(), mkSWReg, the v256 reg.update() "device never asked" fix, the
// update-toast flow — was dead code with zero coverage (docs/analysis/program/PRE-6-service-worker-env-design.md).
// The gate now checks self.isSecureContext (owner §4 sign-off, 2026-07-23), which the platform already
// treats as true on http://localhost (MDN "Secure contexts"; Chromium's "treat localhost as a secure
// context" ship). This spec never calls navigator.serviceWorker.register() itself — every assertion
// below observes the APP'S OWN registration path (app.js:9544-9564) actually firing under test.

test.beforeEach(async ({ isolatedPage: page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});

test('the app registers a service worker on http://localhost via its own gate, and it activates', async ({ isolatedPage: page }) => {
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

test('reg.update() (the v256 "reached the server but not the device" fix) fires on load and again when the tab becomes visible', async ({ isolatedPage: page }) => {
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

// ── Task 3 (A1c): the language-dictionary split must not break the SW offline shell ────────────────
// Dec-A3 preservation duty #1. Also closes I-1 (controller-anchored Task 2 review finding): applyLang()
// ran SYNCHRONOUSLY at boot (app.js, inside `try{ applyLang(); }catch(e){}`) BEFORE any non-Hebrew dict
// had loaded — with a stored non-Hebrew language and a failed dict fetch, it computed dir from an
// unpopulated I18N_DICTS entry, silently corrupting dir/lang/class while `L()`/`t()`/`itemName()` (not
// gated on dict-readiness either) independently leaked their hardcoded English fallback into dynamic
// chrome (confirmed live via a throwaway diagnostic: mk-lang='fr' + no cached dict + offline booted with
// dir='ltr' AND the home greeting rendered "Good evening" in English — Hebrew static markup, English
// dynamic text, LTR direction, all three disagreeing at once). Fixed by `_langDictReady(l)` (app.js, next
// to I18N_DICTS): true only once loadLangDict has actually populated the entry for `l` (he/en exempt —
// en needs no dict, L()'s own en-branch bypasses it). `applyLang()`, `L()`, `t()`, and `itemName()` all
// gate on it now, and the boot promise's failure path re-runs applyLang() (now renders 'he' throughout)
// and surfaces a literal-Hebrew toast instead of the prior silent console.warn.
//
// TEST-INFRA NOTE: this file's own `beforeEach` above installs an addInitScript that runs
// `localStorage.clear()` on EVERY navigation of `isolatedPage`, not just the first — confirmed via a
// throwaway diagnostic (a plain probe key set before `page.reload()` came back wiped after it, with
// localStorage.length===2 holding only the two keys the beforeEach itself seeds). A `page.addInitScript`
// call made AFTER that first goto is appended to the SAME accumulating list and Playwright runs init
// scripts in registration order, so registering an `mk-lang` setter mid-test survives every reload that
// follows (it reapplies right after beforeEach's clear on each one) without touching the shared
// beforeEach. Do not `localStorage.setItem` directly mid-test expecting it to survive a reload here.

test('a fetched language dict is served from the SW cache when offline (Dec-A3 duty 1)', async ({ isolatedPage: page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // `.ready` only promises an ACTIVE worker exists for the scope — on this page's very first-ever
  // navigation it can resolve BEFORE self.clients.claim() (build.py's activate handler) has finished
  // adopting THIS document as a controlled client (confirmed via a throwaway diagnostic: on a fresh
  // isolatedPage, navigator.serviceWorker.controller read immediately after `.ready` resolved was null
  // ~1 run in 6, always non-null by the SECOND navigation). Without this wait `fetch('lang-en.json')`
  // below can go straight to the network, UNCONTROLLED — no cache write happens at all — and the later
  // offline fetch then legitimately finds nothing (this was flaking ~1 run in 4 before the wait was added).
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // fetch the dict once online — the SW's existing runtime cache-first branch for non-navigate
  // same-origin GETs (build.py's fetch handler, the `else` branch) caches it as a side effect.
  const first = await page.evaluate(() => fetch('lang-en.json').then((r) => r.status));
  expect(first).toBe(200);
  // The PAGE's fetch() promise resolves as soon as the SW's respondWith(...) settles with the response —
  // independent of the cache WRITE, which is a separate async step (open the cache, finish reading the
  // cloned body, put()) the SW kicks off inside that same handler. build.py's fetch branch now wraps that
  // write in e.waitUntil() (Task 3 fix — see build.py's fetch listener comment) so the browser won't
  // recycle the worker before it lands, but waitUntil() only extends the SW's own lifetime; it does not
  // delay what the PAGE observes. Racing straight into setOffline() below caught the write mid-flight
  // ~1 run in 4 (real failures reproduced and root-caused, not a guess) — wait on the actual condition
  // (DoD-11: no arbitrary waits) instead of assuming same-tick completion.
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) { if (await (await caches.open(k)).match('lang-en.json')) return true; }
    return false;
  });
  await page.context().setOffline(true);
  // DEVIATION FROM THE BRIEF'S LITERAL sketch, per its own "if the test exposes a hole" clause — noted
  // here rather than silently diverging. The brief's sketch calls fetch('lang-en.json') directly on the
  // still-live document right after setOffline(true). Root-caused via a throwaway diagnostic (>30 runs,
  // isolated to just this test): even with the cache write CONFIRMED present (the wait above) and
  // navigator.onLine already flipped to false, a same-document fetch() issued with no intervening
  // navigation still intermittently threw "Failed to fetch" (~1 run in 4-5) — never once when a
  // page.reload() was inserted between setOffline(true) and the fetch (0/8, then re-confirmed clean
  // across every full-suite run below). This reads as a Chromium/CDP-level timing quirk in how a
  // same-document fetch() picks up a just-toggled network-condition change versus a fresh navigation
  // re-establishing the service worker's fetch interception — not a product bug (the cache demonstrably
  // holds the entry throughout) and not fixable by waiting on a further condition (onLine was already
  // correct). A reload is a real, observable-state-changing action, not a timeout, so it stays within
  // the "wait on conditions, not time" rule while sidestepping the browser-level race entirely.
  await page.reload();
  const offline = await page.evaluate(() => fetch('lang-en.json').then((r) => r.status).catch(() => 0));
  expect(offline).toBe(200);   // cache-first branch must serve it — no network required
  await page.context().setOffline(false);
});

test('I-1 leg (a): a stored non-Hebrew language survives an offline boot once its dict has been cached', async ({ isolatedPage: page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // No explicit controller-adoption wait needed here (unlike the previous test): the reload below is a
  // SECOND navigation, and self.clients.claim() has always finished adopting this document as its
  // controlled client by then (confirmed by the same diagnostic cited above — only the FIRST-ever
  // navigation raced .ready against claim()).
  // Warm boot: store 'en', reload online so the real boot fetch runs and the SW runtime-caches the
  // response (same mechanism the previous test proves directly).
  await page.addInitScript(() => { localStorage.setItem('mk-lang', JSON.stringify('en')); });
  await page.reload();
  await page.evaluate(() => (window as any).__mkLangReady);
  const online = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    h1: document.querySelector('h1')?.textContent || '',
  }));
  expect(online.lang).toBe('en');
  expect(online.dir).toBe('ltr');
  expect(online.h1).toContain('Matkonet');   // lang-en.json's __html__/tnode translation actually applied

  // __mkLangReady resolving only proves the app's OWN fetch()/json() parse finished — the SW's cache
  // WRITE for that same response is a separate, slightly-lagging async step (see the previous test's
  // comment for the full root-cause). Wait on the real condition before going offline.
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) { if (await (await caches.open(k)).match('lang-en.json')) return true; }
    return false;
  });

  // Now boot OFFLINE. No build.py/sw.js change is needed for this leg: the cache-first branch already
  // proven above serves lang-en.json from the SW cache exactly like any other same-origin GET.
  await page.context().setOffline(true);
  await page.reload();
  await page.evaluate(() => (window as any).__mkLangReady);
  const offline = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    h1: document.querySelector('h1')?.textContent || '',
    toastVisible: document.getElementById('toast')?.classList.contains('show') || false,
  }));
  expect(offline.lang).toBe('en');
  expect(offline.dir).toBe('ltr');
  expect(offline.h1).toContain('Matkonet');       // text AND direction still agree, offline
  expect(offline.toastVisible).toBe(false);        // success path — no failure notice
  await page.context().setOffline(false);
});

test('I-1 leg (b): boot in a non-Hebrew language whose dict was never cached falls back to coherent Hebrew (not Hebrew-text-in-LTR) with a toast, offline', async ({ isolatedPage: page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);   // SW registered + shell precached; lang-fr.json is NEVER fetched in this test
  await page.addInitScript(() => { localStorage.setItem('mk-lang', JSON.stringify('fr')); });

  await page.context().setOffline(true);
  await page.reload();
  // __mkLangReady resolves even on failure — the boot promise's .catch swallows the fetch rejection
  // (after running the I-1 recovery: a re-run of applyLang() + the Hebrew toast).
  await page.evaluate(() => (window as any).__mkLangReady);

  const state = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    hasLangEnClass: document.documentElement.classList.contains('lang-en'),
    h1: document.querySelector('h1')?.textContent || '',
    greet: document.getElementById('cGreet')?.textContent || '',
    toastText: document.getElementById('toast')?.textContent || '',
    toastVisible: document.getElementById('toast')?.classList.contains('show') || false,
  }));
  // dir/lang/class restored to Hebrew — the reviewer's exact reported symptom (dir flipped to 'ltr'
  // while text stayed Hebrew) can no longer happen.
  expect(state.lang).toBe('he');
  expect(state.dir).toBe('rtl');
  expect(state.hasLangEnClass).toBe(false);
  // text agrees with that direction in BOTH the static shell markup and JS-generated dynamic chrome (the
  // home greeting, generated by cRefreshHome() via L() — the second, independent leak this task closes:
  // L()/t()/itemName() no longer fall back to their hardcoded English literal for a language whose dict
  // never loaded).
  expect(state.h1).toContain('מתכונת');
  expect(state.greet).toMatch(/בוקר טוב|צהריים טובים|ערב טוב/);   // one of L()'s three Hebrew greeting strings — never "Good morning/afternoon/evening"
  // surfaced to the user, not silent — literal Hebrew (getLang()/getDict() are themselves the broken
  // machinery here, so the message can't route through them).
  expect(state.toastVisible).toBe(true);
  expect(state.toastText).toContain('טעינת השפה נכשלה');

  await page.context().setOffline(false);
});

// I-A (review finding on Task 3's I-1 fix): _langDictReady() exempted 'en' unconditionally, reasoned as
// "L()'s en branch returns its inline English argument, no dict needed" — true for DYNAMIC strings only.
// The STATIC shell (applyI18n()/tnode(), driven by lang-en.json's __html__/__units__/__pre__) is NOT
// exempt: with a never-cached 'en' dict, the old code let _langDictReady('en') return true regardless,
// so applyLang() set lang='en'/dir='ltr'/lang-en class ON while the static Hebrew markup — never touched
// by applyI18n/tnode with an empty {} dict — stayed Hebrew. Same incoherence leg (b) above closes for
// fr, but surviving for 'en' specifically because of the exemption. Fix: drop the 'en' exemption so
// English is gated on its dictionary exactly like every other non-Hebrew language, for the STATIC shell
// (dir/lang/class/h1, all driven directly by _langDictReady via applyLang()).
//
// NOT asserted here: the DOM-generated home greeting (#cGreet, via cRefreshHome() -> L()). L()'s own
// 'en' branch returns its inline English literal unconditionally, by design, dict-independent — same as
// itemName()'s pre-existing 'en' branch just above it in app.js. That is deliberately NOT part of this
// fix (task brief: "Keep L()'s en branch exactly as it is ... not what this fix is about") — English
// dynamic chrome legitimately keeps rendering English even while the static shell is still Hebrew. This
// residual asymmetry is accepted, not a regression: it is the pre-existing "zero-regression" contract for
// 'en' dynamic strings, unaffected by whether the static-shell gate before it is closed.
test('I-A: boot in English whose dict was never cached falls back to a coherent Hebrew STATIC shell (not English lang/dir with Hebrew markup), offline', async ({ isolatedPage: page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);   // SW registered + shell precached; lang-en.json is NEVER fetched in this test
  await page.addInitScript(() => { localStorage.setItem('mk-lang', JSON.stringify('en')); });

  await page.context().setOffline(true);
  await page.reload();
  await page.evaluate(() => (window as any).__mkLangReady);

  const state = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    hasLangEnClass: document.documentElement.classList.contains('lang-en'),
    h1: document.querySelector('h1')?.textContent || '',
    toastText: document.getElementById('toast')?.textContent || '',
    toastVisible: document.getElementById('toast')?.classList.contains('show') || false,
  }));
  // Before the fix: _langDictReady('en') is unconditionally true, so these three stay at 'en'/'ltr'/true
  // while h1 (static markup, applyI18n/tnode never touch it against an empty {} dict) remains Hebrew
  // underneath — dir/lang/class disagreeing with the still-Hebrew static text, the exact incoherence I-1
  // was raised to eliminate, surviving for exactly one language.
  expect(state.lang).toBe('he');
  expect(state.dir).toBe('rtl');
  expect(state.hasLangEnClass).toBe(false);
  expect(state.h1).toContain('מתכונת');
  expect(state.toastVisible).toBe(true);
  expect(state.toastText).toContain('טעינת השפה נכשלה');

  await page.context().setOffline(false);
});
