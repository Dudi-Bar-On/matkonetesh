import { test, expect, seedApp } from './_fixtures';

// R-57 §4.4, owner ruling (1.8.2026) — on setting a new serve time for a needsUpdate/finished event, ask
// the user whether to continue or restart; the app cannot tell a half-finished cook from an abandoned
// one. wpck: (work-plan check-offs) had NO reset path before this task (verified against
// resetPlanTimers/evDelete/tlReset) — evClearProgress is that path's first implementation.
//
// `store` is a top-level `const` in app.js, never a `window` property — `window.store` is always
// undefined (the exact gotcha documented at tests/vg-classifier.spec.ts:54-59 and reused throughout
// tests/vg-evstate.spec.ts). String-form page.evaluate runs in the page's own global scope, where the
// bare identifier `store` resolves via app.js's own top-level lexical scope — used below wherever a test
// needs to read/write `store` directly rather than through a function app.js already exposes on window.

const STALE = { id: 'ev1', name: 'שבת שעברה', date: '2026-07-25', serve: '19:00',
                menu: { keys: [] }, created: 1, updated: 1 };

test.describe('R-57 §4.4 · continue vs start over', () => {
  test('C7 · "המשך" keeps wpck: and drops ONLY fired timer records', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': JSON.stringify([STALE]), 'mk-active': JSON.stringify('ev1'),
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: 1, name: 'a', fired: 1 },
                                    'st-ev1-b-smoke': { end: Date.parse('2026-08-01T20:00:00'), name: 'b' } }),
      'mk-bcheck-due': JSON.stringify({ 'st-ev1-a-bcheck@1': { tid: 'st-ev1-a-bcheck', acked: true },
                                        'st-ev1-b-bcheck@1': { tid: 'st-ev1-b-bcheck', acked: false } }) });
    const after = await page.evaluate(`(function(){
      localStorage.setItem('wpck:ev1:עטיפה', '1');
      evKeepProgress('ev1');
      return { wpck: localStorage.getItem('wpck:ev1:עטיפה'),
               timers: Object.keys(store.get('mk-timers') || {}),
               bcheck: Object.keys(store.get('mk-bcheck-due') || {}) };
    })()`) as { wpck: string; timers: string[]; bcheck: string[] };
    expect(after.wpck).toBe('1');
    expect(after.timers).toEqual(['st-ev1-b-smoke']);        // fired one gone, running one kept
    expect(after.bcheck).toEqual(['st-ev1-a-bcheck@1']);     // acked kept, unacked dropped
  });

  test('C8 · "התחל מחדש" wipes EVERY wpck: of this event and no other event\'s', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': JSON.stringify([STALE]), 'mk-active': JSON.stringify('ev1'),
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { left: 60 } }),
      'mk-plan-started-ev1': JSON.stringify(1),
      'mk-tlstate-ev1': JSON.stringify({ k1: { method: 'smoke', ready: true } }) });
    const after = await page.evaluate(`(function(){
      localStorage.setItem('wpck:ev1:עטיפה', '1');
      localStorage.setItem('wpck:ev1:חיתוך', '1');
      localStorage.setItem('wpck:ev2:אחר', '1');            // a DIFFERENT event — must survive
      var n = evClearProgress('ev1');
      return { n: n, mine: localStorage.getItem('wpck:ev1:עטיפה'), other: localStorage.getItem('wpck:ev2:אחר'),
               started: store.get('mk-plan-started-ev1'),
               timers: Object.keys(store.get('mk-timers') || {}),
               plan: store.get('mk-tlstate-ev1') };
    })()`) as any;
    expect(after.n.wpck).toBe(2);
    expect(after.mine).toBeNull();
    expect(after.other).toBe('1');                            // NEGATIVE: scope-exact, never a prefix sweep
    expect(after.started).toBeFalsy();
    expect(after.timers).toEqual([]);
    expect(after.plan).toBeTruthy();                          // planning choices survive (spec §4.4)
  });

  test('NEGATIVE · the gate does NOT fire for a planning/active event', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-07-30T10:00:00') });   // before serve → planning
    await seedApp(page, { 'mk-uilevel-asked': 'true',
      'mk-events': JSON.stringify([{ ...STALE, date: '2026-07-30' }]), 'mk-active': JSON.stringify('ev1'),
      'mk-timers': JSON.stringify({}) });
    const wrote = await page.evaluate(() => {
      const w = window as any; let done = false;
      w.evServeWriteGate(() => { done = true; });
      return { done, dialog: !!document.querySelector('#appdlg') };
    });
    expect(wrote.done).toBe(true);        // written synchronously, no question asked
    expect(wrote.dialog).toBe(false);
  });

  test('NEGATIVE · a LIVE (active) event with a running timer is also not gated (4.2a)', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });   // 17h after serve — would be
    await seedApp(page, { 'mk-uilevel-asked': 'true',                      // needsUpdate WITHOUT the timer
      'mk-events': JSON.stringify([STALE]), 'mk-active': JSON.stringify('ev1'),
      'mk-timers': JSON.stringify({ 'st-ev1-a-smoke': { end: Date.parse('2026-08-01T20:00:00'), name: 'a' } }) });
    const wrote = await page.evaluate(() => {
      const w = window as any; let done = false;
      w.evServeWriteGate(() => { done = true; });
      return { done, dialog: !!document.querySelector('#appdlg') };
    });
    expect(wrote.done).toBe(true);
    expect(wrote.dialog).toBe(false);
  });

  test('C9 · after a re-arm, alerts fire against the NEW instant and no backlog replays',
    async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-events': JSON.stringify([STALE]), 'mk-active': JSON.stringify('ev1'),
      'mk-timers': JSON.stringify({}), 'mk-bcheck-due': JSON.stringify({}) });
    await page.evaluate(() => {
      const w = window as any;
      w.evUnfinish('ev1');
      w.scheduleBcheckDue([{ blocked: false, m: { heb: 'חזה', key: 'k1' },
        stages: [{ kind: 'bcheck', start: new Date(Date.now() + 4000), tid: 'st-ev1-k1-bcheck', temp: 74 }] }], []);
    });
    await expect(page.locator('#mkBcheckAlarm')).toHaveCount(0);   // nothing replays at t0
    await page.clock.fastForward(5000);
    await page.waitForFunction(() => !!document.getElementById('mkBcheckAlarm'));
  });

  // L42 — real entry: the actual #tlServeDate date input inside the real Timeline panel (openTimeline() →
  // buildList()), the exact input a user drags/taps to reschedule. Drives evServeWriteGate through its
  // real DOM wiring, asserts on the real appConfirm dialog (#appdlg) and its two real buttons, not on a
  // hand-called evServeWriteGate(fn).
  test('DoD-5/L42 · changing the real #tlServeDate on a needsUpdate event opens the real continue/restart dialog', async ({ isolatedPage: page }) => {
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
      localStorage.setItem('wpck:ev-real:${encodeURIComponent('עטיפה')}', '1');   // real prior progress
    })()`);
    await page.evaluate('openTimeline()');
    await page.waitForSelector('#tlServeDate');
    await page.screenshot({ path: '.superpowers/sdd/task-7-gate-before-he-390x844.png' });

    await page.fill('#tlServeDate', '2026-08-03');
    await page.dispatchEvent('#tlServeDate', 'change');

    const dlg = page.locator('#appdlg');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('מהבישול הקודם');
    await expect(dlg.locator('[data-adk="ok"]')).toContainText('המשך מאיפה שהפסקתי');
    await expect(dlg.locator('[data-adk="cancel"]')).toContainText('התחל מחדש');
    await page.screenshot({ path: '.superpowers/sdd/task-7-gate-dialog-he-390x844.png' });

    // dismissed via the scrim → the serve date must NOT have been written. The scrim covers the full
    // viewport (inset:0) while the card is centered on top of it, so a plain center-click on the scrim
    // locator lands ON the card (390×844 leaves little scrim margin) — click a corner instead.
    await page.click('.appdlg-scrim', { position: { x: 5, y: 5 } });
    await expect(dlg).toHaveCount(0);
    const untouchedDate = await page.evaluate(`localStorage.getItem(serveDateKey())`);
    expect(JSON.parse((untouchedDate as string) || 'null')).toBe('2026-08-01');

    // real "continue" click — the date DOES get written, and the check-off survives.
    await page.fill('#tlServeDate', '2026-08-03');
    await page.dispatchEvent('#tlServeDate', 'change');
    await expect(page.locator('#appdlg')).toBeVisible();
    await page.click('[data-adk="ok"]');
    await page.waitForFunction(() => !document.getElementById('appdlg'));
    await page.waitForFunction(`localStorage.getItem(serveDateKey()) === JSON.stringify('2026-08-03')`);
    expect(await page.evaluate(`localStorage.getItem('wpck:ev-real:${encodeURIComponent('עטיפה')}')`)).toBe('1');
  });

  test('DoD-9 · the dialog renders in Russian too — no Hebrew leak', async ({ isolatedPage: page }) => {
    await page.clock.install({ time: new Date('2026-08-01T12:00:00') });
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('ru'),
      'mk-events': JSON.stringify([STALE]), 'mk-active': JSON.stringify('ev1'), 'mk-timers': JSON.stringify({}) });
    await page.waitForFunction(`(function(){ var g=window.__mkLangReady; return !!g && typeof g.then==='function'; })()`, undefined, { polling: 50 });
    await page.evaluate(() => (window as any).__mkLangReady);
    await page.evaluate(() => (window as any).evServeWriteGate(() => {}));
    const dlg = page.locator('#appdlg');
    await expect(dlg).toBeVisible();
    const text = (await dlg.textContent()) ?? '';
    expect(text).not.toContain('מצאנו סימונים');
    expect(text).not.toContain('המשך מאיפה שהפסקתי');
    expect(text).not.toContain('התחל מחדש');
    await page.screenshot({ path: '.superpowers/sdd/task-7-gate-dialog-ru-390x844.png' });
  });
});
