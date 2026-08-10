// scripts/hooks/rules/worker-ceiling-lock.mjs — L21: "a worker ceiling measured on a contaminated
// machine is not a ceiling." The certified pins (workers: 20 locally / 2 on CI, retries: 0) came
// out of an instrumented multi-run campaign on a proven-idle machine, after a contaminated
// measurement produced a confident, specific, WRONG hardware truth that survived precisely
// because it sounded like one. L21's own closing line: re-deriving the ceiling "is the owner's
// decision, not a drive-by edit." §11a adds: retries stays 0 — a flake is a bug, never retried away.
//
// PAYLOAD POSITION: an Edit to playwright.config.* whose old_string/new_string pair CHANGES the
// value of `workers:` or `retries:` (a Write is compared against the file on disk). The
// comparison is diff-anchored — an edit touching other lines of the config, or rewording a
// comment on the same line without changing the value, never fires (proven against the real
// config in the false-alarm test).
//
// SEVERITY: BLOCK, argued: the harm is to substance — a wrong concurrency pin manufactures
// phantom failures (or hides real capacity) across every future suite run, and the last wrong
// pin cost a full re-measurement campaign to un-learn. The reachable path through is NOT a
// bypass but the same escape §5 already honors: a dated `**Owner architecture decision
// (YYYY-MM-DD):** playwright-workers — ...` (or playwright-retries) record in the discipline
// doc, parsed by the SAME lib fix-cycle-limit.mjs uses (one grammar). The record must be FRESH
// (its cutoff covers now): a reset is point-in-time, not a permanent exemption.
export const RULE_IDS = ['L21'];

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { normPath, toolFilePath, newContent, oldContent } from '../lib/target-path.mjs';
import { ownerDecisionRecords } from '../lib/owner-decision-records.mjs';

const WORKERS = /workers\s*:\s*([^,\n]+)/;
const RETRIES = /retries\s*:\s*([^,\n]+)/;

function valueOf(re, text) {
  if (typeof text !== 'string') return null;
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  if (!fp || !basename(normPath(fp)).startsWith('playwright.config')) {
    return { decision: 'allow', reason: 'not a playwright config' };
  }
  const added = newContent(input);
  if (typeof added !== 'string') {
    return { decision: 'allow', reason: 'L21 degraded: no new content on this call — allowing' };
  }
  // The "before" text: Edit's old_string, or (for Write) the current file on disk. Unreadable
  // disk on a Write = a NEW config file = nothing measured is being changed — allow.
  let before = oldContent(input);
  if (before === null) {
    try { before = readFileSync(fp, 'utf8'); } catch {
      return { decision: 'allow', reason: 'L21: new config file, no measured value to protect — allowing' };
    }
  }
  const changes = [];
  for (const [name, re] of [['workers', WORKERS], ['retries', RETRIES]]) {
    const was = valueOf(re, before);
    const now = valueOf(re, added);
    // Fires only when the token exists on BOTH sides with different values — an Edit fragment not
    // mentioning workers at all yields was===now===null — no change, no fire. That asymmetry is
    // the diff anchoring.
    if (was !== null && now !== null && was !== now) changes.push([name, was, now]);
  }
  if (changes.length === 0) {
    return { decision: 'allow', reason: 'L21: no change to a measured pin (workers/retries) in this edit' };
  }
  let records = [];
  try { records = ownerDecisionRecords(); } catch { records = []; }
  const nowMs = Date.now();
  const covered = changes.every(([name]) => records.some(
    (r) => r.target === `playwright-${name}` && r.cutoffMs > nowMs,
  ));
  if (covered) {
    return {
      decision: 'allow',
      reason: 'L21: a fresh Owner architecture decision record covers this pin change',
    };
  }
  const what = changes.map(([n, w, v]) => `${n}: ${w} -> ${v}`).join(', ');
  return {
    decision: 'block',
    reason: `L21 (a contaminated measurement once produced a confident, WRONG "hardware truth" — `
      + `and §11a: retries stays 0, a flake is a bug): this edit changes a MEASURED pin (${what}) `
      + 'in playwright.config. Re-deriving the worker ceiling is the owner\'s decision, backed by '
      + 'a §11a-grade campaign (6–9 sampled runs on a verified-idle machine), not a drive-by edit. '
      + 'Blocked. The way through: raise it with the owner; once decided, append '
      + '`**Owner architecture decision (YYYY-MM-DD):** playwright-workers — <decision>` (or '
      + 'playwright-retries) to docs/process/development-discipline.md §11 — a record dated today '
      + 'clears this block, exactly as §5\'s own reset records work.',
  };
}
