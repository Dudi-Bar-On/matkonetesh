// scripts/hooks/rules/edit-commit-separation.mjs — L73 (8.8.26, twice in one day): a content
// write and a `git commit` shared one Bash call; a PreToolUse gate blocked the COMMIT, and the
// WHOLE call never ran — the write vanished with it, and the author went hunting for a
// file-restore mechanism that does not exist. A PreToolUse hook blocks the entire Bash command,
// not its last segment. An edit that later content relies on is written in its own call,
// verified from disk, and only then committed.
//
// SEVERITY: block, argued (spec §3.2): substance — the failure mode is a silently lost write
// plus a false belief about what is on disk. Reachable alternative (§10.24), named in the
// reason: two calls (write; verify; commit). Zero capability is lost, only one round-trip added.
//
// FALSE-ALARM DESIGN — the single most sensitive rule in this phase (coordinator requirement):
// the owner commits ~20x/day as `git commit -q -F - -- <paths> <<'MSG' … MSG`, where the heredoc
// is the COMMIT MESSAGE, not an edit. stripDataRegions() removes heredoc BODIES and quoted
// strings FIRST, so that command reduces to `git commit -q -F - -- <paths> <<` — no edit shape
// left. The content-edit patterns below are the measurement script's own (cat>/cat>>, >> to a
// source-ish file, sed -i, tee) — the exact set the 3%-noise number was measured with; widening
// it is how this rule becomes the alarm that gets disabled.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L73'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const CAT_REDIRECT = /^cat\s*>>?/;
const APPEND_TO_SOURCE = />>\s*\S+\.(md|py|mjs|json)\b/;

function isContentEdit(st, tokens) {
  if (CAT_REDIRECT.test(st)) return true;
  if (APPEND_TO_SOURCE.test(st)) return true;
  const sedIdx = tokens.indexOf('sed');
  if (sedIdx !== -1 && tokens[sedIdx + 1] === '-i') return true;
  if (tokens.includes('tee')) return true;
  return false;
}

// `commit` must be an argument of git itself — before any pipe token — so `git log | grep commit`
// stays untouched (tokens: pipe at index 2, commit at index 4).
function isGitCommit(tokens) {
  const g = tokens.indexOf('git');
  if (g === -1) return false;
  const c = tokens.indexOf('commit');
  if (c <= g) return false;
  const pipe = tokens.indexOf('|');
  return pipe === -1 || c < pipe;
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  let editStatement = null;
  let commitStatement = null;
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (editStatement === null && isContentEdit(st, tokens)) editStatement = st;
    if (commitStatement === null && isGitCommit(tokens)) commitStatement = st;
  }
  if (editStatement !== null && commitStatement !== null) {
    return {
      decision: 'block',
      reason: `L73: this call combines a content edit (\`${editStatement.slice(0, 80)}\`) with `
        + '`git commit`. A PreToolUse hook blocks the WHOLE Bash command — if any gate blocks '
        + 'the commit, the write vanishes with it (that exact incident, twice on 8.8.26). Run '
        + 'them as separate calls: write first, verify the file from disk, then commit. '
        + "Heredoc commit MESSAGES (`git commit -F - <<'MSG'`) are fine and do not trigger this.",
    };
  }
  return { decision: 'allow', reason: 'no content-edit + commit combination in one call' };
}
