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

---

## 3. The DoD gate (the core of this proposal)

A task is **not done** until every box is checked with evidence pasted in. This runs before the ledger entry, per task, and again per phase.

### Per-task DoD checklist

- [ ] **1 · Spec requirement traced.** The exact spec line(s) this task satisfies, quoted. If none → the task should not exist.
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
- [ ] **12 · Full suite green (once).** Run `npx playwright test` (config pins the reliable worker count + retries 0 — currently 6 workers, ~145s; see §11a). Output pasted. **Run once; if 100% green, the gate is met** (owner decision 2026-07-21, superseding ×2 — the clustered server made the suite fast and deterministic, so a second run adds cost without information). Any failure — including an intermittent one — is treated as a **bug**, debugged via `systematic-debugging`, **never** re-run to make it pass. Never pass `--retries` or `--workers=1`: retries mask flakes, `--workers=1` is the old 13-min serial path.

### Per-phase DoD gate

- [ ] Every DoD line in the governing spec's "Definition of Done" section quoted and marked MET, with the evidence
- [ ] Any line **not** met → phase is not complete; escalate to owner (see §4)
- [ ] Independent conformance re-audit by a fresh agent against the spec, not against the ledger

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
| Suite scope per task | **FULL suite ×2 per task.** Runtime cost accepted. No targeted-spec shortcut |
| Isolation | **Work on `main`.** No worktrees |
| Phase 0 ordering | **As proposed** — safety (cure guard) and correctness (cart math) first |
| Brainstorming depth | **Only when required** — when something is unclear, not understood, or not well defined. Depth as required by the subject |

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

### 10.6 Summarize after every task or step — in three parts
After each task or step completes, show the owner a summary. Not at the end of a phase — after each step.

**Owner instruction, 2026-07-22: every such summary has three parts, in this order.**

1. **DONE** — what this completion actually delivered, with the evidence (commit, test counts, what was
   verified). Findings and surprises belong here, not buried.
2. **NEXT** — the immediate next step, and anything that must be decided before it can start.
3. **LEFT UNTIL THE GRAND FINAL** — the distance still to run on the *whole* programme, not just this
   phase. Where a burn-down number exists (gaps closed of 141, tasks done of N, phases done of M), state
   it. Where one does not, say so rather than implying progress that has not been measured.

**Why part 3 exists.** A per-task summary tells the owner a task finished; it does not tell them whether
the programme is on course. Without the third part, a long programme reads as an unbounded sequence of
green ticks. The owner asked for the distance, every time, so that "we finished a task" can never be
mistaken for "we are nearly there."

**The honesty rule applies hardest here.** A burn-down that counts a gap as closed before its review is
clean, or that omits gaps added along the way, is worse than no burn-down — it manufactures confidence.
State work-in-progress as in-progress.

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

**How to run the suite:** `npx playwright test` — nothing else. The config is authoritative.

- **Server:** `serve.js` is a **single in-memory process** — de-clustered 2026-07-23 (L18: the earlier clustered design's `cluster.on('exit', () => fork())` turned a killed worker into an unkillable respawning zombie) — with SIGINT/SIGTERM handlers for a clean shutdown; every `dist/` file is served from a Buffer (zero per-request disk I/O). Since the loopback fix (2026-07-24, see the Concurrency bullet below), the main `chromium` project's per-test navigation no longer opens a real HTTP connection to serve.js at all — `tests/_fixtures.ts` fulfills `/index.html` from an in-memory Buffer via `context.route`; serve.js still serves subresources and the dedicated `service-worker` project's real HTTP delivery (needed for genuine SW caching). Playwright starts and tears down this server itself (`webServer.command`); **do not** run `serve.js` by hand for a test run.
- **Concurrency:** `workers: process.env.CI ? 2 : 20`, pinned in `playwright.config.ts` (**the config's comment is authoritative — this doc drifts; read the config**). **20 is CERTIFIED** (2026-07-24) on the post-loopback-fix architecture. Every mid-worker-count collapse recorded through this document's history (10 workers here; the 12-worker Phase C campaigns) was never a P-core-oversubscription limit — L21 already rewrote that story once, and the real cause turned out to be one layer deeper: the loopback-connection nav-stall proven and fixed in `docs/research/flake-refactor-rootcause.md` (`route.fulfill` in-memory doc serving, commits `7d5402d`+`f74f1b8`, independently reviewed `ba1da6a`). With the fix in place a fresh 12/16/20/24-worker curve probe ran clean at every point (439/439 each); 20 was fastest (~54s) and was then certified 7/7 clean over 7 serialized runs (8/8 combined with the curve probe's own clean reading) — full numbers in the POST-LOOPBACK-FIX session, `docs/research/measurements/m1b-capacity-probes-2026-07-23.md`, and **L22** below. CI stays 2 (GitHub ubuntu-latest is 4-vCPU).
- **Run the suite SERIALIZED — never under competing CPU load.** A single run at the measured ceiling still flakes (`ERR_ABORTED` on navigation) if **other heavy subagents/processes** run at the same time — the 10-worker local ceiling assumes an otherwise-idle machine. This extends "never run two suite runs concurrently": during a suite run, pause other CPU-heavy background agents. (2026-07-23: a migration task's suite flaked 10/425 mid-run under parallel-subagent load; 3× clean once the machine was idle.)
- **Retries:** `retries: 0`. A flake must surface as a failure and be fixed, never retried away.
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

**Honest note on how this rule came to be written properly (2026-07-22).** The rule was added, and then six
agent reports were committed and pushed WITHOUT ever updating the graph — the owner had to point out that
he could not see it happening. Writing a rule is not the same as having a mechanism. Hence the script.

**Why it matters here.** This project accumulated ~40 documents and ~12,000 lines of specification that
were never reconciled; four outright contradictions and an entire unbuilt orchestrator specification were
found only by exhaustive auditing. The graph exists to make that visible continuously instead of
retrospectively — which only holds if it is current.

