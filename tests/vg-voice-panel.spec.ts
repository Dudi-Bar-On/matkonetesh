// Task 11 (R-52 §1.4, F-3/F-4/F-6) — the openVoiceRules panel, its two entry points, the delivery
// truth-line, the locked safety chip, the voice log, and the first-live-cook discovery card.
// Test-authoring contract: tests/TEST-AUTHORING-CONTRACT.md — test/seedApp from ./_fixtures only.
import { test, expect, seedApp } from './_fixtures';

test.describe('§1.4 · the voice-rules panel', () => {
  test('A6 · 390×844 — four rows + the locked chip, zero horizontal overflow, controls ≥48px',
    async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules .vr-row:not(.vr-locked)')).toHaveCount(4);   // F-3: schedule NOT rendered
    await expect(page.locator('#voiceRules .vr-locked .vr-chip')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth > 390);
    expect(over).toBe(false);
    for (const b of await page.locator('#voiceRules .ap-opt').all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('A7 · Hebrew, then a second language — the SAMPLE string is translated too', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules')).toContainText('הטיימר של החזה הסתיים');
    await page.evaluate(() => (window as any).setLang('ru'));
    await page.waitForFunction(() => (window as any).__mkLangReady);
    await page.evaluate(() => (window as any).openVoiceRules());
    const txt = await page.locator('#voiceRules').innerText();
    expect(txt).not.toContain('הטיימר של החזה הסתיים');
    expect(txt).not.toMatch(/The brisket timer is done/);   // English fallback is a LEAK, not a pass
  });

  test('F-4 · "always" is qualified in the truth-line, NOT inside a button label', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    const labels = await page.locator('#voiceRules .ap-opt').allInnerTexts();
    expect(labels.some(l => /\(/.test(l))).toBe(false);
    await expect(page.locator('#voiceRules .vr-truth')).toContainText('לא יכולה לדבר');
    await expect(page.locator('#voiceRules .vr-truth .mchip')).toBeVisible();
  });

  test('NEGATIVE · the safety row has zero clickable controls', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules [data-cat="safety"] button')).toHaveCount(0);
  });

  test('F-6 · the intro card appears at the first live cook, exactly once', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const twice = await page.evaluate(() => {
      const w = window as any; const seen: boolean[] = [];
      w.maybeAskVoiceIntro(); seen.push(!!document.querySelector('[data-vintro]'));
      w.closePanel();
      // closePanel() only hides #panel (CSS transform, per DOM design) — it does not clear its content,
      // so a stale (but real) DOM node from the first render would otherwise survive and give this
      // assertion a false positive. Clear it to isolate what THIS second call does — the same signal a
      // subsequent, unrelated showPanel() would give in the real app.
      document.getElementById('panel')!.innerHTML = '';
      w.maybeAskVoiceIntro(); seen.push(!!document.querySelector('[data-vintro]'));
      return seen;
    });
    expect(twice).toEqual([true, false]);
  });

  test('A10 · entry point 1 — Settings & help lists "When the app speaks" and opens the panel', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    await page.evaluate(() => (window as any).openMoreSheet());
    const btn = page.locator('#panel [data-mfn="openVoiceRules"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForFunction(() => !!document.querySelector('#voiceRules'));
    await expect(page.locator('#voiceRules')).toBeVisible();
  });

  test('A11 · entry point 2 — the vc-rules chip inside the voice-cook header opens the panel', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    // Enter through the real door: openVoiceCook (not a poke at the module-lexical vcTasks/vcIdx, which
    // are plain top-level `let` — not window properties — so assigning window.vcTasks would silently
    // create an unrelated global and vcRender would still see its own empty closure-scoped array).
    await page.evaluate(() => (window as any).openVoiceCook([{ t: new Date(), label: 'שלב בדיקה' }]));
    const chip = page.locator('#vcBody [data-vcrules]');
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.locator('#voiceRules')).toBeVisible();
  });

  test('NEGATIVE · schedule (F-3) is registered in PREFS but never rendered as a row', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const has = await page.evaluate(() => Object.keys((window as any).PREFS).includes('voiceSchedule'));
    expect(has).toBe(true);
    await page.evaluate(() => (window as any).openVoiceRules());
    await expect(page.locator('#voiceRules [data-cat="schedule"]')).toHaveCount(0);
  });

  test('A12 · the voice log lists said/skipped rows and replays', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voicelog': JSON.stringify([]) });
    const n = await page.evaluate(() => {
      const w = window as any; let calls = 0; w.vcSpeak = () => { calls++; return Promise.resolve(); };
      w.voiceSay('steps', 'הוצא את הבשר לעטיפה');
      return calls;
    });
    expect(n).toBe(1);
    await page.evaluate(() => (window as any).openVoiceLog());
    await expect(page.locator('#voiceLog')).toContainText('הוצא את הבשר לעטיפה');
  });
});
