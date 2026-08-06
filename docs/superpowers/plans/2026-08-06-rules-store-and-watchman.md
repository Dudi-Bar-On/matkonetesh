# Rules Store and Watchman — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**SCOPE OF THIS PLAN.** The approved spec (`docs/superpowers/specs/2026-08-06-process-enforcement-design.md`)
describes six build phases (§10). **This plan covers Phase 1 (§4 — the `mk_rules` knowledge layer) and
Phase 2 (§8 — layer 0, the watchman) only.** Phase 3 (Group A deterministic hooks), Phase 4 (Group B state
counters), Phase 5 (Group C judge), and Phase 6 (wiring `/enforce` · `SessionStart` · pre-commit) are **out
of scope** and get their own plan later, once this one has shipped and been used — per the spec's own §10
table ("עצירה אחרי כל שלב משאירה מערכת שלמה, לא חצי מערכת"). Nothing here registers a gate into
`scripts/check-meta.mjs`, `.githooks/pre-commit`, or `.claude/settings.json` — the three new gates and the
watchman are built and independently runnable, not wired into the enforcement path yet. That wiring is
explicitly Phase 6.

**Goal:** Build the `mk_rules` PostgreSQL store (native Windows service, independent of the WSL/Docker
geniza stack), its one-way `rules.sqlite` mirror, the extractor+builder that keeps both derived from
`docs/process/development-discipline.md` on disk, the three freshness/mirror/completeness gates, and a
watchman (`scripts/watchman.ps1`) that detects and automatically recovers six infrastructure components
with verified (not assumed) success reporting.

**Architecture:** Postgres (`mk_rules` database, native service, port 5432) is the source of derived truth
for rule revisions; `rules.sqlite` is a read-only mirror hooks will eventually consult without needing
Docker or a network round-trip. An extractor (`src/rules_store/extractor.py`) parses the discipline
document's four rule shapes (numbered §-sections, DoD checklist items, H-rulings, lessons) into records; a
builder (`src/rules_store/builder.py`) syncs each record through a fixed four-step write order so a crash
mid-way leaves a rule inactive, never half-active — enforced additionally by a database CHECK constraint.
Three Node gates (no new dependencies, matching `check-geniza-fresh.mjs`'s house style: self-healing,
blocking, "detects/does NOT detect", SKIPS loudly when Postgres is unreachable) verify freshness, mirror
integrity, and completeness. `scripts/watchman.ps1` extends the proven recovery pattern from
`scripts/run-extraction.ps1` (`wsl -u root` for the Docker daemon, poll until the component actually
answers) to six components, each with its own detect/recover/verify triple, JSON success reporting, and a
severity (warn/block) drawn from the spec's severity test (§2, §8.1).

**Tech Stack:** PostgreSQL 18.4 (native Windows service, port 5432) for `mk_rules`; SQLite (stdlib
`sqlite3`, both Python and Node's `node:sqlite`) for the mirror; Python 3.14 via `py -3` for the
extractor/builder/CLI; Node ESM (no new dependencies) for the gates; PowerShell for the watchman, following
`scripts/run-extraction.ps1`'s and `scripts/serena-server.ps1`'s existing conventions.

## Global Constraints

- PostgreSQL 18.4, **native Windows service** (NOT the WSL/Docker container that hosts the geniza's
  `mk-postgres`), port **5432** — the SAME native service that now hosts the geniza's `mk_knowledge`,
  as a separate DATABASE beside it. **CORRECTED 2026-08-06 by the controller:** the plan's first draft
  said the geniza still lives on Docker at 5433 and framed this as separate failure domains. That was
  false — the geniza was migrated to the native service on 5432 earlier the same day (`infra/.env` reads
  `POSTGRES_PORT=5432`; the 5433 container holds a superseded copy). A separate SERVER was never asked
  for and would be over-engineering; the owner asked for a separate **DB** ("עדיף db נפרד"), which a
  second database on the same server satisfies. Independence from a Postgres outage is provided by
  `rules.sqlite`, not by a second server — that is the whole point of the mirror
  down with it.
- pgvector 0.8.6 — provisioned on the `mk_rules` database for future semantic rule search even though no
  table in this plan uses it yet (see Task 3).
- Node ESM, **no new dependencies** for any gate script.
- Python 3.14 via `py -3` — **NEVER bare `python`**: on this machine it resolves to the Microsoft Store
  alias and exits 9009 (lesson L59). Every Python invocation in this plan, in scripts and in commands, uses
  `py -3`.
- Hebrew body text with English identifiers in any document this plan creates.
- No gate may be weakened to pass. No bypass mechanism may be introduced (spec §2.1) — nothing in this plan
  adds a `*_SKIP_*` environment variable or an equivalent escape hatch.
- Secrets never enter the repo — `infra/rules-db/.env` is gitignored like `infra/.env`; only
  `infra/rules-db/.env.example` (variable names, no values) is committed.

---

## File Structure

| File | Responsibility |
|---|---|
| `infra/rules-db/.env.example` | Variable names for the native `mk_rules` service connection (no values). |
| `infra/rules-db/migrations/0001_rule_revisions.sql` | `rule_revisions` + `rule_probes` schema, `current_requires_mirror`, `one_current_revision_per_rule`, `CREATE EXTENSION vector`. |
| `infra/rules-db/migrations/0002_roles_and_grants.sql` | `rules_app` (write) / `rules_reader` (read-only) roles and grants, mirroring the geniza's `mk_app`/`mk_reader` doctrine. |
| `scripts/pgmigrate.py` (MODIFY) | Gains `--migrations-dir` and `--env-file` flags so the existing runner can apply the new migrations without duplicating its logic. |
| `scripts/provision_rules_db.py` | One-time, idempotent: creates the `mk_rules` database and the two roles, sets their passwords from `infra/rules-db/.env`. Never embeds a secret in a committed file. |
| `src/rules_store/__init__.py` | Package marker. |
| `src/rules_store/config.py` | `StackConfig`, `connect_reader()`, `connect_writer()` for `mk_rules` — mirrors `src/knowledge/config.py`'s reader/writer split. |
| `src/rules_store/mirror.py` | `rules.sqlite` schema (`open_mirror`, `write_revision`, `read_current`, `checksum`). |
| `src/rules_store/extractor.py` | `extract_rules(text: str) -> list[RuleRecord]` — the four rule-shape parsers. |
| `src/rules_store/builder.py` | `sync_rule()` (four-step write order), `sync_document()` (lifecycle: added/updated/unchanged/retired), `rebuild_mirror_from_postgres()`. |
| `scripts/build_rules_store.py` | CLI: `py -3 scripts/build_rules_store.py --doc <path>` and `--rebuild-mirror-only`. |
| `scripts/check-rules-fresh.mjs` | Gate: every rule-shaped section on disk matches its `source_hash` in `mk_rules`. |
| `scripts/check-rules-mirror.mjs` | Gate: `rules.sqlite` checksum matches `mk_rules`'s current rows. |
| `scripts/check-rules-complete.mjs` | Gate: every rule the extractor finds on disk has a row in `mk_rules`. |
| `scripts/watchman.ps1` | Layer 0: `Invoke-ComponentCheck` engine + six components (hooks, rules mirror, `mk_rules` Postgres, geniza Docker/Postgres, ollama, serena), success reporting, `.superpowers/watchman-log.jsonl`. |
| `scripts/tests/test-rules-extractor.py` | Unit tests for the four extractor shapes (no database needed). |
| `scripts/tests/test-rules-builder.py` | Unit tests for write order, crash simulation, lifecycle transitions, disk-not-git (needs a live `mk_rules`; documented as such). |
| `scripts/tests/test-watchman-engine.mjs` | Node-driven test of `Invoke-ComponentCheck`'s retry/recovery loop using stub executables on a temp `PATH` — no real infrastructure touched. |

---

## Task 1: Provision the native `mk_rules` PostgreSQL service

**Files:**
- Create: `infra/rules-db/.env.example`
- Create: `infra/rules-db/migrations/` (empty dir, populated in Task 3)
- Create: `scripts/provision_rules_db.py`
- Test: `scripts/tests/test-provision-rules-db.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a reachable PostgreSQL 18.4 service at `127.0.0.1:5432`, database `mk_rules`, roles
  `rules_app` (LOGIN, password from env) and `rules_reader` (LOGIN, password from env, no write grants —
  granted in Task 3's migration 0002). `provision_rules_db.main() -> int` (exit code), idempotent — safe
  to re-run.

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test-provision-rules-db.py
"""RED: before the native service exists / before provisioning has run, connecting as the
superuser to database `mk_rules` must fail. This is the observable precondition the provisioning
step removes."""
import socket
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))


def test_port_5432_not_yet_serving_mk_rules():
    """Fails loudly (not skips) until Task 1's manual provisioning step has run — this is the RED
    the human implementer witnesses before installing the service."""
    import psycopg2
    from dotenv import dotenv_values

    env = dotenv_values(ROOT / "infra" / "rules-db" / ".env")
    assert env.get("RULES_APP_PASSWORD"), "infra/rules-db/.env missing RULES_APP_PASSWORD — copy .env.example first"
    try:
        conn = psycopg2.connect(
            host="127.0.0.1", port="5432", dbname="mk_rules",
            user="rules_app", password=env["RULES_APP_PASSWORD"], connect_timeout=3,
        )
        conn.close()
        assert False, "expected connection to fail before provisioning; it succeeded"
    except psycopg2.OperationalError:
        pass  # expected: nothing is listening / role does not exist yet


if __name__ == "__main__":
    test_port_5432_not_yet_serving_mk_rules()
    print("RED confirmed: mk_rules is not yet reachable.")
```

- [ ] **Step 2: Run test to verify it fails for the intended reason**

Run: `py -3 scripts/tests/test-provision-rules-db.py`
Expected FAILURE MESSAGE (before the service is installed): `AssertionError: infra/rules-db/.env missing RULES_APP_PASSWORD — copy .env.example first` (the file does not exist yet) — this is the intended RED: the precondition script is not wired up at all.

- [ ] **Step 3: Create the env template**

```
# infra/rules-db/.env.example
# Copy to infra/rules-db/.env and fill in. infra/rules-db/.env is gitignored and must never be
# committed. Generate passwords with:  py -3 -c "import secrets;print(secrets.token_urlsafe(32))"
#
# This is a SEPARATE PostgreSQL instance from infra/.env's geniza database — a native Windows
# service, not the WSL/Docker container. See the plan header for why: mk_rules must survive a
# Docker/WSL outage that takes the geniza down.

RULES_POSTGRES_PORT=5432
RULES_POSTGRES_DB=mk_rules

# Superuser: used ONLY by provision_rules_db.py to create the database and roles. The application
# must never connect as this role.
RULES_SUPERUSER=postgres
RULES_SUPERUSER_PASSWORD=CHANGE_ME_generate_a_random_value

# Least-privilege application role — the builder (src/rules_store/builder.py) writes as this.
RULES_APP_PASSWORD=CHANGE_ME_generate_a_random_value

# Read-only role — the three gates and any deep-audit agent connect as this.
RULES_READER_PASSWORD=CHANGE_ME_generate_a_random_value
```

- [ ] **Step 4: Install PostgreSQL 18.4 as a native Windows service and provision it**

Manual, one-time (not scriptable end-to-end — the installer is interactive):

1. Install PostgreSQL 18.4 for Windows (the official EDB installer), choosing port **5432**, and note
   the superuser (`postgres`) password set during install.
2. `copy infra\rules-db\.env.example infra\rules-db\.env` and fill in `RULES_SUPERUSER_PASSWORD` (the
   password from step 1) and generate `RULES_APP_PASSWORD` / `RULES_READER_PASSWORD` with the command in
   the template's comment.
3. Confirm the Windows service name: `Get-Service | Where-Object Name -like 'postgresql*'` (record the
   exact name — it varies by installer version, e.g. `postgresql-x64-18`; `scripts/watchman.ps1` in Task
   19 needs it and will read it from `infra/rules-db/.env` as `RULES_SERVICE_NAME` rather than hardcode a
   guess). Add `RULES_SERVICE_NAME=<name>` to `infra/rules-db/.env` and to `.env.example` as a name-only
   placeholder line.

- [ ] **Step 5: Write `scripts/provision_rules_db.py`**

```python
# scripts/provision_rules_db.py
"""Idempotent, one-time provisioning of the mk_rules database and its two roles.

Run once after PostgreSQL 18.4 is installed as a native Windows service (Task 1, Step 4) and
infra/rules-db/.env is filled in:

    py -3 scripts/provision_rules_db.py

Safe to re-run: every statement checks existence first. Never embeds a password in a committed
file — passwords are read from infra/rules-db/.env at runtime and applied via ALTER ROLE, the same
division the geniza's infra/postgres/init/02-set-role-passwords.sh uses for the Docker case.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / "infra" / "rules-db" / ".env"


def _env() -> dict[str, str]:
    from dotenv import dotenv_values

    if not ENV_FILE.exists():
        raise SystemExit(f"{ENV_FILE} not found — copy infra/rules-db/.env.example and fill it in.")
    env = dotenv_values(ENV_FILE)
    required = ("RULES_POSTGRES_PORT", "RULES_POSTGRES_DB", "RULES_SUPERUSER",
                "RULES_SUPERUSER_PASSWORD", "RULES_APP_PASSWORD", "RULES_READER_PASSWORD")
    missing = [k for k in required if not env.get(k)]
    if missing:
        raise SystemExit(f"infra/rules-db/.env missing: {', '.join(missing)}")
    return {k: str(v) for k, v in env.items()}


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
```

- [ ] **Step 6: Run it, then run the test again to see GREEN**

Run: `py -3 scripts/provision_rules_db.py`
Expected: `created database mk_rules` · `created role rules_app` · `password set for rules_app` ·
`created role rules_reader` · `password set for rules_reader` · `provisioning complete.`

Run: `py -3 scripts/tests/test-provision-rules-db.py`
Expected: this specific script's assertion (`connection ... should fail`) now legitimately fails to
raise, because the role exists — **this test's job was only to prove the RED state; it is deleted
after Step 6**, since a permanently-green "prove absence" test is meaningless once the thing exists.
Delete `scripts/tests/test-provision-rules-db.py` in this commit and instead prove GREEN with:

```bash
py -3 -c "
import psycopg2
from dotenv import dotenv_values
env = dotenv_values('infra/rules-db/.env')
conn = psycopg2.connect(host='127.0.0.1', port=env['RULES_POSTGRES_PORT'], dbname=env['RULES_POSTGRES_DB'], user='rules_app', password=env['RULES_APP_PASSWORD'], connect_timeout=3)
print('rules_app connects OK')
conn.close()
"
```
Expected: `rules_app connects OK`

- [ ] **Step 7: Commit**

```bash
git add infra/rules-db/.env.example scripts/provision_rules_db.py
git commit -m "feat(rules-store): provision the native mk_rules PostgreSQL service"
```

---

## Task 2: `rule_revisions` / `rule_probes` schema, and the `current_requires_mirror` proof

**Files:**
- Modify: `scripts/pgmigrate.py`
- Create: `infra/rules-db/migrations/0001_rule_revisions.sql`
- Test: `scripts/tests/test-pgmigrate-flags.py`
- Test: `scripts/tests/test-current-requires-mirror.py`

**Interfaces:**
- Consumes: `rules_app`/`rules_reader` roles from Task 1; `infra/rules-db/.env`.
- Produces: table `rule_revisions(revision_id, rule_id, section, title_he, statement, bucket, severity,
  mechanism, source_path, source_heading, source_hash, revision_status, is_current, mirrored_at,
  retired_at, created_at)` and `rule_probes(id, rule_id, probe_kind, pattern, applies_to)` in `mk_rules`.
  `pgmigrate.py`'s CLI gains `--migrations-dir <path>` and `--env-file <path>` (both optional, defaulting
  to the existing `infra/postgres/migrations` / `infra/.env` so current callers are unaffected).

- [ ] **Step 1: Write the failing test for the `pgmigrate.py` flags (no DB needed — argument parsing only)**

```python
# scripts/tests/test-pgmigrate-flags.py
"""RED: pgmigrate.py's discover() is hardcoded to infra/postgres/migrations today. A --migrations-dir
flag must let it point elsewhere without touching its default behaviour."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def test_migrations_dir_flag_is_recognised():
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "pgmigrate.py"), "--help"],
        capture_output=True, text=True,
    )
    assert "--migrations-dir" in r.stdout, f"--migrations-dir not in help output:\n{r.stdout}"
    assert "--env-file" in r.stdout, f"--env-file not in help output:\n{r.stdout}"


if __name__ == "__main__":
    test_migrations_dir_flag_is_recognised()
    print("PASS")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-pgmigrate-flags.py`
Expected FAILURE MESSAGE: `AssertionError: --migrations-dir not in help output:` followed by the
current `--help` text (which only lists `--status`).

- [ ] **Step 3: Add the flags to `pgmigrate.py`, minimally, preserving current defaults**

```python
# scripts/pgmigrate.py — replace lines 35-64 (the two module-level constants and _connection_params)
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MIGRATIONS = ROOT / "infra" / "postgres" / "migrations"
DEFAULT_ENV_FILE = ROOT / "infra" / ".env"


def _connection_params(env_file: Path) -> dict[str, str]:
    """Read connection details from the given env file. Never from a literal in this file."""
    from dotenv import dotenv_values

    if not env_file.exists():
        raise SystemExit(f"{env_file} not found — copy its .env.example and fill it in.")
    env = dotenv_values(env_file)
    # Both env layouts (infra/.env's POSTGRES_* and infra/rules-db/.env's RULES_POSTGRES_*) are
    # accepted by trying the RULES_-prefixed name first, falling back to the bare name — so this
    # one function serves both callers without a --env-prefix flag to keep synchronised.
    def pick(*names: str) -> str | None:
        for n in names:
            if env.get(n):
                return str(env[n])
        return None

    port = pick("RULES_POSTGRES_PORT", "POSTGRES_PORT")
    db = pick("RULES_POSTGRES_DB", "POSTGRES_DB")
    user = pick("RULES_SUPERUSER", "POSTGRES_SUPERUSER")
    password = pick("RULES_SUPERUSER_PASSWORD", "POSTGRES_SUPERUSER_PASSWORD")
    missing = [n for n, v in (("PORT", port), ("DB", db), ("SUPERUSER", user), ("SUPERUSER_PASSWORD", password)) if not v]
    if missing:
        raise SystemExit(f"{env_file} is missing: {', '.join(missing)}")
    return {"host": "127.0.0.1", "port": port, "dbname": db, "user": user, "password": password}


def discover(migrations_dir: Path) -> list[tuple[str, Path, str]]:
    """Every .sql file, ordered by filename, with its checksum."""
    if not migrations_dir.is_dir():
        raise SystemExit(f"{migrations_dir} not found")
    out = []
    for path in sorted(migrations_dir.glob("*.sql")):
        body = path.read_text(encoding="utf-8")
        out.append((path.stem, path, hashlib.sha256(body.encode("utf-8")).hexdigest()))
    if not out:
        raise SystemExit(f"no .sql files in {migrations_dir}")
    return out
```

```python
# scripts/pgmigrate.py — replace main(), adding the two flags and threading them through
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
    # ... unchanged from here: the body that follows keeps using `found` and `conn` exactly as before.
```

(Every other line of `main()` — the ledger creation, drift check, apply loop — is unchanged; only the
two lines that built `found`/`conn` above them changed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-pgmigrate-flags.py`
Expected: `PASS`

Regression check — confirm the existing default behaviour is untouched:
Run: `py -3 scripts/pgmigrate.py --status`
Expected: identical output to before this change (`migrations: 8 on disk · 8 applied · 0 pending` or
whatever the current geniza state is) — proves the default-path callers are unaffected.

- [ ] **Step 5: Write the migration**

```sql
-- infra/rules-db/migrations/0001_rule_revisions.sql
-- The mk_rules knowledge layer — spec §4.3 (docs/superpowers/specs/2026-08-06-process-enforcement-design.md).
--
-- THE LOAD-BEARING CONSTRAINT IS `current_requires_mirror`, the exact analogue of the geniza's
-- `current_requires_both_sides` (infra/postgres/migrations/0001_documents_and_revisions.sql): a rule
-- revision cannot be marked current here — not by the builder, not by a migration, not by a person
-- with psql at 2am — unless it has already reached rules.sqlite. The database refuses the illegal
-- state rather than trusting a caller to remember the rule.

CREATE EXTENSION IF NOT EXISTS vector;
-- Provisioned per the plan's Global Constraints (pgvector 0.8.6) for future semantic rule search.
-- No table below uses it yet — Phase 1 is lexical (rule_id, content_hash), not embedded.

CREATE TABLE rule_revisions (
  revision_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          text        NOT NULL,          -- '10.17' · 'DoD-11' · 'H8' · 'L61' — stable, human, already in the doc
  section          text,
  title_he         text,
  statement        text        NOT NULL,          -- the quote from the document, never a paraphrase
  bucket           text        CHECK (bucket IN ('A', 'B', 'C')),
  severity         text        CHECK (severity IN ('warn', 'block')),
  mechanism        text,
  source_path      text        NOT NULL,
  source_heading   text,
  source_hash      text        NOT NULL,
  revision_status  text        NOT NULL CHECK (revision_status IN ('current', 'superseded', 'retired')),
  is_current       boolean     NOT NULL DEFAULT false,
  mirrored_at      timestamptz,
  retired_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT current_requires_mirror CHECK (
    NOT is_current OR mirrored_at IS NOT NULL
  ),
  -- A retired revision is never current, and a current revision is never retired — the two states
  -- are mutually exclusive by definition, not just by convention.
  CONSTRAINT retired_is_never_current CHECK (
    revision_status != 'retired' OR NOT is_current
  )
);

COMMENT ON CONSTRAINT current_requires_mirror ON rule_revisions IS
  'A rule is not "in force" until it has reached rules.sqlite. Enforced here so no code path can skip it — spec §4.3.';

-- At most one current revision per rule_id — the same pattern as the geniza's
-- one_current_revision_per_document, and for the same reason: declarative, cannot be bypassed by a
-- direct UPDATE, costs nothing to maintain.
CREATE UNIQUE INDEX one_current_revision_per_rule
  ON rule_revisions (rule_id)
  WHERE is_current;

CREATE INDEX rule_revisions_rule_id_idx ON rule_revisions (rule_id);
CREATE INDEX rule_revisions_status_idx ON rule_revisions (revision_status);

CREATE TABLE rule_probes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     text NOT NULL,
  probe_kind  text NOT NULL,
  pattern     text NOT NULL,
  applies_to  text
);

CREATE INDEX rule_probes_rule_id_idx ON rule_probes (rule_id);
```

- [ ] **Step 6: Apply it**

Run: `py -3 scripts/pgmigrate.py --migrations-dir infra/rules-db/migrations --env-file infra/rules-db/.env`
Expected: `applied 0001_rule_revisions` · `migrations: 1 applied · 1 total`

- [ ] **Step 7: Write the failing constraint-proof test**

```python
# scripts/tests/test-current-requires-mirror.py
"""Hard requirement (plan header): prove `current_requires_mirror` by attempting the illegal insert
and catching the violation. RED first: run this BEFORE the constraint exists (i.e. before Step 5/6
above) and it fails because the insert SUCCEEDS. GREEN: run it after, and the insert is refused."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import config  # noqa: E402


def test_current_true_without_mirrored_at_is_rejected():
    import psycopg2

    conn = config.connect_writer()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rule_revisions
                    (rule_id, statement, source_path, source_hash, revision_status, is_current, mirrored_at)
                VALUES
                    ('TEST-ILLEGAL', 'illegal row', 'test.md', 'deadbeef', 'current', true, NULL)
                """
            )
        conn.commit()
        assert False, "expected IntegrityError: current_requires_mirror, insert succeeded instead"
    except psycopg2.errors.CheckViolation as exc:
        assert "current_requires_mirror" in str(exc), f"wrong constraint fired: {exc}"
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    test_current_true_without_mirrored_at_is_rejected()
    print("PASS: current_requires_mirror rejects is_current without mirrored_at.")
```

(`src/rules_store/config.py` does not exist yet — this test cannot even import until Task 3 lands. That
import failure IS this task's RED for the constraint test, in addition to the pre-migration RED
described in the test's own docstring; both are pasted below.)

- [ ] **Step 8: Run it before Task 3 exists — RED (import failure)**

Run: `py -3 scripts/tests/test-current-requires-mirror.py`
Expected FAILURE MESSAGE: `ModuleNotFoundError: No module named 'src.rules_store'`

This task ends here with the constraint proved conceptually (the SQL exists and was applied in Step
6); the runnable proof completes in Task 3 once `config.py` exists, and its own Step 4 re-runs this
exact file for GREEN. Task 3's "Consumes" block names this file.

- [ ] **Step 9: Commit**

```bash
git add scripts/pgmigrate.py infra/rules-db/migrations/0001_rule_revisions.sql scripts/tests/test-pgmigrate-flags.py scripts/tests/test-current-requires-mirror.py
git commit -m "feat(rules-store): rule_revisions schema with current_requires_mirror; pgmigrate --migrations-dir/--env-file"
```

---

## Task 3: `src/rules_store/config.py` — reader/writer split, and the constraint GREEN

**Files:**
- Create: `src/rules_store/__init__.py`
- Create: `src/rules_store/config.py`
- Create: `infra/rules-db/migrations/0002_roles_and_grants.sql`
- Test: `scripts/tests/test-current-requires-mirror.py` (from Task 2 — run again here for GREEN)

**Interfaces:**
- Consumes: `rules_app`/`rules_reader` from Task 1; `rule_revisions` table from Task 2.
- Produces: `config.connect_reader(timeout: int = 10)` (a connection that CANNOT write — `SET SESSION
  CHARACTERISTICS AS TRANSACTION READ ONLY`), `config.connect_writer(timeout: int = 10)` (can write data,
  cannot change schema), `config.load_config() -> StackConfig`, `config.ConfigError`.

- [ ] **Step 1: `__init__.py`**

```python
# src/rules_store/__init__.py
```

- [ ] **Step 2: Write `config.py`**

```python
# src/rules_store/config.py
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
```

- [ ] **Step 3: Write and apply the roles/grants migration**

```sql
-- infra/rules-db/migrations/0002_roles_and_grants.sql
-- rules_app    — the builder. Reads and writes rule_revisions/rule_probes. Cannot change the schema.
-- rules_reader — the three gates and any deep-audit agent. Reads. Nothing else.
GRANT USAGE ON SCHEMA public TO rules_app, rules_reader;

GRANT SELECT, INSERT, UPDATE, DELETE ON rule_revisions, rule_probes TO rules_app;
GRANT SELECT ON rule_revisions, rule_probes TO rules_reader;

REVOKE CREATE ON SCHEMA public FROM rules_app;
REVOKE CREATE ON SCHEMA public FROM rules_reader;

DO $$
BEGIN
  IF has_schema_privilege('rules_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'rules_app still holds CREATE on schema public after the revoke';
  END IF;
  IF NOT has_schema_privilege('rules_app', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'the revoke removed USAGE from rules_app — it needs USAGE to read the tables it writes';
  END IF;
END $$;
```

Run: `py -3 scripts/pgmigrate.py --migrations-dir infra/rules-db/migrations --env-file infra/rules-db/.env`
Expected: `applied 0002_roles_and_grants` · `migrations: 1 applied · 2 total`

- [ ] **Step 4: Run the Task 2 constraint test again — GREEN**

Run: `py -3 scripts/tests/test-current-requires-mirror.py`
Expected: `PASS: current_requires_mirror rejects is_current without mirrored_at.`

- [ ] **Step 5: Commit**

```bash
git add src/rules_store/__init__.py src/rules_store/config.py infra/rules-db/migrations/0002_roles_and_grants.sql
git commit -m "feat(rules-store): config.py reader/writer split; roles_and_grants migration; current_requires_mirror GREEN"
```

---

## Task 4: `rules.sqlite` mirror module

**Files:**
- Create: `src/rules_store/mirror.py`
- Test: `scripts/tests/test-rules-mirror.py`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure SQLite, no Postgres).
- Produces: `mirror.open_mirror(path: Path) -> sqlite3.Connection` (creates schema if absent),
  `mirror.write_revision(conn, record: dict) -> None` (upsert by `rule_id`, keeping only the current
  row — the mirror holds current state, not history; history lives in Postgres), `mirror.read_current(conn)
  -> list[dict]`, `mirror.checksum(conn) -> str` (sha256 of the sorted, concatenated `(rule_id,
  source_hash)` pairs — this is what `check-rules-mirror.mjs` in Task 12 compares against Postgres).

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test-rules-mirror.py
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import mirror  # noqa: E402


def test_write_then_read_current():
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        mirror.write_revision(conn, {
            "rule_id": "10.17", "section": "10", "title_he": "Serena", "statement": "Maximize Serena.",
            "bucket": None, "severity": None, "mechanism": None,
            "source_path": "docs/process/development-discipline.md", "source_heading": "10.17",
            "source_hash": "abc123", "revision_status": "current",
        })
        rows = mirror.read_current(conn)
        assert len(rows) == 1, f"expected 1 current row, got {len(rows)}"
        assert rows[0]["rule_id"] == "10.17"
        assert rows[0]["source_hash"] == "abc123"


def test_checksum_changes_when_a_row_changes():
    with tempfile.TemporaryDirectory() as d:
        conn = mirror.open_mirror(Path(d) / "rules.sqlite")
        mirror.write_revision(conn, {
            "rule_id": "10.17", "section": "10", "title_he": "x", "statement": "x",
            "bucket": None, "severity": None, "mechanism": None,
            "source_path": "docs/process/development-discipline.md", "source_heading": "10.17",
            "source_hash": "abc123", "revision_status": "current",
        })
        c1 = mirror.checksum(conn)
        mirror.write_revision(conn, {
            "rule_id": "10.17", "section": "10", "title_he": "x", "statement": "x",
            "bucket": None, "severity": None, "mechanism": None,
            "source_path": "docs/process/development-discipline.md", "source_heading": "10.17",
            "source_hash": "def456", "revision_status": "current",
        })
        c2 = mirror.checksum(conn)
        assert c1 != c2, "checksum must change when a row's source_hash changes"


if __name__ == "__main__":
    test_write_then_read_current()
    test_checksum_changes_when_a_row_changes()
    print("PASS")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-mirror.py`
Expected FAILURE MESSAGE: `ModuleNotFoundError: No module named 'src.rules_store.mirror'`

- [ ] **Step 3: Write the minimal implementation**

```python
# src/rules_store/mirror.py
"""rules.sqlite — the mirror hooks will eventually read (Phase 3, out of scope here). Holds only
CURRENT rows: one per rule_id. History and lifecycle live in mk_rules (Postgres); the mirror is a
projection built for microsecond, zero-daemon lookups, not an archive.
"""
from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS rule_revisions (
  rule_id          TEXT PRIMARY KEY,
  section          TEXT,
  title_he         TEXT,
  statement        TEXT NOT NULL,
  bucket           TEXT,
  severity         TEXT,
  mechanism        TEXT,
  source_path      TEXT NOT NULL,
  source_heading   TEXT,
  source_hash      TEXT NOT NULL,
  revision_status  TEXT NOT NULL,
  mirrored_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_COLUMNS = ("rule_id", "section", "title_he", "statement", "bucket", "severity", "mechanism",
            "source_path", "source_heading", "source_hash", "revision_status")


def open_mirror(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    conn.commit()
    return conn


def write_revision(conn: sqlite3.Connection, record: dict) -> None:
    placeholders = ", ".join("?" for _ in _COLUMNS)
    columns = ", ".join(_COLUMNS)
    updates = ", ".join(f"{c}=excluded.{c}" for c in _COLUMNS if c != "rule_id")
    conn.execute(
        f"INSERT INTO rule_revisions ({columns}) VALUES ({placeholders}) "
        f"ON CONFLICT(rule_id) DO UPDATE SET {updates}, mirrored_at=datetime('now')",
        [record.get(c) for c in _COLUMNS],
    )
    conn.commit()


def delete_revision(conn: sqlite3.Connection, rule_id: str) -> None:
    """Used when a rule retires: the mirror holds CURRENT rules only, so a retired rule_id is
    removed from here even though its history is kept ('retired', never deleted) in Postgres."""
    conn.execute("DELETE FROM rule_revisions WHERE rule_id = ?", (rule_id,))
    conn.commit()


def read_current(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM rule_revisions ORDER BY rule_id").fetchall()
    return [dict(r) for r in rows]


def checksum(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT rule_id, source_hash FROM rule_revisions ORDER BY rule_id").fetchall()
    body = "\n".join(f"{r['rule_id']}:{r['source_hash']}" for r in rows)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-rules-mirror.py`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/rules_store/mirror.py scripts/tests/test-rules-mirror.py
git commit -m "feat(rules-store): rules.sqlite mirror module"
```

---

## Task 5: Extractor — section-numbered rules (`§N` / `§N.M` headers)

**Files:**
- Create: `src/rules_store/extractor.py`
- Test: `scripts/tests/test-rules-extractor.py`

**Interfaces:**
- Consumes: nothing (pure text parsing).
- Produces: `extractor.RuleRecord` (a `dataclass` with fields `rule_id, section, title_he, statement,
  source_heading, content_hash`), `extractor.extract_section_rules(text: str, source_path: str) ->
  list[RuleRecord]`. This task's function is one of four merged into `extract_rules()` at the end of Task
  7; later tasks import `RuleRecord` and this function by these exact names.

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test-rules-extractor.py
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store.extractor import extract_section_rules  # noqa: E402

FIXTURE = """\
## 10. The Discipline

Some intro text, not itself a rule.

### 10.17 Maximize the use of Serena for code work

Serena first, grep is a fallback.

### 10.5a Agent-concurrency ceiling

Cap subagents at the measured ceiling.

## 4. The Waiver Gate (the single most important new rule)

A plan may never waive a requirement.
"""


def test_extracts_numbered_section_headings():
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"10.17", "10.5a", "4"}, f"got {ids}"


def test_statement_is_the_paragraph_following_the_heading():
    recs = {r.rule_id: r for r in extract_section_rules(FIXTURE, "docs/process/development-discipline.md")}
    assert recs["10.17"].statement.startswith("Serena first"), recs["10.17"].statement
    assert recs["4"].statement.startswith("A plan may never waive"), recs["4"].statement


def test_intro_paragraph_before_any_numbered_heading_is_not_a_rule():
    recs = extract_section_rules(FIXTURE, "docs/process/development-discipline.md")
    assert all(r.rule_id != "" for r in recs)
    assert len(recs) == 3


if __name__ == "__main__":
    test_extracts_numbered_section_headings()
    test_statement_is_the_paragraph_following_the_heading()
    test_intro_paragraph_before_any_numbered_heading_is_not_a_rule()
    print("PASS")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-extractor.py`
Expected FAILURE MESSAGE: `ModuleNotFoundError: No module named 'src.rules_store.extractor'`

- [ ] **Step 3: Write the minimal implementation**

```python
# src/rules_store/extractor.py
"""Parses the four rule shapes out of docs/process/development-discipline.md (spec §4.2, §4.7).

DETECTS: (1) numbered §-section headings (`## 4. Title` / `### 10.17 Title`), (2) DoD checklist
items (`- [ ] **N · Title.** ...` inside the "Per-task DoD checklist" section), (3) H-ruling
headings (`## 14. H8 — Title`), (4) lessons — both the table rows (`| L1 | ... |`) in the "Lessons
log" section and the inline bolded blocks (`**L14 · Title (date).**`) used for L14 onward.

DOES NOT DETECT: a rule stated only in prose with no one of the four id shapes above; a rule
renumbered without the document itself changing (impossible to detect from text alone); nested
sub-bullets under a DoD item (only the top-level `- [ ] **N ·` line is captured — sub-bullets are
folded into that item's statement text up to the next `- [ ] **`).
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


@dataclass
class RuleRecord:
    rule_id: str
    section: str | None
    title_he: str
    statement: str
    source_heading: str
    content_hash: str


def _hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


# Matches "## 4. Title", "### 10.17 Title", "### 10.5a Title" — NOT "## 11. Lessons log" style
# headings without a leading bare number followed by '.', which the H-ruling/Lessons extractors
# (Task 6) claim instead via their own, more specific patterns run first by extract_rules().
_SECTION_HEADING_RE = re.compile(
    r"^(#{2,4})\s+(\d+(?:\.\d+)?[a-z]?)\.\s+(.+?)\s*$", re.MULTILINE
)


def extract_section_rules(text: str, source_path: str) -> list[RuleRecord]:
    matches = list(_SECTION_HEADING_RE.finditer(text))
    out: list[RuleRecord] = []
    for i, m in enumerate(matches):
        rule_id, title = m.group(2), m.group(3)
        # An H-ruling heading looks like "14. H8 — Title" — the title starts with "H<digits>".
        # Excluded here; Task 6 owns it under its own rule_id (H8, not 14).
        if re.match(r"^H\d+[a-z]?\s*[–—-]", title):
            continue
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()
        # First non-empty paragraph only — a heading's statement is its lead paragraph, not
        # everything until the next heading (which may include sub-lists this extractor does not
        # itself need to attribute to the same rule_id).
        paragraph = body.split("\n\n", 1)[0].strip()
        out.append(RuleRecord(
            rule_id=rule_id,
            section=rule_id.split(".")[0],
            title_he=title,
            statement=paragraph if paragraph else title,
            source_heading=f"{m.group(2)}. {title}",
            content_hash=_hash(f"{title}\n{paragraph}"),
        ))
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-rules-extractor.py`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/rules_store/extractor.py scripts/tests/test-rules-extractor.py
git commit -m "feat(rules-store): extractor — numbered section-heading rules"
```

---

## Task 6: Extractor — DoD checklist items

**Files:**
- Modify: `src/rules_store/extractor.py`
- Modify: `scripts/tests/test-rules-extractor.py`

**Interfaces:**
- Consumes: `RuleRecord` from Task 5.
- Produces: `extractor.extract_dod_rules(text: str, source_path: str) -> list[RuleRecord]` — rule_id
  format `DoD-N`.

- [ ] **Step 1: Add the failing test**

```python
# append to scripts/tests/test-rules-extractor.py
from src.rules_store.extractor import extract_dod_rules  # noqa: E402

DOD_FIXTURE = """\
### Per-task DoD checklist

- [ ] **1 · Spec requirement traced.** The exact spec line(s) this task satisfies, quoted.
- [ ] **2 · RED witnessed.** Test written first, run, and observed failing.
- [ ] **12 · Full suite green (H7).** Run `npx playwright test` plain.

### Per-phase DoD gate

- [ ] Every DoD line in the governing spec's "Definition of Done" section quoted and marked MET.
"""


def test_extracts_only_numbered_dod_items_inside_the_checklist_section():
    recs = extract_dod_rules(DOD_FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"DoD-1", "DoD-2", "DoD-12"}, f"got {ids}"


def test_per_phase_gate_bullets_are_not_dod_items():
    # the unnumbered "Per-phase DoD gate" bullet must NOT become a DoD-N row
    recs = extract_dod_rules(DOD_FIXTURE, "docs/process/development-discipline.md")
    assert not any("Every DoD line" in r.statement for r in recs)
```

Add to the `if __name__` block:
```python
    test_extracts_only_numbered_dod_items_inside_the_checklist_section()
    test_per_phase_gate_bullets_are_not_dod_items()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-extractor.py`
Expected FAILURE MESSAGE: `ImportError: cannot import name 'extract_dod_rules' from 'src.rules_store.extractor'`

- [ ] **Step 3: Add the minimal implementation**

```python
# append to src/rules_store/extractor.py
_DOD_SECTION_RE = re.compile(
    r"### Per-task DoD checklist\s*\n(.*?)(?=\n###|\n##|\Z)", re.DOTALL
)
_DOD_ITEM_RE = re.compile(
    r"^- \[ \] \*\*(\d+)\s*·\s*([^*]+?)\.\*\*\s*(.*)$", re.MULTILINE
)


def extract_dod_rules(text: str, source_path: str) -> list[RuleRecord]:
    section_match = _DOD_SECTION_RE.search(text)
    if not section_match:
        return []
    body = section_match.group(1)
    out: list[RuleRecord] = []
    for m in _DOD_ITEM_RE.finditer(body):
        n, title, rest = m.group(1), m.group(2).strip(), m.group(3).strip()
        statement = f"{title}. {rest}".strip()
        out.append(RuleRecord(
            rule_id=f"DoD-{n}",
            section="DoD",
            title_he=title,
            statement=statement,
            source_heading=f"Per-task DoD checklist item {n}",
            content_hash=_hash(statement),
        ))
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-rules-extractor.py`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/rules_store/extractor.py scripts/tests/test-rules-extractor.py
git commit -m "feat(rules-store): extractor — DoD-N checklist items"
```

---

## Task 7: Extractor — H-ruling headings and lessons; `extract_rules()` merge point

**Files:**
- Modify: `src/rules_store/extractor.py`
- Modify: `scripts/tests/test-rules-extractor.py`

**Interfaces:**
- Consumes: everything from Tasks 5-6.
- Produces: `extractor.extract_h_rulings(text, source_path) -> list[RuleRecord]` (rule_id `H8`, `H13`, …),
  `extractor.extract_lessons(text, source_path) -> list[RuleRecord]` (rule_id `L1`…`L61`, from both the
  table and the inline `**Ln ·**` blocks), and the merge point **`extractor.extract_rules(text: str,
  source_path: str) -> list[RuleRecord]`** — the single function every later task (builder, gates) calls.
  Duplicate `rule_id`s across the four sub-extractors are a `ValueError` (the doc is internally
  inconsistent — this is the DoD-6 negative case).

- [ ] **Step 1: Add the failing tests**

```python
# append to scripts/tests/test-rules-extractor.py
from src.rules_store.extractor import extract_h_rulings, extract_lessons, extract_rules  # noqa: E402

H_FIXTURE = """\
## 14. H8 — The Full-Landing Rule ("nothing in the air"; owner ruling, 2026-07-30)

Nothing may be left unlanded: named phase, trigger-anchored deferral, or registered brainstorm task.

## 16. H13 — שער רלוונטיות לפריט משוחזר (Recovery Relevance Gate; owner ruling, 2026-07-30)

בירור → המלצה → החלטת בעלים → עדכון → בצע/בטל.
"""

LESSON_FIXTURE = """\
## 11. Lessons log

| # | Lesson | Root cause | Gate |
|---|---|---|---|
| L1 | equipPlan never built | Waived in a plan file | §4 Waiver Gate |
| L2 | hooksOver shipped unread | A derived value had no consumer | DoD 5 |

**L14 · A push is not a release; a deploy takes minutes (v255, 2026-07-21).**
I announced "v255 is shipped" the moment `git push` returned. The owner looked, still saw 254.
"""


def test_extracts_h_rulings_by_their_h_number_not_their_section_number():
    recs = extract_h_rulings(H_FIXTURE, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert ids == {"H8", "H13"}, f"got {ids}"


def test_extracts_table_lessons_and_inline_lessons():
    recs = {r.rule_id: r for r in extract_lessons(LESSON_FIXTURE, "docs/process/development-discipline.md")}
    assert set(recs) == {"L1", "L2", "L14"}, f"got {set(recs)}"
    assert "equipPlan" in recs["L1"].statement
    assert "deploy takes minutes" in recs["L14"].title_he or "push is not a release" in recs["L14"].title_he


def test_extract_rules_merges_all_four_shapes_and_rejects_duplicate_ids():
    combined = DOD_FIXTURE + H_FIXTURE + LESSON_FIXTURE
    recs = extract_rules(combined, "docs/process/development-discipline.md")
    ids = {r.rule_id for r in recs}
    assert {"DoD-1", "H8", "L1", "L14"} <= ids, f"got {ids}"

    dup = combined + "\n### 10.17 Duplicate on purpose\n\nSecond copy.\n" + "\n### 10.17 Again\n\nThird copy.\n"
    try:
        extract_rules(dup, "docs/process/development-discipline.md")
        assert False, "expected ValueError for duplicate rule_id '10.17'"
    except ValueError as exc:
        assert "10.17" in str(exc)
```

Add to the `if __name__` block:
```python
    test_extracts_h_rulings_by_their_h_number_not_their_section_number()
    test_extracts_table_lessons_and_inline_lessons()
    test_extract_rules_merges_all_four_shapes_and_rejects_duplicate_ids()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-extractor.py`
Expected FAILURE MESSAGE: `ImportError: cannot import name 'extract_h_rulings' from 'src.rules_store.extractor'`

- [ ] **Step 3: Write the minimal implementation**

```python
# append to src/rules_store/extractor.py
_H_HEADING_RE = re.compile(
    r"^#{2,4}\s+\d+(?:\.\d+)?[a-z]?\.\s+(H\d+[a-z]?)\s*[–—-]\s*(.+?)\s*$", re.MULTILINE
)


def extract_h_rulings(text: str, source_path: str) -> list[RuleRecord]:
    matches = list(_H_HEADING_RE.finditer(text))
    out: list[RuleRecord] = []
    for i, m in enumerate(matches):
        h_id, title = m.group(1), m.group(2)
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        # Bounded to the next heading OF ANY of the three families this module recognises, found
        # via the generic markdown heading marker '#{2,4} ' — an H-ruling's body ends at the next
        # heading line, full stop.
        next_heading = re.search(r"^#{2,4}\s+", text[body_start:], re.MULTILINE)
        if next_heading:
            body_end = min(body_end, body_start + next_heading.start())
        body = text[body_start:body_end].strip()
        paragraph = body.split("\n\n", 1)[0].strip()
        out.append(RuleRecord(
            rule_id=h_id,
            section=h_id,
            title_he=title,
            statement=paragraph if paragraph else title,
            source_heading=f"{h_id} — {title}",
            content_hash=_hash(f"{title}\n{paragraph}"),
        ))
    return out


_LESSON_TABLE_ROW_RE = re.compile(
    r"^\|\s*(L\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$", re.MULTILINE
)
_LESSON_INLINE_RE = re.compile(
    r"^\*\*(L\d+)\s*·\s*(.+?)\*\*\s*\n(.+?)(?=\n\*\*L\d+\s*·|\n##|\Z)", re.MULTILINE | re.DOTALL
)


def extract_lessons(text: str, source_path: str) -> list[RuleRecord]:
    out: list[RuleRecord] = []
    for m in _LESSON_TABLE_ROW_RE.finditer(text):
        l_id, lesson, root_cause, gate = m.group(1), m.group(2), m.group(3), m.group(4)
        statement = f"{lesson} — root cause: {root_cause} — gate: {gate}"
        out.append(RuleRecord(
            rule_id=l_id, section="Lessons", title_he=lesson, statement=statement,
            source_heading=f"Lessons log table row {l_id}", content_hash=_hash(statement),
        ))
    for m in _LESSON_INLINE_RE.finditer(text):
        l_id, title, body = m.group(1), m.group(2).strip(), m.group(3).strip()
        paragraph = body.split("\n\n", 1)[0].strip()
        out.append(RuleRecord(
            rule_id=l_id, section="Lessons", title_he=title, statement=paragraph,
            source_heading=f"Lessons log — {l_id} · {title}", content_hash=_hash(f"{title}\n{paragraph}"),
        ))
    return out


def extract_rules(text: str, source_path: str) -> list[RuleRecord]:
    """The single entry point every builder/gate calls. Merges the four shapes; a rule_id claimed
    by more than one shape is treated as a document inconsistency, not silently deduplicated —
    silently picking a winner would let a real authoring mistake pass unnoticed."""
    groups = [
        extract_section_rules(text, source_path),
        extract_dod_rules(text, source_path),
        extract_h_rulings(text, source_path),
        extract_lessons(text, source_path),
    ]
    seen: dict[str, str] = {}
    out: list[RuleRecord] = []
    for group in groups:
        for rec in group:
            if rec.rule_id in seen:
                raise ValueError(
                    f"rule_id {rec.rule_id!r} claimed by more than one shape in {source_path} "
                    f"({seen[rec.rule_id]} and this one) — the document is internally inconsistent."
                )
            seen[rec.rule_id] = rec.source_heading
            out.append(rec)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-rules-extractor.py`
Expected: `PASS`

- [ ] **Step 5: Run the extractor against the REAL document, as a sanity check (not an automated test — a manual eyeball per DoD-4/6, since the fixture tests already prove the mechanics)**

```bash
py -3 -c "
from src.rules_store.extractor import extract_rules
from pathlib import Path
text = Path('docs/process/development-discipline.md').read_text(encoding='utf-8')
recs = extract_rules(text, 'docs/process/development-discipline.md')
print(f'{len(recs)} rules extracted')
for r in recs[:15]:
    print(f'  {r.rule_id:10s} {r.title_he[:60]}')
"
```
Expected: a count in the low hundreds (matching the ~35 rules the spec's own audit found plus every
DoD/lesson/H item) and no traceback. If a `ValueError` fires here, it names the real duplicate — read
`docs/process/development-discipline.md` at that heading and fix the regex or the doc before proceeding;
do not silently catch and ignore it.

- [ ] **Step 6: Commit**

```bash
git add src/rules_store/extractor.py scripts/tests/test-rules-extractor.py
git commit -m "feat(rules-store): extractor — H-rulings, lessons, and the extract_rules() merge point"
```

---

## Task 8: Builder write order, and the crash-mid-way test

**Files:**
- Create: `src/rules_store/builder.py`
- Create: `scripts/tests/test-rules-builder.py`

**Interfaces:**
- Consumes: `config.connect_writer()` (Task 3), `mirror.open_mirror/write_revision` (Task 4),
  `extractor.RuleRecord` (Task 5-7).
- Produces: **`builder.sync_rule(pg_conn, mirror_conn, record: RuleRecord) -> str`** — the four-step write
  order, returns the `revision_id` (str) of the row it created or updated. Later tasks (9-11) call this
  exact function name.

- [ ] **Step 1: Write the failing crash-simulation test**

```python
# scripts/tests/test-rules-builder.py
"""Requires a reachable mk_rules (Task 1-3). RED here means: before sync_rule exists, this import
fails. GREEN (Step 4) proves the crash-mid-way guarantee: a fault injected between mirror-write and
flip-to-current leaves the row permanently is_current=false — inactive, never half-active."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import builder, config, mirror, extractor  # noqa: E402


def _clean(pg_conn, rule_id: str) -> None:
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", (rule_id,))
    pg_conn.commit()


def test_crash_between_mirror_write_and_flip_leaves_rule_inactive():
    pg = config.connect_writer()
    pg.autocommit = False
    _clean(pg, "TEST-CRASH")
    tmp = Path(__file__).parent / "_tmp_crash_mirror.sqlite"
    if tmp.exists():
        tmp.unlink()
    m = mirror.open_mirror(tmp)

    rec = extractor.RuleRecord(
        rule_id="TEST-CRASH", section="TEST", title_he="crash test", statement="crash test rule",
        source_heading="test", content_hash="crashhash",
    )
    try:
        builder.sync_rule(pg, m, rec, _fail_after_mirror_write=True)
        assert False, "expected the injected fault to raise"
    except builder.SimulatedCrash:
        pass

    with pg.cursor() as cur:
        cur.execute(
            "SELECT is_current, mirrored_at FROM rule_revisions WHERE rule_id = %s ORDER BY created_at DESC LIMIT 1",
            ("TEST-CRASH",),
        )
        row = cur.fetchone()
    assert row is not None, "the pre-mirror insert (is_current=false) must have committed"
    is_current, mirrored_at = row
    assert is_current is False, f"row must stay INACTIVE after a simulated crash, got is_current={is_current}"

    _clean(pg, "TEST-CRASH")
    pg.close()
    tmp.unlink()


if __name__ == "__main__":
    test_crash_between_mirror_write_and_flip_leaves_rule_inactive()
    print("PASS")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-builder.py`
Expected FAILURE MESSAGE: `ModuleNotFoundError: No module named 'src.rules_store.builder'`

- [ ] **Step 3: Write the minimal implementation**

```python
# src/rules_store/builder.py
"""Syncs an extracted RuleRecord into mk_rules and its mirror, in the four-step order the spec
mandates (§4.5):

    1. write to Postgres as is_current=false
    2. write the mirror
    3. mark mirrored_at
    4. flip is_current=true

A crash between steps 2 and 4 leaves the Postgres row exactly where step 1 left it: is_current=false.
The row is inert, never half-active, and current_requires_mirror (0001 migration) makes the illegal
state unreachable even if this ordering were violated by a bug.
"""
from __future__ import annotations

from src.rules_store import mirror as mirror_mod
from src.rules_store.extractor import RuleRecord


class SimulatedCrash(RuntimeError):
    """Raised only when a test asks for it — see sync_rule's _fail_after_mirror_write parameter.
    Never raised in a real run; it exists so Task 8's test can inject the fault deterministically
    rather than trying to time a real crash, which no test can do reliably."""


def sync_rule(pg_conn, mirror_conn, record: RuleRecord, *, _fail_after_mirror_write: bool = False) -> str:
    with pg_conn.cursor() as cur:
        # Step 1 — Postgres, is_current=false.
        cur.execute(
            """
            INSERT INTO rule_revisions
                (rule_id, section, title_he, statement, source_path, source_heading, source_hash,
                 revision_status, is_current)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'current', false)
            RETURNING revision_id
            """,
            (record.rule_id, record.section, record.title_he, record.statement,
             "docs/process/development-discipline.md", record.source_heading, record.content_hash),
        )
        revision_id = cur.fetchone()[0]
    pg_conn.commit()

    # Step 2 — the mirror.
    mirror_mod.write_revision(mirror_conn, {
        "rule_id": record.rule_id, "section": record.section, "title_he": record.title_he,
        "statement": record.statement, "bucket": None, "severity": None, "mechanism": None,
        "source_path": "docs/process/development-discipline.md", "source_heading": record.source_heading,
        "source_hash": record.content_hash, "revision_status": "current",
    })

    if _fail_after_mirror_write:
        raise SimulatedCrash("fault injected between mirror write and flip-to-current")

    with pg_conn.cursor() as cur:
        # Step 3 — mark mirrored_at.
        cur.execute("UPDATE rule_revisions SET mirrored_at = now() WHERE revision_id = %s", (revision_id,))
        # Step 4 — flip is_current. Both in the SAME transaction as step 3: the constraint requires
        # mirrored_at to be set BEFORE is_current can be true, and doing them as one commit means
        # there is never a moment where a committed row has is_current=true and mirrored_at=NULL —
        # the exact state the CHECK constraint would refuse anyway, proven twice.
        cur.execute("UPDATE rule_revisions SET is_current = true WHERE revision_id = %s", (revision_id,))
    pg_conn.commit()
    return str(revision_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-rules-builder.py`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/rules_store/builder.py scripts/tests/test-rules-builder.py
git commit -m "feat(rules-store): builder.sync_rule — four-step write order, crash-mid-way proved inactive"
```

---

## Task 9: Builder lifecycle — added / updated / unchanged / retired

**Files:**
- Modify: `src/rules_store/builder.py`
- Modify: `scripts/tests/test-rules-builder.py`

**Interfaces:**
- Consumes: `sync_rule()` from Task 8.
- Produces: **`builder.sync_document(pg_conn, mirror_conn, text: str, source_path: str) -> dict`** —
  returns `{"added": [...], "updated": [...], "unchanged": [...], "retired": [...]}` (each a list of
  `rule_id`). This is the function Task 12's CLI and Task 21's watchman recovery both call.

- [ ] **Step 1: Write the four failing tests**

```python
# append to scripts/tests/test-rules-builder.py
def _fresh(pg_conn, mirror_path: Path):
    if mirror_path.exists():
        mirror_path.unlink()
    return mirror.open_mirror(mirror_path)


def test_lifecycle_added_creates_revision_1_current():
    pg = config.connect_writer(); pg.autocommit = False
    _clean(pg, "TEST-LC")
    m = _fresh(pg, Path(__file__).parent / "_tmp_lc_added.sqlite")
    doc = "### 10.LC Added rule\n\nfirst statement.\n"
    result = builder.sync_document(pg, m, doc, "docs/process/development-discipline.md")
    assert result["added"] == ["10.LC"], result
    with pg.cursor() as cur:
        cur.execute("SELECT revision_status, is_current FROM rule_revisions WHERE rule_id = %s", ("10.LC",))
        status, is_current = cur.fetchone()
    assert status == "current" and is_current is True
    _clean(pg, "TEST-LC"); pg.close()


def test_lifecycle_updated_supersedes_old_revision():
    pg = config.connect_writer(); pg.autocommit = False
    _clean(pg, "TEST-LC")
    m = _fresh(pg, Path(__file__).parent / "_tmp_lc_updated.sqlite")
    builder.sync_document(pg, m, "### 10.LC Rule\n\nfirst statement.\n", "docs/process/development-discipline.md")
    result = builder.sync_document(pg, m, "### 10.LC Rule\n\nSECOND statement, changed.\n", "docs/process/development-discipline.md")
    assert result["updated"] == ["10.LC"], result
    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, statement FROM rule_revisions WHERE rule_id = %s ORDER BY created_at",
            ("10.LC",),
        )
        rows = cur.fetchall()
    assert len(rows) == 2, f"expected old + new revision, got {rows}"
    assert rows[0][0] == "superseded" and rows[0][1] is False
    assert rows[1][0] == "current" and rows[1][1] is True and "SECOND" in rows[1][2]
    _clean(pg, "TEST-LC"); pg.close()


def test_lifecycle_unchanged_is_a_noop():
    pg = config.connect_writer(); pg.autocommit = False
    _clean(pg, "TEST-LC")
    m = _fresh(pg, Path(__file__).parent / "_tmp_lc_unchanged.sqlite")
    doc = "### 10.LC Rule\n\nstable statement.\n"
    builder.sync_document(pg, m, doc, "docs/process/development-discipline.md")
    result = builder.sync_document(pg, m, doc, "docs/process/development-discipline.md")
    assert result["unchanged"] == ["10.LC"], result
    with pg.cursor() as cur:
        cur.execute("SELECT count(*) FROM rule_revisions WHERE rule_id = %s", ("10.LC",))
        (n,) = cur.fetchone()
    assert n == 1, f"an unchanged sync must not create a second revision row, found {n}"
    _clean(pg, "TEST-LC"); pg.close()


def test_lifecycle_removed_from_document_is_retired_not_deleted():
    pg = config.connect_writer(); pg.autocommit = False
    _clean(pg, "TEST-LC")
    m = _fresh(pg, Path(__file__).parent / "_tmp_lc_retired.sqlite")
    builder.sync_document(pg, m, "### 10.LC Rule\n\nwill be removed.\n", "docs/process/development-discipline.md")
    result = builder.sync_document(pg, m, "### 10.OTHER Unrelated\n\nsomething else.\n", "docs/process/development-discipline.md")
    assert result["retired"] == ["10.LC"], result
    with pg.cursor() as cur:
        cur.execute(
            "SELECT revision_status, is_current, retired_at FROM rule_revisions WHERE rule_id = %s",
            ("10.LC",),
        )
        status, is_current, retired_at = cur.fetchone()
    assert status == "retired" and is_current is False and retired_at is not None
    # the mirror holds current rules only — a retired rule_id must be gone from it
    assert not [r for r in mirror.read_current(m) if r["rule_id"] == "10.LC"]
    _clean(pg, "TEST-LC")
    with pg.cursor() as cur:
        cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", ("10.OTHER",))
    pg.commit()
    pg.close()
```

Add all four to the `if __name__` block.

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-builder.py`
Expected FAILURE MESSAGE: `AttributeError: module 'src.rules_store.builder' has no attribute 'sync_document'`

- [ ] **Step 3: Write the minimal implementation**

```python
# append to src/rules_store/builder.py
from src.rules_store.extractor import extract_rules


def sync_document(pg_conn, mirror_conn, text: str, source_path: str) -> dict:
    records = {r.rule_id: r for r in extract_rules(text, source_path)}

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT rule_id, source_hash FROM rule_revisions WHERE is_current AND source_path = %s",
            (source_path,),
        )
        existing = dict(cur.fetchall())

    result = {"added": [], "updated": [], "unchanged": [], "retired": []}

    for rule_id, record in records.items():
        if rule_id not in existing:
            sync_rule(pg_conn, mirror_conn, record)
            result["added"].append(rule_id)
        elif existing[rule_id] != record.content_hash:
            _supersede(pg_conn, rule_id)
            sync_rule(pg_conn, mirror_conn, record)
            result["updated"].append(rule_id)
        else:
            result["unchanged"].append(rule_id)

    for rule_id in set(existing) - set(records):
        _retire(pg_conn, mirror_conn, rule_id)
        result["retired"].append(rule_id)

    return result


def _supersede(pg_conn, rule_id: str) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            "UPDATE rule_revisions SET is_current = false, revision_status = 'superseded' "
            "WHERE rule_id = %s AND is_current",
            (rule_id,),
        )
    pg_conn.commit()


def _retire(pg_conn, mirror_conn, rule_id: str) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            "UPDATE rule_revisions SET is_current = false, revision_status = 'retired', retired_at = now() "
            "WHERE rule_id = %s AND is_current",
            (rule_id,),
        )
    pg_conn.commit()
    mirror_mod.delete_revision(mirror_conn, rule_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-rules-builder.py`
Expected: `PASS` (all five tests in the file, including Task 8's crash test)

- [ ] **Step 5: Commit**

```bash
git add src/rules_store/builder.py scripts/tests/test-rules-builder.py
git commit -m "feat(rules-store): sync_document — added/updated/unchanged/retired lifecycle"
```

---

## Task 10: Builder derives from disk, not git

**Files:**
- Modify: `scripts/tests/test-rules-builder.py`

**Interfaces:**
- Consumes: `sync_document()` from Task 9.
- Produces: nothing new — this is a proof task, no new function.

- [ ] **Step 1: Write the failing test**

```python
# append to scripts/tests/test-rules-builder.py
import subprocess
import tempfile


def _git(cwd, *args):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout


def test_builder_reads_the_working_tree_not_head():
    """Proves the hard requirement: an UNCOMMITTED document change is detected. A builder that
    shelled out to `git show HEAD:<path>` instead of reading the file would see the OLD content and
    report 'unchanged' here — this test fails exactly that way if the implementation regresses."""
    with tempfile.TemporaryDirectory() as d:
        _git(d, "init", "-q")
        _git(d, "config", "user.email", "test@example.com")
        _git(d, "config", "user.name", "Test")
        _git(d, "config", "commit.gpgsign", "false")
        doc_path = Path(d) / "development-discipline.md"
        doc_path.write_text("### 10.DISK Rule\n\ncommitted statement.\n", encoding="utf-8")
        _git(d, "add", ".")
        _git(d, "commit", "-q", "-m", "initial")

        # Edit on disk WITHOUT committing or staging.
        doc_path.write_text("### 10.DISK Rule\n\nUNCOMMITTED statement, changed on disk only.\n", encoding="utf-8")

        pg = config.connect_writer(); pg.autocommit = False
        _clean(pg, "TEST-DISK".replace("TEST-DISK", "10.DISK"))
        m = _fresh(pg, Path(__file__).parent / "_tmp_disk_not_git.sqlite")

        # First sync (against the committed version) happens implicitly never — this is a fresh
        # DB, so the very first sync already reads the UNCOMMITTED working-tree content directly
        # off disk_path, proving the builder never consults git at all.
        text_from_disk = doc_path.read_text(encoding="utf-8")
        result = builder.sync_document(pg, m, text_from_disk, "development-discipline.md")
        assert result["added"] == ["10.DISK"]
        with pg.cursor() as cur:
            cur.execute("SELECT statement FROM rule_revisions WHERE rule_id = %s AND is_current", ("10.DISK",))
            (statement,) = cur.fetchone()
        assert "UNCOMMITTED" in statement, (
            f"expected the uncommitted working-tree text, got: {statement!r} — "
            "the builder must read the file directly, never `git show HEAD:...`"
        )
        _clean(pg, "10.DISK"); pg.close()
```

Add to the `if __name__` block.

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-rules-builder.py`
Expected: this test is written against the CURRENT (correct) implementation, so it should already
pass — `sync_document` takes `text: str` as a parameter and never touches git, by construction.
**RED here is deliberately obtained by TEMPORARILY breaking the implementation to prove the test can
fail for the right reason** (DoD-2's rewrite-until-it-fails rule): edit `builder.sync_document` to read
`source_path` via `subprocess.run(["git", "show", f"HEAD:{source_path}"], ...)` instead of using the
passed-in `text` parameter, run the test, and confirm:
Expected FAILURE MESSAGE: `AssertionError: expected the uncommitted working-tree text, got: 'committed statement.' — the builder must read the file directly, never \`git show HEAD:...\``
Then revert that temporary edit.

- [ ] **Step 3: Confirm GREEN with the real (disk-reading) implementation**

Run: `py -3 scripts/tests/test-rules-builder.py`
Expected: `PASS`

- [ ] **Step 4: Commit**

```bash
git add scripts/tests/test-rules-builder.py
git commit -m "test(rules-store): prove the builder derives from disk, never git HEAD"
```

---

## Task 11: `scripts/build_rules_store.py` — the CLI entrypoint

**Files:**
- Create: `scripts/build_rules_store.py`

**Interfaces:**
- Consumes: `config.connect_writer()` (Task 3), `mirror.open_mirror()` (Task 4), `builder.sync_document()`
  (Task 9), `builder.rebuild_mirror_from_postgres()` (new in this task).
- Produces: `py -3 scripts/build_rules_store.py --doc <path>` (full sync) and `py -3
  scripts/build_rules_store.py --rebuild-mirror-only` (rebuilds `rules.sqlite` from Postgres's current
  rows without touching Postgres — this is what Task 18's watchman recovery calls when only the mirror
  is broken). Mirror path defaults to `rules.sqlite` at repo root, overridable with `--mirror-path`.

- [ ] **Step 1: Write the failing test**

```python
# scripts/tests/test-build-rules-store-cli.py
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def test_cli_reports_lifecycle_counts():
    with tempfile.TemporaryDirectory() as d:
        doc = Path(d) / "fixture.md"
        doc.write_text("### 10.CLI CLI test rule\n\nfrom the CLI.\n", encoding="utf-8")
        mirror_path = Path(d) / "rules.sqlite"
        r = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_rules_store.py"),
             "--doc", str(doc), "--mirror-path", str(mirror_path)],
            capture_output=True, text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert "added: 1" in r.stdout or "added:1" in r.stdout.replace(" ", ""), r.stdout
        assert mirror_path.exists(), "rebuild must create the mirror file"

        # cleanup: retire the test rule so it doesn't linger as a permanent fixture row
        sys.path.insert(0, str(ROOT))
        from src.rules_store import config
        pg = config.connect_writer(); pg.autocommit = True
        with pg.cursor() as cur:
            cur.execute("DELETE FROM rule_revisions WHERE rule_id = %s", ("10.CLI",))
        pg.close()


if __name__ == "__main__":
    test_cli_reports_lifecycle_counts()
    print("PASS")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 scripts/tests/test-build-rules-store-cli.py`
Expected FAILURE MESSAGE: `FileNotFoundError` / non-zero exit — `scripts/build_rules_store.py` does not exist yet.

- [ ] **Step 3: Write `builder.rebuild_mirror_from_postgres` and the CLI**

```python
# append to src/rules_store/builder.py
def rebuild_mirror_from_postgres(pg_conn, mirror_conn) -> int:
    """Rewrites the mirror from Postgres's current rows only — no document parsing, no writes to
    Postgres. Used when rules.sqlite is missing or corrupt but mk_rules is healthy (watchman
    recovery, Task 18)."""
    import sqlite3

    mirror_conn.execute("DELETE FROM rule_revisions")
    mirror_conn.commit()
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT rule_id, section, title_he, statement, bucket, severity, mechanism, "
            "source_path, source_heading, source_hash, revision_status "
            "FROM rule_revisions WHERE is_current"
        )
        rows = cur.fetchall()
        cols = [d.name for d in cur.description]
    for row in rows:
        mirror_mod.write_revision(mirror_conn, dict(zip(cols, row)))
    return len(rows)
```

```python
# scripts/build_rules_store.py
"""Build or rebuild the mk_rules store and its rules.sqlite mirror.

    py -3 scripts/build_rules_store.py --doc docs/process/development-discipline.md
    py -3 scripts/build_rules_store.py --rebuild-mirror-only

Exit codes: 0 on success, 1 on any failure (connection, constraint violation, parse error).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.rules_store import builder, config, mirror  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--doc", type=Path, help="document to sync (repo-relative or absolute)")
    ap.add_argument("--rebuild-mirror-only", action="store_true",
                     help="rebuild rules.sqlite from mk_rules's current rows; touches nothing in Postgres")
    ap.add_argument("--mirror-path", type=Path, default=ROOT / "rules.sqlite")
    args = ap.parse_args()

    if not args.doc and not args.rebuild_mirror_only:
        ap.error("give --doc <path> or --rebuild-mirror-only")

    pg = config.connect_writer()
    pg.autocommit = False
    try:
        m = mirror.open_mirror(args.mirror_path)
        if args.rebuild_mirror_only:
            n = builder.rebuild_mirror_from_postgres(pg, m)
            print(f"rebuilt mirror: {n} current rule(s) written to {args.mirror_path}")
            return 0

        text = args.doc.read_text(encoding="utf-8")
        source_path = str(args.doc)
        result = builder.sync_document(pg, m, text, source_path)
        print(
            f"added: {len(result['added'])} · updated: {len(result['updated'])} · "
            f"unchanged: {len(result['unchanged'])} · retired: {len(result['retired'])}"
        )
        for kind in ("added", "updated", "retired"):
            for rule_id in result[kind][:10]:
                print(f"  {kind}: {rule_id}")
        return 0
    except Exception as exc:  # noqa: BLE001 - reported, not swallowed
        print(f"FAILED: {type(exc).__name__}: {exc}")
        return 1
    finally:
        pg.close()


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 scripts/tests/test-build-rules-store-cli.py`
Expected: `PASS`

- [ ] **Step 5: Run it against the real document once, for real**

Run: `py -3 scripts/build_rules_store.py --doc docs/process/development-discipline.md`
Expected: `added: <N> · updated: 0 · unchanged: 0 · retired: 0` with `<N>` matching Task 7 Step 5's count.

- [ ] **Step 6: Commit**

```bash
git add src/rules_store/builder.py scripts/build_rules_store.py scripts/tests/test-build-rules-store-cli.py rules.sqlite
git commit -m "feat(rules-store): build_rules_store.py CLI; first real sync of development-discipline.md"
```

(`rules.sqlite` is committed per the spec's §12 open item #1 — it is derived, but its presence is what
lets hooks work on a clean checkout, in CI, and without Docker; `check-rules-mirror.mjs`, Task 12, turns
any silent divergence into a red diff.)

---

## Task 12: Gate `check-rules-fresh.mjs`

**Files:**
- Create: `scripts/check-rules-fresh.mjs`

**Interfaces:**
- Consumes: `py -3 scripts/build_rules_store.py --doc <path>` (Task 11) as its self-heal action; reads
  `mk_rules` via a small inline Python snippet, matching `check-geniza-fresh.mjs`'s pattern exactly.
- Produces: exit 0 (fresh, or SKIPPED with `mk_rules` unreachable), exit 1 (drift detected and could not
  be repaired).

- [ ] **Step 1: Write the gate**

```javascript
#!/usr/bin/env node
// check-rules-fresh — every rule-shaped section on disk matches its source_hash in mk_rules.
//
// SAME SHAPE as check-geniza-fresh.mjs, deliberately: self-healing (re-runs the builder), blocking,
// SKIPS LOUDLY when mk_rules is unreachable (a developer without the native PostgreSQL service
// running is not a developer with a stale rules store — blocking them here would only teach the
// skip hatch), and prints exactly what it scanned.
//
// detects: a rule-shaped section (§N heading, DoD-N item, Hn ruling, Ln lesson) in
//   docs/process/development-discipline.md whose content_hash differs from the source_hash of the
//   matching CURRENT row in mk_rules — i.e. the document moved and the store did not.
// does NOT detect: a rule stated only in prose with none of the four id shapes (see
//   src/rules_store/extractor.py's own header for the exact list); a rule in a document other than
//   development-discipline.md (out of scope for Phase 1 — the spec's extractor targets this one file).
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = 'docs/process/development-discipline.md';

const PY = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pathlib import Path
from src.rules_store import config, extractor

text = (Path(${JSON.stringify(ROOT)}) / ${JSON.stringify(DOC)}).read_text(encoding="utf-8")
on_disk = {r.rule_id: r.content_hash for r in extractor.extract_rules(text, ${JSON.stringify(DOC)})}

conn = config.connect_reader(timeout=5)
try:
    with conn.cursor() as cur:
        cur.execute("SELECT rule_id, source_hash FROM rule_revisions WHERE is_current AND source_path = %s", (${JSON.stringify(DOC)},))
        stored = dict(cur.fetchall())
finally:
    conn.close()

stale = sorted(rid for rid in set(on_disk) & set(stored) if on_disk[rid] != stored[rid])
missing = sorted(set(on_disk) - set(stored))
print(json.dumps({"disk": len(on_disk), "stored": len(stored), "stale": stale, "missing": missing}))
`;

// L59: `python` on PATH may be the Microsoft Store alias — never tried here.
const CANDIDATES = [['py', ['-3']], ['python3', []]];

let out = null;
let usedCmd = null;
let usedPre = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY], { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status === null) continue;
  out = { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  usedCmd = cmd; usedPre = pre;
  break;
}

if (!out) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3).');
  console.log('  NOT VERIFIED here: whether mk_rules matches the document.');
  process.exit(0);
}

if (out.status !== 0) {
  if (/ConfigError|OperationalError|could not connect|connection refused/i.test(out.stderr)) {
    console.log('SKIPPED — mk_rules is not reachable (start the native PostgreSQL 18.4 service, port 5432).');
    console.log(`  ${out.stderr.trim().split('\n').pop().slice(0, 140)}`);
    console.log('  NOT VERIFIED here: whether mk_rules matches the document.');
    process.exit(0);
  }
  console.log(`FAIL: the freshness check could not run — ${out.stderr.trim().split('\n').pop().slice(0, 200)}`);
  process.exit(1);
}

const data = JSON.parse(out.stdout.trim().split('\n').pop());
console.log(`rules on disk: ${data.disk} · current in mk_rules: ${data.stored} · stale: ${data.stale.length} · missing: ${data.missing.length}`);

const problems = [...data.stale, ...data.missing];
if (problems.length) {
  console.log(`${problems.length} rule(s) out of sync:`);
  for (const rid of problems.slice(0, 12)) console.log(`  ~ ${rid}`);
  if (problems.length > 12) console.log(`  ... and ${problems.length - 12} more`);
  console.log('  repairing ...');
  const repair = spawnSync(usedCmd, [...usedPre, join(ROOT, 'scripts', 'build_rules_store.py'), '--doc', DOC], { cwd: ROOT, encoding: 'utf8' });
  console.log(`  ${(repair.stdout ?? '').trim().split('\n').pop() || (repair.stderr ?? '').trim().split('\n').pop()}`);
  if (repair.status !== 0) {
    console.log('FAIL: the repair did not succeed. mk_rules does not match the document.');
    process.exit(1);
  }
  console.log('OK - drift detected and repaired; mk_rules now matches the document.');
  process.exit(0);
}
console.log('OK - every extracted rule matches its content_hash in mk_rules.');
```

- [ ] **Step 2: RED — witness it fail on real drift**

Manually stale a row, then run the gate:

```bash
py -3 -c "
from src.rules_store import config
pg = config.connect_writer(); pg.autocommit = True
with pg.cursor() as cur:
    cur.execute(\"UPDATE rule_revisions SET source_hash = 'deliberately-wrong' WHERE is_current AND rule_id = '10.17'\")
pg.close()
"
node scripts/check-rules-fresh.mjs
```
Expected output includes: `stale: 1` and, since this gate self-heals, ends with `OK - drift detected and
repaired; mk_rules now matches the document.` and exit 0 — the self-heal is the point, matching
`check-geniza-fresh.mjs`'s own design. To witness the **unrepairable** RED specifically, additionally
stop the native PostgreSQL service before the repair step (or run with a bad `RULES_APP_PASSWORD`) so the
repair subprocess itself fails:
Expected: `FAIL: the repair did not succeed. mk_rules does not match the document.`, exit 1.

- [ ] **Step 3: GREEN**

Run: `node scripts/check-rules-fresh.mjs`
Expected: `OK - every extracted rule matches its content_hash in mk_rules.`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-rules-fresh.mjs
git commit -m "feat(rules-store): check-rules-fresh gate — self-healing, SKIPS when mk_rules is down"
```

---

## Task 13: Gate `check-rules-mirror.mjs`

**Files:**
- Create: `scripts/check-rules-mirror.mjs`

**Interfaces:**
- Consumes: `mirror.checksum()` (Task 4, read via a Python snippet) and the same Postgres-side checksum
  computed inline.
- Produces: exit 0 (mirror matches, or SKIPPED), exit 1 (mirror diverged and could not be rebuilt).

- [ ] **Step 1: Write the gate**

```javascript
#!/usr/bin/env node
// check-rules-mirror — rules.sqlite's checksum matches mk_rules's current rows.
//
// detects: rules.sqlite silently diverging from mk_rules — the exact failure mode
//   current_requires_mirror is meant to make structurally impossible for a SINGLE row, but this
//   gate additionally covers the aggregate case (e.g. rules.sqlite edited or replaced by hand, or a
//   stale committed copy from before a document change was synced).
// does NOT detect: a divergence in columns the checksum does not cover (statement text, title_he) —
//   the checksum is over (rule_id, source_hash) pairs only, matching the same tradeoff
//   check-geniza-fresh's content-hash comparison makes: cheap and exactly as strict as
//   current_requires_mirror's own guarantee, no stricter.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR_PATH = join(ROOT, 'rules.sqlite');

const PY = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pathlib import Path
from src.rules_store import config, mirror

mirror_path = Path(${JSON.stringify(MIRROR_PATH)})
if not mirror_path.exists():
    print(json.dumps({"mirror_exists": False}))
else:
    m = mirror.open_mirror(mirror_path)
    mirror_checksum = mirror.checksum(m)

    conn = config.connect_reader(timeout=5)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT rule_id, source_hash FROM rule_revisions WHERE is_current ORDER BY rule_id")
            rows = cur.fetchall()
    finally:
        conn.close()
    import hashlib
    body = "\\n".join(f"{rid}:{h}" for rid, h in rows)
    pg_checksum = hashlib.sha256(body.encode("utf-8")).hexdigest()
    print(json.dumps({"mirror_exists": True, "mirror_checksum": mirror_checksum, "pg_checksum": pg_checksum, "pg_rows": len(rows)}))
`;

const CANDIDATES = [['py', ['-3']], ['python3', []]];
let out = null, usedCmd = null, usedPre = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, '-c', PY], { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status === null) continue;
  out = { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  usedCmd = cmd; usedPre = pre;
  break;
}

if (!out) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3).');
  process.exit(0);
}
if (out.status !== 0) {
  if (/ConfigError|OperationalError|could not connect|connection refused/i.test(out.stderr)) {
    console.log('SKIPPED — mk_rules is not reachable; cannot compare against the mirror.');
    process.exit(0);
  }
  console.log(`FAIL: the mirror check could not run — ${out.stderr.trim().split('\n').pop().slice(0, 200)}`);
  process.exit(1);
}

const data = JSON.parse(out.stdout.trim().split('\n').pop());
if (!data.mirror_exists) {
  console.log(`FAIL: ${MIRROR_PATH} does not exist. repairing ...`);
} else if (data.mirror_checksum === data.pg_checksum) {
  console.log(`OK - rules.sqlite matches mk_rules (${data.pg_rows} current rule(s), checksum ${data.pg_checksum.slice(0, 12)}...).`);
  process.exit(0);
} else {
  console.log(`FAIL: rules.sqlite checksum (${data.mirror_checksum.slice(0, 12)}...) != mk_rules (${data.pg_checksum.slice(0, 12)}...). repairing ...`);
}

const repair = spawnSync(usedCmd, [...usedPre, join(ROOT, 'scripts', 'build_rules_store.py'), '--rebuild-mirror-only'], { cwd: ROOT, encoding: 'utf8' });
console.log(`  ${(repair.stdout ?? '').trim().split('\n').pop() || (repair.stderr ?? '').trim().split('\n').pop()}`);
if (repair.status !== 0) {
  console.log('FAIL: the mirror could not be rebuilt.');
  process.exit(1);
}
console.log('OK - mirror rebuilt from mk_rules and now matches.');
process.exit(0);
```

- [ ] **Step 2: RED — witness it fail on a corrupted mirror**

```bash
rm rules.sqlite  # or: sqlite3 rules.sqlite "DELETE FROM rule_revisions WHERE rule_id='10.17';"
node scripts/check-rules-mirror.mjs
```
Expected: `FAIL: <path>/rules.sqlite does not exist. repairing ...` then, on success,
`OK - mirror rebuilt from mk_rules and now matches.`, exit 0.

- [ ] **Step 3: GREEN**

Run: `node scripts/check-rules-mirror.mjs`
Expected: `OK - rules.sqlite matches mk_rules (<N> current rule(s), checksum ...).`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-rules-mirror.mjs
git commit -m "feat(rules-store): check-rules-mirror gate — checksum comparison, self-healing rebuild"
```

---

## Task 14: Gate `check-rules-complete.mjs`

**Files:**
- Create: `scripts/check-rules-complete.mjs`

**Interfaces:**
- Consumes: `extract_rules()` (Task 7) for the "what should exist" side; `mk_rules`'s current `rule_id`
  set for the "what does exist" side.
- Produces: exit 0 (every extracted rule has a row), exit 1 (a rule was added to the document and never
  reached the store — this gate does NOT self-heal by design, see its own comment).

- [ ] **Step 1: Write the gate**

```javascript
#!/usr/bin/env node
// check-rules-complete — every §10.x/DoD-n/Hn/Ln the extractor finds on disk has a row in mk_rules.
//
// UNLIKE check-rules-fresh and check-rules-mirror, this gate does NOT self-heal by re-running the
// builder silently — it CALLS the same builder and reports the result, because "complete" is the
// exact question sync_document() answers, so repairing and verifying are the same action here; a
// second no-op verification pass would only re-read what the builder itself already reported.
//
// detects: a rule_id extract_rules() finds in the document that has no `is_current` row in
//   mk_rules for that rule_id — the "added and never enforced" failure the spec names in §4.6.
// does NOT detect: a rule enforced under the WRONG bucket/severity (Phase 3-5, out of scope) — this
//   only proves existence, not correct classification.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = 'docs/process/development-discipline.md';

const CANDIDATES = [['py', ['-3']], ['python3', []]];
let out = null, usedCmd = null, usedPre = [];
for (const [cmd, pre] of CANDIDATES) {
  const r = spawnSync(cmd, [...pre, join(ROOT, 'scripts', 'build_rules_store.py'), '--doc', DOC], { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status === null) continue;
  out = r; usedCmd = cmd; usedPre = pre;
  break;
}
if (!out) {
  console.log('SKIPPED — no Python interpreter could be run (tried py -3, python3).');
  process.exit(0);
}
const text = `${out.stdout}${out.stderr}`;
if (/ConfigError|OperationalError|could not connect|connection refused/i.test(text)) {
  console.log('SKIPPED — mk_rules is not reachable.');
  process.exit(0);
}
console.log(out.stdout.trim());
if (out.status !== 0) {
  console.log('FAIL: build_rules_store.py did not complete — see FAILED line above.');
  process.exit(1);
}
console.log('OK - the builder ran to completion; every extracted rule now has a row in mk_rules (added/updated/unchanged all count as present).');
process.exit(0);
```

- [ ] **Step 2: RED — witness it fail on an unparseable document**

```bash
cp docs/process/development-discipline.md /tmp/dd-backup.md
printf '\n### 10.X Rule\n\nstatement one.\n\n### 10.X Rule again\n\nstatement two.\n' >> docs/process/development-discipline.md
node scripts/check-rules-complete.mjs
```
Expected: the builder's `extract_rules()` raises `ValueError: rule_id '10.X' claimed by more than one
shape ...`, so `build_rules_store.py` prints `FAILED: ValueError: rule_id '10.X' claimed by more than
one shape...` and exits 1; the gate then prints `FAIL: build_rules_store.py did not complete — see FAILED
line above.`, exit 1.
Restore: `cp /tmp/dd-backup.md docs/process/development-discipline.md`

- [ ] **Step 3: GREEN**

Run: `node scripts/check-rules-complete.mjs`
Expected: `added: 0 · updated: 0 · unchanged: <N> · retired: 0` then `OK - the builder ran to completion;
every extracted rule now has a row in mk_rules ...`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-rules-complete.mjs
git commit -m "feat(rules-store): check-rules-complete gate"
```

**Phase 1 ends here.** The rules are queryable and verifiable end to end: extractor → builder → `mk_rules`
→ mirror → three gates, none of them yet wired into `check-meta.mjs`, `.githooks`, or `.claude/settings.json`
(Phase 6).

---

## Task 15: `scripts/watchman.ps1` — the `Invoke-ComponentCheck` engine

**Files:**
- Create: `scripts/watchman.ps1`
- Create: `scripts/tests/test-watchman-engine.mjs`

**Interfaces:**
- Consumes: nothing from Phase 1 directly (this task is the generic engine; Tasks 16-21 register
  components against it).
- Produces: the PowerShell function `Invoke-ComponentCheck` with parameters `-Name`, `-Severity`
  (`warn`|`block`), `-Detect` (scriptblock returning `$true`/`$false`), `-Recover` (scriptblock, only
  called when `-Detect` returns `$false`), `-Verify` (scriptblock, called after `-Recover`, returning
  `$true`/`$false` — the "confirm it actually answers" step), `-MaxRecoverWaitSeconds` (default 60). It
  returns a `[pscustomobject]` with `Name, Severity, InitialOk, Recovered, FinalOk, ElapsedSeconds,
  Detail`.

- [ ] **Step 1: Write the failing Node-driven test**

The test spawns `powershell -File scripts/watchman.ps1 -SelfTest` — a mode this task adds specifically so
the engine's retry/recovery loop can be proven without touching any real infrastructure. Self-test mode
registers three fake components (always-ok, down-then-recovers, down-forever) and prints one JSON line
per component; the Node test asserts on that JSON, never on real Postgres/ollama/serena.

```javascript
// scripts/tests/test-watchman-engine.mjs
// RED/GREEN proof for Invoke-ComponentCheck's retry/recovery loop — no real infrastructure touched.
// `-SelfTest` registers three deterministic fake components:
//   always-ok        : Detect always true -> InitialOk=true, Recovered=false, FinalOk=true
//   down-then-recovers: Detect false once, then true; Recover flips a flag; Verify true after Recover
//   down-forever     : Detect always false; Recover runs; Verify always false -> FinalOk=false
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'watchman.ps1');

const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-SelfTest'], {
  encoding: 'utf8', cwd: ROOT,
});

let failures = 0;
function check(label, cond) {
  if (!cond) { failures++; console.error(`FAIL  ${label}`); } else { console.log(`PASS  ${label}`); }
}

check('exits non-zero because down-forever is a BLOCK-severity component', r.status !== 0);

const lines = (r.stdout || '').trim().split('\n').filter((l) => l.trim().startsWith('{'));
const rows = lines.map((l) => JSON.parse(l));
const byName = Object.fromEntries(rows.map((row) => [row.Name, row]));

check('always-ok: InitialOk true, Recovered false, FinalOk true',
  byName['always-ok']?.InitialOk === true && byName['always-ok']?.Recovered === false && byName['always-ok']?.FinalOk === true);
check('down-then-recovers: InitialOk false, Recovered true, FinalOk true',
  byName['down-then-recovers']?.InitialOk === false && byName['down-then-recovers']?.Recovered === true && byName['down-then-recovers']?.FinalOk === true);
check('down-forever: InitialOk false, FinalOk false, Severity block',
  byName['down-forever']?.InitialOk === false && byName['down-forever']?.FinalOk === false && byName['down-forever']?.Severity === 'block');
check('down-then-recovers reports a "recovered:" line with elapsed seconds',
  /recovered: down-then-recovers after \d/.test(r.stdout));

console.log(`\n${3 - Math.min(3, failures)}/3+ checks passed.`);
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-watchman-engine.mjs`
Expected FAILURE MESSAGE (before `watchman.ps1` exists): a PowerShell error on stderr resembling
`The system cannot find the file specified` and `r.status !== 0` check passes accidentally but every
`byName[...]` lookup is `undefined`, so the `.InitialOk === true` etc. comparisons fail —
`FAIL  always-ok: InitialOk true, Recovered false, FinalOk true` (and the two lines after it).

- [ ] **Step 3: Write the minimal engine + self-test mode**

```powershell
# scripts/watchman.ps1 (this task's slice — Tasks 16-21 append the six real components below the
# marker `# === REAL COMPONENTS ===`)
<#
.SYNOPSIS
  Layer 0 — the watchman (spec §8). Detects and automatically recovers infrastructure components,
  with VERIFIED (not assumed) success reporting: "the command ran" is not "it recovered" (§8.2).

.DESCRIPTION
  Runs each registered component through Invoke-ComponentCheck: Detect -> (if down) Recover ->
  Verify. Severity (warn/block) follows the spec's severity test (§2, §8.1): a component whose
  failure only costs efficiency (grep instead of Serena) is a warning; a component whose failure
  removes a capability with no equivalent alternative (rules.sqlite, the pre-commit hooks) blocks.

  -SelfTest mode registers three FAKE components with no real side effects, so the recovery ENGINE
  itself can be proven correct without touching Postgres, ollama, or serena — see
  scripts/tests/test-watchman-engine.mjs. Every real component (Tasks 16-21) is layered on the same
  engine, so a bug in the engine is caught once, not six times.

.PARAMETER SelfTest
  Run the three fake components instead of the real ones. Exit code and JSON-lines output are
  otherwise identical in shape to a real run.
#>
[CmdletBinding()]
param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $RepoRoot '.superpowers\watchman-log.jsonl'

function Invoke-ComponentCheck {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [ValidateSet('warn', 'block')] [string]$Severity,
        [Parameter(Mandatory)] [scriptblock]$Detect,
        [Parameter(Mandatory)] [scriptblock]$Recover,
        [Parameter(Mandatory)] [scriptblock]$Verify,
        [int]$MaxRecoverWaitSeconds = 60
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $initialOk = & $Detect
    $recovered = $false
    $finalOk = $initialOk
    $detail = if ($initialOk) { 'already ok' } else { 'down at detect' }

    if (-not $initialOk) {
        & $Recover
        $deadline = (Get-Date).AddSeconds($MaxRecoverWaitSeconds)
        while ((Get-Date) -lt $deadline) {
            if (& $Verify) { $finalOk = $true; $recovered = $true; break }
            Start-Sleep -Milliseconds 500
        }
        $detail = if ($recovered) { "recovered after $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" } else { "recovery attempted, still down after ${MaxRecoverWaitSeconds}s" }
    }
    $sw.Stop()

    $result = [pscustomobject]@{
        Name           = $Name
        Severity       = $Severity
        InitialOk      = $initialOk
        Recovered      = $recovered
        FinalOk        = $finalOk
        ElapsedSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        Detail         = $detail
        TimestampUtc   = (Get-Date).ToUniversalTime().ToString('o')
    }
    if ($recovered) {
        Write-Output "recovered: $Name after $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
    } elseif (-not $finalOk) {
        Write-Output "$Severity : $Name did not recover — $detail"
    }
    return $result
}

function Write-WatchmanLog($results) {
    $dir = Split-Path -Parent $LogFile
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    foreach ($r in $results) {
        ($r | ConvertTo-Json -Compress) | Add-Content -Path $LogFile
    }
}

function Get-SelfTestResults {
    $script:downThenRecoversCalls = 0
    $script:downThenRecoversFixed = $false

    $r1 = Invoke-ComponentCheck -Name 'always-ok' -Severity 'warn' `
        -Detect { $true } -Recover { } -Verify { $true }

    $r2 = Invoke-ComponentCheck -Name 'down-then-recovers' -Severity 'warn' `
        -Detect { $false } `
        -Recover { $script:downThenRecoversFixed = $true } `
        -Verify { $script:downThenRecoversFixed }

    $r3 = Invoke-ComponentCheck -Name 'down-forever' -Severity 'block' -MaxRecoverWaitSeconds 1 `
        -Detect { $false } -Recover { } -Verify { $false }

    return @($r1, $r2, $r3)
}

$results = if ($SelfTest) { Get-SelfTestResults } else {
    # === REAL COMPONENTS === (Tasks 16-21 append @() entries here, in severity-appropriate order)
    @()
}

foreach ($r in $results) { ($r | ConvertTo-Json -Compress) | Write-Output }
Write-WatchmanLog $results

$blocked = $results | Where-Object { $_.Severity -eq 'block' -and -not $_.FinalOk }
if ($blocked) {
    Write-Output "`nWATCHMAN BLOCK: $($blocked.Name -join ', ') did not recover."
    exit 1
}
Write-Output "`nWATCHMAN OK (warn-severity failures, if any, are reported above but do not block)."
exit 0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-watchman-engine.mjs`
Expected: `PASS` on all four checks, `4/3+ checks passed.` (harmless off-by-label in the summary line —
4 checks ran, 3 named plus the exit-code check), process exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/watchman.ps1 scripts/tests/test-watchman-engine.mjs
git commit -m "feat(watchman): Invoke-ComponentCheck engine, proved with a self-test mode"
```

---

## Task 16: Watchman component — hooks wired (block)

**Files:**
- Modify: `scripts/watchman.ps1`

**Interfaces:**
- Consumes: `Invoke-ComponentCheck` (Task 15).
- Produces: one more entry in the `# === REAL COMPONENTS ===` array.

- [ ] **Step 1: Write the failing test — break it for real, safely**

This component's detect/recover touches only `git config`, which is trivially safe to unset and restore.

```bash
# manual RED, safe and reversible
git config --unset core.hooksPath
powershell -NoProfile -File scripts/watchman.ps1 2>&1 | grep -i hooks
```
Expected (before Step 2's implementation exists): no `hooks` component appears at all — the array is
still empty for real (non-self-test) runs.

- [ ] **Step 2: Add the component**

```powershell
# insert inside the `else { @( ... ) }` block in scripts/watchman.ps1, replacing `@()`
$hooksResult = Invoke-ComponentCheck -Name 'hooks' -Severity 'block' `
    -Detect {
        $current = (git -C $RepoRoot config --get core.hooksPath 2>$null)
        $current -eq '.githooks' -and
            (Test-Path (Join-Path $RepoRoot '.githooks\pre-commit')) -and
            (Test-Path (Join-Path $RepoRoot '.githooks\commit-msg'))
    } `
    -Recover { git -C $RepoRoot config core.hooksPath .githooks } `
    -Verify { (git -C $RepoRoot config --get core.hooksPath 2>$null) -eq '.githooks' }

@($hooksResult)
```

- [ ] **Step 3: Run the RED scenario against the real implementation**

```bash
git config --unset core.hooksPath
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1
```
Expected: a line `recovered: hooks after 0.0s` (or similar sub-second value) in the output, and the JSON
line for `"Name":"hooks"` shows `"InitialOk":false,"Recovered":true,"FinalOk":true`.

- [ ] **Step 4: GREEN — confirm it stays quiet when already correct**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1`
Expected: the `hooks` JSON line shows `"InitialOk":true,"Recovered":false,"FinalOk":true`, and no
`recovered:` line for `hooks` (Step 4 of `Invoke-ComponentCheck`'s own logic only prints that line when
`$recovered` is true).

- [ ] **Step 5: Commit**

```bash
git add scripts/watchman.ps1
git commit -m "feat(watchman): hooks-wired component (block) — git config core.hooksPath"
```

---

## Task 17: Watchman component — `rules.sqlite` mirror (block)

**Files:**
- Modify: `scripts/watchman.ps1`

**Interfaces:**
- Consumes: `check-rules-mirror.mjs`'s checksum logic (Task 13), reused via `node`; `build_rules_store.py
  --rebuild-mirror-only` (Task 11).
- Produces: one more `# === REAL COMPONENTS ===` entry.

- [ ] **Step 1: RED — break the mirror, safely (it is derived; deleting it is reversible by rebuild)**

```bash
rm rules.sqlite
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1 2>&1 | grep -i "rules-mirror\|recovered: rules"
```
Expected (before Step 2 exists): nothing — the component is not registered yet.

- [ ] **Step 2: Add the component**

```powershell
$rulesMirrorResult = Invoke-ComponentCheck -Name 'rules-mirror' -Severity 'block' `
    -Detect {
        $r = node (Join-Path $RepoRoot 'scripts\check-rules-mirror.mjs') 2>&1
        $LASTEXITCODE -eq 0 -and $r -match 'OK - rules.sqlite matches'
    } `
    -Recover {
        py -3 (Join-Path $RepoRoot 'scripts\build_rules_store.py') --rebuild-mirror-only *> $null
    } `
    -Verify {
        $r = node (Join-Path $RepoRoot 'scripts\check-rules-mirror.mjs') 2>&1
        $LASTEXITCODE -eq 0 -and $r -match 'OK'
    }

@($hooksResult, $rulesMirrorResult)
```

(Note: this component's `-Detect` calling `check-rules-mirror.mjs`, which is itself self-healing, means
the FIRST call may already repair a small drift and return OK — that is fine and intended: the gate and
the watchman share the same recovery action by design, so there is exactly one place that decides "is the
mirror fine", not two that could disagree. A hard failure — e.g. the mirror file deleted, or `mk_rules`
briefly unreachable during `-Detect` — is what makes `-Detect` return non-zero and triggers the explicit
`-Recover` step here.)

- [ ] **Step 3: Run the RED scenario against the real implementation**

```bash
rm rules.sqlite
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1
```
Expected: `recovered: rules-mirror after <N>s` in the output, `rules.sqlite` exists again on disk
afterward, and the JSON line for `"Name":"rules-mirror"` shows `"Recovered":true,"FinalOk":true`.

- [ ] **Step 4: GREEN**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1`
Expected: `"Name":"rules-mirror","Severity":"block","InitialOk":true,...,"FinalOk":true`.

- [ ] **Step 5: Commit**

```bash
git add scripts/watchman.ps1 rules.sqlite
git commit -m "feat(watchman): rules-mirror component (block) — rebuild-mirror-only recovery"
```

---

## Task 18: Watchman component — `mk_rules` native PostgreSQL (warn)

**Files:**
- Modify: `scripts/watchman.ps1`

**Interfaces:**
- Consumes: `RULES_SERVICE_NAME` from `infra/rules-db/.env` (Task 1, Step 4); `pg_isready.exe` (installed
  alongside PostgreSQL, on PATH after install).
- Produces: one more `# === REAL COMPONENTS ===` entry.

- [ ] **Step 1: Write the component (RED/GREEN verified live per Step 2 — stopping a Windows service in
an automated unattended test is out of proportion to what it proves beyond the self-test engine already
covers; this follows the same precedent as `check-geniza-fresh.mjs` having no fixture-based self-test —
verified manually against the real service, documented here rather than mocked)**

```powershell
function Get-RulesDbEnv {
    $envFile = Join-Path $RepoRoot 'infra\rules-db\.env'
    if (-not (Test-Path $envFile)) { return $null }
    $vars = @{}
    Get-Content $envFile | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
        $k, $v = $_ -split '=', 2
        $vars[$k] = $v
    }
    return $vars
}

$rulesDbEnv = Get-RulesDbEnv
$rulesPgResult = if ($rulesDbEnv -and $rulesDbEnv.RULES_SERVICE_NAME) {
    Invoke-ComponentCheck -Name 'mk_rules-postgres' -Severity 'warn' `
        -Detect {
            $r = & pg_isready -h 127.0.0.1 -p $rulesDbEnv.RULES_POSTGRES_PORT -d $rulesDbEnv.RULES_POSTGRES_DB 2>&1
            $LASTEXITCODE -eq 0
        } `
        -Recover {
            Start-Service -Name $rulesDbEnv.RULES_SERVICE_NAME -ErrorAction SilentlyContinue
        } `
        -Verify {
            $r = & pg_isready -h 127.0.0.1 -p $rulesDbEnv.RULES_POSTGRES_PORT -d $rulesDbEnv.RULES_POSTGRES_DB 2>&1
            $LASTEXITCODE -eq 0
        }
} else {
    [pscustomobject]@{ Name = 'mk_rules-postgres'; Severity = 'warn'; InitialOk = $false; Recovered = $false; FinalOk = $false; ElapsedSeconds = 0; Detail = 'infra/rules-db/.env missing or RULES_SERVICE_NAME not set'; TimestampUtc = (Get-Date).ToUniversalTime().ToString('o') }
}

@($hooksResult, $rulesMirrorResult, $rulesPgResult)
```

- [ ] **Step 2: RED — witness it live**

```powershell
Stop-Service -Name $env:RULES_SERVICE_NAME   # the exact name recorded in infra/rules-db/.env
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1
```
Expected: `recovered: mk_rules-postgres after <N>s` — `pg_isready` fails immediately after `Stop-Service`,
`Start-Service` runs, and the verify loop polls `pg_isready` until it answers (typically a few seconds for
a native service, much faster than the WSL/Docker case).

- [ ] **Step 3: GREEN**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1`
Expected: `"Name":"mk_rules-postgres","Severity":"warn","InitialOk":true,...,"FinalOk":true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/watchman.ps1
git commit -m "feat(watchman): mk_rules-postgres component (warn) — native Windows service recovery"
```

---

## Task 19: Watchman component — geniza Docker/Postgres (warn)

**Files:**
- Modify: `scripts/watchman.ps1`

**Interfaces:**
- Consumes: the proven sequence from `scripts/run-extraction.ps1` (`wsl -u root service docker start` →
  `docker compose up -d` → poll `pg_isready` inside `mk-postgres`), adapted into detect/recover/verify
  form rather than copy-pasted procedurally.
- Produces: one more `# === REAL COMPONENTS === entry`.

- [ ] **Step 1: Write the component**

```powershell
function Test-GenizaPostgresReady {
    $r = wsl -e bash -lc "docker exec mk-postgres pg_isready -h 127.0.0.1 -q && echo READY" 2>$null
    return ($r -match 'READY')
}

$genizaResult = Invoke-ComponentCheck -Name 'geniza-postgres' -Severity 'warn' -MaxRecoverWaitSeconds 300 `
    -Detect { Test-GenizaPostgresReady } `
    -Recover {
        wsl -u root -e bash -lc "service docker start" *> $null
        wsl -e bash -lc "cd /mnt/c/Users/dudib/source/repos/matconetesh/infra && docker compose up -d" *> $null
    } `
    -Verify { Test-GenizaPostgresReady }

@($hooksResult, $rulesMirrorResult, $rulesPgResult, $genizaResult)
```

(`-MaxRecoverWaitSeconds 300` matches `run-extraction.ps1`'s own proven 60×5s budget for the same
operation — the WSL/Docker cold-start is genuinely slower than the native service in Task 18, and copying
a shorter timeout here would turn a real recovery into a false FinalOk=false.)

- [ ] **Step 2: RED — witness it live**

```bash
wsl -u root -e bash -lc "service docker stop"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1
```
Expected: `recovered: geniza-postgres after <N>s` where `<N>` is on the order of tens of seconds (Docker
daemon start + container boot + `pg_isready` — matching `run-extraction.ps1`'s own observed "postgres
answered after 5-30s" range once the daemon is up).

- [ ] **Step 3: GREEN**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1`
Expected: `"Name":"geniza-postgres","Severity":"warn","InitialOk":true,...,"FinalOk":true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/watchman.ps1
git commit -m "feat(watchman): geniza-postgres component (warn) — wsl -u root + compose up -d, adapted from run-extraction.ps1"
```

---

## Task 20: Watchman component — ollama (warn/conditional, real embed verification)

**Files:**
- Modify: `scripts/watchman.ps1`

**Interfaces:**
- Consumes: `POST http://127.0.0.1:11434/api/embeddings` with `model=bge-m3` (matching `src/knowledge/config.py`'s `EMBED_MODEL`/`OLLAMA_URL`).
- Produces: one more `# === REAL COMPONENTS ===` entry.

- [ ] **Step 1: Write the component**

```powershell
function Test-OllamaEmbeds {
    try {
        $body = @{ model = 'bge-m3'; prompt = 'watchman health probe' } | ConvertTo-Json -Compress
        $r = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/embeddings' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 15
        return ($r.embedding -and $r.embedding.Count -eq 1024)
    } catch { return $false }
}

$ollamaResult = Invoke-ComponentCheck -Name 'ollama' -Severity 'warn' -MaxRecoverWaitSeconds 60 `
    -Detect { Test-OllamaEmbeds } `
    -Recover {
        Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 5 | Out-Null }
        catch { Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }
    } `
    -Verify { Test-OllamaEmbeds }

@($hooksResult, $rulesMirrorResult, $rulesPgResult, $genizaResult, $ollamaResult)
```

(`-Detect` and `-Verify` are the SAME real-embed call, on purpose: the spec's whole point for ollama —
"קילל → הטריי מרים → בדיקת embed אמיתית" — is that a listening port is not proof the model answers, so
neither detect nor verify may settle for less than the real call.)

- [ ] **Step 2: RED — witness it live**

```bash
# kill ollama the same way the watchman's own recovery does, so the test proves the FULL cycle
powershell -Command "Get-Process -Name 'ollama*' | Stop-Process -Force"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1
```
Expected: `recovered: ollama after <N>s` (spec §8.2 measured this at ~4.2s cold-start once relaunched); the
JSON line shows `"InitialOk":false,"Recovered":true,"FinalOk":true`.

- [ ] **Step 3: GREEN**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1`
Expected: `"Name":"ollama","Severity":"warn","InitialOk":true,...,"FinalOk":true`.

- [ ] **Step 4: Commit**

```bash
git add scripts/watchman.ps1
git commit -m "feat(watchman): ollama component (warn) — kill/relaunch, verified by a real embed call, not a port probe"
```

---

## Task 21: Watchman component — serena (warn)

**Files:**
- Modify: `scripts/watchman.ps1`

**Interfaces:**
- Consumes: `scripts/serena-server.ps1 -Action status|restart` (existing, unmodified — its own `Show-Status`
  already sets `$script:StatusOk` and exits non-zero on failure, per §10.17a).
- Produces: one more `# === REAL COMPONENTS ===` entry — the last one, completing the array this task
  finalizes.

- [ ] **Step 1: Write the component**

```powershell
function Test-SerenaUp {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\serena-server.ps1') -Action status *> $null
    return ($LASTEXITCODE -eq 0)
}

$serenaResult = Invoke-ComponentCheck -Name 'serena' -Severity 'warn' -MaxRecoverWaitSeconds 90 `
    -Detect { Test-SerenaUp } `
    -Recover {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot 'scripts\serena-server.ps1') -Action restart *> $null
    } `
    -Verify { Test-SerenaUp }

$results = @($hooksResult, $rulesMirrorResult, $rulesPgResult, $genizaResult, $ollamaResult, $serenaResult)
```

Replace the `# === REAL COMPONENTS ===` block's final line (`@($hooksResult, ...)` from Task 20) with the
`$results = @(...)` assignment above, and change the outer `$results = if ($SelfTest) { ... } else { ...
}` block's `else` body to end with `$results` (not a bare array literal) — i.e. this task is what finally
makes all six components live in one array, replacing every intermediate task's shorter array literal.

- [ ] **Step 2: RED — witness it live**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/serena-server.ps1 -Action stop
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1
```
Expected: `recovered: serena after <N>s` (serena-server.ps1's own `-Action start` waits up to 90s for the
port to listen, matching this component's `-MaxRecoverWaitSeconds 90`); JSON line shows
`"InitialOk":false,"Recovered":true,"FinalOk":true`.

- [ ] **Step 3: GREEN — the full six-component run**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watchman.ps1`
Expected: six JSON lines (`hooks`, `rules-mirror`, `mk_rules-postgres`, `geniza-postgres`, `ollama`,
`serena`), all `"FinalOk":true`, ending with `WATCHMAN OK (warn-severity failures, if any, are reported
above but do not block).`, exit 0.

- [ ] **Step 4: Re-run the engine self-test once more, to confirm Tasks 16-21 did not disturb it**

Run: `node scripts/tests/test-watchman-engine.mjs`
Expected: `PASS` on all checks, exit 0 — proves `-SelfTest` mode is untouched by the real-component wiring
added around it.

- [ ] **Step 5: Commit**

```bash
git add scripts/watchman.ps1
git commit -m "feat(watchman): serena component (warn) — completes the six-component layer 0"
```

**Phase 2 ends here.** `scripts/watchman.ps1` detects and automatically recovers all six components named
in spec §8.1, each with a verified (not assumed) success check, JSON-lines reporting to
`.superpowers/watchman-log.jsonl`, and a self-test mode that proves the recovery engine independent of any
single component. Nothing here is yet scheduled (spec §8.3: "פתיחה · resume · אחרי compact · לפני סוויטה ·
כל 30 דקות · `/enforce`") or wired into `SessionStart`/`check-meta.mjs`/`.claude/settings.json` — that
scheduling and wiring is Phase 6, out of scope for this plan.

---

## Self-Review

**Spec coverage — §4, task by task:**
- §4.1 two databases, each to its role → Task 1 (native `mk_rules`) vs the existing geniza (unchanged);
  hooks read the mirror (Task 4), deep audit reads Postgres (Task 3).
- §4.2 direction of truth, builder derives from disk not git → Task 10 (dedicated proof).
- §4.3 schema, `rule_id` stable human key, `current_requires_mirror` → Task 2 (schema), Task 2/3 (proof).
- §4.4 lifecycle (added/updated/unchanged/retired, never deleted) → Task 9 (all four transitions tested).
- §4.5 write order, crash safety → Task 8.
- §4.6 three gates → Tasks 12-14.
- §4.7 "extending the geniza" (history + reasoning) — **partial, flagged below.**

**Spec coverage — §8, task by task:**
- §8.1 severity table → Task 15's engine takes `-Severity` per component; Tasks 16 (hooks, block), 17
  (rules-mirror, block), 18 (mk_rules-postgres, warn), 19 (geniza-postgres, warn), 20 (ollama, warn), 21
  (serena, warn) match the table's six severities exactly (the table's "ollama: conditional" is
  implemented as warn with a real-embed verify, since Phase 2's scope note says "automatic recovery and
  success reporting" without a separate conditional-severity mechanism — see judgement call below).
- §8.2 automatic recovery, verified not assumed → every component's `-Verify` block re-runs the real
  check, never trusts "the command ran" (explicit in Tasks 18-21's own text, echoing the spec's own
  `docker compose ... Running != ready` example).
- §8.3 "when it runs" → explicitly named out of scope (Phase 6 wiring) in the plan header and again after
  Task 21.
- §9 "every checker must prove it can fail on bad input... recovery is tested by deliberately breaking a
  component" → every gate task (12-14) and every watchman component task (16-21) has a live RED step; the
  engine itself (Task 15) has an automated, repeatable test.

**Gap found and fixed during self-review:** the first draft of this plan left `rule_probes` (spec §4.3)
completely unpopulated with no task ever writing to it — the table existed but nothing used it. Re-reading
spec §13.4 ("שלושה הדוגמאות... יישמרו ב-rule_probes"), `rule_probes` is explicitly for the §10.22 few-shot
judge examples, which belongs to **Phase 5 (Group C, out of scope)**. The table is created empty in Task
2's migration and intentionally left unpopulated here — noted in the migration's own file rather than
silently omitted, so a future reader of this plan does not conclude it was forgotten.

**Judgement calls made, and why (spec ambiguity):**

1. ~~**Port 5432 / native Windows service vs the geniza's WSL/Docker 5433.**~~ **WRONG, corrected by the
   controller before any task ran.** `infra/.env.example` still says 5433, but the LIVE `infra/.env` says
   5432: the geniza was migrated off Docker onto the native service earlier the same day, and the 5433
   container holds a superseded copy. Verified by listing databases on both. `mk_rules` is therefore a
   second DATABASE on the same native server, not a second server. The lesson is the project's own: a
   `.example` file is not the running configuration. The original reasoning below is kept as a record of
   what was assumed. ~~I treated this as a deliberate,
   already-decided architectural split — it is also the only way to honor spec §4.1's own claim ("Docker
   למטה? ל-hook לא אכפת") for the *deep-audit/Postgres* side, not just the SQLite-mirror side: if `mk_rules`
   lived in the same Docker container as the geniza, a Docker outage would take down both, undermining the
   6.8.26 02:27 incident the spec cites as its motivating example. I built Task 1 around a genuinely
   separate native service rather than a second schema or a second WSL container.

2. **`ollama`'s "conditional" severity (§8.1) has no third severity value defined anywhere in the spec.**
   I implemented it as `warn` with the real-embed `-Verify` the spec itself demands, rather than inventing
   a new severity tier the engine (Task 15) would need to special-case. If a genuinely different behavior
   for "conditional" is wanted (e.g., block only when the §10.22 judge — Phase 5, out of scope — is about
   to run), that is a Phase 5 concern and should be resolved when that plan is written, not invented here.

3. **RED/GREEN proof for the three gates and the five real watchman components is demonstrated live
   against the real (or, for Task 15's engine, a self-test) rather than a mocked `scripts/tests/test-*.mjs`
   fixture.** This mirrors the existing precedent set by `check-geniza-fresh.mjs`, which has no fixture
   test in `scripts/tests/` for the same reason: it needs a real, reachable Postgres to say anything
   meaningful, and a fixture would either mock so much of psycopg2 that it stopped testing the real gate,
   or would need a disposable Postgres instance this repo does not currently spin up for tests. Task 15's
   engine — the one piece that is pure control-flow with no real dependency — gets the automated,
   repeatable Node test (`test-watchman-engine.mjs`); the components layered on it are proven live, per
   task, with the exact expected output quoted.

4. **`rule_probes`'s primary key and `rule_revisions.retired_at`** are not specified in the spec's literal
   §4.3 DDL. `rule_probes` needed *some* PK (I used `uuid PRIMARY KEY DEFAULT gen_random_uuid()`, matching
   `rule_revisions.revision_id`'s own convention). `retired_at` was added because the spec's own lifecycle
   table (§4.4) says "retired עם תאריך" (retired **with a date**) but the §4.3 DDL block has no date column
   for it — I added the column rather than overload `created_at` (which already means "revision created",
   not "revision retired") or infer the date from a second row's `created_at` (which would silently break
   if a rule is later un-retired and re-added, since `content_hash` uniqueness makes that a legitimate new
   revision, not an edit of the retired one).

**Placeholder scan:** no "TBD", "similar to Task N", or "add error handling" strings remain — every step
either shows the exact code or the exact command and expected output.

**Type/name consistency check:** `RuleRecord` (Task 5) is imported unchanged through Tasks 6, 7, 8, 9;
`sync_rule` (Task 8) is called by name in Task 9's `sync_document`; `sync_document` (Task 9) is called by
name in Task 11's CLI and Task 21's spec-coverage table; `extract_rules` (Task 7) is called by name in
Task 9, Task 12 (the gate), and Task 14 (the gate); `checksum` (Task 4) is recomputed inline (not
re-imported) inside Task 13's gate for the Postgres side, but named identically and documented as
computing the same `(rule_id, source_hash)` shape — flagged here rather than left implicit, since the gate
runs in a spawned Python one-liner and cannot literally `import` `mirror.checksum` without also importing
the whole module tree, which the one-liner does for the SQLite side but re-derives inline for the Postgres
side for symmetry within that single script.
