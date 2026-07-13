import { test, expect } from '@playwright/test';

// Wave 4 a11y depth — skip-link (a11y #10) + a live region on the AI answer thread (a11y #6).

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('a11y #10: a skip-link targets the focusable main content', async ({ page }) => {
  await init(page);
  const link = await page.evaluate(`(function(){ const a=document.querySelector('.skip-link'); return a? {href:a.getAttribute('href'), text:a.textContent, first: document.body.firstElementChild===a || document.body.querySelector('a.skip-link')===a} : null; })()`) as any;
  expect(link).not.toBeNull();
  expect(link.href).toBe('#mainContent');
  expect(link.text).toContain('דלג');
  expect(await page.evaluate(`document.querySelector('#mainContent').getAttribute('tabindex')`)).toBe('-1');   // target is programmatically focusable
});

test('a11y #6: the AI answer thread is a polite live region', async ({ page }) => {
  await init(page);
  const info = await page.evaluate(`(function(){ openAsk(); const t=document.querySelector('#askthread'); return t? {live:t.getAttribute('aria-live'), role:t.getAttribute('role')} : null; })()`) as any;
  expect(info).not.toBeNull();
  expect(info.live).toBe('polite');
  expect(info.role).toBe('log');
});
