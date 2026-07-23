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
