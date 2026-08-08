// scripts/hooks/observers/verification-outcomes.mjs — Phase 4, Group B, Task 3. Feeds §6.1's
// fix-cycle counter (via Task 2's noteVerificationFailure/noteVerificationPass) and §10.16's
// session-failure total (via a plain 'verification_failure' event with target '(unattributed)').
// Also two smaller, independent-of-§6.1 event kinds carried by the same Bash observer per the
// brief: 'bash_failure' (feeds Task 8) and 'commit' (feeds Task 6) — both recorded alongside, not
// instead of, the verification bookkeeping above.
//
// Record-only, per the task instructions: this file NEVER denies anything — PostToolUse/
// PostToolUseFailure cannot deny (the tool already ran), and even if they could, blocking is
// Task 4's job, not this one's. Every branch below is wrapped so a throw here cannot disturb the
// tool call it is observing (posttooluse.mjs's runObservers() already catches observer throws, but
// this file also guards its own openState()/db.close() per the fail-open discipline every other
// Group B file follows).
import {
  openState, noteVerificationFailure, noteVerificationPass, recordEvent, openTargets, ALL,
  normalizeActorId,
} from '../lib/enforcement-state.mjs';
import { classifyCommand, extractFailingTargets } from '../lib/verification-target.mjs';

// Task 14 / R-117: this observer is where 'bash_failure' — the literal defect — gets written. It
// is now recorded WITH actorId (input.agent_id, normalized), so debugging-before-fix-edit.mjs can
// filter to the SAME actor whose Bash command actually failed, instead of seeing every concurrent
// actor's failures as its own. The §5 fix_targets bump (noteVerificationFailure) and the §5-reset
// clear (noteVerificationPass) are likewise scoped to the acting actor — each actor's own passing
// run only clears ITS OWN tracked cycles. The 'verification_failure' EVENT and the 'commit' EVENT
// stay session-wide (no actor filter on read) — see enforcement-state.mjs's module header for why
// each of these was decided the way it was, one at a time.

// Same segment/token approach as scripts/hooks/rules/main-only-no-worktrees.mjs (comment there
// explains the shell-separator and quoting choices in full) — reused here for two unrelated
// decisions that both need "what is the leading word of the command that actually ran": the
// answer-exit exemption list, and git-commit detection.
const SEGMENT_SPLIT = /(?:&&|\|\||[;\n]|\|(?!\|))/g;
function segments(command) {
  return command.split(SEGMENT_SPLIT).map((s) => s.trim()).filter(Boolean);
}
function tokenize(seg) {
  const matches = seg.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((t) => {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  });
}

// OWNER RULING Q2 (binding, given verbatim to this task, narrower than an earlier brief draft that
// also listed rg/findstr/which): exit != 0 counts as a bash_failure event EXCEPT for these four
// tools, because their nonzero exit is an ANSWER (a finding — "no match", "files differ", "pattern
// not found") and not a failure of the tool itself. Implemented exactly this list, no wider.
const ANSWER_EXIT_TOOLS = new Set(['grep', 'diff', 'test', 'cmp']);

// The exemption is decided by the LAST segment's leading word — the segment whose exit code a
// shell's `;`/`&&`-joined command line actually surfaces as ITS OWN exit code in the ordinary case
// this module needs to handle (a bare answer-tool invocation, e.g. `grep -q foo file`).
function isAnswerExit(command) {
  const segs = segments(command);
  if (segs.length === 0) return false;
  const tokens = tokenize(segs[segs.length - 1]);
  return tokens.length > 0 && ANSWER_EXIT_TOOLS.has(tokens[0]);
}

const VALUE_TAKING_GLOBAL_OPTS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
function gitSubcommand(tokens) {
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    i += VALUE_TAKING_GLOBAL_OPTS.has(tokens[i]) ? 2 : 1;
  }
  return tokens[i];
}
function isGitCommitCommand(command) {
  for (const seg of segments(command)) {
    const tokens = tokenize(seg);
    if (tokens.length > 0 && tokens[0] === 'git' && gitSubcommand(tokens) === 'commit') return true;
  }
  return false;
}

// Best-effort read of whether a verification command named a specific filter/target, so a PASSING
// run can clear only what it actually covered instead of every open target in the session (which
// would be an OVER-clear — a target this run never touched would wrongly show as fixed). Returns
// { suiteWide, filterText }. `filterText === null` with `suiteWide === false` means "this command is
// scoped somehow (a flag like -k/--grep) but not to an identifiable path/nodeid" — deliberately
// left as a no-op by the caller rather than guessed at (under-clear, never over-clear).
function commandScope(runner, command) {
  if (runner === 'node-test') {
    // run-all.mjs always runs every check file -> suite-wide. A single check-*.mjs/test-*.mjs
    // invocation is inherently scoped to exactly that one file by construction (there is no CLI
    // filter syntax for these harnesses), but its FAIL-label targets carry no filename of their
    // own to correlate against — so there is nothing here this module can safely match. No-op.
    return { suiteWide: /run-all\.mjs/.test(command), filterText: null };
  }
  const m = runner === 'pytest'
    ? command.match(/pytest\s+(.*)$/)
    : runner === 'playwright'
      ? command.match(/playwright\s+test\s*(.*)$/)
      : null;
  const rest = (m && m[1]) ? m[1].trim() : '';
  const positional = tokenize(rest).filter((t) => !t.startsWith('-'));
  return { suiteWide: positional.length === 0, filterText: positional[0] || null };
}

export function observe(input) {
  if (!input || input.tool_name !== 'Bash') return;

  const sessionId = input.session_id;
  const command = input.tool_input && input.tool_input.command;
  if (typeof sessionId !== 'string' || !sessionId) return;
  if (typeof command !== 'string' || command.trim() === '') return;

  const outcome = input._outcome || {};
  const actorId = normalizeActorId(input.agent_id);

  const db = openState();
  if (!db) return; // fail-open — no state store, nothing recorded
  try {
    const { isVerification, runner } = classifyCommand(command);

    if (isVerification && outcome.ok === false) {
      // The failure path's actual output lives in `_outcome.raw_error` — PostToolUseFailure
      // carries no `tool_response`/stdout at all (measured; see verification-target.mjs's header).
      const outputText = typeof outcome.raw_error === 'string' ? outcome.raw_error : '';
      const targets = extractFailingTargets(runner, outputText);
      if (targets.length > 0) {
        noteVerificationFailure(db, sessionId, targets, actorId);
      } else {
        // Unparseable output on a failed verification: counted toward §10.16's session-failure
        // total via the plain event below, but NEVER attributed to a per-target fix-cycle counter
        // — an unattributed failure must not be able to block a real edit. Session-wide by design
        // (see module header) — actorId still attached for audit, never filtered on read.
        recordEvent(db, {
          sessionId,
          kind: 'verification_failure',
          detail: { target: '(unattributed)', runner },
          actorId,
        });
      }
    } else if (isVerification && outcome.ok === true) {
      const { suiteWide, filterText } = commandScope(runner, command);
      if (suiteWide) {
        noteVerificationPass(db, sessionId, ALL, actorId);
      } else if (filterText) {
        const normalizedFilter = filterText.replace(/\\/g, '/');
        const matched = openTargets(db, sessionId, actorId)
          .map((t) => t.target)
          .filter((t) => t.replace(/\\/g, '/').includes(normalizedFilter));
        noteVerificationPass(db, sessionId, matched, actorId); // [] is a safe, documented no-op
      }
      // suiteWide=false and filterText=null (e.g. `-k expr`, `--grep foo`): nothing identifiable
      // to clear — intentionally no-op, see commandScope's comment.
    }

    // R-117 / Task 14's actual fix: 'bash_failure' now carries the ACTING actor's own id, so
    // debugging-before-fix-edit.mjs can filter to it instead of seeing every concurrent actor's
    // failures under the shared session_id.
    if (outcome.ok === false && !isAnswerExit(command)) {
      recordEvent(db, { sessionId, kind: 'bash_failure', detail: { command: command.slice(0, 200) }, actorId });
    }

    // 'commit' stays session-wide by design (see module header) — actorId attached for audit only.
    if (outcome.ok === true && isGitCommitCommand(command)) {
      recordEvent(db, { sessionId, kind: 'commit', detail: { command: command.slice(0, 200) }, actorId });
    }
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
