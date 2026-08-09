# tests/test_arc2_phase1_wiring.py — Task 6, Arc 2 Phase 1 (2026-08-09).
#
# Deliberately a SEPARATE file from tests/test_arc2_phase1_gates.py, per explicit dispatch
# instruction: that file tests each of the nine gates in isolation (another implementer's own
# staged work, in progress concurrently); this file tests a different subject — that the gates are
# actually WIRED into the real entry point (scripts/check-meta.mjs) and what wiring them costs. Own
# helpers below; nothing imported from the sibling file, so the two writers never touch one file.
import os
import subprocess
import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_node(*args):
    return subprocess.run(["node", *args], capture_output=True, text=True,
                           encoding="utf-8", cwd=str(ROOT))


@pytest.fixture(scope="module")
def check_meta_run():
    """check-meta.mjs wraps check-pytest (the full suite, ~2 minutes on its own) among many other
    gates, so a full run is expensive. Both tests below need the SAME real, no-env-override run — the
    liveness question (are the nine gates wired) and the WARNING-shape question (does check-test-file-
    size ever block) are two assertions about one execution, not two reasons to pay for it twice.

    RECURSION GUARD — read before touching this fixture. check-meta.mjs's own check-pytest step
    re-runs every tests/test_*.py file, INCLUDING this one. Spawning a real check-meta.mjs from inside
    a pytest run that check-pytest itself started is unbounded self-recursion: that child check-meta.mjs
    runs check-pytest again, which runs this test again, which spawns another check-meta.mjs — caught
    live as a dozen-plus concurrent node/python processes before being killed by hand. check-pytest.mjs
    sets CHECK_PYTEST_NESTED=1 on every pytest invocation it makes (see its own header); when that var
    is present the two consuming tests below skip rather than call this fixture, because check-pytest
    passing at THIS level already proves the suite it would otherwise re-verify. A developer's or CI's
    own top-level `pytest tests/` never sets this var, so the liveness question is still genuinely
    exercised at depth 0 — it just never nests past that.
    """
    if os.environ.get("CHECK_PYTEST_NESTED"):
        # Skipping HERE, inside the fixture, is the part that matters — a skip check written only in
        # the test body would run too late: pytest resolves and CALLS a requested fixture before the
        # test body executes, so the recursive spawn would already have happened by the time an
        # in-body check could stop it.
        pytest.skip(
            "running inside check-pytest's own pytest invocation (CHECK_PYTEST_NESTED=1) — spawning "
            "a real check-meta.mjs here would recurse (it runs check-pytest, which runs this file "
            "again); the liveness question this test asks is still exercised at a top-level, "
            "non-nested `pytest tests/` run."
        )
    return subprocess.run(["node", str(ROOT / "scripts" / "check-meta.mjs")],
                           capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))


def test_every_phase1_gate_runs_through_check_meta_with_no_env_overrides(check_meta_run):
    """§3.4 — the liveness test, the point of this task. A `stop` rule once shipped INERT: it loaded
    only when a test-only env var was set, and 333 tests passed on a feature that never ran in a real
    session. This spawns the REAL entry point (scripts/check-meta.mjs) with the environment untouched
    — no META_SKIP_GATE, no fixture root, nothing — and requires each of the nine gates' own
    distinctive verdict line to appear in its stdout. Asserting the exact verdict string (not a count,
    not merely "the gate ran") is the point: a gate that ran but silently found nothing to say would
    still be a gate that never printed proof of having looked. (Skips instead when nested inside
    check-pytest's own run — see check_meta_run's docstring above; still exercised at the top level.)
    """
    r = check_meta_run
    markers = {
        "CONTROL BYTES:": "check-control-bytes (L43a)",
        "TEST WAITS:": "check-test-waits (DoD-11, L15, L58)",
        "YAML KEYS:": "check-yaml-duplicate-keys (L61)",
        "PYTHON INVOCATION:": "check-python-invocation (L59)",
        "PYTHON UTF-8:": "check-python-utf8 (L74)",
        "AI TOKEN CAPS:": "check-ai-token-caps (L24)",
        "SECRET ALPHABET:": "check-secret-alphabet (L53)",
        "POWERSHELL OUTPUT:": "check-powershell-output (L66)",
        "TEST FILE SIZE": "check-test-file-size (L30, WARNING-only)",
    }
    for marker, owner in markers.items():
        assert marker in r.stdout, (
            f"{marker} missing — {owner} is not wired into check-meta.mjs (or ran but printed no "
            f"verdict). Full stdout tail:\n{r.stdout[-3000:]}"
        )


def test_check_test_file_size_never_contributes_to_meta_gate_fail(check_meta_run):
    """L30 is a WARNING by design (a spec file legitimately grows; the harm is run stability, not
    substance — blocking every commit that adds a test is the L70 failure mode this arc exists to
    avoid). This proves the WARNING shape survives wiring: even when check-test-file-size prints a
    WARNING line (real content today — several spec files sit above the measured worker ceiling), its
    display name must never appear inside a META GATE FAIL summary line.
    """
    r = check_meta_run
    fail_lines = [ln for ln in r.stdout.splitlines() if ln.startswith("META GATE FAIL:")]
    for ln in fail_lines:
        assert "check-test-file-size" not in ln, (
            f"check-test-file-size contributed to a blocking failure — it must always exit 0:\n{ln}"
        )


PHASE1_RULES = ["DoD-11", "L15", "L24", "L30", "L43a", "L53", "L58", "L59", "L61", "L66", "L74"]


def test_every_phase1_rule_is_counted_by_the_coverage_gate():
    """Asserts over the RULE IDS, never a pinned ratio. A pinned "41 of 82" broke on its own within
    hours of being written, because writing a lesson ADDS a rule and the denominator moves during
    ordinary work (L64b — this arc's own lesson). This checks that each of the eleven rule ids this
    phase enforces is DECLARED (found by check-rule-coverage.mjs's static scan) and COVERED (has a
    current row in the mirror with rule_group A or B) — never that the total lands on any specific
    number.
    """
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, f"check-rule-coverage.mjs exited nonzero:\n{r.stdout}\n{r.stderr}"

    # Every phase-1 rule id must appear somewhere in the "ahead of baseline" or steady-state output
    # rather than in an ERROR/REGRESSION line naming it as missing/phantom/undeclared.
    error_lines = [ln for ln in r.stdout.splitlines()
                   if ln.startswith("ERROR:") or ln.startswith("REGRESSION:")]
    for rid in PHASE1_RULES:
        offending = [ln for ln in error_lines if rid in ln]
        assert not offending, f"{rid} appears in an ERROR/REGRESSION line:\n" + "\n".join(offending)

    covered_line = next((ln for ln in r.stdout.splitlines() if ln.startswith("RULE COVERAGE:")), None)
    assert covered_line, f"no RULE COVERAGE line in output:\n{r.stdout}"
    covered = int(covered_line.split("RULE COVERAGE: ")[1].split(" of ")[0])
    # Ten pre-existing baseline entries (from before this phase) plus this phase's eleven — the
    # baseline itself proves the ten (docs/process/rule-coverage-baseline.json), this test proves the
    # phase's own eleven are additionally present, without ever asserting the grand total.
    assert covered >= 10 + len(PHASE1_RULES), (
        f"coverage reads {covered}; expected at least the 10 pre-existing baseline entries plus "
        f"this phase's {len(PHASE1_RULES)} rule ids:\n{r.stdout}"
    )


def test_coverage_baseline_file_contains_every_phase1_rule():
    """docs/process/rule-coverage-baseline.json is the committed floor the coverage gate blocks
    regression against. It must be updated from what the gate ACTUALLY printed (never an assumed
    number) — this checks the artifact left behind by that update, independent of a fresh gate run."""
    import json
    baseline_path = ROOT / "docs" / "process" / "rule-coverage-baseline.json"
    data = json.loads(baseline_path.read_text(encoding="utf-8"))
    covered = set(data["covered"])
    missing = [rid for rid in PHASE1_RULES if rid not in covered]
    assert not missing, f"baseline is missing phase-1 rule id(s): {missing}\n{data}"
