"""Explicit ingestion command — one of the four event sources the prompt names.

    python scripts/ingest.py docs/process/development-discipline.md
    python scripts/ingest.py --scope                 # everything in the declared ingest scope
    python scripts/ingest.py --scope --dry-run       # list what would be ingested, write nothing

The other three sources (repository update, generated-document completion, approved filesystem
watcher) all end at the same run() call. This is the one a person invokes.

Exit codes: 0 if nothing failed, 1 if any document failed after its bounded retries, 2 if another
worker holds the lock. Distinguished because "busy" is the design working and "failed" is not, and
a caller that cannot tell them apart will treat one as the other.
"""

from __future__ import annotations

import argparse
import logging
import sys

sys.stdout.reconfigure(encoding="utf-8")  # L74: prints carry "·"; Windows pipes stdout as cp1252

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import worker  # noqa: E402
from src.knowledge.worker import WorkerBusy  # noqa: E402
from src.knowledge.scope import ScopeError, resolve_scope  # noqa: E402

SCOPE_FILE = ROOT / "docs" / "process" / "memory-ingest-scope.json"


def scoped_paths() -> list[str]:
    """The declared ingest scope — the same file the SQLite layer reads.

    One scope definition, read by both, so the two stores cannot disagree about what belongs in
    the corpus while Phase 7's migration is comparing them. Resolution (including exclusion) is
    delegated to src.knowledge.scope so this file and scripts/check-geniza-fresh.mjs cannot drift
    apart the way the scope definition itself once did across three copies.
    """
    if not SCOPE_FILE.exists():
        raise SystemExit(f"{SCOPE_FILE} not found — it defines what may be ingested")
    try:
        return resolve_scope(SCOPE_FILE, ROOT)
    except ScopeError as exc:
        raise SystemExit(str(exc)) from exc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*", help="repo-relative paths to ingest")
    ap.add_argument("--scope", action="store_true", help="ingest everything in the declared scope")
    ap.add_argument("--namespace", default="repo")
    ap.add_argument("--dry-run", action="store_true", help="list what would be ingested; write nothing")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    paths = list(args.paths)
    if args.scope:
        paths.extend(scoped_paths())
    if not paths:
        ap.error("give one or more paths, or --scope")

    if args.dry_run:
        print(f"would ingest {len(paths)} document(s) into namespace {args.namespace!r}:")
        for p in paths[:20]:
            print(f"  {p}")
        if len(paths) > 20:
            print(f"  ... and {len(paths) - 20} more")
        return 0

    try:
        results = worker.run(paths, namespace=args.namespace)
    except WorkerBusy as exc:
        print(f"BUSY: {exc}")
        return 2

    counts: dict[str, int] = {}
    for r in results:
        counts[r.outcome] = counts.get(r.outcome, 0) + 1
    print(" · ".join(f"{outcome}: {n}" for outcome, n in sorted(counts.items())))

    failures = [r for r in results if r.outcome == "failed"]
    for r in failures:
        print(f"  FAILED {r.source_path}: {r.detail[:200]}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
