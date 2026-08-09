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

### S39

**כותרת:** A worker ceiling measured on a contaminated machine is not a ceiling — and it cost us a wrong
"hardware truth" (2026-07-23; corrected the same day).

**נוסח הכלל:** The original entry here asserted a mechanism:
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

### S40

**כותרת:** A summary written from recollection is not the source (2026-07-22).

**נוסח הכלל:** Asked whether the discipline reaches every mission, I found the real gap — this repo had no `CLAUDE.md`,
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

### S41

**כותרת:** `hooksOver` and `scale_res` shipped computed-but-unread; hanging feature inert

**נוסח הכלל:** `hooksOver` and `scale_res` shipped computed-but-unread; hanging feature inert — root cause: A derived value was treated as done without a consumer — gate: DoD 5

### S42

**כותרת:** A "fix" whose mechanism never fires is a placebo (2026-07-23).

**נוסח הכלל:** `navigationTimeout: 60_000` was
committed as the nav-flake fix and "verified" by 9 clean runs — but the test-level timeout (30s) is the
hard ceiling over navigation, so a nav timeout ABOVE it is **dead config**; the clean runs were lucky
low-load windows (and a 3-run sample hides a 1-in-6 flake — §11a now says 6–9×). Gate: a fix must be shown
to actually FIRE — after the change, reproduce the failure and confirm the *error signature changed* (here:
"Test timeout 30000ms" should have become a nav-specific 60s error; it didn't — that was the tell).

### S43

**כותרת:** Hanging tests passed on an inert feature

**נוסח הכלל:** Hanging tests passed on an inert feature — root cause: Test asserted a computed field; fixture supplied exactly what the broken gate needed — gate: DoD 4, DoD 6

### S44

**כותרת:** Agents left waiting on a background suite run burn real time for no signal (2026-07-31).

**נוסח הכלל:** Across three tasks this session, subagents polled a backgrounded full-suite run and reported "still
waiting" repeatedly, costing roughly an hour combined with nothing to show for it. The cure was already
adopted in §11a — the controller owns the full-suite gate, not a dispatched subagent — but it was not
applied consistently this session. Gate: never hand a subagent a background suite run to wait on; the
controller runs it (or waits on it) directly and hands the subagent a verdict, not a polling loop.

### S45

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

### S46

**כותרת:** Over-bundling: three independent bug fixes rode one long subagent, and the owner had to ask "why so long?" (2026-07).

**נוסח הכלל:** Three unrelated fixes were bundled into a single long-running subagent (the bug1/bug2/bug3 wave reports). Each
fix was fine; the bundling meant no fix could land before the slowest one, progress was invisible, and the
owner's first signal was wall-clock pain. Root cause: §10.5 ("maximize subagent usage") read without
`dispatching-parallel-agents` — independence is the dispatch boundary. Gate: independent fixes ship as
independent dispatches (within the §10.5a ceiling) unless the owner explicitly chooses bundling; a brief that
bundles unrelated deliverables is sent back at review.

### S47

**כותרת:** A single-process server re-reading a 2.4 MB file per request made high concurrency non-deterministic (ERR_ABORTED)

**נוסח הכלל:** A single-process server re-reading a 2.4 MB file per request made high concurrency non-deterministic (ERR_ABORTED) — root cause: Server was the bottleneck, not the tests — gate: Clustered + in-memory server; pin workers to the measured reliable ceiling

### S48

**כותרת:** A ≥ floor marker rendered as ≤ (opposite meaning) in RTL — the DOM-text test asserted the char was present but not its visual order

**נוסח הכלל:** A ≥ floor marker rendered as ≤ (opposite meaning) in RTL — the DOM-text test asserted the char was present but not its visual order — gate: Numeric/math readouts in Hebrew UI must be LTR islands (dir="ltr"); catch bidi order by LOOKING, and guard with a dir assertion (row malformed in source: only 2 of 3 cells present)

### S49

**כותרת:** Generated-plan truncation: an LLM asked for 10 full tasks emitted code for 1–5 and prose for 6–10; an LLM asked to concatenate ~237k chars silently truncated (CP2, 2026-07-27).

**נוסח הכלל:** The first CP2 plan draft was produced by asking a model to emit a complete 10-task plan and then to concatenate
~237k characters of task material: the draft carried real code in Tasks 1–5 and prose-only Tasks 6–10 (zero
fenced blocks — the writing-plans "EXACT code in each step" requirement silently violated), and the
concatenation lost content with no error. Caught one step before dispatching implementers against empty tasks;
cost hours (the archived evidence: `scratch/cp2/draft-v1-REJECTED.md` vs the rebuilt, code-complete
`docs/superpowers/plans/2026-07-27-cooking-paths-cp2.md`). Root cause: output-length limits fail silently, and
"looks like a plan" was trusted without a mechanical check. Gate: `scripts/check-plan-complete.mjs` runs on
every generated plan BEFORE review (per-task fenced-block count > 0, truncation-in-fence detector — discipline
§2); and large documents are NEVER assembled by LLM concatenation — assemble mechanically (`cat`, file ops),
then run the completeness gate on the result.

### S50

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

### S51

**כותרת:** Research that never landed: the pre-answer to the owner's next complaint sat un-surfaced in a
research doc (2026-07-31).

**נוסח הכלל:** `docs/research/03-tts.md` (§15.7) already contained the Hebrew-pronunciation
analysis, the local-engine option, AND latency tactics that directly pre-answered the owner's later (§31.7)
TTS complaints — but only the top-level provider decision from that document ever reached the decision
register; the rest sat orphaned in the research file. This is the H8 "orphan class" of unlanded item, and
it was found by the owner's own memory of having written it, not by any gate — the Total Landing Rule
checks that ledger rows land in named phases, but nothing today checks that a research document's
sub-findings each get a landing, only its headline conclusion. Gate: when a research document informs a
decision, walk its full section list for landing, not just the section that answered the question being
asked at the time; an unlanded subsection is a debt exactly like an unlanded ledger row.

### S52

**כותרת:** The loopback saga: five campaigns tallied a defect that one boundary-instrumented probe found in an
afternoon (2026-07-24).

**נוסח הכלל:** Four full-suite certification campaigns before this one — Phase C, Phase C RERUN,
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

### S53

**כותרת:** 2026-07-30 · שחיקת כללי-כלים תחת קונטקסט ארוך — הבעלים תפס נטישה של serena/graphify לטובת grep ("אם אתה לא עושה — סימן שנמחקו לך הכללים").

**נוסח הכלל:** הכלל, מעכשיו קבוע:
1. כל עבודת קוד — קריאה ועריכה — דרך **serena** (find_symbol / find_referencing_symbols / get_symbols_overview / replace_symbol_body). לא רק חיפושים — העבודה עצמה.
2. כל שאלת מסמכים/קשרים/provenance — **שאילתת graphify** (`query`/`path`/`explain`) לפני grep; grep = fallback מוצהר בלבד.
3. **תמיד `graphify --help`** (ו-`initial_instructions` של serena) לפני שימוש — לנצל יכולות במלואן (`graphify watch` ישב ב-help כל הזמן ולא נוצל).
4. עדכון גרף רציף: `graphify watch` לקוד; docs ברענון `--mode deep` תקופתי, נאכף ע"י `scripts/check-graph-fresh.mjs`.
5. **מטא-כלל:** אם מזהים שהכללים האלה לא מיושמים — זה עצמו האות שהקונטקסט נשחק; עוצרים ומריצים מחדש את `docs/process/checklists/session-start.md`, לא ממשיכים.

### S54

**כותרת:** The agent fan-out wedge: ~50 agents / 25 concurrent wedged the machine and returned plausible partials (2026-07, relearned from §11a).

**נוסח הכלל:** A mass dispatch (~50 agents, ~25 concurrent) wedged the workstation; the partial results that did come back
looked complete and were unreliable — the same lesson §11a already teaches for suite workers ("the local worker
count assumes an idle machine"), relearned at full price for agents. Prior API-529-killed audit runs are the
same class. Gate (§10.5a): sequential by default; independent LIGHT work ≤3 concurrent; hard cap 5; at most ONE
heavy agent while a suite run, build, or the translation GPU queue is active; on API 529, drop to
one-at-a-time and send a small probe agent first. And ALWAYS reconcile the dispatch journal — agents started vs
results received — before trusting any fan-out workflow's output.

### S55

**כותרת:** A commit script that stages a directory silently omits everything outside it (2026-07-22).

**נוסח הכלל:** `scripts/sync-docs.sh` staged `docs/ .claude/skills/ scripts/`. **`CLAUDE.md` is at the repo root**, so
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

### S56

**כותרת:** A stale plan snippet instructed deleting something that had since shipped (2026-07-31).

**נוסח הכלל:** The Phase 1 plan told an implementer to delete `ru` from `LANGNAME`; Russian had shipped to the language
queue since the plan was written, and following the instruction literally would have regressed a live
language. The implementer caught the mismatch, refused to comply, and reported back instead — the correct
behavior. Root cause: a plan is evidence of intent at the time it was written, not of current truth, and
nothing re-validated the plan's assumptions against the tree before execution. Gate: an implementer treats
every plan instruction that deletes or reverts existing behavior as a claim to verify against the current
tree first, not an order to execute blind; when the tree has moved on, stop and report rather than comply.

### S57

**כותרת:** Verify the measurement before trusting the measurement (2026-07-23).

**נוסח הכלל:** Two probes lied in one
evening: (a) a "clean screen" wrapped runs in `/usr/bin/time`, which **does not exist in Windows git-bash**
— all five "runs" executed nothing, and the idle CPU was misread as "not CPU-bound"; (b) sampling
`chrome.exe` missed that Playwright's browser can run as `headless_shell.exe`. Gate: when a measurement
shows something surprising, first prove the probe ran the workload — non-trivial duration, processes
actually spawned, server actually responding — before reasoning from it.
