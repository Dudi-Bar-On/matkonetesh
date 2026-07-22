# W1-C — Running-app walkthrough (Playwright, 390×844, Hebrew + English)

**Agent:** W1-C · **Date:** 2026-07-22 · **Build:** `python build.py` → `dist/index.html` 2,701,065 B, edition **258 · 22.7.26**
**Method:** own Node/Playwright context (project `node_modules/playwright`) against `node serve.js 8199` — a private port, no shared test runner, full suite NOT run.
**Viewport:** 390×844, `isMobile`, `hasTouch`, DPR 2, iOS UA. Also spot-checked at 320×568.
**Seed:** 9-device kit (cabinet smoker w/ hooks, offset, kettle, Anova + 12/20 L baths, chamber vacuum, wireless probe, stuffer, grinder, home oven) + 12-guest menu of 4 dishes (`cut-1/13/6/39`) written through the app's own `equipSave`/`saveMenu`.
**Screenshots:** `docs/analysis/shots/sweep/` (190 files). Prefixes: `he-*` Hebrew, `en-*` English, `v-*` verification probes, `wp-*` work-plan scroll, `he-d-*` deep pass.

**Console errors across the whole sweep: zero.** No `pageerror`, no uncaught exception, on any screen in any language.

---

## 1. Screens and flows covered

| # | Surface | Entry | What it does | Verdict |
|---|---|---|---|---|
| 1 | First-run UI-level chooser | auto on first load | 3-way beginner/intermediate/advanced modal | works; **carries a "⎙ PDF" print button** (`he`/`r1-01-firstload-he.png`) |
| 2 | Home | `cNavGo('home')` | search, gear chip, 3 gear-gated method lanes, Ask-the-Fire CTA, popular card | works `he-01-home.png`, `v-he-home-dark.png` |
| 3 | Catalog landing | bottom nav | 10 category tiles + glossary tile | **D3** `he-02-catalog.png` |
| 4 | Catalog — cuts list | `catView('cuts')` | 130 cuts, fav/add buttons, filter bar | **D2, D9** `en-03-catalog-cuts.png` |
| 5 | Cut detail (Brisket) | `openCut` | prose, 6 stat cards, method toggles, smoker tip, step checklist, 279-src citations | **D1, D11** `he-04-cut-detail.png`, `v-en-fresh-cut.png` |
| 6 | Events | bottom nav | AI planner CTA, new-event CTA, unsaved-draft card | **D4** `he-06-events.png` |
| 7 | Projects + pantry inventory | bottom nav | project actions, 24-item raw-material pantry with steppers | **D8, D12** `he-07-projects.png` |
| 8 | More sheet | ☰ | 5-language row, most-used, 4 grouped sections, 27 tools | **D6, D10** `he-08-more-sheet.png`, `v-lang-de-more.png` |
| 9 | Wizard steps 1–6 | FAB / "יש לי אירוע" | basics → dishes → methods → seasonings → sides → review | **D7** `he-09-wizard-step0..5.png` |
| 10 | Shopping cart | `openCart` | 4 selected items + weighted buy list + chosen rubs | works `he-d-61-cart.png` |
| 11 | Scheduler — item view | `openTimeline` | serve date/time, countdown, short-time warning, per-item cards | **D1, D5** `he-21-timeline.png` |
| 12 | Scheduler — work plan | "📋 תוכנית עבודה" | 23 tasks, `יום לפני` day markers, per-task timers, advisories | **D13, D14** `wp-p0..p3.png` |
| 13 | Occupancy | work plan → "🗄️ תפוסת מכשירים" | time scrubber + rack/grate/kettle/bath/oven diagrams, per-device fit verdicts | works, **D15** `he-d-52-occupancy*.png` |
| 14 | Meal builder | `openMenu` | guests, appetite, kosher, dish picker | works `he-22-menu.png` |
| 15 | Equipment manager | `openEquipment` | 9 device cards + add | works `he-23-equipment.png` |
| 16 | Equipment **edit** form | ✎ on a card | category, name, sub-type, capacity, fuel, typed props, advanced | **D2 (top), D16** `he-d-54-equip-edit.png` |
| 17 | Equipment **add** picker + sous-vide form | ＋ הוסף | category chips → typed form with multi-cap (bath sizes) chips | works `he-d-55/56-*.png` |
| 18 | AI hub | `openAiHub` | 5 tools, 4 key-gated (🔒), key CTA | works `v-aihub.png` |
| 19 | Voice-cook mode (real path) | work plan → 🎙️ | 23 tasks, current/next, timer, read-aloud, jump list | **D5** `v-he-voicecook-real.png` |
| 20 | Live copilot | `openCopilot` | now/next cards + timer + voice chip | **D12** `v-he-copilot.png` |
| 21 | Appearance | `openAppearance` | 4 themes, 4 font pairs, 4 text scales, language row | **D17** `v-he-appearance-full.png` |
| 22 | Journal | `openJournal` | empty state pointing at the recipe screen | works `v-journal.png` |
| 23 | Pantry entry | More → "פרויקטים ומזווה" | navigates to Projects | **D18** `v-pantry.png` |
| 24–43 | Active-now, Ask the Fire, Seasonings + detail, Calculators, Woods, Guide, Rescue, About, Key manager, UI level, Behaviour, Backup, Recipe gen, Gear concierge, Reminders, Cut translator, Home customize, Combined timeline, AI event planner, Print menu | More sheet | all open, all render, none throw | works `he-30..49-*.png` |
| 44 | Language switching | pill / more sheet / appearance | he ⇄ en ⇄ fr ⇄ de ⇄ es | **D6** `v-lang-{fr,de,en}-{home,more}.png` |
| 45 | 320×568 | resize | no horizontal overflow (`scrollWidth 320 = clientWidth`) | works `v-320-home.png` |

---

## 2. Defects, ranked

### 🔴 High

**D1 — The serving DATE on the scheduler renders a truncated year: `22/07/202`.**
The `<input type="date">` is 120 px wide; its value is verifiably `2026-07-22` (read back programmatically) but the field paints `22/07/202` — the final digit is eaten by the picker icon. `scrollWidth === clientWidth`, so no DOM-level overflow signal fires; only the pixels show it.
Evidence: `v-date-row.png` (element crop), `v-date-input.png`, `he-21-timeline.png`. This is the single most consequential field on the screen that decides whether a 30-hour cook lands on the right day.

**D2 — English mode destroys the method-toggle labels on every recipe, replacing them with raw internal keys `sv` / `smoke` / `grill`.**
`methodToggleHTML` builds `<button data-mt="sv">🌊 Sous-vide</button>` (app.js:1019). `hydrateMT` (app.js:6989) reads `const src = el._mkMt !== undefined ? el._mkMt : (el.getAttribute('data-mt') || el.textContent || '')` — it treats `data-mt` as *the source text*. Everywhere else `data-mt` is a bare attribute so `getAttribute` returns `""` and it falls back to `textContent`; here the attribute carries a value, so `src = "sv"`, no dictionary hit, and `el.textContent` is overwritten with `"sv"`. **`hydrateMT` returns early when `getLang()==='he'`, which is exactly why Hebrew is unaffected and every other language is broken.** An i18n attribute name collides with a domain attribute name.
Evidence: fresh English boot (lang persisted before first render) → `["sv","smoke","grill"]`; `v-en-fresh-cut.png` shows the three buttons reading `sv`, `smoke`, `grill` under stat cards that correctly read SOUS-VIDE / SMOKE / GRILL.

**D3 — Navigating to Catalog auto-scrolls the search box and the whole catalog header off-screen, while the visible copy tells you to use them.**
`cNavGo('catalog')` calls `main.scrollIntoView({block:'start'})` (app.js:7137). Measured on arrival: `scrollY = 179`, `#q` (search input) top `= −72`, `.cshead` (back button + ☰ menu) top `= −179`. The hero that IS visible reads **"בחר קטגוריה או חפש למעלה"** — "pick a category or search above" — pointing at a control that has just been scrolled out of view, together with the only ☰ entry point on that screen.
Evidence: `he-02-catalog.png`, measurement in §4.

**D4 — The running app still tells users it works with no network.**
The global footer, visible on Events and at the foot of every screen: *"מתכונת · מדריך האש — נבנה מהטבלאות של דודי. **הנתונים מקומיים, ללא חיבור לרשת.** סימוני ה-checklist נשמרים בדפדפן. מהדורה 258 · 22.7.26"*. The sweep README flags this claim in the shipped README; it is also **in the product UI**, one tap from the AI hub that requires a key and a network.
Evidence: `he-06-events.png`.

**D5 — Voice-cook mode's jump list drops the day marker, so a two-day plan reads as scrambled.**
The work-plan view labels cross-day tasks `יום לפני` (`wp-p2.png`) — correct. The voice-cook "🎯 קפוץ לשלב" list prints bare `HH:MM`, producing `04:20 → 05:00 → 12:15 → 11:00 → 12:15 → 12:53`. Verified against `window._wpTasks`: the array **is** monotonic (`inversions: []`); items 0–2 are on day 21 and 3+ on day 22. The data is right; the hands-free surface hides the one field that makes it legible. Related: `openVoiceCook` seeks the current task with `vcTasks.findIndex(t => t.t >= now)` (app.js:5520) — a linear scan that is only correct because the array happens to be sorted.
Evidence: task dump in §4, `v-he-voicecook-real.png`.

**D6 — Three languages are offered in the switcher at ~2 % translation coverage, and the fallback leaks raw Hebrew into an LTR page.**
Build output: `[i18n] de: 83/3985 keys vs en (2%)`, same for `es` and `fr`. The language row (more sheet + appearance + home pill) offers all five equally. French home = French headline + **English** section labels ("Smoker", "Grill", "Low & slow — 105–110°C, oak/hickory smoke", "My gear · change") + **Hebrew** search placeholder rendered right-aligned with the ellipsis on the wrong side + a Hebrew sub-line inside the French "Demandez au Feu" card + "✨ עוד כלי AI". Measured: 9 of 70 visible text nodes on the French home screen are Hebrew.
Evidence: `v-lang-fr-home.png`, `v-lang-de-more.png`, build log.

### 🟠 Medium

**D7 — Wizard step navigation targets are 55 × 7 px.**
The six progress segments are real buttons (`data-cwseg`, click handler at app.js:7156, `aria-label="שלב N: …"`) measuring **55 × 7 px**. Seven pixels tall, in an app used with greasy hands.
Evidence: audit output for `wizard0..5`, `he-09-wizard-step0.png`.

**D8 — A 14 × 20 px destructive delete sits beside 26 × 26 px steppers in the pantry.**
Measured on `#scr-projects`: `cinv-rm "×" 14×20`, `BUTTON "−" 26×26`, `BUTTON "+" 26×26`, `INPUT 52×31`, `cev-act` action chips 33 px tall. The `×` permanently removes an inventory line and is the smallest target on the screen.
Evidence: `he-07-projects.png`, measurement in §4.

**D9 — English catalog cards keep their Hebrew metric line, and the kosher filter reverts to Hebrew on first tap.**
On a **fresh English boot** (language persisted before first render):
* `#count` → `"130 נתחים · 102 מלאכה · 47 מיוחדים"` — hard-coded Hebrew, no `L()` (app.js:1679).
* every card's metric line → `Sous-vide 68°/36ש  Smoking 105°/3ש  95° יעד` and the badges `⏱ חוסך 9ש מעשנת`, `🔨 בנייה מאפס` — hard-coded Hebrew in the card template (app.js:1563–1571).
* kosher chip renders correctly as `"Kosher only"`, then **one real click** turns it into `"✓ כשר בלבד"` permanently — app.js:1705 rewrites `textContent` with a raw Hebrew literal while app.js:1697 built it with `L()`.
Separately, switching language *live* never re-renders the filter bar (`buildFilterBar` is not called from `applyLang`), so the chip is Hebrew from the moment you switch.
Evidence: `en-03-catalog-cuts.png`, `v-en-fresh-catalog.png`, click transcript in §4.

**D10 — Row chevrons never mirror: `←` in LTR too.**
Every `.cmore-item` in the more sheet renders a hard-coded `←`. In Hebrew that correctly points "forward"; in English, German and French it points back toward the left-aligned label. Measured: `['←','←','←','←']` in English.
Evidence: `v-lang-de-more.png`, `v-en-more.png`.

**D11 — The while-cooking controls are the smallest ones in the app.**
Everything a cook touches with wet hands is under the 44 px minimum, while the rarely-used bottom nav is a generous 78 × 70:
| control | size | where |
|---|---|---|
| recipe step checkbox `.cbx` | 26 × 26 | cut detail, cart, work plan |
| timer ▶ / ↻ | 30 × 30 | copilot, work plan |
| voice-mode chip | 105 × 34 | copilot |
| `.mtoggle` method switch | 78 × 39 (46 × 38 in EN) | cut detail |
| "block when short on time" checkbox | **13 × 13** | scheduler |
| occupancy time scrubber | 345 × **16** | occupancy |
| `.eq-iconbtn` ✎ / ✕ | 30 × 30 | equipment cards |
| `.favstar` / `.addcart` | 30 × 30 / 34 × 34 | catalog cards |
| home lane chips | ≥52 × **36** | home |
Evidence: audit output per screen in §4.

**D12 — Live copilot is one screen of content in 844 px of viewport.**
Two cards (now / next) plus a chip, then ~900 px of empty space. No serve countdown, no temperature, no other running timers — all of which exist one screen away in the scheduler. For the screen literally named "your cook in real time" this is the thinnest surface in the app.
Evidence: `v-he-copilot.png`.

**D13 — The work plan says it cannot check capacity, then reports a capacity conflict on the next line.**
Rendered consecutively in the same advisory block:
> 🔧 **ממתין לשיוך מכשיר:** … *לא אוכל לבדוק קיבולת/חפיפות* עד שתשייך כל פריט למכשיר …
> ⚠️ **התנגשות מכשיר:** בריסקט + כתף חזיר *חורגים מהשטח של* אנובה (120 %)
`unresolvedHtml` (app.js:5913) and `contentionHtml` (app.js:5914) render independently with no mutual guard.
Evidence: work-plan text dump in §4.

**D14 — A sous-vide bath's over-capacity is described in Hebrew as an *area* overflow.**
app.js:5920: `L('חורגים מהשטח של', 'exceed the capacity of')`. The English string is dimension-neutral and correct; the **Hebrew** string says "exceed the *area* of", and it fires for a circulator whose capacity the very same feature measures in litres ("האמבט 20 ל׳" in the occupancy card).
Evidence: `wp-p0.png`, app.js:5920 vs app.js:637.

**D15 — Opening the occupancy view lands on an empty rack.**
The scrubber defaults to "now" (08:09 in the run); serving is 19:00 and the first smoker task starts 14:30, so every shelf reads *מדף פנוי* / *רשת פנויה* while each device is stamped "✓ הכל נכנס". The one card with content (the Anova) is three screens down and carries the real information: `⚠ בריסקט מבושל ב-6° מעל הנדרש לו` and `2 שקיות · הגדולה דורשת 24 ל׳ · האמבט 20 ל׳ · אין כלי גדול מספיק`. A default of "the busiest moment" would open on the answer.
Evidence: `he-d-52-occupancy.png` vs `he-d-52-occupancy-s2.png`.

**D16 — The device editor has two cooking-area fields; only one of them is wired to the engine.**
On the same form:
* `#eqvArea`, label **"שטח בישול"**, placeholder `לדוגמה 3700 cm²` — free text, saved to `d.cap.area` (app.js:6552) and consumed **only** by a display chip (app.js:6392).
* `#eqProp-areaCm2`, label **"📐 שטח בישול כולל (ס״מ²)"**, placeholder `6000` — the typed property `devCapacity` actually reads via `propOf(dev,'areaCm2')` (app.js:319) to compute fit, shelves, and every occupancy verdict.
Filling the shorter, plainer-labelled field has zero effect on capacity planning; nothing on screen distinguishes them. Both also render their effective value as a *placeholder*, so a set field and an unset field look alike.
Evidence: field dump in §4, `he-d-54-equip-edit.png`.

**D17 — Default theme is bright cream, with no `prefers-color-scheme` support.**
`PREFS.theme.def = 'cream'` (app.js:6803); `grep -rn "prefers-color-scheme" app.css index.html` → no matches. A dark theme exists and is good (`פחם ולהבה`, body `#17150F` on `#F7ECDB`, `v-he-home-dark.png`) but a user at a smoker at 02:00 gets `rgb(250,236,216)` at full brightness until they find Settings → Appearance. (Contrast itself is fine: default pairing is **8.7:1**.)

### 🟡 Low

**D18 —** "🧫 פרויקטים ומזווה" (Projects **& pantry**) navigates to the Projects screen at `scrollY = 0`; the pantry (מזווה) section is ~800 px below. The label promises a destination the tap does not reach.

**D19 —** `.cnav` is a plain `<div>`: `landmarks.nav = 0`, no `role="navigation"`, and `aria-current` is absent on the active tab (`navAriaCurrent = 0`). Everything else in the a11y probe is clean — `lang=he`/`dir=rtl`, skip link present, exactly one `<h1>`, one `<main>`, `#panel` is `role="dialog" aria-modal="true"`, **Esc closes the panel**, focus enters the panel on Tab, **zero unnamed buttons**, **zero `<img>` without alt**.

**D20 —** The short-time warning is ungrammatical in both languages and reports raw minutes:
`⚠ הזמן קצר — כדי להגיש ב-19:00 היה צריך להתחיל ב-אתמול 05:00 (לפני 1627 דק׳)` — `fmtServe` (app.js:5562) returns `"אתמול 05:00"`, and the template (app.js:5594) prefixes `ב-`, yielding *"at-yesterday 05:00"*; English is the same shape, *"you should have started at yesterday 05:00"*. `1627 דק׳` is 27 hours expressed in minutes.

**D21 —** Every panel carries a "⎙ PDF" print button from the shared `toolTop` header — including the first-run "how much experience do you have?" modal, the More sheet, Settings and the language picker.

**D22 —** "הבא11:00" — the "next" badge and the time run together with no separator in the work plan (`wp-p2.png`).

**D23 —** Projects screen header block: the "פרויקטים פעילים" title wraps to two lines while five action chips wrap raggedly around it across three rows (`he-07-projects.png`). No overflow (`right > innerWidth` check returned `[]`), but the block reads as broken.

**D24 —** The service worker can never register in local testing: `if ('serviceWorker' in navigator && location.protocol === 'https:')` (app.js:9546). `http://localhost` is a secure context where registration is permitted, so this gate is stricter than the platform requires — and it means the SW, the update toast, and the SW-delivered alarms (`mkSWReg`, "fixes the mobile `new Notification()` no-op") are **unexercisable by any local or CI run**. Measured: `navigator.serviceWorker.getRegistrations()` → `0 regs`.

---

## 3. Claims I investigated and **dropped**

Recorded so nobody re-raises them.

1. **"The cut-detail header is bidi-scrambled (`ק״ג 5.5 · Brisket`)."** — **FALSE.** Per-character `Range.getBoundingClientRect()` measurement gives visual L→R `ישוקתמר·ג״קBrisket·5.5`, i.e. the LTR island `Brisket · 5.5` is rightmost and reads correctly, then `ק״ג`, then `רמת קושי`. Renders exactly as authored. My screenshot reading was wrong.
2. **"`24 ל׳` in the occupancy bath line is number/unit-inverted."** — **FALSE.** Visual order `…24׳לתשרודהלודגה…` confirms the `<span dir="ltr">24 ל׳</span>` island (app.js:631) places the number first and the unit after, correctly, inside the RTL sentence.
3. **"The work-plan/voice-cook task list is out of chronological order (11:00 after 12:15)."** — **FALSE as a sort bug.** `window._wpTasks` is monotonic (`inversions: []`); the earlier entries are on the previous calendar day. The real defect is the *missing day marker in voice-cook only* (D5).
4. **"The bottom nav covers the wizard's Save / Voice buttons."** — **FALSE.** At maximum scroll on wizard, home, projects, events and catalog, the set of interactive elements intersecting `.cnav` is empty. The screenshot was mid-scroll.
5. **"Voice-cook mode is a dead end — 'no tasks, go build a plan', with no way there."** — **FALSE via the real path.** `openVoiceCook(tasks)` is only ever called with tasks (app.js:5510, 5767, 7433). Driven properly (work plan → 🎙️) it loads **23 tasks** with timers, read-aloud and jump list. The empty state I first saw came from my own no-arg call.
6. **"The `חסרים` badge overflows the viewport on Projects."** — **FALSE.** Scanning every element in `#scr-projects` for `right > innerWidth` or `left < 0` returned `[]`.
7. **"Flag emoji render as `IL`/`GB`/`DE`."** — **environment, not the app.** Headless Chromium on Windows has no regional-indicator font. Not reported as a defect.
8. **"293 English strings leak into the Hebrew seasonings panel."** — **not a defect.** They are proper names of rubs and sauces (Memphis Dust, Santa Maria, Chesapeake Old Bay) shown as deliberate secondary labels.
9. **English panel bodies are clean.** The 263-node "Hebrew leak" my first scan reported for the English timeline / occupancy / equipment panels was the *catalog screen behind the open panel*. Scoped to `#panel` on a fresh English boot, the cut-detail panel leaks **zero** Hebrew nodes apart from D2's `sv/smoke/grill`.

---

## 4. Raw evidence

**Catalog auto-scroll (D3)** — `cNavGo('catalog')` then measure:
```
{ y: 179, qTop: -72, headTop: -179 }        // scrollY, #q top, .cshead top
```

**Date field (D1)** — `#panel input[type=date]`:
```
{"w":120,"h":44,"sw":118,"cw":118,"val":"2026-07-22"}   → paints "22/07/202"
```

**Fresh English boot, `mk-lang` persisted before first render (D2, D9):**
```
lang at boot        : en store="en" getLang=en
FRESH-EN kosher chip: "Kosher only"
FRESH-EN count      : "130 נתחים · 102 מלאכה · 47 מיוחדים"
FRESH-EN after click: "✓ כשר בלבד"
FRESH-EN mtoggles   : ["sv", "smoke", "grill"]
PANEL heb leak      : []
```

**Task array vs. rendered day markers (D5):**
```
MONOTONIC? {"n":23,"inversions":[]}
 0 04:20|day21  🌶️ הכנת ושפשוף ראבים
 1 05:00|day21  🌊 סו-ויד 68° — בריסקט
 2 12:15|day21  🌊 סו-ויד 74° — כתף חזיר
 3 11:00|day22  🌬️ ייבוש במקרר (ללא כיסוי) — בריסקט
 4 12:15|day22  🌬️ ייבוש במקרר (ללא כיסוי) — כתף חזיר
…22 19:00|day22 🍽️ הגשה
work-plan view : prints "יום לפני" above 0,1,2      ✓
voice-cook list: "04:20 · … / 12:15 · … / 11:00 · …"  ✗ no day
```

**Work-plan advisories, verbatim (D13, D14):**
```
🔧 ממתין לשיוך מכשיר: יש לך יותר ממכשיר אחד מאותו סוג — לא אוכל לבדוק קיבולת/חפיפות
   עד שתשייך כל פריט למכשיר (למעלה). ממתינים: בריסקט (עישון), כתף חזיר (עישון), …
⚠️ התנגשות מכשיר: בריסקט + כתף חזיר חורגים מהשטח של אנובה (120%)
```

**Equipment editor field dump (D16):**
```
SELECT #eqCat          "קטגוריה"                    353×47
INPUT  #eqName         "שם"              val=ארון עישון 321×41
SELECT #eqType         "תת-סוג"                     156×43
INPUT  #eqCapKey       "מדפים/שבכות"      val=4      156×41
SELECT #eqvFuel        "דלק"                        156×43
INPUT  #eqvArea        "שטח בישול"        ph="לדוגמה 3700 cm²"  156×41   ← cap.area, display only
INPUT  #eqProp-areaCm2 "📐 שטח בישול כולל" ph="6000"            156×41   ← areaCm2, drives the engine
INPUT  #eqProp-maxC    "🌡️"               ph="150"             156×41
SUMMARY "⚙️ מתקדם"                                   295×19
```

**Accessibility probe (D19):**
```
{ lang:"he", dir:"rtl", skipLink:true, h1:1,
  landmarks:{main:1, nav:0, header:0},
  navHasRole:"DIV", navAriaCurrent:0,
  unnamedButtons:[], panelRole:"dialog/true", imgNoAlt:0 }
focus after 2× Tab in panel : BUTTON.rm  inPanel=true
panel open after Esc        : false
```

**Language coverage (D6):**
```
build : [i18n] de: 83/3985 keys vs en (2%)   es: 83/3985 (2%)   fr: 83/3985 (2%)
home  : fr → {lang:"fr", dir:"ltr", hebNodes:9,  totalNodes:70}
        de → {lang:"de", dir:"ltr", hebNodes:9,  totalNodes:70}
        en → {lang:"en", dir:"ltr", hebNodes:0,  totalNodes:70}
```

**Environment / hygiene:**
```
default theme  : cream   body rgb(250,236,216) on rgb(90,58,40)  → 8.7:1
dark theme     : פחם ולהבה  rgb(23,21,15) on rgb(247,236,219)
prefers-color-scheme : absent from app.css and index.html
bottom nav     : home/catalog/events/projects 78×70, FAB 78×88
320×568        : scrollWidth 320 = clientWidth 320  (no overflow)
external requests with no AI key : []
service workers registered on http://localhost : 0
console errors across the entire sweep : 0
```
