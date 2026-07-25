import { test, expect, seedApp } from './_fixtures';

// CP1 · Task 1 (spec 2026-07-25 §2-§3). itemPaths + effectiveSchedule — the ONE accessor every surface
// (timeline/planner/voice/AI) will read for a cited cooking schedule. itemPaths ENUMERATES what the
// item's citations support (one entry per profile method, plus a reverse-order entry ONLY where
// comboHasSvSmoke says the citation exists — no formula paths). effectiveSchedule resolves a selection
// (or the default path) to itemStages' own untransformed output, so every consumer inherits the same
// cited-aware labels/temps (v264 Waves A/C) identically.
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof resolveItem==='function'`);
};

test('itemPaths enumerates cited paths: brisket has the sv+smoke combo in BOTH cited orders + its other methods', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`itemPaths(resolveItem('cut-1')).map(p=>p.id)`) as string[];
  expect(r.some(id=>id.includes('smoke_sv') && !id.includes('rev'))).toBe(true);   // default order entry
  expect(r.some(id=>id.includes('rev'))).toBe(true);                               // cited reverse order entry
  expect(new Set(r).size).toBe(r.length);                                          // unique ids
});
test('reverse-order path appears ONLY where cited (negative case)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-103');   // no order_smokesv (verified in Wave C tests)
    return itemPaths(m).filter(p=>p.order==='smoke-sv').length;
  })()`) as number;
  expect(r).toBe(0);
});
test('effectiveSchedule default === itemStages default (identity, byte-for-byte)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    return JSON.stringify(effectiveSchedule(m).stages)===JSON.stringify(itemStages(m, undefined, true));
  })()`) as boolean;
  expect(r).toBe(true);
});
test('effectiveSchedule respects an explicit selection', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(function(){
    const m=resolveItem('cut-1');
    const s=effectiveSchedule(m, {methodKey:'c:smoke_sv', order:'smoke-sv'}).stages;
    const sm=s.find(x=>x.kind==='smoke');
    return sm ? sm.temp : null;
  })()`) as number;
  expect(r).toBe(75);   // the cited reverse-order warm smoke
});
