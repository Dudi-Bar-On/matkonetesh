// scripts/hooks/rules/playwright-plain-run.mjs — L10. `--workers=1 --retries=2` once ran the
// suite serially (13 min) AND masked flakiness: command-line overrides fought the config's
// fullyParallel/retries:0 intent. DoD-12 says it outright: run `npx playwright test` plain,
// NEVER pass --retries or --workers; a flake is a bug to debug, not to retry away.
//
// SEVERITY: block, argued (spec §3.2): the harm is to SUBSTANCE — a retried-green suite is
// false evidence, and false evidence about test health is the exact disease DoD-12 exists to
// prevent. Reachable alternative (§10.24), named in the reason: run the suite plain; if it
// flakes, that flake is debugged via systematic-debugging. Config-level worker changes go
// through L21's owner-decision gate on playwright.config.ts, not through CLI flags.
//
// FALSE-ALARM DESIGN (the measurement's decisive finding): the flags are matched ONLY in
// command position — stripDataRegions() removes echo'd/heredoc'd prose first, which is 100%
// of what separated 157 raw hits from 154 real ones.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L10'];

import { statements, tokenize, stripDataRegions, playwrightTestTokens } from '../lib/bash-segments.mjs';

const OVERRIDE_FLAG = /^--(workers|retries)(=|$)/;

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (playwrightTestTokens(tokens) === null) continue;
    const offending = tokens.filter((t) => OVERRIDE_FLAG.test(t));
    if (offending.length > 0) {
      return {
        decision: 'block',
        reason: `L10: \`${offending.join(' ')}\` overrides the config's fullyParallel/retries:0 `
          + 'intent — the last time, it ran the suite serially (13 min) AND masked flakiness as '
          + 'green. Run the suite plain instead: `npx playwright test` (DoD-12). A flake it '
          + 'surfaces is a bug — debug it via systematic-debugging, never retry it away.',
      };
    }
  }
  return { decision: 'allow', reason: 'no workers/retries override on a playwright test invocation' };
}
