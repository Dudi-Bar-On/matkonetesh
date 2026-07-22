# W4-A — Unit Economics: what one user costs

**Date:** 2026-07-22 · **Version:** v258 · **Scope:** the 13 wired AI features (`W1-F-ai.md`) priced at real Gemini rates.
**Method:** every prompt size below was **measured at runtime** against the built `index.html` served on :8199 (Playwright `page.evaluate` calling the app's own grounding builders), not estimated from reading. Pricing fetched from Google's own page on the date of writing. Reproducible model: `scratchpad/unit_econ.py`.

---

## 0. The headline, and a correction to the brief

The brief assumed **TTS and photo analysis** were the expensive paths. Measured, that is **half wrong**:

| | measured cost/call | verdict |
|---|---|---|
| Photo analysis | **$0.0014** | the *cheapest* AI feature in the app. Not a cliff. |
| TTS (per 15s step read) | **$0.0038** | real, but only 16% of even the heaviest persona. |
| **Grounded Google Search** | **$0.0350** | **77–90% of every persona's entire monthly cost.** |

**The dominant cost in this product is not tokens. It is the `$35 / 1,000 grounded prompts` request fee on the `google_search` tool**, which `app.js` attaches **unconditionally** to Ask-the-Fire (`4249`) and Voice Q&A (`5278`). One tap of "Ask the Fire" costs ~13× more in search fees than in tokens.

Second structural finding: **the Worker's only cost control cannot see this fee.** `worker/index.js:76` meters `usageMetadata.totalTokenCount`; grounding is billed per *request*, not as tokens. The default 2,000,000-token cap (`scripts/central-code.mjs:35`) therefore authorises **~$16/month per access code while metering ~10% of it**.

---

## 1. Pricing basis

Source: **https://ai.google.dev/gemini-api/docs/pricing**, fetched **2026-07-22**, paid ("Standard") tier.

| Item | Rate |
|---|---|
| `gemini-2.5-flash` input (text / image / video) | **$0.30 / 1M tok** |
| `gemini-2.5-flash` output | **$2.50 / 1M tok** |
| `gemini-2.5-flash-preview-tts` input (text) | **$0.50 / 1M tok** |
| `gemini-2.5-flash-preview-tts` output (audio) | **$10.00 / 1M tok** |
| Grounding with Google Search | **1,500 RPD free, then $35 / 1,000 grounded prompts** |
| Audio output tokenisation | **25 tokens / second** of synthesised audio |
| Image input | tiled 768×768, **258 tok/tile**; a 4032×3024 phone photo ≈ 774–1,548 tok |

> Third-party trackers still quote $0.15/$1.25 for 2.5 Flash. Those are **stale** — Google's own page today says $0.30/$2.50. I used Google's page.

**One favourable fact:** `thinkingConfig:{thinkingBudget:0}` is set on **every** call site (`4250, 4351, 5195, 5279, 6974, 9299`). No thinking tokens are ever billed. That is a real, deliberate saving and it should not be regressed.

### Tokenisation assumption (stated, and shown not to matter)
Hebrew tokenises far worse than English. Sources put Hebrew between ~1.0 tok/char (GPT-3 BPE) and ~0.4 tok/char (large multilingual vocabularies). **I use 2.0 chars/token (0.5 tok/char)** for Hebrew, 4.0 for English.
**The conclusion is insensitive to this.** For the heaviest persona, *all token spend of every kind* is only **8%** of the bill:

> Persona C = $2.831 · search fees **$2.170 (77%)** · TTS audio **$0.448 (16%)** · **all tokens $0.213 (8%)**

Even at 1.0 chars/token (double my assumption) the total moves by ~$0.21. The ranking never changes.

---

## 2. Measured call-site inventory

All char counts are **runtime measurements** of the app's own prompt builders, not estimates.

| # | Feature | `app.js` | Grounding/prompt size (measured) | `maxOutputTokens` | Search? |
|---|---|---|---|---|---|
| 1 | Ask the Fire | `4237` | sys **638 ch**; ctx **425 ch** (catalog) → **1,116 ch** (safety); +4 history turns | 1600 | **YES** (`4249`) |
| 2 | Copilot "what now" | `5448` | → `askGemini`, same body | 1600 | **YES** |
| 3 | Voice Q&A | `5269` | sys **222 ch** + live cook ctx | 400 | **YES** (`5278`) |
| 4 | Recipe generator | `8563` | ~1,500 ch | 1600 | no |
| 5 | Diagnose | `8475` | grounding **1,249 ch** | 1100 | no |
| 6 | Journal insights | `8646` | state-dependent | 1200 | no |
| 7 | What can I make | `8182` | grounding **5,511 ch** (146 project items) | 1400 | no |
| 8 | Pantry advisor | `9169` | grounding **8,387 ch** ← **largest prompt in the app** | 1200 | no |
| 9 | Event planner | `8314` | state-dependent | 1500 | no |
| 10 | Seasoning rec | `8406` | ~800 ch | 1000 | no |
| 11 | Equipment lookup | `6306`/`6368` | short task | 900 / 700 | **YES** (`search:true`) |
| 12 | Photo analyzer | `9296` | prompt **380 ch** + full-res image | 800 | no |
| 13 | MT hydration | `6962` | **82 ch avg** × **1,654 catalog prose fields** (135,458 ch total) | 600 | no |
| — | `AI_JSON_SYS` (shared) | `4331` | **351 ch** on every structured call | — | — |
| — | `SAFETY_FACTS()` | `4117` | **817 ch** injected on every safety-intent question | — | — |

Catalog scale, measured: **279 items**, **146 project items**, **1,654 Hebrew prose fields**.

---

## 3. Cost per call

| Feature | $/call | note |
|---|---|---|
| **Ask the Fire** | **$0.0381** | 92% is the search fee |
| **Copilot "what now"** | **$0.0381** | 92% is the search fee |
| **Voice Q&A (text only)** | **$0.0365** | 96% is the search fee |
| **Voice Q&A (incl. spoken answer)** | **$0.0400** | 87% search, 9% TTS |
| **Equipment lookup** | **$0.0370** | 94% is the search fee |
| TTS, one 15-second step read | $0.0038 | |
| Recipe generator | $0.0026 | |
| Pantry advisor | $0.0023 | largest prompt, still cheap |
| What can I make | $0.0022 | |
| Event planner | $0.0019 | |
| Journal insights | $0.0016 | |
| **Photo analysis** | **$0.0014** | *cheaper than a spoken sentence* |
| Diagnose | $0.0014 | |
| Seasoning rec | $0.0011 | |
| Voice content translate | $0.0003 | |
| MT, one string | $0.00008 | |

**Every one of the five most expensive calls is expensive for exactly one reason: the search tool is attached.**

---

## 4. Cost per user per month

Personas and their monthly call mixes are in `unit_econ.py` (`PERSONAS`) — assumptions are explicit and editable there.

| Persona | Monthly cost | Grounded calls | Search fee share |
|---|---|---|---|
| **A · Curious browser** — installs, asks 5 questions, never cooks | **$0.27** | 7 | 90% |
| **B · Weekend griller** — 2 cooks/month, screen only | **$0.67** | 17 | 89% |
| **C · Enthusiast** — weekly cook, **Voice Cook mode on** | **$2.83** | 62 | 77% |
| **D · Charcutier** — multi-week dry-cure projects | **$1.10** | 26 | 83% |
| *Blended (equal weight)* | **$1.22** | | |

Non-Hebrew users add roughly **+$0.03 in month 1** for translation hydration (350 strings). That is financially trivial — but see cliff #4, because its *request* profile is not.

---

## 5. The cost cliffs, ranked

### 🔴 1. `google_search` is attached unconditionally to conversational AI
`app.js:4249` (Ask-the-Fire) and `app.js:5278` (Voice Q&A) always pass `tools:[{google_search:{}}]`. Every question — including "what temp for brisket?", which the app *already answers from its own vetted catalog* via `askContextFor` (`4136`) — incurs the **$0.035** grounded-prompt fee.
The search tool exists for a genuine reason (the system prompt at `4241` explicitly asks for live local business/price/stock lookups). But that is a **minority** of questions, and there is no gate.
- **Cost if made conditional** (fire search only on live-info intent, ~15% of questions): persona C **$2.83 → $0.99**, persona B **$0.67 → $0.17**. **A 3–4× cost reduction from one conditional.**
- This is also the app's #3 hallucination surface per `W1-F-ai.md §3` — narrowing it improves safety *and* margin simultaneously.

### 🔴 2. The free grounded-search allowance is per-project, not per-user
1,500 RPD free is a property of **the owner's single managed key**, shared by the whole user base: **45,000 grounded prompts/month total**.

| Persona mix | Users covered before $0.035/call begins |
|---|---|
| all Persona A | 6,428 |
| all Persona B | 2,647 |
| all Persona D | 1,730 |
| **all Persona C** | **725** |

Cost is **$0 up to that line and then steps to full rate.** Any pricing built on early free-tier experience will misprice at scale.

### 🔴 3. The Worker's token cap is blind to ~90% of the cost
`worker/index.js:76` meters `usageMetadata.totalTokenCount`. Grounding is a per-request fee and appears in no token counter.
- Default cap 2,000,000 tokens (`scripts/central-code.mjs:35`).
- At ~4,850 tokens per Ask-the-Fire round trip, that is **412 grounded calls**.
- **412 × $0.035 = $14.43 of grounding fees the cap never sees**, on top of ~$1.60 of tokens.
- **The 2M-token cap therefore authorises ~$16/month per code, and meters ~10% of it.**
- `carol 0` (uncapped, `worker/README.md:58`) has no ceiling of any kind.

### 🟠 4. No rate limiting anywhere — client or server
Verified by grep: the only `debounce` in `app.js` is on the catalog search box (`2781`) and the only `throttle` is a storage warning (`1441`). **No AI call path is throttled, debounced, or deduplicated**, and `W1-F-ai.md §7` confirms the Worker has no per-minute limit either.
- One leaked code, tapped at 1 req/sec: **$126/hour** in grounding fees.
- The 2M token cap only intervenes after ~7 minutes of that.
- Separately, MT hydration issues **one HTTP request per string** with no batching (`hydrateMT` `6987` → `mtTranslate` `6962`); 52 strings fire on the boot screen alone, up to **1,654 for the full catalog** — a burst pattern against a Worker whose KV counter is documented as eventually consistent (`worker/index.js:76`), i.e. exactly the TOCTOU window `W1-F-ai.md §7` flags.

### 🟠 5. TTS silently bills the **owner**, not the user — verified at runtime
`gemSpeak` (`5025`) gates on `if(!gemKey()) throw` — i.e. it requires the user to have a *personal* key. But it then calls `gemFetch` **without** `opts.key`, so routing falls to `gemMode()` (`5011`), which **prefers managed**.

Runtime proof (fetch intercepted, both credentials configured):
```
gemMode() === 'managed'
TTS request → https://worker.example.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent
             X-Access-Code: present · x-goog-api-key: absent
```
**A user who has both a personal key and a managed access code has their premium TTS billed to the owner's key at $10/1M audio tokens** — while the code reads as though the personal key gates it. Voice Cook calls `vcSpeak` from ~18 sites (`5143, 5144, 5160, 5161, 5167, 5291, 5296, …`), so this is the app's highest-frequency speech path.
- 1 hour of continuous Voice Cook speech = **$0.90**.
- `gemCache` (`5004`) caps at 40 entries and is in-memory only — lost every reload.

### 🟡 6. Failure paths bill twice — measured
Instrumented at runtime (fetch stubbed, attempts counted):

| Scenario | HTTP attempts |
|---|---|
| `askGemini` on 503 | 2 |
| `aiJSON` on 503 | 2 |
| **`aiJSON` on HTTP 200 with an empty candidate** (`MAX_TOKENS`/`SAFETY`) | **2** |
| `aiJSON` on 400 | 2 |
| `askGemini` on HTTP 200 empty | 1 |

The third row is the costly one: an HTTP-200 response with an empty candidate **was generated and billed**, and `aiJSON` (`4374`) retries it. For the two grounded `aiJSON` callers (`6337`, `6373`) a single 400 costs **$0.07** — two grounded prompts for one user tap.

### 🟢 7. Photo analysis — a real defect, but *not* a cost cliff
`openPhotoAnalyze` (`9310`) reads the file with raw `readAsDataURL` and sends it **undownscaled**. The `downscale()` helper exists at `3593` (max dimension 360px) but is wired **only** to the journal (`3587`) — the AI path never calls it.
Financially this is minor: Gemini's tiling rule caps a 4032×3024 photo at ~1,548 image tokens ≈ **$0.0005**. The real costs are bandwidth and Worker CPU on a ~4–8 MB base64 body. **Worth fixing for latency and Worker load, not for margin.** I am explicitly *not* calling this a cost cliff; the measurement does not support it.

---

## 6. Gross-margin floor

Net of Stripe (2.9% + $0.30):

### As the code stands today
| Price/mo | Net | GM vs worst persona (C, $2.83) | GM vs blended ($1.22) |
|---|---|---|---|
| $2.99 | $2.60 | **−8.7%** ❌ *loses money* | 53.2% |
| $4.99 | $4.55 | 37.7% | 73.2% |
| $7.99 | $7.46 | 62.0% | 83.7% |
| $9.99 | $9.40 | 69.9% | 87.1% |

### After making `google_search` conditional (the single highest-leverage fix)
Worst persona $0.99, blended $0.39:

| Price/mo | Net | GM vs worst | GM vs blended |
|---|---|---|---|
| **$4.99** | $4.55 | **78.3%** | **91.5%** |
| $7.99 | $7.46 | 86.8% | 94.8% |

### Verdict — minimum viable price

> **$4.99/month is the floor. $7.99 is the defensible price.**

Reasoning:
1. **$2.99 is not viable today** — it is gross-margin *negative* against an enthusiast in Voice Cook mode. A single power user on a $2.99 plan loses money before any hosting, Stripe dispute, or support cost.
2. **$4.99 clears a 70% SaaS gross-margin bar only *after* the search-conditional fix** (78.3% worst-case). Without it, $4.99 yields 37.7% against persona C — below the 75–85% SaaS norm and with no headroom for usage drift.
3. **$7.99 is safe in both worlds** (62% worst-case today, 87% after the fix) and is the price to launch at if the fixes are not shipped first.
4. **Any flat plan needs a metered ceiling.** With no rate limit anywhere, the tail is unbounded: cliff #4 shows $126/hour is reachable. A flat price is only honest with a per-user grounded-prompt budget enforced *in dollars*, not tokens.

**Cheapest path to a healthy $4.99 tier, in order of leverage:**
1. Gate `google_search` behind a live-info intent check (reuses the `askSafetyIntent` pattern already at `4114`) — **3–4× cost cut**, and closes hallucination surface #3.
2. Meter **cost**, not tokens, in the Worker: count grounded requests separately from `totalTokenCount`.
3. Force TTS to BYOK by passing `{key:gemKey()}` in `gemSpeak`'s `gemFetch` call — makes the existing `if(!gemKey())` guard mean what it appears to mean.
4. Add a per-code request rate limit (`W1-F-ai.md §7` already lists this as required pre-launch).
5. Batch MT hydration into one request per screen instead of one per string; move the cache server-side so 1,654 fields are translated **once per language for everyone**, not once per device.

---

## 7. What I could not verify — stated, not softened

- **Search-injected input volume.** Google does not publish how many tokens retrieved web content adds. Modelled at 3,000 tok/grounded call. *Immaterial:* at 0 or 10,000 the search **fee** ($0.035) still dominates.
- **Grounded-prompt billing trigger.** Google's page bills per "grounded prompt". Whether that means *tool attached* or *tool invoked* is not stated unambiguously. **Both readings are expensive here**, because the tool is attached unconditionally on every conversational call — under the stricter reading the fee is simply gated on model behaviour the app does not control.
- **Typical output lengths** are modelled (400–900 tok) against the measured `maxOutputTokens` ceilings. No production telemetry exists to confirm the distribution — the app has no usage instrumentation.
- **Hebrew tokens/char** is an assumption (2.0 ch/tok), sourced but not measured against Gemini's own tokenizer. Shown above to move the total by <10%.
- **Persona call mixes are constructed, not observed.** There is no analytics in the app. They are the model's softest input; the per-call costs beneath them are hard measurements.

---

*Model: `unit_econ.py` (scratchpad). Measurements: Playwright runtime evaluation against the built `index.html`. Pricing: ai.google.dev/gemini-api/docs/pricing, 2026-07-22. Cross-refs: `W1-F-ai.md`, `worker/index.js`, `scripts/central-code.mjs`, `docs/ai-strategy.md`.*
