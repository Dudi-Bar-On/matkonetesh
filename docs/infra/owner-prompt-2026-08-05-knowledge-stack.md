בוקר טוב, לפני שממשיכים לשלב B, עשיתי מחקר המשך והחלטתי לעשות עוד שיפורים לסביבת העבודה, הפרומפט המצורף מכיל הוראות מדויקות, עבוד לפי הסדר, אל תדלג, אל תקבל החלטות לבד, הצג לי שלבים והתקדמות ושאל אותי כל שאלה שצריכה הכרעה. השיפור הזה אמור לעזור לנו לבצע את שלב B וכל מה שאחריו הרבה יותר אמין מסודר ומנוהל, בהצלחה.
הנה הפרומפט:

You are the infrastructure and application-integration engineer for a documentation intelligence system.

Your task is to install and configure the required components for a reliable, local-first knowledge and GraphRAG stack:

1. Existing application SQLite database — retain it only as the embedded database used internally by the application.
2. PostgreSQL with the pgvector extension — canonical shared store for document metadata, revisions, ingestion state, structured JSON metadata, and embeddings.
3. Neo4j Community — graph projection for entities, relationships, dependency traversal, ownership, impact analysis, and graph paths.
4. LlamaIndex — Python orchestration layer for ingestion, chunking, embedding, semantic retrieval, graph extraction, and hybrid retrieval.
5. A single controlled ingestion worker — the only writer allowed to update the shared knowledge stores.
6. A read-only retrieval interface for agents/subagents.

Do not replace these components with alternative databases, vector stores, graph stores, agent frameworks, or orchestration frameworks unless explicitly instructed by the user. Do not install Graphify, Cognee, Qdrant, Chroma, Kuzu, LanceDB, or any additional graph/vector database.

Do not remove, modify, migrate, or repurpose the application’s existing SQLite database unless explicitly instructed. SQLite must remain embedded within the application and be used only for that application’s local/internal usage. It is not the shared documentation store, central vector database, graph database, ingestion queue, or agent-access database.

The system must be implemented incrementally, with validation after every stage. Do not claim a step is complete unless its verification command succeeds.

============================================================
ARCHITECTURAL DECISIONS — DO NOT CHANGE
============================================================

Use this architecture:

Source repositories and generated documentation
        |
        v
Change detector / application event / filesystem watcher
        |
        v
Debounced ingestion queue stored in PostgreSQL
        |
        v
ONE ingestion worker process only
        |
        +--> PostgreSQL + JSONB + pgvector
        |      - authoritative document registry
        |      - document revisions
        |      - source hashes
        |      - ingestion jobs and state
        |      - chunks and embeddings
        |      - provenance and structured metadata
        |
        +--> Neo4j Community
        |      - graph entities and relationships
        |      - dependency and impact traversal
        |      - ownership and architecture paths
        |      - graph projection only, not source of truth
        |
        v
LlamaIndex retrieval/orchestration layer
        |
        v
Read-only tools/API used by subagents

Reasoning for this design:

- SQLite remains suitable for embedded, local application data. It is not suitable as the central shared knowledge store when multiple processes, automated document generation, ingestion, and many querying subagents are involved.
- PostgreSQL provides durable multi-process concurrency, transactions, access control, indexing, JSONB metadata, and reliable job state.
- pgvector keeps embeddings near document metadata and revisions, avoiding a second vector database and reducing synchronization risk.
- Neo4j Community is used because relationship traversal, dependency chains, ownership mapping, and impact analysis are graph-native workloads.
- Neo4j must remain a projection of authoritative data in PostgreSQL. It must never become the only record of document content, revision history, or source provenance.
- LlamaIndex remains the orchestration layer. It must not be replaced.
- Only one ingestion worker may write to PostgreSQL and Neo4j at a time during the initial implementation. All subagents must have read-only access through controlled tools.
- Do not expose unrestricted database credentials, unrestricted Cypher, or unrestricted SQL to general subagents.

============================================================
PHASE 0 — INSPECT BEFORE CHANGING ANYTHING
============================================================

Before installing anything:

1. Inspect and report:
   - operating system and version;
   - CPU architecture;
   - available RAM and disk space;
   - whether Docker Engine and Docker Compose are available;
   - whether Python is installed and its version;
   - existing project structure;
   - whether the application already has a Python virtual environment;
   - current SQLite location(s), without altering them;
   - existing LlamaIndex configuration, if present;
   - whether PostgreSQL or Neo4j are already installed or running;
   - ports already in use.

2. Do not guess paths, database names, existing credentials, package versions, source directories, or application entry points.

3. If Docker is unavailable:
   - explain exactly what prerequisite is missing;
   - stop before attempting a partial installation;
   - do not silently switch to an unrequested package-manager installation.

4. If PostgreSQL or Neo4j already exist:
   - inspect their version, configuration, ports, volumes, and active users;
   - do not overwrite, delete, or reinitialize existing data;
   - ask for confirmation before reusing an existing production-like database instance.

5. Present a concise execution plan based on the inspected environment, then implement it step by step.

============================================================
PHASE 1 — CREATE ISOLATED INFRASTRUCTURE
============================================================

Use Docker Compose for PostgreSQL with pgvector and Neo4j Community, unless the user explicitly requires a different deployment approach.

Requirements:

1. Create a dedicated infrastructure configuration directory in the project, but do not place secrets into committed files.
2. Use environment variables for all credentials and connection strings.
3. Create a `.env.example` file containing variable names only, with safe placeholders.
4. Add the actual `.env` file to `.gitignore`.
5. Use persistent named Docker volumes for:
   - PostgreSQL data;
   - Neo4j data;
   - Neo4j logs;
   - Neo4j plugins, only if genuinely needed.

6. Bind services to localhost by default. Do not expose PostgreSQL or Neo4j publicly.
7. Do not use default passwords.
8. Do not commit passwords, tokens, connection URLs containing passwords, or generated credential files.
9. Use explicitly pinned and supported container-image versions after checking the current official image documentation. Do not use floating image tags such as `latest`.
10. Configure health checks for both PostgreSQL and Neo4j.

Use separate service names and separate ports that do not conflict with existing services. Determine free ports from the environment inspection instead of assuming them.

PostgreSQL requirements:

- Install PostgreSQL with pgvector included.
- Enable the `vector` extension in the dedicated knowledge database.
- Create a dedicated application database role with only the privileges needed by the ingestion/retrieval service.
- Do not use the PostgreSQL superuser from the application.
- Use normal PostgreSQL columns for fields frequently used in filtering, sorting, joining, or access control.
- Use JSONB only for flexible, sparse, or document-type-specific metadata.
- Create appropriate indexes after the actual schema is finalized.

Neo4j requirements:

- Install Neo4j Community edition.
- Create a dedicated least-privilege application user if the installed Community version supports the required user-management behavior.
- Otherwise, document the limitation clearly and isolate the instance by network binding and credential handling.
- Configure authentication.
- Keep Bolt access local/private unless the user explicitly requests network exposure.
- Do not install APOC or other plugins unless a concrete required feature has been identified and confirmed.
- Do not use Neo4j as the primary document database.

Verification:

- Confirm PostgreSQL is healthy.
- Confirm the `vector` extension is installed and enabled.
- Confirm Neo4j is healthy and authentication works.
- Confirm persistent volumes exist.
- Confirm services restart successfully without loss of test data.
- Record the verified local connection configuration without exposing secrets.

============================================================
PHASE 2 — PREPARE THE PYTHON APPLICATION ENVIRONMENT
============================================================

Use the project’s existing Python environment if one exists and is appropriate. Otherwise create an isolated virtual environment.

Install only the required LlamaIndex integration packages after checking the currently installed LlamaIndex version and compatible package versions.

Required capabilities:

- core LlamaIndex functionality;
- PostgreSQL/pgvector vector-store integration;
- Neo4j property-graph store integration;
- PostgreSQL driver appropriate to the application’s sync/async design;
- Neo4j Python driver;
- environment-variable loading;
- schema migration support if the project already uses a migration tool, or a carefully selected migration mechanism if it does not.

Do not use broad unpinned dependency upgrades. Capture exact resolved versions in the project’s existing dependency-management format.

Do not invent package names. Verify the official package names and compatibility before installation.

After installation:

1. Run a minimal import test for:
   - LlamaIndex;
   - the PostgreSQL/pgvector integration;
   - the Neo4j graph-store integration;
   - the selected PostgreSQL driver;
   - the Neo4j driver.

2. Verify that imports use the project’s intended virtual environment, not a global interpreter.

3. Produce a dependency summary containing:
   - package name;
   - installed version;
   - purpose;
   - whether it is runtime-only or development-only.

============================================================
PHASE 3 — DEFINE AUTHORITATIVE POSTGRESQL DATA MODEL
============================================================

PostgreSQL is authoritative for document content, source identity, revisions, ingestion state, chunks, embeddings, and provenance.

Do not start bulk ingestion until migrations and constraints are implemented.

Create a migration-backed schema with at least these conceptual records:

1. documents
   Purpose:
   - stable canonical identity for a logical document.

   Required concepts:
   - immutable document identifier;
   - canonical source URI or normalized source path;
   - source type;
   - namespace;
   - active/current revision reference;
   - creation and update timestamps.

2. document_revisions
   Purpose:
   - immutable version history of each document.

   Required concepts:
   - immutable revision identifier;
   - parent document identifier;
   - content hash;
   - source commit identifier when applicable;
   - source path/URI at ingestion time;
   - created timestamp;
   - revision status;
   - superseded-by reference when applicable;
   - content/provenance metadata;
   - source authority classification.

3. document_chunks
   Purpose:
   - chunk-level retrieval and citation.

   Required concepts:
   - immutable chunk identifier;
   - parent revision identifier;
   - chunk ordering;
   - chunk text or a reliable pointer to canonical stored text;
   - content hash;
   - embedding/vector;
   - structured metadata;
   - source location information sufficient for citation.

4. ingestion_jobs
   Purpose:
   - durable queue and state machine for ingestion.

   Required concepts:
   - job identifier;
   - source identity;
   - requested content hash;
   - job type;
   - queue/lease state;
   - attempt counter;
   - error details;
   - timestamps;
   - idempotency key.

5. graph_projection_state
   Purpose:
   - explicitly track whether a document revision has been successfully projected into Neo4j.

   Required concepts:
   - revision identifier;
   - projection state;
   - last attempt timestamp;
   - projection version/schema version;
   - error details;
   - graph transaction/reference metadata when useful.

Use explicit statuses. At minimum, distinguish:

- queued
- processing
- indexed
- graph_pending
- graph_projected
- failed
- superseded
- archived

Do not allow a revision to be considered globally active until both:
1. its PostgreSQL chunk/vector ingestion is complete; and
2. its Neo4j graph projection is complete.

Important consistency rule:

PostgreSQL and Neo4j cannot be treated as one distributed ACID transaction. Implement a reliable, retryable projection workflow instead of pretending the two databases commit atomically.

Recommended flow:

1. Commit the authoritative revision and its ingestion/projection job state to PostgreSQL.
2. Generate chunks and embeddings.
3. Mark vector indexing success in PostgreSQL.
4. Project graph nodes and relationships to Neo4j using idempotent upserts.
5. Record graph projection success in PostgreSQL.
6. Only then mark the revision as active/current.
7. If Neo4j projection fails, preserve the authoritative PostgreSQL revision, mark it as graph-pending or failed, and retry safely.
8. Never silently expose a partially projected revision as fully current for graph-dependent queries.

Use content hashes and unique constraints to make reprocessing idempotent.

============================================================
PHASE 4 — DEFINE THE NEO4J GRAPH SCHEMA
============================================================

Neo4j is a graph projection with provenance, not an ungoverned graph of arbitrary LLM-generated triples.

Use a strict allowlist of node labels and relationship types.

Initial allowed node labels:

- Document
- DocumentRevision
- Section
- Repository
- System
- Service
- Module
- API
- Database
- Job
- Event
- Requirement
- Decision
- Owner
- Dependency
- ExternalTool

Initial allowed relationship types:

- HAS_REVISION
- SUPERSEDES
- HAS_SECTION
- DESCRIBES
- DEPENDS_ON
- CALLS
- IMPLEMENTS
- AFFECTS
- OWNED_BY
- CITES
- CONTRADICTS
- PRODUCES
- CONSUMES

Do not add labels or relationship types merely because an LLM suggests them. Any schema expansion requires an explicit reviewed migration.

Every graph node must have:

- stable canonical identifier;
- node type/label;
- namespace;
- status;
- created timestamp;
- updated timestamp.

Every fact-bearing relationship must include provenance where applicable:

- source_document_id;
- source_revision_id;
- source_chunk_id;
- source path or source URI;
- commit identifier, if applicable;
- extraction method;
- extraction confidence;
- status;
- valid-from timestamp;
- valid-to timestamp when superseded or invalidated.

The graph must support distinguishing:

- current facts;
- superseded facts;
- proposed/unverified facts;
- manually confirmed facts.

Create constraints and indexes for stable identifiers before loading data.

Use idempotent graph writes:

- use stable identifiers;
- use upsert semantics;
- do not create duplicate entity nodes on repeated ingestion;
- do not delete historical revisions simply because a newer revision exists;
- mark or time-bound outdated relationships based on revision status.

Graph extraction rules:

1. Prefer deterministic extraction for known project structures:
   - repository/module ownership;
   - API definitions;
   - explicit dependencies;
   - file paths;
   - service names;
   - known configuration.
2. Use structured LLM extraction only for approved schema fields.
3. Require structured output validation before graph writes.
4. Reject unknown labels, unknown relationship types, malformed identifiers, missing provenance, or low-confidence output according to a configurable threshold.
5. Never treat a generated graph edge as authoritative without a source revision and source chunk reference.

============================================================
PHASE 5 — CONFIGURE LLAMAINDEX
============================================================

Keep LlamaIndex as the orchestration layer.

Configure it to support:

1. Incremental document ingestion.
2. Chunking with stable chunk identifiers derived from revision/content structure where practical.
3. Embedding storage and retrieval backed by PostgreSQL + pgvector.
4. Metadata filtering for:
   - namespace;
   - source type;
   - document status;
   - revision status;
   - source authority;
   - repository;
   - document path;
   - timestamps.
5. Neo4j property-graph integration for graph storage and graph retrieval.
6. Hybrid retrieval:
   - semantic/metadata-filtered document retrieval from PostgreSQL + pgvector;
   - graph traversal and impact analysis from Neo4j;
   - source excerpt retrieval from PostgreSQL for every material answer.

Do not expose an unconstrained text-to-Cypher interface to ordinary agents.

Instead, implement parameterized read-only retrieval operations conceptually equivalent to:

- search_current_docs(query, filters)
- get_source_excerpt(revision_id, chunk_id)
- find_impact(entity_or_change)
- find_dependency_path(from_entity, to_entity)
- get_revision_history(document)
- get_entity_provenance(entity_or_relationship)

For expert-only graph access, if it is ever implemented:

- enforce Neo4j read-only credentials;
- allow only approved labels and relationship types;
- enforce timeouts;
- enforce depth limits;
- enforce result limits;
- parameterize all values;
- block write clauses and administrative clauses;
- log all graph queries.

Do not give subagents direct credentials for PostgreSQL or Neo4j.

============================================================
PHASE 6 — IMPLEMENT THE SINGLE-WRITER INGESTION WORKER
============================================================

Implement one ingestion worker process only.

It must be the only process permitted to write to:

- shared PostgreSQL knowledge tables;
- pgvector embeddings;
- Neo4j graph projection.

Subagents and query services are read-only consumers.

Ingestion sequence:

1. Receive a document-change event from a controlled source:
   - repository update;
   - generated-document completion;
   - approved filesystem watcher;
   - explicit ingestion command.

2. Debounce repeated events for the same document/source.

3. Acquire a PostgreSQL-backed lease for the ingestion job.

4. Read the finalized source content.

5. Calculate a content hash.

6. Compare the content hash to the active/latest indexed revision.

7. If unchanged:
   - record that no reindexing is necessary;
   - exit successfully.

8. If changed:
   - create a new immutable document revision;
   - mark it processing;
   - chunk the content;
   - generate embeddings;
   - write chunks/embeddings and provenance to PostgreSQL;
   - extract only schema-approved entities and relationships;
   - validate extracted structure;
   - upsert nodes and relationships in Neo4j;
   - record graph projection completion;
   - supersede the previous current revision only after the new revision is fully indexed and graph-projected;
   - activate the new revision.

9. If any step fails:
   - capture useful error diagnostics;
   - preserve the previous active revision;
   - mark the new revision/job retryable or failed;
   - never leave the old active data incorrectly deactivated;
   - do not silently discard failed work.

Use bounded retries with backoff. Avoid infinite loops.

Never allow multiple ingestion workers to simultaneously process the same source without an explicit safe concurrency design and verified locking behavior.

============================================================
PHASE 7 — DATA MIGRATION FROM SQLITE
============================================================

The existing SQLite database remains embedded within the application.

Do not delete it.
Do not replace it.
Do not make Neo4j or PostgreSQL a mandatory runtime dependency for unrelated embedded application functions.
Do not use SQLite as the shared graph/vector/documentation store after migration.

Perform migration safely:

1. Back up the SQLite database before reading from it.
2. Inspect its actual schema before writing migration code.
3. Do not invent table names, column names, document identifiers, or metadata fields.
4. Export only the documentation/index metadata that genuinely belongs in the new shared knowledge system.
5. Preserve source paths, hashes, document identifiers, timestamps, and provenance wherever available.
6. Load canonical document/revision records into PostgreSQL.
7. Rebuild embeddings in pgvector rather than assuming SQLite embeddings can be copied safely.
8. Backfill Neo4j from PostgreSQL-backed revisions using the approved graph schema.
9. Validate document counts, revision counts, and representative source citations.
10. Keep the SQLite database available to the existing application after migration.

Before switching retrieval traffic, provide a migration report containing:

- number of documents discovered in SQLite;
- number successfully migrated;
- number skipped and why;
- number of revisions created;
- number of chunks indexed;
- number of graph nodes and relationships created;
- errors requiring manual review;
- confirmation that the original SQLite database was retained unchanged.

============================================================
PHASE 8 — VALIDATION AND ACCEPTANCE TESTS
============================================================

Do not declare the deployment complete without passing all applicable tests.

Test categories:

A. Infrastructure
- PostgreSQL survives container restart.
- Neo4j survives container restart.
- Persistent data remains available.
- pgvector extension is present.
- Database credentials are not present in tracked files.
- Services are not publicly exposed by default.

B. Ingestion correctness
- Ingest one representative current document.
- Re-run ingestion with identical content and verify no duplicate revision/chunks/graph entities are created.
- Modify the document and verify exactly one new revision is created.
- Verify the old revision is retained and marked superseded only after the new revision succeeds.
- Simulate a Neo4j projection failure and verify the previous active revision remains active.
- Retry the failed job and verify graph projection becomes consistent without duplicates.

C. Semantic retrieval
- Search for a known fact in a current document.
- Verify returned results include source path/URI, revision identifier, chunk identifier, and excerpt.
- Verify superseded documents are excluded by default.
- Verify namespace and metadata filters work.

D. Graph retrieval
- Seed or ingest a known dependency chain.
- Verify `find_dependency_path` returns the correct ordered path.
- Verify `find_impact` returns affected entities within configured traversal limits.
- Verify every returned relationship includes provenance to a source revision/chunk.
- Verify current-only graph queries exclude superseded graph facts by default.

E. Security and access
- Verify ingestion credentials can write only where required.
- Verify retrieval credentials are read-only.
- Verify general subagents do not receive raw PostgreSQL or Neo4j credentials.
- Verify write Cypher cannot be executed through any retrieval tool.
- Verify query timeouts, depth limits, and result limits are enforced.

============================================================
DELIVERABLES
============================================================

At the end, provide:

1. A list of every installed component and exact version.
2. A list of every created configuration file, migration, script, service, and environment variable name.
3. Docker Compose startup and shutdown commands appropriate to the verified environment.
4. Safe local connection instructions that do not expose secrets.
5. The PostgreSQL schema/migration summary.
6. The Neo4j node/relationship schema summary.
7. The LlamaIndex integration summary.
8. The ingestion worker lifecycle and failure/retry behavior.
9. The read-only tools exposed to subagents.
10. A migration report from SQLite, if migration was performed.
11. Validation results for every acceptance test.
12. Any blockers, assumptions needing user confirmation, or steps deliberately not performed.

STRICT SAFETY RULES
============================================================

- Do not delete existing data.
- Do not overwrite existing database services or volumes.
- Do not use `latest` container tags.
- Do not hardcode secrets.
- Do not commit secrets.
- Do not expose databases to the public network by default.
- Do not install extra databases “just in case.”
- Do not allow multiple uncontrolled ingestion writers.
- Do not give agents raw write access to PostgreSQL or Neo4j.
- Do not allow unrestricted LLM-generated Cypher.
- Do not consider Neo4j the source of truth.
- Do not remove or repurpose SQLite; retain it strictly for the embedded application’s own usage.
- Do not mark a document revision current until both PostgreSQL indexing and Neo4j graph projection succeed.
- Do not claim success without command output or test evidence.
- If a required detail is unknown, inspect it. If it cannot be inspected safely, stop and ask a focused question rather than guessing.