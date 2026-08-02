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
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(String(safe));
  expect(spoken).toContain('לפי המדריך המאומת');
  expect(spoken).not.toContain('אינו מאומת');
});

// REGRESSION FIX (2026-07-24, closes 0ab7baa) — the real leak shape an independent audit measured on the
// built app: "pull it at 74 deg and it is safe" reached vcSpeak completely unguarded (no digit stripped,
// no marker), because SAFETY_UNIT's post-FIX-C "deg" fragment required a mandatory unit letter and lost
// bare "deg"/"deg."/compact "degC"/"degF" entirely. No active-cook item, no catalog match here (vcTasks=[])
// -> nothing resolves as verified -> the number must be redacted, not spoken.
test('REGRESSION — a leaked "74 deg" temperature never reaches speech or the transcript (closes 0ab7baa)', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`window.__vcAskMock='pull it at 74 deg and it is safe'; vcTasks=[]; vcIdx=0;`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  const shown  = await page.evaluate(`vcLastQA.a`) as string;
  expect(spoken).not.toMatch(/\d/);
  expect(shown).not.toMatch(/\d/);
  expect(spoken).not.toContain('לפי המדריך המאומת');   // never the verified marker
  expect(shown).toBe(spoken);
});

test('A1 unit-blind attack — a Fahrenheit number that only matches by digit coincidence is still stripped', async ({ page }) => {
  await bootVC(page);
  // The A3 failure mode aimed at the spoken path: "74°F" shares its digits with the 74°C poultry floor.
  // Task 1's normalization turns it into 23, which matches nothing → it must be stripped, not spoken.
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock='pull it at 74°F and it is safe';`);
  await page.evaluate(`vcAskFlow('ask: what temp')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toContain('74');
  expect(spoken).toContain('אינו מאומת');
});

test('A1 no-numbers — an answer with no safety numbers passes through untouched (DoD-6 negative case)', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='תן לו לנוח כמה דקות ואז פרוס דק.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה עכשיו')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toBe('תן לו לנוח כמה דקות ואז פרוס דק.');
});

test('DoD-10 safety invariance — a full guarded round-trip never mutates the catalog object', async ({ page }) => {
  await bootVC(page);
  const before = await page.evaluate(`JSON.stringify(resolveItem('cut-1').obj)`) as string;
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock='נסה 85°C ו-121°C';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const after = await page.evaluate(`JSON.stringify(resolveItem('cut-1').obj)`) as string;
  expect(after).toBe(before);
});

test('a redacted range collapses to ONE placeholder, not two joined by a dash', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='הנבגים נהרסים ב-100-121°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toContain('—–—');                              // the dash pile the screenshot showed
  expect((spoken.match(/\[…\]/g) || []).length).toBe(1);            // one range → exactly one placeholder
  expect(spoken).toContain('מספר זה אינו מאומת');                    // one redacted token → SINGULAR
});

test('the redirect line is count-aware: two redacted tokens read as plural', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='רעלן הבוטוליזם מנוטרל סביב 85°C, והנבגים נהרסים ב-100-121°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ')`);
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain('[…]');
  expect(spoken).not.toContain('לפי המדריך המאומת');
});

// R-31 world (Task 8, spec §5): vcSpeakContent no longer translates — content is already built in the
// UI language (the HE/EN "answer language" choice, and the translate-then-verify leg it drove, are
// GONE). vcTranslateToEn/vcTransCache stay defined (still directly exercised by
// tests/ai-trust.spec.ts's "no core AI feature throws no-key in managed mode" audit — a live caller
// outside this file, left untouched) and vcTransSafe/vcNumPairs stay defined for a future translation
// surface to reuse (per the Task 8 brief). These four tests used to drive that guard THROUGH
// vcSpeakContent's now-deleted translation leg (window.__vcTransMock + store.set('mk-vclang','en'));
// adapted here to call vcTransSafe directly — same guard logic, same fixtures, no dead integration path.
test('A2 (adapted, R-31) — vcTransSafe rejects a translation that drops or invents a number', async ({ page }) => {
  await bootVC(page);
  const r = await page.evaluate(`vcTransSafe('משוך את העוף ב-74 מעלות', 'pull the chicken at 165 degrees')`);
  expect(r).toBe(false);   // the translation silently changes 74 → 165
});

test('A2 (adapted, R-31) — vcTransSafe accepts a faithful translation (DoD-6 negative case)', async ({ page }) => {
  await bootVC(page);
  const r = await page.evaluate(`vcTransSafe('משוך את העוף ב-74 מעלות', 'pull the chicken at 74 degrees')`);
  expect(r).toBe(true);
});

test('A2 (adapted, R-31) — vcTransSafe rejects a translation that SWAPS a temperature and a time', async ({ page }) => {
  await bootVC(page);
  // an unordered set alone cannot see this ({74,165} === {165,74}); the (value,unit-class) pairing can.
  const r = await page.evaluate(`vcTransSafe('משוך ב-74 מעלות למשך 165 דקות', 'pull at 165 degrees for 74 minutes')`);
  expect(r).toBe(false);
});

test('A2 (adapted, R-31) — the clock prefix every production caller sends is handled (L8)', async ({ page }) => {
  await bootVC(page);
  // Every real caller passes vcCurrentText, which ALWAYS prepends a 24h he-IL clock. The shipped tests
  // used hand-crafted strings with no clock, so this shape was never exercised.
  const ok = await page.evaluate(`vcTransSafe('14:30. הכנס לתנור ל-74 מעלות.', '14:30. Put it in the oven at 74 degrees.')`);
  expect(ok).toBe(true);                              // numbers preserved
  // and an AM/PM conversion must still fail CLOSED if a translation ever attempted one
  const bad = await page.evaluate(`vcTransSafe('14:30. הכנס לתנור ל-74 מעלות.', '2:30 PM. Put it in the oven at 74 degrees.')`);
  expect(bad).toBe(false);
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
    await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
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
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toContain('לפי המדריך המאומת');
  expect(spoken).not.toMatch(/\d/);
});

// Fix wave (owner ruling, 2026-07-24) — PART B: vcTransSafe compared numbers in ORDER, which caught
// transposition but refused faithful translations that front a clause (routine Hebrew→English). Owner
// ruling: compare (value, unit-CLASS) pairs, UNORDERED — a transposition still changes the pairs, but a
// clause reorder does not. An unrecognised unit leaves a number unclassified and forces strict positional
// comparison, so an incomplete lexicon fails CLOSED, never open.
// (adapted, R-31, Task 8) — vcSpeakContent's translation leg is gone (see the block above); these two
// call vcTransSafe directly, same fixtures as before.
test('A2 (adapted, R-31) — vcTransSafe accepts a faithful translation that fronts a clause', async ({ page }) => {
  await bootVC(page);
  const r = await page.evaluate(`vcTransSafe('משוך את העוף כאשר הטמפ מגיעה ל-74 מעלות, אחרי כ-165 דקות', 'After about 165 minutes, pull the chicken once it reaches 74 degrees')`);
  expect(r).toBe(true);
});

test('A2 (adapted, R-31) — vcTransSafe still rejects a TRANSPOSED translation (the reorder tolerance must not reopen the swap)', async ({ page }) => {
  await bootVC(page);
  const r = await page.evaluate(`vcTransSafe('משוך ב-74 מעלות למשך 165 דקות', 'pull at 165 degrees for 74 minutes')`);
  expect(r).toBe(false);
});

// Phase A gate close — FIX A: vcGuardSpoken's eligibility test was a PRIVATE, stale unit pattern
// (/°|C\b|F\b|מעלות/i, ~app.js:5515) that was never updated when SAFETY_UNIT gained word forms — so the
// guard refused to speak the app's OWN verified value in every word-form phrasing except the one that
// happened to end in a bare "C". Replaced with isTempUnit(unit), derived from SAFETY_UNIT (app.js
// ~4447-4451) so it can never drift from what the tokenizer itself recognises. Confirmed by execution
// before the fix (scratch/verify-phase-a-gate-v6.js / the audit table): all three phrasings below were
// redacted with "This number isn't verified"; only the bare-"C" form worked.
const fixAPhrasings: [string, (safe: number) => string][] = [
  ['bare word "degrees", trailing period', (safe) => `the safe temperature is ${safe} degrees.`],
  ['"degrees celsius"',                    (safe) => `${safe} degrees celsius`],
  ['"degrees C" (already worked pre-fix — regression check)', (safe) => `${safe} degrees C`],
];
for (const [label, phrase] of fixAPhrasings) {
  test(`FIX A — "${label}" speaks the app's verified figure with the marker, never a redaction`, async ({ page }) => {
    await bootVC(page);
    await page.evaluate(`store.set('mk-lang','en')`);
    const safe = await page.evaluate(`(function(){var m=resolveItem('cut-1'); return Math.round(m.obj.safe!=null?m.obj.safe:m.obj.tgt);})()`) as number;
    const mock = phrase(safe);
    await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock=${JSON.stringify(mock)};`);
    await page.evaluate(`vcAskFlow('ask: what is the safe temperature')`);
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    expect(spoken).toContain(`${safe}°C`);
    expect(spoken).toContain('per the app\'s verified guide');
    expect(spoken).not.toContain('isn\'t verified');
    expect(spoken).not.toContain('[…]');
  });
}

// COSMETIC (spec brief, "ALSO" section) — when the matched unit token ends in a period ("63 deg.",
// "63 degrees."), the verified substitution used to swallow that period along with the rest of the
// matched token (vcMapSafetyNums replaces the ENTIRE "63 deg." match with "63°C", not just "63 deg."
// minus its trailing dot), producing "...is 63°C per the app's verified guide." with the sentence's own
// full stop simply gone. Not a safety leak (no number/unit changes), but a readability defect.
test('cosmetic — the verified substitution preserves the unit token\'s own trailing period (not swallowed)', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`store.set('mk-lang','en')`);
  const safe = await page.evaluate(`(function(){var m=resolveItem('cut-1'); return Math.round(m.obj.safe!=null?m.obj.safe:m.obj.tgt);})()`) as number;
  const mock = `the safe temperature is ${safe} deg.`;
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock=${JSON.stringify(mock)};`);
  await page.evaluate(`vcAskFlow('ask: what is the safe temperature')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(`${safe}°C.`);   // the sentence's own period must survive the substitution
  expect(spoken).toContain('per the app\'s verified guide');
});

// Phase A gate close — FIX C: the old "deg(?:rees?)?\.?\s*(?:C\b|F\b|celsius|fahrenheit)?" SAFETY_UNIT
// fragment let its unconditional \s* reach across the number-and-unit boundary AND across a sentence
// boundary. This test documents the accepted over-match (an angle is still redacted — the app cannot
// distinguish it from a temperature without semantics, and over-redacting is the safe failure direction)
// while proving the SPACING defect is fixed: the placeholder must not glue itself to the next word.
test('FIX C — a redacted "degree" token keeps its own trailing space (documents the accepted angle over-match)', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcMapSafetyNums('slice at a 45 degree angle', function(){ return '[…]'; })`) as string;
  expect(out).toBe('slice at a […] angle');   // NOT "slice at a […]angle"
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

// 🔴 SAFETY LEAK (commit 1b248a1) — a model-originated FAHRENHEIT number, spaced with any whitespace class
// isFahrenheitUnit failed to recognise (NBSP, LF, thin space, narrow NBSP, …), was left UNCONVERTED by
// aiSafetyToC. When those raw Fahrenheit digits coincidentally match the resolved item's own verified
// Celsius figure (the shape an independent audit measured on the built app: the model says "74°F" — the
// true value is 23°C — while the app's own verified figure for the active item is also "74"), the old
// `ok[c]` check in vcGuardSpoken passed and the RAW unconverted number was spoken back carrying the
// "per the app's verified guide" marker — a wrong, unsafe reading presented to the cook as app-verified.
// Every separator is built with String.fromCharCode, never pasted literally, so there is no risk of a
// look-alike ASCII space silently substituting for the intended code point.
const leakSeps: [string, number][] = [
  ['NBSP', 0x00a0],
  ['LF', 0x0a],
  ['thin space', 0x2009],
  ['narrow NBSP', 0x202f],
];
for (const [label, code] of leakSeps) {
  test(`the leak, end to end — a Fahrenheit number spaced with ${label} between ° and F is never spoken as verified Celsius (closes 1b248a1)`, async ({ page }) => {
    await bootVC(page);
    const sep = String.fromCharCode(code);
    const degSym = String.fromCharCode(0x00b0);   // °
    const safe = await page.evaluate(`(function(){var m=resolveItem('cut-1'); return Math.round(m.obj.safe!=null?m.obj.safe:m.obj.tgt);})()`) as number;
    const mock = `pull it at ${safe}${degSym}${sep}F and it is safe`;
    await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock=${JSON.stringify(mock)};`);
    await page.evaluate(`vcAskFlow('ask: what temp')`);
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    expect(spoken).not.toContain(`${safe}°C`);
    expect(spoken).not.toContain('לפי המדריך המאומת');
  });
}

// Task 13 · R-2/R-3 (H13-approved 2026-07-31, ROADMAP §5a rows R-2/R-3; spec-change §3.1 D2-A+D3-A folded
// as ONE change) — the spoken-"verified"-marker redesign. Source: .superpowers/sdd/task-13-gate-memo.md,
// each of these five holes reproduced live on today's code (v277-era app.js) by direct execution before
// this task. Calling vcGuardSpoken directly (not via vcAskFlow/window.__spoke) matches the brief's own
// Step-3 test shapes — bootVC still boots the app and waits for vcGuardSpoken to exist as a real function.
test('G-A1 hole 1 — a unit-less safety number is never voiced unguarded', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcGuardSpoken('pull it at 165 internal', { t1: { obj: { safe: 74 } } }, 'en')`) as string;
  expect(out).not.toContain('165');
});

test('G-A1 hole 2 — a spelled-out number cannot ride a verified sentence anymore', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcGuardSpoken('63°C, or in some references seventy-four degrees', { t1: { obj: { safe: 63 } } }, 'en')`) as string;
  // R-2: the marker is now attached to "63°C" alone, never to the whole sentence — nothing AFTER the
  // uninspected word-number "seventy-four degrees" may carry the verified claim.
  expect(out.slice(out.indexOf('seventy-four'))).not.toMatch(/verified/i);
});

test('G-A1 addendum — non-canonical Unicode degree/unit variants are inspected, not voiced raw', async ({ page }) => {
  await bootVC(page);
  for (const s of ['74ºC is fine', '74℃ is fine', '74℉ is fine']) {
    const out = await page.evaluate(`vcGuardSpoken(${JSON.stringify(s)}, { t1: { obj: { safe: 74 } } }, 'en')`) as string;
    expect(out, s).not.toMatch(/74[º℃℉]/);   // raw pass-through of the non-canonical form is closed
  }
});

test('G-A1 addendum — Hebrew "מעלות פרנהייט" is never converted/spoken as Celsius', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcGuardSpoken('משוך ב-74 מעלות פרנהייט', { t1: { obj: { safe: 74 } } }, 'he')`) as string;
  expect(out).not.toContain('74°C');
});

test('G-A2 / R-3 — a wrong-field match (sous-vide bath figure) is never spoken as the verified safe temperature', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcGuardSpoken('63°C is the safe internal temperature', { t1: { obj: { safe: 74, svt: 63 } } }, 'en')`) as string;
  expect(out).not.toMatch(/63°C.*verified/);
});

// DoD-8/9 visual evidence — the inline marker (R-2) rendered in the real Hebrew on-screen transcript, at
// 390x844: the number carries "לפי המדריך המאומת" immediately after it, not as a trailing sentence suffix.
test('DoD-8/9 — the inline verified marker renders correctly in the Hebrew voice-panel transcript', async ({ page }) => {
  await bootVC(page);
  const f = await page.evaluate(`(function(){var c=DATA.cuts.find(function(x){return x.safe!=null;}); return {ikey:'cut-'+c.n, safe:Math.round(c.safe)};})()`) as {ikey:string; safe:number};
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{ikey:'${f.ikey}',label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock='הטמפ׳ הבטוחה היא ${f.safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ הבטוחה')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toBe(`הטמפ׳ הבטוחה היא ${f.safe}°C לפי המדריך המאומת.`);   // inline marker, no sentence-suffix, single trailing period
  await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('${f.safe}')>=0; })()`);
  await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
  await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
  await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
    return r.top>=0 && r.bottom<=window.innerHeight; })()`);
  await page.screenshot({ path: '.superpowers/sdd/task-13-inline-marker-390x844.png' });
});

// R-36a (owner-approved 31.7) — the voice-answer prompt now carries a length instruction (measured 4.4x
// faster / 10x shorter, docs/analysis/2026-07-31-qa-latency-measured.md), but brevity must NEVER strip a
// safety answer. No live API calls — vcBuildAskPrompt is pure string assembly, and the round-trip test
// below mocks the model response (__vcAskMock), exactly like every other test in this file.
test('R-36a: the voice-answer system prompt instructs brief spoken style AND exempts safety content (he/en/other)', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(`(function(){
    var he = vcBuildAskPrompt('שאלה', 'he', '').sys;
    var en = vcBuildAskPrompt('q', 'en', '').sys;
    var fr = vcBuildAskPrompt('q', 'fr', '').sys;
    return { he: he, en: en, fr: fr };
  })()`) as { he: string; en: string; fr: string };
  // spoken-style / no-markdown instruction present in every branch
  for (const sys of [r.he, r.en, r.fr]) {
    expect(sys).toMatch(/markdown/i);
  }
  expect(r.he).toContain('עוזר קולי');
  // the safety exemption is explicit, non-negotiable, and names number+unit+caveat
  expect(r.en).toMatch(/safety/i);
  expect(r.en).toMatch(/number/i);
  expect(r.en).toMatch(/unit/i);
  expect(r.en).toMatch(/caveat/i);
  expect(r.he).toMatch(/בטיחות/);
  expect(r.he).toMatch(/היחידה/);
});

// R-48 (docs/analysis/2026-08-01-spelled-out-safety-numbers.md, owner-approved: instruct-the-model over
// widening the digit-only detector). vcGuardSpoken/aiSafetyNums/safetyNumRe recognise digits only, so a
// spelled-out safety number ("תשעים ושש מעלות") sails through unredacted. Fix: tell the model to always
// write safety-bearing numbers as digits. All three vcBuildAskPrompt branches (he/en/other-language) must
// carry the instruction — verified here via the sys-prompt string, same pattern as the R-36a test above.
test('R-48: the voice-answer system prompt instructs safety-bearing numbers to always be written as digits, never spelled out (he/en/other)', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(`(function(){
    var he = vcBuildAskPrompt('שאלה', 'he', '').sys;
    var en = vcBuildAskPrompt('q', 'en', '').sys;
    var fr = vcBuildAskPrompt('q', 'fr', '').sys;
    return { he: he, en: en, fr: fr };
  })()`) as { he: string; en: string; fr: string };
  for (const sys of [r.en, r.fr]) {
    expect(sys).toMatch(/digits/i);
    expect(sys).toMatch(/never.*words|not.*spelled out/i);
  }
  expect(r.he).toMatch(/בספרות/);
  expect(r.he).toMatch(/לעולם לא במילים/);
});

test('R-36a: a brief safety answer still carries the number, unit, and caveat through the guard (mocked model — no live API call)', async ({ page }) => {
  await bootVC(page);
  // simulate the SHORT, brevity-instructed answer shape the measured wording produces — a real verified
  // figure (cut-1's own safe/tgt), not the ~106s-of-speech shape from before R-36a.
  const safe = await page.evaluate(`(function(){var m=resolveItem('cut-1'); return Math.round(m.obj.safe!=null?m.obj.safe:m.obj.tgt);})()`) as number;
  await page.evaluate(`vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; window.__vcAskMock='${safe}°C, ואז אפשר להוציא.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפ הבטוחה')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(String(safe));      // the number
  expect(spoken).toContain('°C');              // its unit
  expect(spoken).toContain('לפי המדריך המאומת'); // the caveat/verification marker
});

// R-53 (owner-reported live defect, 2026-08-01) — reproduces the real asado failure: the model's answer
// carries THREE numbers for one identified item (safe minimum + fully-cooked + tenderness target), the
// "exactly one number total" eligibility rule (owner ruling 2026-07-24, unchanged by this fix) redacts
// all of them — but the app itself holds a cited `safe` figure for the identified cut, so it must be
// substituted back in, in the guide's own name, instead of leaving the cook with zero numbers.
test('R-53: a fully-redacted multi-number safety answer for an identified item is substituted with the app\'s own cited safe figure (the live asado defect)', async ({ page }) => {
  await bootVC(page);
  const setup = await page.evaluate(`(function(){
    for (var i=0;i<DATA.cuts.length;i++){
      var c=DATA.cuts[i];
      if (c.safe==null) continue;
      var q='מה הטמפ הבטוחה ל'+c.heb;
      var hits=askFindEntity(q.toLowerCase());
      var best=hits && hits[0];
      if (best && best.obj && best.obj.n===c.n && best.obj.safe===c.safe){
        return {heb:c.heb, safe:Math.round(c.safe), q:q};
      }
    }
    return null;
  })()`) as {heb:string; safe:number; q:string} | null;
  expect(setup).not.toBeNull();
  const { heb, safe, q } = setup!;
  // No active-cook item (vcTasks=[]) — Tier 1 is null, exactly like the live report; the item is
  // identified ONLY via Tier 2 (askFindEntity on the question text), just like the real repro.
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='${safe}°C מינימלי עם מנוחה, 71°C מבושל לגמרי, וכ-93°C לרכות מקסימלית.';`);
  await page.evaluate(`vcAskFlow(${JSON.stringify('שאלה: ' + q)})`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).not.toMatch(/71\D{0,2}°?C/);           // the model's OTHER numbers are still redacted, never spoken raw
  expect(spoken).toContain('המספרים האלה אינם מאומתים'); // the original redaction notice still fires — substitution is additive, not a replacement
  expect(spoken).toContain(String(safe));                // the app's OWN cited safe figure is substituted in
  expect(spoken).toContain(heb);                          // attributed to the identified item, by name
});

// DoD-8/9 evidence: the substitution sentence rendered in the real Hebrew voice-panel transcript, at
// the suite's default 390x844 viewport — same pattern as the "DoD-8/9 — the inline verified marker..."
// screenshot test above (line 628).
test('R-53 DoD-8/9 — the substitution sentence renders correctly in the Hebrew voice-panel transcript', async ({ page }) => {
  await bootVC(page);
  const setup = await page.evaluate(`(function(){
    for (var i=0;i<DATA.cuts.length;i++){
      var c=DATA.cuts[i];
      if (c.safe==null) continue;
      var q='מה הטמפ הבטוחה ל'+c.heb;
      var hits=askFindEntity(q.toLowerCase());
      var best=hits && hits[0];
      if (best && best.obj && best.obj.n===c.n && best.obj.safe===c.safe){
        return {heb:c.heb, safe:Math.round(c.safe), q:q};
      }
    }
    return null;
  })()`) as {heb:string; safe:number; q:string} | null;
  expect(setup).not.toBeNull();
  const { heb, safe, q } = setup!;
  // vcRender() renders nothing at all when vcTasks is empty (host.innerHTML = t?...:'') — an active
  // task with NO `.ikey` keeps the panel populated (so `.vc-qa-a` exists to screenshot) while still
  // leaving Tier 1 unresolved, exactly like the real repro (no matching active-cook item).
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock='${safe}°C מינימלי עם מנוחה, 71°C מבושל לגמרי, וכ-93°C לרכות מקסימלית.';`);
  await page.evaluate(`vcAskFlow(${JSON.stringify('שאלה: ' + q)})`);
  await page.waitForFunction(`window.__spoke.length>0`);
  await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('${heb}')>=0; })()`);
  const shownText = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
  expect(shownText).toContain(heb);
  expect(shownText).toContain(String(safe));
  await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
  await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
  await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
    return r.top>=0 && r.bottom<=window.innerHeight; })()`);
  await page.screenshot({ path: '.superpowers/sdd/r53-substitution-390x844.png' });
});

test('R-53 negative — no item identified: redaction fires but nothing is substituted (silence is correct, DoD-6)', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcGuardSpoken('הטמפ הבטוחה היא בין 63 ל-74°C', { t1: null, t2: null }, 'he')`) as string;
  expect(out).toContain('אינם מאומתים');
  expect(out).not.toMatch(/\d/);   // no item identified -> no substitution -> no digits survive anywhere
});

test('R-53 negative — an identified item with only `tgt` (no cited `safe`) is never substituted (tgt is a texture target, not a safety figure)', async ({ page }) => {
  await bootVC(page);
  const setup = await page.evaluate(`(function(){
    for (var i=0;i<DATA.specials.length;i++){
      var s=DATA.specials[i];
      if (s.safe==null && s.tgt!=null && !isNaN(Number(s.tgt))) return {key:'spec-'+s.n};
    }
    return null;
  })()`) as {key:string} | null;
  expect(setup).not.toBeNull();
  const { key } = setup!;
  // Tier 2 (question-text match) on purpose — this test isolates the safe-vs-tgt field decision, not
  // the Tier-1-vs-Tier-2 eligibility decision (that is the separate test right below).
  const out = await page.evaluate(`vcGuardSpoken('הטמפ היא בין 63 ל-74°C', { t1: null, t2: resolveItem('${key}') }, 'he')`) as string;
  expect(out).toContain('אינם מאומתים');
  expect(out).not.toMatch(/\d/);
});

// Discovered by the suite itself, not assumed: an active-cook item (Tier 1) alone is NOT sufficient
// evidence the redacted number is even about that item — several pre-existing regression tests (owner
// ruling 2026-07-24 on ranges, fix 1b248a1 on the Fahrenheit trap, the comma-grouping fix) keep an
// active-cook item as Tier 1 while asking a generic, off-topic question, and correctly demand ZERO
// digits survive. Only a question-text match (Tier 2 — the item's own name appears in what the user
// asked) is strong enough evidence to attribute a substituted figure to it.
test('R-53 negative — an active-cook item alone (Tier 1, not named in the question) never triggers substitution; only a question-text match (Tier 2) does', async ({ page }) => {
  await bootVC(page);
  const setup = await page.evaluate(`(function(){
    var c=DATA.cuts.find(function(x){ return x.safe!=null; });
    return c?{key:'cut-'+c.n}:null;
  })()`) as {key:string} | null;
  expect(setup).not.toBeNull();
  const { key } = setup!;
  const out = await page.evaluate(`vcGuardSpoken('הטמפ היא בין 63 ל-74°C', { t1: resolveItem('${key}'), t2: null }, 'he')`) as string;
  expect(out).toContain('אינם מאומתים');
  expect(out).not.toMatch(/\d/);
});

test('R-53: the substitution sentence renders in the caller\'s language too (non-Hebrew, e.g. French) — no Hebrew leak', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('fr') });
  await page.waitForFunction(`typeof vcGuardSpoken==='function' && typeof resolveItem==='function'`);
  // wait for the fr dict to actually be loaded — L() falls back to Hebrew (not English) while a
  // non-en/he dict isn't ready yet (I-1), which would make this test pass for the wrong reason.
  await page.waitForFunction(`(function(){ try{ return typeof getDict==='function' && !!getDict() && Object.keys(getDict()).length>0; }catch(e){ return false; } })()`);
  const setup = await page.evaluate(`(function(){
    for (var i=0;i<DATA.cuts.length;i++){ var c=DATA.cuts[i]; if(c.safe!=null) return {key:'cut-'+c.n, safe:Math.round(c.safe)}; }
    return null;
  })()`) as {key:string; safe:number} | null;
  expect(setup).not.toBeNull();
  const { key, safe } = setup!;
  const out = await page.evaluate(`vcGuardSpoken('la température est entre 63 et 74°C', { t1: null, t2: resolveItem('${key}') }, 'fr')`) as string;
  expect(out).toContain(String(safe));
  expect(out).not.toContain('לפי המדריך');   // no Hebrew leak on the fr branch
});

// R-58 (owner-reported live defect, 2026-08-01, v283) — a CATEGORY question ("טמפרטורת בטיחות עוף") got
// THREE redactions and no number: askFindEntity returns an EMPTY array for "עוף" because it is a `cat`
// in the catalog, not an item — the catalog has "חזה עוף", never a bare "עוף". Reproduces the live defect
// end-to-end through vcAskFlow, exactly like the R-53 asado test above.
test('R-58: a category-only safety question (no item named) gets the category\'s uniform safe figure substituted (the live "עוף" defect)', async ({ page }) => {
  await bootVC(page);
  // Pin the catalog precondition this fix relies on: "עוף" itself resolves to NO item via askFindEntity
  // (the live bug's exact mechanism) but every עוף item shares the same cited safe figure.
  const setup = await page.evaluate(`(function(){
    var hits=askFindEntity('טמפרטורת בטיחות עוף');
    if (hits.length) return {ok:false};
    var vals=[];
    DATA.cuts.forEach(function(c){ if(c.cat==='עוף' && c.safe!=null) vals.push(Math.round(c.safe)); });
    var uniform = vals.length>0 && vals.every(function(v){ return v===vals[0]; });
    return {ok: uniform, safe: uniform?vals[0]:null};
  })()`) as {ok:boolean; safe:number|null};
  expect(setup.ok).toBe(true);
  const safe = setup.safe as number;
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='הטמפ הבטוחה היא בין 63°C ל-${safe}°C, ולעיתים עד 90°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: טמפרטורת בטיחות עוף')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  const shown  = await page.evaluate(`vcLastQA.a`) as string;
  expect(spoken).not.toMatch(/\b63\b/);                    // the model's OTHER numbers are still redacted, never spoken raw
  expect(spoken).not.toMatch(/\b90\b/);
  expect(spoken).toContain('המספרים האלה אינם מאומתים');   // the redaction notice still fires — substitution is additive
  expect(spoken).toContain(String(safe));                   // the app's OWN cited, uniform category safe figure
  expect(spoken).toContain('עוף');                          // attributed to the CATEGORY, by name
  expect(shown).toBe(spoken);
});

// SUPERSEDED BY AN OWNER RULING (2.8.26, quoted in .superpowers/sdd/entity-ladder-task-1-brief.md §ב):
// "קטגוריה מעורבת ⟵ טווח + שני המייצגים … היום שאלה על 'בקר' מחזירה מסך בלי שום מספר בטיחות".
// R-58's original answer to a MIXED category was TOTAL SILENCE, and that silence is what the owner
// reported as a defect: a cook asking about בקר got a screen with no safety figure at all. The rule that
// replaces it is NOT looser — no category-wide number is ever asserted (that was and remains the
// dangerous move). Instead both ends of the real spread are spoken, each attributed BY NAME to the actual
// catalog row it came from, so nothing is averaged, guessed, or presented as "the category's value".
// The assertions below are rewritten to that contract; the precondition is unchanged.
test('R-58 (owner ruling 2.8.26) — a MIXED category (בקר: whole-cut 63°C vs ground 71°C) answers with BOTH representatives, never one category-wide number', async ({ page }) => {
  await bootVC(page);
  const setup = await page.evaluate(`(function(){
    var vals={}, n=0;
    DATA.cuts.forEach(function(c){ if(c.cat==='בקר' && c.safe!=null){ var v=Math.round(c.safe); if(!vals[v]){vals[v]=1;n++;} } });
    return {mixed: n>1, vals:Object.keys(vals).map(Number).sort(function(a,b){return a-b;})};
  })()`) as {mixed:boolean; vals:number[]};
  expect(setup.mixed).toBe(true);   // pin the precondition the whole case hinges on
  const out = await page.evaluate(`vcGuardSpoken('הטמפ הבטוחה היא בין 63°C ל-74°C', { t1: null, t2: null, cat: 'בקר' }, 'he')`) as string;
  expect(out).toContain('אינם מאומתים');                       // the model's own numbers are still redacted
  expect(out).toContain('זה תלוי בנתח');                        // and the answer says WHY there is no single figure
  expect(out).toContain(String(setup.vals[0]));                 // the lowest cited figure in the category…
  expect(out).toContain(String(setup.vals[setup.vals.length-1])); // …and the highest, both from our own tables
  // each figure is attributed to a REAL catalog row, never to the category as a whole
  const names = await page.evaluate(`askAllItems().filter(function(m){return m.cat==='בקר';}).map(function(m){return m.heb;})`) as string[];
  expect(names.some(n => out.includes(n))).toBe(true);
});

test('R-58 negative — safe=0 categories (ירקות) are excluded: zero is not a safety temperature', async ({ page }) => {
  await bootVC(page);
  const out = await page.evaluate(`vcGuardSpoken('הטמפ הבטוחה היא בין 63°C ל-74°C', { t1: null, t2: null, cat: 'ירקות' }, 'he')`) as string;
  expect(out).toContain('אינם מאומתים');
  expect(out).not.toMatch(/\d/);
});

test('R-58 — item-level match still wins over a category match ("חזה עוף" is more specific than "עוף")', async ({ page }) => {
  await bootVC(page);
  const setup = await page.evaluate(`(function(){
    var c=DATA.cuts.find(function(x){ return x.heb==='חזה עוף' && x.safe!=null; });
    return c?{safe:Math.round(c.safe)}:null;
  })()`) as {safe:number}|null;
  expect(setup).not.toBeNull();
  const { safe } = setup!;
  await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='הטמפ הבטוחה היא בין 63°C ל-${safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: מה הטמפרטורה הבטוחה לחזה עוף')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(spoken).toContain(String(safe));
  expect(spoken).toContain('חזה עוף');       // attributed to the SPECIFIC item, per R-53
  expect(spoken).not.toContain('קטגוריית');  // never the category phrasing when an item matched
});

test('R-58: the category substitution sentence renders in the caller\'s language too (non-Hebrew, e.g. French) — no Hebrew leak', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('fr') });
  await page.waitForFunction(`typeof vcGuardSpoken==='function'`);
  // wait for the fr dict to actually be loaded (I-1 — see the identical R-53 language test above)
  await page.waitForFunction(`(function(){ try{ return typeof getDict==='function' && !!getDict() && Object.keys(getDict()).length>0; }catch(e){ return false; } })()`);
  const safe = await page.evaluate(`(function(){
    var vals=[]; DATA.cuts.forEach(function(c){ if(c.cat==='עוף' && c.safe!=null) vals.push(Math.round(c.safe)); });
    return (vals.length && vals.every(function(v){ return v===vals[0]; })) ? vals[0] : null;
  })()`) as number|null;
  expect(safe).not.toBeNull();
  const out = await page.evaluate(`vcGuardSpoken('la température est entre 63°C et ${safe}°C', { t1: null, t2: null, cat: 'עוף' }, 'fr')`) as string;
  expect(out).toContain(String(safe));
  expect(out).not.toContain('לפי המדריך');   // no Hebrew leak on the fr branch
});

test('R-58 DoD-8/9 — the category substitution sentence renders correctly in the Hebrew voice-panel transcript', async ({ page }) => {
  await bootVC(page);
  const safe = await page.evaluate(`(function(){
    var vals=[]; DATA.cuts.forEach(function(c){ if(c.cat==='עוף' && c.safe!=null) vals.push(Math.round(c.safe)); });
    return (vals.length && vals.every(function(v){ return v===vals[0]; })) ? vals[0] : null;
  })()`) as number|null;
  expect(safe).not.toBeNull();
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock='הטמפ הבטוחה היא בין 63°C ל-${safe}°C.';`);
  await page.evaluate(`vcAskFlow('שאלה: טמפרטורת בטיחות עוף')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('עוף')>=0; })()`);
  const shownText = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
  expect(shownText).toContain(String(safe));
  await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
  await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
  await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
    return r.top>=0 && r.bottom<=window.innerHeight; })()`);
  await page.screenshot({ path: '.superpowers/sdd/r58-category-substitution-390x844.png' });
});

// R-59 (owner-reported live defect, 2026-08-01, v283) — a Q&A asked in Hebrew stayed on screen after
// switching the app language to Russian. Owner ruling: DELETE it, never translate it — a transcript
// records a conversation that happened in a specific language, and translating it after the fact would
// manufacture words nobody said. applyLang() (the one function every language-change path funnels
// through — setLang(), boot dict-load, boot-failure recovery) now clears vcLastQA and repaints the open
// voice panel immediately.
test('R-59: the on-screen Q&A transcript is DELETED (not translated) when the app language changes', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  await page.evaluate(`window.__vcAskMock='תן לו לנוח כמה דקות ואז פרוס דק.'; vcTasks=[{label:'x',t:new Date()}]; vcIdx=0;`);
  await page.evaluate(`vcAskFlow('שאלה: מה עכשיו')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('לנוח')>=0; })()`);
  expect(await page.evaluate(`vcLastQA && vcLastQA.a`)).toContain('לנוח');   // sanity: the transcript really is populated first
  // pre-populate a (near-empty, truthy) ru dict so setLang() takes its SYNCHRONOUS branch (mirrors the
  // established pattern in tests/i18n-foundation.spec.ts) — this test is about vcLastQA clearing, not
  // about awaiting a real network dict fetch.
  await page.evaluate(`I18N_DICTS.ru=I18N_DICTS.ru||{}; setLang('ru');`);
  await page.waitForFunction(`getLang()==='ru'`);
  // DELETED, not translated: no Q&A block survives in the DOM at all, and the internal state is null —
  // never a Russian rendering of the same Hebrew answer.
  await page.waitForFunction(`!document.querySelector('.vc-qa')`);
  expect(await page.evaluate(`vcLastQA`)).toBeNull();
  const bodyHtml = await page.evaluate(`document.getElementById('vcBody').innerHTML`) as string;
  expect(bodyHtml).not.toContain('לנוח');   // the old Hebrew content is gone, not carried over translated
});

test('R-59 negative — with no active transcript, a language switch is a harmless no-op (DoD-6) and a fresh question afterward still works normally', async ({ page }) => {
  await bootVC(page);
  await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
  await page.waitForSelector('#vcBody');
  expect(await page.evaluate(`vcLastQA`)).toBeNull();   // nothing asked yet — the case this fix must not disturb
  await page.evaluate(`I18N_DICTS.ru=I18N_DICTS.ru||{}; setLang('ru');`);
  await page.waitForFunction(`getLang()==='ru'`);
  expect(await page.evaluate(`vcLastQA`)).toBeNull();   // still nothing — no error, no phantom transcript conjured
  // the fix is surgical, not a feature regression: a NEW question asked AFTER the switch still populates
  // the transcript normally, in the now-active language's voice panel.
  await page.evaluate(`window.__vcAskMock='ok'; vcTasks=[{label:'x',t:new Date()}]; vcIdx=0;`);
  await page.evaluate(`vcAskFlow('question: what now')`);
  await page.waitForFunction(`window.__spoke.length>0`);
  await page.waitForFunction(`vcLastQA && vcLastQA.a==='ok'`);
  expect(await page.evaluate(`document.getElementById('vcBody').innerHTML`)).toContain('ok');
});

