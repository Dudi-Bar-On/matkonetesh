# Voice Wave 0 — design spec (R-27 · R-29 · R-31 · R-32 · R-33 · R-34 · R-35)

**Date:** 2026-07-31 (revised same day after four owner rulings — see §11) · **Status:** DRAFT — awaiting owner approval (pipeline §2: no code before approval)
**Brief:** `.superpowers/sdd/voice-wave0-brief.md` (owner-approved arc). **Investigation (established facts):**
`docs/analysis/2026-07-31-voice-investigation.md` (commit `8abdda3`). **Research mined:** `docs/research/03-tts.md` (15.7).
**Plan:** `docs/superpowers/plans/2026-07-31-voice-wave0.md`.

> **R-28 (Phonikud) is CANCELLED** — owner ruling 2026-07-31 after a blind A/B of 12 sentence pairs
> through the real engine: *"כמעט ואין הבדל, מקרים מעטים וניואנסים קטנים — לא מצדיק את המאמץ."*
> Nothing diacritization-shaped ships in this wave. Traceability: the local feasibility trial is
> `docs/analysis/2026-07-31-phonikud-local-trial.md`; the runtime-diacritization research (kept — it holds
> a ready free solution should the question ever return) is
> `docs/research/2026-07-31-runtime-hebrew-diacritization.md`. The one idea from that work that survives
> is the *guard-protection invariant*: any transform between the spoken-safety guard and the engine must
> be provably unable to alter what the guard inspected — reborn as **INV-T** (§7) for the R-33 text prep.

> **R-35 — product invariant (owner, 31.7): there is NO keyless user.** *"חד משמעית אין משתמש חינם ללא
> מפתח AI, הורדתי את זה כבר מזמן — חבל שלא מתועד בתוכנית."* Every user has either a personal key (BYOK)
> or managed central access; the decision **predates this plan and was never written down** — recorded
> here because the voice path is where its absence did the most damage (the silent `sysSpeak` fallback
> was justified as "the keyless experience" of a user who does not exist). Consequences for this wave:
> no "user without an AI key" behaviour is designed anywhere in this spec, and deleting the browser
> voice (R-32) is a downgrade for **no one**. **Scope boundary:** `app.js` carries **28 `!aiAvail()`
> branches** that encode the keyless state; exactly **two** are speech-related and are handled in this
> wave (the `sysSpeak` fallback at ~app.js:6516 and the "English with no key reads Hebrew anyway" leg at
> ~app.js:6652). The remaining 26 are deliberately **left for a Phase 9 review under R-35** — do not
> assume the sweep was done here.

---

## 1 · Goals

Close the three proven defects from the owner's live v278 test (R-27) and land the four binding rulings
of 31.7 (R-31 one language source · R-29 button removal · R-32 Google-only speech · R-33 raw text to
Gemini · R-34 the 8192 policy), **without** waiting for the Phase-12 Voice Module extraction:

| # | Goal | Proven root cause it closes |
|---|---|---|
| G1 | First audible sound ≤ **2s** after the answer text arrives; instant (<300ms, zero-network) acknowledgement on ask | 3–4 serialized round-trips; ack is itself a cloud TTS call (`vcAskFlow` app.js:6939 → `gemSpeak`) |
| G2 | Texts of ANY length are spoken to the end — on the Google voice | 20s TTS timeout (app.js:6477) on one monolithic request + no `maxOutputTokens` on the TTS gen (R-34) → model-side truncation → `no-audio` |
| G3 | No silent failure and no silent downgrade: every TTS failure surfaces a visible, actionable error | today every failure falls silently to `sysSpeak` — which is why the owner "hears the browser default most of the time" (R-32) |
| G4 | The ack can never kill the answer (and vice versa) | two in-flight `gemSpeak`s each call `gemStop()` after their await (race, app.js:6485) |
| G5 | The voice speaks **the app's current language** (R-31), the HE/EN button pairs are **removed** (R-29), stored `mk-vclang`/`mk-vcanslang` migrate cleanly | two stores with a hidden coupling: `vcAnsLang()→vcLang()` fallback decouples permanently after first press (app.js:6432-6433); values survive UI-language switches; keyless-EN silently reads Hebrew |
| G6 | **Speech is Google-only** (R-32): the browser-voice path (`sysSpeak`, `vcPickVoice`, `#vcVoiceSel`, `mk-vcvoice`, `onvoiceschanged`) is deleted, not bypassed | owner: "רוצה לבטל את זה לחלוטין, אך ורק דרך גוגל" — the silent fallback IS the bug he hears |
| G7 | **Gemini receives clean text** (R-33): the browser-era rewriting in `hebSpeechText` is decided transform-by-transform (§7); the surviving prep provably cannot alter a digit or unit the safety guard inspected (**INV-T**) | measured A/B 31.7: raw text markedly more natural on the same model+voice; injected commas chop delivery (`מתייצב , כ-70 מעלות פנימי,.`) |
| G8 | Latency becomes a **measured number**, not a feeling: instrumentation + a before/after table | today only code-arithmetic (~6–15s to first sound) exists |

### Non-goals (explicit out-of-scope — Phase 12 keeps them)
- **TTSProvider abstraction** (03-tts.md §Customization) — Phase 12.
- **Local Piper/Israwave engine** (sherpa-onnx WASM, opt-in download) — Phase 12. (With R-28 cancelled,
  Phonikud's only remaining home is its *designed* role there: phoneme input to a local engine — if ever.)
- **STT / Hebrew recognition quality (R-30)** — Phase 12, owner ruled less urgent. The mic keeps working
  exactly as today except its recognition locale derives from the single language source (G5). R-32 is a
  ruling about *speaking*; browser `SpeechRecognition` for listening is unaffected (assumption stated in §10).
- **Riders A12 / E13-full / A15 / C10 / R-23** — Phase 12. (G3 pre-empts a *slice* of E13 — TTS errors
  become visible — the full per-language error taxonomy stays in Phase 12.)
- **ElevenLabs / any premium voice tier** — CANCELLED by owner ruling ("לא כלכלי"). Google TTS is the only engine.
- **Any diacritization/niqqud machinery** — CANCELLED (R-28, see header note).
- **Phase-3 module extraction** — this wave deliberately edits the live functions in place
  (`vcAskFlow`/`vcSpeak`/`gemSpeak`/`vcSpeakContent` + helpers); no file split.

---

## 2 · The chunked synthesis pipeline (G1 + G2 + G4)

**Re-examined under R-32:** the original G2 evidence included Chrome's ~15s single-utterance cutoff —
that was the BROWSER engine's limit and dies with it. Chunking survives on its own merits, which are
independent of the browser voice: (a) G1 — first sound after ONE short synthesis instead of after the
whole answer; (b) each request stays comfortably inside the 20s fetch timeout; (c) each request stays far
from any model-side output limit even with R-34's 8192 cap as a backstop; (d) a mid-answer failure loses
one chunk's audio, not the whole answer's.

### 2.1 Chunk boundaries — one rule for all 7 languages
One pure function `vcChunkText(text) → string[]`, applied AFTER `ttsText()` (§7) sanitation:

- **Primary split:** at sentence-ending punctuation `.` `!` `?` `…` **followed by whitespace** (regex
  lookbehind `(?<=[.!?…])\s+`). Because whitespace is required after the terminator, a decimal point
  (`63.5°C`) or an abbreviation glued to a digit can never split a number. Hebrew, English, French,
  German, Spanish, Italian and Russian — the 7 live languages — all use these Western terminators; no
  per-language boundary table is needed.
- **Merge-short:** adjacent chunks shorter than **25 chars** merge forward (a one-word "Yes." never costs
  its own round-trip), never exceeding the max.
- **Hard-split-long:** a single sentence longer than **220 chars** splits at the last comma before the
  limit, else the last space — so no single TTS request can approach the 20s timeout or any model-side
  limit. (220 chars ≈ 12–15s of Hebrew speech.)
- Emoji/HTML are already stripped by `ttsText` — the chunker sees clean prose.

### 2.2 Queueing — synthesize-ahead, play-in-order
`gemSpeak(text, lang, gen)` (rebuilt):
1. Chunk. Fire synthesis of **chunk 1** immediately.
2. When chunk *i*'s buffer resolves: start playing it, and **prefetch chunk *i+1*** while it plays
   (lookahead = 1 — bounds cost and keeps requests ordered; a 3-chunk answer costs the same 3 TTS calls
   as today's single blocking call costs 1, but the first sound arrives after ~1 short synthesis instead
   of after the whole answer).
3. Per-chunk cache in the existing `gemCache` (chunk-level keys make repeat reads and the ack warm).
   Cache eviction stays as today (clear above 40 entries).
4. Each TTS request keeps `timeout:20000` (now safe — chunks are short) and the TTS `generationConfig`
   carries `maxOutputTokens: 8192` (**R-34** — owner standing policy: 8192 everywhere, never a low cap;
   closes the model-side truncation leg that today throws `no-audio`).

### 2.3 The speaker generation token (G4 — kills the race)
A monotonic module counter `vcSpeakGen`. Every speak flow takes `gen = ++vcSpeakGen` at start; **after
every await** it checks `gen === vcSpeakGen` and silently stops if stale. `gemStop()` is only ever called
by a *newer* generation taking the floor. The v278 race — a late ack's `gemStop()` after its await killing
the already-playing answer — becomes structurally impossible.

### 2.4 Failure mid-stream (G3 · R-32 — no downgrade, ever)
If chunk *k* fails (timeout / `no-audio` / network / `api-*`):
- The pipeline for this utterance **stops** (no further Gemini calls for it). There is no fallback voice —
  R-32 deleted it. Speech ends; the answer text remains readable on screen (`vcLastQA` renders it).
- A **toast** appears, mapped per cause (§4) — visible and actionable, never silence, never a downgrade.
- The user's recovery is one tap: the read-aloud buttons still work (a retry hits the per-chunk cache for
  every chunk already synthesized, so a retry resumes cheaply and fast).

## 3 · The instant acknowledgement (G1)
- The ack phrase per language is a **fixed dictionary constant** (7 entries), not model output.
- **Panel-open pre-warm:** opening Voice Cook fires a background, non-blocking synthesis of the ack
  phrase into `gemCache` (one small TTS call, amortized over the whole session). This makes the spoken
  ack the *common* case.
- **At ask time:** cache hit → play the cached buffer (zero network, the real Google voice). Cache miss
  (cold panel, warm-up still in flight or failed) → **no browser voice exists to fall back on (R-32)**;
  the ack degrades to an instant *non-speech* acknowledgement: the transcript pane flips to "…חושב"
  immediately (already rendered today) plus a short local **earcon** (a two-tone WebAudio chime, zero
  network, zero engine — a chime is not a browser *voice* and does not violate R-32; owner veto welcome,
  §10 Q1). **The ack is never awaited network-first.**
- The ack uses the generation token like any speaker (§2.3), so it can neither kill nor outlive the answer.

## 4 · Visible errors (G3) — the complete failure map
Every failure path in the voice area surfaces a toast; the mapping extends the existing `api-*` map.
**The "→ system voice" suffix is gone from every message — there is no system voice.**

| Cause | Today | Wave 0 |
|---|---|---|
| `api-429/403/404/4xx` | toast ✅ (app.js:6509-6513) then silent downgrade | same toast, **no downgrade** — speech stops, text stays on screen |
| TTS `timeout` | **silent** fallback to browser voice | toast: "ההקראה בענן איטית מדי כרגע — נסה שוב" (+6 translations) |
| `no-audio` (model returned no inline data) | **silent** throw→fallback | toast: "שגיאת הקראה — נסה שוב" (+6). R-34's 8192 cap removes the main *cause*; the message covers the residue |
| network / fetch reject | **silent** | toast: "אין רשת להקראה" (+6) |
| `!aiAvail()` | silent browser voice (the R-32 complaint) | **cannot occur for a real user (R-35 invariant)** — the branch becomes a defensive no-op, not a designed experience |

All new strings go through `L()`/the dictionary pipeline and are verified **in the rendered DOM** per
language (v267 lesson: never a proxy metric). Numeric readouts inside toasts get `dir="ltr"` islands (L13).

## 5 · One language source; the buttons go (G5 · R-31 · R-29)

### 5.1 Single derivation
`vcVoiceLang() → getLang()` — the UI language, clamped to the 7 live languages (unknown → 'he', the
dictionary base). From it derive, with no second store:
- **Answer language** (prompt building — for non-he/en, one parameterized "reply in <language> only"
  line in `vcBuildAskPrompt`; §10 Q3),
- **TTS text prep** (`ttsText`: Hebrew abbreviation expansion for he only, generic sanitation for all — §7),
- **Recognition locale** (`vcLocale`: he-IL, en-US, fr-FR, de-DE, es-ES, it-IT, ru-RU),
- **Guard marker language**: `vcGuardSpoken(…, vcVoiceLang())` — 'he' keeps the Hebrew marker strings;
  every other language gets the marker/redaction strings through the `L()` dictionary (they are spoken,
  user-facing strings; DoD-9 applies to all 7).

### 5.2 Buttons removed + upgrade path for stored state
- The two button pairs (`data-vc="lang-*"`/`"anslang-*"`, app.js:6561-6568) and their `vcAction` branches
  are deleted; `vcLang()`/`vcAnsLang()` are replaced by `vcVoiceLang()` at every call site.
- **Migration (no stranded users):** on the first `vcRender` of the new version,
  `store.set('mk-vclang', null); store.set('mk-vcanslang', null)` — the keys are deleted, not re-read.
  A user who had decoupled the pair (the permanent-decouple bug) is healed automatically: the voice
  follows the visible UI language, which the user already knows how to change.
- **The "English with no key reads Hebrew anyway" contradiction dies structurally** (one of R-35's two
  speech-scoped `!aiAvail()` branches, ~app.js:6652): content is built in the UI language — there is no
  separate "English chosen" state and no keyless user to hit the leg. The `vcTranslateToEn` leg leaves
  the content path entirely. The pure `vcTransSafe`/`vcNumPairs` functions **stay** (tested; any future
  translation surface must reuse them); only the call path is removed.
- A panel hint line states the rule once: "הקול מדבר בשפת האפליקציה" (+6 translations) — the R-31 ruling,
  visible where the buttons used to be.

## 6 · Google-only speech (G6 · R-32 · R-35)

### 6.1 What is deleted (dead code inventory — nothing routed-around, everything removed)
The owner has been hearing the browser default because `vcSpeak` falls back to `sysSpeak` on ANY Gemini
failure. Under R-35 the deletion is a downgrade for no one — no real user is keyless, so nobody's only
voice is the browser voice. The entire browser-voice speaking path goes:

| Item | Where | Why it is dead |
|---|---|---|
| `sysSpeak()` | app.js:6492-6501 | the fallback itself |
| `vcPickVoice()` + `vcVoices` | app.js:6437-6447, 6412 | only chose browser voices |
| `#vcVoiceSel` picker row + change handler | app.js:6578, 6590 | UI for choosing a browser voice |
| `mk-vcvoice` storage (+ its entry in the store-listing exclusions, app.js:7814) | app.js:6442, 6590 | persisted the browser-voice choice |
| `speechSynthesis.onvoiceschanged` wiring | app.js:6448 | repopulated the dead picker |
| `speechSynthesis.cancel()` calls in `vcSpeak` | app.js:6504 | nothing to cancel |
| `hebSpeechText`/`enSpeechText`/`speechText` in their current form | app.js:6416-6436 | written FOR the browser engine (R-33); replaced by `ttsText` (§7) |
| Toast suffixes "עובר לקול המערכת" and the `gemoff` toast "חוזרים לקול המערכת" (app.js:6625) | §4 map | no system voice to switch to |

**Tests that reference the dead path:** `tests/p0-tts-routing.spec.ts` stubs `window.sysSpeak` and its
"E7 negative case" asserts that a keyless user *falls to the system voice* — an assertion that now pins
both the bug R-32 abolishes and a product state R-35 says does not exist. The test is **rewritten** (not
deleted): with `!aiAvail()` (an invariant-violating state, kept only as a defensive probe) → zero TTS
network calls, zero speech, no crash. The E7 managed/BYOK routing tests stay valid as-is.
`tests/ai-model-registry.spec.ts` gemTtsGen test gains the `maxOutputTokens` assertion (R-34).
NOTE: `speechSynthesis`/`SpeechRecognition` for the **mic** (listening) are NOT part of this deletion.

### 6.2 The `!aiAvail()` branch — a defensive no-op, not a designed experience (R-35)
There is no keyless user (R-35 invariant, header note). `vcSpeak`'s keyless branch therefore stops being
a product path: `if(!aiAvail()) return;` — no speech, no throw, no copy, no UI designed for it. No
banner, no disabled-voice experience, no connect-route toast: designing those would re-document the
product state the owner removed long ago. The other 26 `!aiAvail()` branches across `app.js` are out of
this wave's scope — Phase 9 reviews them under R-35.

### 6.3 A genuine Gemini failure — visible and actionable (the only remaining question)
§2.4 + §4: the pipeline stops, a per-cause toast names the reason, the answer text is on screen, and a
retry (same button) reuses every cached chunk. No auto-retry loop in Wave 0 (kept simple; revisit only on
evidence).

## 7 · Clean text to Gemini (G7 · R-33) — transform-by-transform ruling

**The measured fact:** `hebSpeechText` was written for the browser engine. An A/B on the same model and
voice (evidence: scratchpad `phonikud/preproc-audio` + `preproc-ab.mjs`, 31.7) showed the RAW text sounds
markedly more natural; the injected commas chop delivery (observed: `מתייצב , כ-70 מעלות פנימי,.`).
Blanket deletion is wrong too — some transforms fix genuine ambiguity a speech model cannot resolve.
Each transform, decided individually:

| # | Transform (today) | Decision | Reason |
|---|---|---|---|
| 1 | `stripEmoji` (emoji + HTML strip, whitespace collapse) | **KEEP** (all languages) | sanitation, not prose rewriting — HTML/emoji must never reach any engine |
| 2 | `·`/`•` → ", " | **KEEP** (all languages) | the app's compact strings use `·` as a list separator with no spoken form in any engine; leaving it risks "נקודה אמצעית"/skip-glue. This is separator *normalization*, not the comma-injection the A/B condemned |
| 3 | `ק"ג` → "קילו" | **KEEP** (he only) | gershayim abbreviation — a speech model may spell it letter-by-letter; expansion to the same canonical unit word |
| 4 | `דק'`/`דק` → "דקות" | **KEEP** (he only) | same — single-token abbreviation, genuinely ambiguous |
| 5 | `N ש` → "N שעות" | **KEEP** (he only) | a bare `ש` after a number is unreadable by any engine |
| 6 | `כפ'` → "כפות" | **KEEP** (he only) | same abbreviation class |
| 7 | `MR`/`mw` → "מדיום רייר"/"מדיום ול" | **KEEP** (he only) | Latin doneness codes inside Hebrew prose — the model would spell "M-R" |
| 8 | `63°C` → "63 מעלות" | **DROP** | *drops the unit symbol* — loses the C/F distinction the guard cares about; the A/B showed the model reads `63°C` naturally |
| 9 | `(…)` → ", … ," | **DROP** | THE measured harm — the comma injection that chops delivery; the model phrases parentheticals natively |
| 10 | `8-10` → "8 עד 10" | **DROP** | the model reads ranges natively; browser-era punctuation rewriting between digits — exactly the class R-33 bans |
| 11 | `~` → "בערך " | **DROP** | browser-era; the model handles approximation context; text insertion next to numbers is the risky class |
| 12 | `/` → " או " + `שעה/שעתיים` special case | **DROP** | the model reads slashes contextually; browser-era wording injection |

**Implementation shape:** `hebSpeechText`/`enSpeechText`/`speechText` are replaced by one lean
`ttsText(t, lang)` — rows 1–2 for every language, rows 3–7 (a fixed Hebrew abbreviation whitelist) only
when `lang==='he'`. It is the ONLY transform between `vcGuardSpoken`'s output and the engine.

**INV-T — the safety invariant (INV-P's survivor, protecting the guard from ANY text transform):**

> Whatever runs between the spoken-safety guard and the TTS engine must not alter any **digit** or any
> **unit token** the guard inspected: every digit sequence in the guarded string appears unchanged, in
> order, in the TTS-bound string; `°C`/`°F`/`°` survive verbatim; unit-word changes are limited to the
> fixed whitelist of rows 3–7, each mapping an abbreviation to its full canonical word — never a value,
> never a conversion, never a reordering.

**The named test (phase-gate):** `tests/voice-wave0.spec.ts` →
`'INV-T / R-33: ttsText preserves every digit and degree token from the guarded string'` — drives guarded
strings (incl. `63.5°C`, `8-10`, parentheses, `ק"ג`) through `ttsText` and asserts (a) the digit-sequence
arrays before/after are identical, (b) `°C` survives verbatim, (c) no commas were added beyond the `·`
folds, (d) each whitelist expansion maps exactly as specified. The existing `p0-spoken-safety` suite is
the DoD-10 witness that guard semantics are untouched.

## 8 · Latency instrumentation (G8)
- `vcLatMark(k)` timestamps (performance.now) at: `ask`, `ackSound`, `textReq`, `textResp`, `ttsReq1`,
  `firstSound`, `done`; exposed as `window.__vcLat` (dev/test surface, no UI, no persistence — same
  discipline as `GEM_USAGE`).
- `gemNoteUsage` gains per-call wall-clock ms so every AI call carries latency next to its token counts.
- **Targets (the DoD numbers):** ack (sound or earcon+render) < **300 ms** from tap (zero-network path) ·
  first answer audio ≤ **2.0 s** after `textResp` · question → first spoken answer ≤ **4 s** p50 on a
  live key (measured, not estimated; today's code-arithmetic estimate is ~6–15 s).
- **Baseline first:** instrumentation lands and the *current* pipeline is measured before any pipeline
  change (Plan Task 1), so the improvement is a before/after table, not a feeling.

## 9 · DoD — the phase-gate checklist (each line checkable with evidence)
1. `vcChunkText` unit-tested: decimal numbers never split; merge/hard-split rules; fixtures in all 7 languages. (G2)
2. A 1,000+ char answer is synthesized to the end as ordered chunks (mocked TTS seam counts chunks). RED first. (G2)
3. Race test: ack + answer in flight → answer plays, ack self-silences; regression red-green on the token. (G4)
4. Every failure row of §4's table produces its toast; **zero silent paths and zero downgrade paths** — `sysSpeak` and every §6.1 item verifiably absent from the bundle (grep of `dist/index.html` = 0 hits). (G3·G6)
5. Ack: zero network requests on the cold path (asserted via route interception); warm path plays from cache. (G1)
6. `!aiAvail()` defensive no-op: zero TTS network calls, zero speech, no crash; `p0-tts-routing` rewritten accordingly and green; R-35 recorded in the spec (this document) as the product invariant. (G6·R-35)
7. Buttons gone; `mk-vclang`/`mk-vcanslang` seeded via `seedApp` are deleted after first render; voice follows `getLang()` in all 7 languages. (G5)
8. Guard: `p0-spoken-safety` guard tests green; marker strings render in all 7 languages (DoD-9 screenshots at 390×844). The EN-translation *flow* tests are updated to the R-31 world (the translation leg no longer exists) — pure `vcTransSafe`/`vcNumPairs` tests stay untouched. (DoD-10, stated openly per §11 honesty rule)
9. INV-T test (named §7) green; `gemTtsGen` carries `maxOutputTokens: 8192` with a test. (G7·R-34)
10. `window.__vcLat` populated end-to-end; before/after latency table in the wave-close report; targets §8 met or the miss stated loudly. (G8)
11. Safety invariance: no `bcheck`/`temp`/`safe`/duration value touched anywhere in the wave (diff-audited; DoD-10).
12. Full suite `npx playwright test` green ×2 (release H7), no `--retries`/`--workers`, serialized per §11a.

## 10 · Open questions for the owner (before implementation)
1. **Cold-ack earcon (§3):** when the cached spoken ack isn't ready, play a short local chime + the
   visual "…חושב", or visual-only? Wave 0 proposes the chime (instant, engine-free, not a browser voice).
2. **Non-he/en answer prompts** (§5.1): one parameterized "reply in X only" line (cheap) vs. 5 crafted
   per-language system prompts (better tone)? Wave 0 proposes the parameterized line.
3. **Ack phrasing** per language: fixed proposal in the plan (Task 7) — veto welcome.

## 11 · What changed and why (revision of 2026-07-31, after five owner rulings)

The spec above is the current truth; this section exists only for traceability against the original
(commit `891cf29`).

- **R-28 cancelled → Phonikud out.** The original §6 (Phonikud research, the `vcHeDiacritize` seam,
  INV-P, the niqqud bench + blind trial) is gone: the owner ran the blind A/B (24 audio files, same
  engine) and ruled the audible gain does not exist. The research is preserved in
  `docs/analysis/2026-07-31-phonikud-local-trial.md` and
  `docs/research/2026-07-31-runtime-hebrew-diacritization.md`. INV-P's *transform-protection principle*
  survives as INV-T (§7), now guarding the R-33 text prep instead of a diacritizer.
- **R-32 → Google-only speech.** The original design *kept* the browser voice as the visible fallback
  (§2.4 "playback continues on the system voice", `sysSpeakChunked`) and as the keyless default. The
  owner ruled the fallback is precisely what he keeps hearing. New §6: the browser speaking path is
  deleted wholesale; failures are visible and final (no downgrade). `sysSpeakChunked` was never built
  and never will be.
- **R-35 → there is no keyless user.** Landed mid-revision; recorded as a product invariant (header
  note). An interim draft of this revision designed a "no-AI-key disabled state" (banner + connect
  route + copy) — it was **removed**: it described a product state the owner eliminated long ago. The
  `!aiAvail()` speech branch is now a defensive no-op (§6.2); the 26 non-speech `!aiAvail()` branches
  are explicitly deferred to a Phase 9 review.
- **R-33 → raw text to Gemini.** The original pipeline fed `speechText()` (i.e. `hebSpeechText`'s
  browser-era rewrites) to the cloud engine. New §7 decides all 12 transforms individually: 7 kept
  (sanitation + Hebrew abbreviation whitelist), 5 dropped (degree rewrite, comma injection, range/tilde/
  slash rewording), with INV-T + a named test as the safety fence.
- **R-34 → 8192 on TTS.** Was buried inside the original chunk-pipeline task; now a named ruling with
  its own DoD line and test (the missing cap is what turned long text into `no-audio` → browser voice).
- **Re-examined, kept:** chunked pipeline (re-justified without the dead ~15s browser cutoff — §2 head),
  instant ack (cold path redesigned — §3), generation token, one language source + button removal,
  latency instrumentation. **Dropped tasks:** the Phonikud seam and the niqqud trial (2 of the original
  10). The wave is now removal-and-repair: 9 tasks, smaller than the original 10 in both count and
  substance (no research trial, no new seam machinery; two tasks are mostly deletion).
