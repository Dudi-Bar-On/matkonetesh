#!/usr/bin/env node
// scripts/hooks/stop.mjs — Stop CLI entry point (Phase 4, Group B, Task 9). Same skeleton as
// pretooluse.mjs, over a DIFFERENT rules directory (scripts/hooks/stop-rules/, env STOP_RULES_DIR
// for tests — pointed there so a future §10.2/§10.10 rule (Tasks 10-11, also "claim-shaped", per
// the brief) can register here too without touching PreToolUse's own pipeline or rules directory).
// Reuses runPipeline() from pipeline.mjs unmodified: the internal allow/warn/block lattice, the
// per-rule try/catch, the malformed-input handling, and the fail-open discipline are all IDENTICAL
// to PreToolUse's — only which directory is scanned, and how the final decision is translated to
// stdout, differ.
//
// Stop fires AFTER Claude has already finished composing a reply — per the vendor corpus already in
// this repo (docs/vendor/claude-code/claude-code-docs-47.md), its input carries `stop_hook_active`,
// and a `{"decision":"block","reason":...}` output makes Claude CONTINUE and address the reason
// (this is why the rule's reason text is written as an instruction TO Claude — "paste the output,
// or invoke the skill" — not as a report to a human).
//
// THE LOOP GUARD (this entry point's one genuinely novel failure mode, per the brief): a Stop hook
// that blocks its OWN continuation forever would hang the session — Claude Code sets
// `stop_hook_active: true` on the re-invocation triggered by a previous block, specifically so a
// hook can recognize "I already fired once for this stop and Claude is now trying again" and get
// out of the way. This is checked FIRST, before the rules pipeline even runs, and closed
// STRUCTURALLY (an unconditional `{}` the instant the flag is true) rather than by rule discipline —
// no rule in stop-rules/ is trusted to remember this on its own, the same reasoning
// debugging-before-fix-edit.mjs gives for centralizing the exit-classification list in ONE place
// rather than asking every rule to reimplement it correctly.
// FIX ROUND 1 (coordinator review, task-9-report.md's own claim invalidated): runPipeline()'s own
// DEFAULT_RULES_DIR is scripts/hooks/rules — the PreToolUse directory, computed relative to
// pipeline.mjs's OWN location, not this file's. Passing no `rulesDir` at all (the shape this file
// shipped with) therefore made every Stop invocation silently scan PreToolUse's rules, never
// stop-rules/, in production — the rule was fully wired and fully tested and did NOTHING on a real
// run, because every test in test-hooks-groupb.mjs set STOP_RULES_DIR, and the CLI's own "only
// override when the env var is present" logic meant a run WITHOUT that var never touched
// stop-rules/ at all. Mirrors pretooluse.mjs's actual relationship with ITS OWN directory correctly
// this time: pretooluse.mjs works by accident of both DEFAULT_RULES_DIR (pipeline.mjs's own) and
// PreToolUse's rules living in the SAME directory pipeline.mjs defaults to — that accident does not
// hold for Stop, whose real directory is a SIBLING of pipeline.mjs's default, not the default
// itself. STOP_RULES_DIR remains a test-only override; it is now applied ON TOP OF this file's own
// default, never instead of "no override at all".
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from './pipeline.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STOP_RULES_DIR = join(HERE, 'stop-rules');

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

// Translates the pipeline's internal {allow|warn|block} decision into the shape a Stop hook's
// stdout is actually read as (per the brief, task-9-brief.md step "Interfaces"): block makes Claude
// continue and address `reason`; warn surfaces `reason` as a systemMessage without blocking
// continuation; allow is the documented empty-object "no decision" shape.
export function toStopOutput(decision, reason) {
  if (decision === 'block') {
    return { decision: 'block', reason };
  }
  if (decision === 'warn') {
    return { systemMessage: reason };
  }
  return {};
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }

  // Loop guard — see header comment. Checked on a BEST-EFFORT parse of the raw input, independent
  // of runPipeline()'s own JSON parsing below: if this parse fails, stop_hook_active cannot be
  // true either way, and control falls through to the pipeline, whose own malformed-input path
  // already resolves to allow ({}) — the same terminal output this guard would have produced, so
  // nothing is lost by not special-casing a parse failure here a second time.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.stop_hook_active === true) {
      process.stdout.write('{}');
      process.exit(0);
    }
  } catch {
    // Not parseable here — see comment above; falls through to the pipeline.
  }

  // stop-rules/ is the DEFAULT for this entry point (see FIX ROUND 1 comment above) — always set,
  // never left for runPipeline() to default on its own. STOP_RULES_DIR is a test-only override ON
  // TOP of that default, same relationship pretooluse.mjs has with PRETOOLUSE_RULES_DIR over ITS
  // own default, applied here explicitly rather than relying on an accidental match.
  const opts = { rulesDir: process.env.STOP_RULES_DIR || DEFAULT_STOP_RULES_DIR };
  if (process.env.PRETOOLUSE_LOG_PATH) opts.logPath = process.env.PRETOOLUSE_LOG_PATH;

  let decision = 'allow';
  let reason = 'pipeline crashed at the top level — defaulted to allow';
  try {
    const result = await runPipeline(raw, opts);
    if (result && typeof result.decision === 'string') {
      decision = result.decision;
      reason = result.reason;
    }
  } catch {
    // runPipeline is contracted never to throw, but this is the last line of defense: whatever
    // happens above this line, the hook still resolves to allow.
  }

  try {
    process.stdout.write(JSON.stringify(toStopOutput(decision, reason)));
  } catch {
    // Even a stringify/write failure must not become a block — say nothing on stdout (= allow),
    // and still exit 0 below.
  }
  process.exit(0);
}

// Guarded, not unconditional — see posttooluse.mjs's identical comment: test-hooks-groupb.mjs
// imports this module directly to reach toStopOutput() for unit testing, and an unconditional
// main() at module load would read (and possibly hang on) that test process's own stdin.
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
