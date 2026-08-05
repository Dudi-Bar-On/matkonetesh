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

// `date` is not optional, and leaving it out is why three of these baselines were BYTE-IDENTICAL —
// `home-he-empty-390`, `home-he-populated-390` and `home-he-populated-1280` all had the same md5.
// Without a date the home screen renders exactly as if no event existed, so the "populated" and
// "desktop" baselines recorded the empty phone screen and asserted nothing the first one did not.
// The shape here is copied from `active-hub.spec.ts:54`, a spec that demonstrably renders an event.
//
// The date is FIXED and FUTURE. `active-hub.spec.ts` uses 2026-07-20, which was upcoming when it
// was written and is now past — and a past event does not populate the home screen, which is why
// simply copying its shape still produced an empty-looking baseline. A date computed from today
// would re-introduce L60 (the screen would read "in 3 days" and rot every midnight), so this is a
// fixed far date; anything it renders that counts down is masked below.
const EVENT = JSON.stringify([{
  id: 'ev-a', name: 'BBQ', serve: '19:00', date: '2027-01-15',
  menu: { guests: 8, keys: ['cut-1', 'make-1'] },
}]);

// Screenshot comparison is inherently timing-sensitive: fonts, transitions and any late render
// shift pixels. Every shot below waits on a CONDITION first (§11a — never a timeout), and
// animations are disabled so a caught mid-transition frame cannot masquerade as a regression.
async function settle(page: any) {
  await page.waitForFunction(`typeof getLang==='function' && (getLang()==='he' || !!(I18N_DICTS||{})[getLang()])`);
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  // FONTS, and the previous version of this line is the more instructive half of the story. It read
  //     await page.waitForFunction(() => document.fonts?.status === 'loaded' || true);
  // which waits for nothing: `|| true` makes the predicate true on its first evaluation, whatever
  // the font state is. It LOOKED like a condition wait — it satisfies §11a's "never a timeout" by
  // shape — and it is the reason these baselines passed when run alone and failed six-of-seven in
  // the full suite. Under twenty parallel workers the webfont has not arrived when the shot is
  // taken, every string renders in the fallback face, and the whole page reflows. In the diff that
  // reads as doubled headings and a shifted nav bar, which looks like changed CONTENT and is not.
  //
  // `document.fonts.ready` is the real API: a promise that resolves when font loading has finished.
  // The status check after it is not redundant — `ready` can resolve before a face requested during
  // that same layout pass is counted, and this must be settled, not nearly settled.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => document.fonts.status === 'loaded');

  // FOCUS. The skip-to-content link is visually hidden until it is focused, and whether the page
  // has focus at capture time depends on the browser, the worker, and what else is running. In the
  // failing full-suite shots it is a large orange button in the top corner; in the baselines it is
  // not there at all. That is not a regression, it is the test photographing a different state.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // SCROLL. `fullPage` stitches the document, but a `position: fixed` bottom nav is painted where
  // the viewport happens to be — so the same page yields the nav at different heights, and every
  // pixel it covers reads as changed. Pin the scroll to a known origin first.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
}

// Regions whose content is correct but not REPRODUCIBLE, masked rather than asserted.
//
// `#cGreet` is the home greeting, and app.js:12361 computes it from `new Date().getHours()`:
// morning / afternoon / evening. A baseline taken at 23:26 says "ערב טוב" and the same, unchanged
// screen says "בוקר טוב" after midnight. These baselines were therefore built to fail twice every
// day for reasons no commit caused — which is precisely how a gate becomes noise people silence.
//
// Masking is not hiding a defect: the greeting's correctness is a matter for a functional test that
// can control the clock, not for a photograph. What a photograph can prove — that the line renders,
// in the right place, in the right language — the mask still leaves in frame as a solid block.
const unstable = (page: any) => [page.locator('#cGreet')];

test.describe('visual regression · the phone, 390x844 — the viewport this product is designed for', () => {
  test('home, Hebrew, empty — what a brand-new user meets on first open', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true' });
    await settle(page);
    await expect(page).toHaveScreenshot('home-he-empty-390.png', { fullPage: true, maxDiffPixelRatio: 0.01, mask: unstable(page) });
  });

  // ⚠️ R-98, stated here because a reader of this file must not believe the title. This baseline is
  // currently BYTE-IDENTICAL to `home-he-empty-390` — the seeded event is stored (`evList()` returns
  // 1, `store.get('mk-events')` returns it) but the home screen never renders its name, with no
  // date, with a future date, and with today's date. Three measured attempts, so the 3-fix rule
  // (§5) stopped me rather than let me invent a fourth story. Until the owner says what app state
  // actually produces "the live cooking state", this asserts nothing the empty baseline does not.
  test('home, Hebrew, one event — the live cooking state', async ({ page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-events': EVENT,
    });
    await settle(page);
    await expect(page).toHaveScreenshot('home-he-populated-390.png', { fullPage: true, maxDiffPixelRatio: 0.01, mask: unstable(page) });
  });

  test('catalog, Hebrew — the grid of cuts, RTL', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true' });
    await settle(page);
    // cNavGo — the app's real navigation, found by reading how existing catalog specs get there
    // rather than guessing a plausible name. My first attempt invented `openCatalog`, which does
    // not exist, and the test failed for a reason that had nothing to do with the screen.
    await page.click('button[data-cnav="catalog"]');
    await page.waitForFunction(() => !!document.querySelector('#scr-catalog.on'));
    await expect(page).toHaveScreenshot('catalog-he-390.png', { fullPage: true, maxDiffPixelRatio: 0.01, mask: unstable(page) });
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
    await expect(page).toHaveScreenshot(`home-${lang}-populated-390.png`, { fullPage: true, maxDiffPixelRatio: 0.01, mask: unstable(page) });
  });
}

// DESKTOP — the coverage map says 0 of 175 combinations have ever been rendered at this size.
// Nobody has ever looked at this product on a wide screen, so these baselines are the first
// evidence of what it even looks like.
test.describe('visual regression · desktop 1280x800 — never checked until now', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // `isolatedPage`, NOT the default `page`. This is the second half of the identical-md5 defect and
  // the more embarrassing half: `page` is an alias for the WARM fixture, one page per worker built
  // from a WORKER-scoped context (`_fixtures.ts:101`). `test.use({ viewport })` is a TEST-scoped
  // option and cannot reach a context that was created before the test existed — so this test ran
  // at 390 and its baseline, captioned "the first evidence of what this looks like on a wide
  // screen", was a phone screenshot. `isolatedPage` is built on the built-in `context` fixture,
  // which does read test-level `use`.
  test('home, Hebrew, one event — a mobile-first layout on a wide screen', async ({ isolatedPage: page }) => {
    await seedApp(page, {
      'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-events': EVENT,
    });
    await settle(page);
    await expect(page).toHaveScreenshot('home-he-populated-1280.png', { fullPage: true, maxDiffPixelRatio: 0.01, mask: unstable(page) });
  });

  // Same fixture correction, and here it mattered more than for a picture: this assertion carried
  // the word "1280" in its name while running at 390, so it proved the phone layout does not
  // overflow — a thing no reader would have doubted — and reported it as desktop coverage.
  test('NEGATIVE · nothing overflows horizontally at 1280 — an assertion, not a picture', async ({ isolatedPage: page }) => {
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
