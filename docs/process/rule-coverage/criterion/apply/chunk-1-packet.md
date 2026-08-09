# קריטריון הסיווג — נוהל החלטה

## גרסה 1 — 2026-08-09

מקור: `docs/superpowers/specs/2026-08-08-classification-criterion-design.md` §1, מועתק כאן
מילה-במילה כדי שהקריטריון יהיה קובץ אחד, עצמאי, שכל מסווג מקבל — בלי גישה לספק.

---

## הנוהל — שלוש שאלות בינאריות, בסדר קבוע

שיפוט כולל ("האם זה נראה דטרמיניסטי?") הוא בדיוק מה שהניב 47% אי-הסכמה בקשת 1. הנוהל מפרק
אותו לשאלות **בינאריות בסדר קבוע**, כדי שאותו כלל יינותב תמיד לאותו מקום. יש לענות על השאלות
**בסדר**: ש1 תחילה, ואם "לא" — ש2, ואם "לא" — ש3.

```
ש1  האם יש דפוס טקסטואלי או מבני בארטיפקט — פקודה, קובץ, diff, מטען hook —
    שנוכחותו או היעדרו מכריעים את הציות, בלי לקרוא כוונה?
       כן → A     חובה לנקוב בארטיפקט ובדפוס. לא ניתן לנקוב ⇒ התשובה אינה "כן"
       לא → ש2

ש2  האם ההכרעה דורשת לדעת מה קרה קודם — מונה, אירוע קודם, או רצף?
       כן, והעובדות הקודמות נצפות במטען hook או במחסן המצב → B
       לא → ש3

ש3  האם ההכרעה דורשת להעריך משמעות, איכות או כוונה של תוכן?
       כן → C
       לא → none    עיקרון, רשומה היסטורית, או תיעוד החלטה — אין תנאי ציות כלל
```

**ש1 נושאת חובת הוכחה:** מי שעונה "כן" חייב לנקוב בארטיפקט ובדפוס. **"בטח אפשר לכתוב regex"
אינו תשובה** — אם אי-אפשר לנקוב בו, התשובה היא "לא" ועוברים לש2. זה מה שמונע את הנטייה שגילינו
בקשת 1: לסמן A כי זה נשמע אפשרי.

---

## אוצר-המילים הסגור למנגנון

מי שמציע קבוצה A או B חייב לנקוב במנגנון **מתוך הרשימה הזו בלבד**, ובמטרה מוחשית (`mechanism_target`).
ערך שאינו ברשימה נדחה, לא מושמט.

| ערך | מתי הכלל נבדק |
|---|---|
| `pretooluse:Bash` | לפני פקודת מעטפת |
| `pretooluse:Edit\|Write` | לפני כתיבה לקובץ |
| `pretooluse:Agent` | לפני שיגור סוכן |
| `pretooluse:Grep\|WebSearch` | לפני חיפוש |
| `posttooluse` | אחרי כלי — תצפית ורישום, לא חסימה |
| `stop` | ברגע התשובה למשתמש |
| `subagentstop` | בסיום סוכן משוגר |
| `sessionstart` | בפתיחת session ואחרי compact |
| `commit-gate` | ב-pre-commit, דרך `check-meta.mjs` |
| `ci-gate` | ב-CI בלבד |
| `judge` | קבוצה C — דורש שיפוט מודל |
| `none` | אינו ניתן לאכיפה מכנית |

**כל ערך נושא גם יעד** — טווח מוחשי: `git commit` · `app.js|app.css` ·
`docs/superpowers/specs/**` · `tests/**`. **המנגנון אומר מתי נבדק; היעד אומר על מה.** שניהם
נדרשים: `pretooluse:Bash` לבדו אינו אומר דבר על מה נאכף.

---

## סכימת התשובה

כל מסווג מחזיר **אובייקט JSON אחד לכל token**, מערך אחד בסך הכול. השדות הנדרשים תלויים ב-`group`:

```json
{"token": "R01", "group": "A",
 "artifact": "הפקודה המלאה במטען pretooluse:Bash", "pattern": "git commit בצירוף כתיבת קובץ",
 "mechanism": "pretooluse:Bash", "mechanism_target": "git commit",
 "reason": "משפט אחד"}
{"token": "R02", "group": "B",
 "mechanism": "sessionstart", "mechanism_target": "docs/STATUS-BOARD.md",
 "observed_prior_facts": "היכן העובדות הקודמות נצפות", "reason": "משפט אחד"}
{"token": "R03", "group": "C", "reason": "איזו משמעות/איכות/כוונה נדרש להעריך"}
{"token": "R04", "group": "none",
 "cost": "מדוע אין תנאי ציות / מה עולה לשפוט", "importance": "גבוהה/בינונית/נמוכה + משפט"}
```

**כללי שדות (אלה מה ש-`validate_answers` של משימה 3 אוכפת):**

- **`A`** דורש `artifact`, `pattern`, `mechanism` (מאוצר-המילים) ו-`mechanism_target` — כולם
  לא-ריקים. `A` בלי ארטיפקט **וגם** דפוס נקובים הוא לא-תקין מבחינת סכימה — זו חובת ההוכחה של
  ש1 הפכה למכנית.
- **`B`** דורש `mechanism` (מאוצר-המילים), `mechanism_target`, `observed_prior_facts`.
- **`C`** דורש `reason`.
- **`none`** דורש `cost` ו-`importance` — מסופקים **תמיד**, גם בעיוורון: מסווג עיוור אינו יכול
  לדעת אם ה-`none` שלו הוא הורדה, ולכן הוא כותב את שניהם תמיד (בדיוק מה ש-`classify.validate_batch`
  ידרוש בהמשך, במשימה 8).

---

## הערת סיום — מה נמדד

**ההסכמה נמדדת על `group` בלבד.** הבדל במנגנון/יעד על קבוצה שהוסכמה (שני מסווגים אמרו `A` אבל
הציעו מנגנון שונה) אינו נספר כאי-הסכמה — הוא מוצג לבעלים בפרוזת המנה (משימה 7), ואינו ממוצע
לתוך אחוז ההסכמה.


---

## הכללים לסיווג (עיוור — ללא מזהה, ללא קבוצה)

### S01

**כותרת:** Maximize subagent usage

**נוסח הכלל:** Delegate aggressively: implementers, reviewers, debuggers, analysts, verifiers. Parallelise wherever the work is independent. The controller coordinates and verifies; it does not do work a subagent could do.

### S02

**כותרת:** Be skeptical — evaluate a better ingredient, don't just patch the current one

**נוסח הכלל:** > **Owner instruction, 2026-07-23.** When a component (a server, a runner, a framework, a library)
> **repeatedly** causes trouble, question whether it is the right tool — do not keep stacking band-aids on
> it. Research and weigh **better alternatives** (a different static server, a different test pattern, a
> different runtime) against the incumbent, and switch when the alternative is genuinely better. The
> correct fix is sometimes a better ingredient, not another workaround. Pair this with §10.14: the
> alternatives are found by research, then judged on evidence.

### S03

**כותרת:** Debug cluster — sharpens §5, and independently re-derives L14

**נוסח הכלל:** Apply at decision points during investigation, not continuously.

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

### S04

**כותרת:** Execution cluster — names failure modes we have already paid for

**נוסח הכלל:** 1. **Circle of Concern vs Circle of Control.** Before touching code not in the task's scope: is this mine
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

### S05

**כותרת:** Fight for the stated goal, and never self-declare final (owner feedback)

**נוסח הכלל:** > **Owner feedback, two halves of one ruling.** (i) When a stated goal meets an obstacle, do not quietly
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

### S06

**כותרת:** Why this document exists

**נוסח הכלל:** The 2026-07-21 analysis found ~52% conformance to specs I wrote, a safety guard specified-and-never-wired, and three features that shipped **inert with passing tests**. The Definitions of Done already existed in the specs. Nothing enforced them.

So this is not "add a DoD". It is: **make the existing DoD un-skippable, and add gates for the exact ways I got it wrong.**

### S07

**כותרת:** What was REJECTED, and why

**נוסח הכלל:** GSD's workflow machinery — its phases/waves, `PLAN.md`/`SUMMARY.md`/`VERIFICATION.md` artifacts, `/gsd-*`
commands, `checkpoint:decision` task types, and per-agent model profiles — is **not adopted.** Our
pipeline is superpowers-based (§2). Importing a second, competing process would create exactly the
"same subject specified twice, neither document citing the other" defect the knowledge graph found four
instances of in our own corpus. **One process, or none.**

### S08

**כותרת:** The Discipline — owner's standing instructions

**נוסח הכלל:** **These are the owner's own instructions. They govern every task. Re-read them before starting each one.**

### S09

**כותרת:** Thinking models — adopted from the `methodology` corpus, now a `tool_spec` record in the geniza (2026-07-22)

**נוסח הכלל:** **Where this came from.** The owner asked whether the global graph's `methodology` corpus (4,335 nodes)
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

### S10

**כותרת:** Translation QA — gate-passing is necessary, not sufficient (owner instruction, 2026-07-26)

**נוסח הכלל:** > **Owner instruction. Applies to EVERY language we translate to.**
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

### S11

**כותרת:** Work in cycles until finished

**נוסח הכלל:** Keep looping autonomously until the task is genuinely complete. Do not stop mid-loop to ask whether to continue.

### S12

**כותרת:** Only interrupt for decisions that are genuinely important

**נוסח הכלל:** > **Ask the owner only when the decision is important. If it is not, do not ask — proceed by the order / the recommended option, and note the choice in the step summary.**

A decision is **important** (→ ask) when it: is hard to reverse or destructive; involves safety or a legal/health number; **waives or reinterprets a spec requirement** (§4 Waiver Gate — always ask); materially changes scope, cost, or the deliverable; or turns on the owner's preference in a way that cannot be reasonably inferred.

A decision is **routine** (→ do not ask, just do it) when it is: task ordering among items already agreed; an obvious or conventional default; an implementation detail; or anything where a careful colleague would simply pick the sensible option and move on.

When genuinely unsure which bucket a decision falls in, **prefer proceeding over interrupting** — make the call, state it in the summary, and let the owner redirect if they disagree. Interrupting for a routine choice wastes the owner's time; the summary-after-every-step (§10.6) is the safety net.

### S13

**כותרת:** Show a mockup before building any significant graphics/visual redesign

**נוסח הכלל:** > **Owner instruction (2026-07-21): before implementing new graphics — the Phase-2 device diagrams, or any comparable visual redesign — build an interactive mockup/demo and show it to the owner to discuss, improve, and approve FIRST. Do not implement the visuals until the mockup is approved.**

Applies specifically to Phase 2 (the device diagrams: shelf stacks, hook bay, grill zones, sous-vide vessel, ribbon). Build the mockup as a self-contained HTML artifact (publishable via the Artifact tool or a local file the owner can open), covering each device type at 390px with realistic data, then get sign-off before writing production view code.

### S14

**כותרת:** Summarize after every task or step — in three parts

**נוסח הכלל:** After each task or step completes, show the owner a summary. Not at the end of a phase — after each step.

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

### S15

**כותרת:** Owner test handoffs are a Hebrew use-case script (owner instruction, 2026-07-26)

**נוסח הכלל:** > **Owner instruction.** Whenever you ask the owner to test a shipped version, hand them **simple, precise
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

### S16

**כותרת:** Historical — the graphify era, and the one hazard worth keeping

**נוסח הכלל:** > This section documented how to refresh the graphify knowledge graph. **The tool was removed on
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

### S17

**כותרת:** Coin real Hebrew terms — never a transliteration (owner instruction, 2026-08-03)

**נוסח הכלל:** > **Owner instruction, 2026-08-03,** correcting "לדג'ר" to "מרשם": when a new concept needs a Hebrew name,
> reach for a real Hebrew word, not an English word carried over in Hebrew letters.

This is the forward-looking rule; §10.20's דרי→יבש / דריי-ברין→ברין יבש cleanup is the retrospective one —
it hunts and fixes Anglicisms already sitting in the source. §10.22 is what stops the next one from being
coined in the first place: before naming something new, check for a real Hebrew word first, and reach for
a transliteration only when no such word exists. This governs Hebrew **body text and terminology** only —
it does not touch the separate, already-recorded naming convention (`docs/ROADMAP-2026-07-30.md` lines
7–8) that numbering and identifiers stay in English (Phase 0, Cooking Path, CP) while the prose around them
is Hebrew; that half is settled and is not restated here.

### S18

**כותרת:** The loop

**נוסח הכלל:** > **plan → develop → test → review → debug → re-review → until 100% working. Only then move forward.**

This is a **loop, not a checklist**. Re-entry is the normal case, not the exception. "Move forward" is forbidden while anything is less than 100% working. There is no "good enough for now", no "known minor", no deferring a defect into a later phase without the owner's explicit agreement (§4 Waiver Gate).

### S19

**כותרת:** When it's complex or the iterations aren't converging — RESEARCH, don't guess

**נוסח הכלל:** > **Owner instruction, 2026-07-23.** When a problem is genuinely complex, OR after a few iterations that
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
