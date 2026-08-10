# tests/test_rule_provenance_gate.py — the enforcement corpus has exactly one source.
#
# Owner question, 2026-08-10: seeing "botulism" in a measurement sample, he asked whether rules from
# the app's CONTENT world (food, safety values, recipes) had leaked into the process/infrastructure
# rule corpus, and how to find and remove them.
#
# Measured answer: none had. All 159 rules in the mirror come from `docs/process/development-discipline.md`
# and nothing else. Eight of them MENTION a food term, every one as the EXAMPLE of a process failure
# — L24 is "never cap AI output tokens low" and the smoker device-lookup is the evidence, not the
# subject. Removing those examples would leave rules nobody can remember the reason for.
#
# So there was nothing to remove — but the boundary held by accident, not by construction. This gate
# makes it hold on purpose. It is the same class of instrument as R-118/L81a/L81b, which established
# that an enforcement gate scans code and process and never content.
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GATE = ROOT / "scripts" / "check-rule-provenance.mjs"


def run_gate(*args, mirror=None):
    argv = ["node", str(GATE)]
    if mirror is not None:
        argv += ["--mirror", str(mirror)]
    argv += list(args)
    return subprocess.run(argv, capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))


def make_mirror(path, rows):
    """Builds a throwaway mirror with the real column names, through sqlite itself."""
    import sqlite3
    con = sqlite3.connect(str(path))
    con.execute("CREATE TABLE rule_revisions (rule_id TEXT, source_path TEXT, revision_status TEXT)")
    con.executemany("INSERT INTO rule_revisions VALUES (?,?,?)", rows)
    con.commit()
    con.close()


def test_the_real_corpus_passes():
    """The measured state on 2026-08-10: 159 of 159 rules from the process document."""
    r = run_gate()
    assert r.returncode == 0, r.stdout + r.stderr
    assert "development-discipline.md" in r.stdout


def test_a_rule_sourced_from_the_content_plane_is_blocked(tmp_path):
    """The exact thing the owner asked about: a rule extracted from the app's data/content files."""
    m = tmp_path / "mirror.sqlite"
    make_mirror(m, [
        ("L1", "docs/process/development-discipline.md", "current"),
        ("FOOD-1", "data.py", "current"),
    ])
    r = run_gate(mirror=m)
    assert r.returncode == 1, r.stdout
    assert "FOOD-1" in r.stdout and "data.py" in r.stdout


def test_a_rule_sourced_from_a_cited_primary_source_is_blocked(tmp_path):
    m = tmp_path / "mirror.sqlite"
    make_mirror(m, [("SRC-1", "docs/sources/baldwin-backbone.md", "current")])
    r = run_gate(mirror=m)
    assert r.returncode == 1 and "baldwin-backbone" in r.stdout, r.stdout


def test_a_second_process_document_is_blocked_too(tmp_path):
    """Not only content: ANY second source. Two documents defining rules means the answer to
    'what are the rules' depends on which file you opened, and the mirror stops being one corpus."""
    m = tmp_path / "mirror.sqlite"
    make_mirror(m, [("X-1", "docs/process/some-other-doc.md", "current")])
    r = run_gate(mirror=m)
    assert r.returncode == 1 and "some-other-doc" in r.stdout, r.stdout


def test_the_gate_fails_open_when_it_cannot_read_the_mirror(tmp_path):
    """Fail-open in both directions, like every gate here: 'could not decide' is never 'you may not
    commit'. A gate that blocks on its own inability names no reachable alternative (§10.24)."""
    r = run_gate(mirror=tmp_path / "no-such-file.sqlite")
    assert r.returncode == 0, r.stdout
    assert "could not decide" in r.stdout.lower()


def test_the_gate_names_the_owner_decision_needed_rather_than_just_refusing(tmp_path):
    """A block must name a reachable alternative. Adding a source is an owner decision, and the
    message has to say so — otherwise the next agent's cheapest move is to widen the allow-list."""
    m = tmp_path / "mirror.sqlite"
    make_mirror(m, [("FOOD-2", "sources.py", "current")])
    r = run_gate(mirror=m)
    assert r.returncode == 1
    out = r.stdout.lower()
    assert "owner" in out, r.stdout


def test_the_instrument_actually_looks_at_rows(tmp_path):
    """Prove the gate is not vacuously green on an EMPTY corpus. Seven times in two days a probe in
    this programme reported 'nothing found' because it was broken, not because nothing was there —
    a gate that passes an empty table would be the same failure wearing a green tick."""
    m = tmp_path / "mirror.sqlite"
    make_mirror(m, [])
    r = run_gate(mirror=m)
    assert r.returncode == 0, r.stdout
    assert "0 rule" in r.stdout or "no rule" in r.stdout.lower(), (
        "an empty corpus must say so out loud, not report a silent pass:\n" + r.stdout)
