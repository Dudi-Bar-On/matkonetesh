import { test, expect } from '@playwright/test';

// Combined multi-event timeline: every event's item-start actions merged onto one color-coded schedule.

test('combined timeline merges all events\' starts, sorted by time, color-coded per event', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.evaluate(`(function(){ var now=Date.now();
    store.set('mk-events', [
      {id:'ev-A', name:'חתונה', serve:'19:00', menu:{keys:['cut-1'],guests:8}, updated:now},
      {id:'ev-B', name:'בר מצווה', serve:'20:30', menu:{keys:['cut-4'],guests:12}, updated:now}
    ]);
  })()`);
  // the merged rows include items from both events, time-sorted
  const rows = await page.evaluate(`combinedEventsRows().map(function(r){return {name:r.name, ev:r.ev.name, t:r.start.getTime()};})`) as any[];
  expect(rows.length).toBe(2);
  expect(rows.map(r => r.ev)).toContain('חתונה');
  expect(rows.map(r => r.ev)).toContain('בר מצווה');
  expect(rows[0].t).toBeLessThanOrEqual(rows[1].t);   // sorted by start time

  // the events screen offers the combined view, and it renders color-coded rows + a legend
  await page.click('[data-cnav="events"]');
  await page.waitForSelector('#cetOpen');
  await page.click('#cetOpen');
  await page.waitForSelector('#panel .cet-row');
  expect(await page.evaluate(`document.querySelectorAll('#panel .cet-row').length`)).toBe(2);
  expect(await page.evaluate(`document.querySelectorAll('#panel .cet-legend .cet-leg').length`)).toBe(2);
});
