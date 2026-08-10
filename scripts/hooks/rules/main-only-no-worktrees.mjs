// scripts/hooks/rules/main-only-no-worktrees.mjs — §9 (settled): "work on main, no worktrees."
//
// Blocks exactly the two Bash invocations that start an alternate line of work: `git worktree
// add` and `git checkout -b`/`-B` (branch creation). Everything else passes, INCLUDING the
// innocent lookalikes a naive regex would also catch: `git checkout -- file`, `git checkout
// main`, `git switch main`, `git worktree list`. Per the brief: a hook that blocks those gets
// switched off within a day, and then the whole enforcement layer is worthless — so the second
// RED (the innocent commands passing) matters more than the first (the guilty ones blocking).
//
// Every deny reason names the alternative per §10.24: a block without a way to do the same work
// is stopping work, not enforcing — and §9 already settled what that alternative is (work
// directly on main).
//
// DECISION (brief step 3 — what happens to `echo "git checkout -b x"` inside a string literal):
// NOT blocked. The command text is split on shell separators (&&, ||, ;, |, newline) into
// segments, and only a segment whose OWN leading word is `git` is inspected for worktree-add /
// checkout -b. `echo "git checkout -b x"` is one segment whose leading word is `echo` — it never
// invokes git at all, so denying it would be a false positive with zero safety benefit: no
// worktree or branch gets created either way. The same segment-leading-word check is also why
// `git commit -m "did a checkout -b thing"` passes — the leading words after `git` are `commit`,
// not `checkout -b`, regardless of what the message string says.
//
// FIX ROUND 1 (review finding): a git GLOBAL OPTION between `git` and the subcommand — e.g.
// `git -C . checkout -b x`, `git --no-pager checkout -b x`, `git -c core.pager=cat worktree add
// ../w` — must not defeat the rule; `-C <path>` is the ordinary way to act on another repo path,
// not an exotic bypass. Tokens are read after `git` and skipped while they start with `-`: value-
// taking global options (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, `--exec-path`,
// each as its OWN following token, e.g. `-C .`) consume that following token too, so it is never
// mistaken for the subcommand; valueless ones (`--no-pager`, `--paginate`, `--bare`, `--literal-
// pathspecs`, an inline `--exec-path=/x` form, …) consume just the one token. This is not an
// exhaustive enumeration of every git global option — it does not need to be, since any option
// this list doesn't name is valueless from the skip loop's point of view (one token consumed),
// which is the same safe default git itself falls back to for a flag it already parsed off before
// the subcommand.
//
// KNOWN GAP, accepted deliberately for a deterministic tokenizing rule (not full shell parsing):
// a wrapper like `bash -c "git checkout -b x"` or `sh -c "..."` still evades this, because that
// segment's leading word is `bash`/`sh`, not `git`. Closing that gap would require actually
// parsing/executing the shell grammar, which is out of scope for "the easiest rule to decide" —
// flagged in the task report (both rounds), not silently accepted as correct.

// Splitter/tokenizer moved to lib/bash-segments.mjs (Task 13, R-116) so the grep-classification
// rules can reuse the exact same machinery instead of forking a second copy — see that module's
// header. Behavior here is unchanged: same regex, same tokenizer, just imported now.
// RULE_IDS — the rules in the corpus this file ACTUALLY enforces, read by
// scripts/check-rule-coverage.mjs. Declared here rather than as a path column in the store so
// it travels with the file: a stored path goes stale in silence, which is the failure the rules
// register itself exists to prevent. An id absent from the corpus is an ERROR, not an ignored
// field — claiming to enforce something that does not exist is false coverage.
// An observer declares [] EXPLICITLY, so the gate can require the export on every scanned file
// and catch a rule that simply forgot to declare rather than mistaking it for an observer.
// TOOLS — the tool names this rule can ever object to. The pipeline reads this from the
// file TEXT and skips importing the module entirely for any other tool, which is what keeps
// per-call cost from growing with the total rule count. It must stay HONEST: for any tool
// not listed here, evaluate() must return allow. tests/test_hook_tool_scope.py proves that
// for every rule and every tool, so a wrong list fails loudly instead of silencing a rule.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['9'];

import { segments, tokenize } from '../lib/bash-segments.mjs';

// Global options that take their value as a SEPARATE following token (not inline `--opt=value`,
// which is already a single self-contained token and needs no extra skip).
const VALUE_TAKING_GLOBAL_OPTS = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path',
]);

// Given a segment's tokens starting at tokens[0] === 'git', returns the index of the subcommand
// token (worktree, checkout, status, ...), skipping any global options in between.
function subcommandIndex(tokens) {
  let i = 1;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (VALUE_TAKING_GLOBAL_OPTS.has(tokens[i])) {
      i += 2; // the option AND its following value token
    } else {
      i += 1; // valueless option (or an inline --opt=value form) — one token
    }
  }
  return i;
}

export function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }

  for (const seg of segments(command)) {
    const tokens = tokenize(seg);
    if (tokens.length === 0 || tokens[0] !== 'git') continue;

    const subIdx = subcommandIndex(tokens);
    const subcommand = tokens[subIdx];
    const nextArg = tokens[subIdx + 1];
    if (subcommand === undefined) continue;

    if (subcommand === 'worktree' && nextArg === 'add') {
      return {
        decision: 'block',
        reason: '§9 (settled): work happens on main, not in a worktree. `git worktree add` is '
          + 'blocked — do the same work directly on main instead of adding a worktree.',
      };
    }
    if (subcommand === 'checkout' && (nextArg === '-b' || nextArg === '-B')) {
      return {
        decision: 'block',
        reason: '§9 (settled): work happens directly on main, no side branches for isolation. '
          + '`git checkout -b`/`-B` is blocked — do the same work on main instead of branching '
          + 'off to isolate it.',
      };
    }
  }

  return { decision: 'allow', reason: 'no `git worktree add` or `git checkout -b`/`-B` in this command' };
}
