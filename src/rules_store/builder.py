"""Syncs an extracted RuleRecord into mk_rules and its mirror, in the four-step order the spec
mandates (§4.5):

    1. write to Postgres as is_current=false
    2. write the mirror
    3. mark mirrored_at
    4. flip is_current=true

Every crash window in that order is accounted for, not just the one this file's test exercises:

  - BEFORE step 1 (nothing committed yet): no state change at all — there is nothing to clean up
    or recover, the caller simply retries.
  - BETWEEN step 1's commit and step 2 (mirror write not yet attempted): the only committed state
    is the fresh is_current=false row from step 1. Same shape as the step-2-to-3/4 window below —
    inert, recoverable the same way.
  - BETWEEN step 2 (mirror write, committed) and steps 3/4 (not yet run) — this is the window
    `_fail_after_mirror_write` simulates: the Postgres row is stuck at is_current=false,
    revision_status='current' even though the mirror already has the data. The row is INACTIVE
    (never read as current by anything), so it does not wedge the system — a later call to this
    function for the same rule_id inserts a fresh revision and activates it cleanly, because
    step 0 below (added in Fix round 1) actively cleans up exactly this shape of orphan before
    inserting. Without step 0 the orphan would still be harmless to correctness but would sit
    forever with a self-contradictory label (revision_status='current' says active,
    is_current=false says not) — recoverable is not the same claim as leaves-no-garbage, and this
    module now makes both true.
  - BETWEEN steps 3 and 4: not actually a reachable crash window, because both statements run
    inside the SAME transaction (one `with pg_conn.cursor()` block, one `commit()`). A crash there
    rolls both back — the row is left exactly as step 1/2 left it (is_current=false, mirrored_at
    NULL), the identical inert shape as the window above. Transactional atomicity is the actual
    defence here; the `current_requires_mirror` CHECK constraint (0001 migration) is the backstop
    that would refuse the half-applied state even if this ordering were violated by a bug, but it
    is never the ONLY thing standing between here and that state.

A caller catching an exception from this function (including SimulatedCrash) must NOT roll back or
delete the step-1 insert if it already committed — an inactive, uncleaned row is the intended
outcome of a real crash mid-sync, not an error condition to reverse. The unconditional retry (call
this function again for the same rule_id) is the recovery path, not a rollback.
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
        # Step 0 (Fix round 1) — clean up any orphan left by a previous crashed sync of this same
        # rule_id: a row stuck at is_current=false with revision_status still 'current' (the
        # step-2-to-3/4 crash window above) is a self-contradictory label — 'current' says active,
        # is_current says not. It cannot be confused with a live current row (is_current=false
        # excludes that) and it cannot be confused with an already-superseded/retired row (this
        # UPDATE only touches revision_status='current' rows), so re-labelling it 'superseded' here
        # is safe and makes the label agree with the boolean before this sync proceeds. Task 9's
        # own supersede path only ever touches is_current=true rows, so it never sees or handles
        # this shape — this step is what actually closes it, kept local to sync_rule because every
        # caller of sync_rule (Task 9's sync_document included) goes through this exact insert path.
        cur.execute(
            "UPDATE rule_revisions SET revision_status = 'superseded' "
            "WHERE rule_id = %s AND is_current = false AND revision_status = 'current'",
            (record.rule_id,),
        )
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
