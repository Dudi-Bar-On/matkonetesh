# Plan depth — the pro vs. basic user model

**Date:** 2026-07-20 · **Status:** awaiting owner approval
**Inputs:** independent consultations with a product/UX designer and a practising pitmaster/charcutier.
They converged on nearly every point; where the craft view sharpened the UX view, the craft view wins.

---

## 1. One product with a depth dial — NOT two modes

Two modes means two plan generators. With one maintainer and a HE+EN test matrix that already doubles every
case, they will diverge — and the second place for the internal-temp gate to go missing is the one that
kills someone. The premise also needs correcting: **pro and basic are not two people, they are two
appetites**, and the same person switches between them by Tuesday.

→ One plan, one generator, and a **depth filter over it**.

## 2. Depth is its own control, not `uiLevel`

`uiLevel` governs **reading** (density, work-plan shape). Depth governs **doing** (which tasks exist).
Coupling them means a pro who just wants a bigger font also gets fuel micromanagement.

```js
planDepth: {store:'mk-pref-depth', def:'standard', valid:['essential','standard','full'], group:'plan'}
```

- **Global default** in the Behavior & automation hub; **per-cook override** stored per `evScope()`.
- The surface already exists: the `.tl-detailtoggle` strip (app.js:4818) currently reads
  *"רמת פירוט: מקוצר | מלא"* and only swaps the `det` string. **Promote it to three chips —
  *עומק התוכנית: חיוני · רגיל · מלא* — and make it change task EXISTENCE, not just detail text.**
- **Gear and depth are orthogonal.** Owning less ≠ wanting less. Depth never rises because you bought a
  smoker; Full only emits equipment-derived tasks for gear you actually own (a pellet owner at Full still
  has no split-reload task).

## 3. Essential is a DERIVATION, never an authored list

This is the safety-critical part. The failure mode is silent divergence: Essential quietly drops something
load-bearing and nobody notices, because testing happens at Full.

- Keep **one** task array. Tag each task `depth: 0|1|2` at the `tasks.push()` site in `workPlanHtml`.
- `essential = tasks.filter(t => t.depth === 0)`.
- **Two build-failing tests:**
  1. every `kind==='bcheck'` task, every cure/nitrite task, and every stage the walk-back consumes carries
     `depth===0` — making it structurally impossible to tag a gate as optional detail;
  2. render the 5.5 kg brisket at all three depths and assert the **serve time is byte-identical** and the
     bcheck node is present in **all three** DOMs.

> **Depth may change what you read. It may never change when you eat, or whether you are gated.**

*(Verified: `depth:` appears 0 times in app.js today — this field does not exist yet.)*

## 4. Essential ADDS things Full doesn't need

Both experts raised this independently, and it inverts the naive "fewer steps" model:

- **The stall reassurance task.** A 12-hour cook with no stall warning produces a panicked user at hour 3
  who cranks the heat — the single most common ruined brisket. Essential must say: *"it will sit at
  70–75 °C for 3–5 hours. This is correct. Do not raise the heat."* That task category does not exist in
  the model today.
- **Slack, not detail.** Back-schedule Essential with a ~2 h buffer absorbed in the hot hold; Pro can run
  30 min. Per the pitmaster this scheduling difference is *"the most valuable thing separating the two
  modes"* — more valuable than any task list difference.
- **Thresholds instead of judgement.** Convert every pro judgement into a concrete number: wrap at 75 °C,
  pull at 97 °C then check feel. A slightly-wrong number beats an open question every time.
- **Interrupt a beginner for exactly three things:** pit temp is wrong, it's finishing early, it's finishing
  late. Everything else stays silent.

## 5. Never droppable at any depth

- **Temp verification at the end** — never a clock-only pull. ("Minutes per kg" for brisket is a lie:
  5.5 kg at 107 °C runs 12–18 h.)
- **Naming the stall.**
- **A rest ≥ 1 h.** Never zero.
- **Poultry 74 °C, verified.** No basic variant.
- **Cure dosing, weighed, never volumetric.** No simplified variant exists.
- **Sous-vide: time *at* temp, not arrival at temp**; nothing below 54.4 °C pasteurizes at any practical
  time — hold-and-serve only, never cook-chill.
- **No thermometer registered → refuse to schedule poultry or charcuterie**, and say so plainly.

## 6. Safety is MORE prominent at Essential, not equally prominent

Depth changes how much you're told, never whether a gate exists. Enforce structurally:
- Gates are **never** inside an accordion, never in the `det` layer that Short drops, never a plain
  `.wp-row` checkbox. `kind==='bcheck'` renders as a full-width gate card at **all three** depths.
- Essential copy is a **decision, not a datum**:
  *"אל תגיש עדיין. תקע מדחום בחלק העבה — צריך 95°. פחות מזה? סגור, חכה 30 דק׳, בדוק שוב."*
- **Cure + no 0.1 g scale registered → the task BLOCKS.** "A scale is the one thing the basic path is
  allowed to require." This is audit finding D7 finally biting.
- **Hebrew-specific poisoning path:** the plan must name the *product* and the *number* for cure —
  "מלח ורוד" is ambiguous with Himalayan pink salt. Never abbreviate this.

## 7. Where equipment genuinely rewrites the plan (not just wording)

| device | tasks that MUST exist | tasks that MUST NOT exist |
|---|---|---|
| offset | split every 30–45 min · "check the fire before you check the meat" · 90 min pre-burn | — |
| pellet | "≥9 kg in the hopper for overnight" · 10-min startup | **any add-wood task** — *"a pellet plan telling you to add wood makes the whole app look fake"* |
| kamado | full basket before lighting (cannot refuel mid-cook) · insert deflector · **approach 107 °C from below, close vents at 90 °C** (overshoot is unrecoverable) | refuel tasks |
| electric | chips every 45–60 min for the first 4–5 h only · ceiling warning (no finish above ~110 °C pit) | vent tasks |
| kettle | "build the snake, 2 rows, chunks at intervals, light 8–10 coals at one end" | — |
| chimney vs none | 15–20 min vs 25–30 min — **a real back-schedule difference**, not wording | — |
| **leave-in probe vs instant-read only** | with leave-in, "wrap at 74 °C" is an **alertable event**; without, it becomes **scheduled checks** ("first check at 4 h, then every 45 min; each check costs ~10 min — batch them") | — |

## 8. Hanging — the second occupancy mode, from the craft

- **Capacity:** a drum takes 4–6 racks of ribs on hooks vs 2 on a grate — a one-batch/two-batch
  **scheduling** decision, not a cosmetic one.
- **Durations actually change:** ribs finish in 3–3.5 h hanging at 120–135 °C vs ~5 h at 107 °C on a grate.
- **Tasks with no grate analog:** *"hang sausages 1–2 h until the casing is tacky before any smoke"* (the
  most-skipped step in charcuterie — smoke will not stick to a wet casing) · "hook between the 2nd and 3rd
  bone, thick end up" · "they shrink as they dry — re-check the hooks at 45 min".
- **Rotation:** vertical stacks run 20–30 °C hotter at the top → "swap top and bottom at halfway".
- **Chamber hang:** a finger's width between pieces; no fan blowing directly on the meat (case hardening).

## 9. Equipment capture — demand-driven (this REVISES the property audit)

The UX read changes how the new properties should be collected. **Do not ask for 9 properties up front.**

- Keep the model exactly as is: `{cat, type, name, cap:{}}`. Required forever: `cat` + `type` only.
- **Never ask for a property until a plan needs it.** The plan asks inline, one tap, *with its own
  justification* — "כמה מדפים?" appears the first time two items land on one smoker; circulator volume is
  asked when a bath-preheat task first appears.
- **Every `cap` key gets a class default by `type`** (pellet preheat 15 min, offset 45, kamado 20, 24 L bath
  ≈ 40 min), so an empty `cap` is never a blocker — only a precision loss.
- Surface completeness as **"ציוד: 3 · דיוק 40%"**, never "incomplete". Incompleteness must not read as
  failure.
- The pro's fast lane is the **AI lookup already shipped**: paste a model, get the whole `cap` block at once.

Same model, same fields, two speeds — and no second data model.
