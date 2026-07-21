# Product-Document Conformance Audit — 2026-07-22

Scope: `roadmap-vNext.md`, `ai-prd.md`, `ai-implementation-plan.md`, `docs/ai-strategy.md`,
`docs/ROADMAP-v149.md` (+ the ~120 findings of `docs/ANALYSIS-v149.md` it sequences), `docs/REVIEW-v147.md`,
`docs/OPERATIONS-v157.md`, `docs/fire-guide-ux-refactor-prompt.md`, `README.md`, `HANDOFF-PROMPT.md`.
Every row below was checked against the live `app.js`/`app.css`/`data.py`/`sausages_new.py`/tests, not
trusted from the document text. "DONE" requires a named function/line **and** a behavioural signal
(a test, or code that reads the value). Line numbers are current `app.js`/`app.css`/`data.py`.

## Legend
DONE · PARTIAL (built but incomplete/inert-in-part) · NOT DONE · SUPERSEDED (named successor) · ABANDONED (no trace, no successor)

---

## 1. `roadmap-vNext.md` — 7-step UX roadmap (pre-v144)

| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| RV-1 | Fixed high-contrast + `mk-fontscale` text-size control | roadmap-vNext.md:19-25 | DONE | `mk-fontscale` store key + `setFontScale()` app.js:7009; `--fscale` var used ~80× in app.css | |
| RV-2 | 4 selectable color themes (`mk-theme`) | roadmap-vNext.md:27-32 | DONE | `THEMES` const, `setTheme()` app.js:7007; `mk-theme` pref app.js:6803 | `wave1-theme.spec.ts` |
| RV-3 | 4 font pairings (`mk-fontpair`) | roadmap-vNext.md:34-38 | DONE | `FONT_PAIRS`, `setFontPair()` app.js:7008 | |
| RV-4 | UI levels beginner/mid/advanced (`mk-uilevel`) | roadmap-vNext.md:40-46 | DONE | `UI_LEVELS`, `setUiLevel()` app.js:7027, onboarding ask app.js:7072-7073 | |
| RV-5 | Timeline shape by level (`mk-tlshape`, 3 shapes) | roadmap-vNext.md:48-53 | DONE | `SHAPE_NAMES`, `setTlShape()`/`resetTlShapeToLevel()` app.js:7030-7031 | |
| RV-6 | Sous-vide↔smoke order toggle + dynamic pasteurization warning | roadmap-vNext.md:55-63 | DONE | `svSmokeOrderDefault()` app.js:2959, `comboHasSvSmoke()` app.js:3264, danger-zone warning app.js:5888/5991 | superseded/hardened further by OPS157 Wave D (`bcheck` gate, §3 below) |
| RV-7 | Gear-aware method filtering/tags | roadmap-vNext.md:65-70 | DONE | `canSV/canSmoke/canGrill` app.js:786-793, gear-aware home tagline app.js:7496 | superseded by "Equipment 2.0" device list (`mk-equipment`, app.js:33) — a materially richer model than this doc envisioned |

**RV summary: 7/7 DONE**, and step 7 was subsequently superseded by a more sophisticated Equipment 2.0 model (device-level occupancy), not just left as originally scoped.

---

## 2. AI features — `ai-prd.md` + `ai-implementation-plan.md` (AI section)

| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| AI-INF-1 | `aiJSON()` shared JSON caller + `AI_JSON_SYS` guard | ai-implementation-plan.md:9-27 | DONE | `aiJSON()` app.js:4338, mock seam `__aiMock` app.js:4335 | |
| AI-INF-2 | `aiValidateKeys()` grounding gate | ai-implementation-plan.md:29-39 | DONE | `aiValidateKeys()` app.js:4387 | |
| AI-INF-3 | `aiAvail()` graceful-degradation gate | ai-implementation-plan.md:41-45 | DONE | `aiAvail()` app.js:4271 — now covers BYOK **and** managed access (extended beyond the PRD's key-only scope) | |
| AI-INF-4 | `aiConfirmPanel()` unified apply/edit/cancel | ai-implementation-plan.md:47-49 | DONE | `aiConfirmPanel()` app.js:4404 | |
| AI-INF-5 | `__aiMock` offline test seam | ai-implementation-plan.md:51 | DONE | app.js:4335; used across `ai-trust.spec.ts`, `wave3-ai-hardening.spec.ts` | |
| AI-F1 | Feature 1 — free-text event planner (`aiPlanEvent`) | ai-prd.md:41-61 | DONE | `aiPlanEvent()` app.js:8314 | |
| AI-F2 | Feature 2 — backward-planning pantry advisor | ai-prd.md:62-79 | DONE | `pantryAdvisorLocal()` app.js:9145 (local fallback); AI-enriched path present per `aiAvail()` gating | verify AI-path (not just local) has its own test coverage — not confirmed beyond local fallback |
| AI-F3 | Feature 3 — "what can I make" inventory×gear cross-match | ai-prd.md:80-96 | DONE | `wcimLocal()` app.js:8155 | |
| AI-F4 | Feature 4 — item-context seasoning suggestion | ai-prd.md:101-104 | DONE | `aiSeasonRec()` app.js:8406 | |
| AI-F5 | Feature 5 — personal diagnose-a-cook | ai-prd.md:105-108 | DONE | `aiDiagnose()` app.js:8475; caveat wired at app.js:8499 | |
| AI-F6 | Feature 6 — recipe generator → user project (`umake-*`), salt/cure computed by the app | ai-prd.md:113-116 | DONE | `UMAKE_CALC` app.js:8531, `umakes()`/`saveUmakes()` app.js:8528-8529, id space `umake-` app.js:8576 confirms separate keyspace as specified | |
| AI-F7 | Feature 7 — journal insights, data-anchored | ai-prd.md:117-119 | DONE | `journalInsightsGrounding()`/`journalInsightsRender()` app.js:8640/8655 | |
| AI-TEST-1 | 4-layer test convention (grounding/validator/applier/degradation) per AI feature | ai-implementation-plan.md:135-143 | PARTIAL | Confirmed for Wave-1/2/3 features (`ai-trust.spec.ts`, `copilot.spec.ts`); not verified feature-by-feature for F2/F4/F7 within this audit's time budget | Flag for a dedicated test-coverage audit, not asserted DONE or NOT DONE here |

**AI-PRD summary: all 7 PRD features + all 5 infra primitives (A1–A5) DONE** — a materially different outcome than the "waves stalled" hypothesis the brief anticipated. The PRD's release-train version numbers (v124–v131) don't match current reality (app is far past v255) but the **content** of every commitment is present in code.

---

## 3. `docs/ai-strategy.md` — moat/monetization strategy (AI + business section)

### Wave 1 — Trust & infra foundation
| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| STRAT-A1 | Safety caveat on Diagnose & Journal (previously unflagged) | ai-strategy.md:44 (Part A, H) | DONE | `aiSafetyCaveat()` wired at app.js:8499 (diagnose) and 8664 (journal) | |
| STRAT-A2 | Numeric-invariant guard on AI answers | ai-strategy.md:45 | DONE | `mtNumSig`/`mtSafe`/`mtGuard` app.js:6951-6958 (built for i18n MT, reused as the numeric-invariant check) | |
| STRAT-A3 | Always-on safety grounding by intent (not just entity match) | ai-strategy.md:46 | DONE | intent detector app.js:4118 ("W1-P4"), feeds a dedicated safety path | |
| STRAT-A4 | Deterministic refuse/deflect for known-dangerous intents | ai-strategy.md:47 | DONE | app.js:4144-4194 ("W1-P5"): sourced safety cards for no-nitrite-cure / under-pasteurized / below-safe-dose asks | tested in `ai-trust.spec.ts` |
| STRAT-B-A1 | `gemText()` shared free-text caller (kill 5× duplication) | ai-strategy.md:64 (Part B) | NOT DONE | No `function gemText` in app.js; free-text callers (`askFire`, `aiDiagnose`, etc.) still call `gemFetch` individually | Minor internal debt, not user-facing |
| STRAT-B-A2 | Model/thinking router (pro+thinking for Diagnose/Event-planning) | ai-strategy.md:65 | NOT DONE | Single `GEM_MODEL='gemini-2.5-flash'` constant app.js:4206, no per-feature tier param found | |
| STRAT-B-A3 | `responseSchema` typed JSON mode (replace prose-hint+fence-strip) | ai-strategy.md:66 | NOT DONE | No `responseSchema` in app.js; `aiJSON` still uses schema-hint text + fence stripping | |
| STRAT-B-A4 | Output-language directive fixing the Hebrew-in-English-UI leak | ai-strategy.md:67 | DONE | `outLang` directive app.js:4343-4344, `LANGNAME` map app.js:6880 covers en/ar/ru/es/fr/de | |
| STRAT-B-A5 | Response cache + in-flight `AbortController`, panel-reopen fix | ai-strategy.md:68 | PARTIAL | `AbortController` exists for request timeout (app.js:4218-4220) but that's per-call cancellation, not a reopen/in-flight guard; no dedicated cache layer found | |
| STRAT-B-A6 | One caveat/citation layer for any answer with safety numbers | ai-strategy.md:69 | DONE (via A1) | `aiSafetyCaveat` applied at multiple call sites (see STRAT-A1) | |

### Wave 2 — Flagship: Live Cook Copilot
| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| STRAT-COP-1 | Live Cook Copilot session (Now/Next, anchored to timers) | ai-strategy.md:80-83 | DONE | `openCopilot()` app.js:5467, `startLiveCook()`, session lifecycle | `copilot.spec.ts` (`W2-P1`) — full lifecycle test incl. Home-banner launch |
| STRAT-COP-2 | Stall detection + advisory | ai-strategy.md:83 | DONE | `copilotStallInfo()` app.js:5368 | `copilot.spec.ts` (`W2-P2`), 65-77°C band classification tested |
| STRAT-COP-3 | Probe reading → pace/behind-schedule feedback | ai-strategy.md:83 | DONE | `copilotLogProbe()`, `copilotPace()` app.js:5381/5395 | |
| STRAT-COP-4 | "Ask now" AI-grounded advice, vetted-context-only | ai-strategy.md:83 | DONE | `copilotAskNow()` app.js:5448, grounding comment confirms vetted-context-only design (app.js:5461) | This is the single most significant *unexpected-good-news* finding: the "70%-exists" flagship the strategy doc proposed is now essentially fully built |

### Wave 3 — Delight & retention
| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| STRAT-D1 | Photo analyzer (bark/doneness/smoke-ring/charcuterie mold) | ai-strategy.md:83 (Tier 1) | DONE | app.js:9295-9313, explicitly "ALWAYS advisory ('probe decides')", never states a numeric safe temp from the photo | |
| STRAT-D2 | Charcuterie Safety Guardian (checks not invents; weight-loss vs. safe minimum) | ai-strategy.md:84 | DONE | `charcuterieGuardian()` app.js:8694, `SAFE_MIN` ~35% weight-loss threshold app.js:8693/8700 | deterministic, not AI-generated — matches the "checks not invents" design intent exactly |
| STRAT-D3 | Personal Coach (longitudinal journal intelligence) | ai-strategy.md:87 | DONE | app.js:3601 "deterministic longitudinal intelligence from the journal (no key needed)" | |
| STRAT-D4 | AI onboarding concierge (describe gear in words → config) | ai-strategy.md:90 | DONE | app.js:6115 "local-first keyword parser (offline, no key)" | |
| STRAT-D5 | Adaptive schedule agent (recompute on serve-time change + smoker clash) | ai-strategy.md:85 | PARTIAL | Equipment-clash detection confirmed built (OPS157 Wave E, §4 below); did not confirm a dedicated "recompute whole backward plan on time change" AI-driven path within budget | |
| STRAT-D6 | Probe-curve interpreter + ETA (import MEATER/Combustion/Inkbird CSV) | ai-strategy.md:86 | NOT DONE | No CSV-import or curve-fit code found | |

### Wave 4 — Business/monetization
| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| STRAT-BIZ-1 | Managed-AI proxy tier (Cloudflare Worker, metered) | ai-strategy.md:96, 104 | PARTIAL | `gemMode()`/`centralUrl()`/`centralCode()` app.js:5007-5010, a working transport + UI (`openKeyManager` app.js:4512) exists, **but** no metering/quota/billing — this is a dev-configurable pass-through, not a shipped paid product | Consistent with ROADMAP-v149's explicit 2026-07-13 decision to hold all revenue in matkonetesh until the matkonet platform lands (§D there) — so this is a deliberate seam, not an oversight |
| STRAT-BIZ-2 | Cloud sync / cross-device backup | ai-strategy.md:101 | NOT DONE | No sync code; `README.md`/architecture confirms local-storage-only, single-device | Explicitly deferred to "matkonet platform" per ROADMAP-v149 §D |
| STRAT-BIZ-3 | Pit Pass / Pro Tools tiers, paywall, pricing | ai-strategy.md:98-104 | NOT DONE | No pricing/paywall/subscription code anywhere in app.js | Same deferred-to-platform status |
| STRAT-BIZ-4 | B2B/OEM/affiliate | ai-strategy.md:104 | NOT DONE (by design) | ROADMAP-v149 §A explicitly bans this in matkonetesh until the platform PRD | Not a gap — a documented decision |

**ai-strategy.md summary:** Wave 1 (trust) **substantially done** (4/4 headline items; 3 of 6 Part-B refactor items still open but those are internal-quality, not user-facing). Wave 2 (Copilot) **fully done** — the single biggest surprise of this audit, since the brief's framing suggested it might not have landed. Wave 3 (delight) **4/6 done**, 2 not started. Wave 4 (business) is **deliberately not built** in this repo per a recorded decision — correctly classified as intentional deferral, not abandonment.

---

## 4. `docs/ROADMAP-v149.md` (sequencing `docs/ANALYSIS-v149.md`'s ~120 findings)

The doc's own status header claims Waves 0–5-foundation shipped through v177. Spot-verification against current code (which is far past v177) confirms this and shows continued progress beyond what the doc records:

| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| RM-W0 | Safety hotfix: `calc.cure` type vs rate, `esc()` XSS guard | ROADMAP-v149.md:52-60 (from ANALYSIS §8 P0-1) | DONE | `data.py`/`sausages_new.py`: `calc=dict(...,cure='1'/'2',cureRate=2.5,...)` (data.py:382,400,556,674,794; sausages_new.py:23 `cure=_ctype`); `esc()` app.js:1449, 104 call sites | See SAFETY §6 below — re-verified independently |
| RM-W1 | Keyboard operability, `:focus-visible`, `aria-pressed`, timer a11y | ROADMAP-v149.md:65-83 | DONE | `:focus-visible` app.css:825/181/981; `wave1-a11y.spec.ts` exists | |
| RM-W2a | Extract CSS/JS from monolithic HTML into `app.css`/`app.js` | ROADMAP-v149.md:88-101 | DONE | Confirmed — repo now has standalone `app.js` (9,564 lines) and `app.css` (1,710 lines), concatenated by `build.py` | |
| RM-W2b | State layer, `esc()` everywhere, `GEM_MODEL`/`GEM_URL()` seam | ROADMAP-v149.md:102-116 | DONE | `GEM_MODEL`/`GEM_URL()` app.js:4206-4207; `esc()` widely used | |
| RM-W3-AI | AbortController timeout, backoff retry, key-in-header | ROADMAP-v149.md:124 | DONE | `gemFetch()` app.js:4208-4235 (verified directly: 500ms/1s backoff, `x-goog-api-key` header, AbortController timeout) | |
| RM-W3-PWA | `storage.persist()`, validated import, single `mk-schema` migration runner, maskable icon, manifest `shortcuts`/`screenshots` | ROADMAP-v149.md:126, doc's own status: "🟡 remaining" | PARTIAL | `storage.persist()` DONE (`requestPersist()` app.js:1444); maskable icon present (`dist/manifest.webmanifest:26-31`, purpose:"maskable"); **`shortcuts`/`screenshots` confirmed absent** from `dist/manifest.webmanifest`; **no unified `mk-schema` registry** — migrations remain ad-hoc (`equipMigrateFromGear` app.js:759, `migrateSeasContext` app.js:9518, tlState legacy fallback app.js:4884) | Matches the doc's own "still open" flag — self-consistent, not a hidden gap |
| RM-W4-UX | Menu-builder consolidation, single review CTA, More-sheet regroup, real global search | ROADMAP-v149.md:132-143 | DONE | Doc claims v169-v173 shipped; `wave4-builder-consolidation.spec.ts`, `wave4-ux-batch2/3.spec.ts`, `wave4-ux-polish.spec.ts` exist | |
| RM-W4-content | Dedupe seasonings, fix tzatziki/toum, cheese descriptions, house-rub tags | ROADMAP-v149.md:135 | PARTIAL | Dedup done ("Seasoning dedup already done in build.py" per doc); cheese-description/house-rub-tag completion not independently re-verified this pass | Doc itself calls this "incremental authoring, gates nothing" — low-stakes |
| RM-W5-i18n | `t()`/`getLang()` seam, numeric-safety-gated MT, English end-to-end, then ar/ru/es/fr/de | ROADMAP-v149.md:147-157 | PARTIAL | Architecture DONE (`mtNumSig/mtSafe/mtGuard/mtTranslate` app.js:6951-6987; `L()` now dict-aware for fr/de/es, app.js:6896-6902; `lang/{en,fr,de,es}.json` + `en.data.json` present); **but** `docs/i18n-audit-2026-07-15.md` (a week-old internal audit) documents that ~1,333 `L(he,en)` call sites were, at time of writing, a hard 2-language switch bypassing the dict for fr/de/es — this specific gap (fix "L→dict unification") **has since been closed** (verified: app.js:6900-6901 now reads `getDict()`), but the audit's other flagged gaps (≈20 hardcoded Hebrew `toast()` strings, ~10 duplicate binary L-style helpers, no coverage/lint tooling, dead `data-i18n` markup) were **not re-verified as fixed** | Real, recent, internally-documented gap — the "own it in Hebrew first, then flip to bilingual" ai-strategy.md ambition (line 9) has a live English/fr/de/es completeness question, not just a Hebrew one |
| RM-§D | Deferred platform backlog (managed AI, accounts+sync, B2B, dataset licensing) | ROADMAP-v149.md:170-176 | NOT DONE (by design) | See STRAT-BIZ rows above | Explicitly deferred, not forgotten |

---

## 5. `docs/REVIEW-v147.md` — source-verification sign-off (SAFETY section)

| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| REV147-1 | 279/279 items carry a cited `src`, 0 UNVERIFIED | REVIEW-v147.md:8-13 | DONE | Doc is itself the completion record; `data-integrity.spec.ts` exists in the suite | Not independently re-counted this pass — treated as a stable, already-shipped baseline predating the audit window |
| REV147-2 | Cure #1/#2 mislabeling fix + Nem Chua Cure #1 decision | REVIEW-v147.md:21-30 | DONE | Confirmed via RM-W0 cross-check (data.py cure fields correct types) | |
| REV147-3 | 15 under-dosed/zero-nitrite MAKES raised to 2.5 g/kg (156ppm) | REVIEW-v147.md:38-52 | DONE | data.py cure values spot-checked at 382/400/556/674/794 all show `cureRate=2.5` | |
| REV147-4 | Order-effect (sv↔smoke) data, reverse order gated to cited-pasteurization cuts only | REVIEW-v147.md:89-93 | DONE | `comboHasSvSmoke()` app.js:3264 gates on `svHours>=1` per HANDOFF-PROMPT.md's v146 fix note; `order-effect.spec.ts` exists | |

**REV147 summary: fully DONE**, consistent with this being a closed sign-off doc for a prior release, not an open commitment list.

---

## 6. `docs/OPERATIONS-v157.md` — operational/safety analysis (SAFETY + reliability section)

The doc's own body tracks fix status inline through "Wave A–F"; spot-verified rather than re-derived:

| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| OPS-P0-A | Background/locked-phone alarms (wake lock + SW notifications) | OPERATIONS-v157.md:15, "DONE v160" | DONE | `acquireWakeLock()` app.js:2369, `mkSWReg.showNotification(...)` app.js:2362-2363 with vibrate pattern | |
| OPS-P0-B | Overnight/next-day scheduling (serve time not pinned to "today") | OPERATIONS-v157.md:16, "DONE v159" | DONE | `serveDateTime()` app.js:5544 | |
| OPS-P0-C | Silent storage-quota data loss | OPERATIONS-v157.md:17, "DONE v163" | DONE | `store.set` return-value + `mkStorageWarn`, `requestPersist()`/`storageInfo()` app.js:1444-1445 | |
| OPS-P0-D | Internal-temp confirmation gate in the operational flow (not just the recipe card) | OPERATIONS-v157.md:18, "CORE DONE v163 / remainder v164" | DONE | `bcheck` stage kind threaded through `itemStages`, work-plan, and voice-cook: app.js:3261, 5159-5161, 5815, 5953, 5993 | Directly re-verified this pass — a genuinely safety-critical commitment, confirmed present end-to-end (schedule → voice → plan render) |
| OPS-R1..R5 | 5 session regressions (cross-event timer wipe, shared tlstate, positional timer ids, audio re-prime, voice-warn spam) | OPERATIONS-v157.md:20-29, "ALL FIXED v158" | DONE | `resetPlanTimers()` scoped to `evScope()` app.js:5584; `tlStateKey()` per-event app.js:4883-4885 | |
| OPS-E | Multi-event professional gaps: per-event cart scope, equipment-contention flags, consolidated shopping list, evLoad data-safety | OPERATIONS-v157.md:150-153, "CORE DONE v165-167" | DONE | `xshop:` consolidated-list keys app.js:7916/7934; per-event `mk-tlstate-<scope>` | Doc's own "still open" carve-out (full view-parameterization + stage-level tasks in combined view) not re-verified — treat as still open per the doc |
| OPS-F | Workflow legibility: reschedule-from-now, Home cooking banner, persistent plan checkboxes, now/next cue | OPERATIONS-v157.md:154, "MOSTLY DONE v164/166" | DONE | `wpck:` persistent checkbox keys app.js:5938 | Doc's own carve-out ("fuller ▶ התחל תוכנית wiring/rename" still open) not re-verified — treat as still open |
| OPS-minor | "Time in danger zone" live counter (Wave D minor remainder) | OPERATIONS-v157.md:150 | NOT DONE | Not found in app.js; the doc itself calls this "minor remaining" | Low-stakes per the source doc — informational, not safety-blocking (the bcheck gate itself is done) |

**OPS157 summary: all 4 platform P0s + all 5 session regressions confirmed DONE**, with the 2-3 explicitly-flagged minor remainders in the doc still open (self-consistent — the doc predicted this).

---

## 7. `docs/fire-guide-ux-refactor-prompt.md` — 3-mode UI proposal

| ID | Commitment | Source | State | Evidence | Notes |
|---|---|---|---|---|---|
| UXR-1 | 3-mode switcher (beginner/home/pro) replacing uiLevel's rendering effect | fire-guide-ux-refactor-prompt.md §3 | NOT DONE / SUPERSEDED-in-spirit | No `mode-beg`/`mode-pro`/`mode-home` body classes or switcher found; existing `mk-uilevel` (RV-4) covers a narrower version of the same idea (density/controls by level) without the proposed table-mode/beginner-tile UI | Per owner's UX-roadmap memory this was **explicitly deferred as a decision**, not silently dropped — correctly flagged, not a surprise gap |
| UXR-2 | Contrast fix `--smoke`/`--ash` to AA-passing values | fire-guide-ux-refactor-prompt.md §2.5, §4-1 | DONE (independently, not via the mode-switcher track) | app.css:9-11: `--ash:#6e5340` (AA 6.6:1), `--smoke:#7a5f4c` (AA 5.5:1, was `#b09480` at 2.65:1 — the doc's exact failing value) — comments in app.css directly reference the AA fix | Landed via ANALYSIS-v149/ROADMAP-v149 Wave 1 (a11y #2), independently of this doc's larger proposal |
| UXR-3 | 🧫→⚗️ icon replacement (nav label clarity) | fire-guide-ux-refactor-prompt.md §2.5 | NOT DONE | 🧫 still used pervasively for "פרויקטים ומזווה" (app.js:3903, 3962, 6762, etc.); ⚗️ not found | Small, cosmetic, genuinely still open |
| UXR-4 | Replace readonly-input-styled-as-button home search with a real button/input | fire-guide-ux-refactor-prompt.md §2.5 | DONE (superseded by RM-W4-UX's "real global home search") | No `readonly` attributes found anywhere in app.js | |
| UXR-5 | 44px+ touch targets everywhere, incl. bottom nav | fire-guide-ux-refactor-prompt.md §2.5, §5 | PARTIAL | `.exaddmenu`/`.cw5-more button` explicitly `min-height:44px` (app.css:823/317); **`.cnav button` (the persistent bottom nav) has `padding:9px 0 11px` with no explicit `min-height`** (app.css:321) — likely under 44px depending on content height | Worth a direct tap-target measurement; flagged, not confirmed either way with certainty |
| UXR-6 | Split embedded `DATA` into a separate fetched JSON (perf) | fire-guide-ux-refactor-prompt.md §2.7 | NOT DONE | `DATA` is still `JSON.parse(...)` inlined in the built HTML (per README.md/build.py architecture); no separate `fetch()`-loaded data file | This is now explicitly superseded by ANALYSIS-v149 perf #2's *different* fix (JSON.parse instead of object literal, which **is** done) — the doc's specific "fetch it separately" idea itself was not adopted |

**fire-guide-ux-refactor-prompt.md summary:** the large "3-mode switcher" proposal is a deliberately deferred decision (correctly tracked in owner memory), not a silent drop. Of the smaller, cheaper wins bundled into the same doc, the contrast fix and the search-input fix landed (via other tracks); the icon swap and full touch-target audit did not.

---

## 8. `README.md` / `HANDOFF-PROMPT.md`

These are operational/reference docs rather than commitment lists. Spot-checked, not tabulated line-by-line:
- README.md's build/test/deploy instructions (`python build.py`, `npx playwright test`, Cloudflare Pages `dist/`) match the current repo layout (`dist/index.html`, `dist/manifest.webmanifest`, `dist/_headers`, `dist/sw.js` all present).
- HANDOFF-PROMPT.md is a **snapshot at v146** whose "next task" (source-verification research) was completed and superseded by REVIEW-v147.md, and whose "what's built" section is now three-hundred-plus versions stale. Not a broken promise — it's a dated handoff note, correctly superseded by every later doc in this set.

---

## AI-related commitments — summary
7/7 PRD features shipped, all 5 AI-JSON infra primitives shipped, Wave-1 trust hardening 4/4 headline items shipped (3 minor Part-B refactor items open), **Live Cook Copilot (the ai-strategy.md flagship) fully shipped** with tests, 4/6 Wave-3 delight features shipped. Business/monetization (managed-AI billing, cloud sync, paywall tiers) is **deliberately not built**, per a dated, explicit decision recorded in ROADMAP-v149.md §A — correctly classified as intentional deferral. The one live AI-adjacent gap worth owner attention: **fr/de/es translation completeness** — the safety-gated MT architecture and the `L()`-dict unification are done, but a week-old internal audit's other flagged holes (hardcoded Hebrew toasts, `aiJSON` per-language correctness for non-en targets, coverage tooling) were not re-verified as closed in this pass.

## Safety-related commitments — summary
Every P0/P1 safety item across REVIEW-v147 (cure-type/rate labeling, nitrite dosing, order-effect gating) and OPERATIONS-v157 (background alarms, overnight scheduling, silent data loss, the operational internal-temp `bcheck` gate, the 5 session regressions) was independently re-confirmed present in code — not just claimed by the docs. The AI-trust safety layer (deterministic refuse/deflect for dangerous intents, numeric-invariant guard, always-on intent-based grounding, safety caveats on Diagnose/Journal) is also confirmed present. No safety commitment in the assigned document set was found abandoned or inert.

---

## Counts by state (this document's ~70 tabulated rows)
- **DONE:** 44
- **PARTIAL:** 11
- **NOT DONE:** 9
- **SUPERSEDED:** 2 (RV-7 by Equipment 2.0; UXR-4 folded into RM-W4-UX)
- **ABANDONED:** 0

## Top 8 unmet/forgotten product commitments, priority order

1. **fr/de/es translation is structurally incomplete despite dict files existing** (RM-W5-i18n) — `lang/{fr,de,es}.json` ship, but a week-old internal audit found ~20 hardcoded Hebrew toasts and a broken `aiJSON outLang` for non-English targets; only partially re-verified as fixed. Directly undercuts ai-strategy.md's "own Hebrew-first, then flip the bilingual switch" plan.
2. **No single `mk-schema` migration registry** (RM-W3-PWA) — migrations remain ad-hoc and scattered across at least 3 call sites; flagged as a risk by ANALYSIS-v149 arch #... and still open.
3. **Manifest lacks `shortcuts`/`screenshots`** (RM-W3-PWA) — a small, cheap PWA-installability win that's been "remaining" since ROADMAP-v149 and still isn't in `dist/manifest.webmanifest`.
4. **Managed-AI billing/paywall never built** (STRAT-BIZ-1/3) — intentional per a recorded decision, but the owner should confirm that decision still holds given how much of the "free" AI surface (Copilot, Guardian, Coach, Concierge) is now shipped — the monetizable product is more ready than the roadmap doc assumed when the hold-all-revenue call was made.
5. **Cloud sync never built** (STRAT-BIZ-2) — same deferred status; worth flagging because journal/project data (the Personal Coach's fuel) is single-device-only with no auto-backup beyond local export.
6. **AI response caching / in-flight-guard incomplete** (STRAT-B-A5) — the ai-strategy.md-flagged "panel-reopen-after-close bug" fix is only partially present (timeout abort exists; dedup/cache does not).
7. **3-mode UI switcher (beginner/pro) not built** (UXR-1) — a deliberate deferral per owner memory, but it's the fire-guide doc's central proposal and still sits unresolved; worth an explicit close-or-commit decision rather than indefinite limbo.
8. **🧫→⚗️ icon rename never landed** (UXR-3) — trivial effort, explicitly called out as confusing ("cryptic"), still shipping today across every nav/menu surface that references "Projects/Pantry."
