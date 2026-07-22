# W5-B — UX / design-system review

**Subject:** matconetesh PWA (Hebrew-first RTL, mobile-first 390px, live-fire cooking).
**Method:** read `app.css` (171,796 B) and the render functions in `app.js` (882,106 B); read the
screenshot corpus in `docs/analysis/shots/` including `p2-he/-dark/-en.png`, `p4-early-he.png`,
`p4-advice-he.png` and `shots/sweep/`; **and reproduced every measured claim on the real runtime
path** — `node serve.js 8123` → Chromium at 390×844 / DPR 2, `he`, `--fscale:1`, default `cream`
theme, seeded event `ev-a` (4 cuts, serve 19:00) + a 3-device kit. Numbers below are
`getBoundingClientRect()` / `getComputedStyle()` readings from that session unless a screenshot is
named. Claims I could not reproduce live are marked as screenshot-only.

**Nothing in this repo was modified.** Two scratch PNGs written by the browser tool
(`w5b-calcrow.png`, `w5b-ask.png`) were deleted after reading.

---

## 1. Design-system verdict

**Colour is a real, well-governed token system. Type, space and radius are not tokenised at all.**

### What is genuinely systematic (colour)

`app.js:6840–6853` defines four themes (`cream`, `charcoal`, `walnut`, `slate`), each a flat map of
~36 CSS custom properties. `applyAppearance()` (`app.js:6995`) writes them onto
`document.documentElement` inline, sets `color-scheme` from `THEME_SCHEME` (`app.js:6867`), and
updates `<meta name="theme-color">` to `--char`. Verified live: `themeColor: "#fdf6ec"`,
`colorScheme: "light"`.

The token vocabulary is semantic, not literal — `--over`, `--grate`, `--cool`, `--cooll` were added
specifically so the Phase-2 occupancy diagrams could be re-skinned, and they carry: `p2-dark.png`
(charcoal) renders the densest screen in the app with **no leaked light hexes** — the cabinet
hatch, the empty-shelf dashes, the sous-vide bath and the firebox stripe all re-tint correctly.
That is the hardest test in the app and it passes.

`--fscale` is the second genuinely good idea: **618 of 624 `font-size` declarations** in `app.css`
are written `calc(Npx * var(--fscale))`, so the user's text-size preference (0.9 / 1 / 1.15 / 1.3,
`app.js:6857`) scales essentially the whole interface. Only 6 literal-px font sizes escape it. For
an outdoor app used by people who are not 25, this is the right architecture and it is applied with
discipline.

### Where the system stops

| Axis | State | Evidence |
|---|---|---|
| Colour | Tokenised, 4 themes, semantic names | `app.js:6840–6853`; verified in `p2-dark.png` |
| Type scale | **34 distinct sizes**, 8.5 → 90 px, in 0.5 px steps | `grep -o "font-size:calc([0-9.]*px" app.css \| sort -u` → 8.5 9.5 10 10.5 11 11.5 12 12.5 13 13.5 14 14.5 15 15.5 16 17 18 19 20 21 22 24 25 26 28 30 32 34 46 48 50 56 58 90 |
| Spacing | **24 distinct `padding:` values, 16 distinct `gap:` values** — every integer 1–16 | no 4/8-px grid |
| Radius | **21 distinct `border-radius` values**; the one token `--r:16px` (`app.css:24`) is used **twice** | `grep -c "var(--r)" app.css` → 2 |
| Hardcoded colour | ~120 live hex literals outside the dead legacy block | see below |

There is no `--space-*`, no `--text-*`, no working `--radius-*`. Every new component picks fresh
numbers, which is why 13 px and 13.5 px and 14 px all exist as body sizes and why a card can be
`border-radius:16px` next to one at `18px` and one at `20px`.

**Hardcoded colour — corrected count.** `app.css` contains 258 hex literals, but **lines 390–464
are dead code**: the `html.t-vintage` / `html.t-gold` / `html.light` legacy themes. `applyAppearance()`
explicitly strips those classes on every call (`app.js:6997`, comment: *"clear dead legacy classes
permanently"*) and nothing ever adds them back — I grepped `app.js` and found zero writes. Discount
them and ~120 live literals remain, mostly semantic-but-untokenised (`#c0392b` danger ×14,
`#b8e0d4` mint border ×8, `#7a5cc2`/`#b9a3e8` voice-cook lavender ×7). These do not respond to theme
switching; the charcoal theme survives because it happens to be a warm dark, not because the
literals are safe.

> ⚠️ Note for the controller: the "70 lines of hardcoded theme CSS" reading of `app.css:390–464`
> **is a false alarm** — that block is unreachable. I checked the runtime class list, not just the
> stylesheet.

---

## 2. The eight highest-impact UX problems, ranked

### P1 — The Work Plan opens 2.1 screenfuls above the task you need to do now

**Screen:** Timeline → Work Plan view (`shots/sweep/he-d-51-tl-workplan.png`, `p4-early-he.png`).

Measured live at 390×844 with a 4-item plan:

| | px |
|---|---|
| Panel viewport height | 721 |
| Panel scroll height | 2496 |
| y of first task row | 1132 |
| **y of the `.wp-next` "הבא / Next" row** | **1550** |
| `panel-body.scrollTop` on open | **0** |

`app.js:2505` explicitly does `body.scrollTop=0` when a panel opens. `.wp-next` (`app.js:5939`) is a
CSS cue only — `grep -n "wp-next" app.js app.css` returns exactly two hits, the class assignment and
`app.css:159`. **Nothing scrolls to it.** So every time you pull the phone out of your pocket mid-cook
you land on the serve-time picker and must flick ~829 px (2.1 screens) to find the orange "Next" row.

In the by-item view the same problem is milder but present: first task card at y=755 against a
721 px viewport — the first cooking step is *just* below the fold, behind serve time, serve date,
reset, countdown bar, start button, alerts toggle, a 3-line help paragraph and the view switcher.

Fix shape: on open, scroll `.wp-next` into view (or make a 1-line "now/next" strip `position:sticky`
at the top of `.panel-body`). Do not restructure the plan — the plan is good.

---

### P2 — The occupancy time scrubber is 16 px tall and scrolls out of view

**Screen:** Cooker Occupancy (`shots/sweep/he-d-52-occupancy.png` / `-s2.png`, `p2-he.png`).

Measured live: `.occ-scrub input[type=range]` = **330 × 16 CSS px**. Thumb measured off
`he-d-52-occupancy.png` at DPR 2: 30 device px → **15 × 15 CSS px**. WCAG 2.2 SC 2.5.8 (Target Size
Minimum, AA) requires 24 × 24 CSS px; Apple HIG and WCAG 2.5.5 want 44. This is the *only* control
for "what is on my cookers at time T", and it is a 15 px target for a greasy thumb.

Worse, `app.css:1636` `.occ-scrub{margin-bottom:12px}` — `position` computes to **`static`**, and
`.panel-body` is the scroller (721 px viewport vs 916 px content with only 3 devices; `p2-he.png` is
3000 px tall with six). Verified live: `[...document.querySelectorAll('.panel-body *')].filter(e =>
getComputedStyle(e).position === 'sticky')` returns **`[]`** — nothing in the panel is sticky.

Consequence, visible in `he-d-52-occupancy-s2.png`: once you scroll to the sous-vide bath, both the
scrubber **and the clock readout are gone**. You are looking at a temporal snapshot with no
indication of which moment it represents. That is the wrong failure mode for a screen whose entire
purpose is "…and when".

---

### P3 — Item names on the occupancy diagrams truncate to 2–3 characters

**Screen:** Cooker Occupancy, all locales and themes.

`p2-he.png` shelf 1 renders `בריסקט 1320`, `ספי… 360`, `חז… 96`, `לחי… 150`. `p2-en.png` renders
`Brisket`, `Po…`, `Go…`, `Be…`. `p2-dark.png` identical. Three independent artifacts.

Root cause, and the arithmetic checks out on the live runtime path:

- `app.js:568` — `const frac = Math.max(18, Math.round(it.cm2 / cap.perSlotCm2 * 100));` → a tile is
  never narrower than **18 %** of the shelf, but also never wider than its true area share.
- `app.css:1655` — `.occ2-tile{padding:5px 9px; border:1.5px; white-space:nowrap; overflow:hidden}`
- `app.css:1656` — `.occ2-tile-t{font-size:calc(13px * var(--fscale)); text-overflow:ellipsis}`

Measured live at 390 px: `.occ2-shelf` inner width **260 px** → an 18 % tile is **47 px** → after
padding and border the label box is **26 px**, while the 4-letter name `חזה אווז` needs **47 px**.
So a minimum tile shows roughly half of even a short name. `חז…` is ambiguous between חזה אווז /
חזיר / חזה עוף — three different cooks.

The full name is only in `title=` (`app.js:565/567/569`), which is a hover tooltip and therefore
unreachable on the target device.

Two aggravating factors visible in the same crop:
- The 4 tiles **wrap onto two visual bands** inside one shelf, while the shelf number "1" sits
  between them. The metaphor "one shelf = one horizontal band" breaks exactly where the shelf is busy.
- A per-device legend directly underneath repeats every name, shelf and area in full
  (`בריסקט · מדף 1 · 1320 סמ״ר`). So ~340 px of diagram is fully redundant with a readable list
  *and* less accurate than it.

---

### P4 — The serve-date field clips the year, at every text size

**Screen:** Timeline header (`shots/sweep/he-d-51-tl-workplan.png`; also flagged in the older
`31b-timeline-date-clipped.png`).

`app.css:555–556` — `.calcrow input, .calcrow select { padding:9px 11px; font-size:calc(15px *
var(--fscale)); width:120px }`. `#tlServeDate` (`app.js:5630`) inherits it.

Reproduced live at defaults (Heebo, `--fscale:1`, `he`): the field renders **`22/07/202`**. Measured
inside the page:

| `--fscale` | font-size | `22/07/2026` needs | room for text **+ calendar icon** |
|---|---|---|---|
| 1 | 15 px | 80 px | 97 px |
| 1.15 | 17.25 px | 92 px | 97 px |
| 1.3 | 19.5 px | **104 px** | 97 px |

The native calendar glyph eats ~22 px, so it clips at 1 and 1.15; at 1.3 the digits alone overflow.
The field is the serve **day** for a plan that can start the previous afternoon — `p4-advice-he.png`
shows the app itself warning *"היה צריך להתחיל ב-אתמול 05:00 (לפני 1630 דק׳)"*. A truncated year on
the one field that disambiguates "which day" is a safety-adjacent defect, not cosmetic.

`p4-early-he.png` shows the same field uncropped, so the artifact set alone was ambiguous — this is
confirmed on the live runtime path, not from one screenshot.

---

### P5 — Accent tokens are used as body-text ink and fail AA on all three light themes

Contrast computed with the WCAG relative-luminance formula, foreground/background sampled from the
live computed styles.

| Element | Colour | On | Ratio | Needs |
|---|---|---|---|---|
| `.chome-ask` "שאל את האש" 15.5 px/800 + its 11 px subtitle | `#fff` | gradient `#e76f51 → #f4a261` (`app.css`, verified live on `.chome-ask`) | **3.09 → 2.06 : 1** | 4.5 |
| `.chome-kick` "עישון · גריל · אש" 12 px/800 | `--ember2 #f4a261` | `--bg2 #faecd8` | **1.77 : 1** | 4.5 |
| `.foot-stamp` version stamp 12.5 px | `--ember2` | `--bg2` | **1.77 : 1** | 4.5 |
| `.skip-link` (the a11y feature itself) | `#fff` | `--ember2` | **2.06 : 1** | 4.5 |
| `.ptag` "🌿 הכי פופולרי" 10 px | `--fresh #1a9a7a` | `--fresh-l #d8f0e8` | **2.95 : 1** | 4.5 |
| `.occ2-fit-ok` "✓ הכל נכנס" 11.5 px/700, ×3 per screen | `--fresh` | `--char2 #fffaf3` | **3.40 : 1** | 4.5 |
| `.chome-aimore` 12 px/700 | `--fresh` | `--bg2` | **3.04 : 1** | 4.5 |
| `.cpath-branch` 13 px/700 | `--terra-d #d2691e` | `--bg2` | **3.12 : 1** | 4.5 |

`--ember2`-as-text fails on **all three light themes** — 1.77 : 1 (cream), 3.05 : 1 (walnut,
`#b56a35` on `#e8dcc6`), 3.05 : 1 (slate, `#bc7440` on `#e7eaee`) — and passes only on charcoal.
`--fresh`-as-text fails on cream (3.40 : 1) but passes on walnut (6.23 : 1) and slate.

This is a *system* gap, not a set of one-off mistakes. The `:root` comments prove the team already
did an AA pass on the neutral ramp — `--smoke:#7a5f4c; /* AA 5.5:1 (was #b09480, failed AA at
2.65:1) */`, `--ash /* AA 6.6:1 */`. The accent ramp never got the same pass, and the tokens carry no
signal that `--ember2` is a *fill* and `--ember` is an *ink*. Outdoors in daylight, `#f4a261` on
`#faecd8` is invisible.

The single worst instance is the AI hub card on the home screen (`.chome-ask`) — the app's headline
feature, white on peach at 2.06 : 1.

---

### P6 — Every control on the equipment form has an unlinked label

**Screen:** Equipment → edit sheet (`shots/sweep/he-d-54-equip-edit.png`, `he-d-56-equip-add-sv.png`).

Audited live: **11 of 11** form controls in the sheet return
`el.closest('label') || label[for] || aria-label` = **false**. The markup is:

```html
<div class="eq-vfield"><label>שטח בישול</label><input id="eqvArea" class="eq-vin" placeholder="לדוגמה 3700 cm²"></div>
<div class="eq-vfield"><label data-propfor="areaCm2">📐 שטח בישול כולל <small>(ס״מ²)</small></label><input id="eqProp-areaCm2" ...></div>
<div class="eq-sheet-body"><label class="eq-step-l">קטגוריה</label><select id="eqCat" class="eq-inp">…</select></div>
```

`<label>` elements exist but carry **no `for=`** and do not wrap the control. Repo-wide:
`grep -o "<label[^>]*for=" app.js | wc -l` → **2**, against 47 `<label>` tags.

Two consequences, one of which is a direct greasy-hands problem:

1. **Tapping the label text does nothing.** You must hit the 41 px input itself. Every other checkbox
   in the app gets this right (the work-plan row is a `<label>` wrapping its checkbox — 223 px of
   hit target), so this is an inconsistency, not a house style.
2. No accessible name for any equipment field.

Same screen, same fix window: `#eqvArea` is `type="text"` with placeholder `לדוגמה 3700 cm²` and
**no `inputmode`** → the phone opens the alphabetic keyboard for a pure-number field. `#eqProp-areaCm2`
and `#eqProp-maxC` do set `inputmode="decimal"`, so the pattern is known and just missed here.

---

### P7 — Sub-44 px controls concentrate exactly where the app is most time-critical

Live audit of `getBoundingClientRect()` on the timeline panel, RTL, `--fscale:1`:

| Control | Size | What it does |
|---|---|---|
| `.tl-expand` "▾" ×4 | **26 × 26** | opens the stage detail for a cut — the primary disclosure |
| the "חסום כשאין מספיק זמן" checkbox | **13 × 13** (label hit area 141 × 19) | safety gate: block start when there isn't time |
| `.mchip` ×13 ("✓ כבר מוכן", "מתחיל מאפס", "🧂 תיבול", "➕ דחה הגשה ב-30 דק׳") | 34 h | per-item method + the two reschedule actions |
| method `<select>` ×6 | 33 h | which cooking route a cut takes |
| `.mreset`, `.prbtn` | 34 h | reset choices / print |
| `.plan-startbtn` "▶ התחל תוכנית" | 134 × **42** | the primary CTA, 2 px shy |
| `.eq-iconbtn` "✎" ×6 (Equipment) | 30 × 30 | edit a cooker |
| `.lane-chip` ×20 (Home) | 37 h | one-tap cut picker |

32 sub-44 px targets in the timeline panel alone; 30 on the home screen. The two that matter most are
the **26 px stage-expand** and the **13 px "block if not enough time" checkbox** — the first is how you
read your next step, the second is a safety toggle, and both are under a third of the recommended area.

Credit where due: the bottom nav is 75 × 70 per button, and work-plan rows are full-row labels. The
system knows how to do this; the dense screens didn't get the pass.

---

### P8 — Green "✓ everything fits" is the fall-through for an *empty* device

**Screen:** Cooker Occupancy (`shots/sweep/he-d-52-occupancy.png` at 08:09; reproduced live).

`app.js:655–675`, `_occFitHtml()`:

```js
if (overMsgs.length) return `<div class="occ2-fit-over">⚠ …`;
if (f.verdict === 'tight') return `<div class="occ2-fit-tight">◐ …`;
return `<div class="occ2-fit-ok">✓ ${L('הכל נכנס','everything fits')}</div>`;   // app.js:674
```

There is no branch for "this device has nothing on it at time T". In `he-d-52-occupancy.png` the
smoking cabinet shows *מדף פנוי* ×4 and the offset shows *רשת פנויה* ×2, and **both are stamped
`✓ הכל נכנס`** — a green pass on an empty snapshot. Reproduced live: 3 seeded devices, no placed
items, three `✓ הכל נכנס`.

This is the same class of defect the team has already fixed twice one level down — commit `8c4a3de`
("unmeasured items get their own 'not placed' bucket, never a shelf") and `6f05cab` ("surface
hooksOver in the fit line — no false 'everything fits'"). The remaining case is the *whole device*
being empty. A neutral "אין כלום כאן כרגע / nothing here yet" costs one branch and removes a green
tick that currently means nothing.

---

### Runners-up (real, verified, below the top eight)

- **French/German ship on top of incomplete English coverage.** `shots/sweep/v-lang-fr-home.png`
  and reproduced live in my session: the home fold shows French title + greeting, English
  `My gear · change` / `Smoker` / `Sous-vide · Smoke · Grill`, **and a Hebrew search placeholder
  right-aligned inside an LTR layout**. Three languages above the fold at the front door.
- **No `overscroll-behavior: contain` anywhere.** `grep -c "overscroll-behavior" app.css` → **0**;
  `.panel-body` computes `overscrollBehavior: "auto"`. Scrolling to the end of a plan chains into the
  page behind it. WIG explicitly calls this out for modals/drawers/sheets.
- **Bottom nav ignores the safe area.** `app.css:320` `.cnav{position:fixed;bottom:0}` with
  `padding-bottom: 0px` (verified live), and `body.capp{padding-bottom:82px}` (`app.css:33`) is a
  hard number. The idiom is already in the codebase three times — `app.css:369` (`.cactive-fab`),
  `:374` (`.panel-body`), `:1424` (`.eq-wrap`) all use `env(safe-area-inset-bottom,0px)`. The primary
  nav is the one that misses it.
- **8.5 px text.** `app.css:1668` `.occ2-firebox span{font-size:calc(8.5px * var(--fscale))}` — the
  "תא בערה" firebox label, confirmed at `8.5px` computed. Smallest type in the app by 1 px.
- **`transition: all`** at `app.css:210` (`.cseas-item`) and `:1188` (`.mtoggle`) — 2 instances, WIG
  anti-pattern, trivial.
- **No `-webkit-tap-highlight-color`** anywhere (0 hits) — default blue flash on an otherwise
  warm-terracotta interface.
- **The Voice Cook empty state is a dead sentence.** `shots/sweep/he-25-voicecook.png`:
  *"אין משימות — בנה תוכנית עבודה במתזמן ואז חזור"* with no button to the thing it names.

---

## 3. What is genuinely good — preserve it

Do not let a refactor touch these.

1. **The four-theme colour token system.** `app.js:6840–6853` + `applyAppearance()` (`:6995`). It
   covers the hard case: `p2-dark.png` proves the charcoal theme re-skins the occupancy diagrams —
   hatch, grate, bath, overflow — with no light leakage. `<meta name="theme-color">` tracks the
   active theme (`app.js:7001`), and `color-scheme` is set per theme (`THEME_SCHEME`, `app.js:6867`)
   specifically so the browser stops auto-dark-moding native controls against the app's own palette.
   That last detail is thoughtful and rare.

2. **`--fscale` threaded through 618 of 624 font sizes.** A global text-size preference that
   actually works everywhere, for an app used outdoors by people over 40. Keep the `calc(Npx *
   var(--fscale))` convention as the house rule.

3. **RTL is done with logical properties, correctly.** `inset-inline-start`, `padding-inline-start`,
   `margin-inline-start`, `border-inline-start` throughout the `capp-*` and `occ2-*` layers.
   `p2-en.png` mirrors cleanly against `p2-he.png` — action at the start edge, readout at the end
   edge, in both directions. No physical `left:`/`right:` in the new layers.

4. **Number+unit LTR islands.** `app.js:631`:
   `const isl = n => `<span dir="ltr">${n} ${u}</span>`;` — with the comment *"number+unit LTR island
   (L13) — never wrap the whole Hebrew sentence in ltr"*. This is the bidi detail almost everyone
   gets wrong, and it is done right and documented. The sous-vide capacity line in
   `he-d-52-occupancy-s2.png` renders correctly because of it. (I initially read that line as a bidi
   bug from the screenshot; the source proved it correct. Worth stating so nobody "fixes" it.)

5. **The global focus ring beats the local `outline:none`.** `app.css:825`
   `:focus-visible{outline:2px solid var(--ember)!important;outline-offset:2px}`. There are ten
   `outline:none` declarations on inputs, and all ten are neutralised — verified live: focusing
   `#eqName` yields `outline: 2px solid rgb(231,111,81)` and `matches(':focus-visible') === true`.
   The `!important` is load-bearing; leave it.

6. **Reduced motion is handled globally.** `app.css:1615`
   `@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`,
   plus three targeted opt-outs for the pulsing "live cook" states (`:96`, `:373`, `:1309`).

7. **The destructive reset is undoable, not confirm-gated.** `app.js:5649–5652` snapshots state,
   resets, and offers undo through a toast. For greasy hands mid-cook this is strictly better than a
   modal confirm — no second precise tap required. Apply this pattern to the other destructive
   actions rather than replacing it.

8. **Work-plan rows are `<label>`-wrapped checkboxes.** `app.js:5940` — the entire 223 px row is the
   hit target for "mark this step done". This is the correct greasy-hands pattern and it should be
   the template for P6 and P7.

9. **Empty shelves are drawn, not hidden.** The occupancy diagrams render every unused shelf and
   grate rather than collapsing them. That is the honest "you still have room" signal, and it is the
   right call even though it costs vertical space. (P3 and P8 are about the *labels* and the *verdict
   line*, not about this decision.)

10. **Live regions and heading structure exist.** `aria-live="assertive"` on the alarm banner
    (`#tt-alert`), `aria-live="polite"` on toasts, a real `H1 → H2 → H3` outline, a skip link, and
    `aria-label="שעה בתוכנית"` on the occupancy range input. The a11y floor is higher than the
    contrast numbers in P5 suggest.

11. **`font-variant-numeric: tabular-nums`** on clocks, countdowns and area figures
    (`.occ-scrubrow b`, `.occ2-set`, `.occ2-tile-m`, `.active-row .ar-time`, `.occ2-svcap`). Digits
    don't jitter as the countdown ticks.

12. **`body.is-cooking` reorders the home screen** (`app.css:107–111`) so the live-cook banner lifts
    above the fold. The product already understands the "glance between tasks" problem — P1 is
    asking for the same idea one level deeper, inside the plan itself.

---

## 4. Suggested order of work

| # | Problem | Cost | Why first |
|---|---|---|---|
| 1 | P1 — scroll/pin to `.wp-next` | one `scrollIntoView` or one `position:sticky` strip | largest behaviour change per line |
| 2 | P4 — `.calcrow input` width | `width:120px` → `min-width` / `flex` at `app.css:556` | safety-adjacent, one property |
| 3 | P8 — empty-device fit line | one branch at `app.js:674` | removes a false green |
| 4 | P2 — scrubber size + stick | `min-height:44px` on the range, `position:sticky` on `.occ-scrub` | two properties |
| 5 | P6 — label `for=` + `inputmode` on the equipment sheet | mechanical | fixes a11y and the keyboard together |
| 6 | P5 — split the accent ramp into fill vs ink tokens | needs a decision | do it as a token change, not per-selector |
| 7 | P7 — 44 px floor on `.tl-expand`, the safety checkbox, `.mchip` | mechanical | |
| 8 | P3 — occupancy tile labels | needs a design call (two-line tiles? drop the redundant legend? tap-to-reveal?) | biggest, least mechanical |

Type/space/radius tokenisation is worth doing but is a refactor, not a fix — it should follow, not
block, the eight above.
