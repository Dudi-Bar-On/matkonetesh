// scripts/hooks/lib/bash-segments.mjs — the ONE shell-segment/token splitter every Bash-parsing
// rule shares. Extracted (Task 13, R-116) from main-only-no-worktrees.mjs, which had this exact
// logic first and unchanged: a Bash command is split on shell separators (&&, ||, ;, |, newline)
// into segments, and each segment is tokenized (whitespace-separated, with a light allowance for
// a whole token wrapped in matching quotes). This is NOT a shell parser — nested/escaped quoting
// inside a token is not unwrapped — it only needs to be good enough to read the first few tokens
// of a segment (the leading command word, then its immediate arguments).
//
// Two rules needing "is this Bash command running X" (git worktree/checkout for §9,
// grep/rg/findstr for §5.1/§10.13 — Task 13) is exactly the situation this repo has already paid
// for once as a drifting duplicate (see this task's report and R-116): one splitter, in lib/,
// both callers import it.

export const SEGMENT_SPLIT = /(?:&&|\|\||[;\n]|\|(?!\|))/g;

export function segments(command) {
  return command
    .split(SEGMENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tokenize(seg) {
  const matches = seg.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((t) => {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  });
}

// ------------------------------------------------------------------------------------------------
// Arc 2 Phase 3 additions. The 2026-08-10 corpus measurement (docs/analysis/
// 2026-08-10-phase3-bash-corpus-measurement.txt, 6,338 real Bash commands) proved the dominant
// false-alarm source for EVERY Bash rule is prose that DESCRIBES a rule, quoted inside an echo or
// a heredoc ("botulism kill-temps", "plain — no --retries"). So Bash rules match against COMMAND
// POSITION ONLY: these helpers reduce a command to what a shell would actually execute. The three
// data-region regexes are EXACT ports of scripts/tests/measure-bash-corpus.py's HEREDOC/SQ/DQ/
// COMMENT — the measured noise-removal numbers are only valid for these shapes.
// Only String.replace() is used with the /g regexes below (replace resets lastIndex; the Phase-2
// /g+exec lastIndex hazard does not apply here).
const HEREDOC_BODY = /<<-?\s*'?"?(\w+)'?"?\n[\s\S]*?\n\1/g;
const SINGLE_QUOTED = /'[^']*'/g;
// Escape-aware, unlike the single-quote form above it — and that asymmetry is bash semantics, not an
// oversight: inside single quotes a backslash is a literal character and there is no escape, while
// inside double quotes \" is one. Found 2026-08-10 by Task 7's implementer:
//     node -e "console.log(\"docker start\")"
// stripped to `node -e  docker start\ `, exposing quoted TEXT as command shape. It does not occur in
// the 6,479-command corpus, so no rule false-alarms on it today — but this helper is imported by ten
// rules, and a gap here is one bug times its consumers (the R-129 shape).
const DOUBLE_QUOTED = /"(?:\\.|[^"\\])*"/g;
const HASH_COMMENT = /(^|\s)#[^\n]*/g; // no /m — matches the measurement script (^ = string start)

// keepSingleQuoted / keepDoubleQuoted exist because "data region" is PER-RULE, not universal
// (coordinator-confirmed 2026-08-10, incl. the correction prepended to the measurement file):
//  - L39 must KEEP double-quoted content ($VAR expands inside "..." — `echo "$GEMINI_API_KEY"`
//    prints the key) while still dropping single-quoted content (no expansion, `'$KEY'` is inert).
//  - L51a must keep BOTH: `wsl -e bash -lc 'sudo …'` carries its real command inside quotes —
//    the blanket strip REMOVED that signal, which is why the raw measurement showed 0 in-command.
// Every other Phase-3 rule uses the default full strip, which is what the corpus was measured with.
export function stripDataRegions(command, { keepSingleQuoted = false, keepDoubleQuoted = false } = {}) {
  let s = command.replace(HEREDOC_BODY, ' ');
  if (!keepSingleQuoted) s = s.replace(SINGLE_QUOTED, ' ');
  if (!keepDoubleQuoted) s = s.replace(DOUBLE_QUOTED, ' ');
  return s.replace(HASH_COMMENT, ' ');
}

// statements() vs segments(): segments() (above) also splits on single `|`, which destroys
// pipeline structure — correct for "what is the leading command word of each piece", wrong for
// L32 ("did $? get read after a pipe into a filter?"). statements() keeps each pipeline whole.
export const STATEMENT_SPLIT = /(?:&&|\|\||[;\n])/g;
// A `;` inside a quoted string is not a statement boundary. Found 2026-08-10 while writing this
// module's first test file: `echo "a; b" ; ls` split into THREE statements, not two. It matters
// beyond tidiness — L32 reads `$?` from the RAW (unstripped) split, so a false boundary there could
// invent a statement and warn about an exit-code read that never happened. L32's own
// length-agreement guard would have degraded it safely, but a guard covering for a broken helper is
// not the same as a helper that works.
//
// STATEMENT_SPLIT is kept exported and unchanged: it is still the honest description of the
// boundaries, and callers that split flat text (not shell) rely on it.
export function statements(command) {
  const out = [];
  let buf = '';
  let sq = false;
  let dq = false;
  const BS = String.fromCharCode(92);
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (c === BS && dq) { buf += c + (command[i + 1] || ''); i += 1; continue; }
    if (c === "'" && !dq) { sq = !sq; buf += c; continue; }
    if (c === '"' && !sq) { dq = !dq; buf += c; continue; }
    if (!sq && !dq) {
      if (c === '&' && command[i + 1] === '&') { out.push(buf); buf = ''; i += 1; continue; }
      if (c === '|' && command[i + 1] === '|') { out.push(buf); buf = ''; i += 1; continue; }
      if (c === ';' || c === '\n') { out.push(buf); buf = ''; continue; }
    }
    buf += c;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}
export function pipelineStages(statement) {
  return statement.split(/\|(?!\|)/).map((s) => s.trim()).filter(Boolean);
}

// Moved here from no-concurrent-suite-run.mjs (which now imports it) so L10 does not become the
// third drifting copy — the exact hazard R-116/this file's header names. Coordinator-approved.
// Returns null when `tokens` is not a `playwright test` invocation; else the invocation's own
// argument tokens, cut at the first pipe/redirect token (args after `| tail` belong to tail).
const KNOWN_TEST_SCRIPTS = new Set(['test', 'test:full', 'test:visual', 'test:a11y']);
function cutAtBoundary(args) {
  const stop = args.findIndex((t) => t === '|' || t.startsWith('>') || t.startsWith('2>') || t === '<');
  return stop === -1 ? args : args.slice(0, stop);
}
export function playwrightTestTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const [a, b, c] = tokens;
  if (a === 'playwright' && b === 'test') return cutAtBoundary(tokens.slice(2));
  if (a === 'npx' && b === 'playwright' && c === 'test') return cutAtBoundary(tokens.slice(3));
  if (a === 'npm' && b === 'test') return [];
  if (a === 'npm' && b === 'run' && KNOWN_TEST_SCRIPTS.has(c)) return [];
  return null;
}
