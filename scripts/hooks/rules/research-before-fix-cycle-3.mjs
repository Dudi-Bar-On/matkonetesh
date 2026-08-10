// scripts/hooks/rules/research-before-fix-cycle-3.mjs — §10.14: "when a problem is genuinely
// complex, OR after a few iterations that did not solve it, STOP guessing and do deep research."
// This is the documented hand-off point BETWEEN two rules that already exist: trigger 2
// (debugging-before-fix-edit.mjs) forces systematic-debugging after the FIRST failure, and §5
// (fix-cycle-limit.mjs) BLOCKS the 4th cycle behind an owner decision. §10.14 owns the gap in
// the middle: a target that has closed TWO failed fix cycles is, in the rule's own words, "a few
// iterations that did not solve it" — the next edit that begins cycle #3 should be preceded by
// research (geniza first, per §10.11, then the web), not by guess #3.
//
// SEVERITY: WARN, argued: the harm of skipping research at cycle 3 is to EFFICIENCY — burned
// iterations, the exact currency §10.14 was written to stop spending ("a careful read of
// Playwright's docs would have short-circuited many iterations of guess-and-kill"). The
// SUBSTANCE stop already exists one cycle later as fix-cycle-limit.mjs's block; duplicating a
// block here would make two rules fight over one interception point. A warn that names the
// geniza's own corpora is the §10.14 escalation made visible at the moment it applies.
//
// STATE READ (group B): fix_targets.attempts / last_failure_ts per (session, actor, target) —
// written by observers/verification-outcomes.mjs via noteVerificationFailure(), the same rows
// fix-cycle-limit.mjs reads; this rule adds no write of its own.
//
// BRIEF VERIFICATION (task-3, per the owner's standing instruction — two earlier tasks in this
// phase found a brief calling a helper with the wrong shape): openTargets(db, sessionId, actorId)
// and normalizeActorId() were read from enforcement-state.mjs before this file was written and
// match the brief's call shape exactly (openTargets returns [] on any failure/missing db, never
// throws; each row carries `attempts` and `lastFailureTs` as named here). No mismatch found.
// TOOLS — the tool names this rule can ever object to. The pipeline reads this from the
// file TEXT and skips importing the module entirely for any other tool, which is what keeps
// per-call cost from growing with the total rule count. It must stay HONEST: for any tool
// not listed here, evaluate() must return allow. tests/test_hook_tool_scope.py proves that
// for every rule and every tool, so a wrong list fails loudly instead of silencing a rule.
export const TOOLS = ['Edit', 'Write'];
export const RULE_IDS = ['10.14'];

// Exported so a future announcer can render the same number this rule warns on (the
// ATTEMPT_THRESHOLD precedent in fix-cycle-limit.mjs).
export const RESEARCH_THRESHOLD = 2;

import { openState, openTargets, normalizeActorId } from '../lib/enforcement-state.mjs';
import { researchEvidenceSince } from '../lib/research-evidence.mjs';

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return { decision: 'allow', reason: '10.14 degraded: no session_id — allowing' };
  }
  const actorId = normalizeActorId(input.agent_id);
  const db = openState();
  if (!db) {
    return { decision: 'allow', reason: '10.14 degraded: enforcement state unreadable — allowing' };
  }
  let targets;
  try {
    targets = openTargets(db, sessionId, actorId);
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
  // Exactly RESEARCH_THRESHOLD: at 3+, fix-cycle-limit.mjs's block owns the interception, and a
  // warn underneath a block would be noise on top of a wall.
  const hot = targets.filter((t) => t.attempts === RESEARCH_THRESHOLD);
  if (hot.length === 0) {
    return { decision: 'allow', reason: 'no open fix target at the §10.14 research threshold' };
  }
  const oldest = Math.min(...hot.map((t) => t.lastFailureTs));
  let evidence;
  try {
    evidence = researchEvidenceSince(input.transcript_path, input.agent_id, oldest);
  } catch {
    evidence = { determined: false, researched: false };
  }
  if (!evidence.determined) {
    return {
      decision: 'allow',
      reason: '10.14 degraded: no readable transcript evidence either way — allowing rather than '
        + 'warning on an absence this rule cannot verify.',
    };
  }
  if (evidence.researched) {
    return { decision: 'allow', reason: '10.14: research evidence found in this actor\'s transcript since the last failure' };
  }
  const names = hot.map((t) => `"${t.target}"`).join(', ');
  return {
    decision: 'warn',
    reason: `§10.14 (owner instruction, 2026-07-23 — written after a worker-flake debug burned many `
      + `iterations that one careful docs read would have short-circuited): target(s) ${names} `
      + `already closed ${RESEARCH_THRESHOLD} failed fix cycles, and no research has happened since `
      + 'the last failure. STOP guessing before cycle #3: query the geniza first (§10.11 — '
      + 'retrieval.search_current_docs / semantic_search; its tool_spec corpora include '
      + 'playwright-official-docs, nodejs-v8-docs and seven more), then the official docs and issue '
      + 'trackers on the web, then converge. One more unresearched cycle from here meets '
      + 'fix-cycle-limit\'s hard block at #4.',
  };
}
