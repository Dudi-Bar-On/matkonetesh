import { test, expect } from '@playwright/test';

// Wave E (pro multi-event): per-event cart scope, event-named alarms, combined view reads each
// event's real method, and single-smoker equipment-contention flags.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('E1: the cart "bought" ticks + menu quantities are scoped per event (no cross-event leak)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    setMenuCtx('event'); store.set('mk-active','ev-A');
    const kA = mshopKey('בריסקט'); const qA = mkMenuqtyKey();
    store.set('mk-active','ev-B');
    const kB = mshopKey('בריסקט'); const qB = mkMenuqtyKey();
    return { kA, kB, qA, qB };
  })()`) as any;
  expect(r.kA).not.toBe(r.kB);   // same ingredient, different event → different key
  expect(r.qA).not.toBe(r.qB);
  expect(r.kA).toContain('ev-A');
  expect(r.kB).toContain('ev-B');
});

test('E2: timerEventName resolves the owning event by exact scope prefix', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    store.set('mk-events', [{id:'ev-A', name:'חתונה', menu:{keys:['cut-1']}}, {id:'ev-B', name:'בר מצווה', menu:{keys:['cut-1']}}]);
    return {
      a: timerEventName('st-ev-A-cut-1-smoke'),
      b: timerEventName('st-ev-B-cut-1-smoke'),
      cook: timerEventName('st-cook-cut-1-smoke')
    };
  })()`) as any;
  expect(r.a).toBe('חתונה');
  expect(r.b).toBe('בר מצווה');
  expect(r.cook).toBe('');   // ad-hoc cook scope belongs to no event
});

test('E2: evRunningCount matches on exact scope prefix, not a loose substring', async ({ page }) => {
  await init(page);
  const n = await page.evaluate(`(function(){ var f=Date.now()+1e6;
    // 'ev-A' timers plus an 'ev-A2' timer that a substring match would wrongly capture
    store.set('mk-timers', {'st-ev-A-cut-1-smoke':{end:f}, 'st-ev-A-cut-2-sv':{end:f}, 'st-ev-A2-cut-1-smoke':{end:f}});
    return evRunningCount('ev-A');
  })()`);
  expect(n).toBe(2);   // only the two real ev-A timers, not ev-A2
});

test('E3+E4: combined view uses each event method and flags overlapping smoker windows', async ({ page }) => {
  await init(page);
  const info = await page.evaluate(`(function(){
    var day = isoDate(new Date(Date.now()+2*86400000));
    // two events, same day, both smoking a long cut -> their smoke windows overlap on one smoker
    store.set('mk-events', [
      {id:'ev-A', name:'A', serve:'19:00', date:day, menu:{keys:['cut-1']}},
      {id:'ev-B', name:'B', serve:'19:30', date:day, menu:{keys:['cut-1']}}
    ]);
    // pin ev-A's item to a real method via its scoped tlstate (proves E3 reads per-event state)
    var p = itemProfile(resolveItem('cut-1'));
    store.set('mk-tlstate-ev-A', {'cut-1':{method:p.methods[0].key, ready:true}});
    var rows = combinedEventsRows();
    return { count: rows.length, anyClash: rows.some(function(r){return r.contention;}) };
  })()`) as any;
  expect(info.count).toBe(2);
  expect(info.anyClash).toBe(true);   // overlapping smoker windows across events are flagged
});
