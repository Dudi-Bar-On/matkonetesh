# W1-D — Non-functional sweep: i18n/RTL, PWA, performance, accessibility

**Scope:** static analysis of `app.js` (9,564 lines / 882,106 bytes), `app.css` (1,710 lines / 171,796
bytes), `build.py` (430 lines — the single source of truth for the shipped HTML/SW/manifest/headers),
`dist/manifest.webmanifest`, `lang/*.json`, and the built `index.html`/`dist/index.html` (2,701,065
bytes). No browser was driven (that is W1-C's mandate); every claim below is `file:line` or a measured
number from a script run against the actual source.

Standing context this report is judged against: the app is **no longer offline-first** — online + an
AI key is the model, and online matters *more* than offline (2026-07-22 owner decision).

---

## 1. i18n / RTL — verdict: **failing in practice for every non-Hebrew language**

### 1.1 The toast defect is far larger than the known "18"
`docs/analysis/2026-07-22-audit-research-safety.md:149` records "18 toasts still leak Hebrew in English
mode" as a partial-fix regression. I re-measured with the same method the app itself uses — every
`toast(...)` call site with a literal first-argument string, cross-checked against `lang/en.json` —
and found:

- **56** `toast(...)` call sites carry a literal Hebrew string as the message argument.
- **55 of 56 (98%)** have no matching key in `lang/en.json`.
- Only **1** (`'הסינון נוקה'` → `"Filters cleared"`, `app.js:6792`) is translated.

Method (verifiable): `toast(msg, undoFn, actionLabel)` (`app.js:2772-2777`) translates via
`tr(s)=(_d&&_d[s]!=null)?_d[s]:s` — an **exact** dictionary lookup, no fallback, no prefix-stripping.
`lang/en.json` has 309 top-level keys total (including the `__meta__/__units__/__pre__/__html__`
namespaces). A script (`scratch/toast_check.py` in this session) extracted every `toast('…')` literal
and diffed against those keys; full list of the 55 misses is in `scratch/toast_check_out.txt`.
Representative misses: `'הפרויקט נמחק'` (3537), `'המפתח נותק'` (4548), `'מפתח לא תקין'` (5177),
`'הדפדפן לא תומך בהתראות'` (5641), `'כל הנתונים אופסו'` (6735), `'נשמר ל"המתכונים שלי" ✓'` (8595).

**Highest-impact single instance:** the PWA update-delivery toast itself is on the missing list —
`toast('גרסה חדשה זמינה', function(){location.reload();}, 'רענן עכשיו')` at `app.js:9553`. A non-Hebrew
user who gets the "new version available" prompt sees it in Hebrew with a Hebrew "רענן עכשיו" (refresh
now) button — the one notification most likely to be misread or ignored undermines the update-delivery
path PWA judgment below (§2).

Three of the 55 misses are structurally unfixable by adding a dict entry: `toast('❓ '+...)`,
`toast('⚠ '+...)`, `toast('✓ '+...)` (`app.js:5323,6107,6108`) concatenate a variable onto the Hebrew
prefix, so no exact string can ever match a static dictionary key — `tr()` would need the
prefix-then-lookup logic that `tnode()` already has (`app.js:6907-6921`) but `toast()` does not use.

### 1.2 A confirmed hardcoded-Hebrew bug outside toast()
The wizard step counter is set via raw string concatenation with **no** `L()`/`t()` wrapper:
```
app.js:7166  const lbl=$("#cwLbl"); if(lbl) lbl.textContent='שלב '+(visSteps.indexOf(n)+1)+'/'+visSteps.length;
```
This always renders "שלב 1/6" regardless of active language — verified by contrast with the correctly
i18n'd sibling at `app.js:7633` (`cActiveFabT`), which routes every branch through `L()`.

I additionally scanned the 75 unique Hebrew text nodes present in the static HTML shell (built via a
script that pulled tag-enclosed text from `index.html`'s body) against `lang/en.json`; 8 came back
"missing," but 6 of those are false positives that `tnode()`'s prefix-strip fallback
(`app.js:6917`, the `^([^A-Za-z0-9֐-׿]+)(.+)$` regex) resolves correctly (e.g. `"✨ עוד כלי AI"` strips
to `"עוד כלי AI"`, which **is** a key). The genuine remainder is the `cwLbl` bug above and the version
stamp in the footer, which is not meant to translate.

### 1.3 Document-vs-decision conflicts live in the shipped app, not just README
- `build.py:334` — the **footer, rendered on every screen** — reads: *"הנתונים מקומיים, ללא חיבור
  לרשת"* ("Data is local, no network connection"). This string is also duplicated as a translated pair
  in `lang/en.json:261` ("Data is local, no network connection."), so English-mode users get the same
  false claim, not Hebrew leakage — the claim itself is wrong in both languages. This is a **stronger**
  instance of the conflict the roster flagged for README: it is persistent, user-facing chrome, not a
  dev doc.
- `app.js:3929` — the in-app "About/capabilities" screen states: *"📦 עצמאי לחלוטין — HTML יחיד שרץ בכל
  דפדפן — בלי התקנה, בלי חשבון, בלי שרת"* ("Fully independent — a single HTML that runs in any browser
  — no installation, no account, no server"). This directly contradicts both the PWA-installability
  goal (§2) and the online/AI-key architecture (a `worker/` directory holding a Cloudflare Worker
  exists specifically to broker the AI key server-side). Recommend this get flagged alongside the
  README correction — it is the same conflict, told to users inside the product.
- `README.md:3` independently claims "fully local-first (all user data in `localStorage`)" — a third,
  softer instance of the same conflict, worth fixing together with the other two.

### 1.4 fr/de/es: not localized beyond navigation chrome
Running `python build.py` prints the coverage the build itself computes:
```
[i18n] de: 83/3985 keys vs en (2%)
[i18n] es: 83/3985 keys vs en (2%)
[i18n] fr: 83/3985 keys vs en (2%)
```
`lang/fr.json` (read in full) confirms: 83 real keys, covering only bottom-nav labels, greetings,
home-screen category chips, and ~10 menu items (`lang/fr.json:24-102`). There is **no** `de.data.json`
/ `es.data.json` / `fr.data.json` — only `lang/en.data.json` (630,278 bytes) exists, so even a
hypothetically 100%-covered fr/de/es chrome dictionary would still leave all 279 catalog item
descriptions untranslated for those three languages (they rely entirely on the numeric-guarded MT
layer, `mtTranslate`/`hydrateMT`, at request time — a separate mechanism this report did not audit for
availability/cost).

Degradation is not uniform: `L(he, en)` (`app.js:6896-6902`) falls back to the inline **English**
argument for fr/de/es when the 83-key dict misses — most `L()` call sites do supply an English
argument, so recipe-generation prose degrades to English, not Hebrew, for those three languages. But
`toast()` and dict-only `t()`/`tnode()` strings have no such fallback and show **Hebrew**, not English,
to fr/de/es users — i.e., the §1.1 toast defect is *worse*, not equal, for fr/de/es than for en.

### 1.5 RTL / bidi: mixed picture, evidence of both awareness and inconsistency
The occupancy-diagram code (`app.js:610-674`, the recently-shipped `occ2` module referenced in the
git log) explicitly isolates number+unit runs in `dir="ltr"` spans and documents *why*:
```
app.js:5979-5980  // L13: do NOT wrap this in dir="ltr" — it mixes Hebrew words with numbers, and forcing LTR reorders
                   // the segments ("מוכן שע׳ 45 דק׳ 12"). Left in the document's own direction it reads correctly.
```
This shows the team has already hit and fixed this exact bug class in `occ2` (7 total `dir="ltr"` uses
in `app.js`, all in this cluster: lines 544, 567, 569, 631, 652, 668 plus the L13 comment site). But the
mitigation was applied locally, not systematically: older number-in-Hebrew-sentence strings elsewhere
(e.g. `'עד ~68-71° פנים'`, `app.js:2888`; `'עד ~74-82° פנים'`, `app.js:2894`) carry no isolation and were
not re-examined under this pattern. I cannot confirm these mis-render without a browser (W1-C's
mandate) — flagging as **needs visual verification**, not a confirmed defect, per the evidence rule.

---

## 2. PWA — verdict: **update-delivery mechanism is sound; installability is present but passive; docs contradict the shipped model**

### 2.1 Update delivery — the part this task re-scoped to matter most — is well-built
`app.js:9544-9564`:
- Registers `sw.js` only over HTTPS (`location.protocol==='https:'`, line 9546) — correct, no crash on
  the local dev server.
- `reg.update()` fires on load **and** on every `visibilitychange` to `visible` (lines 9559-9561), with
  an explicit comment explaining why: *"An installed PWA that is resumed... may never issue a
  navigation, so without this a shipped version can sit undelivered indefinitely — v255 reached the
  server but not the device."* — this is a real, previously-diagnosed failure mode, now mitigated.
  This is exactly what the task asked to judge, and it is implemented correctly.
- `updatefound`/`statechange` shows a toast prompting reload, but **deliberately skips** interrupting a
  live cook (`app.js:9552`) — correct product judgment, with a caveat: the toast itself is one of the
  §1.1 untranslated strings, weakening the mechanism for non-Hebrew users.
- The generated `sw.js` (`build.py:404-423`) uses `self.skipWaiting()` + `clients.claim()` and a cache
  name keyed to an md5 hash of the built HTML (`build.py:403`), so **every build invalidates the old
  cache automatically** on `activate` — no manual version bump to forget.
- `dist/_headers` (`build.py:427-428`) sets `Cache-Control: no-cache` on `index.html`,
  `manifest.webmanifest`, and `sw.js` — the browser always revalidates these, so the update check itself
  isn't served stale from an intermediate cache; icons get `max-age=31536000, immutable`, correctly.

### 2.2 Installability is present but nothing invites it
`grep` for `beforeinstallprompt`, `deferredPrompt`, `appinstalled` across `app.js` and `index.html`
returns **zero matches**. There is no custom install button/banner anywhere in the app; installability
depends entirely on the browser's native affordance (Chrome's address-bar icon / Android's mini
infobar). The manifest satisfies baseline installability criteria (`dist/manifest.webmanifest`: `name`,
`short_name`, `start_url`, `scope`, `display:"standalone"`, icons at 192/512 with one `maskable`
variant) — so installs are **not blocked**, just never actively solicited.

### 2.3 Confirmed-missing manifest fields
`dist/manifest.webmanifest` (read in full, 33 lines) has no `shortcuts` and no `screenshots` key —
matches the task's "known missing" framing. Absence of `screenshots` means Chrome's richer desktop
install dialog is unavailable; absence of `shortcuts` means no long-press home-screen jump list (e.g.
straight to "Active cook" or "New event"). Neither blocks installation.

### 2.4 iOS coverage present
`build.py:139-142` emits `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
`apple-mobile-web-app-title`, and `apple-touch-icon` — the standard Safari A2HS meta set is in place
(Safari does not support `beforeinstallprompt` regardless, per platform limitation, so §2.2 is moot on
iOS).

### 2.5 See §1.3 for the "no installation, no server" in-app copy that contradicts this section's
premise directly.

---

## 3. Performance — verdict: **large but not naively so; one real, evidenced runtime cost during active cooks**

### 3.1 Payload composition (measured)
- Shipped `dist/index.html`: **2,701,065 bytes** (2.6 MB).
- `app.js` source, embedded raw (no minification step anywhere in `build.py` — confirmed by full read
  of the file: it string-replaces `__JS__`/`__CSS__` verbatim, no terser/uglify/csso call exists):
  **882,106 bytes**, comments and all.
- `app.css`, embedded raw, same no-minification finding: **171,796 bytes**.
- Recipe data (`cuts`/`specials`/`glossary`/`builds`/`makes`, excluding seasonings/houseRub): **≈236,537
  bytes** of JSON, wrapped in `JSON.parse('…')` rather than a JS object literal — `build.py:344-348`
  documents this as a deliberate perf choice ("a JSON string parses ~1.5-2x faster... on the main
  thread"), i.e. already optimized, not naive.
- `lang/en.data.json` (bulk English item-description prose, merged into `I18N_DICTS.en` at build time):
  **630,278 bytes** — the single largest named contributor to the payload after `app.js` itself.
- No lazy-loading/code-splitting anywhere: the entire JS, CSS, and data payload parses and evaluates on
  first load regardless of which of the app's 5 screens (home/wizard/catalog/events/projects — all
  present in the DOM simultaneously per `build.py`'s `<div class="screen">` markup, toggled by a `.on`
  class, not lazily inserted) the user lands on.

### 3.2 Render-blocking web font request
`build.py:144-146` emits `<link rel="preconnect">` for `fonts.googleapis.com`/`fonts.gstatic.com`
(mitigates DNS/TLS setup cost) followed by a synchronous `<link rel="stylesheet" href="https://fonts.
googleapis.com/css2?family=...&display=swap">`. This is a render-blocking cross-origin request in
`<head>` — on the "phone by a fire," likely tethered or weak-signal connection this task's brief names,
it adds at least one extra round trip before first paint. Partially mitigated: `display=swap` is set,
so it degrades to FOUT (flash of unstyled text) rather than blocking text rendering indefinitely (FOIT).

### 3.3 Positive finding: search is already debounced
`app.js:1450-1451,2781`: `$("#q").addEventListener("input",debounce(()=>catView(),120))`, with an
explicit comment — *"perf #4: debounce the search input so a keystroke doesn't rebuild ~279 cards
synchronously each time"* — confirming the team already identified and fixed the obvious
naive-re-render-per-keystroke risk for the 279-item catalog grid (`$("#grid").innerHTML=cuts.map(...)`,
`app.js:1656`, and the 2 sibling grids at lines 1664/1674).

### 3.4 Real, evidenced cost: a global full-body text-node walk fires every ~250-300ms during any active timer in non-Hebrew mode
Two mechanisms compound:
1. `app.js:9540` — a `MutationObserver` on `document.body` with `{childList:true, subtree:true}`,
   active whenever `getLang()!=='he'`, debounced 50ms, that on every fire re-runs **`applyI18n()`,
   `tnode()`, and `hydrateMT()` over the entire `document.body`** — not just the mutated subtree.
   `tnode()` (`app.js:6907-6921`) walks **every text node in the document** via
   `document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)`, plus a
   `document.querySelectorAll('[placeholder],[aria-label],[title]')` scan of the whole document, on
   every invocation.
2. `app.js:2338`: `wireTimer`'s `run()` sets `iv=setInterval(tick,250)`; `tick()`
   (`app.js:2334-2337`) does `tt.textContent=fmt(left)` every 250ms while a timer is running. Per the
   DOM spec, a `textContent` assignment replaces the element's child Text node(s) even when unchanged in
   value — this **is** a `childList` mutation, so it fires the observer above.

Net effect: for the duration of any running cook timer (these run for minutes to hours — the app's core
use case), in any non-Hebrew UI language, the app performs a full document-wide text-node tree walk plus
a full attribute-selector query roughly 4 times per second, indefinitely, regardless of which screen is
visible or how large the DOM has grown (e.g. after the 279-card catalog grid has been rendered once,
those hidden-but-present nodes are walked too). This is unverified for *visible* jank (no profiler run —
out of scope here) but is a real, cite-able CPU/battery cost on exactly the "mid-range Android by a
fire, timer running for hours" scenario this task calls out, and it is Hebrew-mode-exempt only because
`getLang()==='he'` short-circuits the observer's callback (`app.js:9540`) — so Hebrew users, the
majority, do not pay this cost; English/fr/de/es users do, on every cook.

---

## 4. Accessibility — verdict: **foundations are deliberately good (documented contrast fixes, global focus-visible, toast aria-live); custom widgets and touch targets lag**

### 4.1 Positive: contrast was audited and fixed once already, in-line evidence
`app.css:9-12` (root theme tokens):
```css
--ash:#6e5340;    /* warm secondary text — AA 6.6:1 on bg */
--bone:#5a3a28;   /* primary ink text */
--smoke:#7a5f4c;  /* muted text — AA 5.5:1 on bg (was #b09480, failed AA at 2.65:1) */
```
The comment on `--smoke` records an actual before/after contrast-ratio fix (2.65:1 → 5.5:1), i.e. this
isn't a claim, it's evidence the team already ran and passed a contrast check on the default (cream)
theme's core text tokens. I did not re-derive contrast ratios for the other three themes (charcoal,
walnut, slate) — no equivalent inline documentation exists for them, so their AA status is unverified,
not failing.

### 4.2 Positive: universal focus-visible and toast live-region
- `app.css:825`: `:focus-visible{outline:2px solid var(--ember)!important;outline-offset:2px}` — a
  single global rule with `!important`, so no per-component focus style can accidentally suppress it.
  Component-specific `:focus`/`:focus-visible` rules exist on top of this (e.g. `.cwseg:focus-visible`,
  `.lang-flag:focus-visible`, `.skip-link:focus` — `app.css:181,966,981`).
- A skip-link to `#mainContent` exists (`build.py:150`, `.skip-link:focus{top:0;...}` at `app.css:966`).
- `toast()` sets `role="status"` and `aria-live="polite"` on creation (`app.js:2774`) — correct pattern,
  independent of the translation defect in §1.1.

### 4.3 Gap: custom visualization widgets have no ARIA semantics or live-region wiring
The occupancy-diagram module (`_occGrillBody`, `_occVesselBody`, `_occBayHtml`, `_occFitHtml` —
`app.js:610-674`, ~31 lines matching `occ2`) and the cook-timeline stage rendering
(`app.js:5992` area, `tl-stage`/`tl-early` classes) contain **zero** `aria-`/`role` attributes — verified
by grep returning no matches for either. The fit-status line (`_occFitHtml`, `app.js:655-674`) is the
single most decision-critical output of the whole occupancy feature (does this batch physically fit the
smoker/sous-vide bath) and changes dynamically as the user edits selections in the wizard, but it is
plain visible text with no `aria-live` wrapper anywhere in its render chain
(`app.js:533` mounts it via a plain `<div>`), so a screen-reader user is not notified when the verdict
flips from "fits" to "over capacity" — they would have to re-navigate to the element to discover it.

### 4.4 Touch target: one concrete measurement below the "greasy hands" comfort target
`app.css:54`: `.capp-ico{width:40px;height:40px;...}` — the header icon buttons (language pill, "more"
menu, back/exit buttons reuse similar classes) are 40×40 CSS px. This clears WCAG 2.2's AA minimum
(2.5.8, 24×24px) but falls short of the 44×44px comfort target (WCAG 2.5.5 AAA / iOS HIG / Material
Design), which matters more than the AA minimum given this task's explicit "used with greasy hands"
framing. I did not compute exact rendered sizes for `.cnav` bottom-nav buttons or `.chip` filter pills
(both size via padding + font content rather than a fixed box, so an accurate number needs a rendered
DOM, i.e. W1-C) — flagging `.capp-ico` only, per the evidence rule.

### 4.5 Minor: user-uploaded content images marked purely decorative
`app.js:3631`: `<img src="${e.photo}" alt="">` — a user's own project/pantry photo (meaningful content
they chose to attach) is given an empty `alt`, hiding it entirely from screen readers. A second instance
(`app.js:9322`, a just-selected-file preview thumbnail) is more defensible as decorative. No `<img>` tag
in the codebase carries non-empty `alt` text (0 of 2 real content images).

### 4.6 Positive: language switch updates document semantics correctly
`applyLang()` (`app.js:6935-6945`) sets `document.documentElement.lang` and `.dir` on every language
change, and toggles a `lang-en` class — the base requirement for screen readers to select the correct
pronunciation/voice per language is met.

### 4.7 Positive: viewport does not block zoom
`index.html:5` / `build.py:133`: `<meta name="viewport" content="width=device-width, initial-scale=1">`
— no `user-scalable=no` or `maximum-scale` restriction, so pinch-zoom remains available (a common,
easy-to-miss WCAG 1.4.4 violation that this app does not have).

---

## Summary for the synthesis pass

| Property | Verdict | Headline evidence |
|---|---|---|
| i18n/RTL | **Failing for non-Hebrew users at scale** | 55/56 toast strings untranslated (not 18); the update-available toast is one of them; fr/de/es at 83/3985 keys with no data-prose layer at all; a confirmed hardcoded-Hebrew wizard label (`app.js:7166`) |
| PWA | **Update delivery: sound. Install: passive. Docs: contradictory.** | `reg.update()` on load+visibilitychange with a documented prior failure mode fixed; content-hashed SW cache auto-invalidates; zero install-prompt handling anywhere; in-app "no installation, no server" copy (`app.js:3929`) and footer "no network connection" copy (`build.py:334`, also shipped in English) both contradict the online/AI-key model |
| Performance | **2.6 MB, unminified, mostly deliberate; one real runtime cost** | No minification pass exists in `build.py`; render-blocking Google Fonts CSS request; search already debounced (positive); full-body TreeWalker + attribute scan fires ~4×/sec during any active cook timer in non-Hebrew mode (`app.js:9540` + `app.js:2338`) |
| Accessibility | **Good foundations, weak on custom widgets** | Documented contrast fix history, global `:focus-visible`, toast `aria-live` (all positive); occupancy-diagram and timeline widgets have zero ARIA; `.capp-ico` measured at 40×40px vs the 44px comfort target; user photos shipped with `alt=""` |

**Count of untranslated user-facing strings found: 55** confirmed missing `toast()` messages (of 56
checked) + **1** confirmed hardcoded-Hebrew dynamic label (`cwLbl`, `app.js:7166`) = **56** distinct,
evidenced instances. This supersedes the previously-recorded count of 18.

### 10 highest-impact findings
1. 55/56 (98%) of `toast()` notifications have no English translation — far beyond the recorded "18."
2. The PWA "new version available" update toast (`app.js:9553`) is itself untranslated — weakens the
   one delivery mechanism this task asked to be judged on, for every non-Hebrew user.
3. In-app About copy claims "no installation... no server" (`app.js:3929`), contradicting both PWA
   installability and the online/AI-key architecture — a stronger instance of the doc-vs-decision
   conflict than the README line.
4. The "no network connection" claim is in the live footer on every screen (`build.py:334`), shipped in
   **both** Hebrew and English (`lang/en.json:261`) — not just a stale README.
5. `reg.update()` on load + `visibilitychange`, with content-hashed SW cache names that auto-invalidate
   every build, is correctly implemented and specifically fixes a previously-diagnosed real failure
   ("v255 reached the server but not the device," per the code's own comment).
6. No `beforeinstallprompt`/install-CTA exists anywhere — installs depend entirely on the browser's
   native affordance.
7. fr/de/es cover only 83 keys (2%) of chrome strings and have **no** item-description translation
   layer at all (`en.data.json` has no de/es/fr counterpart) — and inherit the full toast-Hebrew-leak
   defect with no English fallback (unlike `L()`-based content, which does fall back to English).
8. A full-document `TreeWalker` text-node scan plus a full attribute-selector query fire roughly 4×/sec
   for the entire duration of any running cook timer, whenever the UI language isn't Hebrew
   (`app.js:9540` MutationObserver + `app.js:2338` 250ms timer tick) — a real, uncapped-duration CPU
   cost in the app's core use case.
9. No minification step exists in `build.py` for the 882KB `app.js` or 172KB `app.css` embedded raw
   into the shipped 2.6MB HTML.
10. Occupancy-diagram and cook-timeline widgets — the custom visualizations this task named
    specifically — carry zero ARIA roles/live-regions; the capacity fit-verdict (fits / tight / over)
    changes dynamically with no screen-reader notification path.

**Not claimed (dropped per the evidence rule):** any specific visual bidi-scrambling instance (needs a
rendered browser — W1-C's mandate), exact rendered touch-target sizes for `.cnav`/`.chip` (padding+font
based, not a fixed box), contrast ratios for the charcoal/walnut/slate themes (no inline documentation
exists to verify against, unlike the cream theme), and any Lighthouse/DevTools-measured performance
number (no browser was driven in this pass).
