#!/usr/bin/env node
// check-rule-provenance — the enforcement corpus has exactly one source, and that stays true.
//
// detects: a rule sitting in the mirror whose `source_path` is not the process document. That means
//   something outside the process world has started defining rules the hooks will enforce.
//
// why it exists (owner instruction, 2026-08-10): the owner saw the word "botulism" in a measurement
//   sample and asked whether rules from the app's CONTENT world — food, safety values, recipes — had
//   leaked into the infrastructure corpus, and how to find and remove them.
//
//   Measured before answering: 159 of 159 rules come from `docs/process/development-discipline.md`
//   and nowhere else. Nothing to remove. Eight rules MENTION a food term, every one as the EXAMPLE
//   of a process failure — L24 is "never cap AI output tokens low", and the smoker device-lookup
//   that returned "not found" is its evidence, not its subject. Stripping those examples would
//   leave rules whose reason nobody can reconstruct, which is how a rule becomes a slogan.
//
//   So the boundary was already right — and held by accident rather than by construction. That is
//   precisely the state this project keeps paying for: a gate that was never pointed at the corpus
//   (R-119), a lesson applied in one file and not its five siblings (R-119a), a CI report nobody
//   read (R-94). "Correct today" is not a property; "cannot become incorrect without someone being
//   told" is. This gate is the difference.
//
// does NOT detect: a rule whose TEXT is about content. That judgement needs a reader, and a gate
//   that claimed it would be L77 — a check promising more than it measures. This one asks a single
//   mechanical question, which is why it can be trusted: which file did this rule come from.
//
// reads the MIRROR (rules.sqlite, in git) rather than Postgres — the gate must work on a machine
//   with no database configured, and the mirror is what the enforcement hooks actually read.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { runPython } from './lib/python-interpreter.mjs';

// Deliberately NO `RULE_IDS` export. The first draft declared `['R-118']` and the coverage gate
// rejected it on the spot: R-118 is a REGISTER row, not a rule in the corpus, and — in its own
// words — "claiming to enforce a rule that does not exist is false coverage, worse than no
// coverage." It was right. This gate enforces an owner instruction about the corpus itself rather
// than any single rule inside it, so it counts toward no rule's coverage and says so here instead
// of borrowing a number it does not enforce.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const MIRROR = arg('--mirror', join(ROOT, 'rules.sqlite'));

// The one source. Adding to this list is an OWNER decision, not an author's convenience — the whole
// value of the gate is that widening it costs a conversation. If a second document ever legitimately
// defines rules, the entry goes here with its date and the owner's words, exactly like this one.
const ALLOWED_SOURCES = [
  'docs/process/development-discipline.md',   // the process document — owner instruction 2026-08-10
];

// Fail-open, deliberately: an absent mirror, an unreadable one, or a Python that will not start are
// all "this gate could not decide", never "you may not commit". A block whose remedy is "make my
// probe work" names no reachable alternative, which §10.24 forbids.
function undecided(why) {
  console.log(`check-rule-provenance: could not decide — ${why}. Not blocking.`);
  process.exit(0);
}

if (!MIRROR || !existsSync(MIRROR)) undecided(`no mirror at ${MIRROR ?? '(unset)'}`);

const PY = `
import sqlite3, json, sys
try:
    conn = sqlite3.connect(${JSON.stringify(MIRROR)})
    rows = conn.execute(
        "SELECT rule_id, source_path FROM rule_revisions"
    ).fetchall()
    print(json.dumps({"rows": [[r[0], r[1]] for r in rows]}))
except Exception as exc:
    print(json.dumps({"error": f"{type(exc).__name__}: {exc}"}))
`;

const { found, result: probe, tried } = runPython(['-X', 'utf8', '-c', PY], {
  encoding: 'utf8',
  timeout: 20000,
});
if (!found) {
  undecided(`could not query the mirror (no Python interpreter could be run: ${tried.join('; ')})`);
}
if (probe.status !== 0) {
  undecided(`could not query the mirror (${probe.error ? probe.error.message : `exit ${probe.status}`})`);
}

let parsed;
try {
  parsed = JSON.parse((probe.stdout || '').trim());
} catch {
  undecided('the mirror probe returned output this gate could not parse');
}
if (parsed.error) undecided(parsed.error);

const rows = parsed.rows || [];

// An empty corpus is reported OUT LOUD rather than passed silently. A gate that goes green on zero
// rows looks identical to a gate that checked 159 — and seven times in two days a probe in this
// programme reported "nothing found" while simply being broken. Green must mean "I looked".
if (rows.length === 0) {
  console.log('RULE PROVENANCE: 0 rules in the mirror — nothing to check. Reported, not silently passed.');
  process.exit(0);
}

const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
const offenders = rows.filter(([, src]) => !ALLOWED_SOURCES.includes(norm(src)));

if (offenders.length === 0) {
  const sources = [...new Set(rows.map(([, s]) => norm(s)))];
  console.log(`RULE PROVENANCE: all ${rows.length} rule(s) come from ${sources.join(', ')}.`);
  process.exit(0);
}

const bySource = new Map();
for (const [id, src] of offenders) {
  const k = norm(src);
  if (!bySource.has(k)) bySource.set(k, []);
  bySource.get(k).push(id);
}

console.log(
  `FAIL: ${offenders.length} rule(s) come from a source that does not define this project's rules:\n` +
  [...bySource.entries()].map(([src, ids]) =>
    `  ${src}\n      ${ids.join(' ')}`).join('\n') +
  `\n\n  The enforcement corpus has exactly ONE source: ${ALLOWED_SOURCES.join(', ')}.\n` +
  `  This matters most for the CONTENT plane — data.py, sources.py, docs/sources/** — because a\n` +
  `  rule extracted from a cited primary source would put food-safety text into a gate that blocks\n` +
  `  commits, and the content plane is decided by the owner and its sources, never by a hook.\n` +
  `  (R-118 / L81a: an enforcement gate scans code and process, never content.)\n\n` +
  `  The way through, and it is not a bypass: if a second document should legitimately define\n` +
  `  rules, that is an OWNER decision. Raise it in conversation, then add the path to\n` +
  `  ALLOWED_SOURCES in this file with the date and the reason beside it — the same shape as the\n` +
  `  entry already there. Widening the list quietly is the failure this gate exists to make loud.`);
process.exit(1);
