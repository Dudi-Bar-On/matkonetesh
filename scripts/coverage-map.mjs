#!/usr/bin/env node
// coverage-map — the screen inventory, as a QUERY. Phase C §4.1 of the testing overhaul plan.
//
// The plan's finding, which is not softened here: 330 commits touched the UI, 14 carried a
// screenshot, ZERO described what was on screen, 87% of assertions were internal, 68 spec files
// never touched the DOM at all, and no test has ever looked at the live site. "What is untested"
// was a matter of opinion.
//
// This makes it arithmetic: every SCREEN x STATE x LANGUAGE x VIEWPORT is a row, and a row is
// covered only when a spec actually visits it. The axes come from the shipped app —
// `id="scr-*"` in the built HTML, and lang/*.json — rather than from a list somebody maintains,
// because a hand-kept inventory drifts from the product and then reports on a product that no
// longer exists.
//
// WHAT THIS DOES NOT CLAIM. A row marked covered means a spec VISITED that combination, not that
// the spec looked hard. Visual regression (§4.2) is what turns a visit into an examination; this
// tells you where nobody has been at all, which is the cheaper and more shocking half.
//
//   node scripts/coverage-map.mjs build     rebuild the matrix from the app and the specs
//   node scripts/coverage-map.mjs gaps      what nothing visits
//   node scripts/coverage-map.mjs summary   coverage by axis

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './test-intel.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// STATES — the plan names these explicitly as the ones nobody has looked at: empty, first-run,
// long text, permission denied, and the project/event/equipment/timer screens "never seen in
// action". They are a judgement about what matters, so they are listed rather than derived, and
// the list is short enough to argue with.
export const STATES = [
  ['empty', 'nothing created yet — the state every new user sees first'],
  ['first-run', 'the onboarding cards, before any flag is set'],
  ['populated', 'a real event with items, the state most tests use'],
  ['long-text', 'a name long enough to wrap or overflow'],
  ['permission-denied', 'microphone or notifications refused'],
];

export const VIEWPORTS = [
  ['390x844', 'the phone this product is designed for (DoD-8)'],
  ['1280x800', 'a desktop browser, which nobody has ever checked'],
];

function screens() {
  // From the BUILT html, not from app.js: what ships is what users meet.
  const built = join(ROOT, 'dist', 'index.html');
  const src = existsSync(built) ? built : join(ROOT, 'build.py');
  const html = readFileSync(src, 'utf8');
  return [...new Set([...html.matchAll(/id="(scr-[a-z0-9-]+)"/g)].map((m) => m[1]))].sort();
}

function languages() {
  const dir = join(ROOT, 'lang');
  const codes = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !/^_|\.data\./.test(f))
    .map((f) => f.replace(/\.json$/, ''));
  return ['he', ...codes.sort()];   // Hebrew ships in the bundle and has no dictionary file
}

// OBSERVATIONS, not inference. `.coverage-obs/observed.jsonl` is written by an auto-fixture at the
// end of every test (tests/_fixtures.ts): the screen that was actually `.on`, the language
// getLang() actually returned, the real innerWidth/innerHeight, and the seeded state.
//
// THE FIRST VERSION READ THE SPEC SOURCE WITH REGEXES and credited 15 of 170 files, producing a
// headline "4.3% covered". That number was mostly a measurement artefact: a spec reaches a screen
// by clicking, not by writing `scr-catalog` in its source. Publishing it would have been the
// "verify rendered, not the metric" failure exactly — a shocking figure that measured my detector
// rather than the suite.
function observations() {
  const f = join(ROOT, '.coverage-obs', 'observed.jsonl');
  if (!existsSync(f)) return null;
  const rows = [];
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* a torn last line mid-write */ }
  }
  return rows;
}

// The state a run was in, from what it actually had — not from what its source looked like.
function stateOf(o) {
  if (o.firstRun) return 'first-run';
  return o.hasEvents ? 'populated' : 'empty';
}

export function build(db) {
  const scr = screens();
  const langs = languages();
  const specs = readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.spec.ts'));

  db.exec('DELETE FROM coverage');
  const ins = db.prepare(
    'INSERT INTO coverage (screen, lang, viewport, state, spec) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(screen, lang, viewport, state) DO UPDATE SET spec = excluded.spec'
  );

  // Every combination exists as a row; `spec` NULL means nothing visits it.
  db.exec('BEGIN');
  for (const s of scr) for (const l of langs) for (const [v] of VIEWPORTS) for (const [st] of STATES) {
    ins.run(s, l, v, st, null);
  }
  db.exec('COMMIT');

  const obs = observations();
  if (!obs) {
    return { screens: scr.length, langs: langs.length, states: STATES.length, viewports: VIEWPORTS.length,
             total: db.prepare('SELECT count(*) n FROM coverage').get().n, covered: 0, observations: 0,
             note: 'NO OBSERVATIONS — run the suite once; the map is the empty grid, not a measurement' };
  }

  const upd = db.prepare('UPDATE coverage SET spec = ? WHERE screen = ? AND lang = ? AND viewport = ? AND state = ?');
  db.exec('BEGIN');
  for (const o of obs) {
    const st = stateOf(o);
    for (const s of o.screens ?? []) upd.run(`tests/${o.spec}`, s, o.lang, o.viewport, st);
  }
  db.exec('COMMIT');

  const total = db.prepare('SELECT count(*) n FROM coverage').get().n;
  const covered = db.prepare('SELECT count(*) n FROM coverage WHERE spec IS NOT NULL').get().n;
  return { screens: scr.length, langs: langs.length, states: STATES.length, viewports: VIEWPORTS.length,
           total, covered, observations: obs.length, specs: specs.length };
}

const COMMANDS = {
  build(db) {
    const r = build(db);
    console.log(`  axes: ${r.screens} screens x ${r.langs} languages x ${r.viewports} viewports x ${r.states} states`);
    if (r.note) return console.log(`  ${r.note}`);
    console.log(`  built from ${r.observations} RUNTIME observations across ${r.specs} spec files`);
    console.log(`  ${r.total} combinations · ${r.covered} actually rendered (${(r.covered / r.total * 100).toFixed(1)}%)`);
    console.log(`  ${r.total - r.covered} combinations NOTHING has ever rendered.`);
  },

  summary(db) {
    for (const axis of ['screen', 'lang', 'viewport', 'state']) {
      const rows = db.prepare(
        `SELECT ${axis} k, count(*) n, sum(spec IS NOT NULL) c FROM coverage GROUP BY ${axis} ORDER BY c*1.0/count(*)`
      ).all();
      console.log(`  by ${axis}:`);
      for (const r of rows) {
        const pct = (r.c / r.n * 100).toFixed(0);
        console.log(`    ${String(r.k).padEnd(20)} ${String(r.c).padStart(4)}/${String(r.n).padEnd(4)} ${pct.padStart(3)}%`);
      }
    }
  },

  gaps(db) {
    const byScreenLang = db.prepare(
      'SELECT screen, lang, count(*) n FROM coverage WHERE spec IS NULL GROUP BY screen, lang ' +
      'ORDER BY n DESC, screen, lang'
    ).all();
    const total = db.prepare('SELECT count(*) n FROM coverage WHERE spec IS NULL').get().n;
    console.log(`  ${total} combination(s) nothing visits. The worst clusters:`);
    for (const r of byScreenLang.slice(0, 20)) {
      console.log(`    ${r.screen.padEnd(14)} ${r.lang.padEnd(4)} ${r.n} untested state/viewport combination(s)`);
    }
    const langsUncovered = db.prepare(
      'SELECT lang FROM coverage GROUP BY lang HAVING sum(spec IS NOT NULL) = 0'
    ).all().map((r) => r.lang);
    if (langsUncovered.length) {
      console.log(`  languages NO spec renders at all: ${langsUncovered.join(', ')}`);
    }
  },
};

if (process.argv[1]?.endsWith('coverage-map.mjs')) {
  const db = open();
  (COMMANDS[process.argv[2] ?? 'build'] ?? COMMANDS.build)(db);
  db.close();
}
