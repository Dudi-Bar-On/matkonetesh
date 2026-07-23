# מתכונת · מדריך האש — working agreement

> # ⚠️ READ `docs/process/development-discipline.md` AT THE START OF EVERY TASK
> Owner instruction. Not optional, not "when it seems relevant". **Every task, before anything else.**
> Start with **§10** (the owner's standing instructions) and **§3** (the DoD gate).
> **Memory is not a substitute for re-reading.** ("I remember this skill" is a red flag — skills and
> rules are re-read at invocation, never recalled.)

This file is the always-in-context loader. It exists because **subagents inherit `CLAUDE.md` but do not
inherit conversation memory** — without it, a dispatched agent starts with zero knowledge of the rules.
It carries inline only the two gates that get skipped when nobody is looking. **Everything else lives in
the discipline document, which is authoritative wherever the two differ.**

## Where to find what — `docs/process/development-discipline.md`

| § | Contents |
|---|---|
| 1 | The 14 superpowers skills and the moment each becomes **mandatory** |
| 2 | The pipeline: brainstorm → spec → **owner approves** → plan → subagent-driven dev → review → finish |
| **3** | **The 12-point DoD gate** — inlined below |
| **4** | **The Waiver Gate** — inlined below |
| 5 | Debugging protocol + the **3-fix rule** |
| 6 | Failure-mode → gate map (every past failure and the gate that now catches it) |
| 7 | Reviewer discipline — two verdicts required; reviewers are never told what not to flag |
| 9 | Settled decisions — full suite per task; **work on `main`, no worktrees**; brainstorm only when unclear |
| 10.1–10.12 | The owner's standing instructions — **re-read before every task** |
| 11a | Testing infrastructure — worker ceiling, the port-8123 collision, server restart after build |
| 11 | **Lessons log L1–L16** — read it before repeating a mistake someone already paid for |
| 12 | **Thinking models** (15, three clusters) + gate-prompt shapes + **when NOT to think** |

---

## §3 · The per-task DoD gate — a task is NOT done until every box is checked with evidence pasted in

1. **Spec requirement traced.** The exact spec line(s) this task satisfies, quoted. If none → the task should not exist.
2. **RED witnessed.** Test written first, run, and *observed failing for the intended reason*. Output pasted. **A test that passed on first run is void — rewrite it.**
3. **GREEN.** Full test command run fresh, output pasted, exit code shown.
4. **Behavioural assertion.** Every new test asserts an **observable effect** — rendered output, stored state, or a value a real consumer reads. *Asserting a computed field that nothing consumes is not a test.*
5. **Consumer exists.** Any new derived/computed value has a real reader in production code, named here. Per **L8**: name the render path AND confirm it fires on the real data — a reader that never executes is still dead.
6. **Fixture minimality.** The fixture contains only what the scenario needs, and the **negative case is tested**.
7. **Regression red-green.** For a bugfix: fix reverted → test observed FAILING → fix restored → test observed PASSING. Both outputs pasted.
8. **Visual evidence.** Any UI change: screenshot at **390 × 844**, attached and *actually looked at*.
9. **Hebrew check.** Any user-facing string: rendered in Hebrew, no English leak, correct singular/plural on interpolated counts, correct domain term. Screenshot. (Per **L13**: numeric/math readouts need `dir="ltr"` islands — bidi flips `≥` into `≤`.)
10. **Safety invariance.** No `bcheck` stage, `temp`, `safe` value, or cook duration altered. Where the task touches the plan, name the assertion that proves it.
11. **No arbitrary waits.** Tests wait on conditions (`waitForFunction`), never `waitForTimeout`.
12. **Full suite green.** Run `npx playwright test` — plain, nothing else. Output pasted. **Never** pass `--retries` or `--workers=1`. Any failure, **including an intermittent one, is a bug** — debugged via `systematic-debugging`, never re-run until it passes.

**Per-phase gate:** every DoD line in the governing spec quoted and marked MET with evidence; any unmet line → phase incomplete, escalate; independent re-audit by a fresh agent **against the spec, not against the ledger**.

## §4 · The Waiver Gate — the single most important rule

> **A plan may never waive, defer, or reinterpret a requirement from an approved spec.**
> Any such change is raised with the owner **in conversation**, with the spec text and the reason, and
> requires explicit approval. **"Recorded in a document" does not count as raised.**

Also covers: reordering phases in a way that drops a dependency, marking a spec item "deferred", and
narrowing a DoD line. This rule exists because `equipPlan` — the central mechanism of an approved spec —
was waived in a plan file and never surfaced.

---

## The loop, and when to stop

**§10.1 — plan → develop → test → review → debug → re-review → until 100% working. Only then move
forward.** A **loop, not a checklist**. No "good enough for now", no "known minor", no deferring a defect
into a later phase without explicit owner agreement.

**§5 — the 3-fix rule.** After 3 failed fixes, **STOP** and question the architecture with the owner.
Do not attempt fix #4. Debugging starts with **evidence and instrumentation**, never a guess.

**§12 — thinking models** (adopted from the graphify global `methodology` corpus). The four that earn
their keep most often here: **PREDICT → TEST → OBSERVE → CONCLUDE** — never skip PREDICT, never change two
variables at once · **Occam's Razor** — rule out typo/stale cache/wrong path before race conditions; if
your hypothesis needs 3+ things to go wrong at once, look for a single-point failure (this is L14) ·
**Circle of Control** — "while I'm here" fixes are scope creep; note them, don't do them ·
**Chesterton's Fence** — never delete code whose purpose you don't understand. §12.6 says when NOT to
apply any of this: a stack trace naming file and line gets fixed, not fault-treed.

**§10.3** Work in cycles; don't stop mid-loop to ask whether to continue.
**§10.6** Show a summary after every task or step — not only at the end of a phase — and give it
**three parts, always**: **DONE** (what this delivered, with evidence) · **NEXT** (the immediate step and
any decision blocking it) · **LEFT UNTIL THE GRAND FINAL** (distance still to run on the WHOLE
programme, with the burn-down number where one exists). Without the third part a long programme reads
as an unbounded run of green ticks. Never count work as done before its review is clean.
**§10.8** Interrupt only for *important* decisions (hard to reverse, safety/legal, **any spec waiver**,
material scope change, or true owner preference). Routine calls: just make them and note them. When
unsure, **prefer proceeding**.

## Skills — mandatory triggers (§1)

`using-superpowers` every task · `brainstorming` before ANY creative work (**HARD-GATE**: no code before
an approved design) · `writing-plans` only after a spec is approved · `subagent-driven-development` to
execute a plan · `test-driven-development` every feature/fix/refactor · `systematic-debugging` on ANY
failure · `verification-before-completion` before ANY success claim · `requesting`/`receiving-code-review`
· `dispatching-parallel-agents` · `finishing-a-development-branch` · `writing-skills`.

Project-local skills, both born from real failures — read them, they are short:
`docs/process/skills/verify-against-the-runtime-path/SKILL.md` · `docs/process/skills/no-inert-shipment/SKILL.md`

## §10.2 · Playwright is mandatory — for tests AND for debugging

A feature is **not verified until seen working in the UI**. A green assertion alone is not evidence.
Debug by driving the real app, not by reasoning over source.

**§10.10 — a push is not a release.** Never tell the owner a version is live until Playwright has
verified the live URL: the `.foot-stamp` matches the shipped `מהדורה NNN` **and** a feature probe from
that release is present. Cloudflare Pages takes minutes — **poll, do not assume**.

**§10.9** Show an interactive mockup and get approval **before** building any significant visual redesign.

## §11a · Testing infrastructure

`npx playwright test` — the config is authoritative. Workers pinned to the measured reliable ceiling;
`retries: 0`. **Never run two suite runs concurrently** — racing runs produced 12 then 127 phantom
`ERR_CONNECTION_REFUSED` failures and sent a debugging session chasing a server bug that did not exist.
After `python build.py`, **restart any manual `serve.js`** before a UI check — it caches `dist/` in memory
at startup, so you will otherwise verify a stale build. Stop the manual server on 8123 before running the
suite, or Playwright's managed server collides with it.

## The product

Hebrew-first (RTL), mobile-first, **single-file PWA** for live-fire cooking — smoking/BBQ, grilling,
sous-vide, charcuterie. `build.py` inlines `app.js` + `app.css` + the Python data layer into
`dist/index.html`. Version stamp: `מהדורה NNN · D.M.YY`.

**ONLINE-FIRST with an AI key** (owner decision, 2026-07-22). No longer offline-first. Any document still
claiming "works offline, no server" is stale — flag it, don't preserve it.

**Safety values trace to primary sources.** `docs/sources/baldwin-backbone.md`: *every `safe` value must
trace to a cited primary source — never guess.* USDA/FSIS, Baldwin, 9 CFR — not blogs. The 279 citations
live in `sources.py` and are merged into the data at build time, so a grep of `data.py` alone shows none.

**Secrets never enter the repo.** Gemini and Cloudflare keys live only as Worker secrets. Never echo a
key, never commit one, never paste one into a report.

## Knowledge before action

- **`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`** — 141 gaps, each with a verdict. If a
  claim contradicts a `REFUTED` verdict there, trace the runtime path before repeating it. That sweep
  refuted **42 of 261 findings (16%)** and every refutation had one shape: a grep, a quote, or a single
  artifact trusted without tracing what the program actually executes.
- **The knowledge graph** — `graphify-out/graph.json`; report at `docs/analysis/graph/GRAPH_REPORT.md`.
  Query it before grepping the corpus.

**§10.13 — the graph is the evidence tool. Query it BEFORE grepping.** "What specifies this function",
"what tests prove it", "does anything actually read this" are graph questions: `graphify query`,
`graphify path "A" "B"`, `graphify explain "X"`. A grep finds a string; the graph holds the relationship,
which is what the claim is usually about. **But an edge is a lead, not a verdict** — deep mode emits
`INFERRED`/`AMBIGUOUS` edges on purpose. Query to find the evidence, then read the source before
asserting it. This does not repeal L16.

**§10.11** Query the graphify **global** graph (`~/.graphify/global-graph.json`) for **any** documentation or
external help — a tool, framework, methodology, an API's capabilities, a vendor's model specs — **before**
searching the web. Expand your query against the graph's own vocabulary first — it matches by case-folded
substring, with **no stemming, no synonyms, no cross-language matching**. If no vocabulary token matches, say
so and stop; never invent tokens to force a hit.
**A miss is a task, not a dead end:** when it isn't there, search/research the web — then apply the
**usefulness gate**: ask *"is this source useful, and likely to be needed again — here or on another project
sharing the global?"* If **yes**, **download the docs and add them back to the global corpus** so no session
repeats the search: `graphify add <url>` (or graph a docs folder), then
`graphify global add <graph.json> --as <name>-docs` (lands in the shared `vendor-docs`/vendors family);
verify with `graphify global list`. If it's a genuine one-off, skip the deposit and say so. Only
documentation of general cross-project value — **never this project's private documents, never anything
containing a key.**

**§10.12** Keep the local graph current — **always `--mode deep`**. Commit and push with
`bash scripts/sync-docs.sh "<message>"`. Chunk by **word budget (~12k)**, never by file count.
Two defaults that trip in opposite directions: `graphify update` / `--update` is the **code/AST** path
("no LLM needed") and re-extracts **no** documents; a **pure-code corpus skips semantic extraction
entirely** and gets AST only. Overriding either is a deliberate choice to state out loud.

## Reporting

State outcomes faithfully. Failing tests: say so, with the output. A skipped step or a capped scope: say
that — **silent truncation reads as coverage**. Done and verified: say it plainly, no hedging. **Being
wrong is worse than being silent** — drop an unverifiable claim, never soften it into a maybe. Verify
agent output yourself via diff; never on an agent's report alone.
