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

## Session start & arc close (Phase 0 — mechanical gates)

**בכל פתיחת session** (המלא: `docs/process/checklists/session-start.md`): ‏(1) discipline §10→§3 ·
(2) ה-Phase הפעיל ב-`docs/ROADMAP-2026-07-30.md` + ‏`docs/STATUS-BOARD.md` · (3) `node scripts/check-meta.mjs`
— אדום מטופל לפני עבודה · (4) serena לסימבולי, **הגניזה** (`src.knowledge.retrieval`) למסמכים ולציטוט-עם-גרסה, grep=fallback מוצהר ·
(5) §10.5a: סדרתי; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/GPU.
**בכל סגירת קשת/Phase:** ‏`docs/process/checklists/arc-close.md` — לקחים→§11, הפקדות, גרף, לוח+מרשם,
check-meta ירוק. **כל משימה מסתיימת בטבלת H9 ומעדכנת את `docs/STATUS-BOARD.md`** (H10; מוצג באבני-דרך — H10a).

## Where to find what — `docs/process/development-discipline.md`

| § | Contents |
|---|---|
| 1 | The 14 superpowers skills and the moment each becomes **mandatory** |
| 2 | The pipeline: brainstorm → spec → **owner approves** → plan → subagent-driven dev → review → finish |
| **3** | **The 12-point DoD gate** — inlined below (DoD-12 per H7: task ×1, release ×2) |
| 13–15 | Operating Model (Main/subagent + brief contract) · **H8 full-landing** · H9–H12 (summary table, STATUS-BOARD, CAPABILITIES, /status) |
| 16–18 | **H13** שער רלוונטיות לפריט משוחזר (⚠️R: בירור → המלצה → **החלטת בעלים** → עדכון → בצע/בטל) · **H14** דו"ח UX לכל גרסה · **H15** בחירת מודל/מאמץ ל-subagents (Fable-high לתכנון; Sonnet לפיתוח — medium/high/xhigh לפי קושי; אין הסלמה אחרי הצלחה) |
| **4** | **The Waiver Gate** — inlined below |
| 5 | Debugging protocol + the **3-fix rule** |
| 6 | Failure-mode → gate map (every past failure and the gate that now catches it) |
| 7 | Reviewer discipline — two verdicts required; reviewers are never told what not to flag |
| 9 | Settled decisions — full suite per task; **work on `main`, no worktrees**; brainstorm only when unclear |
| 10.1–10.12 | The owner's standing instructions — **re-read before every task** |
| 11a | Testing infrastructure — worker ceiling, the port-8123 collision, server restart after build |
| 11 | **Lessons log L1–L21 + adopted wins** — read it before repeating a mistake someone already paid for |
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

**Per-phase gate:** every DoD line in the governing spec quoted and marked MET with evidence; any unmet line → phase incomplete, escalate; independent re-audit by a fresh agent **against the spec, not against the register**.

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

**§12 — thinking models** (adopted from the `methodology` corpus, now a tool_spec in agent memory). The four that earn
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
**And run the suite SERIALIZED more broadly — never while other heavy subagents/processes compete for CPU:**
the local worker count assumes an idle machine, so competing load makes even a single run flake
(`ERR_ABORTED` on navigation). Pause CPU-heavy background agents for the duration of a suite run.
After `python build.py`, **restart any manual `serve.js`** before a UI check — it caches `dist/` in memory
at startup, so you will otherwise verify a stale build. Stop the manual server on 8123 before running the
suite, or Playwright's managed server collides with it.
**Every SETUP owns a matching TEARDOWN** (§11a) — let a run COMPLETE (Playwright tears down its own server);
**never kill a suite mid-flight.** `serve.js` is now a **single in-memory process** (de-clustered, L18) with
SIGINT/SIGTERM handlers for a clean shutdown — the old cluster's respawn-on-kill zombie-server failure mode
is gone. The rule still stands regardless: a forceful/port-based `taskkill` can still bypass the handlers and
leave an orphan holding the port. If you must kill, kill the whole tree from the primary, then verify the port
refuses + 0 orphans.

## When stuck, RESEARCH (not fix #4)

**§10.14** For a genuinely complex problem, or after a few non-converging iterations, STOP guessing and do
**deep research** — read in detail the official docs, help, and blogs/issues of every product/technology
involved (§10.11: agent memory first, then the web, deposit useful finds). This is where
systematic-debugging's 3-fix STOP hands off. **§10.15** Be skeptical: when a component *repeatedly* causes
trouble, evaluate a **better alternative** (a different server/runner/pattern) instead of stacking band-aids —
the correct fix is sometimes a better ingredient. Both: find by research, judge on evidence, write the answer down.
**§10.16** Conclude every significant session/arc with its **lessons** (failures → the §11 log, successes →
"adopted wins") **and deposit** the session's useful doc finds into agent memory (§10.11 gate) — the
controller runs the deposit pass before the arc closes; untracked lessons and undeposited finds are paid for twice.
**§10.17** **Maximize Serena** (the project's `serena` MCP server) for symbol-shaped code work — find/refs/
overview/surgical symbol edits beat grep + text edits on the **14.6k-line, 906-function** app.js
(measured 3.8.26; this line said "~9.5k" until then). Learn it from its docs FIRST:
the `serena-docs` material in agent memory + Serena's own `initial_instructions` manual. Division of
labor: Serena = live locate/edit-exact · הגניזה = cross-doc provenance + vendor docs · grep = fallback
(docs/process/serena-adoption.md). Point code-editing subagents at Serena when their task is symbol-shaped.
**§10.17a — ONE Serena server, shared by ALL subagents** (owner, 2026-07-24). The stdio config makes every
subagent spawn its own server+dashboard (observed: 4 concurrent instances, ports 24282→24283 flapping). Run a
single long-lived server (SSE/streamable-HTTP transport on a fixed port) and point `.mcp.json` at it as a
URL-based server; verify one process + one dashboard + tools resolving from a subagent. Until wired, enable
Serena only for genuinely symbol-shaped agent work.

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
- **הגניזה** — ‏PostgreSQL: **LlamaIndex** (`MarkdownNodeParser`/`CodeSplitter`) parses the repo's own
  documents into `TextNode`s, stored in SQLite with **JSONB** metadata. Built by
  `python scripts/ingest.py --scope`. Query it before grepping the corpus.

**§10.13 — הַגְּנִיזָה היא כלי הראיות. שאל אותה לפני grep.**

**‏`geniza`** — השם הכולל לתשתית הידע. גניזה היא חדר שבו **שומרים כתבים במקום להשמידם**, וזה
בדיוק מה שהמערכת עושה: גרסה שהוחלפה אינה נמחקת, היא נעשית `superseded` ונשארת ניתנת לציטוט.
השם מתאר את התכונה ולא את הטכנולוגיה, ולכן ישרוד גם החלפת מסד.

```
הגניזה = PostgreSQL (מקור האמת) · Neo4j (היטל) · LlamaIndex (תזמור) · מודל מקומי (embeddings + חילוץ)
```

**‏⚠️ ‏`agent-memory.db` ו-`scripts/memsync.py` נמחקו ב-5.8.26.** כל הוראה שעדיין נוקבת בהם היא
**רשומה היסטורית, לא פקודה** — הקובץ לא קיים. ‏847 המסמכים נמצאים בגניזה במלואם, אומת לפני המחיקה.

**גישה לסוכנים היא דרך שש פעולות פרמטריות בלבד — אין SQL חופשי, אין Cypher חופשי, ואין
אישורי-מסד לסוכן.**

```python
from src.knowledge import retrieval
retrieval.search_current_docs(q, filters={"namespace":"repo"})  # לקסיקלי, גרסאות נוכחיות בלבד
retrieval.semantic_search(q, filters=...)                        # וקטורי, אותה טבלה בדיוק
retrieval.get_source_excerpt(revision_id, chunk_id)              # הטקסט שמאחורי ציטוט
retrieval.get_revision_history(source_path)                      # מה השתנה ומתי
retrieval.find_impact(canonical_id, depth=...)                   # מה מושפע
retrieval.find_dependency_path(a, b)                             # שרשרת התלות
retrieval.get_entity_provenance(canonical_id)                    # ומה המקור לכל טענה
```
צירי סינון: `namespace` `source_type` `document_status` `revision_status` `source_authority`
`repository` `document_path` `created_after`/`created_before` — **ציר לא-מוכר נדחה, לא מושמט.**

**מדוד, לא מוערך (5.8.26):** ‏109ms לשאילתה בתהליך חם · 379ms קר · 901ms סמנטי.
‏**‏`find_impact`/`find_dependency_path` יחזירו ריק** עד שירוץ חילוץ (`scripts/extract_graph.py`);
כל עובדה שמודל מחלץ נכתבת `proposed` ואינה מוחזרת עד שאדם מקדם אותה.

**⚠️ ‏6.8.26 — ‏PostgreSQL עבר מ-Docker להתקנה מקומית.** ‏`postgresql-x64-18` הוא **שירות Windows**
בהפעלה אוטומטית על **פורט 5432**, עם `pgvector 0.8.6` שהודר מהמקור מול MSVC (אותה גרסה בדיוק
כמו התמונה שהוחלפה). ‏**‏Neo4j עדיין בקונטיינר** — הוא מחזיק 7,941 צמתים ואין נתיב בנייה-מחדש
המוני, ולכן הזזתו תמתין לסיום החילוץ. הסיבה למעבר: המכונה אתחלה את עצמה ב-02:27 ולקחה איתה את
‏Docker, ש-WSL אינו מעלה לבד — ‏17 שעות עבודה על הרצפה. שירות Windows עולה באתחול בלי איש.
‏**הנתונים לא נגעו:** ‏`pg_dump` מלא + התפקידים ב-`backups/`, ה-volumes של Docker שלמים,
ושמונה מדדים אומתו זהים משני הצדדים (‏853 מסמכים · 877 גרסאות · 15,192 chunks · 1024 ממדים).

הפעלה: `docs/infra/deliverables-2026-08-05.md` §3. ‏**‏Postgres עולה לבד; ‏Neo4j עדיין דורש
`docker compose up -d` ב-`infra/`** — ו-`scripts/run-extraction.ps1` עושה זאת בעצמו (כולל
‏`wsl -u root service docker start`, כי ‏`sudo` נתקע בהמתנה לסיסמה). ‏grep הוא ה-fallback המוצהר.
A grep finds a string in one file; the store returns the **section** that contains it, with its
heading path and the document it came from — which is usually what the claim is actually about.
**But a hit is a lead, not a verdict.** Read the source before asserting it. This does not repeal L16.

**Migrated knowledge from the old graph** lives under the `graph://` path namespace, each record
carrying its original relations in `metadata.relations`. Those relations were machine-extracted and
some are `INFERRED`; treat them as leads, never as findings.

**§10.11** Query **the geniza** for **any** documentation or external help — a tool, framework,
methodology, an API's capabilities, a vendor's model specs — **before** searching the web. Nine
vendor/technology corpora are stored as `tool_spec` records (`vendor-docs`, `methodology`,
`playwright-official-docs`, `gemini-api-docs`, `cloudflare-workers-docs`, `nodejs-v8-docs`,
`ollama-docs`, `semantic-search-mcp-docs`, `windows-scheduling-docs`). Matching is case-folded
substring — **no stemming, no synonyms, no cross-language matching**. If nothing matches, say so and
stop; never invent tokens to force a hit.
**A miss is a task, not a dead end:** when it isn't there, search/research the web — then apply the
**usefulness gate**: *"is this source useful, and likely to be needed again?"* If **yes**, download
the docs and ingest them so no session repeats the search. Only documentation of general value —
**never anything containing a key.**

**§10.12** Keep the geniza current: `python scripts/ingest.py --scope` (delta by **content hash** —
unchanged files are skipped). `node scripts/check-geniza-fresh.mjs` is the gate and it **blocks**.
Commit and push docs with `bash scripts/sync-docs.sh "<message>"`, which now syncs and verifies
before it commits.
**Why this replaced graphify (2026-08-04):** the old graph was a 22 MB JSON artifact rebuilt by an
out-of-process LLM pass. Its freshness gate could never pass — 115 stale documents standing, and
`graph-freshness.yml` failed **8 of its 8 runs**, so it was marked advisory and ignored. `sync-docs.sh`
step 1 did not even update it; it printed an instruction to go run a skill by hand. **A map that is
never current is not a map.** The rule did not change; the cost of obeying it did.

## Reporting

State outcomes faithfully. Failing tests: say so, with the output. A skipped step or a capped scope: say
that — **silent truncation reads as coverage**. Done and verified: say it plainly, no hedging. **Being
wrong is worse than being silent** — drop an unverifiable claim, never soften it into a maybe. Verify
agent output yourself via diff; never on an agent's report alone.
