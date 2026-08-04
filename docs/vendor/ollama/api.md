---
name: ollama-api
description: "Ollama HTTP API — /api/embed contract (input string vs array), truncate, dimensions, options/num_ctx, keep_alive, /api/show, /api/tags (ollama docs + installed client source)"
type: reference
---

<!-- source: https://github.com/ollama/ollama/blob/main/docs/api.md -->
<!-- source: https://raw.githubusercontent.com/ollama/ollama/main/docs/api.md -->
<!-- source (verbatim, local): Python314/Lib/site-packages/ollama/_types.py, _client.py — ollama 0.6.2 -->
<!-- retrieved: 2026-08-05 -->

> **FIDELITY — MIXED. READ FIRST.**
> This file has **two kinds of content, labelled per section.**
>
> - **`VERBATIM (installed source)`** — copied from the `ollama` **0.6.2** Python client installed in this
>   project. This is real code, exact, and version-true. It is the **strongest evidence here**, because the
>   client's typed request/response models *are* the wire contract.
> - **`docs site (paraphrased)`** — from `docs/api.md` via `WebFetch`, which is **model-mediated** and
>   **refused** verbatim reproduction (~125-character quote cap). Bash was disabled, so
>   `node -e "fetch(...)"` and `curl` were unavailable. `"Quoted"` text is reported as exact; the rest is
>   paraphrase. **Do not treat the paraphrased parts as the contract.**

---

## `POST /api/embed`

### The request — `VERBATIM (installed source)`, `ollama/_types.py`

```python
class EmbedRequest(BaseRequest):
  input: Union[str, Sequence[str]]
  'Input text to embed.'

  truncate: Optional[bool] = None
  'Truncate the input to the maximum token length.'

  options: Optional[Union[Mapping[str, Any], Options]] = None
  'Options to use for the request.'

  keep_alive: Optional[Union[float, str]] = None

  dimensions: Optional[int] = None
  'Dimensions truncates the output embedding to the specified dimension.'
```

(`BaseRequest` contributes `model: Annotated[str, Field(min_length=1)]` — "Model to use for the request.")

**`input` accepts EITHER a single string OR a sequence of strings.** That is settled, in the type itself.

### The response — `VERBATIM (installed source)`

```python
class EmbedResponse(BaseGenerateResponse):
  """
  Response returned by embed requests.
  """

  embeddings: Sequence[Sequence[float]]
  'Embeddings of the inputs.'
```

> ### ⚠️ THE THING THAT BURNED US
> **`embeddings` is ALWAYS a list of lists — even when you passed a single string.**
> A one-string request returns `[[...]]`, not `[...]`. You must index `[0]`.
> This is why the client's own single-item helper ends in `return result.embeddings[0]`
> (`VERBATIM`, `_client.py`).

### The client method — `VERBATIM (installed source)`, `ollama/_client.py`

```python
  def embed(
    self,
    model: str = '',
    input: Union[str, Sequence[str]] = '',
    truncate: Optional[bool] = None,
    options: Optional[Union[Mapping[str, Any], Options]] = None,
    keep_alive: Optional[Union[float, str]] = None,
  ) -> EmbedResponse:
```

posting to `'/api/embed'`. An `async def embed(...)` with an identical signature exists on `AsyncClient`.

### The same endpoint — `docs site (paraphrased)`

| Field | Type | Documented meaning |
|---|---|---|
| `model` | string, required | "name of model to generate embeddings from" |
| `input` | string **or** array of strings | "text or list of text to generate embeddings for" |
| `truncate` | boolean, optional | "truncates the end of each input to fit within context length. Returns error if `false` and context length is exceeded. Defaults to `true`" |
| `options` | object, optional | "additional model parameters listed in the documentation for the Modelfile" |
| `keep_alive` | — | "controls how long the model will stay loaded into memory following the request (default: `5m`)" |
| `dimensions` | number, optional | "number of dimensions for the embedding" |

Example response shape shown in the docs for a **single** input — note the nested array:

```json
{
  "model": "all-minilm",
  "embeddings": [[0.010071029, -0.0017594862, ...]],
  "total_duration": 14143917,
  "load_duration": 1019500,
  "prompt_eval_count": 8
}
```

Multiple inputs return a parallel array with a matching count.

### `truncate` — documented vs observed

The docs say `truncate` "Defaults to `true`" and that an error is returned "if `false` and context length
is exceeded". **We nevertheless observed HTTP 400 `"the input length exceeds the context length"` on an
over-long *batch* without setting `truncate`.** The tension is unresolved and recorded honestly; see
`docs/vendor/llamaindex/ollama-bridge.md` §2, which proves the LlamaIndex bridge **never sends `truncate`
at all**. **Treat the measured 400 as ground truth.**

## `POST /api/embeddings` — DEPRECATED

`VERBATIM (installed source)`:

```python
class EmbeddingsRequest(BaseRequest):
  prompt: Optional[str] = None
  'Prompt to generate embeddings from.'

  options: Optional[Union[Mapping[str, Any], Options]] = None
  'Options to use for the request.'

  keep_alive: Optional[Union[float, str]] = None


class EmbeddingsResponse(SubscriptableBaseModel):
  """
  Response returned by embeddings requests.
  """

  embedding: Sequence[float]
  'Embedding of the prompt.'
```

**The differences, precisely:** field `prompt` (single string only, no array) instead of `input`; response
field `embedding` — **a flat array, not nested** — instead of `embeddings`. Singular throughout.
**Use `/api/embed`.**

## `options` — the full set, `VERBATIM (installed source)`

The `options` object is typed. This is the authoritative list of accepted keys for this client version:

```python
class Options(SubscriptableBaseModel):
  # load time options
  numa: Optional[bool] = None
  num_ctx: Optional[int] = None
  num_batch: Optional[int] = None
  num_gpu: Optional[int] = None
  main_gpu: Optional[int] = None
  low_vram: Optional[bool] = None
  f16_kv: Optional[bool] = None
  logits_all: Optional[bool] = None
  vocab_only: Optional[bool] = None
  use_mmap: Optional[bool] = None
  use_mlock: Optional[bool] = None
  embedding_only: Optional[bool] = None
  num_thread: Optional[int] = None

  # runtime options
  num_keep: Optional[int] = None
  seed: Optional[int] = None
  num_predict: Optional[int] = None
  top_k: Optional[int] = None
  top_p: Optional[float] = None
  tfs_z: Optional[float] = None
  typical_p: Optional[float] = None
  repeat_last_n: Optional[int] = None
  temperature: Optional[float] = None
  repeat_penalty: Optional[float] = None
  presence_penalty: Optional[float] = None
  frequency_penalty: Optional[float] = None
  mirostat: Optional[int] = None
  mirostat_tau: Optional[float] = None
  mirostat_eta: Optional[float] = None
  penalize_newline: Optional[bool] = None
  stop: Optional[Sequence[str]] = None
```

**`num_ctx` is a LOAD-TIME option** (note which half of the class it sits in) — it participates in how the
model is loaded, not in per-request decoding.

**What `num_ctx` does to an embedding request: NOT ESTABLISHED.** The docs page says only that `options`
carries "additional model parameters listed in the documentation for the Modelfile such as `temperature`"
and **says nothing about `num_ctx` in the embeddings section**. We measured that setting it changed
nothing. The client will faithfully transmit it; server-side honouring is unverified.

## `keep_alive`

Type is `Optional[Union[float, str]]` (`VERBATIM`) — a number **or** a duration string. Docs give the
default as `5m`; the accepted string grammar is **not stated** on the page as retrieved (the example uses
`5m`). Passing `None` omits the field and lets the server default apply.

## `/api/show` and `/api/tags`

**NOT CAPTURED IN DETAIL — say so rather than guess.** The retrieval was directed at the embeddings
endpoints and did not return the field-level contract for these two. What is independently confirmed from
installed source (see `docs/vendor/llamaindex/ollama-bridge.md` §3) is that `/api/show` returns an object
with a **`modelinfo`** mapping, and that LlamaIndex discovers a model's context window by scanning it for
a key containing `context_length`:

```python
            info = self.client.show(self.model).modelinfo
            for key, value in info.items():
                if "context_length" in key:
```

For `/api/tags` (model listing) **nothing was captured** — consult the URL.

---

## Re-pull raw when Bash is available

```
node -e "fetch('https://raw.githubusercontent.com/ollama/ollama/main/docs/api.md').then(r=>r.text()).then(t=>require('fs').writeFileSync('ollama-api.raw.md',t))"
```

That URL serves **plain markdown**, so a raw pull would give a genuinely verbatim file and should replace
the paraphrased sections above.
