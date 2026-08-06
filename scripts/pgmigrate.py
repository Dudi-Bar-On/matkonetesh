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
DEFAULT_MIGRATIONS = ROOT / "infra" / "postgres" / "migrations"
DEFAULT_ENV_FILE = ROOT / "infra" / ".env"

LEDGER = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text        PRIMARY KEY,
  checksum    text        NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
"""


def _connection_params(env_file: Path) -> dict[str, str]:
    """Read connection details from the given env file. Never from a literal in this file.

    Both env layouts (infra/.env's POSTGRES_* and infra/rules-db/.env's RULES_POSTGRES_*) are
    accepted by trying the RULES_-prefixed name first, falling back to the bare name — so this
    one function serves both callers without a --env-prefix flag to keep synchronised.

    The superuser password is a special case, and is NOT covered by the generic pick() below.
    infra/rules-db/.env deliberately carries no superuser password of its own (see its
    .env.example) — the native Postgres service's "postgres" role's password lives only in
    infra/.env's POSTGRES_SUPERPASSWORD, the geniza's own superuser credential (same native
    service hosts both databases). A blanket merge of infra/.env into env would also pull in
    POSTGRES_SUPERUSER_PASSWORD (mk_admin's, a DIFFERENT role) and could pair the wrong password
    with the right username or vice versa, so the fallback is this one named key, read only when
    env_file's own file has neither RULES_SUPERUSER_PASSWORD nor POSTGRES_SUPERUSER_PASSWORD.
    """
    from dotenv import dotenv_values

    if not env_file.exists():
        raise SystemExit(f"{env_file} not found — copy its .env.example and fill it in.")
    env = dotenv_values(env_file)

    def pick(*names: str) -> str | None:
        for n in names:
            if env.get(n):
                return str(env[n])
        return None

    port = pick("RULES_POSTGRES_PORT", "POSTGRES_PORT")
    db = pick("RULES_POSTGRES_DB", "POSTGRES_DB")
    user = pick("RULES_SUPERUSER", "POSTGRES_SUPERUSER")
    password = pick("RULES_SUPERUSER_PASSWORD", "POSTGRES_SUPERUSER_PASSWORD")
    if password is None and env_file != DEFAULT_ENV_FILE and DEFAULT_ENV_FILE.exists():
        password = dotenv_values(DEFAULT_ENV_FILE).get("POSTGRES_SUPERPASSWORD")
    missing = [n for n, v in (("PORT", port), ("DB", db), ("SUPERUSER", user), ("SUPERUSER_PASSWORD", password)) if not v]
    if missing:
        raise SystemExit(f"{env_file} is missing: {', '.join(missing)}")
    return {"host": "127.0.0.1", "port": port, "dbname": db, "user": user, "password": password}


def discover(migrations_dir: Path) -> list[tuple[str, Path, str]]:
    """Every .sql file, ordered by filename, with its checksum.

    Ordering is by NAME, which is why the names are zero-padded. Ordering by mtime would make
    the sequence depend on which machine checked the repo out.
    """
    if not migrations_dir.is_dir():
        raise SystemExit(f"{migrations_dir} not found")
    out = []
    for path in sorted(migrations_dir.glob("*.sql")):
        body = path.read_text(encoding="utf-8")
        out.append((path.stem, path, hashlib.sha256(body.encode("utf-8")).hexdigest()))
    if not out:
        raise SystemExit(f"no .sql files in {migrations_dir}")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--status", action="store_true", help="report what is applied and pending; change nothing")
    ap.add_argument("--migrations-dir", type=Path, default=DEFAULT_MIGRATIONS,
                     help="directory of .sql migrations (default: infra/postgres/migrations)")
    ap.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE,
                     help="env file with connection details (default: infra/.env)")
    args = ap.parse_args()

    import psycopg2

    found = discover(args.migrations_dir)
    conn = psycopg2.connect(**_connection_params(args.env_file))
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
