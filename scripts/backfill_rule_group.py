"""One-time backfill: writes `rule_group` (A/B/C/none) for every currently-current rule in
mk_rules, from a classification file produced by manual/agent review of each rule's statement
(spec §5-§7, R-103-aware — see infra/rules-db/migrations/0005_rule_group.sql).

Reads a JSON array of {"rule_id", "rule_group", "reason"} and, for each entry:
  1. UPDATEs the current Postgres row's rule_group directly (no new revision — this is a
     classification of the EXISTING current text, not a content change, so it does not go through
     sync_rule's insert-a-new-revision path).
  2. Writes the SAME value into the mirror via mirror.write_revision on the full current row, so
     Postgres and the mirror never disagree about a value this script itself just set — the exact
     failure R-103 documents (a write path that updates one side and not the other).

Refuses (loudly, no partial application) if the classification file omits any currently-current
rule_id, or names a rule_id that is not currently current, or uses a value outside
('A','B','C','none') — a silent partial backfill would leave the exact ambiguity (some rows
classified, some not, no signal which) this task exists to remove.

Usage:
    py -3 scripts/backfill_rule_group.py <classification.json> [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")  # L74: prints carry "—"; Windows pipes stdout as cp1252

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import config, mirror  # noqa: E402

VALID_GROUPS = {"A", "B", "C", "none"}
MIRROR_PATH = ROOT / "rules.sqlite"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("classification_file", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    entries = json.loads(args.classification_file.read_text(encoding="utf-8"))
    by_id = {}
    for e in entries:
        rid, grp = e["rule_id"], e["rule_group"]
        if grp not in VALID_GROUPS:
            print(f"FAIL: {rid!r} has invalid rule_group {grp!r} (must be one of {sorted(VALID_GROUPS)})")
            return 1
        if rid in by_id:
            print(f"FAIL: {rid!r} appears more than once in the classification file")
            return 1
        by_id[rid] = grp

    pg_conn = config.connect_writer(timeout=10)
    try:
        with pg_conn.cursor() as cur:
            cur.execute(
                "SELECT rule_id, section, title_he, statement, bucket, severity, mechanism, "
                "source_path, source_heading, source_hash, revision_status "
                "FROM rule_revisions WHERE is_current ORDER BY rule_id"
            )
            rows = cur.fetchall()
            cols = [d.name for d in cur.description]

        current_ids = {r[0] for r in rows}
        missing_from_file = current_ids - set(by_id)
        extra_in_file = set(by_id) - current_ids
        if missing_from_file:
            print(f"FAIL: {len(missing_from_file)} current rule_id(s) missing from the classification file: "
                  f"{sorted(missing_from_file)}")
            return 1
        if extra_in_file:
            print(f"FAIL: classification file names {len(extra_in_file)} rule_id(s) that are not currently "
                  f"current: {sorted(extra_in_file)}")
            return 1

        print(f"{len(rows)} current rule(s), {len(by_id)} classified. Applying ...")

        if args.dry_run:
            from collections import Counter
            counts = Counter(by_id.values())
            print(f"DRY RUN — would set: {dict(counts)}")
            return 0

        mirror_conn = mirror.open_mirror(MIRROR_PATH)
        try:
            for row in rows:
                record = dict(zip(cols, row))
                rid = record["rule_id"]
                grp = by_id[rid]

                with pg_conn.cursor() as cur:
                    cur.execute(
                        "UPDATE rule_revisions SET rule_group = %s WHERE rule_id = %s AND is_current",
                        (grp, rid),
                    )
                pg_conn.commit()

                record["rule_group"] = grp
                mirror.write_revision(mirror_conn, record)
        finally:
            mirror_conn.close()

        print(f"OK — {len(rows)} row(s) classified in mk_rules and mirrored to {MIRROR_PATH}.")
        return 0
    finally:
        pg_conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
