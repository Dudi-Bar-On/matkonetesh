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
sync_document.

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

Fix round 2 (2026-08-06 — review findings against Fix round 1):

  FINDING 1 — `_retire`'s two writes (Postgres commit, then mirror delete) were NOT self-healing if
  a crash landed between them: a crash after the Postgres commit but before the mirror delete left
  Postgres saying 'retired' while the mirror — what hooks actually read — still held the row
  forever, because sync_document's existing-rules lookup filters `WHERE is_current`, and the row is
  now `is_current=false`, so it can never reappear in `set(existing) - set(records)` and `_retire`
  is never re-invoked for it again. This is the MIRROR IMAGE of the invariant
  `current_requires_mirror` was built to make unrepresentable (Postgres current + mirror missing);
  nothing guarded the opposite direction (Postgres retired + mirror still present) — and that
  direction is the dangerous one, because it means still enforcing a rule the owner removed.

  Fixed by REVERSING the order: the mirror delete now runs FIRST, the Postgres UPDATE+commit
  second. Reasoned through, not assumed:
    - A crash BEFORE the Postgres commit (whether it happens before or after the mirror delete)
      leaves the Postgres row completely untouched — still `is_current=true`, still
      `revision_status='current'`. The SAME rule_id therefore reappears in
      `set(existing) - set(records)` on the very next `sync_document` call (as long as the document
      still doesn't contain it, which is the whole reason it was being retired), and `_retire` runs
      again. `mirror.delete_revision` is a plain `DELETE WHERE rule_id = ?` — deleting an
      already-absent row is a no-op, not an error — so retrying is always safe. This is the same
      "the LAST committed write is the point of no return, and it is chosen so the state before it
      is legal" principle `sync_rule` already uses for its own step 1 (which commits
      `is_current=false` — inert, not "half current").
    - Does reversing the order reopen the window `current_requires_mirror` was built to close (a
      Postgres row claiming `is_current=true` while the mirror lacks it)? No: that CHECK only tests
      `mirrored_at IS NOT NULL`, a timestamp set once when the rule was first activated — it never
      re-verifies that the mirror STILL holds the row at read time. Deleting the mirror row while
      Postgres still says `is_current=true` does not violate that constraint; it produces an
      ordinary (non-crash) window, milliseconds long in practice, where the mirror is briefly behind
      Postgres — the same SHAPE `sync_rule`'s own step 2 already has (mirror write happens BEFORE
      the Postgres flip, in the opposite direction), not a new class of risk this module hasn't
      already accepted once.
  Proved with an injected fault (`_retire(..., _fail_after_mirror_delete=True)`,
  `test_retire_crash_before_pg_commit_is_self_healing`): the crash leaves the mirror already
  cleaned but Postgres still `is_current=true`/`'current'`; a subsequent normal `sync_document` call
  over the same (rule-still-absent) document text completes the retirement correctly.

  FINDING 2 (Minor, but the shape that caused Fix round 1's bug) — `sync_rule`'s `source_path` used
  to default to `DEFAULT_SOURCE_PATH`. `sync_document` always passed it explicitly, so nothing broke
  today, but the DEFAULT was exactly the value that made Fix round 1's bug invisible to every test
  that (like all of them, before the fix) happened to use that literal. `source_path` is now
  KEYWORD-ONLY with NO DEFAULT: an omission is a loud `TypeError`, not a silent fallback to the one
  literal that already hid one Critical bug from this file's own test suite.

  FINDING 3 (named, previously unexercised) — the unique index `one_current_revision_per_rule` is
  scoped to `rule_id` ALONE; `sync_document`'s existing-rows lookup is scoped to `(is_current,
  source_path)`. So a `rule_id` already current under source_path A, re-appearing in a SECOND
  document under source_path B, was classified `added` by B's own sync_document call, and
  `sync_rule`'s demotion step would silently supersede A's row — technically correct (only one
  current row survives, no constraint violated), but reported as an ordinary `added` with no signal
  that another document's rule had just been demoted. `rule_id` is documented (0001 migration) as "a
  stable, human, already-in-the-doc" key — the design intent is ONE global owner per rule_id, not
  per-document namespacing — so silent cross-document supersession is treated as a NAME COLLISION,
  not a legitimate handoff: `sync_document` now refuses it with a `ValueError` naming both
  source_paths, the same "fail loud on an authoring inconsistency" precedent `extract_rules` already
  set for a duplicate `rule_id` claimed by two shapes within one document.
"""
from __future__ import annotations

from src.rules_store import mirror as mirror_mod
from src.rules_store.extractor import RuleRecord, extract_rules

DEFAULT_SOURCE_PATH = "docs/process/development-discipline.md"


class SimulatedCrash(RuntimeError):
    """Raised only when a test asks for it — see sync_rule's `_fail_after_mirror_write` and
    _retire's `_fail_after_mirror_delete` parameters. Never raised in a real run; it exists so a
    test can inject a fault deterministically rather than trying to time a real crash, which no
    test can do reliably."""


def sync_rule(
    pg_conn, mirror_conn, record: RuleRecord, *, source_path: str, _fail_after_mirror_write: bool = False,
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
        # rule_group (0005 migration, R-103-aware) is a HUMAN classification, not something the
        # extractor derives from vocabulary the way `bucket` is — there is no `_classify_rule_group`
        # regex, by design (spec §1.1's own regex-vs-judgement lesson: a mechanism axis that needs
        # judgement should not be faked with a word list). So a re-sync triggered only by the
        # document's TEXT changing (a rewording, a typo fix) must not silently null out a prior
        # human classification just because the extractor never set one on the new record — that is
        # exactly R-103's shape (a column with real data getting overwritten by a write path that
        # doesn't carry it) one level up. If the incoming record carries no rule_group, inherit
        # the PREVIOUS current revision's value (if any); an explicit rule_group on the record
        # (e.g. a future classifier) always wins.
        #
        # `mechanism`/`mechanism_target` (0006 migration, Task 3 of the 2026-08-08 rule-coverage
        # arc) are inherited the same way and for the same reason: they too are HUMAN
        # classifications the extractor never derives, so a re-sync triggered only by the
        # document's TEXT changing must not silently null them out — this is measured defect #1 of
        # that arc: a discipline-doc rewording, the most ordinary edit in this repository, would
        # otherwise wipe every classification the arc creates, and Task 2's mirror digest — which
        # would then agree on both sides — would never notice.
        cur.execute(
            "SELECT rule_group, mechanism, mechanism_target FROM rule_revisions "
            "WHERE rule_id = %s AND is_current",
            (record.rule_id,),
        )
        prev_row = cur.fetchone()
        inherited_rule_group = prev_row[0] if prev_row else None
        rule_group = getattr(record, "rule_group", None) or inherited_rule_group
        mechanism = getattr(record, "mechanism", None) or (prev_row[1] if prev_row else None)
        mechanism_target = getattr(record, "mechanism_target", None) or (prev_row[2] if prev_row else None)

        # Step 1 — Postgres, is_current=false. source_path is the CALLER's real value (Fix round
        # 1) — never a hardcoded literal, and now (Fix round 2) never a silently-defaulted one
        # either — so sync_document's own `WHERE source_path = %s` lookup can trust what got
        # written here.
        # Fix round 2, 2026-08-06 — review finding, Critical: `bucket`, `severity`, `mechanism`
        # were absent from this column list entirely, so mk_rules (the source of truth) held NULL
        # for all three on every current row regardless of what the record carried — invisible
        # until Task 13's mirror-checksum digest started covering `bucket` and a self-heal
        # (rebuild_mirror_from_postgres) silently overwrote a mirror that legitimately held
        # 'process' with the NULL read back from Postgres. `severity` stays a literal None here —
        # NULL on all 140 rows in both stores today, nothing to inherit, no behavioural test could
        # witness a loss (Task 3 brief, noted as a decision not an oversight). `mechanism` and
        # `mechanism_target` are now the INHERITED values computed above, written here from the
        # SAME variables the mirror write below already uses — one computation, not two that could
        # disagree.
        cur.execute(
            """
            INSERT INTO rule_revisions
                (rule_id, section, title_he, statement, bucket, rule_group, severity, mechanism,
                 mechanism_target, source_path, source_heading, source_hash, revision_status,
                 is_current)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'current', false)
            RETURNING revision_id
            """,
            (record.rule_id, record.section, record.title_he, record.statement,
             getattr(record, "bucket", None), rule_group, None, mechanism, mechanism_target,
             source_path, record.source_heading, record.content_hash),
        )
        revision_id = cur.fetchone()[0]
    pg_conn.commit()

    # Step 2 — the mirror. rule_group/mechanism/mechanism_target are the SAME values just written
    # to Postgres above (including the inheritance), never re-derived here — one computation, not
    # two that could disagree.
    mirror_mod.write_revision(mirror_conn, {
        "rule_id": record.rule_id, "section": record.section, "title_he": record.title_he,
        "statement": record.statement, "bucket": getattr(record, "bucket", None),
        "rule_group": rule_group, "severity": None,
        "mechanism": mechanism, "mechanism_target": mechanism_target, "source_path": source_path,
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

    Fix round 2 (2026-08-06, FINDING 3) — BEFORE any write, refuses (`ValueError`) if any rule_id in
    this document is currently owned by a DIFFERENT source_path: a rule_id is a single global key
    (0001 migration's own comment), so a second document silently taking over another document's
    rule is treated as a name collision to report, not a handoff to perform quietly. This check runs
    for the WHOLE document up front, so a conflict on one rule_id blocks the entire call rather than
    partially applying the rest.
    """
    records = {r.rule_id: r for r in extract_rules(text, source_path)}

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT rule_id, source_hash FROM rule_revisions WHERE is_current AND source_path = %s",
            (source_path,),
        )
        existing = dict(cur.fetchall())

        # Fix round 2, FINDING 3 — cross-document rule_id collision check, up front, before any
        # write this call might make.
        if records:
            cur.execute(
                "SELECT rule_id, source_path FROM rule_revisions "
                "WHERE is_current AND rule_id = ANY(%s) AND source_path != %s",
                (list(records.keys()), source_path),
            )
            conflicts = cur.fetchall()
            if conflicts:
                detail = ", ".join(
                    f"{rid!r} (currently current under {other!r})" for rid, other in conflicts
                )
                raise ValueError(
                    f"sync_document({source_path!r}): refusing to silently supersede another "
                    f"document's rule — rule_id is meant to be a single global key: {detail}. "
                    "If this document is meant to own it now, retire it from its previous "
                    "source_path first."
                )

    result = {"added": [], "updated": [], "unchanged": [], "retired": []}

    for rule_id, record in records.items():
        if rule_id not in existing:
            sync_rule(pg_conn, mirror_conn, record, source_path=source_path)
            result["added"].append(rule_id)
        elif existing[rule_id] != record.content_hash:
            sync_rule(pg_conn, mirror_conn, record, source_path=source_path)
            result["updated"].append(rule_id)
        else:
            result["unchanged"].append(rule_id)

    for rule_id in set(existing) - set(records):
        _retire(pg_conn, mirror_conn, rule_id)
        result["retired"].append(rule_id)

    return result


def _retire(pg_conn, mirror_conn, rule_id: str, *, _fail_after_mirror_delete: bool = False) -> None:
    """Marks the current revision of `rule_id` 'retired' with retired_at set (never deleted — the
    geniza guarantee), and removes it from the mirror, which holds current rules only. The Postgres
    row stays queryable by rule_id afterwards, same as any superseded revision.

    Fix round 2, FINDING 1 — the mirror delete runs FIRST, the Postgres commit SECOND (reversed from
    the original shipped order). See the module docstring for the full reasoning: this ordering is
    what makes a crash between the two self-healing on the next `sync_document` call, because a
    crash before the Postgres commit leaves the Postgres row untouched (still `is_current=true`),
    so the same rule_id is classified for retirement again next time, and `mirror.delete_revision`
    is idempotent against an already-absent row.
    """
    mirror_mod.delete_revision(mirror_conn, rule_id)

    if _fail_after_mirror_delete:
        raise SimulatedCrash("fault injected between mirror delete and the Postgres retire commit")

    with pg_conn.cursor() as cur:
        cur.execute(
            "UPDATE rule_revisions SET is_current = false, revision_status = 'retired', retired_at = now() "
            "WHERE rule_id = %s AND is_current",
            (rule_id,),
        )
    pg_conn.commit()


def rebuild_mirror_from_postgres(pg_conn, mirror_conn) -> int:
    """Rewrites the mirror from Postgres's current rows only — no document parsing, no writes to
    Postgres. Used when rules.sqlite is missing or corrupt but mk_rules is healthy (watchman
    recovery, Task 18)."""
    mirror_conn.execute("DELETE FROM rule_revisions")
    mirror_conn.commit()
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT rule_id, section, title_he, statement, bucket, rule_group, severity, mechanism, "
            "mechanism_target, source_path, source_heading, source_hash, revision_status "
            "FROM rule_revisions WHERE is_current"
        )
        rows = cur.fetchall()
        cols = [d.name for d in cur.description]
    for row in rows:
        mirror_mod.write_revision(mirror_conn, dict(zip(cols, row)))
    return len(rows)
