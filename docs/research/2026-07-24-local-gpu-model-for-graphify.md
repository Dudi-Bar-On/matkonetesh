# Local GPU model for graphify `--mode deep` — root causes, benchmark, wiring

**Date:** 2026-07-24 · **Status:** COMPLETE — a local model **passed** and graphify is wired to it.
**Mission:** find a local LLM that runs on this machine's GPU and is good enough to drive graphify's
`--mode deep` extraction, wire graphify to use it, then find further ways to use the GPU.

**Headline:** `qwen3:30b-a3b-instruct-2507` (Q4_K_M, served by Ollama as a capped variant
`graphify-extract`) produces **137 nodes / 179 edges** on a real repo chunk against `claude-cli`'s
**165 / 185** — **83 % of the nodes, 97 % of the edges, in 17 % of the wall time** (2 m 30 s vs
14 m 18 s), at **$0**, entirely on the RTX 3090.

**Both prior failures were misdiagnosed.** `qwen2.5-coder:7b` really is too weak (confirmed) — but
`qwen2.5-coder:14b` was **wrongly blamed**: it completes the same input in 27 s. The "timeout" is an
**Ollama/graphify integration defect** that makes generation unbounded, and it would have hit *any*
model.

---

## 1 · Hardware ground truth (measured, not assumed)

| Item | Value |
|---|---|
| GPU | **NVIDIA GeForce RTX 3090**, WDDM driver model |
| VRAM | **24,576 MiB total**; ~2,000–3,500 MiB held by the Windows desktop at idle → **~21–22 GB usable** |
| Driver / CUDA | **591.86** / CUDA **13.1** |
| Disk free | **1.6 TB** on `C:` (never a constraint; all pulls together used ~120 GB) |
| Ollama | **0.32.3**, native Windows, background service on `localhost:11434` |
| Pull bandwidth | **264 MB/s** — an 18 GB model pulls in **88 s**. No TLS wall on `ollama pull` |

`curl` to `ollama.com` **does** hit the org TLS-inspecting proxy (`HTTP 000`) and needs
`--ssl-no-revoke`; `ollama pull` itself is unaffected. This confirms the prior report's finding from the
opposite direction: the proxy breaks bundled-CA clients, not Ollama's own downloader.

**The desktop's ~2–3.5 GB matters.** It is the difference between a 19 GB model fitting at 100 % GPU and
spilling. `granite4.1:30b` asked for **26 GB** and ran at **14 %/86 % CPU/GPU** — measured, and the reason
it is excluded below.

---

## 2 · Root cause of the two prior failures

### 2a · `qwen2.5-coder:7b` → "0 edges" — **model capability. Prior verdict CONFIRMED.**

Reproduced exactly, using graphify's own `_call_openai_compat` on the same corpus
(`~/.graphify/vendor-sources/nodejs-v8-docs`, 2 files, 6,969 words):

```
nodes=2  edges=1  output_tokens=330  finish_reason=stop  wall=8.3s
```

The output is the recorded signature verbatim — one "this file exists" node per document plus a single
`cites` edge between them. Deterministic: **identical (1,140 raw chars) across 4 runs** — 2 streaming,
2 non-streaming.

**What was ruled out, each with evidence:**

| Hypothesis | Verdict | Evidence |
|---|---|---|
| Context truncation / small `num_ctx` | **REFUTED** | `input_tokens = 9,814`, the whole input; `ollama ps` `CONTEXT 32768` |
| VRAM pressure / CPU spill | **REFUTED** | peak **6.6 GB of 24 GB**, `100% GPU` throughout |
| Output-token cap | **REFUTED** | `finish_reason = "stop"`, not `"length"` — the model *chose* to stop at 330 tokens |
| Streaming vs non-streaming | **REFUTED** | single-variable A/B: byte-identical output in both arms |
| Prompt-format mismatch | **REFUTED** | it emits well-formed schema-conformant JSON — just almost empty |
| **The `source_file` prompt defect (PASS 3 BUG (c))** | **REFUTED** | A/B of BASE vs PATCHED prompt: **2 nodes in both arms**, `bad_source_file = 0` in both. 7b was already attributing correctly; the omitted rule was never its problem |

**Conclusion:** at 7B, the model satisfies graphify's schema at *file* granularity and stops. It is not
mis-configured; it is too weak to decompose a document into entities. `qwen2.5-coder:14b` scores the same
way (2 nodes) — so **14b also fails on quality**, just not for the reason recorded.

> **A methodological correction, recorded rather than quietly dropped.** My first replay appeared to show
> 7b producing **43 nodes / 41 edges** — an apparent refutation of the prior report. It was
> **contamination**: I had globbed the whole corpus directory, which included the `graph.json` produced by
> the earlier successful `claude-cli` run. The model was copying the answer key — **42 of 43 node IDs and
> 43 of 43 labels came straight out of that file**. Every later run filters to `.md/.txt/.rst`. The prior
> report was right and I was briefly wrong.

### 2b · `qwen2.5-coder:14b` → "timed out twice" — **NOT the model. An unbounded-generation defect.**

**`qwen2.5-coder:14b` completes the identical input in 27–29 s at 61 tok/s, 100 % GPU, 15 GB.** It never
had a speed problem. Three candidate mechanisms were tested and refuted before the real one was found:

| Hypothesis | Verdict | Evidence |
|---|---|---|
| VRAM co-residency (graphify sets `keep_alive=30m`, so 7b stays loaded while 14b loads → spill) | **REFUTED** | Direct experiment: 14b alone **27.0 s**; 14b immediately after a 7b run **27.7 s**. Ollama evicts cleanly; `ollama ps` shows only one model, `100% GPU` in both arms |
| Generation simply slower than the 600 s timeout | **REFUTED** | 27 s measured, 22× inside the timeout |
| Model too large for the card | **REFUTED** | 15 GB of 24 GB, `100% GPU` |

**The actual root cause — proven by direct parameter test:**

**Ollama 0.32.3's `/v1/chat/completions` endpoint silently ignores the output cap graphify sends.**

```
model=qwen2.5:0.5b   cap=20 tokens   prompt="Count from 1 to 400..."
none (control)             completion_tokens=292  finish=stop     CAP_ENFORCED=False
max_completion_tokens=20   completion_tokens=292  finish=stop     CAP_ENFORCED=False   <-- what graphify sends
max_tokens=20              completion_tokens=20   finish=length   CAP_ENFORCED=True
num_predict=20 (options)   completion_tokens=292  finish=stop     CAP_ENFORCED=False
```

graphify's `_call_openai_compat` sends **`max_completion_tokens`** (llm.py — the modern OpenAI field) and
**never** `max_tokens`. On this endpoint that means **there is no output bound at all**.

The same path also discards `extra_body.options` entirely — verified separately: requesting
`num_ctx=8192`, `num_ctx=16384`, and no options at all **all** yield `ollama ps CONTEXT 32768`. So on the
ollama backend:

- graphify's `num_ctx` auto-derivation — its own fix for the #798 "hollow response" trap — is **inert**;
- `GRAPHIFY_OLLAMA_KEEP_ALIVE` is **inert** (observed: `UNTIL 4 minutes from now` in every arm despite `30m`);
- the output cap is **inert**.

**How that produces the recorded symptom.** With no output bound, a model that enters a repetition loop
never stops. llama.cpp then applies **context shift** and recycles the window forever:

```
slot operator(): id 0 | task 265 | slot context shift, n_keep = 5, n_left = 32762, n_discard = 16381
slot print_timing: id 0 | task 265 | n_decoded = 61692, tg = 39.29 t/s
```

**61,692 tokens generated against a nominal 16,384 cap.** The runaway holds the model slot, so Ollama can
never unload it — `ollama ps` reports **`Stopping...` indefinitely** — and every subsequent request
starves.

**Reproduced end-to-end:** `mistral-small:24b` entered exactly this loop (244 identical
`"relation": "calls"` edges, 88 KB of unparseable output). The *next* model in the queue,
`qwen2.5-coder:32b`, then returned **0 bytes after exactly 600 s** while `ollama ps` showed
`mistral-small … Stopping...`. That is the prior report's *"idle-GPU 'Stopping...' state in `ollama ps`
with no output after ~25+ minutes"*, verbatim.

Recovery required killing the server **and** two orphaned `llama-server.exe` runners still pinning
23,965 MiB — the orphan-holding-the-resource failure mode CLAUDE.md §11a already warns about.

**Verdict: a model rejected for the wrong reason.** The timeout was an integration defect that would
have struck any model verbose enough to loop. `qwen2.5-coder:14b` is still not good enough — but on
**quality** (2 nodes), not speed.

---

## 3 · The acceptance bar (defined before ranking, measured against `claude-cli` on identical input)

graphify does **not** use structured output on the ollama path — there is no `response_format` anywhere in
`_call_openai_compat`; the JSON contract is carried by prompt text alone. (By contrast the `claude-cli`
backend **does** pass `--json-schema`. That asymmetry disadvantages every local model and is worth
raising upstream.) So schema adherence is entirely an instruction-following property of the model.

A candidate **passes** only if, on the *same corpus and the same chunking* as the `claude-cli` reference:

1. **Parseable** — output survives `_parse_llm_json` (fences tolerated; prose-wrapped JSON tolerated).
2. **Granular** — real entities, not one node per file. *This is the bar 7b/14b fail.*
3. **≥ 50 % of the reference node count**, and **≥ 50 % of the reference edge count**.
4. **0 dangling edges** (no edge naming an undefined node).
5. **Completes inside graphify's 600 s per-chunk timeout.**
6. **Fits 24 GB at `100% GPU`** — any CPU spill in `ollama ps` is a fail.

**Reference (`claude-cli`, model `sonnet`, generated from a NEUTRAL cwd):** 165 nodes / 185 edges /
25 communities / 0 dangling, 14 m 18 s.

> **The reference had to be generated carefully.** Per PASS 3 HAZARD (b), graphify's `claude-cli` backend
> calls `subprocess.run` **without `cwd=`**, so the nested `claude -p` inherits the caller's directory and,
> from the repo root, loads the project `CLAUDE.md` and stops behaving as an extractor. Every reference
> here was produced with the driver `chdir()`-ed to a neutral scratch directory (asserted at runtime:
> no `CLAUDE.md`, no `AGENTS.md`, no `.claude` in cwd) with absolute corpus paths.

---

## 4 · Candidate comparison — measured

**Corpus A — end-to-end `graphify extract`** on 3 real repo docs (`W1-A-code.md`,
`2026-07-21-hebrew-terminology.md`, `ai-strategy.md`; 6,780 words), `--mode deep --token-budget 4000
--max-concurrency 1 --force`, neutral cwd. This is the decision-relevant table.

| Backend / model | Arch | VRAM (`ollama ps`) | nodes | edges | dangling | wall clock | Verdict |
|---|---|---|---|---|---|---|---|
| `claude-cli` **sonnet** *(reference)* | remote | — | **165** | **185** | 0 | 14 m 18 s | reference |
| **`qwen3:30b-a3b-instruct-2507` Q4_K_M** | **MoE, 3B active** | 21 GB · 100 % GPU | **137** (83 %) | **179** (97 %) | **0** | **2 m 30 s** | **✅ PASS** |
| `gemma4:26b-a4b-it` Q4_K_M | MoE, 4B active | 17 GB · 100 % GPU | 39 (24 %) | 27 (15 %) | 0 | 2 m 39 s | ❌ quality |
| `gemma4:31b-it` Q4_K_M | dense 31B | **21 GB · 9 %/91 % CPU/GPU** | — | — | — | **> 9 m 50 s** | ❌ too slow — **and spills to CPU** |
| `qwen3.5:27b` Q4_K_M | dense 27B, **thinking** | 18 GB · 100 % GPU | — | — | — | **> 9 m 50 s** | ❌ burns budget on reasoning |

**Corpus B — single-call replay** of graphify's exact deep-mode request on the vendor corpus that
originally failed (`nodejs-v8-docs`, 2 files, 6,969 words). Reference on this corpus: **35 nodes / 24 edges
/ 3 hyperedges / 0 dangling**, 127.9 s.

| Model | nodes | edges | tok/s | wall | Notes |
|---|---|---|---|---|---|
| **`qwen3:30b-a3b-instruct-2507`** | **40** | **103** | **137** | 92.8 s | strict-valid JSON, no fences; granular API nodes (`cluster.fork`, `worker.exitedAfterDisconnect`) |
| `gemma3:27b` | 6–7 | 4–6 | 36 | 50–64 s | far too coarse |
| `qwen2.5-coder:14b` | 2 | 9 | 61 | 29 s | all 9 edges **dangling** |
| `qwen2.5-coder:7b` | 2 | 1 | 119 | 11 s | the original failure |
| `mistral-small:24b` | 2 | — | 39 | **runaway** | repetition loop → 61,692 tokens → wedged the server |
| `qwen2.5-coder:32b` | — | — | — | — | **not cleanly measured** — its slot was starved by the runaway above |
| `granite4.1:30b` | — | — | — | — | **excluded**: needs 26 GB, ran `14%/86% CPU/GPU` |

**Spot-read of the winner's semantics** (not just counts): nodes are real entities — `cluster_fork`,
`cluster_scheduling_policy`, `worker_exited_after_disconnect`, `equipPlan`, `cookerFor`, `deviceOccupancy`
— with `EXTRACTED` 141 / `INFERRED` 38 on the repo chunk, and correct edge direction on the samples read.
This is the same shape `claude-cli` produces, not a degraded imitation.

**Why MoE wins, and why "coder" was the wrong axis.** The two models that passed the *speed* bar are both
**Mixture-of-Experts** (3–4 B active parameters): 30 B-class quality at ~110–140 tok/s. Every **dense**
27–31 B model overran the timeout at 36–40 tok/s. And the *coder*-specialised models were the **worst**
performers on this task — deep-mode extraction is semantic document analysis, not code comprehension.
graphify's own coded-in default (`qwen2.5-coder:7b`) is the single weakest option tested.

### On `gemma4` and `qwen3.5` — a gap in my first pass, corrected

My initial shortlist was drawn from models I already knew and missed everything released after my
knowledge cutoff (Jan 2026; it is now July 2026). Probing the live Ollama library found **`gemma4`,
`qwen3.5`, `llama4`, `nemotron`, `minimax-m2`, `kimi-k2`, `gemma3n`** all present. Both `gemma4` and
`qwen3.5` were then pulled and benchmarked on the identical end-to-end path — results in the table above.
**Neither beat `qwen3:30b-a3b-instruct-2507`:**

- **`gemma4:26b-a4b`** is architecturally the right idea (MoE, 4 B active, 256 K ctx, fits in 17 GB) and is
  fast — but extracted only **39 nodes / 27 edges**, a quarter of the winner's yield.
- **`gemma4:31b`** is dense, overran the timeout, **and does not actually fit**: `ollama ps` reported
  21 GB at `9%/91% CPU/GPU`. Its slowness is partly CPU spill, not dense-model speed alone — the same
  24 GB ceiling that excludes `granite4.1:30b`.
- **`qwen3.5:27b`** is a **thinking model with no non-thinking tag in the whole library** (checked all 63
  tags: no `instruct`, no `no-think`, no `chat` variant). Measured: **156 output tokens to answer "OK"**.
  Against graphify's fixed output budget it spends the budget reasoning instead of emitting nodes.
- **`qwen3.5:35b-a3b`** — the MoE that would have been the most interesting successor — ships only
  `nvfp4` (Blackwell), `mlx` (Apple), `int4` and `q8_0`/`bf16` at ≥ 20 GB. **No Ampere-friendly
  `q4_K_M` under 22 GB**, so it does not fit a 3090 with the desktop resident. *Not tested — stated, not
  hidden.*

---

## 5 · The wiring — what was changed and how it was verified

Because Ollama ignores both `max_completion_tokens` and `extra_body.options` on the `/v1/` path, the
parameters must be baked into the **model** — the only place Ollama honours them there. No graphify code
was modified.

`Modelfile` → `ollama create graphify-extract`:

```
FROM qwen3:30b-a3b-instruct-2507-q4_K_M
PARAMETER num_predict 16384     # hard output bound — prevents the runaway that wedges the server
PARAMETER num_ctx     32768     # restores the context control graphify's #798 fix cannot deliver here
PARAMETER temperature 0
PARAMETER repeat_penalty 1.05   # second line of defence against repetition loops
```

**Verified the cap actually binds a graphify-shaped request** (a control variant with
`num_predict 20`, called with `max_completion_tokens=16384` and no `max_tokens` — exactly what graphify
sends):

```
completion_tokens: 20   finish_reason: length   ps CONTEXT: 8192
```

`finish_reason=length` is precisely what graphify's adaptive-retry path keys on, so an over-long chunk now
**bisects** instead of hanging. Both inert protections are restored.

**Run it:**

```bash
export OLLAMA_BASE_URL=http://localhost:11434/v1
export OLLAMA_API_KEY=ollama          # any non-empty value; Ollama ignores it, the SDK requires it
graphify extract <path> --backend ollama --model graphify-extract \
        --mode deep --token-budget 4000 --max-concurrency 1
```

**`--token-budget 4000` is load-bearing, not decoration.** At the 60,000 default this model's output
exceeds the 16,384-token bound and the JSON truncates to zero usable nodes (measured: a 7,045-word chunk
produced invalid JSON at 151.8 s). 4,000 keeps each chunk inside the bound. `--max-concurrency 1` is
graphify's own default for ollama and should stay.

**End-to-end verification:** `137 nodes / 179 edges / 24 communities`, 3/3 chunks clean, no hollow
responses, no retries, `16,221 in / 18,755 out`, **$0.0000**, 2 m 30 s.

### A limitation this wiring does NOT fix — and an important correction

PASS 3's **BUG (c)** (the library prompt omits the `source_file` rule) **also affects the local model**, and
I initially reported it ruled out. That was measured on the vendor corpus — where documents are not
*about* other files, so the bug cannot manifest. On a **real repo corpus it does**:

| Backend | nodes | `source_file` outside the dispatched corpus |
|---|---|---|
| `claude-cli` sonnet | 165 | **87 (53 %)** |
| `qwen3:30b-a3b` | 137 | **63 (46 %)** |
| `gemma4:26b-a4b` | 39 | 27 (69 %) |

Nodes are attributed to `app.js`, `worker/index.js`, `build.py` — the files the documents *discuss*. **This
is a backend-independent graphify defect, not a local-model weakness**: the reference is marginally
*worse* than the local model. I attempted the documented prompt fix and **it made things worse** (137 → 7
nodes; my wording over-constrained the model), so per the 3-fix rule I stopped and **reverted the
installed package to shipped state** (verified: prompt back to 3,308 chars, no `.bak` files left). Getting
that rule worded correctly is a real task, but it belongs with the graphify owner, not bolted onto this
mission.

**`graphify install` was NOT run.** The upgrade banner (skill 0.9.22 → package 0.9.25) was left untaken, as instructed.

---

## 6 · Further ways to use this GPU — ranked by value × feasibility

| # | Opportunity | Effort | Payoff | Recommendation |
|---|---|---|---|---|
| **1** | **Local deep-mode extraction** — this mission | done | 5.7× faster than `claude-cli`, $0, unlimited re-extraction | **SHIPPED** |
| **2** | **Embedding semantic search for `graphify query`** — the standing Tier-3 item. A read-only sidecar embedding `graph.json` node labels and replacing the substring start-node selector with nearest-neighbour. `qwen3-embedding` and `embeddinggemma` are both in the deposited `ollama-docs` corpus; **BGE-M3** remains the pick for a **bilingual Hebrew/English** corpus. ~2 GB — runs *alongside* the 21 GB extraction model | Med | Directly fixes the "case-folded substring, no stemming, no synonyms" weakness CLAUDE.md §10.11 documents | **TOP NEXT PICK** |
| **3** | **Local reranking** of `graphify query` results (`bge-reranker-v2-m3`, ~2 GB) | Low–Med | Cheap precision win layered on #2; composes with Serena's exact-symbol path | **DO after #2** |
| **4** | **Bulk i18n translation drafting** for the planned fr/de/es expansion | Low | Draft-quality translations offline, unlimited iteration; review still required | **DO when i18n resumes** |
| **5** | **Eval-harness local smoke target** — a `page.route` shim translating Gemini's wire format to a local OpenAI-compatible call | Med | Free harness-correctness iteration without spending `GEMINI_EVAL_KEY` | **NICE-TO-HAVE.** Never a substitute for the real Gemini baseline |
| **6** | **Local Whisper for the voice path** — STT currently has **zero** Playwright coverage | Med–High | Would open an untested surface | **INVESTIGATE** — value is the missing coverage, not the GPU |
| **7** | **Batch document processing** (summarise/tag/cross-link `docs/`) | Low | Now essentially free given #1 | Opportunistic |

**Skip list unchanged and re-confirmed by this mission:** vLLM (no Windows support; its batching win needs
10+ concurrent requests, and graphify pins ollama concurrency to 1), GPU image-diffing, GPU linting, and
"delegate coding to a local model" — nothing measured here changes those verdicts.

---

## 7 · What I could NOT verify

- **`qwen2.5-coder:32b` was never cleanly measured.** Its run was starved by the `mistral-small` runaway.
  Given 14b and 7b both score 2 nodes and the MoE/dense speed gap, it is very unlikely to beat the winner —
  but that is **inference, not measurement**.
- **`granite4.1:30b` was excluded on VRAM alone** (26 GB, 14 % CPU spill). Its extraction quality is untested.
- **`qwen3.5:35b-a3b` was not tested** — no Ampere-compatible quant under 22 GB.
- **`llama4`, `nemotron`, `minimax-m2`, `kimi-k2`, `gemma3n`** were confirmed present in the library but
  **not benchmarked** (time). `minimax-m2` and `kimi-k2` are far too large for 24 GB regardless.
- **The 14b timeout was root-caused mechanistically, not replayed on 14b itself.** I proved the mechanism
  (unbounded generation → context shift → wedged slot) and reproduced the exact end state on
  `mistral-small`, but I did not force 14b specifically to loop.
- **Sample size is n = 1 per model per corpus** for the end-to-end table (2 corpora total). Determinism was
  checked only for `qwen2.5-coder:7b` (4 identical runs). Wall-clock figures are single observations on a
  machine that was not otherwise idle — a `claude-cli` reference ran concurrently with some Ollama pulls.
- **Hebrew extraction quality was not separately scored.** The corpus included a Hebrew-terminology
  document; only 1 node was attributed to it by the winner, which *may* indicate under-extraction of
  Hebrew content — flagged, not established.
- **Nothing was benchmarked on HuggingFace directly.** Candidate discovery used the live Ollama library
  (the practical constraint — the model must be servable here). A raw-HF search could surface a GGUF that
  Ollama does not carry.

---

## 8 · Deposit candidates for the graphify global corpus (§10.11 usefulness gate — listed, NOT deposited)

Cross-project value, no project-private content, no keys:

1. **`docs.ollama.com` — Modelfile / PARAMETER reference** (`num_predict`, `num_ctx`, `repeat_penalty`).
   *Directly load-bearing here: the only mechanism that restores an output bound on the `/v1/` path.*
2. **`docs.ollama.com` — OpenAI-compatibility page.** The existing `ollama-docs` corpus (27 nodes) covers
   embeddings and the 2024 compat blog, but **not** the parameter-support matrix that cost this mission
   the most time. High value.
3. **Ollama structured-output / `format: json_schema` docs** — the capability graphify does not yet use on
   the ollama backend; the obvious next quality lever.
4. **llama.cpp context-shift documentation** — explains the 61,692-token runaway and why an unbounded
   local request never terminates.
5. **Qwen3 / Qwen3.5 model cards** (MoE active-parameter counts, thinking vs instruct variants) — the
   thinking/non-thinking distinction decided two candidates here.

*A miss worth recording:* the global-graph query for
`"ollama context window num_ctx structured output json schema gpu layers"` returned **124 nodes, all
tangential** — `ollama-docs` covers embeddings and OpenAI-compat only. §10.11 was honoured (graph first,
web second); the gap is real and items 1–3 above would close it.

---

## 9 · Bugs found (worth raising upstream)

1. **graphify sends `max_completion_tokens` to Ollama, which ignores it** → no output bound on the ollama
   backend → runaway generation, wedged model slots, and "timeouts" blamed on models. Sending `max_tokens`
   as well would fix it in one line.
2. **graphify's `num_ctx` auto-derivation (#798) and `GRAPHIFY_OLLAMA_KEEP_ALIVE` are inert** on
   `/v1/chat/completions` — `extra_body.options` is discarded by Ollama. The protection graphify believes
   it has is not applied.
3. **The ollama backend uses no structured output**, while `claude-cli` passes `--json-schema`. Ollama
   supports JSON-schema structured outputs; using it would raise every local model's floor.
4. **PASS 3 BUG (c) is backend-independent** — measured at 53 % mis-attribution on `claude-cli` vs 46 % on
   the local model. It is not a local-model problem.
