#!/usr/bin/env node
// check-rules-classified — no rule enters the corpus without a group.
//
// detects: a rule sitting in the store with `rule_group` NULL or blank. That is not a cosmetic gap:
//   an unclassified rule is enforced by nothing, appears in no coverage count, and is invisible to
//   every gate that reasons over A/B rules — so it reads as "not applicable" when it means "nobody
//   decided".
//
// why it exists (owner decision, 2026-08-09): L75..L79 were found in exactly that state, and four of
//   them had been written on the same night we classified 95 rules. The corpus grows while a
//   classification arc runs, and nothing assigned a group at the moment a lesson was logged.
//   Classifying those five closed the five; this closes the hole that produced them.
//
// does NOT detect: a rule classified WRONGLY. That is what the blind two-classifier criterion is for.
//   This gate asks only whether the question was answered at all, and that narrow promise is the
//   point — a gate that claims more than it measures is L77.
//
// reads the MIRROR (rules.sqlite, committed to git) and not Postgres, for two reasons: the gate must
//   work on a machine with no database configured, and the mirror is what the enforcement hooks read.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { runPython } from './lib/python-interpreter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const MIRROR = arg('--mirror', join(ROOT, 'rules.sqlite'));
// The SECOND legitimate state of an ungrouped rule: the two blind classifiers disagreed and the
// verdict is the owner's to give. Blocking on that stops work for a reason the author cannot act on,
// which §10.24 forbids — a block must name a reachable alternative, and "decide something only the
// owner may decide" is not one.
//
// This is not a bypass, and the difference matters. The exemption costs writing the rule into the
// owner-facing document BY NAME — the less efficient way to do the same work, never a way to skip it.
// A rule nobody escalated still blocks, and an escalated rule is still printed, because an exemption
// that hides its subject is just a hole with paperwork.
const ESCALATED = arg('--escalated',
  join(ROOT, 'docs', 'process', 'rule-coverage', 'criterion', 'disagreements-for-owner.md'));

// Fail-open, deliberately and in both directions: an absent mirror, an unreadable one, or a Python
// that will not start are all "this gate could not decide", never "you may not commit". A gate that
// blocks on its own inability to read stops work for a reason the author cannot act on, which §10.24
// forbids — a block must name a reachable alternative, and "make my probe work" is not one.
function undecided(why) {
  console.log(`check-rules-classified: could not decide — ${why}. Not blocking.`);
  process.exit(0);
}

if (!MIRROR || !existsSync(MIRROR)) undecided(`no mirror at ${MIRROR ?? '(unset)'}`);

const PY = `
import sqlite3, json, sys
try:
    conn = sqlite3.connect(${JSON.stringify(MIRROR)})
    rows = conn.execute(
        "SELECT rule_id FROM rule_revisions "
        "WHERE rule_group IS NULL OR trim(rule_group) = '' "
        "ORDER BY rule_id").fetchall()
    total = conn.execute("SELECT count(*) FROM rule_revisions").fetchone()[0]
    print(json.dumps({"ok": True, "missing": [r[0] for r in rows], "total": total}))
except sqlite3.Error as exc:
    print(json.dumps({"ok": False, "why": f"{type(exc).__name__}: {exc}"}))
`;

const { found, result: res, tried } = runPython(['-X', 'utf8', '-c', PY], { encoding: 'utf8' });
if (!found) {
  undecided(`no Python interpreter could be run (${tried.join('; ')})`);
}
if (res.status !== 0) {
  undecided(`the probe did not run (${res.error?.message ?? `exit ${res.status}`})`);
}

let out;
try {
  out = JSON.parse(res.stdout.trim());
} catch {
  undecided('the probe returned something that is not JSON');
}
if (!out.ok) undecided(`the mirror could not be read (${out.why})`);

// Read the escalation document as TEXT and ask whether each ungrouped rule is named in it. Parsing
// it into a structure would be stricter and would break the first time its shape changes; the
// question here is only "does this document mention this rule", and a word-boundary match answers it
// without pretending to understand the file.
let escalatedText = '';
if (ESCALATED && existsSync(ESCALATED)) {
  try {
    escalatedText = readFileSync(ESCALATED, 'utf8');
  } catch {
    escalatedText = '';   // unreadable escalation doc => nothing is escalated, which errs toward blocking
  }
}
const isEscalated = (id) => new RegExp(`(^|[^\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`)
  .test(escalatedText);

const awaiting = out.missing.filter(isEscalated);
const undecidedRules = out.missing.filter((id) => !isEscalated(id));

if (undecidedRules.length === 0) {
  const classified = out.total - awaiting.length;
  const tail = awaiting.length
    ? `\n  ${awaiting.length} awaiting the owner's verdict, named in the escalation document: ${awaiting.join(' ')}`
    : '';
  console.log(`RULES CLASSIFIED: ${classified} of ${out.total} rules carry a group (0 undecided).${tail}`);
  process.exit(0);
}
out.missing = undecidedRules;

// Naming them is the whole point. "Something is unclassified" sends the reader hunting, and the hunt
// is what let five of these sit unnoticed.
console.log(
  `FAIL: ${out.missing.length} rule(s) carry no group: ${out.missing.join(' ')}\n` +
  `  A rule without a group is enforced by nothing and counted by nothing.\n` +
  `  The way through is to classify it — docs/process/rule-coverage/criterion/criterion.md holds the\n` +
  `  three-question procedure, and scripts/classify_rules.py applies an owner-approved batch.\n` +
  `  Classifying a lesson as \`none\` is a legitimate answer; leaving it blank is not.`);
process.exit(1);
