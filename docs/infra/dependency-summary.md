# The knowledge stack — what is installed, and what each piece is for

Phase 2 deliverable. Every version here was read from the **installed environment** on
2026-08-05, not from a manifest and not from memory — a manifest describes what should be there,
which is a different question and one this project has already been wrong about once
(commit c6ed4f6: tree-sitter installed by hand, never written down, CI could not import it).

Reproduce with `python -m pip list`, `docker compose config`, `python -c "import sys, sqlite3"`.

## Services

| Component | Version | Purpose | Runtime / dev |
|---|---|---|---|
| PostgreSQL + pgvector | `pgvector/pgvector:0.8.6-pg18` | **Source of truth.** Documents, revisions, chunks, embeddings, ingestion jobs. Vector search via pgvector | runtime |
| Neo4j Community | `neo4j:2026.06.0-community` | **Projection, never the source of truth.** Relationship traversal over what PostgreSQL already holds | runtime |
| APOC Core | bundled `2026.06.0` | `apoc.create.addLabels`, `apoc.merge.relationship` — Cypher cannot parameterise a label or a relationship type. File/network procedures deliberately disabled | runtime |
| Ollama + bge-m3 | local, RTX 3090 | Embeddings, on this machine. No document text leaves it | runtime |

## Python

Interpreter **3.14.6**, SQLite **3.50.4** — above the 3.45.0 floor that JSONB requires, which is
the reason 3.14 was installed in the first place.

| Package | Version | Purpose | Runtime / dev |
|---|---|---|---|
| `llama-index-core` | 0.14.23 | Parsing (`MarkdownNodeParser`, `CodeSplitter`), `TextNode`, `IngestionPipeline`, `MetadataFilters` | runtime |
| `llama-index-vector-stores-postgres` | 0.8.1 | `PGVectorStore` — the vector index over PostgreSQL | runtime |
| `llama-index-graph-stores-neo4j` | 0.7.0 | `Neo4jPropertyGraphStore` — the graph projection | runtime |
| `llama-index-embeddings-ollama` | 0.9.0 | Embeddings through the local model | runtime |
| `neo4j` | **6.2.0** | Bolt driver. **Overrides upstream's `neo4j<6`** — see below | runtime |
| `psycopg2-binary` | 2.9.12 | PostgreSQL driver used by SQLAlchemy | runtime |
| `asyncpg` | 0.31.0 | Async PostgreSQL driver, pulled by the vector store | runtime |
| `sqlalchemy` | 2.0.51 | Connection and schema layer under `PGVectorStore` | runtime |
| `pgvector` | 0.5.0 | Python adapter for the `vector` column type | runtime |
| `tree-sitter` | 0.26.0 | Code parsing for `CodeSplitter` | runtime |
| `tree-sitter-javascript` | 0.25.0 | `app.js` — the 14.6k-line, 906-function file | runtime |
| `tree-sitter-python` | 0.25.0 | `build.py`, `data.py`, `sources.py`, `src/` | runtime |
| `tree-sitter-typescript` | 0.23.2 | `.ts` / `.tsx` | runtime |
| `python-dotenv` | 1.2.2 | Reads `infra/.env`; keeps credentials out of code | runtime |
| `requests` | 2.34.2 | HTTP to the local Ollama endpoint | runtime |
| `pytest` | 9.1.1 | The Python suite, gated by `check-pytest` | **dev** |

`tree-sitter-language-pack` is **not** used and this is deliberate: it publishes no
windows-x86_64 wheel, so `get_parser()` raises `DownloadError` here. The per-language wheels
above do ship one, and `CodeSplitter` accepts a `parser=` argument, so the parser is built from
them directly.

## The one deliberate exception

`neo4j==6.2.0` contradicts `llama-index-graph-stores-neo4j 0.7.0`'s declared `neo4j<6,>=5.16.0`.

**Owner ruling, 2026-08-05.** The deciding factor is not only backward compatibility. Driver 6.x
carries a `Result` iteration speed-up, two connection-timeout fixes, and two fixes specific to
**Windows** — the platform this project develops on (`socket.EAI_ADDRFAMILY` on import, 6.0.1;
DNS error re-write, 6.0.2).

**Established before overriding, not after:** the integration touches four driver APIs
(`neo4j.Query`, `execute_query`, `session`, `close`), none in driver 6.0's removal list; upstream
shipped 0.7.0 five and a half months *after* driver 6.0 and tracks no issue about the pin; and
the full graph round-trip passes identically under 5.28.4 and 6.2.0 against the live server.

**Installing it is a two-step, and the second step is not optional:**

```
python -m pip install -r requirements.txt
python -m pip install --no-deps -r requirements-overrides.txt
```

pip has no override mechanism — both pins in one resolve returns `ResolutionImpossible` — so a
plain `pip install -r requirements.txt` silently reverts the driver to 5.x. `tests/test_infra_deps.py`
fails when that happens, and also fails once upstream relaxes the constraint, so the workaround
cannot outlive its reason. `pip check` reports the conflict; that is the override, not a fault
(L55).
