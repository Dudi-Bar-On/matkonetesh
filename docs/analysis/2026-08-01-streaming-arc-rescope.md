# Metered-streaming arc — rescope audit against shipped code (2026-08-01)

**Auditor:** subagent, read-only. **Nothing was edited, built, committed, or waived.**
**Plan audited:** `docs/superpowers/plans/2026-07-31-metered-streaming.md` (9 tasks)
**Spec:** `docs/superpowers/specs/2026-07-31-metered-streaming-design.md`
**Tree state:** `main` @ `2575ed1` (v281 shipped and live).

Per discipline §4 every "should change" below is a **RECOMMENDATION to the owner**, not a change.
Nothing here narrows, defers, or reinterprets a spec line.

---

## 0 · NOW WRONG first — the conflicts that would cause damage

### NW-1 (Task 4) · The plan's early-speech loop reverts the quota hotfix `0bee32f`

Plan Task 4 Step 3(c) builds `early.chain` so that **every gate-passed sentence** is handed to
`gemSpeakSeg(clean, ansL, gen)` — one `streamGenerateContent` TTS request **per sentence**.

That is exactly the call shape `0bee32f` removed. The shipped code (app.js:6776 `vcCoalesceTtsChunks`,
6831 `gemSpeak`) deliberately reduces a realistic answer from 10–15 TTS requests to
**1 short opening + a small bounded number of coalesced remainder requests**, because
`gemini-3.1-flash-tts-preview`'s per-minute limit 429'd chunks 2–12 within an hour of v280 shipping.
The plan predates that hotfix and has no coalescing in the early path.

A 3-sentence digit-free opener under the plan = 3 TTS stream requests, plus the remainder's own groups,
against a limit that already broke at request #2. **This is a binding constraint the plan violates.**
Task 4 cannot be implemented as written.

### NW-2 (Task 4, Task 8) · `gemSpeakSeg`'s signature and the audio-clock cursor changed under the plan

Shipped: `gemSpeakSeg(text, lang, gen, startAt) → Promise<cursor>` (app.js:6651), and
`gemPlayPcmStream` returns `cursor` (app.js:6731), and `gemPlayBuf(buf, gen, startAt)` (6581).
`gemSpeak` (6852) threads **one running cursor** across every chunk boundary. That cursor is the
whole fix for R-47(b)+(d) — the owner-reported gap and jitter, closed in `7172c42` and shipped in v281.

The plan calls `gemSpeakSeg(clean, ansL, gen)` (3 args) and **discards the return value** in both
Task 4's `early.chain` and Task 8's tests. Every early sentence would then start at
`ctx.currentTime + 0.05` = "now" instead of at the previous segment's end — **reintroducing exactly the
gap+jitter regression v281 just fixed**, and the plan's post-guard `vcSpeak(rest, ansL, gen)` starts a
fresh `cursor=undefined` inside `gemSpeak`, so there is a second seam at the early/remainder boundary.

### NW-3 (Task 4) · The wholesale `vcAskFlow` / `vcSpeak` replacements would revert audited fixes

Plan Task 4 Step 3 says "replace the current body wholesale" for `vcAskFlow` and gives literal
replacement lines for `vcSpeak`. The shipped versions carry fixes the plan's text does not:

| Shipped (app.js) | Plan's replacement drops it |
|---|---|
| `vcSpeak` M5 branch: `!aiAvail()` → reconnect toast (6888) | plan writes `if(!aiAvail()) return;` — a silent no-op again |
| `vcSpeak` stale-generation `console.warn` (6893) | absent |
| `vcAskFlow` `VC_THINKING[ansL]` 7-language placeholder (7386) | plan hardcodes `'…חושב'/'…thinking'` |
| `vcAskFlow` `VC_AI_QUOTA` vs `VC_AI_UNAVAILABLE` split + `console.warn('[vcAsk]', e)` (7404–7408) | plan's catch has one he/en string |
| `vcAck(vcNewSpeakGen())` call shape (7385) | plan uses a separate `gen=vcNewSpeakGen(); gemStop(); vcAck(gen)` |

`tests/voice-wave0.spec.ts` pins several of these directly — `'H1: vcAskFlow logs every caught error…'`
(:515), `'M3: the thinking placeholder…all 7 languages'` (:541), `'M5: vcSpeak toasts a reconnect hint…'`
(:561). A wholesale replacement turns those red.

### NW-4 (Task 5) · The test's assertions do not match the string that shipped

`VC_BREVITY_HE`/`VC_BREVITY_EN` **already exist** (app.js:7083–7089) and are already wired into all
three branches of `vcBuildAskPrompt` (7096 non-he/en, 7104 en, 7110 he) — shipped in v280.
But the shipped wording has **no numeric cap**: `'ענה בקצרה ובסגנון דיבור טבעי'` — no "60 מילים", no
"one to three sentences". Task 5's test asserts `toContain('עד 60 מילים')` / `toContain('60 words')` /
`toContain('the number, its unit and the caveat')`. None of those substrings exist. The test as written
fails for a reason unrelated to behaviour.

Spec §7 does require a cap ("1–3 short sentences, ≤ ~60 words"), so the *code* is what is incomplete —
not the spec. See Task 5 below.

### NW-5 (Tasks 2, 4, 8, 9) · Every remaining test snippet seeds `localStorage` in the wrong shape

The plan's snippets call `seedApp(page, { 'mk-central-url': 'https://w.example' })`. The **shipped**
`tests/metered-streaming.spec.ts` (written when Task 1 landed) uses
`{ 'mk-central-url': JSON.stringify('https://w.example') }`. `seedApp` writes values raw
(`tests/_fixtures.ts:236`), and the app JSON-parses them. Every un-landed snippet has the old shape and
will not seed. Mechanical, but it will cost an implementer a debugging cycle per task.

### NW-6 (Task 9) · The release stamp is wrong, and the D1 script does not measure what D1 specifies

- The plan releases the arc as **v281**. v281 already shipped (`176cea1`, live, verified). The arc must
  target v282+.
- Spec §10 D1 requires first sound measured **"via `__vcLat` (`firstAudio − ask`)"** — i.e. inside the
  app, through the real pipeline. The plan's Step-3 script `demo-latency.mjs` measures two raw legs
  from Node straight to Google and sums them. It cannot see the digit-free gate, the coalescer, the
  guard, the Worker hop, WebAudio resume, or the 429-retry backoff. **The script can report PASS on a
  configuration the app never runs.** See Q3/R-3.

---

## 1 · Per-task classification

| Task | Verdict | One-line reason |
|---|---|---|
| **2** — `gemSseParse` + `gemStreamFetch` | **STILL NEEDED** | Neither symbol exists in `app.js` (grep across all definitions: 0 hits). Its dependency `gemTransport` (app.js:5501) shipped in `31d3037`. |
| **3** — `vcSentenceStream` + `vcStreamSafe` | **STILL NEEDED** | Neither symbol exists. Unchanged by anything shipped. |
| **4** — `vcAskFlow` streams end-to-end | **NOW WRONG** (goal still needed) | NW-1/NW-2/NW-3. `vcAskFlow` (7380) still calls the blocking `vcAskAI` (7308). `vcAskAIStream`, `__vcAskStreamMock`, `vcLatMark('firstSentence')` all absent, and `vcSpeak` (7881→6881) still takes only `(text, lang)`. |
| **5** — R-36a brevity + safety override | **PARTIALLY DONE** | Constants + safety override + all three prompt branches: DONE (v280, app.js:7083–7110). Missing: the **word cap** (spec §7), `ASK_PANEL_SYS_PREFIX` + `window.__askPanelSys` probe, the test, the live obedience probe. Panel prompt is still one inline literal (app.js:5571) — it *does* contain `בצורה מלאה ומועילה` and no brevity clause, so the negative case is factually true, just not probe-able. |
| **6** — Worker metered streaming route | **STILL NEEDED** (and now higher value — see Q2) | `worker/index.js:94` still rejects everything but `:generateContent`; the B19 comment (91–93) and the B19 vitest (`worker/test/index.spec.js:73`) are untouched. No `admitCode`, no `handleStream`, `fetch(request, env)` is still two-arg. The plan's Task-6 code applies cleanly — no drift. |
| **7** — Tier skeleton | **STILL NEEDED** | No `TIERS`/`tierOf` anywhere in `worker/index.js`; `retryAfterSeconds(code)` (103) is still un-parameterized and still runs pre-KV. |
| **8** — Pre-warm + weak-network | **PARTIALLY DONE / partly NOW WRONG** | `vcPrewarm`, `__vcPrewarmDone`, `vcStallNotice`, the 8 s watchdog: all absent → needed. **Moot:** Step-1's second test (mid-stream failure → blocking fallback) is already satisfied by `gemSpeakSegAttempt` (6627) and already pinned by `tests/metered-streaming.spec.ts:37` — it will pass on first run and is void per DoD-2 (the plan itself anticipated this in its Step 2). **NOW WRONG:** the watchdog edit must preserve `gemPlayPcmStream`'s `return cursor` (NW-2) and must not flatten the `gemSpeakSeg → gemSpeakSegAttempt → gemSpeakSegStream` retry-once layering that `0bee32f` added between them. |
| **9** — D1–D4 + release | **PARTIALLY DONE / NOW WRONG on specifics** | `__vcLat` already carries `ask, ackSound, textReq, textResp, ttsReq1, firstSound, firstAudio, done` (`VC_LAT`, app.js:5493; `firstAudio` marked at 6704 inside `gemPlayPcmStream`; consumer `vcLatReport` at 5495; pinned by `voice-wave0.spec.ts:3`). Missing: `firstSentence` (arrives with Task 4). NOW WRONG: version stamp (NW-6), the D1 script (NW-6), and both mocked tests depend on `__vcAskStreamMock` from Task 4. |

**Runtime-path check (`verify-against-the-runtime-path`):** `gemSpeakSeg` is not dead code — `gemSpeak`
reaches it for chunk 0 on every answer (app.js:6866–6868: the `else` branch runs when nothing is
pre-fetched, which is always true for `i===0`). Confirmed by reading the loop, not by the symbol
existing. **But:** in **managed** mode `gemSpeakSegStream` hits the Worker, which 404s
(`worker/index.js:94`), so `gemSpeakSegAttempt` catches `stream-unsupported` and runs the **blocking**
`gemSynthChunk` + `gemPlayBuf`. **Streaming TTS is live today for BYOK only.** That fact drives Q2.

---

## 2 · Q1 — current first-sound latency

**Not established. It has not been measured since v281, and I cannot measure it without a live key —
which I did not use.** Stating a number would be a fabrication. What the code establishes:

The shipped voice path is still **blocking text, streaming audio**:

```
vcAskFlow(7380) → vcAskAI(7308, generateContent, blocking)
                → vcGuardSpoken → vcSpeak → gemSpeak(6831)
                → chunk 0 → gemSpeakSeg → gemSpeakSegStream → first PCM frame → vcLatMark('firstAudio')
```

So `firstAudio − ask` ≈ **T(full text answer) + T(first audio frame)** + small constants.

| leg | what is actually known |
|---|---|
| T(full text answer) | **Not measured in the shipped configuration.** `docs/analysis/2026-07-31-qa-latency-measured.md` measured `low` + *no* instruction = 5,710 ms / 1,488 chars, and `minimal` + instruction = 1,286 ms / 147 chars. Shipped is `low` (`AI_THINK.vcAsk`, app.js:5410) **+** instruction — a cell nobody measured. The doc's own conclusion is that **length, not think level, dominates**, so the honest range is **~1.3–5.7 s**, likely nearer the low end, and highly sensitive to how long the un-capped brevity clause actually keeps answers. |
| T(first audio frame) — BYOK | **1,101 ms**, measured (R-39 probe, spec §8). |
| T(first audio frame) — managed | streaming 404s → blocking `gemSynthChunk`. Baseline measured a full TTS round trip at **2,380–2,979 ms** for a 2-word ack; the hotfix comment measures **~2.1 s for 13 chars**. Also `VC_TTS_OPEN_MIN` (6766) can merge the opening piece forward, lengthening chunk 0 ("a few hundred extra ms" per its own comment). |

**Best estimate, stated as an estimate:** BYOK ≈ **2.5–4.5 s**; managed ≈ **3.5–6 s**.
Baseline for comparison: **~13.4 s best case / ~99 s in practice** (timeout → browser voice).
Most of the arc's headline win has therefore **already landed** in v280+v281.

**How to get the real number (no code needed):** the instrument is live. Ask on the D3 question, then
read `window.__vcLat` / `vcLatReport()` — `firstAudio − ask`. Five consecutive runs is the D1 protocol.
That is a controller/owner action with a live key, not a subagent action.

---

## 3 · Q2 — which remaining tasks actually buy milliseconds

Ranked by expected ms per task, with the honest caveat on each.

| # | Task | Expected win | Notes |
|---|---|---|---|
| 1 | **Task 5's missing word cap** (one string edit) | **hundreds of ms to ~4 s** | The only measured 4.4× lever in the whole corpus (5,710 → 1,286 ms) is the length instruction, and the shipped clause has **no cap** — it is the weak version of the thing that was measured. Cheapest ms in the arc by a wide margin. Also directly shortens the first *sentence*, which is Task 4's input. |
| 2 | **Tasks 2+3+4** (text streaming + first-sentence handoff) | **~50 ms to ~4,500 ms — entirely dependent on answer length** | Replaces T(full answer) with T(first sentence) = **1,238 ms measured**. If the brevity clause is already producing ~150-char answers, the full answer arrives at ~1,286 ms and the win is **~50–100 ms for three tasks of work.** If answers still run 400–1,500 chars, the win is seconds. **This is the arc's biggest open unknown and it is measurable today** — one live ask, `textResp − textReq` from `__vcLat`, tells you which world you are in. **Recommend measuring that before dispatching Tasks 2–4.** |
| 3 | **Task 6** (Worker metered streaming) | **~1,000–1,800 ms for MANAGED users; 0 ms for BYOK** | Today it is the *only* thing preventing managed users from getting streamed audio at all (the 404 → blocking fallback above). If the demo runs BYOK, Task 6 buys **zero latency** — it remains required as the security/bill deliverable that spec §1 "Non-constraints" explicitly refuses to relax, but it should not be sequenced as a latency task. **Owner question: is the demo device BYOK or managed?** That answer re-ranks this row from #3 to #1 or to "not a latency task at all". |
| 4 | **Task 8 pre-warm** | **~100–400 ms, first request only** | TLS/H2/isolate cold start. Unmeasured here. Real for D1's "the first question must not be the slow one" framing; zero on runs 2–5 of the D1 median. The stall watchdog half of Task 8 buys **0 ms** — it is a D2 robustness deliverable. |
| 5 | **Task 7 tier skeleton** | **0 ms** | Infrastructure. |
| 6 | **Task 9** | **0 ms** | It is the measurement and the gate. |

---

## 4 · Q3 — is the D1 bar still reachable?

**Arithmetically yes; as specified, at material risk. I would raise it with the owner now rather than
at Task 9.**

The floor is the sum of two independently measured legs:
**1,238 ms (first sentence) + 1,101 ms (first audio frame) = 2,339 ms** — inside the 3,000 ms median bar
with ~660 ms of headroom. That is the plan's own basis and it still stands.

Four reasons the *measured-in-the-app* number may not clear it:

**R-1 — the 660 ms of headroom is browser-free and proxy-free.** Both legs were measured from Node,
direct to Google, on one desk network. The app adds: WebAudio `resume()`, base64→PCM decode, the SSE
frame walk, and — for managed — a **Cloudflare Worker hop on both legs**, which spec §2 itself calls
"small, but not zero" and never quantified. 660 ms is not a comfortable budget for all of that.

**R-2 — `no run > 5,000 ms` collides with a preview model that we have already watched rate-limit.**
`gemini-3.1-flash-tts-preview` 429'd chunks 2–12 within an hour of v280 (`0bee32f`). D1 is five
*consecutive* runs. A single 429 on the opening chunk triggers `gemSpeakSeg`'s one polite retry
(`gemRetryDelayMs`, app.js:6647) — **up to 10,000 ms of backoff**, which fails that run's 5,000 ms
ceiling outright. R-41 records the quota freeing when the key's project reached Tier 1, which helps,
but nothing in the plan protects D1 from a per-minute limit under a back-to-back 5-run loop.
**Nothing in the arc addresses this.**

**R-3 — D1 is measured on D3, and D3's question is number-bearing.** The fixed demo question is
*"אני מעשן בריסקט 5 ק"ג ב-110 מעלות — איך אדע מתי לעטוף?"*. A model answering it will very plausibly
open with a sentence containing a number (110 °C, 74 °C, "8 שעות"). If the **first** sentence fails
`vcStreamSafe`, early speech never starts (spec §6.2: the gate **freezes** on the first failure), and
first sound falls back to full-answer-then-guard — i.e. the D1 run measures the **non-streaming** path,
~3.5–6 s. The plan's own D1 script cannot detect this because it measures raw legs in Node with no gate
(NW-6). **A green script and a failing product is the exact failure shape this project's
`verify-against-the-runtime-path` skill exists to prevent.**

**R-4 — `VC_TTS_OPEN_MIN` merge-forward** (app.js:6766, shipped in `4d19d0f` to fix R-47(a)) can make
chunk 0 longer than `VC_TTS_OPEN_MAX`, and first-synthesis time scales at a measured **55 ms/char**.
Its own comment accepts "a few hundred extra ms" — spent directly out of D1's headroom, and it must not
be reverted (it is why the clock time is audible again).

---

## 5 · Recommendations for the owner (§4 — recommendations only, nothing changed)

1. **Measure before dispatching Tasks 2–4.** One live ask; read `__vcLat`. If `textResp − textReq`
   is already ~1.3 s, Tasks 2+3+4 buy ~50–100 ms and the arc's remaining latency value is almost
   entirely in Task 5's word cap. This is a scope decision only the owner can make.
2. **Do Task 5's word cap first** (spec §7 already requires it; the shipped clause under-implements it).
   Cheapest measured ms in the arc, and it shortens Task 4's own first-sentence input.
3. **Decide BYOK vs managed for the demo device.** It changes whether Task 6 is a latency task or purely
   a security deliverable, and it changes the D1 arithmetic by ~1–1.8 s.
4. **Task 4 needs re-planning, not re-implementing** (NW-1/2/3): early speech must (a) respect the
   coalescing budget rather than one request per sentence, (b) thread and return the audio cursor, and
   (c) be a surgical edit to `vcAskFlow`/`vcSpeak` rather than a wholesale body replacement. Recommend
   Fable-high re-plans Task 4 against the shipped `gemSpeak` before any implementer is dispatched.
5. **Raise R-2 and R-3 with the owner before Task 9**, not at it. R-3 in particular means D1's pass
   condition may be unmeasurable by the plan's own instrument.
6. **Re-stamp the release** to v282 (or the next free number) throughout Task 9.
7. **Fix the seeding shape** (NW-5) in every remaining test snippet when each task's brief is written.

---

## 6 · What I could not establish

- The **actual** current first-sound latency (no live key used; see Q1).
- Whether the shipped uncapped brevity clause is in practice producing short answers. Determines the
  entire value of Tasks 2–4.
- Whether the TTS preview model's current quota (post-R-41 Tier 1) survives five back-to-back runs.
- Worker proxy round-trip cost on the streaming path (the route does not exist yet, so it is
  unmeasurable until Task 6).
