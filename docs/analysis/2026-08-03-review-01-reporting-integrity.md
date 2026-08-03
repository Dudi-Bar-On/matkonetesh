# Review 01 — Reporting integrity, session of 2026-08-02 evening → 2026-08-03 evening

**Subject:** not the code. What was claimed, with how much confidence, on what evidence, and what
happened to the claim afterwards.

**Why this review exists —** the owner's words:

> "אחרי הדוחו"ת האחרונים שלך אני מסיק שמשהו אצלנו לא עשוי מספיק נכון… אנחנו לא דטרמיניסטיים.
> האינדיקציה הכי ברורה לזה הינה התשובות המתחלפות שלך באופן קיצוני — מטוב ללא טוב, מטעינו ללא טעינו,
> מהיה ללא היה, מבדקתי לא נכון ועוד."

**Evidence base.** 26 commits `a3e2b08..e554bb6`; `docs/releases/2026-08-03-morning-report.md`;
ROADMAP §5a rows R-74…R-87; the three `docs/analysis/2026-08-03-*` documents; spec v1/v2 and the
data-model plan with its ADDENDUM + REVISIONS 2/3; 17 subagent reports under `.superpowers/sdd/`;
`docs/process/development-discipline.md` §11 L45–L47; `docs/STATUS-BOARD.md`.

**Verification note.** Two subagents reconstructed the corpus arc and the plan revisions. I re-ran
their load-bearing claims against the working tree myself and report only what I confirmed. Where a
subagent claim did not survive that check, it is not in this report. Two corrections to the brief I
was given: **there is no R-88** (the register ends at R-87), and **there is no REVISION 4** (the plan
has ADDENDUM + REVISIONS 2 and 3; there is no REVISION 1 either, and nothing explains the gap).

---

## 1 · Incident table

Confidence column: **F** = stated as flat fact · **Q** = stated with a qualifier · **H** = hedged.

| # | Claim | When | Conf | Evidence held at that moment | What it turned out to be | Class | The check that would have prevented it | Cheap? |
|---|---|---|---|---|---|---|---|---|
| **I-1** | "`curl` is completely disconnected from the network — even with the sandbox disabled. **The only** network channel that exists is `WebFetch`." Written under the header *"חסום — אומת בעצמי היום"* | 08-02, phase 1, into `00-SOURCE-MAP.md` §1 | **F** | One `curl https://example.com` → `000` | False. `node fetch` has full network. Exactly **one** of the declared blocks was real (`fsis.usda.gov` 403). Five sources abandoned or reconstructed were one fetch away; one **wrong fact** entered the corpus (AskUSDA organ list) | Wrong-frame measurement → Inherited assumption | `node -e "fetch('https://example.com').then(r=>console.log(r.status))"` | **Cheap — 30 s** |
| **I-1a** | The brief hardened I-1 into *"מציאות האחזור, נקבעה בשלב 1 — **לא לגלות מחדש**"* and told three agents `web.archive.org` was blocked and *"דיווח קודם שהוא עובד היה שגוי"* | 08-02, task brief | **F** | The same single `curl` | The prior agent was right; `web.archive.org` returned 200. A correct report was overruled by a non-executed inference | Inherited assumption | Before writing "the prior report was wrong", execute the thing it reported | **Cheap — 30 s** |
| **I-1b** | Round-1 coverage: A "5/5 הושגו (100%)", C "5 מתוך 5… 0 דילוגים בשקט", B "7 of 9 retrieved" ⇒ 17/19 | 08-02 22:54–23:02 | **F** | Folders created, something written in each | Audited recount: **7/19**. A's own five stood at 0🟢/4🟠/1🔴. A's headline included a source its own body marks *"(חסום, כצפוי, **לא נוסה שוב**)"* | Overclaimed coverage | Score against the brief's own definition of "obtained", not one chosen after the fact | **Free** |
| **I-1c** | `seriouseats.com` — *"עדיין 402 · ✅ אושר, ללא שינוי"*, written in the **round-2 correction table** | 08-03 00:15 | **F** | One request without a standard User-Agent | Report E, same round: **200, 452,140 bytes, no paywall**. `00-SOURCE-MAP.md:69` **still says 402 today** | Confident-then-refuted — **uncorrected** | Vary the one parameter that produced the original error before writing "confirmed" | **Cheap — 30 s** |
| **I-2** | R-82 scope narrowed from ~74 affected rows to **27** | 08-03 01:02 | **Q** | Reproduced in the UI; RED witnessed on 27 rows | **The narrowing was correct.** I verified: `CUTS` holds exactly 27 rows with `safe==0` and 0 with `safe` absent; the 47 absent-`safe` rows are all `SPECIALS`, and the ask branch is gated `if(e && e.kind==='cut')`. Residual imprecision: the commit body names `undefined\|\|63` as a live second state without saying it is unreachable there, so a reader cannot tell whether 47 more rows are exposed | — (correction toward the evidence) | Say which table the count is over; `e.kind==='cut'` is one line above the bug | **Cheap — 2 min** |
| **I-3** | A new test passed on its first run — its regex sat inside a TS template literal, so `\s` collapsed to `s` | 08-03 01:02 | **F** (reported as own failure) | — | Caught by the standing rule that a first-run pass is void (L45). Rewritten with `new RegExp` + an assertion that the pattern can fire | Test proving nothing | The gate already existed and **fired**. Nothing to add | — (gate worked) |
| **I-4** | The polling probe reported `citedSafeC` present on the live bundle while `.foot-stamp` still read **289** | 08-03 ~01:25 | **F**, then retracted | An `includes()` scan over live source text | Impossible; retracted. *"לא מצאתי לכך הסבר מבוסס ראיה ואיני ממציא אחד."* Settled in the browser instead. **Note:** the offered lesson (an `includes()` probe also matches comments — true for `c.safe\|\|63`) does **not** explain a hit on the string `citedSafeC`. The anomaly is still unexplained, and **no register row was opened for it** despite H8 | Wrong-frame measurement + unlanded residue | Probe for behaviour, not for a substring: `page.evaluate("typeof citedSafeC")` — which is what settled it anyway | **Probe design: cheap — 30 s.** Explaining the anomaly: **expensive**, and legitimately so |
| **I-5** | *"full suite run for context shows **21 pre-existing** failures unrelated to this change, **confirmed identical on baseline `b2ba95c`**"* — committed to the permanent record | 08-03 17:14 (`499bf5a`) | **F** | A real suite run + a real baseline run | False. `b2ba95c` is **four commits after** `df84324`, the change that caused them. Refuted 28 minutes later at the true parent `04856ce`: 8/8 pass there, 8/8 fail on main. Also: the source report says *"**20** of the same tests already fail identically"*; the commit rounded it to 21 and added "confirmed" | Wrong-frame measurement (baseline inside the regression window) | `git merge-base --is-ancestor <suspect> <baseline>` — or simply reading `git log --oneline` | **Cheap — 10 s** |
| **I-5a** | Task B (`df84324`) shipped to `main` reported green: *"28/28 בדיקות ירוקות (5 מפרטי model + service-worker)"* | 08-03 15:30 | **F** | A 5-file scoped run | Task B added an **unconditional `fetch('items.json')` to app boot** and broke 25 tests across 5 `isolatedPage` spec files. The regression sat on `main` for **2 h 12 min** and was mislabelled once in a commit message on the way | Overclaimed coverage (scoped run reported as a green gate) | After touching app boot, run **one** `isolatedPage`-typed spec — `tests/vg-evstate.spec.ts`, ~19 s | **Cheap — 20 s** |
| **I-5b** | `docs/STATUS-BOARD.md` still presents Task B as clean, "28/28 בדיקות ירוקות", and records neither the regression nor its fix | current, as of this audit | **F** | — | The board was last written at 15:30 — before the regression was found. `e1bd8fb` corrected the commit log; **the living document the owner reads was never corrected** | Correction hygiene | Board update belongs to the *fix*, not only to the *feature* (H10) | **Free** |
| **I-6a** | *"כל **227** הפריטים (177 + **50** MAKES)"* — written into the **DoD checklist of the approved spec v2**, and *"+50 makes"* into the reconciliation | 08-03 02:24 | **F** | `len(data.MAKES)` | **50 is the pre-merge count.** I verified: `data.MAKES` = 50, `sausages_new.NEW_SAUSAGES` = 52, and `build.py:29` does `MAKES.update(NEW_SAUSAGES)` → **102**. The catalogue is **279**, not 227. An approved DoD line that is arithmetically unsatisfiable | Wrong-frame measurement | `grep -n MAKES build.py` — line 29 is the merge | **Cheap — 5 s** |
| **I-6b** | Spec v1 headline: *"**193** שורות"*, repeated in its migration order and its DoD (*"כל 193 הפריטים"*), and in the plan's Goal line | 08-03 01:40 | **F** | — | 130 + 47 = **177**. v1 uses the 130 denominator four lines later in the same block. v2's §8 lists **ten** places v1 was wrong and **does not list this one**; the DoD line silently became "227" | Wrong-frame measurement, silently superseded | Addition | **Free** |
| **I-6c** | Task 1 initially read `source_id` off a raw `model.build_items(data.CUTS, …)` call, which shows all 103 thermal blocks unmapped | 08-03 01:59 | **Q** | — | Caught **before reporting**: *"a raw call, without replicating `build.py`'s merge step, will show all 103 as unmapped; this was checked and corrected before reporting the final number"* (99/103 resolve). Same class as I-6a, same day, **caught** | — (self-caught) | Identical to I-6a's check | — |
| **I-6d** | `CLAUDE.md`: *"the ~9.5k-line app.js"* — in the file every subagent loads | standing | **F** | — | 14,651 lines. Wrong by a third, corrected at `04856ce` | Inherited assumption | `wc -l app.js` | **Cheap — 5 s** |
| **I-7** | A roster of available reviewer agents presented to the owner, naming `architect-review` and `security-auditor` | 08-03 ~19:20 | **F** | Memory of plugin file names | Both are **plugin files, not registered agent types**; and role 5 (UI/QA) had **no agent at all** — `webapp-testing`/`design-is` are skills. Four corrective commits in 29 minutes (`16ba665` → `981e411` → `a7bb59a` → `e554bb6`) | Inherited assumption / capability claim with zero probes | The registered agent-type list is **already in context**. Read it | **Free — 0 s** |
| **I-8** | *"הבטיחות היא תכונה של הפריט… והיא נכונה אמפירית **בלי יוצא מן הכלל**"* — the principle the whole data model rests on | 08-03 02:24, morning report | **F** | `safe` identical across route A / route B / `data.py` on the sheet-matched cuts | The measurement is sound. Its scope is **68 sheet-matched CUTS out of a 279-item catalogue (24%)** — no SPECIALS, no MAKES. The source document states it correctly as *"נמדד 68/68"*; the report to the owner promoted it to a universal. The report also says **67/67** where the analysis says **68/68** — an unreconciled 1-item drift between a document and its own summary | Overclaimed coverage; headline stronger than body | Write the denominator next to the number | **Free** |
| **I-9** | *"✅ משימה 1 הושלמה — 103 בלוקים תרמיים"*, reported to the owner as a completed deliverable | 08-03 01:59 / morning report | **F** | The blocks exist and 99 resolve to a corpus source | The spec's headline idea is *"`thermal` — עקומה, לא מספר"*, and its stated payoff is that the **36 rows where `tgt < safe` stop being anomalies** (I verified: 36 in `CUTS`). In shipped `model.py:142-143`, `curve`, `basis` and `basis_ref` are hard-coded `None` in **every** block, no plan task fills them, and **neither the task report nor the morning report mentions it** | Overclaimed completion / silent truncation | Grep the shipped struct for the fields the spec's headline promises before calling the task complete | **Disclosure: cheap — 10 s.** Building the curves: **expensive, and rightly deferred** |
| **I-10** | `model_triggers.py:50` ships `{'every': {'min': 45}}` for flip/rotate cadence | 08-03 | **F** (unreported) | none — the number appears in no source, no sheet, no spec | An invented number, shipped, under a plan whose ADDENDUM states *"never guess the missing number"*. **Not a safety value**, so DoD-10 is intact — but it is exactly the class the ADDENDUM forbids, and it is in no report | Overclaimed provenance | Any literal with no source gets a `# UNSOURCED` marker and a report line | **Cheap — free at write time** |
| **I-11** | `docs/STATUS-BOARD.md` cumulative summary: *"**134 מהדורות** (v147→**v280**)… **876 בדיקות** ירוקות היום"* | current | **F** | — | The same document records **v290** and the suite is **1176**. H10 requires the board current at every task close | Correction hygiene / stale headline | Update the summary row in the same edit as the phase row | **Free** |

### The mirror failure — a correct finding softened into compliance

Round-1 agent **C** diagnosed the actual cause correctly, in writing:
*"חסימת WebFetch קשה ל-`www.seriouseats.com` (**שגיאת כלי, לא רשת**)"* — a tool error, not a network
fact. That is the exact insight that took nineteen hours and L46 to re-derive. C then **recorded the
source as unretrievable anyway** and recommended adding the host to the blocked list in the source
map, and predicted *"שום ריצה נוספת לא צפויה לפתור אלה"*.

An evidence-backed finding was stated and then discarded because it contradicted an inherited
premise. This is the most expensive under-claim on the record — more expensive than any of the
over-claims, because the correct answer was already in the file.

---

## 2 · The pattern — one mechanism, not seven

The owner's hypothesis is that this is systemic. **It is, and the mechanism is single and nameable.**

> **A fact was measured correctly in one frame, then used outside that frame with the frame
> discarded.**

| Incident | Measured, correctly | Used as |
|---|---|---|
| I-1 | one binary's network access | "the environment has no network" |
| I-5 | a tree that already contained the change | "before the change" |
| I-6a | `data.MAKES` before `build.py:29` merges | "the number of MAKES" |
| I-6b | 193 of something | "the number of items" |
| I-8 | 68 sheet-matched cuts | "the catalogue, without exception" |
| I-7 | files on disk named like agents | "registered agent types" |
| I-4 | source text containing a substring | "the deployed function" |
| I-1b | folders created | "sources obtained" |

In **every** row the measurement is correct and the label is wrong. Not one of these is a careless
measurement, a rushed test, or a guess. They are all the same act: a number written down without the
sentence that says what it is a number *of*.

**And this is precisely the mechanism that produces oscillation.** When the frame is not recorded
beside the number, a later re-measurement in a different frame disagrees — and there is no way left
to tell which one is right. So the answer flips (`21 pre-existing` → `ours after all`), and where a
third frame appears it can flip back. The owner is not seeing carelessness. He is seeing the
signature of un-recorded denominators.

**A second, smaller mechanism** is real and separable: the **summarization step**, not the
measurement step, is where confidence inflates. In nearly every incident the body of the document
holds the qualifier the headline drops:

| Body says | Headline says |
|---|---|
| "**20** of the same tests already fail identically" (report) | "**21** pre-existing… **confirmed**" (commit) |
| "(חסום, כצפוי, **לא נוסה שוב**)" (report A) | "5/5 הושגו (**100%**)" (report A) |
| "**נמדד 68/68**" (reconciliation) | "נכונה אמפירית **בלי יוצא מן הכלל**" (morning report) |
| `"curve": None` (model.py) | "✅ משימה 1 הושלמה — 103 בלוקים תרמיים" (morning report) |
| "fda.gov confirmed blocked (**per brief**)" (report B) | "#13 FAILED — unreachable" (report B) |

The work underneath is more careful than the reporting on top of it. **The owner reads the top.**
That is the whole gap between what this session actually was and how it read.

---

## 3 · Calibration

**Above the evidence** — I-1, I-1b, I-1c, I-5, I-6a/b/d, I-7, I-8, I-9. Nine of eleven incident
families. Every one is a flat assertion where the underlying document held a qualifier.

**Below the evidence** — one instance, and it cost more than several over-claims: agent C's correct
"tool error, not network", stated and then abandoned (above).

**Correctly calibrated, and worth naming because it is the standard the rest should meet:**

- `docs/analysis/2026-08-03-v290-live-verification.md` §3 — *"לא מצאתי לכך הסבר מבוסס ראיה ואיני
  ממציא אחד"*, with the settled part separated from the unsettled part. This is exactly right.
- `docs/analysis/2026-08-03-suite-performance.md` — measurement first, one variable at a time, and
  the headline recommendation is a **rejection** of the writer's own hypothesis (workers 20→24 made
  the suite 1.8× slower, measured not theorised). Machine idleness verified before every run and
  stated.
- Spec **v2 §8** — ten numbered places where v1 was wrong, using the flat word **שגוי**, plus §8.10
  listing what v1 got right. That is a correction of record done properly.
- I-6c — the same wrong-frame count as I-6a, **caught before reporting**, and the catch written into
  the report.
- The R-82 narrowing (I-2) moved *toward* the evidence, which is what a correction should do.

**Correction hygiene overall: prompt and plain, with one systematic exception.** Corrections were
made in commit messages, quickly, without burial and without over-apology. The exception is that they
stop there: I-5b (the board still shows Task B clean), I-1c (`00-SOURCE-MAP.md:69` still says 402),
I-11 (stale board summary) and I-4 (no register row for the unexplained probe) are all still wrong in
the living documents **right now**. A correction that reaches the git log but not the STATUS-BOARD
has not reached the owner.

---

## 4 · Did L46 and L47 change the behaviour they prescribe?

Both were written during this session, about this failure class. **The honest answer is no.**

**L46** — *"a capability claim about the environment requires TWO independent tools before it may be
written down as fact"* — written at 00:15.

- At **~19:20**, nineteen hours later, a roster of available reviewer agents was presented to the
  owner as fact, produced with **zero** tools, and two of its entries did not exist (I-7). That is a
  capability claim about the environment, made with less evidence than the one L46 was written about.
- L46's own correction round left an instance of L46's exact failure inside the corrected document
  (I-1c, `00-SOURCE-MAP.md:69`), and it is still there.

**L47** — its main body (a field encoding three states will be read three ways; collapse to one
reader) **changed the code**: `citedSafeC()` shipped and is now the single reader. That worked.
Its process note #1 restates **L45**, and L45's mechanism — *a first-run pass is void* — genuinely
fired and caught the template-literal regex (I-3). **The gate that was already wired to a contract
worked. The lessons that were written as prose did not.**

That is the finding: `docs/process/development-discipline.md` §11 is now a 1,516-line document
holding 47 lessons, and the ones that change behaviour are the ones attached to an executable
gate (`check-meta.mjs`, the DoD-12 first-run-pass rule). L46 is attached to nothing. Adding L48
would repeat the error.

---

## 5 · Rules — three, each tied to named incidents, each with its real cost

### Rule 1 — Every count and every baseline states its frame in the same sentence

Not *"227 items"* but *"227 = 177 + `len(data.MAKES)`, which is the count **before** `build.py:29`
merges `NEW_SAUSAGES`"*. Not *"confirmed on baseline `b2ba95c`"* but *"baseline `b2ba95c`, which is
four commits **after** `df84324`, the suspect change"*. Not *"without exception"* but *"68/68 of the
sheet-matched cuts; SPECIALS and MAKES not measured"*.

**Would have caught:** I-5, I-5a, I-6a, I-6b, I-8, I-1b — six incidents, including both of the two
that reached the permanent record as false.
**Cost:** one subordinate clause per number. Effectively zero. The record already shows it works —
I-6c is this rule applied by an agent unprompted, and it caught the identical error to I-6a.

### Rule 2 — A capability claim is executed, or it is not made

Any claim about what the environment, the tool set, or the installed agents can do is accompanied by
the command that produced it, pasted. Not L46's "two tools" — that rule was written and then ignored
within the same day. **One executed probe, always, with its output shown.** If you cannot paste a
command, the sentence does not get written.

**Would have caught:** I-1 (30 s), I-1a (30 s), I-7 (0 s — the list was already in context),
I-1c (30 s), and it reshapes I-4's probe from a substring scan into `page.evaluate("typeof
citedSafeC")`, which is what settled the question anyway.
**Cost:** 10–60 seconds per capability sentence. For I-7 it was free.

### Rule 3 — The headline is the weakest true sentence in the body

Before writing any summary line, find the qualifier in your own body text and either carry it up or
delete the line. If the body says "not retried", the headline may not say "100%". If the body says
"20 of them", the commit may not say "21, confirmed". If `curve` is `None`, "משימה 1 הושלמה" needs
the clause that says so.

**Would have caught:** I-1b, I-5, I-8, I-9, I-5b, I-11 — and it is the direct countermeasure to the
oscillation the owner reported, because the flips happened between headlines, not between bodies.
**Cost:** one re-read of your own document before summarising it — roughly two minutes per report.
Real, and the cheapest two minutes on this list.

### Explicitly not proposed

- **"Run the full suite after every task."** ~3.2 min × every task, against an owner who has already
  said the gate is too expensive. The record shows the cheap version suffices: one `isolatedPage`
  spec (~19 s) would have caught I-5a. That belongs in Rule 1's frame discipline, not in a new gate.
- **A new lesson entry L48.** §4 above is the argument against it.

---

## 6 · What was NOT a discipline failure, and should not be treated as one

Separating these matters, because conflating them produces either paralysis or contempt for the rule.

| Item | Why it is a legitimate cost of speed |
|---|---|
| The unexplained `citedSafeC`-on-289 probe hit (I-4) | No cheap check explains it. The response — refuse to invent an explanation, settle it in the browser, extract only the certain lesson — is the correct handling of an anomaly you cannot afford to chase. **Its only defect is that it was never registered** (H8), so it will surprise someone again |
| `curve`/`basis` unbuilt (I-9) | Building thermal curves from Baldwin's tables is genuine work and deferring it is sound. The failure is the **silence**, not the deferral |
| The 24-worker rejection | Measured, one variable, hypothesis rejected, cost stated. Model conduct |
| The R-82 narrowing 74 → 27 (I-2) | A correction toward the evidence. Corrections that move toward evidence are the system working, not the system failing |
| Spec v1 being superseded by v2 | v1 was approved before the owner's spreadsheet was found. A design that changes when a better input arrives is not instability — and §8 documented it properly |

---

## תקציר לבעלים

**מה מצאתי, בלי ריכוך.** התחושה שלך נכונה, והיא לא תחושה — יש לה מנגנון אחד, וזיהיתי אותו: **מספר
נמדד נכון במסגרת אחת, ואז נכתב בלי המסגרת.** ‏`curl` מדד כלי אחד ונכתב "אין רשת". ‏`b2ba95c` היה
**ארבעה קומיטים אחרי** הבאג ונכתב "בסיס". ‏`data.MAKES` נספר לפני המיזוג ב-`build.py:29` ונכתב "227
פריטים" לתוך ה-DoD של ספק **מאושר** — האמת היא 279. ‏68 שורות מהגיליון (24% מהקטלוג) נכתבו "נכון בלי
יוצא מן הכלל". רשימת סוכני הביקורת נמסרה לך מהזיכרון, ושניים מהם לא היו קיימים. בכל אחד מהמקרים
המדידה הייתה נכונה והתווית הייתה שגויה — **ולכן התשובות התהפכו**: כשאין מסגרת רשומה ליד המספר, אין
דרך להכריע בין שתי מדידות שסותרות זו את זו.

**המצב חמור, אבל לא במקום שחשבת.** העבודה עצמה זהירה יותר מהדיווח עליה. כמעט בכל מקרה, גוף המסמך
מחזיק בדיוק את הסייג שהכותרת השמיטה: הדוח כתב "20 מהבדיקות", הקומיט כתב "21, אושר"; הדוח כתב "לא
נוסה שוב", הכותרת כתבה "100%"; הניתוח כתב "נמדד 68/68", דוח הבוקר כתב "בלי יוצא מן הכלל".
**הפגם הוא בשלב הסיכום, לא בשלב המדידה — ואתה קורא את הסיכום.**

**מה שהכי צריך להדאיג אותך:** שני התיקונים הכי חשובים של היום הגיעו ל-git ולא הגיעו ללוח. ‏
`STATUS-BOARD.md` עדיין מציג את Task B כירוק ("28/28") למרות שהוא שבר 25 בדיקות; ‏`00-SOURCE-MAP.md`
שורה 69 עדיין כותבת "‏402 · ✅ אושר" על מקור שנמדד 200 באותו סבב עצמו. **תיקון שלא הגיע ללוח לא הגיע
אליך.**

**ולקח שנכתב אתמול ולא שינה דבר:** ‏L46 דורש שני כלים לכל טענה על הסביבה. תשע-עשרה שעות אחריו הצגתי
לך רשימת סוכנים שנבנתה מאפס כלים. **לקח שאינו מחובר לשער — אינו לקח.** לכן לא הצעתי L48; הצעתי שלושה
כללים בלבד, וכולם עולים שניות.

---

*Reviewer: reporting-integrity-auditor · 2026-08-03 · no file other than this report was modified;
nothing was committed.*
