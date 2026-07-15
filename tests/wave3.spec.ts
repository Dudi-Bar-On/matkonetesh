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
