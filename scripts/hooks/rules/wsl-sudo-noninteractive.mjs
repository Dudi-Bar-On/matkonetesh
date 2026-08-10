// scripts/hooks/rules/wsl-sudo-noninteractive.mjs — L51a. `sudo` inside a non-interactive `wsl`
// call reads EOF at the password prompt and fails SILENTLY — indistinguishable from doing
// nothing (2026-08-05).
//
// SEVERITY: block, argued (spec §3.2): the action has no equivalent outcome — it cannot
// succeed, only pretend to; a silent no-op that reads as success is substance-harm to every
// conclusion built on it. Reachable alternative (§10.24), from L51a's own text: `wsl -u root
// <command>` — the Windows user is already authenticated, root needs no password.
//
// STRIPPING PROFILE — deliberately NOT the default (coordinator-confirmed, and the measurement
// file now carries a prepended correction about exactly this): BOTH quote kinds are KEPT. The
// real violation lives inside quotes (`wsl -e bash -lc 'sudo …'` — the quoted string IS the
// command wsl runs); the blanket strip REMOVED that signal, which is why the raw measurement
// showed "0 in-command". Prose is still excluded structurally: the statement must LEAD with
// `wsl` — an `echo "wsl … sudo …"` statement leads with echo.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L51a'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

// `sudo` at a command boundary inside a token: start-of-token, or after whitespace/;/&/|/quotes/
// parens/backtick. tokenize() only unwraps a WHOLE token in matching quotes, so a quote broken
// open by the statement split (`'sudo`) keeps its leading quote char — the class covers that.
const SUDO_AT_BOUNDARY = /(^|[\s;&|'"(`])sudo\b/;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  const kept = stripDataRegions(command, { keepSingleQuoted: true, keepDoubleQuoted: true });
  for (const st of statements(kept)) {
    const tokens = tokenize(st);
    if (tokens[0] !== 'wsl' && tokens[0] !== 'wsl.exe') continue;
    const uIdx = tokens.indexOf('-u');
    if (uIdx !== -1 && tokens[uIdx + 1] === 'root') continue; // root needs no password — fine
    if (tokens.slice(1).some((t) => SUDO_AT_BOUNDARY.test(t))) {
      return {
        decision: 'block',
        reason: 'L51a: `sudo` inside a non-interactive `wsl` call reads EOF at the password '
          + 'prompt and fails SILENTLY — indistinguishable from doing nothing. Run it as '
          + '`wsl -u root <command>` instead: the Windows user is already authenticated, so '
          + 'root needs no password.',
      };
    }
  }
  return { decision: 'allow', reason: 'no sudo inside a non-interactive wsl call' };
}
