"""Rebuild the geniza's HNSW vector index. The recovery half of scripts/check-hnsw-health.py.

Run by scripts/watchman.ps1 only when the health probe reports RESULT=fail, and safe to run by hand.

WHY IT NEEDS THE OWNER ROLE. `mk_app` (the writer) can INSERT and UPDATE, but REINDEX requires
ownership of the index, and the index belongs to `mk_admin` -- measured, not assumed:

    SELECT tableowner FROM pg_tables WHERE tablename='data_chunk_vectors'  ->  mk_admin
    REINDEX as mk_app  ->  permission denied for index data_chunk_vectors_embedding_idx

So this one script reads the owner credential from infra/.env. It is the ONLY thing it does with it,
it never prints it, and no agent-facing retrieval path goes near this file. Per the standing rule,
secrets stay out of the repository and out of every report.

CONCURRENTLY is deliberate: it takes no exclusive lock, so an extraction run or a live query is not
blocked while the index rebuilds. The measured rebuild of 17,126 vectors at 1024 dimensions took 2.7
seconds -- fast enough that the watchman can own this recovery without stalling a session start.

It re-verifies by re-running the health probe rather than trusting its own exit code, because a
REINDEX that returns 0 while producing another unusable index is exactly the failure being repaired.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Both vector indexes, because check-hnsw-health.py watches both and a report naming one does not
# tell you the other is fine. REINDEX on a healthy index is a no-op worth the seconds it costs.
INDEXES = [
    "public.document_chunks_embedding_idx",      # what retrieval.semantic_search reads
    "public.data_chunk_vectors_embedding_idx",   # the LlamaIndex projection
]


def _emit(result: str, detail: str) -> int:
    print(detail)
    print(f"RESULT={result}")
    return 0 if result == "ok" else 1


def _owner_credentials() -> tuple[str, str] | None:
    env_file = ROOT / "infra" / ".env"
    if not env_file.exists():
        return None
    values: dict[str, str] = {}
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    user = values.get("POSTGRES_SUPERUSER")
    password = values.get("POSTGRES_SUPERUSER_PASSWORD") or values.get("POSTGRES_SUPERPASSWORD")
    if not user or not password:
        return None
    return user, password


def main() -> int:
    try:
        import psycopg2

        from src.knowledge import config
    except Exception as exc:
        return _emit("skip", f"cannot import what the repair needs ({type(exc).__name__}: {exc})")

    credentials = _owner_credentials()
    if credentials is None:
        return _emit(
            "skip",
            "infra/.env does not carry the index owner's credentials, so REINDEX cannot be attempted "
            "here. Repair by hand as the owner role: REINDEX INDEX CONCURRENTLY <index>, for "
            + ", ".join(INDEXES),
        )
    user, password = credentials

    try:
        cfg = config.load_config()
        conn = psycopg2.connect(
            host="127.0.0.1", port=cfg.pg_port, dbname=cfg.pg_db, user=user, password=password
        )
        conn.autocommit = True  # REINDEX CONCURRENTLY cannot run inside a transaction block
        started = time.time()
        with conn.cursor() as cur:
            for index in INDEXES:
                cur.execute(f"REINDEX INDEX CONCURRENTLY {index}")
        elapsed = time.time() - started
        conn.close()
    except Exception as exc:
        return _emit("fail", f"REINDEX failed ({type(exc).__name__}: {exc})")

    probe = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check-hnsw-health.py")],
        capture_output=True, text=True, timeout=120,
    )
    healthy = probe.returncode == 0 and "RESULT=ok" in (probe.stdout or "")
    if not healthy:
        return _emit(
            "fail",
            f"REINDEX of {len(INDEXES)} index(es) completed in {elapsed:.1f}s but a vector index still "
            "does not answer correctly. "
            "This is past what a rebuild can fix - the vectors themselves may need re-ingesting.",
        )
    return _emit("ok", f"{len(INDEXES)} index(es) rebuilt in {elapsed:.1f}s and verified answering correctly afterwards.")


if __name__ == "__main__":
    raise SystemExit(main())
