import { test, expect } from '@playwright/test';

// The event wizard's date field used type="date", whose dd/mm/yyyy hint is painted by the BROWSER's locale.
// On an English-locale browser that put Latin text inside the otherwise-Hebrew wizard, and no page-level
// translation can reach it. It now rests as a text field with a Hebrew placeholder and swaps to the real
// date control only while picking (or when a date is already set).

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof cStartNewEvent==='function' && typeof cwMenu==='function'`);
  await page.evaluate(`cStartNewEvent()`);
  await page.waitForSelector('#cwEvDate');
};

test('D1: the date field rests as text with a Hebrew placeholder (no dd/mm/yyyy)', async ({ page }) => {
  await boot(page);
  const d = page.locator('#cwEvDate');
  await expect(d).toHaveAttribute('type', 'text');
  const ph = await d.getAttribute('placeholder');
  expect(ph).toBeTruthy();
  expect(ph).toContain('תאריך');
  expect(ph).not.toMatch(/[A-Za-z]/);          // the whole point: no Latin in the resting Hebrew form
});

test('D2: focusing swaps in the real date control', async ({ page }) => {
  await boot(page);
  await page.locator('#cwEvDate').focus();
  await expect(page.locator('#cwEvDate')).toHaveAttribute('type', 'date');
});

test('D3: picking a date persists it to the event model', async ({ page }) => {
  await boot(page);
  const saved = await page.evaluate(`(async function(){
    var d=document.querySelector('#cwEvDate');
    d.focus(); d.value='2026-07-24'; d.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(function(r){setTimeout(r,150);});
    return (cwMenu()||{}).evDate;
  })()`);
  expect(saved).toBe('2026-07-24');
});

test('D4: blurring an empty field returns to the Hebrew placeholder', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    var d=document.querySelector('#cwEvDate');
    d.focus(); await new Promise(function(r){setTimeout(r,100);});
    d.blur();  await new Promise(function(r){setTimeout(r,150);});
    return { type:d.type, ph:d.placeholder };
  })()`) as any;
  expect(r.type).toBe('text');
  expect(r.ph).toContain('תאריך');
});

test('D5: a set date survives blur and is restored as a date control', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(`(async function(){
    var d=document.querySelector('#cwEvDate');
    d.focus(); d.value='2026-07-24'; d.dispatchEvent(new Event('change',{bubbles:true}));
    d.blur(); await new Promise(function(r){setTimeout(r,150);});
    var afterBlur={type:d.type, value:d.value};
    var m=cwMenu(); m.evDate='2026-08-01'; cwSave(m);
    if(typeof cwSyncFromMenu==='function') cwSyncFromMenu();
    await new Promise(function(r){setTimeout(r,200);});
    var d2=document.querySelector('#cwEvDate');
    return { afterBlur: afterBlur, restored:{type:d2.type, value:d2.value} };
  })()`) as any;
  expect(r.afterBlur).toEqual({ type: 'date', value: '2026-07-24' });   // keeps showing the chosen date
  expect(r.restored).toEqual({ type: 'date', value: '2026-08-01' });    // never shows a raw ISO string in a text box
});
