# VERIFY — W1-B Conformance (adversarial re-check)

Verifier stance: refute first. Every claim below was re-derived from the repo independently of the
report's own evidence — fresh greps, fresh reads at the cited lines, one full `python build.py`, and one
live Playwright run of 23 tests (log quoted below). Nothing in the report was accepted on its own say-so.

**Verification evidence run in this session (fresh):**

- `python build.py` → `[i18n] de: 83/3985 keys vs en (2%)`, `es: 83/3985 (2%)`, `fr: 83/3985 (2%)`;
  `git status --porcelain index.html dist/index.html` → clean (build is idempotent; no source modified).
- `npx playwright test tests/i18n-foundation.spec.ts tests/occ-css-tokens.spec.ts tests/equip-chooser.spec.ts
  tests/occ-fit-ladder.spec.ts tests/occ-devname.spec.ts tests/prefs.spec.ts --reporter=list`
  → **23 passed (14.1s)**, 0 failed. (A zombie listener on :8123 from an earlier run had to be killed first;
  it was refusing connections on both `::1` and `127.0.0.1`. No config or source file was edited.)
- `node -e` count of `"hang":` keys in the **built** `dist/index.html` → **28**. This replicates the build
  pipeline (`data.py` + `sources.py` + `equipment_map.py` → `dist/index.html`) rather than grepping a
  single source file, per the standing rule.

---

## Counts

| Verdict | Count |
|---|---|
| **CONFIRMED** | 57 |
| **REFUTED** | 4 |
| **UNVERIFIABLE** | 2 |

Scope of the count: every row in the six per-doc tables (42), the 4 "Contradictions", the 4 "Inert-shipment"
rows, the 10 "Orphaned commitments", the by-design non-consumer note, the Doc-6 T3 detail section, the 2
"could not be verified" caveats, and the methodology header — 63 distinct assertions.

---

## REFUTED (4)

All four refutations are of the report's **hedges, caveats and one methodology figure** — not of its defect
findings. The report systematically *under*-claimed on things that are in fact verifiable, and got one
number wrong. Every substantive defect finding survived refutation.

### R1 — Doc 2 T4's caveat is refuted; the clause is fully verifiable and fully met

**Report says (line 34):** "Not independently re-verified line-by-line against all 3 theme blocks (would
require a full app.css diff) — verified via the passing test."

**Refutation.** The premise ("3 `:root` blocks") is wrong, and the shipped code is correct in a way the
report's hedge obscures:

- `app.css` contains exactly **one** `:root` block (`app.css:2`). The Phase-2 tokens live there:
  `app.css:17` `--over:#c2553f; --over-l:#f7e4de;` and `app.css:18` `--grate:#e9d7bf; --cool:#8fb8c9; --cooll:#eef4f6;`.
- The other two CSS theme blocks the plan meant are `html.light,html.t-vintage` (`app.css:390`) and
  `html.t-gold` (`app.css:437`) — and both are **dead legacy**. `applyAppearance` strips them on every
  paint: `app.js:6997` `el.classList.remove('light','t-vintage','t-gold');   // clear dead legacy classes permanently`.
- The real themes are the JS `THEMES` object (`app.js:6840-6848`), applied as inline custom properties
  (`app.js:6999` `Object.entries(th).forEach(([k,v])=>el.style.setProperty(k,v));`). **All four** themes —
  `cream`, `charcoal`, `walnut`, `slate` — define all five diagram tokens (`--over`, `--over-l`, `--grate`,
  `--cool`, `--cooll`) with theme-appropriate values (e.g. charcoal `--over:'#e8795f'` vs cream `'#c2553f'`).
- `tests/occ-css-tokens.spec.ts:24-26` states this explicitly in a comment and asserts it:
  `expect(dark.over).not.toBe(cream.over)`. That test **passed live in this session**.

Verdict: Doc 2 T4 is **DONE and independently verified**. The "would require a full app.css diff" caveat
should be struck — it took one grep, and had the report run it, it would have found that the plan's own
"three `:root` blocks" wording described a mechanism the app no longer uses.

### R2 — "DONE by strong inference" for Doc 3 T3/T4 and Doc 5 T3/T4 is refuted; all four are directly citable

**Report says (line 160):** "Doc 3 Tasks 3-4 (form rendering, chips) and Doc 5 Tasks 3-4 (tip/note porting,
concierge) were confirmed present by symbol-existence and passing-test-file evidence, not by re-reading
every line… Treat those rows as DONE-by-strong-inference."

**Refutation — direct citations, obtained in under a minute:**

- Doc 3 T3 (render props in device form, core inline / pro `<details>`): `app.js:6603` `const propField=function(p){`;
  `app.js:6622-6623` `const coreProps=_props.filter(function(p){return p.tier==='core';}).map(propField).join('');`
  and the matching `p.tier==='pro'` line. Field ids at `app.js:6609,6613,6619` (`id="eqProp-${esc(p.key)}"`),
  read back at `app.js:6538,6557`.
- Doc 3 T4 (property chips with icons): `app.js:6388` `const chipsFor=function(d){`, with the property-chip
  block at `app.js:6394-6398` handling `kind==='bool'` / `'choice'` / numeric-with-unit, each emitting
  `<span class="eq-chip">…<span class="em">${p.em}</span>…`.
- Doc 5 T3 (port five helpers off `gearState()`): `app.js:932` `function smokerTip()`, `app.js:953`
  `function preheatHint()`, `app.js:987` `function gearMissingHelp(c, methods)`, `app.js:1026`
  `function gearThermoNote(c)`, `app.js:8139` `function wcimGearOk(meta)`. All five read
  `equipConfigured()`/`primaryOf()`/`hasCat()`, and `grep -c "gearState" app.js` → **0** (not merely the
  function definition — zero references of any kind).
- Doc 5 T4 (concierge emits device-list entries): `app.js:6144` `function gearConciergeApply(g, level)`.

Verdict: these four rows are **CONFIRMED outright**, not by inference. The caveat is refuted.

### R3 — Orphan #9 is refuted as "not confirmed"; it is confirmable and confirmed

**Report says (line 153):** "the dead `data-i18n=` markup (build.py) flagged as a deferred cleanup…
not independently re-verified in this sweep (would require a `build.py` grep outside the time budget),
listed here as a claim worth a follow-up check, not a confirmed finding."

**Refutation.** The grep costs one command and settles it. `build.py` ships **13** `data-i18n="…"`
attributes and **1** `data-i18n-ph="…"` attribute (e.g. `build.py:163,166,171,175,176,183,205,217,224,231,240,250,252,253,254`).
The only runtime reader of any `data-i18n*` attribute is `applyI18n` (`app.js:6905`), and it queries
**exclusively** `[data-i18n-html]`:

```js
function applyI18n(root){ const d=getDict(); if(!d) return; const H=d.__html__||{}; const r=root||document;
  r.querySelectorAll('[data-i18n-html]').forEach(function(el){ … });
}
```

`grep "querySelectorAll('\[data-i18n" app.js` returns only lines 6905 and 6926 — both `[data-i18n-html]`.
There is **no** reader for plain `data-i18n=` or for `data-i18n-ph=` anywhere in the repo. `build.py` ships
exactly one `data-i18n-html=` (line 166), which is the only one that works.

Verdict: **CONFIRMED dead markup** — 14 of 15 `data-i18n*` attributes in `build.py` are never read. The
strings still get translated, but by `tnode`'s Hebrew-source text-walker (`app.js:6907`), not by the
attribute mechanism. The deferred cleanup is genuinely outstanding. Upgrade orphan #9 from
"worth a follow-up check" to a confirmed finding.

### R4 — The methodology header's "63 occupancy specs" is wrong

**Report says (line 3):** "two live Playwright runs (63 occupancy specs; the 3 `i18n-foundation` specs…)".

**Refutation.** `ls tests/occ*.spec.ts | wc -l` → **19** files; `cat tests/occ*.spec.ts | grep -c "^test("`
→ **86** tests. Neither 19 nor 86 is 63, and no subset boundary in the file list produces 63. The figure
does not correspond to any countable set of occupancy specs in the repo. This does not invalidate any
finding — the individual test names the report cites (`O1`–`O25`, `C1`–`C7`, `H3a`–`H3d`, `W4`/`W6`) all
exist and I re-ran a sample green — but the stated run size is unsupported and should be corrected or dropped.

---

## UNVERIFIABLE (2)

1. **"Tests pass live" for the ~14 occupancy specs I did not re-run.** I re-ran 6 spec files (23 tests, all
   green). The report also asserts live passes for `occupancy-model`, `occupancy-clash`, `occupancy-hanging`,
   `occupancy-multievent`, `occupancy-view`, `occ-silhouette`, `occ-view-{cabinet,offset,grill,vessel,bay}`.
   I confirmed every cited test **name** exists at the cited numbering (O1–O25 in `occupancy-model.spec.ts`,
   C1–C7 in `occupancy-clash.spec.ts`, H3a–H3d in `occupancy-hanging.spec.ts`), but did not re-execute them.
   Settleable by running the suite; simply not re-run here.
2. **Commit `92961db`'s "Full suite 366/366 green" (Doc 2 T10 evidence).** This is a claim about a past run
   preserved in a commit message. It cannot be settled from the repo now — the suite has 82 spec files today
   and the count has moved. The report treats the commit message as evidence of the §10.2 viewing discipline;
   the *four named UI-only defects* in that message are real and specific (RTL leak, tile clipping, LTR gutter
   overlap, sous-vide "1 racks" mislabel), which is genuine corroboration, but "366/366" itself is unverifiable.

---

## CONFIRMED — the substantive defect findings all survive

Each of these I tried to break by looking for the thing elsewhere, under another name, or via another
mechanism. None broke.

### C1 — `PROP_BOUNDS` never shipped (Doc 3 T5 / Contradiction 2). CONFIRMED.

`grep -rn "PROP_BOUNDS" .` (whole repo, excluding node_modules) → hits in **only two places**: the plan doc
(`docs/superpowers/plans/2026-07-20-equipment-properties-completion.md:624` and `:642`, where the plan
literally prescribes `const PROP_BOUNDS={maxC:[40,600], …}` and `const b=PROP_BOUNDS[p.key];`) and the sweep
report itself. **Zero hits in `app.js`, `dist/index.html`, `index.html`, `build.py`, or any test.** The
shipped mechanism at `app.js:6354-6363` is:

```js
    const rc=propCoerce(p, v); if(rc) props[p.key]=rc.v;              // null -> no unit interpretation works -> skip
```

i.e. per-prop `bounds`/`alt` via `propCoerce` (`app.js:149`) rather than a central map. Behaviour-equivalent
(arguably better), symbol absent. The report's characterisation is exact.

### C2 — `choosePlate` / `chooseNozzle` are inert; `chooseBath` is not. CONFIRMED.

Repo-wide grep (`app.js`, `index.html`, `dist/index.html`, `tests/`, `*.py`):

- `chooseBath` — defined `app.js:3004`, **called in production** at `app.js:630` inside `_occVesselBody`.
- `choosePlate` — defined `app.js:3014`; the **only** other occurrences are `tests/equip-chooser.spec.ts:20,51,74`.
- `chooseNozzle` — defined `app.js:3024`; the **only** other occurrences are `tests/equip-chooser.spec.ts:20,64,74`.

I then tried to refute the deeper claim ("no UI or work-plan ever reads that answer") by hunting for an
equivalent join under a different name: `grep "grind_mm|grindMm|plates|casingMm|nozzle"` and Hebrew
`grep "פלטה|פלטות|פייה|פיות"` over `app.js`. Every hit is either **capture** (`app.js:90,95` `multiCap`
declarations; `app.js:6342-6345,6651` AI-lookup ingestion) or **display** (`app.js:6391` chip rendering) —
never a match/warn. `equipPlan` (`app.js:973`) contains no plate or nozzle logic. There is no
recipe↔device join for grinder plates or stuffer nozzles anywhere. **Inert confirmed.**

### C3 — i18n Doc 6 T3: the plan's literal mechanism was not applied; a dictionary path delivers the outcome. CONFIRMED, and I traced the full runtime path rather than one artifact.

Three independent legs, all checked:

1. **The named sites are still raw Hebrew literals.** `app.js:4740`
   `function copyText(t){…toast('הרשימה הועתקה ✓');…toast('הועתק');}`; also `app.js:3468, 3537, 3566, 3641,
   5306, 6098` — none wrapped in `L(...)`. (Other, later toasts *are* `L()`-wrapped — `app.js:4556, 5069,
   5209, 5335, 6033, 6541, 7455, 7783, 7788, 8017, 8050, 8052, 9495, 9506` — so the mechanism exists and was
   used elsewhere; it simply was not applied to Task 3's table.)
2. **The runtime path that saves it.** `toast()` (`app.js:2775`) does
   `const _d=(typeof getDict==='function')?getDict():null; const tr=(s)=>(_d&&_d[s]!=null)?_d[s]:s;` and
   `getDict()` (`app.js:6889`) is `return (getLang()==='he')?null:(I18N_DICTS[getLang()]||{});` — so English
   gets a real dict, not `null`. I parsed `lang/en.data.json` directly (3677 keys) and confirmed the mappings:
   `הרשימה הועתקה ✓`→`List copied ✓`, `הועתק`→`Copied`, `הפרויקט נמחק`→`Project deleted`,
   `התזכורת נמחקה`→`Reminder deleted`, `הרישום נמחק`→`Entry deleted`, `האזנה כבויה`→`Listening off`.
   This is the same mechanism that made prior false alarm (3) a false alarm — checked here deliberately.
3. **The test was rewritten.** `tests/i18n-foundation.spec.ts:35` is now
   `test('Change 3: interpolated toasts render English in English mode', …)` with the verbatim comment
   `// standalone toasts are already dict-covered; interpolated ones (e.g. restore-count) can never be dict keys`,
   and it drives `importData`, not `copyText`. The plan's own Step 1 test (line 176 of the plan) called
   `setLang('en'); copyText('hello');`. That test no longer exists. **Ran live this session: it passes.**

Verdict: a real plan↔code↔test divergence. DoD met, documented path abandoned, regression coverage narrowed.
The report's framing ("genuine plan/code contradiction, not a false alarm") holds.

### C4 — Doc 1 T7 supersession. CONFIRMED, including the "documented, not silent" qualifier.

The Phase-2 plan's **Naming note** is verbatim at `docs/superpowers/plans/2026-07-21-occupancy-view-phase2.md:38`:
"new CSS classes are prefixed `occ2-` to avoid colliding with the current `.occ-*` block (app.css:1628) during
the rewrite; the old `.occ-*` block is removed in the final task once nothing references it."
Current state: `grep -cE "occ-(bar|item|slots|warn|empty|unknown|hang|facts|dev|h)\b" app.js` → **0**;
`grep -c "\.occ2-" app.css` → **59**; the only surviving `.occ-` rules in `app.css` are lines **1635-1639**
(`.occ-wrap`, `.occ-scrub`, `.occ-scrub input[type=range]`, `.occ-scrubrow`, `.occ-scrubrow b`) — which is
**exactly** T10 Step 1's explicit "**Keep** `.occ-wrap`, `.occ-scrub`, `.occ-scrubrow`" list, and all five are
still referenced from `app.js:690,691,739,742`. T7's survivors are present: `app.js:688 occupancyViewHtml`,
`app.js:714 openOccupancyView`, `app.js:728 _occSpan`. T10 is met to the letter.

### C5 — Doc 2 T2's post-ship refinement. CONFIRMED with the exact code.

`app.js:298` `const FIT_HARD_FACTOR = 1.6;`. `app.js:299-303` is the rationale comment naming the real
regression ("a 1320 cm² brisket on a 1275 cm² shelf — a 3.5% overhang… was reported as 'fits nowhere' AND
raised a clash banner"), then `app.js:303` `const FIT_SLOT_TOL = 1.10;`. The shipped test at `app.js:509` is
`const hard = it.cm2 > cap.perSlotCm2 * (cap.areaMeasured ? FIT_SLOT_TOL : FIT_HARD_FACTOR);`.
The plan's own Step 3 (plan lines 199-215) prescribes only `FIT_HARD_FACTOR` and states "When the user
entered a real area, there is no slack (any overflow is hard)" — behaviour that the shipped code
deliberately no longer implements. Divergence real, in-code rationale real, tests green live
(`occ-fit-ladder.spec.ts` 3/3 this session).

### C6 — Doc 4 (prefs) rows and the 7-knob non-consumer note. CONFIRMED at every cited line.

`app.js:5464` reads exactly `…aiSafetyNote(r.txt, (r.ctx||''))…`; the other two call sites are `app.js:4454`
(`aiSafetyNote(r.txt, r.ctx)`) and `app.js:9326` (`aiSafetyNote(txt, (typeof SAFETY_FACTS==='function'?SAFETY_FACTS():''))`)
— `copilotVoiceContext()` appears at none of them, matching T1's "no other call site launders" gate.
`app.js:6801 const PREFS=`, `6827 function pref(key)`, `6832 function setPref(key, val)`,
`6864-6866` (`themeKey`/`fontPairKey`/`fontScale` one-line delegations), `7026 uiLevel`, `7028 tlShapeOverride`,
`7053 function openPrefGroup()`. All three `pref('units')` gates verified with full line text at
`app.js:4242, 4345, 5264`. Orchestrator-knob consumers: `grep -c "pref('<k>')"` → **0** for every one of
`autonomy, shareTolC, woodSwap, holdEnabled, aiRank, slotModel, holdMaxH`, and the design intent is verbatim
at plan line 199 (`// They intentionally render NO hub UI yet (no consumer = no dead controls).`).
`tests/prefs.spec.ts` has exactly 5 tests (P1–P5) — I counted `^test(` and re-ran them: **5/5 green**.

### C7 — Doc 5 deletions and Doc 1/Doc 3 citations. CONFIRMED.

`grep -c "function openGear(\|function gearState(\|function saveGear(\|function gearSetConfigured(" app.js` → **0**,
and `grep -c "gearState" app.js` → **0** (stronger than the report's claim: not just the definitions, every
reference is gone). `app.js:6377 function openEquipment()`. Doc 1 spot-checks all land on the claimed
constructs: `37/51/62` `key:'areaCm2'` (smoker/grill/oven), `142-144` the three area conversions,
`258 cookerContention`, `305 deviceCapacity`, `356 itemOccupancy(meta, stageKind, dev)`,
`375 occupancyCompat`, `438 deviceOccupancy`, `453` the `c.devId` pre-resolution, `516 out.hooksOver`,
`517 out.compat`, `736 _occWire`, `7832 combinedEventsRows`. Doc 3: `106 propSpec`, `117 propDef`,
`122 propOf`, `131 UNIT_CONV`, `149 propCoerce`, `6218 key:'cooler'`, `90 multiCap:{key:'plates'…}`.
`tests/equipment-props.spec.ts` has exactly 12 `^test(` — matching the report.

### C8 — Doc 1 T6 hang count = 28, from the build. CONFIRMED via the pipeline, not a source grep.

`equipment_map.py:373-381` holds `_HANG_RE`, `_HANG_LONG_RE`, `_hang_class`. Counting in the **built**
artifact (`node -e` over `dist/index.html`, after a fresh `python build.py`) → **28** `"hang":` keys,
inside the plan's own [10,40] sanity gate. Grepping `data.py` alone would have returned nothing here —
the merge happens at build time, which is why this was checked in `dist/`.

### C9 — Orphaned commitments 1-8 and 10. CONFIRMED at source.

`grep -c "PREF_PRESETS\|prefPreset" app.js` → **0**; the deferral is verbatim at prefs-plan line 21.
`grep -n "autopilot" app.js` → exactly **one** hit, `app.js:6814`
`autonomy: {store:'mk-pref-autonomy', def:'advise', valid:['advise','propose','autopilot']}` — a validator
enum, not logic. Doc 5's "Phase 3 (auto-optimize + live)" is verbatim at plan line 532. Doc 3's deferral of
the grinder-plate join is verbatim at plan line 24 ("belongs to the **consumption layer**… blocked on this one").
Doc 1's deferrals of Spec §3 and §5 C2 are at plan lines 1220 and 1222 (the report cites 1220-1221 — off by
one, immaterial). Doc 6's follow-on note is verbatim at plan line 346. The fr/de/es 2% figure is reproduced
by my own build run. Orphan #10 is confirmed: the plan's "Known limitation" paragraph still reads as open at
plan line 1224 while `app.js:453`/`app.js:7832` show it resolved — a documentation-freshness gap, correctly
classified as not a functional one.

---

## Bottom line

The report's four contradictions and its inert-shipment findings all **survive adversarial re-checking**
with independent evidence. Its errors run in the *conservative* direction: three things it declined to
verify are in fact verifiable and check out (R1, R2, R3), and one methodology figure is wrong (R4). No false
alarm of the kind that has burned this project three times before was found — notably, the i18n finding was
re-derived through the real `toast() → getDict() → I18N_DICTS.en` runtime path and the parsed
`lang/en.data.json`, not from a single dictionary file, and the hang-spec count was taken from the built
artifact rather than a source grep.
