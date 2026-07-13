# מתכונת אש — Operational Analysis v157

**Date:** 2026-07-13 · **Branch:** `improvements` · **Method:** 6 parallel read-only operational specialists (cooking-workflow, timing/timers, multi-event/caterer, reliability/offline/data, alerts/attention, safety/decision-support) analyzing how the app behaves when someone is *actually cooking* — at the smoker at 5am, phone in an apron, overnight, or running a catering weekend. De-duplicated and priority-ranked. Line refs are in `app.js` (post-extraction) unless noted; flagship items were cross-confirmed by multiple analysts.

> **The one-sentence verdict:** the app is a beautifully-modeled *planning and reference* tool, but as an **operational cooking cockpit** it has two platform-level failures (alarms that don't fire when the phone sleeps; schedules that can't span overnight), a class of **silent data-loss** risks, a **safety-thin operational path** (the flow the cook actually drives lacks the internal-temp gate the recipe card has), and **~4 real defects in the timer/multi-event features shipped this session**.

---

## §0 · Executive summary

### 0.1 The 4 platform/structural P0s (confirmed by multiple analysts)

| # | P0 | Confirmed by | Operational consequence | Effort |
|---|----|-----|------|--------|
| **A** | **Alarms are dead when the phone is backgrounded/locked/asleep** | alerts, timing, reliability, workflow | Walk to the fire or fall asleep on an overnight brisket → the timer expires **silently**; you learn hours later. No wake-lock, no SW notifications, and `new Notification()` is a **no-op on Android/iOS**. | L (M for wake-lock alone) |
| **B** | **Serve time is clock-only, anchored to *today*** | timing, reliability, multi-event, workflow | The featured 18h brisket serving tomorrow can't be scheduled — set 19:00 and the start computes to ~01:00 *today* (past) → instantly "behind," only fix is tapping "+30m" ~16×. Breaks every overnight cook. | M |
| **C** | **Storage-quota exhaustion silently kills ALL persistence mid-cook** | reliability, timing | `store.set` swallows every exception (`app.js:615`); a few journal photos fill the ~5MB budget → `mk-timers`/`mk-plan-started`/`mk-events` stop saving **with no error**; reload = live cook state gone. The one guard that checks is **dead code** (set never throws). | S–M |
| **D** | **The operational flow has no internal-temp confirmation before serve** | safety | `itemStages`/`workPlanHtml`/`vcRender` schedule "smoke N hours → 🍽️ serve" with **no "confirm ≥ safe°C" gate** — that check lives only in the recipe *card* (`svSteps`/`soSteps`). Poultry (safe 74), pork, sausages go to guests unverified in the flow the cook actually drives. | M |

### 0.2 ⚠ Regressions in the timer/multi-event work shipped this session — ✅ ALL FIXED in v158

The panel found five real defects in code shipped over the last rounds; **all five were hotfixed in v158** (kept below for the record):

- **R1 — "⏹ עצור / אפס תוכנית" wipes *every* event's timers.** `resetPlanTimers()` deletes all keys matching `/^(st-|wp|vc-)/` across the whole store (`app.js:3803`), but timer ids are scoped per event — so stopping Event A silently destroys Event B's live timers, no confirm. **Fix: scope the wipe to `evScope()`** + add undo. (1-line-ish.)
- **R2 — `mk-tlstate` is not scoped per event.** I scoped timers + start-state per event but left method / sv↔smoke order / stage-"done" as one global record keyed by item (`app.js:3408, 3869`). Two events both serving brisket **share** method, order, and done-flags → marking A's smoke "done" marks B's; flipping B to smoke-first rewrites A's schedule *and its safety warning*. **Fix: `mk-tlstate-<scope>`** (mirror `planStartKey`).
- **R3 — timer ids are positional (`st-<scope>-<item>-<stageIndex>`).** Changing method / ready↔scratch / sv↔smoke order mid-cook rebuilds the stage array, so a *running* timer at index 2 now maps to a different stage (or orphans). **Fix: key timers on stable stage identity (kind+role), not array index.**
- **R4 — audio isn't re-primed after reload.** `timerAudioPrime()` runs only in `startFresh` (`app.js:1437`); the reload-restore path (`run()`) doesn't, so a restored running timer expires **silently** (AudioContext stays suspended). Any SW-update refresh triggers exactly this. **Fix: prime on the first post-load `pointerdown`.**
- **R5 (minor) — voice pre-expiry warning fires ~4×** (on every 250ms tick where `left===warnSec`) and can be *skipped* if a tick is throttled. **Fix: one-shot latch + `left<=warnSec`.**

### 0.3 Cross-cutting operational themes

- **T1 · Everything that matters at the smoker runs in the foreground page.** Alarms, stage reminders (`setTimeout` up to 24h out), the serve bar, the feasibility guard, voice alerts — all die or freeze when the tab backgrounds. The service worker exists (offline shell) but has **no notification/push/periodicSync logic**. This is the root of P0-A and half the reliability/timing findings.
- **T2 · "Today-only" time model.** Serve is `HH:MM`; the schedule always builds from `new Date()`. Overnight cooks, next-day caterer prep, cross-midnight "+30m", and the combined multi-event view all break on this one assumption (P0-B).
- **T3 · Two parallel cooking UIs, and the operational one is the safety-thin one.** The per-recipe **card** (`svSteps`/`soSteps`) has the temp-check, danger-zone note, and come-up warning; the **scheduler/work-plan/voice** flow the cook actually drives does not. Every safety P1/P2 is an instance of "lift the card's safety logic into `itemStages`" (P0-D + safety §6).
- **T4 · "Parallel events" is really one fast-switched lane.** `evActive` is a single global pointer; `evLoad` overwrites the working menu/serve; only timers + start-state are truly per-event. `mk-tlstate`, `mk-menuqty`, and `shop:` keys all bleed across events (R2, multi-event §3).
- **T5 · Silent failures everywhere.** `store.set`, `importData`, and the journal-photo guard all swallow errors; the user is told "success" while data is lost (P0-C, reliability §7).

---

## §1 · Alerts, notifications & attention (the make-or-break)

- **[P0] A — background/locked/asleep = no alarm.** (§0.1-A) Foreground `setInterval`+WebAudio only. **Fix:** `navigator.wakeLock` while a plan/timer runs; SW `showNotification`; honest "keep app open" caveat.
- **[P0] `new Notification()` is a no-op on the target phones.** Android Chrome throws "Illegal constructor"; iOS PWA unsupported — both swallowed by `try/catch` (`app.js:1458, 3890`). **Fix:** route through `ServiceWorkerRegistration.showNotification()` + a `notificationclick` handler in `sw.js`. **M**
- **[P1] No wake-lock** removes the only workaround (the voice-cook literally says "נועד לעמוד ליד המעשנת" yet nothing keeps the screen on). **S**
- **[P1] One ~1s triple-beep, then nothing** — no repeat/escalation/vibration/snooze; trivially missed by a grill/fan/party. **Fix:** loop + `navigator.vibrate` until acknowledged. **S**
- **[P1] Audio not re-primed after reload → silent** (= R4). **S**
- **[P1] Stage reminders (`setTimeout`) only run while the app is open** — the toast even admits it ("כל עוד האפליקציה פתוחה"). **M**
- **[P1] The global watcher never requests notification permission** — a cook who uses timers but never opened the timeline-alerts toggle has `permission==='default'` → every notification silently skipped. **S**
- **[P1] Alarm rides the media-volume channel** — phone on silent / DND / volume 0 = totally silent, no haptic. **S**
- **[P2] Voice spoken alerts are panel-bound + foreground-only** (`closePanel`→`clearTimers`). **M**
- **[P2] Pre-expiry warn uses `left===warnSec`** — a throttled tick skips it entirely (= R5). **S**
- **[P2] "Running now" strip shows frozen times** (snapshot at render, never ticks). **S**

**Bottom line (verbatim from the analyst):** *"as built, this is a foreground kitchen-counter timer; it should not be relied on for an overnight, phone-in-pocket, or silenced-phone catering cook."*

---

## §2 · Timing, scheduling & timer operations

- **[P0] A** (background alarms) + **[P1] B** (serve pinned to today) — see §0.1.
- **[P1] The feasibility guard & schedule are not live** — `behind`/earliest computed once per `buildList`; the 30s tick updates only the serve-bar fill. You can cross the point-of-no-return without ever seeing the warning; "start at HH:MM" clocks freeze. **Fix:** recompute `behind`+earliest on the 30s tick and re-render the warn row. **S**
- **[P1] Positional timer ids remap on mid-cook edits** (= R3). **M**
- **[P1] Audio not re-primed after reload** (= R4). **S**
- **[P2] Quota failures swallowed → timer `endsAt` silently not saved** (= P0-C, felt acutely by `_timerSet` on every start/pause/expiry). **S/M**
- **[P2] "▶ התחל תוכנית" records `Date.now()` but never uses it** — start doesn't re-anchor the schedule or auto-start any timer (= workflow §16). **M**
- **[P2] "+30m" can roll serve past midnight into the past** — writes the wrapped `"00:20"` which reads as *today* 00:20 (a corollary of P0-B). **S**
- **[P3] Voice pre-expiry warning repeats ~4×** (= R5). **S**
- **[P3] DST-crossing overnight cooks show start clocks off by an hour.** **M (low value)**
- **[P3] The start-gate is CSS-only** (`.plan-idle` pointer-events), not a functional lock. **S**

---

## §3 · Multi-event / professional (caterer) operations

- **[P0] `mk-tlstate` shared across events** (= R2) — the one true multi-event *correctness bug*, with an unsafe-cook path. **M**
- **[P1] No cross-event equipment/resource contention** — one smoker, two fully-overlapping 6h smokes across events → nothing flags it (discovered at the pit at 6am). Model equipment counts; detect/queue overlaps on the combined view. **L**
- **[P1] Combined timeline ignores `ev.date`** — jams every event onto one 24h clock, no day labels; a 30h cure shows a bare "13:00" that's really the previous day. **M**
- **[P1] Combined timeline uses the *default* method + assumes "ready"** — understates durations; a "smoke-first" brisket or a 3-week salami shows default/short timing. **Fix:** read each event's (namespaced) tlState; flag multiDay cures. **M**
- **[P1] Combined view merges only item-*starts*, not stage tasks** — you get "when to start each dish," not the interleaved minute-by-minute list you actually need juggling events on one line. **L**
- **[P1] No consolidated cross-event shopping list**; `mk-menuqty` is global + goes stale on `evLoad` (dashboard "🛒" shows the *previous* event's quantities); `shop:` check-off is keyed by ingredient text so **it bleeds across events** (check A's brisket → B reads bought → under-buy). **M**
- **[P1] The global alarm never says *which* event** — "brisket smoke done" for 3 running events is ambiguous; store the event name on the timer record. **S**
- **[P2] No staff / roles / station assignment / shift handoff** — a caterer can't split or print the plan per person. **L**
- **[P2] Per-event output is menu-only** (no crew-facing prep/timeline print); plan/cart/print all `evLoad` first, mutating the active event as a side-effect. **M**
- **[P2] "Active event" is a single global pointer** — events are fast-switched, not truly parallel; each glance clobbers the working copy (= T4). **L**
- **[P2] Tapping another event can wipe an unsaved draft** (the draft guard runs only on "start new", not `data-evload`). **S**
- **[P3] `evRunningCount` matches timers by substring `-<id>-`** — fragile heuristic; parse the scope segment explicitly.

---

## §4 · Reliability, offline & data operations

- **[P0] A** (alarms) + **[P0] C** (quota silently kills persistence) — see §0.1.
- **[P1] No `navigator.storage.persist()`** → iOS/Safari evicts non-installed web storage after ~7 days idle, or under pressure any time; a caterer's week of events + the live plan can vanish. **Fix:** `persist()` on first save; show usage in the backup panel. **S**
- **[P1] Overnight cooks mis-schedule** (= P0-B, from the data/time angle). **M**
- **[P1] Crash/reload recovery is incomplete** — timers restore, but the serve bar + stage reminders + start-gate don't re-arm until you manually reopen the timeline (app lands on Home). **Fix:** on load, if any `mk-plan-started-*` is set, re-hydrate. **M**
- **[P1] Single device, manual-only backup** — lost/reset phone = everything gone; no auto-export or sync. **Fix:** auto-download a backup on `evSaveCurrent`; periodic nudge. **S–M**
- **[P1] Import silently half-restores and reports "✓ success"** — per-key `setItem` in a swallowing `try/catch`, merges instead of replacing (contradicting the UI), no `app`/`ver` validation. Worst possible moment to mislead. **S**
- **[P2] "New version — refresh" toast's button is labeled "בטל" (Cancel) but triggers `location.reload()`** mid-cook (toast hardcodes the label). **Fix:** correct label + suppress while `planStarted()`. **S**
- **[P2] Offline loses the Hebrew display fonts** (cross-origin, not precached) and AI fails with only generic errors. **Fix:** self-host a woff2 Hebrew subset in the SW shell; explicit "AI needs internet" state. **M**
- **[P2] Network-first navigation** makes the installed app slow to cold-open on 1 bar (waits for network timeout before the cached shell). **Fix:** cache-first / SWR the shell. **S**
- **[P2] "Super reset" lives in the backup panel with only a 5s undo** — a stressed mid-cook mis-tap wipes the live event+timers. **Fix:** hold-to-confirm + a longer "recently deleted" restore. **S**
- **[P3] The backup file exports `mk-gemkey` (the Gemini API key) in plaintext** — sharing your plan hands over your paid key. **Fix:** exclude/strip it. **S**

---

## §5 · End-to-end cooking workflow & operational UX

- **[P0] R1** (cross-event timer wipe) + **[P0] B** (serve = today) — see §0.
- **[P1] "▶ התחל תוכנית" is a misleading near-no-op** — un-dims timer buttons + stores an unused timestamp; doesn't start the cook or re-anchor. A pitmaster reads it as "begin." **Fix:** either wire it (launch due timers + re-anchor to press time) or rename it honestly. **M**
- **[P1] No "start late → reschedule from now"** — behind-schedule offers only +30m serve nudges; the backward schedule is never recomputed from the real start. Every real cook drifts. **M**
- **[P1] Voice-cook from the wizard opens empty on first use** — `_wpTasks` is populated only in `workPlanHtml` (plan view), default view is 'items'; fresh users get "אין שלבים". **Fix:** compute tasks regardless of view. **S**
- **[P1] No at-a-glance "cook in progress" on Home** — running badges live only in the Events screen for *saved* events; a 'cook'/'draft' live plan surfaces nowhere; close the modal and it's lost. **Fix:** Home banner when any `mk-plan-started-*` / `evRunningCount>0`. **M**
- **[P1] Two overlapping "activate" concepts** — 🔔 alerts (clock-time, gated by `mk-tlalerts`) vs ▶ start (un-dims timers) — you can get reminders with dead buttons, or live buttons with no reminders. **Fix:** one live-mode toggle. **S**
- **[P1] Positional timer ids remap on mid-cook edits** (= R3). **M**
- **[P2] Multi-day "blocked" items vanish from the 📋 plan** (`if(c.blocked) return`) — they're absent from the printed sheet. **Fix:** emit a "prepare X days ahead" advisory task. **S**
- **[P2] Plan checkboxes don't persist** (`wp-ck` has no handler/state) — every re-render/reload wipes your place. **Fix:** persist per-task completion. **M**
- **[P2] Feasibility "earliest" ignores prep tasks** (marinade −2h, cure, from-scratch build) — green-lights a cook that's already too late on the prep side. **Fix:** min over *all* tasks. **S**
- **[P2] No "now / next" cue** in the item/plan views — only the combined view greys past rows; the cook clock-maths against the wall. **Fix:** highlight current/next, dim done. **S**

---

## §6 · Safety operations & real-time decision support

- **[P0] D — no internal-temp confirmation in the operational flow** (§0.1-D). Append a mandatory `bcheck` stage to `itemStages` (show `safe°C`), rendered last-before-serve in all shapes and read aloud in voice-cook. **M**
- **[P1] Danger-zone / 4-hour rule is glossary-only** — the only dynamic note (`svt<55`) lives in the recipe card AND misses **exactly-55°C** (the hamburger preset `svt=55/safe=71` draws no warning). **Fix:** `<55`→`<57`, lift into `itemStages`, optional live "time in danger zone" counter off the timer infra. **M**
- **[P1] SV pasteurization clock starts at bath-in, ignoring come-up-to-core time** — the card warns "+20%"; the scheduler schedules the raw `svHours`, so thick items are under-held. **Fix:** pad the scheduled `sv` stage; label "hold begins at core-at-temp." **S**
- **[P1] Feasibility treats "behind" as scheduling, never safety** — it literally suggests "**קצר את התוכנית**" (shorten the plan), the exact path to undercooked poultry/brisket; strict mode blocks only *before* start, never mid-drift. **Fix:** warn that compressing safety-critical stages undercooks; steer to "push serve"; re-check mid-cook. **S**
- **[P1] Equilibrium-brine recomputes salt but not the nitrite cure** — the app *recommends* equilibrium ("בטוחה מפני מליחות-יתר") yet leaves Cure #1 at the per-liter immersion rate → an unvalidated nitrite dose in the one calc where that's acutely dangerous. **Fix:** compute equilibrium cure on (meat+water) too. **S**
- **[P1] Cure #2 warning is passive text, not a gate; multi-day cures get no in-moment checkpoints** — the highest-risk products (fermented salami, cold-smoked fish) get a one-line note + a hand-off to Pantry. **Fix:** `appConfirm(danger:true)` acknowledgment; dated pH/temp checkpoints. **M**
- **[P1] Voice "מה הטמפרטורה?" returns the *pit* temp** (first number in the label) not internal/safe — the eyes-off interface is least safe on the most safety-relevant question. **Fix:** prefer internal `safe`/`tgt`, distinguish aloud ("pit 110, pull at 74"). **S**
- **[P2] No cross-contamination / cooling / reheating / leftover guidance** in any operational flow — the caterer's cook→hold→serve→leftover gap (where illness happens) is silent. **M**
- **[P2] No check that (svt, svh) actually pasteurizes to `safe`** for the chosen doneness — done right only in the burger special-case (`app.js:5883`); generalize it (incl. AI recipes). **M**
- **[P2] No poultry hold-time (Baldwin) support in the moment** — the powerful "60°C/35min ≈ 74°C instant" idea is glossary-only. **M**
- **[P3] "+30m" is unbounded + never re-validates safety**; **stage timers are decoupled from actual bath/pit temp** (a "pasteurization" timer announces done regardless of whether temp held — prompt a core-temp check on expiry).

**✅ Safety strengths to preserve:** `comboHasSvSmoke` gates the risky smoke-first order to only items with cited `pasteurize:true` data + a standing warning; the burger 71°C ground-meat warning; the 156ppm / Cure #2 notes; AI recipes marked unverified with salt/cure forced from app presets (never the model); timers persist as absolute timestamps.

---

## §7 · Do-first shortlist

**Wave A — hotfix the session's regressions (S, ship immediately):** ✅ **DONE (v158)** — R1 (scope `resetPlanTimers` + undo), R2 (`mk-tlstate-<scope>`), R3 (stable stage ids), R4 (prime audio on first post-load gesture), R5 (voice-warn latch + `<=`).

**Wave B — the two platform P0s:**
- **B (overnight time model):** ✅ **DONE (v159)** — `serveDateTime()` resolves the serve day (explicit picker → `ev.date` → today, rolling to tomorrow when the clock passed); date picker added; serve bar / feasibility / "+30m" / combined view all datetime-aware with day labels. Unblocks every long cook.
- **A (background alarms):** *next* — `navigator.wakeLock` while a plan runs (S, restores the only reliable path) → SW `showNotification` + `notificationclick` (M, fixes the mobile no-op) → looping alarm + `vibrate` + acknowledge (S). Plus an honest in-app caveat until push lands.

**Wave C — stop silent data loss (C):** make `store.set` surface quota failures; `navigator.storage.persist()`; fix `importData` to validate + report partial restores; correct the refresh-toast label.

**Wave D — close the operational safety gaps (D + §6):** add the internal-temp `bcheck` stage to `itemStages` (+ voice); tie the feasibility guard to safety ("push serve," not "shorten"); lift danger-zone / come-up-time into the scheduler; fix equilibrium-cure and the voice pit-vs-internal temp answer.

**Wave E — make multi-event genuinely professional:** namespace `mk-menuqty` + `shop:` per event and add a consolidated cross-event shopping list; put the combined timeline on a real date axis with real methods + stage-level tasks; event names in alarms; cross-event equipment-contention flags; treat events as first-class records (no `evLoad` side-effect).

**Wave F — workflow legibility:** make "▶ התחל תוכנית" mean start (or rename) + "reschedule from now"; a Home "cook in progress" banner; persist plan checkboxes + a now/next cue; keep multi-day items on the printed plan; fix the empty voice-cook-from-wizard.

*Open decision for you:* I recommend shipping **Wave A immediately** (they're live regressions), then **B → A → C → D** in that order. Nothing here is implemented yet; `main`/v157 is the stable baseline and all analysis is isolated on `improvements`.
