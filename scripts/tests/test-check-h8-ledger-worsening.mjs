#!/usr/bin/env node
// scripts/tests/test-check-h8-ledger-worsening.mjs — self-test for the worsening-only blocking fix
// (gate-scoping-report.md, 2026-08-01 follow-up). Direct regression test for the live-observed flaw:
// a commit that changes NOTHING about a pre-existing malformed row must NOT be blocked by it (only
// reported as standing debt); a commit that adds a NEW malformed row must still be blocked.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir, runNode, assertExit, summary, gitEnv } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-h8-ledger.mjs');

const VALID_5 = `## 5 · ledger

| Phase | closes | Δ | cumulative |
|---|---|---|---|
| Phase 1 | X-1 | 1 | 1 |
| Phase 2 | X-2 | 1 | 2 |
| Phase 3 | X-3 | 1 | 3 |
| Phase 4 | X-4 | 1 | 4 |
| Phase 5 | X-5 | 1 | 5 |
| Phase 6 | X-6 | 1 | 6 |
| Phase 7 | X-7 | 1 | 7 |
| Phase 8 | X-8 | 1 | 8 |
| Phase 9 | X-9 | 1 | 9 |
| Phase 10 | X-10 | 1 | 10 |
| Phase 11 | X-11 | 1 | 11 |

**יעד H8 הושג: 0 פריטים ללא נחיתה**

הנותרים:
- item A — טריגר: something happens
`;

const BASELINE_5A = `
## 5a · recovery ledger

| R | item | pointer | נחיתה | סטטוס |
|---|---|---|---|---|
| R-1 | pre-existing bad row | pointer text |  |  |
`;

function git(dir, args) {
  // GIT_DIR/GIT_INDEX_FILE/GIT_WORK_TREE leak from the parent process (e.g. a pre-commit hook) into
  // this child, which would make an "isolated" tmp repo silently operate on the real one. Strip them.
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv() });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

const dir = tempDir('h8-worsen-');
git(dir, ['init', '-q']);
git(dir, ['config', 'user.email', 'test@example.com']);
git(dir, ['config', 'user.name', 'Gate Test']);
git(dir, ['config', 'commit.gpgsign', 'false']);
mkdirSync(join(dir, 'docs'), { recursive: true });
const roadPath = join(dir, 'docs', 'road.md');
writeFileSync(roadPath, VALID_5 + BASELINE_5A, 'utf8');
git(dir, ['add', 'docs/road.md']);
git(dir, ['commit', '-q', '--no-gpg-sign', '-m', 'baseline: one pre-existing malformed §5a row']);

// GREEN: working tree identical to HEAD -> the pre-existing R-1 finding is standing debt only -> exit 0.
const unchangedResult = runNode(SCRIPT, [], { ROADMAP: roadPath, GITROOT: dir });
assertExit('unchanged pre-existing debt does not block', unchangedResult, 0);
if (!/STANDING DEBT/.test(unchangedResult.stdout) || !/R-1/.test(unchangedResult.stdout)) {
  console.error('FAIL  expected stdout to report R-1 under STANDING DEBT');
  process.exitCode = 1;
} else {
  console.log('PASS  pre-existing R-1 finding is printed as standing debt');
}

// RED: append a NEW malformed row to the working tree (uncommitted, simulating "this commit's diff")
// -> the new row's findings must block, while R-1 remains reported-only.
appendFileSync(roadPath, '| R-2 | newly introduced bad row | pointer text |  |  |\n', 'utf8');
const worsenedResult = runNode(SCRIPT, [], { ROADMAP: roadPath, GITROOT: dir });
assertExit('newly introduced malformed row blocks', worsenedResult, 1);
if (!/NEW OR STRUCTURAL/.test(worsenedResult.stderr) || !/R-2/.test(worsenedResult.stderr)) {
  console.error('FAIL  expected stderr to name R-2 under NEW OR STRUCTURAL');
  process.exitCode = 1;
} else {
  console.log('PASS  new R-2 finding is named as blocking');
}
if (!/STANDING DEBT/.test(worsenedResult.stdout) || !/R-1/.test(worsenedResult.stdout)) {
  console.error('FAIL  expected R-1 to still be reported as standing debt, not re-blocked');
  process.exitCode = 1;
} else {
  console.log('PASS  pre-existing R-1 finding still reported as standing debt, not re-blocked');
}

// Sanity: with no baseline reachable (BASELINE_ROADMAP unset, GITROOT points outside any repo dir
// containing the file, forcing git show to fail), every finding is treated as new -> safe default.
const noGitDir = tempDir('h8-worsen-nogit-');
mkdirSync(join(noGitDir, 'docs'), { recursive: true });
const noGitRoad = join(noGitDir, 'docs', 'road.md');
writeFileSync(noGitRoad, VALID_5 + BASELINE_5A, 'utf8');
const noBaselineResult = runNode(SCRIPT, [], { ROADMAP: noGitRoad, GITROOT: noGitDir });
assertExit('no baseline available -> safe default treats existing finding as new -> exit 1', noBaselineResult, 1);
if (!/baseline: NONE AVAILABLE/.test(noBaselineResult.stdout)) {
  console.error('FAIL  expected stdout to say baseline is NONE AVAILABLE');
  process.exitCode = 1;
} else {
  console.log('PASS  missing baseline is stated explicitly, not silently assumed');
}

summary('check-h8-ledger-worsening');
