// Owner request, 2026-08-10: sweep every rule for the duplication class just found — a detector
// implemented independently in two rules, where fixing one leaves the other drifting.
//
// The concrete instance: `stripDataRegions` existed and was applied to no-concurrent-suite-run.mjs
// but not to main-only-no-worktrees.mjs, so the second kept firing on prose. Same shape as R-119a
// (test_worker.py carried the UNAVAILABLE_MARKERS fix its five siblings never got).
//
// Three mechanical signals, printed for judging by eye — none of them is a verdict on its own:
//   1. A rule that inspects `tool_input.command` WITHOUT going through the shared helpers.
//   2. Identical or near-identical regex literals appearing in more than one rule file.
//   3. Shared helpers that exist but are imported by only some of the rules that plainly need them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/dudib/source/repos/matconetesh';
const RULES = join(ROOT, 'scripts/hooks/rules');
const LIB = join(ROOT, 'scripts/hooks/lib');

const files = readdirSync(RULES).filter((f) => f.endsWith('.mjs')).sort();
const src = new Map(files.map((f) => [f, readFileSync(join(RULES, f), 'utf8')]));

const libExports = new Map();
for (const f of readdirSync(LIB).filter((x) => x.endsWith('.mjs'))) {
  const t = readFileSync(join(LIB, f), 'utf8');
  for (const m of t.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/gm)) {
    libExports.set(m[1], f);
  }
}

console.log('=== 1. Bash-inspecting rules and which shared helpers they use ===\n');
const bashRules = files.filter((f) => /TOOLS\s*=\s*\[[^\]]*'Bash'/.test(src.get(f)));
for (const f of bashRules) {
  const t = src.get(f);
  const imported = [...t.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/lib\/([^']+)'/g)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
  const readsRaw = /tool_input\s*(?:&&\s*input\.tool_input\s*)?\.\s*command|tool_input\.command/.test(t);
  const strips = imported.includes('stripDataRegions');
  const segs = imported.includes('segments') || imported.includes('statements');
  const flag = readsRaw && segs && !strips ? '  <-- segments WITHOUT stripDataRegions' : '';
  console.log(`  ${f.padEnd(36)} helpers: ${imported.join(', ') || '(none)'}${flag}`);
}

console.log('\n=== 2. regex literals appearing in more than one rule file ===\n');
const seen = new Map();
for (const [f, t] of src) {
  // module-level or inline regex literals, normalised on whitespace
  for (const m of t.matchAll(/\/(?![/*])((?:\\.|\[[^\]]*\]|[^/\n\\])+)\/[gimsuy]*/g)) {
    const body = m[1];
    if (body.length < 8) continue;               // too short to be a meaningful duplicate
    const key = body.replace(/\s+/g, '');
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key).add(f);
  }
}
let dups = 0;
for (const [key, where] of seen) {
  if (where.size > 1) {
    dups += 1;
    console.log(`  /${key.slice(0, 78)}/`);
    console.log(`      in: ${[...where].join(', ')}`);
  }
}
if (dups === 0) console.log('  (none)');

console.log('\n=== 3. shared helpers, and how many rules import each ===\n');
for (const [name, file] of [...libExports].sort()) {
  const users = files.filter((f) => new RegExp(`\\b${name}\\b`).test(src.get(f)));
  if (users.length > 0) {
    console.log(`  ${name.padEnd(28)} (${file})  used by ${users.length}: ${users.join(', ')}`);
  }
}

console.log(`\nscanned ${files.length} rule file(s), ${bashRules.length} of them Bash rules.`);
