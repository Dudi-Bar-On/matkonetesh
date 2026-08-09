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

### R01

**כותרת:** Two subagents reported work as "committed and wired" while it sat uncommitted (2026-08-01).

**נוסח הכלל:** Twice in one evening a subagent's final report stated the work was committed and verified; twice
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

### R02

**כותרת:** A push is not a release; a deploy takes minutes (v255, 2026-07-21).

**נוסח הכלל:** I announced "v255 is shipped" the moment `git push` returned. The owner looked, still saw 254, and my first
diagnosis was wrong — I blamed their service-worker cache and started engineering a cache fix. The truth was
mundane: Cloudflare Pages was still rebuilding (build.py over a ~2.6 MB single-file bundle). Verifying the
live URL with Playwright showed the server was already correct once the build finished.
Two rules came out of it: (a) §10.10 — never report a version live until a Playwright check against the live
URL passes, polling for the build rather than assuming; (b) when the owner reports "I don't see it", check
the *simplest* external explanation (has the deploy finished?) before theorising about client caches.
It did surface one genuine defect worth keeping: the app never called `reg.update()`, so an installed PWA
that is resumed rather than navigated could go indefinitely without checking for a new worker.

### R03

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

### R04

**כותרת:** The agent fan-out wedge: ~50 agents / 25 concurrent wedged the machine and returned plausible partials (2026-07, relearned from §11a).

**נוסח הכלל:** A mass dispatch (~50 agents, ~25 concurrent) wedged the workstation; the partial results that did come back
looked complete and were unreliable — the same lesson §11a already teaches for suite workers ("the local worker
count assumes an idle machine"), relearned at full price for agents. Prior API-529-killed audit runs are the
same class. Gate (§10.5a): sequential by default; independent LIGHT work ≤3 concurrent; hard cap 5; at most ONE
heavy agent while a suite run, build, or the translation GPU queue is active; on API 529, drop to
one-at-a-time and send a small probe agent first. And ALWAYS reconcile the dispatch journal — agents started vs
results received — before trusting any fan-out workflow's output.

### R05

**כותרת:** Hebrew check

**נוסח הכלל:** Hebrew check. Any user-facing string: rendered in Hebrew, no English leak, correct singular/plural on interpolated counts, correct domain term. Screenshot.

### R06

**כותרת:** Identical-looking code behaved differently — an invisible control byte (2026-08-01).

**נוסח הכלל:** A small tool's row-matching regex silently matched **zero** rows on every run. Re-reading the source
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

### R07

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

### R08

**כותרת:** The Waiver Gate (the single most important new rule)

**נוסח הכלל:** **Root cause of this whole report:** `equipPlan` — the central mechanism of an approved spec — was waived in a plan file (`plans/2026-07-20-equipment-occupancy-layer.md:1220`) and never surfaced in conversation.

**New rule, absolute:**

> A plan may never waive, defer, or reinterpret a requirement from an approved spec.
> Any such change is raised with the owner **in conversation**, with the spec text and the reason, and requires explicit approval.
> "Recorded in a document" does not count as raised.

This also applies to: reordering phases in a way that drops a dependency, marking a spec item "deferred", and narrowing a DoD line.

### R09

**כותרת:** Verify the measurement before trusting the measurement (2026-07-23).

**נוסח הכלל:** Two probes lied in one
evening: (a) a "clean screen" wrapped runs in `/usr/bin/time`, which **does not exist in Windows git-bash**
— all five "runs" executed nothing, and the idle CPU was misread as "not CPU-bound"; (b) sampling
`chrome.exe` missed that Playwright's browser can run as `headless_shell.exe`. Gate: when a measurement
shows something surprising, first prove the probe ran the workload — non-trivial duration, processes
actually spawned, server actually responding — before reasoning from it.

### R10

**כותרת:** Four defects in code the CONTROLLER dictated, and three conflicts only the full suite saw
(2026-08-02, a fourteen-task arc).

**נוסח הכלל:** Two patterns worth separating.

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

### R11

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

### R12

**כותרת:** A proxy metric is not the screen: "99% translated" shipped half-English screens (v267, 2026-07-26).

**נוסח הכלל:** The v267 localization claim ("~99% translated", "ready to test") was measured on key coverage and bundle-string
grep — while the real fr/de/es/it screens rendered roughly half English. The owner caught it on screen, and the
sequel (v269/v270) exposed two more layers the proxy could not see: untranslated data-values behind translated
keys, and shell-level leaks past the dictionary. This is the exact failure the project's own skill
`verify-against-the-runtime-path` was written to prevent — violated a second time after the skill existed.
Cost: three repair releases (v268–v270) plus an owner QA round, plus owner trust burned on a "done" that wasn't.
Root cause: measuring at an intermediate (keys, bundle strings) instead of at the consumer's input (the rendered
DOM, per language). Gate: any coverage/translation/localization claim is stated ONLY from a rendered-DOM
measurement per language (§10.19); key-coverage and grep counts may be reported only as explicitly-labeled
proxies, never as the claim.

### R13

**כותרת:** `hooksOver` and `scale_res` shipped computed-but-unread; hanging feature inert

**נוסח הכלל:** `hooksOver` and `scale_res` shipped computed-but-unread; hanging feature inert — root cause: A derived value was treated as done without a consumer — gate: DoD 5

### R14

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

### R15

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

### R16

**כותרת:** Be skeptical — evaluate a better ingredient, don't just patch the current one

**נוסח הכלל:** > **Owner instruction, 2026-07-23.** When a component (a server, a runner, a framework, a library)
> **repeatedly** causes trouble, question whether it is the right tool — do not keep stacking band-aids on
> it. Research and weigh **better alternatives** (a different static server, a different test pattern, a
> different runtime) against the incumbent, and switch when the alternative is genuinely better. The
> correct fix is sometimes a better ingredient, not another workaround. Pair this with §10.14: the
> alternatives are found by research, then judged on evidence.

### R17

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

### R18

**כותרת:** Maximize subagent usage

**נוסח הכלל:** Delegate aggressively: implementers, reviewers, debuggers, analysts, verifiers. Parallelise wherever the work is independent. The controller coordinates and verifies; it does not do work a subagent could do.

### R19

**כותרת:** Only interrupt for decisions that are genuinely important

**נוסח הכלל:** > **Ask the owner only when the decision is important. If it is not, do not ask — proceed by the order / the recommended option, and note the choice in the step summary.**

A decision is **important** (→ ask) when it: is hard to reverse or destructive; involves safety or a legal/health number; **waives or reinterprets a spec requirement** (§4 Waiver Gate — always ask); materially changes scope, cost, or the deliverable; or turns on the owner's preference in a way that cannot be reasonably inferred.

A decision is **routine** (→ do not ask, just do it) when it is: task ordering among items already agreed; an obvious or conventional default; an implementation detail; or anything where a careful colleague would simply pick the sensible option and move on.

When genuinely unsure which bucket a decision falls in, **prefer proceeding over interrupting** — make the call, state it in the summary, and let the owner redirect if they disagree. Interrupting for a routine choice wastes the owner's time; the summary-after-every-step (§10.6) is the safety net.

### R20

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
