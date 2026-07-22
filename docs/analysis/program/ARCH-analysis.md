# Architectural analysis of the 141-gap corpus — the structural view

**Date:** 2026-07-22 · **Version analysed:** v258 · **Input:** `docs/analysis/2026-07-22-ULTIMATE-knowledge-and-gaps.md`
(141 gaps, 8 bands), the 21 reports under `docs/analysis/sweep/`, the 8 specs under `docs/superpowers/specs/`,
and the source tree itself.

**Purpose.** Not sequencing (someone else has that), not spec reconciliation (someone else has that).
**Where do the 141 gaps actually live, which of them are one defect wearing several hats, and what has to
exist before what.**

---

## 0. Method, and what "verified" means in this document

Every structural claim below was settled by opening the file, and where the claim is about *what the program
does* rather than *what it says*, by executing something. The distinction matters here more than usual: the
sweep this document sits on top of refuted 42 of its own 261 findings, and §4.J of the ULTIMATE names the
single shared shape — *"a grep, a quotation, or a single artifact trusted without tracing the runtime path."*

- The knowledge graph (`graphify-out/graph.json`, 1,579 nodes) was used to **locate** evidence — it is a
  documentation-and-code graph and it is good at "which documents talk about `equipPlan`". It was not used to
  settle anything. `graphify explain "equipPlan"` returns ten `references` edges from audit documents and one
  `calls` edge from `buildList` — a lead, and the lead was then read in `app.js`.
- Where I ran a script over `app.js` or the Python modules, the script and its output are quoted.
- **Where I am inferring rather than verifying, the paragraph says so in bold.**

**Scope I did not cover.** I did not re-derive the food-science values, the business numbers, or the
non-functional measurements; I took the ULTIMATE's word for those and reasoned only about where their fixes
land. I did not run the Playwright suite. Three of my structural claims (§2.3, §5.4, §6.2) are new findings
that no sweep report contains and that have therefore had no adversarial verification pass — they are marked.

---

## 1. The true subsystems

The eight audit bands are a *reporting* taxonomy: they answer "what kind of harm is this?" A program needs
the other axis — "what do I have to change, and does changing it change anything else?" Re-cut that way, the
141 gaps fall into **eleven subsystems**, and the cut is nothing like the bands.

Every gap is assigned to exactly one subsystem — the one where the **fix** lands, not the one where the
symptom shows. Multi-homed gaps are named as such in the notes. The allocation sums to 141.

| # | Subsystem | Where it lives | Gaps | Defining structural property |
|---|---|---|---|---|
| **S1** | **Build, data & verification pipeline** | `build.py`, `data.py`, `sausages_new.py`, `sources.py`, `gen_sources.py`, `equipment_map.py`, `lang/*.json`, `package.json` | **11** | **`build.py` contains zero assertions.** Every anomaly is a `print()`. |
| **S2** | **Plan pipeline** | `app.js:5622-6085` (the `renderTimelinePanel` closure) + `itemStages` 3213 / `planSchedule` 2978 / `schedulePlacements` 3089 / `safetyDiff` 3039 | **25** | **The pipeline is a private closure inside a render function.** Its only export is five `window` globals. |
| **S3** | **Capacity & occupancy model** | `app.js:229-720`, `2998-3030`, `3089-3210` | **15** | A genuinely good model with a **designed** shared verdict (`out.fit`) that its three consumers do not all use. |
| **S4** | **Identity & scope keyspace** | `evScope` 7743, `seasCtx` 1075, `liveScope` 5348, `menuCtx` 4702, `curProject` 1453, all `mk-*` key builders, `cardSess` 843 | **6** | **Four mutually incompatible scope namespaces**, and key *formats* duplicated as string literals across the file. |
| **S5** | **AI egress** | `gemFetch` 4208 + 9 feature callers + 5 guard sites + 25 speech sites | **16** | **A transport chokepoint with no egress chokepoint.** Guards are applied per-caller, at the render line. |
| **S6** | **Managed-AI Worker** | `worker/index.js` (91 lines) | **9** | Check-then-act on an eventually-consistent store, with the debit taken *after* the spend. |
| **S7** | **Localization** | `L` 6896 / `t` 6891 (generative) vs `tnode` 6907 / `hydrateMT` 6987 / `applyI18n` 6904 (corrective) + the `MutationObserver` at 9540 | **11** | **Two competing translation mechanisms over one DOM**, one of which is a whole-body scan re-armed by any mutation. |
| **S8** | **Time & calendar** | `today` 2789, `addDays` 2790, `daysBetween` 2791, `isoDate` 5531, `serveDateTime` 5544, `parseServeTime` 7831 | **3** | Two conventions for "a day", neither named as such. |
| **S9** | **Delivery shell** | `build.py` HTML template + `sw.js` generator (`:395-425`) + `_headers` (`:427`), `serve.js`, Cloudflare Pages | **13** | Nothing that ships the app is exercised by any test (§3.B.26 makes it *unexercisable*). |
| **S10** | **Presentation system** | `app.css` (1,710 lines), DOM structure, focus/ARIA | **19** | Colour is a real token system; **type, space and radius are not** (34 font sizes, 21 radii). |
| **S11** | **Commercial** | No code exists | **13** | Not an architecture problem. Listed so the arithmetic is honest. |

<details>
<summary><b>Full allocation (click to expand) — every one of the 141, by ULTIMATE §3 label</b></summary>

- **S1 (11):** A10 A11 A14 · B24 B29 B30 B31 · E3 · F-i.1 F-i.5 F-ii.10
- **S2 (25):** A5 A6 A7 · B-i.3 B-i.4 B-i.5 B-i.6 B-i.7 B-ii.8 B-ii.9 B-iii.13 B-iii.15 B-iii.16 · C1 C2 C3 C4 C5 C6 C7 C8 C9 C12 · F-v.30 F-v.32
- **S3 (15):** B-i.1 · C11 · D1 D2 D3 D4 D5 D6 D7 D8 D9 D10 D11 · F-iii.16 F-v.29
- **S4 (6):** B-i.2 B-ii.10 B-ii.11 B-ii.12 B-iii.14 · G2
- **S5 (16):** A1 A2 A3 A4 A12 A13 A15 · E1 E2 E4 E5 E6 E10 E11 E12 E16
- **S6 (9):** B-v.19 B-v.20 B-v.21 B-v.22 · E8 E14 · H1 H2 H3
- **S7 (11):** A8 · B-iii.17 · E7 E9 E13 · F-i.2 F-i.3 F-i.4 · F-ii.8 · F-iii.20 · F-v.33
- **S8 (3):** A9 · B-iv.18 · C10
- **S9 (13):** B-v.23 B-v.25 B-v.26 B-v.27 B-v.28 · E15 · F-ii.6 F-ii.7 F-ii.9 · F-iv.24 F-iv.25 F-iv.26 · G1
- **S10 (19):** F-iii.11 .12 .13 .14 .15 .17 .18 .19 .21 .22 .23 · F-v.27 .28 .31 .34 .35 .36 · G7 G8
- **S11 (13):** G3 G4 G5 G6 · H4–H12

</details>

### 1.1 What the re-cut reveals that the bands hide

**The SAFETY band splinters into five subsystems.** A1/A2/A3/A4/A12/A13/A15 are all one subsystem (S5, AI
egress). A10/A11/A14 are a different one (S1, the build pipeline). A5/A6/A7 are a third (S2). A8 is
localization. A9 is calendar arithmetic. *"Fix safety first"* is not an executable instruction, because the
fifteen items have **five different fixes in five different places** and only one of the five (S5) is a
single change.

**Conversely, the correctness band is not one thing either but it is mostly two.** Of 31 B-items, 10 land in
S2 and 5 in S4 — and those two subsystems are adjacent: S4 is the keyspace S2 writes into. Another 9 land in
S6+S9 (Worker + shell), which have nothing to do with the plan at all and are simply infrastructure that got
audited in the same pass.

**S2 is the centre of gravity: 25 of 141, or 18 %.** No other subsystem holds more than 19. And S2's gaps are
the ones that describe the product's differentiating feature. If the program has one hard part, this is it.

**S11 (13 gaps) requires no code and S10 (19 gaps) requires no architecture.** 32 of 141 — 23 % — are outside
the structural argument entirely. That is worth saying out loud before anyone plans 141 tasks.

---

## 2. The boundary thesis — real, but not for the reason given

The sweep's synthesis verdict:

> *"its weakest parts are its boundaries — five separate defects are one nonconformance in five costumes: a
> value computed in one place, consumed in another, with nothing asserting they agree."*

**Verdict: the thesis is real and it is the correct organising frame. Four of the five named instances hold.
The fifth — the 483 `typeof` guards — is refuted, and refuting it matters, because it is the instance the
sweep uses to argue that the failure mode is *pervasive in `app.js`* rather than concentrated at five
specific seams.**

### 2.1 The four that hold, and what the mechanism actually is at each

The important correction is that "fix the boundaries" is not one mechanism. It is **four different
mechanisms**, and three of the four already exist in the codebase and are simply not used at every consumer.

#### (a) Three device-capacity rules — *the shared verdict exists and is documented as such*

Confirmed by reading all three:

| Path | Predicate | Line |
|---|---|---|
| `schedulePlacements` | `_windowFits(placed, start, end, r.demandCm2, cap.usableCm2)` — whole-device area, and separately `if(r.demandCm2>perSlot)` with **no tolerance** | `app.js:3155`, `3144` |
| `cookerContention` | `((o.fit&&o.fit.verdict==='over')\|\|o.over)?'area':(!o.compat.tempOk?'temp':null)` | `app.js:280` |
| `combinedEventsRows` | `if(!(o.over \|\| !o.compat.tempOk)) return;` | `app.js:7882` |

The mechanism is **not** "introduce a shared module". `deviceOccupancy` (`app.js:438`) is already the shared
module and already computes the shared verdict — its own comment at `:499` says so verbatim:

> `// Fit verdict (Phase 2 honesty ladder) — a MODEL value so the diagram, the sentence and the a11y list agree.`

`cookerContention` uses `out.fit`. `combinedEventsRows` does not. `schedulePlacements` **does not call
`deviceOccupancy` at all** — it re-derives from the same two primitives (`deviceCapacity` `:306`,
`itemOccupancy` `:356`) and reimplements packing. So the mechanism is: **make `out.fit.verdict` the only
verdict, and delete the two re-derivations.** One value, one producer, three consumers, currently three
predicates.

#### (b) Two date conventions — *no shared vocabulary at all*

`today()` (`app.js:2789`) is `new Date().toISOString().slice(0,10)` — a **UTC** day, 26 call sites.
`isoDate(d)` (`app.js:5531`) builds from `getFullYear/getMonth/getDate` — a **local** day, 7 call sites.
`addDays` (`:2790`) parses the string as UTC, mutates in local, reads back in UTC.

Here the mechanism genuinely is *invent something that does not exist*: one `dayKey()` producer, one
`parseDay()` consumer, and integer-part arithmetic. This is the only one of the four where nothing correct
already exists to route through.

#### (c) `mk-tlserve` global vs `ev.serve` per-event — *and the split is inside one feature*

Sharper than the ULTIMATE states it. The serve **date** *is* already scoped —
`serveDateKey(){ return 'mk-tlservedate-'+evScope(); }` (`app.js:5532`). The serve **time** is not —
`'mk-tlserve'` is a bare literal at 12 sites (`4766, 5390, 5545, 5603, 5604, 5617, 5626, 5637, 7391, 7428,
7759, 7780, 7784, 7813`). `ev.serve` is a **third** representation, synced one-way at `7780`
(`if(e.serve) store.set('mk-tlserve',e.serve)`) and never written back.

So one feature carries two halves of one value under two different scoping regimes, plus a third copy on the
event record. **The mechanism is a keyspace schema** — see §2.3.

#### (d) `calc.cure` means dose in one schema and type in the other — *executed, confirmed*

```
$ python -c "import sources; ..."
makes with a calc override: 32
cure values: {'2.5': 19, 'None': 13}
salt overrides: 23
sample: [('m-bolo', {'cure': 2.5}), ('m-frank', {'cure': 2.5}), ...]
```

Against `app.js:1919` (`'Cure #'+calc.cure`) and `:1924` (`calc.cure==='2'`), where `cure` is `'1'|'2'` and
the rate lives in `calc.cureRate`. One key, two schemas, two units, two files.

And there is a **second, independent** defect stacked on it that the ULTIMATE reports but does not separate:
`gen_sources.py:59` *reads* at `makes_map[mid]['build']['calc']` and *writes* at `entry['calc']` — the
make's top level. `build.py:103` would therefore write `MAKES[mid]['calc']`, which nothing reads, while the
app reads `b.calc` (`app.js:2019`, `2027`). **The path is wrong in the writer even before `build.py:96-102`
skips it.** Fixing the skip alone would still deliver nothing.

The mechanism here is a **build-time assertion**, and the reason is structural: `build.py` has **zero**
`assert`, `raise`, or `sys.exit` statements —

```
$ grep -n "assert|raise |sys.exit|SystemExit" build.py
(no output)
```

— while emitting five `print()` calls (`:113, :116, :376, :429, :430`) that report exactly the conditions
that should fail it. `gen_sources.py:91-98` prints `"MAKE calc overrides (APPLIED via sources.py merge)"`.
Both files are **reporters**. Nothing in the pipeline can fail.

### 2.2 The fifth instance is refuted: the 483 `typeof` guards are not a module system and did not cause anything

The ULTIMATE (§1.6) says: *"`typeof X==='function'` appears 482 times across 427 lines… This is the de-facto
module system, and the structural cause of the 'inert shipment' failure mode."* §4.A.2 already refuted the
marquee example (`equipPlan` is called **unguarded**) but kept the general claim.

The general claim does not survive either. Script over `app.js`:

```
occurrences: 483   guarding a hoisted top-level fn: 477 (98.8%)
   NOT top-level: m 3 | fn 1 | scrollDown 1 | onDrop 1
distinct symbols guarded: 157   of those declared as a top-level function: 151 (+ async: 155)
top-level const/let/var among them: 0
```

`build.py:340`/`:378` inline all 9,564 lines into **one** `<script>` (`grep -o "<script" dist/index.html | wc
-l` → **1**). Top-level `function` declarations hoist across that whole script. Therefore
`typeof X === 'function'` is **tautologically true at every one of those 477 sites**. The six real ones are
legitimate: three guard `window.__aiMock` / `window.__vcTransMock` / `window.__vcAskMock` (test injection,
`4340, 5190, 5271`), and three guard locals (`4415, 4449, 9413`).

Three consequences for the program:

1. **They are not a module system.** A module system mediates a boundary. These mediate nothing; they are
   dead conditionals.
2. **They are not the cause of inert shipment.** Check every documented instance this project has actually
   paid for: `hooksOver` (computed, unread) — no guard. `scale_res` (shipped on 67 recipes, unread) — data,
   no guard. `_planSafetyViolations` (`5711`, written, never read) — no guard. `choosePlate`/`chooseNozzle`
   (`3014`/`3024`, zero callers) — no guard. `equipPlan` — refuted, unguarded (§4.A.2). **Zero of five.**
   The project's real inert-shipment mechanism is *an unread value or an uncalled function*, which a guard
   neither creates nor conceals.
3. **What they do cost is real but different:** they convert a future *deletion or rename* from a loud
   `ReferenceError` into a silent no-op, and they defeat "find all callers". That is a maintainability tax
   and a latent trap — not 483 defects, and not a program phase. **Do not budget a `typeof`-guard removal
   sweep as boundary work.** If it happens at all it is a low-value cleanup, and Chesterton's Fence applies
   to the six that are load-bearing.

### 2.3 A sixth instance the sweep does not name, and it is the biggest: the keyspace has no schema

**New finding — no sweep report contains it.**

Scoped storage-key *prefixes* are string literals repeated across `app.js`, with the builder function being
just one of the sites:

| Key family | Builder | Other sites that rebuild the format inline |
|---|---|---|
| `mk-plan-started-` | `planStartKey()` `5581` | `7484`, `7625`, `7692`, `7995`, `9503` — four of them do `localStorage.key(i).indexOf('mk-plan-started-')===0`, i.e. reverse-engineer the format by prefix scan |
| `mk-item-cooker-` | `setItemCooker` `241` | `244`, `5776` |
| `mk-tlstate-` | `tlStateKey()` `4883` | `7835` (`store.get('mk-tlstate-'+ev.id)`) |
| `mk-menuqty-` | `mkMenuqtyKey()` `2569` | `7893` |

And there is no single scope authority. Four scope functions exist and **two of them produce incompatible
namespaces for the same event**:

```js
evScope()  → 'cook' | <eventId> | 'draft'                                   // app.js:7743 — project-blind
seasCtx()  → 'proj:<id>' | 'ev:<id>' | 'ev:cur' | 'cook'                    // app.js:1075 — project-aware
liveScope()→ evScope()                                                       // app.js:5348
menuCtx()  → 'cook' | 'event'                                                // app.js:4702
```

For one event, `evScope()` yields `ev-abc` and `seasCtx()` yields `ev:ev-abc`. For a **project**, `seasCtx()`
yields `proj:<id>` while `evScope()` has no project branch at all and falls through to `'cook'`/`'draft'`.

This is the actual generator of B-i.2 (serve time), B-ii.9 (window singletons), B-ii.10 (`cardSess` keyed by
item only), B-iii.13 (checkbox keyed by translated label), B-iii.14 (⚡ toggle), and it is why G2 ("no unified
`mk-schema` migration registry") is not a nicety — **it is the precondition for changing any key**, see §4.

### 2.4 So: is "fix the boundaries" a real program? Yes — and it is smaller than it sounds

It is real, and it decomposes into exactly **four mechanisms**, three of which are wiring rather than
invention:

| Mechanism | Status today | Where |
|---|---|---|
| **A single source of truth per value** | Already built for capacity (`out.fit`), not used by 2 of 3 consumers | S3 |
| **A keyspace schema** — one scope authority, one builder per family, no inline formats | Does not exist. Four scope fns, formats duplicated 4-6× | S4 |
| **A build-time assertion layer** | Does not exist. `build.py` has zero asserts; every anomaly is a `print()` | S1 |
| **An egress chokepoint for model output** | Does not exist. `gemFetch` is a *transport* chokepoint only | S5 |

Runtime invariants are a fifth candidate and the codebase already has one — `safetyDiff` (`3039`) — which is
**correctly shaped and inert**: written at `5717`, read by nothing except
`tests/safety-invariant.spec.ts:81`. That test asserts `expect(violations).toEqual([])` — the absence of a
signal that has no consumer, which is a DoD-4 violation by this project's own gate. Types are *not* on this
list: there is no build step that could check them and adding one is a change to the whole toolchain (§5.6).

---

## 3. Common-cause clusters — where one structural fix closes several gaps

This is the answer to "141 tasks or ~30". **Nine clusters account for 71 of the 141 gaps.** The counts below
are my allocation and are stated as such; a gap appears in exactly one cluster.

### CC1 · Extract the plan pipeline from the render closure — **13 gaps**

**The finding.** `buildList`, `workPlanHtml`, `renderWorkplanShape`, `renderWpVertical`/`Accordion`/
`Horizontal`, `itemRowHtml` and `wireRows` are **all private closures inside `renderTimelinePanel()`**
(`app.js:5622`), which has exactly one caller (`openTimeline`, `:4893`):

```
5653:   function buildList(){          5934:   function renderWpVertical(...)
5771:   function workPlanHtml(...)     5945:   function renderWpAccordion(...)
5929:   function renderWorkplanShape(..)5952:   function renderWpHorizontal(...)
5957:   function itemRowHtml(...)      6028:   function wireRows(){
```

Nothing outside that closure can call any of them. The pipeline's **only export mechanism is five `window`
globals** — and the code says so itself at `:5775`:
`window._wpCtx={...};   // wireRows() is a sibling scope — hand it the context explicitly`.
A sibling function *inside the same closure* already needs a global to receive data.

That is why B-ii.9 exists. `window._wpTasks` is read at `5362` (`_copilotStages`), `5510`, `7432`; `_wpServe`
/`_wpStart` at `5567` — all **outside** the closure. The Live Cook Copilot is therefore downstream of a
render side-effect, which is the exact mechanism of the measured defect (*"opening Event B's timeline
re-pointed the copilot at B's tasks while A's session was still live"*). And it is why `combinedEventsRows`
(`7832`, top level) **cannot** reuse the pipeline and re-implements it from two of the five stages.

**Closes:** B-ii.9, B-iii.15 (copilot follows the wrong event), C3 (cross-event pipeline parity), B-i.3
(multi-day blocked in one view only), B-i.5 (advisory vs banner computed either side of the shift), B-i.6
(every cross-event clash called "Smoker"), B-i.7 (bath advice vs occupancy model), B-ii.8 (rendering the plan
writes user state — `st` *is* `allState[m.key]`, `5661-5670`, persisted at `5684`), C5 (non-uniform slack
silently discarded), C12 (copilot thinness — it can then read the plan directly), F-v.30, F-v.32, and it is
the **precondition** for C1/C2 (see §4).

**Not closed by it:** C4 and B-i.1 — `schedulePlacements`, `cookerContention` and `deviceOccupancy` are all
**top-level already** (`3089`, `258`, `438`). CC2 is independent of CC1. This is load-bearing for
sequencing and easy to get wrong.

### CC2 · One capacity verdict — **6 gaps**

Make `deviceOccupancy(...).fit.verdict` the only verdict; have `combinedEventsRows` read it and
`schedulePlacements` call `deviceOccupancy` instead of re-deriving from `deviceCapacity`+`itemOccupancy`.

**Closes:** B-i.1, C4, D11 (`✓ everything fits` as the empty-device fall-through, `674`), B-i.5 (the
temperature half: `bath-temp` fires on strict `p.temp!==r.temp` at `3137` while `tempOk` allows
`spread<=TEMP_TOL_C`=6 at `294`), F-v.31 (a volume overflow described as an *area* overflow, because `280`
sets `bad='area'` for any over-verdict), and one gap the sweep does not have — §5.4 below.

### CC3 · One stable task identity — **3 gaps + one precondition**

The checkbox key is `'wpck:'+sc+':'+tk.label` (`5938`) and every label is built through `L(he,en)`. A stable,
scope-qualified, language-independent identity **already exists** on the stage:

```js
s.tid='st-'+evScope()+'-'+m.key+'-'+s.kind+(n>1?n:'')   // app.js:5673, comment: "stable per-stage id
                                                        //  (kind-based, not array index)"
```

but only **1 of ~16** `tasks.push(...)` sites carries it forward (`5838`). The pattern for fixing that is
also already there: `5842` runs a post-pass loop assigning `ikey` to every task built in the iteration.

**Closes:** B-iii.13 (both halves — the language switch wiping ticks *and* three refuel rows at 19:15/20:00/
20:45 sharing one key), B-i.4 (the other two shapes gain something to key on), and it is the **precondition
for A6** (record the `bcheck` reading): a numeric measurement needs a durable row identity to attach to, and
today the row identity is a translated string.

### CC4 · One scope authority + a keyspace schema — **6 gaps**

Per §2.3. One `scopeOf(kind)`, one builder per key family, zero inline `'mk-…-'+id`, and reconcile
`evScope`/`seasCtx` onto one namespace (either `evScope` becomes project-aware or `seasCtx` stops prefixing).

**Closes:** B-i.2 (serve time), B-ii.10 (`cardSess` keyed by item only, `843`), B-ii.11 (`cookerFor`
conflates "no gear" with "needs a pick" — `null` at both `243` and `253`), B-ii.12 (`store.set`'s boolean
ignored at `8822`; the `try/catch` at `3641`, `8792`, `8822` are dead catches because `store.set` cannot
throw), B-iii.14 (see below), G2.

**B-iii.14 is a one-line fix and the sweep does not say so.** The correct dispatcher already exists:

```js
function ctxMethods(c,key){ return (typeof curProject!=='undefined'&&curProject)?activeMethods(c,key):cardMethods(c,key); }   // app.js:852
```

It is called by the card (`1011`, `2160`, `2174`). The **plan** calls `activeMethods` directly
(`itemProfile`, `2926`) — the store-only branch — so a `cardSess` write from `2186` can never reach it. The
write forks; the read does not. Route `itemProfile` through `ctxMethods` and the measured defect closes.
*(I did not run this; the call graph is verified, the behaviour is inferred.)*

### CC5 · An egress guard for model output — **6 gaps**

`gemFetch` (`4208`) is the single transport. There is no single egress. Guards are applied by each caller at
its own render line — `aiSafetyNote` at `4454`, `5464`, `9326`; `aiSafetyCaveat` at `8499`, `8664`;
`askRefuse` with **one** call site (`4448`). And **none of the 25 `vcSpeak`/`sysSpeak`/`gemSpeak` sites
passes caveat text at all.**

One `aiEmit(text, grounding, {speak})` through which every render *and* every speech path must pass.

**Closes:** A1 (`vcAskAI` 5269-5300), A2 (`vcTranslateToEn` 5186), A4 (diagnose has neither refusal nor
vetted grounding), A12 (guards never reach speech), A15, E12 (a single place to delimit user free text).
It also converts A3 (`aiSafetyNums`'s unit-blind non-capturing group, `4302-4306`) from *"fix it at the one
site that has it"* to *"fix it once for everything"* — A3 stays its own task, but its blast radius grows.

### CC6 · Build-time assertions — **6 gaps**

`build.py` fails the build when: an override `gen_sources.py` reports APPLIED is absent from the payload; a
language's coverage is below threshold; a `calc` schema is ambiguous; a JS string contains `</script`.

**Closes:** A11 (18 discarded salt overrides, `n-kabanos` 28 % low), B31 (5 stale `CRITICAL GAP` notes),
B24 (`_js_str` at `347-348` does not escape `</script`), F-i.1 (`build.py:376` already *prints*
`de: 83/3985 (2%)` on every run — the gate is one condition on that number, or on `app.js:6878` which derives
`I18N_LANGS` from whatever files exist), F-i.5, and it **surfaces** A10 (Kabanos) rather than fixing it.

### CC7 · Worker: bounded router + debit-before-forward — **6 gaps**

`worker/index.js` is 91 lines and every one of its defects is the same shape: the cap is checked at `:58`
against a value written at `:84`, after a multi-second upstream round trip at `:66`.

**Closes:** B-v.19 (`streamGenerateContent` admitted at `:43`; the meter at `:77-87` `JSON.parse`s the body
and reads `usageMetadata`, which is absent for a stream — and note `:74` `await gResp.text()` buffers the
whole response and `:89` relabels it `application/json`, so **streaming does not work through this proxy
anyway; removing it from the router costs nothing**), B-v.20 (fail-open at `:56` that never self-heals
because `:77`'s guard also fails, so the record is never rewritten), B-v.21 (read-modify-write race),
B-v.22 (no `AbortController` on the upstream fetch — asymmetric with `gemFetch`, which is careful about
exactly this), H2, H3.

### CC8 · Collapse the two localization mechanisms — **5 gaps**

The app translates the same DOM twice by two philosophies:

- **generative** — `L(he,en)` (`6896`) and `t(heb,fb)` (`6891`) resolve at string-construction time;
- **corrective** — `tnode` (`6907`) walks every text node via `createTreeWalker` *plus* a full
  `querySelectorAll('[placeholder],[aria-label],[title]')`, `applyI18n` (`6904`) substitutes
  `[data-i18n-html]`, `hydrateMT` (`6987`) sends `[data-mt]` prose to Gemini — all three re-armed by a
  `MutationObserver` on `document.body` `{childList, subtree}` at `9540`.

Every F-i and F-ii.8 gap is a consequence of running both. The observer's own comment states its safety
condition — *"tnode edits text values, not structure, so it never re-triggers itself"* — and an unrelated
component breaks it: `wireTimer`'s `tick` (`2338`, `setInterval(tick,250)`) writes `textContent`, which per
spec replaces the child Text node and **is** a childList mutation. **A component's invariant about another
component's behaviour, with nothing asserting it.**

**Closes:** F-ii.8 (62 % of wall-clock in long tasks with a timer running), F-i.2 (`'רענן עכשיו'` at `9553`
and `'בטל'` at `2776` are unrescuable by `tnode`'s prefix-strip regex *because they are corrective-path
problems* — as generative `L()` strings they are trivial), F-i.3 (`data-mt` collision: `methodToggleHTML`
emits it as a *domain value* at `1019`, `hydrateMT` reads it as *source text* at `6989` — one attribute
namespace, two owners), F-i.4, F-v.33. It also makes B-iii.13's label-as-key defect impossible to
reintroduce, because labels stop being post-hoc rewritten.

### CC9 · One day/instant vocabulary — **3 gaps**

`dayKey()` producing the local calendar day, `parseDay()` consuming it, `addDays` on integer parts, and a
ban on bare `new Date('YYYY-MM-DD')`.

**Closes:** A9, B-iv.18, C10 (the voice jump list drops the day marker at `5115` while the work plan has it
via `fmtClockRel` at `4881` — the same value formatted by two functions).

### 3.1 Cluster arithmetic, and what is left

| | Gaps |
|---|---|
| CC1 Extract the plan pipeline | 13 |
| CC2 One capacity verdict | 6 |
| CC3 One task identity | 3 |
| CC4 Scope authority + keyspace schema | 6 |
| CC5 AI egress chokepoint | 6 |
| CC6 Build-time assertions | 6 |
| CC7 Worker bounded + debit-first | 6 |
| CC8 Collapse localization | 5 |
| CC9 One day vocabulary | 3 |
| **Total collapsed** | **54 gaps → 9 structural changes** |
| Genuinely independent, code (§3.2) | ~55 |
| No code required (S10 point fixes + S11) | ~32 |

So the honest number is **not 141 and not 30**. It is roughly **9 structural changes + ~55 independent code
tasks + ~32 non-structural items**. The nine structural changes are where the leverage is; the ~55
independent ones are where the time is.

### 3.2 What looks related but is genuinely independent

This list is as valuable as the clusters, because each of these will *seem* to belong to a cluster and does not.

- **A5 (thermometer / 0.1 g-scale gates) is not part of the safety-invariant cluster.** A6 and A7 are about
  *reporting* an invariant; A5 is about *refusing to produce a plan*. No admission gate exists anywhere in
  the pipeline — this is new mechanism, not wiring. Its cure half is also not in S2 at all: it lives in the
  calculator, where `cureScaleGuardHTML` (`1849`) writes into `g` and lands at `guard.innerHTML=g` (`1928`)
  while the dose is computed at `1918` and rendered into `out.innerHTML=h` (`1927`). **Two DOM nodes; the
  output is byte-identical whether the warning fires or not.** Making it *block* means changing what `h`
  contains, which is a different edit in a different function from the plan-side gate.
- **A3 (unit-blind numeric guard) is a self-contained regex fix.** It does not need CC5 and CC5 does not need
  it. Do not bundle them; bundling makes a 10-line safety fix wait on a refactor.
- **E1 (model shutdown, 16 Oct 2026) clusters with nothing.** One constant at `4206`. Its cost is validation,
  and its only real dependency is E3 (CI) — see §4.
- **D5 (guest-count-scaled occupancy) is not part of CC2.** CC2 changes the *verdict*; D5 changes the
  *demand* (`itemOccupancy`, `356`). They compose but neither blocks the other. **Ordering caution in §4.**
- **B-v.27 (SHELL dedupe) and B-v.28 (a real 404) are one-liners in `build.py` and Cloudflare config.** They
  share a band with the Worker gaps and share nothing else.
- **F-iii.13 (`<main>` measures 0×0) is one structural fix that clears two audits** — `landmark-one-main`
  *and* the skip link going nowhere. It is the only a11y item with a multiplier; the other 16 in S10 are
  genuinely independent point fixes.
- **D1 (`choosePlate`/`chooseNozzle` uncalled) is not a boundary defect.** Nothing computes a value that
  disagrees with another. Two correct, tested functions have zero callers. It is a *missing feature* with the
  implementation already written — different work, different risk, and a much better ratio.
- **The 483 `typeof` guards are not a cluster and not a cause** (§2.2).

---

## 4. Architectural preconditions and ordering constraints

Each of these is a *hard* dependency — doing the later item first produces work that has to be redone or a
fix that cannot be verified. The audit's §7 has some of these; **P3, P5, P7 and P9 are not in it**, and P5
inverts one of its steps.

| # | Precondition | Because |
|---|---|---|
| **P1** | **A7 (surface `safetyDiff`) before C1/C2 (any solver or AI proposer)** | Stated by the audit and correct. Verified: `_planSafetyViolations` is written at `5711`/`5717` and read only by `tests/safety-invariant.spec.ts:81`. An invariant nobody sees cannot gate anything — and the test asserts the *absence of the signal*, so today it proves nothing about surfacing. |
| **P2** | **CC1 (extract the pipeline) before C3 (cross-event parity) and before fixing B-ii.9** | The globals are not a style choice; they are the closure's only export (`5775` says so). Removing them without extracting is not possible. |
| **P3** | **G2 (a `mk-schema` migration registry) before CC4 (scoping `mk-tlserve`) and before CC3 (re-keying `wpck:`)** | **Not in the audit.** Both changes alter keys holding *live user state mid-cook* — a serve time and a set of task ticks. There is today no migration mechanism (`grep` finds none; `tlState()` at `4884` does a hand-rolled one-off fallback to the legacy global). G2 is currently 🟡 Medium in §3.G.2; structurally it is a **blocker for two clusters**. |
| **P4** | **CC3 (stable task identity) before A6 (record the `bcheck` reading)** | A measured number needs a durable row to attach to; today the row identity is a translated label (`5938`). |
| **P5** | **CC6 (build assertions) before A10, A11, A14, B29 (the data corrections)** | **The audit puts this the other way round** (Step 5 comes after the data work is implied, and Step 5 item 1 bundles the assertion *with* the fix). The assertion must land first, because the mechanism that will silently drop the correction is the same mechanism that dropped the last one — `gen_sources.py` printed "APPLIED" for 18 values that were never applied (§5.5 of the ULTIMATE). Fixing the data without the gate is how this defect was created. |
| **P6** | **E3 (CI) before E1 (the model migration)** | Stated by the audit and correct. 413 tests that only run when a human types the command are not a migration net. |
| **P7** | **CC2 (one verdict) before D5 (guest-count demand)** | **Not in the audit.** D5 multiplies `footprint_cm2` by real party sizes; with three disagreeing verdicts, scaling demand scales the *divergence* between them. Ship D5 into a single verdict or the three surfaces diverge by a larger margin at exactly the sizes that matter. |
| **P8** | **CC2 before C1 (the solver)** | A proposer cannot evaluate a move when the three consumers disagree what a clash is. The audit says this (Step 7 before Step 11) and it holds. |
| **P9** | **The Playwright Hebrew-leak assertion (audit Step 5.2) before CC8 (collapsing localization)** | **Not in the audit as an ordering claim** — Step 5 lists the assertion, Step 9 does the leaks, and CC8 is not identified as a distinct change at all. The assertion is the only regression net for a change that alters how *every* string in the app gets translated. Write it first; it will fail, which is the point. |
| **P10** | **CC7 (Worker) and E2 (conditional `google_search`) before any of S11** | Stated by the audit and correct: the problem is unbounded cost, not missing revenue. Add one structural note — E2 changes the *unit* the Worker is metering, so doing E2 first makes CC7's budget parameters meaningful rather than notional. |

**Two non-dependencies worth stating**, because they look like dependencies:

- **CC2 does not depend on CC1.** `deviceOccupancy` (`438`), `cookerContention` (`258`),
  `schedulePlacements` (`3089`) and `combinedEventsRows` (`7832`) are *all top level*. The capacity model is
  already a module; only the plan pipeline is not. CC2 can run in parallel with everything.
- **CC5 does not depend on CC1 either.** The AI egress layer touches `app.js` in ~30 places, none of them
  inside `renderTimelinePanel` except `5464` (the copilot's `aiSafetyNote`, which is at top level anyway —
  `copilotAskNow` is `5448`, outside the closure).

---

## 5. Risky structural changes — where a fix plausibly breaks something else

Ordered by risk. For each: what breaks, and what would have to be true first.

### 5.1 Extracting the plan pipeline (CC1) — highest risk in the program

**What breaks.** 413 Playwright tests reach this pipeline only through the DOM and through the five window
globals. Live cook sessions, voice cook, the copilot and the occupancy view all read those globals from
outside (`5362`, `5510`, `5567`, `6053`, `7432`). An extraction that changes when a global is populated
changes behaviour for a *running cook*.

**What has to be true.** (a) Keep `_wpTasks`/`_wpCtx`/`_wpServe`/`_wpStart`/`_plcConflicts` as a
compatibility shim written by the extracted module until each consumer is migrated individually, so the
extraction and the consumer migration are separate, separately-revertible steps. (b) Run `safetyDiff` over
old-pipeline and new-pipeline output for the same input and assert equality — this is exactly what
`safetyDiff` was built for and it is the only assertion in the codebase that can prove the extraction is
behaviour-preserving. (c) Do it **after** P1 (surfacing), so a divergence is visible rather than pushed onto
an array nobody reads.

### 5.2 Routing `schedulePlacements` through `deviceOccupancy` (CC2) — changes scheduling behaviour

**What breaks.** Two things, and the second is not obvious.

1. **Performance.** `schedulePlacements` is currently pure over `computed` and touches `equipList()` once per
   device. `deviceOccupancy` is called per device *per mark* — the occupancy view already calls it in nested
   loops at `701` and `710`. Routing the placer through it puts a per-stage-per-device call on the rebuild
   path, which runs on every `input` event on the serve field (`5637`).
2. **The fit tolerance is not the same on both sides, so the verdict will change.** `FIT_SLOT_TOL=1.10` /
   `FIT_HARD_FACTOR=1.6` are used at **exactly one line in the file** — `508`, inside `deviceOccupancy`.
   `schedulePlacements` at `3144` tests `if(r.demandCm2>perSlot)` with **no tolerance**, and `packDevice` at
   `424-430` packs against raw `perSlotCm2`. Unifying the verdict will therefore *stop* the placer emitting
   `no-single-slot` for small overhangs. That is a real behaviour change and `tests/scheduler-placement.spec.ts:92`
   (`B4: a cooker with room leaves the plan alone`) is sensitive to placer behaviour.

**What has to be true.** The tolerance change must be specified and approved, not slipped in as a
refactoring side effect — it moves a capacity verdict, which is adjacent to safety even if it is not a `safe`
value. §4 Waiver Gate applies: this is a behaviour change inside a change presented as consolidation.

### 5.3 Re-keying `wpck:` and scoping `mk-tlserve` (CC3, CC4) — silent user-state loss

**What breaks.** A naive key change wipes a live cook's ticks and its serve time. Both are mid-cook state on
the one screen a user is looking at while food is on the fire.

**What has to be true.** P3 (a migration registry), plus read-both/write-new for at least one release. This
is the single most user-visible way this program could go wrong, and it is invisible to tests unless a test
seeds old-format keys and asserts they survive.

### 5.4 A latent divergence the sweep does not have — the tolerance fix landed in one of three paths

**New finding.** `app.js:298-303` documents why `FIT_HARD_FACTOR=1.6` exists:

> *"a 1320 cm² brisket on a 1275 cm² shelf — a 3.5 % overhang — was reported as 'fits nowhere' AND raised a
> clash banner"*

The ULTIMATE's §5.4 holds this up as *"the **good** version of §5.3 — the trade is recorded where a
maintainer will find it."* The trade *is* recorded. But the fix reached **one** of the three consumers.
`schedulePlacements:3144` still tests `r.demandCm2 > perSlot` with no tolerance. So for that same brisket:
`deviceOccupancy` → `1320 > 1275×1.10 = 1402.5`? No → `softItems` → verdict `'tight'`; `schedulePlacements`
→ `1320 > 1275`? Yes → `conflicts.push({reason:'no-single-slot'})` → the advisory at `3197` prints *"is
larger than any single shelf"*. **The exact regression the comment says was fixed is still live in the
scheduler.** *(Verified by reading all three sites; not reproduced in a browser.)*

This matters for the program in two ways: it is a seventh instance of the boundary thesis, and it is a
warning that "the trade is recorded" is not the same as "the trade was applied everywhere".

### 5.5 Surfacing `safetyDiff` (A7) — an unmeasurable false-positive rate

**What breaks.** `_planSafetyViolations` has never been surfaced, so its false-positive rate in the field is
unknown. A safety banner that fires spuriously mid-cook destroys trust in exactly the surface where trust is
the product. And there is **no analytics anywhere** (§3.G.3), so the rate cannot be learned before shipping
*or* after.

**What has to be true.** Honest answer: nothing available today makes this safe by measurement. The
mitigations are structural — surface it as a *diagnostic* to the user's own plan rather than an alarm, and
ship it behind the same gate as the extraction (§5.1) so a divergence introduced by the refactor is
distinguishable from one that was always there. **I am stating this as an unresolved risk, not solving it.**

### 5.6 Adding a bundler or types — the change the constraints forbid, and I am not recommending it

The single-file build is not an accident: `build.py` inlines 9,564 lines of `app.js` into one `<script>`
(`:340`, `:378`; `grep -o "<script" dist/index.html | wc -l` → 1), and that is *why* the 477 hoisted `typeof`
guards are inert (§2.2) and why the pipeline can be a closure at all.

**The cost of changing it, stated so the option can be rejected knowingly:** a bundler introduces a source
map requirement for every existing debugging habit, invalidates the `md5(html)[:8]` cache-name derivation at
`build.py:403`, and adds a toolchain to a project with **no CI** (§3.E.3) — i.e. a new failure mode with
nothing watching it. The four mechanisms in §2.4 are all achievable inside the current build. **My
recommendation is to keep the single-file build and buy the boundary guarantees with assertions, not with a
type system.** The one thing worth taking from the module world is the *discipline* — one producer per value
— not the tooling.

### 5.7 Making `google_search` conditional (E2) — a quality regression with no detector

**What breaks.** Ask-the-Fire currently grounds every question, including ones the app can answer locally.
Making it conditional means a routing predicate, and a wrong predicate makes answers quietly worse. There is
no eval on answer quality (E4: the grounding axis is untested — `grep -rl "aiValidateKeys\|aiValidateItems\|
aiValidateSeasonings" tests/` returns nothing, against validators at `app.js:4387`, `4394`, `8393`).

**What has to be true.** E4's missing grounding assertions before E2, or E2 ships a measurable quality
regression into the app's most prominent button. The audit puts both in Step 0/1 but does not order them;
**they must be ordered.**

---

## 6. Where I think the ULTIMATE document is wrong

It has been wrong 42 times by its own count, so this section is expected rather than adversarial.

1. **The `typeof` guard claim is wrong in its causal direction** (§2.2 above). §1.6 calls 482 guards "the
   de-facto module system, and the structural cause of the 'inert shipment' failure mode". 477 of 483 guard
   hoisted top-level function declarations in a single `<script>` and are tautologically true; zero of the
   five documented inert-shipment instances involves a guard. **Program consequence: do not fund a guard
   sweep as boundary work.**

2. **The note at lines 17-20 — *"`docs/analysis/sweep/W1-GRAPH-docs.md` … does not exist"* — is now false.**
   The file exists (28,249 bytes, written 11:16 on 2026-07-22; the ULTIMATE was written at 09:57). It
   contains findings the ULTIMATE therefore does not incorporate, including a Q4 contradiction set that
   partly overlaps §5.8 and partly does not — e.g. *"Competing home-screen strategies, never cross-
   referenced"* (`fire-guide-ux-refactor-prompt.md` vs `home-adaptive-design.md`, 0 EXTRACTED edges between
   them) and *"the 'honest fill' principle restated verbatim, twice, uncited"*. **The ULTIMATE should carry
   an errata line**, because that note reads as a permanent statement of coverage.

3. **Step 5's ordering inverts a dependency** (P5 above). Item 1 reads *"`build.py` fails the build if any
   override … is absent **then** fix the 18 salt values"* — which is the right order inside the item, but
   Step 5 sits after Steps 0-4 and the reasoning paragraph presents it as *preventive* action taken
   afterwards. Structurally the assertion is a **precondition** for any data correction, and it is cheap
   enough to sit in Step 0.

4. **§5.4 treats the `FIT_HARD_FACTOR` divergence as resolved.** It is not — the tolerance reached one of
   three consumers (§5.4 above).

5. **Two comments assert things the code does not do, beyond the five §5.7 lists.**
   - `app.js:7833` — *"occupancy-shaped entries feed the SAME model `cookerContention` uses — one clash rule
     for the whole app, not two"* — while `7882` and `280` use different predicates.
   - `app.js:9538-9539` — *"childList only (subtree) — tnode edits text values, not structure, so it never
     re-triggers itself"* — while `wireTimer`'s `tick` (`2338`) writes `textContent` every 250 ms, which is a
     childList mutation. This one is load-bearing: it is the stated safety condition of the mechanism that
     costs 62 % of wall-clock.

6. **B-iii.14's fix is smaller than the finding implies.** The dispatcher `ctxMethods` (`852`) already
   exists and is already used by the card; only the plan's `itemProfile` (`2926`) bypasses it. Framing it as
   "the ⚡ toggles do not reach the plan" invites a rewrite; the structural framing ("the write forks, the
   read does not") invites a one-line change.

7. **G2 is scored 🟡 Medium and is structurally a blocker.** Two of the nine structural clusters (CC3, CC4)
   cannot ship safely without a migration mechanism. Severity by *harm* is the right axis for a gap list and
   the wrong axis for a program.

---

## 7. What this implies for the shape of the program

- **Nine structural changes carry 54 of the 141 gaps.** They are the program. Everything else is either an
  independent code task (~55) or not architecture at all (~32).
- **The single highest-leverage change is CC1** (extract the plan pipeline) at 13 gaps, and it is also the
  riskiest. It should not be first. **CC6** (build assertions, 6 gaps) and **CC7** (Worker, 6 gaps) are
  cheap, isolated, and unblock other work — they should be.
- **The boundary thesis is worth adopting as the program's organising frame**, with the correction that it is
  four mechanisms and not one, and that three of the four already exist in the codebase and simply are not
  used at every consumer. The characteristic shape of this codebase is not *missing* structure — it is
  **structure built correctly and then bypassed by one of its consumers**: `out.fit` bypassed by
  `schedulePlacements`, `ctxMethods` bypassed by `itemProfile`, `tlStateKey()` bypassed by
  `combinedEventsRows`, `planStartKey()` bypassed by four prefix scans, `s.tid` bypassed by the checkbox key,
  `mtGuard` bypassed by `vcTranslateToEn`, `FIT_SLOT_TOL` never reaching the placer.
- **That shape has a cheap detector and the project already owns it**: `safetyDiff` is the pattern — compute
  the same thing twice and assert agreement. There are exactly four values in this system worth that
  treatment: the capacity verdict, the serve instant, the day key, and the set of active methods per item.
  **Four assertions, not a refactor** — which is the same argument the ULTIMATE makes in Step 5, generalised
  from three to four and moved earlier.
