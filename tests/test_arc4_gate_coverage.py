# tests/test_arc4_gate_coverage.py — Arc 4: the enforcement machinery gets its own regression net.
import subprocess
from test_arc2_phase1_gates import run_gate, git_env


def _git_repo(tmp_path, files):
    subprocess.run(["git", "init", "-q"], cwd=str(tmp_path), check=True, env=git_env())
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=str(tmp_path), check=True, env=git_env())
    return tmp_path


def test_no_arbitrary_waits_catches_a_planted_sleep(tmp_path):
    _git_repo(tmp_path, {"tests/x.spec.ts": "await page.waitForTimeout(500);\n"})
    r = run_gate("check-no-arbitrary-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "x.spec.ts" in r.stdout


def test_no_arbitrary_waits_ignores_a_commented_occurrence(tmp_path):
    _git_repo(tmp_path, {"tests/x.spec.ts": "// never use waitForTimeout here\nawait ok();\n"})
    r = run_gate("check-no-arbitrary-waits.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout


def test_no_arbitrary_waits_clean_on_the_real_repo():
    r = run_gate("check-no-arbitrary-waits.mjs")
    assert r.returncode == 0, r.stdout


def test_no_arbitrary_waits_fails_open_on_unreadable_root():
    r = run_gate("check-no-arbitrary-waits.mjs", "--root", "no/such/dir")
    assert r.returncode == 0
    assert "could not" in r.stdout.lower()


def test_workflows_catches_a_duplicate_key(tmp_path):
    wf = ("on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n"
          "    steps:\n      - uses: actions/upload-artifact@v4\n"
          "        with:\n          retention-days: 7\n          retention-days: 30\n")
    _git_repo(tmp_path, {".github/workflows/tests.yml": wf})
    r = run_gate("check-workflows.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "retention-days" in r.stdout or "duplicate" in r.stdout.lower()


def test_workflows_catches_a_job_without_runs_on(tmp_path):
    _git_repo(tmp_path, {".github/workflows/t.yml": "on: push\njobs:\n  t:\n    steps:\n      - run: echo hi\n"})
    r = run_gate("check-workflows.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout


def test_workflows_passes_a_healthy_workflow(tmp_path):
    _git_repo(tmp_path, {".github/workflows/t.yml": "on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n"})
    r = run_gate("check-workflows.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout


def test_workflows_clean_on_the_real_repo():
    r = run_gate("check-workflows.mjs")
    assert r.returncode == 0, r.stdout


def test_requirements_catches_an_undeclared_import(tmp_path):
    _git_repo(tmp_path, {
        "src/mod.py": "import tree_sitter\n",
        "requirements.txt": "requests\n",
    })
    r = run_gate("check-requirements.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    # The gate reports the PyPI distribution name (underscores normalized to hyphens per its own
    # DIST-mapping comment), so the correct assertion here is "tree-sitter", not the import spelling.
    assert "tree-sitter" in r.stdout

def test_requirements_ignores_stdlib_imports(tmp_path):
    _git_repo(tmp_path, {"src/mod.py": "import json, os, pathlib\n", "requirements.txt": "\n"})
    r = run_gate("check-requirements.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_requirements_clean_on_the_real_repo():
    r = run_gate("check-requirements.mjs")
    assert r.returncode == 0, r.stdout

def test_commands_exist_catches_a_dead_script_reference(tmp_path):
    _git_repo(tmp_path, {"CLAUDE.md": "Run `python scripts/does-not-exist.py` before work.\n"})
    r = run_gate("check-commands-exist.mjs", "--root", str(tmp_path))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "does-not-exist.py" in r.stdout

def test_commands_exist_passes_a_live_reference(tmp_path):
    _git_repo(tmp_path, {
        "CLAUDE.md": "Run `python scripts/ok.py`.\n",
        "scripts/ok.py": "print('ok')\n",
    })
    r = run_gate("check-commands-exist.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_commands_exist_honors_the_historical_exemption(tmp_path):
    _git_repo(tmp_path, {"CLAUDE.md": "`scripts/memsync.py` was deleted on 2026-08-05.\n"})
    r = run_gate("check-commands-exist.mjs", "--root", str(tmp_path))
    assert r.returncode == 0, r.stdout

def test_commands_exist_clean_on_the_real_repo():
    r = run_gate("check-commands-exist.mjs")
    assert r.returncode == 0, r.stdout
