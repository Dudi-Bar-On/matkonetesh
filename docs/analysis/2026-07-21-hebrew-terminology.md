# Hebrew terminology audit — occupancy / equipment / work-plan surface

**Trigger:** owner report — *"all the devices including sous vide have title ovens"*.
**Root cause confirmed:** the Cooker-occupancy feature (v247–249 era) uses **תנור** ("oven") as the
generic word for *any* cooking device, but `EQUIP_CATS` already reserves תנور/Oven for one specific
category (`app.js:60`, `{cat:'oven', he:'תנور', en:'Oven'}`). A smoker, a charcoal grill and a
sous-vide bath all get grouped under a panel titled "תפוסת **התנורים**" — literally "occupancy of
**the ovens**".

Verified live: built `dist/index.html`, served on `:8123`, drove it with Playwright at 390×844,
`mk-lang=he`, a seeded kit (smoker + grill + sous-vide + probe), and a 6-item menu spanning all
three device types. Screenshot of the actual bug:

> **תפוסת התנורים** / מה נמצא על כל תנור, ומתי
> [ארון / קבינט — 4 מדפים] [פחם — 1 מדפים] **[טבילה (immersion) — 74°C · עצים שונים]** ← the
> sous-vide bath, sitting inside a panel titled "the ovens".

English was also checked (`mk-lang=en`): it already reads **"Cooker occupancy"** / **"Cooker
clash"**, which is correct BBQ jargon and matches the internal function vocabulary
(`cookerFor`, `cookerContention`, `cookerCandidates`, `cookerLabel` — all pre-existing identifiers).
The bug is Hebrew-only.

---

## Part 1 — recommendation for the generic term

### Hebrew: **מכשיר** (singular) / **מכשירים** (plural) — "device"

Optionally qualified as **מכשירי בישול** ("cooking devices") only in first-use / title contexts
where "מכשירים" alone could be read as the full kit (grinder, scale, vacuum sealer, etc.).

**Why this word and not the alternatives:**

1. **It's already the app's own word for this concept.** `equipSectionHtml`'s device-list
   subheader already does this correctly: `app.js:5698`
   `` `${list.length} ${L(list.length===1?'מכשיר':'מכשירים', ...)}` `` → live-verified as
   "6 מכשירים · 5 קטגוריות". The occupancy feature didn't need to invent new vocabulary — it needed
   to reuse what `equipSectionHtml`/`openEquipment` already established. This also fixes the
   Hebrew/English *and* cross-feature consistency in one move: "device(s)" already means the same
   thing on both sides of the app.
2. **It's the owner's own word.** The bug report itself says *"all the **devices**... have title
   ovens"* — that's the native speaker's spontaneous term for the concept, in his own complaint.
3. **It doesn't collide with `EQUIP_CATS`.** No category is called "מכשיר"; תנור/מעשנה/גריל/סו-ויד
   are all specific category names, so "מכשיר" is free to mean "any one of them."
4. **Correct gender/number, no new grammar to get wrong.** מכשיר is masculine; מכשיר/מכשירים is a
   completely regular singular/plural pair, unlike hedges such as "כלי" (also used for a
   spatula/utensil — too small-scale) or "מתקן" (rig/installation — reads odd for a compact
   sous-vide circulator sitting in a pot).
5. **Precedent for word length/register in this app's titles.** Existing `toolTop` titles run
   2–4 words routinely ("מדריך עצים ופחמים", "רמת ממשק", "מתזמן ציר-זמן") — "תפוסת מכשירים" fits
   that register exactly.

**Rejected alternatives and why:**
- **כלי בישול** — "כלי" primarily reads as a hand tool/utensil (סכין, מלקחיים) in this app's own
  vocabulary (see `EQUIP_OTHER_ITEMS`); calling a $2,000 offset smoker a "כלי" undersells it and is
  not how a pitmaster would refer to it.
- **אמצעי בישול** — grammatically fine but bureaucratic/legalistic register; nothing else in the
  app's voice sounds like this.
- **מתקן** — plausible for a smoker/grill rig, but strained for a sous-vide immersion circulator
  or a probe; and unlike "מכשיר" it has zero precedent elsewhere in the app.

### English: **keep "Cooker"**

"Cooker" is standard American BBQ-pitmaster jargon for exactly this class of thing (smoker, grill,
kettle — "what cooker are you running today"), it already matches ~15 internal identifiers
(`cookerFor`, `cookerLabel`, `cookerContention`, `cookerCandidates`, `cookerCatForKind`,
`cookerStripHtml`, `data-tlcooker`, `data-cookermove`, …), and it usefully distinguishes this
narrower "thing that holds food while cooking" concept from the broader "device/equipment" used
for the full kit (probe, scale, vacuum sealer). Live-verified: "Cooker occupancy" and "Cooker
clash" both render correctly today — no English changes needed.

---

## Part 2a — every site to change (the תנור/Cooker bug)

| # | File:line | Current (Hebrew) | Proposed (Hebrew) | English | Why |
|---|---|---|---|---|---|
| 1 | `app.js:415` | `לא הוגדרו תנורים.` | `לא הוגדרו מכשירי בישול.` | *(unchanged: "No cookers configured.")* | Empty-state message in `occupancyViewHtml`; "תנורים" wrongly implies only ovens are missing. |
| 2 | `app.js:445` | `תפוסת התנורים` (panel title) | `תפוסת מכשירים` | *(unchanged: "Cooker occupancy")* | The reported bug itself — `openOccupancyView`'s `toolTop` title. Drop the definite article "ה-" to match the shorter chip label at site 6 and existing 2-word title register. |
| 3 | `app.js:445` | `מה נמצא על כל תנור, ומתי` (subtitle) | `מה נמצא על כל מכשיר, ומתי` | *(unchanged: "What is on each cooker, and when")* | Same call, subtitle text. |
| 4 | `app.js:5203` | `שיוך תנור/מעשנה:` | `שיוך מכשיר:` | *(unchanged: "Assign cooker:")* | `cookerStripHtml` label in `workPlanHtml`. Doubly wrong as written: implies "oven" is a real option (it never is — `cookerCandidates()` only returns smoker/grill/sous-vide) and redundantly appends "/מעשנה" as if smoker weren't already covered by "תנור". |
| 5 | `app.js:5204` | `התנגשות תנור` (in `contentionHtml`) | `התנגשות מכשיר` | *(unchanged: "Cooker clash")* | `workPlanHtml`'s clash advisory heading. |
| 6 | `app.js:5214` | `תפוסת תנורים` (indefinite, mchip button) | `תפוסת מכשירים` | *(unchanged: "Cooker occupancy")* | Button that opens the occupancy view from the work-plan toolbar. Already indefinite (no "ה-") — matches the corrected site 2, closing a definite/indefinite inconsistency between the two "Cooker occupancy" surfaces (see Part 2b, finding 3). |
| 7 | `app.js:5232` | `title="${L('התנגשות תנור','Cooker clash')}"` (tooltip, `renderWpVertical`) | `התנגשות מכשיר` | *(unchanged)* | Same string, vertical work-plan row tooltip. |
| 8 | `app.js:5238` | `title="${L('התנגשות תנור','Cooker clash')}"` (tooltip, `renderWpAccordion`) | `התנגשות מכשיר` | *(unchanged)* | Same string, accordion work-plan row tooltip. |

Sites 5/7/8 are the same `L('התנגשות תנור','Cooker clash')` literal repeated at three call sites —
change all three together (they must stay identical to each other).

**Count: 6 distinct string literals, 8 call sites.**

---

## Part 2b — broader Hebrew-quality findings, ranked

### 1. (Highest) Grill "heat zones" are mislabeled as "shelves" — but *only* in the occupancy panel

This is a second, independent bug beyond the תנור wording, and it is worse because it's not just
imprecise vocabulary — it's a factually wrong label, and it's inconsistent with the very same data
shown correctly two screens away.

- `deviceCapacity()` (`app.js:301`) collapses two semantically different capacity concepts into
  one field: `const racks=Number(dev.cap&&(dev.cap.racks||dev.cap.zones))||0;` — a grill's
  **heat zones** get silently aliased into the generic `racks` slot.
- `occupancyDevHtml()` (`app.js:401`) then renders that field with a hardcoded, category-blind
  label: `` `🗄️ ${cap.racks} ${he?'מדפים':'racks'}` ``.
- Result, live-verified: a grill with 1 heat zone shows **"1 מדפים"** ("1 shelves") in the
  Cooker-occupancy panel.
- Meanwhile the exact same device, same data, in **My Equipment** (`chipsFor`, `app.js:5666`,
  which correctly reads `c.capHe`/`c.capEn` per category) renders **"2 אזורי חום"** ("2 heat
  zones") — correctly — for a grill with 2 zones. Screenshots taken in this audit show both: the
  occupancy view says "מדפים", the equipment list for a grill says "אזורי חום".

**Fix:** `deviceOccupancy()`/`occupancyDevHtml()` need the category's actual `capHe`/`capEn`/
`capKey` (already on `EQUIP_CATS`) instead of a hardcoded "מדפים"/"racks" — the same pattern
`chipsFor` already uses correctly. This is a logic fix, not just a string edit.

### 2. Singular/plural mismatch when a device count is interpolated (recurring pattern, 4 sites)

The brief specifically called this out as "the very common bug," and it recurs at every site where
a count is concatenated with a Hebrew noun *without* the `n===1 ? singular : plural` ternary the
codebase uses correctly elsewhere (e.g. `app.js:5698`'s `מכשיר`/`מכשירים` and `nProbe===1?'פרוב':'פרובים'`
right next to the bug at finding #4 below). None of these are hypothetical — the mechanism is
directly visible in the code; only the specific `n=1` render wasn't forced during this session's
click-through (a 4-rack smoker and a 2-zone grill were the seeded fixtures).

| Site | Bug | At n=1 renders | Should render |
|---|---|---|---|
| `app.js:401` (`occupancyDevHtml`) | `${cap.racks} ${he?'מדפים':'racks'}` — no ternary | "1 מדפים" | "מדף אחד" or "1 מדף" |
| `app.js:5666` (`chipsFor`, My Equipment cards) | `d.cap[c.capKey]+' '+L(c.capHe,c.capEn)` — `capHe` is plural-only for every category (`מדפים/שבכות`, `אזורי חום`, `מדפים`, `ערוצים`) | "1 אזורי חום" / "1 ערוצים" / "1 מדפים" | singular form per category |
| `app.js:5702` (probe channel count, My Equipment capabilities footer) | `${probeChannels()} ${L('ערוצים','channels')}` — no ternary, **on the same line** as a correctly-done `nProbe===1?'פרוב':'פרובים'` ternary three tokens earlier | "1 ערוצים" | "ערוץ אחד" |
| `app.js:5274` (`itemRowHtml`, work-plan wood-reload hint) | `${Math.max(1,...)} ${L('פעמים','times')}` — no ternary | "כ-1 פעמים" | "פעם אחת" |

Finding #5702 is the most telling: the *same template literal* gets the probe-count agreement right
(`nProbe===1?'פרוב':'פרובים'`) and the channel-count agreement wrong three words later — clear
evidence this isn't a knowledge gap, it's a per-call-site habit that isn't systematically enforced
(see the proposed rule below).

### 3. Definite/indefinite inconsistency between the two "Cooker occupancy" entry points

`app.js:445` titles the panel **"תפוסת התנורים"** (definite, "the ovens' occupancy") while
`app.js:5214`'s button that opens the same panel says **"תפוסת תנורים"** (indefinite). Both map to
the same English "Cooker occupancy" in both places (English has no such inconsistency — English
already reads the same both times). Fixed together with the main rename (Part 2a, sites 2 and 6),
by standardizing on the shorter indefinite form everywhere.

### 4. `שיוך תנור/מעשנה:` doubly misnames its own content

Beyond the generic-term issue: the label lists "תנור" and "מעשנה" as if they were two different,
separate options ("oven/smoker") being offered side-by-side. In reality `cookerCandidates()`
(`app.js:230`) never returns an oven-category device at all — the slash construction is not just
imprecise, it names something that isn't actually selectable in the dropdown underneath it. Folded
into the Part 2a fix (site 4).

### 5. (Low priority, cosmetic) Smoker's capacity label hedges two nouns at once

`EQUIP_CATS` smoker entry (`app.js:35`): `capHe:'מדפים/שבכות'` ("shelves/grates") — a deliberate
hedge since smoker racks vary by design (flat mesh shelves vs. open grates), but it reads a little
cluttered as a chip label (e.g. "4 מדפים/שבכות"). Not incorrect, and lower priority than the two
findings above — flagged only because the brief asked specifically about shelf/grate/rack
precision. No action recommended beyond awareness; splitting it per-type would add complexity for
a cosmetic gain.

### Not a problem (verified, listed for completeness)

- Domain terms — קרום (bark), שבכה/רשת (grate), אמבט (bath), מעטה (casing), ראב (rub), עטיפה
  (wrap) — are used correctly and consistently throughout `app.js` (spot-checked ~30 occurrences
  across cut-specific step generators, the troubleshooting FAQ, and the equipment/spec surfaces).
- Loanwords (סו-ויד, ואקום, בריסקט) are standard Israeli BBQ usage and read naturally.
- Mixed-direction number/unit strings (°C, סמ״ר, %, ל׳, מ״מ) render correctly in the live
  Hebrew screenshots taken for this audit — no bidi breakage observed at 390px.
- `equipSectionHtml`'s "✓ יש לך · ✗ חסר לך" / "מכשירי הבישול שלי" surface and `openEquipment`'s
  "מה אפשר לבשל" capability row are both good examples of natural, native-sounding Hebrew UI copy —
  worth using as the house style reference when writing new strings in this area.

---

## Part 2c — systemic rule to adopt

**Rule 1 — reuse, don't reinvent, category-boundary vocabulary.** Before introducing a new Hebrew
noun for "the thing(s) the user owns/uses," grep `EQUIP_CATS` and the equipment-surface functions
(`equipSectionHtml`, `equipChip`, `openEquipment`) for whether the concept already has a name.
`EQUIP_CATS`' `he`/`en` fields are the single source of truth for category names — any new feature
that needs a *generic* word one level up (i.e., "any one of these categories") should default to
**מכשיר/מכשירים** ("device(s)") rather than picking a fresh word, precisely because that is what
broke here: "תנור" was reached for as a plain-language stand-in for "cooker" without checking that
`EQUIP_CATS` already owns that exact word for one category.

**Rule 2 — a shared pluralization helper, not an inline ternary per call site.** Add one small
helper, e.g. `heCount(n, singular, plural, en)` (or reuse the existing `L()` convention by wrapping
it: `Lc(n, [heSing, hePlur], en)`), and require every count+noun interpolation in Hebrew strings to
go through it instead of hand-writing `n===1?'X':'Y'` — or worse, omitting the check entirely. The
current codebase already has the *correct* pattern in at least two places
(`app.js:5698`, `app.js:5702`'s probe-count) proving the team knows the rule; what's missing is a
single reusable call so it can't be silently skipped at the next call site (as happened three
tokens later on that very same line, and in `occupancyDevHtml`, `chipsFor`, and the work-plan wood
reload hint). A lint-style grep before shipping — search for `he?'` or a bare Hebrew plural noun
directly adjacent to a `${...}` count — would also catch this class of bug in review.

**Rule 3 — capacity/label pairs must travel together.** `EQUIP_CATS[*].capKey`/`capHe`/`capEn`
exist specifically so a category's capacity count and its label never drift apart. Any function
that reads a capacity number (`deviceCapacity`, `occupancyDevHtml`, or any future occupancy/summary
view) must resolve the label through the *same* category lookup the number came from, not a
hardcoded string — otherwise, as happened here, a grill's zones silently borrow a smoker/oven's
"racks" label the moment the code takes a shortcut for convenience (`app.js:301`'s
`dev.cap.racks||dev.cap.zones` aliasing).

---

## Verification log

- `python build.py` — built clean, 130 cuts / 47 specials / 52 glossary.
- `node serve.js 8123` (prior stray listener on the port killed first).
- Playwright at 390×844, `localStorage['mk-lang']='he'`, equipment seeded via `equipSave()`
  (smoker/grill/sous-vide/probe), 6-item menu (בריסקט, ספייריבס, אסאדו, פסטרמה בקר, פיקאניה,
  טומאהוק) spanning smoker+grill+sous-vide stages.
- Opened Timeline scheduler → Work plan tab → confirmed live: `⚠️ התנגשות תנור: ...`,
  `🔧 שיוך תנור/מעשנה:`, `🗄️ תפוסת תנורים` button.
- Clicked into the occupancy view: confirmed live `תפוסת התנורים` / `מה נמצא על כל תנור, ומתי`,
  with the sous-vide "טבילה (immersion)" device rendered inside that "ovens" panel, and the grill
  device showing "1 מדפים" instead of a heat-zone label.
- Switched `mk-lang` to `en`: confirmed `Timeline scheduler`, `Cooker clash`, `Cooker occupancy`
  all render correctly in English (no changes needed on that side).
- Opened My Equipment (`openEquipment()`): confirmed the same grill's zones correctly render as
  "2 אזורי חום" there, and the device-count subheader correctly renders "6 מכשירים · 5 קטגוריות" —
  both supporting evidence for the recommendation and the finding #1 inconsistency.
