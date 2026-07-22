# W4-B — Pricing & Packaging Strategy

**Date:** 2026-07-22 · **Version:** v258 · **Author lens:** pricing & packaging strategist
**Method:** every product claim cites `file:line` in the current tree; every market claim cites a source URL.
Where a number could not be verified, it is marked **UNVERIFIED — measure before use** rather than softened.

**Baseline fact:** no billing, entitlement, or subscription code exists anywhere.
`grep -n "paddle|stripe|subscription|entitlement|billing|purchase"` over `app.js` + `worker/index.js` returns
only unrelated matches (Google Cloud Billing for TTS at `app.js:4493`, `5066`; a shopping list at `8931`).
This is a greenfield pricing design, not a migration.

---

## 0. The one decision that determines everything else

> **Deterministic ⇒ free forever. Probabilistic ⇒ metered.**

Not "safety is free because it's nice." Safety is free because **the entire safety layer is deterministic,
local, and costs $0 marginal to serve.** The economics and the ethics point the same way, which is the
rare case where a principled boundary costs nothing to hold. §3 argues this in full.

---

## 1. Tier structure

Three consumer tiers at launch (Good / Better / Best per the pricing-strategy skill's default), plus one
B2B tier deferred. A solo builder should not operate four billing surfaces on day one.

| | **אש · Ember** (Free) | **מדריך האש · Pit Pass** (anchor) | **רב-אש · Pitmaster** | **מדריך/כיתה · Instructor** (later) |
|---|---|---|---|---|
| **Price (IL)** | ₪0 | **₪29/mo · ₪249/yr** | **₪59/mo · ₪499/yr** | from ₪1,490/yr, per-seat |
| **Price (intl)** | $0 | **$8.99/mo · $59/yr** | **$17.99/mo · $129/yr** | contact |
| **Persona** | Every user. Weekend griller, first-time curer, the person who came for the cure calculator. | The serious hobbyist mid-cook: $80 brisket, 12 h, guests, no second chance. | Charcuterie makers, multi-event hosts, gear nerds, the 40-guest party. | Class teachers, catering, OEM. |
| **User level it fits** (`mk-uilevel`, `roadmap-vNext.md:40-46`) | מתחיל / beginner and up — **never gated by level** | בינוני / intermediate | מתקדם / advanced | — |
| **Managed AI** (no key) | **25 weighted actions/mo** — a taste, not a life | **400 / mo** | **1,500 / mo** | pooled per seat |
| **BYOK AI** | **Unlimited, free forever** (user's own key, owner cost $0) | Unlimited | Unlimited | Unlimited |
| **TTS** | — (system voice `sysSpeak` `app.js:5048` always free) | **60 min/mo** | **200 min/mo** | pooled |
| **Photo analysis** (`gemVision` `9296`) | — | ✅ (weight 3, calibrate per §2) | ✅ | ✅ |
| **Live Cook Copilot** (`openCopilot` `5503`) | Read-only: timers, stall detection, deterministic advice | ✅ full, incl. `copilotAskNow` `5448` | ✅ + hands-free Voice Cook | ✅ |
| **Model routing** (A2, `ai-strategy.md:65`) | flash | flash | **pro / thinking-on** for Diagnose + Event planner | pro |
| **Cloud sync / backup** | — (local only, today's behaviour) | ✅ | ✅ + version history | ✅ + class rosters |
| **Charcuterie Guardian · Personal Coach · probe-CSV ETA** | — | Guardian ✅ | ✅ all | ✅ |
| **Everything deterministic** (§3 list) | ✅ **100%, forever** | ✅ | ✅ | ✅ |

**Why the free tier gets unlimited BYOK.** It costs the owner exactly $0 (`gemFetch` routes BYOK straight to
Google, `app.js:4214`), it preserves the existing promise, and it makes the free tier genuinely generous rather
than crippled — which is what earns the word-of-mouth the category needs. The paid product is not *access to
AI*; it is **not having to care about an API key**, which `ai-strategy.md:96` correctly identifies as the real
ceiling ("95% of serious hobbyists won't create and paste an API key").

**On "user levels" as a pricing axis — do not do it.** The owner asked for tiers by user level. `mk-uilevel`
(beginner/intermediate/advanced, `roadmap-vNext.md:40-46`) is an excellent *packaging and defaults* signal and
a terrible *gate*. A beginner needs the safety layer more than an advanced user and will pay less for it;
pricing on level inverts safety exactly where it matters most. Use level to choose which tier to *recommend*
and how to configure defaults on signup — never to withhold a capability.

---

## 2. Resource consumption — the metering model

### 2.1 The unit: meter tokens internally, sell "actions" externally

The Worker already meters the correct thing: `j.usageMetadata.totalTokenCount` (`worker/index.js:80`),
accumulated into `rec.used` against `rec.cap` (`:58`, `:77-87`), default cap **2,000,000 tokens/user/month**
(`scripts/central-code.mjs:35`). Tokens are the right internal unit and are already wired. They are a terrible
external unit — no cook knows what a token is. Sell **weighted AI actions** and publish the conversion.

### 2.2 Measured per-feature cost drivers

All values are `maxOutputTokens` read directly from the call sites — these are **ceilings, not typical usage**:

| Feature | `app.js` | max out | Search | Notes |
|---|---|---|---|---|
| Ask the Fire | `4250` | 1600 | ✅ `4249` | most expensive text path |
| Recipe generator | `8567` | 1600 | — | |
| Event planner | `8318` | 1500 | — | |
| What can I make | `8186` | 1400 | — | |
| Journal insights · Pantry advisor | `8650`, `9173` | 1200 | — | `aiJSON` default is 1200 (`4339`) |
| Diagnose | `8479` | 1100 | — | |
| Seasoning rec | `8411` | 1000 | — | |
| Equipment lookup · Brand models | `6337`, `6373` | 900 / 700 | ✅ | |
| **Photo analyzer** | `9299` | 800 | — | **+ image input tokens — unmeasured** |
| **MT translate** | `6974` | 600 | — | **per element, automatic — see §2.4** |
| Voice Cook Q&A | `5279` | 400 | ✅ `5278` | |
| Copilot "what now" | `5195` | 300 | — | cheapest, highest value |
| **TTS** | `5030` | — | — | **audio output tokens — cost unresolved, §2.5** |

Every call runs `thinkingConfig:{thinkingBudget:0}` on `gemini-2.5-flash` (`4206`), so today there is no
thinking-token multiplier. **Tier 3's pro/thinking routing changes that materially** — thinking tokens bill at
the output rate and can multiply output volume 2–5× ([CloudZero](https://www.cloudzero.com/blog/gemini-pricing/)).
Pitmaster is priced to absorb it; do not enable pro routing on Pit Pass.

### 2.3 Proposed weights and the resulting cost ceiling

| Action class | Weight | Rationale |
|---|---|---|
| Text action (ask, diagnose, wcim, advisor, planner, seasoning, recipe-gen, insights, copilot) | **1** | ≤1600 out |
| Photo analysis | **3** | image input dominates; **calibrate from `usageMetadata`, do not ship the 3 as a guess** |
| Pro/thinking action (Pitmaster) | **4** | thinking multiplier above |
| TTS | separate **per-minute** meter | different cost class entirely |
| MT hydration | **0 — never charge the user** | automatic, not user-initiated (§2.4) |

Gemini 2.5 Flash is **$0.30 in / $2.50 out per 1M tokens**, raised 2026-07-02
([CloudZero](https://www.cloudzero.com/blog/gemini-pricing/); primary source `ai.google.dev/gemini-api/docs/pricing`
was unreachable from this environment — **re-verify against Google before committing prices**).

At a representative 1,500 input (grounding is substantial — `SAFETY_FACTS()` + catalog) + 1,200 output:
**≈ $0.0035 per text action.** Therefore:

| Tier | Actions/mo | Text COGS ceiling | Price net of VAT | Gross margin before TTS |
|---|---|---|---|---|
| Free | 25 | **~$0.09** | $0 | −$0.09 (acquisition cost, trivially affordable) |
| Pit Pass | 400 | **~$1.40** | ~$4.85/mo (₪249/yr ÷ 12 ÷ 1.18) | **~71%** |
| Pitmaster | 1,500 (mixed, w/ pro) | **~$8–12 UNVERIFIED** | ~$9.75/mo | thin — **must be measured before launch** |

The existing 2,000,000-token default cap is worth ~740 actions at this mix — i.e. **the cap already shipped is
roughly Pitmaster-sized**, and costs at most **~$2.58/user/month** if fully consumed (1.1M in × $0.30 +
0.9M out × $2.50). That is a comfortable ceiling and a good sanity check that this product is cheap to serve.

### 2.4 MT hydration is an uncapped cost leak — remove it from the meter *and* from the runtime

`hydrateMT` (`app.js:6987`) fires on every language switch, **one API call per `[data-mt]` element**, 600 output
tokens each (`6974`). Two compounding problems:

1. **The user never asked for it.** Charging a user's allowance for automatic translation of a screen they
   merely opened is a trust break, and it means a non-Hebrew user can exhaust a paid allowance on zero
   perceived value.
2. **The cache has a cliff.** `if(Object.keys(cache).length<3000) store.set('mk-mtcache',cache)` (`6981`) —
   once `mk-mtcache` reaches 3,000 entries the app **still translates but stops persisting**, so every
   subsequent language switch re-translates every new string forever, per device, at full cost.

**Recommendation:** move MT to build time. The code already prefers a pre-translated dictionary —
`if(d && d[src]!=null){ el.textContent=d[src]; return; }` (`6993`) short-circuits before any API call. Populating
that dictionary at build removes MT from the cost model entirely and makes non-Hebrew UX instant and offline.
This is a cost fix and a UX fix in one change.

### 2.5 TTS pricing is unresolved — measure it, do not guess

`gemSpeak` routes `gemini-2.5-flash-preview-tts` through the **same metered proxy** (`app.js:5030` → `gemFetch`),
so TTS audio tokens already count against `rec.cap`. Secondary sources disagree on the audio output rate —
$2.50/1M vs $10.00/1M per two independent aggregators. **That 4× spread is the difference between a 60 min/mo
TTS allowance being trivial and being the dominant COGS line.** Do not set the TTS allowance until it is
measured from `usageMetadata` on a real synthesis. The existing 40-entry `gemCache` (`5038`) already helps.

---

## 3. The free/paid boundary — argued explicitly

### 3.1 What must stay free, permanently, on every tier

Everything below is **deterministic, local, and makes zero API calls**:

| Mechanism | `file:line` | Why it is safety-bearing |
|---|---|---|
| `AI_REFUSALS` / `askRefuse` | `app.js:4146-4197` | Pure regex pre-filter. Fires **before** any network call — the no-nitrite botulism card (`4157`) needs no key, no payment, no connection. |
| `cureScaleGuardHTML` | `app.js:1849` | Hard warning naming botulism risk when the dose is below scale readability; fails safe with no scale registered (`status-and-gaps.md:12`). |
| `SAFETY_FACTS()` | `app.js:4127-4129` | The vetted numeric anchor corpus. |
| `UMAKE_CALC` cure/salt dosing | `app.js:8571` | Safety numbers are app presets, never model output. |
| `mtNumSig` / `mtSafe` numeric invariant | `app.js:6956-6958` | Rejects any translation that alters a number. |
| Cited sources | 279 `"src"` blocks, build-merged from `sources.py` | `tests/data-integrity.spec.ts` asserts every cut carries one. |
| `bcheck` internal-temp gate, background alarms, timers, scheduler, occupancy, journal | per `status-and-gaps.md:23` | Operational safety spine. |

Also free by the same logic: the **deterministic fallbacks** `wcimLocal`, `pantryAdvisorLocal`, `askFire`
(`ai-strategy.md:25`), which compute locally first and let AI merely enrich. This makes meter exhaustion
*humane* — a free user who runs out degrades to a working deterministic answer, never to a dead end.

### 3.2 Three independent reasons the boundary sits exactly here

**1 · Ethical.** A cure-dosing error is a botulism risk. If the refusal card sits behind a paywall, the
non-paying user receives a *measurably less safe* product than the paying one. That is indefensible for a
food-safety product, and it is worse than indefensible for the beginner cohort (`mk-uilevel` = מתחיל), who
need the guard most and pay least.

**2 · Economic — this costs nothing to give away.** Every mechanism in §3.1 is deterministic and local:
marginal cost **$0**. There is no revenue being sacrificed. A "free safety tier" is not generosity requiring
justification to a CFO; it is the absence of a cost. Any pricing model that gated these would be trading a
real reputational and legal liability for zero margin.

**3 · Strategic — the free thing *is* the marketing.** `ai-strategy.md:52` is right that the killer demo is the
app **refusing** a dangerous idea with a citation. That demo only spreads if it is reachable with no key, no
payment and no account. Gating it would paywall the single most viral asset the product has.

### 3.3 The obligation that monetizing creates

Charging changes the posture from "free hobby app" to "paid product with a duty of care." Two consequences:

- **Guards must be identical on every tier.** A paid user must never receive *less*-guarded output. The
  guard stack (`askRefuse`, `aiSafetyNote`) is a property of the feature, never of the plan.
- **`W1-F` §2 Tier-D must be closed before any tier ships.** Voice Cook hands-free Q&A
  (`vcAskAI`/`vcAskFlow`, `app.js:5269-5300`) has **no refusal filter, no numeric guard, no caveat** — it
  hand-rolls its own Gemini caller with `google_search` enabled (`5278`) and **speaks the raw answer aloud**
  (`vcSpeak(answer, ansL)`, `5296`). Selling an unguarded spoken safety number is a materially different
  liability from giving one away. **This is a launch blocker for the paid tier, not a backlog item.**
  It is also the flagship's headline feature, so fixing it is aligned with the revenue anyway.

---

## 4. Upgrade triggers — where the paywall goes

Ranked by the paywall-upgrade-cro principle *value before ask*.

### 4.1 🥇 The BYOK key wall — highest volume, zero risk

**Trigger:** user taps any AI feature with no key configured → `openKeyManager` (`app.js:4512`).
**Why:** this is the exact friction `ai-strategy.md:96` names as the ceiling. Today the user is asked to go
create a Google Cloud project. The upgrade offer is strictly *less* work than the status quo.
**Copy:** "או דלג על המפתח לגמרי — Pit Pass" / "Or skip the key entirely." Keep BYOK visible and free beside it;
the contrast *is* the pitch.
**Frequency:** every time, because it is a genuine choice point, not an interruption.

### 4.2 🥈 Hour 7 of a brisket — highest intent, **must not be a hard gate**

**Trigger:** `copilotAskNow` (`app.js:5448`, button `#copAskNow` `5503`) during an active cook.
**Why:** `ai-strategy.md:80` — "$80 brisket + 12h + guests + no second chance → the dominant emotion is fear
of ruining it." Peak willingness to pay.
**The critical design rule: never hard-gate mid-cook.** The user is beside a live fire, with greasy hands, at
390 px, possibly at 3 a.m. A payment form there is a betrayal, and it will be remembered as one. Instead:

- Grant an **emergency allowance** — let the live cook finish on the house even past the free meter.
- Show a **non-blocking** line in the copilot: "Pit Pass users get unlimited copilot. We've got you for
  tonight — sort it out after the cook."
- **Convert at cook-end**, on the journal/rating screen, when the brisket is on the board and the emotion is
  relief and gratitude rather than panic.

This costs a few actions and buys the goodwill that a subscription business actually runs on.

### 4.3 🥉 Cook completion → journal → coach

**Trigger:** after a completed cook is rated; `aiJournalInsights` (`8646`), `#jInsights` (`3637`).
**Why:** classic *value received* moment, and it is the retention pitch, not just the acquisition one —
"your 5★ briskets all rested >45 min and wrapped ~70°C" (`ai-strategy.md:87`) is a switching-cost moat.
**Personalize it:** show real counts from their own journal ("you've logged 11 cooks and 4 five-star results").

### 4.4 Photo analysis — the clean feature gate

**Trigger:** first tap of `openPhotoAnalyze` (`app.js:9310`).
**Why:** visually obvious, feels expensive, delivers instantly, and is genuinely a paid-tier cost (image
input tokens). Give **one free lifetime analysis** so the value is experienced before the ask — a preview of a
bark read converts far better than a description of one.

### 4.5 Cloud sync — loss aversion, correctly timed

**Trigger:** second device detected, or journal crossing ~20 entries. Journal/projects are local-only today
(`ai-strategy.md:101`).
**Why:** "don't lose my history" ranks #4 in the WTP list (`ai-strategy.md:104`). Frame as protection, never
as hostage-taking — the data must remain exportable on the free tier. Holding user data hostage is the
trust-destroyer the CRO skill explicitly names.

### 4.6 Meter exhaustion — soft, because the fallback is real

**Trigger:** free allowance hits 25 weighted actions.
**Design:** never a dead end. The deterministic fallbacks (`wcimLocal`, `pantryAdvisorLocal`, `askFire`) still
answer. Show "AI enrichment paused until 1 Aug — the calculators and the plan are unchanged." Warn at 75%.
**Never** exhaust the meter mid-cook (§4.2).

### 4.7 Where a paywall must never appear

Any surface in §3.1. Additionally: never on `askRefuse` output. A user asking "can I skip the pink salt?" must
get the botulism card instantly, free, forever — that is the product's soul and its best advertisement.

---

## 5. Price points and reasoning

### 5.1 Israel — ₪249/yr Pit Pass, VAT-inclusive

- **VAT must be included in the displayed consumer price.** Israel charges **18%** on B2C digital services
  supplied by foreign and domestic providers, raised from 17% on 2025-01-01 and still 18% in 2026
  ([Quaderno](https://quaderno.io/guides/israel-vat-guide/), [vatcalc](https://www.vatcalc.com/vat/israel-vat-rise-to-19-jan-2026-proposal/)).
  ₪249 gross = **₪211 net**.
- **Israel is a genuinely premium market.** It has the **highest average LTV in the dataset at $27.0**, third
  on the global table behind Switzerland ($28.5) and Qatar ($27.5)
  ([Adapty, State of in-app subscriptions 2026](https://adapty.io/blog/mobile-app-monetization-2026/)).
  Under-pricing the home market is the common error here.
- **Zero Hebrew-language competition.** The competitive set (MEATER, Traeger, AmazingRibs Pitmaster Club at
  $34.95/yr) is English-only and hardware-tethered. There is no local reference price to be anchored down by.
- **`ai-strategy.md:101` proposed ₪199–249/yr.** Take the **top** of that range. At ₪199 the annual net is
  ₪169 against a text-COGS ceiling of ~₪62/yr plus unmeasured TTS — a margin too thin for a solo builder to
  absorb a single heavy-usage cohort, especially after the 2026-07-02 Gemini price rise.
- **Monthly ₪29 exists to make ₪249/yr look correct** (8.6 months) and to serve the seasonal user. BBQ is
  seasonal, so **annual is the hero price** (`ai-strategy.md:104`) — default the toggle to annual.

### 5.2 International — $59/yr Pit Pass

- **Net-of-VAT parity, not a discount.** ₪249 incl. 18% VAT = ₪211 ≈ **$57 net**; the international price of
  **$59** is the same net price. The tiers are priced identically; only the tax display differs. This is far
  more defensible than an explicit geographic premium and survives a customer comparing the two pages.
- **Anchored just above AmazingRibs' $34.95/yr** — the correct anchor per `ai-strategy.md:101`. The premium is
  justified because that product is content; this one is a live copilot with cited safety data.
- **$8.99/mo** sits under the $10 psychological line while making the annual save ~45%.
- Pitmaster at **$129/yr** must absorb pro/thinking routing — hold this price until §2.3's COGS is measured.

### 5.3 Launch mechanics

| Item | Recommendation |
|---|---|
| **Founder cohort** | ₪199/yr / $49/yr, **lifetime-locked**, first 200 users. Below-margin by design; buys testimonials and the real usage distribution that §2.3 currently lacks. |
| **Trial** | **Reverse trial** — 14 days of full Pit Pass on signup, then drop to Free. The product's value (a 12 h cook) needs a long window, and the drop-to-free landing is safe because the deterministic layer keeps working. Card **not** required. |
| **Existing beta cohort** | Grandfather permanently. They hold uncapped/`carol 0`-class codes (`worker/README.md`) and are the source of the goodwill. |
| **Price testing** | New-customer only, per the pricing-strategy skill. Never A/B the same page — a Hebrew hobbyist community this small **will** compare prices in a WhatsApp group. |

---

## 6. Metering integrity — the pricing model presumes metering that holds. It does not.

Every number in §1–§5 assumes the meter is enforceable. **It currently is not.** These are blocking.

### 6.1 🔴 B1 — the fail-open grant (confirmed)

```js
// worker/index.js:56
let rec;
try { rec = JSON.parse(raw); } catch { rec = { active: true }; }
```

A malformed KV record produces a fallback object with **no `cap` field**. Trace the consequences:

- `:57` `rec.active === false` → false → passes.
- `:58` `typeof rec.cap === 'number'` → `undefined` is not a number → **the quota check is skipped entirely.**
- `:77` same guard on the metering block → **`rec.used` is never incremented and the record is never
  rewritten** → the malformed record **never self-heals**. The grant is permanent, silent, and unlogged.

Net: one corrupted byte in KV converts a capped user into an **unlimited, unmetered, permanent** free rider.

**Fix:** fail **closed** — `catch { return json({ error: 'invalid_code' }, 403); }`.

### 6.2 🔴 B2 — absence of a limit is treated as absence of a limit

The same root cause as B1 but reachable without corruption: `typeof rec.cap === 'number' && rec.cap > 0`
(`:58`) means **any** entitlement written without a `cap` is unlimited, and `cap: 0` is uncapped *by design*
(documented: `central-code.mjs add carol 0 # uncapped`, `worker/README.md`). For a free hobby cohort that is a
convenience. For a paid tier it is a provisioning bug waiting to happen — one mis-minted code is an unlimited
subscription. **Fix:** default to the plan's cap when absent; require an explicit `unlimited: true` sentinel
for the intentional case, so "uncapped" can never be reached by omission.

### 6.3 🟠 B3 — TOCTOU on the usage counter

Read at `:53`, write at `:84`, with no atomicity. Concurrent requests all read the same `rec.used` and the last
write wins, so N parallel calls can increment by one call's tokens. The author flags the eventual-consistency
half of this at `:76` ("KV is eventually consistent — fine for a small dev cohort"); the lost-update half is
the sharper problem because it is trivially exploitable by firing requests in parallel.
**Fix:** a Durable Object counter (or a short-TTL atomic counter) ahead of the KV write.

### 6.4 🟠 B4 — no rate limiting of any kind

The whole Worker is 91 lines and contains **no per-IP, per-code, or per-minute throttle**. The only control is
a *monthly cumulative* cap, which B1–B3 can each defeat. Cloudflare's platform DDoS protection is the sole
backstop. **Fix:** per-code and per-IP rate limits, independent of the monthly cap.

### 6.5 🟠 B5 — the entitlement is a shareable bearer string (the real revenue leak)

An access code is `randomBytes(9).toString('base64url')` — 12 chars, 72 bits (`central-code.mjs:37`), sent as
`X-Access-Code` (`app.js:4215`). Not brute-forceable, which is fine. But it is a **bearer token with no device,
account, or origin binding**, and `Access-Control-Allow-Origin: '*'` (`worker/index.js:21`, the author's own
"tighten for production" note) means any origin can present it. **One paid code can serve a WhatsApp group of
fifty.** For a free dev cohort this is irrelevant; for a paid tier it is the primary leak, and it is distinct
from B1 because it requires no bug at all.
**Fix:** bind the entitlement to an account, cap concurrent devices, and restrict CORS to the app origin.

### 6.6 🟡 B6 — quota exhaustion is invisible, which breaks both trust and the upgrade trigger

```js
// app.js:4226
if(mode==='managed' && [401,402,403].indexOf(r.status)>=0 && gemKey()){
  return gemFetch(model, body, Object.assign({}, opts, {key:gemKey()}));
}
```

On managed 402 (`quota_reached`), the app **silently** retries with the user's personal key. Sensible UX today;
unacceptable once money is involved. A paying user who hits their cap starts spending their own Google quota
with no notice — and the single best upgrade trigger (§4.6) never fires because the user never learns the
limit exists. **Fix:** surface an explicit "managed quota reached" state with the upgrade path, and make the
BYOK fallback an explicit user choice.

### 6.7 🟡 B7 — the meter sells tokens but the product sells actions

`rec.cap` is denominated in tokens; §1 sells weighted actions. The mapping must be authoritative and
server-side. Fortunately `usageMetadata.totalTokenCount` is **already parsed** at `:80` — the calibration data
needed to set the §2.3 weights honestly is one logging change away. **Do this before publishing any allowance
number**, particularly the photo weight and the TTS minute.

### 6.8 Ordered remediation

| # | Item | Severity | Blocks |
|---|---|---|---|
| 1 | **B1** fail-closed on malformed record | 🔴 | any paid tier |
| 2 | **B2** explicit `unlimited` sentinel; default cap on absence | 🔴 | any paid tier |
| 3 | **B5** account binding + device cap + CORS origin lock | 🟠 | any paid tier |
| 4 | **B3** atomic counter | 🟠 | any paid tier |
| 5 | **B4** rate limiting | 🟠 | public launch |
| 6 | **B6** surface quota state | 🟡 | the §4.6 trigger |
| 7 | **B7** calibrate weights from `usageMetadata` | 🟡 | publishing allowances |
| 8 | **W1-F Tier-D** guard on `vcAskAI` (§3.3) | 🔴 | any paid tier — *safety, not revenue* |
| 9 | **§2.4** MT to build time | 🟡 | margin correctness |

Items 1–4 and 8 are the launch gate. `worker/README.md` already anticipates three of these
("for production you'd tighten `Access-Control-Allow-Origin` … and swap codes for Paddle subscription
entitlements") — this section makes the list complete and ordered, and adds the two the README does not
mention: **the fail-open grant (B1) and the bearer-token sharing surface (B5).**

---

## 7. Risks and open questions

1. **Pitmaster margin is unverified.** Pro/thinking routing's 2–5× thinking-token multiplier is a secondary-source
   figure and the tier's COGS is a range, not a number. **Do not launch Pitmaster until §2.3 is measured.**
   Launch Free + Pit Pass first; Pitmaster can follow in a month with real data.
2. **TTS cost spread is 4×** (§2.5). The 60/200-minute allowances are placeholders.
3. **Gemini raised prices on 2026-07-02** ([CloudZero](https://www.cloudzero.com/blog/gemini-pricing/)) — a
   single-supplier margin dependency. The `GEM_HOST`/`GEM_URL` indirection seam (`app.js:4205-4207`) and the
   Worker already abstract the provider, so a switch is cheap; keep it that way.
4. **No conversion baseline exists.** There is no analytics, no funnel, and no billing. Every allowance in §1
   is a reasoned starting point to be revised after one cohort, not a finding.
5. **Israeli consumer-app WTP in shekels was not verifiable** at the specificity needed. The Adapty LTV figure
   ($27.0) is real and directionally supportive but is a blended per-user LTV, not a niche-specific WTP for a
   Hebrew BBQ app. Van Westendorp on the founder cohort would close this properly and cheaply.
6. **Solo-builder operational load.** Subscriptions bring refunds, VAT filing, dunning, and support. A
   merchant-of-record (Paddle/Lemon Squeezy) that handles Israeli VAT is strongly preferable to raw Stripe
   here; `worker/README.md` already names Paddle as the intended path.

---

*Cross-references: `docs/analysis/sweep/W1-F-ai.md` (the 13-feature inventory and the Tier-D gap),
`docs/ai-strategy.md` Part D, `docs/analysis/2026-07-22-status-and-gaps.md`, `worker/index.js`,
`worker/README.md`, `scripts/central-code.mjs`.*

*Sources: [CloudZero — Gemini pricing](https://www.cloudzero.com/blog/gemini-pricing/) ·
[Adapty — State of in-app subscriptions 2026](https://adapty.io/blog/mobile-app-monetization-2026/) ·
[Quaderno — Israel VAT guide](https://quaderno.io/guides/israel-vat-guide/) ·
[vatcalc — Israel VAT 2026](https://www.vatcalc.com/vat/israel-vat-rise-to-19-jan-2026-proposal/)*
