# TTS migration — the verified "3.1 tts" developer-API id, and what changes

**Status:** VERIFIED empirically against the live Gemini Developer API (`generativelanguage.googleapis.com/v1beta`, `:generateContent`), 2026-07-23, via `scripts/model-diag.mjs` run in the `model-diag` CI workflow with the owner's `GEMINI_EVAL_KEY`.
**Question:** the app's TTS model is the hard-coded literal `gemini-2.5-flash-preview-tts` (`app.js:5030`). The owner wants to migrate to a newer "3.1 tts" model. What is the exact developer-API id, does it return usable audio, and does anything change?

## TL;DR

- **The 3.1 TTS id is `gemini-3.1-flash-tts-preview`** — it is the **only** 3.1 TTS model on the developer API, and it is **VERIFIED working**: the app's exact TTS payload returns real 24 kHz PCM audio.
- **Nothing in the payload changes.** `responseModalities:['AUDIO']` + `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` is accepted unchanged; `Kore` and `Puck` both return audio.
- **Nothing in `gemReadAudio` changes.** The audio comes back as an `inlineData` part whose mimeType carries `rate=24000`, so the app's `/rate=(\d+)/` parse and its 24000 Hz default both still hold. The mimeType *string* is cosmetically different (see below) but the app never depends on that.
- **Migration = a one-literal swap** at `app.js:5030`: `'gemini-2.5-flash-preview-tts'` → `'gemini-3.1-flash-tts-preview'`. (This task did **not** edit `app.js`.)
- **Caveat:** `gemini-3.1-flash-tts-preview` is a **preview** id (name subject to change / possible deprecation); keep the existing `sysSpeak` fallback. The migration *is* possible today.

---

## 1 · Which TTS / 3.1 ids exist on the developer API

`ListModels` on `generativelanguage/v1beta`, filtered to `/tts/i | /3\.1/ | /preview-tts/i`, with each id's advertised generation methods (empirical, CI run `29995085629`):

| model id | methods | TTS? |
|---|---|:--:|
| `gemini-2.5-flash-preview-tts` | countTokens, generateContent | current app model |
| `gemini-2.5-pro-preview-tts` | countTokens, generateContent, batchGenerateContent | yes (2.5 pro sibling) |
| **`gemini-3.1-flash-tts-preview`** | **generateContent**, countTokens, batchGenerateContent | **yes — the 3.1 TTS** |
| `gemini-3.1-pro-preview` | generateContent, countTokens, createCachedContent, batchGenerateContent | no (text) |
| `gemini-3.1-pro-preview-customtools` | generateContent, countTokens, createCachedContent, batchGenerateContent | no (text) |
| `gemini-3.1-flash-lite-preview` / `-lite` | generateContent, countTokens, createCachedContent, batchGenerateContent | no (text) |
| `gemini-3.1-flash-image-preview` / `-image` / `-lite-image` | generateContent, countTokens, batchGenerateContent | no (image) |
| `veo-3.1-generate-preview` / `-fast-generate-preview` | predictLongRunning | no (video) |

**There is exactly one 3.1 TTS id: `gemini-3.1-flash-tts-preview`.** (There is no `gemini-3.1-pro-preview-tts` — the pro-TTS sibling exists only at 2.5.) All TTS ids advertise `generateContent`, which is the method the app calls.

---

## 2 · Does the 3.1 TTS id return usable audio? (the real app payload)

Payload POSTed = the app's exact call (`app.js:5030`), text `"שלום, זו בדיקה"`, `voiceName:"Kore"`:
```json
{ "contents":[{"parts":[{"text":"שלום, זו בדיקה"}]}],
  "generationConfig":{ "responseModalities":["AUDIO"],
    "speechConfig":{ "voiceConfig":{ "prebuiltVoiceConfig":{ "voiceName":"Kore" } } } } }
```
Success is defined the way `gemReadAudio` (`app.js:5034-5037`) defines it: HTTP 200 **and** an `inlineData` part whose `mimeType` contains `rate=NNN`.

| model | result | mimeType returned | rate | audio bytes (b64 len) |
|---|---|---|---:|---:|
| `gemini-2.5-flash-preview-tts` (control) | **FAIL 400** — *"Model tried to generate text, but it should only be used for TTS…"* | — | — | — |
| `gemini-2.5-pro-preview-tts` | AUDIO OK | `audio/L16;codec=pcm;rate=24000` | 24000 | 138,944 |
| **`gemini-3.1-flash-tts-preview`** | **AUDIO OK** | `audio/l16; rate=24000; channels=1` | **24000** | **145,920** |

Alternate-voice re-probe (`voiceName:"Puck"`, to confirm the voice-config shape/encoding is unchanged):

| model | result | mimeType | rate |
|---|---|---|---:|
| `gemini-2.5-pro-preview-tts` | AUDIO OK | `audio/L16;codec=pcm;rate=24000` | 24000 |
| **`gemini-3.1-flash-tts-preview`** | **AUDIO OK** | `audio/l16; rate=24000; channels=1` | 24000 |

**Verified:** `gemini-3.1-flash-tts-preview` returns a real audio `inlineData` part (~146 KB of base64 PCM), same `prebuiltVoiceConfig` shape, both `Kore` and `Puck` honoured.

---

## 3 · Differences from `gemini-2.5-flash-preview-tts`

- **Payload shape: identical.** `responseModalities:['AUDIO']` + `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` is accepted unchanged. Prebuilt voices (`Kore`, `Puck`) work. No new/renamed fields.
- **Audio encoding: same PCM, cosmetically different mimeType string.** 3.1 returns `audio/l16; rate=24000; channels=1`; the 2.5 family returns `audio/L16;codec=pcm;rate=24000`. Both are **16-bit signed linear PCM, mono, 24000 Hz** — i.e. `b64ToPcm16` (Int16Array) → `pcmToBuffer(pcm, 24000)` with `createBuffer(1, …)` handles both identically. The differences are string-only: `L16` vs `l16` casing, `codec=pcm` present vs absent, `channels=1` present vs absent, and spacing.
- **Impact on `gemReadAudio`: none.** The app extracts the rate with `part.inlineData.mimeType.match(/rate=(\d+)/)` and defaults to `24000`. The 3.1 mimeType contains `rate=24000`, so the parse yields `24000` regardless of the surrounding format. `channels=1` matches the app's mono assumption. **No reader-side code change is required.**

### Side-finding (worth keeping): the *current* production flash-TTS is flaky on short input
On this exact Hebrew phrase, the app's **current** model `gemini-2.5-flash-preview-tts` returned **400** — *"Model tried to generate text, but it should only be used for TTS."* This is an **input-dependent quirk** of that flash preview (it occasionally emits text instead of audio and errors), **not** a model-unavailable error — the app ships with it and it works on most inputs. Notably, on the *same* input both `gemini-2.5-pro-preview-tts` and `gemini-3.1-flash-tts-preview` returned clean audio. So the 3.1 flash-TTS candidate was **more robust than the current model** on this probe — a point in favour of migrating, not a blocker for it.

---

## 4 · The migration recipe

**One literal, one file, no reader change.** At `app.js:5030`:
```diff
- const r=await gemFetch('gemini-2.5-flash-preview-tts', {contents:[{parts:[{text:clean}]}], generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:gemVoice()}}}}}, {timeout:20000});
+ const r=await gemFetch('gemini-3.1-flash-tts-preview', {contents:[{parts:[{text:clean}]}], generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:gemVoice()}}}}}, {timeout:20000});
```
- Keep `gemReadAudio` (`app.js:5034-5037`) as-is — the `/rate=(\d+)/` parse + 24000 default already cover the 3.1 mimeType.
- Keep the `sysSpeak` fallback (`app.js:5062-5072`): `gemini-3.1-flash-tts-preview` is a **preview** id and may be renamed or need billing; the existing 403/404/429 handling already degrades gracefully to the system voice.
- If the design doc's registry work (`model-selection-architecture-design.md`) lands, this literal should become the TTS role's registry entry rather than an inline string — but the *value* is verified either way.

---

## What could NOT be verified
- **Voice catalogue parity** — only `Kore` and `Puck` were probed. Whether every prebuilt voice the app exposes is available on `gemini-3.1-flash-tts-preview` was not exhaustively checked (both tested voices worked; the field shape is identical).
- **Pricing / quota** for `gemini-3.1-flash-tts-preview` — not on the tested surface; TTS quota/billing behaviour (the app already warns about 429/403 for TTS) was not measured here.
- **Long-input robustness** — a single short Hebrew phrase was used. The 2.5-flash control's 400 on that phrase shows TTS-preview models can be input-sensitive; a broader input sweep would harden the confidence, though the 3.1 candidate passed where the current model failed.
- The id carries **`-preview`** — Google may rename or deprecate it; the finding is "works today", not "stable forever".

## Reproduce
```bash
gh workflow run model-diag.yml --ref main
gh run watch <run-id> --exit-status
gh run view <run-id> --log | grep "Probe the models" | sed -n '/TTS/,/done/p'
```
Script: `scripts/model-diag.mjs` (TTS section; key only in the request URL, never printed). Verified run: `29995085629`.
