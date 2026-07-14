# Adaptive Home — design & build plan

Approved direction (design panel + owner review, mock at scratchpad `home-mockup.html`).
Refactor the **render layer only** — no DATA / engine changes. Every string ships **he + en** via `L()`/dict; verify **RTL @390px** and a **0-Hebrew-leak** English sweep per phase.

## Direction: "Jobs-on-the-fire, gear-derived"
The home is a **launcher**; advanced surfaces (work-plan, Active-now hub, multi-event command center, voice-cook) are **destinations** it routes to — none are on the home cards, so the refactor can't touch them. Nothing is ever removed from the DOM/catalog/search; adaptation only **reorders/demotes** via body classes → instantly reversible.

**Two axes, one model:** `gear` decides what's *relevant* up front · `level` decides how *dense/prominent*. Owner (Pitmaster + all gear) sits at the densest end; the default persona (advanced, smoker+grill, no SV, buys sausage → no from-scratch projects) sees a subset. No hard beginner/home/pro fork.

## Home layout (top → bottom)
1. Slim brand (one line); **gear-aware kick** — drop "סו-ויד" when `!canSV()`.
2. Gear chip "🔧 <owned> · שנה" (the honest "why the page looks like this") → openGear.
3. **Active-now strip** (when `_liveCookState().live`) — jumps to top.
4. **Multi-event bar** (when 2+ events) — "🗂️ N cookouts · combined schedule · clash ⚠" → the command center (v203).
5. **HERO — "What's on the fire tonight?"** → gear-aware **quick-pick chip lanes**: 💨 smoker (iff canSmoke), 🔥 grill (iff canGrill), 💧 sous-vide (iff canSV), each chip → `openCut()` (the missing single-cut fast lane). Search stays as the escape hatch.
6. **ONE "Hosting? plan the cookout" card** (merges today's two duplicate wizard cards) + inline "or just cook (no event)".
7. **Pit-tools dock** (pro only): Compare · Salt/cure calc · Combined timeline · Journal (+ `/` `c` keyboard hints on desktop).
8. Craft/projects card — **promoted** to a full card iff charcuterie gear present; else demoted to the utility row.
9. Utility row: Ask the Fire · [Crafts] · [Doneness iff probe] · Full catalog.
10. Footer: how-to + credit (how-to promoted to a card only at beginner level).

## Adaptation logic
`homeGear()` (one source of truth, reads mk-gear per paint via `canSV/canSmoke/canGrill` + `g.thermo`/`g.grinder`/`g.stuffer`) → `cRefreshHome()` stamps body classes:
`is-cooking` (`_liveCookState().live`), `gear-nosv` (`!canSV()`), `gear-noproj` (no charcuterie gear), `lvl-beg|lvl-mid|lvl-pro` (`uiLevel()`). CSS does the reorder/hide. `openGear`/`setUiLevel` already re-render on save → reversible.
- Default persona body = `gear-nosv gear-noproj lvl-mid` → smoke+grill lane, one hosting card, SV only via search, crafts a small row, no dock.
- Buy a circulator → SV lane + kick word return next paint. Buy a stuffer/grinder → crafts card promotes. Sell → they swap back.

## The More ☰ menu adapts too (same model)
Demoting off the home must NOT bloat More. Make `openMoreSheet` gear/level-aware (short for beginners, full for pros) + a "most-used" top section, so More gets *shorter* for the default persona.

## OWNER ADDITIONS (requested — build after the auto-adaptation lands)
- **Home customization** — let the user pick **which tools appear on the home and in what order** (a manual override layer on top of the gear/level auto-defaults; e.g. `mk-homecustom` = ordered list of enabled home modules). Auto-defaults seed it; user can reorder/toggle; "reset to smart default" restores the gear/level layout.
- **AI features for everyone** — AI is a first-class part of the app, NOT pro-gated. "Ask the Fire" stays reachable for **all levels** (compact but present), and AI tools (recipe generator, diagnose, event planner, seasoning AI, …) surface as broadly as makes sense, tuned by level/equipment. The real gate is **API-key availability**, not experience level. Leave room to add more AI-based tools/implementations over time. Level/gear may adjust prominence and which AI tools lead, but availability stays wide.

## Phased build (each independently shippable + tested)
- **Phase 0** — plumbing: `homeGear()` + body classes in `cRefreshHome`; fix the greeting hardcoded-Hebrew (route `#cGreet` through `L()`). No visible change.
- **Phase 1** — header slim + gear-aware kick; merge the two wizard cards into one "Hosting?" card (+ "or just cook" branch). Kills the double-header + false choice.
- **Phase 2** — live/resume banners to top-of-fold via `body.is-cooking` + CSS order.
- **Phase 3** — the fast-lane quick-pick chips (DATA-derived by category+difficulty, `resolveItem`-guarded, → openCut) + smoker tip line. The headline feature.
- **Phase 4** — multi-event bar (2+ events → command center) + Pit-tools dock (pro) + demote Ask/Projects/onboarding + gear-summary chip.
- **Phase 5** — uiLevel layer (beginner forgiving-first + how-to card; pro pitmaster-first + dock + compare) as CSS order/display on the same nodes.
- **Phase 6** — the More-sheet adaptation.
- **Phase 7 (owner add)** — home customization (choose/reorder home modules).
- **Phase 8 (owner add, ongoing)** — broaden AI access across levels + scaffold for new AI tools.

Acceptance per phase: RTL + LTR @390px; the 3 levels × (no-gear / default / full-gear) grid stays sane; no body horizontal scroll (chip rails scroll on their own rail); every new string he+en; full Playwright suite green twice.
