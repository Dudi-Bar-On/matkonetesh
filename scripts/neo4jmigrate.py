"""Create the Neo4j constraints and indexes, from the allowlist, before any data is loaded.

The prompt: "Create constraints and indexes for stable identifiers before loading data."

WHY THIS IS GENERATED RATHER THAN A .cypher FILE.

The constraints are one per allowed label, and the allowed labels already live in
src/knowledge/graph_schema.py, where the write gate reads them. Writing them out a second time by
hand creates two lists that must agree and no mechanism that makes them — which is precisely how a
label ends up enforced in one place and not the other. Generating them means adding a label to the
tuple is the whole change.

Everything here is IF NOT EXISTS, so running it twice is a no-op. That is what makes it safe to
run at the start of the worker as well as by hand.

Usage:
    python scripts/neo4jmigrate.py            # create anything missing
    python scripts/neo4jmigrate.py --status   # report, change nothing
"""

from __future__ import annotations

import argparse
import sys

sys.stdout.reconfigure(encoding="utf-8")  # L74: prints carry "·"; Windows pipes stdout as cp1252

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge.graph_schema import ALLOWED_LABELS  # noqa: E402

ENV_FILE = ROOT / "infra" / ".env"

# Properties every node carries, per the prompt. Indexed because they are what queries filter on:
# namespace scopes a corpus, status separates current from superseded.
INDEXED_NODE_PROPERTIES = ("namespace", "status")


def statements() -> list[tuple[str, str]]:
    """(name, cypher) for every constraint and index, derived from the allowlist."""
    out: list[tuple[str, str]] = []
    for label in ALLOWED_LABELS:
        lower = label.lower()
        # The stable identifier. UNIQUE rather than merely indexed: the prompt requires idempotent
        # upserts, and MERGE on a non-unique key silently creates duplicates under concurrency.
        out.append((
            f"constraint_{lower}_canonical_id_unique",
            f"CREATE CONSTRAINT {lower}_canonical_id_unique IF NOT EXISTS "
            f"FOR (n:{label}) REQUIRE n.canonical_id IS UNIQUE",
        ))
        # Existence constraints are Enterprise-only. On Community the same guarantee is delivered
        # by the write gate in graph_schema.validate_node, which is stated here rather than left
        # as an apparent omission — see infra/README.md, "The Neo4j limitation".
        for prop in INDEXED_NODE_PROPERTIES:
            out.append((
                f"index_{lower}_{prop}",
                f"CREATE INDEX {lower}_{prop}_idx IF NOT EXISTS FOR (n:{label}) ON (n.{prop})",
            ))
    return out


def _driver():
    from dotenv import dotenv_values
    from neo4j import GraphDatabase

    if not ENV_FILE.exists():
        raise SystemExit(f"{ENV_FILE} not found — copy infra/.env.example and fill it in.")
    env = dotenv_values(ENV_FILE)
    missing = [k for k in ("NEO4J_BOLT_PORT", "NEO4J_USER", "NEO4J_PASSWORD") if not env.get(k)]
    if missing:
        raise SystemExit(f"infra/.env is missing: {', '.join(missing)}")
    return GraphDatabase.driver(
        f"bolt://127.0.0.1:{env['NEO4J_BOLT_PORT']}",
        auth=(str(env["NEO4J_USER"]), str(env["NEO4J_PASSWORD"])),
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--status", action="store_true", help="report what exists; change nothing")
    args = ap.parse_args()

    planned = statements()
    driver = _driver()
    try:
        with driver.session() as session:
            existing = {r["name"] for r in session.run("SHOW CONSTRAINTS YIELD name RETURN name")}
            existing |= {r["name"] for r in session.run("SHOW INDEXES YIELD name RETURN name")}

            if args.status:
                have = sum(1 for _n, c in planned if _cypher_object_name(c) in existing)
                print(f"graph schema: {len(planned)} planned · {have} present · {len(planned) - have} missing")
                print(f"  labels on the allowlist: {len(ALLOWED_LABELS)}")
                for _name, cypher in planned:
                    obj = _cypher_object_name(cypher)
                    print(f"  {'+' if obj in existing else ' '} {obj}")
                return 0

            created = 0
            for _name, cypher in planned:
                obj = _cypher_object_name(cypher)
                if obj in existing:
                    continue
                try:
                    session.run(cypher).consume()
                except Exception as exc:
                    # A raw traceback here reads as "the tool is broken". The usual cause is
                    # ordinary and actionable: a uniqueness constraint cannot be created over data
                    # that already contains duplicates, and Neo4j names the offending value. Say
                    # that, and say what to do about it.
                    print(f"  FAILED  {obj}")
                    detail = str(exc)
                    for marker in ("Both Node", "Unable to create"):
                        if marker in detail:
                            snippet = detail[detail.index(marker):].split("}")[0].strip()
                            print(f"    {snippet[:200]}")
                            break
                    else:
                        print(f"    {type(exc).__name__}: {detail[:200]}")
                    print("    A uniqueness constraint cannot be created over existing duplicates.")
                    print("    Resolve the duplicate rows first, then run this again.")
                    return 1
                created += 1
            print(f"graph schema: {created} created · {len(planned)} total "
                  f"({len(ALLOWED_LABELS)} labels x 1 constraint + {len(INDEXED_NODE_PROPERTIES)} indexes)")
            return 0
    finally:
        driver.close()


def _cypher_object_name(cypher: str) -> str:
    """The name Neo4j will register the object under — the token after CONSTRAINT/INDEX."""
    parts = cypher.split()
    for i, token in enumerate(parts):
        if token in ("CONSTRAINT", "INDEX") and i + 1 < len(parts):
            return parts[i + 1]
    return ""


if __name__ == "__main__":
    sys.exit(main())
