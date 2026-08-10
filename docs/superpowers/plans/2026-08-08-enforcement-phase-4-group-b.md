# Enforcement Phase 4 — Group B (מצב) Implementation Plan

> **‏✅ בוצעה — סומן 10.8.26.** ‏7 הפקדות המשך · קבוצה B שוגרה
>
> **למה הסימון הזה קיים:** ‏`check-plan-complete` דיווח על 11 מ-34 התוכניות כפגומות. הבדיקה הראשונה
> אי-פעם של השער מול הקורפוס הקיים — הוא נבנה ב-L27 והורץ רק על מה שנכתב אחריו. **התוכניות אינן
> קטועות; הן היסטוריות, וכתובות בסגנון שקדם לדרישת בלוקי-הקוד.** רשום כ-R-119, הוכרע ע"י הבעלים
> ‏10.8.26: קו-בסיס מוצהר + סימון ביצוע, בלי שכתוב תיעוד של עבודה שכבר נחתה.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement §6 of the approved spec `docs/superpowers/specs/2026-08-06-process-enforcement-design.md` — the five stateful (Group B) rules: the §5 fix-cycle counter, the §10.16 lessons-at-commit gate, the three §1 skill triggers (§6.4), the §10.2 UI-verified warn, and the §10.10 live-URL block — plus the §6.2 ENFORCEMENT STATE restoration after compact.

**Architecture:** Group B differs from Group A in exactly one way: it needs memory between tool calls. That memory lives in a new SQLite state store (`.superpowers/hooks-state/enforcement-state.sqlite`, via Node's built-in `node:sqlite` — Node v24.18.0 here, `DatabaseSync` is unflagged since 22.13). Three new hook entry points feed and consume it: **PostToolUse** (observers that RECORD outcomes — failures, passes, edits, playwright runs, live probes — and never decide), **PreToolUse rules** (which BLOCK using recorded state — fix-cycle limit, lessons-before-commit, the two skill gates on Edit/Write), and a **Stop** entry point (claim-shaped rules — success/live claims read from the transcript tail, exactly where §6.4's third trigger and §10.2/§10.10 live). §6.2's restoration extends the existing `scripts/session-state.mjs`, not a second mechanism.

**Tech Stack:** Node 24 ESM (`.mjs`), `node:sqlite` (`DatabaseSync`), the existing `scripts/hooks/pipeline.mjs` discovery pattern, the existing `scripts/tests/run-all.mjs` self-test harness, Claude Code hooks (PreToolUse / PostToolUse / Stop / SessionStart) via `.claude/settings.json`.

## Global Constraints

Copied from the approved spec and the discipline — every task's requirements implicitly include these:

- **§2.1 — no bypass mechanism, anywhere.** *"לעולם לא מנגנון עקיפה אלא רק דרך פחות יעילה לעשות את אותה עבודה."* No env var, no flag, no skip file that turns a Group B rule off. (Test-only path overrides pointing at fixture files are NOT bypasses — Phase 3's `PRETOOLUSE_RULES_DIR` precedent — because they redirect *where state lives*, never *whether the rule runs*; every rule still evaluates identically against the redirected state.)
- **§2.2 — a block is legitimate only when a compatible alternative path exists.** Every blocking rule's deny reason MUST name the alternative (§10.24). The per-rule alternatives are listed in the "Blocks and their alternative paths" table below.
- **§6 severity is verbatim:** §5 → **block** + duty to raise to owner · §10.16 → **block at commit** · §1 triggers → **block, immediate** · §10.2 → **warn** · §10.10 → **block**.
- **§6.1 verbatim:** *"המפתח הוא הבדיקה שנכשלה, לא הקובץ שנערך."* An attempt is a **closed cycle**: verification failed → edit → verification failed again. Chasing three different failures is three first attempts, not a fourth.
- **Fail-open by construction** (Phase 3 contract): any internal failure — unreadable state DB, unparseable transcript, missing field — resolves to allow/silence and is *recorded*, never to a block. A stateful mechanism must not be able to go stale into a permanent block; every counter's crash/compact behavior is stated in the "State lifecycle" table below.
- **Overhead budget** (Phase 3 measurements): ~50 ms node spawn baseline, ~120–150 ms with a transcript scan, ~360–390 ms with a process shell-out. Group B adds: PreToolUse on `Edit|Write` (+~50 ms/edit — required, §6.1's block and §6.4 triggers 1–2 fire *on the edit*, no cheaper interception point exists), PostToolUse on `Bash|Edit|Write` (+~50 ms after those calls; observers touch SQLite only — **no transcript scans, no shell-outs in observers**), Stop once per assistant turn (transcript tail read affordable there). Rules order their checks cheapest-first: a transcript scan runs only after cheap state checks already indicate a gating condition.
- **0-false-warnings discipline:** every task states RED (must trigger) *and* COUNTER-RED (must pass in silence). The counter case is written and witnessed failing/passing like any other test.
- **RED witnessed before GREEN** (DoD-2); regression red-green for fixes (DoD-7); no arbitrary waits (DoD-11); full suite `npx playwright test` plus `node scripts/tests/run-all.mjs` green at each task close (DoD-12; run serialized, §11a).
- **Internal decision vocabulary** stays `allow | warn | block` (pipeline.mjs). New entry points translate per hook-event contract, exactly as `pretooluse.mjs` does.
- **No content-plane rules** (§1): everything here is process-plane; nothing touches `bcheck`/`temp`/`safe`/cook-duration logic (DoD-10 invariance is trivially satisfied — no task touches `app.js`/`data.py`/`dist`).

## Blocks and their alternative paths (§10.24 / §2.2)

| Blocking rule | The block | The compatible alternative (named in the deny reason) |
|---|---|---|
| §5 fix-cycle limit (Task 4) | 4th fix cycle on the SAME failing test | The act §5 itself commands: STOP and raise the architecture question with the owner in conversation. Everything else stays open — running tests, reading code, research, editing *other* targets. Resumption mechanics: **Owner Question Q1** below. |
| §10.16 lessons (Task 6) | `git commit` while session failures are uncovered | Write the arc's `**L<n> ·` entry, or add the existing visible escape the doc already defines: `**No-lesson declaration (YYYY-MM-DD):** <arc> — reason`. Both take a minute (spec §6.3 says so verbatim). |
| §1 trigger 1 (Task 7) | Creative write without approved design | Invoke `superpowers:brainstorming` (one minute — spec §6.4 verbatim), or work under an approved spec + active plan ledger. |
| §1 trigger 2 (Task 8) | Edit after a failure without the skill | Invoke `superpowers:systematic-debugging` (one minute). |
| §1 trigger 3 (Task 9) | Success claim without evidence | Invoke `superpowers:verification-before-completion`, or paste the verification output into the reply, or drop the claim. |
| §10.10 live claim (Task 11) | "version is live" without a live probe | Run the existing `node scripts/live-smoke.mjs` (probes `https://matkonetesh.pages.dev`, asserts `.foot-stamp`), or `browser_navigate` the live URL — then claim. Or don't claim live. |

## State lifecycle — what happens after a crash and after a compact, per counter

All Group B state is keyed by `session_id` (present on PreToolUse/PostToolUse/Stop stdin per the documented hook contract) and carries a `ts`. A 24-hour TTL prune runs on every open of the store.

| Counter / event stream | After a crash (new session_id) | After a compact (same session continues) | Reset event |
|---|---|---|---|
| §5 fix-attempts per failing test | Rows keyed to the dead session never match the new `session_id` → invisible to blocking; TTL prunes them. **No permanent block possible.** | Rows survive in SQLite; §6.2 restoration (Task 5) re-announces them: `§5 fix attempts on \`X\`: N of 3`. Blocking continues seamlessly. | Verification of that target passes; or the owner-decision path (Q1). |
| §10.16 session failure count | Same — old session's failures never block a new session's commits. | Survives; re-announced (`failures this arc: N · lessons logged: M`). | A commit that passes the gate marks the session's failures covered (see Task 6's operational reading, Q4). |
| Session events (`ui_edit`, `playwright_run`, `live_probe`, `bash_failure`, `commit`) | Ignored by the new session (keying), TTL-pruned. | Survive; consumed normally. | Superseded by newer events of the same kind. |

**Compact identity check (Task 2, step 6):** the design assumes `session_id` is stable across compact (the transcript continues; SessionStart fires with `source: "compact"`). This is *verified empirically* during Task 2, not assumed: if measurement shows the id changes on compact, blocking still fails open (counter invisible → no block) and the §6.2 restoration — which reads the **newest session's rows within TTL regardless of id** — still surfaces the counter in the announcement, so §5 is carried by the restored context exactly as spec §6.2 intends. Either way, no stale block and no silent loss of the announcement.

## File structure (locked in here)

```
scripts/hooks/posttooluse.mjs                    NEW  PostToolUse CLI entry (observer runner)
scripts/hooks/stop.mjs                           NEW  Stop CLI entry (claim-rule runner)
scripts/hooks/lib/enforcement-state.mjs          NEW  SQLite state store (the one shared memory)
scripts/hooks/lib/verification-target.mjs        NEW  verification-command classifier + failing-test extraction
scripts/hooks/lib/skill-invoked.mjs              NEW  "was skill X invoked in this transcript since T" (geniza-consult pattern)
scripts/hooks/lib/claim-scan.mjs                 NEW  last-assistant-message claim/evidence detection
scripts/hooks/observers/verification-outcomes.mjs NEW  records failures/passes/targets/commits (PostToolUse:Bash)
scripts/hooks/observers/edit-tracker.mjs         NEW  records edits + ui_edit (PostToolUse:Edit|Write)
scripts/hooks/observers/session-events.mjs       NEW  records playwright_run, live_probe (PostToolUse:Bash + browser_navigate)
scripts/hooks/rules/fix-cycle-limit.mjs          NEW  §5 block (PreToolUse:Edit|Write)
scripts/hooks/rules/lessons-before-commit.mjs    NEW  §10.16 block (PreToolUse:Bash on git commit)
scripts/hooks/rules/brainstorm-before-creative.mjs NEW §6.4 trigger 1 block (PreToolUse:Write|Edit)
scripts/hooks/rules/debugging-before-fix-edit.mjs NEW §6.4 trigger 2 block (PreToolUse:Edit|Write)
scripts/hooks/stop-rules/verify-before-success-claim.mjs NEW §6.4 trigger 3 block
scripts/hooks/stop-rules/ui-playwright-before-done.mjs   NEW §10.2 warn
scripts/hooks/stop-rules/live-url-verified.mjs           NEW §10.10 block
scripts/session-state.mjs                        MOD  §6.2 ENFORCEMENT STATE section
scripts/gate-lessons.mjs                         MOD  gains session-scope gate (exported), keeps release(vNNN)
.claude/settings.json                            MOD  PreToolUse matcher += Edit|Write; add PostToolUse, Stop
scripts/tests/test-hooks-groupb.mjs              NEW  the Group B RED/COUNTER-RED suite
scripts/tests/test-hooks-wiring.mjs              MOD  asserts the new wiring
scripts/tests/run-all.mjs                        MOD  registers test-hooks-groupb.mjs
```

Spec traceability: §6 table rows 1–5 → Tasks 4, 6, 7–9, 10, 11. §6.1 → Tasks 3–4. §6.2 → Task 5. §6.3 → Task 6. §6.4 → Tasks 7, 8, 9. §9-of-spec (checkers prove they can fail) → every task's RED. Spec build-order stage 4 ("קבוצה B — מונים + שחזור אחרי compact") → this whole plan.

---

### Task 1: PostToolUse contract measurement + `posttooluse.mjs` entry + wiring

The spec's §6.1 counter and §6.4's second trigger both need PostToolUse; it is deliberately unwired today because no rule existed for it. This task lands the entry point with the same fail-open discipline as `pretooluse.mjs`, and — because the vendor corpus in `docs/vendor/claude-code/` does **not** document the PostToolUse `tool_response` payload shape (verified by grep: `tool_response` has zero hits there) — it starts by *measuring* the real payload rather than assuming a field name.

**Files:**
- Create: `scripts/hooks/posttooluse.mjs`
- Create: `scripts/hooks/observers/` (directory; first real observer lands in Task 3 — this task proves the runner with throwaway fixture observers only, in tests)
- Modify: `.claude/settings.json` (add the PostToolUse hook)
- Test: `scripts/tests/test-hooks-groupb.mjs` (new file, section 1)

**Interfaces:**
- Produces: `runObservers(rawInput, opts) -> Promise<{events, results}>` exported from `posttooluse.mjs` for tests; observer contract: each `scripts/hooks/observers/*.mjs` exports `observe(input) -> {events?: object[]} | Promise<...>` (named or default export), where `input` is the parsed PostToolUse stdin (`session_id`, `transcript_path`, `tool_name`, `tool_input`, `tool_response`, ...). Observers RECORD (into the Task 2 store, once it exists) and never return decisions — PostToolUse here is an ear, not a mouth.
- Env overrides (test-only, same pattern as Phase 3): `POSTTOOLUSE_OBSERVERS_DIR`, `PRETOOLUSE_LOG_PATH` (shared log).

- [ ] **Step 1: Measure the real PostToolUse payload.** Before writing the runner, query the geniza first (`retrieval.search_current_docs("PostToolUse tool_response", filters={"namespace":"repo"})` and the `claude-code` tool_spec corpus); if the raw shape is still undocumented there, fetch the live hooks reference (https://code.claude.com/docs/en/hooks — the same source pipeline.mjs cites) and additionally capture one real payload: temporarily add a PostToolUse hook entry running `node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>require('fs').appendFileSync('.superpowers/hooks-state/posttooluse-capture.jsonl',d+'\n'))"`, run one succeeding and one *failing* Bash command through Claude Code, read the two captured objects, then remove the temporary hook. Record in the header comment of `posttooluse.mjs`: the exact field carrying Bash exit status / failure signal inside `tool_response` (expected per docs: `tool_response` mirrors the tool result; for Bash it includes stdout/stderr text and an interrupt/error indicator — but the *measured* names are what the code uses). **This measurement is a deliverable:** Task 3's classifier consumes the field names recorded here.
- [ ] **Step 2: Write the failing tests** in a new `scripts/tests/test-hooks-groupb.mjs` (copy the harness head of `test-hooks-groupa.mjs`: `check(label, cond, detail)`, `tempDir`, `readJsonl`, `writeRule`-style `writeObserver`, and a `runPostCli({stdin, observersDir, logPath})` helper spawning `process.execPath scripts/hooks/posttooluse.mjs`):
  - `posttooluse: malformed stdin -> exit 0, {} on stdout, malformed_input logged`
  - `posttooluse: observer that throws -> exit 0, observer_threw logged, sibling observer still ran` (fixture dir with `a-throws.mjs` throwing and `b-records.mjs` appending a marker file; assert the marker exists)
  - `posttooluse: observer returning nonsense -> observer_nonsense_return logged, exit 0`
  - COUNTER-RED: `posttooluse: empty observers dir + ordinary success payload -> exit 0, stdout {}, only the terminal 'observed' log record — no warning text anywhere`
- [ ] **Step 3: Run to verify RED** — `node scripts/tests/test-hooks-groupb.mjs`. Expected: FAIL (posttooluse.mjs does not exist). Paste output.
- [ ] **Step 4: Implement `scripts/hooks/posttooluse.mjs`.** Mirror `pipeline.mjs` + `pretooluse.mjs` collapsed into one file (observers have no severity lattice, so no separate pipeline module is warranted — YAGNI): stdin reader identical to `pretooluse.mjs`; `listObserverFiles(dir)` = `readdirSync(...).filter(f=>f.endsWith('.mjs')).sort()` with try/catch→`[]`; for each, dynamic-import, resolve `observe` (named or default), call inside try/catch; log `observer_threw` / `observer_malformed_module` / `observer_nonsense_return` (well-formed = `undefined`/`null` or an object; anything else is nonsense) to the shared `hooks-log.jsonl` via a `safeLog` copied verbatim in spirit from pipeline.mjs; final record `{kind:'observed', tool, observers_evaluated}`; always `process.stdout.write('{}')`, always `exit 0`. Default observers dir `scripts/hooks/observers/`, overridable via `POSTTOOLUSE_OBSERVERS_DIR`.
- [ ] **Step 5: Run tests to verify GREEN.** Paste output + exit code.
- [ ] **Step 6: Wire it.** In `.claude/settings.json`, add:
  ```json
  "PostToolUse": [
    { "matcher": "Bash|Edit|Write|browser_navigate",
      "hooks": [ { "type": "command", "command": "node scripts/hooks/posttooluse.mjs", "timeout": 5 } ] }
  ]
  ```
  (`browser_navigate` included now so Task 10's `live_probe` observer needs no second wiring change.) Update `scripts/tests/test-hooks-wiring.mjs` to assert this block exists (write that assertion FIRST, watch it fail, then edit settings.json).
- [ ] **Step 7: Full check** — `node scripts/tests/run-all.mjs` after registering `test-hooks-groupb.mjs` in it; then `npx playwright test` (serialized, nothing else running). Paste both.
- [ ] **Step 8: Commit** — `git add scripts/hooks/posttooluse.mjs scripts/tests/test-hooks-groupb.mjs scripts/tests/test-hooks-wiring.mjs scripts/tests/run-all.mjs .claude/settings.json && git commit -m "feat(enforcement B/1): PostToolUse entry point — the ear the §6 counters listen through"`

**RED:** a throwing observer is recorded and contained. **COUNTER-RED:** an ordinary successful Bash call flows through with zero user-visible output and zero state.

---

### Task 2: The enforcement state store — `scripts/hooks/lib/enforcement-state.mjs`

Where the counters live, and why: spec §6.2 says verbatim *"המונה שורד ב-SQLite"* — so SQLite it is, honored as written. But **not** `rules.sqlite`: that file is a derived mirror, rebuilt from Postgres at will (spec §4.2/§4.6); session counters written there would be erased by any rebuild and would violate the mirror-checksum gate (`check-rules-mirror`). Counters are *session state*, not *rules*, so they get their own file next to the agent ledger: `.superpowers/hooks-state/enforcement-state.sqlite`, via `node:sqlite`'s `DatabaseSync` (built-in, zero deps, synchronous — correct for a 50 ms-budget hook). Postgres is explicitly wrong here per spec §4.1's own reasoning: hooks must work when the daemon is down.

**Files:**
- Create: `scripts/hooks/lib/enforcement-state.mjs`
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 2)

**Interfaces (produced — every later task consumes these exact signatures):**
```js
export function statePath()                    // env ENFORCEMENT_STATE_PATH || .superpowers/hooks-state/enforcement-state.sqlite
export function openState(path = statePath())  // -> DatabaseSync with schema ensured + TTL prune applied; null on ANY failure (fail-open)
export function recordEvent(db, { sessionId, kind, detail })        // kind: 'bash_failure'|'verification_failure'|'verification_pass'|'edit'|'ui_edit'|'playwright_run'|'live_probe'|'commit'; detail: JSON-string payload
export function lastEvent(db, sessionId, kind)                      // -> {ts, detail} | null (newest matching row)
export function eventCountSince(db, sessionId, kind, sinceTs)       // -> number
export function openTargets(db, sessionId)                          // -> [{target, attempts, lastFailureTs, editedSinceFailure}]
export function noteVerificationFailure(db, sessionId, targets)     // per §6.1: for each failing-test id — new target: insert attempts=0; existing target with editedSinceFailure=1: attempts+1, editedSinceFailure=0 (a closed cycle just completed)
export function noteEdit(db, sessionId, filePath)                   // sets editedSinceFailure=1 on ALL open targets of the session + recordEvent('edit')
export function noteVerificationPass(db, sessionId, passedTargets)  // deletes those target rows (counter resets); passedTargets===ALL wipes the session's targets
export const TTL_MS                                                  // 24h; prune on open: DELETE rows older than TTL
```
Schema (created idempotently in `openState` with `CREATE TABLE IF NOT EXISTS`):
```sql
events(id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL, detail TEXT);
fix_targets(session_id TEXT NOT NULL, target TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
            edited_since_failure INTEGER NOT NULL DEFAULT 0, last_failure_ts INTEGER NOT NULL,
            PRIMARY KEY (session_id, target));
```
Every function body is wrapped so that any sqlite error returns the fail-open value (`null` / `[]` / `0` / no-op) — a corrupt or locked DB must never become a block (agent-ledger.mjs precedent, comment it the same way).

- [ ] **Step 1: Write the failing tests** (all against a temp `ENFORCEMENT_STATE_PATH`):
  - `state: attempts survive a fresh process` — spawn `node -e` child that opens the same path and reads `openTargets`; assert attempts persisted (this is the §6.2 "the counter survives" property).
  - `state: §6.1 cycle semantics` — failure(T) → attempts 0; edit → failure(T) → attempts 1; failure(T) again with NO edit between → attempts stays 1 (**a re-run that fails without an edit is not a new attempt — no cycle closed**); edit → pass(T) → target gone.
  - `state: three different failing tests are three first attempts` — failures on T1,T2,T3 interleaved with edits never push any single target past 1 (§6.1's exact sentence, as a test).
  - COUNTER-RED: `state: another session's rows are invisible` — seed under session A, query under session B → `openTargets` empty, `eventCountSince` 0.
  - COUNTER-RED: `state: TTL prune` — insert a row with ts = now−25h, `openState` again → gone.
  - `state: corrupt DB file -> openState returns null, no throw` — write garbage bytes to the path first.
- [ ] **Step 2: Run — verify RED** (module missing). Paste.
- [ ] **Step 3: Implement** per the interface block above (`import { DatabaseSync } from 'node:sqlite'`).
- [ ] **Step 4: Run — verify GREEN.** Paste output + exit code.
- [ ] **Step 5: Compact-identity measurement (documentation step, feeds the State-lifecycle table).** In a real Claude Code session: note `session_id` from a fresh `hooks-log.jsonl` decision record (Task 1 wiring is live), trigger `/compact`, run another tool call, compare ids. Record the observed answer in `enforcement-state.mjs`'s header comment ("measured YYYY-MM-DD: session_id {is,is not} stable across compact") and, ONLY IF it is not stable, add `newestSessionRows(db)` (rows of the most-recent session_id within TTL) for Task 5's announcer — blocking rules still key strictly on the current id (fail-open).
- [ ] **Step 6: run-all + suite green; commit** — `git commit -m "feat(enforcement B/2): the state store — §6's counters get a floor that survives compact"`

**RED:** cycle counting matches §6.1 exactly, proven against its two trap cases. **COUNTER-RED:** cross-session invisibility and TTL — the two properties that make a permanent stale block impossible.

---

### Task 3: Verification classifier + failing-test targets + the recording observers

§6.1's key is *the failing test, not the edited file*. This task builds the extractor that turns a failed verification command's output into failing-test identifiers, and the PostToolUse observers that feed the store. Miscounting here BLOCKS a human mid-debugging — the COUNTER-RED cases are the point of the task.

**Files:**
- Create: `scripts/hooks/lib/verification-target.mjs`
- Create: `scripts/hooks/observers/verification-outcomes.mjs`
- Create: `scripts/hooks/observers/edit-tracker.mjs`
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 3)

**Interfaces:**
- Consumes: Task 1's measured `tool_response` field names; Task 2's store API.
- Produces:
  ```js
  // verification-target.mjs
  export function classifyCommand(command) // -> {isVerification: boolean, runner: 'playwright'|'pytest'|'node-test'|null}
  //   isVerification=true for: /(^|\s)(npx\s+)?playwright\s+test/, /(^|\s)pytest(\s|$)/, /node\s+scripts[\/\\]tests[\/\\]run-all\.mjs/, /node\s+scripts[\/\\]check-[\w-]+\.mjs/, /node\s+scripts[\/\\]tests[\/\\]test-[\w-]+\.mjs/
  //   false for EVERYTHING else — npm install, git, grep, build.py, curl. Bias: under-classify. A missed
  //   verification command costs one uncounted cycle; a false classification costs a wrongful block.
  export function extractFailingTargets(runner, outputText) // -> string[] of stable test ids
  //   pytest:      /^FAILED\s+(\S+::\S+)/m               -> "tests/test_x.py::test_y"
  //   playwright:  /^\s*[✘✗x]\s+\d*\s*(?:\[.+?\]\s*›\s*)?(.+?)(?:\s+\(\d+m?s\))?$/m and the
  //                failure-list block /^\s+\d+\)\s+(\S+\.spec\.ts:\d+:\d+)\s*›\s*(.+)$/m -> "file › title"
  //   node-test:   /^FAIL\s+(.+)$/m (the run-all harness's own `FAIL  label` lines) -> the label
  //   Unparseable output on a failed verification -> [] and the observer records kind 'verification_failure'
  //   with target '(unattributed)' — COUNTED for §10.16's session-failure total, NEVER for §6.1's per-target
  //   counter (an unattributed failure must not be able to block an edit).
  ```
  - `verification-outcomes.mjs` `observe(input)`: only `tool_name==='Bash'`; `classifyCommand(input.tool_input.command)`; on verification failure (per Task 1's measured failure signal in `tool_response`) → `noteVerificationFailure(db, session_id, targets)` + `recordEvent('verification_failure')` per target; on verification success → `noteVerificationPass(db, session_id, ALL)` when the run was suite-wide (no test filter in the command), else pass only the named filter targets; ALSO: any Bash nonzero exit (verification or not) → `recordEvent('bash_failure', {command: first 200 chars})` EXCEPT commands whose nonzero exit is an answer, matched by leading word of any segment (reuse main-only-no-worktrees.mjs's `segments`/`tokenize` approach): `grep|rg|findstr|test|diff|cmp|which` (feeds Task 8; breadth is Owner Question Q2); and `git commit` success → `recordEvent('commit')` (feeds Task 6).
  - `edit-tracker.mjs` `observe(input)`: only `Edit|Write`; `noteEdit(db, session_id, file_path)`; additionally `recordEvent('ui_edit')` when `file_path` basename is `app.js`, `app.css`, or `index.html` under the repo root (feeds Task 10).
- [ ] **Step 1: Write the failing tests** — classifier table-driven:
  - RED: `pytest FAILED tests/test_ingest.py::test_delta -> ['tests/test_ingest.py::test_delta']`; playwright ✘-line and failure-list forms; run-all `FAIL  state: TTL prune` form; `npx playwright test` classified verification.
  - COUNTER-RED (the Phase-3-bar cases): `npm install` exit 1 → `isVerification:false`, no target; `grep -q foo file` exit 1 → NOT recorded as `bash_failure`; a PASSING playwright run whose *stdout mentions* a test title → zero targets extracted (extraction only runs on failure); `git commit` → `commit` event, not a failure.
  - Observer integration (temp state DB + synthetic PostToolUse payloads built from Task 1's captured shapes): failure→edit→failure yields attempts 1 for exactly the failing id; suite-wide pass wipes; filtered pass (`npx playwright test tests/foot-news.spec.ts`) wipes only matching targets; unattributed failure increments session failure count but `openTargets` stays empty.
- [ ] **Step 2: RED witnessed** (module missing). Paste.
- [ ] **Step 3: Implement the three files.** Observers open the store per-invocation (`openState()`; if null → return silently), never scan the transcript, never shell out — the 50 ms budget line.
- [ ] **Step 4: GREEN.** Paste. **Step 5:** run-all + suite. **Step 6: Commit** — `git commit -m "feat(enforcement B/3): the counters learn to count — the key is the failing test, not the file"`

---

### Task 4: §5 fix-cycle limit — the block (PreToolUse `Edit|Write`)

Spec §6 row 1: counted = closed failure→edit→verify cycles **on the same target**; threshold **4**; response **block + duty to raise to owner**. §5's own text: after 3 failed fixes STOP, do not attempt fix #4. So: when any open target of THIS session has `attempts >= 3` and `edited_since_failure` would begin cycle 4, the Edit/Write blocks.

**Files:**
- Create: `scripts/hooks/rules/fix-cycle-limit.mjs`
- Modify: `.claude/settings.json` (PreToolUse matcher `Bash|Grep|WebSearch|Agent|browser_navigate` → `Bash|Grep|WebSearch|Agent|browser_navigate|Edit|Write`)
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 4); `scripts/tests/test-hooks-wiring.mjs` (matcher assertion)

**Interfaces:** standard rule `evaluate(input) -> {decision, reason}`; consumes Task 2's `openState`/`openTargets`. Placement note for the reviewer: this rule lives in the SAME `rules/` dir as Group A and therefore also receives Bash/Grep/Agent events — its first line returns allow for anything that isn't `Edit|Write` (pipeline discovery pattern, no dispatcher to edit).

- [ ] **Step 1: Failing tests first:**
  - RED: seed state (session S, target `tests/test_x.py::test_y`, attempts 3, edited_since_failure 0) → `evaluate({tool_name:'Edit', session_id:'S', tool_input:{file_path:'C:/repo/model.py'}})` → `decision:'block'`, reason contains `§5`, the target name, `3`, and the alternative ("raise the architecture question with the owner"; quote §5's provenance per spec §4.7 — the reason cites that §5 was written after a real failure).
  - RED-2 (regression pair for DoD-7 discipline): attempts 2 → allow (not yet the 4th cycle).
  - COUNTER-RED: different session id with attempts 3 → allow. No open targets → allow. State DB unreadable (garbage file) → allow with reason naming the degradation. **Strictly-sequential-work case (the Task-5-of-Phase-3 lesson, replayed on purpose):** failure(T)→edit→pass(T)→failure(T)→edit→pass(T) repeated 6 times → every edit allowed, attempts never exceed 1 — success resets, always.
  - COUNTER-RED (Bash passthrough): `evaluate({tool_name:'Bash',...})` → allow, reason "not an Edit/Write".
- [ ] **Step 2: RED witnessed.** Paste. **Step 3: Implement** (~40 lines: guard tool_name; `openState()`; null→allow; `openTargets(db, input.session_id)`; find any with `attempts>=3` → block with the composed reason; else allow).
- [ ] **Step 4: GREEN.** Paste.
- [ ] **Step 5: Wire Edit|Write into the PreToolUse matcher** (wiring-test-first, as Task 1 step 6). Overhead statement for the record: this adds one ~50 ms spawn per Edit; it is the only interception point that can stop fix #4 *before* it happens, which is the spec's verbatim demand — accepted.
- [ ] **Step 6:** run-all + full suite. **Step 7: Commit** — `git commit -m "feat(enforcement B/4): §5 stops being advisory — the fourth fix attempt meets a wall with a door marked 'owner'"`

**Owner Question Q1 (raised, not decided here):** §5's block has its compatible alternative — the owner conversation — but the *resumption mechanics* need an artifact: what evidence resets the counter after the conversation happens? Proposal (patterned on the doc's existing visible `No-lesson declaration` escape, which is a *visible record*, not a bypass): an appended line in the session's `.superpowers/hooks-log.jsonl`-adjacent record via a documented command quoting the owner's ruling, always surfaced in the session summary. Risk to rule on: an agent could write that record unilaterally. Until the owner rules, the implemented reset paths are ONLY: verification passes, or session end (new session_id). This narrows nothing — it is the strictest reading — but it means a genuinely owner-approved architecture change within the same session must make its first verification pass via edits... which are blocked. **This needs the owner's ruling before Task 4 ships; the task is otherwise complete and testable.**

---

### Task 5: §6.2 — ENFORCEMENT STATE, restored after compact

An extension of `scripts/session-state.mjs` (which already runs on `startup|resume|compact` via SessionStart), NOT a second mechanism. It renders the spec's exact block:

```
=== ENFORCEMENT STATE, restored after compact ===
  §5      fix attempts on `model.py::_resolve_source`: 2 of 3
  §10.16  failures this arc: 4 · lessons logged: 1  ⚠ 3 uncovered
  infra   geniza OK · rules mirror OK · serena DISCONNECTED ⚠
```

**Files:**
- Modify: `scripts/session-state.mjs` (new exported `enforcementState()`; called from `buildReport()` right after the LANDED section)
- Test: `scripts/tests/test-session-state.mjs` (extend — it already fixtures this script via env overrides)

**Interfaces:**
- Consumes: Task 2's store (`ENFORCEMENT_STATE_PATH` env override for fixtures; reads the **newest session's rows within TTL** — see Task 2 step 5's note: announcement is id-agnostic on purpose, blocking is not); `.superpowers/watchman-log.jsonl` (last record per component) for the `infra` line — watchman (Phase 2's layer 0) is the existing source of geniza/serena/mirror health, this task only *reads its newest verdicts*, never probes (probing at SessionStart is watchman's own job, already wired).
- Produces: `enforcementState() -> string` (multi-line, or the explicit `ENFORCEMENT STATE: no open counters, no uncovered failures` when empty — an absent section would read as "no mechanism ran", which is the confident-silence failure this script's header forbids).

- [ ] **Step 1: Failing tests first** (fixture: temp sqlite seeded via Task 2's API + temp watchman log):
  - RED: seeded target attempts 2 + 4 failure events + 1 lesson-logged... (lessons count comes from Task 6's `sessionLessonGate` summary — until Task 6 lands, render `lessons: see commit gate` and update in Task 6; the test asserts the §5 line exactly: contains `` §5      fix attempts on `tests/test_x.py::test_y`: 2 of 3 ``).
  - RED-2: watchman log whose last serena record is a failure → line contains `serena DISCONNECTED ⚠`.
  - COUNTER-RED: empty state DB + healthy watchman log → the single "no open counters" line, script exits 0, nothing that could be read as a warning.
  - COUNTER-RED-2 (fail-open): `ENFORCEMENT_STATE_PATH` pointing at garbage → section renders `ENFORCEMENT STATE: state store unreadable — counters unknown, not asserted` and the script STILL exits 0 (orientation is not a gate — file's own contract).
- [ ] **Step 2: RED.** Paste. **Step 3: Implement** inside session-state.mjs using `safe('enforcement', ...)` like every other section. **Step 4: GREEN**; run-all + suite. **Step 5: Commit** — `git commit -m "feat(enforcement B/5): §6.2 — compact no longer erases the knowledge of the counter, only the memory of it"`

---

### Task 6: §10.16 / §6.3 — the lessons-at-commit gate

Spec §6.3 verbatim: at commit — failures recorded this session > 0 AND no lesson (`**L<n> ·`) and no no-lesson declaration added since the previous commit ⇒ block. `gate-lessons.mjs` today knows only `release(vNNN)`; this is the explicit gap the spec names.

**Files:**
- Modify: `scripts/gate-lessons.mjs` (extract + export; existing release-scope CLI behavior unchanged)
- Create: `scripts/hooks/rules/lessons-before-commit.mjs`
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 6)

**Interfaces:**
- Produces (in gate-lessons.mjs): `export function sessionLessonGate({ failuresSinceLastCommit, disciplineDiffText }) -> { pass: boolean, reason: string }` — pure logic, no I/O, so the rule and the tests share one truth: pass iff `failuresSinceLastCommit === 0` OR `disciplineDiffText` contains a NEW `\*\*L\d+\s*·` line or a NEW `\*\*No-lesson declaration \(\d{4}-\d{2}-\d{2}\)` line (lines prefixed `+` in a unified diff).
- The rule `lessons-before-commit.mjs` `evaluate(input)`: only `tool_name==='Bash'` whose command tokenizes to a `git commit` segment (reuse the segment/leading-word technique from main-only-no-worktrees.mjs — `echo "git commit"` must pass); compute `failuresSinceLastCommit` = Task 2's `eventCountSince(db, session_id, 'verification_failure', lastEvent(db, session_id, 'commit')?.ts ?? 0)` (**operational reading, Owner Question Q4:** failures are counted since the last commit *event in this session*, not since session start — the literal per-session total would re-block every later commit of a session that already covered its failures once, i.e. a trap §2.2 forbids); `disciplineDiffText` = `execFileSync('git', ['diff', 'HEAD', '--', 'docs/process/development-discipline.md'])` — **from disk, not from staging** (spec §4.2 doctrine: the builder derives from disk; an unstaged lesson still counts because `git commit -a` and a follow-up `git add` are both legitimate orders of work — the gate asks "was the lesson WRITTEN", not "was it staged"); shell-out cost ~50–100 ms accepted: it runs only on `git commit`, a rare call. Fail-open: any git/db failure → allow with degradation reason.
- [ ] **Step 1: Failing tests first:**
  - RED: 2 failures since last commit + empty discipline diff → block; reason names §10.16, the count, and BOTH alternatives verbatim (write `**L<n> ·` / add `**No-lesson declaration (YYYY-MM-DD):** <arc> — reason`).
  - COUNTER-RED (three, per spec's own legitimacy argument): zero failures → allow silently · failures + diff containing `+**L63 · הלקח (2026-08-08).**` → allow · failures + diff containing a new no-lesson declaration → allow.
  - COUNTER-RED-2: `git commit` in a session whose failures all predate its last commit event → allow (Q4 reading, tested explicitly so the owner can see exactly what it does).
  - COUNTER-RED-3: non-commit Bash (`git status`, `echo "git commit"`) → allow.
  - Pure-function tests for `sessionLessonGate` covering the same table without any git.
- [ ] **Step 2: RED.** Paste. **Step 3: Implement** (refactor gate-lessons.mjs: move current top-level code under `if (isMain())`-style guard — the pattern session-state.mjs already uses — so importing it stops executing the release gate; regression-check `node scripts/gate-lessons.mjs` still prints the same release verdict, pasted). **Step 4: GREEN** + run-all + suite. **Step 5:** update Task 5's `§10.16` line to render `failures this arc: N · lessons logged: <sessionLessonGate verdict> ⚠ K uncovered` from the same primitives (test updated first). **Step 6: Commit** — `git commit -m "feat(enforcement B/6): §10.16 closes at the commit, not at the release — a failure now costs a lesson or a declaration, never silence"`

---

### Task 7: §6.4 trigger 1 — brainstorming before creative work

Spec row: creative work (new spec/plan/feature) before an approved design exists · required skill `brainstorming` · detected as: a write to `docs/superpowers/specs|plans` or a new source file, without an approved spec · **block**, alternative: invoke the skill (a minute).

**Files:**
- Create: `scripts/hooks/lib/skill-invoked.mjs`
- Create: `scripts/hooks/rules/brainstorm-before-creative.mjs`
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 7)

**Interfaces:**
- `skill-invoked.mjs`: `export function skillInvokedSince(transcriptPath, skillNameRe, sinceMs, nowMs = Date.now()) -> { determined, invoked }` — geniza-consult.mjs cloned in structure (tail read ≤512 KB, per-line JSON.parse, timestamp window, fail-to-`determined:false`), but matching `tool_use` blocks with `name === 'Skill'` and `input.skill` matching `skillNameRe`. **Step 0 of this task measures the real transcript shape of a Skill invocation** (read an actual `~/.claude/projects/<proj>/<session>.jsonl` after invoking a skill; geniza-consult did exactly this for retrieval calls) and records it in the lib header; if skills additionally appear as `<command-name>` text blocks, match those too — the measurement decides.
- Rule `evaluate(input)`: only `Write|Edit`; gating condition, cheap checks first: `file_path` normalized; **branch A** — under `docs/superpowers/specs/` or `docs/superpowers/plans/`: pass iff `skillInvokedSince(transcript, /brainstorming|writing-plans/, SESSION_WINDOW)` is `determined && invoked` (writing-plans accepted for plans/ because an approved spec is its precondition by the skill's own contract) OR (plans/ only) an approved spec exists; **branch B** — a NEW source file (`!existsSync(file_path)` AND extension in `{.js,.mjs,.py,.ts,.css,.html}` AND path NOT under `docs/`, `scripts/tests/`, `tests/`, `.superpowers/`, `mockups/`, scratchpad): pass iff an approved spec exists AND an active arc ledger exists (import `findLedgers` from `scripts/session-state.mjs` — it is already exported), OR the brainstorming skill was invoked. "Approved spec exists" operationalized as: some `docs/superpowers/specs/*.md` contains `אושר על-ידי הבעלים` (the exact status line the governing spec itself carries) — **Owner Question Q3** covers whether this evidence bar is right. Transcript scan (~120–150 ms) runs ONLY when a cheap branch condition already matched — ordinary edits never pay it. Block reason names the alternative verbatim: invoke `superpowers:brainstorming`.
- [ ] **Step 1: Failing tests first** (fixture transcript files written by the test, per the measured shape):
  - RED: Write to `docs/superpowers/specs/new-thing.md`, transcript with no Skill entries → block naming brainstorming.
  - RED-2: NEW `src/foo.py` with no approved spec on disk (SPECS_DIR env-pointed at empty fixture dir) → block.
  - COUNTER-RED: same spec-write with a transcript containing a brainstorming Skill invocation inside the window → allow · Write to `docs/superpowers/plans/x.md` with an approved-marker spec in the fixture SPECS_DIR → allow · **Edit to an EXISTING source file → allow, no transcript read** (assert speed indirectly: rule returns before any transcript fixture is even created — pass a nonexistent transcript path and assert allow, proving the cheap path never consulted it) · new file under `scripts/tests/` → allow (a test file during TDD is not "creative work before design") · unreadable transcript on a gating path → allow (`determined:false`, never an accusation).
- [ ] **Step 2: RED.** Paste. **Step 3: Implement.** **Step 4: GREEN** + run-all + suite. **Step 5: Commit** — `git commit -m "feat(enforcement B/7): no code before an approved design stops being a sentence and becomes a gate"`

---

### Task 8: §6.4 trigger 2 — systematic-debugging between a failure and the fix

Spec row: a failure (exit ≠ 0) followed by an edit · required skill `systematic-debugging` · detected via PostToolUse on the failed Bash → then the Edit · **block**, alternative: invoke the skill.

**Files:**
- Create: `scripts/hooks/rules/debugging-before-fix-edit.mjs`
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 8)

**Interfaces:** consumes Task 3's `bash_failure` events (which already exclude exit-code-as-answer commands — Q2) and Task 7's `skillInvokedSince`. `evaluate(input)`: only `Edit|Write`; cheap check: `lastEvent(db, session_id, 'bash_failure')` — none, or one OLDER than the session's last `verification_pass`/newer `bash success` marker? Simpler and honest: gate on `lastEvent('bash_failure')` existing and being ≤ 30 minutes old AND no `skillInvokedSince(transcript, /systematic-debugging/, sinceMs = that failure's ts)`. Once the skill is invoked after the failure, all subsequent edits pass until a NEW failure. Only when the cheap state says "recent unaddressed failure" does the transcript scan run.

- [ ] **Step 1: Failing tests first:**
  - RED: seeded `bash_failure` (ts now−60 s) + transcript without the skill → Edit blocks; reason names systematic-debugging and quotes the alternative.
  - COUNTER-RED (the mid-debugging human, protected): seeded failure + transcript WITH a systematic-debugging invocation dated after the failure → allow · no failure recorded → allow, transcript never read (nonexistent-path trick from Task 7) · failure recorded by ANOTHER session → allow · failure 31+ minutes old → allow (staleness backstop — a forgotten morning failure cannot block afternoon work; this is the per-counter no-permanent-block guarantee) · `grep` exit 1 earlier in the session → no `bash_failure` row exists at all (asserted via Task 3's observer, replayed here end-to-end).
- [ ] **Step 2: RED.** Paste. **Step 3: Implement.** **Step 4: GREEN** + run-all + suite. **Step 5: Commit** — `git commit -m "feat(enforcement B/8): a red exit code now demands the debugging skill before the next edit, not after the third guess"`

---

### Task 9: Stop entry point + claim scanner + §6.4 trigger 3 (verification before a success claim)

Trigger 3 fires on *assistant reply text* ("עובד", "בוצע", "ירוק") — not on any tool call — so its natural hook is **Stop** (fires when Claude finishes responding; per the vendor corpus already in-repo, `docs/vendor/claude-code/claude-code-docs-47.md`, its input carries `stop_hook_active`, and a `{"decision":"block","reason":...}` output makes Claude continue and address the reason). §10.2 and §10.10 (Tasks 10–11) are also claim-shaped and reuse this entry.

**Files:**
- Create: `scripts/hooks/stop.mjs`
- Create: `scripts/hooks/lib/claim-scan.mjs`
- Create: `scripts/hooks/stop-rules/verify-before-success-claim.mjs`
- Modify: `.claude/settings.json` (add Stop hook)
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 9); `test-hooks-wiring.mjs`

**Interfaces:**
- `stop.mjs`: same skeleton as `pretooluse.mjs` but over `scripts/hooks/stop-rules/` (env `STOP_RULES_DIR` for tests), reusing `runPipeline` from `pipeline.mjs` with `{rulesDir}` pointed there (the internal allow/warn/block lattice is identical); output translation: `block` → `{"decision":"block","reason":reason}` · `warn` → `{"systemMessage":reason}` · `allow` → `{}`. **Loop guard, before anything else:** if parsed input has `stop_hook_active === true`, print `{}` and exit 0 — a Stop hook that blocks its own continuation forever is this entry point's one novel failure mode, and it is closed structurally, not by rule discipline.
- `claim-scan.mjs`:
  ```js
  export function lastAssistantText(transcriptPath) // -> {determined, text} — tail-read (512KB), newest entry with type 'assistant', concat its message.content text blocks
  export function detectsSuccessClaim(text)  // -> boolean; /(?:^|[\s.,!:])(עובד|בוצע|הושלם|תוקן|ירוק|עבר(?:ו)? הבדיק|works|done|fixed|passing|all green|complete[d]?)(?=[\s.,!:]|$)/i
  export function detectsLiveClaim(text)     // -> boolean; /(גרסה חיה|עלה לאוויר|באוויר|מהדורה \d+ (?:חיה|עלתה|באוויר)|is live|deployed and live)/i
  export function containsQuotedEvidence(text) // -> boolean; a fenced code block (```...```) OR /exit code[:\s]*0/i OR /\d+ passed/ OR /PASS/ — pasted output, the DoD's own currency
  ```
- Rule `verify-before-success-claim.mjs`: `lastAssistantText`; not determined → allow; no success claim → allow; claim present → pass if `containsQuotedEvidence(text)` OR `skillInvokedSince(transcript, /verification-before-completion/, sinceMs = 30 min)`; else **block** with reason: quote the claim snippet, name the skill and the paste-the-output alternative.
- [ ] **Step 1: Failing tests first** (fixture transcripts; `runStopCli` helper like `runCli`):
  - RED: stop.mjs entry — throwing stop-rule → `{}` + exit 0 + logged (same triad as Task 1) · `stop_hook_active:true` with a blocking rule seeded → `{}` (the loop guard) · trigger-3: assistant text "הכל עובד, סיימתי" with no code fence, no skill → stdout JSON has `decision:"block"` and reason contains `verification-before-completion`.
  - COUNTER-RED: "הכל עובד — הנה הפלט:" followed by a fenced block with `12 passed` → `{}` · a question ("האם זה עובד אצלך?") — the claim regex requires the claim word as a standalone statement token, and THIS case is in the test table; if the simple regex can't pass it, the regex gains a question-mark-suffix exclusion (`(?![^.!\n]*\?)` on the containing sentence) — the counter case drives the pattern, not vice versa · a reply with no claim at all → `{}` · unreadable transcript → `{}`.
- [ ] **Step 2: RED.** Paste. **Step 3: Implement all three files.** **Step 4: GREEN.** **Step 5: Wire** `"Stop": [{ "hooks": [{ "type": "command", "command": "node scripts/hooks/stop.mjs", "timeout": 10 }] }]` (wiring-test-first). Overhead: one transcript tail read per assistant turn (~120–150 ms), once per *reply* rather than per tool call — inside budget by construction. **Step 6:** run-all + suite. **Step 7: Commit** — `git commit -m "feat(enforcement B/9): a success claim now costs evidence at the moment it is uttered"`

---

### Task 10: §10.2 — UI touched → Playwright ran, before "בוצע" (warn)

Spec §6 row 4, severity **warn** — never block. Claim-shaped, so a stop-rule.

**Files:**
- Create: `scripts/hooks/stop-rules/ui-playwright-before-done.mjs`
- Modify: `scripts/hooks/observers/session-events.mjs` — CREATE here (Task 3 deliberately left it out): `observe(input)` records `playwright_run` on Bash whose command classifies `runner:'playwright'` (reusing Task 3's `classifyCommand` — pass or fail, a run is a run: §10.2 asks "did Playwright RUN", the pass/fail axis belongs to §6.1) and `live_probe` on `browser_navigate` whose URL contains `matkonetesh.pages.dev` OR Bash `curl|node scripts/live-smoke.mjs` targeting that host (feeds Task 11 too).
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 10)

**Interfaces:** consumes `lastEvent(db, session, 'ui_edit')` (Task 3's edit-tracker) and `lastEvent(db, session, 'playwright_run')`; `detectsSuccessClaim` (Task 9). Logic: success claim AND `ui_edit` exists AND (`playwright_run` missing OR older than the newest `ui_edit`) → **warn** (systemMessage): "§10.2: קוד UI נערך אחרי הריצה האחרונה של Playwright — a feature is not verified until seen working in the UI; run the suite or drive the app before 'בוצע'." Else silence.

- [ ] **Step 1: Failing tests first.** RED: seeded `ui_edit` (now−5 min), no `playwright_run`, claim text → stop output contains `systemMessage` with `§10.2`, and NO `decision` field (warn must not block — asserted explicitly). COUNTER-RED: ui_edit then playwright_run (newer) then claim → `{}` · claim with no ui_edit this session → `{}` · ui_edit but reply makes no claim → `{}` · edit to `scripts/hooks/...` (non-UI) recorded only as `edit`, not `ui_edit` → `{}`.
- [ ] **Step 2: RED.** Paste. **Step 3: Implement** (observer + rule). **Step 4: GREEN** + run-all + suite. **Step 5: Commit** — `git commit -m "feat(enforcement B/10): §10.2 — 'בוצע' after a UI edit now asks where the Playwright run is"`

---

### Task 11: §10.10 — a push is not a release: the live-claim block

Spec §6 row 5, severity **block**: the claim "live" requires the live URL to have actually been probed. The alternative path already exists in the repo: `scripts/live-smoke.mjs` (probes `https://matkonetesh.pages.dev`, waits for `.foot-stamp`).

**Files:**
- Create: `scripts/hooks/stop-rules/live-url-verified.mjs`
- Test: `scripts/tests/test-hooks-groupb.mjs` (section 11)

**Interfaces:** consumes `detectsLiveClaim` (Task 9) and `lastEvent(db, session, 'live_probe')` (Task 10's observer). Logic: live claim AND no `live_probe` event in this session within 30 minutes → **block**, reason: "§10.10: a push is not a release — הטענה 'חי' דורשת בדיקה של ה-URL החי. Run `node scripts/live-smoke.mjs` (or browser_navigate https://matkonetesh.pages.dev and read `.foot-stamp`), then say it. Cloudflare Pages takes minutes — poll, do not assume." 30-minute freshness: a probe from this morning does not license an afternoon claim about a *new* push; and it doubles as the staleness backstop (no permanent state can hold this gate shut — the alternative is always one command away).

- [ ] **Step 1: Failing tests first.** RED: text "מהדורה 291 חיה" + no live_probe → `decision:"block"`, reason names `live-smoke.mjs`. COUNTER-RED: same claim + `live_probe` event 2 minutes old → `{}` · "הגרסה המקומית עובדת" / "the dev server shows it" → **no live-claim detected** → `{}` (the pattern must not confuse local-works with live — this is the miscount-blocks-a-human case for this rule) · live_probe 31+ min old → block (freshness asserted both directions) · another session's probe → block.
- [ ] **Step 2: RED.** Paste. **Step 3: Implement.** **Step 4: GREEN** + run-all + suite. **Step 5: Commit** — `git commit -m "feat(enforcement B/11): §10.10 — 'live' is now a probed fact, not a hopeful adjective"`

---

### Task 12: Integration — end-to-end scenarios, wiring audit, overhead measurement

**Files:**
- Modify: `scripts/tests/test-hooks-groupb.mjs` (end-to-end section), `scripts/tests/test-hooks-wiring.mjs` (final wiring truth: PreToolUse matcher includes Edit|Write; PostToolUse and Stop present with the exact commands/timeouts)
- Test: everything.

- [ ] **Step 1: End-to-end scenario tests** driving the REAL CLIs (`pretooluse.mjs`, `posttooluse.mjs`, `stop.mjs`) with one shared temp state DB + fixture transcript, replaying whole stories:
  - *The §5 story:* verification fails (post) → edit allowed (pre) → fails → edit → fails → edit → fails ⇒ attempts 3 → **next edit blocked** (pre) → simulate new session_id ⇒ edit allowed (crash never wedges).
  - *The §10.16 story:* failure recorded → `git commit` blocked → fixture discipline-doc gains a `+**L63 ·` diff line → commit allowed.
  - *The honest-day story (the Phase-3 bar, 0 false interventions):* a scripted sequence of 20 ordinary events — greps, successful bashes, edits with no open failures, a passing suite, a commit after a green session, a reply with pasted output — asserting **zero** warn/block across all three entry points. This test is the plan's single most important deliverable.
- [ ] **Step 2: RED** for any scenario that fails (fix via systematic-debugging, never re-run-until-green). Paste.
- [ ] **Step 3: Overhead measurement, recorded not estimated:** time 20 invocations each of `pretooluse.mjs` (Edit payload, no open state), `posttooluse.mjs` (Bash success), `stop.mjs` (no-claim reply) via `node -e` loop with `performance.now()`; paste medians into the task report and into a header comment in `posttooluse.mjs`. Acceptance: Edit-path pre-hook median ≤ ~80 ms with no gating condition (spawn + sqlite open); anything above gets investigated before ship, not shrugged at.
- [ ] **Step 4:** `node scripts/tests/run-all.mjs` + `npx playwright test` (serialized, idle machine) + `node scripts/check-meta.mjs` all green. Paste all three.
- [ ] **Step 5:** Update `docs/STATUS-BOARD.md` (H10) — Group B row; H9 table in the closing report.
- [ ] **Step 6: Commit** — `git commit -m "feat(enforcement B/12): Group B lands whole — counters, gates, restoration, and the proof they stay silent on an honest day"`

---

## Self-review against the spec (performed while writing)

- §6 table rows 1–5: Tasks 4, 6, 7–9, 10, 11 — all five severities as written, none softened. ✔
- §6.1 both sentences implemented as tests, including the three-different-failures trap. ✔ (Task 2/3)
- §6.2 exact block format, plugged into session-state.mjs as an extension. ✔ (Task 5)
- §6.3 both conditions + both alternatives; `gate-lessons.mjs` extension named. ✔ (Task 6)
- §6.4 all three triggers, all blocks, each with its one-minute alternative. ✔ (Tasks 7–9)
- §2.1 no bypass anywhere: no rule reads an off-switch; test env vars redirect state paths only. ✔
- Nothing waived or deferred; the four points where the spec's letter meets an implementation constraint are raised as owner questions below rather than decided quietly.

## Owner rulings — 2026-08-08, in conversation (per §4: raised, and now RESOLVED)

| | Ruling |
|---|---|
| **Q1** | **A documented owner-decision record resets the §5 counter.** Same visible shape as the existing No-lesson declaration. The owner accepted the stated risk that an agent could write it: this layer exists against FORGETTING, not against malice, and the strict alternative leaves owner-approved work blocked inside its own session. Task 4 implements it and the deny reason must name it. |
| **Q2** | **Exclusion list APPROVED as proposed:** `grep`, `diff`, `test`, `cmp` only — tools whose exit 1 is a finding. Everything else counts. |
| **Q3** | **NOT the proposed marker line — the REGISTER.** Evidence that an approved spec exists is a row in the gap register (`docs/ROADMAP-2026-07-30.md`) naming that spec. This is the strictest of the three options offered and it was chosen deliberately. Task 7 is re-scoped accordingly: the marker-line reading is OUT. Operational reading, stated so it can be corrected rather than assumed: a register row whose text contains the spec's filename. If the owner meant something narrower (a dedicated approval column, a fixed marker inside the row), Task 7 raises it before coding rather than guessing. |
| **Q4** | **Failures counted since the last commit event in this session** — confirmed. The literal reading is the trap §2.2 forbids. |

## Open questions as originally raised (kept for provenance — all four are now ruled above)

- **Q1 (§5 reset mechanics):** After the mandated owner conversation, what artifact resets the fix-cycle counter mid-session? Proposed: a visible, logged owner-decision record (No-lesson-declaration pattern); risk: agent-writable. Until ruled, resets are only verification-pass or new session — strictest reading, but it can leave the approved-new-architecture path blocked within the same session.
- **Q2 (§6.4 trigger 2 breadth):** the spec's literal "exit ≠ 0" includes tools whose nonzero exit is an answer (`grep`, `diff`, `test`, `cmp`); counting those guarantees false blocks on edits mid-ordinary-work. The plan excludes exactly that small named list (Task 3) and keeps everything else. Approve the exclusion list, or direct otherwise.
- **Q3 (§6.4 trigger 1, "מפרט מאושר"):** operationalized as a spec file containing `אושר על-ידי הבעלים` plus (for new source files) an active arc ledger. Is that the right evidence bar for "approved design exists"?
- **Q4 (§6.3 window):** "failures this session > 0" combined with "no lesson since the previous commit" would permanently re-block every later commit of a session whose earlier failures were already covered. Implemented reading: failures counted since the last commit event in this session (Task 6, tested explicitly). Confirm this reading.

### Task 13: R-116 — the knowledge rules watch a door nobody uses

**Added 2026-08-08, after measuring the controller's own session.** `symbolic-grep-use-serena.mjs` and
`geniza-fallback-declaration.mjs` both gate on `tool_name === 'Grep'`. Measured over one full shift:
**105 greps through Bash, 0 through the Grep tool, 0 serena calls, 9 geniza queries.** Both rules
reported green for the entire session — not because the discipline was followed, but because they were
blind to the door being used. That is the silent-green failure this whole layer exists to prevent,
occurring inside the layer.

**Files:** `scripts/hooks/lib/` (a shared matcher) · both rules · `scripts/tests/test-hooks-groupa.mjs`

- [ ] **1.** Extract the "is this a knowledge search" decision into ONE place both rules call. Two
      copies of a classification rule drifting apart is a defect this repo has already paid for
      (§5.1's three conditions live in one rule today; the Bash surface must not become a second copy).
- [ ] **2.** Apply the SAME §5.1 conditions to a Bash command whose leading segment word is `grep`,
      `rg`, `findstr` or `Select-String` — reusing the segment-splitting and option-skipping that
      `main-only-no-worktrees.mjs` already does, so `git -C x grep` and `echo "grep foo"` behave as
      they should.
- [ ] **3.** COUNTER-RED is the whole task, and it is bigger here than the RED: a targeted grep of a
      KNOWN file (`grep -n "R-72" docs/ROADMAP-2026-07-30.md`) is not a corpus search and must stay
      silent. So must a Hebrew pattern, a pattern with spaces, and a `docs/**` sweep. Most of the 105
      calls measured above were targeted reads and SHOULD remain silent — the number is evidence of
      blindness, not of 105 violations.
- [ ] **4.** Re-measure after wiring: run a realistic stretch of ordinary work and report how many of
      the greps now warn. **More than a handful is a finding**, not a success.

### Task 14: R-117 — actor-scoped counters, because subagents share a session_id

**Observed live during Task 10, not hypothesised.** A dispatched subagent was blocked by
`debugging-before-fix-edit` over `bash_failure` events recorded under its own `session_id` that it never
produced — a concurrent subagent wrote them. One actor's failure blocking another is the "blocked for no
reason" shape this whole phase exists to avoid.

**Files:** `scripts/hooks/lib/enforcement-state.mjs` · the rules that read per-actor counters · tests

- [ ] **1.** Key ACTOR-level counters by (`session_id`, `agent_id`). `agent_id` is present in the hook
      payload — measured in Task 8, not assumed. A main-session actor has no agent_id; treat its
      absence as its own stable identity rather than as a wildcard.
- [ ] **2.** DO NOT scope everything. §5 fix cycles are per-actor. §10.16 lessons-since-last-commit is
      per-SESSION and must stay shared — a lesson owed for the session is not owed per subagent.
      Decide each counter explicitly and write the reasoning beside it.
- [ ] **3.** RED: two actors under one session, actor A records 4 failures, actor B's edit must be
      ALLOWED. COUNTER-RED: actor A's own 4th edit must still block, and the §10.16 gate must still see
      the whole session's failures.
- [ ] **4.** Migration: existing rows carry no agent_id. Decide what they mean and say so — treating
      them as belonging to every actor would recreate the defect.

