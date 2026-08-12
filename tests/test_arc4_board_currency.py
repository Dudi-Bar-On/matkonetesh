# tests/test_arc4_board_currency.py
#
# The board is the artifact `/status` renders, and it drifted without anyone knowing: 12 commits
# stale on 2026-08-10, while `check-board-fresh.mjs` reported OK because it only ever checked the
# version stamp. These tests make the board answer to measurement.
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "docs" / "STATUS-BOARD.md"


def run_gate(*args):
    return subprocess.run(["node", str(ROOT / "scripts" / "check-board-fresh.mjs"), *args],
                          capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))


def measured_coverage():
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    m = re.search(r"RULE COVERAGE: (\d+) of (\d+)", r.stdout)
    assert m, "could not read the coverage gate's own output:\n" + r.stdout
    return m.group(1), m.group(2)


def test_board_coverage_declaration_matches_the_coverage_gate():
    """The board carried two counting systems that never reconciled — a task counter frozen before
    2026-08-08 and a separate rule-coverage row. A figure nobody cross-checks is one that drifts."""
    live = measured_coverage()
    m = re.search(r"COVERAGE-DECLARED:\s*(\d+)\s*/\s*(\d+)", BOARD.read_text(encoding="utf-8"))
    assert m, "the board declares no machine-readable COVERAGE-DECLARED figure"
    assert (m.group(1), m.group(2)) == live, (
        "board says " + m.group(1) + "/" + m.group(2)
        + ", the gate measures " + live[0] + "/" + live[1])


def test_the_currency_check_can_actually_fail(tmp_path):
    """Prove the check fails on a drifted board. A gate that cannot fail is L57/L58, and this
    project has shipped one of those."""
    fake = tmp_path / "board.md"
    fake.write_text("COVERAGE-DECLARED: 1 / 999\nLIVE-VERSION: v291\nTARGET-VERSION: v320\n",
                    encoding="utf-8")
    r = run_gate("--board", str(fake), "--currency")
    assert r.returncode == 1, r.stdout
    assert "999" in r.stdout


def test_board_names_every_active_arc():
    """Arcs are added by hand today, which is why the board went 12 commits stale. A directory under
    .superpowers/sdd/ is an arc that ran; the board must name it.

    .superpowers/sdd/ is git-ignored local scratch — a fresh CI checkout never has it, which is a
    positive marker of absence, not a failure of this test's assertion. Skip loudly (NOT VERIFIED
    here) rather than let the anti-vacuity guard below fire on a runner that was never going to have
    any SDD workspace to examine; the guard itself stays — it is still correct for a dev machine
    that DOES have the directory but somehow finds nothing under it."""
    sdd = ROOT / ".superpowers" / "sdd"
    if not sdd.exists():
        pytest.skip(
            ".superpowers/sdd/ does not exist on this checkout (git-ignored local scratch, absent "
            "on a fresh CI clone) — NOT VERIFIED here: whether the board names every active arc.")
    active = [p.name for p in sdd.iterdir() if p.is_dir()]
    assert active, "found no SDD workspaces — this test examined NOTHING"
    text = BOARD.read_text(encoding="utf-8").lower()
    missing = [a for a in active if a.lower() not in text]
    assert not missing, "active arc(s) absent from the board: " + str(missing)


def test_board_declares_the_distance_to_a_finished_product():
    """The owner's actual question: how far from start to finish. A board that counts tasks but
    never states a target cannot answer it."""
    text = BOARD.read_text(encoding="utf-8")
    assert re.search(r"TARGET-VERSION:\s*v\d+", text), "no TARGET-VERSION declared"
    assert re.search(r"LIVE-VERSION:\s*v\d+", text), "no LIVE-VERSION declared"
