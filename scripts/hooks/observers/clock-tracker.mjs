// scripts/hooks/observers/clock-tracker.mjs — Arc 2 Phase 4, L84. Records ONE `clock_read` event
// per Bash command that actually reads the system clock (`date`, PowerShell's `Get-Date`). This is
// the evidence channel timestamp-without-clock-read.mjs (stop-rules/) checks against: "did a real
// clock read happen in this session recently", mirrored EXACTLY on read-tracker.mjs's own shape
// (same file header reasoning applies here — see that file for the full argument) so a second,
// drifting detector for the same evidence shape is never written (R-116).
//
// WHY BASH ONLY: this repo's own hook wiring (.claude/settings.json) matches PostToolUse only on
// `Bash|Edit|Write|browser_navigate|Read` — the PowerShell tool used in this environment is NOT in
// that matcher list, so a PowerShell tool call never reaches this observer at all. What IS reachable
// is a Bash command that itself invokes `date` (Git Bash / POSIX coreutils, the primary shell here)
// or shells out to PowerShell's `Get-Date` (e.g. `powershell -NoProfile -Command "Get-Date"`). Both
// are checked; a `PowerShell` tool call is out of scope for this observer by construction, not by
// oversight — there is no channel through which it could ever be observed today.
//
// COMMAND POSITION, NOT PROSE (same discipline as bash-segments.mjs's own header, R-133 and
// siblings): a command that merely MENTIONS "date" in an echoed sentence or a comment must not
// count as a clock read. `stripDataRegions()` removes heredoc bodies, quoted text and `#` comments
// before segmenting, so `echo "the date is important"` never matches — only a segment whose OWN
// leading token is the `date` command actually invokes it. `Get-Date` is checked as a real
// command-position token too (case-insensitive: PowerShell cmdlet names are not case-sensitive).
//
// Only a REAL, successful command counts: gated on `_outcome.ok === true` (posttooluse.mjs's
// normalized outcome) — a Bash call that itself failed did not reliably read anything.
export const RULE_IDS = [];

import { openState, recordEvent, normalizeActorId } from '../lib/enforcement-state.mjs';
import { stripDataRegions, segments, tokenize } from '../lib/bash-segments.mjs';

// `date` — POSIX/coreutils clock read, matched as the segment's OWN leading token (so `update`,
// `dated`, `mydate` never match; `date`, `date +%s`, `TZ=UTC date` all do — a leading env-assignment
// token is skipped, same convention lib/bash-segments.mjs callers already use elsewhere).
const ENV_ASSIGNMENT_RE = /^[A-Za-z_]\w*=/;

function leadingCommandToken(seg) {
  const tokens = tokenize(seg);
  let i = 0;
  while (i < tokens.length && ENV_ASSIGNMENT_RE.test(tokens[i])) i += 1;
  return tokens[i];
}

// `Get-Date` also checked ANYWHERE in the raw (unstripped) command text, not just as a leading
// token: real use here is a PowerShell invocation shelled out through Bash
// (`powershell -Command "Get-Date"`), where the actual cmdlet sits inside a quoted -Command
// argument that stripDataRegions() would otherwise blank. This is not "prose describing a
// pattern" (the case stripDataRegions guards against) — it is the literal text that gets executed
// when the outer command runs, so masking it would hide a real clock read, not a false one.
const GET_DATE_RE = /\bGet-Date\b/i;

export function observe(input) {
  if (!input || input.tool_name !== 'Bash') return;
  if (!input._outcome || input._outcome.ok !== true) return; // a failed command read nothing reliably

  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return;
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || !command) return;

  let matched = GET_DATE_RE.test(command);
  if (!matched) {
    const stripped = stripDataRegions(command);
    for (const seg of segments(stripped)) {
      const lead = leadingCommandToken(seg);
      if (lead === 'date') { matched = true; break; }
    }
  }
  if (!matched) return;

  const db = openState();
  if (!db) return; // fail-open — no store, nothing recorded
  try {
    recordEvent(db, {
      sessionId,
      kind: 'clock_read',
      detail: { command: command.slice(0, 200) },
      actorId: normalizeActorId(input.agent_id),
    });
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
