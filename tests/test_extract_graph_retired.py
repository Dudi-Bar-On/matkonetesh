"""R-136 (owner decision, 2026-08-11): extract_graph.py's write path is retired — the model-
extracted `proposed` edges are being superseded, not promoted, and nothing should keep adding to
the pile while that happens (87 revisions were still queued at measurement time).

These tests drive `scripts.extract_graph.main()` directly through sys.argv, with PostgreSQL and
Neo4j entirely absent (`fetch_chunks` is monkeypatched to raise if it is ever called) — proving the
refusal happens BEFORE any database connection is attempted, not merely before a write.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts import extract_graph  # noqa: E402


def _forbid_fetch(monkeypatch):
    def _boom(*a, **k):
        raise AssertionError("fetch_chunks must not be called while the extractor is retired")
    monkeypatch.setattr(extract_graph, "fetch_chunks", _boom)


def test_a_plain_pending_run_refuses_and_touches_no_database(monkeypatch, capsys):
    """The default, no-flag shape `--pending` (what run-extraction.ps1 invokes) must refuse."""
    _forbid_fetch(monkeypatch)
    monkeypatch.delenv("MK_ALLOW_PROPOSED_EXTRACTION", raising=False)
    monkeypatch.setattr(sys, "argv", ["extract_graph.py", "--pending"])

    rc = extract_graph.main()

    assert rc == 1, "a retired extractor must exit non-zero, not silently succeed"
    out = capsys.readouterr().out
    assert "RETIRED" in out and "R-136" in out, f"the refusal must name itself and the decision; got: {out!r}"


def test_the_override_env_var_lets_it_run_past_the_guard(monkeypatch):
    """MK_ALLOW_PROPOSED_EXTRACTION=1 is the documented, deliberate escape hatch — it must clear
    the guard and reach fetch_chunks (which then fails for an unrelated, expected reason: no chunks
    in the fake return, so main() exits 0 having done nothing — the guard itself is what is under
    test here, not the rest of the pipeline)."""
    monkeypatch.setattr(extract_graph, "fetch_chunks", lambda *a, **k: [])
    monkeypatch.setenv("MK_ALLOW_PROPOSED_EXTRACTION", "1")
    monkeypatch.setattr(sys, "argv", ["extract_graph.py", "--pending"])

    rc = extract_graph.main()

    assert rc == 0, "override set + no chunks in scope => a clean no-op exit, proving the guard was cleared"


def test_estimate_mode_is_exempt_because_it_writes_nothing(monkeypatch):
    """--estimate never calls write_proposed (see its own docstring) — it stays available for cost
    estimation even while the write path is retired, so it must reach fetch_chunks."""
    called = []
    monkeypatch.setattr(extract_graph, "fetch_chunks", lambda *a, **k: called.append(1) or [])
    monkeypatch.delenv("MK_ALLOW_PROPOSED_EXTRACTION", raising=False)
    monkeypatch.setattr(sys, "argv", ["extract_graph.py", "--estimate"])

    extract_graph.main()

    assert called, "--estimate must not be blocked by the retirement guard"
