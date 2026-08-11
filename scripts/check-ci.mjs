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
// is the honest state. It blocks on a run that FAILED — with exit 1 — only when CHECK_CI_STRICT=1
// (release time); by default (commit time) a failed run is reported loudly but does not block,
// never on the absence of one.
//
// TEST SEAM: CHECK_CI_GIT / CHECK_CI_GH — absolute paths to stub executables substituted for
// `git` / `gh` (see tests/test_arc4_ci_gate.py). Unset, the real binaries are used; behaviour is
// otherwise unchanged.

import { execFileSync } from 'node:child_process';

// CHECK_CI_GIT / CHECK_CI_GH — injection seam for tests (tests/test_arc4_ci_gate.py). This gate
// reads EXTERNAL state (git, gh), so the repo-relative --root seam the other Arc 4 gates use does
// not apply; a test instead points these at stub executables. Default: the real binaries.
const GIT = process.env.CHECK_CI_GIT || 'git';
const GH = process.env.CHECK_CI_GH || 'gh';

function sh(cmd, args) {
  try {
    // shell: true — required so a stub .cmd/.bat substituted via the env seam above can run at
    // all on Windows (execFileSync without it throws EINVAL on .cmd/.bat, verified by direct
    // probe). Args here are always static, gate-authored strings, never user input, so the
    // shell-quoting caveat that comes with `shell: true` does not apply.
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: true }).trim();
  } catch {
    return null;
  }
}

const head = sh(GIT, ['rev-parse', 'HEAD']);
if (!head) {
  console.log('SKIPPED — not a git repository.');
  process.exit(0);
}

if (!sh(GH, ['--version'])) {
  console.log('SKIPPED — the gh CLI is not available, so CI state cannot be read here.');
  console.log('  NOT VERIFIED: whether CI is green. Check manually: gh run list --limit 3');
  process.exit(0);
}

// The most recent run for THIS commit. Not "the latest run" — that could belong to someone else's
// push and would report a state that has nothing to do with what is in front of you.
const raw = sh(GH, ['run', 'list', '--limit', '20', '--json',
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

const jobsRaw = sh(GH, ['run', 'view', String(run.databaseId), '--json', 'jobs']);
let jobs = [];
try {
  jobs = JSON.parse(jobsRaw ?? '{}').jobs ?? [];
} catch { /* fall through to the run-level verdict */ }

for (const j of jobs) {
  console.log(`  ${j.conclusion === 'success' ? '+' : 'x'} ${j.name}: ${j.conclusion ?? j.status}`);
}

const failed = jobs.filter((j) => j.conclusion === 'failure');
if (failed.length || run.conclusion === 'failure') {
  const names = failed.map((j) => j.name).join(', ') || run.conclusion;
  console.log(`RED: CI failed for this commit — ${names}`);
  console.log(`  gh run view ${run.databaseId} --log-failed`);

  // ADVISORY AT COMMIT TIME, BLOCKING AT RELEASE — and the distinction is not a softening, it is
  // the only way the gate can work at all.
  //
  // On its first real use this gate DEADLOCKED: CI was red on HEAD, the fix for it was in the
  // very commit being made, and the gate refused the commit because of the failure that commit
  // existed to repair. A gate that prevents the fix for the thing it reports is not strict, it is
  // broken — and the only escape would have been the skip hatch, which teaches people to reach
  // for the hatch.
  //
  // What R-94 was actually about is that check-meta could not SEE CI and reported OK for 25 red
  // runs. Reporting loudly, every time, fixes that. Blocking belongs where the state can be true
  // BEFORE the action: a release, where CI has already run on the tree being shipped.
  if (process.env.CHECK_CI_STRICT === '1') {
    console.log('  STRICT: blocking. CI must be green on the tree being released.');
    process.exit(1);
  }
  console.log('  ADVISORY here — the fix for a red CI is, by definition, a commit that does not');
  console.log('  exist yet. Set CHECK_CI_STRICT=1 before a release, where CI has already run on');
  console.log('  the tree being shipped. This is REPORTED every time; it is never silent (R-94).');
  process.exit(0);
}

console.log(`OK - CI is green for this commit (run ${run.databaseId}, ${jobs.length} job(s)).`);
