"""Batch classification of `rule_group` / `mechanism` / `mechanism_target` (spec
docs/superpowers/specs/2026-08-08-rule-coverage-design.md, Task 4). This is where three owner
governance rules stop being prose in a task description and become properties the CLI cannot be
talked out of:

  1. Small batches — `validate_batch` refuses any batch with more than `MAX_BATCH` (10) entries.
     Classifying 39 rules at once is judgement, and judgement at that volume degrades toward
     "whatever is easy to implement" (spec §2: "במנות קטנות, לא ברשימה אחת").
  2. Owner approval — `validate_batch` refuses a batch whose `approved_by_owner` is not a
     `YYYY-MM-DD` string. A draft carries `null`; only the owner's word, recorded by a controller
     who was told it in conversation, becomes a date.
  3. No unilateral demotion — an entry landing on `rule_group == "none"` or `mechanism == "none"`
     must carry non-empty `cost` and `importance` strings: the owner's own binding caveat ("אם הוא
     חשוב אז גם אכיפה יקרה יכולה להיות שווה") must accompany every demotion, not be assumed.

`validate_batch` is pure Python — no store connection, so it can be unit-tested without mk_rules
and reused by both the CLI (which validates BEFORE opening a mirror connection) and `apply_batch`
(defense in depth: even a caller that skipped the CLI's own validation cannot write a batch this
function would refuse).

The write path follows `backfill_rule_group.py`'s R-103-safe order, extended for the two new
columns: (1) UPDATE the touched rows on Postgres, one commit for the WHOLE batch — not per-row —
so a crash mid-batch leaves either all-of-the-batch or none-of-it-yet committed, never half;
(2) for each touched rule_id, re-read its full current Postgres row and `mirror.write_revision`
it, so the mirror's copy is always derived FROM Postgres's own post-write state, never from the
batch's input values (which could differ from what actually landed if, e.g., a concurrent writer
changed something else on the row in between — reading back is what makes the mirror agree with
Postgres, not merely with the batch file). Postgres-first: a crash between the two leaves a
divergence Task 2's digest catches and check-rules-mirror repairs FROM Postgres — self-healing in
the correct direction, same reasoning as sync_rule's own step ordering.
"""
from __future__ import annotations

import re

VOCAB = frozenset({
    "pretooluse:Bash", "pretooluse:Edit|Write", "pretooluse:Agent", "pretooluse:Grep|WebSearch",
    "posttooluse", "stop", "subagentstop", "sessionstart", "commit-gate", "ci-gate",
    "judge", "none",
})

RULE_GROUPS = frozenset({"A", "B", "C", "none"})

MAX_BATCH = 10

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_batch(batch: dict, current: dict) -> list[str]:
    """Returns a list of full-sentence errors naming the offending rule_id and value — empty list
    means the batch may be applied. Never raises on a malformed batch shape; a missing/blank field
    is itself reported as an error string, because a KeyError or crash is not a said error (the
    brief's own bar: "A CLI that just exits non-zero teaches people to pass a flag to silence it").
    """
    errors: list[str] = []

    approved = batch.get("approved_by_owner")
    if not isinstance(approved, str) or not _DATE_RE.match(approved):
        errors.append(
            "approved_by_owner is missing or not a YYYY-MM-DD date "
            f"(got {approved!r}) — the owner must approve this batch in conversation before "
            "the CLI will apply it; set approved_by_owner to the date of that approval."
        )

    entries = batch.get("entries") or []
    if len(entries) > MAX_BATCH:
        errors.append(
            f"batch has {len(entries)} entries, more than the maximum of {MAX_BATCH} — "
            "classifying that many rules at once stops being a real per-rule judgement; split "
            "this into smaller batch files."
        )

    seen_ids: set[str] = set()
    for entry in entries:
        rule_id = entry.get("rule_id")
        if not rule_id:
            errors.append(f"entry with no rule_id: {entry!r}")
            continue

        if rule_id in seen_ids:
            errors.append(f"{rule_id!r} appears more than once in this batch")
        seen_ids.add(rule_id)

        if rule_id not in current:
            errors.append(
                f"{rule_id!r} has no current row in mk_rules — cannot classify a rule that "
                "does not currently exist (typo in rule_id, or the rule was retired)"
            )

        rule_group = entry.get("rule_group")
        if rule_group is not None and rule_group not in RULE_GROUPS:
            errors.append(
                f"{rule_id!r} has rule_group {rule_group!r}, not one of {sorted(RULE_GROUPS)}"
            )

        mechanism = entry.get("mechanism")
        if mechanism is not None and mechanism not in VOCAB:
            errors.append(
                f"{rule_id!r} has mechanism {mechanism!r}, not one of the 12-value vocabulary "
                f"{sorted(VOCAB)}"
            )
        else:
            mechanism_target = entry.get("mechanism_target")
            if mechanism == "none":
                if mechanism_target not in (None, ""):
                    errors.append(
                        f"{rule_id!r} has mechanism 'none' but a non-empty mechanism_target "
                        f"{mechanism_target!r} — 'none' means not mechanically enforceable, so "
                        "a target is meaningless there and must be absent."
                    )
            elif mechanism is not None:
                if not mechanism_target or not str(mechanism_target).strip():
                    errors.append(
                        f"{rule_id!r} has mechanism {mechanism!r} but no mechanism_target — "
                        "every mechanism except 'none' requires a concrete target (on what?)."
                    )

        is_demotion = rule_group == "none" or mechanism == "none"
        if is_demotion:
            cost = entry.get("cost")
            importance = entry.get("importance")
            missing = []
            if not cost or not str(cost).strip():
                missing.append("cost")
            if not importance or not str(importance).strip():
                missing.append("importance")
            if missing:
                errors.append(
                    f"{rule_id!r} demotes to rule_group/mechanism 'none' but is missing "
                    f"{' and '.join(missing)} — the owner's ruling requires both to accompany "
                    "every demotion (\"אם הוא חשוב אז גם אכיפה יקרה יכולה להיות שווה\"); fill "
                    f"in {' and '.join(missing)} for {rule_id!r} before this batch can apply."
                )

    return errors


def apply_batch(pg_conn, mirror_conn, batch: dict) -> dict:
    """Applies an approved batch. Defense in depth: re-validates against a fresh read of current
    Postgres state (never trusting a `current` mapping supplied by the caller) and refuses — no
    writes at all — if that validation is non-empty, even though the CLI is expected to have
    validated already. Returns {"applied": [rule_id, ...], "regrouped": [rule_id, ...]}."""
    from src.rules_store import mirror as mirror_mod

    with pg_conn.cursor() as cur:
        cur.execute("SELECT rule_id, rule_group FROM rule_revisions WHERE is_current")
        current = dict(cur.fetchall())

    errors = validate_batch(batch, current)
    if errors:
        raise ValueError("refusing to apply batch — " + "; ".join(errors))

    entries = batch.get("entries") or []
    applied: list[str] = []
    regrouped: list[str] = []

    # Step 1 — Postgres, one commit for the whole batch.
    with pg_conn.cursor() as cur:
        for entry in entries:
            rule_id = entry["rule_id"]
            new_group = entry.get("rule_group")
            cur.execute(
                "UPDATE rule_revisions SET rule_group = %s, mechanism = %s, mechanism_target = %s "
                "WHERE rule_id = %s AND is_current",
                (new_group, entry.get("mechanism"), entry.get("mechanism_target"), rule_id),
            )
            applied.append(rule_id)
            prev_group = current.get(rule_id)
            if prev_group is not None and prev_group != new_group:
                regrouped.append(rule_id)
    pg_conn.commit()

    # Step 2 — mirror, one row read back from Postgres per touched rule_id.
    with pg_conn.cursor() as cur:
        for rule_id in applied:
            cur.execute(
                "SELECT rule_id, section, title_he, statement, bucket, rule_group, severity, "
                "mechanism, mechanism_target, source_path, source_heading, source_hash, "
                "revision_status FROM rule_revisions WHERE rule_id = %s AND is_current",
                (rule_id,),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            mirror_mod.write_revision(mirror_conn, dict(zip(cols, row)))

    return {"applied": applied, "regrouped": regrouped}
