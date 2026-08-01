// scripts/tests/test-helpers.mjs — shared fixture/assert helpers for the gate-checker self-tests.
// Every gate-hardening checker (COMPLIANCE-AUDIT-2026-08-01.md) must be PROVEN to fail on a
// known-bad input before it is trusted to pass a good one - "a checker that has never been seen to
// fail is not a checker." These helpers build disposable fixtures (temp dirs, tiny git repos) so
// each test is self-contained and never touches the real repo state.
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let failures = 0;
let total = 0;

export function assertExit(label, result, expectedCode) {
  total++;
  const got = result.status;
  if (got !== expectedCode) {
    failures++;
    console.error(`FAIL  ${label}: expected exit ${expectedCode}, got ${got}`);
    console.error(`      stdout: ${(result.stdout || '').toString().split('\n').slice(0, 6).join(' | ')}`);
    console.error(`      stderr: ${(result.stderr || '').toString().split('\n').slice(0, 6).join(' | ')}`);
    return false;
  }
  console.log(`PASS  ${label} (exit ${got})`);
  return true;
}

export function runNode(scriptPath, args, env) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

export function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeFile(dir, name, content) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content, 'utf8');
  return p;
}

export function setMtime(path, isoDate) {
  const d = new Date(isoDate);
  utimesSync(path, d, d);
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

// Builds a throwaway git repo with commits at controlled dates/subjects, for checkers that read
// `git log` (check-board-fresh, check-release audit mode, check-h9/check-brief's git-history path).
export function makeGitRepo(commits) {
  const dir = tempDir('gate-test-repo-');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Gate Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  let i = 0;
  for (const c of commits) {
    i++;
    writeFileSync(join(dir, `f${i}.txt`), c.subject, 'utf8');
    git(dir, ['add', '.']);
    const env = {
      GIT_AUTHOR_DATE: c.date,
      GIT_COMMITTER_DATE: c.date,
      GIT_AUTHOR_NAME: 'Gate Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Gate Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    const r = spawnSync('git', ['commit', '-q', '--no-gpg-sign', '-m', c.body ?? c.subject], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
    if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr}`);
  }
  return dir;
}

export function gitAdd(dir, relPath, content, dateEnv) {
  const full = join(dir, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf8');
  git(dir, ['add', relPath]);
  return full;
}

export function gitCommit(dir, subject, body, date) {
  const env = {
    GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
    GIT_AUTHOR_NAME: 'Gate Test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Gate Test', GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  const msg = body ? `${subject}\n\n${body}` : subject;
  const r = spawnSync('git', ['commit', '-q', '--no-gpg-sign', '-m', msg], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr}`);
}

export function summary(suiteName) {
  console.log(`\n${suiteName}: ${total - failures}/${total} assertions passed.`);
  if (failures) { console.error(`${suiteName}: ${failures} FAILURE(S).`); process.exitCode = 1; }
}
