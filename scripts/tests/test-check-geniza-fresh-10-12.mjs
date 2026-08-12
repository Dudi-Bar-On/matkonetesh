#!/usr/bin/env node
// scripts/tests/test-check-geniza-fresh-10-12.mjs — self-test for the 10.12 declaration on
// check-geniza-fresh.mjs (Arc 3, Task 2).
//
// Drives the REAL script as a subprocess through its existing CHECK_GENIZA_PY stub-interpreter
// seam (documented in the script's own header) — no live PostgreSQL connection needed. Two cases:
// a stale document the stub-repair cannot actually fix (must FAIL, proving the gate does not
// silently report clean) and a fully-synced geniza (must exit 0, proving no false alarm on
// healthy work — §3.1 of the governing spec).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-geniza-fresh.mjs');

function runWithStub(stubScriptBody) {
  const dir = mkdtempSync(join(tmpdir(), 'geniza-fresh-stub-'));
  const stubPath = join(dir, process.platform === 'win32' ? 'python-stub.cmd' : 'python-stub.sh');
  writeFileSync(stubPath, stubScriptBody, 'utf8');
  if (process.platform !== 'win32') chmodSync(stubPath, 0o755);
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, CHECK_GENIZA_PY: stubPath },
  });
}

// CATCH: a stub Python interpreter that reports a stale doc, whose REPAIR invocation genuinely
// fails, must FAIL the gate overall. The stub distinguishes the two invocations by argv: `-c ...`
// is the query (the gate's PY probe), anything else is the self-heal repair call
// (scripts/ingest.py <paths...>) — real Python programs never share argv shape between those two,
// so branching on it here is faithful to how the gate actually drives the interpreter twice.
const staleStub = process.platform === 'win32'
  ? '@echo off\r\nif "%1"=="-c" (\r\n  echo {"disk": 1, "stored": 1, "missing": [], "stale": ["docs/x.md"], "orphaned": [], "pending_extraction": 0}\r\n  exit /b 0\r\n) else (\r\n  echo repair failed 1>&2\r\n  exit /b 1\r\n)\r\n'
  : '#!/bin/sh\nif [ "$1" = "-c" ]; then\n  echo \'{"disk": 1, "stored": 1, "missing": [], "stale": ["docs/x.md"], "orphaned": [], "pending_extraction": 0}\'\n  exit 0\nelse\n  echo "repair failed" >&2\n  exit 1\nfi\n';
const r1 = runWithStub(staleStub);
if (r1.status === 0) {
  console.error(`FAIL  expected nonzero exit on a stale doc whose repair the stub cannot perform, got 0: ${r1.stdout}`);
  process.exitCode = 1;
} else {
  console.log('PASS  stale document reported by the geniza query -> gate does not report clean');
}

// FALSE-ALARM: a fully-synced geniza (disk count == stored count, no missing/stale/orphaned) must
// exit 0 with no warning — this is the case that proves the gate does not fire on healthy work.
const cleanStub = process.platform === 'win32'
  ? '@echo off\r\necho {"disk": 845, "stored": 845, "missing": [], "stale": [], "orphaned": [], "pending_extraction": 0}\r\n'
  : '#!/bin/sh\necho \'{"disk": 845, "stored": 845, "missing": [], "stale": [], "orphaned": [], "pending_extraction": 0}\'\n';
const r2 = runWithStub(cleanStub);
if (r2.status !== 0) {
  console.error(`FAIL  expected exit 0 on a fully-synced geniza, got ${r2.status}: ${r2.stdout}${r2.stderr}`);
  process.exitCode = 1;
} else {
  console.log('PASS  fully-synced geniza (845/845, no drift) -> exit 0, no false alarm');
}
