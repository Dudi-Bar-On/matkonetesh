# Graph Report - docs  (2026-07-22)

## Corpus Check
- 137 files · ~370,508 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1082 nodes · 1723 edges · 69 communities (61 shown, 8 thin omitted)
- Extraction: 82% EXTRACTED · 16% INFERRED · 2% AMBIGUOUS · INFERRED: 283 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- AI Safety Guardrails & Autonomy
- Equipment 2.0 Data Model
- AI Strategy & Trust Features
- Equipment Add-Form UI (Smoker)
- Equipment Brand Lookup & Orchestrator
- Equipment Capacity & Consumption Layer
- Equipment-to-Workplan Defect Audit
- Device Occupancy Core Model
- Equipment Edit/Add Screens (Hebrew)
- Multi-Item Cook Scheduling UI
- Nitrite Dosing & Cure Safety Research
- Timeline Scheduler Insufficient-Time Warning
- OPERATIONS v157 Hebrew Findings
- Orchestrator Conformance Audit (Never Built)
- Discovery Sweep Tooling & Reports
- Source Verification & Recipe Data
- AI Product Docs & Guards Audit
- Equipment Consumption Seam & Refactor
- Occupancy Mockup & Diagrams
- Device Occupancy Terminology (Hebrew)
- ANALYSIS v149 Business Findings
- Wizard Steps 4-5 (Seasonings/Sides)
- Wizard Finish & Events List
- Menu Print & Shopping Cart Tools
- Catalog Safety Defects (Cure Warnings)
- Scheduling Architecture (LDS Repair)
- UX Refactor Prompt (3-Mode Strategy)
- My Equipment Settings Panel (Hebrew)
- Wizard Step 2 Brisket Search
- Code Sweep & Scheduler Functions
- Appearance/Theme Settings Screen
- PWA Platform & Deployment Roadmap
- Occupancy Hypotheses H1-H4
- AI Gateway & Monetization Seam
- Home Screen & More Menu (Hebrew)
- Event Wizard Step 1 (Details)
- LLM Model Cost Tiers
- Timeline Scheduler Per-Item Cards
- Occupancy Packer (packDevice/slots)
- AI Proxy & Cloudflare Infra
- Business Model & Payment Processors
- Home Screen Customization Concepts
- Device Silhouette Rendering
- ANALYSIS v149 Hebrew (Security/XSS)
- AI Platform Comparison Research
- Scheduler Phase 4a Extraction
- i18n Safety Numbers & Locale Seam
- Adaptive Home Design Phases
- Foundations Refactor (Wave 2)
- Scheduler Fit Ladder & Safety Boundary
- Scheduler Repair Ladder (Phase 4c)
- TTS Provider Comparison Research
- Duplicate Scroll-Capture Screenshots
- Equipment Property AI Capture
- Occupancy Phase 2 Design Spec
- Hebrew TTS/STT Research
- Kosher/Kashrut Wizard Filtering
- Managed-AI Backend Services
- Occupancy Screen Theme/Locale Variants
- applyMove() Function & Storage Keys
- App Store Payment Policy Research
- Occupancy Diagram CSS Tokens
- Single-File Build Artifacts
- Privacy Regulation Research
- False-Alarm Verification Pattern
- Preference Preset Function
- Amazon Polly TTS (rejected)
- MiniMax TTS (rejected)
- OpenAI TTS (rejected, Hebrew)

## God Nodes (most connected - your core abstractions)
1. `Outstanding Register — Verified Against Current Source (2026-07-21)` - 43 edges
2. `ANALYSIS v149 — Deep Analysis (Full Detail, 10-dimension audit)` - 41 edges
3. `Cookout Orchestrator & Equipment Conformance Audit (2026-07-22)` - 33 edges
4. `Requirements Conformance Audit (2026-07-21)` - 31 edges
5. `Audit — Research, Safety/Sources, i18n vs Shipped Code (2026-07-22)` - 29 edges
6. `Refactoring Report — Equipment, Occupancy & Orchestration (2026-07-21)` - 25 edges
7. `OPERATIONS v157 — Operational Analysis (cooking-workflow / timing / multi-event / reliability / alerts / safety)` - 23 edges
8. `AI Strategy — audit, refactor, new features & monetization synthesis` - 21 edges
9. `Device Occupancy: The Diagram This Should Have Been (2026-07-21)` - 20 edges
10. `Scheduling Architecture — Why the Orchestrator Cannot Place Along a Timeline (2026-07-21)` - 20 edges

## Surprising Connections (you probably didn't know these)
- `§5 Never-droppable-at-any-depth safety floor list (temp verification, stall naming, rest≥1h, poultry 74°C, weighed cure dosing)` --semantically_similar_to--> `Trust architecture principle: app's calculators & vetted DATA own every number; the LLM may only retrieve/select/explain, never state its own safety number`  [INFERRED] [semantically similar]
  plan-depth-model-2026-07-20.md → ai-strategy.md
- `One app, three modes strategy: beginner (guided) / home (default) / pro (table density) render-layer switch` --semantically_similar_to--> `'Jobs-on-the-fire, gear-derived' direction — home is a launcher; gear decides relevance, level decides density`  [INFERRED] [semantically similar]
  fire-guide-ux-refactor-prompt.md → home-adaptive-design.md
- `Safety-number discipline — salt/cure/nitrite always from app presets (UMAKE_CALC), never the model` --semantically_similar_to--> `T1: Safety numbers baked into prose (cure %, salt, internal temps in free-text)`  [INFERRED] [semantically similar]
  ai-strategy.md → ANALYSIS-v149.md
- `T5: silent failures everywhere — store.set, importData, journal-photo guard all swallow errors` --semantically_similar_to--> `T3: store/DATA parsing & error handling (object-literal vs JSON.parse, swallowed quota errors)`  [INFERRED] [semantically similar]
  OPERATIONS-v157.md → ANALYSIS-v149.md
- `T1: everything that matters at the smoker runs in the foreground page` --semantically_similar_to--> `T4: No service worker — app claims PWA but ships no offline shell`  [INFERRED] [semantically similar]
  OPERATIONS-v157.md → ANALYSIS-v149.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ANALYSIS-v149 §0.1 — the six do-first P0 findings shipped together as Wave 0** — analysis_v149_p0_cure_warning_suppressed, analysis_v149_p0_ai_xss, analysis_v149_p0_catalog_dead_end, analysis_v149_p0_resume_broken, analysis_v149_p0_keyboard_inoperable, analysis_v149_p0_wrong_nitrite [EXTRACTED 0.95]
- **ANALYSIS-v149 §0.2 — the six cross-cutting themes (T1-T6) that each pay off across multiple dimensions** — analysis_v149_t1_safety_numbers_in_prose, analysis_v149_t2_extract_css_js, analysis_v149_t3_store_data_parsing, analysis_v149_t4_no_service_worker, analysis_v149_t5_theme_fscale_correctness, analysis_v149_t6_data_pipeline_drift [EXTRACTED 0.90]
- **The AI trust stack — grounding, numeric guard, refuse/deflect, caveat — named as one contract across ai-strategy, ai-trust-wave1 and copilot-wave2** — ai_strategy_trust_architecture_principle, ai_strategy_gemfetch_transport, ai_strategy_aijson_shared_caller, ai_trust_wave1_w1p3_numeric_guard, ai_trust_wave1_w1p5_refuse_classifier, ai_trust_wave1_w1p2_safety_caveat [INFERRED 0.85]
- **Discovery Sweep Wave 1 — report family** — analysis_sweep_readme, analysis_sweep_w1_a_code, analysis_sweep_w1_b_conformance, analysis_sweep_w1_d_nonfunctional, analysis_sweep_w1_e_food_safety, analysis_sweep_w1_f_ai, analysis_sweep_w1_h_probes, analysis_sweep__agent_summaries [EXTRACTED 1.00]
- **Recurring false-safety-alarm correction chain across audits** — analysis_2026_07_22_audit_research_safety, analysis_sweep_w1_e_food_safety, analysis_sweep_w1_d_nonfunctional, analysis_sweep_w1_b_conformance, analysis_sweep__toast_verification, analysis_2026_07_22_status_and_gaps [INFERRED 0.85]
- **D1-D11 equipment-orchestration defect scorecard tracked across audits** — docs_equipment_orchestration_audit_2026_07_17, analysis_2026_07_21_outstanding_register, analysis_2026_07_21_refactoring_report, analysis_2026_07_21_requirements_conformance, analysis_2026_07_22_audit_orchestrator [EXTRACTED 1.00]
- **Offline Neural Hebrew TTS Pipeline (Phonikud + Israwave/Piper via sherpa-onnx)** — research_03_tts_phonikud, research_03_tts_israwave, research_03_tts_piper, research_03_tts_sherpa_onnx [INFERRED 0.85]
- **Thin Shared Backend Triad (Identity + Entitlements + AI Gateway)** — research_04b_business_identity_service, research_04b_business_entitlements_service, research_04b_business_ai_gateway_service [EXTRACTED 1.00]
- **Gemini Model Escalation Ladder (Flash-Lite to Flash to Pro)** — research_02_ai_platforms_gemini_flash_lite, research_02_ai_platforms_gemini_flash_tier, research_02_ai_platforms_gemini_pro_tier [EXTRACTED 1.00]
- **Validated-default resolution pattern across app.js (stored value -> validate/class default -> fallback)** — docs_superpowers_plans_2026_07_17_phase3a_slice1_prefs_framework_pref_setpref, docs_superpowers_plans_2026_07_17_phase3a_slice1_prefs_framework_validated_default_pattern, docs_superpowers_plans_2026_07_20_equipment_properties_completion_propof_accessor, docs_superpowers_plans_2026_07_15_i18n_foundation_phase0_l_function_dict_aware [INFERRED 0.75]
- **Equipment 2.0 device model shared data structure (mk-equipment + EQUIP_CATS + props[])** — docs_superpowers_plans_2026_07_15_equipment_2_0_slice_1a_mk_equipment_model, docs_superpowers_plans_2026_07_15_equipment_2_0_slice_1a_device_model_schema, docs_superpowers_plans_2026_07_15_equipment_2_0_slice_1a_equip_cats, docs_superpowers_plans_2026_07_20_equipment_properties_completion_props_array_schema, docs_superpowers_plans_2026_07_20_equipment_properties_completion_propof_accessor [INFERRED 0.85]
- **Deliberately deferred follow-on scope items flagged across all four plans** — docs_superpowers_plans_2026_07_15_equipment_2_0_slice_1a_slice_1b_ai_equipment_helper, docs_superpowers_plans_2026_07_15_equipment_2_0_slice_1a_slice_1c_item_cooker_assignment, docs_superpowers_plans_2026_07_15_i18n_foundation_phase0_voice_assistant_localization_followon, docs_superpowers_plans_2026_07_17_phase3a_slice1_prefs_framework_preset_selector_deferral, docs_superpowers_plans_2026_07_20_equipment_properties_completion_consumption_layer_deferral [INFERRED 0.75]
- **Occupancy Core Model (deviceOccupancy/deviceCapacity/itemOccupancy/occupancyCompat)** — docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_deviceoccupancy, docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_devicecapacity, docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_itemoccupancy, docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_occupancycompat [EXTRACTED 1.00]
- **Clash Derivation Pattern (single-event and multi-event both read the model)** — docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_cookercontention, docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_deviceoccupancy, docs_superpowers_plans_2026_07_20_equipment_occupancy_layer_task9_multievent_migration [INFERRED 0.85]
- **Device Diagram Dispatch (silhouette-keyed sub-renderers)** — docs_superpowers_plans_2026_07_21_occupancy_view_phase2_occupancydevhtml_dispatcher, docs_superpowers_plans_2026_07_21_occupancy_view_phase2_occ_cabinet_body, docs_superpowers_plans_2026_07_21_occupancy_view_phase2_occ_offset_body, docs_superpowers_plans_2026_07_21_occupancy_view_phase2_occ_grill_body, docs_superpowers_plans_2026_07_21_occupancy_view_phase2_occ_vessel_body, docs_superpowers_plans_2026_07_21_occupancy_view_phase2_occ_bay_html [EXTRACTED 1.00]
- **Model → View → Scheduler occupancy chain (deviceOccupancy feeds the diagram view and the Phase 4 capacity oracle)** — docs_superpowers_specs_2026_07_21_occupancy_slots_h4_design_deviceoccupancy_model, docs_superpowers_specs_2026_07_21_occupancy_view_phase2_spec_occupancydevhtml_view, docs_superpowers_specs_2026_07_21_scheduler_phase4_spec_packdevice_capacity_oracle [INFERRED 0.85]
- **Determinism-as-safety design pattern across the packer, the fit ladder, and the scheduler's safety boundary** — docs_superpowers_specs_2026_07_21_occupancy_slots_h4_design_memoization_decision, docs_superpowers_specs_2026_07_21_occupancy_view_phase2_spec_fit_verdict_ladder, docs_superpowers_specs_2026_07_21_scheduler_phase4_spec_safety_boundary_forbidden_moves [INFERRED 0.75]
- **Two divergent schedule implementations consolidated into planSchedule()** — docs_superpowers_specs_2026_07_21_scheduler_phase4_spec_buildlist_fn, docs_superpowers_specs_2026_07_21_scheduler_phase4_spec_combinedeventsrows_fn, docs_superpowers_specs_2026_07_21_scheduler_phase4_spec_planschedule_fn [EXTRACTED 1.00]

## Communities (69 total, 8 thin omitted)

### Community 0 - "AI Safety Guardrails & Autonomy"
Cohesion: 0.06
Nodes (53): action_id contract (bounded AI role), aiJSON() function, aiSafetyNote(answerText, groundingText) function, aiValidateKeys pattern (existing validation), askGemini() prompt builder, autonomy preference (advise/propose/autopilot), bcheck (sole internal-temp serve-safety gate), Build slices v250/v251/v252 (+45 more)

### Community 1 - "Equipment 2.0 Data Model"
Cohesion: 0.07
Nodes (52): Capability functions reimplementation (canSV/canSmoke/canGrill/homeGear/smokerTip/preheatHint/gearThermoNote), Cookout Orchestrator, Device model schema {id,cat,type,name,brand,model,fuel,cap,specSource,notes}, EQUIP_CATS (device category taxonomy), equipMigrateFromGear (one-time migration), gearConciergeApply (onboarding concierge), mk-equipment device-list model, mk-gear (legacy flat gear model) (+44 more)

### Community 2 - "AI Strategy & Trust Features"
Cohesion: 0.05
Nodes (48): AI Strategy — audit, refactor, new features & monetization synthesis, Adaptive schedule agent — recomputes backward plan across multi-event timeline on serve-time change, AI onboarding concierge — configures gear+level from a natural-language description, aiJSON + aiValidateKeys/Items — shared JSON caller that drops any invented catalog key, Charcuterie Safety Guardian — AI that checks weight-loss %/drying thresholds, not invents, Free tier — full source-cited catalog + all calculators + BYOK AI included, Live Cook Copilot — flagship AI feature, a session that runs during the cook, Local-first degradation — wcimLocal/pantryAdvisorLocal/askFire compute deterministically first, AI only enriches (+40 more)

### Community 3 - "Equipment Add-Form UI (Smoker)"
Cohesion: 0.07
Nodes (44): Add (Submit) Button, Add Smoker (מעשנה) Equipment Form, Advanced Settings Collapsible Section, Category Field (Smoker), Cooking Surface Area Field (cm², e.g. 3700), Fuel Field, Allow Hanging Toggle (set to Yes), Max Temperature Field Showing '300mm' (Unit Mismatch Defect, red border) (+36 more)

### Community 4 - "Equipment Brand Lookup & Orchestrator"
Cohesion: 0.07
Nodes (39): aiBrandModels(brand, cat), aiJSON grounded-JSON caller (reused), aiLookupDevice(query, cat), cookers() aggregator, Cookout Orchestrator (feature), Equipment 2.0 (Phase 1) Design Spec, EQUIP_BRANDS static map, equipByCat(cat) (+31 more)

### Community 5 - "Equipment Capacity & Consumption Layer"
Cohesion: 0.06
Nodes (38): bathLitres(dev) bath-selection rule, cap.* (device capability properties), curechamber (dry-curing, hang-only device), Dual call sites: buildList & combinedEventsRows, equipment_map.py (recipe-device join), equipPlan (enrichment seam), D3: fuel wording mismatch, gear.occupy (stage occupancy field) (+30 more)

### Community 6 - "Equipment-to-Workplan Defect Audit"
Cohesion: 0.07
Nodes (38): Equipment → Work-plan → Orchestrator — deep audit, D10: probeChannels() feeds one footer line only — no check against items needing monitoring, D11: No cooler/cambro exists in the equipment model, yet the advisor proposes holding gear repeatedly, D1: Preheat contradicts itself — hard-coded 45min schedule vs '~15min pellet' label text on the same screen, D2: Only smoking gets a preheat task — sous-vide/grill get no lead-time task, D3: Fuel is never reconciled — smoke task reads the recipe's wood/coal, ignoring owned device fuel, D4: Reload reminder fixed at ~90min for any smoke stage, regardless of offset vs pellet, D5: All capacity (racks/zones/volume/baths/area) is decorative — nothing does a fit-test (+30 more)

### Community 7 - "Device Occupancy Core Model"
Cohesion: 0.07
Nodes (36): areaCm2 capacity property, combinedEventsRows (existing multi-event overlap code), cookerContention(computed, scope) — model-derived clash, deviceCapacity(dev), deviceOccupancy(devId, tMs, computed, scope), hang classification ('short'|'long') derived from recipe prose, itemOccupancy(meta, stageKind), Never invent a measurement principle (+28 more)

### Community 8 - "Equipment Edit/Add Screens (Hebrew)"
Cohesion: 0.07
Nodes (34): Advanced Options Toggle (מתקדם), Category Selector = Smoker (מעשנה), Smoker Detail Fields (name, shelves=4, subtype=Cabinet, fuel, cook area 3700/6000cm2, max temp 150C probe, allow-hanging=yes), Cancel/Save Actions (בטל / שמור), Edit Equipment Screen — Smoker (ערוך מכשיר), Cancel/Add Actions (בטל / הוסף), Advanced Options Toggle (מתקדם), Category Selector = Grill (גריל) (+26 more)

### Community 9 - "Multi-Item Cook Scheduling UI"
Cohesion: 0.13
Nodes (32): Combined Shopping List (Multi-Event, Summed Quantities), Cooking Order Sequencing (e.g. sous-vide then smoke), Cookout Orchestrator (multi-item cook scheduling subject), Detail Level Toggle (Condensed vs Full/Print-Independent), Equipment Capacity Attributes (area cm², shelf count, hook count, heat zones), Equipment Categories (Smoker / Grill / Sous-vide), Equipment/Oven Capacity Conflict Detection (Collision Warning), Equipment Item Placement (food item assigned to a piece of equipment with temp/area) (+24 more)

### Community 10 - "Nitrite Dosing & Cure Safety Research"
Cohesion: 0.10
Nodes (29): Nitrite Dosing: When Is a Kitchen Scale Too Coarse? (2026-07-21), Audit — Research, Safety/Sources, i18n vs Shipped Code (2026-07-22), W1-E — Food Science & Data Audit, cureScaleGuardHTML() — cure-dosing scale guard, safetyDiff(before, after) — runtime safety invariant, scaleReadability() — reads owned scale's readability, 9 CFR 424.21 — Use of food ingredients and sources of radiation, 9 CFR 424.22 — Certain other permitted uses (bacon) (+21 more)

### Community 11 - "Timeline Scheduler Insufficient-Time Warning"
Cohesion: 0.12
Nodes (28): Block-When-Insufficient-Time Checkbox, Countdown Progress Bar (93h 18m until serving), Date Field Value Visually Clipped (shows '24/07/202', trailing digit cut off), Event Summary Card (Friday Dinner - July, 8 guests, 19:00 serving), Enable Step Notifications Banner (הפעל התראות לשלבים), Timeline Scheduler Modal - Header with Clipped Date Field, Serving Time Picker (19:00), Smart Reordering Explanation Text (lightning icon = auto-optimized cook order by critical path) (+20 more)

### Community 12 - "OPERATIONS v157 Hebrew Findings"
Cohesion: 0.12
Nodes (25): UMAKE_CALC — app-owned salt/cure/temp table (never from the AI model), OPERATIONS v157 — Operational Analysis (cooking-workflow / timing / multi-event / reliability / alerts / safety), מתכונת אש — ניתוח תפעולי v157, אזעקות מתות כשהטלפון ברקע/נעול/ישן, שעת ההגשה היא שעון-בלבד, מעוגנת להיום, מיצוי מכסת-אחסון הורג בשקט את כל ההתמדה, לזרימה התפעולית אין אישור טמפ׳-פנים לפני ההגשה, P0-A: Alarms dead when the phone is backgrounded/locked/asleep (no wake-lock, no SW notifications) (+17 more)

### Community 13 - "Orchestrator Conformance Audit (Never Built)"
Cohesion: 0.14
Nodes (22): Requirements Conformance Audit (2026-07-21), Cookout Orchestrator & Equipment Conformance Audit (2026-07-22), PREFS registry + pref()/setPref(), probeChannels(), Equipment Occupancy Layer — capacity-aware clash detection model, Phase 3a auto-optimize solver (orchestrate/movesForClash/applyMove) — never built, D10 — probeChannels() is a display count only, never budgets concurrent monitored items, D11 — Cooler/cambro hold advice given without checking ownership (+14 more)

### Community 14 - "Discovery Sweep Tooling & Reports"
Cohesion: 0.13
Nodes (21): Discovery Sweep — Tool Roster & Missions (2026-07-22), Discovery Sweep Agent Returned Summaries (verbatim), Toast Translation Coverage Verification Output, Discovery Sweep — Agent Reports Index, W1-B Conformance Sweep — Largest Specs, Clause-by-Clause, W1-D — Non-functional Sweep: i18n/RTL, PWA, Performance, Accessibility, W1-H — Probe & Sous-Vide Telemetry: Feasibility Research, chooseBath(dev, needL) (+13 more)

### Community 15 - "Source Verification & Recipe Data"
Cohesion: 0.12
Nodes (21): Aaron Franklin (brisket/ribs), AmazingRibs.com (Meathead), ChefSteps, data.py Fields (svt/svh/smt/tgt/safe/sot/wood), Source-Verification Research Protocol, grill Object Fields (grt/grh/grz/grillable), JSON Output Schema (proposal format), Order A: sv→smoke (default, safe) (+13 more)

### Community 16 - "AI Product Docs & Guards Audit"
Cohesion: 0.13
Nodes (20): ai-implementation-plan.md, ai-prd.md, Product-Document Conformance Audit (2026-07-22), W1-F — AI Surface & Guards Audit, aiSafetyNote() — numeric-invariant AI safety guard, askGemini() — Ask-the-Fire chat caller, askRefuse()/AI_REFUSALS — deterministic dangerous-intent refusal, vcAskAI()/vcAskFlow() — Voice Cook hands-free Q&A caller (+12 more)

### Community 17 - "Equipment Consumption Seam & Refactor"
Cohesion: 0.22
Nodes (20): Outstanding Register — Verified Against Current Source (2026-07-21), Refactoring Report — Equipment, Occupancy & Orchestration (2026-07-21), Hands-on Walkthrough Defect Register (2026-07-21), equipPlan(meta, methodKey, stages, scope) — the consumption-layer seam, gearThermoNote() — thermometer advisory (non-blocking), methodRules() — default cooking-method selection, rawGramsFor() — guest-scaled raw meat quantity, The equipPlan seam — 'one pure, testable seam where equipment enters stage generation' (+12 more)

### Community 18 - "Occupancy Mockup & Diagrams"
Cohesion: 0.17
Nodes (20): Oversized Item Warning — Brisket Doesn't Fit Single Shelf, Oven Occupancy — Slots Edge Case Screenshot (390px), Smoker Cabinet Occupancy Panel (ארון עישון), Occupancy Timeline Slider (15:08, Now), Estimated Cooking Area Disclaimer, Home Oven Shelf Occupancy Diagram, Kettle Grill & Multi-Equipment Occupancy Mockup, Sous-Vide Bath Bag Capacity Diagram (+12 more)

### Community 19 - "Device Occupancy Terminology (Hebrew)"
Cohesion: 0.18
Nodes (19): Device Occupancy: The Diagram This Should Have Been (2026-07-21), Hebrew Terminology Audit — Occupancy/Equipment/Work-plan (2026-07-21), cookerCandidates(kind), deviceCapacity(dev), deviceOccupancy(devId, tMs, computed, scope), EQUIP_CATS — equipment category catalog (capHe/capEn/props), itemOccupancy(meta, stageKind, dev), L(he, en) — bilingual/dict-aware string helper (+11 more)

### Community 20 - "ANALYSIS v149 Business Findings"
Cohesion: 0.12
Nodes (19): ANALYSIS v149 — Deep Analysis (Full Detail, 10-dimension audit), Affiliate/commerce inside the guides (charcoal, smokers, cure salts), askGemini() — conversational Ask-the-Fire AI path with google_search grounding, 'Pro' B2B tier — caterers, butchers, small producers, build.py — single 7,508-line build script (data pipeline + HTML/CSS/JS + writer), The BYOK crux: great engineering decision, bad growth decision, THEMES.charcoal — shipped dark theme, visibly broken in tool panels, Premium content / craft packs — one-time unlock (salumi, pastrami, fermented sausage) (+11 more)

### Community 21 - "Wizard Steps 4-5 (Seasonings/Sides)"
Cohesion: 0.20
Nodes (18): Bottom tab bar: Projects / Events / central FAB / Catalog / Home, Per-protein seasoning selector (rub/marinade/glaze/sauce chips, recommended default, checkmark selection state), 6-segment wizard step-progress indicator (4 of 6 filled), Wizard Step 4/6: Seasonings & Sauces (RTL Hebrew), Screenshot: Wizard Step 4/6 - Seasonings, Wizard Step 5/6: Sides, Drinks & Desserts - sides list view, Screenshot: Wizard Step 5/6 - Sides (top of screen), Sides/additions checklist (pita, Israeli salad, coleslaw, roasted potatoes, corn, chimichurri, pickles, BBQ beans, mac & cheese, grilled root veg, ...) (+10 more)

### Community 22 - "Wizard Finish & Events List"
Cohesion: 0.19
Nodes (18): App Bottom Navigation Bar (Projects / Events / center action / Catalog / Home), 'Build Complete Work Plan' CTA (orange, primary), Wizard Step 6: Menu Summary & Finish Actions, Screenshot: Wizard Step 6 Menu Summary (scrolled), 'Plan Event with AI' CTA (green, top of screen), Event Card: Friday Dinner - July (Active, 19:00, 8 guests, 4 portions, Jul 24), My Events List Screen, 'Event Saved' Confirmation Toast (+10 more)

### Community 23 - "Menu Print & Shopping Cart Tools"
Cohesion: 0.19
Nodes (17): Meal Composition Summary (Mains, Sides, Drinks, Desserts), Print / PDF Export of Menu Summary, Menu Print Preview Screen, Tools Menu Section (כלי עזר), Selected-Items Cart Summary (Brisket, Pork Ribs), Cart Quantity Edge Case, Event Planning Section (תכנון אירוע), Ingredient Category Checklist (Meat, Spices, Wood, Charcoal) (+9 more)

### Community 24 - "Catalog Safety Defects (Cure Warnings)"
Cohesion: 0.15
Nodes (16): 279-item catalog (130 CUTS / 47 SPECIALS / 102 MAKES), esc() HTML-escaping helper (proposed fix, does not exist yet), אזהרת בטיחות ה-Cure מושתקת בשקט על 47 נקניקים, P0: calc.cure renders 'Cure #2.5' and suppresses the safety warning on 47 cured makes, P0: Wrong nitrite (Cure #1 vs #2) + sub-safe salt on long-dried sausages, T6: Data-pipeline drift — gen_sources.py reports CUT/SPEC corrections as pending, never applies them, REVIEW v147 — Source-Verification Review (279-item catalog sign-off), 279/279 catalog items sourced, 0 UNVERIFIED (Baldwin/AmazingRibs/Serious Eats/Marianski/USDA FSIS) (+8 more)

### Community 25 - "Scheduling Architecture (LDS Repair)"
Cohesion: 0.18
Nodes (15): Scheduling Architecture — Why the Orchestrator Cannot Place Along a Timeline (2026-07-21), buildList() — single-event work-plan render closure (pre-refactor scheduler), cookerContention(...), cookerFor(itemKey, kind, scope), itemStages(meta, methodKey, ready, order) — stage/duration generator, occupancyCompat(items) — temp/wood compatibility + setpoint, Cook-early-and-hold — recommended in 4 places, schedulable in none, Limited-discrepancy search (LDS) backtracking strategy for schedule repair (+7 more)

### Community 26 - "UX Refactor Prompt (3-Mode Strategy)"
Cohesion: 0.16
Nodes (15): T5: Theme + --fscale correctness (charcoal dark theme broken, AA contrast failures), מדריך האש — פרומפט לרפקטורינג ממשק (UX/UI refactor prompt), 2.4 Catalog = three apps in one page (cuts grid + charcuterie + cheese/cure), three separate filter systems, 2.5 Contrast/accessibility fixes: --smoke text fails WCAG AA, kick text 10.5px, nav padding <44px, readonly fake search input, 2.1 Home duplication: two headers (hero + capp-top-home) and two paths leading to the same wizard, Embedded 3-mode demo HTML (beginner/home/pro) — visual specification reference for the refactor, One app, three modes strategy: beginner (guided) / home (default) / pro (table density) render-layer switch, 2.2 Wizard step 0: name/date/guests/appetite forms before the user has seen any food (+7 more)

### Community 27 - "My Equipment Settings Panel (Hebrew)"
Cohesion: 0.28
Nodes (15): 'My Equipment' (הציוד שלי) settings panel - card-per-category-item layout with add/edit/remove controls, Sous-vide equipment card: 'טבילה' (Immersion) - tag '24 L', Grill equipment card: 'קטל' (Kettle) - tag '2 heat zones' (2 אזורי חום), Equipment List Screen - Grill / Sous-Vide / Thermometer Categories, Thermometer equipment card: 'פרוב אלחוטי' (Wireless probe) - tag '4 channels' (4 ערוצים), Smoker equipment card: 'ארון / קבינט' (Cabinet) - tags '6000 cm²' area, '4 shelves/layers', 'can hang 6' (אפשר לתלות), Equipment List Screen (scrolled up) - reveals Smoker category above Grill, Capability summary widget: '3/3 active' (3/3 פעילים) with Grill/Smoking/Sous-vide chips all enabled, plus '1 probe, 4 channels for internal temp tracking' note (+7 more)

### Community 28 - "Wizard Step 2 Brisket Search"
Cohesion: 0.36
Nodes (15): Wizard Step 2 - Brisket Search Result Found, Wizard Step 2: What's on the Fire? (מה על האש), Brisket (בריסקט) - Beef Cut, Offline-First Local Data (No Network, Browser-Saved Checklist), Wizard Step 2 - Brisket Item Detail with Continue CTA, Grill (גריל) Cooking Method, Kebab (קבב), Picanha (פיקאניה) (+7 more)

### Community 29 - "Code Sweep & Scheduler Functions"
Cohesion: 0.22
Nodes (14): Status & Gap Report — Where the App Actually Stands (2026-07-22), W1-A · Code Sweep — app.js, app.css, serve.js, build.py, worker/, chooseNozzle(dev, casingMm), choosePlate(dev, wantMm), combinedEventsRows() — multi-event cross-event view, deviceCanReach(dev, tempC) — thermal feasibility gate, planSchedule(items, serve, opts) — top-level pure scheduler, schedulePlacements(...) — backward serial SGS placement pass (+6 more)

### Community 30 - "Appearance/Theme Settings Screen"
Cohesion: 0.29
Nodes (14): Color scheme options: Charcoal & Flame, Warm Cream, Copper & Salt, Wood & Smoke, Font pairing options: Humanist, Geometric, Magazine, Current, Live preview card pattern (recipe example shows real-time effect of theme choices), Appearance Settings Screen (Hebrew, Warm Cream theme), Appearance customization system (language, color scheme, font pairing, text size), Global font-size scaling accessibility feature (Extra Large enlarges entire UI, not just preview), Appearance Settings Screen (Hebrew, Wood & Smoke theme, Extra-Large font), Bottom tab navigation pattern: Home, Catalog, Events, Projects (+6 more)

### Community 31 - "PWA Platform & Deployment Roadmap"
Cohesion: 0.20
Nodes (14): Gemini 2.5 Flash TTS (Hebrew), Bubblewrap TWA to Google Play, Build Order Roadmap (6 steps), Capacitor (deferred iOS bridge), Cloudflare Pages Hosting, Encrypted Export/Import, iOS PWA Capabilities (Web Push + Screen Wake Lock), Stay-a-PWA Verdict (+6 more)

### Community 32 - "Occupancy Hypotheses H1-H4"
Cohesion: 0.19
Nodes (13): Device Visualization Analysis (docs/analysis/2026-07-21-device-visualization.md), H1 — unknown→null floor semantics, H2 — sous-vide max-not-sum volume logic, H3 — device-driven hang (hooksOver), H4 — Per-Slot Occupancy Design Spec, hooksOver flag (H3, unchanged), Phase 2 — device diagrams (deferred graphics), Phase 4 — scheduler/timeline optimization (out of scope for H4) (+5 more)

### Community 33 - "AI Gateway & Monetization Seam"
Cohesion: 0.18
Nodes (12): gemFetch transport — timeout, exponential backoff, transient-only retries, key in header, endpoint-indirection seam, Managed AI tier decision — keep BYOK free forever, add Managed (turnkey) AI as the paid product, aiJSON() — shared AI JSON caller with key/catalog validation, Managed-AI tier proposal (P0 monetization — app brings the key), matkonet platform — planned future host platform for matkonetesh as a module, ROADMAP v149 — Implementation Roadmap (sequences ANALYSIS-v149 into shippable waves), Business-model track decision (2026-07-13): hold ALL live revenue until matkonet, seams only, §D Deferred — matkonet platform backlog (managed-AI, accounts+sync, B2B billing, dataset licensing) (+4 more)

### Community 34 - "Home Screen & More Menu (Hebrew)"
Cohesion: 0.30
Nodes (12): Ask the Fire AI Cooking Assistant CTA, Bottom Tab Navigation Bar (Projects/Events/Quick-Action/Catalog/Home), Cooking-Method Cut Recommendation Chips (Smoker/Grill/Sous-vide), Home Screen (Hebrew RTL) - Fire Guide Recipe App, Frequently Used Shortcuts Section, Language Switcher (English/German/Hebrew/French/Spanish), More Menu Screen (עוד - All Tools and Features), Work Tools List (Active Now, Meal Builder, Scheduler, Print Menu, Shopping List) (+4 more)

### Community 35 - "Event Wizard Step 1 (Details)"
Cohesion: 0.39
Nodes (12): Event Creation Wizard - Step 1 (Empty Form), Appetite Tier Chip Selector (Light/Regular/Heavy with gram targets), Diner Count Stepper Control (+/- with numeric display), Event Creation Wizard (6-Step Flow, RTL Hebrew), Event Creation Wizard - Step 1 (Event Name Filled), Event Name Text Input (freeform, example placeholder), Event Creation Wizard - Step 1 (Native Date Picker Filled), Native HTML Date Picker Input (DD/MM/YYYY, calendar icon) (+4 more)

### Community 36 - "LLM Model Cost Tiers"
Cohesion: 0.17
Nodes (12): Cheap-Default + Escalate Strategy, Cloudflare AI Gateway, Cost Levers Ranked, DeepSeek V4-Flash, Gemini 2.5 Flash-Lite, Gemini 2.5 Flash / 3.5 Flash (escalation tier), Gemini 2.5 Pro (hardest tier), LiteLLM (self-hosted proxy) (+4 more)

### Community 37 - "Timeline Scheduler Per-Item Cards"
Cohesion: 0.27
Nodes (11): Insufficient-time scheduling conflict warning, Timeline Scheduler – Insufficient-Time Warning (Hebrew), Timeline Scheduler tool (מתזמן ציר-זמן), Timeline Scheduler – Per-Item Timeline List (Hebrew), Timeline item card (per-dish prep schedule entry), Timeline Scheduler tool (מתזמן ציר-זמן), Digital scale precision requirement (≤0.1g for cure dosing), Equipment requirement chip (have/missing × required/recommended) (+3 more)

### Community 38 - "Occupancy Packer (packDevice/slots)"
Cohesion: 0.24
Nodes (11): deviceOccupancy() model function, Recompute-per-call, not memoised (packer determinism decision), packDevice() — the packer (assign-on-arrival, never re-place), slotOver — honest over-capacity flag, slots[] per-slot occupancy array, Unmeasured-size bucket (cm2 === null, distinct from unplaced), unplaced[] — items that fit no single slot, packDevice/deviceOccupancy inverted as capacity oracle (+3 more)

### Community 39 - "AI Proxy & Cloudflare Infra"
Cohesion: 0.20
Nodes (10): Grounding Economics x BYOK, TTS Key Management / BYO-Key Risk, /ai Managed-AI Proxy Route, Cloudflare Worker (AI Proxy + Sync), Cloudflare D1 / KV Storage, GEM_HOST Monetization Seam (app.js:3117-3120), Source/Data Protection Strategy, Last-Write-Wins Sync Strategy (+2 more)

### Community 40 - "Business Model & Payment Processors"
Cohesion: 0.20
Nodes (11): Lemon Squeezy (winding down), Paddle (Merchant of Record), Stripe (not MoR for Israel), Bucket A — Buildable Now Roadmap, Bucket B — Wave 4 Business Layer Roadmap, Conversational Menu Designer (feature candidate), Cookout Orchestrator (feature candidate), Matkonet · Fire Guide (product) (+3 more)

### Community 41 - "Home Screen Customization Concepts"
Cohesion: 0.36
Nodes (10): Ask the Fire AI Tool, App Bottom Navigation Bar, Home Screen Widget Panels (customizable), Ingredient Catalog Browser, Pitmaster Tools Feature, Smoker/Oven Occupancy Planner, Home Screen Customization Screen, Picanha Cut Detail Screen (Pitmaster Tools) (+2 more)

### Community 42 - "Device Silhouette Rendering"
Cohesion: 0.31
Nodes (10): cap.slots/slotKind/perSlotCm2/slotLabel, Grill zone packing (slotKind:'zone'), Oven as rack-based slot device, Cabinet silhouette (vertical shelf stack), deviceDisplayName(dev) function, deviceSilhouette(dev) function, Grill-round / grill-rect silhouette, occupancyDevHtml() — device diagram view dispatcher (+2 more)

### Community 43 - "ANALYSIS v149 Hebrew (Security/XSS)"
Cohesion: 0.22
Nodes (9): מתכונת אש — ניתוח מעמיק v149 (פירוט מלא), פלט AI → innerHTML ללא esc(), T2 · חלצו CSS/JS מתוך מחרוזת-ה-Python, T3 · פענוח store/DATA וטיפול-שגיאות, T4 · אין service worker, T5 · תקינות ערכת-נושא ו-fscale, T6 · סחיפת צינור-הנתונים, P0: Unescaped AI text rendered as HTML → XSS → Gemini API-key theft (+1 more)

### Community 44 - "AI Platform Comparison Research"
Cohesion: 0.31
Nodes (9): Anthropic Platform (Alternative), Claude Haiku 4.5, DICTA (Hebrew NLP Judge Model), Gemini 2.5 Flash TTS, Gemini as Primary AI Platform (Verdict), Close-the-Loop Hebrew Eval, Mistral Small 4, OpenAI Platform (Alternative) (+1 more)

### Community 45 - "Scheduler Phase 4a Extraction"
Cohesion: 0.32
Nodes (8): Backward critical-path relaxation (resource-unconstrained RCPSP relaxation), buildList() — backward walk scheduler, Cart-quantity bug (divergent-copy defect class analogy), combinedEventsRows() — duplicate backward walk, Phase 4a — extract planSchedule() (no behaviour change), planSchedule() — extracted pure scheduling function (Phase 4a), RCPSP (Resource-Constrained Project Scheduling Problem), Relax layer (backward walk, no behaviour change)

### Community 46 - "i18n Safety Numbers & Locale Seam"
Cohesion: 0.33
Nodes (7): Safety-number discipline — salt/cure/nitrite always from app presets (UMAKE_CALC), never the model, getLang()/setLang() pluggable locale provider (proposed matkonet module seam), T1 · מספרי-בטיחות מוטמעים בפרוזה, T1: Safety numbers baked into prose (cure %, salt, internal temps in free-text), t(key) keyed-string i18n seam (proposed, does not exist yet), tnode() + per-language dict layer (lang/<code>.json chrome + .data.json prose) — solid, scalable, zero-code to add a language, Wave 5 — Multilingual i18n → v156 (English first)

### Community 47 - "Adaptive Home Design Phases"
Cohesion: 0.29
Nodes (7): BYOK-Gemini AI model — owner pays $0, user brings own API key, P0: Catalog is a dead-end island — no add-to-menu/cook control exists, Adaptive Home — design & build plan, homeGear() — single source of truth reading mk-gear per paint via canSV/canSmoke/canGrill, Phase 3 — fast-lane quick-pick chips (DATA-derived, gear-aware, → openCut) — the headline feature, Phase 7 (owner add) — home customization: user picks which tools appear on home and in what order, Phase 8 (owner add) — AI features for everyone, not pro-gated; the real gate is API-key availability

### Community 48 - "Foundations Refactor (Wave 2)"
Cohesion: 0.29
Nodes (7): DATA global — 888KB embedded JS object literal (const DATA = __DATA__), menuState() — re-parses full menu from localStorage on 41 call sites, unmemoized, T3: store/DATA parsing & error handling (object-literal vs JSON.parse, swallowed quota errors), T4: No service worker — app claims PWA but ships no offline shell, T1: everything that matters at the smoker runs in the foreground page, T5: silent failures everywhere — store.set, importData, journal-photo guard all swallow errors, Wave 2 — Foundations refactor → v152 (2a extraction/perf/offline, 2b state/modularization)

### Community 49 - "Scheduler Fit Ladder & Safety Boundary"
Cohesion: 0.29
Nodes (7): FIT_HARD_FACTOR = 1.6, Fit verdict ladder (out.fit: ok/tight/over), Lexicographic objective (never a weighted sum), Phase 4 — The Scheduler Design Spec, Refactoring Report §7 (items 18–22), Safety boundary — forbidden moves (non-negotiable), Scheduling Architecture Analysis (docs/analysis/2026-07-21-scheduling-architecture.md)

### Community 50 - "Scheduler Repair Ladder (Phase 4c)"
Cohesion: 0.29
Nodes (7): occupancyCompat.setpoint field, Phase 4c — repair ladder (needs owner go), Repair layer (repair ladder), The setpoint hazard (occupancyCompat.setpoint = max(temps)), share — repair-ladder move (device co-scheduling), shareTolC = 15, TEMP_TOL_C = 6

### Community 51 - "TTS Provider Comparison Research"
Cohesion: 0.29
Nodes (6): Azure Neural (Avri/Hila), Cartesia Sonic 3.5, Google Cloud Chirp3-HD he-IL, ElevenLabs v3, TTSProvider Abstraction Design, Web Speech API

### Community 52 - "Duplicate Scroll-Capture Screenshots"
Cohesion: 0.73
Nodes (6): Concept: Brisket Cut Detail Screen (Cut #1, 5.5kg Beef, Sous-vide+Smoke hybrid method), Brisket Cut Detail Card - Overview & Method Stats (RTL Hebrew), Brisket Cut Detail Card - Scroll Capture 1 (identical to top-of-screen capture), Concept: My Equipment Management Screen (sous-vide, thermometer, other categories), My Equipment Settings Modal (RTL Hebrew) - device inventory by category, My Equipment Settings Modal - top-of-section capture (pixel-identical to 09b)

### Community 53 - "Equipment Property AI Capture"
Cohesion: 0.33
Nodes (6): aiLookupDevice (AI spec-sheet lookup, v245), aiRepairJson (malformed AI output repair), Capture precedence: AI lookup > class default > manual entry, chipsFor (at-a-glance chips), doSave (persists props into d.cap), paintVerify (verify-card form renderer)

### Community 54 - "Occupancy Phase 2 Design Spec"
Cohesion: 0.33
Nodes (6): Device Visualization Analysis (docs/analysis/2026-07-21-device-visualization.md), Lesson L13 — numeric dir=ltr bidi safety, Approved occupancy mockup (scratchpad/occupancy-mockup.html, rev3), Phase 2 — Device-Occupancy Diagrams Design Spec, Phase 4 — timeline optimization (out of scope for Phase 2), Three app themes (light, light-high-contrast, dark)

### Community 55 - "Hebrew TTS/STT Research"
Cohesion: 0.40
Nodes (6): Israwave (ONNX TTS), ivrit-ai (Hebrew STT), Niqqud (Diacritics) Problem, Phonikud (Hebrew G2P), Piper (VITS-ONNX), sherpa-onnx WASM

### Community 56 - "Kosher/Kashrut Wizard Filtering"
Cohesion: 1.00
Nodes (5): Kashrut / Kosher Catalog Filtering Concept, Event Wizard Step 2/6 - 'What's on the Fire' Catalog Filter (Default State), Event Wizard Step 2/6 - Pork ('חזיר') Filter Selected, Zero Results (Kosher-Only Catalog Revealed), Event Wizard Step 1/6 - Event Details (Name, Description, Date, Diners, Appetite, Kashrut), Event Wizard Step 2/6 - Search 'Brisket' Combined with Pork Filter Still Active, Zero Results

### Community 57 - "Managed-AI Backend Services"
Cohesion: 0.60
Nodes (5): AI Gateway Service, Entitlements Service, Fire Guide Pro (paid tier), Identity Service (magic-link to JWT), Standalone Product, Ecosystem-Ready Backend

### Community 58 - "Occupancy Screen Theme/Locale Variants"
Cohesion: 1.00
Nodes (4): Cooker Occupancy Design Mockup (Phase 2 Proposal, Hebrew, Top Half), Cooker Occupancy Screen - Dark Theme, Hebrew (p2), Cooker Occupancy Screen - Light Theme, English (p2), Cooker Occupancy Screen - Light Theme, Hebrew (p2)

### Community 59 - "applyMove() Function & Storage Keys"
Cohesion: 0.50
Nodes (4): applyMove(move, scope) function, mk-item-shift-<scope> storage key, mk-item-wood-<scope> storage key, setItemCooker() function

### Community 60 - "App Store Payment Policy Research"
Cohesion: 0.50
Nodes (4): Apple Guideline 4.2 (Minimum Functionality), Apple IAP, Epic v. Apple Ruling (Dec 2025 remand), RevenueCat

## Ambiguous Edges - Review These
- `preheatMin(dev, cat)` → `smoker maxC / canHang / hooks / waterPan properties`  [AMBIGUOUS]
  superpowers/specs/2026-07-20-equipment-properties-completion-design.md · relation: conceptually_related_to
- `Orchestrator Phase 3 Slices 2-3 (solver)` → `Demand-driven capture (deferred)`  [AMBIGUOUS]
  superpowers/specs/2026-07-20-equipment-properties-completion-design.md · relation: conceptually_related_to
- `Home Screen Customization Screen` → `Oven/Smoker Occupancy Screen`  [AMBIGUOUS]
  analysis/shots/06-mystery-panel.png · relation: shows_navigation_to
- `Brisket Cut Detail Card - Overview & Method Stats (RTL Hebrew)` → `My Equipment Settings Modal - top-of-section capture (pixel-identical to 09b)`  [AMBIGUOUS]
  analysis/shots/09c-brisket-eqsection-top.png · relation: shows_navigation_to
- `'My Equipment' (הציוד שלי) settings panel - card-per-category-item layout with add/edit/remove controls` → `Catalog list UI pattern: item cards with photo medallion, favorite star, order badge (#4/#6/#7), category tag, weight, target temp, cook-time range, smoker-time-added badge, and progress dots; bottom tab bar (Projects/Events/Catalog-active/Home)`  [AMBIGUOUS]
  analysis/shots/09d-brisket-eqsection-smoker.png · relation: conceptually_related_to
- `Smoker equipment card: 'ארון / קבינט' (Cabinet) - tags '6000 cm²' area, '4 shelves/layers', 'can hang 6' (אפשר לתלות)` → `Cabinet smoker 'can hang 6' (אפשר לתלות 6) capacity attribute, possibly tied to a hanging-bay placement feature`  [AMBIGUOUS]
  analysis/shots/10-mystery-details-dialog.png · relation: conceptually_related_to
- `Catalog list UI pattern: item cards with photo medallion, favorite star, order badge (#4/#6/#7), category tag, weight, target temp, cook-time range, smoker-time-added badge, and progress dots; bottom tab bar (Projects/Events/Catalog-active/Home)` → `Catalog card: 'ספייריבס' (Spare Ribs) - Pork Ribs, 1.5, tagged 'not kosher' (לא כשר)`  [AMBIGUOUS]
  analysis/shots/11-after-eq-close.png · relation: conceptually_related_to
- `Event Creation Wizard (6-Step Flow, RTL Hebrew)` → `Offline-First PWA Data Disclosure Footer (local data, no network, version stamp)`  [AMBIGUOUS]
  analysis/shots/15-wizard-kosher.png · relation: conceptually_related_to
- `Event Wizard Step 2/6 - 'What's on the Fire' Catalog Filter (Default State)` → `Kashrut / Kosher Catalog Filtering Concept`  [AMBIGUOUS]
  analysis/shots/16-wizard-step2.png · relation: conceptually_related_to
- `Offline-First Local Data (No Network, Browser-Saved Checklist)` → `Cooking-Method Backend Engine ("נשמר במנוע האמיתי")`  [AMBIGUOUS]
  analysis/shots/22-wizard-step3-methods.png · relation: conceptually_related_to
- `Desserts checklist (grilled caramel pineapple selected, peach/apricot, banana+chocolate, honeyed figs, charred watermelon, marshmallow, malabi, creme brulee, pavlova, tiramisu, hot chocolate cake, knafeh, hot drink)` → `Menu summary card: 8 diners / ~2.2kg meat, per-protein tags (curing+smoking+seasonings), plus sides and drinks recap`  [AMBIGUOUS]
  analysis/shots/26-wizard-step5-bottom.png · relation: conceptually_related_to
- `Seasonal fresh-fruit tray note, auto-derived from event date (watermelon, melon, grapes, nectarine, plum, fig, mango)` → `Menu summary card: 8 diners / ~2.2kg meat, per-protein tags (curing+smoking+seasonings), plus sides and drinks recap`  [AMBIGUOUS]
  analysis/shots/26-wizard-step5-bottom.png · relation: conceptually_related_to
- `Wizard Step 6: Menu Summary & Finish Actions` → `'Plan Event with AI' CTA (green, top of screen)`  [AMBIGUOUS]
  analysis/shots/29-after-save-event.png · relation: shows_navigation_to
- `Event Card: Friday Dinner - July (Active, 19:00, 8 guests, 4 portions, Jul 24)` → `Time-Axis Cooking Assistant Tool ('Tools' section, computes prep timing backward from serving time)`  [AMBIGUOUS]
  analysis/shots/29-after-save-event.png · relation: shows_navigation_to
- `Timeline Scheduler Modal (מתזמן ציר-זמן)` → `Date Field Value Visually Clipped (shows '24/07/202', trailing digit cut off)`  [AMBIGUOUS]
  analysis/shots/31b-timeline-date-clipped.png · relation: conceptually_related_to
- `Oven/Smoker Assignment per Item (auto-assign cook method)` → `Equipment Categories (Smoker / Grill / Sous-vide)`  [AMBIGUOUS]
  analysis/shots/38-equipment-mgmt.png · relation: conceptually_related_to
- `My Equipment List Screen (הציוד שלי) — after adding grill` → `Accessory — Heat-Resistant Gloves (כפפות חום), CHECKED, highlighted row`  [AMBIGUOUS]
  analysis/shots/42-other-accessories-checklist.png · relation: conceptually_related_to
- `Device Card — Charcoal (פחם): locked lid feature (מכסה)` → `Accessory — Burner / Torch (מבער / לפיד), unchecked, highlighted row`  [AMBIGUOUS]
  analysis/shots/42-other-accessories-checklist.png · relation: conceptually_related_to
- `My Events - Combined Schedule (multi-event view)` → `Partial i18n coverage gap: Hebrew UI strings remain in English locale (status badge, dish label, shopping/print/delete-all buttons)`  [AMBIGUOUS]
  analysis/shots/46-multievent-list.png · relation: conceptually_related_to
- `Cooker Ambiguity Edge Case` → `Cure Guard Hard Block`  [AMBIGUOUS]
  analysis/shots/cooker-ambiguity-390.png · relation: conceptually_related_to
- `Phase 2 UI Verification Defect: Unit Mismatch in Temperature Field` → `Unmeasured Items Get Own 'Not Placed' Bucket, Never a Shelf (T10)`  [AMBIGUOUS]
  analysis/shots/equip-validation-390.png · relation: conceptually_related_to
- `Phase 2 UI Verification Defect: Unit Mismatch in Temperature Field` → `Surface hooksOver in the Fit Line — No False 'Everything Fits' (T9)`  [AMBIGUOUS]
  analysis/shots/equip-validation-390.png · relation: conceptually_related_to
- `'1+ item(s) with no known dimension' Badge` → `Bratwurst Item Chip`  [AMBIGUOUS]
  analysis/shots/h1-unknown-footprint-390.png · relation: conceptually_related_to
- `'1+ item(s) with no known dimension' Badge` → `Brisket Item Chip (1320 cm²)`  [AMBIGUOUS]
  analysis/shots/h1-unknown-footprint-390.png · relation: conceptually_related_to
- `Smoker Cabinet Occupancy Panel (ארון עישון)` → `Hanging Smoker Cabinet Hook Diagram`  [AMBIGUOUS]
  analysis/shots/h4-slots-390.png · relation: conceptually_related_to
- `Timeline Scheduler – Insufficient-Time Warning (Hebrew)` → `Timeline Scheduler – Per-Item Timeline List (Hebrew)`  [AMBIGUOUS]
  analysis/shots/p4-advice-he.png · relation: shows_navigation_to
- `Timeline Scheduler tool (מתזמן ציר-זמן)` → `Equipment requirement chip (have/missing × required/recommended)`  [AMBIGUOUS]
  analysis/shots/scale-res-chip-make-390.png · relation: conceptually_related_to
- `Timeline item card (per-dish prep schedule entry)` → `Frankfurter/Wiener smoked-sausage recipe`  [AMBIGUOUS]
  analysis/shots/scale-res-chip-make-390.png · relation: conceptually_related_to

## Knowledge Gaps
- **255 isolated node(s):** `build.py — single 7,508-line build script (data pipeline + HTML/CSS/JS + writer)`, `store wrapper — 4-line localStorage abstraction over 36 mk-* keys`, `cwGo — 6-step guided menu wizard`, `openMenu/renderMenu — second, near-duplicate menu builder`, `askGemini() — conversational Ask-the-Fire AI path with google_search grounding` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `preheatMin(dev, cat)` and `smoker maxC / canHang / hooks / waterPan properties`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Orchestrator Phase 3 Slices 2-3 (solver)` and `Demand-driven capture (deferred)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Home Screen Customization Screen` and `Oven/Smoker Occupancy Screen`?**
  _Edge tagged AMBIGUOUS (relation: shows_navigation_to) - confidence is low._
- **What is the exact relationship between `Brisket Cut Detail Card - Overview & Method Stats (RTL Hebrew)` and `My Equipment Settings Modal - top-of-section capture (pixel-identical to 09b)`?**
  _Edge tagged AMBIGUOUS (relation: shows_navigation_to) - confidence is low._
- **What is the exact relationship between `'My Equipment' (הציוד שלי) settings panel - card-per-category-item layout with add/edit/remove controls` and `Catalog list UI pattern: item cards with photo medallion, favorite star, order badge (#4/#6/#7), category tag, weight, target temp, cook-time range, smoker-time-added badge, and progress dots; bottom tab bar (Projects/Events/Catalog-active/Home)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Smoker equipment card: 'ארון / קבינט' (Cabinet) - tags '6000 cm²' area, '4 shelves/layers', 'can hang 6' (אפשר לתלות)` and `Cabinet smoker 'can hang 6' (אפשר לתלות 6) capacity attribute, possibly tied to a hanging-bay placement feature`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Catalog list UI pattern: item cards with photo medallion, favorite star, order badge (#4/#6/#7), category tag, weight, target temp, cook-time range, smoker-time-added badge, and progress dots; bottom tab bar (Projects/Events/Catalog-active/Home)` and `Catalog card: 'ספייריבס' (Spare Ribs) - Pork Ribs, 1.5, tagged 'not kosher' (לא כשר)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._