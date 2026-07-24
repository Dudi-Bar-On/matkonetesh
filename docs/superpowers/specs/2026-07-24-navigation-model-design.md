# Navigation model — design spec

> # DRAFT — awaiting owner approval
> Per `docs/process/development-discipline.md` **§10.9**, no production code is written for this until the
> owner has seen the mockup and approved this document. **No production code was written for this draft.**
> Mockup: `docs/analysis/nav-audit/navigation-mockup.html` (open it at 390 × 844).
>
> **§4 Waiver Gate notice:** §7.2 contains **one reinterpretation of owner decision D5** and **§7.1 a
> second-order consequence of D6**. Both are raised here *and must be raised in conversation* — they are
> listed first in §12 (self-review) precisely so they are not inherited silently.

**Date:** 2026-07-24 · **Baseline build:** `מהדורה 262` (app.js @ `c803c1b`) · **Author:** design agent
**Supersedes nothing.** **Depends on:** `docs/analysis/2026-07-24-navigation-model-audit.md` (root cause,
not re-tested here) and `docs/analysis/program/DECISIONS-2026-07-24.md` **D4-A · D5-A · D6-A**.
**Scope:** design only — inventory, model, migration path, test contract. No code, no `tests/`, no `evals/`.

---

## 1 · The one-paragraph problem

The audit established the root cause and this spec does not re-litigate it: navigation is **three
independent, non-communicating layers of CSS class toggles held in plain JS variables** (`cCurrent`,
`panelStack`, `cWiz.step`), with **zero** browser-history integration (`pushState`/`replaceState`/
`popstate`/`hashchange` occurrences in `app.js` + `app.css` + `index.html` = **0**, re-verified for this
draft), and `closePanel()` — bound to the ✕, Escape **and** the backdrop tap — running `panelStack=[]`,
destroying the whole came-from stack instead of popping one entry. The app occupies exactly **one**
history entry, so hardware Back quits it from any state.

**What this spec designs:** the audit's Option A destination — real `history.pushState`/`popstate`
integration, which requires replacing `panelStack`'s closures with a **serializable panel-descriptor
registry**, so a view is identified by *data* and can be rebuilt from a history entry or a URL.

---

## 2 · PART 1 — the complete surface inventory

### 2.1 Headline, honestly

> **The app has 74 navigable surfaces. The audit drove exit paths on 13 of them.**
> The "18 of 21 exits mismatched" figure is therefore a sample over **18 %** of the surface area — it is
> not an over-estimate, it is an under-measurement. **32 of the 57 panel surfaces cannot be reached from
> the ☰ More sheet at all** and were never opened by the audit.

| | Count | Audit status |
|---|---|---|
| Panel surfaces (render into `#panel`) | **57** | 25 opened via the ☰ sweep; ~5 exit-tested; **32 unreachable from ☰, never opened** |
| Screens (`cNavGo`, `CSCREENS`) | **5** | all 5 opened; 3 exit-tested |
| Wizard steps (`cwGo`, `CW_STEPS=6`; 5 visible in cook mode) | **6** | 2 exit-tested |
| Catalog view modes (`catView`: landing/cat/fav/search/gloss) | **5** | 3 exit-tested (landing, cat, gloss) |
| Modal-dialog layer (`appDialog` → confirm / prompt / danger) | **1** (3 shapes) | **not identified by the audit at all — a 4th overlay layer** |
| **Total** | **74** | **13 exit-tested (18 %)** |

Two further corrections to the audit's picture, both from code:

- **There are FOUR tool launchers, not one.** The audit measured the ☰ More sheet. Three others exist.
- **The `closePanel()`-then-open bug appears in TWO live launchers, not one.** `openAiHub` has the
  identical dispatch (`closePanel(); setTimeout(()=>window[fn](),60)`, `app.js:9754-9755`) and is itself
  reached *from* ☰ — so ☰ → 🤖 כלי AI → 📸 ניתוח תמונה puts the user **two levels deep with zero back
  affordance and two destroyed stack frames**. The audit's G-N3 named `openMoreSheet` only.

### 2.2 The four launchers

| Launcher | Entry | Slots | Dispatch | Stack behaviour |
|---|---|---|---|---|
| ☰ More sheet · `openMoreSheet` (`app.js:9827`) | ☰ button | **27** (4 groups + a 5-slot "most used" row) | `closePanel(); setTimeout(()=>window[fn](),60)` | **wipes the stack** (G-N3) |
| Home dock · `dockTools` (`app.js:7958`) + `DOCK_POOL` (`7944`, 11 tools) / `DOCK_DEFAULT` (4) | home screen tiles, `[data-hfn]` (`app.js:7996`) | **11** pool / 4 shown | `window[fn]()` — bare call | **no `openFrom`, no `closePanel`** → opens at depth 0, no back button. **Not in the audit** |
| AI hub · `openAiHub` (`app.js:9743`) + `AI_TOOLS` (`9735`) | ☰ → כלי AI, home AI card | **5** | `closePanel(); setTimeout(…,60)` | **wipes the stack, from a panel that was itself opened from ☰** — the two-level loss above. **Not in the audit** |
| `openTools` (`app.js:7124`) | *nothing* | **15** | `openFrom(openTools, fn)` — **the correct pattern** | correct, and **unreachable dead code** (D5) |

**58 launch slots across 4 launchers; 3 are live; 0 of the 3 live ones produce a working back button.**

### 2.3 Counting method (so the number can be audited)

- Derived from **code**, not clicking: Serena `get_symbols_overview` + `find_symbol` over `app.js`
  (9,969 lines at `c803c1b`), plus a deterministic call-site→enclosing-function mapping script.
- **`showPanel(` call sites = 76** (unchanged from the audit). Minus the declaration line = **75 distinct
  rendered panel views**. Those 75 views are folded into **57 surfaces** by three rules, applied once:
  1. **A transient view of the same flow is not a separate surface** — a loading / error / result view
     rendered by the same flow counts with its entry point (e.g. `openDiagnoseAI` form → `runDiagnose`
     spinner → `diagnoseRender` result = **1** surface, 3 views).
  2. **One surface rendered from several places is one surface** — the seasoning-detail panel is rendered
     at `1244` (`wireSeasPicker`), `1284` (`openSeasoningDetail`) and `2199` (inside `openCut`) = **1**.
  3. **Internal step-views of one function are counted as sub-views** — `openEquipment` has **5**
     `showPanel` calls (`6787` intro · `6810` list · `6834` accessories sheet · `6880` device form ·
     `7056` a fifth sheet) = **1** surface, 5 sub-views, and it is called out separately in §8 because
     those sub-views are **not addressable** today.
- Screens from `CSCREENS` (`app.js:7535`), wizard steps from `CW_STEPS=6` (`7552`), catalog modes from
  `catView` (`1801`), the dialog layer from `appDialog` (`2527`).

### 2.4 The 57 panel surfaces

**Columns.** *Opened from* — the real trigger, from code. *Nests* — does it arrive via `openFrom`
(so a back button renders)? *On close* — what ✕/Escape/backdrop do today. *Unsaved* — transient in-DOM
input the user can lose (`<input>/<textarea>/<select>` in the panel, with no per-keystroke `store.set`).
*Audit* — ☰ = opened in the audit's §3.1 sweep, **X** = exit-tested live, — = never opened.
*Class* — descriptor class per §5.3: **A** zero-arg · **B** string/number args · **C** object arg
resolvable to a stable key · **D** derived/live/AI state (not reconstructible) · **E** must never restore.

| # | Surface | Opener (args) | Opened from | Nests | On close | Unsaved | Audit | Class |
|--:|---|---|---|:--:|---|:--:|:--:|:--:|
| 1 | Item recipe — cut | `openCut(c)` `2064` | catalog card, `_openItemByKey`, search, wcim | via `openFrom` for its seasoning sub-panel (`2197`) | ✕ → close all | — | **X** (S18/S21) | **C** |
| 2 | Item recipe — special | `openSpec(s)` `2416` | catalog card, `_openItemByKey` | no | ✕ → close all | — | — | **C** |
| 3 | Item recipe — make | `openMake(id)` `2474` | catalog card, `_openItemByKey`, wcim | no | ✕ → close all | — | — | **B** |
| 4 | AI-recipe meta panel | `openMakeMeta(meta)` `9010` | "my recipes" rows (`9041`, `9219`), after save (`9002`) | no | ✕ → close all | — | — | **C** |
| 5 | Seasoning list | `openSeasonings(presetCat, ctxKey)` `1271` | ☰, dock, `openTools` | no | ✕ → close all | — | ☰ | **B** |
| 6 | Seasoning detail | `openSeasoningDetail(id, backCat)` `1280` (+ `1244`, `2199`) | seasoning list, item panel `[data-seas]` | **yes** — `openFrom` ×3 | ✕ → close all (`panelBack` correct) | — | — (S23 blocked) | **B** |
| 7 | Salt / quantity calculator | `openCalc()` `1985` | ☰, dock, `openTools` | no | ✕ → close all | **yes** (select + `calcBoxHTML`/`servingsCalcHTML` inputs) | **X** (S1/S2/S5) | **A** |
| 8 | Shopping list (cart) | `openCart()` `2645` | ☰, meal builder (`5124` `openFrom`), `openTools` | **yes** from the builder | ✕ → close all | — (writes `mk-menu` on change) | **X** (S9–S12) | **A** |
| 9 | Meal builder (legacy) | `openMenu()` `5007` | ☰ "בונה ארוחה"; comment at `5012` calls it **retired as an entry point** | parent of #8 | ✕ → close all | — | ☰ | **A** |
| 10 | Print menu | `openMenuPrint()` `5015` | ☰, events screen (`8440`) | no | ✕ → close all | — | ☰ (toasted — menu empty) | **A** |
| 11 | Timeline scheduler | `openTimeline(focus)` `5145` | ☰, builder (`5127`), copilot, home | parent of #12/#26/#43 via `openFrom` | ✕ → close all | — (`tlState` persisted) | ☰ | **B** |
| 12 | Voice cook | `openVoiceCook(tasks)` `5892` | timeline (`6142` `openFrom`), copilot (`5885`), `7840` | **yes** from timeline | ✕ → `gemStop`+`speechSynthesis.cancel`, close all | live session | — (no key) | **D** |
| 13 | Live copilot | `openCopilot()` `5842` | `5732`, home active card; **self-re-renders** on every probe/target edit | no | ✕ → close all | **yes** (2 inputs) | — | **D** |
| 14 | Occupancy view | `openOccupancyView(computed, serve, scope)` `714` | timeline (`6428`) — args are a **computed plan** | no | ✕ → close all | — | — | **D** |
| 15 | Combined timeline (all events) | `openCombinedTimeline()` `8369` | dock, events screen (`8422`) | no | ✕ → close all | — | — | **A** |
| 16 | Cross-event cart | `openCrossEventCart()` `8316` | events screen (`8373`, `8421`); 2 views (empty/list) | no | ✕ → close all | — | — | **A** |
| 17 | Active now | `openActive()` `8097` | ☰, home active FAB | **no** — and it moves the **screen** underneath (`8140`: `cNavGo('projects')` with the panel still open) | ✕ → close all | — | ☰ | **A** |
| 18 | Reminders | `openReminders()` `3553` | ☰, `openTools` | no | ✕ → close all | **yes, silently** (2 inputs) | **X** (S16) | **A** |
| 19 | Journal | `openJournal()` `3638` | ☰, dock, `openTools` | no | ✕ → close all | — | ☰ | **A** |
| 20 | Journal insights (AI) | `openJournalInsights()` `9074` → `journalInsightsRender(res)` `9062` | journal (`3647`), AI hub | no | ✕ → close all | — | — | **D** |
| 21 | Cut translator | `openCutTrans()` `3736` | ☰, dock, `openTools` | no | ✕ → close all | — | ☰ | **A** |
| 22 | Wood & charcoal guide | `openWoods(focusCat)` `3763` | ☰, dock, `openTools` | no | ✕ → close all | — | ☰ | **B** |
| 23 | Pantry (legacy panel) | `openPantry()` `3511` | ☰, dock, timeline (`6455` `openFrom`), `openTools` | irrelevant | **returns before rendering** — `cNavGo('projects')` at `3514`; **lines 3515-3548 are dead code** | — | **X** (S13) | **E** |
| 24 | Projects — new project picker | `openProjectPicker()` `9356` | projects screen (`9180`), home path (`9920`) | no | ✕ → close all | **yes** (1 input) | — | **A** |
| 25 | Project wizard | `openProjectWizard(meta)` `9587` | item panel (`3411`), wcim (`8626`), advisor (`8682`), `9018` | no | ✕ → close all | mid-create | — | **C** |
| 26 | Burger builder | `openBurgerBuilder()` `9462` | item panel (`3412`), timeline (`6439` `openFrom`), wizard (`7726`); **self-re-renders** per edit (`9500`) | **yes** from timeline | ✕ → close all | **yes** (1 input; `saveBurgerDiners` on commit) | — | **A** |
| 27 | Bought → store picker | `openBuyStorePicker()` `9365` | projects screen (`9184`) | no | ✕ → close all | **yes** (1 input) | — | **A** |
| 28 | Project cart | `openProjectCart(p)` `9329` | projects screen (`9234`); **self-re-renders** per checkbox (`9350`) | no | ✕ → close all | — (checkboxes persisted) | — | **C** |
| 29 | Pantry shopping | `openPantryShop()` `9269` | projects screen (`9243`); **self-re-renders** (`9281`) | no | ✕ → close all | — | — | **A** |
| 30 | Recipe shopping | `openRecipeShop(meta)` `9305` | item panel (`3414`); **self-re-renders** ×3 (`9324-9326`) | no | ✕ → close all | — | — | **C** |
| 31 | What can I make (AI/local) | `openWhatCanIMake()` `8629` → `wcimRender(res, aiUsed)` `8611` | projects screen (`9181`) | no | ✕ → close all | — | — | **D** |
| 32 | Scheduling advisor | `openPantryAdvisor()` `8698` → `padvRender(data, aiUsed)` `8658` | projects screen (`9182`) | no | ✕ → close all | **yes** (1 input) | — | **D** |
| 33 | Event planner (AI) | `openEventPlanner()` `8776` (2 views) → `evPlanRun(prompt)` `8763` (3 views) | events screen (`9923`) | no | ✕ → close all | **yes** (textarea) | — | **D** |
| 34 | AI proposal confirm | `aiConfirmPanel(o)` `4660` | event planner (`8770`), recipe gen (`9001`) — `o` carries **`onApply` callbacks** | no | ✕ → close all | pending proposal | — | **E** |
| 35 | Recipe generator (AI) | `openRecipeGen()` `9021` (2 views) → `runGenerateRecipe(prompt)` `8996` (2 views) | ☰, AI hub | no | ✕ → close all | **yes** (textarea) | ☰ | **D** |
| 36 | Diagnose a cook (AI) | `openDiagnoseAI()` `8920` → `runDiagnose` `8911` → `diagnoseRender` `8895` | dock, AI hub | no | ✕ → close all | **yes** (textarea) | — | **D** |
| 37 | Seasoning recommendation (AI) | `openSeasonRecAI(key, cat, isProd, backFn)` `8849` → `seasonRecRender(…, backFn)` `8824` | item panel / wizard — **`backFn` is a closure passed as an argument** | no | ✕ → close all | — | — | **D** |
| 38 | Photo read (AI) | `openPhotoAnalyze()` `9717` | AI hub | no | ✕ → close all | **yes** (file + input) | — | **D** |
| 39 | Ask the Fire | `openAsk()` `4675` | ☰, AI hub, dock, home card, `openTools` | no | ✕ → close all | **yes** (1 input) | ☰ | **A** |
| 40 | Connect AI (key onboarding) | `askConnect()` `4740` | `openAsk` (`4707`, `4734`), key manager (`4802-4803`) | no | ✕ → close all | **yes** (1 input) | — | **A** |
| 41 | Manage AI key | `openKeyManager()` `4768` | ☰, AI hub lock, `openAiHub` banner | no | ✕ → close all | **yes** (2 inputs) | ☰ | **A** |
| 42 | AI hub | `openAiHub()` `9743` | ☰, home AI card | **no** — and it **wipes the stack** for its own 5 children | ✕ → close all | — | ☰ | **A** |
| 43 | My equipment | `openEquipment()` `6752` — **5 sub-views** | ☰, home gear chip (`9863`) | no | ✕ → close all **from any sub-view** | **yes** (7 inputs + 5 selects, incl. a mid-add device form) | ☰ (launcher only) | **A** + §8 |
| 44 | Describe my gear (AI) | `openGearConcierge()` `6539` | ☰ | no | ✕ → close all | **yes** (textarea) | ☰ | **A** |
| 45 | Appearance | `openAppearance()` `7491` | ☰ | no | ✕ → close all | — (applies live) | ☰ | **A** |
| 46 | Interface level | `openUiLevel()` `7439` | ☰ | no | ✕ → close all | — | ☰ | **A** |
| 47 | Behaviour & automation | `openPrefGroup()` `7460` | ☰ | no | ✕ → close all | — | ☰ | **A** |
| 48 | Customize home | `openHomeCustom()` `9759` | ☰ | no | ✕ → close all | — | ☰ | **A** |
| 49 | Customize dock | `openDockCustom()` `9784` | home dock ✎ (`7997`) | no | ✕ → close all | — | — | **A** |
| 50 | Language menu | `openLangMenu()` `9877` | home 🌐 (`9878`) | no | ✕ → close all | — | — | **A** |
| 51 | How to use | `openGuide()` `3965` | ☰ | no | ✕ → close all | — | ☰ | **A** |
| 52 | Rescue mode | `openHelp()` `3983` | ☰, `openTools` | no | ✕ → close all | **yes** (1 search input) | ☰ | **A** |
| 53 | About & features | `openAbout()` `3851` | ☰ `__about` (via `closePanel()`+`setTimeout`) | no | ✕ → close all | — | ☰ | **A** |
| 54 | Backup & restore | `openBackup()` `7067` | ☰, `openTools` | no | ✕ → close all | **yes** (file input) | ☰ | **A** |
| 55 | Tools (dead) | `openTools()` `7124` | **nothing** (D5) | its children nest **correctly** | ✕ → close all | — | — | **E** |
| 56 | UI-level onboarding | `maybeAskUiLevel()` `7478` | boot, `setTimeout(…,400)` (`9950`) | no | ✕ → close all | — | — | **E** |
| 57 | Occupancy / device sheets | `_occOpenAt` & friends (`app.js:~600-730`) rendered inside #14 | occupancy view | no | in-panel | — | — | **D** |

### 2.5 Non-panel surfaces

| Layer | Surfaces | Mechanism | History | Restore |
|---|---|---|---|---|
| Screens | `home`, `catalog`, `wizard`, `events`, `projects` (`CSCREENS`, `app.js:7535`) | `cNavGo(s)` toggles `.screen.on`; state in `let cCurrent` | none | none — boot forces `cNavGo('home')` (`9942`) |
| Wizard steps | 0…5 (`CW_STEPS=6`; cook mode skips 4 → 5 visible) | `cwGo(n)` toggles `.cwstep.on`; state in `cWiz.step` | none | draft persists (`mk-menu`, `mk-cresume`), **position does not** |
| Catalog views | `landing`, `cat` (+ which `activeGroup`), `fav`, `search` (+ query), `gloss` | `catView(mode)` + `style.display` toggles; state in `activeGroup`/`filters`/`#q` | none | none |
| Modal dialogs | `appConfirm` / `appPrompt` / danger (`appDialog`, `2527`) | `#appdlg` injected into `<body>` with **its own scrim** | none | n/a |

**The dialog layer is a genuine defect the audit did not reach:** `appDialog` binds **no Escape handler**.
The global handler at `app.js:2730` — `document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanel();})` —
is not scoped, so **pressing Escape while a confirm dialog is open closes the panel behind it and leaves
the dialog floating over a dismissed panel.** Any Back-semantics design must scope Escape to the topmost
layer. (Static finding from code; not driven live — flagged in §12.)

### 2.6 Cross-layer jumps — 10 sites, not 2

The audit's **G-N4** named 2 sites where a "tool" teleports the screen. Code shows **10** places where a
panel action changes the **screen** (and sometimes the wizard step too), with no inverse:

| Site | Effect | Kind |
|---|---|---|
| `openPantry` `3514` | `closePanel(); cNavGo('projects')` | accidental (G-N4) |
| `openMoreSheet` `__gloss` `9851` | `closePanel(); cNavGo('catalog'); catView('gloss')` | accidental (G-N4) |
| `startProjectForm` `3509` | `closePanel(); cNavGo('projects')` | accidental — **new** |
| `openActive` `8140` | `cNavGo('projects')` **with the panel still open** | accidental — **new**, and the worst shape |
| `openActive` `8139` | resume card → `cNavGo('wizard')` | flow-completion |
| `spkGoInstance` `1234-1236` | `closePanel(); cNavGo('wizard'); cwGo(3)` | flow-completion |
| `pantryToPlan` `3459-3461` | `closePanel(); cNavGo('wizard'); cwGo(3)` | flow-completion |
| `evPlanApply` `8757-8759` | `closePanel(); cNavGo('wizard')` | flow-completion |
| `buyStoreCreate` `9382` | `cNavGo('projects')` | flow-completion |
| `pwCreate` `9675` | `closePanel(); cNavGo('projects')` | flow-completion |

**The design must distinguish the two kinds** (§5.6): a *flow-completion* jump is a legitimate
`replaceState` to a new root ("I committed something; Back should not undo the commit"); an *accidental*
teleport is a bug and becomes an ordinary push or a panel.

### 2.7 Two dead surfaces found (both feed the design)

1. **`openTools` (`7124-7152`)** — the audit's finding, confirmed: only caller is the impossible
   `typeof showPanel!=='function'` fallback at `9828`. It is also the **only** launcher whose children get
   back buttons. See §7.2 — reviving it is not as simple as D5 implies.
2. **`openPantry`'s panel body (`3515-3548`, 34 lines)** — **new.** `cNavGo` is always defined, so the
   function always returns at `3514`; the entire pantry panel (cure/dry progress cards, weight inputs,
   delete-with-undo) is unreachable. The projects screen replaced it. Per `no-inert-shipment` this should
   be deleted, not carried into the registry.

### 2.8 One asset worth naming: items are already addressable

`resolveItem(key)` (`app.js:2803`) resolves **four stable key namespaces** — `cut-*`, `spec-*`, `make-*`,
`umake-*` — into `{kind, obj, …}`, and `_openItemByKey(key)` (`8043`) already routes a key to the right
one of `openCut`/`openSpec`/`openMake`. **The single hardest part of the descriptor design — turning the
279-recipe catalog into addressable panels — is already built and already has a production consumer.**

---

## 3 · The URL and storage substrate (settle this before the descriptor)

Three facts from code constrain the URL form, and getting this wrong makes reload-restore fail in
production while passing in tests:

1. **`serve.js` has no SPA fallback.** `serve.js:42-45` strips the query, maps `/` → `/index.html`, and
   **404s anything else**. A path-based route (`/catalog/brisket`) would 404 on reload.
2. **Cloudflare Pages** serves the built `dist/` the same way; a path-based route needs a `_redirects`
   SPA rule that does not exist today.
3. **The test fixture's route regex is `/\/index\.html($|\?)/`** (`tests/_fixtures.ts:67`) — it matches
   `/index.html` and `/index.html?…` and **nothing else**. A path-based or root-with-query URL would fall
   through to the real loopback the warm-page fix exists to avoid (L22).

**Decision — a query parameter on the existing document:** `?nav=<encoded>`.
- `serve.js` already ignores the query ✓ · the fixture route already matches `?` ✓ · the PWA manifest
  `start_url: "./"`, `scope: "./"` keeps it in scope ✓ · the service worker's navigation handler
  (`dist/sw.js:9-10`) falls back to `caches.match('index.html')` when the exact request misses, so an
  offline relaunch on `?nav=…` still resolves the shell ✓.
- **Rejected: path segments** (needs a server change in two places). **Rejected: hash** (`#nav=…`) — it
  never reaches the server, which is attractive, but `APP_DOC_RE`'s `($|\?)` does not admit `#`, so
  whether the fixture still intercepts depends on whether Playwright's matcher sees the fragment. That is
  a question, and a design should not rest on one. Query strings need no such determination.

**Encoding:** `?nav=` holds `encodeURIComponent(JSON.stringify(state))` — no invented mini-grammar, no
parser to get wrong. Typical length ~60-110 chars. **Plus one friendly alias**, because it is the only
link a user would ever want to send someone: **`?item=cut-brisket`**, normalised at boot into the full
state via `resolveItem`. (Judgement call — §12.)

---

## 4 · Back semantics (owner decision D6)

### 4.1 One control

The `.panel-top` carries **exactly one** exit control (D6-A). The duplicate `.backbtn` text button
("→ חזרה לחלון הקודם", `app.js:2505-2512`) is **removed**.

| Depth | Renders as | `aria-label` | Action |
|---|---|---|---|
| Panel stack ≥ 2 | **→** (RTL back chevron) | `חזרה` / `Back` | `history.back()` |
| Panel stack = 1 | **✕** | `סגור` / `Close` | `history.back()` |

The control never mutates state directly — it always calls `history.back()`. **All rendering happens in
one place, the `popstate` handler.** That is the re-entrancy cure: there is exactly one writer of the DOM
and it never writes history.

### 4.2 Every dismiss affordance means "back one"

| Affordance | Today | Proposed |
|---|---|---|
| ✕ / → | `closePanel()` → wipes the stack | `history.back()` |
| Escape | `closePanel()` — **global, unscoped** | if `#appdlg` is open → dismiss the dialog only; else `history.back()` |
| Backdrop (`#scrim`) tap | `closePanel()` → wipes the stack | `history.back()` |
| Hardware / browser Back | **leaves the app** | pops exactly one level |
| `.backbtn` | `panelBack()` (correct, undiscoverable) | **removed** |

### 4.3 The pop ladder, and the root

One Back press unwinds exactly one level, in this order:

```
top panel → parent panel → … → (panel stack empty)
          → wizard step n → step n-1 … → step 0
          → catalog: category → landing        (replaces the bespoke header → at app.js:7528)
          → previous screen
          → ROOT (home, no panel, no wizard step)
```

**At the root, Back leaves the app** — and that is the recommendation, not an accident. On boot the root
state is written with `replaceState`, never pushed, so the app holds exactly one entry at the root and
Android's "Back from the root task closes the app" convention is honoured. The alternatives (a
"press again to exit" toast; a sentinel entry that makes Back un-exitable) both fight the platform.
**Owner-confirm — §12.**

### 4.4 The rule that prevents the worst regression: push vs replace

Six surfaces **re-call their own opener** on every in-panel edit — `openRecipeShop` (×3, `9324-9326`),
`openPantryShop` (`9281`), `openProjectCart` (`9350`), `openCart` (`2685`, `2691`), `openBurgerBuilder`
(`9500`), `openCopilot` (`5887-5889`), `openPantry` (`3545`, `3548`). Under a naive "push on every
`showPanel`" design, **every checkbox tick would become a history entry** and Back would walk the user
backwards through their own checkbox states — a worse experience than today's.

> **Rule N-1 (normative).** A navigation is a **push** only when the resulting state's
> `(screen, view, panelStack)` **differs by more than a re-render of the topmost descriptor**.
> A `showPanel` whose descriptor equals the current top descriptor is a **`replaceState`**.
> This is the single highest-risk implementation rule in this spec; §10 names the test that proves it.

---

## 5 · The model

### 5.1 State — one value, one writer

```js
// The complete navigation state. JSON-serializable by construction.
{
  s:  'catalog',                      // screen id ∈ CSCREENS
  v:  { m:'cat', g:'בשר אדום', q:'' },// screen-local view state (see 5.5)
  st: [ {id:'menu'}, {id:'cart'} ]    // panel stack, bottom → top. [] = no panel
}
```

- `history.state` holds this object verbatim; `?nav=` holds the same object encoded (§3).
- **`NAV.render(state)` is the only function that touches the DOM** and it never touches history.
  `NAV.go(state)` / `NAV.replace(state)` are the only functions that touch history, and they call
  `render` afterwards. `popstate` calls `render(e.state)` and nothing else. A single `NAV._applying`
  guard makes the legacy funnels no-ops while a render is in flight.

### 5.2 The descriptor

```js
{ id:'cut', p:{ key:'cut-brisket' } }     // a panel is DATA: an id plus JSON-only params
```

- `id` — a short, **stable** registry key. Stable means: it appears in saved URLs, so it is renamed only
  with a migration. It is deliberately **not** the function name, so `openCut` can be refactored freely.
- `p` — parameters. **Strings, numbers, booleans, and arrays of those. Nothing else.** No objects with
  methods, no DOM nodes, no closures. A descriptor that cannot be `JSON.stringify`-round-tripped is a
  registration error and must fail loudly at registration time, not silently at restore time.

### 5.3 The registry — how a panel declares itself

```js
NAV.register('cut', {
  open:    p => openCut(resolveItem(p.key).obj),   // rebuild the view from DATA
  restore: 'full',                                 // 'full' | 'parent' | 'none'
  parent:  p => ({ id:'catalog' }),                // optional: where a deep link lands "under"
  dirty:   () => false,                            // optional: unsaved-input probe (§6)
  title:   p => itemName(resolveItem(p.key)),      // optional: a11y label / back-button hint
});
```

`restore` is the whole honesty of the design:

| Class | `restore` | Meaning | Surfaces |
|---|---|---|---|
| **A** | `full` | zero-arg; `open()` rebuilds it exactly | 30 surfaces |
| **B** | `full` | string/number params only | 6 surfaces |
| **C** | `full` | takes an object, but the object is derivable from a stable key (`resolveItem`, `projById`) | 7 surfaces |
| **D** | `parent` | derived, live, or AI-produced state that cannot be rebuilt from data | **11 surfaces** |
| **E** | `none` | must never be restored (onboarding, dialogs, dead code) | 3 surfaces |

**Restore algorithm.** Walk the saved stack bottom-up; open each `full` descriptor; on the first
`parent`/`none`/unregistered entry, **stop and open its `parent` instead** (or leave the screen bare),
then show a single quiet toast: *"החזרנו אותך למקום הקרוב ביותר"* / *"Restored you to the nearest place"*.
Never silently show an empty shell, and never restore half an AI result.

### 5.4 The 5 funnels — where the code changes

Every one of the 76 `showPanel` sites already flows through five functions. **That is where the work lands
— not at 76 call sites.**

| Funnel | Today | Becomes |
|---|---|---|
| `showPanel(html)` `2493` | renders + adds `.open` | renders; **the push/replace happens in `NAV.open(desc)`**, which then calls the opener |
| `closePanel()` `2554` | `panelStack=[]` + teardown | **teardown only** (`speechSynthesis.cancel`, `gemStop`, `vcRec.stop`, `clearTimers`, `serveIv`, focus restore, `cRefreshHome`) — called *by* `render` when the stack empties. Never bound to a control again |
| `panelBack()` `2524` | pops one | **deleted** — `history.back()` replaces it |
| `cNavGo(s)` `7537` | toggles `.screen.on` | `NAV.go({...state, s, v:defaultViewFor(s), st:[]})` |
| `cwGo(n)` `7564` | toggles `.cwstep.on` | `NAV.go({s:'wizard', v:{...v, w:n}, st:[]})` |

`catView(mode)` `1801` becomes a sixth, smaller funnel for `v.m` / `v.g` / `v.q`.

### 5.5 Screen-local view state (`v`)

| Screen | `v` shape | Notes |
|---|---|---|
| `home` | `{}` | — |
| `catalog` | `{ m:'landing'\|'cat'\|'fav'\|'search'\|'gloss', g:<group>, q:<query> }` | replaces the bespoke header-back at `7528`; the ladder `cat → landing → home` becomes ordinary Back |
| `wizard` | `{ w: 0..5 }` | `cwGo`'s cook-mode skip (`7567`) is a *derivation*, so `w` is validated on restore, never trusted |
| `events` / `projects` | `{}` | painted from stored data |

### 5.6 Flow-completion jumps (§2.6)

A registry-level helper, so intent is explicit at each of the 10 sites:

```js
NAV.commit(nextState);   // replaceState — "I saved something; Back must not undo the save"
NAV.go(nextState);       // pushState   — an ordinary navigation
```
The 6 flow-completion sites use `NAV.commit`; the 4 accidental teleports (`openPantry`, `__gloss`,
`startProjectForm`, `openActive:8140`) become ordinary pushes or panels. **`openActive:8140`, which today
moves the screen while its own panel is still open, is the one that cannot survive as-is** — a state where
`st` is non-empty and `s` just changed is representable, but it is never what the user asked for.

---

## 6 · Unsaved state

Today's behaviour splits cleanly and the split decides the rule:

- **Already durable — nothing to warn about.** `mk-menu` (wizard, saved on every change), `mk-cresume`,
  cart, equipment, prefs, `tlState`, pantry, journal. Navigation away is already lossless; the descriptor
  restores the *view* and the store restores the *content*.
- **Transient, in-DOM only — 19 surfaces** carry `<input>`/`<textarea>`/`<select>` with no
  per-keystroke persistence (#7, 13, 18, 24, 26, 27, 32, 33, 35, 36, 38, 39, 40, 41, 43, 44, 52, 54, and
  `openEquipment`'s device form). G-N7 is the observed instance: type into תזכורות, press ✕, reopen —
  the field is empty and nothing warned.

**The rule, and it is deliberately not "warn everywhere":**

1. **Persist, don't warn, for scratch input.** A registry entry may declare `keep:['#calcW','#askQ']` —
   a list of field selectors whose values are written to a single scratch store `mk-navdraft` keyed by
   descriptor id on any navigation away, and restored by `open()`. A calculator or an AI prompt box should
   come back with what you typed. This turns G-N7 from a dialog into a non-event, and it is the only
   option that also survives a reload.
2. **Warn only where leaving destroys committed-looking work** — three surfaces: the event wizard
   (`cwExitWizard` `8449` already has the correct 3-way `appConfirm`, and it is **kept verbatim**), the
   equipment device form mid-add, and the project wizard mid-create. `dirty()` returns true and the
   controller shows the app's own `appConfirm` before navigating.
3. **A hard browser constraint, stated rather than hidden.** By the time `popstate` fires, **the history
   entry has already changed — a guard cannot cancel a hardware Back.** So:
   - the affordances we control (✕/→, Escape, backdrop) run `dirty()` **before** calling `history.back()`;
   - **hardware Back is never blocked.** It relies on rule 1 (persist) plus, for the three rule-2
     surfaces, a re-push of the state just left with the dialog shown over it — the documented pattern,
     and the only one that does not lie to the user.
   Anyone who implements a "stay?" dialog on hardware Back without re-pushing will ship a dialog that
   cannot keep its promise.

---

## 7 · Owner decisions, implemented

### 7.1 D6-A — one control (§4). Second-order consequence to confirm

D6-A removes the text back button and makes ✕ mean "back when a stack exists". The consequence not stated
in D6: **"get me out of everything" stops existing as a single gesture.** From a 3-deep stack the user
presses → three times. That is the phone convention and I recommend it; but if the owner wants a
"close all" escape, the natural home is a **long-press on ✕**, not a second visible button. Not designed
here. **Owner-confirm — §12.**

### 7.2 D5-A — `openTools` revived as the single launcher ⚠️ **reinterpretation, §4 Waiver Gate**

D5-A says: *"Revive it as the single launcher. The correct behaviour already exists and is unreachable.
Route `openMoreSheet` through it rather than writing new code."*

**Three facts from code say the mechanism should be adopted and the surface should not:**

1. `openTools`' 15 labels are **hard-coded Hebrew with no `L()`** (`app.js:7126-7140`) — `'רשימת קניות'`,
   `'מדריך עצים'`, … Its subtitle and header are the same. `openMoreSheet`'s 27 entries are **fully
   bilingual** via `L()`. Reviving `openTools`' UI would regress the shipped he/en i18n on the app's
   highest-traffic surface.
2. It reaches **15 of 58** launch slots — it is missing 12 of ☰'s entries (appearance, UI level, behaviour,
   customize home, equipment, gear concierge, key manager, glossary, seasonings-by-context, AI hub,
   recipe generator, active-now) plus the beginner/advanced gating (`visible(it)`), the "most used" row,
   and the `mk-recent-tools` memory.
3. It contains two **app-leaving** actions (`location.href='product.html'`, `exitApp`) that a nested
   launcher should not own.

**Recommended reading of D5-A, for the owner to confirm or reject:** adopt `openTools`' *mechanism*
(the launcher records where it came from, so its children get a back affordance) as `NAV.open()` for
**all three live launchers** — ☰, the home dock, and the AI hub — and then **delete `openTools`**
(`no-inert-shipment`). Outcome-wise that is closer to D5-**B** than D5-A, which is exactly why it is not
being decided here. **This is a spec reinterpretation of an approved owner decision and must be raised in
conversation. §4: "recorded in a document does not count as raised."**

### 7.3 D4-A — Option B first, then this. See §9 for the delta.

---

## 8 · What the descriptor model CANNOT express — the design's real constraint

Stating this is the point of the section; a design that hides its constraint is worse than one that names it.

| Surface | Why it is not expressible as data | Rule |
|---|---|---|
| **`aiConfirmPanel(o)`** #34 | `o` carries **`onApply` callbacks** (`8770`, `9001-9002`) — behaviour, not data. There is no key that reconstructs "the proposal I was about to accept". | `restore:'none'`. On reload the proposal is gone and the parent (planner / generator) reopens. |
| **`openSeasonRecAI(key,cat,isProd,backFn)`** #37 | first three params are data; **`backFn` is a closure passed as an argument** — the same closure-capture defect as `panelStack`, at the parameter level. | Refactor to a descriptor `parent` before registering. **Blocks its registration.** |
| **`openVoiceCook(tasks)`** #12 | `tasks` is a computed plan; the panel also owns a **live** `SpeechRecognition`/TTS session (`vcRec`, `vcSpeaking`). Restoring the view without the session is a lie. | `restore:'parent'` → timeline. |
| **`openOccupancyView(computed, serve, scope)`** #14 | `computed` is a derived occupancy plan from `window._wpCtx` — recomputable in principle, but only from a built menu that may no longer exist. | `restore:'parent'` → timeline. |
| **`openCopilot()`** #13 | zero-arg, so trivially *openable* — but it is a **live cook session** with probes and timers; restoring it after a relaunch re-enters a cook that may be over. | `restore:'parent'` and an explicit "resume?" — **not** a silent restore. |
| **The 8 AI result panels** (#20, 31, 32, 33, 35, 36, 37, 38) | the result is a model response. Re-running on restore would spend money and could return something different — silently replacing what the user saw. | `restore:'parent'` (the form), never a re-run. |
| **`openEquipment`'s 5 sub-views** #43 | the sub-view lives in a **function-local `let editId`** (`6752`) with no external representation, so "the device form for device X" has no name to give it. | Registrable as `{id:'equip'}` (list) only. Its sub-views need `p:{view:'form', devId}` extracted first — **a prerequisite refactor**, not a registration. |
| **`appDialog`** | a Promise-returning modal whose resolution is the caller's control flow. Putting it in history would let Back "answer" a question. | Never enters history. Escape/backdrop scope to it (§4.2). |

**11 of 57 surfaces (19 %) are class D or E.** For those, reload-restore is *explicitly* "land on the
nearest ancestor", not "restore". That is the honest ceiling of G-N6 and it should be in the mockup so the
owner feels it (it is — see the mockup's *AI panel* journey).

---

## 9 · Migration path — incremental, and how it is kept honest

**Recommendation: incremental, 3 stages after stage 1, behind one adapter. Not a single cutover.**

A single cutover means one commit touching 5 funnels, 76 call sites, 10 cross-layer jumps and 57 openers
in a 9,969-line single file, with two other agents active in the repo. The blast radius is the whole app
and there is no partial-green state to bisect from.

| Stage | Content | Fixes | Reload-restore |
|---|---|---|---|
| **1** (= Option B, D4-A, **not yet implemented**) | ✕/Escape/backdrop → `panelBack()`; ☰ dispatch → `openFrom`; wizard `returnTo` | G-N2, G-N3, G-N5, G-N8 in memory | none |
| **A** | `NAV` lands: state + `render` + `go`/`replace`/`commit` + `popstate`; the 5 funnels route through it. **The registry starts with ONE entry: `__legacy`, `restore:'none'`** — any panel opened without a descriptor gets it | **G-N1** (hardware Back), and G-N2/N8 now structurally | screen + wizard step + catalog view. **Panels: no** |
| **B** | Register descriptors in traffic order: the 27 ☰ + 11 dock + 5 AI-hub slots are **almost all class A → `{id:fnName}`, one line each**; then the 4 item namespaces through `resolveItem` | **G-N6** for 43 of 57 surfaces | panels, incrementally |
| **C** | The residue: class D/E get `restore:'parent'`; the `openSeasonRecAI` `backFn` and `openEquipment` `editId` prerequisite refactors; delete `openTools` + `openPantry`'s dead body | closes §8's blockers | final |

**Why `__legacy` is what makes this incremental** — Stage A delivers *complete history integration with
zero per-panel work*, because an unregistered panel is still a legal stack entry; it just cannot be
restored. Every later stage is additive and independently shippable.

**The risk of incrementalism, and the gate for it.** `__legacy` is exactly the shape of L2/DoD-5 — an
inert fallback that quietly becomes permanent, leaving an app where some panels restore and some do not.
**Gate (the L19 firing-guard pattern): a census test that enumerates every `showPanel` call site reached
in a scripted sweep of all 58 launcher slots and asserts `__legacy` count === 0.** It is written in
Stage A **expected to fail**, and its going green is Stage B's exit condition. Not a to-do — a red test.

**Risk register**

| Risk | Mitigation |
|---|---|
| Double-handling loop (`popstate` → `closePanel` → `history.back()`) | one writer (`render`), one guard (`NAV._applying`); no control calls anything but `history.back()` |
| Checkbox-tick history entries (§4.4) | Rule N-1 + its test (§10) |
| Restoring a stale AI result | class D never re-runs and never restores (§8) |
| `?nav=` breaks on reload in production | §3 verified against `serve.js`, `dist/sw.js`, the manifest and the fixture regex |
| Escape closing the panel behind a dialog | §4.2 scoping; asserted (§10) |
| A saved URL breaking after a refactor | descriptor `id` is stable-by-contract and not the function name |
| Conflict with the in-flight Phase B / graph work | Stage A touches only the 5 funnels + a new `NAV` block; no overlap with Phase B's safety code |

---

## 10 · Testability

**Fixture: `isolatedPage`** — `tests/_fixtures.ts:178`. (The task brief cites `:149`; that line is the
*mention* inside the warm-page hard-trap error string. The fixture itself is declared at `:178`.)
Three independent reasons, all of which apply:

1. `history.length` **accumulates on the worker-shared warm page** across every test in that worker →
   any absolute history assertion is non-deterministic on `warm`.
2. `page.goBack()` leaves a **back stack** that the next test's `seedApp()` (clear → set → reload) does
   **not** clear — reload adds an entry, it does not drop the ones behind it.
3. Per-file `test.use({...})` options do not reach a worker-scoped fixture (the trap message's own point).

`isolatedPage` uses the built-in context, which **does not install the `route.fulfill` doc route** — so
these specs do a real loopback nav. Keep the file small and its navigations few (L22): a handful of
`goto`/`goBack`, no reload storms.

**What the tests assert — behavioural, on rendered output, never on an internal counter alone:**

| # | Gap | Assertion |
|---|---|---|
| T1 | G-N1 | `history.length` **increases** on panel open and on screen change (today pinned at 2) |
| T2 | G-N1 | `page.goBack()` from an open panel → **`page.url()` is still the app** *and* `#panel` lacks `.open` *and* the screen behind is unchanged. Decisive assertion: **we did not navigate away** (today the page becomes `about:blank`) |
| T3 | G-N2 | Nested pair built via the app's own path (Meal builder → cart, `openFrom` at `5124`). Then **✕, Escape, and `#scrim` click each assert the same landing**: `#panel` still `.open` and its `h2` reads the parent's title (`בונה תפריט לאירוח`). Three parameterised cases, one expectation |
| T4 | G-N2 | `page.goBack()` from the nested panel → same parent `h2` |
| T5 | G-N3 | ☰ → any tool → the single exit control renders as **→** with `aria-label` `חזרה`; activating it re-renders the ☰ heading (`עוד`). **Parameterised over all three launchers** — ☰, dock, AI hub |
| T6 | G-N3 (new) | ☰ → כלי AI → ניתוח תמונה, then **two** Backs → AI hub, then ☰ sheet. Proves the two-level loss is gone |
| T7 | G-N5 | Wizard entry screen parameterised over `events`/`projects`/`home`; exit; assert `cCurrent` **and** that `.cnav button[data-cnav=<entry>]` carries `.on` (the user-visible consumer) |
| T8 | G-N6 | Drill catalog → בשר אדום → `reload()` → the category heading is still rendered |
| T9 | G-N6 | Wizard at step 3 → `reload()` → `#cwLbl` still reads `שלב 4/6`, inside a `dir="ltr"` island (**L13**) |
| T10 | deep link | **Cold** `goto('/index.html?nav=…')` (and `?item=cut-brisket`) renders the panel. This is the assertion that proves the descriptor is genuinely data and not a closure |
| T11 | **Rule N-1** | Open recipe shopping, tick **5** checkboxes, assert `history.length` is **unchanged**; then one Back returns to the parent, not to checkbox #4. The regression §4.4 predicts |
| T12 | class D | Open an AI result panel with a stubbed response → `reload()` → assert the **parent form** is rendered and the "restored you to the nearest place" toast appeared. Negative case: it did **not** re-issue the AI call |
| T13 | dialog scoping | With `appConfirm` open, press Escape → the **dialog** closes and `#panel` **keeps** `.open` (today the panel behind closes) |
| T14 | root | `goBack()` from the root asserts the pinned semantic of §4.3 — so it is a decision, not an accident |
| T15 | census | Sweep all 58 launcher slots; assert `__legacy` descriptor count === **0** (Stage B exit condition; **written red in Stage A**) |
| T16 | regression guard | After **any** navigation, `history.length > 1` — the zero-history condition cannot silently return |
| T17 | unsaved | Type into תזכורות → navigate away → return → the value is **restored** (§6 rule 1). Negative: a pristine form triggers **no** dialog |

**DoD 11:** every wait is `waitForFunction` on `#panel.open`, on heading text, or on `history.length`.
The audit's `scratch/nav-audit*.mjs` probes use fixed waits and **must not** be promoted into `tests/`.
**DoD 8/9:** screenshots at 390 × 844 in Hebrew for the new single exit control at depths 1 and 2, the
restore toast, and the unsaved-input dialog.

---

## 11 · What stage 1 (Option B) already delivers — the delta

Stage 1 is **specified (D4-A) and not yet implemented** — verified for this draft: `app.js:2503` still
binds ✕ to `closePanel`, and `2729`/`2730` still bind the scrim and Escape to it. So the table below is
"what stage 1 will deliver", not "what already exists".

| Concern | Stage 1 (Option B) | This spec adds |
|---|---|---|
| ✕/Escape/backdrop pop one level | ✅ (via `panelBack()`) | re-expresses it as `history.back()`, so one mechanism serves all four affordances |
| ☰ tools get a back button | ✅ (`openFrom`) | extends it to the **dock** and the **AI hub** — the two launchers stage 1 does not touch |
| Wizard returns to its entry point | ✅ (`returnTo`) | the entry point becomes an ordinary history entry, so it also survives a reload |
| Two controls collapsed into one (D6) | partial | ✅ the depth-aware single control, and `.backbtn` deleted |
| **Hardware / browser Back** | ❌ still quits the app | ✅ **the whole point** |
| **Reload / PWA-relaunch restore** | ❌ impossible (closures) | ✅ for 43 of 57 surfaces; explicit nearest-ancestor for the other 11+3 (§8) |
| Deep links | ❌ | ✅ `?nav=` and `?item=` |
| Cross-layer teleports | 2 of 10 sites | ✅ all 10, with `commit` vs `go` intent (§5.6) |
| Escape scoped to the dialog layer | ❌ | ✅ |
| Unsaved input | ❌ | ✅ persist-not-warn + the 3 genuine warn cases |
| Checkbox-tick history pollution | n/a | ✅ Rule N-1 (a risk stage 1 does not have and this spec creates) |

**Stage 1 is a strict subset of this contract** — making ✕ mean "pop one" is precisely the semantic this
model needs. Nothing in stage 1 is thrown away.

---

## 12 · Self-review — judgement calls the owner should confirm, not inherit

**Raise-in-conversation items (§4 Waiver Gate) — the first two are not mine to settle:**

1. **§7.2 · D5 reinterpretation.** D5-A says revive `openTools`; the code says its *mechanism* is right and
   its *surface* is a regression (no `L()` i18n on 15 labels, 12 missing entries, no level gating, two
   app-leaving actions). I recommend adopting the mechanism for all three live launchers and **deleting**
   `openTools`. **That is outcome-closer to D5-B.** Explicit approval needed.
2. **§4.3 · Back at the root leaves the app.** I recommend the platform convention. It means a mis-tap at
   the root closes an installed PWA mid-cook. The alternatives (confirm-toast; un-exitable sentinel) are
   cheap to add and I have *not* designed them. This one is hard to reverse once users learn it.
3. **§7.1 · "Close everything" ceases to be one gesture** under D6-A. From 3 deep it is three presses.
   If that is unacceptable, long-press ✕ is the natural home and is **not designed here**.

**Design calls I made and would defend, but which are calls:**

4. **§3 · Query string (`?nav=`), not a path and not a hash.** Driven by `serve.js`'s lack of an SPA
   fallback and the fixture's `APP_DOC_RE`. A hash needs a determination about Playwright's fragment
   handling that I did not run; if the owner prefers hashes, that experiment comes first.
5. **§3 · `?item=<key>` as the one friendly alias.** Scope creep if the owner does not want shareable
   recipe links. Drop it and nothing else changes.
6. **§6 · Persist-don't-warn as the default for transient input.** I chose restoring the field over a
   dialog. It is more code (a `keep:` list per form) and it changes what "close" means. The cheaper design
   is a confirm dialog on all 19 forms — which is also 19 more chances to annoy someone mid-cook.
7. **§6.3 · Hardware Back is never blocked.** A browser fact, not a preference, but the *consequence* is a
   preference: on hardware Back from a dirty form the user is not asked. Rule 1 covers the loss for 16 of
   19; three surfaces re-push and ask.
8. **§9 · Incremental with a `__legacy` fallback.** A deliberate temporary inertness, which is the exact
   shape of L2. I gated it with a red census test (T15). If the owner would rather not have that state
   exist at all, the alternative is one large cutover and I do not recommend it.
9. **§2.3 · 75 views folded into 57 surfaces** by three stated rules. Count `openEquipment`'s 5 sub-views
   and the transient AI views separately and the number is 75; count only "things with their own name in
   the UI" and it is nearer 50. **74 total navigable surfaces** uses the 57.
10. **§5.5 · The catalog's bespoke header-back (`7528`) is replaced, not kept.** It works today (audit S19).
    Chesterton's Fence: I read it, it is a hand-rolled one-level-up ladder, and the model subsumes it
    exactly. Keeping both would give the catalog two back mechanisms.
11. **Deleting `openPantry`'s 34 dead lines and `openTools`' 29** is `no-inert-shipment` applied — but it
    is deletion of code that once worked. Named here rather than done quietly.

**What I did not do, and you should know it:**

- **I drove nothing live.** This is a code-derived inventory by instruction (Part 1: "derived from the code
  rather than from clicking"). Three findings are therefore **static-only** and should be confirmed by a
  live probe before implementation: the Escape-over-dialog defect (§2.5), `openActive:8140` moving the
  screen under an open panel (§2.6), and `openPantry`'s dead body (§2.7). Each is a plain read of
  unconditional control flow, but none was observed.
- **I did not run the Playwright suite** (another agent needs it uncontended) and wrote **no** test code.
- **`history.length` was not re-measured**; I re-verified the load-bearing static fact (0 occurrences of
  `pushState`/`replaceState`/`popstate`/`hashchange`) and took the audit's live measurement as given.
- **Android hardware Back on a physical device is still unverified** — the audit's own §7 limitation
  carries into this spec unchanged.

---

## 13 · Definition of Done (for the implementation that follows approval)

1. Spec approved by the owner, with items 1–3 of §12 answered in conversation.
2. Stage 1 (Option B) shipped and green first — it is a prerequisite, not a parallel track.
3. T1–T17 written **RED first**, each observed failing for the intended reason, output pasted.
4. T15 (the `__legacy` census) green — no unregistered panel remains at the end of Stage B.
5. Every surface in §2.4 either registered with a descriptor **or** listed in §8 with its `restore` class;
   the two lists together cover all 57, with no third bucket.
6. `npx playwright test` plain, green, output pasted (§11a; never `--retries`/`--workers=1`).
7. Screenshots at 390 × 844, Hebrew, of: the single exit control at depth 1 and depth 2, the restore
   toast, the unsaved-input dialog, and a deep-linked cold boot (DoD 8, 9; `dir="ltr"` on `שלב 4/6`, L13).
8. **Safety invariance (DoD 10):** no `bcheck` stage, `temp`, `safe` value or cook duration is touched.
   Navigation changes which view is on screen; it changes no number. Named assertion: the existing safety
   suite passes unchanged.
9. Live verification per §10.10 after the deploy — `.foot-stamp` matches and a feature probe
   (`typeof window.NAV==='object'` plus a `?nav=` cold boot) succeeds on `matkonetesh.pages.dev`.
