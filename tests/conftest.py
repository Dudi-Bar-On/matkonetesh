# tests/conftest.py — shared test guards.
#
# `skip_only_if_unavailable` is the exception-shaped twin of test_worker.py's
# `_skip_only_if_unavailable(result)`. That one already existed and already carried the lesson:
# its first version skipped on ANY failed ingest and duly reported a real SchemaViolation as an
# absent stack, so four tests went green-ish while the thing they exist to check had never run.
# That is L57.
#
# The lesson was applied in that one file and nowhere else. Rule L57's first run against the real
# tree (2026-08-10, Arc 2 Phase 2) found the same shape still living in six siblings, three of
# which wrapped the FUNCTION UNDER TEST — so a real bug in retrieval.find_impact or
# retrieval.semantic_search would have reported as "the service is down" and skipped. Registered
# as R-119a; the owner chose to repair those three now.
#
# The rule this encodes: an absence and a failure must never share an exit path. Skipping requires
# a POSITIVE marker for the condition being excused. Everything else fails, loudly.
import pytest

# Kept textually identical to test_worker.py's UNAVAILABLE_MARKERS. Deliberately NOT imported from
# there: importing a test module from conftest drags that module's own fixtures and import-time
# work into every collection. If one list changes, change both — the duplication is the cheaper of
# the two hazards, and this comment is the reason it is not an accident.
UNAVAILABLE_MARKERS = (
    "could not connect", "connection refused", "Connection refused",
    "ServiceUnavailable", "ConnectionError", "Max retries exceeded",
    "ReadTimeout", "ConnectTimeout", "11434",          # the local embedding endpoint
)


def skip_only_if_unavailable(exc, what):
    """Skip iff `exc` looks like the named service being absent; otherwise FAIL with the exception.

    `what` names the service in the skip reason, so a skipped run still says which dependency was
    missing. This is the positive marker, not a broader net — it is not a drop-in replacement for
    thinking about which exceptions a given call can legitimately raise.
    """
    text = f"{type(exc).__name__}: {exc}"
    if any(marker in text for marker in UNAVAILABLE_MARKERS):
        pytest.skip(f"{what} is unavailable: {text[:140]}")
    pytest.fail(f"{what} raised for a reason that is NOT an absent service — this is a real "
                f"failure and must not be reported as a skip: {text[:400]}")
