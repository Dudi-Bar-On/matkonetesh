"""Phase 8 acceptance, category A — infrastructure.

SEPARATE FILE, and separate on purpose: two of these RESTART the database services. Running that
inside the main suite would break every other test's connection mid-flight and produce failures
that look like product bugs. The restart tests are opt-in via MK_RESTART_TESTS=1 and SKIP LOUDLY
otherwise — "not verified here" is information, and a suite that quietly omits them while
reporting green is the failure mode this project keeps paying for.

    MK_RESTART_TESTS=1 python -m pytest tests/test_acceptance_infra.py -v

UPDATED 2026-08-07 (docker-exit Tasks 4/6): PostgreSQL (`postgresql-x64-18`) and Neo4j (`neo4j`)
are both native Windows services now — `mk-postgres` was retired (R-108) and the Neo4j container
is stopped, kept only as a rollback until Task 12. A1 and A2 below restart the SERVICES
(`Restart-Service`), not containers; the property each protects — the database survives a restart
with its data intact — is unchanged by the move. A6 and A7 still read the Docker daemon
(`_require_docker`/`_compose_container_names`) — that is deliberate, not an oversight: rewriting
them for native Windows is a separate task (7/8), and until then they SKIP LOUDLY rather than
silently pass once nothing Docker-shaped is left running.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.knowledge import config  # noqa: E402

RESTART_ENABLED = os.environ.get("MK_RESTART_TESTS") == "1"


def _restart_windows_service(name: str) -> subprocess.CompletedProcess:
    """Restart-Service against a native Windows service, by name.

    Needs elevation (an unelevated caller gets an `AccessDenied`-shaped failure, surfaced through
    `returncode`/`stderr` like every other failure here — no special-casing). Routed through
    PowerShell rather than a hypothetical direct API call because `Restart-Service` already IS the
    documented, supported way to do this and every other native-service interaction in this repo
    (`watchman.ps1`'s mk_rules-postgres component) goes through the same cmdlet.
    """
    return subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command",
         f"Restart-Service -Name '{name}' -Force"],
        capture_output=True, text=True, timeout=120,
    )


def wsl(command: str, timeout: int = 300) -> subprocess.CompletedProcess:
    """Docker lives in WSL2 (no Desktop, no reboot — the owner works remotely).

    On a Linux CI runner there IS no `wsl`, and subprocess.run RAISES FileNotFoundError rather
    than returning a non-zero code — so a caller checking `returncode` never runs. That is how
    three of these tests turned CI red on their first push: an ABSENT tool reported as a FAILED
    one, which is L54 in its third costume. A synthetic failure is returned instead, and the
    callers' existing skip logic then does the right thing.
    """
    try:
        return subprocess.run(
            ["wsl", "-d", "Ubuntu-20.04", "-u", "root", "-e", "bash", "-lc", command],
            capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace",
        )
    except (FileNotFoundError, NotADirectoryError, OSError) as exc:
        return subprocess.CompletedProcess(args=command, returncode=127, stdout="", stderr=str(exc))


def _require_docker():
    result = wsl("docker ps --format '{{.Names}}'", timeout=60)
    if result.returncode != 0:
        pytest.skip(f"docker is not reachable from WSL: {result.stderr.strip()[:120]}")
    return result.stdout


def _require_stack():
    try:
        conn = config.connect_reader(timeout=5)
    except Exception as exc:
        pytest.skip(f"PostgreSQL is not reachable ({type(exc).__name__})")
    return conn


# --- persistence across a restart --------------------------------------------------------------

@pytest.mark.skipif(not RESTART_ENABLED, reason="restart tests are opt-in: set MK_RESTART_TESTS=1")
def test_A1_postgres_survives_a_service_restart_with_its_data():
    """A: "PostgreSQL survives container restart" + "Persistent data remains available."

    REWRITTEN 2026-08-07 (docker-exit Task 4): `mk-postgres` was retired (R-108); PostgreSQL is
    now the native Windows service `postgresql-x64-18`. The property this test protects — the
    database survives a restart with its data intact — is exactly as valid for a Windows service
    as it was for a container, so the test is rewritten against `Restart-Service`, not deleted.

    The count is taken BEFORE and compared AFTER. Checking only that the service comes back would
    pass on an empty volume, which is the failure this test exists to catch.
    """
    conn = _require_stack()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents")
            before = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM document_chunks")
            chunks_before = cur.fetchone()[0]
    finally:
        conn.close()
    assert before > 0, "nothing is stored, so surviving a restart would prove nothing"

    result = _restart_windows_service("postgresql-x64-18")
    assert result.returncode == 0, result.stderr

    for _ in range(60):
        try:
            conn = config.connect_reader(timeout=3)
            break
        except Exception:
            time.sleep(2)
    else:
        pytest.fail("PostgreSQL did not come back within 120s")

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM documents")
            after = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM document_chunks")
            chunks_after = cur.fetchone()[0]
    finally:
        conn.close()
    assert after == before, f"documents: {before} before, {after} after"
    assert chunks_after == chunks_before, f"chunks: {chunks_before} before, {chunks_after} after"


@pytest.mark.skipif(not RESTART_ENABLED, reason="restart tests are opt-in: set MK_RESTART_TESTS=1")
def test_A2_neo4j_survives_a_service_restart_with_its_data():
    """A: "Neo4j survives container restart" + "Persistent data remains available."

    REWRITTEN 2026-08-07 (docker-exit Task 6): Neo4j is now the native Windows service `neo4j`
    (the `mk-neo4j` container is stopped, kept only as a rollback until Task 12). Same rationale
    as A1: the property survives the move from container to service, so the test is rewritten
    against `Restart-Service`, not deleted.
    """
    driver = config.neo4j_driver()
    try:
        before = driver.execute_query("MATCH (n) RETURN count(n) AS c").records[0]["c"]
    finally:
        driver.close()
    assert before > 0, "the graph is empty, so surviving a restart would prove nothing"

    result = _restart_windows_service("neo4j")
    assert result.returncode == 0, result.stderr

    after = None
    for _ in range(60):
        try:
            driver = config.neo4j_driver()
            driver.verify_connectivity()
            after = driver.execute_query("MATCH (n) RETURN count(n) AS c").records[0]["c"]
            driver.close()
            break
        except Exception:
            time.sleep(2)
    assert after is not None, "Neo4j did not come back within 120s"
    assert after == before, f"graph nodes: {before} before, {after} after"


# --- these need no restart ----------------------------------------------------------------------

def test_A3_pgvector_extension_is_present_and_usable():
    """A: "pgvector extension is present."

    Present AND usable: an extension that is installed but whose operator is unavailable would
    pass a catalogue check and fail every query.
    """
    conn = _require_stack()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
            row = cur.fetchone()
            assert row, "the vector extension is not installed"
            cur.execute("SELECT '[1,2,3]'::vector <=> '[1,2,3]'::vector")
            assert abs(cur.fetchone()[0]) < 1e-9, "cosine distance to itself is not zero"
            cur.execute(
                "SELECT atttypmod FROM pg_attribute "
                "WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding'"
            )
            assert cur.fetchone()[0] == config.EMBED_DIM
    finally:
        conn.close()
    print(f"  pgvector {row[0]}, vector({config.EMBED_DIM}) column verified")


def test_A4_no_database_credential_is_present_in_a_tracked_file():
    """A: "Database credentials are not present in tracked files."

    Two independent checks: the entropy-based gate, and a direct search for the ACTUAL live
    passwords. The second is the one that would catch a leak the heuristic missed.
    """
    gate = subprocess.run(
        ["node", "scripts/check-no-secrets.mjs"], cwd=ROOT, capture_output=True, text=True, timeout=120
    )
    assert gate.returncode == 0, gate.stdout + gate.stderr

    # The second half needs the LIVE credentials to search for them, and CI has no infra/.env.
    # The entropy gate above still ran — so this test is not silently weaker in CI, it is
    # explicitly half-run and says which half.
    try:
        cfg = config.load_config()
    except config.ConfigError:
        pytest.skip("infra/.env is absent — the entropy gate ran; the live-credential search did not")
    tracked = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, timeout=60, encoding="utf-8"
    ).stdout.split("\n")
    secrets = [cfg.pg_reader_password, cfg.pg_writer_password, cfg.neo4j_password]
    assert all(len(s) > 12 for s in secrets), "a credential is too short for this check to mean anything"

    found = []
    for rel in tracked:
        if not rel:
            continue
        p = ROOT / rel
        try:
            if not p.is_file() or p.stat().st_size > 4_000_000:
                continue
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if any(s in text for s in secrets):
            found.append(rel)
    assert not found, f"a LIVE credential appears in tracked file(s): {found}"


def test_A5_the_env_file_carrying_the_secrets_is_not_tracked():
    """The corollary: infra/.env must be ignored, and infra/.env.example must be placeholders."""
    tracked = subprocess.run(
        ["git", "ls-files", "infra/"], cwd=ROOT, capture_output=True, text=True, timeout=60
    ).stdout.split("\n")
    assert "infra/.env" not in tracked, "the real .env is tracked"
    assert "infra/.env.example" in tracked, "the placeholder example is missing"

    ignored = subprocess.run(
        ["git", "check-ignore", "infra/.env"], cwd=ROOT, capture_output=True, text=True, timeout=30
    )
    assert ignored.returncode == 0, "infra/.env is not gitignored"


def _compose_container_names():
    """The containers this compose project actually declares, asked of the daemon, never hardcoded.

    A6 and A7 used to name `mk-postgres mk-neo4j` literally. When the superseded PostgreSQL container
    was retired on 2026-08-07 (R-108), both tests failed with `No such object: mk-postgres` — they were
    not wrong about security, they were wrong about the inventory, and a test that pins an inventory
    fails every time the inventory legitimately changes. Worse, the obvious "fix" is to edit the name
    list, which quietly teaches that these tests are a chore rather than a check.

    Derived instead from the compose project label, so adding or retiring a service needs no edit here
    and a NEW service is covered the moment it starts — which is the direction that matters, since an
    unchecked new container is exactly what A6 exists to catch.
    """
    result = wsl(
        "docker ps --filter label=com.docker.compose.project=matconetesh-knowledge "
        "--format '{{.Names}}'",
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    names = [n.strip() for n in result.stdout.split("\n") if n.strip()]
    # An empty list would make both tests pass by checking nothing — the failure mode this whole
    # repository keeps paying for. If the stack is down, that is a skip, not a green.
    if not names:
        import pytest

        pytest.skip("no containers from this compose project are running — nothing to inspect")
    return names


def test_A6_services_are_not_exposed_beyond_loopback():
    """A: "Services are not publicly exposed by default."

    Read from the RUNNING containers, not from compose.yaml — the file states an intention and the
    daemon states a fact, and only one of them is what an attacker meets.
    """
    _require_docker()
    # JSON, not a --format template. The template version ran an UNPUBLISHED port straight into
    # the next entry — `7473/tcp->7474/tcp->127.0.0.1:7474` — and the test failed on its own
    # string handling while every real binding was correct. Parsing structure beats parsing a
    # string that was never meant to be parsed.
    import json

    names = _compose_container_names()
    result = wsl("docker inspect " + " ".join(names), timeout=60)
    assert result.returncode == 0, result.stderr
    containers = json.loads(result.stdout)
    assert len(containers) == len(names), f"expected {len(names)} container(s), got {len(containers)}"

    described = []
    for c in containers:
        name = c["Name"].lstrip("/")
        for port, bindings in (c["NetworkSettings"]["Ports"] or {}).items():
            if not bindings:
                described.append(f"{name} {port}: exposed, NOT published")
                continue
            for b in bindings:
                host_ip = b.get("HostIp", "")
                described.append(f"{name} {port} -> {host_ip}:{b.get('HostPort')}")
                assert host_ip in ("127.0.0.1", "::1"), (
                    f"{name} publishes {port} on {host_ip or '0.0.0.0 (all interfaces)'} — "
                    "every published port must bind to loopback only."
                )
    print("  port bindings, read from the running containers:\n    " + "\n    ".join(described))


def test_A7_no_container_uses_a_floating_latest_tag():
    """A strict safety rule: "Do not use `latest` container tags."

    Checked on the running containers for the same reason as A6 — compose.yaml could be edited
    without a recreate, and then the file and the fact disagree.
    """
    _require_docker()
    result = wsl(
        "docker inspect " + " ".join(_compose_container_names())
        + " --format '{{.Name}} {{.Config.Image}}'",
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    for line in [l.strip() for l in result.stdout.split("\n") if l.strip()]:
        image = line.split()[-1]
        assert ":" in image, f"{line}: no tag at all, which resolves to latest"
        assert not image.endswith(":latest"), f"{line}: a floating latest tag"
    print("  images: " + " · ".join(l.strip() for l in result.stdout.split("\n") if l.strip()))
