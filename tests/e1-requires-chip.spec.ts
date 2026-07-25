import { test, expect, seedApp } from './_fixtures';

// E1 · Task 4 (spec §5.2, DoD-5/L8). The catalog card renders the derived requirement + ownership verdict
// as a NON-BLOCKING informational chip — the production reader that makes deriveRequires + EQM.ownership
// fire on real catalog data. Gated on equipConfigured() so it is meaningful (you have a kit) and free
// otherwise. E3 later escalates the SAME verdict into the bold-invalid blocking gate.
const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmRequiresChip==='function' && typeof equipConfigured==='function'`);
};
const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];

test('with a kit, the chip renders the derived required kind for a smoking cut', async ({ page }) => {
  await boot(page, SMOKER);
  const html = await page.evaluate(`eqmRequiresChip('cut-1')`) as string;
  expect(html).toContain('eqm-reqs');
  expect(html).toContain('מעשנה');            // the smoker requirement, in Hebrew (proposed copy)
});

test('the ownership verdict colours the chip — a missing kind gets the missing class', async ({ page }) => {
  // owns only a bath: a smoking cut's smoker requirement is missing.
  await boot(page, [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [20] } }]);
  const html = await page.evaluate(`eqmRequiresChip('cut-1')`) as string;
  expect(html).toContain('מעשנה');
  expect(html).toContain('eqm-req-missing');
});

test('L13 — any capability numeral sits in a dir="ltr" island', async ({ page }) => {
  await boot(page, SMOKER);
  const html = await page.evaluate(`(function(){
    // a sous-vide requirement carries a bath-litre capability number
    return eqmRequiresChip('cut-1');
  })()`) as string;
  if (/eqm-num/.test(html)) expect(html).toMatch(/dir="ltr"[^>]*class="eqm-num"|class="eqm-num"[^>]*dir="ltr"/);
});

test('the real card HTML carries the chip (the wiring, not just the helper) — cutCard', async ({ page }) => {
  await boot(page, SMOKER);
  const html = await page.evaluate(`cutCard(DATA.cuts.find(c=>'cut-'+c.n==='cut-1'))`) as string;
  expect(html).toContain('eqm-reqs');
});

test('DoD-6 negative case — with NO kit configured the chip is silent (gated, zero cost)', async ({ page }) => {
  await boot(page, null);
  expect(await page.evaluate(`equipConfigured()`)).toBe(false);
  expect(await page.evaluate(`eqmRequiresChip('cut-1')`)).toBe('');
  expect(await page.evaluate(`cutCard(DATA.cuts.find(c=>'cut-'+c.n==='cut-1'))`)).not.toContain('eqm-reqs');
});

test('DoD-10 safety invariance — rendering the chip never mutates the item object', async ({ page }) => {
  await boot(page, SMOKER);
  const eq = await page.evaluate(`(function(){
    var b=JSON.stringify(resolveItem('cut-1').obj);
    eqmRequiresChip('cut-1'); eqmRequiresChip('cut-1');
    return b===JSON.stringify(resolveItem('cut-1').obj);
  })()`) as boolean;
  expect(eq).toBe(true);
});
