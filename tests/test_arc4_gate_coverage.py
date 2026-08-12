# tests/test_arc4_gate_coverage.py — Arc 4: the enforcement machinery gets its own regression net.
import os
import subprocess
from test_arc2_phase1_gates import ROOT, run_gate, git_env
from conftest import requires_database


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


# --- Task 4: check-geniza-fresh.mjs / check-rules-complete.mjs — the two database-backed gates ---
#
# Both gates embed a Python probe run via a searched-for interpreter (`python`/`py`/`python3` for
# geniza, `py -3`/`python3` for rules). CHECK_GENIZA_PY / CHECK_RULES_PY substitute a stub for that
# interpreter, so every verdict branch (fresh / stale / cannot-connect / rule-missing) is driven
# without touching PostgreSQL. The stub is a `.cmd` that ignores its argv and always prints the
# same fixed text on the stream the gate reads (stdout for a clean probe result, stderr + a
# non-zero exit for the shape an uncaught Python exception takes).
#
# Fixture strings below are REAL captured shapes, not invented text:
#   - GENIZA_CANNOT_CONNECT: captured 2026-08-11 by connecting psycopg2 directly to a closed port
#     (`psycopg2.connect(host="127.0.0.1", port=1, ...)`) — the same exception class
#     check-geniza-fresh's own connect_reader() raises when the geniza's Postgres is not listening.
#   - GENIZA_FRESH_JSON / RULES_CLEAN counts: captured 2026-08-11 from live
#     `node scripts/check-geniza-fresh.mjs` / `check-rules-complete.mjs` runs against the real,
#     currently-fresh store (964 on-disk docs / 969 stored / 0 stale / 0 missing / 5 orphaned;
#     163 on-disk rules / 162 current in mk_rules — off by one only in the missing-rule fixture
#     below, which fabricates one absent rule_id on top of that real count).
#   - GENIZA_STALE_JSON / RULES_MISSING_JSON: the same real shapes with one path/rule_id moved into
#     the failing bucket — the gates' verdict logic reads this field, not a live diff, so this is
#     sufficient to drive the block branch without a database.

GENIZA_CANNOT_CONNECT = (
    'psycopg2.OperationalError: connection to server at "127.0.0.1", port 1 failed: '
    'timeout expired\n'
)

GENIZA_FRESH_JSON = (
    '{"disk": 964, "stored": 969, "missing": [], "stale": [], '
    '"orphaned": [], "pending_extraction": 86}\n'
)

GENIZA_STALE_JSON = (
    '{"disk": 964, "stored": 969, "missing": [], '
    '"stale": ["docs/process/development-discipline.md"], '
    '"orphaned": [], "pending_extraction": 86}\n'
)

RULES_MISSING_JSON = '{"disk": 163, "stored": 162, "missing": ["L999"], "extra": []}\n'


# R-151/R-161: on Windows a `.cmd` batch stub is runnable and interpretable as-is. On Linux, the
# gates spawn the substitute interpreter with `shell: true` (required so Windows can exec a .cmd
# without a shell in the loop), which means the *substitute* is executed as an argument to
# `/bin/sh -c`, and `.cmd` content (`@echo off` / `type` / `%*`) is not POSIX shell — sh's own
# parser rejects the leading `@` with exactly the "Syntax error: word unexpected" CI showed. Same
# platform split as test_arc4_ci_gate.py's `_stub()` (R-147c): one real script per platform.


def _stub(tmp_path, name, stdout_text, exit_code=0):
    """Stub that ignores its argv and always prints the same fixed STDOUT — the shape a clean
    Python probe takes. Same idea as test_arc4_ci_gate.py's helper of the same name, duplicated
    rather than imported (importing a sibling test module would drag its fixtures and collection
    into this file for no benefit)."""
    out = tmp_path / f"{name}.out"
    out.write_text(stdout_text, encoding="utf-8")
    if os.name == "nt":
        p = tmp_path / f"{name}.cmd"
        p.write_text(f'@echo off\r\ntype "{out}"\r\nexit /b {exit_code}\r\n', encoding="utf-8")
    else:
        p = tmp_path / f"{name}.sh"
        p.write_text(f'#!/bin/sh\ncat "{out}"\nexit {exit_code}\n', encoding="utf-8")
        os.chmod(p, 0o755)
    return str(p)


def _stub_stderr(tmp_path, name, stderr_text, exit_code=1):
    """Stub that prints to STDERR and exits non-zero — the shape a real interpreter takes when
    the embedded Python program raises an uncaught exception (traceback on stderr, non-zero exit)
    instead of returning cleanly. Both gates classify on `stderr`, not `stdout`, for this branch,
    so a stub answering on the wrong stream would test nothing."""
    out = tmp_path / f"{name}.out"
    out.write_text(stderr_text, encoding="utf-8")
    if os.name == "nt":
        p = tmp_path / f"{name}.cmd"
        p.write_text(f'@echo off\r\ntype "{out}" 1>&2\r\nexit /b {exit_code}\r\n', encoding="utf-8")
    else:
        p = tmp_path / f"{name}.sh"
        p.write_text(f'#!/bin/sh\ncat "{out}" 1>&2\nexit {exit_code}\n', encoding="utf-8")
        os.chmod(p, 0o755)
    return str(p)


def _tee_stub(tmp_path, name, stdout_text, marker):
    """Stub that BOTH records its own argv to `marker` and returns canned stdout — used to pin
    check-rules-complete's read-only guarantee: a mismatch must not trigger a second, write-shaped
    call. On Windows `%*` truncates at the embedded probe program's first newline; on POSIX `$*`
    has the same property — harmless here, since the assertion only needs to prove no write-shaped
    token ever arrived."""
    out = tmp_path / f"{name}.out"
    out.write_text(stdout_text, encoding="utf-8")
    if os.name == "nt":
        p = tmp_path / f"{name}.cmd"
        p.write_text(f'@echo off\r\necho %* >> "{marker}"\r\ntype "{out}"\r\nexit /b 0\r\n',
                      encoding="utf-8")
    else:
        p = tmp_path / f"{name}.sh"
        p.write_text(f'#!/bin/sh\necho "$*" >> "{marker}"\ncat "{out}"\nexit 0\n', encoding="utf-8")
        os.chmod(p, 0o755)
    return str(p)


def _run_with_env(script, **env):
    e = dict(git_env())
    e.update(env)
    return subprocess.run(["node", str(ROOT / "scripts" / script)], capture_output=True,
                           text=True, encoding="utf-8", cwd=str(ROOT), env=e)


def test_geniza_fresh_skips_loudly_when_the_stack_is_down(tmp_path):
    r = _run_with_env("check-geniza-fresh.mjs",
                       CHECK_GENIZA_PY=_stub_stderr(tmp_path, "py", GENIZA_CANNOT_CONNECT))
    assert r.returncode == 0, r.stdout + r.stderr
    assert "skip" in r.stdout.lower() or "not blocking" in r.stdout.lower()
    assert "geniza" in r.stdout.lower()   # the skip names its subject — a silent skip is the graphify failure


def test_geniza_fresh_blocks_on_a_stale_document(tmp_path):
    # GENIZA_NO_HEAL=1 observes the FAIL verdict directly. Without it the gate would try to
    # self-heal by re-invoking the (stub) interpreter to "repair" the drift — which the stub
    # would answer with its same canned success text, masking the very verdict this test exists
    # to pin. This also satisfies the brief's requirement that self-heal never fires against the
    # real store: with the stub substituted for the interpreter, a self-heal attempt could only
    # ever reach the stub, never Postgres — GENIZA_NO_HEAL=1 just makes that explicit rather than
    # relying on it.
    r = _run_with_env("check-geniza-fresh.mjs",
                       CHECK_GENIZA_PY=_stub(tmp_path, "py", GENIZA_STALE_JSON),
                       GENIZA_NO_HEAL="1")
    assert r.returncode == 1, r.stdout + r.stderr
    assert "development-discipline.md" in r.stdout


def test_geniza_fresh_passes_when_probe_reports_clean(tmp_path):
    """Proves the stale fixture above is what makes the gate fail, not the seam itself: the exact
    same machinery, fed a clean probe result, must still pass."""
    r = _run_with_env("check-geniza-fresh.mjs",
                       CHECK_GENIZA_PY=_stub(tmp_path, "py", GENIZA_FRESH_JSON))
    assert r.returncode == 0, r.stdout + r.stderr


def test_geniza_fresh_live_smoke():
    """Against the real store — skipped, loudly, when the geniza is not configured here."""
    requires_database("geniza")
    r = run_gate("check-geniza-fresh.mjs")
    assert r.returncode == 0, r.stdout + r.stderr   # real repo is fresh at commit time by definition


def test_rules_complete_blocks_on_a_rule_missing_from_the_store(tmp_path):
    r = _run_with_env("check-rules-complete.mjs",
                       CHECK_RULES_PY=_stub(tmp_path, "py", RULES_MISSING_JSON))
    assert r.returncode == 1, r.stdout + r.stderr
    assert "L999" in r.stdout


def test_rules_complete_is_read_only_even_on_a_mismatch(tmp_path):
    """The round-1 defect (see the gate's own header), pinned forever: checking must not repair.
    The stub tees its own argv to `marker`; assert no write-shaped token (build_rules_store /
    sync) ever reached it, even though the probe result fed in IS a mismatch."""
    marker = tmp_path / "invoked.txt"
    r = _run_with_env("check-rules-complete.mjs",
                       CHECK_RULES_PY=_tee_stub(tmp_path, "py", RULES_MISSING_JSON, marker))
    assert r.returncode == 1, r.stdout + r.stderr
    assert marker.exists(), "the stub was never invoked — this test proves nothing"
    marker_text = marker.read_text(encoding="utf-8")
    assert "build_rules_store" not in marker_text
    assert "sync" not in marker_text


def test_rules_complete_live_smoke():
    """Against the real store — skipped, loudly, when mk_rules is not configured here."""
    requires_database("mk_rules")
    r = run_gate("check-rules-complete.mjs")
    assert r.returncode == 0, r.stdout + r.stderr
