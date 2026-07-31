import { test, expect, seedApp } from './_fixtures';

test('UNITS.fmt — canonical is IDENTITY (byte-identity), imperial derivation rounds by safety role, cited passes through verbatim', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const U = (window as any).UNITS; if (!U || !U.fmt) return { missing: true };
    return {
      missing: false,
      canonInt: U.fmt(63, 'temp'),                 // '63°C' — String(v)+label, no rounding
      canonFrac: U.fmt(54.4, 'temp'),              // '54.4°C' — verbatim, NEVER rounded
      mass: U.fmt(5.5, 'mass'),                    // '5.5 ק״ג' (he default)
      floorUp: U.convert(63, 'temp', 'F', 'safeFloor'),   // 145.4 → 146 (UP, never 145)
      floorExact: U.convert(54.4, 'temp', 'F', 'safeFloor'), // exactly 130 (Baldwin cite roundtrip)
      ceilDown: U.convert(30, 'temp', 'F', 'safeCeil'),   // 86 exact
      comfort: U.convert(63, 'temp', 'F', 'comfort'),     // 145 (nearest)
      cited: U.fmt(63, 'temp', { unit: 'F', cited: { v: 145, unit: 'F' } }),  // '145°F' — the CITED figure, not 146
      voice: U.fmt(63, 'temp', { voice: true, lang: 'he' }),                  // '63 מעלות צלזיוס'
      html: U.fmtHtml(63, 'temp'),
    };
  });
  expect(r.missing).toBe(false);
  expect(r.canonInt).toBe('63°C');
  expect(r.canonFrac).toBe('54.4°C');
  expect(r.mass).toBe('5.5 ק״ג');
  expect(r.floorUp).toBe(146);
  expect(r.floorExact).toBe(130);
  expect(r.ceilDown).toBe(86);
  expect(r.comfort).toBe(145);
  expect(r.cited).toBe('145°F');
  expect(r.voice).toBe('63 מעלות צלזיוס');
  expect(r.html).toBe('<span dir="ltr" data-units-final>63°C</span>');
});

test('tnode skips [data-units-final] — a converted readout is never word-rewritten by the __units__ layer', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('en') });
  await page.evaluate(() => (window as any).__mkLangReady);
  const r = await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = 'משקל 5 ק״ג <span dir="ltr" data-units-final>5.5 ק״ג</span>';
    document.body.appendChild(d);
    (window as any).tnode(d);
    const out = { plain: d.childNodes[0].nodeValue, guarded: d.querySelector('[data-units-final]')!.textContent };
    d.remove();
    return out;
  });
  expect(r.plain).toContain('kg');            // the word layer still rewrites ordinary prose
  expect(r.guarded).toBe('5.5 ק״ג');          // the formatter's output is untouchable
});
