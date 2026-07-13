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
  const primaries = await page.evaluate(`(function(){
    const ids=['cwGenPlan','cwSaveEvent','cwVoice'];
    const eventsBtn=document.querySelector('#scr-wizard .ccta[data-cgo="events"]');
    const list=ids.map(id=>document.getElementById(id)).filter(Boolean);
    if(eventsBtn) list.push(eventsBtn);
    return list.filter(b=>!b.classList.contains('ghost')).map(b=>b.id||('cgo:'+b.dataset.cgo));
  })()`) as string[];
  expect(primaries).toEqual(['cwGenPlan']);   // only the plan CTA is primary; the rest are secondary/ghost
});
