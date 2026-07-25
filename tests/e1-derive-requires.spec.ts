import { test, expect, seedApp } from './_fixtures';

// E1 · Task 2 (spec §4.2). deriveRequires reads the SAME stages the plan computes (itemStages) and emits
// ONE cook-device requires row per smoke/sv/cook stage — never for prep/note/dry/rest/bcheck. It reads no
// equipment-registry state (pure projection), so it can never disagree with the plan (anti-drift).
const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.waitForFunction(`typeof deriveRequires==='function' && typeof resolveItem==='function' && typeof itemStages==='function'`);
};
// derive for an item key under its default method; returns the requires[] array.
const derive = (page: any, key: string) =>
  page.evaluate(`(function(){ var m=resolveItem('${key}'); return m?deriveRequires(m):null; })()`) as Promise<any[]>;

test('a smoking cut derives exactly one smoker cook row, with the cited smoke temp as a capability', async ({ page }) => {
  await boot(page);
  // cut-1 (brisket): a smoke method exists; its stage carries a cited smTemp. deriveRequires must emit a
  // single {role:'cook', kind:'smoker', source:'derived'} with capability.maxTempC = that temp.
  const rows = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    // force the plain smoke combo so the shape is deterministic
    return deriveRequires(m, 'c:smoke');
  })()`) as any[];
  const smoker = rows.filter(r => r.kind === 'smoker');
  expect(smoker.length).toBe(1);
  expect(smoker[0].role).toBe('cook');
  expect(smoker[0].source).toBe('derived');
  expect(smoker[0].capability && typeof smoker[0].capability.maxTempC).toBe('number');
  // NEGATIVE (the anti-over-emission guard): NO row for prep/rest/bcheck — a naive one-row-per-stage
  // implementation would wrongly emit several. Only device kinds are allowed.
  expect(rows.every(r => ['smoker','bath','grill'].includes(r.kind))).toBe(true);
});

test('a sous-vide stage derives a bath row carrying a litres demand and a bathMinL capability', async ({ page }) => {
  await boot(page);
  // cut-1 under a sous-vide combo: expect a {kind:'bath'} row. When the recipe carries a min_bath_l /
  // footprint, demand + capability.bathMinL are present; when it doesn't, the row still exists (kind only).
  const rows = await page.evaluate(`deriveRequires(resolveItem('cut-1'), 'c:sv')`) as any[];
  const bath = rows.filter(r => r.kind === 'bath');
  expect(bath.length).toBeGreaterThanOrEqual(1);
  expect(bath[0].role).toBe('cook');
  // if a bath volume is cited, it must surface as BOTH a litres demand and a bathMinL capability (same source)
  if (bath[0].demand) {
    expect(bath[0].demand.metric).toBe('litres');
    expect(bath[0].capability.bathMinL).toBe(bath[0].demand.amount);
  }
});

test('a sv+smoke combo derives BOTH a bath and a smoker row (sv covered day one, unlike equipPlan)', async ({ page }) => {
  await boot(page);
  // NOTE: verified against the live app (itemProfile(resolveItem('cut-1')).methods.map(m=>m.key)) — the
  // combo-key sort is lexicographic ('smoke' < 'sv'), so the real key is 'c:smoke_sv', not 'c:sv_smoke'.
  const kinds = await page.evaluate(`deriveRequires(resolveItem('cut-1'), 'c:smoke_sv').map(r=>r.kind).sort()`) as string[];
  expect(kinds).toContain('bath');
  expect(kinds).toContain('smoker');
});

test('DoD-6 negative case — an item whose stages carry NO smoke/sv/cook device stage derives an empty list', async ({ page }) => {
  await boot(page);
  // Review finding (Spec gap): the old version of this test ran on cut-1's normal combo, which is NEVER
  // empty, so `rows.length===0` was never actually exercised. Verified LIVE against the full built catalog
  // (all 130 cuts + 47 specials + 102 makes, every one of their real method keys — 279 items) that NO real
  // item+method combination produces a stage list with zero smoke/sv/cook stages: this app's whole premise
  // is live-fire cooking, so every real recipe ends in at least one device stage (confirmed via a throwaway
  // enumeration script against dist/index.html; 0/279 items had an empty case — a produce/spec item was NOT
  // available as the brief hypothesized). So this test exercises the REAL skip predicate
  // (`REQ_KIND[s.kind]` — the same one `deriveRequires` calls) against a REAL non-device stage tail taken
  // verbatim from a REAL item's REAL itemStages() output (cut-1, 'c:smoke_sv': dry/rest/bcheck), by
  // temporarily substituting what itemStages returns for the duration of ONE call — deriveRequires itself
  // runs unmodified and its actual RETURNED value is what gets asserted empty.
  const rows = await page.evaluate(`(function(){
    var m = resolveItem('cut-1');
    var real = itemStages(m, 'c:smoke_sv', true);                       // REAL stages of a REAL item+method
    var nonDevice = real.filter(function(s){ return !REQ_KIND[s.kind]; }); // the REAL non-device tail (dry/rest/bcheck)
    var orig = itemStages;
    itemStages = function(){ return nonDevice; };    // a "filtered order/method": only non-device stages reach deriveRequires
    try { return deriveRequires(m, 'c:smoke_sv'); } finally { itemStages = orig; }
  })()`) as any[];
  expect(Array.isArray(rows)).toBe(true);           // never null/undefined
  expect(rows.length).toBe(0);                       // the actual negative: an OBSERVABLY empty result
});

test('DoD-10 safety invariance — deriving never mutates the item object or its itemStages output', async ({ page }) => {
  await boot(page);
  const snap = await page.evaluate(`(function(){
    var m=resolveItem('cut-1');
    var before={ obj:JSON.stringify(m.obj), stages:JSON.stringify(itemStages(m,'c:smoke_sv',true)) };
    deriveRequires(m,'c:smoke_sv'); deriveRequires(m,'c:smoke'); deriveRequires(m,'c:sv');
    var after={ obj:JSON.stringify(m.obj), stages:JSON.stringify(itemStages(m,'c:smoke_sv',true)) };
    return { objEq: before.obj===after.obj, stagesEq: before.stages===after.stages };
  })()`) as any;
  expect(snap.objEq).toBe(true);
  expect(snap.stagesEq).toBe(true);
});

test('CRITICAL fix — deriveRequires is a PURE projection: rows are identical regardless of the owned-equipment registry', async ({ page }) => {
  // Review finding: deriveRequires used to call itemOccupancy(meta, s.kind, null), whose standalone
  // (dev=null) path runs ownsHangingDevice() -> equipList() -> localStorage 'mk-equipment' — LIVE registry
  // state. Two calls on the IDENTICAL item could return different rows purely because owned equipment
  // changed, which violates the spec's "PURE projection of recipe data — no registry reads" property. The
  // fix reads itemStageSpec(meta, stageKind) (recipe-static merge only) instead.
  await boot(page);   // registry EMPTY — boot() seeds no 'mk-equipment' key at all
  // A REAL hang-class item, found LIVE (never guessed) — 'm-frank' (frankfurters) carries
  // equip.spec.hang='short' and has exactly one method ('smoke'), so its default stage kind is
  // deterministic. Verified live: Object.keys(DATA.makes) enumerated for any equip.spec.hang.
  const key = await page.evaluate(`(function(){
    return Object.keys(DATA.makes).find(function(k){ var e=DATA.makes[k].equip; return e && e.spec && e.spec.hang; });
  })()`) as string;
  expect(key).toBeTruthy();

  const rowsEmptyRegistry = await page.evaluate(`deriveRequires(resolveItem('make-${key}'))`) as any[];
  expect(rowsEmptyRegistry.length).toBeGreaterThan(0);   // sanity: the item DOES derive a device row

  // Reboot with a REAL hang-capable device seeded — shape copied from occupancy-hanging.spec.ts's
  // CABINET_WITH_HOOKS fixture (canHang:true, hooks:8). SAME item; ONLY the registry changed.
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-equipment': JSON.stringify([
      { id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, canHang: true, hooks: 8 } },
    ]),
    'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof deriveRequires==='function' && typeof resolveItem==='function'`);
  const rowsSeededRegistry = await page.evaluate(`deriveRequires(resolveItem('make-${key}'))`) as any[];

  // THE fix: identical recipe, identical stages -> identical rows. Registry ownership must never matter.
  expect(rowsSeededRegistry).toEqual(rowsEmptyRegistry);

  // The row must carry the recipe's hang PREFERENCE as a capability REGARDLESS of ownership — whether an
  // owned device actually satisfies it is resolved per-device at ownership time (Task 3, EQM.ownership),
  // not here. If a footprint were also cited, the area demand would coexist on the SAME row (capability?
  // and demand? are independent optionals in the schema) — asserted conditionally since this item's data
  // carries no footprint_cm2 (make_equip() never sets it for makes, verified live).
  const hungRow = rowsEmptyRegistry.find((r: any) => r.capability && r.capability.hang);
  expect(hungRow).toBeTruthy();
  if (hungRow.demand) expect(hungRow.demand.metric).toBe('area_cm2');
});
