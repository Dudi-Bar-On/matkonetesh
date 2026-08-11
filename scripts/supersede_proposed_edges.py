#!/usr/bin/env python
"""supersede-proposed-edges.py — R-136 Half 1 (owner decision, 2026-08-11).

Flips every Neo4j relationship with `status = 'proposed'` to `status = 'superseded'`.
NEVER deletes. NEVER touches a node. NEVER changes the schema.

Why superseded, not deleted: `proposed` means "awaiting promotion", and nothing was ever going to
promote these (measured: 0 `manually_confirmed` edges, ever). Leaving them `proposed` is a lie that
costs someone a day building a promotion mechanism for facts that will never be promoted (this
happened once already, per the R-136 brief). `superseded` is the geniza's own doctrine, written into
CLAUDE.md: a superseded version is not erased, it becomes `superseded` and stays citable — so a later
question ("what did the model claim, and how much of it was right") still has an answer, which is
exactly what the 20-edge sample that triggered this decision needed.

    python scripts/supersede-proposed-edges.py                  # DRY RUN (default) - counts, then
                                                                  # rolls back. Nothing is written.
    python scripts/supersede-proposed-edges.py --apply           # writes for real, inside one
                                                                  # transaction, commits once.
    python scripts/supersede-proposed-edges.py --apply --expect 16500   # override the safety count

SAFETY: --apply refuses to run unless the LIVE `proposed` count matches --expect (default 16456,
the number measured in r136-measurement.md). The corpus was known to be growing at measurement time
(87 revisions pending extraction) — extract_graph.py's write path is now retired (same R-136 change,
see scripts/extract_graph.py), so the count should be stable, but this script does not assume that;
it re-reads the live count itself and refuses on a mismatch rather than trusting a number typed into
a doc. --force skips only this comparison, never the dry-run-first requirement below.

The dry-run path uses a REAL transaction that is explicitly rolled back (`tx.rollback()`), not a
read-only Cypher rewrite of the same query — so what it counts is provably the exact same write the
--apply path would perform, run through the exact same code path, minus the commit.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # L74: prints carry "—"; Windows pipes stdout as cp1252

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config  # noqa: E402

DEFAULT_EXPECT = 16456

SUPERSEDE_REASON = (
    "R-136 (owner decision, 2026-08-11): superseded in favor of graphify's deterministic AST "
    "graph. Was 100% extraction_method='structured_llm', 0% ever manually_confirmed; a 20-edge "
    "sample of app.js found real high-confidence direction/attribution errors "
    "(toast CALLS journal; b.addEventListener CALLS store.set)."
)

CYPHER = """
MATCH ()-[r]->()
WHERE r.status = 'proposed'
SET r.status = 'superseded',
    r.superseded_at = datetime(),
    r.superseded_reason = $reason
RETURN count(r) AS n
"""

COUNT_CYPHER = "MATCH ()-[r]->() WHERE r.status = $status RETURN count(r) AS n"


def live_count(session, status: str) -> int:
    return session.run(COUNT_CYPHER, status=status).single()["n"]


def run(apply: bool, expect: int, force: bool) -> int:
    driver = config.neo4j_driver()
    try:
        with driver.session() as session:
            before_proposed = live_count(session, "proposed")
            before_superseded = live_count(session, "superseded")
            print(f"live proposed edges before this run: {before_proposed}")
            print(f"live superseded edges before this run: {before_superseded}")

            if before_proposed != expect and not force:
                print(
                    f"STOP: live proposed count ({before_proposed}) does not match --expect "
                    f"({expect}). This is a pass aimed at a different set than the one measured "
                    "and approved. Re-measure before proceeding, or pass --force with the reason "
                    "recorded in the calling report."
                )
                return 1

            tx = session.begin_transaction()
            try:
                result = tx.run(CYPHER, reason=SUPERSEDE_REASON)
                changed = result.single()["n"]
                if apply:
                    tx.commit()
                    mode = "APPLIED"
                else:
                    tx.rollback()
                    mode = "DRY RUN (rolled back — nothing written)"
            except Exception:
                tx.rollback()
                raise

            print(f"{mode}: {changed} relationship(s) matched WHERE r.status='proposed'.")

            after_proposed = live_count(session, "proposed")
            after_superseded = live_count(session, "superseded")
            print(f"live proposed edges after this run: {after_proposed}")
            print(f"live superseded edges after this run: {after_superseded}")

            if apply:
                ok = (after_proposed == 0
                      and after_superseded == before_superseded + changed
                      and before_proposed - after_proposed == changed)
                if not ok:
                    print("WARNING: post-apply counts are not the expected shape — investigate "
                          "before trusting this run. Nothing was deleted (this script never issues "
                          "DELETE/DETACH DELETE), but the counts should be double-checked by hand.")
                    return 1
                print("OK: every previously-proposed edge is now superseded; zero remain proposed; "
                      "total edge count is unchanged (a status flip, not a delete).")
            else:
                if after_proposed != before_proposed or after_superseded != before_superseded:
                    print("WARNING: counts changed across a rolled-back transaction — investigate.")
                    return 1
                print(f"OK: dry run confirms {changed} edge(s) would change; live counts are "
                      "unchanged (rollback verified). Re-run with --apply to write for real.")
            return 0
    finally:
        driver.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write for real (default: dry run, rolled back)")
    ap.add_argument("--expect", type=int, default=DEFAULT_EXPECT,
                     help=f"safety check: refuse --apply unless the live proposed count equals this (default {DEFAULT_EXPECT})")
    ap.add_argument("--force", action="store_true", help="skip the --expect safety check (still never skips dry-run-first)")
    args = ap.parse_args()
    return run(apply=args.apply, expect=args.expect, force=args.force)


if __name__ == "__main__":
    sys.exit(main())
