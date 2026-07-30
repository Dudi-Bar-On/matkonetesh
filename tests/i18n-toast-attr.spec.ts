// Task 7 (v268 localization plan) — toast + attribute + unit-glyph extraction coverage.
// Spec: docs/superpowers/plans/2026-07-26-v268-localization.md "## Task 7";
// docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §7 (toasts already localize via
// tr(), 3540 — the gap is extraction coverage) + §9 (attributes via tnode 8612; units via __units__).
//
// This task's own DoD:
//   - toast: firing a real add-to-menu toast is dict-driven — he-mode byte-identical to the raw
//     pre-fix Hebrew, and localizes when a dict entry exists (fr-mode, seeded).
//   - attribute: a representative card aria-label (itemName-routed, app.js ~2274/2306/2323) is
//     byte-identical in he-mode and localizes with a seeded __names__ entry in fr-mode.
//   - unit: the equipment-screen raw unit-glyph path (tnode's __units__ digit-adjacent substitution)
//     converts ס״מ²/ל׳/מ״מ/ק״ג/דק׳ to their Latin abbreviations using the REAL committed fr dict
//     (no seeding — proves the shipped __units__ entries, not a test double).
import { test, expect, seedApp } from './_fixtures';

test('i18n-toast: he-mode — add-to-menu toast is byte-identical to the raw Hebrew (dict-driven, no-op in he)', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.click('[data-cnav="catalog"]');
  await page.fill('#q', 'בקר');
  await page.waitForSelector('#grid .card [data-addmenu]');
  await page.click('#grid .card [data-addmenu]');
  await page.waitForSelector('#toast.show');
  const toastText = await page.evaluate(`document.querySelector('#toast span').textContent`);
  expect(toastText).toBe('✓ נוסף לתפריט');
});

test('i18n-toast: fr-mode — the SAME add-to-menu toast localizes from a seeded dict entry (proves the node is dict-driven, not baked Hebrew)', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('fr') });
  // Task 2: mk-lang='fr' triggers the async boot dict fetch — wait so I18N_DICTS.fr exists before seeding into it.
  await page.evaluate(() => (window as any).__mkLangReady);
  await page.evaluate(`I18N_DICTS.fr['✓ נוסף לתפריט']='✓ Ajouté au menu'`);
  await page.click('[data-cnav="catalog"]');
  await page.fill('#q', 'בקר');
  await page.waitForSelector('#grid .card [data-addmenu]');
  await page.click('#grid .card [data-addmenu]');
  await page.waitForSelector('#toast.show');
  const toastText = await page.evaluate(`document.querySelector('#toast span').textContent`);
  expect(toastText).toBe('✓ Ajouté au menu');
});

test('i18n-attr: he-mode — a catalog card aria-label is itemName-routed, byte-identical to the raw .heb it replaced', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') });
  await page.click('[data-cnav="catalog"]');
  await page.fill('#q', 'בקר');
  await page.waitForSelector('#grid .card[data-kind="cut"]');
  const [ariaLabel, expected] = await page.evaluate(`(function(){
    var card=document.querySelector('#grid .card[data-kind="cut"]');
    var c=DATA.cuts.find(function(x){ return x.n===+card.dataset.n; });
    return [card.getAttribute('aria-label'), c.heb];
  })()`);
  expect(ariaLabel).toBe(expected);
});

test('i18n-attr: fr-mode — the SAME card aria-label localizes from a seeded __names__ entry (proves itemName(), not raw .heb)', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('fr') });
  // Task 2: mk-lang='fr' triggers the async boot dict fetch — wait so I18N_DICTS.fr exists before seeding into it.
  await page.evaluate(() => (window as any).__mkLangReady);
  const heb = await page.evaluate(`DATA.cuts[0].heb`);
  await page.evaluate(`(function(){ I18N_DICTS.fr.__names__=I18N_DICTS.fr.__names__||{}; I18N_DICTS.fr.__names__[${JSON.stringify(heb)}]='__TESTNAME__'; })()`);
  await page.click('[data-cnav="catalog"]');
  await page.fill('#q', 'בקר');
  await page.waitForSelector('#grid .card[data-kind="cut"]');
  const ariaLabel = await page.evaluate(`document.querySelector('#grid .card[data-kind="cut"]').getAttribute('aria-label')`);
  expect(ariaLabel).toBe('__TESTNAME__');
});

test('i18n-units: fr-mode — tnode() converts equipment-screen raw unit glyphs (ס״מ²/ל׳/מ״מ, and the ק״ג/דק׳ compound before the ק״ג prefix) via the real committed __units__ map', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('fr') });
  // Task 2: this test relies on the REAL committed fr __units__ map — wait for the async boot fetch.
  await page.evaluate(() => (window as any).__mkLangReady);
  const out = await page.evaluate(`(function(){
    var host=document.createElement('div'); host.style.display='none';
    host.innerHTML='<span id="u1">94 ס״מ²</span><span id="u2">12 ס״מ</span><span id="u3">5 ל׳</span><span id="u4">22 מ״מ</span><span id="u5">5 ק״ג/דק׳</span><span id="u6">3 ק״ג</span>';
    document.body.appendChild(host);
    tnode(host);
    var r={u1:host.querySelector('#u1').textContent,u2:host.querySelector('#u2').textContent,u3:host.querySelector('#u3').textContent,u4:host.querySelector('#u4').textContent,u5:host.querySelector('#u5').textContent,u6:host.querySelector('#u6').textContent};
    host.remove();
    return r;
  })()`);
  expect(out).toEqual({
    u1: '94 cm²',
    u2: '12 cm',
    u3: '5 L',
    u4: '22 mm',
    u5: '5 kg/min',
    u6: '3 kg',
  });
});
