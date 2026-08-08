// scripts/hooks/rules/lessons-before-commit.mjs — spec §6.3 / §10.16, the lessons-at-commit gate
// (task-6-brief.md). `gate-lessons.mjs` knew only the `release(vNNN)` scope: an entire arc of
// ordinary work could close with zero lessons and that gate stayed green throughout. This rule adds
// the commit-time trigger §6.3 names explicitly:
//
//   at `git commit`:  failures recorded THIS SESSION (since its last commit event) > 0
//               AND:  no lesson (`**L<n> ·`) and no no-lesson declaration ADDED since that commit
//               =>    BLOCK
//
// OWNER RULING (Q4, binding, task-6-brief.md — implemented verbatim, not widened/narrowed per §4):
// failures are counted SINCE THE LAST COMMIT EVENT IN THIS SESSION, not "all failures this session".
// The literal per-session-total reading would permanently re-block every later commit of a session
// whose earlier failures were already covered once — exactly the trap spec §2.2 forbids. So:
//   failuresSinceLastCommit = eventCountSince(db, sessionId, 'verification_failure',
//                                              lastEvent(db, sessionId, 'commit')?.ts ?? 0)
// A session with NO prior commit event counts from 0 (session start) — its first commit is judged
// against everything that happened before it, which is the correct reading of "since the last commit
// event" when there isn't one yet.
//
// ALL THE PURE DECISION LOGIC lives in scripts/gate-lessons.mjs's exported `sessionLessonGate()` —
// this file's only job is to (1) recognise a `git commit` Bash invocation, (2) gather the two real
// inputs that function needs (failure count from the state store, diff text from disk), and (3) turn
// its verdict into a PreToolUse decision. The rule and its tests therefore share exactly one truth,
// per the interface contract.
//
// COMMIT DETECTION reuses the segment/leading-word technique from main-only-no-worktrees.mjs
// (that file's own header explains why): the command text is split on shell separators into
// segments, and only a segment whose OWN leading word is `git` with subcommand `commit` counts —
// `echo "git commit"` is one segment whose leading word is `echo`, so it is never treated as a
// commit attempt (COUNTER-RED-3). `git status`, `git commit --dry-run` notwithstanding, ANY `git
// commit ...` segment counts, including `-a`/`--amend`/etc — the gate's question ("was a lesson
// written since the last commit") applies to every commit, not a subset of commit forms.
//
// DIFF SOURCE — spec §4.2 doctrine, quoted directly in the brief: `git diff HEAD -- <doc>`, FROM
// DISK, not from staging. `git commit -a` and a follow-up `git add` are both legitimate orders of
// work; an unstaged lesson edit still counts. The gate asks "was the lesson WRITTEN", not "was it
// staged". Cost accepted: one `git log` + one `git diff` shell-out (~50-100ms), only on `git commit`
// — a rare call, never on every tool use.
//
// FAIL-OPEN, same contract as every Group A/B rule (fix-cycle-limit.mjs's header states it at
// length; repeated here because it is the single most important property of a rule that BLOCKS
// `git commit` — the most disruptive place in the whole system to be wrong): state unreadable, git
// unavailable, doc unreadable, ANY internal failure — none of these may read as "block". They read
// as "allow, and say the gate degraded", named explicitly in the reason so a human sees the
// degradation instead of a silent pass.
//
// SEVERITY JUSTIFICATION (check-meta.mjs's own GATE SCOPING header is the authority on which gates
// may block, quoted directly): "check-board-fresh / check-release / gate-lessons / check-shipped-
// closed: UNCHANGED, still contribute to `failed` on every run. Their invariant is always fixable by
// a single, cheap, immediate edit reachable from the very commit that trips them (... add the lesson)
// — unlike [gates guarding accumulated debt], there is no 'separate heavy action' excuse, so blocking
// is the correct incentive here, not accumulated debt." This rule is that SAME invariant
// (gate-lessons) moved to a second, earlier trigger (the commit itself, not just the release-scope
// CLI/CI pass) — one BLOCK-worthy gate observed from two places, not two different severities.
//
// COUNTER-RED IS THE POINT (owner's own framing, task-6-brief.md item 2): a session with zero
// recorded failures must commit in complete silence — sessionLessonGate() returns pass:true before
// ever looking at the diff, so a healthy session never pays the diff shell-out either. A commit right
// after a previous commit, with no NEW failures between them, must also pass — that is Q4 made
// concrete: eventCountSince(..., lastEvent(...,'commit')?.ts) reads 0 once the failures that
// triggered the PRIOR commit's block are now before that commit's own timestamp.
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openState, eventCountSince, lastEvent } from '../lib/enforcement-state.mjs';
import { sessionLessonGate } from '../../gate-lessons.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

function disciplineDocPath() {
  return process.env.DISCIPLINE || join(ROOT, 'docs', 'process', 'development-discipline.md');
}

const SEGMENT_SPLIT = /(?:&&|\|\||[;\n]|\|(?!\|))/g;

function segments(command) {
  return command
    .split(SEGMENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
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

// Same value-taking-global-option skip as main-only-no-worktrees.mjs, so `git -C . commit -m x` is
// still recognised as a commit segment rather than missed because `commit` isn't tokens[1].
const VALUE_TAKING_GLOBAL_OPTS = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path',
]);

function subcommandIndex(tokens) {
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (VALUE_TAKING_GLOBAL_OPTS.has(tokens[i])) i += 2;
    else i += 1;
  }
  return i;
}

// True iff `command` contains at least one segment that is a `git commit` invocation (any flags).
function isGitCommit(command) {
  for (const seg of segments(command)) {
    const tokens = tokenize(seg);
    if (tokens.length === 0 || tokens[0] !== 'git') continue;
    const subIdx = subcommandIndex(tokens);
    if (tokens[subIdx] === 'commit') return true;
  }
  return false;
}

// Reads `git diff HEAD -- <doc>` from disk (not staging), or null on any failure (missing git,
// missing doc, not a repo, ...) — a caller must treat null as "no evidence", never as "no changes".
// LESSONS_GATE_GIT_CWD: a test-only seam (same convention as ENFORCEMENT_STATE_PATH/DISCIPLINE
// elsewhere in this arc) letting a self-test point the `git diff` invocation at a disposable temp
// repo instead of this real one — unset in normal operation, so production behavior is the plain
// `cwd: ROOT` this rule needs.
function readDisciplineDiff() {
  try {
    return execFileSync(
      'git',
      ['diff', 'HEAD', '--', disciplineDocPath()],
      { cwd: process.env.LESSONS_GATE_GIT_CWD || ROOT, encoding: 'utf8', timeout: 5000 },
    );
  } catch {
    return null;
  }
}

export function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  if (!isGitCommit(command)) {
    return { decision: 'allow', reason: 'no `git commit` segment in this command' };
  }

  const sessionId = input.session_id;
  const db = openState();
  if (!db) {
    return {
      decision: 'allow',
      reason: '§6.3 degraded: enforcement state unreadable (openState() returned null — corrupt/'
        + 'locked/missing store) — allowing the commit; a blocking gate that cannot read its own '
        + 'state must never block.',
    };
  }

  let failuresSinceLastCommit;
  try {
    const last = lastEvent(db, sessionId, 'commit');
    failuresSinceLastCommit = eventCountSince(db, sessionId, 'verification_failure', last?.ts ?? 0);
  } catch {
    try { db.close(); } catch { /* best-effort */ }
    return {
      decision: 'allow',
      reason: '§6.3 degraded: enforcement state unreadable while counting failures — allowing the '
        + 'commit; a blocking gate that cannot read its own state must never block.',
    };
  }
  try { db.close(); } catch { /* best-effort */ }

  if (failuresSinceLastCommit <= 0) {
    // Silence is the point (owner item 2) — no diff shell-out, no doc read, nothing to report.
    return { decision: 'allow', reason: 'no failures recorded since the last commit event this session — §6.3 does not apply.' };
  }

  const diffText = readDisciplineDiff();
  if (diffText === null) {
    // Fail-open per the interface contract ("any git/db failure → allow with degradation reason"):
    // git itself failing (not installed, not a repo, doc path unreadable, ...) must never read as
    // "no lesson was written" — that would turn an infrastructure failure into a false block on the
    // single most disruptive call in the whole system.
    return {
      decision: 'allow',
      reason: `§6.3 degraded: could not read the discipline-doc diff (git diff HEAD -- ${disciplineDocPath()} `
        + 'failed) — allowing the commit; a blocking gate that cannot read its own evidence must never block.',
    };
  }

  const verdict = sessionLessonGate({ failuresSinceLastCommit, disciplineDiffText: diffText });

  if (verdict.pass) {
    return { decision: 'allow', reason: `§6.3: ${verdict.reason}` };
  }

  return { decision: 'block', reason: verdict.reason };
}
