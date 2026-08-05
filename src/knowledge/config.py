"""Connections and LlamaIndex wiring for the knowledge stack.

TWO ROLES, AND THE CHOICE IS THE POINT.

    connect_reader()  -> mk_reader, which has SELECT and nothing else
    connect_writer()  -> mk_app, which the ingestion worker uses

Every retrieval path takes the reader. That is not a convention that can be forgotten at a call
site: mk_reader has no INSERT verb at all, so a bug — or a prompt injection reaching a retrieval
tool — has nothing to reach for. The prompt's "Do not give subagents direct credentials for
PostgreSQL or Neo4j" is satisfied one level up: subagents call the operations in retrieval.py,
which hold the connection; the credentials never leave this process.

NEO4J CANNOT DO THE SAME, and it is stated rather than glossed. Community edition has one
credential and it can write. The read-only guarantee there is enforced in retrieval.py — fixed
query templates, a write-clause guard, timeouts, depth and result limits — which is a weaker
guarantee than PostgreSQL's and should be read as one.

EMBEDDINGS STAY LOCAL. bge-m3 on the machine's own GPU, 1024 dimensions (measured, not read off a
model card). No document text leaves the machine, which is what makes it acceptable to ingest a
private repository at all.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT / "infra" / ".env"

EMBED_MODEL = "bge-m3"
EMBED_DIM = 1024
OLLAMA_URL = "http://127.0.0.1:11434"

# The prompt requires timeouts, depth limits and result limits on graph access. Defaults live here
# so every caller inherits them rather than choosing — a limit each caller picks is not a limit.
GRAPH_TIMEOUT_SECONDS = 15
GRAPH_MAX_DEPTH = 4
GRAPH_MAX_RESULTS = 100
SEARCH_MAX_RESULTS = 50


class ConfigError(RuntimeError):
    """The stack is not configured. Raised with what is missing, never a bare failure."""


@dataclass(frozen=True)
class StackConfig:
    pg_port: str
    pg_db: str
    pg_reader_user: str
    pg_reader_password: str
    pg_writer_user: str
    pg_writer_password: str
    neo4j_port: str
    neo4j_user: str
    neo4j_password: str

    @property
    def neo4j_uri(self) -> str:
        return f"bolt://127.0.0.1:{self.neo4j_port}"


@lru_cache(maxsize=1)
def load_config() -> StackConfig:
    """Read infra/.env. Environment variables win, so CI can supply them without a file.

    Never returns a partially-filled config: a missing credential is reported by name, because
    "connection refused" three layers down is a much more expensive way to learn the same thing.
    """
    from dotenv import dotenv_values

    values: dict[str, Any] = {}
    if ENV_FILE.exists():
        values.update({k: v for k, v in dotenv_values(ENV_FILE).items() if v})
    values.update({k: v for k, v in os.environ.items() if k in _EXPECTED and v})

    missing = [k for k in _EXPECTED if not values.get(k)]
    if missing:
        raise ConfigError(
            "the knowledge stack is not configured — missing: "
            + ", ".join(missing)
            + f". Copy infra/.env.example to {ENV_FILE} and fill it in, or set them in the "
            "environment."
        )
    return StackConfig(
        pg_port=str(values["POSTGRES_PORT"]),
        pg_db=str(values["POSTGRES_DB"]),
        pg_reader_user="mk_reader",
        pg_reader_password=str(values["MK_READER_PASSWORD"]),
        pg_writer_user="mk_app",
        pg_writer_password=str(values["MK_APP_PASSWORD"]),
        neo4j_port=str(values["NEO4J_BOLT_PORT"]),
        neo4j_user=str(values["NEO4J_USER"]),
        neo4j_password=str(values["NEO4J_PASSWORD"]),
    )


_EXPECTED = (
    "POSTGRES_PORT",
    "POSTGRES_DB",
    "MK_READER_PASSWORD",
    "MK_APP_PASSWORD",
    "NEO4J_BOLT_PORT",
    "NEO4J_USER",
    "NEO4J_PASSWORD",
)


def connect_reader(timeout: int = 10):
    """A PostgreSQL connection that CANNOT write. The default for every retrieval path."""
    import psycopg2

    cfg = load_config()
    conn = psycopg2.connect(
        host="127.0.0.1", port=cfg.pg_port, dbname=cfg.pg_db,
        user=cfg.pg_reader_user, password=cfg.pg_reader_password,
        connect_timeout=timeout,
    )
    conn.set_session(readonly=True)   # belt to mk_reader's braces
    return conn


def connect_writer(timeout: int = 10):
    """A PostgreSQL connection that can write DATA. Still cannot change the schema."""
    import psycopg2

    cfg = load_config()
    return psycopg2.connect(
        host="127.0.0.1", port=cfg.pg_port, dbname=cfg.pg_db,
        user=cfg.pg_writer_user, password=cfg.pg_writer_password,
        connect_timeout=timeout,
    )


def neo4j_driver():
    from neo4j import GraphDatabase

    cfg = load_config()
    return GraphDatabase.driver(cfg.neo4j_uri, auth=(cfg.neo4j_user, cfg.neo4j_password))


# --- LlamaIndex ------------------------------------------------------------------------------

def embed_model():
    """The local embedding model. Constructed per call site rather than cached globally, so a
    caller can be handed a different one in a test without mutating process-wide state."""
    from llama_index.embeddings.ollama import OllamaEmbedding

    return OllamaEmbedding(model_name=EMBED_MODEL, base_url=OLLAMA_URL)


# WHY THERE IS NO PGVectorStore HERE, though it is installed and the obvious choice.
#
# PGVectorStore keeps its OWN table. Pointed at this database it tries to create
# `data_chunk_vectors(id, text, metadata_, node_id, embedding vector(1024), text_search_tsv)` —
# verified by running it, which failed with `permission denied for schema public` because mk_app
# has no CREATE. The permission error is incidental; the duplication behind it is not.
#
# Using it would mean every embedding stored TWICE, in two tables, with nothing keeping them in
# step. And the second copy would carry none of what Phase 3 exists for: no FK to a revision, no
# is_current, no graph_projected_at, no source_authority. Retrieval reading that copy could serve
# text from a superseded revision while the authoritative table says otherwise — which is exactly
# the state `current_requires_both_sides` was written to make impossible.
#
# The prompt asks for "embedding storage and retrieval backed by PostgreSQL + pgvector". It does
# not ask for PGVectorStore, and document_chunks.embedding IS a pgvector column with an HNSW
# index. So the vector store is our own table, queried directly in retrieval.semantic_search().
# LlamaIndex remains the orchestration layer for what it is genuinely better at — parsing,
# chunking, embedding — and the Neo4j property-graph integration, which the prompt DOES name, is
# used as given below.
#
# The cost of this choice, stated rather than buried: LlamaIndex's own retriever/query-engine
# classes cannot be pointed at our table, so retrieval is SQL we maintain. That is a smaller
# liability than two divergent copies of the truth.


def graph_store(*, refresh_schema: bool = False):
    """Neo4jPropertyGraphStore. APOC is required and present (see infra/compose.yaml)."""
    from llama_index.graph_stores.neo4j import Neo4jPropertyGraphStore

    cfg = load_config()
    return Neo4jPropertyGraphStore(
        username=cfg.neo4j_user,
        password=cfg.neo4j_password,
        url=cfg.neo4j_uri,
        refresh_schema=refresh_schema,
    )


def configure_settings() -> None:
    """Set LlamaIndex's global Settings for this process.

    The LLM is set to None deliberately. Nothing in this stack needs one: chunking is structural
    (MarkdownNodeParser / CodeSplitter), embeddings are local, and graph extraction is
    deterministic by default. Leaving the default in place would make a stray call reach for
    OpenAI and fail with an API-key error that explains nothing about what actually went wrong.
    """
    from llama_index.core import Settings

    Settings.embed_model = embed_model()
    Settings.llm = None
