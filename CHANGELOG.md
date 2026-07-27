# מתכונת · מדריך האש — changelog

Summary changelog per release (owner request, 2026-07-25). Detailed coverage starts at **v262**;
earlier versions are summarized coarsely. Maintained as part of the release protocol: every version
bump adds its entry here in the same commit, and the footer WHATS_NEW constant in build.py is
updated in the same commit.

## מהדורה 273 · 27.7.26

**Russian — a seventh language, and a safety-gate upgrade behind it:**
- **Russian is added** (he/en/fr/de/es/it/ru). The catalog, dish names, categories, origins and woods are
  translated; the full render-path leak test now covers Russian (zero Hebrew leaks, flags intact).
- **The numeric-safety gate now understands non-Latin unit words.** Extending translation beyond Latin
  scripts exposed that the gate recognized only he/en/de/fr/es/it unit words — a faithful Russian "30 минут"
  or "1 г" was wrongly rejected. Unit recognition was extended to all queued scripts (Cyrillic, Greek, CJK,
  Arabic, Thai, more Latin), and in the process a real hole was closed: grams and kilograms were merged in
  one gate, so it now distinguishes them — a 1000× cure-dose g↔kg swap can no longer pass in any language.
  A dropped or swapped number still fails the build.

## מהדורה 272 · 27.7.26

**Seasoning country flags restored in all languages (owner-reported):** the origin of each rub/seasoning
(e.g. "🇺🇸 Texas", "🇫🇷 Provence") lost its flag emoji in French/German/Spanish/Italian — 123 of 130
origins shipped flagless. Root cause: the origin also lives in the translatable prose corpus, where the
machine translation dropped the flag, and the build merged that flag-stripped value over the correct
chrome value. The build now lets the interface dictionary win over the prose corpus for any shared key,
so flags (and every other chrome string) can't be clobbered. A render-path test now guards that every
origin keeps its flag through the build.

## מהדורה 271 · 27.7.26

**AI output is never truncated again (owner policy):** every AI call — device-spec lookup, the assistant,
the event planner, troubleshooting, voice answers, translation, vision, and per-item prose — now runs with
a full output budget (8192 tokens) instead of the old per-call caps of 300–1600. Those caps could be
exhausted by the model's reasoning before the answer finished, silently cutting it off (the root cause of
the v269 device-lookup "not found"). Billing is on actual tokens used, so the higher ceiling only removes
the truncation risk. The two tiny connectivity health-checks stay minimal by design.

## מהדורה 270 · 27.7.26

**AI device lookup fixed + more localization gaps closed (owner-driven from live v269 testing):**
- **AI equipment lookup returns full specs again.** Typing a device model (e.g. "הנפח אביה 150") was
  reporting "not found" — the model actually found it, but the high-reasoning lookup exhausted its output
  budget and truncated the JSON mid-answer (`MAX_TOKENS`), so parsing failed. The budget is now large
  enough to hold both the reasoning and the full result; the smoker returns its dimensions, rack count,
  hanging capability and cabinet specs on the first try.
- **The work plan is fully translated.** The build-from-scratch cooking-method labels and notes ("direct
  grill", "to ~71° internal", …) rendered in Hebrew inside the timeline for non-Hebrew languages; they are
  now translated (with their temperatures preserved exactly).
- **Voice panel:** the speech-language button now shows the language's name in the active language.
- The render-path leak test now also drives the work-plan timeline and the voice panel.

## מהדורה 269 · 27.7.26

**Localization made genuinely complete — the data, not just the chrome (owner-driven from live v268 testing):**
- **Recipe & seasoning names, categories, origins, woods — all translated.** v268 localized the chrome
  but ~525 of the ~550 catalog/seasoning names still fell back to English, and categories, country origins,
  and wood types rendered in Hebrew. All ~740 data values are now translated into French, German, Spanish
  and Italian. Cut names use the correct culinary term (Brisket→Brisket, Short Ribs→Côtes courtes), never a
  wrong cut, and country flags stay attached to the right country.
- **The screens that still leaked are clean.** The catalog grid + category view (chips, group tiles, the
  count row, card kosher tags), the whole event wizard (the "event date" field, the step label, prompts),
  seasonings (titles + countries) and projects/pantry now render with no Hebrew left in a non-Hebrew UI.
- **It stays fixed by construction.** The render-path leak test now drives every one of those screens
  (catalog, all six wizard steps, projects) and scans text *and* placeholder/aria-label attributes — the
  gap this release closes fails the build if it ever returns.
- Safety numbers remain guarded across every language (build-time numeric/unit gate, unchanged).

## מהדורה 268 · 27.7.26

**Full interface localization (French / German / Spanish / Italian) — no longer half-English:**
- **Every screen now renders in the active language.** Previously ~half of each screen — recipe names, the
  "can't cook this with your kit" panel, cooking-plan labels, buttons, toasts — fell back to English. Now the
  entire chrome is translated: every button, label, panel, message, dialog, toast, and recipe/category name.
- **Safety numbers cannot be mistranslated.** A build-time guard fails the build if any translated string
  changes a number or its unit (°C↔°F, g↔kg, minutes↔hours) — a cure dose or doneness temperature can never
  drift in translation.
- **It stays fixed by construction.** A coverage guard fails the build if any user-facing string is left
  untranslated for an active language, and a render test asserts zero fallback on every screen — the
  "99%-but-half-English" gap this release closes cannot silently return.
- Under the hood: the ~1,300 inline bilingual strings were unified into one translatable path fed by an
  automatic extractor, and the nine parallel English lookup tables were removed.

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
