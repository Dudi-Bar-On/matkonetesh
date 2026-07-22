# VERIFY — W1-D Non-functional (i18n/RTL, PWA, performance, accessibility)

**Role:** adversarial verifier. Every substantive finding in `W1-D-nonfunctional.md` was attacked, not
accepted. Each verdict below carries independent evidence I produced myself.

**Headline:** the report's #1 and #2 findings are **REFUTED** — they are a verbatim repeat of recorded
false alarm #3 ("55/56 toasts untranslated"), reached the same way: by diffing against `lang/en.json`
alone while the runtime dictionary is `en.json` **merged with** `en.data.json` at build time. A real but
far smaller defect (2 strings, not 55) was found in its place. The PWA, performance and accessibility
sections hold up almost entirely.

**Tally: 22 CONFIRMED · 4 REFUTED · 1 UNVERIFIABLE.** One new defect found that the report missed.

---

## Verification method (why one artifact is not verification)

`build.py:352-366` builds the shipped dictionary from **two** files per language:

```python
353  _i18n = {}
354  _i18n_data = {}   # <code>.data.json = bulk prose (item descriptions) merged into <code>
357      if _bn.endswith(".data.json"):
358          _i18n_data.setdefault(_bn[:-len(".data.json")], []).append(_lf); continue
362  for _code, _dfs in _i18n_data.items():
363      if _code in _i18n:
366              _i18n[_code].update(json.load(_f))
377  I18N_DICTS_JSON = json.dumps(_i18n, ensure_ascii=False)
```

Runtime path, traced end to end:
`toast(msg)` (`app.js:2772-2777`) → `getDict()` (`app.js:6889`) → `I18N_DICTS[lang]` (`app.js:6877`)
← `__I18N_DICTS__`, substituted by `build.py:378` with the **merged** dict.

`lang/en.json` = 309 keys. `lang/en.data.json` = 3,677 keys. The merged runtime dict is what `tr()`
sees. Checking `en.json` alone is guaranteed to produce false negatives — which is exactly what happened.

---

## 1. i18n / RTL

### ❌ REFUTED — §1.1 / finding #1: "55 of 56 toast strings (98%) have no English translation"

I re-extracted every `toast(` call site from `app.js` and diffed against the **merged** dict:

```
total toast( call sites:                              85
  first arg = Hebrew string literal:                  53
  first arg = expression / L() / interpolation:       29
  of the Hebrew literals, MISSING from merged dict:    0
covered by en.json alone: 1  |  covered by en.data.json: 53
```

**0 of 53 are missing.** Every single "representative miss" the report named resolves in the merged dict:

| Report's claimed miss | Line | Actual shipped English |
|---|---|---|
| `'הפרויקט נמחק'` | 3537 | `Project deleted` |
| `'המפתח נותק'` | 4548 | `The key was disconnected` |
| `'מפתח לא תקין'` | 5177 | `Invalid key` |
| `'הדפדפן לא תומך בהתראות'` | 5641 | `This browser doesn't support notifications` |
| `'כל הנתונים אופסו'` | 6735 | `All data reset` |
| `'נשמר ל"המתכונים שלי" ✓'` | 8595 | `Saved to "My recipes" ✓` |

Confirmed against the **shipped artifact**, not just the source dicts — `grep` of the built
`index.html` (2,701,065 bytes) finds `A new version is available`, `Project deleted`, `Invalid key`,
`Filters cleared`, `All data reset` all present.

The report's own count is also internally unreliable: it claims 56 Hebrew-literal sites; the actual
number is 53.

### ❌ REFUTED (as stated) — §1.1 / finding #2: "the PWA update toast is untranslated"

`toast('גרסה חדשה זמינה', …, 'רענן עכשיו')` (`app.js:9553`). The **message** is translated:
`'גרסה חדשה זמינה'` → `"A new version is available"`, and that English string is present in the shipped
`index.html`. The claim that a non-Hebrew user sees the message in Hebrew is false.

### ✅ NEW DEFECT (found while refuting #2) — toast *action-button* labels do leak Hebrew

The report checked only the message argument, so it missed the real bug. Two strings are genuinely
absent from the merged dict:

- `'רענן עכשיו'` ("Refresh now") — the update toast's button, `app.js:9553`. `Refresh now` does **not**
  appear anywhere in the shipped `index.html`.
- `'בטל'` ("Undo") — the **default** action label for every undo-style toast:
  `app.js:2776  …+(undoFn?`<button data-undo>${tr(actionLabel||'בטל')}</button>`:'')`

Neither is rescued by another mechanism: `tnode()`'s prefix-strip fallback
(`app.js:6917`, `/^([^A-Za-z0-9֐-׿]+)(.+)$/`) requires a **non-Hebrew** leading character, and both
strings begin with a Hebrew letter, so the regex cannot match. The only near-hit in the dict is
`'בטל טיוטה' → 'Discard draft'`, a different key.

**Scope: 2 strings, not 55.** Real, worth fixing, an order of magnitude smaller than reported.

### ❌ REFUTED — §1.1: "three toasts are structurally unfixable by adding a dict entry"

Cited as `app.js:5323, 6107, 6108`. Reading them:

```
6107  if(fail>0) toast('⚠ '+L('שוחזרו','Restored')+' '+ok+' '+L('מתוך','of')+' '+keys.length+…
6108  else toast('✓ '+L('הנתונים שוחזרו','Data restored')+' ('+ok+' '+L('פריטים','items')+')');
```

6107 and 6108 route every Hebrew segment through `L(he, en)`, which for `lang==='en'` returns the inline
English argument outright (`app.js:6896-6902`: `if(l==='en') return en!=null?en:he;`). They are **fully
translated**; only the language-neutral `⚠`/`✓` emoji prefix is literal. `app.js:5323` is
`toast('❓ '+alts[0])` where `alts[0]` is the user's own speech-recognition input — not a translation
defect at all. None of the three is a defect.

### ✅ CONFIRMED — §1.2: hardcoded Hebrew wizard step counter

```
app.js:7166  const lbl=$("#cwLbl"); if(lbl) lbl.textContent='שלב '+(visSteps.indexOf(n)+1)+'/'+visSteps.length;
```
Verified verbatim. Also verified it cannot be rescued at runtime: `"שלב 1/6"` is not a dict key (no
`שלב `-prefixed key exists except an unrelated sentence), and `tnode()`'s prefix regex requires a
non-Hebrew leading char. Renders Hebrew in every language. Real.

### ✅ CONFIRMED — §1.3: the "no network connection" claim ships in both languages

`build.py:334` footer contains `הנתונים מקומיים, ללא חיבור לרשת`. The full footer sentence **is** a
dict key — `lang/en.json:261` maps it to *"Matkonet · Fire Guide — built from Dudi's tables. **Data is
local, no network connection.** Checklist marks are saved in the browser."* Both language paths assert
it. Confirmed exactly as described.

### ✅ CONFIRMED — §1.3: in-app "no installation, no account, no server" copy

`app.js:3929`: `${feat('📦','עצמאי לחלוטין','HTML יחיד שרץ בכל דפדפן — בלי התקנה, בלי חשבון, בלי שרת.')}`
Verified. `worker/` exists (`index.js`, `wrangler.toml`, `package.json`), so the "no server" claim does
contradict the shipped architecture. `README.md:3` likewise reads "fully local-first (all user data in
`localStorage`)". All three instances confirmed.

### ✅ CONFIRMED — §1.4: fr/de/es coverage, and the toast leak *is* real for them

Reproduced the build's own output exactly:
```
[i18n] de: 83/3985 keys vs en (2%)
[i18n] es: 83/3985 keys vs en (2%)
[i18n] fr: 83/3985 keys vs en (2%)
```
`lang/` contains only `en.data.json` — no `fr/de/es.data.json`. Confirmed.

Critically, the report's §1.4 sub-claim survives even though §1.1 does not — and it is the *actual*
toast finding:
```
Hebrew-literal toast messages: 53
  covered by en (merged): 53
  covered by fr (83 keys): 0
  covered by de (83 keys): 0
  covered by es (83 keys): 0
```
**All 53 toasts leak Hebrew for fr/de/es** (exact lookup against an 83-key dict, no English fallback in
`tr()`), while English is fully covered. The report reached a partly-right conclusion for the wrong
reason, and mis-assigned the defect to English.

### ✅ CONFIRMED (as hedged) — §1.5: RTL isolation applied locally, not systematically

7 `dir="ltr"` occurrences in `app.js`: lines 544, 567, 569, 631, 652, 668 plus the comment at 5979.
The L13 comment is verbatim as quoted (`app.js:5979-5980`). `app.js:2888` / `2894` do carry
`'עד ~68-71° פנים'` / `'עד ~74-82° פנים'` with no isolation. The report correctly declines to call these
defects without a browser — that hedge is appropriate and I echo it.

---

## 2. PWA — all four sub-findings CONFIRMED

- ✅ **§2.1 update delivery.** `app.js:9546` HTTPS-only guard; `reg.update()` on load **and** on
  `visibilitychange`→visible (`app.js:9559-9561`) with the "v255 reached the server but not the device"
  comment verbatim; live-cook interruption skip at `app.js:9552`. `build.py:403` derives the cache name
  from `md5(html)[:8]`; the generated SW uses `self.skipWaiting()` + `self.clients.claim()` and deletes
  every non-current cache on `activate` (`build.py:404-423`). `build.py:427-428` writes `no-cache` for
  `index.html`/`manifest.webmanifest`/`sw.js` and `max-age=31536000, immutable` for `*.png`. Sound.
- ✅ **§2.2 installability is passive.** `grep -c "beforeinstallprompt\|deferredPrompt\|appinstalled"`
  returns **0** in `app.js`, `index.html`, and `build.py`.
- ✅ **§2.3 manifest gaps.** Read `dist/manifest.webmanifest` in full: has `name`, `short_name`,
  `start_url`, `scope`, `display:"standalone"`, 192/512 icons + one `maskable`. **No** `shortcuts`,
  **no** `screenshots`. Installability is not blocked.
- ✅ **§2.4 iOS meta.** `build.py:139-142` emits all four Safari A2HS tags. Verified.

---

## 3. Performance — all CONFIRMED

- ✅ **§3.1 payload.** `index.html` = 2,701,065 bytes (and the build is deterministic — rebuilding
  reproduced the identical byte count). `app.js` = 882,106 B, `app.css` = 171,796 B,
  `lang/en.data.json` = 630,278 B, all confirmed by `ls`. **No minifier exists**: `grep -in
  "terser\|uglify\|minif\|csso\|esbuild" build.py` returns zero matches.
- ✅ **§3.2 render-blocking font.** `build.py:144-146`: two `preconnect` hints followed by a synchronous
  cross-origin `<link rel="stylesheet">` to `fonts.googleapis.com` in `<head>`, with `&display=swap`.
  Exactly as described, including the FOUT-not-FOIT mitigation.
- ✅ **§3.3 search debounced.** `app.js:2781`:
  `$("#q").addEventListener("input",debounce(()=>catView(),120));` Confirmed positive finding.
- ✅ **§3.4 full-body walk during active timers.** Both halves verified.
  `app.js:9540` is a `MutationObserver` on `document.body` with `{childList:true, subtree:true}` that
  returns early when `getLang()==='he'` and otherwise re-runs `applyI18n` + `tnode` + `hydrateMT` over
  the whole body on a 50 ms trailing debounce. `tnode()` (`app.js:6907-6921`) does walk every text node
  via `createTreeWalker(r, NodeFilter.SHOW_TEXT)` **plus** a full
  `querySelectorAll('[placeholder],[aria-label],[title]')`. `app.js:2338` confirms
  `iv=setInterval(tick,250)` and `tick()` ends with `tt.textContent=fmt(left)`.
  The mechanism claim is sound: per the DOM "string replace all" algorithm a `textContent` assignment
  replaces the child Text node even when the value is unchanged, so it is a `childList` mutation; at a
  250 ms tick against a 50 ms debounce the callback does fire between ticks (~4×/s). The report is
  appropriately explicit that *visible jank* was not measured.

---

## 4. Accessibility — 6 CONFIRMED, 1 UNVERIFIABLE

- ✅ **§4.1 contrast tokens.** `app.css:9-12` verbatim, including
  `--smoke:#7a5f4c; /* muted text — AA 5.5:1 on bg (was #b09480, failed AA at 2.65:1) */`.
- ⚠️ **UNVERIFIABLE — charcoal/walnut/slate theme contrast.** The report explicitly declines to claim
  these, which is correct; I likewise cannot settle them from the repo without computing ratios against
  rendered theme backgrounds. Correctly listed under "Not claimed".
- ✅ **§4.2 focus-visible + skip link + toast live region.** `app.css:825`
  `:focus-visible{outline:2px solid var(--ember)!important;outline-offset:2px}`; skip-link markup at
  `build.py:150` with `app.css:966`; `app.js:2774` sets `role="status"` and `aria-live="polite"`.
- ✅ **§4.3 zero ARIA on the occupancy widgets.** `sed -n '610,674p' app.js | grep -c "aria-\|role="`
  returns **0**. `_occFitHtml` is at `app.js:655`, mounted at `app.js:533` inside a plain
  `<div class="occ2-dev">` with no live region. Only 4 `aria-live` occurrences exist in all of `app.js`,
  none in this chain.
- ✅ **§4.4 touch target.** `app.css:54`: `.capp-ico{width:40px;height:40px;…}`. The standards framing is
  also correct — WCAG 2.2 **2.5.8** Target Size (Minimum) is 24×24 CSS px at AA, **2.5.5** Target Size
  (Enhanced) is 44×44 at AAA. 40px clears AA, misses the 44px comfort target. The refusal to guess
  `.cnav`/`.chip` sizes is correct.
- ✅ **§4.5 content images with empty alt.** Only 3 `<img` occurrences in `app.js`; the 2 real ones are
  `app.js:3631` `<img src="${e.photo}" alt="">` and the `${dataUrl}` preview, both `alt=""`. Zero
  non-empty `alt` in the codebase. `build.py` contains no `<img>` at all.
- ✅ **§4.6 applyLang sets lang/dir.** `app.js:6935-6936` sets `el.lang`, `el.dir`, and toggles
  `lang-en`. Verified.
- ✅ **§4.7 zoom not blocked.** `build.py:133`:
  `<meta name="viewport" content="width=device-width, initial-scale=1">` — no `user-scalable=no`, no
  `maximum-scale`.

---

## Corrected scoreboard

| Report's claim | Verdict |
|---|---|
| 55/56 toasts untranslated (#1) | **REFUTED** — 53 sites, **0** missing from the merged runtime dict |
| PWA update toast untranslated (#2) | **REFUTED** for the message; the **button label** is untranslated |
| 3 toasts "structurally unfixable" | **REFUTED** — 2 use `L()` and ship English; 1 interpolates user speech |
| "56 distinct evidenced instances, supersedes 18" | **REFUTED** — actual English-mode count is **3** (`רענן עכשיו`, `בטל`, `cwLbl`) |
| Hardcoded `cwLbl` step counter (§1.2) | **CONFIRMED** |
| Footer + About + README contradictions (§1.3) | **CONFIRMED** (all three) |
| fr/de/es at 83/3985, no data layer (§1.4) | **CONFIRMED** — and **53/53 toasts do leak Hebrew for fr/de/es** |
| RTL isolation local not systematic (§1.5) | **CONFIRMED**, correctly hedged |
| All of §2 (PWA), §3 (performance) | **CONFIRMED** |
| §4 accessibility, 6 findings | **CONFIRMED**; theme contrast **UNVERIFIABLE**, correctly not claimed |

**Corrected count of untranslated user-facing strings in English mode: 3**, not 56 —
`'רענן עכשיו'` (`app.js:9553`), the default `'בטל'` (`app.js:2776`), and the `cwLbl` step counter
(`app.js:7166`). For fr/de/es the picture is genuinely bad and the report under-sold it in §1.1 while
over-selling it for English: **all 53 toast messages leak Hebrew** there.

**Process note.** This is the third recurrence of the same error mode: a claim about strings settled by
reading one dictionary file instead of tracing the runtime lookup. The merge at `build.py:362-366` has
now caught out two agents and one controller. Any future string-coverage claim must be diffed against
`en.json ∪ en.data.json`, and ideally confirmed by grepping the built `index.html`.

**Repo integrity:** no source file was modified. `python build.py` was run to reproduce the i18n
coverage numbers; it regenerated the gitignored `index.html`/`dist/` byte-identically (2,701,065 bytes,
unchanged). `git status` shows **no** modified tracked files.
