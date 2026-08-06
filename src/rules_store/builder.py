"""Syncs an extracted RuleRecord into mk_rules and its mirror, in the four-step order the spec
mandates (§4.5):

    1. write to Postgres as is_current=false
    2. write the mirror
    3. demote any other current revision of this rule_id, mark mirrored_at, and flip is_current=true
       — all in ONE transaction (Fix round 1, 2026-08-06 — see below)

Every crash window in that order is accounted for, not just the one this file's test exercises:

  - BEFORE step 1 (nothing committed yet): no state change at all — there is nothing to clean up
    or recover, the caller simply retries.
  - BETWEEN step 1's commit and step 2 (mirror write not yet attempted): the only committed state
    is the fresh is_current=false row from step 1. Same shape as the step-2-to-3 window below —
    inert, recoverable the same way.
  - BETWEEN step 2 (mirror write, committed) and step 3 (not yet run) — this is the window
    `_fail_after_mirror_write` simulates: the Postgres row is stuck at is_current=false,
    revision_status='current' even though the mirror already has the data. The row is INACTIVE
    (never read as current by anything), so it does not wedge the system — a later call to this
    function for the same rule_id inserts a fresh revision and activates it cleanly, because
    step 0 below (added in Fix round 1) actively cleans up exactly this shape of orphan before
    inserting. Without step 0 the orphan would still be harmless to correctness but would sit
    forever with a self-contradictory label (revision_status='current' says active,
    is_current=false says not) — recoverable is not the same claim as leaves-no-garbage, and this
    module now makes both true.
  - WITHIN step 3 (demote-old / mark-mirrored / flip-new): not a reachable crash window, because
    all three statements run inside the SAME transaction (one `with pg_conn.cursor()` block, one
    `commit()`). A crash there rolls all three back — the OLD current row (if any) is left exactly
    as it was BEFORE this call (still `is_current=true`), and the new row is left exactly as
    step 1/2 left it (is_current=false, mirrored_at NULL). There is therefore never a committed
    moment with zero current rows for a rule_id that had one, and never a committed moment with
    two — the swap is atomic, not two separate updates a crash could split.

A caller catching an exception from this function (including SimulatedCrash) must NOT roll back or
delete the step-1 insert if it already committed — an inactive, uncleaned row is the intended
outcome of a real crash mid-sync, not an error condition to reverse. The unconditional retry (call
this function again for the same rule_id) is the recovery path, not a rollback.

Fix round 1 (2026-08-06 — Critical, found by the controller against the live database): the
original shipped version of this file hardcoded `source_path` to the literal
`"docs/process/development-discipline.md"` in the INSERT, ignoring whatever `source_path` the
caller (sync_document) actually passed. sync_document's own "is this rule_id already current"
lookup filters `WHERE source_path = %s` on the REAL source_path — so any call with a source_path
other than that one literal (the controller's repro used `'probe90.md'`) could never find its own
prior row, misclassified a genuine UPDATE as an ADD, and called sync_rule a second time for a
rule_id that was already current — which the unique partial index `one_current_revision_per_rule`
correctly refused (`UniqueViolation`). `source_path` is now a real parameter, threaded through from
sync_document, defaulting to the old literal only so Task 8's own tests (which call `sync_rule`
directly, without a document, and never inspect `source_path`) keep working unchanged.

The demotion of a rule's previous current revision — previously a separate `_supersede()` call made
by sync_document BEFORE calling sync_rule, in its OWN transaction — is now done HERE, inside
sync_rule's own final transaction, atomically with the flip. Two reasons, not one:
  1. It closes the actual bug above: once source_path is correct, sync_document's classification
     is trustworthy again, but relying on sync_document to always demote-then-call is a second
     place the same invariant has to be kept correct by hand — sync_rule is the one function that
     is ALWAYS on the path to a row becoming current, so it is the one place a demotion guarantee
     cannot be bypassed by a future caller (Task 12's CLI, Task 21's watchman recovery) that calls
     sync_rule without going through sync_document's own bookkeeping.
  2. The coordinator's explicit requirement — demotion must happen in the SAME transaction as the
     flip — is only satisfiable here: the flip (step 4 in the old numbering) already lives inside
     sync_rule's final `with pg_conn.cursor(): ... commit()` block. A demotion call made by
     sync_document BEFORE sync_rule runs is necessarily a SEPARATE, already-committed transaction —
     exactly the "crash between demote and flip leaves zero current rows" gap the fix must remove.
     Moving demotion inside sync_rule's own final transaction is the only way to make "demote old +
     flip new" one atomic unit; keeping sync_rule "single-purpose" was the alternative and it loses
     specifically because it cannot satisfy this requirement no matter where the caller-side call is
     placed.
"""
from __future__ import annotations

from src.rules_store import mirror as mirror_mod
from src.rules_store.extractor import RuleRecord, extract_rules

DEFAULT_SOURCE_PATH = "docs/process/development-discipline.md"


class SimulatedCrash(RuntimeError):
    """Raised only when a test asks for it — see sync_rule's _fail_after_mirror_write parameter.
    Never raised in a real run; it exists so Task 8's test can inject the fault deterministically
    rather than trying to time a real crash, which no test can do reliably."""


def sync_rule(
    pg_conn, mirror_conn, record: RuleRecord, source_path: str = DEFAULT_SOURCE_PATH,
    *, _fail_after_mirror_write: bool = False,
) -> str:
    with pg_conn.cursor() as cur:
        # Step 0 (Fix round 1) — clean up any orphan left by a previous crashed sync of this same
        # rule_id: a row stuck at is_current=false with revision_status still 'current' (the
        # step-2-to-3 crash window above) is a self-contradictory label — 'current' says active,
        # is_current says not. It cannot be confused with a live current row (is_current=false
        # excludes that) and it cannot be confused with an already-superseded/retired row (this
        # UPDATE only touches revision_status='current' rows), so re-labelling it 'superseded' here
        # is safe and makes the label agree with the boolean before this sync proceeds.
        cur.execute(
            "UPDATE rule_revisions SET revision_status = 'superseded' "
            "WHERE rule_id = %s AND is_current = false AND revision_status = 'current'",
            (record.rule_id,),
        )
        # Step 1 — Postgres, is_current=false. source_path is the CALLER's real value (Fix round
        # 1) — never a hardcoded literal — so sync_document's own `WHERE source_path = %s` lookup
        # can trust what got written here.
        cur.execute(
            """
            INSERT INTO rule_revisions
                (rule_id, section, title_he, statement, source_path, source_heading, source_hash,
                 revision_status, is_current)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'current', false)
            RETURNING revision_id
            """,
            (record.rule_id, record.section, record.title_he, record.statement,
             source_path, record.source_heading, record.content_hash),
        )
        revision_id = cur.fetchone()[0]
    pg_conn.commit()

    # Step 2 — the mirror.
    mirror_mod.write_revision(mirror_conn, {
        "rule_id": record.rule_id, "section": record.section, "title_he": record.title_he,
        "statement": record.statement, "bucket": getattr(record, "bucket", None), "severity": None,
        "mechanism": None, "source_path": source_path,
        "source_heading": record.source_heading, "source_hash": record.content_hash,
        "revision_status": "current",
    })

    if _fail_after_mirror_write:
        raise SimulatedCrash("fault injected between mirror write and flip-to-current")

    with pg_conn.cursor() as cur:
        # Step 3a (Fix round 1) — demote any OTHER current revision of this same rule_id, in the
        # SAME transaction as the flip below. `revision_id != %s` excludes the row this call just
        # inserted, so this can never demote what it is about to activate. This is what makes
        # "old row current -> new row current" an atomic swap: a crash between this statement and
        # the flip below rolls BOTH back, leaving the OLD row still current — never zero current
        # rows for a rule_id that had one a moment before.
        cur.execute(
            "UPDATE rule_revisions SET is_current = false, revision_status = 'superseded' "
            "WHERE rule_id = %s AND is_current = true AND revision_id != %s",
            (record.rule_id, revision_id),
        )
        # Step 3b — mark mirrored_at.
        cur.execute("UPDATE rule_revisions SET mirrored_at = now() WHERE revision_id = %s", (revision_id,))
        # Step 4 — flip is_current. All three of steps 3a/3b/4 commit together: the constraint
        # requires mirrored_at to be set BEFORE is_current can be true, and doing them as one
        # commit means there is never a moment where a committed row has is_current=true and
        # mirrored_at=NULL, and never a moment with two (or zero, for a rule that had one) current
        # rows for the same rule_id.
        cur.execute("UPDATE rule_revisions SET is_current = true WHERE revision_id = %s", (revision_id,))
    pg_conn.commit()
    return str(revision_id)


def sync_document(pg_conn, mirror_conn, text: str, source_path: str) -> dict:
    """Syncs a WHOLE document's worth of rules against mk_rules + the mirror, in one pass — the
    lifecycle Task 8's per-rule sync_rule does not itself decide. Extracts every rule currently in
    `text` (extract_rules), compares each against the current revision already in Postgres for
    `source_path`, and classifies it into exactly one of four buckets:

      - added      — a rule_id with no current revision yet -> sync_rule inserts revision 1.
      - updated    — content_hash differs from the current revision's source_hash -> sync_rule
                      inserts a fresh revision and, ATOMICALLY with activating it (Fix round 1),
                      demotes the OLD revision to 'superseded' — never deleted, see below.
      - unchanged  — content_hash is identical -> skipped, nothing written. This is what keeps a
                      re-run over an untouched document a no-op rather than a churn generator.
      - retired    — a rule_id that WAS current for this source_path but is no longer present in
                      `text` at all -> marked 'retired' with retired_at set, is_current flipped
                      false, and removed from the mirror (which holds current rules only). The row
                      itself is NEVER deleted from Postgres: this project is named for a geniza —
                      texts are kept, not destroyed — specifically so a retired rule stays
                      queryable ("§X was retired on <date>") instead of a hook meeting a dangling
                      reference and either failing silently or still enforcing something the
                      document no longer states.

    Returns {"added": [...], "updated": [...], "unchanged": [...], "retired": [...]}, each a list
    of rule_id — the exact shape Task 12's CLI and Task 21's watchman recovery path both consume.

    Fix round 1 (2026-08-06): `source_path` is now threaded through to every `sync_rule` call
    below, and the demotion of a rule's previous current revision moved INTO sync_rule's own final
    transaction (no more `_supersede()` call made here, separately, before sync_rule runs) — see
    builder.py's module docstring for why both changes were required together, not either alone.
    """
    records = {r.rule_id: r for r in extract_rules(text, source_path)}

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT rule_id, source_hash FROM rule_revisions WHERE is_current AND source_path = %s",
            (source_path,),
        )
        existing = dict(cur.fetchall())

    result = {"added": [], "updated": [], "unchanged": [], "retired": []}

    for rule_id, record in records.items():
        if rule_id not in existing:
            sync_rule(pg_conn, mirror_conn, record, source_path)
            result["added"].append(rule_id)
        elif existing[rule_id] != record.content_hash:
            sync_rule(pg_conn, mirror_conn, record, source_path)
            result["updated"].append(rule_id)
        else:
            result["unchanged"].append(rule_id)

    for rule_id in set(existing) - set(records):
        _retire(pg_conn, mirror_conn, rule_id)
        result["retired"].append(rule_id)

    return result


def _retire(pg_conn, mirror_conn, rule_id: str) -> None:
    """Marks the current revision of `rule_id` 'retired' with retired_at set (never deleted — the
    geniza guarantee), then removes it from the mirror, which holds current rules only. The
    Postgres row stays queryable by rule_id afterwards, same as any superseded revision."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "UPDATE rule_revisions SET is_current = false, revision_status = 'retired', retired_at = now() "
            "WHERE rule_id = %s AND is_current",
            (rule_id,),
        )
    pg_conn.commit()
    mirror_mod.delete_revision(mirror_conn, rule_id)
