# Research — Technical Architecture (Subject 4a)
*Expert report, web-sourced, verified against primary docs 2026-07-15. Read the actual codebase (single `index.html` = 2.42 MB built by build.py; localStorage-only; BYOK Gemini via `gemFetch`; the `GEM_HOST` monetization seam at app.js:3117-3120).*

## TL;DR
**Stay a PWA. Host the single file on Cloudflare Pages (free). Add ONE Cloudflare Worker ($5/mo) as *both* the managed-AI proxy *and* the sync endpoint. Use D1/KV (included in that $5) for metering + per-user journal blobs. Ship to Google Play now via Bubblewrap TWA ($25 one-time). Defer iOS App Store / Capacitor until IAP revenue justifies it.**
- Migration cost is low and mostly forced anyway: to get *either* a store listing *or* a proxy, the app must live at a real origin (not a file you open). Deploying to Pages unlocks both.
- **No CRDTs needed** — journal/projects are one user's data across their devices, not collaboration. Last-write-wins on timestamped blobs is enough and far simpler.
- ~100 subscribers ≈ **$105–130/mo, dominated by Gemini COGS** (scales with paying users). Infra floor ~$5/mo.
- Source/data protection is a strategy problem, not a code problem — gate premium data behind the proxy; obfuscation only buys hours.

## 1. PWA vs native/hybrid
- **Google Play accepts PWAs cheaply** via TWA (Bubblewrap CLI / PWABuilder GUI): $25 one-time, needs Lighthouse ≳80 + manifest + service worker + `assetlinks.json`.
- **Apple does NOT accept raw PWA wrappers** — Guideline 4.2 (Minimum Functionality) rejects them; needs genuine native elements.
- **But you reach iPhone users without the App Store:** iOS 16.4+ Web Push for home-screen PWAs; Safari 18.4 added Declarative Web Push + **Screen Wake Lock** (keeps screen on during a 12h cook — directly useful for Copilot).
- **Capacitor** = cheapest bridge *later* when you truly need Apple App Store + native IAP (drops into existing web app, keeps ~all code).
- **React Native (rewrite) and Tauri (desktop-first, mobile immature) are wrong tools here.**

Verdict: **Stay a PWA.** TWA on Play now; installable PWA on iOS; Capacitor for Apple later.

## 2. Minimal backend = ONE stateless Worker, two routes
**(a) `/ai` managed-AI proxy:** authenticates caller → meters usage (per-user counter, monthly cap) → injects Gemini key server-side → re-applies grounding/validation contract server-side (moves the safety discipline behind a boundary users can't bypass) → streams response. Can run on Workers Free (100k req/day) until sync/metering durability needed.
> **Must use PAID Gemini API for managed tier** — Google's free tier trains on user prompts (unacceptable for a paid product with personal data). So managed-tier Gemini calls are real COGS.

**(b) `/sync` (optional, opt-in):** single-user-multi-device, so no CRDTs. `PUT /sync` uploads journal/projects tagged `updatedAt`+deviceId; `GET /sync?since=` pulls newer; **last-write-wins** resolves rare conflicts. Store each user's data as an opaque (optionally client-encrypted) blob keyed by user id. localStorage stays source of truth; sync is background reconcile.

**Do NOT need:** persistent server, container, ORM, k8s, queue, separate auth service. Billing provider hands back a signed token the Worker verifies.

## 3. Hosting + cost
| Job | Cheapest fit | Why |
|---|---|---|
| Static PWA | **Cloudflare Pages (Free)** | Unlimited bandwidth; 2.4 MB file trivial |
| AI proxy | **Cloudflare Workers** | Free 100k req/day; Paid **$5/mo** → 10M req + 30M CPU-ms; **no egress ever**; CPU billed only while running (waiting on Gemini fetch is free) |
| Sync storage | **Cloudflare D1** (or KV) | Included in same $5; D1 free 5M reads/day, 5GB |

**One $5/mo Cloudflare bill covers all three, zero egress.** Vercel/Netlify/Deno start ~$20/mo for commercial use + meter egress; Vercel Hobby forbids commercial use; Netlify credit model pauses at cap; Fly.io = running a server you don't need. **Cloudflare wins unambiguously** and matches the existing seam.

Complements: Turso (generous free, per-user DB isolation option), Supabase (Pro $25/mo, pauses after 7d idle — landmine), Firebase (most lock-in). For this app **D1 keeps everything on one bill**.

## 4. Persistence + sync
1. **Now:** encrypted **export/import** (single JSON download/upload) — zero infra, kills "I lost my journal" fear, selling point.
2. **Paid tier:** opt-in **cloud sync on Cloudflare D1**, blob per user id, LWW on `updatedAt`, same $5 account.
3. **Privacy:** store **client-side encrypted** (key from user passphrase) so even you can't read it → advertise "end-to-end encrypted journal" as a trust feature (consistent with BYOK/offline positioning). Israeli PPL Amendment 13 + GDPR apply once you store user data.

## 5. IP / source protection (honest)
Anything shipped to a browser (JS + curated DATA) is fully extractable; no client-side technique changes that.
- Minification/obfuscation → raises cost minutes→hours; **never ship source maps**; speed-bump not wall.
- **Move premium DATA behind the authenticated proxy for paid tiers = the only real technical protection** (non-subscribers never receive the premium corpus; rate-limit + watermark to bound a determined subscriber).
- Licensing/ToS = legal basis; watermark/canary rows = prove + trace copying for takedowns.
- **Strategic truth:** durable moat = iteration speed + trust/citations + brand + managed-AI experience, NOT data secrecy. Keep the free catalog *visible and cited* (that's the marketing moat); server-gate only the newest/deepest premium curation.

## 6. Cost at small scale
Assumptions: ~100 subs × ~150 managed calls/mo, ~2.5k in + ~800 out tokens on gemini-2.5-flash ($0.30/M in, $2.50/M out).
| Line item | ~100 subs | Launch (<20 subs) |
|---|---|---|
| CF Pages (static) | $0 | $0 |
| CF Workers Paid (proxy + D1 + metering) | $5 | $5 |
| Gemini API (COGS ~$1/sub) | ~$100 | ~$5–20 |
| R2 (photos, 10GB free) | $0–2 | $0 |
| Domain | ~$1 | ~$1 |
| Payment processor | 3–5% rev | negligible |
| **Total infra** | **≈ $105–130/mo** | **≈ $5–25/mo** |
Economics: 100 subs × ₪199/yr ≈ ~$440/mo revenue vs ~$110/mo infra → **~70%+ gross margin**; dominant cost (Gemini) is COGS that grows only with paying users. Levers: route quick Q&A to gemini-2.5-flash-lite ($0.10/$0.40, 3–6× cheaper), reserve 2.5-pro/thinking for Diagnose & Copilot, cache responses, enforce per-user monthly cap in the Worker.

## 7. Build order (each independently shippable)
1. Deploy single file to **Cloudflare Pages** + add manifest & service worker (unlocks installable PWA, TWA, proxy origin).
2. **Encrypted export/import** for the journal (zero-infra safety net).
3. **Bubblewrap → Google Play** ($25).
4. **Worker `/ai` proxy** — flip managed-tier GEM_URL to it; add auth + metering. *This is the paid product.*
5. **Worker `/sync` + D1** — opt-in, LWW, client-encrypted blobs.
6. **Later:** Capacitor iOS + Apple IAP once revenue justifies clearing 4.2.

Payments delegated to Stripe/Paddle/Lemon Squeezy → Worker only verifies a signed token, so no PII/payment data touches your infra.
