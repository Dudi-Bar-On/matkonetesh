# GPU Dev-Tools Landscape — Breadth Survey (RTX 3090, 24 GB)

*Research only — no installs, no runs. Dated 2026-07-23. Re-verify versions/prices before piloting; this
space moves monthly.*

## Method note (§10.11)

Queried the graphify **global** graph (`~/.graphify/global-graph.json`, corpora: `vendor-docs` 2435 nodes,
`methodology` 4335 nodes, `gemini-api-docs`, `cloudflare-workers-docs`) for: `ollama`, `vllm`, `lm studio`,
`llama.cpp`, `embedding`, `MCP server`, `semantic code search`, `faiss`, `chroma`, `cuda`, `GPU`,
`vector database`, `Serena`, `sourcegraph`, `ctags`, `tree-sitter`, `RAG`. **Miss.** The graph has no
vocabulary for local-LLM/GPU-dev tooling — the few hits that came back (`lm studio`→`visual-ai-studio`,
`vector database`→`Slopsquatting Hallucination Vector`) were case-folded substring false positives on
unrelated project memory, not real documentation. Per §10.11 this is a genuine miss, not a dead end — web
research follows below, and the **usefulness gate** verdict per source is in [Deposit-worthy docs](#deposit-worthy-docs-not-deposited) at the end. Nothing was added to the graph in this session (research only).

## Environment recap

Windows 11 · RTX 3090 24 GB · 32 cores · dev agent = **Claude Code** (this harness, MCP + plugins
already wired — Serena for LSP symbol nav, `graphify` for the substring-matched knowledge graph,
Playwright + chrome-devtools MCP for browser verification). Repo has 260+ mockup/screenshot PNGs, a
Hebrew-first RTL single-file PWA (`app.js`+`app.css`+Python data layer → `dist/index.html`), and a
141-gap analysis doc + multiple research reports as its docs corpus.

---

## 1 · Local-LLM MCP servers (offload bulk work to the GPU)

| Tool | GPU needed? | Fits env? | Worth it for THIS project? |
|---|---|---|---|
| **OllamaClaude** ([Jadael/OllamaClaude](https://github.com/Jadael/OllamaClaude)) | Benefits (Ollama does the inference) | Yes — Windows, MCP stdio | **Marginal.** Generic "Claude delegates to Ollama" bridge. No task-shaping — the delegation discipline (what's safe to hand off) is on you. |
| **mcp-local-llm** ([aplaceforallmystuff](https://github.com/aplaceforallmystuff/mcp-local-llm)) | Benefits | Yes | **Narrow yes** — see shortlist #3. Purpose-built for "Claude thinks, local model drafts" (summarize/classify/extract/transform), which maps onto one real task this project has coming: bulk fr/de/es translation-candidate generation for the i18n roadmap. |
| **ollama-mcp-bridge** ([patruff](https://claudemarketplaces.com/mcp/patruff/ollama-mcp-bridge)) | Benefits | Yes | **Redundant** with the two above — same pattern, no differentiator found. |
| **rawveg/ollama-mcp** ([mcpservers.org](https://mcpservers.org/servers/rawveg/ollama-mcp)) | Benefits | Yes | Same category, general chat-passthrough. No. |

**Honest verdict on the whole category:** the main agent here is already a remote frontier model
(Claude Sonnet 5 via Claude Code) operating under a strict TDD/DoD discipline (`CLAUDE.md` §3, §4). A
7B–30B local model producing code changes that must clear the same 12-point DoD gate mostly **doesn't
save review effort** — it moves the authoring cost off the API bill but keeps (or adds) verification
cost, and this project's process explicitly forbids shortcuts on verification. The one place delegation
is a clean win is **non-code bulk drafting with a human/agent review step already in the workflow** —
translation strings, not application logic. Treat this as a scoped tool for that one job, not a general
"cheap coding" pipeline.

## 2 · Embedding / semantic-code-search MCP servers — the most likely real win

This is the category that composes with what's already here: `graphify` matches by **case-folded
substring only** (own admission, §10.11) and Serena does **exact LSP symbol** lookup (deterministic,
not fuzzy). Neither answers "where do we handle the thing that's *like* this, worded differently."

| Tool | GPU needed? | Fits env? | Worth it for THIS project? |
|---|---|---|---|
| **semantic-search-mcp** ([adam-hanna](https://github.com/adam-hanna/semantic-search-mcp)) | **Optional** — CUDA auto-detected (`pip install semantic-search-mcp[gpu]`), also DirectML on Windows; runs fine on CPU with quantized models | **Yes** — Python 3.11+, `uv tool install` or `pip install`, single `.mcp.json` entry, Windows explicitly supported | **Yes — top pick.** Jina code-embedding model (`jina-embeddings-v2-base-code`, 768-dim) + Tree-sitter across 165+ languages + hybrid vector/keyword search + incremental indexing respecting `.gitignore`. Fills the exact gap: fuzzy semantic search over `app.js`, `data.py`, `sources.py`, tests. |
| **knowledge-rag** ([lyonzin](https://github.com/lyonzin/knowledge-rag)) | Optional — CUDA 12 gives 5–10× faster indexing, falls back to CPU cleanly | Yes — npx/pip/one-line installer explicitly covers Windows, or Docker with pre-baked models | **Yes — second pick, for docs not code.** Hybrid semantic + BM25 + cross-encoder reranking over 20 file formats (md/pdf/code/notebooks). Point it at `docs/` (the 141-gap doc, the four Wave-4 research reports, `docs/process/`) — the corpus graphify can miss on wording. |
| **rag-code-mcp** ([doITmagic](https://github.com/doITmagic/rag-code-mcp)) | Needs a running Ollama model + Qdrant | Yes, but heavier stack (Ollama + Qdrant server) | **No for now.** Deep AST support is nice but the added infra (a vector DB server + a local LLM daemon) is more moving parts than this project's current scale justifies. Revisit if `semantic-search-mcp` proves the pattern and the repo grows. |
| **smart-coding-mcp** ([omar-haris](https://github.com/omar-haris/smart-coding-mcp)) | Local, Matryoshka embeddings (64–768d) | Likely | **No** — no clear edge over `semantic-search-mcp`; smaller community, less documentation found. |
| **Code-Index-MCP** ([ViperJuice](https://github.com/ViperJuice/Code-Index-MCP)) | **None needed** — tree-sitter + BM25 + symbol table by default; embeddings are optional and cloud (Voyage AI) if enabled | Yes | **Worth knowing about, not worth adding.** This is the "Serena-shaped" alternative — deterministic symbol/BM25 index, sub-100ms lookups, no GPU story at all. If the goal were pure speed on exact/near-exact queries, this beats a GPU embedding server on cost and simplicity; it doesn't solve the fuzzy-retrieval gap though. |

**Honest caveat that cuts against the "GPU" framing:** every one of these uses small ONNX/ FastEmbed
models (33 MB–700 MB) designed to run acceptably on CPU. The 3090 buys **faster reindexing**
(5–10× per `knowledge-rag`'s own numbers), not the difference between usable and unusable — at this
project's size (single-file PWA, not a monorepo), a CPU-only cold index likely finishes in well under a
minute. The GPU is a nice-to-have here, not the reason to adopt the tool. The reason to adopt it is the
retrieval gap itself.

## 3 · Local-model serving stacks (the substrate)

| Tool | GPU needed? | Fits env? | Worth it for THIS project? |
|---|---|---|---|
| **Ollama** | Uses it automatically (CUDA) if present | **Best fit** — native Windows installer, `/v1` OpenAI-compatible endpoint on `localhost:11434`, one-line `ollama pull`, is the default backend every MCP bridge above targets | **Yes — the substrate to use** if piloting #1 or #2. Lowest setup friction of the four. |
| **LM Studio** | Uses it automatically | Native Windows app, GUI model browser + local OpenAI-compatible server mode | **Situational yes** — good for interactively trying/comparing models by hand; less suited to being scripted into an agent pipeline than Ollama. Use for manual exploration, not automation. |
| **vLLM** | **Needs** it to pay off (PagedAttention/continuous batching only wins at 10+ concurrent requests) | **Poor fit.** No official Windows support as of mid-2026 — options are WSL2, Docker Model Runner (WSL2 backend), or unofficial community wheels (`SystemPanic/vllm-windows`). Its whole value proposition (16–20× Ollama's *concurrent* throughput) is a multi-user production-serving story. | **No.** This is a solo-developer project issuing one request at a time — vLLM's win condition never triggers, and its Windows story adds real friction (WSL2/Docker) for zero benefit here. |
| **llama.cpp** | Uses it | Native Windows builds exist, most control/least convenience | **No, not standalone** — Ollama already wraps llama.cpp with a far friendlier interface; only reach for raw llama.cpp if you need a CLI flag Ollama doesn't expose. |
| **Jan** | Uses it automatically | Native Windows desktop app, actively maintained in 2026 (v0.7.9, 5.3M downloads), OpenAI-compatible endpoint at `localhost:1337` | **No differentiator over Ollama/LM Studio for this project** — a third GUI option; skip unless the other two don't suit. |
| **text-generation-webui** | Uses it | Not deep-dived here — historically more chat/roleplay-UX oriented than a dev-tool backend; did not surface as a 2026-current recommendation in this survey | **Not researched deeply enough to rate — flag as unverified, skip rather than guess.** |

## 4 · GPU-accelerated code/test/build tooling — mostly marketing, say so

| Tool/claim | GPU needed? | Fits env? | Worth it for THIS project? |
|---|---|---|---|
| Visual-regression image diffing (pixelmatch, odiff, resemble.js, BlazeDiff) | **No** — all are CPU/SIMD (odiff: Zig+SIMD, 8× pixelmatch; BlazeDiff: Rust+wasm SIMD, 3–8×) | Playwright's built-in `toHaveScreenshot()` already uses pixelmatch | **No GPU angle exists in this space at all.** At this project's screenshot volume (260+ PNGs, not tens of thousands), CPU/SIMD diffing already finishes near-instantly — there is nothing for a GPU to accelerate. Don't chase this. |
| Static analysis / linting (Oxlint, Biome, Ruff, etc.) | **No** — the 2026 speed wins are from Rust rewrites (50–155× over legacy CPU tools), not GPU | N/A | **No.** No GPU-accelerated linter or SAST tool surfaced in research; the category doesn't exist commercially. |
| Build/transpile (esbuild/swc-class tools) | No | N/A | **No** — this repo's `build.py` is a Python string-inlining step; there is no transpile step a GPU could touch. |
| Code indexing | Covered in §2 | — | See §2. |

## 5 · Local coding-assistant models (editor completion)

| Tool | GPU needed? | Fits env? | Worth it for THIS project? |
|---|---|---|---|
| **Continue.dev** (VS Code/JetBrains ext.) | Needs 8 GB+ VRAM min for a usable local model; 3090's 24 GB comfortably runs a 7B completion model + 14B chat model simultaneously | Windows-supported, talks to Ollama/LM Studio/Jan over their OpenAI-compatible endpoints | **No for this project.** Continue integrates with an IDE's inline-completion loop, not with Claude Code. Almost all development here happens through the agent (Claude Code), not manual IDE typing — there's no completion loop for Continue to plug into. |
| **Tabby** (self-hosted Copilot alternative) | 7B–13B models want a 30-series-class GPU; 3090 is well above the bar | Rust binary, native Windows support, 12+ IDEs | **No, same reason.** Real-time inline completion is not this project's workflow. |

**Honest verdict:** this whole category answers a different question than the one this project has —
it's for developers hand-typing in an IDE and wanting Copilot-style suggestions. This repo's actual
workflow is agent-driven (Claude Code end to end). Skip unless the owner starts doing meaningful manual
coding outside the agent loop.

## 6 · Vision / OCR tools (relevant to a screenshot-heavy Hebrew PWA)

| Tool | GPU needed? | Fits env? | Worth it for THIS project? |
|---|---|---|---|
| Local VLMs — Qwen2.5-VL/Qwen3-VL, MiniCPM-V 2.6, InternVL 2.5 | Runs at 4-bit in ~6–12 GB VRAM; 3090 has ample headroom | Ollama-pullable, Windows-fine | **Marginal, situational yes.** Strong at GUI/UI screenshots and code screenshots per current guides. Could pre-triage the `mockups/`/`walkthrough/` folders (260+ images) to flag likely-broken layouts before the frontier agent does the DoD-mandated close look (§3.8/§3.9) — a cost-saving *pre-filter*, never a replacement for it, since the DoD explicitly requires the agent to actually look. Not worth building today; worth revisiting if screenshot volume becomes a bottleneck. |
| Hebrew OCR (Tesseract `heb`, EasyOCR, PaddleOCR) | PaddleOCR benefits heavily from GPU (≈120 pages/min on a 3090 vs CPU-only Tesseract); EasyOCR benefits some | PaddleOCR on Windows works but is the heaviest dependency (PaddlePaddle) | **No — solves a problem this project doesn't have.** None of the three ships a strong pretrained Hebrew model (research consistently found Hebrew absent from EasyOCR/PaddleOCR/MMOCR's out-of-the-box language lists; Tesseract's `heb` pack is reported inaccurate) — closing that gap needs custom fine-tuning, real effort for a low-value payoff. More importantly, **the DoD (§3.9) already requires the frontier agent to read Hebrew screenshots directly** via its own vision — that's higher-fidelity than OCR text extraction and is already the mandated process. OCR would be a downgrade, not an upgrade. |

## 7 · Anything else surfaced

- **NVIDIA TensorRT-LLM** — production-grade high-throughput serving on NVIDIA hardware. Same shape of
  mismatch as vLLM: built for multi-user production serving, not a solo dev's single-request workflow.
  Setup complexity far exceeds any plausible payoff here. **No.**
- **i18n bulk-translation drafting** is the one concrete "anything else" that scored as a genuine win —
  covered as shortlist item #3 below, not a separate tool but a *use* of the local-LLM-MCP category (§1)
  narrowly scoped to a task this project's own roadmap (fr/de/es expansion per the UX-roadmap memory)
  already needs done in bulk with review, which is exactly the shape local delegation is good at.

---

## Shortlist — 3 tools genuinely worth piloting

### 1. `semantic-search-mcp` — semantic search over the code (the single most promising item)

**What:** MCP server exposing semantic + keyword hybrid search over the repo's code, using local Jina
code embeddings (FastEmbed/ONNX) and Tree-sitter parsing.

**Setup outline:**
1. `uv tool install semantic-search-mcp` (or `pip install semantic-search-mcp[gpu]` to opt into CUDA).
2. Add one entry to `.mcp.json` alongside the existing Serena entry:
   `{"mcpServers": {"semantic-search": {"command": "semantic-search-mcp"}}}`.
3. First run indexes the repo (Tree-sitter parse + embed); GPU accelerates this pass but CPU works.
4. Query in natural language ("where do we clamp cook temperature for sous-vide") from within a Claude
   Code session; compare hit quality against a `graphify query` on the same question.

**Honest expected payoff:** closes a real gap — graphify's substring matcher and Serena's exact-symbol
LSP tools both miss "conceptually related, differently worded" code. The 3090 makes indexing/reindexing
fast (seconds, not minutes) but the tool is CPU-viable, so the GPU is a speed multiplier, not an
enabler. Pilot it against 3–5 real "find the code that does X" questions from recent work before
deciding to keep it long-term; if hit quality doesn't beat a well-phrased `graphify query`, drop it —
don't keep two overlapping retrieval tools out of inertia.

### 2. A local-RAG MCP over `docs/` (e.g. `knowledge-rag`) — semantic search over the docs corpus

**What:** Same idea as #1, aimed at prose instead of code — the 141-gap doc, the four Wave-4 research
reports, `docs/process/`, `docs/sources/baldwin-backbone.md`.

**Setup outline:**
1. Install per the project's Windows-covered installer (`npx -y knowledge-rag`, or the one-line
   `install.sh`, both listed as Windows-compatible).
2. Point it at `docs/` (exclude `docs/research/*.md` version-churn noise if reindex cost matters, or
   don't — the corpus is small).
3. Query in Claude Code: `search_knowledge("what did we decide about the mode-switcher")` and compare
   against a `graphify query` / plain grep on the same question.

**Honest expected payoff:** same shape of win as #1 but for docs — genuinely useful when a doc's wording
doesn't match the query's wording, which is common across a corpus this large and this old (141 gaps,
multiple research waves). CUDA gives 5–10× faster indexing per the tool's own numbers; at this corpus
size that's the difference between a few seconds and under a minute — nice, not decisive. Pilot the same
way: a handful of real "what did we decide" queries, compare against existing tools, keep only if it
wins.

### 3. `mcp-local-llm` (or equivalent Ollama-MCP bridge) scoped **only** to bulk i18n translation drafting

**What:** MCP bridge that lets Claude Code hand a mechanical task (draft, don't decide) to a local model
served by Ollama (e.g. Qwen3-Coder-30B, ≈73 tok/s on a 3090 per community benchmarks), with Claude
reviewing/correcting the output.

**Setup outline:**
1. Install Ollama (native Windows installer), `ollama pull qwen3-coder:30b` (or a general-purpose
   multilingual model — translation isn't a coding task, so a coding-specialist model isn't obviously
   the right pick; benchmark against a general instruct model before committing).
2. `pip install mcp-local-llm` (or equivalent), add to `.mcp.json`, point it at Ollama's local `/v1`
   endpoint.
3. Use it **narrowly**: generate first-pass fr/de/es translation candidates for UI strings per the
   i18n-roadmap memory; every candidate still goes through the same review/verification path (Hebrew
   check equivalent for target languages, TDD, DoD) as any other change before it ships.

**Honest expected payoff:** real but narrow. This is the one place in the whole survey where "cheap
local model does grunt work, frontier model reviews" cleanly fits the project's actual near-term
roadmap (multi-language expansion) without touching application logic or safety values. It is explicitly
**not** a general "delegate coding tasks to save tokens" pattern — this project's DoD/Waiver-Gate
discipline (§3, §4) means a local model's code changes still need the full gate, which erodes most of
the token-savings case. Keep the scope to draft-text generation with mandatory human/agent review, not
code.

---

## Categories NOT worth it for this project (say so plainly)

- **vLLM and TensorRT-LLM** — production multi-request serving stacks; this is a single developer issuing
  one request at a time. Their entire value proposition never triggers here, and vLLM's Windows story
  (no official support, WSL2/Docker/unofficial wheels) adds friction for zero benefit.
- **Local coding-assistant IDE completions (Continue.dev, Tabby)** — solve inline-completion-in-an-editor,
  a workflow this project doesn't have; nearly all development here runs through Claude Code, not manual
  typing in VS Code/JetBrains.
- **GPU-accelerated image diffing for visual regression** — does not exist as a real category; the
  fastest tools in this space (odiff, BlazeDiff) already win via CPU SIMD, and Playwright's built-in
  pixelmatch-based diffing is already sufficient at this project's screenshot volume.
- **GPU-accelerated static analysis / linting / build tooling** — does not exist as a real category;
  2026's speed gains in this space come from Rust rewrites (Oxlint et al.), not GPUs.
- **Hebrew OCR** — solves a problem this project doesn't have. The DoD already mandates the frontier
  agent read Hebrew screenshots directly with its own vision (§3.9), which is higher-fidelity than OCR
  text extraction, and no OCR engine surveyed ships a strong pretrained Hebrew model anyway.
- **General-purpose "delegate coding to a local model" tooling (§1, beyond the narrow i18n use)** — the
  project's TDD/DoD/Waiver-Gate discipline means locally-authored code still needs full review and
  verification; the token-cost savings mostly evaporate once that gate is honestly applied.

---

## Deposit-worthy docs (not deposited)

Per §10.11's usefulness gate, these are general-value, cross-project documentation candidates for the
global graph — **not deposited this session** (research-only task):

- Ollama's OpenAI-compatible API docs (substrate for #1–#3 above; broadly reusable across any future
  project wanting a local-model bridge).
- `semantic-search-mcp` README/docs (concrete MCP-server-over-embeddings pattern, reusable wherever the
  next project has the same graphify-substring / Serena-exact gap).
- A general "Ollama vs LM Studio vs vLLM vs llama.cpp" decision-matrix page (there were several
  reasonable 2026 comparison posts found; any one clear one would save re-deriving this table next time).

None of this project's own analysis, research reports, or anything containing a key qualifies for
deposit — this list is external tool documentation only, per the "never this project's private
documents" rule.

---

## Sources consulted

Web search only (graphify global graph miss, documented above). Key pages read in full:
[adam-hanna/semantic-search-mcp](https://github.com/adam-hanna/semantic-search-mcp) ·
[lyonzin/knowledge-rag](https://github.com/lyonzin/knowledge-rag). All other findings are search-result
syntheses (multiple corroborating sources per claim) rather than full-page reads; version numbers and
tokens/sec figures are as reported by community sources in mid-2026 and should be re-verified before
committing time to a pilot.
