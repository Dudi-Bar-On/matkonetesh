# LlamaIndex — DocumentStore / KVStore / retrievers without embeddings (0.14.23)

- **Source (authoritative):** the installed package, `llama_index/core/storage/` and
  `llama_index/core/retrievers/`, `llama_index/core/indices/keyword_table/`
  — `llama-index-core 0.14.23`
- **Source (docs site):** https://developers.llamaindex.ai/python/framework/module_guides/storing/docstores/
- **Retrieved:** 2026-08-04

All code is `VERBATIM (installed source)`.

---

## `SimpleDocumentStore` — a JSON file, in memory

`llama_index/core/storage/docstore/simple_docstore.py`:

```python
class SimpleDocumentStore(KVDocumentStore):
    """
    Simple Document (Node) store.

    An in-memory store for Document and Node objects.

    Args:
        simple_kvstore (SimpleKVStore): simple key-value store
        namespace (str): namespace for the docstore

    """

    def __init__(
        self,
        simple_kvstore: Optional[SimpleKVStore] = None,
        namespace: Optional[str] = None,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> None:
        """Init a SimpleDocumentStore."""
        simple_kvstore = simple_kvstore or SimpleKVStore()
        super().__init__(simple_kvstore, namespace=namespace, batch_size=batch_size)
```

```python
    @classmethod
    def from_persist_dir(
        cls,
        persist_dir: str = DEFAULT_PERSIST_DIR,
        namespace: Optional[str] = None,
        fs: Optional[fsspec.AbstractFileSystem] = None,
    ) -> "SimpleDocumentStore":
        """
        Create a SimpleDocumentStore from a persist directory.

        Args:
            persist_dir (str): directory to persist the store
            namespace (Optional[str]): namespace for the docstore
            fs (Optional[fsspec.AbstractFileSystem]): filesystem to use

        """
        if fs is not None:
            persist_path = concat_dirs(persist_dir, DEFAULT_PERSIST_FNAME)
        else:
            persist_path = os.path.join(persist_dir, DEFAULT_PERSIST_FNAME)
        return cls.from_persist_path(persist_path, namespace=namespace, fs=fs)
```

**Read the docstring literally: "An in-memory store".** `SimpleKVStore` holds a Python dict and persists it
by serialising the *whole* dict to a single JSON file (`DEFAULT_PERSIST_FNAME`, `docstore.json`). There is no
partial write and no query language — every read loads everything, every write rewrites everything.

This is the same artifact shape (one large JSON blob, rewritten wholesale, no incremental query) that this
project deliberately moved away from when it retired the 22 MB `graphify-out/graph.json`.

## SQL-backed docstores

There is **no SQL/SQLite document store in `llama-index-core`**. The SQL-backed docstores are separate
integration packages, none of which are installed here:

- `llama-index-storage-docstore-postgres` (`PostgresDocumentStore`)
- `llama-index-storage-docstore-mongodb`, `-redis`, `-firestore`, `-dynamodb`, `-couchbase`, `-elasticsearch`

`DuckDBVectorStore` (`llama-index-vector-stores-duckdb`) is a **vector** store, not a document store — its
purpose is embedding similarity search, so it is out of scope under a no-embeddings constraint.

The abstract contract a custom store would have to satisfy is `BaseDocumentStore` in
`llama_index/core/storage/docstore/types.py` — it includes `docs`, `add_documents`, `get_document`,
`delete_document`, `document_exists`, `get_document_hash`, `set_document_hash`, `set_document_hashes`,
`get_all_document_hashes`, `get_nodes`, `get_node`, `get_node_dict`, `delete_ref_doc`,
`get_ref_doc_info`, `get_all_ref_doc_info`, plus `async` variants of nearly all of them.

---

## Retrievers in core — what exists, and the stale export

`llama_index/core/retrievers/__init__.py`, verbatim:

```python
__all__ = [
    "VectorIndexRetriever",
    "VectorIndexAutoRetriever",
    "SummaryIndexRetriever",
    "SummaryIndexEmbeddingRetriever",
    "SummaryIndexLLMRetriever",
    "KGTableRetriever",
    "KnowledgeGraphRAGRetriever",
    "EmptyIndexRetriever",
    "TreeAllLeafRetriever",
    "TreeSelectLeafEmbeddingRetriever",
    "TreeSelectLeafRetriever",
    "TreeRootRetriever",
    "TransformRetriever",
    "KeywordTableSimpleRetriever",
    "BaseRetriever",
    "RecursiveRetriever",
    "AutoMergingRetriever",
    "RouterRetriever",
    "BM25Retriever",
    "QueryFusionRetriever",
    # property graph
    "BasePGRetriever",
    "PGRetriever",
    "CustomPGRetriever",
    "LLMSynonymRetriever",
    "CypherTemplateRetriever",
    "TextToCypherRetriever",
    "VectorContextRetriever",
    # SQL
    "SQLRetriever",
    "NLSQLRetriever",
    "SQLParserMode",
    # legacy
    "ListIndexEmbeddingRetriever",
    "ListIndexRetriever",
    # image
    "BaseImageRetriever",
]
```

> ⚠️ **`"BM25Retriever"` is listed in `__all__` but is never imported anywhere in that module**, and the file
> defines no `__getattr__`. `from llama_index.core.retrievers import BM25Retriever` therefore raises
> `ImportError` in 0.14.23 — this is a stale export entry, not a hidden built-in. BM25 only ever comes from
> the separate `llama-index-retrievers-bm25` package. Verified by reading the whole 88-line file.

### Classification under the no-model constraint

| Retriever | Needs |
|---|---|
| `VectorIndexRetriever`, `VectorIndexAutoRetriever`, `SummaryIndexEmbeddingRetriever`, `TreeSelectLeafEmbeddingRetriever`, `ListIndexEmbeddingRetriever`, `VectorContextRetriever` | **embeddings** |
| `SummaryIndexLLMRetriever`, `TreeSelectLeafRetriever`, `KGTableRetriever`, `KnowledgeGraphRAGRetriever`, `LLMSynonymRetriever`, `TextToCypherRetriever`, `NLSQLRetriever`, `RouterRetriever` | **an LLM** |
| `KeywordTableSimpleRetriever`, `SummaryIndexRetriever`, `TreeAllLeafRetriever`, `TreeRootRetriever`, `EmptyIndexRetriever`, `SQLRetriever`, `RecursiveRetriever`, `AutoMergingRetriever` | neither (see the caveat below) |
| `QueryFusionRetriever` | LLM **only** if `num_queries > 1` (query generation); its fusion modes are arithmetic |

---

## `SimpleKeywordTableIndex` — regex keyword search, no model

`llama_index/core/indices/keyword_table/simple_base.py`:

```python
"""
Simple keyword-table based index.

Similar to KeywordTableIndex, but uses a simpler keyword extraction
technique that doesn't involve GPT - just uses regex.

"""
```

```python
class SimpleKeywordTableIndex(BaseKeywordTableIndex):
    """
    Simple Keyword Table Index.

    This index uses a simple regex extractor to extract keywords from the text.

    """

    def _extract_keywords(self, text: str) -> Set[str]:
        """Extract keywords from text."""
        return simple_extract_keywords(text, self.max_keywords_per_chunk)

    def as_retriever(
        self,
        retriever_mode: Union[
            str, KeywordTableRetrieverMode
        ] = KeywordTableRetrieverMode.SIMPLE,
        **kwargs: Any,
    ) -> BaseRetriever:
        return super().as_retriever(retriever_mode=retriever_mode, **kwargs)
```

The extractor, `llama_index/core/indices/keyword_table/utils.py`:

```python
def simple_extract_keywords(
    text_chunk: str, max_keywords: Optional[int] = None, filter_stopwords: bool = True
) -> Set[str]:
    """Extract keywords with simple algorithm."""
    tokens = [t.strip().lower() for t in re.findall(r"\w+", text_chunk)]
    if filter_stopwords:
        tokens = [t for t in tokens if t not in globals_helper.stopwords]

    token_counts = Counter(tokens)
    keywords = [keyword for keyword, count in token_counts.most_common(max_keywords)]
    return set(keywords)
```

> ⚠️ **The catch.** `BaseKeywordTableIndex.__init__` contains, verbatim:
>
> ```python
>         self._llm = llm or Settings.llm
> ```
>
> Because `llama-index-llms-openai` is not installed here, **constructing `SimpleKeywordTableIndex()` without
> an explicit `llm=` raises `ImportError` from `resolve_llm("default")`** — even though the SIMPLE retriever
> mode never calls the LLM. Passing `llm=MockLLM()` (or setting `IS_TESTING`) is required. See
> `offline-and-no-model.md`.

Also note this index is a **keyword→node-id map with no ranking**: `simple_extract_keywords` keeps the
`max_keywords_per_chunk` (default 10) most frequent tokens per chunk, and the stopword list is
`stopwords.words("english")` — hard-coded English. `re.findall(r"\w+", ...)` is Unicode-aware in Python 3,
so Hebrew tokens are matched, but no Hebrew stopwords are removed and no term-frequency/document-length
weighting is applied. It is strictly weaker than BM25.
