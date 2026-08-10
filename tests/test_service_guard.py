# tests/test_service_guard.py — R-119a: the three tests that wrapped the function under test in a
# catch-all now FAIL on a real bug instead of reporting it as an absent service.
#
# The regression these pin is not hypothetical and not new: test_worker.py's own header records
# that a real SchemaViolation was once reported as "stack unavailable" and skipped, and four tests
# went green-ish. That incident is L57. Rule L57's first run against the real tree found the same
# shape still in six files; the owner chose to repair the three that wrap product calls.
import pytest

from conftest import skip_only_if_unavailable
from src.knowledge import retrieval


def test_the_guard_skips_when_the_service_really_is_absent():
    with pytest.raises(BaseException) as caught:
        skip_only_if_unavailable(ConnectionError("connection refused"), "Neo4j")
    assert caught.typename == "Skipped", f"expected a skip, got {caught.typename}"


def test_the_guard_fails_when_the_exception_is_a_real_bug():
    """The whole point: a bug in the product must not exit through the skip path."""
    with pytest.raises(BaseException) as caught:
        skip_only_if_unavailable(ValueError("unknown filter axis 'nmaespace'"), "retrieval")
    assert caught.typename == "Failed", f"a real bug reported as {caught.typename}, not a failure"
    assert "NOT an absent service" in str(caught.value)


def _raise_real_bug(*_a, **_kw):
    raise ValueError("unknown filter axis 'nmaespace'")


def test_find_impact_site_fails_on_a_real_bug_rather_than_skipping(monkeypatch):
    """Drives the REAL call site: with find_impact raising a non-connectivity error, the test at
    tests/test_retrieval.py must FAIL, not skip. Before the R-119a repair this skipped."""
    monkeypatch.setattr(retrieval, "find_impact", _raise_real_bug)
    import tests.test_retrieval as tr
    with pytest.raises(BaseException) as caught:
        tr.test_find_impact_runs_against_the_live_graph()
    assert caught.typename == "Failed", (
        f"a real bug inside find_impact exited as {caught.typename} — the test still masks "
        f"failures as an unreachable service")


def test_semantic_search_site_fails_on_a_real_bug_rather_than_skipping(monkeypatch):
    """Same, for the semantic-search guard in tests/test_acceptance.py. Asserts on the guard the
    site now uses rather than re-running the whole acceptance flow (which needs a live stack)."""
    import tests.test_acceptance as ta
    assert hasattr(ta, "skip_only_if_unavailable"), (
        "test_acceptance.py does not use the positive-marker guard — its semantic_search wrap "
        "still catches everything and skips")
    with pytest.raises(BaseException) as caught:
        ta.skip_only_if_unavailable(ValueError("boom"), "the local embedding model")
    assert caught.typename == "Failed"
