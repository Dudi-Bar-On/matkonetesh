# Matkonet — managed-AI proxy (dev access)

A tiny Cloudflare Worker that holds **your** Gemini key server-side and lets **selected users** run the app's AI through it via a per-user **access code**. Everyone without a code keeps using their own key (BYOK). Nobody ever sees your key.

```
App  →  this Worker (key + per-user codes)  →  Gemini
        ├─ valid code → proxy with YOUR key   (you + invited users)
        └─ no code     → 4xx → app uses the user's own key  (BYOK)
```

## One-time setup (~10 minutes)

You'll run these yourself — I can't log into your Cloudflare account. In this chat you can prefix a command with `!` to run it and paste the output back to me if anything snags.

**0. Prereqs** — a (free) Cloudflare account and Node installed.

**1. Install Wrangler locally (no global/admin) + log in** — run from the repo, in the `worker/` folder:
```
cd worker
npm install
npx wrangler login
```
`npx wrangler login` opens a browser — approve access to your Cloudflare account there. (All commands below run from `worker/` and use `npx wrangler`, i.e. the copy installed here.)

**2. Create the KV namespace for access codes**
```
npx wrangler kv namespace create CODES
```
Copy the printed `id` into `worker/wrangler.toml` (replace `REPLACE_WITH_KV_ID`).

**3. Give the Worker your Gemini key** (the same key you use for BYOK today)
```
npx wrangler secret put GEMINI_KEY
```
Paste the key when prompted. It's stored encrypted server-side — never in the repo.

**4. Deploy**
```
npx wrangler deploy
```
Wrangler prints your Worker URL, e.g. `https://matkonet-ai.<your-subdomain>.workers.dev`. Copy it.

**5. Sanity check** — open that URL in a browser; you should see `{"ok":true,"service":"matkonet-ai","hasKey":true}`.

**6. Mint a code for yourself** (run from the repo root)
```
node scripts/central-code.mjs add me
```
It prints a `CODE`.

**7. Turn it on in the app**
App › **Manage AI › Central access (dev)** → paste the **Server URL** (step 4) and the **Access code** (step 6) → **Save & test**. You should see *"✓ Central access is live."* The app now uses your central key; you no longer need a personal key on this device.

## Inviting / removing users
```
node scripts/central-code.mjs add alice            # mint a code, hand it to Alice
node scripts/central-code.mjs add bob 500000       # mint with a 500k-token/month cap
node scripts/central-code.mjs add carol 1000000000 # effectively unlimited (an EXPLICIT high cap)
node scripts/central-code.mjs audit                # pre-deploy: list records the Worker would refuse
node scripts/central-code.mjs list                 # see all codes
node scripts/central-code.mjs show <code>          # label / cap / tokens used
node scripts/central-code.mjs revoke <code>        # instant lockout
```
Each code carries a **token cap** (default 2,000,000/user) so one code can never run up your bill — over the cap the Worker returns 402 and that user's app falls back to their own key (or shows "quota reached").

> **A cap is MANDATORY** (owner ruling, 2026-07-30 · Phase 1 Task 7). A record whose `cap` is missing,
> zero, negative or non-numeric is refused with `403 code_uncapped` — the old `cap: 0 = uncapped`
> convention is **gone**, and a code minted under it stops working the moment the hardened Worker is
> deployed. Express "unlimited" as an explicit high number instead. **Before deploying, run
> `node scripts/central-code.mjs audit`** — it lists every stored record the hardened Worker would
> refuse (codes masked, nothing sensitive printed) and exits non-zero if any exist.

## What it costs (verify current pricing before you rely on it)
- **Cloudflare Workers + KV:** free tier (100k req/day) is plenty for a dev cohort → **$0**. (The $5/mo Workers Paid plan only if you want more headroom later.)
- **Gemini API:** you pay for tokens your central key spends. Light usage ≈ **a few $/month**; your own testing on Gemini's free tier ≈ **$0** (free-tier prompts may be used for training — switch to the paid tier before real users). Rough estimate ≈ $0.02–0.05 per cook.

## Notes
- **Security:** the key lives only as a Worker secret. Codes live in KV; revoke instantly. For production you'd tighten `Access-Control-Allow-Origin` to your app's origin and swap codes for Paddle subscription entitlements.
- **Wrangler is a local devDependency** (`worker/package.json`) — always call it via `npx wrangler …` from `worker/`. No global install / admin needed. (It uses `kv key …` syntax, wrangler ≥3.90 / v4.)
- **This is the dev/beta form** of the managed tier from the architecture research (`docs/research/04a-architecture.md`); the production path adds subscription auth + a fair-use cap on top of the same Worker.

## Phase 1 hardening contract (P0-worker)
- Every code record REQUIRES `{"active":true,"cap":<positive tokens>,"used":<n>}` — a record without
  a positive numeric cap is refused (`403 code_uncapped`). Set caps when issuing codes.
- CORS allowlist: `https://matkonetesh.pages.dev` + `http://localhost:8123` by default; override with
  the plain var `ALLOWED_ORIGINS` (comma-separated) in wrangler.toml `[vars]` — never a secret there.
- `:streamGenerateContent` is closed (404). Rate limit: 20 req/min per code per isolate → 429+Retry-After.
- Keys: `GEMINI_KEY` remains ONLY a Worker secret (`wrangler secret put GEMINI_KEY`). Never in the repo.
