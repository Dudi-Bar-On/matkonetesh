# HANDOVER — 2026-07-27, ~23:00 · **STOPPED AT THE CP2 GO/NO-GO**

> **RESUME INSTRUCTION (read this first):** work is **paused awaiting an owner decision**. The CP2
> implementation plan is finished, reviewed, fixed and committed. **No CP2 code has been written and none
> may be written until the owner says GO.** The owner was mid-sentence — they said they would *"explain
> why"* they wanted this checkpoint — so **expect a reason/context message next, not necessarily a GO.**
> Do not assume approval. Do not restart planning: the plan is DONE.

---

## 0 · The one thing blocking progress

**The owner must answer the CP2 go/no-go.** It was presented in full and the session stopped there.
Three items inside it are explicitly the owner's call (details in §3). The recommendation given was:
**GO, with item 3.1 (new UI outside the approved mockup) as the only real gate.**

---

## 1 · Exact repository state

| | |
|---|---|
| Branch | `main`, clean tree (except long-standing untracked mockups/scratch) |
| HEAD | `56e727e` plan(cp2): review Tasks 1-6 + apply all surviving fixes; add the propagation task |
| Also local-only at checkpoint time | `53777af` (assemble CP2 plan), `53d91ce` (close E2/E3 gates) — **pushed as part of this handover** |
| Live version | **v277** — confirmed live by the owner AND by script (`Издание 277` / `Edición 277`) |
| Last release commit | `58975e1` release(v277) |
| Suite | **816 passed**, plain run, at v277 |
| Build guards | Guard-A (1535 keys) · Guard-B · **Guard-C** all OK |

**The CP2 plan:** `docs/superpowers/plans/2026-07-27-cooking-paths-cp2.md`
— 11 tasks · 150 code blocks · 92 steps · 97 tests · every task quotes its governing spec line · fences
balanced · placeholder scan clean. Verified by a mechanical gate (see §6), not by trusting an agent.

---

## 2 · What CP2 is (so a fresh session needs no re-derivation)

Governing spec: `docs/superpowers/specs/2026-07-25-cooking-paths-single-source-design.md`
(§3.2 raw table, §3.3 card panel, §3.4 other surfaces, §3.5 plan-level selector, §5 safety, §8 gate).
Prior phase (shipped): CP1 — `itemStages` is the single stage authority; `itemPaths(meta)` /
`effectiveSchedule(meta,sel)` exist.

**Deliverable:** in every item card, the owner-approved **Variant B** panel (expandable list) —
`mockups/cp2/variant-b-list.html`, screenshot `mockups/cp2/variant-b.png`. It lists **all** of the item's
paths; cited ones are selectable; the two CP3 ones render as `בקרוב — מקור בבדיקה` and **toast** when
tapped. Selecting a cited path re-renders the card's stat line, step list and raw-data table from that
path's **cited** figures, and moves the **per-recipe default** (owner amendment **O-1**), persisted to a
new `mk-item-path` store. **CP2 adds no new schedule math** — it re-renders already-cited output.

**Owner copy decisions (FIXED, already baked into the plan):**
1. path-order arrow uses the **existing no-space literal** from `sourcesBlock()` (not the spaced mockup form)
2. smoke-only cites the **same AmazingRibs** ref, worded `(טור עישון בלבד)`
3. placeholder rows read `בקרוב — מקור בבדיקה`, tapping **toasts**, never selects
4. **no** catalog-grid multi-path hint — scope stays on the card panel
5. `חוסך מעשנת` **drops when inapplicable** (only for sv→smoke)

---

## 3 · ⚠️ THE THREE OPEN OWNER DECISIONS (the actual gate)

These were presented and are **unanswered**. They are recorded inside the plan (Task 9 + Task 11's report
step), not silently absorbed.

1. **New UI outside the approved mockup (§10.9).** Task 7 adds a leading `מסלול נבחר` row + an
   `.rawpath-on` highlight to the card's raw-data table. It is needed to tell the forward schedule from the
   reverse (both legitimately appear in that table), **but the owner approved variant B without it.**
   → *Approve as-is, or show the owner first?* **This is the recommended gate.**
2. **Disclosed behaviour change.** A method-toggle flick on a catalog card now **persists** (was
   per-visit), because O-1's path default is persistent and the two cannot have different lifetimes.
3. **`eqmRequiresMethodKey`** (`app.js:1771`) derives from `methodRules(c).def`, so equipment
   **requires/holds** follow neither the card's combo nor its path. Pre-CP2 divergence (spec §4 marks it
   "already"); moving holds is safety-adjacent **E-programme** work. **Deliberately NOT fixed in CP2** —
   raised, not smuggled in.

---

## 4 · How the plan got here (and the two faults it caught) — do not redo this

The plan was built **twice**. Both failures are instructive and are already fixed:

- **Draft v1 (REJECTED, archived `scratch/cp2/draft-v1-REJECTED.md`)** — a single agent asked for 10 tasks
  emitted real code for Tasks 1–5 and **prose-only, code-free tasks for 6–10**.
- **The LLM assembler also failed** — asked to re-emit ~237k chars verbatim it truncated to a fragment of
  Tasks 8–10, and a reviewer's `REJECT` verdict was against **that fragment, not the plan**. Assembly is now
  **mechanical** (authored header + concatenated slices) — deterministic and lossless.

**Two REAL design faults were then caught by review and fixed** (they would have shipped):
1. **The forward row would have rendered the reverse schedule.** Once the reverse path became the stored
   default, `effectiveSchedule` leaked that order onto rows that explicitly passed `order:null` — so
   `סו-ויד + עישון` would print 75°/68° while citing the **120°** AmazingRibs source. A rendered number not
   tracing to the source printed beside it = the spec §5 / DoD-10 fidelity break the programme exists to
   kill. Fixed with a `hasOwnProperty('order')` guard. **The test that should have caught it was comparing
   `effectiveSchedule` to itself** — de-tautologised to derive from `itemStages`.
2. **`pathFigures` printed the `bcheck` safety temperature as a cooking figure** (`… → 63°/0ש`). Fixed with
   a cook-stage whitelist.

**NEW Task 9 — "the per-recipe default REACHES the occurrence"** (the propagation gap, confirmed real):
`effectiveSchedule` has exactly **one** production caller, while `buildList` (app.js ~7047) and
`combinedEventsRows` (~9805) hard-wire `svSmokeOrderDefault()`. So a card whose default is the cited
reverse path would be **contradicted by its own timeline and events screen**. Ships `occPathFor` /
`occOrderPinned` + a `st._cp2` migration stamp, two call-site edits, 7 real-UI tests.

Review artifacts kept: `scratch/cp2/review-tasks7-10-findings.json`, `scratch/cp2/slice-{A,B,C}.md`,
`scratch/cp2/map-*.json` (the four mapper outputs: card render path, CP1 mechanism, variant-B DOM +
every Hebrew string, spec DoD).

---

## 5 · If the answer is GO — the execution shape agreed

Execute **subagent-driven**, **one task at a time, strictly sequential** (see §6 load discipline), each
task: implementer → review → fix → next. Never two tasks in flight. Per task the DoD applies in full
(§3 of `docs/process/development-discipline.md`): **RED witnessed failing for the intended reason**
(a test that passes on first run is VOID), behavioural assertion at the rendered DOM, safety invariance
(DoD-10), no `waitForTimeout`, and the **full plain suite** at the gate (Task 11).

Ship as **v278** only after Task 11's gate: `python build.py` (Guard A/B/C) + plain `npx playwright test`
+ 390×844 screenshots in Hebrew **and** one other language + the live-URL verification (§10.10 — a push is
not a release; poll `matkonetesh.pages.dev` until the stamp AND a v278 feature probe are present).

---

## 6 · Operational lessons that MUST carry forward

- **Workflow load discipline (owner-reported, hard-won).** A wide fan-out (~50 agents, 25 concurrent
  verifiers) **wedged the machine and returned unreliable partial results** — on a 32-core/68 GB box, so it
  is not a CPU limit. **Go sequential and narrow: 3–5 agents, `await`ed one at a time.** Never spawn a
  verifier-per-finding. Chain drafters by passing the previous slice forward (it also keeps signatures
  consistent). Memory: `workflow-load-discipline`.
- **Before trusting ANY workflow result, check the journal:**
  `…/subagents/workflows/<runId>/journal.jsonl` — compare `started` vs `result` counts.
  **started ≫ results = a wedged run; discard its output, do not reason over it.**
  (Wedged run: 50 started / 2 results. Healthy runs: 5/5 and 2/2.)
- **Mechanical plan gate before believing a generated plan:** split on `^## Task ` and count fenced code
  blocks per task. **Zero code blocks in a code-changing task = a defective plan**, no matter how good the
  prose reads. Also scan for `TBD` / `similar to Task N` / `write tests for the above`.
- **Never let an LLM concatenate large documents** — assemble mechanically.
- **Re-read the spec; memory is not a substitute.** A stale memory note ("never persist a recipe default")
  almost caused a false §4 waiver flag — the spec says the opposite (O-1: "the card is where the default
  lives"). Memory has been corrected.
- **serena** for code symbols, **graphify** for docs/relationships, grep only as fallback (owner, repeated).

---

## 7 · Where the whole programme stands (the burn-down)

| Track | State |
|---|---|
| **Equipment E1** | ✅ shipped v263 |
| **Equipment E2** (ledger + availability) | ✅ **phase gate CLOSED 2026-07-27** — independent re-audit, every DoD line MET (free/partial/busy, D11 negative, allocate→release `itemStages` byte-identical) |
| **Equipment E3** | ✅ T1–T4 closed v266; **T5 (event-window gate) phase gate CLOSED 2026-07-27** — distinct `חסר…` vs `עסוק בחלון הזה: …` reasons rendered HE+EN at 390×844 |
| **E4, E5/E6** | ⏳ not started (E4 = minTempC/cold-smoke per owner ruling) |
| **CP1** | ✅ closed + gated |
| **CP2** | 🟡 **plan DONE, awaiting owner GO/NO-GO ← YOU ARE HERE** |
| **CP3** | ⏳ research batch (cited paths as data, "zero new JS" — the panel already renders `cited:false` placeholders) |
| **CP4** | ⏳ E4-remainder integration (per-event override + O-3 impact preview) |
| **Orchestrator (charter P8)** | ⏳ last by design |
| **Localization** | ✅ v274–v277 closed the recurring English/Hebrew render-leak class + build **Guard C**. Language queue **HOLDS at `pt`** (#2 of the owner's fixed 23) |

Status doc (kept current): `docs/analysis/2026-07-27-gap-closing-BIG-STATUS.md`.

---

## 8 · Deliberately-left localization items (owner call, not bugs)

Reported, not fixed, because the English **is** the feature or it is AI content:
AI example-prompt arrays + `AI_REFUSALS` cards; the glossary term header; the cut-name translator;
`charcuterieGuardian`'s interpolated safety prose (needs MT, not a static dict key).
My recommendation on record: **leave them.**

---

## 9 · Session-critical constraints (unchanged)

- **Secrets never enter the repo.** Gemini + Cloudflare keys live only as Worker secrets. Never echo,
  commit, or paste a key. (The EVAL key was used transiently via env vars only, never written anywhere.)
- **§11a testing infra:** never two suite runs concurrently; never run the suite while heavy subagents
  compete; stop any manual `serve.js` on 8123 before the suite (it collides with Playwright's managed
  server); restart `serve.js` after `python build.py` (it caches `dist/` at startup).
- **Playwright note:** the MCP browser dropped mid-session and was restored via `/mcp`. If it drops again,
  a **plain Playwright script** (`node` + the `playwright` package) works and passes Cloudflare where curl
  returns HTTP 000 — that is how v276/v277 were live-verified.
