// scripts/hooks/rules/fix-cycle-limit.mjs — §5 (systematic-debugging / development-discipline.md
// §5): "after 3 failed fixes, STOP and question the architecture with the owner. Do not attempt
// fix #4." Spec §6 row 1 (Phase 4, Group B) turns that from advice into a BLOCK: counted = closed
// failure→edit→verify cycles on the SAME target (Task 2's enforcement-state.mjs, Task 3's
// classifier); threshold 4; response block + duty to raise to owner. So: when any open target of
// THIS session already has attempts >= 3, the next Edit/Write — which would BEGIN fix cycle 4 — is
// blocked before it happens. This is the placement the spec demands: interception before the
// fourth attempt, not a report after it.
//
// PLACEMENT NOTE (task-4-brief.md): this file lives in the SAME rules/ dir as Group A and
// therefore receives every matched PreToolUse event (Bash, Grep, WebSearch, Agent, browser_navigate,
// Edit, Write — pipeline.mjs's discovery pattern, no dispatcher to edit). Its first line returns
// allow for anything that is not Edit or Write.
//
// RESET PATHS (owner ruling, 2026-08-08, in conversation — task-4-brief.md's Q1, CLOSED):
//   1. A verification pass on the target — enforcement-state.mjs's noteVerificationPass() already
//      deletes the row; the next openTargets() call simply does not see it.
//   2. A new session (a fresh session_id starts with zero rows for any target, by construction —
//      fix_targets is keyed (session_id, target)).
//   3. A documented OWNER ARCHITECTURE DECISION RECORD, modelled on the existing No-lesson
//      declaration `scripts/gate-lessons.mjs` recognises:
//        **No-lesson declaration (YYYY-MM-DD):** <arc> — reason
//      mirrored here as
//        **Owner architecture decision (YYYY-MM-DD):** <target> — <what was decided>
//      living in docs/process/development-discipline.md's §11 area, read fresh off the live
//      document on every call (no caching).
//
// FIX ROUND 1 (review finding, 2026-08-08): the first cut treated this record as a PERMANENT
// exemption keyed only on the target string — once written, §5 was silently disabled for that
// target forever, in every future session. Round 1's fix compared the record's date against the
// target's lastFailureTs on every call, but NEVER WROTE ANYTHING BACK to the store — so "reset"
// was still just a per-call comparison, not an actual zeroing of the counter. Coordinator's own
// reproduction (fix round 2) proved this concretely: a target cleared by a same-day date-only
// record kept clearing every subsequent same-day failure too, because a coarse whole-day cutoff
// cannot distinguish "before the decision" from "after it" within the same day — the record
// functioned as an exemption-until-midnight, not a reset. This is not fixable by comparing
// timestamps more carefully: a bare YYYY-MM-DD has no time-of-day to compare, so "did this decision,
// written today, come before or after a failure ALSO recorded today" is information the format
// cannot express, full stop — no rearrangement of the comparison closes that gap.
//
// FIX ROUND 2 (2026-08-08): the record is now a REAL reset, not a comparison. The FIRST time
// `evaluate()` determines a record validly covers a target's CURRENTLY accumulated failures (same
// date/cutoff check as round 1, deciding whether the record even applies), it calls the store's own
// `noteVerificationPass()` to DELETE that target's row — exactly the same action a genuine passing
// verification run already triggers. From that instant the counter is actually zero: the NEXT
// failure on that target starts a brand-new `fix_targets` row at attempts=0, and reaching the
// 3-fix ceiling again requires 3 GENUINELY NEW closed cycles.
//
// SECOND PIECE, discovered when the FIRST fix round's own reproduction was verified against a live
// coordinator repro rather than assumed correct: a wipe alone is not enough for a DATE-ONLY record.
// Its cutoff is the END of that whole UTC day — which stays in the future relative to EVERY
// same-day failure, so the SAME still-present record would clear a target again, and again, every
// time it re-accumulates 3 fresh cycles that same day. That is not "reset to zero", it is "3 free
// cycles, repeatable all day" — the same defect in a smaller loop. The fix: a given record (its
// exact target+raw-text pair) may validly reset a target AT MOST ONCE per session — tracked as an
// `events` row (`owner_decision_reset`, session-scoped, read fresh every call, no new table). Once
// consumed, that same record can never clear that target again; the deny reason says so explicitly
// and asks for a NEW record (a later date, or a precise time) — which is the literal reading of
// "failures … after D count again from zero": a fresh zero, not a standing daily allowance.
//
// The date/cutoff comparison is still exactly what round 1 built, and still matters — for the
// ONE-TIME decision of whether a given record is even eligible to clear the CURRENTLY open target
// (a record dated before the failures it's meant to excuse, e.g. `2020-01-01`, must never clear
// anything — see the stale-record branch below, unchanged from round 1). It is simply no longer
// re-run forever against a stale counter; once it fires, it fires into an actual wipe.
//
// GRANULARITY, still worth naming even though it no longer causes silent re-exemption: a date-only
// record's cutoff is read as the END of that UTC day (the permissive reading — needed so "the owner
// wrote the record the same day the failures happened" actually clears them). Anyone who wants the
// wipe to happen precisely at a known instant, rather than "sometime today", can use the finer form
// this rule also accepts — `(YYYY-MM-DD HH:MM)` or `(YYYY-MM-DDTHH:MM)` — **parsed as UTC**, not
// local time (fix round 2: stated explicitly here and in the deny reason itself, after an
// undocumented-timezone finding cost the reviewer a wrong conclusion during round-2 verification;
// verified directly against `Date.parse` — a trailing `Z` forces UTC regardless of the host
// machine's own timezone, so this is deterministic across machines and CI, unlike true local-time
// parsing would be).
//
// NEAR-MISS TARGET NAMES: exact-string matching means a typo'd target in the record silently never
// clears the real one. Rather than loosen the match (a fuzzy match risks clearing the WRONG target,
// worse than an over-strict block), the deny reason itself surfaces a near-miss: when no exact
// record exists for the blocked target but a record exists for a SIMILAR target name (small edit
// distance), the reason names it explicitly — "a record exists for X, this block is on Y" is a
// two-second fix instead of a silent, bewildering wall.
//
// FAIL-OPEN (same contract as every Group A/B rule and as enforcement-state.mjs's own module
// header): state unreadable — openState() returns null on a corrupt/locked/missing-permission file
// — must never be read as "there is a block-worthy counter here." It degrades to allow, and the
// reason names the degradation, because a blocking rule that cannot read its own state must never
// block (task-4-brief.md, verbatim). A doc-read failure (missing/unreadable discipline.md) degrades
// to "no records found", never to a thrown error and never to a bypass either.
// RULE_IDS — the rules in the corpus this file ACTUALLY enforces, read by
// scripts/check-rule-coverage.mjs. Declared here rather than as a path column in the store so
// it travels with the file: a stored path goes stale in silence, which is the failure the rules
// register itself exists to prevent. An id absent from the corpus is an ERROR, not an ignored
// field — claiming to enforce something that does not exist is false coverage.
// An observer declares [] EXPLICITLY, so the gate can require the export on every scanned file
// and catch a rule that simply forgot to declare rather than mistaking it for an observer.
export const RULE_IDS = ['5'];

import {
  openState, openTargets, noteVerificationPass, recordEvent, normalizeActorId,
} from '../lib/enforcement-state.mjs';
import { ownerDecisionRecords } from '../lib/owner-decision-records.mjs';

// R-117 / Task 14: §5 fix cycles are PER-ACTOR (task-14-brief, quoting development-discipline.md:
// "two agents debugging different things are not on each other's fourth attempt"). openTargets()
// below is called with an explicit actorId, so this rule only ever sees (and only ever blocks on)
// the SAME actor's own open targets — a concurrent subagent's own cycles on the same or a different
// target are invisible here by construction, exactly like session scoping already was. The owner-
// decision-reset consumption tracking (CONSUMED_EVENT_KIND, below) is scoped the same way: each
// actor's own reset of a target is independent, once each — an owner record naming a target resets
// EVERY actor's own counter for it independently as each actor's evaluate() call encounters it, not
// as one shared reset consumed by whichever actor happens to hit the record first.

// Exported (not just module-local) so §6.2's restored-after-compact announcer
// (scripts/session-state.mjs's enforcementState()) can render "N of 3" from the SAME constant this
// rule blocks on, rather than a second hardcoded "3" that could silently drift out of agreement with
// the actual block threshold (task-5-brief.md: "If your restored announcement says '2 of 3' while the
// rule would block, the announcement is a lie").
export const ATTEMPT_THRESHOLD = 3;
const NEAR_MISS_MAX_DISTANCE_RATIO = 0.2; // see levenshtein()/isNearMiss() below
const NEAR_MISS_MIN_DISTANCE_FLOOR = 2;

// Standard iterative Levenshtein edit distance (no dependency — the strings involved are short
// target ids, so the O(n*m) table is trivially cheap here).
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// FIX ROUND 2, second layer: a date-only record's cutoff is an END-OF-DAY boundary, which stays in
// the future relative to EVERY same-day failure no matter how many times the target re-accumulates
// 3 fresh cycles that same day — so the wipe alone is not enough; the SAME still-present record
// would just clear it again, and again, all day. The missing piece: a given record (identified by
// its exact target+raw-text pair) may validly clear a target AT MOST ONCE per session. Consumption
// is tracked the same way everything else here is — an `events` row, session-scoped, queried fresh
// on every call, never a new table/column on fix_targets itself.
const CONSUMED_EVENT_KIND = 'owner_decision_reset';
function consumedKey(target, raw) {
  return `${target}\x00${raw}`;
}
function consumedRecordKeys(db, sessionId, actorId) {
  const out = new Set();
  try {
    const rows = db.prepare(
      'SELECT detail FROM events WHERE session_id = ? AND kind = ? AND actor_id = ?',
    ).all(sessionId, CONSUMED_EVENT_KIND, actorId);
    for (const row of rows) {
      try {
        const d = JSON.parse(row.detail);
        if (d && typeof d.target === 'string' && typeof d.raw === 'string') {
          out.add(consumedKey(d.target, d.raw));
        }
      } catch {
        // one malformed row must not break reading the rest
      }
    }
  } catch {
    // fail-open: unreadable consumption history means "treat nothing as consumed" — worst case a
    // record clears one extra time, never a false block (same posture as every other read here).
  }
  return out;
}

function isNearMiss(a, b) {
  const dist = levenshtein(a, b);
  if (dist === 0) return false; // exact match is handled separately, not a "near" miss
  const threshold = Math.max(
    NEAR_MISS_MIN_DISTANCE_FLOOR,
    Math.ceil(NEAR_MISS_MAX_DISTANCE_RATIO * Math.max(a.length, b.length)),
  );
  return dist <= threshold;
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }

  const sessionId = input.session_id;
  const actorId = normalizeActorId(input.agent_id);
  const db = openState();
  if (!db) {
    return {
      decision: 'allow',
      reason: 'enforcement state unreadable (openState() returned null — corrupt/locked/missing '
        + 'store) — degrading to allow; a blocking rule that cannot read its own state must never '
        + 'block.',
    };
  }

  let targets;
  try {
    // Task 14 / R-117: filtered to THIS actor's own targets only — a concurrent actor's own §5
    // cycles on any target (same name or not) are invisible here by construction.
    targets = openTargets(db, sessionId, actorId);
  } catch {
    try { db.close(); } catch { /* best-effort */ }
    return {
      decision: 'allow',
      reason: 'enforcement state unreadable while listing open targets — degrading to allow; a '
        + 'blocking rule that cannot read its own state must never block.',
    };
  }

  const overThreshold = targets.filter((t) => t.attempts >= ATTEMPT_THRESHOLD);
  if (overThreshold.length === 0) {
    try { db.close(); } catch { /* best-effort */ }
    return { decision: 'allow', reason: 'no open fix target at or past the §5 3-fix ceiling' };
  }

  const records = ownerDecisionRecords();
  const consumed = consumedRecordKeys(db, sessionId, actorId);

  // A target's CURRENT accumulated failures are validly covered only if an EXACT-name record
  // exists, its cutoff is strictly after the target's most recent recorded failure (a record
  // dated/timed BEFORE the last failure is stale — it does not cover a failure that happened after
  // it was written), AND that exact record has not already been consumed by a PRIOR reset of this
  // exact target this session (see consumedRecordKeys() above — otherwise a date-only record's
  // whole-day cutoff would silently re-clear every fresh batch of cycles all day long).
  //
  // FIX ROUND 2: a target found to be validly covered is not just "allowed this one call" — it is
  // WIPED from the store right here (noteVerificationPass, the exact same action a real passing
  // verification run triggers) AND the record is marked consumed for this target, so the reset is
  // literal and single-use. Every over-threshold target is inspected (not just the first), so a
  // later target in the list still gets its legitimate wipe even when an earlier one in the same
  // call ends up being the one reported as blocked.
  let blocked = null;
  let staleExactRecord = null;
  let consumedExactRecord = null;
  const clearedTargetIds = [];
  const toMarkConsumed = [];
  for (const t of overThreshold) {
    const exact = records.find((r) => r.target === t.target);
    if (exact) {
      const alreadyConsumed = consumed.has(consumedKey(exact.target, exact.raw));
      const covers = t.lastFailureTs < exact.cutoffMs;
      if (!alreadyConsumed && covers) {
        clearedTargetIds.push(t.target);
        toMarkConsumed.push({ target: exact.target, raw: exact.raw });
        continue;
      }
      if (!blocked) {
        blocked = t; // report only the FIRST genuinely-blocked target, matching round-1 behaviour
        if (alreadyConsumed) consumedExactRecord = exact;
        else staleExactRecord = exact;
      }
      continue;
    }
    if (!blocked) blocked = t;
  }

  if (clearedTargetIds.length) {
    try {
      noteVerificationPass(db, sessionId, clearedTargetIds, actorId);
      for (const { target, raw } of toMarkConsumed) {
        recordEvent(db, { sessionId, kind: CONSUMED_EVENT_KIND, detail: { target, raw }, actorId });
      }
    } catch {
      // Best-effort: if the wipe/consumption-marking fails, the SAME valid-record check simply
      // re-runs on the next call — never a false block, never a crash. Worst case a record clears
      // one extra time before its consumption is recorded.
    }
  }
  try { db.close(); } catch { /* best-effort */ }

  if (!blocked) {
    return {
      decision: 'allow',
      reason: clearedTargetIds.length
        ? `no open fix target at or past the §5 3-fix ceiling (${clearedTargetIds.length} target(s) `
          + 'just reset by a dated owner-decision record — the counter for them now starts fresh '
          + 'from zero)'
        : 'no open fix target at or past the §5 3-fix ceiling',
    };
  }

  let resolutionNote;
  if (staleExactRecord) {
    resolutionNote = `Note: a record already exists for this exact target (\`Owner architecture `
      + `decision (${staleExactRecord.raw})\`), but a failure was recorded AFTER it (last failure `
      + `at ${new Date(blocked.lastFailureTs).toISOString()} UTC) — that record no longer covers the `
      + 'current attempts. A reset is point-in-time, not permanent: write a FRESH record dated now '
      + '(or naming a precise time in UTC — `YYYY-MM-DD HH:MM` — for same-day precision) to clear it again.';
  } else if (consumedExactRecord) {
    resolutionNote = `Note: a record already exists for this exact target (\`Owner architecture `
      + `decision (${consumedExactRecord.raw})\`), and it WAS used to reset this target once already `
      + 'this session — a reset applies once, not for the rest of the day. These are NEW fix cycles '
      + 'that accumulated since that reset. Write a NEW record (a later date, or a precise UTC time) '
      + 'to reset it again.';
  } else {
    // Nearest-by-edit-distance record among any that qualify as a near miss, so the reason names
    // the SINGLE most likely typo candidate rather than every vaguely-similar record.
    const nearRecord = records
      .filter((r) => isNearMiss(blocked.target, r.target))
      .sort((a, b) => levenshtein(blocked.target, a.target) - levenshtein(blocked.target, b.target))[0];
    if (nearRecord) {
      resolutionNote = `Note: a record exists for "${nearRecord.target}" (Owner architecture `
        + `decision (${nearRecord.raw})), but this block is on "${blocked.target}" — check for a `
        + 'mismatch/typo between the two target strings before writing a new record.';
    }
  }

  const base = '§5 (development-discipline.md, written after a real failure — W5: three guessed '
    + 'fixes, none preceded by instrumentation, so the 3-fix rule was added to force escalation '
    + 'before a 4th guess): "after 3 failed fixes, STOP and question the architecture with the '
    + `owner. Do not attempt fix #4." Target "${blocked.target}" has already closed ${blocked.attempts} `
    + `fix cycles this session — this edit would begin cycle #${blocked.attempts + 1}. Blocked. `
    + 'Raise the architecture question with the owner instead of trying again; once a decision is '
    + 'reached, append a line of the exact form '
    + `\`**Owner architecture decision (YYYY-MM-DD):** ${blocked.target} — <what was decided>\` `
    + '(or, for same-day precision, `**Owner architecture decision (YYYY-MM-DD HH:MM):** ...` — '
    + 'the time is read as UTC, not local time) '
    + 'to docs/process/development-discipline.md §11 to resume editing on this target. This is a '
    + 'real reset: the very next Edit/Write after a valid record clears this target starts its '
    + 'counter fresh at zero, and reaching the ceiling again needs 3 genuinely new fix cycles.';

  return {
    decision: 'block',
    reason: resolutionNote ? `${base} ${resolutionNote}` : base,
  };
}
