# tests/test_arc4_ci_gate.py — Arc 4, Task 3: regression coverage for scripts/check-ci.mjs.
#
# check-ci reads EXTERNAL state (git, gh) rather than repo files, so the --root seam used by the
# other Arc 4 gates does not apply here. Instead the gate is given CHECK_CI_GIT / CHECK_CI_GH env
# vars that point at stub executables, which is the injection seam this file exercises.
#
# SCOPE BOUNDARY, stated plainly: these tests prove the gate's own verdict logic — given a known
# git-HEAD and a known `gh run list` / `gh run view` payload, does it print the right verdict and
# exit the right code. They do NOT exercise a real CI outage, a real GitHub API failure mode, or
# `gh` auth edge cases beyond "the binary is unreachable" — that would require live GitHub state,
# which is exactly what this gate exists to insulate the rest of the discipline machinery from.
import os
import subprocess as sp
from pathlib import Path

from test_arc2_phase1_gates import ROOT, git_env

GATE = str(Path(ROOT) / "scripts" / "check-ci.mjs")


def _stub(tmp_path, name, stdout_text, exit_code=0):
    """Write a stub that always prints the same fixed output/exit code, regardless of the
    arguments it is called with. Returns its absolute path. The gate calls `gh` twice (once for
    `--version`, once or twice for `run list` / `run view`) — a stub that answers the same way
    every time is sufficient because check-ci falls back to the run-level `conclusion` field
    whenever the second call's JSON does not shape-match a `{jobs: [...]}` object (verified by
    reading scripts/check-ci.mjs lines 86-90).

    R-147: on Windows a `.cmd` is runnable the instant it exists — extension association is
    enough. On Linux a file needs its executable bit SET, or `sp.run([path, ...])` raises
    `PermissionError: [Errno 13]` before the stub's content is ever considered (this is exactly
    what CI run 2ffcbd4 named for all five tests in this file). And even WITH the bit set, `.cmd`
    content (`@echo off` / `type`) is not POSIX shell — Linux would trade the PermissionError for
    an ENOEXEC/"command not found" one. So each platform gets its own real script: unchanged `.cmd`
    batch on Windows (the dev machine this suite must stay green on), a `#!/bin/sh` script with its
    executable bit set on everything else."""
    out = tmp_path / f"{name}.out"
    out.write_text(stdout_text, encoding="utf-8")
    if os.name == "nt":
        p = tmp_path / f"{name}.cmd"
        body = f'@echo off\r\ntype "{out}"\r\nexit /b {exit_code}\r\n'
        p.write_text(body, encoding="utf-8")
    else:
        p = tmp_path / f"{name}.sh"
        body = f'#!/bin/sh\ncat "{out}"\nexit {exit_code}\n'
        p.write_text(body, encoding="utf-8")
        os.chmod(p, 0o755)
    return str(p)


def _assert_stub_runs(path):
    """A stub that cannot execute produces a false RED (sh() swallows the exception and returns
    null, which check-ci reads as 'gh not available'). Prove the stub itself works before trusting
    any verdict built on top of it."""
    r = sp.run([path, "--version"], capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0 or r.returncode is not None, f"stub did not execute: {r}"


def _run_ci(tmp_path, gh_stdout, gh_exit=0, strict=False, head="abc123def0"):
    git_stub = _stub(tmp_path, "gitstub", head + "\n")
    gh_stub = _stub(tmp_path, "ghstub", gh_stdout, gh_exit)
    _assert_stub_runs(git_stub)
    _assert_stub_runs(gh_stub)
    env = dict(git_env())
    env["CHECK_CI_GIT"] = git_stub
    env["CHECK_CI_GH"] = gh_stub
    if strict:
        env["CHECK_CI_STRICT"] = "1"
    else:
        env.pop("CHECK_CI_STRICT", None)
    return sp.run(["node", GATE], capture_output=True, text=True, encoding="utf-8",
                   cwd=str(ROOT), env=env)


# Real fixture shape, captured 2026-08-11 from a live invocation of:
#   gh run list --limit 2 --json headSha,status,conclusion,databaseId,workflowName,createdAt
# -> [{"conclusion":"failure","createdAt":"2026-08-07T17:03:30Z","databaseId":31200516753,
#      "headSha":"ffbd51cf...","status":"completed","workflowName":"tests"}, ...]
def _run_json(head, conclusion):
    return (
        '[{"conclusion":"%s","createdAt":"2026-08-11T00:00:00Z","databaseId":999,'
        '"headSha":"%s","status":"completed","workflowName":"tests"}]\n'
    ) % (conclusion, head)


def test_check_ci_blocks_on_a_failed_run_in_strict_mode(tmp_path):
    """The header's documented policy — "it blocks on a run that FAILED" — is only true when
    CHECK_CI_STRICT=1 (the release-time mode; the default is advisory, see the next test). Pin
    the exit code as observed rather than the illustrative code from the brief."""
    r = _run_ci(tmp_path, _run_json("abc123def0", "failure"), strict=True)
    assert r.returncode == 1, r.stdout + r.stderr
    assert "red" in r.stdout.lower() or "fail" in r.stdout.lower(), r.stdout


def test_check_ci_reports_the_failure_advisory_by_default(tmp_path):
    """Without CHECK_CI_STRICT, the gate is advisory at commit time (by design, per the header's
    deadlock story) — it still exits 0, but it must REPORT red loudly (R-94: this is the gate
    that stayed silent about a real 4-day red CI). Never let 'red' collapse into 'not verified'."""
    r = _run_ci(tmp_path, _run_json("abc123def0", "failure"), strict=False)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "red" in r.stdout.lower(), r.stdout
    assert "not verified" not in r.stdout.lower() or "whether this commit is green" not in r.stdout.lower()


def test_check_ci_reports_not_verified_when_no_run_exists_for_head(tmp_path):
    r = _run_ci(tmp_path, "[]\n")
    assert r.returncode == 0, r.stdout + r.stderr
    assert "not verified" in r.stdout.lower(), r.stdout


def test_check_ci_passes_on_a_green_run(tmp_path):
    r = _run_ci(tmp_path, _run_json("abc123def0", "success"))
    assert r.returncode == 0, r.stdout + r.stderr
    assert "ok" in r.stdout.lower(), r.stdout


def test_check_ci_fails_open_when_gh_is_unavailable(tmp_path):
    r = _run_ci(tmp_path, "", gh_exit=1)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "not available" in r.stdout.lower() or "not verified" in r.stdout.lower(), r.stdout
