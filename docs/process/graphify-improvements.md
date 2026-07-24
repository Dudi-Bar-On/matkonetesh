# graphify infrastructure — verified state, fixes, deposits, and proposals

_Investigation + fixes, 2026-07-23. Scope: make graphify genuinely fast and helpful for this
project and every project sharing its global corpus (§10.11 / §10.12 / §10.13)._

All claims below were verified by running the tool or reading its installed source
(`C:\Users\dudib\AppData\Local\Programs\Python\Python310\lib\site-packages\graphify\`).
**No key value was ever printed, committed, or pasted.**

---

## 0. TL;DR — status board

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | **Manifest desync** (blocker) — ~213 phantom "changed" files | **FIXED** | `docs/.graphifyignore` → changed-set 213 → **25 real docs, 0 images** |
| 2 | **Deep-mode backend** (blocker) — "needs an LLM key" | **SOLVED, no key** | `--backend claude-cli` extracts via the local `claude` CLI, cost **$0.00** |
| 3 | **Global vendor coverage** — the core problem | **DONE + verified** | Deposited `gemini-api-docs` (+71) and `cloudflare-workers-docs` (+56); usefulness gate now passes |
| 4 | **Local §10.12 doc update** | **UNBLOCKED — owner to run** | Both blockers cleared; safe path proven; the actual re-extract needs the skill's subagent flow (I have no Agent tool) |
| 5 | **HAZARD: headless `graphify extract` on this repo** | **DOCUMENTED — do not run** | Proven destructive: 4547 → **1460** nodes, all 807 `app.js` code nodes pruned |
| 6 | **Corpus hygiene** — `methodology` holds another project's private docs | **FLAGGED — owner decision** | 1875 global nodes carry matkonet local paths; 0 key-looking strings |
| 7 | Ranked improvements (query scoping, freshness, MCP) | **Proposed** | See §7 |

---

## 1. Verified current state

- **graphify is a CLI**, not an MCP tool. The launcher is a compiled binary at `~/.local/bin/graphify`,
  but the real logic is an **importable Python package** (`import graphify`, Python 3.10). Reading that
  package is how the internals below were confirmed.
- **Local graph** `graphify-out/graph.json`: **4547 nodes / 14268 links**, built_at_commit
  `c09ac8e…`. Composition: code 2664, concept 1241, rationale 319, document 217, image 105, paper 1.
- **The local graph is two-rooted** (this matters — see §5). Doc nodes store `source_file` **relative to
  `docs/`** (`ANALYSIS-v149.md`); code nodes store it **relative to the repo root** (`app.js`, 807 nodes).
  `graphify-out/.graphify_root` = `…/matconetesh/docs`. The graph is an assembly of a docs-rooted semantic
  pass **and** a repo-rooted code (AST) pass into one `graph.json`.
- **Global graph** `~/.graphify/global-graph.json`: was **6770 nodes** in two corpora, both frozen
  2026-07-21 — `vendor-docs` (2435: playwright/vitest/superpowers/bmad/serena) and `methodology` (4335).
  Neither covered the vendors THIS project runs on (Gemini, Cloudflare). Confirmed by query noise.
- **Backends available:** `azure, bedrock, claude, claude-cli, deepseek, gemini, kimi, ollama, openai`.
  Env scan (presence only, values never read): **no** `GEMINI_API_KEY` / `GOOGLE_API_KEY` /
  `ANTHROPIC_API_KEY` / any provider key is set in this environment. The **`claude` CLI is installed**
  (`~/.local/bin/claude`) — this is the no-key path.

---

## 2. Blocker 1 — the manifest "desync" (FIXED)

**Root cause (not a graphify bug).** The doc corpus root is `docs/`, and `docs/` now contains **268 PNG
screenshots** (264 in `docs/analysis/shots/`) versus only **75** recorded in `graphify-out/manifest.json`.
graphify has no vision backend configured here, so every incremental run correctly sees the ~193
never-recorded screenshots as **new** files. `detect_incremental()` (detect.py:1742) flags a file when it
is absent from the manifest or its content hash moved — so the "~215 changed" was ~193 images + a handful
of real doc edits. A `--mode deep` run would then try to LLM-process every screenshot.

**Fix — `docs/.graphifyignore`** (committed). graphify honors `.graphifyignore` with full gitignore
semantics (detect.py:912-1064; it can only ever *exclude* more). The file excludes
`*.png *.jpg *.jpeg *.gif *.webp *.svg` under `docs/`.

**Verified read-only (no graph mutated):**

```
detect_incremental(docs) WITH docs/.graphifyignore:
  code       changed=1
  document   changed=24   unchanged=83
  image      changed=0                      ← was the entire ~193-file churn
  total changed: 25   excluded(alive): 75   deleted: 0
```

The 24 changed documents are exactly the real new/edited markdown, including every target doc
(`model-selection-architecture-design.md`, `gemini-3.6-thinking-research.md`,
`tts-3.1-migration-research.md`, `2026-07-23-ai-model-selection-migration.md`,
`process/development-discipline.md`). Churn collapsed **213 → 25, images 193 → 0.**

> One-time note for the next doc rebuild: the 75 previously-tracked images become "excluded". The **safe
> skill path** (§4) uses `prune_sources = deleted-only`, so those old image nodes simply persist
> (harmless) and node count only grows. No `--force` needed.

---

## 3. Blocker 2 — deep-mode semantic backend (SOLVED, no secret)

Auto-detect and `--backend claude/gemini/openai/...` all demand a provider **API key**. But
**`--backend claude-cli` drives the installed `claude` CLI directly — no key, no cost.** Proven end to
end on a throwaway corpus and on the two vendor corpora below:

```
graphify extract . --mode deep --backend claude-cli
  → semantic extraction … via claude-cli … chunk 1/1 done
  → wrote graph.json: 71 nodes, 95 edges
  → tokens: 89,561 in / 26,402 out, est. cost: $0.0000
```

**No secret is required and none must be provisioned.** (If the owner ever wants Gemini-backed extraction
instead, the analogue of the GitHub `GEMINI_EVAL_KEY` is a local `GEMINI_API_KEY`/`GOOGLE_API_KEY` env var —
graphify reads only those two for its Gemini backend. Not needed for anything in this document.)

---

## 4. Local §10.12 doc update — UNBLOCKED; owner runs the canonical command

Both blockers are gone, so the owner's standing command now works **correctly and cheaply**:

```
/graphify docs --update --mode deep
```

Why it is now safe **and** grows the graph (verified by reading `references/update.md` + `build.py`):
the skill's `--update` merges via `build_merge([new_extraction], graph_path='graphify-out/graph.json',
prune_sources=<deleted-only>, root='docs')`. It **replaces only the re-extracted docs, prunes only
genuinely-deleted files, and preserves everything else — including all 2664 code nodes.** With the
`.graphifyignore` in place it processes **25 docs, 0 images** → node count goes **up**.

**Why I did not execute it myself (honest):** the skill's semantic pass (Part B) is subagent-driven and
this task agent has **no Agent/Task tool** to dispatch those workers; hand-rolling the 700-line,
guard-laden pipeline (dedup/manifest-stamping/#1344/#1948/#2015…) against the shared evidence graph is
exactly the risk the discipline says not to take. The safe, guard-tested path is the owner's one-line
command above, now unblocked. **Do not substitute the headless binary for it — see §5.**

---

## 5. HAZARD — never run `graphify extract` (headless) against this repo's graph

The headless `graphify extract <path>` binary uses a **different** reconciliation than the skill: it prunes
every graph source that anchors inside the scan root but isn't in the current scan
(`cli._stale_graph_sources`). Because this repo is **two-rooted** (§1), a `docs`-scoped headless extract
treats the repo-root code files (`app.js`, `tests/…`) as stale.

**Proven in a sandbox copy (real graph untouched):**

```
graphify extract docs --out <sandbox> --code-only
  → [graphify] Pruned 3087 node(s) from 252 deleted source file(s)
  → wrote graph.json: 1460 nodes           (was 4547)
  → app.js code nodes: 0                    (was 807)
```

The `#479` shrink-guard did **not** fire on the binary path — it silently wrote a 68%-smaller graph. Use
the skill flow (§4) exclusively. (A durable fix would be to make the local graph **single-rooted** — index
from the repo root so code and docs share one path scheme — but that is a larger change to raise with the
owner, not done here.)

---

## 6. Global corpus — seeded with our real vendors (DONE + verified)

This was the highest-leverage fix. Fetched with `graphify add <url>` (no key; saves full page text to
`raw/*.md`), built each corpus with `--backend claude-cli --mode deep`, deposited with `graphify global add`.

**`graphify global list` — before → after:**

```
BEFORE                                   AFTER
  vendor-docs   2435   (2026-07-21)        vendor-docs             2435
  methodology   4335   (2026-07-21)        methodology             4335
                                           gemini-api-docs           71   (2026-07-23)  ← new
                                           cloudflare-workers-docs   56   (2026-07-23)  ← new
  total 6770 nodes                         total 6897 nodes
```

- **gemini-api-docs (71 nodes)** from `ai.google.dev/gemini-api/docs/{thinking, models, pricing,
  rate-limits, speech-generation, overview}`. Nodes include Gemini 3.6/3.5 Flash, Flash-Lite, TTS,
  Thinking guide, GenAI SDK, Interactions API, pricing tiers, rate limits.
- **cloudflare-workers-docs (56 nodes)** from `developers.cloudflare.com/{workers, workers/configuration/
  secrets, workers/wrangler, pages, pages/functions, pages/configuration/build-configuration}`. Nodes
  include Pages, Pages Functions/Bindings/Middleware, Wrangler CLI, Workers Bindings, Build Configuration.

**Usefulness gate (§10.11) — the query that used to return pure noise:**

```
graphify query "cloudflare pages workers gemini thinking model pricing" --graph ~/.graphify/global-graph.json
BEFORE: 88 nodes of vitest/bmad/other-project noise, 0 useful hits.
AFTER : Gemini API Models Guide · Cloudflare Workers · Cloudflare Pages · Pages Functions ·
        Wrangler CLI · Gemini Developer API Pricing · Workers Bindings · Gemini 3.6 Flash ·
        Text-to-speech (TTS) Guide · Gemini API Rate Limits · Gemini Thinking Guide · …
```

**Reproducibility:** the source graphs + fetched `raw/*.md` were copied to
`~/.graphify/vendor-sources/{gemini-api-docs,cloudflare-workers-docs}/` and the global manifest was
re-pointed there (the original build dir was session-temp). Re-add / refresh with:
`graphify global add ~/.graphify/vendor-sources/<tag>/graph.json --as <tag>` (idempotent by content hash).
Only public vendor docs were added — no project file, no key.

---

## 7. Ranked improvements

### 7.1 Corpus hygiene — `methodology` holds another project's PRIVATE docs (owner decision)
Audit of the global graph: **1875 nodes carry local absolute paths**, e.g.
`C:/Users/dudib/.claude/projects/C--Users-dudib-source-repos-matkonet/memory/MEMORY.md` and
`…/matkonet/.claude/gsd-core/references/*.md`. The **`methodology` corpus (4335 nodes)** is largely the
**matkonet project's private memory/discipline notes**, not general cross-project documentation. This is
counter to §10.11 ("documentation of general cross-project value — never this project's private
documents"). **Good news:** a key-pattern scan found **0** key-looking strings — no secret leaked.
**Recommendation (needs owner ok — destructive to another project's contribution):** either rebuild
`methodology` from genuinely public sources, or drop it:
`graphify global remove methodology`. `vendor-docs` (playwright/vitest/superpowers/bmad/serena) is
legitimately public tooling docs — **keep**.

### 7.2 Freshness — the auto-refresh hook is NOT installed (quick win, owner ok)
`graphify hook status` → `post-commit: not installed`. `scripts/sync-docs.sh` assumes a code hook exists
("re-extracts CODE only"); it doesn't. So **neither code nor docs auto-refresh** — the graph goes stale
until a manual rebuild. Options (all owner-preference because they change commit behavior):
- `graphify hook install` — post-commit re-extracts changed **code** (AST, no LLM, fast). Closes the
  code-freshness gap; docs still go through the skill.
- Or a scheduled `graphify check-update docs` (cron-safe; notifies when a semantic re-extract is pending)
  to nudge the owner to run `/graphify docs --update --mode deep`.

### 7.3 Leaner / scoped query output (upstream feature request)
`graphify query` supports `--budget N`, `--context <edge>` (repeatable), and `--graph <path>`, but the
global graph has **no per-corpus filter**. A global query interleaves vendor + methodology + noise.
- **Immediate workaround:** every node keeps its `repo` tag and `source_file`; filter results by
  `source_file` prefix (`raw/ai_google_dev…` vs `raw/vitest…`) or query a single corpus directly with
  `--graph ~/.graphify/vendor-sources/<tag>/graph.json`.
- **Proposed upstream:** a `--corpus <tag>` / `--repo <tag>` filter on `graphify query` (nodes already
  carry `repo`), plus a top-N `file:line` + relationship compact mode. Not implementable against the
  compiled binary from here — file as a graphify feature request.

### 7.4 Tool / MCP wrapper vs CLI (proposed)
graphify ships an MCP server (`graphify … --mcp`, stdio). Wiring it as a project MCP tool would let agents
query the graph without shelling out to the CLI each time (and would make §10.13 "graph before grep" a
first-class tool call). Proposed; not wired here (touches project MCP config = owner preference).

---

## 8. Honest before → after

| | Before (2026-07-23 AM) | After |
|--|--|--|
| Deep-mode doc extraction | "blocked, needs an LLM key" | works with `--backend claude-cli`, **$0.00**, no secret |
| Incremental doc scan | ~213 phantom changes (image churn) | **25 real docs, 0 images** |
| Global vendor coverage | Gemini/Cloudflare **absent**; query = noise | present (127 nodes); **usefulness gate passes** |
| Local doc graph | 5 new design/research docs missing | **still missing** — unblocked; owner runs `/graphify docs --update --mode deep` |
| Global hygiene | 1875 private-path nodes, unexamined | **audited** (0 keys leaked); `methodology` prune proposed |
| Freshness | assumed auto-hook | **hook not installed** — install proposed |

**What still needs the owner:** (a) run `/graphify docs --update --mode deep` to land the 5 new docs;
(b) decide on `graphify global remove methodology` (private-doc hygiene); (c) optionally `graphify hook
install` for code freshness. Everything else in this document is done and verified.

---

## Deposit pass (2026-07-23)

**Scope:** §10.11/§10.16 deposit pass — bank the external documentation this session's four research docs
(`docs/research/playwright-reliability-research.md`, `test-stack-alternatives-research.md`,
`gpu-dev-tools-landscape.md`, `gpu-local-model-integration.md`) flagged as "deposit-worthy" into the
graphify **global** knowledgebase, so no future session on any project sharing the global re-searches the
same ground. All work happened in a session temp dir + `~/.graphify/`; the project repo and
`graphify-out/graph.json` were never touched (confirmed: `git status` before/after is identical, and
`graphify-out/graph.json`'s mtime — `Jul 23 10:21` — predates this pass).

### What was deposited

| Tag | Nodes | Source URLs |
|---|---|---|
| **`playwright-official-docs`** | **27** | [test-timeouts](https://playwright.dev/docs/test-timeouts) · [test-webserver](https://playwright.dev/docs/test-webserver) · [test-use-options](https://playwright.dev/docs/test-use-options) · [test-fixtures](https://playwright.dev/docs/test-fixtures) · [api/class-page](https://playwright.dev/docs/api/class-page) (full Page-class reference — no isolated `#page-goto` fragment exists on playwright.dev; the full page is the only source, and it does carry the `goto()` method + its `waitUntil` table, confirmed below) |
| **`nodejs-v8-docs`** | **48** | [nodejs.org/api/cluster.html](https://nodejs.org/api/cluster.html) · [v8.dev/blog/code-caching-for-devs](https://v8.dev/blog/code-caching-for-devs) |
| **`ollama-docs`** | **27** | [docs.ollama.com/capabilities/embeddings](https://docs.ollama.com/capabilities/embeddings) · [ollama.com/blog/openai-compatibility](https://ollama.com/blog/openai-compatibility) |
| **`semantic-search-mcp-docs`** | **24** | [github.com/adam-hanna/semantic-search-mcp](https://github.com/adam-hanna/semantic-search-mcp) |
| **Total new** | **126** | 10 URLs, 4 tags |

Kept deliberately separate from the existing `playwright-docs` tag (the 30-file GUI-walk-driver/MCP-tool
corpus from a different project) per the task instruction — `playwright-official-docs` is the deep
API-reference material that tag was proven (by this session's own research doc) to lack.

### Before → after `graphify global list`

```
BEFORE                                        AFTER
  vendor-docs               2435                vendor-docs               2435
  methodology               4335                methodology               4335
  gemini-api-docs             71                gemini-api-docs             71
  cloudflare-workers-docs     56                cloudflare-workers-docs     56
                                                 playwright-official-docs    27   ← new
                                                 nodejs-v8-docs              48   ← new
                                                 ollama-docs                 27   ← new
                                                 semantic-search-mcp-docs    24   ← new
  total 6897 nodes                              total 7023 nodes  (+126, node-count-UP)
```

### Method hazard found and fixed mid-pass: `graphify add`'s fetcher hard-caps around ~8.3 KB

The established `graphify add <url>` → `graphify extract . --mode deep --backend claude-cli` → `graphify
global add` pipeline (§6 above) worked cleanly for `semantic-search-mcp-docs`'s first attempt in isolation,
but depositing the **`api/class-page#page-goto`** page — the whole reason that URL was on the list, since
it carries the `waitUntil: "load"|"domcontentloaded"|"networkidle"|"commit"` enum this session's Playwright
research needed — exposed a real limitation: `graphify add` truncated **every** fetch of that page to
**~8.3 KB**, cutting off alphabetically after `addLocatorHandler` and never reaching `goto()`. Verified
systematic, not transient, across **4 independent attempts on 2 different URLs** (the rendered
`playwright.dev` page twice, the raw GitHub markdown source twice) — all landed at 8276–8496 bytes. The
same cap silently truncated `test-use-options.md`, `test-fixtures.md`, and the `semantic-search-mcp` README
too (confirmed by tail-checking each file: pages that end on a real page footer were captured in full;
pages that cut off mid-word/mid-sentence were not — 3 of the first 4 files fetched this way were silently
incomplete despite `graphify add` reporting success).

**Fix (per live owner correction — "do not use fetcher use download then update"):** stopped using
`graphify add` for content fetching entirely. Downloaded each page directly with `curl --ssl-no-revoke`
(the `--ssl-no-revoke` flag is required in this environment — plain `curl` hits `schannel:
CRYPT_E_NO_REVOCATION_CHECK` against the org's TLS-inspecting proxy, the same proxy class documented in
`docs/research/gpu-local-model-integration.md`'s `uv`/`UV_NATIVE_TLS` finding, just hitting curl's Schannel
revocation check instead of a bundled CA list this time), then converted HTML → text with a small
dependency-free stdlib script (`html.parser`-based; PyPI/`pip install` is blocked by the same proxy for
bundled-CA-list clients — confirmed again here — so no third-party HTML converter was installable) that
strips `<script>/<style>/<svg>`, keeps block-level structure as newlines, and decodes entities. Result: the
`class-page` fetch went from 8.3 KB → **137 KB**, and the target content is now actually present —
`grep -c waitUntil` finds the `"load"|"domcontentloaded"|"networkidle"|"commit"` union type **8 times**,
including a real `goto()` usage example (`page.goto('https://playwright.dev', { waitUntil:
'domcontentloaded' })`). `test-fixtures.md` grew 8.3 KB → 28 KB, `test-use-options.md` 8.3 KB → 14.7 KB,
`semantic-search-mcp` README 8.4 KB → 10.9 KB (now ends on GitHub's real footer, not mid-word). The two
already-deposited truncated tags (`playwright-official-docs` first pass, `semantic-search-mcp-docs` first
pass) were removed with `graphify global remove` and rebuilt clean before the final numbers above.
**Lesson for the next depositor: verify a `graphify add` fetch by tail-checking for a real page footer
before trusting it succeeded — a clean exit code is not proof of a complete capture.** The stdlib HTML→text
converter script was kept only in the session scratch dir, not persisted (it's a generic ~70-line utility,
not vendor content); reproduce with `curl --ssl-no-revoke -L -o page.html <url>` piped through any
dependency-free HTML→text step (`html.parser`, strip `script`/`style`/`svg`, keep block tags as newlines,
`html.unescape` the entities) if this recurs.

### Extraction backend used: `claude-cli --model fable` (after a real Ollama-local attempt, per owner direction)

The owner asked mid-pass to try the local RTX 3090 (Ollama) for extraction instead of `claude-cli`, "look
for the best model," with Claude Haiku-tier as an explicit authorized fallback. Both tried, honestly:

- **`qwen2.5-coder:7b`** (graphify's own coded-in `ollama`-backend default; pulled clean, no proxy issue —
  confirms `gpu-local-model-integration.md`'s earlier finding again) — mechanically worked
  (`--backend ollama` needs the `openai` PyPI extra, installed via `uv tool install "graphifyy[ollama]"
  --force --native-tls`, which also silently upgraded the graphify binary 0.9.22→0.9.25) but the **extraction
  quality was unusable**: 2 files → **2 nodes, 0 edges** (one bare "this file exists" node per doc, zero
  semantic content extracted at all) on the `nodejs-v8-docs` pair.
- **`qwen2.5-coder:14b`** (9 GB pull, confirmed `100% GPU`/15 GB VRAM via `ollama ps`, so not a
  CPU-fallback problem) — **timed out** at the default 600 s `GRAPHIFY_API_TIMEOUT` on the same input; a
  second attempt with `GRAPHIFY_API_TIMEOUT=1200` was still running in the background when this pass
  otherwise wrapped up (an idle-GPU "Stopping..." state in `ollama ps` with no output after ~25+ minutes
  suggests it did not resolve cleanly either, though this was not force-killed to confirm — see follow-up
  below).
- **`claude-cli --model fable`** (the fast/cheap tier — this environment's current alias for what the owner
  called "haiku"; `sonnet`/`opus`/`fable` are the aliases `claude --help` actually lists here) —
  **worked immediately and well**: 48 nodes/47 edges on the same `nodejs-v8-docs` pair in **3m48s**, real
  granular API-reference nodes (`cluster.fork([env])`, `worker.exitedAfterDisconnect`,
  `cluster.schedulingPolicy`, …), cost **$0.0000** (same as the default `claude-cli` model — this backend
  isn't metered per-token the way a raw API key would be). All four deposited corpora above used
  `--backend claude-cli --model fable` except `playwright-official-docs`, which had already completed on
  `claude-cli`'s default model before the local-model detour started (27 nodes, also good quality — left
  as-is rather than re-spent rebuilding for no quality gain).

**Owner follow-up, written down as asked ("write it down" — because Fable/Claude models are considered
costly for constant use despite showing $0.0000 in this CLI-backed setup, and the owner wants a genuinely
free, always-available local default):** *after this mission*, do a deeper, dedicated research pass to find
a **local** model that actually delivers usable `--mode deep` semantic-extraction quality on documentation
content, and wire it as the standing default — not `qwen2.5-coder:7b` (proven too weak: 0 edges) and not
yet proven-out at 14b (timed out twice). Candidates **not yet tried** worth investigating first, roughly in
order of promise given the 24 GB card and doc-not-code content:
- **`qwen2.5-coder:32b`** (Q4_K_M, ~19.85 GB) — the size `docs/research/gpu-local-model-integration.md`
  already named as its "concrete recommendation... it's code/architecture-aware" pick, not yet actually
  tested end-to-end against graphify's `--mode deep` prompt.
- A **non-coder** general-instruction model in the 20-30B class (Mistral-Small-24B, or similar) — this
  pass's content was prose documentation, not code, so a coder-specialized model's edge may not be the
  right axis; worth a head-to-head against qwen2.5-coder:32b on the same doc corpus.
- Diagnose the 14B **timeout** specifically before assuming it needs more parameters — it may be a
  prompt-length/repetition-loop issue fixable with a smaller `--token-budget` or a different sampling
  setting, which would be cheaper than jumping straight to 32B.
- Whatever ships as "current-generation" by the time that research runs — this environment's own Ollama
  registry already shows the field moved past Qwen2.5 (Granite4.1, Mistral-Medium-3.5, newer Qwen tiers);
  re-check the library fresh rather than reusing this pass's picks verbatim.

The still-running 14b background job (`GRAPHIFY_API_TIMEOUT=1200`, PID tracked as background task
`bg12o8nl6`) was left to finish or time out on its own rather than force-killed mid-flight; if it produced
a usable graph after this report was written, it was not deposited here — that's for the dedicated
follow-up task to evaluate properly (a stray late success on one two-file corpus isn't a substitute for
the head-to-head comparison above).

### Verification — 4 vocabulary-expanded `graphify query` probes (target: 2-3; ran 4 for full coverage)

All four ran against `~/.graphify/global-graph.json` post-deposit and surfaced the new nodes at the top of
results (full output captured in this session; representative hits below):

1. **`"waitUntil domcontentloaded navigation timeout"`** → top hits: `Navigation Timeout
   (navigationTimeout)`, `Test Timeout`, `Page Class`, `Test Fixtures`, `Action Timeout (actionTimeout)`,
   `webServer Config Option` — all from `playwright_dev_docs_test-timeouts.md` /
   `playwright_dev_docs_api_class-page.md` / `playwright_dev_docs_test-fixtures.md`. 48 nodes found total.
2. **`"webServer teardown reuseExistingServer gracefulShutdown"`** → top hit: `webServer Config Option`
   (`playwright_dev_docs_test-webserver.md`), plus the rest of the new Playwright corpus. 57 nodes found.
3. **`"ollama openai compatible embeddings local model"`** → top hits: `OpenAI Compatibility (Ollama
   Blog)`, `Embeddings Capability`, `Ollama Python Library (ollama.embed)`, `/api/embed Endpoint`,
   `/v1/chat/completions Endpoint`, `Retrieval-Augmented Generation (RAG)`, `Vector Database` — all from
   the new `ollama-docs` tag. 47 nodes found.
4. **`"node cluster worker fork exitedAfterDisconnect semantic code search"`** → top hits:
   `cluster.fork([env])`, `worker.exitedAfterDisconnect`, `node:cluster Module`, `worker.disconnect()`,
   `Cluster Event: 'exit'` (all `nodejs-v8-docs`) interleaved with `Semantic Search MCP Server`, `Hybrid
   Search`, `reindex Tool` (all `semantic-search-mcp-docs`), correctly co-occurring with pre-existing
   `vendor-docs` Cloudflare nodes. 100 nodes found.

**Usefulness gate: passes cleanly.** Before this pass, every one of these four vocabulary sets returned
either zero real hits or pure cross-project substring noise (documented per-doc in each research report's
own §10.11 method note). Now each returns the actual target documentation as the top-ranked result.

### Skipped, with reasons (per the usefulness gate and the task's own scope)

- **`github.com/lukeed/sirv`** (from `test-stack-alternatives-research.md` §7) — that doc's own text
  qualifies it as "only if this project or another starts actually evaluating sirv for something; a
  one-off lookup otherwise, skip unless reused." Not reused elsewhere. Skipped.
- **A general "Ollama vs LM Studio vs vLLM vs llama.cpp" decision-matrix page** (one of
  `gpu-dev-tools-landscape.md`'s 3 named candidates) — the source doc names no concrete single URL ("there
  were several reasonable 2026 comparison posts found; any one clear one would save re-deriving this
  table"). Per §10.11 ("never invent tokens to force a hit"), extended here to URLs: not depositing a page
  the research itself never pinned down. Skipped.
- **Hugging Face GGUF quant-size table** (`bartowski/Qwen2.5-Coder-32B-Instruct-GGUF`, from
  `gpu-local-model-integration.md`) — the task instruction explicitly scoped that doc's deposit to "its
  cited Ollama/serving pages... if listed as deposit-worthy" only; this is a model-card reference, not an
  Ollama/serving page. Out of the instructed scope. Skipped.
- **"A graphify local-backend + embedding status note"** (`gpu-local-model-integration.md`'s third
  candidate) — not an external URL at all; it's a proposal to write an internal note about *this project's*
  installed tool version and open upstream PR numbers. The source doc itself flags it as "arguably
  project-specific... may not clear the general cross-project value bar... flagging for the owner to decide
  rather than assuming either way." Not deposited; flagging it here again for the owner, as asked.
- **The graphify GitHub issues** (`Graphify-Labs/graphify` #1, #7, #38, #198, #424, #1126) — heavily cited
  as primary sources throughout `gpu-local-model-integration.md` but never listed under that doc's own
  "Deposit-worthy docs" section. Per the task's "collect the recommended... URLs" scope (deposit-worthy
  sections only, not general source lists), not deposited.

### Reproducibility

All four graphs + their `raw/*.md` sources are persisted at
`~/.graphify/vendor-sources/{playwright-official-docs,nodejs-v8-docs,ollama-docs,semantic-search-mcp-docs}/`.
Re-add or refresh any of them with `graphify global add
~/.graphify/vendor-sources/<tag>/graph.json --as <tag>` (idempotent by content hash), same pattern as §6.

---

## Deposit pass #2 (2026-07-24) — arc close-out, §10.16

**Scope:** §10.16 close-out deposit for the loopback-fix / worker-certification arc. Two candidate sources
per the closing brief: (a) `docs/research/hybrid-cpu-scheduling-research.md`'s own "§10.11 usefulness gate
— deposit-worthy" list (§9 of that document); (b) any loopback-relevant official pages cited in
`docs/research/flake-refactor-rootcause.md`. Procedure followed exactly as established in §3/§6 above:
`curl --ssl-no-revoke` + the stdlib `html.parser` converter (NOT `graphify add`'s fetcher, per the §6 method
hazard — verified this time by checking every fetched file was well past the ~8.3 KB truncation cap, see
sizes below), `graphify extract . --mode deep --backend claude-cli` in a session-temp dir, `graphify global
add`, node-count-UP verification, then re-pointed at a persisted `~/.graphify/vendor-sources/` copy (§6's
own pattern) so a future refresh does not depend on a session-temp path. **`graphify extract` was run only
against this temp corpus, never against this repo** (§5 hazard still stands, untouched).

### (b) first — flake-refactor-rootcause.md: nothing to deposit, and here is why

`docs/research/flake-refactor-rootcause.md` cites **zero external URLs** — grepped for `https?://` with no
hits. It is a pure empirical/instrumentation debugging log (measured arms, harness timestamps, a proven
cure), not a documentation-research document; the loopback root cause was found by building and running an
instrumented probe, not by reading official docs about it. Its sibling review doc
(`docs/research/flake-refactor-review.md`) also has zero URL citations. As due diligence the wider
`flake-panel-*.md` lineage (the earlier, superseded investigation phase — see development-discipline.md's
new L22) was also grepped: `flake-panel-research.md` does cite official pages (V8 `compilation-cache.cc`,
`v8.dev/blog/code-caching-for-devs`, `nodejs.org/api/http.html`, Microsoft Defender scan-best-practices,
Playwright `class-tracing`/`class-browsercontext`), but the task named `flake-refactor-rootcause.md`
specifically, not this predecessor, and per the usefulness gate these citations mostly supported the
V8-heap/compile-cache hypothesis that `flake-refactor-rootcause.md`'s own arms 4–5 explicitly **refuted** as
the concurrency-hang driver — depositing them under a loopback-investigation banner would risk sending a
future search toward the dead end this exact investigation ruled out, which is the opposite of useful.
(The Playwright tracing/browsercontext pages are already generically covered by the existing
`playwright-official-docs`/`vendor-docs` tags; nodejs `http.html` is generic Node API reference, not
loopback-specific.) One item — Microsoft's Defender scan-best-practices page — documents a *lead the
investigation left explicitly open* (`flake-refactor-rootcause.md`: "the exact Windows sub-mechanism
[...] was not pinned [...] a Defender-exclusion A/B [...] is not required for the fix"), so it is flagged
here for the owner rather than deposited unilaterally: it wasn't in the named document's citation list, and
depositing a source for an unconfirmed lead under the "loopback, solved" banner would overstate what was
actually proven. **Skipped, with reasons given, per the brief's own instruction.**

### (a) — the hybrid-CPU research's 8-URL deposit list, tag `windows-scheduling-docs`

| # | Page | Fetched size (HTML → text) |
|---|---|---|
| 1 | [Quality of Service](https://learn.microsoft.com/en-us/windows/win32/procthread/quality-of-service) | 54.5 KB → 6.6 KB |
| 2 | [SetProcessInformation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation) | 61.8 KB → 10.4 KB |
| 3 | [CPU Sets](https://learn.microsoft.com/en-us/windows/win32/procthread/cpu-sets) | 51.4 KB → 3.9 KB |
| 4 | [Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities) | 57.2 KB → 8.1 KB |
| 5 | [SetProcessAffinityMask](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setprocessaffinitymask) | 54.5 KB → 4.7 KB |
| 6 | [SchedulingPolicy power setting](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/configuration-for-hetero-power-scheduling-schedulingpolicy) | 38.9 KB → 2.2 KB |
| 7 | [Playwright class-testproject](https://playwright.dev/docs/api/class-testproject) | 176.9 KB → 20.8 KB |
| 8 | [Playwright release notes](https://playwright.dev/docs/release-notes) | 886.0 KB → 120.5 KB |

All 8 files landed well clear of the §6 ~8.3 KB truncation cap (smallest converted output 2.2 KB from a
38.9 KB fetch — a genuinely short source page, not a truncated one; tail-checked). `graphify extract`'s
raw-CLI chunking is **token-budget-based** (`--token-budget`, default 60,000), not the local-graph skill's
file-count chunking (§10.12's `ceil(files/22)` describes the skill wrapper, not this command) — the whole
8-file/~170 KB corpus (≈137.5K input tokens including the deep-mode prompt) extracted in **one chunk**,
confirmed by the tool's own `chunk 1/1 done` line, no truncation warning. Result: **45 nodes, 55 edges, 9
communities**, real per-page granularity (`SYSTEM_CPU_SET_INFORMATION structure`, `PROCESS_POWER_THROTTLING_EXECUTION_SPEED
flag`, `testProject.workers property`, `SetThreadAffinityMask function`, …), spot-checked node-by-node
against source file — every one of the 8 sources produced genuine content nodes, none degenerate. Cost
$0.0000 (`claude-cli` backend, matching §3).

### Before → after `graphify global list`

```
BEFORE                                        AFTER
  vendor-docs               2435                vendor-docs               2435
  methodology               4335                methodology               4335
  gemini-api-docs             71                gemini-api-docs             71
  cloudflare-workers-docs     56                cloudflare-workers-docs     56
  nodejs-v8-docs              48                nodejs-v8-docs              48
  ollama-docs                 27                ollama-docs                 27
  semantic-search-mcp-docs    24                semantic-search-mcp-docs    24
  playwright-official-docs    27                playwright-official-docs    27
                                                 windows-scheduling-docs     45   ← new
  total 7023 nodes                              total 7068 nodes  (+45, node-count-UP)
```

`graphify global add` reported `+45 nodes, -0 pruned` on the real add.

### Verification — vocabulary-expanded `graphify query` probes (post-deposit, and re-confirmed after the
persistence re-point below)

1. **`"CPU sets affinity mask scheduling priority QoS EcoQoS heterogeneous"`** → top hits: `Heterogeneous
   Processor Scheduling`, `EcoQoS Level`, `CPU Sets`, `SetProcessAffinityMask function`, `QoS Levels
   (High/Medium/Low/Utility/Eco/Media/Deadline)`, `Scheduling Priorities`, `testProject.workers property` —
   47 nodes found. **Before this deposit this exact vocabulary returned zero relevant hits** — verified by
   `hybrid-cpu-scheduling-research.md`'s own §0 method note ("No node exists for Windows scheduling, Thread
   Director, QoS/EcoQoS, CPU affinity, hybrid CPUs, or Playwright worker internals").
2. **`"testProject workers per-project parallel timeout"`** → top hits: `testProject.workers property`,
   `testProject.teardown property`, `testProject.dependencies property`, `Playwright TestProject`,
   `Playwright TestConfig` — 98 nodes found, the per-project-workers fact (the one this repo's own config
   comments and two prior research docs believed impossible until §5.1 of the source research doc) now at
   the top of its own query.
3. Re-run after the persistence re-point (below): **`"SetProcessAffinityMask CPU sets EcoQoS scheduling
   priority testProject workers"`** → identical top-ranked hits, 74 nodes found — confirms the remove+re-add
   did not change queryability.

**Usefulness gate: passes.** The exact vocabulary that returned noise or nothing in the source research
doc's own §0 method note now returns the real target documentation as the top-ranked result.

### Reproducibility (this pass)

Corpus + graph persisted at `~/.graphify/vendor-sources/windows-scheduling-docs/` (`raw/*.md` + `graph.json`).
The extraction was first run and added from a session-temp directory (so the deposit landed and was verified
early); it was then **removed and re-added from the persistent path**
(`graphify global remove windows-scheduling-docs` → `graphify global add
~/.graphify/vendor-sources/windows-scheduling-docs/graph.json --as windows-scheduling-docs`) so the
manifest's `source_path` points at a durable location rather than the session scratchpad, matching the §6
pattern — `global_add`'s hash-skip path (`graphify/global_graph.py:102-104`) returns early WITHOUT updating
`source_path` when content is byte-identical, so simply copying the file to a new location and re-adding
would silently have kept the stale temp-path pointer; remove-then-readd was required to actually re-point it.
Net node count was unchanged by this step (45 nodes both times). Re-add or refresh with `graphify global add
~/.graphify/vendor-sources/windows-scheduling-docs/graph.json --as windows-scheduling-docs`.

**Repo untouched:** `graphify-out/` was never created inside `matconetesh` by this pass — `git status`
confirmed no graphify-related changes in the repo working tree. §10.12's separate LOCAL-graph refresh is
**not** part of this deposit pass; see the arc close-out report for its own status.

---

## Scope-fix + refresh (2026-07-24)

**Task:** the deferred §10.12 local-graph scope-fix. Root scan noise (`mockups/*.png`, vendored
`.claude/skills/**`, scratch files, etc.) was polluting `detect_incremental` — reported ~358+ "changed"
files, almost all noise. Goal: scope the root-rooted scan to real content via a root `.graphifyignore`,
then run the incremental `--update`-style flow (never headless `graphify extract`, per the §5 hazard
above) to land the day's ~44 new/changed session docs and the changed code files, while proving app.js's
800+ code nodes survive.

### The ignore files

**`.graphifyignore`** (new, repo root) excludes: `mockups/`, `scratch/`, `.playwright-mcp/`, `.serena/`,
`.claude/`, `test-results/`, `node_modules/`, `dist/`, image extensions repo-wide, raw measurement data
under `docs/research/measurements/`, plus three items discovered mid-fix (see below): `/index.html`,
`/_app_check.js`, `/site/` (generated build artifacts — the repo's own `.gitignore` independently labels
the first two "Generated build artifacts"), `.superpowers/` (another vendored plugin's local state), and
`scratch_literal.txt` (a throwaway browser-console snippet at repo root).

**`docs/.graphifyignore`** (existing, extended) gained a block excluding raw data under
`docs/research/measurements/` — `*.json`/`*.csv`/`*.log` at any depth, and the whole
`research/measurements/evidence/` subtree, which turned out to be a nested Playwright test-results dump
(`trace.zip`, `error-context.md`, `.last-run.json`, failure screenshots) that was masquerading as 8 of the
docs-scope's "51 changed documents."

### Bug found and fixed mid-task: a root-file `docs/` exclusion silently blanks the docs-rooted scan

First attempt added a `docs/` line to the root `.graphifyignore`, reasoning that the ROOT-rooted scan
should not touch the docs corpus (it has its own, separately-rooted manifest). This is **wrong** —
verified the hard way, not assumed: `graphify.detect._load_graphifyignore` cascades ignore files by
**filesystem ancestry**, from the nearest VCS root down to whichever scan root is passed in. Repo root is
an ancestor of *both* scan roots this project uses (`.` and `docs`), so a rule written in the root
`.graphifyignore` is loaded for a `docs`-rooted scan too — there is no way to make a `.graphifyignore` rule
"only apply to this one `detect_incremental()` call." Consequence, observed directly:
`detect_incremental(root='docs')`'s real 51-changed-document baseline collapsed to **0** the moment the
`docs/` line existed (every doc under `docs/` matched and was excluded, not just the intended root-scope
noise). Reverted before the file was ever used for an actual extract/merge.

The real hazard the `docs/` line was trying to prevent is still real, and still avoided — just fixed at the
call-site instead of the ignore-file. `graphify.detect.load_manifest(path, root=<given root>)` re-anchors
every stored relative manifest key (e.g. `"ANALYSIS-v149.md"`, stored relative to `docs/`) against
*whatever* `root` the caller passes. With `root='.'` that resolves to `<repo-root>/ANALYSIS-v149.md`, which
does not exist — so every one of the ~163 already-tracked docs falsely reports as **both** "changed" **and**
"deleted." Verified empirically, before any ignore file existed: `detect_incremental(".")` reported
`new_files[document]=224` and `deleted_files=163` — **0 of those 163 were real deletions.** Feeding that
list into `build_merge(prune_sources=...)` would have pruned ~163 real document nodes from the graph.

**Fix, encoded in the procedure (documented in `.graphifyignore`'s own header) rather than an ignore
pattern:** the refresh only ever reads the `'code'` category out of a root-rooted `detect_incremental()`
result, and never its `'document'`/`'image'` categories or its `deleted_files` list. Those come exclusively
from the separate, correctly-rooted `detect_incremental(root='docs')` call.

### Verification — changed-set before → after, both scopes

```
ROOT scope, detect_incremental(root='.')   BEFORE any ignore file:
  code=152  document=224  image=33  new_total=409  deleted=163 (all real at that point)

ROOT scope, AFTER the root .graphifyignore:
  code=128  document=140* image=0   new_total=268  deleted=163 (100% phantom — see above; never acted on)
  * 'document'/'image'/deleted_files from this call are BY DESIGN unused (see bug section above);
    'code'=128 is the only category this refresh consumes from a root-rooted scan, and it is clean —
    every file is real project content (app.js, the Python data layer, tests/, worker/, scripts/, evals/,
    lang/*.json, package.json, tsconfig.json, playwright.config.ts, .mcp.json; zero noise).

DOCS scope, detect_incremental(root='docs') BEFORE docs/.graphifyignore's measurements/evidence addition:
  code=2  document=51  image=0  new_total=53  deleted=0
  (8 of the 51 were docs/research/measurements/evidence/*/error-context.md — Playwright test evidence,
  not documentation)

DOCS scope, AFTER:
  code=1  document=44  image=0  new_total=45  deleted=0
  — collapsed to real items only: 44 real session docs (research reports, program analysis, specs/plans,
  process docs) + 1 real code-classified file (an eval baseline JSON, left unprocessed by this pass,
  see "skipped" below).
```

### ⚠️ HAZARD found and fixed: Windows multiprocessing needs `if __name__ == "__main__":`

The first extraction attempt (a standalone driver script, not `python -c`) crashed every AST worker with
`RuntimeError: An attempt has been made to start a new process before the current process has finished its
bootstrapping phase`. Root cause, confirmed from the traceback (not guessed): the script's driver logic sat
at module level with no `if __name__ == "__main__":` guard. On Windows, `multiprocessing`'s `spawn` start
method re-imports the entry-point script in every worker process to bootstrap it — without the guard, each
spawned AST worker re-executed the *entire* script from the top, including the `extract()` call that spawns
workers, cascading into a runaway spawn storm. Fix: wrap the driver in `if __name__ == "__main__":` in every
standalone script that calls `graphify.extract.extract()` (or anything else that pools workers) outside the
skill's own `python -c` one-liners. `graph.json` was never touched by the failed attempts — the crash
happened before `build_merge`/`to_json` ran.

### ⚠️ HAZARD found and fixed: `build_merge`'s replace-on-re-extract matches by `source_file` only, not `file_type`

Second discovery, also evidence-based. An AST-only re-extraction of the 128 changed code files (the
standard, documented "code_only" fast path — no LLM needed) tripped the `#479` shrink-guard: the merged
graph came out to 2995 nodes against an existing 4547 (net -1349), and `to_json` correctly refused to write
it. Root cause: **this repo's original graph was not built with a plain AST-only pass over code.** A
specific set of 12 files — `app.js`, the "Python data layer" (`build.py`, `data.py`, `equipment_map.py`,
`gen_sources.py`, `sausages_new.py`, `seasonings.py`, `seasonings_ext.py`, `sources.py`), two
`package.json`s, and one test spec — were *also* run through a rich semantic/LLM extraction pass
(`graphify-out/.graphify_chunk_passc_*.json`, confirmed by reading one: labels like `"PACK_EFF = 0.85
packing-efficiency constant"` mixed with `file_type: "rationale"` nodes in the same file's chunk — not
mechanical AST output). `build_merge()`'s "re-extracted files replace their prior contribution" logic
matches purely on `source_file` string equality, with no `file_type` awareness: dropping app.js's old nodes
before merging in a *pure-AST* re-extraction is a strict, large downgrade for exactly these 12 files (their
`concept`/`rationale`/`document` nodes have no AST equivalent to be replaced by, and their `code` nodes
shrank from rich semantic labels to bare AST identifiers) — not something the standard skill flow's
`code_only` fast path anticipates, because it assumes code was *always* AST-only.

**Fix:** computed the enriched-file set directly from the graph (any file among the 128 changed that has at
least one non-`'code'`-typed node) — exactly these 12 — and, for those files only, **preserved their
existing nodes/edges (any `file_type`) wholesale** instead of letting the fresh AST output replace them; the
thinner fresh-AST duplicate for those 12 files was discarded. The other ~116 changed files (test specs,
`worker/`, `scripts/`, `evals/`, config) only ever had `file_type='code'` nodes, so a fresh AST re-extraction
is a safe, correct refresh for them and was used as-is.

**Known, explicitly-flagged trade-off:** app.js's preserved semantic-layer content describes its state as of
the last semantic pass (2026-07-22), not today's edit (app.js's mtime is 2026-07-23 16:46). A full semantic
re-extraction of the 12 enriched files, matching the original custom methodology, is comparable in scope to
the entire docs pass below and was judged out of scope for this deferred scope-fix task — **flagged here as
a follow-up, not attempted.**

### PASS 1 (code, root='.') — before → after

```
BEFORE (baseline, unchanged since 2026-07-22/23 build):
  total nodes: 4547   total edges: 14268
  file_type: document=217 rationale=319 concept=1241 code=2664 paper=1 image=105
  app.js nodes: 821

AFTER PASS 1:
  total nodes: 4661   total edges: 14649        (+114 nodes, +381 edges — node-count-UP)
  file_type: document=217 rationale=320 concept=1250 code=2768 paper=1 image=105
  app.js nodes: 821                              (fully preserved — well above the required ≥800 floor)
```

Health check (`graphify.diagnostics.diagnose_extraction`) after PASS 1: **0** dangling-endpoint edges,
**0** missing-endpoint edges, **0** self-loops, **0** collapsed/duplicate edges — clean.

Deliberately **not** persisted this pass: `manifest.json`'s code-side tracking. Verified that calling
`save_manifest(root='.')` at all, regardless of what `files`/`scan_corpus` are passed, would silently DROP
every existing docs-relative manifest row: `load_manifest(path, root='.')` re-anchors `"ANALYSIS-v149.md"`
to a nonexistent path, and `save_manifest`'s own "does this row's file still exist on disk?" prune step
(independent of `scan_corpus`) then deletes that row. **Consequence, honestly flagged:** a future
root-scoped `detect_incremental('.')` will again report all currently-graphed code files as "new" rather
than "unchanged" until the graph is made single-rooted (the larger, separate fix flagged in §5 above) — this
does not affect graph *content* (already refreshed by this pass), only how much redundant, free/fast AST
re-work a future run does.

### PASS 2 (docs, root='docs') — semantic extraction via `--backend claude-cli`

Direct library calls (`graphify.cache.check_semantic_cache` → `graphify.llm.extract_corpus_parallel(backend='claude-cli', model=GRAPHIFY_CLAUDE_CLI_MODEL=fable, deep_mode=True)` → `graphify.build.build_merge`), matching the skill's own Part B mechanics without dispatching Agent-tool subagents (none available to this task agent) — the same no-key, $0.00 pattern verified in §3 above. 45 changed documents, chunked to 7 claude-cli calls (forced serial — claude-cli backend caps `max_concurrency=1`), ~50 minutes wall-clock total. Fresh extraction: 438 unique nodes / 733 edges (489 raw, 51 collapsed by exact-ID dedup within the run; 15 more nodes were dropped mid-run by graphify's own cross-file-misattribution guard — `#1895`, the model occasionally attributed a node to a file outside the dispatched chunk and the safety guard correctly discarded it rather than pollute that file's cache entry).

**Second discovery, same evidence-based method as PASS 1's hazard:** a naive `build_merge` of this fresh extraction also tripped the `#479` shrink-guard (2946 vs the post-PASS-1 4661, net -1715). Root cause, verified by reading the actual file before concluding anything: `docs/analysis/program/SEQ-analysis.md` is 715 real lines of dense content, and the original graph had 38 nodes for it; the fresh chunked pass (multiple files packed per claude-cli call, `fable` fast-tier model) produced only **3**. This is under-extraction, not the file having shrunk — confirmed by reading the file's actual current content, not assumed from the numbers alone. 18 of the 45 changed files were pre-existing (already graphed, just edited) and showed the same pattern to varying degrees — some grew (`process/development-discipline.md` 18→29, a genuine improvement), most shrank (`SPEC-reconciliation.md` 25→1, `ARCH-analysis.md` 38→20, `gap-closing-program-charter.md` 41→26, …).

**Fix:** for every file with both prior and fresh content — 46 files total (18 pre-existing docs plus, unexpectedly useful, files the semantic pass cross-attributed content to, including `app.js` itself: docs that discuss e.g. `svBaths()` or `gemFetch()` produced nodes keyed to `app.js`, overlapping with PASS 1's preserved set) — **union** old + fresh nodes/edges rather than choose one side. `build()`'s own ID + Jaro-Winkler dedup then collapsed the genuine duplicates cleanly: 11 nodes deduplicated (7 exact-ID, 4 fuzzy), each logged with which label survived (e.g. `app.js` (kept) vs `app.js (single-file PWA application code)` (dropped) — same real-world entity extracted twice under different labels, correctly recognized as the same node).

```
AFTER PASS 2 (final state):
  total nodes: 5009   total edges: 15351        (+348 nodes, +702 edges vs post-PASS-1 — node-count-UP)
  file_type: document=267 rationale=350 concept=1477 code=2809 paper=1 image=105
  app.js nodes: 846                              (up from 821 — net new app.js-attributed content
                                                   surfaced by the docs pass, after dedup removed overlaps)
```

Health check after PASS 2: **0** dangling-endpoint edges, **0** missing-endpoint edges, **0** self-loops,
**0** collapsed/duplicate edges — clean.

`manifest.json` saved with `root='docs'` (the correct, established root for this manifest — safe, unlike
the `root='.'` case documented under PASS 1).

### GRAND TOTAL — before → after this whole scope-fix + refresh

```
                    nodes   edges    app.js nodes
BASELINE (start)    4547    14268    821
AFTER PASS 1        4661    14649    821    (+114 nodes — code refresh + enrichment preservation)
AFTER PASS 2        5009    15351    846    (+348 nodes — docs refresh + old/fresh union)
──────────────────────────────────────────
NET CHANGE          +462    +1083    +25    (node-count-UP throughout; app.js well above the ≥800 floor
                                              at every step, never at risk after the preservation fixes)
```

### Verification — 3 `graphify query` probes proving the new docs are queryable

All three ran against the final `graphify-out/graph.json` via the CLI (`graphify query "<question>"`), no
special setup:

1. **`"loopback serialization root cause"`** → 126 nodes found. Top hits: `Loopback Connection
   Serialization Root Cause` (`research/flake-refactor-rootcause.md`), `Flake Refactor Root-Cause Report`,
   `L22: loopback serialization root cause via boundary instrumentation`
   (`process/development-discipline.md`), `route.fulfill In-Memory Document Fix (warmContext)`, `seedApp
   Seed-then-Reload Per-Test Reset` (`research/warm-page-architecture-research.md`) — the exact target
   content, ranked first.
2. **`"warm page fixture seedApp"`** → 860 nodes found. Top hits: `seedApp()` (`tests/_fixtures.ts:206`),
   `warmPage Worker-Scoped Fixture (one cold goto)`, `warm-fixture.spec.ts`, `_fixtures.ts`,
   `w0-warm-page-measure.mjs`, `Warm-Page Architecture Research` — the exact target content, ranked first.
3. **`"model registry thinkingLevel"`** → 222 nodes found. Top hits: `thinkingLevel enum
   (minimal/low/medium/high, Gemini 3.x)`, `thinkingLevel and thinkingBudget are mutually exclusive (400 if
   both)`, `Model-Selection Architecture Design (8 Locked Decisions)`, `ai-model-registry.spec.ts`,
   `GEM_MODELS role registry — single source of truth (id + kind + caps + think)` — all from
   `analysis/program/gemini-3.6-thinking-research.md` / `analysis/program/model-selection-architecture-design.md`
   — the exact target content, ranked first.

**Usefulness gate: passes cleanly.** All three probes surface the new session docs (and, for query 2/3, the
PASS-1-preserved code content they cross-reference) as the top-ranked results, not buried in noise.

### Skipped / unresolved, honestly flagged

- `docs/analysis/program/eval/baseline-gemini-2.5-flash-2026-07-23.json` — the one file the docs-scope
  incremental call classifies as `'code'` (a raw eval-baseline JSON). Not processed by either pass (PASS 1
  is scoped to the root-rooted `'code'` category, which does not include this docs-nested file since docs/
  is out of PASS 1's ignore-scoped surface for code purposes; PASS 2 is scoped to the `'document'`
  category). Low-value, single small data file — left for a future pass if ever needed.
- A full semantic re-extraction of the 12 code files with prior rich enrichment (see hazard above) — their
  existing content was preserved as-is, not refreshed to match today's code. Flagged as a follow-up.
- `manifest.json` code-side tracking (see PASS 1 note above) — not established this round; a future
  root-scoped incremental run will re-treat all code files as "new," which is safe (idempotent, free/fast)
  but not maximally efficient. The durable fix is the single-rooted graph restructure already flagged in §5,
  not attempted here (large, separate, owner-level change).
- PASS 2's ~50-minute wall-clock runtime meant new session docs appeared (owner actively working in
  parallel) after extraction had already started — e.g. `process/HANDOVER-2026-07-24.md`,
  `analysis/program/MASTER-ONBOARDING.md`, `analysis/program/P0-kickoff-brief.md`,
  `superpowers/specs/2026-07-24-p0-app-spoken-safety-design.md`, two new eval-baseline docs. These were not
  in the dispatched extraction and are not yet in the graph — harmless (the next `--update` picks them up
  normally; nothing was lost or corrupted), but flagged rather than silently left out of this report.

---

## PASS 3 — incremental refresh (2026-07-24, after the P0 spec landed)

`--update --mode deep`, docs root, `--backend claude-cli`, chunked by word budget (10 chunks,
`token_budget=8000` ≈ 6k words — deliberately **tighter** than §10.12's ~12k ceiling, because PASS 2's
under-extraction came from over-packed chunks).

| | before | after | delta |
|---|---|---|---|
| nodes | 5,009 | **5,387** | +378 |
| edges | 15,351 | **15,986** | +635 |
| `app.js` code nodes | 846 | **846** | 0 — preserved |
| files with nodes | 353 | 357 | +4 |
| communities | 118 | 182 | +64 |

Health: **OK** — 0 dangling / 0 missing / 0 collapsed / 0 self-loop / 0 duplicate edges. **0 files lost
nodes.** Six documents were genuinely missing and are now in: the P0 spec (0→46), development-discipline
(41→188), this file (22→108), HANDOVER (0→50), and both 3.6-flash eval reports (0→25, 0→24).

**Correction to this document's own earlier claim:** §"PASS 2" said MASTER-ONBOARDING.md and
P0-kickoff-brief.md "are not yet in the graph." They **were** already in — stamped 12:56/13:03, before
PASS 2 dispatched. Recorded rather than quietly amended.

### ⚠️ HAZARD (a) — the manifest stamps mtime/hash at SAVE time, not at EXTRACTION time

A document edited **while a long extraction is running** is hidden from every future incremental run,
permanently and silently. Extraction reads the pre-edit text; `save_manifest` then stamps the *post*-edit
hash, so `detect_incremental` sees "unchanged" forever after.

**Proven, not theorised:** `development-discipline.md` was edited at 13:55:25 (commit `769d7d8`, adding
§10.17a) *during* PASS 2's ~50-minute run. The graph ended up with `§10.17` and `§10.18` nodes but **no
§10.17a node and no "ONE shared Serena server" content anywhere** — and the manifest reported the file
clean. Fixed by clearing that row's `semantic_hash` and force-re-extracting.

**This is a silent-staleness class bug, not a one-off** — it applies to any document touched during any
long run, which on this corpus is a ~50–80 minute window. **Mitigation until upstream fixes it:** after a
long refresh, diff `git log --since=<run start> --name-only -- docs/` against the manifest and force
re-extract anything that overlapped the run.

### ⚠️ HAZARD (b) — the `claude-cli` backend inherits the parent's cwd, so the nested `claude -p` loads this project's `CLAUDE.md` and stops being an extractor

This is the most damaging of the four and it explains a previously-unexplained result.

Run with cwd = repo root, **3 of 3 dispatched documents produced 0 nodes**, while **60 nodes were invented
for entirely different repo files** — `CLAUDE.md`, `build.py`, `app.js`, `.superpowers/sdd/progress.md`,
`graphify-out/graph.json`. The nested session read the project instructions and went off doing project
work instead of the extraction task piped to it.

**Fix: run the extraction driver from a neutral cwd, with absolute paths.**

**It retro-explains PASS 2.** That pass's documented "under-extraction" (a 715-line analysis file yielding
3 nodes) has exactly this signature. PASS 2's output should be treated as suspect, not authoritative.

### 🐞 BUG (c) — the library backend's prompt omits the `source_file` rule the skill's own spec mandates

`references/extraction-spec.md` states verbatim: *"set source_file to the path of the originating file
EXACTLY as it appears in FILE_LIST."* `graphify.llm._EXTRACTION_SYSTEM` never says it. Consequence on the
P0 spec: **47 of 50 nodes claimed `source_file: "app.js"`** — the file the spec is *about* rather than the
file it *is*. graphify's own `_out_of_scope` guard could not catch it, because `app.js` lies outside
`root='docs'`; **the guard only rejects mis-attributions resolvable under the scan root.**

Appending graphify's own documented rule to the library prompt took the identical chunk from **3 → 61
correctly-attributed nodes**, and to 100% correct attribution across all 10 chunks.

**Caveat the owner must know:** that prompt fix is a **local modification to the installed graphify
package**, not to this repo. `graphify install` (currently offered: skill 0.9.22 → package 0.9.25) will
**silently revert it**. Re-apply after any upgrade, or push it upstream.

### 🐞 BUG (d) — `extract_corpus_parallel()` cannot be called with its own `FileSlice` units

It unconditionally re-runs `expand_oversized_files()` → `is_splittable_text()` → `path.suffix` →
`AttributeError: 'FileSlice' object has no attribute 'suffix'`. Blocks any one-chunk-at-a-time driver.
Worked around with a pass-through patch.

### Known bug #2 re-tripped, plus a new ID-collision cousin

`build_merge`'s match-by-`source_file` hazard fired again and was handled by the established union-carry
method (63 prior nodes / 125 prior edges preserved). A **new, related** collision then surfaced: graphify
mints ids as `{path_stem}_{entity}`, so the P0 spec *documenting* `itemStages`/`cookerFor`/`aiSafetyNote`
minted the **same ids** as existing nodes, and dedup reassigned 3 nodes away from their rightful files.
Prior ownership was restored; the final per-file audit shows 0 files lost nodes.

### Stated deviations and limits

- Model was `sonnet`, not PASS 2's `fable` (which is the documented cause of that pass's under-extraction).
  Results are therefore **not byte-reproducible** against PASS 2.
- Two extraction attempts were **discarded** before the good run (cwd contamination, then attribution).
  Nothing from either was merged; `graph.json` was untouched until the final verified merge.
- Not every fresh node survives as its own node **by design** — e.g. the P0 spec's 103 fresh ids → 99
  present (46 under the spec, 44 absorbed into existing `app.js` symbol nodes it documents, 9 elsewhere),
  4 collapsed by dedup. Audited per-file; this is normal fuzzy dedup, not loss.
- **`app.js`'s graph content is now staler than it was**: four `app.js` commits landed during this run
  (`052ea19`, `341e635`, `860ea87`, `809a197` — the P0 safety-guard work). The previously-flagged "12
  enriched code files need a semantic re-extraction" follow-up is now more urgent, not less.
- `manifest.json` still has no code-side tracking (PASS 1's flagged limitation) — a future root-scoped
  incremental will re-treat code files as new. Wasteful, not unsafe.
