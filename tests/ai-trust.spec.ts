import { test, expect } from '@playwright/test';

// Wave 1 — AI trust & infra foundation.
// gemFetch is intercepted to capture the outgoing prompt (no real network / key needed).
// Boots once; language is switched via the store (askGemini/aiJSON read getLang() at call time).
const bootAI = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gemkey', JSON.stringify('test-key'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof aiJSON==='function' && typeof askGemini==='function'`);
  await page.evaluate(`window.__cap=[]; window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body}); return { ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]}) }; };`);
};
const capAfter = async (page: any, jsCall: string) => {
  const n = await page.evaluate(`window.__cap.length`) as number;
  await page.evaluate(`(async()=>{ try{ await (${jsCall}); }catch(e){} })()`);
  await page.waitForFunction(`window.__cap.length > ${n}`);
  return page.evaluate(`window.__cap[window.__cap.length-1].body`);
};

test('W1-P1: Ask-the-Fire answers in the UI language (no Hebrew-forced prompt in English)', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`store.set('mk-lang','en')`);
  const en = await capAfter(page, `askGemini('how long to smoke ribs')`);
  expect(en.system_instruction.parts[0].text).toContain('English');
  expect(en.system_instruction.parts[0].text).not.toContain('ענה תמיד בעברית');
  await page.evaluate(`store.set('mk-lang','he')`);
  const he = await capAfter(page, `askGemini('כמה זמן לעשן צלעות')`);
  expect(he.system_instruction.parts[0].text).toContain('ענה תמיד בעברית');
});

test('W1-P1: aiJSON tasks carry an output-language directive that follows the UI language', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`store.set('mk-lang','en')`);
  const en = await capAfter(page, `aiJSON({task:'t', grounding:'g', schemaHint:'{}'})`);
  expect(en.contents[0].parts[0].text).toContain('in ENGLISH');
  await page.evaluate(`store.set('mk-lang','he')`);
  const he = await capAfter(page, `aiJSON({task:'t', grounding:'g', schemaHint:'{}'})`);
  expect(he.contents[0].parts[0].text).not.toContain('in ENGLISH');
  // an explicit outLang override wins over the UI language
  const ov = await capAfter(page, `aiJSON({task:'t', grounding:'g', outLang:'en'})`);
  expect(ov.contents[0].parts[0].text).toContain('in ENGLISH');
});

test('W1-P2: safety detector catches extended patterns and the caveat is bilingual', async ({ page }) => {
  await bootAI(page);
  expect(await page.evaluate(`aiSafetyHasNumbers('cook to 165F')`)).toBe(true);       // bare Fahrenheit
  expect(await page.evaluate(`aiSafetyHasNumbers('use 2.5% salt')`)).toBe(true);        // salt %
  expect(await page.evaluate(`aiSafetyHasNumbers('ferment to pH 5.3')`)).toBe(true);    // pH
  expect(await page.evaluate(`aiSafetyHasNumbers('target aw 0.89')`)).toBe(true);       // water activity
  expect(await page.evaluate(`aiSafetyHasNumbers('cure #1 at 156 ppm')`)).toBe(true);
  expect(await page.evaluate(`aiSafetyHasNumbers('rest for a while then slice thin')`)).toBe(false);
  // bilingual
  expect(await page.evaluate(`aiSafetyCaveat('cure #1 156 ppm')`)).toContain('not verified');
  await page.evaluate(`store.set('mk-lang','he')`);
  expect(await page.evaluate(`aiSafetyCaveat('ריפוי 156 ppm')`)).toContain('אינם מאומתים');
});

test('W1-P2: Diagnose & Journal render the safety caveat only when the AI output has safety numbers', async ({ page }) => {
  await bootAI(page);
  // Diagnose WITH a safety number → caveat present
  await page.evaluate(`diagnoseRender('stall', {diagnosis:'wrap at 70C to push through the stall', causes:['evaporative cooling'], fixes:['bump the pit to 135C'], related:[]})`);
  expect(await page.evaluate(`!!document.querySelector('#panel .ai-caveat')`)).toBe(true);
  await page.evaluate(`closePanel()`);
  // Diagnose WITHOUT numbers → no caveat
  await page.evaluate(`diagnoseRender('bitter', {diagnosis:'too much smoke early on', causes:['creosote buildup'], fixes:['aim for thin blue smoke'], related:[]})`);
  expect(await page.evaluate(`!!document.querySelector('#panel .ai-caveat')`)).toBe(false);
  await page.evaluate(`closePanel()`);
  // Journal insights with a temperature → caveat
  await page.evaluate(`journalInsightsRender({summary:'your best cooks rested longer', patterns:['wrapping at 70C rated higher'], suggestions:[{title:'rest more',detail:'try 45 minutes'}]})`);
  expect(await page.evaluate(`!!document.querySelector('#panel .ai-caveat')`)).toBe(true);
});

test('W1-P3: numeric guard flags ungrounded safety numbers and offers the calculator', async ({ page }) => {
  await bootAI(page);
  // extraction: temps / ppm / % (not incidental "6 hours")
  expect(await page.evaluate(`JSON.stringify(aiSafetyNums('smoke at 110C for 6 hours, cure 156 ppm, 2.5% salt'))`)).toBe(JSON.stringify([110, 156, 2.5]));
  // ungrounded (250 not in context) vs grounded (156 present)
  expect(await page.evaluate(`aiUngroundedSafety('use 250 ppm nitrite', 'vetted: cure #1 156 ppm').length`)).toBe(1);
  expect(await page.evaluate(`aiUngroundedSafety('cure at 156 ppm', 'vetted: 156 ppm').length`)).toBe(0);
  // note escalation: ungrounded → STRONG + calculator link; grounded → mild; none → empty
  const strong = await page.evaluate(`aiSafetyNote('use 250 ppm nitrite', 'vetted: 156 ppm')`) as string;
  expect(strong).toContain('ai-caveat-strong'); expect(strong).toContain('data-aicalc');
  const mild = await page.evaluate(`aiSafetyNote('cure at 156 ppm', 'vetted: 156 ppm')`) as string;
  expect(mild).toContain('ai-caveat'); expect(mild).not.toContain('data-aicalc');
  expect(await page.evaluate(`aiSafetyNote('rest for a while then slice thin', 'ctx')`)).toBe('');
  // askGemini now returns its grounding context for the guard
  expect(await page.evaluate(`(async()=>{ try{ const r=await askGemini('how long to smoke ribs'); return typeof r.ctx; }catch(e){ return 'err'; } })()`)).toBe('string');
});

test('W1-P3: the calculator deep-link from a strong caveat opens the calculator', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`showPanel('<div class="panel-body">'+aiSafetyNote('use 250 ppm nitrite','vetted: 156 ppm')+'</div>')`);
  await page.click('#panel [data-aicalc]');
  await page.waitForSelector('#panel h2');
  expect(await page.evaluate(`document.querySelector('#panel h2').textContent`)).toContain('Calculators');
});
