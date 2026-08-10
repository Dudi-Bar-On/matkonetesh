#!/usr/bin/env node
// scripts/tests/test-check-release.mjs — self-test for check-release.mjs (H7 x2 / DoD-12 / L29 / H14).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { makeGitRepo, writeFile, gitCommit, runNode, assertExit, summary, gitEnv } from './test-helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-release.mjs');

function git(cwd, args, env) {
  // GIT_DIR/GIT_INDEX_FILE/GIT_WORK_TREE leak from the parent process (e.g. a pre-commit hook) into
  // this child, which would make an "isolated" tmp repo silently operate on the real one. Strip them.
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...gitEnv(), ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

// ---------- HOOK mode (commit-msg): validates one pending commit message file ----------
const repo = makeGitRepo([{ subject: 'chore: init', date: '2026-07-01T00:00:00' }]);

// RED: weak release message (no x2, no exit code, no tree-shipped, no staged UX report) -> exit 1.
const weakMsgFile = writeFile(repo, 'weak-msg.txt', 'release(v99): a weak release\n\nSuite: 900 passed.\n');
assertExit(
  'hook mode: weak release message -> exit 1',
  runNode(SCRIPT, [weakMsgFile], { GITROOT: repo }),
  1,
);

// GREEN: strong release message + the UX report staged in the index -> exit 0.
mkdirSync(join(repo, 'docs', 'releases'), { recursive: true });
writeFileSync(join(repo, 'docs', 'releases', 'v99-ux-report.md'), '# v99 UX report\n', 'utf8');
git(repo, ['add', 'docs/releases/v99-ux-report.md']);
const strongMsgFile = writeFile(repo, 'strong-msg.txt',
  'release(v99): a strong release\n\nSuite: 900 passed x2, exit 0 both times, on the tree being shipped.\n');
assertExit(
  'hook mode: strong release message + staged UX report -> exit 0',
  runNode(SCRIPT, [strongMsgFile], { GITROOT: repo }),
  0,
);

// Non-release commit messages are always a no-op -> exit 0 regardless of content.
const nonReleaseMsgFile = writeFile(repo, 'other-msg.txt', 'fix: something unrelated\n');
assertExit(
  'hook mode: non-release commit message is a no-op -> exit 0',
  runNode(SCRIPT, [nonReleaseMsgFile], { GITROOT: repo }),
  0,
);

// ---------- AUDIT mode (no arg): scans git log for release(v commits >= RELEASE_CUTOFF ----------
const auditRepo = makeGitRepo([{ subject: 'chore: init', date: '2026-07-01T00:00:00' }]);
mkdirSync(join(auditRepo, 'docs', 'releases'), { recursive: true });
// A real, historical, WEAK release commit dated inside the enforcement window (some app change,
// deliberately WITHOUT the UX report file - that absence is exactly what H14 must catch).
writeFileSync(join(auditRepo, 'app-change.txt'), 'v50 change\n', 'utf8');
git(auditRepo, ['add', 'app-change.txt']);
gitCommit(auditRepo, 'release(v50): weak historical release', 'Suite: 900 passed.', '2026-08-05T00:00:00');

const auditDefault = runNode(SCRIPT, [], { GITROOT: auditRepo, RELEASE_CUTOFF: '2026-08-01' });
assertExit('audit mode (default): findings reported but NOT blocking -> exit 0', auditDefault, 0);
if (!/FINDINGS: 1\/1/.test(auditDefault.stderr)) {
  console.error(`FAIL  expected stderr to report "FINDINGS: 1/1", got: ${auditDefault.stderr.slice(0, 200)}`);
  process.exitCode = 1;
} else {
  console.log('PASS  audit mode correctly found the 1 weak historical release commit');
}

const auditStrict = runNode(SCRIPT, [], { GITROOT: auditRepo, RELEASE_CUTOFF: '2026-08-01', AUDIT_STRICT: '1' });
assertExit('audit mode + AUDIT_STRICT=1: same findings, now BLOCKING -> exit 1', auditStrict, 1);

// A commit before the cutoff is never enforced (history is immutable, §4 - stated, not silent).
const beforeCutoff = runNode(SCRIPT, [], { GITROOT: auditRepo, RELEASE_CUTOFF: '2026-09-01', AUDIT_STRICT: '1' });
assertExit('audit mode: commit before cutoff is out of scope -> exit 0 even with AUDIT_STRICT=1', beforeCutoff, 0);

summary('check-release');
