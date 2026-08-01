import { test, expect, seedApp } from './_fixtures';

test.describe('R-62 Task 1 · the classifier returns a validated map, or null', () => {
  test('a claim whose text is not one of OUR tokens is discarded (§5.4.1)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const out = await page.evaluate(() => {
      const w = window as any;
      const src = 'עשן ב-110°C במשך 6 שעות עד 71°C פנימי.';
      const map = w.vcBuildClaimMap(src, { claims: [
        { text: '110°C', kind: 'chamber_temp', value: 110, unit: 'C', confidence: 0.95 },
        { text: '230°F', kind: 'chamber_temp', value: 230, unit: 'F', confidence: 0.99 }, // never appeared
      ]});
      return { size: map ? map.size : 0, has110: !!(map && map.get('110°C')), hasGhost: !!(map && map.get('230°F')) };
    });
    expect(out.size).toBe(1);
    expect(out.has110).toBe(true);
    expect(out.hasGhost).toBe(false);   // ← RED before vcBuildClaimMap exists
  });

  test('two claims on the SAME token leave it UNCLASSIFIED, not arbitrated (§5.5)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const has = await page.evaluate(() => {
      const w = window as any;
      const map = w.vcBuildClaimMap('הגש ב-71°C.', { claims: [
        { text: '71°C', kind: 'internal_safe_temp', value: 71, unit: 'C', confidence: 0.9 },
        { text: '71°C', kind: 'chamber_temp',       value: 71, unit: 'C', confidence: 0.9 },
      ]});
      return map === null;
    });
    expect(has).toBe(true);
  });

  test('malformed / empty / off-schema responses all collapse to null', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const all = await page.evaluate(() => {
      const w = window as any;
      const s = 'הגש ב-71°C.';
      return [
        w.vcBuildClaimMap(s, null),
        w.vcBuildClaimMap(s, { claims: [] }),
        w.vcBuildClaimMap(s, { claims: [{ text: '71°C', kind: 'nonsense', value: 71, unit: 'C', confidence: 1 }] }),
        w.vcBuildClaimMap(s, { claims: [{ text: '71°C', kind: 'chamber_temp', value: 71, unit: 'C' }] }), // no confidence
      ].map(x => x === null);
    });
    expect(all).toEqual([true, true, true, true]);
  });

  test('a non-STOP finishReason returns null (truncation must never approve anything)', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    // the mock seam models the PARSED response; the finishReason branch is exercised via a real route
    await page.route('**/generateContent*', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"claims":[]}' }] } }] }) }));
    try {
      // `store` is a top-level `const` in app.js — it is NEVER a `window` property (only `var`/function
      // declarations attach to the global object in a sloppy-mode script), so `window.store` is always
      // undefined and `w.store.set(...)` would throw before this test ever reaches the code under test.
      // String-form evaluate (the established pattern elsewhere in this suite, e.g. waveCD-safety-storage
      // .spec.ts:12, active-hub.spec.ts:15) runs in the page's own global scope, where the bare identifier
      // `store` resolves via the lexical scope app.js's top-level `const` actually lives in.
      const res = await page.evaluate(`(async function(){
        window.__vcClassMock = null;                       // force the real request path
        store.set('mk-gemkey', 'x'.repeat(40));            // aiAvail() true via BYOK
        return await vcClassifySafetyClaims('הגש ב-71°C.');
      })()`);
      expect(res).toBeNull();
    } finally { await page.unroute('**/generateContent*'); }
  });
});
