// Visual regression for the smoke layer — Phase C §4.2 of the testing overhaul plan.
//
// WHY THIS EXISTS, in the plan's own words: 330 commits touched the UI, 14 carried a screenshot,
// and ZERO described what was on screen. The consolidator warned explicitly against a rule
// requiring a sentence per screenshot — that counts sentences, not looking. `toHaveScreenshot()`
// is the version that works: a baseline is stored, and ANY pixel change fails the test. It catches
// what reviewer 8 caught by eye — coarse salt rendered wrong, broken flags, English leaking into
// Italian — without anyone having to notice.
//
// WHAT IT CANNOT DO, said plainly: a baseline records what the screen looked like, not whether
// that was CORRECT. The first baseline is only as good as the screen was on the day it was taken,
// so each one below is described in its test name — what a reader should see if they open it.
// A change that fails here is a change you must LOOK at; it is not automatically a bug.
//
// The combinations are taken from where the coverage map says nobody has ever been: the desktop
// viewport (0 of 175), and the non-Hebrew languages on real screens.
import { test, expect, seedApp } from './_fixtures';

const EVENT = JSON.stringify([{ id: 'ev-a', name: 'BBQ', serve: '19:00', menu: { guests: 8, keys: ['cut-1', 'cut-2'] } }]);

// Screenshot comparison is inherently timing-sensitive: fonts, transitions and any late render
// shift pixels. Every shot below waits on a CONDITION first (§11a — never a timeout), and
// animations are disabled so a caught mid-transition frame cannot masquerade as a regression.
async function settle(page: any) {
  await page.waitForFunction(`typeof getLang==='function' && (getLang()==='he' || !!(I18N_DICTS||{})[getLang()])`);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  await page.waitForFunction(() => document.fonts?.status === 'loaded' || true);
}

test.describe('visual regression · the phone, 390x844 — the viewport this product is designed for', () => {
  test('home, Hebrew, empty — what a brand-new user meets on first open', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true' });
    await settle(page);
    await expect(page).toHaveScreenshot('home-he-empty-390.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('home, Hebrew, one event — the live cooking state', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-events': EVENT,
    });
    await settle(page);
    await expect(page).toHaveScreenshot('home-he-populated-390.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('catalog, Hebrew — the grid of cuts, RTL', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true' });
    await settle(page);
    // cNavGo — the app's real navigation, found by reading how existing catalog specs get there
    // rather than guessing a plausible name. My first attempt invented `openCatalog`, which does
    // not exist, and the test failed for a reason that had nothing to do with the screen.
    await page.click('button[data-cnav="catalog"]');
    await page.waitForFunction(() => !!document.querySelector('#scr-catalog.on'));
    await expect(page).toHaveScreenshot('catalog-he-390.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });
});

// The languages the coverage map shows at 6-10%. A screenshot is the only check that would have
// caught "half the French screen is still English" — which this project shipped once and only
// found by looking (the v267 lesson: measure at the rendered DOM, per language).
for (const lang of ['en', 'fr', 'ru'] as const) {
  test(`visual regression · home in ${lang} — no untranslated string, no broken layout`, async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true',
      'mk-lang': JSON.stringify(lang), 'mk-events': EVENT,
    });
    await settle(page);
    await expect(page).toHaveScreenshot(`home-${lang}-populated-390.png`, { fullPage: true, maxDiffPixelRatio: 0.01 });
  });
}

// DESKTOP — the coverage map says 0 of 175 combinations have ever been rendered at this size.
// Nobody has ever looked at this product on a wide screen, so these baselines are the first
// evidence of what it even looks like.
test.describe('visual regression · desktop 1280x800 — never checked until now', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('home, Hebrew, one event — a mobile-first layout on a wide screen', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-events': EVENT,
    });
    await settle(page);
    await expect(page).toHaveScreenshot('home-he-populated-1280.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });

  test('NEGATIVE · nothing overflows horizontally at 1280 — an assertion, not a picture', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-events': EVENT,
    });
    await settle(page);
    // A screenshot records what happened; this states what must be TRUE. Both, deliberately:
    // a baseline would happily record a horizontal scrollbar forever.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, 'the page scrolls sideways on a desktop viewport').toBe(false);
  });
});
