import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof pref==='function' && typeof setPref==='function'`);
};

test('P1: pref() returns the default for absent and invalid values; setPref validates', async ({ page }) => {
  await boot(page);
  // absent → default
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  expect(await page.evaluate(`pref('autonomy')`)).toBe('advise');
  expect(await page.evaluate(`pref('theme')`)).toBe('cream');
  expect(await page.evaluate(`pref('uiLevel')`)).toBe('mid');
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1);
  expect(await page.evaluate(`pref('tlShape')`)).toBe(null);
  // invalid stored value → default (never the garbage)
  await page.evaluate(`store.set('mk-pref-units','furlongs'); store.set('mk-theme','neon'); store.set('mk-fontscale',99)`);
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  expect(await page.evaluate(`pref('theme')`)).toBe('cream');
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1);
  // setPref accepts valid, rejects invalid, and persists
  expect(await page.evaluate(`setPref('units','imperial')`)).toBe(true);
  expect(await page.evaluate(`pref('units')`)).toBe('imperial');
  expect(await page.evaluate(`setPref('units','stones')`)).toBe(false);
  expect(await page.evaluate(`pref('units')`)).toBe('imperial');       // unchanged by the rejected write
  expect(await page.evaluate(`setPref('nope','x')`)).toBe(false);      // unknown key
  // numeric coercion parity with the old fontScale()
  expect(await page.evaluate(`setPref('fontScale',1.15)`)).toBe(true);
  expect(await page.evaluate(`pref('fontScale')`)).toBe(1.15);
});

test('P2: the existing helpers delegate to pref() with identical results for every input', async ({ page }) => {
  await boot(page);
  const cases: Array<[string,string,any,any]> = [
    // [storeKey, helperExpression, storedValue, expected]
    ['mk-theme',     'themeKey()',        'charcoal', 'charcoal'],
    ['mk-theme',     'themeKey()',        'neon',     'cream'],     // invalid → default
    ['mk-theme',     'themeKey()',        null,       'cream'],     // absent  → default
    ['mk-uilevel',   'uiLevel()',         'pro',      'pro'],
    ['mk-uilevel',   'uiLevel()',         'wat',      'mid'],
    ['mk-fontscale', 'fontScale()',       1.3,        1.3],
    ['mk-fontscale', 'fontScale()',       7,          1],
    ['mk-fontscale', 'fontScale()',       null,       1],
    ['mk-fontpair',  'fontPairKey()',     'editorial','editorial'],
    ['mk-fontpair',  'fontPairKey()',     'zzz',      'current'],
    ['mk-tlshape',   'tlShapeOverride()', '3',        '3'],
    ['mk-tlshape',   'tlShapeOverride()', 'x',        null],
  ];
  for (const [key, expr, val, want] of cases) {
    await page.evaluate(`store.set(${JSON.stringify(key)}, ${JSON.stringify(val)})`);
    expect(await page.evaluate(expr), `${expr} with ${key}=${JSON.stringify(val)}`).toBe(want);
  }
  // tlShape() stays DERIVED: override wins, else it falls back to the level's shape
  await page.evaluate(`store.set('mk-tlshape',''); store.set('mk-uilevel','pro')`);
  expect(await page.evaluate(`tlShape()`)).toBe('3');
  await page.evaluate(`store.set('mk-tlshape','1')`);
  expect(await page.evaluate(`tlShape()`)).toBe('1');
});

const capBody = async (page: any, call: string) => {
  await page.evaluate(`window.__cap=[]; window.gemFetch=async(m,b)=>{ window.__cap.push(b); return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]})}; };`);
  await page.evaluate(`(async()=>{ try{ await (${call}); }catch(e){} })()`);
  await page.waitForFunction(`window.__cap.length>0`);
  return page.evaluate(`window.__cap[0]`);
};

test('P3: pref("units") governs the metric directive in every AI prompt builder', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k')`);
  // default (metric) → the directive is present, in Hebrew AND English
  expect(await page.evaluate(`pref('units')`)).toBe('metric');
  let b = await capBody(page, `askGemini('כמה זמן לעשן חזה')`) as any;
  expect(b.system_instruction.parts[0].text).toContain('מטריות');
  b = await capBody(page, `aiJSON({task:'t',grounding:'g'})`) as any;
  expect(b.contents[0].parts[0].text).toContain('מטריות');
  expect(await page.evaluate(`vcBuildAskPrompt('q','he','').sys`)).toContain('מטריות');
  await page.evaluate(`store.set('mk-lang','en')`);
  b = await capBody(page, `askGemini('how long to smoke brisket')`) as any;
  expect(b.system_instruction.parts[0].text).toContain('metric');   // English UI, metric pref → still enforced
  // imperial → no metric directive anywhere
  await page.evaluate(`setPref('units','imperial'); store.set('mk-lang','he')`);
  b = await capBody(page, `askGemini('כמה זמן לעשן חזה')`) as any;
  expect(b.system_instruction.parts[0].text).not.toContain('מטריות');
  b = await capBody(page, `aiJSON({task:'t',grounding:'g'})`) as any;
  expect(b.contents[0].parts[0].text).not.toContain('מטריות');
  expect(await page.evaluate(`vcBuildAskPrompt('q','he','').sys`)).not.toContain('מטריות');
});
