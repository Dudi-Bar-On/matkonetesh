// scripts/hooks/stop-rules/live-url-verified.mjs -- Phase 4, Group B, Task 11. development-
// discipline.md section 10.10: "a push is not a release." Never tell the owner a version is live
// until Playwright has actually visited the live URL and read `.foot-stamp` -- a push succeeding is
// not evidence of what is currently served; Cloudflare Pages takes minutes to roll a build out, which
// is exactly why section 10.10 says POLL, do not assume. Spec section 6 row 5, severity BLOCK (unlike
// Task 10's WARN: telling the owner a stale or never-checked URL is "live" is the exact failure mode
// this rule exists to make structurally impossible, not just discouraged).
//
// WHY BLOCK AND NOT WARN, UNLIKE THE SIBLING RULE: ui-playwright-before-done.mjs (Task 10) warns
// because a stale-UI-check claim costs a wasted look -- annoying, not harmful. A live-claim with no
// probe is different in kind: the owner acts on "it is live" (tells a customer, closes a task, stops
// watching the deploy) and Cloudflare Pages' own multi-minute rollout window means "I pushed" and "it
// is live" are frequently NOT the same fact yet. Section 10.10 itself uses the word "never" ("Never
// tell the owner a version is live until Playwright has verified..."), which is the block-severity
// vocabulary this arc's own severity rule (section 6, "block is reserved for losing a capability with
// no equivalent path") is written around -- and per section 10.24 (named in the brief) every block
// must carry a reachable escape, which this one does verbatim: `node scripts/live-smoke.mjs`.
//
// THE SAME-RELEASE REQUIREMENT (brief's own decision point 1, the one that decides whether this
// survives review): a probe from an hour ago proves nothing about a push made five minutes ago --
// Cloudflare Pages' rollout window is exactly why a STALE probe cannot license a fresh claim. This
// rule's answer is a single 30-minute freshness window applied to the newest `live_probe` event for
// THIS session (Task 10's observer, `session-events.mjs`, already records one on a real
// `browser_navigate` to the live host or a `node scripts/live-smoke.mjs`/`curl <live host>` Bash
// call) -- no probe within the last 30 minutes, counted from NOW (the Stop event's own firing time,
// which is as close as this rule can get to "when the claim was made"), is treated exactly the same
// as no probe at all. This is deliberately the SAME clock the escape hatch measures against: the
// instant a real probe lands, the very next Stop's evaluate() sees it as fresh, and the instant 30
// minutes pass with no new probe, the gate re-arms itself -- no permanent state can hold this gate
// shut, and no permanent state can hold it open either. The window is bounded in BOTH directions on
// purpose (a probe from this morning does not license an afternoon claim about a NEW push, AND it
// doubles as the staleness backstop the brief names explicitly) -- one number, two jobs, instead of a
// "was there ever a probe" flag that a stale morning probe could satisfy forever.
//
// SESSION SCOPING IS FREE, NOT A SEPARATE CHECK: enforcement-state.mjs's lastEvent() is already keyed
// by session_id (see that module's own header: "a dead/other session's rows are invisible to a live
// session's queries by construction, not by a liveness check") -- so "another session's probe must not
// license this session's claim" (brief's own counter-case) falls out of the existing query shape with
// no extra code here. R-117 (dispatched subagents sharing a session_id, registered separately, NOT
// this task's to fix) is the one known exception to that isolation; it is a hazard to be aware of
// while debugging, not something this file works around.
//
// COUNTER-CASES (brief's own acceptance table):
//   - "I pushed" (no live-claim wording at all) -> SILENT. detectsLiveClaim() only matches phrasing
//     that asserts a LIVE state ("live", "באוויר", "מהדורה N חיה/עלתה", "is live", "deployed and live"),
//     never on the mere fact of a push having happened.
//   - quoting section 10.10 itself, or discussing a PAST release in the abstract -> the claim-scan
//     regex is deliberately narrow (see claim-scan.mjs's own header on false positives being "the
//     whole risk"); LIVE_CLAIM_RE requires the live-state phrasing to actually appear, which prose
//     ABOUT the rule or a historical release mention can still trigger if it happens to contain the
//     same words -- accepted risk, identical to every other claim-scan consumer in this arc, and why
//     the escape (a real probe) always stays one command away rather than trying to out-guess intent.
//   - a live claim that FOLLOWS a real successful probe (fresh, this session) -> SILENT, expected: the
//     rule is only supposed to react to the ABSENCE of verification, not to the presence of a claim.
//
// FAIL-OPEN, THE SAME CONTRACT AS EVERY RULE IN THIS ARC: missing input, missing session_id, an
// unreadable transcript, or an unopenable state store all resolve to allow -- a blocking rule that
// cannot read its own evidence must never block (doubly true for BLOCK severity: a false block here
// stops the owner's own conversation on a rule that could not actually determine anything).
// RULE_IDS — the rules in the corpus this file ACTUALLY enforces, read by
// scripts/check-rule-coverage.mjs. Declared here rather than as a path column in the store so
// it travels with the file: a stored path goes stale in silence, which is the failure the rules
// register itself exists to prevent. An id absent from the corpus is an ERROR, not an ignored
// field — claiming to enforce something that does not exist is false coverage.
// An observer declares [] EXPLICITLY, so the gate can require the export on every scanned file
// and catch a rule that simply forgot to declare rather than mistaking it for an observer.
export const RULE_IDS = ['10.10', 'L14'];

// L14 (Arc 2 Phase 4 decision, made explicitly): L14's own text DERIVES §10.10 from the v255
// incident, and its registered mechanism target is "responses claiming a version is live /
// released" — exactly this rule's trigger and evidence channel. A second detector for the same
// claim shape is R-116. L14's clause (b) ("when the owner reports 'I don't see it', check the
// simplest external explanation first") is judgment-shaped with no mechanical trigger; the
// registered enforceable half is clause (a), which this rule IS. The ~75% false-alarm rate that
// deferred this rule was repaired in the same phase: claim detection now runs on masked prose
// (maskQuotedProse — quoted §10.10 text no longer fires) and LIVE_CLAIM_RE requires a
// version/release context with a sentence-level negation guard (bare "באוויר" — the H8 phrase
// "אין פריט באוויר" — no longer fires). Measured before/after on the real corpus: numbers in
// the Task 6 report, docs/superpowers/plans/2026-08-11-arc2-phase4-stop.md.

import { lastAssistantText, detectsLiveClaim } from '../lib/claim-scan.mjs';
import { openState, lastEvent } from '../lib/enforcement-state.mjs';

// Same formula as verify-before-success-claim.mjs's WINDOW_MS / debugging-before-fix-edit.mjs's own
// window: long enough to cover a probe that ran a few turns before the claiming reply (Cloudflare
// Pages' own rollout can take several minutes, per section 10.10), short enough that a probe from
// earlier in a long session cannot silently license an unrelated claim made much later -- and, per
// this file's own header, this SAME number is also the staleness backstop in the other direction.
export const WINDOW_MS = 30 * 60 * 1000;

export const ESCAPE_TEXT = 'Run `node scripts/live-smoke.mjs` (or browser_navigate '
  + 'https://matkonetesh.pages.dev and read `.foot-stamp`), then say it. Cloudflare Pages takes '
  + 'minutes — poll, do not assume.';

export const BLOCK_REASON = '§10.10: a push is not a release — הטענה \'חי\' דורשת בדיקה של ה-URL החי. '
  + ESCAPE_TEXT;

function degraded(what) {
  return {
    decision: 'allow',
    reason: `§10.10 degraded: ${what} -- allowing rather than blocking on unreadable/undeterminable evidence.`,
  };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return degraded('no input');
  }

  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return degraded('no session_id on this Stop event');
  }

  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return degraded('no readable assistant reply text found in this transcript');
  }

  if (!detectsLiveClaim(text)) {
    return { decision: 'allow', reason: 'no live-claim phrasing detected in the final reply' };
  }

  const db = openState();
  if (!db) {
    return degraded('enforcement state store unavailable');
  }
  let probe;
  try {
    probe = lastEvent(db, sessionId, 'live_probe');
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (!probe) {
    return { decision: 'block', reason: BLOCK_REASON };
  }

  const now = Date.now();
  if (now - probe.ts > WINDOW_MS) {
    return { decision: 'block', reason: BLOCK_REASON };
  }

  return {
    decision: 'allow',
    reason: 'a live claim is present but a live_probe was recorded for this session within the last '
      + '30 minutes — the claim is backed by an actual check of the live URL.',
  };
}
