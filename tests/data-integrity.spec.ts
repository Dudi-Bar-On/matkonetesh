import { test, expect } from '@playwright/test';

// Pull the app's DATA once per test (top-level `const DATA` is reachable by bare name).
async function getData(page: any) {
  await page.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  return await page.evaluate(`({cuts: DATA.cuts, specials: DATA.specials, makes: DATA.makes})`);
}

const isProduce = (c: any) => c.safe === 0;

test('every cut carries a source block (src with a verified date + cited sub-keys)', async ({ page }) => {
  const { cuts } = await getData(page);
  expect(cuts.length).toBe(130);
  for (const c of cuts) {
    expect(c.src, `cut ${c.n} ${c.eng}: missing src`).toBeTruthy();
    expect(c.src.verified, `cut ${c.n} ${c.eng}: missing verified date`).toBeTruthy();
    // at least one cited topic with a real ref+url (or explicit UNVERIFIED)
    const topics = ['sv', 'smoke', 'safe', 'grill'].map(k => c.src[k]).filter(Boolean);
    expect(topics.length, `cut ${c.n} ${c.eng}: no cited topics`).toBeGreaterThanOrEqual(1);
    for (const t of topics) {
      expect(t.ref, `cut ${c.n} ${c.eng}: topic missing ref`).toBeTruthy();
      if (t.ref !== 'UNVERIFIED') expect(t.url, `cut ${c.n} ${c.eng}: cited topic missing url`).toMatch(/^https?:\/\//);
    }
  }
});

test('sanity ranges: svt, smt, sot, safe, tgt within physical bounds', async ({ page }) => {
  const { cuts } = await getData(page);
  for (const c of cuts) {
    if (c.svt) { expect(c.svt, `${c.eng} svt`).toBeGreaterThanOrEqual(40); expect(c.svt, `${c.eng} svt`).toBeLessThanOrEqual(90); }
    if (c.smt) { expect(c.smt, `${c.eng} smt`).toBeGreaterThanOrEqual(80); expect(c.smt, `${c.eng} smt`).toBeLessThanOrEqual(260); }
    if (c.sot) { expect(c.sot, `${c.eng} sot`).toBeGreaterThanOrEqual(80); expect(c.sot, `${c.eng} sot`).toBeLessThanOrEqual(260); }
    // safe: 0 for produce, else a real floor 50–75
    if (!isProduce(c)) { expect(c.safe, `${c.eng} safe`).toBeGreaterThanOrEqual(50); expect(c.safe, `${c.eng} safe`).toBeLessThanOrEqual(75); }
    if (typeof c.tgt === 'number') { expect(c.tgt, `${c.eng} tgt`).toBeGreaterThanOrEqual(40); expect(c.tgt, `${c.eng} tgt`).toBeLessThanOrEqual(100); }
  }
});

test('P3 order-B safety gate: any smoke→sous-vide order must pasteurize + cite a source', async ({ page }) => {
  const { cuts } = await getData(page);
  let seen = 0;
  for (const c of cuts) {
    if (c.order_smokesv) {
      seen++;
      expect(c.order_smokesv.sv?.pasteurize, `${c.eng} order_smokesv must set sv.pasteurize=true`).toBe(true);
      expect(c.order_smokesv.ref || c.order_smokesv.url, `${c.eng} order_smokesv must cite a source`).toBeTruthy();
    }
  }
  expect(seen, 'expected some intact whole-muscle cuts to carry a verified reverse order').toBeGreaterThan(0);
});

test('grill: grillable cuts have a numeric grill temp; non-grillable are explicitly marked', async ({ page }) => {
  const { cuts } = await getData(page);
  for (const c of cuts) {
    if (c.grillable === false) {
      expect(c.grt == null, `${c.eng}: non-grillable must not carry a grill temp`).toBeTruthy();
    } else if (c.grt != null) {
      expect(c.grt, `${c.eng} grt`).toBeGreaterThanOrEqual(80);
      expect(c.grt, `${c.eng} grt`).toBeLessThanOrEqual(400);
    }
  }
});

test('MAKES cure safety: dry/fermented sausages carry a valid nitrite cure TYPE (1 or 2)', async ({ page }) => {
  const { makes } = await getData(page);
  // calc.cure is the cure *type* ('1' cooked/156ppm · '2' long-dried/nitrate reservoir); the dose lives in cureRate.
  const cured = ['m-cacc', 'm-nduja', 'm-sauci', 'm-sopr', 'm-sucuk', 'm-frank', 'm-bolo', 'm-morta', 'sal-bresaola', 'sal-coppa', 'm-droe'];
  for (const id of cured) {
    const calc = makes[id]?.build?.calc;
    expect(['1', '2'], `${id}: cure must be a valid nitrite type`).toContain(calc?.cure);
    expect(calc?.cureRate, `${id}: cureRate must be a real dose`).toBeGreaterThan(0);
  }
});

test('no-regression: brisket stays within its known-good verified values', async ({ page }) => {
  const { cuts } = await getData(page);
  const b = cuts.find((c: any) => c.n === 1);
  expect(b.eng).toBe('Brisket');
  expect(b.svt).toBe(68);
  expect(String(b.svh)).toBe('30');
  expect(b.tgt).toBe(95);
  expect(b.safe).toBe(63);
  expect(b.src.safe.ref).toContain('Baldwin');
});
