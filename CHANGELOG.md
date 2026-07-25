# מתכונת · מדריך האש — changelog

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

Summary changelog per release (owner request, 2026-07-25). Detailed coverage starts at **v262**;
earlier versions are summarized coarsely. Maintained as part of the release protocol: every version
bump adds its entry here in the same commit, and the footer WHATS_NEW constant in build.py is
updated in the same commit.

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
