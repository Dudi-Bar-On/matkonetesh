# W5-C · Second Opinion — independent audit of app.js / app.css / build.py / serve.js / worker/ / Python data layer

**Date:** 2026-07-22 · **Version audited:** v258 (working tree, `python build.py` run fresh at audit time — `written 2270442 bytes; 130 cuts 47 specials 52 glossary`)
**Method:** I formed my own view before opening `W1-A-code.md`. Every finding below is backed by a `file:line`, a measured number from a command I ran, or a controlled Playwright run against the freshly built `dist/`. Three claims I developed during the audit were **disproved by testing and dropped** — they are listed in §7 so nobody re-raises them.
**Standing constraint honoured:** no source file was modified.

---

## 0. Verification posture

| Kind of evidence | Used for |
|---|---|
| Controlled Playwright run (`chromium`, 390×844, clean context, `addInitScript` instrumentation) | i18n coverage, alarm banner, language persistence |
| Executed Python against the real modules | data-pipeline merge coverage, salt-override deltas |
| Executed Node with `TZ=Asia/Jerusalem` | date-helper defects |
| Executed `serve.js` in an empty dir | fork-loop defect |
| Code reading with exact line cites | worker findings, AI numeric guard |

Anything I could not push into one of those five buckets was dropped, not softened.

---

## 1. Worker / Gemini key — the two findings W1-A did not make

### 1.1 CRITICAL · The token cap is bypassed entirely by `streamGenerateContent`

`worker/index.js:43` admits **two** methods:

```js
if (request.method !== 'POST' || !/^\/v1beta\/models\/[^/]+:(generateContent|streamGenerateContent)$/.test(url.pathname))
```

`worker/index.js:77-87` is the only place `rec.used` is ever incremented:

```js
if (gResp.ok && typeof rec.cap === 'number' && rec.cap > 0) {
  try {
    const j = JSON.parse(text);
    const used = (j.usageMetadata && j.usageMetadata.totalTokenCount) || 0;
    if (used > 0) { rec.used = (rec.used || 0) + used; … await env.CODES.put(…); }
  } catch { /* non-JSON or streamed body — skip metering */ }
}
```

For `:streamGenerateContent` the Gemini body is a **JSON array of chunks**, not an object. `JSON.parse` succeeds, `j.usageMetadata` is `undefined` on an Array, `used === 0`, and **nothing is written**. With `?alt=sse` the body is `data: {…}` lines, `JSON.parse` throws, and the `catch` explicitly skips metering — the comment on that line names the hole without treating it as one.

**Consequence:** a holder of any capped access code changes `:generateContent` to `:streamGenerateContent` in the URL and consumes the owner's Gemini key without limit, forever. The cap is the *entire* abuse model for this Worker (`worker/README.md`), so this is not a hardening gap — it is the control failing open on a path the router deliberately opens.

**Corrective action:** either (a) drop `streamGenerateContent` from the regex until metering handles it, or (b) meter by *request*, not by parsed response — decrement a per-code budget **before** forwarding and reconcile after. (b) is the only version that also survives §1.2.

### 1.2 HIGH · The usage counter is a read-modify-write race, so `cap` is not an upper bound

`worker/index.js:53` reads `rec`; `worker/index.js:66` awaits the whole Gemini round-trip (seconds); `worker/index.js:84` writes `rec` back. Two concurrent requests on the same code both read `used = U`, then write `U + a` and `U + b` — the later write wins and one call's tokens vanish. Cloudflare KV is additionally documented as eventually consistent, so a read can be stale by up to ~60s globally.

The code comments this as "best-effort … fine for a small dev cohort" (`worker/index.js:76`). That is a reasonable engineering trade **only if the failure is bounded**. It is not: the loss is proportional to concurrency, and a client that fires N parallel requests records ~1/N of its consumption. Combined with §1.1 the cap provides no guarantee at all.

**Systemic cause (shared by 1.1 and 1.2):** the quota is enforced against a value derived from the *upstream response*, which the caller controls the shape of and which arrives after the cost has been incurred. A budget must be debited from a source the caller cannot influence, before the spend.

### 1.3 MEDIUM · No CSP or security headers, while the Gemini key lives in `localStorage`

`build.py:427-428` writes the entire `dist/_headers`:

```
/index.html
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/*.png
  Cache-Control: public, max-age=31536000, immutable
```

No `Content-Security-Policy`, no `X-Content-Type-Options`, no `Referrer-Policy`. The BYOK Gemini key is read from `localStorage` at `app.js:5006` (`store.get('mk-gemkey')`) and the managed access code at `app.js:5009`. The page loads a third-party stylesheet from `fonts.googleapis.com` (`build.py:146`) and the user can point the AI transport at an arbitrary origin they paste in (`app.js:5008`, form field `akmCUrl` at `app.js:4533` — no scheme validation, so `http://` is accepted and the access code goes out in cleartext).

I found **no** exploitable injection into the DOM (the AI answer is escaped at `app.js:4454`; the equipment-name field is escaped at `app.js:6590`). So this is defence-in-depth, not an active hole. But given the owner's online-first-with-a-key decision, a CSP is now the cheapest control that turns "any future XSS" from "attacker gets the owner's API key" into "attacker gets nothing", and it costs four lines in the same file that already emits `_headers`.

---

## 2. Python data layer — a live integrity nonconformance the pipeline reports as DONE

This is the finding I would rank highest after §1.1, and W1-A did not examine the data layer at this level.

### 2.1 HIGH · 18 researched salt overrides are computed, printed as "APPLIED", and silently discarded

`gen_sources.py` computes per-make overrides by diffing researched JSON against the shipped recipe, reading the **correct** location:

```python
# gen_sources.py:59-66
cur = (makes_map.get(mid, {}).get('build') or {}).get('calc') or {}
o = it.get('calc') or {}
…
if override: entry['calc'] = override          # only changed calc fields are overridden
```

and then reports them as complete:

```python
# gen_sources.py:91-98
# MAKE calc changes are applied at build time via the sources.py merge (build.calc),
# so they are DONE, not pending.
…
print('=== MAKE calc overrides (APPLIED via sources.py merge) ===')
…
print(f'({len(applied)} make calc overrides applied)')
```

They are not applied. Two independent reasons:

1. `build.py:96-102` skips the key outright — `if _k == "calc": continue`.
2. Even with that guard removed, `build.py:103` writes `MAKES[_mid][_k] = _v`, i.e. the make's **top level**. The app only ever reads the **build** object's calc. Measured:
   `grep -o "[A-Za-z_$][A-Za-z0-9_$]*\.calc\b" app.js | sort | uniq -c` → `4 b.calc`, `1 ref.calc` — and `b` is the build (`app.js:2013 renderBuildInto(sel, key, b)`, consumed at `app.js:2019` and `app.js:2027`). Nothing reads `make.calc`.

**Measured impact** — 18 salt values differ between the researched data and what ships:

| make | shipped g/kg | researched g/kg | cure |
|---|---|---|---|
| `n-kabanos` | 18 | 25 | #1 |
| `m-lapcheong` | 20 | 25 | #1 |
| `n-chorizo-esp`, `n-csabai`, `n-krakowska-pod`, `n-kulen`, `n-pepperoni`, `n-sremska`, `n-teewurst` | 28 | 25 | #2 |
| `n-finocchiona`, `n-fuet`, `n-landjager`, `n-milano`, `n-salchichon`, `m-nduja` | 28 | 26 | #2 |
| `m-linguica`, `m-snack` | 18 | 20 | #1 |
| `m-droe` | 26 | 28 | #1 |

`n-kabanos` is the sharp one: a Cure #1 semi-dry sausage shipping **28% below** its researched salt. Salt is a hurdle alongside nitrite in semi-dry/dry products; this is not a cosmetic delta.

### 2.2 The stated root cause of the "Wave 0 safety fix" is not what the code does

`build.py:96-102` justifies the skip:

> *the auto-generated sources carried a stale numeric `'cure'` (2.5) that clobbered the type and silently suppressed the dried-safety warning.*

The described failure is **real for the intended destination and impossible at the actual one.** Researched JSON uses `calc.cure = 2.5` (a *rate*); `build.calc` uses `calc.cure = '1'|'2'` (a *type*) with the rate in `calc.cureRate` — verified: `('m-bolo', {'cure': 2.5}, {'cure': '1', 'cureRate': 2.5, 'salt': 18})`. Merged into `build.calc`, `app.js:1919` would render **"Cure #2.5"** and `app.js:1924`'s `calc.cure==='2'` dry-cure warning would go false — exactly as the comment says. But the merge writes to the top level, which nothing reads, so no user ever saw that.

**Quality-nonconformance reading.** A corrective action was written and closed against an *unverified* root cause, and effectiveness was never validated (nobody checked that a dry-cured make still shows the warning, nor that the researched values landed). The actual root cause is a **field-name collision between two schemas that share the key `calc.cure` with different meanings and units**, plus a merge that writes to a different nesting level than the generator reads from. The current fix suppresses the symptom by discarding the whole payload; the collision is still in `sources.py` and will recur the moment anyone wires `calc` through properly.

**Corrective action:** rename the researched field to `cureRate` in `gen_sources.py`, merge into `build.calc` (not the top level), and add a build-time assertion that every override the generator prints as APPLIED is present in the emitted payload. That assertion is the preventive action — it makes this class of silent-drop impossible to ship again.

### 2.3 What I checked and found CLEAN (stated so it is not re-audited)

| Check | Result |
|---|---|
| `MAKES.update(NEW_SAUSAGES)` id collisions (`build.py:29`) | 0 colliding ids (50 + 52 → 102) |
| `CUT_DESC` → CUTS join | 130/130 matched, 0 orphans |
| `SPEC_DESC` → SPECIALS join | 19/19 matched, 0 orphans |
| `CUT_SOURCES` / `SPEC_SOURCES` / `MAKE_SOURCES` joins | 130/130, 47/47, 102/102 — no orphaned keys |
| `build.calc` field sanity across all 102 makes | 0 issues: no `cure` without `cureRate`, no non-`'1'/'2'` cure type, no `cureRate > 2.5` |
| `build.calc` coverage | 93/102; the 9 without are 5 shawarma, 3 BBQ roasts, 1 hot-smoked mackerel — none require a cure calculator |
| `build.py:348` `_js_str` U+2028/U+2029 escaping | Correct. `repr()` of the line confirms genuine ` `/` `, not ASCII spaces. **I nearly filed this as a catastrophic bug and it was not one.** |

The Python data layer is in materially better shape than I expected going in. §2.1 is a *pipeline* defect, not a *data* defect.

---

## 3. Date arithmetic — two defects, both reproduced

W1-A has no date/time findings. Both of these are measured with `TZ=Asia/Jerusalem`.

### 3.1 HIGH · `addDays()` loses a day across the spring DST boundary

```js
// app.js:2790
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+(+n||0));return x.toISOString().slice(0,10);}
```

`new Date('YYYY-MM-DD')` parses as **UTC** midnight; `setDate()` mutates in **local** time; `toISOString()` reads back in **UTC**. The round-trip cancels only when the UTC offset is identical at both ends. Israel DST starts 2026-03-27 02:00 (UTC+2 → UTC+3), so any span crossing it comes back one day short. Measured:

```
addDays(2026-03-26, 2)  = 2026-03-27   expected 2026-03-28
addDays(2026-03-25, 3)  = 2026-03-27   expected 2026-03-28
addDays(2026-03-26,14)  = 2026-04-08   expected 2026-04-09
addDays(2026-03-20,10)  = 2026-03-29   expected 2026-03-30
addDays(2026-10-24, 7)  = 2026-10-31   correct  (autumn direction is safe)
```

**Where it lands.** `addDays` drives the cure/dry-project reminder dates: `app.js:9281` `add(L('סיום כבישה — הוצא ושטוף','End of cure — remove and rinse'), addDays(p.start,p.days))`, `app.js:3546` `{text: 'Curing done: '+p.name, date: addDays(p.start,p.days)}`, plus `app.js:3523, 8717, 9219, 9230, 9273, 9275-9278, 9153, 9176`. A cure started in March gets its "remove and rinse" reminder **one day early** — the direction that shortens a nitrite cure. A 3-week dry-cure's displayed finish date is silently off by one.

**Fix:** do the arithmetic in UTC (`x.setUTCDate(x.getUTCDate()+n)`), or on the integer date parts, and never mix a UTC-parsed value with a local mutator.

### 3.2 MEDIUM-HIGH · `today()` returns the UTC date; `isoDate()` returns the local date

```js
// app.js:2789
function today(){return new Date().toISOString().slice(0,10);}
// app.js:5531
function isoDate(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
```

Two conventions for the same concept, in the same file. Measured at 01:30 local Israel on 2026-07-22 (`2026-07-21T22:30:00Z`):

```
local wall clock: Wed Jul 22 2026 01:30:00 GMT+0300
today()   -> 2026-07-21     ← yesterday
isoDate() -> 2026-07-22     ← correct
```

Every local day between midnight and 03:00 (summer) / 02:00 (winter), `today()` is off by one — precisely the hours an overnight-brisket user is holding the phone. `today()` seeds default dates and drives comparisons at `app.js:3426` (cure-complete gate), `3459`, `3463`, `3481`, `3493`, `3513`, `3519`, `3547`, `3550` (the overdue-⏰ marker), `3555`, `3561`, `3575`, `3584`, `6092` (backup filename), `8243`, `8270`, `8291`, `8715`, `8716`. `isoDate()` writes the serve date at `app.js:5604`. The two are compared against each other through the reminder/plan flow.

**Systemic cause for 3.1 and 3.2 together:** there is no single date type. ISO-date strings are parsed as UTC in one helper and as local in another (`app.js:5548` uses `new Date(base+'T00:00:00')`, i.e. local). **Corrective action:** one `dayKey()` producing the local calendar day and one `parseDay()` consuming it, and forbid bare `new Date('YYYY-MM-DD')` by lint.

---

## 4. i18n — the largest user-facing gap, and W1-A has zero findings here

All numbers below come from a clean Playwright context against the freshly built `dist/index.html`, language set through the real `setLang()` path followed by a real navigation.

### 4.1 HIGH · French / German / Spanish are offered in the picker at 2.1% coverage

`build.py` prints it on every build:

```
[i18n] de: 83/3985 keys vs en (2%)
[i18n] es: 83/3985 keys vs en (2%)
[i18n] fr: 83/3985 keys vs en (2%)
```

and `app.js:6878` derives the picker from *whatever files exist*, with no coverage gate:

```js
const I18N_LANGS = (function(){ const o={he:'עברית'}; try{ Object.keys(I18N_DICTS).forEach(function(k){ o[k]=…; }); }catch(e){} return o; })();
```

Measured — `I18N_LANGS` = `['he','de','en','es','fr']`; dict sizes `{de:83, en:3985, es:83, fr:83}`.

Untranslated Hebrew leaking into the French UI, per screen (leaf text nodes):

| screen | strings | Hebrew | % |
|---|---|---|---|
| `scr-wizard` | 36 | 33 | **92%** |
| `scr-events` | 2 | 2 | **100%** |
| `scr-catalog` | 231 | 130 | **56%** |
| `scr-home` | 51 | 9 | 18% |

…rendered with `document.documentElement.dir === "ltr"`, so the leaked Hebrew is laid out left-to-right. Sample from `scr-wizard` in French mode: `אשף האירוע`, `פרטי האירוע`, `תן שם לאירוע כדי לשמור ולחזור אליו בהמשך.`

**English is clean: 0% Hebrew across all five screens** (`scr-home`, `scr-wizard`, `scr-catalog`, `scr-events`, `scr-projects`). The i18n machinery works. The defect is purely that the picker is gated on file existence rather than coverage. **Corrective action:** one threshold in `app.js:6878` (or a `__meta__.ready` flag emitted by `build.py` when coverage ≥ N%), which also makes the existing build-time coverage print actionable instead of decorative.

### 4.2 HIGH · The alarm banner and the OS notification are Hebrew-only, in every language

This is the most safety-adjacent UI in the app — the thing that tells you the meat is done or the cure stage is over — and it is the one that skipped `L()`. Measured with UI language = `en`:

```json
{ "lang": "en",
  "aria":  "טיימר הסתיים",
  "text":  "⏰ טיימר הסתיים | Brisket rest | 🔕 עצור" }
```

Sources, none of which call `L()` while the surrounding file uses it everywhere:

- `app.js:2409-2411` — `renderAlarm()` heading, `🔕 עצור`, `🔕 עצור הכל`
- `app.js:2408` — `setAttribute('aria-label','טיימר הסתיים')` (so screen readers get Hebrew too)
- `app.js:2398` — default timer name `'טיימר בישול'`
- `app.js:2387` — the service-worker notification title `'⏱ הטיימר הסתיים'` and body fallback `'טיימר בישול'`

**Scale of the pattern.** Static scan of `app.js` for HTML-building lines carrying a Hebrew literal that is *not* an argument to `L(`/`t(`: **367 lines**. Some of those are inside `data-mt` blocks that `hydrateMT()` translates at runtime, so 367 is an upper bound rather than a defect count — but the alarm banner proves the class is live and reaches the user. **Corrective action:** the preventive control is a test, not a sweep — extend the existing `wave5-i18n-coverage.spec.ts` to fail when any rendered leaf node matches `/[֐-׿]/` while `getLang() !== 'he'`. That is the only thing that stops #368.

---

## 5. AI numeric-invariant guard is unit-blind

`app.js:4302-4306`:

```js
function aiSafetyNums(s){
  const re=/(\d+(?:\.\d+)?)\s*(?:°\s*[CF]?|[CF]\b|ppm|%)|\bpH\s*(\d+(?:\.\d+)?)/gi;
  … out.push(n) …
}
```

The unit is inside a **non-capturing** group; only the bare number is extracted. `aiUngroundedSafety()` (`app.js:4308-4312`) then compares the answer's numbers against the grounding's numbers as strings.

**Consequence:** an AI answer reading *"pull the chicken at 74°F"* is checked against grounding containing *"74°C"*, matches, and is classified **grounded** — so the strong `🚫 do not rely on these numbers` escalation at `app.js:4319-4324` does not fire and the user gets only the mild caveat, or nothing. 74 °F is raw poultry. The same blindness applies to any °C/°F, ppm/%, or %/pH confusion.

Secondary weakness in the same function: matching is by *value across the whole context*, so a fabricated `6.25%` passes if `6.25%` appears anywhere in the grounding for an unrelated quantity.

W1-A §5 calls the AI layer "the best-engineered part of the codebase" and I agree about the *transport* (`gemFetch`'s timeout/backoff/fallback design at `app.js:4208-4236` is genuinely good). But the transport is not the safety control — this regex is, and it is the one place where the app's stated contract *"never invents safety numbers"* is actually enforced. **Corrective action:** capture the unit, normalise to a canonical unit, and compare (value, unit) pairs; treat a value match with a unit mismatch as *ungrounded*, not grounded.

---

## 6. `serve.js` — unbounded fork-crash loop, measured

`serve.js:33`: `cluster.on('exit', () => cluster.fork());` — no backoff, no health gate. Each worker reads all of `dist/` into memory at startup (`serve.js:39-46`); if that throws, the worker exits and is immediately replaced by another that throws identically.

Measured — copied `serve.js` into an empty directory (no `dist/`) and ran it for 6 seconds:

```
Error: ENOENT: no such file or directory, scandir '…\forkprobe\dist'
count of repeated errors: 1146
```

**1,146 crash-restarts in 6 s (~191/s)**, saturating cores, with the real cause buried in a scrolling wall of identical stacks. This is exactly what a contributor hits running the Playwright suite before `python build.py`. W1-A says of `serve.js` "no findings warranted there" — I disagree; it is test infrastructure, but a fork bomb that hides its own error message costs debugging time on every fresh clone. **Corrective action:** load `dist/` in the primary *before* forking, exit with a one-line message if it is missing, and cap restarts (e.g. stop after 5 exits in 10 s).

---

## 7. Claims I developed and then DISPROVED — do not re-raise

Recorded because each looked convincing before I tested it.

1. **"`build.py:348` replaces every ASCII space with ` `, corrupting all data."** False. `repr()` of the line shows real U+2028/U+2029 characters; my file-reader rendered them as spaces. The escaping is correct.
2. **"Selecting French does not survive a reload — it silently reverts to Hebrew."** I observed this twice in an interactive browser session and it looked like a real persistence bug. Disproved with an instrumented clean context (`Storage.prototype.setItem` hooked, six set-then-reload cycles over `en/fr/de/es/en/fr`): **all six persisted correctly.** The reverts were an artefact of my own session, not the app. `setLang` (`app.js:6888`) is the only writer of `mk-lang` and it is sound.
3. **"`addDays`/`daysBetween` are broken for negative-UTC-offset timezones."** False. The UTC→local→UTC round-trip cancels whenever the offset is unchanged; only a DST *transition inside the span* breaks it (§3.1), and only in the spring direction.

I also found **no XSS**: the AI answer is escaped (`app.js:4454`), user-entered equipment names are escaped (`app.js:6590`), and there is no `eval`/`new Function` anywhere in `app.js`.

---

## 8. Where I disagree with W1-A

W1-A is a careful report and I confirm its §0 re-checks and its `</script`-escaping observation. My disagreements are about **what is missing and how findings are ranked**, not about its accuracy.

| # | W1-A position | My position |
|---|---|---|
| 1 | §6 lists four worker findings: fail-open on corrupt KV, uncapped codes unmetered, no upstream timeout, health-check leak. | **All four are correct but all four are secondary.** It missed the two that actually break the quota: the `streamGenerateContent` metering bypass (§1.1) and the read-modify-write race on the KV counter (§1.2). W1-A's own framing is that the cap *is* the abuse model — §1.1 defeats it with a one-word URL edit, and needs no corrupted data or admin misconfiguration to reach. |
| 2 | §5: the AI layer is "the best-engineered part of the codebase"; no findings against it. | Agreed for the **transport**. Disagreed for the **safety control**: `aiSafetyNums` (`app.js:4304`) discards units, so a 74 °F/74 °C confusion is classified *grounded* and the strong warning never fires (§5). Praising the layer without auditing the one regex that enforces the trust contract is the gap. |
| 3 | Scope includes `build.py`; the only `build.py` findings are the `</script` gap (explicitly measured at **zero current occurrences**) and the stale offline footer. | The `</script` finding is correct in mechanism but latent. The **live** pipeline defect is that `gen_sources.py:91-98` prints 32 make-calc overrides as "APPLIED" while `build.py:96-103` discards them and writes to a nesting level `app.js` never reads — **18 salt values measurably differ from the researched data** (§2.1). A build that reports success while dropping its payload outranks a hazard with zero current instances. |
| 4 | §4 quotes `build.py:96-102`'s Wave-0 comment as context without testing it. | The comment's stated root cause is **not what the code does** (§2.2): the clobber it describes is impossible at the actual merge destination. It is a CAPA closed against an unverified root cause, with no effectiveness validation — the schema collision (`calc.cure` = type vs. rate) is still live in `sources.py`. |
| 5 | `serve.js`: "no findings warranted there." | Disagree — measured **1,146 crash-restarts in 6 s** with no `dist/` (§6). Path traversal is indeed unreachable, as W1-A says; the fork loop is a different, reproducible failure. |
| 6 | No i18n findings. | The largest user-facing gap in the audit: fr/de/es shipped in the picker at **2.1%** coverage, French wizard **92% Hebrew** under `dir=ltr` (§4.1); and the alarm banner + OS notification are **Hebrew-only in English mode** (§4.2, measured `aria-label="טיימר הסתיים"` with `lang=en`). |
| 7 | No date/time findings. | Two reproduced: `addDays()` loses a day across spring DST, shifting "end of cure — remove and rinse" one day early (§3.1); `today()` (UTC) and `isoDate()` (local) disagree by a day between local midnight and 03:00 (§3.2). |
| 8 | §2 files the 14 captured-but-never-read device properties under **dead code**. | Framing disagreement. These are not dead *code* — the equipment form **asks the user to enter them** and stores the answers. On a 390 px screen with greasy hands, that is wasted user effort in the app's most tedious flow, and it is a UX defect, not housekeeping. Same evidence, higher severity. |
| 9 | §4 rates the `store.set()` return-value gap as one bullet among five fragility items. | Agreed and I confirm the mechanism (`app.js:1433-1435` returns `false`, callers ignore it). No disagreement — recording agreement so it is not mistaken for an omission. |
| 10 | §3 pluralization ("1 אירועים") as the single duplication finding. | Real, and I reproduce the reasoning, but cosmetic relative to §1–§4. I would not spend a slot on it before the quota bypass. |

---

## 9. Ranked findings

| # | Severity | Finding | Evidence |
|---|---|---|---|
| 1 | **Critical** | Token cap bypassed entirely via `:streamGenerateContent` — array/SSE body means `usageMetadata` is never read, `used` never written | `worker/index.js:43, 77-87` |
| 2 | **High** | KV usage counter is a read-modify-write race across a multi-second upstream call; cap is not an upper bound | `worker/index.js:53, 66, 84` |
| 3 | **High** | 18 researched salt overrides printed as "APPLIED", discarded by the builder, and merged to a level the app never reads | `gen_sources.py:59-98`, `build.py:96-103`, `app.js:2019/2027` |
| 4 | **High** | fr/de/es offered in the picker at 2.1% coverage; French wizard 92% Hebrew, events 100%, catalog 56%, under `dir=ltr` | `app.js:6878`; Playwright, clean context |
| 5 | **High** | Alarm banner + OS notification Hebrew-only in every language, incl. `aria-label` | `app.js:2387, 2398, 2408-2411`; measured at `lang=en` |
| 6 | **High** | `addDays()` loses a day across spring DST → cure-end reminder fires one day early | `app.js:2790`, `9281`, `3546`; `TZ=Asia/Jerusalem` run |
| 7 | Med-High | `today()` (UTC) vs `isoDate()` (local) disagree by one day from local midnight to 03:00 | `app.js:2789` vs `5531`; measured |
| 8 | Med-High | AI numeric guard is unit-blind: 74 °F passes as grounded against 74 °C | `app.js:4302-4312` |
| 9 | Medium | No CSP / security headers while the Gemini key sits in `localStorage`; `centralUrl` accepts `http://` unvalidated | `build.py:427-428`, `app.js:5006-5009`, `4533` |
| 10 | Medium | `serve.js` fork-crash loop: 1,146 restarts in 6 s with no `dist/`, real error buried | `serve.js:33, 39-46`; measured |

### Cross-cutting root cause

Findings 1, 3, 5, 6 and 7 are the same nonconformance in five costumes: **a value is computed in one place and consumed in another, and nothing asserts the two agree.** Streaming metering, the sources merge, the i18n `L()` wrapper, and the two date conventions each have a producer and a consumer that were never forced to match. W1-A identified the same shape in `app.js` (its "483 × `typeof …==='function'`" observation) and correctly named it defensive-but-silent. My addition: it is not confined to `app.js` — it spans the Python pipeline and the Worker too, and it is the reason a build can print "APPLIED" for data it drops.

**The single highest-leverage preventive action** is therefore not a set of point fixes but three assertions, one per boundary:
1. `build.py` fails the build if any override `gen_sources.py` reports as APPLIED is absent from the emitted payload.
2. A Playwright assertion that no rendered leaf node contains `/[֐-׿]/` while `getLang() !== 'he'`.
3. The Worker debits a per-code budget **before** forwarding, so metering cannot depend on the shape of a response the caller chose.

Each converts a silent divergence into a loud failure, which is what none of these five defects had.
