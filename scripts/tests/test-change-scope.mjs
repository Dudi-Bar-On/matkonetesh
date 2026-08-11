#!/usr/bin/env node
// scripts/tests/test-change-scope.mjs — self-test for scripts/lib/change-scope.mjs (R-149).
//
// Proves the prose-vs-code criterion directly, independent of check-pytest.mjs's own integration
// test (test-check-pytest.mjs), and proves the real `git diff --cached` path actually works against
// a disposable repo — not just the override seam.
import { join } from 'node:path';
import { gitAdd, gitCommit, makeGitRepo } from './test-helpers.mjs';
import {
  isProseFile,
  getChangedFiles,
  getStagedFiles,
  shouldRunPytest,
} from '../lib/change-scope.mjs';

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  if (cond) { console.log(`PASS  ${label}`); return; }
  failures++;
  console.error(`FAIL  ${label}`);
  if (detail) console.error(`      ${detail}`);
}

// --- isProseFile -----------------------------------------------------------------------------
check('docs/** is prose', isProseFile('docs/process/development-discipline.md'));
check('a bare *.md is prose', isProseFile('README.md'));
check('.superpowers/** is prose', isProseFile('.superpowers/sdd/foo/bar.txt'));
check('mockups/** is prose', isProseFile('mockups/bug1-fixed-brisket.png'));
check('a .mjs file is NOT prose', !isProseFile('scripts/check-pytest.mjs'));
check('a .py file is NOT prose', !isProseFile('data.py'));
check('a .css file is NOT prose', !isProseFile('app.css'));
check('a .yml file is NOT prose', !isProseFile('.github/workflows/infra.yml'));
check('rules.sqlite is NOT prose', !isProseFile('rules.sqlite'));

// --- shouldRunPytest: pure predicate over already-resolved results ---------------------------
check(
  'prose-only staged set → skip',
  shouldRunPytest({ files: ['docs/x.md', '.superpowers/sdd/y.md'], determined: true, reason: null }).run === false,
);
check(
  'ONE non-prose file among many prose files → run (cannot be talked into skipping)',
  shouldRunPytest({ files: ['docs/x.md', 'scripts/check-pytest.mjs', 'docs/y.md'], determined: true, reason: null }).run === true,
);
check(
  'a bare .py change → run',
  shouldRunPytest({ files: ['data_layer_helper.py'], determined: true, reason: null }).run === true,
);
check(
  'a bare .mjs change → run (infrastructure the suite itself drives)',
  shouldRunPytest({ files: ['scripts/check-meta.mjs'], determined: true, reason: null }).run === true,
);
check(
  'undetermined change list → run (fail open)',
  shouldRunPytest({ files: null, determined: false, reason: 'simulated' }).run === true,
);
check(
  'no staged files → skip (nothing to verify)',
  shouldRunPytest({ files: [], determined: true, reason: null }).run === false,
);
check(
  'every returned decision carries a non-empty reason',
  [
    shouldRunPytest({ files: ['docs/x.md'], determined: true, reason: null }),
    shouldRunPytest({ files: ['data.py'], determined: true, reason: null }),
    shouldRunPytest({ files: null, determined: false, reason: 'simulated' }),
  ].every((d) => typeof d.reason === 'string' && d.reason.length > 0),
);

// --- getChangedFiles: undetermined on a bad git invocation ------------------------------------
const badCwd = getChangedFiles(['--cached'], { cwd: join(process.cwd(), 'this-path-does-not-exist-xyz') });
check(
  'a git invocation that cannot run reports undetermined, not a thrown exception or an empty list',
  badCwd.determined === false && badCwd.files === null && typeof badCwd.reason === 'string',
  JSON.stringify(badCwd),
);

// --- getStagedFiles against a REAL disposable git repo (not the override seam) ----------------
const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
gitAdd(repo, 'docs/plan.md', '# plan\n');
gitAdd(repo, 'scripts/tool.mjs', 'export const x = 1;\n');
const staged = getStagedFiles({ cwd: repo });
check(
  'getStagedFiles sees both newly staged files via real git diff --cached',
  staged.determined === true
    && staged.files.includes('docs/plan.md')
    && staged.files.includes('scripts/tool.mjs'),
  JSON.stringify(staged),
);
check(
  'a real staged mixed set correctly resolves to run:true',
  shouldRunPytest(staged).run === true,
  JSON.stringify(shouldRunPytest(staged)),
);

// Commit, then stage ONLY a prose file — the working-tree/staged distinction must hold: an
// UNSTAGED code file sitting in the tree must not force a run, and a committed-then-untouched code
// file must not either.
gitCommit(repo, 'seed', null, '2026-08-01T00:01:00');
gitAdd(repo, 'docs/second.md', '# second\n');
// scripts/tool.mjs already committed and unmodified — NOT part of the new staged set.
const stagedProseOnly = getStagedFiles({ cwd: repo });
check(
  'staged set after a second commit correctly excludes the untouched, already-committed .mjs',
  stagedProseOnly.determined === true
    && !stagedProseOnly.files.includes('scripts/tool.mjs')
    && stagedProseOnly.files.includes('docs/second.md'),
  JSON.stringify(stagedProseOnly),
);
check(
  'that prose-only staged set resolves to run:false',
  shouldRunPytest(stagedProseOnly).run === false,
  JSON.stringify(shouldRunPytest(stagedProseOnly)),
);

console.log(`\ntest-change-scope: ${total - failures}/${total} assertions passed.`);
if (failures) { console.error(`test-change-scope: ${failures} FAILURE(S).`); process.exit(1); }
