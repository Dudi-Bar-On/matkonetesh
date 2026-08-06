# tests/test_build_rules_store_cli.py
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_cli_reports_lifecycle_counts():
    with tempfile.TemporaryDirectory() as d:
        doc = Path(d) / "fixture.md"
        doc.write_text("### 10.97 CLI test rule\n\nfrom the CLI.\n", encoding="utf-8")
        mirror_path = Path(d) / "rules.sqlite"
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_rules_store.py"),
             "--doc", str(doc), "--mirror-path", str(mirror_path)],
            capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert "added: 1" in r.stdout or "added:1" in r.stdout.replace(" ", ""), r.stdout
        assert mirror_path.exists(), "rebuild must create the mirror file"

        # cleanup: retire the test rule so it doesn't linger as a permanent fixture row
        sys.path.insert(0, str(ROOT))
        from src.rules_store import config
        pg = config.connect_writer(); pg.autocommit = True
        with pg.cursor() as cur:
            cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", ("10.97",))
        pg.close()


def test_rebuild_mirror_only_does_not_write_to_postgres():
    """DoD requirement: --rebuild-mirror-only must not write to Postgres at all. Proven, not
    asserted-by-claim: seed one real current row in mk_rules directly via sync_document, snapshot
    its exact row (revision_id, mirrored_at, everything) plus the table's total row count, run the
    CLI with --rebuild-mirror-only against a FRESH mirror path, then show the mirror now holds the
    seeded rule (proving it actually read Postgres) while the Postgres snapshot is byte-for-byte
    unchanged (proving it never wrote back)."""
    sys.path.insert(0, str(ROOT))
    from src.rules_store import builder, config, mirror as mirror_mod

    rule_id = "10.97"
    seed_source_path = "test-rebuild-mirror-only.md"

    pg = config.connect_writer()
    pg.autocommit = False
    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg.commit()

    with tempfile.TemporaryDirectory() as d:
        seed_mirror = mirror_mod.open_mirror(Path(d) / "seed.sqlite")
        doc = f"### {rule_id} Rebuild-only seed rule\n\nseeded for rebuild-mirror-only.\n"
        result = builder.sync_document(pg, seed_mirror, doc, seed_source_path)
        assert result["added"] == [rule_id], result
        seed_mirror.close()

        with pg.cursor() as cur:
            cur.execute("SELECT count(*) FROM rule_revisions")
            (count_before,) = cur.fetchone()
            cur.execute(
                "SELECT revision_id, rule_id, statement, revision_status, is_current, "
                "mirrored_at, source_path, source_hash FROM rule_revisions WHERE rule_id = %s",
                (rule_id,),
            )
            row_before = cur.fetchone()
        assert row_before is not None

        rebuild_mirror_path = Path(d) / "rebuilt.sqlite"
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_rules_store.py"),
             "--rebuild-mirror-only", "--mirror-path", str(rebuild_mirror_path)],
            capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert rebuild_mirror_path.exists()

        rebuilt = mirror_mod.open_mirror(rebuild_mirror_path)
        rebuilt_rows = [row for row in mirror_mod.read_current(rebuilt) if row["rule_id"] == rule_id]
        assert len(rebuilt_rows) == 1, "the rebuilt mirror must contain the seeded rule from Postgres"
        rebuilt.close()

        with pg.cursor() as cur:
            cur.execute("SELECT count(*) FROM rule_revisions")
            (count_after,) = cur.fetchone()
            cur.execute(
                "SELECT revision_id, rule_id, statement, revision_status, is_current, "
                "mirrored_at, source_path, source_hash FROM rule_revisions WHERE rule_id = %s",
                (rule_id,),
            )
            row_after = cur.fetchone()

        assert count_after == count_before, (
            f"--rebuild-mirror-only must not change Postgres row count: before={count_before} "
            f"after={count_after}"
        )
        assert row_after == row_before, (
            f"--rebuild-mirror-only must not touch the seeded row at all: before={row_before} "
            f"after={row_after}"
        )

    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg.commit()
    pg.close()


def test_cli_requires_doc_or_rebuild_flag():
    """Negative case (DoD-6): neither --doc nor --rebuild-mirror-only given -> argparse error,
    non-zero exit, and no mirror file is created — the CLI must refuse before touching anything.

    Fix round 1: asserting only `returncode != 0` and `not mirror_path.exists()` cannot
    distinguish "the script ran and correctly refused" from "the script does not exist at all" —
    both produce a non-zero exit and no mirror file (proven directly: this exact assertion set
    passed even with scripts/build_rules_store.py deleted, see task-11-report.md Fix round 1).
    Pinned to the CLI's own refusal message text so only a real, running refusal can pass."""
    with tempfile.TemporaryDirectory() as d:
        mirror_path = Path(d) / "should-not-exist.sqlite"
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_rules_store.py"),
             "--mirror-path", str(mirror_path)],
            capture_output=True, text=True,
        )
        assert r.returncode != 0, r.stdout + r.stderr
        assert "give --doc <path> or --rebuild-mirror-only" in r.stderr, (
            f"expected the CLI's own refusal message in stderr, got: {r.stderr!r}"
        )
        assert not mirror_path.exists(), "a refused invocation must not create the mirror file"


def test_source_path_is_stored_posix_never_backslash():
    """Fix round 1, IMPORTANT 2: str(Path(...)) renders with backslashes on Windows. If the CLI
    stored that raw form, the SAME document synced later from a POSIX path would be a different
    `source_path` string to sync_document's lookup — misclassifying a real update as a
    cross-document rule_id collision (ValueError, whole document refused). Pins that the CLI
    normalizes to POSIX (`.as_posix()`) before the value ever reaches Postgres."""
    sys.path.insert(0, str(ROOT))
    from src.rules_store import config

    rule_id = "10.97"
    pg = config.connect_writer(); pg.autocommit = True
    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))

    with tempfile.TemporaryDirectory() as d:
        sub = Path(d) / "nested"
        sub.mkdir()
        doc = sub / "fixture.md"
        doc.write_text("### 10.97 Posix path rule\n\nfrom the CLI.\n", encoding="utf-8")
        mirror_path = Path(d) / "rules.sqlite"
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_rules_store.py"),
             "--doc", str(doc), "--mirror-path", str(mirror_path)],
            capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr

        with pg.cursor() as cur:
            cur.execute(
                "SELECT source_path FROM rule_revisions WHERE rule_id = %s", (rule_id,)
            )
            (stored_source_path,) = cur.fetchone()
        assert "\\" not in stored_source_path, (
            f"source_path must be stored POSIX-normalized (no backslash), got: "
            f"{stored_source_path!r}"
        )

    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg.close()


if __name__ == "__main__":
    test_cli_reports_lifecycle_counts()
    test_rebuild_mirror_only_does_not_write_to_postgres()
    test_cli_requires_doc_or_rebuild_flag()
    test_source_path_is_stored_posix_never_backslash()
    print("PASS")
