"""check-neo4j-reader -- proves the graph's Neo4j actually answers, through the same driver
factory every graph-facing tool uses (src.knowledge.config.neo4j_driver), not a port probe and
not a service-status check.

WHY THIS EXISTS (watchman Task 10, the seventh component): a listening bolt socket proves nothing
about whether the database opened its store, holds a schema, or has any content -- Neo4j can accept
TCP connections while still recovering, or while the graph is empty. This script runs a real Cypher
query (a node count) over a real session, the same way find_impact/find_dependency_path do, so what
this component verifies is what consumers actually read.

Prints one machine-readable `RESULT=<ok|fail>` line (matching check-rules-mirror.mjs and
check-geniza-reader.py's convention -- watchman.ps1 matches on that line, never on prose) and
exits 0/1 to match.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from src.knowledge import config

    driver = config.neo4j_driver()
    try:
        with driver.session() as session:
            record = session.run("MATCH (n) RETURN count(n) AS node_count").single()
            node_count = record["node_count"] if record else 0
    finally:
        driver.close()
except Exception as exc:  # noqa: BLE001 - deliberately broad: any failure here means NOT OK
    print(f"FAIL: could not read node count through the neo4j driver -- {type(exc).__name__}: {exc}")
    print("RESULT=fail")
    sys.exit(1)

if node_count <= 0:
    # Connects and queries fine but the graph is empty -- distinguishable from "cannot connect at
    # all", and both are correctly NOT OK: an empty graph is not a working graph.
    print(f"FAIL: connected, but MATCH (n) returned {node_count} node(s) -- the graph looks empty.")
    print("RESULT=fail")
    sys.exit(1)

print(f"OK - neo4j reader answered ({node_count} node(s)).")
print("RESULT=ok")
sys.exit(0)
