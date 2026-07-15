# Research — Business & Go-to-Market (Subject 4b)
*Expert report, web-sourced. Research current as of July 2026. Re-verify Apple/Google fees + court rulings before launch — they change quarterly.*

## Bottom line
- **Stay web-first.** Sell the Managed-AI subscription on your own web PWA — the only path where a solo owner keeps ~95% of revenue, ships in days, and answers to no reviewer.
- **Billing: Paddle as Merchant-of-Record.** Highest-leverage decision for an Israeli solo owner: Paddle onboards Israeli sellers directly (Stripe effectively does not without a US entity), and as MoR it removes Israeli 18% VAT + EU VAT + global sales-tax entirely.
- **Distribution: PWA now; add a Google Play TWA wrapper later (cheap, low-risk) for discovery. Skip Apple until proven demand** (Guideline 4.2 rejection risk, 15–30% cut you can't cleanly route around on iOS).
- **Moat = curated DATA + vetted AI, not code.** The client is copyable; accept it. Protect value by keeping premium data + the managed-AI key behind an auth-gated server proxy — the same proxy planned for Wave 4.
- **Ship standalone, but build the backend as the first Matkonet module.** One thin "identity + entitlements + AI-gateway" service. Standalone product, ecosystem-ready backend, no rework later.

## 1. Standalone vs Matkonet module
The real question is *where you put the auth + billing + AI boundary*. Get it right and standalone-vs-integrated becomes a marketing decision, not a rewrite. Build 3 thin shared services from day one: **Identity** (email magic-link → JWT), **Entitlements** (single table: does this account have Managed-AI/sync/pro?), **AI gateway** (proxy holding the Gemini key + premium prompts/vetted data, checks entitlement, meters usage; Wave-1 safety enforced server-side). The cooking app calls those 3; any future Matkonet module calls the same 3 — that's the whole integration. **Recommendation: standalone product, ecosystem-ready backend** — you need that proxy for Managed-AI regardless.

## 2. Billing — the MoR concept decides everything
A **Merchant of Record** (Paddle/Lemon Squeezy/Apple/Google) is the legal seller: they calc, collect, remit consumption tax everywhere. **Stripe is NOT a MoR** — VAT registration/remittance in every country is your problem. Israel raised VAT to **18% on 1 Jan 2025**; foreign digital sellers must register + file bi-monthly. An MoR absorbs all of it (income tax on payout still yours).

**Israel availability (decisive):** Stripe not officially available to Israeli businesses (common workaround = US LLC + Stripe Atlas). **Paddle: Israel supported, pays out by wire/Payoneer.** Lemon Squeezy: MoR but **Stripe-acquired 2024, roadmap frozen Aug 2025 → avoid for new builds.**

| Provider | Headline fee | MoR/VAT | Solo-friendliness | Israel payout | Notes |
|---|---|---|---|---|---|
| Stripe | 2.9%+$0.30 | ❌ you remit VAT everywhere | Powerful, you own compliance | ⚠️ needs US entity | Lowest %, highest compliance load |
| **Paddle** | 5%+$0.50 flat | ✅ handles IL 18%+EU+global | ✅ highest — tax offloaded | ✅ wire/Payoneer | **Best fit for solo Israeli owner** |
| Lemon Squeezy | 5%+$0.50 +1.5% intl | ✅ | was excellent | ✅ | ⚠️ Stripe-owned, winding down |
| RevenueCat | Free <$2.5k MTR, then 1% | ❌ sits on top of IAP/own web billing | ✅ if native later | via underlying | Best cross-platform entitlement layer |
| Apple IAP | 15% (SBP, opt-in) / 30% | ✅ Apple MoR | iOS-locked | Apple pays | Mandatory for in-app digital goods on iOS |
| Google Play | from 30 Jun 2026: 10% + 5% billing (≈15%); **0% billing if external billing** | ✅ Google MoR | Android-locked | Google pays | External-billing keeps the 5% |

**Web billing avoids the store cut entirely** — commission only attaches to in-app purchases. **Cleanest setup: web PWA subscription via Paddle now; add RevenueCat only if/when you ship native.**

## 3. Distribution
- **PWA (add-to-home-screen):** 0% cut, no review, instant updates. iOS install is manual (Share→Add) — teach it in RTL. iOS capabilities now good: **Web Push since iOS 16.4**, **Screen Wake Lock since Safari 18.4** (directly useful for hands-free Voice-Cook + long timers).
- **Google Play TWA (Bubblewrap):** Google-endorsed, low review risk. Needs HTTPS + manifest + Lighthouse ≥80 + Digital Asset Links. Keep app free + sell subscription on web → no Play billing, no cut.
- **Apple App Store (wrapped):** Guideline **4.2 "Minimum Functionality"** wall — thin wrappers get rejected; needs genuine native elements + several rejection cycles. Mac + Xcode + $99/yr. IAP mandatory for in-app digital goods.
- **Regulatory (moving):** US Epic v. Apple — as of 11 Dec 2025 (9th Cir. remand) Apple can't charge commission on US external-link purchases pending a "reasonable fee" determination; unsettled. EU DMA in force; Google's Jun-2026 model is its response.

| Channel | Reach | Cut | Review risk | Effort | IAP req? |
|---|---|---|---|---|---|
| PWA | Any browser (global+IL) | 0% | None | Low | No |
| Google Play TWA | Play Android base | 0% if sell on web | Low | Low–Med | Only if in-app |
| Apple (wrapped) | iOS | 15/30% | High (4.2) | High | Yes |

**Path: web-only PWA → ~month 2–3 add Google Play TWA → Apple only if real iOS demand.**

## 4. IP / moat protection
Client compiles to one `index.html` — anyone can View Source. **Don't hide client code; make the valuable parts server-side.** Value = (1) curated safety-vetted catalog (279 items, cure/nitrite calcs, cited) + (2) grounded safety-checked AI. **Tier the data** (free teaser in client, premium served only to entitled accounts); the **Managed-AI proxy is the enforcement point** (key + premium prompts + vetted retrieval server-side; meter/rate-limit/revoke per account). Same proxy as Wave 4 → protection costs nothing extra.
Legal layers: trademark the **composite mark + logo** (bare "מתכונת"≈"recipe" is descriptive/hard to register); copyright in the data *compilation* (selection/arrangement/original text); ToS prohibiting scrape/export/resell; API rate-limits + signed short-lived tokens.

## 5. Cloud sync as a paid hook
Good sticky upgrade (turns local-first's weakness into a paid benefit); **bundle with Managed-AI as "Pro"**, don't price separately. But storing user content makes you a **data controller**: Israel **Privacy Protection Law Amendment 13 (in force 14 Aug 2025)** — GDPR-aligned, monetary sanctions into the millions of ₪; EU GDPR if any EU users. Design: **opt-in, off by default** (non-sync users stay zero-PII), store minimum, encrypt at rest (consider client-side encryption = marketing point), plain HE+EN privacy policy, one-tap export/delete, consent+processing records.

## 6. Take-home on an illustrative ₪40/mo sub
| Channel + billing | Keep on ₪40 |
|---|---|
| Web PWA + Paddle (MoR) | ~₪36 |
| Web PWA + Stripe (needs US entity) | ~₪37.8 − compliance time |
| Google Play billing (2026) | ~₪34 |
| Apple IAP (SBP) | ~₪34 |
Web-first + Paddle wins on *net simplicity*: no separate VAT reg, no store review, no US entity, no native build.

## 7. Recommendation (fewest moving parts)
1. **Standalone product + thin shared identity/entitlements/AI-gateway backend** (needed for Managed-AI anyway).
2. **Pricing:** Free forever (current local app + BYO-key) · **"Fire Guide Pro"** = Managed-AI (no key) + cloud sync + premium data, monthly+annual (annual ~2 months free), single tier, optional fair-use AI cap metered at proxy, founder/early-bird annual price to seed.
3. **Billing: Paddle (MoR).**
4. **Distribution: web PWA first → Google Play TWA → defer Apple.**
5. **Stay web-first: yes.** Store wrappers are acquisition channels bolted on later, not the foundation.
6. **Protection:** auth-gate premium data + key behind proxy; ToS + HE/EN privacy policy; composite trademark in Israel; authorship records.

**Re-verify before launch:** Apple US external-link fee (unsettled, live remand Dec 2025); Google 10%+5% rollout (through Sep 2026); Paddle Israel onboarding/payout terms directly; store commission tiers (move quarterly).
