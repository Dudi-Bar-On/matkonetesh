# Bootstrap prompt — installing this way of working on a new project

> ⚠️ **2026-08-05 — `graphify` was removed from this project.** Any instruction below that names it, `graphify-out/`, `/graphify` or `check-graph-fresh` is a **record of what was done at the time**, not something to run. The live equivalent is **the geniza** (`src.knowledge.retrieval`):
> `retrieval.search_current_docs(q, filters=...)` / `retrieval.semantic_search(q, filters=...)` (search) · `python scripts/ingest.py --scope` (ingest, delta by content hash) · `node scripts/check-geniza-fresh.mjs` (the gate). See discipline §10.11–§10.13.


> **Framing for the owner (not part of the prompt).**
> Everything below the horizontal rule is a single self-contained English prompt, addressed to an AI
> coding agent working on *some other* project. Copy from the line `# You are being asked to install a
> working discipline` to the end of the file and paste it into that agent. It contains no product name,
> no domain vocabulary, and no identifiers from this repository, so a payments backend or a medical
> scheduler can run it verbatim.
> Everything in it is derived from this repository's `docs/process/development-discipline.md`,
> `docs/process/COMPLIANCE-AUDIT-2026-08-01.md`, and the enforcement machinery in `scripts/`,
> `.githooks/`, `.github/workflows/` and `.claude/settings.json`. Where a detail could not be
> established from this repository, the prompt says "verify against the tool's own documentation"
> rather than inventing a command.

---

# You are being asked to install a working discipline

You are an AI coding agent. Your task is not a feature. Your task is to **install a way of working** on
this project: an operating model, a set of rules, the automation that enforces those rules, and the
tooling that makes investigation cheap. When you are done, this project should be measurably harder to
break than it was, and the rules should hold on a busy day without anyone remembering them.

Read this whole document before you run anything. Then follow §10 (the staged adoption path) — do not
try to build everything at once.

Two framing facts you should accept before you start, because everything here follows from them:

1. **This discipline was not designed. It was paid for.** Every rule below exists because something
   specific broke: a specified mechanism that was silently dropped from a plan; a computed value that
   shipped for months with no reader; three features that shipped inert with a fully green test suite;
   a "99% translated" claim measured on key coverage while half the real screens rendered untranslated;
   a release announced as live before the deploy finished. Treat each rule as a scar, not a preference.
2. **A one-day compliance audit on the source project found ten rule breaches in a single working day**,
   across four releases — and the cause was not forgetfulness. The gate script existed and was wired to
   *no* git hook, so it ran zero times that day. The one gate that did run when invoked by hand scanned
   18 of 81 ledger rows and printed OK. **Rigour decayed monotonically across that same day, and the
   decay was invisible from inside it**: the first release recorded "N passed ×2, exit 0 both times, on
   the tree being shipped"; the second lost the second run; the third lost the exit code and wrote an
   unmeasurable "N+"; the fourth lost the tree clause. Nobody decided to lower the bar.

---

## 1. The operating model — controller and subagents

### 1.1 The shape

There is exactly one **controller** (the main agent, the thread the human talks to) and any number of
**subagents**. A subagent runs in its **own private context window**, receives a written brief, does one
end-to-end scoped task, writes a report file, and returns a short summary plus that file's path.

| What | Runs where | Why |
|---|---|---|
| Decisions, gates, human communication, requirement waivers | **Controller only — never delegated** | decision provenance must live in one conversation; the human talks to one entity |
| Accepting or rejecting a phase verdict; saying "done" | **Controller only** | accountability is not inheritable |
| The ledger / status board / task summaries | **Controller** | the one thing context compaction must never squeeze out |
| Spec and plan drafting | Subagent drafts; controller approves | heavy writing is heavy context |
| Task implementation, one fresh agent per task | **Subagent** | isolation per task; no cross-task contamination |
| Code review and spec audit (two separate verdicts) | **Subagent**, fresh, with no access to the implementer's notes | reviewer independence is the single strongest artifact you will produce |
| Heavy reading: research, synthesis, evidence sweeps | **Subagent** | the controller receives conclusions and file paths, never dumps |
| Long mechanical work: full test runs, screenshot sweeps, graph rebuilds | **Subagent** or the controller's own foreground run — see §1.4 | |

### 1.2 Why heavy work must run in a subagent — context survival

This is the load-bearing reason, and it is mechanical, not stylistic.

The controller's context window is finite. When it fills, the harness **compacts** it — summarising
earlier turns and discarding detail. Compaction is not neutral: it erases exactly the working memory the
discipline depends on. A long programme that compacts three times has, three times, quietly dropped the
rules, the ledger position, and the reasons behind earlier decisions — and then carried on as if nothing
happened. The failure is invisible from inside, because the compacted summary reads plausible.

A subagent's context is **private and disposable**. It can read forty files, run a fifteen-minute
investigation, and produce a two-hundred-line report; the controller pays only for the summary and the
path. So:

> **Controller context budget: no full source files, no full test logs, no long documents. Anything
> projected to exceed roughly 2,000 cumulative lines goes to a subagent that returns an extract.**

That budget is what keeps the ledger, the decisions and the human conversation alive across a long
session. It is not an efficiency tweak — it is the mechanism that stops the controller from becoming an
amnesiac halfway through.

### 1.3 What the controller must never delegate

Two things, absolutely:

1. **Independent verification of every claim.** A subagent's "done", "passing", "verified" is a
   **hypothesis**, not a fact. The controller re-checks it — by reading the diff, by running the command
   itself, by looking at the artifact. On the source project, this single habit is what caught three
   separate defects that every subagent report had declared clean: a release whose test suite went green
   twice *before* the text that shipped even existed; an implementer's "825 passed, exit 0" that gave
   821 passed / 4 failed on the controller's own machine (a spec file had grown from 2 tests to 5, and
   the runner caps workers at the test count per file, so the file's own size silently changed the
   suite's concurrency); and a stale plan instruction to delete something that had since shipped.
2. **The final gates.** Whether a phase is complete, whether a release ships, whether a requirement was
   met. Delegating that is delegating accountability, and accountability does not transfer.

### 1.4 Concurrency ceiling — parallelism is bounded by the machine

"Maximise subagent usage" is a real instruction, and it has a hard bound, learned expensively: a mass
dispatch of ~50 agents with ~25 concurrent **wedged the workstation and returned plausible partial
results** — which is worse than failing, because the partials looked complete.

- **Default: sequential.**
- Independent *light* work (reading, scanning): up to **3 concurrent**, hard cap **5**.
- While a full test suite, a build, or any GPU/CPU-heavy job is running: **at most one** heavy agent.
- Three independent bug fixes are three separate dispatches, never one bundled agent. Bundling means no
  fix can land before the slowest one and progress is invisible.
- On provider overload errors, drop to one at a time and send a small probe agent first.
- **Always reconcile agents-started against results-received** before trusting any fan-out's output.
- **Never hand a subagent a backgrounded long-running command to poll.** On the source project, agents
  polling a background test run burned roughly an hour across three tasks with nothing to show. The
  controller runs the long job (or waits on it) and hands the subagent a verdict, not a polling loop.
- When you replace or abandon a subagent, **stop the old one first**; if it is already gone, record its
  id as replaced and treat any late notification from it as noise.

### 1.5 Model and effort selection

Choose the model and reasoning effort **explicitly** for every dispatch — never inherit silently.

| Task type | Model class | Effort |
|---|---|---|
| Planning, architecture, hard decisions, phase gates, judging panels | Your strongest reasoning model | high |
| Simple/mechanical development (transcribing exact code from a plan, single-file fix, doc sync) | Your standard coding model | medium |
| Complex development (multi-file integration, debugging, subtle logic) | Your standard coding model | high → very high by difficulty |

**If it succeeded at a lower effort, do not re-run it at a higher one.** Escalation is a response to
failure *with a change*, never a blind retry and never retroactive on work that already worked.

---

## 2. The dispatch contract — what makes a task brief valid

A brief is a **file**, not a chat message. Chat messages are not artifacts, cannot be audited, and vanish
under compaction. On the audited day, **zero of six briefs touched the template at all** — and the
template was fine; nothing forced anyone to open it.

**Therefore: dispatch begins with a copy.**

```sh
cp docs/process/templates/task-brief.md .agent/briefs/<task-name>-brief.md
```

Starting from a blank page is what fails. Starting from the template is what works.

### 2.1 The six required fields

A brief missing any field is an **invalid brief** and is sent back, regardless of how good its prose is.

| Field | Contents |
|---|---|
| **(A) Requirement trace** | The exact spec/plan lines this task satisfies, quoted verbatim. If none exist, the task should not exist. |
| **(B) Exact code from the plan** | The actual code, not "see the plan". A plan step with no code block is a truncated plan — see §2.4. |
| **(C) Verification checklist** | The relevant lines of the verification gate (§3), copied in, not referenced. |
| **(D) Report contract** | The report file's exact path, and precisely what must be pasted into it: the failing-test output, the passing output, the **exit code**, artifact paths — **ending with the fixed 5-row summary table** (§2.2). |
| **(E) Primary tool** | Which instrument this task uses: symbol-level code tool, graph query, or plain text search **declared as a fallback** (§9). |
| **(F) Contracts that bind this task** | E.g. the test-authoring contract for any task touching tests; the style/security contract for any task touching those. Named as files the agent must read *before* writing. |

Plus three standing clauses every brief carries verbatim:

- **The full-suite gate is not yours.** Run only the test files you touched. Do not run the bare
  full-suite command; do not wait on a background run. The controller owns the suite gate.
- **The concurrency ceiling** (§1.4), quoted.
- **Exit codes are captured directly** (`cmd; ec=$?`) — **never through a pipe** (§3.6).

### 2.2 The fixed 5-row summary table

**Every** task — controller or subagent — ends with this table. Same five rows, same order, every time.

| # | Row | Contents |
|---|---|---|
| 1 | **Before** | the state or problem before this task |
| 2 | **Done** | what was actually done, with evidence: commit hash, test counts, exit codes, file paths, date+time |
| 3 | **Remaining** | what stays open from this task or phase |
| 4 | **Position** | "Phase X, task Y of Z" + the programme burn-down ("N closed / M total") — **read from the status board file, never from memory** |
| 5 | **Next** | the next tasks in line |

Row 4 is the one people drop, and it is the one that matters most. Without it, a long programme reads as
an unbounded sequence of green ticks and nobody can tell whether it is on course. If the number genuinely
does not exist yet, say so — never imply progress that has not been measured. **A burn-down that counts
an item as closed before its review is clean is worse than no burn-down: it manufactures confidence.**

Maintain the table and the status board on **every** task; show them to the human at milestones or on
request, so the tracking is tight without being noisy.

### 2.3 The report contract

A report is a **file** under a known directory (e.g. `.agent/reports/<task>-report.md`). The subagent
returns only a short summary plus the path. The controller reads the diff and verifies independently
(§1.3) — never the report alone.

### 2.4 Plans must be mechanically complete before dispatch

A model asked to emit a ten-task plan emitted real code for tasks 1–5 and prose for tasks 6–10; a model
asked to concatenate ~237,000 characters of task material silently truncated. **Output-length limits fail
silently.** Both were caught one step before implementers were dispatched against empty tasks.

Two rules:
- Assemble large documents **mechanically** (file concatenation, scripted), never by asking a model to
  concatenate.
- Run a completeness check on every generated plan **before** it goes to review: each task section must
  contain at least one fenced code block, and no fence may be left unterminated.

### 2.5 The complete brief template

Save this as `docs/process/templates/task-brief.md`.

```markdown
# Task brief — a brief missing any field is an INVALID brief

## Brief: <Phase X · Task N — short name>

**(A) Requirement trace:** <exact spec/plan lines this task satisfies, quoted verbatim.
If you cannot quote a line, stop and report — the task should not exist.>

**(B) Exact code from the plan:** <the actual code, inline. Never "see the plan".>

**(C) Verification checklist:** <the relevant numbered lines from the verification gate, copied here in
full — not referenced by number.>

**(D) Report contract:**
- Report file: `.agent/reports/<task>-report.md`
- Must contain, pasted verbatim:
  - the FAILING test output, with the reason it failed (red before green — see (C))
  - the PASSING test output for the files you touched
  - the **exit code**, captured directly: `npx <test-cmd> <file>; ec=$?; echo "exit=$ec"`
    — **never** through a pipe: `cmd | tail; $?` measures `tail`, not `cmd`.
  - paths to any visual/artifact evidence, at the exact target viewport/format
- Ends with the fixed 5-row table:
  | Before | Done (+ evidence: commit, counts, exit code, timestamp) | Remaining |
  Position (read from `docs/STATUS-BOARD.md`) | Next |

**(E) Primary tool:** <symbol-tool | graph-query | other> — plain text search is a **declared fallback**
only, and if you use it, say so in the report and say why.

**(F) Contracts that bind this task:** <e.g. `tests/TEST-AUTHORING-CONTRACT.md` for any task that writes
or edits a test — READ IT BEFORE WRITING THE FIRST TEST. A test written outside the contract is
rewritten even if it is green.>

**The full-suite gate is not yours.** Run ONLY the test files you touched. Do not run the bare
full-suite command. Do not start a background run and wait on it. The controller owns the suite gate.

**Concurrency ceiling:** sequential by default; ≤3 concurrent light agents; hard cap 5; exactly 1 while
a suite run / build / heavy job is active; on provider overload, one at a time behind a small probe.

**Stop-on-replace:** before replacing or abandoning a subagent, stop the old one FIRST; if it is already
gone, record its id as REPLACED and treat any late notification from it as noise.

**Constraints:** <global constraints copied from the plan + the explicit boundaries of this task:
what must NOT be touched.>

**If the plan instruction conflicts with the current tree — STOP AND REPORT, do not comply.** A plan is
evidence of intent at the time it was written, not evidence of current truth. Treat every instruction
that deletes or reverts existing behaviour as a claim to verify against the tree first.
```

That last paragraph earned its place: a plan told an implementer to delete a configuration entry that had
shipped to production since the plan was written. The implementer refused and reported back. That was the
correct behaviour, and it should be a rule rather than luck.

---

## 3. The verification rules

These are the gate. A task is **not done** until every applicable line is checked **with evidence pasted
in**. Copy this list into your project's discipline document and into every brief.

1. **Requirement traced.** The exact spec line(s) this task satisfies, quoted. No line → no task.
2. **Red witnessed.** The test was written first, run, and **observed failing for the intended reason**.
   Output pasted. **A test that passed on its first run is void — rewrite it.**
3. **Green.** The test command run fresh, output pasted, **exit code shown**.
4. **Behavioural assertion.** Every new test asserts an **observable effect** — rendered output, stored
   state, or a value a real consumer reads. *Asserting a computed field that nothing consumes is not a
   test.*
5. **Consumer exists.** Any new derived value has a real reader in production code, **named here** — and
   you have confirmed that reader's code path **actually executes on the real data**. A reader that never
   runs is still dead code.
6. **Fixture minimality, and the negative case.** The fixture contains only what the scenario needs, and
   **the negative case is tested**. A fixture that happens to supply exactly what a broken gate needs
   will make a broken gate look correct.
7. **Regression red-green.** For a bugfix: revert the fix → observe the test FAIL → restore the fix →
   observe it PASS. Both outputs pasted.
8. **Visual / external evidence.** Any user-visible change: an artifact captured at the exact target
   format, attached, **and actually looked at** — and the assertion accompanying it must read the
   **rendered output**, not internal state. A green assertion on internal state once guarded a screenshot
   of the wrong screen entirely.
9. **Localisation / formatting check** (if you have user-facing text): rendered in each supported locale,
   no leakage from the source language, correct plurals on interpolated counts. Measure at the **rendered
   output**, per locale — never at key coverage or a bundle grep.
10. **Invariance.** Name the invariants this task must not change (safety values, money amounts, medical
    doses, auth boundaries — whatever "must never silently change" means in your domain), and name the
    assertion that proves they did not.
11. **No arbitrary waits.** Tests wait on **conditions**, never on a fixed sleep. Every fixed sleep is a
    latent flake that will detonate in a full parallel run.
12. **Full suite green.** Run the suite plainly, with no flags. Output pasted, exit code shown. **Task
    gate = one clean run. Release gate = two clean runs, and the second one runs on the FINAL tree** —
    after the version stamp and every last copy change is in. Any failure, **including an intermittent
    one, is a bug**: debug it to root cause, never re-run until it passes, never add retries, never pin
    workers to 1 to make it quiet.

### 3.1 No completion claim without fresh evidence

You may not say "done", "working", "verified" or "shipped" without command output **from the same message
in which you claim it**. Not remembered output. Not output from earlier in the session. Fresh.

Corollary for deployments: **a push is not a release.** A release is not done until you have driven the
live URL and asserted **both** that the version marker matches what you shipped **and** that a feature
probe unique to this release is present. Builds take minutes — **poll, do not assume**. On the source
project, a release was announced the instant `git push` returned; the human looked, saw the previous
version, and the first diagnosis blamed their browser cache. The build was simply still running.

### 3.2 Assert on rendered or externally observable output, never on internal state

This one rule has been violated in four distinct ways on the source project, each expensive:

- A computed field was asserted, so the feature shipped inert with green tests.
- A "99% translated" claim was measured on key coverage and bundle strings while real screens rendered
  roughly half untranslated. It cost three repair releases.
- A screenshot was captured and "looked at", but the accompanying assertion read a JS variable, so the
  screenshot showed the wrong panel and passed anyway.
- Every test of a wire-format parser fed it fixtures written from the **same assumption the parser held**,
  so a frame-delimiter mismatch made an entire streaming path inert in production for days while every
  test stayed green.

The general form: **measure at the consumer's input, not at an intermediate you control.** For a parser
of an external format, at least one test must use **bytes captured from the real endpoint**.

### 3.3 Negative cases are mandatory

A test that only proves the happy path proves that the code can succeed, not that it can fail correctly.
The gate that never blocks anything and the gate that blocks correctly look identical from the positive
case alone.

### 3.4 Red before green, always

If the test passed the first time you ran it, it is not testing your change. Rewrite it until you have
watched it fail **for the reason you intended** — not for a typo, not for a missing import. Paste that
failure. It is the only evidence that the test has any power at all.

### 3.5 A fix must be shown to actually fire

Ship a fix together with a tripwire that proves the fix's **mechanism** executes — not merely that the
symptom improved. A timeout value was once raised as a fix and "verified" by nine clean runs; the value
sat above a hard ceiling that fired first, so it was **dead config** and the clean runs were luck. The
tell was available and missed: after the change, the error signature should have changed and did not.

### 3.6 Capture exit codes directly — never through a pipe

```sh
# WRONG — measures `head`, which always succeeds. Always 0. Always a lie.
npm test | head -40; ec=$?

# RIGHT
npm test > /tmp/out.txt 2>&1; ec=$?; tail -40 /tmp/out.txt; echo "exit=$ec"
```

**Why this specific mistake gets its own rule:** `$?` holds the exit status of the **last** command in a
pipeline. Pipe a failing command into `head`, `tail`, `grep`, `tee` or `less`, and `$?` reports the
pager's status — zero — while the real command failed. The output you are staring at may even show the
failure; the captured code says success, and the captured code is what goes into the report, the commit
message, and the gate. On the source project this recurred **repeatedly, including by the controller
minutes after writing the rule down** — which is precisely why it is a named rule with an example rather
than a note. If you need to trim output for display, redirect to a file first, capture `$?`, then trim
the file.

---

## 4. The waiver rule — the single most important rule

> **A plan may never waive, defer, narrow, or reinterpret a requirement from an approved spec.**
> Any such change is raised with the human **in conversation**, with the spec text quoted and the reason
> given, and requires **explicit approval**.
> **"Recorded in a document" does not count as raised.**

This exists because the central mechanism of an approved spec was once waived in a plan file, on one
line, and never surfaced. It was never built. The spec said it was required; the plan said it was
deferred; nobody read both.

The rule also covers, in exactly the same way:

- reordering phases in a way that drops a dependency;
- marking a spec item "deferred" or "out of scope";
- narrowing a verification line;
- **rewriting a regression test to assert what the code happens to do**, instead of the scenario the plan
  specified. That is a silent narrowing, and it is a review-blocking finding.

### 4.1 What raising it properly looks like

1. **Freeze the work.** The task does not start until the ruling exists.
2. **State it in the plan, visibly**, in the form: *"This is the one place this plan reads the approved
   spec more narrowly than the original did — §X.Y says ⟨quote⟩. It is raised with the owner in
   conversation; do not start this task until that ruling exists."*
3. **Raise it in conversation**, with the spec quote, the proposed narrowing, and the reason.
4. **Record the ruling** in the decision register / roadmap **in the same commit that implements it**.
   A ruling that exists only as the phrase "owner-ruled" inside an agent's report has left no evidence,
   and a rule that works but leaves no evidence will not survive its first audit.

### 4.2 When to interrupt the human, and when not to

Interrupt for decisions that are **genuinely important**: hard to reverse or destructive; touching
safety, legal, money or health numbers; **any spec waiver — always**; a material change to scope, cost or
deliverable; or a matter of the human's preference that cannot reasonably be inferred.

Do **not** interrupt for: ordering among items already agreed, an obvious default, an implementation
detail, or anything a careful colleague would simply decide. Make the call, state it in the summary.

**When genuinely unsure which bucket a decision falls into, prefer proceeding** — and put the choice in
the summary so it can be redirected. Spend analysis time in proportion to **irreversibility**: cheap
reversible decisions deserve less deliberation, not just less asking.

---

## 5. The four enforcement layers

> This is the section that matters most, and §6 explains why each piece is shaped the way it is.

Four legs, each covering what the others structurally cannot:

| Leg | What it is | Blocking? | Covers what the others cannot |
|---|---|---|---|
| **1. Session-start emission** | A hook firing on session start, resume, **and after compaction**, emitting **three different things**: the gate, a position digest, and a **verbatim reload of the rules** (§5.2) | **No — visibility and restoration only** | Surfaces existing red state at the moment work begins, **and puts the rules themselves back into context right after the event that erases them** |
| **2. Pre-commit hook** | Local git hook running the same script | Yes, **bypassable by design** | Fast structural feedback before a round-trip to CI |
| **3. CI job** | The same script in CI on every push and PR | **Yes — the authority** | Cannot be bypassed by a developer the way a local hook can |
| **4. Scheduled job** | A nightly CI cron for time-based properties | Yes, visibly | Catches rules that go stale from **elapsed time and inaction**, which no commit-triggered gate can ever express |

**A background daemon was considered for leg 4 and explicitly rejected.** A daemon can die silently —
which is exactly how the audited failure happened: the gate was not running and nothing announced that
fact. A missed scheduled CI run shows up as a missing check in the platform's own UI; a dead daemon shows
up as nothing. **"Not running" must itself be an alarm**, and only a platform you do not own gives you
that for free.

Everything below is runnable. Adapt paths and the language of the marker strings; keep the structure.

### 5.1 Wiring: versioned hooks that survive a clone

Hooks in `.git/hooks/` are **not** cloned. Put them in a tracked directory and point git at it — and
auto-provision that pointer so every clone gets it.

```jsonc
// package.json  (npm runs "prepare" automatically after `npm install`)
{
  "scripts": {
    "prepare": "git config core.hooksPath .githooks",
    "meta": "node scripts/check-meta.mjs",
    "gate-selftest": "node scripts/tests/run-all.mjs"
  }
}
```

One-time, and safe to re-run:

```sh
git config core.hooksPath .githooks
chmod +x .githooks/*        # on Windows/git-bash, `git update-index --chmod=+x .githooks/*`
```

*(If your project is not Node-based, use the equivalent post-install hook of your package manager, or
document `git config core.hooksPath .githooks` as the first line of your CONTRIBUTING file and have CI
verify it — see §5.6.)*

### 5.2 Leg 1 — the session-start / post-compaction emission

**This leg is not one script. It is three, and they are different in kind.** Getting this wrong is the
single easiest mistake in the whole document, so it is stated before the code:

| # | Emission | The question it answers | If it is the only one |
|---|---|---|---|
| **1. The gate** | The same compliance script legs 2–4 run | **Is anything broken right now?** | Prints green over an agent that no longer holds the rules — confidence nobody earned |
| **2. The position digest** | Read-only report derived from the repo and `git` | **Where are we, what is in flight, what awaits a decision?** | The agent knows the rules and not what to apply them to |
| **3. The rule reload** | **Verbatim** re-emission of the rule text itself | **What are the rules, word for word, right now?** | — this is the one that gets omitted. Without it the other two restore nothing |

> **A gate reports whether the rules were followed. Reloading the rules restores the ability to follow
> them.**

Compaction is not a *violation*; it is a *deletion*. Nothing was breached — the rules are simply gone from
context. A checker printing `OK` at that moment is answering a different question, and leaves the agent
exactly where the failure starts: coherent, confident, and without the bar it is supposed to meet.

```jsonc
// .claude/settings.json
// This example is the Claude Code schema — VERIFY the exact schema and, crucially, the
// stdout-into-context behaviour against your own harness's documentation (see "The mechanism" below).
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|compact",
        "hooks": [
          { "type": "command", "command": "node scripts/check-meta.mjs",    "timeout": 20 },
          { "type": "command", "command": "node scripts/session-brief.mjs", "timeout": 10 },
          { "type": "command", "command": "node scripts/session-rules.mjs", "timeout": 15 }
        ]
      }
    ]
  }
}
```

`compact` is in that matcher deliberately, and it is the least obvious and most valuable part: compaction
is precisely the moment the working memory the discipline depends on gets erased mid-session. **This leg
blocks nothing.** Its job is that nobody can honestly say "I didn't know it was red" — and that nobody
*continues* after compaction without the rules.

#### The mechanism: a hook's stdout lands in the agent's context

All of this works because of exactly one platform property: **the hook's stdout is injected into the
agent's context**, not written to a log nobody reads. That is what turns "run a script" into "put text
back into the agent's head".

**Verify this on your harness before relying on it.** If your harness only logs hook output, this
mechanism *does not exist for you*, no matter what the script prints — and you need a different carrier
(an auto-read file the agent is instructed to open first, a system-prompt injection, a preamble message).
Say which one you used.

#### Why a summary of the rules is not the rules

Not pedantry. **Paraphrase is the exact failure this mechanism exists to prevent.** Compaction *is* a
paraphrase engine: it summarises and discards the source, and caveats go first — "the owner ruled X,
because Y, **with caveat Z**" becomes "X was agreed". An emission that is itself a summary is a second
pass of the same deletion, wearing the costume of a fix.

The source project states this outright in its always-loaded rules file, and it is worth copying verbatim
into yours:

> **Memory is not a substitute for re-reading.** "I remember this rule" is a red flag — rules are re-read
> at invocation, never recalled.

A non-verbatim emission breaks that rule while claiming to enforce it. The already-paid sibling lesson
(§8.2 #3): a rules file written from recollection omitted the two sections the source document itself
calls "the core" and "the most important rule". A script that summarises instead of quoting makes that
same mistake automatically, every day.

#### The real tension: you cannot emit everything, every time

State this honestly rather than rounding it off. **The emission consumes the very resource it protects.**
Dumping the whole corpus on every compaction funds the next compaction. So some things are printed **in
full** and others are **named with a path** — and that split must be a stated decision, not an accident.

**How to choose:**

1. **In full: the sections whose absence caused a real failure.** Not "what someone thinks is important" —
   what your lessons log or audit names as the cause of something that actually happened. On the source
   project that resolved to: the always-loaded rules file, the memory index, the verification gate, the
   waiver rule, **the owner's standing instructions** (the section the audit found had gone unread on the
   day of the failure), and the complete lessons log.
2. **Named with a path: reference material consulted on demand.** Debugging protocol, thinking models,
   testing infrastructure, reviewer discipline. Not needed to *start* a task; needed when you reach them.
3. **An index counts as the pointer.** A memory index that is already one line per topic gets emitted in
   full; the ~30 documents beneath it do not. Its own line descriptions *are* the named-with-path pointer,
   and opening any one of them is a deliberate follow-up.
4. **Everything named gets a one-line reason.** `§5–§9 — debugging protocol, failure-mode map, reviewer
   discipline — procedural detail consulted on demand, not needed to START a task.` A bare list of
   omissions becomes, within a month, a skip-list nobody remembers the rationale for.
5. **Extract by anchor, never by line number.** Documents get edited and sections move. An extractor
   pinned to line 412 keeps reporting that it emits §10 while emitting something else entirely — the exact
   shape of failure principle §6.2 is about. Anchor on heading text, and when the anchor is **not found**,
   say `not established` loudly rather than silently emitting a fragment.

Two more that save sessions: the emission is **read-only**, and it **must never fail the session** — guard
every read, print `not established` for a missing file, and exit 0 regardless. A rule-reload that breaks
session start is the fastest way to get itself disabled.

#### Skeleton — adapt the anchors, keep the shape

```js
#!/usr/bin/env node
// scripts/session-rules.mjs — a RE-READ, not a recollection.
// Companion to the gate (is anything broken?) and the position digest (where are we?).
// This one answers: what are the rules, verbatim, right now?
import { readFileSync, existsSync } from 'node:fs';

const NA = 'not established';
const out = [];
const rule = (c = '=') => c.repeat(78);

// Never throw: a missing file degrades this section, it does not fail the session.
const readOrNA = (p, label) =>
  existsSync(p) ? readFileSync(p, 'utf8') : `${NA} — ${label} not found at ${p}`;

// Anchor-based, NOT line numbers: slice from a heading regex to the next matching heading.
function sliceSection(text, startRe, stopRe) {
  const m = startRe.exec(text);
  if (!m) return null;                      // caller prints "not established" — never a silent partial
  stopRe.lastIndex = m.index + m[0].length;
  const stop = stopRe.exec(text);
  return text.slice(m.index, stop ? stop.index : text.length).trimEnd();
}

out.push(rule(), 'SESSION-RULES — a RE-READ, not a recollection.',
  'This is the verbatim rule text, emitted fresh into context. It is not a paraphrase and must not be\n' +
  'treated as one. If anything below looks truncated or stale, open the source file directly before the\n' +
  'next task. "I remember this rule" is a red flag, not a reason to skip reading.', rule());

// IN FULL — the always-loaded rules file and the memory index.
for (const [path, label] of [['CLAUDE.md', 'always-loaded rules file'],
                             [process.env.MEMORY_INDEX ?? '', 'memory index']]) {
  out.push('\n' + rule('-'), `${label} (${path}) — FULL TEXT`, rule('-'), readOrNA(path, label));
}

// IN FULL — the sections of the discipline document whose absence caused real failures.
const disc = readOrNA('docs/process/development-discipline.md', 'discipline document');
for (const [name, startRe] of [['§3 THE VERIFICATION GATE', /^## 3\. .*$/m],
                               ['§4 THE WAIVER RULE',       /^## 4\. .*$/m],
                               ['§10 STANDING INSTRUCTIONS',/^## 10\. .*$/m],
                               ['§11 LESSONS LOG',          /^## 11\. .*$/m]]) {
  const body = sliceSection(disc, startRe, /^## \d/m);
  out.push('\n' + rule('-'), `discipline ${name} — FULL TEXT`, rule('-'),
           body ?? `${NA} — anchor not found; document structure may have changed.`);
}

// NAMED, NOT QUOTED — each with a one-line reason. Never a bare skip-list.
out.push('\n' + rule('-'), 'NOT quoted here (named + reason; open the file for these):', rule('-'),
  '  §5–§9  — debugging protocol, failure-mode map, reviewer discipline — consulted on demand',
  '  §12    — thinking models — used when a task calls for one, not to start one',
  '  §11a   — testing infrastructure — only relevant when actually running the suite');

const body = out.join('\n');
// Principle §6.2: publish the measure, not just the fact that something was emitted.
console.log(body + `\n${rule()}\nEND SESSION-RULES — ${body.split('\n').length} lines, ` +
  `${Buffer.byteLength(body, 'utf8')} bytes. This is a re-read, not a summary.\n${rule()}`);
process.exit(0);   // read-only, best-effort, never fails the session
```

Wrap `main()` in a `try/catch` that prints a one-line warning naming the files to open manually, and still
exits 0.

#### The manual command must emit the *same thing*

You will also want a proactive way to say "get back in the groove" — a manual command, outside the
automatic triggers. **It must invoke the same scripts, byte for byte.**

```md
<!-- .claude/commands/enforce.md — or your harness's slash-command equivalent -->
Run, in order, and show each output IN FULL — including what each gate scanned, not only its verdict:
  1. node scripts/check-meta.mjs      # the gate — is anything broken right now?
  2. node scripts/session-brief.mjs   # the position digest — where are we?
  3. node scripts/session-rules.mjs   # the rule reload — the rules themselves, verbatim
Do not summarise, re-word, or select from these outputs. This command RUNS commands; it does not
compose content. If the emission looks truncated, open the named source files directly.
```

The moment the manual path grows its own version — "a short summary of the rules", "just what's relevant
right now" — you have two mechanisms: the automatic one, which is maintained, and the manual one, which is
a weaker ritual that decays quietly. It is always the manual one that decays, because it was written "just
for convenience".

**The test that holds this in place:** the manual command runs commands and does not compose content. If
you can change what it emits without touching a script, it has already forked.

### 5.3 Leg 2 — the pre-commit hook

```sh
#!/bin/sh
# .githooks/pre-commit — versioned; installed via `git config core.hooksPath .githooks`.
#
# LAYERING (four legs; see .claude/settings.json and .github/workflows/*.yml):
#   1. This hook = fast local structural feedback. Bypassable BY DESIGN — a local hook can never be
#      the authority, because any developer can skip it (--no-verify). Its job is to catch problems
#      before they cost a round-trip to CI, not to be trusted.
#   2. The CI `discipline` job = the actual authority. Every push and PR. Not bypassable.
#   3. The nightly schedule = covers what no commit- or push-triggered job can express: a rule that
#      goes stale from pure elapsed time and inaction.
#   4. The session-start hook = surfaces existing red state when work BEGINS (and after compaction).
#      Blocks nothing; its job is visibility.
# A background daemon was rejected for all of this: a daemon can die silently. "Not running" must
# itself be an alarm — CI gives that for free, a daemon does not.

# Don't fire mid-rebase/merge/cherry-pick: those replay existing commits, and blocking them turns a
# routine history operation into a hostage situation over debt the operation did not create.
GIT_DIR=${GIT_DIR:-$(git rev-parse --git-dir 2>/dev/null)}
[ -d "$GIT_DIR/rebase-merge" ] && exit 0
[ -d "$GIT_DIR/rebase-apply" ] && exit 0
[ -f "$GIT_DIR/MERGE_HEAD" ] && exit 0
[ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] && exit 0

# Escape hatch: loud, explicit, NAMED, logged. Never silent, never a blanket default. See §7.
if [ -n "${GATE_SKIP:-}" ]; then
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    mkdir -p .agent
    printf '{"ts":"%s","hook":"pre-commit","gates":"%s","branch":"%s"}\n' \
        "$ts" "$GATE_SKIP" "$branch" >> .agent/gate-skip-log.jsonl
    echo "[pre-commit] GATE_SKIP=$GATE_SKIP — recorded in .agent/gate-skip-log.jsonl."
    echo "[pre-commit] Only the named gate(s) are skipped; every other gate still runs below."
fi

echo "[pre-commit] running node scripts/check-meta.mjs ..."
node scripts/check-meta.mjs
status=$?
if [ $status -ne 0 ]; then
    echo ""
    echo "[pre-commit] BLOCKED: check-meta.mjs failed (see the gate(s) marked FAIL above)."
    echo "[pre-commit] Each gate names which rule broke, which file, and what to run to fix it."
    echo "[pre-commit] Pre-existing debt prints as STANDING DEBT and does NOT block by itself."
    echo "[pre-commit] If this is red, the commit in front of you introduces or worsens something."
    echo "[pre-commit] Escape hatch (named gate(s) only, logged): GATE_SKIP=<gate-id>[,<id>...] git commit ..."
    exit 1
fi
exit 0
```

And a `commit-msg` hook, because **a commit's own message text does not exist as a file at pre-commit
time** — if you want to gate on what the message says, it has to be this stage:

```sh
#!/bin/sh
# .githooks/commit-msg — gates the release-commit message itself.
GIT_DIR=${GIT_DIR:-$(git rev-parse --git-dir 2>/dev/null)}
[ -d "$GIT_DIR/rebase-merge" ] && exit 0
[ -d "$GIT_DIR/rebase-apply" ] && exit 0
[ -f "$GIT_DIR/MERGE_HEAD" ] && exit 0
[ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] && exit 0

case ",${GATE_SKIP:-}," in
    *,check-release,*|*,ALL,*)
        ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
        mkdir -p .agent
        printf '{"ts":"%s","hook":"commit-msg","gates":"%s","branch":"%s"}\n' \
            "$ts" "$GATE_SKIP" "$branch" >> .agent/gate-skip-log.jsonl
        echo "[commit-msg] GATE_SKIP=$GATE_SKIP — skipping check-release for this commit (logged)."
        exit 0
        ;;
esac

node scripts/check-release.mjs "$1"
status=$?
if [ $status -ne 0 ]; then
    echo ""
    echo "[commit-msg] BLOCKED: this release commit does not carry the required evidence (see above)."
    echo "[commit-msg] Escape hatch (named, logged): GATE_SKIP=check-release git commit ..."
    exit 1
fi
exit 0
```

### 5.4 The orchestrator — `scripts/check-meta.mjs`

One entry point; each gate lives in its own file so it is independently self-testable; **every gate
prints how many items it scanned**.

```js
#!/usr/bin/env node
// scripts/check-meta.mjs — the single entry point for every discipline gate.
// A thin orchestrator: each gate is its own file, independently self-testable (scripts/tests/), and
// every gate prints HOW MANY ITEMS IT SCANNED — a gate that reports green without saying what it
// covered is exactly how a blind gate went unnoticed for a full working day.
//
// Invoked by: .githooks/pre-commit (fast local feedback, bypassable by design) · the CI `discipline`
// job (the authority, not bypassable) · the session-start hook (visibility, blocks nothing) · the
// nightly schedule for time-based gates. Commit-message-specific checks additionally run at
// commit-msg time, because the message text isn't a file yet at pre-commit time.
//
// GATE SCOPING. A commit that PAID DOWN compliance debt was once blocked by this orchestrator's own
// pre-existing red state — neither introduced nor worsened by that commit — which forced a blanket
// bypass. A gate that blocks the commit meant to fix it teaches the escape hatch to become routine,
// which is exactly as protective as no gate. Per-checker ruling:
//   - Time-elapsed properties (e.g. index/graph freshness): ADVISORY here, always. No single commit
//     can fix them without a separate heavy action. Owned by the nightly schedule (blocking there)
//     and by session-start visibility.
//   - Per-file structural gates (briefs, reports): block only on a file NOT grandfathered in
//     docs/process/gate-baselines.json.
//   - Ledger/registry gates: block only on a finding NOT present at the git HEAD baseline — i.e. one
//     this very commit introduces or worsens.
//   - Everything else: blocks on every run. Their invariant is always fixable by a single cheap edit
//     reachable from the very commit that trips it, so blocking is the correct incentive.
//
// ESCAPE HATCH: GATE_SKIP=<id>[,<id>...] names exactly which gate(s) to skip — or the literal "ALL",
// which still has to be typed out and is never a default. The calling hook appends every use to
// .agent/gate-skip-log.jsonl BEFORE invoking this script; THIS script prints that log at the top of
// every run, so a skip resurfaces every time discipline is checked instead of aging out of view.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failed = [];

// ---- surface recorded skips loudly, every run ----
const SKIP_LOG = join(ROOT, '.agent', 'gate-skip-log.jsonl');
if (existsSync(SKIP_LOG)) {
  const lines = readFileSync(SKIP_LOG, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length) {
    console.log(`=== gate-skip-log: ${lines.length} recorded override(s) — .agent/gate-skip-log.jsonl ===`);
    for (const l of lines.slice(-10)) {
      try {
        const e = JSON.parse(l);
        console.log(`  ! ${e.ts}  hook=${e.hook}  gates=${e.gates}  branch=${e.branch ?? '?'}`);
      } catch { console.log(`  ! (unparsed entry) ${l}`); }
    }
    if (lines.length > 10) console.log(`  ... and ${lines.length - 10} older entry(ies).`);
  }
}

const SKIP_IDS = (process.env.GATE_SKIP || '').split(',').map(s => s.trim()).filter(Boolean);
const SKIP_ALL = SKIP_IDS.includes('ALL');
// Properties of elapsed time, not of any one commit — advisory here, blocking in the nightly job.
const ADVISORY = new Set(['check-index-fresh']);

function run(id, displayName, file) {
  console.log(`\n=== ${displayName} ===`);
  if (SKIP_ALL || SKIP_IDS.includes(id)) {
    console.log(`SKIPPED — GATE_SKIP names "${id}" (recorded in .agent/gate-skip-log.jsonl).`);
    return;
  }
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    if (ADVISORY.has(id)) {
      console.log('  (STANDING DEBT — advisory here; does not block a commit. Owned by the nightly schedule and by session-start visibility.)');
      return;
    }
    failed.push(displayName);
  }
}

run('check-index-fresh', 'check-index-fresh (advisory)', 'check-index-fresh.mjs');
run('gate-lessons',      'gate-lessons',                 'gate-lessons.mjs');
run('check-board-fresh', 'check-board-fresh',            'check-board-fresh.mjs');
run('check-brief',       'check-brief',                  'check-brief.mjs');
run('check-report',      'check-report (summary table)', 'check-report.mjs');
run('check-release',     'check-release (audit mode — reported, not blocking)', 'check-release.mjs');
run('check-ledger',      'check-ledger (no unlanded items, worsening-only)',    'check-ledger.mjs');

if (failed.length) { console.error(`\nGATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nGATE OK');
```

### 5.5 The individual gates

**`scripts/check-release.mjs` — the release-evidence gate.** This is the one that converts "we always run
the suite twice before shipping" from a memory rule into a **syntax condition**.

```js
#!/usr/bin/env node
// scripts/check-release.mjs — for every commit whose subject starts with "release(v", the message body
// must show:
//   (1) TWO clean suite runs — two literal "exit 0" mentions, or one plus an explicit x2/twice marker;
//   (2) an explicit exit code somewhere ("exit 0" / "exit code 0");
//   (3) the phrase "on the tree being shipped" — the release suite must have run on the FINAL tree,
//       after the version stamp and all copy changes are in;
//   (4) docs/releases/vNNN-report.md present in (or before) that commit's tree.
// Evidence for why: across one day, release 1 had all four; release 2 lost (1); release 3 lost (1)+(2)
// and wrote an unmeasurable "N+"; release 4 lost (1)+(2)+(3). Monotonic erosion — exactly what a syntax
// check catches and memory does not.
//
// HONEST SCOPE: a commit body is immutable once made, so this cannot retroactively fix history.
//   HOOK mode:  node check-release.mjs <commit-msg-file>  → blocks the commit being made right now.
//   AUDIT mode: node check-release.mjs                    → scans history from CUTOFF forward and
//     REPORTS; it does not exit 1 on unfixable history unless AUDIT_STRICT=1, because failing on
//     history nobody can fix just teaches people to ignore the gate.
import { readFileSync, existsSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const CUTOFF = process.env.RELEASE_CUTOFF || '1970-01-01'; // set to the date you adopt this gate

function evaluate(body, versionNum, treeRef) {
  const errs = [];
  const exitZeroCount = (body.match(/exit\s*(code\s*)?0\b/gi) || []).length;
  const hasTwoRunsMarker = /\bx\s*2\b|\btwice\b|\btwo\s+(clean\s+)?runs\b/i.test(body);
  const twoRuns = exitZeroCount >= 2 || (exitZeroCount >= 1 && hasTwoRunsMarker);
  if (!twoRuns) errs.push('no evidence of TWO clean suite runs (two "exit 0" mentions, or one + an explicit x2/twice marker)');
  if (exitZeroCount < 1) errs.push('no explicit exit code ("exit 0") captured');
  if (!/on the tree being shipped/i.test(body)) errs.push('missing the phrase "on the tree being shipped"');

  if (versionNum) {
    const reportPath = `docs/releases/v${versionNum}-report.md`;
    let present = false;
    try {
      execFileSync('git', ['cat-file', '-e', `${treeRef}:${reportPath}`], { cwd: GITROOT, stdio: 'ignore' });
      present = true;
    } catch { present = false; }
    if (!present) errs.push(`${reportPath} not present in (or before) this commit`);
  }
  return errs;
}

const arg = process.argv[2];

if (arg) {
  // ---- HOOK mode ----
  if (!existsSync(arg)) { console.error(`FAIL: commit-msg file not found: ${arg}`); process.exit(1); }
  const msg = readFileSync(arg, 'utf8');
  const first = msg.split('\n')[0];
  const m = first.match(/^release\(v(\d+)\)/);
  if (!m) process.exit(0);  // not a release commit — nothing to do
  // The commit doesn't exist yet, so treeRef='' makes git read ":path" = the INDEX version of the file.
  const errs = evaluate(msg, m[1], '');
  console.log(`check-release (commit-msg hook): "${first}"`);
  if (errs.length) {
    for (const e of errs) console.error('  x ' + e);
    console.error(`\nFAIL: release(v${m[1]}) does not carry the required evidence.`);
    console.error(`  Fix the commit message body, and stage docs/releases/v${m[1]}-report.md, before committing.`);
    process.exit(1);
  }
  console.log('OK — release commit carries two clean runs, an exit code, the tree clause, and its report.');
  process.exit(0);
}

// ---- AUDIT mode ----
let log;
try {
  log = execSync('git -c log.showsignature=false log --format=%H%x09%cI%x09%s -n 1000', { cwd: GITROOT, encoding: 'utf8' });
} catch (e) { console.error(`FAIL: could not read git log: ${e.message}`); process.exit(1); }

const commits = log.split('\n').filter(Boolean)
  .map(l => { const [sha, date, subject] = l.split('\t'); return { sha, date, subject }; })
  .filter(c => /^release\(v\d+\)/.test(c.subject));

let scanned = 0, inScope = 0;
const findings = [];
for (const c of commits) {
  scanned++;
  if (c.date < CUTOFF) continue;
  inScope++;
  const body = execFileSync('git', ['show', '-s', '--format=%B', c.sha], { cwd: GITROOT, encoding: 'utf8' });
  const errs = evaluate(body, c.subject.match(/^release\(v(\d+)\)/)[1], c.sha);
  if (errs.length) findings.push({ sha: c.sha.slice(0, 7), subject: c.subject, errs });
}
console.log(`release commits scanned: ${scanned} · in enforcement scope (>= ${CUTOFF}): ${inScope}`);
if (findings.length) {
  console.error(`FINDINGS: ${findings.length}/${inScope} in-scope release commit(s) lack required evidence:`);
  for (const f of findings) {
    console.error(`  ${f.sha}  ${f.subject}`);
    for (const e of f.errs) console.error('    x ' + e);
  }
  if (process.env.AUDIT_STRICT === '1') { console.error('\nAUDIT_STRICT=1: failing.'); process.exit(1); }
  console.error('\nReported, not blocking (history is immutable) — fix forward via the commit-msg hook.');
  process.exit(0);
}
console.log('OK — every in-scope release commit carries the required evidence.');
```

**`scripts/check-board-fresh.mjs` — the status board cannot go stale.** One line of logic; it is what
stops row 4 of every summary table from losing its source of truth.

```js
#!/usr/bin/env node
// scripts/check-board-fresh.mjs — docs/STATUS-BOARD.md must declare "BASELINE: vNNN" equal to the
// newest release commit in the log. Trivial check; it is what let "where are we" go stale for a whole
// afternoon (board header two versions behind what had shipped), which silently invalidated every
// summary table's Position row from that moment on.
// Env overrides for self-tests: BOARD=<path>, GITROOT=<path>.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const BOARD = process.env.BOARD || join(ROOT, 'docs', 'STATUS-BOARD.md');

if (!existsSync(BOARD)) { console.error(`FAIL: board file not found: ${BOARD}`); process.exit(1); }
const m = readFileSync(BOARD, 'utf8').match(/BASELINE:\s*v(\d+)/);
if (!m) { console.error('FAIL: STATUS-BOARD.md does not declare "BASELINE: vNNN" — cannot verify freshness.'); process.exit(1); }
const boardVersion = Number(m[1]);

let log;
try { log = execSync('git -c log.showsignature=false log --format=%s -n 500', { cwd: GITROOT, encoding: 'utf8' }); }
catch (e) { console.error(`FAIL: could not read git log: ${e.message}`); process.exit(1); }

const versions = [...log.matchAll(/^release\(v(\d+)\)/gm)].map(x => Number(x[1]));
console.log(`board declares: v${boardVersion} · release commits scanned: ${versions.length}`);
if (!versions.length) { console.log('OK — no release commits in the scanned window.'); process.exit(0); }

const latest = Math.max(...versions);
if (boardVersion !== latest) {
  console.error(`FAIL: STATUS-BOARD.md says "BASELINE: v${boardVersion}" but the newest release is v${latest}.`);
  console.error(`  Fix: update the board header to "BASELINE: v${latest}" in the SAME commit that ships it.`);
  process.exit(1);
}
console.log(`OK — board baseline v${boardVersion} matches the newest release commit.`);
```

**`scripts/check-brief.mjs` — every brief starts from the template.** Note the grandfather baseline: it
is principle #1 of §6 made concrete.

```js
#!/usr/bin/env node
// scripts/check-brief.mjs — every .agent/briefs/*-brief.md that landed after the template must carry
// all six field markers (A)..(F). Finding that produced this: 0 of 6 briefs in one day touched the
// template at all — and the template itself was fine. Nothing forced anyone to open it.
// Also forbids handing an implementer the full-suite gate command: that belongs to the controller.
//
// GRANDFATHER BASELINE. Live rediscovery: a debt-paydown commit was blocked by briefs that predated
// this checker's own rollout — none of them touched by that commit — forcing a blanket bypass.
// docs/process/gate-baselines.json's "brief" array names those files: they are reported as STANDING
// DEBT with their age, and never block. A file NOT on the list is judged normally. The list is a
// FROZEN snapshot; it is never auto-grown by this script (auto-growing it would recreate the flaw).
// Env overrides for self-tests: BRIEF_DIR, TEMPLATE, GITROOT, GATE_BASELINES.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const BRIEF_DIR = process.env.BRIEF_DIR || join(ROOT, '.agent', 'briefs');
const TEMPLATE = process.env.TEMPLATE || join(ROOT, 'docs', 'process', 'templates', 'task-brief.md');
const BASELINE_FILE = process.env.GATE_BASELINES || join(ROOT, 'docs', 'process', 'gate-baselines.json');

const MARKERS = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'];
// Adapt to your runner: the point is "a bare full-suite invocation with no file path after it".
const FULL_SUITE_RE = /npx playwright test(?!\S)|npm test(?!\S)/g;

function loadBaseline(key) {
  if (!existsSync(BASELINE_FILE)) return new Set();
  try {
    const json = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
    return new Set(Array.isArray(json[key]) ? json[key] : []);
  } catch { return new Set(); } // malformed baseline → fail safe to "nothing grandfathered"
}

function trackedOrMtime(absPath) {
  try {
    const rel = relative(GITROOT, absPath).replaceAll('\\', '/');
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { cwd: GITROOT, encoding: 'utf8' }).trim();
    if (out) return out;
  } catch { /* untracked — fall through to mtime */ }
  return new Date(statSync(absPath).mtimeMs).toISOString();
}

if (!existsSync(TEMPLATE)) { console.error(`FAIL: brief template not found: ${TEMPLATE}`); process.exit(1); }
if (!existsSync(BRIEF_DIR)) { console.log('OK — no brief directory yet, nothing to scan.'); process.exit(0); }

const templateDate = trackedOrMtime(TEMPLATE);
const baseline = loadBaseline('brief');
const files = readdirSync(BRIEF_DIR).filter(f => f.endsWith('-brief.md'));
let scanned = 0, checked = 0;
const errs = [], standing = [];

for (const f of files) {
  scanned++;
  const abs = join(BRIEF_DIR, f);
  const fileDate = trackedOrMtime(abs);
  if (fileDate <= templateDate) continue;   // predates the requirement — never enforced retroactively
  checked++;
  const text = readFileSync(abs, 'utf8');
  const violations = [];
  const missing = MARKERS.filter(mk => !text.includes(mk));
  if (missing.length) violations.push(`does not touch the template — missing field marker(s): ${missing.join(', ')}`);
  let mm; FULL_SUITE_RE.lastIndex = 0;
  while ((mm = FULL_SUITE_RE.exec(text))) {
    const after = text.slice(mm.index, mm.index + 80);
    if (!/\.spec\.|\.test\.|--grep/.test(after)) {
      violations.push('hands the implementer a bare full-suite command — that gate is the controller\'s; name the specific test file(s)');
      break;
    }
  }
  if (!violations.length) continue;
  if (baseline.has(f)) {
    const ageDays = Math.max(0, Math.round((Date.now() - new Date(fileDate).getTime()) / 86400000));
    standing.push(`${f} (age ~${ageDays}d, grandfathered): ${violations.join('; ')}`);
  } else {
    errs.push(`${f}: ${violations.join('; ')}`);
  }
}

console.log(`brief files scanned: ${scanned} · newer than template (${templateDate}): ${checked} · grandfathered: ${baseline.size}`);
if (standing.length) {
  console.log(`\nSTANDING DEBT (pre-existing per gate-baselines.json, reported not blocking — ${standing.length}):`);
  for (const s of standing) console.log('  ~ ' + s);
}
if (errs.length) {
  for (const e of errs) console.error('  x ' + e);
  console.error(`\nFAIL: ${errs.length} invalid brief(s) — a missing field is an invalid brief — and NOT grandfathered: this is new debt.`);
  console.error(`  Start every brief from the template: cp "${relative(ROOT, TEMPLATE)}" .agent/briefs/<name>-brief.md`);
  process.exit(1);
}
console.log(`OK — no new brief violations (${standing.length} standing-debt brief(s) reported above).`);
```

**`scripts/check-report.mjs` — every report carries the 5-row summary table.**

```js
#!/usr/bin/env node
// scripts/check-report.mjs — every .agent/reports/*-report.md that landed after the newest release
// must carry all five summary-table row labels. Finding that produced this: 0 of 16 reports in one
// day carried even one. Uses git commit dates when the file is tracked (robust across clones) and
// falls back to mtime when it is not — a documented same-machine limit, stated rather than hidden.
// Same frozen grandfather baseline as check-brief.mjs.
// Env overrides for self-tests: REPORT_DIR, GITROOT, GATE_BASELINES.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const REPORT_DIR = process.env.REPORT_DIR || join(ROOT, '.agent', 'reports');
const BASELINE_FILE = process.env.GATE_BASELINES || join(ROOT, 'docs', 'process', 'gate-baselines.json');

const HEADERS = ['**Before**', '**Done**', '**Remaining**', '**Position**', '**Next**'];

function loadBaseline(key) {
  if (!existsSync(BASELINE_FILE)) return new Set();
  try { const j = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')); return new Set(Array.isArray(j[key]) ? j[key] : []); }
  catch { return new Set(); }
}

function latestReleaseDate() {
  // NOTE: argv array (execFileSync), never a shell string — "release(v" has an unbalanced "(" that a
  // shell chokes on. This exact bug cost a debugging round; keep it as an array.
  try {
    const log = execFileSync('git', ['log', '--format=%H%x09%cI%x09%s', '-n', '500'], { cwd: GITROOT, encoding: 'utf8' });
    return log.split('\n').filter(Boolean).map(l => l.split('\t'))
      .filter(([, , s]) => /^release\(v\d+\)/.test(s)).map(([, d]) => d).sort().at(-1) ?? null;
  } catch { return null; }
}

function trackedCommitDate(abs) {
  try {
    const rel = relative(GITROOT, abs).replaceAll('\\', '/');
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { cwd: GITROOT, encoding: 'utf8' }).trim() || null;
  } catch { return null; }
}

if (!existsSync(REPORT_DIR)) { console.log('OK — no report directory yet, nothing to scan.'); process.exit(0); }
const cutoff = latestReleaseDate();
const baseline = loadBaseline('report');
const files = readdirSync(REPORT_DIR).filter(f => f.endsWith('-report.md'));
let scanned = 0, checked = 0;
const errs = [], standing = [];

for (const f of files) {
  scanned++;
  const abs = join(REPORT_DIR, f);
  const landedAt = trackedCommitDate(abs) ?? new Date(statSync(abs).mtimeMs).toISOString();
  if (cutoff && !(landedAt > cutoff)) continue;
  checked++;
  const text = readFileSync(abs, 'utf8');
  const missing = HEADERS.filter(h => !text.includes(h));
  if (!missing.length) continue;
  if (baseline.has(f)) {
    const ageDays = Math.max(0, Math.round((Date.now() - new Date(landedAt).getTime()) / 86400000));
    standing.push(`${f} (age ~${ageDays}d, grandfathered): missing ${missing.join(', ')}`);
  } else {
    errs.push(`${f}: missing summary-table row(s): ${missing.join(', ')}`);
  }
}

console.log(`report files scanned: ${scanned} · newer than last release (${cutoff ?? 'n/a'}): ${checked} · grandfathered: ${baseline.size}`);
if (standing.length) {
  console.log(`\nSTANDING DEBT (reported, not blocking — ${standing.length}):`);
  for (const s of standing) console.log('  ~ ' + s);
}
if (errs.length) {
  for (const e of errs) console.error('  x ' + e);
  console.error(`\nFAIL: ${errs.length} report(s) missing the 5-row summary table and NOT grandfathered: this is new debt.`);
  console.error('  Add the fixed table: Before · Done · Remaining · Position · Next.');
  process.exit(1);
}
console.log(`OK — no new summary-table violations (${standing.length} standing-debt report(s) above).`);
```

**`scripts/gate-lessons.mjs` — no release ships without its lessons recorded.**

```js
#!/usr/bin/env node
// scripts/gate-lessons.mjs — reads the newest dated lesson from the lessons log, counts release
// commits dated after it, and FAILS when a release shipped without lesson coverage. Written because
// the lessons log froze while five paid-for lessons lived only in someone's private memory.
// Explicit, visible escape (in the document itself, so it is inheritable by any agent):
//   **No-lesson declaration (YYYY-MM-DD):** <arc name> — no new lesson, reviewed.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = process.env.LESSONS || join(ROOT, 'docs', 'process', 'LESSONS.md');
const text = readFileSync(DOC, 'utf8');

// Entry format: **L14 · <title, may wrap across lines> (2026-07-21).**
const dated = [];
{
  const re = /\*\*L(\d+)\s*·/g;
  let m;
  while ((m = re.exec(text))) {
    const close = text.indexOf('**', re.lastIndex);
    const title = text.slice(re.lastIndex, close === -1 ? re.lastIndex + 400 : close);
    const d = title.match(/(\d{4}-\d{2}-\d{2})/);
    if (d) dated.push({ n: +m[1], date: d[1] });
  }
}
const decls = [...text.matchAll(/\*\*No-lesson declaration \((\d{4}-\d{2}-\d{2})\)/g)].map(m => m[1]);
if (!dated.length) { console.error('FAIL: no dated lesson entries found.'); process.exit(1); }

const last = dated.reduce((a, b) => (b.n > a.n ? b : a));
const cover = [last.date, ...decls].sort().at(-1);
console.log(`last lesson: L${last.n} (${last.date}) · declarations: ${decls.length} · coverage date: ${cover}`);

const log = execSync('git log -n 500 --pretty=%cs%x09%s', { cwd: ROOT, encoding: 'utf8' });
const uncovered = log.split('\n').filter(Boolean)
  .map(l => { const i = l.indexOf('\t'); return { d: l.slice(0, i), s: l.slice(i + 1) }; })
  .filter(c => /release\(v\d+/.test(c.s) && c.d > cover);
console.log(`release commits dated after ${cover}: ${uncovered.length}`);
for (const c of uncovered.slice(0, 15)) console.log(`  ${c.d}  ${c.s.slice(0, 90)}`);

if (uncovered.length) {
  console.error(`\nFAIL: ${uncovered.length} release(s) shipped after the last lesson/declaration.`);
  console.error('  Write the arc\'s lessons into the log, or add an explicit line:');
  console.error('  **No-lesson declaration (YYYY-MM-DD):** <arc name> — no new lesson, reviewed.');
  process.exit(1);
}
console.log('OK — no release without lesson coverage.');
```

**`scripts/check-ledger.mjs` — nothing in the air, and only *new* breakage blocks.** This one exists to
demonstrate the baseline-diff mechanism (§6.1) in full. The domain rule it enforces — *every tracked item
has exactly one landing: a named phase, or a deferral with a defined re-open trigger, or a registered
discussion task* — is worth adopting on its own; the diff is worth adopting regardless of the rule.

```js
#!/usr/bin/env node
// scripts/check-ledger.mjs — every row in the roadmap ledger must name its landing; every remainder
// bullet must state its re-open trigger. Plus the mechanism that matters:
//
// WORSENING-ONLY BLOCKING. Every finding is computed TWICE — once against the roadmap content at the
// git baseline ref (default HEAD: the tree before this commit) and once against the working tree —
// then diffed by exact message text. Present in BOTH = pre-existing debt: printed loudly as STANDING
// DEBT, never blocks. Present only in CURRENT = introduced or worsened by this change: blocks.
// Structural failures (the section missing entirely) always block, because nothing else can even be
// computed without them.
// KNOWN LIMIT, stated not hidden: the CURRENT side reads the working tree, not the git index, so
// unstaged edits are included too. Acceptable for a fast local gate; CI re-runs after checkout where
// working tree == committed tree exactly.
// Env: ROADMAP, GITROOT, BASELINE_REF (default HEAD), BASELINE_ROADMAP (bypass git, for self-tests).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GITROOT = process.env.GITROOT || ROOT;
const roadPath = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP.md');
const road = readFileSync(roadPath, 'utf8');

function analyze(text) {
  const structural = [], findings = [];
  const start = text.search(/^## Ledger\b/m);
  if (start === -1) structural.push('ledger section "## Ledger" not found in the roadmap');
  const after = start === -1 ? '' : text.slice(start);
  const end = after.slice(1).search(/^## (?!Ledger)/m);
  const sec = end === -1 ? after : after.slice(0, end + 1);

  const rows = sec.split('\n').filter(l =>
    l.startsWith('|') && !/^\|[\s|:-]+\|?$/.test(l) && !/^\|\s*Phase\s*\|/i.test(l));
  for (const r of rows) {
    const landing = (r.split('|')[1] ?? '').trim();
    if (!/^(Phase\s*\S|Thread\s*\S|Baseline)/i.test(landing))
      findings.push(`ledger row without a named landing: "${r.slice(0, 70)}"`);
  }
  if (!findings.length && rows.length < 3) findings.push(`suspiciously few ledger rows (${rows.length}) — table malformed?`);

  const rest = sec.split('Remainder')[1] ?? '';
  const bullets = rest.split('\n').filter(l => /^- /.test(l));
  if (!bullets.length) findings.push('no remainder bullets found after "Remainder"');
  for (const b of bullets) if (!/trigger:/i.test(b)) findings.push(`remainder item with no re-open trigger: "${b.slice(0, 70)}"`);

  for (const bad of ['deferred indefinitely', 'not handled', 'TBD'])
    if (sec.includes(bad)) findings.push(`forbidden marker in the ledger: "${bad}"`);

  return { structural, findings, rowsCount: rows.length, bulletsCount: bullets.length };
}

const current = analyze(road);

function loadBaseline() {
  if (process.env.BASELINE_ROADMAP)
    return existsSync(process.env.BASELINE_ROADMAP) ? readFileSync(process.env.BASELINE_ROADMAP, 'utf8') : null;
  const ref = process.env.BASELINE_REF || 'HEAD';
  try {
    const rel = relative(GITROOT, roadPath).replaceAll('\\', '/');
    return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: GITROOT, encoding: 'utf8' });
  } catch { return null; }
}

const baselineText = loadBaseline();
// SAFE DEFAULT: no baseline available → every finding counts as new. "Can't tell if it's new" must
// never read as "not new".
const baseline = baselineText != null ? analyze(baselineText) : { structural: [], findings: [] };
const baseSet = new Set(baseline.findings);
const newFindings = current.findings.filter(f => !baseSet.has(f));
const standing = current.findings.filter(f => baseSet.has(f));
const blocking = [...current.structural, ...newFindings];

console.log(`ledger: ${current.rowsCount} row(s) scanned, ${current.bulletsCount} remainder bullet(s).`);
console.log(baselineText != null
  ? `baseline: ${process.env.BASELINE_ROADMAP ? 'fixture' : `git ${process.env.BASELINE_REF || 'HEAD'}`}`
  : 'baseline: NONE AVAILABLE — every finding below treated as new (safe default).');

if (standing.length) {
  console.log(`\nSTANDING DEBT (pre-existing at the baseline, reported not blocking — ${standing.length}):`);
  for (const f of standing) console.log('  ~ ' + f);
}
if (blocking.length) {
  console.error(`\nNEW OR STRUCTURAL (this change introduces or worsens these — blocking — ${blocking.length}):`);
  for (const f of blocking) console.error('  x ' + f);
  process.exit(1);
}
console.log(`\nOK — no new or worsened finding in this change (${standing.length} standing-debt finding(s) above).`);
```

**`docs/process/gate-baselines.json` — the frozen grandfather list.**

```jsonc
{
  "_note": "Frozen grandfather list. Filenames here are PRE-EXISTING debt as of the date below: the per-file gates report them as standing debt but never block a commit on them. This list is NOT auto-updated. Adding a file to it later must be a deliberate human decision — silently grandfathering a new noncompliant file would recreate the exact flaw this closes. A listed file that becomes compliant is harmless to leave here.",
  "_frozen_at": "YYYY-MM-DD",
  "brief": [],
  "report": []
}
```

### 5.6 Leg 3 and leg 4 — CI

```yaml
# .github/workflows/discipline.yml
name: discipline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # LAYERING: .githooks/pre-commit gives fast local feedback and is bypassable by design — a human can
  # always skip a local hook (--no-verify). THIS job is the authority: it runs on every push and PR and
  # cannot be skipped. A time-based rule (index/graph staleness) is deliberately NOT enforced here: a
  # push job only fires on a push, so a rule going stale from inaction between pushes would never trip.
  discipline:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # the gates read git log history; a shallow checkout silently starves them
                           # of the commits they compare against — and then prints green.
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - name: Verify hooks are provisioned
        run: |
          # A clone that never ran `npm install` has no hooksPath — catch that here rather than
          # discovering it after a week of unhooked commits.
          test -x .githooks/pre-commit
      - name: Run the discipline gate
        run: node scripts/check-meta.mjs
      - name: Run the gate self-tests
        run: node scripts/tests/run-all.mjs
```

```yaml
# .github/workflows/freshness.yml
name: freshness

# This rule is not a property of any single commit — it is a property of ELAPSED TIME and drift, which
# is exactly why neither a pre-commit hook nor a push-triggered job ever caught it: nothing was pushed
# during the evening in which hours of documents went stale. A schedule catches a thing that goes stale
# purely from inaction, and fails VISIBLY, without ever blocking a legitimate push.
#
# Explicitly rejected: a background daemon doing this continuously. A daemon can die silently — which
# is exactly how the audited failure happened. A missing scheduled run shows up as a missing check in
# the platform's own UI; a dead daemon shows up as nothing. "Not running" must itself be an alarm.
on:
  schedule:
    - cron: '17 2 * * *'   # nightly; the odd minute avoids the platform's top-of-hour scheduling pile-up
  workflow_dispatch: {}    # manual "run it now", for verifying the workflow itself

jobs:
  freshness:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - name: Check index/graph freshness
        run: node scripts/check-index-fresh.mjs
        env:
          CI: true
```

**One trap worth naming for leg 4.** A freshness check that compares filesystem mtimes works locally and
is meaningless in CI, because generated artifacts are usually git-ignored and simply do not exist in a
fresh checkout. Give such a checker **two modes**: local mtime comparison (fast, honest about being a
same-machine heuristic) and a CI mode that compares **git commit dates** against a small committed proxy
artifact. State the limitation of each mode in the file's own header.

### 5.7 Gates must be self-tested — "a checker that has never been seen to fail is not a checker"

Every gate gets a self-test that proves it goes **red on known-bad input** before it is trusted to go
green. This is §3's red-before-green applied to the enforcement machinery itself.

```js
// scripts/tests/test-helpers.mjs — disposable fixtures so tests never touch real repo state.
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let failures = 0, total = 0;

export function assertExit(label, result, expectedCode) {
  total++;
  if (result.status !== expectedCode) {
    failures++;
    console.error(`FAIL  ${label}: expected exit ${expectedCode}, got ${result.status}`);
    console.error(`      stdout: ${(result.stdout || '').toString().split('\n').slice(0, 6).join(' | ')}`);
    console.error(`      stderr: ${(result.stderr || '').toString().split('\n').slice(0, 6).join(' | ')}`);
    return false;
  }
  console.log(`PASS  ${label} (exit ${result.status})`);
  return true;
}

export function runNode(scriptPath, args, env) {
  return spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
}

export function tempDir(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }

export function writeFile(dir, name, content) {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content, 'utf8');
  return p;
}

export function setMtime(path, isoDate) { const d = new Date(isoDate); utimesSync(path, d, d); }

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

// A throwaway repo with commits at controlled dates/subjects, for checkers that read `git log`.
export function makeGitRepo(commits) {
  const dir = tempDir('gate-test-repo-');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Gate Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  let i = 0;
  for (const c of commits) {
    i++;
    writeFileSync(join(dir, `f${i}.txt`), c.subject, 'utf8');
    git(dir, ['add', '.']);
    const env = {
      GIT_AUTHOR_DATE: c.date, GIT_COMMITTER_DATE: c.date,
      GIT_AUTHOR_NAME: 'Gate Test', GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Gate Test', GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    const r = spawnSync('git', ['commit', '-q', '--no-gpg-sign', '-m', c.body ?? c.subject],
      { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
    if (r.status !== 0) throw new Error(`git commit failed: ${r.stderr}`);
  }
  return dir;
}

export function summary(name) {
  console.log(`\n${name}: ${total - failures}/${total} assertions passed.`);
  if (failures) { console.error(`${name}: ${failures} FAILURE(S).`); process.exitCode = 1; }
}
```

```js
// scripts/tests/test-check-board-fresh.mjs — worked example: RED first, then GREEN.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertExit, runNode, makeGitRepo, writeFile, summary } from './test-helpers.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-board-fresh.mjs');
const repo = makeGitRepo([
  { subject: 'feat: something',  date: '2026-01-01T10:00:00Z' },
  { subject: 'release(v10)',     date: '2026-01-02T10:00:00Z' },
  { subject: 'release(v11)',     date: '2026-01-03T10:00:00Z' },
]);

// RED: the board is behind the newest release.
const stale = writeFile(repo, 'board-stale.md', '# Board\n\n> BASELINE: v10\n');
assertExit('stale board FAILS', runNode(SCRIPT, [], { BOARD: stale, GITROOT: repo }), 1);

// RED: the board declares nothing at all.
const none = writeFile(repo, 'board-none.md', '# Board\n\nno declaration here\n');
assertExit('undeclared board FAILS', runNode(SCRIPT, [], { BOARD: none, GITROOT: repo }), 1);

// GREEN: the board matches.
const fresh = writeFile(repo, 'board-fresh.md', '# Board\n\n> BASELINE: v11\n');
assertExit('fresh board PASSES', runNode(SCRIPT, [], { BOARD: fresh, GITROOT: repo }), 0);

summary('check-board-fresh');
```

Write one of these per gate. `scripts/tests/run-all.mjs` aggregates them:

```js
#!/usr/bin/env node
// scripts/tests/run-all.mjs — runs every gate self-test and aggregates exit codes.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(DIR).filter(f => f.startsWith('test-check-') && f.endsWith('.mjs')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n----- ${f} -----`);
  if (spawnSync(process.execPath, [join(DIR, f)], { stdio: 'inherit' }).status !== 0) failed++;
}
console.log(`\n${files.length - failed}/${files.length} test files passed.`);
process.exit(failed ? 1 : 0);
```

---

## 6. The three gate design principles

Each of these was learned by shipping a gate that violated it.

### 6.1 Judge the CHANGE, not the repository's standing state

**The failure that produced it.** After the gates went in, the very next commit — one that *paid down*
compliance debt — was **blocked by the gate's own pre-existing red state**: a stale index and twenty-two
historical files the commit did not touch. The only way through was a blanket bypass. A gate that blocks
the commit meant to fix it teaches the escape hatch to become routine, and a routine escape hatch is
**exactly as protective as no gate**.

**The rule.** A gate blocks on findings this change **introduces or worsens**, not on findings that
already existed. Two mechanisms, pick per gate:

- **Baseline diff** for content gates: compute findings twice — once from the file at the git baseline
  ref, once from the working tree — and block only on the set difference. (See `check-ledger.mjs`.)
- **Frozen grandfather list** for per-file gates: a tracked JSON file naming pre-existing offenders. Any
  file on it prints as standing debt with its age; any file off it is judged normally. **Never
  auto-grow the list** — that would recreate the flaw.

Three corollaries you must not skip:

- **Safe default:** if a baseline cannot be established, treat **every** finding as new. "Can't tell if
  it's new" must never read as "not new."
- **Always-blocking classes:** structural failures (the section missing entirely) block regardless of the
  diff, because nothing else can even be computed without them.
- **Not everything deserves this leniency.** Where the invariant is fixable by a single cheap edit
  reachable from the very commit that trips it — update the board header line, write the release message
  correctly, add the lesson — **blocking is the correct incentive**, and the "separate heavy action"
  excuse does not apply.

### 6.2 Publish what was scanned, not only the verdict

**The failure.** The landing gate printed `OK — 18 ledger rows land in named phases`. The document had
two ledger sections; the parser split on the first heading and never saw the second. **Sixty-three rows,
including every row created that day, sat entirely outside the scan while the gate reported green.**

> **A gate that reports green on what it never scanned is worse than no gate: it buys confidence nobody
> earned.**

**The rule.** Every gate prints its **scan count** as part of normal output, on every run:

```
brief files scanned: 24 · newer than template: 6 · grandfathered: 22
ledger: 18 row(s) scanned, 2 remainder bullet(s).
release commits scanned: 41 · in enforcement scope (>= 2026-08-01): 4
```

Had the gate printed "scanned 18 of 63 rows", the blindness would have been obvious the first time it
ran. This is the same defect class as a computed value nobody reads, applied one level up: a check whose
coverage nobody reads.

**Its sibling, worth naming:** a coverage gate that cannot tell **what** it is covering has the same
disease. The lessons gate checked only that a lesson was *recent* — never that it covered what actually
broke — so five product-bug lessons kept it green while an entire process collapse went unrecorded.
Where you can, make a coverage gate reference the thing it is supposed to cover: if a gate failed during
the session, require the closing lesson to **name that gate**.

### 6.3 "Not running" must itself be an alarm

**The failure.** The gate script existed, was documented as "mechanical enforcement", exited nonzero when
invoked, and was **wired to nothing**. Its sole call site was a helper script no commit went through. It
ran zero times across a working day in which four releases shipped over a red gate. The problem was never
the red — it was that **nobody was ever exposed to it**.

**The rule.**
- Prefer **event-driven** enforcement (git hooks, harness lifecycle hooks) and **CI** over anything that
  must be started and kept alive.
- **Explicitly reject a background daemon or watcher** for gate enforcement. A daemon can die silently. A
  missing scheduled CI run appears as a missing check in the platform's own UI; a dead daemon appears as
  nothing at all.
- **Verify the wiring itself**, not just the script: after installing hooks, deliberately make a
  known-bad commit and confirm it is blocked. Add a CI step that asserts the hook files exist and are
  executable (see §5.6). A gate you have never watched block something is a gate you have not installed.

---

## 7. The escape hatch

You need one — a gate with no override gets disabled wholesale the first time it is genuinely wrong, and
then you have nothing. But the first version of this hatch was a single environment variable that
**skipped every gate, silently, leaving no record** beyond that terminal's scrollback. It was used twice
within a day of being introduced.

**The four properties a correct escape hatch has:**

1. **Named per gate, never blanket.** `GATE_SKIP=check-brief` skips exactly that gate; every other gate
   still runs. A full bypass exists (`GATE_SKIP=ALL`) but must be **typed out in full** and is never a
   default, never implied, never a bare flag.
2. **Logged before the action proceeds.** The calling hook appends a JSON line —
   timestamp, hook, gates skipped, branch — to a tracked log **before** invoking the gate, so a skip is
   recorded even if everything downstream fails.
3. **Resurfaced on later runs.** The gate orchestrator prints the recent contents of that log at the top
   of **every** run, including session start and post-compaction. A skip cannot quietly age out of view;
   it reappears every single time discipline is checked until someone deals with it.
4. **Distinguished from standing debt.** Standing debt (§6.1) is *reported and not blocking* — it does
   not need the hatch at all. If someone reaches for the hatch, that means the gate believes this change
   introduces something new, which deserves a decision rather than a reflex.

A visible in-document escape also works well for prose-shaped rules — e.g. the lessons gate accepts a
literal line `**No-lesson declaration (YYYY-MM-DD):** <arc> — reviewed, no new lesson.` Written into the
document itself, it is inheritable by any agent that reads the document, unlike an environment variable
that lives only in one person's shell history.

---

## 8. The lessons mechanism

### 8.1 How a failure becomes a gate rather than an anecdote

Every failure gets an entry with exactly three parts:

```
**L<N> · <one-line statement of what happened> (<date>).**
<What happened, concretely, with the artifacts — commits, file paths, numbers.>
Root cause: <the single mechanism, not a list of contributing factors>.
Gate: <the specific check, hook, template line, or script that now prevents recurrence>.
```

The third part is the whole point. **"Be more careful" is not a gate.** A gate names a mechanism: a
script, a hook, a template field, a required phrase in a commit message. If you cannot name one, say so
explicitly — that is honest, and it flags the lesson as still-unprotected.

Then close the loop:

- Maintain a **failure-mode → gate map** table: one row per historical failure, naming the gate that now
  catches it. When you add a gate, add the row. When you find a failure with no row, you have found a
  hole.
- Record **successes too** — an "adopted wins" section. Patterns that worked get repeated on purpose
  rather than rediscovered. Untracked lessons get relearned at full price.
- **Gate the gate**: no release ships after the last recorded lesson (§5.5's `gate-lessons.mjs`).
- Close every significant work-arc with a lessons pass, and deposit any genuinely reusable external
  documentation you found into your shared knowledge base (§9.1) so the next session starts ahead.

### 8.2 The strongest generalised lessons — carry these from day one

These are the ones that transfer to any project, in any domain. Each cost real time on the source
project. You can have them for free.

1. **A rule enforced by a script survives a busy day; a rule enforced by discipline does not.** On the
   audited day, *every* rule that was breached was memory-dependent, and *every* rule with a live check
   held. The fix is never "try harder" — it is moving the rule behind automation.
2. **Rigour decays monotonically under load, and the decay is invisible from inside.** Watch the *shape*
   of your evidence over a day, not just its presence. When today's release note is shorter than
   yesterday's, that is the signal.
3. **A summary written from recollection is not the source.** When you write anything that *represents* a
   source document — a rules file, an index, a brief, a summary — open the source and work through it
   section by section. A rules-file was once written from memory and omitted the two sections the source
   document itself calls "the core" and "the most important rule".
4. **"I remember this skill/rule" is a red flag.** Rules are re-read at invocation, never recalled. And
   the corollary that is easy to miss: **a gate reports whether the rules were followed; only reloading
   them restores the ability to follow them** (§5.2). After compaction, the second is what you need.
5. **A documented intent is not an implemented mechanism — and that gap is worse than an omission.** Two
   teaching documents described, in precise words, that the rules were "re-anchored right after the event
   that erases them", while the mechanism they actually specified ran only a compliance checker. The
   intent was described; the implementation was absent. A reader sees an accurate sentence and concludes
   the ground is covered — **an accurate description of a mechanism that does not exist is more harmful
   than silence, because silence at least does not stop the search.** The test: for every sentence of the
   form "the mechanism does X", point at the line that does X. If you cannot, write it as an intention.
6. **Documentation written before the mechanism was proven to work inherits the author's
   misunderstanding.** Same incident: the requirement was misunderstood, and two documents were written
   *from* the misunderstanding — after which it looked like two independent sources agreeing. **Documents
   are not corroborating evidence when they share an author.** Write the document against the running
   implementation, and have someone other than the requirement's interpreter verify it.
7. **Occam first.** Rule out typo, stale cache, wrong path, unfinished build, missing env var **before**
   race conditions and framework bugs. **If your hypothesis needs three independent things to be wrong at
   once, stop and look for a single-point failure.** Three plausible explanations died in one session
   before a single character-class bug was found.
8. **Instrument the boundary *between* layers.** When something hangs while the machine is provably idle,
   timestamp both sides of the boundary — client send vs server receive, process vs process — before
   theorising further *within* a layer that is already instrumented and already showing nothing. Five
   measurement campaigns tallied a defect that one boundary-instrumented probe found in an afternoon.
9. **Measurement campaigns certify a stable system; they do not diagnose an unstable one.** While any
   unexplained failure is open, stop measuring and debug it to root cause.
10. **Verify the measurement before trusting the measurement.** Two probes lied in one evening: one
   wrapped its runs in a binary that does not exist on that platform, so all five "runs" executed
   nothing; another sampled the wrong process name. When a measurement is surprising, first prove the
   probe ran the workload at all.
11. **A worker/concurrency ceiling measured on a contaminated machine is not a ceiling.** Verify the
   machine is idle first, and sample **six to nine** runs, not three — a one-in-six flake hides
   completely in a three-run check.
12. **An allow-list of directories is a silent deny-list of everything else.** A sync script staged three
    directories and cheerfully reported success while leaving the single most important root-level file
    uncommitted, three times running. Any script that reports a push must verify it staged what the task
    actually changed.
13. **Never kill a long job mid-flight; every setup owns its teardown.** Repeated kill-and-restart during
    a measurement left a supervising process alive that respawned its workers, producing a server that
    accepted connections and never responded — and wedged the port for every subsequent run. The
    debugging methodology created the failure being debugged. If you must kill, kill the whole tree from
    the parent and then **verify the resource is released**.
14. **Read "target closed" / "connection lost" as *the condition never became true*, not as a crash.**
    Two investigations lost hours hunting a crash that never happened. The one-minute discriminator: run
    the failing test **alone**. Contention vanishes in isolation; a real defect does not.
15. **Never set a low output cap on a model call.** A modest-looking cap plus high reasoning effort
    silently truncates structured output mid-stream: no error, just a confident wrong answer. Billing is
    on tokens actually used, so a high cap is free headroom.
16. **A user's correction about how their product is actually used is evidence, not context.** It is
    frequently the fact that collapses three wrong hypotheses at once.
17. **Question the ingredient, not just the patch.** When one component repeatedly causes trouble,
    evaluate a genuinely better alternative instead of stacking band-aids. Find alternatives by research;
    judge them on evidence.
18. **When stuck, research — do not attempt fix #4.** After three failed fixes, **stop**. Read the
    official documentation, help pages, and issue trackers of every product involved, in detail. Two
    focused documentation-reading sessions cracked in under an hour what a day of guessing had not.
19. **A "while I'm here" fix is scope creep.** Note it; do not do it. And never delete code whose purpose
    you do not understand — check history, comments and tests first; if the purpose stays unclear, keep
    it and record the uncertainty.
20. **Know when NOT to apply any of this.** A stack trace naming file and line gets fixed, not
    fault-treed. A single-task change with one clear requirement does not get a pre-mortem. This
    discipline is heavy; ceremony applied where it adds nothing is cost with no evidence.

---

## 9. Tooling

The division of labour is fixed, and it is a discipline rule rather than a preference — because it
decayed once under a long context and had to be re-instated as a standing rule:

> **Symbol tool** = locate-exact and edit-exact on live code · **Graph** = cross-document provenance and
> relationships · **Plain text search** = a **declared fallback**, never the default.

"Declared" means literal: if you fall back to text search, say so in your report and say why. On the
source project the human noticed the drift himself and said, in effect, *"if you are not using these
tools, it means your rules have been erased"* — which became a meta-rule: **noticing that you have
stopped following the tool rules is itself the signal that your context has degraded. Stop, re-read the
session-start checklist, and restart the task.**

### 9.1 The document/relationship graph (`graphify`)

**What it is.** A tool that turns a folder of files — code, documents, papers, images, video — into a
persistent, queryable knowledge graph with community detection and an honest provenance audit trail
(edges labelled `EXTRACTED` / `INFERRED` / `AMBIGUOUS`).

**Why it is a rule, not a curiosity.** A discovery sweep on the source project refuted **42 of 261
findings — 16%** — and *every single refutation had the same shape*: a grep, a quote, or one artifact
trusted without tracing what the program actually executes. **A grep finds a string. The graph holds the
relationship, which is what the claim was actually about.** A specified mechanism was described in a
document and implemented in code, and for months nothing connected the two.

**When it is the right instrument.** Any question of the form:
- "What specifies this function?"
- "What tests prove this behaviour?"
- "Does anything actually read this value?"
- "How does this tool/framework work?" (see the global corpus below)

**Usage shape** (as observed in this repository — verify current flags against the tool's own `--help`
and documentation before relying on them):

```sh
graphify <path> --mode deep          # full build, aggressive inferred edges
graphify <path> --update --mode deep # incremental re-extraction
graphify query "<expanded tokens>"   # BFS traversal, broad context
graphify query "<tokens>" --dfs      # trace one specific chain
graphify path "A" "B"                # shortest path between two concepts
graphify explain "<node>"            # a node and its neighbours
graphify god-nodes --top 25          # what this corpus is actually about
graphify add <url>                   # fetch a URL into the corpus
graphify watch <path>                # continuous CODE-graph rebuild
```

**Installation: verify against the tool's own documentation.** On the source machine the CLI lives at
`~/.local/bin/graphify` and is also exposed as an agent skill; the installation route itself is not
established from this repository, so **do not guess an install command** — read the tool's own README.

**Five operational rules that were learned the hard way:**

1. **Expand your query against the graph's own vocabulary first.** Matching is case-folded substring plus
   IDF: **no stemming, no synonyms, no cross-language matching.** A naive natural-language query returns
   noise — the first attempt on the source project pulled 113 nodes including an unrelated lint command.
   If no vocabulary token matches, **say the corpus has no relevant vocabulary and stop. Never invent
   tokens to force a hit.**
2. **An edge is a lead, not a verdict.** `INFERRED` and `AMBIGUOUS` edges are emitted deliberately.
   Query to find the evidence, then **read the source** before asserting anything.
3. **A stale graph is worse than no graph, because it is trusted and wrong.** Refresh it whenever
   documents change, and gate the freshness (§5.6, leg 4).
4. **Know which default you are getting.** The incremental/update path is typically the code/AST path and
   may re-extract **no** documents at all; a pure-code corpus may skip semantic extraction entirely.
   Both fail by appearing to succeed. Overriding either is a deliberate choice to state out loud.
5. **Chunk by word budget, not file count.** Deep-mode extraction emits far more per chunk; a chunking
   scheme based on file count silently blows the extraction agent's output limit when a chunk happens to
   land on dense files, and the chunk is simply never written.

**Local vs global corpus.** Keep two: a **local** graph of *your* code and documents, and a **global**,
cross-project corpus of *vendor and methodology documentation*. Then adopt this rule:

> **Before searching the web for any documentation or external help — a tool, a framework, an API's
> capabilities, a vendor's specs — query the global corpus first.** When it is a miss, search the web,
> then apply the **usefulness gate**: *"is this source useful, and likely to be needed again — here or on
> another project?"* If yes, **deposit the documentation into the global corpus** so no future session
> repeats the search. If it is a genuine one-off, skip the deposit and say so.

**Honest limit on deposits:** the global corpus is shared across projects. Deposit only documentation of
general value. **Never deposit your project's private documents, and never anything containing a
credential.**

### 9.2 The symbol-level code tool (`serena`)

**What it is.** A language-server-backed semantic code toolkit exposed to the agent as an MCP server. It
offers symbol-level operations rather than text operations:

- `find_symbol` — locate a definition
- `find_referencing_symbols` — who calls or reads this
- `get_symbols_overview` — map a file's structure without reading it all
- `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol` — surgical edits
- `rename_symbol`, `safe_delete_symbol` — refactors with reference awareness
- `find_implementations`, `get_diagnostics_for_file` — navigation and live diagnostics

**When it is the right instrument.** Any symbol-shaped work on live code — and this is the point:
**not just searching, but the editing itself.** On a ten-thousand-line source file, a surgical symbol edit
beats a fragile text match, which will eventually match the wrong occurrence and do so silently.

**Read its manual before leaning on it.** It exposes an instructions tool of its own (`initial_instructions`)
and its server tells you to call it before coding tasks. Do that. Tool APIs evolve, and a mis-applied
symbol edit on a monolith is worse than a careful text one.

**Installation: verify against the tool's own documentation.** What *is* established from this repository
is the **connection shape**, and it matters:

```jsonc
// .mcp.json — one long-lived server, shared by every agent
{
  "mcpServers": {
    "serena": { "type": "http", "url": "http://127.0.0.1:9121/mcp" }
  }
}
```

**Why URL-based and not stdio.** With the default stdio configuration, **every subagent spawns its own
server instance**, each with its own language servers and its own dashboard on the next free port —
observed on the source machine: four concurrent instances, dashboards flapping between ports, language
servers duplicated per instance. That is waste, confusion, and a bookmarked dashboard pointing at a dead
process. Run **one** long-lived server on a fixed port with an HTTP/SSE transport and point every agent at
it as a URL-based server. **Verify the exact start-up flags against the tool's own `--help`.** After
wiring, verify: one server process, one dashboard, tools still resolving from inside a subagent, and the
project still activated across agents.

Until that is wired and verified, enable the symbol tool only for agents doing genuinely symbol-shaped
work — otherwise the per-agent spawn cost outweighs the benefit.

### 9.3 Plain text search

Text search is correct for exactly one thing: **literal, non-code text whose location you do not know**,
and cases where the other two instruments have no vocabulary for the question. It is fast and it is
honest about what it does: it finds a string.

What it cannot do is tell you whether that string is *reached*, *read*, or *related to* anything — and
that is almost always the actual question. Declare it when you use it.

### 9.4 A note on skills and re-reading

If your harness supports reusable "skills" or instruction modules, encode recurring lessons as skills and
**re-read them at invocation, every time**. Two on the source project were born from real failures and
are worth reproducing in spirit anywhere:

- *verify-against-the-runtime-path* — never assert from an artifact without tracing what the program
  actually executes.
- *no-inert-shipment* — never ship a computed value with no live consumer.

And the always-loaded rules file (`CLAUDE.md`, `AGENTS.md`, or your harness's equivalent) matters more
than it looks: **subagents inherit that file but do not inherit the controller's conversation.** Any rule
that lives only in the conversation reaches zero subagents. Keep the always-loaded file small, keep the
authoritative discipline document separate, and have the small file say plainly which document is
authoritative where they differ.

"Re-read at invocation" has a machine-side counterpart, and it is the thing this project got wrong once:
after compaction, *nothing* is at its invocation point any more — the rules are simply gone. That is what
the rule-reload emission in **§5.2** is for. Re-reading skills by hand and reloading the rules by hook are
the same principle applied at two different scales.

---

## 10. The staged adoption path

Do not try to build all of this at once. It will not be finished, and a half-installed discipline is
worse than none because it advertises enforcement it does not have. Install it in this order — each stage
is independently useful and each is a working state.

### The first hour — the parts with the highest ratio of protection to effort

1. Write the **discipline document** (`docs/process/development-discipline.md`): the verification gate
   (§3), the waiver rule (§4), the operating model (§1), and an empty lessons log.
2. Write the **always-loaded rules file** for your harness, pointing at that document as authoritative
   and inlining only the two rules that get skipped when nobody is looking: **the verification gate** and
   **the waiver rule**.
3. Create the **brief template** (§2.5) and the **status board** file with a `BASELINE: vNNN` header.
4. Adopt the two habits that cost nothing and catch the most: **red before green**, and **exit codes
   captured directly, never through a pipe**.

At the end of the first hour you have no automation, and you already have the rules that matter most in a
place every subagent inherits.

### The first day — make the rules mechanical

5. Write `scripts/check-meta.mjs` (§5.4) with **one** real gate behind it. Start with
   `check-board-fresh.mjs` — it is twenty lines and it protects the source of truth every summary reads.
6. Write that gate's **self-test** (§5.7) and watch it go **red** on a known-bad fixture before you trust
   it green.
7. Wire **leg 2** (`.githooks/pre-commit`) and the `core.hooksPath` auto-provision (§5.1). Then
   **deliberately make a bad commit and watch it get blocked.** A gate you have never seen block
   something is not installed.
8. Wire **leg 3** (the CI `discipline` job, §5.6) — this is the one that is actually the authority.
9. Wire **leg 1** (the session-start / post-compaction hook, §5.2) with **all three emissions** — gate,
   position digest, and **rule reload**. First prove your harness injects hook stdout into context; then
   trigger a compaction and confirm the rule text is actually present afterwards. Wiring only the gate
   here is the documented mistake (§8.2 #5): it looks complete and restores nothing.

### The first week — coverage, then time, then knowledge

10. Add the remaining gates one at a time, **each with its self-test**: `check-release`, `check-brief`,
    `check-report`, `gate-lessons`, `check-ledger`. One per sitting; each one goes red on a fixture
    before it is trusted.
11. Add **leg 4** (the nightly schedule, §5.6) for whatever in your project goes stale from elapsed time
    rather than from any commit.
12. Retrofit §6.1 onto every gate you already wrote: **baseline diff or frozen grandfather list.** You
    will discover you need this the first time a gate blocks a cleanup commit — do it before that
    happens, not after.
13. Install the **graph** (§9.1): build the local corpus, seed a global corpus with the documentation of
    the three tools you use most, and adopt the query-before-web rule.
14. Install the **symbol tool** (§9.2) as a single shared server, and verify from inside a subagent that
    it resolves.
15. Write the **first lessons entries** — including one about installing all this — and let
    `gate-lessons` start holding the line.

**Ordering rationale.** Rules before automation, because automation of the wrong rule is expensive. One
gate wired end-to-end before five gates written, because the wiring is the part that failed on the source
project, not the writing. Self-tests from the very first gate, because a checker nobody has watched fail
is not a checker. And the escape hatch (§7) goes in with the very first blocking gate — not later, when
someone is already angry at it.

---

## 11. What this costs, honestly

This is not free, and you should tell the human that plainly rather than selling it.

**Load-bearing — do not skip these, they are why the rest works:**

- The **waiver rule** (§4). One rule; it prevents the class of failure where an approved requirement
  quietly ceases to exist.
- **Red before green** and **assert on rendered/observable output** (§3.2, §3.4). Without them, your test
  suite measures nothing and reports green.
- The **controller verifies independently** (§1.3). It is what turns a report into a fact.
- **Something automated, wired, and proven to block** (§5, §6.3). One gate that actually fires beats ten
  gates that exist.
- **Every gate prints its scan count** (§6.2). One line of output; it is the difference between a gate
  and a placebo.
- **Exit codes captured directly** (§3.6). Trivial to do, silently corrupts every downstream claim when
  it is not done.
- **The verbatim rule reload on compaction** (§5.2), if your harness compacts at all. Everything else in
  this document assumes the agent still holds the rules; this is the only piece that makes that true
  after the event that erases them.

**Refinements — real value, but adopt them when the basics are holding:**

- The full four-leg layering. Two legs (pre-commit + CI) cover most of the *gating*; the nightly job is
  worth adding later. **The session-start leg is the exception — its rule-reload emission is
  load-bearing, not a refinement** (above); only its gate and position-digest emissions can wait.
- The grandfather-baseline machinery (§6.1). Necessary the moment you have accumulated debt; unnecessary
  on a green-field project on day one.
- The graph corpus and the symbol server (§9). Transformative on a large or long-lived codebase;
  meaningful overhead on a small one.
- The status board, capabilities inventory, and per-release human-facing report. Excellent for a long
  programme with a non-technical stakeholder; ceremony for a two-week project.

**And one cost that is paid in context rather than in time:** the rule reload occupies part of the window
it exists to protect — on the source project, roughly a hundred kilobytes of text on every session start
and every compaction. That is the price of the in-full/named-with-a-path split being a deliberate decision
(§5.2) rather than an accident. Measure your own emission, print the number, and revisit the split when it
grows; do not shrink it by paraphrasing, which converts a known cost into an unknown loss.

**The ongoing tax, stated as it actually feels:** roughly one extra artifact per task (the brief), one
extra artifact per task (the report with its table), one board update per task, and one lessons pass per
arc. The gates themselves cost seconds per commit. The real cost is **discipline about the summary table
and the board** — those are the parts that decayed first on the audited day, and they are the parts a
script can only partly rescue.

**And the anti-ceremony rule, which is load-bearing too:** do not apply this machinery where it adds
nothing. A stack trace naming a file and a line gets fixed, not fault-treed. A typo fix does not get a
brief. A one-task change with one clear requirement does not get a pre-mortem. Judgement about *when not
to* is part of the discipline, not an exception to it.

---

## 12. Acceptance checklist — you are done installing when all of these are true

- [ ] The discipline document exists, and the always-loaded rules file points to it as authoritative.
- [ ] The brief template exists, and the last brief you wrote was created by **copying** it.
- [ ] The last task you completed ends with the fixed 5-row table, and row 4 was **read from the board**.
- [ ] `node scripts/check-meta.mjs` runs, exits nonzero on real breakage, and **every gate prints a scan
      count**.
- [ ] `node scripts/tests/run-all.mjs` passes, and **each gate has been observed failing** on a known-bad
      fixture.
- [ ] You have made a deliberately bad commit and **watched the pre-commit hook block it**.
- [ ] The CI job runs the same script on every push and PR, with full history fetched.
- [ ] The escape hatch is **named per gate**, appends to a log, and that log is **printed at the top of
      every gate run**.
- [ ] At least one gate judges the **change** against a baseline rather than the repository's standing
      state.
- [ ] A fresh clone gets the hooks automatically, and CI verifies the hook files exist.
- [ ] The lessons log has at least one entry, and every entry names a **gate**, not a good intention.
- [ ] Session start / resume / **compaction** emits all three: the gate, the position digest, and the
      **verbatim rule reload** — and you have confirmed your harness puts hook stdout **into context**.
- [ ] You have **triggered a compaction** and confirmed the rule text is present in context afterwards.
      Reading the script is not confirmation; a reload nobody has watched land is not installed.
- [ ] The rule reload states, in its own header, that it is a **re-read and not a summary**, prints its
      own size, and prints `not established` when an anchor is missing rather than a silent fragment.
- [ ] Everything the reload does *not* quote is **named with a path and a one-line reason**.
- [ ] The manual enforcement command **invokes the same scripts** and composes no content of its own.
- [ ] You can state, in one sentence each, which parts of this you installed, which you deliberately did
      not, and why.

---

### The one paragraph to keep if you keep nothing else

A rule enforced by a script survives a busy day; a rule enforced by discipline does not. On the day this
discipline was audited, every rule that broke was memory-dependent and every rule with a live check held
— and the deepest failure was not a broken rule at all, it was a gate that existed, was documented as
"mechanical enforcement", exited nonzero when invoked, and was wired to nothing, so it ran zero times
while four releases shipped over it. The second-deepest was a gate that *did* run and printed OK over
sixty-three rows it never looked at. So: move every rule you care about behind automation; wire that
automation to an event you cannot forget and a CI job you cannot bypass; make every gate print what it
scanned and not just its verdict; and never trust a gate you have not personally watched block something.
And the one thing no gate can do: after the event that erases the rules from working memory, **put the
rules back — verbatim, not summarised.** A gate reports whether they were followed; only the reload
restores the ability to follow them.
