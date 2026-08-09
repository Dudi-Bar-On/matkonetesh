"""check-rules-classified — a rule may not enter the corpus without a group.

WHY THIS GATE EXISTS (owner decision, 2026-08-09). Five rules — L75..L79 — sat in the store with
`rule_group IS NULL`, and four of them were written on the same night we classified 95 rules. The
corpus grows while a classification arc runs, and nothing assigned a group at the moment a lesson was
logged. Classifying those five closes the five; this gate closes the hole that produced them.

It reads the MIRROR (rules.sqlite, committed to git) rather than Postgres on purpose: the gate must
work on a machine with no database, and the mirror is what the enforcement hooks read anyway.
"""
from __future__ import annotations
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GATE = ROOT / "scripts" / "check-rules-classified.mjs"


def _mirror(tmp_path, rows):
    db = tmp_path / "rules.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE rule_revisions (rule_id TEXT, title_he TEXT, statement TEXT, "
                 "rule_group TEXT, mechanism TEXT, mechanism_target TEXT)")
    conn.executemany("INSERT INTO rule_revisions VALUES (?,?,?,?,?,?)", rows)
    conn.commit()
    conn.close()
    return db


def _run(mirror):
    return subprocess.run(
        ["node", str(GATE), "--mirror", str(mirror)],
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))


def test_gate_blocks_and_names_every_rule_carrying_no_group(tmp_path):
    db = _mirror(tmp_path, [
        ("10.1", "כותרת", "טקסט", "A", "commit-gate", "git commit"),
        ("L75", "לקח חדש", "טקסט", None, None, None),
        ("L79", "לקח נוסף", "טקסט", None, None, None),
    ])
    r = _run(db)
    assert r.returncode != 0, f"a corpus with two ungrouped rules must block\n{r.stdout}{r.stderr}"
    # Naming them is the whole point: a gate that says "something is unclassified" sends the reader
    # hunting, and the hunt is what made these five sit unnoticed for a day.
    assert "L75" in r.stdout and "L79" in r.stdout, r.stdout
    assert "10.1" not in r.stdout, "a classified rule must not be reported as a problem"


def test_gate_passes_when_every_rule_carries_a_group(tmp_path):
    db = _mirror(tmp_path, [
        ("10.1", "כותרת", "טקסט", "A", "commit-gate", "git commit"),
        ("L67", "לקח", "טקסט", "none", None, None),
    ])
    r = _run(db)
    assert r.returncode == 0, f"a fully classified corpus must pass\n{r.stdout}{r.stderr}"


def test_gate_treats_an_empty_string_group_as_missing(tmp_path):
    """An empty string is not a classification. Left unhandled it is the obvious way to satisfy the
    gate without answering the question, which is exactly what the gate exists to prevent."""
    db = _mirror(tmp_path, [("L80", "לקח", "טקסט", "   ", None, None)])
    r = _run(db)
    assert r.returncode != 0, r.stdout + r.stderr
    assert "L80" in r.stdout, r.stdout


def test_gate_does_not_invent_a_verdict_when_the_mirror_is_unreadable(tmp_path):
    """Fail-open discipline: the gate reports that it could not decide, and does not block. A gate
    that blocks on its own inability to read is a gate that stops work for a reason nobody can act on
    (§10.24 — a block must name a reachable alternative)."""
    db = tmp_path / "rules.sqlite"
    db.write_bytes(b"not a database at all")
    r = _run(db)
    assert r.returncode == 0, f"an unreadable mirror must not block\n{r.stdout}{r.stderr}"
    assert "could not" in r.stdout.lower() or "לא" in r.stdout, r.stdout
