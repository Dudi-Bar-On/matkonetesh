import { test, expect, seedApp } from './_fixtures';

// R-57 (docs/superpowers/specs/2026-08-01-voice-governance-design.md §4, owner rulings 1.8.2026) —
// event lifecycle. Derived at read time (evState); the ONE persisted addition is `finishedAt`. F-2 is
// the owner's conservative definition of "did the cook actually start" (five witnesses, ANY sufficient,
// fail toward the alert never toward silence).
//
// L42 discipline (docs/process/development-discipline.md, 2026-08-01): a test that hands the next layer
// its input directly proves branches, never the feature. The direct-call tests below (C1-C5, F-2) cover
// the decision table; the LAST test in this file drives the real render path a user actually sees
// (cNavGo('events') → cPaintEvents(), the exact function production wires to the events-tab button) and
// asserts on the rendered chip — the real consumer named in DoD-5.

const EV = (over: any = {}) => Object.assign({ id: 'ev1', name: 'שבת', date: '2026-07-30',
  serve: '19:00', menu: { keys: [] }, created: 1, updated: 1 }, over);

test.describe('R-57 · evState', () => {
  test('C1 · dated, served 13h ago, zero timers → needsUpdate', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });   // 13h after 19:00
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const s = await page.evaluate(ev => (window as any).evState(ev), EV());
    expect(s).toBe('needsUpdate');
  });

  test('C2 · NEGATIVE (4.2a) · the same event WITH a running timer → active', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({ 'st-ev1-brisket-smoke': { end: Date.parse('2026-07-31T10:00:00'), name: 'חזה' } }) });
    const s = await page.evaluate(ev => (window as any).evState(ev), EV());
    expect(s).toBe('active');
  });

  test('C3 · NEGATIVE (4.2b) · an UNDATED event is never needsUpdate', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T23:30:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const s = await page.evaluate(ev => (window as any).evState(ev), EV({ date: '', serve: '08:00' }));
    expect(s).toBe('planning');
  });

  test('C4 · NEGATIVE (threshold, both sides) · 11h → not needsUpdate; 13h → needsUpdate', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T06:00:00') });   // 11h
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    expect(await page.evaluate(ev => (window as any).evState(ev), EV())).not.toBe('needsUpdate');
    await page.clock.setFixedTime(new Date('2026-07-31T08:00:00'));       // 13h
    expect(await page.evaluate(ev => (window as any).evState(ev), EV())).toBe('needsUpdate');
  });

  test('C5 · finished is distinct from needsUpdate and survives a re-save', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    // `store` is a top-level `const` in app.js, never a `window` property — window.store is always
    // undefined and w.store.set(...) throws before reaching the code under test (the exact gotcha
    // documented at tests/vg-classifier.spec.ts:54-59). String-form evaluate runs in the page's own
    // global scope, where the bare identifier `store` resolves via app.js's own top-level lexical scope.
    const out = await page.evaluate(`(function(){
      var ev = ${JSON.stringify(EV())};
      evSaveList([ev]); store.set('mk-active', ev.id);
      evFinish(ev.id);
      var after = evList()[0];
      evSaveCurrent(after.name, after.desc, after.date);        // a later save must not drop it
      return { state: evState(evList()[0]), kept: !!evList()[0].finishedAt };
    })()`);
    expect(out).toEqual({ state: 'finished', kept: true });
  });

  test('F-2 · evCookStarted — five witnesses, and "in doubt → started"', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-timers': JSON.stringify({}) });
    const r = await page.evaluate(`(function(){
      var clean = function(){ store.set('mk-plan-started-ev1', null); store.set('mk-timers', {});
                            store.set('mk-cook-live-ev1', null); store.set('mk-bcheck-due', {});
                            localStorage.removeItem('wpck:ev1:עטיפה'); };
      var out = {};
      clean(); out.none = evCookStarted('ev1');                                     // false — zero witnesses
      clean(); store.set('mk-plan-started-ev1', Date.now()); out.plan = evCookStarted('ev1');
      clean(); store.set('mk-timers', { 'st-ev1-x-smoke': { left: 60 } }); out.timer = evCookStarted('ev1');
      clean(); localStorage.setItem('wpck:ev1:עטיפה', '1'); out.check = evCookStarted('ev1');
      clean(); store.set('mk-cook-live-ev1', { startedAt: 1 }); out.live = evCookStarted('ev1');
      clean(); store.set('mk-bcheck-due', { 'st-ev1-x-bcheck@1': { tid: 'st-ev1-x-bcheck' } }); out.bchk = evCookStarted('ev1');
      // "in doubt → started" (F-2's own wording): a storage read throwing mid-lookup is the genuine
      // failure this owner ruling targets ("שגיאה לכיוון ההתראה עדיפה על שגיאה לכיוון השתיקה") — the
      // catch(e){return true} branch (app.js), never reached by the happy-path witnesses above.
      clean();
      var origGet = store.get;
      store.get = function(){ throw new Error('storage boom'); };
      try { out.storageThrows = evCookStarted('ev1'); } finally { store.get = origGet; }
      return out;
    })()`);
    expect(r).toEqual({ none: false, plan: true, timer: true, check: true, live: true, bchk: true, storageThrows: true });
  });

  // L42 — the real entry: cNavGo('events') is the exact click handler production wires to the "Events"
  // tab button, and cPaintEvents() (app.js) is what renders the list a real user scrolls. This drives
  // THAT path end to end and asserts on the rendered chip's presence, text, and data-evstate attribute —
  // not on evState() called directly. Both needsUpdate and finished are exercised, and the negative case
  // (a fresh planning event) proves the chip does NOT appear when it shouldn't.
  test('DoD-5/L42 · the events screen actually renders the needsUpdate/finished chips a user sees', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });   // 13h after ev1's 19:00 serve
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([
        EV({ id: 'ev1', name: 'שבת פגה' }),                                   // stale → needsUpdate
        EV({ id: 'ev2', name: 'חג הסתיים', finishedAt: Date.parse('2026-07-30T20:00:00') }),   // finished
        EV({ id: 'ev3', name: 'תכנון קרוב', date: '2026-08-05', serve: '19:00' }),               // future → planning, no chip
      ]),
    });
    await page.waitForFunction(`typeof cNavGo==='function' && typeof evState==='function'`);
    await page.evaluate(`cNavGo('events')`);
    await page.waitForSelector('.cevcard');

    const needsChip = page.locator('.cevcard', { hasText: 'שבת פגה' }).locator('[data-evstate="needsUpdate"]');
    await expect(needsChip).toBeVisible();
    await expect(needsChip).toContainText('דורש עדכון');

    const finishedChip = page.locator('.cevcard', { hasText: 'חג הסתיים' }).locator('[data-evstate="finished"]');
    await expect(finishedChip).toBeVisible();
    await expect(finishedChip).toContainText('הסתיים');

    // negative: the planning event's card renders with NO evstate chip at all.
    const planningCard = page.locator('.cevcard', { hasText: 'תכנון קרוב' });
    await expect(planningCard).toBeVisible();
    await expect(planningCard.locator('[data-evstate]')).toHaveCount(0);

    // DoD-8 visual evidence: both chips, real Hebrew, real 390x844 viewport (playwright.config.ts default).
    await page.screenshot({ path: '.superpowers/sdd/task-5-evstate-chips-he-390x844.png' });
  });

  // DoD-9 — the chips render correctly in Hebrew AND a second live language (ru), rendered-DOM check
  // (per L23/the TEST-AUTHORING-CONTRACT §6: verify in the rendered DOM, never a coverage proxy).
  test('DoD-9 · the state chips render in Russian too — no Hebrew leak', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-31T08:00:00') });
    await seedApp(page, {
      'mk-uilevel-asked': 'true',
      'mk-lang': JSON.stringify('ru'),
      'mk-timers': JSON.stringify({}),
      'mk-events': JSON.stringify([
        EV({ id: 'ev1', name: 'Stale RU', name_en: undefined }),
        EV({ id: 'ev2', name: 'Finished RU', finishedAt: Date.parse('2026-07-30T20:00:00') }),
      ]),
    });
    await page.waitForFunction(`(function(){ var g=window.__mkLangReady; return !!g && typeof g.then==='function'; })()`, undefined, { polling: 50 });
    await page.evaluate(() => (window as any).__mkLangReady);
    await page.waitForFunction(`typeof cNavGo==='function'`);
    await page.evaluate(`cNavGo('events')`);
    await page.waitForSelector('.cevcard');
    const needsChip = page.locator('[data-evstate="needsUpdate"]').first();
    const finishedChip = page.locator('[data-evstate="finished"]').first();
    await expect(needsChip).toBeVisible();
    await expect(finishedChip).toBeVisible();
    const needsText = (await needsChip.textContent()) ?? '';
    const finishedText = (await finishedChip.textContent()) ?? '';
    expect(needsText).not.toContain('דורש עדכון');   // no Hebrew leak
    expect(finishedText).not.toContain('הסתיים');    // no Hebrew leak
    await page.screenshot({ path: '.superpowers/sdd/task-5-evstate-chips-ru-390x844.png' });
  });
});
