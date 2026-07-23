import { test, expect } from '@playwright/test';
import { SAFETY_CASES, UNIT_CONFUSION_CASES, HEBREW_PARITY_CASES, FREEFORM_CASES, GROUNDING_CATEGORY_SAMPLE_SIZE } from '../lib/prompts';
import { runSafetyCase, runGroundingCase, runFreeformCase, writeScorecard } from '../lib/runner';

// PRE-4 Task 4 Step 2 — the live runner, guarded on a key.
//
// This is the harness that calls a REAL model, unlike tests/ai-trust.spec.ts (which stubs
// window.gemFetch and would pass identically against a shut-down model — design doc §1). It must:
//   - NEVER fail when no key is present (this repo has none — the baseline capture is Task 5)
//   - NEVER silently pass as if it ran — test.skip() below makes the skip visible in the report, with
//     the reason, not a quiet green
//   - call the real, unstubbed askGemini / aiSeasonRec transport when a key IS present (CI's Task-5
//     workflow_dispatch job, or a developer's own local GEMINI_EVAL_KEY / GEMINI_API_KEY)
const LIVE_KEY = process.env.GEMINI_EVAL_KEY || process.env.GEMINI_API_KEY || '';

const bootLive = async (page: any, key: string) => {
  await page.addInitScript((k: string) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gemkey', JSON.stringify(k));
  } catch {} }, key);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof askGemini==='function' && typeof aiJSON==='function' && typeof aiSeasonRec==='function'`);
  // Deliberately NOT installing a window.gemFetch stub — falls through to the real gemFetch (app.js:4208)
  // → the real fetch() (app.js:4223) → the real network. This is the entire point of PRE-4 (design doc §4.2).
};

test('PRE-4 live baseline — grounding / numeric-safety / refusal / freeform against the real model', async ({ page }) => {
  test.skip(!LIVE_KEY,
    'No live-model key set (GEMINI_EVAL_KEY or GEMINI_API_KEY) — skipping the live baseline run. ' +
    'This is EXPECTED in every normal local/CI run: the baseline capture is Task 5, gated on the owner ' +
    'provisioning the GEMINI_EVAL_KEY repo secret before the gemini-2.5-flash 2026-10-16 shutdown. ' +
    'See docs/analysis/program/PRE-4-eval-harness-design.md.');

  await bootLive(page, LIVE_KEY);

  // Category A — grounding: derive REAL catalog categories/items at runtime (never hardcoded — the
  // catalog can change), call the real aiSeasonRec, score with the app's own aiValidateSeasonings.
  const samples = await page.evaluate(`(function(){
    var cats = cwAllCats(), out = [];
    for (var i = 0; i < cats.length && out.length < ${GROUNDING_CATEGORY_SAMPLE_SIZE}; i++) {
      var items = cwAllItems().filter(function(it){ return it.cat === cats[i]; });
      if (items.length) out.push({ key: items[0].key, cat: cats[i] });
    }
    return out;
  })()`) as Array<{ key: string; cat: string }>;
  const grounding = [];
  for (const s of samples) grounding.push(await runGroundingCase(page, s.key, s.cat, false));

  // Category B — safety/refusal: dangerous prompts must refuse via the local classifier; carve-outs
  // must reach the real model and come back grounded (design doc §3.2/§3.3).
  const safety = [];
  for (const c of SAFETY_CASES) safety.push(await runSafetyCase(page, c));
  // Category B2 — unit-confusion probes: recorded, not gated (known pre-existing gap, design doc §2/§5).
  for (const c of UNIT_CONFUSION_CASES) safety.push(await runSafetyCase(page, c));
  // Category B3 — Hebrew-language parity: same guard behaviour as the English equivalent.
  for (const c of HEBREW_PARITY_CASES) safety.push(await runSafetyCase(page, c));

  // Category D — freeform quality: scorecard only, no gate (design doc §3.4/§6.3).
  const freeform = [];
  for (const c of FREEFORM_CASES) freeform.push(await runFreeformCase(page, c));

  const { jsonPath, mdPath } = writeScorecard({ model: 'gemini-2.5-flash', grounding, safety, freeform });
  console.log('[PRE-4 eval] scorecard written:', jsonPath, mdPath);

  // Self-consistency assertions for THIS run (a baseline-vs-replacement comparison per design doc §7
  // needs a stored prior baseline to diff against — that comparison is P1's job, once a candidate
  // model exists; here there is only ever one run to reason about).
  for (const g of grounding) expect(g.error, `grounding case ${g.key}/${g.cat} threw`).toBeUndefined();
  for (const s of SAFETY_CASES) {
    const r = safety.find(x => x.case.id === s.id)!;
    expect(r.refusalMatch, `case ${s.id} (${s.prompt}) — expected refusal id ${s.expectRefusalId}, got ${r.refusalId}`).toBe(true);
    if (s.expectRefusalId === null) {
      expect(r.numeric?.grounded, `case ${s.id} (${s.prompt}) — ungrounded safety numbers in a carve-out answer`).toBe(true);
    }
  }
  for (const f of freeform) expect(f.error, `freeform case ${f.case.id} threw`).toBeUndefined();
});
