# Arc 2, Phase 2 — the eleven `pretooluse:Edit|Write` rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eleven `pretooluse:Edit|Write` rules — `10.14` `12.1` `2` `L13` `L16` `L21` `L52` `L56` `L57` `L78` `L9` — mechanically enforced as hook rules under `scripts/hooks/rules/`, each with a catch test AND a false-alarm test, live through the real `scripts/hooks/pretooluse.mjs` entry point.

**Architecture:** Unlike Phase 1's standalone CI gates, these are HOOK RULES: each is one `.mjs` file under `scripts/hooks/rules/`, auto-discovered by `scripts/hooks/pipeline.mjs` (readdir — no dispatcher to edit), receiving the PreToolUse payload and returning `{decision: 'allow'|'warn'|'block', reason}`. Nine rule files carry the eleven rules (two pairs share a scan target — argued at each pairing). Three rules are stateful (`10.14`, `L16`, `L56`) and read prior facts from `scripts/hooks/lib/enforcement-state.mjs`; the evidence channel `L16`/`L56` need (`file_read` events) does not exist yet and is built first (Task 1: a `Read` observer + a matcher extension). Every rule FAILS OPEN: anything it cannot interpret is an allow with the reason named.

**Tech Stack:** Node 24 ESM (`.mjs`), `node:sqlite` `DatabaseSync` (already the store's engine), Python 3.14 pytest spawning the real CLI as a subprocess with `encoding="utf-8"` (L74).

**Group-B discrepancy, stated up front rather than discovered in review:** the mirror (`rules.sqlite`) marks FIVE of the eleven as group `B` (`10.14`, `2`, `L16`, `L56`, `L78`); this design gives THREE of them state access:

| Rule | Prior fact it reads | Where that fact is written |
|---|---|---|
| `10.14` | `fix_targets.attempts` / `last_failure_ts` per (session, actor, target) | `scripts/hooks/observers/verification-outcomes.mjs` → `noteVerificationFailure()` (already live since Phase 4) |
| `L16` | `events` rows of kind `file_read` (per actor, TTL 24h) | **NEW** `scripts/hooks/observers/read-tracker.mjs` (Task 1), fired by a PostToolUse matcher extended to include `Read` |
| `L56` | the same `file_read` channel, plus its own once-per-actor throttle event `spec_read_nudge` | `read-tracker.mjs` (reads) and the rule itself via `recordEvent()` (throttle) |

The other two `B` rows are implemented stateless, deliberately: rule `2`'s prior fact ("is the governing spec approved") is REPO state — the approvals register — and its approval edge is already enforced per-write by `brainstorm-before-creative.mjs` (RULE_IDS `['1']`); this phase adds rule `2`'s remaining Edit|Write-enforceable substance (artifact shape + plan completeness), which needs only the payload. `L78`'s prior fact would be "a classification run is in flight," and **no recordable signal of that exists anywhere** — no observer sees a dispatch as "batch N of a measurement run." Blocking on a fact that cannot be read would violate fail-open, so `L78` is a stateless warn on the exact files whose mid-run edit was the documented failure. If the owner wants the mirror's `rule_group` cells corrected to match, that is a mirror change raised separately — this plan does not edit the mirror.

---

## Global Constraints

Copied from the approved spec (`docs/superpowers/specs/2026-08-09-arc2-enforcement-implementation-design.md`), and binding on every task:

- **TWO tests per rule: it catches a violation, AND it does not fire on healthy real work. The false-alarm test runs against REAL history or the real tree, never invented input.**
- **Severity per rule, argued in a comment. Warning if the harm is to efficiency; blocking if to substance. NEVER a bypass mechanism — only a less efficient way to do the same work.**
- **Every block names a REACHABLE alternative. A block whose message offers no way through is stopping work, not enforcing.**
- **`export const RULE_IDS` in every rule file.**
- **Fail open on anything undecidable, saying why.**
- **A check that examined NOTHING must not report a pass.**
- **One liveness test per phase, running the real entry point with NO env overrides.**
- **Overhead measured against the 61ms baseline and reported.**

Phase-1 corrections built in from the start:

- **Scope to where the construct ACTUALLY LIVES.** Every rule below states its payload position: which `tool_input` field, which path shape, which content shape makes a REAL instance. Rules read `tool_input.new_string`/`tool_input.content` (the text being ADDED), never "the word appears somewhere."
- **No pinned numbers in assertions.** Coverage tests assert over rule IDS, never a ratio (L64b).
- **Where a task changes existing behaviour** (the `check-plan-complete.mjs` refactor in Task 4, the `owner-decision-records` extraction in Task 6, the matcher change in Task 1), the plan says how RED is proven against the OLD behaviour.

House contract for every rule file in this phase (identical to the ten existing files — read `debugging-before-fix-edit.mjs` and `fix-cycle-limit.mjs` first, they are the reference shapes):

- First line of `evaluate()`: `if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) return { decision: 'allow', reason: 'not an Edit/Write' };`
- Every degraded path returns `allow` with a reason that names the degradation.
- `openState()` returning `null`, an unreadable transcript, a missing `session_id` — all allow, never block.
- `db.close()` in a `try/finally` or best-effort catch, exactly as the existing rules do.
- Paths from the payload are normalized before comparison (backslashes → `/`, lowercased) — this is Windows.

---

## File Structure

| File | Rules | Responsibility |
|---|---|---|
| `scripts/hooks/lib/target-path.mjs` | — (shared) | Path/content extraction + normalization every rule below uses |
| `scripts/hooks/lib/enforcement-state.mjs` | — (modify) | New read helper `recentEvents()` |
| `scripts/hooks/observers/read-tracker.mjs` | — (observer, `RULE_IDS = []`) | Records a `file_read` event per successful `Read` |
| `.claude/settings.json` | — (modify) | PostToolUse matcher gains `Read` |
| `scripts/hooks/lib/research-evidence.mjs` | — (shared) | "Did research happen since ts" transcript scan (geniza / WebSearch / WebFetch) |
| `scripts/hooks/lib/owner-decision-records.mjs` | — (shared) | `ownerDecisionRecords()` + `parseCutoffMs()` extracted from `fix-cycle-limit.mjs` |
| `scripts/hooks/rules/research-before-fix-cycle-3.mjs` | `10.14` | Warn: 2 failed fix cycles on a target and no research evidence since |
| `scripts/hooks/rules/one-pipeline.mjs` | `12.1`, `2` | Block GSD artifacts; warn on an incomplete plan Write |
| `scripts/check-plan-complete.mjs` | — (refactor) | Export `checkPlanText()`; CLI behaviour unchanged |
| `scripts/hooks/rules/derived-artifact-source.mjs` | `L16` | Block a CLAUDE.md edit when the discipline doc was never Read |
| `scripts/hooks/rules/spec-read-before-implementation.mjs` | `L56` | Warn once: implementation edited under an active arc whose spec was never Read |
| `scripts/hooks/rules/test-honesty.mjs` | `L9`, `L57` | Warn on wall-clock assertions under `page.clock`; block broad-except-skip |
| `scripts/hooks/rules/bidi-ltr-island.mjs` | `L13` | Block removal of an existing `dir="ltr"` island; warn on a ≥/≤ text assertion with no dir assertion |
| `scripts/hooks/rules/worker-ceiling-lock.mjs` | `L21` | Block a drive-by change to `workers:`/`retries:` in `playwright.config.*` |
| `scripts/hooks/rules/version-pin-floating.mjs` | `L52` | Block a new floating `latest` pin in a config file |
| `scripts/hooks/rules/locked-procedure.mjs` | `L78` | Warn on editing a locked measurement procedure/packet |
| `scripts/tests/seed-state.mjs` | — (test util) | Seeds a disposable enforcement-state store through the store's own write path |
| `tests/test_arc2_phase2_rules.py` | — | Catch + false-alarm tests, per rule |
| `tests/test_arc2_phase2_wiring.py` | — | Liveness (no env overrides), coverage-by-id, overhead vs 61ms |

Test seams (all pre-existing; none invented here): `ENFORCEMENT_STATE_PATH` (enforcement-state.mjs), `PRETOOLUSE_RULES_DIR` / `PRETOOLUSE_LOG_PATH` (pretooluse.mjs), `POSTTOOLUSE_OBSERVERS_DIR` (posttooluse.mjs), `DISCIPLINE` (fix-cycle-limit.mjs / gate-lessons.mjs), `SDD_DIR` / `SPECS_DIR` (session-state.mjs). The liveness test in Task 7 uses NONE of them.

---

### Task 1: the `file_read` evidence channel — `recentEvents()`, `read-tracker.mjs`, the `Read` matcher

**Files:**
- Modify: `scripts/hooks/lib/enforcement-state.mjs` (add `recentEvents()`)
- Create: `scripts/hooks/observers/read-tracker.mjs`
- Create: `scripts/tests/seed-state.mjs`
- Modify: `.claude/settings.json` (PostToolUse matcher only)
- Create: `tests/test_arc2_phase2_rules.py` (helpers + this task's tests)

**Interfaces:**
- Produces: `recentEvents(db, sessionId, kind, sinceTs, actorId)` → `[{ts, detail, actorId}]`, `[]` on any failure.
- Produces: `file_read` events with `detail = { filePath }`, one per successful `Read` tool call, actor-tagged.
- Produces: `node scripts/tests/seed-state.mjs attempts|event ...` for later tasks' state seeding.
- Consumed by: Tasks 2 and 3.

**Why `Read` joins the PostToolUse matcher rather than the rules scanning transcripts:** the two consumers (`L16`, `L56`) need "did THIS actor read file X, possibly hours ago." A transcript tail read is capped at 512KB and decays with session length; the store survives a compact (§6.2), is per-actor by construction, and costs one indexed SQLite query at rule time. The price is one hook spawn per `Read` call — the same ~61ms class every `Bash`/`Edit`/`Write` already pays — and Task 7 measures it rather than assuming it.

**Task DoD:** RED witnessed for both new tests · GREEN pasted · false-alarm run against a real failed-Read shape · `RULE_IDS = []` declared on the observer · matcher change verified live (step 6).

- [ ] **Step 1: Write the failing tests**

Create `tests/test_arc2_phase2_rules.py` with the shared helpers and this task's tests:

```python
# tests/test_arc2_phase2_rules.py — Arc 2 Phase 2: per-rule catch + false-alarm tests.
# Every test spawns the REAL CLI (pretooluse.mjs / posttooluse.mjs) as a subprocess with
# encoding="utf-8" (L74) and points ONLY the documented test seams at disposable files.
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_pretooluse(payload, env_extra=None, tmp_path=None):
    """Spawns the real PreToolUse entry point with `payload` on stdin. Returns the parsed
    hook-output JSON ({} = allow with nothing to say). Always redirects the log to a tmp file
    so tests never append to the repo's own .superpowers/hooks-log.jsonl."""
    env = {**os.environ, **(env_extra or {})}
    if tmp_path is not None and "PRETOOLUSE_LOG_PATH" not in env:
        env["PRETOOLUSE_LOG_PATH"] = str(tmp_path / "hooks-log.jsonl")
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, f"pretooluse.mjs must always exit 0:\n{r.stdout}\n{r.stderr}"
    return json.loads(r.stdout) if r.stdout.strip() else {}


def run_posttooluse(payload, env_extra=None, tmp_path=None):
    env = {**os.environ, **(env_extra or {})}
    if tmp_path is not None and "PRETOOLUSE_LOG_PATH" not in env:
        env["PRETOOLUSE_LOG_PATH"] = str(tmp_path / "hooks-log.jsonl")
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "posttooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env=env)
    assert r.returncode == 0, r.stdout + r.stderr
    return r


def decision_of(out):
    """Maps the hook-output JSON back to the pipeline vocabulary: deny -> block;
    allow + systemMessage -> warn; {} or plain allow -> allow."""
    h = out.get("hookSpecificOutput", {})
    if h.get("permissionDecision") == "deny":
        return "block"
    if h.get("permissionDecision") == "allow" and out.get("systemMessage"):
        return "warn"
    return "allow"


def reason_of(out):
    return out.get("hookSpecificOutput", {}).get("permissionDecisionReason", "") \
        or out.get("systemMessage", "")


def seed(state_path, *args):
    """Seeds a disposable enforcement-state store through the store's OWN write path."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "tests" / "seed-state.mjs"), *args],
                      capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                      env={**os.environ, "ENFORCEMENT_STATE_PATH": str(state_path)})
    assert r.returncode == 0, r.stdout + r.stderr


def payload(tool, file_path, *, content=None, old=None, new=None, session="s-phase2-test",
            agent=None, transcript=None):
    p = {"session_id": session, "hook_event_name": "PreToolUse", "tool_name": tool,
         "cwd": str(ROOT), "tool_input": {"file_path": str(file_path)}}
    if content is not None: p["tool_input"]["content"] = content
    if old is not None: p["tool_input"]["old_string"] = old
    if new is not None: p["tool_input"]["new_string"] = new
    if agent is not None: p["agent_id"] = agent
    if transcript is not None: p["transcript_path"] = str(transcript)
    return p


# ---------------------------------------------------------------- Task 1: file_read channel

def test_read_tracker_records_a_file_read_event(tmp_path):
    state = tmp_path / "state.sqlite"
    post = {"session_id": "s-read", "hook_event_name": "PostToolUse", "tool_name": "Read",
            "tool_input": {"file_path": str(ROOT / "docs" / "process" / "development-discipline.md")},
            "tool_response": {"interrupted": False}, "agent_id": "actor-a"}
    run_posttooluse(post, env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    q = subprocess.run(["node", "--input-type=module", "-e",
                        "import('file://" + str(ROOT / 'scripts/hooks/lib/enforcement-state.mjs').replace(os.sep, '/')
                        + "').then(m=>{const db=m.openState();"
                        + "console.log(JSON.stringify(m.recentEvents(db,'s-read','file_read',0)));db.close();})"],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                       env={**os.environ, "ENFORCEMENT_STATE_PATH": str(state)})
    rows = json.loads(q.stdout.strip())
    assert len(rows) == 1, q.stdout + q.stderr
    assert "development-discipline.md" in rows[0]["detail"]
    assert rows[0]["actorId"] == "actor-a"


def test_read_tracker_records_nothing_for_a_failed_read(tmp_path):
    """False-alarm side, against the REAL failure shape: PostToolUseFailure carries `error` and no
    tool_response (measured in posttooluse.mjs's own header). A Read that failed read nothing."""
    state = tmp_path / "state.sqlite"
    post = {"session_id": "s-read-f", "hook_event_name": "PostToolUseFailure", "tool_name": "Read",
            "tool_input": {"file_path": str(ROOT / "no-such-file.md")},
            "error": "File does not exist.", "is_interrupt": False}
    run_posttooluse(post, env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    q = subprocess.run(["node", "--input-type=module", "-e",
                        "import('file://" + str(ROOT / 'scripts/hooks/lib/enforcement-state.mjs').replace(os.sep, '/')
                        + "').then(m=>{const db=m.openState();"
                        + "console.log(JSON.stringify(m.recentEvents(db,'s-read-f','file_read',0)));db.close();})"],
                       capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
                       env={**os.environ, "ENFORCEMENT_STATE_PATH": str(state)})
    assert json.loads(q.stdout.strip()) == [], q.stdout
```

- [ ] **Step 2: Run and watch them fail**

Run: `py -3 -X utf8 -m pytest tests/test_arc2_phase2_rules.py -q`
Expected: FAIL — `recentEvents` is not exported and no `file_read` row is ever written (the observer does not exist). Paste the output.

- [ ] **Step 3: Add `recentEvents()` to `enforcement-state.mjs`**

Append after `eventCountSince()` (same fail-open shape as `openTargets()`; actor semantics identical to `lastEvent()` — omitted means unfiltered, passed means filtered to that normalized actor):

```javascript
// All events of `kind` for `sessionId` with ts >= sinceTs, newest first. [] on any failure —
// "could not read" and "nothing recorded" share the fail-open value here on purpose: every
// consumer (L16/L56, Phase 2) treats an empty list as "no evidence, do not block on absence you
// cannot distinguish from a broken channel" — see derived-artifact-source.mjs's channel probe.
// `actorId`: same three-way contract as lastEvent() above — omitted (undefined) = unfiltered,
// passed (including ''/null, the main-session identity) = filtered to that one normalized actor.
export function recentEvents(db, sessionId, kind, sinceTs, actorId) {
  if (!db || typeof sessionId !== 'string' || typeof kind !== 'string') return [];
  try {
    const since = Number.isFinite(sinceTs) ? sinceTs : 0;
    const rows = actorId === undefined
      ? db.prepare(
        'SELECT ts, detail, actor_id FROM events WHERE session_id = ? AND kind = ? AND ts >= ? ORDER BY ts DESC, id DESC'
      ).all(sessionId, kind, since)
      : db.prepare(
        'SELECT ts, detail, actor_id FROM events WHERE session_id = ? AND kind = ? AND ts >= ? AND actor_id = ? ORDER BY ts DESC, id DESC'
      ).all(sessionId, kind, since, normalizeActorId(actorId));
    return rows.map((r) => ({ ts: Number(r.ts), detail: r.detail ?? null, actorId: r.actor_id }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Write the observer**

```javascript
// scripts/hooks/observers/read-tracker.mjs — Arc 2 Phase 2, Task 1. Records ONE `file_read`
// event per successful Read tool call: the prior fact L16 and L56 exist to consult ("did THIS
// actor open the source document, or only remember it"). Every Read is recorded, not an
// allowlist — the channel doubles as its own liveness probe (a session with ANY file_read row
// proves the matcher+observer are wired, which is what lets L16 block on a targeted absence
// without ever mistaking an unwired channel for an unread document — the L57 trap, applied to
// ourselves). Volume is bounded by the store's own 24h TTL prune on every open.
//
// Only a REAL read counts: gated on `_outcome.ok === true` (posttooluse.mjs's normalized
// outcome) — a failed Read (missing file, permission error) read nothing and must not
// manufacture evidence that it did.
// RULE_IDS — an observer declares [] EXPLICITLY, so check-rule-coverage.mjs can require the
// export on every scanned file and catch a rule that forgot to declare rather than mistaking
// it for an observer.
export const RULE_IDS = [];

import { openState, recordEvent, normalizeActorId } from '../lib/enforcement-state.mjs';

export function observe(input) {
  if (!input || input.tool_name !== 'Read') return;
  if (!input._outcome || input._outcome.ok !== true) return; // a failed read read nothing

  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) return;
  const filePath = input.tool_input && input.tool_input.file_path;
  if (typeof filePath !== 'string' || !filePath) return;

  const db = openState();
  if (!db) return; // fail-open — no store, nothing recorded
  try {
    recordEvent(db, {
      sessionId,
      kind: 'file_read',
      detail: { filePath },
      actorId: normalizeActorId(input.agent_id),
    });
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
```

- [ ] **Step 5: Write the seeding utility**

```javascript
#!/usr/bin/env node
// scripts/tests/seed-state.mjs — test utility (Arc 2 Phase 2). Seeds a DISPOSABLE
// enforcement-state store (ENFORCEMENT_STATE_PATH must point at a tmp file — this script
// refuses to run without it, so it can never touch the live store by accident) through the
// store's OWN write path, never raw SQL — a seeded row must be a row the real observers could
// have written, or the test proves nothing about production behaviour.
//
//   node scripts/tests/seed-state.mjs attempts <sessionId> <actorId> <target> <n>
//       -> leaves fix_targets.attempts === n for (session, actor, target), via the real
//          failure->edit->failure cycle semantics (§6.1).
//   node scripts/tests/seed-state.mjs event <sessionId> <actorId> <kind> <filePath>
//       -> records one event of `kind` with detail {filePath}.
import {
  openState, noteVerificationFailure, noteEdit, recordEvent,
} from '../hooks/lib/enforcement-state.mjs';

if (!process.env.ENFORCEMENT_STATE_PATH) {
  console.error('seed-state: refusing to run without ENFORCEMENT_STATE_PATH (would touch the live store)');
  process.exit(2);
}
const [, , cmd, sessionId, actorId, ...rest] = process.argv;
const db = openState();
if (!db) { console.error('seed-state: openState() returned null'); process.exit(2); }

if (cmd === 'attempts') {
  const [target, nRaw] = rest;
  const n = Number(nRaw);
  // attempts increments only on a failure that FOLLOWS an edit (§6.1) — so: first failure
  // opens the row at attempts=0, then each (edit, failure) pair closes one cycle.
  noteVerificationFailure(db, sessionId, [target], actorId);
  for (let i = 0; i < n; i++) {
    noteEdit(db, sessionId, target, actorId);
    noteVerificationFailure(db, sessionId, [target], actorId);
  }
} else if (cmd === 'event') {
  const [kind, filePath] = rest;
  recordEvent(db, { sessionId, kind, detail: { filePath }, actorId });
} else {
  console.error(`seed-state: unknown command "${cmd}"`);
  process.exit(2);
}
db.close();
console.log('seeded');
```

- [ ] **Step 6: Extend the PostToolUse matcher and verify it LIVE**

In `.claude/settings.json`, change the `PostToolUse` matcher (and ONLY it — `PostToolUseFailure` stays as is: a failed Read proves nothing and needs no hook):

```json
"matcher": "Bash|Edit|Write|browser_navigate|Read"
```

Hook config hot-reloads on the next tool call (measured in posttooluse.mjs's own header). Verify live, per §3.4's lesson: perform one real `Read` tool call in the working session, then confirm a `file_read` row landed in the LIVE store:

```bash
node --input-type=module -e "import('./scripts/hooks/lib/enforcement-state.mjs').then(m=>{const db=m.openState();console.log(JSON.stringify(m.recentEvents(db,process.env.SID,'file_read',Date.now()-600000)));db.close();})"
```

(with `SID` set to the current session id from `.superpowers/hooks-log.jsonl`'s newest record). Paste the row. **If this step cannot be performed from a dispatched subagent's context, say so in the task report and hand the live verification to the controller — do not claim it.**

- [ ] **Step 7: Run the tests and watch them pass.** Paste output.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/lib/enforcement-state.mjs scripts/hooks/observers/read-tracker.mjs scripts/tests/seed-state.mjs .claude/settings.json tests/test_arc2_phase2_rules.py
git commit -m "feat(arc2 phase2, task 1): the file_read evidence channel - Read joins PostToolUse"
```

---

### Task 2: `derived-artifact-source.mjs` (`L16`) and `spec-read-before-implementation.mjs` (`L56`)

**Files:**
- Create: `scripts/hooks/rules/derived-artifact-source.mjs`
- Create: `scripts/hooks/rules/spec-read-before-implementation.mjs`
- Create: `scripts/hooks/lib/target-path.mjs`
- Modify: `tests/test_arc2_phase2_rules.py` (append)

**Interfaces:**
- Consumes: `recentEvents()` and the `file_read` channel from Task 1; `governingSpecFile()`/`activeArc()` from `scripts/session-state.mjs` (the same imports `brainstorm-before-creative.mjs` already uses — one definition of "active arc", not two).
- Produces: `target-path.mjs`, consumed by every later task.

**Why two files, not one:** same evidence channel, different scan targets (CLAUDE.md vs app.js/tests/**), different severities, different sources — a shared file would be two rules stapled at the import line.

**Task DoD:** RED witnessed · GREEN pasted · false-alarm vs the real tree · severity argued in each header · `RULE_IDS` declared · block message names the one-Read-call alternative.

- [ ] **Step 1: Write the failing tests (append)**

```python
# ---------------------------------------------------------------- Task 2: L16 + L56

DISCIPLINE = ROOT / "docs" / "process" / "development-discipline.md"


def test_L16_blocks_claude_md_edit_when_discipline_never_read(tmp_path):
    state = tmp_path / "state.sqlite"
    # Channel proven live: SOME file was read this session by SOME actor — just not the source.
    seed(state, "event", "s-l16", "actor-a", "file_read", str(ROOT / "app.js"))
    out = run_pretooluse(
        payload("Edit", ROOT / "CLAUDE.md", old="## Session start", new="## Session start (v2)",
                session="s-l16", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "development-discipline.md" in reason_of(out)   # the reachable alternative, by name


def test_L16_allows_claude_md_edit_after_the_source_was_read(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "event", "s-l16b", "actor-a", "file_read", str(DISCIPLINE))
    out = run_pretooluse(
        payload("Edit", ROOT / "CLAUDE.md", old="x", new="y", session="s-l16b", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L16_fails_open_when_the_channel_shows_no_traffic(tmp_path):
    """The L57 trap applied to ourselves: an EMPTY file_read channel cannot distinguish "the
    actor read nothing" from "the Read matcher is not wired." Absence of the channel is not
    evidence — allow, with the degradation named."""
    state = tmp_path / "state.sqlite"   # store exists after first open, but zero file_read rows
    out = run_pretooluse(
        payload("Edit", ROOT / "CLAUDE.md", old="x", new="y", session="s-l16c", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L16_does_not_fire_on_ordinary_real_files(tmp_path):
    """False-alarm vs the real tree: an app.js edit (the single most common real Edit target in
    this repo's history) must never be L16's business, whatever the channel says."""
    state = tmp_path / "state.sqlite"
    seed(state, "event", "s-l16d", "actor-a", "file_read", str(ROOT / "app.js"))
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="const a=1", new="const a=2",
                session="s-l16d", agent="actor-a"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert "derived-artifact-source" not in reason_of(out), out


def test_L56_warns_once_on_implementation_edit_without_reading_the_governing_spec(tmp_path):
    state = tmp_path / "state.sqlite"
    # A real arc fixture: SDD ledger + a governing spec file, via session-state.mjs's own seams.
    sdd = tmp_path / "sdd" / "some-plan"; sdd.mkdir(parents=True)
    (sdd / "progress.md").write_text("# progress\n", encoding="utf-8")
    specs = tmp_path / "specs"; specs.mkdir()
    spec = specs / "2026-08-09-arc2-enforcement-implementation-design.md"
    spec.write_text("# spec\n", encoding="utf-8")
    env = {"ENFORCEMENT_STATE_PATH": str(state), "SDD_DIR": str(tmp_path / "sdd"),
           "SPECS_DIR": str(specs)}
    seed(state, "event", "s-l56", "actor-a", "file_read", str(ROOT / "app.js"))  # channel live
    out = run_pretooluse(payload("Edit", ROOT / "app.js", old="a", new="b",
                                 session="s-l56", agent="actor-a"),
                         env_extra=env, tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert spec.name in reason_of(out)
    # And ONCE only — the second identical edit passes silently (the throttle event).
    out2 = run_pretooluse(payload("Edit", ROOT / "app.js", old="b", new="c",
                                  session="s-l56", agent="actor-a"),
                          env_extra=env, tmp_path=tmp_path)
    assert decision_of(out2) == "allow", out2


def test_L56_stays_quiet_when_the_spec_was_read(tmp_path):
    state = tmp_path / "state.sqlite"
    sdd = tmp_path / "sdd" / "some-plan"; sdd.mkdir(parents=True)
    (sdd / "progress.md").write_text("# progress\n", encoding="utf-8")
    specs = tmp_path / "specs"; specs.mkdir()
    spec = specs / "2026-08-09-arc2-enforcement-implementation-design.md"
    spec.write_text("# spec\n", encoding="utf-8")
    env = {"ENFORCEMENT_STATE_PATH": str(state), "SDD_DIR": str(tmp_path / "sdd"),
           "SPECS_DIR": str(specs)}
    seed(state, "event", "s-l56b", "actor-a", "file_read", str(spec))
    out = run_pretooluse(payload("Edit", ROOT / "app.js", old="a", new="b",
                                 session="s-l56b", agent="actor-a"),
                         env_extra=env, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
```

- [ ] **Step 2: Run and watch them fail** (the rules do not exist — every decision comes back allow / without the expected reason). Paste output.

- [ ] **Step 3: Write `target-path.mjs`**

```javascript
// scripts/hooks/lib/target-path.mjs — shared payload extraction for Edit|Write rules (Arc 2
// Phase 2). One place, because Phase 1's review found gates firing on a token ANYWHERE; the
// discipline here is that every rule asks (a) WHICH file (normPath) and (b) WHAT TEXT IS BEING
// ADDED (newContent — Write's full `content`, or Edit's `new_string`; never the old text, never
// the rest of the file unless a rule explicitly reads the disk and says why).
export function normPath(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/').toLowerCase() : '';
}

export function toolFilePath(input) {
  const p = input && input.tool_input && input.tool_input.file_path;
  return typeof p === 'string' && p ? p : null;
}

// The text this call ADDS: Write carries `content` (the whole new file), Edit carries
// `new_string` (only the replacement text). null when neither is a string — callers treat
// null as undecidable and fail open.
export function newContent(input) {
  const ti = input && input.tool_input;
  if (!ti) return null;
  if (typeof ti.content === 'string') return ti.content;
  if (typeof ti.new_string === 'string') return ti.new_string;
  return null;
}

export function oldContent(input) {
  const ti = input && input.tool_input;
  return ti && typeof ti.old_string === 'string' ? ti.old_string : null;
}
```

- [ ] **Step 4: Write `derived-artifact-source.mjs`**

```javascript
// scripts/hooks/rules/derived-artifact-source.mjs — L16: "a summary written from recollection is
// not the source." The documented failure: a CLAUDE.md was shipped that omitted §3 and §4 —
// the discipline's own self-described core — because it was written from memory of the source
// instead of from the source. The gate L16 itself states: "when writing anything that REPRESENTS
// a source document, open the source and work section by section through it."
//
// PAYLOAD POSITION (Phase-1 correction — where the construct actually lives): the TARGET PATH.
// This rule fires only when tool_input.file_path's basename is CLAUDE.md — the one derived
// artifact whose source mapping is unambiguous (docs/process/development-discipline.md, which
// CLAUDE.md's own header names as authoritative). Content is irrelevant: ANY edit to the
// derived artifact without the source open is the failure shape.
//
// SEVERITY: BLOCK. The harm is to substance — a wrong CLAUDE.md misleads every subagent in every
// future session (subagents inherit CLAUDE.md, not conversation memory). The alternative is
// reachable and costs ONE tool call: Read docs/process/development-discipline.md, then edit.
// No bypass exists — only that less-efficient-by-one-call path.
//
// THE L57 TRAP, APPLIED TO OURSELVES: an absence and a failure must never share an exit path.
// "No file_read row for the source" has two readings: the actor never read it, OR the Read
// matcher/observer channel is not wired (a pre-Task-1 session, a hook disabled). The POSITIVE
// marker that disambiguates: ANY file_read row for this session (any actor, any file) proves
// the channel carries traffic. Channel silent -> allow, degradation named. Channel live and the
// source absent from THIS actor's own reads -> that is a real, positively-evidenced absence -> block.
export const RULE_IDS = ['L16'];

import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openState, recentEvents, normalizeActorId } from '../lib/enforcement-state.mjs';
import { normPath, toolFilePath } from '../lib/target-path.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
// Same env seam fix-cycle-limit.mjs and gate-lessons.mjs already use for the same document.
function disciplineDocPath() {
  return process.env.DISCIPLINE || join(ROOT, 'docs', 'process', 'development-discipline.md');
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  if (!fp || basename(normPath(fp)) !== 'claude.md') {
    return { decision: 'allow', reason: 'not a derived artifact this rule maps to a source' };
  }
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return { decision: 'allow', reason: 'L16 degraded: no session_id on this call — allowing' };
  }

  const db = openState();
  if (!db) {
    return {
      decision: 'allow',
      reason: 'L16 degraded: enforcement state unreadable — a blocking rule that cannot read '
        + 'its own evidence must never block.',
    };
  }
  let all;
  try {
    all = recentEvents(db, sessionId, 'file_read', 0); // unfiltered: the channel-liveness probe
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }

  if (all.length === 0) {
    return {
      decision: 'allow',
      reason: 'L16 degraded: the file_read channel shows no traffic this session — cannot '
        + 'distinguish "nothing was read" from "the Read observer is not wired" (an absence and '
        + 'a failure must never share an exit path, L57). Allowing.',
    };
  }

  const actor = normalizeActorId(input.agent_id);
  const source = normPath(disciplineDocPath());
  const readIt = all.some((e) => {
    if (e.actorId !== actor) return false;
    try {
      const d = JSON.parse(e.detail);
      return normPath(d && d.filePath) === source;
    } catch { return false; }
  });
  if (readIt) {
    return { decision: 'allow', reason: 'L16: the source document was Read by this actor this session' };
  }
  return {
    decision: 'block',
    reason: 'L16 (a summary written from recollection is not the source — the shipped CLAUDE.md '
      + 'that omitted §3 and §4, the discipline\'s own core): you are editing CLAUDE.md, a DERIVED '
      + 'artifact, and this session shows no Read of its source, '
      + 'docs/process/development-discipline.md, by this actor. Blocked. The way through costs one '
      + 'tool call: Read the discipline document first, then make this edit working section by '
      + 'section from it — derived artifacts defer to their source, never to memory of it.',
  };
}
```

- [ ] **Step 5: Write `spec-read-before-implementation.mjs`**

```javascript
// scripts/hooks/rules/spec-read-before-implementation.mjs — L56: "I built a phase from my summary
// of the spec instead of from the spec." Phase 3 of the knowledge stack shipped missing eight
// written-down requirements — none disputed, none hard — because the summary was in front of the
// implementer and the spec was not. L56's own check: "before implementing from any spec, open the
// spec. Not the plan, not the summary."
//
// PAYLOAD POSITION: an Edit/Write whose target is an IMPLEMENTATION file — basename app.js, or a
// path under tests/ — while an arc is ACTIVE (session-state.mjs's activeArc(), the same single
// definition brainstorm-before-creative.mjs already imports) with a governing spec on disk
// (governingSpecFile(), ditto).
//
// SEVERITY: WARN, and the argument is precision, not harm. The harm L56 names is to substance
// (narrowing-by-forgetting), but the DETECTOR here is heuristic twice over: governingSpecFile()
// is "the newest spec file" (session-state.mjs's own stated approximation), and not every
// app.js/tests edit is spec-governed work (a hotfix, a flake investigation). A block on a
// heuristic match would manufacture false stops — the L70 failure mode, and the one outcome
// (§6 of the phase spec) that turns the whole pipeline into something people route around. The
// warn is also THROTTLED to once per actor per session per spec (a 'spec_read_nudge' event this
// rule writes for itself): the second and later edits pass silently, because a nudge repeated on
// every edit is noise, and noise trains people to stop reading reasons.
//
// FAIL-OPEN: no active arc / no spec file / unreadable state / silent file_read channel (same
// L57-trap probe as derived-artifact-source.mjs) all resolve to allow.
export const RULE_IDS = ['L56'];

import { basename } from 'node:path';
import {
  openState, recentEvents, recordEvent, normalizeActorId,
} from '../lib/enforcement-state.mjs';
import { normPath, toolFilePath } from '../lib/target-path.mjs';
import { activeArc, governingSpecFile } from '../../session-state.mjs';

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  const isImplementation = np && (basename(np) === 'app.js' || np.includes('/tests/'));
  if (!isImplementation) {
    return { decision: 'allow', reason: 'not an implementation file (app.js or tests/**)' };
  }
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return { decision: 'allow', reason: 'L56 degraded: no session_id — allowing' };
  }

  let arc = null;
  let spec = null;
  try {
    arc = activeArc();
    spec = governingSpecFile();
  } catch {
    return { decision: 'allow', reason: 'L56 degraded: could not determine the active arc — allowing' };
  }
  if (!arc || !spec) {
    return { decision: 'allow', reason: 'L56: no active arc / no governing spec on disk — not spec-governed work' };
  }

  const db = openState();
  if (!db) {
    return { decision: 'allow', reason: 'L56 degraded: enforcement state unreadable — allowing' };
  }
  try {
    const all = recentEvents(db, sessionId, 'file_read', 0);
    if (all.length === 0) {
      return {
        decision: 'allow',
        reason: 'L56 degraded: the file_read channel shows no traffic this session — cannot '
          + 'distinguish unread from unwired (L57). Allowing.',
      };
    }
    const actor = normalizeActorId(input.agent_id);
    const specNorm = normPath(String(spec));
    const readIt = all.some((e) => {
      if (e.actorId !== actor) return false;
      try {
        const d = JSON.parse(e.detail);
        return normPath(d && d.filePath) === specNorm;
      } catch { return false; }
    });
    if (readIt) {
      return { decision: 'allow', reason: 'L56: the governing spec was Read by this actor this session' };
    }
    // Throttle: one nudge per actor per session per spec — subsequent edits pass silently.
    const nudges = recentEvents(db, sessionId, 'spec_read_nudge', 0, actor);
    const alreadyNudged = nudges.some((e) => {
      try { return normPath(JSON.parse(e.detail)?.filePath) === specNorm; } catch { return false; }
    });
    if (alreadyNudged) {
      return { decision: 'allow', reason: 'L56: nudge already issued this session for this spec' };
    }
    recordEvent(db, { sessionId, kind: 'spec_read_nudge', detail: { filePath: String(spec) }, actorId: actor });
    return {
      decision: 'warn',
      reason: `L56 (narrowing by FORGETTING is still narrowing — §4): an arc is active and its `
        + `governing spec, ${basename(String(spec))}, has not been Read by this actor this session. `
        + 'Before implementing from any spec, open the spec — not the plan, not the summary, not '
        + 'the commit message that mentioned it. (This nudge fires once per session.)',
    };
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
}
```

- [ ] **Step 6: Run the tests and watch them pass.** Paste output. Note: the L56 tests set `SDD_DIR`/`SPECS_DIR` — **measured before this plan was written: `session-state.mjs` reads those env vars at MODULE LOAD** (`const SDD_DIR = process.env.SDD_DIR || ...`, line 38). Because each test spawns a fresh `node` process via the CLI, load-time reading is fine for these tests — but it means the rule CANNOT be tested by re-importing in one process with different env. If a test fails mysteriously here, this is the first thing to check.

- [ ] **Step 7: Commit**

```bash
git add scripts/hooks/lib/target-path.mjs scripts/hooks/rules/derived-artifact-source.mjs scripts/hooks/rules/spec-read-before-implementation.mjs tests/test_arc2_phase2_rules.py
git commit -m "feat(arc2 phase2, task 2): L16, L56 - the source open, not remembered"
```

---

### Task 3: `research-before-fix-cycle-3.mjs` (`10.14`) + `research-evidence.mjs`

**Files:**
- Create: `scripts/hooks/lib/research-evidence.mjs`
- Modify: `scripts/hooks/lib/geniza-consult.mjs` (export the existing `RETRIEVAL_PATTERN` — one place, no second copy)
- Create: `scripts/hooks/rules/research-before-fix-cycle-3.mjs`
- Modify: `tests/test_arc2_phase2_rules.py` (append)

**Interfaces:**
- Consumes: `openTargets()` (per-actor, exactly as `fix-cycle-limit.mjs` does), `resolveActorTranscriptPath()` from `skill-invoked.mjs`, `RETRIEVAL_PATTERN` from `geniza-consult.mjs`.
- Produces: `researchEvidenceSince(transcriptPath, agentId, sinceTs, nowMs)` → `{determined, researched}`.

**How this rule divides labour with the two neighbours it must not duplicate:** `debugging-before-fix-edit.mjs` fires on the FIRST failure (invoke systematic-debugging); `fix-cycle-limit.mjs` BLOCKS the 4th cycle (owner decision). `10.14` is the documented hand-off BETWEEN them: "after a few iterations that did not solve it, STOP guessing and do deep research." Concretely: when a target has closed **2** failed fix cycles, the edit that would begin cycle #3 must be preceded by research evidence — a geniza retrieval call, a `WebSearch`, or a `WebFetch` in THIS actor's transcript since that target's last failure.

**Task DoD:** RED witnessed · GREEN pasted · false-alarm seeded through the store's real write path + a transcript carrying a REAL retrieval line · severity argued · `RULE_IDS` declared.

- [ ] **Step 1: Write the failing tests (append)**

```python
# ---------------------------------------------------------------- Task 3: 10.14

def transcript_with(tmp_path, blocks, ts=None):
    """Writes a minimal-but-real-shaped transcript JSONL (the shape measured in
    skill-invoked.mjs's own header) containing the given content blocks."""
    import datetime
    ts = ts or datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    line = {"type": "assistant", "timestamp": ts, "message": {"content": blocks}}
    p = tmp_path / "transcript.jsonl"
    p.write_text(json.dumps(line) + "\n", encoding="utf-8")
    return p


def test_1014_warns_on_third_fix_cycle_without_research(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014", "actor-a", "tests/foo.spec.ts", "2")
    t = transcript_with(tmp_path, [{"type": "text", "text": "just thinking"}])
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014",
                agent="actor-a", transcript=t),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "10.14" in reason_of(out) and "geniza" in reason_of(out).lower()


def test_1014_stays_quiet_when_research_happened(tmp_path):
    """False-alarm side: the retrieval command in the transcript is the REAL call shape from
    CLAUDE.md's own documented API — retrieval.search_current_docs — not an invented token."""
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014b", "actor-a", "tests/foo.spec.ts", "2")
    t = transcript_with(tmp_path, [{"type": "tool_use", "name": "Bash", "input": {
        "command": "py -3 -c \"from src.knowledge import retrieval; "
                   "print(retrieval.search_current_docs('playwright webServer timeout'))\""}}])
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014b",
                agent="actor-a", transcript=t),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_1014_stays_quiet_below_two_cycles(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014c", "actor-a", "tests/foo.spec.ts", "1")
    t = transcript_with(tmp_path, [{"type": "text", "text": "nothing"}])
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014c",
                agent="actor-a", transcript=t),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_1014_fails_open_on_unreadable_transcript(tmp_path):
    state = tmp_path / "state.sqlite"
    seed(state, "attempts", "s-1014d", "actor-a", "tests/foo.spec.ts", "2")
    out = run_pretooluse(
        payload("Edit", ROOT / "app.js", old="a", new="b", session="s-1014d",
                agent="actor-a", transcript=tmp_path / "no-such.jsonl"),
        env_extra={"ENFORCEMENT_STATE_PATH": str(state)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
```

- [ ] **Step 2: Run and watch them fail.** Paste output.

- [ ] **Step 3: Export `RETRIEVAL_PATTERN` and write `research-evidence.mjs`**

In `geniza-consult.mjs`, change `const RETRIEVAL_PATTERN = ...` to `export const RETRIEVAL_PATTERN = ...` (nothing else — behaviour-preserving; the existing group-A tests are the regression net, re-run them in step 5).

```javascript
// scripts/hooks/lib/research-evidence.mjs — §10.14's evidence source: "did documented research
// happen in THIS actor's transcript since instant T". Cloned in structure from skill-invoked.mjs
// (same tail read, same fail-to-determined:false contract, same sidechain resolution for
// dispatched subagents) — differs only in WHAT counts as evidence:
//   - a Bash tool_use whose command matches geniza-consult.mjs's own RETRIEVAL_PATTERN
//     (imported, never re-implemented — one classifier, one place), or
//   - a WebSearch / WebFetch tool_use (the §10.11 order: geniza first, then the web — either is
//     research; ranking their order is the geniza-fallback rule's job, not this one's).
// FAIL DIRECTION: any inability to read/parse resolves to determined:false; the caller must not
// warn on that. Only a positively-read transcript with no research inside the window resolves to
// determined:true, researched:false.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { RETRIEVAL_PATTERN } from './geniza-consult.mjs';
import { resolveActorTranscriptPath } from './skill-invoked.mjs';

const MAX_TAIL_BYTES = 512 * 1024;

function readTail(path, maxBytes) {
  const size = statSync(path).size;
  if (size <= maxBytes) return readFileSync(path, 'utf8');
  const full = readFileSync(path, 'utf8');
  return full.length > maxBytes ? full.slice(full.length - maxBytes) : full;
}

export function researchEvidenceSince(transcriptPath, agentId, sinceTs, nowMs = Date.now()) {
  const effectivePath = resolveActorTranscriptPath(transcriptPath, agentId);
  if (typeof effectivePath !== 'string' || effectivePath === '' || !existsSync(effectivePath)) {
    return { determined: false, researched: false };
  }
  let text;
  try {
    text = readTail(effectivePath, MAX_TAIL_BYTES);
  } catch {
    return { determined: false, researched: false };
  }
  const since = Number.isFinite(sinceTs) ? sinceTs : 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let entry;
    try { entry = JSON.parse(trimmed); } catch { continue; }
    const ts = Date.parse(entry && entry.timestamp);
    if (!Number.isFinite(ts) || ts < since || ts > nowMs) continue;
    const content = entry && entry.message && entry.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue;
      if (block.name === 'WebSearch' || block.name === 'WebFetch') {
        return { determined: true, researched: true };
      }
      if (block.name === 'Bash') {
        const command = block.input && block.input.command;
        if (typeof command === 'string' && RETRIEVAL_PATTERN.test(command)) {
          return { determined: true, researched: true };
        }
      }
    }
  }
  return { determined: true, researched: false };
}
```

- [ ] **Step 4: Write the rule**

```javascript
// scripts/hooks/rules/research-before-fix-cycle-3.mjs — §10.14: "when a problem is genuinely
// complex, OR after a few iterations that did not solve it, STOP guessing and do deep research."
// This is the documented hand-off point BETWEEN two rules that already exist: trigger 2
// (debugging-before-fix-edit.mjs) forces systematic-debugging after the FIRST failure, and §5
// (fix-cycle-limit.mjs) BLOCKS the 4th cycle behind an owner decision. §10.14 owns the gap in
// the middle: a target that has closed TWO failed fix cycles is, in the rule's own words, "a few
// iterations that did not solve it" — the next edit that begins cycle #3 should be preceded by
// research (geniza first, per §10.11, then the web), not by guess #3.
//
// SEVERITY: WARN, argued: the harm of skipping research at cycle 3 is to EFFICIENCY — burned
// iterations, the exact currency §10.14 was written to stop spending ("a careful read of
// Playwright's docs would have short-circuited many iterations of guess-and-kill"). The
// SUBSTANCE stop already exists one cycle later as fix-cycle-limit.mjs's block; duplicating a
// block here would make two rules fight over one interception point. A warn that names the
// geniza's own corpora is the §10.14 escalation made visible at the moment it applies.
//
// STATE READ (group B): fix_targets.attempts / last_failure_ts per (session, actor, target) —
// written by observers/verification-outcomes.mjs via noteVerificationFailure(), the same rows
// fix-cycle-limit.mjs reads; this rule adds no write of its own.
export const RULE_IDS = ['10.14'];

// Exported so a future announcer can render the same number this rule warns on (the
// ATTEMPT_THRESHOLD precedent in fix-cycle-limit.mjs).
export const RESEARCH_THRESHOLD = 2;

import { openState, openTargets, normalizeActorId } from '../lib/enforcement-state.mjs';
import { researchEvidenceSince } from '../lib/research-evidence.mjs';

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !sessionId) {
    return { decision: 'allow', reason: '10.14 degraded: no session_id — allowing' };
  }
  const actorId = normalizeActorId(input.agent_id);
  const db = openState();
  if (!db) {
    return { decision: 'allow', reason: '10.14 degraded: enforcement state unreadable — allowing' };
  }
  let targets;
  try {
    targets = openTargets(db, sessionId, actorId);
  } finally {
    try { db.close(); } catch { /* best-effort */ }
  }
  // Exactly RESEARCH_THRESHOLD: at 3+, fix-cycle-limit.mjs's block owns the interception, and a
  // warn underneath a block would be noise on top of a wall.
  const hot = targets.filter((t) => t.attempts === RESEARCH_THRESHOLD);
  if (hot.length === 0) {
    return { decision: 'allow', reason: 'no open fix target at the §10.14 research threshold' };
  }
  const oldest = Math.min(...hot.map((t) => t.lastFailureTs));
  let evidence;
  try {
    evidence = researchEvidenceSince(input.transcript_path, input.agent_id, oldest);
  } catch {
    evidence = { determined: false, researched: false };
  }
  if (!evidence.determined) {
    return {
      decision: 'allow',
      reason: '10.14 degraded: no readable transcript evidence either way — allowing rather than '
        + 'warning on an absence this rule cannot verify.',
    };
  }
  if (evidence.researched) {
    return { decision: 'allow', reason: '10.14: research evidence found in this actor\'s transcript since the last failure' };
  }
  const names = hot.map((t) => `"${t.target}"`).join(', ');
  return {
    decision: 'warn',
    reason: `§10.14 (owner instruction, 2026-07-23 — written after a worker-flake debug burned many `
      + `iterations that one careful docs read would have short-circuited): target(s) ${names} `
      + `already closed ${RESEARCH_THRESHOLD} failed fix cycles, and no research has happened since `
      + 'the last failure. STOP guessing before cycle #3: query the geniza first (§10.11 — '
      + 'retrieval.search_current_docs / semantic_search; its tool_spec corpora include '
      + 'playwright-official-docs, nodejs-v8-docs and seven more), then the official docs and issue '
      + 'trackers on the web, then converge. One more unresearched cycle from here meets '
      + 'fix-cycle-limit\'s hard block at #4.',
  };
}
```

- [ ] **Step 5: Run the new tests AND the existing hook suites** (`node scripts/tests/test-hooks-groupa.mjs`, `node scripts/tests/test-hooks-groupb.mjs`) — the `RETRIEVAL_PATTERN` export change must leave both green. Paste all three outputs.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/lib/geniza-consult.mjs scripts/hooks/lib/research-evidence.mjs scripts/hooks/rules/research-before-fix-cycle-3.mjs tests/test_arc2_phase2_rules.py
git commit -m "feat(arc2 phase2, task 3): 10.14 - research, not guess #3"
```

---

### Task 4: `one-pipeline.mjs` (`12.1` + `2`) and the `check-plan-complete.mjs` refactor

**Files:**
- Modify: `scripts/check-plan-complete.mjs` (extract `checkPlanText()`, CLI unchanged)
- Create: `scripts/hooks/rules/one-pipeline.mjs`
- Modify: `tests/test_arc2_phase2_rules.py` (append)

**Interfaces:**
- Produces: `export function checkPlanText(text, minBlocks = 1)` → `{ tasks, failures: [string] }`.
- Consumes: `target-path.mjs`.

**Why these two rules share one file:** both fire purely on the pipeline's own artifacts — WHERE a process file lands (`12.1`) and WHAT SHAPE a plan has (`2`). One scan of `tool_input.file_path` serves both branches; splitting them would run the same path classification twice per Edit/Write.

**Division of labour with `brainstorm-before-creative.mjs` (stated so a reviewer does not have to reconstruct it):** that rule (RULE_IDS `['1']`) already enforces rule 2's APPROVAL edges — no spec/plan write without brainstorming/writing-plans or a matching approved register row. This file enforces rule 2's remaining Edit|Write substance: the plan-completeness gate that rule 2's own text names (`check-plan-complete.mjs` — L27, the silent CP2 truncation), applied at write time. Rule `12.1` (GSD not adopted) has no owner at all today.

**RED against the old behaviour (Phase-1 correction):** the refactor moves live logic. Before touching it, run `node scripts/check-plan-complete.mjs docs/superpowers/plans/2026-08-09-arc2-phase1-ci-gate.md` and record exit code + output; after the refactor, run the identical command and diff — byte-identical output and exit code required.

**Task DoD:** RED witnessed · GREEN pasted · false-alarm vs every real tracked `.md` path AND every real plan file's own content · severity argued per branch · `RULE_IDS` declared · CLI regression diffed.

- [ ] **Step 1: Write the failing tests (append)**

```python
# ---------------------------------------------------------------- Task 4: 12.1 + 2

def test_121_blocks_a_gsd_artifact(tmp_path):
    out = run_pretooluse(payload("Write", ROOT / "PLAN.md", content="# plan\n"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "docs/superpowers/plans" in reason_of(out)   # the reachable alternative, by name


def test_121_blocks_a_gsd_command_file(tmp_path):
    out = run_pretooluse(payload("Write", ROOT / ".claude" / "commands" / "gsd-plan.md",
                                 content="x"), tmp_path=tmp_path)
    assert decision_of(out) == "block", out


def test_121_does_not_fire_on_any_real_tracked_path(tmp_path):
    """False-alarm vs the REAL tree: every tracked .md path replayed as a Write. The tree holds
    docs/vendor/gsd/gsd-docs-01.md (a record of the REJECTED tool — writing ABOUT it is not
    adopting it) and docs/research/2026-08-04-bmad-gsd-testing-methodology.md; both must pass."""
    tracked = subprocess.run(["git", "ls-files", "*.md"], capture_output=True, text=True,
                             encoding="utf-8", cwd=str(ROOT)).stdout.splitlines()
    assert tracked, "git ls-files returned nothing — the false-alarm test examined NOTHING"
    fired = []
    for rel in tracked:
        out = run_pretooluse(payload("Write", ROOT / rel, content="x"), tmp_path=tmp_path)
        if "one-pipeline" in reason_of(out) and decision_of(out) == "block":
            fired.append(rel)
    assert fired == [], f"12.1 fires on real tracked paths: {fired}"


def test_2_warns_on_an_incomplete_plan_write(tmp_path):
    truncated = "# plan\n## Task 1: do the thing\nprose only, no code\n```js\nunclosed fence\n"
    out = run_pretooluse(payload("Write", ROOT / "docs" / "superpowers" / "plans" / "x-test-plan.md",
                                 content=truncated), tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "check-plan-complete" in reason_of(out)


def test_2_stays_quiet_on_every_real_plan(tmp_path):
    """False-alarm vs REAL history: every plan actually in the tree, replayed through the same
    Write path. (Guarded against examining nothing.)"""
    plans = sorted((ROOT / "docs" / "superpowers" / "plans").glob("*.md"))
    assert plans, "no real plans found — the false-alarm test examined NOTHING"
    for p in plans:
        out = run_pretooluse(payload("Write", p, content=p.read_text(encoding="utf-8")),
                             tmp_path=tmp_path)
        assert decision_of(out) == "allow", f"rule 2 fires on real plan {p.name}: {reason_of(out)}"


def test_2_allows_a_partial_edit_to_a_plan(tmp_path):
    """An Edit's new_string is a FRAGMENT — completeness of a fragment is undecidable, and
    undecidable means allow with the reason named, never a guess."""
    out = run_pretooluse(payload("Edit", ROOT / "docs" / "superpowers" / "plans" / "x.md",
                                 old="a", new="- [ ] step"), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
```

⚠️ **Before running:** `test_2_stays_quiet_on_every_real_plan` replays every real plan through `checkPlanText`. If a REAL, historical plan fails the completeness shape (e.g. a legacy plan without `## Task N` headings), that is a FINDING to report, and the rule must then scope to what the gate has always demanded (`check-plan-complete.mjs` has required `## Task N` headings since L27) — resolve by reporting, never by silently exempting the failing file.

- [ ] **Step 2: Record the CLI baseline, then run the tests and watch them fail.** Paste both.

- [ ] **Step 3: Refactor `check-plan-complete.mjs`**

Restructure to (logic byte-for-byte identical — only moved into the function):

```javascript
#!/usr/bin/env node
// scripts/check-plan-complete.mjs — mechanical plan-completeness gate (Phase 0, audit fix #5; lesson L27).
// A generated plan is never submitted to review before this exits 0 (discipline §2).
// Detects the CP2 failure shape: tasks with zero fenced code blocks, and a file truncated inside a fence.
// Usage: node scripts/check-plan-complete.mjs <plan.md> [--min-blocks N]
//
// Arc 2 Phase 2 (Task 4): the scan body is now exported as checkPlanText() so the Edit|Write
// hook rule (one-pipeline.mjs, rule 2) applies the SAME check to a plan's content at write time
// — one detector, two call sites, zero drift. CLI behaviour is unchanged (diffed against the
// pre-refactor output on a real plan as this task's regression evidence).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkPlanText(text, MIN = 1) {
  const lines = text.split(/\r?\n/);
  const FENCE = /^[ \t]*```/;            // fences may be indented (the rejected CP2 draft indents them)
  const TASK = /^#{2,3}\s+Task\s+\d+/;   // "## Task N" or "### Task N"

  const tasks = [];
  let cur = null, fenceOpen = false, totalFences = 0;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      totalFences++; fenceOpen = !fenceOpen;
      if (fenceOpen && cur) cur.blocks++;
      continue;
    }
    if (!fenceOpen && TASK.test(lines[i])) {
      cur = { title: lines[i].trim(), line: i + 1, blocks: 0 };
      tasks.push(cur);
    }
  }

  const failures = [];
  if (tasks.length === 0) failures.push('no "## Task N" headings found — not a plan, or headings malformed');
  if (fenceOpen || totalFences % 2 === 1) failures.push('file ENDS INSIDE a code fence — truncation signature');
  for (const t of tasks) if (t.blocks < MIN)
    failures.push(`line ${t.line}: "${t.title.slice(0, 70)}" — ${t.blocks} code block(s) < ${MIN} (prose-only task = the CP2 truncation shape)`);
  return { tasks, failures };
}
```

then the CLI body (the existing arg parsing, `readFileSync`, the same success/failure printing driven by `checkPlanText()`'s return, same exit codes), guarded exactly as `posttooluse.mjs` guards its own `main()`:

```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  // ... existing CLI body, now calling checkPlanText(text, MIN) ...
}
```

Keep the CLI's printed strings character-identical to the pre-refactor version. Re-run the baseline command and paste the diff (empty).

- [ ] **Step 4: Write the rule**

```javascript
// scripts/hooks/rules/one-pipeline.mjs — 12.1 ("one process, or none") + rule 2's write-time
// completeness check (L27, the silent CP2 truncation).
//
// BRANCH 12.1 — SEVERITY: BLOCK. Importing GSD's artifact machinery (PLAN.md / SUMMARY.md /
// VERIFICATION.md at a directory root, /gsd-* command files, a .gsd/ tree) creates "the same
// subject specified twice, neither document citing the other" — the exact defect the knowledge
// graph found four instances of in this corpus. That is harm to substance. The alternative is
// named and always reachable: the superpowers pipeline's own homes (docs/superpowers/specs/,
// docs/superpowers/plans/, .superpowers/sdd/). EXEMPTION, measured against the real tree before
// this file was written: docs/vendor/** — the tree legitimately holds docs/vendor/gsd/
// gsd-docs-01.md, the RECORD of the rejected tool. Writing ABOUT the rejected process is a
// record; adopting its artifacts is the violation. (Phase-1 correction: scope to where the
// construct lives — the artifact path shape — not to where the word "gsd" appears.)
//
// BRANCH 2 — SEVERITY: WARN, argued: a plan is legitimately authored in stages (skeleton Write,
// task-by-task Edits), so an incomplete content at SOME Write is ordinary work, and the BINDING
// gate remains rule 2's own named one — check-plan-complete.mjs exits 0 before review. The warn
// surfaces the CP2 truncation shape at the moment it is written instead of at review; the harm
// of a late catch is efficiency (a review round), not substance. Edits pass undecided
// (a fragment's completeness is undecidable — fail open, reason named).
export const RULE_IDS = ['12.1', '2'];

import { basename } from 'node:path';
import { normPath, toolFilePath, newContent } from '../lib/target-path.mjs';
import { checkPlanText } from '../../check-plan-complete.mjs';

const GSD_BASENAME = /^(plan|summary|verification)\.md$/;
const GSD_NAME = /^gsd-|^\.gsd$/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  if (!fp) {
    return { decision: 'allow', reason: 'one-pipeline degraded: no file_path on this call — allowing' };
  }
  const np = normPath(fp);
  const segments = np.split('/');
  const base = segments[segments.length - 1];

  // ---- 12.1: GSD artifact shapes, anywhere except the vendor record.
  if (!np.includes('/docs/vendor/')) {
    const gsdHit = GSD_BASENAME.test(base) || segments.some((s) => GSD_NAME.test(s));
    if (gsdHit) {
      return {
        decision: 'block',
        reason: '12.1 (one process, or none): GSD\'s workflow artifacts (PLAN.md / SUMMARY.md / '
          + 'VERIFICATION.md, gsd-* commands, .gsd/ trees) are NOT adopted — a second, competing '
          + 'process is the "same subject specified twice, neither citing the other" defect the '
          + 'knowledge graph found four times in this very corpus. Blocked. The same work has a '
          + 'home in the one adopted pipeline: specs go to docs/superpowers/specs/, plans to '
          + 'docs/superpowers/plans/ (writing-plans skill), execution ledgers to .superpowers/sdd/. '
          + 'Writing ABOUT GSD (a record/analysis) belongs under docs/vendor/ or docs/research/, '
          + 'which this rule does not touch.',
      };
    }
  }

  // ---- rule 2: plan completeness at Write time.
  if (np.includes('/docs/superpowers/plans/') && base.endsWith('.md')) {
    if (input.tool_name !== 'Write') {
      return {
        decision: 'allow',
        reason: 'rule 2: an Edit\'s new_string is a fragment — completeness undecidable on a '
          + 'fragment, allowing (the binding gate stays check-plan-complete.mjs before review).',
      };
    }
    const content = newContent(input);
    if (typeof content !== 'string') {
      return { decision: 'allow', reason: 'rule 2 degraded: Write carries no string content — allowing' };
    }
    let result;
    try {
      result = checkPlanText(content);
    } catch {
      return { decision: 'allow', reason: 'rule 2 degraded: checkPlanText threw — allowing' };
    }
    if (result.failures.length > 0) {
      return {
        decision: 'warn',
        reason: `rule 2 / L27 (the CP2 silent truncation): this plan Write fails the completeness `
          + `gate — ${result.failures.join(' · ')}. Fine if you are still assembling it, but a `
          + 'plan is never submitted to review before `node scripts/check-plan-complete.mjs '
          + `<plan.md>\` exits 0, and large plans are assembled mechanically (file concatenation), `
          + 'never by LLM concatenation.',
      };
    }
    return { decision: 'allow', reason: 'rule 2: plan Write passes the completeness shape' };
  }

  return { decision: 'allow', reason: 'not a pipeline artifact path' };
}
```

- [ ] **Step 5: Run the tests and watch them pass.** Paste output, including the empty CLI diff.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-plan-complete.mjs scripts/hooks/rules/one-pipeline.mjs tests/test_arc2_phase2_rules.py
git commit -m "feat(arc2 phase2, task 4): 12.1, 2 - one pipeline, and its plans complete at write time"
```

---

### Task 5: `test-honesty.mjs` (`L9` + `L57`) and `bidi-ltr-island.mjs` (`L13`)

**Files:**
- Create: `scripts/hooks/rules/test-honesty.mjs`
- Create: `scripts/hooks/rules/bidi-ltr-island.mjs`
- Modify: `tests/test_arc2_phase2_rules.py` (append)

**Why `L9`+`L57` share a file:** both scan the SAME target (content written into `tests/**`) for a test that lies about what it checked. `L13` is its own file: its primary target is `app.js`/`app.css` (island removal), with a secondary test-side branch.

**Measured before this plan was written (the numbers that killed the naive patterns — do not re-litigate them, they are why the patterns below look the way they do):**
- 9 real spec files use `page.clock`; six of them contain 47 `new Date(` occurrences — nearly all `new Date('2026-...')` fixed literals or page-side text inside `page.evaluate` template strings. A rule firing on `new Date(` per se would false-alarm on the real tree immediately. The dangerous shape L9 actually names — Node-side wall time **in an assertion** — was measured at **zero** occurrences in the real tree (`expect(...new Date()` / `expect(...Date.now()`), so THAT is the pattern.
- `app.js` history since June carries **4,382** added lines with ≥/≤ and no `dir=` on the same line (bulk data/translation work; dir handling lives in render wrappers, not on the string-building line). NO per-line ≥/≤-near-Hebrew pattern can reach the phase's 0-false-alarm bar. L13's enforceable halves are therefore: (a) an Edit that REMOVES an existing `dir="ltr"` while keeping the ≥/≤ content — precise, diff-anchored; (b) the rule's own second clause, "guard with a dir assertion": a NEW test assertion on ≥/≤ text with no dir assertion anywhere in the touched content. The rest of L13's surface stays owned by DoD-8/9 (screenshot, actually looked at) — named as a gap, not hidden.

**Task DoD:** RED witnessed · GREEN pasted · false-alarm vs the real `tests/` tree (full replay) · severities argued per branch · `RULE_IDS` declared.

- [ ] **Step 1: Write the failing tests (append)**

```python
# ---------------------------------------------------------------- Task 5: L9 + L57 + L13

def test_L9_warns_on_wall_clock_assertion_under_page_clock(tmp_path):
    new = ("await page.clock.setFixedTime(new Date('2026-07-15T12:00:00'));\n"
           "expect(banner).toContainText(new Date().toLocaleDateString());\n")
    out = run_pretooluse(payload("Write", ROOT / "tests" / "x-l9.spec.ts", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "warn", out
    assert "page.clock" in reason_of(out)


def test_L57_blocks_broad_except_skip(tmp_path):
    new = ("def _stack():\n"
           "    try:\n"
           "        ingest()\n"
           "    except Exception:\n"
           "        pytest.skip('stack unavailable')\n")
    out = run_pretooluse(payload("Write", ROOT / "tests" / "test_x_l57.py", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "SKIPPED" in reason_of(out) or "skip" in reason_of(out)


def test_L57_allows_a_named_connection_shaped_skip(tmp_path):
    new = ("try:\n"
           "    ingest()\n"
           "except ConnectionError:\n"
           "    pytest.skip('postgres not reachable')\n")
    out = run_pretooluse(payload("Write", ROOT / "tests" / "test_x_l57b.py", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_honesty_rules_do_not_fire_on_the_real_test_tree(tmp_path):
    """False-alarm vs the REAL tree: every real spec/py test file's own content replayed as a
    Write. This is the measurement above, mechanized — 47 real new Date( uses under page.clock
    must all pass."""
    files = sorted(list((ROOT / "tests").glob("*.spec.ts")) + list((ROOT / "tests").glob("*.py")))
    assert files, "no test files found — the false-alarm test examined NOTHING"
    fired = []
    for f in files:
        out = run_pretooluse(payload("Write", f, content=f.read_text(encoding="utf-8")),
                             tmp_path=tmp_path)
        if decision_of(out) != "allow":
            fired.append((f.name, reason_of(out)[:120]))
    assert fired == [], f"fires on healthy real tests: {fired}"


def test_L13_blocks_removing_an_ltr_island(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "app.js",
        old='<span dir="ltr">≥54°C</span>',
        new='<span>≥54°C</span>'), tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "dir=" in reason_of(out)


def test_L13_allows_an_edit_that_keeps_the_island(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "app.js",
        old='<span dir="ltr">≥54°C</span>',
        new='<span dir="ltr">≥55°C</span>'), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L13_warns_on_a_geq_text_assertion_without_dir_assertion(tmp_path):
    new = "await expect(row).toContainText('≥54');\n"
    out = run_pretooluse(payload("Write", ROOT / "tests" / "x-l13.spec.ts", content=new),
                         tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L13_does_not_fire_on_real_recent_app_js_history(tmp_path):
    """False-alarm vs REAL HISTORY: the ≥/≤ lines actually added to app.js since June (measured:
    4,382 of them) replayed as Edit new_strings with a neutral old_string. None may fire — the
    island-removal branch requires dir= present in the OLD text, which these did not have."""
    log = subprocess.run(["git", "log", "--since=2026-06-01", "-p", "--", "app.js"],
                         capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT)).stdout
    added = [ln[1:] for ln in log.splitlines()
             if ln.startswith("+") and not ln.startswith("+++") and ("≥" in ln or "≤" in ln)]
    assert added, "no real history lines found — the false-alarm test examined NOTHING"
    fired = []
    for line in added[:400]:   # a representative slab; the pattern is per-line, more adds no shape
        out = run_pretooluse(payload("Edit", ROOT / "app.js", old="// x", new=line),
                             tmp_path=tmp_path)
        if "bidi-ltr-island" in reason_of(out) and decision_of(out) != "allow":
            fired.append(line[:100])
    assert fired == [], f"L13 fires on real historical app.js additions: {fired[:5]}"
```

- [ ] **Step 2: Run and watch them fail.** Paste output.

- [ ] **Step 3: Write `test-honesty.mjs`**

```javascript
// scripts/hooks/rules/test-honesty.mjs — L9 + L57: two ways a test lies about what it checked,
// both living in the SAME payload position (content being written into tests/**), hence one file.
//
// L9 — SEVERITY: WARN, argued: the harm (an assertion comparing a pinned page clock against real
// Node wall time — green until midnight, red after) is to substance, but the DETECTOR is
// heuristic: it cannot prove which side of the page boundary a given expression runs on. Measured
// against the real tree before writing this: the precise shape (expect( + new Date()/Date.now()
// in one statement, in a file that pins page.clock) occurs ZERO times in healthy work, while any
// looser shape fires on 47 legitimate uses. Warn on the precise shape; a block on a heuristic
// would be the L70 failure.
//
// L57 — SEVERITY: BLOCK, argued: "an absence and a failure are different results and must never
// share an exit path." except Exception:/bare except: feeding a skip() turned four real tests
// green-ish while a genuine SchemaViolation hid inside the skip — harm to substance, and the
// alternative is named and cheap: skip only on the CONNECTION-SHAPED exception types the excuse
// is actually about (a positive marker list), fail on everything else.
export const RULE_IDS = ['L9', 'L57'];

import { readFileSync } from 'node:fs';
import { normPath, toolFilePath, newContent } from '../lib/target-path.mjs';

const CLOCK = /page\.clock\./;
// One statement mixing expect() with Node-side wall time: new Date() with NO argument, or
// Date.now(). new Date('2026-...') literals and anything inside page.evaluate template strings
// do not match (measured: that is what keeps the 47 real uses quiet).
const WALL_ASSERT = /expect\s*\([^;\n]*\b(new Date\(\s*\)|Date\.now\(\))/;
// A python except that catches everything (bare, Exception, BaseException) whose block reaches a
// skip() within the next few lines.
const BROAD_EXCEPT_SKIP = /except(\s*\(?\s*(Exception|BaseException)\s*\)?)?\s*(as\s+\w+\s*)?:\s*\n(?:[ \t]*(?:#[^\n]*)?\n)*[ \t]+(?:pytest\.)?skip\(/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  if (!np || !np.includes('/tests/')) {
    return { decision: 'allow', reason: 'not a test file' };
  }
  const added = newContent(input);
  if (typeof added !== 'string') {
    return { decision: 'allow', reason: 'test-honesty degraded: no added content on this call — allowing' };
  }

  // ---- L57 (python test files): the broad-except-skip shape.
  if (np.endsWith('.py') && BROAD_EXCEPT_SKIP.test(added)) {
    return {
      decision: 'block',
      reason: 'L57 (2026-08-05 — four tests went green-ish while a real SchemaViolation hid '
        + 'inside a skip): an `except Exception`/bare `except` feeding skip() makes an absence '
        + 'and a failure share one exit path, and SKIPPED standing in for FAILED is worse than '
        + 'either. Blocked. The way through is a positive marker for the condition being excused: '
        + 'catch ONLY the connection-shaped exception types (e.g. ConnectionError, a named '
        + 'operational-error type) and skip on those; every other exception must FAIL. '
        + '`except Exception: skip()` is not a decision, it is an abdication with a docstring.',
    };
  }

  // ---- L9 (spec files): a wall-clock assertion in clock-pinned content.
  if (np.endsWith('.spec.ts') && WALL_ASSERT.test(added)) {
    let pinned = CLOCK.test(added);
    if (!pinned && input.tool_name === 'Edit') {
      // The pin may live elsewhere in the file this Edit fragment touches — one disk read,
      // fail-open on any error.
      try { pinned = CLOCK.test(readFileSync(fp, 'utf8')); } catch { pinned = false; }
    }
    if (pinned) {
      return {
        decision: 'warn',
        reason: 'L9 (a pinned browser clock exposed a test mixing page-side and Node-side dates): '
          + 'this content asserts with Node-side wall time (`new Date()` / `Date.now()`) while '
          + '`page.clock` pins the PAGE\'s clock only — the assertion still reads real time, and '
          + 'the test goes red whenever the two clocks straddle a boundary. Compare page-side '
          + '(compute the expected value inside page.evaluate) or against a fixed literal. When '
          + 'using page.clock, sweep the spec for Node-side clock reads in assertions.',
      };
    }
  }

  return { decision: 'allow', reason: 'no test-honesty shape in the added content' };
}
```

- [ ] **Step 4: Write `bidi-ltr-island.mjs`**

```javascript
// scripts/hooks/rules/bidi-ltr-island.mjs — L13: a ≥ rendered as ≤ in RTL (opposite meaning; on a
// SAFETY floor marker) because the DOM-text test asserted the char was present but not its visual
// order. Gate, from the rule's own row: numeric/math readouts in Hebrew UI are LTR islands
// (dir="ltr"); catch bidi order by LOOKING; and guard with a dir assertion.
//
// SCOPE, MEASURED (Phase-1 correction — where the construct actually lives): app.js history since
// June holds 4,382 added ≥/≤ lines with no dir= on the same line, all healthy (dir handling lives
// in render wrappers, not on the string-building line) — so NO content pattern on additions can
// pass the phase's 0-false-alarm bar. What IS precise:
//   BRANCH A — an Edit whose old_string HAS dir="ltr" beside ≥/≤ and whose new_string keeps the
//   ≥/≤ but drops the dir attribute: someone is un-fixing the exact L13 fix. SEVERITY: BLOCK —
//   harm to substance (a safety comparison that renders reversed), detection is diff-anchored and
//   exact, and the alternative is trivial: keep the dir="ltr" attribute (or move it to the new
//   wrapper) in the replacement text.
//   BRANCH B — new test content asserting on text containing ≥/≤ with no dir assertion anywhere
//   in the same added content: the "guard with a dir assertion" half. SEVERITY: WARN — presence
//   of the char is being asserted, visual order is not; the warn names the missing assertion.
// The rest of L13's surface (a NEW readout built without an island) is explicitly NOT enforceable
// here at 0 false alarms and stays owned by DoD-8/9 (390×844 screenshot, actually looked at) —
// a named gap, not a silent one.
export const RULE_IDS = ['L13'];

import { basename } from 'node:path';
import { normPath, toolFilePath, newContent, oldContent } from '../lib/target-path.mjs';

const MATH = /[≥≤]/;
const DIR_LTR = /dir\s*=\s*["']ltr["']/;
const TEXT_ASSERT_MATH = /(toHaveText|toContainText|toHaveValue)\s*\([^)]*[≥≤]/;
const DIR_ASSERT = /toHaveAttribute\s*\(\s*["']dir["']|getComputedStyle|direction/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  if (!np) return { decision: 'allow', reason: 'bidi degraded: no file_path — allowing' };
  const base = basename(np);
  const added = newContent(input);

  // ---- BRANCH A: island removal in the UI sources.
  if (base === 'app.js' || base === 'app.css' || base === 'index.html') {
    const old = oldContent(input);
    if (typeof old === 'string' && typeof added === 'string'
        && DIR_LTR.test(old) && MATH.test(old)
        && MATH.test(added) && !DIR_LTR.test(added)) {
      return {
        decision: 'block',
        reason: 'L13 (a ≥ safety floor rendered as ≤ in RTL — opposite meaning): this edit REMOVES '
          + 'an existing dir="ltr" island while keeping the ≥/≤ readout inside RTL text, undoing '
          + 'the exact fix L13 paid for. Blocked. Keep the dir="ltr" attribute on the element that '
          + 'carries the numeric/math readout (or put it on the replacement wrapper) — bidi flips '
          + 'the glyph order silently and no DOM-text assertion will catch it.',
      };
    }
  }

  // ---- BRANCH B: a ≥/≤ text assertion with no dir guard, in new test content.
  if (np.includes('/tests/') && np.endsWith('.spec.ts') && typeof added === 'string'
      && TEXT_ASSERT_MATH.test(added) && !DIR_ASSERT.test(added)) {
    return {
      decision: 'warn',
      reason: 'L13: this assertion checks that a ≥/≤ character is PRESENT in the text, which is '
        + 'exactly the assertion that passed while the rendered order was reversed. Add a dir '
        + 'guard beside it — e.g. await expect(el).toHaveAttribute(\'dir\', \'ltr\') on the '
        + 'readout\'s island — and per DoD-8, look at the rendered 390×844 screenshot.',
    };
  }

  return { decision: 'allow', reason: 'no bidi-island shape in this change' };
}
```

- [ ] **Step 5: Run the tests and watch them pass.** If `test_honesty_rules_do_not_fire_on_the_real_test_tree` fails on a REAL file, that is either (a) a real latent defect in the suite — report it to the controller as a finding, exactly like Phase 1's control-bytes gate did, and do NOT tune it away silently, or (b) a pattern overreach — tighten the pattern and re-run. State which happened. Paste output.

- [ ] **Step 6: Commit**

```bash
git add scripts/hooks/rules/test-honesty.mjs scripts/hooks/rules/bidi-ltr-island.mjs tests/test_arc2_phase2_rules.py
git commit -m "feat(arc2 phase2, task 5): L9, L57, L13 - tests that tell the truth, islands that stay"
```

---

### Task 6: `worker-ceiling-lock.mjs` (`L21`), `version-pin-floating.mjs` (`L52`), `locked-procedure.mjs` (`L78`) + the owner-records lib extraction

**Files:**
- Create: `scripts/hooks/lib/owner-decision-records.mjs` (extracted from `fix-cycle-limit.mjs`)
- Modify: `scripts/hooks/rules/fix-cycle-limit.mjs` (import from the lib; delete the local copies)
- Create: `scripts/hooks/rules/worker-ceiling-lock.mjs`
- Create: `scripts/hooks/rules/version-pin-floating.mjs`
- Create: `scripts/hooks/rules/locked-procedure.mjs`
- Modify: `tests/test_arc2_phase2_rules.py` (append)

**Why three files:** three unrelated scan targets (`playwright.config.*` / dependency-pin config files / `docs/process/rule-coverage/criterion/**`). They share this task only because each is small, and all three are the same CLASS — a measured or locked value changed by a drive-by edit.

**RED against old behaviour for the extraction:** `ownerDecisionRecords()`/`parseCutoffMs()` move verbatim from `fix-cycle-limit.mjs` into the lib; `fix-cycle-limit.mjs` imports them. The regression net is `node scripts/tests/test-hooks-groupb.mjs` — run it BEFORE the extraction (green), AFTER (green), paste both.

**Task DoD:** RED witnessed · GREEN pasted · false-alarm vs real tree/history per rule · severity argued · `RULE_IDS` declared · group-B suite green before and after the extraction.

- [ ] **Step 1: Write the failing tests (append)**

```python
# ---------------------------------------------------------------- Task 6: L21 + L52 + L78

def test_L21_blocks_a_drive_by_workers_change(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "playwright.config.ts",
        old="workers: process.env.CI ? 2 : 20,",
        new="workers: process.env.CI ? 2 : 32,"),
        env_extra={"DISCIPLINE": str(tmp_path / "empty-discipline.md")}, tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "Owner architecture decision" in reason_of(out)   # the reachable path, by name


def test_L21_allows_the_change_with_a_fresh_owner_record(tmp_path):
    import datetime
    d = tmp_path / "discipline.md"
    today = datetime.date.today().isoformat()
    d.write_text(f"**Owner architecture decision ({today}):** playwright-workers — raise to 32\n",
                 encoding="utf-8")
    out = run_pretooluse(payload(
        "Edit", ROOT / "playwright.config.ts",
        old="workers: process.env.CI ? 2 : 20,",
        new="workers: process.env.CI ? 2 : 32,"),
        env_extra={"DISCIPLINE": str(d)}, tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L21_does_not_fire_on_a_real_config_edit_elsewhere(tmp_path):
    """False-alarm vs the real file: an edit to the config that does not touch workers/retries."""
    out = run_pretooluse(payload(
        "Edit", ROOT / "playwright.config.ts",
        old="retries: 0,   // surface flakes as failures — never retry them away (a flake is a bug to fix)",
        new="retries: 0,   // surface flakes as failures; never retry them away"),
        tmp_path=tmp_path)
    assert decision_of(out) == "allow", out


def test_L52_blocks_a_floating_latest_pin(tmp_path):
    out = run_pretooluse(payload("Write", ROOT / "compose.yml",
                                 content="services:\n  db:\n    image: postgres:latest\n"),
                         tmp_path=tmp_path)
    assert decision_of(out) == "block", out
    assert "version NUMBER" in reason_of(out) or "pin" in reason_of(out).lower()


def test_L52_does_not_fire_on_real_tracked_configs(tmp_path):
    """False-alarm vs the REAL tree (measured 0 `:latest` in tracked configs before this plan):
    every tracked yml/yaml/json/Dockerfile replayed as a Write of its own content."""
    tracked = subprocess.run(["git", "ls-files", "*.yml", "*.yaml", "package.json", "Dockerfile*"],
                             capture_output=True, text=True, encoding="utf-8",
                             cwd=str(ROOT)).stdout.splitlines()
    assert tracked, "no tracked config files — the false-alarm test examined NOTHING"
    for rel in tracked:
        content = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        out = run_pretooluse(payload("Write", ROOT / rel, content=content), tmp_path=tmp_path)
        assert "version-pin-floating" not in reason_of(out) or decision_of(out) == "allow", \
            f"L52 fires on real {rel}: {reason_of(out)}"


def test_L78_warns_on_editing_the_locked_procedure(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "criterion.md",
        old="a", new="b"), tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L78_warns_on_editing_a_dispatch_packet(tmp_path):
    out = run_pretooluse(payload(
        "Edit", ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "apply" / "chunk-3-packet.md",
        old="a", new="b"), tmp_path=tmp_path)
    assert decision_of(out) == "warn", out


def test_L78_stays_quiet_on_run_outputs(tmp_path):
    """Answers/batches are OUTPUTS of a run, written during normal work — not the procedure."""
    out = run_pretooluse(payload(
        "Write", ROOT / "docs" / "process" / "rule-coverage" / "criterion" / "apply" / "chunk-3-answers-alpha.json",
        content="{}"), tmp_path=tmp_path)
    assert decision_of(out) == "allow", out
    out2 = run_pretooluse(payload(
        "Write", ROOT / "docs" / "process" / "rule-coverage" / "batch-06-group-b.md",
        content="# batch\n"), tmp_path=tmp_path)
    assert decision_of(out2) == "allow", out2
```

- [ ] **Step 2: Run group-B suite (green baseline), then the new tests (fail).** Paste both.

- [ ] **Step 3: Extract `owner-decision-records.mjs`**

Move `parseCutoffMs()`, `OWNER_DECISION_RE`, and `ownerDecisionRecords()` from `fix-cycle-limit.mjs` VERBATIM into:

```javascript
// scripts/hooks/lib/owner-decision-records.mjs — the one parser for the discipline doc's
// `**Owner architecture decision (DATE):** <target> — <decision>` records. Extracted from
// fix-cycle-limit.mjs (Arc 2 Phase 2, Task 6) the moment it grew a second consumer
// (worker-ceiling-lock.mjs): two copies of a record grammar are two grammars that will
// eventually disagree, and the record is an ESCAPE HATCH — a divergence here is a block that
// tells the owner their own record "doesn't count." All semantics (UTC parsing, end-of-day
// cutoff for date-only records, unparseable records clear nothing) are unchanged and documented
// at length in fix-cycle-limit.mjs's own header, which remains the narrative home.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const DEFAULT_DISCIPLINE_DOC = join(ROOT, 'docs', 'process', 'development-discipline.md');
export function disciplineDocPath() {
  return process.env.DISCIPLINE || DEFAULT_DISCIPLINE_DOC;
}

const OWNER_DECISION_RE = /\*\*Owner architecture decision \(([^)]+)\):\*\*\s*(.+?)\s*—/g;

export function parseCutoffMs(raw) {
  // ... moved VERBATIM from fix-cycle-limit.mjs ...
}

export function ownerDecisionRecords() {
  // ... moved VERBATIM from fix-cycle-limit.mjs (using disciplineDocPath() above) ...
}
```

In `fix-cycle-limit.mjs`: delete the moved definitions (and its local `disciplineDocPath`), add `import { ownerDecisionRecords } from '../lib/owner-decision-records.mjs';`. Re-run `node scripts/tests/test-hooks-groupb.mjs` — green, pasted.

- [ ] **Step 4: Write `worker-ceiling-lock.mjs`**

```javascript
// scripts/hooks/rules/worker-ceiling-lock.mjs — L21: "a worker ceiling measured on a contaminated
// machine is not a ceiling." The certified pins (workers: 20 locally / 2 on CI, retries: 0) came
// out of an instrumented multi-run campaign on a proven-idle machine, after a contaminated
// measurement produced a confident, specific, WRONG hardware truth that survived precisely
// because it sounded like one. L21's own closing line: re-deriving the ceiling "is the owner's
// decision, not a drive-by edit." §11a adds: retries stays 0 — a flake is a bug, never retried away.
//
// PAYLOAD POSITION: an Edit to playwright.config.* whose old_string/new_string pair CHANGES the
// value of `workers:` or `retries:` (a Write is compared against the file on disk). The
// comparison is diff-anchored — an edit touching other lines of the config, or rewording a
// comment on the same line without changing the value, never fires (proven against the real
// config in the false-alarm test).
//
// SEVERITY: BLOCK, argued: the harm is to substance — a wrong concurrency pin manufactures
// phantom failures (or hides real capacity) across every future suite run, and the last wrong
// pin cost a full re-measurement campaign to un-learn. The reachable path through is NOT a
// bypass but the same escape §5 already honors: a dated `**Owner architecture decision
// (YYYY-MM-DD):** playwright-workers — ...` (or playwright-retries) record in the discipline
// doc, parsed by the SAME lib fix-cycle-limit.mjs uses (one grammar). The record must be FRESH
// (its cutoff covers now): a reset is point-in-time, not a permanent exemption.
export const RULE_IDS = ['L21'];

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { normPath, toolFilePath, newContent, oldContent } from '../lib/target-path.mjs';
import { ownerDecisionRecords } from '../lib/owner-decision-records.mjs';

const WORKERS = /workers\s*:\s*([^,\n]+)/;
const RETRIES = /retries\s*:\s*([^,\n]+)/;

function valueOf(re, text) {
  if (typeof text !== 'string') return null;
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  if (!fp || !basename(normPath(fp)).startsWith('playwright.config')) {
    return { decision: 'allow', reason: 'not a playwright config' };
  }
  const added = newContent(input);
  if (typeof added !== 'string') {
    return { decision: 'allow', reason: 'L21 degraded: no new content on this call — allowing' };
  }
  // The "before" text: Edit's old_string, or (for Write) the current file on disk. Unreadable
  // disk on a Write = a NEW config file = nothing measured is being changed — allow.
  let before = oldContent(input);
  if (before === null) {
    try { before = readFileSync(fp, 'utf8'); } catch {
      return { decision: 'allow', reason: 'L21: new config file, no measured value to protect — allowing' };
    }
  }
  const changes = [];
  for (const [name, re] of [['workers', WORKERS], ['retries', RETRIES]]) {
    const was = valueOf(re, before);
    const now = valueOf(re, added);
    // Fires only when the token exists on BOTH sides with different values, or the new side
    // introduces it where the old side had it absent-but-the-file-did… no: an Edit fragment not
    // mentioning workers at all yields was===now===null — no change, no fire. That asymmetry is
    // the diff anchoring.
    if (was !== null && now !== null && was !== now) changes.push([name, was, now]);
  }
  if (changes.length === 0) {
    return { decision: 'allow', reason: 'L21: no change to a measured pin (workers/retries) in this edit' };
  }
  let records = [];
  try { records = ownerDecisionRecords(); } catch { records = []; }
  const nowMs = Date.now();
  const covered = changes.every(([name]) => records.some(
    (r) => r.target === `playwright-${name}` && r.cutoffMs > nowMs,
  ));
  if (covered) {
    return {
      decision: 'allow',
      reason: 'L21: a fresh Owner architecture decision record covers this pin change',
    };
  }
  const what = changes.map(([n, w, v]) => `${n}: ${w} -> ${v}`).join(', ');
  return {
    decision: 'block',
    reason: `L21 (a contaminated measurement once produced a confident, WRONG "hardware truth" — `
      + `and §11a: retries stays 0, a flake is a bug): this edit changes a MEASURED pin (${what}) `
      + 'in playwright.config. Re-deriving the worker ceiling is the owner\'s decision, backed by '
      + 'a §11a-grade campaign (6–9 sampled runs on a verified-idle machine), not a drive-by edit. '
      + 'Blocked. The way through: raise it with the owner; once decided, append '
      + '`**Owner architecture decision (YYYY-MM-DD):** playwright-workers — <decision>` (or '
      + 'playwright-retries) to docs/process/development-discipline.md §11 — a record dated today '
      + 'clears this block, exactly as §5\'s own reset records work.',
  };
}
```

- [ ] **Step 5: Write `version-pin-floating.mjs`**

```javascript
// scripts/hooks/rules/version-pin-floating.mjs — L52: "'always take the newest' is a version
// policy, not a tagging policy — and the newest changes contracts." A floating `latest` pin let
// a future pull swap the database engine under a running system with nothing in any diff; the
// same day, PostgreSQL 18 moved the data mount path and Neo4j moved to CalVer — both "newest",
// both contract changes that had to be READ, not assumed.
//
// PAYLOAD POSITION: content ADDED (new_string/content) to a pin-carrying config file — .yml/.yaml,
// Dockerfile*, package.json — matching a floating pin shape: `image: <name>:latest`,
// `FROM <name>:latest`, or a package.json dependency valued "latest". Measured against the real
// tree before writing this: ZERO tracked occurrences, so the false-alarm replay of every tracked
// config passes by construction today and guards the future.
//
// SEVERITY: BLOCK, argued: harm to substance — an engine swap that no diff will ever show is the
// worst kind of change (invisible locally, fatal later), and the alternative costs one lookup and
// is named in the message: pin the newest version NUMBER, and when the number crosses a major,
// read that component's own release notes before debugging anything.
export const RULE_IDS = ['L52'];

import { basename } from 'node:path';
import { normPath, toolFilePath, newContent } from '../lib/target-path.mjs';

const FLOATING = [
  /\bimage\s*:\s*["']?[\w./-]+:latest\b/,   // compose/k8s image pin
  /\bFROM\s+[\w./-]+:latest\b/i,            // Dockerfile
];
const PKG_LATEST = /"[^"\n]+"\s*:\s*"latest"/;

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const fp = toolFilePath(input);
  const np = normPath(fp);
  if (!np) return { decision: 'allow', reason: 'L52 degraded: no file_path — allowing' };
  const base = basename(np);
  const isPinFile = np.endsWith('.yml') || np.endsWith('.yaml')
    || base.startsWith('dockerfile') || base === 'package.json';
  if (!isPinFile) return { decision: 'allow', reason: 'not a pin-carrying config file' };

  const added = newContent(input);
  if (typeof added !== 'string') {
    return { decision: 'allow', reason: 'L52 degraded: no added content — allowing' };
  }
  const hit = FLOATING.some((re) => re.test(added))
    || (base === 'package.json' && PKG_LATEST.test(added));
  if (!hit) return { decision: 'allow', reason: 'no floating pin in the added content' };
  return {
    decision: 'block',
    reason: 'L52 ("always take the newest" is a version policy, not a tagging policy): `latest` '
      + 'is a FLOATING pointer — a future pull swaps the component under a running system with '
      + 'nothing in any diff to show it. Blocked. Pin the newest version NUMBER instead (same '
      + 'software today, and a change that has to be written down to happen) — and when that '
      + 'number moves a whole major, read the component\'s own release notes for changed mount '
      + 'paths / env names / entrypoints BEFORE debugging (Postgres 18 moved the data mount; '
      + 'Neo4j went CalVer — both were documented upstream and cost a diagnostic cycle each).',
  };
}
```

- [ ] **Step 6: Write `locked-procedure.mjs`**

```javascript
// scripts/hooks/rules/locked-procedure.mjs — L78 (9.8.26): improving a dispatch brief BETWEEN
// batches is a silent procedure change — 38 rules got classified under one procedure and 19
// under another, with no document changed by anyone, and the whole run was invalidated and
// re-run. L78's gate: "a measured procedure is locked in its text, and the brief cites it —
// whoever wants a change, changes the procedure and re-measures."
//
// PAYLOAD POSITION, measured against the real directory before writing this: the PROCEDURE
// files are docs/process/rule-coverage/criterion/criterion.md (the decision procedure) and
// criterion/apply/chunk-*-packet.md (the dispatch briefs — the exact artifact L78's failure
// edited mid-run). The answers (chunk-*-answers-*.json), the batch outputs (batch-*.md), and
// everything else under rule-coverage/ are RUN OUTPUTS, written during normal work — out of
// scope, proven in the false-alarm test.
//
// SEVERITY: WARN, argued in two halves. (1) The mirror marks L78 group B — the prior fact a
// block would need is "a classification run is in flight," and NO recordable signal of that
// exists anywhere in the store or the tree; blocking on a fact this rule cannot read would
// violate fail-open. (2) Editing the procedure is sometimes exactly right (between runs, with a
// re-measurement planned) — the harm mode is doing it SILENTLY, and a warn that quotes the gate
// at the moment of the edit removes the silence, which is the whole lesson. The warn is the
// enforcement; the run-invalidation cost of ignoring it is L78's own receipt.
export const RULE_IDS = ['L78'];

import { normPath, toolFilePath } from '../lib/target-path.mjs';

const LOCKED = [
  /\/docs\/process\/rule-coverage\/criterion\/criterion\.md$/,
  /\/docs\/process\/rule-coverage\/criterion\/apply\/[^/]*packet[^/]*\.md$/,
];

export function evaluate(input) {
  if (!input || (input.tool_name !== 'Edit' && input.tool_name !== 'Write')) {
    return { decision: 'allow', reason: 'not an Edit/Write' };
  }
  const np = normPath(toolFilePath(input));
  if (!np || !LOCKED.some((re) => re.test(np))) {
    return { decision: 'allow', reason: 'not a locked procedure file' };
  }
  return {
    decision: 'warn',
    reason: 'L78 (a mid-run brief "improvement" split one measurement into two procedures — 38 '
      + 'rules under one, 19 under another, run invalidated): you are editing a LOCKED measurement '
      + 'procedure/packet. If a classification run is between batches right now, this edit forks '
      + 'the procedure mid-measurement. The legitimate path: change the procedure OPENLY — state '
      + 'the change, and re-measure every batch the old text governed. A procedure that was '
      + 'measured is locked in its text; the brief cites it.',
  };
}
```

- [ ] **Step 7: Run the tests and watch them pass; re-run `node scripts/tests/test-hooks-groupb.mjs` once more.** Paste both.

- [ ] **Step 8: Commit**

```bash
git add scripts/hooks/lib/owner-decision-records.mjs scripts/hooks/rules/fix-cycle-limit.mjs scripts/hooks/rules/worker-ceiling-lock.mjs scripts/hooks/rules/version-pin-floating.mjs scripts/hooks/rules/locked-procedure.mjs tests/test_arc2_phase2_rules.py
git commit -m "feat(arc2 phase2, task 6): L21, L52, L78 - measured values change by decision, not by edit"
```

---

### Task 7: liveness (no env overrides), coverage by id, overhead vs 61ms, full suites

**Files:**
- Create: `tests/test_arc2_phase2_wiring.py`
- Modify: `docs/process/rule-coverage-baseline.json` (from the number the gate ACTUALLY prints)

**Interfaces:**
- Consumes: everything from Tasks 1–6. No new production code — this task proves the phase is LIVE and prices it.

**Wiring note (why there is no wiring step in this phase):** `pipeline.mjs` discovers rules by directory listing, and `.claude/settings.json`'s PreToolUse matcher already includes `Edit|Write`. Dropping the nine files into `scripts/hooks/rules/` IS the wiring. That is exactly why the liveness test matters: nothing else in the phase proves the discovery actually happens through the real entry point.

**Task DoD:** liveness through the real CLI with zero env overrides · coverage asserted over rule IDS, never a ratio · overhead measured and reported vs 61ms · `pytest` + `npx playwright test` both green, plain.

- [ ] **Step 1: Write the wiring tests**

```python
# tests/test_arc2_phase2_wiring.py — Arc 2 Phase 2, Task 7. Liveness, coverage, overhead.
import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PHASE2_RULES = ["10.14", "12.1", "2", "L13", "L16", "L21", "L52", "L56", "L57", "L78", "L9"]


def test_phase2_rules_are_live_through_the_real_entry_point_with_no_env_overrides():
    """§3.4 — THE liveness test. A stop rule once shipped inert behind a test-only env var while
    333 tests passed. This spawns the REAL CLI with the environment UNTOUCHED — no
    PRETOOLUSE_RULES_DIR, no ENFORCEMENT_STATE_PATH, nothing — and requires a deterministic,
    stateless rule from this phase (12.1: a GSD artifact path) to block. One rule proving
    discovery proves the directory listing that loads all nine files."""
    payload = {"session_id": "s-liveness-arc2p2", "hook_event_name": "PreToolUse",
               "tool_name": "Write", "cwd": str(ROOT),
               "tool_input": {"file_path": str(ROOT / "PLAN.md"), "content": "# plan\n"}}
    r = subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                      input=json.dumps(payload), capture_output=True, text=True,
                      encoding="utf-8", cwd=str(ROOT), env={**os.environ})
    assert r.returncode == 0
    out = json.loads(r.stdout)
    h = out.get("hookSpecificOutput", {})
    assert h.get("permissionDecision") == "deny", (
        f"12.1 did not fire through the real entry point — the phase's rules are NOT live:\n{r.stdout}")
    assert "12.1" in h.get("permissionDecisionReason", "")


def test_every_phase2_rule_is_declared_and_counted():
    """Asserts over RULE IDS, never a pinned ratio (L64b — the '41 of 82' that broke within
    hours because writing a lesson ADDS a rule)."""
    r = subprocess.run(["node", str(ROOT / "scripts" / "check-rule-coverage.mjs")],
                      capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT))
    assert r.returncode == 0, f"check-rule-coverage.mjs exited nonzero:\n{r.stdout}\n{r.stderr}"
    error_lines = [ln for ln in r.stdout.splitlines()
                   if ln.startswith("ERROR:") or ln.startswith("REGRESSION:")]
    for rid in PHASE2_RULES:
        offending = [ln for ln in error_lines if rid in ln]
        assert not offending, f"{rid} appears in an ERROR/REGRESSION line:\n" + "\n".join(offending)


def test_coverage_baseline_file_contains_every_phase2_rule():
    baseline = json.loads((ROOT / "docs" / "process" / "rule-coverage-baseline.json")
                          .read_text(encoding="utf-8"))
    covered = set(baseline["covered"])
    missing = [rid for rid in PHASE2_RULES if rid not in covered]
    assert not missing, f"baseline is missing phase-2 rule id(s): {missing}"


def test_pretooluse_overhead_stays_in_the_baseline_class():
    """§3.5 — overhead measured, not assumed, against the 61ms Phase-4 worst case. Measures the
    WORST realistic payload (an app.js Edit — the path that consults state and, when targets are
    hot, the transcript) through the real CLI, 10 runs, and reports median+max. The assert is a
    tripwire at 4x the documented baseline — generous because each run pays full node startup —
    and the REPORTED numbers, pasted into the task summary, are the real deliverable; a material
    rise is a finding to investigate (spec §3.5), whether or not the tripwire fires."""
    payload = {"session_id": "s-overhead-arc2p2", "hook_event_name": "PreToolUse",
               "tool_name": "Edit", "cwd": str(ROOT),
               "tool_input": {"file_path": str(ROOT / "app.js"),
                              "old_string": "const", "new_string": "const"}}
    times = []
    for _ in range(10):
        t0 = time.perf_counter()
        subprocess.run(["node", str(ROOT / "scripts" / "hooks" / "pretooluse.mjs")],
                       input=json.dumps(payload), capture_output=True, text=True,
                       encoding="utf-8", cwd=str(ROOT), env={**os.environ})
        times.append((time.perf_counter() - t0) * 1000)
    times.sort()
    median, worst = times[len(times) // 2], times[-1]
    print(f"\nPRETOOLUSE OVERHEAD: median {median:.0f}ms, worst {worst:.0f}ms over 10 runs "
          f"(Phase-4 baseline: 61ms worst case)")
    assert worst < 61 * 4, f"overhead {worst:.0f}ms is far outside the baseline class — investigate"
```

- [ ] **Step 2: Run and watch the liveness test's state** — before Tasks 1–6 land it FAILS (no rule denies); after, it passes. If executing this task after the others (the normal order), prove RED instead by pointing the CLI at an empty `PRETOOLUSE_RULES_DIR` once, showing allow, then deleting that check — or simply cite the Task-4 RED where `test_121_blocks_a_gsd_artifact` failed for the same reason. State which was done.

- [ ] **Step 3: Update the coverage baseline from reality**

Run `node scripts/check-rule-coverage.mjs`, read the number and the id list it ACTUALLY prints (never assume — the denominator moves whenever a lesson is written), and write those into `docs/process/rule-coverage-baseline.json`.

- [ ] **Step 4: Measure and report overhead** — run the wiring test with `-s`, paste the printed median/worst against 61ms. Also measure the Task-1 posttooluse-on-Read cost the same way (a `Read` PostToolUse payload, 10 runs) and report it beside: this phase ADDED that per-Read cost and must own the number.

- [ ] **Step 5: Full suites, plain**

Run: `py -3 -X utf8 -m pytest tests/ -q` and `npx playwright test` — no `--retries`, no `--workers`, suite serialized (no concurrent heavy agents, §11a). Paste tails + exit codes.

- [ ] **Step 6: Commit**

```bash
git add tests/test_arc2_phase2_wiring.py docs/process/rule-coverage-baseline.json
git commit -m "feat(arc2 phase2, task 7): eleven Edit|Write rules live, counted, and priced"
```

---

## Self-Review

**Spec coverage.** §3.1 (false-alarm vs real history/tree, per rule): every task replays real tracked paths, real file contents, or real `git log` history — each replay test is guarded with an `assert <collection>, "...examined NOTHING"` per the "a check that examined nothing must not report a pass" constraint. §3.2 (severity argued per rule, no bypass): every rule header carries the argument; the two escapes that exist (L21's owner record, L16's read-the-source) are less-efficient paths to the same work, not bypasses. §3.3 (`RULE_IDS`): nine rule files declare exactly the eleven ids; the observer declares `[]`. §3.4 (liveness, no env overrides): Task 7 step 1. §3.5 (overhead vs 61ms): Task 7 steps 1/4, including the NEW per-Read cost Task 1 introduced. §5 items 1–7 map to Tasks 1–7; §5's "0 false alarms on examined history" is each task's replay test.

**Group-B design (the phase's structural heart).** `10.14` reads `fix_targets` (written by `verification-outcomes.mjs`); `L16`/`L56` read `file_read` events (written by the new `read-tracker.mjs`; `L56` also writes its own throttle event). The mirror-vs-design discrepancy on `2` and `L78` is argued in the header block, not discovered later.

**Placeholder scan.** Every task carries complete implementations and complete tests. Two deliberate verbatim-move markers exist in Task 6 step 3 (`... moved VERBATIM from fix-cycle-limit.mjs ...`) — these are moves of code quoted in full earlier in this conversation's source file, not inventions; the implementer copies from `fix-cycle-limit.mjs` lines 149–163 and 234–249. No "handle edge cases", no "similar to Task N".

**Type consistency.** All nine rules share one interface (`evaluate(input) -> {decision, reason}`), one path helper (`target-path.mjs`), one hook-output decoding in the tests (`decision_of`/`reason_of` defined once in Task 1). State access is only ever through `enforcement-state.mjs`'s exported functions; the one new read helper (`recentEvents`) follows `openTargets()`'s exact actor semantics.

**Things I could not resolve, stated plainly:**
1. **The B-count discrepancy** (mirror: five; brief: three; this design: three with state access). The design argument is in the header; if the owner reads the mirror as binding on the mechanism, `2` and `L78` need a different design and that is an owner conversation, not a plan-level waiver.
2. **L13's app.js "new readout without an island" surface is NOT enforced** — measured 4,382 healthy counter-examples make it un-patternable at the 0-false-alarm bar. Enforced: island REMOVAL (block) and the missing dir ASSERTION (warn). The remainder stays with DoD-8/9. This is a scope statement, not a silent narrowing — it is written here to be approved or rejected with the plan.
3. **Task 1 step 6's live matcher verification** may not be executable from a dispatched subagent (a subagent cannot drive the interactive session's own Read). The step says to hand it to the controller explicitly rather than claim it.
4. **`test_2_stays_quiet_on_every_real_plan`** may surface a legacy plan that fails `checkPlanText` (pre-L27 shapes). The task instructs report-don't-exempt; if one exists, the resolution is an owner-visible finding.
5. **Overhead of Read in PostToolUse**: every `Read` call now pays a hook spawn. Task 7 measures and reports it; if the owner judges the price too high for the two consumers (L16/L56), the fallback design (transcript-tail evidence, weaker but free) is named in Task 1's rationale — switching to it would be a design change to raise, not to slip in.

Pre-flight conflict scan: no file created here collides with a Phase-1 file; the two modified live files (`enforcement-state.mjs`, `fix-cycle-limit.mjs`) are extended/refactored with their existing suites re-run as regression nets in the same task that touches them.
