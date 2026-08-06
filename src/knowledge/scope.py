"""Single resolver for the declared ingest scope (`docs/process/memory-ingest-scope.json`).

Both `scripts/ingest.py` and `scripts/check-geniza-fresh.mjs` used to walk `roots`/`patterns`
independently. That duplication is exactly the failure mode the scope file's own `_why` warns
about — two copies of "what belongs in the corpus" that can silently disagree. This module is the
one place that turns the JSON into a list of repo-relative paths, so both callers see the same
answer, including which files are excluded.

Exclusion is **top-level only** and glob-based (`fnmatch` against the repo-relative POSIX path —
`fnmatch` does not treat `/` specially, so `docs/audit/**` matches every file under that
directory, and a plain path with no wildcard still matches only itself, preserving exact-path
behaviour for anything that relies on it). A per-root `exclude` key is REJECTED, not ignored: the
first version of the audit exclusion was written as a per-root key, the loader only ever read
`exclude` from the top level, and the file quietly did nothing — a config key that looks
effective and is inert is worse than no key at all.
"""

from __future__ import annotations

import fnmatch
import json
from pathlib import Path


class ScopeError(SystemExit):
    """Raised for a scope file the loader cannot honour — never silently ignored."""


def _is_excluded(rel: str, patterns: list[str]) -> bool:
    return any(rel == pat or fnmatch.fnmatch(rel, pat) for pat in patterns)


def resolve_scope(scope_file: Path, root: Path) -> list[str]:
    """Return the sorted, deduplicated, exclude-filtered list of repo-relative paths in scope.

    Raises ScopeError if the file declares a per-root `exclude` (unsupported — see module
    docstring) or if the resolved scope is empty (a broken scope definition, not a real state).
    """
    scope = json.loads(scope_file.read_text(encoding="utf-8"))
    excluded = [str(x) for x in scope.get("exclude", [])]

    for r in scope.get("roots", []):
        if "exclude" in r:
            raise ScopeError(
                f"{scope_file.name}: root {r.get('path')!r} declares a per-root 'exclude' key, "
                "which this loader does not support — exclusions are top-level only. Move it to "
                "the top-level 'exclude' list; a per-root key here is silently ignored otherwise."
            )

    out: list[str] = []
    for r in scope.get("roots", []):
        base = root / str(r["path"])
        for pattern in r.get("patterns", []):
            for path in sorted(base.glob(pattern)):
                if not path.is_file():
                    continue
                rel = path.relative_to(root).as_posix()
                if _is_excluded(rel, excluded) or rel in out:
                    continue
                out.append(rel)

    if not out:
        raise ScopeError(
            f"the declared scope in {scope_file.name} resolved to 0 files. That is a broken "
            "scope definition, not an empty repository — check its `roots` patterns."
        )
    return sorted(out)
