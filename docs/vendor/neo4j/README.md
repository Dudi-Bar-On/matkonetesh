# Neo4j vendor documentation corpus

**Version described:** Neo4j **2026.06.0** (Cypher docs also pinned to the `2026.06.0` tag; the
getting-started tutorials below have no per-version tags upstream, so they are pinned to the `dev`
branch instead — see per-file source comments).

**Why this exists:** `docs/process/development-discipline.md` §10.11 requires querying the geniza
before the web, and researching + ingesting when it misses. Neo4j was the only vendor dependency of
this project with no corpus under `docs/vendor/` — every other one (`playwright`, `serena`,
`llamaindex`, `ollama`, `tree-sitter`, `bge-m3`, `sqlite`, `claude-code`, `lit`, `pi`, `bmad`, `gsd`)
already had one. Collected 2026-08-07 ahead of the arc that moves this project's Neo4j instance out
of Docker and installs it as a native Windows service.

**Where it came from:** raw AsciiDoc source files fetched directly from Neo4j's own public
documentation-source repositories on GitHub — not the rendered `neo4j.com` site, which returned
HTTP 403 to an automated fetch in an earlier session and was not retried here.

| Upstream repo | Ref used | Files |
|---|---|---|
| `neo4j/docs-operations` | tag `2026.06.0` | `01`–`27` (install, backup/restore, configuration) |
| `neo4j/docs-cypher` | tag `2026.06.0` | `40`–`69` (Cypher reference) |
| `neo4j/docs-getting-started` | branch `dev` (no version tags exist upstream) | `80`–`82` (tutorials) |

Every file carries a header giving its exact GitHub blob URL, the raw-content URL it was fetched
from, the repo/ref pinned, the retrieval date (2026-08-07), and a fidelity note. All 60 files are
**verbatim** — raw AsciiDoc bytes as GitHub served them, with only the header block added; nothing
in the body was paraphrased, summarized, or model-mediated. `27-configuration-settings.md` (the
single upstream page, ~207 KB / 22 `==` sections) was mechanically split into six
`27-configuration-settings-0N.md` files at section boundaries so a retrieval hit lands on one
settings group instead of the whole reference table; the split points and grouping are noted in each
file's `description`.

No file contains a key, token, or credential — the corpus is documentation text only, scanned for
common secret patterns (AWS keys, API tokens, private-key blocks) before being placed here; none
were found. Example passwords/usernames that appear in command syntax (e.g. `neo4j-admin ... set-initial-password`) are the literal placeholder text upstream uses, not real secrets.

## File list

### Install & operate on Windows (`docs-operations`, `01`–`05`)
| File | Covers |
|---|---|
| `01-install-overview.md` | Installation methods overview (tarball/zip, package managers, Docker, Desktop) |
| `02-install-windows.md` | Installing Neo4j on Windows as a service — `neo4j.ps1 install-service`, `neo4j.ps1 start/stop/status`, zip layout |
| `03-install-requirements.md` | Hardware/OS/JDK requirements — supported Java versions per Neo4j release |
| `04-neo4j-admin-cli.md` | `neo4j-admin` and `neo4j` CLI reference — command categories (`dbms`, `server`, `database`, `backup`, `fleet`), full command table |
| `05-file-locations.md` | `NEO4J_HOME` layout — `bin`, `conf`, `data`, `logs`, `plugins`, `import`, dump directory, file permission notes |

### Backup, dump & restore (`docs-operations`, `10`–`18`) — the migration-critical group
| File | Covers |
|---|---|
| `10-backup-restore-index.md` | Backup/restore landing page — links the rest of the group |
| `11-backup-planning.md` | Planning a backup strategy (what to include, `system` database, scheduling) |
| `12-offline-backup-dump.md` | `neo4j-admin database dump` — the **dump** half of the migration; offline-only on Community Edition, output location, permissions, streaming to stdout |
| `13-online-backup.md` | `neo4j-admin database backup` — **Enterprise-only** online backup (not usable on this project's Community edition, kept for completeness/contrast) |
| `14-restore-dump-load.md` | `neo4j-admin database load` — the **load/restore** half; `--overwrite-destination`, `--from-path`/`--from-stdin`, Community-edition offline-only constraint, CDC caveat |
| `15-restore-backup.md` | Restoring from a full backup artifact (Enterprise) |
| `16-backup-modes.md` | Online vs offline backup/restore mode matrix |
| `17-backup-validate.md` | `neo4j-admin database check`/validate an archive before restoring |
| `18-store-formats.md` | Database **store format** compatibility — the version/format rules that can make `load` refuse a dump; store format upgrade paths |

### Configuration (`docs-operations`, `20`–`27`)
| File | Covers |
|---|---|
| `20-configuration-index.md` | Configuration landing page |
| `21-neo4j-conf.md` | The `neo4j.conf` file — syntax, precedence, how settings are applied |
| `22-connectors.md` | Connector configuration — `server.bolt.listen_address`, `server.http.listen_address`, `server.bolt.enabled`, TLS |
| `23-ports.md` | Default port table (Bolt 7687, HTTP 7474, HTTPS 7473, backup, cluster ports) |
| `24-set-initial-password.md` | Setting the initial admin password — `neo4j-admin dbms set-initial-password`, first-login change requirement |
| `25-auth-index.md` | Authentication & authorization overview |
| `26-auth-manage-users.md` | Managing users — `CREATE USER`, `ALTER USER`, password policy |
| `27-configuration-settings-01.md` | Full settings reference 1/6 — dynamic settings, setting groups, checkpoint, cloud storage, cluster |
| `27-configuration-settings-02.md` | Full settings reference 2/6 — connection settings (**`server.default_listen_address`** lives here), Cypher settings |
| `27-configuration-settings-03.md` | Full settings reference 3/6 — database, DBMS, fleet manager, import, index, logging, memory |
| `27-configuration-settings-04.md` | Full settings reference 4/6 — metrics, Neo4j Browser/client, Kubernetes |
| `27-configuration-settings-05.md` | Full settings reference 5/6 — security settings |
| `27-configuration-settings-06.md` | Full settings reference 6/6 — server directories, server settings, transaction, transaction log |

### Cypher reference (`docs-cypher`, `40`–`69`)
| File | Covers |
|---|---|
| `40-cypher-overview.md` / `41-cypher-and-neo4j.md` | What Cypher is; how it relates to the Neo4j server |
| `42-patterns-primer.md` | Pattern-matching primer (nodes, relationships, paths) |
| `43-clauses-index.md` | Clause list/landing page |
| `44-clause-match.md`, `45-clause-optional-match.md` | `MATCH`, `OPTIONAL MATCH` |
| `46-clause-where.md` | `WHERE` |
| `47-clause-return.md`, `48-clause-with.md` | `RETURN`, `WITH` |
| `49-clause-create.md`, `50-clause-merge.md` | `CREATE`, `MERGE` |
| `51-clause-set.md`, `52-clause-delete.md`, `53-clause-remove.md` | `SET`, `DELETE`, `REMOVE` |
| `54-clause-order-by.md` | `ORDER BY` / `SKIP` / `LIMIT` |
| `55-clause-unwind.md` | `UNWIND` |
| `56-clause-call.md`, `57-subquery-call.md` | `CALL` (procedures) and `CALL` subqueries |
| `58-functions-index.md` | Functions landing page/index |
| `59-functions-string.md`, `60-functions-list.md`, `61-functions-scalar.md`, `62-functions-aggregating.md`, `63-functions-predicate.md` | String, list, scalar, aggregating, predicate function references |
| `64-schema-constraints.md`, `65-schema-create-constraints.md` | Constraints overview and `CREATE CONSTRAINT` |
| `66-indexes-search-performance.md`, `67-indexes-create.md` | Search-performance indexes overview and `CREATE INDEX` |
| `68-values-and-types-index.md` | Values & types landing page |
| `69-syntax-parameters.md` | Query parameters (`$param` syntax) |

### Getting started (`docs-getting-started`, `80`–`82`)
| File | Covers |
|---|---|
| `80-what-is-a-graph-database.md` | Graph database concepts primer |
| `81-cypher-intro-tutorial.md` | Cypher introductory, worked tutorial |
| `82-data-modeling-tutorial.md` | Data-modeling tutorial (nodes/relationships/properties design) |

## What is NOT covered

This corpus was scoped to what the upcoming Docker-exit/migration arc actually needs (per the
task's priority order), not to completeness. Explicitly **not** collected:

- **Clustering** (`docs-operations/modules/ROOT/pages/clustering/**`) — this project runs a single
  standalone instance; clustering setup, discovery, routing, multi-region deployment are absent.
- **Docker/Kubernetes deployment** (`docker/**`, `kubernetes/**`) — the whole point of the arc this
  corpus supports is moving *off* Docker onto a native Windows service, so container-specific
  operational pages (image config, Helm charts, K8s dump/load) were skipped as directly
  contradictory to the target state.
- **Enterprise-only features in depth** — `13-online-backup.md` is included for contrast (it explains
  why `neo4j-admin database backup` isn't an option here), but composite/sharded databases, LDAP/SSO,
  fleet management, and other Enterprise-edition-only administration pages are not collected.
- **Monitoring & metrics in depth** — only the settings-reference section (`27-configuration-settings-04.md`)
  touches metrics; the dedicated `monitoring/**` pages (Prometheus/JMX/Graphite export, fleet
  discovery, query management) are not collected.
- **Cloud/Aura** — `docs-aura` was not fetched; this is a self-managed instance.
- **Security deep-dives** — SSL/TLS framework, post-quantum, LDAP/SSO integration, ABAC, RBAC
  privilege-by-privilege pages beyond the two collected (`25-auth-index.md`,
  `26-auth-manage-users.md`) are not included.
- **Full Cypher surface** — the reference collected is the commonly-needed subset (core clauses,
  common function families, constraints, search-performance indexes, parameters). Not collected:
  spatial/temporal functions and operators, vector indexes and vector functions, full-text
  (semantic) indexes, GQL-conformance appendices, query tuning/execution-plan internals, subqueries
  beyond `CALL`, composed queries (`UNION`, conditional queries), `LOAD CSV`, user-defined
  functions, graph-type/graph-schema pages, and the Cypher style guide. If a future task needs any
  of these, fetch the specific page from `neo4j/docs-cypher` at tag `2026.06.0` rather than guessing.
- **`docs-getting-started` beyond the three tutorials picked** — language/driver guides (Java,
  Python, JS, Go, .NET), GDS (Graph Data Science), CSV/relational import guides, and graph
  visualization tooling pages are not collected.
- **Neo4j Desktop, `neo4j-admin-memrec`, GC tuning, and other performance-tuning pages** beyond what
  the settings reference already covers.

If a gap here turns out to matter, the pattern to extend the corpus is: fetch
`https://raw.githubusercontent.com/neo4j/<repo>/<ref>/<path>` for the specific `.adoc` page (browse
the tree via `https://api.github.com/repos/neo4j/<repo>/git/trees/<ref>?recursive=1`), add the same
header block used by every file here, and place it under this directory with the next free number in
its topic band.
