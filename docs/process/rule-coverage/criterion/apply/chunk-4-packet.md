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

### S58

**כותרת:** Two languages, one threshold: a limit measured in the convenient language is not a limit
(2026-08-04).

**נוסח הכלל:** Ollama applies its context window to an embedding batch *as a whole*. The obvious fix was a character
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

### S59

**כותרת:** Clipped chips; occupancy view opened on an empty instant

**נוסח הכלל:** Clipped chips; occupancy view opened on an empty instant — root cause: UI never looked at; 294 green tests proved nothing visual — gate: DoD 8, §10.2

### S60

**כותרת:** A number you invent for convenience becomes an argument, and then a design (2026-08-04).

**נוסח הכלל:** Embedding input was capped at 2,000 characters. I chose that; I never checked the model. `bge-m3`
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

### S61

**כותרת:** A gate that does not look at a language cannot fail on it — and it will print green while
that language is broken (2026-08-04).

**נוסח הכלל:** A commit landed with a failing `pytest`. `check-meta` ran, printed `META GATE OK`, and let it through.
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

### S62

**כותרת:** An environment fact measured with ONE tool, and handed to a fleet, is an assumption wearing
evidence's clothes (2026-08-02).

**נוסח הכלל:** The corpus-download arc. Phase 1 probed the network with `curl`, got `000`, and wrote into the source
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

### S63

**כותרת:** A green test is not evidence until you know which mechanism made it green (2026-08-02).

**נוסח הכלל:** Four tests were found passing while proving nothing, in a single day, each by a different mechanism:

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

### S64

**כותרת:** An installer that needs a password, run without a TTY, fails silently — and I have now
walked into it three times (2026-08-05).

**נוסח הכלל:** Three separate installs on this machine looked like nothing happened at all:

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

### S65

**כותרת:** A subagent reported "no key in env" and stopped measuring — the key was there all along (2026-08-01).

**נוסח הכלל:** `GEMINI_API_KEY` lives in the Windows **USER** environment scope, which a spawned process does **not**
inherit into `process.env`. Agents concluded it was absent, skipped every live probe, and the controller
ended up running those measurements by hand — which is backwards: investigation and measurement belong to
subagents, the decision belongs to the controller (owner instruction, 2026-08-01). **How any agent reads
it, in PowerShell:**
`$env:GEMINI_API_KEY=[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User'); node <script>`
Bash/git-bash does **not** see it. The service-account file for Cloud TTS is at `C:\Downloads\` and is
read by path, never opened or echoed. **The rule stands unchanged: never print, log, echo, or commit a
key** — read it into the process and use it, nothing more. A probe that cannot get a key must say so with
this line quoted, so the next agent does not repeat the dead end.

### S66

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

### S67

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

### S68

**כותרת:** A test that builds its own fixture can only prove the code's assumption, never the wire (2026-08-01).

**נוסח הכלל:** Google separates SSE frames with `



`. Every parser we wrote split on `

`, so no frame was ever
parsed and the entire streaming architecture — audio (R-39/v281) and text (Tasks 2/4) alike — was inert in
production for days. It was worse than absent: each call spent ~1.8s failing with `no-audio` and then paid
again for the blocking path, so a 28-character line took ~4.5s instead of ~1.1s. **Every test passed the
whole time**, because the tests fed `

` fixtures of their own making. Gate: when a parser consumes an
external wire format, at least one test must use **bytes captured from the real endpoint**, not a fixture
written from the same assumption the parser holds. This is `verify-against-the-runtime-path` applied to
data rather than to code paths.

### S69

**כותרת:** W5 flakiness: three fixes, all guesses

**נוסח הכלל:** W5 flakiness: three fixes, all guesses — root cause: No root-cause phase, no instrumentation, no 3-fix stop — gate: §5, DoD 11

### S70

**כותרת:** "Target page, context or browser has been closed" almost always means timeout, not a crash
(2026-08-01).

**נוסח הכלל:** When a test times out with a `waitForFunction` pending, teardown closes the page and the
pending wait reports the closure — the symptom, not the cause. Two separate investigations lost hours
hunting a browser crash that never happened. Gate: read it as "the condition never became true", and use
the one-minute discriminator — **run the test alone**. Load contention vanishes in isolation; a real defect
does not. That single step separated a flake from a genuine product regression in under a minute the same
day.

### S71

**כותרת:** Three plausible explanations died before the single-point cause was found (2026-08-01).

**נוסח הכלל:** For the
same slow-voice symptom I successively believed the digit gate was freezing early speech, then that the
thinking floor was the bottleneck, then that a second network call was a fallback. All three were
reasonable, all three were wrong, and all three were noise around one character-class bug (L35). This is
L14/Occam restated with a fresh scar: when a hypothesis needs several independent things to be true at
once, look harder for the single point. Also: the owner's domain correction — that most voice use is
read-aloud, not Q&A — is what exposed it, because the read-aloud path has no thinking latency to hide
behind. **A user's correction about how their product is actually used is evidence, not context.**

### S72

**כותרת:** "Always take the newest" is a version policy, not a tagging policy — and the newest
changes contracts (2026-08-05).

**נוסח הכלל:** The owner asked, across the board, to always install the newest. Taken literally that means the
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

### S73

**כותרת:** A field that encodes three states will be read three ways — and the paths never contradict
each other loudly enough to notice (2026-08-03).

**נוסח הכלל:** `safe` carries a cited safety floor, `0` meaning "not applicable" (every ירקות/פירות row), and absence
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

### S74

**כותרת:** A green test guarded a false screenshot (2026-08-01).

**נוסח הכלל:** The DoD-8 spec asserted on `vcLastQA` — JS
state — so it passed while its committed screenshot captured the onboarding panel instead of the transcript
it existed to prove, because `maybeAskUiLevel()` replaces any open panel 400ms after boot and that spec
(unlike 125 of 134 others) never seeded `mk-uilevel-asked`. A subagent reported the screenshot "looked at
and correct"; it had been looked at, but it was the wrong screen. Gate: visual evidence is only evidence if
the assertion that accompanies it reads the **rendered output**, not internal state — the same lesson v267
taught about measuring translation coverage at a proxy instead of at the DOM.

### S75

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

### S76

**כותרת:** Three tasks green, the feature dead — a test that injects the seam reproduces the blind spot
(2026-08-01).

**נוסח הכלל:** A safety-guard arc built one layer per task: a classifier, a decision table, and a wider
vocabulary so the table could rule on numbers the narrow vocabulary cannot see. Every task passed its own
tests. The feature did not work at all: the function converting classifier output into the table's input
filtered every claim through the **narrow** vocabulary, so the very claims the wide vocabulary existed for
were discarded one layer upstream and never reached it.

Why it survived three careful tasks: **each task's tests handed the next layer its input directly.** The
decision table was tested by constructing a claim map and passing it in — which is exactly the step that
was broken. A test that injects the seam cannot fail on the seam.

Gate: for any feature spanning more than one layer, **at least one test must enter where the user enters**
and assert on what the user gets out. Injecting an intermediate structure is legitimate for covering
branches, never for proving the feature works. And when a subagent reports a gap as "pre-existing,
documented elsewhere", **verify it by running the chain** — this one was reported that way and moved past,
and it would have shipped a dead feature with a full green suite behind it.
