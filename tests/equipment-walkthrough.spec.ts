import { test, expect, Page } from '@playwright/test';

// ── Equipment 2.0 / "My Equipment" (openEquipment) exhaustive walkthrough ──
// Verifies every option of the feature in EN and HE (RTL). Read-only QA: it never
// edits app.js/app.css. Screenshots land in mockups/walkthrough/.
// NOTE: config key is `mk-equip-set` in the code (the brief's `mk-equipment-set` is a typo).

const SHOT = 'mockups/walkthrough/';

test.use({ viewport: { width: 430, height: 920 } });

// seed localStorage BEFORE the app boots, then land on index and wait for the equip API
const boot = async (page: Page, opts: { lang?: string; gear?: any[]; key?: string } = {}) => {
  await page.addInitScript((o: any) => {
    try {
      localStorage.clear();
      localStorage.setItem('mk-lang', JSON.stringify(o.lang || 'en'));
      localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
      localStorage.setItem('mk-uilevel', JSON.stringify('mid'));
      if (o.key) localStorage.setItem('mk-gemkey', JSON.stringify(o.key));
      if (o.gear) { localStorage.setItem('mk-equipment', JSON.stringify(o.gear)); localStorage.setItem('mk-equip-set', JSON.stringify(true)); }
    } catch {}
  }, opts);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openEquipment==='function' && typeof equipList==='function'`);
};

const RICH = [
  // smoker + grill(ai) + 2 probes, NO sous-vide → yields ok+no caps pills and a probe-channel foot
  { id: 'sm1', cat: 'smoker', type: 'אופסט / סטיק-ברנר', name: 'Big Offset', fuel: 'wood', cap: { racks: 4 }, specSource: 'manual', notes: '' },
  { id: 'g1', cat: 'grill', type: 'קטל', name: 'Weber Kettle', fuel: 'charcoal', cap: { zones: 2 }, specSource: 'ai', notes: '' },
  { id: 'pr1', cat: 'probe', type: 'פרוב אלחוטי', name: 'MEATER', cap: { channels: 4 }, specSource: 'manual', notes: '' },
  { id: 'pr2', cat: 'probe', type: 'פרוב נעוץ', name: 'Inkbird', cap: { channels: 4 }, specSource: 'manual', notes: '' },
];

// ══════════════════════════════════════════════════════════════════════
// EMPTY view — options (1) quick-chips, (2) add manually, (3) set-it-up-for-me
// ══════════════════════════════════════════════════════════════════════
test('EMPTY view: quick-chips, add-manually, set-it-up (EN)', async ({ page }) => {
  await boot(page, { lang: 'en' });
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqManual');
  await page.waitForSelector('#panel #eqDescribe');
  await page.screenshot({ path: SHOT + 'en-empty.png' });

  // (1) quick-chip appends its category name to the describe box
  const chips = page.locator('#panel .eq-egchip[data-eqquick]');
  expect(await chips.count()).toBeGreaterThan(0);
  await chips.first().click();
  const boxVal = await page.locator('#panel #eqDescribe').inputValue();
  expect(boxVal.trim().length).toBeGreaterThan(0);          // chip text was appended

  // (2) "add manually" opens the form (sheet with the verify card)
  await page.click('#panel #eqManual');
  await page.waitForSelector('#panel #eqSave');
  await page.waitForSelector('#panel #eqCat');
  expect(await page.locator('#panel .eq-sheet').count()).toBe(1);

  // (3) "Set it up for me" — reopen empty, type a description, build devices, land on list
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqSetup');
  await page.fill('#panel #eqDescribe', 'a kettle grill and a cheap probe');
  await page.click('#panel #eqSetup');
  await page.waitForSelector('#panel .eq-dev');           // landed on the list
  expect(await page.evaluate(`hasCat('grill')`)).toBe(true);
  expect(await page.evaluate(`hasCat('probe')`)).toBe(true);
  expect(await page.evaluate(`equipConfigured()`)).toBe(true);
});

// ══════════════════════════════════════════════════════════════════════
// LIST view — options (4) header Add, (5) caps banner, (6) concierge,
// (7) add-another, (8) edit, (9) remove, (10) device cards
// ══════════════════════════════════════════════════════════════════════
test('LIST view: header-add, caps banner, concierge, add-another, edit, remove, cards (EN)', async ({ page }) => {
  await boot(page, { lang: 'en', gear: RICH });
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev');
  await page.screenshot({ path: SHOT + 'en-list.png' });

  // (5) capabilities banner reflects seeded gear: 2 ok (smoke+grill) / 1 no (sous-vide) + probe foot
  expect(await page.locator('#panel .eq-gcap.ok').count()).toBe(2);
  expect(await page.locator('#panel .eq-gcap.no').count()).toBe(1);
  const foot = await page.locator('#panel .eq-caps-foot').textContent();
  expect(foot).toContain('2 probes');
  expect(foot).toContain('8 channels');

  // (10) device cards: icons, ✨AI badge (grill is specSource:ai), capacity chip + fuel chip
  expect(await page.locator('#panel .eq-dev').count()).toBe(4);
  expect(await page.locator('#panel .eq-dev-ai').count()).toBe(1);          // exactly the AI grill
  // offset smoker tile icon 📦, kettle grill 🔥, wireless probe 📡, nailed probe 🌡️
  const tiles = await page.locator('#panel .eq-dev .eq-tile').allTextContents();
  expect(tiles).toContain('📦'); expect(tiles).toContain('🔥'); expect(tiles).toContain('📡');
  // grill card: capacity chip "2 heat zones" + fuel chip "⚫ Charcoal"
  const grillCard = page.locator('#panel .eq-dev', { hasText: 'Weber Kettle' });
  expect(await grillCard.locator('.eq-chip.spec').count()).toBe(1);
  const grillChips = await grillCard.locator('.eq-chip').allTextContents();
  expect(grillChips.join(' | ')).toContain('heat zones');
  expect(grillChips.join(' | ')).toContain('Charcoal');

  // (6) concierge "Describe your gear" opens the gear-concierge panel without error
  await page.click('#panel #eqConcierge');
  await page.waitForSelector('#panel #gcDesc');
  expect(await page.locator('#panel #gcGo').count()).toBe(1);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev');

  // (7) "Add another <cat>" opens the form pre-set to that category (grill)
  await page.locator('#panel .eq-add-tile[data-eqaddcat="grill"]').click();
  await page.waitForSelector('#panel #eqCat');
  expect(await page.locator('#panel #eqCat').inputValue()).toBe('grill');
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev');

  // (8) edit (✎) opens the form pre-filled with the device
  await page.locator('#panel [data-eqedit="sm1"]').click();
  await page.waitForSelector('#panel #eqSave');
  await page.waitForFunction(`(document.querySelector('#panel #eqName')||{}).value==='Big Offset'`);
  expect(await page.locator('#panel #eqCat').inputValue()).toBe('smoker');
  expect(await page.locator('#panel #eqType').inputValue()).toBe('אופסט / סטיק-ברנר');
  expect(await page.locator('#panel #eqCapKey').inputValue()).toBe('4');
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev');

  // (4) header "＋ Add" opens the form
  await page.click('#panel #eqAddNew');
  await page.waitForSelector('#panel #eqSave');
  expect(await page.locator('#panel .eq-sheet').count()).toBe(1);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev');

  // (9) remove (✕) deletes the device and re-renders
  const before = await page.evaluate(`equipList().length`);
  await page.locator('#panel [data-eqrm="pr2"]').click();
  await page.waitForFunction(`equipList().length===${(before as number) - 1}`);
  expect(await page.evaluate(`equipList().some(d=>d.id==='pr2')`)).toBe(false);
  expect(await page.locator('#panel .eq-dev').count()).toBe((before as number) - 1);
});

// ══════════════════════════════════════════════════════════════════════
// FORM (manual, no key) — (11) category switch matrix, (12) manual add,
// (13) custom sub-type, (17) Cancel, (18) Back
// ══════════════════════════════════════════════════════════════════════
test('FORM manual: category matrix, manual add, custom sub-type, cancel, back (EN)', async ({ page }) => {
  await boot(page, { lang: 'en' });
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqManual');
  await page.click('#panel #eqManual');
  await page.waitForSelector('#panel #eqSave');
  // no key → no AI lookup controls
  expect(await page.locator('#panel #eqLookup').count()).toBe(0);

  // (11) walk ALL 8 categories: cap field present iff capKey; fuel row iff smoker/grill/oven; sub-type opts change
  const CATS = ['smoker', 'grill', 'oven', 'sousvide', 'probe', 'grinder', 'stuffer', 'other'];
  const HAS_CAP: Record<string, boolean> = { smoker: true, grill: true, oven: true, sousvide: true, probe: true, grinder: false, stuffer: false, other: false };
  const HAS_FUEL: Record<string, boolean> = { smoker: true, grill: true, oven: true, sousvide: false, probe: false, grinder: false, stuffer: false, other: false };
  let prevTypeOpts = '';
  for (const c of CATS) {
    await page.selectOption('#panel #eqCat', c);
    await page.waitForFunction(`(document.querySelector('#panel #eqCat')||{}).value==='${c}'`);
    const hasCap = await page.locator('#panel #eqCapKey').count();
    const hasFuel = await page.locator('#panel #eqvFuel').count();
    expect(hasCap > 0, `cap field for ${c}`).toBe(HAS_CAP[c]);
    expect(hasFuel > 0, `fuel row for ${c}`).toBe(HAS_FUEL[c]);
    // sub-type option set changes per category
    const opts = (await page.locator('#panel #eqType option').allTextContents()).join('|');
    expect(opts.length, `type opts for ${c}`).toBeGreaterThan(0);
    if (prevTypeOpts) expect(opts, `type opts changed at ${c}`).not.toBe(prevTypeOpts);
    prevTypeOpts = opts;
  }

  // (12) manual add: smoker + name + sub-type + capacity → Save → appears with the right values
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqName', 'My Test Smoker');
  await page.selectOption('#panel #eqType', 'פלטים');
  await page.fill('#panel #eqCapKey', '3');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.evaluate(`equipByCat('smoker').length`)).toBe(1);
  expect(await page.evaluate(`primaryOf('smoker').name`)).toBe('My Test Smoker');
  expect(await page.evaluate(`primaryOf('smoker').type`)).toBe('פלטים');
  expect(await page.evaluate(`primaryOf('smoker').cap.racks`)).toBe(3);
  expect(await page.evaluate(`primaryOf('smoker').specSource`)).toBe('manual');

  // (13) custom sub-type ("Other…"/__custom__): the typed Name becomes the type
  await page.click('#panel #eqAddNew');
  await page.waitForSelector('#panel #eqSave');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqName', 'Frankenpit');
  await page.selectOption('#panel #eqType', '__custom__');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`equipList().some(d=>d.name==='Frankenpit')`);
  const fp = await page.evaluate(`equipList().find(d=>d.name==='Frankenpit')`) as any;
  expect(fp.type).toBe('Frankenpit');       // typed name became the sub-type

  // (17) Cancel (manual mode) returns to the list
  await page.click('#panel #eqAddNew');
  await page.waitForSelector('#panel #eqCancel');
  expect(await page.locator('#panel #eqRedo').count()).toBe(0);   // manual → Cancel, not Redo
  await page.click('#panel #eqCancel');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.locator('#panel .eq-sheet').count()).toBe(0);

  // (18) Back (sheet ✕) returns to the list
  await page.click('#panel #eqAddNew');
  await page.waitForSelector('#panel #eqBack');
  await page.click('#panel #eqBack');
  await page.waitForSelector('#panel .eq-dev');
  expect(await page.locator('#panel .eq-sheet').count()).toBe(0);
});

// ══════════════════════════════════════════════════════════════════════
// FORM (AI, mock) — (14) lookup flow, (15) browse models, (16) Redo
// ══════════════════════════════════════════════════════════════════════
test('FORM AI (mock): lookup verify+save, browse catalogue, redo (EN)', async ({ page }) => {
  await boot(page, { lang: 'en', key: 'k' });
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqManual');
  await page.click('#panel #eqManual');
  await page.waitForSelector('#panel #eqLookup');       // key present → AI controls render

  // (14) AI lookup path — mock the web result, look up, verify card fills green+✨, then Save as ai
  await page.evaluate(`window.__aiMock={subtype:'פלטים',fuel:'pellet',racks:3,area:'575 in²',note:'stainless build'};`);
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqLookupQ', 'Traeger Pro 575');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='3'`);
  expect(await page.locator('#panel #eqName').inputValue()).toBe('Traeger Pro 575');
  expect(await page.locator('#panel #eqType').inputValue()).toBe('פלטים');
  expect(await page.locator('#panel #eqvFuel').inputValue()).toBe('pellet');
  expect(await page.locator('#panel #eqvArea').inputValue()).toBe('575 in²');
  expect(await page.locator('#panel .eq-vin.eq-aifilled').count()).toBeGreaterThan(0);   // green tint
  expect(await page.locator('#panel .eq-vfield label .sp').count()).toBeGreaterThan(0);   // ✨ markers
  const srcNote = await page.locator('#panel .eq-v-src').textContent();
  expect(srcNote).toContain('nothing is saved yet');
  const aiNote = await page.locator('#panel #eqAiNote').textContent();
  expect(aiNote).toContain('stainless build');
  await page.screenshot({ path: SHOT + 'en-form-verify.png' });

  // (16) Redo (AI mode) resets the verify card back to manual (loses ✨ + green tint)
  expect(await page.locator('#panel #eqRedo').count()).toBe(1);
  await page.click('#panel #eqRedo');
  await page.waitForSelector('#panel #eqCancel');       // repainted as manual verify
  expect(await page.locator('#panel .eq-vin.eq-aifilled').count()).toBe(0);
  expect(await page.locator('#panel .eq-vfield label .sp').count()).toBe(0);
  expect(await page.locator('#panel #eqName').inputValue()).toBe('Traeger Pro 575');  // name preserved

  // re-run the lookup and Save → device persists with specSource 'ai'
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='3'`);
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  const saved = await page.evaluate(`equipByCat('smoker')[0]`) as any;
  expect(saved.specSource).toBe('ai');
  expect(saved.cap.racks).toBe(3);
  expect(saved.fuel).toBe('pellet');

  // (15) Browse models (mock {models:[{name,spec}]}) → catalogue cards WITH spec line + "or pick" divider
  await page.click('#panel #eqAddNew');
  await page.waitForSelector('#panel #eqModels');
  await page.evaluate(`window.__aiMock={models:[{name:'Pro 575',spec:'Pellet · 2 racks · 22"'},{name:'Ironwood 885',spec:'Pellet · 3 racks'}]};`);
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqLookupQ', 'Traeger');
  await page.click('#panel #eqModels');
  await page.waitForSelector('#panel .eq-model[data-eqmodel]');
  expect(await page.locator('#panel .eq-model').count()).toBe(2);
  expect(await page.locator('#panel .eq-model .eq-model-main small').count()).toBe(2);   // spec lines render
  const specLine = await page.locator('#panel .eq-model .eq-model-main small').first().textContent();
  expect(specLine).toContain('Pellet');
  expect(await page.locator('#panel #eqCatOr').isHidden()).toBe(false);                   // divider shown
  await page.screenshot({ path: SHOT + 'en-form-catalogue.png' });
  // clicking a model fills the lookup input + marks the card .on (and re-runs lookup)
  await page.locator('#panel .eq-model[data-eqmodel="Pro 575"]').click();
  await page.waitForFunction(`(document.querySelector('#panel #eqLookupQ')||{}).value==='Pro 575'`);
  expect(await page.locator('#panel .eq-model.on').count()).toBe(1);
});

// ══════════════════════════════════════════════════════════════════════
// (19) edit round-trip — change a field, Save, persisted and NOT duplicated
// ══════════════════════════════════════════════════════════════════════
test('EDIT round-trip: change persists, no duplicate (EN)', async ({ page }) => {
  await boot(page, { lang: 'en', gear: [{ id: 'eqx', cat: 'smoker', type: 'פלטים', name: 'Old Name', fuel: 'pellet', cap: { racks: 1 }, specSource: 'manual', notes: '' }] });
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel [data-eqedit="eqx"]');
  await page.click('#panel [data-eqedit="eqx"]');
  await page.waitForFunction(`(document.querySelector('#panel #eqName')||{}).value==='Old Name'`);
  await page.fill('#panel #eqName', 'New Name');
  await page.fill('#panel #eqCapKey', '2');
  await page.click('#panel #eqSave');
  await page.waitForFunction(`equipList()[0] && equipList()[0].name==='New Name'`);
  expect(await page.evaluate(`equipList().length`)).toBe(1);          // updated, not duplicated
  expect(await page.evaluate(`equipList()[0].cap.racks`)).toBe(2);
  expect(await page.evaluate(`equipList()[0].id`)).toBe('eqx');       // same record
});

// ══════════════════════════════════════════════════════════════════════
// (20) HEBREW / RTL — empty, list, form + verify card + catalogue
// ══════════════════════════════════════════════════════════════════════
test('HEBREW RTL: empty/list/form + verify + catalogue mirror (HE)', async ({ page }) => {
  await boot(page, { lang: 'he', gear: RICH, key: 'k' });
  expect(await page.evaluate(`document.documentElement.dir`)).toBe('rtl');

  // HE list
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel .eq-dev');
  const h1 = await page.locator('#panel .eq-head h1').textContent();
  expect(h1).toContain('הציוד שלי');                     // Hebrew title renders
  expect(await page.locator('#panel .eq-caps h4').textContent()).toContain('מה אפשר לבשל');
  // layout mirrors: the action buttons (inset-inline-end) sit on the LEFT edge in RTL
  const cardBox = await page.locator('#panel .eq-dev').first().boundingBox();
  const actBox = await page.locator('#panel .eq-dev').first().locator('.eq-dev-acts').boundingBox();
  expect(actBox!.x + actBox!.width / 2, 'acts mirror to inline-start(left) in RTL').toBeLessThan(cardBox!.x + cardBox!.width / 2);
  await page.screenshot({ path: SHOT + 'he-list.png' });

  // HE empty (transient — reachable by clearing devices)
  await page.evaluate(`equipSave([]); openEquipment();`);
  await page.waitForSelector('#panel #eqManual');
  expect(await page.locator('#panel .eq-con-h').textContent()).toContain('הציוד שלך');
  await page.screenshot({ path: SHOT + 'he-empty.png' });

  // HE form + AI verify card (mock) + catalogue
  await page.click('#panel #eqManual');
  await page.waitForSelector('#panel #eqLookup');
  expect(await page.locator('#panel .eq-step-l').first().textContent()).toContain('קטגוריה');
  await page.evaluate(`window.__aiMock={subtype:'פלטים',fuel:'pellet',racks:3,area:'575 in²',note:'נירוסטה'};`);
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqLookupQ', 'Traeger Pro 575');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='3'`);
  expect(await page.locator('#panel .eq-verify-h').textContent()).toContain('אמת ושמור');
  await page.screenshot({ path: SHOT + 'he-form-verify.png' });
  // catalogue in HE
  await page.evaluate(`window.__aiMock={models:[{name:'Pro 575',spec:'פלטים · 2 מדפים'},{name:'Ironwood 885',spec:'פלטים · 3 מדפים'}]};`);
  await page.fill('#panel #eqLookupQ', 'Traeger');
  await page.click('#panel #eqModels');
  await page.waitForSelector('#panel .eq-model[data-eqmodel]');
  expect(await page.locator('#panel #eqCatOr').textContent()).toContain('הקטלוג');
  await page.screenshot({ path: SHOT + 'he-form-catalogue.png' });
});

// ══════════════════════════════════════════════════════════════════════
// THE CHALLENGE — "הנפח אביה 150" cabinet charcoal smoker, two ways
// ══════════════════════════════════════════════════════════════════════
test('אביה 150 (a) MANUAL: cabinet smoker, 5 racks, charcoal (HE)', async ({ page }) => {
  await boot(page, { lang: 'he' });
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqManual');
  await page.click('#panel #eqManual');
  await page.waitForSelector('#panel #eqSave');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqName', 'הנפח אביה 150');
  await page.selectOption('#panel #eqType', 'ארון / קבינט');
  await page.fill('#panel #eqCapKey', '5');
  await page.selectOption('#panel #eqvFuel', 'charcoal');
  await page.fill('#panel #eqvArea', '150×60 cm');
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  const dev = await page.evaluate(`equipByCat('smoker').find(d=>d.name==='הנפח אביה 150')`) as any;
  expect(dev, 'device saved').toBeTruthy();
  expect(dev.type).toBe('ארון / קבינט');
  expect(dev.cap.racks).toBe(5);
  expect(dev.fuel).toBe('charcoal');
  expect(dev.cap.area).toBe('150×60 cm');
  // card shows cabinet tile 🗄️ + "5 racks/grates" + "⚫ charcoal"
  const card = page.locator('#panel .eq-dev', { hasText: 'הנפח אביה 150' });
  expect(await card.locator('.eq-tile').textContent()).toBe('🗄️');
  const chips = (await card.locator('.eq-chip').allTextContents()).join(' | ');
  expect(chips).toContain('5');
  expect(chips).toContain('⚫');
  await card.screenshot({ path: SHOT + 'aviya150-card.png' });
});

test('אביה 150 (b) LOOKUP FLOW (mock): verify card fills, saved as ai (HE)', async ({ page }) => {
  await boot(page, { lang: 'he', key: 'k' });
  await page.evaluate(`window.__aiMock={ subtype:'ארון / קבינט', fuel:'charcoal', racks:5, area:'150×60 cm', note:'3mm walls · separate firebox · ~60kg / 5 removable shelves' };`);
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel #eqManual');
  await page.click('#panel #eqManual');
  await page.waitForSelector('#panel #eqLookup');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqLookupQ', 'אביה 150');
  await page.click('#panel #eqLookup');
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='5'`);
  expect(await page.locator('#panel #eqType').inputValue()).toBe('ארון / קבינט');
  expect(await page.locator('#panel #eqvFuel').inputValue()).toBe('charcoal');
  expect(await page.locator('#panel #eqvArea').inputValue()).toBe('150×60 cm');
  expect(await page.locator('#panel .eq-vin.eq-aifilled').count()).toBeGreaterThan(0);   // green tint
  expect(await page.locator('#panel .eq-vfield label .sp').count()).toBeGreaterThan(0);   // ✨ markers
  const aiNote = await page.locator('#panel #eqAiNote').textContent();
  expect(aiNote).toContain('firebox');
  await page.screenshot({ path: SHOT + 'aviya150-verify.png' });
  // Save → persisted as ai
  await page.click('#panel #eqSave');
  await page.waitForSelector('#panel .eq-dev');
  const dev = await page.evaluate(`equipByCat('smoker').find(d=>d.type==='ארון / קבינט')`) as any;
  expect(dev.specSource).toBe('ai');
  expect(dev.cap.racks).toBe(5);
  expect(dev.fuel).toBe('charcoal');
  expect(dev.cap.area).toBe('150×60 cm');
});
