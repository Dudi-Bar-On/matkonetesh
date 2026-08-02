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

## 12. Thinking models — adopted from the graphify global `methodology` corpus (2026-07-22)

**Where this came from.** The owner asked whether the global graph's `methodology` corpus (4,335 nodes)
held anything worth adopting. It holds the **GSD** framework from the `matkonet` project, whose thinking
models are curated from the [thinking-partner](https://github.com/mattnowdev/thinking-partner) catalog
(150+ models). **Fifteen models across three clusters are adopted below. The rest is deliberately not.**

**How to read it yourself:**
```bash
export PATH="$HOME/.local/bin:$PATH"
G="$HOME/.graphify/global-graph.json"
graphify god-nodes --graph "$G" --top 30                      # what the corpus is about
graphify explain "Thinking Models: Planning Cluster" --graph "$G"
graphify explain "Thinking Models: Execution Cluster" --graph "$G"
graphify explain "Thinking Models: Debug Cluster" --graph "$G"
graphify explain "Gate Prompt Patterns" --graph "$G"
graphify query "premortem mece constraint reversibility fault tree hypothesis occam chesterton" --graph "$G"
```
The graph gives structure and labels; the prose lives in
`C:\Users\dudib\source\repos\matkonet\.claude\gsd-core\references\thinking-models-{planning,execution,debug}.md`
and `gate-prompts.md`. **That path is another local repo and may vanish — the graph is the durable
record.** Per §10.13, the graph located the material; the source files were then read before adopting it.

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

**L23 · A proxy metric is not the screen: "99% translated" shipped half-English screens (v267, 2026-07-26).**
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

**L28 · 2026-07-30 · שחיקת כללי-כלים תחת קונטקסט ארוך — הבעלים תפס נטישה של serena/graphify לטובת grep ("אם אתה לא עושה — סימן שנמחקו לך הכללים").**
הכלל, מעכשיו קבוע:
1. כל עבודת קוד — קריאה ועריכה — דרך **serena** (find_symbol / find_referencing_symbols / get_symbols_overview / replace_symbol_body). לא רק חיפושים — העבודה עצמה.
2. כל שאלת מסמכים/קשרים/provenance — **שאילתת graphify** (`query`/`path`/`explain`) לפני grep; grep = fallback מוצהר בלבד.
3. **תמיד `graphify --help`** (ו-`initial_instructions` של serena) לפני שימוש — לנצל יכולות במלואן (`graphify watch` ישב ב-help כל הזמן ולא נוצל).
4. עדכון גרף רציף: `graphify watch` לקוד; docs ברענון `--mode deep` תקופתי, נאכף ע"י `scripts/check-graph-fresh.mjs`.
5. **מטא-כלל:** אם מזהים שהכללים האלה לא מיושמים — זה עצמו האות שהקונטקסט נשחק; עוצרים ומריצים מחדש את `docs/process/checklists/session-start.md`, לא ממשיכים.

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

**L31 · Agents left waiting on a background suite run burn real time for no signal (2026-07-31).**
Across three tasks this session, subagents polled a backgrounded full-suite run and reported "still
waiting" repeatedly, costing roughly an hour combined with nothing to show for it. The cure was already
adopted in §11a — the controller owns the full-suite gate, not a dispatched subagent — but it was not
applied consistently this session. Gate: never hand a subagent a background suite run to wait on; the
controller runs it (or waits on it) directly and hands the subagent a verdict, not a polling loop.

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

**L36 · "Target page, context or browser has been closed" almost always means timeout, not a crash
(2026-08-01).** When a test times out with a `waitForFunction` pending, teardown closes the page and the
pending wait reports the closure — the symptom, not the cause. Two separate investigations lost hours
hunting a browser crash that never happened. Gate: read it as "the condition never became true", and use
the one-minute discriminator — **run the test alone**. Load contention vanishes in isolation; a real defect
does not. That single step separated a flake from a genuine product regression in under a minute the same
day.

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

**L43 · Identical-looking code behaved differently — an invisible control byte (2026-08-01).**
A small tool's row-matching regex silently matched **zero** rows on every run. Re-reading the source
showed a correct pattern. Re-typing that same pattern in a scratch script and running it against the same
input **worked**. The contradiction was the clue: the file carried a literal **U+0008 backspace** inside
the regex, immediately after a literal word — invisible in every editor and diff, and impossible for the
pattern to ever match, since no real text contains that byte. Almost certainly injected by one of my own
scripted edits (`sed`/`python` rewriting a line).

Two gates come out of it:
1. **When code that looks identical behaves differently, compare BYTES, not glyphs.** A `charCodeAt` scan
   found it in seconds; four rounds of reading the source found nothing. Reading cannot see what is not
   rendered.
2. **Scripted edits to source are a source of corruption, not just of speed.** Prefer an editing tool that
   matches on exact strings over regex line-rewriting for code, and when a scripted edit is the right
   choice, verify the result **by running it**, not by grepping that the new text is present — the grep
   passed here the whole time.

A related trap, same day: a fix aimed at a *different real defect* in the same function made it look like
"the fix didn't work", when in fact it fixed what it targeted and never touched this. **Two defects in one
function look exactly like one unfixed defect.**

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

### 10.11 Query graphify GLOBAL before the internet — for ANY docs/help — then feed useful finds back
> **Owner instruction, 2026-07-22; generalized to all documentation/help 2026-07-23.** When you need
> documentation or any external help/reference — a tool, a framework, a methodology, an API's capabilities,
> a vendor's model specs, *anything* — query the graphify **global** graph FIRST. Only if the answer is not
> there, search or research the web. After a web find, apply the **usefulness gate** (below) before moving on.
> (The Google/Gemini model-capability docs were the example that prompted this; the rule is general.)

**How.** The graphify CLI lives at `~/.local/bin/graphify`; the global graph is `~/.graphify/global-graph.json`
(~6.8 MB, two merged corpora per `global-manifest.json`: `vendor-docs` 2,435 nodes and `methodology`
4,335 nodes). It currently holds **playwright-docs, vitest-docs, superpowers-docs, bmad-docs, serena-docs**
plus methodology artifacts (Phase Prompt Template, Gate Prompt Patterns, Model Profiles).

```bash
export PATH="$HOME/.local/bin:$PATH"
G="$HOME/.graphify/global-graph.json"
graphify god-nodes --graph "$G" --top 25          # what the corpus is actually about
graphify query "<expanded tokens>" --graph "$G" --budget 1500
graphify query "<expanded tokens>" --graph "$G" --dfs      # trace a specific chain
graphify explain "<node>" --graph "$G"
graphify path "A" "B" --graph "$G"
```

**LOCAL vs GLOBAL.** Local = this project's own graph at `graphify-out/graph.json` (the default when
`--graph` is omitted) — use it for questions about *our* docs and code. Global = the pre-built tool and
methodology corpora above — use it for questions about *how a tool works*.

**The non-optional step (learned by doing it wrong).** graphify matches node labels by case-folded
substring + IDF: **no stemming, no synonyms, no cross-language matching.** A naive natural-language query
returns noise — my first global query pulled 113 nodes including an eslint command and unrelated workflow
files. Before traversing you MUST expand the question against the graph's own vocabulary and pick only
tokens that actually exist in it (`references/query.md`, Step 0). If no vocabulary token matches, say the
corpus has no relevant vocabulary and stop — **never invent tokens to force a hit.** This matters doubly
here because our corpus is bilingual: a Hebrew query will not match English labels.

**The feedback loop — a miss is a task, and a useful find is a deposit (owner instruction, 2026-07-22;
the usefulness gate added 2026-07-23).** When the global graph does not hold what you need, search or
research the web. Once you have the helpful source, ask ONE question: **"Is this source useful, and likely
to be needed again — here or on another project sharing the global graph?"** If **yes**, you are instructed
to **download the documentation and add it to the graphify global corpus** (as a `…-docs` tag, which merges
into the shared `vendor-docs`/vendors family) so the next session — in THIS workspace or any other that
shares `~/.graphify/global-graph.json` — never repeats the search. If it is a genuine one-off (a stale blog,
a question you will not ask again), skip the deposit and say so. The gate keeps the corpus growing with
signal instead of noise, and lets one project's research pay off for every project that shares the global.

```bash
export PATH="$HOME/.local/bin:$PATH"
# 1. Bring the docs in locally (a folder of pages, or fetch them into ./raw)
graphify add <url>                                # fetches a URL into ./raw and graphs it
#    ...or graph a folder of downloaded docs:  /graphify <folder> --mode deep
# 2. Publish that graph into the global corpus under a clear tag
graphify global add <path-to-graph.json> --as <tool-name>-docs
graphify global list                              # verify it landed
```

`graphify global list` / `global remove <tag>` / `global path` manage the corpus. Tag by what the docs
*are* (`playwright-docs`, `cloudflare-workers-docs`), matching the existing convention — the global graph
currently merges two corpora, `vendor-docs` (2,435 nodes) and `methodology` (4,335 nodes).

**Honest limit to state when you do this:** the global graph is a *shared, cross-project* resource. Only
add documentation of general value — a vendor's API docs, a framework's guide. Never add this project's
private documents, and never add anything containing a key or a secret.

### 10.13 Reach for the graph BEFORE grepping — it is the evidence tool, not a curiosity
> **Owner instruction, 2026-07-22.** Always try the semantic graphs first when looking for evidence and
> references across code and documents. And keep them updated — always.

The **local** graph (`graphify-out/graph.json`) now spans the documentation *and* the code, so a question
like "what specifies this function", "what tests prove it", "where else is this value consumed", or "does
anything actually read this" is a graph query rather than a grep. Use `graphify query`, `graphify path`
(shortest path between two concepts), and `graphify explain` (a node and its neighbours).

**Why this is a discipline rule and not a preference.** The 2026-07-22 sweep refuted **42 of 261
findings — 16%** — and every refutation shared one shape: *a grep, a quote, or one artifact trusted
without tracing what the program actually executes.* A grep finds a string. The graph holds the
relationship — which is what the claim was actually about. `equipPlan` was described in a document and
implemented in `app.js`, and for months nothing connected the two; the graph now does.

**But it is a lead, not a verdict.** The graph carries `INFERRED` and `AMBIGUOUS` edges by design (deep
mode is aggressive on purpose). An edge is a place to look, and the claim is confirmed against the source
— §10.13 does not repeal L16 or the runtime-path skill. Query first to find the evidence; read the file
before asserting it.

**Keeping it current is the other half.** A stale graph is worse than no graph, because it is trusted and
wrong. See §10.12 — every document change, always `--mode deep`. Note the two defaults that trip in
opposite directions: `graphify update` is the code/AST path ("no LLM needed") and re-extracts **no**
documents, while a **pure-code corpus skips semantic extraction entirely** and gets AST only. Overriding
either is a deliberate choice to state out loud.

### 10.14 When it's complex or the iterations aren't converging — RESEARCH, don't guess
> **Owner instruction, 2026-07-23.** When a problem is genuinely complex, OR after a few iterations that
> did not solve it, STOP guessing and do **deep research**: read *in detail* the official documentation,
> help, and the blogs / forums / issue trackers of **every product, technology, and adjacent subject
> involved**. §10.11 applies (query the graphify **global** graph first — it holds `playwright-docs`,
> `vitest-docs`, etc. — then the web; deposit useful finds back per the usefulness gate). Only *then*
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
> the graphify global knowledgebase** so the next session — on any project sharing the global — starts
> ahead. Untracked lessons get relearned at full price; undeposited finds get re-searched at full price.

**Mechanical enforcement (Phase 0, 2026-07-30):** `scripts/gate-lessons.mjs` (inside `check-meta.mjs`)
blocks a `release(v` commit when releases exist after the newest §11 lesson/declaration date, and the
arc-close checklist (`docs/process/checklists/arc-close.md`) makes the lessons+deposit pass a gated step.
The §11 log froze at L22 while five paid-for lessons lived only in private memory (audit §9) — never again.

The mechanics already exist — this rule makes them a *closing checklist*, not a when-remembered habit:
lessons → §11 log (numbered `L`-entries for failures, an "adopted wins" note for successes; owner-behavior
feedback also goes to the assistant's persistent memory); docs → `graphify add <url>` →
`graphify global add <graph.json> --as <name>-docs` → verify with `graphify global list`. Research
subagents are told to *list* deposit candidates; the controller owns running the deposit pass before the
arc closes.

### 10.17 Maximize the use of Serena for code work — and learn it from its docs first
> **Owner instruction, 2026-07-24.** Whenever possible, maximize the use of **Serena** (the LSP-backed
> semantic code toolkit, live as this project's `serena` MCP server). Read its documentation **carefully**
> to learn how to best use it — it is in the graphify **global** knowledgebase (`serena-docs` corpus), and
> Serena's own `initial_instructions` tool serves its usage manual (its MCP server says to call it before
> coding tasks — do).

**When Serena is the right tool (the adopted division of labor — `docs/process/serena-adoption.md`):**
symbol-shaped code work on live sources — *find this function* (`find_symbol`), *who calls/reads this*
(`find_referencing_symbols`), *map this file's structure* (`get_symbols_overview`), *edit exactly this
symbol* (`replace_symbol_body` / `insert_after_symbol`), *rename safely* (`rename_symbol`) — is Serena's
home turf, and on a ~9.5k-line `app.js` a surgical symbol edit beats a fragile text-match edit. The split
stands: **Serena** = live locate-exact/edit-exact (always fresh, LSP-accurate) · **graphify** = cross-doc
provenance, spec↔code↔test relationships, vendor docs · **grep** = fallback for literal/non-code text.
Dispatch prompts for code-editing subagents should point them at Serena's tools where the task is
symbol-shaped. Learning it is not optional polish: query `serena-docs` in the global graph (§10.11
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

### 10.12 Keep the LOCAL graphify graph current — update it whenever documents change
> **Owner instruction, 2026-07-22.** Update the local graphify graph whenever a document is added or
> changed. Update it as part of committing and pushing — and sooner than that where practical.

**The catch that makes this a rule rather than a hook.** graphify's own post-commit hook
(`graphify hook install`) re-extracts **code** files only — its documentation states plainly that
"doc/image changes are ignored by the hook". Our graph is a **documentation** graph, so the hook would
leave it silently stale, which is worse than having no graph: a stale map is trusted and wrong.

**What to do — always with `--mode deep` (owner standing instruction, 2026-07-22):**
```
/graphify docs --update --mode deep      # incremental, LLM semantic re-extraction, aggressive INFERRED edges
```

**⚠️ Two silent-corruption hazards proven on 2026-07-24 — read before any refresh**
(full evidence in `docs/process/graphify-improvements.md`, "PASS 3"):
1. **Run the `claude-cli` extraction backend from a NEUTRAL cwd, with absolute paths.** The backend
   inherits the parent's working directory, so a nested `claude -p` started inside this repo **loads
   `CLAUDE.md` and stops being an extractor**: measured, 3 of 3 dispatched documents produced **0 nodes**
   while **60 nodes were invented for unrelated repo files** (`CLAUDE.md`, `build.py`, `app.js`, the SDD
   ledger). It fails by producing confident, plausible, wrong output — never by erroring.
2. **A document edited WHILE a refresh runs is hidden from every future incremental, permanently.** The
   manifest stamps the hash at *save* time, not *extraction* time, so the edit is recorded as already
   extracted. §10.17a went missing this way and was found only by noticing the node did not exist. After
   any long refresh, diff `git log --since=<run start> --name-only -- docs/` against the manifest and
   force re-extract anything that overlapped the run.

**Do NOT use the bare CLI for documents.** `graphify update <path>` is the CODE path — its own help says
"no LLM needed", so on a documentation corpus it re-extracts nothing semantic while appearing to succeed.
Documents require the skill-driven flow above, which checks `code_only` and routes non-code changes through
LLM extraction. `scripts/sync-docs.sh` therefore does not attempt the doc update itself; it detects that
documents changed and tells you to run the skill flow, rather than reporting a success it did not achieve.

**Deep mode costs more and must be chunked harder.** `--mode deep` sets DEEP_MODE in the extraction prompt
("be aggressive with INFERRED edges — indirect deps"), so each chunk emits materially more JSON. graphify's
default chunking is by FILE COUNT (`ceil(files / 22)`), which assumes files of ordinary size. This corpus
averages ~5,900 words per document and ranges from 63 to 1,276 lines, so a 22-file chunk can be 5k or 60k
words depending on which files land in it. That is what killed the first build: chunk 3 held 22 dense
research and orchestrator specs and its extraction agent hit its own output-token cap, so the chunk file was
never written. **Chunk by WORD BUDGET, not file count** — roughly 12k words per chunk under deep mode.

- **Sooner is better.** After writing or substantially editing a document — especially an analysis,
  spec, plan or sweep report — update the graph then, not later.
- **At minimum, before `git push`.** A push that adds or changes documents must be accompanied by a graph
  update in the same working session.
- **`graphify-out/` is generated** — keep it out of git except `GRAPH_REPORT.md`, which is the
  plain-language map worth versioning.
- Optional: `graphify hook install` still earns its place for code changes, and
  `graphify claude install` writes an always-on section into `CLAUDE.md`. Neither removes the need for
  the manual doc update above.

**Use the one command.** `scripts/sync-docs.sh "commit message"` does all three steps in order —
graphify update, stage documents (plus a copy of `GRAPH_REPORT.md` into `docs/analysis/graph/`), commit and
push. Use it instead of remembering three separate steps. It warns loudly when the graph could not be
updated, because a silent stale graph is the failure this rule exists to prevent.

**Mechanical enforcement (Phase 0, 2026-07-30):** `scripts/check-graph-fresh.mjs` compares every
`docs/**/*.md` mtime against the `graphify-out/graph.json` build stamp and fails on any stale doc.
`sync-docs.sh` runs it before any docs push and refuses to ship a stale graph (loud override:
`SYNC_ALLOW_STALE=1`); it also runs inside `node scripts/check-meta.mjs` (session start · release ·
every Phase gate and arc close). This rule previously relied on remembering — it drifted 53 documents
behind within five days (audit §10).

**`graphify watch` — the CODE-graph daemon (documented 2026-07-30, per L28).** `graphify watch <path>`
rebuilds the CODE graph continuously as files change — this is the daemon that answers the owner's
"עדכון שוטף" instruction for code. It does **not** cover semantic doc extraction: documents still need the
periodic `--mode deep` refresh above, gated by `scripts/check-graph-fresh.mjs`. Deliberate choice, stated
explicitly: start it **per work-session on the repo**, not as a system service.

**Honest note on how this rule came to be written properly (2026-07-22).** The rule was added, and then six
agent reports were committed and pushed WITHOUT ever updating the graph — the owner had to point out that
he could not see it happening. Writing a rule is not the same as having a mechanism. Hence the script.

**Why it matters here.** This project accumulated ~40 documents and ~12,000 lines of specification that
were never reconciled; four outright contradictions and an entire unbuilt orchestrator specification were
found only by exhaustive auditing. The graph exists to make that visible continuously instead of
retrospectively — which only holds if it is current.

---

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
the H9 5-row summary table**, and (e) a "primary tool" field: serena for symbol work, graphify for
docs/relationship questions, grep only as a declared fallback. A missing field = an invalid brief.
**Build it with `node scripts/make-brief.mjs --plan <plan> --task <N> --out <brief> --spec "<quoted spec
lines>" --tool <serena|graphify|אחר>`** — it derives (b)(c)(d)(f) and the plan's Global Constraints, and
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


### L45 — a green test is not evidence until you know which mechanism made it green (2026-08-02)

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
