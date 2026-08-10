# ‏13 הכללים שהמסווגות חלוקות עליהם — להכרעת הבעלים

**אף אחד מהם לא הוחל.** לפי המפרט, כלל שהשתיים חלוקות עליו נצבר לכאן עם שתי הקריאות.

ההסכמה הכוללת על 95 הכללים היתה **86%** — מעל הסף שקבעת. אבל אי-ההסכמות **אינן מפוזרות**,
וזה הממצא: כמעט כולן הן כללים שנושאים **סעיף עם דפוס נקוב וסעיף שדורש שיפוט באותו משפט**.
שתי המסווגות קוראות את הנוהל נכון. הן נחלקות על שאלה שהנוהל לא עונה עליה:

> **האם מסווגים כלל לפי הסעיף האכיף ביותר שבו, או לפי היקפו כולו?**

אלפא ענתה בעקביות "לפי הסעיף האכיף"; בטא בעקביות "לפי ההיקף". זו שאלה אחת, לא עשרה
תת-סעיפים — ולכן היא מגיעה אליך כהכרעה, ולא כתיקון שאעשה לבד.

---

## `3` — היום `none`

> The DoD gate (the core of this proposal)

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `A` | Compound container — the adequacy of each item's evidence is judged by the individual sub-rules, but this rule's own operative demand is structural: every box checked with evidence pasted in before done, which is a completeness-of-artifact check. |
| בטא | `C` | Compound umbrella rule: the presence of 12 evidence sections in a report is checkable, but the operative requirement is that each box is satisfied WITH valid evidence — behavioural assertion, fixture minimality, safety invariance and 'evidence actually proves it' (L45) all require judging what the p |

---

## `L2` — היום `none`

> `hooksOver` and `scale_res` shipped computed-but-unread; hanging feature inert

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `C` | deciding that a derived value has a real consumer that actually FIRES on real data requires understanding the render path's runtime meaning, not matching a reference textually — a dead reader still matches a grep |
| בטא | `A` | 'Computed but unread' is a structural fact — a symbol with no consuming reference — decidable by static reference count without judging meaning. |

---

## `L31` — היום `C`

> Agents left waiting on a background suite run burn real time for no signal (2026-07-31).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `A` | the rule forbids handing a subagent the suite wait outright; the suite command appearing in a dispatch prompt is a concrete textual pattern that decides without reading intent |
| בטא | `B` | The violation is dispatch-while-a-suite-run-is-pending-for-the-agent-to-wait-on; deciding it needs the prior fact of an active background suite run, which is observable in the run/dispatch state. |

---

## `L23` — היום `C`

> A proxy metric is not the screen: "99% translated" shipped half-English screens (v267, 2026-07-26).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `B` | the claim is only compliant if a specific prior measurement event exists; key-coverage counts in the artifact cannot decide it, but the prior rendered-DOM run is an observable fact |
| בטא | `C` | Recognizing that an utterance is a coverage/translation claim, and that its stated basis is a proxy (key coverage, grep) rather than a rendered-DOM measurement, requires evaluating the meaning of the claim and of its evidence. |

---

## `L28` — היום `C`

> 2026-07-30 · שחיקת כללי-כלים תחת קונטקסט ארוך — הבעלים תפס נטישה של serena/graphify לטובת grep ("אם אתה לא עושה — סימן שנמחקו לך הכללים").

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `A` | the rule mandates the TOOL itself (serena for code work); the choice of tool plus target file is a structural fact in the call payload that decides without reading intent — the grep-ordering clause is B-shaped but the core clause is pattern-decidable |
| בטא | `B` | A grep call by itself is not a violation; compliance depends on the sequence 'tried serena/graph first', which lives in prior observed tool events. |

---

## `L48` — היום `none`

> A gate that does not look at a language cannot fail on it — and it will print green while that language is broken (2026-08-04).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `A` | The rule's operative condition — the Python suite must run and block at commit — is decided by an exit code inside an already-named gate, no intent-reading needed. |
| בטא | `C` | The rule's check — 'for every language and artifact class in the repo, name the gate that would go red' — requires enumerating artifact classes and judging whether a named gate actually observes each one; that is a coverage-completeness judgement about meaning, not a pattern in any single artifact. |

---

## `L51` — היום `none`

> An installer that needs a password, run without a TTY, fails silently — and I have now walked into it three times (2026-08-05).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `C` | Compliance is 'before asking anyone to run a command, judge whether it needs elevation/a password and whether the channel can supply it' — whether an arbitrary installer needs elevation is a semantic property of the command and its package, not decidable by a nameable textual pattern across the thre |
| בטא | `A` | The presence of an elevation/password-requiring invocation in a channel with no TTY decides that the silent-failure trap applies, without reading intent. |

---

## `L43` — היום `none`

> Identical-looking code behaved differently — an invisible control byte (2026-08-01).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `A` | The failure the rule guards against — a control byte injected by a scripted edit — is decided by a byte-class scan of the written content, no intent needed. |
| בטא | `C` | Deciding whether the situation is 'identical-looking code behaving differently' and whether the agent then compared bytes rather than glyphs, and verified scripted edits by running rather than grepping, requires judging the debugging conduct — no artifact pattern decides compliance. |

---

## `L36` — היום `C`

> "Target page, context or browser has been closed" almost always means timeout, not a crash (2026-08-01).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `B` | The trigger is a concrete string in tool output, but compliance is a required NEXT step given that prior event, so the decision needs the observed sequence, not just the pattern. |
| בטא | `C` | Compliance means interpreting a specific error message correctly (timeout, not crash) and running the one-minute isolation discriminator before hunting a crash — evaluating the agent's diagnostic conduct and interpretation, which is judgement of meaning. |

---

## `L55` — היום `none`

> An exception that pip can silently undo is a coincidence, not a decision (2026-08-05).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `C` | Recognising that a pin is a deliberate exception, and judging whether its declaration, in-force test, still-needed test, and visible cost genuinely embody the ruling, requires reading the intent behind the dependency change — no textual pattern distinguishes a deliberate override from an ordinary pi |
| בטא | `A` | A deliberate dependency exception is mechanically visible as a resolver conflict; presence of the conflict without a matching overrides declaration decides non-compliance. |

---

## `L63` — היום `C`

> A citation that grants more than its source does — twice in two consecutive tasks (2026-08-06).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `A` | Once a quote is attributed to a file, verbatim presence is a mechanical substring check; the rule itself demands exact words, not faithful paraphrase. |
| בטא | `C` | Compliance means a justification quoting another file uses that file's words verbatim and was checked against it — identifying which prose is a citation, what its claimed source is, and whether an added clause changes the source's meaning requires evaluating meaning and intent. |

---

## `L72` — היום `none`

> מצב משותף בין שחקנים מקבילים חוסם את מי שלא חטא (8.8.26).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `C` | Deciding whether enforcement state is scoped to the right axis per counter (per-actor for §5, per-session for §10.16) and whether legacy rows were handled as a decision requires understanding the state store's keying semantics and each counter's meaning. |
| בטא | `none` | High for the enforcement infrastructure it fixed (cross-agent blocking observed live twice), but as a classified rule it is documentation of a decision — there is no ongoing compliance condition to check. |

---

## `L64` — היום `C`

> "The geniza has it" is not "git has it" — and I read one as the other (2026-08-06).

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `C` | Recognising that a claim asserts 'this landed in git' and that its supporting evidence is a disk-fed projection rather than `git show HEAD` requires reading what the claim means and what its evidence actually attests — the check is mechanical only after that semantic identification. |
| בטא | `B` | The rule forbids answering 'did this land' from a disk-built projection; compliance depends on which evidence-gathering events preceded the claim, which the recorded tool history observes. |

---

## `L76` — היום ללא קבוצה (נוסף 9.8.26, מנה 5)

**זו אינה הצורה המורכבת.** שתי המסווגות שואלות שאלה אחרת לגמרי: האם **חיפוש-צולב בין קובץ לקובץ** הוא "דפוס בארטיפקט" (ש1 ⟵ A) או "עובדה קודמת שצריך לדעת" (ש2 ⟵ B)? הקריטריון לא אומר.

| קריאה | קבוצה | הנימוק |
|---|---|---|
| אלפא | `B` | The diff to a spec file alone cannot decide compliance; the deciding fact is a prior event (owner approval) observed in the register, so the edit gate must consult recorded prior state. |
| בטא | `A` | The rule reduces to a lookup: an approved-in-register spec licenses editing itself, an unlisted/new spec does not — presence or absence of a register entry is decisive without reading intent. |

---

## `L83` — היום ללא קבוצה (נוסף 10.8.26, סוף שלב 2 של קשת 2)

**זו אינה מחלוקת בין שתי מסווגות — זו החלטה שאין לי סמכות לקבל.** הכלל אומר שהוראה
תפעולית לסוכן חייבת לכלול את המנגנון שמאפשר לקיים אותה. הסיווג המתבקש הוא `none`
(הנחיה על אופן כתיבת תדריכים, לא דפוס בארטיפקט ולא מצב קודם), **והכלל שלנו אוסר על
הורדה ל-`none` שנשענת על הסכמת-מסווגות — היא דורשת אישור בעלים בתאריך.** לכן הוא כאן.

| קריאה | קבוצה | הנימוק |
|---|---|---|
| ההצעה | `none` | ההוראה נכתבת בתדריך שאני מחבר; אין ארטיפקט קבוע שאפשר לסרוק כדי לדעת אם המנגנון נמסר. |
| החלופה | `A` · `pretooluse:Agent` | תדריך שמורה להריץ פקודה ארוכה **ואינו נוקב ב-`timeout`** הוא דפוס גלוי בטקסט ההזנקה, ונקודת האכיפה `pretooluse:Agent` כבר קיימת בדירוג (מקום 6). |

**המלצתי:** החלופה (`A`) — היא צרה, ניתנת למדידה, ותופסת בדיוק את הכשל שקרה שלוש פעמים.
**אבל אני מעלה אותה ולא מחליט אותה**, כי הכיוון הנוח לי כאן הוא גם הכיוון שמשחרר את
השער שחוסם אותי, וזה בדיוק המצב שבו החלטה עצמית אינה ראויה לאמון.
