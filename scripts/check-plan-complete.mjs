#!/usr/bin/env node
// scripts/check-plan-complete.mjs — mechanical plan-completeness gate (Phase 0, audit fix #5; lesson L27).
// A generated plan is never submitted to review before this exits 0 (discipline §2).
// Detects the CP2 failure shape: tasks with zero fenced code blocks, and a file truncated inside a fence.
// Usage: node scripts/check-plan-complete.mjs <plan.md> [--min-blocks N]
//
// Arc 2 Phase 2 (Task 4): the scan body is now exported as checkPlanText() so the Edit|Write
// hook rule (one-pipeline.mjs, rule 2) applies the SAME check to a plan's content at write time
// — one detector, two call sites, zero drift. CLI behaviour is unchanged (diffed against the
// pre-refactor output on a real plan as this task's regression evidence).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkPlanText(text, MIN = 1) {
  const lines = text.split(/\r?\n/);
  const FENCE = /^[ \t]*```/;            // fences may be indented (the rejected CP2 draft indents them)
  const TASK = /^#{2,3}\s+Task\s+\d+/;   // "## Task N" or "### Task N"

  const tasks = [];
  let cur = null, fenceOpen = false, totalFences = 0;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      totalFences++; fenceOpen = !fenceOpen;
      if (fenceOpen && cur) cur.blocks++;
      continue;
    }
    if (!fenceOpen && TASK.test(lines[i])) {
      cur = { title: lines[i].trim(), line: i + 1, blocks: 0 };
      tasks.push(cur);
    }
  }

  const failures = [];
  if (tasks.length === 0) failures.push('no "## Task N" headings found — not a plan, or headings malformed');
  if (fenceOpen || totalFences % 2 === 1) failures.push('file ENDS INSIDE a code fence — truncation signature');
  for (const t of tasks) if (t.blocks < MIN)
    failures.push(`line ${t.line}: "${t.title.slice(0, 70)}" — ${t.blocks} code block(s) < ${MIN} (prose-only task = the CP2 truncation shape)`);
  return { tasks, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file) { console.error('usage: node scripts/check-plan-complete.mjs <plan.md> [--min-blocks N]'); process.exit(2); }
  const mi = args.indexOf('--min-blocks');
  const MIN = mi >= 0 ? Number(args[mi + 1]) || 1 : 1;

  let text;
  try { text = readFileSync(file, 'utf8'); }
  catch (e) { console.error(`cannot read ${file}: ${e.message}`); process.exit(2); }

  const { tasks, failures } = checkPlanText(text, MIN);
  const totalFences = (text.match(/^[ \t]*```/gm) || []).length;

  console.log(`plan: ${file}`);
  console.log(`tasks: ${tasks.length} · fenced blocks: ${tasks.reduce((s, t) => s + t.blocks, 0)} · fence lines: ${totalFences}`);
  for (const t of tasks) console.log(`  ${String(t.blocks).padStart(3)} block(s) · line ${t.line} · ${t.title.slice(0, 80)}`);
  if (failures.length) { console.error('\nFAIL:'); for (const f of failures) console.error('  x ' + f); process.exit(1); }
  console.log('OK - every task carries code, no truncation signature.');
}
