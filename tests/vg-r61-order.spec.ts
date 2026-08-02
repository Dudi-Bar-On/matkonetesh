import { test, expect, seedApp } from './_fixtures';

// R-61 (docs/superpowers/specs/2026-08-01-voice-governance-design.md §5.6, owner report 1.8 on R-53):
// when every number in the answer is redacted and NOTHING was approved, the guide's own cited safe
// figure (vcSafeSubstitution, app.js:7689) must LEAD the spoken/on-screen string, not trail it — a
// listener cannot scroll back, so the one verified sentence is the only thing worth hearing first.
// When at least one token WAS approved (the `verified` counter inside vcGuardSpoken is >0), the
// shipped trailing order is unchanged — a targeted reorder, not a blanket one (spec §5.6, code at
// app.js:8149-8154).
//
// Fixture-discovery pattern matches the existing R-53 tests (tests/p0-spoken-safety.spec.ts:712-739):
// walk DATA.cuts for a real cut with a cited `safe` figure, resolve it via askFindEntity exactly like
// the live defect did, so the fixture is a real catalog fact, not an invented number.
const bootVC = async (page: any) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-lang': JSON.stringify('he'),
    'mk-gemkey': JSON.stringify('test-key'),
  });
  await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function' && typeof vcResolveTiers==='function'`);
  await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
};

async function findSafeCut(page: any) {
  return page.evaluate(`(function(){
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
  })()`) as Promise<{heb:string; safe:number; q:string} | null>;
}

test.describe('R-61 · the verified sentence leads when nothing was approved', () => {
  test('D8a · all redacted + a substitution, direct call → the substitution comes FIRST', async ({ page }) => {
    await bootVC(page);
    const setup = await findSafeCut(page);
    expect(setup).not.toBeNull();
    const { heb, safe, q } = setup!;
    const said = await page.evaluate(`(function(){
      var tiers = vcResolveTiers(${JSON.stringify('שאלה: ' + q)});
      // three numbers → digitRuns>=2 → the shipped "exactly one" eligibility rule redacts every one of
      // them (claims omitted → today's behaviour, P6) — the exact live R-53 asado shape.
      return vcGuardSpoken('${safe}°C מינימלי, 71°C מבושל לגמרי, וכ-93°C לרכות מקסימלית.', tiers, 'he');
    })()`) as string;
    // R-68 (owner ruling 2.8.26, ROADMAP §5a) removed the trailing notice from exactly this shape — an
    // answer that leads with our own cited figure must not disclaim it in the same breath. R-61's own
    // claim is about ORDER, and it survives intact on what is left: the substitution must come FIRST,
    // before the model's body, not appended after it. The old `subPos < noticePos` compared it against a
    // sentence that no longer exists here; it is compared against the model's body instead, which is the
    // same directional claim measured against a part of the answer R-61 never removed.
    const subPos = said.indexOf('לפי המדריך');
    const bodyPos = said.indexOf('[…]');
    expect(subPos).toBeGreaterThanOrEqual(0);
    expect(bodyPos).toBeGreaterThanOrEqual(0);
    expect(subPos).toBeLessThan(bodyPos);             // ← RED before R-61's fix: the substitution was appended last
    expect(said).not.toContain('אינם מאומתים');        // R-68
    expect(said.trim().startsWith('לפי המדריך')).toBe(true);
    expect(said).toContain(heb);
    expect(said).toContain(String(safe));
  });

  test('D8b · at least one token VERIFIED (the R-62 parallel path) → the shipped trailing order is UNCHANGED', async ({ page }) => {
    await bootVC(page);
    const setup = await findSafeCut(page);
    expect(setup).not.toBeNull();
    const { heb, safe, q } = setup!;
    // One claim EXACTLY matches this item's own cited safe figure → vcClaimVerdict returns 'verified'
    // (app.js:7898), incrementing the `verified` counter inside vcGuardSpoken. The second number carries
    // no claim entry at all → falls through to today's redaction. Both numbers pass through the SAME
    // >=2-numbers branch R-61 touches, so this exercises the exact branch the fix guards.
    const said = await page.evaluate(`(function(){
      var tiers = vcResolveTiers(${JSON.stringify('שאלה: ' + q)});
      var claims = new Map([['${safe}°C', { text:'${safe}°C', kind:'internal_safe_temp', value:${safe}, unit:'C',
        subject:{item:${JSON.stringify(heb)}, category:null, form:'unknown'}, confidence:0.95 }]]);
      return vcGuardSpoken('${safe}°C לפי הבטיחות, ו-999°C ערך לא קשור.', tiers, 'he', claims);
    })()`) as string;
    // R-68 (owner ruling 2.8.26, ROADMAP §5a): a token WAS verified here, so the answer carries an
    // authoritative figure and the contradicting notice is no longer appended. R-61's claim — "when at
    // least one token was approved, the substitution does NOT jump to the front" — is unaffected and is
    // asserted directly: the verified figure still LEADS and the R-53 substitution still TRAILS it.
    const numPos = said.indexOf(String(safe));
    expect(numPos).toBeGreaterThanOrEqual(0);
    expect(said).toContain('לפי המדריך המאומת');       // the INLINE verified marker (unaffected by R-61)
    expect(said).not.toContain('אינו מאומת');          // R-68 — nothing in this answer is left unverified
    expect(said).not.toContain('אינם מאומתים');
    expect(said.trim().startsWith('לפי המדריך, הטמפרטורה הבטוחה')).toBe(false);   // R-61: no jump to the front
    const subPos = said.indexOf('לפי המדריך, הטמפרטורה הבטוחה');
    if (subPos >= 0) expect(numPos).toBeLessThan(subPos);   // R-53 substitution, when present, still trails
  });

  test('D8c · end to end via vcAskFlow — the SPOKEN string and the on-screen string are the same string, and it leads with the verified sentence', async ({ page }) => {
    await bootVC(page);
    const setup = await findSafeCut(page);
    expect(setup).not.toBeNull();
    const { heb, safe, q } = setup!;
    await page.evaluate(`window.__vcClassMock=()=>null;`);   // R-62 classifier disabled → claims=null, deterministic (no network)
    await page.evaluate(`vcTasks=[]; vcIdx=0; window.__vcAskMock='${safe}°C מינימלי, 71°C מבושל לגמרי, וכ-93°C לרכות מקסימלית.';`);
    await page.evaluate(`vcAskFlow(${JSON.stringify('שאלה: ' + q)})`);
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    const shown = await page.evaluate(`vcLastQA.a`) as string;
    expect(shown).toBe(spoken);                        // one string, one truth, on screen and in the ear
    expect(shown.trim().startsWith('לפי המדריך')).toBe(true);
    expect(shown).toContain(heb);
    expect(shown).toContain(String(safe));
  });

  test('D8b-negative · no identified item → no substitution exists → nothing to reorder, order is moot', async ({ page }) => {
    await bootVC(page);
    const said = await page.evaluate(`vcGuardSpoken('הטמפ הבטוחה היא 63°C, ואז 71°C.', { t1: null, t2: null }, 'he')`) as string;
    expect(said).toContain('אינם מאומתים');
    expect(said).not.toMatch(/\d/);                    // no item identified → no substitution → no digits anywhere
    expect(said.trim().startsWith('לפי המדריך')).toBe(false);
  });
});
