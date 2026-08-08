// scripts/hooks/observers/session-events.mjs — Phase 4, Group B, Task 10. Task 3's own header
// comment on edit-tracker.mjs names this file explicitly ("Only counts a REAL edit... UI_BASENAMES
// / 'ui_edit' feeds Task 10 (not built yet)") — this is that task, and it is deliberately a
// SEPARATE observer file rather than an addition to edit-tracker.mjs/verification-outcomes.mjs:
// those two are scoped to §6.1's fix-cycle bookkeeping; this one answers a different question
// entirely (§10.2 — "did Playwright actually run, and did a live probe happen"), so it gets its own
// file per posttooluse.mjs's own design (one broken observer must never silence another; keeping
// unrelated concerns in unrelated files is what makes that isolation meaningful in practice, not
// just in principle).
//
// TWO EVENT KINDS, RECORD-ONLY (same discipline as every Group B observer — this file never denies
// anything; it feeds ui-playwright-before-done.mjs, the Stop-hook rule that reads what it records):
//
//   'playwright_run' — recorded on ANY Bash command Task 3's classifyCommand() (verification-
//   target.mjs, REUSED here rather than re-implemented — the brief's own explicit warning: "a
//   second copy of that classification drifting apart is a defect this repo has already paid for")
//   identifies as runner:'playwright'. Recorded regardless of PostToolUse vs PostToolUseFailure —
//   i.e. regardless of whether the run passed or failed. This is deliberate, per the brief's own
//   wording: "pass or fail, a run is a run: §10.2 asks 'did Playwright RUN', the pass/fail axis
//   belongs to §6.1" (verification-outcomes.mjs's job, not this file's) — a red Playwright run still
//   proves the UI was actually driven, which is the one fact §10.2 cares about.
//
//   'live_probe' — recorded on either of two real signals that the DEPLOYED site was checked
//   (feeds Task 11's §10.10 rule too, per the brief): a `browser_navigate` MCP tool call whose
//   `tool_input.url` contains the live host, or a Bash command that runs
//   `node scripts/live-smoke.mjs` (live-smoke.mjs's own default --url IS the live host — see its
//   header — so no explicit URL text is required in the command for THAT invocation) or a `curl`
//   command that explicitly names the live host in its command text (curl has no such default, so
//   the host must appear literally).
//
// HOST STRING: 'matkonetesh.pages.dev' — the repo folder is spelled "matconetesh" but the actual
// Cloudflare Pages deployment (and scripts/live-smoke.mjs's own default --url) is "matkonetesh";
// this file follows the real deployed host, not the repo folder name.
//
// FAIL-OPEN, SAME CONTRACT AS edit-tracker.mjs / verification-outcomes.mjs: a missing session_id, a
// missing/unopenable state store, or any unexpected shape all resolve to "record nothing" — this
// observer must never throw (posttooluse.mjs's runObservers() already catches a throw, but this
// file also guards its own openState()/db.close() per the fail-open discipline every other Group B
// file follows).
import { openState, recordEvent } from '../lib/enforcement-state.mjs';
import { classifyCommand } from '../lib/verification-target.mjs';

const LIVE_HOST_RE = /matkonetesh\.pages\.dev/;
const LIVE_SMOKE_CMD_RE = /node\s+scripts[\/\\]live-smoke\.mjs\b/;
const CURL_CMD_RE = /(^|\s)curl(\s|$)/;

// Determines the event kind (or null) for one observed tool call. Pure/no I/O, kept separate from
// observe() so the classification itself is unit-testable without a real state store.
export function classifySessionEvent(input) {
  if (!input || typeof input.tool_name !== 'string') return null;

  if (input.tool_name === 'Bash') {
    const command = input.tool_input && input.tool_input.command;
    if (typeof command !== 'string' || command.trim() === '') return null;

    const { runner } = classifyCommand(command);
    if (runner === 'playwright') return 'playwright_run';

    if (LIVE_SMOKE_CMD_RE.test(command)) return 'live_probe';
    if (CURL_CMD_RE.test(command) && LIVE_HOST_RE.test(command)) return 'live_probe';
    return null;
  }

  if (input.tool_name.includes('browser_navigate')) {
    const url = input.tool_input && input.tool_input.url;
    if (typeof url === 'string' && LIVE_HOST_RE.test(url)) return 'live_probe';
    return null;
  }

  return null;
}

export function observe(input) {
  if (!input) return;
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return;

  const kind = classifySessionEvent(input);
  if (!kind) return;

  const db = openState();
  if (!db) return; // fail-open — no state store available, nothing recorded
  try {
    recordEvent(db, {
      sessionId,
      kind,
      detail: kind === 'playwright_run'
        ? { command: (input.tool_input && input.tool_input.command || '').slice(0, 200) }
        : { source: input.tool_name },
    });
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
