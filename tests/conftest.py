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
    "ConfigError",   # Task 11 (2026-08-11): src.knowledge.config / src.rules_store.config raise
                      # their own ConfigError, not a connection exception, when infra/.env or
                      # infra/rules-db/.env is simply absent — matched by CLASS NAME (it is the
                      # `{type(exc).__name__}: ...` prefix skip_only_if_unavailable builds below),
                      # never by message text, so a real bug that happens to mention "config"
                      # cannot forge this marker. Deliberately NOT a pre-call `requires_database()`
                      # probe here: test_service_guard.py drives this exact call site with
                      # `retrieval.find_impact` monkeypatched to raise a real ValueError, and that
                      # guard must still see the call happen and FAIL — a probe placed before the
                      # call would skip before the monkeypatch ever runs, silently defeating R-119a.
)


def requires_database(kind="geniza"):
    """Skip — do not fail — when the stack this test needs is not CONFIGURED.

    Added for CI run 31474916890 (2026-08-11, Arc 4 Task 11): the discipline job went red with
    23 failed and 16 errors, all of them `ConfigError` from tests that need PostgreSQL/Neo4j on a
    runner with no databases and no infra/.env. The gates beside those tests already handle this
    correctly — check-geniza-fresh prints 'SKIPPED — the geniza is not reachable' and
    'NOT VERIFIED here: whether the geniza matches the disk'. A test that raises ConfigError in the
    same situation reports a defect where there is only an absent dependency, which is the L57
    shape: an absence and a failure sharing one exit path.

    Deliberately NOT a blanket try/except around the test body: that would swallow a real
    ConfigError raised by a bug in the code under test. This probes the CONFIGURATION only —
    `load_config()`, which never touches the network — before the test runs; a real connection
    failure against a stack that IS configured still surfaces as a failure (or is handled by the
    caller's own `skip_only_if_unavailable`/`except psycopg2.OperationalError`), exactly as before.

    `kind`:
      * "geniza"   -> src.knowledge.config (PostgreSQL mk_reader/mk_app AND Neo4j — one StackConfig)
      * "mk_rules" -> src.rules_store.config (the separate mk_rules database, spec §4.1)

    Read from source, not guessed: both modules expose `load_config()` (cached, raises their own
    `ConfigError` naming exactly what is missing) and `ConfigError` itself — there is no
    `require_config()` and no reason to probe with `hasattr`.
    """
    import pytest as _pytest

    if kind == "geniza":
        from src.knowledge import config as cfg
    elif kind == "mk_rules":
        from src.rules_store import config as cfg
    else:
        raise ValueError(f"requires_database: unknown kind {kind!r} — expected 'geniza' or 'mk_rules'")
    try:
        cfg.load_config()
    except cfg.ConfigError as exc:
        _pytest.skip(f"{kind} is not configured — NOT VERIFIED here: whatever this test would have "
                     f"proven about {kind} ({exc})")


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
