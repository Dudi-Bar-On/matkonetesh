#!/usr/bin/env python
"""Remove graphify's OWN documentation from agent memory (owner instruction, 2026-08-04).

    python scripts/purge_graphify_docs.py [--dry-run]

SCOPE, drawn deliberately narrow. The store holds three different things that all touch the
word "graphify", and only one of them is graphify's documentation:

  1. **graphify's own docs** — `graphify-docs-01/02/03` sections inside the `vendor-docs`
     corpus, and its command/config entries inside `methodology` (Graphify Query, Graphify
     Auto-Update, Graphify Status Freshness Check, /gsd-graphify Command, ...). The tool is
     gone; instructions for driving it are actively misleading. **These are removed.**

  2. **`graph://` records** — 6,818 nodes graphify extracted FROM THIS REPO's own files. The
     largest sources are sources.py (1,236), app.js (1,053) and data.py (356). That is our
     code and our decisions, not graphify's documentation, and deleting it would throw away
     the only structured index we have over the Python/JS side. **Left in place.**

  3. **Historical mentions** in our own documents explaining why graphify was replaced. Those
     are the record of a decision. **Left in place.**

The distinction matters because "remove graphify" read literally would delete category 2 —
6,818 records of our own knowledge — under a sentence that meant category 1.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.memory import AgentMemory, ToolSpec  # noqa: E402

DB = ROOT / "agent-memory.db"


def is_graphify(text: str | None) -> bool:
    return bool(text) and "graphify" in str(text).lower()


def purge(mem: AgentMemory, dry_run: bool = False) -> dict:
    report: dict = {"corpora": {}, "sections_removed": 0, "concepts_removed": 0}

    for spec in mem.list_tool_specs():
        md = dict(spec["metadata"])
        name = md["tool_name"]

        sections = md.get("sections", [])
        concepts = md.get("concepts", [])

        kept_sections = [
            s for s in sections
            if not (is_graphify(s.get("label")) or is_graphify(s.get("source_file")))
        ]
        kept_concepts = [c for c in concepts if not is_graphify(c)]

        dropped_s = len(sections) - len(kept_sections)
        dropped_c = len(concepts) - len(kept_concepts)
        if not (dropped_s or dropped_c):
            continue

        report["corpora"][name] = {"sections": dropped_s, "concepts": dropped_c}
        report["sections_removed"] += dropped_s
        report["concepts_removed"] += dropped_c

        if dry_run:
            continue

        md["sections"] = kept_sections
        md["concepts"] = kept_concepts
        md["section_count"] = len(kept_sections)
        md["concept_count"] = len(kept_concepts)
        md["purged_graphify_at"] = "2026-08-04"
        md["purged_graphify_counts"] = {"sections": dropped_s, "concepts": dropped_c}

        content = "\n".join(
            [line for line in spec["content"].split("\n") if not is_graphify(line)]
        )
        mem.upsert_tool_spec(
            ToolSpec(tool_name=name, content=content, metadata=md),
            file_path=spec["file_path"],
        )

    return report


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with AgentMemory(DB) as mem:
        before = mem.conn.execute(
            "SELECT COUNT(*) n FROM agent_memory WHERE file_path LIKE 'graph://%'"
        ).fetchone()["n"]

        rep = purge(mem, args.dry_run)
        print(json.dumps(rep, ensure_ascii=False, indent=1))

        after = mem.conn.execute(
            "SELECT COUNT(*) n FROM agent_memory WHERE file_path LIKE 'graph://%'"
        ).fetchone()["n"]
        print(f"\ngraph:// project-knowledge records: {before} -> {after} (deliberately untouched)")

        # Prove the removal, rather than asserting it.
        left = 0
        for spec in mem.list_tool_specs():
            md = spec["metadata"]
            left += sum(1 for s in md.get("sections", []) if is_graphify(s.get("label")))
            left += sum(1 for c in md.get("concepts", []) if is_graphify(c))
        print(f"graphify entries still inside any tool_spec: {left}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
