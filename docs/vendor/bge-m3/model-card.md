---
name: bge-m3-model-card
description: "BAAI/bge-m3 embedding model — 8192-token context, 1024 dims, 100+ languages, dense/sparse/multi-vector retrieval, no query instruction needed (huggingface.co)"
type: reference
---

<!-- source: https://huggingface.co/BAAI/bge-m3 -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — READ FIRST. THIS IS NOT A VERBATIM COPY.**
> Retrieved 2026-08-05 via `WebFetch`, which is **model-mediated** and refused verbatim reproduction
> (~125-character quote cap). Bash was disabled, so `node -e "fetch(...)"` and `curl` were unavailable.
> `"Quoted"` text is reported as an exact phrase from the model card; everything else is **paraphrase**.
> **The Ollama model card was NOT retrieved** — see the gap note at the bottom.

---

## The numbers we actually need

| Property | Value |
|---|---|
| **Max input length** | **8192 tokens** |
| **Dense embedding dimension** | **1024** |
| **Languages** | "more than 100 working languages" |
| **Query instruction required?** | **No** |

## Multi-functionality — the three retrieval modes

The "M3" is multi-linguality, multi-granularity, multi-functionality. The three retrieval functions:

- **Dense retrieval** — "map the text into a single embedding"
- **Sparse / lexical retrieval** — "a vector of size equal to the vocabulary, with the majority of
  positions set to zero, calculating a weight only for tokens present in the text"
- **Multi-vector retrieval** — "use multiple vectors to represent a text" (ColBERT-style)

> **Relevant to our hybrid design:** bge-m3 can itself produce the *lexical* signal, which overlaps with
> what we get from SQLite FTS5/BM25. Whether we take sparse from the model or from FTS5 is a design
> choice; **via Ollama's `/api/embed` we only get the DENSE vector** — that endpoint returns a single flat
> embedding per input (see `docs/vendor/ollama/api.md`). Sparse and multi-vector require the FlagEmbedding
> library, not the Ollama endpoint. **Not stated by the card — this is our inference from the Ollama API
> shape; verify before relying on it.**

## No instruction prefix

> "The BGE-M3 model no longer requires adding instructions to the queries."

This matters for the LlamaIndex bridge: leave `query_instruction` and `text_instruction` **unset** on
`OllamaEmbedding` (both default to `None`). See `docs/vendor/llamaindex/ollama-bridge.md` §5.

## Similarity metric

**Not explicitly stated** as a recommendation. The card demonstrates dot-product operations (`@`) for
dense embeddings and gives separate scoring methods for the sparse and multi-vector modes, but does not
name a single preferred metric.

> Practically: bge-m3 dense vectors are normally used **normalised**, making cosine and dot product
> equivalent. **The card does not say this** — flagged as convention, not documentation. If you rely on
> it, verify the vectors Ollama returns are unit-norm rather than assuming.

## Base model / parameter count

**Not stated** in the specs section. The card indicates the architecture extends **XLM-RoBERTa** to an
8192-token window; an exact parameter count was not returned by the retrieval.

---

## GAP — the Ollama model card was NOT retrieved

The task allowed "the HF card and/or the Ollama model card". **Only the Hugging Face card was fetched.**
`ollama.com/library/bge-m3` was **not** retrieved, so the following remain unknown:

- The **quantisation** of the specific Ollama tag we pull, and its file size.
- The **`num_ctx` the Ollama Modelfile actually sets by default** — which is very likely the real
  explanation for the "8192 tokens" figure above **not** being what our deployment enforces. Ollama
  commonly defaults a model's context far below its architectural maximum.

> **Do not assume our runtime honours 8192 tokens just because the architecture supports it.** This is
> precisely the unresolved thread from `docs/vendor/ollama/api.md` (`num_ctx` transmitted but observed to
> change nothing) and the batch-size failure in `docs/vendor/llamaindex/ollama-bridge.md`. Resolving this
> gap is the single highest-value follow-up in this vendor set.
>
> Check with `/api/show` (its `modelinfo` map carries a `*context_length*` key) against the running server.
