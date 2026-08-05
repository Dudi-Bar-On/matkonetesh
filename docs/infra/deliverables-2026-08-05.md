# The knowledge stack — deliverables

The twelve items the owner's prompt asks for at the end, in its order. Every number here was read
from the running system on 2026-08-05, not from a manifest and not from memory.

Reproduce with: `python -m pip list`, `docker inspect`, `python scripts/pgmigrate.py --status`,
`python scripts/neo4jmigrate.py --status`, `python -m pytest tests/ -q`.

---

## 1 · Installed components and exact versions

| Component | Version | Runtime / dev |
|---|---|---|
| PostgreSQL + pgvector | `pgvector/pgvector:0.8.6-pg18` (pgvector 0.8.6, PostgreSQL 18) | runtime |
| Neo4j Community | `neo4j:2026.06.0-community` | runtime |
| APOC Core | bundled 2026.06.0 | runtime |
| Docker Engine | in WSL2 Ubuntu 20.04, no Docker Desktop | runtime |
| Python | 3.14.6 (SQLite 3.50.4) | runtime |
| Ollama + `bge-m3` | local, RTX 3090, 1024 dimensions (measured) | runtime |
| `llama-index-core` | 0.14.23 | runtime |
| `llama-index-vector-stores-postgres` | 0.8.1 | installed, **not used** — see §7 |
| `llama-index-graph-stores-neo4j` | 0.7.0 | runtime |
| `llama-index-embeddings-ollama` | 0.9.0 | runtime |
| `neo4j` (driver) | **6.2.0**, overriding upstream's `neo4j<6` | runtime |
| `psycopg2-binary` | 2.9.12 | runtime |
| `asyncpg` | 0.31.0 | runtime |
| `sqlalchemy` | 2.0.51 | runtime |
| `pgvector` (adapter) | 0.5.0 | runtime |
| `tree-sitter` + javascript/python/typescript | 0.26.0 / 0.25.0 / 0.25.0 / 0.23.2 | runtime |
| `python-dotenv` · `requests` | 1.2.2 · 2.34.2 | runtime |
| `pytest` | 9.1.1 | **dev** |

## 2 · Files, migrations, scripts, and environment-variable names

**Configuration** — `infra/compose.yaml` · `infra/.env.example` (placeholders, tracked) ·
`infra/.env` (real values, **gitignored**) · `infra/README.md` · `.gitattributes` (LF for `infra/**`)

**Bootstrap (runs once, on a fresh volume)** — `infra/postgres/init/01-extensions-and-role.sql` ·
`infra/postgres/init/02-set-role-passwords.sh`

**Migrations** — `infra/postgres/migrations/`
`0001_documents_and_revisions` · `0002_document_chunks` · `0003_jobs_and_projection` ·
`0004_grants` · `0005_revoke_create_from_mk_app` · `0006_complete_the_spec`

**Application** — `src/knowledge/config.py` · `filters.py` · `graph_schema.py` · `retrieval.py` ·
`worker.py`

**Scripts** — `scripts/pgmigrate.py` · `scripts/neo4jmigrate.py` · `scripts/ingest.py` ·
`scripts/migrate_from_sqlite.py`

**Tests** — `tests/test_pg_schema.py` · `test_pg_spec_coverage.py` · `test_graph_schema.py` ·
`test_retrieval.py` · `test_worker.py` · `test_infra_deps.py` · `test_acceptance.py` ·
`test_acceptance_infra.py`

**Environment variable NAMES** (values live only in `infra/.env`, never in the repo):
`POSTGRES_PORT` `POSTGRES_DB` `POSTGRES_SUPERUSER` `POSTGRES_SUPERUSER_PASSWORD`
`MK_APP_PASSWORD` `MK_READER_PASSWORD` `NEO4J_BOLT_PORT` `NEO4J_HTTP_PORT` `NEO4J_USER`
`NEO4J_PASSWORD`

## 3 · Startup and shutdown

Docker runs inside WSL2 without Desktop, and WSL2 has no systemd, so the daemon is started by the
SysV path. These are the commands verified in this environment:

```bash
# start the daemon (once per Windows session)
wsl -d Ubuntu-20.04 -u root -e bash -lc 'service docker start'

# bring the stack up
wsl -d Ubuntu-20.04 -u root -e bash -lc \
  'cd /mnt/c/Users/dudib/source/repos/matconetesh/infra && docker compose up -d'

# health
wsl -d Ubuntu-20.04 -u root -e bash -lc 'docker ps --format "{{.Names}}\t{{.Status}}"'

# stop, KEEPING all data
wsl -d Ubuntu-20.04 -u root -e bash -lc \
  'cd /mnt/c/Users/dudib/source/repos/matconetesh/infra && docker compose down'
```

**`docker compose down -v` destroys the volumes.** Count what is in them first — that is how the
one destructive step in this arc was known to be safe rather than lucky.

## 4 · Connecting locally, without exposing secrets

Both services are published to **loopback only**, verified against the running containers
(acceptance A6), so nothing here is reachable from the network.

```
PostgreSQL   127.0.0.1:5433   database mk_knowledge
Neo4j Bolt   127.0.0.1:7687
Neo4j HTTP   127.0.0.1:7474   (browser UI)
```

Never paste a password on a command line. Read `infra/.env`:

```bash
python -c "from src.knowledge import config; c=config.connect_reader(); print('connected read-only')"
```

```bash
wsl -d Ubuntu-20.04 -u root -e bash -lc \
  'cd /mnt/c/.../infra && set -a && . ./.env && set +a && \
   docker exec -e PGPASSWORD="$POSTGRES_SUPERUSER_PASSWORD" mk-postgres \
     psql -U "$POSTGRES_SUPERUSER" -d "$POSTGRES_DB" -c "\dt"'
```

## 5 · PostgreSQL schema

Six migrations, applied exactly once each, with **checksum drift detection** — editing an applied
migration is refused by name, because a database that disagrees with its own history is a bug that
surfaces much later, somewhere else.

| Table | Columns | CHECKs | Indexes | Purpose |
|---|---|---|---|---|
| `documents` | 7 | 1 | 2 | canonical identity, namespace, current-revision pointer |
| `document_revisions` | 15 | 6 | 6 | immutable version history, status, provenance, authority |
| `document_chunks` | 12 | 5 | 8 | chunk text, `vector(1024)`, metadata, citation span |
| `ingestion_jobs` | 14 | 4 | 4 | durable queue, lease, attempts, idempotency key |
| `graph_projection_state` | 11 | 5 | 2 | what PostgreSQL believes the graph reflects |

**The constraint that carries the prompt's central rule:**

```sql
CONSTRAINT current_requires_both_sides CHECK (
  NOT is_current OR (indexed_at IS NOT NULL AND graph_projected_at IS NOT NULL))
CONSTRAINT current_only_when_graph_projected CHECK (
  NOT is_current OR status = 'graph_projected')
```

Nothing can mark a revision current without both sides — not the worker, not a migration, not a
person with `psql`. Also: `one_current_revision_per_document` (partial unique index),
`one_active_job_per_document`, `failed_jobs_say_why`, `finished_jobs_have_a_finish_time`,
`embedding_and_timestamp_together`, `a_running_job_holds_a_lease`,
`superseded_revisions_point_somewhere`.

Statuses, all eight the prompt requires: `queued` `processing` `indexed` `graph_pending`
`graph_projected` `failed` `superseded` `archived`.

## 6 · Neo4j schema

**16 node labels** — Document · DocumentRevision · Section · Repository · System · Service ·
Module · API · Database · Job · Event · Requirement · Decision · Owner · Dependency · ExternalTool

**13 relationship types** — HAS_REVISION · SUPERSEDES · HAS_SECTION · DESCRIBES · DEPENDS_ON ·
CALLS · IMPLEMENTS · AFFECTS · OWNED_BY · CITES · CONTRADICTS · PRODUCES · CONSUMES

48 schema objects: one uniqueness constraint on `canonical_id` per label, plus `namespace` and
`status` indexes. Generated from the same tuple the write gate reads, so a label cannot be added
in one place and not the other.

**Neo4j is schemaless** — `CREATE (n:Anything)` succeeds and Community edition has no
property-existence constraint. The allowlist therefore has exactly ONE enforcement point:
`src/knowledge/graph_schema.py`. It refuses an unknown label, an unknown relationship type, a
missing required node property, a malformed `canonical_id`, an unknown fact status, a fact-bearing
edge with no source revision/chunk, and a `structured_llm` extraction below a configurable
confidence threshold.

Every node carries `canonical_id` `namespace` `status` `created_at` `updated_at`. Every
fact-bearing relationship carries `source_document_id` `source_revision_id` `source_chunk_id`
`source_uri` `extraction_method` `extraction_confidence` `status` `valid_from` (`valid_to` when
superseded). Fact statuses: `current` `superseded` `proposed` `manually_confirmed`.

Structural edges (HAS_REVISION, SUPERSEDES, HAS_SECTION) are exempt from chunk provenance because
they are derived from PostgreSQL rows we already hold — the row IS the provenance. Requiring a
source chunk for them would forbid building the document spine at all.

## 7 · LlamaIndex integration

Used for what it is genuinely better at: `MarkdownNodeParser` and `CodeSplitter` (tree-sitter, AST
aligned) for chunking, `OllamaEmbedding` for local embeddings, and `Neo4jPropertyGraphStore` for
the graph — which the prompt names explicitly.

**`PGVectorStore` is installed and import-tested (Phase 2) but NOT used as the store, and this is
a deliberate deviation the owner should weigh.** Verified by running it: it creates its own
`data_chunk_vectors` table. Using it would store every embedding twice with nothing keeping the
copies in step, and the second copy would carry no FK to a revision, no `is_current`, no
`graph_projected_at`, no `source_authority` — retrieval reading it could serve text from a
superseded revision while the authoritative table said otherwise. That is also the design's own
stated reasoning (prompt line 62: *"pgvector keeps embeddings near document metadata and
revisions, avoiding a second vector database and reducing synchronization risk"*).

`document_chunks.embedding` is a `vector(1024)` column with an HNSW cosine index, so both halves of
the hybrid read the same table. **Cost, stated where the decision is:** LlamaIndex's retriever and
query-engine classes cannot be pointed at our table, so retrieval is SQL we maintain.

`Settings.llm` is set to `None` on purpose: nothing here needs one, and leaving the default would
let a stray call reach for OpenAI and fail with an API-key error that explains nothing.

## 8 · Worker lifecycle and failure behaviour

**One writer**, in three independent layers: a PostgreSQL advisory lock held for the process
lifetime · a per-document lease with an expiry (an abandoned job becomes claimable on its own) ·
the `one_active_job_per_document` partial unique index underneath both.

```
event -> debounce(5s) -> reclaim/refuse held lease -> hash -> unchanged? exit
      -> new revision (processing)        [old revision STILL current]
      -> chunk -> embed (batched, split-on-failure) -> write chunks
      -> status=indexed                   [old revision STILL current]
      -> validate -> idempotent graph upsert
      -> status=graph_projected           [old revision STILL current]
      -> supersede old, activate new      <- the only step readers can see
```

The order IS the guarantee. Deactivation is last, so a failure before it cannot have taken the
live revision down — verified by forcing the graph step to fail (acceptance B5).

On failure: the previous revision is untouched and still current; the new revision is left
`graph_pending`; the job is `failed` **with its diagnostics** (a CHECK constraint refuses a failed
job with no reason). Retries are bounded — 3 attempts with exponential backoff, then it gives up
and says so. A revision that can never be resumed because a different one became current is marked
`failed` rather than deleted: the prompt forbids silently discarding failed work.

Graph extraction is **deterministic only**. Structured LLM extraction is not implemented; its
validator, provenance fields and confidence threshold all exist, and enabling it is a separate
decision with a privacy dimension the owner has not taken.

## 9 · Read-only tools exposed to subagents

Six parameterised operations, and **no text-to-Cypher anywhere** — every Cypher string is a literal
in `retrieval.py`, and a test fails if a future edit adds `text_to_cypher`, `run_cypher`,
`query_graph`, `execute_cypher` or `raw_query`.

| Operation | Returns |
|---|---|
| `search_current_docs(query, filters, limit)` | lexical hits over CURRENT revisions with path, revision id, chunk id, excerpt |
| `semantic_search(query, filters, limit)` | cosine nearest neighbours over the same table |
| `get_source_excerpt(revision_id, chunk_id)` | the exact stored text behind a citation |
| `find_impact(canonical_id, depth, types, limit)` | what is downstream, within the depth limit |
| `find_dependency_path(from, to, depth)` | the shortest ordered chain |
| `get_revision_history(source_path, namespace)` | every revision, newest first |
| `get_entity_provenance(canonical_id, limit)` | each fact with its excerpt, and a count of the unsupported |

Eight filter axes, compiled to bind parameters: `namespace` `source_type` `document_status`
`revision_status` `source_authority` `repository` `document_path` `created_after`/`created_before`.
An unknown axis is **refused, not ignored** — a dropped filter returns more rows than asked for
while looking like it worked.

**Credentials never leave the process.** Subagents call the operations; the operations hold the
connection. PostgreSQL retrieval uses `mk_reader`, which has no write verb, on a session opened
`READ ONLY`. Neo4j Community has one credential that can write, so that guarantee is weaker and
lives in code — fixed templates, a write/admin clause guard, bounded path lengths, a 15s timeout,
a 100-row cap — and it is documented as weaker rather than implied to be equal.

## 10 · Migration report (SQLite → PostgreSQL + Neo4j)

Full JSON: `docs/infra/migration-report-2026-08-05.json`.

| | |
|---|---|
| documents discovered in SQLite | 846 |
| successfully migrated | 842 in the main run, **845/845 after the three fixes** |
| skipped | 4 → 1 no longer on disk (`seed`), 3 ingestion failures, all three since fixed and re-ingested |
| revisions created | 830 |
| chunks indexed | **12,860** |
| chunks without an embedding | **0** |
| graph nodes / relationships | 6,910 / 6,065 |
| errors requiring manual review | 0 remaining |
| citations checked against disk | 5 of 5 matched |
| **SQLite retained unchanged** | **YES** — sha256 identical before and after; verified backup at `backups/agent-memory-*.db` |
| elapsed | 35 minutes |

Embeddings were **rebuilt, not copied**. SQLite was opened read-only by URI and is still the
304MB database the embedded tooling uses.

## 11 · Acceptance results

`python -m pytest tests/ -q` → **165 passed, 2 skipped**, run twice. The 2 skipped are the
container-restart tests, which are opt-in (`MK_RESTART_TESTS=1`) because they restart services;
both were run separately and **passed**.

| Category | Checks | Result |
|---|---|---|
| A · Infrastructure | 7 | PostgreSQL and Neo4j both survive a restart with 845 documents / 12,860 chunks / 6,910 nodes intact · pgvector 0.8.6 present and usable · no live credential in any tracked file · `infra/.env` gitignored · every published port bound to 127.0.0.1 (read from the running containers) · no `latest` tag |
| B · Ingestion correctness | 6 | ingest · identical content creates no duplicates · a change creates exactly one revision · the old one is retained and superseded only after success · a projection failure leaves the previous revision active · the retry becomes consistent with no duplicate revisions or graph nodes |
| C · Semantic retrieval | 4 | a known fact is found with path + revision id + chunk id + excerpt · superseded text is excluded · namespace/source-type/path filters work · both halves of the hybrid agree |
| D · Graph retrieval | 5 | `find_dependency_path` returns the correct ordered chain · `find_impact` respects depth and refuses beyond the limit · every returned relationship carries provenance · superseded edges are excluded · an unsupported fact is reported, not dropped |
| E · Security and access | 6 | `mk_app` can write data and cannot CREATE · `mk_reader` cannot INSERT/UPDATE/DELETE · no operation returns a connection, driver or password · write Cypher is refused · no operation accepts a query string at all · timeouts/depth/result limits enforced and the timeout is passed to the driver |

## 12 · Blockers, assumptions, and what was deliberately not done

**Needs the owner's decision**

1. **`PGVectorStore` is installed but unused** (§7). The prompt lists it as a required capability;
   I installed and import-tested it, then chose our own table for the reasons above. Reversible: a
   migration to create `data_chunk_vectors` plus dual-write in the worker. The cost of reversing is
   a second copy of every embedding with no revision FK.
2. **`neo4j==6.2.0` overrides upstream's `neo4j<6`** — approved by the owner on evidence
   (two Windows-specific fixes, a `Result` iteration speed-up, two timeout fixes). Held by
   `requirements-overrides.txt` + `tests/test_infra_deps.py`, which also fails when upstream
   relaxes the pin so the workaround cannot outlive its reason. `pip check` reports the conflict;
   that is the override, not a fault.

**Deliberately not done**

3. **Structured LLM graph extraction.** Only deterministic extraction runs, which is the prompt's
   own preference order. Everything it would need exists. Enabling it sends document text to a
   model — a privacy decision that is the owner's.
4. **Expert-only raw Cypher access.** The prompt describes it conditionally ("if it is ever
   implemented"). It is not, so there is no path to raw Cypher at all.
5. **A filesystem watcher.** Of the four event sources, the explicit command (`scripts/ingest.py`)
   is implemented. A watcher is a daemon-lifecycle decision, not a schema one.
6. **Neo4j read-only credentials.** Impossible on Community edition — one credential, and it can
   write. Enforced at the tool layer instead, and documented as the weaker guarantee it is.

**Unrelated to this stack, but open and blocking a release**

7. **R-93** — `tnode()` replaces units in object-insertion order, so `5 kg/דק׳` renders in all 22
   non-Hebrew languages. Fully diagnosed, one-line fix, not applied (owner: register and continue).
8. **R-94** — the CI `playwright` job has been red for 25+ consecutive runs and `check-meta` does
   not look at it. Both lock before the next release.
