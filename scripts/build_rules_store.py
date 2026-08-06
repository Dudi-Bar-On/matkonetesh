# scripts/build_rules_store.py
"""Build or rebuild the mk_rules store and its rules.sqlite mirror.

    py -3 scripts/build_rules_store.py --doc docs/process/development-discipline.md
    py -3 scripts/build_rules_store.py --rebuild-mirror-only

Exit codes: 0 on success, 1 on any failure (connection, constraint violation, parse error).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import builder, config, mirror  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--doc", type=Path, help="document to sync (repo-relative or absolute)")
    ap.add_argument("--rebuild-mirror-only", action="store_true",
                     help="rebuild rules.sqlite from mk_rules's current rows; touches nothing in Postgres")
    ap.add_argument("--mirror-path", type=Path, default=ROOT / "rules.sqlite")
    args = ap.parse_args()

    if not args.doc and not args.rebuild_mirror_only:
        ap.error("give --doc <path> or --rebuild-mirror-only")

    pg = config.connect_writer()
    pg.autocommit = False
    try:
        m = mirror.open_mirror(args.mirror_path)
        if args.rebuild_mirror_only:
            n = builder.rebuild_mirror_from_postgres(pg, m)
            print(f"rebuilt mirror: {n} current rule(s) written to {args.mirror_path}")
            return 0

        text = args.doc.read_text(encoding="utf-8")
        source_path = str(args.doc)
        result = builder.sync_document(pg, m, text, source_path)
        print(
            f"added: {len(result['added'])} · updated: {len(result['updated'])} · "
            f"unchanged: {len(result['unchanged'])} · retired: {len(result['retired'])}"
        )
        for kind in ("added", "updated", "retired"):
            for rule_id in result[kind][:10]:
                print(f"  {kind}: {rule_id}")
        return 0
    except Exception as exc:  # noqa: BLE001 - reported, not swallowed
        print(f"FAILED: {type(exc).__name__}: {exc}")
        return 1
    finally:
        pg.close()


if __name__ == "__main__":
    sys.exit(main())
