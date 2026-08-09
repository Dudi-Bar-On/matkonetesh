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

### S20

**כותרת:** Reviewer discipline

**נוסח הכלל:** - Per-task reviewer returns **two verdicts**: spec compliance AND code quality. Missing either → not done.
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

### S21

**כותרת:** Failure-mode → gate map

**נוסח הכלל:** Each documented failure from the analysis, and the specific gate that now catches it.

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

### S22

**כותרת:** Hebrew check

**נוסח הכלל:** Hebrew check. Any user-facing string: rendered in Hebrew, no English leak, correct singular/plural on interpolated counts, correct domain term. Screenshot.

### S23

**כותרת:** What I will do differently, concretely

**נוסח הכלל:** 1. **Brainstorm each phase with you before planning it** — one question at a time, 2-3 approaches, your approval per section. I skipped straight to plan-writing for the occupancy layer.
2. **Never claim completion without pasted evidence** from a command run in that same message.
3. **Look at the screen** for every UI change, at 390px, before saying it works.
4. **Escalate every deviation** instead of documenting it.
5. **Treat every flaky test as a bug**, debugged to root cause.
6. **Verify agent output myself** via diff, never on their report alone.

### S24

**כותרת:** `equipPlan` — a spec's central mechanism — was never built

**נוסח הכלל:** `equipPlan` — a spec's central mechanism — was never built — root cause: Waived in a plan file, never raised in conversation — gate: §4 Waiver Gate

### S25

**כותרת:** The Waiver Gate (the single most important new rule)

**נוסח הכלל:** **Root cause of this whole report:** `equipPlan` — the central mechanism of an approved spec — was waived in a plan file (`plans/2026-07-20-equipment-occupancy-layer.md:1220`) and never surfaced in conversation.

**New rule, absolute:**

> A plan may never waive, defer, or reinterpret a requirement from an approved spec.
> Any such change is raised with the owner **in conversation**, with the spec text and the reason, and requires explicit approval.
> "Recorded in a document" does not count as raised.

This also applies to: reordering phases in a way that drops a dependency, marking a spec item "deferred", and narrowing a DoD line.

### S26

**כותרת:** Spec requirement traced

**נוסח הכלל:** Spec requirement traced. The exact spec line(s) this task satisfies, quoted. If none → the task should not exist. **For a recovered item (status ⚠️R in the ROADMAP Recovery Ledger), this line IS the Recovery Relevance Gate (§16/H13):** the trace starts from the item's source pointer; the relevance verdict (בצע/בטל) is a recommendation **decided together with the owner** (a §10.8 mandatory checkpoint) and recorded BEFORE any further work; a בצע verdict names the current-code evidence it was based on.

### S27

**כותרת:** Planning cluster — two of these close real gaps in this discipline

**נוסח הכלל:** 1. **Constraint Analysis, then Pre-Mortem** (in that order). Identify the single hardest constraint — the
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

### S28

**כותרת:** Operating Model — Main thread vs subagents (H6, adopted 2026-07-30)

**נוסח הכלל:** Authoritative form of METHODOLOGY-2026-07-30 §2, written here so every subagent inherits it.

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

### S29

**כותרת:** Consumer exists

**נוסח הכלל:** Consumer exists. Any new derived/computed value has a real reader in production code. Named here. *(Closes `hooksOver` and `scale_res`.)*

### S30

**כותרת:** The DoD gate (the core of this proposal)

**נוסח הכלל:** A task is **not done** until every box is checked with evidence pasted in. This runs before the ledger entry, per task, and again per phase.

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

### S31

**כותרת:** RED witnessed

**נוסח הכלל:** RED witnessed. Test written first, run, and *observed failing for the intended reason*. Output pasted. A test that passed on first run is void — rewrite it.

### S32

**כותרת:** the `/status` command

**נוסח הכלל:** (`.claude/commands/status.md`): `/status` = the board ·
  `/status caps` = capabilities · `/status full` = both + the last task's H9 table.

### S33

**כותרת:** שער רלוונטיות לפריט משוחזר (Recovery Relevance Gate; owner ruling, 2026-07-30)

**נוסח הכלל:** Born from the 2026-07-30 recovery audit (two coverage-audit agents over all of `docs/analysis/`): 25 items
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

### S34

**כותרת:** Fixture minimality

**נוסח הכלל:** Fixture minimality. The test fixture contains only what the scenario needs, and the **negative case is tested**. *(Closes the hanging fixture that supplied exactly what the broken gate required.)*

### S35

**כותרת:** Behavioural assertion

**נוסח הכלל:** Behavioural assertion. Every new test asserts an **observable effect** — rendered output, stored state, or a value a real consumer reads. *Asserting a computed field that nothing consumes is not a test.*

### S36

**כותרת:** בחירת מודל ורמת מאמץ ל-subagents (owner ruling, 2026-07-30)

**נוסח הכלל:** בכל שיגור subagent/workflow, המודל נבחר **מפורשות** (לעולם לא בירושה שקטה):

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


**L51 · An installer that needs a password, run without a TTY, fails silently — and I have now
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

**L63 · A citation that grants more than its source does — twice in two consecutive tasks
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

**L64 · "The geniza has it" is not "git has it" — and I read one as the other (2026-08-06).**

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

**L55 · An exception that pip can silently undo is a coincidence, not a decision (2026-08-05).**

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

### S37

**כותרת:** When NOT to think — the anti-ceremony rule, and it is load-bearing

**נוסח הכלל:** All three clusters ship this section, and it is adopted with them. **This discipline is already heavy;
a reasoning model applied where it adds nothing is cost with no evidence.** Skip them for:

- **Single-task work** with one clear requirement — write the task, do not pre-mortem it.
- **Obvious single-cause bugs** — a stack trace naming file, line and cause gets fixed, not fault-treed.
- **Following an established project pattern** the plan asks you to extend (Chesterton's Fence governs
  *removal*, not repetition).
- **Trivial mechanical edits** — an import, a typo, a version bump.
- **Procedural steps** — running a verify command is not a decision point. Invoke a model only when it
  *fails* and you must choose how to respond.
- **Revision passes** — apply only the model relevant to the flagged issue, not the whole suite again.

### S38

**כותרת:** Gate prompt patterns — §10.8 says *when* to ask; this says *how*

**נוסח הכלל:** Constraints: **max 4 options**, `header` ≤ 12 characters, never multi-select for a gate, and always
handle the freeform "Other" answer. If more than 4 options are needed, use a two-step flow.

Ready-made shapes: `approve-revise-abort` (Approve | Request changes | Abort) · `yes-no` ·
`stale-continue` (Refresh | Continue anyway) · `multi-option-failure` (Retry | Skip | Rollback | Abort) ·
`multi-option-escalation` (Accept gaps | Re-plan | Debug | Retry) · `multi-option-gaps`
(Auto-fix | Override | Manual | Skip) · `multi-option-priority` (Must-fix only | Must + should |
Everything | Let me pick) · `scope-confirm` · `depth-select` · `action-routing` (last option always
"Something else") · `gray-area-option` (last option always "Let Claude decide").
