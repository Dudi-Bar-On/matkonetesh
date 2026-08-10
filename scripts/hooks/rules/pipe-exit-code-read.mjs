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
  // Two passes, and the reason is measured. Statement SPLITTING uses the stripped text, because a
  // `;` inside a quoted string is not a statement boundary. But the `$?` READ must be looked for in
  // the ORIGINAL, because the overwhelmingly common real shape puts it inside an echo string.
  //
  // Corrected 2026-08-10, hours after this rule shipped. Its first version deliberately excluded
  // `echo "EXIT=$?"`, justified in a comment by "the corpus's real mistakes all assign unquoted
  // (ec=$?)". Measured against the 6,448-command corpus that claim is INVERTED: the quoted form
  // appears 52 times and the unquoted 7. The rule was catching 12% of its own subject while
  // documenting the exclusion as deliberate — which is worse than an omission, because it reads as
  // a decision someone already thought about.
  const stripped = stripDataRegions(command);
  const sts = statements(stripped);
  const stsRaw = statements(command);
  for (let i = 0; i + 1 < sts.length; i++) {
    const stages = pipelineStages(sts[i]);
    if (stages.length < 2) continue;
    const lastCmd = tokenize(stages[stages.length - 1])[0];
    if (!FILTERS.has(lastCmd)) continue;
    // Same index in the unstripped split when the two agree in length; fall back to the stripped
    // statement otherwise, so a command whose quoting confuses the split degrades to the old,
    // narrower behaviour rather than to a wrong offset.
    const nextRaw = stsRaw.length === sts.length ? stsRaw[i + 1] : sts[i + 1];
    if (nextRaw.includes('$?')) {
      return {
        decision: 'warn',
        // `grep` is the one filter whose exit status a caller may legitimately WANT — it returns 1
        // when nothing matched, so `… | grep x; echo "$?"` can be a deliberate did-it-match test.
        // Measured over the corpus: 58 of 59 real instances end in head/tail, where the status is
        // meaningless, and exactly 1 ends in grep. Warn severity makes keeping it the cheaper error
        // — but the message says so, so someone who meant it is not told they are wrong.
        reason: (lastCmd === 'grep'
          ? 'L32: `$?` after `| grep` reads GREP\'s status (1 = no match). If that is what you '
            + 'wanted, ignore this. If you wanted the piped command\'s status, it is already lost — '
          : '')
          + `L32: \`$?\` right after \`| ${lastCmd}\` measures ${lastCmd}'s exit code — `
          + 'always 0 — never the command you piped. Capture `$?` IMMEDIATELY after the real '
          + 'command (redirect to a file first if the output needs trimming): '
          + '`cmd > out.log 2>&1; ec=$?; tail out.log`.',
      };
    }
  }
  return { decision: 'allow', reason: 'no $? read through a filter pipe' };
}
