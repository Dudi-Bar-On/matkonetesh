# Business Model — decision document

**Date:** 2026-07-22 · **Version audited:** v258 · **Author lens:** product manager / candid advisor
**Inputs:** `W4-A-unit-economics.md` (measured COGS), `W4-B-pricing.md` (packaging), `W4-C-market.md` (TAM/competition), `W1-F-ai.md` (13 AI features), `2026-07-22-status-and-gaps.md` (build state), `docs/ai-strategy.md`, `ai-prd.md`.
**Method:** every blocking claim was re-verified against the tree by this author, not accepted from the sibling reports. Two citation errors in those reports are corrected in §0.1. Unverifiable claims were dropped, not softened.

---

## 0. The recommendation, stated first

> **Do not monetise now. Ship cost control now.**
>
> The owner's actual problem today is **not** "no revenue." It is **unbounded cost with no ceiling**. Those two problems have different solutions, and the cheap one is not billing.
>
> One conditional — gating `google_search` behind a live-info intent check — takes blended cost from **$1.22 → $0.39 per user per month** (W4-A §5 cliff 1). That is days of work. Building accounts + metering integrity + billing + closing the safety blocker is weeks-to-months, and at Israel-only scale returns a **Year-3 midpoint of ~$38k/yr** (W4-C §8) — below one Israeli developer salary.
>
> **Sequence: cost control → truth in advertising → make the differentiators true → instrument → then charge.** The pricing in §2 is what to charge *when* you charge, and §3 lists what must be true first. Monetise after the bilingual switch, not before it.

### 0.1 Two corrections to the sibling reports

Per the standing rule that a claim is dropped rather than softened, and because three false alarms have already occurred on this project:

| Claim | Status | What I found |
|---|---|---|
| `W1-F` §standing-context and `W4-C` R6 cite the offline footer at **`app.js:334`** | **Right fact, wrong file** | `app.js:334` is `function deviceSilhouette(dev)`. The string "הנתונים מקומיים, ללא חיבור לרשת" lives at **`build.py:334`** and ships to `dist/index.html:1916`. The contradiction is real; the citation was not. |
| `W4-B` §2.3 prices a text action at **~$0.0035** | **Invalidated by measurement** | `W4-A` §3 measures Ask-the-Fire at **$0.0381** — 10.9× higher — because 92% of it is the grounded-search *request* fee, which a token-only model cannot contain. This breaks W4-B's 400-action allowance. See §2.4. |

Both sibling reports remain sound in their conclusions. These are precision fixes, not reversals.

---

## 1. The honest position

### 1.1 What this product is

A Hebrew-first, mobile-first single-file PWA for live-fire cooking — smoking, grilling, sous-vide, charcuterie. Verified assets:

| Asset | Evidence |
|---|---|
| **279 catalogued items** (130 cuts, 47 specials, 102 makes); **177** carry the food-safety framing the brief names | `README.md:5`; W4-C §5.2 |
| **279 cited source blocks** merged at build from `sources.py`, each with a `verified` date | `grep -o '"src"' index.html \| wc -l` → 279; `tests/data-integrity.spec.ts` asserts every cut carries one |
| **13 wired AI features**, all reachable from real UI, none dormant | `W1-F` §1 |
| **Capacity-aware scheduler + equipment model** | `planSchedule`/`schedulePlacements`; status-and-gaps §1 |
| **82 spec files, 413 passing, zero arbitrary waits** | `ls tests/*.spec.ts \| wc -l` → 82; status-and-gaps header |
| **No billing code of any kind** | Every `stripE` match in `app.js` is `stripEmoji` (`4967`, `4970`, `4988`). No Stripe, Paddle, RevenueCat, checkout. |
| **No analytics of any kind** | `grep -niE "gtag\|posthog\|mixpanel\|amplitude\|plausible\|sentry"` over `app.js` + `worker/index.js` → zero instrumentation hits |
| **No account system** | Only an API-key paste field (`app.js:4490`) and a 12-char access code (`scripts/central-code.mjs:36`) |

### 1.2 Who it is for

The **enthusiast household cook**, not the casual griller: owns ≥1 dedicated cooker, cooks long-form deliberately, already spends on gear (W4-C §1). The purchase emotion is precisely identified in `ai-strategy.md:80` and I agree with it: *an $80 brisket, 12 hours, guests at 19:00, no second chance — the dominant feeling is fear of ruining it.* Insurance against disaster is the most payable feeling in this category.

### 1.3 Why it can win — three claims, tested

**✅ Equipment-aware capacity scheduling — genuinely uncontested.** W4-C §5.3 fetched every planner-class competitor and found none modelling physical rack space or shelf geometry. Time To Plate schedules *time* across appliances; Weber's Cook Plan is a finish-together timer; MEATER/ThermoWorks limit *probe count*, a telemetry constraint, never a physical one. **Caveat that must be fixed before this is marketed:** `footprint_cm2` is a static per-recipe constant, so 4 guests and 40 guests claim identical grate area (status-and-gaps §2C-10). The architecture is uncontested; the arithmetic is not yet honest.

**⚠️ Cited food-safety corpus — a real, expensive-to-copy asset whose marketing claim the code does not yet earn.** 279 provenance blocks with verification dates is something no competitor publishes and a general assistant structurally cannot claim. But `ai-strategy.md:9` promises the app "**guards your cure**", and status-and-gaps §2A-1 records that both named safety commitments — *refuse to schedule* poultry/charcuterie without a registered thermometer, and **BLOCK** the cure task without a 0.1 g scale — are **0% built**. `bcheck` is a display, not a control. The cure guard's own test G8 proves the computed grams are byte-identical whether or not the warning fires.

**✅ Hebrew-first RTL — uncontested, but it is a moat against entry, not a source of revenue.** Every competitor in W4-C §4.1 is English-only; none ships RTL. It is uncontested because the market is small, not because it is hard.

### 1.4 Where it cannot win — stated plainly

- **This is not venture scale.** Realistic worldwide TAM for enthusiast live-fire software is **$40–80M/yr**; the entire *global paid cooking-app category* is projected at **$399.8M by 2027** ([electroiq](https://electroiq.com/stats/recipe-app-statistics/)). The bottom-up population arithmetic producing ~$870M for the US alone is 2.2× the whole global category and was correctly rejected by W4-C §2.2.
- **Israel cannot fund this.** Year-3 Hebrew revenue: **$16k–60k/yr** (W4-C §8). Israel validates; English monetises.
- **The English market is where all the competition is** (W4-C §4.1) and the bilingual switch is not fully flipped — 18 toasts still render Hebrew in English mode (status-and-gaps §2E-13).
- **A solo builder cannot out-ship frontier model improvement.** ChatGPT reached 900M weekly actives (Feb 2026) and answers Hebrew cooking questions free. The defensible position is *state + arithmetic + provenance*, not *answers* (W4-C R1).
- **The trust claim contradicts itself in shipped copy today.** `build.py:334` ships "הנתונים מקומיים, ללא חיבור לרשת" (data is local, no network connection); `README.md:4` says "fully local-first"; `app.js:3939` promises "אופליין מלא" (full offline) as coming next. The app is now online-first with an AI key. A user who discovers the app is calling an API while the footer says it is not will not extend trust to the safety corpus either.

**Honest framing: this is a credible solo/lifestyle business or an acquisition/OEM target. Plan it as one.** That is not a downgrade — it changes what "success" means and therefore what is worth building.

---

## 2. Tier structure, feature split, price points — reconciled against the economics

### 2.1 The organising principle

> **Deterministic ⇒ free forever. Probabilistic ⇒ metered. Live web lookup ⇒ paid.**

W4-B §0 got the first half right and the reasoning is worth restating because it is unusually clean: the entire safety layer is deterministic, local, and costs **$0 marginal to serve**. There is no revenue being sacrificed by giving it away. The ethics and the economics point the same direction.

**The third clause is my addition, and it is the most important packaging decision in this document.** Grounded Google Search is **77–90% of every persona's monthly cost** (W4-A §0) and simultaneously the **#3 hallucination surface** (W1-F §3). Making live web lookup the paid capability:

- cuts free-tier COGS from **$0.27 → ~$0.03** per user per month (persona A, 90% search share, W4-A §4)
- makes paid-tier cost predictable instead of unbounded
- **improves safety on the free tier** rather than degrading it
- gives an honest upgrade story: "live prices, stock and local business lookup" is genuinely a live-service capability, not a withheld feature

At $0.03/user/month a free tier costs **$300/month at 10,000 users**. At W4-B's specified free tier (grounding on) the same 10,000 users cost **$2,700/month** with no revenue.

### 2.2 What must be free, permanently, on every tier

All of the following are deterministic, local, zero marginal cost (`W4-B` §3.1, verified):

`AI_REFUSALS`/`askRefuse` (`app.js:4146-4197`) · `cureScaleGuardHTML` (`app.js:1849`) · `SAFETY_FACTS()` (`app.js:4127-4129`) · `UMAKE_CALC` cure/salt dosing (`app.js:8571`) · `mtNumSig`/`mtSafe` numeric invariant (`app.js:6956-6958`) · all 279 cited sources · `bcheck`, timers, alarms, scheduler, occupancy, journal · the deterministic fallbacks `wcimLocal`, `pantryAdvisorLocal`, `askFire`.

**And BYOK AI stays unlimited and free forever.** It routes straight to Google (`app.js:4208` `gemFetch`, mode `byok`) at **$0 owner cost**. The paid product is not *access to AI* — it is **not having to care about an API key**, which `ai-strategy.md:96` correctly identifies as the real ceiling.

**Do not price on user level.** `mk-uilevel` (beginner/intermediate/advanced) is an excellent packaging *signal* and a terrible *gate*: a beginner needs the safety layer most and will pay least. Use level to recommend a tier and set defaults, never to withhold a capability. (W4-B §1; I concur without reservation.)

### 2.3 Recommended tiers — **two, not three**

W4-B proposes three consumer tiers plus a deferred B2B tier. **A solo builder with no billing code, no accounts, and no analytics should not operate three billing surfaces on day one.** W4-B's own §7.1 says do not launch Pitmaster until its COGS is measured — and W4-A did not measure pro/thinking routing either. Defer it.

| | **אש · Ember** (Free) | **מדריך האש · Pit Pass** |
|---|---|---|
| **Price — IL** | ₪0 | **₪249/yr** (hero) · ₪29/mo |
| **Price — intl** | $0 | **$59/yr** (hero) · $8.99/mo |
| **BYOK AI** (own key) | **Unlimited, forever** | Unlimited |
| **Managed AI** (no key) | **25 actions/mo** | **400 actions/mo** |
| **Live web lookup** (grounded search) | **Off** — Ask-the-Fire still answers from the vetted catalog via `askContextFor` (`app.js:4136`) | **40 live lookups/mo** |
| **TTS** | System voice (`sysSpeak` `app.js:5048`) — always free | 60 min/mo — **placeholder, see §2.5** |
| **Photo analysis** (`gemVision` `app.js:9296`) | 1 free lifetime | ✅ |
| **Live Cook Copilot** (`openCopilot` `app.js:5503`) | Read-only: timers, stall detection, deterministic advice | ✅ full, incl. `copilotAskNow` (`5448`) |
| **Cloud sync / backup** | — (local only; export always available) | ✅ |
| **Everything deterministic** (§2.2) | ✅ **100%, forever** | ✅ |

**Deferred, deliberately:** Pitmaster (pro/thinking routing — COGS unmeasured), Instructor/B2B (a fourth billing surface), Pro Tools one-time (`ai-strategy.md:102` — a second payment model doubles the operational load for a solo builder).

### 2.4 🔴 The reconciliation that kills W4-B's allowance as specified

W4-B §2.3 offers **400 actions/month** on Pit Pass, costed at ~$0.0035/action = **$1.40 COGS**. That model contains only tokens. W4-A §3 measures the app's primary AI entry point — Ask-the-Fire, reachable from home (`#cHomeAsk`), the settings menu, and the AI hub (W1-F §1) — at **$0.0381/call**, because `app.js:4249` attaches `tools:[{google_search:{}}]` **unconditionally** and the fee is **$35 per 1,000 grounded prompts** billed *per request*, invisible to any token counter.

| Scenario, 400-action Pit Pass | COGS/mo | Net revenue/mo | Gross margin |
|---|---|---|---|
| W4-B's assumed mix (token-only model) | $1.40 | $4.42 | 68% |
| 20% of actions are Ask-the-Fire | **$3.84** | $4.42 | **13%** |
| **All 400 actions are Ask-the-Fire** | **$15.24** | $4.42 | **−245%** — loses **$10.82/user/month** |

That third row is not a tail case; it is the app's most prominent AI button used as designed.

> **Verdict: the 400-unqualified-action allowance must not ship.** Either (a) make search conditional first, (b) weight a grounded call at 15, or (c) meter it separately — §2.3 does (a) + (c).

### 2.5 Honest weights, derived from measurement rather than guessed

W4-B §2.3 assigns photo analysis a weight of **3** and flags it as a guess. **W4-A §3 measures photo analysis at $0.0014 — the *cheapest* AI feature in the app**, below a single spoken sentence. The guess was wrong in the safe direction, but wrong.

| Action class | Measured $/call (W4-A §3) | Honest weight |
|---|---|---|
| Non-grounded text action (recipe-gen, diagnose, wcim, advisor, planner, seasoning, insights, copilot) | $0.0011 – $0.0026 | **1** (base ≈ $0.0025) |
| **Photo analysis** | **$0.0014** | **1** — *not 3* |
| **Grounded / live lookup** (Ask-the-Fire, Voice Q&A, equipment lookup) | **$0.0365 – $0.0400** | **15** |
| TTS, per minute | $0.0152 ($0.0038 per 15 s) | **6/min** |
| MT hydration | $0.00008/string | **0 — never charge the user** (automatic, not user-initiated) |
| Pro/thinking (deferred tier) | **unmeasured** | **do not publish a number** |

**Sell "actions" externally; meter dollars internally.** No cook knows what a token is — and, critically, **tokens are the wrong internal unit too**: they miss 90% of the cost (§3.1).

### 2.6 Price points, and whether the economics support them

Net-of-fee, using a merchant-of-record (~5% + fixed), which W4-B §7.6 and `worker/README.md` both correctly prefer over raw Stripe because it handles Israeli VAT:

- **₪249/yr** incl. 18% VAT → ₪211 net of VAT → ≈ **₪197 ≈ $53/yr ≈ $4.42/month**
- **$59/yr** → ≈ **$55.55/yr ≈ $4.63/month** (net-of-VAT parity with ₪249, not a geographic premium — W4-B §5.2)
- **$8.99/mo** → ≈ **$8.04/month**

| Price | Net/mo | GM vs worst persona **today** ($2.83) | GM vs worst persona **after the search fix** ($0.99) |
|---|---|---|---|
| ₪249/yr | $4.42 | **36%** ❌ below the 75–85% SaaS norm | **78%** ✅ |
| $59/yr | $4.63 | 40% ❌ | **79%** ✅ |
| $8.99/mo | $8.04 | 65% ⚠️ | **88%** ✅ |
| *$2.99/mo (rejected)* | $2.34 | **−21%** 🔴 *loses money on a single power user* | 58% |

> **The economics support ₪249 / $59 per year — but only after `google_search` is made conditional.** Without that fix the annual price yields a 36–40% gross margin against an enthusiast in Voice Cook mode, with no headroom for usage drift, support, refunds, or a Gemini price rise (they raised prices on 2026-07-02).

**If the search fix does not ship, do not launch at ₪249/$59.** The honest alternatives are: **$79/yr with a 150-action / 10-live-lookup allowance**, or monthly-only at $8.99. Say this out loud rather than shipping a plan that loses money on its best users.

**Launch mechanics** (W4-B §5.3, endorsed): annual is the hero price — BBQ is seasonal and monthly plans churn over winter. Founder cohort at ₪199/$49 lifetime-locked, first 200, below-margin by design, to buy testimonials **and the real usage distribution §4 currently lacks**. Reverse trial: 14 days of full Pit Pass, no card, dropping to Free — safe because the deterministic layer keeps working. Grandfather the existing beta cohort permanently.

### 2.7 Where the paywall goes — and where it must never go

Ranked, from W4-B §4 (endorsed):

1. **🥇 The BYOK key wall** (`openKeyManager` `app.js:4512`) — highest volume, zero risk. The upgrade offer is strictly *less* work than the status quo of creating a Google Cloud project. Keep BYOK visible and free beside it; the contrast **is** the pitch.
2. **🥈 Hour 7 of a brisket** (`copilotAskNow` `app.js:5448`) — peak intent, and **it must never be a hard gate**. The user is beside a live fire, greasy hands, 390 px, possibly 3 a.m. Grant an emergency allowance, let the cook finish on the house, show a non-blocking line, and **convert at cook-end** on the journal screen when the emotion is relief rather than panic.
3. **🥉 Cook completion → journal → coach** (`aiJournalInsights` `app.js:8646`) — the retention pitch. Personalise with real counts from their own journal.
4. **Photo analysis** — one free lifetime analysis, then gate. Visually obvious, delivers instantly.
5. **Cloud sync** — loss aversion, correctly timed (second device, or ~20 journal entries). **Data stays exportable on the free tier**; holding history hostage is the trust-destroyer.
6. **Meter exhaustion** — soft, never a dead end. `wcimLocal`/`pantryAdvisorLocal`/`askFire` still answer. Warn at 75%. Never exhaust mid-cook.

**Never behind a paywall:** anything in §2.2, and above all `askRefuse` output. A user asking "can I skip the pink salt?" gets the botulism card instantly, free, forever. `ai-strategy.md:52` is right that the app *refusing* a dangerous idea with a citation is the story users retell — that demo only spreads if it needs no key, no payment, and no account.

### 2.8 The obligation charging creates

Charging changes the posture from "free hobby app" to "paid product with a duty of care." Two non-negotiables:

- **Guards are identical on every tier.** The guard stack is a property of the feature, never of the plan. A paid user must never receive *less*-guarded output.
- **The Tier-D gap closes before any tier ships.** See §3.6.

---

## 3. Metering and enforcement — what must exist before charging anyone

Every number in §2 presumes the meter is enforceable. **It is not.** I re-verified each item below against the tree.

### 3.1 🔴 The meter is blind to ~90% of the cost

```js
// worker/index.js:80
const used = (j.usageMetadata && j.usageMetadata.totalTokenCount) || 0;
```

Grounding is billed **per request** at $35/1,000 prompts. It appears in **no token counter**. Consequences, from W4-A §5 cliff 3:

- Default cap: **2,000,000 tokens** (`scripts/central-code.mjs:35`).
- At ~4,850 tokens per Ask-the-Fire round trip, that is **412 grounded calls**.
- 412 × $0.035 = **$14.43 of grounding fees the cap never sees**, plus ~$1.60 of tokens.
- **The shipped 2M-token cap authorises ~$16/month per code and meters ~10% of it.**

**Required:** count grounded requests separately and meter in **cents**, not tokens.

### 3.2 🔴 B1 — the fail-open grant (confirmed at source)

```js
// worker/index.js:55-58
let rec;
try { rec = JSON.parse(raw); } catch { rec = { active: true }; }
if (rec.active === false) return json({ error: 'code_disabled' }, 403);
if (typeof rec.cap === 'number' && rec.cap > 0 && (rec.used || 0) >= rec.cap) { ... }
```

Traced: a malformed KV record yields a fallback object with **no `cap`**. `:57` passes (`active` is `true`). `:58` — `undefined` is not a `number` — **skips the quota check entirely**. `:77` applies the same guard to the metering block, so **`rec.used` is never incremented and the record is never rewritten**: the malformed record **never self-heals**. One corrupted byte converts a capped user into an unlimited, unmetered, permanent free rider — silently and unlogged.

**Fix:** `catch { return json({ error: 'invalid_code' }, 403); }` — fail closed.

### 3.3 🔴 B2 — "no limit specified" means "no limit"

Same guard, reachable without corruption. Any entitlement written without a `cap` is unlimited, and `cap: 0` is uncapped *by design* (`scripts/central-code.mjs:35`, `worker/README.md:58` documents `carol 0`). Acceptable for a free dev cohort; for a paid tier one mis-minted code is an unlimited subscription.

**Fix:** default to the plan's cap on absence; require an explicit `unlimited: true` sentinel so "uncapped" can never be reached by omission.

### 3.4 🟠 B5 — the entitlement is a shareable bearer string *(the real revenue leak)*

`randomBytes(9).toString('base64url')` — 12 chars, 72 bits (`scripts/central-code.mjs:36`), sent as `X-Access-Code` (`app.js:4215`). Not brute-forceable — that is fine. But it is a **bearer token with no device, account, or origin binding**, and `'Access-Control-Allow-Origin': '*'` (`worker/index.js:21`, the author's own "tighten for production" note) means any origin can present it.

**One paid code can serve a WhatsApp group of fifty.** This requires no bug at all. **There is no account system to bind it to** — verified: the only credential surfaces in `app.js` are an API-key paste field (`4490`) and the access code.

**Fix:** accounts, device cap, CORS locked to the app origin. **This is the largest single piece of unbuilt work between here and revenue.**

### 3.5 🟠 B3/B4 — lost updates and no rate limit

- **TOCTOU:** read at `worker/index.js:53`, write at `:84`, no atomicity. N parallel requests all read the same `rec.used`; last write wins. The author flags the eventual-consistency half at `:76`; the lost-update half is trivially exploitable by firing in parallel. **Fix:** a Durable Object counter ahead of the KV write.
- **No rate limiting anywhere.** The whole Worker is **91 lines** and contains no per-IP, per-code, or per-minute throttle. Verified independently in `app.js`: the only `debounce` is on the catalog search box (`2781`), the only `throttle` is a storage warning (`1441`) — **no AI call path is throttled, debounced, or deduplicated on either side.** One leaked code tapped at 1 req/sec = **$126/hour** in grounding fees; the 2M-token cap only intervenes after ~7 minutes.

### 3.6 🔴 The safety blocker — not a revenue item, a liability item

Voice Cook hands-free Q&A (`vcAskAI`/`vcAskFlow`, `app.js:5269-5300`) is **Tier D: no refusal filter, no numeric guard, no caveat, nothing** (W1-F §2). It hand-rolls its own Gemini caller with `google_search` enabled (`app.js:5278`) and **speaks the raw answer aloud** (`vcSpeak(answer, ansL)`, `5296`). W1-F §3 ranks it the **#1 hallucination surface** in the app: hands-free by design, zero guards, live-search injection surface, and the one place a wrong number reaches the user by voice with no visual caveat to catch it later.

**Giving away an unguarded spoken safety number and selling one are materially different liabilities.** This closes before any tier ships. It is also the flagship's headline feature, so fixing it is aligned with the revenue anyway.

### 3.7 🟡 B6 — quota exhaustion is invisible, breaking trust *and* the upgrade trigger

```js
// app.js:4226
if(mode==='managed' && [401,402,403].indexOf(r.status)>=0 && gemKey()){
  return gemFetch(model, body, Object.assign({}, opts, {key:gemKey()}));
}
```

On managed 402 (`quota_reached`) the app **silently** retries with the user's personal key. Sensible today; unacceptable once money is involved — a paying user starts spending their own Google quota with no notice, and the best upgrade trigger (§2.7 #6) never fires because the user never learns the limit exists.

### 3.8 🟠 TTS silently bills the owner — verified at source

```js
// app.js:5025-5030
async function gemSpeak(text, lang){
  const key=gemKey(); if(!key) throw new Error('no-key');
  ...
  const r=await gemFetch('gemini-2.5-flash-preview-tts', {...}, {timeout:20000});
```

`gemSpeak` fetches `gemKey()`, throws without one — then calls `gemFetch` **without** `opts.key`. Routing therefore falls to `gemMode()` (`app.js:5010`), which returns `'managed'` whenever a central URL and code are set, **regardless of whether a personal key exists**. A user with both configured has their premium TTS billed to the owner at $10/1M audio tokens, while the code reads as though the personal key gates it. Voice Cook calls this path from ~18 sites. **1 hour of continuous Voice Cook speech = $0.90.**

**Fix is one argument:** pass `{key:gemKey()}` — making the existing guard mean what it appears to mean.

### 3.9 Blocking list, ordered

| # | Item | Severity | Blocks |
|---|---|---|---|
| 1 | Guard `vcAskAI` (§3.6) | 🔴 | **any paid tier — safety, not revenue.** Worth doing even if the app stays free forever |
| 2 | Meter **cents**, not tokens; count grounded requests (§3.1) | 🔴 | any paid tier · any published allowance |
| 3 | B1 fail-closed on malformed record (§3.2) | 🔴 | any paid tier |
| 4 | B2 explicit `unlimited` sentinel; default cap on absence (§3.3) | 🔴 | any paid tier |
| 5 | B5 accounts + device cap + CORS origin lock (§3.4) | 🟠 | any paid tier |
| 6 | B3 atomic counter (§3.5) | 🟠 | any paid tier |
| 7 | B4 per-code and per-IP rate limiting (§3.5) | 🟠 | public launch |
| 8 | B6 surface quota state; make BYOK fallback explicit (§3.7) | 🟡 | the meter-exhaustion upgrade trigger |
| 9 | TTS BYOK routing (§3.8) | 🟠 | margin correctness |

`worker/README.md` already anticipates three of these. It does **not** mention the fail-open grant (#3) or the bearer-token sharing surface (#5) — the two most consequential.

---

## 4. Build order to reach revenue

### Stage 0 — Stop the bleeding *(do this whether or not you ever charge)* · ~1 week
Not revenue work. Pure cost and liability. **This is the stage that actually matters right now.**

1. **Gate `google_search` behind a live-info intent check** (`app.js:4249`, `5278`) — reuse the `askSafetyIntent` pattern already at `app.js:4114`. Blended cost **$1.22 → $0.39**; worst persona **$2.83 → $0.99**. Simultaneously narrows hallucination surface #3. *Highest-leverage change in this entire document.*
2. **Guard `vcAskAI`/`vcAskFlow`** (§3.6). The #1 hallucination surface, and it speaks.
3. **Per-code + per-IP rate limit** in the Worker (§3.5). Caps a $126/hour tail.
4. **Fail closed on malformed KV** (§3.2). One line.
5. **Pass `{key:gemKey()}` in `gemSpeak`** (§3.8). One argument.

*After Stage 0: 1,000 users cost ~$390/month with a bounded tail, versus $1,220/month with an unbounded one — and the app's worst safety gap is closed.*

### Stage 1 — Truth in advertising · ~1 week
6. Fix the offline contradiction: `build.py:334`, `README.md:4`, `app.js:3939`. Cheapest item on any list here, and it protects the trust everything else depends on.
7. Correct `docs/ai-strategy.md:77` — "Nobody owns the software-first AI copilot" is overstated; Time To Plate sells backward-planning across real appliances at $39–99/yr (W4-C §4.2). The accurate, weaker claim — *nobody combines capacity-aware planning with a cited safety corpus* — is still a good claim.

### Stage 2 — Make the differentiators true · weeks
8. The two plan-depth safety gates: thermometer gate, cure **block** (status-and-gaps §2A-1). Converts "guards your cure" from marketing into product — and it is the demo people retell.
9. Guest-count-scaled occupancy (status-and-gaps §2C-10). Makes the *uncontested* differentiator numerically honest before it is marketed.

### Stage 3 — Instrumentation *(required before any price is published)*
10. Server-side cost ledger: `usageMetadata.totalTokenCount` is **already parsed** at `worker/index.js:80` — add a grounded-request counter and store **cents per code per month**.
11. Minimal product analytics: install, first cook completed, AI calls by feature, cook completion, refusal-card impressions. **Today there is none** (verified §1.1). Run it for one month before publishing an allowance.

> **Hard gate: do not publish any allowance number until Stage 3 has produced one month of real data.** Every allowance in §2.3 is a reasoned starting point, not a finding.

### Stage 4 — Metering integrity *(the actual revenue blockers)*
12. **Accounts** — the largest unbuilt piece (§3.4). Everything else in this stage is small by comparison.
13. `unlimited: true` sentinel; default cap on absence (§3.3).
14. Durable Object atomic counter (§3.5).
15. Surface quota state; make the BYOK fallback an explicit user choice (§3.7).

### Stage 5 — Billing
16. Merchant-of-record (Paddle or Lemon Squeezy) — handles Israeli VAT, refunds, dunning. `worker/README.md` already names Paddle as the intended path. Annual-first, monthly secondary.

### Stage 6 — English
17. Close the 18 Hebrew-in-English toasts (status-and-gaps §2E-13), then market in English. **80–90% of obtainable revenue lives here** (W4-C §8).

### Genuinely required for a first paid tier vs. what can wait

| **Required** | **Can wait** |
|---|---|
| Stage 0 #1, #2, #3, #4 | Stage 0 #5 (TTS routing — margin, not correctness) |
| Stage 3 #10 (cost ledger in cents) | Stage 2 (#8, #9) — raises price ceiling, does not block charging |
| Stage 4 #12, #13, #14 | Stage 4 #15 |
| Stage 5 #16 | Stage 6, Pitmaster, B2B, one-time Pro Tools |
| Stage 1 #6 (the copy is a trust liability the moment money changes hands) | Stage 1 #7 |

---

## 5. Metrics to track, with definitions

**None of these can be measured today** — verified: zero instrumentation in `app.js` or `worker/index.js` (§1.1). Building the ledger and the event stream (Stage 3) is a prerequisite to every number below.

### North Star
**Completed cooks per active user per month** = distinct cook sessions reaching a rated journal entry ÷ users who opened the app that month.
*Why:* it is the value moment, it precedes every willingness-to-pay driver in `ai-strategy.md:104`, and for a seasonal product it is the only leading indicator of renewal.

### Cost — the metrics that actually decide this business
| Metric | Definition | Target |
|---|---|---|
| **Grounded-call ratio** | grounded requests ÷ total AI requests | **<15%.** Today ~100% of conversational calls. This single number moves 77–90% of COGS |
| **COGS per active user per month** | server-computed **dollars**: (tokens × rate) + (grounded calls × $0.035) + (TTS audio seconds × 25 tok/s × $10/1M). **Never tokens** | <$0.40 blended |
| **p99 COGS per user** | 99th percentile of the above | <$1.50. *The tail, not the mean, is what kills flat pricing* |
| **Gross margin per paying user** | (net revenue − COGS) ÷ net revenue | **≥75%** |
| **Grounded free-tier headroom** | grounded prompts used ÷ 45,000/mo (1,500 RPD free, per-project) | Alarm at 70% — cost steps from $0 to full rate at that line |

### Revenue
| Metric | Definition | Target |
|---|---|---|
| **Managed-AI attach rate** | users with a central code configured ÷ MAU | This is the addressable paid pool; the paid product *is* managed AI |
| **Trial→paid conversion** | reverse-trial users still paying 30 days after the trial drop | No baseline exists — first cohort sets it |
| **Annual mix** | annual subs ÷ all subs | **>70%** (BBQ is seasonal; monthly churns over winter) |
| **Net revenue retention** | annual-cohort revenue at renewal ÷ at signup | ≥90% |

### Product / trust
| Metric | Definition | Why |
|---|---|---|
| **Activation** | % of installs completing one cook within 30 days | The only funnel step that matters before pricing |
| **Copilot session rate** | cooks where `openCopilot` fired ÷ completed cooks | The flagship's real usage, versus its assumed usage |
| **Refusal-card impressions** | `askRefuse` (`app.js:4146-4197`) fires per 1,000 AI calls | `ai-strategy.md:52` calls this the marketing asset. If it never fires, the story is not happening |

---

## 6. Risks, and the honest case AGAINST monetising now

### 6.1 Risks, ranked by probability × damage

| | Risk | Evidence | Mitigation |
|---|---|---|---|
| 🔴 **R1** | **The meter does not hold.** Five independent defects (§3.2–3.5), each of which alone defeats it | Verified at `worker/index.js:21,53,56,58,77,84`; `scripts/central-code.mjs:35,36` | Stage 4. Non-negotiable |
| 🔴 **R2** | **Pricing on free-tier experience.** The 1,500 RPD grounded allowance is **per-project**, shared across the whole user base — 45,000/month total. Cost is **$0 up to that line then steps to full rate**: all-Persona-C, that is **725 users** | W4-A §5 cliff 2 | Model at full rate from day one; alarm at 70% headroom |
| 🟠 **R3** | **General assistants absorb the use case.** ChatGPT 900M WAU (Feb 2026), answers Hebrew cooking questions free | [TechCrunch](https://techcrunch.com/2026/02/27/chatgpt-reaches-900m-weekly-active-users) via W4-C R1 | Compete on *state + arithmetic + provenance*, never on answers |
| 🟠 **R4** | **A hardware vendor adds planning.** Weber already ships "Cook Plan"; MEATER ships Guided Cook™; Weber Connect already works with any grill | W4-C R2 | Lead time is the cited corpus and Hebrew — neither is worth a US vendor's effort |
| 🟠 **R5** | **Re-gating shipped features repeats Anova.** They charged $2/mo for a previously-free app and drew sustained documented backlash | [Engadget](https://www.engadget.com/home/kitchen-tech/anova-will-charge-customers-to-use-its-sous-vide-app-because-everything-must-be-a-subscription-151906912.html) via W4-C R5 | **Sell only Managed AI and live lookup — genuinely new capabilities.** Never re-gate the 13 features that ship free today |
| 🟠 **R6** | **Single-supplier margin dependency.** Gemini raised prices 2026-07-02 | W4-B §7.3 | The `GEM_HOST`/`GEM_URL` seam (`app.js:4205-4207`) and the Worker already abstract the provider — keep it that way |
| 🟡 **R7** | **Solo-builder operational load.** Refunds, 18% Israeli VAT, dunning, support, chargebacks | W4-B §7.6 | Merchant-of-record, annual-only if load bites |
| 🟡 **R8** | **The marketing claims exceed the code** on exactly the axes the product competes on | status-and-gaps §2A-1, §2C-10 | Stage 2 |

### 6.2 The honest case against monetising now

I would not charge yet, and here is the argument in full rather than as a caveat.

1. **The stated problem is misdiagnosed.** Today "100% of AI cost is subsidy with zero collection path" (W4-C R4). That reads as a revenue problem. It is a **cost** problem. Billing is the expensive solution; the search conditional is the cheap one and captures **68% of the gap in days**. Do the cheap thing first — it is not a stepping stone to billing, it is a substitute for needing billing this year.

2. **The return does not justify the build, yet.** Stages 3–5 are weeks-to-months of accounts, atomic counters, a cost ledger, and a payment integration. Israel Year-3 midpoint is **~$38k/yr** (W4-C §8) — *Year 3*, not now, and below one Israeli developer salary. The revenue lives in English (W4-C §8: $75k–195k Year 3), and **the bilingual switch is not flipped** (18 toasts still Hebrew in EN mode). Monetising before the English market exists optimises the small half.

3. **You cannot price what you cannot measure.** There is **no analytics anywhere** (verified §1.1). Every allowance in §2.3 — and every allowance in W4-B — is a reasoned guess. §2.4 shows what happens when a guess is off by 10.9×: a **−245% gross margin** on the app's most prominent button. One month of instrumentation is cheaper than one mispriced cohort.

4. **There is a safety item outstanding that charging makes worse.** `vcAskAI` speaks unguarded safety numbers aloud (§3.6). Giving that away and selling it are different legal and moral positions. It should be fixed regardless — but it is a hard gate on charging.

5. **Two of three marketed differentiators are not true in code.** "Guards your cure" is 0% built; capacity is guest-count-blind. Charging for a product whose headline claims the code does not honour is the fastest way to spend the goodwill that a small Hebrew community runs on — and W4-C §4.1 confirms that community is small enough to compare notes in one WhatsApp group.

6. **The shipped copy currently says the opposite of what the app does** (`build.py:334`, `README.md:4`). Taking money while the footer claims "no network connection" is the single most avoidable trust failure available.

7. **Free is currently the marketing.** `ai-strategy.md:52` is right that the refusal card is the viral asset, and it only spreads with no key, no payment, no account. The product has not yet had its growth phase. Monetising during acquisition, before the word-of-mouth engine has run, trades the top of the funnel for a few hundred dollars a month.

### 6.3 The case FOR monetising now, stated fairly

- Cost is real, growing, and unbounded: one leaked code at 1 req/sec is **$126/hour** (W4-A §5 cliff 4), and the shipped 2M-token cap authorises ~$16/month per code while metering ~10% of it (§3.1).
- Willingness to pay for the *adjacent* problem is externally validated: Time To Plate sells backward-planning at **$39–99/yr** (W4-C §4.1). The price band in §2.6 is mid-band, not aggressive.
- Charging early attracts users who intend to use the product, which is better usage data than free users generate.

**But note that the first bullet is an argument for cost control, not for billing** — and cost control is Stage 0.

### 6.4 The trigger conditions — when to revisit

Monetise when **all** of these are true, not before:

- [ ] Stage 0 shipped; blended COGS measured at **<$0.40/user/month** with a bounded tail
- [ ] Stage 3 has produced **one month of real usage data**, and the §2.5 weights are calibrated rather than assumed
- [ ] `vcAskAI` is guarded (§3.6)
- [ ] Blockers #3, #4, #5, #6 in §3.9 are closed
- [ ] The offline copy contradiction is fixed (`build.py:334`, `README.md:4`)
- [ ] English is complete enough to market — the 18 toasts closed

Realistically that is **~2 quarters** for a solo builder working part-time. Set the expectation now rather than discovering it in Stage 4.

---

## 7. What could not be verified — stated, not softened

- **Pro/thinking COGS is unmeasured.** W4-B's 2–5× thinking-token multiplier is a secondary-source figure. **This is why the third tier is deferred**, not merely deprioritised.
- **TTS allowance is a placeholder.** W4-A prices audio output at $10/1M from Google's page; W4-B found aggregators disagreeing by 4×. The 60 min/mo number in §2.3 is not a finding.
- **Persona call mixes are constructed, not observed** (W4-A §7). The per-call costs beneath them are hard measurements; the mixes are the soft input, and no analytics exists to harden them.
- **Israeli grill/smoker ownership** — no published survey exists (W4-C §7). Presented as a 40–70% scenario range, never a point estimate.
- **Israeli consumer-app willingness-to-pay in shekels** was not verifiable at useful specificity. Adapty's $27.0 average LTV for Israel is real and directionally supportive but is a blended per-user figure, not a niche WTP. **A Van Westendorp survey on the founder cohort would close this properly and cheaply.**
- **Grounded-prompt billing trigger** — Google's page bills per "grounded prompt"; whether that means *tool attached* or *tool invoked* is not stated unambiguously. Both readings are expensive here, because the tool is attached unconditionally (`app.js:4249`, `5278`).
- **No conversion baseline exists** — no analytics, no funnel, no billing. Every conversion assumption in this document is a starting point to be revised after one cohort.

---

*Repository claims cite `file:line` verified against the tree at v258. Market claims cite source URLs. Cross-references: `docs/analysis/sweep/W4-A-unit-economics.md`, `W4-B-pricing.md`, `W4-C-market.md`, `W1-F-ai.md`, `docs/analysis/2026-07-22-status-and-gaps.md`, `docs/ai-strategy.md`, `worker/index.js`, `worker/README.md`, `scripts/central-code.mjs`.*
