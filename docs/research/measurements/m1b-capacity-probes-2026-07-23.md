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
