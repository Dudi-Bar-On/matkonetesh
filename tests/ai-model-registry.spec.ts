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

test('thinking: numeric-knob translation, no-knob returns nothing, unknown level floors to minimal', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__b = { kind:'text', think:{ knob:'budget' } };   // throwaway numeric-knob role (migration-stable)
    return {
      low: gemThink('__b','low'),
      minimal: gemThink('__b','minimal'),
      high: gemThink('__b','high'),
      tts: gemThink('tts','high') ?? 'UNDEF',
      bogus: gemThink('__b','not-a-level'),
    };
  })()`) as any;
  expect(r.low).toEqual({ thinkingBudget: 512 });
  expect(r.minimal).toEqual({ thinkingBudget: 0 });
  expect(r.high).toEqual({ thinkingBudget: 8192 });
  expect(r.tts).toBe('UNDEF');                    // knob:'none' → never a thinking field
  expect(r.bogus).toEqual({ thinkingBudget: 0 }); // unknown level → 'minimal' floor
});

test('thinking: enum-knob clamps to nearest supported preferring lower, and logs the clamp', async ({ page }) => {
  await init(page);
  const warnings: string[] = [];
  page.on('console', (m: any) => { if (m.text().includes('thinking level clamped')) warnings.push(m.text()); });
  const r = await page.evaluate(`(function(){
    GEM_MODELS.__t = { kind:'text', think:{ knob:'level', levels:['minimal','medium'] } };
    const near = nearestLevel('low', ['minimal','medium']);   // low is equidistant → prefer lower → minimal
    const clamped = gemThink('__t','low');
    const exact = gemThink('__t','medium');                    // supported exactly → no clamp
    return { near, clamped, exact };
  })()`) as any;
  expect(r.near).toBe('minimal');
  expect(r.clamped).toEqual({ thinkingLevel: 'minimal' });
  expect(r.exact).toEqual({ thinkingLevel: 'medium' });
  await expect.poll(() => warnings.length).toBeGreaterThan(0);   // warnClamp fired for the clamp (not the exact match)
});

test('thinking: AI_THINK policy maps each usage to its approved level (§2.2.4)', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`({
    ask: thinkFor('ask'), diagnose: thinkFor('diagnose'), vcAsk: thinkFor('vcAsk'),
    eventPlan: thinkFor('eventPlan'), seasonRec: thinkFor('seasonRec'), dataMT: thinkFor('dataMT'),
    translate: thinkFor('translate'), vision: thinkFor('vision'), keyProbe: thinkFor('keyProbe'),
    centralTest: thinkFor('centralTest'), wcim: thinkFor('wcim'), unknown: thinkFor('whatever'),
  })`) as any;
  expect(r).toEqual({
    ask:'low', diagnose:'high', vcAsk:'low', eventPlan:'medium', seasonRec:'minimal', dataMT:'minimal',
    translate:'minimal', vision:'low', keyProbe:'minimal', centralTest:'minimal', wcim:'minimal', unknown:'minimal',
  });
});
