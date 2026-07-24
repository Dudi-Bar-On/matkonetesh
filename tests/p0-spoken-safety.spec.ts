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
  expect(spoken).toContain('המספרים האלה אינם מאומתים');
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

test('a redacted range collapses to ONE placeholder, not two joined by a dash', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='הנבגים נהרסים ב-100-121°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toContain('—–—');                              // the dash pile the screenshot showed
  expect((spoken.match(/\[…\]/g) || []).length).toBe(1);            // one range → exactly one placeholder
  expect(spoken).toContain('מספר זה אינו מאומת');                    // one redacted token → SINGULAR
});

test('the redirect line is count-aware: two redacted tokens read as plural', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='רעלן הבוטוליזם מנוטרל סביב 85°C, והנבגים נהרסים ב-100-121°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect((spoken.match(/\[…\]/g) || []).length).toBe(2);            // one single + one range = two tokens
  expect(spoken).toContain('המספרים האלה אינם מאומתים');
  expect(spoken).not.toContain('מספר זה אינו מאומת');
});

test('spec §3.1: a number verified by the CATALOG survives even when the active-cook item has no matching field', async ({ page }) => {
  await bootVC(page);
  // Active step is a build-from-scratch `make` — its .obj carries only heb/eng/cat/diff/build, so Tier 1
  // (vcResolveTiers's r1) resolves an item but that item has none of safe/tgt/svt/smt/sot: vcVerifiedNums
  // returns []. The number is a real verified figure belonging to a CATALOG cut, findable only via Tier 2
  // (askFindEntity on the question text). Before the fix (single-winner vcResolveEntity, which returns
  // Tier 1 the moment it RESOLVES regardless of field match) this was redacted as unverified — a correct
  // number, wrongly withheld. We search for a cut whose Hebrew name askFindEntity resolves unambiguously
  // to itself, so the fixture is self-verifying rather than assuming catalog contents/prompt phrasing.
  const setup = await page.evaluate(`(function(){
    var mk=Object.keys(DATA.makes)[0];
    for (var i=0;i<DATA.cuts.length;i++){
      var c=DATA.cuts[i];
      if (c.safe==null) continue;
      var q='מה הטמפ הבטוחה ל'+c.heb;
      var hits=askFindEntity(q.toLowerCase());
      var best=hits && hits[0];
      if (best && best.obj && best.obj.n===c.n && best.obj.safe===c.safe){
        return {ikey:'make-'+mk, heb:c.heb, safe:Math.round(c.safe), q:q};
      }
    }
    return null;
  })()`) as {ikey:string; heb:string; safe:number; q:string} | null;
  expect(setup).not.toBeNull();
  const { ikey, heb, safe, q } = setup!;
  await page.evaluate(`vcTasks=[{ikey:'${ikey}',label:'x',t:new Date()}]; vcIdx=0;
    window.__vcAskMock='עבור ${heb} הטמפ׳ הבטוחה היא ${safe}°C.';`);
  await page.evaluate(`vcAskFlow(${JSON.stringify('שאלה: ' + q)})`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(String(safe));
  expect(spoken).toContain('לפי המדריך המאומת');
  expect(spoken).not.toContain('[…]');
});

test('matched RANGE — two verified bounds from the resolved item survive together, joined by an en dash (L13 bidi risk)', async ({ page }) => {
  await bootVC(page);
  // Read two DISTINCT verified fields off a real cut at runtime (never hardcoded) so this genuinely
  // exercises vcGuardSpoken's `cs.every(ok) ? cs.map(...).join('–') : ...` matched-RANGE branch, which
  // shipped with Task 2 but had no test and appeared in no screenshot.
  const setup = await page.evaluate(`(function(){
    for (var i=0;i<DATA.cuts.length;i++){
      var c=DATA.cuts[i];
      var vals=vcVerifiedNums({obj:c});
      var uniq=vals.filter(function(v,idx){ return vals.indexOf(v)===idx; });
      if (uniq.length>=2) return {ikey:'cut-'+c.n, lo:Math.min(uniq[0],uniq[1]), hi:Math.max(uniq[0],uniq[1])};
    }
    return null;
  })()`) as {ikey:string; lo:number; hi:number} | null;
  expect(setup).not.toBeNull();
  const { ikey, lo, hi } = setup!;
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{ikey:'${ikey}',label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock='הטווח הבטוח הוא ${lo}-${hi}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטווח הבטוח')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(`${lo}°C–${hi}°C`);
  expect(spoken).toContain('לפי המדריך המאומת');
  expect(spoken).not.toContain('[…]');
  // DoD-8 visual evidence: also render the on-screen transcript (vc-qa) and capture it — L13 exists
  // because a bidi run can flip which glyph reads as "greater"; the on-screen (not just spoken) figure
  // must show lo before hi with the en dash sitting correctly between them. Per the prior wave's finding
  // (task-2-report.md): the panel slides in via CSS transition and the transcript sits below the panel's
  // own internal scroll container, so wait on the panel's RESOLVED position (not just text presence) and
  // scrollIntoView() the transcript before capturing — both condition-based, no waitForTimeout (DoD-11).
  await page.waitForFunction(`document.querySelector('.vc-qa-a') && document.querySelector('.vc-qa-a').textContent.includes('°C')`);
  await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
  await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
  await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
    return r.top>=0 && r.bottom<=window.innerHeight; })()`);
  await page.screenshot({ path: '.superpowers/sdd/task-2-matched-range-390x844.png' });
});
