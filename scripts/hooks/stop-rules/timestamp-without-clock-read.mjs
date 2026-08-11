// scripts/hooks/stop-rules/timestamp-without-clock-read.mjs — Arc 2 Phase 4, L84 (owner
// instruction, 2026-08-11): "I do want timestamps on reports -- if needed, build a gate for it."
//
// THE INCIDENT (L84's own text, quoted in full there): the controller wrote a clock time into a
// status report as an ESTIMATE presented as a FACT, twice -- "16:40" when the clock read 16:27,
// and "09:15" when it read 09:09. A written promise to always read the clock did not change the
// behavior; the second slip landed the very next morning. Every other standing rule in this
// project has a mechanism behind it; the timestamp had none, which is exactly why the promise did
// not hold on its own.
//
// SAME SHAPE AS L63a, DELIBERATELY REUSED (R-116): "a report cites/asserts a specific fact -- did
// the SESSION actually produce that fact through a real tool call, or is it from memory/estimate."
// L63a checks a cited path against `file_read`/`edit` events; this rule checks a clock-shaped
// digit timestamp against `clock_read` events (scripts/hooks/observers/clock-tracker.mjs). Same
// evidence-store functions (openState/recentEvents), same L57 degrade-on-unwired-channel guard,
// same warn-first severity discipline as every other Phase-4 rule shipped this way
// (cited-path-read.mjs, L23a, L64a) -- owner ruling for the whole phase: warn, measure, promote
// only on evidence.
//
// SEVERITY: WARN (owner ruling, this task's own brief). A `stop` block prevents the assistant from
// answering the owner at all; warn surfaces the gap without silencing the reply. Reachable
// alternative (SS10.24): read the clock now (`date` / `Get-Date`), then report the real reading.
//
// THE GUARD THAT MAKES FIRING SAFE (the L57 trap, same reasoning as cited-path-read.mjs's own
// header): "zero clock_read rows for this session" is indistinguishable from "the observer channel
// is broken/unwired/expired (24h TTL)". A session with ZERO clock_read rows therefore DEGRADES TO
// ALLOW -- this rule only ever fires on a TARGETED absence inside a channel provably recording.
// This is what keeps the corpus replay honest: every historical message replays against a fresh,
// empty store (no clock_read rows ever existed for it), so fireCount == 0 there PROVES the
// degraded path, not the firing path -- the firing path is proven separately, by seeding a real
// clock_read event through the real enforcement-state module (same split L63a's own report used).
//
// TIMESTAMP SHAPE: a 24-hour HH:MM digit pair (`16:40`, `09:15`) -- the exact shape both real
// slips used, and the shape this project's own status reports write clock times in. Digits are
// \w characters in JS regex regardless of surrounding script, so a plain `\b` boundary is correct
// here (unlike SUBORDINATOR_RE's Hebrew-letter problem, R-141 -- this pattern never touches a
// Hebrew letter itself, only ASCII digits and a colon).
//
// MASKING: quoted/fenced prose is never claim-bearing (maskQuotedProse, R-133 and siblings) -- a
// timestamp appearing only inside a pasted log or a quoted example is not the assistant's own
// current-time assertion.
export const RULE_IDS = ['L84'];

import { lastAssistantText, maskQuotedProse, EVIDENCE_WINDOW_MS } from '../lib/claim-scan.mjs';
import { openState, recentEvents } from '../lib/enforcement-state.mjs';

// 2-digit-hour:2-digit-minute, 24h range only -- "16:40", "09:15". Deliberately NOT loosened to a
// single-digit hour ("9:15"): both real slips this rule exists to catch used a leading zero, and a
// tighter pattern is measurably less likely to catch an unrelated two-number ratio in ordinary
// prose. Measured against the real corpus before any widening is considered (see report).
export const CLOCK_TIMESTAMP_RE = /\b([01]\d|2[0-3]):[0-5]\d\b/;

function degraded(what) {
  return { decision: 'allow', reason: `L84 degraded: ${what} -- allowing rather than warning on unreadable/undeterminable evidence.` };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') return degraded('no input');
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return degraded('no session_id on this Stop event');

  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) return degraded('no readable assistant reply text');

  const masked = maskQuotedProse(text);
  if (!CLOCK_TIMESTAMP_RE.test(masked)) {
    return { decision: 'allow', reason: 'no clock-shaped timestamp in the final reply -- L84 does not apply.' };
  }

  const db = openState();
  if (!db) return degraded('enforcement state store unavailable');
  let allReads;
  let recentReads;
  try {
    allReads = recentEvents(db, sessionId, 'clock_read', 0);
    recentReads = recentEvents(db, sessionId, 'clock_read', Date.now() - EVIDENCE_WINDOW_MS);
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (!Array.isArray(allReads) || allReads.length === 0) {
    return degraded('zero clock_read rows for this session -- an empty channel is indistinguishable from an unwired one (L57), never treated as "did not read the clock"');
  }

  if (Array.isArray(recentReads) && recentReads.length > 0) {
    return { decision: 'allow', reason: 'a real clock read (date/Get-Date) was recorded recently this session -- L84 satisfied.' };
  }

  return {
    decision: 'warn',
    reason: 'L84: the final reply carries a clock-shaped timestamp, but no clock read (date/Get-Date) '
      + 'was recorded in this session within the last '
      + `${Math.round(EVIDENCE_WINDOW_MS / 60000)} minutes. A timestamp with no clock read behind it is `
      + 'an estimate wearing a fact\'s clothes -- read the clock now (date / Get-Date), then report the '
      + 'real reading, or drop the timestamp.',
  };
}
