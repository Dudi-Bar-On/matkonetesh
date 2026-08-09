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
