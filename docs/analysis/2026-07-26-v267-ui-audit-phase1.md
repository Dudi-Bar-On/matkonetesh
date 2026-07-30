# v267 real-UI audit — Phase 1 findings (2026-07-26)

> **STATUS (2026-07-30, Recovery Landing): findings CLOSED by the v268–v277 arc** — the translation drift
> (~1,300 strings unified onto one translation path, ~740 data values translated, Guards A/B/C in the
> build), the smoker-lookup "not found" (a token-ceiling bug, fixed v269 + the 8192-token policy), and the
> E2/E3 rendering findings all closed across v268–277 with the 27.7 gates. **One unverified remnant:** the
> `ס״מ²`/`ל׳` unit glyphs in non-Hebrew languages — probably closed by the v269 data-values pass but never
> re-verified; a named sample check now rides the Language Thread's per-language §10.19 verification
> (`docs/ROADMAP-2026-07-30.md`, Language Thread).

Owner halted advancement: v267 was verified shallowly (build-present ≠ works in the UI). This is the
real-render-path audit that should have preceded the "ready to test" claim. Method per the project's own
skills: **verify-against-the-runtime-path** (measure at the consumer by *running* the feature) and
**no-inert-shipment** (test the rendered effect, not the value). Every number below was produced by driving
the real app and reading the rendered DOM — not by grepping dict files.

## Honest correction first
My v267 sign-off checked that code strings (`eqmEventWindowCheck`, the WHATS_NEW text) were present in the
served bundle, and that the dict **coverage metric** read ~99%. Both are true and both are the wrong
measurement. Running the app shows the features render but two of my three headline claims were wrong or
unverified, and the translation "win" is largely illusory on real screens.

---

## FINDING 1 — Translation drift is severe (the big one). fr/de/es/it are ~half English on real screens.

**Measured (rendered DOM, 13 major screens):**
| lang | Hebrew-leak nodes | English-fallback strings |
|------|------|------|
| FR | 5 | **568 unique** (20 data-names + 548 chrome) |
| DE | 6 | ~830 (per-screen, not deduped) |
| ES | 5 | ~826 |
| IT | 6 | ~815 |

**What "English-fallback" means:** with the app set to French, 548 app-generated UI strings render in
**English**, not French — whole sentences, not just loanwords. Samples straight from the French render:
`⚠️ This item cannot be cooked with your equipment` · `Requires: Sous-vide bath — owned but insufficient`
· `Add/configure equipment in Equipment Management` · `Work plan` · `Start plan` · `Push serve by 30 min`
· `Block when there isn't enough time` · `Tip for your smoker: Kettle: set up 2 zones…` · `Texture target`
· `Smoker saved` · and the **entire recipe cooking plan** — `Prep the cut` / `Clean, trim excess fat and pat
the meat thoroughly dry` / `Vacuum + sous-vide` / `Seal in a vacuum bag and sous-vide at 68°C for 30 hours…`
/ `Dry before smoking` / `Fire up the smoker`.

Visual proof: `scratch/diag-i18n-fr-recipe.png` — the brisket recipe in French mode. Title "Brisket"
(English), the whole "cannot be cooked" panel English, cooking tips English, stat labels English, method
chips "smoke/grill" English. Only the category, the prose description, and a few labels are French.

**Root cause (traced):** two mechanisms, one metric blind to both.
1. Hundreds of UI strings are inline `L(hebrew, english)` whose **Hebrew key was never added to the dicts**.
   `L()` returns the target-language value only if the Hebrew key exists in that dict (that is exactly why
   the §10.20 wood-advisory key, which *was* added, shows French) — otherwise it falls back to English. The
   ~548 chrome strings are this class.
2. Recipe/category **names** and **step prose** exist in DATA as heb+eng only; in any non-Hebrew language
   they render the English `eng`. (~20 names + the step-text.)

The build's "fr 99%" is `fr.json keys ÷ en.json keys` — it measures the *dict subset* and is blind to every
inline-`L` string and every data string. Runtime ≠ metric, exactly as the runtime-path skill warns.
The 568 figure is an upper bound (a minority — Picanha, Kebab, Sous-vide — are legitimate loanwords
identical across languages), but the large majority are genuine untranslated English (the screenshot proves
whole English sentences).

**Impact on prior claims:** "French/German/Spanish ~99%" (v266) and "Italian ~98%" (v267) describe dict-key
coverage, not what a user sees. On real screens these languages are roughly half English. The translation
marathon (translategemma) is translating the chrome dict — a subset — and does not touch inline-`L` strings
or data names/steps.

## FINDING 2 — Wood-load advisory: it actually WORKS on the real path (my "inert" worry was wrong).
Ran the real auto-resolve render path (no `setItemCooker` shortcut) for a single-smoker owner and a
smoker+sousvide owner:
- Hebrew: `יעד 95° · 🪵 בדוק וטען עץ מתאים: אלון/היקורי` — **advisory present.**
- English: `target 95° · 🪵 Check/load a suitable wood: Oak/hickory` — present **and the wood name is
  translated** (Oak/hickory), no Hebrew leak.
So it renders and translates for a plain smoker owner. Your "couldn't find it" is therefore scenario-specific
— most likely: the item you looked at had no smoke stage under your gear, or you own two smokers (the cooker
becomes ambiguous → `cookerFor` returns null → no advisory), or the smoker didn't add cleanly (see Finding 3).
NEEDS: your exact setup (which smoker, which item) to reproduce your case.

## FINDING 3 — Smoker lookup (הנפח אביה 150): client is correct; "not found" is an AI-grounding limit.
Code (app.js:7716): the device lookup calls the model with **`search:true`** (web grounding ON) and
**`think:'high'`**, plus the self-correcting thin-retry. So the client asks the model to search the web and
think hard. "Not found on the internet" is the model failing to *ground* a niche Hebrew-named local product
(הנפח = "the blacksmith") — not a missing feature. This cannot be reproduced without a live AI call.
NEEDS: your AI key or a managed-access code (secrets never enter the repo — you'd run the live lookup, or
enable a test access code), and ideally what the lookup returns for you now vs "yesterday".

## FINDING 4 — Minor real leaks
- Units untranslated: `2400 ס״מ²`, `20 ל׳` show Hebrew unit glyphs in every non-Hebrew language (should be
  cm² / L). Small but real, every language, equipment screen.
- A few About-page Hebrew lines leak in DE/IT.
- Language-picker shows native names ("עברית") in every mode — likely intentional, flag for confirmation.

## Confirmed rendering (functional, though English-in-French): E2/E3 capability panel
The French brisket screen shows the "cannot be cooked with your equipment" panel with per-requirement
reasons (Sous-vide bath / smoker "owned but insufficient", thermometer "missing") — so the E2 capability-
aware serving and E3 validity/why-fix panel do render on the real path. (Whether each verdict is *correct*
for a given kit is a separate check, still pending.)

---

## Still pending (the rest of the exhaustive sweep the owner asked for)
- Full deduped inventories for DE/ES/IT (FR done); Hebrew-mode English-leak check (English showing inside the
  Hebrew app).
- Every dialog/form/button/toast not on the 13 screens covered (edit forms, wizards, event planner, AI replies).
- Correctness (not just rendering) of each v267 feature: capability verdicts, event-add busy gate, smoker
  lookup live.
- The fix plans: (a) i18n — extract every inline-`L`/data string into the dict and translate all languages
  (large, architecture-level); (b) units; (c) whichever functional bugs the correctness pass finds.

## Conclusion
The owner's instinct was right and the drift is real: the headline drift is **translation**. The chrome-
coverage metric that drove "99% / ready to test" is blind to the majority of on-screen strings, so fr/de/es/it
ship roughly half in English. The wood advisory is fine; the smoker lookup needs a live key to diagnose.
Recommend: pause new language additions (the marathon is translating a subset that leaves screens half-
English), and scope a proper i18n-completeness fix before adding more languages or features.
