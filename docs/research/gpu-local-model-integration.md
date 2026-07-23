# GPU / Local-Model Integration for the Dev Loop — RTX 3090, 24 GB

*Research only — no installs, no downloads, no runs, no test-suite execution. Dated 2026-07-23.*

**Relationship to `docs/research/gpu-dev-tools-landscape.md`.** That doc is a breadth survey of the whole
GPU-dev-tools space (MCP servers, coding-assistant IDE plugins, OCR, image diffing) and already has a
serving-stack table (its §3) and an embedding/semantic-search section (its §2) covering third-party MCP
tools. This doc goes **deep** on the five questions the owner asked directly — most importantly, whether
**graphify itself** (not a third-party bolt-on) can be pointed at a local model, which the other doc did
not investigate at the source-code level. Read both; this one supersedes the other's §3 serving-stack
numbers only where they conflict (they don't — they agree).

## Method note (§10.11 compliance)

Queried the graphify **global** graph first (`~/.graphify/global-graph.json`, corpora: `vendor-docs` 2,435
nodes, `methodology` 4,335 nodes, plus `gemini-api-docs`, `cloudflare-workers-docs`) for `ollama llama.cpp
vllm lmstudio local model gpu quantization whisper embedding`. **Miss** — the only hits were tangential
methodology nodes (`Local Model Server Reviewers`, `AI Framework Decision Matrix` from the `gsd-core`
corpus in a sibling repo) and false-positive substring matches, not real vendor documentation for any of
these tools. This matches the prior doc's own finding on the same graph. Web research follows below, with
a **deposit-worthy list** at the end (not deposited — research-only task).

**A second, load-bearing method note for this doc specifically:** the graphify **package itself** is
installed locally as a Python package, not just a CLI binary. Rather than guessing at its capabilities
from `--help` text alone, I read the **installed source** (`graphify/llm.py`, `graphify/cli.py`, the
bundled skill markdown) and cross-checked it against the **public GitHub repo's issue/PR history**
(`Graphify-Labs/graphify`, read via `gh api`, read-only). This is primary-source verification, not a
summary — per L16, a claim about what a tool does is only as good as the source you actually opened.

---

## Environment recap

Windows 11 · RTX 3090, 24 GB VRAM, idle · 32 logical cores · Node 24 · Python 3.10.4 · `uv` at
`~/.local/bin` (needs `--native-tls`/`UV_NATIVE_TLS=1` behind the TLS-inspecting proxy — this almost
certainly also affects `ollama pull` and any Hugging Face weight download; **not verified in this
research-only pass**, flag before attempting a real download). graphify is installed as a pip package
in a dedicated venv (`~/.local/venvs/graphify`), version **0.9.22**, exposed as `graphify.exe`/`graphify-mcp.exe`
shims on `~/.local/bin`.

---

## 1 · graphify → local model — THE CENTERPIECE

### 1a. Native LLM backend support — CONFIRMED from source, no wiring needed

`graphify extract`'s own `--help` already documents this (verified against `graphify/llm.py`'s `BACKENDS`
dict, lines ~100–200):

```
extract <path>          headless full extraction (AST + semantic LLM) for CI/scripts
    --backend B             gemini|kimi|claude|openai|deepseek|ollama (default: whichever API key is set)
                            openai also reaches self-hosted OpenAI-compatible servers (llama.cpp,
                            vLLM, LM Studio): set OPENAI_BASE_URL and OPENAI_MODEL
                            claude also reaches custom Anthropic-compatible endpoints (LiteLLM
                            proxy, gateways): set ANTHROPIC_BASE_URL and ANTHROPIC_MODEL
```

**graphify has a first-class `ollama` backend**, not a workaround via the `openai` backend. From
`BACKENDS["ollama"]` in `llm.py`:

```python
"ollama": {
    "base_url": _resolve_ollama_base_url("http://localhost:11434/v1"),
    "default_model": os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b"),
    "env_key": "OLLAMA_API_KEY",
    "pricing": {"input": 0.0, "output": 0.0},
    ...
}
```

**How — exact env vars (all confirmed by reading the code, not the `--help` summary):**

| Var | Effect |
|---|---|
| `OLLAMA_BASE_URL` | explicit override, used verbatim (wins over everything below) |
| `OLLAMA_HOST` | Ollama's own convention (`host`, `host:port`, `:port`, bare port) — graphify normalizes it the same way the `ollama` client does and appends `/v1` |
| `OLLAMA_MODEL` | model tag to request (default `qwen2.5-coder:7b`) |
| `OLLAMA_API_KEY` | any non-empty dummy value — Ollama doesn't check it, but the OpenAI SDK graphify uses requires *something* be set or extraction refuses to start with a loud warning |
| `GRAPHIFY_OLLAMA_NUM_CTX` | pin the context window; **auto-derived otherwise** from actual chunk size (see the VRAM warning below — this is the single most important knob for a 24 GB card) |
| `GRAPHIFY_OLLAMA_KEEP_ALIVE` | how long Ollama keeps the model loaded between calls (default `30m`) |
| `GRAPHIFY_OLLAMA_PARALLEL=1` | opt-in to break graphify's own serial-request default (see below) |
| `GRAPHIFY_MAX_RETRIES` | overrides ollama's default of **0** SDK retries (graphify deliberately disables the OpenAI SDK's 6-retry default for local backends — a hung local server should fail fast into graphify's own chunk-level retry, not burn ~21 minutes retrying a wedged connection) |
| `GRAPHIFY_API_TIMEOUT` | per-request wall-clock timeout, seconds (default 600 — sized for "a 31B model on a 16k chunk") |
| `GRAPHIFY_OLLAMA_VISION=1` | opt-in to send images to an ollama vision model (off by default) |

**Command:**
```bash
export OLLAMA_BASE_URL=http://localhost:11434/v1
export OLLAMA_API_KEY=ollama   # any non-empty value
export OLLAMA_MODEL=qwen2.5-coder:14b
graphify extract . --backend ollama --mode deep
```
or, to reach llama.cpp / vLLM / LM Studio (all OpenAI-compatible) via the `openai` backend:
```bash
export OPENAI_BASE_URL=http://localhost:8080/v1   # llama.cpp `server`, vLLM's OpenAI server, or LM Studio's local server
export OPENAI_MODEL=<model-name-as-served>
graphify extract . --backend openai --mode deep
```

**Backend auto-detection order is `gemini → kimi → claude → openai → deepseek → azure → bedrock → ollama`
(ollama last, deliberately opt-in)** — confirmed in `llm.py`'s `_detect_backend()`. This is a genuine
safety design choice worth noting: an incidental `OLLAMA_BASE_URL` sitting in the environment can never
silently hijack extraction away from a paid key already configured; you must either have no paid key set,
or pass `--backend ollama` explicitly. There's also an SSRF-style guard (`_validate_ollama_base_url`) that
hard-blocks link-local/metadata addresses and warns on any non-loopback host.

**Known pitfalls — already documented in graphify's own source, i.e. free lessons from prior users hitting
them (issue numbers are graphify's, cited from code comments):**

- **VRAM-pressure "hollow response" trap (#798).** Ollama defaults `num_ctx` to 2048 and *silently
  truncates* prompts larger than that, returning an empty-looking 200 OK. graphify auto-derives `num_ctx`
  from the actual chunk size (formula: `min(estimated_input_tokens + max_completion_tokens + 2000, 131072)`,
  floor 8192) specifically to dodge this — but the auto-derived value can itself be **large enough to blow
  a 24 GB budget** once model weights + KV cache are both counted. With the default `--token-budget 60000`
  (~60k tokens/chunk) and `--mode deep` on a 32B-class model, the auto-derived `num_ctx` lands near 79k
  tokens — on top of ~20 GB of Q4_K_M weights, that KV cache allocation is a real risk of exceeding 24 GB.
  **Concrete mitigation, straight from graphify's own warning text:** pass a smaller `--token-budget`
  (its own hint: `max(1024, num_ctx // 3)`) when running a 24–32B local model, e.g. `--token-budget 8192`
  or `16384`, not the 60k default sized for cloud models.
- **Ollama serves one request at a time per loaded model on a single GPU** — graphify **forces
  `max_concurrency=1` automatically for the `ollama` backend** unless `GRAPHIFY_OLLAMA_PARALLEL=1` is set,
  because "four concurrent 60k-token requests cause VRAM pressure and hollow responses after 3-4 chunks
  (#798)". This means local extraction is inherently **serial and slower** than a cloud backend with
  `--max-concurrency 4** — an honest throughput cost, not a bug to fight.
- **A response under 50 output tokens from ollama triggers graphify's own diagnostic warning**
  suggesting either VRAM pressure (reduce `--token-budget`) or a model too small for reliable JSON
  instruction-following (try a larger `--model`).

### 1b. Embedding-based semantic search — NOT present in the installed version. Three community attempts exist, none merged.

CLAUDE.md §10.11 already states graphify's `query` matches by "case-folded substring + IDF — no stemming,
no synonyms, no cross-language match." Reading the actual query implementation
(`graphify/skills/claude/references/query.md`'s inline fallback, which is what the compiled `query`
subcommand also does) confirms this precisely: it is **term-in-label overlap counting**, not embeddings —
`score = sum(1 for t in terms if t in label)`. Deduplication (`dedup.py`, `_minhash.py`) also uses
**string** similarity (Jaro/Jaro-Winkler via `rapidfuzz`, MinHash/LSH for near-duplicate shingles) — not
semantic vectors. A full grep of the installed package for `vector|embed|faiss|chroma|cosine|
sentence-transformer` turns up nothing that is actually an embedding pipeline; the few `embed` hits are
unrelated (a security comment about prompt injection, doc-string mentions of "embedded"). The package's
own dependency list (`METADATA`) confirms this from a different angle: `numpy`, `networkx`, `rapidfuzz`,
`tiktoken`, `graspologic` (for Leiden community detection) — **no `sentence-transformers`, no `faiss`, no
`chromadb`, no `onnxruntime`.**

**But this is a known, actively-discussed gap upstream, with real prototypes already built.** Checking
`Graphify-Labs/graphify` on GitHub (public repo) turned up **three independent community pull requests**,
all targeting exactly this feature, **none merged as of the installed v0.9.22**:

| # | Title | Approach | Status |
|---|---|---|---|
| [#1126](https://github.com/Graphify-Labs/graphify/issues/1126) | *local embedding pass for exhaustive `semantically_similar_to` edges (closes #7)* | **ONNX Runtime + EmbeddingGemma** (`onnx-community/embeddinggemma-300m-ONNX`, ~300 MB, CPU-only, no torch). New `graphify/embed.py`: embeds node `label`+`signature`/summary text, block-wise cosine similarity (flat peak RAM, no full N×N matrix), content-hash cache, existing-edge guard so it never clobbers a real `calls`/`implements` edge. `graphify extract --embeddings` / standalone `graphify embed`. 19 passing offline tests + 1 gated real-model smoke test, full suite reported green (1820 passed). Benchmarked on a 177-node corpus: +169 edges at the default 0.82 cosine threshold. | **CLOSED, not merged** (`merged: false`, closed 2026-06-05, no comment thread explaining why). Superseded its own original llama.cpp/ollama sketch in favor of ONNX+EmbeddingGemma partway through review. Also left the agent-facing `/graphify --embeddings` skill flag explicitly **deferred** pending a skill-baseline bump. |
| [#38](https://github.com/Graphify-Labs/graphify/issues/38) | *Local Embedding Engine — dual backend support* | **llama-cpp-python + ollama**, selectable. New `graphify/embed.py` + `graphify/pipeline.py`, content-hash cache, similarity threshold, filters synthetic nodes (file hubs, method stubs) before embedding. 17 + 20 tests reported passing. | **OPEN, unmerged**, zero review comments as of this research. |
| [#424](https://github.com/Graphify-Labs/graphify/issues/424) (implements [#1](https://github.com/Graphify-Labs/graphify/issues/1)) | *semantic query via sentence-transformers embeddings* | **sentence-transformers**, wired all the way to the query CLI: `graphify query "question" --embeddings` uses cosine-similarity ranking **instead of** BFS keyword match. An automated review bot (Qodo) flagged a real correctness bug — the PR's `embed_graph()` set an edge attribute literally named `source`, colliding with NetworkX's node-link JSON reserved `source`/`target` edge-endpoint keys, which could corrupt exported `graph.json` files — and the author fixed it (renamed to `provenance`) same day. | **OPEN, unmerged.** Most complete of the three (only one that wires all the way to the `query` command itself), but still pending as of 2026-07-23. |

The design debate in [#1's comment thread](https://github.com/Graphify-Labs/graphify/issues/1) is worth
knowing: one contributor asked whether adding embeddings is a conscious pivot away from graphify's
original "LLM-as-librarian" philosophy (the LLM compiles the graph, so it should navigate by reasoning
over a rich index, not vector similarity) toward "a more traditional semantic search stack" — a real
architectural fork in the road that the maintainer has not visibly resolved in public (no reply on record).
This is a plausible reason none of the three PRs has landed: **it may not be a technical rejection, but an
unresolved design-direction question.** Take this as informed speculation, not a confirmed maintainer
statement — I found no maintainer comment explaining the non-merge on any of the three PRs.

**Practical implication for this project: waiting on upstream is not a plan.** All three PRs are
unmerged and none has a stated ETA; the repo has an active, contributor-heavy issue tracker (2000+ issue
numbers) where feature PRs evidently sit for months.

**What it would take to add semantic search ourselves — a sidecar, not a graphify fork:**

Don't wait, and don't try to get a fork merged upstream (out of scope, high coordination cost, contested
design direction). Instead, build a small **read-only companion script** that never modifies graphify's
own code, following the exact shape PR #1126 already validated end-to-end:

1. Read `graphify-out/graph.json` (or the global graph) after every `graphify update`/`--mode deep` run.
2. Embed each node's `label` (+ `source_file`/`signature` where present, to avoid the "identical labels
   collide" problem PR #1126 flagged as a known follow-up) using a **local** embedding model served by
   Ollama — see model choice below.
3. Compute cosine similarity; this corpus is tiny by embedding-index standards (~2,500–4,500 nodes per
   global-graph corpus, low thousands per local project graph) — a flat NumPy matrix or even a naive
   loop is fast enough at this scale; no FAISS/HNSW index is needed.
4. Use the result as a **better start-node selector** for `graphify query`'s own traversal (its Step 1,
   "find the 1–3 nodes whose label best matches the expanded tokens" — replace/augment the term-overlap
   scoring there with a nearest-neighbor lookup), not as a graph mutation. This sidesteps the exact
   NetworkX `source`/`target` collision bug the Qodo bot caught in PR #424, because it never writes back
   into `graph.json` at all.

**Concrete embedding model choice — the bilingual (Hebrew/English) angle matters here and none of the
three upstream PRs addressed it.** EmbeddingGemma (PR #1126) and `all-MiniLM-L6-v2` (mentioned in #1's
thread) are **English-centric**; this project's corpus and queries are bilingual. Better fits for 24 GB:

| Model | Size | Languages | Notes |
|---|---|---|---|
| **BGE-M3** (`BAAI/bge-m3`) | ~2.2 GB (fp16) | "100+ working languages" per its model card (Hebrew not individually named, but the language count and training-corpus breadth make it a plausible fit — **not independently verified for Hebrew quality in this research pass**) | Dense + sparse + multi-vector (ColBERT-style) retrieval in one model; 8192-token context. **Available as an Ollama-pullable model** (`ollama.com/library/bge-m3`) — zero extra tooling beyond what Q2 already recommends. |
| **nomic-embed-text-v2-moe** | ~1 GB active (475M total, 305M active, MoE) | ~100 languages, explicitly marketed as multilingual, trained on 1.6B+ pairs | Matryoshka embeddings (truncatable dims). Newer (2025/2026) than BGE-M3; less battle-tested. |
| **multilingual-e5-large** | ~1.1 GB | Broad multilingual coverage; the mE5 technical report claims it beats Cohere multilingual-v3 and BGE-large-en on multilingual benchmarks | Well-established (Microsoft), heavily cited baseline. |

All three are 1–3 GB — **trivial against a 24 GB budget**, and small enough to run **concurrently** with a
32B chat/extraction model loaded for `graphify extract`, unlike the num_ctx VRAM-pressure risk noted in
§1a. **Recommendation: BGE-M3 via Ollama** — it's the only one of the three with a one-command `ollama
pull bge-m3` path that composes directly with the Q2 serving recommendation below, and its dense+sparse
hybrid mode is a reasonable hedge against pure-dense embeddings under-serving short, code-symbol-like
node labels (a known weak point for dense embeddings generally). **Honest gap: no source found in this
research pass benchmarks any of these three specifically on Hebrew retrieval quality — this is an
assumption based on stated language breadth, not a verified result, and should be spot-checked with a
handful of real Hebrew queries before relying on it.**

**Benefit/effort/risk for the sidecar:** **Effort: low-medium** (a few hundred lines, no graphify fork,
reuses the Q2 Ollama install). **Benefit: real** — directly closes the exact weakness CLAUDE.md documents
about `graphify query`. **Risk: low** — it's additive and read-only against the graph; worst case it's a
dead script if graphify ships its own embeddings later (at which point `graphify extract --embeddings`
or `--backend ollama`'s eventual merge, per whichever of the 3 PRs lands, would obsolete it — track
issues #1, #7, #38, #198, #424 for that).

### 1c. Verdict — Q1

**graphify → local backend for `--mode deep` extraction: YES, natively supported, zero wiring needed**
beyond setting env vars (`--backend ollama` or `--backend openai` pointed at any OpenAI-compatible local
server). This is a genuine, low-effort, real win: extraction currently uses `--backend claude-cli`
(remote), and every `--mode deep` re-extraction of a growing docs+code corpus costs tokens/time against a
paid session. Routing bulk re-extraction through a local model removes that cost entirely for the
AST/code path and gives a free, unlimited-iteration option for docs. **Honest caveat:** local-model
extraction quality is lower than Claude's — expect fewer/worse `INFERRED` edges and community labels on
`--mode deep`, which is aggressive specifically *because* it leans on LLM judgment; a 7–32B local model is
a real quality step down from the currently-configured `claude-cli` backend for the semantic (not AST)
layer. Best framed as "cheap draft pass for iteration / CI smoke", not a silent swap of the production
extraction pipeline.

**Embedding-based semantic search: NOT natively available, confirmed absent from the installed version,
and not close to landing upstream** (2 open, 1 closed-unmerged PRs, no visible maintainer resolution of
the underlying design debate). Worth building a small local sidecar (§1b) rather than waiting.

---

## 2 · Local LLM serving for 24 GB — Ollama vs LM Studio vs vLLM vs llama.cpp

This confirms and sharpens `gpu-dev-tools-landscape.md`'s §3 table; sources below are primary/current
(2026) where the other doc's were community-aggregator summaries.

| Stack | Windows fit | OpenAI-compat endpoint | Verdict for this env |
|---|---|---|---|
| **Ollama** | Native installer, GPU auto-detected, API **always-on** as a background service at `localhost:11434` — no GUI needs to be open | `/v1/chat/completions` (Chat Completions API, confirmed on Ollama's own blog) **and** both a native `/api/embed` and an OpenAI-compatible `/v1/embeddings` endpoint (confirmed via Ollama's current docs, `docs.ollama.com/capabilities/embeddings` — note: Ollama's original 2024 OpenAI-compat blog post said embeddings were only "under consideration"; that shipped since) | **Recommended substrate.** Lowest friction, headless-by-default (fits an agent-driven workflow better than a GUI app), and is literally the backend graphify's own `BACKENDS["ollama"]` config already assumes (`http://localhost:11434/v1` default). One tool serves both Q1's chat-model need and Q1b's embedding-model need. |
| **LM Studio** | Native Windows GUI app, polished model browser, local OpenAI-compat server mode | `localhost:1234`, but the **server must be manually started in the GUI** each session — not a background service | Fine for interactively comparing GGUF files by hand; weaker fit for anything scripted/automated (evals, graphify extraction) since it isn't headless by default. |
| **vLLM** | **No official Windows support in 2026.** Options are WSL2, Docker Model Runner (WSL2 backend), or unofficial community-maintained native wheels (`SystemPanic/vllm-windows`, `aivrar/vllm-windows-build`) — all added friction | Yes, OpenAI-compatible server | **Not worth it here.** vLLM's entire value proposition (PagedAttention, continuous batching) pays off at 10+ *concurrent* requests — a multi-user production-serving story. This is one developer issuing one request at a time; that win condition never triggers, and the Windows story costs real setup friction for zero benefit. |
| **llama.cpp** (`server`) | Native Windows builds exist | Yes, OpenAI-compatible `server` binary | Most control, least convenience. Ollama already wraps llama.cpp with a friendlier interface (model pull/management, background service, GPU auto-detect) — only reach for raw llama.cpp if a specific flag Ollama doesn't expose is needed. |

**Recommendation: Ollama**, for both the chat/extraction model (§1) and the embedding model (§1b). This
matches `gpu-dev-tools-landscape.md`'s independent conclusion.

**Concrete model choices for 24 GB (GGUF, primary-sourced from Hugging Face model-card quant tables):**

| Model | Quant | Size | Fit |
|---|---|---|---|
| **Qwen2.5-Coder-32B-Instruct** | Q4_K_M | 19.85 GB | Fits with ~4 GB headroom for KV cache at graphify's default `--token-budget`; **use a smaller `--token-budget` (8–16k) per §1a's VRAM-pressure warning**, or the auto-derived context window can overrun 24 GB |
| **Qwen2.5-Coder-32B-Instruct** | Q5_K_M | 23.26 GB | Marginal — almost no headroom left for KV cache; not recommended on a 24 GB card without a very small `--token-budget` |
| **Mistral-Small-24B-Instruct-2501** | Q4_K_M | 14.3 GB | Comfortable fit, ~10 GB headroom for a large context window; a strong "knowledge-dense" general model per Mistral's own framing, worth trying against Qwen2.5-Coder for non-code (docs) extraction quality |
| **qwen2.5-coder:7b** (graphify's own default) | — | ~4.7 GB (Q4) | Fastest, most headroom, lowest extraction quality — fine for a quick smoke pass, not for a real `--mode deep` semantic pass |

Llama-3.x-70B-class models were **not** included above: even at aggressive Q3/Q4 quantization they land
at 35–40+ GB, well past 24 GB, and are not a realistic fit for this card without heavy CPU offload (which
defeats the point). **Qwen2.5-Coder-32B-Instruct Q4_K_M is the concrete recommendation** for graphify
extraction specifically — it's code/architecture-aware (matches the extraction task) and its Q4_K_M size
is the best-fitting "recommended" quant per bartowski's own GGUF quant notes.

**The `--native-tls` proxy caveat applies here too, unverified.** `ollama pull <model>` downloads over
HTTPS from Ollama's registry; Hugging Face GGUF downloads (if fetched manually for llama.cpp/LM Studio)
likewise. Given the environment's TLS-inspecting proxy already breaks `uv`/pip cert validation, the same
failure is plausible for `ollama pull` and any Hugging Face download client — **not tested in this
research-only pass**; verify with `ollama pull qwen2.5-coder:7b` (small, fast to fail) before committing
to a larger download, and check whether Ollama respects `HTTPS_PROXY`/a custom CA bundle if it fails.

---

## 3 · Eval harness (`evals/`) → local model target

**Grounded in the actual runner code** (`evals/lib/runner.ts`, `evals/tests/live-suite.spec.ts`), not
assumption:

- The live suite is fully gated on `GEMINI_EVAL_KEY`/`GEMINI_API_KEY` via `test.skip()` — it **never**
  calls a network model in a normal run, by design (this repo currently has neither key set).
- It calls the app's **real, unstubbed** transport — `page.evaluate` invoking `askGemini()` and
  `aiSeasonRec()`, the exact functions the shipped app uses — deliberately, per the harness's own comment,
  "the opposite of `tests/ai-trust.spec.ts`'s `window.gemFetch` stub."
- **Not every category calls the network.** `runSafetyCase()` first calls `askRefuse()`, described in the
  code as "a local classifier that fires BEFORE any model call" — a case that resolves to a refusal never
  reaches the network at all. Only the grounding samples (Category A), the safety carve-outs
  (`expectRefusalId: null`), and the freeform cases (Category D) actually call `askGemini`/`aiSeasonRec`.
- **The transport is Gemini's own schema, not OpenAI-compatible.** `gemFetch()` in `app.js` posts to
  `https://generativelanguage.googleapis.com/v1beta/models/<id>:generateContent` with Gemini's
  `contents`/`candidates`/`generationConfig` request/response shape — structurally different from the
  OpenAI `messages`/`choices` shape a local OpenAI-compatible server speaks.

**What it would take — two honest options, no glue-free path exists:**

1. **Playwright network interception (`page.route`) + a translation shim** — intercept the
   `generativelanguage.googleapis.com` request Chromium makes, translate the Gemini-shaped request body
   into an OpenAI-shaped call to a local Ollama/llama.cpp server, translate the response back into
   Gemini's `candidates[0].content.parts[].text` shape, and `route.fulfill()` with it. **This is the only
   approach that keeps testing the real `askGemini`/`aiSeasonRec` code paths** — it never touches `app.js`,
   is entirely test-side, and is a small (~50–100 line) adapter, not a rewrite. **Effort: medium** (needs
   care around streaming vs non-streaming, the `thinkingConfig`/`generationConfig` fields the app sends
   that have no OpenAI equivalent, and keeping the shim in sync if `GEM_MODELS`'s request shape changes).
2. **Bypass the transport, call the local model directly from the eval script** — lower effort, but no
   longer exercises `askGemini`/`aiSeasonRec` at all; only useful for iterating on the **scorer/prompt
   design itself** (does `scoreNumericSafety`/`scoreRefusal` parse and gate correctly on a given piece of
   text), not the integration.

**Benefit:** genuinely useful for cheap, unlimited, deterministic **harness-correctness** iteration —
exactly the kind of regression the harness's own design doc calls out (`FIX 1`/`FIX 2`/`FIX 3` in the
runner comments were all harness bugs, not model behavior bugs, and none of them needed a real Gemini call
to catch). A local model via option 1 can smoke-test "does the whole pipeline run to completion and write
a scorecard" on every dev iteration, for free, without touching the `GEMINI_EVAL_KEY` rate/cost budget.

**Honest fidelity gap — explicitly not a substitute for the real baseline.** The harness's whole point
(per its own comments) is measuring a REAL model's grounding/refusal/numeric-safety behavior; a 7–32B
local model's refusal boundary, grounding fidelity, and Hebrew-language quality will differ substantially
from Gemini 2.5 Flash, and nothing in this project's safety design should ever be validated against a
local model's answers. **Use case: CI/dev-loop smoke test of the harness's own correctness (parsing,
timeouts, scorecard writing) — never a stand-in for the Task-5 baseline capture against the real model.**

---

## 4 · Voice pipeline test doubles (Whisper STT, local TTS)

**Grounded in the actual voice code** (`app.js`): STT is the **browser-native**
`SpeechRecognition`/`webkitSpeechRecognition` API (`vcToggleMic()`, `app.js:5385`) — Chrome's own cloud
speech service, not a Gemini call at all. TTS is a **mix**: most voice-cook narration uses the browser's
native `speechSynthesis` (`vcSpeakContent()` and others), while a separate `gemini-2.5-flash-preview-tts`
model is registered in `GEM_MODELS` for a premium-voice code path. **A grep of `tests/` for
`vcRec`/`SpeechRecognition` found zero matches — the voice/STT path currently has no Playwright coverage
at all.** This changes the honest framing: a local Whisper/TTS double isn't a drop-in replacement for an
existing test's model call (like Q3); it would be **new test infrastructure from scratch**.

**faster-whisper on the 3090 — strong fit, if this gets built.** Benchmarked publicly at RTF ≈0.08 on
large-v3 (≈12.5–12.9× real-time — a 60-minute file transcribes in ~4m40s) on an RTX 3090; VRAM footprint
for large-v3 is modest relative to 24 GB. **Notably, `faster-whisper` is already an optional dependency of
the installed graphify package itself** (`graphify/transcribe.py`, gated behind `pip install
graphifyy[video]`, model configurable via `GRAPHIFY_WHISPER_MODEL`, default `base`) — for graphing
recorded video walkthroughs, not for this use case, but it means the exact same dependency serves two
purposes if ever installed.

**What it would actually test.** Chromium's `SpeechRecognition` implementation in a Playwright-automated
browser typically has limited/unreliable support for real microphone audio without additional flags and a
live network path to Google's own speech service — **not verified in this research pass**. The realistic
test-double pattern is therefore **not** "feed real audio into the browser's own STT during a Playwright
run" but: (a) run faster-whisper **offline, outside the browser**, on a small library of recorded/synthetic
utterances (including realistic misrecognitions) to generate **text fixtures**, then (b) mock
`vcRec.onresult` in the page to inject that fixture text and assert the app's downstream handling (intent
parsing, `vcAskFlow`, etc.) — Whisper's role is generating *realistic* transcription-with-errors fixtures
offline, not literally replacing the browser API at test time.

**Local TTS for testing the Gemini-TTS code path:** Kokoro-82M (Apache 2.0, CPU-viable, "sounds clearly
better than Piper" per comparison sources, 9 languages) or Piper (lower latency, more robotic) could
generate local audio to test the app's TTS-consuming code, via the same `page.route` interception pattern
as Q3 — intercept the `gemini-2.5-flash-preview-tts` request, return locally-synthesized audio in the
expected response shape.

**Verdict: test-only, real but modest value, and honestly lower priority than §1/§3** — there is no
existing test infrastructure to extend (zero current voice tests), so this is a "build a new test
capability" project, not a "swap a target" one. Worth doing only once voice features get enough surface
area to justify dedicated test infrastructure; not a quick win today.

---

## 5 · Anything else genuinely useful for this project's dev loop

`gpu-dev-tools-landscape.md` already surveyed this ground broadly (semantic-code-search MCP servers,
local-RAG-over-docs MCP servers, i18n bulk-translation drafting via a local model, local VLMs for
screenshot pre-triage, Hebrew OCR — see that doc's shortlist and its "not worth it" list) and reached
well-reasoned verdicts I have no new evidence to overturn. This deep-dive surfaced one item that doc did
not cover, tying directly back to §1's centerpiece:

- **The BGE-M3 embedding sidecar (§1b) and the local extraction backend (§1a) are the two genuinely new
  findings this pass adds** beyond the other doc's survey — neither "graphify has a native ollama
  backend" nor "three unmerged community PRs already prototype graphify embeddings" were known before this
  research.
- The `mockups/walkthrough/` folder currently holds only PNG screenshots, no video — so graphify's
  `faster-whisper`-powered video ingestion (§4) is **not currently applicable**, just worth knowing it
  exists if a recorded walkthrough video is ever added to the docs corpus.

No other genuinely new category surfaced. I am not padding this section with items already covered
elsewhere — see the other doc for the full breadth survey.

---

## Prioritized shortlist

1. **Point graphify's `--mode deep` extraction at a local Ollama model for cheap/iterative re-extraction**
   (§1a). Zero wiring — env vars only. Start with `qwen2.5-coder:7b` (already graphify's default) to
   validate the pipeline end-to-end at near-zero VRAM risk, then step up to
   **Qwen2.5-Coder-32B-Instruct Q4_K_M** with a reduced `--token-budget` (8–16k, not the 60k default) for
   real quality. **Effort: low. Benefit: real (token/cost savings on iterative re-extraction). Risk: low**
   (opt-in via `--backend ollama`, never silently shadows the paid `claude-cli`/API backend).
2. **Build the embedding sidecar for `graphify query`** (§1b) — BGE-M3 via Ollama, cosine-similarity
   start-node selection layered on top of (not replacing) the existing BFS/DFS traversal. **Effort:
   low-medium. Benefit: directly closes CLAUDE.md's documented "no synonyms, no cross-language match"
   weakness — the single most concrete, well-scoped win in this whole report. Risk: low**, additive and
   read-only against the graph.
3. **Playwright `page.route` shim for the eval harness** (§3) — lets `evals/` be smoke-tested against a
   local model for harness-correctness without spending `GEMINI_EVAL_KEY` budget. **Effort: medium
   (schema translation). Benefit: moderate — dev-loop convenience, not a safety-validation substitute.
   Risk: low**, test-only code, never touches `app.js`.
4. **Voice test-double infrastructure** (§4) — genuinely useful but starts from zero existing coverage;
   lowest priority of the four, revisit once voice features grow enough to justify dedicated test
   infrastructure.

**Not recommended:** vLLM (wrong workload shape — no Windows story pays off for single-request use, per
§2 and per `gpu-dev-tools-landscape.md`'s independent agreement); waiting on any of the three upstream
graphify embedding PRs to land before doing anything (§1b) — no visible timeline and one shows signs of an
unresolved architectural disagreement, not a near-term merge.

---

## Deposit-worthy docs (not deposited — §10.11 usefulness gate)

Per the usefulness gate, these are general cross-project documentation candidates for the graphify global
graph. **Not deposited this session** (research-only task; a later batched pass should add them):

- **Ollama's OpenAI-compatibility + embeddings API docs** (`docs.ollama.com/capabilities/embeddings`,
  `ollama.com/blog/openai-compatibility`) — directly reusable any time a future project needs a local
  OpenAI-compatible serving substrate; this is now the second research doc in this repo alone that
  independently reached "Ollama is the right substrate," so the docs clearly have recurring value.
- **A "graphify local-backend + embedding status" note** — worth recording graphify's own `BACKENDS`
  config shape (ollama/openai/claude-compat env vars) and the three open/unmerged embedding PR numbers
  (#38, #424, #1126) somewhere durable, so a future session doesn't have to re-run the same `gh api`
  archaeology. This is arguably **project-specific** (about *our* installed tool version) rather than
  general vendor documentation, so it may not clear the "general cross-project value" bar for the global
  graph — flagging for the owner to decide rather than assuming either way.
- Hugging Face GGUF quant-size tables (bartowski's Qwen2.5-Coder-32B-Instruct-GGUF page) — reusable
  reference any time a future project needs to size a quantized model against a VRAM budget.

Not deposit-worthy: anything specific to this project's own code (`app.js`'s `gemFetch` schema, the eval
harness internals) — private to this repo, excluded by the "never this project's private documents" rule.

---

## Sources

**Primary — installed package source (read directly, not summarized from elsewhere):**
`~/.local/venvs/graphify/Lib/site-packages/graphify/llm.py`, `cli.py`, `dedup.py`, `_minhash.py`,
`transcribe.py`, `skills/claude/references/query.md`, `graphifyy-0.9.22.dist-info/METADATA`.

**Primary — GitHub (`Graphify-Labs/graphify`, public, read via `gh api`, read-only):**
- [Issue #1 — "v3: semantic query with embeddings"](https://github.com/Graphify-Labs/graphify/issues/1)
- [Issue #7 — "v0.4.0: local embeddings via quantized Gemma 4"](https://github.com/Graphify-Labs/graphify/issues/7)
- [Issue #38 — "feat(embed): Local embedding engine with dual backend support"](https://github.com/Graphify-Labs/graphify/issues/38)
- [Issue #198 — "Semantic layer is mostly disconnected from the AST graph"](https://github.com/Graphify-Labs/graphify/issues/198)
- [Issue/PR #424 — "feat: semantic query via sentence-transformers embeddings"](https://github.com/Graphify-Labs/graphify/issues/424)
- [Issue/PR #1126 — "feat: local embedding pass for exhaustive semantically_similar_to edges"](https://github.com/Graphify-Labs/graphify/issues/1126)

**Web (search-result syntheses, corroborated across multiple sources; re-verify before committing time):**
- [Ollama OpenAI compatibility blog post](https://ollama.com/blog/openai-compatibility)
- [Ollama embeddings docs](https://docs.ollama.com/capabilities/embeddings) (via search synthesis)
- [vLLM on Windows in 2026](https://fazm.ai/t/vllm-windows-support-2026)
- [Running LLMs on Windows: Native vLLM vs WSL vs llama.cpp](https://dev.to/alanwest/running-llms-on-windows-native-vllm-vs-wsl-vs-llamacpp-compared-37a9)
- [bartowski/Qwen2.5-Coder-32B-Instruct-GGUF](https://huggingface.co/bartowski/Qwen2.5-Coder-32B-Instruct-GGUF)
- [bartowski/Mistral-Small-24B-Instruct-2501-GGUF](https://huggingface.co/bartowski/Mistral-Small-24B-Instruct-2501-GGUF)
- [BAAI/bge-m3 model card](https://huggingface.co/BAAI/bge-m3)
- [nomic-embed-text-v2-moe](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe) / [announcement](https://simonwillison.net/2025/Feb/12/nomic-embed-text-v2/)
- [Whisper Large-v3 on RTX 3090 benchmark](https://gigagpu.com/whisper-large-v3-on-rtx-3090-benchmark/)
- [Kokoro vs Piper vs XTTS comparison](https://contracollective.com/blog/kokoro-vs-piper-vs-xtts-local-text-to-speech-m5-max-2026)

**Not verified in this pass (explicitly flagged, not assumed):** whether the environment's TLS-inspecting
proxy blocks `ollama pull`/Hugging Face downloads the same way it blocks `uv`; Hebrew retrieval quality of
BGE-M3/nomic-embed-v2-moe/multilingual-e5-large (no source found benchmarking Hebrew specifically);
whether Playwright-automated Chromium can drive `webkitSpeechRecognition` against real audio at all.
