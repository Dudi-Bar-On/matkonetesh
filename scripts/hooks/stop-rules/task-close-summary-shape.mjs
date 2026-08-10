// scripts/hooks/stop-rules/task-close-summary-shape.mjs — Arc 2 Phase 4. §10.6 (the three-part
// summary: DONE / NEXT / LEFT UNTIL THE GRAND FINAL) + H9 (the fixed 5-row table), enforced
// together because they read the SAME payload position — the task-closing final message — and
// prescribe two forms of the same duty. Satisfied by EITHER form, deliberately: H10a (owner)
// says the table is MAINTAINED every task but SHOWN only at milestones, so demanding the table
// on every close would enforce more than the rule says.
//
// SEVERITY: WARN, argued per spec §3.2 — a missing summary shape harms the owner's visibility
// ("a long programme reads as an unbounded run of green ticks"), it fabricates nothing and
// removes no capability. A stop-BLOCK is the most disruptive severity in the system (it stops
// the assistant answering the owner) and is reserved in this phase for substantive harm.
//
// THE NARROWING THAT KEEPS THIS FROM BEING A MUZZLE (the measurement's own lesson — a naive
// DoD-3 would block 24% of replies): this rule triggers ONLY on a message that itself DECLARES
// a task/phase closed (TASK_CLOSE_RES below, evaluated on MASKED text so prose QUOTING a close
// never fires — R-133's class), and even then only when NEITHER accepted shape is present.
// THIS NARROWS DETECTION, NOT THE REQUIREMENT (L77): §10.6/H9 still bind every task close; this
// gate only claims to catch the closes it can SEE. An unrecognized close is uncaught, not
// permitted.
//
// FAIL-OPEN: unreadable transcript resolves to allow, same contract as every rule in this arc.
// RULE_IDS — the rules in the corpus this file ACTUALLY enforces, read by
// scripts/check-rule-coverage.mjs. Declared here rather than as a path column in the store so
// it travels with the file: a stored path goes stale in silence, which is the failure the rules
// register itself exists to prevent. An id absent from the corpus is an ERROR, not an ignored
// field — claiming to enforce something that does not exist is false coverage.
export const RULE_IDS = ['10.6', 'H9'];

import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';

// A message DECLARING a task/phase close. Bilingual; bounded lookahead within the line (no
// [^)]*-style class asked to cross a newline). Tuned against the real corpus in this task's
// own measurement step — the counts live in the task report.
export const TASK_CLOSE_RES = [
  /(?:Task|Phase|משימה|שלב|המשימה|השלב)\s*\d*[^\n.!?]{0,60}?(?:הושלמ|הסתיימ|נסגר|complete[d]?\b|closed\b|finished\b|done\b)/i,
  /\b(?:completed|finished|closing)\s+(?:task|phase)\b/i,
  /סיימתי\s+את\s+(?:המשימה|השלב|משימת)/,
];

// The three §10.6 parts (either language). ≥2 of 3 counts as the shape being present —
// generosity here only ever REMOVES fires.
export const PART_RES = [
  /\bDONE\b|מה נעשה/,
  /\bNEXT\b|הבא בתור/,
  /LEFT UNTIL|מה נשאר|עד הגמר/i,
];

// One H9 table row is enough to prove the table exists: row 1's own label between pipes.
export const H9_TABLE_RE = /\|[^\n|]*(?:מה היה|Before)[^\n|]*\|/;

// TUNING PASS 1 (this task's own corpus replay — task-3-report.md has the classification table):
// TASK_CLOSE_RES alone over-matches three recurring corpus shapes that are NOT a task close:
//   (1) partial-progress counts — "4 of 12 tasks done", "2 of 5 complete" (a §10.6-compliant
//       IN-FLIGHT status update, correctly using the "LEFT UNTIL THE GRAND FINAL" heading,
//       reporting PROGRESS on an unfinished item) — describes ONGOING work, not a close.
//   (2) "Task N came back DONE" — a SUBAGENT's report, paraphrased by the controller, who then
//       verifies/reviews BEFORE actually closing — the controller's OWN close (if any) lands in
//       a LATER message, not this one. Same shape claim-scan.mjs's header warns about for
//       DoD-3/rule 1 (R-137): "a description of work done" is not the same claim as "IS done".
//   (3) negated completion — "Phase A is still NOT COMPLETE" — bare word-proximity cannot see
//       that "NOT" governs the completion word.
// Each guard inspects only a BOUNDED WINDOW around the specific TASK_CLOSE_RES match (not the
// whole message) — same "bounded lookahead, no invented grammar engine" discipline as
// claim-scan.mjs's SUBORDINATOR_RE/question-exclusion. A message with ANY surviving (non-guarded)
// close mention still counts as a close — these guards only ever REMOVE fires, matching the
// project-wide bias in this arc (a missed close is uncaught, not permitted; a false block/warn on
// ordinary work is the disqualifying failure, per spec §6's own STOP condition).
const FRACTION_GUARD_RE = /\d+\s*(?:\/|of\b|מתוך)\s*\d+/i;
const CAME_BACK_GUARD_RE = /came back/i;
const NEGATION_GUARD_RE = /\b(?:not|never)\b|(?:^|\s)לא\s|אינ(?:ו|ה)\s/i;
const GUARD_WINDOW = 30;

export function declaresTaskClose(masked) {
  if (typeof masked !== 'string' || !masked) return false;
  for (const re of TASK_CLOSE_RES) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m;
    while ((m = g.exec(masked)) !== null) {
      const start = Math.max(0, m.index - GUARD_WINDOW);
      const end = Math.min(masked.length, m.index + m[0].length + GUARD_WINDOW);
      const window = masked.slice(start, end);
      if (!FRACTION_GUARD_RE.test(window) && !CAME_BACK_GUARD_RE.test(window) && !NEGATION_GUARD_RE.test(window)) {
        return true; // a surviving, unguarded close mention — genuinely declares a close.
      }
      if (m[0].length === 0) g.lastIndex += 1; // safety against zero-length matches
    }
  }
  return false;
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: '§10.6/H9 degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: '§10.6/H9 degraded: no readable assistant reply text — allowing.' };
  }

  const masked = maskQuotedProse(text);
  if (!declaresTaskClose(masked)) {
    return { decision: 'allow', reason: 'the final reply does not declare a task/phase close — §10.6/H9 do not apply.' };
  }

  // Compliance is checked on the RAW text: the table/parts are literal content the owner reads,
  // and part headers legitimately appear inside bold markers etc.
  const partsPresent = PART_RES.filter((re) => re.test(text)).length;
  if (partsPresent >= 2 || H9_TABLE_RE.test(text)) {
    return { decision: 'allow', reason: 'the close carries the §10.6 three-part shape or the H9 table.' };
  }

  return {
    decision: 'warn',
    reason: '§10.6/H9: ההודעה סוגרת משימה בלי צורת הסיכום — הוסף את שלושת החלקים '
      + '(DONE · NEXT · LEFT UNTIL THE GRAND FINAL, עם מספר המרשם) או את טבלת 5 השורות של H9 '
      + '(מה היה · מה נעשה · מה נשאר · איפה אנחנו · הבא בתור), ועדכן את docs/STATUS-BOARD.md (H10).',
  };
}
