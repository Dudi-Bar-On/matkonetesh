"""classify.apply_batch: the spec's governance rules as code, not prose. Validation tests are
pure-Python; apply tests hit live mk_rules with TEST- ids, same skip discipline as
tests/test_rules_builder.py."""
from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path
import pytest

classify = pytest.importorskip("src.rules_store.classify")

def _batch(**over):
    base = {"batch": 99, "approved_by_owner": "2026-08-08",
            "entries": [{"rule_id": "TEST-C1", "rule_group": "A",
                         "mechanism": "pretooluse:Bash", "mechanism_target": "git commit",
                         "reason": "r", "cost": None, "importance": None}]}
    base.update(over); return base

CURRENT = {"TEST-C1": None}

def test_unapproved_batch_is_refused():
    errs = classify.validate_batch(_batch(approved_by_owner=None), CURRENT)
    assert any("approved_by_owner" in e for e in errs)

def test_oversized_batch_is_refused():
    e = _batch()["entries"][0]
    entries = [{**e, "rule_id": f"TEST-C{i}"} for i in range(11)]
    errs = classify.validate_batch(_batch(entries=entries),
                                   {f"TEST-C{i}": None for i in range(11)})
    assert any("10" in err for err in errs), "an 11-entry batch must be a said error"

def test_unknown_mechanism_is_a_said_error():
    b = _batch(); b["entries"][0]["mechanism"] = "banana"
    errs = classify.validate_batch(b, CURRENT)
    assert any("banana" in e and "TEST-C1" in e for e in errs)

def test_demotion_without_cost_and_importance_is_refused():
    b = _batch(); b["entries"][0].update(rule_group="none", mechanism="none",
                                         mechanism_target=None)
    errs = classify.validate_batch(b, CURRENT)
    assert any("cost" in e or "importance" in e for e in errs)

def test_demotion_with_cost_and_importance_passes_validation():  # counter-RED
    b = _batch(); b["entries"][0].update(rule_group="none", mechanism="none",
        mechanism_target=None, cost="hours of hook work", importance="low — advisory prose")
    assert classify.validate_batch(b, CURRENT) == []

def test_exactly_ten_entries_is_accepted():  # boundary counter-RED
    e = _batch()["entries"][0]
    entries = [{**e, "rule_id": f"TEST-C{i}"} for i in range(10)]
    assert classify.validate_batch(_batch(entries=entries),
                                   {f"TEST-C{i}": None for i in range(10)}) == []

def test_unknown_rule_id_is_refused():
    errs = classify.validate_batch(_batch(), {})  # store knows no TEST-C1
    assert any("TEST-C1" in e for e in errs)


# --- live apply_batch test -------------------------------------------------------------------

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed")
config = pytest.importorskip("src.rules_store.config")
mirror = pytest.importorskip("src.rules_store.mirror")
builder = pytest.importorskip("src.rules_store.builder")
extractor = pytest.importorskip("src.rules_store.extractor")

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"


def _writer_conn():
    if not ENV_FILE.exists():
        pytest.skip("infra/rules-db/.env not present — the rules store has not been configured here")
    try:
        return config.connect_writer()
    except psycopg2.OperationalError as exc:
        pytest.skip(f"mk_rules is not reachable ({str(exc).strip()[:80]})")


def _clean(pg_conn, rule_id: str) -> None:
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg_conn.commit()


def test_apply_batch_writes_pg_and_mirror(tmp_path):
    pg = _writer_conn()
    mirror_conn = mirror.open_mirror(tmp_path / "test_mirror.sqlite")
    try:
        _clean(pg, "TEST-C1")
        record = extractor.RuleRecord(
            rule_id="TEST-C1", section=None, title_he="test", statement="test statement",
            source_heading="Test", content_hash="h1",
        )
        builder.sync_rule(pg, mirror_conn, record, source_path="test://classify")

        batch = {"batch": 99, "approved_by_owner": "2026-08-08",
                  "entries": [{"rule_id": "TEST-C1", "rule_group": "A",
                               "mechanism": "pretooluse:Bash", "mechanism_target": "git commit",
                               "reason": "r", "cost": None, "importance": None}]}
        result = classify.apply_batch(pg, mirror_conn, batch)
        assert result["applied"] == ["TEST-C1"]
        assert result["regrouped"] == []

        with pg.cursor() as cur:
            cur.execute(
                "SELECT rule_group, mechanism, mechanism_target FROM rule_revisions "
                "WHERE rule_id = %s AND is_current", ("TEST-C1",),
            )
            row = cur.fetchone()
        assert row == ("A", "pretooluse:Bash", "git commit")

        mirror_rows = {r["rule_id"]: r for r in mirror.read_current(mirror_conn)}
        m = mirror_rows["TEST-C1"]
        assert (m["rule_group"], m["mechanism"], m["mechanism_target"]) == ("A", "pretooluse:Bash", "git commit")
    finally:
        _clean(pg, "TEST-C1")
        mirror_conn.close()
        pg.close()


# --- CLI-as-subprocess test: the encoding bug in-process unit tests cannot see -----------------
#
# Review finding (Fix round 1): pytest's own capsys/capfd captures stdout in-process, in UTF-8,
# regardless of the OS console code page — so no in-process test, however thorough, can ever
# witness scripts/classify_rules.py crash the way a real person running it on Windows did: a
# UnicodeEncodeError from cp1252 mid-print, when stdout is not a console (a pipe, a redirect, a
# captured subprocess — exactly how this CLI is actually invoked by a script or a controller).
# This test runs the CLI as a REAL subprocess with output captured as raw bytes (not `text=True`,
# which would let Python's own default-encoding guesswork paper over the exact bug), and with
# PYTHONIOENCODING/PYTHONUTF8 explicitly stripped from the child's environment so no ambient
# override can hide a regression — the module's own `sys.stdout.reconfigure` must be the thing
# that fixes it. This is the L69 lesson: a test that never runs the real entry point cannot see
# whether the real entry point works.

ROOT = Path(__file__).resolve().parent.parent


def test_cli_demotion_refusal_prints_hebrew_intact_through_a_pipe(tmp_path):
    """Reproduces the reviewer's exact repro: a batch demoting a real current rule ('9') to
    'none' with no cost/importance. The demotion refusal is the only one of the three whose text
    quotes Hebrew (the owner's binding caveat) verbatim — that quote must arrive on stdout intact,
    not a traceback in its place."""
    batch_file = tmp_path / "batch-demotion-repro.md"
    batch_file.write_text(
        "```json\n"
        '{"batch": 1, "approved_by_owner": "2026-08-08", "entries": '
        '[{"rule_id": "9", "rule_group": "none", "mechanism": "none", '
        '"mechanism_target": null, "reason": "r", "cost": null, "importance": null}]}\n'
        "```\n",
        encoding="utf-8",
    )
    env = os.environ.copy()
    env.pop("PYTHONIOENCODING", None)
    env.pop("PYTHONUTF8", None)

    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "classify_rules.py"), str(batch_file)],
        cwd=ROOT, env=env, capture_output=True,
    )

    stderr_text = result.stderr.decode("utf-8", errors="replace")
    assert "Traceback" not in stderr_text, (
        f"the CLI crashed instead of printing the refusal (exit {result.returncode}):\n{stderr_text}"
    )
    assert result.returncode == 1, stderr_text

    stdout_text = result.stdout.decode("utf-8")  # must decode cleanly as UTF-8, not mangled bytes
    assert "cost" in stdout_text and "importance" in stdout_text
    assert "אם הוא חשוב אז גם אכיפה יקרה יכולה להיות שווה" in stdout_text


def test_cli_oversized_and_unapproved_refusals_are_pure_ascii_and_survive_a_pipe(tmp_path):
    """The other two structural refusals happen to be pure ASCII today — this pins that down as a
    tested fact, not a lucky accident, by running them through the SAME cp1252-pipe subprocess
    path as the Hebrew case above."""
    entries = ",".join(
        '{"rule_id": "TEST-C%d", "rule_group": "A", "mechanism": "pretooluse:Bash", '
        '"mechanism_target": "git commit", "reason": "r", "cost": null, "importance": null}' % i
        for i in range(11)
    )
    batch_file = tmp_path / "batch-oversized.md"
    batch_file.write_text(
        f'```json\n{{"batch": 1, "approved_by_owner": null, "entries": [{entries}]}}\n```\n',
        encoding="utf-8",
    )
    env = os.environ.copy()
    env.pop("PYTHONIOENCODING", None)
    env.pop("PYTHONUTF8", None)

    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "classify_rules.py"), str(batch_file)],
        cwd=ROOT, env=env, capture_output=True,
    )

    stderr_text = result.stderr.decode("utf-8", errors="replace")
    assert "Traceback" not in stderr_text, (
        f"the CLI crashed instead of printing the refusal (exit {result.returncode}):\n{stderr_text}"
    )
    assert result.returncode == 1, stderr_text
    stdout_text = result.stdout.decode("utf-8")
    assert "approved_by_owner" in stdout_text
    assert "10" in stdout_text
