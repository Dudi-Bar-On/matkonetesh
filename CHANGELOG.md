# מתכונת · מדריך האש — changelog

Summary changelog per release (owner request, 2026-07-25). Detailed coverage starts at **v262**;
earlier versions are summarized coarsely. Maintained as part of the release protocol: every version
bump adds its entry here in the same commit, and the footer WHATS_NEW constant in build.py is
updated in the same commit.

## מהדורה 267 · 26.7.26

**Equipment refinements + a fourth language — owner-driven from live v266 testing:**
- **Smarter device-model lookup.** Typing a precise model name (e.g. "הנפח אביה 150") now returns
  the full property set on the first try — the AI thinks harder on a direct lookup and self-corrects
  with an enriched retry when the first result comes back thin, so you no longer need the model
  catalog to fill in dimensions the manufacturer publishes.
- **Wood-load advisory.** A smoker imparts its wood's flavor, so the work plan now nudges you to check
  and load the wood the recipe calls for when the smoker's loaded wood is empty or doesn't match. It's
  a flavor reminder only — it never blocks the cook.
- **Capability-aware serving.** The equipment engine now offers a device for a stage only when that
  device actually meets the stage's demands (area, volume, temperature) — an owned-but-insufficient
  device is no longer silently treated as available.
- **More precise event scheduling.** Adding an item to an event is blocked when the device it needs is
  already busy in that window, with a reason distinct from the "you don't own the device" case; the
  window the gate checks and the hold it later writes are derived from one shared computation, so they
  can't drift.
- **Italian** joins French, German, and Spanish — translated via the same locally-run, safety-gated
  pipeline (~98% coverage), now with an English-pivot step for higher translation fidelity.

## מהדורה 266 · 26.7.26

**Equipment validity gates (E3) + one-source cooking schedules (CP1) + three new languages:**
- **Items you can't cook with your kit now say so — clearly and helpfully.** A catalog item whose
  cooking needs your equipment can't meet is flagged, with a plain "why" (which device is missing) and
  "how to fix it" (configure the device, or switch to a cited path your kit *does* support). Adding an
  uncookable item to a plan is blocked with the reason. Nothing is ever blocked from *view* — you can
  always look and explore alternatives.
- **Temperature-probe awareness.** Recipes with an internal-temperature stage now require a standalone
  (e.g. wireless) meat probe; a one-time nudge lets you register a thermometer you already own so those
  recipes unlock at once.
- **Deleting a device warns you first** when it would affect items already in a plan or event — with the
  real count — and releases only the affected holds.
- **One source of truth for every cooking schedule (CP1).** The item card, timeline, work plan, and the
  AI assistant all read the same cited schedule now — the "105° on the card, something else on the
  timeline" class of contradiction is gone by construction.
- **French, German, and Spanish** now covered at ~99%, via a locally-run, safety-gated translation
  pipeline, with a semantic-correctness repair pass and a Hebrew-source cleanup (correcting Anglicized
  cooking terms at the root so every language inherits accurate terminology).

## מהדורה 265 · 25.7.26

**Owner verification round 2 — making the v264 fixes visible where users actually look:**
- **Device add/verify**: the Advanced section auto-opens when the AI lookup fills it; extracted
  dimensions are visible immediately; when dims + shelf count exist, the derived total area appears
  as a one-tap suggestion under the area field.
- **Suspect-device repair**: the warning chip's flow now states what will be used if the field is
  cleared, opens the dims fields with a prompt, and offers the computed value live as you type.
- **Honest confidence**: a value accepted from an outer-dims estimate keeps its "משוער" marker and
  the looser fit tolerance until a human confirms it; suspicious stored values also lose tight-fit
  trust until corrected.
- Dims render as one labeled chip (e.g. 150×60×43); cabinet volume shown; editing a device no longer
  silently stores unstated yes/no properties.

## מהדורה 264 · 25.7.26

**Owner bug round — three production fixes, all owner-reported from live v263 testing:**
- **Smoke-stage labels now honor the citation's cold flag** — 10 beef items no longer claim "cold
  smoking" for their cited 70–75° warm-smoke stages; "עישון קר" appears only where the source says
  cold. Danger-zone warning copy is temperature-agnostic; cheese build steps corrected.
- **Shelf math from manufacturer data** — device shelf area now derives from structured dimensions
  (shelf W×D × racks, then outer dims, then a re-sourced class default of 7,900 cm²); cabinet volume
  is captured and shown; devices with implausibly small stored areas get a warning chip with a
  one-tap re-check. A whole brisket fits the הנפח אביה 150 again.
- **Cited post-sous-vide finishes are live** — 21 items' finishing smoke now uses the researched
  `order_svsmoke` schedule (brisket: 120°/1.5ש hot-bark finish; shrimp: gentle 100° instead of a
  230° reblast), with explanatory sub-lines wherever order-specific temperatures appear, and a
  generation-time drift guard so catalog and order schedules can't silently diverge again.

## מהדורה 263 · 25.7.26

**Safety & correctness (Phase B):**
- **Date math is now DST-proof** — adding days to a cure/cook schedule across Israel's clock change
  no longer drops a day (a nitrite-cure shortened by DST was a real safety defect).
- **Voice replies route through managed AI correctly** — TTS works for managed-access users, not
  only personal-key users.
- **The false cross-event equipment warning is gone** for users who haven't configured equipment.
- **AI usage metering** — the app now records token usage per model call for cost visibility.

**Equipment foundation (E1 — first phase of the equipment programme):**
- New equipment module (`EQM`) — the app's first extracted source module, guarded by a build-time
  single-definition assertion.
- **Every recipe now derives its required devices** (smoker / sous-vide bath / grill) with the
  temperatures, hanging, and bath sizes it needs — straight from the recipe's own cited data.
- **Ownership verdicts** — the app answers "can I cook this with what I own?" per requirement:
  owned / owned-but-insufficient / missing.
- **Required-equipment chip on catalog cards** — each item shows its needed devices with a
  green/amber/red ownership tint (only when you've configured your kit; theme-aware).
- The equipment form's two cooking-area fields collapsed into one canonical metric field.

## מהדורה 262 · 24.7.26

**Spoken-safety hardening (P0):** the voice assistant never voices an unverified safety number —
verified figures are substituted from the app's cited data and marked as such; unverified numbers
are redacted with a redirect to the item card; ranges are never auto-verified; Fahrenheit inputs
can no longer be misread as Celsius (whitespace/word-form/unit-classifier fixes); voice-translation
gained a numeric guard comparing value+unit-class pairs.

## מהדורה 261 · 24.7.26 and earlier (summary)

- **v261** — AI model migration: text → gemini-3.6-flash, TTS → gemini-3.1-flash-tts-preview, via a
  central model registry with per-usage thinking budgets.
- **v252–v260** — AI trust waves: grounding-first answers, numeric invariant guard, dangerous-intent
  refusal; test-infrastructure overhaul (warm-page fixtures, suite 3m → ~1m).
- **v242–v251** — Managed-AI access (Cloudflare Worker, central key + access codes), app-wide
  preferences framework, equipment properties layer with unit-aware coercion, per-recipe equipment
  data derived for all 279 recipes.
- **v230–v241** — Equipment 2.0: device registry with categories/capacities, AI web-grounded device
  lookup, accessories checklist, sous-vide multi-bath model, within-event contention detection.
- **v229** — i18n foundation: full English coverage; fr/de/es seeds.
