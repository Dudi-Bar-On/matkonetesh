import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});

// #1: the sv<->smoke order effect must be driven by CITED data (order_smokesv), not a formula,
// and the reverse (smoke->sv) order must only be offered for items that carry that cited data.
test('order-effect engine: reverse order gated on cited data and uses cited temps', async ({ page }) => {
  await page.goto('/index.html');

  // Brisket (cut-1) carries cited order_smokesv (cold smoke 75°C). Reverse order offered; cold-smoke = 75°.
  const brisket = await page.evaluate(`(function(){
    var meta=resolveItem('cut-1');
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
    var stages=itemStages(meta, mm.key, true, 'smoke-sv');
    var cold=stages.find(function(s){return s.kind==='smoke';});
    return { toggle: comboHasSvSmoke(meta, mm.key), coldTemp: cold.temp, note: cold.note };
  })()`) as any;
  expect(brisket.toggle).toBe(true);
  expect(brisket.coldTemp).toBe(75);          // cited value, NOT the coldSmokeTemp() formula
  expect(brisket.note).toContain('מקור מצוטט');

  // Pastrami (cut-12) has an sv+smoke combo but NO cited order_smokesv -> reverse order NOT offered.
  const pastrami = await page.evaluate(`(function(){
    var meta=resolveItem('cut-12');
    var mm=itemProfile(meta).methods.find(function(m){return m.combo&&m.combo.indexOf('sv')>=0&&m.combo.indexOf('smoke')>=0;});
    return mm? comboHasSvSmoke(meta, mm.key) : 'no-sv-smoke-combo';
  })()`);
  expect(pastrami).toBe(false);
});

// Visible UI: the reverse order + its safety warning render in the timeline for a cited item.
test('order-effect UI: brisket offers reverse order with the pasteurization safety warning', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    store.set('mk-tlview','plan');
    openTimeline();
  })()`);
  const panel = page.locator('#panel');
  const orderSel = panel.locator('select[data-tlorder]').first();
  await expect(orderSel).toBeVisible();

  // switch to smoke -> sous-vide; the P3 danger-zone warning must appear
  await orderSel.selectOption('smoke-sv');
  await expect(panel.locator('.tl-safety-warn')).toContainText('טמפ׳-סכנה');
  await panel.screenshot({ path: 'scratch/order-effect.png' });
});
