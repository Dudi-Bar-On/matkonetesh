import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { scoreNumericSafety, scoreRefusal } from './scorers';
import type { RefusalCase, FreeformCase } from './prompts';

// PRE-4 eval harness — the live runner. Calls the app's real, unstubbed AI entry points
// (askGemini, aiSeasonRec) via page.evaluate — the opposite of tests/ai-trust.spec.ts's
// window.gemFetch stub (design doc §4.2). NEVER called unless a key is present — see
// evals/tests/live-suite.spec.ts's test.skip() guard, which runs before any of this executes.

export interface SafetyCaseResult {
  case: RefusalCase;
  refusalId: string | null;
  refusalMatch: boolean;
  raw?: { txt: string; ctx: string };
  numeric?: { extracted: number[]; ungrounded: number[]; grounded: boolean };
  error?: string;
}

/** Runs one safety/refusal case. askRefuse is a local classifier (app.js:4197) that fires BEFORE any
 * model call (app.js:4448) — a case that resolves to a refusal id never reaches the network. A
 * legitimate carve-out (expectRefusalId:null) DOES reach the real askGemini, unstubbed, and its raw
 * answer + grounding context are scored for ungrounded safety numbers (design doc §3.2/§3.3). */
export async function runSafetyCase(page: Page, c: RefusalCase): Promise<SafetyCaseResult> {
  const refusalId = await scoreRefusal(page, c.prompt);
  const refusalMatch = refusalId === c.expectRefusalId;
  if (refusalId) return { case: c, refusalId, refusalMatch };   // refused locally — no live call for this case
  try {
    const raw = await page.evaluate(
      `(async()=>{ const r = await askGemini(${JSON.stringify(c.prompt)}); return { txt: r.txt, ctx: r.ctx }; })()`
    ) as { txt: string; ctx: string };
    const numeric = await scoreNumericSafety(page, raw.txt, raw.ctx);
    return { case: c, refusalId, refusalMatch, raw, numeric };
  } catch (e: any) {
    return { case: c, refusalId, refusalMatch, error: String((e && e.message) || e) };
  }
}

export interface FreeformResult { case: FreeformCase; txt?: string; error?: string; }

/** Category D (design doc §3.4) — no deterministic checker exists; the raw text is kept for a human
 * to read from the scorecard, never gated. */
export async function runFreeformCase(page: Page, c: FreeformCase): Promise<FreeformResult> {
  try {
    const txt = await page.evaluate(
      `(async()=>{ const r = await askGemini(${JSON.stringify(c.prompt)}); return r.txt; })()`
    ) as string;
    return { case: c, txt };
  } catch (e: any) {
    return { case: c, error: String((e && e.message) || e) };
  }
}

export interface GroundingCaseResult { key: string; cat: string; kept: Array<{ id: string }>; dropped: unknown[]; score: number; error?: string; }

/** Calls the REAL aiSeasonRec (app.js:8406) unstubbed — zero reimplementation of its prompt/grounding
 * (design doc §4.1). aiSeasonRec's own return is already post-validation (kept-only, app.js:8415), so
 * the dropped list is recovered from aiValidateSeasonings' own console.warn diagnostic (app.js:8397)
 * rather than re-derived — this stays a pass-through measurement over the real code path, not a
 * second, competing scorer. */
export async function runGroundingCase(page: Page, key: string, cat: string, isProd: boolean): Promise<GroundingCaseResult> {
  const dropped: unknown[] = [];
  const onConsole = async (msg: any) => {
    if (!msg.text().includes('[AI] dropped invalid seasonings')) return;
    try { const args = msg.args(); if (args[1]) dropped.push(...(await args[1].jsonValue())); } catch { /* best-effort capture only */ }
  };
  page.on('console', onConsole);
  try {
    const kept = await page.evaluate(
      `aiSeasonRec(${JSON.stringify(key)}, ${JSON.stringify(cat)}, ${JSON.stringify(!!isProd)})`
    ) as Array<{ id: string }>;
    const total = kept.length + dropped.length;
    return { key, cat, kept, dropped, score: total ? kept.length / total : 1 };
  } catch (e: any) {
    return { key, cat, kept: [], dropped, score: 0, error: String((e && e.message) || e) };
  } finally {
    page.off('console', onConsole);
  }
}

export interface ScorecardInput {
  model: string;
  grounding: GroundingCaseResult[];
  safety: SafetyCaseResult[];
  freeform: FreeformResult[];
}

/** Writes the raw-response JSON + human-readable markdown scorecard (design doc §10) to
 * docs/analysis/program/eval/. The raw model text is the one irreplaceable artifact once
 * gemini-2.5-flash retires (2026-10-16) — everything else here can be recomputed from it. */
export function writeScorecard(input: ScorecardInput): { jsonPath: string; mdPath: string } {
  const dir = path.resolve(__dirname, '..', '..', 'docs', 'analysis', 'program', 'eval');
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const base = `baseline-${input.model}-${date}`;
  const jsonPath = path.join(dir, base + '.json');
  const mdPath = path.join(dir, base + '.md');
  fs.writeFileSync(jsonPath, JSON.stringify(input, null, 2));
  fs.writeFileSync(mdPath, renderScorecardMd(input, date));
  return { jsonPath, mdPath };
}

function renderScorecardMd(input: ScorecardInput, date: string): string {
  const groundOk = input.grounding.filter(g => !g.error && g.kept.length > 0).length;
  const safetyOk = input.safety.filter(s => s.refusalMatch && (s.numeric ? s.numeric.grounded : true)).length;
  const freeformOk = input.freeform.filter(f => !f.error).length;
  const lines = [
    `# Eval scorecard — ${input.model} — ${date}`,
    '',
    `Generated by evals/lib/runner.ts (PRE-4 eval harness).`,
    '',
    `## Grounding (A) — ${groundOk}/${input.grounding.length} cases kept a non-empty valid set`,
    ...input.grounding.map(g => `- ${g.key} / ${g.cat}: kept ${g.kept.length}, dropped ${g.dropped.length}, score ${g.score.toFixed(2)}${g.error ? ` — ERROR: ${g.error}` : ''}`),
    '',
    `## Safety / refusal (B, B2, B3) — ${safetyOk}/${input.safety.length} cases matched expectation`,
    ...input.safety.map(s => `- ${s.case.id} [${s.case.category}] "${s.case.prompt}" → refusalId=${s.refusalId ?? 'null'} (expected ${s.case.expectRefusalId ?? 'null'})${s.numeric ? `, ungrounded=[${s.numeric.ungrounded.join(',')}]` : ''}${s.error ? ` — ERROR: ${s.error}` : ''}`),
    '',
    `## Freeform (D) — scorecard only, ${freeformOk}/${input.freeform.length} answered without error`,
    ...input.freeform.map(f => `- ${f.case.id} "${f.case.prompt}": ${f.error ? 'ERROR: ' + f.error : (f.txt || '').slice(0, 300)}`),
    '',
  ];
  return lines.join('\n');
}
