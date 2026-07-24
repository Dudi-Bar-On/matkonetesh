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

test('a within-item range is redacted — a RANGE is never "verified", even when both bounds are real (owner ruling 2026-07-24)', async ({ page }) => {
  await bootVC(page);
  // INVERTS the old "matched RANGE ... survive together" test, which encoded the defect a code review
  // found: two individually-verified figures off the SAME resolved item (e.g. svt+smt spliced together)
  // could be spoken as a range under the "לפי המדריך המאומת" marker even though the app asserts no such
  // range — the app's data holds discrete figures only (safe/tgt/svt/smt/sot), never a range, so a range
  // is always a model-composed claim the app cannot vouch for. Same treatment ppm/%/pH already get.
  // Read two DISTINCT verified fields off a real cut at runtime (never hardcoded) so this genuinely
  // exercises vcGuardSpoken's range path.
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
  expect(spoken).not.toContain(`${lo}°C–${hi}°C`);
  expect(spoken).toContain('[…]');
  expect(spoken).toContain('מספר זה אינו מאומת');   // one range → ONE redacted token → SINGULAR redirect line
  expect(spoken).not.toContain('לפי המדריך המאומת');
  // DoD-8 visual evidence: also render the on-screen transcript (vc-qa) and capture it — the on-screen
  // (not just spoken) figure must show the redaction placeholder, not a spliced range. Per the prior
  // wave's finding (task-2-report.md): the panel slides in via CSS transition and the transcript sits
  // below the panel's own internal scroll container, so wait on the panel's RESOLVED position (not just
  // text presence) and scrollIntoView() the transcript before capturing — both condition-based, no
  // waitForTimeout (DoD-11).
  await page.waitForFunction(`document.querySelector('.vc-qa-a') && document.querySelector('.vc-qa-a').textContent.includes('[…]')`);
  await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
  await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
  await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
    return r.top>=0 && r.bottom<=window.innerHeight; })()`);
  await page.screenshot({ path: '.superpowers/sdd/task-2-range-redacted-390x844.png' });
});

test('a cross-tier range is redacted — two real figures from DIFFERENT items are not a verified range', async ({ page }) => {
  await bootVC(page);
  // Tier 1 supplies one figure, Tier 2 (the catalog item named in the question) supplies the other.
  // Both digits are genuinely from the app's data; the RANGE they form is not, so it must be redacted.
  const f = await page.evaluate(`(function(){
    var cuts=DATA.cuts.filter(function(c){ return c.safe!=null; });
    var a=cuts[0], b=cuts.find(function(c){ return Math.round(c.safe)!==Math.round(cuts[0].safe); });
    return {ikey:'cut-'+a.n, aSafe:Math.round(a.safe), bHeb:b.heb, bSafe:Math.round(b.safe)};
  })()`) as {ikey:string; aSafe:number; bHeb:string; bSafe:number};
  const lo = Math.min(f.aSafe, f.bSafe), hi = Math.max(f.aSafe, f.bSafe);
  await page.evaluate(`vcTasks=[{ikey:'${f.ikey}',label:'x',t:new Date()}]; vcIdx=0;
    window.__vcAskMock='הטווח הוא ${lo}-${hi}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ ל${f.bHeb}')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain('[…]');
  expect(spoken).not.toContain('לפי המדריך המאומת');
});

test('A2 — a translation that drops or invents a number is never spoken; the Hebrew source is read instead', async ({ page }) => {
  await bootVC(page);
  // The translation silently changes 74 → 165: mtNumSig differs, so mtSafe is false.
  await page.evaluate(`window.__vcTransMock='pull the chicken at 165 degrees'; store.set('mk-vclang','en');`);
  await page.evaluate(`vcSpeakContent('משוך את העוף ב-74 מעלות')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1]`) as { t: string; l: string };
  expect(spoken.t).not.toContain('165');
  expect(spoken.t).toContain('74');                    // the correct Hebrew source is what gets read
  expect(spoken.t).toContain('מספר לא מאומת בתרגום');
  expect(spoken.l).toBe('he');
});

test('A2 negative case — a faithful translation still speaks in English (DoD-6)', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`window.__vcTransMock='pull the chicken at 74 degrees'; store.set('mk-vclang','en');`);
  await page.evaluate(`vcSpeakContent('משוך את העוף ב-74 מעלות')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1]`) as { t: string; l: string };
  expect(spoken.t).toBe('pull the chicken at 74 degrees');
  expect(spoken.l).toBe('en');
});

test('A2 transposition — a translation that SWAPS a temperature and a time is never spoken', async ({ page }) => {
  await bootVC(page);
  // mtSafe's sorted multiset cannot see this: {74,165} === {165,74}. Ordered comparison can.
  await page.evaluate(`window.__vcTransMock='pull at 165 degrees for 74 minutes'; store.set('mk-vclang','en');`);
  await page.evaluate(`vcSpeakContent('משוך ב-74 מעלות למשך 165 דקות')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1]`) as {t:string;l:string};
  expect(spoken.l).toBe('he');                       // fell back to the Hebrew source
  expect(spoken.t).toContain('מספר לא מאומת בתרגום');
  expect(spoken.t).not.toContain('165 degrees');
});

test('A2 real input shape — the clock prefix every production caller sends is handled (L8)', async ({ page }) => {
  await bootVC(page);
  // Every real caller passes vcCurrentText, which ALWAYS prepends a 24h he-IL clock. The shipped tests
  // used hand-crafted strings with no clock, so this shape was never exercised.
  await page.evaluate(`window.__vcTransMock='14:30. Put it in the oven at 74 degrees.'; store.set('mk-vclang','en');`);
  await page.evaluate(`vcSpeakContent('14:30. הכנס לתנור ל-74 מעלות.')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const ok = await page.evaluate(`window.__spoke[window.__spoke.length-1]`) as {t:string;l:string};
  expect(ok.l).toBe('en');                           // numbers preserved → English spoken
  // and the AM/PM conversion the hardened prompt now forbids must still fail CLOSED if it happens
  await page.evaluate(`window.__spoke=[]; vcTransCache.clear(); window.__vcTransMock='2:30 PM. Put it in the oven at 74 degrees.';`);
  await page.evaluate(`vcSpeakContent('14:30. הכנס לתנור ל-74 מעלות.')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const bad = await page.evaluate(`window.__spoke[window.__spoke.length-1]`) as {t:string;l:string};
  expect(bad.l).toBe('he');
});

test('vcResolveTiers smoke test — Tier 1 (active-cook item) wins when it resolves; the catalog (Tier 2) is a genuine fallback', async ({ page }) => {
  await bootVC(page);
  // vcResolveTiers IS on the real path — vcAskFlow always resolves the tiers itself and passes the winner
  // into vcAskAI explicitly (vcAskAI's own ent===undefined fallback now inlines the same t.t1||t.t2 logic
  // for standalone callers). This proves the tier-priority contract vcAskFlow relies on actually holds.
  await page.waitForFunction(`typeof vcResolveTiers==='function'`);
  const t1 = await page.evaluate(`(function(){
    vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0;
    var t=vcResolveTiers('שאלה: מה הטמפ הבטוחה');
    var r=t.t1||t.t2;
    return r && r.obj ? r.obj.n : null;
  })()`) as number | null;
  expect(t1).toBe(1);   // resolveItem('cut-1').obj.n === 1 — the active-cook item, not a catalog guess
  const t2 = await page.evaluate(`(function(){
    var c=DATA.cuts.find(function(c){ return c.safe!=null; });
    vcTasks=[]; vcIdx=0;                                        // no active-cook item — Tier 1 cannot resolve
    var t=vcResolveTiers('שאלה: מה הטמפ הבטוחה ל'+c.heb);
    var r=t.t1||t.t2;
    return {got: r && r.obj ? r.obj.n : null, expected: c.n};
  })()`) as {got:number|null; expected:number};
  expect(t2.got).toBe(t2.expected);   // falls back to the catalog item named in the question
});

// P0-app item 1, fix wave 4 (owner ruling 2026-07-24) — SYNTAX-INDEPENDENT ELIGIBILITY. Three previous
// fixes keyed on how a range was WRITTEN and each was defeated by a different phrasing: "63°C-74°C"
// (each bound carries its own unit), "between 63°C and 74°C" / Hebrew "בין...ל-" (no dash token at all),
// and "63 to 74°C" / "בין 63 ל-74°C" (the bare lower bound was never even tokenized, so it was voiced
// with NO inspection at all). The rule no longer asks HOW numbers were phrased: the answer must carry
// exactly ONE number in total for that number to be eligible to be spoken as verified. Two or more means
// the model is asserting a composite claim (a range, a comparison, a progression) the app — which stores
// only DISCRETE figures — cannot vouch for. Reproduction: scratch/verify-range-bypass.js.
//
// DoD-2 fixture repair: this loop originally used `vcTasks=[]` with a question that matched no catalog
// item, so the verified set (`ok`) was ALWAYS empty — three of the five rows then passed on first run
// against the UNFIXED (pre-5b43511) code, but for the wrong reason: with `ok` empty, the old code redacted
// every token regardless of phrasing, so the range-detection defect was never exercised (void per DoD-2).
// The real bypass only manifests when BOTH bounds are genuinely verified figures of the active-cook item —
// that is exactly the dangerous case, because the old per-token check (`ok[c]`) then passes EACH bound
// individually and speaks the whole range back under the "verified" marker. Each row below resolves a
// real cut with two DISTINCT verified numeric fields (safe/tgt/svt/smt/sot) at runtime and builds its
// phrasing from those two genuine figures, with that cut set as the active-cook item.
const rangePhrasings: [string, (lo: number, hi: number) => string][] = [
  ['unit on each bound',        (lo, hi) => `${lo}°C-${hi}°C`],
  ['English "between…and"',     (lo, hi) => `between ${lo}°C and ${hi}°C`],
  ['Hebrew "בין…ל-"',            (lo, hi) => `בין ${lo}°C ל-${hi}°C`],
  ['English "to", bare lower',  (lo, hi) => `${lo} to ${hi}°C`],
  ['Hebrew "בין…ל-", bare lower',(lo, hi) => `בין ${lo} ל-${hi}°C`],
];
for (const [label, phrase] of rangePhrasings) {
  test(`a range phrased as "${label}" is redacted, not spoken as verified`, async ({ page }) => {
    await bootVC(page);
    // Same resolution used by "a within-item range is redacted" above — a cut whose safe/tgt/svt/smt/sot
    // fields carry two DISTINCT verified figures, found at runtime rather than hardcoded.
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
    const mock = phrase(lo, hi);
    await page.evaluate(`vcTasks=[{ikey:'${ikey}',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock=${JSON.stringify(mock)};`);
    await page.evaluate(`vcAskFlow('שאלה: מה הטווח')`);
    await page.waitForFunction(`window.__spoke.length>1`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    expect(spoken).not.toContain('לפי המדריך המאומת');   // never the verified marker
    expect(spoken).toContain('[…]');
    expect(spoken).not.toMatch(/\d/);                    // NO digit survives, tokenized or not
  });
}

// Phase A completion gate, FIX 1 — the demonstrated leak on the real built app: an English Voice Cook
// answer using WORD-FORM units ("121 degrees Celsius", "85 degrees") bypassed the guard entirely, because
// aiSafetyNums (built on SAFETY_UNIT, which had no word-form alternatives) returned [] and
// vcGuardSpoken's early return ("no safety numbers at all -> untouched") let it through verbatim.
test('word-form units are guarded — the English leak the Phase A audit found', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; store.set('mk-vclang','en');
    window.__vcAskMock='Botulism spores are destroyed at 121 degrees Celsius; the toxin breaks down near 85 degrees.';`);
  await page.evaluate(`vcAskFlow('ask: what temp kills botulism')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toMatch(/\d/);
  expect(spoken).not.toContain('per the app\'s verified guide');
});

// Phase A completion gate, FIX 3 — spec §2.1 / L13: a number rendered beside a Hebrew label needs a
// dir="ltr" island, or bidi reordering can visually flip the pair (a "≥" once rendered as "≤"). vcRender
// rendered esc(vcLastQA.a) with no such island at all. vcLtrNums wraps only the matched number/unit
// TOKEN (never the whole mixed-language sentence — see app.js:6239's L13 note on why not), reusing the
// shared safetyTokenRe() so it recognises exactly the same tokens the guard itself does.
test('FIX 3 — vcLtrNums wraps a matched number/unit token and leaves the redaction placeholder untouched', async ({ page }) => {
  await bootVC(page);
  await page.waitForFunction(`typeof vcLtrNums==='function'`);
  expect(await page.evaluate(`vcLtrNums('הטמפ׳ הבטוחה היא 74°C.')`)).toContain('<span dir="ltr">74°C</span>');
  // the VC_REDACT placeholder ("[…]") carries no digits — safetyTokenRe() must not match it, so it must
  // pass through with no island inserted around it.
  expect(await page.evaluate(`vcLtrNums('מספר זה אינו מאומת — […] בכרטיס.')`)).not.toContain('<span dir="ltr">');
});

test('FIX 3 — the on-screen transcript wraps a matched verified number in a dir="ltr" island (DoD-8 evidence below)', async ({ page }) => {
  await bootVC(page);
  const f = await page.evaluate(`(function(){var c=DATA.cuts.find(function(x){return x.safe!=null;}); return {ikey:'cut-'+c.n, safe:Math.round(c.safe)};})()`) as {ikey:string; safe:number};
  // #vcBody only exists once the Voice Cook panel is open — bootVC alone (used by the spoken-path tests
  // above) never opens it, so it must be opened explicitly here to exercise the real vcRender DOM path.
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{ikey:'${f.ikey}',label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock='הטמפ׳ הבטוחה היא ${f.safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ הבטוחה')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('${f.safe}')>=0; })()`);
  await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
  const html = await page.evaluate(`document.querySelector('.vc-qa-a').innerHTML`) as string;
  expect(html).toContain(`<span dir="ltr">${f.safe}°C</span>`);
  // DoD-8 visual evidence: matched single verified number rendered in the Hebrew transcript, at 390x844
  // (the suite's default viewport).
  await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
  await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
    return r.top>=0 && r.bottom<=window.innerHeight; })()`);
  await page.screenshot({ path: '.superpowers/sdd/task-2-ltr-island-390x844.png' });
});

test('regression: a lone verified number IS still spoken with the marker (the rule must narrow, not disable)', async ({ page }) => {
  await bootVC(page);
  const f = await page.evaluate(`(function(){var c=DATA.cuts.find(function(x){return x.safe!=null;}); return {ikey:'cut-'+c.n, safe:Math.round(c.safe)};})()`) as {ikey:string; safe:number};
  await page.evaluate(`vcTasks=[{ikey:'${f.ikey}',label:'x',t:new Date()}]; vcIdx=0;
    window.__vcAskMock='הטמפ׳ הבטוחה היא ${f.safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ הבטוחה')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(String(f.safe));
  expect(spoken).toContain('לפי המדריך המאומת');
});

// Fix wave (reviewer finding, 2026-07-24) — PART A: vcGuardSpoken's local DIGITS regex (\d+(?:[.,]\d+)?)
// treats a comma as part of ONE number, but SAFETY_TOKEN_SRC's number sub-pattern (\d+(?:\.\d+)?) has no
// comma support. "1,063°C" therefore counted as ONE digit run (eligible branch), while the tokenizer could
// only match the tail "063°C" -> 63, found 63 verified, and substituted it back as "1,63°C" — a value the
// model never said, spoken under the "verified" marker. This is fail-WRONG, worse than fail-closed.
test('a comma-grouped number is never rewritten into a corrupted "verified" value', async ({ page }) => {
  await bootVC(page);
  const f = await page.evaluate(`(function(){var c=DATA.cuts.find(function(x){return x.safe!=null;}); return {ikey:'cut-'+c.n, safe:Math.round(c.safe)};})()`) as {ikey:string; safe:number};
  // "1,0<safe>°C" — the tokenizer used to drop the "1," prefix, match the tail against a real verified
  // figure, and substitute it back, producing a number the model never said, marked verified.
  await page.evaluate(`vcTasks=[{ikey:'${f.ikey}',label:'x',t:new Date()}]; vcIdx=0;
    window.__vcAskMock='הטמפ׳ היא 1,0${f.safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>1`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toContain('לפי המדריך המאומת');
  expect(spoken).not.toMatch(/\d/);
});

// Fix wave (owner ruling, 2026-07-24) — PART B: vcTransSafe compared numbers in ORDER, which caught
// transposition but refused faithful translations that front a clause (routine Hebrew→English). Owner
// ruling: compare (value, unit-CLASS) pairs, UNORDERED — a transposition still changes the pairs, but a
// clause reorder does not. An unrecognised unit leaves a number unclassified and forces strict positional
// comparison, so an incomplete lexicon fails CLOSED, never open.
test('A2 — a faithful translation that fronts a clause is now accepted', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`window.__vcTransMock='After about 165 minutes, pull the chicken once it reaches 74 degrees'; store.set('mk-vclang','en');`);
  await page.evaluate(`vcSpeakContent('משוך את העוף כאשר הטמפ מגיעה ל-74 מעלות, אחרי כ-165 דקות')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  expect(await page.evaluate(`window.__spoke[window.__spoke.length-1].l`)).toBe('en');
});

test('A2 — a TRANSPOSED translation is still rejected (the reorder tolerance must not reopen the swap)', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`window.__vcTransMock='pull at 165 degrees for 74 minutes'; store.set('mk-vclang','en');`);
  await page.evaluate(`vcSpeakContent('משוך ב-74 מעלות למשך 165 דקות')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const s = await page.evaluate(`window.__spoke[window.__spoke.length-1]`) as {t:string;l:string};
  expect(s.l).toBe('he');
  expect(s.t).toContain('מספר לא מאומת בתרגום');
});

// P0-app item 3 (spec §3.3) — google_search was unconditional at askGemini (app.js:4340) and vcAskAI
// (5361-ish). When the app already holds vetted data for the question, search adds COGS and an indirect-
// injection surface without adding value. aiJSON's own `search?` gate was already conditional; this closes
// the last two unconditional call sites.
const capBody = async (page: any, jsCall: string) => {
  const n = await page.evaluate(`window.__cap.length`) as number;
  await page.evaluate(`(async()=>{ try{ await (${jsCall}); }catch(e){} })()`);
  await page.waitForFunction(`window.__cap.length > ${n}`);
  return page.evaluate(`window.__cap[window.__cap.length-1].body`);
};
const bootCap = async (page: any) => {
  await bootVC(page);
  await page.evaluate(`window.__cap=[]; window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body}); return { ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'ok'}]}}]}) }; };`);
};

test('E2 askGemini — a catalog-matching question carries NO google_search tool', async ({ page }) => {
  await bootCap(page);
  // Build the question from a REAL cut's own Hebrew name at runtime (never hardcoded) so askFindEntity's
  // direct-match path is guaranteed to fire — and assert that BELOW, before trusting the negative `tools`
  // assertion. Three tests earlier today were fooled by a fixture that matched nothing (DoD-6/L-shape).
  const heb = await page.evaluate(`DATA.cuts[0].heb`) as string;
  const q = `כמה זמן לעשן ${heb}`;
  const ctx = await page.evaluate(`askContextFor(${JSON.stringify(q)}).ctx`) as string;
  expect(ctx).not.toBe('');   // grounding really was found for this question
  const body = await capBody(page, `askGemini(${JSON.stringify(q)})`);
  expect(body.tools).toBeFalsy();
});

test('E2 askGemini — an open question with no local grounding KEEPS google_search', async ({ page }) => {
  await bootCap(page);
  const q = 'איפה קונים פחם איכותי בשרון';
  const ctx = await page.evaluate(`askContextFor(${JSON.stringify(q)}).ctx`) as string;
  expect(ctx).toBe('');   // confirm this really IS the ungrounded case before trusting the positive assertion
  const body = await capBody(page, `askGemini(${JSON.stringify(q)})`);
  expect(body.tools).toEqual([{ google_search: {} }]);
});

test('E2 vcAskAI — search follows whether an entity resolved', async ({ page }) => {
  await bootCap(page);
  await page.evaluate(`delete window.__vcAskMock; vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0;`);
  const ent1 = await page.evaluate(`(function(){ var t=vcResolveTiers('מה הטמפ'); var r=t.t1||t.t2; return !!(r && r.obj); })()`);
  expect(ent1).toBe(true);   // Tier 1 (active-cook item) really resolved before trusting the negative assertion
  const grounded = await capBody(page, `vcAskAI('מה הטמפ', (function(){ var t=vcResolveTiers('מה הטמפ'); return t.t1||t.t2; })())`);
  expect(grounded.tools).toBeFalsy();
  await page.evaluate(`vcTasks=[]; vcIdx=0;`);
  const ent2 = await page.evaluate(`(function(){ var t=vcResolveTiers('איפה קונים פחם'); var r=t.t1||t.t2; return !!(r && r.obj); })()`);
  expect(ent2).toBe(false);   // confirm nothing resolved before trusting the positive assertion
  const open = await capBody(page, `vcAskAI('איפה קונים פחם', (function(){ var t=vcResolveTiers('איפה קונים פחם'); return t.t1||t.t2; })())`);
  expect(open.tools).toEqual([{ google_search: {} }]);
});

// Phase A completion gate, FIX 4 — spec §3.3's own named DoD line: "Required test: same before/after
// snapshot of resolveItem(key).obj pattern as items 1 and 2." The spec calls this "trivially passes" (the
// conditional-google_search change is request-shaping only; askGemini never touches DATA/store) — written
// anyway because it is a named DoD line, not an optional one. The mechanism itself was verified by
// execution: a scratch variant of this exact test with a deliberate DATA mutation injected into the
// gemFetch mock (never into app.js) was run and observed FAILING for exactly this reason before being
// reverted, matching items 1/2's own snapshot pattern (see "DoD-10 safety invariance" above).
test('P0-app item 3 (spec §3.3) required test — resolveItem(key).obj is byte-identical before/after an askGemini call', async ({ page }) => {
  await bootCap(page);
  const before = await page.evaluate(`JSON.stringify(resolveItem('cut-1').obj)`) as string;
  await capBody(page, `askGemini('שאלה: מה הטמפ הבטוחה לחזה בקר')`);
  const after = await page.evaluate(`JSON.stringify(resolveItem('cut-1').obj)`) as string;
  expect(after).toBe(before);
});

