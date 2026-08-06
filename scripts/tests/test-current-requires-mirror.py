# scripts/tests/test-current-requires-mirror.py
"""Hard requirement (plan header): prove `current_requires_mirror` by attempting the illegal insert
and catching the violation. RED first: run this BEFORE the constraint exists (i.e. before Step 5/6
above) and it fails because the insert SUCCEEDS. GREEN: run it after, and the insert is refused."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import config  # noqa: E402


def test_current_true_without_mirrored_at_is_rejected():
    import psycopg2

    conn = config.connect_writer()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rule_revisions
                    (rule_id, statement, source_path, source_hash, revision_status, is_current, mirrored_at)
                VALUES
                    ('TEST-ILLEGAL', 'illegal row', 'test.md', 'deadbeef', 'current', true, NULL)
                """
            )
        conn.commit()
        assert False, "expected IntegrityError: current_requires_mirror, insert succeeded instead"
    except psycopg2.errors.CheckViolation as exc:
        assert "current_requires_mirror" in str(exc), f"wrong constraint fired: {exc}"
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    test_current_true_without_mirrored_at_is_rejected()
    print("PASS: current_requires_mirror rejects is_current without mirrored_at.")
