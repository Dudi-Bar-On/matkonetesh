# Neo4j native Windows service install — what you're about to run, and why

**Status:** prepared, not run. The install needs elevation the agent doesn't have — you run
`scripts/install-neo4j-native.ps1` yourself from an elevated PowerShell prompt. This document is
what to read before you do.

## Why this exists

Task 2 of the Docker-exit arc moves Neo4j out of the `mk-neo4j` container and onto this machine as
a native Windows service — the same move already made for PostgreSQL on 2026-08-06. Neo4j stays in
the container a little longer than Postgres did because there is no bulk rebuild path for its
7,941 nodes yet; Task 3 closes that gap with `neo4j-admin database load` against a dump taken from
the container.

## What the script does, in order

1. Refuses if not elevated, if a `neo4j` service already exists, if ports 7687/7474 (from
   `infra/.env`) are already listening, or if `C:\neo4j\neo4j-2026.06.0` already exists.
2. Checks for an existing JDK 21/25 on PATH. **On this machine, as measured 2026-08-07, there is
   none** — no `java` on PATH, no install under `C:\Program Files\Java`, `Eclipse Adoptium`, or the
   `HKLM:\SOFTWARE\JavaSoft` / `Eclipse Adoptium` registry keys. The script installs **Eclipse
   Temurin JDK 25** via `winget` (id `EclipseAdoptium.Temurin.25.JDK`) to match the container's
   measured JDK, Temurin OpenJDK 25.0.3 — patch level need not match, vendor and major version do.
   *Caveat:* `docs/vendor/neo4j/03-install-requirements.md`'s Windows software-requirements table
   lists only OracleJDK and ZuluJDK for Windows; Temurin isn't named there even though it's the
   vendor already running in the container and a certified OpenJDK 25 build. This is a judgement
   call, not a documented Neo4j guarantee — flagged rather than hidden.
3. Downloads Neo4j 2026.06.0 Community for Windows from `dist.neo4j.org` and extracts it to
   `C:\neo4j\neo4j-2026.06.0`. `NEO4J_HOME` is set machine-wide to that path.
4. Appends loopback-only listen-address settings to `conf\neo4j.conf`:
   `server.default_listen_address=127.0.0.1`, `server.bolt.listen_address=127.0.0.1:<port>`,
   `server.http.listen_address=127.0.0.1:<port>`, `server.https.enabled=false` — the same ports
   `infra/.env` already declares (7687/7474), so `src/knowledge/config.py` needs no change between
   the container and this install. Also carries over the memory bounds `infra/compose.yaml`
   already applies to the container (512m–2G heap, 1G pagecache), rather than leaving a native
   install unbounded.
5. Sets the initial password for the built-in `neo4j` user from `infra/.env`'s `NEO4J_PASSWORD` —
   **the same value the container already uses**, read once, never echoed, never written anywhere
   else. Nothing new was generated for this.
6. Installs the Windows service, sets it to Automatic startup, starts it, and waits up to 90s for
   the bolt port to come up.
7. Prints a summary block (version, `NEO4J_HOME`, service status, ports, JDK) you can paste back.

**The database will be empty when this finishes. That is correct**, not a failure — Task 3 loads
the data via `neo4j-admin database load` against a dump taken from the container.

## Before you run it

- **Before taking the Task 3 dump, confirm nothing is writing to the graph** — no
  `extract_graph.py` running, no ingest in flight — and take the baseline/dump at that moment.
  Learned the hard way an hour before this was written: a graph baseline taken *while* the
  background extraction was running came back higher on every single count than the spec's figures
  (`Module 10049` against `9877`, `Document 920` against `857`). `graph-baseline.mjs` cannot tell
  that something is writing underneath it — a baseline taken against a moving target isn't a
  baseline, and a migration verified against a noisy measurement passes or fails at random, which
  is worse than not verifying it, because it produces a number that *looks* like evidence. Check
  for a live extraction process before dumping, not after the numbers already disagree.
- **Stop the container first**: `docker stop mk-neo4j`. The script checks ports 7687/7474 and
  refuses if anything is already listening — right now that's the container itself, and the script
  will not stop it for you.
- Run from an **elevated** PowerShell prompt, from the repo root:
  ```powershell
  .\scripts\install-neo4j-native.ps1
  ```
- It downloads roughly 190 MB (the Community zip) and, if no JDK is present, however much
  `winget` needs for Temurin 25 — both one-shot network fetches, done once.

## Rollback

The container is **stopped, not deleted**, until Task 12 of the arc closes it out permanently. Its
volumes (`mk-neo4jdata`, `mk-neo4jlogs`, `mk-neo4jplugins`) are untouched by this script — it never
runs a `docker` command. To roll back:

```powershell
# Stop and remove the native service (leaves C:\neo4j\neo4j-2026.06.0 on disk; delete manually if desired)
& "$env:NEO4J_HOME\bin\neo4j.ps1" windows-service uninstall

# Bring the container back
docker start mk-neo4j
```

`infra/.env` does not need to change either way — both the container and the native install read
the same `NEO4J_USER` / `NEO4J_PASSWORD` / `NEO4J_BOLT_PORT` / `NEO4J_HTTP_PORT`.

## Verify it landed

No elevation needed:

```powershell
.\scripts\verify-neo4j-native.ps1
```

It checks, and fails loudly (non-zero exit) if any of these is missing: the `neo4j` service exists
and is `Running`, its startup type is `Automatic`, the **live socket table** (not the config file)
shows the bolt and http ports listening on `127.0.0.1` only, a real `RETURN 1` Cypher query answers
through `cypher-shell`, and the reported version is `2026.06.0`.

Run **before** the install, it correctly fails — that's Task 2's RED, proving the verifier can
detect an absent install:

```
[FAIL] service exists - no Windows service named 'neo4j' was found.
[PASS] bolt port 7687 listening - listener(s) found: 127.0.0.1
[PASS] bolt loopback-only - 127.0.0.1/::1 only
[PASS] http port 7474 listening - listener(s) found: 127.0.0.1
[PASS] http loopback-only - 127.0.0.1/::1 only
[FAIL] answers RETURN 1 - cypher-shell not found (NEO4J_HOME=) - Neo4j is not installed here.
[FAIL] version matches 2026.06.0 - neo4j CLI not found (NEO4J_HOME=) - cannot check version.

VERIFY FAILED: 3 check(s) did not pass: service exists; answers RETURN 1; version matches 2026.06.0
EXIT CODE: 1
```

(The two port checks pass here because the container is currently running and already holds those
ports on loopback — that's expected pre-install, not a native-service success.)

## If the install refuses

Every refusal in `install-neo4j-native.ps1` names the exact remedy in its own output — re-read the
message, it's written to be actionable without coming back to ask. The most likely ones on this
machine:

- **"port ... is already listening"** → the container wasn't stopped first. `docker stop mk-neo4j`.
- **"a Windows service named 'neo4j' already exists"** → either a previous run got partway (the
  script isn't idempotent past its checks), or this is a re-run. Decide which, and either
  `neo4j windows-service uninstall` or run `verify-neo4j-native.ps1` to see whether it's already
  correctly installed.
- **JDK/winget failure** → install a JDK 21 or 25 manually (OracleJDK or ZuluJDK, per the vendor's
  own Windows support table) and re-run.

## What came from where

- **From `docs/vendor/neo4j/`** (2026.06.0 corpus, ingested 2026-08-07): the service-install steps
  and Windows PowerShell module (`02-install-windows.md`), the JDK/hardware requirements table
  (`03-install-requirements.md`), the `NEO4J_HOME`/`conf`/`data` layout (`05-file-locations.md`),
  the default ports and listen-address settings (`23-ports.md`,
  `27-configuration-settings-02.md`), and the `neo4j-admin dbms set-initial-password` syntax
  (`24-set-initial-password.md`).
- **From measuring this machine (2026-08-07):** no JDK present anywhere searched (PATH, Program
  Files, registry); no `neo4j` Windows service exists; ports 7687/7474 currently held by the
  running `mk-neo4j` container, loopback-only; `winget` is available and lists
  `EclipseAdoptium.Temurin.25.JDK` (25.0.4.7) as installable.
- **What the corpus could not answer:** a stable, scriptable download URL for the Windows zip.
  `02-install-windows.md` only points at the "Neo4j Deployment Center," a dynamic web page, not a
  fetchable link — and `docs/vendor/neo4j/README.md` records that `neo4j.com` itself returned
  HTTP 403 to an earlier automated fetch. The script uses `dist.neo4j.org`, Neo4j's own artifact
  host, confirmed reachable for this exact file (a >10 MB response, not a 404), but that URL isn't
  written down anywhere in the corpus. This is a real gap in the corpus, not a shortcut taken to
  avoid reading it.
