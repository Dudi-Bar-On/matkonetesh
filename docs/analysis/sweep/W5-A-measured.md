# W5-A — Measured non-functional pass (live production, v258)

**Target:** `https://matkonetesh.pages.dev/` (footer stamp reads `מהדורה 258 · 22.7.26` — confirmed v258 in
the DOM, not assumed).
**Tool:** chrome-devtools MCP → Lighthouse 13.4.0 (axe-core 4.12.0), DevTools performance traces,
runtime DOM measurement. Host benchmarkIndex 4408.
**Date of measurement:** 2026-07-22.
**Method:** every number below came out of a browser. Where a number could not be obtained from a
rendered page it is labelled as such and the source is named. No source file was modified.

---

## 0. What Lighthouse can and cannot score here (measured, not assumed)

`report.json → categories` for both runs contains exactly:
`accessibility, best-practices, seo, agentic-browsing`.

There is **no `performance` category and no `pwa` category** in Lighthouse 13.4.0 as exposed by this
MCP tool. The tool's own description states `lighthouse_audit` "excludes performance. For performance
audits, run performance_start_trace". So:

- Performance and PWA **scores** are not obtainable. Core Web Vitals are, and are in §2.
- Any future report quoting a "Lighthouse performance score" or a "Lighthouse PWA score" for this app
  is quoting something this toolchain does not emit.

---

## 1. Lighthouse scores

`configSettings` for the mobile run (the throttled one):
`formFactor: mobile`, `throttlingMethod: simulate`, `rttMs: 150`, `throughputKbps: 1638.4`,
`cpuSlowdownMultiplier: 4`.

| Category | Desktop (unthrottled) | Mobile (4× CPU, 1.6 Mbps, 150 ms RTT) |
|---|---|---|
| Accessibility | **94** | **94** |
| Best Practices | **100** | **100** |
| SEO | **82** | **82** |
| Agentic Browsing | 67 | 66 |
| Audits passed / failed | 50 / 6 | 49 / 7 |

Raw reports:
`…/scratchpad/lh-desktop/report.json`, `…/scratchpad/lh-mobile/report.json`.

### 1.1 Every failing audit, with its actual value

| Audit | Score | Measured detail |
|---|---|---|
| `color-contrast` | 0 | 5 elements — ratios in §3.1 |
| `label-content-name-mismatch` | 0 | `button#cHomeLang` has `aria-label="Language"`, visible text `🇮🇱 עברית ▾`. Voice-control users saying the visible word cannot activate it. |
| `landmark-one-main` | 0 | "Document does not have a main landmark" — root cause measured in §3.3 |
| `meta-description` | 0 | absent |
| `robots-txt` | 0 | **11,313 errors**; first parsed line is `<!DOCTYPE html>` — see §2.5 |
| `llms-txt` | 0 | "File is missing a required H1 header" — same root cause as robots.txt |
| `cumulative-layout-shift` (mobile only) | 0.98 | displayValue **0.053** on the Lighthouse (warm) load |

`target-size` (WCAG 2.5.8, 24×24) **passes**, score 1, on both runs. That is consistent with my own
measurement in §3.2: 0 of 36 interactive elements are under 24 px, while 25 of 36 are under 44 px.

---

## 2. Performance — measured from traces

Three traces, all saved:
`…/scratchpad/trace-cold-mobile.json`, `trace-mobile-4x-slow4g.json`, `trace-unthrottled.json`.

Mobile emulation used: viewport `390×844×3, mobile, touch`, CPU 4× slowdown, network `Slow 4G`.
The cold run was performed in a **fresh isolated browser context** (no service worker, no HTTP cache,
no localStorage) so it represents a first-time user, i.e. someone who opens the app at a fire for the
first time.

### 2.1 Core Web Vitals

| Scenario | LCP | CLS | TBT | FCP | domInteractive | loadEventEnd |
|---|---|---|---|---|---|---|
| **Cold**, 390 px mobile, 4× CPU, Slow 4G | **2,863 ms** | **0.29** | **853 ms** | 1,913 ms | 5,302 ms | 5,314 ms |
| Warm (SW-controlled), same throttling | 1,110 ms | 0.00 | 611 ms | — | 1,083 ms | 1,094 ms |
| Warm, desktop, no throttling | 347 ms | 0.00 | 58 ms | — | — | — |

The cold mobile CLS of **0.29 is in Google's "Bad" band** (>0.25). The worst shift is a single event,
score **0.2873**, at 5,270 ms — i.e. 3.4 seconds *after* first paint, when the app's own JS finishes
booting and rewrites the home screen. Measured impacted nodes: one block moved from `y=354 h=912` to
`y=486 h=780`, a second block collapsed from `y=970 h=296` to `0×0`, a third shrank from `w=189` to
`w=139`. Lighthouse's warm run only saw **0.053** of this, because on a warm load the document is
already local. **The number the first-time user experiences is 0.29, not 0.053.**

TBT of **853 ms** on the cold mobile load comes from 4 long tasks: **640.4 ms, 273.6 ms, 84.7 ms,
54.7 ms**.

### 2.2 Main-thread cost of the 2.6 MB single-file document

Cold, 4× CPU throttled, renderer main thread:

| Phase | Total | Longest single event |
|---|---|---|
| `ParseHTML` | **400.3 ms** (431 chunks) | 272.8 ms |
| `v8.compile` (the one inline `<script>`) | **177.9 ms** | 177.9 ms |
| `EvaluateScript` | **266.1 ms** | 266.1 ms |
| `Layout` | **812.0 ms** (13 events) | 542.3 ms |
| `UpdateLayoutTree` | 67.5 ms | 42.1 ms |
| Total `RunTask` on main | 1,753.6 ms | — |

Document size, measured from `PerformanceNavigationTiming` on the cold load:
`decodedBodySize = 2,689,578` bytes, `encodedBodySize = 659,999` bytes.
**The origin does compress: 2.63 MB → 645 KB on the wire, 4.07:1.** Any claim that this app ships
2.6 MB *over the network* is wrong; it ships 645 KB over the network and pays 2.6 MB of parse.

DOM at rest (DevTools DOMSize insight): **620 elements, depth 7, max children 52** (`div#gloss`).
That is a small DOM. The cost is parse + compile + one 542 ms layout, not DOM size.

### 2.3 The render-blocking Google Fonts request — measured

Cold mobile trace: the stylesheet
`https://fonts.googleapis.com/css2?family=Suez+One&…` was requested at **645.9 ms** and finished at
**1,265.4 ms** — a **619.5 ms render-blocking round trip**, `renderBlockingStatus: "blocking"` per
resource timing. FCP landed at 1,913 ms. It then pulled **6 woff2 files** (`transferSize` 6,787 +
12,063 + 14,219 + 15,087 + 23,769 + 30,145 = **102,070 bytes**) that did not finish until 3,324 ms.

### 2.4 NEW finding not in W1-D: a first visit downloads the whole app three times

Mapping every `ResourceSendRequest`→`ResourceFinish` pair by requestId in the cold trace:

| Finished at | Bytes on the wire | URL |
|---|---|---|
| 5,301.7 ms | 661,330 | `https://matkonetesh.pages.dev/` (the navigation) |
| 5,467.9 ms | **660,951** | `https://matkonetesh.pages.dev/` (again) |
| 5,533.3 ms | **661,002** | `https://matkonetesh.pages.dev/` (a third time) |

Total bytes over the wire on a cold first visit, all requests summed: **2,117,219 bytes (2.02 MB)**.
**1,321,953 of those bytes (62%) are two redundant re-downloads of the identical document.**

Root cause, quoted from the **shipped** `https://matkonetesh.pages.dev/sw.js` (fetched live, 2,279 bytes,
cache name `mk-5ffd74d1`):

```js
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',function(e){ self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL).catch(function(){});})); });
```

`SHELL` lists **both `'./'` and `'index.html'`** — two cache keys for the same resource — and
`_headers` sets `Cache-Control: no-cache` on index.html, so neither can be satisfied from the HTTP
cache. `addAll` therefore refetches the full document twice on install. On the Slow 4G profile that is
an extra ~230 ms of download after `load`, and 1.3 MB of a user's mobile data on their first launch.

Also visible in the same shipped `sw.js`: the fetch handler is **network-first for navigations**
(`e.respondWith(fetch(req).then(...).catch(function(){ return caches.match(req)… }))`). I did not
produce a timed measurement of a weak-signal launch, so I am not attaching a number to that — flagging
the code fact only.

### 2.5 NEW finding not in W1-D: the origin returns HTTP 200 for every unknown path

Measured with `fetch(…, {cache:'no-store'})` from the live page:

| Path | Status | Content-Type | Bytes |
|---|---|---|---|
| `/robots.txt` | **200** | `text/html; charset=utf-8` | 2,273,297 |
| `/llms.txt` | **200** | `text/html; charset=utf-8` | 2,273,297 |
| `/this-path-does-not-exist-xyz` | **200** | `text/html; charset=utf-8` | 2,273,297 |
| `/manifest.webmanifest` | 200 | `application/manifest+json` | 728 |
| `/sw.js` | 200 | `application/javascript` | 2,279 |

The Cloudflare Pages SPA fallback serves `index.html` for **everything**, with a 200 rather than a 404.
This is the actual cause of the two failing SEO/agentic audits (`robots-txt`: 11,313 parse errors
starting at `<!DOCTYPE html>`; `llms-txt`: "missing H1"), and it means every crawler probe, broken link
or favicon guess costs 645 KB of egress and returns a soft-200 that no crawler can interpret.

### 2.6 The non-Hebrew MutationObserver cost — measured, and it is large

W1-D §3.4 predicted this from code. I measured it. Setup: 390×844 mobile, **4× CPU throttling**,
585-element DOM, 8-second window, a `textContent` write every 250 ms on a visible element — exactly the
`wireTimer` tick pattern. Frame durations sampled by `requestAnimationFrame`, long tasks by
`PerformanceObserver({entryTypes:['longtask']})`.

| UI language | frames in 8 s | avg frame | p95 frame | max frame | frames > 50 ms | long tasks | total long-task time |
|---|---|---|---|---|---|---|---|
| **he** | 481 | 16.6 ms | 17.0 ms | 17.7 ms | 0 | **0** | **0 ms** |
| **en** (run 1) | 254 | 31.4 ms | 143.6 ms | 160.0 ms | 36 | **36** | **4,984 ms** |
| **en** (run 2) | 248 | 32.4 ms | 141.1 ms | 157.4 ms | 37 | **37** | **5,061 ms** |

Two independent runs, reproducible within 1.5%.

**In English, 4,984–5,061 ms of an 8,000 ms window — 62% of wall-clock — is spent inside main-thread
long tasks**, one ~135 ms task roughly every 220 ms. Effective frame rate collapses from ~60 fps
(481 frames/8 s) to ~32 fps (254 frames/8 s). In Hebrew, on the identical device profile and the
identical tick, the cost is **zero** long tasks and a 17.7 ms worst frame.

Unthrottled desktop for reference: he p95 16.8 ms / max 18.1 ms; en p95 39.8 ms / max 45.2 ms, still
0 long tasks. The defect only becomes severe once the CPU is a phone's.

This measurement was taken on the **home screen** (585 elements). The catalog grid adds hundreds more
nodes to the same document-wide walk, so this is a floor, not a ceiling.

---

## 3. Accessibility — measured on the real DOM

### 3.1 Contrast: actual ratios

axe-core, default (cream) theme, both runs identical:

| Element | Foreground | Background | Font | **Measured ratio** | Needs |
|---|---|---|---|---|---|
| `footer > .footnote > b.foot-stamp` ("מהדורה 258 · 22.7.26") | `#f4a261` | `#faecd8` | 12.5 px bold | **1.77 : 1** | 4.5 |
| `div.chome-hero > h2 > b` ("מדליקים") | `#e76f51` | `#faecd8` | 22 px | **2.65 : 1** | 4.5 |
| `div.cpath > span.ptag` ("🌿 הכי פופולרי") | `#1a9a7a` | `#d8f0e8` | 10 px bold | **2.95 : 1** | 4.5 |
| `div.cnav > button.on` (active bottom-nav label) | `#e76f51` | `#fffaf3` | 10.5 px | **2.97 : 1** | 4.5 |
| `button#cHomeAiMore` ("✨ עוד כלי AI") | `#1a9a7a` | `#faecd8` | 12 px bold | **3.03 : 1** | 4.5 |

**All four themes measured.** I extracted the four `THEMES` token sets from the live page and computed
WCAG 2.x ratios for the five failing pairs plus the three body-text pairs:

| Pair | cream (default) | charcoal | walnut | slate |
|---|---|---|---|---|
| hero `<b>` (`--ember` on `--bg2`) | **2.66** ✗ | 8.34 ✓ | **4.18** ✗ | **4.07** ✗ |
| `#cHomeAiMore` (`--fresh` on `--bg2`) | **3.04** ✗ | 8.55 ✓ | 5.48 ✓ | 5.75 ✓ |
| `.ptag` (`--fresh` on `--fresh-l`) | **2.95** ✗ | 6.38 ✓ | 5.66 ✓ | 5.38 ✓ |
| `.cnav button.on` (`--ember` on `--card`) | **2.98** ✗ | 7.64 ✓ | 4.75 ✓ | 4.61 ✓ |
| `.foot-stamp` (`--ember2` on `--bg2`) | **1.77** ✗ | 10.06 ✓ | **3.05** ✗ | **3.05** ✗ |
| body text (`--bone` on `--bg2`) | 8.72 ✓ | 15.62 ✓ | 10.60 ✓ | 12.27 ✓ |
| muted (`--smoke` on `--bg2`) | 5.06 ✓ | 8.69 ✓ | 4.83 ✓ | 4.84 ✓ |
| secondary (`--ash` on `--card`) | 6.80 ✓ | 6.35 ✓ | 6.82 ✓ | 7.09 ✓ |
| **AA failures** | **5 of 8** | **0 of 8** | 2 of 8 | 2 of 8 |

**The default theme is the worst of the four.** `charcoal` passes every pair measured.

### 3.2 Touch targets: actual rendered px at 390 px width

Home screen, `getBoundingClientRect()` on every visible interactive element. 36 total.

- **25 of 36 (69%) are under 44×44 px.**
- **0 of 36 are under 24×24 px** — which is why Lighthouse `target-size` passes.

| Element | Measured | Note |
|---|---|---|
| `button#cHomeAiMore` "✨ עוד כלי AI" | 358 × **26** | smallest height on the screen |
| `button#cPathCook` | 310 × **30** | |
| `button.eq-x` (settings-panel close) | **30 × 30** | |
| `button#cHomeLang` | 92 × **34** | |
| **18 × `button.lane-chip`** (the primary "pick a cut" controls) | 52–121 × **37** | the greasy-hands path |
| `button#cHomeMore` (`.capp-ico`) | **40 × 40** | ← confirms W1-D §4.4 exactly |
| equipment category chips in the panel | 75–92 × **38** | |
| `a.skip-link` | 86 × 40 | |
| **`div.cnav > button`** (bottom nav) | **78 × 70** | **passes** |
| `button.fab` (central 🎉) | **78 × 88** | **passes** |
| `input#cHomeSearchInput` | 358 × 52 | passes |

### 3.3 Structure, landmarks, and why `landmark-one-main` fails

Measured on the loaded home screen:

- `<main id="mainContent" tabindex="-1">` **exists**, `display: block`, `visibility: visible`, no
  `aria-hidden` — **but its bounding rect is 0 × 0.** It lives inside `#scr-catalog`, which is one of
  five sibling `.screen` divs, only one of which carries `.on`. Measured screen rects:
  `scr-home 390×1271`, `scr-wizard 0×0`, `scr-catalog 0×0`, `scr-events 0×0`, `scr-projects 0×0`.
- The visible home content is inside `#scr-home`, which is **outside `<main>`**. So on the default
  screen there is no visible main landmark — that is the axe failure, and it also means the skip link
  (`href="#mainContent"`, measured) **skips to a zero-size element on a hidden screen**.
- Landmarks present in total: `MAIN#mainContent` (0×0) and `FOOTER`. The bottom navigation is a plain
  `<div class="cnav">` — **no `nav` landmark, no `role="navigation"`**, so its 5 buttons are announced
  as loose page buttons.
- Headings on home: H1 → H2 → H3, H3 — no skipped level. `h1` count = 1.
- Whole-document ARIA inventory after browsing: `role` 416, `aria-pressed` 128, `aria-label` 23,
  `aria-hidden` 1, `aria-modal` 1.

### 3.4 Forms

Chrome's own issue panel (`list_console_messages`, `types:["issue"]`) on the live page:

- **"No label associated with a form field" × 13**
- "A form field element should have an id or name attribute" × 3 and × 5

The primary home search box `input#cHomeSearchInput` is one of them: no `label[for]`, no `aria-label`,
no wrapping label — **placeholder text only** (`חפש הכל — נתח, נקניקייה, מתבל…`).

### 3.5 Focus management

- **`:focus-visible` works** — measured on the skip link: `outline-width 2px`, `outline-style solid`.
  Confirms W1-D §4.2.
- **No positive `tabindex` anywhere** (0 elements with `tabindex > 0`). Tab order = DOM order.
- **The settings panel does it right**: `<aside id="panel" role="dialog" aria-modal="true"
  aria-label="בוא נכיר את הציוד שלך">`, 390×844 fixed, and on open `document.activeElement` is the
  close button *inside* the panel. Good.
- **The wizard does not**: after clicking the FAB to open the 6-step event wizard, `document.activeElement`
  is still the FAB — `scr-wizard.contains(document.activeElement) === false`. On a second run it was
  a `button.x` belonging to a panel that had just been dismissed.
- **Chrome flags the resulting bug itself**, verbatim from the console issue list:
  > "Blocked aria-hidden on an element because its descendant retained focus. The focus must not be
  > hidden from assistive technology users… Element with focus: `<button.x>`; Ancestor with aria-hidden:
  > `<aside.panel#panel>`"

  i.e. the panel is marked `aria-hidden` while focus is still inside it.
- Horizontal rails: the 7 smoker `lane-chip` buttons are all tabbable but sit at x = 18, 97, 215, 313,
  **406, 529, 653** in a 390 px viewport — 3 of 7 start outside the viewport inside a scrolling rail
  with no group/list semantics.

### 3.6 Custom widgets

**Cook timeline** (rendered live via the wizard's "צור תוכנית עבודה מלאה"):
- 30 visible `tl-*` elements. **Only 4 carry any `aria-*` or `role`** — and all four are the same
  `aria-label="הרחב פירוט שלבים"` on the expand buttons.
- `ul`/`ol`/`role="list"` count inside the rendered plan: **0**. A sequenced cook plan with no sequence
  semantics.
- `.tl-startt` time displays (`15:38`, `15:52`, `18:29`, `18:40`) carry no role and no live region.
- Positive: **10 pre-created `<span class="tt-alert" role="alert" aria-live="assertive">` regions exist
  in the DOM before content is inserted** — the correct pattern. (Ten simultaneous *assertive* regions
  is itself aggressive, but they exist and are pre-mounted.)

**Occupancy diagrams (`occ2`)** — I could **not** get this widget to render inside the session budget
(it needs equipment + a non-empty item list in the same session; my equipment save reset the wizard
picks). I am therefore **not** reporting a rendered measurement. What I did measure, against the
**shipped production bundle fetched from the live origin**, is that all ten builders emit no ARIA:

| builder | `aria-*` emitted | `role=` emitted | `dir="ltr"` isolations |
|---|---|---|---|
| `_occGrillBody` | 0 | 0 | 1 |
| `_occVesselBody` | 0 | 0 | 2 |
| `_occCabinetBody` | 0 | 0 | 0 |
| `_occOffsetBody` | 0 | 0 | 1 |
| `_occBayHtml` | 0 | 0 | 2 |
| `_occFitHtml` | 0 | 0 | 1 |
| `_occHeaderHtml` | 0 | 0 | 1 |
| `_occListHtml` | 0 | 0 | 0 |
| `_occTile` | 0 | 0 | 2 |
| `_occUnknownHtml` | 0 | 0 | 0 |

**Wizard step 2** puts **279 item buttons into the accessibility tree simultaneously** (verified by
`take_snapshot`: uids 3_50 … 3_328). Each button's accessible name is the entire card paragraph, e.g.
*"🥩 בריסקט בקר · Brisket מלך ה-BBQ הטקסני: חזה הבקר, עתיר קולגן ורקמות חיבור — דורש בישול ארוך ואיטי
שממיס אותו לרכות עסיסית עם bark כהה. +"*. No list semantics, no group labels, no headings between
categories. The `.cwseg` step buttons **are** correctly labelled (`aria-label="Step 1: Basics"` etc.)
and the appetite selector correctly uses `aria-pressed`.

### 3.7 Hebrew RTL / language announcement

- Hebrew mode: `document.documentElement.lang="he"`, `dir="rtl"`. English mode: `lang="en"`,
  `dir="ltr"`, `html.lang-en`. **`applyLang()` works** — confirms W1-D §4.6, measured.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` — no `user-scalable=no`,
  no `maximum-scale`. Zoom is available. Confirms W1-D §4.7, measured.
- In **English** mode, 3 Hebrew strings remain visible on the home/plan surface, one of which is a
  genuine mixed-direction string rendered inside an LTR document:
  `📋 התפריט · 8 guests · ~2.2 kg בשר` (in an `<h4>`), plus `לא נבחרו מנות` and the language pill's
  own `עברית`.
- The English footer, live in production, reads: **"Data is local, no network connection."**

---

## 4. Verdict on every W1-D claim I could test

### CONFIRMED by measurement

| # | W1-D claim | My measurement |
|---|---|---|
| §1.2 | `cwLbl` renders hardcoded Hebrew regardless of language (`app.js:7166`) | **Confirmed at runtime.** In English mode: `cwTitle` = `🎉 Event wizard`, step buttons = `Step 1: Basics`…, and `cwLbl` = **`שלב 1/6`**. |
| §1.3 | The footer "no network connection" string ships in English too (`lang/en.json:261`) | **Confirmed live on v258.** English footer: "Matkonet · Fire Guide — built from Dudi's tables. **Data is local, no network connection.** Checklist marks are saved in the browser." |
| §3.2 | Render-blocking cross-origin Google Fonts CSS in `<head>` | **Confirmed with a number:** `renderBlockingStatus: "blocking"`, requested 645.9 ms → finished 1,265.4 ms = **619.5 ms** on the critical path, before an FCP of 1,913 ms. Plus 102,070 bytes of woff2 that finish at 3,324 ms. |
| §3.4 | Full-document TreeWalker fires ~4×/s during any timer in non-Hebrew mode | **Confirmed and quantified.** At 4× CPU: English = **36–37 long tasks, 4,984–5,061 ms of long-task time per 8 s** (62% of wall-clock), p95 frame 143.6 ms; Hebrew = **0 long tasks**, p95 frame 17.0 ms. Reproduced twice. |
| §4.3 | Occupancy + timeline widgets carry zero ARIA | **Confirmed.** Timeline rendered live: 30 elements, 4 with any ARIA, all the same expand-button label; 0 list semantics. `occ2`: all 10 `_occ*` builders in the shipped bundle emit 0 `aria-*` and 0 `role=`. |
| §4.4 | `.capp-ico` is 40×40 px, below the 44 px comfort target | **Confirmed exactly:** `button#cHomeMore.capp-ico` measured **40 × 40**. |
| §4.2 | Global `:focus-visible` outline exists | **Confirmed:** `outline-width: 2px, outline-style: solid` on the focused skip link. |
| §4.6 | `applyLang()` sets `documentElement.lang`/`.dir` correctly | **Confirmed:** he→`he`/`rtl`, en→`en`/`ltr`. |
| §4.7 | Viewport does not block zoom | **Confirmed:** `width=device-width, initial-scale=1`, nothing else. |
| §3.1 | All 5 screens are in the DOM simultaneously, toggled by `.on` | **Confirmed:** measured rects — `scr-home 390×1271`, the other four `0×0`. |

### REFUTED or materially corrected

| # | W1-D claim | What the measurement shows |
|---|---|---|
| §3.1 | "Shipped `dist/index.html`: 2,701,065 bytes (2.6 MB)" framed as the payload | **Half right.** 2,689,578 bytes **decoded**, but only **659,999 bytes on the wire** — the origin compresses 4.07:1. The parse cost is real (400 ms ParseHTML + 178 ms compile + 266 ms eval at 4× CPU); the *bandwidth* cost is 645 KB, not 2.6 MB. Any remediation framed around "2.6 MB download" is aimed at the wrong number. |
| §4.1 | "contrast was audited and fixed once already… the team already ran and passed a contrast check on the default (cream) theme's core text tokens" — read as a positive | **The core *body* tokens do pass** (`--bone` 8.72, `--smoke` 5.06, `--ash` 6.80 — so the specific claim holds). **But the default theme has 5 measured AA failures on accent text**, down to **1.77 : 1**, and axe flags 5 live elements. Cream is the *worst* of the four themes. Reading §4.1 as "contrast is handled" is wrong. |
| §4.1 | charcoal/walnut/slate "unverified, not failing" | **Now verified.** charcoal: **0 of 8 fail**. walnut and slate: **2 of 8 fail each** (hero 4.18/4.07, foot-stamp 3.05/3.05). |
| §4.2 | "A skip-link to `#mainContent` exists" — listed as a positive | **The link exists and the target exists, but the target measures 0 × 0** and sits inside the hidden catalog screen. On the default screen the skip link goes nowhere. This is also the root cause of Lighthouse's `landmark-one-main` failure, which W1-D did not predict. |
| §4.2 | "`toast()` sets `role="status"` and `aria-live="polite"` on creation — correct pattern" | **Measured: zero `aria-live` regions exist in the document at rest.** A live region created in the same operation that inserts its text is frequently not announced. (The `tt-alert` regions in the timeline *are* pre-created and do follow the correct pattern — the toast path does not.) |
| §4.4 | `.cnav` / `.chip` sizes "need a rendered DOM, flagging `.capp-ico` only" | **Now measured.** `.cnav` buttons are **78 × 70** and the FAB **78 × 88** — both **pass** 44 px comfortably. The real failures are elsewhere: 18 `.lane-chip` at **37 px** tall, `#cHomeAiMore` at **26 px**, `#cPathCook` at **30 px**, the panel close at **30 × 30**. **25 of 36** interactive elements on home are under 44 px. |
| §1.5 | bidi mis-rendering "needs visual verification — not a confirmed defect" | Still not a confirmed *visual* scramble; but a concrete mixed-direction string was captured in a live LTR document: `📋 התפריט · 8 guests · ~2.2 kg בשר`. |

### NEW — not in W1-D at all

1. **Cold CLS is 0.29 ("Bad"), not 0.053.** A single 0.2873 shift fires 3.4 s after first paint when the
   app's JS rewrites the home screen. Lighthouse's warm run under-reports it by 5.5×.
2. **A first visit transfers 2,117,219 bytes — three full copies of the document.** Root cause is
   `SHELL=['./','index.html',…]` in the shipped `sw.js` combined with `Cache-Control: no-cache` on
   index.html. 1,321,953 bytes (62% of the first visit) are pure waste.
3. **The origin returns HTTP 200 + 2.27 MB of HTML for every unknown path** (`/robots.txt`,
   `/llms.txt`, arbitrary paths). No real 404 exists. This is the sole cause of both failing SEO audits.
4. **`landmark-one-main` fails** because `<main>` is 0×0 inside a hidden screen (§3.3).
5. **`label-content-name-mismatch`**: `#cHomeLang` says `aria-label="Language"` while displaying
   `עברית` — a voice-control activation failure.
6. **13 unlabelled form fields**, per Chrome's own issue panel, including the primary home search box.
7. **Opening the wizard does not move focus into it**, and Chrome itself reports
   *"Blocked aria-hidden on an element because its descendant retained focus"* on the settings panel.
8. **Wizard step 2 exposes 279 buttons at once**, each with a ~40-word accessible name and no list or
   group semantics.
9. **The bottom navigation has no `nav` landmark.**
10. **No `meta description`.**

### Not claimed (dropped per the evidence rule)

- A Lighthouse **performance score** and a Lighthouse **PWA score** — this Lighthouse build emits
  neither category (§0). CWV are reported instead.
- A **rendered** measurement of the `occ2` occupancy diagram's ARIA — I could not get it on screen; the
  bundle-level result is labelled as such in §3.6.
- Any timing for the network-first navigation path of `sw.js` on a weak signal — code fact only, no
  number.
- Screen-reader announcement behaviour as actually spoken by NVDA/VoiceOver/TalkBack — I measured the
  accessibility tree and live-region presence, not a real AT session.
