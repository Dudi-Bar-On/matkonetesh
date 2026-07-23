import type { Page } from '@playwright/test';

// PRE-4 eval harness — deterministic scorers.
// Design doc: docs/analysis/program/PRE-4-eval-harness-design.md §3, §6.1.
//
// Each scorer is a THIN WRAPPER that calls the app's own real, already-shipped, already-trusted
// functions via page.evaluate against the real built app (same in-page pattern already used by
// tests/ai-validators.spec.ts and tests/ai-trust.spec.ts). No scoring logic is reimplemented here —
// per §4.1 of the design doc, a standalone reimplementation would silently drift from what ships.
//
//   aiValidateKeys / aiValidateItems / aiValidateSeasonings  — app.js:4387 / 4394 / 8393
//   aiSafetyNums / aiUngroundedSafety                        — app.js:4302 / 4308
//   askRefuse                                                — app.js:4197

export interface GroundingScore { kept: unknown[]; dropped: unknown[]; score: number; }
export interface NumericSafetyScore { extracted: number[]; ungrounded: number[]; grounded: boolean; }

/** kept / (kept+dropped); 1.0 when there was nothing to drop (vacuously grounded). */
function groundScore(kept: unknown[], dropped: unknown[]): number {
  const total = kept.length + dropped.length;
  return total ? kept.length / total : 1;
}

export async function scoreGroundingKeys(page: Page, keys: string[]): Promise<GroundingScore> {
  const r = await page.evaluate(`aiValidateKeys(${JSON.stringify(keys)})`) as { kept: string[]; dropped: string[] };
  return { kept: r.kept, dropped: r.dropped, score: groundScore(r.kept, r.dropped) };
}

export async function scoreGroundingItems(page: Page, items: Array<{ key: string | null }>): Promise<GroundingScore> {
  const r = await page.evaluate(`aiValidateItems(${JSON.stringify(items)})`) as { kept: unknown[]; dropped: unknown[] };
  return { kept: r.kept, dropped: r.dropped, score: groundScore(r.kept, r.dropped) };
}

export async function scoreGroundingSeasonings(page: Page, ids: string[], cat: string, isProd: boolean): Promise<GroundingScore> {
  const r = await page.evaluate(
    `aiValidateSeasonings(${JSON.stringify(ids)}, ${JSON.stringify(cat)}, ${JSON.stringify(!!isProd)})`
  ) as { kept: string[]; dropped: string[] };
  return { kept: r.kept, dropped: r.dropped, score: groundScore(r.kept, r.dropped) };
}

/** Numeric-safety axis: extract the safety numbers from the answer, and flag which are absent
 * from the vetted grounding text. `grounded:true` means the guard found nothing to escalate —
 * either there were no safety numbers at all, or every one was present in the grounding. This is
 * also the seam the known unit-blindness gap (design doc §2) rides through: aiSafetyNums strips the
 * unit, so a wrong-unit number can read as "grounded" when it should not. */
export async function scoreNumericSafety(page: Page, answerText: string, groundingText: string): Promise<NumericSafetyScore> {
  const extracted = await page.evaluate(`aiSafetyNums(${JSON.stringify(answerText)})`) as number[];
  const ungrounded = await page.evaluate(
    `aiUngroundedSafety(${JSON.stringify(answerText)}, ${JSON.stringify(groundingText)})`
  ) as number[];
  return { extracted, ungrounded, grounded: ungrounded.length === 0 };
}

/** Refusal axis: the id of the matched AI_REFUSALS entry, or null if the question is a legitimate
 * (must-stay-grounded) carve-out — askRefuse is a local regex classifier, no model call involved. */
export async function scoreRefusal(page: Page, question: string): Promise<string | null> {
  return page.evaluate(
    `(function(){ var r = askRefuse(${JSON.stringify(question)}); return r ? r.id : null; })()`
  ) as Promise<string | null>;
}
