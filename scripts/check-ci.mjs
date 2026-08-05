#!/usr/bin/env node
// check-ci — the discipline gate must know what CI says, not only what it can run itself.
//
// R-94. The `playwright` job was RED for 25 consecutive runs across two days, and every report in
// that window said META GATE OK — because check-meta runs the discipline gates and the Python
// suite, and looks at neither the UI suite nor CI. That is L40 exactly: a green verdict that does
// not say what it did NOT cover.
//
// WHY THIS READS CI RATHER THAN RUNNING THE SUITE. §11a: the Playwright suite must never run
// concurrently with itself, and two racing runs once produced 12 then 127 phantom
// ERR_CONNECTION_REFUSED failures that sent a debugging session after a server bug that did not
// exist. A pre-commit hook that launches it would do exactly that. So this asks GitHub what
// already happened.
//
// WHAT IT CANNOT DO, said plainly rather than implied: it cannot tell you about code you have not
// pushed. A local commit has no CI run, and this reports NOT VERIFIED — which is information, and
// is the honest state. It blocks on a run that FAILED, never on the absence of one.

import { execFileSync } from 'node:child_process';

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const head = sh('git', ['rev-parse', 'HEAD']);
if (!head) {
  console.log('SKIPPED — not a git repository.');
  process.exit(0);
}

if (!sh('gh', ['--version'])) {
  console.log('SKIPPED — the gh CLI is not available, so CI state cannot be read here.');
  console.log('  NOT VERIFIED: whether CI is green. Check manually: gh run list --limit 3');
  process.exit(0);
}

// The most recent run for THIS commit. Not "the latest run" — that could belong to someone else's
// push and would report a state that has nothing to do with what is in front of you.
const raw = sh('gh', ['run', 'list', '--limit', '20', '--json',
  'headSha,status,conclusion,databaseId,workflowName,createdAt']);
if (!raw) {
  console.log('SKIPPED — could not reach GitHub (offline, or not authenticated).');
  console.log('  NOT VERIFIED: whether CI is green.');
  process.exit(0);
}

let runs;
try {
  runs = JSON.parse(raw);
} catch {
  console.log('SKIPPED — gh returned output this gate could not parse.');
  process.exit(0);
}

const forHead = runs.filter((r) => r.headSha === head);
console.log(`HEAD ${head.slice(0, 7)} · runs fetched: ${runs.length} · for this commit: ${forHead.length}`);

if (!forHead.length) {
  const newest = runs[0];
  console.log('NOT VERIFIED — this commit has no CI run yet (normal before a push).');
  if (newest) {
    const verdict = newest.conclusion || newest.status;
    console.log(`  the newest run on the repo is ${newest.headSha.slice(0, 7)}: ${verdict}`);
    if (newest.conclusion === 'failure') {
      console.log('  ! that run FAILED. It is not this commit, so this gate does not block —');
      console.log('    but CI is red right now and the next push inherits that problem.');
    }
  }
  console.log('  This is reported, not silently passed: a gate that could not check is not a gate that passed.');
  process.exit(0);
}

const run = forHead[0];
const inFlight = run.status !== 'completed';

if (inFlight) {
  console.log(`IN FLIGHT — run ${run.databaseId} is ${run.status}. No verdict yet.`);
  console.log('  NOT VERIFIED: whether this commit is green.');
  process.exit(0);
}

const jobsRaw = sh('gh', ['run', 'view', String(run.databaseId), '--json', 'jobs']);
let jobs = [];
try {
  jobs = JSON.parse(jobsRaw ?? '{}').jobs ?? [];
} catch { /* fall through to the run-level verdict */ }

for (const j of jobs) {
  console.log(`  ${j.conclusion === 'success' ? '+' : 'x'} ${j.name}: ${j.conclusion ?? j.status}`);
}

const failed = jobs.filter((j) => j.conclusion === 'failure');
if (failed.length || run.conclusion === 'failure') {
  console.log(`FAIL: CI is red for this commit — ${failed.map((j) => j.name).join(', ') || run.conclusion}`);
  console.log(`  gh run view ${run.databaseId} --log-failed`);
  console.log('  A suite that is red in CI blocks a release, and saying META GATE OK while it is');
  console.log('  red is how it stayed red for 25 runs (R-94).');
  process.exit(1);
}

console.log(`OK - CI is green for this commit (run ${run.databaseId}, ${jobs.length} job(s)).`);
