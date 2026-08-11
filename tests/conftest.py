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
import os
import pathlib

import pytest


# R-154 (2026-08-11): pytest-xdist parallelism (`-n 8`, added in scripts/check-pytest.mjs — capped
# below `os.cpu_count()` by R-154(b) after `-n auto` flaked under 32-way contention) is
# safe ONLY once every test that touches a resource shared across the whole process tree is pinned
# to run on a single worker. Two incidents already paid for the alternative: §11a's two concurrent
# SUITE runs producing 12 then 127 phantom ERR_CONNECTION_REFUSED failures, and L87's dispatcher
# re-entering itself and orphaning ~35 processes. Under xdist, files sharing a worker still run one
# at a time (xdist schedules whole test ITEMS, never overlapping within one worker process), so
# grouping every file below onto ONE named xdist_group makes them behave exactly as they do today —
# serialized relative to each other — while every other file is free to run in a different worker.
#
# Enumerated here, not scattered as per-file markers, so the whole risk surface is auditable in one
# place. A file is listed if ANY test in it does one of the three things the brief named:
#
#   spawns a gate      — a real subprocess of check-meta.mjs, check-pytest.mjs, or a CLI that
#                         itself opens a database connection (build_rules_store's CLI)
#   binds a port       — opens a real socket and/or spawns a real child server process
#   writes to a database — a real connection to the geniza (PostgreSQL mk_reader/mk_app, Neo4j) or
#                         the separate mk_rules database, INCLUDING a read-only connection or an
#                         advisory-lock probe: contention and locking are exactly the failure mode
#                         being guarded against, not only writes
#
# Verified by reading each file's imports and call sites (not by filename pattern) on 2026-08-11:
#   test_pg_schema.py                 — psycopg2.connect against the live geniza Postgres
#   test_pg_spec_coverage.py          — imports connect() from test_pg_schema.py, same live DB
#   test_graph_schema.py              — neo4j.GraphDatabase.driver against the live Neo4j
#   test_acceptance.py                — src.knowledge.{config,retrieval,worker}, incl. PGVectorStore
#   test_acceptance_infra.py          — src.knowledge.config + a real `psql --version` subprocess
#   test_retrieval.py                 — src.knowledge.{config,retrieval} against the live geniza
#   test_service_guard.py             — src.knowledge.retrieval against the live geniza
#   test_worker.py                    — src.knowledge.worker.SingleWriter: a real Postgres
#                                        pg_advisory_lock — the definition of shared, contended state
#   test_extract.py                   — a real HTTP call to the local Ollama endpoint (port 11434)
#   test_arc4_gate_coverage.py        — test_geniza_fresh_live_smoke / test_rules_complete_live_smoke
#                                        spawn the real check-geniza-fresh.mjs / check-rules-complete
#                                        gates against the live geniza
#   test_arc2_phase1_wiring.py        — spawns a real check-meta.mjs (which re-runs this whole
#   test_arc4_wiring.py                 suite via check-pytest.mjs); both already self-skip under
#                                        CHECK_PYTEST_NESTED=1, which check-pytest.mjs sets on every
#                                        pytest invocation it makes — so under THIS gate they never
#                                        spawn the real subprocess at all. Pinned anyway because a
#                                        developer's plain `pytest tests/ -n auto` (no CHECK_PYTEST_
#                                        NESTED) would let them fire for real, and a lesson already
#                                        paid for the cost of that exact recursion (L87).
#   test_current_requires_mirror.py   — requires_database("mk_rules"), live mk_rules Postgres
#   test_build_rules_store_cli.py     — spawns the build-rules-store CLI, which opens mk_rules
#   test_rules_classify.py            — requires_database("mk_rules")
#   test_rules_builder.py             — requires_database("mk_rules")
#   test_classify_from_agreement.py   — requires_database("mk_rules")
#   test_rules_mechanism_columns.py   — requires_database("mk_rules")
#   test_rules_store_reader_cannot_write.py — requires_database("mk_rules")
#   test_arc2_phase4_rules.py         — one test opens a real socket (`socket.socket().bind(...)`,
#                                        port 0) and spawns a real Node TCP server child process
#
# NOT pinned, and why: the many other subprocess.run(["node", ...]) call sites elsewhere in this
# suite (git init in tmp_path, pretooluse.mjs/posttooluse.mjs, check-plan-complete.mjs, etc.) spawn
# a real process but touch NO shared resource — each runs against a pytest `tmp_path` unique to
# that test, or reads the checked-out repo tree read-only, so two workers running them at the same
# moment cannot observe or corrupt each other. test_rules_classified_gate.py and
# test_rule_provenance_gate.py read only their own tmp_path rules.sqlite mirror, never Postgres.
SERIALIZED_TEST_FILES = frozenset({
    "test_pg_schema.py",
    "test_pg_spec_coverage.py",
    "test_graph_schema.py",
    "test_acceptance.py",
    "test_acceptance_infra.py",
    "test_retrieval.py",
    "test_service_guard.py",
    "test_worker.py",
    "test_extract.py",
    "test_arc4_gate_coverage.py",
    "test_arc2_phase1_wiring.py",
    "test_arc4_wiring.py",
    "test_current_requires_mirror.py",
    "test_build_rules_store_cli.py",
    "test_rules_classify.py",
    "test_rules_builder.py",
    "test_classify_from_agreement.py",
    "test_rules_mechanism_columns.py",
    "test_rules_store_reader_cannot_write.py",
    "test_arc2_phase4_rules.py",
})


@pytest.hookimpl(tryfirst=True)
def pytest_collection_modifyitems(config, items):
    """Pin every item in SERIALIZED_TEST_FILES to one xdist worker (`--dist loadgroup` is required
    for this marker to take effect — the default `load` distribution ignores xdist_group). A no-op
    without xdist installed, and a no-op without `-n`/`--dist loadgroup` on the command line too:
    the marker is simply unused, exactly like any other pytest.mark.* nobody reads.

    ACTIVE as of R-154(b) (2026-08-11): scripts/check-pytest.mjs now invokes
    `-n 8 --dist loadgroup`, so this marker takes effect on every gate run. `-n auto` (32 workers on
    this dev machine) produced a real CPU-contention flake in a wall-clock timing test; R-154(b)
    capped the worker count at 8 instead — the fix changed the worker count, not this pinning, and
    not the flaking test's own tripwire (see check-pytest.mjs's own comment and the R-154(b) report).

    `tryfirst=True` is not decoration, it is load-bearing: xdist's own worker-side
    `pytest_collection_modifyitems` (xdist/remote.py) reads each item's `xdist_group` marker and
    appends `@group_name` to its nodeid — that suffix, not the marker object itself, is what the
    controller's `LoadGroupScheduling._split_scope` groups items by. Discovered empirically here:
    without `tryfirst`, pytest's default (unspecified, effectively LIFO-by-registration) hook order
    ran xdist's marker-reading hook BEFORE this one added the marker, so every item in
    SERIALIZED_TEST_FILES scattered across all `-n 8` workers exactly as if unpinned — confirmed
    with `-v` showing test_acceptance.py items on gw0 through gw7 simultaneously, producing real
    ForeignKeyViolation errors and WorkerBusy exceptions against the live Postgres advisory lock.
    `tryfirst=True` guarantees this hook runs before xdist's (which registers without it), so the
    marker exists by the time xdist inspects items — verified after the fix: an 8-file grep of a
    `-v` run's `[gwN]` lines shows every SERIALIZED_TEST_FILES item on the SAME worker.
    """
    for item in items:
        if item.fspath.basename in SERIALIZED_TEST_FILES:
            item.add_marker(pytest.mark.xdist_group(name="db-and-gates"))


def _corpus_transcripts_dir():
    """The directory the two corpus-replay test modules (test_arc2_phase3_rules.py,
    test_arc2_phase4_rules.py) and their measure-*-corpus.py extractors all read: local Claude Code
    session transcript history for this project. Reads the SAME MK_CORPUS_TRANSCRIPTS_DIR override
    those two scripts read, so a test can point both the probe and the extractor at one directory —
    needed to witness the present-but-empty-directory FAIL path for real, and so this function
    re-reads a test's monkeypatched env var rather than freezing it at import time. The default
    path is kept textually identical to the TRANSCRIPTS constant in
    scripts/tests/measure-bash-corpus.py and scripts/tests/measure-stop-corpus.py (same duplication
    tradeoff as UNAVAILABLE_MARKERS below — importing a test-support script from conftest is the
    worse hazard).
    """
    return pathlib.Path(os.environ.get(
        "MK_CORPUS_TRANSCRIPTS_DIR",
        str(pathlib.Path.home() / ".claude" / "projects" / "C--Users-dudib-source-repos-matconetesh")))


CORPUS_TRANSCRIPTS_DIR = _corpus_transcripts_dir()  # the default, for callers that just want the path

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


def skip_without_transcripts():
    """Skip -- do not fail -- when there is no session-transcript directory on this runner at all.

    R-147(a) (2026-08-11): CI is a Linux runner that has never had a transcript directory and never
    will (it is local session history on the dev machine, gitignored). 16 corpus-replay tests in
    test_arc2_phase3_rules.py and test_arc2_phase4_rules.py were failing there with
    `corpus dump is EMPTY` / `corpus: 0 assistant final messages` — an absent-input condition
    reported as a defect.

    The probe is deliberately the directory's EXISTENCE (`.is_dir()`), never the emptiness of what
    the measure-*-corpus.py scripts extract from it. Emptiness is the L57 trap: an ABSENT corpus
    and a PRESENT-but-BROKEN extractor produce the exact same empty-dump symptom, and only the
    directory's existence tells them apart. If the directory exists and the extractor still returns
    nothing, that is a real defect in the extractor and this helper must NOT be called after the
    fact to excuse it — callers call this once, before invoking the extractor, and let a
    present-but-broken extractor fail exactly as it did before this task (pinned by
    test_corpus_dump_fails_when_directory_exists_but_extractor_finds_nothing in both
    test_arc2_phase3_rules.py and test_arc2_phase4_rules.py).
    """
    directory = _corpus_transcripts_dir()
    if not directory.is_dir():
        pytest.skip(
            f"no session-transcript directory on this runner ({directory}) — "
            "NOT VERIFIED here: every corpus-replay assertion in this module (measured false-alarm "
            "rates, true-positive catches on real historical commands/messages, and degraded-path "
            "behavior) against real Claude Code session history — that corpus is local-machine-only "
            "and is never present in CI."
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
