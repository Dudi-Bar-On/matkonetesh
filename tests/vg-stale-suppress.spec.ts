import { test, expect, seedApp } from './_fixtures';

// R-57 §4.5/§4.6, owner ruling F-2 (1.8.2026) — a stale/finished event stops arming TIME-BASED alerts,
// EXCEPT the one pre-serve safety gate (bcheck) when the cook actually started. Task 5 (9580cb4) landed
// evState/evCookStarted; this task wires the two arming sites (buildList's mk-tlalerts block, and
// scheduleBcheckDue's own ms<=0 branch) to that state, and adds the persistent compensation banner
// (#mkStaleEv) so honesty survives even when the alarm doesn't.
//
// L42 discipline: the four direct-call tests below (mirroring the established scheduleBcheckDue-testing
// convention already in tests/d2-bcheck-alert.spec.ts — a direct call into the real production function,
// asserting on its real rendered DOM output) cover the decision table. The LAST test in this file drives
// the real entry point a user actually clicks (openTimeline() → buildList(), with a real catalog item —
// cut-1, confirmed bcheck-gated on 'c:smoke' by tests/e3-probe.spec.ts) end to end.

const STALE_EV = { id: 'ev1', name: 'שבת שעברה', date: '2026-07-25', serve: '19:00',
                   menu: { keys: [] }, created: 1, updated: 1 };
// `eval(c)` below runs INSIDE the browser test page (page.evaluate), never in Node, on a fixed
// test-authored literal (never external/user input) — the same shape as the string-form page.evaluate
// pattern already established in this suite (tests/vg-classifier.spec.ts:60, vg-evstate.spec.ts:55) for
// constructing a `Date`-bearing fixture that JSON can't represent. Not a security-relevant eval.
const COMPUTED = `[{ blocked:false, m:{heb:'חזה בקר', key:'k1'},
  stages:[{kind:'bcheck', start:new Date(Date.now()-3600e3), tid:'st-ev1-k1-bcheck', temp:74}] }]`;

test.describe('R-57 §4.5/§4.6 · a stale event stops shouting about the past', () => {
  test('C6 · stale + cook NEVER started → bcheck does NOT fire (regression, red-green)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': JSON.stringify('ev1'), 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(c => (window as any).scheduleBcheckDue(eval(c), []), COMPUTED);
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    await page.waitForFunction(() => !!document.getElementById('mkStaleEv'));
    await expect(page.locator('#mkStaleEv')).toContainText('לא נורו');
  });

  test('F-2 · stale but the cook DID start (a wpck check-off) → bcheck FIRES', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': JSON.stringify('ev1'), 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(c => { localStorage.setItem('wpck:ev1:עטיפה', '1');
      (window as any).scheduleBcheckDue(eval(c), []); }, COMPUTED);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
    await expect(page.locator('#mkBcheckAlarm')).toContainText('חזה בקר');
  });

  test('NEGATIVE · a NEW occurrence of the same item still raises the check (R-56 must not regress)',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([]), 'mk-active': JSON.stringify(''),
      'mk-bcheck-due': JSON.stringify({ 'st-ev1-k1-bcheck@1000': { name: 'חזה בקר', acked: true, tid: 'st-ev1-k1-bcheck' } }) });
    await page.evaluate(() => {
      const w = window as any;
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'חזה בקר', key: 'k1' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'st-ev1-k1-bcheck', temp: 74 }] }], []);
    });
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));   // new start → new key
    await expect(page.locator('#mkBcheckAlarm')).toBeVisible();
  });

  test('NEGATIVE · a future bcheck in a stale event is still SCHEDULED (only the ms<=0 branch is gated)',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': JSON.stringify('ev1'), 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(() => {
      const w = window as any;
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'שוק', key: 'k2' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() + 5000), tid: 'st-ev1-k2-bcheck', temp: 74 }] }], []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    await page.clock.fastForward(6000);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
  });

  test('NEGATIVE · a LIVE (non-stale) event is unaffected by any of this', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    const LIVE_EV = { ...STALE_EV, id: 'ev-live', date: '2026-08-01', serve: '20:00' };   // 8h in the future — planning
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([LIVE_EV]), 'mk-active': JSON.stringify('ev-live'), 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(() => {
      const w = window as any;
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'עוף', key: 'k3' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() - 1000), tid: 'st-ev-live-k3-bcheck', temp: 74 }] }], []);
    });
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
    await expect(page.locator('#mkBcheckAlarm')).toContainText('עוף');
    await expect(page.locator('#mkStaleEv')).toHaveCount(0);   // not stale → no compensation banner either
  });

  // L42 — the real entry: openTimeline() → buildList() is the exact function production wires to the
  // "Timeline" nav button; cut-1 is a real catalog item confirmed bcheck-gated on method 'c:smoke'
  // (tests/e3-probe.spec.ts). This drives the whole scheduling pipeline (itemStages → equipPlan →
  // planSchedule → scheduleBcheckDue → renderBcheckAlarm/renderStaleEventBanner) for a genuinely stale
  // dated event, and asserts on the real rendered DOM — not on a hand-built `computed` array.
  test('DoD-5/L42 · openTimeline on a real stale event suppresses bcheck until the cook really starts', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-02T08:00:00') });   // ~24h after an 08:00 serve yesterday
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}), 'mk-bcheck-due': JSON.stringify({}),
      'mk-events': JSON.stringify([{ id: 'ev-real', name: 'שבת אמיתית', date: '2026-08-01', serve: '08:00',
        menu: { keys: ['cut-1'] }, created: 1, updated: 1 }]),
      'mk-active': JSON.stringify('ev-real'),
      'mk-tlstate-ev-real': JSON.stringify({ 'cut-1': { method: 'c:smoke', methodPinned: true, ready: true } }),
    });
    await page.evaluate(`(function(){
      setMenuCtx('event'); store.set('mk-active','ev-real');
      saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
      store.set('mk-tlserve','08:00'); store.set(serveDateKey(), '2026-08-01');
    })()`);
    await page.evaluate('openTimeline()');
    await page.waitForSelector('#tlList');

    // cook never started (no wpck, no timers, no plan-started) → the safety gate stays quiet, honestly
    // compensated by the persistent banner.
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);
    await page.waitForFunction(() => !!document.getElementById('mkStaleEv'));
    await expect(page.locator('#mkStaleEv')).toContainText('לא נורו');
    await page.screenshot({ path: '.superpowers/sdd/task-6-stale-banner-he-390x844.png' });

    // the cook DID start (a real check-off written the same way the work-plan panel writes it) — the
    // safety gate must fire the next time the real screen renders.
    await page.evaluate(`localStorage.setItem('wpck:ev-real:${encodeURIComponent('עטיפה')}','1')`);
    await page.evaluate('openTimeline()');
    await page.waitForSelector('#tlList');
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
  });

  test('DoD-9 · the banner renders in Russian too — no Hebrew leak, dir="ltr" on both numbers', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('ru'), 'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([STALE_EV]), 'mk-active': JSON.stringify('ev1'), 'mk-bcheck-due': JSON.stringify({}) });
    await page.waitForFunction(`(function(){ var g=window.__mkLangReady; return !!g && typeof g.then==='function'; })()`, undefined, { polling: 50 });
    await page.evaluate(() => (window as any).__mkLangReady);
    await page.evaluate(c => (window as any).scheduleBcheckDue(eval(c), []), COMPUTED);
    await page.waitForFunction(() => !!document.getElementById('mkStaleEv'));
    const banner = page.locator('#mkStaleEv');
    const text = (await banner.textContent()) ?? '';
    expect(text).not.toContain('לא נורו');   // no Hebrew leak
    const ltrSpans = banner.locator('.mka-row span[dir="ltr"]');
    await expect(ltrSpans).toHaveCount(2);
    await page.screenshot({ path: '.superpowers/sdd/task-6-stale-banner-ru-390x844.png' });
  });
});
