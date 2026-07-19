# Cookout Orchestrator — Phase 3a: Auto-optimize solver + preferences framework — Design Spec

**Date:** 2026-07-17
**Status:** Approved by owner 2026-07-17
**Predecessors:** Phase 0 i18n (v229) · Phase 1 Equipment 2.0 (v230–v235, v237–v241, v247–v249) · Phase 2 contention warn/suggest (v233)

---

## 1. Context & goal

The scheduler already merges an event's dishes into one timeline and **detects** cooker contention
(`cookerContention`, Phase 2), offering "move" / "stagger" suggestions. It does not **resolve** anything:
the user still decides. Phase 3a turns detect-and-warn into **optimize-and-guide**, and makes the
orchestrator's behavior **user-customizable** through an app-wide preferences framework.

Business context (shifted mid-arc, see `docs/research/04a-architecture.md` + `04b-business.md`): the product
is now **online-mostly with a managed AI tier** (central Cloudflare Worker key, shipped v242–v246). AI can
therefore be *central* to the experience. It is still **not** trusted with numbers: the deterministic core
owns the feasible set and every temperature/duration; the AI ranks, sequences and explains.

### Goals (Phase 3a)

1. **`PREFS` registry** — one place that defines every user-tunable behavior, with presets, and a settings
   hub. Adopts the existing validated-default pattern rather than replacing it. **Units** becomes its first
   non-orchestrator member.
2. **Deterministic solver** — a superset of `cookerContention` that emits ordered, safety-gated *moves*:
   `share → wood-swap → reassign → cook-early-and-hold → advise`.
3. **Bounded AI role** — the AI may only choose among solver-emitted moves (`action_id` contract).
4. **Safety spine** — hard floors that are never knobs, a danger-zone accumulator the app does not track
   today, and a fix for a **currently shipped** guard-laundering bug.

### Non-goals (deferred)

- **Phase 3b — live Copilot enforcement during the cook.** Its own spec; depends on this one.
- **Auto-pilot that mutates the plan without confirmation.** The autonomy pref ships with `advise` and
  `propose`; `autopilot` is defined but defaults off and is out of scope for 3a's UI.
- Cross-event optimization (today's cross-event smoker warning stays as-is).

---

## 2. Preferences framework

### 2.1 The registry

A single declarative table. Each entry keeps using its **existing** `mk-*` key where one already exists, so
nothing migrates and nothing changes on upgrade.

```js
// PREFS[key] = {store, def, valid, group, he, en, opts?}
//   store  — the mk-* localStorage key (existing key adopted in place)
//   def    — default value; MUST reproduce today's behavior exactly
//   valid  — array of allowed values, or a predicate fn
//   group  — which hub section it renders in
//   opts   — [{v, he, en}] for the option chips (omit for booleans)
const PREFS = { /* … see 2.5 … */ };

function pref(key){                       // validated read, exactly like themeKey()/uiLevel() do today
  const p = PREFS[key]; if(!p) return undefined;
  const v = store.get(p.store);
  const ok = Array.isArray(p.valid) ? p.valid.indexOf(v) >= 0 : (typeof p.valid === 'function' ? p.valid(v) : false);
  return ok ? v : p.def;
}
function setPref(key, val){
  const p = PREFS[key]; if(!p) return false;
  const ok = Array.isArray(p.valid) ? p.valid.indexOf(val) >= 0 : (typeof p.valid === 'function' ? p.valid(val) : false);
  if(!ok) return false;
  store.set(p.store, val); return true;
}
```

**Existing helpers are refactored to delegate, not deleted** — `uiLevel()`, `themeKey()`, `fontScale()`,
`tlShape()` keep their signatures and call sites; their bodies become `return pref('uiLevel')` etc. This
guarantees zero behavior change and keeps ~200 existing call sites untouched.

### 2.2 Presets

```js
const PREF_PRESETS = {
  simple:   {autonomy:'advise',  shareTolC:0,  woodSwap:false, holdEnabled:false, aiRank:false},
  balanced: {autonomy:'propose', shareTolC:8,  woodSwap:true,  holdEnabled:true,  aiRank:true },
  pro:      {autonomy:'propose', shareTolC:15, woodSwap:true,  holdEnabled:true,  aiRank:true },
};
```

A preset is a **convenience action, never an implicit source of values.** Tapping one writes every member
key explicitly. The interface level (`uiLevel`: `basic|mid|pro`) only decides which preset the hub
*highlights as recommended* — it **never auto-applies** and never overrides a stored value.

**This is the rule that keeps "defaults = today's behavior" true:** with no `mk-pref-*` keys stored, every
`pref()` returns its own `def` from §2.5 (e.g. `autonomy:'advise'`), *not* the recommended preset's value.
A fresh install at `uiLevel:'mid'` therefore behaves exactly like Phase 2, even though *Balanced* is the
highlighted recommendation.

**"Custom" is derived, never stored**: `prefPreset()` returns `'simple'|'balanced'|'pro'` when the current
values match that preset's members exactly, else `'custom'`.

### 2.3 The hub

New `openPrefGroup()` reached from **Tools › ⚙️ Settings & help › "התנהגות ואוטומציה" / "Behavior & automation"**
(one new entry in the existing settings list at `app.js` ~line 7921). It reuses the existing `showPanel` +
`.ap-opt` option-row styling from `openAppearance` / `openUiLevel` — **no new CSS**.

Layout: preset selector row (Simple / Balanced / Pro / Custom-readonly) → the 5 hero knobs → a collapsed
`<details>` "מתקדם / Advanced" holding the rest.

### 2.4 Units (first non-orchestrator member)

| field | value |
|---|---|
| key | `units` |
| store | `mk-pref-units` (new) |
| valid | `['metric','imperial']` |
| def | `'metric'` |

- Consumed by the AI prompt builders that v246 hard-coded to Hebrew: replace the `he ? metric-directive : ''`
  logic in `askGemini`, `aiJSON` (`metricLine`) and `vcBuildAskPrompt` with `pref('units')==='metric'`.
  **Default keeps v246 behavior for Hebrew and adds it for English metric users.**
- Display conversion of catalog temperatures is **out of scope for 3a** (the catalog is metric-native); the
  pref governs AI output and the equipment `acmFmt` unit only. A follow-up may extend it.

### 2.5 The knobs

**Hero (always visible):**

| key | store | valid | def | meaning |
|---|---|---|---|---|
| `autonomy` | `mk-pref-autonomy` | `advise\|propose\|autopilot` | `advise` | how far the orchestrator may go |
| `shareTolC` | `mk-pref-sharetol` | `0\|8\|15` | `8` | max ΔT (°C) to let two items share one smoker; `0` = never share |
| `woodSwap` | `mk-pref-woodswap` | `true\|false` | `true` | may propose swapping a wood to enable sharing |
| `holdEnabled` | `mk-pref-hold` | `true\|false` | `true` | may propose cook-early-and-hold |
| `units` | `mk-pref-units` | `metric\|imperial` | `metric` | see 2.4 |

**Advanced:**

| key | store | valid | def | meaning |
|---|---|---|---|---|
| `aiRank` | `mk-pref-airank` | `true\|false` | `true` | let the AI order/explain the solver's moves |
| `slotModel` | `mk-pref-slots` | `size\|count` | `size` | rack budgeting: size-classes vs. a plain item count |
| `holdMaxH` | `mk-pref-holdmax` | `1\|2\|3` | `3` | user ceiling on hold hours — **clamped by the safety cap, never above it** |

**`autonomy:'advise'` is the default, so on upgrade the orchestrator behaves exactly as Phase 2 does today.**

---

## 3. The solver

### 3.1 API

```js
// Pure function over the already-computed schedule. No DOM, no storage writes.
// computed/scope are exactly what cookerContention(computed, scope) receives today.
function orchestrate(computed, scope){
  const clashes = cookerContention(computed, scope);        // Phase 2 detector, unchanged
  const moves = [];
  clashes.forEach(function(cl, i){ moves.push.apply(moves, movesForClash(cl, computed, scope, i)); });
  return { clashes: clashes, moves: moves.filter(safetyGate) };
}
```

### 3.2 The move object

```js
{
  id:       'mv-0-share',        // STABLE within one orchestrate() run — the AI's action_id
  kind:     'share'|'wood'|'reassign'|'hold'|'advise',
  clashIdx: 0,                   // which clash it resolves
  itemKey:  'cut:brisket',       // the item that moves
  devId:    'eq-123',            // target device (reassign/share)
  he: '…', en: '…',              // human-readable label (deterministic, NOT AI-written)
  delta:    { startShiftMin: -90, devId:'eq-2', wood:'oak', holdMin:120 },  // only the relevant fields
  risk:     'none'|'low',        // never 'high' — those are dropped by the gate
}
```

`applyMove(move, scope)` is deterministic and does the storage write (`setItemCooker`, a new
`mk-item-shift-<scope>` start-offset map, or `mk-item-wood-<scope>`). Every move is reversible by
re-applying the inverse; the UI offers a single-level undo via the existing `toast` action pattern.

### 3.3 Resolution order (first feasible wins, but ALL feasible moves are returned for ranking)

1. **share** — both items stay on the device. Allowed only when: same fuel/wood, `|ΔT| ≤ pref('shareTolC')`,
   and the device has rack budget (3.4). Sous-vide: **only when temps are exactly equal** (already true in
   `cookerContention`); `shareTolC` never applies to `sv`.
2. **wood** — if `pref('woodSwap')` and the only blocker is a wood mismatch, propose the milder of the two
   woods (oak-biased: oak/fruit win over hickory/mesquite). Never proposes a stronger wood.
3. **reassign** — move one item to another device that `cookerCandidates(kind)` returns and that is free for
   the whole window.
4. **hold** — if `pref('holdEnabled')`: finish one item early and hold it hot. Gated hard by 3.5.
5. **advise** — always emitted last as a fallback: a plain "stagger by N min" or "cook X the day before"
   note. This is what Phase 2 already shows, so there is always at least one move.

### 3.4 Rack budget (`slotModel:'size'`, the default)

| item size | slots |
|---|---|
| small (≤1.5 kg) | 0.5 |
| medium (1.5–4 kg) | 1 |
| large (>4 kg) | 2 |

**Weight source, in order:** the item's planned quantity for this event (`mk-menuqty-<scope>`) → else the
catalog cut's default weight if it has one → **else medium (1 slot)**. Never guess large; an unknown item
costs exactly one slot.

Device capacity = `cap.racks` (smoker/oven) or `cap.zones` (grill); a device with **no capacity recorded**
is treated as capacity 1 (so sharing is not proposed on an unspecified device). A share is feasible only if
the sum of slots of all co-resident items ≤ capacity. With `slotModel:'count'` every item costs exactly 1.

### 3.5 Hard safety floors — **never knobs, never AI-decided**

| rule | value |
|---|---|
| hot-hold floor | **≥60 °C** ambient for the entire hold |
| danger-zone budget | **≤240 min** cumulative between 5 °C and 60 °C, per item, across the whole plan |
| holdable categories | big-collagen cuts only (brisket, chuck, pork shoulder, lamb shoulder) |
| `holdCapMin(it)` — absolute hard cap | **360 min (6 h)** for holdable cuts; **0** for everything else |
| solver generation ceiling | the solver never *emits* a hold longer than `pref('holdMaxH')*60` (≤180 min) |
| never holdable | lean cuts · anything served medium-rare · **all poultry** · **all fish/seafood** |

Two separate numbers, deliberately: `holdCapMin` is the **hard gate** (defense in depth, 6 h), while the
solver only ever *generates* holds up to the user ceiling (≤3 h). In normal operation the 6 h cap is
therefore unreachable — it exists so a future caller (3b re-solving live, or a bad `holdMaxH` value) still
cannot produce an unsafe hold.

```js
function safetyGate(move){
  if(move.kind !== 'hold') return true;
  const it = resolveItem(move.itemKey);
  if(!holdable(it)) return false;                                  // category ban — hard
  if(move.delta.holdMin > holdCapMin(it)) return false;            // per-category cap — hard
  if(move.delta.holdMin > pref('holdMaxH')*60) return false;       // user ceiling, only ever *tighter*
  if(dangerZoneMin(move.itemKey, move) > 240) return false;        // accumulator — hard
  return true;
}
```

`dangerZoneMin(itemKey, move)` sums, over the item's stages, every minute the item is **out of refrigeration
and below 60 °C** (temper/rest/sub-60 hold), including the minutes the proposed move would add. It is a new
computation — nothing tracks this today.

`bcheck` (the existing internal-temp gate appended by `itemStages`) remains the **sole** authority on
"safe to serve". The solver never removes or relaxes a `bcheck` stage.

---

## 4. AI's bounded role

### 4.1 The `action_id` contract

When `pref('aiRank')` and AI is available (`aiAvail()`), the solver's moves are sent to `aiJSON` for
**ordering and explanation only**:

- Prompt carries: the clash summary + the array of `{id, kind, he, en}` moves. **No temperatures, no
  durations are requested back.**
- Schema: `{"order":["<action_id>", …], "why":{"<action_id>":"<one short line>"}}`.
- **Validation:** every returned id must exist in the emitted set, or it is dropped (mirrors the existing
  `aiValidateKeys` pattern). Unknown ids are logged and discarded. If validation empties the list, the
  deterministic order (3.3) is used.
- The AI **cannot** add, edit, or re-price a move. `move.he/en` labels are always the deterministic strings;
  the AI's `why` renders as a separate, clearly-attributed line carrying the existing `.ai-caveat` treatment
  when it contains numbers.

### 4.2 Autonomy

| `autonomy` | behavior |
|---|---|
| `advise` (default) | show the ranked moves as suggestions; nothing is applied. **= today's behavior.** |
| `propose` | show the top move pre-selected with a one-tap **Apply** + undo toast. |
| `autopilot` | defined in `PREFS` for 3b; **no UI in 3a**, and `safetyGate` still applies. |

---

## 5. Safety spine

### 5.1 Fix the shipped guard-laundering bug (do this FIRST, independently)

`aiSafetyNote(answerText, groundingText)` flags safety numbers in AI prose that are **absent from the vetted
grounding**. Of its three call sites:

- `app.js:3431` (Ask the Fire) — grounding `r.ctx` (catalog + `SAFETY_FACTS`). **Correct.**
- `app.js:7920` (photo analyzer) — grounding `SAFETY_FACTS()`. **Correct.**
- `app.js:4432` (Copilot pace note) — grounding `(r.ctx||'') + ' ' + copilotVoiceContext()`. **BUG.**

`copilotVoiceContext()` injects the user's **live probe reading** ("קריאת מדחום אחרונה: 55°C") and target
temp into the guard's grounding. Any number the user's own thermometer reports therefore counts as
"grounded", so AI advice that cites it — *"55 °C is fine, hold it there"* — passes the guard with no
escalation. **User telemetry is not a vetted source.**

**Fix:** grounding becomes `r.ctx` only.
`copilotVoiceContext()` stays in the **prompt** (`app.js:4430`) — the AI needs live state to reason — and in
`vcCookContext()`, which is prompt-only and therefore fine. The rule to encode: *live telemetry may inform
the model, never the guard.*

### 5.2 Regression test (must fail before the fix)

Mock a Copilot answer of `"55°C is fine, hold it"` with a live session whose last probe read is 55 °C, and
assert `aiSafetyNote` renders `.ai-caveat-strong` (ungrounded) — today it renders nothing.

---

## 6. Storage keys

| key | shape | notes |
|---|---|---|
| `mk-pref-autonomy` · `-sharetol` · `-woodswap` · `-hold` · `-units` · `-airank` · `-slots` · `-holdmax` | scalars | new; all absent ⇒ defaults ⇒ today's behavior |
| `mk-item-shift-<scope>` | `{ "<itemKey>|<kind>": minutes }` | new; start offsets applied by `hold`/`advise` moves |
| `mk-item-wood-<scope>` | `{ "<itemKey>": "oak" }` | new; wood overrides from `wood` moves |
| `mk-uilevel`, `mk-theme`, `mk-fontscale`, `mk-tlshape` | unchanged | **adopted in place** by `PREFS`, not migrated |

---

## 7. Testing plan (Playwright, Hebrew **and** English)

1. **Framework** — `pref()` returns the default for absent/invalid values; `setPref` rejects invalid;
   existing helpers (`uiLevel`, `themeKey`, `tlShape`) still return identical values for every stored input.
2. **Defaults = today** — with no `mk-pref-*` keys set, a fixture event that produces a clash renders the
   **exact** Phase-2 output (snapshot the clash banner HTML before/after the change).
3. **Presets** — selecting Simple/Balanced/Pro writes all member keys; changing one knob flips the hub to
   *Custom*; `prefPreset()` matches.
4. **Solver order** — a two-brisket-one-smoker fixture yields a `share` move; ΔT 20 °C with
   `shareTolC:8` yields `reassign`/`hold` instead, never `share`.
5. **Rack budget** — two large items (2 slots each) on a 2-rack smoker do **not** produce `share`.
6. **Sous-vide** — different-temp SV items never produce `share` regardless of `shareTolC`.
7. **Safety gate** — poultry never yields a `hold` move; a brisket hold >6 h is dropped; a hold that pushes
   danger-zone minutes past 240 is dropped.
8. **AI contract** — with `__aiMock` returning an unknown `action_id`, it is discarded and the deterministic
   order is used; with a valid subset, that order is honored and no number from the AI reaches the UI.
9. **Probe laundering** — §5.2 (fails before, passes after).
10. **Units** — `pref('units')==='metric'` puts the metric directive in `askGemini`/`aiJSON`/
    `vcBuildAskPrompt` prompts; `imperial` omits it. (Extends the v246 tests.)

**Discipline:** verify Hebrew **and** English, `node --check app.js` clean, full suite green ×2 before each
`vNNN` ship.

---

## 8. Definition of Done

- Upgrading with no preferences set changes **nothing** observable (test 2 is the gate).
- Every knob in §2.5 is reachable from the Behavior & automation hub, in both languages, with no English
  leaking into the Hebrew UI.
- The solver emits at least one move for every clash `cookerContention` reports.
- No AI-originated number can reach the plan: the `action_id` validation drops anything unknown.
- The probe-laundering regression test passes.
- Suite green ×2; shipped as `vNNN` per slice.

---

## 9. Build slices (each independently shippable + testable)

| slice | contents | ships as |
|---|---|---|
| **1** | Probe-laundering fix (§5.1) + `PREFS`/`pref()`/`setPref()` + helper delegation + hub + Units + presets | `v250` |
| **2** | `orchestrate()` skeleton + `share` + `reassign` + rack budget + safety gate + `advise` fallback | `v251` |
| **3** | `wood` + `hold` + danger-zone accumulator + AI ranking (`action_id` contract) + `propose` autonomy | `v252` |

Slice 1 is worth shipping alone: it fixes a live safety bug and adds the settings surface while changing no
behavior.

---

## 10. Deferred to Phase 3b (separate spec)

Live Copilot enforcement during the cook: re-solving as reality drifts, proactive "do X now" prompts, the
typed action envelopes for *live* actions, and `autopilot` autonomy with its UI.
