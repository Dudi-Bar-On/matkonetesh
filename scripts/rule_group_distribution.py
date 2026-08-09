"""Prints the current rule_group distribution over mk_rules's current rows — re-derivable any time,
so "how many A/B/C/none" is a query, not a remembered number (2026-08-07 task, R-103-aware:
`rule_group` is added specifically so it does not become a column nobody checks).

Usage: py -3 scripts/rule_group_distribution.py
"""
from __future__ import annotations

import sys

sys.stdout.reconfigure(encoding="utf-8")  # L74: print carries "·"; Windows pipes stdout as cp1252

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import config  # noqa: E402


def main() -> int:
    conn = config.connect_reader(timeout=5)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT rule_group, count(*) FROM rule_revisions WHERE is_current "
                "GROUP BY 1 ORDER BY 1"
            )
            rows = cur.fetchall()
            cur.execute(
                "SELECT count(*) FROM rule_revisions WHERE is_current AND rule_group IS NULL"
            )
            null_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM rule_revisions WHERE is_current")
            total = cur.fetchone()[0]
    finally:
        conn.close()

    for group, n in rows:
        print(f"{group or 'NULL'}: {n}")
    print(f"-- total current rules: {total} · unclassified (NULL): {null_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
