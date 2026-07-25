import { test, expect, seedApp } from './_fixtures';

// P0-app item 6 (spec §4.3) — the unconfigured branch of combinedEventsRows presumed ONE smoker and
// warned on any overlapping smoke window. Two symptoms from one assumption:
//   1. false-flags two events the user might well be running on two different smokers;
//   2. stays SILENT on two overlapping sous-vide baths, because only `.smoke` was ever inspected.
// R5 interim, owner-confirmed: assert nothing until equipment is configured — an honest "we don't know"
// in BOTH directions instead of a confident wrong answer in one and silence in the other. The bath-aware,
// device-aware heuristic is P7/P9's job. The CONFIGURED branch is untouched and must stay correct.
const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const EVENTS = JSON.stringify([
  { id: 'ev-A', name: 'חתונה',    serve: '19:00', date: day, menu: { keys: ['cut-1'], guests: 8 } },
  { id: 'ev-B', name: 'בר מצווה', serve: '19:00', date: day, menu: { keys: ['cut-7'], guests: 8 } },
]);
const boot = async (page: any, kit: any[] | null) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-events': EVENTS,
    'mk-tlstate-ev-A': JSON.stringify({ 'cut-1': { method: 'c:smoke', ready: true } }),
    'mk-tlstate-ev-B': JSON.stringify({ 'cut-7': { method: 'c:smoke', ready: true } }),
    ...(kit ? { 'mk-equipment': JSON.stringify(kit), 'mk-equip-set': 'true' } : {}),
  });
  await page.waitForFunction(`typeof combinedEventsRows==='function' && typeof equipConfigured==='function'`);
};
const BIG   = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט',  name: 'הנפח אביה 150', cap: { racks: 4, areaCm2: 6000 } }];
const SMALL = [{ id: 'd1', cat: 'smoker', type: 'קמאדו / קרמי', name: 'קמאדו',        cap: { racks: 1, areaCm2: 1650 } }];

test('R5: with NO equipment configured, overlapping smoke windows assert no contention', async ({ page }) => {
  await boot(page, null);
  expect(await page.evaluate(`equipConfigured()`)).toBe(false);
  const rows = await page.evaluate(`combinedEventsRows().map(r=>({ev:r.ev.id, smoke:!!r.smoke, contention:r.contention}))`) as any[];
  expect(rows.length).toBe(2);
  // fixture sanity: they really DO overlap in time, or this test proves nothing
  const raw = await page.evaluate(`(function(){const r=combinedEventsRows(); return r[0].smoke && r[1].smoke && r[0].smoke.start<r[1].smoke.end && r[1].smoke.start<r[0].smoke.end;})()`);
  expect(raw).toBe(true);
  expect(rows.some(r => r.contention)).toBe(false);
});

test('R5 consumer — the clash badge/clashNote and the home-screen badge vanish on the unconfigured path (DoD-5)', async ({ page }) => {
  await boot(page, null);
  const clashN = await page.evaluate(`combinedEventsRows().filter(r=>r.contention).length`) as number;
  expect(clashN).toBe(0);
  // consumer 1: combinedTimelineHTML's clash badge (.cet-warn span) and clashNote summary (.cet-clashnote
  // div). NOTE: the div's rendered class is "cet-clashnote" (lowercase) — checking for the JS variable
  // name "clashNote" (mixed case) would never match the HTML and the assertion would be vacuous either way.
  const html = await page.evaluate(`typeof combinedTimelineHTML==='function' ? combinedTimelineHTML() : ''`) as string;
  expect(html).not.toContain('cet-warn');
  expect(html).not.toContain('cet-clashnote');
  // consumer 2: renderHomeChrome()'s home-screen multi-event badge (.mev-warn span inside #cHomeMultiEv)
  const homeHtml = await page.evaluate(`(function(){ renderHomeChrome(); return document.getElementById('cHomeMultiEv').innerHTML; })()`) as string;
  expect(homeHtml).not.toContain('mev-warn');
});

test('R5 negative case — the CONFIGURED branch is untouched: distinct devices still no clash', async ({ page }) => {
  await boot(page, BIG);
  expect(await page.evaluate(`equipConfigured()`)).toBe(true);
  const rows = await page.evaluate(`combinedEventsRows().map(r=>r.contention)`) as boolean[];
  expect(rows.some(Boolean)).toBe(false);
});

test('R5 negative case — the CONFIGURED branch is untouched: a genuine over-capacity clash still fires', async ({ page }) => {
  await boot(page, SMALL);
  const rows = await page.evaluate(`combinedEventsRows().map(r=>r.contention)`) as boolean[];
  expect(rows.every(Boolean)).toBe(true);
});
