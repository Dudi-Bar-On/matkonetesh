# LlamaIndex — BM25Retriever

- **Source (package source, verbatim):**
  https://raw.githubusercontent.com/run-llama/llama_index/main/llama-index-integrations/retrievers/llama-index-retrievers-bm25/llama_index/retrievers/bm25/base.py
  (`main` branch)
- **Source (release metadata):** https://pypi.org/pypi/llama-index-retrievers-bm25/json
- **Source (docs site):** https://developers.llamaindex.ai/python/examples/retrievers/bm25_retriever/
  (redirected from `https://docs.llamaindex.ai/en/stable/examples/retrievers/bm25_retriever/`)
- **Retrieved:** 2026-08-04

> **NOT INSTALLED in this project.** Everything here is read from upstream source, not from a local
> `site-packages`. It has therefore **not** been executed or verified at runtime here. The code block below
> is the real upstream file; the `main` branch may be marginally ahead of the released 0.7.1.

---

## Release metadata (PyPI, 2026-08-04)

```
Latest version : 0.7.1
Released       : March 13, 2026
requires_python: "<4.0,>=3.10"
requires_dist  :
  "bm25s>=0.2.7.post1"
  "llama-index-core<0.15,>=0.13.1"
  "pystemmer<3,>=2.2.0.1"
```

`llama-index-core<0.15,>=0.13.1` is satisfied by our **0.14.23**.

`docs site`: installation line is

```
%pip install llama-index-retrievers-bm25
```

---

## The upstream source, verbatim

```python
import json
import logging
import os

from typing import Any, Callable, Dict, List, Optional, cast

from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.callbacks.base import CallbackManager
from llama_index.core.constants import DEFAULT_SIMILARITY_TOP_K
from llama_index.core.indices.vector_store.base import VectorStoreIndex
from llama_index.core.schema import (
    BaseNode,
    IndexNode,
    NodeWithScore,
    QueryBundle,
    MetadataMode,
)
from llama_index.core.storage.docstore.types import BaseDocumentStore
from llama_index.core.vector_stores.types import MetadataFilters
from llama_index.core.vector_stores.utils import (
    node_to_metadata_dict,
    metadata_dict_to_node,
    build_metadata_filter_fn,
)

import bm25s
import Stemmer
import numpy as np

logger = logging.getLogger(__name__)

DEFAULT_PERSIST_ARGS = {
    "similarity_top_k": "similarity_top_k",
    "_verbose": "verbose",
    "corpus_weight_mask": "corpus_weight_mask",
}

DEFAULT_PERSIST_FILENAME = "retriever.json"


class BM25Retriever(BaseRetriever):
    r"""
    A BM25 retriever that uses the BM25 algorithm to retrieve nodes.

    Args:
        nodes (List[BaseNode], optional):
            The nodes to index. If not provided, an existing BM25 object must be passed.
        stemmer (Stemmer.Stemmer, optional):
            The stemmer to use. Defaults to an english stemmer.
        language (str, optional):
            The language to use for stopword removal. Defaults to "en".
        existing_bm25 (bm25s.BM25, optional):
            An existing BM25 object to use. If not provided, nodes must be passed.
        similarity_top_k (int, optional):
            The number of results to return. Defaults to DEFAULT_SIMILARITY_TOP_K.
        callback_manager (CallbackManager, optional):
            The callback manager to use. Defaults to None.
        objects (List[IndexNode], optional):
            The objects to retrieve. Defaults to None.
        object_map (dict, optional):
            A map of object IDs to nodes. Defaults to None.
        token_pattern (str, optional):
            The token pattern to use. Defaults to (?u)\\b\\w\\w+\\b.
        skip_stemming (bool, optional):
            Whether to skip stemming. Defaults to False.
        verbose (bool, optional):
            Whether to show progress. Defaults to False.

    """

    def __init__(
        self,
        nodes: Optional[List[BaseNode]] = None,
        stemmer: Optional[Stemmer.Stemmer] = None,
        language: str = "en",
        existing_bm25: Optional[bm25s.BM25] = None,
        similarity_top_k: int = DEFAULT_SIMILARITY_TOP_K,
        callback_manager: Optional[CallbackManager] = None,
        objects: Optional[List[IndexNode]] = None,
        object_map: Optional[dict] = None,
        verbose: bool = False,
        skip_stemming: bool = False,
        token_pattern: str = r"(?u)\b\w\w+\b",
        filters: Optional[MetadataFilters] = None,
        corpus_weight_mask: Optional[List[int]] = None,
    ) -> None:
        self.stemmer = stemmer or Stemmer.Stemmer("english")
        self.similarity_top_k = similarity_top_k
        self.token_pattern = token_pattern
        self.skip_stemming = skip_stemming

        if existing_bm25 is not None:
            self.bm25 = existing_bm25
            self.corpus = existing_bm25.corpus
        else:
            if nodes is None:
                raise ValueError("Please pass nodes or an existing BM25 object.")

            self.corpus = [
                node_to_metadata_dict(node) | {"node_id": node.node_id}
                for node in nodes
            ]

            corpus_tokens = bm25s.tokenize(
                [node.get_content(metadata_mode=MetadataMode.EMBED) for node in nodes],
                stopwords=language,
                stemmer=self.stemmer if not skip_stemming else None,
                token_pattern=self.token_pattern,
                show_progress=verbose,
            )
            self.bm25 = bm25s.BM25()
            self.bm25.index(corpus_tokens, show_progress=verbose)

        if (
            self.bm25.scores.get("num_docs")
            and int(self.bm25.scores["num_docs"]) < self.similarity_top_k
        ):
            if int(self.bm25.scores["num_docs"]) == 0:
                raise ValueError(
                    "No nodes added to the retriever kindly add more data."
                )

            logger.warning(
                "As bm25s.BM25 requires k less than or equal to number of nodes added. Overriding the value of similarity_top_k to number of nodes added."
            )
            self.similarity_top_k = int(self.bm25.scores["num_docs"])

        self.corpus_weight_mask = corpus_weight_mask or None
        if filters and self.corpus:
            # Build a weight mask for each corpus to filter out only relevant nodes
            _corpus_dict = {
                corpus_token["node_id"]: corpus_token for corpus_token in self.corpus
            }
            _query_filter_fn = build_metadata_filter_fn(
                lambda node_id: _corpus_dict[node_id], filters
            )
            self.corpus_weight_mask = [
                int(_query_filter_fn(corpus_token["node_id"]))
                for corpus_token in self.corpus
            ]

            # Check if all nodes were filtered out
            if not any(self.corpus_weight_mask):
                raise ValueError(
                    "All nodes were filtered out by the metadata filters. "
                    "Please adjust your filters or add more data."
                )

        super().__init__(
            callback_manager=callback_manager,
            object_map=object_map,
            objects=objects,
            verbose=verbose,
        )

    @classmethod
    def from_defaults(
        cls,
        index: Optional[VectorStoreIndex] = None,
        nodes: Optional[List[BaseNode]] = None,
        docstore: Optional[BaseDocumentStore] = None,
        stemmer: Optional[Stemmer.Stemmer] = None,
        language: str = "en",
        similarity_top_k: int = DEFAULT_SIMILARITY_TOP_K,
        verbose: bool = False,
        skip_stemming: bool = False,
        token_pattern: str = r"(?u)\b\w\w+\b",
        filters: Optional[MetadataFilters] = None,
        # deprecated
        tokenizer: Optional[Callable[[str], List[str]]] = None,
    ) -> "BM25Retriever":
        if tokenizer is not None:
            logger.warning(
                "The tokenizer parameter is deprecated and will be removed in a future release. "
                "Use a stemmer from PyStemmer instead."
            )

        # ensure only one of index, nodes, or docstore is passed
        if sum(bool(val) for val in [index, nodes, docstore]) != 1:
            raise ValueError("Please pass exactly one of index, nodes, or docstore.")

        if index is not None:
            docstore = index.docstore

        if docstore is not None:
            nodes = cast(List[BaseNode], list(docstore.docs.values()))

        assert nodes is not None, (
            "Please pass exactly one of index, nodes, or docstore."
        )

        return cls(
            nodes=nodes,
            stemmer=stemmer,
            language=language,
            similarity_top_k=similarity_top_k,
            verbose=verbose,
            skip_stemming=skip_stemming,
            token_pattern=token_pattern,
            filters=filters,
        )

    def get_persist_args(self) -> Dict[str, Any]:
        """Get Persist Args Dict to Save."""
        return {
            DEFAULT_PERSIST_ARGS[key]: getattr(self, key)
            for key in DEFAULT_PERSIST_ARGS
            if hasattr(self, key)
        }

    def persist(self, path: str, encoding: str = "utf-8", **kwargs: Any) -> None:
        """Persist the retriever to a directory."""
        self.bm25.save(path, corpus=self.corpus, **kwargs)
        with open(
            os.path.join(path, DEFAULT_PERSIST_FILENAME), "w", encoding=encoding
        ) as f:
            json.dump(self.get_persist_args(), f, indent=2)

    @classmethod
    def from_persist_dir(
        cls, path: str, encoding: str = "utf-8", **kwargs: Any
    ) -> "BM25Retriever":
        """Load the retriever from a directory."""
        bm25 = bm25s.BM25.load(path, load_corpus=True, **kwargs)
        with open(os.path.join(path, DEFAULT_PERSIST_FILENAME), encoding=encoding) as f:
            retriever_data = json.load(f)
        return cls(existing_bm25=bm25, **retriever_data)

    def _retrieve(self, query_bundle: QueryBundle) -> List[NodeWithScore]:
        query = query_bundle.query_str
        tokenized_query = bm25s.tokenize(
            query,
            stemmer=self.stemmer if not self.skip_stemming else None,
            token_pattern=self.token_pattern,
            show_progress=self._verbose,
        )
        indexes, scores = self.bm25.retrieve(
            tokenized_query,
            k=self.similarity_top_k,
            show_progress=self._verbose,
            weight_mask=np.array(self.corpus_weight_mask)
            if self.corpus_weight_mask
            else None,
        )

        # batched, but only one query
        indexes = indexes[0]
        scores = scores[0]

        nodes: List[NodeWithScore] = []
        for idx, score in zip(indexes, scores):
            # idx can be an int or a dict of the node
            if isinstance(idx, dict):
                node = metadata_dict_to_node(idx)
            else:
                node_dict = self.corpus[int(idx)]
                node = metadata_dict_to_node(node_dict)
            nodes.append(NodeWithScore(node=node, score=float(score)))

        return nodes
```

---

## Reading the contract — points that decide adoption

**No LLM. No embeddings.** The imports are `bm25s`, `Stemmer`, `numpy`. Nothing in this file touches
`Settings.llm` or a `BaseEmbedding`. It is a pure lexical ranker.

**Source of documents — exactly one of three.**
`if sum(bool(val) for val in [index, nodes, docstore]) != 1: raise ValueError("Please pass exactly one of index, nodes, or docstore.")`
For this project the usable one is **`nodes=[...]`** — a plain list of `TextNode`, which is exactly what
`AgentMemory.get_nodes()` already returns.

**It builds an in-memory index at construction.** `bm25s.BM25()` + `.index(corpus_tokens)` run inside
`__init__`. There is no incremental "add one node" API here — adding a document means reconstructing the
retriever. `persist()` / `from_persist_dir()` exist to avoid paying that cost every process start.

**Hebrew — the tokenizer is fine, the stemmer is not.**
`token_pattern: str = r"(?u)\b\w\w+\b"`. The `(?u)` flag makes `\w` Unicode-aware, so Hebrew letters match.
The pattern requires **two or more** word characters, so single-letter Hebrew words (ו, ב, ל, ה, ש, מ, כ)
are dropped — in practice those are clitics/stopwords, so this is acceptable.
The problems are the two defaults around it:
- `self.stemmer = stemmer or Stemmer.Stemmer("english")` — an **English Snowball stemmer applied to Hebrew
  text**. PyStemmer/Snowball has no Hebrew algorithm. Use `skip_stemming=True`.
- `stopwords=language` with `language: str = "en"` — English stopword removal, which removes nothing from
  Hebrew and (worse) *does* strip English tokens out of our mixed Hebrew/English documents, where the
  English words are often the identifiers we search for (`equipPlan`, `bcheck`, `MarkdownNodeParser`).
  `bm25s.tokenize`'s `stopwords` parameter is passed straight through; whether it accepts a custom list or
  `None` here is **not verified** — it must be tested at runtime before being relied on.

**A real persistence trap.** `DEFAULT_PERSIST_ARGS` only round-trips `similarity_top_k`, `verbose` and
`corpus_weight_mask`. **`stemmer`, `skip_stemming`, `language` and `token_pattern` are NOT persisted.**
So a retriever indexed with `skip_stemming=True` and reloaded via `from_persist_dir()` comes back with
`skip_stemming=False` and an English stemmer — query-time tokenization silently stops matching index-time
tokenization. If `persist()` is used, these must be re-applied by hand after loading.

**Metadata filtering works without any vector store.** `filters: Optional[MetadataFilters]` is turned into a
`corpus_weight_mask` via `build_metadata_filter_fn`, which **is present in our installed core 0.14.23**
(`llama_index/core/vector_stores/utils.py`, verified 2026-08-04). Note it is applied at **construction**,
not per query — a different filter means a different retriever object.

**`similarity_top_k` is silently clamped** to the corpus size, with a `logger.warning`. An empty corpus
raises `ValueError("No nodes added to the retriever kindly add more data.")`.

**Install risk (not verified):** `pystemmer<3,>=2.2.0.1` is a C extension. A prebuilt wheel for
**CPython 3.14 on Windows** may or may not exist; without one, installation needs a C toolchain. This must
be checked before committing to BM25.

---

## Docs-site notes

`docs site (paraphrased — not an API contract)`:

> "BM25 (Best Matching 25) is a ranking function that extends TF-IDF by considering term frequency saturation
> and document length."

The example page covers: initialisation from nodes with `persist()` / `from_persist_dir()`; initialisation
from a docstore (SimpleDocumentStore, MongoDB, Redis, Postgres); metadata filtering with `MetadataFilters`;
and hybrid search combining BM25 with Chroma through `QueryFusionRetriever`.
