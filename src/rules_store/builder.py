"""Syncs an extracted RuleRecord into mk_rules and its mirror, in the four-step order the spec
mandates (§4.5):

    1. write to Postgres as is_current=false
    2. write the mirror
    3. mark mirrored_at
    4. flip is_current=true

A crash between steps 2 and 4 leaves the Postgres row exactly where step 1 left it: is_current=
false. The row is inert, never half-active, and current_requires_mirror (0001 migration) makes the
illegal state unreachable even if this ordering were violated by a bug.
"""
from __future__ import annotations

from src.rules_store import mirror as mirror_mod
from src.rules_store.extractor import RuleRecord


class SimulatedCrash(RuntimeError):
    """Raised only when a test asks for it — see sync_rule's _fail_after_mirror_write parameter.
    Never raised in a real run; it exists so Task 8's test can inject the fault deterministically
    rather than trying to time a real crash, which no test can do reliably."""


def sync_rule(pg_conn, mirror_conn, record: RuleRecord, *, _fail_after_mirror_write: bool = False) -> str:
    with pg_conn.cursor() as cur:
        # Step 1 — Postgres, is_current=false.
        cur.execute(
            """
            INSERT INTO rule_revisions
                (rule_id, section, title_he, statement, source_path, source_heading, source_hash,
                 revision_status, is_current)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'current', false)
            RETURNING revision_id
            """,
            (record.rule_id, record.section, record.title_he, record.statement,
             "docs/process/development-discipline.md", record.source_heading, record.content_hash),
        )
        revision_id = cur.fetchone()[0]
    pg_conn.commit()

    # Step 2 — the mirror.
    mirror_mod.write_revision(mirror_conn, {
        "rule_id": record.rule_id, "section": record.section, "title_he": record.title_he,
        "statement": record.statement, "bucket": getattr(record, "bucket", None), "severity": None,
        "mechanism": None, "source_path": "docs/process/development-discipline.md",
        "source_heading": record.source_heading, "source_hash": record.content_hash,
        "revision_status": "current",
    })

    if _fail_after_mirror_write:
        raise SimulatedCrash("fault injected between mirror write and flip-to-current")

    with pg_conn.cursor() as cur:
        # Step 3 — mark mirrored_at.
        cur.execute("UPDATE rule_revisions SET mirrored_at = now() WHERE revision_id = %s", (revision_id,))
        # Step 4 — flip is_current. Both in the SAME transaction as step 3: the constraint requires
        # mirrored_at to be set BEFORE is_current can be true, and doing them as one commit means
        # there is never a moment where a committed row has is_current=true and mirrored_at=NULL —
        # the exact state the CHECK constraint would refuse anyway, proven twice.
        cur.execute("UPDATE rule_revisions SET is_current = true WHERE revision_id = %s", (revision_id,))
    pg_conn.commit()
    return str(revision_id)
