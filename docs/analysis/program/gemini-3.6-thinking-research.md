# gemini-3.6-flash "thinking" — how it is controlled on the Gemini Developer API, and the migration recipe

**Status:** VERIFIED empirically against the live Gemini Developer API (`generativelanguage.googleapis.com/v1beta`, `:generateContent`), 2026-07-23, via `scripts/model-diag.mjs` run in the `model-diag` CI workflow with the owner's `GEMINI_EVAL_KEY`.
**Scope of the question:** can the live-fire cooking PWA migrate from `gemini-2.5-flash` (thinking off via `thinkingBudget:0`) to `gemini-3.6-flash` without an uncontrolled thinking-token cost blowup.

> **Method note (per CLAUDE.md §10.11 and the "docs were wrong before" rule).** The graphify **global** graph was queried first — it holds no Gemini API vocabulary (`thinkingbudget`, `thinkinglevel`, `generativelanguage`, `flash` all return *No matching nodes found*; `gemini` matches only GSD methodology references to the Gemini **CLI**). So the web was the fallback for the docs, and **every doc claim was then confirmed against the real API** — because the last time this migration was attempted, the diagnosis written into the code was wrong (see the "correction" box below).

---

## TL;DR

- **Is 3.6-flash "always thinking"? No — it is controllable, just not via `thinkingBudget:0`.** Gemini 3.x replaced the numeric `thinkingBudget` toggle with an enum **`thinkingLevel`** (`"minimal" | "low" | "medium" | "high"`). `gemini-3.6-flash` **rejects `thinkingBudget:0` with 400**, but **accepts `thinkingLevel:"minimal"`**, and on the app's short structured calls **`minimal` produced `thoughtsTokenCount: 0`** — i.e. effectively no thinking, the same outcome 2.5-flash gets from `thinkingBudget:0`.
- **Minimal-thinking config that works:** `generationConfig:{ thinkingConfig:{ thinkingLevel:"minimal" } }` (nested under `thinkingConfig`; top-level `thinkingLevel` is a 400).
- **Cost verdict:** the *thinking* blowup is fully avoidable — `minimal` → 0 thinking tokens on short calls, so no thinking-token surprise. The residual cost change is purely the **base price tier**: 3.6-flash is **$1.50/1M in · $7.50/1M out** vs 2.5-flash **$0.30/1M in · $2.50/1M out** — ~5× input, ~3× output — a pricing decision, *not* a thinking blowup. Thinking tokens are billed at the output rate. (The trap is migrating **without** `thinkingLevel:"minimal"`: 3.6 baseline spent **310 thinking tokens** on a one-line arithmetic prompt — those would dominate the billed output of a short structured call.)
- **Migration = two edits per call site:** `GEM_MODEL='gemini-3.6-flash'` and swap `thinkingConfig:{thinkingBudget:0}` → `thinkingConfig:{thinkingLevel:'minimal'}`. Nothing else changes.

---

## Correction to the app's own revert note (important)

`app.js:4206` currently reads:

> `const GEM_MODEL='gemini-2.5-flash';   // 3.6-flash REVERTED 2026-07-23: returned api-400 on EVERY call … 'gemini-3.6-flash' is not a valid id on this endpoint (likely Vertex-only).`

**That diagnosis is refuted by the empirical run.** `ListModels` on the developer API returns `models/gemini-3.6-flash` (it is a valid id on `generativelanguage`, **not** Vertex-only), and a minimal call, a `google_search` call, and the migration-candidate call all return **OK**. Every app call 400'd for one reason only: all 8 call sites hard-code `thinkingConfig:{thinkingBudget:0}`, and **3.6-flash rejects `thinkingBudget:0`**. "Every call fails" *looked* like a bad model id; it was a single rejected field. This is a textbook Occam case (discipline §12.2): one field, not a Vertex-only model.

---

## Question 1 — Is 3.6-flash always thinking? What is the control surface?

**Not always thinking — controllable via `thinkingLevel`.** Primary docs + empirical confirmation:

### The `thinkingConfig` surface (REST v1beta `generateContent`)
```json
{
  "generationConfig": {
    "thinkingConfig": {
      "thinkingLevel": "minimal",   // Gemini 3.x: "minimal" | "low" | "medium" | "high"
      "thinkingBudget": 1024,       // Gemini 2.5 series: integer token budget; 0 = off (3.x rejects 0)
      "includeThoughts": false      // whether thought SUMMARIES are returned; does NOT change billing
    }
  }
}
```

- **`thinkingLevel`** (Gemini 3.x): enum `"minimal" | "low" | "medium" | "high"`. `"minimal"` is documented as matching *"no thinking" for most queries*, with the caveat that it **"does not guarantee that thinking is off — the model may reason very minimally for complex tasks."** Must be nested under `thinkingConfig`; placing it directly under `generationConfig` is a 400 (`Unknown name "thinkingLevel"`).
- **`thinkingBudget`** (Gemini 2.5 series): integer. `0` disables thinking on 2.5. On Gemini 3.x it is "accepted for backwards compatibility" for **positive** values only — `gemini-3.6-flash` accepts `128`, `512`, `-1` (dynamic) but **rejects `0` with 400**.
- **`thinkingLevel` and `thinkingBudget` are mutually exclusive** — setting both returns `400: "You can only set only one of thinking budget and thinking level."`
- **`includeThoughts`** toggles whether thought summaries are returned in the response; it does not reduce `thoughtsTokenCount` or billing.

Primary sources:
- Thinking (generateContent, legacy): https://ai.google.dev/gemini-api/docs/generate-content/thinking
- Thinking (Interactions API, current): https://ai.google.dev/gemini-api/docs/thinking
- Models: https://ai.google.dev/gemini-api/docs/models
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Launch blog (3.6-flash): https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-6-flash-3-5-flash-lite-3-5-flash-cyber/

---

## The empirical table — config → accepted? → tokens

Every row: identical reasoning prompt, identical output envelope (`temperature:0.8, maxOutputTokens:1600`); only the thinking control varies. `thoughts` = `usageMetadata.thoughtsTokenCount`, `cand` = `candidatesTokenCount`, `total` = `totalTokenCount`. Source: CI run `29994213742` on `main`, 2026-07-23. `prompt`=40 for every call.

### gemini-3.6-flash (the migration target)
| config | result | thoughts | cand | total | answered |
|---|---|---:|---:|---:|:--:|
| baseline (no thinkingConfig) | **OK** | **310** | 1 | 351 | yes |
| `thinkingBudget:0` | **FAIL 400** INVALID_ARGUMENT | — | — | — | — |
| `thinkingBudget:128` | OK | 217 | 1 | 258 | yes |
| `thinkingBudget:512` | OK | 106 | 1 | 147 | yes |
| `thinkingBudget:-1` (dynamic) | OK | 343 | — | 383 | yes |
| **`thinkingLevel:"minimal"`** | **OK** | **0** | 1 | 41 | **yes** |
| `thinkingLevel:"low"` | OK | 241 | 1 | 282 | yes |
| `thinkingLevel:"medium"` | OK | 294 | 1 | 335 | yes |
| `thinkingLevel:"high"` | OK | 296 | 1 | 337 | yes |
| `thinkingLevel:"off"` (bad-value probe) | FAIL 400 — enum only accepts the `ThinkingLevel` values | — | — | — | — |
| `thinkingLevel` at top level (wrong nesting) | FAIL 400 — `Unknown name "thinkingLevel"` | — | — | — | — |
| `thinkingLevel:"minimal"` + `includeThoughts:false` | OK | 0 | 1 | 41 | yes |
| `thinkingLevel:"minimal"` + `thinkingBudget:0` (both) | FAIL 400 — *"only one of thinking budget and thinking level"* | — | — | — | — |
| **MIGRATION CANDIDATE: `thinkingLevel:"minimal"` + `google_search`** | **OK** | **0** | 1 | 41 | **yes** |

### gemini-3.5-flash (accepts both surfaces)
| config | result | thoughts | total |
|---|---|---:|---:|
| baseline | OK | 243 | 284 |
| `thinkingBudget:0` | OK | 0 | 41 |
| `thinkingBudget:128/512/-1` | OK | 222 / 246 / 302 | — |
| `thinkingLevel:"minimal"` | OK | 0 | 41 |
| `thinkingLevel:"low"/"medium"/"high"` | OK | 162 / 286 / 264 | — |
| `minimal + google_search` | OK | 0 | 41 |

### gemini-2.5-flash (the current model — `thinkingLevel` not supported)
| config | result | thoughts | total |
|---|---|---:|---:|
| baseline | OK | 216 | 257 |
| `thinkingBudget:0` | OK | **0** | 41 |
| `thinkingBudget:128/512/-1` | OK | 70 / 267 / 159 | — |
| any `thinkingLevel:*` | **FAIL 400** — *"Thinking level is not supported for this model."* | — | — |
| `minimal + google_search` | FAIL 400 (same reason) | — | — |

**Reading of the table:**
1. 3.6-flash is **not** locked into thinking — `thinkingLevel:"minimal"` drove `thoughtsTokenCount` to **0** on the app's short structured task, matching what 2.5-flash's `thinkingBudget:0` does today.
2. The only way to hit 0 on 3.6 is `thinkingLevel:"minimal"`; `thinkingBudget:0` is a hard 400, and any positive budget still spends 100–340 thinking tokens.
3. The three axes are cleanly separated: model exists (ListModels), field accepted (isolation probe), and cost measured (`thoughtsTokenCount`).

---

## Question 2 — Token-cost reality

**Thinking tokens are billed, at the output rate.** The pricing page lists 3.x output as *"Output price (including thinking tokens)"* — thinking tokens are counted in `usageMetadata.thoughtsTokenCount` and billed as output. Prices (per 1M tokens, standard tier, from the pricing page + launch coverage — these are **published prices, not API-testable**):

| model | input | output (incl. thinking) | Google Search grounding |
|---|---:|---:|---|
| **gemini-3.6-flash** | **$1.50** | **$7.50** | 5,000 free prompts/mo (shared across Gemini 3), then $14 / 1,000 |
| gemini-3.5-flash | $1.50 | $9.00 | same |
| gemini-3-flash-preview | $0.50 | $3.00 | same |
| **gemini-2.5-flash** (current) | **$0.30** | **$2.50** | 1,500 RPD free, then $35 / 1,000 grounded prompts |

**For the app's usage pattern** (short structured-JSON calls + grounded search, `temperature` set, `maxOutputTokens` 20–1600):

- **With `thinkingLevel:"minimal"` there is no thinking blowup.** Empirically `thoughtsTokenCount = 0` on the short calls, so billed output = just the JSON answer, exactly as today on 2.5. The migration does **not** introduce runaway thinking cost.
- **The real, unavoidable delta is the base tier:** ~5× input and ~3× output per token vs 2.5-flash. A call that costs 2.5-flash `X` costs 3.6-flash roughly `3–5X` even with thinking neutralized — because the tokens are dearer, not because of thinking. That is a business/pricing decision, and it is the honest headline for the owner.
- **The blowup the owner was right to fear is the *naive* migration:** if the app dropped `thinkingBudget:0` and sent no thinking control, 3.6 baseline spent **310 thinking tokens** on a *one-line arithmetic* prompt. At $7.50/1M that is ~$0.0023 of thinking per call, and for a short structured call whose real answer is tens of tokens, thinking would be several× the billed output. `thinkingLevel:"minimal"` is precisely what prevents that.

**Honest caveat.** The `thoughts=0` result was measured on a simple arithmetic prompt. Google's own doc warns `minimal` "does not guarantee thinking is off … the model may reason very minimally for complex tasks." The app's grounded-search + extraction prompts are more complex, so production `minimal` calls *may* incur a small non-zero `thoughtsTokenCount`. `minimal` is the model's floor and was 0 on short structured work; a follow-up probe using a real app prompt (grounding payload + JSON schema) would tighten the production number. The mechanism and the floor are verified; the exact production thinking-token count on the hardest prompts is not.

---

## Question 3 — The concrete migration recipe

**Change `GEM_MODEL` and, at every call site, replace `thinkingConfig:{thinkingBudget:0}` with `thinkingConfig:{thinkingLevel:'minimal'}`. Nothing else.**

The exact `generationConfig` to send to `gemini-3.6-flash` (main grounded chat site, `app.js:4250`):
```json
{
  "system_instruction": { "parts": [{ "text": "…" }] },
  "contents": [ … ],
  "tools": [{ "google_search": {} }],
  "generationConfig": {
    "temperature": 0.8,
    "maxOutputTokens": 1600,
    "thinkingConfig": { "thinkingLevel": "minimal" }
  }
}
```
Generic form for every other site — keep each site's existing `temperature` / `maxOutputTokens`, swap only the thinking control:
```js
generationConfig:{ temperature:<unchanged>, maxOutputTokens:<unchanged>, thinkingConfig:{ thinkingLevel:'minimal' } }
```

**Do NOT:** set `thinkingBudget` on 3.6 (0 → 400; positive → pays for thinking); set both `thinkingLevel` and `thinkingBudget` (→ 400); or put `thinkingLevel` directly under `generationConfig` (→ 400). `includeThoughts:false` is unnecessary (with `minimal`, thoughts are already 0; the flag only hides summaries, it does not save tokens).

### The 8 app.js call sites that hard-code `thinkingBudget:0` (all must change; this task did NOT edit app.js)
`app.js` lines **4250, 4261, 4351, 4554, 5195, 5279, 6974, 9299** — every one currently sends `thinkingConfig:{thinkingBudget:0}`. Under `gemini-3.6-flash` each is a guaranteed 400 until swapped to `thinkingLevel:'minimal'`. (Line 4351 builds the config in a `gen` variable; 9299 is the vision/`inlineData` path.) The two supporting docs `ai-prd.md:27` and `ai-implementation-plan.md:26` also describe `thinkingBudget:0` as the cost lever and should be updated to `thinkingLevel:"minimal"` when the migration lands.

---

## What could NOT be verified
- **Published per-token prices** ($1.50/$7.50 etc.) come from the pricing page and launch coverage, not from the API — they cannot be confirmed by a `generateContent` call. The **token counts** in the tables above are empirical; the **dollar rates** are documentary.
- **Production `thoughtsTokenCount` under `minimal` on the app's hardest grounded/extraction prompts** — measured 0 on a short arithmetic prompt; may be small-but-nonzero on complex prompts per Google's own caveat. Not yet probed with a real app payload.
- The other 3.x flash ids (`gemini-3.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.1-*`) were listed but not matrixed here; only 3.6/3.5/2.5 were tested, since 3.6-flash is the migration target.

---

## Reproduce
```bash
gh workflow run model-diag.yml --ref main      # workflow_dispatch, uses GEMINI_EVAL_KEY secret
gh run watch <run-id> --exit-status
gh run view <run-id> --log | grep "Probe the models"
```
Script: `scripts/model-diag.mjs` (key used only in the request URL, never printed). CI: `.github/workflows/model-diag.yml`. Verified run: `29994213742`.
