"""Glob-based exclusion for the declared ingest scope.

Written after docs/audit/2026-08-06-enforcement-arc-audit.md — a ~1.35MB derived transcript
projection regenerated on every commit — was ingested into the geniza and re-embedded on every
run. A per-root `exclude` key was added to fix it and did nothing: `scripts/ingest.py` only ever
read `exclude` from the TOP level of the scope file, doing an exact-string match, so a per-root
key and a glob pattern were both silently inert.

This file proves: (1) the audit tree is excluded by a glob that survives a filename change,
(2) real documents stay in scope, (3) a per-root `exclude` key is rejected loudly, not ignored.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge.scope import ScopeError, resolve_scope  # noqa: E402

SCOPE_FILE = ROOT / "docs" / "process" / "memory-ingest-scope.json"


def _write_scope(tmp_path: Path, doc: dict) -> Path:
    p = tmp_path / "scope.json"
    p.write_text(json.dumps(doc), encoding="utf-8")
    return p


def _make_tree(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "docs" / "audit").mkdir(parents=True)
    (root / "docs" / "process").mkdir(parents=True)
    # a filename with a DIFFERENT date than the one that caused this bug — the glob must not
    # need editing when a new arc's audit file appears.
    (root / "docs" / "audit" / "2099-01-01-some-other-audit.md").write_text("x", encoding="utf-8")
    (root / "docs" / "audit" / "README.md").write_text("x", encoding="utf-8")
    (root / "docs" / "process" / "development-discipline.md").write_text("x", encoding="utf-8")
    (root / "CLAUDE.md").write_text("x", encoding="utf-8")
    return root


def test_glob_exclusion_drops_the_whole_audit_tree_including_a_future_filename(tmp_path):
    root = _make_tree(tmp_path)
    scope_file = _write_scope(tmp_path, {
        "roots": [{"path": "docs", "patterns": ["**/*.md"]}],
        "exclude": ["docs/audit/**"],
    })
    out = resolve_scope(scope_file, root)
    assert "docs/audit/2099-01-01-some-other-audit.md" not in out
    assert "docs/audit/README.md" not in out


def test_ordinary_documents_stay_in_scope(tmp_path):
    root = _make_tree(tmp_path)
    scope_file = _write_scope(tmp_path, {
        "roots": [{"path": "docs", "patterns": ["**/*.md"]}],
        "exclude": ["docs/audit/**"],
    })
    out = resolve_scope(scope_file, root)
    assert "docs/process/development-discipline.md" in out


def test_exact_path_exclusion_still_works(tmp_path):
    """Backward compatibility: a plain repo-relative path with no wildcard excludes only itself."""
    root = _make_tree(tmp_path)
    scope_file = _write_scope(tmp_path, {
        "roots": [{"path": "docs", "patterns": ["**/*.md"]}],
        "exclude": ["docs/audit/README.md"],
    })
    out = resolve_scope(scope_file, root)
    assert "docs/audit/README.md" not in out
    assert "docs/audit/2099-01-01-some-other-audit.md" in out


def test_per_root_exclude_key_is_rejected_not_silently_ignored(tmp_path):
    root = _make_tree(tmp_path)
    scope_file = _write_scope(tmp_path, {
        "roots": [{"path": "docs", "patterns": ["**/*.md"], "exclude": ["audit/**"]}],
    })
    with pytest.raises(SystemExit):
        resolve_scope(scope_file, root)


def test_real_repo_scope_excludes_the_audit_file_and_keeps_real_docs():
    """RED-first regression against the actual committed scope file: this is the exact bug."""
    out = resolve_scope(SCOPE_FILE, ROOT)
    assert not any(p.startswith("docs/audit/") and p != "docs/audit/README.md" for p in out), (
        "a generated audit transcript is in the ingest scope — the exclude did nothing"
    )
    assert "docs/process/development-discipline.md" in out
    # CLAUDE.md ships via the scope file's separate `top_level_files` key, which neither the old
    # nor the new resolver reads (pre-existing, out of scope for this fix) — app.js is the
    # top-of-repo file the `roots` walk actually covers, so it stands in as the "real document
    # stays in scope" check instead.
    assert "app.js" in out
