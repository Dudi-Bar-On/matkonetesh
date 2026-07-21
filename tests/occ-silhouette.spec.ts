import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof deviceSilhouette==='function'`);
};
const sil = (page: any, cat: string, type: string) =>
  page.evaluate(`deviceSilhouette({cat:${JSON.stringify(cat)}, type:${JSON.stringify(type)}})`);

test('cabinet smoker and every oven type map to cabinet', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'smoker', 'ארון / קבינט')).toBe('cabinet');
  for (const t of ['ביתי','דק','פיצה']) expect(await sil(page, 'oven', t)).toBe('cabinet');
  expect(await sil(page, 'smoker', 'חשמלי')).toBe('cabinet');   // default rack device
});
test('offset smoker maps to offset', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'smoker', 'אופסט / סטיק-ברנר')).toBe('offset');
});
test('grill body shape: round for kettle/charcoal, rect for gas', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'grill', 'קטל')).toBe('grill-round');
  expect(await sil(page, 'grill', 'פחם')).toBe('grill-round');
  expect(await sil(page, 'grill', 'גז')).toBe('grill-rect');
  expect(await sil(page, 'grill', 'פלנצ׳ה / פלטה')).toBe('grill-rect');
});
test('sous-vide maps to vessel', async ({ page }) => {
  await boot(page);
  expect(await sil(page, 'sousvide', 'טבילה (immersion)')).toBe('vessel');
});
