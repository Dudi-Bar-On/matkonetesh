import { test, expect, seedApp } from './_fixtures';

// Footer what's-new summary line (owner request): a short "what changed" line under the
// version stamp (.foot-stamp), translated through the same data-i18n chrome walker (tnode)
// that handles the neighboring footnote pair — keyed on the full Hebrew source text.

const SHOT = 'mockups/';

test('Hebrew: .foot-news exists, starts with "מה חדש:", carries real content, and sits directly after .foot-stamp', async ({ page }) => {
  await seedApp(page);

  expect(await page.evaluate(`!!document.querySelector('.foot-news')`)).toBe(true);

  const text = await page.evaluate(`(document.querySelector('.foot-news')||{}).textContent||''`) as string;
  expect(text.trim().startsWith('מה חדש:')).toBe(true);
  // copy-agnostic by design (v264 retune): the WHATS_NEW copy changes EVERY release per the
  // protocol, so the test pins the MECHANISM — prefix + non-trivial content — not this release's
  // words. The English test's no-Hebrew-leak assertion is what enforces that the current copy's
  // en.json pair exists (a missing pair leaks Hebrew there and fails it).
  expect(text.trim().length).toBeGreaterThan('מה חדש: '.length + 10);

  // positional assertion: .foot-news is the element immediately following .foot-stamp
  // (real sibling-order check, not just presence-in-DOM) — a <br> line break between them
  // is expected (that's how the stamp itself follows the footnote text) and is skipped;
  // any OTHER element in between fails the check.
  const directlyAfter = await page.evaluate(`
    (function(){
      const stamp = document.querySelector('.foot-stamp');
      const news = document.querySelector('.foot-news');
      if (!stamp || !news) return false;
      let el = stamp.nextElementSibling;
      while (el && el.tagName === 'BR') el = el.nextElementSibling;
      return el === news;
    })()
  `);
  expect(directlyAfter).toBe(true);

  // DoD-8 visual evidence — 390x844 (the project's mobile-first default viewport)
  await page.evaluate(`document.querySelector('.foot-news').scrollIntoView({block:'center'})`);
  await page.screenshot({ path: SHOT + 'foot-news-he-390x844.png' });
});

test('English: .foot-news renders the English pair, starts with "What\'s new:", no Hebrew leak', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('en') });

  const text = await page.evaluate(`(document.querySelector('.foot-news')||{}).textContent||''`) as string;
  expect(text.trim().startsWith("What's new:")).toBe(true);
  expect(/[֐-׿]/.test(text)).toBe(false);   // Hebrew-block leak check

  // DoD-8 visual evidence — 390x844
  await page.evaluate(`document.querySelector('.foot-news').scrollIntoView({block:'center'})`);
  await page.screenshot({ path: SHOT + 'foot-news-en-390x844.png' });
});
