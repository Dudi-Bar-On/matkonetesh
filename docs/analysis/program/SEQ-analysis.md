# SEQ — Sequencing & Risk Analysis for the Gap-Closing Program

**Input corpus:** `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md` (141 gaps, 8 bands, §7 closing
order), `docs/analysis/sweep/` (W1-*, VERIFY-W1-*, W4-*, W5-*), `docs/analysis/2026-07-22-business-model.md`.
**Repo state at analysis time:** v258, `main`, 286 commits, working tree as per the session's `git status`.
**Date:** 2026-07-22. **Scope:** analysis only — no file in the app was modified.

> **What this document is.** §7 of the ULTIMATE doc is a closing *order*. This is the *program* analysis
> that sits underneath it: what each cluster costs, what it can break, what must precede what, what ships
> together, and what infrastructure has to exist before a program of this size can be run under the
> `CLAUDE.md` §3 DoD gate at all.
>
> **Method.** Located with the knowledge graph (`graphify query "gemini-2.5-flash"`,
> `graphify query "google_search"` — §10.13), then opened every load-bearing file at the cited line before
> asserting. Where I say "verified", I read or executed it in this session. Where I could not, I say so in
> §9.

---

## 0. Executive summary

1. **§7 is largely right on *order* and wrong in three specific places, and it omits at least six gaps
   entirely** — including one 🟠 safety gap (§3.A.4, Diagnose) and one 🟠 gap that directly contradicts a
   standing owner decision (§3.G.1, the offline claims). See §1.
2. **The single largest error is §7 Step 1's validation plan.** It proposes shipping the model migration
   against "the eval harness that already exists (`tests/ai-trust.spec.ts`)". That file stubs `gemFetch` in
   every path and asserts on the *outgoing prompt*. It never calls a model. It would pass identically
   against `gemini-2.5-flash`, `gemini-3.6-flash`, or a model that returns nothing. §8.2 item 12 of the same
   document says the opposite. **The migration's real cost is a harness that does not exist.** See §1.1.
3. **The binding deadline constraint is not the flip — it is the baseline.** You cannot tell whether the
   replacement regressed unless you measured the incumbent first, and the incumbent disappears on
   2026-10-16. **The live eval harness must exist and have recorded a `gemini-2.5-flash` baseline while
   `gemini-2.5-flash` is still up.** That moves the harness to the *front* of the program, not next to
   Step 1. See §3.
4. **A program of this size cannot be run safely on today's test infrastructure.** Zero tests reference
   `worker/index.js`; the Playwright port is hardcoded so two agents cannot gate concurrently; the service
   worker is unexercisable by any local or CI run; the three grounding validators have zero coverage; and
   there is no CI. Four of Step 0's five items **cannot pass DoD lines 2/3/4/12 today.** See §7.
5. **The `google_search` two-for-one is verified**, and it is cheaper than §7 implies — the conditional
   mechanism already exists in the same file. Three further two-for-ones are identified, one of which
   (§3.E.9 ↔ §3.F-ii.8) §7 does not connect and does not schedule at all. See §5.

---

## 1. Critique of §7

§7 is at `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md:1355-1567`. It proposes Steps 0–13 (the
brief described steps beyond 4 as "thin"; they are not — Steps 5–13 exist and are reasoned). The ordering
principle it states — *"bound the harm, then bound the cost, then bound the drift, then build the thing the
owner remembers"* (`:1357`) — is sound and I do not propose replacing it.

### 1.1 Step 1's validation plan is wrong — `tests/ai-trust.spec.ts` is not an eval harness

§7 `:1382-1383`:

> "Ship the migration with the eval harness that already exists (`tests/ai-trust.spec.ts`) wired into an
> actual CI job, plus the missing grounding assertions (§3.E.4)."

**Verified false.** Every AI path in that file replaces the transport:

- `tests/ai-trust.spec.ts:15` — `window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body}); return { ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]}) }; }`
- Same stub again at `:225` and `:298`.
- The helper `capAfter` (`:16-22`) returns `window.__cap[...].body` — **the request body**.
- Its own header comment, `:4`: *"gemFetch is intercepted to capture the outgoing prompt (no real network / key needed)."*

Of its 86 `expect(` calls, the model-facing ones assert on `system_instruction.parts[0].text` and
`contents[…].parts[0].text` — prompt construction. The rest exercise **pure local functions**
(`aiSafetyNums`, `aiUngroundedSafety`, `aiSafetyNote`, `askSafetyIntent`, `askContextFor`), which is real
and valuable coverage of the *guard layer* — but it is not model coverage.

**Consequence.** Wiring this file into CI is worth doing (it protects prompt construction against
regression), but it validates **nothing** about swapping `GEM_MODEL`. The ULTIMATE doc already knows this
and contradicts itself: §8.2 item 12 (`:1618-1619`) reads *"Live-model behavioural drift — Hebrew-in-English
script leakage and similar. This class genuinely needs periodic **live** model runs, not mocks; the sweep
ran none."* **§7 Step 1 and §8.2.12 cannot both be true.** §8.2.12 is the correct one.

**The real Step 1 cost** is therefore: build a keyed, opt-in live eval harness (does not exist), record a
baseline on the incumbent model (time-limited — see §3), then flip. §7 states the flip as "the change is
small" and it is; §7 states the validation as free and it is not.

### 1.2 Step 1 says "one constant" — it is two, and the second is a `preview` model

§7 `:1380`: *"Every AI feature routes through one constant (`app.js:4206`)."*

Verified against every `gemFetch(` call site:

| Line | Model argument |
|---|---|
| `app.js:4252`, `4261`, `4361`, `4554`, `5196`, `5280`, `6975`, `9300` | `GEM_MODEL` (the constant at `4206`) |
| **`app.js:5030`** | **`'gemini-2.5-flash-preview-tts'` — a bare string literal** |

Eight of nine route through the constant. The ninth is TTS, and it is a **preview** model. Per
`W5-D-api-docs.md` (surfaced by `graphify query "gemini-2.5-flash"`): *"gemini-2.5-flash-preview-tts still
listed, Preview, no shutdown date announced."* A preview model can be withdrawn with less notice than a GA
deprecation and will not necessarily appear on the deprecations table that revealed E1 in the first place.

**Two consequences §7 misses:** (a) the migration has a second, *undated* exposure, so the migration task
must cover both constants and the TTS path needs its own fallback story; (b) line `5030` is the **exact
line** Step 0's TTS fix (§3.E.7/E.8) edits — so the TTS fix and the migration touch the same code and
should be sequenced deliberately rather than three months apart.

### 1.3 Step 0's A3 fix breaks a passing test that encodes the defect

§7 `:1370` treats §3.A.3 (unit-blind `aiSafetyNums`) as a regex fix. Verified at `app.js:4302-4306`:

```js
const re=/(\d+(?:\.\d+)?)\s*(?:°\s*[CF]?|[CF]\b|ppm|%)|\bpH\s*(\d+(?:\.\d+)?)/gi;
```

The unit is in a non-capturing group — confirmed, A3 stands. **But** `tests/ai-trust.spec.ts:79` asserts:

```js
expect(await page.evaluate(`JSON.stringify(aiSafetyNums('smoke at 110C for 6 hours, cure 156 ppm, 2.5% salt'))`)).toBe(JSON.stringify([110, 156, 2.5]));
```

That test asserts the **unit-stripped return shape** — i.e. it encodes the defect as the contract. Any
unit-aware fix changes the return type and turns that green test red.

This is not fatal, but it is exactly the failure the same document flags at §5.3 (`:1183`): *"the specified
mechanism was abandoned **and the regression test was rewritten to match**."* Rewriting `:79` to match new
code is that pattern. It needs owner visibility, not a silent edit. The six downstream assertions at
`:82-89` and `:118-119` all use *unit-matched pairs* (`250 ppm` vs `156 ppm`) and would keep passing under
either contract — so they will **not** catch a botched fix. A3 therefore needs a purpose-built
unit-mismatch case (`74 °F` answer vs `74 °C` grounding) as its witnessed RED.

**Revised estimate for A3: not a regex edit. ~2 tasks plus a test-contract decision.**

### 1.4 §7 omits six gaps entirely — two of them matter a lot

Searched §7 (`:1355-1567`) for each. Results:

| Gap | Sev | Present in §7? | Why the omission matters |
|---|---|---|---|
| **§3.A.4** — Diagnose has neither a refusal gate nor vetted grounding | 🟠 | **No** (`grep "A\.4\|A4\|iagnos"` over §7 → empty) | Every other 🟠 in band A is scheduled (A5→Step 2, A6/A7→Step 3, A8/A9→Step 4, A10/A11→Step 5). A4 is the only one with no home. And `aiSafetyCaveat` returns `''` for text with no number and no keyword, so *"that mold is probably fine, keep drying"* gets **no flag at all** (§3.A.4). |
| **§3.G.1** — the app still tells users it works with no network, in 4 places, 2 languages | 🟠 | **No** (`grep -i "offline\|3\.G\|no network"` → empty) | **Directly contradicts the owner's 2026-07-22 online-first decision**, which `CLAUDE.md` states as standing. `docs/analysis/2026-07-22-business-model.md:306` schedules it ("Stage 1 — Truth in advertising · ~1 week"); §7 dropped it. It is a ~1-task copy fix. |
| **§3.E.9** — MT hydration is an uncapped cost leak | 🟠 | **No** (`grep -i "E\.9\|hydrat\|mtTranslate"` → empty) | It is also half of the §3.F-ii.8 performance defect — see §5.3. Unscheduled cost *and* an unexploited two-for-one. |
| **§3.A.12** — guard/caveat text never reaches speech | 🟡 | No | This is the **completion** of Step 0's A1/A2. Guarding `vcAskAI`'s rendered text while `vcSpeak` still speaks the unflagged answer leaves the hands-busy user — the exact user A1 is about — unprotected. It belongs *inside* Step 0, not nowhere. |
| **§3.B.13** — work-plan checkbox keys are translated labels; every refuel row for one fuel shares one key | 🟡 | No | *"three rows at 19:15/20:00/20:45 share **one** checkbox key — ticking the first marks all three done, on the one device where a missed refuel puts the fire out"* (§3.B.13). Safety-adjacent, and the codebase already knows the right pattern (`app.js:7916` deliberately keys the shopping list on a language-independent label). |
| **§3.F-iii.17** — focus not managed on the wizard; Chrome logs `aria-hidden` blocking a focused descendant | 🟠 | No (Step 10 lists .13, .12, .15, .27, .14, .16) | The only a11y defect the browser itself diagnosed. |

Others with no step, lower stakes, listed for completeness: §3.B.8–12, .14–17, .23–26, .29–31; §3.C.9–12;
§3.D.4, .6–9, .11; §3.E.6, .10–16; §3.F-iii.18–23; §3.F-iv.24–26; §3.F-v.28–36; §3.G.2–8. Many are
legitimately below the line. **A4, G1, E9, A12, B13 and F-iii.17 are not.**

### 1.5 Step 5.1 is not "three assertions, not a refactor"

§7 `:1427-1428`: *"This is the **highest-leverage structural item in the entire document**, and it is three
assertions, not a refactor."* Items 5.2 and 5.3 genuinely are cheap. **Item 5.1 is not.** Read at the line:

`build.py:96-102`:
```python
if _k == "calc":
    # The cure TYPE ('1'/'2'), cureRate and salt are owned by the canonical make calc
    # (data.py / sausages_new.py). The auto-generated sources carried a stale numeric
    # 'cure' (2.5) that clobbered the type and silently suppressed the dried-safety
    # warning. Ignore sources' calc here. (Wave 0 safety fix; …)
    continue
MAKES[_mid][_k] = _v
```

Three things follow:

1. **The `continue` is a deliberate safety fix, not an oversight** — a Chesterton's Fence (`CLAUDE.md` §12).
   Removing it re-introduces a defect that "silently suppressed the dried-safety warning".
2. **Even without the `continue`, `:103` writes `MAKES[_mid][_k]` — the make's top level.** §3.A.11 verified
   the app reads `build.calc`, not the top level. So the write target is also wrong.
3. `tests/data-integrity.spec.ts:65` asserts *"MAKES cure safety: dry/fermented sausages carry a valid
   nitrite cure TYPE (1 or 2)"* — the exact invariant the fence protects. It will be the tripwire.

So Step 5.1 is: split the `calc` schema (cure *type* vs numeric values), retarget the write to `build.calc`,
apply the 18 salt values, resolve Kabanos (§3.A.10), **and** add the build assertion. That is a data-schema
change under a live safety invariant. **~3–5 tasks, not "an assertion".** The assertion itself is one line;
what it fails on is the work.

### 1.6 Step 9 proposes the harder of two options and omits the free one

§7 `:1483` proposes *"a coverage threshold on the language picker (`app.js:6878`) or a `__meta__.ready` flag
emitted by `build.py`"*. Read at the line:

```js
const I18N_DICTS = __I18N_DICTS__;
const I18N_LANGS = (function(){ const o={he:'עברית'}; try{ Object.keys(I18N_DICTS).forEach(function(k){ o[k]=((I18N_DICTS[k]||{}).__meta__||{}).name||k; }); }catch(e){} return o; })();
```
— `app.js:6877-6878`

Two findings §7 misses:

- **The `__meta__.ready` option is cheaper than stated:** `6878` **already reads `__meta__`** (for `.name`).
  A `ready` gate is one added condition inside a walk that already exists.
- **There is a zero-code option §7 does not name.** `I18N_LANGS` derives from `Object.keys(I18N_DICTS)`, and
  `I18N_DICTS` is `__I18N_DICTS__`, inlined by `build.py` from `lang/*.json` (confirmed: `ls lang/` →
  `de.json es.json fr.json en.json en.data.json README.md`). **Deleting `lang/fr.json`, `lang/de.json`,
  `lang/es.json` removes the 92 %-Hebrew French wizard today, with no code change.** It ships in any deploy
  and needs only a picker assertion.

Recommendation: do both — delete the three files *now* (rides free in the first deploy), and add the gate
so the class cannot recur when someone re-adds a 2 % dictionary.

### 1.7 Step 4 (dates) is mis-ranked — A9 belongs in Step 0

§7 `:1420-1421` justifies putting dates in Step 4: *"They sit here rather than in Step 0 only because Step
0's items are unbounded-harm and these are bounded."*

I disagree on §3.A.9 specifically, on cost/benefit rather than on harm taxonomy:

- **The harm is not obviously bounded.** §3.A.9's own words: *"The error direction shortens a nitrite
  cure."* A silently shortened nitrite cure is a botulism pathway, not a cosmetic date bug.
- **The cost is near-zero and the blast radius is measured at zero.** `grep -rn "addDays" tests/` → **no
  hits**. `tests/waveB-datetime.spec.ts` tests `serveDateTime`/`parseServeTime`, not `addDays`/`today()`.
  Nothing breaks. (Nothing protects it either — the tests must be written, which the DoD demands anyway.)
- Verified at source: `app.js:2789` `function today(){return new Date().toISOString().slice(0,10);}` (UTC)
  and `app.js:5531` `function isoDate(d){ return d.getFullYear()+…}` (local). Two conventions, one file.

**Recommendation: move §3.A.9 + §3.B.18 into Step 0.** They are hours of work with no regression surface and
a food-safety failure mode. Leave §3.A.8 (alarm-banner i18n) in Step 4 or fold it into the i18n batch — it
has real blast radius (`wave-a-alarm-banner.spec.ts`, `waveA-alarms.spec.ts`).

### 1.8 §7 never names "no CI" as a blocker to §7 itself

§3.E.3 records the gap; Step 1 mentions "wired into an actual CI job" as a sub-clause of the migration.
**That understates it.** DoD line 12 requires a full `npx playwright test` **per task**. With 415 tests,
`retries: 0`, a hardcoded port, and `CLAUDE.md` §11a's standing prohibition on concurrent runs, the gate is
the program's serialization bottleneck (§6). CI is a **Step −1** prerequisite for the whole program, not a
line item inside Step 1. It is also cheap — see §7.1.

### 1.9 What §7 gets right (and should not be second-guessed)

- **Step 0's composition** — five unbounded-harm items in one deploy, explicitly *"Do not defer any of these
  behind the model migration. They are independent"* (`:1374`). Correct: verified independent by file region.
- **Step 3 before Step 11** — *"an invariant nobody sees cannot gate anything"* (`:1404`). Correct and
  load-bearing.
- **Step 7 before Step 11** — *"a solver cannot propose moves across events when the two views cannot agree
  what a clash is"* (`:1468`). Correct.
- **Step 8 after Step 7** — guest-scaled demand changes the *input* to capacity rules; doing it while three
  rules disagree measures against a moving target.
- **Step 13 (don't monetise now)** — the reasoning is verified against `W4-A-unit-economics.md:198-201`.
- **Step 12's ordering** (log-import first, live BLE last) and its blocker list.
- **Step 11's two non-negotiable design constraints** — schema-level exclusion of `hours`/`temp`/`safe`, and
  *establishing* rather than inheriting the confirm-before-apply contract (§3.E.5 verified: `aiConfirmPanel`
  has exactly two call sites).

---

## 2. Cluster → effort → risk → wiring-vs-building

### 2.1 The estimating unit, and the DoD tax

Hours/days/weeks are misleading for this repo. Measured context:

- **Velocity.** 286 commits and v147 → v258 since 2026-07-13 (`git log`). Recent cadence, after the
  discipline tightened: v254, v255, v256, v257 all shipped on 2026-07-21 — **four substantial phases in one
  day.** This is agent-driven development; a "day" here is not a human-engineer day.
- **The DoD tax is the real per-unit cost.** `playwright.config.ts` pins `workers: 6`, `retries: 0`, and its
  own comment records the measured figure: *"324/324 across repeated runs at ~145s"*. At the current **415
  `test(` declarations across 82 spec files** (measured; 2 are `.skip`/`.only`/`.fixme`), a linear
  extrapolation is **~3.1 min per full suite run**, each preceded by `python build.py` in the `webServer`
  command.
- A **feature** task needs ≥2 suite runs (RED, GREEN) + the final full-suite. A **bugfix** task needs ≥4
  (RED, GREEN, fix-reverted-FAILING, fix-restored-PASSING) + the final. **≈10–16 min of pure gate time per
  task**, plus a 390×844 screenshot and a Hebrew render for anything user-facing.

So I estimate in **tasks** (one DoD-gated unit, one fresh subagent) and give a wall-clock band. A ~60-task
program is **~10–16 hours of pure suite time** even with zero waste — and today that time is strictly
serial on one machine (§6).

### 2.2 The clusters

Legend — **W** = wiring something that already exists · **B** = building something new · **D** = a product
or architecture decision the owner must make first. Blast radius is measured by counting spec files
referencing the cluster's central identifier.

| # | Cluster | Gaps | W/B | Tasks | Wall-clock | Blast radius (measured) | Risk notes |
|---|---|---|---|---|---|---|---|
| **PRE-1** | GitHub Actions CI | §3.E.3 | B (tiny) | 1 | hours | none (new file) | Remote exists (`github.com/Dudi-Bar-On/matkonetesh`); `build.py` imports only stdlib + local modules; one npm devDependency. `forbidOnly: !!process.env.CI` is already wired. |
| **PRE-2** | Parameterize the Playwright port | §11a | B (1 line) | 1 | minutes | none | `playwright.config.ts:5` `const PORT = 8123`. Hardcoded ⇒ two agents cannot gate concurrently. This is the cheapest unlock in the whole program. |
| **PRE-3** | Worker test harness | prerequisite for §3.B.19–22, §3.H.3 | **B** | 1–2 | 1 day | **zero tests reference `worker/index.js`** (`grep -rl "worker/index\|X-Access-Code\|streamGenerateContent" tests/` → 0) | **Hard blocker.** `npx playwright test` does not load the Worker. Four of Step 0's five items cannot satisfy DoD 2/3/4/12 today. `wrangler` is already a devDependency in `worker/package.json`. |
| **PRE-4** | Live-model eval harness + **incumbent baseline** | prerequisite for §3.E.1, §3.E.4 | **B** | 2–3 | 2–4 days | none (new, opt-in, out of default suite) | **Hard blocker for the migration, and time-limited** — see §3. Must be keyed and excluded from the default suite (it costs money and is non-deterministic). |
| **PRE-5** | Coverage for the 3 grounding validators | §3.E.4 | B (cheap) | 1–2 | ~1 day | `grep -rn "aiValidateKeys\|aiValidateItems\|aiValidateSeasonings" tests/` → **0 hits** | Pure functions at `app.js:4387`, `4394`, `8393`; "the primary defence for 7 features". Cheap, and a prerequisite for trusting any model swap. |
| **S0-A** | Spoken-safety guards | A1, A2, A12, A4, A15 | **W** (A1/A2/A4) + B (A12) | 4–6 | 2–4 days | `ai-trust.spec.ts`, `wave3-ai-hardening.spec.ts`, `wave5-mt-safety.spec.ts` | Everything needed exists: `askRefuse` (`4197`), `aiSafetyNote` (`4315`), `askSafetyIntent` (`4117`), `SAFETY_FACTS` (`4121`), `mtGuard`/`mtSafe` (`6956-6958`). **A12 is the only B**: none of the 20 speak sites takes caveat text. **Include A4 (§7 omits it) and A12 (§7 omits it) or the cluster is incoherent.** |
| **S0-B** | Unit-aware numeric guard | A3 | **B** + test-contract change | 2 | 1–2 days | `ai-trust.spec.ts:79` **will turn red** | See §1.3. Needs a purpose-built unit-mismatch RED case; the existing unit-matched assertions will not catch a botched fix. |
| **S0-C** | Worker hardening (one Worker deploy) | B19, B20, B21, B22, H3, E14 | W/B mixed | 5–7 | 3–5 days | **0 existing tests** → nothing breaks, nothing protects | Needs PRE-3. **H3 (per-code rate limit) is a D** — KV vs Durable Object is an architecture call with a cost implication. B21 (debit-before-forward) also fixes the TOCTOU race economically. Verified: `worker/index.js:43` admits both `generateContent` and `streamGenerateContent`; `:57-58` fail-open; `:53`/`:84` read-modify-write; `:66-70` no `signal`. |
| **S0-D** | Conditional `google_search` | E2 | **W** | 2 | 1–2 days | `ai-trust.spec.ts` (prompt-body assertions) | **Cheaper than §7 implies.** `aiJSON` already takes `search` as an option — `app.js:4356` `tools: search?[{google_search:{}}]:undefined` — and two callers pass it (`6337`, `6373`). `askSafetyIntent` (`4117`) is the existing deterministic-regex classifier pattern to copy. Only the *live-info intent* classifier is new. Sites to change: `4249`, `5278`. |
| **S0-E** | TTS routing | E7, E8 | **W** | 1–2 | ~1 day | none measured | Verified: `app.js:5026` gates on `gemKey()`; `5030` calls `gemFetch('gemini-2.5-flash-preview-tts', …)` **without `opts.key`**, so `gemMode()` routes managed. Two-for-one (§5.2). **Touches the same line as the migration** (§1.2). |
| **S0-F** | Dates | A9, B18 | B (a convention) | 2–3 | 1–2 days | **0** (`grep -rn "addDays" tests/` → no hits) | Moved into Step 0 per §1.7. Zero regression surface. `app.js:2789/2790`, `5531`. |
| **S0-G** | Truth in advertising | **G1** | W (copy) | 1 | hours | **none** — no test asserts the offline strings (verified: `grep -n "מקומיים\|ללא חיבור\|no network\|בלי שרת" tests/*.spec.ts` → 0 hits; `wave5-desc-offline.spec.ts` is about *descriptions* rendering without an AI key, not the offline copy) | **§7 omits it.** `build.py:334`, `app.js:3929`/`3931`/`3939`, `lang/en.json:261`, `README.md:4`. Contradicts a standing owner decision. Rides free in any deploy. |
| **S1** | Model migration | E1 (+ the TTS preview model) | W (the flip) + B (the validation) | 2–4 | 1 week incl. soak start | every AI test | The flip is two constants (`4206`, `5030`). The cost is PRE-4 and the soak. **See §3.** |
| **S2** | The two named safety commitments | A5 | **B** (the *effect*; thresholds exist) | 3–4 | 2–4 days | `cure-scale-guard.spec.ts` (6 `[data-cureguard]` assertions — extend, don't rewrite), `equipment*.spec.ts` | `cureScaleGuardHTML` (`1849-1874`, `hardMax=5*d`) is correct; `guard.innerHTML=g` at `1926` lands in a separate node from the dose at `1918-1919`, so *the output is byte-identical whether the warning fires or not*. Converts "guards your cure" from a claim to product (§3.H.10b). |
| **S3** | Monitor → control | A7, A6 | **W** (A7) + B (A6) | 3–4 | 2–3 days | `safety-invariant.spec.ts:81` already reads `window._planSafetyViolations` | A7 is genuinely 6 lines from its answer: `_plcConflicts` is written at `5692` and **reaches the user at `5739`**; `_planSafetyViolations` is written at `5711/5717` and read by nothing. **Precondition for any AI proposer.** |
| **S5** | Boundary assertions | 5.1 (A10, A11, §5.5, §5.6), 5.2 (i18n leak assertion) | **B** (5.1) / W (5.2) | 4–6 | 3–5 days | `data-integrity.spec.ts:65` is the tripwire | See §1.5. **5.2 is one of the best value/cost ratios in the document** — one Playwright assertion that no rendered leaf matches `/[֐-׿]/` while `getLang() !== 'he'`, and the entire English-leak class becomes impossible to reintroduce. Do 5.2 early, in the i18n batch. |
| **S6** | Wire what exists | D1, D3, D10, D2, C3 | **W** (D1/D3/D10) · **D** (D2) · B (C3) | 5–8 | 3–6 days | `equip-chooser.spec.ts` (D1 already unit-tested), `equipplan-seam.spec.ts`, multi-event specs | D1 is pure wiring: `choosePlate` (`3014`) / `chooseNozzle` (`3024`) are defined, tested, and called from nowhere; their sibling `chooseBath` **is** wired at `630`. **C3 (`equipPlan` into multi-event) is the requirement that was waived in a plan file** — `CLAUDE.md` §4 names it. Treat it with the waiver gate's attention. |
| **S7** | One capacity rule, one resource timeline | B-i.1, .2, .3, .5, .6, .7; C3 | **B** (a model change) | 8–15 | **weeks** | **`deviceOccupancy` → 22 spec files · `mk-tlserve` → 14 · `cookerContention` → 6 · `combinedEventsRows` → 4** | **The highest-blast-radius cluster in the program by a wide margin.** ~90 % deterministic, no AI. Precondition for S11. Expect the suite to go red broadly and legitimately; budget re-derivation of ~20 spec files. |
| **S8** | Guest-scaled occupancy demand | D5 | B (derivable) | 3–4 | 2–4 days | the same 22 occupancy specs | Owner-raised. Do **after** S7 — it changes the input to the rules S7 unifies. |
| **S9** | i18n | F-i.1, F-i.2, F-i.3, E13, A8 | W (gate) + B (leaks) | 4–6 | 3–5 days | `wave5-i18n-*.spec.ts` (5 files), `i18n-foundation.spec.ts`, `wave5-lang-switcher.spec.ts`, alarm specs | Gate is ~1 task, or **zero-code** by deleting three `lang/*.json` files (§1.6). Pair with S5's assertion 5.2. |
| **S10** | Perf / a11y / SEO | F-ii.8, F-iii.13, .12, .15, F-v.27, F-iii.14/.16/.17, B27, B28, F-ii.6/.9/.10 | mixed | 10–14 | 1–2 weeks | `wave1-a11y.spec.ts`, `wave4-a11y-depth.spec.ts`, `wave1-theme.spec.ts`, `occ-css-tokens.spec.ts` | Mostly independent of each other. **B27 and B28 are both `build.py:400-430` edits** (SHELL at `:405`, `_headers` at `:428`) — same deploy, same file, ~1 task combined. F-ii.8 is the largest measured win and should follow E9 (§5.3). |
| **S-E9** | MT hydration → build time | E9 | **B** | 2–3 | 2–3 days | `wave5-mt-hydrate.spec.ts`, `wave5-mt-safety.spec.ts` | **§7 schedules this nowhere.** `app.js:6993` already short-circuits on a pre-translated dict — the mechanism is half-built. Two-for-one with F-ii.8 (§5.3). |
| **S11** | Orchestrator (Phase 3a solver) | C1, C2 | **B** | 20+ | **weeks–months** | everything in S7's radius | Strictly after S3 + S7. §7's two design constraints are correct and non-negotiable. |
| **S12** | Probes — log-import | G6, D6 | **B** | 5–8 | 1–2 weeks | none (new surface) | **Fully independent track.** `copilotLogProbe(tempC)` (`app.js:5381`) is a drop-in; `copilotPace` (`5395-5416`) is a pure function of `session.probes` and needs zero changes. |
| **S13** | Monetization | H-band | **D** first | — | ~2 quarters out | — | §7 Step 13's reasoning verified against `W4-A-unit-economics.md:198-201`. Preconditions stated there are the right ones. |

### 2.3 The "wiring, not invention" list — precisely located

The audit's repeated observation is correct and here are the exact instances, each verified at the line:

| Gap | The thing that already exists | Distance from where it's needed |
|---|---|---|
| A1 (`vcAskAI` unguarded) | `askRefuse` def `4197`, sole call site `4448`; `aiSafetyNote` `4315` | ~800–1,100 lines |
| A2 (`vcTranslateToEn` unguarded) | `mtGuard`/`mtSafe` `6956-6958`, used by `mtTranslate` at `6980` on the *same content class* | ~1,770 lines, same file |
| A4 (Diagnose ungrounded) | `askSafetyIntent` `4117`, `SAFETY_FACTS` `4121`, pattern at `askContextFor` `4140-4141` | ~4,350 lines |
| A7 (`safetyDiff` unsurfaced) | `_plcConflicts` written `5692`, **rendered to the user `5739`** | **6 lines** |
| E2 (unconditional search) | `aiJSON`'s `search` option, `4356`; two callers already pass it (`6337`, `6373`) | ~100 lines |
| D1 (plate/nozzle unwired) | `chooseBath` **is** wired at `630`; `choosePlate` `3014`, `chooseNozzle` `3024` are not | same function family |
| F-i.1 (no i18n gate) | `6878` already reads `__meta__` | same line |
| E9 (MT re-runs forever) | `6993` already short-circuits on a pre-translated dict | same function |
| S5.2 (Hebrew-leak assertion) | 82 spec files establish the Playwright idiom | new file |

**Every one of these is a wiring task, and wiring tasks are the cheapest DoD passes available** — the
consumer already exists (DoD line 5 is nearly free), and the behavioural assertion (line 4) has an obvious
target.

---

## 3. The `gemini-2.5-flash` deadline, worked backwards

**Fixed external date: 2026-10-16** (§3.E.1, verified in two independent fetches per W5-D; replacement
`gemini-3.6-flash`). **Today: 2026-07-22. 86 days.**

### 3.1 The constraint that actually binds is the baseline, not the flip

The flip is two string constants (`app.js:4206`, `app.js:5030`) — minutes. **The question that decides
whether the migration succeeded is: "did the replacement regress?"** and that question is unanswerable
without a recorded measurement of the incumbent.

- `tests/ai-trust.spec.ts` cannot provide it — it never calls a model (§1.1).
- §8.2.12 of the ULTIMATE doc states plainly that live-model behaviour needs live runs, and the sweep ran
  none. **There is no baseline anywhere in the repo.**
- **The incumbent disappears on 2026-10-16.** After that date, the baseline is unobtainable *forever*.

**Therefore: PRE-4 (the harness) and the incumbent baseline are the earliest-deadline items in the entire
program, not Step-1 items.** Every day of delay is a day of baseline that can still be captured; after
2026-10-16 the option is gone.

### 3.2 Schedule, worked backwards

| Date | Milestone | Why this date |
|---|---|---|
| **2026-10-16** | `gemini-2.5-flash` shuts down | External, fixed |
| **2026-09-15** | **Hard-latest migration flip**, live-verified per §10.10 | Leaves ~4 weeks with **both** models available. If the replacement regresses, the rollback target still exists and the failure can be diagnosed against a running incumbent. |
| **2026-09-08** | Migration task starts (flip + DoD + live verify + soak begins) | The flip itself is ~1 day; the DoD gate + `§10.10` live-URL polling adds a day; ~5 days of buffer for a first-attempt failure under the **3-fix rule** (`CLAUDE.md` §5 — after 3 failed fixes, STOP and escalate, which costs calendar time). |
| **2026-09-01** | **Incumbent baseline recorded** — hard-latest | Must be *before* the flip and *well* before shutdown. |
| **2026-08-25** | **Hard-latest start for PRE-4** (harness build) | 2–3 tasks; a new keyed, non-deterministic, money-spending harness will need iteration. One week is tight but survivable. |
| **2026-08-11** | **Recommended start for PRE-4** | Two weeks of margin over the hard-latest. |
| **Now → 2026-08-05** | **Preferred: build PRE-4 in the first fortnight** | Not only for the migration: A1/A2/A3/A4/E2 (S0-A, S0-B, S0-D) **all change what the model is asked and how its output is judged**. Without a live harness those guard changes ship blind, and the ULTIMATE doc's own §8.2.12 says this class is not mock-testable. Building PRE-4 first makes Step 0 verifiable, then makes the migration verifiable. **One harness, two payoffs.** |

### 3.3 Migration risk properties §7 does not state

- **The rollback is one constant.** That is the migration's single best property. Consider making the model
  overridable at runtime (e.g. a `store.get('mk-model')` fallback in `GEM_URL`) so a bad migration is
  reverted **without a deploy** — Cloudflare Pages propagation takes minutes and §10.10 forbids claiming a
  release until Playwright has verified the live URL. *Tradeoff:* it adds a new user-writable surface that
  can point the app at an arbitrary model string; gate it behind an existing settings path rather than the
  URL.
- **The TTS model is a second, undated exposure** (§1.2) and is on the same line as the S0-E fix. Decide
  once: do S0-E and the TTS-model question together.
- **Zero analytics (§3.G.3) makes the soak weak.** There is no telemetry anywhere, so a post-flip
  behavioural regression surfaces only when the owner notices or a user complains. That argues for a
  *longer* soak and a *broader* harness, not a shorter one — the harness is substituting for a telemetry
  channel that does not exist.
- **No CI means the migration cannot be re-validated on a schedule.** With CI (PRE-1), the live harness can
  run weekly on a cron against both models and produce a drift record. Without it, it runs when a human
  remembers.

---

## 4. What shares a deploy

The owner's standing instruction is to avoid shipping every feature separately but to ship when a batch is
meaningful. Batches below are grouped by **same code region + same regression tests + same deploy target**.

### 4.1 There are two independent deploy targets, and §7 never says so

- **Cloudflare Pages** (`wrangler.toml` at repo root, `pages_build_output_dir = "dist"`) — the app.
- **Cloudflare Worker** (`worker/wrangler.toml`, `name = "matkonet-ai"`) — the AI proxy, deployed by
  `npm run deploy` in `worker/`.

**The Worker ships on its own cadence and cannot break the app's Playwright suite.** That makes S0-C a
genuinely parallel track (§6) and means Step 0's Worker items do **not** have to wait for the app-side
Step 0 items. §7 packs all five Step-0 items into "one deploy" (`:1364`); they are two deploys.

### 4.2 Recommended batches

| Batch | Contents | Rationale |
|---|---|---|
| **D1 · Program prerequisites** | PRE-1 (CI), PRE-2 (port), PRE-5 (validator coverage) | No user-visible change; no version bump needed. Unblocks everything. Ship as infrastructure commits. |
| **D2 · Worker hardening** *(separate target)* | B19, B20, B21, B22, H3, E14 | One file (`worker/index.js`, 91 lines), one deploy, one new test harness (PRE-3). Nothing else touches it. Ship as a unit — a half-hardened Worker is still `$126/hour` exposed. |
| **D3 · "Stop the bleeding" (app)** | S0-A (A1, A2, A4, A12, A15), S0-B (A3), S0-D (E2), S0-E (E7/E8), S0-F (A9, B18), S0-G (G1) | All in `app.js` 4100–5300 + 6950–7000 + 2789/5531, plus copy. **They share `ai-trust.spec.ts` and `wave3-ai-hardening.spec.ts` as the regression surface** — running that surface once for the batch instead of six times is a large DoD saving. G1 and S0-F have zero overlap but are single-task copy/convention fixes that ride free. |
| **D4 · The i18n batch** | F-i.1 gate + delete 3 `lang/*.json`, **S5 assertion 5.2**, F-i.2 leaks, F-i.3 `data-mt` collision, A8 alarm banner, E13 TTS error strings, **S-E9 (MT → build time)** | All hit `app.js` 6870–7000 + `build.py` i18n emission + `lang/*` + the six `wave5-i18n-*` / `i18n-foundation` specs. **Assertion 5.2 must ship in this batch** — it is the thing that stops the whole leak class recurring, and shipping the leaks without it means fixing them again later. |
| **D5 · Cheap build-output wins** | B27 (SHELL dedupe, `build.py:405`), B28 (a real 404 / `_headers`, `build.py:428`), F-ii.10 (minification), F-ii.9 (fonts) | **All four are `build.py:400-430`.** One file, one region, one deploy. B27 alone is 62 % of a first visit's bytes for one line. |
| **D6 · Named safety commitments** | S2 (A5) | Own deploy — a behaviour change from advisory to blocking is the kind of thing to ship visibly and alone. Converts the marketing claim (§3.H.10b). |
| **D7 · Monitor → control** | S3 (A7, A6) | Same region (`app.js` 5690–5760), shares `safety-invariant.spec.ts`. |
| **D8 · The data/build boundary** | S5.1 (A10, A11, §5.5, §5.6) | `gen_sources.py` + `build.py:90-105` + `data.py` + `sources.py`, tripwired by `data-integrity.spec.ts`. Ship alone — it changes safety-relevant data values. |
| **D9 · Wire the kit** | S6 (D1, D3, D10, D2, C3) | `app.js` 3000–3030 (choosers), 6390–6680 (equipment form), 5720–5880 (work plan). Shares `equip-chooser` / `equipplan-seam` / `equipment*` specs. C3 may split out if the waiver-gate conversation changes its shape. |
| **D10 · Perf & a11y** | F-ii.8 (**after** S-E9), F-iii.13/.12/.15/.14/.16/.17, F-v.27/.28/.29 | Mostly `app.css` + targeted `app.js` — low mutual coupling, but they share `wave1-a11y` / `wave4-a11y-depth` / `wave1-theme` and every one needs a 390×844 screenshot. Batching amortises the visual-evidence cost. |
| **D11 · The capacity model** | S7, then S8 | Weeks. Ship S7 as one release, S8 as the next. Do **not** interleave with D9 — both touch the plan/timeline region. |

### 4.3 What must **not** share a deploy

- **S7 with anything else.** 22 + 14 + 6 + 4 spec-file blast radius. If S7 ships alongside another change
  and the suite goes red, attribution is guesswork — and `CLAUDE.md` §5 forbids guessing.
- **S5.1 (the data/build boundary) with S2 (cure gates).** Both touch cure safety from opposite ends; a
  regression in either would be misattributed.
- **The migration (S1) with anything.** One constant, one variable, one soak.

---

## 5. Ordering by consequence, and the two-for-ones

### 5.1 The ranking

**Tier 1 — unbounded harm or unbounded spend** (no ceiling on the damage from one occurrence):

1. **S0-C · Worker** — `$126/hour` on one leaked code (§3.H.3); the cap is defeated by a one-word URL edit
   (`worker/index.js:43`) and by a corrupted record that never self-heals (`:57-58`). *Unbounded spend.*
2. **S0-A / S0-B · spoken safety numbers** — A1/A2/A3/A4/A12. A wrong number **spoken** to a cook with busy
   hands, from a web-grounded model, with no visible caveat. *Unbounded harm.*
3. **S0-D · conditional `google_search`** — 77–90 % of COGS *and* hallucination surface #3. *Unbounded spend
   + harm.*
4. **S0-F · A9 dates** — silently shortens a nitrite cure (§1.7). *Arguably unbounded harm at near-zero
   cost.* This is the reordering I recommend against §7.

**Tier 2 — bounded harm** (real, but one occurrence has a ceiling):

5. **S2 · A5** — thermometer refusal + cure-scale BLOCK.
6. **S3 · A7/A6** — an invariant nobody sees; a check nobody records.
7. **A8** — the alarm that tells you the meat is done, unreadable in every non-Hebrew language.
8. **B13** (§7 omits) — one refuel checkbox for three refuels on a stick-burner.

**Tier 3 — correctness drift** (nothing is wrong today; the mechanism guarantees something will be):

9. **S5.2** — the Hebrew-leak assertion. *One assertion; closes a class permanently.*
10. **S5.1** — the build APPLIED assertion + the 18 salt values.
11. **S7** — one capacity rule. Collapses seven "two views disagree" defects into one model.
12. **PRE-1/PRE-2** — CI and the port. *Meta-drift: without them the DoD gate itself is unreliable.*

**Tier 4 — features and polish:** S6, S8, S9 leaks, S10, S12, S11, S13.

**Where this differs from §7:** A9 moves from Step 4 to Tier 1; A4, A12, G1, E9, B13 and F-iii.17 acquire a
position at all; and PRE-1..PRE-5 sit ahead of Step 0 because Step 0 cannot be *gated* without them.

### 5.2 The `google_search` two-for-one — verified

**Claim (§7 `:1369`, §3.E.2):** making `google_search` conditional cuts blended COGS `$1.22 → $0.39` *and*
closes hallucination surface #3.

**Verified, both halves, with one correction in the project's favour:**

- **Cost half.** `docs/analysis/sweep/W4-A-unit-economics.md:113` — *"Blended (equal weight) | $1.22"*.
  `:198` — *"Worst persona $0.99, blended $0.39"* under the heading *"After making `google_search`
  conditional"*. `:16` — the grounded-search line item is `$0.0350` and *"77–90 % of every persona's entire
  monthly cost"*. **The $1.22 → $0.39 figure is sourced and internally consistent.** It is a 68 % reduction,
  matching §7's claim.
- **Safety half.** `app.js:4249` (`askGemini`) and `app.js:5278` (`vcAskAI`) both pass
  `tools:[{google_search:{}}]` unconditionally — read at the line. Grounded search injects third-party page
  content into the model's context; §3.E.2 classifies it as hallucination/injection surface #3. **Confirmed
  by reading, not by citation alone.**
- **Correction in the project's favour — it is cheaper than §7 says.** The conditional mechanism is already
  in the file: `app.js:4356` `tools: search?[{google_search:{}}]:undefined`, with `search` an `aiJSON`
  option that two callers already pass (`6337`, `6373`). And `askSafetyIntent` (`4117`) is a working
  deterministic-regex intent classifier to copy the shape from. **This is wiring plus one new classifier,
  not a new mechanism.**

*One caveat worth stating:* the numbers rest on W4-A's persona model, which is an estimate of usage
patterns, not measured user behaviour — there are **zero analytics** (§3.G.3). The *ratio* (search fee
dominates tokens) is robust because it follows from a per-request fee of `$0.035` against measured token
costs; the *absolute* per-user figures are modelled.

### 5.3 Other two-for-ones

| # | The change | Payoff A | Payoff B | Verified |
|---|---|---|---|---|
| **1** | **S-E9 · MT hydration → build time** | Closes an **uncapped cost leak** — per-element calls at ~600 tokens (`app.js:6974`), cache stops persisting above 3,000 entries (`6981`), so translation re-runs forever (§3.E.9) | **Removes `hydrateMT` from the MutationObserver's work.** The observer callback at `app.js:9540` runs `applyI18n` + `tnode` + **`hydrateMT`** over the whole body on a 50 ms debounce whenever `getLang()!=='he'` — the mechanism behind §3.F-ii.8's *62 % of wall-clock in long tasks* | **Read both lines this session.** §7 connects neither and schedules E9 nowhere. **This is the best unexploited two-for-one in the corpus.** |
| **2** | **S0-E · TTS routing** | Managed users stop getting the *weaker* voice — `gemSpeak` requires BYOK (`5026`), `vcSpeak` only calls it `if(gemKey())` (`5061`), yet the Worker allow-list (`worker/index.js:43`) already matches `…:generateContent` and would forward it | The owner stops being silently billed — `5030` calls `gemFetch` **without `opts.key`**, so `gemMode()` routes managed | Read at all four lines. §7 already calls this "two bugs, one fix" (`:1372`) — confirmed. |
| **3** | **B28 · a real 404** | Clears **both** failing SEO audits (`robots-txt`: 11,313 parse errors; `llms-txt`: missing H1) — §3.F-iii.11 lists both as failing | Stops paying **645 KB of egress per crawler probe or broken link** (§3.B.28) | Two audits + a cost line = three-for-one, from a `build.py:400-430` edit. |
| **4** | **B27 · `sw.js` SHELL dedupe** | 62 % of a first visit's bytes (1,321,953 of 2,117,219 — §3.B.27) | Cloudflare egress cost, on every first visit | `build.py:405` `const SHELL=['./','index.html',…]` — read this session. **One line.** |
| **5** | **S3 · surface `safetyDiff`** | Closes a 🟠 safety gap — the code comment at `5709-5710` claims violations are "surfaced" and they are not | **Unblocks S11.** §7 `:1403-1404` is right: "the precondition for any AI proposer" | `_plcConflicts` written `5692`, rendered `5739`; `_planSafetyViolations` written `5711/5717`, read by nothing in `app.js`. |

**Anti-pattern to avoid:** F-ii.8 (scope the MutationObserver) done *before* S-E9 means measuring, scoping
and re-measuring the same callback twice. **Do E9 first.**

---

## 6. Parallel vs serial

### 6.1 The real serialization constraint is the gate, not the code

Before discussing code independence: today, **the DoD gate is a global lock.**

- `playwright.config.ts:5` — `const PORT = 8123;` **hardcoded**, with `reuseExistingServer: false`. Two
  concurrent runs both try to bind 8123.
- `CLAUDE.md` §11a — *"**Never run two suite runs concurrently** — racing runs produced 12 then 127 phantom
  `ERR_CONNECTION_REFUSED` failures."*
- DoD line 12 requires a full suite per task, `retries: 0`.

**So N parallel subagents today produce N queued suite runs on one machine.** "Parallel tracks" are a
fiction until **PRE-2** (parameterize the port) and ideally **PRE-1** (move the gate to CI runners) land.
PRE-2 is a one-line change. It should be the first commit of the program.

### 6.2 Strictly serial dependencies (verified, not assumed)

```
PRE-2 ──────────────────────────────► (any genuine parallelism of the gate)
PRE-1 ──────────────────────────────► (fan-out beyond one machine)
PRE-3 ──► S0-C (Worker)                [0 tests reference worker/index.js today]
PRE-4 ──► baseline ──► S1 (migration)  [and PRE-4 should also precede S0-A/S0-B/S0-D]
PRE-5 ──► S1                           [grounding validators untested; 0 hits in tests/]
S-E9  ──► S10's F-ii.8                 [E9 removes hydrateMT from the observer's work]
S3    ──► S11                          [an invariant nobody sees cannot gate anything]
S7    ──► S11                          [a solver needs one definition of a clash]
S7    ──► S8                           [S8 changes the input to the rules S7 unifies]
S0-A  ──► (A12 with it, not after)     [guarding text while speech stays unguarded is incoherent]
D2 (Worker) ⊥ everything app-side      [separate deploy target — genuinely independent]
```

### 6.3 Genuinely independent tracks (after PRE-1/PRE-2)

| Track | Code territory | Test territory | Deploy | Conflicts with |
|---|---|---|---|---|
| **W · Worker** | `worker/index.js` (91 lines) | new (PRE-3) | Worker | **nothing** — the cleanest parallel track in the program |
| **A · AI guards & cost** | `app.js` 4100–5300 | `ai-trust`, `wave3-ai-hardening` | Pages | Track I at 6950–7000 (A2 / mtGuard) |
| **I · i18n** | `app.js` 6870–7000, `build.py` i18n, `lang/*` | 6 × `wave5-i18n-*`, `i18n-foundation`, `lang-switcher` | Pages | Track A (A2), Track P (F-ii.8 via the observer) |
| **D · dates** | `app.js` 2789–2790, 5531 | **none today** | Pages | nothing measured |
| **G · copy/honesty** | `build.py:334`, `app.js:3929-3939`, `lang/en.json`, `README.md` | `wave5-desc-offline` | Pages | nothing |
| **P · perf / a11y / SEO** | `app.css`, `build.py:400-430`, `app.js:9540` | `wave1-a11y`, `wave4-a11y-depth`, `wave1-theme`, `occ-css-tokens` | Pages | Track I at `9540` |
| **S · scheduling/capacity** | `app.js` 240–700, 2950–3300, 5500–5990, 7830–7990 | 22 occupancy + 14 `mk-tlserve` + 6 + 4 | Pages | **almost everything in the plan region** — run alone |
| **B · probes / log-import** | new surface + `app.js` 5381–5416 | new | Pages | nothing |

**Practical maximum useful parallelism: 3–4 tracks.** W + D + G + one of {A, I, P} is safe. Adding S makes
everything else risky because a red suite becomes unattributable.

### 6.4 One nuance about "a fresh agent per task"

`CLAUDE.md` states subagents inherit `CLAUDE.md` but not conversation memory. For the high-blast-radius
clusters (S7, S8, S5.1) that is a hazard: a fresh agent that turns 22 occupancy specs red has no context for
which reds are *expected* re-derivations and which are regressions. **For S7 specifically, record the
expected-red list in the plan before dispatching**, so the agent has an artifact rather than a judgement
call — and so an independent re-auditor checks against the spec, not against the agent's own ledger
(`CLAUDE.md` §3 per-phase gate).

---

## 7. The verification story — what must exist before this program runs

Eight prerequisites, in dependency order. Each is stated with the measurement that justifies it.

### 7.1 CI on GitHub Actions — **required, cheap, do first**

- **Evidence of absence:** `ls .github` → *No such file or directory*. `package.json` `"test": "echo \"Error: no test specified\" && exit 1"`. (§3.E.3 confirmed.)
- **Evidence it is cheap:** remote exists (`origin https://github.com/Dudi-Bar-On/matkonetesh.git`);
  `build.py` imports only `json`, `re`, `os`, `glob`, `shutil`, `hashlib` + local modules — **no
  `requirements.txt`, no `pyproject.toml`, no third-party Python**; exactly one npm devDependency
  (`@playwright/test`); `playwright.config.ts` already honours `forbidOnly: !!process.env.CI`.
- **Shape:** `setup-python` → `npm ci` → `npx playwright install --with-deps chromium` → `npx playwright
  test`. ~30 lines.
- **Why it is a program prerequisite, not a nicety:** DoD line 12 is per-task. At ~60 tasks that is ~60 full
  suite runs that currently must be initiated and watched by hand, serially, on one machine.

### 7.2 Parameterize the Playwright port — **required, one line**

`playwright.config.ts:5` `const PORT = 8123;` → read from env with 8123 as the default. Without it, §6.1's
global lock stands and the program's parallel tracks cannot gate concurrently. This is the highest
value-per-character change available.

### 7.3 A Worker test harness — **hard blocker for Step 0's largest item**

- **Evidence:** `grep -rl "worker/index\|X-Access-Code\|streamGenerateContent" tests/` → **0 files**. No
  `vitest`, no `miniflare` config anywhere outside `node_modules`. `worker/package.json` has scripts for
  `login`/`deploy`/`dev`/`whoami` — **no `test`**.
- **Consequence:** for B19, B20, B21, B22, H3, E14, DoD line 2 (witnessed RED), line 3 (GREEN), line 4
  (behavioural assertion) and line 12 (full suite green) are **unsatisfiable today**. `npx playwright test`
  does not load the Worker at all.
- **What it needs:** `wrangler`'s `unstable_dev` (already a devDependency in `worker/package.json`) or
  `@cloudflare/vitest-pool-workers`, plus a KV stub, plus a fake upstream so metering can be asserted
  without spending money. The specific cases the audit demands: `streamGenerateContent` rejected/metered; a
  corrupted KV record **failing closed**; concurrent requests not under-counting; a hanging upstream
  aborting.

### 7.4 A live-model eval harness + an incumbent baseline — **hard blocker for the migration, and time-limited**

See §1.1 and §3. Requirements:

- **Keyed and opt-in**, excluded from the default `npx playwright test` run — it costs money and is
  non-deterministic, and DoD line 12 forbids flake tolerance in the main suite.
- **A golden set** covering what the guards care about: refusal on dangerous intents (`AI_REFUSALS`,
  `4146-4197`), grounding fidelity against `SAFETY_FACTS()` (`4121`), Hebrew output in Hebrew mode and no
  Hebrew leak in English mode (§8.2.12 names this class explicitly), and JSON conformance (there is **no**
  constrained decoding — `grep -n responseSchema app.js` → 0 hits, §3.E.11).
- **A recorded baseline against `gemini-2.5-flash`, captured before 2026-09-01.**

### 7.5 Coverage for the three grounding validators — **cheap, high value**

`grep -rn "aiValidateKeys\|aiValidateItems\|aiValidateSeasonings" tests/` → **0 hits**, against three
validators (`app.js:4387`, `4394`, `8393`) that §3.E.4 calls *"the primary defence for 7 features"*. They are
pure functions. This is a 1–2 task fix that materially raises confidence in every subsequent AI change,
including the migration.

### 7.6 A service-worker-exercisable environment

`app.js:9546` — `if('serviceWorker' in navigator && location.protocol==='https:')`. §3.B.26 measured
`isSecureContext === true` on `http://localhost` while `protocol` is `http:`, so **the SW, its update toast
and its SW-delivered alarms are unexercisable by any local or CI run** (`getRegistrations() → 0`). Two
consequences: §3.B.27 (SHELL dedupe, `build.py:405`) would ship untested; and the entire update-delivery
channel — the mechanism by which every one of this program's releases reaches a user — has no test.
Either relax the gate to `isSecureContext`, or add one HTTPS CI job.

### 7.7 A mobile-viewport project, so DoD line 8 produces artifacts

DoD line 8 mandates a **390 × 844** screenshot for any UI change; line 9 mandates a Hebrew render.
`playwright.config.ts` declares exactly one project: `{ name: 'chromium', use: { ...devices['Desktop
Chrome'] } }` — **no mobile project at all.** Tests set viewports ad hoc, and inconsistently: measured
`setViewportSize` calls across the suite are 390×**900** (7), 390×**820** (7), 390×**844** (2), 390×**780**
(2), 390×**1000** (1). Only two call sites use the DoD's own dimensions.

For a program with a large UI component (S9, S10, S6, S8), adding a 390×844 project — even applied to a
subset via a grep filter — converts DoD line 8 from a manual step into a build artifact, and removes the
"which height did they screenshot?" ambiguity.

### 7.8 A suite-runtime budget, re-measured on schedule

`playwright.config.ts`'s own comment: *"As the suite grew (308→324 tests) 8 workers began an occasional
short run … so it was lowered to 6: 324/324 across repeated runs at ~145s. **Re-measure and adjust if the
suite grows substantially again.**"* The suite is now at **415** declarations — already ~28 % beyond the
measured point. This program will add substantially more. **Schedule the re-measurement as a task rather
than discovering it as a flake**, because `CLAUDE.md` §3.12 treats any intermittent failure as a bug to
debug — which is correct, and expensive if the cause is a stale worker count.

### 7.9 Summary — what each prerequisite unblocks

| Prereq | Cost | Unblocks |
|---|---|---|
| PRE-2 port | 1 line | all parallelism |
| PRE-1 CI | ~30 lines | the gate at scale; scheduled live-model drift runs |
| PRE-3 Worker harness | 1–2 tasks | **all six Worker items** (Tier-1 unbounded spend) |
| PRE-4 live eval + baseline | 2–3 tasks, **deadline-bound** | the migration, **and** trustworthy verification of every AI guard change |
| PRE-5 validator coverage | 1–2 tasks | confidence in the migration and in S0-A/D |
| SW-exercisable env | ~1 task | B27, and any test of update delivery |
| 390×844 project | ~1 task | DoD line 8 as an artifact across S6/S8/S9/S10 |
| runtime re-measure | ~1 task | prevents a flake class that §3.12 forbids averaging away |

**Total prerequisite cost: ~8–12 tasks, roughly one week.** Against a program of ~60+ tasks under a 12-point
gate, with four Tier-1 items currently ungateable, that is the cheapest week in the plan.

---

## 8. The recommended sequence, as a single list

Differences from §7 are marked **[Δ]**.

| # | Step | Contents | Notes |
|---|---|---|---|
| **−1** | **[Δ] Prerequisites** | PRE-2, PRE-1, PRE-3, PRE-5; **start PRE-4 immediately** | §7 has no step here. ~1 week. |
| 0a | **Worker deploy** | B19, B20, B21, B22, H3, E14 | Separate deploy target **[Δ]**; needs PRE-3 |
| 0b | **App "stop the bleeding"** | A1, A2, **A4 [Δ]**, **A12 [Δ]**, A15, A3, E2, E7/E8, **A9+B18 [Δ from Step 4]**, **G1 [Δ]** | §7's Step 0 plus four additions |
| 0c | **[Δ] Baseline the incumbent model** | PRE-4 output, recorded | **Before 2026-09-01.** The option expires with the model. |
| 1 | **Migration** | E1 + the TTS preview model **[Δ]** | Flip by 2026-09-15; §3 |
| 2 | **Named safety commitments** | A5 | Unchanged |
| 3 | **Monitor → control** | A7, A6 | Unchanged; A7 is 6 lines from its answer |
| 4 | **[Δ] i18n batch, moved earlier** | F-i.1 gate + delete 3 dicts, **assertion 5.2**, F-i.2, F-i.3, A8, E13, **E9 [Δ]** | Moved ahead of §7's Step 9 because assertion 5.2 is a class-closing preventive and E9 gates the biggest perf win |
| 5 | **Build-output wins** | B27, B28, F-ii.10, F-ii.9 | All `build.py:400-430` |
| 6 | **Perf & a11y** | **F-ii.8 (after E9)**, F-iii.13/.12/.15/.14/.16/**.17 [Δ]**, F-v.27/.28/.29 | §7's Step 10, plus the omitted .17 |
| 7 | **Data/build boundary** | S5.1 (A10, A11, §5.5, §5.6) | Re-scoped per §1.5 — a schema change, not an assertion |
| 8 | **Wire the kit** | D1, D3, D10, D2, C3, **B13 [Δ]** | §7's Step 6, plus the omitted refuel-key collision |
| 9 | **One capacity rule** | S7 | Weeks. Ship alone. |
| 10 | **Guest-scaled demand** | S8 | After S7 |
| 11 | **Log-import probes** | S12 item 1 | Independent track — can run in parallel from step 4 onward |
| 12 | **Orchestrator** | S11 | After 3 and 9 |
| 13 | **Monetization** | S13 | ~2 quarters |

---

## 9. Uncertainty — stated as uncertainty

1. **Effort figures are estimates, not measurements.** They are calibrated against observed velocity (four
   phases on 2026-07-21) and the measured DoD tax (~3.1 min/suite run extrapolated from the config's own
   324-test/145 s datapoint). The **task counts** are more reliable than the wall-clock bands. S7 and S11 are
   the least reliable — both are model changes whose cost is dominated by unknowns.
2. **The suite-runtime extrapolation is linear and unverified.** I did **not** run `npx playwright test` —
   §11a forbids concurrent runs and I could not confirm the machine was free. 415/324 × 145 s ≈ 186 s is
   arithmetic, not a measurement. **Measure it before relying on it.**
3. **Blast-radius counts are file-level greps on a central identifier**, not dependency analysis. A file
   that mentions `deviceOccupancy` may have one incidental reference. They are an **upper bound on files
   touched**, useful for ranking, not for planning individual reds.
4. **The unit-economics ratios rest on W4-A's persona model**, and there are zero analytics (§3.G.3). The
   *ratio* (a `$0.035` per-request fee dominating token cost) is robust; the *absolute* per-user dollars are
   modelled. §5.2.
5. **The 2026-10-16 date is taken from the corpus, not re-fetched.** W5-D reports two independent fetches of
   Google's deprecations table; I did not repeat them in this session. **Re-verify before committing the
   schedule** — the whole of §3 hangs on it.
6. **`gemini-2.5-flash-preview-tts` has no announced shutdown date** per W5-D, also not re-fetched. Preview
   models can move without appearing on the deprecations table. Treat §1.2 as a risk to monitor, not a dated
   deadline.
7. **The soak-length recommendation (~4 weeks) is a judgement**, argued from the absence of telemetry, not
   derived from data. There is no measurement that says four weeks is right.
8. **I did not attempt to reproduce any of the audit's runtime measurements** (the 62 % long-task figure,
   the 1,146 `serve.js` restarts, the CLS numbers, the addDays DST result). I verified the *code* those
   findings point at, at the cited lines. Where a finding is measurement-only, I have treated it as the
   audit reports it and said so.
9. *(Resolved during analysis — kept for the record.)* I initially flagged `wave5-desc-offline.spec.ts` as a
   possible G1 tripwire on the strength of its filename. Opened: its two tests are *"a pre-translated
   description renders in English with no AI key"* and *"switching a description back to Hebrew restores the
   original"* — descriptions, not the offline copy. And `grep` for the offline strings across all 82 spec
   files returns 0 hits. **G1 has no test blast radius.** Noted as an instance of the corpus's own lesson:
   the filename was the first artifact, and it was wrong.
10. **§8.2 of the ULTIMATE doc lists 13 things the sweep could not settle.** None of them is resolved here.
    In particular #13 — *"whether the app is usable by a cook with greasy hands at a fire"* — is described
    there as "the largest unmeasured surface in the product", and **no step in §7 or in §8 above addresses
    it**, because no amount of sequencing substitutes for observing a user.
