#!/usr/bin/env node
// scripts/tests/test-hooks-wiring.mjs — Task 8's own DoD-mandated RED/GREEN: proves the two live
// entry points (PreToolUse -> pretooluse.mjs, SubagentStop -> subagentstop.mjs) are actually wired
// into .claude/settings.json, and that the pre-existing SessionStart block was not clobbered in the
// process (progress.md's own stated risk: "settings.json may already contain other configuration.
// Do not clobber it — read it first, merge, and keep every existing key.").
//
// Deliberately does NOT assert a PostToolUse entry: task-8-report.md records the decision not to
// wire one, because no PostToolUse rule exists yet (nothing to run there would be pure per-call
// tax with zero benefit — the same reasoning Task 2 already established for an unfocused matcher).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SETTINGS_PATH = join(ROOT, '.claude', 'settings.json');

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS  ${name}`);
    passed++;
  } else {
    console.log(`FAIL  ${name}`);
    failed++;
  }
}

let settings;
try {
  settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
} catch (err) {
  check('settings.json parses as JSON', false);
  console.log(`  error: ${err && err.message}`);
  process.exit(1);
}

const preToolUse = settings?.hooks?.PreToolUse;
check('hooks.PreToolUse is a non-empty array', Array.isArray(preToolUse) && preToolUse.length > 0);

const preEntry = Array.isArray(preToolUse) ? preToolUse[0] : undefined;
const preCommands = preEntry?.hooks?.map((h) => h.command) ?? [];
check(
  'PreToolUse runs scripts/hooks/pretooluse.mjs',
  preCommands.some((c) => typeof c === 'string' && c.includes('scripts/hooks/pretooluse.mjs')),
);
check(
  'PreToolUse matcher covers Bash, Grep, WebSearch and Agent (the tools with rules registered today)',
  typeof preEntry?.matcher === 'string'
    && ['Bash', 'Grep', 'WebSearch', 'Agent'].every((t) => preEntry.matcher.includes(t)),
);

const subagentStop = settings?.hooks?.SubagentStop;
check('hooks.SubagentStop is a non-empty array', Array.isArray(subagentStop) && subagentStop.length > 0);
const stopCommands = Array.isArray(subagentStop) ? (subagentStop[0]?.hooks?.map((h) => h.command) ?? []) : [];
check(
  'SubagentStop runs scripts/hooks/subagentstop.mjs',
  stopCommands.some((c) => typeof c === 'string' && c.includes('scripts/hooks/subagentstop.mjs')),
);

// PostToolUse is deliberately NOT wired (see file header) — this is a positive assertion of that
// decision, not an oversight: if a future task adds a PostToolUse rule and wires it, this line
// should be replaced with a real assertion at the same time, not silently left stale.
check('hooks.PostToolUse is absent (no rule exists for it yet — see file header)', settings?.hooks?.PostToolUse === undefined);

// The pre-existing SessionStart block must survive the merge untouched.
const sessionStart = settings?.hooks?.SessionStart;
check('hooks.SessionStart still present (not clobbered)', Array.isArray(sessionStart) && sessionStart.length > 0);
const sessionStartCommands = sessionStart?.[0]?.hooks?.map((h) => h.command) ?? [];
check(
  'SessionStart still runs all 5 pre-existing scripts (check-meta, session-brief, session-state, session-rules, watchman)',
  ['check-meta.mjs', 'session-brief.mjs', 'session-state.mjs', 'session-rules.mjs', 'watchman.ps1']
    .every((needle) => sessionStartCommands.some((c) => typeof c === 'string' && c.includes(needle))),
);

console.log(`\n${passed}/${passed + failed} checks passed.`);
process.exit(failed ? 1 : 0);
