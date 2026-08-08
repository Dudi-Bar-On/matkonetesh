#!/usr/bin/env node
// scripts/gate-lessons.mjs — §10.16 enforcement (Phase 0, audit fix #1) PLUS the commit-time half
// (spec §6.3, Phase 4 Group B Task 6). Two independent gates share this file because they share one
// truth — "a lesson or an explicit no-lesson declaration is the only way to close the books on a
// failure" — but they run at DIFFERENT triggers and read DIFFERENT evidence:
//   - release(vNNN) scope (original, CLI-only, unchanged behaviour): prints the last dated §11
//     lesson; counts release(v commits since; FAILS when releases shipped after the newest lesson/
//     declaration date — the "closed arc without an L-entry" drift (audit §9).
//   - session/commit scope (new, `sessionLessonGate`): §6.3's literal rule — at `git commit`, a
//     session that has recorded failures since its last commit event, with no NEW lesson/declaration
//     line added since that commit, is blocked. `gate-lessons.mjs` used to know only the release
//     scope, so an entire arc of ordinary work could close with zero lessons and this gate stayed
//     green throughout — the explicit gap §6.3 names.
// `sessionLessonGate` is a PURE function (no I/O) so the blocking rule (lessons-before-commit.mjs)
// and its tests share exactly one truth, per the interface contract in task-6-brief.md. The CLI body
// below is now guarded by `isMain()` (the same pattern session-state.mjs already uses) so importing
// this module for `sessionLessonGate` no longer executes the release-scope gate as a side effect.
// Explicit no-lesson escape (visible, in the doc itself, inheritable by subagents):
//   a §11 line of the form  **No-lesson declaration (YYYY-MM-DD):** <arc> — reason
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = process.env.DISCIPLINE || join(ROOT, 'docs', 'process', 'development-discipline.md');

// -----------------------------------------------------------------------------------------------
// §6.3 — pure logic, no I/O. Matches a NEW (`+`-prefixed) `**L<n> ·` line or a NEW `+`-prefixed
// `**No-lesson declaration (YYYY-MM-DD)` line inside a unified diff (`git diff HEAD -- <doc>` text,
// supplied by the caller — this function never shells out itself). A line that merely EXISTS in the
// diff's context (unprefixed, or `-`-prefixed/removed) does not count: only an addition proves a
// lesson was actually WRITTEN since the last commit, which is the fact §6.3 blocks on.
// -----------------------------------------------------------------------------------------------
const NEW_LESSON_LINE_RE = /^\+.*\*\*L\d+\s*·/m;
const NEW_NO_LESSON_DECL_RE = /^\+.*\*\*No-lesson declaration \(\d{4}-\d{2}-\d{2}\)/m;

export function sessionLessonGate({ failuresSinceLastCommit, disciplineDiffText } = {}) {
  const failures = Number.isFinite(failuresSinceLastCommit) ? failuresSinceLastCommit : 0;
  if (failures <= 0) {
    return { pass: true, reason: 'no failures recorded since the last commit event this session — §6.3 does not apply, nothing to cover.' };
  }
  const diffText = typeof disciplineDiffText === 'string' ? disciplineDiffText : '';
  const hasNewLesson = NEW_LESSON_LINE_RE.test(diffText);
  const hasNewDecl = NEW_NO_LESSON_DECL_RE.test(diffText);
  if (hasNewLesson || hasNewDecl) {
    return {
      pass: true,
      reason: `${failures} failure(s) since the last commit event, covered by a new ${hasNewLesson ? '**L<n> ·** lesson line' : '**No-lesson declaration**'} added since that commit.`,
    };
  }
  return {
    pass: false,
    reason: `§10.16 / spec §6.3: ${failures} failure(s) recorded since the last commit event this `
      + 'session, and no lesson or declaration has been added since — write a §11 lesson line '
      + '(`**L<n> · <title> (YYYY-MM-DD).**`) OR add an explicit '
      + '`**No-lesson declaration (YYYY-MM-DD):** <arc> — reason` line to '
      + 'docs/process/development-discipline.md §11, then commit again.',
  };
}

function isMain() {
  try { return fileURLToPath(import.meta.url) === process.argv[1]; }
  catch { return false; }
}

if (isMain()) {
  runReleaseScopeGate();
}

function runReleaseScopeGate() {
const text = readFileSync(DOC, 'utf8');

// Dated prose lessons: "**L14 · <title> ... (2026-07-21).**" — the format used from L14 on.
// NOTE: titles WRAP across lines (L21/L22 carry their date on the wrapped second line), and some
// carry a prefix inside the parens ("(v255, 2026-07-21)") — so: find each "**LNN ·" opener, take
// the text up to the closing "**", and extract the first ISO date anywhere inside that title.
const dated = [];
{
  const re = /\*\*L(\d+)\s*·/g;
  let m;
  while ((m = re.exec(text))) {
    const close = text.indexOf('**', re.lastIndex);
    const title = text.slice(re.lastIndex, close === -1 ? re.lastIndex + 400 : close);
    const d = title.match(/(\d{4}-\d{2}-\d{2})/);
    if (d) dated.push({ n: +m[1], date: d[1] });
  }
}
const decls = [...text.matchAll(/\*\*No-lesson declaration \((\d{4}-\d{2}-\d{2})\)/g)].map(m => m[1]);
if (!dated.length) { console.error('FAIL: no dated L-entries found in §11.'); process.exit(1); }

const last = dated.reduce((a, b) => (b.n > a.n ? b : a));
const cover = [last.date, ...decls].sort().at(-1);
console.log(`last lesson: L${last.n} (${last.date}) · declarations: ${decls.length} · coverage date: ${cover}`);

const log = execSync('git log -n 500 --pretty=%cs%x09%s', { cwd: ROOT, encoding: 'utf8' });
const uncovered = log.split('\n').filter(Boolean)
  .map(l => { const i = l.indexOf('\t'); return { d: l.slice(0, i), s: l.slice(i + 1) }; })
  .filter(c => /release\(v\d+/.test(c.s) && c.d > cover);
console.log(`release(v commits dated after ${cover}: ${uncovered.length}`);
for (const c of uncovered.slice(0, 15)) console.log(`  ${c.d}  ${c.s.slice(0, 90)}`);

if (uncovered.length) {
  console.error(`\nFAIL: ${uncovered.length} release(s) shipped after the last lesson/declaration.`);
  console.error('  Write the arc\'s L-entries into discipline §11, or add an explicit line:');
  console.error('  **No-lesson declaration (YYYY-MM-DD):** <arc name> — no new lesson, reviewed.');
  process.exit(1);
}
console.log('OK - no release without lesson coverage.');
}
