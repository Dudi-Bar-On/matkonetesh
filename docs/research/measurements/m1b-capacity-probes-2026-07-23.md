# M1b — worker-count capacity probes (2026-07-23, ~22:18–22:23)

**What:** single clean full-suite runs (`npx playwright test --workers=N`, plain otherwise) at escalating
worker counts, serialized, on an idle machine (orphans cleared, GPU idle, no sampler attached — comparable
wall-times). Architecture at time of measurement: commit `0bee082` state — `domcontentloaded` fixture,
de-clustered single-process serve.js, config `workers:8`, **pre-warm-page** (cold `goto` per test).

**Why:** M1 (instrumented 10-worker run, `cpu-sampler-m1-10-workers-2026-07-23T22-14-31.summary.json`)
failed to reproduce the "deterministic 10-worker starvation" — 433 passed, 2.0 m. That reopened the
ceiling question, so these probes walked the curve upward. Context runs the same evening: 8-worker clean
baseline ≈ 2.3 m; M0 sampled 8-worker run 2.8 m
(`cpu-sampler-m0-baseline-8w-2026-07-23T22-11-00.summary.json`).

| Workers | Result | Wall time |
|---|---|---|
| 8 (config, baseline) | 433 passed | ~2.3 m |
| 10 (M1, sampled) | 433 passed | 2.0 m |
| 12 | 433 passed | 1.6 m |
| 16 | **16 failed**, 417 passed | 1.7 m |
| 20 | 433 passed | **1.0 m** |

**Reading it honestly:** single probes each — they establish *capacity* (the machine can complete the
suite in ~1.0 m at 20 workers) and *non-monotonicity* (16 flaked while 20 was clean+fastest — worker-count-
dependent test-distribution collisions and/or single-run variance), NOT reliability. Per §11a only a
6–9× serialized campaign at a candidate count establishes a pin. The failing specs at 16 were not captured
(the probe kept only the summary line; test-results were overwritten by the subsequent 20-worker run).

**Consequences drawn (owner-approved program):** L21's "P-core oversubscription at 10 workers" is
corrected (contaminated-machine evidence — see the L21 rewrite); the split-worker-classes intervention was
dropped (premise gone); the path is: warm-page architecture (halves per-nav cost, W0
`w0-2026-07-23T19-06-51-827Z.json` ratio 0.477 GO) → re-probe this curve on the warm architecture →
one 6–9× campaign at the winner → owner declares the final count.

---

## Phase C — 12-worker campaign (2026-07-24)

**What:** 7 serialized full-suite runs at the candidate worker count — `npx playwright test --workers=12`
(env `MK_TEST_PORT=8123`), config default `workers:8` left untouched (command-line override only, same
technique as every prior probe in this document). Each run executed in the foreground to completion; none
killed, none backgrounded, none re-run to try to make it pass. Combined with Phase B's 1 prior clean
reading (438 passed, 1.2m) at the same worker count, this is 8 total readings — §11a's 6–9× reliability-
campaign bar.

**Preconditions verified before Run 1:** port 8123 — no LISTEN state; port 8124 — no LISTEN state; no
orphaned `serve.js`/`playwright test` node processes (process-list + command-line audit found only
pre-existing, unrelated MCP-server node processes and `tsserver`, none bound to 8123/8124); live total CPU
≈10.6% (idle). Teardown (8123 refuses/no-LISTEN + 0 `serve.js` orphans) was verified after every one of the
7 runs, including the final one, before declaring the campaign done.

**The 7 raw result lines** (as printed by the `list` reporter, `N passed (X.Xm)`; failed counts are printed
by Playwright *before* the passed line — reordered here for readability):

| Run | Raw result | Wall time (Playwright) | Wall time (stopwatch) | Exit code |
|---|---|---|---|---|
| 1 | `438 passed (1.2m)` | 1.2m | 74.6s | 0 |
| 2 | `426 passed (1.9m)` — **12 failed** | 1.9m | 116.1s | 1 |
| 3 | `428 passed (1.3m)` — **10 failed** | 1.3m | 81.4s | 1 |
| 4 | `415 passed (2.2m)` — **23 failed** | 2.2m | 135.9s | 1 |
| 5 | `438 passed (1.1m)` | 1.1m | 64.1s | 0 |
| 6 | `414 passed (2.6m)` — **24 failed** | 2.6m | 156.4s | 1 |
| 7 | `438 passed (1.1m)` | 1.1m | 64.6s | 0 |

**Failing specs by run** (banked as data, per §11a/DoD-12 — a failure, including an intermittent one, is
never re-run to make it pass):

| Run | Failing spec file(s) | Count | Root error signature |
|---|---|---|---|
| 2 | `tests/occupancy-model.spec.ts` (O3–O14 — the rest of that file) | 12 | `TimeoutError` at `_fixtures.ts:165` (`seedApp` → `page.reload({waitUntil:'domcontentloaded'})`) |
| 3 | `tests/active-hub.spec.ts` (7), `tests/adaptive-home.spec.ts` (3) | 10 | `TimeoutError: page.orig: Timeout 15000ms exceeded`, `_fixtures.ts:50` (warm-page `goto` override), navigating to `http://localhost:8123/index.html` |
| 4 | `tests/active-hub.spec.ts` (9), `tests/adaptive-home.spec.ts` (8), `tests/ai-model-registry.spec.ts` (4), `tests/ai-trust.spec.ts` (2) | 23 | same warm-page nav-timeout family as Run 3 |
| 6 | `tests/active-hub.spec.ts` (9), `tests/ai-model-registry.spec.ts` (8), `tests/adaptive-home.spec.ts` (7) | 24 | same warm-page nav-timeout family as Run 3 |

Campaign total: 69 failed test-instances across 4 of 7 runs — by spec file: `active-hub.spec.ts` 25 (7+9+9),
`adaptive-home.spec.ts` 18 (3+8+7), `ai-model-registry.spec.ts` 12 (4+8), `occupancy-model.spec.ts` 12,
`ai-trust.spec.ts` 2.

**Tally:** 3/7 clean this campaign (Runs 1, 5, 7). Wall time across all 7 runs (Playwright-reported) — min
1.1m, median 1.3m, max 2.6m.

**§11a verdict line:** 12 workers: 4/8 clean total (incl. the Phase B probe).

---

## Phase C RERUN — 12-worker campaign with disturbance monitoring (2026-07-24)

**Why:** the owner was unsure whether the campaign above was disturbed by other activity. This rerun
repeats the identical protocol — 7 serialized `npx playwright test --workers=12` runs (env
`MK_TEST_PORT=8123`), config untouched (`workers: 8`), each foreground to completion, none killed, none
re-run-to-green (failures banked as data) — and adds two things the first campaign did not have: a
disturbance gate checked immediately before every run, and a per-run grep-based proof that
`tests/warm-fixture.spec.ts`'s 5 contract tests actually ran green (the activation evidence for the
warm-page architecture). No modification to the shipped architecture — measurement only.

**Baseline census** (once, before Run 1, 5 s process-CPU-delta sample): total CPU **8.27%**. No listener
on 8123 or 8124. No `serve.js`/`playwright test` orphans. Two node processes matched the orphan-check
regex on "playwright" — both are the **`@playwright/mcp` CLI** (PIDs 33248, 39600), the Playwright MCP
plugin server backing this session's own tool access, not a suite leftover; both persisted unchanged at
0.00% CPU through every single gate and teardown check for the rest of the campaign. Other processes
>1%-or-name-matching at baseline: `NavigraphSimlink` (2.93%) and `ElgatoAudioControlServer` (2.91%) —
unrelated desktop apps; ~60 `chrome.exe` PIDs, all ≤0.51% (the user's real desktop browser — none were
`chrome-headless-shell.exe`, confirming no suite browser was running); 5 `python`/`python3.10` processes
(≤0.09%); `ollama`/`ollama app` (0.00%, idle); assorted `node`/`node20` at 0.00% (other MCP-server/tooling
children, tsserver-class residents). All noted as expected residents, none actionable.

**Disturbance gate, all 7 runs:** every pre-run gate passed on the first check — no run ever needed the
2-minute wait window, none ever came close to the 10% halt-line. Total CPU immediately before each run:
8.2%, 8.83%, 9.51%, 8.3%, 9.61%, 8.28%, 12.1% (Runs 1–7 respectively) — all well under the 20% threshold,
and no node/chrome/python/ollama process beyond the two ambient MCP processes ever read >5% CPU at any
gate. **One disturbance was actually observed**, at the Run 6 teardown check (not a pre-run gate — no
gate ever failed): a single 1 s sample read **16.29%** total CPU, driven by a transient burst of desktop
activity — `ElgatoAudioControlServer` (3.30%), a newly-active `StreamDeck` process (3.15%),
`NavigraphSimlink` (3.01%), and two `chrome.exe` PIDs (2.67%, 1.75%) — none of it test infrastructure (no
`chrome-headless-shell.exe`, no new serve.js/playwright process, port 8123/8124 still refused
connections). It had cleared by the Run 7 pre-gate ~13 s later (12.1%, no process >5% beyond the same
ambient apps at baseline-comparable levels) and never required a wait or a halt.

**Per-run table:**

| Run | Start–End (UTC) | Raw result | Failing spec(s) | Warm-proof | Disturbance gate | Teardown |
|---|---|---|---|---|---|---|
| 1 | 23:05:30.521–23:07:48.331 | `426 passed (2.3m)` — **12 failed**, exit 1 | active-hub.spec.ts (9), adaptive-home.spec.ts (3) | 5/5 green | PASS (8.2%) | OK — refuses, 0 orphans (9.86%) |
| 2 | 23:08:28.993–23:09:33.695 | `438 passed (1.1m)`, exit 0 | — | 5/5 green | PASS (8.83%) | OK — refuses, 0 orphans (9.37%) |
| 3 | 23:10:08.451–23:11:23.858 | `438 passed (1.2m)`, exit 0 | — | 5/5 green | PASS (9.51%) | OK — refuses, 0 orphans (10%) |
| 4 | 23:11:52.893–23:13:56.584 | `426 passed (2.0m)` — **12 failed**, exit 1 | active-hub.spec.ts (9), adaptive-home.spec.ts (3) | 5/5 green | PASS (8.3%) | OK — refuses, 0 orphans (9.94%) |
| 5 | 23:14:26.114–23:15:50.799 | `428 passed (1.4m)` — **10 failed**, exit 1 | active-hub.spec.ts (6), adaptive-home.spec.ts (4) | 5/5 green | PASS (9.61%) | OK — refuses, 0 orphans (8.64%) |
| 6 | 23:16:20.694–23:20:08.420 | `414 passed (3.8m)` — **24 failed**, exit 1 | active-hub.spec.ts (5), adaptive-home.spec.ts (13), ai-model-registry.spec.ts (6) | 5/5 green | PASS (8.28%) | OK — refuses, 0 orphans (16.29%\*) |
| 7 | 23:21:11.021–23:24:21.426 | `405 passed (3.2m)` — **29 failed**, exit 1 | ai-trust.spec.ts (12), data-integrity.spec.ts (6), equip-chooser.spec.ts (2), thermal-ceiling.spec.ts (2), timeline-enhancements.spec.ts (2), wave-a-alarm-banner.spec.ts (3), wave0-safety.spec.ts (1), **warm-fixture.spec.ts (1)** | **FAILED** — test A timed out; B–E skipped (serial mode) → 0/5 confirmed | PASS (12.1%) | OK — refuses, 0 orphans (8.12%) |

\* Run 6's teardown reading — see the disturbance paragraph above: transient desktop-app activity, not
test infrastructure, under the 20% gate threshold throughout.

**Failing specs, all runs combined:** 87 failed test-instances across 5 of 7 runs — by spec file:
`active-hub.spec.ts` 29 (9+9+6+5), `adaptive-home.spec.ts` 23 (3+3+4+13), `ai-model-registry.spec.ts` 6,
`ai-trust.spec.ts` 12, `data-integrity.spec.ts` 6, `equip-chooser.spec.ts` 2, `thermal-ceiling.spec.ts` 2,
`timeline-enhancements.spec.ts` 2, `wave-a-alarm-banner.spec.ts` 3, `wave0-safety.spec.ts` 1,
`warm-fixture.spec.ts` 1.

**Root error signature — two call-sites within the same warm-page nav-timeout family, both under
`tests/_fixtures.ts`:**
- Runs 1, 5, 6, 7: `TimeoutError: page.reload: Timeout 15000ms exceeded` at `_fixtures.ts:165`
  (`seedApp`'s `page.reload({waitUntil:'domcontentloaded'})` — the standard per-test reset nearly every
  spec calls). Runs 1 and 6 additionally logged `_fixtures.ts:122` (`warmContext.clearCookies()` inside
  the `warm` fixture's between-test teardown) plus "Tearing down 'warm' exceeded the test timeout of
  30000ms" (Run 1 ×9, Run 6 ×18, Run 7 ×7) — a teardown-phase timeout stacked on top of the setup-phase
  one.
- Run 4: `TimeoutError: page.orig: Timeout 15000ms exceeded` at `_fixtures.ts:50`/`:56` (the `dclGoto`
  `page.goto` override) — the exact signature the FIRST campaign's Runs 3/4/6 hit.

**Warm-preload activation proof, per run:** Runs 1, 2, 3, 4, 5, 6 — all confirmed **5/5 green**
(`__mkWarmServed` reuse counter ≥2, the `addInitScript` trap throws, storage isolation holds between A and
B, the default `page` IS the warm page). **Run 7 is the one exception**: the contract spec's own first
test (`A: seeds its own state...`) hit the identical `_fixtures.ts:165` nav-timeout that hit the
production specs in the other failing runs, so tests B–E never ran (`test.describe.configure({mode:
'serial'})`). Read plainly: in 6/7 runs the warm-page mechanism's own proof held; in 1/7 the proof-test
was itself caught by the same contention failure being measured, so that run's activation was NOT
independently confirmed.

**Tally:** 2/7 clean this rerun (Runs 2, 3). 5/7 failed (Runs 1, 4, 5, 6, 7) — 87 failed test-instances
total. Wall time (stopwatch, start-to-end): min 64.7s (Run 2), median 123.7s (Run 4), max 227.7s (Run 6).

**Comparison to the first Phase C campaign:** first campaign — 3/7 clean (Runs 1, 5, 7), 69 failed
test-instances across 4 failing runs. This rerun — 2/7 clean (Runs 2, 3), 87 failed test-instances across
5 failing runs. Disturbance monitoring on this rerun: every one of the 7 pre-run gates passed (max
reading 12.1% total CPU against a 20% threshold), no gate ever required the 2-minute wait, and the single
anomaly recorded (Run 6 teardown, 16.29%) was transient desktop-app activity, not test infrastructure, and
had cleared by the next gate. No recommendation is made here — the worker-count decision is the owner's.

---

## Certification campaign — 8 workers, config default (2026-07-24)

**What:** 5 serialized full-suite runs at the config's OWN default worker count — plain `npx playwright
test` (env `MK_TEST_PORT=8123`, **no `--workers` override** — every prior probe in this document,
including both Phase C campaigns, pinned a count on the command line; this campaign instead exercises
`playwright.config.ts`'s own `workers: process.env.CI ? 2 : 8` line unmodified, at commit `bc421fa`).
Identical protocol to the Phase C RERUN campaign above: a disturbance gate (5 s CPU-delta sample, port
8123/8124 LISTEN check, node.exe serve.js/playwright-test orphan check, new-process check vs baseline)
immediately before every run, and a per-run proof that `tests/warm-fixture.spec.ts`'s 5 contract tests
ran green. Each run executed in the foreground to completion; none killed, none backgrounded, none
re-run-to-green (failures banked as data per §11a/DoD-12).

**Baseline census** (once, before Run 1, 5 s CPU-delta sample): total CPU **8.55%**. No listener on 8123
or 8124. Two node.exe processes matched the orphan-check regex on "playwright" — both the **`@playwright/mcp`
CLI** (PIDs 33248, 39600), the same PIDs seen in the Phase C RERUN campaign a few minutes earlier in the
same session, confirmed expected residents (this session's own Playwright-MCP tool server, not a suite
leftover); both persisted unchanged through every gate/teardown check for the whole campaign.
tsserver/MCP-tooling `node`/`node20` children were present among the unlabeled 0.00%-CPU entries, also
expected residents per the brief. No `chrome-headless-shell.exe`, no stray `python`/`serve.js`, at baseline.

**Disturbance gate, all 5 runs:** every pre-run gate passed on the first check — none came close to the
20% threshold. Total CPU immediately before each run: 7.91%, 8.88%, 8.02%, 7.5%, 8.89% (Runs 1–5
respectively). No LISTEN on 8123/8124 at any gate; no orphan beyond the 2 known MCP PIDs at any gate; no
new node/chrome/python process appeared vs. baseline at any gate. **No disturbance was observed at any
point in this campaign** — every gate and every teardown read in the same 7.5%–13.1% ambient band as the
baseline.

**Per-run table:**

| Run | Start–End (UTC) | Raw result | Failing spec(s) | Warm-proof | Gate (pre) | Teardown |
|---|---|---|---|---|---|---|
| 1 | 23:37:13.604–23:39:24.563 | `430 passed (2.2m)` — **8 failed**, exit 1 | active-hub.spec.ts (8) | 5/5 green | PASS (7.91%) | OK — refuses, 0 orphans (8.15%) |
| 2 | 23:40:57.939–23:42:23.091 | `438 passed (1.4m)`, exit 0 | — | 5/5 green | PASS (8.88%) | OK — refuses, 0 orphans (9.73%) |
| 3 | 23:43:10.494–23:46:02.023 | `422 passed (2.8m)` — **16 failed**, exit 1 | active-hub.spec.ts (8), cure-scale-guard.spec.ts (2), data-integrity.spec.ts (4), equip-chooser.spec.ts (2) | 5/5 green | PASS (8.02%) | OK — refuses, 0 orphans (8.26%) |
| 4 | 23:46:41.710–23:48:06.790 | `438 passed (1.4m)`, exit 0 | — | 5/5 green | PASS (7.5%) | OK — refuses, 0 orphans (11.9%) |
| 5 | 23:48:42.228–23:50:50.031 | `430 passed (2.1m)` — **8 failed**, exit 1 | active-hub.spec.ts (8) | 5/5 green | PASS (8.89%) | OK — refuses, 0 orphans (8.92%) |

**Failing specs, all runs combined:** 32 failed test-instances across 3 of 5 runs — by spec file:
`active-hub.spec.ts` 24 (8+8+8), `data-integrity.spec.ts` 4, `cure-scale-guard.spec.ts` 2,
`equip-chooser.spec.ts` 2. All three failing runs' first 8 failures are the identical `active-hub.spec.ts`
test set (lines 12/30/40/51/68/85/99/117, minus line 12 in Run 5 which substituted line 130 — see raw
logs); Run 3 additionally failed 8 more tests across `cure-scale-guard.spec.ts`, `data-integrity.spec.ts`,
and `equip-chooser.spec.ts`.

**Root error signature (all 32 failures, same family as both Phase C campaigns above):**
`TimeoutError: page.reload: Timeout 15000ms exceeded` at `tests/_fixtures.ts:165` (`seedApp`'s
`page.reload({waitUntil:'domcontentloaded'})` — the standard per-test reset nearly every spec calls).

**Warm-preload activation proof, per run:** all 5 runs confirmed **5/5 green**
(`__mkWarmServed` reuse counter ≥2, the `addInitScript` trap throws, storage isolation holds between A and
B, the default `page` IS the warm page) — including all 3 failing runs (1, 3, 5): the contract spec itself
was never among the failing tests this campaign (contrast Phase C RERUN's Run 7, where it was).

**Tally:** 2/5 clean this campaign (Runs 2, 4). 3/5 failed (Runs 1, 3, 5) — 32 failed test-instances
total. Wall time (stopwatch, start-to-end): min 85.1s (Run 4), median 127.8s (Run 5), max 171.5s (Run 3).
Playwright-reported wall time ranged 1.4m (Runs 2, 4) to 2.8m (Run 3).

**§11a combined line:** 8 workers (warm arch): 4/7 clean total (this campaign + the 2 prior clean
readings: flip run f145a8d 1.5m, Task-8 parity 1.5m).

No recommendation is made here — the worker-count/final-config decision is the owner's.

---

## POST-FIX certification — F1+F2 stampede fix, 8 workers (2026-07-24)

**What:** 7 serialized full-suite runs at the config's own default worker count — plain `npx playwright
test` (env `MK_TEST_PORT=8123`, no `--workers` override), at commit `0127f95` ("fix(test): stampede fix —
stagger per-worker cold parses (F1) + cold-goto-only 28s headroom (F2)"), certifying the fix against the
failure family recorded in the "Certification campaign — 8 workers" section above (pre-fix: 2/5 clean that
campaign, 4/7 combined with 2 prior clean readings). Identical protocol to both prior campaigns in this
document: a disturbance gate (5 s CPU-delta sample, port 8123/8124 LISTEN check, node.exe
serve.js/playwright-test orphan check, new-process check vs baseline) immediately before every run, and a
per-run proof that `tests/warm-fixture.spec.ts`'s 5 contract tests ran green. Each run executed in the
foreground to completion; none killed, none backgrounded, none re-run-to-green (failures banked as data
per §11a/DoD-12).

**Baseline census** (once, before Run 1, 5 s CPU-delta sample): total CPU **8.46%**. No listener on 8123
or 8124. The node.exe/python.exe command-line audit found only expected residents: the **`@playwright/mcp`
CLI** (PID 63992 npx wrapper + PID 51464 `cli.js` — this session's own Playwright-MCP tool server, not a
suite leftover), Serena's 2 `python.exe` MCP processes plus a multiprocessing spawn child, and Serena's
bundled language servers under `.serena\language_servers\static\`: TypeScript (LSP wrapper + 2× `tsserver`
+ `typingsInstaller`), `bash-language-server`, `yaml-language-server`, `vscode-html`/`json`-language-
servers; a standalone `pyright-langserver.js`; and the other project MCP servers (`context7-mcp`,
`chrome-devtools-mcp` + its watchdog, `firebase-tools mcp`, `desktop-commander`, `claude-mem`
`mcp-server.cjs`) — no `serve.js`, no `chrome-headless-shell.exe`. Desktop-app processes >1% CPU:
`NavigraphSimlink` (~2.8–2.9%) and `ElgatoAudioControlServer` (~2.9%), both unrelated ambient apps.

**Disturbance gate, all 7 runs:** every pre-run gate passed — CPU immediately before each run: 8.97%,
13.18%, 7.82%, 8.5%, 8.32%, 8.25%, 7.55% (Runs 1–7 respectively), all well under the 20% threshold; port
8123/8124 never showed a LISTEN state at any gate; 0 `serve.js`/`playwright-test` orphans at any gate.
**One transient disturbance was observed**, at the Run 1 pre-gate only: a Claude Code security hook
(`ensure_agent_sdk.py`) had spawned a background `pip install claude-agent-sdk` (3 short-lived
`python`/`python3.10` processes, none reading >1% CPU) plus the user's own desktop Chrome opening a new
tab (PID 68784, real `chrome.exe`, never `chrome-headless-shell.exe`) — neither is test infrastructure,
both were gone by the Run 2 gate, and the reading stayed at 8.97%, nowhere near the 20% halt-line. A new
desktop `chrome.exe` PID (the user's real browser) appeared at most later gates/teardowns — ambient, not
actionable, consistent with both prior campaigns in this document.

**Per-run table:**

| Run | Start–End (UTC) | Raw result | Failing spec(s) | Warm-proof | Gate (pre) | Teardown |
|---|---|---|---|---|---|---|
| 1 | 01:44:31.434–01:46:44.114 | `430 passed (2.2m)` — **8 failed**, exit 1 | scheduler-placement.spec.ts (1), scheduler-planschedule.spec.ts (2), setpoint-fence.spec.ts (3), smoke.spec.ts (2) | 5/5 green | PASS (8.97%) | OK — refuses, 0 orphans (9.69%)\* |
| 2 | 01:48:19.865–01:49:46.919 | `438 passed (1.4m)`, exit 0 | — | 5/5 green | PASS (13.18%) | OK — refuses, 0 orphans (9.11%) |
| 3 | 01:50:14.605–01:51:42.431 | `438 passed (1.4m)`, exit 0 | — | 5/5 green | PASS (7.82%) | OK — refuses, 0 orphans (7.88%) |
| 4 | 01:52:09.647–01:53:37.533 | `438 passed (1.4m)`, exit 0 | — | 5/5 green | PASS (8.5%) | OK — refuses, 0 orphans (8.13%) |
| 5 | 01:54:06.196–01:55:33.360 | `438 passed (1.4m)`, exit 0 | — | 5/5 green | PASS (8.32%) | OK — refuses, 0 orphans (9.46%) |
| 6 | 01:56:00.984–01:57:29.026 | `438 passed (1.5m)`, exit 0 | — | 5/5 green | PASS (8.25%) | OK — refuses, 0 orphans (9.08%) |
| 7 | 01:57:55.987–01:59:56.609 | `430 passed (2.0m)` — **8 failed**, exit 1 | active-hub.spec.ts (3), adaptive-home.spec.ts (5) | 5/5 green | PASS (7.55%) | OK — refuses, 0 orphans (8.94%) |

\* Run 1's first teardown pass flagged a false-positive "orphan": PID 63992's command line is
`npx @playwright/mcp@latest`, and the orphan regex's naive `test` substring match fired on "la**test**".
Corrected to a `\btest\b` word-boundary match and re-verified within the same minute: identical PID (the
known Playwright-MCP resident, unchanged since baseline), 0 real orphans, PASS (9.69%, the value in the
table above). All later teardown checks in this campaign used the corrected regex.

**Failing specs, all runs combined:** 16 failed test-instances across 2 of 7 runs — by spec file:
`adaptive-home.spec.ts` 5, `setpoint-fence.spec.ts` 3, `active-hub.spec.ts` 3,
`scheduler-planschedule.spec.ts` 2, `smoke.spec.ts` 2, `scheduler-placement.spec.ts` 1.

**Root error signature:** same family as both pre-fix campaigns in this document. 14 of the 16 failures
are `TimeoutError: page.reload: Timeout 15000ms exceeded` at `tests/_fixtures.ts:182` (`seedApp`'s
`page.reload({waitUntil:'domcontentloaded'})` — the line shifted from :165 pre-fix to :182 post-fix,
consistent with F1+F2 adding a net 17 lines to `_fixtures.ts`, per the commit's own diffstat). The
remaining 2 (Run 7, `active-hub.spec.ts:99` and `:117`) are the cascade signature named in the fix's own
commit message: `Fixture "warmPage" timeout of 30000ms exceeded during setup` / `Error: page.orig: Target
page, context or browser has been closed` at `_fixtures.ts:56`/`:50` — the same worker's next two
scheduled tests failing warm-fixture setup after that worker's page was torn down by test 1's reload
timeout.

**Warm-preload activation proof, per run:** all 7 runs confirmed **5/5 green**
(`__mkWarmServed` reuse counter ≥2, the `addInitScript` trap throws, storage isolation holds between A and
B, the default `page` IS the warm page) — including both failing runs (1, 7): the contract spec itself was
never among the failing tests in this campaign.

**Tally:** 5/7 clean this campaign (Runs 2, 3, 4, 5, 6). 2/7 failed (Runs 1, 7) — 16 failed test-instances
total, same warm-reload-timeout/cascade family as pre-fix. Wall time (stopwatch, start-to-end): min 87.1s
(Run 2), median 87.9s (Run 4), max 132.7s (Run 1). Playwright-reported wall time ranged 1.4m (Runs 2–5) to
2.2m (Run 1); Run 6 was 1.5m, Run 7 was 2.0m.

**8 workers post-F1F2: 5/7 clean (pre-fix: 4/7).**

No recommendation is made here — the worker-count/final-config decision is the owner's.
