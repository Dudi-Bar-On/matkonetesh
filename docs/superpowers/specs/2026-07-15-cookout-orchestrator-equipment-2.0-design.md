# Cookout Orchestrator — Phase 1: Equipment 2.0 — Design Spec

**Date:** 2026-07-15
**Status:** Approved design → ready for implementation plan
**Feature owner decision:** foundation-first (phased); **no backward compatibility** — Equipment 2.0 *replaces* the old gear model outright (heavy pre-customer development; port consumers, delete dead code, regression-test to 100% DoD).

---

## 1. Context & goal

The **Cookout Orchestrator** teaches the app that dishes compete for *physical cookers*, not just for time. Today the scheduler already merges an event's dishes onto one combined timeline and detects **cross-event** smoker contention, but there is **no within-event capacity model**: two dishes in one event can both demand the smoker at 2pm with no warning, and there is no concept of "cookers" (Smoker A = 2 racks, Grill = 4 zones) — only time.

Delivered in three phases:
- **Phase 1 — Equipment 2.0 (this spec).** Replace the coarse single-device gear model with a rich, multi-device model + an AI spec-lookup helper + a minimal item→cooker assignment so the work plan names the right device. Useful on its own; the data foundation for Phases 2–3.
- **Phase 2 — Planning-time orchestration.** Deterministic within-event contention detection across cookers / SV baths / probe channels, woven into the timeline, with **warn + one-tap suggest**.
- **Phase 3 — Auto-optimize + live control.** A solver that assigns items to cookers and staggers starts, plus the Live Copilot enforcing it during the cook.

### Goals (Phase 1)
1. Model the owner's real kit: **multiple devices per category**, each with **type**, **capacity**, and identity (brand/model).
2. **AI equipment helper**: brand → models → specs (web-grounded), with a full manual fallback for custom/not-found gear and for no-key/offline.
3. **Replace** the old `mk-gear` model; port every consumer to the new model; delete the old code.
4. **Item→cooker assignment (manual)** so the existing work-plan equipment annotation is correct when >1 device of a category exists.

### Non-goals (Phase 1 — deferred to Phase 2/3)
- Automatic/optimal item→cooker assignment; contention detection; the solver; live enforcement.
- Any permanent backward-compat shim or dual-read of `mk-gear`.

---

## 2. Data model

New store key **`mk-equipment`** = an **array of device objects** (source of truth). Old `mk-gear` / `mk-gear-set` are **removed** after a one-time migration.

```js
// one device
{
  id,                 // stable id, e.g. 'eq-' + short random (generated at add)
  cat,                // 'smoker'|'grill'|'oven'|'sousvide'|'probe'|'grinder'|'stuffer'|'other'
  type,               // sub-type enum, per cat (see below)
  name,               // display name, e.g. "Weber Smokey Mountain 47"
  brand,              // optional, e.g. "Weber"
  model,              // optional, e.g. "Smokey Mountain 47cm"
  fuel,               // 'charcoal'|'pellet'|'gas'|'wood'|'electric'|null  (cookers only)
  cap: {              // capacity — only the field(s) relevant to cat; missing = unknown
    racks,            // number — smoker/oven shelf/grate count
    zones,            // number — grill independent heat zones/burners
    channels,         // number — probe simultaneous channels
    bathL             // number — sous-vide bath capacity (litres); one bath = one shared temp
  },
  specSource,         // 'manual' | 'ai'  (provenance of cap/type when AI-filled)
  notes               // free text
}
```

**Type enums (stored as stable English keys; labelled bilingually in UI):**
- `smoker.type` ∈ cabinet | offset | pellet | kettle | drum(UDS) | kamado | electric | other
- `grill.type` ∈ gas | charcoal-kettle | kamado | flat-top | pellet | other
- `oven.type` ∈ home | deck | pizza | other
- `sousvide.type` ∈ circulator | water-oven
- `probe.type` ∈ wireless | wired | instant-read
- `grinder.type` / `stuffer.type` — parity with today's options (not orchestration-critical)

**Capacity is optional.** A missing `cap.*` means "unknown" and Phase 2 must not false-alarm on it.

**Config flag:** replace `mk-gear-set` with **`mk-equip-set`** (boolean) — set true once the user has confirmed their equipment (via manager, concierge, or accepting a migration).

---

## 3. Replace the old gear model (no backward compat)

### 3.1 New helper/aggregator API (all in `app.js`)
```
equipList()                 -> array (store.get('mk-equipment')||[])
equipSave(list)             -> store.set('mk-equipment', list)
equipByCat(cat)             -> devices of a category
hasCat(cat)                 -> boolean (>=1 device in category)
equipConfigured()           -> !!store.get('mk-equip-set')
equipSetConfigured()        -> store.set('mk-equip-set', true)
// aggregators for Phase 2 (defined now, used later)
cookers()                   -> smoker|grill|oven devices (each a separate assignable resource)
probeChannels()             -> sum of cap.channels across probe devices  (4+4 => 8)
svBaths()                   -> sousvide devices (each = one bath / one temp)
primaryOf(cat)              -> first device of a category (stable list order) — for single-value display (home tips, tagline)
```

### 3.2 Port each consumer (found via grep — the full surface)
Reimplement these on the new model, then delete the old bodies/keys:

| Old (line) | New behaviour |
|---|---|
| `gearState()` / `saveGear()` (54–55) | **Deleted.** Callers move to `equipList()` / `equipByCat()` / `primaryOf()`. |
| `gearConfigured()` / `gearSetConfigured()` (56–57) | → `equipConfigured()` / `equipSetConfigured()` (reads `mk-equip-set`). |
| `canSV()` (59) | `hasCat('sousvide')` (when configured). |
| `canSmoke()` (60) | has a `smoker` device **or** a `grill` (indirect smoking) — preserve today's semantics. |
| `canGrill()` (63) | `hasCat('grill')`. |
| `gearCan(method)` (66) | unchanged wrapper over the three above. |
| `homeGear()` (69) | recompute presence/capability booleans from `equipList()`. |
| `smokerTip()` (205) | key `SMOKER_TIPS` by `primaryOf('smoker').type` (or the item's assigned cooker in item context). |
| `preheatHint()` (206) | same — driven by the relevant smoker device's `type`. |
| thermo tip (253) | driven by the "best" probe: prefer a `wireless` probe, else any. |
| catalog method advice (129, 213–220, 2022) | read capability via the ported `canX()` — no shape change needed. |
| event-plan capability lines (6243, 6277–6278) | read from `equipList()` / ported `canX()`. |
| home tagline/chip/banner (5647, 7558, 7579–7582) | point the chip/banner at `openEquipment()`; tagline uses ported `homeGear()`. |
| `openGear()` (4899) | **Replaced** by `openEquipment()` (§4). Old dropdown UI deleted. |
| More-sheet entry (7530, 7536) | `openGear` → `openEquipment` in the ⚙️ group + recent-tools list. |
| concierge (`gearFromText` 4842 / `levelFromText` 4865 / `gearConciergeApply` 4870 / `openGearConcierge` 4885) | re-point to **emit device entries** into `mk-equipment` (§5.4). |

### 3.3 One-time migration
`equipMigrateFromGear()`: on first load where `mk-equipment` is empty but `mk-gear` exists, map each non-`'אין'` old value → a device (cat + best-guess `type` from the old Hebrew value; `cap.*` left null/unknown for the user to fill; `specSource:'manual'`). Copy `mk-gear-set` → `mk-equip-set`. Then the app never reads `mk-gear` again (key left to rot or deleted on write). Idempotent.

---

## 4. Equipment manager UI (`openEquipment`)
- Replaces `openGear`. Screen lists devices **grouped by category**; each card shows name + a capacity summary chip (e.g. "2 racks", "4 ch", "20 L"). Actions: **edit**, **remove**, **＋ add device**.
- A capabilities summary line (Sous-vide / Smoking / Grill active) as today's `openGear` had, computed from the new model.
- Settings slot: a **`🧰 הציוד שלי / My Equipment`** row in `openMoreSheet()`'s ⚙️ *Settings & help* group (replacing the `openGear` row); the home gear chip + the "gear not set" banner both open it.

---

## 5. Device editor + AI helper

### 5.1 Editor flow
Add/edit a device: **category** → (AI helper or manual) → **type**, **name/brand/model**, **capacity fields (contextual to category)**, **fuel** (cookers), **notes** → save. Capacity fields render per `cat` (smoker/oven → racks; grill → zones; probe → channels; sous-vide → bathL).

### 5.2 AI helper — brand → models → specs (progressive)
- **Brand list:** a curated static `EQUIP_BRANDS` map (per category: Weber, Traeger, Pit Boss, Masterbuilt, Kamado Joe, Big Green Egg, MEATER, Inkbird, ThermoWorks, Anova, Breville…). User picks a brand or types their own. *(Static = fast, reliable, offline-friendly; AI extends it, not replaces it.)*
- **Know only the brand → browse models:** `aiBrandModels(brand, cat)` — web-grounded Gemini call returns a list of that brand's models for the category → user picks one.
- **Know the model → get specs:** `aiLookupDevice(query, cat)` — web-grounded Gemini call returns orchestration specs as JSON (`cat`, `type`, `fuel`, `cap:{racks,zones,channels,bathL}`) → **pre-fills the form** → user **confirms/edits** → saved with `specSource:'ai'`.
- **Not found / custom-made → manual property form** for that type: **dropdowns where the value is enumerable** (type, fuel), **free text/number** otherwise (custom rack count, bath litres, notes).
- **No key / offline:** AI steps hidden/disabled; straight to the manual form. (Same graceful-degrade rail as the photo analyzer.)

### 5.3 AI implementation notes
- Reuse `gemFetch` transport, the `aiJSON` grounded-JSON caller, the `outLang` (default `getLang()`) plumbing, and Google-Search grounding (Subject-2 research: native, cheap/free under BYOK).
- Validate/normalize returned JSON: coerce numbers, clamp to sane ranges, restrict `cat`/`type`/`fuel` to the enums, drop unknown fields. Invalid/empty → fall back to the manual form (never blocks adding a device).
- Advisory framing: a short "AI-filled — please verify" note on AI-populated fields; user always confirms before save.

### 5.4 Concierge port
`gearFromText` / `levelFromText` / `gearConciergeApply` / `openGearConcierge` stay as the **quick natural-language on-ramp** but now parse into **device entries** appended to `mk-equipment` (each recognized device → a `{cat,type,name,...}` with best-guess capacity, refinable via the AI helper or manual edit). `gearConciergeApply` writes the list + sets `mk-equip-set` + the ui-level, matching today's behaviour.

---

## 6. Item→cooker assignment + device-aware work plan
- New per-scope map **`mk-item-cooker-<scope>`** = `{ [itemKey]: deviceId }`.
- **Auto-default:** when exactly one device fits an item's method, use it silently. When several fit (e.g. two smokers), the item shows a small **cooker picker**; until chosen it falls back to the category label.
- The existing work-plan equipment annotation (in `workPlanHtml` / item rendering) reads this map and names the **specific device** ("on the **pellet smoker**") instead of a generic category.
- No conflict logic yet — that is Phase 2. This is purely: *let the user say which cooker, and echo it correctly.*

---

## 7. Data flow
1. First load → `equipMigrateFromGear()` seeds `mk-equipment` from any existing `mk-gear`.
2. User opens **My Equipment** → adds/edits devices (AI helper or manual) → `equipSave()` + `equipSetConfigured()`.
3. All capability/advice surfaces read the new model via the ported helpers.
4. When planning, each item optionally gets a cooker via `mk-item-cooker-<scope>`; the work plan echoes the device name.

## 8. Error handling
- **AI lookup:** no key/offline → hidden; API/quota/timeout error → reuse `gemFetch` error classification + toast, fall back to manual; malformed JSON → manual. Never block adding a device.
- **Migration:** idempotent; if `mk-gear` absent → no-op; partial/unknown old values → device with `type:'other'`.
- **Missing capacity:** treated as "unknown" everywhere; Phase 2 must skip unknowns rather than warn.
- **Empty equipment:** `equipConfigured()` false → capabilities default to permissive (as today's `canX()` do when unconfigured).

## 9. Testing plan (Playwright, Hebrew **and** English)
**New tests (`tests/equipment.spec.ts`):**
- Migration: seed `mk-gear` → load → `equipList()` contains mapped devices; `mk-equip-set` copied.
- CRUD: add/edit/remove; **multiple devices per category** (2 smokers of different type; 2 probes).
- Aggregators: `probeChannels()` sums (4+4 ⇒ 8); `cookers()`/`svBaths()` list correctly.
- AI helper: mock `gemFetch` for `aiBrandModels` (→ model list rendered/pick) and `aiLookupDevice` (→ form pre-fills, `specSource:'ai'`); **no-key path** → AI hidden, manual works; **junk JSON** → manual fallback, device still addable.
- Item→cooker: with 2 smokers, assign one to an item → work-plan annotation names that device.
- Settings row + home chip/banner open `openEquipment()`.
- i18n: all new strings via `L(he,en)`; RTL correct; run in both languages.

**Regression / port (the "fix what breaks" pass):**
- Update `tests/wave3.spec.ts` W3-P1 (concierge) — it currently asserts `gearState().smoker`, `gearConciergeApply`, `canSV`, `gearConfigured`; port to the new model/shape.
- Update `tests/adaptive-home.spec.ts` for any gear-shape assertions.
- Full suite green **twice** after fixes.

## 10. Definition of Done (100%)
- [ ] `mk-equipment` model + helpers/aggregators implemented; `mk-gear`/`saveGear`/`gearState`/`openGear` deleted (grep-clean).
- [ ] Every consumer in §3.2 ported and behaving; no dead references.
- [ ] One-time migration works; owner's existing kit preserved.
- [ ] Equipment manager (CRUD, multi-device, capacity chips) + settings slot.
- [ ] AI helper (brand list + `aiBrandModels` + `aiLookupDevice` + manual fallback + no-key path) with confirm-before-save + provenance.
- [ ] Concierge ported to emit device entries.
- [ ] Manual item→cooker assignment + device-aware work-plan annotation.
- [ ] New tests + ported tests; full Playwright suite green ×2; `node --check app.js` clean.
- [ ] Reviewed (self + code-review pass) and fixed; verified with real clicks in HE + EN.
- [ ] Shipped as vNNN (commit + tag + push).

## 11. Deferred (Phase 2/3 seams this leaves ready)
`cookers()` / `probeChannels()` / `svBaths()` and the `mk-item-cooker-<scope>` map are the seams Phase 2's contention detection + suggestions and Phase 3's solver/live-control will consume.
