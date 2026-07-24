# Navigation model audit — where "exit" actually goes

**Date:** 2026-07-24 · **Build audited:** `מהדורה 261` (`dist/index.html`, newer than `app.js` — not stale)
**Method:** Serena static symbol mapping over `app.js` (9,869 lines) + live Playwright at **390 × 844**, RTL, `he-IL`, mobile emulation
**Scope:** report only. **No production code was changed.**
**Owner's report:** *"I have many forms that when exit the app brings me to a place that is not what I would expect — like pop of a stack or go back etc."*

---

## 1 · The answer, in the first ten lines

**The navigation model is three independent, non-communicating layers of CSS class toggles held in plain JavaScript variables, with *zero* browser-history integration.**

- **Layer 1 — screens:** `cNavGo(s)` toggles `.screen.on` across 5 screens; current screen is a bare `let cCurrent`.
- **Layer 2 — panels:** one `#panel` div whose `innerHTML` is *replaced*; `panelStack` holds "reopener" closures.
- **Layer 3 — wizard steps:** `cwGo(n)` toggles `.cwstep.on`; current step is `cWiz.step`.

**Root cause, one sentence:** `closePanel()` — which is bound to the ✕ button, the Escape key **and** the backdrop tap — unconditionally executes `panelStack=[]`, destroying the entire "where I came from" stack rather than popping one entry, and because the app never calls `history.pushState` there is no browser-level history to fall back on, so every exit affordance except one rarely-noticed in-panel button collapses straight to whatever screen happens to be underneath.

**Verified counts:** `pushState` / `replaceState` / `popstate` / `hashchange` occurrences in `app.js`, `app.css`, `index.html` = **0**. `showPanel(` call sites = **76**; `openFrom(` call sites (the only thing that ever pushes a back-target) = **11**, and **one of those 11 is dead code**. `history.length` measured live never leaves **2** through boot → panel open → screen switch → wizard step. Every one of the **27** entries in the ☰ More sheet was opened live: **0** have a back button.

**21 exit paths across 13 surfaces were driven; 18 mismatched.** The 3 that behaved correctly show the model is not uniformly broken — a plain depth-1 panel closing onto an unchanged screen is fine. The failures cluster in exactly three places: **nested** panels, anything that **moves the screen underneath**, and **every** browser/hardware Back or reload.

---

## 2 · Static architecture findings

### 2.1 The three layers

| Layer | Entry point | State variable | Mechanism | History? | Restored on reload? |
|---|---|---|---|---|---|
| Screens | `cNavGo(s)` — `app.js:7434` | `let cCurrent='home'` — `app.js:7433` | toggles `.screen.on` over `CSCREENS=['home','catalog','wizard','events','projects']` (`app.js:7432`) | none | no |
| Panels | `showPanel(html)` — `app.js:2493` | `let panelStack=[]` — `app.js:2492` | replaces `#panel.innerHTML`, adds `.open`, shows `#scrim` | none | no |
| Wizard steps | `cwGo(n)` — `app.js:7461` | `cWiz.step` | toggles `.cwstep.on` | none | no |

Panels are an **overlay** on the screen layer, not a replacement for it. That is why a plain depth-1 panel behaves correctly (see §3, S18) — closing it simply reveals the screen that was always underneath. Everything breaks when something *moves the screen underneath while the panel is open*, or when the panel is more than one level deep.

### 2.2 The stack exists, and every exit affordance but one destroys it

```js
// app.js:2522
function openFrom(reopenCurrent, openNext){ panelStack.push(reopenCurrent); openNext(); }
// app.js:2523
function panelBack(){ const fn=panelStack.pop(); if(fn){clearTimers();fn();} else closePanel(); }
```

`panelBack()` is correct — it pops exactly one entry. But `closePanel()` does this (`app.js:2557`, mid-line):

```js
… vcRec=null;}clearTimers();… panelStack=[];$("#panel").classList.remove("open"); …
```

`panelStack=[]` — the whole stack, discarded. And `closePanel` is what **three of the four** exit affordances are wired to:

| Affordance | Wiring | Calls |
|---|---|---|
| ✕ button | `app.js:2503` — `xb.addEventListener("click",closePanel)` | `closePanel` → **stack destroyed** |
| Backdrop / scrim tap | `app.js:2730` — `$("#scrim").addEventListener("click",closePanel)` | `closePanel` → **stack destroyed** |
| Escape key | `app.js:2731` — `if(e.key==="Escape")closePanel()` | `closePanel` → **stack destroyed** |
| `.backbtn` "→ חזרה לחלון הקודם" | `app.js:2509` — `bb.addEventListener("click",panelBack)` | `panelBack` → **pops one (correct)** |

The one correct affordance is also the least discoverable: it is a text button appended into `.panel-top` and, critically, it is **only rendered when `panelStack.length` is already non-zero** (`app.js:2505`). A panel opened without `openFrom` never shows it at all.

### 2.3 The primary tool launcher deliberately empties the stack before opening

There are two tool launchers in the codebase and they use **opposite** patterns.

`openTools()` (`app.js:7022`) does it correctly — `openFrom(openTools, fn)` at `app.js:7048`, so every tool gets a working back button. **But `openTools` is unreachable dead code**: its only caller is a `typeof showPanel!=='function'` fallback inside `openMoreSheet` (`app.js:9726`) that can never fire, since `showPanel` is always defined.

The launcher that users actually reach is `openMoreSheet()` (`app.js:9724`), wired to the ☰ button (`app.js:9773`). Its dispatch is:

```js
// app.js, inside openMoreSheet
if(typeof window[fn]==='function'){ if(typeof closePanel==='function') closePanel(); setTimeout(()=>window[fn](),60); }
```

It **closes the current panel — wiping the stack — and only then opens the target**. So every tool reachable from ☰ opens with `panelStack.length === 0`, no back button, and a ✕ that exits all the way out. This is the single highest-traffic instance of the owner's complaint, and it was measured exhaustively rather than inferred — see §3.1: **all 27 entries opened, 0 with a back button.**

Two entries in the same menu go further and move the screen underneath:

```js
if(fn==='__gloss'){ closePanel&&closePanel(); cNavGo('catalog'); … }
if(fn==='__about'){ closePanel(); setTimeout(openAbout,60); return; }
```

and `openPantry()` (`app.js:3501`) opens no panel at all:

```js
function openPantry(){
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function'){ cNavGo('projects'); return; }
  …
```

### 2.4 The wizard always exits to home, regardless of entry point

`cwExitWizard()` (`app.js:8346`) ends unconditionally at `app.js:8361`:

```js
cwGo(0); cNavGo('home');
```

There is no `returnTo`, no caller record. Whether the user entered the wizard from home, events, projects or a "resume" card, exit lands on home with the step reset to 0.

### 2.5 Boot always drops to home; nothing is persisted

`app.js:9839`, top level:

```js
try{ cRefreshHome(); cNavGo('home'); }catch(e){ /* headless/init guard */ }
```

There is no persisted view key — no `mk-screen`, `mk-nav` or `mk-view` anywhere in the codebase. `mk-cresume` persists a *draft's* step for the "resume where you left off" card, but nothing restores the **view**. For an installed PWA, where relaunch is the normal way to return to the app, every relaunch starts at home.

### 2.6 One screen has hand-rolled back logic — and it works

The catalog header's `→` button (`app.js:7425`) is the only context-aware back in the app:

```js
if(!activeGroup && !filters.fav && !q){ if(typeof cNavGo==='function') cNavGo('home'); }
else { … setCatNav(null); buildChips(); catView('landing'); }
```

It correctly goes one level up (category → landing → home). It is a bespoke, per-screen implementation that no other screen has, and it is not connected to `panelStack` or to history.

### 2.7 No test in the suite exercises Back

`grep` for `goBack`, `goForward`, `popstate`, `pushState` across `tests/` returns **no matches**. Back-navigation has never been asserted, which is why this survived to production.

---

## 3 · Live observations

**21 exit paths across 13 distinct surfaces. 18 mismatched, 3 behaved as expected.**

Environment: Playwright Chromium, 390 × 844, `isMobile`, `hasTouch`, `he-IL`; served from `dist/` on port **8129** (port 8123 was held by another agent's server — not contended, per §11a). First-run onboarding suppressed by seeding `mk-uilevel-asked`. Every scenario ran in a fresh browser context. Raw records: `docs/analysis/nav-audit/observations{,2,3}.json`.

| # | Entry point | How I got there | Exit method | Where I **LANDED** | Where I **EXPECTED** | Data lost? |
|---|---|---|---|---|---|---|
| S1 | Calculator (`מחשבונים`) | home → ☰ More → מחשבון מלח | ✕ | **home screen**, panel closed, stack 0 | back on the ☰ More sheet | yes — entered weights/diners gone |
| S2 | Calculator | home → ☰ More → מחשבון מלח | **browser Back** | **left the app** (`url=about:blank`) | panel closes, stay in app | yes |
| S3 | Catalog screen | bottom nav → קטלוג | **browser Back** | **left the app** | return to home screen | n/a |
| S4 | Catalog screen | bottom nav → קטלוג | **reload** | **home** screen | still on catalog | n/a |
| S5 | Calculator | ☰ More → מחשבון מלח | **reload** | **home**, panel gone | panel still open | yes |
| S6 | Event wizard, step 3 | bottom nav → wizard → `cwGo(3)` | **reload** | **home, step reset to 0** | wizard still at step 3 | draft position lost |
| S7 | Event wizard, step 3 | bottom nav → wizard → `cwGo(3)` | **browser Back** | **left the app, mid-wizard** | step back to step 2 | yes |
| S8 | Event wizard, step 2 | **events screen** → wizard | exit wizard | **home** | the events screen I came from | — |
| S9 | Shopping cart, nested (stack = 1, back button present) | Meal builder → cart | ✕ | **everything closed**, stack 0 | pop one → Meal builder | cart context lost |
| **S10** | Shopping cart, nested | Meal builder → cart | `.backbtn` "→ חזרה לחלון הקודם" | **Meal builder panel** ✓ | Meal builder | no |
| S11 | Shopping cart, nested | Meal builder → cart | **Escape** | **everything closed** | pop one → Meal builder | yes |
| S12 | Shopping cart, nested | Meal builder → cart | **backdrop tap** | **everything closed** | pop one → Meal builder | yes |
| S13 | Projects & pantry | home → ☰ More → פרויקטים ומזווה | (nothing to exit) | **teleported to the projects screen**; no panel ever opened, ☰ sheet vanished | a panel over home | — |
| S14 | Glossary | home → ☰ More → מילון | (nothing to exit) | **teleported to the catalog screen** | a panel over home | — |
| S16 | Reminders form (`תזכורות`) | ☰ More → תזכורות | ✕ after typing | home; on reopen the field is **empty**, **no warning shown** | warn, or preserve the draft | **yes, silently** |
| S17 | (instrumentation) | boot → ☰ → panel → screen switch → wizard step | — | `history.length` **2 → 2 → 2 → 2 → 2** | each state pushes an entry | — |
| **S18** | Item recipe panel (`בריסקט`) | catalog → בשר אדום → card | ✕ | **catalog category view** ✓ | catalog category view | no |
| **S19** | Catalog category view | catalog → בשר אדום | in-header `→` | **catalog tile landing** ✓ | one level up | no |
| S20 | Catalog category view | catalog → בשר אדום | **browser Back** | **left the app** | up to the tile landing | n/a |
| S21 | Item recipe panel | catalog → בשר אדום → card | **browser Back** | **left the app** | panel closes, stay on catalog | n/a |
| S22 | Catalog category view | catalog → בשר אדום | **reload** | **home** | still in בשר אדום | n/a |

The three ✓ rows are the model working: a depth-1 overlay closing back onto an unchanged screen (S18), the bespoke catalog back button (S19), and the one correct stack affordance (S10).

### 3.1 Exhaustive sweep of the ☰ More sheet — every entry, opened live

To avoid generalising from a single sample, **all 27 unique targets** in the ☰ More sheet were opened in a fresh context and probed (`scratch/nav-verify-moresheet.mjs`):

```
TOTALS: opened_a_panel_with_back_button=0
        panel_but_NO_back_button=24
        no_panel_at_all=3
        screen_moved_off_home=2
```

**Zero of 27** entries produce a back button; all 24 that open a panel do so at `panelStack.length === 0`. The three that open no panel at all:

| Target | Result |
|---|---|
| `openPantry` | **screen teleported to `projects`** — no panel (G-N4) |
| `__gloss` (מילון) | **screen teleported to `catalog`** — no panel (G-N4) |
| `openMenuPrint` | no panel, stayed on home — benign: the menu is empty, so it toasts instead (not a navigation defect) |

This converts G-N3 from an architectural inference into a measured property of every reachable entry.

### Screenshots — committed to `docs/analysis/nav-audit/`

*(Working copies were written to `.superpowers/sdd/nav-audit/` during the run; that tree carries a local
`.gitignore` of `*`, so the cited evidence is mirrored to `docs/analysis/nav-audit/` to be committed
alongside this report. Raw records: `observations.json`, `observations2.json`, `observations3.json`.)*

- **`s9-nested-cart-has-backbtn.png`** — the clearest single image of the defect. The panel top carries **two exit affordances side by side**: a large circled **✕** (top-left, the conventional, visually dominant target) and a text button **"→ חזרה לחלון הקודם"**. They do different things. ✕ destroys the stack and drops to home; the text button correctly pops one. One-handed with greasy hands, the user hits ✕.
- **`s1-calc-open-no-backbtn.png`** — the same Calculator opened from ☰: **no back button at all**, ✕ is the only exit, and it goes to home rather than the ☰ sheet. The form has live inputs (1000 g, 4 diners) that are discarded.
- **`s13-pantry-teleported-screen.png`** — tapping a "tool" in the ☰ sheet replaced the entire app view with the projects screen; the bottom-nav highlight has moved to פרויקטים and there is no panel and no ✕ to undo it.
- **`s14-glossary-teleported-to-catalog.png`** — same pattern, landing on catalog.
- **`s8-wizard-exit-from-events.png`** — wizard entered from the events screen, exited; bottom nav shows **בית** (home) active, not אירועים.
- **`s6-wizard-step3-before-reload.png`** / **`s6-wizard-after-reload.png`** — step 3 before, home at step 0 after.
- **`s18-item-panel-over-catalog.png`** — the positive control; a well-behaved depth-1 overlay.
- `s2-`, `s3-`, `s7-`, `s20-`, `s21-after-browser-back*.png` — blank pages; the app is gone.

---

## 4 · Proposed gap entries

### G-N1 · No browser-history integration at all — Back exits the installed PWA from any state

**Severity:** 🔴 P0 — on an installed PWA the hardware Back button is primary navigation.

The app never calls `history.pushState`/`replaceState` and never listens for `popstate`. Measured: `history.length` stays at **2** across boot, opening a panel, switching screens and advancing the wizard (S17). Because the app occupies exactly one history entry, Back has nothing in-app to return to.

**Reproduction:** load the app at 390 × 844 → ☰ → מחשבון מלח → press browser/hardware Back → the app is gone (`about:blank`). Identical from the catalog screen (S3), from a drilled-in category (S20), from an item panel (S21) and from wizard step 3 (S7).

**Evidence:** `grep -n "pushState\|replaceState\|popstate\|hashchange" app.js app.css index.html` → 0 matches. Screenshots `s2-`, `s3-`, `s7-`, `s20-`, `s21-after-browser-back*.png`.

> **Precision note:** the observation is *"the app holds exactly one history entry, so Back leaves it"*. In the Playwright harness that surfaces as `about:blank`. On a real Android installed PWA the same single-entry condition closes or backgrounds the app. The single-entry fact is measured; the exact Android chrome behaviour was **not** tested on a device.

---

### G-N2 · `closePanel()` destroys the whole panel stack instead of popping one level

**Severity:** 🔴 P0 — this is the literal "pop of a stack" the owner described.

`closePanel()` executes `panelStack=[]` (`app.js:2557`). It is bound to ✕ (`app.js:2503`), the backdrop (`app.js:2730`) and Escape (`app.js:2731`). Only `.backbtn` → `panelBack()` pops correctly. So of four exit affordances on a nested panel, three collapse the entire stack and one behaves properly — and the properly-behaving one is a small text button next to a large, conventional ✕.

**Reproduction:** open the Meal builder, then the Shopping cart from inside it (a real `openFrom(openMenu, openCart)` path). Observe `panelStack.length === 1` and the "→ חזרה לחלון הקודם" button present. Press **✕** → both panels close and you are on home (S9). Repeat pressing **Escape** (S11) or tapping the **backdrop** (S12) → same. Press the **back button** instead → correctly returns to the Meal builder (S10).

**Evidence:** `s9-nested-cart-has-backbtn.png`, `observations.json` S9–S12.

---

### G-N3 · The primary tool launcher (☰ More) wipes the stack before opening, so no tool has a back button

**Severity:** 🔴 P0 — highest-traffic instance. **Measured across all 27 ☰ entries: 0 have a back button, 24 open a panel at stack depth 0.**

`openMoreSheet` dispatches with `closePanel(); setTimeout(()=>window[fn](),60)` (`app.js`, in `openMoreSheet`). Every tool therefore opens at `panelStack.length === 0`, which suppresses the back button entirely (`app.js:2505` gates it on `panelStack.length`). Meanwhile `openTools()` (`app.js:7022`), which *does* use `openFrom(openTools, fn)` at `app.js:7048`, is **unreachable dead code** — its only caller is an impossible `typeof showPanel!=='function'` fallback at `app.js:9726`.

**Reproduction:** home → ☰ → מחשבון מלח/כמויות. Observe no `.backbtn` in the panel top and `panelStack.length === 0`. Press ✕ → lands on the home screen, not the ☰ sheet (S1). The same holds for every other ☰ entry — see the exhaustive table in §3.1.

**Evidence:** `s1-calc-open-no-backbtn.png`; §3.1 sweep (`scratch/nav-verify-moresheet.mjs`). Contrast `s9-nested-cart-has-backbtn.png`, where the same chrome *does* carry a back button.

---

### G-N4 · Some "tools" teleport the whole screen instead of opening a panel

**Severity:** 🟠 P1 — breaks the user's mental model of what a menu entry does; the exit has no inverse.

`openPantry()` (`app.js:3501`) runs `closePanel(); cNavGo('projects'); return;` — it opens no panel. The `__gloss` branch of `openMoreSheet` runs `closePanel(); cNavGo('catalog')`. The user taps an item in a menu and the entire app view changes underneath them, with the menu gone and no ✕ or back affordance to reverse it.

**Reproduction:** home → ☰ → 🧫 פרויקטים ומזווה → you are on the projects screen, `cCurrent==='projects'`, no panel open, bottom-nav highlight moved (S13). Same via 📖 מילון → catalog (S14).

**Evidence:** `s13-pantry-teleported-screen.png`, `s14-glossary-teleported-to-catalog.png`.

---

### G-N5 · The event wizard always exits to home, discarding the entry point

**Severity:** 🟠 P1 — the mid-wizard exit the owner called out as hurting most.

`cwExitWizard()` ends with `cwGo(0); cNavGo('home')` (`app.js:8361`) unconditionally. No `returnTo` is recorded anywhere.

**Reproduction:** bottom nav → אירועים (events screen) → bottom nav → wizard → advance to step 2 → exit the wizard → you land on **home**, not events (S8).

**Evidence:** `s8-wizard-exit-from-events.png`.

---

### G-N6 · No view is restored on reload or PWA relaunch

**Severity:** 🟠 P1 — for an installed PWA, relaunch is the normal re-entry path.

Boot runs `cRefreshHome(); cNavGo('home')` unconditionally (`app.js:9839`). No screen/panel/step key is persisted (no `mk-screen`/`mk-nav`/`mk-view` exists). `mk-cresume` stores a draft's step for the resume card but never restores the view.

**Reproduction:** drill into catalog → בשר אדום → reload → home (S22). Open any panel → reload → panel gone (S5). Wizard at step 3 → reload → home at step 0 (S6).

**Evidence:** `s6-wizard-step3-before-reload.png` vs `s6-wizard-after-reload.png`.

---

### G-N7 · Unsaved form input is discarded silently, with no warning

**Severity:** 🟠 P1.

**Reproduction:** ☰ → תזכורות → type `בדיקת ניווט 123` into the text field → press ✕. No confirm dialog appears (neither a native dialog nor the app's own `appConfirm`). Reopen תזכורות → the field is empty (S16).

Note the wizard *does* have a proper 3-way guard (`cwExitWizard`, `app.js:8349-8355`: save & exit / discard & exit / stay). That protection is specific to the wizard draft and does not extend to ordinary panel forms.

---

### G-N8 · Escape and backdrop tap are not distinguished from "close everything"

**Severity:** 🟡 P2 — subsumed by G-N2's fix, recorded separately because it is a distinct affordance.

Both are conventionally "dismiss the top layer". Here both call `closePanel` and collapse the whole stack (S11, S12). On touch the backdrop is very easy to hit accidentally one-handed.

---

### G-N9 · No test anywhere asserts back-navigation

**Severity:** 🟡 P2 — the reason this survived.

`grep` for `goBack|goForward|popstate|pushState` across `tests/` → no matches. Every gap above is currently invisible to the suite.

---

## 5 · Design options

### Option A — Real history integration: one `history.pushState` per navigable state, one `popstate` handler

Introduce a single navigation controller. Each of the three layers pushes a state object on entry (`{screen}`, `{screen, panel, args}`, `{screen:'wizard', step}`), and a single `popstate` listener restores the state it is handed rather than mutating anything itself. `closePanel`'s ✕/Escape/backdrop bindings become `history.back()`; the real closing happens in the `popstate` handler.

- **Blast radius:** large but *concentrated*. The 76 `showPanel` call sites do **not** all need editing — `showPanel`, `closePanel`, `panelBack`, `cNavGo` and `cwGo` are five funnel functions that every path already goes through, so the push/pop logic lands in ~5 places. What *does* need per-site work is making panels **re-openable from a serialized descriptor**, because `popstate` must reconstruct a panel from data, not from a captured closure. Today `panelStack` stores closures, which cannot survive a reload; a descriptor registry (`{fn:'openCut', args:['brisket']}`) would have to be introduced and every panel opener given a stable name + serializable args. That is the real cost, and it is what makes reload-restore (G-N6) possible at all.
- **Risk:** medium-high. Double-handling is the classic trap — a `popstate` handler that also calls `closePanel` which itself calls `history.back()` will loop. Needs a re-entrancy guard. Also interacts with `exitApp` and the two `location.href='product.html'` navigations, which are genuine page loads.
- **What it breaks:** the `panelStack`-of-closures design is replaced. Any panel whose state is genuinely non-serializable (mid-AI-stream panels, `openVoiceCook` with a live task array) needs an explicit "not restorable, fall back to its parent" rule.
- **What it buys:** fixes G-N1, G-N2, G-N3, G-N5, G-N6, G-N8 together, and is the only option that makes the Android hardware Back button correct.

### Option B — Lightweight: fix the stack semantics and add a `returnTo`, no history

Keep everything in memory. Three changes: (1) ✕/Escape/backdrop call `panelBack()` instead of `closePanel()`, so they pop one level and only close when the stack is empty; (2) `openMoreSheet` uses `openFrom(openMoreSheet, fn)` instead of `closePanel()`-then-open; (3) `cwExitWizard` and the screen-teleporting tools record the screen they came from and return to it.

- **Blast radius:** small and surgical — roughly 6 edits, all in funnel functions (`app.js:2503`, `2730`, `2731`, the `openMoreSheet` dispatch, `app.js:8361`, `openPantry`). No new architecture, no serialization work.
- **Risk:** low. The main care point is that ✕ must still fully close from depth 0 (`panelBack` already does exactly this — `if(fn){…} else closePanel();`), and `closePanel`'s teardown side-effects (`speechSynthesis.cancel`, `gemStop`, `clearTimers`, `serveIv`) must still run when the stack finally empties.
- **What it breaks:** very little. Users who currently rely on ✕ as "get me out of everything" would need repeated presses; that is arguably the correct behaviour, but it is a behaviour change worth a mockup (§10.9).
- **What it does NOT fix:** **G-N1 entirely** — the hardware Back button still exits the app from every state, and G-N6 (reload restore) is still impossible because closures cannot be serialized.

### Option C — Recommended: B first, then A

**Do Option B as an immediate P0 fix, then Option A as the structural follow-up.**

Reasoning: B is ~6 surgical edits in funnel functions and removes the *most frequent* daily pain — the ✕ that throws you home from a nested panel, the ☰ tools with no back button, the wizard exiting to the wrong screen. It is independently shippable, testable, and low-risk, and it does not have to be undone by A: making ✕ mean "pop one" is precisely the semantic A also needs, so B is a strict subset of A's behaviour contract, not throwaway work.

A is then the correct destination, because **B leaves the owner's worst case untouched**: this is an installed PWA and the hardware Back button still quits the app mid-wizard. But A requires introducing a serializable panel-descriptor registry across many openers, which is a genuine design change deserving its own spec and a mockup — not something to bolt on during a bug fix.

Sequencing note: A's descriptor registry is also the only route to G-N6 (restore view on relaunch), so if the owner ranks "relaunching the PWA should put me back where I was" as important, A moves up.

---

## 6 · What a Playwright test must assert

Correct back-navigation is testable with real assertions, not proxies. For each:

**For G-N1 (history integration).** Assert `history.length` **increases** when a panel opens and when a screen changes — currently pinned at 2. Then `page.goBack()` and assert the app is **still loaded** (`page.url()` unchanged, `#panel` present in the DOM) and that the panel closed: `expect(panelOpen).toBe(false)` while `cCurrent` is unchanged. The decisive assertion is *"we did not navigate away"* — today that fails because the page becomes `about:blank`.

**For G-N2 (pop one, not all).** Build a real nested pair via the app's own path (Meal builder → cart, which uses `openFrom`). Assert at depth: `panelStack.length === 1` and `.backbtn` visible. Then click `.x` and assert **`#panel` still has `.open`** and its `h2` reads the *parent* panel's title (`בונה תפריט לאירוח`), with `panelStack.length === 0`. Assert the same three ways: ✕, `Escape`, and `#scrim` click — all three must land identically. This is a behavioural assertion on rendered output (the panel heading), not on an internal counter.

**For G-N3 (☰ tools get a back button).** From home → ☰ → any tool, assert `.backbtn` is **visible** and that clicking it renders the ☰ sheet's own heading (`עוד`) again.

**For G-N5 (wizard returns to its entry point).** Parameterise over entry screens: enter the wizard from `events`, from `projects`, from `home`; exit; assert `cCurrent` equals the entry screen and that the corresponding `.cnav button[data-cnav=…]` carries `.on`. The bottom-nav highlight is the user-visible consumer, so assert that rather than the variable alone.

**For G-N6 (restore on relaunch).** Drill into catalog → בשר אדום, reload, assert the category heading is still rendered. Same for wizard step: reload and assert the step label `שלב 3/…` is still displayed.

**For G-N7 (no silent loss).** Type into a panel form, press ✕, assert **either** a confirm dialog is visible **or** reopening the panel shows the typed value. Assert the negative too: a form with *no* changes must close without prompting.

**Regression guard.** Add a standing assertion that `history.length > 2` after any navigation, so the zero-history condition cannot silently return.

All of the above must wait on conditions (`waitForFunction` on `#panel.open`, on the heading text), never `waitForTimeout` — the exploratory scripts in `scratch/nav-audit*.mjs` use fixed waits because they are throwaway probes, and that pattern must **not** be carried into the suite (DoD 11).

---

## 7 · What I could NOT verify

- **Real Android hardware Back on an installed PWA.** I measured the load-bearing fact — the app holds exactly one history entry — in desktop Chromium under Playwright mobile emulation. I did **not** run on a physical Android device or in an installed WebAPK, so the precise chrome behaviour (close vs. background vs. system back-stack interaction) is inferred from the single-entry condition, not observed. The single-entry measurement itself is solid.
- **Nested seasonings sub-panel from a catalog item (S23/S24).** Planned as a second nested `openFrom` probe, but the first item panel reached (`בריסקט`) contains no `[data-seas]` element, so the flow was never entered. **Not counted** in the tallies. The `openFrom` sites at `app.js:1245`, `1249`, `1282` and `2197` are therefore verified statically only.
- **The remaining `openFrom` paths** — timeline → voice cook (`app.js:6039`), timeline → burger builder (`6336`), timeline → pantry (`6352`) — were not driven live; they need a populated timeline, which needs a built menu. Their behaviour is asserted from code reading only.
- **Equipment setup (`openEquipment`, `openGearConcierge`) as a multi-step flow.** Reachable from ☰ and so covered by G-N3 as a launcher-level finding, but I did not walk its internal steps to check for a per-step back model of its own.
- **AI panels mid-stream** (`openCopilot`, `openVoiceCook`, `openDiagnoseAI`, `openRecipeGen`). These need a Gemini key, which is deliberately not in the repo. Whether an in-flight AI request is cancelled cleanly on a mid-stream exit is **unverified** — `closePanel` does call `gemStop()` and `speechSynthesis.cancel()`, which suggests it is handled, but I did not observe it.
- **Panels not reachable from ☰.** The ☰ More sheet is now covered exhaustively (all 27 entries, §3.1), as are the 5 bottom-nav screens, the catalog drill-down and the wizard — 13 distinct surfaces in total. But with **76 `showPanel` call sites**, panels reached from *inside* other panels (deep timeline branches, equipment sub-forms, AI result panels) were not all opened. The architectural findings (G-N1, G-N2, G-N3) are properties of the shared funnel functions — `showPanel`, `closePanel`, and the ✕/Escape/scrim bindings — and therefore hold for all 76 sites regardless of which I visited; the per-screen findings (G-N4, G-N5) are claimed **only** for the specific sites named.
- **`exitApp` and the `location.href='product.html'` transition.** These are genuine page navigations that *do* create history entries, so their Back behaviour differs from everything else here. One of the two call sites (`app.js:7037`) is inside the dead `openTools`; the live one is `#aboutTop` (`app.js:7057`), which `index.html:1888` declares as an **empty** `<button>` with no label — I did not establish whether it is visible or reachable at all. Untested either way.

---

## Appendix — reproduction harness

- `scratch/nav-audit.mjs` — scenarios S1–S17
- `scratch/nav-audit2.mjs` — S18–S23 (first attempt; S18/S21/S23 selector-blocked)
- `scratch/nav-audit3.mjs` — corrected S18, S21, S23, S24
- `scratch/nav-verify-moresheet.mjs` — the exhaustive §3.1 sweep of all 27 ☰ entries
- `scratch/nav-recon.mjs`, `scratch/nav-probe-catalog.mjs`, `scratch/nav-probe-item.mjs` — DOM reconnaissance

Run with the server helper on a non-colliding port:

```bash
python <webapp-testing>/scripts/with_server.py --server "node serve.js 8129" --port 8129 -- node scratch/nav-audit.mjs
```

These are **exploratory probes, not suite tests** — they use fixed waits and read internals via `eval` of top-level `let` bindings. They are evidence-gathering instruments for this report and must not be promoted into `tests/` as-is.
