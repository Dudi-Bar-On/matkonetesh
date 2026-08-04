# מחקר: מודול הבדיקות של BMAD ושל GSD — ראיות לקראת החלטת בעלים

**תאריך:** 2026-08-04 · **סוג:** מחקר ראיות, ללא המלצה · **החלטה:** של הבעלים בלבד

> המסמך הזה **לא ממליץ לאמץ ולא ממליץ נגד**. הוא מביא מה נמצא, מאיפה, ומה לא נמצא.
> כל ציטוט נושא שם קובץ. כל מקום שבו הסקתי במקום לקרוא — מסומן **[הסקה]**.

---

## 0 · מה נקרא בפועל, ומה לא נמצא (Provenance)

### מה שנקרא מהדיסק

| מקור | מיקום | היקף |
|---|---|---|
| **BMAD docs** | `C:\Users\dudib\source\repos\matkonet\raw\bmad-docs-01..30.md` | 30 קבצים — **אתר התיעוד הציבורי** (tutorials / how-to / explanation / reference) |
| **GSD README** | `C:\Users\dudib\source\repos\matkonet\raw\gsd-docs-01.md` | קובץ **אחד** בלבד — ה-README של `@opengsd/gsd-core` |
| **GSD — קוד המקור המותקן** | `C:\Users\dudib\source\repos\matkonet\.claude\gsd-core\` | **247 קבצי md + ספריית `bin/lib` שלמה** — 114 workflows, ~90 references, templates, ומנועי `.cjs` |

**ממצא ראשון, מתודולוגי:** ההנחיה הפנתה אותי ל-`raw\gsd-docs-*.md`, אבל שם יש **קובץ אחד** (README שיווקי,
137 שורות). ‏1,883 הצמתים בגרף לא באו משם — הצומת שהוזכר בבריף,
`execute_phase_steps_regression_gate_prior_phase_regression`, נושא בגרף את השדה:

```json
"source_file": ".claude/gsd-core/workflows/execute-phase/steps/regression-gate.md"
```
> `C:\Users\dudib\.graphify\global-graph.json:50331`

כלומר **GSD מותקן בפועל בריפו `matkonet`** ותועד משם. כל מה שלהלן על GSD נקרא מקוד המקור המותקן,
לא מ-README. זה מקור ראשוני, ולכן חזק יותר ממה שהתבקש.

### מה שלא נמצא בדיסק — ולכן נדרשה רשת

**חיפשתי בכל 30 קבצי BMAD את המילה `regression`. ‏0 מופעים.**
המילה `test` מופיעה 53 פעמים בסך הכול ב-30 קבצים — כמעט כולן אזכורי אגב
(«stress-test an idea», «pressure-test»), לא מתודולוגיית בדיקות.

**מודול ה-TDD של BMAD פשוט אינו בקורפוס שעל הדיסק.** מה שכן מופיע הוא ההפניה אליו:

> `| **[Test Architect (TEA)](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise)** | Design risk-based test strategy and automation |`
> — `bmad-docs-01.md:53`

> `QA test generation is handled by the bmad-qa-generate-e2e-tests workflow skill, available through the Developer agent. **The full Test Architect (TEA) lives in its own module.**`
> — `bmad-docs-30.md:89`

**לכן, ורק לכן, פניתי לרשת** — כדי לענות על השאלה המפורשת של הבעלים ("מודול ה-TDD של BMAD").
חיפשתי: `BMAD METHOD Test Architect TEA module ATDD risk-based test strategy workflows`,
ואז משכתי את דפי התיעוד הרשמיים של TEA ואת ה-README שלו. מה שמסומן להלן **[רשת]** בא משם ולא מהדיסק.

**BMAD אינו מותקן בשום מקום בדיסק** (חיפוש `**/bmad*/**` בשני הריפואים — 0 תוצאות). אין לי גישה לקוד
המקור של TEA, רק לתיעודו. זו מגבלת ראיות אמיתית: על GSD קראתי קוד, על BMAD קראתי שיווק ותיעוד.

---

## 1 · BMAD — מודול הבדיקות

### 1.1 מה יש ב-BMM (המודול הראשי, מותקן כברירת מחדל)

מסלול אחד בלבד, ושמו `bmad-qa-generate-e2e-tests`, נגיש דרך סוכן ה-Developer (Amelia):

> `| Developer (Amelia) | bmad-agent-dev | BD, QA, CR, SP, ER | Build, **QA Test Generation**, Code Review, Sprint Planning, Epic Retrospective |`
> — `bmad-docs-30.md:96`

**[רשת]** התיעוד הרשמי (docs.bmad-method.org/reference/testing) אומר על העיתוי:

> tests should be generated **"after a full epic is complete — once all stories in an epic have been implemented and code-reviewed"**

**זו אינה TDD.** זו יצירת בדיקות בדיעבד, אחרי מימוש **וגם** אחרי code review, ברמת אפוס שלם.
אין red-green, אין RED שנצפה, אין רגרסיה.

### 1.2 מה יש ב-TEA (מודול נפרד, התקנה נפרדת) — **[רשת בלבד]**

סוכן יחיד (Murat, Master Test Architect) ותשעה workflows:

| Trigger | Workflow | תפוקה |
|---|---|---|
| TMT | Teach Me Testing | מסלול למידה בן 7 מפגשים |
| **TD** | **Test Design** | הערכת סיכון, תכנון NFR, אסטרטגיית כיסוי → `test-design-*.md` |
| TF | Framework Setup | פיגום Playwright/Cypress, `.env.example`, ספקים לדוגמה |
| CI | CI/CD Integration | workflow ל-CI, "selective test scripts", צ'קליסט secrets |
| **AT** | **ATDD** | "Red-phase acceptance test scaffolds + implementation checklist" |
| TA | Test Automation | הרחבת כיסוי — "Prioritized specs, fixtures, README/script updates, DoD summary" |
| **RV** | **Test Review** | "Test quality review report with **0-100 score**, violations, fixes" |
| NR | NFR Assessment | "NFR Evidence Audit report with actions" |
| **TR** | **Requirements Tracing** | שלב 1: מטריצת כיסוי · שלב 2: **החלטת שער** PASS/CONCERNS/FAIL/WAIVED |

**דירוג הסיכון — הדבר הקרוב ביותר אצל BMAD לשאלה של הבעלים [רשת]:**

> **"Risk Score = Probability × Impact"** — הסתברות 1–3 (יציבות → מורכב/לא-נבדק), השפעה 1–3
> (אי-נוחות → מסלול קריטי שבור). התוצאה 1–9.

| עדיפות | ציון סיכון | יעד כיסוי | סוג בדיקה |
|---|---|---|---|
| **P0** Critical Path | "Typically 6-9" | **100%** | E2E + API |
| **P1** High Value | "Typically 4-6" | **90%** | API + selective E2E |
| **P2** Medium Value | "Typically 2-4" | **50%** | API happy path only |
| **P3** Low Value | "Typically 1-2" | **20% (smoke test)** | smoke |

> "Priorities consider risk scores plus business context (usage frequency, user impact, etc.)."

ובדוגמת ה-checkout: מתוך תקציב 40 שעות, לעיבוד תשלום (ציון 9) הוקצו **"20 hours (50%)"**,
ולהודעת מתנה (ציון 1) — **"2 hours (5%)"**.

**איכות הבדיקות [רשת, מקור משני]:** ‏workflow ה-Test Review בודק "static waits, conditional logic,
and file sizes", ומוודא ש"tests have no hardcoded waits, are independent, and use standard framework APIs".

### 1.3 מה **אין** ב-BMAD/TEA — נבדק במפורש

שאלתי את שלושת מקורות ה-TEA (דף ה-overview, דף ה-risk-based-testing, ה-README, ו-DeepWiki)
במפורש על ברירה/גיזום/ערך של בדיקות. התשובות:

- **בחירת רגרסיה:** *"**No mechanism described.** The brownfield cheat sheet mentions 'Focus test-design
  on regression hotspots and integration risk,' but there is **no algorithm, heuristic, or tool** for
  selecting or prioritizing regression tests."*
- **גיזום/פרישה של בדיקות ומדידת ערך:** *"**No discussion of test pruning, retirement, or value metrics.**"* —
  לא איך פורשים בדיקה מיושנת, לא מדדי כיסוי, לא ROI של בדיקה, לא ניהול מחזור-חיים של סוויטה.
- **צמיחת הסוויטה:** *"**No guidance on suite size, growth rate, or maintenance burden.**"*
- דף הסיכון: *"The provided content contains **no statements about running reduced regression testing
  per phase or risk level.** It focuses on **initial test depth allocation** rather than regression suite strategies."*

**זו נקודת המפתח לגבי BMAD:** ‏P0–P3 קובע **כמה בדיקות לכתוב מלכתחילה**, לא **מה להריץ אחר כך**
ולא **מה למחוק**. זו הקצאת תקציב כתיבה, לא ניהול סוויטה.

---

## 2 · GSD — מהו, ומה יש בו לבדיקות

### 2.1 מהו GSD Core

> "GSD Core is a context-engineering and spec-driven development framework that drives AI coding agents
> … through a disciplined phase loop. It solves **context rot** — the quality degradation that accumulates
> as an AI fills its context window — by running all heavy research, planning, and execution work in
> fresh-context subagents while keeping your main session lean."
> — `raw/gsd-docs-01.md:32`

לולאת חמישה שלבים לכל phase: ‏**Discuss → Plan → Execute → Verify → Ship**
(`gsd-docs-01.md:38-44`). ‏**הבעיה המוצהרת שהוא פותר היא ריקבון הקשר, לא ניפוח סוויטה.**

### 2.2 מודול ה-TDD של GSD — `references/tdd.md`

**מתי בכלל:**
> "**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`? → Yes: Create a TDD plan"
> **Skip TDD:** "UI layout, styling, visual components · Configuration changes · Glue code · One-off scripts
> · Simple CRUD with no business logic · Exploratory prototyping" — `tdd.md:21-31`

**מנגנון ה-RED — התשובה הישירה ל"האם יש שם מנגנון שמונע בדיקה שעוברת בריצה הראשונה":**

> "**RED - Write failing test:** … 3. Run test - it MUST fail. 4. **If test passes: feature exists or test
> is wrong. Investigate.**" — `tdd.md:94-99`
>
> "**Fail-Fast Rules** — 1. **Unexpected GREEN in RED phase:** If the test passes before any implementation
> code is written, **STOP.** The feature may already exist or the test is wrong. Investigate before
> proceeding." — `tdd.md:265`

**אבל — וזה הממצא החשוב — האכיפה עצמה היא על מסרי commit, לא על ריצה שנצפתה:**

```bash
# Check for RED gate commit
git log --oneline --grep="^test(${PHASE}-${PLAN})" | head -1
# Check for GREEN gate commit
git log --oneline --grep="^feat(${PHASE}-${PLAN})" | head -1
```
> — `tdd.md:271-279`

> "If RED or GREEN gate commits are missing, **add a `## TDD Gate Compliance` section to SUMMARY.md with
> the violation details.**" — `tdd.md:281`

וסקירת סוף-ה-phase:
> "⚠ **Gate violations are advisory** — review before advancing." … "**This checkpoint is advisory — it does
> not block phase completion** but surfaces TDD discipline issues for human review." — `tdd.md:304, 314`

**[הסקה]** ‏שער ה-TDD של GSD בודק ש**קיים commit בשם `test(...)` לפני `feat(...)`** — לא שהריצה
נצפתה אדומה. סוכן שכותב בדיקה ירוקה ומכנה את ה-commit `test(08-02): …` עובר את השער.
זה **חלש מ-DoD-12 §2 שלנו** ("A test that passed on first run is void — rewrite it"), שדורש פלט
ריצה מודבק. בנוסף, `workflow.tdd_mode` הוא **כבוי כברירת מחדל** — `settings.md:49`:
"enforce RED/GREEN/REFACTOR gate sequence during execute-phase (**default: false if absent**)".

**טיפול ברגרסיה בתוך המודול עצמו:** שורה אחת בלבד —
> "**Unrelated tests break:** Stop and investigate. May indicate coupling issue. Fix before proceeding."
> — `tdd.md:206-209`

### 2.3 שער הרגרסיה של GSD — `regression_gate` (החפירה שהתבקשה)

זה החלק המעניין ביותר, וגם זה שבו נמצא הפער הגדול ביותר בין הכוונה למימוש.

**הכוונה, מ-`workflows/execute-phase.md:1274-1294`:**

> `<step name="regression_gate">` "Run prior phases' test suites to catch cross-phase regressions
> **BEFORE verification**."
>
> "**Skip if:** This is the first phase (no prior phases), or no prior VERIFICATION.md files exist."
>
> **Step 1: Discover prior phases' test files**
> ```bash
> PRIOR_VERIFICATIONS=$(find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*")
> ```
> **Step 2: Extract test file lists from prior verifications** — "Lines containing `test`, `spec`, or
> `__tests__` paths · The 'Test Suite' or 'Automated Checks' section · File patterns from
> `key-files.created` in corresponding SUMMARY.md files that match `*.test.*` or `*.spec.*`.
> **Collect all unique test file paths into `REGRESSION_FILES`.**"

**זהו — על הנייר — בדיוק "סטים שונים של רגרסיה לפי שלב": כל phase מריץ את קבצי הבדיקה של ה-phases
שקדמו לו, לא את הסוויטה כולה.**

**המימוש, מ-`workflows/execute-phase/steps/regression-gate.md:8-30`:**

> "Expects `REGRESSION_FILES` (from the prior step) in scope **for the pytest branch**."

```bash
if [ -z "$REG_TEST_CMD" ]; then
  if [ -f "Makefile" ] && grep -q "^test:" Makefile; then REG_TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then      REG_TEST_CMD="just test"
  elif [ -f "package.json" ]; then                       REG_TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then                         REG_TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then                             REG_TEST_CMD="go test ./..."
  elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
       REG_TEST_CMD="python -m pytest ${REGRESSION_FILES} -q --tb=short"
  else REG_TEST_CMD="true"
  fi
fi
```

**קראו את הענפים:** ‏`${REGRESSION_FILES}` מופיע **בענף ה-pytest בלבד**. פרויקט JavaScript מקבל
`npm test` — כלומר **הסוויטה כולה**. הבחירה הקפדנית של קבצי הבדיקה בשלבים 1–2 **נזרקת** בכל שפה
שאינה Python. וגם זה נכון רק כשאין `workflow.test_command`; ברגע שמוגדרת פקודה מותאמת
(‏`planning-config.md:39`), היא גוברת על הכול והרגרסיה הופכת סופית לסוויטה מלאה.

**עבור הפרויקט שלנו זה מכריע:** אנחנו JS + Playwright. שער הרגרסיה של GSD היה מריץ אצלנו
`npx playwright test` מלא — ‏1,144 בדיקות, ~192 שניות — **בכל phase**. הוא לא היה מקצר דבר.

**הגנת ה-timeout (‏#1857):**
> ```bash
> TEST_GATE_TIMEOUT=$(gsd_run query config-get workflow.test_gate_timeout || echo "600")
> timeout "$TEST_GATE_TIMEOUT" bash -c "$REG_TEST_CMD" 2>&1
> ```
> "**On `REG_TEST_EXIT` 124 (REGRESSION GATE ABORTED): HALT** — do not proceed to verification…
> **never silently continue.**" — `regression-gate.md:34-42`

**כשיש כשל — השער רך:**
> ```
> ## ⚠ Cross-Phase Regression Detected
> Options:
> 1. Fix regressions before verification (recommended)
> 2. **Continue to verification anyway (regressions will compound)**
> 3. Abort phase — roll back and re-plan
> ```
> — `execute-phase.md:1304-1318`

**[הסקה]** רגרסיה שנתפסה **אינה עוצרת** את ה-phase. המשתמש רשאי להמשיך. אצלנו DoD-12 §12 אומר
"Any failure, including an intermittent one, is a bug". ‏GSD רך יותר בנקודה הזו.

**שער נלווה — `post-merge-gate.md`:** רץ אחרי מיזוג כל ה-worktrees בגל, "Catches cross-plan
integration failures that individual worktree self-checks cannot detect". שומר מונה
`WAVE_FAILURE_COUNT` — הרציונל בגרף:
> "Tracks cumulative build/test failures across waves so subsequent waves can warn that prior waves had
> failures — **compounding failures become exponentially harder to diagnose.**"
> — `global-graph.json:50320`

### 2.4 המנגנון החזק ביותר שמצאתי בשני הפרויקטים — `prohibition-enforcement`

זה לא TDD, זה שער אימות ל"מותר-אסור" (must-NOT). אבל הוא **בדיוק** התשובה ההנדסית ל"בדיקה
שעוברת בכל מקרה" — הבעיה שהביקורת הפנימית שלנו מצאה (80–96% מהבדיקות חסינות לפגמים).

> "**Machine-proven fail-first (#1279).** `failFirst` is now **machine-proven, not caller-attested**:
> before a clean pass greens, the producer independently runs the wired check against a **KNOWN VIOLATION**
> and confirms it goes RED (any other outcome — passes-on-violation, can't-prove, throws, times out,
> no violation source — hard-gates)."
> — `references/prohibition-probe.md:124-127`

ובקוד עצמו, בקרת הסיבתיות:

> "**CAUSATION (#1346; MANDATORY as of #1906):** existence + a non-vacuous red is necessary but **not
> sufficient** — a deceptive negative test that reds merely BECAUSE `GSD_PROHIB_SUBJECT` is set (rather
> than because the subject's CONTENT violates the must-NOT) would otherwise be accepted. The `cleanFixture`
> control below proves **content-dependence (red on bad AND green on clean)** and is now REQUIRED…
> absent it, the check is un-provable (**fail-closed**), not accepted under the weaker violation-only proof."
> — `bin/lib/prohibition-enforcement.cjs:518-523`

ומעבר לזה — הגנה מפני "ריצה ריקה שנחשבת ירוקה":

> "A **non-vacuous** node-test pass: at least one test, at least one pass, zero failures — AND at least one
> reported test whose name is NOT merely the target file. `node --test <file>` counts a file with ZERO
> `test()` calls as one passing 'test' named after the file, so **the counts alone cannot tell an
> empty/deleted negative test from a real one** (the #1259 BL-01 false-green)."
> — `prohibition-enforcement.cjs:210-214`

> "a test asserting the model's verdict is **vacuous and rejected**" — `references/honest-verifier.md:61`

**הסתייגות שהמסמך עצמו כותב בכנות (חשוב לצטט):**
> "**PROPOSED, renamable conventions (zero live consumers).** Both `GSD_PROHIB_SUBJECT` and
> `violationFixture` are net-new surface with **no live in-tree consumer yet** — there is **no in-tree
> `node --test` prohibition**; node-test fail-first proof is exercised only by **SYNTHETIC temp fixtures**
> in the tests, and the real dogfood remains the LINT-rule `local/no-source-grep`."
> — `prohibition-probe.md:141-144`

**[הסקה]** המנגנון אמיתי, מקומפל, ובעל בדיקות משלו — אבל **טרם הופעל על בדיקת מוצר אמיתית אצלם**,
והוא חל רק על פריטי `must_haves.prohibitions` בדרגת `test`, שנוצרים בשלב ה-spec. **הוא אינו חל על
סוויטת הבדיקות הרגילה ואינו חל על Playwright.**

### 2.5 האימות: "קיום ≠ מימוש" ו-`PRESENT_BEHAVIOR_UNVERIFIED`

> "**Existence ≠ Implementation.** A file existing does not mean the feature works. Verification must check:
> 1. **Exists** 2. **Substantive** 3. **Wired** 4. **Functional**. Levels 1-3 can be checked
> programmatically. **Level 4 often requires human verification.**"
> — `references/verification-patterns.md:5-15`

וסטטוס ייעודי, שקורא כמעט אחד-לאחד את הפער שהביקורת שלנו מצאה (62% מהטענות קוראות מצב פנימי ולא DOM):

> "`⚠️ PRESENT_BEHAVIOR_UNVERIFIED` — present + wired, but **a state transition or cancellation/cleanup/
> ordering invariant was not exercised by any test.** Counts toward `behavior_unverified`, routes to human
> verification, and is **excluded from the verified score.**"
> — `templates/verification-report.md:178`

> "that is the *inferable-but-unobserved* case — the truth **can** be verified from the spec but was
> **shortcut-passed on symbol presence**; the fix is to demand **behavioral evidence**."
> — `references/honest-verifier.md:99-101`

ומנגנון ה-abstention, עם מספרים מדודים:

> "on a non-inferable check … measured behavior is a **confident PASS on the blind-spot check ~100% of the
> time** (mean confidence ~0.93) … the confident-false-pass rate on the blind spot drops **100% → 17%**."
> … "Asking the verifier to 'abstain if unsure' barely moves the number (**100% → 67%**)"
> … "**Evidence strength.** N17 is n=27 verdicts … **direction-finding, not powered.**"
> — `references/honest-verifier.md:14-21, 25-28, 84-86`

---

## 3 · השאלה המרכזית — "רגרסיה שרק גדלה, ולא ברור שכל תוספת מביאה ערך"

חיפשתי במפורש, בקוד המקור המלא של GSD, את כל השדה הסמנטי:
`risk-based | test selection | prune | obsolete test | delete the test | remove tests | test value |
suite grows | slow suite | flaky`.

**התוצאה:** ‏`prune` מופיע ב-GSD **13 פעמים** — כולן על **branches** (`cleanup.md:143 prune_local_branches`),
על **worktrees** (`git worktree prune`), על **רשומות STATE.md** (`workflow.auto_prune_state`, ברירת מחדל
`false`), על **learnings** (`learnings prune --older-than 90d`), ועל **משימות בתוכנית**
(`node-repair.md:24` — "PRUNE — The task is infeasible given current constraints").

**אף מופע אחד אינו על בדיקה.** ‏GSD יודע לגזום ענפים, מצב, ולקחים — **לא בדיקות.**

`flaky` מופיע שלוש פעמים בלבד, וכולן דקורטיביות: פריט בצ'קליסט סקירה
(`contexts/review.md:18` — "flaky patterns"), אמוג'י בתבנית (`templates/VALIDATION.md:45` — "⚠️ flaky"),
ומשפט דוגמה על WebSocket. **אין מעקב flakiness, אין quarantine, אין מדד יציבות.**

### מה כן קיים אצל כל אחד — ומה זה שווה לשאלה

| יכולת שהבעלים ביקש | GSD | BMAD / TEA |
|---|---|---|
| **סטים שונים של רגרסיה לפי שלב** | **קיים בכוונה, מת במימוש** — ‏`REGRESSION_FILES` נאסף מ-VERIFICATION.md של phases קודמים, אך משמש **רק בענף pytest**; ‏JS מקבל `npm test` מלא | **אין** — "no algorithm, heuristic, or tool for selecting or prioritizing regression tests" |
| **בחירת בדיקות (test selection)** | אין. הפקודה נגזרת מסניפי שפה, לא מהשינוי | אין. ‏`ci` מייצר "selective test scripts" אך התיעוד לא מסביר לפי מה |
| **דירוג לפי סיכון** | אין דירוג סיכון לבדיקות | **קיים — P0–P3 = ‏Probability × Impact**, עם יעדי כיסוי 100/90/50/20% |
| **פרישת בדיקות שאינן מחזירות ערך** | **אין** (ראו החיפוש למעלה) | **אין** — "No discussion of test pruning, retirement, or value metrics" |
| **מדידת ערך של בדיקה** | **אין מדד ערך.** יש מדד **תוקף**: ‏fail-first מוכח-מכונה + בקרת cleanFixture — האם הבדיקה בכלל *מסוגלת* להיכשל | **אין מדד ערך.** יש **ציון איכות 0–100** ב-`test-review` — סגנון/anti-patterns, לא ערך |
| **צמיחת הסוויטה כבעיה מוכרת** | לא מוזכרת | לא מוזכרת — "No guidance on suite size, growth rate, or maintenance burden" |

### התשובה, בלי ריכוך

**אף אחד מהשניים אינו פותר את הבעיה שהבעלים תיאר.**

- **BMAD/TEA** עונה על **חצי שאלה אחרת**: כמה עומק בדיקה **להשקיע מלכתחילה** לפי סיכון (P0–P3).
  זו הקצאת תקציב **כתיבה**. ברגע שהבדיקה נכתבה, ‏TEA לא יודע להגיד אם היא עדיין שווה משהו, ולא יודע
  להסיר אותה. אין שם, בשום מקום שמצאתי, מושג של **מחזור-חיים של בדיקה**.
- **GSD** מכיל את **הרעיון הנכון** — רגרסיה לפי phase — אבל **המימוש מתפרק בדיוק בסטאק שלנו**.
  מה שהוא כן נותן, ובגדול, זה כלים נגד **בדיקות מזויפות**: ‏fail-first מוכח-מכונה, בקרת סיבתיות
  clean/violation, איסור על ריצה ריקה כירוקה, וסטטוס `PRESENT_BEHAVIOR_UNVERIFIED` שמסרב לזקוף
  לזכות "קיים ומחווט" בלי שהתנהגות תורגלה. אלה תשובות ל**איכות** של בדיקה, לא ל**כמות**.

**[הסקה, מסומנת ככזו]** יש כאן א-סימטריה שווה אמירה: הבעיה של הבעלים היא **צמיחה מונוטונית של
סוויטה**. שני הפרויקטים בנויים סביב **הוספה**: ‏GSD מוסיף שער רגרסיה ומצטבר `WAVE_FAILURE_COUNT`;
‏TEA מוסיף תשעה workflows שכולם מייצרים ארטיפקטים. **לאף אחד מהם אין מחיקה.** מי שמחפש מכניזם
שמקטין סוויטה לא ימצא אותו באף אחד מהם — הוא יצטרך להמציא אותו.

---

## 4 · בדיקות UI

### GSD

- **`workflows/ui-review.md`** — סוכן `gsd-ui-auditor` שנותן ציון **‏24/‏N** בשישה עמודים:
  Copywriting · Visuals · Color · Typography · Spacing · Experience Design (`ui-review.md:126-133`).
- **Playwright — אופציונלי, מבוסס-MCP, מדולג בשקט אם אינו קיים:**
  > "**If `mcp__playwright__*` tools are accessible in this session:** 1. Navigate to each UI component
  > described in the phase's UI-SPEC.md … 2. Take a screenshot … 3. Compare against the spec's visual
  > requirements — **dimensions, color palette, layout, spacing scale, and typography** … 5. Flag items
  > that require human judgment (brand feel, content tone) as `needs_human_review: true`."
  > … "**If Playwright-MCP is not available in this session, this section is skipped entirely.**"
  > — `ui-review.md:153-171`
- **`workflows/add-tests.md`** — סיווג תלת-דרכי של כל קובץ שהשתנה:
  > `| **TDD** | Pure functions where expect(fn(input)).toBe(output) is writable | Unit tests |`
  > `| **E2E** | UI behavior verifiable by browser automation | Playwright/E2E tests |`
  > `| **Skip** | Not meaningfully testable or already covered | None |` — `add-tests.md:75-79`
  >
  > **E2E כשמדובר ב:** "Keyboard shortcuts · Navigation · Form interactions · Selection · Drag and drop ·
  > Modal dialogs · Data grids" (`:89-96`)
  > **Skip כשמדובר ב:** "**UI layout/styling: CSS classes, visual appearance, responsive breakpoints**" (`:99`)
  >
  > **"No-skip rule:** If E2E tests cannot execute (missing dependencies, environment issues), report the
  > blocker and mark the test as incomplete. **Never mark success without actually running the test.**" (`:274`)

  אבל בהמשך, על בדיקות שנוצרות אחרי הקוד:
  > "Note: since code already exists, **tests may pass immediately — that's OK**, but verify they test the
  > RIGHT behavior" — `add-tests.md:178`

  **[הסקה]** זו בדיוק החולשה שה-DoD שלנו אוסר. ‏`add-tests` הוא מסלול יצירת-בדיקות-בדיעבד, ובו
  RED אינו נדרש אלא רק "וודא שזו ההתנהגות הנכונה" — קביעה של מודל, לא ראיה.
- **אין ברפרנס כולו:** ‏visual regression / השוואת snapshot / baseline של תמונה. הביטוי
  "Visual regression testing?" מופיע פעם אחת — כ**שאלה שיש לשאול את המשתמש** בשלב הבירור
  (`references/domain-probes.md:113`), לא כיכולת.
- **אין שום התייחסות ל-RTL, לעברית, או לשפות** בכל קורפוס ה-GSD.

### BMAD / TEA **[רשת]**

- ‏`framework` ‏(TF) מפגם Playwright או Cypress; ‏TEA תומך ב-"optional Playwright Utils, CLI, and MCP
  browser automation".
- ‏`qa-generate-e2e-tests` יוצר "E2E tests using semantic locators and **visible-outcome assertions**"
  ומגביל ל-"Standard framework APIs only — no external utilities or custom abstractions".
  **[הסקה]** "visible-outcome assertions" הוא בדיוק העיקרון שהביקורת שלנו קראה לו "לקרוא DOM מרונדר
  ולא מצב פנימי". זו כותרת מוצר, לא מנגנון — לא מצאתי אכיפה מאחוריה.
- **לא מצאתי אצל TEA:** ‏visual regression, השוואת screenshot, בדיקת RTL/i18n.
- ‏`bmad-docs-07.md:47` מגדיר את סעיף "4. Testing" של ה-Checkpoint Preview כ**ידני במפורש**:
  > "Suggests 2-5 ways to **manually observe** the change working. **Not automated test commands** — manual
  > observations that build confidence no test suite provides." … ו-`:87`: "It **does not run** linters,
  > type checkers, or test suites."

**מסקנה על UI:** אצל שניהם, בדיקת UI היא **פיגום + שיפוט**, לא **כיסוי נמדד**. אף אחד מהם לא מציע
מתודולוגיית כיסוי מסכים, ולא visual regression. **הפער שהבעלים זיהה אצלנו אינו נסגר על ידי אף אחד מהם.**

---

## 5 · טיב האימוץ — פלטפורמה אוכפת או אוסף הנחיות?

### GSD — **היברידי, נוטה לאכיפה**

**מה שהוא באמת מתקין:** ‏`npx @opengsd/gsd-core@latest`. בפרויקט `matkonet` זה יצר
`.claude/gsd-core/` עם **247 קבצי md** ו-`bin/` המכיל `gsd-tools.cjs` וספריית `lib/` (עשרות מודולי
`.cjs` מקומפלים: `probe-core`, `prohibition-enforcement`, `verify`, `coverage`, `state`,
`capability-registry`, `normalize-test-command`…). קיימת גם `.planning/` כמבנה ארטיפקטים
(`PROJECT.md`, `ROADMAP.md`, `STATE.md`, `phases/*/`, `*-PLAN.md`, `*-SUMMARY.md`, `*-VERIFICATION.md`).

**מה אכן נאכף (קוד, לא פרוזה):**
- `check prohibition-enforcement` — **fail-closed** מוכח-מכונה (§2.4). זה מנוע.
- ‏timeout על שערי הבדיקות + נרמול פקודה משותף — "the same shared `normalize-test-command` helper …
  **so the two gate paths cannot drift**" (`regression-gate.md:5-6`).
- ‏`dispositionForUnverifiableTruth` / `dispositionForProhibition` — דיספוזיציות דטרמיניסטיות.
  והמסמך אף פוסל בדיקה על שיפוט המודל: "the CI-testable surface is the **deterministic disposition +
  projection, never the LLM's judgment**" (`honest-verifier.md:60-61`).

**מה **לא** נאכף (המלצה בלבד):**
- **שער ה-TDD** — `git log --grep` על שמות commit, ותוצאה **advisory** שלא חוסמת (`tdd.md:281, 314`).
- **שער הרגרסיה** — כשל נותן למשתמש אפשרות "Continue to verification anyway" (`execute-phase.md:1316`).
- `workflow.tdd_mode` — **כבוי כברירת מחדל**.
- ‏Playwright ב-UI — מדולג לגמרי כשה-MCP אינו זמין (`ui-review.md:168`).
- **[הסקה]** רוב ה-"gates" הם **הוראות פרוזה ל-LLM בתוך קובץ workflow** — אותה משפחה בדיוק
  שהביקורת הפנימית שלנו מצאה בה ש-5 מ-8 שערים אינם יכולים להיכשל ב-CI. ‏GSD סובל מאותה מחלה,
  בקנה מידה גדול יותר.

**האם אפשר לאמץ רק את מודול הבדיקות?** — **שאלת המפתח שלנו.**
התשובה מהקוד: **חלקית, ובמחיר.**

| רכיב | תלוי בשאר GSD? | הערה |
|---|---|---|
| `references/tdd.md` | **לא** — מסמך עצמאי | אבל מוסיף רק שכבת commit-convention מעל DoD-12 שכבר חמור יותר |
| `references/verification-patterns.md` | **לא** — "This doc is written in generic terms with no tool-specific vocabulary, **so it is portable: copy it into any verification process**" (`honest-verifier.md:6-7`; אותה הצהרה ב-`prohibition-probe.md:13-15`) | **מפורשות מיועד להעתקה.** רעיון, לא כלי |
| `regression_gate` | **כן** — דורש `.planning/phases/*/…-VERIFICATION.md` | חסר משמעות ללא מבנה ה-phases; ובענף JS ממילא = סוויטה מלאה |
| `prohibition-enforcement` | **כן, עמוקות** — דורש `gsd-tools.cjs`, ‏`must_haves.prohibitions` ב-frontmatter של PLAN, ‏`projectProhibitions`, ‏`descriptorFromProjection`, ו-`/gsd-spec-phase` שיחבר את חמשת ה-`check_*` | לא ניתן לניתוק. **הרעיון** (fixture נגוע + fixture נקי) ניתן ליישום עצמאי בכמה עשרות שורות |
| `add-tests` / `ui-review` | **כן** — קוראים `SUMMARY.md` / `CONTEXT.md` / `UI-SPEC.md` של phase | |

**[הסקה]** הדבר היחיד ב-GSD ששווה **ולא דורש בליעה** הוא **הרעיון של ההוכחה**: הרץ את הבדיקה נגד
subject פגום — חייבת להאדים; נגד subject נקי — חייבת להוריק; אחרת היא לא בדיקה. זה ~50 שורות אצלנו,
בלי `.planning/`, בלי `gsd-tools.cjs`, בלי phases. אימוץ **הרעיון** ולא **הפלטפורמה**.

### BMAD — **אוסף סוכנים, workflows ו-skills**

- התקנה: `npx bmad-method install` — בורר מודולים (core, bmm, bmb, cis, gds, **tea**), בורר IDE,
  ומייצר **skills** (`bmad-agent-dev`, `bmad-agent-pm`…) + תיקיית `_bmad-output/` + הגדרות TOML
  (`_bmad/custom/config.toml`, `bmad-agent-{role}.toml`) — `bmad-docs-24.md:133-140`, `bmad-docs-21.md:66-72`.
- **ההתאמה היא persistent_facts** — מחרוזות פרוזה שמוזרקות לכל הפעלה של סוכן:
  > `persistent_facts = [ "For any library documentation lookup … call the context7 MCP tool …" ]`
  > "**Why this works:** **Two sentences** reshape every dev workflow in the org" — `bmad-docs-21.md:80-93`
- **[הסקה]** זהו במובהק **prompt-engineering platform**, לא מנוע שערים. לא מצאתי ב-30 קבצי התיעוד
  אף hook, אף exit-code, אף שילוב CI חוסם. ‏TEA מוסיף החלטת שער (PASS/CONCERNS/FAIL/WAIVED) — אבל
  **[רשת]** זו החלטה שסוכן כותב לדוח, לא בדיקה שנכשלת בבנייה.
- **האם אפשר לאמץ רק את TEA?** — **כן, טכנית.** ‏TEA הוא מודול נפרד, ריפו נפרד, חבילת npm נפרדת
  (`bmad-method-test-architecture-enterprise`). **[הסקה]** אבל התפוקות שלו (`test-design-*.md`,
  מטריצת traceability, החלטת gate) מניחות ארטיפקטים של BMM — PRD, ‏architecture, ‏epics/stories.
  ‏`test-design` מקבל כקלט "PRD, architecture, ADRs, epics/stories". אצלנו אין PRD ואין epics; יש
  ‏ROADMAP, ‏STATUS-BOARD, ומרשם. **ההתאמה אינה טריוויאלית.**

### עלות המעבר, בפועל — לפרויקט שלנו

| | GSD | TEA |
|---|---|---|
| קבצים חדשים בריפו | ~250 md + ‏`bin/` + `.planning/` | חבילת npm + `_bmad/` + `_bmad-output/` |
| מבנה תיקיות חדש | **כן** — `.planning/phases/NN-name/{PLAN,SUMMARY,VERIFICATION,CONTEXT}.md` | **כן** — `_bmad-output/`, קבצי TOML |
| שינוי בזרימת העבודה | **מלא** — 5 שלבים, worktrees, גלי הרצה מקבילים | **מלא** — סוכנים נקובים בשם, triggers בני שתי אותיות |
| התנגשות עם המשמעת שלנו | **גבוהה** — ל-GSD יש DoD משלו, STATE משלו, מרשם gap משלו (`gap_id`), roadmap משלו, מודל thinking-models משלו (5 קבצי `thinking-models-*.md` — **מקבילה ישירה ל-§12 שלנו**) | **גבוהה** — PRD/epics/stories מול ROADMAP/מרשם שלנו |
| החלפה או שכבה? | **שכבה** — GSD אינו יודע דבר על DoD-12, על H8–H15, על `check-meta.mjs`, על שער הבטיחות | **שכבה** |

**זו הנקודה שהבריף ביקש שתיאמר במפורש:** ‏**שניהם שכבת תהליך נוספת, לא החלפה.**
לשניהם יש roadmap משלהם, ארטיפקטים משלהם, מרשם gaps משלהם, ומודלי חשיבה משלהם — שכולם
**מקבילים** למה שכבר קיים כאן ולא **מחליפים** אותו. אימוץ מלא של אחד מהם פירושו לנהל שתי
מערכות משמעת במקביל, או לפרק את הקיימת.

---

## 6 · טבלת "נאכף מול המלצה" — סיכום ראיות

| מנגנון | פרויקט | נאכף בקוד? | ראיה |
|---|---|---|---|
| fail-first מוכח-מכונה + בקרת סיבתיות | GSD | **כן** — `.cjs` מקומפל, fail-closed | `prohibition-enforcement.cjs:518-549` |
| איסור "ריצה ריקה = ירוק" (non-vacuous) | GSD | **כן** — parser של TAP, mutation-pinned | `prohibition-enforcement.cjs:210-231` |
| ‏abstention בבדיקות לא-ניתנות-להסקה | GSD | **כן** — דיספוזיציה דטרמיניסטית | `honest-verifier.md:58-69` |
| ‏timeout על שער בדיקות + HALT | GSD | **כן** | `regression-gate.md:34-42` |
| שער RED/GREEN של TDD | GSD | **לא** — `git log --grep`, ותוצאה advisory | `tdd.md:271-281, 314` |
| ‏`tdd_mode` | GSD | **כבוי כברירת מחדל** | `settings.md:49` |
| שער רגרסיה חוסם | GSD | **לא** — "Continue anyway" הוא אפשרות | `execute-phase.md:1316` |
| רגרסיה סלקטיבית לפי phase | GSD | **רק ב-pytest** | `regression-gate.md:8, 26` |
| ‏Playwright ב-UI review | GSD | **לא** — מדולג אם MCP חסר | `ui-review.md:168` |
| ‏P0–P3 risk prioritization | TEA | **[רשת]** — אין ראיית קוד | דף risk-based-testing |
| ציון איכות בדיקות 0–100 | TEA | **[רשת]** — דוח, לא שער | דף tea-overview |
| החלטת gate ‏PASS/CONCERNS/FAIL/WAIVED | TEA | **[רשת]** — תפוקת workflow | דף tea-overview |
| ‏qa-generate-e2e-tests | BMM | **[רשת]** — אחרי אפוס שלם, ללא RED | docs.bmad-method.org/reference/testing |

---

## 7 · מה חיפשתי ולא מצאתי — רשימה מפורשת

1. **מודול TDD של BMAD בקורפוס שעל הדיסק** — לא קיים. ‏0 מופעי `regression` ב-30 הקבצים.
2. **קוד המקור של TEA** — לא בדיסק, לא נמשך. כל ה-TEA כאן הוא **תיעוד מהרשת**, וחלקו ממקורות משניים.
3. **מנגנון גיזום/פרישת בדיקות** — לא בשניהם. חיפוש ממצה ב-GSD; שאלה מפורשת לארבעה מקורות TEA.
4. **מדידת ערך של בדיקה** — לא בשניהם. הקרוב ביותר: ציון סגנון 0–100 (TEA), ותוקף fail-first (GSD).
5. **מעקב flakiness / quarantine** — לא בשניהם.
6. **‏Visual regression / השוואת snapshot** — לא בשניהם.
7. **‏RTL / עברית / i18n בבדיקות** — אפס אזכורים בשני הקורפוסים.
8. **‏CI חוסם** — לא ראיתי אצל אף אחד מהם hook או exit-code שמכשיל build.
9. **דפי TEA שניסיתי ולא קיימים** — `/explanation/test-quality/` ו-`/reference/workflows/ci/` החזירו 404.
   פרטי ה-anti-patterns של `test-review` מגיעים ממקור משני (בלוג/סיכום חיפוש), ולכן **חלשים**.

---

## תקציר לבעלים

ביקשת את מודול ה-TDD של BMAD. **הוא לא נמצא על הדיסק** — 30 קבצי BMAD אצלנו הם אתר התיעוד השיווקי,
ובהם **אפס** אזכורים למילה "רגרסיה". מודול הבדיקות האמיתי, **TEA**, יושב בריפו נפרד; קראתי עליו מהרשת
בלבד, ולכן הראיות עליו חלשות מאלה על GSD. את **GSD** לעומת זאת מצאתי מותקן אצלך ב-`matkonet` —
‏247 קבצים ומנועי `.cjs` — וקראתי קוד, לא שיווק.

**על השאלה שלך — "רגרסיה שרק גדלה ולא ברור שכל תוספת מביאה ערך" — התשובה היא לא. לשניהם.**
ל-GSD יש שער רגרסיה שנשמע בדיוק כמו מה שרצית: הוא אוסף את קבצי הבדיקה של ה-phases הקודמים ל-`REGRESSION_FILES`.
אבל בקוד, המשתנה הזה מוזרק **רק בענף pytest**; פרויקט JavaScript כמונו מקבל `npm test` — כלומר הסוויטה
המלאה, כל 1,144 הבדיקות, בכל phase. הבחירה נזרקת. ‏TEA מדרג P0–P3 לפי הסתברות×השפעה, אבל זה קובע
**כמה בדיקות לכתוב מלכתחילה**, לא מה להריץ אחר כך. **גיזום בדיקות, פרישת בדיקות, מדידת ערך של בדיקה,
מעקב flakiness — אין באף אחד מהם.** ‏GSD יודע לגזום ענפי git, לקחים ורשומות מצב; בדיקות — לא.

מה כן יש, ושווה לדעת: ל-GSD יש את המנגנון החזק ביותר שראיתי נגד **בדיקה מזויפת** — הוא מריץ את הבדיקה
נגד קובץ פגום ודורש אדום, ואז נגד קובץ נקי ודורש ירוק, ואם אחד מהם לא קרה הבדיקה **נפסלת**. זו תשובה
ישירה ל-80–96% מהבדיקות שלנו שחסינות לפגמים. אבל הוא חל רק על סעיפי "אסור" מהמפרט, לא על הסוויטה,
ולא על Playwright — והמסמך שלהם מודה בכנות שאין לו עדיין צרכן אמיתי אחד בקוד שלהם.

**ולעניין העלות:** שניהם **שכבה נוספת, לא החלפה.** לשניהם roadmap משלהם, ‏DoD משלהם, מרשם gaps משלהם
ומודלי חשיבה משלהם — הכול **מקביל** למה שכבר בנית כאן, לא במקומו. בדיקות UI: אצל שניהם זה פיגום ושיפוט
אנושי; ‏Playwright ב-GSD מדולג בשקט כשה-MCP חסר, ו-visual regression, ‏RTL ועברית — **אפס אזכורים בשניהם**.
הפער שזיהית אצלנו אינו נסגר על ידי אף אחד מהם.

ההחלטה שלך.

---

### מקורות רשת (BMAD/TEA — מה שלא היה בדיסק)

- [Test Architect (TEA) Overview](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/)
- [Risk-Based Testing — TEA](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/risk-based-testing/)
- [TEA README (GitHub)](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise/blob/main/README.md)
- [Testing Options | BMAD Method](https://docs.bmad-method.org/reference/testing/)
- [TEA — DeepWiki](https://deepwiki.com/bmad-code-org/bmad-method-test-architecture-enterprise)
- [bmad-method-test-architecture-enterprise — npm](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise)
