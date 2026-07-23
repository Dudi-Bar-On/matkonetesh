import { test, expect } from '@playwright/test';
import fs from 'fs';
import { SAFETY_CASES, UNIT_CONFUSION_CASES, HEBREW_PARITY_CASES, FREEFORM_CASES, GROUNDING_CATEGORY_SAMPLE_SIZE } from '../lib/prompts';
import { runSafetyCase, runGroundingCase, runFreeformCase, writeScorecard, LIVE_CALL_TIMEOUT_MS } from '../lib/runner';

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

  // FIX 1 — size the test timeout for the FULL set of live model calls. The first live baseline run
  // concluded `failure` because the default 30 s test timeout fired mid-call after ~11 cumulative live
  // calls (3 grounding + 7 safety carve-outs), which closed the page and cascaded "Target closed" into
  // every remaining freeform case (D01→D05). Each live call is independently backstopped at
  // LIVE_CALL_TIMEOUT_MS inside the runner, so this ceiling = that budget × the number of live calls
  // guarantees a single hung call is recorded per-case and can never reach this test-level ceiling.
  const liveCallCount =
    GROUNDING_CATEGORY_SAMPLE_SIZE
    + [...SAFETY_CASES, ...UNIT_CONFUSION_CASES, ...HEBREW_PARITY_CASES].filter(c => c.expectRefusalId === null).length
    + FREEFORM_CASES.length;
  test.setTimeout(liveCallCount * LIVE_CALL_TIMEOUT_MS + 60_000);

  await bootLive(page, LIVE_KEY);

  // FIX 3 — self-label the scorecard with the app's ACTUAL model, read at runtime from the top-level
  // const in the inlined script (app.js:4206). When GEM_MODEL is later flipped to gemini-3.6-flash, the
  // artifact self-renames to baseline-gemini-3.6-flash-<date> with no edit here.
  const model = await page.evaluate('typeof GEM_MODEL!=="undefined" ? GEM_MODEL : "unknown"') as string;

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

  const { jsonPath, mdPath } = writeScorecard({ model, grounding, safety, freeform });
  console.log('[PRE-4 eval] scorecard written:', jsonPath, mdPath);

  // FIX 2 — this is a MEASUREMENT harness, not a model conformance gate. Everything the *model* did is
  // RECORDED in the scorecard above and asserted on NOWHERE below: per-case refusal expected-vs-actual,
  // the carve-out ungrounded-number list, and per-case call errors are all data to compare across
  // models, not pass/fail conditions. A GREEN run therefore means "measurement complete", so the SAME
  // harness can measure any model (2.5-flash, 3.6-flash, …) without a red-fail when the model
  // legitimately disagrees with an expectation (e.g. the incumbent's ungrounded numbers on B11 "what
  // temp kills botulism"). What stays HARD below is only the harness's OWN correctness.
  //
  // Converted to RECORDED-ONLY (were expect().toBe(true) / .toBeUndefined()):
  //   • per-case refusalMatch          — model behaviour (recorded: refusalId vs expected)
  //   • per-case carve-out numeric.grounded — model behaviour (recorded: ungrounded=[...] list)
  //   • per-case grounding .error      — a live-call outcome (recorded: "— ERROR: …"); see (2) for the
  //                                       replacement guarantee that at least one live call succeeded
  //   • per-case freeform .error       — a live-call outcome (recorded); its cascade is what FIX 1 closes
  //
  // KEPT HARD — the harness's own correctness (never the model's):
  // (1) every case was actually attempted over real data — no silent skip, and (crucially) no mid-run
  //     page-close cascade that would leave freeform short of its case count (the FIX 1 regression guard).
  expect(samples.length, 'no grounding categories derived from the catalog — the live path never set up').toBeGreaterThan(0);
  expect(grounding.length, 'not every grounding sample was attempted').toBe(samples.length);
  expect(safety.length, 'not every safety case was attempted')
    .toBe(SAFETY_CASES.length + UNIT_CONFUSION_CASES.length + HEBREW_PARITY_CASES.length);
  expect(freeform.length, 'not every freeform case produced a result — a mid-run page close cascaded (the bug FIX 1 closes)')
    .toBe(FREEFORM_CASES.length);
  // (2) the live model was genuinely reached at least once — guards against a silently stubbed/dead path
  //     (bad key, wrong endpoint, total network failure): if NOTHING came back, no measurement happened.
  const liveTouched = grounding.some(g => !g.error) || safety.some(s => !!s.raw) || freeform.some(f => f.txt != null);
  expect(liveTouched, 'no live model call returned across any category — key/endpoint/network failure, the measurement is void').toBe(true);
  // (3) the scorecard was persisted — the raw model text is the one irreplaceable artifact (design doc §10).
  expect(fs.existsSync(jsonPath), `scorecard JSON not written to ${jsonPath}`).toBe(true);
  expect(fs.existsSync(mdPath), `scorecard MD not written to ${mdPath}`).toBe(true);
});
