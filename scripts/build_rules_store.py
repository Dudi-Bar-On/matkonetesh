# scripts/build_rules_store.py
"""Build or rebuild the mk_rules store and its rules.sqlite mirror.

    py -3 scripts/build_rules_store.py --doc docs/process/development-discipline.md
    py -3 scripts/build_rules_store.py --rebuild-mirror-only

Exit codes: 0 on success, 1 on a runtime failure (connection, constraint violation, parse error),
2 on a bad invocation (argparse's own exit code — e.g. neither --doc nor --rebuild-mirror-only
given).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# L74: this script prints Hebrew and the separator '·'. On Windows a PIPE gets the locale encoding
# (cp1252), so the same command that reads fine in a terminal hands a caller bytes it cannot decode as
# UTF-8 — which is how a passing test started crashing inside subprocess's reader thread rather than in
# an assertion. Naming the encoding here makes the output identical whether the parent was launched
# with -X utf8 or not, and that determinism is the point: encoding must not depend on how we were run.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

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

    # Fix round 1, MINOR 3: --rebuild-mirror-only only ever SELECTs from mk_rules — the reader
    # connection (config.connect_reader(), no write verb at the Postgres role level) is least
    # privilege for that path. A full --doc sync writes, so it still needs connect_writer().
    pg = config.connect_reader() if args.rebuild_mirror_only else config.connect_writer()
    pg.autocommit = False
    try:
        m = mirror.open_mirror(args.mirror_path)
        if args.rebuild_mirror_only:
            n = builder.rebuild_mirror_from_postgres(pg, m)
            print(f"rebuilt mirror: {n} current rule(s) written to {args.mirror_path}")
            return 0

        text = args.doc.read_text(encoding="utf-8")
        # Fix round 1, IMPORTANT 2: str(Path(...)) renders with backslashes on Windows.
        # sync_document's cross-document rule_id-ownership check compares source_path as a raw
        # string, so an un-normalized Windows path and the POSIX form of the SAME document are two
        # different "documents" to that check — a real sync from a different OS would hard-refuse
        # every rule in it as a false name collision. .as_posix() makes the stored value stable
        # across platforms.
        source_path = args.doc.as_posix()
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
