// scripts/hooks/rules/locked-procedure.mjs — L78 (9.8.26): improving a dispatch brief BETWEEN
// batches is a silent procedure change — 38 rules got classified under one procedure and 19
// under another, with no document changed by anyone, and the whole run was invalidated and
// re-run. L78's gate: "a measured procedure is locked in its text, and the brief cites it —
// whoever wants a change, changes the procedure and re-measures."
//
// PAYLOAD POSITION, measured against the real directory before writing this: the PROCEDURE
// files are docs/process/rule-coverage/criterion/criterion.md (the decision procedure) and
// criterion/apply/chunk-*-packet.md (the dispatch briefs — the exact artifact L78's failure
// edited mid-run). The answers (chunk-*-answers-*.json), the batch outputs (batch-*.md), and
// everything else under rule-coverage/ are RUN OUTPUTS, written during normal work — out of
// scope, proven in the false-alarm test.
//
// SEVERITY: WARN, argued in two halves. (1) The mirror marks L78 group B — the prior fact a
// block would need is "a classification run is in flight," and NO recordable signal of that
// exists anywhere in the store or the tree; blocking on a fact this rule cannot read would
// violate fail-open. (2) Editing the procedure is sometimes exactly right (between runs, with a
// re-measurement planned) — the harm mode is doing it SILENTLY, and a warn that quotes the gate
// at the moment of the edit removes the silence, which is the whole lesson. The warn is the
// enforcement; the run-invalidation cost of ignoring it is L78's own receipt.
export const RULE_IDS = ['L78'];

import { normPath, toolFilePath } from '../lib/target-path.mjs';

const LOCKED = [
  /\/docs\/process\/rule-coverage\/criterion\/criterion\.md$/,
  /\/docs\/process\/rule-coverage\/criterion\/apply\/[^/]*packet[^/]*\.md$/,
];

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const np = normPath(toolFilePath(input));
  if (!np || !LOCKED.some((re) => re.test(np))) {
    return { decision: 'allow', reason: 'not a locked procedure file' };
  }
  return {
    decision: 'warn',
    reason: 'L78 (a mid-run brief "improvement" split one measurement into two procedures — 38 '
      + 'rules under one, 19 under another, run invalidated): you are editing a LOCKED measurement '
      + 'procedure/packet. If a classification run is between batches right now, this edit forks '
      + 'the procedure mid-measurement. The legitimate path: change the procedure OPENLY — state '
      + 'the change, and re-measure every batch the old text governed. A procedure that was '
      + 'measured is locked in its text; the brief cites it.',
  };
}
