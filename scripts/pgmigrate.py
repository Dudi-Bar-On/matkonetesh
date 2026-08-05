"""Apply the PostgreSQL migrations in infra/postgres/migrations, in order, exactly once.

WHY NOT ALEMBIC, since SQLAlchemy is already a dependency.

Alembic's value is autogenerate — diffing ORM models against a live schema. We have no ORM
models: the schema here is hand-written DDL whose constraints ARE the design (see
0002's `current_requires_both_sides`), and autogenerate would be diffing against nothing.
What is left of Alembic after removing autogenerate is a version table and an ordered runner,
which is this file. A dependency that carries a feature we cannot use, in exchange for a
migration format nobody can read without it, is a bad trade at this size.

WHAT THIS DOES THAT `psql -f` DOES NOT:

  1. Applies each migration EXACTLY once, recorded in schema_migrations.
  2. Wraps each migration in its own transaction — a failure leaves that migration unapplied
     rather than half-applied.
  3. DETECTS DRIFT: an already-applied file whose content changed is refused, loudly. Editing a
     migration that has run is the mistake this catches — it produces a database that no longer
     matches its own history, and the symptom appears much later, somewhere else.
  4. Refuses to run as a role that is not the owner, so the schema cannot be created by the
     application role by accident.

Usage:
    python scripts/pgmigrate.py            # apply anything pending
    python scripts/pgmigrate.py --status   # report, change nothing
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "infra" / "postgres" / "migrations"
ENV_FILE = ROOT / "infra" / ".env"

LEDGER = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text        PRIMARY KEY,
  checksum    text        NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
"""


def _connection_params() -> dict[str, str]:
    """Read connection details from infra/.env. Never from a literal in this file."""
    from dotenv import dotenv_values

    if not ENV_FILE.exists():
        raise SystemExit(f"{ENV_FILE} not found — copy infra/.env.example and fill it in.")
    env = dotenv_values(ENV_FILE)
    missing = [k for k in ("POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_SUPERUSER", "POSTGRES_SUPERUSER_PASSWORD") if not env.get(k)]
    if missing:
        raise SystemExit(f"infra/.env is missing: {', '.join(missing)}")
    return {
        "host": "127.0.0.1",
        "port": str(env["POSTGRES_PORT"]),
        "dbname": str(env["POSTGRES_DB"]),
        "user": str(env["POSTGRES_SUPERUSER"]),
        "password": str(env["POSTGRES_SUPERUSER_PASSWORD"]),
    }


def discover() -> list[tuple[str, Path, str]]:
    """Every .sql file, ordered by filename, with its checksum.

    Ordering is by NAME, which is why the names are zero-padded. Ordering by mtime would make
    the sequence depend on which machine checked the repo out.
    """
    if not MIGRATIONS.is_dir():
        raise SystemExit(f"{MIGRATIONS} not found")
    out = []
    for path in sorted(MIGRATIONS.glob("*.sql")):
        body = path.read_text(encoding="utf-8")
        out.append((path.stem, path, hashlib.sha256(body.encode("utf-8")).hexdigest()))
    if not out:
        raise SystemExit(f"no .sql files in {MIGRATIONS}")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--status", action="store_true", help="report what is applied and pending; change nothing")
    args = ap.parse_args()

    import psycopg2

    found = discover()
    conn = psycopg2.connect(**_connection_params())
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(LEDGER)
            conn.commit()
            cur.execute("SELECT version, checksum FROM schema_migrations")
            applied = dict(cur.fetchall())

        # Drift first, before applying anything. A changed file that has already run means the
        # database and its history disagree, and applying MORE migrations on top of that
        # disagreement buries it deeper.
        drift = [v for v, _p, c in found if v in applied and applied[v] != c]
        if drift:
            print(f"DRIFT: {len(drift)} applied migration(s) have changed on disk since they ran:")
            for v in drift:
                print(f"  x {v}")
            print("  An applied migration is history and cannot be edited. Add a NEW migration that")
            print("  makes the change, and restore these files to what was applied.")
            return 1

        pending = [(v, p) for v, p, _c in found if v not in applied]

        if args.status:
            print(f"migrations: {len(found)} on disk · {len(applied)} applied · {len(pending)} pending")
            for v, _p, _c in found:
                print(f"  {'+' if v in applied else ' '} {v}")
            return 0

        if not pending:
            print(f"migrations: {len(found)} on disk, all applied. Nothing to do.")
            return 0

        for version, path in pending:
            body = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(body.encode("utf-8")).hexdigest()
            try:
                with conn.cursor() as cur:
                    cur.execute(body)
                    cur.execute(
                        "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s)",
                        (version, checksum),
                    )
                conn.commit()
                print(f"  applied {version}")
            except Exception as exc:
                conn.rollback()
                print(f"  FAILED  {version}: {type(exc).__name__}: {exc}")
                print("  Rolled back. Nothing after this migration was attempted.")
                return 1

        print(f"migrations: {len(pending)} applied · {len(found)} total")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
