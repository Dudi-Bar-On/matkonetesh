import { test, expect, seedApp } from './_fixtures';

// ── R-63 · Subject binding — Task 1 ───────────────────────────────────────────────────────────────
// Evidence: docs/analysis/2026-08-02-v286-live-verification.md, chapter "שורש הבעיה". Measured on the
// LIVE page (v286) by wrapping vcClaimVerdict/vcGuardSpoken at runtime:
//
//   token   kind                  conf  subject (from the classifier)      vcClaimSubjectSafeC  verdict
//   63°C    internal_safe_temp    1.0   {category:"beef", item:"beef"}     63                   verified
//   90°C    internal_target_temp  1.0   {category:"beef", item:"asado"}    null                 REDACTED
//   95°C    internal_target_temp  1.0   {category:"beef", item:"asado"}    null                 REDACTED
//
//   askFindEntity('asado') → 0 hits · askFindEntity('אסאדו') → 1 hit, safe=63 · askFindEntity('beef') → 13 hits
//
// DEFECT 1 — the classifier emits English/transliterated subject ids; the catalog holds heb="אסאדו" /
// eng="Short Ribs" and the string `asado` is in NEITHER field, so the lookup returned nothing and
// vcClaimVerdict bailed at `if(ref==null) return null` — ONE LINE before v286's release branch. The
// v286 branch is correct, deployed, and was unreachable.
// DEFECT 2 — vcClaimSubjectSafeC took `hits[0]` from a fuzzy search with NO ambiguity check while the
// CATEGORY path has always been guarded by catUniformSafe. A general word matching 13 cuts silently
// borrowed the first one's `safe` value. That is how the "63°C לפי המדריך המאומת" the owner saw was
// produced — a safety figure sourced from a cut nobody asked about.
//
// The v286 tests passed while the feature was dead because they fed a HAND-BUILT claim map. Test A1
// below feeds the map in EXACTLY the shape the live classifier returns and reads the RENDERED text.

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });
  await page.waitForFunction(`typeof vcGuardSpoken==='function' && typeof vcClaimVerdict==='function'
                              && typeof vcResolveTiers==='function' && typeof askFindEntity==='function'`);
};

// The live shape, verbatim: an English/transliterated item id that resolves to NOTHING in the catalog.
const liveClaim = (text: string, value: number, kind = 'internal_target_temp') => ({
  text, kind, value, unit: 'C',
  subject: { category: 'beef', item: 'asado', form: 'whole' }, confidence: 1.0,
});

const ASADO_Q = 'שאלה: מה טמפרטורת הבטיחות באסאדו';
const ASADO_A = 'טמפרטורת הבטיחות המינימלית לבשר בקר היא 63°C עם מנוחה של שלוש דקות. '
              + 'אבל כדי שהאסאדו ייצא רך ועסיסי, מומלץ להמשיך לבשל עד לטמפרטורה פנימית של 90°C עד 95°C.';

test.describe('R-63 · defect 1 — the claim subject binds to the item as it appears in the real text', () => {

  // ★ THE HEART OF THE TASK (brief (ג)) — the claim map in EXACTLY the live classifier's shape,
  // through the REAL ask flow, asserted on the RENDERED transcript the user reads. DoD-4/8/9.
  test('A1 · the live {category:"beef", item:"asado"} shape renders 90°C and 95°C at 390x844', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                          'mk-gemkey': JSON.stringify('test-key') });
    await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcGuardSpoken==='function'`);
    await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
    await page.evaluate(`(function(){ closePanel(); openVoiceCook([{label:'אסאדו',t:new Date()}]); })()`);
    await page.waitForSelector('#vcBody');
    await page.evaluate(`(function(){
      window.__vcAskMock=${JSON.stringify(ASADO_A)};
      window.__vcClassMock=function(){ return { claims:[
        {text:'63°C', kind:'internal_safe_temp',   value:63, unit:'C', subject:{category:'beef', item:'beef',  form:'whole'}, confidence:1.0},
        {text:'90°C', kind:'internal_target_temp', value:90, unit:'C', subject:{category:'beef', item:'asado', form:'whole'}, confidence:1.0},
        {text:'95°C', kind:'internal_target_temp', value:95, unit:'C', subject:{category:'beef', item:'asado', form:'whole'}, confidence:1.0}
      ]}; };
    })()`);
    try {
      await page.evaluate(`vcAskFlow(${JSON.stringify(ASADO_Q)})`);
      await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a'); return a && a.textContent.length>0; })()`);
      await page.waitForFunction(`(function(){ var a=document.querySelector('.vc-qa-a');
        return a && a.textContent.indexOf('90°C')>=0; })()`);
      const shown = await page.evaluate(`document.querySelector('.vc-qa-a').textContent`) as string;
      expect(shown).toContain('90°C');                 // ← the owner's missing numbers, in the RENDERED text
      expect(shown).toContain('95°C');
      expect(shown).not.toMatch(/[A-Za-z]{3}/);        // Hebrew transcript, no English leak (DoD-9)
      await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left===0`);
      await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
      await page.screenshot({ path: '.superpowers/sdd/subject-bind-asado-390x844.png' });
    } finally {
      await page.evaluate(`window.__vcClassMock=null; window.__vcAskMock=null;`);
    }
  });

  test('A2 · direct — an unresolvable item id binds to the entity the QUESTION already resolved', async ({ page }) => {
    await boot(page);
    // premise, read from the live catalog itself — never asserted from memory
    const probe = await page.evaluate(`({ asado: (askFindEntity('asado')||[]).length,
                                          heb:   (askFindEntity('אסאדו')||[]).length })`) as any;
    expect(probe.asado).toBe(0);      // the classifier's id is in NO catalog field
    expect(probe.heb).toBeGreaterThan(0);
    const said = await page.evaluate(([a, c]: any[]) => {
      const w = window as any;
      return w.vcGuardSpoken(a, w.vcResolveTiers('שאלה: מה טמפרטורת הבטיחות באסאדו'), 'he',
        new Map([[c.text, c]]));
    }, [ 'מומלץ להביא את האסאדו ל-90°C פנימי.', liveClaim('90°C', 90) ]);
    expect(said).toContain('90°C');
    expect(said).not.toContain('[…]');
  });
});

test.describe('R-63 · defect 2 — the item path demands an unambiguous resolution', () => {

  // Discovers a REAL ambiguous query from the live catalog: a subject string that resolves to more than
  // one item whose cited `safe` figures DISAGREE. No safety number is invented by the test.
  // `first` is deliberately **hits[0]'s OWN safe value** — the exact number the shipped `const h=hits[0]`
  // hands back — so the assertion below fails while that line stands. (First draft filtered by "the first
  // VALID safe among the hits" and silently picked a query whose hits[0] carries NO safe at all; the old
  // code returned null there for an unrelated reason and the test passed green on its first run. It was
  // void under DoD-2 and is rewritten here.)
  const findAmbiguous = (page: any) => page.evaluate(`(function(){
    var qs={};
    askAllItems().forEach(function(m){ if(m.eng){ var w=m.eng.toLowerCase().split(' ')[0]; if(w.length>3) qs[w]=1; } });
    var out=null;
    Object.keys(qs).forEach(function(q){
      if(out) return;
      var hits=askFindEntity(q)||[];
      if(hits.length<2) return;
      var h0=hits[0].obj && hits[0].obj.safe;
      if(h0==null || isNaN(Number(h0)) || Number(h0)===0) return;   // hits[0] must itself carry the figure
      var vals=hits.map(function(h){ return h.obj&&h.obj.safe; })
        .filter(function(v){ return v!=null && !isNaN(Number(v)) && Number(v)!==0; })
        .map(function(v){ return Math.round(Number(v)); });
      if(vals.length>1 && !vals.every(function(v){ return v===vals[0]; }))
        out={ q:q, hits:hits.length, first:Math.round(Number(h0)), vals:vals };
    });
    return out;
  })()`) as Promise<{q:string; hits:number; first:number; vals:number[]} | null>;

  // ── MANDATORY NEGATIVE (1) of the brief: an ambiguous subject with DIFFERENT safe values → redacted.
  test('B1 · a subject matching several cuts with DISAGREEING safe values is redacted, never hits[0]', async ({ page }) => {
    await boot(page);
    const amb = await findAmbiguous(page);
    expect(amb).not.toBeNull();
    const { q, first } = amb!;
    const said = await page.evaluate(([qq, v]: any[]) => {
      const w = window as any;
      const c = { text: v + '°C', kind: 'internal_safe_temp', value: v, unit: 'C',
                  subject: { item: qq, category: null, form: 'whole' }, confidence: 0.99 };
      return w.vcGuardSpoken('הטמפרטורה הבטוחה היא ' + v + '°C.', {t1:null,t2:null,cat:null}, 'he',
        new Map([[c.text, c]]));
    }, [q, first]);
    // BEFORE the fix this was spoken as OUR verified figure — sourced from a cut nobody asked about.
    expect(said).not.toContain('לפי המדריך המאומת');
    expect(said).toContain('[…]');
  });

  test('B2 · a subject whose matches all AGREE is still allowed (the guard is uniform-or-null, not blanket)', async ({ page }) => {
    await boot(page);
    const uni = await page.evaluate(`(function(){
      var qs={};
      askAllItems().forEach(function(m){ if(m.eng){ var w=m.eng.toLowerCase().split(' ')[0]; if(w.length>3) qs[w]=1; } });
      var out=null;
      Object.keys(qs).forEach(function(q){
        if(out) return;
        var hits=askFindEntity(q)||[];
        if(hits.length<2) return;
        var h0=hits[0].obj && hits[0].obj.safe;
        if(h0==null || isNaN(Number(h0)) || Number(h0)===0) return;
        var vals=hits.map(function(h){ return h.obj&&h.obj.safe; })
          .filter(function(v){ return v!=null && !isNaN(Number(v)) && Number(v)!==0; })
          .map(function(v){ return Math.round(Number(v)); });
        if(vals.length>1 && vals.every(function(v){ return v===vals[0]; }))
          out={ q:q, first:Math.round(Number(h0)) };
      });
      return out;
    })()`) as {q:string; first:number} | null;
    expect(uni).not.toBeNull();
    const said = await page.evaluate(([qq, v]: any[]) => {
      const w = window as any;
      const c = { text: v + '°C', kind: 'internal_safe_temp', value: v, unit: 'C',
                  subject: { item: qq, category: null, form: 'whole' }, confidence: 0.99 };
      return w.vcGuardSpoken('הטמפרטורה הבטוחה היא ' + v + '°C.', {t1:null,t2:null,cat:null}, 'he',
        new Map([[c.text, c]]));
    }, [uni!.q, uni!.first]);
    expect(said).toContain('לפי המדריך המאומת');
    expect(said).not.toContain('[…]');
  });
});

test.describe('R-63 · protection is not relaxed', () => {

  // ── MANDATORY NEGATIVE (2) of the brief: a target temp BELOW the safe floor is still redacted —
  // now with the subject ACTUALLY BOUND (post-fix asado resolves to a real 63°C floor), so this proves
  // the redaction survives binding rather than riding on the binding failure it used to.
  test('C1 · a target temp BELOW the bound safe floor is still redacted', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(([a, c]: any[]) => {
      const w = window as any;
      return w.vcGuardSpoken(a, w.vcResolveTiers('שאלה: מה טמפרטורת הבטיחות באסאדו'), 'he',
        new Map([[c.text, c]]));
    }, [ 'אפשר להגיש את האסאדו ב-50°C פנימי.', liveClaim('50°C', 50) ]);
    expect(said).not.toContain('50°C');
    expect(said).toContain('[…]');
  });

  test('C2 · an item that exists NOWHERE and a question naming nothing is still redacted', async ({ page }) => {
    await boot(page);
    const said = await page.evaluate(() => {
      const w = window as any;
      const c = { text:'90°C', kind:'internal_target_temp', value:90, unit:'C',
                  subject:{ item:'תנין', category:null, form:'whole' }, confidence:0.98 };
      return w.vcGuardSpoken('הבא את התנין ל-90°C.', {t1:null,t2:null,cat:null}, 'he', new Map([[c.text, c]]));
    });
    expect(said).not.toContain('90');
    expect(said).toContain('[…]');
  });

  test('C3 · claims===null leaves the asado answer byte-identical to today', async ({ page }) => {
    await boot(page);
    const [withNull, withUndef] = await page.evaluate((a: string) => {
      const w = window as any;
      const tiers = w.vcResolveTiers('שאלה: מה טמפרטורת הבטיחות באסאדו');
      return [w.vcGuardSpoken(a, tiers, 'he', null), w.vcGuardSpoken(a, tiers, 'he')];
    }, ASADO_A);
    expect(withNull).toBe(withUndef);
    expect(withNull).toContain('[…]');
    expect(withNull).not.toContain('90°C');
  });
});
