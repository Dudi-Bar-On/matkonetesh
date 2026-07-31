# Metered Streaming — design spec (R-36 streaming leg · R-37 · R-38 · R-36a · R-39 · R-40) — v281

**Date:** 2026-07-31 · **Status:** APPROVED, **REVISED 31.7 (three owner rulings — R-39/R-40 + the
demo-purpose ruling)** — the revision re-prioritizes the arc around measured audio streaming and the
demo quality bar; see the rulings table at the end.
**Owner rulings this spec lands:** R-37 GO (31.7): *"אפשר לטפל בהגנה בתוך הפרוקסי, וגם לכל משתמש יש טוקן כך
שאפשר לחסום ברמת המשתמש ולא באופן גורף"* · R-36(ב) streaming GO · R-36(א) length instruction approved ·
R-38 tier infrastructure (now MINIMAL per R-40) · **R-39: audio streaming works TODAY on the existing
endpoint — measured, first audio frame 1,101 ms** · **R-40: no existing users — performance first,
metering sophistication second** · **the arc's purpose is demos and marketing** (owner: *"חשוב בעיקר
להדגמות ושיווק"*) — folded into the DoD as a quality bar, §10.
**Measured basis:** `docs/analysis/2026-07-31-qa-latency-measured.md` + `docs/analysis/2026-07-31-voice-latency-baseline.md`.
**Builds on:** Voice Wave 0 (`docs/superpowers/specs/2026-07-31-voice-wave0-design.md`) — the chunked TTS
pipeline (`vcChunkText`/`gemSynthChunk`/`gemSpeak`), the speaker-generation token (`vcSpeakGen`), INV-T,
and the v278 spoken-safety guard (`vcGuardSpoken`, marker-binds-to-number, wrong-field fails closed).
**Plan:** `docs/superpowers/plans/2026-07-31-metered-streaming.md`.

---

## 1 · Goals and the measured target

| # | Goal | Measured basis |
|---|---|---|
| G1 | **First sound ≤ 3.0 s — an acceptance criterion, not an aspiration** (§10 DoD-D1) for a free-form voice answer (vs 7.6 s blocking-TTS floor / ~99 s worst-case today): stream the TEXT answer, hand the first gate-passed sentence to a **streaming TTS synthesis**, and play the first audio frame the moment it arrives | first sentence closes at **1.24 s** (text streaming) + first audio frame at **1,101 ms** on the SAME `streamGenerateContent` endpoint (R-39, measured 31.7) → expected ≈ **2.3 s**; 3.0 s is the pass bar with headroom |
| G2 | **The streaming route returns to the Worker metered** — never as the unmetered passthrough B19 closed. Reserve up-front, count in-flight, reconcile at end, fail closed on every unknown | B19 (Phase 1 Task 6) was a deliberate security fix; the owner's GO explicitly requires protection *inside the proxy* |
| G3 | **Per-user enforcement** — a user who exhausts their quota is blocked individually (402 on their code at the next admission); no global switch, nobody else affected | owner ruling R-37: "לחסום ברמת המשתמש ולא באופן גורף" |
| G4 | **Tier skeleton (R-38, narrowed by R-40 to MINIMAL)** — the `tier` field on the code record, the `TIERS` table, and a `default` row from which rate / streaming allowance / stream ceiling derive; a record with no (or an unknown) tier resolves to `default`. **Nothing more:** no second row, no tier-change CLI, no mint flag — those are one-line adds when business policy exists (band-H) | owner ruling R-38 ("תשתית עכשיו, מדיניות עסקית בהמשך") narrowed by R-40: "תשתית המדרגים יכולה להישאר מינימלית" |
| G5 | **One client pipeline, two transports** — BYOK streams straight to Google, managed streams through the Worker, through the SAME code path (a shared transport builder); the code must not fork | gemFetch already has this shape (app.js:5497-5527); streaming reuses it |
| G6 | **Length instruction for voice answers (R-36a)** with a hard safety-completeness override — a safety answer is never truncated into uselessness | length instruction measured: 5.7 s/1,488 chars → **1.29 s/147 chars** |
| G7 | The v278 spoken-safety guarantees and INV-T **hold through streaming** — the guard never inspects a fragment | constraint; see §6 for exactly when the guard runs |
| G8 | **Demo-grade (the arc's purpose ruling)** — the first 10 seconds decide a demo: pre-warmed connections so the FIRST question is not the slow one; degraded-but-working on a weak network (a stall is visible and recoverable, never silent-and-broken); a **fixed, repeatable demo scenario** verified end-to-end before anything is shown; verified on a real device at 390×844 | owner 31.7: "חשוב בעיקר להדגמות ושיווק" — folded into §5.4/§5.5 and DoD-D1..D4 |

### Non-goals (explicit out-of-scope)
- **Pricing, commercial tier names, tier UI, billing** — band-H / Paddle (D8). The tier table's single
  key (`default`) is an infrastructure identifier, not a product.
- **Streaming for any call site other than the voice ask** (`vcAskAI`) and the voice TTS synthesis. The
  text ask panel, recipe AI, photo analyze etc. keep `generateContent`. (The Worker route is generic;
  adopting it elsewhere is a later, separate decision.)
- **Durable Object cross-isolate atomicity** — stays trigger-anchored to Sync Thread / S1 exactly as the
  H-3 comment in `worker/index.js` records. Streaming rides the same per-isolate `withCodeLock` +
  debit-first bounds as `generateContent`.

### Non-constraints (R-40 — say it explicitly so nobody re-imports them)
**There are no existing users — the product is in development** (owner 31.7: *"כרגע אין משתמשים
קיימים… זה גם הופך את הבעיה האלגוריתמית לפחות קריטית; הכי חשוב לי הביצועים המקסימליים"*). Therefore:
- **Backward compatibility and storage migration are NOT constraints.** Data shapes (code records, KV
  layout, client storage) may change freely; no migration task exists in the plan and none is owed.
  "Zero behaviour change for existing users" phrasing elsewhere in older drafts is void — the only
  compatibility kept is the trivial one (`tier` absent → `default`), kept because it is the simplest
  code, not for anyone's sake.
- **F5 (never cut mid-stream, §2.5) stands** — it is right on its merits (a truncated cooking
  instruction can invert meaning) — but it is no longer a *blocking design question*; the algorithmic
  problem it guards is less critical with no user base.
- **What does NOT relax: Worker metering ships.** It protects the OWNER'S key and bill — an unmetered
  proxy is an open account (the exact B19 lesson). It ships simple; §2.7 names the sophistication
  deferred and why.

---

## 2 · The Worker route (G2) — metered streaming

### 2.1 Route and contract
`POST /v1beta/models/<model>:streamGenerateContent` (same pathname as Google's own), with
`?alt=sse` — the client **always** sends `alt=sse` (the plan pins it in the transport builder), so the
body is Server-Sent Events: `data: {json}\n\n` frames, each frame a `GenerateContentResponse` fragment
carrying `candidates[0].content.parts[].text` deltas and (cumulatively, with the final frame
authoritative) `usageMetadata.totalTokenCount`. **The same route also carries the TTS audio stream
(R-39):** a body with `responseModalities:['AUDIO']` on the TTS model returns frames whose parts carry
`inlineData` (base64 PCM) instead of `text` — the metering machinery is modality-agnostic (usage
metadata when present, fail-closed reserve when absent; the char estimator simply contributes 0 for
audio-only frames). The Worker forwards `url.search` verbatim.
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

### 2.7 Kept simple — the sophistication R-40 defers, named
The metering that ships is exactly what protects the key: **admission-before-byte, debit-first reserve,
tee count, fail-closed reconcile, disconnect reconcile (`ctx.waitUntil`), per-stream ceiling.** Deferred
deliberately, because there are no users to differentiate or migrate and performance ships first:
- **A second tier row (`extended`) and any tier-management CLI** (`--tier` mint flag, `tier <code>
  <name>` change command) — one-line adds when band-H decides policy; until then they are dead code.
- **Pre-ceiling frame buffering** (holding back a trailing incomplete frame near the ceiling) — the
  ceiling cut lands after the last complete scanned frame; good enough for an abuse guard.
- **Cross-isolate atomicity (Durable Object)** — unchanged from the original non-goal.
- **Any per-user fairness / anti-abuse analytics** — the meter exists for the owner's bill, not for a
  user population that does not exist yet.
Each deferral is re-openable by a one-line trigger in ROADMAP §5a when users exist (H8: nothing
unlanded — this list is the trigger anchor).

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

## 4 · Tier skeleton (G4 · R-38 narrowed by R-40) — the field, the table, a default row, nothing more

### 4.1 The tier table (worker/index.js)
```
const TIERS = {
  default: { ratePerMin: 20, streaming: true, streamMaxTokens: 4096, mintCap: 2_000_000 },
};
function tierOf(rec) { return TIERS[rec && rec.tier] || TIERS.default; }
```
- `ratePerMin` replaces the `RATE_MAX_PER_WINDOW` constant; `streaming` + `streamMaxTokens` are the
  streaming allowance (§2); `mintCap` is consumed only by `central-code.mjs` at mint time — the Worker
  itself keeps refusing a record without an explicit positive `cap` (the E14 fail-closed rule is
  untouched; tiers never make a capless record valid).
- The record keeps its explicit per-code `cap` as the quota of record; a tier never overrides it.
  `tier` absent or unknown → `default`. That fallback is kept because it is the simplest possible code —
  not as a compatibility promise (R-40: there are no existing users to be compatible with).
- **Earlier tier ruling reconciled:** the owner approved `default`/`extended` names-and-numbers as a
  proposal (rulings table below). R-40 then narrowed the *shipping* scope to the `default` row only —
  the `extended` row (60/min, 8192, 20M) is recorded HERE as the agreed numbers and lands as a one-line
  add when band-H opens. This is a scope narrowing by a later owner ruling, not a waiver.

### 4.2 `scripts/central-code.mjs`
`show` / `audit` display the tier (`default (implicit)` for a record without one; an unknown tier name
is flagged as a warning — it still works, as `default`). **No mint flag, no tier-change command** —
minted records simply have no `tier` field, which IS `default`. Deferred per §2.7.

### 4.3 Out of scope, stated to prevent drift
No pricing, no commercial names, no per-tier UI, no billing hooks, no tier upsell copy, no Paddle, and —
per R-40 — no second tier row and no tier-management CLI. The only consumers of `tier` in v281 are the
Worker's quota resolution and `central-code.mjs`'s display.

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
the **stream gate** (§6). Gate-passed sentences go straight into the synthesis pipeline — now the
**streaming synthesizer** (§5.3) behind the same seam, under the **speaker-generation token**
(`vcSpeakGen`), so barge-in/stop semantics are exactly Voice Wave 0's. First sound ≈
first-sentence-close (1.24 s) + first audio frame (~1.1 s, R-39) ≈ **2.3 s expected**; the acceptance
bar is **≤ 3.0 s** (G1/DoD-D1). When the stream completes, `vcGuardSpoken` runs on the **whole
answer** (§6) and the remainder (guarded text minus the already-spoken prefix) is spoken through the
same pipeline; `vcLastQA` is set to the full guarded string (transcript rule, §6).

BYOK and managed both take this path (G5). Non-voice ask surfaces are untouched.

### 5.3 Streaming TTS synthesis (R-39) — `gemSpeakStream`
Measured 31.7 (`scratchpad/phonikud/tts-stream-probe.mjs`): `streamGenerateContent` with
`responseModalities:['AUDIO']` on `gemini-3.1-flash-tts-preview` — **185 frames, first audio frame at
1,101 ms, 4.36 s total for 7.4 s of audio**, vs **7,643 ms before any sound** from today's blocking
call. No new API surface: the same endpoint, the same SSE framing, the same transport builder (§5.1)
and the same Worker route (§2.1) carry it.
- `gemSpeakStream(text, lang, gen)` streams the synthesis: parse SSE frames, base64-decode each
  `inlineData` PCM chunk, convert to an AudioBuffer, and schedule it on the WebAudio clock at a running
  cursor — first chunk = first sound. The generation token (`vcSpeakGen`) is checked per chunk;
  barge-in cancels the fetch and silences the cursor exactly as `gemPlayBuf` does today.
- **The blocking path stays as the fallback**, behind the same seam: a managed 404 (stale Worker), a
  stream error, or a mid-utterance stall (§5.5) falls back to `gemSynthChunk`+`gemPlayBuf` for the
  remaining text. The app never breaks against an undeployed route; a demo degrades, never dies.
- **Safety position:** audio streaming is entirely DOWNSTREAM of the text safety pipeline. Only
  gate-passed (§6.2) or guard-approved (§6.1) text ever reaches `gemSpeakStream`, and `ttsText` remains
  the ONLY transform between guard-approved text and the engine (INV-T) — streaming changes how audio
  *bytes* travel, never what text is synthesized or when the guard runs.

### 5.4 Connection pre-warm (G8) — the first question must not be the slow one
Cold start is exactly when the audience is watching. On voice-UI open (mic surface shown), `vcPrewarm()`
fires once (throttled, ≥5 min between warms): a minimal request to the ACTIVE transport host (managed:
`OPTIONS` to the Worker origin — warms TLS+H2 and the isolate; BYOK: a HEAD/no-op fetch to
`generativelanguage.googleapis.com`) so the demo's first real question pays no TLS/cold-start tax.
Fire-and-forget: a pre-warm failure is silent and costs nothing (it is not a request, carries no
tokens, and is never metered as usage).

### 5.5 Weak network — degraded-but-working (G8)
The room Wi-Fi at a demo is not your desk. Named behaviours, no silent state:
- **Slow first byte:** the UI already shows "…חושב" from ask-time; nothing new owed below 10 s.
- **Mid-utterance stall** (no audio frame for **8 s** while playing): show a visible toast
  ("החיבור איטי — ממשיך…"), keep the stream open up to the 30 s transport timeout; if the stream dies,
  fall back to the blocking synthesizer for the not-yet-spoken remainder (§5.3). Playback resumes at
  the cursor with an audible gap — degraded, working, visible.
- **Total failure:** the existing honest-error path (R-32/R-35): a Hebrew error message, spoken and
  rendered — never silence, never a hang.

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
   engine, for early sentences and the guarded remainder alike — and this holds for the streaming
   synthesizer too: `gemSpeakStream` (§5.3) receives `ttsText` output and streams audio *bytes*; it
   never sees, buffers, or alters unguarded text. The existing INV-T test keeps pinning it; a new test
   drives a streamed answer with numbers end-to-end (names in the plan).

**In one sentence, for the reviewer:** with streamed text arriving in fragments, the guard runs
**exactly once, after `asm.end()` — i.e., after the last delta has been assembled into the complete
answer and before any post-guard text is spoken**; before that moment the only text that may reach the
synthesizer is a fully-closed sentence that passed the digit-free gate, and a guard over half a
sentence is therefore structurally impossible, not merely avoided.

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

## 8 · TTS audio streaming — MEASURED, in scope (R-39)

**Audio streaming works TODAY on the endpoint we already use — measured, not researched.** The owner's
probe (`scratchpad/phonikud/tts-stream-probe.mjs`, 31.7): `streamGenerateContent` with
`responseModalities:['AUDIO']` on `gemini-3.1-flash-tts-preview` returned **185 frames with the first
audio frame at 1,101 ms**, total **4.36 s for 7.4 s of audio** — versus **7,643 ms before any sound**
from today's blocking call. **The separate Interactions API is NOT needed.** The earlier research
framing ("future adoption, different surface") is superseded by this measurement: same endpoint, same
SSE contract, same transport builder, same Worker route.

**Design consequence for v281:** audio streaming is the arc's **first task and headline win** (§5.3).
The Worker's metering is modality-agnostic (§2.1) and covers the audio stream with zero extra
machinery. `gemSynthChunk`+`gemPlayBuf` remain behind the seam as the fallback path only (stale Worker
/ stream failure / stall), not as the primary path.

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
6. **No migration work (R-40):** there are no existing users; backward compatibility and storage
   migration are NOT constraints and no task may be justified by them. The `tier`-absent → `default`
   fallback exists because it is the simplest code, not as a compatibility promise.
7. **Out of scope:** pricing/product tiers/UI/billing (band-H, D8); streaming for non-voice call sites;
   second tier row + tier-management CLI (§2.7 deferrals).

## 10 · DoD — the arc gate (each line checkable with evidence)
1. Worker vitest: admission-before-byte on the streaming route (all refusal paths; zero upstream calls);
   reserve debited before upstream; reconcile-to-actual from streamed `usageMetadata`; fail-closed charge
   when usage is absent (F7); refund on pre-byte upstream failure (F1/F2); disconnect reconcile via
   `waitUntil` (F4); ceiling cut at frame boundary (F6). (The `streaming:false` refusal branch exists in
   code but has no production tier row — asserted honestly as "default tier streams", not via a
   fabricated row.) RED witnessed for each.
2. Worker vitest: tier resolution — no-tier record = `default`; unknown tier name = `default` (no
   crash). (No compatibility pin owed — R-40.)
3. `central-code.mjs`: `show`/`audit` display the tier (implicit `default`, unknown-tier warning).
   (Verified by direct invocation output — pasted.)
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
9. Latency instrument: `window.__vcLat` gains `firstSentence` and `firstAudio`; the D1 measurement
   below is read from these marks, not from ad-hoc stopwatches.
10. Hebrew/visual: any new user-facing string rendered in Hebrew at 390×844, screenshot looked at
    (DoD-8/9); numeric readouts in `dir="ltr"` islands (L13).

**Demo-grade gate (the arc's purpose ruling — these four are release-blocking, same rank as the rest):**
- **D1 — the headline number: first sound ≤ 3.0 s.** Measured on the fixed demo question (D3) via
  `__vcLat` (`firstAudio − ask`), **median of 5 consecutive live runs ≤ 3,000 ms and no run > 5,000 ms**,
  after a pre-warmed voice-UI open (§5.4 — the demo's own condition). Measured basis ≈ 2.3 s (R-39);
  a miss is stated loudly with its per-leg breakdown, never rounded away.
- **D2 — no visible failure on a weak network.** The §5.5 behaviours demonstrated: a throttled-network
  Playwright run (routed slow SSE) shows the stall toast, the blocking-synth fallback, and a completed
  answer — degraded-but-working, never silent-and-broken.
- **D3 — the repeatable demo scenario, verified end-to-end.** Fixed question: **"אני מעשן בריסקט 5 ק"ג
  ב-110 מעלות — איך אדע מתי לעטוף?"**. Fixed expected shape: a Hebrew answer of 1–3 sentences naming
  wrap indicators (bark set / color / stall), any temperature carried per the guard's rules (grounded
  marker or redaction), spoken end-to-end through the streaming pipeline. The suite runs it mocked on
  every run; the release gate runs it LIVE and pastes the transcript + latency marks. Nothing is shown
  to an audience before this scenario passes.
- **D4 — a real device at 390×844**, not only the desktop suite: the demo scenario run once on a real
  phone (or the owner's device), first sound heard, screenshot of the transcript attached and looked at.
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

## 🧑 שלושה פסקי בעלים מאוחרים (31.7.2026, R-39/R-40 + ייעוד הקשת) — המפרט תוקן לפיהם

| # | הפסק | מה השתנה במפרט |
|---|---|---|
| **R-39** | **הזרמת אודיו עובדת כבר היום ב-endpoint הקיים — נמדד**: ‏`streamGenerateContent` עם `responseModalities:['AUDIO']` על `gemini-3.1-flash-tts-preview` — **185 פריימים, פריים ראשון ב-1,101ms**, ‏4.36 שנ' ל-7.4 שנ' אודיו, מול **7,643ms** עד הצליל הראשון בקריאה החוסמת. **ה-Interactions API אינו נדרש.** סקריפט: `scratchpad/phonikud/tts-stream-probe.mjs` | §8 שוכתב סביב העובדה הנמדדת; §5.3 (`gemSpeakStream`) הופך את הזרמת האודיו למשימה הראשונה של הקשת; היעד ב-G1 ירד מ-3.3 שנ' ל-**≤3.0 שנ' (בסיס נמדד ~2.3)** |
| **R-40** | **אין משתמשים קיימים — המוצר בפיתוח** (*"כרגע אין משתמשים קיימים… הכי חשוב לי הביצועים המקסימליים"*): תאימות-לאחור ומיגרציה אינן אילוצים; F5 נשאר לגופו אך אינו חוסם; המדרגים מינימליים; **המדידה ב-Worker נשארת — היא מגינה על המפתח והחשבון של הבעלים** | "Non-constraints" חדש ב-§1; ‏§4 צומצם לשורת `default` בלבד (‏`extended` + CLI — דחייה מתועדת ב-§2.7); אילוץ 6 ב-§9 הוחלף; אין משימת מיגרציה בתוכנית |
| **ייעוד** | **הקשת נועדה להדגמות ושיווק** (*"חשוב בעיקר להדגמות ושיווק"*) — רף איכות, לא הערת שוליים | G8 חדש; ‏§5.4 (pre-warm) + §5.5 (רשת חלשה — degraded-but-working); שער D1–D4 ב-§10: ‏**D1 צליל ראשון ≤3,000ms (חציון 5 ריצות, אף ריצה >5,000ms)**, ‏D2 רשת חלשה, ‏D3 תרחיש-הדגמה קבוע מאומת מקצה-לקצה, ‏D4 מכשיר אמיתי 390×844 |

**נגזרת:** סדר הביצוע החדש — (1) הזרמת אודיו → (2) הזרמת טקסט + מסירת המשפט הראשון → (3) מדידה מינימלית ב-Worker → (4) שלד מדרגים → (5) אימות ברמת הדגמה. התוכנית שוכתבה בהתאם (9 משימות).
