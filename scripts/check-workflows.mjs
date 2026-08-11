#!/usr/bin/env node
// check-workflows — refuse a GitHub Actions workflow file that GitHub will refuse.
//
// WHY THIS EXISTS, and it is a specific bill this project paid. Commit 1a9f844 added an
// upload-artifact step and left the previous step's `retention-days: 7` dangling, so it landed
// inside the NEW step's `with:` next to `retention-days: 30`. A duplicate key.
//
// Every local gate stayed green. `python -c "yaml.safe_load(...)"` said the file parsed, because
// YAML's reference behaviour for a duplicate key is last-one-wins — PyYAML does not even warn.
// GitHub's parser rejects it, so the workflow never COMPILED: six consecutive pushes produced runs
// with ZERO jobs, a `failure` conclusion, no logs to read, and the workflow's display name silently
// degraded from "tests" to its own file path. CI was dark for eleven hours and every one of those
// pushes reported a green pre-commit gate.
//
// `check-ci` did report RED each time — but advisory, by design (§10.10a: the fix for a red CI is a
// commit that does not exist yet). Advisory was the right call for a failing TEST. It is the wrong
// call for a file the service cannot even read, because that failure is fully knowable locally and
// costs nothing to catch. This gate BLOCKS.
//
// WHAT IT CHECKS — deliberately only what is decidable here, so it never becomes the gate that
// cries wolf:
//   1. duplicate mapping keys, anywhere in the file (the defect above)
//   2. the file parses at all
//   3. `on:` and `jobs:` exist, and every job has `runs-on` and a non-empty `steps`
// WHAT IT DOES NOT CHECK: expression syntax, action input names, matrix semantics. Those need
// actionlint or GitHub itself, and guessing at them here would produce false reds.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const rootArg = (() => { const i = argv.indexOf('--root'); return i === -1 ? null : argv[i + 1]; })();
const ROOT = rootArg ?? join(dirname(fileURLToPath(import.meta.url)), '..');
// fail-open on an unreadable override (§10.24):
if (rootArg && !existsSync(ROOT)) {
  console.log(`check-workflows: could not read root ${ROOT}. Not blocking.`);
  process.exit(0);
}
const DIR = join(ROOT, '.github', 'workflows');

// L59: `python` on PATH is frequently the Microsoft Store app-execution alias — a shim that prints
// "Python was not found" and exits 9009. It is not a broken Python, it is not Python, and treating
// its output as a result is how a gate reports a false verdict. Probe, and reject the stub.
const CANDIDATES = [['py', ['-3']], ['python3', []], ['python', []]];
const STORE_STUB = /Python was not found;|Microsoft Store/i;

const PY = `
import sys, json, yaml, os

# SUBCLASSES SafeLoader, deliberately. \`yaml.load\` with an arbitrary Loader executes Python via
# !!python/object tags and is a genuine hazard — but the hazard is the LOADER, not the function
# name, and SafeLoader has no such constructors. Subclassing is the documented way to change one
# constructor (here: reject duplicate keys) without giving anything else back. \`safe_load\` cannot
# be used, because it is exactly the behaviour whose silent duplicate-key tolerance let the defect
# this file exists to catch reach GitHub.
class Strict(yaml.SafeLoader):
    pass

def no_duplicates(loader, node, deep=False):
    seen, out = set(), {}
    for k, v in node.value:
        key = loader.construct_object(k, deep=deep)
        if key in seen:
            raise yaml.constructor.ConstructorError(
                None, None, "duplicate key %r" % (key,), k.start_mark)
        seen.add(key)
        out[key] = loader.construct_object(v, deep=deep)
    return out

Strict.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, no_duplicates)

findings = []
for path in sys.argv[1:]:
    rel = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            doc = yaml.load(fh, Loader=Strict)
    except Exception as exc:
        findings.append({"file": rel, "problem": str(exc).replace("\\n", " ")[:220]})
        continue
    if not isinstance(doc, dict):
        findings.append({"file": rel, "problem": "the file is not a mapping"})
        continue
    # PyYAML resolves a bare \`on:\` to the boolean True (YAML 1.1), so accept either spelling.
    if "on" not in doc and True not in doc:
        findings.append({"file": rel, "problem": "no 'on:' trigger"})
    jobs = doc.get("jobs")
    if not isinstance(jobs, dict) or not jobs:
        findings.append({"file": rel, "problem": "no 'jobs:' mapping"})
        continue
    for name, job in jobs.items():
        if not isinstance(job, dict):
            findings.append({"file": rel, "problem": "job %r is not a mapping" % name}); continue
        if not job.get("uses"):                       # a reusable-workflow job has neither
            if not job.get("runs-on"):
                findings.append({"file": rel, "problem": "job %r has no 'runs-on'" % name})
            steps = job.get("steps")
            if not isinstance(steps, list) or not steps:
                findings.append({"file": rel, "problem": "job %r has no steps" % name})

print(json.dumps({"findings": findings, "count": len(sys.argv) - 1}))
`;

if (!existsSync(DIR)) {
  console.log('OK - no .github/workflows directory.');
  process.exit(0);
}
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/i.test(f)).map((f) => join(DIR, f));
if (!files.length) {
  console.log('OK - no workflow files.');
  process.exit(0);
}

let out = null;
let used = null;
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY, ...files], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (r.error) continue;                                       // not installed
  if (STORE_STUB.test(`${r.stdout}${r.stderr}`)) continue;      // the alias: ABSENCE, not failure
  if (r.status === 0 && r.stdout.trim().startsWith('{')) { out = r.stdout; used = pre.length ? `${cmd} ${pre.join(' ')}` : cmd; break; }
  // A real interpreter that failed for a real reason — report it rather than trying the next one,
  // which would turn "PyYAML is missing" into "no Python", the exact confusion L54 is about.
  if (r.status !== 0 && /ModuleNotFoundError|ImportError/.test(`${r.stderr}`)) {
    console.log(`SKIP - PyYAML is not installed for ${cmd}; cannot validate workflows.`);
    console.log(`  ${(r.stderr || '').trim().split('\n').pop()}`);
    process.exit(0);                                           // absence is not a violation
  }
}

if (!out) {
  console.log('SKIP - no usable Python interpreter (tried py -3, python3, python).');
  console.log('  `python` on PATH may be the Microsoft Store alias — see L59.');
  process.exit(0);
}

const { findings, count } = JSON.parse(out);
console.log(`interpreter: ${used} · workflow files scanned: ${count}`);
console.log('  detects: duplicate keys, unparseable YAML, a job with no runs-on or no steps');
console.log('  does NOT detect: expression syntax or action input names — that needs actionlint');
if (!findings.length) {
  console.log('OK - every workflow file compiles.');
  process.exit(0);
}
console.log(`\nFAIL: ${findings.length} problem(s) GitHub would refuse:`);
for (const f of findings) console.log(`  x ${f.file}: ${f.problem}`);
console.log('\n  A workflow GitHub cannot compile produces a run with ZERO jobs and no logs, so the');
console.log('  failure is invisible in the place people look for it. Fix before pushing.');
process.exit(1);
