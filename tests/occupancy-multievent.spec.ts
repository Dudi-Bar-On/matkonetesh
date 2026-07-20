import { test, expect } from '@playwright/test';

// Task 9: combinedEventsRows() (the multi-event view) must derive contention from the SAME occupancy
// model as single-event cookerContention — not from a bare time-overlap check. Two events, each with
// one cut, whose smoke windows overlap and which share ONE physical smoker: a spacious cabinet smoker
// fits both (no contention — the exact false positive Task 5 already removed from the single-event
// path); a cramped single-grate kamado does not (genuine over-capacity contention).

const boot = async (page: any, kit: any[]) => {
  await page.addInitScript(([k]: [any[]]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-equipment', JSON.stringify(k));
    localStorage.setItem('mk-equip-set', JSON.stringify(true));
    const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    localStorage.setItem('mk-events', JSON.stringify([
      { id: 'ev-A', name: 'חתונה', serve: '19:00', date: day, menu: { keys: ['cut-1'], guests: 8 } },
      { id: 'ev-B', name: 'בר מצווה', serve: '19:00', date: day, menu: { keys: ['cut-7'], guests: 8 } }
    ]));
    // pin both events to the plain smoke-only method (matches occupancy-clash.spec.ts C1/C2 fixtures:
    // cut-1 = brisket, footprint 1320 cm², smoke-only 110°C/12h; cut-7 = spareribs, 360 cm², 107°C/5h)
    localStorage.setItem('mk-tlstate-ev-A', JSON.stringify({ 'cut-1': { method: 'c:smoke', ready: true } }));
    localStorage.setItem('mk-tlstate-ev-B', JSON.stringify({ 'cut-7': { method: 'c:smoke', ready: true } }));
  } catch {} }, [kit]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof combinedEventsRows==='function' && typeof deviceOccupancy==='function'`);
};

const BIG   = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט',  name: 'הנפח אביה 150', cap: { racks: 4, areaCm2: 6000 } }];
const SMALL = [{ id: 'd1', cat: 'smoker', type: 'קמאדו / קרמי', name: 'קמאדו',        cap: { racks: 1, areaCm2: 1650 } }];

test('M1: two events sharing a spacious cabinet smoker with overlapping smoke windows is NOT a clash (they fit)', async ({ page }) => {
  await boot(page, BIG);
  const rows = await page.evaluate(`combinedEventsRows().map(function(r){return {key:r.key, ev:r.ev.id, smoke:r.smoke, contention:r.contention};})`) as any[];
  expect(rows.length).toBe(2);
  // sanity: the fixture really does overlap in time (otherwise this test proves nothing)
  const a = rows.find((r: any) => r.ev === 'ev-A')!, b = rows.find((r: any) => r.ev === 'ev-B')!;
  expect(a.smoke && b.smoke).toBeTruthy();
  expect(a.smoke.start < b.smoke.end && b.smoke.start < a.smoke.end).toBe(true);
  // but the occupancy model says they fit on the 4-rack cabinet — no contention
  expect(rows.some((r: any) => r.contention)).toBe(false);
});

test('M2: the same pair on a single-grate kamado IS a clash, for genuine over-capacity', async ({ page }) => {
  await boot(page, SMALL);
  const rows = await page.evaluate(`combinedEventsRows().map(function(r){return {key:r.key, ev:r.ev.id, contention:r.contention};})`) as any[];
  expect(rows.length).toBe(2);
  expect(rows.every((r: any) => r.contention)).toBe(true);
});
