import { test, expect, seedApp } from './_fixtures';

// P0-app item 5 (spec §4.2) — ULTIMATE A9. new Date('YYYY-MM-DD') parses as UTC; setDate() mutates in
// LOCAL time; toISOString() reads back in UTC. When the added span crosses a local DST transition the
// offsets differ at the two ends and the round-trip LOSES a day — always loses, never gains — so a cure
// or dry reminder fires EARLY, shortening the effective cure below what the plan intended.
//
// H1: the warm page is worker-scoped and is built by browser.newContext() forwarding only a fixed list
// of project options (tests/_fixtures.ts:72-101). It does NOT read per-file test.use() overrides, so
// `timezoneId` would be silently ignored on the default `page`. isolatedPage runs in the test's OWN
// built-in context, where test.use() applies — the fixture file says exactly this at line 149.
test.use({ timezoneId: 'Asia/Jerusalem' });

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof addDays==='function'`);
};

test('A9: addDays does not lose a day across the Israel DST transition', async ({ isolatedPage }) => {
  await boot(isolatedPage);
  // Israel moves to DST on 2026-03-27. Both spans straddle it.
  expect(await isolatedPage.evaluate(`addDays('2026-03-26',2)`)).toBe('2026-03-28');   // today: 2026-03-27
  expect(await isolatedPage.evaluate(`addDays('2026-03-26',14)`)).toBe('2026-04-09');  // today: 2026-04-08
});

test('A9: the fixed date is never EARLIER than the buggy one — the error direction is corrected, not inverted', async ({ isolatedPage }) => {
  await boot(isolatedPage);
  // Compare the two implementations side by side rather than trusting the two point values above.
  // A cure reminder must never move earlier; extending or preserving is safe, shortening is the defect.
  const cmp = await isolatedPage.evaluate(`(function(){
    function old(d,n){const x=new Date(d);x.setDate(x.getDate()+(+n||0));return x.toISOString().slice(0,10);}
    const out=[];
    for(let n=1;n<=30;n++){ out.push([old('2026-03-26',n), addDays('2026-03-26',n)]); }
    return out;
  })()`) as [string, string][];
  for (const [oldVal, newVal] of cmp) expect(newVal >= oldVal).toBe(true);
  expect(cmp.some(([o, n]) => n !== o)).toBe(true);   // the fix must actually change something (L19)
});

test('A9 negative case — a span with no transition inside it is unchanged (DoD-6)', async ({ isolatedPage }) => {
  await boot(isolatedPage);
  expect(await isolatedPage.evaluate(`addDays('2026-05-01',10)`)).toBe('2026-05-11');
  expect(await isolatedPage.evaluate(`addDays('2026-01-15',1)`)).toBe('2026-01-16');
  expect(await isolatedPage.evaluate(`addDays('2026-01-15',0)`)).toBe('2026-01-15');
});
