# Research — TTS for Hebrew (Subject 3)
*Expert report, 18 web queries, sourced 2026-07-15. "unverified" claims flagged in source.*

## Executive summary
- **Best Hebrew naturalness (cloud):** **ElevenLabs v3** (must use **v3** + `language_code:"he"`; older v2 "unintelligible" for Hebrew). Priciest, no offline path.
- **Best *default*:** stay **Google** — current **Gemini 2.5 Flash TTS** ("good" HE, 30 voices, still *preview*) or **Google Cloud Chirp3-HD `he-IL`** (**30 Hebrew voices** confirmed, generous free tier). Good HE, reliable, free-to-cheap at our volumes.
- **Free/offline fallback:** **Web Speech API** — every OS ships a he-IL voice (Apple *Carmit*, MS *Asaf/Avri/Hila*, Google Android). Zero cost/key/network; mediocre quality (Carmit weakest). Right zero-friction default.
- **Offline *neural* Hebrew is — first time — realistically achievable in 2026:** **Phonikud + Israwave/Piper (VITS-ONNX)** via **sherpa-onnx WASM**, real-time on CPU, ~WaveNet target. But shipping in a PWA = model + Hebrew diacritizer, tens of MB → **Phase-2 opt-in download**, not default.
- **Avoid for Hebrew:** OpenAI gpt-4o-mini-tts (heavy American accent, "practically unusable"), Amazon Polly (**no Hebrew voice at all**).

## Why Hebrew TTS is hard
Standard text omits **niqqud** (vowel diacritics) → engine must infer vowels+stress. Systems that ignore this sound flat/robotic. This explains most quality gaps. The offline breakthrough (Phonikud) is precisely a real-time Hebrew grapheme-to-phoneme layer.

## Ranking
- **Tier S:** ElevenLabs v3 (best; native Israeli intonation, gendered grammar; v3 only).
- **Tier A:** Gemini 2.5 Flash TTS (current, "good", preview) · Google Cloud Chirp3-HD he-IL (30 voices; indep. HE MOS unverified) · Azure Neural Avri/Hila ("good", cheap, free via Edge TTS) · Cartesia Sonic 3.5 (<90ms latency, HE quality unverified) · MiniMax (very good but via voice-cloning, niche).
- **Tier D:** OpenAI gpt-4o-mini-tts (American accent) · PlayHT (unverified/likely weak).
- **None:** Amazon Polly (no Hebrew).
- **Israeli:** ivrit-ai = STT not TTS. Phonikud/Israwave/HebTTS = emerging offline research.

## Offline / on-device
- **Web Speech API he-IL voices:** Apple Carmit (low/robotic, offline once downloaded); Windows Asaf (offline) + Hila/Avri (high but effectively cloud); Android Google voices (2M/2F, "flat" on unpointed HE). **iOS gotcha:** `speak()` only fires inside a user gesture — trigger once on the "start cooking" tap, then chain utterances. Enumerate `getVoices()` at runtime.
- **In-browser neural:** Kokoro (leading in-browser, **no Hebrew**). Piper (~15M VITS-ONNX, CPU, no official HE voice but reachable via research stack). **Phonikud** (2025, HE G2P, negligible latency, drives real-time Piper). **Israwave** (ONNX, SASPEECH/Kan-11, "match WaveNet", <1ms/sentence CPU; browser packaging unverified). **sherpa-onnx** = runs Piper/VITS ONNX 100% offline in-browser via WASM = most realistic PWA path.
- **Verdict:** good offline Hebrew is achievable but = ship acoustic model + diacritizer (~tens of MB). Phase-2 opt-in, quality "good" not ElevenLabs-tier.

## Costs (1 min ≈ ~1,000 chars)
| Provider | Price | Free tier | Notes |
|---|---|---|---|
| Web Speech API | $0 | Unlimited | on-device, no key |
| Google Chirp3-HD he-IL (30 voices) | $30/1M chars | 1M chars/mo | only tier confirmed for he-IL |
| Gemini 2.5 Flash TTS (current) | $0.50/1M in + $10/1M audio-out tok | free status unverified | token-billed |
| Azure Neural (Avri/Hila) | $16/1M ($22 HD), commit down to $7.50 | 500k/mo never expires | cheap, reliable |
| ElevenLabs v3 (he) | ~$165/1M (Pro) ≈ $0.17–0.36/min | 10k credits/mo (~10min, no commercial) | best quality, priciest |
| OpenAI gpt-4o-mini-tts | ~$15/1M (~$0.015/min) | PAYG | cheap but poor HE accent |
| Cartesia Sonic 3.5 | ~$5–37/1M | 20k credits/mo | <90ms; HE quality unverified |
| Offline Piper/Israwave | $0 | Unlimited | self-host; setup cost only |
Heavy user (~150k chars/mo ≈ 30 sessions): Web Speech/offline **$0**; Google/Azure **effectively $0** (free tier); OpenAI ~$2.25 (wrong accent); ElevenLabs ~$25–99/mo.

## Customization design
- **TTS abstraction (do this):** one `TTSProvider` interface + adapter per provider (WebSpeech default/offline, GeminiTTS current, GoogleCloud, Azure, ElevenLabs, Cartesia, future OfflinePiper). Settings UX: provider dropdown → voice dropdown (live) → rate/pitch → "Test voice" → offline-fallback toggle → localStorage.
- **Latency tactics:** speak current step via Web Speech instantly while cloud audio for next step fetches in background; pre-synthesize next step; cache repeated phrases ("Flip the meat", timer callouts) in IndexedDB; Web Speech instant fallback if network stalls.
- **Key management (critical):** any key in a client-only PWA is exposed → BYO keys = "advanced, at-your-own-risk"; route paid managed tier through the planned **Cloudflare Worker** so keys stay server-side.
- **AI *text* model — expose CURATED selector, NOT fully-open BYO:** a bad *voice* is cosmetic; a bad *text model* can hallucinate cooking instructions, mishandle Hebrew, or bypass the v214–v219 safety guardrails. Keep **Gemini default**, offer **OpenAI/Claude as vetted BYO behind "Advanced"**, keep guardrails **provider-agnostic** (in our own prompt/post-processing layer), pick the model ourselves for the paid tier.

## Recommendation
1. **Default:** keep Google (Gemini 2.5 Flash TTS; consider adding Cloud Chirp3-HD he-IL for 30-voice choice + non-preview footing).
2. **Premium opt-in:** ElevenLabs v3 (BYO key, "most natural Hebrew") + Azure Avri/Hila (cheap alt).
3. **Free/offline fallback:** Web Speech API (handle iOS gesture rule; enumerate he-IL at runtime).
4. **Phase-2 delight:** prototype offline neural Hebrew (Phonikud + Israwave/Piper via sherpa-onnx WASM) as optional voice download.
5. **Expose:** TTS provider+voice = yes (build §4a abstraction). AI text model = curated selector only. Paid tier keys → Worker.
6. **Do NOT** wire OpenAI TTS or Polly for Hebrew.

## Open items to verify before building
Google WaveNet/Standard he-IL existence+price (docs only surfaced Chirp3-HD); Cartesia HE quality; Gemini TTS free-tier eligibility; Israwave model size + in-browser deployment; OpenAI Dec-2025 model's Hebrew accent.
