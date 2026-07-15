# Research — AI Platform & Model Strategy (Subject 2)
*Consolidated from 5 per-provider sub-experts. Prices/lineups verified ~14–15 Jul 2026 — re-verify before committing budget.*

## ⚠️ Read-first caveats
1. Model landscape churned in 2026 — current SKUs: Gemini 3.5 Flash / 3.1 Flash-Lite / 2.5 (Flash-Lite/Flash/Pro), GPT-5.6 (Luna/Terra/Sol) + 5.4 nano, Claude Opus 4.8 / Sonnet 5 / Haiku 4.5, DeepSeek V4, Qwen 3.5–3.7, Mistral Large 3 / Small 4, Grok 4.5. Prices move monthly.
2. **No provider publishes a Hebrew-specific benchmark.** Every "Hebrew" rating is *directional* (inferred from Arabic proxies, DICTA's judge-model choice). **Run your own small Hebrew eval before finalizing.**
3. Cost numbers use an explicit workload model (recompute with real call counts).

## 0. Verdict
**Yes — Gemini is the right primary platform, and it's not close.** Not because one model wins every axis, but because Gemini is the *only* platform bundling all six needs into one BYO-key API: (1) frontier Hebrew, (2) **native Google Search grounding with a big free tier**, (3) vision, (4) native TTS, (5) cheapest small-call tiers (Flash-Lite $0.10/$0.40/1M), (6) thinking budgets + ~90% caching + 50% batch. Competitors force 2–3 vendors and still charge for web search Gemini gives free.

**Cheap-default + escalate:** default everything → **Gemini 2.5 Flash-Lite** (thinking off); auto-escalate only *diagnosis* + *event-planning* to **2.5 Flash / 3.5 Flash** (thinking on); vision on Flash/Flash-Lite; ground only when needed.

**Managed tier cheapest safe path:** keep BYOK free; for paid, put a **thin zero-markup gateway (Cloudflare AI Gateway or self-hosted LiteLLM)** in front of *your* Gemini key + per-user spend caps + response caching. ~$0.07–0.20 raw model cost per active user/mo.

## 1. Six-requirement scoring
| Requirement | Gemini | OpenAI | Anthropic | Open-weight |
|---|---|---|---|---|
| Hebrew | ✅ frontier (DICTA HE judge) | ✅ frontier (GPT-4o HE judge) | 🟨 likely (Arabic 97% proxy) | 🟨 Mistral best-of-open; others weak |
| Grounded Q&A | ✅ **native, cheap, big free tier** (5,000/mo free; **1,500/day free per project**) | 🟨 $10/1k, no free | 🟨 $10/1k, no free | ❌ build your own |
| Reasoning | ✅ thinking every tier | ✅ 6 effort levels | ✅ adaptive (not Haiku) | 🟨 varies |
| Vision | ✅ all tiers cheap | ✅ all tiers | ✅ all tiers | 🟨 some; **DeepSeek API none** |
| Cost (small calls) | ✅ **cheapest** (Flash-Lite $0.10/$0.40) | 🟨 nano $0.20/$1.25 | ❌ Haiku $1/$5 (5–12× pricier) | ✅ can undercut, lose HE+grounding |
| TTS | ✅ native (2.5 Flash TTS $0.50/$10) | ✅ gpt-4o-mini-tts ~$0.015/min | ❌ none | ❌ none |

**Decisive factor = grounding economics × BYOK:** Google gives 1,500 grounded searches/day *free per project*; under BYOK each user's own key gets its own free quota → grounded Hebrew Q&A is **effectively free to you**. No competitor matches this.

### Model → task
| Task | Model | Thinking | Ground | Why |
|---|---|---|---|---|
| Grounded Q&A | 2.5 Flash-Lite (→3.1 FL for $14/1k grounding) | off | on | retrieval+format |
| Recipe JSON | 2.5 Flash-Lite structured | off | off | deterministic |
| Diagnosis | 2.5 Flash (→3.5 hard) | low→med | off | multi-step reasoning |
| Event planning | 3.5 Flash (→2.5 Pro hardest) | med→high | opt | constraint satisfaction |
| Vision (bark/doneness) | 2.5 Flash (FL easy; 3.5 subtle mold) | off | off | image tokens cheap |
| Journal insight | 2.5 Flash-Lite (Batch, overnight) | off | off | non-interactive → −50% |
| TTS | 2.5 Flash TTS — *but consider on-device Web Speech* | — | — | audio tokens = hidden cost |
Note: Gemini 3.5 Pro not yet GA / no official price — don't plan costs around it.

## 2. Capability needed (reasoning inverted-U)
Explicit "thinking" helps hard multi-step problems, *wastes tokens or hurts* on easy ones (5–20× slower, overthinking). MoE context: cheap models (DeepSeek V4, Llama 4, Qwen3, Mixtral) activate only ~5–28% of params/token → capable-but-cheap. **~80% of this app's calls (Q&A, recipe, journal, easy vision) need only the cheapest tier, thinking off.** Reserve thinking + step-up for diagnosis, planning, and mold/food-safety vision (where *under*-spec is the risk).

## 3. Cost at scale + levers
Workload/user/mo (moderately heavy): ~45.7k in + 43.2k out text tokens + 20 grounded searches + ~10 TTS calls.
Per active user/mo (Gemini): **A** all-2.5-Flash+FlashTTS ≈ $0.24 · **B** tiered+FlashTTS ≈ $0.19 · **C** tiered+**on-device TTS $0** ≈ **$0.07**. Two findings: tiering ~halves text cost; **paid TTS ≈ all text combined** → on-device TTS roughly thirds total.

Managed proxy (shared key) totals/mo: 100 users ≈ $19 (grounding free under 5,000); 1,000 ≈ $396; 10,000 ≈ $4,590 — **grounding = 60–80% of bill at 10k**. BYOK keeps grounding free per user.

**Levers ranked:** (1) cut/cache web-search grounding + local RAG over own recipe corpus (~60% at scale) · (2) model tiering (40–85%; RouteLLM ~85% cut/95% quality) · (3) on-device TTS (~50% of total) · (4) output-token discipline (outputs cost 5–8×) · (5) context caching (~90% off cached input, on by default 2.5+) · (6) Batch API (−50%) · (7) app-side response cache · (8) keep BYOK for power users.

## 4. Alternatives (per 1M tok, ~14–15 Jul 2026)
- **OpenAI** — closest all-rounder; strong HE, vision, 6-level reasoning, ~1M ctx, cache 10%, batch −50%. Cheapest useful GPT-5.4 nano $0.20/$1.25. Web search $10/1k no free. TTS gpt-4o-mini-tts ~$0.015/min. No per-key spend cap.
- **Anthropic** — great engineering, per-workspace spend caps (best for managed), 1M ctx no surcharge. **But cheapest Haiku 4.5 = $1/$5 (5–12× pricier)**, no native TTS, web search $10/1k, ~30% more tokens from new tokenizer. Escalation/benchmark only.
- **Open-weight:** **Mistral Small 4 $0.15/$0.60 (vision+reasoning, EU) = best open Hebrew** (DICTA built DictaLM on Mistral); Large 3 $0.50/$1.50. DeepSeek V4-Flash $0.14/$0.28 cheapest reasoning but **no vision/grounding, no HE evidence, CN residency**. Qwen very cheap, middling HE. Llama 4 Scout good HE comprehension/weak generation, being deprecated. Groq/Cerebras = latency plays. **Grok 4.5 = weakest HE, avoid.**
- **Self-host:** not worth it solo (H100 ~$1,800–2,000/mo, break-even ~$4,200/mo API spend).
- **Managed-proxy buildability:** Gemini/OpenAI/Mistral/DeepSeek trivial single-key proxy; Anthropic richest caps but can't mint keys programmatically; OpenRouter/LiteLLM/Vercel AI Gateway/Cloudflare AI Gateway all front one upstream key with per-user virtual keys+budgets.

## 6. Recommendation
Stay Gemini. Implement cheap-default+escalate in the call layer: (1) default 2.5 Flash-Lite thinking off, tight max_tokens; (2) escalate to 2.5 Flash (thinking low→med) for diagnosis + ambiguous/mold vision; (3) 3.5 Flash/2.5 Pro for event-planning + hard diagnosis; (4) ground selectively — try local corpus + response cache first, prefer 3.x model for grounded calls ($14/1k + 5,000/mo free); (5) batch journal/bulk (−50%); (6) cache shared system prompt/schema (~90% off input); (7) TTS default to on-device Web Speech ($0), paid Gemini TTS as premium upgrade — **verify Gemini TTS Hebrew quality on real devices first**.

Managed tier: keep BYOK free (free grounding+credits per user = real product advantage); paid = front your single Gemini key with **Cloudflare AI Gateway** (per-user dollar caps, edge cache, ~$5/1M req; lowest-ops) or **LiteLLM self-hosted** (richest per-user virtual keys/budgets, ~$20–50/mo VPS) or **Vercel AI Gateway** (zero markup, per-user caps, easiest). Meter+cap per user; never hand out raw keys.

**Close the loop:** run an afternoon Hebrew eval (recipe gen, diagnosis, nikud-sensitive text, unit conversion) across Gemini 2.5 Flash-Lite vs 2.5 Flash vs GPT-5.4 nano vs Mistral Small 4 — de-risks the biggest unverifiable assumption.
