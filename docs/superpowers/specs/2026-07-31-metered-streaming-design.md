# Metered Streaming — design spec (R-36 streaming leg · R-37 · R-38 · R-36a) — v281

**Date:** 2026-07-31 · **Status:** DRAFT — awaiting owner approval (pipeline §2: no code before approval)
**Owner rulings this spec lands:** R-37 GO (31.7): *"אפשר לטפל בהגנה בתוך הפרוקסי, וגם לכל משתמש יש טוקן כך
שאפשר לחסום ברמת המשתמש ולא באופן גורף"* · R-36(ב) streaming GO · R-36(א) length instruction approved ·
R-38 tier infrastructure (infrastructure ONLY).
**Measured basis:** `docs/analysis/2026-07-31-qa-latency-measured.md` + `docs/analysis/2026-07-31-voice-latency-baseline.md`.
**Builds on:** Voice Wave 0 (`docs/superpowers/specs/2026-07-31-voice-wave0-design.md`) — the chunked TTS
pipeline (`vcChunkText`/`gemSynthChunk`/`gemSpeak`), the speaker-generation token (`vcSpeakGen`), INV-T,
and the v278 spoken-safety guard (`vcGuardSpoken`, marker-binds-to-number, wrong-field fails closed).
**Plan:** `docs/superpowers/plans/2026-07-31-metered-streaming.md`.

---

## 1 · Goals and the measured target

| # | Goal | Measured basis |
|---|---|---|
| G1 | **~3.3 s to first sound** for a free-form voice answer (vs ~99 s today): stream the answer, synthesize the first complete sentence the moment it closes | first sentence ready at **1.24 s** (streaming) + TTS floor **~2 s** ≈ 3.3 s |
| G2 | **The streaming route returns to the Worker metered** — never as the unmetered passthrough B19 closed. Reserve up-front, count in-flight, reconcile at end, fail closed on every unknown | B19 (Phase 1 Task 6) was a deliberate security fix; the owner's GO explicitly requires protection *inside the proxy* |
| G3 | **Per-user enforcement** — a user who exhausts their quota is blocked individually (402 on their code at the next admission); no global switch, nobody else affected | owner ruling R-37: "לחסום ברמת המשתמש ולא באופן גורף" |
| G4 | **Tier infrastructure (R-38)** — `tier` on the code record; cap / rate limit / streaming allowance derive from a tier table; a record with no tier falls back to `default` with **zero behaviour change** for existing users; `central-code.mjs` mints/changes/audits tiers | owner ruling R-38: "תשתית עכשיו, מדיניות עסקית בהמשך" |
| G5 | **One client pipeline, two transports** — BYOK streams straight to Google, managed streams through the Worker, through the SAME code path (a shared transport builder); the code must not fork | gemFetch already has this shape (app.js:5497-5527); streaming reuses it |
| G6 | **Length instruction for voice answers (R-36a)** with a hard safety-completeness override — a safety answer is never truncated into uselessness | length instruction measured: 5.7 s/1,488 chars → **1.29 s/147 chars** |
| G7 | The v278 spoken-safety guarantees and INV-T **hold through streaming** — the guard never inspects a fragment | constraint; see §6 for exactly when the guard runs |

### Non-goals (explicit out-of-scope)
- **Pricing, commercial tier names, tier UI, billing** — band-H / Paddle (D8). The tier table's keys are
  infrastructure identifiers (`default`, `extended`), not products.
- **Streaming for any call site other than the voice ask** (`vcAskAI`). The text ask panel, recipe AI,
  photo analyze etc. keep `generateContent`. (The Worker route is generic; adopting it elsewhere is a
  later, separate decision.)
- **TTS audio-output streaming** — supported by Google on the model we use but via a different API
  surface (§8); v281 does not depend on it and only keeps the seam open.
- **Durable Object cross-isolate atomicity** — stays trigger-anchored to Sync Thread / S1 exactly as the
  H-3 comment in `worker/index.js` records. Streaming rides the same per-isolate `withCodeLock` +
  debit-first bounds as `generateContent`.

---

## 2 · The Worker route (G2) — metered streaming

### 2.1 Route and contract
`POST /v1beta/models/<model>:streamGenerateContent` (same pathname as Google's own), with
`?alt=sse` — the client **always** sends `alt=sse` (the plan pins it in the transport builder), so the
body is Server-Sent Events: `data: {json}\n\n` frames, each frame a `GenerateContentResponse` fragment
carrying `candidates[0].content.parts[].text` deltas and (cumulatively, with the final frame
authoritative) `usageMetadata.totalTokenCount`. The Worker forwards `url.search` verbatim.
Headers/auth/CORS identical to the existing route (`X-Access-Code`, allowlist CORS).

The `fetch` handler signature gains its third parameter — `async fetch(request, env, ctx)` — because
reconcile-after-disconnect (§2.4) requires `ctx.waitUntil`.

### 2.2 Admission — the existing debit-first machinery, shared
The streaming route runs the **same admission block** as `generateContent`, factored into one helper so
the two routes cannot drift: rate-limit window (now tier-derived, §4) → `withCodeLock(code)` →
`invalid_code` / `code_record_corrupt` / `code_disabled` / `code_uncapped` / `quota_reached` (402) →
**debit `RESERVE_TOKENS` (2000) FIRST**, then proceed. One streaming-only check rides in the same locked
section: a tier with `streaming: false` → `403 {error:'streaming_not_allowed'}` **before** the debit
(the refusal costs the user nothing). All refusals happen before any upstream byte — so the client
always receives admission errors as a plain JSON response, never mid-stream, and the existing
`gemFetch`-style "managed 401/402/403 → BYOK if a key exists" fallback applies cleanly (§5).

### 2.3 Counting while the stream flows
The hard part: tokens are only fully known at the end. Design:

1. The upstream body is **piped through the Worker** (TransformStream tee): every byte goes to the
   client as it arrives, AND through an SSE scanner that maintains a meter:
   - `meter.total` ← the latest `usageMetadata.totalTokenCount` seen (Gemini reports cumulatively;
     the final frame is authoritative), `meter.sawUsage` flag;
   - `meter.chars` ← sum of `parts[].text` lengths (the fail-closed estimator's input).
2. **Reconcile on completion** with the existing `reconcile()` (unchanged):
   `actual = sawUsage ? total : max(RESERVE_TOKENS, ceil(chars/3))` — when Google never reported usage,
   the charge is *at least* the full reserve and *at least* a conservative character-derived estimate
   (`/3`, deliberately denser than the ~4-chars/token English rule because Hebrew tokenizes denser).
   **Never a refund on missing data** — the same fail-closed rule the non-streaming route already
   applies to a non-parseable 200 body.
3. **Per-stream hard ceiling** (`tier.streamMaxTokens`, §4): if the running count (usage if seen, else
   the char estimate) crosses it, the Worker cancels upstream and closes the client stream **at an SSE
   frame boundary** (never mid-frame — the client parser stays coherent). This is an abuse guard against
   a runaway generation, **not** cap enforcement (see §2.5) — with `maxOutputTokens: 8192` client-side
   and the R-36a brevity prompt, a legitimate voice answer never approaches it.

### 2.4 Failure modes — named, each with its chosen behaviour

| # | Failure | Behaviour | Why |
|---|---|---|---|
| F1 | Upstream unreachable / timeout **before any byte** | refund reserve (`reconcile(…, 0)`), JSON `504 upstream_timeout` / `502 upstream_unreachable` | identical to the non-streaming route today (worker/index.js:137-140) |
| F2 | Upstream returns non-2xx | body passed through as JSON with Google's status; reserve refunded (`actual=0`) | mirrors the existing route: a failed call is never charged |
| F3 | Upstream dies **mid-stream** | client stream closes (truncated SSE); reconcile with `max(counted, RESERVE if nothing counted)` — counted work is charged, unknown fails closed | partial generation was still generated; the client treats a stream that ends without a finish frame as an error (§5) |
| F4 | **Client disconnects mid-stream** | writer error → cancel upstream (stop the spend), then reconcile with the same fail-closed formula. The reconcile promise is registered with `ctx.waitUntil` **before** the response returns, so it survives the disconnect | tokens already generated are charged; upstream is cancelled so an abandoned stream never runs to completion at the owner's expense |
| F5 | **User crosses their cap mid-stream** | **the stream completes** (bounded by F6); the over-debit lands at reconcile; the user's NEXT request is refused 402 at admission | §2.5 — the safety ruling |
| F6 | Runaway generation | per-stream ceiling `tier.streamMaxTokens` cuts at a frame boundary; counted tokens charged | bounds the worst-case overshoot of F5 to one allowance |
| F7 | No `usageMetadata` anywhere in a completed stream | charge `max(RESERVE_TOKENS, ceil(chars/3))` | fail closed, never free |
| F8 | KV write fails at reconcile | the reserve debit (written at admission) stands — over-debit, never a free ride | the existing debit-first philosophy, verbatim |
| F9 | Rate-limit window exceeded | 429 + Retry-After at admission, same window as `generateContent` — streams are requests | one budget, no side door |

### 2.5 The mid-stream-cap decision (F5) — never cut, and why
When `used` crosses `cap` mid-stream, the Worker **does not cut the stream and does not stop at a
sentence** — it lets the stream complete (F6 bounds it). Rationale, in order:

1. **Safety.** This is a live-fire cooking product. A truncated instruction can invert meaning — cutting
   *"בשל עד 74°C; מתחת לזה אל תגיש"* after "74°C" deletes the caveat and leaves a confident, wrong
   instruction. A guard that lets a half-instruction through is the exact failure class v278 closed for
   numbers; we do not reintroduce it for cut-off streams. "Finish the sentence" is not safe either — the
   caveat is routinely a *following* sentence.
2. **Bounded exposure.** The overshoot is at most one stream ≤ `streamMaxTokens` (4096 default) — about
   0.2% of the default 2M cap. Debit-first already accepts bounded overshoot in the other direction
   ("a crash mid-flight leaves an over-debit, never a free ride"); this is the same trade.
3. **Per-user enforcement is preserved** (G3): the over-cap user's next admission is 402; a user who
   repeatedly rides the overshoot is visible in `used > cap` and blockable individually
   (`active:false` / revoke) — the owner's stated model.

### 2.6 What the offending user sees; what everyone else keeps
- **The over-cap managed user:** their current answer finishes playing. The next ask returns
  `402 quota_reached` at admission → `gemFetch`/`gemStreamFetch` falls back to their personal key if
  one is configured (existing behaviour, app.js:5517), else the existing quota toast path. Voice shows
  the standard "ה-AI לא זמין" answer text; nothing crashes, nothing hangs.
- **Every other user:** completely unaffected — all state is keyed on the individual access code
  (`code:<code>` record, per-code lock, per-code rate window). There is no global kill switch in this
  design and none is added.
- **The owner:** `central-code.mjs show/audit` displays `used`/`cap`/`tier`; revoke/disable stays
  per-code and instant.

---

## 3 · What stays true from B19
The B19 lesson was: *an unmetered streaming passthrough is a token-cap bypass*. The route that returns
is not that route: reserve-before-byte, count-in-flight, reconcile-at-end, fail-closed defaults, and a
per-stream ceiling. The Phase 1 Task 6 comment in `worker/index.js` (lines 91-93) is rewritten to record
the new truth: the route is OPEN and metered, re-closed only by removing the metering (which review must
treat as a security regression). The B19 vitest ("streaming route returns 404") is **rewritten, not
deleted** — its successor asserts the security property that matters now: *no upstream byte flows before
admission passes and the reserve is debited* (test names in the plan).

---

## 4 · Tier infrastructure (G4 · R-38) — infrastructure ONLY

### 4.1 The tier table (worker/index.js)
```
const TIERS = {
  default:  { ratePerMin: 20, streaming: true,  streamMaxTokens: 4096, mintCap: 2_000_000 },
  extended: { ratePerMin: 60, streaming: true,  streamMaxTokens: 8192, mintCap: 20_000_000 },
};
function tierOf(rec) { return TIERS[rec && rec.tier] || TIERS.default; }
```
- `ratePerMin` replaces the `RATE_MAX_PER_WINDOW` constant as the per-code limit (`default` = today's
  20 — zero behaviour change).
- `streaming` + `streamMaxTokens` are the streaming allowance (§2). `default` allows streaming — the
  arc's purpose is to give managed users streaming; "no behaviour change" refers to everything that
  exists today (caps, rate, non-streaming route), and streaming is strictly additive.
- `mintCap` is used **only by `central-code.mjs` at mint time** — the Worker itself keeps refusing a
  record without an explicit positive `cap` (the E14 fail-closed rule is untouched; tiers never make a
  capless record valid).
- The record keeps its explicit per-code `cap` as the quota of record. A tier does NOT override an
  existing `cap` — so every existing record behaves byte-for-byte as today (`tier` absent → `default` →
  rate 20, streaming allowed, cap = the record's own).

### 4.2 `scripts/central-code.mjs`
- `add <label> [capTokens] [--tier <name>]` — unknown tier name refuses at mint (dead-on-arrival guard,
  same spirit as the cap guard); cap defaults to the tier's `mintCap` when omitted; the record gains
  `tier: <name>` (omitted entirely for `default` — existing-shape records remain the canonical shape).
- `tier <code> <name>` — read-modify-write the record's `tier` field (and only it).
- `show` / `audit` display the tier (audit shows `tier=default (implicit)` for a record without one, and
  flags an **unknown** tier name as a warning — it still works, as `default`, but the owner should know).

### 4.3 Out of scope, stated to prevent drift
No pricing, no commercial names, no per-tier UI, no billing hooks, no tier upsell copy, no Paddle. Those
are band-H (D8) and are decided commercially. The only consumers of `tier` in v281 are the Worker's
quota resolution and `central-code.mjs`.

---

## 5 · The client (G1 · G5) — stream, assemble, synthesize

### 5.1 One transport, no fork
`gemFetch`'s mode logic (managed URL + `X-Access-Code` vs Google URL + `x-goog-api-key`, BYOK fallback
on managed 401/402/403) is factored into a shared builder `gemTransport(mdl, verb)` used by BOTH
`gemFetch` (verb `generateContent`, behaviour unchanged) and the new `gemStreamFetch` (verb
`streamGenerateContent`, query `alt=sse`). BYOK and managed users therefore run the **same streaming
code**; only the URL/header pair differs — the code cannot fork because there is only one of it.

`gemStreamFetch(role, body, opts, onDelta)`:
- POSTs, reads the SSE body incrementally (`response.body.getReader()` + TextDecoder + frame splitting
  on `\n\n`), calls `onDelta(text)` per parsed text fragment, returns the full concatenated text.
- A stream that ends without a `finishReason` frame → throws (`stream-truncated`) — F3's client half.
- Managed 401/402/403 → retry once via BYOK if `gemKey()` exists (mirror of app.js:5517).
- Managed **404** → the deployed Worker predates the route: throw `stream-unsupported`; the caller
  (§5.2) falls back to the existing non-streaming `vcAskAI` so the app never breaks against a stale
  Worker. (Deploy order becomes free: Worker first is correct, but app-first merely loses streaming.)
- No mid-stream auto-retry: a retry would replay the whole generation (double cost, double debit).

### 5.2 The voice flow — first sentence to the synthesizer
`vcAskFlow` (voice ask only) switches to `gemStreamFetch` with a **sentence assembler**: deltas
accumulate in a buffer; a sentence closes on the SAME boundary rule as `vcChunkText` (terminator
`[.!?…]` + whitespace — a decimal can never split), or on stream end. Each closed sentence is offered to
the **stream gate** (§6). Gate-passed sentences go straight into the existing chunked pipeline —
`gemSynthChunk` for synthesis, `gemPlayBuf` under the **speaker-generation token** (`vcSpeakGen`), so
barge-in/stop semantics are exactly Voice Wave 0's. First sound ≈ first-sentence-close (1.24 s) + one
short synthesis (~2 s) ≈ **3.3 s** (G1). When the stream completes, `vcGuardSpoken` runs on the **whole
answer** (§6) and the remainder (guarded text minus the already-spoken prefix) is spoken through the
same pipeline; `vcLastQA` is set to the full guarded string (transcript rule, §6).

BYOK and managed both take this path (G5). Non-voice ask surfaces are untouched.

---

## 6 · The safety guard under streaming (G7) — when the guard runs

**The invariant that must not bend:** `vcGuardSpoken`'s eligibility rule is answer-scoped ("the answer
must carry exactly ONE number in total…"). Running it per-sentence would change its semantics — a
one-number sentence inside a three-number answer could borrow the verified marker the whole-answer rule
denies. And a guard over half a sentence is worse than useless. Therefore:

1. **The guard runs exactly once, on the complete assembled answer** — never on a fragment, never on a
   sentence, never incrementally. Chunk assembly (the sentence assembler) is *upstream* of the guard for
   early sentences and *complete* before the guard for the final pass.
2. **Early speech is allowed only for provably guard-neutral sentences.** The stream gate
   (`vcStreamSafe(sentence)`): normalize with `UNITS.normalize` (the same seam `vcGuardSpoken` uses),
   then require **zero digit runs** (`safetyNumRe()`, the ONE shared number definition — never a second
   pattern, per the SAFETY_NUM covenant) and zero unit-bearing tokens (`aiSafetyNums`). A digit-free
   sentence is untouchable by every guard branch (redaction and markers only ever attach to number
   tokens), so speaking it early cannot leak, corrupt, or pre-empt anything the whole-answer guard will
   decide. The moment ANY sentence fails the gate, early speech **freezes** — nothing further is spoken
   until the stream completes and the whole-answer guard has run. With the R-36a brevity prompt the
   whole answer typically arrives within ~1.3 s anyway, so the freeze costs little; the win survives in
   the common opening ("קודם כל, עטוף אותו…").
3. **After the guard:** the guarded string's prefix must equal the normalized already-spoken prefix (by
   construction it does — the guard is the identity on digit-free text apart from normalization, which
   the gate already applied). A defensive mismatch check exists; on mismatch the whole guarded string is
   spoken from the start (correctness over polish; unreachable by construction, asserted by test).
4. **Transcript honesty (v278 rule — one guarded string, both surfaces):** during streaming, `vcLastQA`
   shows only gate-passed sentences plus an ellipsis; the final render replaces it with the full guarded
   string. No unguarded text ever reaches the screen or the speaker.
5. **INV-T is untouched:** `ttsText` remains the ONLY transform between guard-approved text and the
   engine, for early sentences and the guarded remainder alike. The existing INV-T test keeps pinning it;
   a new test drives a streamed answer with numbers end-to-end (names in the plan).

---

## 7 · The length instruction (G6 · R-36a)

Appended to the **voice** system prompt (`vcBuildAskPrompt` only — `askGemini`'s panel prompt keeps its
"מלאה ומועילה" instruction):

- **Brevity clause:** answer in 1–3 short sentences, ≤ ~60 words — "אתה עוזר קולי; התשובה מוקראת בקול
  ליד המעשנה". (Wording per language rides the existing prompt-language mechanism of R-31.)
- **The hard safety override, in the same breath:** if the question concerns a safe temperature,
  cooking/curing duration, or food safety — the **number, its unit, and the essential caveat must appear
  in full**, even if the answer runs longer. Brevity never truncates safety. A safety answer without its
  number is a wrong answer.

**The named test:** `tests/metered-streaming.spec.ts` →
`'R-36a: the voice brevity instruction carries the safety-completeness override'` — asserts the built
voice system prompt contains both clauses (brevity + override), and that the panel prompt contains
neither. Model *obedience* is not unit-testable deterministically; the plan adds a scratchpad live-key
probe (safe-temp question → answer contains a °C figure + caveat) run once at the release gate and
pasted as evidence — stated openly as a measurement, not a suite test.

---

## 8 · Research answer: does Gemini TTS stream audio output?

**Yes — for exactly the model this app uses.** Google's speech-generation docs state: *"Streaming is
supported for Text-to-Speech (TTS) models starting with version 3.1 (including
`gemini-3.1-flash-tts-preview`)"* — and the app's TTS role is `gemini-3.1-flash-tts-preview` (model
registry, migrated 2026). The 2.5-generation TTS models do **not** stream.
**But:** TTS streaming is exposed through the **Interactions API** (`stream: true`; audio arrives as
base64 PCM chunks in delta events), a different API surface from the `generateContent` contract the
whole app (and the Worker proxy) speaks. Sources:
[ai.google.dev/gemini-api/docs/speech-generation](https://ai.google.dev/gemini-api/docs/speech-generation) ·
[Interactions API speech generation](https://ai.google.dev/gemini-api/docs/interactions/speech-generation) ·
[Google AI dev forum: Gemini 2.5 Flash TTS streaming](https://discuss.ai.google.dev/t/gemini-2-5-flash-tts-streaming/88608).

**Design consequence for v281:** do not depend on it. Adopting a second API surface mid-arc would widen
the Worker's metered surface and the client transport in one step too many. The design *accommodates*
it: (a) the Worker's admission/metering machinery is written against "a streamed SSE body with usage
metadata", not against the `streamGenerateContent` path shape specifically — a future
`/interactions`-style route reuses admission, tee-metering and reconcile as-is; (b) on the client,
`gemSynthChunk` returns an AudioBuffer behind a stable seam — a future streaming synthesizer replaces
its internals without touching the chunker, the guard, or the generation token. When adopted, first
sound drops below the ~2 s TTS floor; that is the named next latency step after v281, not part of it.

---

## 9 · Global constraints (verbatim into the plan)
1. **Secrets never enter the repo.** `GEMINI_API_KEY` exists in the environment for measurement only —
   never read into committed code, never printed. Worker secrets stay Worker secrets.
2. **Safety invariance (DoD-10):** no `bcheck` stage, `temp`, `safe` value, or cook duration altered
   anywhere in this arc.
3. **The v278 spoken-safety guarantees + INV-T hold through streaming** (§6): the guard runs on the
   complete answer only; early speech only through the digit-free gate; `ttsText` remains the only
   post-guard transform.
4. **`tests/TEST-AUTHORING-CONTRACT.md` binds every Playwright test** (warm page + `seedApp`, no
   `addInitScript`, condition-based waits, `npx playwright test` plain). Worker tests run under
   `cd worker && npm test` (vitest, real workerd) — both suites are release gates.
5. **B19 must not regress:** no unmetered byte ever flows upstream; admission precedes the first
   upstream byte on every path.
6. **No behaviour change for existing users:** records without `tier` behave exactly as today on the
   non-streaming route (rate 20/min, their own cap, same errors).
7. **Out of scope:** pricing/product tiers/UI/billing (band-H, D8); streaming for non-voice call sites;
   TTS audio streaming (seam only).

## 10 · DoD — the arc gate (each line checkable with evidence)
1. Worker vitest: admission-before-byte on the streaming route (all refusal paths; zero upstream calls);
   reserve debited before upstream; reconcile-to-actual from streamed `usageMetadata`; fail-closed charge
   when usage is absent (F7); refund on pre-byte upstream failure (F1/F2); disconnect reconcile via
   `waitUntil` (F4); ceiling cut at frame boundary (F6); `streaming:false` tier → 403 with no debit.
   RED witnessed for each.
2. Worker vitest: tier resolution — no-tier record = `default` = today's numbers (regression pin);
   `extended` rate honoured; unknown tier name = `default`.
3. `central-code.mjs`: `--tier` mint, `tier` change command, `show`/`audit` display; unknown tier refused
   at mint. (Verified by direct invocation output — pasted.)
4. Playwright: `gemStreamFetch` parses SSE deltas (mocked route per the contract's route rules);
   managed 404 → non-streaming fallback; managed 402 + BYOK key → BYOK retry.
5. Playwright: sentence assembler closes on the vcChunkText boundary rule; decimal never splits.
6. Playwright: the stream gate — digit-free sentence speaks early; a digit-bearing sentence freezes
   early speech; guard runs once on the full answer; final transcript equals the guarded string;
   the streamed-answer-with-numbers end-to-end test (redaction/marker behaviour identical to
   non-streaming — same fixtures as `p0-spoken-safety`).
7. `'R-36a: the voice brevity instruction carries the safety-completeness override'` green; the panel
   prompt unchanged (negative case).
8. INV-T test still green; no new transform between guard and engine.
9. Latency: `window.__vcLat` gains `firstSentence`; live-key measurement pasted at the release gate
   showing first sound ≤ ~3.5 s on the standard brisket question (target 3.3 s; the miss, if any,
   stated loudly with its breakdown).
10. Hebrew/visual: any new user-facing string rendered in Hebrew at 390×844, screenshot looked at
    (DoD-8/9); numeric readouts in `dir="ltr"` islands (L13).
11. Both suites green at the release commit: `cd worker && npm test` ×1 task-gate / and with the full
    `npx playwright test` ×2 at release (H7), serialized per §11a. Live URL verified per §10.10 before
    "v281 is live" is uttered.
12. ROADMAP §5a rows R-36(ב)/R-37/R-38 updated to their landed state; STATUS-BOARD updated (H10).

## 11 · Open questions for the owner (before implementation)
1. **F5 confirmation:** the never-cut-mid-stream rule (§2.5) accepts a bounded overshoot
   (≤ `streamMaxTokens` ≈ 0.2% of the default cap) in exchange for never truncating a cooking
   instruction. Veto → the alternative is cut-at-frame-boundary with the same safety caveat we argued
   against; say the word and it becomes a tier flag.
2. **Tier identifiers:** `default` / `extended` as the two infrastructure rows (no commercial meaning).
   More rows, other names, other numbers — one-line change; the numbers above are proposals.
3. **`extended` quotas:** rate 60/min, streamMax 8192, mintCap 20M — proposals for the owner's own
   power-use; adjust freely.


---

## 🧑 פסקי בעלים על שאלות המפרט (31.7.2026)

| # | השאלה | הפסק |
|---|---|---|
| **F5** | חריגת מכסה **באמצע זרימה** | ✅ **לעולם לא לקטוע.** הזרימה מושלמת (חסומה מראש ב-`streamMaxTokens`), החריגה נרשמת, ו**הבקשה הבאה** נדחית ב-402. הנימוק שאושר: קטיעת הוראת בישול באמצע עלולה **להפוך את משמעותה** — "משוך ב-74°C; מתחת לזה אל תגיש" שנקטע אחרי המספר מאבד את האזהרה. חריגה חסומה-בגודלה עדיפה על תשובה שמסכנת. |
| **מדרגים** | שמות ומספרים לפתיחה | ✅ **מאושר כהצעה:** `default` — 20 בקשות/דקה · `extended` — 60 בקשות/דקה. **תשתית בלבד**: השמות והמספרים ניתנים לשינוי כשתוכרע המדיניות העסקית (band-H/Paddle), והמנגנון לא ייגע שוב. |

**נגזרת:** אין יותר שאלות פתוחות במפרט — הביצוע רשאי להתחיל (שער §2 עבר).
