import { test, expect } from '@playwright/test';

// Wave 0 — Safety & Security hotfix regression tests.
// (1) The cure calculator must expose a cure TYPE ('1'/'2') + a real cureRate, so the
//     "⚠ dried, uncooked" warning (gated on calc.cure==='2') actually fires. Regression for
//     the bug where SG() wrote the rate (2.5) into calc.cure, suppressing the warning on 47 makes.
// (2) esc() must neutralize HTML so AI/user text cannot inject markup (XSS → mk-gemkey exfiltration).

async function getMakes(page: any) {
  await page.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  return await page.evaluate(`DATA.makes`) as Record<string, any>;
}

test('cure calc: every cured make exposes a TYPE (1/2) + a sane rate; the warning can fire', async ({ page }) => {
  const makes = await getMakes(page);
  let cured = 0, dried = 0;
  for (const [id, m] of Object.entries(makes)) {
    const calc = (m as any)?.build?.calc;
    if (!calc || calc.cure == null) continue;
    cured++;
    // cure must be a TYPE, never a numeric rate like 2.5 (which broke the warning gate)
    expect(['1', '2'], `${id}: calc.cure must be a type '1'/'2', got ${JSON.stringify(calc.cure)}`).toContain(calc.cure);
    expect(calc.cureRate, `${id}: cureRate must be a real dose`).toBeGreaterThan(0);
    expect(calc.cureRate, `${id}: cureRate out of range`).toBeLessThanOrEqual(3);
    // long-dried nitrate-cured sausages hold the cited dry-cure salt floor (>=28 g/kg)
    if (calc.cure === '2') {
      dried++;
      expect(calc.salt, `${id}: nitrate-cured salt too low`).toBeGreaterThanOrEqual(24);
      if ((m as any).cat === 'נקניק מיובש') {
        expect(calc.salt, `${id}: dried salt floor (28 g/kg)`).toBeGreaterThanOrEqual(28);
      }
    }
  }
  expect(cured, 'expected many cured makes').toBeGreaterThan(30);
  expect(dried, 'expected several long-dried (Cure #2) makes').toBeGreaterThan(10);
});

test('cure calc: the dried warning text is gated on cure type 2 (renders for a dried make)', async ({ page }) => {
  const makes = await getMakes(page);
  // m-sopr (soppressata) is a long-dried Cure #2 make that previously had no calc at all.
  expect(makes['m-sopr']?.build?.calc?.cure).toBe('2');
  const warns = await page.evaluate(`(function(){
    var box=document.createElement('div');
    box.innerHTML=calcBoxHTML(DATA.makes['m-sopr'].build.calc);
    document.body.appendChild(box);
    wireCalcBox(box, DATA.makes['m-sopr'].build.calc);
    var n=box.querySelector('[data-note]');
    return n?n.textContent:'';
  })()`) as string;
  expect(warns).toContain('מיובש לא מבושל'); // the ⚠ dried/uncooked safety warning
});

test('esc(): neutralizes HTML so AI output cannot inject an executing element', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  const out = await page.evaluate(`esc('<img src=x onerror=alert>')`) as string;
  expect(out).toBe('&lt;img src=x onerror=alert&gt;');
  expect(out).not.toContain('<');
  expect(out).not.toContain('>');
  // ampersand + quotes are entity-encoded; null/undefined degrade to empty string
  expect(await page.evaluate(`esc('a & b')`)).toBe('a &amp; b');
  expect(await page.evaluate(`esc(null)`)).toBe('');
  expect(await page.evaluate(`esc(undefined)`)).toBe('');
});

test('esc(): a malicious AI answer rendered into the DOM stays inert (no live <img>)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  // Simulate the exact interpolation the Ask/voice/diagnose paths use: esc(text).replace newlines.
  const hasLiveImg = await page.evaluate(`(function(){
    var payload='<img src=x onerror="window.__xss=1">';
    var host=document.createElement('div');
    host.innerHTML='<div class="abubble">'+esc(payload).replace(/\\n/g,'<br>')+'</div>';
    document.body.appendChild(host);
    return { imgs: host.querySelectorAll('img').length, flag: !!window.__xss, text: host.textContent };
  })()`) as any;
  expect(hasLiveImg.imgs, 'escaped payload must not create a real <img> element').toBe(0);
  expect(hasLiveImg.flag, 'onerror handler must never execute').toBeFalsy();
  expect(hasLiveImg.text).toContain('<img'); // the markup survives as visible, inert text
});
