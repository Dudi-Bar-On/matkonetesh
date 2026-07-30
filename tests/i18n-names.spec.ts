// Task 6 (v268 localization plan) — recipe/category/cut/make NAMES → itemName reads the `__names__`
// dict sub-map. Spec: docs/superpowers/plans/2026-07-26-v268-localization.md "## Task 6";
// docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §11 (ONE names scheme, I-D):
//   function itemName(m){ ...
//     const nm=getDict().__names__||{}; return nm[m.heb] || m.eng || m.heb || '';   // fr/de/es/it
//   }
//
// This task's own DoD:
//   - he-mode: itemName(m) === m.heb, BYTE-IDENTICAL to pre-refactor (getDict() is null in he-mode —
//     the __names__ lookup must never even be attempted there).
//   - non-he (fr here): a seeded `__names__[m.heb]` entry wins over m.eng.
//   - non-he fallback: m.eng is returned (never blank) when the `__names__` key is absent — the
//     guaranteed fallback until Task 8 populates real per-language names.
import { test, expect, seedApp } from './_fixtures';

const bootLang = async (page: any, lang: string) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
  // Task 2: I18N_DICTS[lang] is populated by the async boot fetch (loadLangDict via __mkLangReady) —
  // these tests write directly into I18N_DICTS[lang].__names__, so the dict object must exist first.
  await page.evaluate(() => (window as any).__mkLangReady);
  await page.waitForFunction(`typeof itemName==='function' && typeof I18N_DICTS==='object'`);
};

test('i18n-names: fr-mode — itemName reads a seeded __names__ entry over m.eng', async ({ page }) => {
  await bootLang(page, 'fr');
  // Seed a fake translated name into the live fr dict's __names__ sub-map (spec I-D: a dedicated
  // sub-map keyed by m.heb, resolved directly by itemName — not a flat `he␟name` L/t key).
  // Passed as a string (not an arrow-fn evaluate()) so bare top-level `const I18N_DICTS`/`function
  // itemName` resolve via the page's global lexical scope — `window.I18N_DICTS` is NOT a thing
  // (top-level const/let bindings are not window properties even though the script is non-module).
  const name = await page.evaluate(
    `(function(){ I18N_DICTS.fr.__names__={'סינטה':'Faux-filet'}; return itemName({heb:'סינטה',eng:'Striploin'}); })()`) as string;
  expect(name).toBe('Faux-filet');
});

test('i18n-names: fr-mode — m.eng is the guaranteed fallback when __names__ has no entry for m.heb', async ({ page }) => {
  await bootLang(page, 'fr');
  // A DIFFERENT heb key is seeded — the lookup for our target key must miss and fall back, never blank.
  const name = await page.evaluate(
    `(function(){ I18N_DICTS.fr.__names__={'אחר':'Autre'}; return itemName({heb:'סינטה',eng:'Striploin'}); })()`) as string;
  expect(name).toBe('Striploin');
});

test('i18n-names: he-mode — itemName(m) returns m.heb byte-identical, __names__ never consulted', async ({ page }) => {
  await bootLang(page, 'he');
  // Even with a __names__ entry present in some OTHER language's dict, he-mode must ignore it —
  // getDict() is null in he-mode (app.js ~8558), so the __names__ lookup branch is unreachable.
  const name = await page.evaluate(
    `(function(){ I18N_DICTS.fr=I18N_DICTS.fr||{}; I18N_DICTS.fr.__names__={'סינטה':'Faux-filet'}; return itemName({heb:'סינטה',eng:'Striploin'}); })()`) as string;
  expect(name).toBe('סינטה');
});

test('i18n-names: en-mode — itemName(m) returns m.eng unchanged (zero-regression; __names__ is fr/de/es/it-only)', async ({ page }) => {
  await bootLang(page, 'en');
  const name = await page.evaluate(
    `(function(){ I18N_DICTS.en.__names__={'סינטה':'SHOULD-NOT-WIN'}; return itemName({heb:'סינטה',eng:'Striploin'}); })()`) as string;
  expect(name).toBe('Striploin');
});
