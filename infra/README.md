# infra/ — the knowledge stack

PostgreSQL + pgvector and Neo4j Community, for the GraphRAG layer. **Not** the application's
embedded SQLite: `agent-memory.db` stays exactly where it is, owned by the app, untouched.

## Running it

```bash
# The daemon does not auto-start: WSL2 has no systemd, so this is the SysV path.
wsl -d Ubuntu-20.04 -u root -e bash -lc 'service docker start'

wsl -d Ubuntu-20.04 -u root -e bash -lc \
  'cd /mnt/c/Users/dudib/source/repos/matconetesh/infra && docker compose up -d'

# stop, keeping all data
... 'cd .../infra && docker compose down'

# stop and DESTROY the volumes — only ever after checking what is in them
... 'cd .../infra && docker compose down -v'
```

Both services answer on Windows at `127.0.0.1` — verified, not assumed. That is where the
project's Python (3.14.6, on Windows) connects from.

| service | port | what it is |
|---|---|---|
| PostgreSQL 18.4 + pgvector 0.8.6 | `127.0.0.1:5433` | authoritative store |
| Neo4j 2026.06.0 Community — HTTP | `127.0.0.1:7474` | browser |
| Neo4j — Bolt | `127.0.0.1:7687` | driver |

Credentials live in `infra/.env`, which is gitignored. `infra/.env.example` carries the variable
NAMES only. Nothing here is reachable from the network: the `127.0.0.1:` prefix on each port
mapping is load-bearing — `"5433:5432"` alone would publish on `0.0.0.0`.

## Why Docker Engine in WSL2 rather than Docker Desktop

Docker Desktop needs a reboot to join `docker-users`, and the owner works remotely and cannot
reboot. Docker Engine installs inside WSL2 with none of that. Ubuntu 20.04 is EOL and Docker's
script warns about it; packages are still published (168 builds for focal) and it works. **The
distro upgrade is an open item.**

`wsl -u root` gives root with no password because the Windows user is already authenticated —
which is what makes every operation here unattended. `wsl -e bash -lc 'sudo …'` has no TTY and
fails silently instead; see L51.

## The roles, and why there are three

| role | may | used by |
|---|---|---|
| `mk_admin` | superuser | the container entrypoint at first boot, and nothing else |
| `mk_app` | connect, create in `public` | the single ingestion worker |
| `mk_reader` | connect, `SELECT` only — `CREATE` is **denied**, verified | every retrieval tool a subagent can reach |

A retrieval path that is compromised or confused has no write verb available to it at all. That
is enforced by PostgreSQL, not by the tool's own good behaviour.

## The Neo4j limitation, stated rather than glossed

**Community edition has no multi-user role management.** There is one credential, and it can
write. A read-only Neo4j role — the equivalent of `mk_reader` — is an Enterprise feature. Until
that changes, read-only graph access is enforced at the **tool layer**: parameterised queries
only, no text-to-Cypher exposed to agents, label and relationship allowlists, timeouts and depth
limits. That is a weaker guarantee than PostgreSQL's and it should be read as one.

## Version pinning

Every image is pinned to an exact version, never `latest`. The owner asked for "always the
newest"; a floating tag delivers that today and then silently swaps a database engine under a
future `docker compose pull`. Pinning the newest version number gives the same software with a
change that appears in a diff. See L52 — the newest of both components had moved its contract.

The same principle runs into a wall on the **Python client**, and the wall is worth naming.
`llama-index-graph-stores-neo4j 0.7.0` declares `neo4j<6,>=5.16.0`, so pip resolves the driver to
5.x. The owner ruled on 2026-08-05 that we run **6.2** anyway, on the grounds that the decision is
not only about backward compatibility — 6.x carries a `Result` iteration speed-up, two
connection-timeout fixes, and two fixes that are specific to **Windows**, the platform this project
develops on.

Overriding a declared constraint is not free, and the cost is visible rather than hidden:

```
python -m pip install -r requirements.txt
python -m pip install --no-deps -r requirements-overrides.txt   # NOT optional

pip check   # reports: llama-index-graph-stores-neo4j 0.7.0 has requirement neo4j<6,>=5.16.0,
            #          but you have neo4j 6.2.0
```

**That `pip check` line is expected. It is the override, not a fault.** It is left visible on
purpose — a suppressed warning is how a deliberate exception turns into a mystery six months on.

Why it is safe, established by evidence rather than hope: the integration touches four driver APIs
(`neo4j.Query`, `execute_query`, `session`, `close`), none of which appears in driver 6.0's removal
list; upstream shipped 0.7.0 five and a half months AFTER driver 6.0 without testing it, and tracks
no issue about relaxing the pin; and the full graph round-trip passes identically under both
drivers against the live server. It is held in place by `tests/test_infra_deps.py`, which fails
when pip silently reverts the driver **and** fails once upstream relaxes the constraint — so the
workaround cannot outlive its reason.
