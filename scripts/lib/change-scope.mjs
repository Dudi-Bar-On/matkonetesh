// scripts/lib/change-scope.mjs — ONE place that decides whether a change is prose-only (R-149).
//
// WHY THIS EXISTS. 37 commits landed on 2026-08-11 and zero touched the product, yet every one paid
// for the local pre-commit's full `pytest tests/` — ~13 minutes and growing. The owner's own words:
// "the same process is required for a plain repo update as for a whole test suite — that cannot
// happen on every push, maybe we need a discriminating criterion." This module is that criterion,
// for the ONE call site that still needs a script decision at all: check-pytest.mjs, invoked from
// .githooks/pre-commit. (The sibling CI question — does a push touch the PRODUCT, so the Playwright
// job should run — is answered natively by GitHub's own `paths:` filter on
// .github/workflows/product.yml, per the owner's later instruction: "the fact that both go through
// CI doesn't mean it has to be the SAME CI." No script decides that one; there is nothing to share
// a helper with there, and duplicating the product-path list into a second detector here would be
// exactly the R-116 shape this file exists to avoid, not a way to honor it.)
//
// R-116 / R-128 / R-129: one shared helper, used at its one call site, not a path list re-typed
// per-script. scripts/lib/python-interpreter.mjs (R-147) is the shape this follows — small, pure
// exports, a documented test seam instead of mocking spawnSync.
//
// THE CRITERION (owner-specified, not invented here): prose-only means every changed file is under
// docs/**, is a *.md file, is under .superpowers/**, or is under mockups/**. Anything else — any
// .py, .mjs, .js, .ts, .css, .json, .yml, or a hook config — is NOT prose, because check-pytest
// verifies the *infrastructure*: it drives .mjs gates, hook rules and observers as subprocesses, so
// a change to any of those needs the suite exactly as much as a change to a .py file does.
//
// FAIL OPEN. Every predicate below returns `run: true` whenever the changed-file list could not be
// determined. Getting this wrong in the safe direction costs a slower commit; getting it wrong in
// the unsafe direction is a silently unverified one. R-149 is explicit: "when the changed-file list
// cannot be determined, RUN the suite." A gate that fails open into "skip" is worse than no gate.
import { spawnSync } from 'node:child_process';

// Ordered, not exhaustive by accident — this list IS the whole criterion. Extending it is a
// decision, not a convenience; a new entry widens what can skip the safety net.
export const PROSE_ONLY_PATTERNS = [
  /^docs\//,
  /\.md$/i,
  /^\.superpowers\//,
  /^mockups\//,
];

export function isProseFile(path) {
  return PROSE_ONLY_PATTERNS.some((re) => re.test(path));
}

// Runs `git diff --name-only <...diffArgs>` and reports the changed paths, or a documented
// "undetermined" result (never a thrown exception, never a silently empty list) if git could not
// answer — a non-zero exit, a spawn error, anything. cwd is required via opts so a caller never
// accidentally reads the WRONG repo's staged set.
export function getChangedFiles(diffArgs, opts = {}) {
  const r = spawnSync('git', ['diff', '--name-only', ...diffArgs], { encoding: 'utf8', ...opts });
  if (r.error) {
    return { files: null, determined: false, reason: `git diff failed to run: ${r.error.code ?? r.error.message}` };
  }
  if (r.status !== 0) {
    const firstLine = (r.stderr ?? '').trim().split(/\r?\n/)[0] || '(no stderr)';
    return { files: null, determined: false, reason: `git diff exited ${r.status}: ${firstLine}` };
  }
  const files = (r.stdout ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return { files, determined: true, reason: null };
}

// The STAGED set, not the working tree — the pre-commit hook must judge what is actually about to
// be committed, not whatever else happens to sit unstaged in the same working copy.
//
// `override` is the test seam: check-pytest.mjs's own test (scripts/tests/test-change-scope.mjs and
// scripts/tests/test-check-pytest.mjs) inject a result object here directly via
// CHECK_PYTEST_STAGED_FILES rather than staging real files in the real repo's index, exactly the
// CHECK_GENIZA_PY / CHECK_RULES_PY stub shape already used across the ten gates in
// python-interpreter.mjs — a test must never depend on, or mutate, this repo's actual git state.
export function getStagedFiles(opts = {}, override) {
  if (override) return override;
  return getChangedFiles(['--cached'], opts);
}

// Returns {run, reason} — never a bare boolean, so the call site can print the project's standard
// "what was skipped, why, and what is consequently NOT VERIFIED" shape. A skipped suite is not a
// passing suite, and this function's `reason` is what makes that visible instead of silent.
export function shouldRunPytest({ files, determined, reason }) {
  if (!determined) {
    return { run: true, reason: `changed-file list undetermined (${reason}) — failing open into running` };
  }
  if (files.length === 0) {
    return { run: false, reason: 'no staged files' };
  }
  const nonProse = files.filter((f) => !isProseFile(f));
  if (nonProse.length === 0) {
    return {
      run: false,
      reason: `prose-only change (${files.length} file${files.length === 1 ? '' : 's'}, all under docs/**, *.md, .superpowers/**, or mockups/**)`,
    };
  }
  const shown = nonProse.slice(0, 5).join(', ') + (nonProse.length > 5 ? `, ... (${nonProse.length} total)` : '');
  return { run: true, reason: `non-prose file(s) staged: ${shown}` };
}
