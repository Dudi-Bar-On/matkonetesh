#!/usr/bin/env python
"""Tier 2 — enrich agent memory with local-GPU embeddings. Never blocks a commit.

    python scripts/memenrich.py                  # embed what is missing (resumable)
    python scripts/memenrich.py --status         # coverage
    python scripts/memenrich.py --search "..."   # hybrid: exact + semantic, fused

See src/memory/enrich.py for why this is a separate tier from memsync.py: an embedding pass is
~12 minutes for the full store, and a commit gate that costs twelve minutes is the exact
failure mode that killed graphify.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.memory import AgentMemory  # noqa: E402
from src.memory.enrich import (  # noqa: E402
    EMBED_MODEL,
    coverage,
    embed_pending,
    hybrid_search,
    ollama_available,
)

DB = ROOT / "agent-memory.db"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--search")
    ap.add_argument("--limit", type=int, default=6)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--max", type=int, help="embed at most N nodes this run")
    args = ap.parse_args()

    with AgentMemory(DB) as mem:
        if args.status:
            c = coverage(mem)
            print(f"model      : {EMBED_MODEL} ({'reachable' if ollama_available() else 'UNREACHABLE'})")
            print(f"coverage   : {c['embedded']}/{c['nodes']} in-scope nodes ({c['pct']}%)")
            if c['out_of_scope']:
                print(f"             + {c['out_of_scope']} vector(s) for out-of-scope rows (harmless, not counted)")
            return 0

        if args.search:
            res = hybrid_search(mem, args.search, limit=args.limit)
            print(f"query: {res['query']}   exact={res['exact_hits']} semantic={res['semantic_hits']}")
            if res["degraded"]:
                print(f"  ! {res['note']}")
            for r in res["results"]:
                hp = r["metadata"].get("header_path", "/")
                print(f"\n  [{r['how']:8s} {r['score']}] {r['file_path']} § {hp[:60]}")
                print("      " + " ".join(r["content"].split())[:130])
            return 0

        def show(done, total):
            print(f"  {done}/{total} ({100*done//total}%)", end="\r", flush=True)

        res = embed_pending(mem, batch=args.batch, limit=args.max, progress=show)
        print()
        if res["status"] == "unavailable":
            print(f"[memenrich] SKIPPED — {res['reason']}")
            print("            tier 1 is unaffected; search degrades to exact matching.")
            return 0
        print(f"[memenrich] {res['status']}: {res['embedded']} nodes")
        if res.get("truncated"):
            print(f"            {res['truncated']} node(s) exceeded the model window and were halved to fit")
        print(f"            coverage now {coverage(mem)['pct']}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
