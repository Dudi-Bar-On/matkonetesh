#!/usr/bin/env node
// scripts/make-brief.mjs — build a §13-conformant task brief from a plan, or refuse.
//
// WHY THIS EXISTS. Five briefs were sliced straight out of plan text and carried none of the six
// required fields, so check-brief went red and META_SKIP_GATE=check-brief got used three times in two
// days. A gate skipped routinely is worth nothing, and the root cause was never the checker: the plan
// slice is the RAW MATERIAL of a brief, not a brief. Those five are grandfathered as historical debt
// by owner decision; this tool is the other half of that decision, so it cannot happen again.
//
// THE DESIGN CONSTRAINT THAT SHAPES EVERYTHING BELOW. It would be trivial to emit "(א) TODO" for every
// field and sail past check-brief's marker scan — and that generator would defeat the gate it was
// built to serve, while looking like compliance. So the split is deliberate:
//
//   DERIVED (the tool fills these, because they are mechanical):
//     (ב) the exact task slice from the plan · (ג) the DoD checklist · (ד) the report contract, whose
//     path follows from the brief's own name · (ו) the test-authoring contract · the standing
//     verification/concurrency/kill-on-replace clauses · the plan's Global Constraints section.
//   REQUIRED FROM THE AUTHOR (the tool refuses without them, because they are judgement):
//     (א) which spec lines this task satisfies — DoD-1 says a task with none should not exist, and no
//         parser can decide that · (ה) the primary tool, which §10.17 makes a real choice.
//
// A placeholder is rejected as firmly as an absence. "TODO" in a required field is the failure mode
// this tool exists to prevent, not a way to use it.
//
// Usage:
//   node scripts/make-brief.mjs --plan docs/superpowers/plans/<plan>.md --task 3 \
//     --out .superpowers/sdd/<arc>-task-3-brief.md \
//     --spec 'המפרט §4.2: "<ציטוט מדויק>"' --tool serena
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = process.env.TEMPLATE || join(ROOT, 'docs', 'process', 'templates', 'task-brief.md');

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}
function die(msg, hint) {
  console.error(`FAIL: ${msg}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

const planPath = arg('plan'), taskNo = arg('task'), outPath = arg('out');
const spec = arg('spec'), tool = arg('tool');

if (!planPath || !taskNo || !outPath) {
  die('usage: --plan <plan.md> --task <N> --out <brief.md> --spec "<quoted spec lines>" --tool <serena|memory|אחר>');
}
if (!existsSync(planPath)) die(`plan not found: ${planPath}`);

// ---- the two judgement fields: absent and placeholder are the same failure ----
const PLACEHOLDER = /^(todo|tbd|n\/?a|xxx|\.+|-+)$/i;
function judged(value, flag, field) {
  const v = (value || '').trim();
  if (!v) die(`--${flag} is required — it is field ${field}, and no parser can decide it for you.`,
    flag === 'spec'
      ? 'DoD-1: quote the exact spec line(s) this task satisfies. If there are none, the task should not exist.'
      : 'discipline §10.17: serena for symbol-shaped code work, the geniza (src.knowledge.retrieval) for docs. grep is a declared fallback only.');
  if (PLACEHOLDER.test(v) || /^<.*>$/.test(v)) {
    die(`--${flag} is a placeholder (${JSON.stringify(v)}), which is exactly what this tool refuses to emit.`,
      'A brief that satisfies the marker scan while saying nothing is worse than a missing brief: it reports green.');
  }
  return v;
}
const specText = judged(spec, 'spec', '(א)');
const TOOLS = ['serena', 'memory', 'אחר', 'other', 'grep'];
const toolText = judged(tool, 'tool', '(ה)');
if (!TOOLS.includes(toolText)) {
  die(`--tool must be one of: ${TOOLS.join(' | ')} (got ${JSON.stringify(toolText)}).`,
    'grep is accepted only as an explicitly declared fallback — that declaration is the point of the field.');
}

// ---- derived: the task slice, stopping at the next task so a brief never swallows its neighbours ----
const plan = readFileSync(planPath, 'utf8');
const lines = plan.split('\n');
const startRe = new RegExp(`^#{2,4}\\s*Task\\s+${taskNo}\\b`, 'i');
const start = lines.findIndex(l => startRe.test(l));
if (start < 0) die(`the plan has no "Task ${taskNo}" heading: ${planPath}`,
  'Check the number against the plan — a brief built from the wrong slice is worse than none.');
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (/^#{2,4}\s*Task\s+\d+/i.test(lines[i]) || /^##\s+(?!#)/.test(lines[i])) { end = i; break; }
}
const slice = lines.slice(start, end).join('\n').trim();

const taskTitle = (lines[start].replace(/^#+\s*/, '').trim()) || `Task ${taskNo}`;

// ---- derived: the plan's Global Constraints, verbatim ----
let constraints = '';
const gcStart = lines.findIndex(l => /^##\s+Global Constraints/i.test(l));
if (gcStart >= 0) {
  let gcEnd = lines.length;
  for (let i = gcStart + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^---\s*$/.test(lines[i])) { gcEnd = i; break; }
  }
  constraints = lines.slice(gcStart + 1, gcEnd).join('\n').trim();
}
if (!constraints) constraints = '(התוכנית אינה מגדירה Global Constraints — גבולות המשימה הם מה שכתוב ב-(ב) בלבד.)';

// ---- derived boilerplate, lifted from the template so the two can never drift apart ----
const tpl = existsSync(TEMPLATE) ? readFileSync(TEMPLATE, 'utf8') : '';
function fromTemplate(marker, fallback) {
  const i = tpl.indexOf(marker);
  if (i < 0) return fallback;
  const rest = tpl.slice(i);
  const next = rest.search(/\n\*\*\(|\n\*\*Constraints|\n\*\*Concurrency|\n\*\*Kill-on-replace|\n\*\*Verification/);
  return (next > 0 ? rest.slice(0, next) : rest).trim();
}
const dodLine = fromTemplate('**(ג)', '**(ג) DoD checklist:** discipline §3 — DoD-12, כל שורה עם ראיה.');
const testContract = fromTemplate('**(ו)', '**(ו) Test-authoring contract:** קרא `tests/TEST-AUTHORING-CONTRACT.md` לפני כתיבת בדיקה.');
const verification = fromTemplate('**Verification guidance:**', '');
const concurrency = fromTemplate('**Concurrency ceiling', '');
const killOnReplace = fromTemplate('**Kill-on-replace', '');

const reportPath = outPath.replace(/-brief\.md$/, '-report.md').replace(/\\/g, '/');

const brief = `# Brief: ${taskTitle}

> נוצר על-ידי \`scripts/make-brief.mjs\` מתוך \`${basename(planPath)}\`. השדות (א) ו-(ה) נמסרו על-ידי המחבר —
> המחולל מסרב לכתוב brief בלעדיהם, כי brief שעובר את סריקת-השדות ואינו אומר דבר גרוע מ-brief חסר.

**(א) Spec lines (DoD-1):** ${specText}

**(ב) Exact code from the plan:**

${slice}

${dodLine}

**(ד) Report contract:** report file \`${reportPath}\`; must paste: RED output, GREEN output + exit code,
screenshot paths (UI); **ends with the H9 5-row table** (מה היה · מה נעשה+ראיות [vNNN · date+time] ·
מה נשאר · איפה אנחנו [from docs/STATUS-BOARD.md] · הבא בתור).
${verification ? `\n${verification}\n` : ''}
**(ה) Primary tool:** ${toolText} ; grep = fallback מוצהר בלבד.

${testContract}
${concurrency ? `\n${concurrency}\n` : ''}${killOnReplace ? `\n${killOnReplace}\n` : ''}
**Constraints:**

${constraints}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, brief, 'utf8');
console.log(`wrote ${outPath}`);
console.log(`  task slice: lines ${start + 1}-${end} of ${basename(planPath)} (${slice.split('\n').length} line(s))`);
console.log(`  fields: (א) author · (ב) plan slice · (ג)(ד)(ו) derived from template · (ה) ${toolText}`);
