# Wave 4 Research & Strategy — Index

**Status:** all four expert research reports complete (web-sourced, dated 2026-07-15). Awaiting owner decisions → then a mini roadmap + implementation plan. **No building started on these subjects yet.**

This folder holds the deep-research reports that back the next strategic decisions for **Matkonet · Fire Guide** (the Hebrew-first, offline single-file fire-cooking PWA). The AI arc **Waves 1–3 are already shipped** (v214–v228, HEAD). These reports inform **Subject 1 (more features)** and **Wave 4 (the business/managed-AI layer)**.

## The four subjects the owner brought to the table
1. **More app features** — build more Tier-2 product/AI features (no research needed; candidates below).
2. **AI platform & models** — is Google/Gemini best? which model? reasoning/MoE? cost + how to pay less? alternatives? → **[02-ai-platforms.md](02-ai-platforms.md)**
3. **TTS** — best Hebrew, performant; local/offline viable? costs? provider/voice + AI-model customization → **[03-tts.md](03-tts.md)**
4. **Architecture + business** — stay PWA? server? Cloudflare? cost? standalone-vs-Matkonet? billing? app-store distribution? IP protection? cloud sync? → **[04a-architecture.md](04a-architecture.md)** + **[04b-business.md](04b-business.md)**

## Verdicts in one line each
- **AI (Subj 2):** **Stay on Gemini** — only platform bundling frontier Hebrew + native cheap grounding (1,500 free searches/day *per project* → free under BYOK) + vision + TTS + cheapest small-call tiers (Flash-Lite $0.10/$0.40/1M) + thinking/caching/batch. **Cheap-default (2.5 Flash-Lite) + escalate** diagnosis/planning/mold-vision to Flash/3.5. ~$0.07–0.20 raw model cost per active user/mo. Managed tier = thin zero-markup gateway in front of *your* key. **⚠️ Run a small Hebrew eval before locking the default** (no public Hebrew benchmark exists).
- **TTS (Subj 3):** **Keep Google default** (Gemini TTS or Cloud Chirp3-HD he-IL, 30 voices). **ElevenLabs v3 = best Hebrew, offer as BYO-key premium.** **Web Speech API = free/offline fallback** (already used). **🆕 Good *offline neural* Hebrew now achievable** (Phonikud + Israwave/Piper via sherpa-onnx WASM) → Phase-2 opt-in download. Expose **TTS provider+voice** to users; expose only a **curated** AI-text-model selector (Gemini default; OpenAI/Claude BYO behind "Advanced"). **Avoid OpenAI TTS (American accent) + Polly (no Hebrew).**
- **Architecture (Subj 4a):** **Stay a PWA.** One **Cloudflare Worker** ($5/mo, no egress) on the existing `GEM_HOST` seam (app.js ~3117) = managed-AI proxy **+** sync endpoint. **Google Play TWA now** ($25), **defer Apple** (Guideline 4.2). Sync = **last-write-wins blobs, client-encrypted** (no CRDTs — it's one user's data across devices). ~$105–130/mo at 100 subs, ~70% margin (Gemini COGS dominates, not infra).
- **Business (Subj 4b):** **Web-first.** **Paddle** as Merchant-of-Record (Stripe effectively unavailable to an Israeli sole-proprietor without a US entity; Paddle onboards Israel + absorbs 18% VAT). **Ship standalone, build backend as the first Matkonet module** (identity + entitlements + AI-gateway = same proxy). Moat = curated data + vetted AI **gated behind the proxy**, not code secrecy. Cloud sync = good paid hook but triggers Israeli PPL Amendment 13 / GDPR → opt-in, encrypted, export/delete.

## The convergence → a two-bucket roadmap
The three research subjects do **not** fork — they converge into one plan. It clusters into:

**🟢 Bucket A — buildable NOW (no server, no business risk, ships as vNNN):**
- **Subject-1 features** (menu below).
- **App-side TTS upgrades:** pluggable provider+voice picker; better Web-Speech handling (iOS user-gesture rule, next-step pre-synthesis, phrase caching in IndexedDB); curated AI-text-model selector. All client-side.
- *(Optional Phase-2)* offline neural Hebrew voice (Phonikud + Israwave/Piper via sherpa-onnx WASM) as an opt-in download.

**🔵 Bucket B — Wave 4, the business layer (needs the Worker + owner business decisions):**
- One **Cloudflare Worker** on the `GEM_HOST` seam = managed-AI proxy **+** `/sync` → **BYOK stays free**, paid **"Fire Guide Pro"** = turnkey Gemini (no key) + cloud sync + premium data → **Paddle** billing → **Google Play TWA**. Monetization unlock, but a real project + business commitment (pricing, tax, launch timing).

## Subject-1 feature candidates (Tier-2, all grounded in existing systems)
1. **Cookout Orchestrator** — coordinate a whole multi-dish cookout on one grill/smoker into a live timeline (extends event planner + backward scheduler + Live Copilot).
2. **Conversational Menu Designer** — "hosting 8, Texas-style, mid budget" → full grounded menu → straight into a plan.
3. **Wood & Rub Advisor** — cut + flavor goal → wood + rub/brine from the catalog *with the why* (deepens pairing advisor).
4. **Shopping / Butcher Intelligence** — plan/menu → butcher-ready list: cut names (HE/EN), quantities per guest count, "what to ask the butcher."
- Plus the app-side TTS features above (voice/provider picker, offline HD Hebrew voice).

## Open decisions (what's blocking the roadmap)
- **Subject 1:** which features to build first?
- **Wave 4 go/no-go:** pursue the paid managed tier now, or stay app-side-only for now?
- If Wave 4: pricing shape (Free BYOK + single Pro tier, monthly+annual), launch timing, and the Hebrew-eval + billing-provider (Paddle) confirmations.

## Caveats carried from the research (re-verify before building)
- Model/TTS **prices + store fees change monthly/quarterly** — re-verify vendor pages at build time.
- **No public Hebrew benchmark** — run a real-prompt Hebrew eval (Flash-Lite vs Flash vs GPT-nano vs Mistral Small 4) before locking the default model.
- **Apple US external-link fee** unsettled (live remand Dec 2025); **Google 10%+5%** model rolling out through Sep 2026; confirm **Paddle Israel** onboarding directly.

---
*See **[RESUME-PROMPT.md](RESUME-PROMPT.md)** to continue this work in a fresh session.*
