// Accessibility in the smoke layer — Phase C §4.4. The plan's finding: "zero axe today".
//
// WHAT THIS IS AND IS NOT. axe finds machine-checkable violations — contrast, missing labels,
// broken ARIA relationships, duplicate ids. It cannot tell you a screen is confusing, and passing
// it is not the same as being usable. It is the floor, not the ceiling.
//
// SERIOUS AND CRITICAL ONLY, deliberately. axe's `minor`/`moderate` findings on a real app number
// in the dozens and are mostly advisory; a gate that reports 40 findings on day one is a gate
// everyone learns to ignore — this project has watched exactly that happen to a permanently amber
// signal before. The two severities that block are the ones that stop somebody using the product.
//
// The BASELINE is honest rather than empty: whatever exists today is counted and printed, and the
// test fails on anything NEW. Declaring a clean sheet we do not have would be the more comfortable
// lie.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, seedApp } from './_fixtures';

const EVENT = JSON.stringify([{ id: 'ev-a', name: 'BBQ', serve: '19:00', menu: { guests: 8, keys: ['cut-1', 'cut-2'] } }]);

async function scan(page: any) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((v: any) => v.impact === 'serious' || v.impact === 'critical');
  const advisory = results.violations.filter((v: any) => v.impact !== 'serious' && v.impact !== 'critical');
  return { blocking, advisory };
}

function describe(v: any) {
  return `${v.id} (${v.impact}, ${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}): ${v.help}`;
}

// THE BASELINE, and it is a debt register rather than a clean sheet.
//
// The first scan this project has ever run found REAL problems: colour contrast on 25 nodes of the
// home screen, 8 on the catalog, 5 in English, plus one nested interactive control. Fixing contrast
// is a VISUAL DESIGN change, and §10.9 says a significant visual change is shown to the owner and
// approved before it is built — so these are recorded, registered (R-97) and NOT quietly repainted.
//
// The gate blocks anything NEW. Pretending the sheet is clean would be the comfortable lie; making
// it block on day one would make it the permanently-amber signal everyone learns to skip.
// BY RULE ID, NOT BY COUNT. The first version pinned exact node counts and immediately failed on
// its own baseline: the same home screen reported 25 nodes on one run and 34 on the next, because
// how much is rendered depends on state. A baseline that produces false failures is worse than no
// baseline — people silence it, and then it protects nothing.
//
// A NEW KIND of violation blocks. A fluctuating count of a known, registered problem does not, and
// the count is printed on every run so the debt cannot grow unseen.
const BASELINE = new Set(['color-contrast', 'nested-interactive']);

function beyondBaseline(blocking: any[]): string[] {
  return [...new Set(blocking.filter((v) => !BASELINE.has(v.id)).map((v) => `${describe(v)} — a NEW kind of violation, not in the registered baseline`))];
}

test('a11y · home, Hebrew RTL — no serious or critical violation', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true', 'mk-events': EVENT });
  await page.waitForFunction(`typeof getLang==='function'`);
  const { blocking, advisory } = await scan(page);
  console.log(`    advisory (not blocking): ${advisory.length}`);
  for (const v of advisory.slice(0, 6)) console.log(`      ~ ${describe(v)}`);
  console.log(`    blocking-severity, at or under baseline: ${blocking.map(describe).join(' | ') || 'none'}`);
  expect(beyondBaseline(blocking), 'NEW serious/critical accessibility violations on the home screen').toEqual([]);
});

test('a11y · catalog, Hebrew RTL — the densest screen in the app', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true' });
  await page.click('button[data-cnav="catalog"]');
  await page.waitForFunction(() => !!document.querySelector('#scr-catalog.on'));
  const { blocking, advisory } = await scan(page);
  console.log(`    advisory (not blocking): ${advisory.length}`);
  for (const v of advisory.slice(0, 6)) console.log(`      ~ ${describe(v)}`);
  expect(beyondBaseline(blocking), 'NEW serious/critical accessibility violations on the catalog').toEqual([]);
});

test('a11y · English LTR — direction changes the layout, so it is scanned separately', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true', 'mk-voiceintro-asked': 'true',
    'mk-lang': JSON.stringify('en'), 'mk-events': EVENT,
  });
  await page.waitForFunction(`typeof getLang==='function' && !!(I18N_DICTS||{})['en']`);
  const { blocking } = await scan(page);
  expect(beyondBaseline(blocking), 'NEW serious/critical accessibility violations in LTR').toEqual([]);
});
