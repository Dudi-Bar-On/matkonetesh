// scripts/hooks/rules/pipe-exit-code-read.mjs — L32. `cmd | head; ec=$?` captures the exit code
// of HEAD (always 0), never the real command — a mistake made twice more after being written
// down, once by the controller minutes after writing the rule (2026-07-31).
//
// SEVERITY: warn, argued (spec §3.2): the command still performs its real work — the harm is a
// MISREAD MEASUREMENT afterwards, i.e. evidence quality, not the action itself; and there are
// legitimate compounds where $? genuinely refers to the last pipeline. The warn text carries the
// correction, which is all the incident ever needed. Alternative named: capture `$?` immediately
// after the command that matters; redirect to a file first if the output needs trimming.
//
// DETECTION: on full-stripped statements (heredocs/quotes/comments gone — the corpus's L32 noise
// was prose), a statement whose pipeline ends in a pure filter (head/tail/grep — the measured
// set) followed by a statement reading `$?`. The quoted form `echo "EXIT=$?"` is stripped and
// deliberately NOT caught — the corpus's real mistakes all assign unquoted (`ec=$?`), and
// widening past the measured shape is how false alarms are born.
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L32'];

import { statements, pipelineStages, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const FILTERS = new Set(['head', 'tail', 'grep']);

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  const sts = statements(stripDataRegions(command));
  for (let i = 0; i + 1 < sts.length; i++) {
    const stages = pipelineStages(sts[i]);
    if (stages.length < 2) continue;
    const lastCmd = tokenize(stages[stages.length - 1])[0];
    if (!FILTERS.has(lastCmd)) continue;
    if (sts[i + 1].includes('$?')) {
      return {
        decision: 'warn',
        reason: `L32: \`$?\` right after \`| ${lastCmd}\` measures ${lastCmd}'s exit code — `
          + 'always 0 — never the command you piped. Capture `$?` IMMEDIATELY after the real '
          + 'command (redirect to a file first if the output needs trimming): '
          + '`cmd > out.log 2>&1; ec=$?; tail out.log`.',
      };
    }
  }
  return { decision: 'allow', reason: 'no $? read through a filter pipe' };
}
