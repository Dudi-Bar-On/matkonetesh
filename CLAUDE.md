# מתכונת · מדריך האש — working agreement

**Read `docs/process/development-discipline.md` at the start of every task.** It is the owner's
mandatory process (DoD gate, waiver gate, standing instructions §10.1–§10.12, lessons log). This file is
the short version that is always in context — including in every subagent, which does **not** inherit
conversation memory. If the two ever disagree, the discipline document wins.

## What this is

A Hebrew-first (RTL), mobile-first, **single-file PWA** for live-fire cooking — smoking/BBQ, grilling,
sous-vide, charcuterie. `build.py` inlines `app.js` + `app.css` + the Python data layer into
`dist/index.html`. Version stamp: `מהדורה NNN · D.M.YY`.

**The product is ONLINE-FIRST with an AI key** (owner decision, 2026-07-22). It is no longer
offline-first. Any document still claiming "works offline, no server" is stale — flag it, don't preserve
it.

## Non-negotiables

**1 · Verify against the runtime path, not one artifact.** A grep, a quote, or a single file is not
verification. Trace what the code actually executes. This project's audits produced **42 refuted findings
out of 261 (16%)** and every single one had this shape. Real examples: "no safety value carries a
citation" (279 do — they live in `sources.py` and merge at build), "55/56 toasts untranslated" (0 of 53
are missing — the lookup also reads `lang/en.data.json`). See
`docs/process/skills/verify-against-the-runtime-path/SKILL.md`.

**2 · Never ship inert code.** A function that is built, tested, and called from nowhere in production is
not shipped. Wire it or don't write it. `choosePlate`/`chooseNozzle` shipped inert; so did `safetyDiff`,
whose only reader in the whole repo was its test. See `docs/process/skills/no-inert-shipment/SKILL.md`.

**3 · Never report a version live until Playwright confirms it.** Cloudflare Pages build latency is real.
Load the live URL, assert the version string, then report. (§10.10)

**4 · Test discipline.** Reproduce with real clicks → fix → add a real-click test → run the suite twice,
**before** shipping. No arbitrary waits — `waitForFunction` condition waits only, never
`waitForTimeout`. The suite runs on port 8123; **never run two suites concurrently** (it produced 127
phantom failures).

**5 · Safety values trace to primary sources.** `docs/sources/baldwin-backbone.md`: *every `safe` value
must trace to a cited primary source — never guess.* USDA/FSIS, Baldwin, 9 CFR. Not blogs.

**6 · Hebrew/RTL:** wrap only number+unit islands in `dir="ltr"`, never a whole Hebrew sentence.

**7 · Secrets never enter the repo.** Gemini and Cloudflare keys live only as Worker secrets. Never echo
a key, never commit one, never paste one into a report.

## Knowledge before action

Two artifacts stand between any new plan and the code — check them before claiming something is missing:

- **`docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`** — 141 gaps across 8 bands, each with a
  verdict. If a claim contradicts a `REFUTED` verdict there, trace the runtime path before repeating it.
- **The knowledge graph** — `graphify-out/graph.json`, report at `docs/analysis/graph/GRAPH_REPORT.md`.
  Query it before grepping the corpus.

**graphify rules (§10.11, §10.12):** query the graphify **global** graph for tool documentation before
searching the internet. Keep the local graph current — a document written but not graphed leaves a stale
map, and a stale map is worse than none because it is trusted and wrong. **Always `--mode deep`.**
Update the graph when documents change, and commit/push with `bash scripts/sync-docs.sh "<message>"`.

Note: `graphify update` and the `--update` CLI path are the **code/AST** path ("no LLM needed"); they do
**not** re-extract documents. Documents need the skill flow. Conversely a **pure-code corpus skips
semantic extraction entirely** — AST only. Overriding either default is a deliberate choice to state out
loud, not to slip in.

## Reporting

State outcomes faithfully. If tests fail, say so with the output. If a step was skipped or a scope was
capped, say that — **silent truncation reads as coverage**. When something is done and verified, say it
plainly without hedging. Being wrong is worse than being silent: drop an unverifiable claim, never soften
it into a maybe.
