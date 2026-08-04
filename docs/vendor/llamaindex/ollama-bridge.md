# LlamaIndex ↔ Ollama bridge — `OllamaEmbedding` and `Ollama`

- **Source (installed package source, VERBATIM):**
  `Python314\Lib\site-packages\llama_index\embeddings\ollama\base.py` — `llama-index-embeddings-ollama` **0.9.0**
  `Python314\Lib\site-packages\llama_index\llms\ollama\base.py` — `llama-index-llms-ollama` **0.10.1**
  `Python314\Lib\site-packages\llama_index\core\constants.py` — `llama-index-core` **0.14.23**
- **Source (docs site):** not consulted for this file — see the note below.
- **Retrieved:** 2026-08-05

> **PROVENANCE.** Everything in this file marked **`VERBATIM (installed source)`** is copied from the
> package source **actually installed in this project**, so it is the code that really runs here. Nothing
> in this file comes from the docs site; where the installed source cannot answer a question, this file
> says **NOT ANSWERABLE FROM SOURCE** rather than guessing. The docs site was deliberately not used as a
> substitute, because the questions here are about **wire behaviour**, and only the source settles that.
>
> These two packages were installed **after** the earlier LlamaIndex research round, which is why the
> other seven files in this folder do not cover them.

---

## 1. `OllamaEmbedding` — the full class surface

`VERBATIM (installed source)` — `llama_index/embeddings/ollama/base.py`, fields and constructor:

```python
class OllamaEmbedding(BaseEmbedding):
    """Class for Ollama embeddings."""

    base_url: str = Field(description="Base url the model is hosted by Ollama")
    model_name: str = Field(description="The Ollama model to use.")
    embed_batch_size: int = Field(
        default=DEFAULT_EMBED_BATCH_SIZE,
        description="The batch size for embedding calls.",
        gt=0,
        le=2048,
    )
    ollama_additional_kwargs: Dict[str, Any] = Field(
        default_factory=dict, description="Additional kwargs for the Ollama API."
    )
    query_instruction: Optional[str] = Field(
        default=None, description="Instruction to prepend to query text."
    )
    text_instruction: Optional[str] = Field(
        default=None, description="Instruction to prepend to text."
    )
    keep_alive: Optional[Union[float, str]] = Field(
        default="5m",
        description="controls how long the model will stay loaded into memory following the request(default: 5m)",
    )
```

Constructor defaults, `VERBATIM (installed source)`:

```python
    def __init__(
        self,
        model_name: str,
        base_url: str = "http://localhost:11434",
        embed_batch_size: int = DEFAULT_EMBED_BATCH_SIZE,
        ollama_additional_kwargs: Optional[Dict[str, Any]] = None,
        query_instruction: Optional[str] = None,
        text_instruction: Optional[str] = None,
        callback_manager: Optional[CallbackManager] = None,
        client_kwargs: Optional[Dict[str, Any]] = None,
        keep_alive: Optional[Union[float, str]] = None,
        **kwargs: Any,
    ) -> None:
```

`VERBATIM (installed source)` — `llama_index/core/constants.py`:

```python
DEFAULT_EMBED_BATCH_SIZE = 10
```

So **`embed_batch_size` defaults to 10**, and is constrained `gt=0, le=2048`.

---

## 2. THE ANSWER: what actually goes on the wire

This is the question that cost the hour. The source settles it completely.

`VERBATIM (installed source)` — the batch path and the single path, side by side:

```python
    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get text embeddings."""
        formatted_texts = [self._format_text(text) for text in texts]
        return self.get_general_text_embeddings(formatted_texts)

    def get_general_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get Ollama embeddings."""
        result = self._client.embed(
            model=self.model_name,
            input=texts,
            options=self.ollama_additional_kwargs,
            keep_alive=self.keep_alive,
        )
        return result.embeddings

    def get_general_text_embedding(self, texts: str) -> List[float]:
        """Get Ollama embedding."""
        result = self._client.embed(
            model=self.model_name,
            input=texts,
            options=self.ollama_additional_kwargs,
            keep_alive=self.keep_alive,
        )
        return result.embeddings[0]
```

**CONFIRMED BY SOURCE — the batch is one HTTP request.** `get_general_text_embeddings` (plural) passes
the **entire Python list** as `input=texts` in a **single** `client.embed(...)` call. There is no chunking,
no loop, no concurrency inside this method. `embed_batch_size` (default 10) is applied *upstream* by
`BaseEmbedding` in `llama-index-core`, which slices the corpus into batches — but **each batch is then one
request carrying every item in it**.

This is exactly the mechanism behind the observed failure: 24 × ~4000 characters went out as **one**
`input` array, and Ollama applied the context limit to that combined request, returning
HTTP 400 `"the input length exceeds the context length"`.

**The singular/plural distinction is only about shape, not about batching:**

| Method | `input=` sent | Returns |
|---|---|---|
| `get_general_text_embeddings` (plural) | the **whole list** | `result.embeddings` — list of vectors |
| `get_general_text_embedding` (singular) | **one string** | `result.embeddings[0]` — one vector |

Both hit the same endpoint. Per `docs/vendor/ollama/api.md`, Ollama's `/api/embed` response field
`embeddings` is **always an array of arrays**, which is why the singular path must index `[0]`.

### `truncate` is never sent — CONFIRMED BY SOURCE

**Neither call site passes `truncate`.** The parameter exists on the Ollama client
(`EmbedRequest.truncate: Optional[bool]`) but `OllamaEmbedding` never sets it, so the **server default
applies**. Ollama's own API doc states `truncate` "Defaults to `true`".

> **DOCUMENTED-vs-OBSERVED TENSION — do not paper over this.** If the server default is `truncate=true`,
> a naive reading says over-long input should be silently truncated rather than rejected; yet we observed
> HTTP 400 `"the input length exceeds the context length"`. The installed source **cannot** resolve this —
> the behaviour is inside the Ollama server. **NOT ANSWERABLE FROM SOURCE.** Treat the 400 as the ground
> truth (we measured it) and the truncation default as unconfirmed for the batch case.

**Answer to "is there silent truncation of over-long input, or is it always an error?"** —
**NOT ANSWERABLE FROM SOURCE.** The bridge neither truncates nor validates length; it forwards and lets
the server decide. Our measured outcome for an over-long *batch* was a hard 400, not silent truncation.

---

## 3. Does `num_ctx` reach the target?

**Partly — and the embedding path differs sharply from the LLM path.**

**Embeddings:** `ollama_additional_kwargs` is passed straight through as the `options` field
(`options=self.ollama_additional_kwargs`). So a `num_ctx` you put in `ollama_additional_kwargs` **is
transmitted** in the HTTP request's `options` object. **CONFIRMED BY SOURCE: it is sent.**
**Whether the Ollama server honours `num_ctx` for an embedding model is NOT ANSWERABLE FROM SOURCE** —
that is server/llama.cpp behaviour. Our measurement was that it changed nothing, which is consistent with
the server ignoring it here. The bridge is not the culprit.

**Note the asymmetry** — the *LLM* class sets `num_ctx` for you, the *embedding* class does not.
`VERBATIM (installed source)` — `llama_index/llms/ollama/base.py`:

```python
    @property
    def _model_kwargs(self) -> Dict[str, Any]:
        base_kwargs = {
            "temperature": self.temperature,
            "num_ctx": self.get_context_window(),
        }
        return {
            **base_kwargs,
            **self.additional_kwargs,
        }

    def get_context_window(self) -> int:
        if self.context_window == -1:
            # Try to get the context window from the model info if not set
            info = self.client.show(self.model).modelinfo
            for key, value in info.items():
                if "context_length" in key:
                    self.context_window = int(value)
                    break

        # If the context window is still -1, use the default context window
        return (
            self.context_window if self.context_window != -1 else DEFAULT_CONTEXT_WINDOW
        )
```

with `DEFAULT_CONTEXT_WINDOW = 3900  # tokens` (`VERBATIM`, core constants). The LLM class auto-discovers
the real window via `/api/show` → `modelinfo` → the first key containing `context_length`.
**`OllamaEmbedding` has no equivalent — it never calls `/api/show` and never infers a window.**

---

## 4. `keep_alive`, `base_url`, `model_name`

- **`base_url`** — constructor default `"http://localhost:11434"`; used as `Client(host=self.base_url, **client_kwargs)`.
- **`model_name`** — required positional; forwarded as `model=`.
- **`keep_alive`** — forwarded on **every** embed call.

> **GOTCHA (a reading of the source, not runtime-verified).** The pydantic *field* default is `"5m"`, but
> the *constructor* parameter default is `None`, and `__init__` **always** forwards `keep_alive=keep_alive`
> to `super().__init__()`. So constructing `OllamaEmbedding(model_name=...)` without naming `keep_alive`
> appears to pass an explicit `None`, which would override the `"5m"` field default and send
> `keep_alive=None`. If keeping the model resident matters, **set `keep_alive` explicitly.**
> Flagged as source-reading; confirm at runtime before depending on it.

---

## 5. Input formatting — inputs are `.strip()`ed

`VERBATIM (installed source)`:

```python
    def _format_query(self, query: str) -> str:
        """Format query with instruction if provided."""
        if self.query_instruction:
            return f"{self.query_instruction.strip()} {query.strip()}".strip()
        return query.strip()

    def _format_text(self, text: str) -> str:
        """Format text with instruction if provided."""
        if self.text_instruction:
            return f"{self.text_instruction.strip()} {text.strip()}".strip()
        return text.strip()
```

Every text and query is **stripped of surrounding whitespace** before embedding, and an optional
`query_instruction` / `text_instruction` prefix is prepended. Leave both unset for bge-m3 — its model card
states "The BGE-M3 model no longer requires adding instructions to the queries"
(see `docs/vendor/bge-m3/model-card.md`).

---

## 6. L50 — does a shared batch request contaminate items?

**Our measurement:** within a batch that *fits*, each vector was identical to the same text embedded alone
(cosine 1.000000) — i.e. the shared request does **not** mix items.

**Does the installed source confirm it? NO — NOT ANSWERABLE FROM SOURCE, and it never could be.**
The bridge's entire contribution is to place the list into one `input=` field and return
`result.embeddings` unchanged. Per-item independence is decided **inside the Ollama server / llama.cpp**,
below the layer this file documents. The source is *consistent* with independence (there is no cross-item
code here at all — no pooling, no concatenation, no ordering logic), but consistency is not proof.

**Status of L50: an empirical result of ours, held on our own measurement, not on vendor documentation.**
Neither the LlamaIndex source nor the Ollama API doc states a per-item independence guarantee.
If that guarantee ever becomes load-bearing, re-measure rather than cite.

---

## 7. Practical consequences for us

1. **The batch is the unit the context limit applies to**, not the item. Cap **total characters per
   batch**, not just per document. Lowering `embed_batch_size` is the direct lever (default 10).
2. **`OllamaEmbedding` will not discover the model's context window for you** — unlike the LLM class.
   Size batches yourself.
3. **`truncate` is never sent**, so you cannot rely on the bridge to save an over-long input.
4. **Set `keep_alive` explicitly** if model residency matters (see the gotcha above).
5. `result.embeddings` is always a list of lists — the singular helper only differs by `[0]`.
