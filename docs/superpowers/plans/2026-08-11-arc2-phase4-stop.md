# Arc 2 Phase 4 — `stop` Enforcement (8 rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 8 `stop` rules of the approved Arc-2 spec — `10.6` `DoD-3` `H9` `L12` `L14` `L23a` `L63a` `L64a` — with zero false alarms on legitimate work across the real 9,093-final-message corpus.

**Architecture:** A `stop` rule reads **the assistant's prose to the owner** — unbounded, bilingual, and (because this arc's subject IS rules) full of sentences that *quote* the very claims the rules police. Five gates in this programme have already fired on text that DESCRIBES a pattern rather than code that runs it (R-133 is the registered stop-point instance). The Bash phase solved its version of this with `stripDataRegions`; this phase builds the prose analogue **once**: `maskQuotedProse()` in `scripts/hooks/lib/claim-scan.mjs` — offset-preserving masking of fenced code, inline code, blockquotes, and quotation-mark spans — and every claim-shaped detector in the phase (including the two shipped ones being extended) runs on masked text, while **evidence** detection stays on raw text (pasted output lives inside fences on purpose). Every rule is narrowed to the shape its lesson names, not the vocabulary around it: the measurement proved a naive DoD-3 blocks 24% of ordinary replies. Three of the eight rules land as `RULE_IDS` extensions of existing detectors (R-116: one detector per shape), not as new files.

**Tech Stack:** Node ESM hooks (`scripts/hooks/stop-rules/`), pytest driving rule modules and the real `stop.mjs` CLI as subprocesses (Phase-2/3 pattern), Python corpus reader (`scripts/tests/measure-stop-corpus.py`, extended — never duplicated).

## Global Constraints

Copied from the approved spec `docs/superpowers/specs/2026-08-09-arc2-enforcement-implementation-design.md` and the controller's Phase-4 directive (2026-08-10). §4 (CLAUDE.md) forbids waiving any of these.

- **Spec §3.1:** every rule ships a catch test AND a false-alarm test; the false-alarm test replays **the REAL 9,093-message corpus**, never invented input. "כלל בלי בדיקת התרעת-שווא אינו נחשב ממומש."
- **Spec §5.3, coordinator-confirmed reading (Phase 3 precedent):** **0 false alarms = zero fires on LEGITIMATE work.** A fire on a genuine past violation is the rule working. Every task's report samples and classifies every fire; per spec §6, **one fire on legitimate work stops the phase** and is investigated before the next task.
- **Spec §3.2 / §10.24:** severity per rule, argued in a code comment — warn if the harm is to efficiency, block if to substance or to an action with no equivalent alternative. Every block names a reachable alternative. **Never a bypass.** Phase-4 addendum: a `stop` block stops the assistant from answering the owner — the most disruptive severity in the system. **Owner ruling (2026-08-10): every NEW stop rule in this phase ships as `warn`**, including the three whose lessons say "blocked at stop" (L23a, L64a, L63a) — the cost of a wrong stop-block is higher than the cost of a missed warning. Promotion to block is a registered, trigger-anchored follow-up (see "Warn-first and the promotion trigger" below), not a silent default.
- **L73 is live and it blocked the coordinator twenty minutes after shipping (2026-08-10):** a content edit and a `git commit` in the same Bash call is blocked. **Every task in this plan: write any progress-ledger/plan-checkbox line in ONE Bash call, verify from disk, and run the `git add`/`git commit` in a SEPARATE Bash call.** Stated once here; it governs every commit step below.
- **Spec §3.3:** every rule file exports `RULE_IDS`. (Stop rules do NOT export `TOOLS` — `tests/test_hook_tool_scope.py` scopes PreToolUse rules; the three shipped stop-rules confirm the convention.)
- **Spec §3.4:** one liveness test for the phase runs the real `node scripts/hooks/stop.mjs` CLI with **NO environment overrides at all** — this exact phase-family once shipped a stop rule inert behind `STOP_RULES_DIR` while 333 tests passed.
- **Spec §3.5:** overhead measured and reported. **The 61ms Phase-4 baseline and ~78ms PreToolUse worst are per-tool-call numbers; the stop hook fires once per TURN, so its budget is materially looser** — measured and reported honestly, with only a pathology ceiling asserted, not the PreToolUse number imported.
- **Spec §5.6:** `npx playwright test` (plain, no flags) and `pytest` clean at phase end. Suite runs serialized, never concurrent, no heavy background agents (§11a).
- **DoD (CLAUDE.md §3):** RED witnessed before GREEN for every test; outputs pasted into task reports.
- **R-116:** reuse `scripts/tests/measure-stop-corpus.py` as the ONLY corpus reader (a `--dump` mode is added; no second reader). One prose-masking helper with options — never a sibling helper (today's live defect: a helper applied to one rule and not its sibling).
- **Stated risk (controller directive):** `live-url-verified.mjs` (10.10) measured ~75% false alarms earlier and was deferred, not fixed. L14 shares its evidence channel; Task 6 measures that channel's noise on the corpus BEFORE and AFTER the repair and does not ship until the detector's fires classify clean.
- **Banned (each shipped a defect):** `[^)]*`-style classes that cannot cross a delimiter they must cross; helpers assumed rather than read; "similar to Task N"; placeholders/TBD. Every load-bearing regex is shown matching its own fixture in a numbered step.
- Work on `main`, no worktrees (§9).

## Interfaces verified against source (read during planning, 2026-08-10)

- `scripts/hooks/stop.mjs`: `DEFAULT_STOP_RULES_DIR` = `scripts/hooks/stop-rules/` unconditionally; `STOP_RULES_DIR` is a test-only override ON TOP of it (FIX ROUND 1 landed — the directory is live in production). Loop guard on `stop_hook_active` precedes the pipeline. `toStopOutput`: `block → {decision:'block',reason}`, `warn → {systemMessage}`, `allow → {}`.
- `.claude/settings.json` already wires `Stop → node scripts/hooks/stop.mjs` — **no settings change anywhere in this phase.**
- `scripts/hooks/lib/claim-scan.mjs` exports: `lastAssistantText(transcriptPath) -> {determined, text}`; `BROAD_CLAIM_RE`; `RESTRICTED_CLAIM_PATTERNS`; `detectsSuccessClaim(text)`; `extractClaimSnippet(text)`; `LIVE_CLAIM_RE`; `detectsLiveClaim(text)`; `containsQuotedEvidence(text)` (fence / `exit(?: code)?…0` / `\d+…passed` / `PASS`); `EVIDENCE_WINDOW_MS`; `recentEvidencePresent(transcriptPath, sinceMs, nowMs)`. `findClaimMatch` is private, sentence-scoped (splits on `.`/`!`/`\n`), question- and subordinator-guarded.
- `scripts/hooks/lib/skill-invoked.mjs`: `skillInvokedSince(transcriptPath, skillNameRe, sinceMs, nowMs, agentId) -> {determined, invoked}`; a **readable** transcript with no matching invocation resolves `determined:true, invoked:false` — so a corpus-replay transcript (one message, no skill entries) reaches the block branch, not the degraded branch.
- `scripts/hooks/lib/enforcement-state.mjs`: `openState(path = statePath())` (env `ENFORCEMENT_STATE_PATH`, read at call time); `recordEvent(db, {sessionId, kind, detail, actorId})` (detail JSON-stringified); `lastEvent(db, sessionId, kind, actorId?) -> {ts, detail}|null`; `recentEvents(db, sessionId, kind, sinceTs, actorId?) -> [{ts, detail, actorId}]` — **`detail` is the raw JSON STRING, consumers must `JSON.parse` it**; 24h TTL prune on open.
- Event kinds already recorded by observers (PostToolUse): `file_read` (`read-tracker.mjs`, `detail:{filePath}` absolute, only on `_outcome.ok===true`), `edit` (`noteEdit` via `edit-tracker.mjs`, every successful Edit/Write, `detail:{filePath}`), `ui_edit`, `playwright_run`, `live_probe` (`session-events.mjs`), `commit`, `bash_failure`, `verification_pass/failure`. **No new observer is needed in this phase.**
- `scripts/hooks/rules/stale-dev-server.mjs` (RULE_IDS `['11a']`, PreToolUse/browser_navigate, warn): private `findListeningPid(port)` (netstat) and `processStartTimeMs(pid)` (PowerShell Get-Process); staleness = `dist/index.html` mtime > server-process start time; test seams `MK_TEST_PORT`, `PRETOOLUSE_DIST_DIR`. Task 8 extracts these into a lib (behavior identical).
- `scripts/tests/replay-bash-corpus.mjs` — the Phase-3 replay shape this phase mirrors for prose.
- `docs/process/rule-coverage-baseline.json` — `{"covered": [...], "updated": ...}`; Task 9 appends the 8 ids.
- Existing stop-rule tests: `scripts/tests/test-hooks-groupb.mjs` (must pass unchanged or with the R-133 case added), runner `scripts/tests/run-all.mjs`.

## The two decisions the controller directive demanded be made explicitly

**DoD-3 is covered by EXTENDING rule `1`'s file, not by a new detector.** `verify-before-success-claim.mjs` already enforces exactly DoD-3's substance: a success claim with no pasted evidence (its evidence definition — fenced block, exit-code-0, passed-count, PASS token — IS DoD-3's "output pasted, exit code shown" currency) and no recent `verification-before-completion` invocation. The measurement confirms there is no separable DoD-3 shape left over: the naive reading blocks 24% and the narrowed reading is the shipped rule. Task 2 adds `'DoD-3'` to that file's `RULE_IDS` with this argument in the header comment. Growing a second detector for the same claim shape is R-116, which cost real time today.

**L14 is covered by EXTENDING `live-url-verified.mjs` (10.10), not by a new rule.** L14's own text derives §10.10 from the v255 incident ("a push is not a release"); its registered mechanism target is "responses claiming a version is live / released" — precisely `detectsLiveClaim` + the `live_probe` freshness check that file already performs. Task 6 adds `'L14'` to its `RULE_IDS` **and repairs the shared evidence channel** (the measured ~75% detector noise) rather than inheriting it: masking (Task 1) removes quoted-§10.10 fires, and the `LIVE_CLAIM_RE` narrowing removes the bare-`באוויר` fires (the standing-rule phrase "אין פריט באוויר" contains it). L14's second clause ("check the simplest external explanation before theorising") is judgment-shaped and has no mechanical trigger; the registered enforceable half is clause (a), which this rule IS — stated in the header comment, not silently dropped.

## File structure

- Modify `scripts/hooks/lib/claim-scan.mjs` — add `maskQuotedProse()`; retrofit `findClaimMatch`/`detectsLiveClaim` onto it; narrow `LIVE_CLAIM_RE` + add sentence-level negation guard (Tasks 1, 6).
- Modify `scripts/tests/measure-stop-corpus.py` — add `--dump` mode (Task 1).
- Create `scripts/tests/replay-stop-corpus.mjs` — single-process corpus replay of one stop-rule module (Task 1).
- Modify `scripts/hooks/stop-rules/verify-before-success-claim.mjs` — `RULE_IDS ['1','DoD-3']` (Task 2).
- Create `scripts/hooks/stop-rules/task-close-summary-shape.mjs` — `['10.6','H9']`, warn (Task 3).
- Create `scripts/hooks/stop-rules/percentage-artifact.mjs` — `['L23a']`, warn (owner ruling; Task 4).
- Create `scripts/hooks/stop-rules/landed-claim-git.mjs` — `['L64a']`, warn (owner ruling; Task 5).
- Modify `scripts/hooks/stop-rules/live-url-verified.mjs` — `RULE_IDS ['10.10','L14']` (Task 6).
- Create `scripts/hooks/stop-rules/cited-path-read.mjs` — `['L63a']`, warn with unwired-channel guard (owner ruling; Task 7).
- Create `scripts/hooks/lib/stale-server.mjs` + modify `scripts/hooks/rules/stale-dev-server.mjs` to consume it; create `scripts/hooks/stop-rules/ui-check-stale-build.mjs` — `['L12']`, warn (Task 8).
- Create `tests/test_arc2_phase4_rules.py` (Tasks 1–8), `tests/test_arc2_phase4_wiring.py` (Task 9).
- Modify `docs/process/rule-coverage-baseline.json` (Task 9).

## Severity decisions (argued in full in each rule's header comment)

**Owner ruling (2026-08-10): every NEW stop rule in this phase ships as `warn`.** The plan's original recommendation was block for L23a/L64a/L63a on substance grounds; the owner ruled the other way, for the reason the directive named: a stop-block prevents the assistant from answering the owner at all, and the cost of a wrong block there exceeds the cost of a missed warning. The two BLOCKs below are the two SHIPPED rules whose severity was argued and landed in an earlier phase — this plan does not touch their severity.

| Rule | Severity | Why | Reachable path named in the reason |
|---|---|---|---|
| DoD-3 | block (inherits rule 1's shipped, previously-argued block — unchanged by this plan) | an unbacked GREEN claim is manufactured substance — the exact defect §6.4 trigger 3 shipped to stop | paste the run output, or invoke `superpowers:verification-before-completion` |
| 10.6+H9 | warn | a missing summary shape harms owner visibility/efficiency, fabricates nothing; H10a itself says the table is *shown* only at milestones | add the three parts or the 5-row table to the close |
| L23a | **warn** (owner ruling; the lesson's own text says "is blocked at stop" — quoted in the rule header with the ruling recorded) | the harm the lesson names is substantive (v267), but a wrong stop-block silences the assistant entirely; warn first, measure, promote only if precise | name the per-language screenshot / measure-run output file next to the number, or drop the percentage |
| L64a | **warn** (owner ruling; same recording) | same trade: the 2026-08-06 false-landing harm is real, the wrong-block cost is higher | commit the file (or verify `git show HEAD:<path>` + clean `git status`) and then say it |
| L14 | block (inherits 10.10's shipped, previously-argued block — unchanged by this plan) | the owner acts on "it is live"; v255 is the paid incident | `node scripts/live-smoke.mjs` (or browser_navigate the live URL and read `.foot-stamp`) |
| L63a | **warn** (owner ruling), still guarded by degrade-to-allow when the read channel has zero rows (L57) | fabricated provenance is real harm, but this rule's evidence channel is the youngest in the store — precisely the rule most likely to warn wrongly at first | Read the file now and cite what it actually says, or drop the citation |
| L12 | warn | same class as the shipped 11a warn: a stale-build UI check costs a wasted look, not a capability | restart `serve.js` after the build and look again |

### Warn-first and the promotion trigger (H8 — trigger-anchored, so it is not lost)

L23a, L64a and L63a ship at `warn` **against their lessons' own "blocked at stop" wording, by explicit owner choice, warn-first**. The promotion path is registered here as the H8 anchor: **after one week of real use** (trigger: the first arc-close following 2026-08-17), pull the hook log (`PRETOOLUSE_LOG_PATH` decisions for the stop pipeline), classify every fire of these three rules as precise/imprecise, and bring the per-rule table to the owner — **only a rule with zero imprecise fires is proposed for promotion to block**, one rule at a time. Task 9 Step 8 writes this item into `docs/STATUS-BOARD.md`'s gap ledger so arc-close's check-meta sees it.

---

### Task 1: `maskQuotedProse` + retrofit, corpus `--dump`, and the stop replay harness

The phase's shared foundation: the prose analogue of `stripDataRegions`, built once; the corpus dump (reusing the one reader, R-116); the replay harness; and a measured baseline of the three SHIPPED stop rules — including quantifying 10.10's noise, which Task 6 must beat.

**Files:**
- Modify: `scripts/hooks/lib/claim-scan.mjs`
- Modify: `scripts/tests/measure-stop-corpus.py`
- Create: `scripts/tests/replay-stop-corpus.mjs`
- Create: `tests/test_arc2_phase4_rules.py` (helpers + lib tests)

**Interfaces:**
- Consumes: existing `claim-scan.mjs` internals (`findClaimMatch`, `splitSentences` — private, edited in place); `measure-stop-corpus.py`'s existing `final_messages()` generator.
- Produces (every later task relies on these exact names):
  - `maskQuotedProse(text, {keepInlineCode?=false}) -> string` — SAME LENGTH as input (masked regions become spaces), so match offsets computed on masked text remain valid in the original. Masks: fenced code blocks (including an unterminated trailing fence), inline `` `code` `` spans (unless `keepInlineCode`), markdown blockquote lines, ASCII/curly/guillemet quotation spans (single-line, bounded length).
  - `findClaimMatch` (private) and `detectsLiveClaim` now evaluate MASKED text; `containsQuotedEvidence`/`recentEvidencePresent` still evaluate RAW text (evidence lives inside fences on purpose — masking must never hide it).
  - `measure-stop-corpus.py --dump <path>` — writes the 9,093 final messages as JSONL `{"text": ...}`, one per line, then exits 0.
  - `node scripts/tests/replay-stop-corpus.mjs <rule-file.mjs> <messages.jsonl> [--state <sqlite>] [--session <id>]` — stdout `{"total":N,"fireCount":N,"fires":[{excerpt,decision,reason}… up to 200]}`. Default state path is a fresh empty temp store (state rules exercise their no-evidence path); `--state` points at a seeded store.

- [ ] **Step 1: Write the failing lib tests** — create `tests/test_arc2_phase4_rules.py`:

```python
# tests/test_arc2_phase4_rules.py — Arc 2 Phase 4: the 8 `stop` rules. Per-rule catch +
# false-alarm tests; false alarms replayed against the REAL 9,093-final-message corpus
# (scripts/tests/measure-stop-corpus.py --dump + replay-stop-corpus.mjs), never invented input.
import json
import os
import socket
import subprocess
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
STOP_RULES = ROOT / "scripts" / "hooks" / "stop-rules"
LIB = ROOT / "scripts" / "hooks" / "lib"
REPLAY = ROOT / "scripts" / "tests" / "replay-stop-corpus.mjs"
CORPUS = ROOT / ".superpowers" / "corpus" / "stop-final-messages.jsonl"


def node_eval(expr):
    """Evaluates one JS expression against claim-scan.mjs in a node process."""
    lib = (LIB / "claim-scan.mjs").as_posix()
    src = f"import * as C from 'file://{lib}'; console.log(JSON.stringify({expr}));"
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


def write_transcript(tmp_path, text, name="transcript.jsonl"):
    """One assistant final message, the shape a Stop hook reads (timestamp = now so the
    10-minute evidence window sees this turn as current)."""
    p = tmp_path / name
    entry = {"type": "assistant",
             "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
             "message": {"role": "assistant",
                          "content": [{"type": "text", "text": text}]}}
    p.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def eval_stop_rule(rule_file, text, tmp_path, state_path=None, session="s-phase4-test",
                   env_extra=None):
    """Runs ONE stop-rule module's evaluate() against a one-message transcript, via a tiny
    node driver (not the full CLI — per-rule tests must not trip sibling rules)."""
    transcript = write_transcript(tmp_path, text)
    rule = (STOP_RULES / rule_file).as_posix()
    src = (f"import {{ evaluate }} from 'file://{rule}';"
           f"const out = await evaluate({{ session_id: {json.dumps(session)},"
           f" hook_event_name: 'Stop', transcript_path: {json.dumps(transcript.as_posix())},"
           f" cwd: {json.dumps(str(ROOT))} }});"
           "console.log(JSON.stringify(out ?? {}));")
    env = {**os.environ, **(env_extra or {})}
    if state_path is not None:
        env["ENFORCEMENT_STATE_PATH"] = str(state_path)
    else:
        env["ENFORCEMENT_STATE_PATH"] = str(tmp_path / "empty-state.sqlite")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip())


def seed_event(state_path, session, kind, file_path):
    """Seeds one event through the REAL enforcement-state module (no hand-rolled SQL)."""
    lib = (LIB / "enforcement-state.mjs").as_posix()
    src = (f"import {{ openState, recordEvent }} from 'file://{lib}';"
           f"const db = openState({json.dumps(str(state_path))});"
           f"if (!db) throw new Error('openState failed');"
           f"recordEvent(db, {{ sessionId: {json.dumps(session)}, kind: {json.dumps(kind)},"
           f" detail: {{ filePath: {json.dumps(file_path)} }}, actorId: '' }});"
           "db.close();")
    r = subprocess.run(["node", "--input-type=module", "-e", src],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr


@pytest.fixture(scope="session")
def corpus_dump():
    """Regenerates the dump once per pytest run via the ONE corpus reader (R-116)."""
    CORPUS.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["python", str(ROOT / "scripts" / "tests" / "measure-stop-corpus.py"),
                        "--dump", str(CORPUS)],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr
    assert CORPUS.exists() and CORPUS.stat().st_size > 0
    return CORPUS


def replay(rule_file, corpus_path, state_path=None, session=None):
    args = ["node", str(REPLAY), str(STOP_RULES / rule_file), str(corpus_path)]
    if state_path is not None:
        args += ["--state", str(state_path)]
    if session is not None:
        args += ["--session", session]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


# ------------------------------------------------------- Task 1: maskQuotedProse + retrofit

def test_mask_preserves_length_and_blanks_fences():
    text = "before ```echo done``` after"
    out = node_eval(f"C.maskQuotedProse({json.dumps(text)})")
    assert len(out) == len(text)
    assert "done" not in out
    assert "before" in out and "after" in out


def test_mask_blanks_double_quoted_and_blockquote_but_keeps_prose():
    text = 'הבקר אמר: "הכל ירוק ובוצע" ואני עדיין בודק\n> once it works, say done\nשורה רגילה'
    out = node_eval(f"C.maskQuotedProse({json.dumps(text)})")
    assert "ירוק" not in out and "works" not in out
    assert "שורה רגילה" in out


def test_mask_keep_inline_code_option():
    text = "the file `docs/x.md` landed"
    kept = node_eval(f"C.maskQuotedProse({json.dumps(text)}, {{keepInlineCode: true}})")
    masked = node_eval(f"C.maskQuotedProse({json.dumps(text)})")
    assert "docs/x.md" in kept
    assert "docs/x.md" not in masked


def test_r133_class_quoted_claim_no_longer_detected():
    # R-133: verify-before-success-claim fired on a message containing NO claim — only a
    # quotation of an instruction given to a subagent. The masked detector must stay silent.
    text = 'שלחתי לסוכן את ההוראה: "run the suite until it works and reply that it is done".'
    assert node_eval(f"C.detectsSuccessClaim({json.dumps(text)})") is False


def test_unquoted_claim_still_detected():
    assert node_eval("C.detectsSuccessClaim('הבדיקות עברו והכל ירוק')") is True


def test_live_claim_masked_when_quoted():
    text = 'ה-CLAUDE.md אומר: "never tell the owner a version is live until Playwright verified".'
    assert node_eval(f"C.detectsLiveClaim({json.dumps(text)})") is False
```

- [ ] **Step 2: Run to verify RED — and capture the shipped-rules BEFORE baseline**

Run: `pytest tests/test_arc2_phase4_rules.py -v -k mask or r133 or live_claim_masked`
Expected: FAIL — `maskQuotedProse` is not exported (SyntaxError/undefined in node_eval), and `test_r133_class_quoted_claim_no_longer_detected` fails because the unmasked detector fires on the quoted text. Paste the output.

Also run `node scripts/tests/test-hooks-groupb.mjs` NOW, before touching claim-scan.mjs, and paste the passing output — this is the BEFORE half of the owner's condition on modifying shipped rules ("run the shipped rules' existing tests before and after and paste both"); Step 5 pastes the AFTER half.

- [ ] **Step 3: Implement `maskQuotedProse` and retrofit** — in `scripts/hooks/lib/claim-scan.mjs`, add above `BROAD_CLAIM_WORD`:

```js
// maskQuotedProse — Phase 4's prose analogue of bash-segments' stripDataRegions (R-133 and four
// sibling incidents: gates firing on text that DESCRIBES a pattern rather than code that runs
// it). Replaces quoted/fenced/blockquoted regions with SPACES OF THE SAME LENGTH, so any offset
// computed on the masked text is valid in the original — which is what lets findClaimMatch()
// keep returning original-text offsets for extractClaimSnippet() without a mapping table.
//
// APPLIES TO CLAIM DETECTION ONLY, NEVER TO EVIDENCE DETECTION: containsQuotedEvidence() reads
// the RAW text on purpose — pasted verification output lives INSIDE fences, and masking it would
// turn every honestly-evidenced reply into a block candidate. One helper, options (keepInlineCode
// for rules whose SIGNAL is a `path` cited in inline code — L63a/L64a) — never a sibling helper;
// a helper applied to one rule and not its sibling is the exact defect found on 2026-08-10.
//
// KNOWN, ACCEPTED FALSE-NEGATIVE: two Hebrew gershayim acronyms (צה"ל … חו"ל) on one line pair
// up as a "quote" and mask the text between them, hiding a claim that sits there. The phase's
// bar is zero FALSE ALARMS; a rare missed claim costs nothing (the DoD gate still exists), while
// a false block costs every reply that quotes anything.
export function maskQuotedProse(text, { keepInlineCode = false } = {}) {
  if (typeof text !== 'string' || !text) return '';
  let out = text;
  const blank = (re) => { out = out.replace(re, (m) => ' '.repeat(m.length)); };
  blank(/```[\s\S]*?(?:```|$)/g);        // fenced blocks, incl. an unterminated trailing fence
  if (!keepInlineCode) blank(/`[^`\n]+`/g); // inline code spans
  blank(/^[ \t]*>[^\n]*/gm);             // markdown blockquote lines
  blank(/"[^"\n]{2,400}"/g);             // ASCII double-quoted spans, single-line, bounded
  blank(/[“„][^“”„\n]{2,400}[”“]/g); // “…” „…“ curly quotes
  blank(/«[^»\n]{2,400}»/g); // «…» guillemets
  return out;
}
```

Then change `findClaimMatch`'s first lines to mask before sentence-splitting (offsets stay valid — same length):

```js
function findClaimMatch(text) {
  if (typeof text !== 'string' || !text) return null;
  // Phase 4 retrofit (R-133): claims are detected on MASKED text — quoted/fenced/blockquoted
  // prose is never claim-bearing. Same-length masking keeps every offset valid in the original,
  // so extractClaimSnippet() still slices the real text below.
  const masked = maskQuotedProse(text);
  for (const sentence of splitSentences(masked)) {
```

(the rest of `findClaimMatch` is untouched) and `detectsLiveClaim`:

```js
export function detectsLiveClaim(text) {
  if (typeof text !== 'string' || !text) return false;
  return LIVE_CLAIM_RE.test(maskQuotedProse(text));
}
```

- [ ] **Step 4: Show the mask matching its own fixture** (numbered, load-bearing):

Run: `node --input-type=module -e "import {maskQuotedProse} from './scripts/hooks/lib/claim-scan.mjs'; const t='quote: \"all green and done\" plus \`docs/a.md\` here'; console.log(JSON.stringify(maskQuotedProse(t))); console.log(JSON.stringify(maskQuotedProse(t,{keepInlineCode:true})));"`
Expected: first line blanks BOTH the quoted claim and the inline path; second line blanks the quote but preserves `` `docs/a.md` ``. Paste both lines.

- [ ] **Step 5: Run the Step-1 tests to verify GREEN** — `pytest tests/test_arc2_phase4_rules.py -v -k "mask or r133 or live_claim_masked or unquoted"` → all PASS. Then the AFTER half of the owner's before/after condition: `node scripts/tests/test-hooks-groupb.mjs` → must pass unchanged, output pasted next to Step 2's BEFORE run (the masked detector only ever REMOVES fires; if any existing test asserted a fire on quoted text, stop and report — that test encoded the R-133 bug).

- [ ] **Step 6: Add `--dump` to the corpus reader** — in `scripts/tests/measure-stop-corpus.py`, insert immediately after `msgs = list(final_messages())` and the empty-corpus guard:

```python
if "--dump" in sys.argv:
    out_path = pathlib.Path(sys.argv[sys.argv.index("--dump") + 1])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with io.open(out_path, "w", encoding="utf-8") as fh:
        for t in msgs:
            fh.write(json.dumps({"text": t}, ensure_ascii=False) + "\n")
    print(f"dumped {len(msgs)} messages to {out_path}")
    raise SystemExit(0)
```

Run: `python scripts/tests/measure-stop-corpus.py --dump .superpowers/corpus/stop-final-messages.jsonl`
Expected: `dumped 9093 messages to ...` (count may have grown with new sessions — paste the real number; it must be ≥ 9093).

- [ ] **Step 7: Create `scripts/tests/replay-stop-corpus.mjs`** (complete file):

```js
#!/usr/bin/env node
// scripts/tests/replay-stop-corpus.mjs — replays every REAL assistant final message from a
// --dump file through ONE stop-rule module's evaluate(), in one process. The prose sibling of
// replay-bash-corpus.mjs (Phase 3): the spec's §3.1 false-alarm bar, mechanized against the
// 9,093 messages this project actually sent, never invented fixtures.
//   node scripts/tests/replay-stop-corpus.mjs <rule.mjs> <messages.jsonl> [--state <sqlite>] [--session <id>]
// Each message is written as a one-entry transcript (timestamp=now, so evidence windows treat it
// as the current turn) and evaluate() is called with the REAL input shape a Stop event carries.
// Default state store is a fresh EMPTY temp sqlite — state-shaped rules exercise their
// no-evidence/degraded path, which is exactly the path a historical corpus can honestly test;
// --state points at a seeded store for targeted state tests.
// Output: one JSON blob; excerpts truncated to 300 chars, reasons to 200. Never redirect to a
// tracked path.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const [rulePath, dumpPath] = args;
if (!rulePath || !dumpPath) {
  console.error('usage: replay-stop-corpus.mjs <rule.mjs> <messages.jsonl> [--state <sqlite>] [--session <id>]');
  process.exit(2);
}
const stateIdx = args.indexOf('--state');
process.env.ENFORCEMENT_STATE_PATH = stateIdx !== -1
  ? args[stateIdx + 1]
  : join(mkdtempSync(join(tmpdir(), 'stop-replay-state-')), 'empty-state.sqlite');
const sessIdx = args.indexOf('--session');
const sessionId = sessIdx !== -1 ? args[sessIdx + 1] : 's-corpus-replay';

const mod = await import(pathToFileURL(rulePath).href);
if (typeof mod.evaluate !== 'function') {
  console.error(`${rulePath} exports no evaluate()`);
  process.exit(2);
}
const transcriptPath = join(mkdtempSync(join(tmpdir(), 'stop-replay-t-')), 'transcript.jsonl');
let total = 0;
let fireCount = 0;
const fires = [];
for (const line of readFileSync(dumpPath, 'utf8').split('\n').filter(Boolean)) {
  let text;
  try { text = JSON.parse(line).text; } catch { continue; }
  if (typeof text !== 'string' || !text) continue;
  total += 1;
  writeFileSync(transcriptPath, JSON.stringify({
    type: 'assistant',
    timestamp: new Date().toISOString(),
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  }) + '\n');
  const out = await mod.evaluate({
    session_id: sessionId,
    hook_event_name: 'Stop',
    transcript_path: transcriptPath,
    cwd: process.cwd(),
  });
  if (out && typeof out.decision === 'string' && out.decision !== 'allow') {
    fireCount += 1;
    if (fires.length < 200) {
      fires.push({
        excerpt: text.slice(0, 300),
        decision: out.decision,
        reason: String(out.reason ?? '').slice(0, 200),
      });
    }
  }
}
process.stdout.write(JSON.stringify({ total, fireCount, fires }));
```

- [ ] **Step 8: Baseline replay of the THREE SHIPPED rules — the numbers Tasks 2 and 6 are measured against.** Run and paste all three:

```
node scripts/tests/replay-stop-corpus.mjs scripts/hooks/stop-rules/verify-before-success-claim.mjs .superpowers/corpus/stop-final-messages.jsonl
node scripts/tests/replay-stop-corpus.mjs scripts/hooks/stop-rules/ui-playwright-before-done.mjs .superpowers/corpus/stop-final-messages.jsonl
node scripts/tests/replay-stop-corpus.mjs scripts/hooks/stop-rules/live-url-verified.mjs .superpowers/corpus/stop-final-messages.jsonl
```

Record `fireCount` for each. `ui-playwright-before-done` must be 0 (empty state → no `ui_edit` → allow). For `live-url-verified`, the fireCount IS the post-masking detector-noise number (empty state means every detected live claim fires): sample 20 fires, classify each as genuine-live-claim vs prose-about-liveness, and write the classification into the task report — Task 6's acceptance is defined against it.

- [ ] **Step 9: Commit**

```bash
git add scripts/hooks/lib/claim-scan.mjs scripts/tests/measure-stop-corpus.py scripts/tests/replay-stop-corpus.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 1): maskQuotedProse — the prose stripDataRegions — plus the stop-corpus replay harness"
```

---

### Task 2: DoD-3 — extend `verify-before-success-claim.mjs` (decision: covered, not duplicated)

**Files:**
- Modify: `scripts/hooks/stop-rules/verify-before-success-claim.mjs`
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: Task 1's masked `detectsSuccessClaim` (already live inside this rule via `findClaimMatch`); `replay()`/`eval_stop_rule()` helpers.
- Produces: `RULE_IDS = ['1', 'DoD-3']` — Task 9's coverage-baseline step counts on exactly this list.

- [ ] **Step 1: Write the failing tests**:

```python
# ------------------------------------------------------- Task 2: DoD-3 rides rule 1's detector

def test_dod3_declared_on_verify_before_success_claim():
    src = (STOP_RULES / "verify-before-success-claim.mjs").read_text(encoding="utf-8")
    assert "'DoD-3'" in src, "DoD-3 must be enforced by the EXISTING claim detector (R-116)"


def test_dod3_catch_green_claim_without_pasted_output(tmp_path):
    out = eval_stop_rule("verify-before-success-claim.mjs",
                         "הרצתי את הסוויטה והכל ירוק, המשימה בוצעה.", tmp_path)
    assert out["decision"] == "block"


def test_dod3_false_alarm_green_claim_with_pasted_output(tmp_path):
    text = ("הסוויטה ירוקה:\n```\n1197 passed (54s)\nexit code 0\n```")
    out = eval_stop_rule("verify-before-success-claim.mjs", text, tmp_path)
    assert out["decision"] == "allow"
```

- [ ] **Step 2: RED** — `pytest tests/test_arc2_phase4_rules.py -v -k dod3` → the `declared` test FAILS (`'DoD-3'` absent). The other two pass already (the detector is shipped) — that is expected and stated: the RED here witnesses the *coverage* delta, which is this task's entire code change. Paste output.

- [ ] **Step 3: Implement** — in `verify-before-success-claim.mjs`, change the export and extend the header comment:

```js
// DoD-3 ("GREEN. Full test command run fresh, output pasted, exit code shown") — ARC 2 PHASE 4
// DECISION, made explicitly per the controller directive: DoD-3 is enforced BY THIS FILE, not by
// a sibling. Rule 1 (§6.4 trigger 3) already blocks exactly DoD-3's failure shape — a success
// claim whose reply carries no pasted output — and this file's evidence definition (fenced
// block / exit-code-0 / passed-count / PASS) IS DoD-3's own currency ("output pasted, exit code
// shown"). The corpus measurement (docs/analysis/2026-08-10-phase4-stop-corpus-measurement.txt)
// proved the naive DoD-3 blocks 24% of ordinary replies; the narrowed claim-shape reading IS
// this rule. A second detector for the same shape is R-116 — a live instance of which cost real
// time on 2026-08-10.
export const RULE_IDS = ['1', 'DoD-3'];
```

- [ ] **Step 4: GREEN** — `pytest tests/test_arc2_phase4_rules.py -v -k dod3` → 3 PASS. Paste.

- [ ] **Step 5: Corpus replay (the false-alarm test on real history)** — add:

```python
def test_dod3_corpus_replay_fires_classified(corpus_dump):
    out = replay("verify-before-success-claim.mjs", corpus_dump)
    assert out["total"] >= 9000
    # The bar is zero fires on LEGITIMATE work. Fires on genuine past unbacked claims are the
    # rule working. The implementer pastes fireCount + the classification of a 20-fire sample
    # into the task report; any fire classified LEGITIMATE stops the phase (spec §6).
    assert out["fireCount"] <= 200, f"detector exploded: {out['fireCount']} fires"
```

Run it; compare `fireCount` against Task 1 Step 8's baseline for this rule (masking must have made it ≤ the baseline). Sample 20 fires from the JSON, classify each (genuine unbacked claim / legitimate), paste the table. **Any legitimate-work fire → STOP, investigate, narrow, re-run** before committing.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/stop-rules/verify-before-success-claim.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 2): DoD-3 rides the shipped claim detector — RULE_IDS extension, no second detector (R-116)"
```

---

### Task 3: `10.6` + `H9` — task-close summary shape (one rule, one payload position)

Both rules read the SAME payload position (the task-closing final message) and prescribe two forms of the same duty, so they share one file. **The narrowing that keeps this from being a muzzle:** the corpus shows only 2.8% of messages carry the three-part shape and 6.6% a table — meaning most final messages are not task closes and must never fire. The rule triggers ONLY on a message that itself *declares a task/phase closed*, and is satisfied by EITHER form (H10a: the table is maintained every task but *shown* at milestones — demanding the table on every close would enforce more than the rule says).

**This is a narrowing of DETECTION, not of the requirement (owner-approved reading, 2026-08-10 — and the distinction is L77):** §10.6/H9 still say every task ends with the three-part summary and the maintained 5-row table; the gate only claims to catch the case it can SEE — a message that announces a close without either shape. A close the detector cannot recognize is uncaught, not permitted, and the rule's header says so in its own words.

**Files:**
- Create: `scripts/hooks/stop-rules/task-close-summary-shape.mjs`
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: `lastAssistantText`, `maskQuotedProse` from `../lib/claim-scan.mjs`.
- Produces: `RULE_IDS = ['10.6','H9']`; exports `TASK_CLOSE_RES`, `PART_RES`, `H9_TABLE_RE` for the measurement step and tests.

- [ ] **Step 1: Write the failing tests**:

```python
# ------------------------------------------------------- Task 3: 10.6 + H9 summary shape

CLOSE_NO_SHAPE = "משימה 3 הושלמה. עברתי על הקבצים ותיקנתי את הבדיקות."
CLOSE_WITH_PARTS = (
    "משימה 3 הושלמה.\n**DONE** תוקנו הבדיקות (commit abc123).\n"
    "**NEXT** משימה 4.\n**LEFT UNTIL THE GRAND FINAL** 12 סגורים / 31.")
CLOSE_WITH_TABLE = (
    "משימה 3 הושלמה.\n| # | שורה | תוכן |\n|---|---|---|\n"
    "| 1 | מה היה | הבדיקות אדומות |\n| 2 | מה נעשה | תוקן |\n"
    "| 3 | מה נשאר | — |\n| 4 | איפה אנחנו | Phase 4, 3/9 |\n| 5 | הבא בתור | משימה 4 |")
ORDINARY_REPLY = "אני קורא עכשיו את claim-scan.mjs כדי להבין את החוזה של lastAssistantText."


def test_summary_shape_warns_on_bare_task_close(tmp_path):
    out = eval_stop_rule("task-close-summary-shape.mjs", CLOSE_NO_SHAPE, tmp_path)
    assert out["decision"] == "warn"
    assert "10.6" in out["reason"] and "H9" in out["reason"]


def test_summary_shape_silent_with_three_parts(tmp_path):
    assert eval_stop_rule("task-close-summary-shape.mjs", CLOSE_WITH_PARTS, tmp_path)["decision"] == "allow"


def test_summary_shape_silent_with_h9_table(tmp_path):
    assert eval_stop_rule("task-close-summary-shape.mjs", CLOSE_WITH_TABLE, tmp_path)["decision"] == "allow"


def test_summary_shape_silent_on_ordinary_reply(tmp_path):
    assert eval_stop_rule("task-close-summary-shape.mjs", ORDINARY_REPLY, tmp_path)["decision"] == "allow"


def test_summary_shape_silent_on_quoted_close(tmp_path):
    # The rule must not fire on prose QUOTING a task-close (this arc's dominant noise class).
    text = 'ה-plan אומר: "משימה 3 הושלמה" — אבל אני עדיין באמצע.'
    assert eval_stop_rule("task-close-summary-shape.mjs", text, tmp_path)["decision"] == "allow"
```

- [ ] **Step 2: RED** — `pytest tests/test_arc2_phase4_rules.py -v -k summary_shape` → FAIL: module not found. Paste.

- [ ] **Step 3: Implement** — create `scripts/hooks/stop-rules/task-close-summary-shape.mjs`:

```js
// scripts/hooks/stop-rules/task-close-summary-shape.mjs — Arc 2 Phase 4. §10.6 (the three-part
// summary: DONE / NEXT / LEFT UNTIL THE GRAND FINAL) + H9 (the fixed 5-row table), enforced
// together because they read the SAME payload position — the task-closing final message — and
// prescribe two forms of the same duty. Satisfied by EITHER form, deliberately: H10a (owner)
// says the table is MAINTAINED every task but SHOWN only at milestones, so demanding the table
// on every close would enforce more than the rule says.
//
// SEVERITY: WARN, argued per spec §3.2 — a missing summary shape harms the owner's visibility
// ("a long programme reads as an unbounded run of green ticks"), it fabricates nothing and
// removes no capability. A stop-BLOCK is the most disruptive severity in the system (it stops
// the assistant answering the owner) and is reserved in this phase for substantive harm.
//
// THE NARROWING THAT KEEPS THIS FROM BEING A MUZZLE (the measurement's own lesson — a naive
// DoD-3 would block 24% of replies): this rule triggers ONLY on a message that itself DECLARES
// a task/phase closed (TASK_CLOSE_RES below, evaluated on MASKED text so prose QUOTING a close
// never fires — R-133's class), and even then only when NEITHER accepted shape is present.
// THIS NARROWS DETECTION, NOT THE REQUIREMENT (L77): §10.6/H9 still bind every task close; this
// gate only claims to catch the closes it can SEE. An unrecognized close is uncaught, not
// permitted.
//
// FAIL-OPEN: unreadable transcript resolves to allow, same contract as every rule in this arc.
export const RULE_IDS = ['10.6', 'H9'];

import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';

// A message DECLARING a task/phase close. Bilingual; bounded lookahead within the line (no
// [^)]*-style class asked to cross a newline). Tuned against the real corpus in this task's
// own measurement step — the counts live in the task report.
export const TASK_CLOSE_RES = [
  /(?:Task|Phase|משימה|שלב|המשימה|השלב)\s*\d*[^\n.!?]{0,60}?(?:הושלמ|הסתיימ|נסגר|complete[d]?\b|closed\b|finished\b|done\b)/i,
  /\b(?:completed|finished|closing)\s+(?:task|phase)\b/i,
  /סיימתי\s+את\s+(?:המשימה|השלב|משימת)/,
];

// The three §10.6 parts (either language). ≥2 of 3 counts as the shape being present —
// generosity here only ever REMOVES fires.
export const PART_RES = [
  /\bDONE\b|מה נעשה/,
  /\bNEXT\b|הבא בתור/,
  /LEFT UNTIL|מה נשאר|עד הגמר/i,
];

// One H9 table row is enough to prove the table exists: row 1's own label between pipes.
export const H9_TABLE_RE = /\|[^\n|]*(?:מה היה|Before)[^\n|]*\|/;

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: '§10.6/H9 degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: '§10.6/H9 degraded: no readable assistant reply text — allowing.' };
  }

  const masked = maskQuotedProse(text);
  if (!TASK_CLOSE_RES.some((re) => re.test(masked))) {
    return { decision: 'allow', reason: 'the final reply does not declare a task/phase close — §10.6/H9 do not apply.' };
  }

  // Compliance is checked on the RAW text: the table/parts are literal content the owner reads,
  // and part headers legitimately appear inside bold markers etc.
  const partsPresent = PART_RES.filter((re) => re.test(text)).length;
  if (partsPresent >= 2 || H9_TABLE_RE.test(text)) {
    return { decision: 'allow', reason: 'the close carries the §10.6 three-part shape or the H9 table.' };
  }

  return {
    decision: 'warn',
    reason: '§10.6/H9: ההודעה סוגרת משימה בלי צורת הסיכום — הוסף את שלושת החלקים '
      + '(DONE · NEXT · LEFT UNTIL THE GRAND FINAL, עם מספר המרשם) או את טבלת 5 השורות של H9 '
      + '(מה היה · מה נעשה · מה נשאר · איפה אנחנו · הבא בתור), ועדכן את docs/STATUS-BOARD.md (H10).',
  };
}
```

- [ ] **Step 4: Show `TASK_CLOSE_RES` matching its own fixture**:

Run: `node --input-type=module -e "import {TASK_CLOSE_RES} from './scripts/hooks/stop-rules/task-close-summary-shape.mjs'; for (const t of ['משימה 3 הושלמה.', 'Task 7 is done', 'אני קורא עכשיו את הקובץ']) console.log(t, '->', TASK_CLOSE_RES.some(r=>r.test(t)));"`
Expected: `true`, `true`, `false`. Paste.

- [ ] **Step 5: GREEN** — `pytest tests/test_arc2_phase4_rules.py -v -k summary_shape` → 5 PASS. Paste.

- [ ] **Step 6: Corpus replay + measurement-driven tuning**:

```python
def test_summary_shape_corpus_replay(corpus_dump):
    out = replay("task-close-summary-shape.mjs", corpus_dump)
    # warn-severity: still zero fires on legitimate work. A fire on a REAL past task-close that
    # shipped without the shape is the rule working — classify every sampled fire.
    assert out["fireCount"] <= 150, f"trigger too loose: {out['fireCount']}"
```

Run; sample 20 fires; each must be a genuine shapeless task-close. Any fire on an ordinary (non-close) reply is a false alarm → tighten `TASK_CLOSE_RES` (e.g. drop `done\b` if it is the noise source), re-run, and record the loop in the report. **One legitimate-work fire left standing stops the phase (spec §6).**

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/stop-rules/task-close-summary-shape.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 3): 10.6+H9 — task-close summary shape, warn, corpus-tuned trigger"
```

---

### Task 4: `L23a` — a percentage claim without a named rendered-DOM artifact

Lesson (v267): "A coverage, translation or localization percentage may appear in a final report only alongside a NAMED rendered-DOM measurement artifact… A percentage with no named artifact is blocked at stop." The measurement: 367 messages (4%) carry *some* percentage with no artifact — so the rule keys on the DOMAIN the lesson names (translation/coverage/localization vocabulary adjacent to the number), not on bare `%`. **Ships as `warn` by owner ruling (2026-08-10), against the lesson's own "blocked at stop" wording — warn-first, measured, promotable per the trigger-anchored item above.**

**Files:**
- Create: `scripts/hooks/stop-rules/percentage-artifact.mjs`
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: `lastAssistantText`, `maskQuotedProse`.
- Produces: `RULE_IDS = ['L23a']`; exports `PCT_CLAIM_RE`, `ARTIFACT_RE`.

- [ ] **Step 1: Failing tests**:

```python
# ------------------------------------------------------- Task 4: L23a percentage↔artifact

def test_l23a_warns_on_translation_pct_without_artifact(tmp_path):
    out = eval_stop_rule("percentage-artifact.mjs",
                         "כיסוי התרגום בצרפתית עומד על 97% וזה שיפור יפה.", tmp_path)
    assert out["decision"] == "warn"
    assert "L23a" in out["reason"]


def test_l23a_allows_pct_with_named_artifact(tmp_path):
    text = ("כיסוי התרגום בצרפתית: 97% — נמדד ב-rendered DOM, הקובץ "
            "`mockups/fr-coverage-390x844.png` מצורף.")
    assert eval_stop_rule("percentage-artifact.mjs", text, tmp_path)["decision"] == "allow"


def test_l23a_silent_on_non_domain_percentage(tmp_path):
    # A percentage OUTSIDE the lesson's domain (CPU, progress, humidity) never fires.
    text = "המאוורר עומד על 40% והבשר בשעה השלישית."
    assert eval_stop_rule("percentage-artifact.mjs", text, tmp_path)["decision"] == "allow"


def test_l23a_silent_on_quoted_lesson_text(tmp_path):
    text = 'הלקח אומר: "a translation percentage like 99% with no artifact is blocked".'
    assert eval_stop_rule("percentage-artifact.mjs", text, tmp_path)["decision"] == "allow"
```

- [ ] **Step 2: RED** — `pytest -v -k l23a` → module not found. Paste.

- [ ] **Step 3: Implement** — create `scripts/hooks/stop-rules/percentage-artifact.mjs`:

```js
// scripts/hooks/stop-rules/percentage-artifact.mjs — Arc 2 Phase 4, L23a (v267, split 9.8.26):
// "A coverage, translation or localization percentage may appear in a final report only
// alongside a NAMED rendered-DOM measurement artifact — a per-language screenshot, or the
// output file of a rendered-DOM measure run. A percentage with no named artifact is blocked
// at stop."
//
// SEVERITY: WARN, by OWNER RULING (2026-08-10). The lesson's own text says "A percentage with
// no named artifact is blocked at stop", and the harm it records is substantive — v267 shipped
// "99% translated / ready to test" from a key-coverage proxy while real fr/de/es screens were
// ~half English, and the owner acted on it. The owner chose warn FIRST anyway: a wrong stop-
// block silences the assistant's answer entirely, which costs more than a missed warning. The
// promotion path is registered (plan §"Warn-first and the promotion trigger"): a week of
// measured real fires, zero imprecise → propose block. The reachable path (§10.24) still costs
// the honest case one clause: name the artifact you measured, or drop the number.
//
// THE NARROWING (measurement: 367 msgs carry a bare pct with no artifact — most are CPU/progress/
// cook-temp numbers, NOT this lesson's subject): the percentage must sit ADJACENT (same
// sentence-ish span, ≤80 chars) to the DOMAIN vocabulary the lesson names — translation/
// coverage/localization — evaluated on MASKED text so quoting the lesson never fires (R-133
// class). The ARTIFACT search runs on RAW text: artifact names are usually cited in `inline
// code`, and masking must never hide the very evidence that licenses the claim.
export const RULE_IDS = ['L23a'];

import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';

const DOMAIN = '(?:תרגום|מתורגמ|מתורגם|כיסוי|לוקליזצי|coverage|translat|localiz|i18n)';
const PCT = '\\d{1,3}(?:\\.\\d+)?\\s*(?:%|אחוז)';
export const PCT_CLAIM_RE = new RegExp(
  `${DOMAIN}[^\\n.!?]{0,80}?${PCT}|${PCT}[^\\n.!?]{0,80}?${DOMAIN}`, 'i');

// A named artifact: an image/measure-output file path, or screenshot vocabulary. RAW text.
export const ARTIFACT_RE = /[\w\-./\\]+\.(?:png|jpe?g|webp|txt|json|csv)\b|screenshot|צילום\s*מסך|צילום/i;

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: 'L23a degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: 'L23a degraded: no readable assistant reply text — allowing.' };
  }

  if (!PCT_CLAIM_RE.test(maskQuotedProse(text))) {
    return { decision: 'allow', reason: 'no translation/coverage/localization percentage in the final reply — L23a does not apply.' };
  }
  if (ARTIFACT_RE.test(text)) {
    return { decision: 'allow', reason: 'the percentage is accompanied by a named artifact — L23a satisfied.' };
  }
  return {
    decision: 'warn',
    reason: 'L23a (v267): אחוז תרגום/כיסוי מופיע בדוח בלי ארטיפקט מדידה בשמו. '
      + 'נקוב בקובץ המדידה מה-DOM המרונדר (צילום-מסך פר-שפה או קובץ הפלט של ריצת המדידה) '
      + 'לצד המספר — או הסר את האחוז. מדוד ב-DOM המרונדר, לא ב-proxy.',
  };
}
```

- [ ] **Step 4: Show `PCT_CLAIM_RE` matching its own fixture**:

Run: `node --input-type=module -e "import {PCT_CLAIM_RE} from './scripts/hooks/stop-rules/percentage-artifact.mjs'; for (const t of ['כיסוי התרגום עומד על 97%', '97% מהמחרוזות מתורגמות', 'המאוורר על 40%']) console.log(t, '->', PCT_CLAIM_RE.test(t));"`
Expected: `true`, `true`, `false`. Paste.

- [ ] **Step 5: GREEN** — `pytest -v -k l23a` → 4 PASS. Paste.

- [ ] **Step 6: Corpus replay**:

```python
def test_l23a_corpus_replay(corpus_dump):
    out = replay("percentage-artifact.mjs", corpus_dump)
    assert out["fireCount"] <= 60, f"domain narrowing failed: {out['fireCount']}"
```

Run; classify EVERY fire (≤60 expected — the v267-era genuine violations are the rule working). One legitimate-work fire → tighten (shrink the 80-char window, or require the message to also be report-shaped) and re-run. Paste the classification table.

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/stop-rules/percentage-artifact.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 4): L23a — domain-adjacent percentage requires a named rendered-DOM artifact"
```

---

### Task 5: `L64a` — a "landed/committed" claim over a named document, checked against git

Lesson (2026-08-06): "A claim that a named document landed or was committed is checked against git itself — `git show HEAD:<path>` plus a clean `git status --porcelain` for that path… Presence in the geniza, a search hit, or a quote in a commit message is never landing evidence." Corpus surface: 27 messages (0.3%) — the cheapest rule in the phase. **Ships as `warn` by owner ruling (2026-08-10), against the lesson's "is blocked" wording — warn-first, promotable per the trigger-anchored item above.**

**Files:**
- Create: `scripts/hooks/stop-rules/landed-claim-git.mjs`
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: `lastAssistantText`, `maskQuotedProse` (with `keepInlineCode: true` — landed paths are cited in inline code); `git` via `execFileSync`.
- Produces: `RULE_IDS = ['L64a']`; exports `LANDED_RE`.

- [ ] **Step 1: Failing tests**:

```python
# ------------------------------------------------------- Task 5: L64a landed↔git

def test_l64a_warns_on_landed_claim_over_path_git_never_saw(tmp_path):
    out = eval_stop_rule("landed-claim-git.mjs",
                         "המסמך docs/no-such-file-xyzzy-98765.md נחת ונמצא בגניזה.", tmp_path)
    assert out["decision"] == "warn"
    assert "L64a" in out["reason"]


def test_l64a_allows_landed_claim_over_committed_clean_path(tmp_path):
    # CLAUDE.md is committed and (in a clean checkout of that path) unchanged — a TRUE claim.
    # If local state has CLAUDE.md dirty, the test writes+commits its own probe file instead;
    # implementer: use `git status --porcelain -- CLAUDE.md` to choose, and document the choice.
    out = eval_stop_rule("landed-claim-git.mjs", "הקובץ CLAUDE.md נחת ב-main.", tmp_path)
    assert out["decision"] == "allow"


def test_l64a_silent_without_landed_verb(tmp_path):
    text = "עדכנתי את docs/STATUS-BOARD.md ואמשיך למשימה הבאה."
    assert eval_stop_rule("landed-claim-git.mjs", text, tmp_path)["decision"] == "allow"


def test_l64a_silent_on_quoted_landed_claim(tmp_path):
    text = 'הלקח L64a מצטט: "docs/x.md landed" — זו דוגמה, לא טענה.'
    assert eval_stop_rule("landed-claim-git.mjs", text, tmp_path)["decision"] == "allow"
```

- [ ] **Step 2: RED** — `pytest -v -k l64a` → module not found. Paste.

- [ ] **Step 3: Implement** — create `scripts/hooks/stop-rules/landed-claim-git.mjs`:

```js
// scripts/hooks/stop-rules/landed-claim-git.mjs — Arc 2 Phase 4, L64a (2026-08-06, split
// 9.8.26): a claim that a NAMED document landed/was committed is checked against git itself —
// `git cat-file -e HEAD:<path>` (the mechanized `git show HEAD:<path>`) plus a clean
// `git status --porcelain -- <path>`. Presence in the geniza, a search hit, or a quote in a
// commit message is never landing evidence: the geniza ingests from DISK.
//
// SEVERITY: WARN, by OWNER RULING (2026-08-10). The lesson's own text says a "landed" claim git
// does not confirm "is blocked", and the 2026-08-06 incident was substantive — a landed claim
// the owner had no reason to doubt, over a document git had never seen. The owner chose warn
// FIRST anyway: a wrong stop-block silences the assistant's answer entirely. Promotion path
// registered (plan §"Warn-first and the promotion trigger"). Reachable path (§10.24): commit
// the file, or verify against git and restate what git actually confirms.
//
// MASKING PROFILE: keepInlineCode:true — a landed path is usually cited as `docs/x.md`, and the
// default mask would hide the rule's own signal. Fences/blockquotes/quotation spans still
// masked: a landed-claim inside pasted output or quoted lesson text is not this assistant's
// claim (R-133 class — the 4th test above is the acceptance case).
//
// COST: git runs ONLY after LANDED_RE matches — 27 of 9,093 corpus messages (0.3%). Two
// execFileSync calls with 4s timeouts, bounded to 8 distinct paths per message.
//
// FAIL-OPEN: git unavailable/not a repo/timeout → allow (a rule that cannot read its own
// evidence must never fire, warn included). A path OUTSIDE the repo → allow (git cannot judge it).
export const RULE_IDS = ['L64a'];

import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const PATHISH = '((?:[\\w\\-.]+[/\\\\])*[\\w\\-.]+\\.(?:md|py|mjs|js|json|ts|css|html|txt|sql))';
const VERB = '(?:landed|committed|נחת(?:ה|ו)?|הופקד(?:ה|ו)?)';
// Verb and path within 60 chars of each other on ONE LINE, either order. The bounded class
// [^\n]{0,60} crosses everything except the newline it must not cross.
export const LANDED_RE = new RegExp(
  `${VERB}[^\\n]{0,60}?${PATHISH}|${PATHISH}[^\\n]{0,60}?${VERB}`, 'gi');

function toRepoRelative(p) {
  let norm = p.replace(/\\/g, '/').replace(/^\.\//, '');
  if (isAbsolute(norm) || /^[A-Za-z]:\//.test(norm)) {
    const rel = relative(ROOT, norm).replace(/\\/g, '/');
    if (rel.startsWith('..')) return null; // outside the repo — git cannot judge it
    norm = rel;
  }
  return norm;
}

// { confirmed:true } | { confirmed:false, why } | null (git itself unavailable — degrade).
function gitConfirms(relPath) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${relPath}`],
      { cwd: ROOT, timeout: 4000, stdio: 'pipe' });
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.killed)) return null; // no git / timeout — degrade
    return { confirmed: false, why: `git does not have ${relPath} in HEAD` };
  }
  try {
    const st = execFileSync('git', ['status', '--porcelain', '--', relPath],
      { cwd: ROOT, timeout: 4000, encoding: 'utf8' });
    if (st.trim() !== '') return { confirmed: false, why: `${relPath} has uncommitted changes on disk` };
  } catch {
    return null; // status unreadable — degrade rather than accuse
  }
  return { confirmed: true };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: 'L64a degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: 'L64a degraded: no readable assistant reply text — allowing.' };
  }

  const masked = maskQuotedProse(text, { keepInlineCode: true });
  const paths = new Set();
  let m;
  LANDED_RE.lastIndex = 0;
  while ((m = LANDED_RE.exec(masked)) !== null && paths.size < 8) {
    const raw = m[1] || m[2];
    if (raw) {
      const rel = toRepoRelative(raw);
      if (rel) paths.add(rel);
    }
  }
  if (paths.size === 0) {
    return { decision: 'allow', reason: 'no landed/committed claim over a named document — L64a does not apply.' };
  }

  for (const rel of paths) {
    const verdict = gitConfirms(rel);
    if (verdict === null) {
      return { decision: 'allow', reason: 'L64a degraded: git could not be consulted — allowing rather than warning on unreadable evidence.' };
    }
    if (!verdict.confirmed) {
      return {
        decision: 'warn',
        reason: `L64a: הטענה ש-\`${rel}\` נחת אינה מאושרת על-ידי git (${verdict.why}). `
          + 'git הוא עד הנחיתה היחיד: הפקד את הקובץ (commit), או אמת עם '
          + '`git show HEAD:<path>` + `git status --porcelain -- <path>` ונסח מה ש-git באמת מאשר. '
          + 'הימצאות בגניזה או ב-search hit אינה ראיית נחיתה — הגניזה נבלעת מהדיסק.',
      };
    }
  }
  return { decision: 'allow', reason: 'every landed-claimed path is in HEAD with a clean status — L64a satisfied.' };
}
```

- [ ] **Step 4: Show `LANDED_RE` matching its own fixture**:

Run: `node --input-type=module -e "import {LANDED_RE} from './scripts/hooks/stop-rules/landed-claim-git.mjs'; for (const t of ['המסמך docs/x.md נחת', 'landed docs/plans/y.md this morning', 'עדכנתי את docs/z.md']) { LANDED_RE.lastIndex=0; console.log(t, '->', LANDED_RE.test(t)); }"`
Expected: `true`, `true`, `false`. Paste.

- [ ] **Step 5: GREEN** — `pytest -v -k l64a` → 4 PASS. Paste.

- [ ] **Step 6: Corpus replay** — note the honesty caveat and write it into the report:

```python
def test_l64a_corpus_replay(corpus_dump):
    out = replay("landed-claim-git.mjs", corpus_dump)
    assert out["fireCount"] <= 30, f"L64a trigger too loose: {out['fireCount']}"
```

Replay judges historical claims against TODAY's git — a doc that landed in July and was later renamed/deleted fires here without having been a violation THEN. Classify every fire into three bins: genuine past violation (rule working) / since-renamed-or-deleted (replay artifact, named as such with the git evidence) / **legitimate at the time and still in HEAD (a real false alarm → phase stops, spec §6)**. Paste the three-bin table.

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/stop-rules/landed-claim-git.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 5): L64a — a landed claim is checked against git, not a search hit"
```

---

### Task 6: `L14` — extend `live-url-verified.mjs` and repair the measured ~75% noise it inherits

**The stated risk, addressed head-on:** 10.10's rule was measured at ~75% false alarms and deferred. L14 shares its evidence channel (the live-claim detector + `live_probe` freshness), so this task may not ship until the channel's corpus fires classify clean. Two repairs, both root-cause: (1) masking (already live via Task 1 — quoted §10.10 prose no longer fires); (2) `LIVE_CLAIM_RE` narrowing — the shipped pattern fires on bare `באוויר`, and the standing H8 phrase **"אין פריט באוויר"** contains it, as does "פריט באוויר" in every H8 discussion; a sentence-level negation guard completes it.

**Files:**
- Modify: `scripts/hooks/lib/claim-scan.mjs` (`LIVE_CLAIM_RE`, `detectsLiveClaim`)
- Modify: `scripts/hooks/stop-rules/live-url-verified.mjs` (`RULE_IDS`, header)
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: Task 1's `maskQuotedProse`; Task 1 Step 8's measured baseline `fireCount` for this rule.
- Produces: `RULE_IDS = ['10.10','L14']`; `detectsLiveClaim` becomes sentence-scoped with a negation guard (same exported name and signature — `live-url-verified.mjs` needs no call-site change).

- [ ] **Step 1: Failing tests**:

```python
# ------------------------------------------------------- Task 6: L14 + the 10.10 channel repair

def test_l14_declared_on_live_url_verified():
    src = (STOP_RULES / "live-url-verified.mjs").read_text(encoding="utf-8")
    assert "'L14'" in src


def test_live_claim_not_fired_by_h8_phrase():
    # "אין פריט באוויר" is the H8 standing-rule phrase — it asserts NOTHING is live.
    assert node_eval("C.detectsLiveClaim('בדקתי את המרשם — אין פריט באוויר, הכל נחת')") is False


def test_live_claim_not_fired_by_negation():
    assert node_eval("C.detectsLiveClaim('מהדורה 291 עוד לא באוויר, Cloudflare עדיין בונה')") is False


def test_live_claim_still_fires_on_real_live_assertion():
    assert node_eval("C.detectsLiveClaim('מהדורה 291 באוויר, ה-foot-stamp מאומת')") is True
    assert node_eval("C.detectsLiveClaim('v291 is live on the site')") is True


def test_l14_block_live_claim_without_probe(tmp_path):
    out = eval_stop_rule("live-url-verified.mjs", "מהדורה 291 עלתה לאוויר.", tmp_path)
    assert out["decision"] == "block"
```

- [ ] **Step 2: RED — and the shipped-rule BEFORE run** — `pytest -v -k "l14 or live_claim"` → `l14_declared` FAILS; `h8_phrase` and `negation` FAIL (the shipped regex matches bare `באוויר`). Paste — this RED is the measured defect witnessed. Also run `node scripts/tests/test-hooks-groupb.mjs` BEFORE editing and paste (the owner's before/after condition on modifying shipped rules; Step 5 is the AFTER half).

- [ ] **Step 3: Implement the narrowing** — in `claim-scan.mjs`, replace `LIVE_CLAIM_RE` and `detectsLiveClaim`:

```js
// Live/shipped claims (§10.10 + L14 — v255 is the paid incident). NARROWED in Arc 2 Phase 4:
// the original pattern matched bare "באוויר", which fires on the H8 standing phrase
// "אין פריט באוויר" and on every H8 discussion of items "באוויר" — a measured driver of the
// ~75% false-alarm rate that got the 10.10 rule deferred. Now the live-word must sit in a
// version/release context, and a sentence-level negation guard (a negator BEFORE the match in
// the same sentence) voids it — same position discipline as SUBORDINATOR_RE above.
export const LIVE_CLAIM_RE = /(?:גרסה|מהדורה|version|\bv\d{2,4}\b)[^\n.!?]{0,40}?(?:חיה|עלתה(?:\s+לאוויר)?|באוויר|is live|live\b)|עלה לאוויר|עלתה לאוויר|\bis (?:now )?live\b|\bnow live\b|deployed and live/i;

const LIVE_NEGATION_RE = /\b(?:אין|לא|טרם|עוד לא|not|isn'?t|won'?t|before|until)\b|עדיין\s+לא/i;

export function detectsLiveClaim(text) {
  if (typeof text !== 'string' || !text) return false;
  const masked = maskQuotedProse(text);
  for (const sentence of masked.split(/[.!\n]/)) {
    if (sentence.includes('?')) continue; // a question is never a claim (same rule as findClaimMatch)
    const m = LIVE_CLAIM_RE.exec(sentence);
    if (!m) continue;
    const neg = LIVE_NEGATION_RE.exec(sentence);
    if (neg && neg.index < m.index) continue; // negation governs the claim — void
    return true;
  }
  return false;
}
```

In `live-url-verified.mjs`, change the export to `export const RULE_IDS = ['10.10', 'L14'];` and append to the header comment:

```js
// L14 (Arc 2 Phase 4 decision, made explicitly): L14's own text DERIVES §10.10 from the v255
// incident, and its registered mechanism target is "responses claiming a version is live /
// released" — exactly this rule's trigger and evidence channel. A second detector for the same
// claim shape is R-116. L14's clause (b) ("when the owner reports 'I don't see it', check the
// simplest external explanation first") is judgment-shaped with no mechanical trigger; the
// registered enforceable half is clause (a), which this rule IS. The ~75% false-alarm rate that
// deferred this rule was repaired in the same phase: claim detection now runs on masked prose
// (maskQuotedProse — quoted §10.10 text no longer fires) and LIVE_CLAIM_RE requires a
// version/release context with a sentence-level negation guard (bare "באוויר" — the H8 phrase
// "אין פריט באוויר" — no longer fires). Measured before/after on the real corpus: numbers in
// the Task 6 report, docs/superpowers/plans/2026-08-11-arc2-phase4-stop.md.
```

- [ ] **Step 4: Show the narrowed regex against its fixtures**:

Run: `node --input-type=module -e "import {detectsLiveClaim} from './scripts/hooks/lib/claim-scan.mjs'; for (const t of ['אין פריט באוויר', 'מהדורה 291 באוויר', 'v291 is live', 'ההוראה: \"never say it is live without a probe\"']) console.log(t.slice(0,30), '->', detectsLiveClaim(t));"`
Expected: `false`, `true`, `true`, `false`. Paste.

- [ ] **Step 5: GREEN** — `pytest -v -k "l14 or live_claim"` → 5 PASS. ALSO run `node scripts/tests/test-hooks-groupb.mjs` — if any existing test pinned the OLD loose pattern (e.g. asserted bare `באוויר` fires), it encoded the measured defect: update that one assertion, and say so with the before/after in the report (this is the only permitted existing-test change in the phase, and it must be named to the reviewer).

- [ ] **Step 6: The before/after corpus measurement (the task's acceptance)**:

```python
def test_l14_corpus_replay_post_repair(corpus_dump):
    out = replay("live-url-verified.mjs", corpus_dump)
    # Empty state => EVERY detected live claim fires, so fireCount IS the detector surface.
    # Bar: every fire classifies as a GENUINE live assertion (which, with no probe recorded,
    # is the rule doing its job) — zero fires on prose ABOUT liveness.
    assert out["fireCount"] <= 80, f"live-claim detector still too loose: {out['fireCount']}"
```

Run; paste fireCount next to Task 1 Step 8's pre-repair baseline for this rule; classify a 20-fire sample. Any prose-about-liveness fire remaining → narrow further (the negation list or the context window), re-run, record the loop. **The rule stays effectively deferred (this task does not commit) until the sample classifies clean.**

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/lib/claim-scan.mjs scripts/hooks/stop-rules/live-url-verified.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 6): L14 rides 10.10 — and the measured live-claim noise is repaired at the root, not inherited"
```

---

### Task 7: `L63a` — a report may not cite a file it did not open this session

Lesson (2026-08-05): "A final report may cite a repo file as justification only if that file was actually opened this session. A cited path absent from the session's read history blocks the report." The evidence channel already exists: `read-tracker.mjs` records `file_read` for every successful Read; `noteEdit` records `edit` for every successful Edit/Write (a file this session WROTE is legitimately citable without a Read). **Ships as `warn` by owner ruling (2026-08-10), against the lesson's "blocks the report" wording — and rightly the most cautious of the three: its evidence channel is the youngest in the store. Warn-first, promotable per the trigger-anchored item above. The L57 degrade-to-allow guard stays regardless of severity.**

**Files:**
- Create: `scripts/hooks/stop-rules/cited-path-read.mjs`
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: `lastAssistantText`, `maskQuotedProse` (with `keepInlineCode: true` — citations live in inline code); `openState`, `recentEvents` from `../lib/enforcement-state.mjs` (**`detail` is a JSON string — parse it**); `seed_event()` test helper.
- Produces: `RULE_IDS = ['L63a']`; exports `CITED_PATH_RE`.

- [ ] **Step 1: Failing tests**:

```python
# ------------------------------------------------------- Task 7: L63a cited↔read

CITE_TEXT = "לפי scripts/hooks/lib/claim-scan.mjs השדה determined הוא החוזה, וזו ההצדקה."


def test_l63a_warns_on_cited_path_not_in_read_history(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l63a"
    # Channel IS wired (one unrelated read exists) — the cited path is simply absent.
    seed_event(state, session, "file_read", str(ROOT / "docs" / "STATUS-BOARD.md"))
    out = eval_stop_rule("cited-path-read.mjs", CITE_TEXT, tmp_path,
                         state_path=state, session=session)
    assert out["decision"] == "warn"
    assert "claim-scan.mjs" in out["reason"]


def test_l63a_allows_cited_path_that_was_read(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l63a"
    seed_event(state, session, "file_read", str(ROOT / "scripts" / "hooks" / "lib" / "claim-scan.mjs"))
    out = eval_stop_rule("cited-path-read.mjs", CITE_TEXT, tmp_path,
                         state_path=state, session=session)
    assert out["decision"] == "allow"


def test_l63a_allows_cited_path_that_was_written(tmp_path):
    state = tmp_path / "state.sqlite"
    session = "s-l63a"
    seed_event(state, session, "file_read", str(ROOT / "docs" / "STATUS-BOARD.md"))  # wired
    seed_event(state, session, "edit", str(ROOT / "scripts" / "hooks" / "lib" / "claim-scan.mjs"))
    out = eval_stop_rule("cited-path-read.mjs", CITE_TEXT, tmp_path,
                         state_path=state, session=session)
    assert out["decision"] == "allow"


def test_l63a_degrades_to_allow_when_channel_has_zero_reads(tmp_path):
    # The L57 trap: an unwired/empty channel must NEVER be mistaken for "did not read".
    out = eval_stop_rule("cited-path-read.mjs", CITE_TEXT, tmp_path, session="s-l63a-empty")
    assert out["decision"] == "allow"


def test_l63a_silent_when_no_path_cited(tmp_path):
    out = eval_stop_rule("cited-path-read.mjs", "סיימתי לקרוא ואמשיך.", tmp_path)
    assert out["decision"] == "allow"
```

- [ ] **Step 2: RED** — `pytest -v -k l63a` → module not found. Paste.

- [ ] **Step 3: Implement** — create `scripts/hooks/stop-rules/cited-path-read.mjs`:

```js
// scripts/hooks/stop-rules/cited-path-read.mjs — Arc 2 Phase 4, L63a (2026-08-05, split
// 9.8.26): "A final report may cite a repo file as justification only if that file was actually
// opened this session… Open the file while you quote it, not from memory of it."
//
// SEVERITY: WARN, by OWNER RULING (2026-08-10). The lesson's own text says "A cited path absent
// from the session's read history blocks the report", and the harm it records is substantive —
// a citation from memory is fabricated provenance (the 2026-08-05 incident). The owner chose
// warn FIRST anyway, and for this rule the caution is doubly earned: its evidence channel
// (file_read/edit events) is the youngest in the store, so it is the rule most likely to fire
// wrongly at first. Promotion path registered (plan §"Warn-first and the promotion trigger").
// Reachable path (§10.24): Read the file NOW and cite what it actually says — one tool call —
// or drop the citation.
//
// THE GUARD THAT MAKES FIRING SAFE AT ANY SEVERITY (the L57 trap, same reasoning as
// read-tracker.mjs's own header): "no file_read rows for this session" is indistinguishable
// from "the observer channel is broken/unwired/expired (24h TTL)". A session with ZERO
// file_read rows therefore DEGRADES TO ALLOW — this rule only ever fires on a TARGETED absence
// inside a channel that is provably recording. This is also what makes the corpus replay
// honest: replayed with an empty store, every message degrades (fireCount 0 proves the
// degraded path), and the firing path is proven by seeded-state tests through the REAL
// enforcement-state module.
//
// WHAT COUNTS AS "OPENED": a 'file_read' (read-tracker.mjs, successful Read) OR an 'edit'
// (noteEdit via edit-tracker.mjs, successful Edit/Write) — a file this session WROTE is
// legitimately citable without re-reading it. Events are read UNFILTERED by actor on purpose: a
// file a dispatched subagent read in this session is knowledge this session actually has.
//
// MASKING PROFILE: keepInlineCode:true — citations are written as `docs/x.md`. Fenced blocks
// stay masked: a path inside PASTED OUTPUT is not the assistant citing justification.
export const RULE_IDS = ['L63a'];

import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';
import { openState, recentEvents } from '../lib/enforcement-state.mjs';

// Repo-rooted paths only (docs/scripts/src/tests) — the shape the lesson is about, and the
// shape the measurement counted (455 msgs, 5%). Deliberately NOT every path-like token.
export const CITED_PATH_RE = /\b(?:docs|scripts|src|tests)[\/\\][\w\-.\/\\]*\w\.(?:md|py|mjs|js|json|ts|txt|css|html)\b/g;

function norm(p) { return String(p).replace(/\\/g, '/').toLowerCase(); }

function degraded(what) {
  return { decision: 'allow', reason: `L63a degraded: ${what} — allowing rather than warning on unreadable/undeterminable evidence.` };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') return degraded('no input');
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return degraded('no session_id on this Stop event');

  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) return degraded('no readable assistant reply text');

  const masked = maskQuotedProse(text, { keepInlineCode: true });
  const cited = new Set();
  let m;
  CITED_PATH_RE.lastIndex = 0;
  while ((m = CITED_PATH_RE.exec(masked)) !== null && cited.size < 12) cited.add(norm(m[0]));
  if (cited.size === 0) {
    return { decision: 'allow', reason: 'no repo path cited in the final reply — L63a does not apply.' };
  }

  const db = openState();
  if (!db) return degraded('enforcement state store unavailable');
  let reads;
  let edits;
  try {
    reads = recentEvents(db, sessionId, 'file_read', 0);
    edits = recentEvents(db, sessionId, 'edit', 0);
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (!Array.isArray(reads) || reads.length === 0) {
    return degraded('zero file_read rows for this session — an empty channel is indistinguishable from an unwired one (L57), never treated as "did not read"');
  }

  const opened = [];
  for (const ev of [...reads, ...(Array.isArray(edits) ? edits : [])]) {
    try {
      const d = JSON.parse(ev.detail); // detail is a JSON STRING per enforcement-state.mjs
      if (d && typeof d.filePath === 'string') opened.push(norm(d.filePath));
    } catch { /* an unparseable row proves nothing */ }
  }

  for (const c of cited) {
    const seen = opened.some((o) => o === c || o.endsWith('/' + c));
    if (!seen) {
      return {
        decision: 'warn',
        reason: `L63a: הדוח מצטט את \`${c}\` כהצדקה, אבל הקובץ לא נפתח ב-session הזה `
          + '(אין file_read/edit תואם במחסן האירועים). פתח את הקובץ עכשיו (Read) וצטט את מה '
          + 'שכתוב בו באמת — או הסר את הציטוט. מצטטים מהקובץ, לא מהזיכרון עליו.',
      };
    }
  }
  return { decision: 'allow', reason: 'every cited repo path was opened (read or written) this session — L63a satisfied.' };
}
```

- [ ] **Step 4: Show `CITED_PATH_RE` matching its own fixture**:

Run: `node --input-type=module -e "import {CITED_PATH_RE} from './scripts/hooks/stop-rules/cited-path-read.mjs'; const t='לפי scripts/hooks/lib/claim-scan.mjs ולפי docs/STATUS-BOARD.md, אבל לא לפי mockups/x.png'; console.log(t.match(CITED_PATH_RE));"`
Expected: `[ 'scripts/hooks/lib/claim-scan.mjs', 'docs/STATUS-BOARD.md' ]` (png is outside the extension list; mockups/ outside the root list). Paste.

- [ ] **Step 5: GREEN** — `pytest -v -k l63a` → 5 PASS. Paste.

- [ ] **Step 6: Corpus replay — the degraded path is the honest historical test**:

```python
def test_l63a_corpus_replay_degraded_path_never_fires(corpus_dump):
    # Historical messages carry no session state (the store did not exist for most of the
    # corpus). Replay proves the DEGRADED path is safe: with an empty store, zero fires — a
    # broken/absent channel never fires at any severity.
    out = replay("cited-path-read.mjs", corpus_dump)
    assert out["fireCount"] == 0, out["fires"][:5]
```

The DETECTOR's narrowness is measured separately in the same step: run `node --input-type=module -e` counting `CITED_PATH_RE` hits across the dump (reusing the dump file, not a second reader), paste the count (~455 expected, matching the measurement), and sample 20 to confirm each is a genuine path citation. The firing path's false-alarm evidence is the seeded-state test pair (Steps 1–5) through the REAL state module — **this split IS how §3.1 is satisfied for a state-shaped stop rule (owner-approved, 2026-08-10): the 9,093 text messages cannot witness a per-session state store that did not exist when they were sent, and claiming they did would be L77.** Stated in the report exactly this way — silent truncation reads as coverage.

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/stop-rules/cited-path-read.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 7): L63a — cite from the open file, not from memory; L57-guarded block"
```

---

### Task 8: `L12` — a UI-verified claim while the manual server provably serves a stale build

Lesson: "A UI check verified a STALE build — the in-memory serve.js caches dist/ at startup… Restart the manual server after every build before a manual UI check." The OS-truth staleness check already exists inside `stale-dev-server.mjs` (PreToolUse, fires at `browser_navigate` — BEFORE the check). L12's `stop` assignment covers the other end: the moment the assistant REPORTS a UI verification to the owner while the server on 8123 still provably serves a pre-rebuild `dist/`. The staleness logic is EXTRACTED to a lib and consumed by both — never duplicated (R-116; a helper applied to one rule and not its sibling is today's found defect).

**Files:**
- Create: `scripts/hooks/lib/stale-server.mjs`
- Modify: `scripts/hooks/rules/stale-dev-server.mjs` (import the lib; behavior identical; existing tests pass unchanged)
- Create: `scripts/hooks/stop-rules/ui-check-stale-build.mjs`
- Test: `tests/test_arc2_phase4_rules.py`

**Interfaces:**
- Consumes: `detectsSuccessClaim`, `lastAssistantText`, `maskQuotedProse`; the moved `findListeningPid`/`processStartTimeMs` (verbatim from `stale-dev-server.mjs` — netstat + PowerShell Get-Process, test seams `MK_TEST_PORT`/`PRETOOLUSE_DIST_DIR` preserved).
- Produces: `staleServeReport({port?, distDir?}) -> {stale, pid, port, startedMs, distMtimeMs} | null` (null = no build / no listener / undeterminable — NEVER "assume stale"); stop-rule exports `RULE_IDS = ['L12']`, `UI_CHECK_RE`.

- [ ] **Step 1: Failing tests** (includes the refactor's behavior-identical proof):

```python
# ------------------------------------------------------- Task 8: L12 stale-build UI claim

def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _wait_listening(port, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


UI_CLAIM = "בוצע — השינוי נבדק ב-UI בדפדפן ונראה תקין."


def test_l12_warns_on_ui_claim_over_stale_server(tmp_path):
    port = _free_port()
    dist = tmp_path / "dist"
    dist.mkdir()
    proc = subprocess.Popen(
        ["node", "-e",
         f"require('net').createServer(()=>{{}}).listen({port},'127.0.0.1');setInterval(()=>{{}},1e3)"])
    try:
        assert _wait_listening(port)
        time.sleep(1.5)  # ensure the "rebuild" mtime lands measurably AFTER process start
        (dist / "index.html").write_text("<html>rebuilt</html>", encoding="utf-8")
        out = eval_stop_rule("ui-check-stale-build.mjs", UI_CLAIM, tmp_path,
                             env_extra={"MK_TEST_PORT": str(port),
                                        "PRETOOLUSE_DIST_DIR": str(dist)})
        assert out["decision"] == "warn"
        assert "L12" in out["reason"]
    finally:
        proc.kill()


def test_l12_silent_when_no_server_listening(tmp_path):
    port = _free_port()  # nothing listening on it
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html></html>", encoding="utf-8")
    out = eval_stop_rule("ui-check-stale-build.mjs", UI_CLAIM, tmp_path,
                         env_extra={"MK_TEST_PORT": str(port),
                                    "PRETOOLUSE_DIST_DIR": str(dist)})
    assert out["decision"] == "allow"


def test_l12_silent_on_ui_claim_without_success_claim(tmp_path):
    # Describing a plan to check the UI is not reporting a verification.
    out = eval_stop_rule("ui-check-stale-build.mjs",
                         "אבדוק עכשיו את המסך בדפדפן.", tmp_path,
                         env_extra={"MK_TEST_PORT": str(_free_port())})
    assert out["decision"] == "allow"


def test_stale_dev_server_still_passes_after_refactor():
    # The lib extraction must be behavior-identical: the sibling PreToolUse rule's own suite is
    # the proof. (groupa covers stale-dev-server.mjs — run the file, expect exit 0.)
    r = subprocess.run(["node", str(ROOT / "scripts" / "tests" / "test-hooks-groupa.mjs")],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr
```

- [ ] **Step 2: RED** — `pytest -v -k l12 or stale_dev` → the three l12 tests FAIL (module not found); the refactor test passes (nothing moved yet — it is the pin). Paste.

- [ ] **Step 3: Create `scripts/hooks/lib/stale-server.mjs`** — move `findListeningPid` and `processStartTimeMs` VERBATIM (cut-paste, no edits) out of `stale-dev-server.mjs`, and add the report function:

```js
// scripts/hooks/lib/stale-server.mjs — Arc 2 Phase 4, Task 8. The §11a/L12 staleness check,
// EXTRACTED verbatim from rules/stale-dev-server.mjs so the PreToolUse rule (11a — warn before
// the navigation) and the Stop rule (L12 — warn on the claim after) consume ONE implementation.
// A helper applied to one rule and not its sibling is the exact defect found on 2026-08-10
// (R-116). Read stale-dev-server.mjs's original header for the OS-truth reasoning: server start
// time comes from the process table, dist/index.html's mtime from the filesystem — no flag to
// go stale.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

export function findListeningPid(port) {
  /* moved VERBATIM from stale-dev-server.mjs — do not edit while moving */
}

export function processStartTimeMs(pid) {
  /* moved VERBATIM from stale-dev-server.mjs — do not edit while moving */
}

// null = cannot determine (no build on disk / no listener / start time unreadable) — callers
// must treat null as "no evidence", NEVER as "stale". Env seams identical to the sibling rule.
export function staleServeReport({
  port = Number(process.env.MK_TEST_PORT) || 8123,
  distDir = process.env.PRETOOLUSE_DIST_DIR || join(ROOT, 'dist'),
} = {}) {
  const distIndex = join(distDir, 'index.html');
  if (!existsSync(distIndex)) return null;
  const pid = findListeningPid(port);
  if (pid === null) return null;
  const startedMs = processStartTimeMs(pid);
  if (startedMs === null) return null;
  const distMtimeMs = statSync(distIndex).mtimeMs;
  return { stale: distMtimeMs > startedMs, pid, port, startedMs, distMtimeMs };
}
```

(The two moved function bodies are copied exactly as they stand in `stale-dev-server.mjs` lines 49–80 — the implementer pastes them, then deletes them from the rule file and replaces with `import { findListeningPid, processStartTimeMs } from '../lib/stale-server.mjs';`. `stale-dev-server.mjs`'s `evaluate()` logic is untouched.)

- [ ] **Step 4: Create `scripts/hooks/stop-rules/ui-check-stale-build.mjs`**:

```js
// scripts/hooks/stop-rules/ui-check-stale-build.mjs — Arc 2 Phase 4, L12: "A UI check verified
// a STALE build — the in-memory serve.js caches dist/ at startup, so a rebuild never reached
// the running manual server." The PreToolUse sibling (rules/stale-dev-server.mjs, 11a) warns
// BEFORE the navigation; this rule covers the registered stop end — the moment the assistant
// REPORTS a UI verification to the owner while the server on 8123 still provably serves a
// pre-rebuild dist/. One staleness implementation, shared: ../lib/stale-server.mjs.
//
// SEVERITY: WARN — the same class and the same argument as the shipped 11a warn: a stale-build
// UI check costs a wasted look at the wrong build, it removes no capability and fabricates no
// number. (The CLAIM it decorates is separately policed by rule 1/DoD-3.)
//
// TRIGGER = claim ∧ UI-vocabulary ∧ OS-proven staleness — three independent conditions, all on
// this turn, which is what keeps the corpus surface near zero. OS conditions are read live
// (netstat + process table); when they cannot be determined, staleServeReport() returns null
// and this rule stays silent — "cannot prove stale" is never "stale".
export const RULE_IDS = ['L12'];

import { lastAssistantText, detectsSuccessClaim, maskQuotedProse } from '../lib/claim-scan.mjs';
import { staleServeReport } from '../lib/stale-server.mjs';

export const UI_CHECK_RE = /(?:נבדק|נבחן|נראה|אומת|נצפה)[^\n.!?]{0,40}(?:UI|בדפדפן|במסך|ויזואלי)|verified[^\n.!?]{0,40}\b(?:UI|browser|visually)\b|\bin the (?:UI|browser)\b[^\n.!?]{0,30}\b(?:verified|checked|looks)\b/i;

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: 'L12 degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: 'L12 degraded: no readable assistant reply text — allowing.' };
  }

  if (!detectsSuccessClaim(text)) {
    return { decision: 'allow', reason: 'no success-claim phrasing in the final reply — L12 does not apply.' };
  }
  if (!UI_CHECK_RE.test(maskQuotedProse(text))) {
    return { decision: 'allow', reason: 'the claim does not report a UI check — L12 does not apply.' };
  }

  const report = staleServeReport();
  if (!report || !report.stale) {
    return { decision: 'allow', reason: 'no OS evidence of a stale manual server — L12 satisfied or undeterminable.' };
  }

  return {
    decision: 'warn',
    reason: `L12/§11a: ההודעה מדווחת על בדיקת UI, אבל dist/ נבנה מחדש `
      + `(${new Date(report.distMtimeMs).toISOString()}) אחרי שהשרת הידני על פורט ${report.port} `
      + `עלה (pid ${report.pid}, ${new Date(report.startedMs).toISOString()}) — serve.js מטמין את `
      + 'dist/ בזיכרון בעלייה, כך שהבדיקה אימתה כנראה build ישן. הפעל מחדש את serve.js והסתכל שוב.',
  };
}
```

- [ ] **Step 5: Show `UI_CHECK_RE` matching its own fixture**:

Run: `node --input-type=module -e "import {UI_CHECK_RE} from './scripts/hooks/stop-rules/ui-check-stale-build.mjs'; for (const t of ['השינוי נבדק ב-UI ונראה תקין', 'verified in the browser', 'ערכתי את הקובץ ואמשיך']) console.log(t, '->', UI_CHECK_RE.test(t));"`
Expected: `true`, `true`, `false`. Paste.

- [ ] **Step 6: GREEN** — `pytest tests/test_arc2_phase4_rules.py -v -k "l12 or stale_dev"` → 4 PASS (including the refactor pin, now over the extracted lib). Paste.

- [ ] **Step 7: Corpus replay** — on the replay machine no server serves a rebuilt dist at 8123 mid-run, so the OS leg is expected-null; the replay proves the TEXT legs never crash and the rule never fires without OS evidence:

```python
def test_l12_corpus_replay_never_fires_without_os_evidence(corpus_dump):
    out = replay("ui-check-stale-build.mjs", corpus_dump)
    assert out["fireCount"] == 0, out["fires"][:5]
```

The text-detector's surface is additionally measured: count messages where BOTH `detectsSuccessClaim` and `UI_CHECK_RE` hold (one `node --input-type=module -e` pass over the dump), paste the count and a 10-sample classification — each sampled hit must genuinely report a UI verification. State in the report, plainly: the corpus cannot witness the OS leg; the OS leg's evidence is the live-listener catch test (Step 1), which drives a REAL socket and a REAL process table. **This split IS how §3.1 is satisfied for the OS-shaped leg (owner-approved, 2026-08-10) — a replay months later cannot recreate the port-8123 process table of the original moment, and pretending it could would be L77.**

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/lib/stale-server.mjs scripts/hooks/rules/stale-dev-server.mjs scripts/hooks/stop-rules/ui-check-stale-build.mjs tests/test_arc2_phase4_rules.py
git commit -m "feat(arc2-phase4, Task 8): L12 — UI-verified claim vs OS-proven stale serve; staleness logic extracted, shared, not duplicated"
```

---

### Task 9: Wiring, coverage, liveness with zero env overrides, overhead, full suites

**Files:**
- Modify: `docs/process/rule-coverage-baseline.json`
- Create: `tests/test_arc2_phase4_wiring.py`

**Interfaces:**
- Consumes: everything above; `node scripts/check-rule-coverage.mjs`; the real `node scripts/hooks/stop.mjs` CLI.
- Produces: the phase's closure evidence (spec §5.1–5.6).

- [ ] **Step 1: Write the failing wiring tests** — create `tests/test_arc2_phase4_wiring.py`:

```python
# tests/test_arc2_phase4_wiring.py — Arc 2 Phase 4 closure: coverage, liveness with NO env
# overrides (spec §3.4 — this phase family once shipped a stop rule inert behind a test-only
# env var while 333 tests passed), and measured overhead.
import json
import os
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOP_CLI = ROOT / "scripts" / "hooks" / "stop.mjs"
PHASE4_IDS = {"10.6", "DoD-3", "H9", "L12", "L14", "L23a", "L63a", "L64a"}


def _transcript(tmp_path, text):
    p = tmp_path / "transcript.jsonl"
    entry = {"type": "assistant",
             "timestamp": datetime.now(timezone.utc).isoformat(),
             "message": {"role": "assistant",
                          "content": [{"type": "text", "text": text}]}}
    p.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def _run_stop_cli_no_overrides(payload):
    """THE liveness contract: env is inherited UNMODIFIED — nothing set, nothing stripped.
    If STOP_RULES_DIR etc. leak into the ambient environment, that is a finding to report,
    not something to silently launder here."""
    for var in ("STOP_RULES_DIR", "ENFORCEMENT_STATE_PATH", "PRETOOLUSE_LOG_PATH"):
        assert var not in os.environ, f"{var} set in ambient env — liveness run would be a lie"
    r = subprocess.run(["node", str(STOP_CLI)], input=json.dumps(payload),
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout) if r.stdout.strip() else {}


def test_phase4_ids_in_coverage_baseline():
    data = json.loads((ROOT / "docs" / "process" / "rule-coverage-baseline.json")
                      .read_text(encoding="utf-8"))
    assert PHASE4_IDS.issubset(set(data["covered"]))


def test_rule_coverage_gate_green():
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, r.stdout + r.stderr


def test_liveness_stop_cli_warns_l23a_with_no_env_overrides(tmp_path):
    # The fixture violates ONLY L23a: a translation percentage, no artifact, no claim word
    # (rule 1 silent), no live word, no cited repo path, no task-close phrasing. L23a is a WARN
    # (owner ruling) — through the real CLI, toStopOutput() carries warn as a systemMessage
    # with NO decision field. This run proves a Phase-4 rule loads via the real entry point
    # with zero env overrides — the inert-rule failure this test exists to make impossible.
    t = _transcript(tmp_path, "כיסוי התרגום בגרמנית עומד על 96% וממשיכים.")
    out = _run_stop_cli_no_overrides({
        "session_id": "s-phase4-liveness",
        "hook_event_name": "Stop",
        "transcript_path": str(t),
        "stop_hook_active": False,
    })
    assert "L23a" in out.get("systemMessage", ""), out
    assert out.get("decision") != "block", out


def test_liveness_stop_cli_allows_benign_reply(tmp_path):
    t = _transcript(tmp_path, "קראתי את הקובץ ואני ממשיך לקרוא את הבא.")
    out = _run_stop_cli_no_overrides({
        "session_id": "s-phase4-liveness-benign",
        "hook_event_name": "Stop",
        "transcript_path": str(t),
        "stop_hook_active": False,
    })
    assert out.get("decision") != "block", out


def test_overhead_measured_and_sane(tmp_path):
    # The stop hook fires ONCE PER TURN, not once per tool call — the 61ms Phase-4 baseline and
    # ~78ms PreToolUse worst are per-tool-call numbers and are NOT the bar here (spec §3.5,
    # controller directive). Numbers are printed for the report; only a pathology ceiling is
    # asserted.
    t = _transcript(tmp_path, "הודעה רגילה בלי שום טענה.")
    payload = json.dumps({"session_id": "s-phase4-overhead", "hook_event_name": "Stop",
                          "transcript_path": str(t), "stop_hook_active": False})
    times = []
    for _ in range(15):
        t0 = time.perf_counter()
        subprocess.run(["node", str(STOP_CLI)], input=payload, capture_output=True,
                       text=True, encoding="utf-8", cwd=str(ROOT))
        times.append((time.perf_counter() - t0) * 1000)
    med, worst = statistics.median(times), max(times)
    print(f"\nstop.mjs overhead: median {med:.0f}ms, worst {worst:.0f}ms over 15 runs "
          f"(per-TURN budget; PreToolUse per-call numbers deliberately not imported)")
    assert worst < 2000, f"pathological stop overhead: {worst:.0f}ms"
```

- [ ] **Step 2: RED** — `pytest tests/test_arc2_phase4_wiring.py -v` → `test_phase4_ids_in_coverage_baseline` FAILS (ids absent). The liveness tests may already pass if Tasks 1–8 landed — state which, honestly; the RED that matters here is the coverage delta. Paste.

- [ ] **Step 3: Add the 8 ids** to `docs/process/rule-coverage-baseline.json`'s `covered` array (`10.6`, `DoD-3`, `H9`, `L12`, `L14`, `L23a`, `L63a`, `L64a`) and bump `updated` to today. Run `node scripts/check-rule-coverage.mjs` — expected: green, and its scan proves each id maps to a real `RULE_IDS` declaration (an id claimed without a file is the gate's own error path).

- [ ] **Step 4: GREEN** — `pytest tests/test_arc2_phase4_wiring.py -v` → all PASS, overhead numbers printed. Paste median/worst into the report next to the sentence: *the stop budget is per-turn; the 61ms per-call baseline is reported for context, not imported as the bar.*

- [ ] **Step 5: Full-corpus replay of ALL EIGHT rule files, final numbers table** — re-run `replay-stop-corpus.mjs` for each of the 6 stop-rule files (3 shipped-and-extended, 3+2 new = 8 rule ids) against a fresh dump; paste one table: rule file → ids → fireCount → classification summary → severity. **Any legitimate-work fire anywhere: the phase stops here (spec §6), reported to the controller, not recorded-and-continued.**

- [ ] **Step 6: Full suites, serialized, machine otherwise idle (§11a)** — `node scripts/tests/run-all.mjs` (hook suites) → paste; `pytest` (whole repo) → paste; `npx playwright test` — plain, no flags, no `--retries`, no `--workers` — paste tail + exit code. Any failure, including intermittent: systematic-debugging, never a re-run-until-green.

- [ ] **Step 7: Commit**

```bash
git add docs/process/rule-coverage-baseline.json tests/test_arc2_phase4_wiring.py
git commit -m "feat(arc2-phase4, Task 9): coverage + no-override liveness + per-turn overhead — Phase 4 (stop, 8 rules) closed"
```

- [ ] **Step 8: Close per H9/H10 — including the promotion-trigger anchor** — the task-summary table and `docs/STATUS-BOARD.md` update (the board's Phase-4 row moves to closed-pending-review; the gap ledger notes any fires classified as genuine past violations — evidence for the register, not new gaps). **Add the H8 trigger-anchored item to the board's gap ledger:** "L23a/L64a/L63a shipped warn against their lessons' 'blocked at stop' wording (owner ruling 2026-08-10); at the first arc-close after 2026-08-17, classify a week of real fires per rule and propose block promotion only for rules with zero imprecise fires." Per L73 (live): the board/ledger write and the `git commit` run in SEPARATE Bash calls.

---

## Self-Review (performed while writing)

1. **Spec coverage:** §3.1 catch+false-alarm-on-real-corpus — every task has both, with the two honest carve-outs (L63a's firing path, L12's OS leg) *stated* rather than laundered (owner-approved as satisfying §3.1), each carrying a real-machine substitute test. §3.2/§10.24 — severity table + per-rule header arguments, block reasons all name a reachable alternative, no bypass. §3.3 — RULE_IDS in every file (extensions included). §3.4 — Task 9's no-override liveness pair, with an ambient-env assertion so the "no overrides" claim is itself verified. §3.5 — Task 9 overhead with the per-turn framing the directive required. §5.6 — Task 9 Step 6. §6 stop-on-legit-fire — written into Tasks 2–8 and Task 9 Step 5. Eight rules ↔ tasks: 10.6+H9→3, DoD-3→2, L23a→4, L64a→5, L14→6, L63a→7, L12→8. No spec line waived, narrowed, or deferred; the two "covered-by-extension" decisions are argued as coverage, not waiver, and — like the warn-first severities and the replay split — were resolved by the owner on 2026-08-10 (see "Owner resolutions" below).
2. **Placeholder scan:** the only elided bodies are the two functions moved VERBATIM in Task 8 Step 3, with their source lines named (`stale-dev-server.mjs` lines 49–80) — a cut-paste instruction, not a TBD. Every regex has a numbered fixture-match step. No "similar to Task N": Tasks 3–8 each carry their full rule file.
3. **Type consistency:** `maskQuotedProse(text, {keepInlineCode})` — Tasks 1, 3, 4, 5, 6, 7, 8 all use exactly this signature; `eval_stop_rule(rule_file, text, tmp_path, state_path=None, session=..., env_extra=None)` matches every call site; `replay(rule_file, corpus_path, state_path=None, session=None)` matches; `recentEvents` detail parsed as JSON string per the verified source; `staleServeReport` return shape used identically in Task 8's rule and tests.

## Owner resolutions (2026-08-10 — all five conflicts closed before execution)

1. **Shipped-rule modifications APPROVED** (`verify-before-success-claim.mjs` +DoD-3; `live-url-verified.mjs` +L14 with the LIVE_CLAIM_RE narrowing; `stale-dev-server.mjs` lib extraction), with the condition folded into Tasks 1/6/8: the shipped rules' existing tests run BEFORE and AFTER, both outputs pasted; behavior unchanged except where the narrowing is the point.
2. **Severity — owner ruling, reversing this plan's original recommendation:** L23a, L64a, L63a ship as `warn`, not block. Recorded honestly in each rule's header (the lesson's "blocked at stop" text quoted, the ruling named, warn-first) and anchored as the promotion-trigger item (§"Warn-first and the promotion trigger", written to the board in Task 9 Step 8).
3. **The foreseeable groupb assertion flip APPROVED** (Task 6): if a test pinned the loose bare-`באוויר` live-claim shape, that assertion encoded the measured defect — change exactly it, before/after quoted.
4. **Corpus-replay split for state/OS-shaped legs APPROVED as satisfying §3.1** (L63a, L12): degraded paths replayed over the real corpus (must be 0 fires); firing paths proven on real machinery (seeded real state store; real spawned listener + process table). Pretending 9,093 text messages could witness those legs would be L77 — stated inside Tasks 7 and 8.
5. **10.6/H9 narrow reading APPROVED** — and it is a narrowing of DETECTION, not of the requirement (L77): the rules still bind every task close; the gate only claims to catch the closes it can see. Stated in Task 3's prose and in the rule's own header.

**Nothing remains unresolved for the controller.**
