#!/usr/bin/env node
// scripts/gate-lessons.mjs — §10.16 enforcement (Phase 0, audit fix #1).
// Prints the last dated §11 lesson; counts release(v commits since; FAILS when releases shipped
// after the newest lesson/declaration date - the "closed arc without an L-entry" drift (audit §9).
// Explicit no-lesson escape (visible, in the doc itself, inheritable by subagents):
//   a §11 line of the form  **No-lesson declaration (YYYY-MM-DD):** <arc> — reason
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = process.env.DISCIPLINE || join(ROOT, 'docs', 'process', 'development-discipline.md');
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
