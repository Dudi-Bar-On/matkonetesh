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

def test_control_bytes_gate_ignores_an_untracked_file(tmp_path):
    """The rule says "a tracked source file". Scratch files are not the gate's business, and a
    gate that fires on files git does not track will be routed around rather than obeyed."""
    # a real git repo so `git ls-files` is meaningful
    subprocess.run(["git", "init", "-q"], cwd=str(tmp_path), check=True)
    (tmp_path / "kept.js").write_text("const ok = 1;\n", encoding="utf-8")
    subprocess.run(["git", "add", "kept.js"], cwd=str(tmp_path), check=True)
    (tmp_path / "scratch.js").write_bytes(b"const bad = '\x00';\n")   # never added
    r = run_gate("check-control-bytes.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_control_bytes_gate_does_not_report_a_pass_when_it_scanned_nothing(tmp_path):
    """A gate that looked at zero files has not decided anything. Printing a clean verdict there is
    how an inert gate looks from the outside — green forever, for the wrong reason."""
    subprocess.run(["git", "init", "-q"], cwd=str(tmp_path), check=True)
    (tmp_path / "notes.rst").write_text("no scannable extension here\n", encoding="utf-8")
    subprocess.run(["git", "add", "notes.rst"], cwd=str(tmp_path), check=True)
    r = run_gate("check-control-bytes.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout
    assert "no verdict" in r.stdout.lower(), r.stdout
    assert "none in" not in r.stdout, "it must not read as a clean verdict"


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

def test_wait_gate_does_not_report_a_pass_when_it_scanned_nothing(tmp_path):
    """Same shape as the control-bytes gate: zero files scanned must not read as a clean verdict."""
    t = tmp_path / "tests"; t.mkdir()
    (t / "notes.txt").write_text("not a spec file\n", encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout
    assert "no verdict" in r.stdout.lower(), r.stdout
    assert "TEST WAITS:" not in r.stdout, "it must not read as a clean verdict"

def test_wait_gate_ignores_a_mention_inside_a_comment(tmp_path):
    """A comment is not code. A gate that fires on prose about a rule, instead of a violation of
    it, teaches the reader to skip its output — and then it enforces nothing."""
    t = tmp_path / "tests"; t.mkdir()
    (t / "d.spec.ts").write_text(
        "// never use page.waitForTimeout(150) — see DoD-11\n"
        "await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);\n",
        encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_wait_gate_reports_the_real_line_number_after_a_block_comment(tmp_path):
    """A finding with the wrong line number is one nobody can act on. Comment removal must not
    shift the offsets of everything after it."""
    t = tmp_path / "tests"; t.mkdir()
    (t / "e.spec.ts").write_text(
        "/* one\n   two\n   three */\nconst x = 1;\nawait page.waitForFunction(() => true);\n",
        encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout
    assert ":5" in r.stdout, f"expected the tautology reported at line 5:\n{r.stdout}"

def test_wait_gate_catches_the_numeric_tautology(tmp_path):
    """`=> 1` is `=> true` wearing different clothes — truthy no matter what the reachable state is."""
    t = tmp_path / "tests"; t.mkdir()
    (t / "f.spec.ts").write_text("await page.waitForFunction(() => 1);\n", encoding="utf-8")
    r = run_gate("check-test-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout


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

def test_yaml_gate_ignores_colon_lines_inside_a_block_scalar(tmp_path):
    """A `run: |` body is a shell script, not mappings. This gate BLOCKS, so a false positive here
    stops a healthy build.

    The fixture is deliberately UNPREFIXED (`Status: ok`, not `echo 'Status: ok'`). The first
    version of this test used the echo form and passed against the broken code too — a test that
    cannot fail is not evidence, it is decoration that reads as coverage."""
    w = tmp_path / ".github" / "workflows"; w.mkdir(parents=True)
    (w / "b.yml").write_text(
        "jobs:\n  a:\n    steps:\n      - name: one\n        run: |\n"
        "          Status: ok\n          Status: done\n",
        encoding="utf-8")
    r = run_gate("check-yaml-duplicate-keys.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout
    assert "no duplicate key" in r.stdout, r.stdout

def test_yaml_gate_catches_a_duplicate_quoted_key(tmp_path):
    """The exact L61 defect, written with quotes, must not slip through."""
    w = tmp_path / ".github" / "workflows"; w.mkdir(parents=True)
    (w / "quoted.yml").write_text(
        "jobs:\n  a:\n    with:\n      \"retention-days\": 7\n      \"retention-days\": 30\n",
        encoding="utf-8")
    r = run_gate("check-yaml-duplicate-keys.mjs", "--root", str(tmp_path))
    assert r.returncode == 1 and "retention-days" in r.stdout, r.stdout

def test_yaml_gate_accepts_the_same_keys_once_per_list_item(tmp_path):
    """A `- ` item begins a NEW sibling mapping. Without this, `with:`/`run:`/`uses:` once per step
    read as duplicates — an earlier draft produced 21 false positives on the two real workflows."""
    w = tmp_path / ".github" / "workflows"; w.mkdir(parents=True)
    (w / "c.yml").write_text(
        "jobs:\n  a:\n    steps:\n      - name: one\n        uses: actions/checkout@v4\n"
        "        with:\n          fetch-depth: 0\n      - name: two\n        uses: actions/upload@v4\n"
        "        with:\n          name: b\n", encoding="utf-8")
    r = run_gate("check-yaml-duplicate-keys.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout
    assert "no duplicate key" in r.stdout, r.stdout


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


def test_python_invocation_gate_ignores_prose_and_log_messages(tmp_path):
    """Pins the 2026-08-09 scoping fix: the gate matches command POSITIONS (webServer.command,
    non-Linux workflow run: steps, package.json scripts), not the word `python` appearing anywhere
    in a file. A JSON doc's prose and a console.log help message both contain the literal text
    `python build.py` and must not fire."""
    (tmp_path / "notes.json").write_text(
        '{"note": "see python build.py for context, not a real invocation"}\n', encoding="utf-8")
    (tmp_path / "helper.mjs").write_text(
        "console.log('run:  python scripts/extract_graph.py --pending');\n", encoding="utf-8")
    r = run_gate("check-python-invocation.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_utf8_gate_ignores_hebrew_confined_to_a_comment(tmp_path):
    """Pins the 2026-08-09 scoping fix: the gate matches the print CALL's own argument, not "does
    this file contain a print anywhere and non-ASCII anywhere". Hebrew in a docstring next to an
    ASCII-only print must not fire."""
    s = tmp_path / "scripts"; s.mkdir()
    (s / "prose_only.py").write_text(
        '"""תיעוד בעברית שאינו מודפס לעולם."""\nprint("status: ok")\n', encoding="utf-8")
    r = run_gate("check-python-utf8.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout
