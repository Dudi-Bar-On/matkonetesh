import { test, expect } from '@playwright/test';
import { modelIsListed } from '../lib/preflight';

// PRE-4 / decision 5 — the model-migration preflight. The helper test is deterministic (no key). The live
// test confirms each role id EXISTS (ListModels) and one REAL call per role succeeds through the app's own
// payload builders — the check that catches the thinkingBudget/thinkingLevel 400 that shipped on gemini-3.6.
const LIVE_KEY = process.env.GEMINI_EVAL_KEY || process.env.GEMINI_API_KEY || '';

test('preflight helper: modelIsListed matches a ListModels entry by bare id or models/<id> name', () => {
  const list = { models: [ { name: 'models/gemini-3.6-flash' }, { name: 'models/gemini-3.1-flash-tts-preview' } ] };
  expect(modelIsListed(list, 'gemini-3.6-flash')).toBe(true);
  expect(modelIsListed(list, 'gemini-3.1-flash-tts-preview')).toBe(true);
  expect(modelIsListed(list, 'gemini-9.9-imaginary')).toBe(false);
  expect(modelIsListed({}, 'gemini-3.6-flash')).toBe(false);
});

const bootLive = async (page: any, key: string) => {
  await page.addInitScript((k: string) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gemkey', JSON.stringify(k));
  } catch {} }, key);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof gemId==='function' && typeof gemGen==='function' && typeof gemTtsGen==='function' && typeof gemReadAudio==='function'`);
};

test('preflight LIVE: each role id is listed AND one real call per role returns its kind', async ({ page }) => {
  test.skip(!LIVE_KEY,
    'No live key (GEMINI_EVAL_KEY / GEMINI_API_KEY). The model-migration preflight is a pre-ship GATE ' +
    '(decision 5) and needs the owner-provisioned key. This skip is EXPECTED with no key — it is visible, not a silent pass.');
  await bootLive(page, LIVE_KEY);
  const ids = await page.evaluate(`({ text: gemId('text'), tts: gemId('tts') })`) as any;

  // 1) ListModels — confirm each id EXISTS on the developer API (kills the "invalid id" red herring, §5)
  const listRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': LIVE_KEY } });
  const list = await listRes.json();
  expect(modelIsListed(list, ids.text)).toBe(true);
  expect(modelIsListed(list, ids.tts)).toBe(true);

  // 2) One REAL call per role, through the app's own builders (catches the payload 400 the id check would miss)
  const textOut = await page.evaluate(`(async function(){
    const body={ contents:[{role:'user',parts:[{text:'Say the single word OK.'}]}], generationConfig: gemGen('text', {maxOutputTokens:16}, {think:'minimal'}) };
    const r = await gemFetch('text', body, {retries:0, timeout:30000});
    if(!r.ok) throw new Error('text api-'+r.status);
    return gemReadText(await r.json());
  })()`) as string;
  expect(textOut.trim().length).toBeGreaterThan(0);   // text role → non-empty text

  const audio = await page.evaluate(`(async function(){
    const body={ contents:[{parts:[{text:'שלום'}]}], generationConfig: gemTtsGen(gemVoice()) };
    const r = await gemFetch('tts', body, {retries:0, timeout:30000});
    if(!r.ok) throw new Error('tts api-'+r.status);
    const out = gemReadAudio(await r.json());
    return { rate: out.rate, len: out.buf.length };
  })()`) as any;
  expect(audio.len).toBeGreaterThan(0);    // tts role → a real inlineData audio part decoded to samples
  expect(audio.rate).toBeGreaterThan(0);
});
