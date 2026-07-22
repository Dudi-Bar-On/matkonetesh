# W4-C — Market Opportunity & Competitive Landscape

**Product:** מתכונת · מדריך האש — Hebrew-first, mobile-first PWA for live-fire cooking (smoking, grilling, sous-vide, charcuterie). 177 catalogued items with cited food-safety data, an equipment model, a capacity-aware cook scheduler, 13 wired AI features including a Live Cook Copilot. Online-first with an AI key (owner decision 2026-07-22). **Currently free. No billing code exists anywhere.**

**Method:** every market number is either (a) a cited public source with a URL, (b) a measured number from this repository with a `file:line` or a reproducible command, or (c) an explicitly-labelled ASSUMPTION. Where two sources disagree by an order of magnitude, both are shown and the reason for preferring one is stated. Claims I could not evidence were dropped, not softened — §7 lists what was dropped and why.

---

## 0. Verdict in one paragraph

The bottom-up population arithmetic says this is a ~$870M/yr US market. **That number is wrong and I am not going to defend it.** The top-down revealed-preference number — total *global* paid recipe-app revenue projected at **$399.8M by 2027** ([electroiq](https://electroiq.com/stats/recipe-app-statistics/)) — is an order of magnitude smaller, and it is the one to believe, because it measures money people actually paid rather than people who own a grill. The honest realistic TAM for enthusiast live-fire cooking software is **$40–80M/yr worldwide**, the SAM is **$15–30M/yr**, and a solo builder's 3-year SOM is **$90k–$255k ARR**. The Hebrew market is a **validation** market, not a revenue market: its entire realistic Year-3 contribution is ~$16k–$60k/yr. Differentiation is real on three axes (Hebrew-first, cited safety corpus, equipment-capacity scheduling) but **two of the three are currently claims the code does not yet honour**, and the fourth candidate — "nobody owns the software-first planner" (`docs/ai-strategy.md:77`) — is **overstated**: Time To Plate sells backward-planning across real appliances for $39–99/yr today.

---

## 1. Market definition

| Dimension | Scope |
|---|---|
| **Problem** | An $80 brisket, 12 hours, guests arriving at 19:00, one smoker, no second chance — and a food-safety floor (pasteurization, nitrite dosing, danger-zone accumulation) the cook cannot compute in their head. |
| **Buyer** | The *enthusiast* household cook, not the casual griller. Owns ≥1 dedicated cooker (smoker / kamado / sous-vide circulator / charcoal grill), cooks long-form deliberately, and already spends on gear. |
| **Product category** | Hardware-agnostic paid consumer software: planning + capacity + safety + AI. Not a recipe library, not a probe app. |
| **Geography** | Beachhead: Israel (Hebrew). Expansion: English (US/CA/UK/AU/NZ/IE). Latent: fr/de/es (structurally incomplete today — status-and-gaps §2E-13). |
| **Time horizon** | 5 years. |
| **Business model today** | None. Free. Verified: the only `billing` matches in `app.js` are Google Cloud Billing **error strings** for TTS (`app.js:4493`, `app.js:5066`) and every `stripE` match is `stripEmoji` (`app.js:4988`, `5094`, `5102`). No Stripe, no Paddle, no RevenueCat, no checkout anywhere in the tree. |

---

## 2. TAM — two methods that disagree by 10×, and which one wins

### 2.1 Bottom-up (population arithmetic) — produces $870M, and is wrong

| Step | Value | Source |
|---|---|---|
| US households (2025) | **134.79M** | [FRED/Census TTLHH](https://fred.stlouisfed.org/series/TTLHH), updated 2025-12-04 |
| × own at least a grill or smoker | **70%** of all US households (80% of *homeowners*) → **94.4M** | [HPBA 2023 State of the Barbecue Industry](https://members.hpba.org/Resources/PressRoom/ID/2259/2023-State-of-the-Barbecue-Industry) — survey fielded Sept 2021, ±2%; up from 64% in 2019 |
| × cite **"hobby"** as a grilling motivation | **23%** → **21.7M US enthusiast households** | Same HPBA release (motivations: flavor 57%, lifestyle 40%, entertainment 33%, convenience 29%, **hobby 23%**) |
| × blended ARPU | **$40/yr** — midpoint of the *observed* paid band (§3) | Crouton $8.99 · Anova $10 · AmazingRibs $34.95 · Time To Plate $39 · ChefSteps $69 |
| **= US bottom-up TAM** | **~$870M/yr** | |
| Anglophone extension (CA/UK/AU/NZ/IE) | ×1.4–1.6 → **$1.2–1.4B/yr** | ⚠️ **ASSUMPTION.** HPBA confirms 70% of *Canadian* households own a grill (same release); I found no citable household counts for UK/AU/NZ/IE, so the multiplier is judgement, not data. |

### 2.2 Top-down (revealed preference) — produces $400M global, and wins

Published "recipe app market" estimates for 2025 span **$0.79B to $6.07B** across vendors ([MarketResearchFuture $6.068B](https://www.marketresearchfuture.com/reports/recipe-apps-market-24855) vs. others at $1.41B and $793.94M). That dispersion is 7.6×; the category is not measured well enough to validate anything, and I decline to cherry-pick from it.

The one number in that literature that is *narrow enough to be useful* is the split by monetization: **paid recipe-app revenue projected at $399.8M by 2027, free (ad-supported) at $718.3M** ([electroiq](https://electroiq.com/stats/recipe-app-statistics/)).

**This is the binding constraint.** $399.8M is the projected total that consumers pay for *all* cooking apps worldwide — every cuisine, every use case, every language. The bottom-up US-only figure of $870M is **2.2× the entire global paid category**. The bottom-up model is therefore structurally broken: the "23% hobby motivation" filter measures enthusiasm, not willingness to pay for software, and the gap between those two is where the error lives.

### 2.3 Reconciled TAM

Live-fire (BBQ/smoking/grilling) + sous-vide + charcuterie is a **subset** of paid cooking apps. It is a high-intensity, high-gear-spend subset, so it over-indexes on willingness to pay — plausibly 10–20% of paid cooking-app spend rather than its population share.

> **TAM = $40–80M/yr worldwide** (10–20% of the $399.8M global paid cooking-app category).

Variance between methods is ~1,000%, far outside the 30% reconciliation band. The bottom-up figure is reported here **only** to document why it was rejected.

### 2.4 Adjacent-market context (not additive to TAM)

- **Sous-vide hardware:** ~$1.2–1.4B/yr (2025), immersion circulators ~67% of demand, home use ~59–65% ([Arizton](https://www.arizton.com/market-reports/sous-vide-machine-market), [Business Research Insights](https://www.businessresearchinsights.com/market-reports/sous-vide-machine-market-108262)). Derived installed base: ~$780M home spend ÷ ~$150 ASP ≈ 5.2M units/yr → **~20–26M active home circulators globally** over a 5-yr life. ⚠️ Derived, not cited. *(The same reports also claim "48% of U.S. households own or plan to buy an immersion circulator" — that is not credible against 134.79M households and I am not using it.)*
- **BBQ grill hardware:** US market $1.36B–$3.56B (2025) depending on vendor ([Mordor](https://www.mordorintelligence.com/industry-reports/the-united-states-barbeque-grill-market) vs. [EMR](https://www.expertmarketresearch.com/reports/united-states-barbeque-grill-market)) — again a 2.6× spread. Hardware revenue is **not** a software TAM proxy and is listed only as evidence the audience exists and spends.
- **Charcuterie is not a market, it is a wedge.** Community-size proxy: r/Charcuterie **~44.2k** members vs r/smoking **~1.0M** and r/BBQ **~809k** (reported via [subbed.org](https://subbed.org/r/Charcuterie), [GummySearch](https://gummysearch.com/r/smoking/), [reddit-list](https://www.reddit-list.com/en/channel/BBQ); reddit.com itself blocked direct verification). Ratio ≈ **4%**. Charcuterie buys credibility and differentiation, not volume.

---

## 3. SAM

Filters applied to the $40–80M/yr TAM:

| Filter | Rate | Rationale |
|---|---|---|
| **Long-form cooking behaviour** | ~50% | HPBA mid-to-high-end study: **50% experiment with smoking and slow-cooking**, 53% seek new grilling/smoking recipes ([HPBA July 2025 release](https://hpba.org/fire-up-the-grill-celebrate-julys-national-grilling-month-with-insights-into-premium-outdoor-cooking-trends/), study fielded Oct 2022). Short-cook grillers do not need a scheduler. |
| **Hardware-agnostic reachability** | ~80% | The five hardware vendors (§4) bundle their app free with the device; users already inside a MEATER/Traeger/Anova ecosystem are reachable but must be *displaced*, not merely acquired. |
| **Language served today** | Hebrew 100%, English ~95% (18 toasts still render Hebrew in EN mode — status-and-gaps §2E-13), fr/de/es 0% | Structural, verified in-repo. |

> **SAM ≈ $15–30M/yr** (English + Hebrew, hardware-agnostic, planning/safety/AI segment).
> **Hebrew slice ≈ $0.5–1.5M/yr (3–5% of SAM)** — see §3.1.

### 3.1 Israel, sized honestly

| Step | Value | Source / status |
|---|---|---|
| Israel population, start of 2026 | **10.178M** | Israel CBS, [via israel.com](https://israel.com/public/israel-starts-2026-with-more-than-10-million-people/) |
| Hebrew-primary proxy ("Jews and others") | **7.771M (76.3%)** | Same CBS release |
| Hebrew speakers worldwide | **~9M total** (~6.51M native, ~2M L2); **6.29M native in Israel** | [worlddata.info](https://www.worlddata.info/languages/hebrew.php) |
| Smartphone penetration | **>85%** | [42matters / Statista Israel](https://42matters.com/israel-app-market-statistics) |
| Households | **~2.4M Hebrew-primary** | ⚠️ **ASSUMPTION** — 7.771M ÷ ~3.2 persons/household. I could not obtain a citable CBS average-household-size figure. |
| Grill/smoker ownership in Israel | **40%–70%** | ⚠️ **UNKNOWN — the single largest gap in this analysis.** The US 70% rate cannot be transplanted onto Israel's apartment-heavy housing stock. Two scenarios shown. |
| → Hebrew enthusiast households | **220k–390k** (grill households × 23% hobby rate) | Derived |

**What I could NOT evidence about Israel, and dropped:** there is no published survey of Israeli grill/smoker ownership or mangal frequency. The strongest citable datum is that >1M visitors filled KKL-JNF forests and parks on Independence Day 2012 out of ~8M population — one in eight ([ISRAEL21c](https://israel21c.org/seven-sure-signs-its-yom-haatzmaut/)). That establishes the *culture* is real and near-universal; it does **not** establish an addressable enthusiast count, and I have not treated it as if it did.

---

## 4. Competitive landscape

### 4.1 The map

| Competitor | What it does | Price | What it does **NOT** do |
|---|---|---|---|
| **MEATER app + MEATER Cloud** ([support](https://support.meater.com/hc/en-us/articles/37199037338139-Managing-Your-MEATER-Cloud-and-App-Account), [App Store](https://apps.apple.com/us/app/meater-smart-meat-thermometer/id1157416022)) | Guided Cook™, algorithmic cook-time estimates, rest guidance, 50+ recipes, cook history, remote monitoring, Wear OS | **App + Cloud free.** Requires ≥1 MEATER probe (hardware) | No multi-dish cook-day plan; **no equipment capacity model**; no sous-vide; no charcuterie; no cited safety corpus; no Hebrew |
| **Weber Connect** ([Weber](https://www.weber.com/US/en/accessories/smart-grilling/weber-connect-smart-grilling-hub/3201.html), [2.0 release](https://www.weber.com/US/en/pr-release-050223.html)) | Step-by-step assistant, flip/serve alerts, readiness countdown, 4 probes, 2.0 adds multi-cook graphing dashboard. **Works with any grill.** | **App free**; Smart Grilling Hub is paid hardware | Single-cook monitoring; no capacity scheduling; no curing; no sous-vide; no Hebrew |
| **ThermoWorks app / Cloud** ([help](https://help.thermoworks.com/knowledge-base/thermoworks-cloud/)) | Cloud mirror, up to 10 devices on free tier; BBQ devices (Signals, BlueDOT, Smoke Gateway) get access + notifications + storage free | **Free** (hardware $$) | Pure instrumentation — no recipes, no plan, no scheduling, no safety reasoning, no curing |
| **Anova app** ([Anova FAQ](https://support.anovaculinary.com/hc/en-us/articles/29269573803405-The-New-Anova-Sous-Vide-Subscription-FAQ), [Engadget](https://www.engadget.com/home/kitchen-tech/anova-will-charge-customers-to-use-its-sous-vide-app-because-everything-must-be-a-subscription-151906912.html)) | Sous-vide guides, notifications, recipe save/share | **$2/mo or $10/yr** for accounts created after 2024-08-21; pre-existing users grandfathered free | Sous-vide only; no BBQ/smoking plan; no charcuterie; no Hebrew. **Generated significant backlash** — see risk R5 |
| **ChefSteps / Joule (Breville)** ([Studio Pass](https://www.chefsteps.com/joule-turbo-welcome-to-chefsteps)) | Sous-vide + oven app, Studio Pass premium content; 2-month (Oven) / 6-month (Turbo) free trials | **$69/yr** Studio Pass | Tethered to Breville/Sage hardware; no live-fire smoking plan; no curing safety; no Hebrew |
| **Traeger (WiFIRE)** ([Traeger](https://www.traeger.com/app)) | Free app, 1000+ recipes, remote grill control, internal-temp monitoring, alerts/timers | **App free**; grills from $699 ([Westwood](https://www.stocktitan.net/news/COOK/traeger-introduces-the-all-new-westwood-series-where-great-flavor-7v1n8a61pe9c.html)); Provisions meal boxes $100–$300 | Locked to Traeger hardware; no third-party equipment model; no sous-vide; no charcuterie |
| **AmazingRibs Pitmaster Club** ([info](https://amazingribs.com/information-about-our-pitmaster-club/)) | Deepest English-language BBQ knowledge base + forum; 120 instructional videos, 7 e-books, ad-free site, member recipes | **$34.95/yr**, 30-day free trial | **Content, not software.** No planner, no scheduler, no live-cook state machine, no equipment registry, no Hebrew. Publishes no member count |
| **Serious Eats** ([Wikipedia](https://en.wikipedia.org/wiki/Serious_Eats)) | Free, ad-supported recipe/technique authority; owned by Dotdash Meredith (~200M monthly audience) | **Free** | Editorial. No app, no plan, no persistent state, no capacity, no safety enforcement |
| **Modernist Cuisine** | The reference work on the underlying science | **$65–$105+** per volume/set (retail) | Print. No software at all |
| **⚠️ Time To Plate** ([timetoplate.com](https://www.timetoplate.com/)) | **Backward planning from serve time across real appliances — oven, stovetop, grill, smoker, slow cooker, air fryer.** Reusable event templates. *This is the closest structural competitor.* | **Free** (15 recipes) / **$4.99mo–$39yr** / **$8.99mo–$79yr** / **$12.99mo–$99yr** | Fetched its own page: schedules **time**, "keep kitchen bottlenecks under control" — **no mention of rack space, dimensions, or shelf capacity anywhere.** No sous-vide, no charcuterie, no cited safety data, no Hebrew |
| **Weber BBQ Timer** ([weberbbqtimer.com](https://weberbbqtimer.com/)), **PlanBBQ**, **A License To Grill**, **BBQ Party Calculator** | Free web calculators. Weber's **"Cook Plan arranges all food to finish cooking at the same time"**, up to 10 multi-timers | **Free** | Finish-together timers, not capacity solvers. No persistence, no equipment registry, no safety corpus |
| **BBQ Replay** ([bbqreplay.com](https://bbqreplay.com/)) | Plan → log → replay cooks; offline-first, no account, multiple concurrent cooks, CSV/JSON export | **Free at launch** | No capacity model; no sous-vide; no charcuterie; no AI |
| **Paprika / Crouton / Samsung Food (Whisk)** | General recipe managers. Paprika ~6M users / 40 countries; Whisk >7M users | Paprika **$4.99–$29.99 one-time**; Crouton **$8.99/yr** | Generic. No live-fire domain, no equipment model, no food-safety enforcement, no scheduling |
| **ChatGPT / Gemini (general assistants)** | Will answer any cooking question, in Hebrew, for free | $0 / ~$20/mo | No persistent equipment registry, no capacity arithmetic, no timers, no live-cook state, no verified corpus, no refusal guarantee — **today** |

### 4.2 Verdict on the table

**The market is barbelled, and the middle is thin but NOT empty.**

- **Left bar — free, hardware-tethered:** MEATER, Weber, Traeger, ThermoWorks all give the app away because the app sells (or is sold by) the hardware. They own probe telemetry, which this product does not have. Anova is the exception that proves the rule and it cost them dearly (R5).
- **Right bar — paid content:** AmazingRibs $34.95/yr, ChefSteps $69/yr, Modernist Cuisine in print. All are knowledge, none are software that *does* anything during your cook.
- **The middle — paid, hardware-agnostic planning software — is where this product sits, and Time To Plate is already there at $39–99/yr.**

**Therefore: the claim in `docs/ai-strategy.md:77` that "Nobody owns the software-first AI copilot spanning BBQ + smoking + sous-vide + grilling + charcuterie" is overstated as written and should be corrected.** Backward-planning-across-appliances is sold today. What is genuinely uncontested is the *specific combination* in §5 — and the strategy doc should say that instead, because the weaker, accurate claim is still a good claim.

---

## 5. Differentiation — each candidate tested, honestly

### ✅ 5.1 Hebrew-first RTL — STRONG, essentially uncontested

A Hebrew-language search for live-fire cooking apps (`אפליקציה עברית מנגל עישון בשר סו ויד`) returns **blogs and butcher shops, not applications**: [sousvide.co.il](https://www.sousvide.co.il/blog/), [sousvideer.com](https://www.sousvideer.com/he/meat-he), [Gorilla Grill](https://gorillagrill.co.il/collections/sous-vide), [aharonbros.co.il](https://aharonbros.co.il/). Every competitor in §4.1 is English-only. No competitor ships RTL.

**Honest caveat:** it is uncontested because the market is small (§3.1), not because it is technically hard. It is a **moat against entry**, not a **source of revenue**. Its real strategic value is as the beachhead where the product can be proven before it has to fight in English.

### ⚠️ 5.2 Cited food-safety corpus — REAL AND MEASURED, but the marketing claim is ahead of the code

**Measured, not asserted:** 130/130 cuts, 47/47 specials, 102/102 makes each carry a merged `src` block — **279 top-level `"src"` blocks in the shipped bundle** (verified independently: `grep -o '"src"' index.html | wc -l` → **279**; cross-confirms W1-E §0). 130 + 47 = **177 catalogued items**, matching the brief exactly. Every `safe` value sampled traces to USDA FSIS or Baldwin's pasteurization tables (W1-E §0). Sources carry a `verified` date and an explicit `UNVERIFIED` state (`docs/ai-strategy.md:26`).

**No competitor in §4.1 publishes per-item provenance with a verification date.** This is genuinely expensive to copy and it is the one asset a general AI assistant structurally cannot claim.

**But the differentiation as currently marketed is not yet true in code:**
- The strategy TL;DR promises the app "**guards your cure**" (`docs/ai-strategy.md:9`). W1-E §1: `bcheck` is a critical-limit **display, not a control** — no verification recorded, nothing blocks progression, no corrective-action path. The cure-scale guard is **advisory only** — its own test G8 proves the computed grams are byte-identical whether or not the warning fires (status-and-gaps §2A-1).
- Both named safety commitments — *refuse to schedule* poultry/charcuterie without a registered thermometer, and *BLOCK* the cure task without a 0.1g scale — are **0% built** (status-and-gaps §2A-1, 49 requirements).

> **The corpus is a real moat. "Guards your cure" is a claim the code does not yet earn.** Shipping the two plan-depth gates converts the strongest differentiator from marketing into product.

### ✅ 5.3 Equipment-aware capacity scheduler — GENUINELY UNCONTESTED, with a numerical caveat

I fetched the pages of every planner-class competitor and searched their marketing for capacity language:
- **Time To Plate:** schedules tasks across appliances, "keep kitchen bottlenecks under control" — **no mention of rack space, dimensions, or shelf capacity.** Time-only.
- **Weber BBQ Timer:** "Cook Plan arranges all food to finish cooking at the same time" — finish-together timers, not a capacity solver.
- **BBQ Replay:** capacity not mentioned.
- **MEATER / Weber Connect / Traeger / ThermoWorks:** probe-count limits only (4 probes, 10 devices) — a *telemetry* constraint, never a *physical-space* constraint.

**No competitor I could find models the physical geometry of your specific cooker.** This is the most defensible *functional* differentiator and it is the one nobody is racing toward.

**Honest caveat from the codebase:** `footprint_cm2` is a static per-recipe constant, so **4 guests and 40 guests claim identical grate area** (status-and-gaps §2C-10, owner-raised). The architecture is uncontested; the arithmetic is not yet honest at real party sizes. Guest-count-scaled demand is derivable from existing data (`rawGramsFor` + catalog reference weight) and is item #4 in the owner's own fix order.

### ⚠️ 5.4 Charcuterie depth — REAL but small; a credibility wedge, not a market

Not one competitor in §4.1 touches curing. Zero. It is the domain where the safety stakes are highest (botulism), the Hebrew coverage is nil, and the corpus advantage is largest. But the community-size ratio is ~4% of the smoking audience (§2.4), and **Charcuterie Slice B is 0% built** (status-and-gaps §2C-7). Treat it as the proof-of-seriousness that makes the safety claim credible for the other 96%, not as a revenue line.

### ➖ 5.5 No hardware required — double-edged

Differentiates against all five hardware vendors and reaches the ~30% of grill households with no smart device. But it also means **no probe telemetry** — and probe telemetry is precisely what MEATER and ThermoWorks users love. The Live Cook Copilot's context comes from user-entered readings, not a live feed. The `docs/ai-strategy.md:86` "import a MEATER/Combustion/Inkbird CSV" idea is the right answer: ride their hardware without competing with it.

---

## 6. Risks, ranked by probability × damage

### 🔴 R1 — A general AI assistant absorbs the use case *(highest probability)*
ChatGPT reached **900M weekly active users (Feb 2026, up from 800M in Oct 2025)** with **50M paying subscribers** ([TechCrunch](https://techcrunch.com/2026/02/27/chatgpt-reaches-900m-weekly-active-users)), and crossed **1B monthly app users in June 2026** — the fastest app in history to do so (Sensor Tower via Reuters). It answers Hebrew cooking questions today, for free.
**What still protects this product:** no persistent equipment registry, no capacity arithmetic, no background timers, no cited-and-dated corpus, no deterministic refusal guarantee. **What does not protect it:** a solo builder cannot out-ship frontier model improvement. The defensible position is *state + arithmetic + provenance*, not *answers*.

### 🔴 R2 — A vendor adds planning *(high probability, high damage)*
The precursors already shipped: Weber sells a **"Cook Plan"** that finishes multiple foods together, MEATER ships **Guided Cook™ with algorithmic estimates**, Weber Connect **already works with any grill** — so the hardware lock-in is one-sided, not mutual. Adding multi-item capacity scheduling is a sprint for an org with the install base, the probe telemetry, and the retail shelf. This product's only lead time is the cited corpus (5.2) and Hebrew (5.1), neither of which a US vendor would bother to copy.

### 🟠 R3 — The Hebrew market cannot fund the product *(near-certain, moderate damage)*
Israel is ~10.178M people ≈ 0.13% of world population. Realistic Year-3 Hebrew revenue is **$16k–$60k/yr** (§8). This is not a failure of the strategy — it is the strategy working as designed *if and only if* the bilingual switch is actually flipped. The risk is treating Israel as the destination rather than the proving ground. Note the English market is the one with all the competition in §4.

### 🟠 R4 — Unit economics may be inverted before a single dollar is collected
The Worker's default cap is **2,000,000 tokens/month per user** (`scripts/central-code.mjs:35`, per W1-F §7). Gemini 2.5 Flash is **$0.30/M input, $2.50/M output** ([pricepertoken](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash)).

| Mix at the cap ceiling | Monthly cost | Annual cost | vs. planned ₪199–249 (~$49–59/yr) |
|---|---|---|---|
| 80/20 input/output | $1.48 | **$17.76** | ~64–70% gross margin ✅ |
| 50/50 | $2.80 | **$33.60** | ~31–43% margin ⚠️ |
| Output-heavy (worst case) | $5.00 | **$60.00** | **negative** 🔴 |

Plus: Gemini TTS requires separate Google Cloud Billing (`app.js:4493`), photo analysis is multimodal, and the **Live Cook Copilot is by design the heaviest-usage feature in the product** — a 12-hour brisket with repeated "what do I do right now" calls is exactly the output-heavy profile. Also unmitigated per W1-F §7: **no per-minute rate limiting** (only an eventually-consistent monthly cap with a TOCTOU window at `worker/index.js:77-87`), wide-open CORS (`worker/index.js:21`), and one uncapped code (`carol 0`). **And there is no billing code anywhere** (§1) — so today 100% of AI cost is subsidy with zero collection path.

### 🟠 R5 — Paywalling shipped functionality repeats Anova's mistake
Anova charged $2/mo for a 10-year-old previously-free app and drew documented, sustained backlash ([Engadget](https://www.engadget.com/home/kitchen-tech/anova-will-charge-customers-to-use-its-sous-vide-app-because-everything-must-be-a-subscription-151906912.html), [The Spoon](https://thespoon.tech/sous-vide-specialist-anova-informs-community-its-app-is-going-subscription-and-its-not-going-well/)) — compounded because it landed alongside sunsetting older devices. They ultimately grandfathered existing users. **This product currently ships 13 AI features for free.** The mitigation is already the right one in `docs/ai-strategy.md:96-102`: keep BYOK free forever and sell only **Managed AI** (a genuinely *new* capability), never re-gate something users already have.

### 🟡 R6 — The trust claim contradicts itself in shipped copy
The differentiation rests on trust, and the app currently ships **"הנתונים מקומיים, ללא חיבור לרשת"** ("data is local, no network connection") at `app.js:334`, plus "Private by default… stored locally on device only" and "Full offline coming next" at `app.js:3931,3939`, and "fully local-first" at `README.md:3` — all contradicting the owner's 2026-07-22 online-first decision (W1-F standing context). A user who discovers the app is calling an API while the footer says it isn't will not extend trust to the safety corpus either. This is the cheapest risk on the list to close.

### 🟡 R7 — Solo-builder concentration
No billing, no cloud sync, no evaluation harness for the AI (W1-F §5: no `evals/`, no fixture corpus, no CI gate), and 49 unbuilt plan-depth requirements including both named safety commitments. The product's competitive claims are ahead of its build state on exactly the axes it competes on.

---

## 7. What was dropped rather than softened

Per the standing rules, these were investigated and **discarded** for lack of evidence:
1. **Israeli grill/smoker ownership rate** — no published survey exists. Presented as an explicit 40–70% scenario range, never as a point estimate.
2. **Israeli average household size** — no citable CBS figure obtained. The ~3.2 divisor is labelled ASSUMPTION.
3. **"48% of U.S. households own or plan to buy an immersion circulator"** — appears in sous-vide market reports; not credible against 134.79M households. Discarded.
4. **Reddit subscriber counts** — reddit.com blocked direct fetch; figures are attributed to the third-party trackers that reported them, and used only as a *ratio* (charcuterie ≈ 4% of smoking), never as an absolute market size.
5. **"Home charcuterie market growth"** — searched; no market data exists for the hobby segment. UMAi Dry's own pages carry no sales figures. No number asserted.
6. **AmazingRibs Pitmaster Club member count** — page fetched; it claims "world's largest membership-based BBQ community" but publishes **no count**. The absence after ~10 years at $34.95 is noted as a signal, not converted into a number.
7. **Total "recipe app market" size** — 7.6× vendor dispersion. Refused to cite a point value; used only the narrower paid/free revenue split.

---

## 8. SOM — realistic obtainable market

Constraints applied: solo builder · zero billing infrastructure today · no marketing budget · no hardware channel · Hebrew-first with English ~95% complete.

| | Year 3 | Year 5 |
|---|---|---|
| **Israel (Hebrew)** | 300–900 paying × ₪199–249 = **₪60k–₪224k/yr** (~$16k–$60k) | 900–2,500 paying = **~$50k–$165k** |
| **English (if bilingual switch is flipped)** | 1,500–4,000 paying × ~$49 = **$75k–$195k** | 5,000–15,000 paying = **$245k–$735k** |
| **Combined ARR** | **~$90k–$255k** | **~$300k–$900k** |
| **% of SAM ($15–30M)** | **0.5–1.5%** | **2–4%** |

**Why these are below the skill's default 2–3% Year-3 guidance:** that guidance assumes a funded team with a go-to-market function. Here, distribution is one person posting in Hebrew Facebook groups and English BBQ forums, and the payment rail does not exist yet.

**Sanity checks:**
- AmazingRibs has run the largest paid English BBQ community for ~a decade at $34.95/yr and does not publish a member count — a ceiling signal for content-led BBQ subscriptions.
- Crouton, a well-reviewed general recipe manager, prices at **$8.99/yr** — evidence that undifferentiated cooking software commands very little.
- Time To Plate prices the *adjacent* planning problem at **$39–$99/yr** — evidence that *planning* (not content) supports a real price. This is the correct anchor, and it validates the ₪199–249 (~$49–59) plan in `docs/ai-strategy.md:101` as sitting mid-band, not high.
- Israel Year-3 at the midpoint (~$38k/yr) is below one Israeli developer salary. **Stated plainly: Israel validates, English monetizes.**

---

## 9. Investment thesis

**The positive case.** There is a real, under-served combination: hardware-agnostic planning + a cited food-safety corpus + physical capacity modelling + charcuterie + Hebrew. No single competitor holds more than two of those five, and the capacity model appears to be held by nobody. The corpus (177 items / 279 cited source blocks, USDA FSIS + Baldwin) is a genuinely expensive asset that a general AI assistant structurally cannot claim, and the strongest emotional purchase trigger in the category — *insurance against ruining an $80 twelve-hour cook* — is exactly what the Live Cook Copilot sells.

**The negative case.** The realistic worldwide TAM is $40–80M, not the ~$1B the bottom-up arithmetic suggests; the entire global paid cooking-app category is projected at only $399.8M. The Hebrew beachhead cannot fund a business. Two of the three differentiators are claims the code does not yet honour (advisory-only cure guard; guest-count-blind capacity). There is no billing code, no AI evaluation harness, and per-user AI cost at the current cap ceiling can exceed the planned annual price. This is not venture-scale; **it is a credible solo/lifestyle business or an acquisition/OEM target, and it should be planned as one.**

**The highest-leverage sequence, from a market standpoint:**
1. **Make the safety claim true** — ship the thermometer gate and the cure block (status-and-gaps §2A-1). This converts the one asset competitors cannot copy from marketing into product, and it is the "the app caught a dangerous idea" demo that `docs/ai-strategy.md:52` correctly identifies as the story users retell.
2. **Fix guest-count-scaled occupancy** — makes the *uncontested* differentiator numerically honest before it is marketed.
3. **Fix the copy contradiction** (R6) — cheapest item on the list, and it protects the trust the other two depend on.
4. **Build billing gated to Managed AI only**, never re-gating shipped features (R5), with a per-user token cap set *below* the price point rather than above it (R4).
5. **Correct `docs/ai-strategy.md:77`** to the accurate, still-strong claim: nobody combines capacity-aware planning with a cited safety corpus — Time To Plate already sells the planning half.
6. **Then flip the bilingual switch**, because that is where 80–90% of the obtainable revenue lives.

---

*Sources are linked inline throughout. Repository claims cite `file:line` or a reproducible command. Sibling reports: `W1-F-ai.md` (13-feature AI inventory, cost driver), `W1-E-food-safety.md` (corpus verification), `2026-07-22-status-and-gaps.md` (build state), `docs/ai-strategy.md` (the monetization plan this report tests).*
