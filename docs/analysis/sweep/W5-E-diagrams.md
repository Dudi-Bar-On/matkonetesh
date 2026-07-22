# W5-E · The system in four diagrams

**Date:** 2026-07-22 · **Version:** v258 (`build.py:334` footer stamp) · **Scope:** `app.js` (9,564 lines),
`build.py` (430), `worker/index.js` (91), `sources.py` (4,931), `data.py` (1,012), `app.css` (1,710).

**Method.** Every box, arrow and label below was read out of the current files, not carried over from a prior
report. Each node carries the `file:line` it was drawn from, so a reader can falsify any edge in one `grep`.
Where a diagram asserts an *absence* (no consumer, no guard), the absence was measured — the measuring
command is printed beside it. Numbers restated from Wave 1 reports were re-measured here; where my
measurement differs from theirs, mine is shown and the difference is named.

---

## (a) System architecture — one file, built by Python, served by Cloudflare

```mermaid
flowchart TB
  subgraph AUTHOR["Authoring · Python source of truth"]
    direction TB
    D1["data.py<br/>CUTS 130 · SPECIALS 47 · MAKES · GLOSSARY · BUILDS<br/>1,012 lines"]
    D2["sausages_new.py<br/>NEW_SAUSAGES 52 · ORIGINS"]
    D3["seasonings.py + seasonings_ext.py + seasoning_tags.py<br/>deduped &amp; tagged · build.py:9-25"]
    D4["descriptions.py · house_rub_map.py"]
    D5["sources.py<br/>CUT_SOURCES · SPEC_SOURCES · MAKE_SOURCES<br/>4,931 lines · AUTO-GENERATED, do not hand-edit"]
    D6["equipment_map.py<br/>apply · derives recipe.equip"]
    RJ["scratch/research/*.json<br/>per-item cited research"]
    GS["gen_sources.py<br/>writes sources.py · lines 83-88"]
    RJ --> GS --> D5
  end

  subgraph FE["Front-end source"]
    A1["app.js · 9,564 lines<br/>no ES modules · global scope"]
    A2["app.css · 1,710 lines"]
    A3["lang/en.json 309 keys<br/>lang/en.data.json 3,677 keys<br/>fr/de/es 83 keys each"]
  end

  subgraph BUILD["build.py · the only build step"]
    B1["merge sausages + descriptions + seasonings<br/>build.py:29-82"]
    B2["merge cited sources into items<br/>build.py:85-105<br/>NOTE: 'calc' key deliberately SKIPPED :96-102"]
    B3["equipment_map.apply<br/>build.py:110-116"]
    B4["payload dict -> DATA_JSON<br/>build.py:118-127"]
    B5["lang/*.json + *.data.json merged per code<br/>-> I18N_DICTS_JSON · build.py:352-377"]
    B6["HTML template string<br/>build.py:129-342<br/>__CSS__ __JS__ __DATA__ __I18N_DICTS__<br/>substituted at :378"]
    B1 --> B2 --> B3 --> B4 --> B6
    B5 --> B6
  end

  subgraph OUT["Build output"]
    O1["index.html · repo root<br/>build.py:382 · 2,701,065 bytes<br/>dev server + Playwright + manual upload"]
    O2["dist/index.html<br/>build.py:389 · byte-identical"]
    O3["dist/sw.js<br/>build.py:404-425<br/>cache name = 'mk-' + first 8 hex of md5 of the built html · :403"]
    O4["dist/_headers<br/>:427 · no-cache html/manifest/sw<br/>immutable png"]
    O5["dist/ icons + manifest<br/>site/ flattened :393-399"]
  end

  subgraph RUN["Runtime · the browser"]
    R1["single-file PWA<br/>Hebrew-first RTL · mobile-first 390px"]
    R2["localStorage via store.get/set<br/>app.js:1433-1435<br/>quota failure -> mkStorageWarn :1438"]
    R3["service worker<br/>registered app.js:9562<br/>catch is EMPTY - install failure invisible"]
    R4["ONE outbound fetch site<br/>gemFetch app.js:4208-4236<br/>AbortController + backoff + BYOK fallback"]
  end

  subgraph NET["Network"]
    N1["Cloudflare Pages<br/>wrangler.toml pages_build_output_dir='dist'"]
    N2["Cloudflare Worker · worker/index.js<br/>holds GEMINI_KEY secret<br/>gate: X-Access-Code vs KV CODES :50-60"]
    N3["generativelanguage.googleapis.com<br/>gemini-2.5-flash · app.js:4205-4207"]
  end

  D1 --> B1
  D2 --> B1
  D3 --> B1
  D4 --> B1
  D5 --> B2
  D6 --> B3
  A1 --> B6
  A2 --> B6
  A3 --> B5
  B6 --> O1
  B6 --> O2
  B6 --> O3
  B6 --> O4
  B6 --> O5
  O2 --> N1 --> R1
  R1 --> R2
  R1 --> R3
  R1 --> R4
  R4 -->|"mode=managed<br/>app.js:4214-4215"| N2
  R4 -->|"mode=byok<br/>x-goog-api-key header"| N3
  N2 -->|"server-side key<br/>worker/index.js:66-70<br/>NO timeout"| N3

  classDef data fill:#4299e1,stroke:#2b6cb0,color:#fff
  classDef proc fill:#ed8936,stroke:#c05621,color:#fff
  classDef out  fill:#48bb78,stroke:#2f855a,color:#fff
  classDef net  fill:#9f7aea,stroke:#6b46c1,color:#fff
  class D1,D2,D3,D4,D5,D6,RJ,A1,A2,A3 data
  class B1,B2,B3,B4,B5,B6,GS proc
  class O1,O2,O3,O4,O5,R1,R2,R3,R4 out
  class N1,N2,N3 net
```

**What the picture makes visible**

- There is exactly **one** build step and exactly **one** outbound network call site. Both are chokepoints,
  which is why both are worth guarding hard.
- `index.html` and `dist/index.html` are written from the same `html` string (`build.py:378,382,389`) and are
  byte-identical on disk today (2,701,065 bytes each, measured). **Tests read the root copy; Pages serves
  `dist/`.** They can only diverge if someone edits one by hand.
- The service-worker cache name is derived from the content hash of the built HTML (`build.py:403`), so every
  build invalidates cleanly — the mechanism behind "v255 reached the server but not the device" being fixed.
- `app.js` has **no module system**. Its de-facto one is the existence check: `typeof X==='function'`
  appears **482 times across 427 lines** (`grep -o "typeof [A-Za-z_$]*==='function'" app.js | wc -l` = 482;
  `grep -c` = 427). W1-A reported 483; the one-count difference is a regex-variant artifact and does not
  change the finding. A broken wire-up therefore no-ops instead of throwing — the structural cause of the
  inert-shipment failure mode that diagram (b) traces concretely.

---

## (b) The plan pipeline — menu to tasks

```mermaid
flowchart TB
  M["menu / wizard state<br/>guests · appetite · keys · serve time<br/>mk-menu · mk-tlserve"]
  SV["serveDateTime<br/>app.js:5655"]

  S1["itemStages meta, method, ready, order<br/>app.js:3213-3263<br/>emits prep/sv/dry/smoke/cook/rest<br/>+ bcheck when safe or tgt is numeric :3260-3261"]
  SNAP["_safeBefore snapshot<br/>kind · hours · temp · safe<br/>app.js:5672"]
  S2["equipPlan meta, method, stages, scope<br/>app.js:973-986 · called app.js:5673<br/>ENRICH ONLY: adds fuelNote / refuelEveryMin<br/>returns Object.assign copies"]
  TID["stable per-stage tid<br/>app.js:5675 · kind-based, not index"]
  S3["planSchedule stages, serveMs<br/>app.js:2978-2992 · called :5678 and :7850<br/>backward relaxation - EVERY item ends at serve<br/>hours coerced Number||0, never NaN"]
  APPLY["placements applied onto stages<br/>s.start / s.end · app.js:5679"]
  S4["schedulePlacements computed, scope<br/>app.js:3089-3177 · called :5691<br/>packs against real device capacity<br/>moves stages EARLIER only"]
  SHIFT["uniform per-item shift applied<br/>app.js:5693-5707 · readyEarlyMs"]
  SD["safetyDiff base, now<br/>app.js:3039-3052 · called :5716"]

  V1["window._plcConflicts<br/>app.js:5692"]
  V2["window._planSafetyViolations<br/>app.js:5711-5717"]

  ADV["_schedAdviceHtml conflicts, computed<br/>app.js:3182 · called :5739<br/>named remedy per conflict reason"]
  TASKS["task list build<br/>app.js:5815 bcheck task<br/>icons :5953 · timeline rows :5993"]
  UI["work-plan HTML · timeline · voice cook<br/>app.js:5159-5161 speaks bcheck target"]
  TEST["tests/safety-invariant.spec.ts:81<br/>asserts the array is empty"]

  M --> S1
  SV --> S3
  S1 --> SNAP
  S1 --> S2 --> TID --> S3 --> APPLY --> S4
  S4 --> V1
  S4 --> SHIFT --> SD
  SNAP --> SD
  SD --> V2
  V1 --> ADV --> UI
  APPLY --> TASKS --> UI
  V2 -.->|"ONLY reader"| TEST
  V2 -.->|"NO production reader"| X["nothing"]

  classDef gen  fill:#4299e1,stroke:#2b6cb0,color:#fff
  classDef proc fill:#ed8936,stroke:#c05621,color:#fff
  classDef ok   fill:#48bb78,stroke:#2f855a,color:#fff
  classDef dead fill:#e53e3e,stroke:#9b2c2c,color:#fff
  class M,SV,S1,SNAP gen
  class S2,TID,S3,APPLY,S4,SHIFT,SD proc
  class V1,ADV,TASKS,UI,TEST ok
  class V2,X dead
```

**Two facts this diagram was drawn to expose**

1. **The cross-event path skips two stages.** The single-event work plan runs
   `itemStages → equipPlan → planSchedule → schedulePlacements → safetyDiff` (`app.js:5671,5673,5678,5691,5716`).
   The cross-event view runs only `itemStages → planSchedule` (`app.js:7840,7850`) — measured:
   `grep -n "equipPlan(\|schedulePlacements(\|safetyDiff(" app.js` returns call sites at 5673, 5691, 5716 and
   nowhere else. The dedup comment at `app.js:7847-7849` is about `planSchedule` only, and is accurate about
   what it claims. Equipment enrichment and capacity placement are single-event features today.

2. **`window._planSafetyViolations` is inert.** It is written at `app.js:5711-5717` and read by exactly one
   thing: `tests/safety-invariant.spec.ts:81`. Measured:
   `grep -rn "_planSafetyViolations" app.js tests/` returns 3 hits in `app.js` (all writes) and 1 in tests.
   The code comment above it (`app.js:5709-5710`) says a violation is *"recorded and surfaced rather than
   quietly shipped into a cook"* — it is recorded, but "surfaced" resolves to a global variable no renderer
   reads. Contrast the sibling on the very next lines: `window._plcConflicts` (`:5692`) **is** consumed, at
   `app.js:5739`, and reaches the user as advisory HTML. Same shape, same function, one wired and one not.
   This is the single cleanest specimen of the failure mode in the codebase, and it is why skill (b) below exists.

---

## (c) Safety architecture — what is ENFORCED and what is only advisory

Legend: **ENFORCED** = the output differs, or the operation is refused, when the control fires.
**ADVISORY** = the control emits text; the computed output is byte-identical either way.
**INERT** = the control computes a verdict nothing in production consumes.

```mermaid
flowchart LR
  subgraph ENF["ENFORCED — output changes or the move is refused"]
    E1["equipPlan cannot alter a stage<br/>app.js:973-986<br/>only fuelNote/refuelEveryMin are writable<br/>structural, not checked-after"]
    E2["placement carries start/end of the SAME length L<br/>app.js:3126 L=endMs-startMs · :3172 duration carried through<br/>no representation exists for a different duration/temp/order"]
    E3["SCHED_PULL_MAX_MS = 2h<br/>app.js:3065 · enforced :3168-3170<br/>past the bound it REFUSES to reschedule -> conflict"]
    E4["deviceCanReach dev, tempC<br/>app.js:3083-3087 · called :3106<br/>unknown maxC claims nothing; over-ceiling -> 'temp-ceiling' conflict, never silently planned"]
    E5["bath-temp / bath-too-small / hooks / no-single-slot / no-window<br/>app.js:3133-3159 · each pushes a conflict"]
    E6["mtGuard / mtSafe numeric invariant<br/>app.js:6951-6958 · gate at :6980<br/>a translation that changes ANY number is REJECTED, Hebrew source returned"]
    E7["askRefuse -> askRefuseCardHTML<br/>app.js:4197-4202 · ONE production call site :4448<br/>the model is not called at all"]
    E8["aiValidateKeys<br/>app.js:4387 · called :8320<br/>invented keys dropped"]
    E9["esc before innerHTML<br/>app.js:1447-1448"]
    E10["build.py:96-102 skips sources' stale calc<br/>load-bearing: 32/102 MAKE_SOURCES carry a calc override<br/>and 19 of those set cure=2.5, a bare number that would<br/>clobber the '1'/'2' type discriminator"]
  end

  subgraph ADVIS["ADVISORY — text only, computed output identical"]
    V1["bcheck stage<br/>emitted app.js:3260-3261<br/>rendered :5815 task · :5993 timeline · :5159-5161 spoken<br/>no field records a reading · nothing blocks progression"]
    V2["cureScaleGuardHTML<br/>app.js:1849-1874 · 3 call sites :1899,:1911,:1920<br/>says 'botulism risk'; the dose is unchanged either way"]
    V3["aiSafetyNote / aiSafetyCaveat<br/>app.js:4293-4326 · 5 render sites<br/>:4454 ask · :5464 copilot · :9326 photo<br/>:8499 diagnose · :8664 journal"]
    V4["safe / tgt values displayed on cards"]
    V5["_schedAdviceHtml<br/>app.js:3182 · :5739<br/>names the remedy, applies nothing"]
  end

  subgraph INERT["INERT — verdict computed, no production consumer"]
    I1["safetyDiff -> window._planSafetyViolations<br/>app.js:3039 / :5711-5717<br/>only reader tests/safety-invariant.spec.ts:81"]
  end

  subgraph GAP["UNGUARDED — free-text model output with no control on the path"]
    G1["Voice Cook Q&amp;A · app.js:5269-5300<br/>gemFetch + tools google_search<br/>answer SPOKEN via vcSpeak :5296<br/>MEASURED: 0 occurrences of askRefuse / SAFETY_FACTS / aiSafetyNote / aiSafetyCaveat in lines 5255-5310"]
    G2["Diagnose · app.js:8499<br/>no askRefuse; only the ungrounded aiSafetyCaveat"]
    G3["worker/index.js:56<br/>malformed KV record -> rec={active:true}<br/>passes the :57 disable check AND skips the :58 cap check<br/>fails OPEN"]
  end

  classDef enf   fill:#48bb78,stroke:#2f855a,color:#fff
  classDef adv   fill:#ed8936,stroke:#c05621,color:#fff
  classDef inert fill:#a0aec0,stroke:#4a5568,color:#fff
  classDef gap   fill:#e53e3e,stroke:#9b2c2c,color:#fff
  class E1,E2,E3,E4,E5,E6,E7,E8,E9,E10 enf
  class V1,V2,V3,V4,V5 adv
  class I1 inert
  class G1,G2,G3 gap
```

**The shape of the safety architecture, stated plainly**

The controls that are *structural* — where the forbidden move has no representation — are the ones that hold:
`equipPlan` can only add two named fields (`app.js:980-984`); a placement is a start/end pair of the same
length (`app.js:3126,3172`); a translation that changes a number cannot be returned (`app.js:6980`). The
controls that are *procedural* — a warning rendered next to an unchanged number — are advisory by
construction: `bcheck` and `cureScaleGuardHTML` both name a lethal hazard and neither alters a byte of output.

That split is a coherent product position ("informed cook, not an interlock"), and W1-E reached the same
conclusion independently. The two items that do **not** fit the position are the red boxes: an answer
*spoken aloud, hands-free, mid-cook*, web-grounded, with none of the five guards on its path
(`app.js:5269-5300`), and a corrupted KV record that grants unmetered access (`worker/index.js:56`).

**Guard coverage, measured rather than asserted**

| Guard | Definition | Production call sites | Measured with |
|---|---|---|---|
| `askRefuse` | `app.js:4197` | **1** — `:4448` | `grep -n "askRefuse(" app.js` |
| `aiSafetyNote` | `app.js:4315` | 3 — `:4454, :5464, :9326` | `grep -n "aiSafetyNote(" app.js` |
| `aiSafetyCaveat` | `app.js:4293` | 2 — `:8499, :8664` | `grep -n "aiSafetyCaveat(" app.js` |
| `SAFETY_FACTS` | `app.js:4121` | 2 — `:4141, :9326` | `grep -n "SAFETY_FACTS" app.js` |
| `deviceCanReach` | `app.js:3083` | 1 — `:3106` | `grep -n "deviceCanReach(" app.js` |
| `safetyDiff` | `app.js:3039` | 1 — `:5716` (output unread) | `grep -n "safetyDiff" app.js` |
| `cureScaleGuardHTML` | `app.js:1849` | 3 — `:1899, :1911, :1920` | `grep -n "cureScaleGuardHTML(" app.js` |

Four AI features call the model with free text. One of them (`:4448`) is behind `askRefuse`. The voice path is
behind nothing.

---

## (d) Data and citation flow — why grepping `data.py` says "0 citations"

```mermaid
flowchart TB
  R["scratch/research/*.json<br/>per-item researched values + ref/url/note<br/>cut-*.json · spec-*.json · make-*.json"]
  G["gen_sources.py<br/>:39-56 build src blocks from sv/smoke/safe/grill/cure/process<br/>:57-69 MAKE: emit calc override ONLY for changed salt/cure<br/>:83-88 write sources.py"]
  S["sources.py · 4,931 lines<br/>CUT_SOURCES keyed by int n<br/>SPEC_SOURCES keyed by int n<br/>MAKE_SOURCES keyed by str id"]

  DP["data.py · 1,012 lines<br/>CUTS · SPECIALS · MAKES<br/>carries NO 'src' key at all"]
  NS["sausages_new.py<br/>NEW_SAUSAGES 52"]

  MG1["build.py:29 MAKES.update NEW_SAUSAGES<br/>MUST run before coverage is counted"]
  MG2["build.py:87-89 · each CUT updated from CUT_SOURCES, keyed by c.n"]
  MG3["build.py:90-92 · each SPECIAL updated from SPEC_SOURCES, keyed by sp.n"]
  MG4["build.py:93-103 · each MAKE updated from MAKE_SOURCES<br/>copies every key EXCEPT 'calc' · skip at :96-102"]

  P["payload · build.py:118-126<br/>cuts · specials · glossary · builds · makes · seasonings · houseRub"]
  J["DATA_JSON · build.py:127<br/>wrapped as a JSON.parse string literal · build.py:344-348,378"]
  APP["app.js:2 const DATA = __DATA__<br/>279 top-level src blocks ship:<br/>130 cuts + 47 specials + 102 makes"]

  R --> G --> S
  DP --> MG1
  NS --> MG1
  MG1 --> MG2 --> MG3 --> MG4 --> P --> J --> APP
  S --> MG2
  S --> MG3
  S --> MG4

  TRAP1["TRAP 1 · grep 'src' data.py -> 0<br/>and the conclusion '0 citations, S3 NOT DONE' is FALSE<br/>the merge happens at build time, in a different file"]
  TRAP2["TRAP 2 · count MAKE_SOURCES coverage without :29<br/>-> false '52 orphaned citations'<br/>W1-E hit this and disproved it by replaying the pipeline"]
  TRAP3["CONTRADICTION · gen_sources.py:91-92 comment says<br/>'MAKE calc changes are applied at build time ... so they are DONE'<br/>build.py:96-102 SKIPS 'calc'. Both are live in the tree."]

  DP -.-> TRAP1
  MG1 -.-> TRAP2
  MG4 -.-> TRAP3

  classDef data fill:#4299e1,stroke:#2b6cb0,color:#fff
  classDef proc fill:#ed8936,stroke:#c05621,color:#fff
  classDef out  fill:#48bb78,stroke:#2f855a,color:#fff
  classDef trap fill:#e53e3e,stroke:#9b2c2c,color:#fff
  class R,S,DP,NS data
  class G,MG1,MG2,MG3,MG4 proc
  class P,J,APP out
  class TRAP1,TRAP2,TRAP3 trap
```

**The same trap, one layer up: i18n**

`build.py:352-366` merges `lang/<code>.json` **and** `lang/<code>.data.json` into a single
`I18N_DICTS[code]` before the app ever sees them. At runtime `getDict()` (`app.js:6889`) returns that merged
object, and `toast()` (`app.js:2775`) looks the message up in it. Measured key counts:

| File | Keys | Hebrew toast literals it covers |
|---|---|---|
| `lang/en.json` | 309 | 1 |
| `lang/en.data.json` | 3,677 | 48 |
| **merged `I18N_DICTS.en`** | **3,985** — 1 key overlaps | **48 of 53** |

Source: `docs/analysis/sweep/_toast-verification.txt`, reproduced here by loading both JSON files
(`python -c "import json; len(json.load(open('lang/en.json')))"` → 309; `en.data.json` → 3,677).

Checking `en.json` alone yields "55 of 56 toasts untranslated." Checking the merged dictionary — the thing the
code actually reads — yields "5 missing." **Two separate auditors on this project reported the first number.**
Both had read a real file and measured it correctly. Neither had traced the path the running code takes.

That is the whole content of skill (a) below, and this diagram is its evidence.

---

## Measurements taken for this document

Every number above was re-measured here rather than copied. Three inherited figures changed under
measurement — recorded so the next reader inherits the corrected ones:

| Figure | Inherited | Measured here | How |
|---|---|---|---|
| Shipped `src` blocks | 279 (W1-E) | **279 confirmed** — 130/130 cuts, 47/47 specials, 102/102 makes | replayed `build.py:29,87-103` merge in Python and counted items carrying `src` |
| `typeof X==='function'` guards | 483 (W1-A) | **482 occurrences across 427 lines** | `grep -o "typeof [A-Za-z_$]*==='function'" app.js \| wc -l` |
| Merged `I18N_DICTS.en` keys | 3,986 (implied by 309+3,677) | **3,985** — one key appears in both files | `dict(en); update(en_data); len()` |
| `MAKE_SOURCES` stale `calc` overrides | "32 of 102 where cure is the bare number 2.5" (W1-E) | **32 carry a `calc` override; 19 of those set `cure=2.5`**, the other 13 override `salt` only | `Counter(repr(v['calc'].get('cure')))` over `MAKE_SOURCES` |

None of these changes a conclusion. All three are the same lesson at small scale: a number restated is a
number unverified.

## Cross-references

- `W1-A-code.md` — architecture map of `app.js`, dead code, worker findings.
- `W1-B-conformance.md` — spec-to-code, the toast mechanism established empirically.
- `W1-D-nonfunctional.md` — i18n/PWA/perf/a11y (finding #1 superseded by the merged-dictionary measurement above).
- `W1-E-food-safety.md` — HACCP mapping and the 279-citation verification.
- `W1-F-ai.md` — the AI surface and the unguarded voice path.
- `docs/process/skills/verify-against-the-runtime-path/SKILL.md` — the discipline that would have caught traps 1-3.
- `docs/process/skills/no-inert-shipment/SKILL.md` — the discipline that would have caught `_planSafetyViolations`.
