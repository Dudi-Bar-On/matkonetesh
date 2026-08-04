#!/usr/bin/env python
"""Keep the agent-memory store current with the repo's documentation.

    python scripts/memsync.py            # ingest changed docs (delta by content hash)
    python scripts/memsync.py --status   # what is in the store
    python scripts/memsync.py --force    # re-ingest everything
    python scripts/memsync.py --query "<text>"      # search document chunks
    python scripts/memsync.py --tool <name>         # exact tool_spec lookup

This replaces `graphify update` (owner decision, 2026-08-04). The difference that matters is
cost: the graph rebuild was an out-of-process LLM pass over a 22 MB JSON artifact, so it was
never run often enough to be current — its freshness gate failed 8 of 8 CI runs and stood at
115 stale documents. This walks the tree, hashes each file, and skips everything unchanged.
A no-op sync is milliseconds, which is the only reason a gate on it can ever be green.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.memory import AgentMemory, DocChunk, ToolSpec, sha256_text  # noqa: E402

DB = ROOT / "agent-memory.db"
SEED_DIR = ROOT / "docs" / "agent-memory-seed"
TOP_LEVEL_DOCS = ["CLAUDE.md", "README.md"]


def _load_seed(name: str) -> list:
    p = SEED_DIR / f"{name}.json.gz"
    if not p.exists():
        return []
    with gzip.open(p, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


def seed(mem: AgentMemory) -> dict:
    """Load the versioned seed — the knowledge that did NOT come from a live .md file.

    `agent-memory.db` is gitignored on purpose: it is a build artifact. That only works if the
    store is reproducible from the repo, and two populations are not: the nine vendor/technology
    `tool_spec` corpora, and the knowledge migrated out of the retired graph. Both are committed
    here as gzipped JSON — 0.64 MB together, against the 22 MB graphify-out/ they replace.

    Idempotent: every write is an upsert keyed on identity, so re-seeding changes nothing.
    """
    tools = _load_seed("tool-specs")
    for t in tools:
        mem.upsert_tool_spec(ToolSpec(t["tool_name"], t["content"], t["metadata"]), file_path="seed")

    graph = _load_seed("graph-knowledge")
    for r in graph:
        md = dict(r["metadata"])
        mem.upsert_doc_chunk(
            DocChunk(
                file_path=r["file_path"],
                chunk_index=md.get("chunk_index", 0),
                heading=md.get("heading", ""),
                heading_path=tuple(md.get("heading_path", [])),
                level=md.get("level", 1),
                content=r["content"],
            ),
            file_hash=sha256_text("seed"),
            extra_metadata={k: v for k, v in md.items() if k not in ("chunk_index", "heading", "heading_path", "level")},
        )
    return {"tool_specs": len(tools), "graph_records": len(graph)}


def sync(force: bool = False) -> dict:
    with AgentMemory(DB) as mem:
        # A fresh clone has no store at all; seed it before the first ingest so a new machine
        # gets the same memory an established one has, not a subset of it.
        if not mem.list_tool_specs():
            s = seed(mem)
            print(f"[memsync] seeded {s['tool_specs']} tool specs · {s['graph_records']} migrated records")
        tally = mem.ingest_markdown_tree(ROOT / "docs", rel_to=ROOT, force=force)
        for name in TOP_LEVEL_DOCS:
            p = ROOT / name
            if p.exists():
                res = mem.ingest_markdown(p, rel_path=name, force=force)
                tally[res["status"]] += 1
                tally["chunks"] += res["chunks"]
        return tally


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--query")
    ap.add_argument("--tool")
    ap.add_argument("--limit", type=int, default=10)
    args = ap.parse_args()

    if args.status:
        with AgentMemory(DB) as mem:
            s = mem.stats()
            print(json.dumps(s, ensure_ascii=False, indent=1))
            print("tools:", ", ".join(t["metadata"]["tool_name"] for t in mem.list_tool_specs()))
        return 0

    if args.tool:
        with AgentMemory(DB) as mem:
            spec = mem.get_tool_spec(args.tool)
            if not spec:
                print(f"no tool_spec named {args.tool!r}")
                print("known:", ", ".join(t["metadata"]["tool_name"] for t in mem.list_tool_specs()))
                return 1
            md = spec["metadata"]
            print(f"{md['tool_name']}: {md.get('node_count')} nodes, {md.get('section_count')} sections")
            for u in md.get("urls", [])[:10]:
                print("  -", u)
        return 0

    if args.query:
        with AgentMemory(DB) as mem:
            for hit in mem.query_docs(text=args.query, limit=args.limit):
                head = hit["metadata"].get("heading") or "(preamble)"
                body = " ".join(hit["content"].split())[:140]
                print(f"{hit['file_path']} § {head}\n    {body}\n")
        return 0

    tally = sync(force=args.force)
    print(f"[memsync] ingested {tally['ingested']} · skipped {tally['skipped']} · {tally['chunks']} chunks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
