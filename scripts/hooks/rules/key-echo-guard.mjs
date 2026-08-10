// scripts/hooks/rules/key-echo-guard.mjs — L39. "The rule stands unchanged: never print, log,
// echo, or commit a key — read it into the process and use it, nothing more." A printed key in
// a transcript is unrecoverable.
//
// SEVERITY: block, argued (spec §3.2): substance — once printed, the secret is in the log
// forever; there is no undo, so warning after the fact is worthless. Reachable alternative
// (§10.24), named in the reason: L39's own documented read pattern (read the value into the
// process environment and USE it, without printing).
//
// STRIPPING PROFILE — deliberately NOT the default (coordinator-confirmed): double-quoted
// content is KEPT, because a shell EXPANDS $VAR inside double quotes (`echo "$GEMINI_API_KEY"`
// prints the key). Single quotes and heredoc bodies stay stripped: '$KEY' is inert text, and
// the corpus's L39 noise (35 raw hits, 97% noise) was key-shaped prose with no $-expansion.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L39'];

import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const PRINTERS = new Set(['echo', 'printf', 'printenv', 'Write-Output', 'Write-Host']);
const KEY_VAR = /\$(?:env:)?\w*(API_KEY|_KEY|TOKEN|SECRET)\w*/i;
const KEY_NAME = /(API_KEY|_KEY|TOKEN|SECRET)/i;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command, { keepDoubleQuoted: true }))) {
    const tokens = tokenize(st);
    const head = tokens[0];
    if (!PRINTERS.has(head)) continue;
    const expandsKey = KEY_VAR.test(st);
    const printenvKey = head === 'printenv'
      && tokens.slice(1).some((t) => !t.startsWith('-') && KEY_NAME.test(t));
    if (expandsKey || printenvKey) {
      return {
        decision: 'block',
        reason: 'L39: this prints a key-shaped variable — a printed key lands in the transcript '
          + 'and is unrecoverable. Read it into the process and USE it without printing, e.g. '
          + "PowerShell: `$env:GEMINI_API_KEY=[Environment]::GetEnvironmentVariable("
          + "'GEMINI_API_KEY','User'); node <script>`. A probe that cannot get a key says so "
          + 'without echoing it.',
      };
    }
  }
  return { decision: 'allow', reason: 'no key-printing statement in command position' };
}
