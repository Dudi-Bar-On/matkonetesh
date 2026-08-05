"""The infrastructure dependencies are what we decided they are — asserted, not assumed.

WHY THIS FILE EXISTS.

`llama-index-graph-stores-neo4j==0.7.0` declares `neo4j<6,>=5.16.0`. The owner ruled on
2026-08-05 that we run driver 6.2, because the deciding factor is not only backward compatibility:
6.x carries two Windows-specific bug fixes on the platform this project develops on
(`socket.EAI_ADDRFAMILY` on import, 6.0.1; DNS error re-write, 6.0.2), a `Result` iteration
speed-up (6.2.0), and two connection-timeout fixes (6.0.0, 6.2.0).

Satisfying that ruling requires OVERRIDING a declared upstream constraint, and pip has no
override mechanism — `pip install -r` with both pins returns ResolutionImpossible, verified, not
assumed. So the override is a separate file installed with --no-deps, which means it can be
silently undone: any ordinary `pip install -r requirements.txt` re-resolves neo4j back to 5.x
without a word.

An override that can revert in silence is not a decision, it is a coincidence waiting to end.
These tests are what make it a decision.

The pin was investigated before it was overridden, and the investigation is recorded here so
nobody repeats it. The integration touches exactly FOUR driver APIs — `neo4j.Query`,
`driver.execute_query`, `driver.session`, `driver.close` — and NONE of them appears in driver
6.0's removal list. The constraint reads as "6 was never tested", not "6 breaks us": driver 6.0
shipped 2025-09-30, five and a half months BEFORE integration 0.7.0 was published, and no issue
or PR in run-llama/llama_index tracks relaxing it.

If a future integration release relaxes the constraint to allow 6.x, the override file should be
deleted and `neo4j` moved into requirements.txt proper. test_override_is_still_needed below fails
when that day comes, so the workaround cannot outlive its reason.
"""

from __future__ import annotations

import pytest

neo4j = pytest.importorskip("neo4j", reason="the graph driver is not installed in this environment")

MIN_DRIVER = (6, 2)


def _version_tuple(raw: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in raw.split("."):
        digits = ""
        for ch in piece:
            if not ch.isdigit():
                break
            digits += ch
        if not digits:
            break
        parts.append(int(digits))
    return tuple(parts)


def test_driver_major_version_is_the_one_the_owner_ruled_on():
    """The installed driver is 6.2+, not the 5.x that pip re-resolves to by default.

    This is the assertion that catches a silent revert. It fails on a plain
    `pip install -r requirements.txt`, which is exactly the event worth failing on.
    """
    got = _version_tuple(neo4j.__version__)
    assert got[:2] >= MIN_DRIVER, (
        f"neo4j driver is {neo4j.__version__}, expected >= {'.'.join(map(str, MIN_DRIVER))}. "
        "pip has re-resolved it back under the integration's `neo4j<6` constraint. "
        "Reinstall the override: pip install --no-deps -r requirements-overrides.txt"
    )


def test_the_four_driver_apis_the_integration_uses_still_exist():
    """The override is safe only while these four survive — so they are checked, not trusted.

    Derived by reading the installed integration source rather than its documentation. If a
    future driver removes one of them, this fails with the name of the missing API instead of
    surfacing as a runtime error somewhere inside a graph write.
    """
    assert hasattr(neo4j, "Query"), "neo4j.Query is gone — the integration constructs one directly"
    for api in ("execute_query", "session", "close"):
        assert hasattr(neo4j.Driver, api), f"neo4j.Driver.{api} is gone — the integration calls it"


def test_override_is_still_needed():
    """Fails once upstream allows 6.x — so the workaround cannot outlive its reason.

    A workaround with no expiry becomes folklore. When this goes red, the fix is to DELETE
    requirements-overrides.txt and this test, and move neo4j into requirements.txt.
    """
    from importlib.metadata import requires

    constraints = [
        r for r in (requires("llama-index-graph-stores-neo4j") or [])
        if r.split(";")[0].strip().startswith("neo4j")
    ]
    assert constraints, "the integration no longer declares a neo4j constraint at all — re-check the override"
    assert any("<6" in c for c in constraints), (
        f"upstream has relaxed its neo4j constraint to {constraints!r}. "
        "The override is obsolete: delete requirements-overrides.txt and this test, "
        "and declare neo4j in requirements.txt."
    )
