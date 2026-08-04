# LlamaIndex — IngestionPipeline, docstore strategies, cache (0.14.23)

- **Source (authoritative):** the installed package,
  `C:\Users\dudib\AppData\Local\Programs\Python\Python314\Lib\site-packages\llama_index\core\ingestion\pipeline.py`
  — `llama-index-core 0.14.23`
- **Source (docs site):** https://developers.llamaindex.ai/python/framework/module_guides/loading/ingestion_pipeline/
- **Retrieved:** 2026-08-04

All code below is `VERBATIM (installed source)`.

---

## De-duplication strategies

```python
class DocstoreStrategy(str, Enum):
    """
    Document de-duplication de-deduplication strategies work by comparing the hashes or ids stored in the document store.
       They require a document store to be set which must be persisted across pipeline runs.

    Attributes:
        UPSERTS:
            ('upserts') Use upserts to handle duplicates. Checks if the a document is already in the doc store based on its id. If it is not, or if the hash of the document is updated, it will update the document in the doc store and run the transformations.
        DUPLICATES_ONLY:
            ('duplicates_only') Only handle duplicates. Checks if the hash of a document is already in the doc store. Only then it will add the document to the doc store and run the transformations
        UPSERTS_AND_DELETE:
            ('upserts_and_delete') Use upserts and delete to handle duplicates. Like the upsert strategy but it will also delete non-existing documents from the doc store

    """

    UPSERTS = "upserts"
    DUPLICATES_ONLY = "duplicates_only"
    UPSERTS_AND_DELETE = "upserts_and_delete"
```

Note the sentence in the docstring: **"They require a document store to be set which must be persisted
across pipeline runs."** Without a `docstore`, none of this runs at all.

---

## The pipeline object

```python
class IngestionPipeline(BaseModel):
    """
    An ingestion pipeline that can be applied to data.

    Args:
        ...
        cache (Optional[IngestionCache], optional):
            Cache to use to store the data. Defaults to None.
        docstore (Optional[BaseDocumentStore], optional):
            Document store to use for de-duping with a vector store. Defaults to None.
        docstore_strategy (DocstoreStrategy, optional):
            Document de-dup strategy. Defaults to DocstoreStrategy.UPSERTS.
        disable_cache (bool, optional):
            Disable the cache. Defaults to False.
```

```python
    docstore: Optional[BaseDocumentStore] = Field(
        default=None,
        description="Document store to use for de-duping with a vector store.",
    )
    docstore_strategy: DocstoreStrategy = Field(
        default=DocstoreStrategy.UPSERTS, description="Document de-dup strategy."
    )
    disable_cache: bool = Field(default=False, description="Disable the cache")
```

```python
    def __init__(
        self,
        name: str = DEFAULT_PIPELINE_NAME,
        ...
        documents: Optional[Sequence[Document]] = None,
        vector_store: Optional[BasePydanticVectorStore] = None,
        cache: Optional[IngestionCache] = None,
        docstore: Optional[BaseDocumentStore] = None,
        docstore_strategy: DocstoreStrategy = DocstoreStrategy.UPSERTS,
        disable_cache: bool = False,
    ) -> None:
        if transformations is None:
            transformations = self._get_default_transformations()
        ...
            cache=cache or IngestionCache(),
```

**Note `cache=cache or IngestionCache()`** — a cache object always exists. It is an in-memory
`SimpleCache` unless one is supplied, and it is not persisted unless you persist it.

---

## `run()`

```python
    @dispatcher.span
    def run(
        self,
        show_progress: bool = False,
        documents: Optional[List[Document]] = None,
        nodes: Optional[Sequence[BaseNode]] = None,
        cache_collection: Optional[str] = None,
        in_place: bool = True,
        store_doc_text: bool = True,
        num_workers: Optional[int] = None,
        **kwargs: Any,
    ) -> Sequence[BaseNode]:
        """
        Run a series of transformations on a set of nodes.

        If a vector store is provided, nodes with embeddings will be added to the vector store.

        If a vector store + docstore are provided, the docstore will be used to de-duplicate documents.

        Args:
            show_progress (bool, optional): Shows execution progress bar(s). Defaults to False.
            documents (Optional[List[Document]], optional): Set of documents to be transformed. Defaults to None.
            nodes (Optional[Sequence[BaseNode]], optional): Set of nodes to be transformed. Defaults to None.
            cache_collection (Optional[str], optional): Cache for transformations. Defaults to None.
            in_place (bool, optional): Whether transformations creates a new list for transformed nodes or modifies the
                array passed to `run_transformations`. Defaults to True.
            store_doc_text (bool, optional): Whether to store the document texts. Defaults to True.
            num_workers (Optional[int], optional): The number of parallel processes to use.
                If set to None, then sequential compute is used. Defaults to None.
```

**`num_workers` is process-based**, via `ProcessPoolExecutor` (imported at the top of the module:
`from concurrent.futures import ProcessPoolExecutor`). Documents/nodes are split with `_node_batcher`:

```python
    @staticmethod
    def _node_batcher(
        num_batches: int, nodes: Union[Sequence[BaseNode], List[Document]]
    ) -> Generator[Union[Sequence[BaseNode], List[Document]], Any, Any]:
        """Yield successive n-sized chunks from lst."""
        batch_size = max(1, int(len(nodes) / num_batches))
```

and the worker returns cache entries for the parent to merge:

```python
def _arun_transformations_worker(
    nodes: Sequence[BaseNode],
    transformations: Sequence[TransformComponent],
    in_place: bool = True,
    cache: Optional[IngestionCache] = None,
    cache_collection: Optional[str] = None,
) -> tuple:
    """
    ProcessPoolExecutor worker for arun_transformations.

    Returns (nodes, cache_entries) so the parent can merge cache writes
    back after all workers finish. Only in-memory backends are merged.
    External backends write through to shared storage and need no merge.
    """
```

---

## The de-duplication logic, verbatim

### `DUPLICATES_ONLY`

```python
    def _handle_duplicates(
        self,
        nodes: Sequence[BaseNode],
    ) -> Sequence[BaseNode]:
        """Handle docstore duplicates by checking all hashes."""
        assert self.docstore is not None

        existing_hashes = self.docstore.get_all_document_hashes()
        current_hashes: set[str] = set()
        nodes_to_run = []
        for node in nodes:
            if node.hash not in existing_hashes and node.hash not in current_hashes:
                self.docstore.set_document_hash(node.id_, node.hash)
                nodes_to_run.append(node)
                current_hashes.add(node.hash)

        return nodes_to_run
```

### `UPSERTS` and `UPSERTS_AND_DELETE`

```python
    def _handle_upserts(
        self,
        nodes: Sequence[BaseNode],
    ) -> Sequence[BaseNode]:
        """Handle docstore upserts by checking hashes and ids."""
        assert self.docstore is not None

        doc_ids_from_nodes = set()
        deduped_nodes_to_run = {}
        for node in nodes:
            ref_doc_id = node.ref_doc_id if node.ref_doc_id else node.id_
            doc_ids_from_nodes.add(ref_doc_id)
            existing_hash = self.docstore.get_document_hash(ref_doc_id)
            if not existing_hash:
                # document doesn't exist, so add it
                deduped_nodes_to_run[ref_doc_id] = node
            elif existing_hash and existing_hash != node.hash:
                self.docstore.delete_ref_doc(ref_doc_id, raise_error=False)

                if self.vector_store is not None:
                    self.vector_store.delete(ref_doc_id)

                deduped_nodes_to_run[ref_doc_id] = node
            else:
                continue  # document exists and is unchanged, so skip it

        if self.docstore_strategy == DocstoreStrategy.UPSERTS_AND_DELETE:
            # Identify missing docs and delete them from docstore and vector store
            existing_doc_ids_before = set(
                self.docstore.get_all_document_hashes().values()
            )
            doc_ids_to_delete = existing_doc_ids_before - doc_ids_from_nodes
            for ref_doc_id in doc_ids_to_delete:
                self.docstore.delete_document(ref_doc_id)

                if self.vector_store is not None:
                    self.vector_store.delete(ref_doc_id)

        return list(deduped_nodes_to_run.values())
```

**`UPSERTS_AND_DELETE` is the built-in equivalent of a prune pass**: anything in the docstore that was not
in this run's input is deleted.

**Caveat on `deduped_nodes_to_run[ref_doc_id] = node`** — it is a dict keyed by `ref_doc_id`. If several
nodes share a `ref_doc_id` (which is exactly what happens when one document is split into many chunks),
**only the last one survives**. This method is designed to be fed `Document` objects, not pre-split nodes.

**Caveat on `ref_doc_id`** — in `llama_index/core/schema.py` (0.14.23) it is marked deprecated:

```python
    @property
    def ref_doc_id(self) -> Optional[str]:  # pragma: no cover
        """Deprecated: Get ref doc id."""
        source_node = self.source_node
        if source_node is None:
            return None
        return source_node.node_id
```

---

## The transformation cache

```python
def get_transformation_hash(
    nodes: Sequence[BaseNode], transformation: TransformComponent
) -> str:
    """Get the hash of a transformation."""
    nodes_str = "".join(
        [str(node.get_content(metadata_mode=MetadataMode.ALL)) for node in nodes]
    )
    ...
    return sha256((nodes_str + transform_string).encode("utf-8")).hexdigest()
```

```python
    for transform in transformations_with_progress:
        if cache is not None:
            hash = get_transformation_hash(nodes, transform)
            cached_nodes = cache.get(hash, collection=cache_collection)
            if cached_nodes is not None:
                nodes = cached_nodes
            else:
                nodes = transform(nodes, **kwargs)
                cache.put(hash, nodes, collection=cache_collection)
        else:
            nodes = transform(nodes, **kwargs)

    return nodes
```

**The cache key is `sha256(concatenated content of ALL nodes in the batch + the transform's repr)`.** It is a
whole-batch key, not a per-document key: one changed byte anywhere in the batch misses the cache for the
entire batch. It is designed to make an expensive transform (embeddings, LLM extractors) idempotent, not to
compute a per-file delta.

---

## Storing into the docstore

```python
        if effective_strategy in (
            DocstoreStrategy.UPSERTS,
            DocstoreStrategy.UPSERTS_AND_DELETE,
        ):
            self.docstore.set_document_hashes({n.id_: n.hash for n in nodes})
            self.docstore.add_documents(nodes, store_text=store_doc_text)
        elif effective_strategy == DocstoreStrategy.DUPLICATES_ONLY:
            self.docstore.add_documents(nodes, store_text=store_doc_text)
        else:
            raise ValueError(f"Invalid docstore strategy: {effective_strategy}")
```

`docstore.add_documents(..., store_text=True)` means **the docstore holds a second full copy of every
document's text**, in addition to whatever the destination store holds.
