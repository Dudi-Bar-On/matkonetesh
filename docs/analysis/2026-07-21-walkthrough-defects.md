# Hands-on walkthrough — defect register
**Date:** 2026-07-21 · **Build:** dist edition 253 (2026-07-20) · **Viewport:** 390×844 · **Primary language:** Hebrew (RTL), spot-checked English

Method: built the app (`python build.py`), served it (`node serve.js 8123`), and drove it with a real Playwright browser at phone size. Seeded a realistic kit (cabinet smoker, kettle grill, sous-vide stick, wireless probe, two "other" accessories) and built a real event through the actual 6-step wizard (brisket, pork ribs, picanha, kebab · 8 guests · regular appetite · 24 July serve 19:00), then a second event (6 guests, pork shoulder + beef back ribs, 13:00) to exercise the multi-event view. Every finding below was triggered and observed directly; nothing here is inferred from reading source code alone (source was used only to confirm root cause after observing the behavior).

---

## Verdict

The owner is right to be worried, but not for the reasons that jump out first — the UI itself is polished, RTL is handled correctly almost everywhere, and the settings/appearance/equipment CRUD screens all work as built. The real problem is that **the two numbers that matter most in a meal-planning app — how much to buy, and which cooker to use — are wrong**, and they're wrong in a way a normal user would never catch, because the app never tells you it's guessing. The shopping list for a wizard-built event silently ignores the guest count and lists whole-cut reference weights instead (5.5 kg of brisket for 8 people eating four different mains), while the app's *own* "Print menu" screen computes the correct, guest-scaled figure (0.9 kg) for the exact same event — two features, one event, two different answers, 2.7× apart. Separately, the auto-scheduler defaults grill cuts (picanha, kebab) to an all-day sous-vide+smoke plan instead of a same-day grill, which then double-books the sous-vide bath and leaves the actual grill sitting empty — a schedule that cannot physically be executed as generated. Both root causes trace to a specific, fixable gap: the new guided wizard never runs the quantity/method logic that the older "meal builder" screen relies on.

**Five things to fix first:**
1. Make the shopping list use the same guest-scaled quantity math as "Print menu" for wizard-created events (populate `mk-menuqty-<eventId>` from the wizard, not only from the legacy meal-builder screen).
2. Fix the default cooking method for grill-type cuts (picanha, kebab, tri-tip, etc.) — stop defaulting them to sous-vide+smoke; default to grill, matching the home screen's own categorization.
3. Make the cooker auto-assignment respect equipment capacity before double-booking the sous-vide bath / any single device with simultaneous conflicting items — it should never leave an owned grill idle while overloading another device by 150%.
4. Fix the event-wizard "what's on the fire" category filter chips so a second tap deselects them (they use `aria-pressed` like a toggle but don't behave like one) — currently the only escape is discovering the unrelated "All" chip.
5. Finish English coverage on the Events screen (status badge, 2 of 3 action buttons, delete-all, and the date's month name all stay in Hebrew under English) — matches the known i18n gap already tracked internally.

**Defect count:** 2 Critical · 4 Major · 3 Minor (9 total)

---

## Critical

### C1 — Shopping list ignores guest count; disagrees with the app's own "Print menu" for the same event, by 2.7×
**Steps:**
1. Equipment configured; build an event via the guided wizard (🎉 New event): 8 guests, regular appetite, dishes = Brisket, Pork Ribs, Picanha, Kebab. Save the event.
2. Open the event's "🛒 Shopping" action → shopping list.
3. Open "🖨️ Print menu" for the *same* event.

**Expected:** Both screens show the same, guest-scaled raw-meat quantities for the same event.
**Actual:** They disagree by ~2.7×:
- Shopping list: Brisket ~5.5 kg, Pork Ribs ~1.5 kg, Picanha ~1.3 kg, Kebab ~1.0 kg → **~9.3 kg total**
- Print menu (same event, same 8 guests): Brisket ~0.9 kg, Pork Ribs ~0.9 kg, Picanha ~0.8 kg, Kebab ~0.8 kg → **~3.4 kg total, "~9 guests" sanity checks correctly**

Root cause (confirmed in `app.js`): `shopData()` (used by the shopping list) looks up a per-item quantity map at `mk-menuqty-<eventId>`; if absent it falls back to the *static catalog reference weight* of the whole cut (`c.kg` — e.g. "a whole brisket is 5.5 kg"). That map is only ever populated by `renderMenu()`, which belongs to the legacy "Meal builder" screen — a screen the new guided wizard (the one labelled "🌿 Most popular" on the home screen) never calls. Confirmed empty: `localStorage['mk-menuqty-ev-mrtkiced-1lq']` was `null` after completing the wizard end-to-end. Reproduced again on a second, independently-built event (6 guests): combined shopping list showed Pork Shoulder ~4.0 kg, again a whole-cut reference weight, not a 6-guest portion.

**Impact:** For the app's primary, most-recommended flow, the shopping list — the single most consequential number in the whole app — is off by roughly 3–4× on every item, silently. A user shopping from this screen buys 2–4× too much meat.
**Screenshots:** `30-shopping-cart.png` (wrong), `51-print-preview.png` (correct, same event), `47-combined-cart.png` (same bug on a second event, combined view).
**Severity: Critical** — wrong output, no warning, drives real purchasing decisions.

---

### C2 — Auto cooker-assignment double-books the sous-vide bath while the grill sits empty; generates a schedule that cannot physically be executed
**Steps:**
1. Same event as C1 (Brisket, Pork Ribs, Picanha, Kebab · 8 guests), equipment = 1 cabinet smoker, 1 kettle grill, 1 sous-vide bath (24 L).
2. Open the timeline scheduler → Work-plan view. All 4 items' cooker assignment left at "Automatic."
3. Open the new cooker-occupancy view (🗄️ "תפוסת תנורים" button in the work-plan toolbar) and drag the time scrubber to 15:00 the day before serving.

**Expected:** The auto-generated plan should be executable with the equipment on hand, and should use the idle grill for grill-appropriate items rather than overloading another device.
**Actual:** At 15:00: the **sous-vide immersion bath shows 100% occupied by both Picanha and Kebab simultaneously** (labelled "different woods" — nonsensical for a water bath, which uses no wood at all), while the **kettle grill shows 0%, "free"** at the exact same moment. The work-plan's own contention banner confirms the app knows this is broken: *"Cooker collision: Brisket + Ribs exceed the sous-vide bath's capacity (150%); Ribs + Picanha + Kebab require different temperatures on the Cabinet → suggest moving Kebab to the Kettle."* The suggestion is correct but is not applied automatically, and even after manually reassigning Kebab to the kettle, a residual Ribs+Picanha conflict remains on the smoker.
**Root cause:** downstream of Major #M1 below — picanha and kebab are defaulted to sous-vide+smoke instead of grill, so the scheduler tries to pack four large items onto two devices instead of spreading them across all three owned cookers.
**Impact:** The auto-generated "work plan" — the app's headline feature — is not physically executable as generated, for an entirely realistic kit and menu. The app does surface a warning (good), but the underlying default-assignment logic is wrong, and a user who doesn't notice/understand the warning will show up to cook with a plan that requires two things in one water bath at once.
**Screenshots:** `35-workplan-scroll1.png` (contention banner), `36-occupancy-view.png` / `37-occupancy-scrubbed.png` (grill empty, sous-vide bath double-booked).
**Severity: Critical** — wrong output for the app's core scheduling deliverable; not merely cosmetic, the plan cannot be followed as written.

---

## Major

### M1 — Grill cuts (picanha, kebab) default to "sous-vide + smoke" instead of grill, contradicting the app's own categorization
**Steps:** In the event wizard step 3 ("Cooking methods"), add Picanha and/or Kebab to a menu and look at their pre-selected method chips (no manual interaction needed — this is the default state).
**Expected:** Items the home screen itself lists under "🔥 Grill" (Picanha, Kebab, Tri-tip, Hamburger…) should default to a same-day grill method.
**Actual:** `methodRules()` in `app.js` defaults *every* item with a `doneness` property (all "steak-like" cuts) to `['sv','smoke']`, with no special case for cuts that are elsewhere in the same app classified as grill items. Result in the generated plan: Kebab — a dish that should be a 10-minute grill job — is scheduled to **start sous-vide the day before a 19:00 dinner, at 14:41**. This is the direct cause of C2 above and inflates the multi-event "smoker clash" count from a real 4 legitimate smoke items to a reported "6 items."
**Screenshots:** `23-wizard-step3-bottom.png` (kebab/picanha both show sv+smoke selected), `34-workplan-view.png`, `46-multievent-list.png` ("⚠ 6 clashes").
**Severity: Major** — produces a wrong/impractical default plan for common items; user can manually override per item once discovered, but nothing surfaces that the default is unusual.

### M2 — Event-wizard category filter chips can't be deselected by tapping them again; only "All" clears them, producing a dead-end "no results" search
**Steps:**
1. Wizard step 2 ("What's on the fire?"). Tap the "🥩 חזיר" (Pork) category chip — it highlights (on).
2. Tap the same "חזיר" chip again, intending to deselect it.
3. Type "בריסקט" (Brisket, a beef cut) into the search box.

**Expected:** Either the second tap deselects the category (standard toggle-chip behavior, and the chip legitimately carries `aria-pressed`, which implies exactly this), or at minimum search overrides a stale category filter.
**Actual:** The chip stays `aria-pressed="true"` / `class="chip on"` no matter how many times it's clicked — confirmed by inspecting the live DOM before and after repeated clicks, no change. Root cause in `app.js`: the click handler unconditionally does `cwActiveCat = el.dataset.cwcat || null`, with no branch to clear it when the same chip is clicked again. Combined with the search box, this produces "לא נמצאו פריטים" (No items found) for a plainly valid search term (Brisket), which reads exactly like a broken search feature. The only recovery is tapping the unrelated "הכל" (All) chip — not obvious, and not needed for any other chip group in the app (e.g. the kosher toggle *does* correctly toggle on/off).
**Screenshots:** `19-wizard-search-brisket.png` (stuck filter + 0 results for "Brisket"), `20-wizard-brisket-found.png` (after tapping "All", 1 result appears).
**Severity: Major** — feature (search) appears broken until the user stumbles on an unrelated control.

### M3 — Equipment "Add grill" form silently discards the heat-zones and cooking-area fields for charcoal-type grills
**Steps:**
1. Equipment screen → "+ Add grill." Category defaults to "פחם" (Charcoal).
2. Fill in "אזורי חום" (heat zones) and note "שטח בישול" (cooking area, pre-filled 2000 cm²) — both fields are visible and editable on the form.
3. Tap "הוסף" (Add).
4. Inspect the saved device.

**Expected:** Values entered in visible, editable form fields are saved.
**Actual:** The saved device's `cap` object is `{lid: true, rotisserie: false}` — neither the heat-zones value nor the cooking-area value appears anywhere in the stored record, and the resulting device card shows only a "🔒 Lid" chip, nothing about zones or area. The fields the user filled in are silently dropped; no error, no warning.
**Screenshots:** `40-add-grill.png` (form with visible zones/area fields), `41-after-add-grill.png` (resulting card missing both).
**Severity: Major** — silent loss of user-entered data (equipment sizing feeds into the capacity math implicated in C2, so this compounds that bug for charcoal-grill owners specifically).

### M4 — English mode leaves the Events screen partially untranslated, including a mixed-language date string
**Steps:** Switch language to English (☰ → 🇬🇧 English). Open "Events."
**Expected:** All chrome text renders in English (event names are user data and correctly stay as typed).
**Actual:** Confirmed via DOM text:
- Status badge: `"פעיל"` (Hebrew, should be "Active")
- Action buttons: `"✏️ Edit"` (translated) but `"🛒 קניות"` and `"🖨️ הדפס תפריט"` (both still Hebrew)
- `"מחק את כל האירועים"` (delete-all button, still Hebrew)
- Event meta line mixes languages mid-string: `"📅 24 ביולי · 🍽️ 4 dishes · 👥 8 · ⏰ 19:00"` — the month name ("ביולי" = "in July") is not localized while "dishes" is in English, in the same line.

**Screenshots:** `45-home-english.png`.
**Severity: Major** — a whole screen is unreliable for an English-reading user; matches the app's own tracked "i18n English coverage" gap, now with a concrete repro.

---

## Minor

### N1 — Timeline scheduler's date field visually clips the year
**Steps:** Open the timeline scheduler for an event with date 24/07/2026, at 390 px width.
**Actual:** The date input renders as `24/07/202` — the final digit of the year is clipped by the field's fixed 120 px width at the default 15 px font. The underlying stored value is correct (`2026-07-24`); this is display-only, but it makes the date look truncated/wrong at a glance on the exact phone width the app targets.
**Screenshot:** `31-timeline.png`.
**Severity: Minor** — cosmetic, data unaffected, but visible on every event's schedule.

### N2 — "1 אירועים" — incorrect Hebrew plural for a single event
**Steps:** Create exactly one event; open Events list.
**Actual:** Header reads `"האירועים שלי · 1 אירועים"` ("My events · 1 events" — grammatically wrong; should be `אירוע אחד` or simply `1 אירוע`).
**Screenshot:** `29-after-save-event.png`.
**Severity: Minor** — cosmetic grammar issue, visible to every user with exactly one event (a very common state).

### N3 — Console warning: app assigns a non-ISO date string directly to a native `<input type="date">`
**Steps:** In the event wizard step 1, set the date field.
**Actual:** Browser console logs: `The specified value "24/07/2026" does not conform to the required format, "yyyy-MM-dd"`. The visible result happens to be correct (native picker still shows 24/07/2026), so there's no user-visible symptom in this flow, but it indicates a code path writing a display-formatted string into a native date input's `.value`, which is invalid per spec and could misbehave differently across browsers.
**Severity: Minor** — currently harmless, but a real code defect worth cleaning up.

---

## Things that worked correctly (for balance)

- RTL layout is correct almost everywhere checked, including the wizard progress bar direction (verified via DOM coordinates, not just visual read).
- The kosher toggle correctly excludes pork items from the dish picker (verified: filtering by "Pork" category with kosher on returns zero results, as it should).
- Equipment add/edit/delete and the "other accessories" checklist (including custom free-text additions) all persist correctly and reflect immediately in the UI.
- Multi-event contention detection is real and useful: it correctly identified genuine smoker resource conflicts across two independently-built events and offered an actionable per-item reassignment suggestion.
- Appearance settings (theme, font family, text size) apply immediately and correctly, in both languages.
- No JavaScript console errors were observed at any point in this session (only the one warning noted in N3).

---

## Screenshots
All captured at 390×844 in `docs/analysis/shots/`. Filenames referenced above; the full set (51 files) covers home, catalog/cut-card, all 6 wizard steps, events list, shopping cart, timeline (both views), cooker-occupancy view, equipment CRUD, appearance settings, and the English-language pass.
