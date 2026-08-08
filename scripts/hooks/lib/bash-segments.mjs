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
