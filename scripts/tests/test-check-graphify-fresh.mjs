#!/usr/bin/env node
// scripts/tests/test-check-graphify-fresh.mjs — self-test for check-graphify-fresh.mjs (R-136 Half 2).
//
// Drives the REAL script as a subprocess (runNode), against disposable git fixture repos and a
// stub `graphify` binary (a .cmd wrapper around a tiny Node script, the same "external command as
// a test seam" shape check-geniza-fresh.mjs already uses for CHECK_GENIZA_PY) — proves all four
// states the R-136 brief names: absent -> SKIP, fresh -> PASS, stale+self-heal -> PASS, stale with
// self-heal disabled -> FAIL.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { runNode, tempDir, writeFile, setMtime, makeGitRepo, gitAdd, gitCommit } from './test-helpers.mjs';

// writeFile() (test-helpers.mjs) only mkdirs its FIRST argument, not any subdirectory implied by a
// nested `name` — graphify-out/graph.json needs its parent dir made explicitly first.
function writeGraphJson(repo, content = '{}') {
  const dir = join(repo, 'graphify-out');
  mkdirSync(dir, { recursive: true });
  return writeFile(dir, 'graph.json', content);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-graphify-fresh.mjs');

let failures = 0;
let total = 0;
function check(label, cond, detail) {
  total++;
  if (cond) { console.log(`PASS  ${label}`); return; }
  failures++;
  console.error(`FAIL  ${label}`);
  if (detail) console.error(`      ${detail}`);
}

// --- a stub `graphify` binary: a .cmd wrapper (Windows shell entry) around a Node script that
// understands exactly the two invocations the gate makes: `--help` (the presence probe) and
// `update <root> --no-cluster` (the refresh). STUB_UPDATE_EXIT controls whether the refresh
// "succeeds" (writes graph.json) or fails, so both self-heal outcomes are reachable. -------------
function makeStubGraphify(dir) {
  const stubJs = writeFile(dir, 'graphify-stub.mjs', `
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const argv = process.argv.slice(2);
if (argv[0] === '--help') { console.log('graphify stub'); process.exit(0); }
if (argv[0] === 'update') {
  if (process.env.STUB_UPDATE_EXIT && process.env.STUB_UPDATE_EXIT !== '0') {
    console.error('stub: simulated refresh failure');
    process.exit(parseInt(process.env.STUB_UPDATE_EXIT, 10));
  }
  if (process.env.STUB_NO_CHANGES === '1') {
    // Mirrors real graphify (found live, 2026-08-11): a commit can touch a non-prose file and
    // still leave the extracted graph's content unchanged - graphify then leaves graph.json's
    // mtime untouched and exits 0 anyway.
    console.log('[graphify watch] No code-graph changes detected (--no-cluster); outputs left untouched.');
    process.exit(0);
  }
  const out = process.env.CHECK_GRAPHIFY_GRAPH_JSON;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ nodes: [], links: [] }), 'utf8');
  console.log('stub: refreshed graph.json');
  process.exit(0);
}
console.error('stub: unrecognised invocation ' + JSON.stringify(argv));
process.exit(2);
`);
  const stubCmd = writeFile(dir, 'graphify-stub.cmd', `@echo off\r\nnode "${stubJs}" %*\r\n`);
  return stubCmd;
}

// ================================================================================================
// STATE 1: graphify not installed -> SKIP, exit 0, names what is NOT VERIFIED.
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init' }]);
  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: 'MISSING',
  });
  check('absent graphify: exit 0 (SKIP, never blocks)', r.status === 0, r.stdout);
  check('absent graphify: says SKIPPED', /SKIPPED/.test(r.stdout));
  check('absent graphify: names what is NOT VERIFIED', /NOT VERIFIED here/.test(r.stdout), r.stdout);
}

// ================================================================================================
// STATE 2: graph already fresh (graph.json newer than the latest code-touching commit) -> PASS.
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
  gitAdd(repo, 'app.js', 'function f(){}\n');
  gitCommit(repo, 'add app.js', null, '2026-08-01T00:01:00');
  const stub = makeStubGraphify(tempDir('graphify-stub-fresh-'));
  const graphJson = writeGraphJson(repo);
  setMtime(graphJson, '2026-08-01T00:05:00'); // after the code commit

  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: stub,
    CHECK_GRAPHIFY_GRAPH_JSON: graphJson,
  });
  check('fresh graph: exit 0 (PASS)', r.status === 0, r.stdout + r.stderr);
  check('fresh graph: says OK, nothing to refresh', /OK/.test(r.stdout) && /Nothing to refresh/.test(r.stdout), r.stdout);
}

// ================================================================================================
// STATE 3: graph stale, self-heal enabled -> refreshes and PASSES.
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
  gitAdd(repo, 'app.js', 'function f(){}\n');
  gitCommit(repo, 'add app.js', null, '2026-08-05T00:00:00'); // AFTER the graph
  const stub = makeStubGraphify(tempDir('graphify-stub-heal-'));
  const graphJson = writeGraphJson(repo);
  setMtime(graphJson, '2026-08-01T00:05:00'); // BEFORE the code commit — stale

  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: stub,
    CHECK_GRAPHIFY_GRAPH_JSON: graphJson,
  });
  check('stale graph, self-heal on: exit 0 (PASS after refresh)', r.status === 0, r.stdout + r.stderr);
  check('stale graph, self-heal on: reports STALE then refreshed', /STALE/.test(r.stdout) && /refreshing/.test(r.stdout), r.stdout);
  check('stale graph, self-heal on: ends OK — refreshed', /OK .+ refreshed/.test(r.stdout), r.stdout);
}

// ================================================================================================
// STATE 3b (regression, found live 2026-08-11): graphify legitimately reports "no changes" and
// does NOT touch graph.json's mtime, even though a commit landed after it. A refresh that succeeds
// with nothing to write must still PASS — this is what broke the very first live commit attempt
// against this gate (a test-only edit whose AST extraction added no new graph content).
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
  gitAdd(repo, 'app.js', 'function f(){}\n');
  gitCommit(repo, 'add app.js', null, '2026-08-05T00:00:00'); // AFTER the graph
  const stub = makeStubGraphify(tempDir('graphify-stub-nochange-'));
  const graphJson = writeGraphJson(repo);
  setMtime(graphJson, '2026-08-01T00:05:00'); // BEFORE the code commit — stale by mtime

  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: stub,
    CHECK_GRAPHIFY_GRAPH_JSON: graphJson,
    STUB_NO_CHANGES: '1', // graphify exits 0 but never rewrites graph.json
  });
  check('stale graph, refresh reports no changes: exit 0 (PASS, not a false FAIL)', r.status === 0, r.stdout + r.stderr);
  check('stale graph, refresh reports no changes: still ends OK', /OK .+ refreshed/.test(r.stdout), r.stdout);
}

// ================================================================================================
// STATE 4a: graph stale, self-heal DISABLED (CHECK_GRAPHIFY_NO_HEAL=1) -> FAILS outright.
// THE RED THIS GATE EXISTS TO WITNESS: a gate that cannot be observed failing is not a gate.
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
  gitAdd(repo, 'app.js', 'function f(){}\n');
  gitCommit(repo, 'add app.js', null, '2026-08-05T00:00:00');
  const stub = makeStubGraphify(tempDir('graphify-stub-nofix-'));
  const graphJson = writeGraphJson(repo);
  setMtime(graphJson, '2026-08-01T00:05:00');

  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: stub,
    CHECK_GRAPHIFY_GRAPH_JSON: graphJson,
    CHECK_GRAPHIFY_NO_HEAL: '1',
  });
  check('stale graph, no-heal: exit 1 (FAIL)', r.status === 1, r.stdout + r.stderr);
  check('stale graph, no-heal: names STALE and does not attempt a refresh', /STALE/.test(r.stdout) && !/refreshing: graphify/.test(r.stdout) && /not refreshing/.test(r.stdout), r.stdout);
}

// ================================================================================================
// STATE 4b: graph stale, self-heal attempted but the refresh command itself fails -> FAIL.
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
  gitAdd(repo, 'app.js', 'function f(){}\n');
  gitCommit(repo, 'add app.js', null, '2026-08-05T00:00:00');
  const stub = makeStubGraphify(tempDir('graphify-stub-fail-'));
  const graphJson = writeGraphJson(repo);
  setMtime(graphJson, '2026-08-01T00:05:00');

  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: stub,
    CHECK_GRAPHIFY_GRAPH_JSON: graphJson,
    STUB_UPDATE_EXIT: '1',
  });
  check('stale graph, refresh fails: exit 1 (FAIL)', r.status === 1, r.stdout + r.stderr);
  check('stale graph, refresh fails: says the refresh did not fix it', /refresh did not fix it/.test(r.stdout), r.stdout);
}

// ================================================================================================
// A prose-only commit after the graph must NOT count as stale — this is the "reuses
// change-scope.mjs" guarantee, proven end-to-end rather than just by import.
// ================================================================================================
{
  const repo = makeGitRepo([{ subject: 'init', date: '2026-08-01T00:00:00' }]);
  gitAdd(repo, 'app.js', 'function f(){}\n');
  gitCommit(repo, 'add app.js', null, '2026-08-01T00:01:00');
  const stub = makeStubGraphify(tempDir('graphify-stub-prose-'));
  const graphJson = writeGraphJson(repo);
  setMtime(graphJson, '2026-08-01T00:05:00'); // after the code commit

  gitAdd(repo, 'docs/note.md', '# a note\n');
  gitCommit(repo, 'docs only', null, '2026-08-10T00:00:00'); // AFTER the graph, but prose-only

  const r = runNode(SCRIPT, [], {
    CHECK_GRAPHIFY_ROOT: repo,
    CHECK_GRAPHIFY_BIN: stub,
    CHECK_GRAPHIFY_GRAPH_JSON: graphJson,
  });
  check('a later prose-only commit does not make the graph stale', r.status === 0 && /Nothing to refresh/.test(r.stdout), r.stdout + r.stderr);
}

console.log(`\ntest-check-graphify-fresh: ${total - failures}/${total} assertions passed.`);
if (failures) { console.error(`test-check-graphify-fresh: ${failures} FAILURE(S).`); process.exit(1); }
