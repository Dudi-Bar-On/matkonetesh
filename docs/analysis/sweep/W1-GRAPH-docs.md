# W1-GRAPH — Knowledge Graph over `docs/` (graphify, deep mode)

Build date: 2026-07-22. Corpus: `docs/` only, 137 files (~370,508 words: 62 markdown/text
documents + 75 images), `--mode deep`. Outputs: `graphify-out/graph.json`,
`graphify-out/graph.html`, `graphify-out/GRAPH_REPORT.md`.

## How the build was recovered

The prior attempt chunked by `ceil(files/22)` on file count alone and died on a 22-file
chunk (dense research/orchestrator specs) that exceeded the subagent's 64,000-output-token
cap. This run reused `.graphify_chunk_01.json`/`_02.json` (204 + 161 nodes, already valid)
and re-chunked only the remainder by word budget instead of file count:

- 14 leftover documents (docs/superpowers/plans + specs, ~38,900 words) → 4 chunks
  (03b–03e) targeting ~9,500–13,000 words each.
- 75 images, never attempted in the original run at all → 19 chunks of 4 images each
  (vision-only, never mixed with text) rather than literally one image per chunk — a
  pragmatic reading of the skill's "images get their own chunk" rule, sized to land near
  the skill's own "25-35 chunks" estimate for the whole corpus (final: 28 chunks total).
- Even after this split, one chunk (03d, 5 spec files including the Phase 3a orchestrator
  design) hit the *same* 64k-output-token wall on its first attempt. Fix: split further
  into 03d1/03d2/03d3, with the dense Phase 3a orchestrator file alone in its own chunk
  (03d2) and an explicit "keep output compact" instruction in the subagent prompt. All 3
  succeeded on retry.

**Token cost.** graphify's own per-chunk `input_tokens`/`output_tokens` fields were left at
their placeholder zeros (not backfilled from each Agent call's `usage` before merging).
The real cost is visible in the Agent tool's reported subagent-conversation token usage:
observed directly for 19 of the 25 agents dispatched this session (6 doc chunks +
13 image chunks), summing to **~2.06M tokens**; the remaining 6 image chunks (img01–06)
completed but their usage wasn't captured in this transcript — extrapolating from the
other 13 image chunks' average (~92k each) puts the full resumption session at
**~2.6M tokens**. This does not include the original session's cost for chunks 01/02/03a.

## Graph stats

- **1,082 nodes**, **1,723 edges** (1,731 raw edges before the undirected build collapsed
  8 same-endpoint pairs that legitimately carry two relation types, e.g. `references` +
  `semantically_similar_to` between the same two docs — not corruption; health check found
  zero dangling/missing-endpoint edges).
- Node types: 603 concept, 149 rationale, 118 document, 106 code (function/mechanism names
  cited *inside* docs — no code files were in scope), 105 image, 1 paper.
- **69 communities** (Louvain), sizes 1–53. Full labels in `graphify-out/.graphify_labels.json`
  and `GRAPH_REPORT.md`; largest: AI Safety Guardrails & Autonomy (53), Equipment 2.0 Data
  Model (52), AI Strategy & Trust Features (48), Equipment Add-Form UI (44),
  Equipment Brand Lookup & Orchestrator (40). Orchestrator/scheduler material is split
  across ~10 communities (6, 7, 9, 13, 25, 38, 42, 45, 49, 50, 59) rather than one — see Q3.

## Bilingual assessment

Hebrew and English form separate islands, as expected — graphify's query matcher has no
cross-language matching. Concretely: `ANALYSIS-v149.md` is the #2 god node (41 edges) while
its Hebrew twin `ANALYSIS-v149-he.md` has only 5 cross-file edges and 1 connected file;
`OPERATIONS-v157.md` (9 edges, 3 files) vs `OPERATIONS-v157-he.md` (5 edges, 1 file) shows
the same pattern. The **only** exception: 10 explicit `conceptually_related_to` edges
(INFERRED, 0.95) directly bridge specific EN/HE finding-pairs between these two twin-pairs
— but that happened only because chunk_01 processed both language variants in the *same*
subagent context, letting the LLM manually recognize "this Hebrew line is a translation of
that English line." It is not graphify doing cross-language matching, and it did not happen
for any other Hebrew-titled document processed in a separate chunk from its English source
(e.g. the Hebrew UI terms embedded in the 75 screenshots stay disconnected from the English
prose describing the same features unless a subagent happened to note the parallel itself).

## Q1 — Architectural hubs (god nodes)

Top 10 by degree (`graphify god-nodes`), overwhelmingly the meta-audit documents that
survey the rest of the corpus rather than the specs themselves:

1. **Outstanding Register — Verified Against Current Source** (2026-07-21) — 43 edges
2. **ANALYSIS v149 — Deep Analysis** (10-dimension audit) — 41
3. **Cookout Orchestrator & Equipment Conformance Audit** (2026-07-22) — 33
4. **Requirements Conformance Audit** (2026-07-21) — 31
5. **Audit — Research, Safety/Sources, i18n vs Shipped Code** (2026-07-22) — 29
6. **Refactoring Report — Equipment, Occupancy & Orchestration** (2026-07-21) — 25 (also the
   single highest-crossedge *file* once every node under it is aggregated: 75 cross-file
   edges into 11 other files)
7. **OPERATIONS v157** — 23
8. **AI Strategy** — 21
9. **Device Occupancy: The Diagram This Should Have Been** — 20
10. **Scheduling Architecture — Why the Orchestrator Cannot Place Along a Timeline** — 20

## Q2 — Isolated documents (orphaned specs)

By aggregating cross-file edges per source file (not just single node degree), the
genuinely orphaned real documents — as opposed to screenshots, which are naturally
low-degree because of small 4-image vision chunks — are:

- **`docs/equipment-2.0-gaps-2026-07-15.md`** — 2 cross-file edges, touches only 1 other file.
- **`docs/REVIEW-v147.md`** (catalog sign-off, 9 nodes) — 4 edges, only 1 other file.
- **`docs/matkonetesh-modes-demo.html`** — 4 edges, 1 other file.
- **`docs/home-adaptive-design.md`** — 3 edges, 2 other files.
- **`docs/sources/baldwin-backbone.md`** and **`docs/sources/agent-research-protocol.md`** —
  5 edges each, 1 other file each.
- **`docs/superpowers/specs/2026-07-15-cookout-orchestrator-equipment-2.0-design.md`**
  (Phase 1 design, 27 nodes) — only 5 cross-file edges into 1 other file, despite being a
  core orchestrator spec.
- Both Hebrew twins above (`ANALYSIS-v149-he.md`, `OPERATIONS-v157-he.md`).

## Q3 — The orchestrator (Phase 3a: solver, moves, applyMove)

Confirmed by `graphify query "orchestrator solver move moves apply phase constraint slot
cooker contention"` (vocab-expansion Step 0 passed — all 10 tokens exist in-vocab). The
full model is fully specified in **`docs/superpowers/specs/2026-07-17-cookout-orchestrator-
phase3a-design.md`** (community 0): `orchestrate(computed, scope)`, `movesForClash()`,
`applyMove(move, scope)`, the Move object schema (`{id, kind, clashIdx, itemKey, devId,
he/en, delta, risk}`), 5 move kinds (share/wood/reassign/hold/advise), `safetyGate()`,
constraint model (`share_constraint`, `rack_budget`/slot model, `device_capacity_constraint`),
the safety spine (hot-hold floor, danger-zone budget, `holdCapMin`), and explicit
"deferred, not this slice" nodes (Phase 3b live enforcement, autopilot UI, cross-event
optimization). The design doc even names its own build slices (v250/v251/v252).

But the graph shows this was never shipped: the node **"Phase 3a auto-optimize solver
(orchestrate/movesForClash/applyMove) — never built"** is cited directly from
`analysis/2026-07-21-scheduling-architecture.md` and `analysis/2026-07-22-audit-orchestrator.md`.
`graphify path` from that node lands with a 1-hop `references` edge into the design spec's
own `orchestrate()` node — i.e. the audits are pointing at the same functions the design
doc names, confirming build-vs-spec is exactly the gap, not a different (undocumented)
solver. The requirement lives entirely in one design doc; the shipped code lives in
`app.js`'s `cookerContention()`/`combinedEventsRows()` (an earlier, simpler detector), and
three separate audits independently flag the delta.

## Q4 — Same subject specified twice (candidate contradictions)

The graph's `semantically_similar_to`/`conceptually_related_to` INFERRED edges (no EXTRACTED
citation between the pair — i.e. neither document cites the other) surface several
same-subject-twice clusters:

1. **Competing home-screen strategies**, never cross-referenced: `fire-guide-ux-refactor-
   prompt.md`'s "one app, three modes (beginner/home/pro)" vs `home-adaptive-design.md`'s
   "gear-derived home launcher" — confirmed via `graphify path`, a single INFERRED hop,
   0 EXTRACTED edges between the two files.
2. **Safety-number policy vs. audited reality**: `ai-strategy.md`'s "safety numbers always
   from app presets, never the model" principle directly contradicts `ANALYSIS-v149.md`'s
   own finding "T1: safety numbers baked into prose" — the stated policy and the audited
   implementation disagree.
3. **The "honest fill" principle restated verbatim, twice, uncited**: Equipment 2.0 Phase 1's
   "never invent a measurement" vs. the Phase 2 occupancy spec's "honest fill — three states
   only" — `graphify path` confirms a single INFERRED hop with no citation linking them,
   per the extracting subagent's own note that "both restate the same rule almost verbatim."
4. **The English/Hebrew audit twins** (`ANALYSIS-v149.md`/`-he.md`, `OPERATIONS-v157.md`/
   `-he.md`) are the same audit content specified twice in two languages, with only 10 of
   the underlying findings explicitly bridged — the rest can silently drift apart across
   language versions with no graph-visible link enforcing parity.

I was not given the owner's original hand-found four to diff against directly — these are
what the graph itself surfaces as candidates; worth a manual cross-check against the
owner's list.

## Deep mode: signal vs. noise

The extra INFERRED edges deep mode produces were net useful, not noisy: they're what
surfaced all four Q4 candidates above (each is an INFERRED edge with zero supporting
EXTRACTED citation) and the cross-community links tying scattered orchestrator/scheduler
material together (Q3). The cost was two 64k-output-token failures from subagents being
"aggressive with INFERRED edges" on already-dense docs — mitigated by shrinking chunk size
further and adding an explicit compactness instruction, not by turning deep mode off.

---

# 2026-07-22 incremental update — the sweep's own output enters the graph

Second graphify pass, same day. The 09:22 build above mapped the corpus the discovery sweep
*read*; it did not contain a single one of the sweep's own deliverables (verified against
`graphify-out/manifest.json`: 137 stamped files, zero matches for ULTIMATE / VERIFY- / W1-GRAPH /
business-model / W5- / W4-). This update merges those 26 documents in. `--mode deep`, per the
owner's standing instruction of 2026-07-22 (discipline §10.12).

## Totals, and the delta

| | before | after | delta |
|---|---|---|---|
| nodes | 1,082 | **1,579** | +497 |
| edges | 1,723 | **2,837** | +1,114 |
| communities (Louvain) | 69 | **99** | +30 |
| isolated nodes (0 edges) | 5 | 6 | +1 |
| degree-1 nodes | 294 | 390 | +96 |

Node types: concept 603→1,052, document 118→142, rationale 149→170, code 106→109, image 105→105
(unchanged — see the exclusion below), paper 1→1.

Extraction mix in the merged graph: 78% EXTRACTED / 21% INFERRED / 2% AMBIGUOUS (584 INFERRED
edges, avg confidence 0.82).

Graph health check (`graphify.diagnostics`): **OK** — 0 dangling-endpoint edges, 0 missing-endpoint
edges, 0 self-loops, 0 collapsed edges in the final extraction.

> Note on `GRAPH_REPORT.md`'s header: it reads "26 files". That is the *changed subset* this
> incremental run dispatched, not the graph's corpus — `.graphify_detect.json` carries the changed
> set in `files` and the full corpus in `all_files`, and the report reads the former. The graph
> covers the whole 163-file corpus. Do not read that line as a shrink.

## Corpus for this update

26 text documents, 101,329 words. Everything the sweep produced: the 21,429-word ULTIMATE gap
register, the 8 VERIFY-W1-* verifications, W1-C / W1-G / W1-GRAPH, the W4 business trio, the five
W5 reports, both `_*-returns.md` agent-return files, `2026-07-22-business-model.md`,
`analysis/graph/GRAPH_REPORT.md`, and the two new process SKILLs. `_agent-summaries.md`,
`sweep/README.md` and the sweep roster were checked against the manifest and were **unchanged**
since being stamped, so they were correctly not re-extracted.

## DELIBERATE EXCLUSION — 189 new screenshots were not graphed

**189 new images (188 under `docs/analysis/shots/sweep/`, 1 under `docs/analysis/shots/`) are NOT
in this update.** Two evidence-based reasons: (a) the build above found image nodes are naturally
low-degree and contribute mostly orphans — the image node count is unchanged at 105, and 100% of
the graph's AMBIGUOUS-edge backlog was screenshot material; (b) the previous run's image chunks
cost ~92k tokens per 4-image chunk, so 189 images is ~48 chunks and ~4.4M tokens, for artefacts
whose findings are already carried in prose by the reports that cite them.

This is stated so nobody later reads the graph as covering them. **Silent truncation reads as
coverage.** The exclusion is also visible to the tooling, not just to readers: the manifest has
**zero** `shots/sweep` entries, so those files stay unstamped and the next `--update` re-queues
them rather than treating them as done.

## Chunking — the lesson held

The 09:22 build died twice on `ceil(files/22)` file-count chunking. This run chunked by **word
budget** throughout: 12 chunks, ~6,000–11,500 words each, every prompt carrying an explicit node
budget (25–45), edge budget (40–90), a 90-char label cap and a "write compact JSON" instruction.

`2026-07-22-ULTIMATE-knowledge-and-gaps.md` (21,429 words, 141 gaps) was split **4 ways on its
own**, at band boundaries, never bundled with another file:

| chunk | content | nodes / edges |
|---|---|---|
| 01 | ULTIMATE §1–§2, §3.A safety, §3.B correctness (lines 1–497) | 46 / 110 |
| 02 | ULTIMATE §3.C–§3.H (lines 498–807) | 45 / 96 |
| 03 | ULTIMATE §4 refutation ledger (lines 808–1161) | 55 / 120 |
| 04 | ULTIMATE §5–§8 (lines 1162–1633) | 44 / 90 |
| 05 | VERIFY-W1-A/B/C/D | 41 / 90 |
| 06 | VERIFY-W1-E/F/G/H | 44 / 89 |
| 07 | W1-C, W1-G, W1-GRAPH, both process SKILLs | 44 / 100 |
| 08 | W4-A / W4-B / W4-C | 45 / 100 |
| 09 | business-model + W5-A-measured (same chunk, deliberately) | 44 / 100 |
| 10 | W5-B / W5-C / W5-D | 41 / 104 |
| 11 | W5-E + both `_*-returns.md` | 37 / 110 |
| 12 | `analysis/graph/GRAPH_REPORT.md` (hard cap 25/50) | 16 / 50 |

**Result: 12 of 12 chunks succeeded on the first attempt. Zero 64k-output-token failures.** Raw
extraction 502 nodes / 1,159 edges with **zero duplicate node IDs** across all 12 chunks.

Two techniques made the cross-chunk connectivity work, and both are worth reusing:

1. **A node-ID crib.** Every subagent was handed the existing graph's relevant node IDs (the W1-*
   sweep nodes, the meta-audit hubs, the spec/plan IDs, the `app_*` symbols) and told to emit edges
   into them rather than mint parallel nodes. This is what attached 26 new documents to the
   pre-existing graph instead of building a second island beside it.
2. **Pre-assigned canonical file-level node IDs** for all 26 files, given to *every* chunk. A chunk
   could then emit an edge to a document another chunk owned, because the ID was deterministic.
   Evidence it worked: chunk 04's 14 closing-step nodes carry 15 edges into gap nodes that chunks
   01 and 02 created, and chunk 03's 53 refutation nodes carry 115 edges, mostly into VERIFY
   documents owned by chunks 05 and 06. Only 3 guessed gap IDs and 1 plan ID missed.

## Relation vocabulary — a deliberate extension

The extraction spec's relation list has no way to say "this finding disproves that one", and the
sweep's central product is 42 refutations. Precedent existed (the 09:22 build already carries
`depicts` and `shows_navigation_to`, minted by the image chunks, and graphify accepts arbitrary
relation strings). So this update added three:

- **`refutes`** — a verification finding that disproves a specific claim. **156 edges.**
- **`confirms`** — a verification finding that upholds a claim. **86 edges.**
- **`contradicts`** — two documents state incompatible things, neither being an act of
  verification (doc-vs-doc, spec-vs-shipped). **41 edges.**

Recording this plainly because it is a divergence from the shipped skill spec, not a graphify
feature.

## Q1 — Does ULTIMATE become the new #1 hub? **Yes, decisively.**

`graphify god-nodes` equivalent, by degree:

| # | node | edges | was |
|---|---|---|---|
| 1 | **ULTIMATE Knowledge & Gaps (v258)** | **85** | new |
| 2 | W5-A — Measured non-functional pass | 59 | new |
| 3 | W1-F — AI Surface & Guards Audit | 48 | 16 (rank 16) |
| 4 | W1-A — Code Sweep | 47 | 19 (rank 12) |
| 5 | ANALYSIS v149 | 45 | 41 (rank 2) |
| 6 | Outstanding Register (2026-07-21) | 45 | 43 (rank 1) |
| 7 | **Business Model decision document** | 40 | new |
| 8 | Cookout Orchestrator & Equipment Conformance Audit | 37 | 33 (rank 3) |
| 9 | W1-D — Non-functional Sweep | 36 | 7 (rank 70) |
| 10 | W1-B Conformance Sweep | 33 | 18 (rank 13) |

ULTIMATE at 85 edges is nearly **double** the previous #1. The meta-audits did **not** hold the
top: the Outstanding Register went 43→45 edges but fell from rank 1 to rank 6, and ANALYSIS-v149
went 41→45 but fell from 2 to 5 — they gained edges and still lost the ranking, which is the
correct outcome. The most dramatic move is **W1-D, from rank 70 to rank 9** (7→36 edges): it was
nearly orphaned in the 09:22 build and is now a hub, because VERIFY-W1-D, W5-A and ULTIMATE §4.D
all point at it.

The new #2 is W5-A-measured — see Q3 for why that is not the good news it looks like.

## Q2 — Do the refutations connect to the claims they refute? **Yes. Verification is not an island.**

This was the brief's most important question, and the answer is unambiguous.

- **156 `refutes` edges** in the merged graph; **152 of them cross document-family boundaries.**
  Only 4 stay inside one family. Verification does not live in its own island.
- **All 8 VERIFY-W1-* files** carry a direct file-level `refutes` edge to their Wave-1 twin, plus
  their own per-verdict edges:

| VERIFY file | verdict edges from its own nodes |
|---|---|
| VERIFY-W1-A | 7 refutes, 8 confirms |
| VERIFY-W1-B | 5 refutes, 10 confirms, 2 contradicts |
| VERIFY-W1-C | 5 refutes, 5 confirms |
| VERIFY-W1-D | 7 refutes, 6 confirms |
| VERIFY-W1-E | 10 refutes, 3 confirms, 2 contradicts |
| VERIFY-W1-F | 9 refutes, 5 confirms, 1 contradicts |
| VERIFY-W1-G | 4 refutes, 4 confirms, 1 contradicts |
| VERIFY-W1-H | 7 refutes, 5 confirms |

- Flow by family: `ULTIMATE →refutes→ W1` 59; `VERIFY →refutes→ W1` 53 and `→confirms→` 42;
  `W5 →refutes→ W1` 25 and `→confirms→` 14. The Wave-5 reports turn out to be a *second*
  verification layer over Wave 1, not only new material.
- Most-refuted targets: W1-A (25×), W1-F (20×), W1-D (19×), W1-H (19×), W1-E (15×).

**The honest limit.** Of the 156 `refutes` edges, **133 land on a document-level node and only 23
on a specific claim node** (17 concept, 5 rationale, 1 code). That is not the extraction being
lazy — it is a consequence of the 09:22 build, which extracted only 1–10 concept nodes per W1-*
file (W1-H got exactly one). There were simply not enough claim-level nodes to aim at. So: a reader
who opens W1-A *as a document* will see it is heavily refuted; a reader who opens one specific
W1-A finding will usually still not see a refutation edge on it. Closing that would mean
re-extracting the eight W1-* files at claim granularity — worth doing, and not done here.

Where claim-level targeting did land, it is exactly the material that matters: the
`toast() Hebrew-literal messages untranslated` concept is refuted 7×, and the
`483 'typeof X===function' guards` rationale node is refuted 5× (W5-E re-measured it at 482).

## Q3 — Is the business layer connected to the AI cost findings? **Connected — and the connection is what indicts it.**

Between the 74 business-layer nodes (W4-A/B/C + business-model) and the 36 AI-cost nodes (W5-A,
W1-F, VERIFY-W1-F) there are **51 edges**: 16 EXTRACTED, 28 INFERRED, **7 AMBIGUOUS**. All four
business documents reach the AI-cost cluster in 1–2 hops; W4-A/B/C each have a *direct* `cites`
edge to W1-F and a direct edge to W5-A.

Three findings the graph makes visible:

1. **W5-A-measured contains no AI cost measurement at all.** The brief assumed it did. It is a
   performance/accessibility pass on live v258 — CLS 0.29, 2,117,219 B first visit, 4,984 ms
   long-task time, 1.77:1 contrast, 25-of-36 touch targets under 44 px. The real measured AI
   economics live in **W4-A** ($0.0381 per Ask-the-Fire action, $0.035/call grounded search =
   77–90% of every persona's bill, blended $1.22/user/mo). This matters: it means "pricing is
   grounded in W5-A's measurements" would have been a false reassurance. Chunk 09's extractor
   found this by having both files in one context and marked the unsupported links AMBIGUOUS
   (0.15–0.3) rather than inventing support.
2. **The pricing contradiction is now an edge, not a footnote.** The graph carries ULTIMATE gap
   3H5 `refutes` W4-B-pricing: W4-B's whole tier structure rests on **~$0.0035 per text action**,
   while W4-A measured **$0.0381** — a **10.9× understatement**, because W4-B omits the $0.035
   grounded-search request fee. Alongside it: `grounded_search_fee contradicts cost_per_action`,
   `price_floor contradicts pit_pass_tier` (Pit Pass annual nets ~$4.85/mo, under W4-A's own $4.99
   floor), and `token_cap_blind contradicts 2m_cap_cost`.
3. **The 7 AMBIGUOUS edges are the deliverable, not noise.** Both tier allowances, the ILS249/$59
   price point, the TTS/persona/WTP inputs and the Adapty-LTV-as-willingness-to-pay assumption are
   attached to the measured-cost cluster at confidence 0.15–0.3 precisely because nothing measures
   them. An unevidenced pricing assumption is now visible in the graph instead of invisible.

So the answer is not "pricing is built on nothing" — it is worse and more useful: pricing *is*
connected to measurement, and the graph shows the measurement contradicting the price.

## Q4 — The orphan re-check. **All nine gained edges. Only three gained a real citation.**

| document | cross-file edges / partner files (before → after) |
|---|---|
| `docs/equipment-2.0-gaps-2026-07-15.md` | 2e/1f → 4e/3f |
| `docs/REVIEW-v147.md` | 4e/1f → 6e/3f |
| `docs/matkonetesh-modes-demo.html` | 4e/1f → 6e/3f |
| `docs/home-adaptive-design.md` | 3e/2f → 8e/5f |
| `docs/sources/baldwin-backbone.md` | 5e/1f → 9e/4f |
| `docs/sources/agent-research-protocol.md` | 5e/1f → 7e/3f |
| Equipment 2.0 Phase 1 design spec | 5e/1f → 9e/4f |
| `ANALYSIS-v149-he.md` | 5e/1f → 7e/3f |
| `OPERATIONS-v157-he.md` | 5e/1f → 7e/3f |

**This table overstates the progress, and the overstatement is the finding.** Auditing *which*
partners are new: six of the nine were reconnected **only** by the two graph self-report files
(`W1-GRAPH-docs.md` — this document — and `analysis/graph/GRAPH_REPORT.md`), which cite them
because they *enumerate the orphan list*. That is graph connectivity, not re-integration: the
sweep never actually engaged with those documents, it just published a report that names them.

Only **three** gained a substantive new partner from the sweep's real content:

- **`home-adaptive-design.md`** ← `W5-B-ux.md` (`conceptually_related_to`) — a genuine UX citation.
- **`sources/baldwin-backbone.md`** ← ULTIMATE (2 × `cites`) — the safety backbone finally cited by
  the master register.
- **Equipment 2.0 Phase 1 design spec** ← `2026-07-21-occupancy-view-phase2-spec.md`
  (`contradicts`) — a new spec-vs-spec conflict edge, emitted from W1-GRAPH's own Q4 finding.

Still effectively stranded on substance: `equipment-2.0-gaps`, `REVIEW-v147`,
`matkonetesh-modes-demo`, `agent-research-protocol`, and both Hebrew twins. The EN/HE island split
reported at 09:22 is **unchanged** — no cross-language matching happened this run either, and
nothing in the sweep addressed it.

Corpus-wide: isolated nodes went 5 → 6 and degree-1 nodes 294 → 390. The graph got much bigger and
proportionally slightly *sparser* at the fringe. That is expected for an update that adds 497
finding-level nodes, but it is not an improvement in orphan hygiene and should not be read as one.

## Honest losses in the merge

Nothing catastrophic, but four things were lost and are recorded rather than smoothed over:

1. **4 node labels dropped to ID collision.** `app_equipplan`, `app_schedulePlacements`,
   `app_cookercontention`, `app_combinedeventsrows` were each minted by W1-G-workflows *and* by a
   pre-existing analysis document. graphify keeps the first and drops the second, warning each
   time. The W1-G descriptions (with `app.js` line anchors) were the ones dropped. Edges survive
   and point at the kept node, which describes the same function — so this is a loss of
   description, not of connectivity.
2. **45 of 1,159 new edges did not survive.** 40 collapsed because the undirected build keeps one
   relation per node-pair — the same behaviour that collapsed 8 pairs in the 09:22 build. In
   **every** collapsed case the stronger verification relation won (`refutes` kept over a parallel
   `references`/`confirms`), so the count of `refutes` edges is if anything under-reported: 12
   `confirms` and 3 `refutes` were absorbed into a co-existing edge between the same pair. The
   other 5 edges pointed at node IDs that never existed (3 mis-guessed ULTIMATE gap IDs, 1 plan
   ID, 1 duplicate) — a ~0.4% ID-guessing error rate on cross-chunk references.
3. **1 node removed by fuzzy dedup.**
4. **The token split is not recoverable.** See below.

Nothing else degraded: no node count went down, no community collapsed, no edge was orphaned.

## Token cost — honest

**~1.80M tokens** (1,796,477), summed from the 12 subagents' actual reported usage — not
estimated, not extrapolated. Per chunk: min 115,588 (chunk 12), max 173,229 (chunk 09), mean
~149,700. Orchestrator overhead on top is not included in that figure.

The 09:22 build left graphify's `input_tokens`/`output_tokens` at placeholder zeros; this run
backfilled the real numbers, so `cost.json` and `GRAPH_REPORT.md` now show a true cost for the
first time. One caveat: the harness reports a **single combined** token figure per subagent, not
an input/output split, so the whole 1,796,477 is recorded under `input_tokens` and `output_tokens`
reads 0. That is a reporting limitation, not a claim that no output tokens were spent.

For comparison, the 09:22 build cost ~2.6M tokens for 137 files, ~2.0M of which went to 75 image
chunks. This update graphed 101,329 words of the densest prose in the repo for less than that —
and the 189-image exclusion is what kept it there.

## What this update did not do

- Did not graph the 189 sweep screenshots (above).
- Did not re-extract the eight W1-* files at claim granularity, which is what would let
  refutations attach to individual findings instead of whole documents (Q2's limit).
- Did not address the EN/HE island split — still no cross-language matching.
- Did not touch any source file. `app.js`, `app.css`, `build.py`, `data.py` were not read or
  modified.
- This document is itself in the corpus and was extracted this run, so appending this section
  makes its manifest stamp stale. The next `--update` will correctly re-queue it.
