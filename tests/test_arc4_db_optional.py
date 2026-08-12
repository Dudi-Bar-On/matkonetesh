# tests/test_arc4_db_optional.py — Arc 4 Task 11 (2026-08-11).
#
# CI run 31474916890: the discipline job went red with 23 failed and 16 errors, all of them
# `ConfigError` from tests that need PostgreSQL/Neo4j on a runner with no databases and no
# infra/.env. The GATES beside them skipped and declared the degradation:
#
#   === check-geniza-fresh ===
#   SKIPPED — the geniza is not reachable (start it: Start-Service postgresql-x64-18).
#     NOT VERIFIED here: whether the geniza matches the disk.
#
# A test that CRASHES where a gate SKIPS is L57 on the other side of the wall: an absence and a
# failure sharing one exit path. This file proves the fix at the only level that matters — a real
# `pytest tests/` run with no database configuration reachable, exactly as CI ran it.
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

# Kept textually identical to what load_config() reads from the environment in both
# src/knowledge/config.py and src/rules_store/config.py (POSTGRES_*, MK_*, NEO4J_*, RULES_*) —
# stripping anything under these prefixes plus the no_database_configured fixture below (which
# points load_config() at nonexistent files, R-156) reproduces a runner with neither credential
# source, which is what CI actually has. CONFIG_ENV_FILE_KNOWLEDGE / CONFIG_ENV_FILE_RULES
# (the fixture's own seam) deliberately do NOT start with any of these prefixes, so they survive
# this stripping and reach the child subprocess below.
DB_ENV_PREFIXES = ("POSTGRES", "MK_", "RULES_", "NEO4J")


@pytest.fixture
def no_database_configured(monkeypatch, tmp_path):
    """Construct 'no credentials configured' WITHOUT touching the real, live infra/.env or
    infra/rules-db/.env (R-156, 2026-08-12).

    A prior version of this fixture renamed those two files aside and relied on a `finally` to
    rename them back. `finally` cannot run if the process is killed mid-test — and it was: the
    files stayed renamed for 2h46m on 2026-08-11, leaving the geniza and mk_rules unreachable to
    every agent. `finally` is correct for every case it can see; a killed process is not one of
    them.

    Instead this points both config modules' load_config() at nonexistent files inside pytest's
    own tmp_path via CONFIG_ENV_FILE_KNOWLEDGE / CONFIG_ENV_FILE_RULES (the seam added in
    src/knowledge/config.py and src/rules_store/config.py for exactly this). The only state this
    fixture mutates is two environment variables in THIS process — never a file on disk — so if
    this process is killed mid-test, there is nothing to restore: the real credential files were
    never touched in the first place.
    """
    monkeypatch.setenv("CONFIG_ENV_FILE_KNOWLEDGE", str(tmp_path / "no-such-knowledge.env"))
    monkeypatch.setenv("CONFIG_ENV_FILE_RULES", str(tmp_path / "no-such-rules.env"))
    yield


def test_the_suite_does_not_error_when_no_database_is_configured(no_database_configured):
    """The whole point: with no infra/.env and none of the environment variables load_config()
    would otherwise read, the suite reports skips, never ConfigError.

    RECURSION GUARD, same shape as test_arc2_phase1_wiring.py's check_meta_run fixture: this
    spawns a full `pytest tests/` — which re-collects THIS file. Skip rather than recurse when
    already running nested (check-pytest.mjs sets CHECK_PYTEST_NESTED=1 on every invocation it
    makes), and pass the same var down to the child so it does not spawn a second generation of
    itself, or of test_arc2_phase1_wiring.py's own check-meta.mjs child, either.
    """
    if os.environ.get("CHECK_PYTEST_NESTED"):
        pytest.skip(
            "running inside check-pytest's own pytest invocation (CHECK_PYTEST_NESTED=1) — "
            "spawning a full `pytest tests/` here would recurse into this same test; the "
            "no-database question is still genuinely exercised at a top-level, non-nested "
            "`pytest tests/` run."
        )
    env = {k: v for k, v in os.environ.items() if not k.startswith(DB_ENV_PREFIXES)}
    env["CHECK_PYTEST_NESTED"] = "1"
    r = subprocess.run(
        [sys.executable, "-X", "utf8", "-m", "pytest", "tests/", "-q", "-p", "no:cacheprovider"],
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env, timeout=900,
    )
    assert "ConfigError" not in r.stdout, (
        "a database-backed test raised ConfigError instead of skipping:\n" + r.stdout[-3000:])
    lines = [ln for ln in r.stdout.strip().split("\n") if ln.strip()]
    assert lines, "the nested suite produced no output at all"
    assert " error" not in lines[-1].lower(), r.stdout[-1500:]


def test_a_skip_names_the_coverage_that_was_lost():
    """A silent skip is how 39 tests once passed without running anything (§11 lessons log). Each
    skip must say what it did not verify, in the same shape the gates already use
    ('NOT VERIFIED here: ...')."""
    text = (ROOT / "tests" / "conftest.py").read_text(encoding="utf-8")
    assert "requires_database" in text, "no single shared helper — the decision must live in one place"
    assert "NOT VERIFIED" in text or "not verified" in text, (
        "the skip reason must name the coverage lost, as the gates do")
