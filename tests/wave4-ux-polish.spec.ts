import { test, expect } from '@playwright/test';

// Wave 4 UX polish — clickable wizard progress steps (UX #14) + a single primary review CTA (UX #6).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('UX #14: wizard progress steps are clickable buttons that jump to that step', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('event'); cwGo(3); cNavGo('wizard'); cwPaintProg(); })()`);
  await page.waitForSelector('#cwProg [data-cwseg]');
  expect(await page.evaluate(`document.querySelectorAll('#cwProg [data-cwseg]').length`)).toBe(6);   // event flow = 6 steps
  expect(await page.evaluate(`document.querySelector('#cwProg [data-cwseg]').tagName`)).toBe('BUTTON');
  await page.evaluate(`document.querySelector('#cwProg [data-cwseg="0"]').click()`);
  expect(await page.evaluate(`cWiz.step`)).toBe(0);   // jumped back to the basics step
});

test('UX #14: the cook flow shows 5 steps (skips the event-extras step)', async ({ page }) => {
  await init(page);
  await page.evaluate(`(function(){ setMenuCtx('cook'); cwGo(1); cNavGo('wizard'); cwPaintProg(); })()`);
  await page.waitForSelector('#cwProg [data-cwseg]');
  expect(await page.evaluate(`document.querySelectorAll('#cwProg [data-cwseg]').length`)).toBe(5);
});

test('UX #6: the review step exposes a single primary CTA (generate plan)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    const step=document.querySelector('#scr-wizard [data-cwstep="5"]');
    // the primary is the only full-width .ccta gradient button in the review step
    const primaries=Array.from(step.querySelectorAll('.ccta')).map(b=>b.id||('cgo:'+(b.dataset.cgo||'')));
    // the rest are demoted into the compact secondary row (.cw5-more), NOT .ccta
    const secondaryDemoted=['cwSaveEvent','cwVoice'].every(function(id){ const b=document.getElementById(id); return !!b && !b.classList.contains('ccta') && !!b.closest('.cw5-more'); });
    return {primaries, secondaryDemoted};
  })()`) as any;
  expect(r.primaries).toEqual(['cwGenPlan']);   // only the plan CTA is a primary gradient .ccta
  expect(r.secondaryDemoted).toBe(true);        // save/voice live in the demoted secondary row
});
