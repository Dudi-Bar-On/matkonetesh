// scripts/hooks/rules/debugging-before-fix-edit.mjs — §6.4 trigger 2 (task-8-brief.md): "a failure
// (exit != 0) followed by an edit" with no `superpowers:systematic-debugging` invocation between
// them is now a PreToolUse block on Edit/Write, not a sentence in CLAUDE.md that only fires if
// someone remembers it. Exists because guessing at a fix without instrumentation has already cost
// this project whole sessions (development-discipline.md §5, the same failure the 3-fix rule in
// fix-cycle-limit.mjs exists to catch on the SECOND, THIRD, FOURTH guess — this rule catches it on
// the very FIRST one, before any guess is even attempted).
//
// REUSE, NOT A SECOND COPY (owner ruling Q2, binding, verbatim): "exit != 0 EXCLUDES exactly grep,
// diff, test, cmp". That classification lives in ONE place —
// scripts/hooks/observers/verification-outcomes.mjs's isAnswerExit(), consumed already at Task 3 —
// which is what decides whether a 'bash_failure' event gets recorded in enforcement-state.mjs at
// all. This rule never re-implements that list; it only ever reads the 'bash_failure' events Task 3
// already produces (lastEvent(db, sessionId, 'bash_failure')). A grep exit 1 therefore never even
// reaches this file as a failure — proven end-to-end in test-hooks-groupb.mjs section 8's
// COUNTER-RED 6, which replays Task 3's own observer rather than re-asserting the exemption list a
// second time.
//
// THE ESCAPE (requirement 2): invoking `superpowers:systematic-debugging` — one minute — after the
// failure clears every subsequent edit, via skill-invoked.mjs's skillInvokedSince() (Task 7),
// exactly the same evidence source brainstorm-before-creative.mjs already depends on for its own
// escape. Once invoked, the skill's own invocation timestamp becomes irrelevant again only when a
// NEW bash_failure event is recorded — this rule always re-derives "since the LAST failure", never
// caches "debugging already happened this session".
//
// THE WINDOW (requirement 4 — stated and justified, not left implicit): 30 MINUTES.
// Reasoning: long enough to cover a realistic debugging investigation — re-reading the failing
// output, running a few diagnostic commands, checking a log — without demanding the skill be
// invoked within seconds of the failure; short enough that a failure from early in a long session
// cannot silently gate an edit on something unrelated hours later. This is the exact number the
// brief's own "simpler and honest" formula names (task-8-brief.md, step 9: "≤ 30 minutes old").
// Exported (not just module-local), same reasoning as fix-cycle-limit.mjs's ATTEMPT_THRESHOLD: a
// future §6.2-style restoration announcer should render the SAME number this rule blocks on, never
// a second hardcoded one that could silently drift.
export const WINDOW_MS = 30 * 60 * 1000;

// RESOLVED-BY-A-PASS — an evidence-based counter-case beyond the brief's own literal formula, named
// explicitly in the brief's requirement 1 ("after the failure was already resolved by a passing
// run, must not trip it"). A 'verification_pass' event (enforcement-state.mjs's
// noteVerificationPass, fired by verification-outcomes.mjs on any full or filtered PASSING
// verification run) timestamped AFTER the last 'bash_failure' means the failure that would
// otherwise gate this edit was already re-run and found passing — the debugging is over, not "about
// to be skipped". This does not re-derive §6.1's own per-target fix-cycle counter (that stays
// fix-cycle-limit.mjs's job) — it only asks "did ANY verification pass happen after the last
// failure", the same coarse signal a human relying on their own memory of "I already reran that and
// it's green" would use. A plain non-verification Bash failure (e.g. `npm install`) has no such
// signal in the store and can only clear via the time window or the skill escape — deliberately
// conservative, per the fail-open contract: no invented "this looks fixed" heuristic for a case the
// store cannot actually prove.
//
// COUNTER-CASES THIS FILE IS BUILT AGAINST (requirement 1 — see test-hooks-groupb.mjs section 8):
//   - no bash_failure event for this session at all -> allow, cheap-state-first (the transcript is
//     never read — proven directly by pointing it at a nonexistent path in that case).
//   - the bash_failure belongs to ANOTHER session -> invisible by construction (lastEvent() is
//     scoped by session_id — no extra code needed for this one).
//   - the bash_failure is older than WINDOW_MS -> allow (staleness backstop).
//   - a verification_pass happened after the bash_failure -> allow (resolved).
//   - systematic-debugging was invoked in the transcript, since the failure -> allow (the escape).
//   - the file being edited is a DIFFERENT file than whatever the failure concerned -> judged on
//     the failure alone, never the path (requirement 1's own instruction) — this rule never reads
//     tool_input.file_path at all, on purpose; it is not part of the decision.
//
// FAIL-OPEN (same contract as every rule in this pipeline, requirement 3): unreadable state,
// unreadable transcript, a missing session_id, or any unexpected exception here all resolve to
// allow — a blocking rule that cannot read its own evidence must never block.
import { openState, lastEvent, normalizeActorId } from '../lib/enforcement-state.mjs';
import { skillInvokedSince } from '../lib/skill-invoked.mjs';

// R-117 / Task 14 FIX: 'bash_failure' is now read PER-ACTOR (normalizeActorId(input.agent_id)),
// not session-wide. This is the exact defect: a dispatched subagent was blocked here over a
// 'bash_failure' event a DIFFERENT, concurrent subagent recorded under the same inherited
// session_id. 'verification_pass' is filtered to the SAME actor for the same reason — an unrelated
// actor's own independent green run is not evidence THIS actor investigated ITS OWN failure (see
// enforcement-state.mjs's module header for the full per-counter table).

const SKILL_RE = /systematic-debugging/;

function degraded(what) {
  return {
    decision: 'allow',
    reason: `§6.4 trigger 2 degraded: ${what} — allowing rather than blocking on unreadable/undeterminable evidence.`,
  };
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }

  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return degraded('no session_id on this call');
  }

  let db;
  try {
    db = openState();
  } catch {
    db = null;
  }
  if (!db) {
    return degraded('enforcement state unreadable (openState() returned null — corrupt/locked/missing store)');
  }

  const actorId = normalizeActorId(input.agent_id);
  let failure;
  let pass;
  try {
    failure = lastEvent(db, sessionId, 'bash_failure', actorId);
    pass = lastEvent(db, sessionId, 'verification_pass', actorId);
  } catch {
    try { db.close(); } catch { /* best-effort */ }
    return degraded('enforcement state unreadable while reading events');
  }
  try { db.close(); } catch { /* best-effort */ }

  // Cheap check first, per the brief's own instruction: nothing open -> allow, and the transcript
  // (an I/O read) is never even touched.
  if (!failure) {
    return {
      decision: 'allow',
      reason: 'no bash_failure event recorded for this session — nothing to debug before this edit',
    };
  }

  const now = Date.now();
  const age = now - failure.ts;
  if (!(age >= 0) || age > WINDOW_MS) {
    const ageMinutes = Number.isFinite(age) ? Math.round(age / 60000) : null;
    return {
      decision: 'allow',
      reason: ageMinutes === null
        ? 'the most recent bash_failure for this session has an unreadable timestamp — treating as stale, allowing.'
        : `the most recent bash_failure for this session is ${ageMinutes} minute(s) old, past the `
          + `${WINDOW_MS / 60000}-minute window this rule treats as "still the current fix" — stale, `
          + 'not an active debugging cycle.',
    };
  }

  if (pass && pass.ts > failure.ts) {
    return {
      decision: 'allow',
      reason: 'a verification_pass event was recorded after the most recent bash_failure — the '
        + 'failure was already re-run and found passing.',
    };
  }

  let skill;
  try {
    // sinceMs windows skillInvokedSince() back exactly to the failure's own timestamp — not the
    // module's own 20-minute default — so a skill invocation before the failure never counts as
    // "since" it, and one after does, regardless of where inside the 30-minute WINDOW_MS it falls.
    skill = skillInvokedSince(input.transcript_path, SKILL_RE, Math.max(age, 1), now, input.agent_id);
  } catch {
    skill = { determined: false, invoked: false };
  }

  if (skill.determined && skill.invoked) {
    return {
      decision: 'allow',
      reason: '§6.4 trigger 2: a systematic-debugging invocation was found in this transcript since '
        + 'the last bash_failure — the required investigation happened before this edit.',
    };
  }
  if (!skill.determined) {
    return degraded('no readable transcript evidence of a skill invocation either way');
  }

  return {
    decision: 'block',
    reason: '§6.4 trigger 2 (development-discipline.md §5 — the exact pattern the 3-fix rule was '
      + 'added to catch on the SECOND guess, this rule catches on the FIRST): a Bash command failed '
      + `(${Math.round(age / 1000)}s ago) and no \`superpowers:systematic-debugging\` invocation has `
      + 'happened since. Blocked. Invoke `superpowers:systematic-debugging` — one minute — before '
      + 'editing to fix a failure; once invoked, this and every subsequent edit is allowed again '
      + 'until a NEW failure.',
  };
}
