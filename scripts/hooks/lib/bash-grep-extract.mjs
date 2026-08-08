// scripts/hooks/lib/bash-grep-extract.mjs — Task 13, R-116: the ONE shared "is this Bash
// segment running a grep-like search, and what does it correspond to structurally" decision, used
// by BOTH symbolic-grep-use-serena.mjs (§10.17/§5.1) and geniza-fallback-declaration.mjs (§10.13).
// Before this task both rules gated on `tool_name === 'Grep'` only — the dedicated Grep tool — and
// were completely blind to the same search run as `grep`/`rg`/... inside a Bash command. Measured
// over one shift: 105 greps through Bash, 0 through the Grep tool. See this task's report.
//
// WHY ONE MODULE: the brief (and R-102/R-110's own lesson about drift) is explicit that a second
// copy of a classification rule is a defect this repo has already paid for. This module owns ONLY
// the "recognize + normalize" half — turning a raw Bash command string into zero or more
// Grep-tool-shaped `{ pattern, type, glob, path }` objects, one per grep-like segment found. Each
// rule keeps applying its OWN classification axis (code-shaped for §5.1, docs-shaped for §10.13)
// to the normalized result — those two axes are deliberately different, per
// geniza-fallback-declaration.mjs's own header, and do not belong merged into one verdict here.
//
// SCOPE (deliberately narrow, matching the brief's item 2): a segment counts only when its OWN
// leading word — after the shared segments()/tokenize() split from bash-segments.mjs, the exact
// same machinery main-only-no-worktrees.mjs already uses for `git` — is exactly `grep`, `egrep`,
// `fgrep`, `rg`, `findstr`, or `select-string` (case-insensitive on the leading word only, since
// Windows tool names are conventionally capitalized). `echo "grep foo"` -> the leading word of
// that (only) segment is `echo`, never inspected: not a real grep invocation, zero safety benefit
// in flagging it. `cmd | grep x` -> two segments, `grep x` is inspected on its own merits (no
// path argument here at all, so it will typically fail every downstream code/docs classification
// anyway — a plain, unqualified pipe grep is not a corpus sweep of anything in particular).
// `git grep ...` is NOT matched: its own leading word is `git`, not `grep` — recognizing `git
// grep` as a search tool is a separate, un-asked-for scope expansion, not what the brief's item 2
// names ("a Bash command whose leading segment word is grep, rg, findstr or Select-String").
//
// SWEEP vs KNOWN-FILE (the brief's named counter-case, item 3): `grep -n "R-72"
// docs/ROADMAP-2026-07-30.md` is a targeted read of ONE already-known file, not a corpus search —
// it must not read as "aimed at documents" for §10.13's purposes. `isSweepTarget()` below captures
// that: a wildcard glob/type, a directory-shaped path, or more than one path argument all read as
// a sweep; a single token that names one specific file does not. This exemption is scoped to the
// NEW Bash-derived surface only — the long-committed, already-tested Grep-tool path in
// geniza-fallback-declaration.mjs is untouched, so this file exports the flag but leaves each
// caller free to ignore it (which the symbolic-grep-use-serena.mjs caller does: its own (א)
// code-target condition already excludes a docs/*.md path on its own terms, sweep or not).
import { segments, tokenize } from './bash-segments.mjs';

const GREP_LEADING_WORDS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'findstr', 'select-string']);

// Long options that consume the FOLLOWING token as their value (not an inline `--opt=value`,
// which is already one self-contained token).
const VALUE_TAKING_LONG_OPTS = new Set([
  'type', 'glob', 'include', 'exclude', 'max-count', 'after-context', 'before-context', 'context',
  'pattern', 'path',
]);
// Short options that consume the following token as their value when standing alone (`-A 3`,
// `-t js`, `-g '*.md'`, `-e pattern`) — an inline form like `-A3` is left as one token and simply
// skipped (its value is never needed by this module).
const VALUE_TAKING_SHORT_OPTS = new Set(['A', 'B', 'C', 'm', 'f']);

const WILDCARD = /[*?[\]{}]/;
// A path token "looks like a directory" (and therefore a sweep) when it has no file extension or
// ends with a path separator — "docs", "docs/", "docs/**" all read this way; "docs/x.md" does not.
function looksLikeDirectory(token) {
  if (/[\\/]$/.test(token)) return true;
  const base = token.split(/[\\/]/).pop() || '';
  return !/\.[A-Za-z0-9]+$/.test(base);
}

function parseSegmentTokens(tokens) {
  let pattern;
  let type;
  let glob;
  const paths = [];
  let sawPatternFlag = false;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '--') continue; // end-of-options marker: everything after is positional
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const key = (eq === -1 ? tok.slice(2) : tok.slice(2, eq)).toLowerCase();
      if (eq !== -1) {
        const val = tok.slice(eq + 1);
        if (key === 'type') type = val;
        else if (key === 'glob') glob = val;
        else if (key === 'pattern') { pattern = val; sawPatternFlag = true; }
        continue;
      }
      if (VALUE_TAKING_LONG_OPTS.has(key)) {
        const val = tokens[i + 1];
        if (key === 'type') type = val;
        else if (key === 'glob') glob = val;
        else if (key === 'pattern') { pattern = val; sawPatternFlag = true; }
        else if (key === 'path') paths.push(val);
        i += 1;
      }
      continue;
    }
    if (tok.startsWith('-') && tok.length > 1) {
      const letter = tok[1];
      if (letter === 'e') {
        pattern = tok.length > 2 ? tok.slice(2) : tokens[++i];
        sawPatternFlag = true;
        continue;
      }
      if (letter === 't' && tok.length === 2) { type = tokens[++i]; continue; }
      if (letter === 'g' && tok.length === 2) { glob = tokens[++i]; continue; }
      if (VALUE_TAKING_SHORT_OPTS.has(letter) && tok.length === 2) { i += 1; continue; }
      continue; // valueless flag cluster (-rn, -i, -w, -l, -o, -v, an inline -A3, ...)
    }
    // positional token: first one is the pattern (unless -e/--pattern already claimed it),
    // everything after that is a search target (file or directory).
    if (!sawPatternFlag && pattern === undefined) {
      pattern = tok;
    } else {
      paths.push(tok);
    }
  }

  return { pattern, type, glob, path: paths.length ? paths.join(' ') : undefined, paths };
}

// See the "SWEEP vs KNOWN-FILE" header note. Only meaningful on Bash-derived candidates.
export function isSweepTarget(candidate) {
  if (!candidate) return false;
  if (candidate.type) return true; // e.g. rg --type md scans every matching file, not one
  if (candidate.glob && WILDCARD.test(candidate.glob)) return true;
  if (candidate.paths && candidate.paths.length > 1) return true;
  const p = candidate.paths && candidate.paths[0];
  if (!p) return Boolean(candidate.glob); // no path at all: a bare glob still reads as a sweep
  if (WILDCARD.test(p)) return true;
  return looksLikeDirectory(p);
}

// Returns one normalized `{ pattern, type, glob, path, paths, isSweep }` object per grep-like
// segment found in the Bash command text — `[]` when the command has none (the overwhelming
// majority of Bash calls: `ls`, `npm test`, `python build.py`, `echo "grep foo"`, ...).
export function extractBashGrepInvocations(command) {
  if (typeof command !== 'string' || command.trim() === '') return [];
  const out = [];
  for (const seg of segments(command)) {
    const tokens = tokenize(seg);
    if (tokens.length === 0) continue;
    if (!GREP_LEADING_WORDS.has(tokens[0].toLowerCase())) continue;
    const parsed = parseSegmentTokens(tokens);
    out.push({ ...parsed, isSweep: isSweepTarget(parsed) });
  }
  return out;
}
