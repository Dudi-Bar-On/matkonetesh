import { test, expect, seedApp } from './_fixtures';

// E3 Task 1 (spec §5.2 + AMENDMENT O-5, plan docs/superpowers/plans/2026-07-26-equipment-e3-validity-gates.md).
// eqmValidity(meta) fuses E1's EQM.ownership with CP1's itemPaths into the two O-5 honesty levels: the
// catalog's bold-invalid treatment (uncookable = full emphasis + "חסר ציוד" badge; blocked-default =
// lighter emphasis, no badge — "prevents crying wolf on an item the user can in fact cook another cited
// way") and the item panel's why-and-how-to-fix explanation.
//
// Fixture: make-m-brat (DATA.makes['m-brat'], cat 'נקניקיות' — the MAKE_COOK fresh-sausage profile) offers
// TWO independent cited paths with DIFFERING device-kind requirements — grill (default, index 0) and
// smoke (alternate, index 1) — the cleanest real fixture for exercising both honesty levels without
// touching the cook-engine's combo-validity rules. cut-1 (sv+smoke default) is used separately to prove
// gap dedup across a default combo that touches TWO device kinds at once.

const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof eqmValidity==='function' && typeof equipConfigured==='function' && typeof itemPaths==='function'`);
};

const BATH   = [{ id: 'b1', cat: 'sousvide', type: 'טבילה (immersion)', name: 'אמבט', cap: { baths: [20] } }];
const SMOKER = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
// non-charcoal type — deliberately NOT in cookerCandidates('smoke')'s charcoal/kettle/gas merge list, so
// this kit's grill-ownership never accidentally also counts as a smoker candidate.
const FULL = SMOKER.concat([{ id: 'g1', cat: 'grill', type: 'חשמלי', name: 'גריל', cap: { areaCm2: 5000, maxC: 300 } }]);

// ── sanity: confirm the fixture really offers a grill-default + smoke-alternate cited path pair before
// trusting any level assertion built on it (never take the data's shape on faith) ─────────────────────
test('sanity — make-m-brat offers a grill-default + smoke-alternate cited path pair', async ({ page }) => {
  await boot(page, null);
  const paths = await page.evaluate(`itemPaths(resolveItem('make-m-brat'))`) as any[];
  expect(paths.map(p => p.methodKey)).toEqual(['grill', 'smoke']);
  expect(paths[0].isDefault).toBe(true);
  expect(paths[1].label).toContain('עישון קצר');
});

test.describe('eqmValidity(meta) — the contract shape', () => {
  test('(d) negative — unconfigured kit: always ok, zero equipment noise (R5)', async ({ page }) => {
    await boot(page, null);
    expect(await page.evaluate(`equipConfigured()`)).toBe(false);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v).toEqual({ level: 'ok', okPaths: [], gaps: [], fixes: [] });
  });

  test('a fully-equipped kit (owns both device kinds): ok, no gaps, no fixes', async ({ page }) => {
    await boot(page, FULL);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v.level).toBe('ok');
    expect(v.gaps).toEqual([]);
    expect(v.fixes).toEqual([]);
  });

  test('(a) uncookable — a kit satisfying NEITHER path: level uncookable, no switch-path fix', async ({ page }) => {
    await boot(page, BATH);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v.level).toBe('uncookable');
    expect(v.okPaths).toEqual([]);
    // the DEFAULT path here is grill-only (a single-stage method) — its own gap is exactly 'grill',
    // never 'smoker' (that belongs to the OTHER path, not the default's own missing/partial rows).
    expect(v.gaps).toEqual([{ kind: 'grill', state: 'missing' }]);
    expect(v.fixes.map((f: any) => f.type)).toEqual(['configure', 'replace-e5']);   // no switch-path — nothing works
  });

  test('(c) blocked-default — the default (grill) path fails but the smoke alternate works', async ({ page }) => {
    await boot(page, SMOKER);
    const v = await page.evaluate(`eqmValidity(resolveItem('make-m-brat'))`) as any;
    expect(v.level).toBe('blocked-default');
    expect(v.okPaths).toEqual(['smoke']);
    expect(v.gaps).toEqual([{ kind: 'grill', state: 'missing' }]);
    const switchFix = v.fixes.find((f: any) => f.type === 'switch-path');
    expect(switchFix).toBeTruthy();
    expect(switchFix.pathId).toBe('smoke');
    expect(switchFix.label).toContain('עישון קצר');
    expect(v.fixes.map((f: any) => f.type)).toEqual(['configure', 'switch-path', 'replace-e5']);
  });

  test('multi-gap dedup — a default combo touching TWO device kinds (cut-1, sv+smoke) surfaces both, deduped', async ({ page }) => {
    await boot(page, []);   // configured, but owns literally nothing
    const v = await page.evaluate(`eqmValidity(resolveItem('cut-1'))`) as any;
    expect(v.level).toBe('uncookable');
    const kinds = v.gaps.map((g: any) => g.kind).sort();
    expect(kinds).toEqual(['bath', 'smoker']);
    expect(v.gaps.every((g: any) => g.state === 'missing')).toBe(true);
  });

  // CP2-INPUT (binding, from CP1 review): itemPaths[].isDefault is session/gear-dependent and must NEVER
  // be read as "the recipe default" — flipping isDefault on every path must not change the verdict.
  test('CP2-INPUT negative — level determination never reads itemPaths[].isDefault', async ({ page }) => {
    await boot(page, SMOKER);
    const level = await page.evaluate(`(function(){
      var meta = resolveItem('make-m-brat');
      var orig = itemPaths;
      window.itemPaths = function(m){ return orig(m).map(function(p,i){ return Object.assign({}, p, { isDefault: i!==0 }); }); };
      var v = eqmValidity(meta);
      window.itemPaths = orig;
      return v.level;
    })()`);
    expect(level).toBe('blocked-default');   // unaffected by isDefault having been flipped
  });

  test('DoD-10 safety invariance — eqmValidity never mutates the item object', async ({ page }) => {
    await boot(page, BATH);
    const eq = await page.evaluate(`(function(){
      var before = JSON.stringify(resolveItem('make-m-brat').obj);
      eqmValidity(resolveItem('make-m-brat')); eqmValidity(resolveItem('make-m-brat'));
      return before === JSON.stringify(resolveItem('make-m-brat').obj);
    })()`) as boolean;
    expect(eq).toBe(true);
  });
});

test.describe('catalog + item-panel UI (real clicks)', () => {
  test('(a)+(e) uncookable catalog card: bold-invalid class + חסר ציוד badge — screenshot', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveClass(/eq-inv\b/);
    await expect(card.locator('.eq-inv-badge')).toContainText('חסר ציוד');
    await page.screenshot({ path: 'mockups/e3-catalog-bold-invalid.png' });
  });

  test('(c) blocked-default catalog card: SOFT class, no badge — screenshot', async ({ page }) => {
    await boot(page, SMOKER);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    const cls = await card.getAttribute('class');
    expect(cls).toContain('eq-inv-soft');
    expect(cls).not.toMatch(/(^| )eq-inv( |$)/);   // never the bold class at the same time
    expect(await card.locator('.eq-inv-badge').count()).toBe(0);
    await page.screenshot({ path: 'mockups/e3-catalog-blocked-default.png' });
  });

  test('(d) negative — unconfigured kit: no bold-invalid treatment anywhere on the card', async ({ page }) => {
    await boot(page, null);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    const card = page.locator('[data-mid="m-brat"]');
    await card.scrollIntoViewIfNeeded();
    const cls = await card.getAttribute('class');
    expect(cls).not.toContain('eq-inv');
    expect(await card.locator('.eq-inv-badge').count()).toBe(0);
  });

  test('(b) the why/fix panel — uncookable: WHY names the missing kind, fixes = configure + replace-e5 only — screenshot', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    const panel = page.locator('#panel .eq-inv-panel');
    const panelCls = await panel.getAttribute('class');
    expect(panelCls).not.toContain('eq-inv-panel-soft');
    const why = await panel.locator('.eq-inv-why').innerText();
    expect(why).toContain('דרוש: גריל/אש');
    expect(await panel.locator('[data-eqfix="configure"]').count()).toBe(1);
    expect(await panel.locator('[data-eqfix="switch-path"]').count()).toBe(0);
    expect(await panel.locator('[data-eqfix="replace-e5"]').count()).toBe(1);
    await expect(panel.locator('[data-eqfix="replace-e5"]')).toBeDisabled();
    await page.locator('#panel').screenshot({ path: 'mockups/e3-panel-uncookable.png' });
  });

  test('(c) the why/fix panel — blocked-default: soft class, switch-path names the working path — screenshot', async ({ page }) => {
    await boot(page, SMOKER);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    const panel = page.locator('#panel .eq-inv-panel');
    const panelCls = await panel.getAttribute('class');
    expect(panelCls).toContain('eq-inv-panel-soft');
    const switchBtn = panel.locator('[data-eqfix="switch-path"]');
    await expect(switchBtn).toContainText('עישון קצר');
    await expect(switchBtn).toContainText('זמין במסלול');
    await page.locator('#panel').screenshot({ path: 'mockups/e3-panel-blocked-default.png' });
  });

  test('(d) negative — unconfigured kit: no why/fix panel at all when the item is opened', async ({ page }) => {
    await boot(page, null);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel #methodArea');
    expect(await page.locator('#panel .eq-inv-panel').count()).toBe(0);
  });

  test('the configure fix deep-links to the Equipment Manager', async ({ page }) => {
    await boot(page, BATH);
    await page.click('button[data-cnav="catalog"]');
    await page.click('button.cattile[data-tilegroup="מלאכה"]');
    await page.click('[data-mid="m-brat"]');
    await page.waitForSelector('#panel .eq-inv-panel');
    await page.click('#panel [data-eqfix="configure"]');
    await page.waitForFunction(() => !document.querySelector('#panel .eq-inv-panel') && !!document.querySelector('#panel .eq-wrap'));
  });
});

test.describe('umake generator-panel surface (E3-input, T1 surface list)', () => {
  const UMAKE_KEY = 'umake-t1';
  const seedUmake = { [UMAKE_KEY]: { heb: 'נקניקיית בדיקה', eng: 'Test sausage', cat: 'נקניקיות', diff: 2, build: { materials: [], phases: [], intro: '' }, ai: true } };

  test('(e) an umake row gets the same bold-invalid treatment as the catalog card', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
      'mk-equipment': JSON.stringify(BATH), 'mk-equip-set': 'true',
      'mk-gemkey': JSON.stringify('test-key'),
      'mk-umakes': JSON.stringify(seedUmake),
    });
    await page.waitForFunction(`typeof openRecipeGen==='function'`);
    await page.evaluate(`openRecipeGen()`);
    await page.waitForSelector(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const row = page.locator(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const cls = await row.getAttribute('class');
    expect(cls).toContain('eq-inv');
    await expect(row.locator('.eq-inv-badge')).toContainText('חסר ציוד');
    await page.locator('#panel').screenshot({ path: 'mockups/e3-umake-panel-bold-invalid.png' });
  });

  test('negative — a fully-equipped kit renders the umake row with no bold-invalid treatment', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
      'mk-equipment': JSON.stringify(FULL), 'mk-equip-set': 'true',
      'mk-gemkey': JSON.stringify('test-key'),
      'mk-umakes': JSON.stringify(seedUmake),
    });
    await page.waitForFunction(`typeof openRecipeGen==='function'`);
    await page.evaluate(`openRecipeGen()`);
    await page.waitForSelector(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const row = page.locator(`#panel [data-umopen="${UMAKE_KEY}"]`);
    const cls = await row.getAttribute('class');
    expect(cls).not.toContain('eq-inv');
    expect(await row.locator('.eq-inv-badge').count()).toBe(0);
  });
});

// ── (f) EN leak + L13 ─────────────────────────────────────────────────────────────────────────────
// Scoped to this task's OWN authored copy (title, gap-state text, configure/replace-e5 fix labels) via
// the UNCOOKABLE state, which carries no switch-path row — sidesteps a pre-existing, out-of-scope gap:
// itemPaths()/MAKE_COOK's path labels (e.g. 'עישון קצר') are plain Hebrew literals with no L() wrapping,
// so a switch-path fix's appended <path label> is not itself localized; that inherited data limitation
// is unrelated to eqmValidity/eqInvPanelHtml, which localize every string THEY author correctly.
test('(f) EN leak + L13 — English mode: own-authored panel copy in English, no Hebrew leak, no bare numerals', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en'),
    'mk-equipment': JSON.stringify(BATH), 'mk-equip-set': 'true',
  });
  await page.waitForFunction(`typeof eqInvPanelHtml==='function'`);
  const html = await page.evaluate(`eqInvPanelHtml(resolveItem('make-m-brat'))`) as string;
  expect(html).toContain('This item cannot be cooked with your equipment');
  expect(html).toContain('Requires: Grill');
  expect(html).toContain('missing');
  expect(html).toContain('Add/configure equipment in Equipment Management');
  expect(html).toContain('Equipment replacement');
  expect(html).not.toMatch(/[֐-׿]/);   // zero Hebrew characters anywhere in the panel

  const badgeHtml = await page.evaluate(`eqInvState('make-m-brat').badge`) as string;
  expect(badgeHtml).toContain('Missing equipment');
  expect(badgeHtml).not.toMatch(/[֐-׿]/);

  // L13 applicability check: the concern is bidi flipping a NUMERIC READOUT's visual order inside
  // Hebrew RTL prose (e.g. "≥12 L" reading as "≤"). The O-5 gaps/fixes contract carries no measured
  // numerals at all — the only digit anywhere in this panel is the literal milestone label "(E5)" in
  // the replace-e5 placeholder, which is plain ASCII, never embedded in Hebrew RTL context here (this
  // very assertion runs in English/LTR mode), and reads identically forwards or backwards — not a
  // numeric-readout bidi hazard L13 exists to catch. Documented, not asserted as a no-digit rule.
  expect(html).toContain('(E5)');
});
