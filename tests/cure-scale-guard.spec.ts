import { test, expect } from '@playwright/test';

// Food-safety guard: warn when the computed cure (Cure #1, nitrite) dose is too small for the
// configured scale's readability to weigh accurately. Under-dosing risks botulism; the app's
// default rate (2.5 g/kg = 156ppm) already sits at the US regulatory maximum with zero headroom.
// Rule: dose < 5*d -> hard warning (unweighable); dose < 20*d -> advisory (poor accuracy); else silent.
// d = scale readability in grams (1 or 0.1). Fail-safe: unknown scale -> assume d=1, phrase conditionally.
//
// The dry-cure ("smoked-cooked") product type is used for every scenario below: cureRate defaults to
// 2.5 g/kg, so dose = grams-of-meat * 2.5 / 1000 — exactly the doses the brief specifies.

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openCalc==='function' && typeof equipList==='function'`);
};

// Opens the salt/cure calculator, selects the dry-cure ("smoked") product type (cure:'1', cureRate 2.5),
// and types the given meat weight in grams into the calculator's weight field.
const openDryCalc = async (page: any, grams: number) => {
  await page.evaluate(`openCalc()`);
  await page.waitForSelector('#saltHost [data-saltcalc]');
  await page.selectOption('#ptype', 'smoked');
  await page.waitForSelector('#saltHost [data-w]');
  await page.fill('#saltHost [data-w]', String(grams));
};

const seedScale = async (page: any, res?: '1g' | '0.1g') => {
  const dev: any = { id: 'sc1', cat: 'other', type: 'scale', name: 'Scale', cap: res ? { res } : {} };
  await page.evaluate((d: any) => { (window as any).equipSave([d]); }, dev);
};

test('G1: 1g scale, 0.5kg batch (dose 1.25g) -> hard warning rendered', async ({ page }) => {
  await boot(page);
  await seedScale(page, '1g');
  await openDryCalc(page, 500);
  const hard = page.locator('#saltHost [data-cureguard="hard"]');
  await expect(hard).toBeVisible();
  await expect(hard).toContainText('1.25');
  await expect(page.locator('#saltHost [data-cureguard="advisory"]')).toHaveCount(0);
});

test('G2: 1g scale, 4kg batch (dose 10g) -> advisory rendered, not the hard warning', async ({ page }) => {
  await boot(page);
  await seedScale(page, '1g');
  await openDryCalc(page, 4000);
  const advisory = page.locator('#saltHost [data-cureguard="advisory"]');
  await expect(advisory).toBeVisible();
  await expect(page.locator('#saltHost [data-cureguard="hard"]')).toHaveCount(0);
});

test('G3: 1g scale, 10kg batch (dose 25g) -> no warning at all', async ({ page }) => {
  await boot(page);
  await seedScale(page, '1g');
  await openDryCalc(page, 10000);
  await expect(page.locator('#saltHost [data-cureguard]')).toHaveCount(0);
});

test('G4: 0.1g scale, 1kg batch (dose 2.5g) -> no warning (precision scale handles it)', async ({ page }) => {
  await boot(page);
  await seedScale(page, '0.1g');
  await openDryCalc(page, 1000);
  await expect(page.locator('#saltHost [data-cureguard]')).toHaveCount(0);
});

test('G5: 0.1g scale, 0.1kg batch (dose 0.25g) -> hard warning', async ({ page }) => {
  await boot(page);
  await seedScale(page, '0.1g');
  await openDryCalc(page, 100);
  const hard = page.locator('#saltHost [data-cureguard="hard"]');
  await expect(hard).toBeVisible();
  await expect(hard).toContainText('0.25');
});

test('G6: no scale configured, 0.5kg batch -> warning still appears (fail-safe), conditional phrasing', async ({ page }) => {
  await boot(page);
  // fixture minimality: no scale seeded at all
  await openDryCalc(page, 500);
  const hard = page.locator('#saltHost [data-cureguard="hard"]');
  await expect(hard).toBeVisible();
  await expect(hard).toContainText('1.25');
  // conditional phrasing: must NOT assert the scale reads 1g as fact — must say "no scale configured / assuming"
  await expect(hard).toContainText('לא הוגדר משקל');
});

test('G7: scale owned but res unset -> warning still appears (fail-safe)', async ({ page }) => {
  await boot(page);
  await seedScale(page); // device exists, cap.res is unset
  await openDryCalc(page, 500);
  const hard = page.locator('#saltHost [data-cureguard="hard"]');
  await expect(hard).toBeVisible();
  await expect(hard).toContainText('לא הוגדר משקל');
});

test('G8: safety invariance — displayed cure/salt grams are byte-identical with and without a scale', async ({ page }) => {
  await boot(page);
  await openDryCalc(page, 500);
  const outBefore = await page.locator('#saltHost [data-out]').innerHTML();
  await seedScale(page, '1g');
  // force a recompute without changing the weight value
  await page.fill('#saltHost [data-w]', '500');
  const outAfter = await page.locator('#saltHost [data-out]').innerHTML();
  expect(outAfter).toBe(outBefore);
});

test('G9: Hebrew renders with no Latin leakage (except the established "Cure" term); English mode reads in English', async ({ page }) => {
  await boot(page);
  await seedScale(page, '1g');
  await openDryCalc(page, 500);
  const hardText = await page.locator('#saltHost [data-cureguard="hard"]').innerText();
  // "Cure" is an established exception already used unconditionally in Hebrew UI (e.g. 'Cure #1 ב-2.5 ג׳/ק״ג')
  const stripped = hardText.replace(/Cure/g, '');
  expect(stripped).not.toMatch(/[A-Za-z]/);

  // switch to English and re-check: no Hebrew leakage, message is in English
  await page.evaluate(`store.set('mk-lang','en')`);
  await page.evaluate(`openCalc()`);
  await page.waitForSelector('#saltHost [data-saltcalc]');
  await page.selectOption('#ptype', 'smoked');
  await page.fill('#saltHost [data-w]', '500');
  const enText = await page.locator('#saltHost [data-cureguard="hard"]').innerText();
  expect(enText).not.toMatch(/[֐-׿]/);
  expect(enText.toLowerCase()).toContain('cure');
});

// Controller UI review: the hard warning read "increase the batch until the DOSE reaches 8 kg meat" —
// conflating the dose (grams) with the target batch weight (kg of meat). A dose is never "8 kg meat".
// The instruction must scale the BATCH, matching the advisory tier's already-correct phrasing.
test('G10: the hard warning scales the batch, never says the dose reaches a kg figure', async ({ page }) => {
  await boot(page);
  await seedScale(page, '1g');
  await openDryCalc(page, 500);                       // dose 1.25 g -> hard
  const hard = page.locator('#saltHost [data-cureguard="hard"]');
  await expect(hard).toBeVisible();
  await expect(hard).toContainText('הגדילו את האצווה');     // actionable: increase the batch
  await expect(hard).toContainText('8 ק״ג');               // to the target batch weight
  await expect(hard).not.toContainText('שהמינון יגיע');    // NOT "until the dose reaches [kg]"
});
