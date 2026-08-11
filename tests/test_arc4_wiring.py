# tests/test_arc4_wiring.py — Arc 4 Task 9 closure: proves check-corpus-consistency (Task 8) is
# reachable from the real check-meta.mjs dispatcher, not merely present on disk. Same shape as
# tests/test_arc2_phase4_wiring.py — the inert-rule failure mode this arc exists to end (a script
# that exists, is unit-tested, and is never invoked from anything a real commit runs).
#
# RECURSION GUARD — same shape as tests/test_arc2_phase1_wiring.py. check-meta.mjs's own
# check-pytest step re-runs every tests/test_*.py file, INCLUDING this one. Spawning a real
# check-meta.mjs from inside a pytest run that check-pytest itself started is unbounded
# self-recursion. check-pytest.mjs sets CHECK_PYTEST_NESTED=1 on every pytest invocation it makes;
# when present, the tests below skip rather than spawn — check-pytest passing at THIS level already
# proves the suite it would otherwise re-verify. A top-level `pytest tests/` (developer or CI) never
# sets this var, so the liveness question is still genuinely exercised at depth 0.
#
# NO ENV OVERRIDES for the positive liveness assertion — that is the whole point (§3.4). The
# negative liveness assertion (META_SKIP_GATE) is the one deliberate exception: it exercises the
# documented skip mechanism itself, which by definition requires setting the env var it reads.
import os
import subprocess
import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHECK_META = ROOT / "scripts" / "check-meta.mjs"


def _run_check_meta(env=None):
    run_env = dict(os.environ)
    if env:
        run_env.update(env)
    return subprocess.run(["node", str(CHECK_META)], capture_output=True, text=True,
                           encoding="utf-8", cwd=str(ROOT), env=run_env)


@pytest.fixture(scope="module")
def check_meta_run():
    if os.environ.get("CHECK_PYTEST_NESTED"):
        pytest.skip(
            "running inside check-pytest's own pytest invocation (CHECK_PYTEST_NESTED=1) — "
            "spawning a real check-meta.mjs here would recurse (it runs check-pytest, which runs "
            "this file again); the liveness question this test asks is still exercised at a "
            "top-level, non-nested `pytest tests/` run."
        )
    return _run_check_meta()


def test_check_meta_runs_check_corpus_consistency_with_no_env_overrides(check_meta_run):
    """THE liveness contract: check-meta.mjs is invoked with the ambient environment,
    unmodified — proving the gate runs in the real chain a commit or CI run actually takes,
    not only under a test harness that sets a variable nothing else sets."""
    r = check_meta_run
    assert "check-corpus-consistency" in r.stdout, (
        "check-corpus-consistency did not run inside check-meta.mjs — "
        "the gate exists but is not wired to the real dispatcher.\n"
        f"stdout tail:\n{r.stdout[-3000:]}\nstderr:\n{r.stderr[-2000:]}"
    )
    assert r.returncode == 0, (
        f"check-meta.mjs exited {r.returncode} with check-corpus-consistency wired in "
        f"and no injected fault — it must be green on the real tree.\n"
        f"stdout tail:\n{r.stdout[-3000:]}\nstderr:\n{r.stderr[-2000:]}"
    )


def test_check_meta_skip_gate_for_corpus_consistency_prints_not_silent():
    """Negative liveness: META_SKIP_GATE=check-corpus-consistency must be visible in the
    transcript, never a silent bypass (this file's own SKIP_LOG + SKIPPED-line mechanism,
    scripts/check-meta.mjs). Runs its OWN check-meta.mjs invocation (not the shared fixture)
    because it needs a different env — still guarded against the same recursion."""
    if os.environ.get("CHECK_PYTEST_NESTED"):
        pytest.skip(
            "running inside check-pytest's own pytest invocation (CHECK_PYTEST_NESTED=1) — "
            "see check_meta_run's docstring above for the recursion this avoids."
        )
    r = _run_check_meta(env={"META_SKIP_GATE": "check-corpus-consistency"})
    assert "check-corpus-consistency" in r.stdout
    assert "SKIPPED" in r.stdout
    skip_lines = [l for l in r.stdout.splitlines() if "SKIPPED" in l]
    assert any("check-corpus-consistency" in l for l in skip_lines), (
        f"a SKIPPED line was printed but did not name check-corpus-consistency:\n{skip_lines}"
    )
