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
