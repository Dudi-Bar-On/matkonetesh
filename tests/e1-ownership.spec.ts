import { test, expect, seedApp } from './_fixtures';

// E1 · Task 3 (spec §5.1/§5.2). EQM.ownership answers ok/missing/partial for a requires list by REUSING
// cookerCandidates (one policy: a grill can smoke, an oven can 'cook', a bath does sv) and then checking
// each row's capability (temp ceiling via maxC, hang via deviceCanHang, bath size via chooseBath).
// The three E3 gates will all read THIS verdict — B-i.1 "three capacity rules" closed to one, structurally.
const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof EQM==='object' && typeof deriveRequires==='function'`);
};
const SMOKER_BIG = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
const BATH       = [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [12, 20], maxC: 95 } }];
const own = (page: any, requires: any) =>
  page.evaluate(`EQM.ownership(${JSON.stringify(requires)})`) as Promise<any>;

test('missing — owning nothing of the kind answers missing, never ok (D11 spirit at ownership level)', async ({ page }) => {
  await boot(page, null);   // no kit at all
  const r = await own(page, [{ role: 'cook', kind: 'smoker', source: 'derived' }]);
  expect(r.ok).toBe(false);
  expect(r.missing.map((x: any) => x.kind)).toEqual(['smoker']);
  expect(r.partial).toEqual([]);
});

test('ok — owning a capable device of the kind answers ok', async ({ page }) => {
  await boot(page, SMOKER_BIG);
  const r = await own(page, [{ role: 'cook', kind: 'smoker', source: 'derived', capability: { maxTempC: 120 } }]);
  expect(r.ok).toBe(true);
  expect(r.missing).toEqual([]);
  expect(r.partial).toEqual([]);
});

test('partial — owning the kind but no unit meets the capability answers partial, not missing and not ok', async ({ page }) => {
  await boot(page, SMOKER_BIG);   // the cabinet maxes at 150°C
  const r = await own(page, [{ role: 'cook', kind: 'smoker', source: 'derived', capability: { maxTempC: 300 } }]);
  expect(r.ok).toBe(false);
  expect(r.missing).toEqual([]);                          // a smoker IS owned
  expect(r.partial.map((x: any) => x.kind)).toEqual(['smoker']);   // but none reaches 300°C
});

test('partial — a bath is owned but none is large enough (chooseBath) answers partial', async ({ page }) => {
  await boot(page, BATH);   // owns 12 L + 20 L baths
  const r = await own(page, [{ role: 'cook', kind: 'bath', source: 'derived', capability: { bathMinL: 40 } }]);
  expect(r.ok).toBe(false);
  expect(r.partial.map((x: any) => x.kind)).toEqual(['bath']);
});

test('ok — the bath IS big enough answers ok (the positive twin of the previous negative)', async ({ page }) => {
  await boot(page, BATH);
  const r = await own(page, [{ role: 'cook', kind: 'bath', source: 'derived', capability: { bathMinL: 18 } }]);
  expect(r.ok).toBe(true);
});

test('end-to-end — ownership of a real item derived list is consistent with the seeded kit', async ({ page }) => {
  await boot(page, SMOKER_BIG.concat(BATH));
  const r = await page.evaluate(`(function(){
    var reqs=deriveRequires(resolveItem('cut-1'),'c:sv_smoke');
    return EQM.ownership(reqs);
  })()`) as any;
  expect(typeof r.ok).toBe('boolean');
  expect(Array.isArray(r.missing) && Array.isArray(r.partial)).toBe(true);
});

test('DoD-10 safety invariance — an ownership round-trip never mutates the item object or its stages', async ({ page }) => {
  await boot(page, SMOKER_BIG.concat(BATH));
  const snap = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    var b={ obj:JSON.stringify(m.obj), st:JSON.stringify(itemStages(m,'c:sv_smoke',true)) };
    EQM.ownership(deriveRequires(m,'c:sv_smoke'));
    var a={ obj:JSON.stringify(m.obj), st:JSON.stringify(itemStages(m,'c:sv_smoke',true)) };
    return { objEq:b.obj===a.obj, stEq:b.st===a.st };
  })()`) as any;
  expect(snap.objEq).toBe(true);
  expect(snap.stEq).toBe(true);
});
