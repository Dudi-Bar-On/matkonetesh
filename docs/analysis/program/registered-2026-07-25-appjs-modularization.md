# Registered work item — app.js modularization roadmap (strangler-fig, spec §2.7)

**Registered:** 2026-07-25, owner instruction in conversation ("i talked about the app.js refactoring
and extracting modules outside like we did for equipment — did we already add it to plan?").
**Status:** the PRINCIPLE is binding (equipment spec §2.7, adopted per owner Q5); this document adds
the missing piece — the concrete candidate list and the extraction rules — so the roadmap is tracked,
not remembered.

## The standing principle (verbatim anchor, spec §2.7)

Every re-architected pillar leaves `app.js` into its own source file, inlined by `build.py` into the
single shipped `<script>`, exposing ONE narrow global namespace; `app.js` never reaches inside.
`app.js` shrinks by **attrition**, never by a big-bang rewrite. No ES modules — one shared runtime
scope. `equipment.js`/`EQM` (E1, shipped 2026-07-25) is the first application.

## Extraction rules (how every module leaves)

1. **Attrition-first:** a pillar is extracted when a programme phase re-architects it — extraction is
   part of that phase's plan, with its own tests, never idle refactoring (Circle of Control).
2. **Opportunistic extraction is allowed for a stable, self-contained pillar** as a small standalone
   task between phases — owner approves each at a phase boundary.
3. **Every module gets the E1 treatment:** inlined before/after `app.js` as evaluation order requires;
   ONE narrow global; a `build.py` single-definition guard (the F5 pattern: defined exactly once in
   its file, all public members present, never defined/assigned in `app.js`). At the SECOND extraction,
   generalize build.py's hardcoded equipment.js block into a MODULES list with per-module guards —
   deliberately YAGNI until then.
4. **H2 ordering law applies to each:** a module evaluated before `app.js` contains no top-level call
   into it; hoisted `function` declarations may be referenced at call time.

## Candidate modules, mapped to their natural exit

| Candidate | One global | Natural exit point |
|---|---|---|
| `equipment.js` / `EQM` | ✅ shipped | E1 (done) |
| Orchestrator/scheduler (workplan build, relaxation pass, occupancy fit) | `ORCH` | E2–E4 (ledger + order re-sequencing rework touches all of it) |
| Navigation/panel system (serializable panel registry replacing panelStack closures) | `NAV` | the approved navigation redesign pillar (queued after equipment) |
| Voice stack (`vc*`: guard, TTS routing, transcription safety) | `VOICE` | the owner's wide-voice-support track |
| AI stack (`gemFetch`, model/think/search registries, `aiConfirmPanel`, usage) | `AI` | first AI-heavy phase after E5 (consult button work may trigger it) |
| i18n (`L`/`tnode`/dicts, `mt*` translation guards) | `I18N` | D9 bulk-translation push (post-D1 gate) |
| Render/cards layer | — | LAST — biggest, least self-contained; only after the above have left |

## What this is NOT

Not a scheduled phase, not license for a rewrite. Sequencing stays the owner's call at each phase
boundary; this registry exists so no phase plan "forgets" to take its module with it when it leaves.
