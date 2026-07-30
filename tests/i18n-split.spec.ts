// tests/i18n-split.spec.ts — Dec-A1: dictionaries live OUTSIDE the bundle.
import { test, expect, seedApp } from './_fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe('A1 dictionary split (build artifact)', () => {
  test('dist/index.html is lean and carries META, not dictionaries', async () => {
    const html = readFileSync(resolve(process.cwd(), 'dist/index.html'), 'utf8');
    // ~2.1MB expected; 2.6MB is the guard ceiling (was 7,791,592 bytes on v277)
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(2_600_000);
    expect(html).toContain('I18N_META');
    // a real French dictionary value must NOT be inlined anymore
    const fr = JSON.parse(readFileSync(resolve(process.cwd(), 'dist/lang-fr.json'), 'utf8'));
    expect(fr['קטלוג']).toBe('Catalogue');           // the split file carries the dict…
    // Tightened (Task 1 review follow-up #1): the pre-split bundle used json.dumps default
    // separators — `"קטלוג": "Catalogue"` WITH a space after the colon — so a bare no-space
    // literal check would have passed against the OLD bundle too (vacuous). Tolerate both
    // separator styles so this actually detects an inlined dictionary value.
    expect(html).not.toMatch(/"קטלוג"\s*:\s*"Catalogue"/);
  });

  test('every active language ships as lang-<code>.json and is served', async ({ warm }) => {
    // Task 1 review follow-up #2: 'ru' is emitted by build.py too — include it so a ru
    // emission regression is caught here instead of slipping through.
    for (const code of ['en', 'fr', 'de', 'es', 'it', 'ru']) {
      const r = await warm.request.get(`/lang-${code}.json`);
      expect(r.status(), `lang-${code}.json`).toBe(200);
      const d = await r.json();
      expect(Object.keys(d).length).toBeGreaterThan(100);
      expect(d.__meta__ && d.__meta__.name).toBeTruthy();
    }
  });
});

test.describe('A1 on-demand language loading (runtime)', () => {
  test('switching to French fetches the dict and renders French chrome', async ({ warm }) => {
    // seedApp: 'mk-uilevel-asked' skips the first-run experience-level onboarding panel, which
    // would otherwise sit on top of #cHomeLang and swallow the click (real UI path, not a stub).
    await seedApp(warm, { 'mk-uilevel-asked': 'true' });
    await warm.evaluate(() => (window as any).__mkLangReady);
    // real click path: home → #cHomeLang opens the language panel → the language row flags
    // (data-setlang buttons). The row is not on the initial home screen (serena
    // find_referencing_symbols langRowHtml: it's hosted inside openLangMenu's panel).
    await warm.locator('#cHomeLang').click();
    const fr = warm.locator('[data-setlang="fr"]').first();
    await fr.click();
    // rendered-DOM assertion (§10.19): the bottom-nav catalog label becomes French
    await expect(warm.locator('[data-cnav="catalog"]')).toContainText('Catalogue');
    await expect(warm.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('boot with a stored non-he language applies it after the dict loads', async ({ warm }) => {
    await seedApp(warm, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('en') });
    await warm.evaluate(() => (window as any).__mkLangReady);
    await expect(warm.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a failed dict download keeps the previous language and says so (negative case)', async ({ warm }) => {
    await seedApp(warm, { 'mk-uilevel-asked': 'true' });
    await warm.route('**/lang-de.json', r => r.abort());
    await warm.locator('#cHomeLang').click();
    await warm.locator('[data-setlang="de"]').first().click();
    await expect(warm.locator('.toast, [class*="toast"]').first()).toBeVisible();
    await expect(warm.locator('html')).toHaveAttribute('lang', 'he');   // stayed on Hebrew
    await warm.unroute('**/lang-de.json');
  });
});
