// scripts/lib/python-interpreter.mjs — ONE place that resolves a Python interpreter.
//
// WHY THIS EXISTS (R-147, 2026-08-11). `py` is the Windows Python launcher — it does not exist on
// Linux. Ten gate scripts spawned a Python interpreter, and most of them either hard-coded `py` or
// omitted it from an incomplete fallback list, each written independently over several weeks. The
// first CI run on the Linux runner (`2ffcbd4`) named the result: `spawnSync py ENOENT`, directly in
// several tests and downstream of it in several more. `check-pytest.mjs` had already solved the
// resolution problem correctly — search, in order, and reject the Windows Store app-execution-alias
// stub (L59) — but the fix lived in one file instead of a shared library the other nine scripts
// could point at. R-116 forbids a second detector for a shape that already has one; R-128 and R-129
// are both this project paying for a helper applied to one sibling and not the others. This module
// is the one shared helper, and the ten scripts (check-backup-fresh, check-geniza-fresh,
// check-pytest, check-rule-provenance, check-rules-classified, check-rules-complete,
// check-rules-fresh, check-rules-mirror, check-workflows, session-rules) all resolve through it now.
import { spawnSync } from 'node:child_process';

// Search order, tried in full on every invocation. `python` first — the cross-platform name most
// Linux distros and CI images provide. `py -3` second — the WINDOWS-ONLY launcher, which ignores
// PATH and reads the registry instead; it does not exist at all on Linux (the ENOENT this module
// exists to stop). `python3` last — the POSIX name some distros ship instead of a bare `python`.
export const PYTHON_CANDIDATES = [['python', []], ['py', ['-3']], ['python3', []]];

// `python` on PATH is frequently the Microsoft Store app-execution alias: a stub that prints
// "Python was not found; run without arguments to install from the Microsoft Store" and exits
// NON-ZERO (L59). That is an ABSENCE, not a failed interpreter — treating its exit code as a real
// failure already produced a false accusation once (see check-pytest.mjs's own header, 2026-08-05).
export const STORE_STUB_PATTERN = /Python was not found;|Microsoft Store/i;

export function isStoreStub(text) {
  return STORE_STUB_PATTERN.test(text ?? '');
}

// The candidates to try for THIS invocation: the real search order, or — for a test seam
// (CHECK_GENIZA_PY, CHECK_RULES_PY, a stub .cmd passed by a caller's own env var) — exactly the one
// substituted command. A stub has no reason to exercise the fallback chain, and forcing `shell: true`
// (required on Windows to exec a `.cmd` stub) onto every untried real candidate would be wrong.
export function candidatesFor(stub) {
  return stub ? [[stub, []]] : PYTHON_CANDIDATES;
}

// Runs `spawnSync(cmd, [...pre, ...trailingArgs], spawnOpts)` for each candidate in turn (or the
// single substituted `stub`) until one actually runs an interpreter — i.e. is neither an
// ENOENT-shaped absence nor the Store alias stub. Returns the first such result, tagged with which
// command/pre-args were used, so a caller that needs a SECOND invocation in the same process (a
// self-heal repair, a post-repair recheck) can reuse the exact interpreter that worked instead of
// re-resolving and risking a different answer. Returns `found: false` with the full `tried` trail
// (never silently) when nothing runs — a gate degrading on this must say so, not guess.
export function runPython(trailingArgs, spawnOpts = {}, { stub } = {}) {
  const candidates = candidatesFor(stub);
  const tried = [];
  for (const [cmd, pre] of candidates) {
    const r = spawnSync(cmd, [...pre, ...trailingArgs], {
      ...spawnOpts,
      shell: stub ? true : spawnOpts.shell,
    });
    if (r.error || r.status === null) {
      tried.push(`${cmd}: ${r.error?.code ?? 'no exit status'}`);
      continue;
    }
    if (isStoreStub(`${r.stdout ?? ''}${r.stderr ?? ''}`)) {
      tried.push(`${cmd}: Windows Store alias stub, not an interpreter`);
      continue;
    }
    return { found: true, result: r, cmd, pre, usedLabel: [cmd, ...pre].join(' '), tried };
  }
  return { found: false, result: null, cmd: null, pre: [], usedLabel: null, tried };
}
