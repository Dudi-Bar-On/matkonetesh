# Flake-refactor — INDEPENDENT REVIEW (reviewer gate)

**Role:** REVIEWER (owner mandate: architect AND reviewer for this debugging arc). Adversarial by
charter — the flake was mis-diagnosed four times before this loop, so every link in the chain was
re-checked against the raw artifacts, not against the architect's summary.
**Under review:** root-cause claim (`flake-refactor-rootcause.md`; commits `097c4ba`→`b4d4ea7`→`7734a47`),
the refactor (`7d5402d`, `tests/_fixtures.ts`), the canary evidence, the residuals list.
**Method:** re-read the harness sources (L20 — verify the instrument before trusting it); re-read the raw
`serve-log-8127.log`, `canary{1,2,3}.out`, and the commit diff myself; Serena + grep for the refactor's
structure and blast radius; verified the machine state before deciding on an independent run.
**Date:** 2026-07-24.

---

## VERDICT SUMMARY

| Item | Verdict |
|---|---|
| **Root-cause claim** (loopback connection layer serializes N≳4 concurrent chromium navigations) | **CONFIRMED** |
| **The refactor** (`7d5402d`, in-memory `route.fulfill` of `/index.html`) | **APPROVED** — 0 Critical, 1 Important, 4 Minor |
| **Canary sufficiency** (3/3 + mechanism) | Sufficient for the **targeted-verification** verdict (root cause eliminated as the flake driver); **NOT** a certification — that is the owner's §10.18 campaign on a quiesced machine |
| **Extra reviewer canary** | **Not run** — machine not verified-idle (30–46% background CPU); a run now would be uninterpretable and add no verified-idle independence |

---

## 1 · ROOT-CAUSE CLAIM — CONFIRMED

The claim: under N≳4 concurrent chromium browser processes each doing a full-navigation `page.reload`, the
per-navigation loopback HTTP request is stalled ~10–20 s **inside chromium before it reaches the socket**;
serve.js is idle-fast; the machine is idle; requests dribble to the server in a staircase; navigations are
killed at the nav timeout in bursts. Cured by serving the doc from memory (`route.fulfill`).

### 1.1 The decisive instrument holds — I re-read the raw log

The load-bearing evidence is **arm 8** (`serve-log.mjs`, per-worker `?wN` tag). The task flagged the two
ways it could mislead — clock skew and per-worker mis-tagging. Both are refuted at the source:

- **Clock skew — impossible here.** The browser-send timestamp (`storm-worker.mjs`, `page.on('request')` →
  `Date.now()`) and the server-receive timestamp (`serve-log.mjs`, `Date.now()` on `RECV`) are **two
  processes on the same machine reading the same OS clock**. There is no second clock to skew against. A
  20 s delta is 20 s of wall time.
- **Tagging — correct.** Each worker requests `/index.html?wN`; the server logs the full `req.url`
  including `?wN`. Attribution is exact.
- **The `req` event fires promptly**, so the 20 s is genuinely in the send/connect phase, not in event
  plumbing: arm 7 shows `reload-start → req` at **+2 ms**, then no `response` for 20 s.

The raw `serve-log-8127.log` shows the staircase unambiguously (times are `HH:MM:SS.mmm`, same file):

```
21:30.585  #3 RECV /index.html?w3   → SENT 1ms
21:50.612  #4 RECV /index.html?w2   → SENT 1ms      ← 20.03 s gap, server idle across it
21:50.619  #5 RECV /index.html?w0   → SENT 2ms
22:00.646  #7 RECV /index.html?w9   → SENT 1ms      ← ~10 s step
22:10.660  #8 RECV /index.html?w7   → SENT 2ms      ← ~10 s step
22:20.664  #9 RECV /index.html?w6   → SENT 1ms      ← ~10 s step
22:30.691  #10 RECV /index.html?w4  → SENT 1ms
```

Across all **204** requests in the log the **maximum send time is 9 ms**. The server never stalls; the
requests arrive late. This is exactly the claimed signature, and it is independent of any CPU
interpretation. **The root cause does not rest on the CPU numbers** — which is important, because those
are the softest link (see 1.2).

### 1.2 The four refutations — each re-audited

- **serve.js is not the bottleneck (arm 1).** `server-storm.mjs` fires N=12 `fetch` of the full 2.7 MB
  body; serve.js answers in 73–143 ms/round. **Holds.** Caveat worth stating: Node's undici pools/reuses
  connections, whereas chromium churns a connection per navigation — so arm 1 being fast while chromium
  stalls is not a contradiction, it *localizes* the cost to chromium's per-navigation connection path (a
  per-new-connection Windows cost, pooled clients dodge it). This strengthens, not weakens, the claim.
- **App size is irrelevant (arm 5).** A 145-byte `tiny.html` hangs identically. Clean single-variable swap
  (only the served file changed). **Holds** — refutes 2.7 MB parse/download as the driver.
- **Not CPU (arms 4–5).** `reload-storm.mjs`'s heartbeat is a standard whole-machine `os.cpus()` idle-delta
  calc (verified correct). **Soft but not load-bearing:** whole-machine 7–14 % on a 32-thread box could
  hide a few busy cores, so "CPU idle" is corroborating, not decisive. The decisive fact is arm 8 (request
  arrives 20 s late, then answered in 2 ms) — a *wait*, not compute. L21 already de-rated CPU reasoning
  here; the verdict correctly does not depend on it.
- **Not V8/heap (arm 4).** Round 0 (fresh heap) hangs, and a 145-byte page cannot leak meaningfully.
  **Holds.**

### 1.3 The cure is a fair single-variable test — with one precision correction

`route.fulfill` from memory removes the real socket for the doc navigation and cures the hang. The swing is
real and huge. **But the headline "~100×" is the ABORT probe (arm 11: fulfill doc + abort subresources →
2.9 s), which is NOT the shipped shape.** The shipped fixture matches **arm 11b** (fulfill doc +
`continue()` subresources → **12.2 s**), i.e. ~**20–24×** vs the ~286 s/mostly-timeout baseline. Both cure
the hang; subresources continuing to the real server do **not** reintroduce the stall (arm 11b, 72/72
clean). The mechanism proof is unaffected — but the owner-facing number for the *shipped* configuration is
~20×, not 100×. Minor overstatement; corrected for the record.

**Conclusion:** the root cause is proven by an independent-of-the-fix instrument (the server log), the
refutations hold, and the cure is a clean single-variable red→green. CONFIRMED.

---

## 2 · THE REFACTOR (`7d5402d`) — APPROVED

Verified by diff, direct read, Serena overview, and grep. The commit is **fixture-only** (1 file,
24 insertions, `tests/_fixtures.ts`). Every task-listed check:

- **(a) Registered once per worker, gated to chromium.** The `context.route(APP_DOC_RE, …fulfill)` sits
  inside `warmContext` (`scope:'worker'`) under `if (workerInfo.project.name === 'chromium')`. The
  service-worker project (name `service-worker`) never installs it → keeps the real 200 for SW caching.
  **Confirmed** — and the canary's 2 SW tests pass, proving real serving preserved.
- **(b) Buffer read after the build, byte-identical delivery.** `appDoc()` lazily reads
  `resolve(process.cwd(),'dist/index.html')`; `webServer.command` = `python build.py && node serve.js`
  completes the build before Playwright reports the server ready, so no worker reads a stale/partial file.
  Delivery is byte-identical **and headers are safe**: serve.js sends only `Content-Type:
  text/html; charset=utf-8` + `Content-Length`; the fulfill reproduces the Content-Type and Playwright
  supplies Content-Length. The chromium project has `serviceWorkers:'block'`, so no header-driven
  cache path exists for the app to notice a difference. **Confirmed** — the app cannot tell.
- **(c) Subresources still hit serve.js.** `APP_DOC_RE = /\/index\.html($|\?)/` matches only the document
  (query and hash both resolve to it; fragments are stripped from the request URL). Grep confirms the tests
  only ever `goto('/index.html')` (8 sites, **zero** bare `/`), and manifest/icons fall through. **Confirmed.**
- **(d) `process.cwd()`.** True for `npx playwright test` (runner cwd = config dir = repo root). An
  alt-invocation with `--config` from another dir would break the read — but it throws **loudly** (ENOENT
  at first navigation), not silently. Acceptable.
- **(e) No leak into isolatedPage/classic.** `isolatedPage` uses the built-in `context` fixture, not
  `warmContext`; grep confirms `appDoc`/`APP_DOC_RE`/`route`/`fulfill` appear **only** inside `warmContext`.
  **Confirmed** — the escape hatch keeps real navigations by design.
- **(f) Contract coverage.** See the Important issue below.

### Issues

- **IMPORTANT — no regression guard that the route actually FIRES (this is L19, un-guarded).** The 5
  contract tests in `warm-fixture.spec.ts` pass **whether or not** the fulfill route intercepts — none of
  them asserts the mechanism is active. L19's own words: *"a fix whose mechanism never fires is a
  placebo."* Today the route fires by construction (deterministic interception, regex verified, registered
  before the first navigation) and the probe proved interception with the same Playwright build — so this
  is **not** an unproven-mechanism finding. It is a missing **permanent** guard: a future regex drift, a
  gate change, or a Playwright-version change to route semantics would silently reintroduce the flake,
  caught only by a future under-load full-suite flake. **Add a 6th contract test** asserting a warm
  `/index.html` navigation is served by the fulfill route and does not reach serve.js (a response-header
  marker on the fulfill, or a `page.on('request')`/route-hit counter, or an assert that a distinctive
  serve.js-only header is absent). Cheap, and it turns the fix's own root-cause lesson into a tripwire.
- **MINOR — URL coupling.** The route keys on the URL containing `/index.html`. If the app ever adopts
  History-API *path* routing (a `reload()` whose URL is a path without `index.html`), that reload would
  fall through to serve.js and 404. Currently safe (SPA is hash/no-router; every goto is `/index.html`).
  Note the coupling next to `APP_DOC_RE`.
- **MINOR — "~100×" is the abort probe.** Shipped shape is ~20–24× (see 1.3). Precision only.
- **MINOR/INFO — trace ergonomics.** On failure the trace now shows a fulfilled route for the doc, not a
  real server response. Immaterial to correctness; a debugger should know the doc is memory-served.
- **INFO — stale cross-doc description.** `CLAUDE.md` §11a still calls serve.js "clustered"; it was
  **de-clustered** to a single in-memory process (L18). Not this commit's job, but flag for doc hygiene —
  the root-cause narrative also references the cluster in places.

No Critical issues. The refactor is minimal, correctly gated, coverage-complete for the warm path, and
consistent with the proven mechanism.

---

## 3 · IS 3/3 + MECHANISM ENOUGH? — YES for the verdict, NO for certification

I re-verified the three canary outputs myself: `438 passed`, exit context clean, in **all three**
(`canary1/2/3.out`), each including the 2 service-worker-project tests (#437/#438) and the 5/5 warm-fixture
contract. Combined with the mechanism proof (§1), this is **sufficient to certify the targeted
verification of the fix** per §10.18: the loopback-navigation stall can no longer occur for the ~433
warm-project tests (by construction + the server-log proof + the probe's red→green), and the high-signal
12-worker stress is clean three times.

It is **not** a certification campaign, and should not be reported as one. Two reasons, both from this
project's own scars:

1. **§10.18 / §11a:** campaigns *certify*, they don't *diagnose*; and a worker-count-sensitive run must be
   measured **6–9×** on a **verified-idle** machine (a 3-run sample hides a ~1-in-6 flake — the exact
   mistake behind L19/L21).
2. **The 3/3 was run under load.** At review time the machine sits at **30–46 % background CPU** (the
   owner's flight-sim/streaming suite — NavigraphSimlink, Elgato, StreamDeck, MFS AddOn, Tobii — plus this
   session's node processes). The architect's canaries ran ~12 min earlier under the *same* resident load.
   Green under load is if anything *harder*, so 3/3 is not undermined — but it is **not** the verified-idle
   state L21 requires before a worker-ceiling or reliability number is trusted.

### Why I did not run a 4th canary

Port 8123 is free and there are **0** `headless_shell` orphans (no leftover test browser), so the harness
is clean — but the machine is **not** idle and I may not quiesce it (killing the user's apps or this
session's node processes is forbidden and destructive). A 12-worker run now would be **uninterpretable if
it flaked** (ERR_ABORTED under competing load is indistinguishable from a root-cause residual — §11a, L20,
L21), and a pass would only echo the architect's three **under the same contamination**, adding none of
the verified-idle independence that a reviewer run is supposed to contribute. Running it would spend the
budget in the wrong place. The right place is the owner's certification campaign on a quiesced machine
(below). The decisive evidence I *can* verify — the server log and the diff — I verified directly.

---

## 4 · RESIDUALS — the architect's list, plus what's MISSING

**Architect flagged (all valid):** production geometry/workers = owner's call; the serve.js `index.html`
delivery-coverage trade; the unpinned Windows sub-mechanism; the `process.cwd()` assumption; repro harness
kept.

**Missing / under-stated — add these:**

1. **The L19 firing-guard test** (§2, Important). The single most important omission — the fix has no
   permanent tripwire proving its own mechanism stays live.
2. **The 3/3 was not measured idle.** The residuals imply the geometry is "just an owner tuning call"; it
   should say explicitly that **no reliability number here — 3/3 included — was taken on a verified-idle
   machine**, so certification must quiesce the background suite first.
3. **The fix is not "zero real navigations," it is "sub-threshold."** `isolatedPage` (4 of 86 spec files)
   and the SW project still perform real loopback navigations. That remnant is well below the N≳4
   collision threshold in practice (hence 3/3 clean), but it is a retained surface, not an eliminated one —
   state it so a future spec that adds many isolatedPage navigations knows it can re-enter the stall.
4. **Coverage trade is safe for what the app *reads*** (affirmative, not just "reviewer should confirm"):
   serve.js exposes no header the chromium-project app consumes (SW blocked; only Content-Type +
   Content-Length, both reproduced). The genuine loss is real-HTTP delivery *regression* coverage of
   `index.html` for the main suite — mitigated by the §10.10 live-site check, the byte-identical body, and
   the SW project + subresources still hitting the real server. Acceptable; worth stating as a decided
   trade, not an open question.
5. **Doc hygiene:** `CLAUDE.md` §11a "clustered serve.js" is stale post-L18 (single process now).

---

## 5 · RECOMMENDATIONS FOR THE OWNER'S DECISIONS

1. **Accept the root cause and the fix.** Root cause CONFIRMED; refactor APPROVED. Merge/keep `7d5402d`.
2. **Require the L19 firing-guard test before the arc closes** (§2 Important). It is the one change I would
   block "done" on — not because the mechanism is unproven, but because nothing stops it silently regressing.
3. **Run the certification campaign yourself/at your gate on a quiesced machine — 6–9×, not 3** (§10.18,
   §11a). Close the flight-sim/streaming background apps first and verify idle (0 orphans, 8123 refuses)
   before the runs. Only then is a worker-count/geometry number trustworthy.
4. **A fresh worker-curve probe is now WARRANTED — as part of that campaign, not before it.** The old
   16/20/24-worker collapses (L21's "16 FAILED" blip; the earlier campaign non-monotonicity) were
   **plausibly this same loopback wall** — more workers meant more concurrent `seedApp` navigations, more
   collisions. With the stall removed, the ceiling is very likely much higher (L21 already saw 20 workers
   as the fastest *and* cleanest point). Re-derive the ceiling from a clean curve on the fixed fixture; the
   canary geometry (nav 20 s / test 30 s) is a debugging instrument and should revert to a chosen
   production geometry at the same time. This is the phase-B/C decision L21 and the config comment already
   assign to you — the fix makes it worth doing.
5. **Optionally pin the Windows sub-mechanism** (Defender-exclusion A/B, or serve.js connection logging).
   Not required — the fix is mechanism-agnostic — but the ~10 s staircase quantum in the server log is a
   strong lead (connection-timeout/retransmit boundary) if you want the full story.

---

## Provenance (what I verified directly, not from the architect's report)

- `serve-log-8127.log` — the 20.03 s gap (#3→#4) and staircase; 204 requests, max send 9 ms.
- `canary{1,2,3}.out` — `438 passed` ×3, SW tests present, contract 5/5.
- `git show 7d5402d` — fixture-only, 24 insertions.
- Serena `get_symbols_overview` + grep — `route`/`fulfill`/`appDoc`/`APP_DOC_RE` confined to `warmContext`;
  `isolatedPage` on the built-in context; 8× `goto('/index.html')`, 0× bare `/`.
- `serve.js` — single process; `/index.html` → `text/html; charset=utf-8` + Content-Length.
- Machine state — 8123 free, 0 `headless_shell`, CPU utility 30–46 % under resident load; `dist/index.html`
  fresh (2707255 b, 10:47).

_End of review._
