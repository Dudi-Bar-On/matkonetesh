# Local models beyond graphify — where this PC's GPU adds development value

**Date:** 2026-07-24 · **Status:** decision report, nothing wired · **Author:** research agent
**Companion to:** `docs/research/2026-07-24-local-gpu-model-for-graphify.md` (the benchmark study this builds on)
**Authority:** recommendations only. No configuration was changed, nothing was installed, no model was pulled.

---

## 1 · The answer, in ten lines

**Is graphify on a local model?** **Partly.** It runs on `graphify-extract` (a capped
`qwen3:30b-a3b-instruct-2507`) **only when four flags are passed by hand.** Nothing is persisted.
**A default can be half-set safely:** `OLLAMA_BASE_URL` + `OLLAMA_MODEL` would make the local backend
auto-detect (verified: *no* paid LLM key exists in this environment, so nothing would be shadowed) —
but `--mode deep --token-budget 4000` have **no env equivalent** and must go in a wrapper. Details §3.

**Can these models help elsewhere?** **Partly — two clear yeses, one clear no, and one trap.**
- **YES — bulk i18n pre-translation.** fr/de/es sit at 83/3985 keys (2.1 %). Measured: `gemma3:27b`
  translated 10 real Hebrew recipe strings to French at **10/10 numeric-guard pass, 0 Hebrew leak**.
- **YES — semantic search over the graph** (embeddings are ~0.6 GB and run *alongside* the 18 GB model).
- **NO — an LLM judge for the eval harness.** Blocked on **data, not GPU**: 5 freeform cases, zero human
  labels. A GPU cannot manufacture the calibration set the project's own bar (≥0.7 correlation) requires.
- **THE TRAP — the graphify winner is the wrong model for translation.** Measured below: `qwen3:30b-a3b`
  hallucinated ingredients in **3 of 10** strings, **2 of them allergen erasures**, and the app's numeric
  guard passed **all 10**. One model does not generalise across these jobs.

---

## 2 · Framing check — the runtime question, verified against the code, not assumed

The brief's framing is **correct**, and I traced it rather than accepting it:

- `gemFetch` (`app.js:4316`) sends to exactly two places: `GEM_HOST`
  (`https://generativelanguage.googleapis.com/v1beta/models/`, `app.js:4205`) or `centralUrl()`.
- The managed path's `centralUrl()` is a Cloudflare Worker (`worker/index.js`) that validates an access
  code and **forwards verbatim to Gemini** with a server-side key.
- End users run the PWA from Cloudflare Pages over HTTPS on their own phones. **This PC is not reachable
  from there.** No local model can serve the shipped app's runtime AI.

**But there is a development-time seam the brief did not name, and it is free.**
`centralUrl()` reads the **localStorage key `mk-central-url`** (`app.js:5162`), and `gemMode()` selects
`'managed'` whenever that plus `mk-central-code` are set (`app.js:5164`). The Worker is a pure
passthrough, so **a local process that speaks `POST /v1beta/models/<model>:generateContent` is a
drop-in AI backend for the app with zero code change** — you set two localStorage keys.

And the mixed-content objection does not apply: both Playwright configs serve over **plain HTTP**
(`playwright.config.ts:39` → `http://localhost:8123`; `evals/playwright.config.ts:31` → `:8199`), so an
`http://localhost` shim is same-scheme. This makes opportunity **O4** below far cheaper than it looks.

*One correction to the brief:* it is not true that a local model has no runtime angle at all — it has no
*end-user* runtime angle. It has a legitimate **local-runtime** angle for tests and evals, through a seam
that already exists and was designed for a different reason.

---

## 3 · Can graphify's local wiring be made a default? (verified in the installed package)

Confirmed from `graphify/llm.py` and `graphify/cli.py` (version 0.9.25):

| Setting | Persistable? | Evidence |
|---|---|---|
| **backend = ollama** | **Yes, safely** | `detect_backend()` (`llm.py:2651`) returns `"ollama"` when `OLLAMA_BASE_URL`/`OLLAMA_HOST` is set **and no paid key exists**. Verified: `env` shows **no** `GEMINI_/ANTHROPIC_/OPENAI_/DEEPSEEK_/KIMI_/AWS_/AZURE_` variables at all. |
| **model = `graphify-extract`** | **Yes** | `llm.py:128` — `"default_model": os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b")`. |
| `--mode deep` | **No** | CLI-only; no env var in the whole `GRAPHIFY_*` set. |
| `--token-budget 4000` | **No** | CLI-only (`cli.py:2538`). **Load-bearing** — the prior study measured JSON truncation to zero usable nodes at the 60 000 default. |
| `--max-concurrency 1` | **Not needed** | `llm.py:2173/2177` force it to 1 for ollama regardless. |

**Two hazards worth stating before the owner acts on this:**

1. `llm.py:128`'s fallback is **`qwen2.5-coder:7b`** — the single weakest model the prior study tested
   (2 nodes / 1 edge). Setting `OLLAMA_BASE_URL` **without** also setting `OLLAMA_MODEL` would silently
   route deep extraction to that model. The two variables must be set together or not at all.
2. If a paid key is ever added to the environment, `detect_backend()` prefers it and the local default
   **silently stops applying** — by design (security finding F-002/F-029), but it means the default is
   conditional, not absolute.

**Recommendation:** set `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_MODEL` as user env vars **and** add a
small wrapper (shell function / `.cmd`) carrying `--mode deep --token-budget 4000`. Env alone is a
half-default and the missing half is the half that fails silently.

---

## 4 · The measured finding that should change a decision

**One model does not generalise across these jobs.** The prior study established
`qwen3:30b-a3b-instruct-2507` as the extraction winner. It is **not** the translation winner.

**Method (cheap, reproducible).** 10 Hebrew recipe strings sampled (seed 11) from `lang/en.data.json`,
restricted to strings carrying **≥ 2 numbers** — the class the safety guard exists for
(**measured: 869 of 3677 description strings, 23.6 %, carry ≥ 2 numbers**). Translated he→fr and he→en via
Ollama's **native `/api/generate`** (whose `options` *are* honoured — the prior study's ignored-cap finding
was specific to the `/v1/` path), `temperature 0`, using **the app's own `mtTranslate` system prompt
verbatim** (`app.js:~7280`). Scored with **the app's own guard**, `mtNumSig`/`mtSafe`
(`app.js:7206/7211`), ported line-for-line. The he→en direction has **ground truth** — the shipped
English in `lang/en.data.json` — so content fidelity is measurable there, not just guessed.

| Model | VRAM | he→fr `mtSafe` | Hebrew leak | he→en content-word recall vs shipped EN | worst case | wall (10 strings) |
|---|---|---|---|---|---|---|
| **`gemma3:27b`** | 17 GB · 100 % GPU | **10/10** | 0 | **mean 0.86** | **0.67** | 52.8 s |
| `qwen3:30b-a3b-instruct-2507` *(the graphify winner)* | 18 GB · 100 % GPU | **10/10** | 0 | mean **0.72** | **0.29** | 38.5 s |

**The `mtSafe` column is the point.** Both models score a perfect 10/10 — and the numeric guard is
**blind to what actually went wrong**. Verified against the shipped English ground truth:

| Source (ground-truth English) | `qwen3:30b-a3b` produced | `gemma3:27b` produced |
|---|---|---|
| "grated horseradish, mustard, and **sauerkraut**" | "sauce au **yaourt**, raifort et **concombre émincé**" — invented yogurt sauce + cucumber, dropped mustard and sauerkraut | "raifort râpé, moutarde et chou fermenté" ✅ |
| "2 tbsp **capers**, 3 **anchovy** fillets" | "2 c. à s. de **ciboulette**, 3 feuilles d'**aneth**" — chives, dill | "câpres … filets d'anchois" ✅ |
| "3 tbsp **oyster sauce**, 1 tbsp soy sauce" | "3 c. à s. de **sauce de soja**, 1 c. à s. de sauce de soja" — oyster sauce erased | "sauce aux huîtres" ✅ |

Two of those three are **allergen erasures** (fish, shellfish). Every one passed `mtSafe`, because
`mtNumSig` compares only the multiset of numbers — which was untouched.

**Three consequences, and they are the actionable part of this report:**

1. **The acceptance bar for i18n MT cannot be `mtSafe` pass-rate.** `mtSafe` is necessary and
   insufficient. Any bar must add an **entity/ingredient-fidelity check**. §6 states one.
2. **`gemma3:27b` is the better translator of the two by +0.14 mean and +0.38 worst-case recall** — and
   it is the *untuned base* of `translategemma:27b`, so its score is a **lower bound** on what the
   purpose-built model would deliver.
3. The prior study's lesson ("coder models were worst at semantic extraction") recurs on a new axis:
   **task-shape beats model-rank.** The report's own headline model loses at a different task.

---

## 5 · What the §10.11 global-graph query returned (gate honoured — graph before web)

Queried `~/.graphify/global-graph.json` **first**, expanded against vocabulary that actually exists
(`vendor-docs`, `methodology`, `ollama-docs`, `semantic-search-mcp-docs`, `gemini-api-docs`, …).

| Query | Result |
|---|---|
| `embedding model reranker semantic search vector similarity` | **HIT — 53 nodes, genuinely relevant.** `ollama-docs` supplied `embeddinggemma`, `qwen3-embedding`, `all-minilm`, `/api/embed`, Cosine Similarity, RAG; `semantic-search-mcp-docs` supplied FastEmbed, Jina Embeddings v2 Base Code, UniXcoder, Hybrid Search, SQLite index, Tree-sitter. |
| `evaluation judge scorer golden dataset calibration correlation` | **HIT — 67 nodes.** `LLM Judge` is a real node in `methodology` (← `Three Measurement Approaches`, ← `Rubric Design`). This is the source the eval design's ≥0.7 bar already cites. |
| `structured output json schema format constrained decoding` | **PARTIAL.** Matches Gemini's own Structured Outputs doc; **no** Ollama `format: json_schema` coverage — consistent with the prior study's open item. |
| `translation machine translation multilingual hebrew language` | **MISS.** 33 nodes, all tangential (GSD templates, a Lit XLIFF page). **No MT-model or Hebrew-language documentation exists in the global corpus.** |
| `quantization VRAM GPU layers context length` | **MISS.** Matched "context budget" prose; nothing about quantisation or VRAM. |

Two real misses, stated rather than papered over — both feed §9's deposit list. Per §10.11 a miss is a
task, so the web research below covers exactly those gaps.

---

## 6 · Ranked opportunities

Value/effort/risk are my judgement; the **acceptance bar** column is the part that makes each testable.
**M** = measured here · **P** = measured in the prior study · **I** = inferred, not measured.

| # | Opportunity | Replaces | Value | Effort | Risk | Model | Acceptance bar |
|---|---|---|---|---|---|---|---|
| **O1** | **Bulk pre-translation of the 3 677 recipe descriptions → `fr/de/es.data.json`** | ~3 677 *per-user, per-device, runtime* Gemini calls per language | **High** | Med | Med | `translategemma:27b` (17 GB, needs pulling); `gemma3:27b` **M** as the already-downloaded fallback | **(a)** `mtSafe` 100 % on a 200-string sample (`gemma3:27b` **M** 10/10); **(b)** ingredient-fidelity ≥ 0.90 content-word recall against a 50-string human-checked reference, **worst case ≥ 0.70** (`gemma3:27b` **M** 0.86/0.67 → **currently FAILS the bar**, `qwen3` **M** 0.72/0.29 fails badly); **(c)** 0 Hebrew leak; **(d)** native-speaker spot-review of 30 strings/language before ship |
| **O2** | **Embedding-backed `graphify query`** — replace the case-folded substring start-node selector | The §10.11 weakness CLAUDE.md itself documents ("no stemming, no synonyms, no cross-language matching") | **High** | Med | Low | `bge-m3` (567 M, ~1.2 GB) or `qwen3-embedding:0.6b` — both run *alongside* the 18 GB extractor **I** | On 20 hand-written queries whose correct start node is known, **top-5 recall ≥ 0.90 vs the current selector's measured baseline**, and **≥ 3 of 5 Hebrew-term queries** resolve (the substring selector gets 0 by construction) |
| **O3** | **Chrome-dictionary completion** — 226 missing keys/language (`en.json` 309 keys vs fr/de/es 83) | Hand translation | Med | Low | Low | `translategemma:12b` (8.1 GB) or `gemma3:27b` **M** | 100 % key coverage; **0** keys where the translation is byte-identical to the Hebrew source; build's own coverage line prints ≥ 95 % |
| **O4** | **Local Gemini-wire shim for eval/test iteration** — set `mk-central-url` to `http://localhost:PORT` | Spending `GEMINI_EVAL_KEY` on harness-plumbing runs | Med | Med | Low | any instruct model | Harness runs end-to-end against the shim and produces a scorecard; **never** compared against the real baseline — it tests the *harness*, not the model |
| **O5** | **Local reranking of `graphify query` results** | Nothing (new precision layer) | Low–Med | **Med–High** | Med | `bge-reranker-v2-m3` / `qwen3-reranker:0.6b` | nDCG@10 improvement ≥ 0.05 over O2 alone on the same 20 queries. **See §7.4 — Ollama has no rerank endpoint; effort is higher than it looks** |
| **O6** | **Batch doc summarisation / cross-linking of `docs/`** | Manual reading | Low | Low | Low | `graphify-extract` (already wired) | Opportunistic; no formal bar |
| **O7** | **LLM judge for eval category D** | Human reading of 5 freeform answers | **None today** | — | **High** | — | **Cannot be met — see §7.1** |
| **O8** | **Test-fixture / code generation, review passes** | Nothing | **Negative** | — | High | — | **Do not do — see §7.2** |

---

## 7 · Honest negatives — where a local model is not good enough, and why

### 7.1 · The LLM judge is blocked on data, not on GPU — do not buy this with hardware

The project's own design already sets the bar: *"target ≥0.7 correlation with human scores before
trusting a judge"* (`docs/analysis/program/PRE-4-eval-harness-design.md` §6.3, §13), and explicitly
scopes category D to **a scorecard, not a gate**.

I checked whether that bar is reachable. **It is not, and the GPU is irrelevant to why.** Inspecting
`docs/analysis/program/eval/baseline-gemini-3.6-flash-2026-07-24.json`:

- **5 freeform cases.** Each entry has exactly two fields: `case` and `txt`.
- **There is no human-score field anywhere.** Zero labelled examples exist.
- Even fully labelled, **a correlation computed on n = 5 is meaningless.**

So the missing ingredient is a human-labelled calibration set of adequate size. A local model cannot
produce that — using one to generate the labels it is then validated against is circular. **Adding a
local judge now would convert an honest "a human reads this" into an uncalibrated automated gate**,
which is precisely the pitfall the design doc names. *Recommendation: do not build this until someone
has hand-scored ~50 freeform answers. Then revisit — and at that point the judge could plausibly be
local, because judging against a rubric is a much easier task than answering.*

### 7.2 · Do not delegate code, tests, or review to a local model

The brief invited scepticism here and the scepticism is warranted. The prior study measured
`qwen2.5-coder:7b/14b/32b` as the **worst** performers on semantic extraction, and a 3090-class quantised
model is far below the models already reviewing this codebase. Worse, this project's failure log is
dominated by exactly the class of error a weaker model produces most: inert code with no consumer (L8),
claims not traced to the runtime path, tests asserting computed fields nothing reads (DoD §4/§5). A
cheaper reviewer would *increase* the rate of the failures the DoD gate was built to catch. **The
economics are also wrong** — coding assistance is not the bottleneck; correctness verification is.

### 7.3 · Local translation is not free money — be clear about what the saving actually is

The runtime cost is real: `mtTranslate` (`app.js:7266`) fires **one Gemini call per description string**,
cached in `mk-mtcache`, and that cache is **hard-capped at 3 000 entries** (`app.js:7285`) against
**3 677** description strings — **so the cache cannot hold even one language's corpus**, and the overflow
re-translates forever, on every device, for every user.

**But pre-computing fixes that regardless of who does the computing.** A one-off Gemini pre-translation of
~90 k input / ~110 k output tokens per language would cost roughly **a few cents**. So the honest case for
the *local* model is **not** the API bill — it is **unlimited free iteration** while getting the prompt,
the guard and the review right, with no key, no quota and no rate limit. Say that, rather than claiming a
cost saving that is not there.

### 7.4 · Reranking is meaningfully harder on Ollama than its model size suggests

**Ollama has no rerank endpoint.** `/api/embed` exposes the embedding layer only, not the cross-encoder
classification head a reranker needs; `/api/rerank`, `/v1/rerank` and variants all 404, and the upstream
PR (ollama/ollama#7219) is unmerged. A reranker therefore needs `llama.cpp`'s `llama-server --reranking`
or a separate FastAPI process — a **second serving stack** to install, run and keep alive on a machine
whose §11a rules already forbid stray competing processes. The 0.6 GB model size is not the cost.

### 7.5 · No Hebrew-specific evidence exists for the models being recommended

Every general "multilingual" claim I found is benchmark-level (MMTEB/MTEB) and **none reports Hebrew
separately**. The one genuine Hebrew datum located is TranslateGemma's technical report, which cites
**en→Hebrew MetricX improving 3.90 → 2.72** (lower is better). That is the *wrong direction* for this
project — the need is he→fr/de/es. My own he→fr and he→en probes are the only Hebrew-direction evidence
in this report, and they cover **10 strings and 2 models**. Treat every Hebrew claim about an
**unmeasured** model as inferred.

---

## 8 · Disk and VRAM — what is already here versus what would need pulling

**Correcting the brief's ground truth on one point.** The brief said "~200 GB is already consumed by 15
downloaded models; treat disk as a real constraint." **Measured:**

```
~/.ollama/models      147 GB          C: free 1.5 TB of 3.7 TB (60 % used)
```

The `ollama list` SIZE column **double-counts**: `graphify-extract` and the three `gx-*` variants are
Modelfile wrappers that share blobs with their bases. **Disk is not the binding constraint — VRAM is.**
At **21–22 GB usable** (24 576 MiB total, ~2 GB desktop-resident; measured idle 1 976 MiB / 7 %), only
one 17–19 GB model is resident at a time, plus room for a sub-1 GB embedding model.

### Already downloaded and usable (147 GB on disk)

| Model | Size | Verdict for the opportunities above |
|---|---|---|
| `graphify-extract` (capped `qwen3:30b-a3b`) | 18 GB | **Keep.** Extraction winner **P**. Wrong for translation **M** |
| `gemma3:27b` | 17 GB | **Promote.** Best measured translator here **M**; base of `translategemma` |
| `gemma4:26b-a4b-it`, `gemma4:31b-it`, `qwen3.5:27b`, `granite4.1:30b`, `mistral-small:24b` | 14–19 GB | All rejected for extraction **P**. Translation untested |
| `qwen2.5-coder:32b / :14b / :7b` | 4.7–19 GB | **Reclaim candidates.** Worst tested on extraction **P**; no role identified in this report. ~33 GB recoverable |
| `qwen2.5:0.5b` | 397 MB | Keep — the cheap parameter-probe instrument the prior study used |

### Would need pulling (owner's call — nothing was pulled)

| Model | Size | For | Why |
|---|---|---|---|
| **`translategemma:27b`** | **17 GB** | O1 | Google, Jan 2026, purpose-built MT on Gemma 3, **55 languages incl. Hebrew (he/he-IL)**, 128 K ctx. Its base scored **M** 0.86/10-of-10 here, so it is a lower bound |
| `translategemma:12b` | 8.1 GB | O1/O3 | Reported to beat the Gemma 3 27B baseline at a third the size; leaves ~13 GB VRAM free |
| **`bge-m3`** | **~1.2 GB** (567 M) | O2 | 100+ languages, dense+sparse+multi-vector in one model; in the deposited `ollama-docs` vocabulary |
| `qwen3-embedding:0.6b` / `:8b` | ~0.6 / ~7 GB | O2 | 8B is **#1 MTEB multilingual (70.58)**; 0.6b is the one that fits alongside a 17 GB model |
| `embeddinggemma` | ~0.3 GB (300 M) | O2 | Smallest credible option; already in the global corpus |
| `bge-reranker-v2-m3` (community tag) | ~1.2 GB | O5 | Only via a second serving stack — see §7.4 |

**Licensing** (matters — this project has a monetisation track). `translategemma`/`gemma3` are **Gemma
Terms of Use**, not OSI-open: commercial use is permitted but subject to Google's use-policy and
redistribution conditions. Qwen3 family and `bge-m3` are **Apache-2.0**. **For O1 this is low-risk either
way** — the artifact shipped is a `.json` of translated strings, not model weights — but the owner should
confirm the Gemma terms before shipping *model output* commercially if that ever changes.

### Newer models probed live (not from recall) — and why none displaces the incumbent

Probing `ollama.com/library?sort=newest` surfaced a large cohort released since the prior study, including
several with the **exact 30 B-MoE / 3 B-active** architecture that study proved wins:

- **`qwen3.6:35b-a3b` — 24 GB at q4_K_M. Does not fit** 21–22 GB. Its `nvfp4` build is 22 GB but nvfp4 is
  **Blackwell-only** — unusable on Ampere. This is the identical trap the prior study hit with
  `qwen3.5:35b-a3b`. **`qwen3.6:27b` (17 GB) fits but is dense and thinking-oriented** ("thinking
  preservation"), the profile that already lost on `qwen3.5:27b`.
- **`laguna-xs-2.1` (33 B total / 3 B active) — 20 GB at q4_K_M. Fits.** The only new arrival that is both
  architecturally right and VRAM-feasible. **Untested — the most interesting single candidate for a future
  extraction re-benchmark.**
- `nemotron-cascade-2` (30 B MoE / 3 B active), `north-mini-code-1.0`, `ornith`, `granite4.1:30b` — same
  class, sizes unverified except granite4.1 (**P**: needs 26 GB, spills to CPU).
- Not viable at 24 GB regardless: `deepseek-v4-flash` (284 B), `minimax-m3`, `glm-5.2`, `kimi-k2.7`,
  `mistral-medium-3.5` (128 B), `nemotron-3-super/ultra`.
- Relevant specialists spotted: **`bespoke-minicheck:7b`** (fact-checking — the closest thing to a
  grounding judge), `granite4.1-guardian:8b` ("safety and judging"), `gpt-oss-safeguard:20b`.
  All parked behind §7.1: the blocker is labels, not models.

---

## 9 · What I could NOT verify

- **`translategemma` was never run.** It is the primary O1 recommendation and it is **unmeasured** — I was
  instructed not to pull. The evidence for it is (a) its base `gemma3:27b` measured here, (b) its
  technical report. Treat the recommendation as **inferred from a lower bound**, not demonstrated.
- **No embedding or reranker model is downloaded**, so **every O2/O5 claim is inferred** — including the
  central assumption that a 0.6 GB embedding model co-resides happily with an 18 GB LLM. Plausible on
  VRAM arithmetic; not observed.
- **Sample size is 10 strings × 2 models × 2 directions.** Single run, `temperature 0`, one random seed
  (11). The three hallucinations are individually verified against ground truth, but **"3/10" is not a
  reliable rate estimate** — it is a demonstration that the failure mode exists and that `mtSafe` misses
  it. A 200-string run is needed before sizing it.
- **Content-word recall is a crude instrument.** It penalises legitimate synonyms (it marked `gemma3`'s
  "simmer" wrong for "poach"), so **0.86 understates** that model. It is adequate for ranking two models
  on the same sample; it is not a translation-quality metric.
- **he→de and he→es were not tested at all** — only he→fr and he→en. German compounding and Spanish
  gender agreement are different failure surfaces.
- **The i18n runtime call-volume claim is read from code, not observed live.** I traced
  `mtTranslate`→`hydrateMT` (`app.js:7296`) and the 3 000-entry cap, but did not instrument a French
  session to count actual network calls.
- **Throughput projection for O1 is arithmetic, not measurement.** Measured **5.38 s/string** on
  `gemma3:27b` one-string-per-call → **~5.5 h/language, ~16.5 h for three**, unattended. Batching ~20
  strings per call should cut that by roughly an order of magnitude — **untested**.
- **No Playwright suite was run** and no test in this repo was executed. This report changes no code, so
  the DoD gate's RED/GREEN lines do not apply; I am stating that explicitly rather than leaving the
  absence to be inferred.
- **Ollama's rerank status** is from the upstream issue tracker and community reports, not from my own
  attempt to call the endpoint.

---

## 10 · §10.11 deposit candidates — LISTED, NOT DEPOSITED

Cross-project value, no project-private content, no keys. The first two close the **measured misses** in §5.

1. **TranslateGemma technical report** (arXiv 2601.09012) + the Ollama/HF model card — the 55-language
   list, per-language MetricX including Hebrew, and the required prompt format (which has a
   **two-blank-line** quirk). *Closes the §5 translation MISS entirely.*
2. **Ollama embeddings + `/api/embed` reference, and the rerank gap** — `ollama-docs` already has partial
   embedding coverage; the **absence of a rerank endpoint** (issue #10467, PR #7219) is the load-bearing
   fact and is nowhere in the corpus.
3. **`docs.ollama.com` Modelfile/PARAMETER reference and the OpenAI-compatibility parameter matrix** —
   *carried over unclaimed from the prior study's list (items 1–2); still not deposited, still the single
   costliest gap in that study.*
4. **Ollama structured-output / `format: json_schema`** — §5 confirmed this is still a MISS; it is the
   next quality lever for every local extraction run.
5. **MTEB/MMTEB multilingual embedding leaderboard methodology** — for O2 model selection, and it would
   have answered the §5 embedding query natively.
6. **BGE-M3 and Qwen3-Embedding model cards** — dense/sparse/multi-vector modes and language coverage.

*Not proposed for deposit:* anything from this repo, the eval scorecards, or `lang/*.json`.

---

## 11 · Recommended order, if the owner wants one

1. **O3 (chrome dictionary, 226 keys × 3)** — smallest, safest, reversible, and it exercises the whole
   pipeline on low-stakes strings before any recipe prose is touched.
2. **O1 (3 677 descriptions)** — but **only after** the §6 bar (b) is defined and a native speaker is
   lined up for the 30-string review. `gemma3:27b` currently **fails** bar (b) at 0.86/0.67; the decision
   to pull `translategemma:27b` (17 GB) is the cheap way to try to clear it.
3. **O2 (embeddings)** — highest structural value, and it fixes a weakness CLAUDE.md documents about
   itself. Independent of O1; could run in parallel.
4. Leave **O5** until Ollama merges rerank support, **O7** until labels exist, and **O8** permanently.
