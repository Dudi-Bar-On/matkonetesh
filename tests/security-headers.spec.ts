// tests/security-headers.spec.ts — E15: headers exist AND the app actually boots under its own CSP.
import { test, expect } from './_fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function headersFile(): string {
  return readFileSync(resolve(process.cwd(), 'dist/_headers'), 'utf8');
}

test('dist/_headers carries the security header set', async () => {
  const h = headersFile();
  expect(h).toContain('Content-Security-Policy:');
  expect(h).toContain("default-src 'self'");
  expect(h).toContain('X-Content-Type-Options: nosniff');
  expect(h).toContain('X-Frame-Options: DENY');
  expect(h).toContain('Referrer-Policy: no-referrer');
  expect(h).toContain('Permissions-Policy: geolocation=(), payment=()');
  expect(h).toContain('/lang-*.json');   // Task 1's cache rule survived the rewrite
});

test('the app boots cleanly with its own CSP enforced', async ({ isolatedPage }) => {
  const csp = headersFile().split('\n').find(l => l.includes('Content-Security-Policy:'))!
    .replace(/^\s*Content-Security-Policy:\s*/, '').trim();
  const body = readFileSync(resolve(process.cwd(), 'dist/index.html'));
  try {
    await isolatedPage.route(/\/index\.html($|\?)/, r => r.fulfill({
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp },
      body,
    }));
    const violations: string[] = [];
    await isolatedPage.addInitScript(() => {
      (window as any).__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e: any) =>
        (window as any).__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
    });
    await isolatedPage.goto('/index.html');
    await expect(isolatedPage.locator('[data-cnav="home"]')).toBeVisible();   // app painted
    const v = await isolatedPage.evaluate(() => (window as any).__cspViolations);
    expect(v).toEqual([]);   // zero violations on boot
  } finally {
    await isolatedPage.unroute(/\/index\.html($|\?)/);
  }
});
