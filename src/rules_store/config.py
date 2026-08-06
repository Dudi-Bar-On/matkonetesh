"""Connections to mk_rules — the native-Windows-service PostgreSQL database that holds rule
revisions (spec §4.1). Deliberately a SEPARATE module from src.knowledge.config: mk_rules is a
separate database on a separate service (owner decision, spec §4.1 — "DB נפרד, לא סכימה בתוך
הגניזה"), and the two must be able to fail independently.

Same reader/writer split as the geniza: connect_reader() has no write verb, so the three gates and
any deep-audit agent that ends up calling this cannot write even by accident.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"


class ConfigError(RuntimeError):
    """mk_rules is not configured. Raised with what is missing, never a bare failure."""


@dataclass(frozen=True)
class StackConfig:
    pg_port: str
    pg_db: str
    reader_user: str
    reader_password: str
    app_user: str
    app_password: str


@lru_cache(maxsize=1)
def load_config() -> StackConfig:
    """Read infra/rules-db/.env. Environment variables win, so CI can supply them without a file.

    Never returns a partially-filled config: a missing credential is reported by name, because
    "connection refused" three layers down is a much more expensive way to learn the same thing.
    """
    from dotenv import dotenv_values

    values: dict[str, Any] = {}
    if ENV_FILE.exists():
        values.update({k: v for k, v in dotenv_values(ENV_FILE).items() if v})
    values.update({k: v for k, v in os.environ.items() if k in _EXPECTED and v})

    missing = [k for k in _EXPECTED if not values.get(k)]
    if missing:
        raise ConfigError(
            "mk_rules is not configured — missing: " + ", ".join(missing)
            + f". Copy infra/rules-db/.env.example to {ENV_FILE} and fill it in."
        )
    return StackConfig(
        pg_port=str(values["RULES_POSTGRES_PORT"]),
        pg_db=str(values["RULES_POSTGRES_DB"]),
        reader_user="rules_reader",
        reader_password=str(values["RULES_READER_PASSWORD"]),
        app_user="rules_app",
        app_password=str(values["RULES_APP_PASSWORD"]),
    )


_EXPECTED = ("RULES_POSTGRES_PORT", "RULES_POSTGRES_DB", "RULES_READER_PASSWORD", "RULES_APP_PASSWORD")


def connect_reader(timeout: int = 10):
    """A PostgreSQL connection that CANNOT write. The default for every retrieval path."""
    import psycopg2

    cfg = load_config()
    conn = psycopg2.connect(
        host="127.0.0.1", port=cfg.pg_port, dbname=cfg.pg_db,
        user=cfg.reader_user, password=cfg.reader_password, connect_timeout=timeout,
    )
    conn.set_session(readonly=True)
    return conn


def connect_writer(timeout: int = 10):
    """A PostgreSQL connection that can write DATA. Still cannot change the schema (0002 revokes
    CREATE from rules_app, matching the geniza's 0005_revoke_create_from_mk_app.sql)."""
    import psycopg2

    cfg = load_config()
    return psycopg2.connect(
        host="127.0.0.1", port=cfg.pg_port, dbname=cfg.pg_db,
        user=cfg.app_user, password=cfg.app_password, connect_timeout=timeout,
    )
