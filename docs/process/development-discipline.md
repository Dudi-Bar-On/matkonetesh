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

### 10.6 Summarize after every task or step
After each task or step completes, show the owner a summary. Not at the end of a phase — after each step.

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

## 11a. Testing infrastructure (established 2026-07-21)

**How to run the suite:** `npx playwright test` — nothing else. The config is authoritative.

- **Server:** `serve.js` is a **clustered, in-memory** static server — one worker per core (capped 12) sharing the port, every `dist/` file served from a Buffer (zero per-request disk I/O), large listen backlog. This replaced a single-process server that re-read the 2.4 MB `index.html` from disk on every request and stalled under concurrent load. Playwright starts and tears down this server itself (`webServer.command`); **do not** run `serve.js` by hand for a test run.
- **Concurrency:** `workers: 6`, pinned in `playwright.config.ts`. Measured reliable ceiling for the current ~324-test suite — 324/324 across repeated runs at ~145 s. Was 8 (reliable at 308 tests) but that began an occasional short run as the suite grew, so it was lowered to 6. **Re-measure the ceiling if the suite grows substantially** (run the full suite ~3× at a candidate worker count; require all clean). 16 (the CPU/2 default) is much faster but clearly non-deterministic here.
- **Retries:** `retries: 0`. A flake must surface as a failure and be fixed, never retried away.
- **After every `python build.py`, RESTART the manual `serve.js` before a UI check.** The clustered server caches `dist/` in memory at startup, so a rebuild does not reach a still-running manual server — you will verify a stale build. (Playwright is unaffected: its `webServer.command` rebuilds+restarts per run.) Also clear the PWA service worker if a stale page persists.
- **Interactive debugging** (MCP browser / chrome-devtools) needs its own manual `serve.js` on 8123 — **stop it before running the suite**, or Playwright's own managed server collides with it (`reuseExistingServer: false`). Every "port 8123 already in use" error traces to a leftover manual server.
- **Never** run with `--workers=1` or `--retries=N` — those were the old anti-pattern (13 min + masked flakiness).

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
