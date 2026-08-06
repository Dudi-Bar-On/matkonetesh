# scripts/provision_rules_db.py
"""Idempotent, one-time provisioning of the mk_rules database and its two roles.

Run once after PostgreSQL 18.4 is installed as a native Windows service (Task 1, Step 4) and
infra/rules-db/.env is filled in:

    py -3 scripts/provision_rules_db.py

Safe to re-run: every statement checks existence first. Never embeds a password in a committed
file — passwords are read from infra/rules-db/.env at runtime and applied via ALTER ROLE, the same
division the geniza's infra/postgres/init/02-set-role-passwords.sh uses for the Docker case.

The superuser credential is a special case: it is used ONLY here, ONLY to create the database and
roles, and it already exists as POSTGRES_SUPERPASSWORD in infra/.env (the geniza's own superuser
credential — the same native PostgreSQL 18.4 service hosts both databases). It is deliberately NOT
duplicated into infra/rules-db/.env, so the superuser credential exists in exactly one file.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"
SUPERUSER_ENV_FILE = ROOT / "infra" / ".env"


def _env() -> dict[str, str]:
    from dotenv import dotenv_values

    if not ENV_FILE.exists():
        raise SystemExit(f"{ENV_FILE} not found — copy infra/rules-db/.env.example and fill it in.")
    env = dotenv_values(ENV_FILE)
    required = ("RULES_POSTGRES_PORT", "RULES_POSTGRES_DB", "RULES_SUPERUSER",
                "RULES_APP_PASSWORD", "RULES_READER_PASSWORD")
    missing = [k for k in required if not env.get(k)]
    if missing:
        raise SystemExit(f"infra/rules-db/.env missing: {', '.join(missing)}")

    if not SUPERUSER_ENV_FILE.exists():
        raise SystemExit(f"{SUPERUSER_ENV_FILE} not found — the geniza's superuser credential lives there.")
    superuser_env = dotenv_values(SUPERUSER_ENV_FILE)
    superpassword = superuser_env.get("POSTGRES_SUPERPASSWORD")
    if not superpassword:
        raise SystemExit("infra/.env missing POSTGRES_SUPERPASSWORD")

    result = {k: str(v) for k, v in env.items()}
    result["RULES_SUPERUSER_PASSWORD"] = str(superpassword)
    return result


def main() -> int:
    import psycopg2
    from psycopg2 import sql

    env = _env()
    admin_dsn = dict(host="127.0.0.1", port=env["RULES_POSTGRES_PORT"], dbname="postgres",
                      user=env["RULES_SUPERUSER"], password=env["RULES_SUPERUSER_PASSWORD"])

    conn = psycopg2.connect(**admin_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (env["RULES_POSTGRES_DB"],))
            if not cur.fetchone():
                cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(env["RULES_POSTGRES_DB"])))
                print(f"created database {env['RULES_POSTGRES_DB']}")
            else:
                print(f"database {env['RULES_POSTGRES_DB']} already exists")

            for role, pw_key in (("rules_app", "RULES_APP_PASSWORD"), ("rules_reader", "RULES_READER_PASSWORD")):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,))
                if not cur.fetchone():
                    cur.execute(sql.SQL("CREATE ROLE {} LOGIN").format(sql.Identifier(role)))
                    print(f"created role {role}")
                cur.execute(
                    sql.SQL("ALTER ROLE {} WITH PASSWORD %s").format(sql.Identifier(role)),
                    (env[pw_key],),
                )
                print(f"password set for {role}")
    finally:
        conn.close()

    print("provisioning complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
