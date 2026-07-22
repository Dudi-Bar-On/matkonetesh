# VERIFY · W1-A — adversarial verification of `W1-A-code.md`

**Date:** 2026-07-22 · **Verifier stance:** adversarial (goal was to REFUTE, not to agree)
**Report under review:** `docs/analysis/sweep/W1-A-code.md` (audited at `380c57a`)
**Tree state:** HEAD is now `0458dcc`, but `git diff --stat 380c57a..HEAD -- app.js app.css serve.js build.py worker/` is **empty** — every audited file is byte-identical to what the report read. No staleness excuse is available in either direction.

**Method.** Every claim was re-opened at the cited `file:line`. Where a claim asserted *absence* ("never read", "zero callers", "no helper exists"), I did not accept a single grep — I enumerated the alternative mechanisms by which the thing could exist (bracket-notation property access, dynamic `window[fn]` dispatch, the i18n dictionary walk, the build-time merge) and tested each. Where a claim was runtime-observable, I **ran it**: `python build.py && node serve.js 8199`, then drove the real built artifact with Playwright from standalone scripts in the scratchpad. No repo file was created, edited, or deleted; `git status` on `app.js app.css build.py serve.js worker/ tests/ index.html dist/ site/` is clean (the rebuild was byte-identical).

| Verdict | Count |
|---|---|
| **CONFIRMED** | 22 |
| **REFUTED** | 5 |
| **UNVERIFIABLE** | 1 |

---

## REFUTED

### R1 — "14 captured device properties have zero readers" (§2) — **FALSE. All 14 are read, at runtime.**

The report claims `nozzles, plates, bagKind, bagW, lid, fan, accuracy, pulse, rotisserie, speed, steam, throughput, waterPan, watts` "are never read anywhere via `propOf()` or `.cap.<key>`", verified with `grep -c "propOf([^)]*,'X')\|\.cap\.X\b"` = 0.

That grep is **reproducible and returns 0 for all 14** — I ran it. It is also the wrong grep. Every read of these keys is **bracket notation**, which the pattern cannot match:

- `app.js:6393-6399` — the device-card chip renderer inside `openEquipment`, a generic loop over the category's own schema:
  ```js
  (c.props||[]).forEach(function(p){
    const raw=d.cap?d.cap[p.key]:undefined; if(raw===undefined||raw===''||raw===null) return;
    ... s+=`<span class="eq-chip">…</span>`;
  });
  ```
  `c` is the `EQUIP_CATS` entry for the device's category, so `p.key` iterates over exactly these props. 12 of the 14 are `props` entries and go through this line.
- `app.js:6390` — the `multiCap` branch, `d.cap[mk.key]`, covers the other two (`plates` for grinder, `nozzles` for stuffer).
- `app.js:2998` — `_sizesOf(dev,key)` reads `dev.cap[key]`, used by `choosePlate`/`chooseNozzle`.
- `app.js:6602` — `propVal(p)` reads `dev.cap[p.key]` to pre-fill the edit form.
- `chipsFor` is live, not dead: called at `app.js:6432`, and covered by tests `equipment-props.spec.ts:150` (E6) and `equipment-walkthrough.spec.ts:82`.

**Runtime proof.** I saved one device per category with all 14 keys populated, opened the equipment panel in the real built app, and read the DOM:

```
SM  💧 מגש מים מובנה                                   (waterPan)
GR  🔒 מכסה | 🔄 שיפוד מסתובב                          (lid, rotisserie)
OV  🌀 טורבו | ♨️ אדים                                  (fan, steam)
SV  ⚡ 1200 W                                          (watts)
VA  📏 35 ס״מ | 📦 גליל לחיתוך | 〰️ מצב לח/פולס         (bagW, bagKind, pulse)
PR  🎯 0.5 ±°C                                         (accuracy)
GD  ⚙️ 4.5 · 8 מ״מ | ⏱️ 3 ק״ג/דק׳                       (plates, throughput)
ST  🔩 16 · 22 מ״מ | ⚙️ שתי מהירויות                    (nozzles, speed)

CHIPS with values: 14   with cap={}: 0
```

14 properties in, 14 chips out; clear the values and all 14 chips vanish. The chip is a *read* of that exact key, not decoration.

**What survives.** A narrower, true statement: these 14 are read for **display only** — none feeds the planning/occupancy/safety engine (contrast `hooks` and `canHang`, which `deviceCanHang` reads via `propOf` at `app.js:330`). That is a real and worth-reporting asymmetry. But "captured device properties with zero readers — 14" as written is false, and it is precisely the project's established failure mode: one grep pattern over one mechanism, reported as absence.

### R2 — The marquee exemplar for §1's "systemic pattern" is a misquote. **`equipPlan` is called UNGUARDED.**

§1 argues the codebase's de-facto module system is "check the function exists before calling it," and cites:

> `app.js:5673`: `if(typeof equipPlan==='function') stages=equipPlan(...)`

The actual line 5673 is:

```js
stages=equipPlan(m, st.method, stages, (typeof evScope==='function'?evScope():null));   // Phase 3: the seam …
```

There is no guard on `equipPlan`. The `typeof` on that line guards **`evScope`**, a different function, inside an argument expression. `grep -n equipPlan app.js` returns exactly four hits — the definition (`973`), two comments (`3035`, `5862`), and this one unguarded call site. Delete or rename `equipPlan` and this line throws a loud `ReferenceError`; it is the opposite of the silent-no-op failure mode the section builds on it.

The *general* claim is fine (see C2): 483 `typeof …==='function'` guards do exist. But the one piece of evidence offered to connect the pattern to the actual inert-shipment incidents does not say what the report says it says.

### R3 — §3's second pluralization bug site (`app.js:8010`) is unreachable with n=1.

The report calls `8010` "same pattern, same bug". Line 8009 opens the block:

```js
8009:  if(list.length>=2){ const hero=combinedTimelineHTML();
8010:    if(hero) html=`… ${list.length} ${L('אירועים','events')} ↗ …`
```

The count is guarded to `>=2`, so the plural noun is always grammatically correct there. Runtime check with 1 and 2 events: `#cetFull` does not render at n=1 at all. **One live bug site, not two.**

### R4 — §3's contrast case (`app.js:5900`, `cookerStripHtml`) contains no count and no conditional.

The report: *"Contrast with `app.js:5900` (`cookerStripHtml`) which gets a different count label right by inlining its own conditional."* Line 5900 in full:

```js
const cookerStripHtml=_ckRows.length?`<div class="tl-orderstrip"><div class="tl-orderstrip-lbl">🔧 ${L('שיוך מכשיר:','Assign cooker:')}</div>${_ckRows.join('')}</div>`:'';
```

No number is interpolated, no singular/plural branch exists. The ternary tests whether the strip renders at all. The nearest real `>1` conditionals in the file (`7410` " ועוד"/" & more" suffix, `7920` event-breakdown) are not count-label pluralization either. The narrative "the fix exists ad hoc in one place and was not extracted" has no referent.

### R5 — The empty-catch count is wrong (108 claimed; 116 actual).

`grep -o "catch(e){}" app.js | wc -l` → **116**. `grep -o "catch{}" app.js | wc -l` → **0**. Whitespace-tolerant `catch\s*(\(…\))?\s*\{\s*\}` → **129**. The report's 108 is an undercount. This is a numeric error, not a directional one — it makes the surrounding point (most are legitimate progressive-enhancement guards) stronger rather than weaker — but the figure as printed is not what the file contains.

---

## CONFIRMED

### C1 — §0: all 8 "already fixed" claims hold (do not re-report them)
Independently re-opened: `equipPlan` defined at `973`, called at `5673`; `scale_res` read at `6266` (`equipSpecNote`); `hooksOver` set at `516`, read at `652` (bay CSS class) and `668` (fit-line warning); H1 unmeasured footprint → `null` at `369`, excluded from both buckets at `426`; H2 `Math.max` at `487-491` with `pctFloor` at `492`; H3 `deviceCanHang` at `330` reads the device's own `canHang`+`hooks` via `propOf`; S3 advisory strip at `5901-5913`; one `planSchedule` (defined `2978`, called `5678` and `7850`) and one `rawGramsFor` (defined `4713`, six call sites). §0 row 22 (RTL gradient) was correctly self-dropped as unverifiable by static read.

### C2 — §1: 483 `typeof …==='function'` guards
`grep -oE "typeof\s+[A-Za-z_$][A-Za-z0-9_$]*\s*===\s*'function'" app.js | wc -l` → **483**, exact. (See R2: the pattern is real, the cited exemplar is not.)

### C3 — §1: region map and file inventory
Spot-checked and correct: `app.js:2718` is literally `/* ---------- wire ---------- */`; `5345` is the Live Cook Copilot banner; AI features banner-delimited at `8124, 8293, 8390, 8458, 8525, 8637, 9131`; `ls tests/*.spec.ts | wc -l` → **82**. Line counts match: app.js 9564, app.css 1710, serve.js 57, build.py 430, worker/index.js 91.

### C4 — §2: 9 orphaned functions, zero callers
`svBaths(230)`, `gearLabelFor(794)`, `groupOf(1731)`, `svOrderDesc(2958)`, `itemPickLabel(3292)`, `cNavState(7127)`, `cwSeasFull_desc(7292)`, `cwToggleSeasByKind(7333)`, `cwSeedResume(7458)`. Each has **exactly one** whole-word occurrence in `app.js` and one per built bundle (`index.html`, `dist/index.html`, `site/index.html`), zero in `tests/`. I specifically checked the dynamic-dispatch escape hatch — `app.js:7591, 8848, 9348, 9446` invoke `window[fn]()` from `data-hfn`/`data-mfn` attributes — but a `data-hfn="svBaths"` string would itself be a whole-word hit, and there are none. No `globalThis[…]`, no name concatenation.

### C5 — §2: `cwToggleSeasByKind`'s "used by tests/legacy" comment is stale
`grep -r cwToggleSeasByKind tests/` → zero hits. The comment at `app.js:7332` is wrong.

### C6 — §2: four self-documented stubs are uncalled
`saveCart(1459)`, `cwPaintMethods(7459)`, `cwPaintProteins(7460)`, `cwUpdateHint(7461)` — one occurrence each in `app.js`, zero in `tests/`. Not merely no-ops: nothing invokes them.

### C7 — §2: `choosePlate`/`chooseNozzle` are test-only; `chooseBath` is wired
`choosePlate(3014)` and `chooseNozzle(3024)` appear only in `app.js` (definition) and `tests/equip-chooser.spec.ts`. Their sibling `chooseBath(3004)` is called from production at `app.js:630`.

### C8 — §3: no shared pluralization helper exists
`grep -niE "function [a-z_$]*plural|plural\("` over `app.js` → zero hits.

### C9 — §3: `app.js:7973` renders "1 events" — reproduced at runtime
`` `${list.length} ${L('אירועים','events')}` ``. Driving the real app with `mk-lang='en'`:
```
n=1  #cEvCount = "1 events"
n=2  #cEvCount = "2 events"
```
Genuine grammatical bug. (Hebrew "1 אירועים" is equally wrong.) This is the *only* live site — see R3.

### C10 — §4: `build.py` `_js_str` does not escape `</script`; no build-time guard
I extracted the **real** function body from `build.py:348` and executed it rather than reimplementing it:
```
'a</script>b'   -> "'a</script>b'"   | survives verbatim: True
'a</SCRIPT >b'  -> "'a</SCRIPT >b'"  | survives verbatim: True
```
It escapes `\`, `'`, `\n`, `\r`, U+2028, U+2029 — nothing else. The output is substituted at `build.py:378` into `<script>__JS__</script>` (`build.py:340`) via `app.js:2`'s `const DATA = __DATA__;`. Zero occurrences in sources today (`data.py`, `sausages_new.py`, `sources.py`, `descriptions.py`, `seasonings.py`, `lang/*.json`), and the built `index.html` contains exactly **1** `</script`. Latent, not live; there is no guard preventing it.
*One precision correction:* per the HTML tokenizer, script-data only ends on `</script` followed by whitespace, `/`, or `>`. A bare `</scriptfoo` would not close the tag. The practical trigger is `</script>` or `</script `, not "that literal substring" as written.

### C11 — §4: `build.py:334` ships a false offline claim to every user — but it is **not** untranslated
The footer text is hard-coded in the HTML template. The report's supporting evidence (`grep "footnote\|הנתונים מקומיים" app.js` → 0 hits, therefore "not overridden anywhere") is the **wrong evidence** and walks straight into this project's known trap: the override mechanism is the generic `tnode()` dictionary walk (`app.js:6907-6919`), not an `app.js` reference. The string *is* in `lang/en.json:261`:

> `"Matkonet · Fire Guide — built from Dudi's tables. Data is local, no network connection. Checklist marks are saved in the browser."`

Runtime, both languages:
```
[he] … הנתונים מקומיים, ללא חיבור לרשת. …
[en] … Data is local, no network connection. …
```
**The finding survives on substance and is arguably worse than reported** — the stale claim was deliberately translated, so it ships in every shipped language rather than only Hebrew. The reasoning that got there was unsound; the conclusion is right.

### C12 — §4: `app.js:9562` swallows service-worker registration failure
`}).catch(function(){});` — completely empty, on the registration that installs the offline shell and the update-delivery channel documented at `9555-9558`.

### C13 — §4: dead `try/catch` around `store.set`, and an unconditional success toast
`store.set` (`app.js:1435`) catches internally, calls `mkStorageWarn`, returns `true`/`false`, and cannot throw. The wrappers at `3641`, `8792`, `8822` are therefore dead catches — including `8792`, whose wider try body also contains only non-throwing calls (`reminders()` is `store.get('mk-reminders')||[]` at `3542`, and `store.get` has its own internal catch at `1434`). The real defect is confirmed: `8822` ignores the returned boolean and `8823` fires `toast('נרשם ביומן ✓')` unconditionally, so a failed write reports success.

### C14 — §4: `cookerFor` conflates "no gear" with "needs a pick"
`app.js:243` returns `null` when there are no candidates; `app.js:253` returns `null` when two same-class devices are unresolved. Both falsy, indistinguishable to `if(!cookerFor(...))`. Accurately described as a footgun rather than a live bug.

### C15 — §5: exactly one `fetch()` call site, and `gemFetch` is hardened as described
`grep -n "fetch(" app.js` → **one** hit, `4223`, inside `gemFetch`. No `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket`, or dynamic `import()` anywhere in `app.js`. Every specific claim checks out: `AbortController` + 25s default (`4216, 4220-4221`), backoff `500·2^i` (`4219`), retry restricted to `429/500/502/503/504` (`4227`) and `AbortError`/`failed to fetch` (`4230`), managed→BYOK on `401/402/403` (`4226`), distinct `timeout` / `api-<status>` / original error (`4228, 4232`).
*Minor overstatement:* "**All** outbound network traffic funnels through exactly one `fetch()`" is not literally true — Google Fonts loads via `<link>` at `build.py:144-146`. All *API* traffic does.

### C16 — §5: `aiJSON`'s repair chain cannot crash on a malformed model response
`app.js:4372-4373`: `JSON.parse(aiStripFences(raw))` → strip control chars `[ -]` → `aiRepairJson(...)` → throws a clean error. Plus a whole-call retry at `4370-4371` on `api-4xx`/`empty-*`. Three stages, as claimed.

### C17 — §5: all 7 AI features fail loudly with a local fallback
Checked all seven cited ranges, not a sample: `8227-8234` (toast + local result), `8283-8287` (toast + local schedule), `8364-8366` (error panel + retry button), `8444-8453` (toast pointing at the manual picker), `8507-8509` (toast + fallback mode), `8596-8599` (error panel + retry, with a `bad-structure`-specific message), `8671-8672` (toast + reopen journal). No silent failure, no stuck loading state.

### C18 — §6: the Worker fails **open** on a corrupted KV record
`worker/index.js:53-60`. If `raw` is truthy but not valid JSON, `catch { rec = { active: true }; }` substitutes a permissive record. `rec.active === false` at `57` is then false, and `typeof rec.cap === 'number'` at `58` is false because `cap` is `undefined` — so the cap check never fires. Malformed stored data grants **unlimited** access. Failure direction is backwards.

### C19 — §6: uncapped codes are unmetered, not merely uncapped
The metering block at `77-87` is gated by `typeof rec.cap === 'number' && rec.cap > 0` — byte-identical to the enforcement gate at `58`. `rec.used` is never written for such a code, so no audit/billing record exists at all. `worker/README.md:58` confirms `add carol 0 # uncapped` is the intended admin pattern, so the *cap* is by design; the absent counter is a side effect of reusing one flag for two jobs.

### C20 — §6: no timeout on the Worker's upstream Gemini fetch
`worker/index.js:66-70` passes `{method, headers, body}` — no `signal`, no `AbortController`. The `try/catch` at `71-73` returns 502 on *unreachable*, but a hanging response is not an exception. Asymmetric with the client-side `gemFetch`, which is careful about exactly this.

### C21 — §6: unauthenticated health check leaks key presence
`worker/index.js:38-40`: `GET /` → `{ok, service, hasKey: !!env.GEMINI_KEY}` before any code check. Low severity, correctly rated.

### C22 — §6: `serve.js` path traversal genuinely unreachable, and the scope note is accurate
`serve.js:36-45` loads `dist/` into a `Map` whose keys are the only servable paths; a traversal misses the map → 404. The comment at `36-37` states this and it checks out. The cross-reference to `W1-F-ai.md` also checks out: that report covers the CORS wildcard (`W1-F-ai.md:105`) and the token-cap-only abuse model incl. the KV TOCTOU (`W1-F-ai.md:106`), so §6 correctly does not repeat them.

---

## UNVERIFIABLE

### U1 — §1's causal claim about structure and defect density
> *"This is where 'tangled responsibility' concentrates; it is also where the equipment/scheduling defects in §0 lived, which is consistent with less structure correlating with more defects."*

The two premises are checkable and true (the regions are large and un-subdivided; the §0 defects did live there). The inference — that low internal structure *caused* the higher defect density — cannot be settled from this repo: n=2 regions, no defect-density baseline for the other regions, and the §0 defects are equally explained by those regions simply being the newest and most recently churned code. Stated as "consistent with", which is honest hedging rather than a claim, so it is not a defect in the report — but it is not evidence either, and no plan should be built on it.

---

## Note on method, for the next verifier

Four of the five refutations (R1, R2, R3, R4) share one shape: **a grep or a quotation was trusted without opening the surrounding lines.** R1 ran a real grep that really returned 0 and concluded absence, when the reads were in bracket notation two thousand lines away. R2 quoted a guard that guards a different function on the same line. R3 missed an `if` on the line directly above. R4 described a conditional that is not there. C11 reached a correct conclusion through the same unsound move and only survived because the underlying claim happened to be true in both languages.

The cheapest reliable defense found here was not a better regex — it was **running the thing**. The 14-property refutation took one 30-line Playwright script against the already-built artifact and produced an unambiguous 14-chips-vs-0-chips answer that no amount of grepping would have settled.
