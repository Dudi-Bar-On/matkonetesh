# W5-D — Current official API documentation for the roadmap's dependencies

Agent W5-D · fetched 2026-07-22 · all sources are primary (spec text, vendor docs, vendor ToS) unless
explicitly marked *(secondary)*. Claims I could not source from a primary document were dropped, not softened.

---

## 0. What the app actually calls (measured, not assumed)

| Thing | Where | Value |
|---|---|---|
| Gemini text model | `app.js:4206` | `const GEM_MODEL='gemini-2.5-flash'` |
| Gemini endpoint | `app.js:4205`, `app.js:4207` | `https://generativelanguage.googleapis.com/v1beta/models/` + `<model>:generateContent` |
| Gemini TTS model | `app.js:5030` | `gemFetch('gemini-2.5-flash-preview-tts', …)` |
| TTS request shape | `app.js:5030` | `generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:…}}}}` |
| TTS voice list | `app.js:5003` | `['Kore','Aoede','Puck','Charon','Fenrir','Leda']` |
| Audio decode | `app.js:5036`, `app.js:5013-5023` | PCM16 → mono AudioBuffer, rate parsed from `mimeType`, default `24000` |
| System TTS | `app.js:5048-5057` | `SpeechSynthesisUtterance`, `u.lang` = `he-IL`/`en-US`, `rate=0.92` |
| Hebrew voice pick | `app.js:4993` | `speechSynthesis.getVoices().filter(v => /he|iw/i.test(v.lang))` |
| Managed proxy allow-list | `worker/index.js:43` | `/^\/v1beta\/models\/[^/]+:(generateContent\|streamGenerateContent)$/` |
| Web Bluetooth | — | **`navigator.bluetooth` appears nowhere in the repo.** Zero BLE code exists. |
| Anova / MEATER | `app.js:5380`, `app.js:6183-6187` | Brand strings in equipment pickers + a *manual-entry* probe subsystem. No network calls. |

Note on a near-miss: a `Grep` of `app.js:4214` renders `/v1beta/models/` with backslashes. `Read` of the same
line shows forward slashes. **That is a grep display artifact, not a defect.** Recording it so the next agent
does not re-report it as a fourth false alarm.

---

## 1. Web Bluetooth — prior conclusion **CONFIRMED**, and the evidence upgraded to primary

W1-H (`docs/analysis/sweep/W1-H-probes.md:23`) concluded live BLE cannot be the primary path, citing
TestMu and a Chrome support-forum thread — both secondary. The conclusion is correct. Here it is from
primary sources, plus one fact W1-H did not have that makes the wall *harder* than "no signal of intent."

### Spec status — never was, and is not, on the W3C Recommendation track
- Status header, verbatim: **"Draft Community Group Report, 3 June 2026"**
  — [Web Bluetooth spec](https://webbluetoothcg.github.io/web-bluetooth/)
- MDN: "This is an experimental technology" / **"Limited availability — This feature is not Baseline
  because it does not work in some of the most widely-used browsers."**
  — [MDN: Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)

A Community Group Draft Report is not a standard. It carries no W3C consensus and no patent commitments.

### Apple has actively **opposed** it — not merely stayed silent
- WebKit standards-positions **issue #570 "Web Bluetooth", label `position: oppose`, closed 2 Dec 2025**,
  tagged with privacy, security and *device independence* concerns.
  — [WebKit/standards-positions#570](https://github.com/WebKit/standards-positions/issues/570)
- Mozilla's standards position is **"Harmful."** *(recorded on [caniuse](https://caniuse.com/web-bluetooth))*

This is a correction in strength, not direction: W1-H said "Apple has given no signal of intent to ship it."
The accurate statement is stronger — **two of the three engines have filed formal positions against it.**
Planning should treat Safari/iOS support as *not coming*, not *not yet*.

### Support matrix — [caniuse: web-bluetooth](https://caniuse.com/web-bluetooth), global **76.78%**
| Browser | Status |
|---|---|
| Chrome desktop | Supported, **56+** |
| Edge | Supported, **79+** |
| Chrome for Android | Supported |
| Samsung Internet | Supported, **6.2+** |
| Android WebView | Not supported until recently |
| **Safari desktop** | **Not supported, all versions** |
| **Safari iOS / iPadOS** | **Not supported, all versions through 26.5** |
| **Firefox** | **Not supported, all versions through 155** |

caniuse note, verbatim: *"Safari on iOS and iPadOS has no native support. A third-party Safari web extension,
iOSWebBLE, polyfills `navigator.bluetooth` … so a website can use Web Bluetooth once a user installs and
enables the extension."* — a user-installed extension is not a shippable path for a greasy-hands cook app.

Chrome for iOS is built on WKWebView and therefore inherits Safari's engine — installing Chrome on an iPhone
does not add Web Bluetooth.

### Permission model
- **Secure context required.** MDN: *"The Web Bluetooth API can only be used in a secure context."*
- **Per-device grant, gated on a user gesture.** MDN: *"The permission prompt is displayed when calling
  `Bluetooth.requestDevice()` … (the owning global object must also have transient activation)."*
- Chrome: *"Discovering Bluetooth devices with `navigator.bluetooth.requestDevice` must be triggered by a
  user gesture such as a touch or a mouse click"* — only `pointerup`, `click`, `touchend`.
  — [Chrome: Communicating with Bluetooth devices over JavaScript](https://developer.chrome.com/docs/capabilities/bluetooth)
- There is no "pair once, reconnect silently forever" guarantee in the spec text I read. Each new device
  requires a fresh gesture + chooser.

### Backgrounding — the connection cannot be relied on. Two verified facts:
1. **The API is `[Exposed=Window, SecureContext]`** on the `Bluetooth` interface — Window only, **no Worker
   and no ServiceWorker exposure**. — [spec IDL](https://webbluetoothcg.github.io/web-bluetooth/)
   A service worker therefore cannot hold or resume a GATT connection. There is no background path, by design.
2. **Chrome freezes background pages.** Verbatim: *"In the frozen state the browser suspends execution of
   freezable tasks in the page's task queues until the page is unfrozen. This means things like JavaScript
   timers and fetch callbacks don't run."* Discarded pages are worse: *"No tasks, event callbacks, or
   JavaScript of any kind can run in this state."* And on mobile specifically, *"the transition to hidden is
   … often the last state change that's reliably observable."*
   — [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

I could **not** retrieve the text of spec §5.2.2 "Handling Document Loss of Full Activity" (the section
exists in the ToC but the body was truncated in every fetch). So I am **not** claiming the spec mandates
disconnection on backgrounding. What is proven is sufficient: Window-only exposure plus task-queue freezing
means a web page cannot be trusted to keep reading a probe while the phone is in a pocket or the screen is off.

> **Verdict: CONFIRMED. Live Web Bluetooth cannot be the primary probe path.** It excludes every iPhone
> permanently, and even on Android it is foreground-and-screen-on only. Any BLE feature must be scoped as an
> Android/desktop-Chrome bonus with the phone propped up and awake — exactly as W1-H recommended.

---

## 2. Gemini API

### 2a. ⚠️ THE APP'S TEXT MODEL HAS A SHUTDOWN DATE — **16 October 2026**

From the official deprecations table (columns: *Model / Release date / Shutdown date / Recommended
replacement*), verified in two independent fetches:

| Model | Release date | **Shutdown date** | Recommended replacement |
|---|---|---|---|
| **`gemini-2.5-flash`** ← *`app.js:4206`* | June 17, 2025 | **October 16, 2026** | `gemini-3.6-flash` |
| `gemini-2.5-flash-lite` | July 22, 2025 | October 16, 2026 | `gemini-3.1-flash-lite` |
| `gemini-2.5-pro` | June 17, 2025 | October 16, 2026 | `gemini-3.1-pro-preview` |

— [ai.google.dev/gemini-api/docs/deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

**This is roughly three months out.** Every AI feature in the app — copilot, grounding, the numeric guard,
the whole Wave-1 trust surface — routes through `GEM_MODEL` at `app.js:4206`. On 16 Oct 2026 that constant
starts returning errors. This is the single highest-priority item in this report and it is a calendar
deadline, not a judgement call. The model is still listed as available and unmarked on the models page today
— the shutdown is only visible on the deprecations page, which is why it is easy to miss.

### 2b. TTS model — still current, still **Preview**, no shutdown date

- `gemini-2.5-flash-preview-tts` **is still listed** on the models page under Gemini 2.5 Flash:
  *"Controllable text-to-speech audio generation with fine control over style and pacing."*
  Page last updated **2026-07-21 UTC**. — [models](https://ai.google.dev/gemini-api/docs/models)
- Deprecations table: `gemini-2.5-flash-preview-tts` — release **May 20, 2025**, **"No shutdown date
  announced"**, recommended replacement **`gemini-3.1-flash-tts-preview`**. Same for `gemini-2.5-pro-preview-tts`.
- The whole surface is **preview**: *"Preview: Gemini text-to-speech (TTS) is in Preview."*
  — [speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)

**Status: preview-only, but not deprecated and not dated for removal.** Lower urgency than 2a. A newer
`gemini-3.1-flash-tts-preview` exists (adds streaming and expressive audio tags; the docs warn it has
*"occasional voice inconsistency"* and can throw `500` errors *"requiring automated retry logic"*).

### 2c. Request shape — the app is on the older-but-supported call style

Google has introduced an **Interactions API** and the speech docs now lead with it:

```
POST https://generativelanguage.googleapis.com/v1beta/interactions
{ "model":"gemini-3.1-flash-tts-preview", "input":"…",
  "response_format":{"type":"audio"},
  "generation_config":{"speech_config":[{"voice":"Kore"}]} }
```

The app instead posts `…/v1beta/models/<model>:generateContent` with `responseModalities:['AUDIO']` and the
nested `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` (`app.js:5030`).

**This is fine — do not rush a rewrite.** The migration guide states verbatim: *"While `generateContent`
remains fully supported, we recommend the Interactions API for all new development."* **No sunset date and no
shutdown timeline is stated for `generateContent`.**
— [migrate-to-interactions](https://ai.google.dev/gemini-api/docs/migrate-to-interactions)

So: the *transport* is safe; the *model name* at `app.js:4206` is the thing on a clock.

### 2d. Voices, audio format, Hebrew — the app's handling is correct

- **30 prebuilt voices** documented: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe,
  Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar,
  Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat.
  **All six names in `app.js:5003` are on that list.** No dead voice names.
- **Audio format: PCM, `channels=1, rate=24000, sample_width=2`** (mono / 24 kHz / 16-bit). The app's
  `b64ToPcm16` + `pcmToBuffer` and its `24000` default (`app.js:5013-5023`, `app.js:5036`) match exactly.
- **Hebrew is supported**, listed with code **`he`** in the supported-languages table (90+ languages).
- **Language is auto-detected**, verbatim: *"The TTS models detect the input language automatically."*
  There is **no `languageCode` parameter** documented for TTS. The app never sends one — correct behaviour,
  and it means Hebrew works by virtue of the Hebrew input text at `app.js:5027`.
- Context limit: *"A TTS session has a context window limit of 32k tokens."* Not a constraint for the app's
  one-or-two-sentence utterances.
- Limitation: *"TTS models can only receive text inputs and generate audio outputs"* and *"TTS does not
  support streaming, except when using `gemini-3.1-flash-tts-preview`."*

### 2e. Cost inputs

— [pricing](https://ai.google.dev/gemini-api/docs/pricing), page last updated **2026-07-21 UTC**

| Model | Free tier | Paid input | Paid output | Batch |
|---|---|---|---|---|
| `gemini-2.5-flash-preview-tts` | available (input & output) | **$0.50 / 1M (text)** | **$10.00 / 1M (audio)** | $0.25 in / $5.00 out |
| `gemini-2.5-flash` | free of charge | $0.30 / 1M | $2.50 / 1M | — |

**Audio output is 4× the price of text output per token, and TTS text input is ~1.7× text-model input.**

Two honest gaps, stated rather than papered over:
1. **Audio tokens-per-second is not documented on any page I fetched**, so a $/minute-of-speech figure cannot
   be derived from primary sources. It has to be *measured* against a real response before any per-user cost
   model is trusted.
2. **Free-tier rate limits for TTS are contradictory across Google's own pages.** The pricing page says a free
   tier is available for TTS input and output. The rate-limits page **does not list the TTS model in any free
   tier table at all** — it only appears in Batch API tables for Tiers 1–3, and the page defers to
   *"View your active rate limits in AI Studio."*
   — [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
   Third-party blogs quote "3 RPM / 15 RPD" for free-tier TTS; **I found no primary source for that number and
   am not asserting it.** The app's own user-facing error copy at `app.js:5065` already tells the user free-tier
   TTS quota is very limited and may need billing — that copy is a reasonable hedge and should stay.

Cost mitigation already in the code: `gemCache` (`app.js:5004`, capped at 40 entries, `app.js:5038`) keys on
`text + voice`, so repeated utterances — which is most of a cooking session's chatter — cost nothing after the
first play.

### 2f. 🔴 Product gap: **Gemini TTS is unreachable for managed-AI users**

Evidence chain, all in `app.js`:
- `gemSpeak` line 5026: `const key=gemKey(); if(!key) throw new Error('no-key');` — requires a **BYOK** key.
- `vcSpeak` line 5061: `if(gemKey()){ gemSpeak(...) } else …` — only reaches Gemini TTS when BYOK is set.
- `gemMode()` line 5010 returns `'managed'` when a central URL + access code are configured; `gemSpeak`
  ignores that mode entirely.
- The Worker **would** have proxied it: `worker/index.js:43` allows any
  `/v1beta/models/<anything>:generateContent`, which `gemini-2.5-flash-preview-tts:generateContent` matches.

So a managed-AI user (the online-first default per the 2026-07-22 owner decision) gets **system
`speechSynthesis` only** — never the premium Hebrew voice — even though the server-side plumbing already
supports it. This is a routing gap in the client, not a limitation of the Worker or of Google.

---

## 3. Anova and MEATER

### 3a. Anova — an **official** developer API exists (this corrects the assumption that none does)

- Portal: [developer.anovaculinary.com](https://developer.anovaculinary.com/) — *"BLE & Cloud APIs"*,
  covering Precision® Cookers and Precision™ Ovens.
- Announced **29 July 2025**: *"Whether your device communicates over Bluetooth or Wi-Fi, the API can be used
  to read the current state,"* and it *"is available to everyone."*
  — [announcement](https://anovaculinary.com/blogs/blog/introducing-the-anova-developer-api)
- **BLE GATT UUIDs are published per device.** Precision Cooker Mini, service
  `910772a8-a5e7-49a7-bc6d-701e9a783a5c`; characteristics `0f5639f7-…` (SET_TEMPERATURE),
  `6ffdca46-…` (CURRENT_TEMPERATURE), `54e53c60-…` (STATE). No authentication on the BLE path.
  — [Mini API reference](https://developer.anovaculinary.com/docs/devices/mini/api-reference)
- Official sample code: `anova-culinary/developer-project-{wifi,nano,mini,a2a3}` on GitHub, all updated
  **2 July 2025**. — [github.com/anova-culinary](https://github.com/anova-culinary)
- Cloud transport is reported as `wss://devices.anovaculinary.io` *(secondary — search result, not read from
  the docs; the doc pages under `/docs/getting-started` and `/docs` both returned 404 to my fetches)*.

### 3b. 🔴 Anova's API Terms **forbid commercial use** — this changes W1-H's recommendation

[API Terms of Use](https://developer.anovaculinary.com/terms), effective **21 May 2025**:

- The licence is limited to **"personal, non-commercial purposes"**, for building apps that interact with
  **your own** Appliance.
- **API Key** required; the user is *"solely responsible"* for its use, keys **cannot be shared with third
  parties**, and Anova may revoke *"at any time in its sole discretion."*
- Redistribution barred: you may not *"Rent, lease, lend, sell, sublicense, assign, distribute, publish,
  transfer, or otherwise make available the API."*
- Rate limits: Anova *"may set and enforce limits on your use of the API in its sole discretion."*
- Liability capped at **$100 in the aggregate**. Anova *"may modify or discontinue the API … at any time."*

W1-H (`W1-H-probes.md:72`, `:88`) called the Anova cloud API *"the best risk/reward integration found in this
whole survey."* **On the technical merits that holds. On the licence it does not.** A personal, non-commercial,
non-sublicensable, per-user-key licence cannot be embedded in a shipped product: the app cannot hold a key on
users' behalf (sharing barred), cannot ship its own key (non-commercial + no redistribution), and Anova can
revoke at will with a $100 liability ceiling. **Anova should be reclassified from "ship it" to "hobbyist /
self-host only,"** unless a commercial agreement is negotiated with Anova directly.

### 3c. MEATER — official, public, but **BETA**, and the auth model is a problem

[apption-labs/meater-cloud-public-rest-api](https://github.com/apption-labs/meater-cloud-public-rest-api)

- Status, verbatim: **"The MEATER Cloud REST API is in BETA. There may be bugs and changes."**
- Base URL: `https://public-api.cloud.meater.com/v1`
- Auth: **`POST /login` with email + password**, returns a JWT; requests use `Authorization: Bearer <JWT>`.
  *"The JWT doesn't expire but may be reset."*
- Endpoints: `POST /login`, `GET /devices`, `GET /devices/{id}` — **read-only telemetry**, no control.
- Rate limits: *"Recommended: 2 requests per 60 seconds. Maximum: 60 requests per 60 seconds."*
- Precondition: the device must be seen by MEATER Cloud, with the MEATER app or Block holding **both** an
  active Bluetooth **and** Cloud connection. The phone running the MEATER app must stay online next to the grill.
- Support: **"The MEATER Support Team won't be able to provide support for the API."** Subject to MEATER's
  Terms of Use.
- Probe-level BLE remains undocumented; only the cloud layer is public.

**Assessment:** technically the easiest cross-platform live read available — plain HTTPS, works on iOS,
no Bluetooth. Three real frictions: (1) it demands the user's **MEATER account password**, not an OAuth
consent — a hard ask and a liability to handle in a PWA; (2) 2 req/min recommended is a ~30 s telemetry
cadence, adequate for a brisket, marginal for a steak sear; (3) BETA with no support commitment.

---

## 4. Web Speech API `speechSynthesis` and the Hebrew verdict

### What is guaranteed
- `speechSynthesis.getVoices()` is **"Baseline Widely available since September 2018."**
  — [MDN: getVoices()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)
- The voice list populates **asynchronously**; MDN's own example gates on `onvoiceschanged`. The app does this
  correctly at `app.js:5001`.

### What is **not** guaranteed — the crux
**No specification or vendor document guarantees that any given device has a Hebrew voice.** The voice list is
user-agent and OS dependent, so `getVoices()` can legitimately return zero `he`/`iw` entries on a device that
otherwise fully supports the API.

I deliberately dropped the platform-by-platform Hebrew claims (iOS "Carmit", Android, Windows) that turned up
in search: I could not verify any of them against an Apple, Google or Microsoft primary document within this
task's budget, and the search results were contradictory about whether Carmit ships with iOS by default versus
being a purchasable Nuance voice. **Unverified, therefore not asserted.** If a per-OS Hebrew voice matrix is
needed for a ship decision, it must come from device testing, not from documentation — the docs genuinely do
not promise it.

### The app already fails safe
`vcPickVoice` (`app.js:4990-4999`) filters on `/he|iw/i`, prefers a Google voice, falls back to the first
match, and **returns `null` if there is none**. `sysSpeak` (`app.js:5048`) then speaks with `u.lang='he-IL'`
and no explicit voice, leaving the platform to pick — and wraps the whole thing in `try/catch` with a Hebrew
toast. That is the right structure. The residual risk is not a crash; it is a device with no Hebrew voice
reading Hebrew text through an English engine, which is unintelligible rather than silent.

### Comparison

| | `speechSynthesis` | Gemini TTS |
|---|---|---|
| Hebrew guaranteed? | **No** — device-dependent, undocumented | **Yes** — `he` in the supported-languages table |
| Quality | Whatever the OS ships; varies wildly | Documented as *"controllable … fine control over style and pacing"* |
| Cost | $0 | $0.50/1M text in + $10.00/1M audio out |
| Latency | Local, instant | Network round-trip (app allows 20 s, `app.js:5030`) |
| Offline | Works | Fails |
| Repeat cost | $0 | $0 after first play (`gemCache`, `app.js:5004`) |
| Status | Baseline widely available | **Preview** |

### 🔊 Hebrew-TTS verdict

**Keep the two-tier design — it is the correct architecture — but fix the routing.**

Cloud TTS is the only path with a *documented* Hebrew guarantee; `speechSynthesis` is a best-effort fallback
that may be excellent, mediocre, or unintelligible depending on the phone in the cook's pocket. For a
Hebrew-first app used beside a live fire, where a misheard temperature is a food-safety event, the guaranteed
path should be the default whenever the app is online — which, per the 2026-07-22 owner decision, is the
normal case.

The blocker is not technical and not contractual: it is the three-line gate at `app.js:5026` and `app.js:5061`
that makes Gemini TTS BYOK-only, while the managed Worker at `worker/index.js:43` would already forward it.
Today the users on the app's *default* AI path get the *weaker* voice. That is backwards.

---

## 5. Flagged: deprecated / preview-only / changed

| # | Item | Status | Severity |
|---|---|---|---|
| 1 | `gemini-2.5-flash` (`app.js:4206`) | **Shutdown 16 Oct 2026**, replace with `gemini-3.6-flash` | 🔴 **dated deadline, ~3 months** |
| 2 | `gemini-2.5-flash-preview-tts` (`app.js:5030`) | **Preview**, no shutdown date; successor `gemini-3.1-flash-tts-preview` | 🟡 monitor |
| 3 | Gemini TTS as a whole | **"in Preview"** — Google may change the surface without a deprecation window | 🟡 monitor |
| 4 | `generateContent` transport (`app.js:4207`) | **Not deprecated.** *"remains fully supported"*, no sunset date. Interactions API is a recommendation for new work only | 🟢 no action |
| 5 | Voice names (`app.js:5003`) | All 6 still on the documented 30-voice list | 🟢 no action |
| 6 | PCM 24 kHz mono 16-bit decode (`app.js:5013-5036`) | Matches documented output exactly | 🟢 no action |
| 7 | Gemini TTS unreachable in managed mode (`app.js:5026`, `:5061`) | Client-side routing gap; Worker already permits it | 🔴 product defect |
| 8 | Anova API commercial use | **Barred** by ToU eff. 21 May 2025 — reclassify from "ship" to "self-host only" | 🔴 blocks a roadmap item |
| 9 | MEATER Cloud REST API | **BETA**, email+password auth, no vendor support | 🟡 scope carefully |
| 10 | Web Bluetooth | Community Group Draft; WebKit **oppose**, Mozilla **harmful**; no iOS, ever | 🟢 already excluded — keep excluded |
| 11 | Free-tier TTS rate limits | Google's own pricing and rate-limit pages disagree; no primary number exists | 🟡 measure, don't assume |

---

## Sources
- [Web Bluetooth — Draft Community Group Report, 3 June 2026](https://webbluetoothcg.github.io/web-bluetooth/)
- [MDN — Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [WebKit standards-positions #570 — Web Bluetooth (oppose)](https://github.com/WebKit/standards-positions/issues/570)
- [caniuse — web-bluetooth](https://caniuse.com/web-bluetooth)
- [Chrome — Communicating with Bluetooth devices over JavaScript](https://developer.chrome.com/docs/capabilities/bluetooth)
- [Chrome — Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [Gemini API — Speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini API — Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API — Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Gemini API — Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API — Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API — Migrate to Interactions](https://ai.google.dev/gemini-api/docs/migrate-to-interactions)
- [Anova Developer Documentation](https://developer.anovaculinary.com/)
- [Anova API Terms of Use (eff. 21 May 2025)](https://developer.anovaculinary.com/terms)
- [Anova Precision Cooker Mini — API reference](https://developer.anovaculinary.com/docs/devices/mini/api-reference)
- [Anova — Introducing the Anova Developer API](https://anovaculinary.com/blogs/blog/introducing-the-anova-developer-api)
- [github.com/anova-culinary](https://github.com/anova-culinary)
- [MEATER Cloud Public REST API](https://github.com/apption-labs/meater-cloud-public-rest-api)
- [MDN — SpeechSynthesis.getVoices()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)
