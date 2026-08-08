// scripts/hooks/stop-rules/ui-playwright-before-done.mjs -- Phase 4, Group B, Task 10. Section 10.2
// (development-discipline.md): "A feature is not verified until seen working in the UI. A green
// assertion alone is not evidence." Spec section 6 row 4, severity WARN -- never block (owner's own
// severity rule: block is reserved for losing a capability with no equivalent path; a stale-UI-
// check claim costs a wasted look, the same class stale-dev-server.mjs (section 11a) already treats as
// warn, not the same class as e.g. losing the ability to edit a file at all).
//
// WHAT COUNTS AS "UI" AND WHY: this project builds a single-file PWA via build.py, inlining
// app.js + app.css (+ index.html's own markup) into dist/index.html -- those are the only files
// whose content a user can actually SEE differently after an edit. scripts/, tests/, docs/, and
// .superpowers/ can all change extensively without moving a single rendered pixel. This rule does
// not re-derive that boundary: it reads the SAME UI_BASENAMES classification edit-tracker.mjs
// (Task 3) already applies when it records the 'ui_edit' event this rule consumes -- one boundary,
// defined once, consumed by both the writer and the reader of the same event kind.
//
// THE FOUR COUNTER-CASES ARE THE WHOLE POINT (brief requirement 2 -- restated here because they are
// literally the acceptance criteria, not just documentation):
//   1. claim + a Playwright run at/after the last UI edit -> SILENT. The very thing section 10.2 asks for
//      already happened; nagging here would be exactly the "block on the honest case" mistake
//      verify-before-success-claim.mjs's own header warns against for Trigger 3.
//   2. claim with NO ui_edit this session at all -> SILENT. Nothing UI was touched -- there is
//      nothing for Playwright to have verified, so the section 10.2 sentence does not even apply.
//   3. a UI edit with NO claim -> SILENT (this rule never even reaches the ui_edit/playwright_run
//      lookup -- detectsSuccessClaim() is checked FIRST). Editing is not asserting; section 11a already
//      forbids running the suite casually, and firing on every UI edit would nag someone who
//      simply has not finished the change yet.
//   4. a non-UI edit -> SILENT, for free: edit-tracker.mjs only ever records 'ui_edit' for
//      app.js/app.css/index.html (UI_BASENAMES), so a scripts/hooks/* edit never produces the event
//      this rule looks for in the first place -- no special-casing needed here.
//
// WARN SURFACING FROM Stop, MEASURED AGAINST toStopOutput() (stop.mjs, Task 9): a Stop hook's
// output shape is NOT the same as PreToolUse's -- pretooluse.mjs's rules speak allow/warn/block and
// warn is carried as a `systemMessage` on PreToolUse's own translation; stop.mjs's toStopOutput()
// mirrors that exact same three-way mapping for Stop (`warn` -> `{ systemMessage: reason }`,
// verified by that file's own docstring and by Section 9's unit test of toStopOutput() itself) --
// so returning `{ decision: 'warn', reason }` from evaluate() here reaches the user as a
// systemMessage, with NO `decision` field on the wire (only 'block' ever sets `decision`). This
// rule relies on that existing, already-tested translation; it does not reimplement it.
//
// STOP-RULES/ DEFAULT DEPENDENCY: as of this task, stop.mjs's own DEFAULT_STOP_RULES_DIR already
// points at scripts/hooks/stop-rules/ unconditionally (STOP_RULES_DIR is now a test-only override
// ON TOP of that default, not a requirement for this directory to be scanned at all -- confirmed by
// reading stop.mjs directly, "FIX ROUND 1" comment, before writing this file). This rule does NOT
// depend on a future fix landing; the directory is live today.
//
// FAIL-OPEN, SAME CONTRACT AS EVERY RULE IN THIS ARC: a missing session_id, an unreadable
// transcript, or an unopenable state store all resolve to allow -- this rule must never block (it
// isn't even ALLOWED to, per the spec's own severity, but "cannot determine" must still never be
// silently treated as "warn" either -- a warn the rule cannot actually justify is still noise).
import { lastAssistantText, detectsSuccessClaim } from '../lib/claim-scan.mjs';
import { openState, lastEvent } from '../lib/enforcement-state.mjs';

const WARNING_TEXT = '\u00a710.2: \u05e7\u05d5\u05d3 UI \u05e0\u05e2\u05e8\u05da \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e8\u05d9\u05e6\u05d4 \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4 \u05e9\u05dc Playwright \u2014 a feature is not '
  + "verified until seen working in the UI; run the suite or drive the app before '\u05d1\u05d5\u05e6\u05e2'.";

function degraded(what) {
  return { decision: 'allow', reason: `\u00a710.2 degraded: ${what} -- allowing rather than warning on unreadable/undeterminable evidence.` };
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

  if (!detectsSuccessClaim(text)) {
    return { decision: 'allow', reason: 'no success-claim phrasing detected in the final reply' };
  }

  const db = openState();
  if (!db) {
    return degraded('enforcement state store unavailable');
  }
  let uiEdit;
  let playwrightRun;
  try {
    uiEdit = lastEvent(db, sessionId, 'ui_edit');
    playwrightRun = lastEvent(db, sessionId, 'playwright_run');
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (!uiEdit) {
    return { decision: 'allow', reason: 'a success claim is present but no UI edit (app.js/app.css/index.html) was recorded this session -- nothing to verify against.' };
  }

  if (playwrightRun && playwrightRun.ts >= uiEdit.ts) {
    return { decision: 'allow', reason: 'a Playwright run was recorded at or after the last UI edit -- the claim is backed by an actual run.' };
  }

  return { decision: 'warn', reason: WARNING_TEXT };
}