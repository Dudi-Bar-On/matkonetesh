# Resume Prompt — Wave 4 Strategy Discussion

> **How to use:** paste the block below into a fresh Claude Code session in this repo to pick up exactly where we left off. It assumes the session also loads the auto-memory (MEMORY.md / ai-arc.md) as usual.

---

We're mid-way through a **strategy discussion** for **Matkonet · Fire Guide** (Hebrew-first, offline, single-file fire-cooking PWA; `build.py` inlines `app.js`+`app.css`+Python data → `dist/index.html`; deployed to Cloudflare Pages; BYOK Gemini AI). The **AI arc Waves 1–3 are already shipped** (v214–v228, current HEAD) — trust/safety, Live Cook Copilot, and delight features. See memory `ai-arc.md`.

**What we did:** the owner brought four subjects to the table to discuss one-by-one → decide → build a mini roadmap + implementation plan. I ran four expert deep-research reports (web-sourced, 2026-07-15), now committed under **`docs/research/`**:
- `02-ai-platforms.md` — AI platform & models (Gemini vs alternatives, cost, MoE/reasoning).
- `03-tts.md` — TTS for Hebrew (cloud + offline, costs, customization).
- `04a-architecture.md` — technical architecture (PWA vs native, Cloudflare, sync, IP protection).
- `04b-business.md` — billing, distribution, app-store, IP/business, cloud-sync law.
- `README.md` — **index + one-line verdicts + the two-bucket roadmap + open decisions. READ THIS FIRST.**

**The state of play (from `docs/research/README.md`):** the three research subjects converge into ONE plan that clusters into two buckets:
- **Bucket A (build now, no server):** Subject-1 features (Cookout Orchestrator / Conversational Menu Designer / Wood & Rub Advisor / Shopping-Butcher Intelligence) + app-side TTS upgrades (provider+voice picker, better Web-Speech handling, curated AI-model selector) + optional Phase-2 offline neural Hebrew voice.
- **Bucket B (Wave 4 business layer, needs a Cloudflare Worker + owner decisions):** managed-AI proxy + `/sync` on the existing `GEM_HOST` seam → BYOK stays free, paid "Fire Guide Pro" (turnkey Gemini + cloud sync + premium data) → Paddle billing → Google Play TWA.

**Open decisions blocking the roadmap:**
1. Subject 1 — which features to build first?
2. Wave 4 go/no-go — pursue the paid managed tier now, or stay app-side-only?
3. If Wave 4 — pricing shape, launch timing, Hebrew-eval + Paddle confirmation.

**Immediate next step:** continue the one-by-one discussion to get the owner's decisions, then produce the mini roadmap + implementation plan. **Do NOT start building** until decisions are made and a roadmap is agreed. Honor the owner's working style: autonomous phase-by-phase implementation once approved, ship as vNNN, test with Playwright in Hebrew + English, run the suite twice green before shipping (see memory `testing-discipline`).

**Working facts to remember:**
- Deploy = commit to main + tag vNNN + push (see memory `matkonet-deploy-workflow`). Repo: https://github.com/Dudi-Bar-On/matkonetesh.git
- Test infra: `node serve.js <port>` static server + `reuseExistingServer:false` (NOT Python http.server — it hangs under load).
- `node --check app.js` as a parse pre-flight before shipping.
- Owner's probe/SV gear: MEATER Pro XL, Inkbird latest probe, Inkbird ISV-300W sous-vide.
- **Re-verify** all model/TTS prices + store fees at build time (they move); run a Hebrew eval before locking the default model.
