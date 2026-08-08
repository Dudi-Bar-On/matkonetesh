// scripts/hooks/lib/verification-target.mjs — Phase 4, Group B, Task 3. §6.1's own sentence is
// the spec for this file: "המפתח הוא הבדיקה שנכשלה, לא הקובץ שנערך" (the key is the failing TEST,
// not the edited FILE). This module answers two narrow questions, both pure functions of text —
// no I/O, no store access, no shell-out (the observer that calls this owns the 50ms hook budget;
// see posttooluse.mjs's own header):
//   classifyCommand(command)          — is this Bash command a verification run, and which runner?
//   extractFailingTargets(runner, outputText) — which specific test(s) failed, as stable string ids?
//
// ===============================================================================================
// MEASURED, NOT INVENTED — every regex below was checked against REAL command output captured in
// this repo on 2026-08-08, not against the shape the brief sketched from memory. Two of the brief's
// three sketched formats needed a real correction; both are recorded below at the point they apply.
// ===============================================================================================
//
// PYTEST — `py -3 -m pytest tests/probe.py` (a real two-test file, one deliberately failing) via
// this repo's own resolved interpreter produced, verbatim:
//   tests\probe.py:2: AssertionError
//   =========================== short test summary info ===========================
//   FAILED tests/probe.py::test_delta - assert 1 == 2
//   ========================= 1 failed, 1 passed in 0.08s =========================
// The brief's regex (/^FAILED\s+(\S+::\S+)/m) matches this UNCHANGED — note pytest itself already
// normalizes the path to forward slashes in this line even on Windows, so no separator handling
// is needed here.
//
// PLAYWRIGHT — `npx playwright test tests/probe.spec.ts` (list reporter, this repo's real config,
// two deliberately-failing tests) produced, verbatim (paths ARE backslash here — this is Playwright
// itself printing Windows paths, not a normalization pytest does and playwright doesn't):
//   ✘  2 [chromium] › tests\probe.spec.ts:3:5 › probe fail A @probe (169ms)
//   ✘  1 [chromium] › tests\probe.spec.ts:8:5 › probe fail B @probe (157ms)
//   ...
//     1) [chromium] › tests\probe.spec.ts:3:5 › probe fail A @probe ──────────────────
//     2) [chromium] › tests\probe.spec.ts:8:5 › probe fail B @probe ──────────────────
// CORRECTION to the brief's sketch: the brief's failure-LIST regex
// (/^\s+\d+\)\s+(\S+\.spec\.ts:\d+:\d+)\s*›\s*(.+)$/m) does NOT match this repo's real output —
// verified by running it against the captured text above and getting zero matches — because this
// project's playwright.config.ts names a project (`chromium`), and the reporter always prefixes
// EVERY numbered entry with `[chromium] › `, the same prefix the brief's OWN summary-line regex
// already anticipated with `(?:\[.+?\]\s*›\s*)?` but the fail-list regex did not. Rather than
// maintain two regexes with different corrections, this module uses ONLY the summary-line form
// (the `✘  N [project] › file:line:col › title (Nms)` line) as the sole playwright extraction
// source — verified against BOTH a one-failure and a two-failure real run, correctly producing one
// distinct target per failing test, numbered independently of print order. Using one source instead
// of two also avoids a subtler bug: the two regexes captured the "file › title" text with slightly
// different trimming, which would have produced two DIFFERENT target strings for what is actually
// the SAME failing test — breaking the very per-target identity §6.1 depends on.
//
// NODE-TEST — the brief describes `scripts/tests/run-all.mjs`'s "own `FAIL  label` lines", but
// run-all.mjs's own source (read, not guessed) prints only `----- <file> -----` headers and a final
// tally — it never prints a bare `FAIL` line itself. What DOES produce `FAIL  <label>` lines is the
// per-file house convention every `test-*.mjs` file already uses for its own `check()` helper
// (`console.error(\`FAIL  ${label}...\`)`, confirmed by grep across scripts/tests/*.mjs and by
// directly running a throwaway file using that exact convention) — and run-all.mjs runs each file
// with `stdio: 'inherit'`, so those FAIL lines surface through run-all's own combined output
// unchanged. The regex is unaffected by this correction (it still matches `FAIL  <label>` lines
// verbatim); only the ATTRIBUTION in this comment is corrected — the label identifies the specific
// failing assertion inside a file, not the file itself, which is arguably a MORE specific target id
// than a filename would have been.
//
// WHERE THE OUTPUT TEXT ITSELF COMES FROM (this is the observer's job, not this module's, but the
// finding belongs on record where the regexes it justifies live): PostToolUseFailure carries NO
// `tool_response` key at all (posttooluse.mjs's own header comment already establishes this from
// trivial no-output commands like `exit 7`). What that header comment does NOT say — because it was
// never measured against a command with real output — is where the captured stdout/stderr of a
// REAL failing command actually goes. Measured here, live, in this session: a real failing
// `py -3 -m pytest tests/probe.py` (bare, no trailing shell command to swallow its exit code)
// produced a PostToolUseFailure event whose `error` field was NOT the bare `"Exit code 1"` the
// trivial-command measurement showed — it was `"Exit code 1\n"` followed by the ENTIRE captured
// pytest stdout, FAILED line included. So `_outcome.raw_error` (posttooluse.mjs's normalized field,
// unchanged in shape, just richer in content than the trivial-command measurement suggested) IS the
// text `extractFailingTargets` must be run against on the failure path — there is no other place in
// the payload carrying it. Downstream code must not assume `raw_error` is always a short string.
// ===============================================================================================

const PLAYWRIGHT_CMD_RE = /(^|\s)(npx\s+)?playwright\s+test(\s|$)/;
const PYTEST_CMD_RE = /(^|\s)pytest(\s|$)/;
const RUN_ALL_CMD_RE = /node\s+scripts[\/\\]tests[\/\\]run-all\.mjs/;
const CHECK_CMD_RE = /node\s+scripts[\/\\]check-[\w-]+\.mjs/;
const TEST_FILE_CMD_RE = /node\s+scripts[\/\\]tests[\/\\]test-[\w-]+\.mjs/;

// classifyCommand(command) -> {isVerification, runner}. Bias: UNDER-classify. Every regex here
// requires the recognizable invocation shape to appear literally in the command text — no fuzzy
// matching, no "looks like it might run tests". A command this module fails to recognize costs one
// uncounted verification cycle (§6.1 stays inert for it); a command this module WRONGLY recognizes
// costs a phantom cycle that can block real work. The brief's own COUNTER-RED cases are the actual
// contract: `npm install` (exit 1 is still just "false" here, no runner), `grep -q foo file` (never
// matches any of the five patterns), `git commit` (never matches).
export function classifyCommand(command) {
  if (typeof command !== 'string' || command.trim() === '') {
    return { isVerification: false, runner: null };
  }
  if (PLAYWRIGHT_CMD_RE.test(command)) return { isVerification: true, runner: 'playwright' };
  if (PYTEST_CMD_RE.test(command)) return { isVerification: true, runner: 'pytest' };
  if (RUN_ALL_CMD_RE.test(command) || CHECK_CMD_RE.test(command) || TEST_FILE_CMD_RE.test(command)) {
    return { isVerification: true, runner: 'node-test' };
  }
  return { isVerification: false, runner: null };
}

const PYTEST_FAILED_RE = /^FAILED\s+(\S+::\S+)/gm;

// Sole playwright extraction source — see the header comment's "CORRECTION" section for why the
// brief's second (failure-list) regex was dropped rather than fixed-and-kept: keeping only one
// source is what keeps a given failing test's id IDENTICAL across repeated runs, which is the
// property §6.1's per-target counter depends on more than it depends on having the richest possible
// id. `\d*` — Playwright numbers each ✘ line but not necessarily in ascending file order (measured:
// a 2-test run printed `✘  2 ...A` then `✘  1 ...B`), so the number is not itself part of the id.
const PW_SUMMARY_RE = /^\s*[✘✗x]\s+\d*\s*(?:\[.+?\]\s*›\s*)?(.+?)(?:\s+\(\d+(?:\.\d+)?m?s\))?$/gm;

const NODE_FAIL_RE = /^FAIL\s+(.+)$/gm;

// extractFailingTargets(runner, outputText) -> string[] of stable failing-test ids, deduplicated.
// Called ONLY on a verification the caller has already determined failed — this function does not
// itself decide pass/fail, it only parses what it is given. Unparseable output (a crash before any
// test ran, a timeout, a format this module has never seen) returns [] — NEVER a guess — so the
// caller can fall back to recording an unattributed session-level failure instead of inventing a
// per-target id that might not even exist.
export function extractFailingTargets(runner, outputText) {
  if (typeof outputText !== 'string' || outputText === '') return [];
  const targets = new Set();

  if (runner === 'pytest') {
    for (const m of outputText.matchAll(PYTEST_FAILED_RE)) {
      if (m[1]) targets.add(m[1]);
    }
  } else if (runner === 'playwright') {
    for (const m of outputText.matchAll(PW_SUMMARY_RE)) {
      const t = m[1] && m[1].trim();
      if (t) targets.add(t);
    }
  } else if (runner === 'node-test') {
    for (const m of outputText.matchAll(NODE_FAIL_RE)) {
      const t = m[1] && m[1].trim();
      if (t) targets.add(t);
    }
  }

  return [...targets];
}
