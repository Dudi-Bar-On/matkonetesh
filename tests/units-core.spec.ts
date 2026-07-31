// tests/units-core.spec.ts
import { test, expect, seedApp } from './_fixtures';

test('UNITS.classify — every Fahrenheit spelling → {temp,F}; Celsius/generic never F', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const U = (window as any).UNITS || (typeof (globalThis as any).UNITS !== 'undefined' ? (globalThis as any).UNITS : null);
    if (!U) return { missing: true };
    const F = ['F','°F','ºF','˚F','° F','° F','deg F','degrees F','degF','fahrenheit','מעלות פרנהייט','מעלות  פרנהייט'];
    const notF = ['C','°C','℃','°','º','˚','מעלות','מעלות צלזיוס','celsius','deg C','degrees','deg.','ppm','%','אחוז'];
    return {
      missing: false,
      fOk: F.every(t => { const c = U.classify(t); return !!c && c.kind === 'temp' && c.unit === 'F'; }),
      notFOk: notF.every(t => { const c = U.classify(t); return !c || c.kind !== 'temp' || c.unit !== 'F'; }),
      tempOk: ['°','מעלות','deg','degrees','℃','C','F'].every(t => { const c = U.classify(t); return !!c && c.kind === 'temp'; }),
      failClosed: U.classify('furlongs') === null && U.classify('') === null,
    };
  });
  expect(r).toEqual({ missing: false, fOk: true, notFOk: true, tempOk: true, failClosed: true });
});

test('UNITS.toCanonical — the one import door: converts with provenance, passes canonical through, rejects wrong kind', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const U = (window as any).UNITS; if (!U) return { missing: true };
    const f = U.toCanonical(145, '°F', 'temp');
    const c = U.toCanonical(63, '°C', 'temp');
    const bare = U.toCanonical(63, 'מעלות', 'temp');
    const lb = U.toCanonical(11, 'lb', 'mass');
    return {
      missing: false,
      f: { v: f && f.v, unit: f && f.unit, src: f && f.src },
      cPassthrough: !!c && c.v === 63 && c.unit === 'C' && c.src.unit === '°C',
      barePassthrough: !!bare && bare.v === 63 && bare.unit === 'C',
      lb: lb && Math.abs(lb.v - 4.98949) < 1e-9 && lb.unit === 'kg',
      wrongKind: U.toCanonical(145, '°F', 'mass') === null,
      unknown: U.toCanonical(145, 'stone', 'mass') === null,
    };
  });
  expect(r.missing).toBe(false);
  expect(r.f.unit).toBe('C');
  expect(r.f.v).toBeCloseTo((145 - 32) * 5 / 9, 12);
  expect(r.f.src).toEqual({ v: 145, unit: '°F' });
  expect(r.cPassthrough).toBe(true);
  expect(r.barePassthrough).toBe(true);
  expect(r.lb).toBe(true);
  expect(r.wrongKind).toBe(true);
  expect(r.unknown).toBe(true);
});

test('collapse equivalence — SAFETY_UNIT golden, UNIT_CONV math identity, VC classes behave, seam delegated', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const U = (window as any).UNITS; if (!U) return { missing: true };
    // golden: the composed tokenizer source is byte-identical to the pre-collapse literal
    const golden = '(?:[°º˚]\\s*[CF]?|[CF]\\b|ppm|%|מעלות(?:\\s*(?:פרנהייט|צלזיוס|צלסיוס))?|deg(?:rees?)?(?:[^\\S\\r\\n]*(?:C\\b|F\\b|celsius\\b|fahrenheit\\b)|\\.?(?![A-Za-z]))|celsius|fahrenheit)';
    const conv = U.legacyConv();
    const vc = U.vcClasses();
    const clsOf = (s: string) => { let cls = '?'; for (const row of vc) { if (row.re.test(s)) { cls = row.cls; break; } } return cls; };
    return {
      missing: false,
      goldenOk: U.tokenizerUnitSrc() === golden && (window as any).SAFETY_UNIT === golden,
      fc: conv['F->C'](145) === (145 - 32) * 5 / 9,
      fdeg: conv['Fdeg->Cdeg'](9) === 9 * 5 / 9,
      lbkg: conv['lb->kg'](11) === 11 * 0.45359,
      vcTemp: clsOf('°C בערך') === 'temp' && clsOf('מעלות') === 'temp',
      vcTime: clsOf('דקות') === 'time' && clsOf('hours') === 'time',
      vcMass: clsOf('ק"ג') === 'mass' && clsOf('lbs') === 'mass',
      vcUnknown: clsOf('furlongs') === '?',
      seam: (window as any).vcNormalizeSafetyText('℃ 45') === U.normalize('℃ 45') && U.normalize('℃') === '°C',
      fWrap: (window as any).isFahrenheitUnit('מעלות פרנהייט') === true && (window as any).isFahrenheitUnit('מעלות') === false,
      tWrap: (window as any).isTempUnit('degrees') === true && (window as any).isTempUnit('ppm') === false,
      toC: (window as any).aiSafetyToC(145, '°F') === 63 && (window as any).aiSafetyToC(63, 'מעלות') === 63 && (window as any).aiSafetyToC(40, 'ppm') === 40,
    };
  });
  expect(r).toEqual({ missing: false, goldenOk: true, fc: true, fdeg: true, lbkg: true, vcTemp: true, vcTime: true, vcMass: true, vcUnknown: true, seam: true, fWrap: true, tWrap: true, toC: true });
});
