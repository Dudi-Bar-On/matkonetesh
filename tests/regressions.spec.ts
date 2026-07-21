import { test, expect } from '@playwright/test';

// CLAUDE-CODE-GUIDE §5.4 — regressions for the recurring UI bugs (each marked "*(באג עבר!)*").

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});

test('kosher filter: pork cards vanish from the red-meat group and the chip stays "on"', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-cnav="catalog"]');
  // drill into the red-meat group (בקר/חזיר/טלה) so pork cut cards render
  await page.evaluate(`(function(){ setCatNav('בשר אדום',['בקר','חזיר','טלה']); catView('cat'); })()`);

  const porkTags = page.locator('#scr-catalog .card .ktag.kp');   // "לא כשר" = pork/shellfish
  expect(await porkTags.count()).toBeGreaterThan(0);

  await page.click('#scr-catalog [data-f="kosher"]');

  await expect(porkTags).toHaveCount(0);                          // pork cards removed
  await expect(page.locator('#scr-catalog [data-f="kosher"]')).toHaveClass(/on/);   // chip reflects "on"
});

test('AI graceful degradation: recipe generator shows a connect prompt without a key', async ({ page }) => {
  await page.goto('/index.html');
  // no mk-gemkey seeded -> aiAvail() is false
  await page.evaluate(`openRecipeGen()`);
  await expect(page.locator('#panel #genConnect')).toBeVisible();
  await expect(page.locator('#panel')).toContainText('דורש מפתח');
});

test('wizard picker: kosher toggle removes every pork item from the pick list', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-cnav="wizard"]');          // opens the event wizard
  await page.evaluate(`cwGo(1)`);                     // step 1 = item picker
  await page.waitForSelector('#cwPickList [data-cwpick]');

  const porkCount = () => page.evaluate(
    `Array.from(document.querySelectorAll('#cwPickList [data-cwpick]')).filter(el=>kosherStatus(el.dataset.cwpick)==='pork').length`
  );
  expect(await porkCount()).toBeGreaterThan(0);

  // toggle the kosher filter via its real bound handler (the control lives on the setup step)
  await page.evaluate(`document.getElementById('cwKosher').click()`);
  await page.waitForFunction(`Array.from(document.querySelectorAll('#cwPickList [data-cwpick]')).filter(function(el){return ['shellfish','pork','treif'].includes(kosherStatus(el.dataset.cwpick));}).length===0`);
  expect(await porkCount()).toBe(0);
});

test('AI recipe generator: mocked recipe → unverified badge → save → appears in "my recipes"', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mk-gemkey', JSON.stringify('TEST')); } catch {} });
  await page.goto('/index.html');

  // grounded-only mock recipe (the app supplies safe numbers, never the AI)
  await page.evaluate(() => {
    (window as any).__aiMock = {
      name: 'נקניק בדיקה', type: 'fresh', intro: 'מתכון לבדיקה אוטומטית',
      materials: ['בשר חזיר טחון', 'מלח'],
      phases: [{ title: 'טחינה', body: 'טחן דק ושמור קר' }, { title: 'מילוי', body: 'מלא למעי חזיר' }],
    };
  });

  await page.evaluate(`runGenerateRecipe('נקניק טלה חריף')`);
  await expect(page.locator('#panel')).toContainText('לא-מאומת');    // ⚠ AI, not safety-verified
  await page.click('#panel #aiCpApply');                            // 💾 save to my recipes

  const savedCount = await page.evaluate(`Object.keys(umakes()).length`);
  expect(savedCount).toBeGreaterThan(0);
});

test('bilingual voice: the answer follows the selected answer-language (text Q&A)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mk-gemkey', JSON.stringify('TEST')); } catch {} }); // aiAvail() -> ask row shows
  await page.goto('/index.html');
  await page.evaluate(`openVoiceCook([{t:new Date(), label:'עישון 105°', sub:'', kind:'smoke', det:''}])`);
  await expect(page.locator('#vcAskInput')).toBeVisible();
  // mock the AI answer to echo the CURRENT answer-language (string form so bare vcAnsLang resolves in-page)
  await page.evaluate(`window.__vcAskMock = function(q){ return vcAnsLang()==='en' ? 'ANSWER_IN_ENGLISH' : 'TESHUVA_BEIVRIT'; }`);

  await page.click('[data-vc="anslang-en"]');
  await page.fill('#vcAskInput', 'how long to rest the brisket?');
  await page.click('[data-vc="asktext"]');
  await expect(page.locator('#panel')).toContainText('ANSWER_IN_ENGLISH');

  await page.click('[data-vc="anslang-he"]');
  await page.fill('#vcAskInput', 'כמה זמן מנוחה?');
  await page.click('[data-vc="asktext"]');
  await expect(page.locator('#panel')).toContainText('TESHUVA_BEIVRIT');
});

test('method sync: choosing sous-vide for an item puts a sous-vide step in the work plan', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-83'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set(methodKeyFor('cut-83'), ['sv','grill']);   // eggplant: sous-vide + grill
    store.set('mk-tlview','plan');
    openTimeline();
  })()`);
  await expect(page.locator('#panel .workplan')).toContainText('סו-ויד');
});

test('event planner double-guard: AI-returned pork is dropped for a kosher request', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mk-gemkey', JSON.stringify('TEST')); } catch {} });
  await page.goto('/index.html');
  // AI returns a kosher plan that (wrongly) includes pork ribs (cut-7) alongside kosher brisket (cut-1)
  await page.evaluate(() => {
    (window as any).__aiMock = { guests: 10, appetite: 'reg', kosher: true,
      keys: ['cut-1', 'cut-7'], sides: [], drinks: [], desserts: [], rationale: 'test' };
  });
  const keys = await page.evaluate(`aiPlanEvent('תכנן אירוע כשר').then(function(p){ return p.keys; })`) as string[];
  expect(keys).toContain('cut-1');        // kosher beef kept
  expect(keys).not.toContain('cut-7');    // pork dropped by the second kosher guard
});
