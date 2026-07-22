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
