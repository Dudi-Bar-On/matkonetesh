#!/usr/bin/env node
// scripts/tests/test-bash-segments.mjs — the shared command-position helpers.
//
// Written 2026-08-10, after Task 7's implementer found that `stripDataRegions` has no
// backslash-escape awareness: `node -e "console.log(\"docker start\")"` strips to
// `node -e  docker start\ `, exposing quoted TEXT as if it were command shape. It verified the
// shape does not occur in the 6,479-command corpus, so no rule false-alarms on it today — but this
// helper is imported by every Phase-3 rule plus two Phase-1 ones, so a latent defect here is a
// latent defect in ten places at once. That is the R-129 shape: a shared helper's gap is not one
// bug, it is one bug times its consumers.
//
// The helper had no test file of its own until now. Every rule that depends on it had tests; the
// thing they all depend on did not.
import { stripDataRegions, segments, statements, tokenize, pipelineStages } from '../hooks/lib/bash-segments.mjs';

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) { pass += 1; console.log(`PASS  ${label}`); }
  else { fail += 1; console.log(`FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

const BS = String.fromCharCode(92);   // a backslash, written this way because L68 has eaten it twice

// --- the escape gap -----------------------------------------------------------------------------
{
  const cmd = `node -e "console.log(${BS}"docker start${BS}")"`;
  const out = stripDataRegions(cmd);
  check('escaped quotes inside a double-quoted string do not expose its text',
    !out.includes('docker start'),
    `stripped to ${JSON.stringify(out)}`);
}
{
  // Bash has NO escape inside single quotes — a backslash there is a literal character. So the
  // single-quote regex is correct as-is, and this test pins that it stays simple rather than being
  // "fixed" symmetrically by someone reading the double-quote change.
  const cmd = `echo 'a ${BS} b' rest`;
  const out = stripDataRegions(cmd);
  check('single quotes take no escapes (bash semantics), content still dropped',
    !out.includes('a ') && out.includes('rest'), JSON.stringify(out));
}
{
  const cmd = `echo "plain text here" && git status`;
  const out = stripDataRegions(cmd);
  check('an ordinary double-quoted string is still dropped',
    !out.includes('plain text') && out.includes('git status'), JSON.stringify(out));
}
{
  const cmd = `git commit -F - <<'MSG'\nbody mentions git worktree add\nMSG`;
  const out = stripDataRegions(cmd);
  check('a heredoc body is dropped', !out.includes('worktree'), JSON.stringify(out));
}

// --- the keep-profiles the rules actually rely on ------------------------------------------------
{
  const cmd = `wsl -e bash -lc 'sudo service x start'`;
  const kept = stripDataRegions(cmd, { keepSingleQuoted: true });
  check('keepSingleQuoted preserves the L51a signal', kept.includes('sudo'), JSON.stringify(kept));
  check('the default profile removes it (which is why L51a needs the option)',
    !stripDataRegions(cmd).includes('sudo'));
}
{
  const cmd = `echo "value is $SOME_API_KEY"`;
  const kept = stripDataRegions(cmd, { keepDoubleQuoted: true });
  check('keepDoubleQuoted preserves the L39 signal', kept.includes('$SOME_API_KEY'));
}

// --- the other helpers, so this file covers the module rather than one function -------------------
check('segments splits on && and ;', segments('cd /tmp && git status; ls').length >= 3);
check('statements does not split inside a quoted string',
  statements(`echo "a; b" ; ls`).length === 2, JSON.stringify(statements(`echo "a; b" ; ls`)));
check('tokenize returns the command as token 0', tokenize('  git   status -sb ')[0] === 'git');
check('pipelineStages counts stages', pipelineStages('a | b | c').length === 3);

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
