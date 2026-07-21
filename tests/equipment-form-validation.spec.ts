import { test, expect } from '@playwright/test';

// M2 (refactoring report §9): the equipment form silently discarded values that failed validation —
// `doSave` did `else delete d.cap[key]` for an unparseable prop/capacity, then closed the form. The user
// typed a value, hit save, and it vanished with no message, corrupting the very capacity data the
// occupancy layer depends on. Fix: validate first; on an invalid value, surface it and keep the form open
// with the user's input intact — never silently drop it, never store a bogus number either.

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openEquipment==='function' && typeof propParse==='function'`);
};

// open the add-a-smoker form (smoker has a numeric prop maxC + a racks capacity field)
const openSmokerForm = async (page: any) => {
  await page.evaluate(`openEquipment()`);
  await page.waitForSelector('#panel [data-eqpick="smoker"]');   // empty state: quick-add category chips
  await page.click('#panel [data-eqpick="smoker"]');             // → the add form
  await page.waitForSelector('#panel #eqSave');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.waitForSelector('#panel #eqProp-maxC');
  await page.fill('#panel #eqName', 'מבחן');
};

test('M2a: an invalid property value is NOT silently dropped — form stays open, value retained, feedback shown', async ({ page }) => {
  await boot(page);
  await openSmokerForm(page);
  await page.fill('#panel #eqProp-maxC', 'abc');          // unparseable temperature
  await page.click('#panel #eqSave');
  // the form must NOT have closed to the list — the prop field is still on screen
  await expect(page.locator('#panel #eqProp-maxC')).toBeVisible();
  // the user's typed value is still there (not silently wiped)
  await expect(page.locator('#panel #eqProp-maxC')).toHaveValue('abc');
  // and nothing was saved with a lost/bogus value
  const saved = await page.evaluate(`equipList().length`);
  expect(saved).toBe(0);
  // a visible warning names the field
  const warned = await page.evaluate(`(function(){
    var t=document.body.innerText||'';
    return /לא נשמר|לא תקin|לא תקינ/.test(t) || !!document.querySelector('.eq-invalid');
  })()`);
  expect(warned).toBe(true);
});

// (No capacity-field test: #eqCapKey is type="number", so the browser itself rejects invalid text and the
// silent-loss class of bug cannot occur there — only the text-input numeric PROPERTY fields need the guard.)

test('M2c: valid values save and close the form (control)', async ({ page }) => {
  await boot(page);
  await openSmokerForm(page);
  await page.fill('#panel #eqProp-maxC', '150');
  await page.fill('#panel #eqCapKey', '4');
  await page.click('#panel #eqSave');
  // form closed → the list is shown (no #eqSave), and the device persisted with the typed values
  await expect(page.locator('#panel #eqSave')).toHaveCount(0);
  const dev = await page.evaluate(`(function(){ var d=equipList()[0]; return d?{maxC:d.cap.maxC, racks:d.cap.racks}:null; })()`) as any;
  expect(dev).not.toBeNull();
  expect(dev.maxC).toBe(150);
  expect(dev.racks).toBe(4);
});

test('M2d: an empty field still falls back to the class default (unchanged behaviour)', async ({ page }) => {
  await boot(page);
  await openSmokerForm(page);
  // leave maxC empty, save with a valid rack count
  await page.fill('#panel #eqProp-maxC', '');
  await page.fill('#panel #eqCapKey', '4');
  await page.click('#panel #eqSave');
  await expect(page.locator('#panel #eqSave')).toHaveCount(0);   // empty is valid → saved & closed
  const hasStoredMaxC = await page.evaluate(`(function(){ var d=equipList()[0]; return d && d.cap && ('maxC' in d.cap); })()`);
  expect(hasStoredMaxC).toBe(false);   // empty → no stored value, class default applies
});
