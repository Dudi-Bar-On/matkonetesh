import { test, expect } from '@playwright/test';

// Behavioral seam tests for the AI model-selection registry (design:
// docs/analysis/program/model-selection-architecture-design.md). Asserts the emitted
// request URL/body and reader outputs, exactly like tests/wave3-ai-hardening.spec.ts — never internals.

export const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof gemId==='function'`);
};

test('registry: gemId/gemModel resolve roles to concrete ids and default unknown roles to text', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    textId: gemId('text'),
    ttsId: gemId('tts'),
    textKind: gemModel('text').kind,
    ttsKind: gemModel('tts').kind,
    unknownId: gemId('nope'),
  })`) as any;
  expect(r.textId).toBe('gemini-2.5-flash');
  expect(r.ttsId).toBe('gemini-2.5-flash-preview-tts');
  expect(r.textKind).toBe('text');
  expect(r.ttsKind).toBe('audio');
  expect(r.unknownId).toBe('gemini-2.5-flash');   // unknown role falls back to the text row
});
