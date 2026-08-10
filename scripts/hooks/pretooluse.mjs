#!/usr/bin/env node
// scripts/hooks/pretooluse.mjs — PreToolUse CLI entry point. WIRED into .claude/settings.json,
// matcher `Bash|Grep|WebSearch|Agent|browser_navigate|Edit|Write` — verified 2026-08-10 by reading
// settings.json, not by remembering. (This header claimed "NOT wired yet" for three days after it
// was wired: a stale comment in the most dangerous file in the repo, which is precisely the class
// of thing L16 exists to catch. Re-read the file, do not trust this line.)
//
// This process is spawned by Claude Code before every tool call once wired. Everything here is
// written on the assumption that a bug in this file is the single most dangerous thing that can
// be shipped into that path: it must never throw uncaught, never exit non-zero except via the
// documented, intentional codes, and never let a broken JSON.stringify() turn into a block.
//
// See pipeline.mjs for the source of the stdin/stdout contract and the reasoning behind exit 0.
import { runPipeline } from './pipeline.mjs';

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      // No piped input at all (e.g. someone runs this by hand) — treat as empty/malformed input,
      // which the pipeline already resolves to allow.
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // A stdin stream error (broken pipe, etc.) is exactly the kind of unexpected input this
    // hook must survive — resolve with whatever was read so far rather than rejecting.
    process.stdin.on('error', () => resolve(data));
  });
}

// Translates the pipeline's internal {allow|warn|block} decision into the JSON shape Claude
// Code's PreToolUse hook actually reads (hookSpecificOutput.permissionDecision). `warn` is
// intentionally NOT `ask` — per the approved design's severity test (§2), a warn-severity rule
// never interrupts the user for confirmation; it allows and reports.
function toHookOutput(decision, reason) {
  if (decision === 'block') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    };
  }
  if (decision === 'warn') {
    return {
      systemMessage: reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: reason,
      },
    };
  }
  // allow: {} is the documented "allow the operation without changes" shape.
  return {};
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }

  // Test-only overrides (never read anywhere else): lets test-hooks-groupa.mjs point the real
  // CLI at a disposable rules directory / log file instead of the repo's own scripts/hooks/rules
  // and .superpowers/hooks-log.jsonl, without touching either of those files during a test run.
  const opts = {};
  if (process.env.PRETOOLUSE_RULES_DIR) opts.rulesDir = process.env.PRETOOLUSE_RULES_DIR;
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
    process.stdout.write(JSON.stringify(toHookOutput(decision, reason)));
  } catch {
    // Even a stringify/write failure must not become a block — say nothing on stdout, which
    // Claude Code treats as "no decision" (= allow), and still exit 0 below.
  }
  process.exit(0);
}

main();
