# GPU + CPU utilization — synthesized decision report

**Date:** 2026-07-23 · **Status:** DECISION-READY (research complete; implementation queued **after** the AI-model migration) · **Hardware:** NVIDIA RTX 3090 (24 GB VRAM, idle) + 32 logical CPU cores, Windows 11.

Draws on three research missions (all research-only, no installs):
`docs/research/gpu-local-model-integration.md` (A) · `docs/research/cpu-32-core-utilization.md` (B) · `docs/research/gpu-dev-tools-landscape.md` (C).

---

## The honest headline

**For the *core* dev loop, neither the GPU nor "more cores" changes much** — the coding agent runs on Anthropic's servers (remote), `build.py` is sequential I/O, and graphify's AST extraction already uses all 32 cores. The genuine wins are in **two narrow places**:
1. **The AI/knowledge-tooling layer** → the RTX 3090 (local models + embeddings).
2. **One CPU lever** → Playwright's worker count (currently under-set at 10 of a possible ~16–20).

Everything else surveyed was honestly ruled **not worth it** (see the skip list).

---

## Ranked opportunities

| # | Opportunity | Hardware | Effort | Payoff | Verdict |
|---|---|---|---|---|---|
| 1 | **graphify local extraction backend** — point `graphify extract --mode deep` at Ollama (`--backend ollama`) or any OpenAI-compatible local server. | GPU | **Low** (env vars only — natively supported, confirmed from graphify source) | Free/offline/unlimited re-extraction; no API cost, no rate limits, no TLS-proxy grief on the *extraction* call | **DO — top pick** |
| 2 | **Playwright workers 10 → 16–20** (re-measure). Both old blockers are gone (clustered server + `navigationTimeout:60s`). | CPU | **Low–Med** (measurement: 12→16→20→24, 9× serialized each) | Potentially **~halves** the 1.9-min suite → faster every task + every future dev cycle | **DO — post-migration** |
| 3 | **Embedding semantic search for retrieval** — either `semantic-search-mcp` (local Jina code embeddings, Windows-native, one `.mcp.json`) or a small graphify embedding sidecar (BGE-M3 via Ollama). | GPU | **Med** | Fixes graphify's "substring-only, returns noise" weakness; composes with Serena (exact LSP) — the three tools become a real code+docs retrieval stack | **STRONG CANDIDATE** |
| 4 | **Eval harness local target** — a `page.route` shim so `evals/` can be smoke-tested against a local model without spending `GEMINI_EVAL_KEY`. | GPU | **Med** | Cheaper harness-correctness iteration (never a substitute for the real Gemini baseline) | **NICE-TO-HAVE** |
| 5 | **Ollama for bulk i18n translation drafting** — scoped to the planned fr/de/es expansion. | GPU | **Low** | Draft-quality translations offline; still need review | **DEFER to i18n work** |

**Recommended local-serving stack: Ollama** — native Windows, headless background service, one tool serves *both* the chat/extraction model and the embedding model, and it's the substrate graphify's own defaults already assume. **vLLM is ruled out** (no official Windows support; its value needs 10+ concurrent requests, which a solo workflow never triggers).

**Model choices for 24 GB:** extraction — a quantized 14–32B instruct model (Qwen2.5-32B-Instruct-q4, Mistral-Small, Llama-3.x); embeddings — BGE-M3 (multilingual, matters for Hebrew) or nomic-embed.

---

## What to SKIP (surveyed and honestly rejected)

- **vLLM / TensorRT-LLM** — no Windows support; built for concurrent production serving, not a solo dev.
- **Local IDE coding assistants** (Continue.dev / Tabby) — nearly all dev here runs through the agent, not manual IDE typing.
- **"Delegate coding to a local model to save tokens"** — this project's TDD/DoD/Waiver-Gate discipline means local-model output still needs full review, eroding the savings.
- **GPU-accelerated visual-regression image diffing** — not a real category; CPU SIMD (odiff) + Playwright's pixelmatch already suffice at this screenshot volume.
- **GPU-accelerated static analysis / linting / build** — 2026 speed gains come from Rust rewrites, not GPUs.
- **Hebrew OCR** — solves a non-problem; the agent reads Hebrew screenshots directly via its own vision (higher fidelity than OCR).
- **Test sharding across cores** — a real lever but it *reverses* the "never run two suites concurrently" rule; not recommended as a default.

---

## Honest caveats (unverified in research-only passes — verify before committing effort)

1. **TLS-inspecting proxy.** `uv` needed `--native-tls` to download from GitHub/PyPI. `ollama pull` / HuggingFace weight downloads may hit the **same** cert-validation wall. This is the #1 unknown gating opportunities 1/3/4 — must be tested first.
2. **Hebrew retrieval/embedding quality** — no benchmark found for the candidate embedding models on Hebrew specifically; matters for a Hebrew-first corpus.
3. **graphify embedding search is NOT shipped** (v0.9.22, verified from source) — three community PRs target it but none merged, so #3 means a sidecar/MCP, not a graphify flag.
4. **Voice test doubles** — unclear whether Playwright-driven Chromium can exercise `webkitSpeechRecognition` against real audio.

---

## Recommended sequence (all AFTER the migration)

1. **Verify the proxy question** — a 15-minute test: `ollama pull` a small model; does it download or hit the cert wall? This gates everything GPU.
2. **If downloads work → Ollama + graphify local backend (#1)** — cheapest, highest-value; makes the owed §10.12 graph updates free/offline.
3. **Playwright worker re-measure (#2)** — independent of the GPU; halving suite time compounds across all remaining work.
4. **Then evaluate #3 (embedding search)** — the highest-ceiling item, but more effort; decide after #1 proves the local-model plumbing works here.

---

## Decisions for the owner
- **Which to pilot first?** (Recommend: the proxy test → #1 + #2 as a cheap opening pair.)
- **Pursue #3 (embedding semantic search)** — `semantic-search-mcp` vs a graphify sidecar — or hold?
- **Confirm the skip list** — anything there you want reconsidered?

*No production or migration code was touched by this research.*
