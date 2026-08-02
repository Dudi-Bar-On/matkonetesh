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
    // NOT __mkLangReady: that is the BOOT-time promise, created once at load for the language stored
    // THEN. This test boots in Hebrew, so it is Promise.resolve() — already settled forever — and
    // awaiting it returns instantly while the ru dict is still in flight. The wait looked like a
    // condition and was vacuous; it only surfaced as a failure once the suite ran under enough load to
    // slow the fetch. getLang() is the real signal: setLang() writes the store INSIDE the fetch's
    // .then(), so this cannot be true before the dictionary is actually applied. Same pattern as
    // i18n-Lcontract.spec.ts:55, which has been stable. (§11a: wait on conditions, never on timeouts —
    // and a condition that was already true is not a condition.)
    await page.waitForFunction(() => (window as any).getLang() === 'ru');
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
});

// Regression (2026-08-02, Task 11 follow-up): maybeAskVoiceIntro() called showPanel() unconditionally
// from startLiveCook(), which stomped the live-cook Copilot panel the line above it had just opened
// (tests/copilot.spec.ts W2-P1 + W2-P3 went red). A flake investigation the day before had flagged the
// identical shape in maybeAskUiLevel() and predicted a second trigger would hit it — it did. Both first-
// run cards now route through showFirstRunCardOnce()/isPanelOpen() (app.js, defined near closePanel()):
// a card never replaces an open panel; if one is open, the card is deferred until the panel actually
// closes (never lost) and still fires at most once.
test.describe('first-run card guard — never stomps an open panel (shared by both cards)', () => {
  test('an open panel survives the trigger, and the deferred card arrives once that panel closes', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const result = await page.evaluate(() => {
      const w = window as any;
      openAppearance();   // some other panel is already open when the first-run trigger fires
      const openBefore = document.querySelector('.ap-lbl') && !document.querySelector('[data-vintro]');
      w.maybeAskVoiceIntro();
      const stillAppearance = !document.querySelector('[data-vintro]') && document.querySelector('.ap-lbl') !== null;
      const askedFlagBeforeClose = !!(w.store.get('mk-voiceintro-asked'));
      closePanel();   // the panel actually closes now → the deferred card gets its turn
      const cardAfterClose = !!document.querySelector('[data-vintro]');
      const askedFlagAfterClose = !!(w.store.get('mk-voiceintro-asked'));
      return { openBefore, stillAppearance, askedFlagBeforeClose, cardAfterClose, askedFlagAfterClose };
    });
    expect(result.openBefore).toBe(true);
    expect(result.stillAppearance).toBe(true);       // the open panel was never destroyed by the trigger
    expect(result.askedFlagBeforeClose).toBe(false);  // not marked "asked" until it actually renders
    expect(result.cardAfterClose).toBe(true);         // ...but it is not silently lost either
    expect(result.askedFlagAfterClose).toBe(true);
  });

  test('no panel open at trigger time → the card shows immediately', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const shown = await page.evaluate(() => {
      const w = window as any;
      const noneOpenAtStart = !isPanelOpen();
      w.maybeAskVoiceIntro();
      return { noneOpenAtStart, cardNow: !!document.querySelector('[data-vintro]') };
    });
    expect(shown.noneOpenAtStart).toBe(true);
    expect(shown.cardNow).toBe(true);
  });

  test('deferred behind an open panel, it still never shows twice', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const seen = await page.evaluate(() => {
      const w = window as any; const out: boolean[] = [];
      openAppearance();
      w.maybeAskVoiceIntro();               // deferred (panel open)
      closePanel();                          // deferred card fires here
      out.push(!!document.querySelector('[data-vintro]'));
      document.getElementById('panel')!.innerHTML = '';
      w.maybeAskVoiceIntro();               // already asked — must be a no-op now
      out.push(!!document.querySelector('[data-vintro]'));
      return out;
    });
    expect(seen).toEqual([true, false]);
  });

  test('maybeAskUiLevel goes through the SAME guard — also deferred behind an open panel, not lost', async ({ page }) => {
    await seedApp(page, { 'mk-voiceintro-asked': 'true' });
    const result = await page.evaluate(() => {
      const w = window as any;
      openAppearance();
      w.maybeAskUiLevel();
      const stillAppearance = !document.querySelector('[data-onb]') && document.querySelector('.ap-lbl') !== null;
      closePanel();
      const cardAfterClose = !!document.querySelector('[data-onb]');
      return { stillAppearance, cardAfterClose };
    });
    expect(result.stillAppearance).toBe(true);
    expect(result.cardAfterClose).toBe(true);
  });
});

test.describe('§1.4 · the voice-rules panel, continued', () => {
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
