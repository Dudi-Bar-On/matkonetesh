import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {}
  });
});

// Regression for the long-activity scheduling bug: a 30h sous-vide (brisket) must be shown
// starting on an EARLIER calendar day than serving — the work plan now renders a "N days before" badge.
test('work plan shows a "days before serving" badge for a 30h sous-vide (brisket)', async ({ page }) => {
  await page.goto('/index.html');

  // Seed an event menu with brisket (cut-1: 30h sous-vide) and open the plan view.
  await page.evaluate(`(function(){
    saveMenu({guests:8,appetite:'reg',kosher:false,keys:['cut-1'],sides:[],drinks:[],desserts:[],gpm:0});
    store.set('mk-tlserve','19:00');
    store.set('mk-tlview','plan');
    openTimeline();
  })()`);

  const panel = page.locator('#panel');
  await expect(panel).toBeVisible();

  // The plan must contain at least one day-offset badge, and it must read "…before".
  const badges = panel.locator('.wp-day');
  await expect(badges.first()).toBeVisible();
  const txt = (await badges.allInnerTexts()).join(' | ');
  expect(txt).toMatch(/יום לפני|יומיים לפני|ימים לפני/);

  // Screenshot the plan for the record.
  await panel.screenshot({ path: 'scratch/workplan-days-before.png' });

});
