// scripts/hooks/rules/agent-concurrency-ceiling.mjs — §10.5a (settled): "סדרתי; ≤3 קלים; ≤5
// קשיח; 1 בזמן סוויטה/GPU." Enforces the numeric ceilings on `PreToolUse:Agent`: warn above 3
// concurrently-live agents, block above 5 — and, per the owner's explicit ruling on Fix Round 1
// (the brief's own heading quotes §10.5a in full, including the suite/GPU clause — dropping it
// silently would have been a waiver, §4, not mine to grant), the ceiling drops to 1 while a
// Playwright suite run is in flight, reusing no-concurrent-suite-run.mjs's own port probe rather
// than duplicating a second one against the same port.
//
// FIX ROUND 1 (owner review finding, Critical — read scripts/hooks/lib/agent-ledger.mjs's header
// first, it carries the full measurement trail): the original version counted live agents with
// ONLY a 20-minute TTL and no completion signal. Measured by the reviewer: six STRICTLY SEQUENTIAL
// dispatches (each one's agent already finished before the next began — the exact discipline
// §10.23 calls the core of this project, "סדרתי ובטוח זה ליבת החכמה") produced two warns and two
// blocks, because nothing ever told the ledger an agent had finished. That is the "count that
// never resets" failure the brief warned against, just triggered by SUCCESS instead of a crash.
//
// THE FIX: `SubagentStop` (confirmed real — docs/vendor/claude-code/claude-code-docs-19.md, -46.md,
// -47.md) is a genuine completion signal this project was not yet using. It is now the PRIMARY way
// a ledger entry is retired (scripts/hooks/subagentstop.mjs, a new fail-open entry point — not
// wired into settings.json, Task 8's job, same as this file). The TTL in agent-ledger.mjs drops to
// a 60-minute BACKSTOP for the one case SubagentStop cannot cover: the host process killed between
// dispatch and stop, where no SubagentStop can ever fire — the crash path this rule was always
// centrally about, still handled by real OS pid-liveness (tasklist), unchanged from the original
// design and still proven live in the test suite.
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
export const TOOLS = ['Agent'];
export const RULE_IDS = ['10.5a'];

import { evaluate as suitePortProbe } from './no-concurrent-suite-run.mjs';
import {
  ledgerPath, ttlMs, currentHostPid, readLedger, writeLedger, pruneLive, withLedgerLock,
} from '../lib/agent-ledger.mjs';

const SOFT_CEILING = 3; // §10.5a: "≤3 קלים" — the 4th concurrently-live dispatch warns.
const HARD_CEILING = 5; // §10.5a: "≤5 קשיח" — the 6th concurrently-live dispatch blocks.
const SUITE_BUSY_CEILING = 1; // §10.5a: "1 בזמן סוויטה/GPU" — see suiteIsBusy() below.

// GPU-busy is explicitly NOT implemented — stated plainly per the owner's ruling, not silently
// dropped. No GPU-queue signal (fixed port, lock file, or any other checkable-real-state
// convention) exists anywhere in this repo: `scratch/translate-bulk/run-queue.mjs` was a one-off
// script for a completed rollout, not a live service with a probeable address, and no other file
// in the project defines one. Suite-busy IS implemented below because a real, reusable probe
// already exists (no-concurrent-suite-run.mjs's own port check). If a real GPU-busy signal is
// ever built, this is the one place it plugs in.
async function suiteIsBusy() {
  // Reuses no-concurrent-suite-run.mjs's OWN evaluate() against a synthetic Bash `playwright test`
  // input — the exact same port probe that rule uses for its own decision, not a second TCP probe
  // duplicated against the same port. A `block` from that rule means "the suite port is currently
  // held", which is exactly the "suite busy" fact this rule needs; any other outcome means "not
  // busy" (or the probe couldn't tell, which fails toward "not busy" — the pipeline-wide fail-open
  // direction).
  try {
    const outcome = await suitePortProbe({ tool_name: 'Bash', tool_input: { command: 'npx playwright test' } });
    return outcome && outcome.decision === 'block';
  } catch {
    return false;
  }
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Agent') {
    return { decision: 'allow', reason: 'not an Agent dispatch — nothing to count' };
  }

  const path = ledgerPath();
  const now = Date.now();
  const ttl = ttlMs();
  const hostPid = currentHostPid();

  const busy = await suiteIsBusy();
  const hardCeiling = busy ? SUITE_BUSY_CEILING : HARD_CEILING;
  const softCeiling = busy ? SUITE_BUSY_CEILING : SOFT_CEILING;
  const busyNote = busy ? ' — a Playwright suite run is in flight, so §10.5a\'s ceiling drops to 1' : '';

  const desc = (input.tool_input && typeof input.tool_input.description === 'string')
    ? input.tool_input.description
    : null;
  const label = desc ? ` (dispatch: "${desc}")` : '';

  // R-155 Fix Round 2: read-prune-decide-write wrapped under a cross-process lock. Before this,
  // a concurrent dispatch and a concurrent SubagentStop release (or two of either) could each read
  // the same "before" ledger state and overwrite each other's result — measured live, see
  // agent-ledger.mjs's withLedgerLock header and scripts/tests/test-hooks-groupa.mjs's "R-155"
  // section for the reproduction.
  return withLedgerLock(path, () => {
    const before = readLedger(path);
    const live = pruneLive(before, now, ttl);
    const wouldBeLive = live.length + 1; // this dispatch, if allowed/warned through

    if (wouldBeLive > hardCeiling) {
      // Blocked: the dispatch never happens, so the ledger is NOT appended — only pruned (opportunistic
      // cleanup of expired/dead entries still gets written back, keeping the file from growing unbounded).
      writeLedger(path, live);
      return {
        decision: 'block',
        reason: `§10.5a (settled): ${live.length} agent(s) already live — dispatching another would `
          + `make ${wouldBeLive}, over the hard ceiling of ${hardCeiling}${busyNote}${label}. "סדרתי `
          + 'ובטוח זה ליבת החכמה" (§10.23) — let one of the live dispatches finish before starting '
          + 'another, or raise the ceiling with the owner if this genuinely needs more concurrency.',
      };
    }

    live.push({ dispatchedAt: now, hostPid });
    writeLedger(path, live);

    if (wouldBeLive > softCeiling) {
      return {
        decision: 'warn',
        reason: `§10.5a (settled): ${wouldBeLive} agent(s) now live, over the soft ceiling of `
          + `${softCeiling}${busyNote}${label} — still under the hard ceiling of ${hardCeiling}, `
          + 'allowed, but consider letting one finish before dispatching more.',
      };
    }

    return {
      decision: 'allow',
      reason: `${wouldBeLive} agent(s) live${label} — within the §10.5a soft ceiling of ${softCeiling}`,
    };
  });
}
