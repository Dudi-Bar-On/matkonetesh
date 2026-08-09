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

### S77

**כותרת:** `תנור` used as the generic device word, colliding with the oven category

**נוסח הכלל:** `תנור` used as the generic device word, colliding with the oven category — root cause: New code ignored a correct pattern already in the codebase — gate: DoD 9

### S78

**כותרת:** The right conclusion reached through an invented mechanism — and why the conclusion being
right is what makes it dangerous (2026-08-06).

**נוסח הכלל:** **What happened.** A gate (`check-pytest`) failed during Task 9 on a test unrelated to the change. The
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

### S79

**כותרת:** An unplanned reboot can corrupt an index, and only a full suite will tell you (2026-08-06).

**נוסח הכלל:** The machine restarted itself at 02:27 (System event 1074). Hours later, while implementing an
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

### S80

**כותרת:** A baseline that encodes the wall clock is a gate scheduled to fail (2026-08-06).

**נוסח הכלל:** The Phase C visual baselines photographed `#cGreet`, whose text `app.js:12361` computes from
`new Date().getHours()`. A baseline taken at 23:26 says "ערב טוב"; the identical, unchanged screen
says "בוקר טוב" after midnight. Six of seven baselines were built to go red twice a day for reasons
no commit caused — the precise mechanism by which a gate becomes noise and gets silenced, which this
project has already watched happen to a permanently-amber signal.

Non-reproducible regions are **masked, and the mask is justified in the file**: the greeting's
correctness belongs to a functional test that can control the clock, not to a photograph. The broader
rule for snapshot gates: before storing a baseline, name every pixel in it that depends on the clock,
on focus, or on scroll position — those three produced all six failures here — and either pin the
state or mask it.

### S81

**כותרת:** שער שנורה על המקרה הבריא נכבה תוך יום (8.8.26).

**נוסח הכלל:** שלוש פעמים באותה משמרת: ‏`check-backup-fresh`
הכריז על ארכוב תקוע כשמדד גיל-קובץ במקום מה שתלוי ועומד · ‏`check-no-secrets` סימן הפניה למשתנה כאילו
הייתה סוד · וכלל טענות-ההצלחה היה חוסם 2 מכל 7 מהודעות אמיתיות שנשאו ראיה. **בכל שלושת המקרים התיקון
לא היה להקל אלא לדייק את המדד.** אזהרת-שווא אינה מטרד — היא מלמדת לעקוף את השער, וזה יקר מהפגם שהשער שמר עליו.

### S82

**כותרת:** A DoD-5 "add a consumer" fix can itself be dead if the consumer's render path never runs on the data (scale_res reader added, but makes/specials rendered no equipment section)

**נוסח הכלל:** A DoD-5 "add a consumer" fix can itself be dead if the consumer's render path never runs on the data (scale_res reader added, but makes/specials rendered no equipment section) — root cause: Confirmed a reader exists but not that it executes on the shipped rows — gate: DoD 5 must name the render path AND confirm it fires on the real data

### S83

**כותרת:** Pinning a browser clock exposed a test mixing page-side and Node-side dates (fixed page date vs real wall time)

**נוסח הכלל:** Pinning a browser clock exposed a test mixing page-side and Node-side dates (fixed page date vs real wall time) — root cause: `page.clock` only affects the page; a Node-side `new Date()` in an assertion still reads real time — gate: When using `page.clock`, sweep the spec for Node-side clock reads in assertions

### S84

**כותרת:** An exception that pip can silently undo is a coincidence, not a decision (2026-08-05).

**נוסח הכלל:** The owner ruled we run neo4j driver 6.2 against `llama-index-graph-stores-neo4j`'s declared
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

### S85

**כותרת:** I built a phase from my summary of the spec instead of from the spec (2026-08-05).

**נוסח הכלל:** Phase 3 of the knowledge-stack prompt was committed and called complete. Going to read the label
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

### S86

**כותרת:** שער עיוור מדווח ירוק, ולא בגלל ציות (8.8.26).

**נוסח הכלל:** שני כללי הידע (§10.13, §10.17) בדקו
‏`tool_name === 'Grep'` — כלומר רק את הכלי הייעודי. **נמדד על משמרת שלמה: ‏105 קריאות grep דרך Bash,
‏0 דרך הכלי, ‏0 קריאות serena.** שניהם דיווחו ירוק כל הזמן. ⚠️ **"אין ממצאים" אינו "יש ציות"** — לפני
שסומכים על שער שקט, למדוד שהוא בכלל רואה את הנתיב הנפוץ. וההפך גם נכון: אחרי התיקון רק **0.5%** מאותן
קריאות מזהירות — הרוב היו חיפוש ממוקד בקובץ ידוע, שאינו חיפוש קורפוס כלל.

### S87

**כותרת:** Consistency with another artefact is not correctness — and two stale things agree perfectly
(2026-08-07).

**נוסח הכלל:** Consistency with another artefact is not correctness — and two stale things agree perfectly
(2026-08-07).

### S88

**כותרת:** A test helper that cannot tell "absent" from "broken" hides the bugs it was meant to
surface (2026-08-05).

**נוסח הכלל:** The worker tests skipped on ANY failed ingestion with the message "stack unavailable". A genuine
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

### S89

**כותרת:** תכונה שנשלחה אינרטית עוברת את כל בדיקותיה (8.8.26).

**נוסח הכלל:** ‏`stop.mjs` טען את ספריית הכללים רק כאשר
משתנה-סביבה **של בדיקות** היה מוגדר; בייצור הכלל לא נטען כלל. ‏333 בדיקות ירוקות על תכונה שאינה עושה
דבר — **כי כל אחת מהן הגדירה את המשתנה.** ‏⚠️ זה גרוע מהיעדר תכונה, כי הכול מדווח שהיא קיימת.
**המבחן שנוסף:** לפחות בדיקה אחת חייבת להריץ את נקודת-הכניסה **בלי שום דריסת-סביבה** — אחרת הסוויטה
עיוורת בדיוק לשאלה "האם זה בכלל נטען".

### S90

**כותרת:** A citation that grants more than its source does — twice in two consecutive tasks
(2026-08-06).

**נוסח הכלל:** Two agents, two tasks, the same shape:

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

### S91

**כותרת:** Work called shipped while spec DoD lines were NOT MET

**נוסח הכלל:** Work called shipped while spec DoD lines were NOT MET — root cause: No per-phase DoD audit against the spec — gate: §3 per-phase gate

### S92

**כותרת:** A gate that accuses is worse than a gate that misses (2026-08-05).

**נוסח הכלל:** `check-pytest` blocked a commit reporting **"the Python suite is red"** while the suite was green —
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

### S93

**כותרת:** מצב משותף בין שחקנים מקבילים חוסם את מי שלא חטא (8.8.26).

**נוסח הכלל:** סוכנים משוגרים יורשים את
‏`session_id` של ההורה, ולכן כשלים של סוכן אחד חסמו עריכות של אחר — נצפה חי פעמיים. **ההפרדה חייבת להיות
לפי מונה ולא גורפת:** ‏§5 ברמת השחקן, ‏§10.16 ברמת ה-session; היקוף אחיד שובר את אחד מהם. **ושורות ישנות
הן החלטה ולא פרט:** לשייך אותן "לכל שחקן" משחזר את הפגם, למחוק אותן מאבד מונה חי.

### S94

**כותרת:** הכלי, לא הנבדק — שבע פעמים בלילה אחד (8.8.26).

**נוסח הכלל:** שבע פעמים במשמרת אחת דיווחתי או כמעט דיווחתי
על פגם בקוד, והדבר השבור היה **בדיקת האימות שלי**: ‏heredoc של bash אכל לוכסן וכמעט הכרזתי על
‏`archive_command` תקין כשבור · שם משתנה-סביבה שגוי גרם לכלל שקט להיראות רועש · ארגומנטים בצורה לא-נכונה
גרמו לבדיקת בידוד לעבור **בלי למדוד כלום** · הזרקתי אירועים ישירות ועקפתי את המסווג שאותו בדקתי ·
הצבעתי על שתי חנויות-מצב שונות · העברתי את התמליל האמיתי של הסשן לבדיקה שכל עניינה מה קורה **בלי**
הפעלת skill — פעמיים. **הרפלקס:** לפני שמדווחים על תקלה בנבדק, לאמת שהכלי מודד את מה שחושבים שהוא מודד —
בדיקה שעברה בלי לרשום כלום היא בדיוק כמו טענה שלא הורצה.

### S95

**כותרת:** "The geniza has it" is not "git has it" — and I read one as the other (2026-08-06).

**נוסח הכלל:** L62 and L63 were written, quoted in four commit messages, cited in dispatches to subagents, and
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
