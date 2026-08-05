#!/usr/bin/env node
// test-select — pick which specs to run from what the diff actually touched. Phase B.
//
// The plan, §3.1: three layers instead of "everything, every time".
//
//     smoke   the paths that, if broken, mean the product is dead     every commit   <= 45s
//     area    the areas the diff touched, chosen automatically         every commit   30-90s
//     full    everything                                              release + CI    192s
//
// This is the "chosen automatically" part. It maps changed FILES to product AREAS, then areas to
// specs, using the same classification test-intel.mjs stores.
//
// THE HONEST PART, AND IT IS THE WHOLE DESIGN: when the mapping cannot tell what a change affects
// — a change to app.js, to build.py, to the config — this returns FULL. A selective runner that
// guesses narrowly is worse than no selective runner, because it produces a green tick over an
// unexamined change. Narrowing is only safe where it is CERTAIN, and it says which rule made it
// certain.
//
// Usage:
//   node scripts/test-select.mjs                  # against HEAD (staged + unstaged)
//   node scripts/test-select.mjs --base main      # against a branch point
//   node scripts/test-select.mjs --run            # run what it selected
//   node scripts/test-select.mjs --explain        # why, in full

import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, areaOf } from './test-intel.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Which product area a SOURCE file belongs to. Deliberately small: every entry is a mapping
// somebody can check, and anything not listed forces a full run rather than a guess.
const SOURCE_AREAS = [
  [/^lang\/.*\.json$/, ['i18n']],
  [/^tests\//, null],                       // a spec change means run that spec — handled below
  [/^src\/knowledge\//, ['__python__']],     // the knowledge stack has no UI surface at all
  [/^src\/memory\//, ['__python__']],
  [/^scripts\/(check-|pgmigrate|neo4jmigrate|ingest|extract|test-intel)/, ['__none__']],
  [/^docs\//, ['__none__']],
  [/^infra\//, ['__none__']],
  [/^\.github\//, ['__none__']],
  // Artefacts, not sources. Without these, taking a screenshot forces a 192-second full run —
  // which is the cost of the fail-safe landing on something that could never affect a screen.
  [/^mockups\//, ['__none__']],
  [/^backups\//, ['__none__']],
  [/^test-results\//, ['__none__']],
  [/^\.playwright-mcp\//, ['__none__']],
  [/\.(png|jpe?g|gif|webp|svg|ico|db|zip|pdf)$/i, ['__none__']],
  [/^(README|CLAUDE|LICENSE)/, ['__none__']],
];

// Files that can affect ANYTHING. Listed by name so the list is auditable, and any of them means
// full — app.js is 14.6k lines serving every screen, and pretending a diff in it is local is how
// a selective runner starts lying.
const GLOBAL_FILES = [
  /^app\.js$/, /^app\.css$/, /^build\.py$/, /^data\.py$/, /^sources\.py$/,
  /^playwright\.config\.ts$/, /^package\.json$/, /^serve\.js$/, /^sw\.js$/,
];

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function changedFiles(base) {
  const out = base
    ? git(['diff', '--name-only', `${base}...HEAD`])
    : [git(['diff', '--name-only', 'HEAD']), git(['diff', '--name-only', '--cached'])].join('\n');
  return [...new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))];
}

export function select(files) {
  const reasons = [];
  const areas = new Set();
  const directSpecs = new Set();
  let full = false;

  if (!files.length) {
    return { layer: 'none', specs: [], areas: [], reasons: ['nothing changed'], full: false };
  }

  for (const f of files) {
    if (GLOBAL_FILES.some((re) => re.test(f))) {
      full = true;
      reasons.push(`${f}: a global file — it can affect any screen, so the selection is FULL`);
      continue;
    }
    if (f.startsWith('tests/') && f.endsWith('.spec.ts')) {
      directSpecs.add(f);
      reasons.push(`${f}: the spec itself changed — run it`);
      continue;
    }
    const rule = SOURCE_AREAS.find(([re]) => re.test(f));
    if (!rule) {
      full = true;
      reasons.push(`${f}: no mapping rule covers this path — FULL rather than a guess`);
      continue;
    }
    const [, mapped] = rule;
    if (mapped === null) continue;
    if (mapped[0] === '__none__') {
      reasons.push(`${f}: does not affect the shipped app`);
      continue;
    }
    if (mapped[0] === '__python__') {
      reasons.push(`${f}: Python-side only — the UI suite is not the right check`);
      continue;
    }
    for (const a of mapped) areas.add(a);
    reasons.push(`${f}: area ${mapped.join(', ')}`);
  }

  if (full) return { layer: 'full', specs: [], areas: [...areas], reasons, full: true };

  const db = open();
  const bySpec = new Map(db.prepare('SELECT spec, area FROM specs').all().map((r) => [r.spec, r.area]));
  db.close();

  const specs = new Set(directSpecs);
  for (const [spec, area] of bySpec) if (areas.has(area)) specs.add(spec);

  if (!specs.size) {
    return { layer: 'none', specs: [], areas: [...areas], reasons, full: false };
  }
  return { layer: 'area', specs: [...specs].sort(), areas: [...areas], reasons, full: false };
}

if (process.argv[1]?.endsWith('test-select.mjs')) {
  const args = process.argv.slice(2);
  const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
  const files = changedFiles(base);
  const sel = select(files);

  console.log(`  changed files: ${files.length}`);
  if (args.includes('--explain')) for (const r of sel.reasons) console.log(`    ${r}`);
  console.log(`  layer: ${sel.layer.toUpperCase()}${sel.areas.length ? ` · areas: ${sel.areas.join(', ')}` : ''}`);

  if (sel.layer === 'none') {
    console.log('  nothing to run: no change reaches the shipped app.');
    process.exit(0);
  }
  if (sel.full) {
    console.log('  the whole suite, because the diff touches something that can affect any screen.');
  } else {
    console.log(`  ${sel.specs.length} spec(s):`);
    for (const s of sel.specs.slice(0, 12)) console.log(`    ${s}`);
    if (sel.specs.length > 12) console.log(`    ... and ${sel.specs.length - 12} more`);
  }

  if (args.includes('--run')) {
    const specArgs = sel.full ? [] : sel.specs;
    console.log(`\n  running (layer=${sel.layer}) ...\n`);
    const r = spawnSync('npx', ['playwright', 'test', ...specArgs], {
      cwd: ROOT, stdio: 'inherit', shell: true,
      env: { ...process.env, TEST_INTEL_LAYER: sel.layer, TEST_INTEL_FILTER: sel.full ? null : sel.specs.join(' ') },
    });
    process.exit(r.status ?? 1);
  }
}
