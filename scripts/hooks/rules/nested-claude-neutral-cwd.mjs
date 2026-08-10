// scripts/hooks/rules/nested-claude-neutral-cwd.mjs — 10.12a. A nested `claude -p` started
// inside this repo loads CLAUDE.md and STOPS BEING AN EXTRACTOR: measured 2026-07-24, 3 of 3
// dispatched documents produced 0 nodes while 60 nodes were invented for unrelated repo files.
// "Run any nested extraction backend from a NEUTRAL cwd, with absolute paths."
//
// SEVERITY: block, argued (spec §3.2): substance — the nested agent silently does a different
// job, producing corrupt output that LOOKS like results. Reachable alternative (§10.24), named
// in the reason AND recognized by the rule itself: `cd` to an absolute directory OUTSIDE the
// repo earlier in the same call (with absolute paths for the inputs) — that exact shape allows.
//
// The inside-repo check is a normalized SUBSTRING test on the cd target ('source/repos/
// matconetesh'), not path resolution: the Bash tool mixes Windows (C:\...) and git-bash
// (/c/...) path spellings, and node's resolve() mangles the git-bash form on win32 — a wrong
// resolve would ALLOW a cd back into the repo. The substring is stable across both spellings.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['10.12a'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const REPO_MARKER = 'source/repos/matconetesh';
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;
const insideRepo = (p) => p.replace(/\\/g, '/').toLowerCase().includes(REPO_MARKER);

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  let cdOutsideRepo = false;
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (tokens[0] === 'cd' && tokens[1]) {
      cdOutsideRepo = ABSOLUTE.test(tokens[1]) && !insideRepo(tokens[1]);
      continue;
    }
    if (tokens[0] === 'claude' && tokens.includes('-p') && !cdOutsideRepo) {
      return {
        decision: 'block',
        reason: "10.12a: a nested `claude -p` started inside this repo loads CLAUDE.md and stops "
          + 'being an extractor (measured: 0/3 documents extracted, 60 nodes invented for '
          + 'unrelated repo files). Run it from a NEUTRAL cwd instead: `cd <absolute dir outside '
          + 'the repo>` earlier in this same call, and pass every input as an absolute path — '
          + 'that shape is allowed as-is.',
      };
    }
  }
  return { decision: 'allow', reason: 'no nested claude -p from a repo cwd' };
}
