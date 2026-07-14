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
