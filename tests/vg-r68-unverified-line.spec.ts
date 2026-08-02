import { test, expect, seedApp } from './_fixtures';

// R-68 (ROADMAP §5a row R-68, owner ruling 2.8.26) — the closing line
// "מספר זה אינו מאומת — בדוק בכרטיס הפריט" was emitted in 14/14 live runs, INCLUDING answers whose
// leading sentence already supplied the app's own cited, verified figure
// (docs/analysis/2026-08-02-v288-live-verification.md §5 "סעיף 4 שנשאל — שורת הסיום סותרת אותנו",
//  docs/analysis/2026-08-02-v289-live-verification.md §3a/§3d/§4). The approved rule:
//
//   the line appears ONLY when something in the answer actually remains unverified.
//
// Established FROM THE CODE, not assumed (vcGuardSpoken, app.js):
//   · a REDACTED number is not on screen at all — it became "[…]"; it leaves the cook with a hole,
//     which the notice is only worth explaining when we have nothing to put in that hole;
//   · a RELEASED number is on screen without a marker, but it passed vcClaimVerdict (a non-safety
//     figure above the floor) and never reached this notice anyway (`if(!redacted) return out`);
//   · a VERIFIED number carries its own inline "לפי המדריך המאומת" marker;
//   · the R-53 substitution sentence (vcSafeSubstitutionParts) is OUR cited figure, with a kind:
//     item/category/range carry a real number, `nofigure` explicitly says we have none, '' is silence.
// ⇒ "something remains unverified" = the answer delivers NO authoritative figure of its own:
//   verified===0 AND (no substitution, or a `nofigure` substitution). Conservative by construction —
//   every path that leaves the cook without a number keeps the warning.
//
// The two cases that must both hold, and both are here: an answer that carries an authoritative
// figure must NOT show the line (T1/T2/T5), an answer whose safety claim was redacted with nothing to
// replace it MUST still show it (T3/T4/T6).

const NOTICE_HE = [
  'מספר זה אינו מאומת',
  'המספרים האלה אינם מאומתים',
];

const bootVC = async (page: any) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-gemkey': JSON.stringify('test-key'),
  });
  await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function' && typeof vcResolveTiers==='function'`);
  await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
};

// Same discovery pattern as the R-53/R-61 tests (tests/p0-spoken-safety.spec.ts:712,
// tests/vg-r61-order.spec.ts:24): a REAL catalog cut with a REAL cited `safe` figure that
// askFindEntity actually resolves from the question text — the live defect's own shape, never an
// invented number and never a hand-built entity (L45: a fixture that never carried the live shape).
async function findSafeCut(page: any) {
  return page.evaluate(`(function(){
    for (var i=0;i<DATA.cuts.length;i++){
      var c=DATA.cuts[i];
      if (c.safe==null) continue;
      var q='מה הטמפ הבטוחה ל'+c.heb;
      var hits=askFindEntity(q.toLowerCase());
      var best=hits && hits[0];
      if (best && best.obj && best.obj.n===c.n && best.obj.safe===c.safe){
        return {heb:c.heb, safe:Math.round(c.safe), q:q, key:'cut-'+c.n};
      }
    }
    return null;
  })()`) as Promise<{heb:string; safe:number; q:string; key:string} | null>;
}

test.describe('R-68 · the unverified-number line only fires when nothing in the answer is authoritative', () => {

  // T1 — the live lamb/asado/chicken shape, END TO END through vcAskFlow, asserted on the text the
  // sighted user actually READS in the transcript (.vc-qa-a), not on a return value or a flag.
  test('T1 · an answer whose leading sentence carries OUR cited figure does NOT close with the unverified line (rendered transcript)', async ({ page }) => {
    await bootVC(page);
    const setup = await findSafeCut(page);
    expect(setup).not.toBeNull();
    const { heb, safe, q } = setup!;
    // An active task with no `.ikey` keeps the panel populated (so `.vc-qa-a` exists) while leaving
    // Tier 1 unresolved — exactly the live repro (no matching active-cook item), same trick as the
    // R-53 DoD-8 test at tests/p0-spoken-safety.spec.ts:744.
    await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
    await page.waitForSelector('#vcBody');
    await page.evaluate(`window.__vcClassMock=()=>null;`);   // no network; claims=null — the v288 live condition
    await page.evaluate(`window.__vcAskMock='${safe}°C מינימלי, 71°C מבושל לגמרי, וכ-93°C לרכות מקסימלית.';`);
    await page.evaluate(`vcAskFlow(${JSON.stringify('שאלה: ' + q)})`);
    await page.waitForFunction(`window.__spoke.length>0`);
    await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('${heb}')>=0; })()`);
    const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
    // the substitution IS there — the precondition of this whole case, pinned so the test cannot pass
    // by the answer simply being empty (L45: a fixture that never established its precondition):
    expect(shown).toContain('לפי המדריך, הטמפרטורה הבטוחה עבור');
    expect(shown).toContain(heb);
    expect(shown).toContain(String(safe));
    expect(shown).toContain('[…]');                       // the model's own numbers are STILL redacted
    expect(shown).not.toMatch(/71\D{0,2}°?C/);
    for (const n of NOTICE_HE) expect(shown).not.toContain(n);   // ← the R-68 fix
    // and the spoken string is the same string (one truth in the ear and on screen)
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    expect(spoken).toBe(shown);
    // DoD-8/9 visual evidence at the suite's 390×844 viewport — the panel slides in via a CSS
    // transition and the transcript sits inside the panel's own scroll container, so wait on the
    // panel's RESOLVED position and scroll the transcript into view before capturing (condition
    // waits only — DoD-11). Same pattern as the R-53 DoD-8 test in p0-spoken-safety.spec.ts.
    await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
    await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
    await page.waitForFunction(`(function(){ const r=document.querySelector('.vc-qa').getBoundingClientRect();
      return r.top>=0 && r.bottom<=window.innerHeight; })()`);
    await page.screenshot({ path: '.superpowers/sdd/r68-no-unverified-line-390x844.png' });
  });

  // T2 — the other authoritative shape: a MODEL number the decision table verified (the inline
  // "לפי המדריך המאומת" marker), with a second number redacted and NO substitution sentence at all.
  // Isolates the `verified>0` arm of the rule from the substitution arm.
  test('T2 · a verified model number + a redacted one, with no substitution, does NOT close with the unverified line', async ({ page }) => {
    await bootVC(page);
    const setup = await findSafeCut(page);
    expect(setup).not.toBeNull();
    const { heb, safe } = setup!;
    // tiers deliberately EMPTY → vcSafeSubstitutionParts returns kind:'' (no substitution); the claim's
    // own `subject.item` is what resolves the figure inside vcClaimSubjectSafeC.
    const said = await page.evaluate(`(function(){
      var claims = new Map([['${safe}°C', { text:'${safe}°C', kind:'internal_safe_temp', value:${safe}, unit:'C',
        subject:{item:${JSON.stringify(heb)}, category:null, form:'unknown'}, confidence:0.95 }]]);
      return vcGuardSpoken('${safe}°C בטוח לאכילה, ו-999°C ערך אחר לגמרי.', {t1:null,t2:null,cat:null}, 'he', claims);
    })()`) as string;
    expect(said).toContain('לפי המדריך המאומת');          // precondition: a token really WAS verified
    expect(said).toContain('[…]');                        // precondition: a token really WAS redacted
    expect(said).not.toContain('לפי המדריך, הטמפרטורה הבטוחה עבור');  // precondition: NO substitution here
    for (const n of NOTICE_HE) expect(said).not.toContain(n);   // ← the R-68 fix
  });

  // T3 — THE CONSERVATIVE CASE. Nothing resolves, nothing is verified: the cook is left with holes and
  // no figure at all, so the warning is the only thing telling them so. It must survive the fix.
  test('T3 · nothing resolved and nothing verified → the unverified line MUST still fire (rendered transcript)', async ({ page }) => {
    await bootVC(page);
    await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'x',t:new Date()}]); })()`);
    await page.waitForSelector('#vcBody');
    await page.evaluate(`window.__vcClassMock=()=>null;`);
    await page.evaluate(`window.__vcAskMock='רעלן הבוטוליזם מנוטרל סביב 85°C, והנבגים נהרסים ב-100-121°C.';`);
    await page.evaluate(`vcAskFlow('שאלה: באיזו טמפרטורה נהרס בוטוליזם')`);
    await page.waitForFunction(`window.__spoke.length>0`);
    await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.indexOf('[…]')>=0; })()`);
    const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
    expect(shown).not.toMatch(/\d/);                                     // no figure of any kind survives
    expect(shown).toContain('המספרים האלה אינם מאומתים');                 // …so the warning MUST be there
  });

  // T4 — the `nofigure` rung (the live merguez case): we HAVE the item and we explicitly have NO
  // verified value for it. A redacted safety claim with nothing to replace it → the line stays,
  // and (unchanged, owner ruling 2.8.26) without the item-card redirect.
  test('T4 · the "we have no verified figure" path keeps the unverified line, and keeps it card-less', async ({ page }) => {
    await bootVC(page);
    // A real catalog row we HAVE that carries no cited `safe` — discovered, not invented.
    const setup = await page.evaluate(`(function(){
      var pools=[['spec',DATA.specials||[]],['cut',DATA.cuts||[]]];
      for (var p=0;p<pools.length;p++){
        var pre=pools[p][0], arr=pools[p][1];
        for (var i=0;i<arr.length;i++){
          var c=arr[i]; if(c.safe!=null) continue;
          var m=resolveItem(pre+'-'+c.n); if(!m||!m.obj) continue;
          var out=vcSafeSubstitutionParts({t1:null,t2:m,cat:null},'he',null);
          if(out.kind==='nofigure') return {key:pre+'-'+c.n, text:out.text};
        }
      }
      return null;
    })()`) as {key:string; text:string} | null;
    expect(setup).not.toBeNull();
    const { key } = setup!;
    const said = await page.evaluate(`vcGuardSpoken('הטמפ הבטוחה היא בין 63 ל-74°C', { t1:null, t2:resolveItem('${key}'), cat:null }, 'he')`) as string;
    expect(said).toContain('אין לנו ערך בטיחות מאומת ל');   // precondition: this really IS the nofigure rung
    expect(said).toContain('אינם מאומתים');                  // ← the warning survives
    expect(said).not.toContain('בדוק בכרטיס הפריט');          // …card-less, unchanged
  });

  // T5/T6 — DoD-9. The line is user-facing text in all seven shipped languages. Suppression must hold
  // in every one of them (and leak no English), and the surviving warning must render in that
  // language's own words. Strings are the SHIPPED dictionary values (lang/<code>.json).
  const LANGS: Array<{code:string; notice:string; sub:string}> = [
    { code:'he', notice:'המספרים האלה אינם מאומתים', sub:'לפי המדריך, הטמפרטורה הבטוחה עבור ' },
    { code:'en', notice:"These numbers aren't verified", sub:"Per the app's guide, the safe temperature for " },
    { code:'de', notice:'Diese Angaben sind nicht verifiziert', sub:'Laut Anleitung der App ist die sichere Temperatur für ' },
    { code:'es', notice:'Estos datos no han sido verificados', sub:'Según la guía de la aplicación, la temperatura segura para ' },
    { code:'fr', notice:'Ces chiffres ne sont pas vérifiés', sub:'Selon le guide de l’application, la température sûre pour ' },
    { code:'it', notice:'Questi dati non sono stati verificati', sub:"Secondo la guida dell'app, la temperatura sicura per " },
    { code:'ru', notice:'Эти данные не проверены', sub:'Согласно руководству приложения, безопасная температура для ' },
  ];
  const EN_LEAKS = ["aren't verified", "isn't verified", 'check the item card', "Per the app's guide"];

  for (const L of LANGS) {
    test(`T5 · ${L.code} — the line is suppressed when our cited figure is present, and no English leaks`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(L.code) });
      await page.waitForFunction(`typeof vcGuardSpoken==='function' && typeof resolveItem==='function'`);
      // L() falls back to HEBREW (not English) while a non-en/he dict is still loading (I-1) — waiting
      // on the dict is what stops this passing for the wrong reason. `he` IS the source language and
      // never loads a dict at all (getDict() stays empty), so the wait applies only to the others.
      if (L.code !== 'he') await page.waitForFunction(`(function(){ try{ return typeof getDict==='function' && !!getDict() && Object.keys(getDict()).length>0; }catch(e){ return false; } })()`);
      const key = await page.evaluate(`(function(){
        for (var i=0;i<DATA.cuts.length;i++){ var c=DATA.cuts[i]; if(c.safe!=null) return 'cut-'+c.n; }
        return null;
      })()`) as string | null;
      expect(key).not.toBeNull();
      const said = await page.evaluate(`vcGuardSpoken('la temp est entre 63 et 74°C', { t1:null, t2:resolveItem('${key}'), cat:null }, '${L.code}')`) as string;
      expect(said).toContain(L.sub);                     // precondition: the substitution rendered, in THIS language
      expect(said).toContain('[…]');                     // precondition: the model's numbers were redacted
      expect(said).not.toContain(L.notice);              // ← the R-68 fix, in this language
      for (const n of NOTICE_HE) expect(said).not.toContain(n);   // and no Hebrew leak either
      if (L.code !== 'en') for (const leak of EN_LEAKS) expect(said).not.toContain(leak);
    });

    test(`T6 · ${L.code} — the line SURVIVES in this language when nothing authoritative is in the answer`, async ({ page }) => {
      await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(L.code) });
      await page.waitForFunction(`typeof vcGuardSpoken==='function'`);
      if (L.code !== 'he') await page.waitForFunction(`(function(){ try{ return typeof getDict==='function' && !!getDict() && Object.keys(getDict()).length>0; }catch(e){ return false; } })()`);
      const said = await page.evaluate(`vcGuardSpoken('la temp est entre 63 et 74°C', { t1:null, t2:null, cat:null }, '${L.code}')`) as string;
      expect(said).not.toMatch(/\d/);                    // nothing authoritative survived
      expect(said).toContain(L.notice);                  // …so the warning renders, in this language
      if (L.code !== 'en') for (const leak of EN_LEAKS) expect(said).not.toContain(leak);
    });
  }
});
