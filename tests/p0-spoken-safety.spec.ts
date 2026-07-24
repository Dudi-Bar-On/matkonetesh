import { test, expect, seedApp } from './_fixtures';

// P0-app item 1 (spec §3.1) — ULTIMATE A1/A2, the only paths where a wrong safety number is SPOKEN to a
// cook with busy hands and no visible caveat. The invariant: no model-originated safety number is ever
// voiced. vcAskAI/vcTranslateToEn already carry test-only mock seams (window.__vcAskMock at app.js:5353,
// window.__vcTransMock at app.js:5272) — the established way to inject controlled model output.
const bootVC = async (page: any) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-gemkey': JSON.stringify('test-key'),
  });
  await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
  // capture what actually reaches speech, without a real TTS call
  await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
};

test('A1 unmatched — a leaked safety number never reaches speech or the transcript', async ({ page }) => {
  await bootVC(page);
  // The REAL 3.6-flash B11 leak shape (comparison-2.5-vs-3.6-2026-07-24.md): botulism kill temperatures
  // that are absent from the app's grounding in any unit. No active cook, no catalog match → nothing
  // resolves → every number must be stripped and the redirect must fire.
  await page.evaluate(`window.__vcAskMock='רעלן הבוטוליזם מנוטרל סביב 85°C, והנבגים נהרסים ב-100-121°C.'; vcTasks=[]; vcIdx=0;`);
  await page.evaluate(`vcAskFlow('שאלה: באיזו טמפרטורה נהרס בוטוליזם')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  const shown  = await page.evaluate(`vcLastQA.a`) as string;
  for (const n of ['85', '100', '121']) {
    expect(spoken).not.toContain(n);
    expect(shown).not.toContain(n);   // the sighted user must read exactly what the hands-busy user hears
  }
  expect(spoken).toContain('אינו מאומת');
  expect(shown).toBe(spoken);
});

test('A1 matched — a number that IS the resolved item\'s verified value is spoken with the verified marker', async ({ page }) => {
  await bootVC(page);
  // cut-1 (brisket) resolved as the active-cook item; speak its own verified figure back.
  const safe = await page.evaluate(`(function(){var m=resolveItem('cut-1'); return Math.round(m.obj.safe!=null?m.obj.safe:m.obj.tgt);})()`) as number;
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock='הטמפ׳ הבטוחה היא ${safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ הבטוחה')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(String(safe));
  expect(spoken).toContain('לפי המדריך המאומת');
  expect(spoken).not.toContain('אינו מאומת');
});

test('A1 unit-blind attack — a Fahrenheit number that only matches by digit coincidence is still stripped', async ({ page }) => {
  await bootVC(page);
  // The A3 failure mode aimed at the spoken path: "74°F" shares its digits with the 74°C poultry floor.
  // Task 1's normalization turns it into 23, which matches nothing → it must be stripped, not spoken.
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock='pull it at 74°F and it is safe';`);
  await page.evaluate(`vcAskFlow('ask: what temp')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toContain('74');
  expect(spoken).toContain('אינו מאומת');
});

test('A1 no-numbers — an answer with no safety numbers passes through untouched (DoD-6 negative case)', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='תן לו לנוח כמה דקות ואז פרוס דק.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה עכשיו')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toBe('תן לו לנוח כמה דקות ואז פרוס דק.');
});

test('DoD-10 safety invariance — a full guarded round-trip never mutates the catalog object', async ({ page }) => {
  await bootVC(page);
  const before = await page.evaluate(`JSON.stringify(resolveItem('cut-1').obj)`) as string;
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock='נסה 85°C ו-121°C';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const after = await page.evaluate(`JSON.stringify(resolveItem('cut-1').obj)`) as string;
  expect(after).toBe(before);
});
