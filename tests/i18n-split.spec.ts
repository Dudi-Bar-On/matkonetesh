// tests/i18n-split.spec.ts — Dec-A1: dictionaries live OUTSIDE the bundle.
import { test, expect } from './_fixtures';
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
    expect(html).not.toContain('"קטלוג":"Catalogue"'); // …and the bundle does not
  });

  test('every active language ships as lang-<code>.json and is served', async ({ warm }) => {
    for (const code of ['en', 'fr', 'de', 'es', 'it']) {
      const r = await warm.request.get(`/lang-${code}.json`);
      expect(r.status(), `lang-${code}.json`).toBe(200);
      const d = await r.json();
      expect(Object.keys(d).length).toBeGreaterThan(100);
      expect(d.__meta__ && d.__meta__.name).toBeTruthy();
    }
  });
});
