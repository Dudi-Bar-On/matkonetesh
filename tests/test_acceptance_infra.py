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
with its data intact — is unchanged by the move.

UPDATED 2026-08-07 (docker-exit Tasks 7/8): A6 and A7 no longer read the Docker daemon. There is
nothing left running in Docker that they were checking (Neo4j moved native in Task 6), so
`_require_docker`/`wsl`/`_compose_container_names` were deleted rather than kept as dead code —
Chesterton's Fence does not apply to code whose entire reason for existing (a Docker daemon to
ask) is gone. A6 now reads `Get-NetTCPConnection`, the OS's own live socket table. A7 now compares
the installed binary's own version against a string committed to `docs/infra/dependency-summary.md`
(no image tag exists for a native service, so "no floating latest" has no analogue — the concern
it protected, a version that changed without a diff to review, does not go away).
"""

from __future__ import annotations

import json
import os
import re
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


def _declared_ports() -> dict[str, int]:
    """Every port this project declares, read from its own env files — never hardcoded.

    A6 used to name `mk-postgres mk-neo4j` literally, and the day that inventory changed (R-108)
    the test broke on the wrong thing. Deriving the port list from what the project itself
    declares means a NEW service is covered the moment its port is added to one of these files —
    which is the direction that matters, since an unchecked new listener is exactly what A6 exists
    to catch. An empty result is a declared-nothing state, never silently treated as "all clear" —
    the caller skips or fails on it, it never passes.
    """
    from dotenv import dotenv_values

    ports: dict[str, int] = {}
    for env_path in (ROOT / "infra" / ".env", ROOT / "infra" / "rules-db" / ".env"):
        if not env_path.exists():
            continue
        for key, value in (dotenv_values(env_path) or {}).items():
            if key.endswith("_PORT") and value:
                try:
                    ports[f"{env_path.relative_to(ROOT).as_posix()}:{key}"] = int(value)
                except ValueError:
                    continue
    return ports


def _listening_sockets() -> list[dict]:
    """The OS's own live socket table — the daemon states a fact, the config file states an
    intention, and only one of them is what an attacker meets (this test's design principle,
    unchanged from when it read `docker inspect`)."""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command",
         "Get-NetTCPConnection -State Listen | Select-Object LocalPort,LocalAddress "
         "| ConvertTo-Json -Compress"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
    if not result.stdout.strip():
        return []
    data = json.loads(result.stdout)
    return [data] if isinstance(data, dict) else data


def test_A6_services_are_not_exposed_beyond_loopback():
    """A: "Services are not publicly exposed by default."

    REWRITTEN 2026-08-07 (docker-exit Tasks 7/8): PostgreSQL and Neo4j are native Windows
    services now, not containers — there is no `docker inspect` to read. A Windows service binds
    a TCP port exactly as a container publishes one, so the risk is identical; only the tool
    changes. `Get-NetTCPConnection -State Listen` is the native analogue of `docker inspect`'s
    `HostIp`: both read the live socket rather than a config file's stated intention. IPv6 `::`
    (and IPv4 `0.0.0.0`) are the all-interfaces wildcard, not loopback — only `127.0.0.1`/`::1`
    pass.
    """
    ports = _declared_ports()
    if not ports:
        pytest.skip("no ports are declared in infra/.env or infra/rules-db/.env — nothing to inspect")

    by_port: dict[int, list[str]] = {}
    for entry in _listening_sockets():
        by_port.setdefault(entry["LocalPort"], []).append(entry["LocalAddress"])

    checked = []
    bad = []
    for label, port in ports.items():
        addrs = by_port.get(port)
        if not addrs:
            continue  # declared but nothing is currently listening on it — not this test's concern
        for addr in addrs:
            checked.append(f"{label} (port {port}): {addr}")
            if addr not in ("127.0.0.1", "::1"):
                bad.append(f"{label} listens on port {port} at {addr or '(empty)'}")

    if not checked:
        pytest.skip("none of the declared ports are currently listening — nothing to inspect")

    print("  listening sockets, read from the OS:\n    " + "\n    ".join(checked))
    assert not bad, "beyond-loopback binding(s): " + "; ".join(bad)


def _dependency_summary_versions() -> dict[str, str]:
    """The versions committed to docs/infra/dependency-summary.md's native-service table — the
    diff-reviewed baseline A7 compares the installed binary against. Same role that file already
    plays for every other pinned version in this project."""
    text = (ROOT / "docs" / "infra" / "dependency-summary.md").read_text(encoding="utf-8")
    versions: dict[str, str] = {}
    for name, pattern in (
        ("postgresql", r"\|\s*PostgreSQL\s*\(native\)\s*\|\s*`([^`]+)`"),
        ("neo4j", r"\|\s*Neo4j\s*\(native\)\s*\|\s*`([^`]+)`"),
    ):
        m = re.search(pattern, text)
        assert m, f"docs/infra/dependency-summary.md has no recorded native version for {name}"
        versions[name] = m.group(1)
    return versions


def _postgres_installed_version() -> str:
    """Read from the binary (`psql --version`), not from a config file. `psql.exe` lives next to
    the service's own `pg_ctl.exe`, located from the service's PathName rather than a hardcoded
    install path, so this survives a PostgreSQL minor-version upgrade that changes the folder."""
    svc = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command",
         "(Get-CimInstance Win32_Service -Filter \"Name='postgresql-x64-18'\").PathName"],
        capture_output=True, text=True, timeout=15,
    )
    assert svc.returncode == 0, svc.stderr
    m = re.search(r'"([^"]+\\bin\\pg_ctl\.exe)"', svc.stdout)
    assert m, f"could not locate pg_ctl.exe from the service's own PathName: {svc.stdout!r}"
    psql = str(Path(m.group(1)).parent / "psql.exe")

    out = subprocess.run([psql, "--version"], capture_output=True, text=True, timeout=15)
    assert out.returncode == 0, out.stderr
    vm = re.search(r"(\d+\.\d+)", out.stdout)
    assert vm, f"could not parse psql --version output: {out.stdout!r}"
    return vm.group(1)


def _neo4j_installed_version() -> str:
    """Read from the binary (`neo4j-admin --version`), not from a config file.

    NOT `neo4j.ps1`/`neo4j.bat version` — that subcommand writes through PowerShell's `Write-Host`,
    which never reaches a captured pipeline: a caller that does `subprocess.run([...]).stdout` gets
    an empty string while the version prints only to the interactive console. This produced a false
    failure here (L66, fourth occurrence in this repo). `neo4j-admin --version` writes to stdout.
    """
    home = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command",
         "[Environment]::GetEnvironmentVariable('NEO4J_HOME','Machine')"],
        capture_output=True, text=True, timeout=15,
    )
    assert home.returncode == 0, home.stderr
    neo4j_home = home.stdout.strip()
    assert neo4j_home, "NEO4J_HOME is not set at machine scope"
    admin = Path(neo4j_home) / "bin" / "neo4j-admin.bat"

    out = subprocess.run([str(admin), "--version"], capture_output=True, text=True, timeout=20)
    assert out.returncode == 0, out.stderr
    version = out.stdout.strip()
    assert version, "neo4j-admin --version produced no stdout"
    return version


@pytest.mark.skipif(
    sys.platform != "win32",
    reason=(
        "Windows-specific by construction, not by convenience: PostgreSQL and Neo4j here are "
        "native WINDOWS SERVICES (2026-08-07 docker-exit), and both helpers this test calls read "
        "Windows-only state that has no Linux equivalent to probe instead — "
        "Get-CimInstance Win32_Service (a Windows service object) and a machine-scope environment "
        "variable set via [Environment]::GetEnvironmentVariable(...,'Machine') (Windows-only scope; "
        "POSIX has no machine/user/process split). CI's Linux runner has neither service installed "
        "as a Windows service in the first place, so there is nothing here for it to check — this "
        "is not a check being skipped for convenience, it is a Windows-native-service check with no "
        "target on Linux."
    ),
)
def test_A7_installed_version_matches_the_recorded_pin():
    """A strict safety rule: "Do not use `latest` container tags" — carried to its native form.

    REWRITTEN 2026-08-07 (docker-exit Tasks 7/8): a native Windows service has no image tag, so
    "no floating latest" has no literal analogue — but the concern it protected (a version that
    changed without a diff to review) survives the move. The native form: compare the INSTALLED
    binary's own version against a version string committed to
    docs/infra/dependency-summary.md, the same role that file already plays for every other
    pinned dependency here. Covers both PostgreSQL and Neo4j — same concern, same check.

    UPDATED 2026-08-10 (CI-red fix): this shells out to `powershell` unconditionally via
    `_postgres_installed_version`/`_neo4j_installed_version`, unlike every other test in this file
    that talks to the stack (`_require_stack` skips cleanly when it is unreachable). On the
    `discipline` job's Linux runner, `powershell` does not exist as a binary at all — not "not on
    PATH", the executable itself has no Linux build — so the shell-out raised `FileNotFoundError`
    before any of this test's own logic ran, which is a crash, not a skip. Skipped explicitly by
    platform instead, with the reason above stating what is actually Windows-specific.
    """
    recorded = _dependency_summary_versions()
    installed = {
        "postgresql": _postgres_installed_version(),
        "neo4j": _neo4j_installed_version(),
    }
    mismatches = [
        f"{name}: installed {installed[name]!r} != recorded {recorded[name]!r} "
        "in docs/infra/dependency-summary.md"
        for name in recorded
        if installed[name] != recorded[name]
    ]
    print("  installed vs recorded:\n    " + "\n    ".join(
        f"{name}: installed={installed[name]!r} recorded={recorded[name]!r}" for name in recorded
    ))
    assert not mismatches, "; ".join(mismatches)
