#!/usr/bin/env node
// gates.mjs — SHARED gate module for score.mjs (eval harness) AND bulk.mjs (bulk translator).
// ONE source per the bulk-translation mission brief (2026-07-25): both consumers import from here so
// the pass/fail logic used to grade the eval sample is byte-identical to the logic gating the bulk run.
//
// Contains, in order:
//   1. loadShippedGuard() — extracts & vm-executes the SHIPPED mtNumSig/mtSafe from dist/index.html
//      (never a reimplementation — see score.mjs's original header for the rationale this preserves).
//   2. foldFractions() — NEW (2026-07-25 bulk mission Stage 1b). Unicode vulgar-fraction folding
//      (½ -> "1/2" etc., NFKC-class) applied to BOTH sides before mtNumSig runs, so a Hebrew source
//      written with a vulgar-fraction glyph and a spelled-out "1/2" translation don't false-fail the
//      number-signature gate (mtNumSig's regex is plain `\d+(?:[.,]\d+)?` — it does not see a bare "½"
//      at all, so an un-folded compare would see 0 source numbers vs 2 translated numbers). This is
//      HARNESS-SIDE ONLY — the shipped app's own vulgar-fraction handling (if any) is a separate,
//      already-tracked fix and is not touched here.
//   3. hebrewLeak() — any Hebrew-block codepoint present in output.
//   4. UNIT_FAMILY_RULES / extractNumUnitPairs / unitLiteralCheck — unit-literal fidelity (G-T2),
//      moved verbatim from score.mjs (2026-07-25 refactor, no logic change).
//   5. SAFETY_LEXICON_GROUPS / safetyLexiconCheck() — NEW (G-T3, 2026-07-25 bulk mission Stage 1a).
//      Bidirectional safety-chemistry term lexicon: Hebrew source token -> required target-language
//      token, with a swap/invention check (a DIFFERENT lexicon term's target form appearing when the
//      source didn't ask for it is a FAIL — this is what catches nitrate<->nitrite swaps).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

// ── 1. Shipped mtNumSig/mtSafe loader ──────────────────────────────────────────────────────────────
export function loadShippedGuard(repoRoot) {
  const distPath = join(repoRoot, 'dist', 'index.html');
  const src = readFileSync(distPath, 'utf8');

  const numSigMatch = src.match(/function mtNumSig\(text\)\{[\s\S]*?\n\}/);
  const safeMatch = src.match(/function mtSafe\(src, translated\)\{[\s\S]*?\}/);
  if (!numSigMatch) throw new Error('Could not locate function mtNumSig(...) in dist/index.html — has the source changed shape? Update the regex, do not hand-write a replacement.');
  if (!safeMatch) throw new Error('Could not locate function mtSafe(...) in dist/index.html — has the source changed shape? Update the regex, do not hand-write a replacement.');

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(numSigMatch[0] + '\n' + safeMatch[0] + '\nthis.mtNumSig = mtNumSig; this.mtSafe = mtSafe;', sandbox);
  return { mtNumSig: sandbox.mtNumSig, mtSafe: sandbox.mtSafe, sourceFile: distPath };
}

// ── 2. Fraction normalization (Stage 1b) ───────────────────────────────────────────────────────────
// NFKC decomposes every Unicode vulgar-fraction codepoint (½ ¼ ¾ ⅓ ⅔ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞ ⅐ ⅑ ⅒) into
// `digit U+2044(FRACTION SLASH) digit`, e.g. "½".normalize('NFKC') === "1⁄2". Swap U+2044 for a plain
// ASCII "/" so mtNumSig's `\d+(?:[.,]\d+)?` regex — which does not match U+2044 or the fraction glyphs
// at all — sees the same two numbers on both sides. Verified empirically (node REPL, 2026-07-25) that
// NFKC covers the full vulgar-fraction block consistently; no hand-rolled glyph table needed.
export function foldFractions(text) {
  return String(text || '').normalize('NFKC').replace(/⁄/g, '/');
}

// mtSafe, but with fraction-folded inputs on both sides. Use this in place of guard.mtSafe(he, mt)
// everywhere a gate needs the number-signature check — it is a strict superset (never turns a real
// mtSafe PASS into a FAIL; only rescues false-fails caused by vulgar-fraction glyphs).
export function mtSafeFolded(guard, src, translated) {
  return guard.mtSafe(foldFractions(src), foldFractions(translated));
}

// ── 3. Hebrew-leak detector ─────────────────────────────────────────────────────────────────────────
const HEBREW_RE = /[֐-׿]/;
export function hebrewLeak(text) {
  return HEBREW_RE.test(String(text || ''));
}

// ── 4. UNIT-LITERAL fidelity check (G-T2) — verbatim from score.mjs, moved not rewritten ─────────────
// FRENCH forms added 2026-07-25 (bulk mission Stage 1c) after an empirical smoke run
// (translategemma:27b, 50-string sample, he->fr) showed 5/50 false unit_dropped fails: the model
// spells out "heure(s)" for hours (unlike "minute(s)", which is spelled identically in French and
// English, so it already matched). Without this, EVERY he->fr string with an hour value would false-
// fail unit-literal and get needlessly dropped to the Hebrew fallback. Also added the other common
// French metric/imperial unit words on the same evidence-based basis (not exhaustively verified per
// word — extend further if a real bulk output shows another gap, per this file's own convention).
//
// GERMAN forms added 2026-07-26 (bulk mission German-finisher Stage 1) after a hand-read 30-entry
// random sample of the 249 unitLiteral-only de.failed.json rejects found 30/30 ARTIFACT (0 real
// defects — no value changed, no unit converted, no family swapped in any of the 30; every case was a
// correctly-translated German unit word the table simply didn't recognize, e.g. "45 Minuten"/"3
// Stunden" spelled out in full, the exact same shape as the French heure(s) gap above). Added German
// time/mass/volume/length words on the same evidence-based, non-exhaustive basis as the French set.
// Also added a hyphen-tolerant separator (`[\s-]*` instead of `\s*`) to the length_metric rule only,
// evidenced by sample item 8: he "8 מ״מ" -> correctly-translated de "8-mm-Scheibe" (German attaches a
// numeral-unit-noun compound with hyphens, e.g. "8-mm-Platte" — a normal, correct German orthographic
// convention, not a translation defect) — the bare `\s*` prefix on the existing cm/mm rule doesn't see
// past the hyphen, so a correct hyphenated German compound was false-failing as unit_dropped.
// SCOPE NOTE: two OTHER gate-bug shapes surfaced in the same 30-sample and were deliberately NOT
// touched here (Circle of Control — note, don't fix while here): (1) sample item 1 — the bare `/^\s*°
// \s*F\b/i` rule false-matches German "für" (starts with lowercase f) right after a bare "°" degree
// sign, because JS's ASCII-only \b treats the transition from "f" to the following non-ASCII "ü" as a
// boundary; this is a pre-existing regex-boundary bug unrelated to spelled-out-vs-symbol unit forms,
// not evidenced to recur beyond that one sample entry, and out of THIS stage's scope (adding German
// unit-word recognition), so left as a follow-up finding, not a fix. (2) sample item 17 — the Hebrew
// vol_metric rule's `\b` after the Hebrew letter ל ("מ["׳״']?ל\b") can never match when ל is followed
// by a non-word char (Hebrew letters are outside JS's ASCII \w, so no true \w/non-\w transition exists
// there), so a real Hebrew "30 מ״ל" (30 ml) source token silently fails to register a source-side unit
// family at all — also unrelated to this stage's German-word-gap fix and left as a follow-up finding.
// Neither of these two is touched by (or touches) the additions below.
//
// SPANISH forms added 2026-07-26 (bulk mission Spanish-finisher Stage 1) on the same evidence-based
// basis: classifying the 274 es.failed.json rejects found 268 unit mismatches of which 249 (130
// "horas" + 116 "minutos" + 3 "hora") were correctly-translated spelled-out Spanish unit words the
// table didn't recognize — the exact French heure(s)/German Stunden shape again. Added Spanish
// time/mass/volume/length words (hora/minuto/gramo/kilogramo/mililitro/litro/centímetro/milímetro/
// libra/onza/pulgada/pie, all ±plural-s) non-exhaustively, per this file's convention.
// ALSO fixed in the same pass (registered follow-up finding (2) above, now DIRECTLY EVIDENCED by 8
// Spanish rejects): the Hebrew vol_metric token מ"ל's trailing `\b` could never match (Hebrew letters
// are outside JS's ASCII \w, so ל followed by space/punct has no \w transition), so a real source
// "30 מ״ל" registered NO source unit family and a correct Spanish "30 ml" then false-failed as
// unit_invented (8/8 such rejects were correct translations). Replaced the dead `\b` with an explicit
// negative lookahead (?![א-ת]) — same intent (don't match מל as the prefix of a longer Hebrew word
// like מלח/מלפפון), but actually functional after a final Hebrew letter. Follow-up finding (1) (the
// `°F` rule's \b false-matching German "für") remains untouched — no Spanish entry trips it (no
// Spanish word shaped f+non-ASCII follows a bare degree sign in the corpus).
//
// ITALIAN forms added 2026-07-26 (bulk mission Italian-finisher, first of the 23-language queue) on the
// SAME evidence-based, non-exhaustive footing as fr/de/es. Classifying the 296 it.failed.json rejects
// (English-pivot translategemma:27b) found the dominant class was correctly-translated spelled-out
// Italian unit words the table didn't recognize — a unitLiteral follow-word frequency count over the
// mismatched numbers showed "ore" (133, hours plural), "minuti" (116, minutes plural) and "ora" (3,
// hour singular) as the overwhelming majority, the exact French heure(s)/German Stunden/Spanish
// horas shape yet again. Added Italian time/mass/volume/length words (ora/ore, minuto/minuti,
// grammo/grammi, chilo/chilogramm[io], millilitro/millilitri, litro/litri, centimetro/centimetri,
// millimetro/millimetri, libbra/libbre, oncia/once, pollice/pollici, piede/piedi) and a spelled-out
// Italian temperature word "gradi" (plural only — see next note), matching the full es family set even
// where a given word wasn't itself in the reject sample, per this file's convention. The universal
// symbol forms (g/kg/ml/l/cm/mm/°C) were already covered by the pre-existing rules and are untouched.
// DELIBERATELY EXCLUDED — the bare Italian kg-plural colloquialism "chili": it was tried and then
// removed after the fr/de/es regression pass caught it as a REAL collision — German/Italian recipes
// write "1 Chili" for ONE CHILI PEPPER, and "chili"->mass_metric misread "1 Chili" as 1 kilogram,
// flipping 5 de.staged entries pass->FAIL (e.g. "1 צ'ילי" -> "1 Chili"). "chilo"/"chilogramm[io]" cover
// the kg meaning safely (they don't collide with the pepper); the rare Italian "2 chili di farina" kg-
// plural falls back instead of risking a mass<->pepper safety-adjacent misread. Verified: removing the
// bare "chili" token returns the fr/de/es delta to 0.
// GRADI SCOPING (deliberate, to protect the fr/de/es regression): mapped ONLY the Italian plural
// "gradi" -> tempC, NOT the singular "grado", because Spanish "grado(s)" would then cross-match and
// flip Spanish results (the regression gate below requires 0 fr/de/es flips). Italian recipe
// temperatures are virtually always plural ("175 gradi"), so this loses no real Italian coverage while
// keeping the addition inert for es. "gradi" was not in the it reject sample (Italian output uses the
// °C symbol there); it is added per the mission's explicit temperature instruction + Italian
// orthography, scoped as above. SECONDS deliberately NOT added: there is no time_sec family anywhere in
// this table (fr/de/es never added one — the de-finisher explicitly let a real שנ'/seconds defect fail
// rather than invent one), and adding an Italian secondi word with no matching family would either be
// inert or, if mapped to a wrong family, manufacture false fails; seconds handling remains a separate
// cross-language gate question, out of this finisher's scope. Verified by a full fr/de/es regression
// pass (0 flips either direction) + Italian unit witnesses — see the Italian-finisher session report.
// 23-LANGUAGE forms added 2026-07-27 (queued-language finisher: it,pt,el,ja,ko,th,nl,hu,pl,ro,vi,hi,id,
// ru,uk,da,fi,nb,tr,sv,cs,ar,zh). SAME evidence-based, non-exhaustive footing as fr/de/es/it above.
// Classifying the ru.failed.json unitLiteral rejects (22 chrome + 99 data entries) found the dominant
// class was — yet again — correctly-translated spelled-out unit words the table didn't recognize, this
// time in Cyrillic ("30 минут"/"1 г"/"2 см"/"частей на миллион"). Two structural notes specific to the
// non-Latin scripts: (1) HOMOGLYPHS — Cyrillic "см"/"г"/"кг" are с/м/г/к in the Cyrillic block, NOT the
// Latin cm/g/kg the pre-existing rules matched, so they are genuinely invisible until listed explicitly.
// (2) JS's \b is ASCII-only, so a trailing \b never fires after a Cyrillic/Greek/CJK/Arabic/Thai/Devanagari
// letter (the exact מ"ל \b failure documented in the Spanish note above) — these forms use the ^-anchor +
// explicit prefix, ordered LONGER-FIRST (分钟 before 分), with a same-script negative-lookahead only on the
// risky BARE single-letter Cyrillic abbreviations (г/ч/мин/хв/см/мм and час/день). CROSS-FAMILY COLLISIONS
// guarded: bare "г"(gram) prefixes "градус"(degree) — the generic-degree rule below lists градус and, being
// a tempC rule, is reached before the mass rules; "час"(hour) prefixes "част-"(as in the ppm phrase
// "частей") — bare час carries (?![cyr]) while часов/часа are explicit. Latin additions that were already
// prefixes of matched tokens were NOT re-added. DELIBERATELY EXCLUDED (ambiguity, per the it-finisher's
// "chili" precedent): bare uk "год"(hour) collides with ru "год"(year) → kept годин only; bare Arabic
// "غ"(gram) → kept غرام/جرام. NO time_day rule is added because this table has never modelled a day family
// (build.py's Guard B does; gates.mjs does not — a pre-existing, deliberate divergence left intact here).
// Generic spelled-out DEGREE words map to tempC to match the pre-existing gradi→tempC choice (this table
// has no coarse 'temp' family, unlike build.py's _GB_UNIT_CLASS — same divergence, documented). The
// mass_metric family is SPLIT into mass_metric_g / mass_metric_kg (see the METRIC_FAMS note below) so a
// g↔kg swap — the 1000× cure-dose danger CLAUDE.md names build.py's Guard B as catching — now FAILS here
// too; verified regression-neutral across the de/el/es/fr/it/pt/ru staged pools (no faithful translation
// renders the same value as g on one side and kg on the other). Verified: full RED (dropped number /
// min↔hr / °C↔°F / g↔kg all FAIL) + GREEN (22 chrome ru rejects now PASS) — see the session report.
export const UNIT_FAMILY_RULES = [
  { re: /^\s*°\s*F\b/i, fam: 'tempF' },
  { re: /^\s*°\s*C\b/i, fam: 'tempC' },
  { re: /^\s*°/, fam: 'tempC' },
  { re: /^\s*gradi\b/i, fam: 'tempC' }, // Italian spelled-out degrees (plural only; see ITALIAN note above)
  { re: /^\s*(?:מעלות|degr[ée]s?|grad|graus|astetta|stopni|stupňů|fok\b|derajat|derece|градус|βαθμ|度|도|องศา|डिग्री|độ|درجة)/i, fam: 'tempC' }, // 23-lang generic degrees → tempC (see note above). Hebrew מעלות added on the SOURCE side too: without it, a correct "68 מעלות"→"68 Grad/градусов" false-fails as unit_invented (build.py's _GB_UNIT_CLASS already had מעלות; this closes the same one-sided gap here).
  { re: /^\s*%/, fam: 'pct' },
  { re: /^\s*אחוז/, fam: 'pct' },
  { re: /^\s*(?:процент|τοις\s*εκατό)/i, fam: 'pct' }, // ru/el spelled-out percent
  { re: /^\s*(?:ppm\b|частей\s*на\s*миллион)/i, fam: 'ppm' }, // + ru "parts per million" phrase
  // ── COOKING MEASURES (cook_measure) — 2026-07-27, LEAK-2 fix ──────────────────────────────────────
  // Tablespoon/teaspoon/cup are NON-safety kitchen measures. Their OWN coarse family: a faithful
  // measure↔measure pair (he "4 כפ׳" → ru "4 ст.л.") passes, while a measure↔SAFETY-unit swap (°C, g/kg,
  // min/hr) or a measure→metric CONVERSION (½ cup → 125 ml, the translategemma Italian bug) still FAILS
  // (family_mismatch / value drift). MUST sit ABOVE the time rules: Russian teaspoon "ч.л." would
  // otherwise be grabbed by the bare-"ч" HOUR rule (ч followed by "." satisfies its (?![cyr]) lookahead),
  // turning a correct teaspoon into a false hour_to_minute / unit_invented fail. No tbsp/tsp/cup
  // sub-distinction is modelled (a tbsp↔tsp mix-up is not a safety hazard; requiring it would false-fail
  // faithful variants). See scratch/translate-eval/cook-measure-gate.test.mjs (RED/GREEN witnesses).
  { re: /^\s*(?:כפית|כפיות|כפות|כפ["'׳״]|כף|כוסות|כוס)/, fam: 'cook_measure' }, // he: tbsp(כף/כפ׳)/tsp(כפית)/cup(כוס)
  { re: /^\s*(?:tbsps?\.?|tablespoons?|tsps?\.?|teaspoons?|cups?)\b/i, fam: 'cook_measure' }, // en
  { re: /^\s*(?:ст\.?\s*л\.?|ч\.?\s*л\.?|столов|чайн|стакан|чашк)/i, fam: 'cook_measure' }, // ru: ст.л./ч.л./столовая/чайная ложка/стакан/чашка — ч.л. must beat the HOUR rule below
  { re: /^\s*(?:c\.?\s*à\.?\s*[sc]\b|cuill[eè]res?|tasses?)\b/i, fam: 'cook_measure' }, // fr: c.à.s/c.à.c/cuillère/tasse
  { re: /^\s*(?:EL\b|TL\b|essl[öo]ffel|teel[öo]ffel|tassen?)\b/i, fam: 'cook_measure' }, // de: EL/TL/Esslöffel/Teelöffel/Tasse
  { re: /^\s*(?:cucharaditas?|cucharadas?|cdtas?\.?|cdas?\.?|tazas?)\b/i, fam: 'cook_measure' }, // es: cucharada(ita)/cda/cdta/taza
  { re: /^\s*(?:cucchiaini|cucchiaino|cucchiai|cucchiaio|tazz[ae])\b/i, fam: 'cook_measure' }, // it: cucchiaio/cucchiaino/tazza
  { re: /^\s*(?:κουταλ|φλιτζαν)/i, fam: 'cook_measure' }, // el: κουταλιά/κουταλιές/κουταλάκι (spoon), φλιτζάνι/φλιτζανιού (cup) — staged-pool neutrality
  { re: /^\s*(?:colheres?|x[ií]caras?|ch[áa]venas?|copos?)\b/i, fam: 'cook_measure' }, // pt: colher(es) (de sopa/chá), xícara/chávena/copo — staged-pool neutrality
  { re: /^\s*(?:lbs?\b|pounds?\b|livres?\b|pfund\b|libras?\b|libbre?\b|libbra\b)/i, fam: 'mass_imperial' },
  { re: /^\s*(?:oz\b|ounces?\b|onces?\b|onzas?\b|oncia\b|once\b)/i, fam: 'mass_imperial' },
  { re: /^\s*(?:kg\b|ק[׳"״']?ג|קילו|kilos?\b|kilogrammes?\b|kilogramm\b|kilogramos?\b|chilogramm[io]\b|chilo\b|quilos?\b|ki-lô|килограмм|килограм|кг|κιλ|千克|公斤|キログラム|キロ|킬로그램|킬로|กิโลกรัม|กก|किलोग्राम|किलो|كيلوغرام|كيلو)/i, fam: 'mass_metric_kg' },
  { re: /^\s*(?:g\b|grams?\b|gr(?![a-zà-ÿß])|גרם|גר[׳']|ג[׳']|grammes?\b|gramm\b|gramos?\b|gramm[io]\b|gam\b|грамм|грамма|граммов|грам|грамів|г(?![а-яёіїєґА-ЯЁІЇЄҐ])|γραμμάρια|γρ|グラム|그램|克|กรัม|ग्राम|غرام|جرام)/i, fam: 'mass_metric_g' }, // gr\b → gr(?![latin]) so German "grüne"/"größe" (green/size) is not misread as grams (JS \b fires after "gr" before a non-ASCII letter, 2026-07-27)
  { re: /^\s*(?:gal(?:lons?)?\b|qt\b|quarts?\b|fl\.?\s*oz\b)/i, fam: 'vol_imperial' },
  { re: /^\s*(?:ml\b|מ["׳״']?ל(?![א-ת])|ליטר|l\b|millilitres?\b|litres?\b|milliliter\b|liter\b|mililitros?\b|litros?\b|millilitr[io]\b|litr[io]\b)/i, fam: 'vol_metric' },
  // אינץ׳ + Zoll added with the Spanish forms (2026-07-26): the table had NO Hebrew inch token, so
  // adding pulgada exposed a false unit_invented on he "קוביות ½-1 אינץ׳" -> es "Cubos de ½ a 1
  // pulgada." (source fam was none only because the Hebrew word wasn't recognized — same one-sided-
  // blindness shape as the מ"ל fix above); recognizing the Hebrew side then exposed the German word
  // for inch ("Zoll") missing too, on the SAME source string's correct de translation ("½–1 Zoll").
  { re: /^\s*(?:in(?:ch(?:es)?)?\b|ft\b|feet\b|pouces?\b|pieds?\b|pulgadas?\b|pies?\b|zoll\b|אינץ[׳'"]?|pollici\b|pollice\b|piedi\b|piede\b)/i, fam: 'length_imperial' },
  { re: /^[\s-]*(?:cm\b|ס["׳״']?מ|mm\b|מ["׳״']?מ|centim[eè]tres?\b|millim[eè]tres?\b|zentimeter\b|millimeter\b|cent[ií]metros?\b|mil[ií]metros?\b|centimetr[io]\b|millimetr[io]\b|см(?![а-яёіїєґА-ЯЁІЇЄҐ])|мм(?![а-яёіїєґА-ЯЁІЇЄҐ])|厘米|毫米|センチ|ミリ|센티미터|밀리미터|เซนติเมตร|มิลลิเมตร|εκατοστά|χιλιοστά)/i, fam: 'length_metric' },
  { re: /^\s*ה?(?:שעות|שעה|שע(?=[׳'.,)\s]|$)|ש(?=[׳'.,)\s]|$))/, fam: 'time_hr' },
  { re: /^\s*(?:hours?\b|hrs?\b|h\b|heures?\b|stunden?\b|horas?\b|ore\b|ora\b|hodin|godzin|óra|órát|timmar|tuntia|saat\b|jam\b|giờ|uur|uren|timer)/i, fam: 'time_hr' }, // NB: bare "gio" was tried for vi giờ-without-diacritic and REMOVED — it matched Italian "giorni"(days) → 48 false-fails; "giờ" with the diacritic is kept.
  { re: /^\s*(?:часов|часа|час(?![а-яёіїєґА-ЯЁІЇЄҐ])|ч(?![а-яёіїєґА-ЯЁІЇЄҐ])|годин|ώρες|ώρα|ωρών|時間|小时|时|시간|ชั่วโมง|घंटे|घंटा|ساعة|ساعات)/i, fam: 'time_hr' }, // 23-lang non-Latin hours. NB: Greek uses explicit ώρες|ώρα|ωρών, NOT a bare "ώρ" prefix — "ώρ" matched "ώριμα"(ripe) → false-fail.
  { re: /^\s*ה?(?:דקות|דקה|דק(?=[׳'.,)\s]|$))/, fam: 'time_min' },
  { re: /^\s*(?:minutes?\b|mins?\b|minuten?\b|minutos?\b|minut[io]\b|minut|minuuttia|dakika|menit|perc\b|phút|phut)/i, fam: 'time_min' },
  { re: /^\s*(?:минут|мин(?![а-яёіїєґА-ЯЁІЇЄҐ])|хвилин|хв(?![а-яёіїєґА-ЯЁІЇЄҐ])|λεπτ|分钟|分|분|นาที|मिनट|دقيقة|دقائق)/i, fam: 'time_min' }, // 23-lang non-Latin minutes
];
// NOTE (2026-07-26, same German-finisher pass): re-running gateCheck across the ENTIRE de.staged.json
// (not just the 30-entry hand-read sample) as a full regression check surfaced 8 entries that had been
// PASSING under the pre-fix gate and now needed a second look — 2 were REAL pre-existing defects the
// old gate's mutual blindness had been masking (Hebrew "שנ'" — a seconds abbreviation, no `time_sec`
// family exists so it was never recognized either way — mistranslated to German "Minuten"; e.g. he
// "45-60 שנ' לצד" (45-60 SECONDS per side, a quick-sear instruction) -> de "45-60 Minuten" is a real,
// meaningful unit-family error, not touched/fixed here — it now correctly fails and goes to retry).
// The other 6 were a SECOND artifact-class the 30-sample happened not to surface: two Hebrew-side
// regex gaps in the שעות/שעה/דק rules above (not German-side, so evidenced independent of the German
// word additions) — (a) the definite article ה prefixed onto the unit noun ("השעות"/"הדק'") wasn't
// stripped before matching, and (b) the extremely common "שע'" hour abbreviation (ש+ע+geresh) wasn't
// covered by the existing bare-ש lookahead (which only fires for a lone ש immediately followed by a
// delimiter, not ש-ע-delimiter). Both are added above (optional leading `ה?`, plus the `שע(?=...)`
// alternative) on the same non-exhaustive, evidence-based footing as every other rule in this table —
// verified via a full regression pass (0 flips either direction) across fr.staged.json (3867),
// fr.failed.json (41), and the RED-witness שניות->minutes reconstruction — see PROGRESS.log / the
// German-finisher session report for the pasted evidence.
// mass_metric was SPLIT into mass_metric_g / mass_metric_kg (2026-07-27) so a g↔kg swap — the 1000×
// cure-dose danger — is a family_mismatch here, matching build.py's massG/massKg split. Both remain in
// METRIC_FAMS so metric↔imperial detection is unchanged; a same-family g→g / kg→kg faithful pair still passes.
const METRIC_FAMS = new Set(['mass_metric_g', 'mass_metric_kg', 'vol_metric', 'length_metric']);
const IMPERIAL_FAMS = new Set(['mass_imperial', 'vol_imperial', 'length_imperial']);

export function extractNumUnitPairs(text) {
  const s = String(text || '');
  const out = [];
  const re = /\d+(?:[.,]\d+)?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const value = parseFloat(m[0].replace(',', '.'));
    const rest = s.slice(m.index + m[0].length);
    let fam = 'none';
    for (const rule of UNIT_FAMILY_RULES) { if (rule.re.test(rest)) { fam = rule.fam; break; } }
    out.push({ value, fam, raw: m[0] });
  }
  return out;
}

// PAIRING NOTE (2026-07-26, Spanish-finisher): when the SAME numeric value appears more than once on
// both sides with different unit families (evidenced 3× in es.failed.json: "24–72 שעות ב-~24°C" —
// value 24 occurs once as a bare range-start and once as °C), the original first-value-match pairing
// crossed them (bare-24 ↔ 24°C, then 24°C ↔ bare-24), yielding a deterministic false
// unit_invented+unit_dropped that NO retry can ever clear (the numbers are identical in any correct
// translation). Fix: prefer an EXACT same-family value match first, fall back to value-only exactly as
// before. This only re-orders the assignment among equal-valued candidates — a genuine family error
// still has no same-family candidate to pair with, so it is still flagged (verified by full regression
// across fr/de/es staged+failed pools; see the Spanish-finisher session report for the flip counts).
export function unitLiteralCheck(src, mt) {
  const srcPairs = extractNumUnitPairs(src);
  const mtPool = extractNumUnitPairs(mt);
  const mismatches = [];
  for (const sp of srcPairs) {
    let idx = mtPool.findIndex((mp) => Math.abs(mp.value - sp.value) < 1e-9 && mp.fam === sp.fam);
    if (idx === -1) idx = mtPool.findIndex((mp) => Math.abs(mp.value - sp.value) < 1e-9);
    if (idx === -1) { mismatches.push({ value: sp.value, srcFam: sp.fam, mtFam: null, reason: 'value_missing_in_mt' }); continue; }
    const mp = mtPool.splice(idx, 1)[0];
    let reason = null;
    if ((sp.fam === 'tempC') && mp.fam === 'tempF') reason = 'temp_c_to_f';
    else if (sp.fam === 'time_hr' && mp.fam === 'time_min') reason = 'hour_to_minute';
    else if (sp.fam === 'time_min' && mp.fam === 'time_hr') reason = 'minute_to_hour';
    else if (sp.fam === 'none' && mp.fam !== 'none') reason = 'unit_invented';
    else if (sp.fam !== 'none' && mp.fam === 'none') reason = 'unit_dropped';
    else if (METRIC_FAMS.has(sp.fam) && IMPERIAL_FAMS.has(mp.fam)) reason = 'metric_to_imperial';
    else if (IMPERIAL_FAMS.has(sp.fam) && METRIC_FAMS.has(mp.fam)) reason = 'imperial_to_metric';
    else if ((sp.fam === 'mass_metric_g' && mp.fam === 'mass_metric_kg') || (sp.fam === 'mass_metric_kg' && mp.fam === 'mass_metric_g')) reason = 'gram_kilo_swap';
    else if (sp.fam !== mp.fam && sp.fam !== 'none' && mp.fam !== 'none' &&
             !(sp.fam === 'tempC' && mp.fam === 'tempC')) reason = 'family_mismatch';
    if (reason) mismatches.push({ value: sp.value, srcFam: sp.fam, mtFam: mp.fam, reason });
  }
  return { pass: mismatches.length === 0, checked: srcPairs.length, mismatches };
}

// ── 5. SAFETY-TERM LEXICON (G-T3, Stage 1a) ────────────────────────────────────────────────────────
// Hebrew spellings verified by grep against sources.py/data.py (2026-07-25), not assumed:
//   ניטריט   — "nitrite"  (data.py:208/209/233/421)
//   ניטראט   — "nitrate"  (data.py:209)
//   חנקה     — this app's own vocabulary for "nitrate" in the Cure #2 slow-release sense; CONFIRMED by
//               sample.json s28: he "...לשחרור חנקה איטי..." / shipped en ground truth "...for slow
//               nitrate release..." (data.py:209/406) — this is the exact term whose translategemma:27b
//               and aya-expanse:32b outputs both drifted to "nitrite" (VERIFICATION.md, the finding this
//               gate exists to catch).
//   מלח ורוד — "pink salt", the common name for Cure #1/Prague Powder #1 (data.py:208). Best-effort
//               French target pattern; extend per-language as real output shapes are observed — the
//               table is deliberately small and evidence-based, not exhaustive.
// NOTE ON SCOPE: "מלח מריחה" (named in the mission brief as a term to search for) does NOT occur
// anywhere in sources.py/data.py — grepped, confirmed absent. "מריחה" alone occurs only as unrelated
// BBQ vocabulary (Mop/Spritz basting, "somid" sous-vide-then-finish step) — never combined with מלח.
// The real curing-salt common-name term in this codebase is מלח ורוד ("pink salt"), used instead.
// SPANISH targets added 2026-07-26 (Spanish-finisher): patterns shaped by the model's REAL staged
// output, not guessed — es.staged.json shows "nitrito"/"Nitrito de sodio" for ניטריט, "nitrato(s)"
// for ניטראט/חנקה, and "sal rosa" for מלח ורוד (tolerate the "sal rosada" variant). Adding these
// immediately caught one real staged drift: he "Cure #2 לשחרור חנקה איטי" (slow NITRATE release) ->
// es "para una curación lenta" (generic "slow curing", nitrate dropped) — the exact s28 drift shape
// this gate was built for (VERIFICATION.md). NOTE (registered follow-up, NOT changed here): the gate
// rule is source-conditioned per the mission brief ("if the source contains a lexicon term..."), so a
// target-side INVENTION on a lexicon-clean source (observed once: he "תרבית" (starter culture) -> es
// "nitrito") is structurally outside it — that class is caught by the post-merge safety-lexicon scan,
// not the gate.
export const SAFETY_LEXICON_GROUPS = [
  {
    id: 'nitrite',
    he: [/ניטריט/],
    target: {
      fr: /\bnitrites?\b/i,
      en: /\bnitrites?\b/i,
      es: /\bnitritos?\b/i,
      it: /\bnitrit[io]\b/i, // Italian nitrito/nitriti (added 2026-07-26 Italian-finisher)
    },
  },
  {
    id: 'nitrate',
    he: [/ניטראט/, /חנקה/],
    target: {
      fr: /\bnitrates?\b/i,
      en: /\bnitrates?\b/i,
      es: /\bnitratos?\b/i,
      it: /\bnitrat[io]\b/i, // Italian nitrato/nitrati
    },
  },
  {
    id: 'pink_salt',
    he: [/מלח\s*ורוד/],
    target: {
      fr: /\bsel\s*ros[ei]\b/i, // "sel rose" (curing-salt term) — tolerate "rosé" spelling variant
      en: /\bpink\s*salt\b/i,
      es: /\bsal\s*rosa(?:da)?\b/i, // "sal rosa" observed in staged output; tolerate "sal rosada"
      it: /\bsale\s*ros[ao]\b/i, // Italian "sale rosa"; tolerate "sale rosato" variant
    },
  },
];

// GATE RULE (mission brief, verbatim): if the source contains a lexicon term, the output must contain
// that term's target form and MUST NOT contain a DIFFERENT lexicon term's form. Returns:
//   { pass, checked (# lexicon groups the SOURCE matched), failures: [{id, reason}], hitGroups }
// `reason` is one of:
//   'missing_target_term'      — source asked for this term, target form absent from mt
//   'invented_or_swapped_term' — a DIFFERENT group's target form is present in mt, though its own
//                                 source pattern did NOT match (the nitrate->nitrite swap shape)
// Only fires when `lang` has an entry in a given group's `target` map; a language with no lexicon
// entry yet is silently unchecked for that group (not a fail) — extend the table, don't skip the gate.
export function safetyLexiconCheck(he, mt, lang) {
  const heText = String(he || '');
  const mtText = String(mt || '');
  const hitGroups = SAFETY_LEXICON_GROUPS.filter((g) => g.he.some((re) => re.test(heText)));
  if (hitGroups.length === 0) return { pass: true, checked: 0, failures: [], hitGroups: [] };

  const failures = [];
  for (const g of hitGroups) {
    const targetRe = g.target[lang];
    if (!targetRe) continue;
    if (!targetRe.test(mtText)) failures.push({ id: g.id, reason: 'missing_target_term' });
  }
  for (const g of SAFETY_LEXICON_GROUPS) {
    const targetRe = g.target[lang];
    if (!targetRe) continue;
    const sourceAskedForThisGroup = hitGroups.some((h) => h.id === g.id);
    if (!sourceAskedForThisGroup && targetRe.test(mtText)) {
      failures.push({ id: g.id, reason: 'invented_or_swapped_term' });
    }
  }
  return { pass: failures.length === 0, checked: hitGroups.length, failures, hitGroups: hitGroups.map((g) => g.id) };
}
