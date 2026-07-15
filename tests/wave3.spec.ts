import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof gearFromText==='function' && typeof openGearConcierge==='function'`);
};

test('W3-P1: gear concierge — natural-language setup (local parser)', async ({ page }) => {
  await boot(page);
  const g = await page.evaluate(`gearFromText('offset smoker, weber kettle grill, sous-vide stick, MEATER Pro XL probe, meat grinder and a sausage stuffer')`) as any;
  expect(g.smoker).toContain('אופסט');
  expect(g.grill).toBe('קטל');
  expect(g.sousvide).toContain('טבילה');
  expect(g.thermo).toContain('אלחוטי');   // MEATER → wireless probe
  expect(g.grinder).toBe('ייעודית');
  expect(g.stuffer).toBe('אנכית');
  expect(await page.evaluate(`levelFromText('offset smoker and a grinder', gearFromText('offset smoker and a grinder'))`)).toBe('pro');
  // apply sets gear + configured + level
  await page.evaluate(`gearConciergeApply(gearFromText('weber kettle and a sous vide stick'), 'mid')`);
  expect(await page.evaluate(`gearConfigured()`)).toBe(true);
  expect(await page.evaluate(`canSV()`)).toBe(true);
  expect(await page.evaluate(`store.get('mk-uilevel')`)).toBe('mid');
  // full UI flow: describe → preview → apply
  await page.evaluate(`openGearConcierge()`);
  await page.waitForSelector('#panel #gcDesc');
  await page.fill('#panel #gcDesc', 'a pellet smoker and a MEATER');
  await page.click('#panel #gcGo');
  await page.waitForSelector('#panel .gc-preview');
  await page.click('#panel #gcApply');
  await page.waitForTimeout(150);
  expect(await page.evaluate(`gearState().smoker`)).toContain('פלט');
  expect(await page.evaluate(`gearState().thermo`)).toContain('אלחוטי');
});

test('W3-P2: charcuterie safety guardian — weight-loss + nitrite checks', async ({ page }) => {
  await boot(page);
  const guard = (p: any) => page.evaluate(`charcuterieGuardian(${JSON.stringify(p)})`) as Promise<any[]>;
  // dry, only 10% lost (target 38%) → not-safe-yet warn + nitrite info
  const early = await guard({ type: 'dry', startW: 1000, curW: 900, factor: 0.62 });
  expect(early.some(f => f.level === 'warn')).toBe(true);
  expect(early.some(f => f.level === 'info')).toBe(true);
  expect(early.find(f => f.level === 'warn').text).toContain('not safe');
  // target too low (factor 0.8 → 20% < 35% safe min) → danger
  expect((await guard({ type: 'dry', startW: 1000, curW: 900, factor: 0.8 })).some(f => f.level === 'danger')).toBe(true);
  // ready (40% lost ≥ target 38%) → ok
  expect((await guard({ type: 'dry', startW: 1000, curW: 600, factor: 0.62 })).some(f => f.level === 'ok')).toBe(true);
  // cure type → nitrite info
  expect((await guard({ type: 'cure' })).some(f => f.level === 'info')).toBe(true);
  // the Projects screen renders the guardian line on the card
  await page.evaluate(`(function(){ store.set('mk-pantry',[{id:'p1',name:'Salami',key:'make-x',type:'dry',startW:1000,curW:900,factor:0.62,start:'2026-06-01',doneSteps:[]}]); cNavGo('projects'); })()`);
  await page.waitForSelector('.cpc-guardian');
  expect(await page.evaluate(`document.querySelector('.cpc-guardian').textContent`)).toContain('safe');
});

test('W3-P3: personal coach — longitudinal journal stats + renders', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-journal',[
    {id:'1',name:'Brisket',temp:'110°C',rating:5,date:'2026-06-01'},
    {id:'2',name:'Brisket',temp:'108°C',rating:5,date:'2026-06-10'},
    {id:'3',name:'Brisket',temp:'95°C',rating:3,date:'2026-06-15'},
    {id:'4',name:'Ribs',temp:'120°C',rating:4,date:'2026-06-20'}
  ])`);
  const c = await page.evaluate(`journalCoach()`) as any;
  expect(c.enough).toBe(true);
  expect(c.count).toBe(4);
  expect(c.mostCooked.name).toBe('Brisket');
  expect(c.mostCooked.count).toBe(3);
  expect(c.bestRated.name).toBe('Brisket');
  // temp pattern needs >=2 high-rated and >=2 low-rated with a >=5° gap
  await page.evaluate(`store.set('mk-journal',[
    {id:'1',name:'A',temp:'110°C',rating:5},{id:'2',name:'B',temp:'112°C',rating:5},
    {id:'3',name:'C',temp:'90°C',rating:2},{id:'4',name:'D',temp:'92°C',rating:3}
  ])`);
  const c2 = await page.evaluate(`journalCoach()`) as any;
  expect(c2.tempPattern).not.toBeNull();
  expect(c2.tempPattern.hi).toBeGreaterThan(c2.tempPattern.lo);
  // the coach card renders at the top of the journal
  await page.evaluate(`openJournal()`);
  await page.waitForSelector('#panel .jcoach');
  expect(await page.evaluate(`document.querySelector('#panel .jcoach').textContent`)).toContain('cooks logged');
});

test('W3-P4: photo analyzer — multimodal request, advisory framing, no-key guard', async ({ page }) => {
  await boot(page);
  // the prompt is advisory + carries the safety rail
  const prompt = await page.evaluate(`_photoPrompt()`) as string;
  expect(prompt).toContain('probe');
  expect(prompt).toContain('Never state a numeric');
  // gemVision builds a real multimodal request (image inlineData + text)
  await page.evaluate(`window.__cap=null; window.gemFetch=async(m,b)=>{ window.__cap=b; return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'the bark looks set'}]}}]})}; }; store.set('mk-gemkey','k');`);
  const r = await page.evaluate(`gemVision('data:image/jpeg;base64,AAAA', 'read this')`) as string;
  expect(r).toContain('bark');
  const body = await page.evaluate(`window.__cap`) as any;
  expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/jpeg');
  expect(body.contents[0].parts[0].inlineData.data).toBe('AAAA');
  expect(body.contents[0].parts[1].text).toBe('read this');
  // the AI hub lists the photo analyzer
  expect(await page.evaluate(`AI_TOOLS.some(t=>t[3]==='openPhotoAnalyze')`)).toBe(true);
  // no key → gemVision refuses (no fake analysis)
  await page.evaluate(`store.set('mk-gemkey','')`);
  expect(await page.evaluate(`(async()=>{ try{ await gemVision('data:image/jpeg;base64,AA','x'); return 'ok'; }catch(e){ return String(e.message||e); } })()`)).toContain('no-key');
  // the panel opens with the advisory framing
  await page.evaluate(`openPhotoAnalyze()`);
  await page.waitForSelector('#panel #paFile');
  expect(await page.evaluate(`document.querySelector('#panel .pa-note').textContent`)).toContain('probe');
});
