# Arc 2, Phase 1 — the eleven `ci-gate` rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eleven `ci-gate` rules mechanically enforced, each with a catch test AND a false-alarm test, wired into `check-meta.mjs`.

**Architecture:** Nine standalone `scripts/check-*.mjs` gates, one per coherent scan rather than one per rule — six of the eleven rules share a scan target, and splitting them would mean walking the same file tree six times. Each gate reads the repo, prints a one-line verdict, exits 0 or 1, and declares which rules it enforces via `export const RULE_IDS`. `check-meta.mjs` runs them.

**Tech Stack:** Node 24 ESM (`.mjs`), Python 3.14 for pytest-side tests, `js-yaml` (already a devDependency — verify before use).

## Global Constraints

Copied from the approved spec (`docs/superpowers/specs/2026-08-09-arc2-enforcement-implementation-design.md`), and binding on every task:

- **Every rule gets TWO tests:** it catches a violation, AND it does not fire on real, healthy repo content. The false-alarm test runs against **real history or the real tree**, never invented input.
- **Severity is chosen per rule and argued in a comment.** Warning if the harm is to efficiency; blocking if the harm is to substance or to an action with no equivalent alternative. **Never a bypass mechanism** — only a less efficient way to do the same work.
- **Every block names a reachable alternative** (§10.24). A block whose message offers no way through is stopping work, not enforcing.
- **Every gate file declares `export const RULE_IDS = [...]`** with the rule ids it enforces. `check-rule-coverage.mjs` already requires this and will fail the commit otherwise.
- **Every gate fails OPEN** on any error it cannot interpret — unreadable file, missing tool, unparseable input. It prints why and exits 0.
- **One liveness test per phase** runs the gate through its real entry point with **no environment overrides at all** (§3.4 of the spec — a `stop` rule once shipped inert behind a test-only env var while 333 tests passed on it).
- **Overhead is measured and reported** against the 61ms worst-case baseline from Phase 4.
- Tests are Python (`pytest`), run the gate as a **subprocess** with `encoding="utf-8"` (L74: pytest's own capture does not go through the Windows code page, so a test that does not spawn the CLI cannot see an encoding failure at all).

---

## File Structure

| File | Rules | Responsibility |
|---|---|---|
| `scripts/check-control-bytes.mjs` | `L43a` | No C0 control byte other than tab/LF/CR in tracked text files |
| `scripts/check-test-waits.mjs` | `DoD-11` `L15` `L58` | No `waitForTimeout`; and a condition wait must be able to fail |
| `scripts/check-python-invocation.mjs` | `L59` | No bare `python` in configs/workflows — the Windows Store alias |
| `scripts/check-yaml-duplicate-keys.mjs` | `L61` | A duplicate key in any workflow/YAML file |
| `scripts/check-powershell-output.mjs` | `L66` | Bare trailing assignment, and `Write-Output` beside `return` |
| `scripts/check-python-utf8.mjs` | `L74` | A Python entry point printing non-ASCII without declaring utf-8 |
| `scripts/check-ai-token-caps.mjs` | `L24` | Every AI call carries an 8192 cap |
| `scripts/check-secret-alphabet.mjs` | `L53` | Generated credentials restricted to `A-Za-z0-9._~` |
| `scripts/check-test-file-size.mjs` | `L30` | A spec file whose test count crosses the measured worker ceiling |
| `tests/test_arc2_phase1_gates.py` | — | Catch + false-alarm + liveness tests for all nine |

---

### Task 1: `check-control-bytes.mjs` — `L43a`

**Files:**
- Create: `scripts/check-control-bytes.mjs`
- Test: `tests/test_arc2_phase1_gates.py`

**Interfaces:**
- Produces: a gate invoked as `node scripts/check-control-bytes.mjs [--root <dir>]`, exit 1 on violation.
- Later tasks copy this file's shape: `RULE_IDS`, `--root` seam, fail-open helper, one-line verdict.

- [ ] **Step 1: Write the failing tests**

```python
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def run_gate(script, *args):
    return subprocess.run(["node", str(ROOT / "scripts" / script), *args],
                          capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))

def test_control_bytes_gate_catches_a_planted_byte(tmp_path):
    (tmp_path / "app.js").write_bytes(b"const x = /word\x08/;\n")
    r = run_gate("check-control-bytes.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "app.js" in r.stdout
    assert "0x8" in r.stdout or "\\x08" in r.stdout

def test_control_bytes_gate_does_not_fire_on_the_real_repo():
    """The false-alarm test, run against the real tree — not invented input."""
    r = run_gate("check-control-bytes.mjs")
    assert r.returncode == 0, f"the gate fires on healthy repo content:\n{r.stdout}"

def test_control_bytes_gate_exempts_vendor_documentation(tmp_path):
    """docs/vendor carries ESC bytes inside ANSI examples. Correcting someone else's shipped
    documentation is not this gate's business, and firing on it would teach people to skip the gate."""
    v = tmp_path / "docs" / "vendor" / "x"; v.mkdir(parents=True)
    (v / "doc.md").write_bytes(b"ANSI: \x1b[31m red \x1b[0m\n")
    r = run_gate("check-control-bytes.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_control_bytes_gate_fails_open_on_an_unreadable_root():
    r = run_gate("check-control-bytes.mjs", "--root", "no/such/directory")
    assert r.returncode == 0
    assert "could not" in r.stdout.lower()
```

- [ ] **Step 2: Run them and watch all four fail**

Run: `py -3 -X utf8 -m pytest tests/test_arc2_phase1_gates.py -q`
Expected: FAIL — `MODULE_NOT_FOUND`, because the gate does not exist yet.

- [ ] **Step 3: Write the gate**

```javascript
#!/usr/bin/env node
// check-control-bytes — L43a. No tracked text file may carry a C0 control byte other than tab/LF/CR.
//
// SEVERITY: BLOCKING. The harm is to substance, not efficiency: such a byte is invisible in every
// editor and every diff, so the defect it causes is undiagnosable by reading. A regex once carried a
// literal U+0008 and matched ZERO rows on every run while its source read as correct. The alternative
// is always reachable and costs seconds — delete the byte, or write the escape sequence instead.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L43a'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];

const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.md', '.json', '.yml',
                      '.yaml', '.css', '.html', '.ps1', '.sh', '.sql', '.txt']);
// Vendor documentation ships ANSI examples containing ESC. Correcting someone else's published docs is
// not this gate's business, and a gate that fires on content you may not change teaches people to skip it.
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', '.wrangler',
                           '.playwright-mcp', 'vendor', 'test-results', 'playwright-report']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT.has(extname(name))) out.push(p);
  }
  return out;
}

let files;
try {
  files = walk(ROOT);
} catch (err) {
  console.log(`check-control-bytes: could not scan ${ROOT} (${err.code ?? err.message}). Not blocking.`);
  process.exit(0);
}

const bad = [];
for (const f of files) {
  let buf;
  try { buf = readFileSync(f); } catch { continue; }   // unreadable file is not a verdict
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b < 0x20 && b !== 9 && b !== 10 && b !== 13) {
      bad.push([relative(ROOT, f).split(sep).join('/'), i, '0x' + b.toString(16)]);
      break;   // one report per file: the second byte adds no decision
    }
  }
}

if (bad.length === 0) {
  console.log(`CONTROL BYTES: none in ${files.length} text file(s).`);
  process.exit(0);
}
console.log(
  `FAIL: ${bad.length} file(s) carry an invisible control byte:\n` +
  bad.map(([f, i, h]) => `  ${f} — byte ${h} at offset ${i}`).join('\n') +
  `\n  The byte is invisible in your editor and in git diff. Delete it, or write the escape\n` +
  `  sequence (\\x08) if the text is meant to SHOW the byte rather than contain it.\n` +
  `  Beware: a bash heredoc eats a literal backslash, so a repair script can rewrite the very\n` +
  `  byte it removes — build the backslash from bytes([92]) (L68).`);
process.exit(1);
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `py -3 -X utf8 -m pytest tests/test_arc2_phase1_gates.py -q`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/check-control-bytes.mjs tests/test_arc2_phase1_gates.py
git commit -m "feat(arc2 phase1): L43a - no invisible control byte in tracked text"
```

---

### Task 2: `check-test-waits.mjs` — `DoD-11`, `L15`, `L58`

**Files:**
- Create: `scripts/check-test-waits.mjs`
- Modify: `tests/test_arc2_phase1_gates.py` (append)

**Interfaces:**
- Consumes: the `--root` seam and fail-open shape from Task 1.
- Produces: `node scripts/check-test-waits.mjs [--root <dir>]`.

**Why three rules in one gate:** all three read the same files (`tests/**/*.ts`) and ask about the same construct. `DoD-11` and `L15` forbid `waitForTimeout`; `L58` forbids a condition wait that **cannot fail** — `waitForFunction(() => x || true)` satisfies "no arbitrary waits" by shape and waits for exactly nothing. It shipped and passed review because the rule everyone checked was the other one.

- [ ] **Step 1: Write the failing tests**

```python
def test_wait_gate_catches_waitForTimeout(tmp_path):
    t = tmp_path / "tests"; t.mkdir()
    (t / "a.spec.ts").write_text("await page.waitForTimeout(150);\n", encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "waitForTimeout" in r.stdout, r.stdout

def test_wait_gate_catches_a_predicate_that_cannot_fail(tmp_path):
    """L58: the exact line that shipped in Phase C and passed review."""
    t = tmp_path / "tests"; t.mkdir()
    (t / "b.spec.ts").write_text(
        "await page.waitForFunction(() => document.fonts?.status === 'loaded' || true);\n",
        encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "|| true" in r.stdout, r.stdout

def test_wait_gate_accepts_a_real_condition_wait(tmp_path):
    t = tmp_path / "tests"; t.mkdir()
    (t / "c.spec.ts").write_text(
        "await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);\n",
        encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_wait_gate_does_not_fire_on_the_real_suite():
    r = run_gate("check-test-waits.mjs")
    assert r.returncode == 0, f"the gate fires on the real suite:\n{r.stdout}"
```

- [ ] **Step 2: Run and watch them fail** — `MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the gate**

```javascript
#!/usr/bin/env node
// check-test-waits — DoD-11, L15, L58. Tests wait on conditions, and the condition must be able to fail.
//
// SEVERITY: BLOCKING. An arbitrary wait is a latent flake that detonates in a full run under parallel
// load — a real one produced a failure that passed in isolation every time, sending a debugging session
// after the product instead of the test. The alternative is named in the message and is strictly
// better: waitForFunction on the observable the test is actually about.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['DoD-11', 'L15', 'L58'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'test-results', 'playwright-report', 'dist']);

function specFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) specFiles(p, out);
    else if (name.endsWith('.spec.ts') || name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

let files;
try {
  files = specFiles(join(ROOT, 'tests'));
} catch (err) {
  console.log(`check-test-waits: could not scan tests/ (${err.code ?? err.message}). Not blocking.`);
  process.exit(0);
}

// A predicate that cannot fail: `|| true`, `|| 1`, or a bare `=> true`. The `?.` in the shipped example
// is a tell but not a rule — optional chaining is legitimate; the tautology beside it is not.
const CANNOT_FAIL = /waitForFunction\s*\([^)]*(\|\|\s*(true|1)\b|=>\s*true\s*[,)])/s;
const findings = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const rel = relative(ROOT, f).split(sep).join('/');
  text.split('\n').forEach((line, n) => {
    if (line.includes('waitForTimeout')) findings.push([rel, n + 1, 'waitForTimeout', line.trim()]);
  });
  const m = CANNOT_FAIL.exec(text);
  if (m) {
    const upto = text.slice(0, m.index).split('\n').length;
    findings.push([rel, upto, 'a predicate that cannot fail', m[0].split('\n')[0].trim()]);
  }
}

if (findings.length === 0) {
  console.log(`TEST WAITS: ${files.length} spec file(s), no arbitrary wait and no unfailable predicate.`);
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} wait(s) that cannot do their job:\n` +
  findings.map(([f, n, what, src]) => `  ${f}:${n} — ${what}\n      ${src}`).join('\n') +
  `\n  Wait on the observable the test is about: waitForFunction(() => <the thing you expect>).\n` +
  `  A predicate containing "|| true" is a comment with a network round-trip — if no reachable\n` +
  `  state makes it false, it never waited for anything.`);
process.exit(1);
```

- [ ] **Step 4: Run the tests and watch them pass.**

- [ ] **Step 5: Commit**

```bash
git add scripts/check-test-waits.mjs tests/test_arc2_phase1_gates.py
git commit -m "feat(arc2 phase1): DoD-11, L15, L58 - a wait that cannot fail is not a wait"
```

---

### Task 3: `check-yaml-duplicate-keys.mjs` — `L61`

**Files:**
- Create: `scripts/check-yaml-duplicate-keys.mjs`
- Modify: `tests/test_arc2_phase1_gates.py` (append)

**Why this one is worth a gate of its own:** a duplicate YAML key is **last-one-wins locally and fatal remotely**. PyYAML does not even warn; GitHub's parser refuses the file. One dangling `retention-days: 7` left CI dark for **eleven hours** across six pushes that produced runs with zero jobs, a `failure` conclusion, and no logs.

- [ ] **Step 1: Write the failing tests**

```python
def test_yaml_gate_catches_a_duplicate_key(tmp_path):
    w = tmp_path / ".github" / "workflows"; w.mkdir(parents=True)
    (w / "test.yml").write_text(
        "jobs:\n  a:\n    with:\n      retention-days: 7\n      retention-days: 30\n", encoding="utf-8")
    r = run_gate("check-yaml-duplicate-keys.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "retention-days" in r.stdout, r.stdout

def test_yaml_gate_accepts_the_same_key_at_different_levels(tmp_path):
    """`name:` appears once per job legitimately — duplication is per-mapping, not per-file."""
    w = tmp_path / ".github" / "workflows"; w.mkdir(parents=True)
    (w / "ok.yml").write_text("jobs:\n  a:\n    name: one\n  b:\n    name: two\n", encoding="utf-8")
    r = run_gate("check-yaml-duplicate-keys.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_yaml_gate_does_not_fire_on_the_real_repo():
    r = run_gate("check-yaml-duplicate-keys.mjs")
    assert r.returncode == 0, f"the gate fires on real YAML:\n{r.stdout}"
```

- [ ] **Step 2: Run and watch them fail.**

- [ ] **Step 3: Write the gate**

```javascript
#!/usr/bin/env node
// check-yaml-duplicate-keys — L61. A duplicate key inside one mapping.
//
// SEVERITY: BLOCKING. It is silent locally (last-one-wins, no warning from any local parser) and fatal
// remotely (GitHub refuses the file), which is the worst combination a defect can have: every check you
// can run says green. CI was dark for eleven hours behind exactly this. The alternative is trivially
// reachable — delete the duplicate line — and is named in the message.
//
// Implemented WITHOUT a YAML library on purpose: js-yaml's default schema also takes last-one-wins, so
// asking it to parse would reproduce the very silence being detected. This walks indentation instead,
// which is enough to answer "did the same key appear twice at the same level under the same parent".
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L61'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'test-results']);

// MEASURED 2026-08-09: the tree holds 149 .yml/.yaml files and only THREE are tracked — the other 146
// are untracked `.playwright-mcp/` page snapshots, which are machine-generated and full of repeated
// keys. Scan the tracked list, exactly as check-control-bytes does, with the same filesystem fallback
// so the tmp_path tests still work.
function yamlFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yamlFiles(p, out);
    else if (name.endsWith('.yml') || name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

// MEASURED BEFORE DISPATCH, 2026-08-09, and the first version was wrong. A `- ` list item begins a
// NEW sibling mapping at the same indent, so `with:`/`run:`/`uses:` appearing once per STEP is
// perfectly legal YAML. Without the item reset below, this gate reported 21 duplicates across the two
// real workflows — it would have fired on healthy files on its very first run, which is how a gate
// loses its credibility permanently.
const KEY = /^(\s*)-?\s*([A-Za-z0-9_.-]+):(\s|$)/;
const ITEM = /^(\s*)-\s/;
const findings = [];
for (const f of yamlFiles(ROOT)) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('
'); } catch { continue; }
  const seen = new Map();          // indent -> Map(key -> line number)
  lines.forEach((line, n) => {
    if (/^\s*#/.test(line) || line.trim() === '') return;
    const item = ITEM.exec(line);
    if (item) {
      // Everything recorded at this indent or deeper belonged to the PREVIOUS list element.
      const at = item[1].length;
      for (const depth of [...seen.keys()]) if (depth >= at) seen.delete(depth);
    }
    const m = KEY.exec(line);
    if (!m) return;
    const indent = m[1].length + (item ? 2 : 0);
    const key = m[2];
    for (const depth of [...seen.keys()]) if (depth > indent) seen.delete(depth);
    if (!seen.has(indent)) seen.set(indent, new Map());
    const level = seen.get(indent);
    if (level.has(key)) {
      findings.push([relative(ROOT, f).split(sep).join('/'), key, level.get(key), n + 1]);
    } else {
      level.set(key, n + 1);
    }
  });
}

if (findings.length === 0) {
  console.log('YAML KEYS: no duplicate key in any mapping.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} duplicate YAML key(s):\n` +
  findings.map(([f, k, a, b]) => `  ${f} — "${k}" at line ${a} and again at line ${b}`).join('\n') +
  `\n  Delete the stale line. Every local parser accepts this (last-one-wins, no warning) and\n` +
  `  GitHub's does not — the workflow will not compile, and the run shows zero jobs with no logs.`);
process.exit(1);
```

- [ ] **Step 4: Run the tests and watch them pass.**

- [ ] **Step 5: Commit**

```bash
git add scripts/check-yaml-duplicate-keys.mjs tests/test_arc2_phase1_gates.py
git commit -m "feat(arc2 phase1): L61 - a duplicate YAML key is silent locally and fatal remotely"
```

---

### Task 4: `check-python-invocation.mjs` and `check-python-utf8.mjs` — `L59`, `L74`

**Files:**
- Create: `scripts/check-python-invocation.mjs`, `scripts/check-python-utf8.mjs`
- Modify: `tests/test_arc2_phase1_gates.py` (append)

**Interfaces:**
- Produces: two gates, each with the `--root` seam.

**Why these two are one task:** both are about a Python entry point failing in a way the terminal hides — one because `python` resolves to the Windows Store alias (exit 9009, an error naming the web server and never mentioning Python), the other because a piped stdout gets cp1252 and a Hebrew refusal message dies in `UnicodeEncodeError` instead of printing. A reviewer would accept or reject them together.

- [ ] **Step 1: Write the failing tests**

```python
def test_python_invocation_gate_catches_a_bare_python_call(tmp_path):
    (tmp_path / "playwright.config.ts").write_text(
        "webServer: { command: 'python build.py' }\n", encoding="utf-8")
    r = run_gate("check-python-invocation.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "build.py" in r.stdout, r.stdout

def test_python_invocation_gate_accepts_the_launcher(tmp_path):
    (tmp_path / "playwright.config.ts").write_text(
        "webServer: { command: 'py -3 build.py' }\n", encoding="utf-8")
    r = run_gate("check-python-invocation.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_python_invocation_gate_does_not_fire_on_the_real_repo():
    r = run_gate("check-python-invocation.mjs")
    assert r.returncode == 0, r.stdout

def test_utf8_gate_catches_a_script_printing_hebrew_without_declaring_encoding(tmp_path):
    s = tmp_path / "scripts"; s.mkdir()
    (s / "refuse.py").write_text('print("סירוב: הכלל אוסר זאת")\n', encoding="utf-8")
    r = run_gate("check-python-utf8.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "refuse.py" in r.stdout, r.stdout

def test_utf8_gate_accepts_a_script_that_declares_it(tmp_path):
    s = tmp_path / "scripts"; s.mkdir()
    (s / "ok.py").write_text(
        'import sys\nsys.stdout.reconfigure(encoding="utf-8")\nprint("סירוב")\n', encoding="utf-8")
    r = run_gate("check-python-utf8.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_utf8_gate_does_not_fire_on_the_real_scripts():
    r = run_gate("check-python-utf8.mjs")
    assert r.returncode == 0, r.stdout
```

- [ ] **Step 2: Run and watch all six fail.**

- [ ] **Step 3: Write both gates**

```javascript
#!/usr/bin/env node
// check-python-invocation — L59. `python` on Windows is frequently the Store app-execution alias.
//
// SEVERITY: BLOCKING. The failure names the wrong component: the suite died with "Process from config
// .webServer was not able to start. Exit code: 9009" and never mentioned Python. L54 fixed the CALLER
// and not the CLASS — this gate is the class. Alternative, always available: `py -3`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L59'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'docs', 'test-results']);
const WATCH = ['.ts', '.js', '.mjs', '.yml', '.yaml', '.json', '.ps1'];

function files(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (WATCH.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

// A bare `python` starting a command — not `py -3`, not `python3` inside a Linux-only CI block, and
// not the word appearing in prose or an identifier.
const BARE = /(^|[`'"\s;&|(])python(\s+[-\w./\\]+\.py|\s+-m\s)/;
const findings = [];
for (const f of files(ROOT)) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  lines.forEach((line, n) => {
    if (line.includes('runs-on: ubuntu') || /^\s*(\/\/|#)/.test(line)) return;
    if (BARE.test(line)) findings.push([relative(ROOT, f).split(sep).join('/'), n + 1, line.trim()]);
  });
}

if (findings.length === 0) {
  console.log('PYTHON INVOCATION: no bare `python` call in a config or workflow.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} bare \`python\` call(s):\n` +
  findings.map(([f, n, src]) => `  ${f}:${n}\n      ${src}`).join('\n') +
  `\n  Use \`py -3\`. On Windows a bare \`python\` often resolves to the Store app-execution alias,\n` +
  `  which prints "Python was not found" and exits 9009 — and the caller reports ITS own failure,\n` +
  `  never Python's.`);
process.exit(1);
```

```javascript
#!/usr/bin/env node
// check-python-utf8 — L74. A Python entry point that prints non-ASCII must declare utf-8 on stdout.
//
// SEVERITY: BLOCKING, and the harm is precisely to substance: the ONE refusal message carrying a
// Hebrew quote crashed with UnicodeEncodeError instead of printing, so the user saw a traceback in
// place of the reason — and the reason is the entire purpose of a refusal (§10.24). Windows gives a
// non-console stdout the cp1252 code page, so this appears only when output is piped. The alternative
// is two lines at the top of the file, and the message names them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L74'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--root');
const ROOT = i === -1 ? REPO : argv[i + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'venv', '.venv']);

function pyFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pyFiles(p, out);
    else if (name.endsWith('.py')) out.push(p);
  }
  return out;
}

const PRINTS = /^\s*(print\s*\(|sys\.std(out|err)\.write\s*\()/m;
const DECLARES = /(reconfigure\s*\(\s*encoding\s*=\s*["']utf-8|PYTHONIOENCODING|io\.TextIOWrapper\([^)]*utf-8)/;
const NON_ASCII = /[^\x00-\x7F]/;

const findings = [];
for (const f of pyFiles(join(ROOT, 'scripts'))) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  if (!PRINTS.test(text)) continue;
  if (!NON_ASCII.test(text)) continue;      // ASCII-only output cannot hit the code page
  if (DECLARES.test(text)) continue;
  findings.push(relative(ROOT, f).split(sep).join('/'));
}

if (findings.length === 0) {
  console.log('PYTHON UTF-8: every non-ASCII-printing script under scripts/ declares its encoding.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} script(s) print non-ASCII without declaring utf-8:\n` +
  findings.map((f) => `  ${f}`).join('\n') +
  `\n  Add at the top:\n` +
  `      import sys\n` +
  `      sys.stdout.reconfigure(encoding="utf-8")\n` +
  `  Note this is invisible in a terminal — Windows only applies cp1252 when stdout is a PIPE, so a\n` +
  `  test that does not spawn the CLI as a subprocess cannot see the failure at all.`);
process.exit(1);
```

- [ ] **Step 4: Run the tests and watch all six pass.**

- [ ] **Step 5: Commit**

```bash
git add scripts/check-python-invocation.mjs scripts/check-python-utf8.mjs tests/test_arc2_phase1_gates.py
git commit -m "feat(arc2 phase1): L59, L74 - two Python entry-point failures the terminal hides"
```

---

### Task 5: `check-powershell-output.mjs`, `check-ai-token-caps.mjs`, `check-secret-alphabet.mjs`, `check-test-file-size.mjs` — `L66`, `L24`, `L53`, `L30`

**Files:**
- Create: those four scripts
- Modify: `tests/test_arc2_phase1_gates.py` (append)

**Interfaces:**
- Consumes: the `--root` seam and fail-open shape from Task 1.

Each is a narrow scan; they are one task because none is large enough to be worth a reviewer's gate alone, and all four follow the identical shape already reviewed in Tasks 1–4.

- [ ] **Step 1: Write the failing tests**

```python
def test_powershell_gate_catches_a_bare_trailing_assignment(tmp_path):
    s = tmp_path / "scripts"; s.mkdir()
    (s / "w.ps1").write_text(
        "function Get-Results {\n  $results = @($a, $b)\n}\n", encoding="utf-8")
    r = run_gate("check-powershell-output.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "w.ps1" in r.stdout, r.stdout

def test_powershell_gate_catches_write_output_beside_return(tmp_path):
    s = tmp_path / "scripts"; s.mkdir()
    (s / "x.ps1").write_text(
        "function Invoke-Check {\n  Write-Output \"narrating\"\n  return $result\n}\n", encoding="utf-8")
    r = run_gate("check-powershell-output.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "Write-Output" in r.stdout, r.stdout

def test_powershell_gate_does_not_fire_on_the_real_scripts():
    r = run_gate("check-powershell-output.mjs")
    assert r.returncode == 0, r.stdout

def test_ai_cap_gate_catches_a_low_cap(tmp_path):
    (tmp_path / "app.js").write_text("maxOutputTokens: 1024,\n", encoding="utf-8")
    r = run_gate("check-ai-token-caps.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "1024" in r.stdout, r.stdout

def test_ai_cap_gate_accepts_8192(tmp_path):
    (tmp_path / "app.js").write_text("maxOutputTokens: 8192,\n", encoding="utf-8")
    r = run_gate("check-ai-token-caps.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_ai_cap_gate_does_not_fire_on_the_real_app():
    r = run_gate("check-ai-token-caps.mjs")
    assert r.returncode == 0, r.stdout

def test_secret_alphabet_gate_catches_token_urlsafe(tmp_path):
    s = tmp_path / "scripts"; s.mkdir()
    (s / "gen.py").write_text("pw = secrets.token_urlsafe(32)\n", encoding="utf-8")
    r = run_gate("check-secret-alphabet.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "token_urlsafe" in r.stdout, r.stdout

def test_secret_alphabet_gate_does_not_fire_on_the_real_scripts():
    r = run_gate("check-secret-alphabet.mjs")
    assert r.returncode == 0, r.stdout

def test_file_size_gate_reports_a_spec_over_the_worker_ceiling(tmp_path):
    t = tmp_path / "tests"; t.mkdir()
    (t / "big.spec.ts").write_text("test('a',()=>{});\n" * 40, encoding="utf-8")
    r = run_gate("check-test-file-size.mjs", "--root", str(tmp_path))
    assert "big.spec.ts" in r.stdout, r.stdout

def test_file_size_gate_does_not_block_the_real_suite():
    """L30 is a WARNING, not a block: a spec legitimately grows, and the harm is to run stability
    rather than to substance. It must report and exit 0."""
    r = run_gate("check-test-file-size.mjs")
    assert r.returncode == 0, r.stdout
```

- [ ] **Step 2: Run and watch all ten fail.**

- [ ] **Step 3: Write the four gates**

All four follow Task 1's shape exactly: `RULE_IDS`, the `--root` seam, fail-open on anything they
cannot interpret, one verdict line, exit 0 or 1.

```javascript
#!/usr/bin/env node
// check-powershell-output — L66. In PowerShell the pipeline IS the return value.
//
// SEVERITY: BLOCKING. Two defects, one root, and they bit in OPPOSITE directions. A function ending in
// a bare `$results = @(...)` emits NOTHING — the watchman's real-run branch produced $null, so every
// real run would have iterated an empty set and printed "WATCHMAN OK while checking zero components",
// which is the exact failure the watchman exists to prevent, inside the watchman. And `Write-Output`
// beside `return` emits BOTH, so the caller captures narration mixed into the result. The alternatives
// are named in the message and cost nothing: end with the variable itself, and narrate with Write-Host.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L66'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__', 'test-results']);

function ps1Files(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) ps1Files(p, out);
    else if (name.endsWith('.ps1') || name.endsWith('.psm1')) out.push(p);
  }
  return out;
}

// Brace-count the body of each `function Name {` so a nested scriptblock does not end it early.
function functionBodies(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*function\s+([\w-]+)/.exec(lines[i]);
    if (!m) continue;
    let depth = 0, started = false, body = [], startLine = i + 1;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (j > i || lines[j].includes('{')) body.push([j + 1, lines[j]]);
      if (started && depth === 0) { out.push({ name: m[1], startLine, body }); i = j; break; }
    }
  }
  return out;
}

const isCode = (line) => line.trim() !== '' && !/^\s*#/.test(line);
const findings = [];
for (const f of ps1Files(ROOT)) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const rel = relative(ROOT, f).split(sep).join('/');
  for (const fn of functionBodies(lines)) {
    const code = fn.body.filter(([, l]) => isCode(l));
    // (a) the last statement before the closing brace is a bare assignment — emits nothing
    for (let k = code.length - 1; k >= 0; k--) {
      const [n, line] = code[k];
      if (/^\s*}\s*$/.test(line)) continue;
      if (/^\s*\$[\w:]+\s*=\s*/.test(line) && !/^\s*\$\w+\s*=\s*.*\|\s*Out-Null/.test(line)) {
        findings.push([rel, n, `function ${fn.name} ends in a bare assignment`, line.trim()]);
      }
      break;
    }
    // (b) Write-Output beside return in the same body — both reach the pipeline
    const hasWriteOutput = code.find(([, l]) => /^\s*Write-Output\b/.test(l));
    const hasReturn = code.find(([, l]) => /^\s*return\b/.test(l));
    if (hasWriteOutput && hasReturn) {
      findings.push([rel, hasWriteOutput[0],
        `function ${fn.name} uses Write-Output beside return`, hasWriteOutput[1].trim()]);
    }
  }
}

if (findings.length === 0) {
  console.log('POWERSHELL OUTPUT: no function emits nothing, and none mixes narration into its result.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} PowerShell output defect(s):\n` +
  findings.map(([f, n, what, src]) => `  ${f}:${n} — ${what}\n      ${src}`).join('\n') +
  `\n  A bare trailing assignment emits NOTHING: end the function with the variable itself\n` +
  `  (\`$results\` on its own line) so the pipeline carries it.\n` +
  `  Write-Output beside return emits BOTH: narrate with Write-Host, which does not reach the\n` +
  `  pipeline, and let return carry the result alone.`);
process.exit(1);
```

```javascript
#!/usr/bin/env node
// check-ai-token-caps — L24. Every AI call carries an 8192 output cap.
//
// SEVERITY: BLOCKING, and the harm is to substance rather than efficiency: a low cap plus a high
// thinking budget truncates the JSON mid-stream with NO error. The smoker device-lookup returned "not
// found" — a confident wrong answer, not a failure — because the model's thinking consumed the budget
// and the payload was cut. Billing is on tokens actually used, so a high cap is free headroom and a
// low one buys nothing. Alternative in the message: raise to 8192, or mark the line as a health probe.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L24'];

const REQUIRED = 8192;
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__']);

function jsFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) jsFiles(p, out);
    else if (/\.(js|mjs|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const targets = [];
if (existsSync(join(ROOT, 'worker'))) targets.push(...jsFiles(join(ROOT, 'worker')));
for (const f of ['app.js']) if (existsSync(join(ROOT, f))) targets.push(join(ROOT, f));

const CAP = /max(?:Output)?Tokens\s*[:=]\s*(\d+)/g;
const findings = [];
for (const f of targets) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const rel = relative(ROOT, f).split(sep).join('/');
  lines.forEach((line, n) => {
    // A tiny health probe is the ONE named exception in the owner's policy. It must say so on the
    // line, so the exemption is visible where the number is, not in a document elsewhere.
    if (/health-probe/i.test(line)) return;
    for (const m of line.matchAll(CAP)) {
      const value = Number(m[1]);
      if (value < REQUIRED) findings.push([rel, n + 1, value, line.trim()]);
    }
  });
}

if (findings.length === 0) {
  console.log(`AI TOKEN CAPS: every cap in ${targets.length} file(s) is ${REQUIRED} or higher.`);
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} AI call(s) capped below ${REQUIRED}:\n` +
  findings.map(([f, n, v, src]) => `  ${f}:${n} — ${v}\n      ${src}`).join('\n') +
  `\n  Raise it to ${REQUIRED}. Billing is on tokens actually used, so the cap is free headroom — a\n` +
  `  low one buys nothing and truncates the JSON mid-stream with no error, which reads as a\n` +
  `  confident wrong answer rather than a failure.\n` +
  `  If this genuinely is a tiny health probe, say so on the line: add a \`health-probe\` comment.`);
process.exit(1);
```

```javascript
#!/usr/bin/env node
// check-secret-alphabet — L53. A generated secret is an input to a command line.
//
// SEVERITY: BLOCKING. `secrets.token_urlsafe(32)` produced a password beginning with `-`; neo4j-admin
// read it as a FLAG and crash-looped reporting "Missing required parameter: '<password>'" — an error
// pointing at a missing value while the value was right there, being misread. The `/` in the same
// alphabet would split NEO4J_AUTH's `user/password` form. The alternative is one line and is named in
// the message: choose from A-Za-z0-9._~ and start with a letter.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L53'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];
const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__']);

function scriptFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) scriptFiles(p, out);
    else if (/\.(py|mjs|js|ps1)$/.test(name)) out.push(p);
  }
  return out;
}

const GENERATOR = /\b(secrets\.token_urlsafe|secrets\.token_bytes|secrets\.token_hex|uuid4\(\)\.hex)\b/;
// The safe form names its own alphabet — a choice() over an explicit character set, or an explicit
// reference to the project's alphabet. Anything else is a generator whose output shape is unexamined.
const DECLARES_ALPHABET = /(A-Za-z0-9\._~|ALPHABET|secrets\.choice\s*\()/;

const findings = [];
for (const f of scriptFiles(join(ROOT, 'scripts'))) {
  let lines;
  try { lines = readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  const rel = relative(ROOT, f).split(sep).join('/');
  lines.forEach((line, n) => {
    if (!GENERATOR.test(line)) return;
    // A generator is fine when the file also pins the alphabet — check the file, not just the line,
    // because the alphabet is usually a module-level constant.
    const context = lines.slice(Math.max(0, n - 6), n + 7).join('\n');
    if (DECLARES_ALPHABET.test(context) || DECLARES_ALPHABET.test(lines.join('\n'))) return;
    findings.push([rel, n + 1, line.trim()]);
  });
}

if (findings.length === 0) {
  console.log('SECRET ALPHABET: every generated credential pins its alphabet.');
  process.exit(0);
}
console.log(
  `FAIL: ${findings.length} credential generator(s) with no declared alphabet:\n` +
  findings.map(([f, n, src]) => `  ${f}:${n}\n      ${src}`).join('\n') +
  `\n  A generated secret crosses command lines, env vars and URLs before it is ever used. Choose\n` +
  `  from A-Za-z0-9._~ and require a letter first:\n` +
  `      ALPHABET = string.ascii_letters + string.digits + "._~"\n` +
  `      pw = secrets.choice(string.ascii_letters) + "".join(secrets.choice(ALPHABET) for _ in range(31))\n` +
  `  A leading "-" is read as a flag; a "/" splits a user/password pair.`);
process.exit(1);
```

```javascript
#!/usr/bin/env node
// check-test-file-size — L30. A spec file's own size silently changes the suite's concurrency.
//
// SEVERITY: WARNING — it reports and always exits 0, and the reasoning is the point. Playwright caps
// workers at the test count PER FILE, so a spec growing from 2 tests to 5 raised the project's real
// concurrency past what service-worker registration cycles reliably survive: an implementer reported
// "825 passed, exit 0" and the controller's own run on the same code gave 821 passed / 4 failed.
// Nothing in that diff looked like a concurrency change; the file just got bigger.
// But a spec legitimately grows, the harm is to run stability rather than to substance, and blocking
// every commit that adds a test is the L70 failure mode this whole arc exists to avoid. So: report.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_IDS = ['L30'];

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx === -1 ? REPO : argv[rootIdx + 1];

// The ceiling is the measured worker count, read from the config rather than hardcoded — a number
// pinned here would drift from the one that actually governs the run (L64b).
function ceiling() {
  const cfg = join(ROOT, 'playwright.config.ts');
  if (!existsSync(cfg)) return null;
  let text;
  try { text = readFileSync(cfg, 'utf8'); } catch { return null; }
  const m = /workers\s*:\s*(\d+)/.exec(text);
  return m ? Number(m[1]) : null;      // an expression rather than a literal => null => fall open
}

function specFiles(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) specFiles(p, out);
    else if (name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const limit = ceiling();
if (limit === null) {
  console.log('TEST FILE SIZE: could not read the worker ceiling from playwright.config.ts ' +
              '(absent, or `workers` is an expression rather than a literal). Not reporting.');
  process.exit(0);
}

const over = [];
for (const f of specFiles(join(ROOT, 'tests'))) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const count = (text.match(/(^|\s)test\s*\(/g) || []).length;
  if (count > limit) over.push([relative(ROOT, f).split(sep).join('/'), count]);
}

if (over.length === 0) {
  console.log(`TEST FILE SIZE: no spec file exceeds the measured worker ceiling (${limit}).`);
  process.exit(0);
}
console.log(
  `TEST FILE SIZE — WARNING (not blocking): ${over.length} spec file(s) above the worker ceiling ` +
  `(${limit}):\n` +
  over.map(([f, c]) => `  ${f} — ${c} tests`).join('\n') +
  `\n  Playwright caps workers at the test count per file, so this file alone raises the suite's real\n` +
  `  concurrency. If the suite starts failing in full runs and passing in isolation, look here first:\n` +
  `  nothing in the diff will look like a concurrency change.`);
process.exit(0);
```

- [ ] **Step 4: Run the tests and watch all ten pass.**

- [ ] **Step 5: Commit**

```bash
git add scripts/check-powershell-output.mjs scripts/check-ai-token-caps.mjs scripts/check-secret-alphabet.mjs scripts/check-test-file-size.mjs tests/test_arc2_phase1_gates.py
git commit -m "feat(arc2 phase1): L66, L24, L53, L30 - four narrow scans"
```

---

### Task 6: Wire all nine into `check-meta.mjs`, prove liveness, measure overhead

**Files:**
- Modify: `scripts/check-meta.mjs`
- Modify: `tests/test_arc2_phase1_gates.py` (append)
- Modify: `docs/process/rule-coverage-baseline.json` (the coverage gate's committed baseline)

**Interfaces:**
- Consumes: all nine gates from Tasks 1–5.

- [ ] **Step 1: Write the liveness and coverage tests**

```python
def test_every_phase1_gate_runs_through_check_meta_with_no_env_overrides():
    """§3.4 — the liveness test. A stop rule once shipped INERT because it loaded only when a
    test-only env var was set; 333 tests passed on a feature that never ran. This spawns the real
    entry point with the environment untouched and requires each gate's own verdict line."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-meta.mjs")],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    for marker in ["CONTROL BYTES:", "TEST WAITS:", "YAML KEYS:", "PYTHON INVOCATION:",
                   "PYTHON UTF-8:", "AI TOKEN CAPS:", "SECRET ALPHABET:", "POWERSHELL OUTPUT:",
                   "TEST FILE SIZE:"]:
        assert marker in r.stdout, f"{marker} missing — that gate is not wired: \n{r.stdout[-2000:]}"

PHASE1_RULES = ["DoD-11", "L15", "L24", "L30", "L43a", "L53", "L58", "L59", "L61", "L66", "L74"]


def test_every_phase1_rule_is_counted_as_covered():
    """Asserts the RULES, not a ratio. A pinned "41 of 82" would have broken on its own: the
    denominator moved from 82 to 84 the same day this plan was written, because writing lessons ADDS
    rules — and a test that pins a number cannot tell a real regression from ordinary progress
    (L64b, which this arc itself wrote)."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout
    missing = [rid for rid in PHASE1_RULES if rid in r.stdout and "not covered" in r.stdout]
    assert not missing, f"declared but not counted: {missing}
{r.stdout}"
    covered = int(r.stdout.split("RULE COVERAGE: ")[1].split(" of ")[0])
    assert covered >= 10 + len(PHASE1_RULES), (
        f"coverage reads {covered}; the ten pre-existing hooks plus this phase's "
        f"{len(PHASE1_RULES)} rules should all be counted
{r.stdout}")
```

- [ ] **Step 2: Run and watch both fail** — the markers are absent because nothing is wired.

- [ ] **Step 3: Wire the nine gates**

Add after the existing `check-rules-classified` line in `scripts/check-meta.mjs`, each with its severity argued in a comment as that file's GATE SCOPING paragraph requires:

```javascript
// Arc 2 Phase 1 (2026-08-09): the eleven ci-gate rules. Each is BLOCKING except check-test-file-size,
// which reports and exits 0 — a spec legitimately grows, and blocking every commit that adds a test is
// the L70 failure mode. Every blocking message names a reachable alternative (§10.24).
run('check-control-bytes', 'check-control-bytes (L43a — no invisible control byte)', 'check-control-bytes.mjs');
run('check-test-waits', 'check-test-waits (DoD-11, L15, L58 — a wait must be able to fail)', 'check-test-waits.mjs');
run('check-yaml-duplicate-keys', 'check-yaml-duplicate-keys (L61)', 'check-yaml-duplicate-keys.mjs');
run('check-python-invocation', 'check-python-invocation (L59 — the Store alias)', 'check-python-invocation.mjs');
run('check-python-utf8', 'check-python-utf8 (L74 — non-ASCII on a pipe)', 'check-python-utf8.mjs');
run('check-powershell-output', 'check-powershell-output (L66 — the pipeline is the return value)', 'check-powershell-output.mjs');
run('check-ai-token-caps', 'check-ai-token-caps (L24 — 8192 everywhere)', 'check-ai-token-caps.mjs');
run('check-secret-alphabet', 'check-secret-alphabet (L53 — a secret is command-line syntax)', 'check-secret-alphabet.mjs');
run('check-test-file-size', 'check-test-file-size (L30 — WARNING only)', 'check-test-file-size.mjs');
```

- [ ] **Step 4: Teach the coverage gate to see these gates at all, then update the baseline**

MEASURED 2026-08-09, before this task was dispatched: `check-rule-coverage.mjs` scans ONLY
`scripts/hooks/{rules,stop-rules,observers}`. Every gate this phase builds lives at `scripts/check-*.mjs`
and declares `RULE_IDS` — and is counted by nothing. Without this step the phase would finish with
eleven rules enforced and a coverage gate still reporting them open, which is the reporting failure this
arc exists to end.

In `scripts/check-rule-coverage.mjs`, after the existing `SCAN_DIRS` loop, also scan the gate scripts:

```javascript
// Arc 2 Phase 1 (2026-08-09): the ci-gate rules are enforced by standalone gates at scripts/check-*.mjs,
// not by hook files under scripts/hooks/. They declare RULE_IDS exactly the same way. Counting only the
// hooks directory would report eleven enforced rules as open — a coverage number that under-reports is
// as misleading as one that over-reports, and this gate exists to be believed.
const SCRIPTS_ROOT = join(ROOT, 'scripts');

function scanDeclaringFile(full) {
  const rel = relative(ROOT, full).replaceAll('\', '/');
  scannedFiles.push(rel);
  const text = readFileSync(full, 'utf8');
  const match = text.match(RULE_IDS_RE);
  if (!match) { missingExportFiles.push(rel); return; }
  for (const id of extractIds(match[1])) {
    if (!declaredIdToFiles.has(id)) declaredIdToFiles.set(id, new Set());
    declaredIdToFiles.get(id).add(rel);
  }
}
```

**MEASURED 2026-08-09, before dispatch:** the file has NO such helper today — the per-file logic is
written inline inside the `for (const sub of SCAN_DIRS)` loop at roughly lines 72-92. So this task
**extracts that body into `scanDeclaringFile` first**, leaves the existing loop calling it, and only
then adds the second loop. Do not add a parallel copy of the logic beside the original: two scanners
that must agree are two scanners that will eventually disagree.

Then, after the existing `SCAN_DIRS` loop:

```javascript
for (const f of readdirSync(SCRIPTS_ROOT).filter((n) => /^check-.*\.mjs$/.test(n)).sort()) {
  scanDeclaringFile(join(SCRIPTS_ROOT, f));
}
```

⚠️ Not every `scripts/check-*.mjs` enforces a corpus rule — several are infrastructure gates
(`check-meta`, `check-rules-mirror`, `check-geniza-fresh`) with no `RULE_IDS` at all. Those would land
in `missingExportFiles` and turn a passing gate red. Decide and state which you did: either skip files
with no `RULE_IDS` export in this second loop (and say in the comment that the DECLARATION requirement
still binds the hook directories, where it was measured), or add the export to the infrastructure gates.
Read the file's existing handling of `missingExportFiles` before choosing — it is a blocking condition.

Then run `node scripts/check-rule-coverage.mjs`, read the number it actually prints, and write THAT into
`docs/process/rule-coverage-baseline.json` so the gate blocks on regression from the new floor. Do not
assume the number — the denominator moves whenever a lesson is written.

- [ ] **Step 5: Measure overhead and paste it**

```bash
node -e "const t=Date.now();require('node:child_process').execSync('node scripts/check-meta.mjs',{stdio:'ignore'});console.log('check-meta total ms:',Date.now()-t)"
```

Record the number in the task summary against the 61ms per-hook baseline. These are commit-time gates rather than per-tool hooks, so the comparable figure is total `check-meta` wall-clock before and after — measure both by stashing the wiring.

- [ ] **Step 6: Run the full suites**

Run: `py -3 -X utf8 -m pytest tests/ -q` and `npx playwright test`
Expected: both green, no `--retries`, no `--workers` override.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-meta.mjs docs/process/rule-coverage-baseline.json tests/test_arc2_phase1_gates.py
git commit -m "feat(arc2 phase1): nine gates wired, liveness proven, every ci-gate rule counted"
```

---

## Self-Review

**Spec coverage.** §3.1 false-alarm tests — every task has one running against the real tree. §3.2 severity argued in code — present in every gate header, with `check-test-file-size` deliberately non-blocking. §3.3 `RULE_IDS` — every gate declares it. §3.4 liveness with no env overrides — Task 6, Step 1. §3.5 overhead — Task 6, Step 5. §5 DoD items 1–6 all map to Task 6.

**Placeholder scan.** Every task carries complete implementations. Task 5 originally carried a
scan specification instead of four full bodies; the owner ruled on 9.8.26 — *"להרחיב את התוכנית —
אני רוצה דיוק"* — and it was expanded before execution reached it. No task says "TBD", "handle
edge cases", or "similar to Task N" in place of content.

**Type consistency.** All nine gates share one interface: `--root <dir>` seam, `export const RULE_IDS`, a verdict line beginning with the gate's uppercase name, exit 0/1. The test helper `run_gate(script, *args)` is defined once in Task 1 and used by every later task.

**One gap I am naming rather than hiding:** `L30`'s ceiling is read from `playwright.config.ts`'s `workers` value, and that file may express it as an expression rather than a literal. If it does, the gate falls open with "could not determine the ceiling" instead of guessing — which is correct behaviour, but it means `L30` may report nothing until the config is read. The implementer must check and say which happened.
