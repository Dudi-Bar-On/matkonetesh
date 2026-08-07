#!/usr/bin/env node
// scripts/hooks/subagentstop.mjs — SubagentStop CLI entry point (Task 5, Fix Round 1). NOT wired
// into .claude/settings.json yet — same status as pretooluse.mjs, Task 8's job.
//
// PURPOSE: the completion half of §10.5a's agent-concurrency ceiling. agent-concurrency-ceiling.mjs
// (a PreToolUse:Agent rule) records a ledger entry on every dispatch; this script is the ONLY
// thing that retires one when an agent finishes normally. Without it, the ledger only ever grows
// within a session (see scripts/hooks/lib/agent-ledger.mjs's header for the measured failure this
// fixes: six strictly-sequential dispatches produced two warns and two blocks with no completion
// signal in the loop at all).
//
// SAME FAIL-OPEN DISCIPLINE AS pretooluse.mjs, DELIBERATELY, PER THE FIX INSTRUCTIONS: this
// process is spawned by Claude Code on every subagent completion once wired. A bug here must never
// throw uncaught, never exit non-zero in a way Claude Code could read as a failure worth
// surfacing, and never let a broken read/write turn into a stuck ledger. Per
// docs/vendor/claude-code/claude-code-docs-49.md: "Stop and SubagentStop: Claude Code shows a
// warning and the agent stops normally" if a hook itself fails — this script's OWN job is a pure
// side effect (release one ledger slot), so on ANY failure it simply does nothing and exits 0;
// there is no decision for Claude Code to act on either way, unlike PreToolUse.
import {
  ledgerPath, ttlMs, readLedger, writeLedger, releaseOldest,
} from './lib/agent-ledger.mjs';

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }

  // The event's own payload (agent_id, agent_transcript_path, tool_use_id, ...) is deliberately
  // NOT used to pick a specific ledger entry — see agent-ledger.mjs's header for why no reliable
  // shared identifier between the dispatch event and this one is documented to exist. Any
  // well-formed-or-not JSON on stdin has the SAME effect here: release the oldest live slot. A
  // malformed/empty payload is not a reason to skip the release — a SubagentStop firing at all
  // means SOME agent just finished, regardless of whether its own JSON parsed cleanly.
  try {
    JSON.parse(raw); // parsed only to exercise the same "was this valid JSON" discipline as
    // pretooluse.mjs; the parsed value itself is intentionally unused (see comment above).
  } catch {
    // Not fatal here — unlike pretooluse.mjs there is no permission decision to default anywhere;
    // proceed to the release below regardless.
  }

  try {
    const path = ledgerPath();
    const now = Date.now();
    const ttl = ttlMs();
    const before = readLedger(path);
    const { entries } = releaseOldest(before, now, ttl);
    writeLedger(path, entries);
  } catch {
    // A failed release must never surface as anything — worst case, one stale entry lingers
    // until the TTL backstop or a future pid-liveness check clears it. Never throw here.
  }

  try {
    process.stdout.write('{}');
  } catch {
    // Even a stdout write failure must not change the exit code below.
  }
  process.exit(0);
}

main();
