# Voice Wave 0 — design spec (R-27 · R-28 · R-29 · R-31)

**Date:** 2026-07-31 · **Status:** DRAFT — awaiting owner approval (pipeline §2: no code before approval)
**Brief:** `.superpowers/sdd/voice-wave0-brief.md` (owner-approved arc). **Investigation (established facts):**
`docs/analysis/2026-07-31-voice-investigation.md` (commit `8abdda3`). **Research mined:** `docs/research/03-tts.md` (15.7).
**Plan:** `docs/superpowers/plans/2026-07-31-voice-wave0.md`.

---

## 1 · Goals

Close the three proven defects from the owner's live v278 test (R-27) and land the four binding rulings
(R-28 Phonikud · R-29 button removal · R-31 one language source · Google-TTS-only), **without** waiting for
the Phase-12 Voice Module extraction:

| # | Goal | Proven root cause it closes |
|---|---|---|
| G1 | First audible sound ≤ **2s** after the answer text arrives; instant (<300ms, zero-network) acknowledgement on ask | 3–4 serialized round-trips; ack is itself a cloud TTS call (`vcAskFlow` app.js:6939 → `gemSpeak`) |
| G2 | Texts of ANY length are spoken to the end | 20s TTS timeout (app.js:6477), no `maxOutputTokens` on TTS gen, single unchunked `SpeechSynthesisUtterance` (~15s Chrome cutoff) — effective silent cap ≈250–350 Hebrew chars |
| G3 | No silent failure: every TTS failure path surfaces a toast the user can act on | timeout/no-audio fall silently to `sysSpeak` — the error-toast map (app.js:6509-6513) covers only `api-*` |
| G4 | The ack can never kill the answer (and vice versa) | two in-flight `gemSpeak`s each call `gemStop()` after their await (race, app.js:6485) |
| G5 | The voice speaks **the app's current language** (R-31), the HE/EN button pairs are **removed** (R-29), stored `mk-vclang`/`mk-vcanslang` migrate cleanly | two stores with a hidden coupling: `vcAnsLang()→vcLang()` fallback decouples permanently after first press (app.js:6432-6433); values survive UI-language switches; keyless-EN silently reads Hebrew |
| G6 | A Phonikud-shaped Hebrew-diacritization seam, integrated **safely** (post-guard, fail-closed invariant INV-P), plus a **measurable trial** that answers the make-or-break question before any backend is committed | R-28: niqqud-less text forces the engine to guess vowels (03-tts.md §"Why Hebrew TTS is hard") |
| G7 | Latency becomes a **measured number**, not a feeling: instrumentation + a before/after table | today only code-arithmetic (~6–15s to first sound) exists |

### Non-goals (explicit out-of-scope — Phase 12 keeps them)
- **TTSProvider abstraction** (03-tts.md §Customization) — Phase 12.
- **Local Piper/Israwave engine** (sherpa-onnx WASM, opt-in download) — Phase 12.
- **STT / Hebrew recognition quality (R-30)** — Phase 12, owner ruled less urgent. The mic keeps working
  exactly as today except its recognition locale derives from the single language source (G5).
- **Riders A12 / E13-full / A15 / C10 / R-23** — Phase 12. (G3 pre-empts a *slice* of E13 — TTS errors
  become visible — the full per-language error taxonomy stays in Phase 12.)
- **ElevenLabs / any premium voice tier** — CANCELLED by owner ruling ("לא כלכלי"). Google TTS is the only engine.
- **Phase-3 module extraction** — this wave deliberately edits the four live functions in place
  (`vcAskFlow`/`vcSpeak`/`gemSpeak`/`vcSpeakContent` + helpers); no file split.

---

## 2 · The chunked synthesis pipeline (G1 + G2 + G4)

### 2.1 Chunk boundaries — one rule for all 7 languages
One pure function `vcChunkText(text) → string[]`, applied AFTER `speechText()` normalization
(which already folds `·`/`/`/parentheses into commas for speech):

- **Primary split:** at sentence-ending punctuation `.` `!` `?` `…` **followed by whitespace** (regex
  lookbehind `(?<=[.!?…])\s+`). Because whitespace is required after the terminator, a decimal point
  (`63.5°C`) or an abbreviation glued to a digit can never split a number. Hebrew, English, French,
  German, Spanish, Italian and Russian — the 7 live languages (`lang/he|en|fr|de|es|it|ru`) — all use
  these Western terminators; no per-language boundary table is needed. (French's thin space before `!`/`?`
  is upstream of the terminator and harmless.)
- **Merge-short:** adjacent chunks shorter than **25 chars** merge forward (a one-word "Yes." never costs
  its own round-trip), never exceeding the max.
- **Hard-split-long:** a single sentence longer than **220 chars** splits at the last comma before the
  limit, else the last space — so no single TTS request can approach the 20s timeout or the model-side
  truncation, and no single utterance can approach Chrome's ~15s Web-Speech cutoff. (220 chars ≈ 12–15s
  of Hebrew speech — comfortably inside every platform limit the investigation measured.)
- Emoji/HTML are already stripped by `stripEmoji` inside `speechText` — the chunker sees clean prose.

### 2.2 Queueing — synthesize-ahead, play-in-order
`gemSpeakChunked(text, lang, gen)`:
1. Chunk. Fire synthesis of **chunk 1** immediately.
2. When chunk *i*'s buffer resolves: start playing it, and **prefetch chunk *i+1*** while it plays
   (lookahead = 1 — bounds cost and keeps requests ordered; a 3-chunk answer costs the same 3 TTS calls
   as today's single blocking call costs 1, but the first sound arrives after ~1 short synthesis instead
   of after the whole answer).
3. Per-chunk cache in the existing `gemCache` (chunk-level keys make repeat reads and the ack warm).
   Cache eviction stays as today (clear above 40 entries).
4. Each TTS request keeps `timeout:20000` (now safe — chunks are short) and adds
   `maxOutputTokens: 8192` to the TTS `generationConfig` (owner policy: 8192 everywhere, never a low cap
   — closes the model-side truncation leg).

### 2.3 The speaker generation token (G4 — kills the race)
A monotonic module counter `vcSpeakGen`. Every speak flow takes `gen = ++vcSpeakGen` at start; **after
every await** it checks `gen === vcSpeakGen` and silently stops if stale. `gemStop()` is only ever called
by a *newer* generation taking the floor. The v278 race — a late ack's `gemStop()` after its await killing
the already-playing answer — becomes structurally impossible: the ack's generation is stale the moment the
answer flow starts, so the ack self-silences instead of killing its successor.

### 2.4 Failure mid-stream (G3)
If chunk *k* fails (timeout / `no-audio` / network / `api-*`):
- The cloud pipeline for this utterance stops (no further Gemini calls for it).
- A **toast** appears, mapped per cause (see §4) — never silence.
- Playback **continues from chunk *k*** on the system voice via `sysSpeakChunked` (one utterance per
  chunk, chained on `onend`/`onerror`, same generation token) — the user hears the rest, on a lesser
  voice, and *knows why*.
- `sysSpeak` itself is re-built on the same chunk array — the single-utterance ~15s cutoff leg dies too.

## 3 · The instant acknowledgement (G1)
- The ack phrase per language is a **fixed dictionary constant** (7 entries), not model output.
- **Panel-open pre-warm:** opening Voice Cook fires a background, non-blocking synthesis of the ack
  phrase into `gemCache` (one small TTS call, amortized over the whole session).
- **At ask time:** cache hit → play the cached buffer (zero network, same premium voice). Cache miss
  (cold panel, no key, warm-up still in flight) → speak it via the local system voice — instant by
  construction. **The ack is never awaited network-first.**
- The ack uses the generation token like any speaker (§2.3), so it can neither kill nor outlive the answer.

## 4 · Visible errors (G3)
Every failure path in the voice area surfaces a toast; the mapping extends the existing `api-*` map:

| Cause | Today | Wave 0 |
|---|---|---|
| `api-429/403/404/4xx` | toast ✅ (app.js:6509-6513) | unchanged |
| TTS `timeout` | **silent** fallback | toast: "ההקראה בענן איטית — עוברים לקול המערכת" (+EN/dict) |
| `no-audio` (model returned no inline data) | **silent** throw→fallback | toast: "שגיאת הקראה — עוברים לקול המערכת" |
| network / fetch reject | **silent** | toast: "אין רשת להקראה בענן — קול המערכת" |
| Web-Speech unavailable | toast ✅ | unchanged |

All new strings go through `L()`/the dictionary pipeline and are verified **in the rendered DOM** per
language (v267 lesson: never a proxy metric). Numeric readouts inside toasts get `dir="ltr"` islands (L13).

## 5 · One language source; the buttons go (G5 · R-31 · R-29)

### 5.1 Single derivation
`vcVoiceLang() → getLang()` — the UI language, clamped to the 7 live languages (unknown → 'he', the
dictionary base). From it derive, with no second store:
- **Answer language** (prompt building — `vcBuildAskPrompt` gains the 5 new languages' system prompts,
  or, minimal-correct: for non-he/en it instructs "reply in <language> only" via one parameterized line),
- **TTS behavior** (`speechText`: Hebrew normalization for he, generic strip for the rest),
- **Recognition locale** (`vcLocale`: he-IL, en-US, fr-FR, de-DE, es-ES, it-IT, ru-RU),
- **Guard marker language**: `vcGuardSpoken(…, vcVoiceLang())` — 'he' keeps the Hebrew marker strings;
  every other language gets the marker/redaction strings through the `L()` dictionary (they are spoken,
  user-facing strings; DoD-9 applies to all 7).

### 5.2 Buttons removed + upgrade path for stored state
- The two button pairs (`data-vc="lang-*"`/`"anslang-*"`, app.js:6561-6568) and their `vcAction` branches
  are deleted; `vcLang()`/`vcAnsLang()` are replaced by `vcVoiceLang()` at every call site.
- **Migration (no stranded users):** on the first `vcRender` of the new version,
  `store.set('mk-vclang', null); store.set('mk-vcanslang', null)` — the keys are deleted, not re-read.
  A user who had decoupled the pair (the permanent-decouple bug) is healed automatically: there is no
  stored voice-language state left to be stranded in; the voice follows the visible UI language, which
  the user already knows how to change (the existing language switcher).
- **Keyless behavior becomes honest:** content is built in the UI language (the dictionary), so the
  keyless "English chosen but Hebrew spoken" contradiction disappears structurally — there is no separate
  "English chosen" anymore. The `vcTranslateToEn` leg leaves the content path entirely (one fewer network
  round-trip in the old EN flow). The pure `vcTransSafe`/`vcNumPairs` functions **stay** (tested, and any
  future translation surface must reuse them); only the call path is removed.
- A panel hint line states the rule once: "הקול מדבר בשפת האפליקציה" (+6 translations) — the R-31 ruling,
  visible where the buttons used to be.

## 6 · Phonikud (G6 · R-28) — research findings, integration, and the safety invariant

### 6.1 What Phonikud actually is (researched 2026-07-31; each claim cited)
- **What it is/outputs:** an open-source Hebrew grapheme-to-phoneme system. It **adds diacritics
  (niqqud) plus phonetic marks** (stress, vocal shva, clitic boundaries) to plain Hebrew text, then
  deterministic rules convert that to **IPA phonemes** ("שלום עולם" → "ʃalˈom olˈam"). Both intermediate
  outputs are available: *diacritized text* and *IPA*.
  Sources: https://github.com/thewh1teagle/phonikud (fetched 2026-07-31); paper arXiv:2506.12311
  ("outputs fully-specified IPA transcriptions … augmenting a base diacritizer", fetched 2026-07-31).
- **Distribution/size:** Python packages `phonikud` + `phonikud-onnx` with an ONNX model. Measured on
  Hugging Face 2026-07-31: `thewh1teagle/phonikud-onnx/phonikud-1.0.int8.onnx` = **307,844,158 bytes
  (~308 MB)** (the fp32 twin is listed at the same size — an oddity we could not verify further; the
  order of magnitude is what matters). The base model (`thewh1teagle/phonikud`, `model.safetensors`) is
  **1,223,063,808 bytes (~1.2 GB)** and its `dicta_model.py` shows the base diacritizer is **Dicta's
  BERT-large-scale model** with lightweight adaptors. Licenses: G2P code CC BY 4.0; ONNX repo MIT.
- **Latency:** the paper claims the adaptors add "negligible additional latency" over the base
  diacritizer and that it drives *real-time* TTS on CPU. **Absolute ms-per-sentence figures could not be
  verified** (paper HTML/project page fetches 404'd on 2026-07-31); a BERT-large forward pass per
  sentence is plausibly tens-to-hundreds of ms on desktop CPU — **NOT VERIFIED LOCALLY, never executed
  here.**
- **In-browser?** Technically ONNX models run in-browser via onnxruntime-web/WASM, but **no official
  JS/WASM Phonikud package was found** (search 2026-07-31), and **~308 MB against this app's 1.99 MB
  bundle budget** (and the just-shipped dictionary-split discipline) rules the in-browser path out even
  as an opt-in for Wave 0. The Cloudflare Worker (~10 MB script/asset limits, no custom-ONNX runtime)
  cannot host it either. 03-tts.md's "tens of MB" estimate was for the whole Piper stack and is, for
  Phonikud alone, **wrong by an order of magnitude** — flagged per the stale-claim rule.
- **The make-or-break question — does diacritized Hebrew improve *Google/Gemini* TTS?**
  **UNKNOWN — no evidence either way was found.** Phonikud's *designed* consumer is a phoneme-input
  local TTS (Piper/Israwave — "small, local TTS models with phonetic input from Phonikud approach large
  proprietary systems", arXiv:2506.12311); pairing its *diacritized-text* intermediate with a cloud
  engine that expects plain undiacritized Hebrew is undocumented. Hebrew is not even on Gemini TTS's
  officially supported 24-language list (https://discuss.google.dev/t/hebrew-text-to-speech-using-gemini/192380,
  fetched 2026-07-31; Gemini 3.1 Flash TTS advertises "70+ languages" —
  https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/) — the
  engine speaks Hebrew in practice (v278 does), but whether niqqud input helps, does nothing, or *hurts*
  (tokenizer confusion) is an empirical question. **Per the brief, we therefore design a measurable
  trial (§6.4) rather than assume success.**

### 6.2 Wave-0 integration: a seam, not a bundled model
Wave 0 ships `vcHeDiacritize(chunk)` — an async, **Hebrew-only** (ruling 5), per-chunk hook in the
synthesis pipeline, with a pluggable backend (`vcDiacritizeBackend`, default **none** = identity).
The backend decision (Dicta-hosted API / self-hosted Phonikud service / any other) is taken by the owner
**after** the §6.4 trial reports; no backend network dependency ships in Wave 0 itself. This honors R-28's
direction (the seam is Phonikud-shaped: text-in → marked-text-out) while refusing to bet the wave on an
unverified pronunciation gain or a 308 MB dependency.

### 6.3 The safety invariant — INV-P (the question that gates everything)
**Can diacritization alter the numbers/units the v278 spoken-safety guard inspects?** As a neural
rewriter, in principle **yes** — a model may normalize digits, expand numerals to words, or drop
characters. The design makes this *structurally impossible* to reach speech, twice over:

> **INV-P (placement):** diacritization runs **strictly after `vcGuardSpoken`** has produced its final
> string, and only on the per-chunk text handed to TTS synthesis. The guard, the transcript
> (`vcLastQA`), and every regex that inspects safety text see **only undiacritized text** — the guard's
> number/unit/marker semantics (R-2/R-3, NFKC, Unicode degree variants, "פרנהייט") are untouched by
> construction, because the transform happens downstream of every inspection.
>
> **INV-P (acceptance, fail-closed):** a diacritized chunk `d` for input `s` is used **only if**
> `stripMarks(d) === stripMarks(s)` character-for-character, where `stripMarks` removes exactly the
> Hebrew combining-mark range U+0591–U+05C7 (cantillation + niqqud + meteg — everything a diacritizer
> may legitimately add). Any other change — a digit, a unit, a Latin letter, word order, added or
> dropped text — fails the check and the **original guarded chunk** is synthesized instead. A backend
> that rewrites `63` into `שישים ושלוש`, or `°C` into anything, is silently discarded, per chunk.

**The test that proves it** (named for the phase gate): `tests/voice-wave0.spec.ts` →
`'INV-P: a diacritization backend may only add Hebrew marks — any other change is discarded'` — drives a
guarded answer through a *malicious mock backend* (changes a number / a unit / drops a word) and asserts
the synthesized text (observed at the TTS seam) equals the guarded original; plus the positive case (a
well-behaved mock adding only marks is accepted) and the regression case (guard output and transcript are
byte-identical with the seam enabled vs. disabled). The existing `p0-spoken-safety` suite must stay green
unchanged — it is the DoD-10 witness.

### 6.4 The measurable trial (decides the backend question)
- **Bench:** `docs/research/voice-wave0-niqqud-bench.md` — 12 fixed Hebrew sentences (domain terms:
  מעשנה/פרנהייט/ברסקט; safety numbers; ranges; a decimal), each in two forms: plain and
  **hand-diacritized** (golden niqqud written by us — deliberately decoupling "does niqqud help Gemini
  TTS?" from "can we run Phonikud?"; no model needed to answer the make-or-break question).
- **Runner:** a dev-only console function `vcNiqqudTrial()` synthesizes each pair through the real
  chunk pipeline, records per-form latency + success/`no-audio`/error, and plays them A/B.
- **Protocol:** the owner listens blind (order randomized), scores each pair (A better / B better /
  same); results + latency table land in `docs/research/voice-wave0-niqqud-trial-results.md`.
- **Decision gate (owner):** niqqud clearly better → pick a backend for the seam (follow-up task, with
  INV-P already in force); no better / worse / errors on niqqud input → R-28 is answered with evidence,
  Phonikud's home moves to its designed Phase-12 role (phoneme input to the local Piper engine), and the
  seam stays dormant at zero cost. **Either way R-29/R-31 stand — the buttons are gone regardless**
  (owner ruling: they lose their purpose under R-31 independent of pronunciation).

## 7 · Latency instrumentation (G7)
- `vcLatMark(k)` timestamps (performance.now) at: `ask` (question submitted), `ackSound`, `textReq`,
  `textResp`, `ttsReq1`, `firstSound`, `done`; exposed as `window.__vcLat` (dev/test surface, no UI, no
  persistence — same discipline as `GEM_USAGE`).
- `gemNoteUsage` gains per-call wall-clock ms (request → response) so every AI call carries latency
  next to its token counts.
- **Targets (the DoD numbers):** ack sound < **300 ms** from tap (zero-network path) · first answer
  audio ≤ **2.0 s** after `textResp` · question → first spoken answer ≤ **4 s** p50 on a live key
  (measured, not estimated; today's code-arithmetic estimate is ~6–15 s).
- **Baseline first:** instrumentation lands and the *current* pipeline is measured before any pipeline
  change (Plan Task 1), so the improvement is a before/after table, not a feeling.

## 8 · DoD — the phase-gate checklist (each line checkable with evidence)
1. `vcChunkText` unit-tested: decimal numbers never split; merge/hard-split rules; fixtures in all 7 languages. (G2)
2. A 1,000+ char answer is spoken to the end (mocked TTS seam counts chunks; sys-fallback chained). RED first. (G2)
3. Race test: ack + answer in flight → answer plays, ack self-silences; regression red-green on the token. (G4)
4. Every failure row of §4's table produces its toast (tests enumerate timeout/no-audio/network); zero silent paths. (G3)
5. Ack: zero network requests on the cold path (asserted via route interception); warm path plays from cache. (G1)
6. Buttons gone; `mk-vclang`/`mk-vcanslang` seeded via `seedApp` are deleted after first render; voice follows `getLang()` in all 7 languages. (G5)
7. Guard: `p0-spoken-safety` suite green **unchanged**; marker strings render/speak in all 7 languages (DoD-9 screenshots at 390×844). (DoD-10)
8. INV-P test (named §6.3) green; malicious-backend case fails closed. (G6)
9. Trial harness runs against a live key; bench + results docs exist; owner decision recorded. (G6)
10. `window.__vcLat` populated end-to-end; before/after latency table in the wave-close report; targets §7 met or the miss stated loudly. (G7)
11. Safety invariance: no `bcheck`/`temp`/`safe`/duration value touched anywhere in the wave (diff-audited; DoD-10).
12. Full suite `npx playwright test` green ×2 (release H7), no `--retries`/`--workers`, serialized per §11a.

## 9 · Open questions for the owner (before implementation)
1. **Trial timing:** run the §6.4 niqqud trial as Wave-0 Task 9 (recommended — it gates only the backend
   choice, not the wave), or before the wave starts?
2. **Backend candidates** if the trial says "niqqud helps": Dicta's hosted Nakdan API (third-party
   dependency, privacy of spoken text), a self-hosted Phonikud service (~308 MB model, new infra), or
   Gemini-text-as-diacritizer (one extra cheap call per chunk, INV-P makes it safe). Preference?
3. **Non-he/en answer prompts** (§5.1): one parameterized "reply in X only" line (cheap) vs. 5 crafted
   per-language system prompts (better tone)? Wave 0 proposes the parameterized line.
4. **Ack phrasing** per language: fixed proposal in the plan (Task 6) — veto welcome.
