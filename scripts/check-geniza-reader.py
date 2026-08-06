"""check-geniza-reader — proves the geniza's PostgreSQL actually answers, through the same
read-only accessor every retrieval tool uses (src.knowledge.config.connect_reader), not a raw TCP
probe and not a container exec.

WHY THIS EXISTS (watchman Task 19, revised after a live coordinator review): the geniza's Postgres
moved off Docker onto the native Windows service `postgresql-x64-18` on 2026-08-06 (see CLAUDE.md
and infra/.env, whose POSTGRES_PORT now points at the native service's port, 5432 -- the same port
Task 18's mk_rules-postgres component already monitors). A component that ran `docker exec
mk-postgres pg_isready` was testing a leftover, superseded container, not the live store -- see
this task's report for the full incident. This script tests the real thing instead: a genuine SELECT
against a real table (document_revisions), executed through the exact reader connection every other
tool in this repository depends on, so what this component verifies is what consumers actually read.

READ-ONLY, always. connect_reader() returns a connection psycopg2 has put in `readonly` session
mode (see src/knowledge/config.py) -- this script does not, and structurally cannot, write.

Prints one machine-readable `RESULT=<ok|fail>` line (matching check-rules-mirror.mjs's convention --
watchman.ps1 matches on that line, never on prose) and exits 0/1 to match.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from src.knowledge import config

    conn = config.connect_reader(timeout=5)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM document_revisions")
            (row_count,) = cur.fetchone()
    finally:
        conn.close()
except Exception as exc:  # noqa: BLE001 - deliberately broad: any failure here means NOT OK
    print(f"FAIL: could not read document_revisions through the geniza reader -- {type(exc).__name__}: {exc}")
    print("RESULT=fail")
    sys.exit(1)

if row_count <= 0:
    # Connects fine but the table is empty -- distinguishable from "cannot connect at all", and
    # both are correctly NOT OK: an empty geniza is not a working geniza.
    print(f"FAIL: connected, but document_revisions has {row_count} row(s) -- the geniza looks empty.")
    print("RESULT=fail")
    sys.exit(1)

print(f"OK - geniza reader answered ({row_count} document_revisions row(s)).")
print("RESULT=ok")
sys.exit(0)
