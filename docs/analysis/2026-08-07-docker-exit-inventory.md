# Docker exit — factual inventory (2026-08-07)

Read-only research. Every count below is either **measured** (a command was actually run against
the live PostgreSQL/Neo4j) or **read** (quoted from a specific file:line). Nothing here is assumed.
Where a fact could not be established, it is marked `NOT ESTABLISHED`.

**Scope check first:** the code search for `docker` (case-insensitive) touches **11 files**, not
10 — `scripts/register-extraction-task.ps1` also names Docker (in a comment explaining why the
scheduled task must run via S4U rather than SYSTEM). It is not a call site, but it is coupled to
this exit and is covered in §1.9.

---

## §1 · The `docker` call-site inventory

Every line containing the string `docker` (case-insensitive) in the 10 named files, file:line,
what it does, its target, and what it must become. 34 lines matched in total across these 10
files (comments included) — the owner's count of 24 reflects functional call sites only; both
are reported here so nothing is silently dropped.

### 1.1 `scripts/run-extraction.ps1` — 8 lines (3 real invocations, 5 comments)

| Line | Text | Does | Targets | Becomes |
|---|---|---|---|---|
| 33 | `wsl -u root -e bash -lc "service docker start"` | Starts the Docker **daemon** inside WSL | the daemon itself | **Deleted.** No daemon to start once Neo4j is the last container and it too moves off Docker; until then it is still needed for Neo4j. |
| 37 | `wsl -e bash -lc "cd .../infra && docker compose up -d"` | Brings up whatever `infra/compose.yaml` declares | **Neo4j only** — Postgres was removed from this file on 2026-08-07 (R-108) | Deleted once Neo4j is native; a Windows `Start-Service`/health-poll equivalent, matching the pattern already used for `postgresql-x64-18` (see `scripts/watchman.ps1` mk_rules-postgres component, §1.2). |
| 44 | `docker exec mk-postgres pg_isready -h 127.0.0.1 -q` | Waits for Postgres to answer before launching the extractor | **Postgres — and `mk-postgres` no longer exists.** The container and its `mk-pgdata` volume were deleted 2026-08-07. | **Already broken today.** This is a *latent failure sitting in the script right now*: on the next scheduled run, this `docker exec` will fail (`No such container: mk-postgres`), the readiness loop will exhaust 60×5s=300s, and the script will exit 1 without ever launching the extractor — silently, since it is a Task Scheduler job nobody watches interactively. It must become a native readiness probe against `postgresql-x64-18` (e.g. the same `pg_isready.exe`/`Test-RulesPgUp`-style check `watchman.ps1`'s mk_rules-postgres component already uses, §1.2) *before* this script's next scheduled invocation, independent of the wider Docker-exit timeline. |
| 9, 11, 21, 32, 34 | Comment prose / a log string (`Say "docker daemon: start requested"`) | Explain the above | — | Rewritten once the code above changes; not independently actionable. |

**Reconciling the owner's count of 5 for this file:** counting only lines that *do* something
(33, 37, 44) plus the two headline comments that describe rationale (9, 32) gets to 5 one
plausible way; this table gives all 8 so the choice of what counts is visible rather than assumed.

### 1.2 `scripts/watchman.ps1` — 3 lines, all comments, zero live calls

Lines 423, 426, 429 are prose inside the `geniza-postgres` component's already-rewritten
docstring, describing what the *old*, since-replaced Detect/Recover logic used to do
(`docker exec mk-postgres pg_isready`, `docker compose up -d`). **This component was already
migrated off Docker** on 2026-08-06/07 — it now runs a real `SELECT` through
`src.knowledge.config.connect_reader()` against the native `postgresql-x64-18` service, and its
Recover is a deliberate no-op (mk_rules-postgres, which runs earlier in the same array, already
calls `Start-Service` against that service). **There is no Neo4j component in `watchman.ps1` at
all** — grepped for `Neo4j`/`neo4j` in the whole file, zero matches. This is a real gap for the
new design: watchman currently does not watch Neo4j (in Docker or otherwise), so "native Neo4j"
needs a *new* component, not a migrated one, if the owner wants watchman coverage to continue.

### 1.3 `tests/test_acceptance_infra.py` — 13 lines, 12 real `docker`/`wsl` interactions

This file is Phase 8 acceptance category A and is the largest concentration of Docker
dependency in the suite. Every test here calls `wsl(...)`, which shells into
`wsl -d Ubuntu-20.04 -u root -e bash -lc "<command>"`.

| Test | Line(s) | Does | Targets | Becomes |
|---|---|---|---|---|
| `_require_docker()` | 49–52 | `docker ps --format ...`; skips if unreachable | the Docker daemon | Deleted once Neo4j is native — nothing left to gate on. |
| `test_A1_postgres_survives_a_container_restart` | 73, 85 | `docker compose restart postgres` | **Postgres — `postgres` is no longer a service in `infra/compose.yaml`** | **Already broken, and worse than skipped: if ever run with `MK_RESTART_TESTS=1`, `docker compose restart postgres` fails (no such service), `result.returncode != 0`, and the `assert` at line 86 FAILS the test outright** — this is not a skip, it is a red test waiting for the one day someone runs the restart suite. The test's *purpose* ("PostgreSQL survives a restart with its data") still matters, but as a native-service test: `Restart-Service postgresql-x64-18` (needs elevation) + before/after row counts through `config.connect_reader()`. |
| `test_A2_neo4j_survives_a_container_restart` | 112, 120 | `docker compose restart neo4j` | Neo4j, still in Docker today | Stays as-is until Neo4j itself goes native, then becomes a `Restart-Service`-based test identical in shape to the rewritten A1. |
| `_compose_container_names()` | 231 | `docker ps --filter label=com.docker.compose.project=...` | whatever the compose project has running (today: Neo4j only) | Deleted with the last container. |
| `test_A6_services_are_not_exposed_beyond_loopback` | 252, 260 | `docker inspect` on running containers, checks `HostIp` bindings are `127.0.0.1`/`::1` | Neo4j today | **Vanishes silently, not breaks** — once Docker is gone there is nothing left for `_require_docker()` to find, so the whole test **skips** (`pytest.skip`, not fail) forever. See §4.1 for the rule it protects and the Windows equivalent. |
| `test_A7_no_container_uses_a_floating_latest_tag` | 288, 290 | `docker inspect --format '{{.Config.Image}}'`, asserts a tag exists and is not `:latest` | Neo4j today | **Also vanishes silently.** See §4.2. |

### 1.4 `tests/test_pg_schema.py` — 2 lines, both stale prose

Line 3 (module docstring) and line 58 (`pytest.skip` message) both say "start it with:
`docker compose up -d`". **The actual connection code never calls Docker** — `_params()` reads
`infra/.env` and connects to `127.0.0.1:{POSTGRES_PORT}` directly via `psycopg2`. This is already
correct for a native Postgres; only the human-facing instruction text is stale (should read
"start it with: `Start-Service postgresql-x64-18`" or similar). Not a functional call site.

### 1.5 `tests/test_retrieval.py` — 2 lines, both stale prose

Line 162 (`_require_pg`'s skip message) — same as above, stale text only, connects via
`config.connect_reader()` directly. Line 202 (`test_find_impact_runs_against_the_live_graph`'s
skip message) — targets **Neo4j**, and the instruction is currently correct (Neo4j is still
`docker compose up -d`'d). Becomes stale text once Neo4j is native, same as the Postgres ones.

### 1.6 `scripts/check-geniza-fresh.mjs` — 2 lines, both stale prose

Line 14 (comment: "A developer without Docker up...") and line 107
(`SKIPPED — the geniza is not reachable (start it: docker compose up -d in infra/).`). The actual
check runs a Python subprocess that calls `config.connect_reader()` — **Postgres only, already
native, zero Docker dependency in the executed code.** Text-only fix.

### 1.7 `scripts/check-geniza-reader.py` — 2 lines, both historical-explanation prose

Lines 6 and 8 are docstring text explaining *why* this script was rewritten away from
`docker exec mk-postgres pg_isready` to a real `connect_reader()` SELECT. **This file already has
zero Docker dependency in its executed code** — it is a completed migration, not a pending one.
No change needed beyond, optionally, trimming the now-doubly-historical explanation.

### 1.8 `tests/test_graph_schema.py` — 1 line

Line 209: `pytest.skip(f"Neo4j is not reachable (...) — start it with: docker compose up -d")`.
The connection itself (`_session()`, lines 193–210) builds a `bolt://127.0.0.1:{NEO4J_BOLT_PORT}`
driver directly from `infra/.env` — **no Docker call in the executed path**, this is a skip-message
string. Correct today (Neo4j is still Docker); becomes stale text when Neo4j goes native.

### 1.9 `tests/test_acceptance.py` — 1 line

Line 36: `_require_stack()`'s skip message, `docker compose up -d`. Connects via
`config.connect_writer()` directly — Postgres, already native, text-only staleness.

### 1.10 `tests/test_worker.py` — 1 line

Line 38: identical pattern to 1.9 — Postgres, already native, text-only staleness.

### 1.11 Bonus: `scripts/register-extraction-task.ps1` (not in the original 10-file list)

Not a `docker` *call*, but its whole reason for existing is coupled to Docker: lines 5–13 explain
that the scheduled task must run via an S4U logon trigger rather than as `SYSTEM`, because
`SYSTEM` cannot use WSL (`WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED`) and therefore could never start the
Docker daemon that `run-extraction.ps1` depends on. **Once Neo4j is native and `run-extraction.ps1`
no longer touches WSL/Docker at all, this constraint disappears** — the task could run as `SYSTEM`,
which is the more standard choice for a boot-time job and needs no stored user credential. Worth
revisiting in the same spec, not a Docker-exit blocker on its own.

### Summary — what is dead today vs. what dies with Neo4j

- **Already broken (latent, unrelated to any future Neo4j move):** `run-extraction.ps1:44`
  (`docker exec mk-postgres`) and `test_acceptance_infra.py`'s `test_A1` (`docker compose restart
  postgres`, opt-in only so it hasn't been *observed* red, but would fail immediately if run).
- **Stale text only, already functionally correct (7 files):** `test_pg_schema.py`,
  `test_retrieval.py`'s Postgres skip, `check-geniza-fresh.mjs`, `check-geniza-reader.py`,
  `test_acceptance.py`, `test_worker.py`, and the completed half of `watchman.ps1`.
  All of these connect straight to `127.0.0.1` and never shell to Docker; only their
  human-facing strings still say "docker compose up -d".
  **Note:** `infra/.env.example` still lists `POSTGRES_PORT=5433` (the old container's port) —
  a real live `infra/.env` now uses `5432` per `watchman.ps1`'s own comment (line 425). The
  example file is itself stale and would mislead a fresh setup.
- **Still functionally live, targets Neo4j, dies when Neo4j goes native (5 files):**
  `run-extraction.ps1` (daemon start + compose up), `test_acceptance_infra.py`
  (`_require_docker`, A2, A6, A7, container-name discovery), `test_retrieval.py`'s Neo4j skip,
  `test_graph_schema.py`'s Neo4j skip, and `infra/compose.yaml` itself.

---

## §2 · Native Neo4j on Windows

**Geniza checked first, per §10.11/§10.17 — and it does not have this.** Queried
`search_current_docs`/`semantic_search` for "neo4j windows service install", "neo4j-admin server
windows", "JDK Java requirement Neo4j", "neo4j.conf data directory", "neo4j auth
set-initial-password", "Neo4j bolt port default" — all against the whole corpus and against
`namespace: vendor`. `docs/vendor/` has folders for `playwright`, `serena`, `llamaindex`,
`ollama`, `tree-sitter`, `bge-m3`, `sqlite`, and others — **no `docs/vendor/neo4j/`**. The only
Neo4j material in the geniza is this project's own operational lessons in
`docs/process/development-discipline.md` (L52 CalVer note, L53 the leading-`-` password bug) and
`docs/infra/dependency-summary.md`/`infra/compose.yaml` (what version is pinned and why). **This is
a real gap: unlike every other vendor this project depends on, Neo4j's own docs were never
ingested.** Flagging per §10.11's usefulness gate — worth ingesting before or during this work.

Everything below is therefore either measured directly against this machine's own running
container, read from this repo, or fetched from `neo4j.com`'s official docs (`neo4j.com` itself
403'd this session's `WebFetch`; the GitHub mirror of `neo4j/docs-operations` and web search
answered instead — both cited).

- **Version: `2026.06.0` Community, already the newest.** `infra/compose.yaml` pins
  `neo4j:2026.06.0-community`, and a web search for the latest Neo4j Community release
  (August 2026) returned the same version, published 2026-07-02, as current. The owner's "always
  install latest" rule is therefore satisfied by staying on the version already chosen for the
  container — no version change, only a packaging change. One nuance worth carrying into the spec:
  `development-discipline.md` L52 notes Neo4j moved to CalVer in Jan 2025, and `2026.06` is the
  **mainline** release, not the `5.26` **LTS** line (supported to June 2028) — "newest" and
  "longest-supported" are different lines, and the project has already chosen mainline once.
- **JDK: Java 25, measured directly, not inferred.** Ran `docker exec mk-neo4j java -version`
  against the actual running container (read-only — no start/stop/restart) and got:
  `openjdk version "25.0.3" 2026-04-21 LTS`, `Temurin-25.0.3+9`, on `Debian 13 (trixie)`. This is
  the exact JVM Neo4j 2026.06.0 ships and runs today, not a guess. Corroborated by the official
  docs (GitHub mirror of `docs-operations`, `installation/requirements.adoc`): Neo4j 2025.10+
  supports "Java SE 21 and Java SE 25"; for Windows Server, "OracleJDK 21/25 or ZuluJDK 21/25";
  Windows 11 for personal use with the same JDK options. **A native install needs a JDK 21 or 25
  installed on the Windows machine** — Temurin 25 (what the container already runs) is a
  reasonable, drop-in choice for consistency, but the docs list OracleJDK/ZuluJDK/Corretto/Red Hat
  OpenJDK as alternatives depending on OS.
- **Windows service install (from the official Neo4j Operations Manual, via GitHub mirror):**
  `bin\neo4j windows-service install`, then `bin\neo4j start`; `bin\neo4j windows-service
  uninstall` before upgrading an existing install. The service can run under any account that
  holds the "Log on as a service" right — does not need SYSTEM.
- **Data/config directory:** governed by `NEO4J_HOME` (the extracted installation directory) and
  the `NEO4J_CONF` environment variable, which lets data/config live outside `NEO4J_HOME` — the
  official guidance recommends doing exactly that, "to simplify the upgrade process later." The
  config file is `neo4j.conf` inside the `conf` directory under whichever home is in effect.
  **Exact default path (e.g. `C:\...\data`) was not independently confirmed** — the fetched mirror
  page describes the *mechanism* (`NEO4J_HOME`/`NEO4J_CONF`), not a literal default path string;
  marking this `NOT FULLY ESTABLISHED` rather than asserting a path I did not see.
- **Authentication:** `neo4j-admin dbms set-initial-password <password>` sets the password for the
  built-in `neo4j` user before first start (official docs). **This exact command is independently
  corroborated by this project's own lesson L53** (`development-discipline.md` line 1650-51): the
  Docker entrypoint calls this same command, and a generated password starting with `-` was
  misread as a CLI flag, crash-looping the container. A native install driven by an automated
  provisioning script (as this project would want, matching how `infra/.env`'s password is
  generated today) needs the same constraint L53 already discovered: no leading `-`, no `/`.
  Left unset, the default password is `neo4j`, forced to change at first login (official docs).
- **Ports:** Bolt `7687`, HTTP `7474` — Neo4j's standard defaults, and exactly what
  `infra/compose.yaml` already publishes (`127.0.0.1:${NEO4J_HTTP_PORT}:7474`,
  `127.0.0.1:${NEO4J_BOLT_PORT}:7687`) and what `infra/.env.example` sets
  (`NEO4J_HTTP_PORT=7474`, `NEO4J_BOLT_PORT=7687`). A native service would keep the same
  ports/env-var names the codebase (`src/knowledge/config.py`) already reads, so no code change is
  needed there beyond removing the Docker-specific pieces.
- **APOC:** the live container has `apoc` installed as a plugin (`NEO4J_PLUGINS: '["apoc"]'` in
  compose.yaml) and it is a **confirmed hard dependency**, not optional — `worker.py`'s
  `project_revision()` and `scripts/extract_graph.py`'s `write_proposed()` both call
  `apoc.merge.relationship` because Cypher cannot parameterise a relationship type. **A native
  install must include the APOC Core plugin jar** dropped into the `plugins` directory (the
  Docker image does this automatically via the env var; a native install has no equivalent
  auto-install and needs the jar placed manually or by the provisioning script), plus the same
  `dbms.security.procedures.unrestricted`/`.allowlist` config lines currently set via
  `NEO4J_dbms_security_procedures_unrestricted`/`_allowlist` env vars, translated into
  `neo4j.conf` entries.

**What came from where:** version + APOC dependency + ports + password-generation constraint (L53)
— from this repo (`compose.yaml`, `config.py`, `development-discipline.md`) and one direct
measurement (`java -version` inside the running container). JDK requirement, install command,
`NEO4J_HOME`/`NEO4J_CONF` mechanism, default-password behaviour — from the official Neo4j docs
(GitHub mirror + web search, `neo4j.com` itself blocked this session with HTTP 403). **Not
established:** the literal default Windows data-directory path, and whether `2026.06.0`
specifically (vs. the `2025.10`/`2025.01` versions the fetched requirements page enumerated)
has been given its own explicit JDK line in the official docs — the direct measurement above
(Java 25 inside the actual 2026.06.0 container) is offered as the stronger evidence for that gap.

---

## §3 · What the projection driver has to do

Read `src/knowledge/worker.py` in full (`project_revision`, lines 548–623, and its caller inside
`ingest_one`, lines 380–452) plus `scripts/extract_graph.py`'s `write_proposed()` (lines 187–236),
and queried the live Postgres/Neo4j directly (read-only) for every count below.

**Unit of work:** one document revision — `project_revision(source_path, namespace, document_id,
revision_id, chunks)`. `chunks` is the already-parsed, already-embedded chunk list (each with
`heading_path`, `chunk_index`) that `ingest_one` built earlier in the same call; `project_revision`
does not re-fetch anything from Postgres itself. A caller outside `ingest_one` (i.e. a bulk
rebuild driver) would need to **re-fetch `document_chunks` rows per revision** — `chunk_index` and
the metadata JSON's `heading_path` field — since that shape is not persisted anywhere else.

**Idempotent: yes, verified, not assumed.** Every write is `MERGE ... ON CREATE SET ... SET`
keyed on `canonical_id` (`Document`, `DocumentRevision`, `Section`) or on the relationship's own
`MERGE`. Re-running the same revision through `project_revision` updates the same nodes in place
rather than duplicating them — confirmed by reading the Cypher, not inferred from the docstring's
claim.

**One real gap in that idempotency, found by comparing counts, not by reading code alone:** the
live graph holds **927 `DocumentRevision` nodes**, but Postgres holds only **855 `is_current`
revisions** (927 total `document_revisions` rows: 855 current, 69 superseded, 3 failed).
`project_revision` sets `status = 'current'` on the revision node and its `HAS_REVISION`
relationship **every time it runs, for that revision only** — it never reaches back to demote the
*previous* revision's graph node when a new one supersedes it in Postgres (`worker.py` lines
425–431 update Postgres's `is_current`/`status` columns and nothing in Neo4j). So today's live
graph almost certainly carries ~72 `DocumentRevision` nodes still marked `status: 'current'` that
Postgres has long since marked `superseded`. **This is a pre-existing characteristic of the
per-revision path, not something a rebuild would introduce** — and a bulk rebuild that (correctly)
processes only the 855 `is_current` revisions would actually produce a *cleaner* graph than today's
live one on this one point, since it would never create those stale-`current` nodes in the first
place.

**How many current revisions a full rebuild would process: 855**, measured directly
(`SELECT count(*) FROM document_revisions WHERE is_current` → 855; `documents` → 856 — the one
extra document, `__test__/1892715983952.md`, is a test artifact with no current revision at all,
`current_revision_id IS NULL`, not a real corpus gap).

**What a bulk driver needs that the per-revision call does not have:**

1. **A driver/session reused across all 855 calls.** `project_revision` opens
   `config.neo4j_driver()` and closes it every single invocation (lines 586, 621) — correct for
   "one call per ingested document," wasteful for 855 calls back to back. A bulk driver should
   open one driver, one session (or a small pool), and iterate.
2. **Batching.** Each `project_revision` call issues `1 + len(section_cids)` separate
   `session.run()` calls (one for the Document/Revision spine, one per Section). For a rebuild
   this could be batched with `UNWIND` per revision, or at minimum grouped into an explicit
   transaction per revision rather than autocommitted `session.run()` calls, to bound how much a
   crash mid-revision leaves half-written (currently: nothing prevents the Document+Revision write
   succeeding and a later Section write failing, leaving that revision's spine partially projected
   — `project_revision` itself has no transaction wrapper).
3. **Chunk re-fetch per revision**, as above — the bulk driver's own SQL, not present in
   `project_revision`.
4. **A progress/resume story.** `project_revision` has none — a single call either fully succeeds
   or raises. For 855 revisions the operation is idempotent, so a naive "run it again from the
   start" is always *safe*, but not *fast*: without a persisted cursor (e.g. "last document_id
   fully projected," reusing the `graph_projection_state` table's shape or a new column), a rebuild
   interrupted at revision 800 has to decide between re-doing 800 idempotent-but-not-free writes or
   building a resume marker that does not exist today.
5. **Per-revision error isolation.** `ingest_one`'s exception handling (lines 454–474) is built
   around one document's ingestion failing without touching any other document's data — that
   isolation is a property of the *whole* ingest pipeline, not of `project_revision` in isolation.
   A bulk driver calling `project_revision` 855 times needs its own try/except per revision so one
   malformed revision does not abort the run.

**Does anything other than `project_revision()` write to Neo4j — yes, and this is the single
most important finding of this section.** `scripts/extract_graph.py`'s `write_proposed()`
(lines 187–236) is a second, independent write path. It `MERGE`s `Module` nodes and writes
relationships of type `CALLS`, `DEPENDS_ON`, `PRODUCES`, `DESCRIBES`, `AFFECTS`, `CONSUMES`,
`CITES`, `OWNED_BY`, `CONTRADICTS`, `IMPLEMENTS` via `apoc.merge.relationship`, with
`status: 'proposed'`, confidence scores, and evidence text — the output of an ~11-seconds/chunk
local LLM extraction pass run by `scripts/run-extraction.ps1` (a 12,860-chunk corpus; the
project's own history records a 17-hour run).

**Measured directly against the live graph** (read-only `MATCH (n) RETURN labels(n), count(*)` /
`MATCH ()-[r]->() RETURN type(r), count(*)`):

| Label / relationship | Count | Written by |
|---|---|---|
| `Module` (node) | 9,877 | `extract_graph.py` only |
| `Section` (node) | 5,754 | `project_revision` |
| `DocumentRevision` (node) | 927 | `project_revision` |
| `Document` (node) | 857 | `project_revision` |
| `CALLS` | 7,223 | `extract_graph.py` only |
| `HAS_SECTION` | 7,792 | `project_revision` |
| `DEPENDS_ON` | 4,704 | `extract_graph.py` only |
| `PRODUCES` | 1,186 | `extract_graph.py` only |
| `DESCRIBES` | 1,095 | `extract_graph.py` only |
| `HAS_REVISION` | 927 | `project_revision` |
| `AFFECTS` | 811 | `extract_graph.py` only |
| `CONSUMES` | 728 | `extract_graph.py` only |
| `CITES` | 179 | `extract_graph.py` only |
| `OWNED_BY` | 117 | `extract_graph.py` only |
| `CONTRADICTS` | 66 | `extract_graph.py` only |
| `IMPLEMENTS` | 51 | `extract_graph.py` only |

**And this data does not exist anywhere in PostgreSQL.** Checked the full table list
(`documents`, `document_chunks`, `document_revisions`, `data_chunk_vectors`,
`graph_projection_state`, `ingestion_jobs`, `revisions_pending_extraction` — seven tables, no
others) and read `_mark_extracted()` (`extract_graph.py` lines 239–267): the only trace extraction
leaves in Postgres is `graph_projection_state.extracted_at`/`extracted_model`/`extracted_count`/
`extraction_rejected` — **counters and a timestamp, never the candidate facts themselves**
(no source/target/type/confidence/evidence columns anywhere). Measured: **848 revisions have been
through extraction, 24 are pending, and the sum of `extracted_count` across the corpus is 16,581**
kept candidate facts — none of which are reconstructable from Postgres.

**Consequence for the rebuild design, stated plainly:** a driver built only around
`project_revision()` would faithfully reproduce the deterministic spine — 857 `Document` +
927 `DocumentRevision` + 5,754 `Section` nodes and their `HAS_REVISION`/`HAS_SECTION` edges — and
would **silently drop the 9,877 `Module` nodes and all ten extracted relationship types
(roughly 16,000–24,700 edges depending on how CALLS is counted), which exist only in Neo4j today.**
This directly qualifies the framing that "the graph holds nothing the source of truth cannot
regenerate": the deterministic spine is regenerable from Postgres; **the extracted relationship
layer, which is the majority of the graph's node and edge volume, is not** — recovering it
requires either (a) re-running `scripts/extract_graph.py` over the full corpus, which the
project's own history puts at 17 hours for one pass, or (b) treating Neo4j's own data files
(the `mk-neo4jdata` volume) as something to migrate/preserve directly rather than something a
Postgres-driven rebuild regenerates from scratch. This is the fact the owner asked to have
surfaced before approving the "rebuild rather than dump/load" design.

---

## §4 · Docker-shaped gates that would vanish, not break

### 4.1 A6 — services not exposed beyond loopback

**What it protects:** that nothing this project runs listens on a network-reachable interface —
only `127.0.0.1`/`::1`. Today enforced by reading `docker inspect`'s `NetworkSettings.Ports` on
the running containers and asserting every `HostIp` is loopback (`test_acceptance_infra.py`
lines 246–279).

**Does the rule still apply natively — yes, unchanged.** A Windows service binding a TCP port is
exactly as capable of listening on `0.0.0.0` as a Docker container publishing one; nothing about
the risk goes away when the process stops being containerised.

**Windows equivalent:** `Get-NetTCPConnection -LocalPort <port> -State Listen` returns the
`LocalAddress` a listening socket is actually bound to — the direct analogue of `docker inspect`'s
`HostIp`, read from the OS's own state rather than from a config file's stated intention (matching
this test's existing design principle: read from the running thing, not from what it says it will
do). For Neo4j specifically, `NEO4J_HOME\conf\neo4j.conf`'s
`server.default_listen_address`/`server.bolt.listen_address`/`server.http.listen_address` state
the *intention*; `Get-NetTCPConnection` after the service is up states the *fact*, and per this
test's own stated design principle (comment at lines 249–250: "the daemon states a fact, and only
one of them is what an attacker meets") the live-socket check is the one to keep, not the config
read.

### 4.2 A7 — no floating `latest` tag

**What it protects:** that the exact software version running is pinned and visible, so
`docker compose pull` (or any operator action) cannot silently swap the database engine under the
project without a diff to review. Today enforced by asserting `docker inspect`'s
`.Config.Image` string has a tag and it is not `:latest` (lines 282–299).

**Does the rule still apply natively — the mechanism changes, but the underlying concern (silent,
undiffable version drift) still applies.** A native Windows service does not have an image tag —
there is no equivalent artifact string to inspect. The concrete Windows equivalent is checking the
installed binary's own version against what the provisioning script/documentation declares:
`(Get-Item "$Neo4jHome\lib\neo4j-*.jar").VersionInfo.ProductVersion` or, more simply, shelling the
already-available `neo4j.ps1 -Version`/`neo4j-admin --version` and asserting it matches a version
string committed to the repo (e.g. in `docs/infra/dependency-summary.md`, which already plays this
role for the other pinned versions in this project). The point A7 protects — "the running version
is not an accident" — has a real Windows-native form; it is a different mechanism (compare a
recorded version string to the installed one) rather than "assert no floating tag," since floating
tags are a container-registry concept with no native-service analogue.

### 4.3 Sweep of the rest of the suite for anything else Docker-shaped

Beyond A1/A2/A6/A7 (all already covered in §1.3) and the Postgres-only skip messages (§1.4–1.10,
already functionally native), the following were checked and found **not** Docker-dependent:

- **`.github/workflows/eval.yml` and `test.yml`** — grepped for `docker`/`neo4j`/`postgres`
  (case-insensitive): zero matches in either. CI already has no dependency on this stack; nothing
  here changes.
- **`scripts/check-meta.mjs`** (the session-start gate) — zero matches for `docker`/`neo4j`/
  `postgres`. Unaffected.
- **`tests/test_infra_deps.py`** (the dependency-version gate referenced by
  `dependency-summary.md`) — zero `docker`/`compose` matches; it checks installed Python packages,
  not containers.
- **A3 (`test_A3_pgvector_extension_is_present_and_usable`), A4 (secrets-in-tracked-files), A5
  (`.env` gitignored)** — none call `_require_docker()` or `wsl(...)`; A3 connects straight to
  Postgres, A4/A5 are pure filesystem/git checks. These do not vanish or break; they were already
  independent of Docker.
- **`infra/README.md`** — operational instructions (`docker compose up/down/-v`), not a test or
  gate; will need the same text update as the skip messages in §1, but enforces nothing on its own.

**Nothing else in the suite silently stops checking.** The full set that changes behaviour when
Docker disappears is exactly: A1 (already broken today, unrelated to timing), A2/A6/A7
(vanish to skip once `_require_docker()` finds nothing), and the Neo4j-reachability skip messages
in `test_retrieval.py`/`test_graph_schema.py` (currently correct, go stale once Neo4j moves).

---

## What could not be established

- The literal default Windows data-directory path for a native Neo4j install (the mechanism —
  `NEO4J_HOME`/`NEO4J_CONF` — is documented; a concrete default path string was not found in the
  page actually fetched).
- Whether Neo4j's official docs give `2026.06.0` its own explicit JDK line distinct from the
  `2025.10`/`2025.01` entries the fetched requirements page enumerated (`neo4j.com` itself
  returned HTTP 403 to this session's `WebFetch`; the direct measurement — Java 25 inside the
  actual running `2026.06.0` container — is offered in its place as stronger evidence than an
  inferred web citation would be).
- Whether the owner's "24" call-site count and this document's "34 lines / ~24 functional sites"
  reconcile line-for-line — the totals land in the same place by different counting rules (see
  §1's per-file notes); every individual line is listed so the difference is auditable rather than
  asserted away.
