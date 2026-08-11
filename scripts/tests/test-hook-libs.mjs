#!/usr/bin/env node
// scripts/tests/test-hook-libs.mjs — contract tests for the three shared hook helpers that had no
// test file before Task 5 of arc4-testing-the-enforcement: bash-grep-extract.mjs, stale-server.mjs,
// target-path.mjs. Written in the node style of test-bash-segments.mjs (R-116: one harness per
// shape) rather than tests/test_arc4_gate_coverage.py or tests/test_arc2_phase1_gates.py, which two
// sibling tasks are editing concurrently in this arc.
//
// Precedent (R-134): the day bash-segments.mjs got its first test, that test immediately found two
// real defects nobody predicted. These tests are written to the CONTRACT each consumer rule
// destructures, not to "whatever the code currently returns" — a pin-only suite proves nothing
// about defects it never thought to ask about.
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { extractBashGrepInvocations, isSweepTarget } from '../hooks/lib/bash-grep-extract.mjs';
import { staleServeReport } from '../hooks/lib/stale-server.mjs';
import { normPath, toolFilePath, newContent, oldContent } from '../hooks/lib/target-path.mjs';

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) { pass += 1; console.log(`PASS  ${label}`); }
  else { fail += 1; console.log(`FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

// =================================================================================================
// bash-grep-extract.mjs — consumers: symbolic-grep-use-serena.mjs (§10.17/§5.1),
// geniza-fallback-declaration.mjs (§10.13). Both destructure `.pattern`, `.isSweep`, `.path`,
// `.glob` off each returned candidate.
// =================================================================================================

// symbolic-grep-use-serena.mjs / geniza-fallback-declaration.mjs: a plain grep-with-directory-target
// must be recognized and read as a sweep (isSweepTarget: no extension on the last path segment).
{
  const out = extractBashGrepInvocations("grep -rn 'safe' src/");
  check('grep -rn pattern dir/ extracts one candidate with pattern+path',
    out.length === 1 && out[0].pattern === 'safe' && out[0].paths[0] === 'src/',
    JSON.stringify(out));
  check('a directory target is a sweep', out[0].isSweep === true);
}

// header's own counter-example: "grep" appearing as plain text inside another command's argument
// is not an invocation — the leading word of its own (only) segment is `echo`, not `grep`.
{
  const out = extractBashGrepInvocations('echo grep is a word');
  check('the word "grep" inside an unrelated command is not an invocation', Array.isArray(out) && out.length === 0, JSON.stringify(out));
}

// header: `git grep` is explicitly NOT matched — its leading word is `git`, a deliberate scope
// exclusion, not an oversight. Both consumer rules rely on this staying zero.
{
  const out = extractBashGrepInvocations('git grep -n foo');
  check('git grep is excluded (leading word is git, not grep)', out.length === 0, JSON.stringify(out));
}

// header's named "SWEEP vs KNOWN-FILE" case: a single already-known file target must NOT read as a
// sweep — geniza-fallback-declaration.mjs relies on this to stay silent on a targeted read.
{
  const out = extractBashGrepInvocations('grep -n "R-72" docs/ROADMAP-2026-07-30.md');
  check('a grep of one named file extracts a candidate', out.length === 1, JSON.stringify(out));
  check('a single named file (has an extension) is NOT a sweep', out[0].isSweep === false, JSON.stringify(out[0]));
}

// pipeline position: the SECOND segment of a pipe is still inspected on its own merits (header:
// "cmd | grep x" -> two segments, "grep x" inspected alone).
{
  const out = extractBashGrepInvocations('cat file.txt | grep x');
  check('grep as the second stage of a pipeline is still extracted', out.length === 1 && out[0].pattern === 'x', JSON.stringify(out));
  check('a pipe grep with no path argument is not a sweep', out[0].isSweep === false);
}

// rg --type md is an explicit sweep per isSweepTarget's own first branch, independent of any path.
{
  const out = extractBashGrepInvocations('rg --type md TODO');
  check('rg --type X scans every matching file: a sweep even with no path', out.length === 1 && out[0].isSweep === true, JSON.stringify(out));
  check('--type value is captured', out[0].type === 'md');
}

// case-insensitivity on the leading word only (header: "Windows tool names are conventionally
// capitalized") — findstr/Select-String consumers on Windows type these capitalized.
{
  const out = extractBashGrepInvocations('FINDSTR /n foo bar.txt');
  check('a capitalized tool name (FINDSTR) is still recognized', out.length === 1, JSON.stringify(out));
}

// -e / --pattern explicit flags must not be reinterpreted as a positional path.
{
  const out = extractBashGrepInvocations("grep -e '-foo' bar.txt");
  check('an explicit -e pattern is read as the pattern, not a path', out.length === 1 && out[0].pattern === '-foo', JSON.stringify(out));
  check('the remaining positional becomes the path', out[0].paths[0] === 'bar.txt');
}

// non-string / empty input must fail open to [] — no consumer should ever see a throw.
{
  check('undefined command yields []', Array.isArray(extractBashGrepInvocations(undefined)) && extractBashGrepInvocations(undefined).length === 0);
  check('empty-string command yields []', extractBashGrepInvocations('').length === 0);
  check('whitespace-only command yields []', extractBashGrepInvocations('   ').length === 0);
}

// isSweepTarget in isolation: multiple path arguments read as a sweep even with plain filenames.
{
  check('isSweepTarget: >1 path argument is a sweep',
    isSweepTarget({ paths: ['a.md', 'b.md'] }) === true);
  check('isSweepTarget: a wildcard glob is a sweep',
    isSweepTarget({ glob: '*.md', paths: [] }) === true);
  check('isSweepTarget: no candidate at all is not a sweep',
    isSweepTarget(null) === false && isSweepTarget(undefined) === false);
  check('isSweepTarget: a single file with an extension is not a sweep',
    isSweepTarget({ paths: ['docs/x.md'] }) === false);
  check('isSweepTarget: a path ending in a separator is a sweep (reads as a directory)',
    isSweepTarget({ paths: ['docs/'] }) === true);
}

// a Hebrew filename with a real extension must still read as a single known file, not a sweep —
// looksLikeDirectory splits on the LAST path segment and checks for a trailing "." + extension,
// which is script-agnostic, but this is exactly the class of input (non-ASCII text) that has
// broken a sibling helper's regex before (R-141's \b-vs-Hebrew case), so it is worth pinning here.
{
  const out = extractBashGrepInvocations('grep "בטיחות" מסמכים/קובץ.md');
  check('a Hebrew pattern and a Hebrew filename with an extension: not a sweep',
    out.length === 1 && out[0].isSweep === false, JSON.stringify(out));
}

// =================================================================================================
// stale-server.mjs — consumers: rules/stale-dev-server.mjs (PreToolUse, §11a/L12),
// stop-rules/ui-check-stale-build.mjs (Stop, L12). Both must treat null as "no evidence", never as
// "stale" — the header is explicit that this is a fail-open contract.
// =================================================================================================
{
  const scratch = mkdtempSync(join(tmpdir(), 'mk-stale-server-'));
  const distDir = join(scratch, 'dist');
  mkdirSync(distDir, { recursive: true });
  const distIndex = join(distDir, 'index.html');
  writeFileSync(distIndex, '<html></html>');

  const buildTimeMs = Date.parse('2026-08-11T12:00:00Z');
  utimesSync(distIndex, buildTimeMs / 1000, buildTimeMs / 1000);

  // (a) server started BEFORE the last build -> the build on disk postdates the running process ->
  // stale-dev-server.mjs / ui-check-stale-build.mjs must both warn.
  {
    const serverStartedMs = buildTimeMs - 60_000; // one minute before the build
    const report = staleServeReport({
      port: 8123,
      distDir,
      findPid: () => 4242,
      getStartTime: () => serverStartedMs,
    });
    check('server started BEFORE the build: reports stale', report && report.stale === true, JSON.stringify(report));
    check('reports the pid it found', report && report.pid === 4242);
  }

  // (b) server started AFTER the last build -> nothing on disk is newer than the running process ->
  // must NOT warn.
  {
    const serverStartedMs = buildTimeMs + 60_000; // one minute after the build
    const report = staleServeReport({
      port: 8123,
      distDir,
      findPid: () => 4242,
      getStartTime: () => serverStartedMs,
    });
    check('server started AFTER the build: reports NOT stale', report && report.stale === false, JSON.stringify(report));
  }

  // (c) no server listening on the port -> undecidable, must be null (never coerced to "stale").
  {
    const report = staleServeReport({
      port: 8123,
      distDir,
      findPid: () => null,
      getStartTime: () => { throw new Error('must not be called when no pid was found'); },
    });
    check('no listener on the port: returns null, not stale:false', report === null);
  }

  // process found but its start time is unreadable (race: it exited between the two OS calls) ->
  // still undecidable, still null.
  {
    const report = staleServeReport({
      port: 8123,
      distDir,
      findPid: () => 4242,
      getStartTime: () => null,
    });
    check('pid found but start time unreadable: returns null', report === null);
  }

  // no dist/index.html on disk at all -> nothing has been built yet -> null, and the OS calls are
  // never even attempted.
  {
    const report = staleServeReport({
      port: 8123,
      distDir: join(scratch, 'no-such-dist'),
      findPid: () => { throw new Error('must not be called when there is no build on disk'); },
      getStartTime: () => { throw new Error('must not be called when there is no build on disk'); },
    });
    check('no dist/index.html on disk: returns null without probing the OS', report === null);
  }

  rmSync(scratch, { recursive: true, force: true });
}

// =================================================================================================
// target-path.mjs — consumers: bidi-ltr-island.mjs, derived-artifact-source.mjs, locked-procedure.mjs,
// one-pipeline.mjs, spec-read-before-implementation.mjs, test-honesty.mjs, version-pin-floating.mjs,
// worker-ceiling-lock.mjs (all Edit|Write PreToolUse rules, Arc 2 Phase 2). All eight destructure
// `toolFilePath(input)` then `normPath(...)` that result, and most also read `newContent`/
// `oldContent`. The module does NOT resolve in-repo-vs-outside-root itself — every consumer does its
// own substring/endsWith match on the normalized path — so that is NOT part of this contract; the
// tests below assert what the module actually promises.
// =================================================================================================

// normPath: backslash -> forward slash, case-folded. worker-ceiling-lock.mjs relies on this to make
// `basename(normPath(fp)).startsWith('playwright.config')` work regardless of OS path style.
{
  check('normPath converts backslashes to forward slashes',
    normPath('C:\\Users\\x\\playwright.config.ts') === 'c:/users/x/playwright.config.ts');
  check('normPath lowercases', normPath('DOCS/ROADMAP.MD') === 'docs/roadmap.md');
  check('normPath is a no-op on an already-normalized relative path', normPath('scripts/build.py') === 'scripts/build.py');
  check('normPath on a non-string input returns "" (fails open, never throws)', normPath(undefined) === '' && normPath(null) === '' && normPath(42) === '');
}

// toolFilePath: only a non-empty string tool_input.file_path counts. Every consumer treats a null
// return as "this call has no target file, do not evaluate the rule".
{
  check('toolFilePath reads tool_input.file_path', toolFilePath({ tool_input: { file_path: 'a.md' } }) === 'a.md');
  check('toolFilePath returns null when tool_input is missing entirely', toolFilePath({}) === null);
  check('toolFilePath returns null when the whole input is missing', toolFilePath(undefined) === null);
  check('toolFilePath returns null when file_path is an empty string (falsy, not a real target)', toolFilePath({ tool_input: { file_path: '' } }) === null);
  check('toolFilePath returns null when file_path is not a string', toolFilePath({ tool_input: { file_path: 123 } }) === null);
}

// newContent: Write's `content` (whole file) or Edit's `new_string` (only the replacement) — NEVER
// the old text. bidi-ltr-island.mjs and worker-ceiling-lock.mjs scan exactly this for the string
// they police, so which field wins when both happen to be present matters.
{
  check('newContent reads Write-shaped content', newContent({ tool_input: { content: 'whole file' } }) === 'whole file');
  check('newContent reads Edit-shaped new_string', newContent({ tool_input: { new_string: 'replacement' } }) === 'replacement');
  check('newContent prefers content over new_string when (unusually) both are present',
    newContent({ tool_input: { content: 'C', new_string: 'N' } }) === 'C');
  check('newContent returns null when neither field is a string (undecidable, fail open)',
    newContent({ tool_input: {} }) === null);
  check('newContent returns null when tool_input itself is missing', newContent({}) === null);
}

// oldContent: Edit's `old_string` only — bidi-ltr-island.mjs uses this to confirm a flagged string
// was NOT already present pre-edit (i.e. this call is introducing it, not just moving it).
{
  check('oldContent reads Edit-shaped old_string', oldContent({ tool_input: { old_string: 'was here' } }) === 'was here');
  check('oldContent returns null for a Write call (no old_string field at all)', oldContent({ tool_input: { content: 'x' } }) === null);
  check('oldContent returns null when tool_input is missing', oldContent({}) === null);
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
