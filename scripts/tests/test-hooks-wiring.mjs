#!/usr/bin/env node
// scripts/tests/test-hooks-wiring.mjs — Task 8's own DoD-mandated RED/GREEN: proves the two live
// entry points (PreToolUse -> pretooluse.mjs, SubagentStop -> subagentstop.mjs) are actually wired
// into .claude/settings.json, and that the pre-existing SessionStart block was not clobbered in the
// process (progress.md's own stated risk: "settings.json may already contain other configuration.
// Do not clobber it — read it first, merge, and keep every existing key.").
//
// Phase 4, Group B, Task 1 now wires PostToolUse -> posttooluse.mjs (the observer runner §6.1/§6.4
// stand behind). task-8-report.md's earlier decision not to wire one is superseded by that task,
// not silently reversed — see task-1-report.md.
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
  'PreToolUse matcher covers Bash, Grep, WebSearch, Agent, Edit and Write (the tools with rules '
    + 'registered today — Edit/Write added by Task 4\'s fix-cycle-limit.mjs, the first Group B rule '
    + 'that must run BEFORE the tool call it inspects, not after)',
  typeof preEntry?.matcher === 'string'
    && ['Bash', 'Grep', 'WebSearch', 'Agent', 'Edit', 'Write'].every((t) => preEntry.matcher.includes(t)),
);

const subagentStop = settings?.hooks?.SubagentStop;
check('hooks.SubagentStop is a non-empty array', Array.isArray(subagentStop) && subagentStop.length > 0);
const stopCommands = Array.isArray(subagentStop) ? (subagentStop[0]?.hooks?.map((h) => h.command) ?? []) : [];
check(
  'SubagentStop runs scripts/hooks/subagentstop.mjs',
  stopCommands.some((c) => typeof c === 'string' && c.includes('scripts/hooks/subagentstop.mjs')),
);

const postToolUse = settings?.hooks?.PostToolUse;
check('hooks.PostToolUse is a non-empty array', Array.isArray(postToolUse) && postToolUse.length > 0);
const postEntry = Array.isArray(postToolUse) ? postToolUse[0] : undefined;
const postCommands = postEntry?.hooks?.map((h) => h.command) ?? [];
check(
  'PostToolUse runs scripts/hooks/posttooluse.mjs',
  postCommands.some((c) => typeof c === 'string' && c.includes('scripts/hooks/posttooluse.mjs')),
);
check(
  'PostToolUse matcher covers Bash, Edit, Write and browser_navigate',
  typeof postEntry?.matcher === 'string'
    && ['Bash', 'Edit', 'Write', 'browser_navigate'].every((t) => postEntry.matcher.includes(t)),
);

// Fix Round 1 (coordinator ruling): PostToolUseFailure wired to the SAME script/matcher — a
// failing Bash command produces NO PostToolUse event at all (measured, see posttooluse.mjs header),
// so §6.1/§6.4's fix-cycle counter and failure-then-edit trigger structurally need this too.
const postToolUseFailure = settings?.hooks?.PostToolUseFailure;
check('hooks.PostToolUseFailure is a non-empty array', Array.isArray(postToolUseFailure) && postToolUseFailure.length > 0);
const postFailureEntry = Array.isArray(postToolUseFailure) ? postToolUseFailure[0] : undefined;
const postFailureCommands = postFailureEntry?.hooks?.map((h) => h.command) ?? [];
check(
  'PostToolUseFailure runs scripts/hooks/posttooluse.mjs (same script as PostToolUse)',
  postFailureCommands.some((c) => typeof c === 'string' && c.includes('scripts/hooks/posttooluse.mjs')),
);
check(
  'PostToolUseFailure matcher covers Bash, Edit, Write and browser_navigate',
  typeof postFailureEntry?.matcher === 'string'
    && ['Bash', 'Edit', 'Write', 'browser_navigate'].every((t) => postFailureEntry.matcher.includes(t)),
);

// Task 9: Stop -> stop.mjs (§6.4 trigger 3 — verification before a success claim).
const stop = settings?.hooks?.Stop;
check('hooks.Stop is a non-empty array', Array.isArray(stop) && stop.length > 0);
const stopCommandsWiring = Array.isArray(stop) ? (stop[0]?.hooks?.map((h) => h.command) ?? []) : [];
check(
  'Stop runs scripts/hooks/stop.mjs',
  stopCommandsWiring.some((c) => typeof c === 'string' && c.includes('scripts/hooks/stop.mjs')),
);

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
