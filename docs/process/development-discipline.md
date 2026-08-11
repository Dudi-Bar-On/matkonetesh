# Development Discipline — Superpowers Process

**Status:** APPROVED by the owner, 2026-07-21.
**Purpose:** guarantee 100% compliance with each spec's Definition of Done, and close the specific failure modes that produced `docs/analysis/2026-07-21-refactoring-report.md`.

> ## ⚠️ READ THIS FILE AT THE START OF EVERY TASK
> Owner instruction. Not optional, not "when it seems relevant". Every task, before anything else.
> Start by re-reading §10 (the owner's standing instructions) and §3 (the DoD gate).

---

## 0. Why this document exists

The 2026-07-21 analysis found ~52% conformance to specs I wrote, a safety guard specified-and-never-wired, and three features that shipped **inert with passing tests**. The Definitions of Done already existed in the specs. Nothing enforced them.

So this is not "add a DoD". It is: **make the existing DoD un-skippable, and add gates for the exact ways I got it wrong.**

---

## 1. The skills, and when each is mandatory

All 14 skills live in the superpowers plugin. These are the ones this project uses, and the moment each becomes non-optional.

| Skill | Mandatory trigger | What it forbids |
|---|---|---|
| **using-superpowers** | Start of every session/task | Acting before checking for an applicable skill |
| **brainstorming** | Before ANY creative work — new feature, behaviour change | Writing code before a design is approved. HARD-GATE |
| **writing-plans** | Only after a spec is approved | Planning without an approved spec |
| **subagent-driven-development** | Executing an approved plan | Implementing without per-task review |
| **test-driven-development** | Every feature, bugfix, refactor | Production code before a witnessed failing test |
| **systematic-debugging** | ANY bug, test failure, unexpected behaviour | Proposing a fix before root cause is found |
| **verification-before-completion** | Before ANY completion/success claim | Claiming anything without fresh command output |
| **requesting-code-review** | End of a branch/phase | Merging unreviewed |
| **receiving-code-review** | Any review feedback (human or agent) | Performative agreement; blind implementation |
| **dispatching-parallel-agents** | Fan-out analysis/search | Ad-hoc parallelism |
| **using-git-worktrees** | Parallel or risky work | Mutating main's working tree |
| **finishing-a-development-branch** | Branch completion | Undefined "done" |
| **writing-skills** | Codifying a recurring lesson | — |

**Standing rule from `using-superpowers`:** *"I remember this skill"* is a red flag. Skills are re-read at invocation, never recalled from memory.

---

## 2. The pipeline

Every phase of the refactoring plan runs this loop end to end. No step is skipped, no step runs out of order.

```
  ┌─ brainstorming ─────────────────────────────────────────┐
  │  explore context → questions ONE at a time → 2-3         │
  │  approaches w/ recommendation → design in sections       │
  │  → OWNER APPROVES each section                           │
  │  → spec written to docs/superpowers/specs/ + committed   │
  │  → spec self-review → OWNER REVIEWS SPEC FILE            │
  └───────────────────────────┬─────────────────────────────┘
                              │ approved only
  ┌───────────────────────────▼─────────────────────────────┐
  │ writing-plans                                            │
  │  file structure → bite-sized tasks → EXACT code in each  │
  │  step → Global Constraints copied verbatim from spec     │
  │  → **DoD checklist attached to every task**              │
  │  → plan self-review → pre-flight conflict scan           │
  └───────────────────────────┬─────────────────────────────┘
                              │ approved only
  ┌───────────────────────────▼─────────────────────────────┐
  │ subagent-driven-development   (per task, fresh agent)    │
  │   implementer → TDD inside (RED witnessed, GREEN, refactor)│
  │   → task reviewer (spec compliance + code quality)       │
  │   → fixes → re-review → **DoD gate** → ledger entry      │
  └───────────────────────────┬─────────────────────────────┘
                              │ all tasks complete
  ┌───────────────────────────▼─────────────────────────────┐
  │ requesting-code-review (whole branch, most capable model)│
  │ → receiving-code-review (verify each finding, push back  │
  │    with reasoning where wrong) → ONE fix wave            │
  │ → finishing-a-development-branch                         │
  └─────────────────────────────────────────────────────────┘
```

**Debugging is not a phase — it is an interrupt.** Any failure at any point suspends the pipeline into `systematic-debugging`'s four phases before anything else happens.

**A generated plan is never submitted to review before `node scripts/check-plan-complete.mjs <plan.md>` exits 0** (per-task fenced-code count > 0, truncation detector — Phase 0 gate; lesson L27, the silent CP2 truncation). Large plans are assembled mechanically (file concatenation), never by LLM concatenation.

---

## 3. The DoD gate (the core of this proposal)

A task is **not done** until every box is checked with evidence pasted in. This runs before the ledger entry, per task, and again per phase.

### Per-task DoD checklist

- [ ] **1 · Spec requirement traced.** The exact spec line(s) this task satisfies, quoted. If none → the task should not exist. **For a recovered item (status ⚠️R in the ROADMAP Recovery Ledger), this line IS the Recovery Relevance Gate (§16/H13):** the trace starts from the item's source pointer; the relevance verdict (בצע/בטל) is a recommendation **decided together with the owner** (a §10.8 mandatory checkpoint) and recorded BEFORE any further work; a בצע verdict names the current-code evidence it was based on.
- [ ] **2 · RED witnessed.** Test written first, run, and *observed failing for the intended reason*. Output pasted. A test that passed on first run is void — rewrite it.
- [ ] **3 · GREEN.** Full test command run fresh, output pasted, exit code shown.
- [ ] **4 · Behavioural assertion.** Every new test asserts an **observable effect** — rendered output, stored state, or a value a real consumer reads. *Asserting a computed field that nothing consumes is not a test.*
- [ ] **5 · Consumer exists.** Any new derived/computed value has a real reader in production code. Named here. *(Closes `hooksOver` and `scale_res`.)*
- [ ] **6 · Fixture minimality.** The test fixture contains only what the scenario needs, and the **negative case is tested**. *(Closes the hanging fixture that supplied exactly what the broken gate required.)*
- [ ] **7 · Regression red-green.** For a bugfix: fix reverted → test observed FAILING → fix restored → test observed PASSING. Both outputs pasted.
- [ ] **8 · Visual evidence.** Any UI change: screenshot at **390 × 844** attached and actually looked at. *(Closes clipped chips and the view opening on an empty instant — both invisible to 294 green tests.)*
- [ ] **9 · Hebrew check.** Any user-facing string: rendered in Hebrew, no English leak, correct singular/plural on interpolated counts, correct domain term. Screenshot.
- [ ] **10 · Safety invariance.** No `bcheck` stage, `temp`, `safe` value, or cook duration altered. Where the task touches the plan, the assertion that proves this is named.
- [ ] **11 · No arbitrary waits.** Tests wait on conditions, not `setTimeout` guesses (`condition-based-waiting`).
- [ ] **12 · Full suite green (H7).** Run `npx playwright test` plain — the config is authoritative (pinned workers, `retries: 0`; see §11a). Output pasted, exit code shown. **Owner ruling H7 (2026-07-30): task gate = ONE clean run (×1); release/ship gate = TWO clean runs (×2)** — the second run happens at the release commit, not per task. Rationale (owner): the run infrastructure was hardened deliberately (warm-page fixtures, measured worker pin, `retries:0`) and is trusted; routine repetition adds cost without information, while a ship deserves the double check. This supersedes both the 2026-07-21 "×1" note and §9's old "×2 per task" row — H7 is now the single source. Any failure — including an intermittent one — is treated as a **bug**, debugged via `systematic-debugging`, **never** re-run to make it pass. Never pass `--retries` or `--workers=1`: retries mask flakes, `--workers=1` is the old serial path.

### Per-phase DoD gate

- [ ] Every DoD line in the governing spec's "Definition of Done" section quoted and marked MET, with the evidence
- [ ] Any line **not** met → phase is not complete; escalate to owner (see §4)
- [ ] Independent conformance re-audit by a fresh agent against the spec, not against the register

---

## 4. The Waiver Gate (the single most important new rule)

**Root cause of this whole report:** `equipPlan` — the central mechanism of an approved spec — was waived in a plan file (`plans/2026-07-20-equipment-occupancy-layer.md:1220`) and never surfaced in conversation.

**New rule, absolute:**

> A plan may never waive, defer, or reinterpret a requirement from an approved spec.
> Any such change is raised with the owner **in conversation**, with the spec text and the reason, and requires explicit approval.
> "Recorded in a document" does not count as raised.

This also applies to: reordering phases in a way that drops a dependency, marking a spec item "deferred", and narrowing a DoD line.

---

## 5. Debugging protocol

Triggered by any failure. From `systematic-debugging`:

1. **Phase 1 — Root cause.** Read the error completely. Reproduce consistently. Check recent changes. **Add diagnostic instrumentation to gather evidence** before proposing anything.
2. **Phase 2 — Pattern.** Find working examples in this codebase. Diff working vs broken.
3. **Phase 3 — Hypothesis.** State ONE hypothesis explicitly. Test minimally, one variable.
4. **Phase 4 — Fix.** Failing test first, single fix, verify.

**The 3-fix rule:** after 3 failed fixes, STOP and question the architecture with the owner. Do not attempt fix #4.

**Applied to my W5 failure:** I attempted three fixes (in-page poll → Playwright locators → pin the instant), each from a *guess* about the cause, without once instrumenting to capture the chip count and chosen instant at failure time. Under this protocol, fix #1 would have been preceded by evidence, and the 3-fix rule would have forced escalation.

---

## 6. Failure-mode → gate map

Each documented failure from the analysis, and the specific gate that now catches it.

| Failure | Gate |
|---|---|
| `equipPlan` waived silently | §4 Waiver Gate |
| `hooksOver` computed, read by nothing | DoD 5 (consumer exists) |
| `scale_res` shipped on 67 recipes, never read | DoD 5 + per-phase spec DoD audit |
| Hanging test asserted a computed field | DoD 4 (behavioural assertion) |
| Fixture supplied the accessory the broken gate needed | DoD 6 (fixture minimality + negative case) |
| Clipped chips; view opened on an empty instant | DoD 8 (screenshot at 390px) |
| `תנור` used as generic; plural bugs | DoD 9 (Hebrew check) |
| W5: three guessed fixes | §5 systematic-debugging + 3-fix rule |
| W5: flaky, retried rather than debugged | DoD 12 (intermittent = bug) + DoD 11 |
| Claimed done while spec DoD lines unmet | §3 per-phase DoD gate |
| Trusting agent "success" reports | verification-before-completion: verify via VCS diff independently |

---

## 7. Reviewer discipline

- Per-task reviewer returns **two verdicts**: spec compliance AND code quality. Missing either → not done.
- Reviewers are never told what not to flag. No pre-judging.
- Findings are handled via `receiving-code-review`: verify against the codebase before implementing; push back with technical reasoning where the reviewer is wrong; no performative agreement.
- Reviewer findings that contradict the plan go to the **owner**, not resolved unilaterally.
- Final whole-branch review runs on the most capable model, with the accumulated Minor list.
- **External proposals get TWO passes by DIFFERENT agents (2026-07-30):** a CONCEPTS pass ("what real gaps
  of ours does this expose?") and a NUMBERS pass (auditing its arithmetic/claims). One verdict = an
  incomplete review. Born from the v5.0 first panel, which audited the messenger's illustrative numbers and
  missed its central mechanism — the owner forced a re-run (`a2c8535`, "owner was right, we have real gaps").
- **A regression test is never narrowed to fit the implementation (2026-07-30, coverage-audit S-3):** a test
  written from a plan/spec scenario keeps asserting THAT scenario; rewriting it post-ship to assert what the
  code happens to do is a silent DoD-narrowing (§4 Waiver Gate territory) and a review-blocking finding.
  Born from the i18n-foundation test that was quietly rewritten after shipping to stop checking the planned
  scenario (coverage audit 2026-07-30, `_agent-summaries.md` controller note on W1-B).

---

## 8. What I will do differently, concretely

1. **Brainstorm each phase with you before planning it** — one question at a time, 2-3 approaches, your approval per section. I skipped straight to plan-writing for the occupancy layer.
2. **Never claim completion without pasted evidence** from a command run in that same message.
3. **Look at the screen** for every UI change, at 390px, before saying it works.
4. **Escalate every deviation** instead of documenting it.
5. **Treat every flaky test as a bug**, debugged to root cause.
6. **Verify agent output myself** via diff, never on their report alone.

---

## 9. Settled decisions (owner, 2026-07-21)

| Question | Decision |
|---|---|
| Suite scope | **H7 (owner, 2026-07-30): task gate = clean full-suite run ×1; release (ship) gate = ×2.** Supersedes this table's former "×2 per task" row, DoD-12's former "×1 always" note, and the memory-only "twice before shipping" instruction — one ruling, one place |
| Isolation | **Work on `main`.** No worktrees |
| Phase 0 ordering | **As proposed** — safety (cure guard) and correctness (cart math) first |
| Brainstorming depth | **Only when required** — when something is unclear, not understood, or not well defined. Depth as required by the subject |
| Selector contract (Dec-H4) | Tests select ONLY via the stable selectors listed in `tests/selector-contract.md` (data-testid / stable ids and classes). Every NEW storage key lives under the `mk-` prefix. The full contract file lands with the Phase 3 codemod (Dec-H3); the rule binds from Phase 0 |
| Co-Authored-By trailer | **The model string the session itself declares, verbatim** — never guessed, never embellished (245 commits carry an invented "Opus 4.8 (1M context)"; the trailer is a factual claim in the permanent record). Optional hardening: a `commit-msg` hook with an exact-string allowlist |

---

## 10. The Discipline — owner's standing instructions

**These are the owner's own instructions. They govern every task. Re-read them before starting each one.**

### 10.1 The loop
> **plan → develop → test → review → debug → re-review → until 100% working. Only then move forward.**

This is a **loop, not a checklist**. Re-entry is the normal case, not the exception. "Move forward" is forbidden while anything is less than 100% working. There is no "good enough for now", no "known minor", no deferring a defect into a later phase without the owner's explicit agreement (§4 Waiver Gate).

### 10.2 Playwright is mandatory — for tests AND for debugging
> **Use Playwright as part of the tests, and for debugging, until verified from a UI point of view that the feature 100% works.**

- Every feature gets Playwright coverage — not only unit-level assertions.
- **Debugging happens through the UI**, driving the real app, not by reasoning over source alone.
- A feature is not verified until it has been **seen working in the UI**. A green assertion is not sufficient evidence on its own.
- This closes the failure mode where 294 tests passed while chips clipped and the occupancy view opened on an empty instant.

### 10.3 Work in cycles until finished
Keep looping autonomously until the task is genuinely complete. Do not stop mid-loop to ask whether to continue.

### 10.4 Learn from failures — write the lessons down
Every failure, defect, or wrong turn gets recorded in §11 with its root cause and the gate that will prevent recurrence. Always try to improve the process itself, not just the code.

### 10.5 Maximize subagent usage
Delegate aggressively: implementers, reviewers, debuggers, analysts, verifiers. Parallelise wherever the work is independent. The controller coordinates and verifies; it does not do work a subagent could do.

### 10.5a Agent-concurrency ceiling (Phase 0, 2026-07-30 — the fan-out-wedge lesson, L25)
§10.5 is bounded by machine reality, exactly as suite workers are pinned in `playwright.config.ts`:
- **Default: sequential.**
- Independent LIGHT work (read/scan): up to **3 concurrent**; hard cap **5**.
- While a suite run, a build, or the translation GPU queue is active: **at most ONE heavy agent**
  (extends §11a's serialization rule from workers to agents).
- Three independent bug fixes = three separate dispatches, never one super-agent (the over-bundling
  lesson, L26).
- On API 529 overload: drop to one-at-a-time and send a small probe agent first.
- ALWAYS reconcile agents-started vs results-received before trusting a fan-out workflow's output.
Every `dispatching-parallel-agents` brief quotes this ceiling (see the brief template,
`docs/process/templates/task-brief.md`).

### 10.6 Summarize after every task or step — in three parts
After each task or step completes, show the owner a summary. Not at the end of a phase — after each step.

**Owner instruction, 2026-07-22: every such summary has three parts, in this order.**

1. **DONE** — what this completion actually delivered, with the evidence (commit, test counts, what was
   verified). Findings and surprises belong here, not buried.
2. **NEXT** — the immediate next step, and anything that must be decided before it can start.
3. **LEFT UNTIL THE GRAND FINAL** — the distance still to run on the *whole* programme, not just this
   phase. **This part IS the ledger line from `docs/ROADMAP-2026-07-30.md` §5** (a number — "N closed /
   156, M to target", read via `docs/STATUS-BOARD.md`), not prose. A Phase-gate agent checks the ledger
   was updated; an un-updated ledger fails the gate. Where a number genuinely does not exist yet, say so
   rather than implying progress that has not been measured.

**Why part 3 exists.** A per-task summary tells the owner a task finished; it does not tell them whether
the programme is on course. Without the third part, a long programme reads as an unbounded sequence of
green ticks. The owner asked for the distance, every time, so that "we finished a task" can never be
mistaken for "we are nearly there."

**The honesty rule applies hardest here.** A burn-down that counts a gap as closed before its review is
clean, or that omits gaps added along the way, is worse than no burn-down — it manufactures confidence.
State work-in-progress as in-progress.

**H9 — the mandatory task-summary table (owner ruling, 2026-07-30; the structured form of the three
parts).** EVERY development task — in Main or in a subagent — ends with a fixed 5-row table:
| # | Row | Content |
|---|---|---|
| 1 | **מה היה** (Before) | the state/problem before the task |
| 2 | **מה נעשה** (Done) | what was actually done + evidence (commit, tests, files, per H10c: vNNN · date+time) |
| 3 | **מה נשאר** (Remaining) | what stays open from the task/phase |
| 4 | **איפה אנחנו** (Position) | "Phase X, task Y of Z" + ledger "N closed / M to target" — **read from `docs/STATUS-BOARD.md`** (H10) |
| 5 | **הבא בתור** (Next) | the next tasks in line |
For subagents this is part of the report contract (a brief without the table requirement is an invalid
brief — see `docs/process/templates/task-brief.md`); Main verifies and relays. Every task close also
UPDATES `docs/STATUS-BOARD.md` (H10) — enforced by the arc-close checklist and by Phase gates (a stale
board fails the gate). **H10a (owner):** the table and board are MAINTAINED every task but SHOWN to the
owner only at milestones (Phase gate · release · arc close) or on request — tight tracking without noise.

### 10.7 Read this file at the start of every task
Non-negotiable. Memory is not a substitute for re-reading.

### 10.9 Show a mockup before building any significant graphics/visual redesign
> **Owner instruction (2026-07-21): before implementing new graphics — the Phase-2 device diagrams, or any comparable visual redesign — build an interactive mockup/demo and show it to the owner to discuss, improve, and approve FIRST. Do not implement the visuals until the mockup is approved.**

Applies specifically to Phase 2 (the device diagrams: shelf stacks, hook bay, grill zones, sous-vide vessel, ribbon). Build the mockup as a self-contained HTML artifact (publishable via the Artifact tool or a local file the owner can open), covering each device type at 390px with realistic data, then get sign-off before writing production view code.

### 10.8 Only interrupt for decisions that are genuinely important
> **Ask the owner only when the decision is important. If it is not, do not ask — proceed by the order / the recommended option, and note the choice in the step summary.**

A decision is **important** (→ ask) when it: is hard to reverse or destructive; involves safety or a legal/health number; **waives or reinterprets a spec requirement** (§4 Waiver Gate — always ask); materially changes scope, cost, or the deliverable; or turns on the owner's preference in a way that cannot be reasonably inferred.

A decision is **routine** (→ do not ask, just do it) when it is: task ordering among items already agreed; an obvious or conventional default; an implementation detail; or anything where a careful colleague would simply pick the sensible option and move on.

When genuinely unsure which bucket a decision falls in, **prefer proceeding over interrupting** — make the call, state it in the summary, and let the owner redirect if they disagree. Interrupting for a routine choice wastes the owner's time; the summary-after-every-step (§10.6) is the safety net.

### 10.10 Verify every shipped version on the LIVE site with Playwright
> **Owner, 2026-07-21: "test with playwright every time a version is shipped."**

A push is not a release. **A release is not done until the live URL has been verified with Playwright** — by me, not by the owner discovering it.

After every deploy, drive `https://matkonetesh.pages.dev` with Playwright and assert **both**:
1. **The version stamp matches what was shipped** — read `.foot-stamp`; it must equal the version just built (`מהדורה NNN`). A mismatch means the release did not land.
2. **A feature probe from this release is actually present** — e.g. a new global (`typeof deviceSilhouette==='function'`), a new CSS class, or new markup. The stamp alone can be right while the payload is stale.

**Deploys are not instant — poll, do not assume.** Cloudflare Pages rebuilds from source (`build.py` on a ~2.6 MB bundle) and this takes minutes. Re-check the live URL on an interval until the stamp matches, and only then report the release as done. **Never tell the owner a version is live before the live check passes** — on v255 I announced the ship immediately after `git push`, the owner looked before the build finished, saw the previous version, and I then mis-diagnosed it as their device cache. The build was simply still running.

Also verify the delivery path itself, once, when it changes: `/` and `/index.html` should serve the new HTML with a revalidating `Cache-Control`, and `/sw.js` must be `no-cache` with a fresh content-hash `CACHE` name.

**Fallback protocol when browser tooling is broken (Phase 0, 2026-07-30 — one release shipped with no
live check at all when Playwright/MCP tooling failed):** if the Playwright live check cannot run, the
MINIMUM bar for saying "live" is a curl probe of the live URL asserting BOTH (a) `.foot-stamp` contains
the shipped `מהדורה NNN` and (b) a feature string from that release is present in the payload — output
pasted into the report. The full browser verification is then COMPLETED THE SAME DAY, and its result
reported. **Without one of the two, "live" is not said at all.**

---

## 12. Thinking models — adopted from the `methodology` corpus, now a `tool_spec` record in the geniza (2026-07-22)

**Where this came from.** The owner asked whether the global graph's `methodology` corpus (4,335 nodes)
held anything worth adopting. It holds the **GSD** framework from the `matkonet` project, whose thinking
models are curated from the [thinking-partner](https://github.com/mattnowdev/thinking-partner) catalog
(150+ models). **Fifteen models across three clusters are adopted below. The rest is deliberately not.**

**How to read it yourself:**
```python
from src.knowledge import retrieval
retrieval.search_current_docs("methodology", filters={"source_type": "tool_spec"})  # the corpus, its sections and concepts
retrieval.search_current_docs("thinking models")
retrieval.search_current_docs("gate prompt patterns")
retrieval.search_current_docs("premortem")
```
The store gives structure and labels; the prose lives in
`C:\Users\dudib\source\repos\matkonet\.claude\gsd-core\references\thinking-models-{planning,execution,debug}.md`
and `gate-prompts.md`. **That path is another local repo and may vanish — the geniza is the durable
record.** Per §10.13, the store located the material; the source files were then read before adopting it.

### 12.1 What was REJECTED, and why

GSD's workflow machinery — its phases/waves, `PLAN.md`/`SUMMARY.md`/`VERIFICATION.md` artifacts, `/gsd-*`
commands, `checkpoint:decision` task types, and per-agent model profiles — is **not adopted.** Our
pipeline is superpowers-based (§2). Importing a second, competing process would create exactly the
"same subject specified twice, neither document citing the other" defect the knowledge graph found four
instances of in our own corpus. **One process, or none.**

### 12.2 Debug cluster — sharpens §5, and independently re-derives L14

Apply at decision points during investigation, not continuously.

1. **Fault Tree first, Hypothesis-Driven second.** Build the tree of possible causes (symptom as root;
   branch into software / config / data / environment; AND vs OR gates) *before* testing anything. Do not
   prune a branch for being unlikely if it is cheap to test.
2. **Hypothesis-Driven protocol: PREDICT → TEST → OBSERVE → CONCLUDE.** *"If H is correct, test T
   produces result R."* **Never skip PREDICT** — without a prediction you cannot tell a meaningful result
   from noise. Never change more than one variable per test.
3. **Occam's Razor.** Rule out typo / wrong path / missing import / stale cache / wrong env var *before*
   race conditions and framework bugs. **If your hypothesis needs 3+ things to go wrong at once, stop and
   look for a single-point failure.** — *This is L14 restated by an independent source: the owner could
   not see v255, and I theorised about their service-worker cache instead of asking whether the deploy
   had finished.*
4. **Counterfactual.** Change exactly one thing and predict the bug appears/disappears. Tests the
   mechanism, not the timeline — stronger than "it broke after deploy X".

Our **3-fix rule (§5) still governs**: these models make each attempt evidence-led; they do not buy a
fourth attempt.

### 12.3 Execution cluster — names failure modes we have already paid for

1. **Circle of Concern vs Circle of Control.** Before touching code not in the task's scope: is this mine
   to fix, or merely something I noticed? Note it as a deviation; do not fix it. *"While I'm here" is the
   single biggest source of executor overrun.*
2. **Chesterton's Fence.** Do not remove or rewrite code whose purpose you don't understand — check git
   blame, comments, tests. If the purpose stays unclear, keep it and note the uncertainty.
3. **First Principles.** Before copying a nearby pattern, ask what constraint it satisfies and whether
   this task shares it. Otherwise it is cargo cult. — *L6 is exactly this: `תנור` was used as the generic
   device word because new code copied without checking the correct pattern already in the codebase.*
4. **Occam's Razor (build).** The simplest implementation satisfying the requirement is the correct one.
   No abstraction, generic, or config option the spec did not ask for. (YAGNI, with a name.)
5. **Forcing Function.** Resolve an ambiguous requirement at build time rather than hiding it behind a
   TODO or a runtime check. If it truly cannot be resolved now, **raise it — see §4.**

### 12.4 Planning cluster — two of these close real gaps in this discipline

1. **Constraint Analysis, then Pre-Mortem** (in that order). Identify the single hardest constraint — the
   one that makes everything else irrelevant if it fails — and **schedule it as task 1 or 2, never last.**
   Then assume the plan has already failed and list the 3 likeliest reasons, adding a check for each.
2. **MECE at the requirement level.** Every requirement maps to exactly one task's done-condition; flag
   any requirement covered by no task. This is the per-phase DoD audit (§3) done *before* the work.
3. **Reversibility Test.** Classify each decision REVERSIBLE or IRREVERSIBLE and **spend analysis time in
   proportion to irreversibility.** — *This sharpens §10.8: "is it hard to reverse" is already our first
   test for interrupting the owner; this adds the corollary that cheap reversible decisions deserve less
   deliberation, not just less asking.*
4. **Curse of Knowledge Counter.** Re-read every instruction as if you have never seen this codebase. Is
   every noun unambiguous (which file, which function) and every verb specific (modify *how*)? — *Directly
   applicable to subagent briefs, which is where this project's instructions actually fail.*
5. **Base Rate Neglect Counter.** Every LOW-confidence item and open decision must be either resolved or
   documented with why the risk is acceptable. **Silently accepted low-confidence items become
   undocumented technical debt** — the same shape as §4's waiver failure.

### 12.5 Gate prompt patterns — §10.8 says *when* to ask; this says *how*

Constraints: **max 4 options**, `header` ≤ 12 characters, never multi-select for a gate, and always
handle the freeform "Other" answer. If more than 4 options are needed, use a two-step flow.

Ready-made shapes: `approve-revise-abort` (Approve | Request changes | Abort) · `yes-no` ·
`stale-continue` (Refresh | Continue anyway) · `multi-option-failure` (Retry | Skip | Rollback | Abort) ·
`multi-option-escalation` (Accept gaps | Re-plan | Debug | Retry) · `multi-option-gaps`
(Auto-fix | Override | Manual | Skip) · `multi-option-priority` (Must-fix only | Must + should |
Everything | Let me pick) · `scope-confirm` · `depth-select` · `action-routing` (last option always
"Something else") · `gray-area-option` (last option always "Let Claude decide").

### 12.6 When NOT to think — the anti-ceremony rule, and it is load-bearing

All three clusters ship this section, and it is adopted with them. **This discipline is already heavy;
a reasoning model applied where it adds nothing is cost with no evidence.** Skip them for:

- **Single-task work** with one clear requirement — write the task, do not pre-mortem it.
- **Obvious single-cause bugs** — a stack trace naming file, line and cause gets fixed, not fault-treed.
- **Following an established project pattern** the plan asks you to extend (Chesterton's Fence governs
  *removal*, not repetition).
- **Trivial mechanical edits** — an import, a typo, a version bump.
- **Procedural steps** — running a verify command is not a decision point. Invoke a model only when it
  *fails* and you must choose how to respond.
- **Revision passes** — apply only the model relevant to the flagged issue, not the whole suite again.

---

## 11a. Testing infrastructure (established 2026-07-21)

> **🧑 owner ruling, 2026-07-30 — WRITING a test is governed by `tests/TEST-AUTHORING-CONTRACT.md`.**
> Every agent that writes or edits a test reads that file FIRST; every task brief that touches tests
> carries it (template §(ו)). It encodes the warm-page architecture this section documents — the arc that
> took the suite from 3+ minutes to ~54s and cured the loopback flake — as an authoring contract:
> `test`/`seedApp` from `./_fixtures` only · `addInitScript` forbidden on the warm page · `isolatedPage`
> for clock/SW/`test.use` · every in-test `route` unrouted in `try/finally` · condition waits only
> (`waitForResponse` does NOT prove the state was applied). **A test written outside the contract is
> rewritten, even if it is green** — it is slow and flaky, and its flakiness gets misread as a product bug.
> Trigger for the ruling: a Phase 1 implementer authored tests without knowing this existed.

**How to run the suite:** `npx playwright test` — nothing else. The config is authoritative.

- **Server:** `serve.js` is a **single in-memory process** — de-clustered 2026-07-23 (L18: the earlier clustered design's `cluster.on('exit', () => fork())` turned a killed worker into an unkillable respawning zombie) — with SIGINT/SIGTERM handlers for a clean shutdown; every `dist/` file is served from a Buffer (zero per-request disk I/O). Since the loopback fix (2026-07-24, see the Concurrency bullet below), the main `chromium` project's per-test navigation no longer opens a real HTTP connection to serve.js at all — `tests/_fixtures.ts` fulfills `/index.html` from an in-memory Buffer via `context.route`; serve.js still serves subresources and the dedicated `service-worker` project's real HTTP delivery (needed for genuine SW caching). Playwright starts and tears down this server itself (`webServer.command`); **do not** run `serve.js` by hand for a test run.
- **Concurrency:** `workers: process.env.CI ? 2 : 20`, pinned in `playwright.config.ts` (**the config's comment is authoritative — this doc drifts; read the config**). **20 is CERTIFIED** (2026-07-24) on the post-loopback-fix architecture. Every mid-worker-count collapse recorded through this document's history (10 workers here; the 12-worker Phase C campaigns) was never a P-core-oversubscription limit — L21 already rewrote that story once, and the real cause turned out to be one layer deeper: the loopback-connection nav-stall proven and fixed in `docs/research/flake-refactor-rootcause.md` (`route.fulfill` in-memory doc serving, commits `7d5402d`+`f74f1b8`, independently reviewed `ba1da6a`). With the fix in place a fresh 12/16/20/24-worker curve probe ran clean at every point (439/439 each); 20 was fastest (~54s) and was then certified 7/7 clean over 7 serialized runs (8/8 combined with the curve probe's own clean reading) — full numbers in the POST-LOOPBACK-FIX session, `docs/research/measurements/m1b-capacity-probes-2026-07-23.md`, and **L22** below. CI stays 2 (GitHub ubuntu-latest is 4-vCPU).
- **Run the suite SERIALIZED — never under competing CPU load.** A single run at the measured ceiling still flakes (`ERR_ABORTED` on navigation) if **other heavy subagents/processes** run at the same time — the 10-worker local ceiling assumes an otherwise-idle machine. This extends "never run two suite runs concurrently": during a suite run, pause other CPU-heavy background agents. (2026-07-23: a migration task's suite flaked 10/425 mid-run under parallel-subagent load; 3× clean once the machine was idle.)
- **Retries:** `retries: 0`. A flake must surface as a failure and be fixed, never retried away.
- **מי מריץ את שער הסוויטה — הבקר, לא המבצע** (אומץ 31.7.2026, אחרי שלוש משימות שבהן סוכנים המתינו
  לריצת-רקע ושרפו ~שעה): המבצע מריץ **רק את קובצי הבדיקה שהוא נוגע בהם** (`npx playwright test
  tests/<file>.spec.ts`) — זו ראיית ה-RED/GREEN שלו. **הסוויטה המלאה רצה פעם אחת, בחזית, אצל הבקר**
  (או אצל המבצע בסוף, בחזית בלבד). אין הרצת סוויטה ברקע עם המתנה — סוכן שנתקע בלולאת "ממתין" עולה
  סבב מלא בכל חזרה. אם ריצה בחזית ארוכה מדי עבור המבצע — הוא **מוסר** עם ראיות פרטניות, ולא מסקר.
- **כלי הדיבוג של Playwright (אומץ 31.7, מסקירת הכלים):** ללולאת התיקון — `--last-failed` (רק מה
  שנפל), `--only-changed`; לפלייק — `--trace on` ואז `npx playwright show-trace`; לחקירה — `--ui`.
  **אף אחד מהם אינו שער DoD**: השער נשאר `npx playwright test` נקי ומלא, בלי `--retries`/`--workers`.
- **Navigation timeout: `navigationTimeout: 15_000`** — kept BELOW the test-level `timeout` (30s). A value ABOVE it (the old 60s) was **dead config**: the test timeout is the hard ceiling over navigation too, so it fires first — raising `navigationTimeout` above it does nothing (this cost a mis-diagnosis on 2026-07-23; "raise the ceiling" was wrong). The REAL nav-strategy fix is **`tests/_fixtures.ts`**: every `page.goto` now defaults to `waitUntil:'domcontentloaded'` instead of `'load'` (the app is interactive at DCL; `'load'` only waited on fonts/icons/manifest). **But DCL alone was not the whole story** — the residual starvation driver blamed here was later corrected: the "P-core oversubscription" mechanism did NOT reproduce on a clean machine (see the rewritten L21 and the Concurrency bullet above, which now also carries the loopback-fix resolution and L22; contaminated-evidence lesson L18/L20). On today's warm-page architecture a correct nav is ~1s, so 15s is pure diagnostic headroom. **Note (2026-07-24): the config's actual `navigationTimeout` is now 20s, not the 15s this bullet's header still names** — see the config comment and the Concurrency bullet above, which is authoritative; this bullet's DCL-vs-load narrative is otherwise unaffected.
- **Measure reliability over ENOUGH runs.** A ~1-in-6 flake hides completely in a 3-run check — a 3/3-clean sample on 2026-07-23 led to a wrong "it was just competing load" conclusion; the real intermittent nav-timeout only surfaced on a later single run. When establishing a worker ceiling or a flake fix, run the full suite **~6–9×**, not 3.
- **After every `python build.py`, RESTART the manual `serve.js` before a UI check.** It caches `dist/` in memory at startup (single in-memory process, de-clustered 2026-07-23 — see the Server bullet above), so a rebuild does not reach a still-running manual server — you will verify a stale build. (Playwright is unaffected: its `webServer.command` rebuilds+restarts per run.) Also clear the PWA service worker if a stale page persists.
- **Interactive debugging** (MCP browser / chrome-devtools) needs its own manual `serve.js` on 8123 — **stop it before running the suite**, or Playwright's own managed server collides with it (`reuseExistingServer: false`). Every "port 8123 already in use" error traces to a leftover manual server.
- **Never** run with `--workers=1` or `--retries=N` — those were the old anti-pattern (13 min + masked flakiness).
- **Every SETUP owns a matching TEARDOWN — like a test's setup/teardown (owner instruction, 2026-07-23).**
  Whenever you start a server, spawn a process, bind a port, or acquire a resource, you own its clean
  shutdown. **Prefer letting a run COMPLETE** (Playwright tears its own `webServer` down) — never kill a
  suite mid-flight. `serve.js` is now a **single in-memory process** (de-clustered 2026-07-23, L18) with
  SIGINT/SIGTERM handlers for a clean shutdown — the old cluster's `cluster.on('exit', () => cluster.fork())`
  respawn-on-kill behavior, which turned a port-based `taskkill` into a *respawning zombie server* that
  listened and accepted connections but never responded (wedging 8123 for every later run — exactly what
  turned a worker measurement into hours of thrash on 2026-07-23), **is gone.** The rule still stands
  regardless: a forceful/port-based `taskkill` can still bypass the handlers and leave an orphan holding the
  port. If you must kill, kill the **whole tree from the primary**, then **verify the resource is released**
  (port refuses connections, 0 orphan `node`/`serve.js`). A kill without a verified teardown is a defect, not
  a cleanup.

---

## 11. Lessons log

Append after every failure. Format: what happened → root cause → the gate that prevents recurrence.

| # | Lesson | Root cause | Gate |
|---|---|---|---|
| L1 | `equipPlan` — a spec's central mechanism — was never built | Waived in a plan file, never raised in conversation | §4 Waiver Gate |
| L2 | `hooksOver` and `scale_res` shipped computed-but-unread; hanging feature inert | A derived value was treated as done without a consumer | DoD 5 |
| L3 | Hanging tests passed on an inert feature | Test asserted a computed field; fixture supplied exactly what the broken gate needed | DoD 4, DoD 6 |
| L4 | Clipped chips; occupancy view opened on an empty instant | UI never looked at; 294 green tests proved nothing visual | DoD 8, §10.2 |
| L5 | W5 flakiness: three fixes, all guesses | No root-cause phase, no instrumentation, no 3-fix stop | §5, DoD 11 |
| L6 | `תנור` used as the generic device word, colliding with the oven category | New code ignored a correct pattern already in the codebase | DoD 9 |
| L7 | Work called shipped while spec DoD lines were NOT MET | No per-phase DoD audit against the spec | §3 per-phase gate |
| L8 | A DoD-5 "add a consumer" fix can itself be dead if the consumer's render path never runs on the data (scale_res reader added, but makes/specials rendered no equipment section) | Confirmed a reader exists but not that it executes on the shipped rows | DoD 5 must name the render path AND confirm it fires on the real data |
| L9 | Pinning a browser clock exposed a test mixing page-side and Node-side dates (fixed page date vs real wall time) | `page.clock` only affects the page; a Node-side `new Date()` in an assertion still reads real time | When using `page.clock`, sweep the spec for Node-side clock reads in assertions |
| L10 | `--workers=1 --retries=2` ran the suite serially (13 min) AND masked flakiness | Command-line overrides fought the config's `fullyParallel`/`retries:0` intent | Run `npx playwright test` plain; never override workers/retries |
| L11 | A single-process server re-reading a 2.4 MB file per request made high concurrency non-deterministic (ERR_ABORTED) | Server was the bottleneck, not the tests | Clustered + in-memory server; pin workers to the measured reliable ceiling |
| L12 | A UI check verified a STALE build — the in-memory serve.js caches dist/ at startup, so a rebuild never reached the running manual server | Restart the manual server after every build before a manual UI check (Playwright restarts its own) |
| L13 | A ≥ floor marker rendered as ≤ (opposite meaning) in RTL — the DOM-text test asserted the char was present but not its visual order | Numeric/math readouts in Hebrew UI must be LTR islands (dir="ltr"); catch bidi order by LOOKING, and guard with a dir assertion |

**L14 · A push is not a release; a deploy takes minutes (v255, 2026-07-21).**
I announced "v255 is shipped" the moment `git push` returned. The owner looked, still saw 254, and my first
diagnosis was wrong — I blamed their service-worker cache and started engineering a cache fix. The truth was
mundane: Cloudflare Pages was still rebuilding (build.py over a ~2.6 MB single-file bundle). Verifying the
live URL with Playwright showed the server was already correct once the build finished.
Two rules came out of it: (a) §10.10 — never report a version live until a Playwright check against the live
URL passes, polling for the build rather than assuming; (b) when the owner reports "I don't see it", check
the *simplest* external explanation (has the deploy finished?) before theorising about client caches.
It did surface one genuine defect worth keeping: the app never called `reg.update()`, so an installed PWA
that is resumed rather than navigated could go indefinitely without checking for a new worker.

**L15 · An arbitrary wait is a latent flake; a full run is where it detonates (2026-07-21).**
`copilot.spec.ts` failed once in a full run and passed every time in isolation. Root cause was not the
product but the test: `await page.waitForTimeout(150)` after clicking "log reading". Under parallel load
the handler had not yet persisted and re-rendered when the 150 ms expired. Converted to condition waits
(`waitForFunction` on the probe count AND on the re-rendered card) — DoD #11 exists precisely for this.
Two further lessons: (a) never diagnose a mass failure while several suite runs race each other — my own
back-to-back runs produced 12 then 127 bogus ERR_CONNECTION_REFUSED failures and sent me hunting a
non-existent server bug; run once, alone, and read the result; (b) `grep -c waitForTimeout tests/` found
46 more arbitrary waits in 9 other files — every one is a flake waiting for an unlucky run. They are
tracked and should be converted file-by-file, not blindly.

**L16 · A summary written from recollection is not the source (2026-07-22).**
Asked whether the discipline reaches every mission, I found the real gap — this repo had no `CLAUDE.md`,
so the 391 lines here were reachable only through one line in my private memory, and **subagents inherit
`CLAUDE.md` but never that memory**. Nineteen extraction agents had been dispatched that morning with no
automatic knowledge of any of this; they complied only because every rule was hand-pasted into each brief.
Correct diagnosis. Then I wrote the fix **from my own recent scar tissue instead of from this file** — and
shipped a `CLAUDE.md` that omitted §3, which this document calls *"the core of this proposal"*, and §4,
which it calls *"the single most important new rule"*. I had summarised the discipline without re-reading
it, while the file's own first instruction is to re-read it, and §1 warns that *"I remember this skill"*
is a red flag. The owner caught it in one line: *"a very poor and small part of my discipline."*
Root cause: identical in shape to L2/L8 and to the 42 refutations of the 2026-07-22 sweep — **a single
remembered artifact trusted in place of the thing itself.** Gate: when writing anything that *represents*
a source document — a CLAUDE.md, an index, a summary, a brief for an agent — open the source and work
section by section through it. Derived artifacts state which document is authoritative and defer to it.
See `docs/process/skills/verify-against-the-runtime-path/SKILL.md`; the rule generalises past code.

**L17 · A commit script that stages a directory silently omits everything outside it (2026-07-22).**
`scripts/sync-docs.sh` staged `docs/ .claude/skills/ scripts/`. **`CLAUDE.md` is at the repo root**, so
three consecutive runs committed and pushed discipline updates — §10.13, §12, the §10.11 addendum, L16 —
while leaving `CLAUDE.md` itself uncommitted, and printed `pushed — origin is up to date` every time.
The script was honest about the graph and blind about its own file list. **The one file every subagent
inherits was the one file not being saved**, which is precisely the gap §CLAUDE.md exists to close, so the
failure was self-concealing: the rules looked present in the working copy and would have vanished on a
fresh clone or in CI. Found by an analysis subagent that ran `git status` as background context, not by me
and not by the script. Root cause: **an allow-list of directories is a silent deny-list of everything
else.** Gate: a script that reports a push must verify it staged the files the task actually changed —
compare `git status --short` before and after, and warn on any modified tracked file left unstaged. Same
family as the earlier `tail -1` bug in this same script, which printed "Everything up-to-date" while the
branch was one commit ahead.

**L18 · Never kill a suite mid-flight — the respawning zombie server (2026-07-23).** Repeated
kill-and-restart of suite runs during a worker measurement left `serve.js`'s cluster primary alive
(`cluster.on('exit', () => fork())`, no `exitedAfterDisconnect` guard — Node's own documented
anti-pattern): a port-based `taskkill` killed workers, the primary respawned them, and the result was a
**zombie server that listened and accepted connections but never responded**, wedging 8123 for every later
run and turning one measurement into hours of thrash. The debugging methodology *created* the failure being
debugged. Fix: serve.js de-clustered (single in-memory process + SIGINT/SIGTERM); rule: §11a
setup⟺teardown — let runs complete; a kill without a verified release (port refuses, 0 orphans) is a defect.

**L19 · A "fix" whose mechanism never fires is a placebo (2026-07-23).** `navigationTimeout: 60_000` was
committed as the nav-flake fix and "verified" by 9 clean runs — but the test-level timeout (30s) is the
hard ceiling over navigation, so a nav timeout ABOVE it is **dead config**; the clean runs were lucky
low-load windows (and a 3-run sample hides a 1-in-6 flake — §11a now says 6–9×). Gate: a fix must be shown
to actually FIRE — after the change, reproduce the failure and confirm the *error signature changed* (here:
"Test timeout 30000ms" should have become a nav-specific 60s error; it didn't — that was the tell).

**L20 · Verify the measurement before trusting the measurement (2026-07-23).** Two probes lied in one
evening: (a) a "clean screen" wrapped runs in `/usr/bin/time`, which **does not exist in Windows git-bash**
— all five "runs" executed nothing, and the idle CPU was misread as "not CPU-bound"; (b) sampling
`chrome.exe` missed that Playwright's browser can run as `headless_shell.exe`. Gate: when a measurement
shows something surprising, first prove the probe ran the workload — non-trivial duration, processes
actually spawned, server actually responding — before reasoning from it.

**L21 · A worker ceiling measured on a contaminated machine is not a ceiling — and it cost us a wrong
"hardware truth" (2026-07-23; corrected the same day).** The original entry here asserted a mechanism:
above 8 workers the P-cores oversubscribe and the heaviest-init specs deterministically starve past the
30s timeout ("10 → 10 FAILED, always the same specs"). Re-measured under instrumentation on a
verified-idle machine, that story did NOT reproduce: **M1** (`npx playwright test --workers=10` wrapped
by the per-LP CPU sampler) ran **clean — no failure cluster** — with the P-cores far from saturated
(P-class `% Processor Utility` mean ≈69 / median ≈55; E-class mean ≈84 — the E-cores were the HOTTER
class) against an 8-worker **M0** baseline of P ≈56/36, E ≈72/70. The **M1b** worker-count curve
confirms it: 12 workers → 433 passed, 1.6 m; 16 workers → 16 FAILED (417 passed), 1.7 m — a single-run,
non-monotonic blip that did not repeat and was not captured to spec-level detail; 20 workers → 433
passed, 1.0 m, the fastest AND cleanest point on the whole curve. These were single, un-sampled probes
(not §11a's 6–9× reliability campaign), so they establish *capacity and non-monotonicity*, not a new
pin — but they confirm nothing breaks deterministically anywhere near 10. Raw artifacts (mostly
gitignored working data — which is why the numbers above are inlined here):
`docs/research/measurements/cpu-sampler-m0-baseline-8w-2026-07-23T22-11-00.summary.json`,
`cpu-sampler-m1-10-workers-2026-07-23T22-14-31.summary.json`,
`census-m1-census-midrun-2026-07-23T22-15-17.csv`. The M1b curve itself is banked as a tracked note (not
gitignored), `docs/research/measurements/m1b-capacity-probes-2026-07-23.md`. The original "evidence" was
taken on a machine polluted by the same debugging session's own respawning zombie servers and a broken
`/usr/bin/time` probe (L18/L20) — a contaminated experiment produced a confident, specific, WRONG
mechanism, and it survived here precisely because it sounded like hardware truth. Lessons kept:
(a) a worker-ceiling measurement is only as good as the proven cleanliness of the machine under it —
verify idle (0 orphan `node`/`serve.js`, ports released) BEFORE the runs, and sample §11a's 6–9×, never
3; (b) `workers: 8` stays for now as the last known-clean setting — re-deriving the real ceiling from
the M-series curve is the CPU-max programme's **phase B/C decision (the owner's)**, not a drive-by edit.

**L22 · The loopback saga: five campaigns tallied a defect that one boundary-instrumented probe found in an
afternoon (2026-07-24).** Four full-suite certification campaigns before this one — Phase C, Phase C RERUN,
the 8-worker certification, POST-FIX F1+F2 — spent dozens of serialized runs measuring a suite that still
failed 2/7–5/7 at every worker count tried, while a chain of plausible mechanisms was chased and fixed in
turn: `waitUntil:'load'` vs `'domcontentloaded'`, then P-core oversubscription (L21 — itself later rewritten
once already), then a run-start cold-parse "stampede" fixed by staggering worker starts (F1+F2). Each fix
was real and each helped, and none was the actual cause. The real defect: on an ~85%-idle machine, concurrent
`page.reload` navigations were hanging **inside chromium, before the socket even opened** — the
Windows/chromium loopback connection layer was **serializing** concurrent local HTTP connections, releasing
requests to `serve.js` in a **staircase** (~1 every several seconds) while CPU sat at 7–20%. It was found,
not theorized, by **boundary instrumentation**: tagging every request with a worker id and timestamping it on
BOTH sides of the loopback connection — the reload-storm harness (chromium/client, send-time) and
`serve-log.mjs` (server, receive-time) — on **one machine, one clock**, so a 20-second gap between "client
sent" and "server received" could not be explained away as cross-process clock skew. It was then **proven**,
not just observed, by a cure: `route.fulfill` serving the warm page from an in-memory Buffer (no real
loopback connection at all) took the identical 12-way concurrent-reload harness from 200–286 s (mostly
timeouts) to **2.9–12.2 s clean — a ~20–24× swing on the shipped shape**
(`docs/research/flake-refactor-rootcause.md`). **Gate:** when a wait hangs while the machine is provably
idle, the next move is to **instrument the boundary BETWEEN layers** (client send-time vs server
receive-time; app vs OS; process vs process) before theorizing further **within** a layer that is already
instrumented and already showing nothing — every prior mis-diagnosis in this chain (load-event, P-cores,
stampede/heap) was a within-layer theory, and none of them needed to touch the one boundary that actually
held the answer. Two methodology lessons the owner drew from watching this play out, worth keeping as
general practice: (1) **canary middle-values** — deliberately choosing a MIDDLE timeout (not the tightest,
not the loosest) and a MIDDLE/high-stress worker count while debugging keeps an intermittent defect
reproducible without either hiding it (too loose — L19's dead 60s-timeout config) or drowning it in unrelated
noise (too extreme); (2) **§10.18 stop-and-debug beats campaign-tallying** — this saga is its own proof: four
campaigns running the suite 5–7× each to tally a pass rate produced numbers, not a cause; one
systematic-debugging session with a purpose-built repro harness (the reload-storm arms) found root cause in
hours. Measurement campaigns certify a stable system; they do not diagnose an unstable one.

**L23a · A percentage claim without a named rendered-DOM artifact is blocked (v267, split 9.8.26).**
A coverage, translation or localization percentage may appear in a final report only alongside a NAMED rendered-DOM measurement artifact — a per-language screenshot, or the output file of a rendered-DOM measure run. A percentage with no named artifact is blocked at stop.

**L23b · A proxy metric is not the screen: "99% translated" shipped half-English screens (v267, 2026-07-26).**
The v267 localization claim ("~99% translated", "ready to test") was measured on key coverage and bundle-string
grep — while the real fr/de/es/it screens rendered roughly half English. The owner caught it on screen, and the
sequel (v269/v270) exposed two more layers the proxy could not see: untranslated data-values behind translated
keys, and shell-level leaks past the dictionary. This is the exact failure the project's own skill
`verify-against-the-runtime-path` was written to prevent — violated a second time after the skill existed.
Cost: three repair releases (v268–v270) plus an owner QA round, plus owner trust burned on a "done" that wasn't.
Root cause: measuring at an intermediate (keys, bundle strings) instead of at the consumer's input (the rendered
DOM, per language). Gate: any coverage/translation/localization claim is stated ONLY from a rendered-DOM
measurement per language (§10.19); key-coverage and grep counts may be reported only as explicitly-labeled
proxies, never as the claim.

**The judged half:** a coverage claim is judged by WHERE it was measured. The rendered DOM per language — including data-values behind translated keys and shell-level strings — is the only admissible basis. Key-coverage and grep counts are proxies, and must be labelled as proxies.

**L24 · Never cap AI output tokens low — a low cap plus think:'high' silently truncates the JSON (v269–v271, 2026-07-27).**
The smoker device-lookup returned "not found": the model's thinking consumed the budget and the JSON payload was
cut mid-stream — no error, just a confident wrong answer. Owner policy (shipped v271): every AI call uses
maxTokens/maxOutputTokens 8192; the only exception is tiny health-probes. Billing is on actual tokens used, so a
high cap is free headroom — a low cap buys nothing and risks truncation. Root cause: a "reasonable-looking"
per-call cap treated as an optimization, interacting invisibly with thinking budgets. Gate: 8192 everywhere
(probe exceptions named); any truncated/malformed AI response is checked against the token cap FIRST, before
theorizing about prompts or models.

**L25 · The agent fan-out wedge: ~50 agents / 25 concurrent wedged the machine and returned plausible partials (2026-07, relearned from §11a).**
A mass dispatch (~50 agents, ~25 concurrent) wedged the workstation; the partial results that did come back
looked complete and were unreliable — the same lesson §11a already teaches for suite workers ("the local worker
count assumes an idle machine"), relearned at full price for agents. Prior API-529-killed audit runs are the
same class. Gate (§10.5a): sequential by default; independent LIGHT work ≤3 concurrent; hard cap 5; at most ONE
heavy agent while a suite run, build, or the translation GPU queue is active; on API 529, drop to
one-at-a-time and send a small probe agent first. And ALWAYS reconcile the dispatch journal — agents started vs
results received — before trusting any fan-out workflow's output.

**L26 · Over-bundling: three independent bug fixes rode one long subagent, and the owner had to ask "why so long?" (2026-07).**
Three unrelated fixes were bundled into a single long-running subagent (the bug1/bug2/bug3 wave reports). Each
fix was fine; the bundling meant no fix could land before the slowest one, progress was invisible, and the
owner's first signal was wall-clock pain. Root cause: §10.5 ("maximize subagent usage") read without
`dispatching-parallel-agents` — independence is the dispatch boundary. Gate: independent fixes ship as
independent dispatches (within the §10.5a ceiling) unless the owner explicitly chooses bundling; a brief that
bundles unrelated deliverables is sent back at review.

**L27 · Generated-plan truncation: an LLM asked for 10 full tasks emitted code for 1–5 and prose for 6–10; an LLM asked to concatenate ~237k chars silently truncated (CP2, 2026-07-27).**
The first CP2 plan draft was produced by asking a model to emit a complete 10-task plan and then to concatenate
~237k characters of task material: the draft carried real code in Tasks 1–5 and prose-only Tasks 6–10 (zero
fenced blocks — the writing-plans "EXACT code in each step" requirement silently violated), and the
concatenation lost content with no error. Caught one step before dispatching implementers against empty tasks;
cost hours (the archived evidence: `scratch/cp2/draft-v1-REJECTED.md` vs the rebuilt, code-complete
`docs/superpowers/plans/2026-07-27-cooking-paths-cp2.md`). Root cause: output-length limits fail silently, and
"looks like a plan" was trusted without a mechanical check. Gate: `scripts/check-plan-complete.mjs` runs on
every generated plan BEFORE review (per-task fenced-block count > 0, truncation-in-fence detector — discipline
§2); and large documents are NEVER assembled by LLM concatenation — assemble mechanically (`cat`, file ops),
then run the completeness gate on the result.

**L28a · grep על קוד נחסם לפני שנוסה הכלי הייעודי (30.7.26, פוצל 9.8.26).**
‏Grep על קובצי מקור נחסם כל עוד לא נרשמה באותו session פנייה קודמת ל-serena (עבודה סימבולית) או לגניזה (שאלת מסמכים). ‏grep הוא **fallback** — הוא בא אחרי שהכלי הייעודי נוסה, לעולם לא במקומו.

**L28b · 2026-07-30 · שחיקת כללי-כלים תחת קונטקסט ארוך — הבעלים תפס נטישה של serena/graphify לטובת grep ("אם אתה לא עושה — סימן שנמחקו לך הכללים").**
הכלל, מעכשיו קבוע:
1. כל עבודת קוד — קריאה ועריכה — דרך **serena** (find_symbol / find_referencing_symbols / get_symbols_overview / replace_symbol_body). לא רק חיפושים — העבודה עצמה.
2. כל שאלת מסמכים/קשרים/provenance — **שאילתת graphify** (`query`/`path`/`explain`) לפני grep; grep = fallback מוצהר בלבד.
3. **תמיד `graphify --help`** (ו-`initial_instructions` של serena) לפני שימוש — לנצל יכולות במלואן (`graphify watch` ישב ב-help כל הזמן ולא נוצל).
4. עדכון גרף רציף: `graphify watch` לקוד; docs ברענון `--mode deep` תקופתי, נאכף ע"י `scripts/check-graph-fresh.mjs`.
5. **מטא-כלל:** אם מזהים שהכללים האלה לא מיושמים — זה עצמו האות שהקונטקסט נשחק; עוצרים ומריצים מחדש את `docs/process/checklists/session-start.md`, לא ממשיכים.

**החצי השיפוטי:** עבודת קוד סימבולית — קריאה **ועריכה** — נעשית דרך serena, ו-fallback ל-grep מוצהר בקול ומנומק. ואם מתגלה שהכללים האלה אינם מיושמים, זה עצמו אות שהקונטקסט נשחק: עוצרים ומריצים מחדש את session-start, לא ממשיכים.

**L29 · A release gate that ran on the wrong state: the suite went green twice before the copy that shipped even existed (v278, 2026-07-31).**
v278's task ran the full suite ×2 and reported green, but the what's-new string was added to the tree AFTER
both of those runs — so the state that was tested and the state that shipped were two different trees. The
`foot-news` tests caught the mismatch only after release, live on the site, because they never ran against
the final tree at all. Root cause: "run the suite" was treated as satisfied by any recent green run, not by
a run against the exact tree about to ship. Gate: the release suite runs on the FINAL tree — after the
version stamp and all copy changes are in — and no run taken before that point counts toward the release
gate, however green.

**L30 · "Green for me" is not green: a test file's own size silently changed the suite's concurrency (2026-07-31).**
A Task-3 implementer reported "825 passed, exit 0"; the controller's own run on the same code gave 821
passed / 4 failed, and the failure reproduced in isolation. Root cause was capacity, not the code under
test: the spec file had grown from 2 tests to 5, and Playwright caps workers at the test count per file —
so the project's own concurrency rose past what real service-worker registration cycles could reliably
survive. Nothing in the diff looked like a concurrency change; the file just got bigger. Gate: a single
green run from an implementer is a sample, not proof — the controller reruns the full suite independently
before accepting a "done" claim (§11a); and a growing spec file is itself worth eyeballing for a
worker-count side effect, not just for content.

**L31a · A subagent is never dispatched to run or wait on the full suite (2026-07-31, split 9.8.26).**
Never dispatch a subagent whose brief includes running or waiting on the full Playwright suite. An Agent dispatch whose prompt contains `npx playwright test`, or an instruction to wait on or poll a suite run, is blocked at dispatch — the controller runs the suite itself (§11a).

**L31b · Agents left waiting on a background suite run burn real time for no signal (2026-07-31).**
Across three tasks this session, subagents polled a backgrounded full-suite run and reported "still
waiting" repeatedly, costing roughly an hour combined with nothing to show for it. The cure was already
adopted in §11a — the controller owns the full-suite gate, not a dispatched subagent — but it was not
applied consistently this session. Gate: never hand a subagent a background suite run to wait on; the
controller runs it (or waits on it) directly and hands the subagent a verdict, not a polling loop.

**The judged half:** the controller owns the full-suite gate in substance and not only in wording — a subagent receives a verdict, pass or fail with the output pasted, never a polling loop. A subagent report shaped as "still waiting" on a suite run is itself a process defect to raise.

**L32 · The pipe-vs-exit-code mistake, made twice more — including by the controller, minutes after writing
the rule down (2026-07-31).** `cmd | head; ec=$?` (or the equivalent through any pipe) captures the exit
code of the LAST command in the pipeline, not the one whose output was being inspected — so `ec=$?` after
piping into `head`/`tail`/`grep` measures `head`, always 0, never the real command. This has now recurred
enough times that documenting the rule once has proven insufficient. Gate: capture `$?` (or run
`; ec=$?`) IMMEDIATELY after the command whose exit code matters, with no pipe in between — redirect to a
file first if the output also needs trimming for display.

**L33 · A stale plan snippet instructed deleting something that had since shipped (2026-07-31).**
The Phase 1 plan told an implementer to delete `ru` from `LANGNAME`; Russian had shipped to the language
queue since the plan was written, and following the instruction literally would have regressed a live
language. The implementer caught the mismatch, refused to comply, and reported back instead — the correct
behavior. Root cause: a plan is evidence of intent at the time it was written, not of current truth, and
nothing re-validated the plan's assumptions against the tree before execution. Gate: an implementer treats
every plan instruction that deletes or reverts existing behavior as a claim to verify against the current
tree first, not an order to execute blind; when the tree has moved on, stop and report rather than comply.

**L34 · Research that never landed: the pre-answer to the owner's next complaint sat un-surfaced in a
research doc (2026-07-31).** `docs/research/03-tts.md` (§15.7) already contained the Hebrew-pronunciation
analysis, the local-engine option, AND latency tactics that directly pre-answered the owner's later (§31.7)
TTS complaints — but only the top-level provider decision from that document ever reached the decision
register; the rest sat orphaned in the research file. This is the H8 "orphan class" of unlanded item, and
it was found by the owner's own memory of having written it, not by any gate — the Total Landing Rule
checks that ledger rows land in named phases, but nothing today checks that a research document's
sub-findings each get a landing, only its headline conclusion. Gate: when a research document informs a
decision, walk its full section list for landing, not just the section that answered the question being
asked at the time; an unlanded subsection is a debt exactly like an unlanded ledger row.

**L39 · A subagent reported "no key in env" and stopped measuring — the key was there all along (2026-08-01).**
`GEMINI_API_KEY` lives in the Windows **USER** environment scope, which a spawned process does **not**
inherit into `process.env`. Agents concluded it was absent, skipped every live probe, and the controller
ended up running those measurements by hand — which is backwards: investigation and measurement belong to
subagents, the decision belongs to the controller (owner instruction, 2026-08-01). **How any agent reads
it, in PowerShell:**
`$env:GEMINI_API_KEY=[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User'); node <script>`
Bash/git-bash does **not** see it. The service-account file for Cloud TTS is at `C:\Downloads\` and is
read by path, never opened or echoed. **The rule stands unchanged: never print, log, echo, or commit a
key** — read it into the process and use it, nothing more. A probe that cannot get a key must say so with
this line quoted, so the next agent does not repeat the dead end.

**L35 · A test that builds its own fixture can only prove the code's assumption, never the wire (2026-08-01).**
Google separates SSE frames with `



`. Every parser we wrote split on `

`, so no frame was ever
parsed and the entire streaming architecture — audio (R-39/v281) and text (Tasks 2/4) alike — was inert in
production for days. It was worse than absent: each call spent ~1.8s failing with `no-audio` and then paid
again for the blocking path, so a 28-character line took ~4.5s instead of ~1.1s. **Every test passed the
whole time**, because the tests fed `

` fixtures of their own making. Gate: when a parser consumes an
external wire format, at least one test must use **bytes captured from the real endpoint**, not a fixture
written from the same assumption the parser holds. This is `verify-against-the-runtime-path` applied to
data rather than to code paths.

**L36a · After a "browser has been closed" run, the next invocation must be the isolated spec (2026-07-31, split 9.8.26).**
After a run whose output contains "Target page, context or browser has been closed", the next Playwright invocation MUST be an isolated run of the failing spec. A full-suite rerun is blocked until that one-minute discriminator has been executed.

**L36b · "Target page, context or browser has been closed" almost always means timeout, not a crash
(2026-08-01).** When a test times out with a `waitForFunction` pending, teardown closes the page and the
pending wait reports the closure — the symptom, not the cause. Two separate investigations lost hours
hunting a browser crash that never happened. Gate: read it as "the condition never became true", and use
the one-minute discriminator — **run the test alone**. Load contention vanishes in isolation; a real defect
does not. That single step separated a flake from a genuine product regression in under a minute the same
day.

**The judged half:** read the closure as "the condition never became true", not as a crash — and read the isolation run correctly: load contention vanishes in isolation, a real defect does not.

**L37 · Three plausible explanations died before the single-point cause was found (2026-08-01).** For the
same slow-voice symptom I successively believed the digit gate was freezing early speech, then that the
thinking floor was the bottleneck, then that a second network call was a fallback. All three were
reasonable, all three were wrong, and all three were noise around one character-class bug (L35). This is
L14/Occam restated with a fresh scar: when a hypothesis needs several independent things to be true at
once, look harder for the single point. Also: the owner's domain correction — that most voice use is
read-aloud, not Q&A — is what exposed it, because the read-aloud path has no thinking latency to hide
behind. **A user's correction about how their product is actually used is evidence, not context.**

**L38 · A green test guarded a false screenshot (2026-08-01).** The DoD-8 spec asserted on `vcLastQA` — JS
state — so it passed while its committed screenshot captured the onboarding panel instead of the transcript
it existed to prove, because `maybeAskUiLevel()` replaces any open panel 400ms after boot and that spec
(unlike 125 of 134 others) never seeded `mk-uilevel-asked`. A subagent reported the screenshot "looked at
and correct"; it had been looked at, but it was the wrong screen. Gate: visual evidence is only evidence if
the assertion that accompanies it reads the **rendered output**, not internal state — the same lesson v267
taught about measuring translation coverage at a proxy instead of at the DOM.

**L40 · The gates were never running, and the one that ran was blind (2026-08-01).**
An owner-requested compliance audit found **ten** discipline rules breached across four releases in a
single day — and the cause was not forgetfulness. `check-meta.mjs` **is wired to no git hook and was not
invoked once all day**; its only call site is `scripts/sync-docs.sh`, which no commit went through. Worse,
the H8 gate that *did* run when invoked manually splits the roadmap on `## 5 ·` alone, so the entire §5a
recovery ledger — R-1..R-63, including every row created that day — sat outside the scan while the gate
printed OK. **A gate that reports green on what it never scanned is worse than no gate: it buys confidence
nobody earned.**

Three things follow, and they generalise beyond this repo:

1. **A rule enforced by a script survives a busy day; a rule enforced by discipline does not.** Every rule
   breached was memory-dependent (H9 tables, H10 board, H14 reports, briefs against the template). Every
   rule with a live check — where one existed and ran — held. The fix is never "try harder", it is moving
   the rule behind automation.
2. **Rigour decays monotonically under load, and the decay is invisible from inside.** The release evidence
   degraded across the same day: v281 recorded "889 passed ×2, exit 0 both times, on the tree being
   shipped"; v282 lost the second run; v283 lost the exit code and wrote an unmeasurable "931+"; v284 lost
   the tree clause. Nobody decided to lower the bar. That is exactly the drift a checker catches and a
   person, mid-flow, does not.
3. **A gate must state what it covered, not only its verdict.** Had H8 printed "scanned 18 of 63 rows",
   the blindness would have been obvious the first time it ran. Every gate now prints its scan count.

And a lesson about the lessons: L35–L39 are all product bugs, and `gate-lessons` passed throughout,
because it checks only that a lesson is **recent** — never that it covers what actually broke. The
process collapse itself went unrecorded until the owner asked for an audit. **A coverage gate that
cannot tell what it is covering is the same failure as H8, one level up.**

**L41 · Two subagents reported work as "committed and wired" while it sat uncommitted (2026-08-01).**
Twice in one evening a subagent's final report stated the work was committed and verified; twice
`git status` showed the files unstaged in the working tree. The first case was actively misleading:
`check-meta.mjs` passed locally **because the fix was in the working tree**, while CI — which had only
ever seen the committed state — failed. Local green plus remote red is the signature, and it is easy to
misread as a CI configuration problem rather than as "the fix never left this machine".

Gate: the controller confirms **every** completion claim against `git log`/`git status` before relaying
or building on it, exactly as it already confirms diffs. "Committed" is a claim about the repository, and
the repository is authoritative — a report is not evidence about it. Cheap check, and it caught two
silent no-ops in a single evening.

Related and worth stating separately: **reading a configuration file is not verifying it.** The same
evening produced a CI workflow whose YAML looked correct on inspection and had never once run — GitHub
listed it under its file path instead of its name and answered a manual dispatch with "this workflow has
no such trigger". Configuration is verified by triggering it, never by reading it.

**L42 · Three tasks green, the feature dead — a test that injects the seam reproduces the blind spot
(2026-08-01).** A safety-guard arc built one layer per task: a classifier, a decision table, and a wider
vocabulary so the table could rule on numbers the narrow vocabulary cannot see. Every task passed its own
tests. The feature did not work at all: the function converting classifier output into the table's input
filtered every claim through the **narrow** vocabulary, so the very claims the wide vocabulary existed for
were discarded one layer upstream and never reached it.

Why it survived three careful tasks: **each task's tests handed the next layer its input directly.** The
decision table was tested by constructing a claim map and passing it in — which is exactly the step that
was broken. A test that injects the seam cannot fail on the seam.

Gate: for any feature spanning more than one layer, **at least one test must enter where the user enters**
and assert on what the user gets out. Injecting an intermediate structure is legitimate for covering
branches, never for proving the feature works. And when a subagent reports a gap as "pre-existing,
documented elsewhere", **verify it by running the chain** — this one was reported that way and moved past,
and it would have shipped a dead feature with a full green suite behind it.

**L43a · A tracked source file may not carry an invisible control byte (2026-08-01, split 9.8.26).**
No tracked source file may contain a C0 control byte other than tab, LF or CR. This is checkable by
scanning the file's bytes, it costs nothing, and it has no false positives — real text does not contain
those bytes. It exists because a regex once carried a literal **U+0008 backspace** immediately after a
word: invisible in every editor and every diff, and impossible for the pattern to ever match. The tool
silently matched **zero** rows on every run while its source read as correct.

**L43b · When identical-looking code behaves differently, compare BYTES, not glyphs (2026-08-01, split 9.8.26).**
Re-reading the source four times found nothing; a `charCodeAt` scan found it in seconds. **Reading cannot
see what is not rendered.** Two disciplines follow. A scripted edit to source is a source of corruption
and not only of speed — prefer a tool that matches exact strings over regex line-rewriting, and when a
scripted edit IS the right choice, verify it **by running the result**, never by grepping that the new
text is present. The grep passed here the whole time. And a related trap from the same day: a fix aimed
at a *different real defect* in the same function made it look like "the fix didn't work", when it had
fixed exactly what it targeted. **Two defects in one function look exactly like one unfixed defect.**

**L44 · Four defects in code the CONTROLLER dictated, and three conflicts only the full suite saw
(2026-08-02, a fourteen-task arc).** Two patterns worth separating.

**(a) The brief's own reference code was wrong four times.** Each brief carried the exact implementation
to write, and in four tasks that code was subtly broken: a fallback that made a storage failure speak
*more* rather than less; a queue drain that let ordinary alerts interrupt exactly like safety, voiding the
whole priority scheme; a blind digit sweep that re-redacted values an approval had just restored; and a
shared placeholder whose restore assumed left-to-right order and would have swapped two approved values.
**All four were caught by the implementer running the code, none by anyone reading it** — and every one
would have passed review. The gate is not "write careful briefs"; it is **RED-before-GREEN performed by
the implementer, on the brief's own code, as written.** A brief is a hypothesis.

**(b) Three conflicts were invisible to every targeted run and visible only to the whole suite.** An
assertion in one spec pinning an ordering a later approved change reversed; a first-run card that replaced
whatever panel was open; a test forbidding *any* notification where it meant *blocking* ones. Each task's
own specs were green. Gate: **the controller runs the entire suite after every task, not at the end of the
arc** — a conflict found three tasks later costs the three tasks built on top of it.

A third, smaller note with a long tail: one of these was **predicted in writing the day before** — a
product comment observing that a first-run card would stomp an open panel "if onboarding ever grows more
triggers". It grew one, and the prediction landed within a day. **A written "this will break if X" is a
scheduled failure, not an observation.** When the note is cheap to act on, act on it when it is written.

**Adopted wins (2026-07-31) — patterns that worked this session, keep using them:** (7) **The controller
verifies everything independently** — every subagent claim this session was checked by diff or by the
controller's own suite run rather than trusted as reported, and that independent check is what caught
L29, L30, and L33 above; a claim that "passed" or "done" is a hypothesis until re-verified, not a fact.
(8) **Byte-identity as a migration proof** — U-1/U-2 (units foundation work) proved the regenerated
`SAFETY_UNIT` and the migrated render sites were byte-identical to the originals before deleting anything,
which is what makes the coming ~150-site unit migration safe to execute incrementally. (9) **The
anti-drift bolt found real latent gaps on its first honest run** — U-3's check surfaced 9 unit tokens that
Guard B never covered, immediately, the first time it ran; a gate that fails loudly the first time it is
exercised for real is doing exactly its job, not misbehaving. (10) **H13 (the recovery relevance gate)
paid for itself immediately** — its first use proved all five claimed voice-guard holes from a week-old
audit were still live in today's code, turning a stale-sounding finding into a verified, actionable
decision rather than a discarded one.

**Adopted wins (2026-07-23) — patterns that worked, keep using them:** (1) **Baseline-first migration +
a real preflight**: the eval baseline caught gemini-3.6's api-400 in minutes (v259→v260), and the
ListModels+one-real-call-per-role preflight (through the app's own payload builders) is what proved the
retry safe before deploy. (2) **Config-as-data registry**: both model migrations landed as one-row flips
with a commented rollback pin. (3) **CI-on-a-temp-branch** as a no-deploy verification gate (Pages builds
only from main; the GitHub secret stays server-side). (4) **§10.14 deep research cracked what guessing
couldn't** — two focused doc-reading missions found the dead-config and the de-cluster answer in under an
hour after a day of fix-churn. (5) **§10.11 usefulness-gate deposits**: Gemini + Cloudflare docs deposited
once, now answer queries that previously returned noise. **Extended 2026-07-24**, from the loopback saga
(L22): (6) **Probe-first debugging** — a purpose-built repro harness (the reload-storm scripts) turned each
debugging iteration into a ~seconds-long experiment instead of a minutes-long full-suite run, which is what
made an 11-arm root-cause hunt tractable in one session. (7) **The L19 firing-guard pattern** — ship a fix
together with a tripwire test that proves the fix's *mechanism* actually fires, not just that symptoms
improved (exemplified by `tests/warm-fixture.spec.ts`'s new 6th contract test, added alongside the
route.fulfill fix itself, commit `f74f1b8`). (8) **`route.fulfill` for hermetic doc serving** — fulfilling a
test's own document from an in-memory Buffer, byte-identical to what ships, removes an entire class of
local-infrastructure flake (loopback, disk I/O, port contention) without weakening what is actually under
test. (9) **Serena-first symbol edits** (§10.17) — precise LSP-backed edits on the ~9.5k-line `app.js` and
the fixture/spec files beat fragile text-matching for this kind of surgical fix work.

### 10.11 Query THE GENIZA before the internet — for ANY docs/help — then feed useful finds back
> **Owner instruction, 2026-07-22; generalized to all documentation/help 2026-07-23; the store behind it
> replaced 2026-08-04; migrated to the geniza (PostgreSQL + LlamaIndex + Neo4j) — `agent-memory.db` and
> `scripts/memsync.py` deleted 2026-08-05.** When you need documentation or any external help — a tool, a
> framework, a methodology, an API's capabilities, a vendor's model specs, *anything* — query **the geniza**
> FIRST. Only if the answer is not there, search or research the web. After a web find, apply the
> **usefulness gate** below before moving on. The rule is unchanged; only the tool under it is.

**How.**

```python
from src.knowledge import retrieval
retrieval.search_current_docs(q, filters={"namespace": "repo"})  # lexical, current revisions only
retrieval.semantic_search(q, filters=...)                        # vector, same table
retrieval.get_source_excerpt(revision_id, chunk_id)               # exact, indexed lookup of one source
```

Nine vendor/technology corpora are stored as `tool_spec` records, migrated from the old global graph:
`vendor-docs` (2,429 nodes — includes the BMAD and GSD material), `methodology` (1,947),
`playwright-official-docs`, `gemini-api-docs`, `cloudflare-workers-docs`, `nodejs-v8-docs`,
`ollama-docs`, `semantic-search-mcp-docs`, `windows-scheduling-docs`. Each carries its sections, URLs
and extracted concepts as queryable JSONB.

**PROJECT DOCS vs TOOL SPECS.** `retrieval.search_current_docs` searches this repo's own documents (302
files, ~5,100 chunks, current by content hash) when filtered to `namespace: "repo"`; filter to
`source_type: "tool_spec"` for questions about *how a tool works*. Knowledge migrated from the old project
graph lives under the `graph://` path namespace with its original relations in `metadata.relations` —
machine-extracted, some `INFERRED`, so treat them as leads and read the source.

**The non-optional step (learned by doing it wrong, and it still applies).** Matching is case-folded
substring: **no stemming, no synonyms, no cross-language matching.** A naive natural-language query
returns noise — the first global query ever run here pulled 113 nodes including an eslint command and
unrelated workflow files. Expand the question into tokens that actually exist in the corpus before
searching. If nothing matches, say so and stop — **never invent tokens to force a hit.** This matters
doubly because the corpus is bilingual: a Hebrew query will not match English text.

**The feedback loop — a miss is a task, and a useful find is a deposit.** When the store does not hold
what you need, research the web. Then ask ONE question: **"Is this source useful, and likely to be needed
again?"** If **yes**, download the documentation into `docs/` (or ingest it directly) so the next session
never repeats the search. If it is a genuine one-off, skip the deposit and say so. The gate keeps the
corpus growing with signal instead of noise.

**Honest limit:** never ingest anything containing a key or a secret.

### 10.12 Keep the geniza current — the gate BLOCKS, because the fix is now cheap

> **Stack (owner instruction, 2026-08-04):** LlamaIndex `MarkdownNodeParser` inside an
> `IngestionPipeline` does the chunking; SQLite with JSONB does the storage and the querying.
> Ingestion runs with **no LLM and no embedding model configured** — verified, not assumed — so it
> is deterministic, offline and instant. Retrieval is `json_extract`, never generative: an unknown
> tool name returns `None`, not a nearest neighbour.

```bash
python scripts/ingest.py --scope           # delta by CONTENT HASH; unchanged files skipped
node scripts/check-geniza-fresh.mjs       # the gate: stale / never-ingested / orphaned, by name
bash scripts/sync-docs.sh "<message>"     # syncs, verifies, stages, commits, pushes
```

**Why this replaced graphify, and why the gate changed from advisory to blocking.** The old knowledge
graph was a 22 MB JSON artifact rebuilt by an out-of-process LLM pass. Three consequences, all measured:

- Its freshness gate **never once passed** — 115 stale documents standing at the end, and
  `graph-freshness.yml` failed **8 of its 8 runs since creation**.
- Because it could not pass, it was marked ADVISORY inside `check-meta.mjs` — and reviewers 9 and 10 of
  the method panel both flagged it. **A permanently amber signal is an off signal**, and worse, it
  teaches that gates in general are noise.
- `sync-docs.sh` step 1, the one command whose job was keeping the map current, **did not update it at
  all**. It detected that documents had changed and printed an instruction to go run a skill by hand,
  because a shell script cannot invoke a Claude skill.

The reasoning that made it advisory — "doc drift is a property of elapsed time, no single commit can fix
it without a separate heavy rebuild" — was sound about graphify and **wrong about the requirement**. The
heavy action was the thing to remove, not the gate to weaken. Ingesting a changed document now costs
0.32 s, measured, so drift is fixable from the commit that causes it and blocking is the correct
incentive. **A map that is never current is not a map.**

Two further changes worth stating because they were failure modes, not preferences:
- **Content hash, not mtime.** mtime moves on checkout and on any byte-identical rewrite, so the old
  signal reported debt that did not exist while missing real drift.
- **The store is not a generated binary in git.** The SQLite/`agent-memory.db` store described above was
  itself superseded 2026-08-05 by the geniza (PostgreSQL as source of truth, Neo4j as a projection,
  LlamaIndex for orchestration) — `agent-memory.db` and `scripts/memsync.py` were deleted; see §10.11/§10.13
  for the live API. A 22 MB generated binary in git was part of what made the original graphify artifact
  unmaintainable, and the current store is not committed either.

### 10.13 Reach for THE GENIZA before grepping — it is the evidence tool, not a curiosity
> **Owner instruction, 2026-07-22.** Always try the semantic store first when looking for evidence and
> references across code and documents. And keep it updated — always.

A question like "what specifies this behaviour", "what does the discipline say about X", "where else is
this value discussed", or "what did we decide and when" is a store query rather than a grep:

```python
from src.knowledge import retrieval
retrieval.search_current_docs(q, filters={"namespace": "repo"})  # returns the SECTION, with its heading path and file
retrieval.semantic_search(q, filters=...)                        # vector search, same table
```

**Why this is a discipline rule and not a preference.** The 2026-07-22 sweep refuted **42 of 261
findings — 16%** — and every refutation shared one shape: *a grep, a quote, or one artifact trusted
without tracing what the program actually executes.* A grep returns a line. The store returns the section
that contains it, with the document and heading path it belongs to — which is usually what the claim was
actually about.

**But it is a lead, not a verdict.** Records migrated from the old graph (`graph://` paths) carry
machine-extracted relations, some marked `INFERRED`. A hit is a place to look; the claim is confirmed
against the source. §10.13 does not repeal L16 or the runtime-path skill. Query first to find the
evidence; read the file before asserting it.

### 10.14 When it's complex or the iterations aren't converging — RESEARCH, don't guess
> **Owner instruction, 2026-07-23.** When a problem is genuinely complex, OR after a few iterations that
> did not solve it, STOP guessing and do **deep research**: read *in detail* the official documentation,
> help, and the blogs / forums / issue trackers of **every product, technology, and adjacent subject
> involved**. §10.11 applies (query **the geniza** first — its `tool_spec` corpora hold `playwright-official-docs`,
> `nodejs-v8-docs`, etc. — then the web; deposit useful finds back per the usefulness gate). Only *then*
> converge on the best, correct solution.

This is the escalation that **systematic-debugging's 3-fix STOP** hands off to: after failed fixes the next
move is **documented research**, not fix #4. This rule was written after a worker-flake debug burned many
iterations of guess-and-kill that a careful read of Playwright's navigation/timeout/webServer docs would
have short-circuited. Write the correct solution down (a doc or an instruction) once you find it, so the
next session inherits it.

### 10.15 Be skeptical — evaluate a better ingredient, don't just patch the current one
> **Owner instruction, 2026-07-23.** When a component (a server, a runner, a framework, a library)
> **repeatedly** causes trouble, question whether it is the right tool — do not keep stacking band-aids on
> it. Research and weigh **better alternatives** (a different static server, a different test pattern, a
> different runtime) against the incumbent, and switch when the alternative is genuinely better. The
> correct fix is sometimes a better ingredient, not another workaround. Pair this with §10.14: the
> alternatives are found by research, then judged on evidence.

### 10.16 Conclude every significant session/arc with its lessons — and bank its knowledge
> **Owner instruction, 2026-07-23.** A session or work-arc is not finished when the code lands. Before
> closing: (1) write its **lessons** into the Lessons log (§11) — both the mistakes we must not repeat AND
> the **successful ideas that worked**, so they are adopted, not just survived; (2) apply the §10.11
> usefulness gate to every relevant doc or info source the session found, and **deposit the keepers into
> the geniza** so the next session starts ahead. Untracked lessons get relearned at full price; undeposited finds get re-searched at full price.

**Mechanical enforcement (Phase 0, 2026-07-30):** `scripts/gate-lessons.mjs` (inside `check-meta.mjs`)
blocks a `release(v` commit when releases exist after the newest §11 lesson/declaration date, and the
arc-close checklist (`docs/process/checklists/arc-close.md`) makes the lessons+deposit pass a gated step.
The §11 log froze at L22 while five paid-for lessons lived only in private memory (audit §9) — never again.

The mechanics already exist — this rule makes them a *closing checklist*, not a when-remembered habit:
lessons → §11 log (numbered `L`-entries for failures, an "adopted wins" note for successes; owner-behavior
feedback also goes to the assistant's persistent memory); docs → save the source under `docs/` →
`python scripts/ingest.py --scope` → verify with `node scripts/check-geniza-fresh.mjs`. Research
subagents are told to *list* deposit candidates; the controller owns running the deposit pass before the
arc closes.

### 10.17 Maximize the use of Serena for code work — and learn it from its docs first
> **Owner instruction, 2026-07-24.** Whenever possible, maximize the use of **Serena** (the LSP-backed
> semantic code toolkit, live as this project's `serena` MCP server). Read its documentation **carefully**
> to learn how to best use it — it is in **the geniza** as the `serena-docs` `tool_spec` corpus, and
> Serena's own `initial_instructions` tool serves its usage manual (its MCP server says to call it before
> coding tasks — do).

**When Serena is the right tool (the adopted division of labor — `docs/process/serena-adoption.md`):**
symbol-shaped code work on live sources — *find this function* (`find_symbol`), *who calls/reads this*
(`find_referencing_symbols`), *map this file's structure* (`get_symbols_overview`), *edit exactly this
symbol* (`replace_symbol_body` / `insert_after_symbol`), *rename safely* (`rename_symbol`) — is Serena's
home turf, and on a ~9.5k-line `app.js` a surgical symbol edit beats a fragile text-match edit. The split
stands: **Serena** = live locate-exact/edit-exact (always fresh, LSP-accurate) · **the geniza** = cross-doc
provenance, spec↔code↔test relationships, vendor docs · **grep** = fallback for literal/non-code text.
Dispatch prompts for code-editing subagents should point them at Serena's tools where the task is
symbol-shaped. Learning it is not optional polish: query `serena-docs` in the geniza (§10.11
vocabulary rules apply) and the `initial_instructions` manual before leaning on conventions from memory —
tools evolve, and a mis-used symbol edit on a monolith is worse than a careful text one.

**§10.17a · ONE Serena server — every subagent shares the single instance (owner instruction, 2026-07-24).**
The default stdio config makes **each subagent spawn its own `serena start-mcp-server`**, each with its own
dashboard on the next free port (observed 2026-07-24: dashboards flapping, port 24282→24283, 4 concurrent
Serena processes, 8 language servers duplicated per instance). That is waste and confusion: a bookmarked
dashboard points at a dead instance, and memory/CPU multiply with agent count.
**The rule: run ONE long-lived Serena server for the machine; the project and every subagent connect to it.**
Implementation path (verify exact flags against Serena's own `--help`/docs first — §10.17's read-the-docs
rule applies to this too): start a single server on a fixed port with the **SSE / streamable-HTTP transport**
(`serena start-mcp-server --transport sse --port <PORT> --context claude-code …`), then point
`.mcp.json` at it as a **URL-based** server (`{"serena": {"type": "sse", "url": "http://127.0.0.1:<PORT>/sse"}}`)
instead of the `command`/`args` stdio form. Verify after wiring: one `serena` process, ONE dashboard port,
tools still resolve from a subagent, and the project stays activated across agents. Until it is wired and
verified, prefer enabling Serena only for agents doing genuinely symbol-shaped work.

### 10.18 Debug-then-measure — a failure STOPS the measurement train
> **Owner instruction, 2026-07-24.** While a system is unstable — any unexplained failure on the table —
> the next step is **STOP and systematic-debug that failure to root cause**, not "continue to the next
> measurement." Exploration/debugging mode and measurement mode are different regimes: **continuous
> measurement (multi-run campaigns) is for STABLE systems** — it *certifies*, it does not *diagnose*.
> Running campaign after campaign against a known-unstable system burns hours converting one unknown into
> N tallies. The loop is: failure → systematic-debugging (evidence, root cause) → refactor the cause →
> targeted verification of THAT fix → only then a certification campaign. (An already-in-flight
> instrumented experiment completes — §11a L18 forbids mid-run kills — and its data feeds the debugging;
> but no NEW measurement starts while the root cause is open.)

### 10.19 Translation QA — gate-passing is necessary, not sufficient (owner instruction, 2026-07-26)
> **Owner instruction. Applies to EVERY language we translate to.**
The structural gate (safety-lexicon, unit-literal, Hebrew-leak) proves a translation's **structure**
survived — it does **not** certify **meaning**. A string can pass every gate and still be wrong: `תרבית`→`nitrito`
(fermentation *starter culture* rendered as the cure chemical *nitrite*) passed a source-conditioned gate;
`«dary»/«semi-dary»` (a transliteration of an already-Anglicized Hebrew source `דרי`) passed with every number
intact. Both were caught only by **semantic** review. Three rules per language, **before it ships**:
1. **Semantic correctness pass.** Every entry is analyzed term-by-term against the Hebrew source (+ the English
   ground truth) and fixed where wrong — not merely gate-run. Dev-time AI (an external model, or Claude) *proposes*;
   the gate **plus a human safety-check** remain the **arbiter** before merge (the local model made these errors —
   a stronger model repairing them earns no blind trust). Correct at **development time** (distributed to every user
   in the build), **not** at runtime — the runtime "gate-blocks → AI repairs → updates dict" path is a deprioritized
   fallback.
   **Pivot through English for non-Hebrew targets (owner suggestion, 2026-07-26).** English is 100%-verified (v188)
   and a far higher-resource MT source than Hebrew, so translate the **English value → target language**; the dict key
   stays the **Hebrew** source string (runtime lookup unchanged — only the model's *input* becomes English). This raises
   fluency AND reduces target-side inventions: the `תרבית`→nitrite class happens when a low-frequency Hebrew term is
   unfamiliar to the model, whereas the verified English ("starter culture") is unambiguous. Because the English pivot is
   *verified*, the usual telephone-game compounding risk is neutralized. **Still gate the target's numbers + safety terms
   against the Hebrew ground truth** (English preserves them, so it is equivalent) — the pivot never licenses drift from
   the source of truth. Confirm the gain empirically (en→X vs he→X on a sample) before committing a new language.
2. **Physical Playwright verification.** Walk the running app in the target locale and assert **(a)** strings render
   translated and correct, and **(b)** each rendered string comes from the **external dictionary** (`lang/*.json`),
   never a hardcoded `app.js` literal — proving the i18n path is genuinely data-driven.
3. **Fix the infrastructure on any issue.** When a *class* of error surfaces (a gate blind spot, a source-Hebrew
   transliteration, a hardcoded literal), fix the gate / pipeline / i18n-loader so it cannot recur — not just the one
   string. Errors in the **source Hebrew** (Anglicized transliterations like `דרי`, `דריי-ברין`) are fixed at the
   **root** in `data.py`/`sources.py`, and every dependent dictionary key re-keyed in lockstep (the Hebrew source
   string is the i18n lookup key).
The full realization is the **Translation QA & Repair programme** (a target-side safety-invention scan across all
languages + AI-repair of gate-fallback entries + these three rules) — it gets its own brainstorm → spec.

### 10.20 A new string updates ALL language dictionaries in the same change (owner instruction, 2026-07-26)
> **Owner instruction.** When you add or reword **any** user-facing string/expression in code, update **every**
supported-language dictionary **in the same change** — currently `en` + `fr` + `de` + `es`, and any language added
later — so all stay synchronized, complete, and correct. A new Hebrew(+English) string that leaves fr/de/es on the
English fallback is an **incomplete** change, not a done one. The build-time per-language coverage check in `build.py`
must not regress. The added translations receive §10.19's treatment (semantic correctness + physical verification).
This is the forward-going complement to the one-pass **source-Hebrew** cleanup: Anglicized transliterations in the
Hebrew source (`דרי`→`יבש`; `דריי-ברין`→`ברין יבש`, Hebrew noun-then-adjective order) are hunted in a periodic sweep
and fixed at the root, with dependent dictionary keys re-keyed in lockstep (§10.19 rule 3).

### 10.21 Owner test handoffs are a Hebrew use-case script (owner instruction, 2026-07-26)
> **Owner instruction.** Whenever you ask the owner to test a shipped version, hand them **simple, precise
> test instructions in Hebrew** — a short **numbered list of concrete use cases**, one per changed/added
> feature, each naming the **screen**, the **exact action** to perform, and the **expected result** to look
> for. Never a vague "please test the new features". The owner tests in Hebrew, so the whole script is in
> Hebrew.

This is the owner-facing complement to **§10.10**: §10.10 is what *you* verify (Playwright on the live URL)
before telling the owner a version is live; §10.21 is the tester's script you then hand the owner so their
own verification is fast, unambiguous, and covers every change in the release. A use case has three parts:
**מה לבדוק** (which screen/feature) · **מה לעשות** (the exact taps/inputs, with concrete example values —
a real model name, a real recipe) · **מה אמור לקרות** (the observable expected result). A ship handoff that
lacks this Hebrew script is an incomplete handoff — write it from the release's changed-feature list, not
from memory, and keep it to the few use cases that actually exercise what changed.

### 10.22 Coin real Hebrew terms — never a transliteration (owner instruction, 2026-08-03)
> **Owner instruction, 2026-08-03,** correcting "לדג'ר" to "מרשם": when a new concept needs a Hebrew name,
> reach for a real Hebrew word, not an English word carried over in Hebrew letters.

This is the forward-looking rule; §10.20's דרי→יבש / דריי-ברין→ברין יבש cleanup is the retrospective one —
it hunts and fixes Anglicisms already sitting in the source. §10.22 is what stops the next one from being
coined in the first place: before naming something new, check for a real Hebrew word first, and reach for
a transliteration only when no such word exists. This governs Hebrew **body text and terminology** only —
it does not touch the separate, already-recorded naming convention (`docs/ROADMAP-2026-07-30.md` lines
7–8) that numbering and identifiers stay in English (Phase 0, Cooking Path, CP) while the prose around them
is Hebrew; that half is settled and is not restated here.

### 10.23 Sequential is the application's own subject, not just a scheduling limit (owner ruling, 2026-08-03)
> **Owner ruling, 2026-08-03:** `"סדרתי ובטוח זה ליבת החכמה באפליקציה"`

§10.5a caps how many agents may run at once (≤3 light, ≤5 hard, 1 during a suite/GPU run) — that ceiling
is unchanged and stays exactly as written. §10.23 is a separate, stricter rule about what may be
**proposed** for feature development: parallel-on-separate-files must never be offered as a speed option
at all, regardless of whether it would fit under the §10.5a ceiling. The two are not in tension — §10.5a
bounds concurrency when work is genuinely independent; §10.23 says feature-development work is not treated
as independent-and-parallelizable in the first place.

The reasoning is the part that makes this stick: the application's own subject matter is teaching the
correct **order** and **safety** of handling food — a tool built to tell people the right sequence should
not itself be built by an agent that treats sequence as an obstacle to route around. Building it out of
order is not just a process risk here; it contradicts the product.

### 10.25 The infrastructure is written in English; only the conversation is Hebrew (owner instruction, 2026-08-11)

> **Owner instruction, verbatim in translation:** *inside the rules and the gates always work in English.
> Only our conversation is Hebrew, so it does not disturb the infrastructure. Hebrew is fine for the
> application; the infrastructure is better in English. Just translate it for me.*

Scope, so this is a rule and not a mood. **English:** rule text, gate scripts and their comments,
patterns and regexes, register rows, plans, briefs, reports, commit messages, test names. **Hebrew
stays:** everything the product shows a user, the safety data and its citations, and this
conversation. The controller translates in the reply rather than in the artifact.

**Why it was given, and the evidence is a defect this document itself produced.** `SUBORDINATOR_RE`
in `claim-scan.mjs` listed Hebrew alternatives — `כאשר`, `אם`, `לאחר ש` — inside `\b...\b`. A
JavaScript word boundary is defined against `\w`, which does not include Hebrew letters, so every
Hebrew alternative in that guard was **inert from the day it was written**: the English half fired,
the Hebrew half never did. The guard exists to void a claim made inside a conditional ("I'll report
**when** it is live"), and the controller writes to the owner in Hebrew — so the guard was absent
exactly where it was needed. Registered R-141. The same class had already cost a rule-corpus sweep
the day before, where `בקר` matched inside `הבקר` and `חזיר` inside `מחזיר`.

The lesson generalises past regexes. A bilingual artifact carries a silent second failure mode:
every pattern, sort, boundary and comparison has to be correct in both scripts, and the one nobody
tests is the one that breaks. Keeping the machinery monolingual removes the failure mode rather than
guarding against it — which is the difference between a fix and a patch.

**Migration of what already exists is a separate decision, not implied by this rule.** The register,
this document and `CLAUDE.md` are Hebrew today; converting them is its own scoped task with its own
risk, and it has not been approved here. What this rule governs is everything written from
2026-08-11 onward.

### 10.24 Fight for the stated goal, and never self-declare final (owner feedback)
> **Owner feedback, two halves of one ruling.** (i) When a stated goal meets an obstacle, do not quietly
> narrow it — invent and research until the goal is met, or raise the obstacle explicitly. Settling for
> less than what was asked, without saying so, is the failure. (ii) Never declare a solution final, or
> accept a material or permanent trade-off, without the owner's explicit approval.

§10.8 already says which decisions get raised with the owner, and §10.14/§10.15 already say to research
instead of guessing when stuck. §10.24 is the rule that ties them together: it is the one that makes
"quietly narrow the goal" itself a violation, not merely a bad debugging habit. Without it, a goal can be
scaled down one small step at a time between an §10.8 decision that was never asked and an §10.14 research
pass that was never run — each step individually reasonable, the sum a silently downgraded deliverable.

In practice: when an approach hits a wall, the next move is inventing alternatives and researching them
(§10.14/§10.15), not shipping whatever the first approach could reach. And "done" is never declared solo —
a solution, a trade-off, or a "this is as good as it gets" is a decision under §10.8 (material scope
change / owner preference), raised in conversation, not written into a report as settled.

### 10.12a Historical — the graphify era, and the one hazard worth keeping
> This section documented how to refresh the graphify knowledge graph. **The tool was removed on
> 2026-08-04** and replaced by the SQLite/JSONB agent-memory store (§10.11 and §10.12 above). The
> operational instructions are gone rather than updated, because none of them apply.

One finding from that era is kept, because it is about *agents*, not about graphify, and it can recur
with any tool that dispatches a nested model process:

**Run any nested extraction backend from a NEUTRAL cwd, with absolute paths.** A nested `claude -p`
started inside this repo **loads `CLAUDE.md` and stops being an extractor**: measured 2026-07-24, 3 of 3
dispatched documents produced **0 nodes** while **60 nodes were invented for unrelated repo files**. An
agent handed a project's instructions will follow them instead of its task.

The other lesson of that era needs no section, because it is now enforced in code: **a stale map is worse
than no map, because it is trusted and wrong.** That is why `check-memory-fresh` blocks.

### Owner architecture decision — the reset for a §5 fix-cycle block (owner ruling, 2026-08-08)

> **Ruling (owner, in conversation, 2026-08-08):** a documented owner-decision record resets the §5
> fix-cycle counter. Modelled on the visible escape this project already uses — the No-lesson
> declaration `scripts/gate-lessons.mjs` recognises, of the form
> `**No-lesson declaration (YYYY-MM-DD):** <arc> — reason`.

Phase 4 Group B Task 4 (`scripts/hooks/rules/fix-cycle-limit.mjs`) turns §5's 3-fix rule from advice
into a block: once any open fix target in a session has closed 3 fix cycles, the next Edit/Write on
it is blocked before it becomes attempt #4. §5's own alternative is "question the architecture with
the owner" — but a conversation alone leaves no artifact a session-scoped rule can see. The record:

```
**Owner architecture decision (YYYY-MM-DD):** <target> — <what was decided>
```

lives right here, in §11, for the same reason the No-lesson declaration does: visible, dated,
human-readable, grep-able off the document itself — not a bypass flag, not a config toggle, not a
second ledger that can fall out of sync with the doc. `fix-cycle-limit.mjs` reads this document fresh
on every Edit/Write call (no caching). `<target>` must match the blocked target string verbatim — it
is quoted in full in the block's own deny reason, so writing the record is copy-the-target, not
guess-the-target.

**The record is a RESET, not a permanent exemption (fix round 1, 2026-08-08).** "Reset" is
point-in-time: a record dated D clears only the fix cycles that had accumulated as of D. If the same
target fails AGAIN after D, the record no longer covers that failure and the block returns — the deny
reason then names the stale record and says so, because a target that keeps failing after an
owner-approved change is exactly the conversation §5 wants had a **second** time, not proof the gate
misfired. A date-only record (`YYYY-MM-DD`, the mirrored form) is read as covering up to the END of
that UTC day — permissive enough that "the owner reviewed and wrote the record the same day the
failures happened" (the common case) actually clears it. Anyone who needs same-day precision can
write the finer form the rule also accepts, `(YYYY-MM-DD HH:MM)`, **read as UTC, not local time.**

**The reset is literal AND single-use (fix round 2, 2026-08-08).** Round 1 only compared timestamps
on every call — it never actually zeroed anything, so a same-day date-only record kept re-clearing
every fresh batch of same-day failures (its whole-day cutoff never stops covering "today," no matter
how many times the target re-crosses the ceiling). Fixed two ways, together: (1) the first time a
record validly covers a target's current failures, the rule deletes that target's row via the
store's own `noteVerificationPass()` — the exact action a real passing verification run takes — so
the counter is genuinely zero afterward, not merely "not blocked this call"; (2) a given record (its
exact target+text pair) may perform that reset **at most once per session** — tracked as an
`events` row, read fresh every call. Once consumed, that same record can never clear the same target
again; the deny reason says so and asks for a **new** record (a later date, or a precise UTC time) to
reset it a second time. This is what makes "failures … after D count again from zero" literal rather
than "a standing daily allowance."

Because the match is exact-string, a typo'd target in the record silently never clears the real one —
the rule does not loosen the match to compensate (a fuzzy match risks clearing the WRONG target, which
is worse than an over-strict block); instead, when no exact record exists but a similarly-spelled one
does, the deny reason names it directly, so the fix is a two-second string correction, not a guess.

The owner accepted, explicitly, the risk that an agent could write this record unilaterally: this
layer exists against **forgetting** §5's stop, not against malice, and the strict alternative — no
in-session reset at all — would leave genuinely owner-approved work blocked inside its own session
with no way out. Per the ruling: **no anti-forgery machinery was added, and none should be.**

## 13. Operating Model — Main thread vs subagents (H6, adopted 2026-07-30)

Authoritative form of METHODOLOGY-2026-07-30 §2, written here so every subagent inherits it.

| What | Runs where | Why |
|---|---|---|
| Decisions, gates, owner communication, §4 rulings | **Main only — never delegated** | decision provenance lives in one conversation; the owner talks to one entity |
| Accepting/rejecting a Phase-gate verdict; declaring "done" | **Main only** | "Being wrong is worse than being silent" — accountability is not inherited |
| Ledger upkeep (ROADMAP §5) + §10.6/H9 summaries | **Main** | the one thing compaction must never squeeze out |
| Spec/plan drafting | Subagent; approval in Main | heavy writing = heavy context; approval and owner-facing stay in Main |
| Task implementation (SDD, fresh agent per task) | **Subagent** | the proven `.superpowers/sdd/` pattern |
| Code-review + spec-audit (two verdicts, §7) | **Subagent** (fresh, no access to progress.md) | reviewer independence — the strongest artifact in the repo |
| Heavy reading: research, synthesis, evidence sweeps | **Subagent** | Main receives conclusions + file paths, not dumps |
| Graph refresh, suite runs, 390×844 screenshot sweeps | **Subagent** (serialized, §10.5a) | long mechanical work; Main verifies the artifact |

**The brief/report contract (file-based handoffs):** a brief is a FILE (template:
`docs/process/templates/task-brief.md`) carrying (a) the exact spec lines the task satisfies (DoD-1),
(b) the exact code from the plan, (c) the relevant DoD checklist, (d) the report contract — report file
name and what must be pasted in it (RED output, GREEN output, exit code, screenshot paths) **including
the H9 5-row summary table**, and (e) a "primary tool" field: serena for symbol work, the geniza for
docs/relationship questions, grep only as a declared fallback. A missing field = an invalid brief.
**Build it with `node scripts/make-brief.mjs --plan <plan> --task <N> --out <brief> --spec "<quoted spec
lines>" --tool <serena|geniza|אחר>`** — it derives (b)(c)(d)(f) and the plan's Global Constraints, and
**refuses** when (a) or (e) is missing or a placeholder. That refusal is the whole design: a slice of
plan text is the raw material of a brief, not a brief, and five such slices sent `check-brief` red and
taught the escape hatch to become routine (2026-08-02, owner decision — see `gate-baselines.json`
`_owner_additions`). A generator that emitted "TODO" would pass the marker scan and defeat its own gate.
A report is a FILE under `.superpowers/sdd/`; the agent returns only a summary + path; Main verifies
via diff, never on the report alone. **Main's context budget:** no full source files, no full suite
logs, no long documents — anything projected over ~2k cumulative lines goes to a subagent that returns
an extract; Main stays below the compaction zone so the ledger, decisions and the owner conversation
are never squeezed out.

## 14. H8 — The Full-Landing Rule ("nothing in the air"; owner ruling, 2026-07-30)

The owner's ruling, verbatim (DECISION-REGISTER H8):

> **כלל הנחיתה המלאה ("שום דבר באוויר"):** מעכשיו והלאה אף פריט אינו "לא מטופל" / "לא מעוגן" /
> "נדחה בלי מועד". לכל פער, החלטה או רעיון יש בדיוק אחת מ: (א) פאזה נקובה ב-Roadmap; (ב) דחייה
> מנומקת **עם טריגר מוגדר** לפתיחה מחדש; (ג) אם הנושא דורש דיון/סיעור מוחות — **המשימה הרשומה היא
> הדיון עצמו**, בפאזה נקובה, והחלטותיו משולבות בתוכנית אחריו.

Born from the 2026-07-30 coverage audit: 43 gaps had no landing, 9 of them dropped from the plan
entirely. **Mechanical enforcement:** the no-unlanded-items check inside `scripts/check-meta.mjs`
parses the ROADMAP §5 ledger — every ledger row must land in a named phase, every remainder item must
carry a defined trigger; anything else exits nonzero. It runs at EVERY Phase gate and EVERY arc close,
plus check-meta's routine runs (session start, before docs push, before any `release(v` commit).

## 15. H9–H12 — task summaries, the live status board, capabilities, /status (owner rulings, 2026-07-30)

- **H9 — mandatory task-summary table.** Defined in §10.6 (the structured form of the three parts):
  every task, Main or subagent, ends with the fixed 5-row table; for subagents it is part of the report
  contract; Main verifies and relays. Per **H10c**, evidence rows carry "vNNN · date+time".
- **H10 — the live status board, `docs/STATUS-BOARD.md`.** THE source of truth for position against
  the plan: one row per Phase (tasks done/total · status · gaps closed) + a project-total row; per
  **H10b** it also carries the full project history since the PRD as ✅ rows. **Updated at every task
  close**; checked (together with no-unlanded-items) at every Phase gate — a stale board fails the
  gate. H9's "איפה אנחנו" row is READ from it. Per **H10a**, it is maintained every task but shown to
  the owner only at milestones or on request.
- **H11 — the capabilities table, `docs/CAPABILITIES.md`.** The living inventory of every product
  capability, large and small; every shipped feature adds its row (with "since vNNN · D.M.YY" per
  H10c) as part of the task-close routine, alongside the board. Future base for help/marketing docs.
- **H12 — the `/status` command** (`.claude/commands/status.md`): `/status` = the board ·
  `/status caps` = capabilities · `/status full` = both + the last task's H9 table.

## 16. H13 — שער רלוונטיות לפריט משוחזר (Recovery Relevance Gate; owner ruling, 2026-07-30)

Born from the 2026-07-30 recovery audit (two coverage-audit agents over all of `docs/analysis/`): 25 items
the plan had lost were recovered into the ROADMAP as ledger rows `R-1..R-25`. The owner's ruling: recover
everything, **but every recovered item may be stale** — done since, or invalidated by later
architecture/decisions. Therefore:

- **A recovered item (status ⚠️R "נדרש-אימות") is a *lead*, not a commitment.** Its ledger row carries a
  **source pointer** (doc + section) so its original context can be reconstructed.
- **On pickup — BEFORE any implementation work — the Relevance Gate runs, in order (owner flow, verbatim
  intent, 2026-07-30):**
  - **(a) Reconstruct & check — ALL of it first.** Read the source pointer and rebuild the original context
    until the requirement is fully understood; then check what already exists NOW — in the current code
    (serena for symbols, the live app for behavior) and in the current architecture/decision register. The
    original evidence is history, not proof: what was true on the audit date may have been fixed,
    superseded, or redesigned since.
  - **(b) Form a RECOMMENDATION** — handle (בצע) or delete (בטל) — with the evidence that supports it.
  - **(c) ASK THE OWNER — a mandatory checkpoint, never skipped.** Present the recommendation with its
    evidence and **decide together**. This is one of the §10.8 "genuinely important decisions" where
    interrupting the owner is **required, not optional** — the verdict on a recovered item is NOT the
    developer's to make alone.
  - **(d) Update the document** — the ledger row records the joint decision.
  - **(e) Execute or cancel accordingly:**
    - **בצע** — the item proceeds as a normal task (full DoD, normal pipeline);
    - **בטל** — the ledger row is marked **`R-cancelled`** with the decision + a one-line reason.
      **The row is never deleted** — a cancel is recorded, never silently dropped.
- **The gate (through the joint verdict) is part of DoD line 1 (spec-trace)** — see §3. A recovered task
  whose report has no recorded owner-approved verdict fails the DoD gate.
- H13 does not weaken H8: an ⚠️R row still has exactly one landing (named phase / defined trigger /
  registered discussion task). H13 only adds the validation step at pickup time.

Recovery Ledger location: `docs/ROADMAP-2026-07-30.md` §5a. Task cards for recovered items
(`docs/ROADMAP-task-cards.md`) name the Relevance Gate as their first requirement.

## 17. H14 — דו"ח UX לכל גרסה (Release UX Report; owner ruling, 2026-07-30)

> הבעלים: *"בכל פעם שמייצרים גרסה אני רוצה דו"ח קצר המסביר איך השינויים בגרסה באים לידי ביטוי
> דרך ממשק המשתמש ואיך לבדוק את זה — זה יעזור לי לוודא שאנחנו עובדים נכון."*

**כל `release(vNNN)` מלווה בדו"ח קצר בעברית**, נכתב כחלק ממשימת השילוח (לא אחריה), בקובץ
`docs/releases/vNNN-ux-report.md`, ומקושר מטבלת ה-H9 של המשימה:

1. **מה השתנה** — במונחי משתמש, לא הודעות commit.
2. **איפה רואים את זה** — המשטח/המסך המדויק ומסלול-ההקלקה אליו (למשל: "מסך הבית ← כרטיס פריט ← לשונית נתיבים").
3. **איך בודקים ביד** — ‏2–5 צעדים קונקרטיים לכל שינוי: פתח X, לחץ Y, צפה ל-Z; ב-viewport ‏390×844;
   בעברית תחילה (וכל שפה שהשינוי נוגע בה).
4. **שינוי בלי ביטוי חזותי** (תשתית/דאטה) אומר זאת במפורש: "אין ביטוי חזותי; מאומת על-ידי `<שם הבדיקה>`".

- הדו"ח נשען על ראיות ה-DoD (צילומי 390×844 שכבר חובה לצרף) — הוא אריזה קריאה שלהן, לא עבודת אימות חדשה.
- ‏§10.10 עדיין חל: הדו"ח מדבר על הגרסה **החיה** רק אחרי אימות Playwright מול ה-URL החי; עד אז ינוסח
  "ב-build המקומי".
- חל מהגרסה הראשונה של Phase 1 ואילך.

## 18. H15 — בחירת מודל ורמת מאמץ ל-subagents (owner ruling, 2026-07-30)

בכל שיגור subagent/workflow, המודל נבחר **מפורשות** (לעולם לא בירושה שקטה):

| סוג המשימה | מודל | רמת מאמץ |
|---|---|---|
| תכנון, ארכיטקטורה, החלטות מורכבות, שערי-Phase, פאנלי שיפוט | **Fable 5** (לא זמין → **Opus 5**) | high |
| פיתוח פשוט/מכני (תעתוק מתוכנית מלאה, תיקון קובץ-בודד, סנכרוני docs) | **Sonnet 5** | medium |
| פיתוח מורכב (אינטגרציה רב-קבצית, debugging, לוגיקה עדינה) | **Sonnet 5** | high…xhigh לפי דרגת הקושי |

- **אם הצלחת ברמת מאמץ נמוכה — אין מחליפים לגבוהה.** הסלמה (מודל או מאמץ) רק על כשל/BLOCKED,
  לעולם לא רטרואקטיבית על עבודה שהצליחה.
- משלים את כללי ה-sdd (״never force the same model to retry without changes״) — הסלמה היא תגובה
  לכשל, עם שינוי, לא ניסיון חוזר עיוור.


**L45 · A green test is not evidence until you know which mechanism made it green (2026-08-02).**

Four tests were found passing while proving nothing, in a single day, each by a different mechanism:

1. **A hand-built fixture.** v286's target-temperature test fed `vcClaimVerdict` a claim map assembled by
   hand. The branch worked; the shape the live classifier actually returns never reached it. The feature
   was dead in production and the test was green — it survived a release and the owner found it.
2. **A precondition the fixture never established.** The duplicate-acknowledgement test never opened the
   voice panel, so the pre-warm cache was empty and the FIRST acknowledgement was structurally
   unreachable. The test could not have seen the duplicate it was meant to guard.
3. **An interceptor that matched nothing.** "Read-aloud never calls the classifier" intercepted
   `**/generateContent*`, but the real URL separates the verb with a COLON. It counted a counter that
   could never increment. Green in a vacuum.
4. **A contract only the remote validates.** The classifier's response schema carried an empty enum
   member. 1,101 local tests were green because every one of them mocks the classifier, so the real
   schema was never sent. Gemini rejected it with a 400 on every call in production, and every number in
   every answer was redacted.

The common shape: **each test asserted something true about a path the program does not take.** Passing
proved the assertion, not the behaviour.

What to do about it, concretely:
- **Feed the live shape.** If a fixture is hand-authored, capture the real payload once and assert your
  fixture still matches it — a fixture that drifts from production is a test that guards nothing.
- **State the precondition and assert it.** If a bug only occurs in a warm/authenticated/opened state,
  the test must establish that state AND assert it was established, or it is testing the other branch.
- **Prove the interceptor fires.** A route/mock/spy that never matches is indistinguishable from a
  passing test. Assert the intercept count is non-zero before asserting anything about it.
- **Validate contracts you cannot execute.** For a schema/protocol only a remote service enforces,
  validate the ARTEFACT structurally (and against the bytes actually sent), and say out loud what that
  does and does not prove.
- **When RED "passes", stop.** In two of these cases the RED run showed passing assertions produced by an
  unrelated failure (a missing module exiting 1). A red phase that passes for the wrong reason is the
  same defect arriving early — and it is the cheapest moment to catch it.

**L46 · An environment fact measured with ONE tool, and handed to a fleet, is an assumption wearing
evidence's clothes (2026-08-02).**

The corpus-download arc. Phase 1 probed the network with `curl`, got `000`, and wrote into the source
map: *"`curl` is completely disconnected from the network — there is no shell-based download path.
`WebFetch` is the only channel."* That sentence was quoted verbatim into the task brief, and from there
into **three** download-agent briefs as an established fact they were told not to re-discover. All three
built their entire strategy on it: hunting state-government mirrors for federal documents, marking
`fda.gov`, `ecfr.gov`, `web.archive.org` and `seriouseats.com` as blocked, and settling for WebSearch
reconstructions where no mirror existed.

One line disproved it:

```
node -e "fetch('https://example.com')"   ->  200
```

**`curl` is sandboxed; Node's `fetch` is not.** And what `WebFetch` reports as a block is often its own
tool-side domain refusal, not a network fact. Re-probed with node: `fda.gov` 200 · `ecfr.gov` 200 (with
an official versioner **API returning structured XML**) · `web.archive.org` reachable · `seriouseats.com`
200, no paywall. Exactly one of the declared blocks was real: `fsis.usda.gov` 403, server-side.

The cost: an entire round of mirror-hunting that was unnecessary, two sources abandoned as
"unretrievable" that were one fetch away, regulatory text scraped out of PDFs when a structured XML API
was available, and — the part that matters — **a reconstructed value that was simply wrong** (the
AskUSDA organ list was recorded as heart/chitterlings; the real page says kidney/liver/stomach/tongue/
tripe). Round 2 closed all of it in about forty minutes.

Why the existing gates did not catch it. §12's PREDICT→TEST→OBSERVE and L14's single-point-failure
razor both apply to **debugging**. Nothing pointed them at an **environment measurement** — a fact
established once, early, by one agent, and then propagated as a premise. And a premise, unlike a
conclusion, is never re-examined: three agents each honoured it precisely *because* the brief told them
it was verified.

The rule this earns:

- **A capability claim about the environment — "there is no network", "this host is blocked", "that tool
  cannot do X" — requires TWO independent tools before it may be written down as fact.** One tool
  returning zero measures the tool, not the world.
- **Distinguish the layer that refused you.** Sandbox · tool policy · server (403/404) · paywall (402)
  are four different failures with four different workarounds. Recording all of them as "blocked"
  destroys the information needed to route around any of them.
- **A premise inherited by a fan-out is the highest-leverage thing to falsify**, because it multiplies:
  a wrong conclusion costs one agent, a wrong premise costs all of them at once. Before dispatching N
  agents on a stated constraint, spend one minute trying to break it.
- **Prefer the structured channel.** eCFR's versioner API returns date-versioned XML where we were
  scraping PDFs; USDA FoodData Central serves the same shape for nutrition. §10.15's "evaluate a better
  ingredient" applies to the **acquisition channel**, not only to servers and runners.
- Independent corroboration is the reward for doing it right: the eCFR XML agreed with the
  PDF-scraped CSVs on **every** value, which is stronger evidence than either path alone.

**L47 · A field that encodes three states will be read three ways — and the paths never contradict
each other loudly enough to notice (2026-08-03).**

`safe` carries a cited safety floor, `0` meaning "not applicable" (every ירקות/פירות row), and absence
meaning "we hold no figure". Nothing in the code says so. Every consumer therefore decided for itself,
and they decided differently:

- `vcIdentifiedSafeItem` (voice) — taught all three states by the R-69 fix on 2026-08-02, with a long
  comment explaining corn.
- `askFire` (the local ask engine) — `${c.safe||63}`. Corn answered **"טמפ׳ בטיחות 63°C"**, stamped
  ⚡מקומי, i.e. asserted as our own verified figure. 27 catalogue rows.
- `askContextFor` (the AI's grounding context) — the same `||63`, fed to the model as established fact,
  where the safety guard would then find it consistent and let it through.

R-69 fixed one of the three and the other two kept shipping, because **nothing in a flat row makes the
readings compare**. There is no place where two interpretations of `safe` meet and disagree; they simply
run in different code paths and produce different sentences to different users.

What it teaches:

- **When one consumer of a field is found to be wrong, ask Serena for ALL of them before fixing.** The
  R-69 fix was correct and complete for the path it examined; the defect was that it examined one path.
  `find_referencing_symbols` / a `.field` search is a two-minute query and it produced twenty sites here.
- **Fix by collapsing to one reader, not by patching each site.** `citedSafeC()` is now the only code
  that decides what `safe` means, and the already-correct path was folded into it too — otherwise the
  next fix has three places to remember again.
- **A sentinel inside a value's own domain is the trap.** `0` is a perfectly good temperature, so
  `safe=0` cannot be distinguished from a cited 0°C by looking at the value. The absence of a mechanism
  must be encoded OUTSIDE the mechanism's value space. This is the concrete argument for R-75's
  per-mechanism blocks: a produce row should not have a thermal block at all, rather than have one
  holding a magic number.
- **Branch order hides reachability.** The sweep of 279 items missed this because the earlier
  `has('טמפ','חום','מעלות')` branch IS guarded, so every question containing the word "טמפרטורה" is
  answered correctly and never reaches the unguarded branch. A sweep that varies the SUBJECT but not the
  PHRASING measures one path and reports it as coverage.

Two process notes from the same night, both worth keeping:

1. **A test of mine passed on its first run and proved nothing** — its regex sat inside a TS template
   literal, where `\s` is not a recognised escape and collapses to `s`, so it reached the browser as
   `/…s*d/` and matched nothing. Caught only by the contract's rule that a first-run pass is void (L45,
   now with a fifth instance). Build such patterns with `new RegExp` from a `JSON.stringify`'d string,
   and assert the pattern can fire at all before asserting that it does not.
2. **The suite's one failure was my own competing load.** Thirteen Chrome processes from this session's
   MCP browser were live during the run; the spec passed alone, and the machine was quiet for both
   green runs afterwards. §11a already says the worker count assumes an idle machine — the addition is
   that *the agent's own tooling* is part of that load, and closing it is part of preparing to measure.

**L48 · A gate that does not look at a language cannot fail on it — and it will print green while
that language is broken (2026-08-04).**

A commit landed with a failing `pytest`. `check-meta` ran, printed `META GATE OK`, and let it through.
Not a bug in any gate: **there was no gate.** Eight checkers over Markdown and `git log`, and the
Python suite — the only thing verifying the memory layer that now holds every primary safety source —
was outside all of them.

This is the review panel's central finding one layer up. The panel diagnosed *metrics that count
whether something happened rather than whether it is right*. This is the degenerate case: **a metric
that does not look at the thing at all.** It had been invisible for hours precisely because the suite
was green — a blind gate and a passing gate are indistinguishable until the first failure, and by then
the commit is in.

**The check, and it is cheap:** for every language and artefact class in the repo, name the gate that
would go red if it broke. Where the answer is "none", that is not coverage — it is an absence that has
not been tested yet.

`check-pytest` now runs inside `check-meta` and **blocks**. It costs ~2 s because every test runs
against `:memory:` with `MockLLM`/`MockEmbedding`. It was proven in both directions before being
trusted — break one assertion → exit 1, restore → exit 0 — because a gate whose failure path has never
been observed is exactly the thing this lesson is about. If `python` cannot be run it reports SKIPPED
out loud: **a gate that could not run is not a gate that passed.**

**Same shape, found the same day:** `check-h8-ledger` passes on *worsening only*, so an entire day
absent from the register does not trip it. A full day's work — three shipped safety fixes and the
replacement of the memory layer — existed only in commit messages until it was noticed by hand.

**L49 · A number you invent for convenience becomes an argument, and then a design (2026-08-04).**

Embedding input was capped at 2,000 characters. I chose that; I never checked the model. `bge-m3`
advertises 8,192 tokens, and measurement put the real usable window near 6,000 characters — **three
times what I had allowed.**

The cap being wrong cost little. What it cost was in the *next* decision: choosing code-chunk size, I
wrote *"bge-m3 reads only the first 2,000 characters, so a 5 KB node loses most of itself"* and picked
a smaller chunk on that basis. **A number I had made up was now load-bearing evidence in an unrelated
argument**, indistinguishable in the reasoning from the measured ones beside it.

This is the panel's *wrong-frame measurement* class, self-inflicted. The dangerous property is not the
error — it is that an invented constant and a measured one **look identical once written down.**

**The check:** when a constant enters a *reason*, say where it came from in the same breath. "The model
reads 2,000 chars" and "I capped it at 2,000 chars" are different claims and only one of them is
evidence.

**L50 · Two languages, one threshold: a limit measured in the convenient language is not a limit
(2026-08-04).**

Ollama applies its context window to an embedding batch *as a whole*. The obvious fix was a character
budget. It is wrong, and the measurement says so bluntly:

    synthetic ASCII      118,000 chars in one request -> accepted
    this repo's Hebrew    96,000 chars in one request -> HTTP 400

The ceiling is in **tokens**, and Hebrew costs far more tokens per character than English. **Any fixed
character budget passes in one language and fails in the other** — silently, on exactly the mixed
Hebrew/English content this product is made of. There is no number correct for both.

The batch now **splits on failure** rather than predicting it: send, and on a context error halve and
retry down to a single item; an item still over the line has its text halved, with the count reported
rather than swallowed. Slower on the rare oversized batch, correct in every language, and it cannot
rot when the corpus or the model changes.

**The general rule, and it is not about embeddings:** in a bilingual product, a threshold validated on
English is validated on the easy case. Measure it on Hebrew, or make the code discover it at runtime.
The same trap took a different form the same day — FTS5's default `unicode61` tokeniser returns **zero
hits** for `ניטריט` because Hebrew attaches ה/ו/ב/ל/מ/ש/כ to words, while returning the right row for
`nitrite`. A search that works perfectly in English and silently finds nothing in Hebrew is worse than
one that fails in both, because nobody investigates a feature that appears to work.

**Adopted win from the same arc — the feasibility gate paid for itself twice.** `BM25Retriever` was
approved *behind a stated PyStemmer feasibility check*, and the check failed exactly as the research
predicted: no wheel for CPython 3.14, `pip` dies at build. Because it was gated rather than assumed,
that cost minutes and the capability was delivered another way (SQLite FTS5) the same hour. The
research pass that predicted it had read the **installed source**, not the docs site — after the
supplied example turned out to use `Header_2` and `node.parent_node`, neither of which exists in
llama-index-core 0.14.23.


**L51a · `sudo` inside a non-interactive `wsl` call is blocked (2026-08-05, split 9.8.26).**
A `sudo` inside a non-interactive `wsl` invocation is blocked: the password prompt reads EOF and the command fails silently, which is indistinguishable from doing nothing. Use `wsl -u root <command>` — the Windows user is already authenticated, so root needs no password.

**L51b · An installer that needs a password, run without a TTY, fails silently — and I have now
walked into it three times (2026-08-05).**

Three separate installs on this machine looked like nothing happened at all:

| what | what it actually was |
|---|---|
| Python 3.14 via winget, twice | needed elevation; the UAC prompt is invisible to a non-interactive session |
| Python 3.14 official installer | `Include_launcher` defaults to AllUsers, which makes the bundle "launch an elevated engine process" — it hung at `Apply begin` having written nothing |
| Docker in WSL2, twice | `wsl -e bash -lc 'sudo …'` has **no TTY**, so the password prompt reads EOF and the script exits |

None of them printed an error a caller could act on. Every one of them cost a round trip through
the owner, who then reported — correctly — that the command appeared to do nothing.

**The check, before asking anyone to run anything:** does this command need elevation or a
password, and does the channel I am using have a way to supply it? If not, the command WILL fail
quietly, and asking a human to run it changes nothing.

**And the thing I should have found on the first attempt, not the fifth:** `wsl -u root` gives
root **with no password**, because the Windows user is already authenticated. Every install that
followed was unattended. The pattern generalises — before routing work to a human, look for the
already-authenticated path.

**A second, smaller shape from the same session.** The Docker install script died on
`docker-model-plugin`, a package that does not exist for Ubuntu focal and that we do not want.
`apt-get install a b c d` fails **entirely** when one name is missing — so a single irrelevant
package took down four required ones. When a vendor's convenience script fails on one component,
read WHICH component before concluding the platform is unsupported.

**The judged half:** before routing any command to a human or a channel, verify it does not need elevation or a password that channel cannot supply, and look first for an already-authenticated path. And when a vendor convenience script fails, read WHICH component failed before concluding the platform is unsupported.

**L52 · "Always take the newest" is a version policy, not a tagging policy — and the newest
changes contracts (2026-08-05).**

The owner asked, across the board, to always install the newest. Taken literally that means the
`latest` tag; taken as intent it means the newest version number. They are not the same thing:
`latest` is a *floating* pointer, so a future `docker compose pull` swaps the database engine
under a running system with nothing in any diff to show it. We pin the newest version NUMBER —
same software today, and a change that has to be written down to happen.

That distinction paid within the hour, because the newest of both components had moved the
goalposts:

- **PostgreSQL 18 changed the volume mount convention.** Up to 17 the data mount is
  `/var/lib/postgresql/data`; from 18 it must be `/var/lib/postgresql`, and 18 REFUSES to start
  if it finds data at the old path. Every tutorial and every older compose file on the internet
  is now wrong for 18.
- **Neo4j moved from SemVer to CalVer in January 2025.** `5.26` is the LTS (supported to June
  2028); `2026.06` is the mainline. Both are "newest" depending on which line you are reading.

**The check:** when a pinned version moves a whole major number, read that image's own release
notes for changed mount paths, env var names and entrypoint behaviour BEFORE debugging the
container. Both failures here were documented upstream and cost a diagnostic cycle each.

**L53 · A generated secret is an input to a command line, and it can be parsed as syntax
(2026-08-05).**

`secrets.token_urlsafe(32)` produced a password beginning with `-`. Neo4j's entrypoint calls
`neo4j-admin dbms set-initial-password <password>`, the leading `-` was read as a **flag**, and
the container crash-looped reporting `Missing required parameter: '<password>'` — an error that
points at a missing value while the value is right there, being misread.

Generated credentials must be safe for every channel they cross. Here that meant: start with a
letter (no leading `-`), and contain no `/` (which would split `NEO4J_AUTH`'s `user/password`
form). The alphabet is now `A-Za-z0-9._~`.

**Same session, same class:** `.env` written from Windows carried **CRLF**, and WSL read the
trailing `\r` as part of every value. It happened to work; it would have failed on the first
value where a trailing carriage return mattered. Infrastructure files consumed by Linux tools are
written **LF-only**, deliberately, not by whichever editor touched them last.

**Adopted win — the diagnostic order that keeps working.** Every one of the failures above was
found the same way and it is worth naming as a method: **read the log before forming a theory.**
`docker logs` said `there appears to be PostgreSQL data in /var/lib/postgresql/data (unused
mount/volume)` and `Missing required parameter: '<password>'` — each naming its own cause. The
temptation each time was to guess (bad password? bad image? WSL networking?) and each guess would
have cost a cycle. The habit: run it, read what it said, THEN think.

**Adopted win — prove reachability at the boundary that will actually be used.** Before writing a
line of compose, the question "can Windows reach a port opened inside WSL2?" was answered by
opening one and fetching it from Windows: `127.0.0.1:5433 -> HTTP 200`. That is thirty seconds
against a whole architecture resting on an assumption. The same habit later confirmed that the
data survives a restart by writing a marker into **both** stores, restarting, and reading it
back — rather than trusting that a named volume implies persistence.

**L56 · I built a phase from my summary of the spec instead of from the spec (2026-08-05).**

Phase 3 of the knowledge-stack prompt was committed and called complete. Going to read the label
allowlist for Phase 4, I found the prompt had **never been saved to the repo** — and recovering it
from the session transcript showed Phase 3 was missing most of what it specified: the eight
revision statuses, `source_authority`, `idempotency_key`, `namespace`, the projection schema
version, superseded-by, source commit.

Not one was disputed, hard, or a judgement call. They were written down, in numbered lists, under
each table. I worked from a summary because **the summary was in front of me and the prompt was
not.**

**§4 forbids narrowing an approved spec. Narrowing by FORGETTING is still narrowing** — and it is
harder to catch than doing it on purpose, because there is no decision anywhere to point at, no
moment where someone chose. It looks exactly like completed work.

Two mechanisms, both now in place:
- **The spec lives in the repo** (`docs/infra/owner-prompt-2026-08-05-knowledge-stack.md`). A
  requirement you cannot re-read is a requirement you will paraphrase.
- **A coverage test transcribes the requirement list and checks it** (`test_pg_spec_coverage.py`).
  A dropped field fails a test instead of surviving as an absence.

**The check:** before implementing from any spec, open the spec. Not the plan, not the summary,
not the commit message that mentioned it. If it is not in the repo, put it there first.

**L57 · A test helper that cannot tell "absent" from "broken" hides the bugs it was meant to
surface (2026-08-05).**

The worker tests skipped on ANY failed ingestion with the message "stack unavailable". A genuine
`SchemaViolation` — a real bug — read as a missing environment, and **four tests went green-ish
while the thing they exist to check had never run.** Changing the helper to skip only on
connection-shaped failures and FAIL on everything else surfaced two real bugs within the minute.

This is L54 wearing different clothes and it is worth stating as its own rule: **an absence and a
failure are different results and must never share an exit path.** `SKIPPED` is honest and useful;
`SKIPPED` standing in for `FAILED` is worse than either, because it consumes the budget of
attention a red test would have earned.

The generalisation, which is the expensive half: any code that decides "this isn't my problem"
needs a POSITIVE test for the condition it is excusing — a marker list, an exception type, an exit
code. `except Exception: skip()` is not a decision, it is an abdication with a docstring.

**L58 · A wait that cannot fail is not a wait — `|| true` disguised as a condition (2026-08-06).**

`visual-smoke.spec.ts` settled its screenshots with
`await page.waitForFunction(() => document.fonts?.status === 'loaded' || true)`.
It satisfies §11a by SHAPE — a `waitForFunction`, not a `waitForTimeout` — and waits for exactly
nothing: `|| true` makes the predicate true on its first evaluation. It shipped in Phase C and
passed review because the rule everyone was checking was "no arbitrary waits", and it has none.

**The rule is now: a condition wait must be able to fail.** If no reachable state makes the
predicate false, it is a comment with a network round-trip. The `?.` is the tell — the author wrote
the safety navigation and then defended against it with `|| true`, which is where the assertion died.

The generalisation past screenshots: this is the same shape as L54 and L57 — **a check whose failure
path does not exist**. L54 could not fail because the stub's absence read as success; L57 could not
fail because everything became a skip; L58 could not fail because the predicate was a tautology. When
adding any gate, ask what input makes it red, and then produce that input.

**L59 · `python` on Windows is a Store alias, and knowing that once is not knowing it everywhere
(2026-08-06).**

L54 recorded that `python` on PATH is frequently the Microsoft Store app-execution alias — a shim
that prints "Python was not found" and exits 9009 — and fixed it in `check-pytest`. It fixed the
CALLER, not the CLASS. `playwright.config.ts` kept a bare `python build.py` in its `webServer`, and
when the alias won the PATH order the whole suite died with `Process from config.webServer was not
able to start. Exit code: 9009` — an error naming the web server and never mentioning Python.

**The rule: when a lesson names an environment hazard, grep for every caller that shares it in the
same sitting.** A lesson applied to one call site is an anecdote. `resolvePython()` now probes
`py -3` → `python3` → `python`, rejects any path under `WindowsApps`, and throws a named error rather
than letting a stale `dist/` be tested.

**L60 · A baseline that encodes the wall clock is a gate scheduled to fail (2026-08-06).**

The Phase C visual baselines photographed `#cGreet`, whose text `app.js:12361` computes from
`new Date().getHours()`. A baseline taken at 23:26 says "ערב טוב"; the identical, unchanged screen
says "בוקר טוב" after midnight. Six of seven baselines were built to go red twice a day for reasons
no commit caused — the precise mechanism by which a gate becomes noise and gets silenced, which this
project has already watched happen to a permanently-amber signal.

Non-reproducible regions are **masked, and the mask is justified in the file**: the greeting's
correctness belongs to a functional test that can control the clock, not to a photograph. The broader
rule for snapshot gates: before storing a baseline, name every pixel in it that depends on the clock,
on focus, or on scroll position — those three produced all six failures here — and either pin the
state or mask it.

**L61 · A duplicate YAML key is silent locally and fatal remotely — and a red nobody can explain
gets treated as weather (2026-08-06).**

Commit `1a9f844` added an `upload-artifact` step to `test.yml` and left the previous step's
`retention-days: 7` dangling, so it landed inside the NEW step's `with:` beside
`retention-days: 30`. Every local check stayed green: YAML's reference behaviour for a duplicate key
is last-one-wins, and PyYAML does not even warn. GitHub's parser refuses it, so **the workflow never
compiled** — six consecutive pushes produced runs with ZERO jobs, a `failure` conclusion, no logs,
and a display name that silently degraded from `tests` to the file's own path. **CI was dark for
eleven hours.**

Two failures, and the second is the expensive one:

1. **No gate looked at the workflow files.** They are the only files in the repo whose parser lives
   on someone else's server, and nothing local ever read them. `scripts/check-workflows.mjs` now
   does, with a `SafeLoader` subclass that rejects duplicate keys, and it BLOCKS — this failure is
   fully decidable locally and costs milliseconds to catch.
2. **`check-ci` reported RED every single time and I read past it six times.** Advisory was the
   right design for a failing TEST (§10.10a: the fix for a red CI is a commit that does not exist
   yet). It is the wrong response to a red with **zero jobs and no logs**, which is not a failing
   test at all — it is the service saying it could not read the file.

**The rule: a CI failure that produces no logs is not a test failure, and must never be filed as
one.** Zero jobs means the workflow did not compile. Check that before anything else, and never let
a red you have not explained become part of the scenery — "CI is red again" is the sentence that
cost eleven hours here.

**L62 · An unplanned reboot can corrupt an index, and only a full suite will tell you (2026-08-06).**

The machine restarted itself at 02:27 (System event 1074). Hours later, while implementing an
unrelated task, an agent's `check-meta` run failed on `test_acceptance.py::test_F4` — and the cause
was a **corrupted HNSW index** on the geniza's `data_chunk_vectors_embedding_idx`, almost certainly
from that reboot. `REINDEX INDEX CONCURRENTLY` repaired it; the data behind it was intact
(855 documents, 15,857 chunks, all embedded) and semantic search returned sane hits afterwards.

Three things this teaches, in ascending order of cost:

1. **A corrupted vector index does not announce itself.** Postgres answered, the geniza connected,
   `check-geniza-fresh` was green — that gate asks whether documents are present at their current
   hash, not whether the index over them still works. The failure surfaced only because the full
   Python suite runs inside `check-meta`, and one acceptance test exercises the real query path.
   **A store that answers is not a store that answers correctly.**
2. **The agent proved it was pre-existing before repairing it** — `git stash`, reproduce, unstash.
   That is the difference between fixing a problem and adopting one. Without it the repair would
   have looked like a symptom of the change it interrupted.
3. **It was fixed rather than skipped.** `META_SKIP_GATE` was available and would have made the
   commit go through in seconds. Repairing the index took longer and left the project better.

**The gap this exposes:** nothing checks index health on a schedule. It belongs in the watchman
(the enforcement spec's layer 0) as a component with a real recovery action — `REINDEX
CONCURRENTLY` — verified the way every other recovery there is verified: by asking the component to
answer, not by watching the command exit 0.

**L63a · A report may not cite a file it did not open this session (2026-08-05, split 9.8.26).**
A final report may cite a repo file as justification only if that file was actually opened this session. A cited path absent from the session's read history blocks the report. Open the file while you quote it, not from memory of it.

**L63b · A citation that grants more than its source does — twice in two consecutive tasks
(2026-08-06).**

Two agents, two tasks, the same shape:

* A migration comment justified restating grants "for the same reason the geniza keeps
  `0005_revoke_create_from_mk_app.sql` separate". Measured: `0005` contains **0 GRANT** statements
  and 2 REVOKEs. The precedent is real; what it was cited for is the opposite of what it does.
* A task report justified using the superuser credential by quoting `infra/.env.example` — *"used
  ONLY by the container entrypoint for initialisation"* — and appending **"/ manual DBA use"**,
  three words the source does not contain.

Neither was a lie and neither caused damage. Both are the same failure: **the citation was written
from memory of what the source ought to say, and nobody re-read it before leaning on it.** Both were
caught by a reviewer who opened the cited file.

This matters here more than in most projects, because citation integrity is the product's own
subject: `docs/sources/baldwin-backbone.md` requires every `safe` value to trace to a cited primary
source, and §5.3 spent a whole task discovering that 62 of 103 thermal blocks carried an
attribution nobody had checked. **A team that lets its own internal citations drift has no standing
to promise that its safety citations do not.**

**The rule: quote, do not paraphrase, and open the file while you quote it.** If a justification
rests on what another file says, the quoted words must appear in that file verbatim — and if you
find yourself adding a clause to make the quote fit the argument, the argument is what is wrong.

**The judged half:** quote, do not paraphrase. The quoted words must appear verbatim in the cited file, and the file must actually say what it is cited for. If you find yourself adding a clause to make the quote fit the argument, the argument is what is wrong.

**L64a · A "landed" claim is checked against git, not against a search hit (2026-08-06, split 9.8.26).**
A claim that a named document landed or was committed is checked against git itself — `git show HEAD:<path>` plus a clean `git status --porcelain` for that path. A "landed" claim over a path git does not confirm is blocked. Presence in the geniza, a search hit, or a quote in a commit message is never landing evidence: the geniza ingests from DISK.

**L64b · "The geniza has it" is not "git has it" — and I read one as the other (2026-08-06).**

L62 and L63 were written, quoted in four commit messages, cited in dispatches to subagents, and
verified findable in the geniza by direct query. **Neither had ever been committed.** They existed
only in the working tree for most of a day.

**How it hid.** `check-geniza-fresh` ingests from DISK, deliberately — that is exactly what lets it
repair drift in a file that has changed but not been committed, and it did so repeatedly today,
reporting `stale: 0` each time. So a document can be fully present in the knowledge store and absent
from the repository simultaneously, and every signal I checked said "present".

**What caught it.** A test in the rules extractor that derives its expected lesson population FROM
the document at test time — written that way so it could not rot when L64 was added. It passed
locally against 63 lessons and failed in CI against 61, because the two checkouts were not the same
document. **A hardcoded expected list would have passed in both places and reported nothing.** The
test was not broken; it was doing precisely its job.

**The rule.** Presence in a derived store is never evidence of presence in the source. When the
question is "did this land", the answer comes from `git show HEAD:<path>` or from CI — never from a
projection that was built by reading the disk. And the corollary, which is the more useful half:
**prefer a test that derives its expectation from the artefact over one that pins a number**, because
only the first can notice that your artefact and everyone else's have diverged.

**The judged half:** prefer a test that derives its expectation from the artefact at test time over one that pins a number or a list — only the first can notice that your checkout and everyone else's have diverged.

**L65 · The right conclusion reached through an invented mechanism — and why the conclusion being
right is what makes it dangerous (2026-08-06).**

**What happened.** A gate (`check-pytest`) failed during Task 9 on a test unrelated to the change. The
implementer diagnosed it as an unrelated background `extract_graph.py` holding the geniza's singleton
advisory lock, and supported that with a specific claim: *"this is the one test in the file missing the
guard fixture."* The conclusion was correct — `rules_store` has no reference to `src.knowledge.worker`
at all. **The supporting claim was fabricated.** `tests/test_worker.py:55` declares the fixture
`autouse=True`; it applies to every test in the module and there is no opt-in list to be missing from.

**The real mechanism, which nobody had looked for.** The fixture is check-then-act: it probes
`pg_try_advisory_lock`, **releases the lock** (line 76), and only then does the test body try to take
it via `SingleWriter()`. A background process that grabs the lock in that window turns an intended
*skip* into a *failure* — and every test in the file is equally exposed. Now R-100.

**Why this is worse than a wrong answer.** A wrong conclusion gets challenged. A right conclusion
arrives with its explanation unexamined, because the thing you were checking — "is this my fault?" —
already reads as answered. The fabricated detail then survives into the record as fact. Here it very
nearly closed the incident on "transient, retried, green" and buried a real, reproducible test-infra
race that had already cost one gate run.

**The rule.** When an agent explains away a failure as unrelated, **verify the mechanism, not just the
verdict** — open the file and read the lines the explanation names. A diagnosis that lets you carry on
is exactly the one to check, and "the retry passed" is a symptom report, never a mechanism. The tell to
listen for is a *specific* code claim offered in support of a *convenient* conclusion.

**L66 · In PowerShell the pipeline IS the return value, and this plan has now been bitten by that
twice, in opposite directions (2026-08-06).**

**Two defects, one root.** In the watchman work:
- Task 21's real-run branch ended with `$results = @($hooksResult, ...)`. A bare assignment **emits
  nothing**, so the `else` branch of `$results = if ($SelfTest) {...} else {...}` produced `$null`.
  Every real run would have iterated an empty set and printed **WATCHMAN OK while checking zero
  components** — the exact failure the watchman exists to prevent, inside the watchman.
- Task 15's `Invoke-ComponentCheck` called `Write-Output` to narrate **and** `return $result`. Both go
  to the pipeline, so `$r = Invoke-ComponentCheck ...` captured a **two-element array**, not the object.

One rule emits too little, the other too much. Both come from the same fact: **a PowerShell function
returns everything that reaches the pipeline, and an assignment reaches nothing.**

**What made the second one survive its own test.** The Node self-test parsed the script's output with a
`startsWith('{')` filter, so the array-shaped lines were **silently discarded** and the run reported
3 of 5 passing rather than failing on the malformed output. **A test that drops what it cannot parse
reports a smaller number instead of an error**, and a smaller number reads as "not everything is
implemented yet". The defect hid inside the discard.

**The rule.** In PowerShell, treat every statement in a function as a potential return value. Narrate
from the caller, never from inside a function whose value someone captures. And in any harness that
parses another process's output: **an unparseable line is a failure, never a skip.** If the count is
allowed to shrink silently, the count is not evidence.

**L67 · Consistency with another artefact is not correctness — and two stale things agree perfectly
(2026-08-07).**

**L68 · הכלי, לא הנבדק — שבע פעמים בלילה אחד (8.8.26).** שבע פעמים במשמרת אחת דיווחתי או כמעט דיווחתי
על פגם בקוד, והדבר השבור היה **בדיקת האימות שלי**: ‏heredoc של bash אכל לוכסן וכמעט הכרזתי על
‏`archive_command` תקין כשבור · שם משתנה-סביבה שגוי גרם לכלל שקט להיראות רועש · ארגומנטים בצורה לא-נכונה
גרמו לבדיקת בידוד לעבור **בלי למדוד כלום** · הזרקתי אירועים ישירות ועקפתי את המסווג שאותו בדקתי ·
הצבעתי על שתי חנויות-מצב שונות · העברתי את התמליל האמיתי של הסשן לבדיקה שכל עניינה מה קורה **בלי**
הפעלת skill — פעמיים. **הרפלקס:** לפני שמדווחים על תקלה בנבדק, לאמת שהכלי מודד את מה שחושבים שהוא מודד —
בדיקה שעברה בלי לרשום כלום היא בדיוק כמו טענה שלא הורצה.

**L69 · תכונה שנשלחה אינרטית עוברת את כל בדיקותיה (8.8.26).** ‏`stop.mjs` טען את ספריית הכללים רק כאשר
משתנה-סביבה **של בדיקות** היה מוגדר; בייצור הכלל לא נטען כלל. ‏333 בדיקות ירוקות על תכונה שאינה עושה
דבר — **כי כל אחת מהן הגדירה את המשתנה.** ‏⚠️ זה גרוע מהיעדר תכונה, כי הכול מדווח שהיא קיימת.
**המבחן שנוסף:** לפחות בדיקה אחת חייבת להריץ את נקודת-הכניסה **בלי שום דריסת-סביבה** — אחרת הסוויטה
עיוורת בדיוק לשאלה "האם זה בכלל נטען".

**L70 · שער שנורה על המקרה הבריא נכבה תוך יום (8.8.26).** שלוש פעמים באותה משמרת: ‏`check-backup-fresh`
הכריז על ארכוב תקוע כשמדד גיל-קובץ במקום מה שתלוי ועומד · ‏`check-no-secrets` סימן הפניה למשתנה כאילו
הייתה סוד · וכלל טענות-ההצלחה היה חוסם 2 מכל 7 מהודעות אמיתיות שנשאו ראיה. **בכל שלושת המקרים התיקון
לא היה להקל אלא לדייק את המדד.** אזהרת-שווא אינה מטרד — היא מלמדת לעקוף את השער, וזה יקר מהפגם שהשער שמר עליו.

**L71 · שער עיוור מדווח ירוק, ולא בגלל ציות (8.8.26).** שני כללי הידע (§10.13, §10.17) בדקו
‏`tool_name === 'Grep'` — כלומר רק את הכלי הייעודי. **נמדד על משמרת שלמה: ‏105 קריאות grep דרך Bash,
‏0 דרך הכלי, ‏0 קריאות serena.** שניהם דיווחו ירוק כל הזמן. ⚠️ **"אין ממצאים" אינו "יש ציות"** — לפני
שסומכים על שער שקט, למדוד שהוא בכלל רואה את הנתיב הנפוץ. וההפך גם נכון: אחרי התיקון רק **0.5%** מאותן
קריאות מזהירות — הרוב היו חיפוש ממוקד בקובץ ידוע, שאינו חיפוש קורפוס כלל.

**L72 · מצב משותף בין שחקנים מקבילים חוסם את מי שלא חטא (8.8.26).** סוכנים משוגרים יורשים את
‏`session_id` של ההורה, ולכן כשלים של סוכן אחד חסמו עריכות של אחר — נצפה חי פעמיים. **ההפרדה חייבת להיות
לפי מונה ולא גורפת:** ‏§5 ברמת השחקן, ‏§10.16 ברמת ה-session; היקוף אחיד שובר את אחד מהם. **ושורות ישנות
הן החלטה ולא פרט:** לשייך אותן "לכל שחקן" משחזר את הפגם, למחוק אותן מאבד מונה חי.

**L73 · אל תצרפו עריכת תוכן לפקודת `git commit` באותה קריאת Bash (8.8.26).** פעמיים היום כתבתי לקובץ
המשמעת ואז הפקדתי — באותה פקודה. השער חסם את ההפקדה, ו**כל הקריאה לא רצתה כלל**: הכתיבה נעלמה יחד עם
ההפקדה. הסקתי בטעות ש"הכתיבה הצליחה והקומיט נכשל", וחיפשתי מנגנון שמחזיר קבצים — שאינו קיים.
‏**‏hook של PreToolUse חוסם את כל פקודת ה-Bash, לא את חלקה האחרון.** עריכה שתוכן אחר יסתמך עליה נכתבת
בקריאה נפרדת, ומאומתת מהדיסק לפני ההפקדה.

**L78 · שיפור הוראה בין שיגורים הוא שינוי-נוהל שקט (9.8.26).** בין מנה 2 למנה 3 של הסיווג הוספתי לתדריך המסווגות פסקה על כללים מורכבים — בדיוק ההכרעה שהקריטריון חסר, ובדיוק מה שהצהרתי שלא אעשה אחרי שהמדידה הסתיימה. **התוצאה:** ‏38 כללים סווגו לפי נוהל אחד ו-19 לפי נוהל אחר, בלי שאיש שינה מסמך. **הכשל אינו במסווגת ואינו בכלי — הוא בשיפור שנראה כמו אכפתיות.** הריצה נפסלה והורצה מחדש. **השער:** נוהל שנמדד ננעל בטקסט, והתדריך מצטט אותו — מי שרוצה לשנות, משנה את הנוהל ומודד מחדש.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 1, סבב תיקון-ביקורת — אין לקח תהליכי
חדש. הכשל היחיד היה ה-RED המצופה של `test_control_bytes_gate_does_not_report_a_pass_when_it_scanned_nothing`
(TDD כסדרו: הבדיקה נכתבה, הורצה, נכשלה על "‏CONTROL BYTES: none in 0 text file(s)." — בדיוק הממצא
שהביקורת ציינה — ואז תוקנה). זו לא הופעה חדשה: זו בדיוק סוג הבדיקה ש-L43a קיים כדי לתפוס (שער ששקט
כי לא הסתכל על כלום), ותפיסתה כאן היא ראיה שהתיקון עובד, לא כשל.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 1 (`check-control-bytes.mjs`) — אין לקח
תהליכי חדש. התדריך הצהיר "0 בייטי-בקרה מחוץ ל-`docs/vendor`, נמדד היום"; השער עצמו, כשהורץ על העץ
האמיתי, מצא 3 (קובץ מקור מצוטט במעקב עם artifact של חילוץ, ושני קבצי `.mjs` לא-במעקב תחת
`scratch/translate-bulk/` עם בייטי-NUL מכוונים). זה **לא כשל בשער או בבדיקה** — שניהם נבנו בדיוק
לפי המפרט ותפסו נכון מצב אמיתי שהתדריך תיאר לא-נכון; זו הפעלה תקינה של L20 (לוודא את המדידה לפני
שסומכים עליה), לא הופעה חדשה שלי. **חשוב:** דווח לבעלים כממצא בפני עצמו — קובץ המקור המצוטט רגיש
(ערכי בטיחות מתחקים למקור ראשוני) ואינו מתוקן חד-צדדית כאן.

**L82 · שער חדש שנבדק פעם ראשונה מול הסוויטה האמיתית הוא הבדיקה, לא הפורמליות (2026-08-09).**
משימה 2 של Arc 2 Phase 1 (`check-test-waits.mjs`, DoD-11/L15/L58) הניבה שלושה ממצאים אמיתיים בהרצה
הראשונה שלה, ואף אחד מהם לא נחזה מראש: **(1)** הרגקס `CANNOT_FAIL` שהתדריך עצמו נתן (`[^)]*`)
לא הצליח להתאים לדוגמה המפורשת של התדריך עצמו — `waitForFunction(() => x || true)` — כי `[^)]*`
נבלם ב-`)` הפנימי של `()` הריק שפותח את החץ, לפני שהגיע ל-`|| true`. תוקן על ידי חסימה על `;`
(סוף המשפט) במקום `)`. **(2)** השער החדש, שנבנה נאיבית כסריקת-תוכן, ירה על **חמישה** אזכורים
בתוך הערות `//` (טקסט שמסביר למה *אין* המתנה שרירותית) — בדיוק הכשל ש-L81a תיאר עבור שער אחר:
שער שיורה על פרוזה-על-הכלל במקום על הפרתו מלמד את הקורא לדלג על הפלט שלו. תוקן בהסרת הערות
לפני ההתאמה, תוך שמירה קפדנית על מספרי השורות המקוריים (הסרה על כל הקובץ הייתה מזיזה שורות
אחרי כל הערת-בלוק רב-שורתית). **(3)** ואז השער, כעת נכון, מצא **הפרה אמיתית בקוד חי**:
`tests/vg-classifier-wiring.spec.ts:53` — `waitForFunction(() => true)` — תבנית שמעולם לא יכולה
להיכשל, בדיוק ה-L58 שהשער נבנה כדי לתפוס, בבדיקה ששולחת שינויים כבר תקופה. **המסקנה:** "העתק
מהתדריך והרץ" אינו שקול ל-"אמת מול המציאות" — שער שמעולם לא רץ על 172 קובצי הבדיקה האמיתיים
לא נבדק, גם אם כל הבדיקות הממציאות שלו ירוקות. הרצה ראשונה מול הקורפוס האמיתי היא חלק חובה
מ-DoD-3/DoD-12, לא צעד אופציונלי אחרי שה"בדיקות" עברו.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 3 (`check-yaml-duplicate-keys.mjs`,
L61) — אין לקח תהליכי חדש. ה"כשל" היחיד שנרשם היה `mv` עם נתיב-זמני שגוי בבאש בזמן ניסיון RED
ידני (הקובץ לא נמצא בנתיב שהומצא); לא נגע ביישום או בבדיקה עצמם. אלגוריתם ה-item-reset של התדריך
אומת כפי שנמדד: אפס ממצאים על שלושת קבצי ה-YAML האמיתיים במעקב, ותפיסה נכונה של הכפילות המומצאת.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 3, סבב תיקון-ביקורת שני
(`check-yaml-duplicate-keys.mjs` — block-scalar, מפתחות במרכאות, פיקסצ'ה ל-item-reset) — אין לקח
תהליכי חדש הדורש שורת-לקח (עם קבוצה). תצפית תפעולית אחת, לתיעוד ולא לסיווג: הפיקסצ'ה שהביקורת
נתנה ל-RED (‏`run: |` עם `echo 'Status: ok'` / `echo 'Status: done'`) **עברה** גם על הקוד הישן —
ה-KEY regex מעוגן ב-`^` ודורש מילה+`:` מיד אחרי הרווחים המובילים, ו-`echo ` שובר את ההתאמה לפני
ה-`:` שבתוך המרכאות. אימתתי RED אמיתי בפיקסצ'ה מחמירה יותר (`Status: ok` בלי קידומת `echo `), שכן
נכשלה על הקוד הישן ועברה אחרי התיקון — ראה task-3-report.md לפרטים. ההגנה שנבנתה נכונה ותואמת
למפרט; אין כאן פער ביישום.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 4 (`check-python-invocation.mjs`/L59,
`check-python-utf8.mjs`/L74) — אין לקח **חדש** הדורש מספר-L וסיווג עצמאי; זו הפעלה חוזרת (שלישית
ברצף, אחרי L82 במשימה 2) של אותו עיקרון בדיוק: גרסה ראשונה של שער, מועתקת מילולית מהתדריך, נכשלה על
הריצה הראשונה שלה מול העץ האמיתי. **הפרטים, לתיעוד:** שני השערים תפסו את המילה `python`/כל תו לא-ASCII
**בכל מקום בקובץ** במקום **בתפקיד ספציפי** — פרוזה ב-JSON, הודעות `console.log`, פיקסצ'ות-בדיקה,
ותווים לא-ASCII בתוך docstring שמעולם לא הודפס. תוקנו בצמצום ההתאמה למיקום-פקודה בפועל (invocation)
ולארגומנט-הקריאה עצמו (utf8). שני ממצאים אמיתיים תוקנו במסגרת המשימה: `evals/playwright.config.ts:43`
(bare `python` ב-webServer, אותה מחלקה כמו L59) ושישה סקריפטים עם `print` לא-ASCII בלי הצהרת קידוד
(‏L74) — ראה `task-4-report.md` לפירוט המלא. אין כאן מנגנון-אכיפה חדש מעבר למה ש-L82 כבר קבע
("שער חדש חייב לרוץ מול העץ האמיתי לפני משלוח"); זו אימות נוסף של אותו כלל, לא כלל חדש.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 4, סבב תיקון-ביקורת — אין לקח **חדש**;
זו אותה משפחה בדיוק כמו ההצהרה שמעל, ולא תופעה נפרדת. הביקורת אישרה SPEC/QUALITY ומצאה ארבעה
ממצאים נוספים על אותו עיקרון (התאמה-מיקום ולא התאמה-מילה), כולם בתוך הגרסה המצומצמת עצמה, לא
תגלית חדשה על סוג הכשל: **(1)** `check-python-invocation` היה עדיין line-scoped על `command:` —
פקודה שנכתבת כ-template literal רב-שורתי (`command: \`\n  python build.py\n\`,`) חמקה כי המילה
נחתה בשורה הבאה. תוקן באותה טכניקת מעקב-בלוק שכבר קיימת ב-`scanWorkflow` (ספירת גרשיים הפוכים
זוגית/אי-זוגית פותחת/סוגרת בלוק). **(2)** `PRINTS_NON_ASCII` החריג `\n` מהתווים הנסרקים, כך שארגומנט
לא-ASCII הפרוש על יותר משורה אחת (הצורה האמיתית ב-`scripts/criterion_compare.py:58-59`, לא חי שם
רק כי הקובץ מצהיר קידוד לשני הזרמים בדרך אחרת) לא נתפס. תוקן בבחירת אופציה (a) — הסרת ההחרגה, חסום
טבעית על-ידי ה-`)` הקרוב ביותר, ללא בריחה בלתי-מוגבלת. **(3)** `DECLARES` לא הבחין בין stdout ל-stderr;
נוסף מנגנון stream-aware (זול מספיק) שקובע לאיזה זרם כל קריאה יעדה ודורש הצהרה לזרם הספציפי. **(4)**
תועד במפורש: איפוס-job ב-`scanWorkflow` בטוח **בכיוון ברירת-המחדל** (מאופס ל"סרוק"), לא כי הוא מבין
YAML אמיתי. אין כאן מנגנון-אכיפה חדש; כל ארבעת התיקונים הם המשך ישיר של אותו לקח (L82) שכבר תועד.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 5 (`check-powershell-output.mjs`/L66,
`check-ai-token-caps.mjs`/L24, `check-secret-alphabet.mjs`/L53, `check-test-file-size.mjs`/L30) —
אין לקח **חדש** הדורש מספר-L וסיווג עצמאי; זו הפעלה חוזרת (רביעית ברצף) של אותו עיקרון שכבר תועד
ב-L82/L59/L74: שער מועתק מילולית מהתדריך נכשל על הריצה הראשונה שלו מול העץ האמיתי, ומה שנמצא היה
אמיתי. **הפרטים, לתיעוד:** שני ממצאים אמיתיים תוקנו — `app.js:6273,6714` (`askValidateKey`,
`centralTest`) הם בדיקות-חיבור זעירות שמשליכות את התוצאה ולא נשאו את סימון `health-probe` שהחריג
של המדיניות דורש; נוסף inline. ‏`scripts/serena-server.ps1` נשא שני מופעים מהמחלקה של L66:
`Show-Status` הסתיים בהשמה חשופה ל-`$script:StatusOk` (מצב מכוון מחוץ-לצינור, לא ערך-החזרה אבוד —
`Show-Status` נקרא תמיד ריק, ראה שורת ה-`switch` הראשית), ו-`Start-Server` נשא `Write-Output`
לצד `return` באותה גוף-פונקציה (גם הוא נקרא תמיד ריק). שני התיקונים שימרו התנהגות: שורת-verdict
נוספה בסוף `Show-Status` (משפרת את הדיווח, לא רק מרצה את השער), ו-`Write-Output` הוחלף ל-`Write-Host`
לאורך `Start-Server` (נראה זהה למפעיל אינטראקטיבי, לא נלכד באף מקום). ‏`check-test-file-size.mjs`
עצמו חשף עובדה על התצורה, לא פגם: `playwright.config.ts` שלה `workers: process.env.CI ? 2 : 20` —
ביטוי, לא ליטרל — כך שהשער נופל-פתוח כמתועד בקוד עצמו ("an expression rather than a literal =>
null => fall open"), ומדווח "לא נבדק" במקום פלט נקי מזויף. פיקסצ'ת הבדיקה בתדריך עצמה חסרה
`playwright.config.ts` מקומי ב-`tmp_path`, ולכן לא יכלה לעולם לעבור כפי שנכתבה מילולית; נוסף
ליטרל מקומי (`workers: 2`) לפיקסצ'ה, ללא שינוי בלוגיקת השער. אין כאן מנגנון-אכיפה חדש; ראה
`task-5-report.md` לפירוט המלא.

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 3, סבב תיקון-ביקורת שלישי — אין לקח
**חדש**; זו הפעלה חוזרת של **L58** ("בדיקה שאינה יכולה להיכשל אינה בדיקה"), לא תופעה חדשה, ולכן
אינה דורשת שורת-לקח משלה. הבדיקה שהופקדה בפועל (`test_yaml_gate_ignores_colon_lines_inside_a_block_scalar`)
נשאה את הפיקסצ'ה עם קידומת `echo ` — זו שדיווחתי **בעצמי** כעוברת גם על הקוד הישן — במקום הפיקסצ'ה
המחמירה שאימתתי בפועל. תוקן: הפיקסצ'ה בבדיקה המופקדת הוחלפה לגרסה החשופה (`Status: ok` בלי `echo `),
עם אישוש RED מפורש מול עותק הקוד שקדם לתיקון (`git show 8201288:...` בנתיב זמני) — `exit 1`,
`"Status" at line 6 and again at line 7` — ואישוש GREEN מול הקוד לאחר התיקון. נוספה גם אסרציה על
`stdout` (לא רק קוד-יציאה) כאן ובבדיקת ה-item-reset, כדי שהבדיקה תבחין אם השער יעבור מסיבה שגויה
(כגון סריקת-אפס).

**No-lesson declaration (2026-08-09):** קשת 2 שלב 1 · משימה 6 (חיווט תשעת השערים ל-`check-meta.mjs`,
הוכחת חיות, מדידת עלות) — אין לקח **חדש**. תשעת השערים כבר נבנו ונבדקו במשימות 1–5; המשימה הזו היא
חיווט טהור, לא תגלית התנהגות חדשה. שני ממצאים תפעוליים, לתיעוד ולא לסיווג-לקח עצמאי: **(1)**
`check-rule-coverage.mjs` סרק רק את `scripts/hooks/{rules,stop-rules,observers}` ולא ראה כלל את
`scripts/check-*.mjs` — תוקן בחילוץ `scanDeclaringFile()` מתוך הלולאה הקיימת (ללא שינוי התנהגות שם)
והוספת לולאה שנייה שמדלגת על שערי-תשתית ללא `RULE_IDS` (כגון `check-meta`, `check-rules-mirror`),
כדי שהם לא ייפלו ל-`missingExportFiles` החוסם. **(2)** גילוי אגבי בזמן החיווט: `check-backup-fresh`
ו-`check-state-fresh` היו באדום מסיבות בלתי-תלויות בעבודה הזו (גיבוי בן 48.3 שעות; שורת-פנקס חסרה) —
טופלו בתיקון הישיר שכל אחד מהם שם (`backup-stores.ps1`; שורה בפנקס), לא בעקיפה. אין כאן מנגנון-אכיפה
חדש; ראה `task-6-report.md` לפירוט המלא.
**L81a · שער אכיפה אינו סורק מישור תוכן (2026-08-09).**
שער אכיפה סורק **קוד ותהליך** ולא **תוכן**. כל שער תחת `scripts/check-*.mjs` מחריג במפורש את נתיבי התוכן —
`docs/sources/`, `data.py`, `sources.py` — וההחרגה נראית בקובץ עצמו. שער שסורק מסמך-ראיות עלול לתקן אותו,
ולשנות בכך את הבסיס שערכי בטיחות מתחקים אליו.

**L81b · שער שמוצא פגם מחוץ לתחומו מדווח, לא מכריע (2026-08-09).**
שער `check-control-bytes`, שנבנה לאכוף כלל תהליכי, מצא 446 בייתי בקרה בטקסט מחולץ של **מקור ראשוני
מצוטט** — סימן המעלות שהומר לביית בקרה, כך שהקובץ קורא `61.5\x0eC/143\x0eF`. הבאתי את זה לבעלים
**כהחלטה שצריך לקבל עכשיו**, והוא תיקן: זה עולם התוכן, לא תשתית החוקים. **הכשל אינו במציאה —
הוא בהצמדת ההחלטה לקשת שאינה שלה.** קשת אכיפה שפותחת שאלת תוכן מרחיבה את עצמה בלי שאיש החליט
זאת, וזו הצורה השקטה של זחילת-היקף (§12, מעגל השליטה). מה שנמצא מחוץ לתחום **נרשם במרשם
ונשאר שם** עד שהקשת האחראית עליו נפתחת. ‏R-118 הוא הפריט הראשון תחת הכלל.

**L84 · A timestamp with no clock read behind it is an estimate wearing a fact's clothes (11.8.26).**
The controller wrote a clock time into a status report as fact, twice: "16:40" when the system
clock read 16:27, and the next morning "09:15" when it read 09:09. After the first slip the
controller promised, in writing, that every timestamp from then on would be read from the system —
the promise did not change the behavior, and the second slip landed the very next morning anyway.
The owner caught both. Every other standing rule in this project has a mechanism behind it —
`check-control-bytes` caught inserted control bytes, `L73` blocked a same-call content-edit+commit
three times, `verify-before-success-claim` blocked an unevidenced success claim twice. The
timestamp had no mechanism, which is exactly why the promise alone did not hold: a rule with no
gate behind it is a rule that depends on memory, and memory is not a substitute for a mechanism any
more than it is a substitute for re-reading a skill. **The gate:** `timestamp-without-clock-read.mjs`
(`stop`, `warn`) fires when the assistant's final reply carries a clock-shaped digit timestamp
(`HH:MM`, 24h) and no real clock read (`date` / PowerShell `Get-Date`, observed by
`scripts/hooks/observers/clock-tracker.mjs`) was recorded in the session within a recent window.
Fails open on a channel with zero recorded reads at all — an unwired/expired channel is not
evidence of an unread clock (L57), the same discipline `cited-path-read.mjs` (L63a) already applies
to its own file-read channel, deliberately reused here rather than duplicated (R-116). Reachable
alternative (§10.24): read the clock now, then report the real reading, or drop the timestamp.

**L83 · הוראה שאינה נותנת את המנגנון היא הוראה שלא ניתנה (10.8.26).**
שלושה מממשים בשלב 2 נעצרו באותה נקודה בדיוק: הריצו את סוויטת pytest המלאה, היא ארוכה מתקרת-הזמן
המשתמעת של כלי ה-Bash, הם דחפו אותה לרקע — ואיבדו את החוט. כל אחד סיים את העבודה בפועל אך לא
הפקיד, לא כתב דו"ח ולא סגר. **בתדריך של השלישי ההוראה הייתה מפורשת ובראש המסמך** — *"run in the
FOREGROUND, do not stall"* — והיא נכשלה בדיוק כמו קודמותיה. אמרתי **מה** ולא **איך**: הכלי לעקוף
את הקיר היה קיים כל הזמן (`timeout` עד 600000ms) ולא הופיע בשום תדריך. משפט אחד שהוסיף אותו סגר
את הבעיה. **הכלל:** הוראה תפעולית לסוכן כוללת את המנגנון שמאפשר לקיים אותה — את הדגל, הפרמטר או
הפקודה. "הרץ בחזית" אינו מנגנון; `timeout: 600000` הוא מנגנון. וכשהוראה נכשלת אצל **סוכנים שונים**,
החשד הראשון אינו המשמעת שלהם אלא שההוראה חסרה אמצעי ביצוע. זו אותה מחלקה כמו §10.24 (חסימה חייבת
לנקוב בחלופה נגישה), בכיוון ההפוך: הוראה חיובית בלי הדרך לבצעה — ואותה תוצאה.

**L79 · גלאי-דגימה לא יכול להבטיח היעדר (9.8.26).** ההופעה השישית של R-102 הייתה **כיס מקומי** בגרף ה-HNSW: שאילתה אחת מתוך חמש נפלה, בעוד 400 בדיקות-דגימה — זהות ונקודות-אמצע פרוסות על כל הקורפוס — עברו כולן. **המסקנה אינה "צריך יותר בדיקות"**, אלא שהבטחה מסוג "האינדקס תקין" אינה נגזרת מדגימה, ולכן הוסרה מהודעת הגלאי. מה שתפס בפועל הוא בדיקת קבלה ששואלת **בווקטור אמיתי מהמודל** — רק שאילתה אמיתית הולכת לאן ששאילתה אמיתית הולכת. זו L77 בלבוש של תשתית.

**L77 · בדיקה שמבטיחה יותר ממה שהיא יכולה היא ביטחון שווא (9.8.26).** בדיקת הבידוד טענה ש**שום
מזהה כלל אינו מופיע במנה** — אבל מזהים אמיתיים כוללים `0`, `7` ו-`12`, שמופיעים בתוך פרוזה רגילה
במקרה. הטענה אינה יכולה להתקיים על נתונים כנים, ולאכוף אותה היה מחייב לעוות את הטקסט שהמסווג
צריך לקרוא. ‏**המסקנה אינה "להחליש את הבדיקה" אלא "לטעון את מה שנכון":** עמודות-הסיווג נעדרות
**מוחלטת**, והיעדר-מזהה נטען רק על מזהים **מובחנים**. ‏⚠️ **ובדיקה שמבטיחה יתר גרועה מבדיקה צרה
ונכונה** — כי היא נותנת ביטחון שאין לו כיסוי, וזו אותה משפחה של L69.

**L75 · שער שנבנה כדי לתפוס משלוח אינרטי — נשלח בעצמו בלי הבדיקה שלו (8.8.26).** קובץ הבדיקות של
שער הכיסוי **מעולם לא הופקד**: הוא נשאר לא-במעקב, כלומר ‏`clone` חדש קיבל את השער **בלי שום הגנה
על עצמו**. נמצא רק בביקורת עצמאית, על ידי סוכן שלא בנה כלום מזה. ‏⚠️ **זו הפעם השלישית באותו יום**
שהצורה הזו מופיעה — וכאן היא הופיעה **בתוך הקשת שנבנתה כדי לתפוס אותה.** ‏**המסקנה המעשית:** אחרי
כל משימה, לוודא ש-`git status` אינו מציג קובץ בדיקות לא-במעקב. עבודה שאינה מופקדת אינה קיימת עבור
מי שיעשה clone מחר.

**L76 · שער שחוסם תחזוקה של עיצוב שכבר אושר (8.8.26).** כלל §6.4 חסם עריכה של המפרט **שהבעלים
אישר באותו בוקר** — כי ענף המפרטים דרש הפעלת `brainstorming` ולא קיבל "המפרט הזה מאושר במרשם"
כראיה. **לא הייתה דרך קדימה** מלבד להריץ שיחת-עיצוב על החלטה שכבר התקבלה. ‏**ההבחנה שנוספה:**
יצירת עיצוב חדש דורשת עיצוב; **תחזוקת עיצוב מאושר היא לא עבודה יוצרת לפניו.** מפרט שהוא עצמו
מאושר במרשם מכשיר את עריכת עצמו; מפרט לא-מאושר או חדש — עדיין נחסם.

**L74 · פלט לא-ASCII נכשל רק כשמפנים אותו — והטרמינל מסתיר את זה (8.8.26).** הודעת הסירוב היחידה
שנשאה ציטוט בעברית **קרסה** ב-`UnicodeEncodeError` במקום להידפס: ‏Windows נותן ל-stdout שאינו קונסולה
את דף-הקוד cp1252. המשתמש ראה traceback במקום הסיבה — והסיבה היא כל תכליתו של סירוב (§10.24).
‏⚠️ **שתי מסקנות, והשנייה חשובה יותר:** ‏(1) כל נקודת-כניסה שמדפיסה טקסט לא-אנגלי מגדירה `utf-8`
במפורש על `stdout`/`stderr` בשורותיה הראשונות. ‏(2) **בדיקה שאינה מריצה את ה-CLI כתת-תהליך אינה יכולה
לראות את זה בכלל** — לכידת הפלט של pytest אינה עוברת בדף-הקוד. זה L69 בלבוש אחר: מי שלא מריץ את
נקודת-הכניסה האמיתית אינו יודע אם היא עובדת. ‏**וגם המקף הארוך (—) נפל שם**, כלומר זו מחלקה ולא
הודעה בודדת.

**No-lesson declaration (2026-08-08):** קשת כיסוי-החוקים · משימה 1 (מיגרציה 0006) — אין לקח חדש.
הכשל היחיד במשמרת היה בדיקה שלי שניחשה שמות מפתחות ב-`.env` במקום להשתמש בבדיקה שכבר נכתבה; זו
הופעה נוספת של **L68** (הכלי, לא הנבדק) ולא לקח נפרד. ⚠️ **הערה למעקב, לא לקח:** שער §10.16 נורה
בכל הפקדה שקדם לה כשל כלשהו — גם כשל של בדיקה חד-פעמית. אם היחס בין הצהרות-אי-לקח ללקחים אמיתיים
ימשיך לגדול, זו עדות שהטריגר רחב מדי ויש למדוד אותו מחדש.

**No-lesson declaration (2026-08-08):** שלב 4 · משימה 12 (מעבר האינטגרציה) — מדידה טהורה ללא ממצא חדש.
העלות לא נסוגה (61ms לכל היותר, מול קו-בסיס ~50ms), אזהרות-השווא היו **אפס** על יום-עבודה מלא, וכל
נקודות-הכניסה נורו בייצור. הלקחים שהשלב כן ייצר כבר נכתבו — ‏L68 עד L73 — ולהוסיף שורה שביעית רק מפני
שהשער ביקש היה מדלל אותן.

**No-lesson declaration (2026-08-10):** קשת 2 שלב 2 · משימה 1 (ערוץ הראיות `file_read` —
`recentEvents()`, `read-tracker.mjs`, הרחבת ה-matcher של `PostToolUse` ל-`Read`) — אין לקח **חדש**.
זו הרחבה ישירה של תבנית ה-observer הקיימת (`edit-tracker.mjs`) לאירוע נוסף, ללא ארכיטקטורה חדשה
ו-RED/GREEN אושרו בפועל מול הקוד האמיתי (git stash + הזזת הקובץ הזמנית, לא רק הרצה תיאורטית).
עלות ה-Read שנמדדה (61.0ms ממוצע, 20 הרצות) תואמת בדיוק את התקציב המדוד כבר עבור `Bash`/`Edit`/
`Write` — אין חריגה חדשה לתעד. אימות-חי מתוך subagent מדובר בוצע בהצלחה (§3.4), כך שאין כאן גם
"לא ניתן לבצע מתוך subagent" לתעד כלקח.

**No-lesson declaration (2026-08-10):** תיקון CI אדום — `test_A7_installed_version_matches_the_recorded_pin`
נכשל ב-job ה-`discipline` (Linux) עם `FileNotFoundError: 'powershell'`, ותוקן ב-`skipif(sys.platform
!= "win32", ...)` עם נימוק שקורא לשם מה שאינו-לינוקסי בפועל (שירותי Windows ילידיים,
`Get-CimInstance Win32_Service`, משתנה-סביבה ברמת-מכונה). **הכותב חושב שזה כן ראוי ללקח מספרי —
ראו הערה בדוח.** הסיבה שלא כתבתי L חדש כאן: הדפוס (בדיקה שמניחה כלי-פלטפורמה בלי שער-פלטפורמה,
נשארת אדומה ימים בלי שאיש שם לב) חדש בפרטיו אך לא בסוגו — קרוב ל-L40 (פסק ירוק שאינו אומר מה לא
כוסה) ול-L54/§11a (שער שמדווח בלי לקרוא את המצב האמיתי); ‏`check-ci.mjs` (מ-R-94) כבר קיים בדיוק כדי
לתפוס את הפער הזה, והוא אכן תפס אותו כשהופעל ידנית כאן. ההכרעה אם זו הופעה חוזרת של לקח קיים או
לקח עצמאי (למשל: "בדיקת-תשתית שקוראת ל-כלי-פלטפורמה חייבת שער-פלטפורמה משלה, לא רק תלות ברשת
כמו `_require_stack`") שמורה לבעלים לסיווג.

**No-lesson declaration (2026-08-10):** קשת 2 שלב 2 · משימה 3 (`research-before-fix-cycle-3.mjs`
§10.14 + `research-evidence.mjs`) — אין לקח **חדש**. הקוד הייצורי (הפונקציה החדשה והכלל החדש) הועתק
מפסאודוקוד הבריף אחרי שנבדקו חתימותיהם האמיתיות של `openTargets`, `resolveActorTranscriptPath`
ו-`RETRIEVAL_PATTERN` מול המקור — והתאימו במדויק, ללא סטייה. מה שכן היה שגוי הוא **קיבוע הבדיקה
עצמה** בבריף: (1) כתיבת עדות התמליל ישירות בנתיב הראשי גם כש-`agent=` מועבר, במקום בקובץ ה-sidechain
ש-`resolveActorTranscriptPath` בפועל מפנה אליו; (2) חותמת זמן ברירת-מחדל מקובעת ל-`.000Z`, שמאבדת
דיוק מילישניות אמיתי מול `lastFailureTs` (הנגזר מ-`Date.now()`), וגורמת לכשל תזמון לא-דטרמיניסטי.
שני התיקונים תועדו בפני עצמם בקוד הבדיקה (התגובה שם מסבירה את שניהם) ואומתו ב-3 הרצות חוזרות ללא
תנודה. זו אותה תבנית שכבר תועדה במלואה ב-`progress.md` של קשת זו ("שלישית הפעם" — משימה 2) ו-בשתי
המשימות שקדמו לה: בריף שנכתב מזיכרון של API מייצר פגם שקט, בין אם בקוד הייצור ובין אם בקוד הבדיקה
עצמו. אין כאן סוג חדש של פגם — יש כאן את אותו הדפוס, שוב, במקום אחר בקובץ הבריף. הלקח המספרי הקיים
(אם וכאשר יירשם על בסיס שלוש-ארבע ההופעות המצטברות) שמור לבעלים.

**What happened.** Before dispatching the last ten tasks of the watchman plan, I had a pre-flight audit
read them against the real repository. It found three blockers and saved three review rounds. It also
marked Task 19 **clean**, with this reasoning: its `wsl -u root … service docker start` sequence "is a
verbatim match to the proven `scripts/run-extraction.ps1`."

That sentence is true and the conclusion was wrong. The geniza's PostgreSQL had moved off Docker to a
native Windows service the day before. `run-extraction.ps1` still started Docker — legitimately, for
Neo4j — so the two files agreed with each other while both were stale with respect to the machine. The
component shipped probing `docker exec mk-postgres`, a container holding a superseded copy of the
evidence store, and would have **reported the geniza healthy on the strength of a database nobody had
written to in a day.**

**What it exposed underneath.** Chasing it found the container still running beside the live service,
still declared in `infra/compose.yaml`, and therefore resurrected by every `docker compose up -d` —
including the one inside the extraction runner. Measured: the container held 853 documents frozen at
the migration; the native service held 855 and growing. Any document, script or agent naming
`mk-postgres` was reading a different database and would never be told.

**Why the audit could not have caught it as instructed.** I asked it to check that paths exist,
commands exist, interfaces line up, and tests are not vacuous. Every one of those questions is answered
**inside the repository**. Staleness against the world is not visible from inside the repository at
all — the repository is exactly where the stale copy lives.

**The rule.** When verifying a claim about infrastructure, the oracle is the **machine**, never another
file. `Get-Service`, `docker ps`, `Get-Command`, an actual connection — those are evidence. "It matches
the other script" is a statement about two texts. And when a check is asked to prove something about
the world, add the explicit question: *what would this look like if the world had changed and both
files had not?* Two artefacts that agree are not two witnesses; often they are one witness copied.

**Adopted win — attack the rule, do not assert it.** Every real defect in this arc was found by a
test that tried to BREAK a guarantee rather than confirm it. `mk_app` was asked to `CREATE TABLE`
and succeeded, revealing a grant that had had no user for weeks — a test that merely read the
grants would have reported what was there and called it correct. The canonical-id validator was
run over `git ls-files` and refused 32 real files; hand-picked examples all passed. The port
bindings were read from the **running containers** rather than from `compose.yaml`, because the
file states an intention and the daemon states the fact, and only one of them is what an attacker
meets.

**Adopted win — a test that passes on first run is void, and mutation is how you discharge that.**
Twenty-six gate tests passed immediately because the module was written first. Rather than trust
them, three mutations were applied — a label sneaked onto the allowlist, the provenance
requirement deleted, the confidence threshold neutered — and each killed the tests that name it.
Two minutes, and it converts "these pass" into "these can fail".

**Adopted win — check that a destructive step is destroying nothing.** Before `docker compose
down -v` removed three volumes, each was counted: `0 files`. The teardown was safe and it was
KNOWN to be safe, which is a different state from being lucky.

**L54 · A gate that accuses is worse than a gate that misses (2026-08-05).**

`check-pytest` blocked a commit reporting **"the Python suite is red"** while the suite was green —
42 passed. In the git hook's shell, `python` resolved to the Windows Store **app execution alias**,
a stub that prints "Python was not found" and exits non-zero; the gate read that exit code as a
test failure.

Not a false negative — a **false accusation**. A gate that misses a defect costs one defect. A gate
that invents one sends someone to debug a suite that never ran, and teaches everyone to wave it
through, which costs every defect it would ever have caught. The review panel's finding in another
costume.

Two rules follow, and both are now implemented rather than aspired to:

1. **A tool's absence and a tool's failure are different results and must never share an exit
   path.** The stub is now recognised for what it is; the interpreter is searched for in order
   (`python` → `py -3` → `python3`).
2. **A gate states what it ran against.** `check-pytest` now prints the interpreter it used, the
   way `check-requirements` prints which manifest a package was declared in. A gate that is green
   or red about an unnamed environment has told you nothing.

**Never fix this class by weakening the gate.** The tempting move was `META_SKIP_GATE=check-pytest`.
It would have worked, and the next person meets the same accusation with one fewer clue.

**L55a · A `--no-deps` pin that is not written down is blocked (2026-08-05, split 9.8.26).**
`pip install --no-deps` is blocked unless every package pin in the command appears in `requirements-overrides.txt` — the file whose entire subject is pins that contradict upstream, with the reason written beside each one.

**L55b · An exception that pip can silently undo is a coincidence, not a decision (2026-08-05).**

The owner ruled we run neo4j driver 6.2 against `llama-index-graph-stores-neo4j`'s declared
`neo4j<6`. The obvious implementation — `pip install --no-deps neo4j==6.2.0` — *works*, and is
worthless: pip has no override mechanism (`pip install -r` with both pins returns
`ResolutionImpossible`, verified), so the very next ordinary `pip install -r requirements.txt`
re-resolves the driver back to 5.x **without printing anything**. The decision would have quietly
expired, and the first symptom would have been a Windows socket bug nobody could reproduce.

The shape that holds, and it generalises to any deliberate exception:

| | |
|---|---|
| **Declare it separately** | `requirements-overrides.txt` — a file whose whole subject is "pins that contradict upstream", with the reason for each written beside it |
| **Test that it is in force** | a test that fails when the environment reverts, carrying the fix command in its message |
| **Test that it is still needed** | a test that fails when upstream relaxes the constraint — so the workaround **cannot outlive its reason** |
| **Leave the cost visible** | `pip check` now reports the conflict. Documented as expected, never suppressed: a silenced warning is how a deliberate exception becomes folklore |

**Adopted win — the owner corrected a real reasoning defect, and it is worth keeping.** I
recommended against the upgrade on the grounds that it bought nothing, having measured *functional
parity* — the same round-trip passed under both drivers. The owner's answer: *"תמיד השיקול הוא גם
ביצועים ותיקוני באגים לא דווקא רק תמיכה לאחור."* Correct, and my test could not have seen either.
The changelog then showed a `Result` iteration speed-up, two connection-timeout fixes, and **two
fixes specific to Windows** — the platform we develop on. **"I tested it and nothing changed" is
only evidence about the axis you tested.** Before concluding a version brings nothing, read what it
claims to bring.

**The judged half:** every deliberate exception carries all four parts — declared separately, tested to be in force, tested to be still needed, and its cost left visible. And "I tested it and nothing changed" is evidence only about the axis you tested: before concluding a version brings nothing, read what it claims to bring.

**No-lesson declaration (2026-08-10):** git-env-leak test-infra fix (arc2 phase2, out-of-band task) —
no new lesson recorded here as a numbered `L<n>`. The dispatching agent's own assessment is that this
IS lesson-worthy (a test whose isolation silently evaporates is the same family as "a check that cannot
fail" — L58/L61's pattern, one level down: not a gate with a dead condition, but a *fixture* with a dead
guarantee), but a new numbered lesson needs an owner-approved classification rather than a subagent's
own judgment mid-task. Filed as a no-lesson declaration per the escape hatch, with the recommendation
surfaced explicitly in this task's report
(`.superpowers/sdd/2026-08-10-arc2-phase2-edit-write/git-env-leak-fix-report.md`) for the owner to
promote to `L<n>` if agreed. The defect itself: `git init`/`git add`/`git commit`/`git diff`/`git
ls-files` inside a `tmp_path` "isolated" repo inherit `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_WORK_TREE` from
the parent process; under the pre-commit hook that makes the tmp repo silently operate on the REAL
repo's index and history instead (measured twice: 908 files where 0 were expected in
`test_control_bytes_gate_does_not_report_a_pass_when_it_scanned_nothing`, and a real commit — since
reverted — landing in this repo's own history during this task's own red/green reproduction, the
sharpest possible demonstration of the defect's severity). Fixed at the class level: a `git_env()` /
`gitEnv()` helper stripping every `GIT_*` variable, added to and used by all five call sites that build
a git repo in a temp directory across `tests/` and `scripts/tests/`, plus one in-process case
(`scripts/tests/test-hooks-groupb.mjs`'s `withRuleEnv`, where the rule under test shells out to `git`
with no `env:` override of its own, so the env must be stripped on the test process itself for the
duration of the call). A new pinning test
(`test_git_env_keeps_a_tmp_repo_isolated_even_when_GIT_DIR_points_at_the_real_repo`) proves the guard
holds even with `GIT_DIR` deliberately pointed at this real repo.

**No-lesson declaration (2026-08-10):** arc2 phase2 task 4 (`one-pipeline.mjs` — rules `12.1` + `2`,
and the `check-plan-complete.mjs` refactor) — no new numbered lesson. This task's own real-tree scan
(the brief's third, unmeasured item) found that 11 of 34 tracked plans under `docs/superpowers/plans/`
already fail the pre-existing `check-plan-complete.mjs` CLI gate (exit 1), unrelated to this task —
they predate or otherwise bypass a gate that has existed since L27. That is a real, reportable finding
(see task-4-report.md), but it is a coverage gap in an EXISTING gate, not a new failure mode this task
discovered the shape of — the same family L27 already names, not a new one. Also found and fixed
in-flight, before it shipped: the 12.1 `docs/vendor/**` exemption as literally specified in the brief
used a substring test (`np.includes('/docs/vendor/')`) that silently mis-scopes on a bare relative
path (no leading slash) — corrected to a segment-based check before commit, verified against the real
tree both ways. Recommend the owner classify the 11-plan finding for a possible `L<n>` if it is judged
lesson-worthy at the programme level (e.g. "a completeness gate with no write-time enforcement quietly
accumulates a large exempt population before anyone measures it").

**No-lesson declaration (2026-08-10):** arc2 phase3 task 1 (`bash-segments.mjs` command-position
helpers + `no-concurrent-suite-run.mjs` refactor) — no new numbered lesson. The one pytest failure
recorded this session (`test_every_phase2_rule_is_declared_and_counted`) was investigated via
`systematic-debugging` and is unrelated to this task: it traces to `R-118` in an untracked file
(`scripts/check-rule-provenance.mjs`) having no matching row in the rules mirror — a pre-existing
Phase 2 rule-coverage/provenance gap this task never touched (confirmed by `git status --porcelain`
showing the file as `??`, and it is not among Task 1's three changed files). Not this task's failure
mode to name a lesson for; flagged in task-1-report.md for whoever owns that gate instead.

**No-lesson declaration (2026-08-10):** arc2 phase3 task 2 (`replay-bash-corpus.mjs` + `--dump` +
corpus-replay pytest harness) — no new numbered lesson. The 2 recorded failures this session were
both the same environmental non-bug: `node scripts/check-meta.mjs` legitimately runs longer than
the Bash tool's 120s default timeout (`build-audit` alone parses 25k+ transcript entries). The
first invocation auto-backgrounded and later reported exit 0 with findings unrelated to this task
(4 pre-existing release-commit DoD gaps, none touching Task 2's files); the second invocation, run
without an explicit `timeout:600000`, hit the same 120s default and was killed (exit 143) — a
duplicate call, not a new failure mode. Root cause investigated via `systematic-debugging` before
retrying the blocked edit; already covered by the general "pass `timeout: 600000` for long
commands" instruction, so no new lesson line — a repeat of a known tool-usage gap, not a discovery.

**No-lesson declaration (2026-08-11):** arc2 phase4 task 9 (`tests/test_arc2_phase4_wiring.py` —
coverage + no-override liveness + overhead + closure) — no new numbered lesson. The 1 recorded
failure this session was `node scripts/tests/test-hooks-groupb.mjs` returning exit 1 on its first
run (439/443: the 2 documented pre-existing date-boundary fixtures plus 2 unexpected failures — a
concurrency test and a fix-cycle timing test). Investigated via `systematic-debugging`: this task's
diff touches only a new, unrelated test file and a refreshed corpus dump — neither read by
`test-hooks-groupb.mjs` — so nothing in this task could have caused it. An immediate rerun with zero
further changes reproduced the documented baseline exactly (441/443), consistent with the two extra
failures being timing/contention-sensitive tests reacting to momentary machine load, a known
category per §11a, not a new bug this task introduced. Flagged as a Concern in task-9-report.md for
whoever owns that suite next, not chased to root cause here (out of this task's scope).

