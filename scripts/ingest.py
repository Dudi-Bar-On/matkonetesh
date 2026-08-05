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
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import worker  # noqa: E402
from src.knowledge.worker import WorkerBusy  # noqa: E402

SCOPE_FILE = ROOT / "docs" / "process" / "memory-ingest-scope.json"


def scoped_paths() -> list[str]:
    """The declared ingest scope — the same file the SQLite layer reads.

    One scope definition, read by both, so the two stores cannot disagree about what belongs in
    the corpus while Phase 7's migration is comparing them.
    """
    if not SCOPE_FILE.exists():
        raise SystemExit(f"{SCOPE_FILE} not found — it defines what may be ingested")
    # The file's shape is `roots: [{path, patterns[]}]` — READ, not guessed. The first version of
    # this function assumed `include`/`exclude` and returned an empty list, which the CLI then
    # reported as "give one or more paths" rather than as "the scope resolved to nothing". An
    # empty scope is a state worth naming, so it is named below.
    scope = json.loads(SCOPE_FILE.read_text(encoding="utf-8"))
    excluded = {str(x) for x in scope.get("exclude", [])}
    out: list[str] = []
    for root in scope.get("roots", []):
        base = ROOT / str(root["path"])
        for pattern in root.get("patterns", []):
            for path in sorted(base.glob(pattern)):
                if not path.is_file():
                    continue
                rel = path.relative_to(ROOT).as_posix()
                if rel in excluded or rel in out:
                    continue
                out.append(rel)
    if not out:
        raise SystemExit(
            f"the declared scope in {SCOPE_FILE.name} resolved to 0 files. That is a broken scope "
            "definition, not an empty repository — check its `roots` patterns."
        )
    return sorted(out)


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
